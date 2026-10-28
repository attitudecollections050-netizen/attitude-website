import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";
import type { CatalogFilters } from "@/lib/catalog/filters";
import { filtersToSearchParams } from "@/lib/catalog/filters";
import type { CatalogResult } from "@/lib/catalog/queries";
import type { CategoryNode } from "@/lib/catalog/types";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, MobileFilterButton, SortSelect, type Facets } from "./FilterPanel";
import { Pagination } from "./Pagination";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function CatalogHeader({ eyebrow, title, description, breadcrumbs }: { eyebrow?: string; title: string; description?: string | null; breadcrumbs: { label: string; href?: string }[] }) {
  return (
    <div className="bg-blush">
      <div className="container-luxe py-10 sm:py-14">
        <Breadcrumbs items={breadcrumbs} />
        {eyebrow && <p className="eyebrow mt-8 text-rose-deep">{eyebrow}</p>}
        <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">{title}</h1>
        {description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-plum-soft sm:text-base">{description}</p>}
      </div>
    </div>
  );
}

export function CatalogView({
  filters,
  result,
  facets,
  basePath,
  chips,
  activeChip,
}: {
  filters: CatalogFilters;
  result: CatalogResult;
  facets: Facets;
  basePath: string;
  chips?: CategoryNode[];
  activeChip?: string | null;
}) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const params = filtersToSearchParams({ ...filters, page: 1 });
  const activeCount = filters.sizes.length + filters.colors.length + (filters.minPrice != null || filters.maxPrice != null ? 1 : 0) + (filters.availability ? 1 : 0) + (filters.onSale ? 1 : 0);

  return (
    <div className="container-luxe pb-24 pt-8">
      {chips && chips.length > 0 && (
        <nav aria-label={t("subcategories")} className="-mx-4 mb-8 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {chips.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className={cn(
                    "block whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition",
                    activeChip === c.slug ? "border-plum bg-plum text-white" : "border-line hover:border-plum",
                  )}
                  aria-current={activeChip === c.slug ? "page" : undefined}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="grid gap-10 lg:grid-cols-[15rem_1fr] xl:gap-14">
        <Suspense>
          <FilterSidebar filters={filters} facets={facets} />
        </Suspense>
        <div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-sm text-muted" aria-live="polite">
              {tc("pieces", { count: result.total })}
            </p>
            <div className="flex items-center gap-4">
              <Suspense>
                <MobileFilterButton filters={filters} facets={facets} activeCount={activeCount} />
                <SortSelect value={filters.sort} hasSales={facets.has_sales} />
              </Suspense>
            </div>
          </div>
          {result.products.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="font-display text-3xl">{t("emptyTitle")}</p>
              <p className="max-w-sm text-sm text-muted">{t("emptyBody")}</p>
              <Link href={basePath} className={buttonClasses("outline")}>
                {t("clearFilters")}
              </Link>
            </div>
          ) : (
            <ProductGrid products={result.products} columns={3} />
          )}
          <Pagination page={result.page} pageCount={result.pageCount} basePath={basePath} params={params} />
        </div>
      </div>
    </div>
  );
}
