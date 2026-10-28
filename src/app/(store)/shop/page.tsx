import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { parseFilters } from "@/lib/catalog/filters";
import { getCategoryTree, getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("shopTitle"), description: t("shopMeta"), alternates: { canonical: "/shop" } };
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const filters = parseFilters(await searchParams);
  const [result, facets, tree, t, tc] = await Promise.all([searchCatalog(filters), getFacets(null), getCategoryTree(), getTranslations("pages"), getTranslations("common")]);
  return (
    <>
      <CatalogHeader eyebrow={t("shopEyebrow")} title={t("shopTitle")} description={t("shopBody")} breadcrumbs={[{ label: tc("home"), href: "/" }, { label: t("shop") }]} />
      {!isSupabaseConfigured() && (
        <div className="container-luxe pt-8">
          <SetupNotice what="The catalogue" />
        </div>
      )}
      <CatalogView filters={filters} result={result} facets={facets} basePath="/shop" chips={tree} />
    </>
  );
}
