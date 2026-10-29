"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { onFirstPaid } from "@/lib/payments/server";
import { sendEmail } from "@/lib/groundmail";
import { notificationEmail } from "@/lib/emails/templates";
import { dbError, guarded, optStr, uuid } from "./helpers";
import type { AdminResult } from "./types";

const ERRORS: Record<string, string> = {
  already_reviewed: "This transfer has already been reviewed.",
  claim_not_found: "We couldn't find that transfer.",
};

/** Owner confirms (money arrived) or declines (not found) a bank transfer. */
export async function reviewTransfer(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("payments:verify", async ({ db }) => {
    const input = z
      .object({ claim_id: uuid, decision: z.enum(["verified", "declined"]), note: optStr(500) })
      .parse(Object.fromEntries(formData));

    // The database function checks the owner role again and does the whole change in one transaction.
    const { data, error } = await db.rpc("admin_review_payment_claim", { p_claim_id: input.claim_id, p_decision: input.decision, p_note: input.note ?? null });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      if (key) return { ok: false, message: ERRORS[key] };
      if (error.message.includes("finalize_failed")) return { ok: false, message: `The order couldn't be marked as paid (${error.message.split("finalize_failed: ")[1] ?? "unknown"}).` };
      return dbError(error);
    }
    const result = data as { order_id: string; order_number: string; code?: string };

    const svc = createServiceClient();
    const { data: claim } = await svc
      .from("payment_claims")
      .select("customer_name, amount_paid, transfer_reference, order:orders ( order_number, email, access_token, currency )")
      .eq("id", input.claim_id)
      .single();
    const order = claim?.order as unknown as { order_number: string; email: string; access_token: string; currency: string } | null;

    if (input.decision === "verified") {
      // Same follow-up as a card payment: empty the bag and email the receipt (sent once per order).
      if (result.code !== "already_processed" && result.code !== "duplicate_payment") await onFirstPaid({ ok: true, code: "paid", order_id: result.order_id });
    } else if (claim && order) {
      const { store } = await getSettings();
      await sendEmail({
        to: order.email,
        ...notificationEmail({
          name: claim.customer_name.split(" ")[0],
          title: `We couldn't confirm your transfer for order ${order.order_number}`,
          message: `We checked our account but couldn't find a payment of ${formatMoney(claim.amount_paid, order.currency)} with reference ${claim.transfer_reference}.${input.note ? `\n\n${input.note}` : ""}\n\nPlease check the reference on your bank receipt and submit it again, or reply on WhatsApp with a screenshot${store.support_phone ? `. You can also call us on ${store.support_phone}` : ""}.`,
          actionUrl: `${env.siteUrl}/checkout/transfer/${order.order_number}?token=${order.access_token}`,
          actionLabel: "Submit my transfer again",
        }),
        type: "transfer-declined",
        idempotencyKey: `transfer-declined-${input.claim_id}`,
      });
    }

    revalidatePath("/admin/transfers");
    revalidatePath(`/admin/transfers/${input.claim_id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return {
      ok: true,
      message: input.decision === "verified" ? `Payment confirmed. Order ${result.order_number} is now paid and ready to process.` : `Transfer declined. The customer can submit it again.`,
    };
  });
}
