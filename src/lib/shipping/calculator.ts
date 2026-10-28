// Pure shipping calculation. Rates come from the database (admin-managed);
// nothing here is hardcoded. Missing configuration => delivery unavailable,
// never a silent zero fee.

export interface CountryConfig {
  code: string;
  name: string;
  is_enabled: boolean;
  region_label: string;
  region_required: boolean;
  postal_label: string;
  postal_required: boolean;
}

export interface RegionRecord {
  code: string;
  name: string;
}

export interface ZoneLocation {
  country_code: string;
  region_code: string | null;
  city: string | null;
}

export interface RateTier {
  min_value: number;
  max_value: number | null;
  fee: number;
}

export interface ShippingRateRecord {
  id: string;
  method_id: string;
  method_name: string;
  method_description: string | null;
  method_sort: number;
  rate_type: "flat" | "weight_based" | "order_value_based";
  fee: number;
  currency: string;
  min_days: number | null;
  max_days: number | null;
  free_shipping_threshold: number | null;
  is_manual: boolean;
  tiers: RateTier[];
}

export interface ShippingZoneRecord {
  id: string;
  name: string;
  priority: number;
  locations: ZoneLocation[];
  rates: ShippingRateRecord[];
}

export interface ShippingAddressInput {
  country_code: string;
  region: string; // region code (for countries with a list) or free text
  city: string;
  postal_code?: string | null;
}

export interface ShippingOption {
  rateId: string;
  methodName: string;
  description: string | null;
  fee: number;
  originalFee: number;
  freeShippingApplied: boolean;
  currency: string;
  minDays: number | null;
  maxDays: number | null;
  isManual: boolean;
  zoneName: string;
}

export type ShippingQuote =
  | { ok: true; zoneName: string; options: ShippingOption[] }
  | { ok: false; code: ShippingErrorCode; message: string; field?: AddressField; label?: string };

/** Which address field an invalid_address error is about (lets the UI translate the message). */
export type AddressField = "city" | "region_invalid" | "region_missing" | "postal_missing";

export type ShippingErrorCode =
  | "country_unsupported"
  | "invalid_address"
  | "no_zone"
  | "no_rates";

export function normalizePlace(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function validateAddressForCountry(
  address: ShippingAddressInput,
  country: CountryConfig | null,
  regions: RegionRecord[],
): { ok: true; regionCode: string | null } | { ok: false; code: ShippingErrorCode; message: string; field?: AddressField; label?: string } {
  if (!country || !country.is_enabled) {
    return {
      ok: false,
      code: "country_unsupported",
      message: "Sorry — we don't currently deliver to this country, so checkout isn't available for this address.",
    };
  }
  if (!normalizePlace(address.city)) {
    return { ok: false, code: "invalid_address", field: "city", message: "Please enter your city or town." };
  }
  let regionCode: string | null = null;
  if (regions.length > 0) {
    const wanted = normalizePlace(address.region);
    const match = regions.find((r) => normalizePlace(r.code) === wanted || normalizePlace(r.name) === wanted);
    if (!match) {
      return { ok: false, code: "invalid_address", field: "region_invalid", label: country.region_label, message: `Please choose a valid ${country.region_label.toLowerCase()}.` };
    }
    regionCode = match.code;
  } else if (country.region_required && !normalizePlace(address.region)) {
    return { ok: false, code: "invalid_address", field: "region_missing", label: country.region_label, message: `Please enter your ${country.region_label.toLowerCase()}.` };
  }
  if (country.postal_required && !(address.postal_code ?? "").trim()) {
    return { ok: false, code: "invalid_address", field: "postal_missing", label: country.postal_label, message: `Please enter your ${country.postal_label.toLowerCase()}.` };
  }
  return { ok: true, regionCode };
}

/** Specificity of a location match: 3 = city, 2 = region, 1 = country, 0 = no match. */
export function matchSpecificity(
  loc: ZoneLocation,
  address: ShippingAddressInput,
  regionCode: string | null,
): number {
  if (loc.country_code.toUpperCase() !== address.country_code.toUpperCase()) return 0;
  if (loc.region_code) {
    const regionMatches =
      (regionCode && loc.region_code.toUpperCase() === regionCode.toUpperCase()) ||
      normalizePlace(loc.region_code) === normalizePlace(address.region);
    if (!regionMatches) return 0;
    if (loc.city) return normalizePlace(loc.city) === normalizePlace(address.city) ? 3 : 0;
    return 2;
  }
  return 1;
}

export function selectZone(
  zones: ShippingZoneRecord[],
  address: ShippingAddressInput,
  regionCode: string | null,
): ShippingZoneRecord | null {
  let best: { zone: ShippingZoneRecord; score: number } | null = null;
  for (const zone of zones) {
    const score = Math.max(0, ...zone.locations.map((l) => matchSpecificity(l, address, regionCode)));
    if (score === 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && zone.priority > best.zone.priority)
    ) {
      best = { zone, score };
    }
  }
  return best?.zone ?? null;
}

/** Returns the fee for a rate, or null if the rate does not apply to this cart. */
export function feeForRate(rate: ShippingRateRecord, cart: { subtotalAfterDiscount: number; weightGrams: number }): number | null {
  if (rate.rate_type === "flat") return rate.fee;
  const measure = rate.rate_type === "weight_based" ? cart.weightGrams : cart.subtotalAfterDiscount;
  const tier = [...rate.tiers]
    .sort((a, b) => a.min_value - b.min_value)
    .find((t) => measure >= t.min_value && (t.max_value == null || measure < t.max_value));
  return tier ? tier.fee : null;
}

export function calculateShipping(input: {
  address: ShippingAddressInput;
  country: CountryConfig | null;
  regions: RegionRecord[];
  zones: ShippingZoneRecord[];
  cart: { subtotalAfterDiscount: number; weightGrams: number };
  storeCurrency: string;
}): ShippingQuote {
  const valid = validateAddressForCountry(input.address, input.country, input.regions);
  if (!valid.ok) return valid;

  const zone = selectZone(input.zones, input.address, valid.regionCode);
  if (!zone) {
    return {
      ok: false,
      code: "no_zone",
      message:
        "Delivery to this location isn't available yet. Please try another address or contact us for help.",
    };
  }

  const options: ShippingOption[] = [];
  for (const rate of zone.rates) {
    if (rate.currency !== input.storeCurrency) continue; // no silent currency conversion
    const base = feeForRate(rate, input.cart);
    if (base == null) continue;
    const free =
      rate.free_shipping_threshold != null && input.cart.subtotalAfterDiscount >= rate.free_shipping_threshold;
    options.push({
      rateId: rate.id,
      methodName: rate.method_name,
      description: rate.method_description,
      fee: free ? 0 : base,
      originalFee: base,
      freeShippingApplied: free,
      currency: rate.currency,
      minDays: rate.min_days,
      maxDays: rate.max_days,
      isManual: rate.is_manual,
      zoneName: zone.name,
    });
  }

  if (options.length === 0) {
    return {
      ok: false,
      code: "no_rates",
      message:
        "We don't have a delivery rate set up for this location yet, so we can't take this order. Please contact us and we'll help.",
    };
  }

  const sortIndex = new Map(zone.rates.map((r) => [r.id, r.method_sort]));
  options.sort((a, b) => (sortIndex.get(a.rateId) ?? 0) - (sortIndex.get(b.rateId) ?? 0) || a.fee - b.fee);
  return { ok: true, zoneName: zone.name, options };
}

export function formatDeliveryWindow(minDays: number | null, maxDays: number | null): string | null {
  if (minDays == null && maxDays == null) return null;
  if (minDays != null && maxDays != null) {
    return minDays === maxDays ? `${minDays} business day${minDays === 1 ? "" : "s"}` : `${minDays}–${maxDays} business days`;
  }
  const d = (minDays ?? maxDays)!;
  return minDays != null ? `From ${d} business days` : `Up to ${d} business days`;
}
