import "server-only";
import webpush from "web-push";
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
}

type SubRow = { id: string; user_id: string; subscription: webpush.PushSubscription };

/** Sends to every saved device of these people. Removes devices that are gone (404/410). Returns how many got it. */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<{ sent: number; devices: number }> {
  if (!isPushConfigured() || userIds.length === 0) return { sent: 0, devices: 0 };
  setup();
  const svc = createServiceClient();
  const { data } = await svc.from("push_subscriptions").select("id, user_id, subscription").in("user_id", [...new Set(userIds)]);
  const subs = (data ?? []) as SubRow[];
  const payload = JSON.stringify({ ...msg, url: msg.url.startsWith("/") ? msg.url : "/admin/notifications" });
  let sent = 0;
  const gone: string[] = [];
  const used: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload, { TTL: 60 * 60 * 24, urgency: "high" });
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
  if (error || !data?.length) return 0;
  let owners: string[] | null = null;
  let n = 0;
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
    });
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
