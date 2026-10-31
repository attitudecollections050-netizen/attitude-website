import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { markTaskCorrected, WorkError } from "@/lib/staff-work";

const body = z.object({ task_id: z.string().uuid() });

/** POST /api/staff/tasks/corrected { task_id } — a staff member says they fixed work rated Poor. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit("task-corrected", 30, 600))) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await markTaskCorrected(parsed.data.task_id);
    revalidatePath("/staff/notifications");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e instanceof WorkError ? e : new WorkError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
