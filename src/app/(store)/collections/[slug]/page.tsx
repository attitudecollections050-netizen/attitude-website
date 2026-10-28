import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/catalog/filters";
import { getCollection, getFacets } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c) return { title: (await getTranslations("pages"))("notFound") };
  return { title: c.name, description: c.description ?? undefined, alternates: { canonical: `/collections/${c.slug}` } };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const filters = parseFilters(await searchParams);
  const [c, facets, t, tc] = await Promise.all([getCollection(slug, filters), getFacets(null), getTranslations("pages"), getTranslations("common")]);
  if (!c) notFound();
  return (
    <>
      <CatalogHeader eyebrow={t("collection")} title={c.name} description={c.description} breadcrumbs={[{ label: tc("home"), href: "/" }, { label: t("collections"), href: "/collections" }, { label: c.name }]} />
      <CatalogView filters={filters} result={c.result} facets={facets} basePath={`/collections/${c.slug}`} />
    </>
  );
}
