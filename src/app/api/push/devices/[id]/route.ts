import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, revokeDevice, setDeviceAlertTypes } from "@/lib/push";

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

const types = z.array(z.enum(["staff_work", "orders", "payments", "low_stock"])).max(4);

/** PATCH /api/push/devices/:id { alert_types } — which alerts this device gets. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  const body = types.safeParse((await request.json().catch(() => null))?.alert_types);
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, alert_types: await setDeviceAlertTypes(id.data, body.data) });
  } catch (e) {
    const nf = (e as Error).message === "not_found";
    return NextResponse.json({ error: nf ? "That device wasn't found (maybe revoked)." : "Couldn't save." }, { status: nf ? 404 : 500 });
  }
}
