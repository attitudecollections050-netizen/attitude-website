"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { formatNgn, formatPrice, type DisplayRates } from "@/lib/currency/convert";

export interface CountryOption {
  code: string;
  name: string;
  ships: boolean;
}
export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}
export interface PreferencesValue {
  locale: string;
  country: string;
  currency: string;
  chosen: boolean;
  suggested: { locale: string; country: string | null; currency: string };
  enabledLocales: string[];
  currencies: CurrencyOption[];
  countries: CountryOption[];
  rates: DisplayRates;
  /** Currency actually charged at checkout. */
  chargeCurrency: string;
}

interface Ctx extends PreferencesValue {
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const PreferencesContext = createContext<Ctx | null>(null);
export const OPEN_PREFS_EVENT = "ac:open-prefs";

export function PreferencesProvider({ value, children }: { value: PreferencesValue; children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const ctx = useMemo(() => ({ ...value, dialogOpen, openDialog, closeDialog }), [value, dialogOpen, openDialog, closeDialog]);
  return <PreferencesContext.Provider value={ctx}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Ctx | null {
  return useContext(PreferencesContext);
}

/** Display-currency formatting. Outside the store (no provider) it formats NGN. */
export function useMoney() {
  const p = useContext(PreferencesContext);
  const currency = p && p.rates.rates[p.currency] ? p.currency : "NGN";
  const locale = p?.locale ?? "en";
  const format = useCallback(
    (minorNgn: number) => (p ? formatPrice(minorNgn, { currency, locale, rates: p.rates }) : formatNgn(minorNgn)),
    [p, currency, locale],
  );
  /** Always the charge currency (NGN), regardless of display currency. */
  const formatCharge = useCallback((minorNgn: number) => formatNgn(minorNgn, locale), [locale]);
  return {
    format,
    formatCharge,
    currency,
    chargeCurrency: p?.chargeCurrency ?? "NGN",
    isEstimate: currency !== (p?.chargeCurrency ?? "NGN"),
    /** The shopper picked a currency we currently can't convert to (no valid rate). */
    unavailable: Boolean(p && p.currency !== currency),
    rateUpdatedAt: p?.rates.updatedAt ?? null,
  };
}

/** A price in the shopper's display currency. */
export function Money({ minor, className }: { minor: number; className?: string }) {
  const { format } = useMoney();
  return <span className={className}>{format(minor)}</span>;
}
