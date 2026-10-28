export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  image_alt: string | null;
  hover_image_url: string | null;
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  in_stock: boolean;
  units_sold: number;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  children: CategoryNode[];
  href: string;
  /** Shorter label for the main navigation (e.g. "Men's" for "Men's Clothing"). */
  shortName?: string;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  details: string | null;
  price: number;
  sale_price: number | null;
  weight_grams: number;
  allow_backorder: boolean;
  is_featured: boolean;
  tags: string[];
  published_at: string | null;
  category: { id: string; slug: string; name: string; parent: { id: string; slug: string; name: string } | null };
  images: { id: string; url: string; alt: string; color: string | null }[];
  variants: {
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    color_hex: string | null;
    on_hand: number;
    sort_order: number;
  }[];
}
