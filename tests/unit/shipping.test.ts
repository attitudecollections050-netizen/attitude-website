import { describe, expect, it } from "vitest";
import {
  calculateShipping,
  formatDeliveryWindow,
  type CountryConfig,
  type ShippingRateRecord,
  type ShippingZoneRecord,
} from "@/lib/shipping/calculator";

const NG: CountryConfig = { code: "NG", name: "Nigeria", is_enabled: true, region_label: "State", region_required: true, postal_label: "Postal code", postal_required: false };
const GB: CountryConfig = { code: "GB", name: "United Kingdom", is_enabled: true, region_label: "County", region_required: false, postal_label: "Postcode", postal_required: true };
const NG_REGIONS = [{ code: "LA", name: "Lagos" }, { code: "FC", name: "Federal Capital Territory (Abuja)" }, { code: "RI", name: "Rivers" }];

const rate = (over: Partial<ShippingRateRecord>): ShippingRateRecord => ({
  id: "r", method_id: "m1", method_name: "Standard delivery", method_description: null, method_sort: 1,
  rate_type: "flat", fee: 0, currency: "NGN", min_days: null, max_days: null, free_shipping_threshold: null,
  is_manual: true, tiers: [], ...over,
});

const nigeriaZones: ShippingZoneRecord[] = [
  { id: "z-same", name: "Same-city delivery (Lagos)", priority: 10,
    locations: [{ country_code: "NG", region_code: "LA", city: "Lagos" }],
    rates: [rate({ id: "same-std", fee: 2_500_00 })] },
  { id: "z-ng", name: "Nigeria — other destinations", priority: 0,
    locations: [{ country_code: "NG", region_code: null, city: null }],
    rates: [rate({ id: "ng-std", fee: 4_000_00 })] },
];

const cart = { subtotalAfterDiscount: 30_000_00, weightGrams: 1200 };
const quote = (address: { country_code: string; region: string; city: string; postal_code?: string }, zones = nigeriaZones, country: CountryConfig | null = NG, regions = NG_REGIONS, c = cart) =>
  calculateShipping({ address, country, regions, zones, cart: c, storeCurrency: "NGN" });

describe("Nigerian shipping", () => {
  it("charges the same-city rate for Lagos, Lagos", () => {
    const q = quote({ country_code: "NG", region: "LA", city: "  lagos " });
    expect(q.ok && q.options[0]).toMatchObject({ rateId: "same-std", fee: 2_500_00, isManual: true });
  });

  it("matches the region by name as well as code", () => {
    const q = quote({ country_code: "NG", region: "Lagos", city: "Lagos" });
    expect(q.ok && q.options[0].fee).toBe(2_500_00);
  });

  it("charges the other-destinations rate elsewhere in Nigeria", () => {
    expect((quote({ country_code: "NG", region: "FC", city: "Abuja" }) as { ok: true; options: { fee: number }[] }).options[0].fee).toBe(4_000_00);
    // A different city within Lagos State is not "same city".
    expect((quote({ country_code: "NG", region: "LA", city: "Epe" }) as { ok: true; options: { fee: number }[] }).options[0].fee).toBe(4_000_00);
  });

  it("rejects an unknown state", () => {
    const q = quote({ country_code: "NG", region: "Atlantis", city: "Lagos" });
    expect(q).toMatchObject({ ok: false, code: "invalid_address" });
  });

  it("applies a configured free-shipping threshold", () => {
    const zones = [{ ...nigeriaZones[1], rates: [rate({ id: "ng-std", fee: 4_000_00, free_shipping_threshold: 25_000_00 })] }];
    const q = quote({ country_code: "NG", region: "RI", city: "Port Harcourt" }, zones);
    expect(q.ok && q.options[0]).toMatchObject({ fee: 0, originalFee: 4_000_00, freeShippingApplied: true });
  });

  it("supports weight-based tiers and omits a rate when no tier applies", () => {
    const tiers = [{ min_value: 0, max_value: 1000, fee: 3_000_00 }, { min_value: 1000, max_value: 5000, fee: 5_000_00 }];
    const zones = [{ ...nigeriaZones[1], rates: [rate({ id: "w", rate_type: "weight_based", tiers })] }];
    const ok = quote({ country_code: "NG", region: "RI", city: "PH" }, zones);
    expect(ok.ok && ok.options[0].fee).toBe(5_000_00);
    const heavy = quote({ country_code: "NG", region: "RI", city: "PH" }, zones, NG, NG_REGIONS, { ...cart, weightGrams: 9000 });
    expect(heavy).toMatchObject({ ok: false, code: "no_rates" });
  });

  it("supports order-value-based tiers", () => {
    const tiers = [{ min_value: 0, max_value: 20_000_00, fee: 4_000_00 }, { min_value: 20_000_00, max_value: null, fee: 1_500_00 }];
    const zones = [{ ...nigeriaZones[1], rates: [rate({ id: "v", rate_type: "order_value_based", tiers })] }];
    const q = quote({ country_code: "NG", region: "RI", city: "PH" }, zones);
    expect(q.ok && q.options[0].fee).toBe(1_500_00);
  });
});

describe("international shipping", () => {
  it("refuses countries that are not enabled", () => {
    const q = quote({ country_code: "US", region: "CA", city: "LA" }, nigeriaZones, { ...GB, code: "US", is_enabled: false }, []);
    expect(q).toMatchObject({ ok: false, code: "country_unsupported" });
  });

  it("refuses a country with no configuration row", () => {
    expect(quote({ country_code: "FR", region: "", city: "Paris" }, [], null, [])).toMatchObject({ ok: false, code: "country_unsupported" });
  });

  it("refuses an enabled country with no zone instead of charging zero", () => {
    const q = quote({ country_code: "GB", region: "", city: "London", postal_code: "SW1A 1AA" }, nigeriaZones, GB, []);
    expect(q).toMatchObject({ ok: false, code: "no_zone" });
  });

  it("refuses a zone that has no rates configured", () => {
    const zones: ShippingZoneRecord[] = [{ id: "uk", name: "UK", priority: 0, locations: [{ country_code: "GB", region_code: null, city: null }], rates: [] }];
    const q = quote({ country_code: "GB", region: "", city: "London", postal_code: "SW1A 1AA" }, zones, GB, []);
    expect(q).toMatchObject({ ok: false, code: "no_rates" });
  });

  it("requires a postcode where the country needs one", () => {
    const zones: ShippingZoneRecord[] = [{ id: "uk", name: "UK", priority: 0, locations: [{ country_code: "GB", region_code: null, city: null }], rates: [rate({ id: "uk", fee: 30_000_00 })] }];
    expect(quote({ country_code: "GB", region: "", city: "London" }, zones, GB, [])).toMatchObject({ ok: false, code: "invalid_address" });
    const q = quote({ country_code: "GB", region: "", city: "London", postal_code: "SW1A 1AA" }, zones, GB, []);
    expect(q.ok && q.options[0].fee).toBe(30_000_00);
  });

  it("returns multiple configured methods with estimates", () => {
    const zones: ShippingZoneRecord[] = [{
      id: "uk", name: "UK", priority: 0, locations: [{ country_code: "GB", region_code: null, city: null }],
      rates: [
        rate({ id: "exp", method_id: "m2", method_name: "Express", method_sort: 2, fee: 60_000_00, min_days: 3, max_days: 5 }),
        rate({ id: "std", method_name: "Standard", method_sort: 1, fee: 35_000_00, min_days: 7, max_days: 14 }),
      ],
    }];
    const q = quote({ country_code: "GB", region: "", city: "London", postal_code: "E1 6AN" }, zones, GB, []);
    expect(q.ok && q.options.map((o) => o.rateId)).toEqual(["std", "exp"]);
  });

  it("skips rates in a different currency instead of converting", () => {
    const zones: ShippingZoneRecord[] = [{ id: "uk", name: "UK", priority: 0, locations: [{ country_code: "GB", region_code: null, city: null }], rates: [rate({ id: "usd", currency: "USD", fee: 5000 })] }];
    expect(quote({ country_code: "GB", region: "", city: "London", postal_code: "E1" }, zones, GB, [])).toMatchObject({ ok: false, code: "no_rates" });
  });
});

describe("delivery window formatting", () => {
  it("formats configured estimates and hides missing ones", () => {
    expect(formatDeliveryWindow(null, null)).toBeNull();
    expect(formatDeliveryWindow(2, 4)).toBe("2–4 business days");
    expect(formatDeliveryWindow(1, 1)).toBe("1 business day");
  });
});
