import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getCurrentPermissions } from "@/lib/auth";
import { dispatchPendingPushes, isPushConfigured } from "@/lib/push";

/**
 * POST /api/send-push — sends any staff notifications not yet pushed. The site calls this
 * itself after staff work and ratings; it can also be called by a Supabase Database Webhook
 * or a cron with "Authorization: Bearer <CRON_SECRET>". It only ever sends real, unsent
 * notifications to their own recipients, so calling it twice is harmless.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") ?? "";
  const a = Buffer.from(auth), b = Buffer.from(`Bearer ${secret}`);
  const bySecret = Boolean(secret) && a.length === b.length && timingSafeEqual(a, b);
  if (!bySecret && (await getCurrentPermissions()).length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: true, sent: 0, configured: false });
  return NextResponse.json({ ok: true, sent: await dispatchPendingPushes(), configured: true });
}
