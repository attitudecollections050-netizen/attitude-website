"use client";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";
import { CartLineItem } from "./CartLineItem";
import { DiscountForm } from "./DiscountForm";
import { formatMoney } from "@/lib/money";
import { buttonClasses } from "@/components/ui/Button";

export function CartPageView() {
  const { cart } = useCart();
  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-blush text-rose">
          <ShoppingBag className="size-6" />
        </span>
        <p className="display text-4xl">Your bag is empty</p>
        <p className="text-sm text-muted">Pieces you add will appear here.</p>
        <Link href="/shop" className={buttonClasses("primary")}>
          Continue shopping
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Items in your bag">
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {cart.lines.map((l) => (
              <CartLineItem key={l.itemId} line={l} />
            ))}
          </AnimatePresence>
        </ul>
        <Link href="/shop" className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.2em] underline underline-offset-4 hover:text-rose-deep">
          Continue shopping
        </Link>
      </section>
      <aside className="h-fit rounded-[1.75rem] bg-neutral p-6 lg:sticky lg:top-28" aria-label="Order summary">
        <h2 className="font-display text-2xl">Summary</h2>
        <div className="mt-5">
          <DiscountForm />
        </div>
        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal ({cart.itemCount} items)</dt>
            <dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd>
          </div>
          {cart.discount && (
            <div className="flex justify-between text-rose-deep">
              <dt>Discount</dt>
              <dd className="tabular-nums">{cart.discount.freeShipping ? "Free delivery" : `−${formatMoney(cart.discount.amount)}`}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>Delivery</dt>
            <dd>Calculated at checkout</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd className="tabular-nums">{formatMoney(cart.totalBeforeShipping)}</dd>
          </div>
        </dl>
        {!cart.purchasable && <p className="mt-4 text-xs font-semibold text-danger">Some items need your attention before checkout.</p>}
        <Link
          href="/checkout"
          aria-disabled={!cart.purchasable}
          className={buttonClasses("primary", "lg", `mt-6 w-full ${!cart.purchasable ? "pointer-events-none opacity-50" : ""}`)}
        >
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}
