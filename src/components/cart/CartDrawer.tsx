"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { ShoppingBag, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { buttonClasses } from "@/components/ui/Button";
import { useCart } from "./CartProvider";
import { CartLineItem } from "./CartLineItem";
import { useDialog } from "@/components/ui/useDialog";

export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, () => setOpen(false), panelRef);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <m.div
            className="absolute inset-0 bg-plum/40 backdrop-blur-[2px]"
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
            aria-label="Shopping bag"
            tabIndex={-1}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <h2 className="font-display text-2xl">
                Your bag <span className="font-sans text-sm text-muted">({cart.itemCount})</span>
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="-m-2 p-2 transition hover:text-rose-deep" aria-label="Close bag">
                <X className="size-5" />
              </button>
            </div>

            {cart.lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-blush text-rose">
                  <ShoppingBag className="size-6" />
                </span>
                <p className="font-display text-2xl">Your bag is empty</p>
                <p className="text-sm text-muted">Discover new arrivals and pieces with presence.</p>
                <Link href="/shop" onClick={() => setOpen(false)} className={buttonClasses("primary")}>
                  Start shopping
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
                  <AnimatePresence initial={false}>
                    {cart.lines.map((line) => (
                      <CartLineItem key={line.itemId} line={line} compact />
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="border-t border-line bg-neutral px-6 py-5">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt>Subtotal</dt>
                      <dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd>
                    </div>
                    {cart.discount && (
                      <div className="flex justify-between text-rose-deep">
                        <dt>{cart.discount.automatic ? cart.discount.label : `Discount (${cart.discount.code})`}</dt>
                        <dd className="tabular-nums">{cart.discount.amount > 0 ? `−${formatMoney(cart.discount.amount)}` : "Free delivery"}</dd>
                      </div>
                    )}
                    <div className="flex justify-between text-muted">
                      <dt>Delivery</dt>
                      <dd>{cart.discount?.freeShipping ? <span className="font-semibold text-rose-deep">Free</span> : "Calculated at checkout"}</dd>
                    </div>
                  </dl>
                  {!cart.purchasable && (
                    <p className="mt-3 text-xs font-semibold text-danger">Please resolve the stock issues above before checkout.</p>
                  )}
                  <div className="mt-4 grid gap-2">
                    <Link
                      href="/checkout"
                      onClick={() => setOpen(false)}
                      aria-disabled={!cart.purchasable}
                      className={buttonClasses("primary", "lg", !cart.purchasable ? "pointer-events-none opacity-50" : "")}
                    >
                      Checkout · {formatMoney(cart.totalBeforeShipping)}
                    </Link>
                    <Link href="/cart" onClick={() => setOpen(false)} className={buttonClasses("outline", "md")}>
                      View bag
                    </Link>
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
