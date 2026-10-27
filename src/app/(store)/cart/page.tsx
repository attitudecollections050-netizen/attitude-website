import type { Metadata } from "next";
import { CartPageView } from "@/components/cart/CartPageView";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-luxe pb-24 pt-12">
      <h1 className="display text-5xl sm:text-6xl">Shopping bag</h1>
      <div className="mt-10">
        <CartPageView />
      </div>
    </div>
  );
}
