import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, serverSecrets } from "@/lib/env";
import { getSettings, type RateProvider } from "@/lib/settings";
import { NO_RATES, type DisplayRates } from "./convert";

export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  is_enabled: boolean;
  markup_bps: number;
  manual_rate: number | null;
  sort_order: number;
}
interface RateRow {
  currency: string;
  rate: number;
  source: string;
  provider_updated_at: string | null;
  fetched_at: string;
}

/** A rate may not move more than this between two updates; bigger jumps are rejected as suspect. */
export const MAX_RATE_JUMP = 0.25;

export const loadCurrencies = cache(async (): Promise<CurrencyRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient().from("currencies").select("*").order("sort_order");
  if (error) {
    console.error("[currency] currencies:", error.message);
    return [];
  }
  return (data ?? []).map((c) => ({ ...c, manual_rate: c.manual_rate == null ? null : Number(c.manual_rate) })) as CurrencyRow[];
});

/** Enabled currencies, NGN first. */
export async function enabledCurrencies(): Promise<CurrencyRow[]> {
  return (await loadCurrencies()).filter((c) => c.is_enabled);
}

/**
 * Rates the storefront may display right now: only enabled currencies whose
 * rate is valid and fresh (or a manual rate set by the admin). Anything else
 * is left out, so prices fall back to NGN instead of using a bad rate.
 */
export const getDisplayRates = cache(async (): Promise<DisplayRates> => {
  if (!isSupabaseConfigured()) return NO_RATES;
  try {
    const [{ intl }, currencies, { data, error }] = await Promise.all([
      getSettings(),
      enabledCurrencies(),
      createPublicClient().from("exchange_rates").select("currency, rate, source, provider_updated_at, fetched_at"),
    ]);
    if (error) throw error;
    return computeDisplayRates(currencies, (data ?? []) as RateRow[], intl.rate_provider, intl.max_rate_age_hours);
  } catch (e) {
    console.error("[currency] rates unavailable:", (e as Error).message);
    return NO_RATES;
  }
});

export function computeDisplayRates(currencies: CurrencyRow[], rows: RateRow[], provider: RateProvider, maxAgeHours: number, now = Date.now()): DisplayRates {
  const out: Record<string, number> = { NGN: 1 };
  let updatedAt: string | null = null;
  let source: string | null = null;
  for (const c of currencies) {
    if (c.code === "NGN" || !c.is_enabled) continue;
    let base: number | null = null;
    if (provider === "manual") {
      base = c.manual_rate;
      source = "manual";
    } else {
      const r = rows.find((x) => x.currency === c.code);
      if (r && now - new Date(r.fetched_at).getTime() <= maxAgeHours * 3_600_000) {
        base = Number(r.rate);
        source = r.source;
        if (!updatedAt || r.fetched_at > updatedAt) updatedAt = r.fetched_at;
      }
    }
    if (base && Number.isFinite(base) && base > 0) out[c.code] = base * (1 + c.markup_bps / 10_000);
  }
  return { rates: out, updatedAt, source };
}

/** True if automatic updates are on and the stored rates are older than half the allowed age. */
export async function ratesNeedRefresh(): Promise<boolean> {
  const { intl } = await getSettings();
  if (!intl.auto_update || intl.rate_provider === "manual") return false;
  const { data } = await createPublicClient().from("exchange_rates").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return true;
  return Date.now() - new Date(data.fetched_at).getTime() > (intl.max_rate_age_hours / 2) * 3_600_000;
}

// ---------------------------------------------------------------------------
// Fetching from the provider
// ---------------------------------------------------------------------------
export interface ProviderResult {
  rates: Record<string, number>;
  providerUpdatedAt: string | null;
  source: string;
}

/** Calls the configured exchange-rate provider for NGN-based rates. Throws on any invalid response. */
export async function fetchProviderRates(provider: RateProvider, fetchImpl: typeof fetch = fetch): Promise<ProviderResult> {
  const base = process.env.EXCHANGE_RATE_API_BASE?.replace(/\/$/, "");
  let url: string;
  let source: string;
  if (provider === "exchangerate_api") {
    const key = process.env.EXCHANGE_RATE_API_KEY;
    if (!key) throw new Error("EXCHANGE_RATE_API_KEY is not set.");
    url = `${base ?? "https://v6.exchangerate-api.com"}/v6/${encodeURIComponent(key)}/latest/NGN`;
    source = "exchangerate-api.com";
  } else if (provider === "open_er_api") {
    url = `${base ?? "https://open.er-api.com"}/v6/latest/NGN`;
    source = "open.er-api.com";
  } else {
    throw new Error("Manual rates are entered by the admin; nothing to fetch.");
  }
  const res = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Provider responded ${res.status}`);
  const body = (await res.json()) as { result?: string; base_code?: string; rates?: Record<string, unknown>; conversion_rates?: Record<string, unknown>; time_last_update_unix?: number; "error-type"?: string };
  if (body.result !== "success") throw new Error(`Provider error: ${body["error-type"] ?? "unknown"}`);
  if (body.base_code && body.base_code !== "NGN") throw new Error(`Unexpected base currency ${body.base_code}`);
  const raw = body.conversion_rates ?? body.rates;
  if (!raw || typeof raw !== "object") throw new Error("No rates in response");
  const rates: Record<string, number> = {};
  for (const [code, v] of Object.entries(raw)) {
    const n = typeof v === "number" ? v : Number(v);
    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(n) && n > 0) rates[code] = n;
  }
  if (rates.NGN !== undefined && Math.abs(rates.NGN - 1) > 1e-9) throw new Error("Provider NGN rate is not 1");
  return { rates, providerUpdatedAt: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000).toISOString() : null, source };
}

/** Accepts a new rate only if it is positive and not wildly different from the previous one. */
export function validateRate(previous: number | null | undefined, next: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(next) || next <= 0) return { ok: false, reason: "not a positive number" };
  if (previous && previous > 0) {
    const change = Math.abs(next - previous) / previous;
    if (change > MAX_RATE_JUMP) return { ok: false, reason: `changed ${(change * 100).toFixed(0)}% since the last update` };
  }
  return { ok: true };
}

/**
 * Fetches, validates and stores rates for every enabled currency. Uses the
 * service role (server only). Returns a summary that is also logged.
 */
export async function refreshExchangeRates(opts: { force?: boolean } = {}): Promise<{ ok: boolean; message: string; updated: number }> {
  if (!serverSecrets().supabaseSecretKey) return { ok: false, message: "SUPABASE_SECRET_KEY is required to save exchange rates.", updated: 0 };
  const db = createServiceClient();
  const { intl } = await getSettings();
  if (intl.rate_provider === "manual") return { ok: true, message: "Manual rates are in use; nothing to fetch.", updated: 0 };
  const log = async (ok: boolean, message: string, updated: number, source: string) => {
    await db.from("exchange_rate_log").insert({ source, ok, message: message.slice(0, 500), currencies_updated: updated });
  };
  let result: ProviderResult;
  try {
    result = await fetchProviderRates(intl.rate_provider);
  } catch (e) {
    const message = `Rate update failed: ${(e as Error).message}`;
    await log(false, message, 0, intl.rate_provider);
    return { ok: false, message, updated: 0 };
  }
  const [{ data: currencies }, { data: existing }] = await Promise.all([
    db.from("currencies").select("code, is_enabled").eq("is_enabled", true),
    db.from("exchange_rates").select("currency, rate"),
  ]);
  const prev = new Map((existing ?? []).map((r) => [r.currency as string, Number(r.rate)]));
  const rows: RateRow[] = [];
  const rejected: string[] = [];
  const missing: string[] = [];
  const fetchedAt = new Date().toISOString();
  for (const c of currencies ?? []) {
    if (c.code === "NGN") continue;
    const next = result.rates[c.code];
    if (next === undefined) {
      missing.push(c.code);
      continue;
    }
    const check = opts.force ? ({ ok: true } as const) : validateRate(prev.get(c.code), next);
    if (!check.ok) {
      rejected.push(`${c.code} (${check.reason})`);
      continue;
    }
    rows.push({ currency: c.code, rate: next, source: result.source, provider_updated_at: result.providerUpdatedAt, fetched_at: fetchedAt });
  }
  if (rows.length) {
    const { error } = await db.from("exchange_rates").upsert(rows, { onConflict: "currency" });
    if (error) {
      await log(false, `Could not save rates: ${error.message}`, 0, result.source);
      return { ok: false, message: error.message, updated: 0 };
    }
  }
  const parts = [`Updated ${rows.length} currenc${rows.length === 1 ? "y" : "ies"} from ${result.source}.`];
  if (rejected.length) parts.push(`Kept previous rate for: ${rejected.join(", ")}.`);
  if (missing.length) parts.push(`Provider has no rate for: ${missing.join(", ")}.`);
  const message = parts.join(" ");
  await log(rejected.length === 0 && missing.length === 0, message, rows.length, result.source);
  return { ok: rows.length > 0, message, updated: rows.length };
}

let inFlight: Promise<unknown> | null = null;
const MIN_ATTEMPT_GAP_MS = 30 * 60 * 1000;

/** Background refresh when rates are getting old. At most one attempt per 30 minutes. */
export async function maybeRefreshRates(): Promise<void> {
  if (inFlight || !isSupabaseConfigured() || !serverSecrets().supabaseSecretKey) return;
  try {
    if (!(await ratesNeedRefresh())) return;
    const { data } = await createServiceClient().from("exchange_rate_log").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < MIN_ATTEMPT_GAP_MS) return;
    inFlight = refreshExchangeRates();
    await inFlight;
  } catch (e) {
    console.error("[currency] background refresh:", (e as Error).message);
  } finally {
    inFlight = null;
  }
}
