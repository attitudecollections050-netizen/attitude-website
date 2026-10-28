"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/env";
import { enabledCurrencies } from "@/lib/currency/rates";
import { PREF_COOKIES, PREF_MAX_AGE, isLocale } from "@/lib/intl/config";

const input = z.object({
  locale: z.string().regex(/^[a-z]{2}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type SavePreferencesResult = { ok: true; ships: boolean } | { ok: false; error: string };

/**
 * Saves language, country and display currency as three separate preferences.
 * Guests: functional cookies (no tracking). Signed-in customers: also their profile.
 */
export async function savePreferences(raw: unknown): Promise<SavePreferencesResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { locale, country, currency } = parsed.data;
  const { intl } = await getSettings();
  if (!isLocale(locale) || !intl.enabled_locales.includes(locale)) return { ok: false, error: "language" };
  const currencies = (await enabledCurrencies()).map((c) => c.code);
  if (!currencies.includes(currency) && currency !== "NGN") return { ok: false, error: "currency" };

  let ships = false;
  if (isSupabaseConfigured()) {
    const { data } = await createPublicClient().from("countries").select("code, is_enabled").eq("code", country).maybeSingle();
    if (!data) return { ok: false, error: "country" };
    ships = data.is_enabled;
  }

  const jar = await cookies();
  const opts = { path: "/", maxAge: PREF_MAX_AGE, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", httpOnly: false };
  jar.set(PREF_COOKIES.locale, locale, opts);
  jar.set(PREF_COOKIES.country, country, opts);
  jar.set(PREF_COOKIES.currency, currency, opts);
  jar.set(PREF_COOKIES.chosen, "1", opts);

  const user = await getCurrentUser();
  if (user) {
    const db = await createClient();
    const { error } = await db.from("profiles").update({ preferred_locale: locale, preferred_country: country, preferred_currency: currency }).eq("id", user.id);
    if (error) console.error("[prefs] profile:", error.message);
  }
  return { ok: true, ships };
}

/** After sign-in: restore the customer's saved preferences into this browser. */
export async function restoreProfilePreferences(userId: string): Promise<void> {
  const db = await createClient();
  const { data } = await db.from("profiles").select("preferred_locale, preferred_country, preferred_currency").eq("id", userId).maybeSingle();
  if (!data?.preferred_locale && !data?.preferred_country && !data?.preferred_currency) return;
  const jar = await cookies();
  const opts = { path: "/", maxAge: PREF_MAX_AGE, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", httpOnly: false };
  if (data.preferred_locale) jar.set(PREF_COOKIES.locale, data.preferred_locale, opts);
  if (data.preferred_country) jar.set(PREF_COOKIES.country, data.preferred_country, opts);
  if (data.preferred_currency) jar.set(PREF_COOKIES.currency, data.preferred_currency, opts);
  jar.set(PREF_COOKIES.chosen, "1", opts);
}
