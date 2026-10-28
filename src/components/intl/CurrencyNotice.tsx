"use client";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMoney, usePreferences } from "./PreferencesProvider";

/** Explains that non-NGN prices are estimates and what the customer is charged in. */
export function CurrencyNotice({ className }: { className?: string }) {
  const p = usePreferences();
  const money = useMoney();
  const t = useTranslations("price");
  if (!p) return null;
  if (money.unavailable) {
    return <p className={cn("flex items-start gap-2 text-xs text-muted", className)} role="status"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("unavailable", { currency: p.currency })}</p>;
  }
  if (!money.isEstimate) return null;
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted", className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {t("estimate", { currency: money.currency, charge: money.chargeCurrency })}
    </p>
  );
}
