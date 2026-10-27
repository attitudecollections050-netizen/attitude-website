"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { SORT_OPTIONS, type CatalogFilters } from "@/lib/catalog/filters";
import { cn } from "@/lib/cn";
import { useDialog } from "@/components/ui/useDialog";

export interface Facets {
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  min_price: number | null;
  max_price: number | null;
  has_sales: boolean;
}

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const setParams = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    p.delete("page");
    const qs = p.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const toggleList = (key: string, value: string) =>
    setParams((p) => {
      const cur = (p.get(key) ?? "").split(",").filter(Boolean);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });
  return { params, pending, setParams, toggleList };
}

export function SortSelect({ value, hasSales }: { value: string; hasSales: boolean }) {
  const { setParams, pending } = useFilterNav();
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="eyebrow text-muted">Sort</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => setParams((p) => (e.target.value === "newest" ? p.delete("sort") : p.set("sort", e.target.value)))}
          className="appearance-none border-b border-plum/30 bg-transparent py-1.5 pr-6 text-sm font-semibold outline-none focus:border-plum"
          aria-busy={pending}
        >
          {SORT_OPTIONS.filter((o) => o.value !== "popular" || hasSales || value === "popular").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2" />
      </span>
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-5">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="eyebrow">{title}</span>
        <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterControls({ filters, facets }: { filters: CatalogFilters; facets: Facets }) {
  const { setParams, toggleList, params } = useFilterNav();
  const [min, setMin] = useState(filters.minPrice != null ? String(filters.minPrice / 100) : "");
  const [max, setMax] = useState(filters.maxPrice != null ? String(filters.maxPrice / 100) : "");

  return (
    <div>
      <Section title="Availability">
        <div className="flex flex-col gap-2.5 text-sm">
          {[
            { v: "in_stock", l: "In stock" },
            { v: "out_of_stock", l: "Sold out" },
          ].map((o) => (
            <label key={o.v} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-[#d94f91]"
                checked={filters.availability === o.v}
                onChange={() => setParams((p) => (filters.availability === o.v ? p.delete("availability") : p.set("availability", o.v)))}
              />
              {o.l}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="size-4 accent-[#d94f91]" checked={filters.onSale} onChange={() => setParams((p) => (filters.onSale ? p.delete("sale") : p.set("sale", "1")))} />
            On sale
          </label>
        </div>
      </Section>
      {facets.sizes.length > 0 && (
        <Section title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => {
              const on = filters.sizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleList("size", s)}
                  aria-pressed={on}
                  className={cn("min-w-11 border px-3 py-2 text-xs font-semibold transition", on ? "border-plum bg-plum text-white" : "border-line hover:border-plum")}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Section>
      )}
      {facets.colors.length > 0 && (
        <Section title="Colour">
          <div className="grid grid-cols-2 gap-2.5">
            {facets.colors.map((c) => {
              const on = filters.colors.includes(c.name.toLowerCase());
              return (
                <button key={c.name} type="button" onClick={() => toggleList("color", c.name.toLowerCase())} aria-pressed={on} className="flex items-center gap-2.5 text-left text-sm">
                  <span className={cn("grid size-6 place-items-center rounded-full border-2 transition", on ? "border-plum" : "border-transparent")}>
                    <span className="size-4.5 rounded-full border border-plum/15" style={{ backgroundColor: c.hex ?? "#ccc" }} />
                  </span>
                  <span className={on ? "font-semibold" : ""}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}
      <Section title="Price (₦)">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams((p) => {
              const clean = (v: string) => v.replace(/[^\d]/g, "");
              if (clean(min)) p.set("min", clean(min)); else p.delete("min");
              if (clean(max)) p.set("max", clean(max)); else p.delete("max");
            });
          }}
        >
          <label className="flex-1 text-xs text-muted">
            Min
            <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={facets.min_price ? String(Math.floor(facets.min_price / 100)) : "0"} className="field mt-1 !py-2" />
          </label>
          <label className="flex-1 text-xs text-muted">
            Max
            <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={facets.max_price ? String(Math.ceil(facets.max_price / 100)) : ""} className="field mt-1 !py-2" />
          </label>
          <button type="submit" className="h-[2.4rem] bg-plum px-3 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white hover:bg-rose-deep">
            Go
          </button>
        </form>
      </Section>
      {params.toString() && (
        <button
          type="button"
          className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-deep underline underline-offset-4"
          onClick={() => setParams((p) => ["size", "color", "min", "max", "availability", "sale"].forEach((k) => p.delete(k)))}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

export function FilterSidebar({ filters, facets }: { filters: CatalogFilters; facets: Facets }) {
  return (
    <aside className="hidden lg:block" aria-label="Filters">
      <FilterControls filters={filters} facets={facets} />
    </aside>
  );
}

export function MobileFilterButton({ filters, facets, activeCount }: { filters: CatalogFilters; facets: Facets; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, () => setOpen(false), ref);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 border border-line px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] lg:hidden" aria-expanded={open}>
        <SlidersHorizontal className="size-3.5" /> Filter {activeCount > 0 && <span className="rounded-full bg-rose-deep px-1.5 text-[0.6rem] text-white">{activeCount}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <m.div className="absolute inset-0 bg-plum/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <m.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              tabIndex={-1}
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-5 pb-8 pt-4 outline-none"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="flex items-center justify-between">
                <p className="font-display text-2xl">Filter</p>
                <button type="button" onClick={() => setOpen(false)} className="p-2" aria-label="Close filters">
                  <X className="size-5" />
                </button>
              </div>
              <FilterControls filters={filters} facets={facets} />
              <button type="button" onClick={() => setOpen(false)} className="mt-6 h-12 w-full bg-plum text-xs font-bold uppercase tracking-[0.2em] text-white">
                Show results
              </button>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
