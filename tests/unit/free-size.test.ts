import { describe, expect, it } from "vitest";
import { audienceOf, isFreeSize } from "@/lib/catalog/free-size";

describe("free size", () => {
  it("detects free-size products from sizes or text", () => {
    expect(isFreeSize({ name: "Ribbed Bodycon Dress" }, ["Free Size"])).toBe(true);
    expect(isFreeSize({ name: "Lounge Set", description: "One size, super stretchy" }, [null])).toBe(true);
    expect(isFreeSize({ name: "Body Fitted Top" }, [])).toBe(true);
    expect(isFreeSize({ name: "Tee", tags: ["FREE SIZE"] }, ["M"])).toBe(true);
  });
  it("keeps the size picker for products sold in several real sizes", () => {
    expect(isFreeSize({ name: "Stretchy Skinny Jeans" }, ["S", "M", "L"])).toBe(false);
    expect(isFreeSize({ name: "Cargo Pants" }, ["30", "32"])).toBe(false);
    expect(isFreeSize({ name: "Plain Hoodie" }, [null])).toBe(false);
  });
});

describe("audience", () => {
  it("tells women's and men's pages apart", () => {
    expect(audienceOf("/shop/womens-clothing")).toBe("women");
    expect(audienceOf("/shop/mens-clothing/jeans")).toBe("men");
    expect(audienceOf("/products/female-bodycon-gown")).toBe("women");
    expect(audienceOf("/products/baggy-cargo-pants")).toBe("men");
    expect(audienceOf("/")).toBe("unisex");
    expect(audienceOf("/cart")).toBe("unisex");
    expect(audienceOf("/shop/bags")).toBe("unisex");
  });
});
