"use client";
import Link from "next/link";
import { m } from "motion/react";
import { CloseIcon } from "@/components/brand/StoreIcons";
import type { CartLine } from "@/lib/cart/assess";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { useCartText } from "@/components/intl/useCartText";
import { cn } from "@/lib/cn";
import { SmartImage } from "@/components/ui/SmartImage";
import { QuantityStepper } from "./QuantityStepper";
import { useCart } from "./CartProvider";

export function CartLineItem({ line, compact = false }: { line: CartLine; compact?: boolean }) {
  const { update, remove, pending } = useCart();
  const t = useTranslations("cart");
  const { format: formatMoney } = useMoney();
  const text = useCartText();
  const name = text.name(line);
  return (
    <m.li
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      className="flex gap-4 py-5"
    >
      <Link href={`/products/${line.slug}`} className={cn("relative shrink-0 overflow-hidden rounded-[1.2rem_0.4rem_1.2rem_0.4rem] bg-neutral", compact ? "h-28 w-21" : "h-36 w-27")}>
        <SmartImage src={line.imageUrl} alt={line.imageAlt || name} fill sizes="120px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/products/${line.slug}`} className="link-underline font-display text-lg leading-tight">
              {name}
            </Link>
            <p className="mt-1 text-xs text-muted">{text.variant(line.size, line.color)}</p>
          </div>
          <button
            type="button"
            onClick={() => remove(line.itemId)}
            disabled={pending}
            className="-m-1 grid size-8 place-items-center rounded-[0.8rem_0.3rem] text-muted transition hover:rotate-90 hover:bg-blush hover:text-rose-deep"
            aria-label={t("removeItem", { name })}
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            max={Math.max(line.maxQuantity, 1)}
            disabled={pending || line.maxQuantity === 0}
            onChange={(q) => update(line.itemId, q)}
          />
          <div className="text-right text-sm tabular-nums">
            {line.compareAtPrice && <s className="mr-2 text-xs text-muted">{formatMoney(line.compareAtPrice * line.quantity)}</s>}
            <span className="font-semibold">{formatMoney(line.lineTotal)}</span>
          </div>
        </div>
        {line.warning && (
          <p className={cn("mt-2 text-xs", line.purchasable ? "text-warning" : "text-danger font-semibold")} role={line.purchasable ? undefined : "alert"}>
            {text.warning(line)}
          </p>
        )}
      </div>
    </m.li>
  );
}
