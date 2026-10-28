import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { computeDisplayRates, type CurrencyRow } from "@/lib/currency/rates";
import { LOCALES, PAYSTACK_CHANNELS } from "@/lib/intl/config";
import { serverSecrets } from "@/lib/env";
import {
  previewStore,
  saveCatalogTranslation,
  saveCurrency,
  saveDefaultCountry,
  saveLanguages,
  savePaymentChannels,
  saveRateSettings,
  saveTranslationOverride,
  updateRatesNow,
} from "@/app/admin/actions/international";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Empty, Field, PageHeader, Table, inputCls } from "@/components/admin/ui";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import zh from "@/messages/zh.json";

export const metadata = { title: "International Store Settings" };

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ""): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)));
const BUNDLED: Record<string, Map<string, string>> = Object.fromEntries(
  Object.entries({ en, fr, es, pt, ar, de, zh }).map(([l, m]) => [l, new Map(flat(m as Tree))]),
);
const ENGLISH = BUNDLED.en;
const ENGLISH_KEYS = [...ENGLISH.keys()];

const dt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—");
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function InternationalPage({ searchParams }: PageProps<"/admin/international">) {
  await requireStaffPage("settings:write");
  const sp = await searchParams;
  const db = await createClient();
  const [{ intl }, currenciesRes, ratesRes, logRes, countriesRes] = await Promise.all([
    getSettings(),
    db.from("currencies").select("*").order("sort_order"),
    db.from("exchange_rates").select("currency, rate, source, provider_updated_at, fetched_at"),
    db.from("exchange_rate_log").select("id, source, ok, message, currencies_updated, created_at").order("created_at", { ascending: false }).limit(8),
    db.from("countries").select("code, name, is_enabled").order("name"),
  ]);
  const currencies = ((currenciesRes.data ?? []) as CurrencyRow[]).map((c) => ({ ...c, manual_rate: c.manual_rate == null ? null : Number(c.manual_rate) }));
  const rateRows = (ratesRes.data ?? []) as { currency: string; rate: number; source: string; provider_updated_at: string | null; fetched_at: string }[];
  const effective = computeDisplayRates(currencies, rateRows, intl.rate_provider, intl.max_rate_age_hours);
  const log = logRes.data ?? [];
  const lastGood = log.find((l) => l.ok && l.currencies_updated > 0);
  const countries = countriesRes.data ?? [];
  const delivering = countries.filter((c) => c.is_enabled);
  const keyConfigured = Boolean(process.env.EXCHANGE_RATE_API_KEY);
  const canStoreRates = Boolean(serverSecrets().supabaseSecretKey);

  // Translation editor
  const tl = LOCALES.some((l) => l.code === one(sp.tl)) ? one(sp.tl) : "fr";
  const tq = one(sp.tq).trim().toLowerCase();
  const { data: overrideRows } = await db.from("translation_overrides").select("locale, key, value, updated_at");
  const overrides = new Map((overrideRows ?? []).filter((o) => o.locale === tl).map((o) => [o.key as string, o.value as string]));
  const coverage = LOCALES.map((l) => {
    const bundled = BUNDLED[l.code];
    const done = ENGLISH_KEYS.filter((k) => !ENGLISH.get(k)!.trim() || bundled.get(k)?.trim()).length;
    return { ...l, pct: Math.floor((done / ENGLISH_KEYS.length) * 100), custom: (overrideRows ?? []).filter((o) => o.locale === l.code).length };
  });
  const matches = ENGLISH_KEYS.filter((k) => {
    if (!tq) return overrides.has(k) || k.startsWith("store.");
    return [k, ENGLISH.get(k), BUNDLED[tl].get(k), overrides.get(k)].some((v) => v?.toLowerCase().includes(tq));
  });

  // Catalog translations
  const ct = (["products", "categories", "collections"] as const).find((t) => t === one(sp.ct)) ?? "products";
  const cl = LOCALES.some((l) => l.code === one(sp.cl) && l.code !== "en") ? one(sp.cl) : "fr";
  const cq = one(sp.cq).trim();
  const cols = ct === "products" ? "id, name, description, details, translations" : ct === "categories" ? "id, name, description, translations" : "id, name, description, translations";
  let catalogQuery = db.from(ct).select(cols).order("name").limit(15);
  if (cq) catalogQuery = catalogQuery.ilike("name", `%${cq.replace(/[%_]/g, "")}%`);
  const { data: catalogRows } = await catalogQuery;
  const items = (catalogRows ?? []) as unknown as { id: string; name: string; description: string | null; details?: string | null; translations: Record<string, Record<string, string>> | null }[];

  const channelText = Object.entries(intl.payment_channels)
    .sort(([a], [b]) => (a === "default" ? 1 : b === "default" ? -1 : a.localeCompare(b)))
    .map(([k, v]) => `${k}: ${v.join(", ")}`)
    .join("\n");
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tl, tq: one(sp.tq), ct, cl, cq, ...patch });
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="International Store Settings"
        description="Languages, countries, display currencies and payment methods. Prices are always stored in NGN; other currencies are display estimates. API keys live in your hosting environment and are never shown here."
      />

      <Card title="Languages" description="English is always on — it's the fallback whenever a translation is missing.">
        <ActionForm action={saveLanguages}>
          <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Enabled for customers</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {coverage.map((l) => (
                  <label key={l.code} className="flex items-center justify-between gap-2 rounded-[3px] border border-line px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" name="enabled_locales" value={l.code} defaultChecked={l.code === "en" || intl.enabled_locales.includes(l.code)} disabled={l.code === "en"} className="size-4 accent-[#d94f91]" />
                      {l.name} <span className="text-muted" lang={l.code}>{l.native !== l.name ? l.native : ""}</span>
                    </span>
                    <span className="text-[0.65rem] text-muted">{l.pct}%{l.custom ? ` · ${l.custom} custom` : ""}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Default language" hint="Used when a visitor's browser language isn't enabled.">
              <select name="default_locale" defaultValue={intl.default_locale} className={inputCls}>
                {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">Built-in translations were prepared with AI assistance. Have legal, checkout and policy wording reviewed by a fluent speaker; you can correct any text below.</p>
        </ActionForm>
      </Card>

      <Card title="Countries & delivery" description="Visitors can pick any country to browse. Checkout and delivery are only offered where you have enabled delivery.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionForm action={saveDefaultCountry}>
            <Field label="Default country" hint="Pre-selected when we can't suggest one from the visitor's location.">
              <select name="default_country" defaultValue={intl.default_country} className={inputCls}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </Field>
          </ActionForm>
          <div className="text-sm">
            <p className="font-semibold">Delivering to {delivering.length} {delivering.length === 1 ? "country" : "countries"}</p>
            <p className="mt-1 text-muted">{delivering.map((c) => c.name).join(", ") || "None yet."}</p>
            <Link href="/admin/shipping" className="mt-3 inline-block text-rose-deep underline underline-offset-4">Manage delivery countries, zones and rates →</Link>
          </div>
        </div>
      </Card>

      <Card
        title="Display currencies"
        description="NGN is the base currency. A currency is shown to customers only while it is enabled and has a valid, fresh rate; otherwise prices fall back to NGN. Markup adjusts the displayed estimate only — it never changes what is charged."
      >
        <Table>
          <thead>
            <tr>
              <th>Currency</th>
              <th>On</th>
              <th>Markup %</th>
              <th>Manual rate (per ₦1)</th>
              <th>Provider rate</th>
              <th>Shown to customers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {currencies.map((c) => {
              const stored = rateRows.find((r) => r.currency === c.code);
              const shown = effective.rates[c.code];
              const formId = `cur-${c.code}`;
              return (
                <tr key={c.code}>
                  <td className="whitespace-nowrap"><span className="font-semibold">{c.code}</span> <span className="text-muted">{c.symbol} · {c.name}</span></td>
                  {c.code === "NGN" ? (
                    <td colSpan={6} className="text-xs text-muted">Base currency — always on. All prices and payments are in NGN.</td>
                  ) : (
                    <>
                      <td><input form={formId} type="checkbox" name="is_enabled" defaultChecked={c.is_enabled} className="size-4 accent-[#d94f91]" aria-label={`Show ${c.code}`} /></td>
                      <td><input form={formId} name="markup_percent" type="number" step="0.01" min={-20} max={50} defaultValue={c.markup_bps / 100} className={`${inputCls} w-24`} aria-label={`${c.code} markup`} /></td>
                      <td><input form={formId} name="manual_rate" type="number" step="any" min={0} defaultValue={c.manual_rate ?? ""} placeholder="—" className={`${inputCls} w-36`} aria-label={`${c.code} manual rate`} /></td>
                      <td className="whitespace-nowrap text-xs">
                        {stored ? <>{Number(stored.rate).toPrecision(6)}<span className="block text-muted">{dt(stored.fetched_at)}</span></> : <span className="text-muted">None yet</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {shown ? (
                          <><Badge tone="success">Active</Badge><span className="mt-1 block text-muted">₦10,000 ≈ {(100 * 100 * shown).toFixed(2)} {c.code}</span></>
                        ) : c.is_enabled ? (
                          <Badge tone="warning">No valid rate — NGN shown</Badge>
                        ) : (
                          <Badge>Off</Badge>
                        )}
                      </td>
                      <td>
                        {/* The inputs in this row join this form through their `form` attribute. */}
                        <ActionForm id={formId} action={saveCurrency} inline submitLabel="Save" variant="outline">
                          <input type="hidden" name="code" value={c.code} />
                        </ActionForm>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card title="Exchange rates" description="Rates are fetched on the server, validated (positive, and no more than a 25% jump from the last rate) and stored with a timestamp. If the service fails, the last valid rate is kept until it expires; after that prices show in NGN.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionForm action={saveRateSettings}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rate provider" className="sm:col-span-2">
                <select name="rate_provider" defaultValue={intl.rate_provider} className={inputCls}>
                  <option value="open_er_api">open.er-api.com (free, no key, daily)</option>
                  <option value="exchangerate_api">ExchangeRate-API (needs EXCHANGE_RATE_API_KEY)</option>
                  <option value="manual">Manual rates (entered above)</option>
                </select>
              </Field>
              <Field label="Rates expire after (hours)" hint="Older rates are not used.">
                <input name="max_rate_age_hours" type="number" min={6} max={336} defaultValue={intl.max_rate_age_hours} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="auto_update" defaultChecked={intl.auto_update} className="size-4 accent-[#d94f91]" /> Update automatically</label>
            </div>
          </ActionForm>
          <div className="space-y-3 text-sm">
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">ExchangeRate-API key <Badge tone={keyConfigured ? "success" : "neutral"}>{keyConfigured ? "Configured" : "Not set"}</Badge></li>
              <li className="flex justify-between gap-3">Saving rates (SUPABASE_SECRET_KEY) <Badge tone={canStoreRates ? "success" : "danger"}>{canStoreRates ? "Ready" : "Missing"}</Badge></li>
              <li className="flex justify-between gap-3">Daily scheduled update <code className="text-xs">/api/cron/exchange-rates</code></li>
              <li className="flex justify-between gap-3">Last successful update <span className="text-right">{lastGood ? `${dt(lastGood.created_at)} · ${lastGood.source}` : "Never"}</span></li>
            </ul>
            <ActionForm action={updateRatesNow} submitLabel="Update rates now" variant="rose">
              <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="force" className="size-4 accent-[#d94f91]" /> Accept changes larger than 25% (only after a real market move)</label>
            </ActionForm>
          </div>
        </div>
        {log.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Recent updates</p>
            <ul className="mt-2 divide-y divide-line text-xs">
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                  <Badge tone={l.ok ? "success" : "danger"}>{l.ok ? "OK" : "Failed"}</Badge>
                  <span className="text-muted">{dt(l.created_at)}</span>
                  <span className="min-w-0 flex-1 break-words">{l.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Payments" description="What customers are actually charged in, and which Paystack methods are offered by country.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="text-sm">
            <p className="font-semibold">Payment currency: NGN (₦)</p>
            <p className="mt-1 text-muted">
              Every order is charged in Nigerian naira, whatever currency a customer browses in. Checkout always shows the exact NGN amount before payment, and orders keep both
              the NGN amount charged and the estimate the customer saw. Charging in other currencies requires Paystack to approve them on your account, plus a code change — it is not switched on.
            </p>
          </div>
          <ActionForm action={savePaymentChannels} submitLabel="Save payment methods">
            <Field label="Payment methods by country" hint={`One line per country code, plus a "default" line. Allowed: ${PAYSTACK_CHANNELS.join(", ")}. Paystack only shows methods your account supports.`}>
              <textarea name="channels" rows={5} defaultValue={channelText} className={`${inputCls} font-mono`} />
            </Field>
          </ActionForm>
        </div>
      </Card>

      <Card title="Preview the store" description="Opens the storefront in this browser with these choices (only your own preferences change).">
        <form action={previewStore} className="flex flex-wrap items-end gap-3">
          <Field label="Language">
            <select name="locale" defaultValue="fr" className={inputCls}>
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Country">
            <select name="country" defaultValue={intl.default_country} className={inputCls}>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue="USD" className={inputCls}>
              {currencies.filter((c) => c.is_enabled).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </Field>
          <button type="submit" className="h-10 rounded-full bg-plum px-5 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-rose-deep">Open preview</button>
        </form>
      </Card>

      <Card title="Interface text & translations" description="Search any customer-facing text and replace the built-in wording for a language. Leave a box empty to go back to the built-in translation.">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="ct" value={ct} />
          <input type="hidden" name="cl" value={cl} />
          <input type="hidden" name="cq" value={cq} />
          <Field label="Language">
            <select name="tl" defaultValue={tl} className={inputCls}>
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Search text" className="min-w-[14rem] flex-1">
            <input name="tq" defaultValue={one(sp.tq)} placeholder="e.g. checkout, delivery, cart.bag" className={inputCls} />
          </Field>
          <button type="submit" className="h-10 rounded-full border border-line px-5 text-xs font-bold uppercase tracking-[0.14em] hover:border-plum">Search</button>
        </form>
        <p className="mt-3 text-xs text-muted">
          {tq ? `${matches.length} match${matches.length === 1 ? "" : "es"}${matches.length > 40 ? " — showing the first 40" : ""}.` : "Showing custom text and the announcement banner. Search to find anything else."}
          {" "}The key <code>store.announcement</code> translates the moving top banner for this language.
        </p>
        {matches.length === 0 ? (
          <div className="mt-4"><Empty>No text found.</Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {matches.slice(0, 40).map((key) => {
              const english = ENGLISH.get(key)!;
              const bundled = BUNDLED[tl].get(key) ?? "";
              const custom = overrides.get(key);
              return (
                <li key={key} className="grid gap-3 py-4 lg:grid-cols-[1fr_1.3fr]">
                  <div className="min-w-0 text-sm">
                    <code className="text-[0.7rem] text-muted">{key}</code>
                    <p className="mt-1 break-words">{english || <span className="text-muted">(empty — uses the banner text from Homepage settings)</span>}</p>
                    {tl !== "en" && bundled && bundled !== english && <p className="mt-1 break-words text-xs text-muted" lang={tl} dir={tl === "ar" ? "rtl" : "ltr"}>Built-in: {bundled}</p>}
                    {custom && <Badge tone="rose">Custom</Badge>}
                  </div>
                  <ActionForm action={saveTranslationOverride} submitLabel="Save text" variant="outline">
                    <input type="hidden" name="locale" value={tl} />
                    <input type="hidden" name="key" value={key} />
                    <textarea name="value" rows={2} defaultValue={custom ?? ""} placeholder={bundled || english} lang={tl} dir={tl === "ar" ? "rtl" : "ltr"} className={inputCls} aria-label={`${key} in ${tl}`} />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Placeholders in braces like {"{name}"} and tags like {"<link>…</link>"} must be kept exactly as in English.</p>
      </Card>

      <Card title="Product, category & collection translations" description="Names and descriptions per language. Anything left blank shows in English.">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tl" value={tl} />
          <input type="hidden" name="tq" value={one(sp.tq)} />
          <Field label="Type">
            <select name="ct" defaultValue={ct} className={inputCls}>
              <option value="products">Products</option>
              <option value="categories">Categories</option>
              <option value="collections">Collections</option>
            </select>
          </Field>
          <Field label="Language">
            <select name="cl" defaultValue={cl} className={inputCls}>
              {LOCALES.filter((l) => l.code !== "en").map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Search by English name" className="min-w-[14rem] flex-1">
            <input name="cq" defaultValue={cq} className={inputCls} />
          </Field>
          <button type="submit" className="h-10 rounded-full border border-line px-5 text-xs font-bold uppercase tracking-[0.14em] hover:border-plum">Show</button>
        </form>
        {items.length === 0 ? (
          <div className="mt-4"><Empty>Nothing found.</Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {items.map((item) => {
              const t = item.translations?.[cl] ?? {};
              const dir = cl === "ar" ? "rtl" : "ltr";
              return (
                <li key={item.id} className="py-4">
                  <p className="text-sm font-semibold">{item.name} {Object.keys(t).length > 0 && <Badge tone="success">Translated</Badge>}</p>
                  <ActionForm action={saveCatalogTranslation} submitLabel="Save translation" variant="outline">
                    <input type="hidden" name="table" value={ct} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="locale" value={cl} />
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <Field label="Name"><input name="name" defaultValue={t.name ?? ""} placeholder={item.name} lang={cl} dir={dir} className={inputCls} /></Field>
                      {ct === "categories" && <Field label="Short menu name"><input name="short_name" defaultValue={t.short_name ?? ""} lang={cl} dir={dir} className={inputCls} /></Field>}
                      <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={2} defaultValue={t.description ?? ""} placeholder={item.description ?? ""} lang={cl} dir={dir} className={inputCls} /></Field>
                      {ct === "products" && <Field label="Details & care" className="sm:col-span-2"><textarea name="details" rows={2} defaultValue={t.details ?? ""} placeholder={item.details ?? ""} lang={cl} dir={dir} className={inputCls} /></Field>}
                    </div>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted"><Link href={qs({ cq: "" })} className="underline">Clear search</Link> · Showing up to 15 items.</p>
      </Card>
    </div>
  );
}
