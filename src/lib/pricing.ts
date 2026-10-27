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
  | { ok: true; code: string; amount: number; freeShipping: boolean; label: string }
  | { ok: false; code: string; reason: string };

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
  if (!discount || !discount.is_active) return { ok: false, code: normalized, reason: "This discount code is not valid." };
  if (discount.starts_at && new Date(discount.starts_at) > now)
    return { ok: false, code: normalized, reason: "This discount code is not active yet." };
  if (discount.ends_at && new Date(discount.ends_at) <= now)
    return { ok: false, code: normalized, reason: "This discount code has expired." };
  if (discount.usage_limit != null && discount.usage_count >= discount.usage_limit)
    return { ok: false, code: normalized, reason: "This discount code has reached its usage limit." };
  if (subtotal <= 0) return { ok: false, code: normalized, reason: "Add items to your bag to use a discount." };
  if (subtotal < discount.min_subtotal)
    return {
      ok: false,
      code: normalized,
      reason: `This code requires a minimum order of ${(discount.min_subtotal / 100).toLocaleString("en-NG")} NGN.`,
    };

  switch (discount.type) {
    case "percentage": {
      const pct = Math.min(Math.max(discount.value, 0), 100);
      const amount = Math.min(subtotal, Math.round((subtotal * pct) / 100));
      return { ok: true, code: discount.code, amount, freeShipping: false, label: `${pct}% off` };
    }
    case "fixed": {
      const amount = Math.min(subtotal, discount.value);
      return { ok: true, code: discount.code, amount, freeShipping: false, label: "Discount" };
    }
    case "free_shipping":
      return { ok: true, code: discount.code, amount: 0, freeShipping: true, label: "Free delivery" };
  }
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
