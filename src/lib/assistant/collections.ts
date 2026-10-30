// Each mascot has its own product collection, so they never share pages or products:
//   Haru → the female collection: Women's Clothing, Women's Shoes, Women's Sneakers and Bags.
//   Jin  → the male collection: Men's Clothing, Men's Sneakers and the unisex sneakers.
// Decided from category slugs, so new sub-categories land on the right side automatically.
import { audienceOf } from "@/lib/catalog/free-size";
import type { CharacterId } from "./characters";

interface Cat<T> {
  slug: string;
  children: T[];
}

/** Who owns a category: women's → Haru, men's → Jin; unisex bags → Haru, other unisex → Jin. */
export function ownerOf(slug: string, parentSlug?: string | null): CharacterId {
  // The parent decides first (Women's Clothing › Jackets is Haru's), then the category itself.
  const parentSide = parentSlug ? audienceOf(parentSlug) : "unisex";
  if (parentSide === "women") return "haru";
  if (parentSide === "men") return "jin";
  if (parentSlug && /bag/.test(parentSlug)) return "haru";
  const side = audienceOf(slug);
  if (side === "women") return "haru";
  if (side === "men") return "jin";
  return /bag/.test(parentSlug ?? slug) ? "haru" : "jin";
}

/** The categories (whole top-level ones, or single sub-categories) in a mascot's collection. */
export function collectionFor<T extends Cat<T>>(character: CharacterId, tree: T[]): T[] {
  const mine: T[] = [];
  for (const root of tree) {
    const side = audienceOf(root.slug);
    if (side !== "unisex" || /bag/.test(root.slug)) {
      if (ownerOf(root.slug) === character) mine.push(root);
      continue;
    }
    // A mixed top-level category (e.g. Sneakers): split it by sub-category.
    for (const child of root.children) if (ownerOf(child.slug, root.slug) === character) mine.push(child);
  }
  return mine;
}
