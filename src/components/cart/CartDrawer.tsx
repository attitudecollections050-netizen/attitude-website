"use client";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { useDiscountLabel } from "@/components/intl/useDiscountLabel";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, m, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { ArrowRight } from "lucide-react";
import { BagIcon, CloseIcon } from "@/components/brand/StoreIcons";
import { buttonClasses } from "@/components/ui/Button";
import { useCart } from "./CartProvider";
import { CartLineItem } from "./CartLineItem";
import { useDialog } from "@/components/ui/useDialog";
import { cn } from "@/lib/cn";

const WIDE = "(min-width: 640px)";
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** Where the header bag button is, so the pouch can open out of it. */
function useBagAnchor(open: boolean) {
  const [anchor, setAnchor] = useState({ top: 88, right: 16, originX: 0.9 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = document.querySelector<HTMLElement>("[data-bag-anchor]");
      const r = el?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      const width = Math.min(window.innerWidth - 32, 416);
      const right = Math.min(Math.max(16, window.innerWidth - r.right - 4), Math.max(16, window.innerWidth - width - 16));
      const left = window.innerWidth - right - width;
      setAnchor({ top: Math.max(16, r.bottom + 12), right, originX: Math.min(1, Math.max(0, (r.left + r.width / 2 - left) / width)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  return anchor;
}

export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("cart");
  const { format: formatMoney, isEstimate } = useMoney();
  const discountLabel = useDiscountLabel();
  const reduce = useReducedMotion();
  const wide = useWide();
  const anchor = useBagAnchor(open && wide);
  useDialog(open, () => setOpen(false), panelRef);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [setOpen]);

  const origin = `${Math.round(anchor.originX * 100)}% 0%`;
  // Desktop: the pouch blooms open from the bag icon. Phone: a curved sheet rises from the bottom.
  const motionProps: Pick<HTMLMotionProps<"div">, "initial" | "animate" | "exit" | "transition"> = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : wide
      ? {
          initial: { clipPath: `circle(0% at ${origin})`, y: -10, rotate: 1.5 },
          animate: { clipPath: `circle(160% at ${origin})`, y: 0, rotate: 0 },
          exit: { clipPath: `circle(0% at ${origin})`, y: -6, transition: { duration: 0.32, ease: [0.64, 0, 0.78, 0] as const } },
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {
          initial: { y: "100%", borderTopLeftRadius: "45%", borderTopRightRadius: "45%" },
          animate: { y: 0, borderTopLeftRadius: "2.5rem", borderTopRightRadius: "2.5rem" },
          exit: { y: "100%", transition: { duration: 0.3 } },
          transition: { type: "spring", stiffness: 260, damping: 30 },
        };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <m.div
            className="absolute inset-0 bg-plum/35 backdrop-blur-[3px] sm:bg-plum/15 sm:backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("bag")}
            tabIndex={-1}
            {...motionProps}
            style={wide ? { top: anchor.top, right: anchor.right, maxHeight: `calc(100dvh - ${anchor.top + 16}px)` } : undefined}
            className={cn(
              "absolute flex flex-col bg-white shadow-[0_40px_90px_-30px_rgba(37,25,35,0.55)] outline-none",
              "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[2.5rem]",
              "sm:inset-x-auto sm:bottom-auto sm:w-[26rem] sm:max-w-[calc(100vw-2rem)] sm:rounded-[2.2rem] sm:rounded-se-[0.7rem] sm:border sm:border-pale",
            )}
          >
            {/* Notch pointing at the bag (wide screens) / grab handle (phones) */}
            {wide ? (
              <span className="absolute -top-1.5 size-3.5 rotate-45 rounded-[3px] border-l border-t border-pale bg-white" style={{ left: `calc(${anchor.originX * 100}% - 0.45rem)` }} aria-hidden />
            ) : (
              <span className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-line" aria-hidden />
            )}

            <div className="flex items-center gap-3 px-6 pb-4 pt-5 sm:pt-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] bg-gradient-to-br from-blush to-pale text-rose-deep">
                <BagIcon className="size-[1.3rem]" />
              </span>
              <h2 className="flex-1 font-display text-2xl leading-none">
                {t("yourBag")}
                <span className="ms-2 inline-grid min-w-6 place-items-center rounded-full bg-plum px-1.5 py-0.5 align-middle font-sans text-[0.65rem] font-bold text-white">{cart.itemCount}</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="group grid size-10 place-items-center rounded-[1rem_0.4rem_1rem_0.4rem] text-plum transition-[border-radius,background-color,transform] duration-300 hover:rotate-90 hover:rounded-full hover:bg-blush hover:text-rose-deep"
                aria-label={t("closeBag")}
              >
                <CloseIcon className="size-[1.15rem]" />
              </button>
            </div>

            {cart.lines.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-8 pb-10 pt-4 text-center">
                <m.span
                  className="grid size-24 place-items-center rounded-[2.4rem_1rem_2.4rem_1rem] bg-gradient-to-br from-blush via-pale to-white text-rose"
                  animate={reduce ? undefined : { y: [0, -6, 0], rotate: [0, -3, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <BagIcon className="size-10" strokeWidth={1.3} />
                </m.span>
                <p className="font-display text-2xl">{t("empty")}</p>
                <p className="text-sm text-muted">{t("emptyDrawer")}</p>
                <Link href="/shop" onClick={() => setOpen(false)} className={buttonClasses("primary")}>
                  {t("startShopping")}
                </Link>
              </div>
            ) : (
              <>
                <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain px-6">
                  <AnimatePresence initial={false}>
                    {cart.lines.map((line) => (
                      <CartLineItem key={line.itemId} line={line} compact />
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="p-3 pt-0">
                  <div className="rounded-[1.8rem] rounded-se-[0.6rem] bg-gradient-to-br from-blush to-pale/70 px-5 py-5">
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt>{t("subtotal")}</dt>
                        <dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd>
                      </div>
                      {cart.discount && (
                        <div className="flex justify-between text-rose-deep">
                          <dt>{discountLabel(cart.discount)}</dt>
                          <dd className="tabular-nums">{cart.discount.amount > 0 ? `−${formatMoney(cart.discount.amount)}` : t("freeDelivery")}</dd>
                        </div>
                      )}
                      <div className="flex justify-between text-muted">
                        <dt>{t("delivery")}</dt>
                        <dd>{cart.discount?.freeShipping ? <span className="font-semibold text-rose-deep">{t("free")}</span> : t("atCheckout")}</dd>
                      </div>
                    </dl>
                    {!cart.purchasable && <p className="mt-3 text-xs font-semibold text-danger">{t("resolveStock")}</p>}
                    <div className="mt-4 grid gap-2">
                      <Link
                        href="/checkout"
                        onClick={() => setOpen(false)}
                        aria-disabled={!cart.purchasable}
                        className={cn(
                          "group flex h-13 items-center justify-between gap-3 rounded-full bg-plum ps-6 pe-2 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(37,25,35,0.9)] transition hover:bg-rose-deep",
                          !cart.purchasable && "pointer-events-none opacity-50",
                        )}
                      >
                        <span className="truncate">{t("checkoutTotal", { total: `${isEstimate ? "≈ " : ""}${formatMoney(cart.totalBeforeShipping)}` })}</span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:bg-white/25 rtl:-scale-x-100">
                          <ArrowRight className="size-4" aria-hidden />
                        </span>
                      </Link>
                      <Link href="/cart" onClick={() => setOpen(false)} className="py-1.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-plum-soft underline-offset-4 transition hover:text-rose-deep hover:underline">
                        {t("viewBag")}
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
