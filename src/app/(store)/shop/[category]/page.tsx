import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/catalog/filters";
import { findCategory, getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const { top } = await findCategory(category);
  const t = await getTranslations("pages");
  if (!top) return { title: t("notFound") };
  return {
    title: top.name,
    description: top.description ?? t("shopCategoryMeta", { name: top.name }),
    alternates: { canonical: top.href },
    openGraph: { title: `${top.name} | Attitude Collections`, images: top.image_url ? [top.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  const { top } = await findCategory(category);
  if (!top) notFound();
  const filters = parseFilters(await searchParams);
  const [result, facets, t, tc] = await Promise.all([searchCatalog(filters, { categoryId: top.id }), getFacets(top.id), getTranslations("pages"), getTranslations("common")]);
  return (
    <>
      <CatalogHeader eyebrow={t("shop")} title={top.name} description={top.description} breadcrumbs={[{ label: tc("home"), href: "/" }, { label: t("shop"), href: "/shop" }, { label: top.name }]} />
      <CatalogView filters={filters} result={result} facets={facets} basePath={top.href} chips={top.children} />
    </>
  );
}
