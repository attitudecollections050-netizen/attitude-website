import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { getCategoryTree, localizeCollections } from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/CatalogView";
import { CollectionCards } from "@/components/home/CollectionCards";
import { CategoryCards } from "@/components/home/CategoryCards";
import { SectionHeading } from "@/components/home/SectionHeading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("collections"), description: t("collectionsMeta"), alternates: { canonical: "/collections" } };
}

export default async function CollectionsIndex() {
  const collections = isSupabaseConfigured()
    ? ((await createPublicClient().from("collections").select("id, slug, name, description, image_url, translations, collection_products ( product_id )").eq("is_active", true).order("sort_order")).data ?? [])
    : [];
  const [categories, t, tc] = await Promise.all([getCategoryTree(), getTranslations("pages"), getTranslations("common")]);
  return (
    <>
      <CatalogHeader eyebrow={t("curated")} title={t("collections")} description={t("collectionsBody")} breadcrumbs={[{ label: tc("home"), href: "/" }, { label: t("collections") }]} />
      <div className="container-luxe py-16">
        {collections.length > 0 ? (
          <CollectionCards collections={(await localizeCollections(collections)).map((c) => ({ ...c, count: c.collection_products?.length ?? 0 }))} />
        ) : (
          <p className="text-sm text-muted">{t("collectionsSoon")}</p>
        )}
      </div>
      {categories.length > 0 && (
        <section className="container-luxe pb-24">
          <SectionHeading eyebrow={t("byCategory")} title={t("everyCategory")} href="/shop" linkLabel={tc("shopAll")} />
          <div className="mt-10">
            <CategoryCards categories={categories} />
          </div>
        </section>
      )}
    </>
  );
}
