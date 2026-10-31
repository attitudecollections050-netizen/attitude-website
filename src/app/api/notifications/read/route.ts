import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { markNotificationsRead, WorkError } from "@/lib/staff-work";

const body = z.object({ ids: z.array(z.string().uuid()).max(200).nullable().default(null) });

/** POST /api/notifications/read { ids | null } — marks the caller's own notifications read (null = all). */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, updated: await markNotificationsRead(parsed.data.ids) });
  } catch (e) {
    const err = e instanceof WorkError ? e : new WorkError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
