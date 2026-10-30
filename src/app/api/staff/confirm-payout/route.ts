import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { confirmMyPayout, PaymentError } from "@/lib/staff-payments";

const body = z.object({ payment_id: z.string().uuid(), received: z.boolean(), note: z.string().trim().max(300).optional().nullable() });

/** POST /api/staff/confirm-payout — the staff member says whether a payout reached them. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const r = await confirmMyPayout({ paymentId: parsed.data.payment_id, received: parsed.data.received, note: parsed.data.note });
    revalidatePath("/staff/dashboard");
    revalidatePath("/admin/staff");
    return NextResponse.json({ ok: true, status: r.status, total_withdrawn: r.totalWithdrawn, pending_amount: r.pendingAmount, balance_left: r.balanceLeft });
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
