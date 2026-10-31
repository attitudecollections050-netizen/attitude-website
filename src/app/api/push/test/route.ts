import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getCurrentPermissions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isPushConfigured, sendPushToUsers } from "@/lib/push";

/** POST /api/push/test — sends a test push to every device of the signed-in person. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const perms = await getCurrentPermissions();
  if (perms.length === 0) return NextResponse.json({ error: "Push notifications are for the store team." }, { status: 403 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet (VAPID keys missing)." }, { status: 503 });
  if (!(await rateLimit("push-test", 10, 600))) return NextResponse.json({ error: "Too many test pushes. Please wait a few minutes." }, { status: 429 });
  const r = await sendPushToUsers([user.id], {
    title: "Haru: Test push 💖",
    body: "Annyeong! Push notifications work on this device. You'll hear from me when staff finish work ✨",
    url: perms.includes("staff:manage") ? "/admin/notifications" : "/staff/notifications",
    tag: `test-${Date.now()}`,
    icon: "/mascots/girl-face.png",
  });
  if (r.devices === 0) return NextResponse.json({ error: "No devices yet. Tap “Enable Push Notifications” first." }, { status: 409 });
  return NextResponse.json({ ok: true, ...r });
}
