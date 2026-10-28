import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartPageView } from "@/components/cart/CartPageView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cart"))("bag"), robots: { index: false } };
}

export default async function CartPage() {
  const t = await getTranslations("cart");
  return (
    <div className="container-luxe pb-24 pt-12">
      <h1 className="display text-5xl sm:text-6xl">{t("bag")}</h1>
      <div className="mt-10">
        <CartPageView />
      </div>
    </div>
  );
}
