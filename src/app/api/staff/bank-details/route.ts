import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PaymentError, saveMyBankDetails } from "@/lib/staff-payments";

const body = z.object({
  bank_name: z.string().trim().min(2).max(60),
  account_number: z.string().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits.")),
  account_name: z.string().trim().min(2).max(120),
});

/** POST /api/staff/bank-details — a staff member saves their own bank details. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit("bank-details", 10, 600))) return NextResponse.json({ error: "Too many changes. Please wait a few minutes." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your bank details." }, { status: 400 });
  try {
    await saveMyBankDetails({ bankName: parsed.data.bank_name, accountNumber: parsed.data.account_number, accountName: parsed.data.account_name });
    revalidatePath("/staff/dashboard");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e instanceof PaymentError ? e : new PaymentError("Something went wrong.", 500);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
