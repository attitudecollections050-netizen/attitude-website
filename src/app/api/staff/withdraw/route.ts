import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PaymentError, requestWithdrawal } from "@/lib/staff-payments";

/** POST /api/staff/withdraw — a staff member requests their whole balance to their saved bank account. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit("withdraw", 10, 600))) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  try {
    const r = await requestWithdrawal();
    revalidatePath("/staff/earnings");
    revalidatePath("/admin/staff");
    return NextResponse.json({ ok: true, payment_id: r.paymentId, amount: r.amount, total_withdrawn: r.totalWithdrawn, pending_amount: r.pendingAmount, balance_left: r.balanceLeft });
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
