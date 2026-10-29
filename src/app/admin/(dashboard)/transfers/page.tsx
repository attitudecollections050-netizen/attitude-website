import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { bankTransferActive } from "@/lib/payments/bank-transfer";
import { Badge, Empty, PageHeader, Table } from "@/components/admin/ui";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { Notice } from "@/components/ui/Notice";
import { cn } from "@/lib/cn";

export const metadata = { title: "Bank Transfers" };

const TABS = [
  { key: "pending", label: "Waiting for you" },
  { key: "verified", label: "Confirmed" },
  { key: "declined", label: "Declined" },
] as const;

const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

type Row = {
  id: string; customer_name: string; amount_paid: number; transfer_reference: string; whatsapp: string; proof_path: string | null; status: string; created_at: string; reviewed_at: string | null;
  order: { order_number: string; total: number; currency: string } | null;
};

export default async function TransfersPage({ searchParams }: PageProps<"/admin/transfers">) {
  await requireStaffPage("payments:verify");
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "pending";
  const db = await createClient();
  const [{ data }, { data: counts }, settings] = await Promise.all([
    db
      .from("payment_claims")
      .select("id, customer_name, amount_paid, transfer_reference, whatsapp, proof_path, status, created_at, reviewed_at, order:orders ( order_number, total, currency )")
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" })
      .limit(200),
    db.from("payment_claims").select("status").eq("status", "pending"),
    getSettings(),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const pendingCount = counts?.length ?? 0;
  const bank = settings.bank_transfer;

  return (
    <div>
      <PageHeader
        title="Bank Transfers"
        description="Customers who paid by bank transfer appear here. Check your bank app, then confirm or decline each one. Confirming marks the order as paid."
      />
      {!bankTransferActive(bank) && (
        <Notice tone="warning" className="mb-5">Bank transfer is switched off or your bank details are incomplete. Turn it on in <Link href="/admin/settings#bank-transfer" className="underline">Store Settings</Link>.</Notice>
      )}
      {bankTransferActive(bank) && (
        <p className="mb-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-rose/20 bg-blush px-4 py-2 text-xs text-plum-soft">
          Customers pay into <strong className="text-plum">{bank.bank_name} · {bank.account_number} · {bank.account_name}</strong>
          <Link href="/admin/settings#bank-transfer" className="font-semibold text-rose-deep underline underline-offset-2">Change</Link>
        </p>
      )}

      <nav aria-label="Transfer status" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/transfers?status=${t.key}`}
            aria-current={status === t.key ? "page" : undefined}
            className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition", status === t.key ? "border-rose bg-rose text-white" : "border-line bg-white text-plum-soft hover:border-rose hover:text-rose-deep")}
          >
            {t.label}
            {t.key === "pending" && pendingCount > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[10px]", status === "pending" ? "bg-white text-rose-deep" : "bg-rose text-white")}>{pendingCount}</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty>{status === "pending" ? "No transfers waiting. New ones will appear here as soon as a customer taps “I Have Paid”." : "Nothing here yet."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr><th>Submitted</th><th>Order</th><th>Customer</th><th>Amount paid</th><th>Reference</th><th>WhatsApp</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const due = r.order?.total ?? 0;
              const diff = r.amount_paid - due;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{when(r.created_at)}</td>
                  <td className="font-semibold">{r.order?.order_number}</td>
                  <td>{r.customer_name}{r.proof_path && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-deep">· Receipt</span>}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatMoney(r.amount_paid, r.order?.currency)}
                    {diff !== 0 && <span className="block"><Badge tone={diff < 0 ? "danger" : "warning"}>{diff < 0 ? `${formatMoney(-diff)} short` : `${formatMoney(diff)} over`}</Badge></span>}
                  </td>
                  <td className="font-mono text-xs">{r.transfer_reference}</td>
                  <td><WhatsAppLink number={r.whatsapp} showNumber /></td>
                  <td className="text-right">
                    <Link href={`/admin/transfers/${r.id}`} className="inline-flex whitespace-nowrap rounded-full bg-plum px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-rose-deep">
                      {r.status === "pending" ? "View & verify" : "View details"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
