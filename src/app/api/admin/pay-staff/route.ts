import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PAYMENT_TYPES, PaymentError, payStaff } from "@/lib/staff-payments";

const body = z.object({
  staff_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(100_000_000).refine((n) => Math.round(n * 100) === n * 100, "At most 2 decimals"),
  description: z.string().trim().max(200).optional().nullable(),
  type: z.enum(PAYMENT_TYPES as [string, ...string[]]).optional(),
});

/** POST /api/admin/pay-staff — the owner records a staff payment. Body: { staff_id, amount, description?, type? } */
export async function POST(request: NextRequest) {
  // Same-site requests only (blocks other websites posting with the owner's cookies).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await assertPermission("staff:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  if (!(await rateLimit("pay-staff", 30, 600))) return NextResponse.json({ error: "Too many payments at once. Please wait a moment." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the staff member and amount." }, { status: 400 });
  try {
    const result = await payStaff({ staffId: parsed.data.staff_id, amount: parsed.data.amount, description: parsed.data.description, type: parsed.data.type as never });
    revalidatePath("/admin/staff");
    revalidatePath("/staff/dashboard");
    return NextResponse.json({
      ok: true,
      payment_id: result.paymentId,
      status: result.status,
      total_earnings: result.totalEarnings,
      total_withdrawn: result.totalWithdrawn,
      pending_amount: result.pendingAmount,
      balance_left: result.balanceLeft,
    });
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong. Please try again.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
