// Pure parsing of catalogue URL search params.
export type SortKey = "newest" | "price_asc" | "price_desc" | "popular";
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "popular", label: "Best selling" },
];

export interface CatalogFilters {
  q: string;
  sizes: string[];
  colors: string[];
  minPrice: number | null; // minor units
  maxPrice: number | null;
  availability: "in_stock" | "out_of_stock" | null;
  onSale: boolean;
  sort: SortKey;
  page: number;
}

export const PAGE_SIZE = 12;

type Params = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v : v ? v.split(",") : [];
  return [...new Set(raw.map((s) => s.trim()).filter((s) => s && s.length <= 40))].slice(0, 20);
}

function money(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{1,9}$/.test(s)) return null;
  return Number(s) * 100;
}

export function parseFilters(params: Params): CatalogFilters {
  const sortRaw = (Array.isArray(params.sort) ? params.sort[0] : params.sort) as SortKey | undefined;
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === sortRaw) ? sortRaw! : "newest";
  const avail = Array.isArray(params.availability) ? params.availability[0] : params.availability;
  const pageRaw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  let minPrice = money(params.min);
  let maxPrice = money(params.max);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  return {
    q: q.trim().slice(0, 100),
    sizes: list(params.size),
    colors: list(params.color).map((c) => c.toLowerCase()),
    minPrice,
    maxPrice,
    availability: avail === "in_stock" || avail === "out_of_stock" ? avail : null,
    onSale: (Array.isArray(params.sale) ? params.sale[0] : params.sale) === "1",
    sort,
    page: Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw < 1000 ? pageRaw : 1,
  };
}

export function filtersToSearchParams(f: Partial<CatalogFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.sizes?.length) p.set("size", f.sizes.join(","));
  if (f.colors?.length) p.set("color", f.colors.join(","));
  if (f.minPrice != null) p.set("min", String(Math.round(f.minPrice / 100)));
  if (f.maxPrice != null) p.set("max", String(Math.round(f.maxPrice / 100)));
  if (f.availability) p.set("availability", f.availability);
  if (f.onSale) p.set("sale", "1");
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

const CLOTHING_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "ONE SIZE"];
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = CLOTHING_ORDER.indexOf(a.toUpperCase());
    const ib = CLOTHING_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}
