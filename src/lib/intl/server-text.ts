import "server-only";
import { getTranslations } from "next-intl/server";

// English validation messages (from lib/validation) → translation keys in the "validation" namespace.
const VALIDATION_KEYS: Record<string, string> = {
  "Enter a valid email address.": "email",
  "Enter a valid phone number, including country code for international numbers.": "phone",
  "Enter the recipient's full name.": "recipientName",
  "Choose a country.": "country",
  "Enter your city or town.": "city",
  "Enter your street address.": "street",
  "Choose a delivery method.": "deliveryMethod",
  "Enter your name.": "name",
  "Enter a subject.": "subject",
  "Your message should be at least 10 characters.": "messageLength",
  "Use at least 8 characters.": "passwordLength",
  "Include at least one letter.": "passwordLetter",
  "Include at least one number.": "passwordNumber",
  "Enter your password.": "password",
};

/** Translates a known English validation message; unknown text is returned unchanged. */
export async function localizeMessage(message: string): Promise<string> {
  const key = VALIDATION_KEYS[message];
  if (!key) return message;
  const t = await getTranslations("validation");
  return t(key);
}

/** Translates every value of a field-errors map. */
export async function localizeFieldErrors(errors: Record<string, string>): Promise<Record<string, string>> {
  const t = await getTranslations("validation");
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, VALIDATION_KEYS[v] ? t(VALIDATION_KEYS[v]) : v]));
}

/** Shipping calculator errors in the shopper's language (server side). */
export async function localizeShippingError(q: { code: string; message: string; field?: string; label?: string }): Promise<string> {
  const t = await getTranslations("shipping");
  const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  if (q.code === "invalid_address" && q.field) {
    const label = q.label ? (t.has(`labels.${key(q.label)}`) ? t(`labels.${key(q.label)}`) : q.label).toLowerCase() : "";
    return t(`errors.${q.field}`, { label });
  }
  return t.has(`errors.${q.code}`) ? t(`errors.${q.code}`) : q.message;
}
