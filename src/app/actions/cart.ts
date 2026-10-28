"use server";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getCartId, getCartView, getOrCreateCartId, loadDiscount, priceCart, toCartView } from "@/lib/cart/server";
import { evaluateDiscount, normalizeDiscountCode } from "@/lib/pricing";
import type { CartView } from "@/lib/cart/types";

export type CartActionResult = { ok: true; cart: CartView; message?: string } | { ok: false; error: string; cart?: CartView };

const uuid = z.string().uuid();
const qty = z.number().int().min(1).max(20);

async function ensureConfigured(): Promise<CartActionResult | null> {
  if (!isSupabaseConfigured()) return { ok: false, error: (await getTranslations("cartErrors"))("notConnected") };
  return null;
}

async function variantAvailability(variantId: string) {
  const { data } = await createServiceClient()
    .from("product_variants")
    .select("id, is_active, inventory ( on_hand ), product:products ( status, allow_backorder, name, translations )")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return null;
  const inv = Array.isArray(data.inventory) ? data.inventory[0] : data.inventory;
  const product = (Array.isArray(data.product) ? data.product[0] : data.product) as { status: string; allow_backorder: boolean; name: string; translations?: Record<string, { name?: string }> | null };
  const locale = await getLocale();
  const name = product.translations?.[locale]?.name?.trim() || product.name;
  return { active: data.is_active && product.status === "published", onHand: inv?.on_hand ?? 0, backorder: product.allow_backorder, name };
}

export async function getCart(): Promise<CartView> {
  return getCartView();
}

export async function addToCart(variantId: string, quantity = 1): Promise<CartActionResult> {
  const notReady = await ensureConfigured();
  if (notReady) return notReady;
  const t = await getTranslations("cartErrors");
  if (!uuid.safeParse(variantId).success || !qty.safeParse(quantity).success) return { ok: false, error: t("invalidOption") };
  if (!(await rateLimit("cart", 120, 60))) return { ok: false, error: t("tooMany") };

  const settings = await getSettings();
  const v = await variantAvailability(variantId);
  if (!v || !v.active) return { ok: false, error: t("unavailable") };

  const user = await getCurrentUser();
  const cartId = await getOrCreateCartId(user?.id ?? null);
  const db = createServiceClient();
  const { data: existing } = await db.from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("variant_id", variantId).maybeSingle();
  const newQty = (existing?.quantity ?? 0) + quantity;
  const max = settings.checkout.max_quantity_per_item;

  if (newQty > max) return { ok: false, error: t("max", { max }), cart: toCartView(await priceCart(cartId)) };
  if (!v.backorder && newQty > v.onHand) {
    return {
      ok: false,
      error: v.onHand <= 0 ? t("soldOut") : existing ? t("onlyLeftInBag", { count: v.onHand }) : t("onlyLeft", { count: v.onHand }),
      cart: toCartView(await priceCart(cartId)),
    };
  }

  const { error } = existing
    ? await db.from("cart_items").update({ quantity: newQty }).eq("id", existing.id)
    : await db.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity });
  if (error) return { ok: false, error: t("updateFailed") };
  await db.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
  return { ok: true, cart: toCartView(await priceCart(cartId)), message: t("added", { name: v.name }) };
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartActionResult> {
  const notReady = await ensureConfigured();
  if (notReady) return notReady;
  const t = await getTranslations("cartErrors");
  if (!uuid.safeParse(itemId).success || !Number.isInteger(quantity) || quantity < 0 || quantity > 20) return { ok: false, error: t("invalidQuantity") };
  const cartId = await getCartId();
  if (!cartId) return { ok: false, error: t("emptyBag") };
  const db = createServiceClient();
  const { data: item } = await db.from("cart_items").select("id, variant_id").eq("id", itemId).eq("cart_id", cartId).maybeSingle();
  if (!item) return { ok: false, error: t("notInBag"), cart: toCartView(await priceCart(cartId)) };

  if (quantity === 0) {
    await db.from("cart_items").delete().eq("id", itemId).eq("cart_id", cartId);
    return { ok: true, cart: toCartView(await priceCart(cartId)) };
  }
  const settings = await getSettings();
  const v = await variantAvailability(item.variant_id);
  if (quantity > settings.checkout.max_quantity_per_item) return { ok: false, error: t("max", { max: settings.checkout.max_quantity_per_item }), cart: toCartView(await priceCart(cartId)) };
  if (v && !v.backorder && quantity > v.onHand) {
    return { ok: false, error: v.onHand > 0 ? t("onlyLeft", { count: v.onHand }) : t("optionSoldOut"), cart: toCartView(await priceCart(cartId)) };
  }
  await db.from("cart_items").update({ quantity }).eq("id", itemId).eq("cart_id", cartId);
  return { ok: true, cart: toCartView(await priceCart(cartId)) };
}

export async function removeCartItem(itemId: string): Promise<CartActionResult> {
  return updateCartItem(itemId, 0);
}

export async function applyDiscountCode(code: string): Promise<CartActionResult> {
  const notReady = await ensureConfigured();
  if (notReady) return notReady;
  const normalized = normalizeDiscountCode(String(code ?? ""));
  const t = await getTranslations("cartErrors");
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) return { ok: false, error: t("invalidCode") };
  if (!(await rateLimit("discount", 15, 300))) return { ok: false, error: t("tooManyCodes") };
  const cartId = await getCartId();
  if (!cartId) return { ok: false, error: t("addFirst") };
  const priced = await priceCart(cartId);
  const evaluation = evaluateDiscount(await loadDiscount(normalized), normalized, priced.subtotal);
  if (!evaluation.ok) {
    const tc = await getTranslations("cart");
    const min = evaluation.minSubtotal ? `₦${(evaluation.minSubtotal / 100).toLocaleString("en-NG")}` : "";
    const error = evaluation.reasonCode ? tc(`discountErrors.${evaluation.reasonCode}`, { min }) : evaluation.reason;
    return { ok: false, error, cart: toCartView(priced) };
  }
  await createServiceClient().from("carts").update({ discount_code: normalized }).eq("id", cartId);
  return { ok: true, cart: toCartView(await priceCart(cartId)), message: t("discountApplied") };
}

export async function removeDiscountCode(): Promise<CartActionResult> {
  const notReady = await ensureConfigured();
  if (notReady) return notReady;
  const cartId = await getCartId();
  if (!cartId) return { ok: true, cart: await getCartView() };
  await createServiceClient().from("carts").update({ discount_code: null }).eq("id", cartId);
  return { ok: true, cart: toCartView(await priceCart(cartId)) };
}
