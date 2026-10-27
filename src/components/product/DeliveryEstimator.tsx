"use client";
import { useState, useTransition } from "react";
import { estimateProductShipping } from "@/app/actions/shipping";
import { formatMoney } from "@/lib/money";
import { formatDeliveryWindow, type ShippingQuote } from "@/lib/shipping/calculator";

export interface DestinationOptions {
  countries: { code: string; name: string; region_label: string }[];
  regions: Record<string, { code: string; name: string }[]>;
}

export function DeliveryEstimator({ slug, destinations }: { slug: string; destinations: DestinationOptions }) {
  const [country, setCountry] = useState(destinations.countries[0]?.code ?? "NG");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [pending, start] = useTransition();
  if (destinations.countries.length === 0) return null;
  const regions = destinations.regions[country] ?? [];
  const label = destinations.countries.find((c) => c.code === country)?.region_label ?? "Region";

  return (
    <details className="group border-b border-line py-5">
      <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
        Estimate delivery
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
          Country
          <select className="field mt-1" value={country} onChange={(e) => { setCountry(e.target.value); setRegion(""); setQuote(null); }}>
            {destinations.countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          {label}
          {regions.length ? (
            <select className="field mt-1" value={region} onChange={(e) => setRegion(e.target.value)} required>
              <option value="">Select…</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          ) : (
            <input className="field mt-1" value={region} onChange={(e) => setRegion(e.target.value)} />
          )}
        </label>
        <label className="text-xs text-muted">
          City / town
          <input className="field mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <button type="submit" disabled={pending} className="h-11 bg-plum text-[0.68rem] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-rose-deep disabled:opacity-60 sm:col-span-2">
          {pending ? "Checking…" : "Check delivery"}
        </button>
      </form>
      <div aria-live="polite">
        {quote && !quote.ok && <p className="mt-3 text-sm text-danger">{quote.message}</p>}
        {quote && quote.ok && (
          <ul className="mt-4 space-y-2 text-sm">
            {quote.options.map((o) => (
              <li key={o.rateId} className="flex justify-between gap-3 bg-neutral px-3 py-2.5">
                <span>
                  {o.methodName}
                  {formatDeliveryWindow(o.minDays, o.maxDays) && <span className="block text-xs text-muted">{formatDeliveryWindow(o.minDays, o.maxDays)}</span>}
                </span>
                <span className="font-semibold tabular-nums">{o.fee === 0 ? "Free" : formatMoney(o.fee)}</span>
              </li>
            ))}
            <li className="text-xs text-muted">For this item alone. Your final fee is confirmed at checkout.</li>
          </ul>
        )}
      </div>
    </details>
  );
}
