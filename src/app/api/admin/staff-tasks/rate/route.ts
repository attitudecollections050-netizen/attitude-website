import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateTask, WorkError } from "@/lib/staff-work";

const body = z
  .object({
    task_id: z.string().uuid(),
    rating: z.enum(["good", "poor"]),
    reason: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)),
  })
  .refine((b) => b.rating === "good" || (b.reason?.length ?? 0) >= 3, { message: "Tell them what was wrong, so they can fix it.", path: ["reason"] });

/** POST /api/admin/staff-tasks/rate { task_id, rating: "good" | "poor", reason } — the owner rates a piece of staff work. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await assertPermission("staff:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  if (!(await rateLimit("rate-staff", 120, 600))) return NextResponse.json({ error: "Too many ratings at once. Please wait a moment." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rating." }, { status: 400 });
  try {
    const r = await rateTask({ taskId: parsed.data.task_id, rating: parsed.data.rating, reason: parsed.data.reason });
    revalidatePath("/admin/staff-tasks");
    revalidatePath("/admin/staff");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const err = e instanceof WorkError ? e : new WorkError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
