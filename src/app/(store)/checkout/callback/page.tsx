import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { processPayment } from "@/lib/payments/server";
import { isPaystackConfigured, isSupabaseConfigured } from "@/lib/env";
import { buttonClasses } from "@/components/ui/Button";
import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("callback"))("metaTitle"), robots: { index: false } };
}

export default async function PaymentCallbackPage({ searchParams }: PageProps<"/checkout/callback">) {
  const sp = await searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : "";
  if (!reference || !isSupabaseConfigured() || !isPaystackConfigured()) redirect("/cart");
  const t = await getTranslations("callback");

  const { data: payment } = await createServiceClient()
    .from("payments")
    .select("order:orders ( order_number, access_token )")
    .eq("reference", reference)
    .maybeSingle();
  const order = (Array.isArray(payment?.order) ? payment?.order[0] : payment?.order) as { order_number: string; access_token: string } | undefined;
  if (!order) {
    return <Message title={t("notFoundTitle")} body={t("notFoundBody")} reference={reference} />;
  }

  let code: string;
  try {
    code = (await processPayment(reference)).code;
  } catch (e) {
    console.error("[callback] verification error:", (e as Error).message);
    code = "pending";
  }

  if (code === "paid" || code === "already_processed" || code === "duplicate_payment" || code === "already_paid") {
    redirect(`/order/${order.order_number}?token=${order.access_token}`);
  }

  if (code === "pending") {
    return (
      <Message
        title={t("pendingTitle")}
        body={t("pendingBody")}
        reference={reference}
        action={<Link href={`/order/${order.order_number}?token=${order.access_token}`} className={buttonClasses("primary")}>{t("viewStatus")}</Link>}
      />
    );
  }

  return (
    <Message
      title={t("failedTitle")}
      body={code === "amount_mismatch" ? t("mismatchBody") : t("failedBody")}
      reference={reference}
      action={code === "amount_mismatch" ? undefined : <RetryPaymentButton orderNumber={order.order_number} token={order.access_token} />}
    />
  );
}

async function Message({ title, body, reference, action }: { title: string; body: string; reference: string; action?: React.ReactNode }) {
  const t = await getTranslations("callback");
  return (
    <div className="container-luxe flex max-w-2xl flex-col items-center gap-5 py-24 text-center">
      <h1 className="display text-5xl">{title}</h1>
      <p className="text-sm leading-relaxed text-plum-soft">{body}</p>
      <p className="text-xs text-muted">{t("reference", { reference })}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {action}
        <Link href="/contact" className={buttonClasses("outline")}>{t("contact")}</Link>
      </div>
    </div>
  );
}
