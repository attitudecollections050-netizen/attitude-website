import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PaymentError, staffPaymentHistory, staffPaymentTotals } from "@/lib/staff-payments";

/** GET /api/staff/my-payments — the signed-in staff member's own payment history and totals. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const [[totals], history] = await Promise.all([staffPaymentTotals(user.id), staffPaymentHistory(user.id)]);
    return NextResponse.json(
      {
        total_earnings: totals?.totalEarnings ?? 0,
        total_withdrawn: totals?.totalWithdrawn ?? 0,
        balance_left: totals?.balanceLeft ?? 0,
        history: history.map((p) => ({ id: p.id, amount: p.amount, type: p.type, description: p.description, created_at: p.createdAt })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
