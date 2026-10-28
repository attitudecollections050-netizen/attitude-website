import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { parseFilters } from "@/lib/catalog/filters";
import { getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";
import { SearchBox } from "@/components/catalog/SearchBox";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.slice(0, 60) : "";
  const t = await getTranslations("pages");
  return { title: term ? t("searchFor", { term }) : t("search"), robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const filters = parseFilters(await searchParams);
  const [result, facets] = await Promise.all([
    filters.q ? searchCatalog(filters) : Promise.resolve({ products: [], total: 0, page: 1, pageCount: 0 }),
    getFacets(null),
  ]);
  const [t, tc] = await Promise.all([getTranslations("pages"), getTranslations("common")]);
  return (
    <>
      <CatalogHeader
        eyebrow={t("search")}
        title={filters.q ? `“${filters.q}”` : t("searchTitle")}
        breadcrumbs={[{ label: tc("home"), href: "/" }, { label: t("search") }]}
      />
      <div className="container-luxe pt-8">
        <SearchBox initial={filters.q} />
      </div>
      {filters.q ? (
        <CatalogView filters={filters} result={result} facets={facets} basePath={`/search`} />
      ) : (
        <p className="container-luxe py-16 text-sm text-muted">{t("searchHint")}</p>
      )}
    </>
  );
}
