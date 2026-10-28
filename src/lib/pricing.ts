// Pure pricing logic. Runs on the server with data loaded from the database;
// totals submitted by the browser are never used.

export type DiscountType = "percentage" | "fixed" | "free_shipping";

export interface DiscountRecord {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  min_subtotal: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
}

export type DiscountEvaluation =
  | { ok: true; code: string; amount: number; freeShipping: boolean; label: string; automatic?: boolean; percent?: number; minSubtotal?: number }
  | { ok: false; code: string; reason: string; reasonCode?: DiscountReason; minSubtotal?: number };

export type DiscountReason = "invalid" | "not_started" | "expired" | "limit" | "empty" | "minimum";

export interface TaxConfig {
  mode: "none" | "inclusive" | "exclusive";
  rate_bps: number; // 750 = 7.5%
  label: string;
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

export function evaluateDiscount(
  discount: DiscountRecord | null,
  code: string,
  subtotal: number,
  now: Date = new Date(),
): DiscountEvaluation {
  const normalized = normalizeDiscountCode(code);
  if (!discount || !discount.is_active) return { ok: false, code: normalized, reason: "This discount code is not valid.", reasonCode: "invalid" };
  if (discount.starts_at && new Date(discount.starts_at) > now)
    return { ok: false, code: normalized, reason: "This discount code is not active yet.", reasonCode: "not_started" };
  if (discount.ends_at && new Date(discount.ends_at) <= now)
    return { ok: false, code: normalized, reason: "This discount code has expired.", reasonCode: "expired" };
  if (discount.usage_limit != null && discount.usage_count >= discount.usage_limit)
    return { ok: false, code: normalized, reason: "This discount code has reached its usage limit.", reasonCode: "limit" };
  if (subtotal <= 0) return { ok: false, code: normalized, reason: "Add items to your bag to use a discount.", reasonCode: "empty" };
  if (subtotal < discount.min_subtotal)
    return {
      ok: false,
      code: normalized,
      reason: `This code requires a minimum order of ${(discount.min_subtotal / 100).toLocaleString("en-NG")} NGN.`,
      reasonCode: "minimum",
      minSubtotal: discount.min_subtotal,
    };

  switch (discount.type) {
    case "percentage": {
      const pct = Math.min(Math.max(discount.value, 0), 100);
      const amount = Math.min(subtotal, Math.round((subtotal * pct) / 100));
      return { ok: true, code: discount.code, amount, freeShipping: false, label: `${pct}% off`, percent: pct };
    }
    case "fixed": {
      const amount = Math.min(subtotal, discount.value);
      return { ok: true, code: discount.code, amount, freeShipping: false, label: "Discount" };
    }
    case "free_shipping":
      return { ok: true, code: discount.code, amount: 0, freeShipping: true, label: "Free delivery" };
  }
}

/** Store-wide automatic offer, e.g. 10% off + free delivery on orders of ₦200,000 or more. */
export interface PromotionConfig {
  enabled: boolean;
  /** Code of a real discount row (percentage/fixed) that holds the amount; it is re-validated at checkout. */
  code: string;
  /** Minimum merchandise subtotal in kobo, before discounts. */
  min_subtotal: number;
  free_delivery: boolean;
  label: string;
}

/**
 * Applies the automatic offer when the bag qualifies. It replaces a code the
 * shopper typed (one discount per order) unless that code saves more.
 */
export function applyPromotion(
  promo: PromotionConfig | null | undefined,
  record: DiscountRecord | null,
  subtotal: number,
  entered: DiscountEvaluation | null,
  now: Date = new Date(),
): DiscountEvaluation | null {
  if (!promo?.enabled || !promo.code || subtotal < promo.min_subtotal) return entered;
  const ev = evaluateDiscount(record, promo.code, subtotal, now);
  if (!ev.ok) return entered;
  const auto: DiscountEvaluation = {
    ...ev,
    freeShipping: ev.freeShipping || promo.free_delivery,
    label: promo.label || ev.label,
    automatic: true,
    percent: record?.type === "percentage" ? record.value : undefined,
    minSubtotal: promo.min_subtotal,
  };
  if (entered?.ok && entered.amount > auto.amount) return entered;
  return auto;
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export function lineTotal(line: PricedLine): number {
  if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) throw new Error("Invalid unit price");
  if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("Invalid quantity");
  return line.unitPrice * line.quantity;
}

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  /** Tax already contained in prices (inclusive mode) — informational only. */
  taxIncluded: number;
  total: number;
}

export function computeTotals(input: {
  lines: PricedLine[];
  discount: DiscountEvaluation | null;
  shippingFee: number | null; // null = shipping not yet selected
  tax: TaxConfig;
}): OrderTotals {
  const subtotal = subtotalOf(input.lines);
  const discountOk = input.discount && input.discount.ok ? input.discount : null;
  const discountTotal = discountOk ? Math.min(discountOk.amount, subtotal) : 0;
  const shippingBase = input.shippingFee ?? 0;
  if (!Number.isInteger(shippingBase) || shippingBase < 0) throw new Error("Invalid shipping fee");
  const shippingFee = discountOk?.freeShipping ? 0 : shippingBase;
  const taxable = subtotal - discountTotal;
  const rate = Math.max(0, input.tax.rate_bps) / 10000;
  let taxTotal = 0;
  let taxIncluded = 0;
  if (input.tax.mode === "exclusive" && rate > 0) taxTotal = Math.round(taxable * rate);
  if (input.tax.mode === "inclusive" && rate > 0) taxIncluded = Math.round(taxable - taxable / (1 + rate));
  return {
    subtotal,
    discountTotal,
    shippingFee,
    taxTotal,
    taxIncluded,
    total: subtotal - discountTotal + shippingFee + taxTotal,
  };
}
