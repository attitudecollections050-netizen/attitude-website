import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { PAGE_SIZE, sortSizes, type CatalogFilters } from "./filters";
import type { CategoryNode, ProductCardData, ProductDetail } from "./types";

export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, slug, name, description, image_url, parent_id, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("[catalog] categories:", error.message);
    return [];
  }
  const rows = data ?? [];
  const top = rows.filter((c) => !c.parent_id);
  return top.map((t) => ({
    ...t,
    href: `/shop/${t.slug}`,
    children: rows
      .filter((c) => c.parent_id === t.id)
      .map((c) => ({ ...c, href: `/shop/${t.slug}/${c.slug}`, children: [] })),
  }));
});

export async function findCategory(topSlug: string, subSlug?: string) {
  const tree = await getCategoryTree();
  const top = tree.find((c) => c.slug === topSlug) ?? null;
  if (!top) return { top: null, sub: null };
  if (!subSlug) return { top, sub: null };
  return { top, sub: top.children.find((c) => c.slug === subSlug) ?? null };
}

export interface CatalogResult {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
}

export async function searchCatalog(
  filters: CatalogFilters,
  opts: { categoryId?: string | null; featured?: boolean; collectionId?: string | null; limit?: number } = {},
): Promise<CatalogResult> {
  if (!isSupabaseConfigured()) return { products: [], total: 0, page: 1, pageCount: 0 };
  const limit = opts.limit ?? PAGE_SIZE;
  const { data, error } = await createPublicClient().rpc("catalog_search", {
    p_query: filters.q || null,
    p_category_id: opts.categoryId ?? null,
    p_sizes: filters.sizes.length ? filters.sizes : null,
    p_colors: filters.colors.length ? filters.colors : null,
    p_min_price: filters.minPrice,
    p_max_price: filters.maxPrice,
    p_availability: filters.availability,
    p_on_sale: filters.onSale,
    p_featured: opts.featured ?? false,
    p_sort: filters.sort,
    p_limit: limit,
    p_offset: (filters.page - 1) * limit,
    p_collection_id: opts.collectionId ?? null,
  });
  if (error) throw new Error(`Catalogue search failed: ${error.message}`);
  const rows = (data ?? []) as (ProductCardData & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;
  return {
    products: rows.map((r) => ({ ...r, sizes: sortSizes(r.sizes ?? []), units_sold: Number(r.units_sold ?? 0) })),
    total: Number(total),
    page: filters.page,
    pageCount: Math.ceil(Number(total) / limit),
  };
}

export async function getFacets(categoryId: string | null) {
  const empty = { sizes: [] as string[], colors: [] as { name: string; hex: string | null }[], min_price: null as number | null, max_price: null as number | null, has_sales: false };
  if (!isSupabaseConfigured()) return empty;
  const { data, error } = await createPublicClient().rpc("catalog_facets", { p_category_id: categoryId });
  if (error || !data) return empty;
  const facets = data as typeof empty;
  return { ...facets, sizes: sortSizes(facets.sizes ?? []) };
}

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  const { data, error } = await createPublicClient()
    .from("products")
    .select(
      `id, slug, name, description, details, price, sale_price, weight_grams, allow_backorder, is_featured, tags, published_at,
       category:categories!inner ( id, slug, name, parent:parent_id ( id, slug, name ) ),
       product_images ( id, url, alt, color, sort_order ),
       product_variants ( id, sku, size, color, color_hex, is_active, sort_order, inventory ( on_hand ) )`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("[catalog] product:", error.message);
    return null;
  }
  if (!data) return null;
  type V = { id: string; sku: string; size: string | null; color: string | null; color_hex: string | null; is_active: boolean; sort_order: number; inventory: { on_hand: number } | { on_hand: number }[] | null };
  const variants = ((data.product_variants ?? []) as V[])
    .filter((v) => v.is_active)
    .map((v) => ({
      id: v.id, sku: v.sku, size: v.size, color: v.color, color_hex: v.color_hex, sort_order: v.sort_order,
      on_hand: (Array.isArray(v.inventory) ? v.inventory[0]?.on_hand : v.inventory?.on_hand) ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
  const images = [...(data.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return { ...(data as unknown as ProductDetail), images, variants };
});

export async function getRelatedProducts(product: ProductDetail, limit = 4): Promise<ProductCardData[]> {
  const res = await searchCatalog(
    { q: "", sizes: [], colors: [], minPrice: null, maxPrice: null, availability: null, onSale: false, sort: "newest", page: 1 },
    { categoryId: product.category.parent?.id ?? product.category.id, limit: limit + 1 },
  );
  return res.products.filter((p) => p.id !== product.id).slice(0, limit);
}

export const BASE_FILTERS: CatalogFilters = {
  q: "", sizes: [], colors: [], minPrice: null, maxPrice: null, availability: null, onSale: false, sort: "newest", page: 1,
};

export interface HomeBanner {
  id: string;
  placement: "hero" | "promo" | "strip";
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
}

export async function getHomeData() {
  if (!isSupabaseConfigured()) {
    return { banners: [] as HomeBanner[], collections: [], newArrivals: [], featured: [], bestSellers: [] };
  }
  const db = createPublicClient();
  const nowIso = new Date().toISOString();
  const [bannersRes, collectionsRes, newArrivals, featured, popular] = await Promise.all([
    db
      .from("home_banners")
      .select("id, placement, eyebrow, title, subtitle, cta_label, cta_href, image_url, starts_at, ends_at")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("sort_order"),
    db
      .from("collections")
      .select("id, slug, name, description, image_url, collection_products ( product_id )")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("sort_order")
      .limit(4),
    searchCatalog(BASE_FILTERS, { limit: 8 }).catch(() => null),
    searchCatalog(BASE_FILTERS, { featured: true, limit: 8 }).catch(() => null),
    searchCatalog({ ...BASE_FILTERS, sort: "popular" }, { limit: 8 }).catch(() => null),
  ]);
  return {
    banners: (bannersRes.data ?? []) as HomeBanner[],
    collections: (collectionsRes.data ?? []).map((c) => ({ ...c, count: c.collection_products?.length ?? 0 })),
    newArrivals: newArrivals?.products ?? [],
    featured: featured?.products ?? [],
    // Only products with genuine paid sales qualify as best sellers.
    bestSellers: (popular?.products ?? []).filter((p) => p.units_sold > 0),
  };
}

export async function getCollection(slug: string, filters: CatalogFilters = BASE_FILTERS) {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data } = await createPublicClient()
    .from("collections")
    .select("id, slug, name, description, image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const result = await searchCatalog(filters, { collectionId: data.id });
  return { ...data, result };
}

export async function getContentPage(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createPublicClient()
    .from("content_pages")
    .select("slug, title, summary, body, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}
