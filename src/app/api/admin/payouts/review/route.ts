import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { PaymentError, reviewWithdrawal } from "@/lib/staff-payments";

const body = z.object({ payment_id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(300).optional().nullable() });

/** POST /api/admin/payouts/review — the owner approves (marks paid) or declines a withdrawal request. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await assertPermission("staff:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const r = await reviewWithdrawal({ paymentId: parsed.data.payment_id, approve: parsed.data.approve, note: parsed.data.note });
    revalidatePath("/admin/staff");
    revalidatePath("/staff/earnings");
    return NextResponse.json({ ok: true, status: r.status, amount: r.amount, total_withdrawn: r.totalWithdrawn, pending_amount: r.pendingAmount, balance_left: r.balanceLeft });
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
