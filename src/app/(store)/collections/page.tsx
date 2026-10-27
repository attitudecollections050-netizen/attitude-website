import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { getCategoryTree } from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/CatalogView";
import { CollectionCards } from "@/components/home/CollectionCards";
import { CategoryCards } from "@/components/home/CategoryCards";
import { SectionHeading } from "@/components/home/SectionHeading";

export const metadata: Metadata = { title: "Collections", description: "Curated Attitude Collections edits.", alternates: { canonical: "/collections" } };

export default async function CollectionsIndex() {
  const collections = isSupabaseConfigured()
    ? ((await createPublicClient().from("collections").select("id, slug, name, description, image_url, collection_products ( product_id )").eq("is_active", true).order("sort_order")).data ?? [])
    : [];
  const categories = await getCategoryTree();
  return (
    <>
      <CatalogHeader eyebrow="Curated" title="Collections" description="Edits built around a mood, a moment and an attitude." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Collections" }]} />
      <div className="container-luxe py-16">
        {collections.length > 0 ? (
          <CollectionCards collections={collections.map((c) => ({ ...c, count: c.collection_products?.length ?? 0 }))} />
        ) : (
          <p className="text-sm text-muted">New collections are coming soon. In the meantime, explore by category below.</p>
        )}
      </div>
      {categories.length > 0 && (
        <section className="container-luxe pb-24">
          <SectionHeading eyebrow="Shop by category" title="Every category" href="/shop" linkLabel="Shop all" />
          <div className="mt-10">
            <CategoryCards categories={categories} />
          </div>
        </section>
      )}
    </>
  );
}
