import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { currencyForCountry, isLocale, LOCALES, localeDir, negotiateLocale } from "@/lib/intl/config";
import { convertFromNgn, formatNgn, formatPrice, isEstimate, NO_RATES, type DisplayRates } from "@/lib/currency/convert";
import { computeDisplayRates, fetchProviderRates, validateRate, type CurrencyRow } from "@/lib/currency/rates";
import { applyOverride, mergeMessages } from "@/lib/intl/messages";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import zh from "@/messages/zh.json";
import ko from "@/messages/ko.json";

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ""): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)));

/** Argument and tag names used by an ICU message (plural branches and rich-text tags included). */
function argNames(message: string, locale: string): string {
  const names = new Set<string>();
  const walk = (els: unknown[]) =>
    els.forEach((e) => {
      const el = e as { type: number; value?: unknown; options?: Record<string, { value: unknown[] }>; children?: unknown[] };
      if (el.type !== 0 && typeof el.value === "string") names.add(el.value);
      if (el.options) Object.values(el.options).forEach((o) => walk(o.value));
      if (el.children) walk(el.children);
    });
  walk(new IntlMessageFormat(message, locale).getAst() as unknown[]);
  return [...names].sort().join(",");
}

describe("translation files", () => {
  const english = new Map(flat(en as Tree));
  const files = { fr, es, pt, ar, de, zh, ko } as Record<string, Tree>;

  it("every supported language has a file", () => {
    expect(Object.keys(files).sort()).toEqual(LOCALES.map((l) => l.code).filter((c) => c !== "en").sort());
  });

  for (const [locale, messages] of Object.entries(files)) {
    it(`${locale}: has every English key and no unknown keys`, () => {
      const keys = new Map(flat(messages));
      expect([...english.keys()].filter((k) => !keys.has(k))).toEqual([]);
      expect([...keys.keys()].filter((k) => !english.has(k))).toEqual([]);
    });

    it(`${locale}: messages are valid ICU with the same arguments as English`, () => {
      const problems: string[] = [];
      for (const [key, value] of flat(messages)) {
        const source = english.get(key);
        if (!source) continue;
        if (!value.trim()) {
          // Empty only where English is empty (e.g. the optional announcement override).
          if (source.trim()) problems.push(`${key}: empty`);
          continue;
        }
        try {
          if (argNames(value, locale) !== argNames(source, "en")) problems.push(`${key}: arguments differ`);
        } catch (e) {
          problems.push(`${key}: ${(e as Error).message}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

describe("message loading", () => {
  it("falls back to English for missing or empty translations", () => {
    const merged = mergeMessages({ a: "Hello", b: { c: "Bag" } }, { a: "", b: { c: "Panier" }, x: "junk" } as Tree);
    expect(merged).toEqual({ a: "Hello", b: { c: "Panier" } });
  });

  it("admin overrides only replace existing keys", () => {
    const tree: Tree = { cart: { bag: "Bag" } };
    applyOverride(tree, "cart.bag", "Sac");
    applyOverride(tree, "cart.unknown", "x");
    applyOverride(tree, "nope.deep.key", "x");
    applyOverride(tree, "cart.bag.too.deep", "x");
    expect(tree).toEqual({ cart: { bag: "Sac" } });
  });
});

describe("language and country", () => {
  const enabled = LOCALES.map((l) => l.code);

  it("suggests a language from the browser but never invents one", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8", enabled)).toBe("fr");
    expect(negotiateLocale("sw-KE,sw;q=0.9,en;q=0.5", enabled)).toBe("en");
    expect(negotiateLocale("ja-JP", enabled)).toBeNull();
    expect(negotiateLocale("de;q=0.2,ar;q=0.8", ["en", "de"])).toBe("de");
    expect(negotiateLocale(null, enabled)).toBeNull();
  });

  it("Arabic is right-to-left; the others left-to-right", () => {
    expect(localeDir("ar")).toBe("rtl");
    expect(localeDir("fr")).toBe("ltr");
    expect(isLocale("xx")).toBe(false);
  });

  it("suggests a currency only if the store has it enabled", () => {
    expect(currencyForCountry("FR", ["NGN", "EUR"])).toBe("EUR");
    expect(currencyForCountry("GH", ["NGN", "EUR"])).toBeNull();
    expect(currencyForCountry("NG", ["NGN"])).toBe("NGN");
    expect(currencyForCountry(undefined, ["NGN"])).toBeNull();
  });
});

describe("display currency conversion", () => {
  const rates: DisplayRates = { rates: { NGN: 1, USD: 0.00065, JPY: 0.1 }, updatedAt: "2026-10-28T00:00:00Z", source: "test" };

  it("converts NGN kobo with the currency's own decimals", () => {
    expect(convertFromNgn(49_000_00, "USD", rates)).toBe(31.85);
    expect(convertFromNgn(49_000_00, "JPY", rates)).toBe(4900);
    expect(convertFromNgn(49_000_00, "NGN", rates)).toBe(49_000);
  });

  it("never uses a missing or invalid rate — falls back to NGN instead", () => {
    expect(convertFromNgn(1000, "GBP", rates)).toBeNull();
    expect(convertFromNgn(1000, "USD", { ...rates, rates: { USD: 0 } })).toBeNull();
    expect(convertFromNgn(1000, "USD", { ...rates, rates: { USD: Number.NaN } })).toBeNull();
    expect(formatPrice(49_000_00, { currency: "GBP", locale: "en", rates })).toBe(formatNgn(49_000_00));
    expect(formatPrice(49_000_00, { currency: "USD", locale: "en", rates: NO_RATES })).toContain("₦");
  });

  it("formats in the shopper's language (Arabic keeps Latin digits)", () => {
    expect(formatPrice(49_000_00, { currency: "USD", locale: "en", rates })).toBe("$31.85");
    expect(formatPrice(49_000_00, { currency: "USD", locale: "fr", rates })).toMatch(/31,85\s?\$/);
    expect(formatPrice(49_000_00, { currency: "USD", locale: "ar", rates })).toContain("31.85");
    expect(formatNgn(49_000_00)).toBe("₦49,000");
  });

  it("flags estimates when display and charge currencies differ", () => {
    expect(isEstimate("USD", "NGN")).toBe(true);
    expect(isEstimate("NGN", "NGN")).toBe(false);
  });
});

describe("exchange rates", () => {
  const cur = (code: string, over: Partial<CurrencyRow> = {}): CurrencyRow => ({ code, name: code, symbol: code, is_enabled: true, markup_bps: 0, manual_rate: null, sort_order: 0, ...over });
  const now = Date.parse("2026-10-28T12:00:00Z");
  const row = (currency: string, rate: number, hoursOld: number) => ({ currency, rate, source: "test", provider_updated_at: null, fetched_at: new Date(now - hoursOld * 3_600_000).toISOString() });

  it("uses only fresh rates for enabled currencies, with markup", () => {
    const r = computeDisplayRates(
      [cur("NGN"), cur("USD", { markup_bps: 300 }), cur("GBP"), cur("EUR", { is_enabled: false })],
      [row("USD", 0.001, 2), row("GBP", 0.0005, 48), row("EUR", 0.0006, 1)],
      "open_er_api",
      36,
      now,
    );
    expect(r.rates.NGN).toBe(1);
    expect(r.rates.USD).toBeCloseTo(0.00103, 10);
    expect(r.rates.GBP).toBeUndefined(); // 48h old > 36h limit
    expect(r.rates.EUR).toBeUndefined(); // disabled
  });

  it("manual mode uses only admin-entered rates", () => {
    const r = computeDisplayRates([cur("NGN"), cur("USD", { manual_rate: 0.0007 }), cur("GBP")], [row("GBP", 0.0005, 1)], "manual", 36, now);
    expect(r.rates).toEqual({ NGN: 1, USD: 0.0007 });
    expect(r.source).toBe("manual");
  });

  it("rejects non-positive rates and suspicious jumps", () => {
    expect(validateRate(0.001, 0.00105).ok).toBe(true);
    expect(validateRate(0.001, 0.002).ok).toBe(false);
    expect(validateRate(null, 0.002).ok).toBe(true);
    expect(validateRate(0.001, 0).ok).toBe(false);
    expect(validateRate(0.001, Number.NaN).ok).toBe(false);
  });

  const respond = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("reads a valid provider response", async () => {
    const r = await fetchProviderRates("open_er_api", respond({ result: "success", base_code: "NGN", time_last_update_unix: 1_800_000_000, rates: { NGN: 1, USD: 0.00065, BAD: -1, xx: 2 } }));
    expect(r.rates).toEqual({ NGN: 1, USD: 0.00065 });
    expect(r.providerUpdatedAt).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it("throws (so nothing is stored) on errors, wrong base or a failed request", async () => {
    await expect(fetchProviderRates("open_er_api", respond({ result: "error", "error-type": "quota" }))).rejects.toThrow(/quota/);
    await expect(fetchProviderRates("open_er_api", respond({ result: "success", base_code: "USD", rates: { NGN: 1500 } }))).rejects.toThrow(/base/);
    await expect(fetchProviderRates("open_er_api", respond({}, 503))).rejects.toThrow(/503/);
    await expect(fetchProviderRates("manual", respond({}))).rejects.toThrow();
  });

  it("the keyed provider requires its API key", async () => {
    const before = process.env.EXCHANGE_RATE_API_KEY;
    delete process.env.EXCHANGE_RATE_API_KEY;
    await expect(fetchProviderRates("exchangerate_api", respond({}))).rejects.toThrow(/EXCHANGE_RATE_API_KEY/);
    if (before) process.env.EXCHANGE_RATE_API_KEY = before;
  });
});
