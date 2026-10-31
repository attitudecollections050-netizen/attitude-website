"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, Send, Smartphone } from "lucide-react";
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

async function save(sub: PushSubscription) {
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Couldn't save this device.");
}

/** Push state for this device: register the service worker, subscribe, unsubscribe. */
export function usePush() {
  const sup = useSyncExternalStore(noSubscribe, support, () => "ssr" as Support);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (sup !== "yes") return;
    let alive = true;
    (async () => {
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (!alive) return;
        setPerm(Notification.permission);
        setSubscribed(Boolean(sub));
        // Keep the server's copy fresh (e.g. after the database was reset or keys rotated).
        if (sub && Notification.permission === "granted") void save(sub).catch(() => {});
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
    await save(sub);
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
  }, []);

  return { support: sup, subscribed, permission: perm, enable, disable, configured: Boolean(VAPID) };
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
              ? "Get Haru's alerts (new staff work, fixes) even when the site is closed. Turn it on once on each device."
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
    </section>
  );
}
