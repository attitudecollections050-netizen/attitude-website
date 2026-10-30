import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { BASE_CURRENCY, DEFAULT_LOCALE, PREF_COOKIES, currencyForCountry, isLocale, localeDir, negotiateLocale, type Locale } from "./config";
import { enabledCurrencies } from "@/lib/currency/rates";

export interface Preferences {
  locale: Locale;
  dir: "ltr" | "rtl";
  country: string;
  currency: string;
  /** True once the shopper has confirmed their choices (welcome screen not shown again). */
  chosen: boolean;
  /** Suggestions shown on the welcome screen, never applied without confirmation. */
  suggested: { locale: Locale; country: string | null; currency: string };
  enabledLocales: Locale[];
}

const COUNTRY_RE = /^[A-Z]{2}$/;
const ORIGINAL_LOCALES: Locale[] = ["en", "fr", "es", "pt", "ar", "de", "zh"];

export const getPreferences = cache(async (): Promise<Preferences> => {
  const [jar, h, settings] = await Promise.all([cookies(), headers(), getSettings()]);
  const intl = settings.intl;
  const enabledLocales = intl.enabled_locales.filter(isLocale) as Locale[];
  // Korean was added later: stores still on the original seven languages get it too.
  if (ORIGINAL_LOCALES.every((l) => enabledLocales.includes(l)) && enabledLocales.length === ORIGINAL_LOCALES.length) enabledLocales.push("ko");
  if (!enabledLocales.includes(DEFAULT_LOCALE)) enabledLocales.unshift(DEFAULT_LOCALE);
  const fallbackLocale = (isLocale(intl.default_locale) && enabledLocales.includes(intl.default_locale) ? intl.default_locale : DEFAULT_LOCALE) as Locale;

  const enabledCodes = await enabledCurrencies().then((c) => c.map((x) => x.code)).catch(() => [BASE_CURRENCY]);
  if (!enabledCodes.includes(BASE_CURRENCY)) enabledCodes.unshift(BASE_CURRENCY);

  const ipCountry = h.get("x-vercel-ip-country")?.toUpperCase();
  const suggestedCountry = ipCountry && COUNTRY_RE.test(ipCountry) && ipCountry !== "XX" ? ipCountry : null;
  const suggestedLocale = negotiateLocale(h.get("accept-language"), enabledLocales) ?? fallbackLocale;
  const suggestedCurrency = currencyForCountry(suggestedCountry, enabledCodes) ?? BASE_CURRENCY;

  const cLocale = jar.get(PREF_COOKIES.locale)?.value;
  const cCountry = jar.get(PREF_COOKIES.country)?.value?.toUpperCase();
  const cCurrency = jar.get(PREF_COOKIES.currency)?.value?.toUpperCase();
  const chosen = jar.get(PREF_COOKIES.chosen)?.value === "1";

  const locale = (isLocale(cLocale) && enabledLocales.includes(cLocale) ? cLocale : chosen ? fallbackLocale : suggestedLocale) as Locale;
  const country = cCountry && COUNTRY_RE.test(cCountry) ? cCountry : intl.default_country || "NG";
  // Until the shopper chooses, prices stay in NGN (the currency they will be charged in).
  const currency = cCurrency && enabledCodes.includes(cCurrency) ? cCurrency : BASE_CURRENCY;

  return {
    locale,
    dir: localeDir(locale),
    country,
    currency,
    chosen,
    suggested: { locale: suggestedLocale, country: suggestedCountry, currency: suggestedCurrency },
    enabledLocales,
  };
});

/** True when rendering the admin area (always English). */
export async function isAdminArea(): Promise<boolean> {
  return (await headers()).get("x-ac-area") === "admin";
}
