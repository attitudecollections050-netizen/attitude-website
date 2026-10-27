import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { serverSecrets } from "@/lib/env";
import { verifyPaystackSignature } from "@/lib/payments/paystack";
import { handlePaystackWebhook } from "@/lib/payments/webhook";
import { processPayment } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 512_000) return NextResponse.json({ received: false }, { status: 413 });
  const db = createServiceClient();

  const outcome = await handlePaystackWebhook(rawBody, request.headers.get("x-paystack-signature"), {
    secretKey: serverSecrets().paystackSecretKey,
    verifySignature: verifyPaystackSignature,
    recordEvent: async (dedupeKey, eventType, payload) => {
      const { data: inserted } = await db
        .from("webhook_events")
        .upsert({ provider: "paystack", dedupe_key: dedupeKey, event_type: eventType, payload }, { onConflict: "provider,dedupe_key", ignoreDuplicates: true })
        .select("id");
      if (inserted && inserted.length > 0) return { isNew: true, processed: false };
      const { data: existing } = await db.from("webhook_events").select("processed_at").eq("provider", "paystack").eq("dedupe_key", dedupeKey).maybeSingle();
      return { isNew: false, processed: Boolean(existing?.processed_at) };
    },
    markProcessed: async (dedupeKey, error) => {
      await db
        .from("webhook_events")
        .update(error && error !== "pending" ? { processing_error: error, processed_at: new Date().toISOString() } : error === "pending" ? { processing_error: "pending" } : { processed_at: new Date().toISOString(), processing_error: null })
        .eq("provider", "paystack")
        .eq("dedupe_key", dedupeKey);
    },
    processReference: processPayment,
  });

  return NextResponse.json(outcome.body, { status: outcome.status });
}
