import type { CartLine } from "./assess";

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  discount: { code: string; label: string; amount: number; freeShipping: boolean; automatic?: boolean } | null;
  discountError: string | null;
  totalBeforeShipping: number;
  purchasable: boolean;
  currency: string;
}

export const EMPTY_CART: CartView = {
  lines: [],
  itemCount: 0,
  subtotal: 0,
  discount: null,
  discountError: null,
  totalBeforeShipping: 0,
  purchasable: false,
  currency: "NGN",
};
