"use client";
import { useTranslations } from "next-intl";
import type { CartView } from "@/lib/cart/types";
import { useMoney } from "./PreferencesProvider";

/** Label for the bag's discount line, built from the real offer numbers so every language is accurate. */
export function useDiscountLabel() {
  const t = useTranslations("cart");
  const { format } = useMoney();
  return (d: NonNullable<CartView["discount"]>, withCode = true) => {
    if (d.automatic) {
      const min = d.minSubtotal ? format(d.minSubtotal) : "";
      if (d.percent && d.freeShipping) return t("autoPercentFree", { percent: d.percent, min });
      if (d.percent) return t("autoPercent", { percent: d.percent, min });
      if (d.freeShipping) return t("autoFree", { min });
      return t("autoOffer");
    }
    return withCode ? t("discountCode", { code: d.code }) : t("discount");
  };
}

/** Short description of a typed discount code ("10% off", "Free delivery"). */
export function useDiscountDescription() {
  const t = useTranslations("cart");
  return (d: NonNullable<CartView["discount"]>) => (d.percent ? t("percentOff", { percent: d.percent }) : d.freeShipping && !d.amount ? t("freeDelivery") : t("discount"));
}

/** Discount error in the shopper's language. */
export function useDiscountError() {
  const t = useTranslations("cart");
  const { format } = useMoney();
  return (e: { reason: string; minSubtotal?: number } | null | undefined, fallback: string | null) =>
    e && t.has(`discountErrors.${e.reason}`) ? t(`discountErrors.${e.reason}`, { min: e.minSubtotal ? format(e.minSubtotal) : "" }) : fallback;
}
