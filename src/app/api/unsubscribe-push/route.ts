import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, revokeDevice } from "@/lib/push";

/**
 * POST /api/unsubscribe-push { endpoint? } — this device stops getting the signed-in person's
 * push notifications (called on logout). Uses the endpoint sent, or this browser's device cookie.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEVICE_COOKIE);
  if (!user) return res;
  const endpoint = z.string().url().max(2000).safeParse((await request.json().catch(() => null))?.endpoint);
  const id = z.string().uuid().safeParse(request.cookies.get(DEVICE_COOKIE)?.value);
  if (endpoint.success) await revokeDevice(user.id, { endpoint: endpoint.data });
  if (id.success) await revokeDevice(user.id, { id: id.data });
  return res;
}
