import "server-only";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { applyPromotion, evaluateDiscount, normalizeDiscountCode, subtotalOf, type DiscountEvaluation, type DiscountRecord } from "@/lib/pricing";
import { assessLine, cartIsPurchasable, type CartLine, type RawCartLine } from "./assess";
import { EMPTY_CART, type CartView } from "./types";

export const CART_COOKIE = "ac_cart";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCartId(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

/** Returns the visitor's cart id, creating a cart (and cookie) when needed. */
export async function getOrCreateCartId(userId: string | null): Promise<string> {
  const existing = await getCartId();
  const db = createServiceClient();
  if (existing) {
    const { data } = await db.from("carts").select("id").eq("id", existing).maybeSingle();
    if (data) return existing;
  }
  const { data, error } = await db.from("carts").insert({ user_id: userId }).select("id").single();
  if (error || !data) throw new Error("Could not create cart");
  (await cookies()).set(CART_COOKIE, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return data.id;
}

interface CartItemRow {
  id: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    is_active: boolean;
    inventory: { on_hand: number } | { on_hand: number }[] | null;
    product: {
      translations?: Record<string, { name?: string } | undefined> | null;
      id: string;
      slug: string;
      name: string;
      price: number;
      sale_price: number | null;
      status: string;
      allow_backorder: boolean;
      weight_grams: number;
      product_images: { url: string; alt: string; sort_order: number; color: string | null }[];
    };
  } | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function loadRawLines(cartId: string): Promise<{ lines: RawCartLine[]; discountCode: string | null }> {
  const db = createServiceClient();
  const [{ data: cart }, { data: items, error }] = await Promise.all([
    db.from("carts").select("discount_code").eq("id", cartId).maybeSingle(),
    db
      .from("cart_items")
      .select(
        `id, quantity,
         variant:product_variants (
           id, sku, size, color, is_active,
           inventory ( on_hand ),
           product:products ( id, slug, name, price, sale_price, status, allow_backorder, weight_grams, translations,
             product_images ( url, alt, sort_order, color ) )
         )`,
      )
      .eq("cart_id", cartId)
      .order("created_at"),
  ]);
  if (error) throw error;
  const lines: RawCartLine[] = [];
  for (const row of (items ?? []) as unknown as CartItemRow[]) {
    const v = row.variant;
    if (!v) continue;
    const images = [...(v.product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const image = images.find((i) => v.color && i.color === v.color) ?? images[0] ?? null;
    lines.push({
      itemId: row.id,
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? null,
      sku: v.sku,
      size: v.size,
      color: v.color,
      price: v.product.price,
      salePrice: v.product.sale_price,
      quantity: row.quantity,
      onHand: one(v.inventory)?.on_hand ?? 0,
      allowBackorder: v.product.allow_backorder,
      variantActive: v.is_active,
      productStatus: v.product.status,
      weightGrams: v.product.weight_grams,
      translations: v.product.translations ?? undefined,
    });
  }
  return { lines, discountCode: cart?.discount_code ?? null };
}

export async function loadDiscount(code: string): Promise<DiscountRecord | null> {
  const { data } = await createServiceClient()
    .from("discounts")
    .select("id, code, type, value, min_subtotal, starts_at, ends_at, usage_limit, usage_count, is_active")
    .eq("code", normalizeDiscountCode(code))
    .maybeSingle();
  return (data as DiscountRecord | null) ?? null;
}

export interface PricedCart {
  cartId: string;
  lines: CartLine[];
  subtotal: number;
  discount: DiscountEvaluation | null;
}

/** Loads and prices a cart entirely from database values. */
export async function priceCart(cartId: string): Promise<PricedCart> {
  const settings = await getSettings();
  const { lines: raw, discountCode } = await loadRawLines(cartId);
  const lines = raw.map((l) => assessLine(l, settings.checkout.max_quantity_per_item));
  const subtotal = subtotalOf(lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })));
  let discount: DiscountEvaluation | null = null;
  if (discountCode) {
    discount = evaluateDiscount(await loadDiscount(discountCode), discountCode, subtotal);
  }
  const promo = settings.promotion;
  if (promo.enabled && promo.code && subtotal >= promo.min_subtotal) {
    discount = applyPromotion(promo, await loadDiscount(promo.code), subtotal, discount);
  }
  return { cartId, lines, subtotal, discount };
}

export function toCartView(priced: PricedCart | null): CartView {
  if (!priced) return EMPTY_CART;
  const discountOk = priced.discount?.ok ? priced.discount : null;
  const discountAmount = discountOk ? discountOk.amount : 0;
  return {
    lines: priced.lines,
    itemCount: priced.lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: priced.subtotal,
    discount: discountOk
      ? { code: discountOk.code, label: discountOk.label, amount: discountOk.amount, freeShipping: discountOk.freeShipping, automatic: Boolean(discountOk.automatic), percent: discountOk.percent, minSubtotal: discountOk.minSubtotal }
      : null,
    discountError: priced.discount && !priced.discount.ok ? priced.discount.reason : null,
    discountErrorCode: priced.discount && !priced.discount.ok && priced.discount.reasonCode ? { reason: priced.discount.reasonCode, minSubtotal: priced.discount.minSubtotal } : null,
    totalBeforeShipping: priced.subtotal - discountAmount,
    purchasable: cartIsPurchasable(priced.lines),
    currency: "NGN",
  };
}

export async function getCartView(): Promise<CartView> {
  if (!isSupabaseConfigured()) return EMPTY_CART;
  try {
    const cartId = await getCartId();
    if (!cartId) return EMPTY_CART;
    return toCartView(await priceCart(cartId));
  } catch (e) {
    console.error("[cart] load failed:", (e as Error).message);
    return EMPTY_CART;
  }
}

/** After sign-in: attach the cookie cart to the user and fold in any older cart they had. */
export async function attachCartToUser(userId: string) {
  const db = createServiceClient();
  const cartId = await getCartId();
  const { data: older } = await db
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .neq("id", cartId ?? "00000000-0000-0000-0000-000000000000")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cartId) {
    if (older) {
      (await cookies()).set(CART_COOKIE, older.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 60,
      });
    }
    return;
  }
  await db.from("carts").update({ user_id: userId }).eq("id", cartId);
  if (older) {
    const { data: olderItems } = await db.from("cart_items").select("variant_id, quantity").eq("cart_id", older.id);
    for (const item of olderItems ?? []) {
      const { data: existing } = await db
        .from("cart_items")
        .select("id")
        .eq("cart_id", cartId)
        .eq("variant_id", item.variant_id)
        .maybeSingle();
      if (!existing) await db.from("cart_items").insert({ cart_id: cartId, variant_id: item.variant_id, quantity: item.quantity });
    }
    await db.from("carts").delete().eq("id", older.id);
  }
}
