"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSettings, type IntlSettings } from "@/lib/settings";
import { refreshExchangeRates } from "@/lib/currency/rates";
import { assertPermission } from "@/lib/auth";
import { LOCALES, PAYSTACK_CHANNELS, PREF_COOKIES, PREF_MAX_AGE } from "@/lib/intl/config";
import en from "@/messages/en.json";
import { bool, dbError, guarded, str } from "./helpers";
import type { AdminResult } from "./types";

const localeCode = z.enum(LOCALES.map((l) => l.code) as [string, ...string[]]);
const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code.");
const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);

async function putIntl(db: Parameters<Parameters<typeof guarded>[1]>[0]["db"], patch: Partial<IntlSettings>) {
  const { intl } = await getSettings();
  const { error } = await db.from("store_settings").upsert({ key: "intl", value: { ...intl, ...patch }, is_public: true }, { onConflict: "key" });
  return error;
}

const done = (message: string): AdminResult => {
  revalidatePath("/admin/international");
  revalidatePath("/", "layout");
  return { ok: true, message };
};

// ------------------------------------------------------------- languages
export async function saveLanguages(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const enabled = formData.getAll("enabled_locales").map((v) => localeCode.parse(v));
    const defaultLocale = localeCode.parse(formData.get("default_locale"));
    // English is the fallback for every missing translation, so it can't be switched off.
    const set = [...new Set(["en", ...enabled])];
    if (!set.includes(defaultLocale)) return { ok: false, message: "The default language must be enabled." };
    const error = await putIntl(db, { enabled_locales: LOCALES.map((l) => l.code).filter((c) => set.includes(c)), default_locale: defaultLocale });
    return dbError(error) ?? done("Languages saved.");
  });
}

// -------------------------------------------------------------- regions
export async function saveDefaultCountry(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const code = countryCode.parse(formData.get("default_country"));
    const { data } = await db.from("countries").select("code").eq("code", code).maybeSingle();
    if (!data) return { ok: false, message: "Unknown country." };
    return dbError(await putIntl(db, { default_country: code })) ?? done("Default country saved.");
  });
}

// ----------------------------------------------------------- currencies
export async function saveCurrency(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({
        code: currencyCode,
        is_enabled: bool,
        markup_percent: z.coerce.number().min(-20).max(50),
        manual_rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().positive("Manual rate must be above zero.").nullable()),
      })
      .parse(Object.fromEntries(formData));
    if (input.code === "NGN") return { ok: false, message: "NGN is the base currency: always on, never adjusted." };
    const { error } = await db
      .from("currencies")
      .update({ is_enabled: input.is_enabled, markup_bps: Math.round(input.markup_percent * 100), manual_rate: input.manual_rate })
      .eq("code", input.code);
    return dbError(error) ?? done(`${input.code} saved.`);
  });
}

export async function saveRateSettings(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({
        rate_provider: z.enum(["open_er_api", "exchangerate_api", "manual"]),
        auto_update: bool,
        max_rate_age_hours: z.coerce.number().int().min(6).max(24 * 14),
      })
      .parse(Object.fromEntries(formData));
    if (input.rate_provider === "exchangerate_api" && !process.env.EXCHANGE_RATE_API_KEY) {
      return { ok: false, message: "Set EXCHANGE_RATE_API_KEY in your hosting environment before choosing this provider." };
    }
    return dbError(await putIntl(db, input)) ?? done("Exchange-rate settings saved.");
  });
}

export async function updateRatesNow(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async () => {
    // "Accept large changes" skips the 25% jump check after a genuine big currency move.
    const r = await refreshExchangeRates({ force: formData.get("force") === "on" });
    revalidatePath("/admin/international");
    revalidatePath("/", "layout");
    return { ok: r.ok, message: r.message };
  });
}

// ------------------------------------------------------------- payments
export async function savePaymentChannels(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    // One line per country: "NG: card, bank, ussd" — plus a "default" line for everywhere else.
    const text = str(4000).parse(formData.get("channels"));
    const out: Record<string, string[]> = {};
    for (const [i, raw] of text.split("\n").entries()) {
      const line = raw.trim();
      if (!line) continue;
      const m = /^([A-Za-z]{2}|default)\s*:\s*(.+)$/.exec(line);
      if (!m) return { ok: false, message: `Line ${i + 1}: write it like "NG: card, bank_transfer".` };
      const key = m[1].toLowerCase() === "default" ? "default" : m[1].toUpperCase();
      const list = m[2].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
      const unknown = list.filter((c) => !(PAYSTACK_CHANNELS as readonly string[]).includes(c));
      if (unknown.length) return { ok: false, message: `Line ${i + 1}: unknown channel ${unknown.join(", ")}. Allowed: ${PAYSTACK_CHANNELS.join(", ")}.` };
      out[key] = [...new Set(list)];
    }
    if (!out.default?.length) return { ok: false, message: 'Add a "default" line (used for countries not listed).' };
    return dbError(await putIntl(db, { payment_channels: out })) ?? done("Payment methods saved.");
  });
}

// ---------------------------------------------------------- translations
type Tree = { [k: string]: string | Tree };
const englishValue = (key: string): string | undefined => {
  let node: string | Tree = en as Tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
};

export async function saveTranslationOverride(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({ locale: localeCode, key: z.string().trim().min(1).max(200), value: z.string().max(2000) })
      .parse(Object.fromEntries(formData));
    if (englishValue(input.key) === undefined) return { ok: false, message: "Unknown text key." };
    const value = input.value.trim();
    const { error } = value
      ? await db.from("translation_overrides").upsert({ locale: input.locale, key: input.key, value, updated_at: new Date().toISOString() }, { onConflict: "locale,key" })
      : await db.from("translation_overrides").delete().eq("locale", input.locale).eq("key", input.key);
    return dbError(error) ?? done(value ? "Text saved." : "Custom text removed — the built-in translation is used again.");
  });
}

export async function saveCatalogTranslation(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const input = z
      .object({
        table: z.enum(["products", "categories", "collections"]),
        id: z.string().uuid(),
        locale: localeCode.refine((l) => l !== "en", "English is edited on the item itself."),
        name: str(200),
        short_name: str(60).optional(),
        description: str(5000).optional(),
        details: str(5000).optional(),
      })
      .parse(Object.fromEntries(formData));
    const { data, error: readError } = await db.from(input.table).select("translations").eq("id", input.id).maybeSingle();
    if (readError) return dbError(readError);
    if (!data) return { ok: false, message: "Item not found." };
    const fields = Object.fromEntries(
      (["name", "short_name", "description", "details"] as const).filter((f) => input[f]?.trim()).map((f) => [f, input[f]!.trim()]),
    );
    const translations = { ...((data.translations as Record<string, unknown>) ?? {}) };
    if (Object.keys(fields).length) translations[input.locale] = fields;
    else delete translations[input.locale];
    const { error } = await db.from(input.table).update({ translations }).eq("id", input.id);
    return dbError(error) ?? done("Translation saved.");
  });
}

// --------------------------------------------------------------- preview
/** Opens the storefront as a shopper with these preferences (sets this browser's preference cookies only). */
export async function previewStore(formData: FormData) {
  await assertPermission("settings:write");
  const locale = localeCode.parse(formData.get("locale"));
  const currency = currencyCode.parse(formData.get("currency"));
  const country = countryCode.parse(formData.get("country"));
  const jar = await cookies();
  const opts = { path: "/", maxAge: PREF_MAX_AGE, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  jar.set(PREF_COOKIES.locale, locale, opts);
  jar.set(PREF_COOKIES.currency, currency, opts);
  jar.set(PREF_COOKIES.country, country, opts);
  jar.set(PREF_COOKIES.chosen, "1", opts);
  redirect("/");
}
