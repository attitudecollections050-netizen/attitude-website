import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/catalog/filters";
import { findCategory, getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const { top } = await findCategory(category);
  if (!top) return { title: "Not found" };
  return {
    title: top.name,
    description: top.description ?? `Shop ${top.name} at Attitude Collections.`,
    alternates: { canonical: top.href },
    openGraph: { title: `${top.name} | Attitude Collections`, images: top.image_url ? [top.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  const { top } = await findCategory(category);
  if (!top) notFound();
  const filters = parseFilters(await searchParams);
  const [result, facets] = await Promise.all([searchCatalog(filters, { categoryId: top.id }), getFacets(top.id)]);
  return (
    <>
      <CatalogHeader eyebrow="Shop" title={top.name} description={top.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: top.name }]} />
      <CatalogView filters={filters} result={result} facets={facets} basePath={top.href} chips={top.children} />
    </>
  );
}
