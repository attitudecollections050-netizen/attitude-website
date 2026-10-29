import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock3, Landmark, MessageCircleHeart, ReceiptText } from "lucide-react";
import { getOrderForCustomer } from "@/lib/orders/queries";
import { getSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/admin";
import { formatMoney, toMajorString } from "@/lib/money";
import { BankCard } from "@/components/checkout/BankCard";
import { TransferForm } from "@/components/checkout/TransferForm";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { customerPaidMessage } from "@/lib/payments/bank-transfer";

export const metadata: Metadata = { title: "Pay by bank transfer", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Landmark, title: "Transfer", body: "Send the exact amount to the account below." },
  { icon: ReceiptText, title: "Tell us", body: "Enter your reference and tap “I Have Paid”." },
  { icon: MessageCircleHeart, title: "We confirm", body: "We check our bank and message you on WhatsApp." },
];

export default async function BankTransferPage({ params, searchParams }: PageProps<"/checkout/transfer/[orderNumber]">) {
  const { orderNumber } = await params;
  const { token } = await searchParams;
  const order = await getOrderForCustomer(orderNumber, typeof token === "string" ? token : null);
  if (!order) notFound();
  const orderUrl = `/order/${order.order_number}?token=${order.access_token}`;
  if (order.payment_status === "paid" || order.payment_method !== "bank_transfer" || order.status !== "pending_payment") redirect(orderUrl);

  const [settings, { data: claims }] = await Promise.all([
    getSettings(),
    createServiceClient().from("payment_claims").select("status, transfer_reference, amount_paid, created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1),
  ]);
  const bank = settings.bank_transfer;
  const latest = claims?.[0];
  const total = formatMoney(order.total, order.currency);
  const whatsapp = settings.store.whatsapp;

  return (
    <div className="bg-[linear-gradient(180deg,var(--color-blush)_0%,#fff_420px)]">
      <div className="container-luxe max-w-6xl pb-24 pt-10 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-rose-deep">Order {order.order_number}</p>
            <h1 className="display mt-2 text-4xl sm:text-6xl">Complete your payment</h1>
            <p className="mt-3 max-w-xl text-sm text-plum-soft">Transfer <strong className="text-plum">{total}</strong> to our account, then share your transfer reference below. We&apos;ll confirm your order personally on WhatsApp.</p>
          </div>
          <WhatsAppLink number={whatsapp} label="Need help? Chat with us" message={`Hello ${settings.store.name}! I need help paying for order ${order.order_number}.`} />
        </div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="How it works">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-rose/15 bg-white/80 p-4 shadow-[0_1px_0_rgba(217,79,145,0.06)] backdrop-blur">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose to-rose-deep text-sm font-bold text-white shadow-[0_8px_16px_-8px_rgba(184,53,122,0.9)]">{i + 1}</span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-plum"><s.icon className="size-4 text-rose-deep" aria-hidden />{s.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-plum-soft">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <section aria-labelledby="bank-h" className="space-y-5 lg:sticky lg:top-24">
            <h2 id="bank-h" className="sr-only">Our bank details</h2>
            {bank.bank_name && bank.account_name && bank.account_number ? (
              <BankCard bankName={bank.bank_name} accountName={bank.account_name} accountNumber={bank.account_number} amount={total} amountPlain={toMajorString(order.total)} orderNumber={order.order_number} />
            ) : (
              <p className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm">Our bank details are being updated. Please chat with us on WhatsApp to complete your payment.</p>
            )}
            <ul className="space-y-2 rounded-2xl border border-line bg-white p-5 text-sm text-plum-soft">
              <li className="flex gap-2"><span className="text-rose-deep" aria-hidden>●</span><span>Transfer the <strong className="text-plum">exact amount</strong> in one payment so we can match it quickly.</span></li>
              <li className="flex gap-2"><span className="text-rose-deep" aria-hidden>●</span><span>Your order is reserved once we&apos;ve confirmed the money has arrived.</span></li>
              {bank.note && <li className="flex gap-2"><span className="text-rose-deep" aria-hidden>●</span><span>{bank.note}</span></li>}
            </ul>
          </section>

          <section aria-labelledby="form-h" className="rounded-[22px] border border-rose/15 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(184,53,122,0.45)] sm:p-8">
            {latest?.status === "pending" ? (
              <div className="text-center" data-testid="transfer-pending">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose-deep ring-1 ring-rose/25"><Clock3 className="size-7" aria-hidden /></span>
                <h2 id="form-h" className="mt-5 font-display text-3xl">We&apos;re verifying your payment</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-plum-soft">
                  Thanks for sending your details. We&apos;re checking for {formatMoney(latest.amount_paid, order.currency)} with reference <strong className="font-mono text-plum">{latest.transfer_reference}</strong>. We&apos;ll confirm on WhatsApp shortly — usually within 2–5 minutes during business hours.
                </p>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <WhatsAppLink
                    number={whatsapp}
                    variant="button"
                    label="Message us on WhatsApp"
                    message={customerPaidMessage({ storeName: settings.store.name, name: order.customer_name, orderNumber: order.order_number, amountKobo: latest.amount_paid, reference: latest.transfer_reference })}
                  />
                  <Link href={orderUrl} className="text-sm font-semibold text-rose-deep underline underline-offset-4 hover:text-rose">View your order</Link>
                </div>
              </div>
            ) : (
              <>
                <h2 id="form-h" className="font-display text-3xl">Confirm your transfer</h2>
                <p className="mt-1.5 text-sm text-plum-soft">Fill this in after you&apos;ve sent the money. It takes less than a minute.</p>
                {latest?.status === "declined" && (
                  <p className="mt-5 rounded-xl border border-rose/30 bg-blush px-4 py-3 text-sm text-plum" role="alert">
                    We couldn&apos;t find your last transfer (reference <strong className="font-mono">{latest.transfer_reference}</strong>). Please check the reference on your bank receipt and submit it again, or send us a screenshot on WhatsApp.
                  </p>
                )}
                <div className="mt-6">
                  <TransferForm orderNumber={order.order_number} token={order.access_token} defaultName={order.customer_name} defaultAmount={toMajorString(order.total)} defaultWhatsApp={order.phone} amountLabel={total} />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
