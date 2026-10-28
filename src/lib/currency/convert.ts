// Display-currency conversion. Prices are stored in NGN kobo; other currencies
// are display-only estimates using validated rates (units per 1 NGN).

export interface DisplayRates {
  /** Effective rate per 1 NGN (markup applied), only for currencies with a valid, fresh rate. */
  rates: Record<string, number>;
  updatedAt: string | null;
  source: string | null;
}

export const NO_RATES: DisplayRates = { rates: { NGN: 1 }, updatedAt: null, source: null };

/** Converts NGN minor units (kobo) to an amount in `currency` major units, or null if no valid rate. */
export function convertFromNgn(minorNgn: number, currency: string, rates: DisplayRates): number | null {
  if (currency === "NGN") return minorNgn / 100;
  const r = rates.rates[currency];
  if (!r || !Number.isFinite(r) || r <= 0) return null;
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  return Math.round((minorNgn / 100) * r * factor) / factor;
}

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

const NGN_LOCALE = "en-NG";

/** Formats a stored NGN price in the shopper's display currency (falls back to ₦ if no valid rate). */
export function formatPrice(minorNgn: number, opts: { currency: string; locale: string; rates: DisplayRates }): string {
  const converted = convertFromNgn(minorNgn, opts.currency, opts.rates);
  if (converted == null || opts.currency === "NGN") return formatNgn(minorNgn, opts.locale);
  const digits = currencyDigits(opts.currency);
  return new Intl.NumberFormat(intlLocale(opts.locale), {
    style: "currency",
    currency: opts.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(converted);
}

export function formatNgn(minorNgn: number, locale = "en"): string {
  const value = minorNgn / 100;
  return new Intl.NumberFormat(locale === "en" ? NGN_LOCALE : intlLocale(locale), {
    style: "currency",
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Number formatting locale (Arabic uses Latin digits so prices match checkout and receipts). */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-u-nu-latn" : locale === "zh" ? "zh-CN" : locale;
}

/** True when the display currency differs from what the customer will be charged. */
export const isEstimate = (displayCurrency: string, chargeCurrency = "NGN") => displayCurrency !== chargeCurrency;
