import "server-only";
import { createClient } from "@/lib/supabase/server";

// Staff payments (see migration 20261030000018_staff_payments.sql). Amounts are naira.
// Everything runs with the signed-in person's session, so the database decides who may
// see or pay what: the owner sees and pays everyone, staff only see themselves.

export type PaymentType = "withdrawal" | "earning" | "bonus";
export const PAYMENT_TYPES: PaymentType[] = ["withdrawal", "bonus", "earning"];

export interface StaffPaymentTotals {
  userId: string;
  name: string | null;
  email: string;
  productsAdded: number;
  productEarnings: number;
  extraEarnings: number;
  totalEarnings: number;
  totalWithdrawn: number;
  balanceLeft: number;
  lastPaidAt: string | null;
}

export interface StaffPayment {
  id: string;
  staffId: string;
  amount: number;
  type: PaymentType;
  description: string | null;
  createdAt: string;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, [string, number]> = {
  forbidden: ["Only the store owner can do that.", 403],
  invalid_amount: ["Enter an amount between ₦0.01 and ₦100,000,000 (at most 2 decimals).", 400],
  invalid_type: ["Choose withdrawal, bonus or earning.", 400],
  not_staff: ["That person isn't on your staff list.", 404],
};
function toError(e: { message: string } | null): PaymentError {
  const key = Object.keys(MESSAGES).find((k) => e?.message.includes(k));
  const [msg, status] = key ? MESSAGES[key] : ["Something went wrong. Please try again.", 500];
  return new PaymentError(msg, status);
}

type TotalsRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  products_added: number;
  product_earnings: string | number;
  extra_earnings: string | number;
  total_earnings: string | number;
  total_withdrawn: string | number;
  balance_left: string | number;
  last_paid_at: string | null;
};
const mapTotals = (r: TotalsRow): StaffPaymentTotals => ({
  userId: r.user_id,
  name: r.full_name,
  email: r.email,
  productsAdded: r.products_added,
  productEarnings: Number(r.product_earnings),
  extraEarnings: Number(r.extra_earnings),
  totalEarnings: Number(r.total_earnings),
  totalWithdrawn: Number(r.total_withdrawn),
  balanceLeft: Number(r.balance_left),
  lastPaidAt: r.last_paid_at,
});

/** Totals for every staff member (owner), or for one person (owner, or that person). */
export async function staffPaymentTotals(userId?: string): Promise<StaffPaymentTotals[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("staff_payment_totals", { p_user_id: userId ?? null });
  if (error) throw toError(error);
  return ((data ?? []) as TotalsRow[]).map(mapTotals);
}

/** Payment history, newest first. Staff only ever get their own rows (database rule). */
export async function staffPaymentHistory(userId?: string, limit = 100): Promise<StaffPayment[]> {
  const db = await createClient();
  let q = db.from("staff_payments").select("id, staff_id, amount, type, description, created_at").order("created_at", { ascending: false }).limit(limit);
  if (userId) q = q.eq("staff_id", userId);
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data ?? []).map((r) => ({ id: r.id, staffId: r.staff_id, amount: Number(r.amount), type: r.type as PaymentType, description: r.description, createdAt: r.created_at }));
}

/** The owner records a payment (a withdrawal/payout by default) and gets the new totals. */
export async function payStaff(input: { staffId: string; amount: number; description?: string | null; type?: PaymentType }) {
  const db = await createClient();
  const { data, error } = await db.rpc("pay_staff", {
    p_staff_id: input.staffId,
    p_amount: input.amount,
    p_description: input.description ?? null,
    p_type: input.type ?? "withdrawal",
  });
  if (error) throw toError(error);
  const r = data as { payment_id: string; total_earnings: number; total_withdrawn: number; balance_left: number };
  return { paymentId: r.payment_id, totalEarnings: Number(r.total_earnings), totalWithdrawn: Number(r.total_withdrawn), balanceLeft: Number(r.balance_left) };
}

/** ₦ with kobo only when needed: ₦12,500 or ₦12,500.50. */
export function naira(n: number): string {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
