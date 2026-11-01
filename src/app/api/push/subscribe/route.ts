import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getCurrentPermissions } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { DEVICE_COOKIE, isPushConfigured, MAX_DEVICES, revokeDevice, touchDevice } from "@/lib/push";
import { deviceFromUA } from "@/lib/device-name";

const sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});
// Device names come from the browser: keep them short, single-line, printable.
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) || null : null;

const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === request.nextUrl.host;
};
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 400 };

async function team() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  if ((await getCurrentPermissions()).length === 0) return { error: NextResponse.json({ error: "Push notifications are for the store team." }, { status: 403 }) };
  return { user };
}

/** POST /api/push/subscribe { subscription, device } — "Enable Push Notifications" on this device (max 3 per person). */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await team();
  if (t.error) return t.error;
  if (!isPushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet (VAPID keys missing)." }, { status: 503 });
  if (!(await rateLimit("push-subscribe", 20, 600))) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const parsed = sub.safeParse(body?.subscription);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  const ua = request.headers.get("user-agent")?.slice(0, 400) ?? "";
  const guess = deviceFromUA(ua);
  const svc = createServiceClient();
  // A browser belongs to whoever enabled push on it last.
  await svc.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { data, error } = await svc
    .from("push_subscriptions")
    .insert({
      user_id: t.user.id,
      endpoint: parsed.data.endpoint,
      subscription_json: parsed.data,
      device_name: clean(body?.device?.name, 80) ?? guess.name,
      browser: clean(body?.device?.browser, 40) ?? guess.browser,
      user_agent: ua || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("too_many_devices"))
      return NextResponse.json({ error: `You already have ${MAX_DEVICES} devices getting push. Revoke one under “My Devices Receiving Push” first.`, code: "too_many_devices" }, { status: 409 });
    return NextResponse.json({ error: "Couldn't save this device." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true, id: data.id });
  res.cookies.set(DEVICE_COOKIE, data.id, cookieOpts);
  return res;
}

/** PATCH /api/push/subscribe { endpoint } — this device is in use: keep it active. Never re-adds a revoked device. */
export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await team();
  if (t.error) return t.error;
  const endpoint = z.string().url().max(2000).safeParse((await request.json().catch(() => null))?.endpoint);
  if (!endpoint.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const r = await touchDevice(t.user.id, endpoint.data);
  const res = NextResponse.json({ ok: true, exists: r.exists, id: r.id });
  if (r.id) res.cookies.set(DEVICE_COOKIE, r.id, cookieOpts);
  return res;
}

/** DELETE /api/push/subscribe { endpoint } — stops push on this device. */
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const endpoint = z.string().url().max(2000).safeParse((await request.json().catch(() => null))?.endpoint);
  if (!endpoint.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  await revokeDevice(user.id, { endpoint: endpoint.data });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEVICE_COOKIE);
  return res;
}
