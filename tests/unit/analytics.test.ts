import { describe, expect, it } from "vitest";
import { autoBucket, bucketLabel, localToday, periodInstants, periodQuery, resolvePeriod } from "@/lib/analytics/periods";
import { classifySource, cleanPath, deviceFromUserAgent, isBot, isUuid, privacySignalOptOut, referrerHost } from "@/lib/analytics/shared";
import { csvCell, csvMoney, toCsv } from "@/lib/csv";

// 28 Oct 2026, 23:30 UTC = 29 Oct 00:30 in Lagos.
const LATE = new Date("2026-10-28T23:30:00Z");
const NOON = new Date("2026-10-28T11:00:00Z");

describe("reporting periods", () => {
  it("uses the business timezone for 'today'", () => {
    expect(localToday(LATE)).toBe("2026-10-29");
    expect(localToday(NOON)).toBe("2026-10-28");
  });

  it("resolves every preset to an inclusive local date range", () => {
    const r = (period: string) => resolvePeriod({ period }, NOON);
    expect(r("today")).toMatchObject({ from: "2026-10-28", to: "2026-10-28", bucket: "day" });
    expect(r("7d")).toMatchObject({ from: "2026-10-22", to: "2026-10-28" });
    expect(r("30d")).toMatchObject({ from: "2026-09-29", to: "2026-10-28", bucket: "day" });
    expect(r("90d")).toMatchObject({ from: "2026-07-31", to: "2026-10-28", bucket: "week" });
    expect(r("this_month")).toMatchObject({ from: "2026-10-01", to: "2026-10-28" });
    expect(r("last_month")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(r("this_year")).toMatchObject({ from: "2026-01-01", to: "2026-10-28", bucket: "month" });
    expect(resolvePeriod({ period: "last_month" }, new Date("2026-03-15T12:00Z"))).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolvePeriod({ period: "last_month" }, new Date("2026-01-10T12:00Z"))).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("defaults to the last 30 days and validates custom ranges", () => {
    expect(resolvePeriod({}, NOON).preset).toBe("30d");
    expect(resolvePeriod({ period: "bogus" }, NOON).preset).toBe("30d");
    expect(resolvePeriod({ period: "custom", from: "2026-05-10", to: "2026-05-01" }, NOON)).toMatchObject({ from: "2026-05-01", to: "2026-05-10" });
    expect(resolvePeriod({ period: "custom", from: "2026-02-30", to: "nope" }, NOON)).toMatchObject({ from: "2026-09-29", to: "2026-10-28" });
    expect(resolvePeriod({ period: "custom", from: "2000-01-01", to: "2026-01-01" }, NOON).from).toBe("2015-12-25");
    expect(resolvePeriod({ period: "7d", bucket: "month" }, NOON).bucket).toBe("month");
    expect(resolvePeriod({ period: "7d", bucket: "hour" }, NOON).bucket).toBe("day");
  });

  it("chooses sensible chart buckets", () => {
    expect(autoBucket("2026-01-01", "2026-01-31")).toBe("day");
    expect(autoBucket("2026-01-01", "2026-04-30")).toBe("week");
    expect(autoBucket("2026-01-01", "2026-12-31")).toBe("month");
  });

  it("round-trips through the query string and converts to UTC instants", () => {
    const p = resolvePeriod({ period: "custom", from: "2026-03-01", to: "2026-03-31", bucket: "week" }, NOON);
    const back = resolvePeriod(Object.fromEntries(new URLSearchParams(periodQuery(p))), NOON);
    expect(back).toEqual(p);
    expect(periodInstants(p)).toEqual({ fromIso: "2026-02-28T23:00:00.000Z", toIso: "2026-03-31T23:00:00.000Z" });
    expect(bucketLabel("2026-03-01", "month")).toMatch(/Mar/);
    expect(bucketLabel("2026-03-02", "week")).toMatch(/^Wk of 2 Mar/);
  });
});

describe("first-party tracking helpers", () => {
  it("keeps only the referrer host and drops our own site", () => {
    expect(referrerHost("https://www.google.com/search?q=dress", "attitude.example")).toBe("google.com");
    expect(referrerHost("https://attitude.example/shop", "www.attitude.example")).toBeNull();
    expect(referrerHost("javascript:alert(1)")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });

  it("classifies traffic sources, preferring UTM tags", () => {
    expect(classifySource(null, {})).toBe("direct");
    expect(classifySource("google.com", {})).toBe("search");
    expect(classifySource("google.com.ng", {})).toBe("search");
    expect(classifySource("l.instagram.com", {})).toBe("social");
    expect(classifySource("t.co", {})).toBe("social");
    expect(classifySource("mail.google.com", {})).toBe("email");
    expect(classifySource("fashionblog.ng", {})).toBe("referral");
    expect(classifySource("instagram.com", { source: "ig", medium: "cpc" })).toBe("paid");
    expect(classifySource(null, { source: "newsletter", medium: "email" })).toBe("email");
    expect(classifySource(null, { source: "flyer" })).toBe("campaign");
  });

  it("derives broad device categories and ignores bots", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBe("desktop");
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/130")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBe(false);
  });

  it("strips query strings and fragments from tracked paths", () => {
    expect(cleanPath("/checkout/callback?reference=abc&email=a@b.com")).toBe("/checkout/callback");
    expect(cleanPath("/shop#top")).toBe("/shop");
    expect(cleanPath("https://evil.example/")).toBeNull();
    expect(cleanPath("/<script>")).toBeNull();
  });

  it("honours Global Privacy Control and Do Not Track", () => {
    expect(privacySignalOptOut({ globalPrivacyControl: true })).toBe(true);
    expect(privacySignalOptOut({ doNotTrack: "1" })).toBe(true);
    expect(privacySignalOptOut({ doNotTrack: "0" })).toBe(false);
    expect(privacySignalOptOut({})).toBe(false);
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("x")).toBe(false);
  });
});

describe("CSV export", () => {
  it("quotes, escapes and neutralises formulas", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(null)).toBe("");
    expect(csvMoney(123450)).toBe("1234.50");
    expect(toCsv(["a", "b"], [[1, "x\ny"]])).toBe('a,b\n1,"x\ny"');
  });
});
