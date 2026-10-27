import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, toMajorString } from "@/lib/money";
import { formatDeliveryWindow } from "@/lib/shipping/calculator";
import {
  addTier, addZoneLocation, deleteMethod, deleteRate, deleteTier, deleteZone, enableCountry, removeZoneLocation, saveCountry, saveMethod, saveRate, saveZone, testQuote,
} from "@/app/admin/actions/shipping";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Shipping" };

type Country = { code: string; name: string; is_enabled: boolean; region_label: string; region_required: boolean; postal_label: string; postal_required: boolean };
type Method = { id: string; name: string; description: string | null; is_active: boolean; sort_order: number };
type Tier = { id: string; min_value: number; max_value: number | null; fee: number };
type Rate = { id: string; method_id: string; rate_type: "flat" | "weight_based" | "order_value_based"; fee: number; min_days: number | null; max_days: number | null; free_shipping_threshold: number | null; is_active: boolean; needs_review: boolean; notes: string | null; shipping_rate_tiers: Tier[] };
type Zone = { id: string; name: string; description: string | null; priority: number; is_active: boolean; shipping_zone_locations: { id: string; country_code: string; region_code: string | null; city: string | null }[]; shipping_rates: Rate[] };

function RateFields({ zoneId, methods, rate }: { zoneId: string; methods: Method[]; rate?: Rate }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {rate && <input type="hidden" name="id" value={rate.id} />}
      <input type="hidden" name="zone_id" value={zoneId} />
      <Field label="Delivery method">
        <select name="method_id" defaultValue={rate?.method_id} className={inputCls} required>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}{m.is_active ? "" : " (inactive)"}</option>)}
        </select>
      </Field>
      <Field label="Rate type">
        <select name="rate_type" defaultValue={rate?.rate_type ?? "flat"} className={inputCls}>
          <option value="flat">Flat fee</option><option value="weight_based">By weight (tiers)</option><option value="order_value_based">By order value (tiers)</option>
        </select>
      </Field>
      <Field label="Fee (₦)" hint="Flat fee. Tiered rates use the tiers below."><input name="fee" inputMode="decimal" required defaultValue={toMajorString(rate?.fee ?? 0)} className={inputCls} /></Field>
      <Field label="Free delivery from (₦)" hint="Optional order-value threshold"><input name="free_shipping_threshold" inputMode="decimal" defaultValue={toMajorString(rate?.free_shipping_threshold)} className={inputCls} /></Field>
      <Field label="Estimate: min days"><input name="min_days" type="number" min={0} defaultValue={rate?.min_days ?? ""} className={inputCls} /></Field>
      <Field label="Estimate: max days"><input name="max_days" type="number" min={0} defaultValue={rate?.max_days ?? ""} className={inputCls} /></Field>
      <Field label="Internal note" className="sm:col-span-2"><input name="notes" defaultValue={rate?.notes ?? ""} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={rate?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Active</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmed" defaultChecked={rate ? !rate.needs_review : false} className="size-4 accent-[#d94f91]" /> Price confirmed by me</label>
    </div>
  );
}

export default async function ShippingAdmin() {
  await requireStaffPage("shipping:write");
  const db = await createClient();
  const [{ data: countries }, { data: regions }, { data: methods }, { data: zones }] = await Promise.all([
    db.from("countries").select("*").order("sort_order").order("name"),
    db.from("regions").select("country_code, code, name").order("name"),
    db.from("shipping_methods").select("*").order("sort_order"),
    db.from("shipping_zones").select("*, shipping_zone_locations ( id, country_code, region_code, city ), shipping_rates ( *, shipping_rate_tiers ( id, min_value, max_value, fee ) )").order("priority", { ascending: false }),
  ]);
  const all = (countries ?? []) as Country[];
  const enabled = all.filter((c) => c.is_enabled);
  const disabled = all.filter((c) => !c.is_enabled);
  const ms = (methods ?? []) as Method[];
  const zs = (zones ?? []) as Zone[];
  const regionName = (cc: string, code: string | null) => (code ? (regions ?? []).find((r) => r.country_code === cc && r.code === code)?.name ?? code : null);
  const countryName = (cc: string) => all.find((c) => c.code === cc)?.name ?? cc;
  const unreviewed = zs.flatMap((z) => z.shipping_rates).filter((r) => r.is_active && r.needs_review).length;
  const coveredCountries = new Set(zs.filter((z) => z.is_active && z.shipping_rates.some((r) => r.is_active)).flatMap((z) => z.shipping_zone_locations.map((l) => l.country_code)));

  return (
    <div className="space-y-6">
      <PageHeader title="Shipping" description="All delivery fees come from these settings and are recalculated on the server at checkout. These are manual rates, not live courier quotes." />
      {unreviewed > 0 && (
        <Notice tone="warning" title={`${unreviewed} active rate(s) still need review`}>
          The seeded ₦2,500 same-city and ₦4,000 Nigeria rates are development defaults — sample values, not verified courier prices. Set the same-city zone to your real dispatch city, confirm each price, then tick “Price confirmed by me”.
        </Notice>
      )}
      <Notice tone="info">
        A destination is only deliverable when its country is enabled AND an active zone with an active rate matches it. Otherwise customers see “delivery unavailable” and can&apos;t check out — the store never silently charges ₦0. No international rates are configured by default.
      </Notice>

      <Card title="Test the calculator" description="Runs the exact checkout calculation against your saved settings.">
        <ActionForm action={testQuote} submitLabel="Calculate">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Country"><select name="country_code" defaultValue="NG" className={inputCls}>{all.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
            <Field label="State / region" hint="Code (e.g. LA) or name"><input name="region" defaultValue="LA" className={inputCls} /></Field>
            <Field label="City"><input name="city" defaultValue="Lagos" className={inputCls} /></Field>
            <Field label="Postcode"><input name="postal_code" className={inputCls} /></Field>
            <Field label="Order value (₦)"><input name="subtotal" defaultValue="30000" className={inputCls} /></Field>
            <Field label="Weight (g)"><input name="weight" type="number" defaultValue={1000} className={inputCls} /></Field>
          </div>
        </ActionForm>
      </Card>

      <Card title="Destination countries" description="Only enabled countries appear at checkout.">
        <ul className="divide-y divide-line">
          {enabled.map((c) => (
            <li key={c.code} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold">{c.name}</span>
                  {coveredCountries.has(c.code) ? <Badge tone="success">Has rates</Badge> : <Badge tone="danger">No rates — checkout unavailable</Badge>}
                </summary>
                <ActionForm action={saveCountry}>
                  <input type="hidden" name="code" value={c.code} />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Region label"><input name="region_label" defaultValue={c.region_label} className={inputCls} /></Field>
                    <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="region_required" defaultChecked={c.region_required} className="size-4 accent-[#d94f91]" /> Region required</label>
                    <Field label="Postcode label"><input name="postal_label" defaultValue={c.postal_label} className={inputCls} /></Field>
                    <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="postal_required" defaultChecked={c.postal_required} className="size-4 accent-[#d94f91]" /> Postcode required</label>
                    <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_enabled" defaultChecked className="size-4 accent-[#d94f91]" /> Enabled (untick to disable)</label>
                  </div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
        <ActionForm action={enableCountry} submitLabel="Enable country">
          <Field label="Enable another country" className="mt-4 max-w-sm">
            <select name="code" className={inputCls}>{disabled.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          </Field>
        </ActionForm>
      </Card>

      <Card title="Delivery methods">
        <div className="space-y-3">
          {ms.map((m) => (
            <div key={m.id} className="border border-line p-3">
              <ActionForm action={saveMethod}>
                <input type="hidden" name="id" value={m.id} />
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem_auto]">
                  <Field label="Name"><input name="name" defaultValue={m.name} className={inputCls} /></Field>
                  <Field label="Description"><input name="description" defaultValue={m.description ?? ""} className={inputCls} /></Field>
                  <Field label="Order"><input name="sort_order" type="number" defaultValue={m.sort_order} className={inputCls} /></Field>
                  <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={m.is_active} className="size-4 accent-[#d94f91]" /> Active</label>
                </div>
              </ActionForm>
              <ActionForm action={deleteMethod} submitLabel="Delete method" variant="ghost" confirm="Delete this method? It must not be used by any rate."><input type="hidden" name="id" value={m.id} /></ActionForm>
            </div>
          ))}
        </div>
        <ActionForm action={saveMethod} submitLabel="Add method" resetOnSuccess className="mt-4 bg-neutral p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem_auto]">
            <Field label="Name"><input name="name" required className={inputCls} placeholder="e.g. Express delivery" /></Field>
            <Field label="Description"><input name="description" className={inputCls} /></Field>
            <Field label="Order"><input name="sort_order" type="number" defaultValue={ms.length + 1} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked className="size-4 accent-[#d94f91]" /> Active</label>
          </div>
        </ActionForm>
      </Card>

      {zs.map((z) => (
        <Card key={z.id} title={z.name} description={z.description ?? undefined} actions={<div className="flex gap-2"><Badge>Priority {z.priority}</Badge>{!z.is_active && <Badge tone="warning">Inactive</Badge>}</div>}>
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-muted">Edit zone</summary>
            <ActionForm action={saveZone}>
              <input type="hidden" name="id" value={z.id} />
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_7rem_auto]">
                <Field label="Name"><input name="name" defaultValue={z.name} className={inputCls} /></Field>
                <Field label="Description"><input name="description" defaultValue={z.description ?? ""} className={inputCls} /></Field>
                <Field label="Priority" hint="Tie-breaker"><input name="priority" type="number" defaultValue={z.priority} className={inputCls} /></Field>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={z.is_active} className="size-4 accent-[#d94f91]" /> Active</label>
              </div>
            </ActionForm>
            <ActionForm action={deleteZone} submitLabel="Delete zone" variant="ghost" confirm="Delete this zone and its rates?"><input type="hidden" name="id" value={z.id} /></ActionForm>
          </details>

          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Covers</h3>
          <p className="mt-1 text-xs text-muted">The most specific match wins: city &gt; state/region &gt; whole country.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {z.shipping_zone_locations.map((l) => (
              <li key={l.id} className="flex items-center gap-1 border border-line bg-neutral px-2 py-1 text-xs">
                {[l.city, regionName(l.country_code, l.region_code), countryName(l.country_code)].filter(Boolean).join(", ")}
                {!l.region_code && " (whole country)"}
                <ActionForm action={removeZoneLocation} submitLabel="×" variant="ghost" inline><input type="hidden" name="id" value={l.id} /></ActionForm>
              </li>
            ))}
            {z.shipping_zone_locations.length === 0 && <li className="text-xs text-danger">No locations — this zone matches nothing.</li>}
          </ul>
          <ActionForm action={addZoneLocation} submitLabel="Add location" resetOnSuccess className="mt-3 bg-neutral p-3">
            <input type="hidden" name="zone_id" value={z.id} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Country"><select name="country_code" defaultValue="NG" className={inputCls}>{all.map((c) => <option key={c.code} value={c.code}>{c.name}{c.is_enabled ? "" : " (disabled)"}</option>)}</select></Field>
              <Field label="State / region code" hint="Blank = whole country. Nigeria: LA, FC, RI, KN…"><input name="region_code" list="region-codes" className={inputCls} /></Field>
              <Field label="City" hint="Optional. Exact name, e.g. Lagos, Ikeja"><input name="city" className={inputCls} /></Field>
            </div>
          </ActionForm>

          <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-muted">Rates</h3>
          <div className="mt-2 space-y-3">
            {z.shipping_rates.map((r) => {
              const m = ms.find((x) => x.id === r.method_id);
              const unit = r.rate_type === "weight_based" ? "g" : "₦";
              return (
                <div key={r.id} className="border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{m?.name}</span>
                    <span>{r.rate_type === "flat" ? formatMoney(r.fee) : `${r.rate_type === "weight_based" ? "by weight" : "by order value"}`}</span>
                    {formatDeliveryWindow(r.min_days, r.max_days) && <span className="text-xs text-muted">{formatDeliveryWindow(r.min_days, r.max_days)}</span>}
                    {r.needs_review ? <Badge tone="warning">Needs review</Badge> : <Badge tone="success">Confirmed</Badge>}
                    {!r.is_active && <Badge>Inactive</Badge>}
                    <Badge>Manual rate</Badge>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">Edit rate</summary>
                    <ActionForm action={saveRate}><div className="mt-3"><RateFields zoneId={z.id} methods={ms} rate={r} /></div></ActionForm>
                    <ActionForm action={deleteRate} submitLabel="Delete rate" variant="ghost" confirm="Delete this rate?"><input type="hidden" name="id" value={r.id} /></ActionForm>
                  </details>
                  {r.rate_type !== "flat" && (
                    <div className="mt-3 bg-neutral p-3">
                      <p className="text-xs font-semibold">Tiers ({r.rate_type === "weight_based" ? "grams" : "order value, ₦"}) — a cart outside every tier gets no option from this rate.</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {[...r.shipping_rate_tiers].sort((a, b) => a.min_value - b.min_value).map((t) => (
                          <li key={t.id} className="flex items-center gap-2">
                            {unit === "g" ? `${t.min_value}g` : formatMoney(t.min_value)} – {t.max_value == null ? "and above" : unit === "g" ? `${t.max_value}g` : formatMoney(t.max_value)}: <strong>{formatMoney(t.fee)}</strong>
                            <ActionForm action={deleteTier} submitLabel="×" variant="ghost" inline><input type="hidden" name="id" value={t.id} /></ActionForm>
                          </li>
                        ))}
                      </ul>
                      <ActionForm action={addTier} submitLabel="Add tier" resetOnSuccess>
                        <input type="hidden" name="rate_id" value={r.id} />
                        <input type="hidden" name="kind" value={r.rate_type} />
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <Field label={`From (${unit})`}><input name="min_value" className={inputCls} defaultValue="0" /></Field>
                          <Field label={`Up to (${unit}, blank = no limit)`}><input name="max_value" className={inputCls} /></Field>
                          <Field label="Fee (₦)"><input name="fee" required className={inputCls} /></Field>
                        </div>
                      </ActionForm>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {ms.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">+ Add a rate to this zone</summary>
              <ActionForm action={saveRate} submitLabel="Add rate" className="mt-3 bg-neutral p-3"><RateFields zoneId={z.id} methods={ms} /></ActionForm>
            </details>
          )}
        </Card>
      ))}

      <Card title="Add shipping zone" description="e.g. “Abuja & environs”, “West Africa”, “United Kingdom”. Add locations and a verified rate after creating it.">
        <ActionForm action={saveZone} submitLabel="Create zone" resetOnSuccess>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_7rem_auto]">
            <Field label="Name"><input name="name" required className={inputCls} /></Field>
            <Field label="Description"><input name="description" className={inputCls} /></Field>
            <Field label="Priority"><input name="priority" type="number" defaultValue={0} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked className="size-4 accent-[#d94f91]" /> Active</label>
          </div>
        </ActionForm>
      </Card>
      <datalist id="region-codes">
        {(regions ?? []).map((r) => <option key={`${r.country_code}-${r.code}`} value={r.code}>{`${r.name} (${r.country_code})`}</option>)}
      </datalist>
    </div>
  );
}
