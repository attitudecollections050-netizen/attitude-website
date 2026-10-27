import { describe, expect, it } from "vitest";
import { assessLine, cartIsPurchasable, cartWeight, variantLabel, type RawCartLine } from "@/lib/cart/assess";

const line = (over: Partial<RawCartLine> = {}): RawCartLine => ({
  itemId: "i1", variantId: "v1", productId: "p1", slug: "tee", name: "Tee", imageUrl: null, imageAlt: null,
  sku: "TEE-BLK-M", size: "M", color: "Black", price: 20_000_00, salePrice: null, quantity: 2, onHand: 10,
  allowBackorder: false, variantActive: true, productStatus: "published", weightGrams: 300, ...over,
});

describe("cart line assessment", () => {
  it("prices using the sale price from the database", () => {
    const l = assessLine(line({ salePrice: 15_000_00 }), 10);
    expect(l).toMatchObject({ unitPrice: 15_000_00, compareAtPrice: 20_000_00, lineTotal: 30_000_00, purchasable: true });
  });

  it("blocks sold-out variants", () => {
    expect(assessLine(line({ onHand: 0 }), 10)).toMatchObject({ purchasable: false, warning: expect.stringMatching(/Sold out/) });
  });

  it("blocks quantities above stock and warns", () => {
    const l = assessLine(line({ quantity: 5, onHand: 3 }), 10);
    expect(l).toMatchObject({ purchasable: false, maxQuantity: 3, warning: "Only 3 left in stock. Please reduce the quantity." });
  });

  it("shows a low-stock warning without blocking", () => {
    expect(assessLine(line({ quantity: 1, onHand: 2 }), 10)).toMatchObject({ purchasable: true, warning: "Only 2 left" });
  });

  it("allows explicit backorders", () => {
    expect(assessLine(line({ onHand: 0, allowBackorder: true }), 10)).toMatchObject({ purchasable: true, warning: expect.stringMatching(/backorder/) });
  });

  it("blocks unpublished products and inactive variants", () => {
    expect(assessLine(line({ productStatus: "archived" }), 10).purchasable).toBe(false);
    expect(assessLine(line({ variantActive: false }), 10).purchasable).toBe(false);
  });

  it("aggregates purchasability and weight", () => {
    const ok = assessLine(line(), 10);
    const bad = assessLine(line({ onHand: 0 }), 10);
    expect(cartIsPurchasable([ok])).toBe(true);
    expect(cartIsPurchasable([ok, bad])).toBe(false);
    expect(cartIsPurchasable([])).toBe(false);
    expect(cartWeight([ok])).toBe(600);
  });

  it("labels variants", () => {
    expect(variantLabel("M", "Black")).toBe("Black · Size M");
    expect(variantLabel(null, "Rose")).toBe("Rose");
  });
});
