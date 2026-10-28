"use client";
import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ShippingQuote } from "@/lib/shipping/calculator";

const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");

/** Translates shipping labels, method names, delivery windows and errors produced by the calculator. */
export function useShippingText() {
  const t = useTranslations("shipping");
  const label = useCallback((l: string) => (t.has(`labels.${key(l)}`) ? t(`labels.${key(l)}`) : l), [t]);
  const method = useCallback((m: string) => (t.has(`methods.${key(m)}`) ? t(`methods.${key(m)}`) : m), [t]);
  const window = useCallback(
    (min: number | null, max: number | null): string | null => {
      if (min == null && max == null) return null;
      if (min != null && max != null) return min === max ? t("days", { count: min }) : t("daysRange", { min, max });
      return min != null ? t("daysFrom", { count: min }) : t("daysUpTo", { count: max! });
    },
    [t],
  );
  const error = useCallback(
    (q: Extract<ShippingQuote, { ok: false }> | { code: string; message: string; field?: string; label?: string }) => {
      if (q.code === "invalid_address" && q.field) return t(`errors.${q.field}`, { label: q.label ? label(q.label).toLowerCase() : "" });
      return t.has(`errors.${q.code}`) ? t(`errors.${q.code}`) : q.message;
    },
    [t, label],
  );
  return useMemo(() => ({ label, method, window, error }), [label, method, window, error]);
}
