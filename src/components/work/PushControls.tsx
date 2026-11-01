"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, Laptop, LogOut, Send, Smartphone } from "lucide-react";
import { detectDevice } from "@/lib/device-name";
import { signOutEverywhere } from "@/app/actions/auth";
import { playTestSound } from "@/lib/notify-sound";
import { cn } from "@/lib/cn";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Support = "ssr" | "yes" | "ios-install" | "no";
const noSubscribe = () => () => {};
function support(): Support {
  if (typeof window === "undefined") return "ssr";
  const ok = "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
  if (ok) return "yes";
  // iPhone/iPad only get push from the Home Screen app (iOS 16.4+).
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios-install" : "no";
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

async function save(sub: PushSubscription): Promise<string> {
  const device = await detectDevice();
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), device }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Couldn't save this device.");
  return d.id as string;
}

/** Tells the server this device is in use. False = it was revoked (or never saved). */
async function touch(sub: PushSubscription): Promise<{ exists: boolean; id: string | null }> {
  const res = await fetch("/api/push/subscribe", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { exists: Boolean(d.exists), id: d.id ?? null } : { exists: true, id: null };
}

/** Push state for this device: register the service worker, subscribe, unsubscribe. */
export function usePush() {
  const sup = useSyncExternalStore(noSubscribe, support, () => "ssr" as Support);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    if (sup !== "yes") return;
    let alive = true;
    (async () => {
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (!alive) return;
        setPerm(Notification.permission);
        if (!sub) return setSubscribed(false);
        // Keep this device active (30-day rule). If it was revoked or logged out, drop the
        // browser's subscription too — a revoked device is never added back by itself.
        const t = await touch(sub);
        if (!alive) return;
        if (!t.exists) await sub.unsubscribe().catch(() => {});
        setSubscribed(t.exists);
        setDeviceId(t.id);
      } catch {
        if (alive) setSubscribed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sup]);

  const enable = useCallback(async () => {
    if (!VAPID) throw new Error("Push isn't set up on the server yet (VAPID keys missing).");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") throw new Error(p === "denied" ? "Notifications are blocked. Allow them for this site in your browser settings." : "Please tap Allow to get notifications.");
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
    try {
      setDeviceId(await save(sub));
    } catch (e) {
      await sub.unsubscribe().catch(() => {}); // e.g. already 3 devices
      throw e;
    }
    setSubscribed(true);
    playTestSound(); // this tap also unlocks sound
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setSubscribed(false);
    setDeviceId(null);
  }, []);

  /** This device was revoked from the list: also drop the browser's subscription. */
  const forgetLocal = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    await (await reg?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
    setSubscribed(false);
    setDeviceId(null);
  }, []);

  return { support: sup, subscribed, permission: perm, deviceId, enable, disable, forgetLocal, configured: Boolean(VAPID) };
}

/** The panel on the notifications pages: Enable Push Notifications + Send Test Push. */
export function PushControls({ who }: { who: "admin" | "staff" }) {
  const push = usePush();
  const [busy, setBusy] = useState<"enable" | "test" | "off" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const run = async (kind: "enable" | "test" | "off", fn: () => Promise<string>) => {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ tone: "ok", text: await fn() });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message || "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };
  const test = () =>
    run("test", async () => {
      const res = await fetch("/api/push/test", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't send the test.");
      return `Test push sent to ${d.sent} of your ${d.devices} device${d.devices === 1 ? "" : "s"} 💖 It should pop up in a few seconds.`;
    });

  return (
    <section className="rounded-[1.4rem] border-2 border-[#FFB6D9] bg-gradient-to-br from-[#FFF5FA] to-white p-4 sm:p-5" data-testid="push-controls">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E94E8A] text-white"><BellRing className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-[#C2185B]">Push notifications on this phone or laptop</p>
          <p className="mt-0.5 text-sm text-black/60">
            {who === "admin"
              ? "Get new orders, payments (received / failed / bank transfers), low stock and staff work on your phone, even when the site is closed. Turn it on once on each device."
              : "Get Haru's messages (ratings, bonuses) even when the site is closed. Turn it on once on each device."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {push.support === "ios-install" ? (
          <p className="flex items-start gap-2 text-sm text-[#9D174D]" data-testid="push-ios-tip">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open Attitude from the new icon, then come back here and enable.
          </p>
        ) : push.support === "no" ? (
          <p className="text-sm text-black/60">This browser can&apos;t receive push notifications. Try Chrome, Edge, Firefox or Safari.</p>
        ) : !push.configured ? (
          <p className="text-sm text-[#9A3412]" data-testid="push-not-configured">Push isn&apos;t set up on the server yet (VAPID keys missing).</p>
        ) : push.subscribed ? (
          <>
            <span className="rounded-full bg-[#DCFCE7] px-3 py-1.5 text-xs font-bold text-[#166534]" data-testid="push-on">✅ Push is on for this device</span>
            <button type="button" disabled={busy !== null} onClick={test} className="inline-flex items-center gap-1.5 rounded-full bg-[#E94E8A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" data-testid="push-test">
              <Send className="size-4" aria-hidden /> {busy === "test" ? "Sending…" : "Send Test Push"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("off", async () => (await push.disable(), "Push turned off for this device."))} className="text-xs font-semibold text-black/50 underline underline-offset-4">
              Turn off
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy !== null || push.subscribed === null}
            onClick={() => run("enable", async () => (await push.enable(), "Push is on! Tap “Send Test Push” to try it."))}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E94E8A] px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_#9D174D] disabled:opacity-50"
            data-testid="push-enable"
          >
            <BellRing className="size-4" aria-hidden /> {busy === "enable" ? "Turning on…" : "Enable Push Notifications"}
          </button>
        )}
      </div>
      {msg && <p className={cn("mt-2 text-sm font-semibold", msg.tone === "ok" ? "text-[#166534]" : "text-danger")} role="status" data-testid="push-msg">{msg.text}</p>}
      <MyDevices who={who} currentId={push.deviceId} refreshKey={`${push.subscribed}-${push.deviceId}`} onRevokedCurrent={push.forgetLocal} />
    </section>
  );
}

const ALERTS = [
  { key: "staff_work", label: "Staff work" },
  { key: "orders", label: "New Orders" },
  { key: "payments", label: "Payments (Received / Failed)" },
  { key: "low_stock", label: "Low stock" },
] as const;
type AlertKey = (typeof ALERTS)[number]["key"];

interface Device {
  alertTypes: AlertKey[];
  id: string;
  name: string;
  browser: string | null;
  createdAt: string;
  lastActiveAt: string;
}
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

/**
 * "My Devices Receiving Push": every phone/laptop getting this person's notifications, with
 * Revoke — so a phone you once logged in on (someone else's) can be cut off from anywhere.
 */
function MyDevices({ who, currentId, refreshKey, onRevokedCurrent }: { who: "admin" | "staff"; currentId: string | null; refreshKey: string; onRevokedCurrent: () => Promise<void> }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/push/devices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { devices: [] }))
      .then((d) => alive && setDevices(d.devices ?? []))
      .catch(() => alive && setDevices([]));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const toggle = async (d: Device, key: AlertKey) => {
    const next = d.alertTypes.includes(key) ? d.alertTypes.filter((k) => k !== key) : [...d.alertTypes, key];
    setDevices((list) => (list ?? []).map((x) => (x.id === d.id ? { ...x, alertTypes: next } : x)));
    setError(null);
    const res = await fetch(`/api/push/devices/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alert_types: next }) }).catch(() => null);
    if (!res?.ok) {
      setDevices((list) => (list ?? []).map((x) => (x.id === d.id ? { ...x, alertTypes: d.alertTypes } : x)));
      setError("Couldn't save that. Please try again.");
    }
  };

  const revoke = async (d: Device) => {
    if (!window.confirm(`Stop push notifications on “${d.name}”?`)) return;
    setBusy(d.id);
    setError(null);
    try {
      const res = await fetch(`/api/push/devices/${d.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const j = await res.json().catch(() => ({}));
        return setError(j.error ?? "Couldn't revoke that device.");
      }
      setDevices((list) => (list ?? []).filter((x) => x.id !== d.id));
      if (d.id === currentId) await onRevokedCurrent();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-5 border-t-2 border-dashed border-[#FFB6D9] pt-4" data-testid="my-devices">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">My Devices Receiving Push {devices ? `(${devices.length}/3)` : ""}</p>
        <LogoutAllButton />
      </div>
      {who === "admin" && <p className="mt-1 text-xs text-black/55">Tick what each device should get. Payments ring with a louder “ka-ching” and stay on screen until you tap.</p>}
      <p className="mt-1 text-xs text-black/55">Don&apos;t recognise one? Revoke it. Logging out on a device also stops its push. Devices not used for 30 days stop automatically. Up to 3 devices.</p>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      {devices === null ? (
        <p className="mt-3 text-sm text-black/50">Loading…</p>
      ) : devices.length === 0 ? (
        <p className="mt-3 text-sm text-black/50" data-testid="no-devices">No devices yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10 bg-white">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5" data-testid="device">
              <span className="flex min-w-0 items-center gap-2.5">
                {/phone|iPhone|Android/i.test(d.name) ? <Smartphone className="size-5 shrink-0 text-[#C2185B]" aria-hidden /> : <Laptop className="size-5 shrink-0 text-[#C2185B]" aria-hidden />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {d.name}
                    {d.id === currentId && <span className="ml-2 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#166534]">This device</span>}
                  </span>
                  <span className="block text-xs text-black/55">Last active {ago(d.lastActiveAt)} · added {dateFmt(d.createdAt)}</span>
                </span>
              </span>
              <button type="button" disabled={busy === d.id} onClick={() => void revoke(d)} className="rounded-full border border-[#DC2626] px-3 py-1 text-xs font-bold text-[#B91C1C] disabled:opacity-50" data-testid="revoke">
                {busy === d.id ? "Revoking…" : "Revoke"}
              </button>
              {who === "admin" && (
                <fieldset className="flex w-full flex-wrap gap-1.5" data-testid="alert-toggles">
                  <legend className="sr-only">Alerts on {d.name}</legend>
                  {ALERTS.map((a) => {
                    const on = d.alertTypes.includes(a.key);
                    return (
                      <label
                        key={a.key}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                          on ? (a.key === "payments" ? "border-[#16A34A] bg-[#DCFCE7] text-[#166534]" : "border-[#E94E8A] bg-[#FFE4EF] text-[#C2185B]") : "border-black/15 bg-white text-black/45",
                        )}
                      >
                        <input type="checkbox" className="size-3.5 accent-[#E94E8A]" checked={on} onChange={() => void toggle(d, a.key)} data-testid={`toggle-${a.key}`} />
                        {a.label}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Put inside a logout form: sends this browser's push endpoint so the server removes it,
 * and drops the browser's subscription — the phone stops getting your notifications.
 */
export function PushLogoutField() {
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager?.getSubscription())
      .then((sub) => sub && setEndpoint(sub.endpoint))
      .catch(() => {});
  }, []);
  return (
    <input
      type="hidden"
      name="push_endpoint"
      value={endpoint}
      ref={(el) => {
        const form = el?.form;
        if (!form || form.dataset.pushLogout) return;
        form.dataset.pushLogout = "1";
        form.addEventListener("submit", () => {
          void navigator.serviceWorker?.getRegistration("/").then((reg) => reg?.pushManager?.getSubscription()).then((sub) => sub?.unsubscribe()).catch(() => {});
        });
      }}
    />
  );
}

/** "Log out of all devices": signs out every session and removes every push device. */
export function LogoutAllButton({ big = false }: { big?: boolean }) {
  return (
    <form
      action={signOutEverywhere}
      onSubmit={(e) => {
        if (!window.confirm("Log out on ALL devices and stop push notifications on every one of them?")) e.preventDefault();
      }}
    >
      <button
        className={cn("inline-flex items-center gap-1.5 rounded-full border-2 border-[#DC2626] bg-white font-bold text-[#B91C1C]", big ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs")}
        data-testid="logout-all"
      >
        <LogOut className="size-3.5" aria-hidden /> Log out of all devices
      </button>
    </form>
  );
}
