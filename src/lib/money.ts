export const STORE_CURRENCY = "NGN";

/** Format an integer amount in minor units (kobo for NGN). */
export function formatMoney(minor: number, currency: string = STORE_CURRENCY): string {
  const value = minor / 100;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Parse a user-entered major-unit amount ("4,000" or "4000.50") into minor units. */
export function toMinor(input: string | number): number | null {
  const s = String(input).replace(/[,\s₦]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function toMajorString(minor: number | null | undefined): string {
  if (minor == null) return "";
  return (minor / 100).toFixed(2).replace(/\.00$/, "");
}
