"use client";
import { useState, useTransition } from "react";
import { estimateProductShipping } from "@/app/actions/shipping";
import { useTranslations } from "next-intl";
import type { ShippingQuote } from "@/lib/shipping/calculator";
import { useMoney, usePreferences } from "@/components/intl/PreferencesProvider";
import { useShippingText } from "@/components/intl/useShippingText";
import { regionName } from "@/components/intl/PreferencesDialog";

export interface DestinationOptions {
  countries: { code: string; name: string; region_label: string }[];
  regions: Record<string, { code: string; name: string }[]>;
}

export function DeliveryEstimator({ slug, destinations }: { slug: string; destinations: DestinationOptions }) {
  const prefs = usePreferences();
  const t = useTranslations("shipping");
  const st = useShippingText();
  const { format: formatMoney } = useMoney();
  // Start with the shopper's chosen country when we deliver there.
  const [country, setCountry] = useState(destinations.countries.find((c) => c.code === prefs?.country)?.code ?? destinations.countries[0]?.code ?? "NG");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [pending, start] = useTransition();
  if (destinations.countries.length === 0) return null;
  const regions = destinations.regions[country] ?? [];
  const label = st.label(destinations.countries.find((c) => c.code === country)?.region_label ?? "Region");
  const locale = prefs?.locale ?? "en";

  return (
    <details className="group border-b border-line py-5">
      <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
        {t("estimate")}
        <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
      </summary>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setQuote(await estimateProductShipping(slug, { country_code: country, region, city })));
        }}
      >
        <label className="text-xs text-muted sm:col-span-2">
          {t("country")}
          <select className="field mt-1" value={country} onChange={(e) => { setCountry(e.target.value); setRegion(""); setQuote(null); }}>
            {destinations.countries.map((c) => (
              <option key={c.code} value={c.code}>{regionName(c.code, locale)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          {label}
          {regions.length ? (
            <select className="field mt-1" value={region} onChange={(e) => setRegion(e.target.value)} required>
              <option value="">{t("select")}</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          ) : (
            <input className="field mt-1" value={region} onChange={(e) => setRegion(e.target.value)} />
          )}
        </label>
        <label className="text-xs text-muted">
          {t("city")}
          <input className="field mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <button type="submit" disabled={pending} className="h-11 bg-plum text-[0.68rem] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-rose-deep disabled:opacity-60 sm:col-span-2">
          {pending ? t("checking") : t("check")}
        </button>
      </form>
      <div aria-live="polite">
        {quote && !quote.ok && <p className="mt-3 text-sm text-danger">{st.error(quote)}</p>}
        {quote && quote.ok && (
          <ul className="mt-4 space-y-2 text-sm">
            {quote.options.map((o) => (
              <li key={o.rateId} className="flex justify-between gap-3 bg-neutral px-3 py-2.5">
                <span>
                  {st.method(o.methodName)}
                  {st.window(o.minDays, o.maxDays) && <span className="block text-xs text-muted">{st.window(o.minDays, o.maxDays)}</span>}
                </span>
                <span className="font-semibold tabular-nums">{o.fee === 0 ? t("free") : formatMoney(o.fee)}</span>
              </li>
            ))}
            <li className="text-xs text-muted">{t("itemOnly")}</li>
          </ul>
        )}
      </div>
    </details>
  );
}
