"use server";
import { getProductBySlug } from "@/lib/catalog/queries";

/** Variant options for quick-add (public data only). */
export async function getQuickAddOptions(slug: string) {
  const p = await getProductBySlug(slug);
  if (!p) return null;
  return {
    allowBackorder: p.allow_backorder,
    variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, color_hex: v.color_hex, available: p.allow_backorder || v.on_hand > 0 })),
  };
}
