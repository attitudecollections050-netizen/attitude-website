"use client";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { BagIcon } from "@/components/brand/StoreIcons";
import { useCart } from "./CartProvider";
import { CartLineItem } from "./CartLineItem";
import { DiscountForm } from "./DiscountForm";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { useDiscountLabel } from "@/components/intl/useDiscountLabel";
import { CurrencyNotice } from "@/components/intl/CurrencyNotice";
import { buttonClasses } from "@/components/ui/Button";

export function CartPageView() {
  const { cart } = useCart();
  const t = useTranslations("cart");
  const { format: formatMoney, isEstimate } = useMoney();
  const discountLabel = useDiscountLabel();
  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-blush text-rose">
          <BagIcon className="size-6" />
        </span>
        <p className="display text-4xl">{t("empty")}</p>
        <p className="text-sm text-muted">{t("emptyPage")}</p>
        <Link href="/shop" className={buttonClasses("primary")}>
          {t("continueShopping")}
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
      <section aria-label={t("items")}>
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {cart.lines.map((l) => (
              <CartLineItem key={l.itemId} line={l} />
            ))}
          </AnimatePresence>
        </ul>
        <Link href="/shop" className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.2em] underline underline-offset-4 hover:text-rose-deep">
          {t("continueShopping")}
        </Link>
      </section>
      <aside className="h-fit rounded-[1.75rem] bg-neutral p-6 lg:sticky lg:top-28" aria-label={t("summaryLabel")}>
        <h2 className="font-display text-2xl">{t("summary")}</h2>
        <div className="mt-5">
          <DiscountForm />
        </div>
        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt>{t("subtotalItems", { count: cart.itemCount })}</dt>
            <dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd>
          </div>
          {cart.discount && (
            <div className="flex justify-between text-rose-deep">
              <dt>{discountLabel(cart.discount, false)}</dt>
              <dd className="tabular-nums">{cart.discount.amount > 0 ? `−${formatMoney(cart.discount.amount)}` : t("freeDelivery")}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>{t("delivery")}</dt>
            <dd>{cart.discount?.freeShipping ? <span className="font-semibold text-rose-deep">{t("free")}</span> : t("atCheckout")}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
            <dt>{t("estimatedTotal")}</dt>
            <dd className="tabular-nums">{isEstimate ? "≈ " : ""}{formatMoney(cart.totalBeforeShipping)}</dd>
          </div>
        </dl>
        <CurrencyNotice className="mt-3" />
        {!cart.purchasable && <p className="mt-4 text-xs font-semibold text-danger">{t("needsAttention")}</p>}
        <Link
          href="/checkout"
          aria-disabled={!cart.purchasable}
          className={buttonClasses("primary", "lg", `mt-6 w-full ${!cart.purchasable ? "pointer-events-none opacity-50" : ""}`)}
        >
          {t("proceed")}
        </Link>
      </aside>
    </div>
  );
}
