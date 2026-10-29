// WhatsApp click-to-chat links (wa.me). Numbers are stored as typed by the owner,
// e.g. "0803 123 4567" or "+234 803 123 4567", and normalised here.

/** Digits in international format without "+", or null when it doesn't look like a phone number. */
export function normalizeWhatsApp(input: string | null | undefined, defaultCountryCode = "234"): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("00")) digits = digits.slice(2);
  // Local Nigerian format (0803…) → 234803…
  else if (digits.startsWith("0") && digits.length === 11) digits = defaultCountryCode + digits.slice(1);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** https://wa.me/<number>?text=… (null when the number is missing or invalid). */
export function whatsappUrl(number: string | null | undefined, text?: string): string | null {
  const n = normalizeWhatsApp(number);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Friendly display: +234 803 123 4567 */
export function formatWhatsApp(number: string | null | undefined): string {
  const n = normalizeWhatsApp(number);
  if (!n) return number ?? "";
  if (n.startsWith("234") && n.length === 13) return `+234 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
  return `+${n}`;
}
