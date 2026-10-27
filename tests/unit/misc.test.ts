import { describe, expect, it } from "vitest";
import { filtersToSearchParams, parseFilters, sortSizes } from "@/lib/catalog/filters";
import { can } from "@/lib/permissions";
import { allowedTransitions } from "@/lib/orders/status";
import { formatMoney, toMinor } from "@/lib/money";
import { mergeSettings } from "@/lib/settings";

describe("catalogue filters", () => {
  it("parses filters safely from the URL", () => {
    const f = parseFilters({ q: " satin ", size: "M,L", color: "Black", min: "50000", max: "10000", availability: "in_stock", sort: "price_desc", page: "2" });
    expect(f).toMatchObject({ q: "satin", sizes: ["M", "L"], colors: ["black"], minPrice: 10000_00, maxPrice: 50000_00, availability: "in_stock", sort: "price_desc", page: 2 });
  });

  it("falls back on invalid values", () => {
    const f = parseFilters({ sort: "drop table", page: "-3", min: "abc", availability: "maybe" });
    expect(f).toMatchObject({ sort: "newest", page: 1, minPrice: null, availability: null });
  });

  it("round-trips to a query string", () => {
    const f = parseFilters({ size: "M", sale: "1", sort: "price_asc" });
    expect(filtersToSearchParams(f).toString()).toBe("size=M&sale=1&sort=price_asc");
  });

  it("orders clothing and numeric sizes naturally", () => {
    expect(sortSizes(["XL", "S", "M"])).toEqual(["S", "M", "XL"]);
    expect(sortSizes(["42", "38", "40"])).toEqual(["38", "40", "42"]);
  });
});

describe("admin permissions", () => {
  it("restricts staff to orders", () => {
    expect(can(["staff"], "orders:update")).toBe(true);
    expect(can(["staff"], "catalog:write")).toBe(false);
    expect(can(["staff"], "shipping:write")).toBe(false);
    expect(can([], "orders:read")).toBe(false);
    expect(can(["admin"], "settings:write")).toBe(true);
  });

  it("never offers a manual 'paid' transition", () => {
    for (const s of ["pending_payment", "paid", "processing", "shipped"] as const) {
      expect(allowedTransitions(s, true)).not.toContain("paid");
    }
    expect(allowedTransitions("pending_payment", false)).toEqual(["cancelled"]);
    expect(allowedTransitions("cancelled", false)).toEqual([]);
  });
});

describe("money & settings", () => {
  it("formats and parses naira amounts in kobo", () => {
    expect(formatMoney(250000)).toMatch(/2,500/);
    expect(toMinor("4,000")).toBe(400000);
    expect(toMinor("12.5")).toBe(1250);
    expect(toMinor("-1")).toBeNull();
  });

  it("merges stored settings over defaults", () => {
    const s = mergeSettings([{ key: "checkout", value: { guest_checkout_enabled: false } }]);
    expect(s.checkout).toEqual({ guest_checkout_enabled: false, max_quantity_per_item: 10 });
    expect(s.store.name).toBe("Attitude Collections");
  });
});
