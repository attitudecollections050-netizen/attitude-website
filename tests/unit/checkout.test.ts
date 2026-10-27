import { describe, expect, it } from "vitest";
import { buildOrderPayload, describeOrderError, idempotencyKey } from "@/lib/orders/build";
import { assessLine, type RawCartLine } from "@/lib/cart/assess";
import { evaluateDiscount } from "@/lib/pricing";
import { checkoutSchema, safeNextPath } from "@/lib/validation";
import type { ShippingOption } from "@/lib/shipping/calculator";

const raw = (over: Partial<RawCartLine> = {}): RawCartLine => ({
  itemId: "i1", variantId: "11111111-1111-4111-8111-111111111111", productId: "p1", slug: "tee", name: "Tee",
  imageUrl: null, imageAlt: null, sku: "TEE-BLK-M", size: "M", color: "Black", price: 20_000_00, salePrice: null,
  quantity: 2, onHand: 10, allowBackorder: false, variantActive: true, productStatus: "published", weightGrams: 300, ...over,
});

const shipping: ShippingOption = {
  rateId: "22222222-2222-4222-8222-222222222222", methodName: "Standard delivery", description: null, fee: 4_000_00,
  originalFee: 4_000_00, freeShippingApplied: false, currency: "NGN", minDays: null, maxDays: null, isManual: true, zoneName: "NG",
};

const address = { full_name: "Ada Obi", phone: "+2348012345678", country_code: "NG", region: "LA", city: "Lagos", line1: "12 Allen Avenue", line2: "", postal_code: "" };

const input = (over = {}) => ({
  cartId: "33333333-3333-4333-8333-333333333333", userId: null, email: "ada@example.com", address, regionName: "Lagos",
  deliveryInstructions: "", lines: [assessLine(raw(), 10)], discount: null, shipping,
  tax: { mode: "none" as const, rate_bps: 0, label: "VAT" }, currency: "NGN", nonce: "abcdefghijklmnop1234", ...over,
});

describe("checkout validation", () => {
  const valid = { email: "Ada@Example.com ", address, delivery_instructions: "", shipping_rate_id: shipping.rateId, nonce: "abcdefghijklmnop1234" };

  it("accepts and normalises a valid submission", () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ada@example.com");
  });

  it("rejects bad email, phone, missing street and shipping method", () => {
    expect(checkoutSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, address: { ...address, phone: "abc" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, address: { ...address, line1: "" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, shipping_rate_id: "" }).success).toBe(false);
  });

  it("ignores any client-supplied totals entirely", () => {
    const r = checkoutSchema.safeParse({ ...valid, total: 1, shipping_fee: 0, subtotal: 1 });
    expect(r.success && Object.keys(r.data)).not.toContain("total");
  });

  it("only allows same-site redirect paths", () => {
    expect(safeNextPath("/account/orders")).toBe("/account/orders");
    expect(safeNextPath("https://evil.com")).toBe("/account");
    expect(safeNextPath("//evil.com")).toBe("/account");
  });
});

describe("server-side order payload", () => {
  it("computes totals from database prices and the server shipping quote", () => {
    const { order, items } = buildOrderPayload(input());
    expect(order).toMatchObject({ subtotal: 40_000_00, discount_total: 0, shipping_fee: 4_000_00, tax_total: 0, total: 44_000_00 });
    expect(items[0]).toMatchObject({ unit_price: 20_000_00, quantity: 2, variant_label: "Black · Size M" });
  });

  it("applies a server-validated discount", () => {
    const discount = evaluateDiscount({ id: "d", code: "TEN", type: "percentage", value: 10, min_subtotal: 0, starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, is_active: true }, "TEN", 40_000_00);
    const { order } = buildOrderPayload(input({ discount }));
    expect(order).toMatchObject({ discount_total: 4_000_00, discount_code: "TEN", total: 40_000_00 });
  });

  it("refuses out-of-stock lines", () => {
    expect(() => buildOrderPayload(input({ lines: [assessLine(raw({ onHand: 1 }), 10)] }))).toThrow(/Only 1 left/);
    expect(() => buildOrderPayload(input({ lines: [] }))).toThrow(/empty/);
  });

  it("derives a stable idempotency key that changes with the cart", () => {
    const a = idempotencyKey(input());
    expect(idempotencyKey(input())).toBe(a);
    expect(idempotencyKey(input({ lines: [assessLine(raw({ quantity: 3 }), 10)] }))).not.toBe(a);
    expect(idempotencyKey(input({ nonce: "zzzzzzzzzzzzzzzz9999" }))).not.toBe(a);
  });

  it("maps database errors to friendly messages", () => {
    expect(describeOrderError("insufficient_stock:TEE")).toMatch(/enough stock/);
    expect(describeOrderError("price_changed:TEE")).toMatch(/Prices have changed/);
  });
});
