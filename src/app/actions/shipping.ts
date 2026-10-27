"use server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { quoteShipping } from "@/lib/shipping/service";
import { getSettings } from "@/lib/settings";
import { getProductBySlug } from "@/lib/catalog/queries";
import { getCartId, priceCart } from "@/lib/cart/server";
import { cartWeight } from "@/lib/cart/assess";
import type { ShippingQuote } from "@/lib/shipping/calculator";

const destSchema = z.object({
  country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  region: z.string().trim().max(100).default(""),
  city: z.string().trim().max(100).default(""),
  postal_code: z.string().trim().max(20).optional().default(""),
});

/** Delivery estimate for a single product page (no address details stored). */
export async function estimateProductShipping(slug: string, input: unknown): Promise<ShippingQuote> {
  if (!isSupabaseConfigured()) return { ok: false, code: "no_zone", message: "Delivery estimates are not available yet." };
  const parsed = destSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_address", message: "Please choose a destination." };
  if (!(await rateLimit("ship-estimate", 60, 300))) return { ok: false, code: "invalid_address", message: "Too many requests. Please wait a moment." };
  const product = await getProductBySlug(slug);
  if (!product) return { ok: false, code: "invalid_address", message: "Product not found." };
  const settings = await getSettings();
  // Postcode isn't collected on the product page, so it's not required for an estimate.
  const address = { ...parsed.data, postal_code: parsed.data.postal_code || "estimate" };
  return quoteShipping(address, { subtotalAfterDiscount: product.sale_price ?? product.price, weightGrams: product.weight_grams }, settings.store.currency);
}

/** Shipping options for the current cart at checkout. Always recalculated again when placing the order. */
export async function quoteCartShipping(input: unknown): Promise<ShippingQuote> {
  if (!isSupabaseConfigured()) return { ok: false, code: "no_zone", message: "Checkout is not available yet." };
  const parsed = destSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_address", message: "Please complete your delivery address." };
  if (!(await rateLimit("ship-quote", 60, 300))) return { ok: false, code: "invalid_address", message: "Too many requests. Please wait a moment." };
  const cartId = await getCartId();
  if (!cartId) return { ok: false, code: "invalid_address", message: "Your bag is empty." };
  const priced = await priceCart(cartId);
  const discount = priced.discount?.ok ? priced.discount.amount : 0;
  const settings = await getSettings();
  return quoteShipping(parsed.data, { subtotalAfterDiscount: priced.subtotal - discount, weightGrams: cartWeight(priced.lines) }, settings.store.currency);
}
