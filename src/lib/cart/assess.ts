// Pure cart assessment: decides what can be bought and why not.

export interface RawCartLine {
  itemId: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  salePrice: number | null;
  quantity: number;
  onHand: number;
  allowBackorder: boolean;
  variantActive: boolean;
  productStatus: string;
  weightGrams: number;
  /** Per-language product text, e.g. { fr: { name: "…" } } (display only). */
  translations?: Record<string, { name?: string } | undefined>;
}

export interface CartLine extends Omit<RawCartLine, "onHand" | "variantActive" | "productStatus"> {
  unitPrice: number;
  compareAtPrice: number | null;
  lineTotal: number;
  purchasable: boolean;
  maxQuantity: number;
  stockLeft: number | null;
  warning: string | null;
  /** Machine-readable warning so the storefront can show it in the shopper's language. */
  warningCode: "unavailable" | "backorder" | "sold_out" | "reduce" | "low_stock" | null;
}

export function variantLabel(size: string | null, color: string | null): string {
  return [color, size ? (size === "Free Size" ? size : `Size ${size}`) : null].filter(Boolean).join(" · ");
}

export function assessLine(line: RawCartLine, maxPerItem: number): CartLine {
  const unitPrice = line.salePrice ?? line.price;
  const base = {
    itemId: line.itemId,
    variantId: line.variantId,
    productId: line.productId,
    slug: line.slug,
    name: line.name,
    imageUrl: line.imageUrl,
    imageAlt: line.imageAlt,
    sku: line.sku,
    size: line.size,
    color: line.color,
    price: line.price,
    salePrice: line.salePrice,
    quantity: line.quantity,
    allowBackorder: line.allowBackorder,
    weightGrams: line.weightGrams,
    unitPrice,
    compareAtPrice: line.salePrice != null ? line.price : null,
    lineTotal: unitPrice * line.quantity,
    translations: line.translations,
  };

  if (line.productStatus !== "published" || !line.variantActive) {
    return { ...base, purchasable: false, maxQuantity: 0, stockLeft: 0, warning: "This item is no longer available. Please remove it.", warningCode: "unavailable" as const };
  }
  if (line.allowBackorder) {
    const warning = line.onHand < line.quantity ? "Available on backorder — dispatch may take longer." : null;
    return { ...base, purchasable: true, maxQuantity: maxPerItem, stockLeft: null, warning, warningCode: warning ? ("backorder" as const) : null };
  }
  if (line.onHand <= 0) {
    return { ...base, purchasable: false, maxQuantity: 0, stockLeft: 0, warning: "Sold out. Please remove this item to continue.", warningCode: "sold_out" as const };
  }
  const maxQuantity = Math.min(maxPerItem, line.onHand);
  if (line.quantity > line.onHand) {
    return {
      ...base,
      purchasable: false,
      maxQuantity,
      stockLeft: line.onHand,
      warning: `Only ${line.onHand} left in stock. Please reduce the quantity.`,
      warningCode: "reduce" as const,
    };
  }
  const warning = line.onHand <= 3 ? `Only ${line.onHand} left` : null;
  return { ...base, purchasable: true, maxQuantity, stockLeft: line.onHand, warning, warningCode: warning ? ("low_stock" as const) : null };
}

export function cartIsPurchasable(lines: CartLine[]): boolean {
  return lines.length > 0 && lines.every((l) => l.purchasable);
}

export function cartWeight(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.weightGrams * l.quantity, 0);
}
