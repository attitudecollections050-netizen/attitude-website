// Pure construction of the order payload sent to create_order().
import { createHash } from "node:crypto";
import type { CartLine } from "@/lib/cart/assess";
import { variantLabel } from "@/lib/cart/assess";
import { computeTotals, type DiscountEvaluation, type TaxConfig } from "@/lib/pricing";
import type { ShippingOption } from "@/lib/shipping/calculator";
import type { AddressInput } from "@/lib/validation";

export interface BuildOrderInput {
  cartId: string;
  userId: string | null;
  email: string;
  address: AddressInput;
  regionName: string;
  deliveryInstructions: string;
  lines: CartLine[];
  discount: DiscountEvaluation | null;
  shipping: ShippingOption;
  tax: TaxConfig;
  currency: string;
  nonce: string;
}

export function idempotencyKey(input: Pick<BuildOrderInput, "cartId" | "nonce" | "lines" | "discount" | "shipping" | "address" | "email">) {
  const fingerprint = JSON.stringify({
    c: input.cartId,
    n: input.nonce,
    l: input.lines.map((l) => [l.variantId, l.quantity, l.unitPrice]),
    d: input.discount?.ok ? input.discount.code : null,
    s: [input.shipping.rateId, input.shipping.fee],
    a: [input.address.country_code, input.address.region, input.address.city, input.address.line1, input.address.line2],
    e: input.email,
  });
  return createHash("sha256").update(fingerprint).digest("hex");
}

export function buildOrderPayload(input: BuildOrderInput) {
  if (input.lines.length === 0) throw new Error("Your bag is empty.");
  const blocked = input.lines.find((l) => !l.purchasable);
  if (blocked) throw new Error(`${blocked.name}: ${blocked.warning ?? "not available"}`);

  const discount = input.discount && input.discount.ok ? input.discount : null;
  const totals = computeTotals({
    lines: input.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    discount,
    shippingFee: input.shipping.fee,
    tax: input.tax,
  });

  const order = {
    idempotency_key: idempotencyKey(input),
    user_id: input.userId,
    cart_id: input.cartId,
    email: input.email,
    phone: input.address.phone,
    customer_name: input.address.full_name,
    shipping_address: {
      full_name: input.address.full_name,
      phone: input.address.phone,
      country_code: input.address.country_code,
      region: input.regionName,
      city: input.address.city,
      line1: input.address.line1,
      line2: input.address.line2 || null,
      postal_code: input.address.postal_code || null,
    },
    delivery_instructions: input.deliveryInstructions || null,
    shipping_method_name: input.shipping.methodName,
    shipping_rate_id: input.shipping.rateId,
    shipping_is_manual: input.shipping.isManual,
    shipping_min_days: input.shipping.minDays,
    shipping_max_days: input.shipping.maxDays,
    currency: input.currency,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    discount_code: discount?.code ?? null,
    shipping_fee: totals.shippingFee,
    tax_total: totals.taxTotal,
    total: totals.total,
  };

  const items = input.lines.map((l) => ({
    product_id: l.productId,
    variant_id: l.variantId,
    product_name: l.name,
    product_slug: l.slug,
    variant_label: variantLabel(l.size, l.color),
    sku: l.sku,
    image_url: l.imageUrl,
    unit_price: l.unitPrice,
    quantity: l.quantity,
  }));

  return { order, items, totals };
}

/** Maps create_order() exceptions to customer-friendly messages. */
/** Translation key (namespace "checkoutErrors") for a create_order failure. */
export function orderErrorKey(message: string): string {
  if (message.includes("insufficient_stock")) return "stock";
  if (message.includes("variant_unavailable")) return "itemUnavailable";
  if (message.includes("price_changed") || message.includes("subtotal_mismatch")) return "pricesChanged";
  if (message.includes("discount_invalid")) return "discountInvalid";
  if (message.includes("empty_cart")) return "emptyBag";
  return "orderFailed";
}

export function describeOrderError(message: string): string {
  if (message.includes("insufficient_stock")) return "Some items in your bag no longer have enough stock. Please review your bag.";
  if (message.includes("variant_unavailable")) return "An item in your bag is no longer available. Please review your bag.";
  if (message.includes("price_changed") || message.includes("subtotal_mismatch"))
    return "Prices have changed since you added items to your bag. Please review your bag.";
  if (message.includes("discount_invalid")) return "Your discount code is no longer valid. Please remove it and try again.";
  if (message.includes("empty_cart")) return "Your bag is empty.";
  return "We couldn't place your order. Please try again.";
}
