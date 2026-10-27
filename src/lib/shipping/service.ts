import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  calculateShipping,
  type CountryConfig,
  type RegionRecord,
  type ShippingAddressInput,
  type ShippingQuote,
  type ShippingZoneRecord,
} from "./calculator";

/** Loads the active shipping configuration for one destination country. */
export async function loadShippingConfig(countryCode: string): Promise<{
  country: CountryConfig | null;
  regions: RegionRecord[];
  zones: ShippingZoneRecord[];
}> {
  const db = createServiceClient();
  const code = countryCode.toUpperCase();
  const [countryRes, regionsRes, locsRes] = await Promise.all([
    db.from("countries").select("code, name, is_enabled, region_label, region_required, postal_label, postal_required").eq("code", code).maybeSingle(),
    db.from("regions").select("code, name").eq("country_code", code).order("name"),
    db.from("shipping_zone_locations").select("zone_id, country_code, region_code, city").eq("country_code", code),
  ]);
  if (countryRes.error) throw countryRes.error;
  const zoneIds = [...new Set((locsRes.data ?? []).map((l) => l.zone_id as string))];
  if (zoneIds.length === 0) return { country: countryRes.data, regions: regionsRes.data ?? [], zones: [] };

  const { data: zones, error } = await db
    .from("shipping_zones")
    .select(
      `id, name, priority, is_active,
       shipping_rates ( id, rate_type, fee, currency, min_days, max_days, free_shipping_threshold, is_active, is_manual,
         shipping_methods ( id, name, description, is_active, sort_order ),
         shipping_rate_tiers ( min_value, max_value, fee ) )`,
    )
    .in("id", zoneIds)
    .eq("is_active", true);
  if (error) throw error;

  type RateRow = {
    id: string; rate_type: "flat" | "weight_based" | "order_value_based"; fee: number; currency: string;
    min_days: number | null; max_days: number | null; free_shipping_threshold: number | null;
    is_active: boolean; is_manual: boolean;
    shipping_methods: { id: string; name: string; description: string | null; is_active: boolean; sort_order: number } | null;
    shipping_rate_tiers: { min_value: number; max_value: number | null; fee: number }[];
  };

  const records: ShippingZoneRecord[] = (zones ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    priority: z.priority,
    locations: (locsRes.data ?? [])
      .filter((l) => l.zone_id === z.id)
      .map((l) => ({ country_code: l.country_code, region_code: l.region_code, city: l.city })),
    rates: ((z.shipping_rates ?? []) as unknown as RateRow[])
      .filter((r) => r.is_active && r.shipping_methods?.is_active)
      .map((r) => ({
        id: r.id,
        method_id: r.shipping_methods!.id,
        method_name: r.shipping_methods!.name,
        method_description: r.shipping_methods!.description,
        method_sort: r.shipping_methods!.sort_order,
        rate_type: r.rate_type,
        fee: r.fee,
        currency: r.currency,
        min_days: r.min_days,
        max_days: r.max_days,
        free_shipping_threshold: r.free_shipping_threshold,
        is_manual: r.is_manual,
        tiers: r.shipping_rate_tiers ?? [],
      })),
  }));
  return { country: countryRes.data, regions: regionsRes.data ?? [], zones: records };
}

export async function quoteShipping(
  address: ShippingAddressInput,
  cart: { subtotalAfterDiscount: number; weightGrams: number },
  storeCurrency: string,
): Promise<ShippingQuote> {
  const config = await loadShippingConfig(address.country_code);
  return calculateShipping({ address, ...config, cart, storeCurrency });
}

export async function listEnabledCountries() {
  const { data } = await createServiceClient()
    .from("countries")
    .select("code, name, region_label, region_required, postal_label, postal_required")
    .eq("is_enabled", true)
    .order("sort_order")
    .order("name");
  return data ?? [];
}

export async function listRegionsByCountry(codes: string[]) {
  if (codes.length === 0) return {} as Record<string, RegionRecord[]>;
  const { data } = await createServiceClient().from("regions").select("country_code, code, name").in("country_code", codes).order("name");
  const out: Record<string, RegionRecord[]> = {};
  for (const r of data ?? []) (out[r.country_code] ??= []).push({ code: r.code, name: r.name });
  return out;
}
