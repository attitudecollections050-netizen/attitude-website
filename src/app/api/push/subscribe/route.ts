import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getCurrentPermissions } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { isPushConfigured } from "@/lib/push";

const sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === request.nextUrl.host;
};

/** POST /api/push/subscribe { subscription } — saves this device for push (owner and staff only). */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if ((await getCurrentPermissions()).length === 0) return NextResponse.json({ error: "Push notifications are for the store team." }, { status: 403 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet (VAPID keys missing)." }, { status: 503 });
  if (!(await rateLimit("push-subscribe", 20, 600))) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const parsed = sub.safeParse(body?.subscription);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  const svc = createServiceClient();
  // A device belongs to whoever enabled push on it last.
  await svc.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await svc.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    subscription: parsed.data,
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (error) return NextResponse.json({ error: "Couldn't save this device." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe { endpoint } — stops push on this device. */
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const endpoint = z.string().url().max(2000).safeParse((await request.json().catch(() => null))?.endpoint);
  if (!endpoint.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  await createServiceClient().from("push_subscriptions").delete().eq("endpoint", endpoint.data).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
