import { NextResponse } from "next/server";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { PaymentError, staffPaymentHistory, staffPaymentTotals } from "@/lib/staff-payments";

/** GET /api/admin/staff-payments — every staff member with total earnings, withdrawn and balance left (owner only). */
export async function GET() {
  try {
    await assertPermission("staff:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  try {
    const [staff, recent] = await Promise.all([staffPaymentTotals(), staffPaymentHistory(undefined, 50)]);
    return NextResponse.json(
      {
        staff: staff.map((s) => ({
          staff_id: s.userId,
          name: s.name ?? s.email,
          email: s.email,
          products_added: s.productsAdded,
          total_earnings: s.totalEarnings,
          total_withdrawn: s.totalWithdrawn,
          balance_left: s.balanceLeft,
          last_paid_at: s.lastPaidAt,
        })),
        recent_payments: recent.map((p) => ({ id: p.id, staff_id: p.staffId, amount: p.amount, type: p.type, description: p.description, created_at: p.createdAt })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
