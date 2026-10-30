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
  /** Confirmed payouts. */
  totalWithdrawn: number;
  /** Payouts sent but not yet confirmed by the staff member. */
  pendingAmount: number;
  balanceLeft: number;
  lastPaidAt: string | null;
  bank: BankDetails | null;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export type PaymentStatus = "pending" | "confirmed" | "rejected";

/** Nigerian banks and wallets for the bank dropdown ("Other" lets staff type one). */
export const NIGERIAN_BANKS = [
  "Access Bank", "Opay", "Palmpay", "Moniepoint", "Kuda", "UBA", "First Bank", "GTBank", "Zenith Bank", "Fidelity Bank", "FCMB",
  "Union Bank", "Sterling Bank", "Stanbic IBTC", "Wema Bank (ALAT)", "Polaris Bank", "Ecobank", "Keystone Bank", "Providus Bank",
  "Jaiz Bank", "Globus Bank", "Titan Trust Bank", "Unity Bank", "VFD Microfinance Bank", "Carbon", "Paga",
] as const;

/** "Access Bank - 0123456789 - ADA TEST" */
export const bankLine = (b: BankDetails | null) => (b ? `${b.bankName} - ${b.accountNumber} - ${b.accountName}` : null);

export interface StaffPayment {
  id: string;
  staffId: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  description: string | null;
  createdAt: string;
  confirmedAt: string | null;
  staffNote: string | null;
  /** Bank details the payout was sent to (copied when it was recorded). */
  bank: BankDetails | null;
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
  no_bank_details: ["They haven't added their bank details yet. Ask them to add them on their dashboard first.", 409],
  invalid_account_number: ["Account number must be exactly 10 digits.", 400],
  invalid_bank: ["Choose your bank.", 400],
  invalid_account_name: ["Enter the account name (as it appears on your bank account).", 400],
  not_found: ["Payment not found.", 404],
  already_answered: ["You've already answered for this payment.", 409],
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
  pending_amount: string | number;
  last_paid_at: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
};
const toBank = (r: { bank_name: string | null; account_number: string | null; account_name: string | null }): BankDetails | null =>
  r.bank_name && r.account_number && r.account_name ? { bankName: r.bank_name, accountNumber: r.account_number, accountName: r.account_name } : null;
const mapTotals = (r: TotalsRow): StaffPaymentTotals => ({
  userId: r.user_id,
  name: r.full_name,
  email: r.email,
  productsAdded: r.products_added,
  productEarnings: Number(r.product_earnings),
  extraEarnings: Number(r.extra_earnings),
  totalEarnings: Number(r.total_earnings),
  totalWithdrawn: Number(r.total_withdrawn),
  pendingAmount: Number(r.pending_amount ?? 0),
  balanceLeft: Number(r.balance_left),
  lastPaidAt: r.last_paid_at,
  bank: toBank(r),
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
  let q = db
    .from("staff_payments")
    .select("id, staff_id, amount, type, status, description, created_at, confirmed_at, staff_note, bank_name, account_number, account_name")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) q = q.eq("staff_id", userId);
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    amount: Number(r.amount),
    type: r.type as PaymentType,
    status: r.status as PaymentStatus,
    description: r.description,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    staffNote: r.staff_note,
    bank: toBank(r),
  }));
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
  const r = data as { payment_id: string; status: PaymentStatus; total_earnings: number; total_withdrawn: number; pending_amount: number; balance_left: number };
  return {
    paymentId: r.payment_id,
    status: r.status,
    totalEarnings: Number(r.total_earnings),
    totalWithdrawn: Number(r.total_withdrawn),
    pendingAmount: Number(r.pending_amount),
    balanceLeft: Number(r.balance_left),
  };
}

/** A staff member saves their own bank details (10-digit account number). */
export async function saveMyBankDetails(input: { bankName: string; accountNumber: string; accountName: string }) {
  const db = await createClient();
  const { error } = await db.rpc("set_my_bank_details", { p_bank_name: input.bankName, p_account_number: input.accountNumber, p_account_name: input.accountName });
  if (error) throw toError(error);
}

/** A staff member's own saved bank details. */
export async function myBankDetails(userId: string): Promise<BankDetails | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("staff_bank_details", { p_user_id: userId });
  if (error) throw toError(error);
  const r = (data ?? [])[0];
  return r ? toBank(r) : null;
}

/** A staff member confirms they received a payout (or says they didn't). */
export async function confirmMyPayout(input: { paymentId: string; received: boolean; note?: string | null }) {
  const db = await createClient();
  const { data, error } = await db.rpc("confirm_my_payout", { p_payment_id: input.paymentId, p_received: input.received, p_note: input.note ?? null });
  if (error) throw toError(error);
  const r = data as { status: PaymentStatus; total_withdrawn: number; pending_amount: number; balance_left: number };
  return { status: r.status, totalWithdrawn: Number(r.total_withdrawn), pendingAmount: Number(r.pending_amount), balanceLeft: Number(r.balance_left) };
}

/** ₦ with kobo only when needed: ₦12,500 or ₦12,500.50. */
export function naira(n: number): string {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
