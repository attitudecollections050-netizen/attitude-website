import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { formatWhatsApp } from "@/lib/whatsapp";
import { paymentConfirmedMessage, paymentNotFoundMessage } from "@/lib/payments/bank-transfer";
import { reviewTransfer } from "@/app/admin/actions/transfers";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, PageHeader, inputCls } from "@/components/admin/ui";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";

export const metadata = { title: "Verify transfer" };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—");

type Claim = {
  id: string; customer_name: string; amount_paid: number; transfer_reference: string; whatsapp: string; proof_path: string | null; status: "pending" | "verified" | "declined";
  admin_note: string | null; created_at: string; reviewed_at: string | null;
  order: { id: string; order_number: string; total: number; currency: string; email: string; access_token: string; status: string; payment_status: string } | null;
};

export default async function TransferDetailPage({ params }: PageProps<"/admin/transfers/[id]">) {
  await requireStaffPage("payments:verify");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const { data } = await db
    .from("payment_claims")
    .select("id, customer_name, amount_paid, transfer_reference, whatsapp, proof_path, status, admin_note, created_at, reviewed_at, order:orders ( id, order_number, total, currency, email, access_token, status, payment_status )")
    .eq("id", id)
    .maybeSingle();
  const claim = data as unknown as Claim | null;
  if (!claim?.order) notFound();
  const order = claim.order;
  const settings = await getSettings();
  const bank = settings.bank_transfer;

  // Receipt screenshots are private; this link works for 10 minutes and only for the owner.
  const proofUrl = claim.proof_path ? (await createServiceClient().storage.from("payment-proofs").createSignedUrl(claim.proof_path, 600)).data?.signedUrl ?? null : null;
  const isPdf = claim.proof_path?.endsWith(".pdf");
  const diff = claim.amount_paid - order.total;
  const info = { name: claim.customer_name, orderNumber: order.order_number, amountKobo: claim.status === "verified" ? order.total : claim.amount_paid, reference: claim.transfer_reference, storeName: settings.store.name };
  const confirmedMsg = paymentConfirmedMessage({ ...info, orderUrl: `${env.siteUrl}/order/${order.order_number}?token=${order.access_token}` });
  const declinedMsg = paymentNotFoundMessage({ ...info, transferUrl: `${env.siteUrl}/checkout/transfer/${order.order_number}?token=${order.access_token}`, phone: settings.store.support_phone ?? (settings.store.whatsapp ? formatWhatsApp(settings.store.whatsapp) : null) });

  return (
    <div className="max-w-5xl">
      <PageHeader title={`Transfer for ${order.order_number}`} back={{ href: "/admin/transfers", label: "Bank Transfers" }} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-2xl border border-rose/20 bg-[radial-gradient(120%_140%_at_0%_0%,#fff0f5_0%,#ffffff_60%)] p-6 shadow-[0_20px_50px_-36px_rgba(184,53,122,0.6)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-deep">Customer says they sent</p>
                <p className="mt-1 text-4xl font-extrabold tabular-nums text-plum" data-testid="claim-amount">{formatMoney(claim.amount_paid, order.currency)}</p>
                <p className="mt-1 text-sm text-plum-soft">Order total: <strong className="text-plum">{formatMoney(order.total, order.currency)}</strong></p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={claim.status === "verified" ? "success" : claim.status === "declined" ? "danger" : "warning"}>{claim.status === "pending" ? "Waiting for you" : claim.status === "verified" ? "Confirmed" : "Declined"}</Badge>
                {diff === 0 ? <Badge tone="success">Matches order total</Badge> : <Badge tone="danger">{diff < 0 ? `${formatMoney(-diff)} less than total` : `${formatMoney(diff)} more than total`}</Badge>}
              </div>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Name on bank account">{claim.customer_name}</Item>
              <Item label="Transaction reference"><span className="font-mono text-base font-bold tracking-wide" data-testid="claim-reference">{claim.transfer_reference}</span></Item>
              <Item label="WhatsApp"><WhatsAppLink number={claim.whatsapp} showNumber /></Item>
              <Item label="Email">{order.email}</Item>
              <Item label="Submitted">{when(claim.created_at)}</Item>
              <Item label="Order"><Link href={`/admin/orders/${order.id}`} className="font-semibold text-rose-deep underline underline-offset-4">{order.order_number}</Link></Item>
            </dl>
          </section>

          <Card title="Receipt screenshot">
            {proofUrl ? (
              isPdf ? (
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-deep underline">Open the PDF receipt</a>
              ) : (
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
                  <img src={proofUrl} alt={`Transfer receipt from ${claim.customer_name}`} className="max-h-[32rem] w-auto rounded-xl border border-line" />
                </a>
              )
            ) : (
              <p className="text-sm text-muted">No screenshot was uploaded. You can ask for one on WhatsApp if you need it.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {claim.status === "pending" ? (
            <Card title="Check, then decide" description={`Open your ${bank.bank_name || "bank"} app and look for ${formatMoney(claim.amount_paid, order.currency)} from ${claim.customer_name} with reference ${claim.transfer_reference}.`}>
              <div className="space-y-5">
                <ActionForm action={reviewTransfer} submitLabel="Verified — confirm payment" variant="rose" confirm={`Confirm you've received ${formatMoney(claim.amount_paid, order.currency)} from ${claim.customer_name}? Order ${order.order_number} will be marked as paid.`}>
                  <input type="hidden" name="claim_id" value={claim.id} />
                  <input type="hidden" name="decision" value="verified" />
                  <p className="flex items-start gap-2 text-xs text-plum-soft"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> The order becomes Paid, stock is updated and the customer gets their receipt by email.</p>
                </ActionForm>
                <div className="border-t border-line pt-5">
                  <ActionForm action={reviewTransfer} submitLabel="Not found — decline" variant="outline" confirm="Decline this transfer? The customer will be asked to check their reference and submit again.">
                    <input type="hidden" name="claim_id" value={claim.id} />
                    <input type="hidden" name="decision" value="declined" />
                    <label className="block text-xs font-semibold text-plum">Note to the customer (optional)
                      <textarea name="note" rows={2} maxLength={500} className={`${inputCls} mt-1 w-full`} placeholder="e.g. The amount we received was less than the order total." />
                    </label>
                    <p className="flex items-start gap-2 text-xs text-plum-soft"><XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> Nothing is charged or cancelled. They can submit the correct details again.</p>
                  </ActionForm>
                </div>
              </div>
            </Card>
          ) : (
            <Card title={claim.status === "verified" ? "Payment confirmed" : "Transfer declined"} description={`Reviewed ${when(claim.reviewed_at)}`}>
              {claim.admin_note && <p className="mb-4 rounded-lg bg-neutral px-3 py-2 text-sm">Note: {claim.admin_note}</p>}
              <p className="text-sm text-plum-soft">{claim.status === "verified" ? "The order is paid and ready to process. Let the customer know on WhatsApp:" : "The customer has been emailed. Let them know on WhatsApp too:"}</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-rose/20 bg-blush p-4 font-sans text-sm text-plum" data-testid="wa-preview">{claim.status === "verified" ? confirmedMsg : declinedMsg}</pre>
              <div className="mt-4">
                <WhatsAppLink number={claim.whatsapp} variant="button" label={claim.status === "verified" ? "Send confirmation on WhatsApp" : "Send message on WhatsApp"} message={claim.status === "verified" ? confirmedMsg : declinedMsg} />
              </div>
            </Card>
          )}
          <Card title="Order status">
            <p className="text-sm">Order: <strong className="capitalize">{order.status.replace(/_/g, " ")}</strong></p>
            <p className="mt-1 text-sm">Payment: <strong className="capitalize">{order.payment_status === "paid" ? "Payment verified — order processing" : order.payment_status === "pending" ? "Waiting for verification" : order.payment_status}</strong></p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
