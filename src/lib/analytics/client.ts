"use client";
import { CONSENT_COOKIE, SESSION_TIMEOUT_MS, VISITOR_COOKIE, privacySignalOptOut, type ClientEvent } from "./shared";

export type Consent = "granted" | "denied" | null;
export const CONSENT_CHANGED = "ac:consent-changed";
export const OPEN_CONSENT = "ac:open-consent";
const SESSION_KEY = "ac_session";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string, days: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`;
}

export function browserOptedOut(): boolean {
  return privacySignalOptOut(navigator as Navigator & { globalPrivacyControl?: boolean });
}

export function getConsent(): Consent {
  const v = readCookie(CONSENT_COOKIE);
  return v === "granted" || v === "denied" ? v : null;
}

export function setConsent(value: "granted" | "denied") {
  writeCookie(CONSENT_COOKIE, value, 180);
  if (value === "granted") {
    if (!readCookie(VISITOR_COOKIE)) writeCookie(VISITOR_COOKIE, crypto.randomUUID(), 395);
  } else {
    writeCookie(VISITOR_COOKIE, "", 0);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED, { detail: value }));
}

function canTrack(): boolean {
  return getConsent() === "granted" && !browserOptedOut() && Boolean(readCookie(VISITOR_COOKIE));
}

/** Current visit id; a new visit starts after 30 minutes of inactivity. */
function session(): { id: string; landing: boolean } {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
    if (s && typeof s.id === "string" && now - s.last < SESSION_TIMEOUT_MS) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: s.id, last: now }));
      return { id: s.id, landing: false };
    }
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    return { id, landing: true };
  } catch {
    return { id: crypto.randomUUID(), landing: true };
  }
}

/** Sends an analytics event — a no-op unless the visitor accepted analytics cookies. */
export function track(type: ClientEvent, extra: { productId?: string; variantId?: string } = {}) {
  if (typeof window === "undefined" || !canTrack()) return;
  const s = session();
  const body: Record<string, unknown> = { type, visitorId: readCookie(VISITOR_COOKIE), sessionId: s.id, path: location.pathname, ...extra };
  if (type === "page_view" && s.landing) {
    const q = new URLSearchParams(location.search);
    Object.assign(body, {
      landing: true,
      referrer: document.referrer || null,
      utmSource: q.get("utm_source"),
      utmMedium: q.get("utm_medium"),
      utmCampaign: q.get("utm_campaign"),
    });
  }
  fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}
