import { describe, expect, it } from "vitest";
import { applyPromotion, computeTotals, evaluateDiscount, type DiscountRecord, type PromotionConfig } from "@/lib/pricing";

const NAIRA = 100;
const promo: PromotionConfig = { enabled: true, code: "SPEND200K", min_subtotal: 200_000 * NAIRA, free_delivery: true, label: "10% off + free delivery (orders ₦200,000+)" };
const rec: DiscountRecord = { id: "d1", code: "SPEND200K", type: "percentage", value: 10, min_subtotal: 200_000 * NAIRA, starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, is_active: true };
const tax = { mode: "none" as const, rate_bps: 0, label: "VAT" };

describe("automatic ₦200,000 offer", () => {
  it("does nothing below ₦200,000", () => {
    expect(applyPromotion(promo, rec, 199_999 * NAIRA, null)).toBeNull();
  });

  it("gives 10% off and free delivery from ₦200,000", () => {
    const d = applyPromotion(promo, rec, 200_000 * NAIRA, null)!;
    expect(d).toMatchObject({ ok: true, code: "SPEND200K", amount: 20_000 * NAIRA, freeShipping: true, automatic: true });
    const t = computeTotals({ lines: [{ unitPrice: 50_000 * NAIRA, quantity: 4 }], discount: d, shippingFee: 4_000 * NAIRA, tax });
    expect(t).toMatchObject({ subtotal: 200_000 * NAIRA, discountTotal: 20_000 * NAIRA, shippingFee: 0, total: 180_000 * NAIRA });
  });

  it("replaces a smaller code but keeps a bigger one", () => {
    const small = evaluateDiscount({ ...rec, code: "WELCOME5", value: 5, min_subtotal: 0 }, "WELCOME5", 300_000 * NAIRA);
    expect(applyPromotion(promo, rec, 300_000 * NAIRA, small)).toMatchObject({ code: "SPEND200K", automatic: true });
    const big = evaluateDiscount({ ...rec, code: "VIP20", value: 20, min_subtotal: 0 }, "VIP20", 300_000 * NAIRA);
    expect(applyPromotion(promo, rec, 300_000 * NAIRA, big)).toMatchObject({ code: "VIP20" });
  });

  it("stays off when disabled or the code is inactive", () => {
    expect(applyPromotion({ ...promo, enabled: false }, rec, 500_000 * NAIRA, null)).toBeNull();
    expect(applyPromotion(promo, { ...rec, is_active: false }, 500_000 * NAIRA, null)).toBeNull();
  });

  it("the code alone (typed manually) still needs ₦200,000", () => {
    expect(evaluateDiscount(rec, "SPEND200K", 150_000 * NAIRA).ok).toBe(false);
  });
});
