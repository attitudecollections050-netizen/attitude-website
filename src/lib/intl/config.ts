// Languages, preference cookies and country → currency hints. Shared by server and browser.

export const LOCALES = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  { code: "fr", name: "French", native: "Français", dir: "ltr" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr" },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl" },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文", dir: "ltr" },
] as const;
export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const BASE_CURRENCY = "NGN";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && LOCALES.some((l) => l.code === v);
export const localeDir = (l: string) => (LOCALES.find((x) => x.code === l)?.dir ?? "ltr") as "ltr" | "rtl";

/** Preference cookies are functional (they only remember a choice) — no tracking. */
export const PREF_COOKIES = { locale: "ac_locale", country: "ac_country", currency: "ac_currency", chosen: "ac_prefs" } as const;
export const PREF_MAX_AGE = 60 * 60 * 24 * 365;

/** Picks the best enabled language from an Accept-Language header (only a suggestion). */
export function negotiateLocale(acceptLanguage: string | null | undefined, enabled: readonly string[]): Locale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.base && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const r of ranked) if (isLocale(r.base) && enabled.includes(r.base)) return r.base;
  return null;
}

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];
const XOF = ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"];
const XAF = ["CM", "CF", "TD", "CG", "GQ", "GA"];
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", US: "USD", GB: "GBP", CA: "CAD", GH: "GHS", ZA: "ZAR", KE: "KES", AU: "AUD", AE: "AED", CN: "CNY",
  IN: "INR", BR: "BRL", SA: "SAR", CH: "CHF", JP: "JPY",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
  ...Object.fromEntries(XOF.map((c) => [c, "XOF"])),
  ...Object.fromEntries(XAF.map((c) => [c, "XAF"])),
};

/** The usual currency for a country, if the store has it enabled. */
export function currencyForCountry(country: string | null | undefined, enabled: readonly string[]): string | null {
  const c = country ? COUNTRY_CURRENCY[country.toUpperCase()] : undefined;
  return c && enabled.includes(c) ? c : null;
}

/** Paystack payment channels (https://paystack.com/docs/payments/payment-channels). */
export const PAYSTACK_CHANNELS = ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer", "eft", "apple_pay"] as const;
