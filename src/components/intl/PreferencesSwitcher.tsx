"use client";
import { useTranslations } from "next-intl";
import { Globe2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePreferences } from "./PreferencesProvider";
import { flag, regionName } from "./PreferencesDialog";

/** Header shortcut, e.g. "EN | 🇳🇬 Nigeria | NGN ₦". Opens the preferences dialog. */
export function PreferencesSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const p = usePreferences();
  const t = useTranslations("prefs");
  if (!p) return null;
  const cur = p.currencies.find((c) => c.code === p.currency);
  const country = regionName(p.country, p.locale);
  return (
    <button
      type="button"
      onClick={p.openDialog}
      className={cn("inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.7rem] font-semibold transition hover:border-rose hover:text-rose-deep", className)}
      aria-label={t("switcherLabel", { language: p.locale.toUpperCase(), country, currency: p.currency })}
    >
      <Globe2 className="size-3.5" aria-hidden />
      <span>{p.locale.toUpperCase()}</span>
      <span className="text-line" aria-hidden>|</span>
      <span aria-hidden>{flag(p.country)}</span>
      {!compact && <span className="max-w-[7rem] truncate">{country}</span>}
      <span className="text-line" aria-hidden>|</span>
      <span>{p.currency} {cur?.symbol}</span>
    </button>
  );
}
