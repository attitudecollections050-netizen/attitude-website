import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/catalog/filters";
import { findCategory, getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/shop/[category]/[subcategory]">): Promise<Metadata> {
  const { category, subcategory } = await params;
  const { top, sub } = await findCategory(category, subcategory);
  if (!top || !sub) return { title: "Not found" };
  return {
    title: `${sub.name} — ${top.name}`,
    description: sub.description ?? `Shop ${sub.name.toLowerCase()} in ${top.name} at Attitude Collections.`,
    alternates: { canonical: sub.href },
  };
}

export default async function SubcategoryPage({ params, searchParams }: PageProps<"/shop/[category]/[subcategory]">) {
  const { category, subcategory } = await params;
  const { top, sub } = await findCategory(category, subcategory);
  if (!top || !sub) notFound();
  const filters = parseFilters(await searchParams);
  const [result, facets] = await Promise.all([searchCatalog(filters, { categoryId: sub.id }), getFacets(sub.id)]);
  return (
    <>
      <CatalogHeader
        eyebrow={top.name}
        title={sub.name}
        description={sub.description}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: top.name, href: top.href }, { label: sub.name }]}
      />
      <CatalogView filters={filters} result={result} facets={facets} basePath={sub.href} chips={top.children} activeChip={sub.slug} />
    </>
  );
}
