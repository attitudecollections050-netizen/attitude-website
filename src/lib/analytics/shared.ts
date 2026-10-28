// First-party analytics helpers shared by the browser tracker and the
// collection endpoint. Nothing here identifies a person: the visitor id is
// a random UUID created only after the visitor accepts analytics cookies.

export const CONSENT_COOKIE = "ac_consent"; // "granted" | "denied"
export const VISITOR_COOKIE = "ac_vid";
export const CLIENT_EVENTS = ["page_view", "product_view", "add_to_cart", "checkout_start"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type TrafficSource = "direct" | "search" | "social" | "email" | "paid" | "referral" | "campaign";
export type Device = "mobile" | "tablet" | "desktop";

/** A visit (session) ends after 30 minutes without activity. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const SEARCH = ["google.", "bing.com", "yahoo.", "duckduckgo.com", "yandex.", "baidu.com", "ecosia.org", "search.brave.com", "startpage.com"];
const SOCIAL = ["facebook.com", "fb.com", "instagram.com", "t.co", "twitter.com", "x.com", "tiktok.com", "pinterest.com", "whatsapp.com", "wa.me", "snapchat.com", "youtube.com", "linkedin.com", "lnkd.in", "reddit.com", "threads.net", "t.me", "telegram.org"];
const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com"];

function matches(host: string, list: string[]): boolean {
  return list.some((d) => (d.endsWith(".") ? host.startsWith(d) || host.includes(`.${d}`) : host === d || host.endsWith(`.${d}`)));
}

/** Reduces a referrer URL to its host, dropping our own host and junk. */
export function referrerHost(referrer: string | null | undefined, ownHost?: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host.length > 120) return null;
    if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Classifies where a visit came from, preferring explicit UTM tags. */
export function classifySource(host: string | null, utm: { source?: string | null; medium?: string | null }): TrafficSource {
  const medium = (utm.medium ?? "").toLowerCase();
  if (medium) {
    if (/^(cpc|ppc|paid|paidsocial|paid_social|display|cpm|ads?)$/.test(medium)) return "paid";
    if (medium === "email" || medium === "newsletter") return "email";
    if (/social/.test(medium)) return "social";
    if (medium === "organic") return "search";
  }
  if (utm.source) return "campaign";
  if (!host) return "direct";
  if (matches(host, EMAIL)) return "email";
  if (matches(host, SEARCH)) return "search";
  if (matches(host, SOCIAL)) return "social";
  return "referral";
}

/** Broad device category from the user agent (the user agent itself is not stored). */
export function deviceFromUserAgent(ua: string | null | undefined): Device {
  const s = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(s)) return "mobile";
  return "desktop";
}

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp\/|curl|wget|python-requests|httpclient|monitor|uptime/i;
export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOT.test(ua);
}

/** Keeps only the path: query strings and fragments can carry personal data. */
export function cleanPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string" || !path.startsWith("/")) return null;
  const p = path.split(/[?#]/)[0].slice(0, 300);
  if (!/^\/[\w\-./~%@]*$/.test(p)) return null;
  return p;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** Browser privacy signals we honour as an opt-out (Global Privacy Control, Do Not Track). */
export function privacySignalOptOut(nav: { globalPrivacyControl?: boolean; doNotTrack?: string | null } | undefined): boolean {
  if (!nav) return false;
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes";
}
