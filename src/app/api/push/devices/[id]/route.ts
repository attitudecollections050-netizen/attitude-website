import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, revokeDevice } from "@/lib/push";

/** DELETE /api/push/devices/:id — Revoke: that device stops getting your push notifications. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  const n = await revokeDevice(user.id, { id: id.data });
  if (!n) return NextResponse.json({ error: "That device wasn't found (maybe already revoked)." }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  if (request.cookies.get(DEVICE_COOKIE)?.value === id.data) res.cookies.delete(DEVICE_COOKIE);
  return res;
}
