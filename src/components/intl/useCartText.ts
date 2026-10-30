"use client";
import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CartLine } from "@/lib/cart/assess";
import { useColorName } from "./useColorName";
import { FREE_SIZE_LABEL } from "@/lib/catalog/free-size";

/** Shopper-language text for bag lines: product name, colour/size label and stock warnings. */
export function useCartText() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const colorName = useColorName();
  const name = useCallback((l: Pick<CartLine, "name" | "translations">) => l.translations?.[locale]?.name?.trim() || l.name, [locale]);
  const variant = useCallback(
    (size: string | null, color: string | null) => [color ? colorName(color) : null, size ? (size === FREE_SIZE_LABEL ? t("freeSize") : t("sizeLabel", { size })) : null].filter(Boolean).join(" · "),
    [t, colorName],
  );
  const warning = useCallback(
    (l: Pick<CartLine, "warning" | "warningCode" | "stockLeft">) => (l.warningCode ? t(`warnings.${l.warningCode}`, { count: l.stockLeft ?? 0 }) : l.warning),
    [t],
  );
  return useMemo(() => ({ name, variant, warning }), [name, variant, warning]);
}
