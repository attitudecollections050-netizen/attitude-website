"use client";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { cn } from "@/lib/cn";

export function Price({ price, salePrice, className, size = "md" }: { price: number; salePrice?: number | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const { format } = useMoney();
  const t = useTranslations("price");
  const onSale = salePrice != null && salePrice < price;
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-[0.8rem]" : "text-sm";
  return (
    <span className={cn("inline-flex items-baseline gap-2 font-sans tabular-nums", text, className)}>
      {onSale ? (
        <>
          <span className="font-semibold text-rose-deep">
            <span className="sr-only">{t("sale")} </span>
            {format(salePrice!)}
          </span>
          <s className="text-muted">
            <span className="sr-only">{t("original")} </span>
            {format(price)}
          </s>
        </>
      ) : (
        <span className="font-semibold">{format(price)}</span>
      )}
    </span>
  );
}
