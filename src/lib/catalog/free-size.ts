// "Free size" (one size, stretchy) products, and which shopper a page is for (women or men).
// Shared by the product page, the cart and the mascots.

/** Words in a product's name, description, details or tags that mean "one size fits most". */
export const FREE_SIZE_WORDS = /\b(free[\s-]*size|one[\s-]*size|fits?[\s-]*any[\s-]*body|fits?[\s-]*anybody|body[\s-]*fitted|stretchy)\b/i;
/** Variant size values that already mean one size. */
const FREE_SIZE_VALUE = /^(free|free[\s-]*size|one[\s-]*size|onesize|os|fs|universal)$/i;

export interface FreeSizeInput {
  name: string;
  description?: string | null;
  details?: string | null;
  tags?: string[] | null;
}

export function mentionsFreeSize(p: FreeSizeInput): boolean {
  return FREE_SIZE_WORDS.test([p.name, p.description ?? "", p.details ?? "", ...(p.tags ?? [])].join(" \n "));
}

/**
 * A product is free size when its sizes say so ("Free Size", "One Size"), or when its text
 * says so and it has at most one real size. Products sold in several real sizes keep their
 * size picker even if the description mentions "stretchy".
 */
export function isFreeSize(p: FreeSizeInput, sizes: (string | null | undefined)[]): boolean {
  const named = sizes.map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  const real = [...new Set(named.filter((s) => !FREE_SIZE_VALUE.test(s)))];
  if (named.length && real.length === 0) return true;
  return real.length <= 1 && mentionsFreeSize(p);
}

export const FREE_SIZE_LABEL = "Free Size";

export type Audience = "women" | "men" | "unisex";
const WOMEN = /(women|womens|woman|female|ladies|lady|girls?\b|bodycon|gowns?\b|dress|skirt|blouse|bra\b|heels)/i;
const MEN = /((^|[^a-z])(men|mens|man|male|guys?|boys?)([^a-z]|$)|cargo|baggy|jeans|jersey)/i;

/** Women's or men's side of the shop, from a URL path or a product's name/category text. */
export function audienceOf(text: string): Audience {
  if (WOMEN.test(text)) return "women";
  if (MEN.test(text)) return "men";
  return "unisex";
}
