import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminHome } from "@/lib/permissions";
import { PRODUCTS_PER_REWARD, REWARD_KOBO, earningsFor } from "@/lib/staff-earnings";
import { formatMoney } from "@/lib/money";
import { MIN_WITHDRAWAL, NIGERIAN_BANKS, isPaid, naira, staffPaymentHistory, staffPaymentTotals, type StaffPayment } from "@/lib/staff-payments";
import { BankDetailsForm, WithdrawButton } from "@/components/admin/StaffBank";
import { PaymentsLive } from "@/components/admin/PayStaff";

export const metadata = { title: "My Earnings" };

const dateFmt = new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Lagos" });
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ Waiting for approval", cls: "text-[#EA580C]" },
  paid: { label: "✅ Paid", cls: "text-[#16A34A]" },
  confirmed: { label: "✅ Paid", cls: "text-[#16A34A]" },
  rejected: { label: "❌ Declined", cls: "text-danger" },
};

/** My Earnings: totals, bank details and the "Withdraw to my account" button. */
export default async function StaffEarningsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, roles, permissions } = await requireStaffPage(null);
  const isOwner = roles.includes("admin");
  const sp = await searchParams;
  const as = typeof sp.as === "string" && /^[0-9a-f-]{36}$/.test(sp.as) ? sp.as : null;
  let targetId = user.id;
  if (isOwner) {
    if (!as) redirect("/admin/staff");
    targetId = as;
  } else if (!permissions.includes("earnings:self")) {
    redirect(adminHome(permissions));
  }

  const db = await createClient();
  const [{ data: staff }, [totals], payments] = await Promise.all([
    db.from("staff_members").select("full_name, email").eq("user_id", targetId).maybeSingle(),
    staffPaymentTotals(targetId).catch(() => []),
    staffPaymentHistory(targetId).catch((): StaffPayment[] => []),
  ]);
  if (isOwner && !staff) redirect("/admin/staff");

  const earned = totals?.totalEarnings ?? 0;
  const withdrawn = totals?.totalWithdrawn ?? 0;
  const pending = totals?.pendingAmount ?? 0;
  const balance = totals?.balanceLeft ?? 0;
  const bank = totals?.bank ?? null;
  const request = payments.find((p) => p.type === "withdrawal" && p.status === "pending") ?? null;
  const lastPaid = payments.find(isPaid) ?? null;
  const lastDeclined = payments.find((p) => p.type === "withdrawal" && p.status === "rejected" && (!lastPaid || p.createdAt > lastPaid.createdAt)) ?? null;
  const progress = earningsFor(totals?.productsAdded ?? 0);
  const reward = formatMoney(REWARD_KOBO);

  return (
    <div className="space-y-8">
      <PaymentsLive staffId={targetId} />
      {isOwner && <p className="border border-black px-4 py-3 text-xs uppercase tracking-[0.16em]">Viewing as staff (read only) — this is what {staff?.email} sees.</p>}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/50">My earnings</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Earnings &amp; withdrawals</h1>
        <p className="mt-1 text-sm text-black/60">{reward} for every {PRODUCTS_PER_REWARD} products you add · {progress.remaining} more for the next {reward}</p>
      </div>

      <section className="grid gap-px border border-black bg-black sm:grid-cols-3" aria-label="My totals" data-testid="payment-cards">
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Total earned</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#2563EB] sm:text-5xl" data-testid="total-earned">{naira(earned)}</p>
          <p className="mt-1 text-xs text-black/60">{totals?.productsAdded ?? 0} products added</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Total withdrawn</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#EA580C] sm:text-5xl" data-testid="total-withdrawn">{naira(withdrawn)}</p>
          <p className="mt-1 text-xs text-black/60">{pending > 0 ? `+ ${naira(pending)} waiting for approval` : lastPaid ? `Last paid ${dateFmt.format(new Date(lastPaid.approvedAt ?? lastPaid.createdAt))}` : "Nothing withdrawn yet"}</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Balance left</p>
          <p className={`mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl ${balance < 0 ? "text-danger" : "text-[#16A34A]"}`} data-testid="balance-left">{naira(balance)}</p>
          <p className="mt-1 text-xs text-black/60">Available to withdraw (from {naira(MIN_WITHDRAWAL)})</p>
        </div>
      </section>

      <section aria-labelledby="withdraw-h" className="border border-black p-6" id="withdraw">
        <h2 id="withdraw-h" className="text-[11px] font-bold uppercase tracking-[0.18em]">Withdraw</h2>
        <div className="mt-4">
          {request ? (
            <p className="border-2 border-[#EA580C] bg-[#FFF7ED] p-4 text-sm font-semibold text-[#9A3412]" role="status" data-testid="withdraw-pending">
              Withdrawal request of {naira(request.amount)} sent! ✓ To {request.bank ? `${request.bank.bankName} · ${request.bank.accountNumber} · ${request.bank.accountName}` : "your account"} on{" "}
              {dateFmt.format(new Date(request.createdAt))}. Waiting for the owner to send it and approve.
            </p>
          ) : isOwner ? (
            <p className="text-sm text-black/60">No withdrawal request right now.</p>
          ) : balance >= MIN_WITHDRAWAL ? (
            <WithdrawButton balance={balance} bank={bank} min={MIN_WITHDRAWAL} />
          ) : (
            <p className="text-sm text-black/60" data-testid="withdraw-none">
              You can withdraw once your balance reaches {naira(MIN_WITHDRAWAL)}. Keep adding products — every {PRODUCTS_PER_REWARD} adds {reward}.
            </p>
          )}
          {lastPaid && !request && (
            <p className="mt-3 text-sm font-semibold text-[#166534]" data-testid="paid-banner">
              ✅ You have been paid {naira(lastPaid.amount)} on {dateFmt.format(new Date(lastPaid.approvedAt ?? lastPaid.createdAt))}.
            </p>
          )}
          {lastDeclined && !request && (
            <p className="mt-3 text-sm font-semibold text-danger" data-testid="declined-banner">
              ❌ Your request for {naira(lastDeclined.amount)} was declined{lastDeclined.adminNote ? `: “${lastDeclined.adminNote}”` : "."} The money is back in your balance.
            </p>
          )}
        </div>
      </section>

      <BankDetailsForm banks={NIGERIAN_BANKS} initial={bank} readOnly={isOwner} />

      <section aria-labelledby="pay-history">
        <h2 id="pay-history" className="mb-4 font-display text-3xl">Withdrawal history</h2>
        {payments.length === 0 ? (
          <p className="border border-dashed border-black/30 px-6 py-8 text-center text-sm text-black/60">No withdrawals yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black">
            <table className="w-full min-w-[36rem] text-left text-sm" data-testid="payment-history">
              <thead className="border-b border-black text-[11px] uppercase tracking-[0.16em]">
                <tr><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 font-bold">Amount</th><th className="px-4 py-3 font-bold">To account</th><th className="px-4 py-3 font-bold">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-black/60">{dateFmt.format(new Date(p.createdAt))}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{p.type === "withdrawal" || p.type === "penalty" ? "−" : "+"}{naira(p.amount)}</td>
                    <td className="px-4 py-3 text-xs">{p.bank ? `${p.bank.bankName} · ${p.bank.accountNumber}` : p.description ?? "—"}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${STATUS[p.status]?.cls ?? ""}`}>
                      {p.type === "withdrawal" ? STATUS[p.status]?.label ?? p.status : p.type === "penalty" ? "🌱 Deducted" : "✅ Added"}
                      {p.status === "rejected" && p.adminNote && <span className="block font-normal text-black/60">“{p.adminNote}”</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm">
        <Link href="/staff/dashboard" className="underline underline-offset-4">← Back to my dashboard</Link>
      </p>
    </div>
  );
}
