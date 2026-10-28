"use client";
import { useTranslations } from "next-intl";
import { useColorName } from "@/components/intl/useColorName";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Plus } from "lucide-react";
import type { ProductCardData } from "@/lib/catalog/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/cn";
import { QuickAdd } from "./QuickAdd";

export function ProductCard({ product, priority = false, sizes = "(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw" }: { product: ProductCardData; priority?: boolean; sizes?: string }) {
  const t = useTranslations("product");
  const colorName = useColorName();
  const [quickOpen, setQuickOpen] = useState(false);
  const onSale = product.sale_price != null;
  const href = `/products/${product.slug}`;

  return (
    <article className="group relative" onMouseLeave={() => setQuickOpen(false)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-neutral">
        <Link href={href} className="absolute inset-0" aria-label={product.name} tabIndex={-1}>
          <SmartImage
            src={product.image_url}
            alt={product.image_alt || product.name}
            fill
            sizes={sizes}
            preload={priority}
            className={cn(
              "object-cover transition-[transform,opacity] duration-[900ms] ease-[var(--ease-luxe)] group-hover:scale-[1.04]",
              product.hover_image_url && "group-hover:opacity-0",
            )}
            fallbackLabel={product.name}
          />
          {product.hover_image_url && (
            <SmartImage
              src={product.hover_image_url}
              alt=""
              fill
              sizes={sizes}
              className="scale-[1.04] object-cover opacity-0 transition-[transform,opacity] duration-[900ms] ease-[var(--ease-luxe)] group-hover:scale-100 group-hover:opacity-100"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {onSale && <span className="rounded-full bg-rose-deep px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white">{t("sale")}</span>}
          {!product.in_stock && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-plum">{t("soldOut")}</span>}
        </div>

        {product.in_stock && (
          <>
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-white text-plum shadow-md transition duration-300 hover:bg-plum hover:text-white focus-visible:opacity-100 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
              aria-label={t("quickAddNamed", { name: product.name })}
              aria-expanded={quickOpen}
            >
              <Plus className={cn("size-4 transition-transform duration-300", quickOpen && "rotate-45")} />
            </button>
            <AnimatePresence>
              {quickOpen && (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
                  className="absolute inset-x-2 bottom-16 z-10"
                >
                  <QuickAdd slug={product.slug} onDone={() => setQuickOpen(false)} />
                </m.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="mt-3.5 flex flex-col gap-1">
        <h3 className="text-[0.92rem] leading-snug">
          <Link href={href} className="link-underline">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} salePrice={product.sale_price} />
        {product.colors.length > 0 && (
          <ul className="mt-1 flex items-center gap-1.5" aria-label={t("availableColours")}>
            {product.colors.slice(0, 5).map((c) => (
              <li key={c.name} title={colorName(c.name)}>
                <span className="block size-3 rounded-full border border-plum/15" style={{ backgroundColor: c.hex ?? "#ccc" }} />
                <span className="sr-only">{colorName(c.name)}</span>
              </li>
            ))}
            {product.colors.length > 5 && <li className="text-[0.7rem] text-muted">+{product.colors.length - 5}</li>}
          </ul>
        )}
        {!product.in_stock && <p className="text-xs text-muted">{t("unavailable")}</p>}
      </div>
    </article>
  );
}
