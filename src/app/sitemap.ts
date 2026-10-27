import type { MetadataRoute } from "next";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const staticPaths = ["", "/shop", "/collections", "/about", "/contact", "/faq", "/shipping-policy", "/returns-policy", "/privacy-policy", "/terms", "/track-order"];
  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6 }));
  if (!isSupabaseConfigured()) return entries;
  const db = createPublicClient();
  const [cats, products, collections] = await Promise.all([
    db.from("categories").select("slug, parent_id, updated_at").eq("is_active", true),
    db.from("products").select("slug, updated_at").eq("status", "published").limit(5000),
    db.from("collections").select("slug").eq("is_active", true),
  ]);
  const catRows = cats.data ?? [];
  const parentSlug = new Map<string, string>();
  const tops = catRows.filter((c) => !c.parent_id);
  const { data: withIds } = await db.from("categories").select("id, slug").is("parent_id", null);
  (withIds ?? []).forEach((c) => parentSlug.set(c.id, c.slug));
  for (const c of tops) entries.push({ url: `${base}/shop/${c.slug}`, lastModified: c.updated_at, priority: 0.8 });
  for (const c of catRows.filter((x) => x.parent_id)) {
    const p = parentSlug.get(c.parent_id!);
    if (p) entries.push({ url: `${base}/shop/${p}/${c.slug}`, lastModified: c.updated_at, priority: 0.7 });
  }
  for (const p of products.data ?? []) entries.push({ url: `${base}/products/${p.slug}`, lastModified: p.updated_at, priority: 0.7 });
  for (const c of collections.data ?? []) entries.push({ url: `${base}/collections/${c.slug}`, priority: 0.6 });
  return entries;
}
