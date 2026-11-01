import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { env, serverSecrets } from "@/lib/env";

// Web Push (VAPID). The public key goes to browsers; the private key stays on the server.
// Generate once with:  npx web-push generate-vapid-keys
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY = public key
//   VAPID_PRIVATE_KEY            = private key (secret)
//   VAPID_SUBJECT                = mailto:you@example.com (optional; defaults to the site URL)

export const vapidPublicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = () => process.env.VAPID_PRIVATE_KEY || "";

export function isPushConfigured() {
  return Boolean(vapidPublicKey() && vapidPrivateKey() && serverSecrets().supabaseSecretKey);
}

let configured = false;
function setup() {
  if (configured) return;
  // Push services may contact this address about problems; the site URL works when set to https.
  const subject = process.env.VAPID_SUBJECT || (env.siteUrl.startsWith("https://") ? env.siteUrl : "mailto:admin@localhost");
  webpush.setVapidDetails(subject, vapidPublicKey(), vapidPrivateKey());
  configured = true;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path on this site to open when the notification is tapped. */
  url: string;
  tag?: string;
  icon?: string;
  /** "payment": longer vibration, stays on screen until tapped, the louder ka-ching on open tabs. */
  sound?: "default" | "payment";
}

/** What each device can choose to get ("Staff work / New orders / Payments / Low stock"). */
export const ALERT_TYPES = ["staff_work", "orders", "payments", "low_stock"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

type SubRow = { id: string; user_id: string; subscription_json: webpush.PushSubscription; last_active_at: string; alert_types: string[] | null };

/** Devices not used on the site (while signed in) for this long get no pushes and are removed. */
export const INACTIVE_DAYS = 30;
export const MAX_DEVICES = 3;
/** httpOnly cookie naming this browser's push device, so logging out can remove it. */
export const DEVICE_COOKIE = "ac_push_device";

/**
 * Sends to every saved device of these people that wants this kind of alert (no type = always,
 * e.g. a staff member's own ratings or a test). Removes devices that are gone (404/410).
 */
export async function sendPushToUsers(userIds: string[], msg: PushMessage, type?: AlertType): Promise<{ sent: number; devices: number }> {
  if (!isPushConfigured() || userIds.length === 0) return { sent: 0, devices: 0 };
  setup();
  const svc = createServiceClient();
  const { data } = await svc.from("push_subscriptions").select("id, user_id, subscription_json, last_active_at, alert_types").in("user_id", [...new Set(userIds)]);
  const cutoff = Date.now() - INACTIVE_DAYS * 86_400_000;
  const all = (data ?? []) as SubRow[];
  // Auto cleanup: a device nobody has used for 30 days stops getting pushes.
  const stale = all.filter((s) => new Date(s.last_active_at).getTime() < cutoff).map((s) => s.id);
  if (stale.length) await svc.from("push_subscriptions").delete().in("id", stale);
  const subs = all.filter((s) => !stale.includes(s.id) && (!type || (s.alert_types ?? [...ALERT_TYPES]).includes(type)));
  const payload = JSON.stringify({ ...msg, url: msg.url.startsWith("/") ? msg.url : "/admin/notifications" });
  let sent = 0;
  const gone: string[] = [];
  const used: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription_json, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent += 1;
        used.push(s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("[push] send failed", code, (e as Error).message);
      }
    }),
  );
  if (gone.length) await svc.from("push_subscriptions").delete().in("id", gone);
  if (used.length) await svc.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used);
  return { sent, devices: subs.length };
}

async function ownerIds(): Promise<string[]> {
  const { data } = await createServiceClient().from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((r) => r.user_id as string);
}

/**
 * Sends every staff notification that hasn't been pushed yet (from the last hour): to the
 * owner(s) for new/fixed work, to the staff member for ratings, bonuses and deductions.
 * Each notification is claimed atomically, so it is pushed once even if this runs twice.
 */
export async function dispatchPendingPushes(): Promise<number> {
  if (!isPushConfigured()) return 0;
  const svc = createServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await svc
    .from("staff_notifications")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .gte("created_at", since)
    .select("id, staff_id, to_role, title, message, link, type");
  let owners: string[] | null = null;
  let n = 0;
  // Business alerts (orders, payments, bank transfers, low stock) for the owner(s).
  const { data: alerts } = await svc
    .from("admin_alerts")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .gte("created_at", since)
    .select("id, category, kind, title, message, link");
  for (const a of (alerts ?? []) as { id: string; category: AlertType; kind: string; title: string; message: string; link: string | null }[]) {
    owners ??= await ownerIds();
    const r = await sendPushToUsers(owners, {
      title: a.title,
      body: a.message,
      url: a.link ?? "/admin/notifications",
      tag: `alert-${a.id}`,
      icon: a.category === "payments" ? "/icons/icon-192.png" : "/mascots/girl-face.png",
      sound: a.kind === "payment_received" ? "payment" : "default",
    }, a.category);
    n += r.sent;
  }
  if (error || !data?.length) return n;
  for (const row of data as { id: string; staff_id: string | null; to_role: "admin" | "staff"; title: string; message: string; link: string | null; type: string }[]) {
    const toAdmin = row.to_role === "admin";
    if (toAdmin) owners ??= await ownerIds();
    const users = toAdmin ? owners ?? [] : row.staff_id ? [row.staff_id] : [];
    const r = await sendPushToUsers(users, {
      title: toAdmin ? `Haru: ${row.title}` : row.title,
      body: row.message,
      url: toAdmin ? "/admin/staff-tasks" : row.link ?? "/staff/notifications",
      tag: `note-${row.id}`,
      icon: "/mascots/girl-face.png",
      sound: row.type === "bonus" ? "payment" : "default",
    }, toAdmin ? "staff_work" : undefined);
    n += r.sent;
  }
  return n;
}

/** Fire-and-forget helper for server actions and route handlers. */
export async function dispatchPendingPushesSafe() {
  try {
    await dispatchPendingPushes();
  } catch (e) {
    console.error("[push] dispatch failed", (e as Error).message);
  }
}

// ---- Devices ("My Devices Receiving Push") ------------------------------------------------

export interface PushDevice {
  alertTypes: AlertType[];
  id: string;
  name: string;
  browser: string | null;
  createdAt: string;
  lastActiveAt: string;
  lastUsedAt: string | null;
}

export async function myDevices(userId: string): Promise<PushDevice[]> {
  const { data } = await createServiceClient()
    .from("push_subscriptions")
    .select("id, device_name, browser, created_at, last_active_at, last_used_at, alert_types")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });
  return (data ?? []).map((d) => ({ alertTypes: (d.alert_types ?? [...ALERT_TYPES]) as AlertType[], id: d.id, name: d.device_name, browser: d.browser, createdAt: d.created_at, lastActiveAt: d.last_active_at, lastUsedAt: d.last_used_at }));
}

/** Removes one of the person's own devices (by id or by browser endpoint). */
export async function revokeDevice(userId: string, by: { id?: string | null; endpoint?: string | null }): Promise<number> {
  if (!by.id && !by.endpoint) return 0;
  let q = createServiceClient().from("push_subscriptions").delete().eq("user_id", userId);
  q = by.id ? q.eq("id", by.id) : q.eq("endpoint", by.endpoint!);
  const { data } = await q.select("id");
  return data?.length ?? 0;
}

export async function revokeAllDevices(userId: string): Promise<number> {
  const { data } = await createServiceClient().from("push_subscriptions").delete().eq("user_id", userId).select("id");
  return data?.length ?? 0;
}

/**
 * The device was used on the site while signed in: keep it active. Never re-creates a
 * device that was revoked — returns false so the browser drops its subscription.
 */
export async function touchDevice(userId: string, endpoint: string): Promise<{ exists: boolean; id: string | null }> {
  const { data } = await createServiceClient()
    .from("push_subscriptions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .select("id");
  return { exists: Boolean(data?.length), id: data?.[0]?.id ?? null };
}

/** A person changes which alerts one of their devices gets (the database checks it's theirs). */
export async function setDeviceAlertTypes(deviceId: string, types: AlertType[]): Promise<AlertType[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { data, error } = await db.rpc("set_push_alert_types", { p_device_id: deviceId, p_types: types });
  if (error) throw new Error(error.message.includes("not_found") ? "not_found" : "failed");
  return data as AlertType[];
}

/**
 * Send any new alerts as pushes once the current response is finished (orders, payments,
 * transfers, stock, staff work all create them in the database). Safe to call anywhere.
 */
export function schedulePushDispatch() {
  try {
    after(dispatchPendingPushesSafe);
  } catch {
    void dispatchPendingPushesSafe(); // outside a request (e.g. a script)
  }
}
