"use client";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { addToCart, applyDiscountCode, removeCartItem, removeDiscountCode, updateCartItem, type CartActionResult } from "@/app/actions/cart";
import type { CartView } from "@/lib/cart/types";
import { track } from "@/lib/analytics/client";
import { useTranslations } from "next-intl";

interface CartContextValue {
  cart: CartView;
  open: boolean;
  setOpen: (open: boolean) => void;
  pending: boolean;
  toast: { id: number; text: string; tone: "success" | "error" } | null;
  add: (variantId: string, quantity?: number, opts?: { openDrawer?: boolean }) => Promise<CartActionResult>;
  update: (itemId: string, quantity: number) => Promise<CartActionResult>;
  remove: (itemId: string) => Promise<CartActionResult>;
  applyCode: (code: string) => Promise<CartActionResult>;
  removeCode: () => Promise<CartActionResult>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ initialCart, children }: { initialCart: CartView; children: React.ReactNode }) {
  const [cart, setCart] = useState(initialCart);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<CartContextValue["toast"]>(null);
  const tc = useTranslations("common");

  const notify = useCallback((text: string, tone: "success" | "error") => {
    const id = Date.now();
    setToast({ id, text, tone });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200);
  }, []);

  const run = useCallback(
    (fn: () => Promise<CartActionResult>, opts?: { openDrawer?: boolean; silent?: boolean }) =>
      new Promise<CartActionResult>((resolve) => {
        startTransition(async () => {
          try {
            const result = await fn();
            if (result.cart) setCart(result.cart);
            if (result.ok) {
              if (opts?.openDrawer) setOpen(true);
              if (result.message && !opts?.openDrawer && !opts?.silent) notify(result.message, "success");
            } else if (!opts?.silent) {
              notify(result.error, "error");
            }
            resolve(result);
          } catch {
            const result: CartActionResult = { ok: false, error: tc("somethingWrong") };
            notify(result.error, "error");
            resolve(result);
          }
        });
      }),
    [notify, tc],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      open,
      setOpen,
      pending,
      toast,
      add: (variantId, quantity = 1, opts) =>
        run(() => addToCart(variantId, quantity), { openDrawer: opts?.openDrawer ?? true }).then((r) => {
          if (r.ok) track("add_to_cart", { variantId });
          return r;
        }),
      update: (itemId, quantity) => run(() => updateCartItem(itemId, quantity)),
      remove: (itemId) => run(() => removeCartItem(itemId)),
      applyCode: (code) => run(() => applyDiscountCode(code), { silent: true }),
      removeCode: () => run(() => removeDiscountCode()),
    }),
    [cart, open, pending, toast, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
