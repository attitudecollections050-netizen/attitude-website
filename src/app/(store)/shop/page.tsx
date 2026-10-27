import type { Metadata } from "next";
import { parseFilters } from "@/lib/catalog/filters";
import { getCategoryTree, getFacets, searchCatalog } from "@/lib/catalog/queries";
import { CatalogHeader, CatalogView } from "@/components/catalog/CatalogView";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Shop all Attitude Collections clothing, shoes, sneakers and bags.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const filters = parseFilters(await searchParams);
  const [result, facets, tree] = await Promise.all([searchCatalog(filters), getFacets(null), getCategoryTree()]);
  return (
    <>
      <CatalogHeader eyebrow="The collection" title="Shop all" description="Every piece, every category — styled with attitude." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      {!isSupabaseConfigured() && (
        <div className="container-luxe pt-8">
          <SetupNotice what="The catalogue" />
        </div>
      )}
      <CatalogView filters={filters} result={result} facets={facets} basePath="/shop" chips={tree} />
    </>
  );
}
