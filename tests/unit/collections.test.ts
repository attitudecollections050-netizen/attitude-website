import { describe, expect, it } from "vitest";
import { collectionFor, ownerOf } from "@/lib/assistant/collections";

interface C {
  id: string;
  slug: string;
  name: string;
  href: string;
  children: C[];
}
const c = (slug: string, children: string[] = []): C => ({ id: slug, slug, name: slug, href: `/shop/${slug}`, children: children.map((s) => c(s)) });
const tree = [
  c("bags", ["handbags", "tote-bags"]),
  c("men", ["t-shirts", "jeans", "hoodies-sweatshirts"]),
  c("sneakers", ["casual-sneakers", "mens-sneakers", "unisex-sneakers", "womens-sneakers"]),
  c("women", ["dresses", "hoodies-sweatshirts"]),
  c("womens-shoes", ["sandals", "heels"]),
];

describe("separate collections for Haru and Jin", () => {
  it("gives Haru the female collection and Jin the male collection", () => {
    expect(collectionFor("haru", tree).map((x) => x.slug)).toEqual(["bags", "womens-sneakers", "women", "womens-shoes"]);
    expect(collectionFor("jin", tree).map((x) => x.slug)).toEqual(["men", "casual-sneakers", "mens-sneakers", "unisex-sneakers"]);
  });
  it("never puts a category in both collections", () => {
    const haru = new Set(collectionFor("haru", tree).map((x) => x.id));
    expect(collectionFor("jin", tree).some((x) => haru.has(x.id))).toBe(false);
  });
  it("assigns product categories by their parent", () => {
    expect(ownerOf("dresses", "women")).toBe("haru");
    expect(ownerOf("handbags", "bags")).toBe("haru");
    expect(ownerOf("mens-sneakers", "sneakers")).toBe("jin");
    expect(ownerOf("womens-sneakers", "sneakers")).toBe("haru");
    expect(ownerOf("unisex-sneakers", "sneakers")).toBe("jin");
    expect(ownerOf("jackets-outerwear", "women")).toBe("haru");
    expect(ownerOf("hoodies-sweatshirts", "women")).toBe("haru");
    expect(ownerOf("hoodies-sweatshirts", "men")).toBe("jin");
  });
});
