import { describe, expect, it } from "vitest";
import { computeTotals, evaluateDiscount, type DiscountRecord } from "@/lib/pricing";

const base: DiscountRecord = {
  id: "d1", code: "WELCOME10", type: "percentage", value: 10, min_subtotal: 0,
  starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, is_active: true,
};
const NO_TAX = { mode: "none" as const, rate_bps: 0, label: "VAT" };

describe("discount evaluation", () => {
  it("applies a valid percentage discount", () => {
    const r = evaluateDiscount(base, "welcome10", 50_000_00);
    expect(r).toMatchObject({ ok: true, amount: 5_000_00, freeShipping: false });
  });

  it("caps fixed discounts at the subtotal", () => {
    const r = evaluateDiscount({ ...base, type: "fixed", value: 20_000_00 }, "X", 15_000_00);
    expect(r).toMatchObject({ ok: true, amount: 15_000_00 });
  });

  it("rejects unknown, inactive, expired, future and exhausted codes", () => {
    expect(evaluateDiscount(null, "NOPE", 1000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, is_active: false }, "X", 1000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, ends_at: "2020-01-01T00:00:00Z" }, "X", 1000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, starts_at: "2999-01-01T00:00:00Z" }, "X", 1000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, usage_limit: 5, usage_count: 5 }, "X", 1000).ok).toBe(false);
  });

  it("enforces minimum subtotal", () => {
    const r = evaluateDiscount({ ...base, min_subtotal: 30_000_00 }, "X", 29_999_99);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/minimum order/);
  });

  it("free-shipping codes zero the delivery fee but not the subtotal", () => {
    const d = evaluateDiscount({ ...base, type: "free_shipping", value: 0 }, "SHIPFREE", 10_000_00);
    const t = computeTotals({ lines: [{ unitPrice: 10_000_00, quantity: 1 }], discount: d, shippingFee: 4_000_00, tax: NO_TAX });
    expect(t).toMatchObject({ subtotal: 10_000_00, discountTotal: 0, shippingFee: 0, total: 10_000_00 });
  });
});

describe("order totals", () => {
  it("adds lines, discount, shipping and no tax", () => {
    const d = evaluateDiscount(base, "WELCOME10", 60_000_00);
    const t = computeTotals({
      lines: [{ unitPrice: 20_000_00, quantity: 2 }, { unitPrice: 20_000_00, quantity: 1 }],
      discount: d, shippingFee: 2_500_00, tax: NO_TAX,
    });
    expect(t).toEqual({ subtotal: 60_000_00, discountTotal: 6_000_00, shippingFee: 2_500_00, taxTotal: 0, taxIncluded: 0, total: 56_500_00 });
  });

  it("adds exclusive tax on the discounted subtotal", () => {
    const t = computeTotals({ lines: [{ unitPrice: 10_000_00, quantity: 1 }], discount: null, shippingFee: 0, tax: { mode: "exclusive", rate_bps: 750, label: "VAT" } });
    expect(t.taxTotal).toBe(750_00);
    expect(t.total).toBe(10_750_00);
  });

  it("reports inclusive tax without changing the total", () => {
    const t = computeTotals({ lines: [{ unitPrice: 10_750_00, quantity: 1 }], discount: null, shippingFee: 0, tax: { mode: "inclusive", rate_bps: 750, label: "VAT" } });
    expect(t.total).toBe(10_750_00);
    expect(t.taxIncluded).toBe(750_00);
  });

  it("rejects invalid quantities and fees", () => {
    expect(() => computeTotals({ lines: [{ unitPrice: 100, quantity: 0 }], discount: null, shippingFee: 0, tax: NO_TAX })).toThrow();
    expect(() => computeTotals({ lines: [{ unitPrice: 100, quantity: 1.5 }], discount: null, shippingFee: 0, tax: NO_TAX })).toThrow();
    expect(() => computeTotals({ lines: [{ unitPrice: 100, quantity: 1 }], discount: null, shippingFee: -5, tax: NO_TAX })).toThrow();
  });
});
