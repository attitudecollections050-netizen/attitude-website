// Paystack webhook handling, written against injected dependencies so the
// signature, de-duplication and idempotency rules can be unit tested.
import { createHash } from "node:crypto";
import type { FinalizeResult } from "./process";

export interface WebhookDeps {
  secretKey: string;
  verifySignature: (rawBody: string, signature: string | null, key: string) => boolean;
  /** Returns false when this event was already received and processed. */
  recordEvent: (dedupeKey: string, eventType: string, payload: unknown) => Promise<{ isNew: boolean; processed: boolean }>;
  markProcessed: (dedupeKey: string, error: string | null) => Promise<void>;
  processReference: (reference: string) => Promise<FinalizeResult>;
}

export interface WebhookOutcome {
  status: number;
  body: { received: boolean; detail: string };
}

export function webhookDedupeKey(event: string, data: { id?: unknown; reference?: unknown }, rawBody: string): string {
  if (data.id != null && data.reference != null) return `${event}:${String(data.id)}:${String(data.reference)}`;
  return `${event}:sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

export async function handlePaystackWebhook(rawBody: string, signature: string | null, deps: WebhookDeps): Promise<WebhookOutcome> {
  if (!deps.secretKey) return { status: 503, body: { received: false, detail: "payments not configured" } };
  if (!deps.verifySignature(rawBody, signature, deps.secretKey)) {
    return { status: 401, body: { received: false, detail: "invalid signature" } };
  }
  let payload: { event?: string; data?: { id?: unknown; reference?: unknown } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { received: false, detail: "invalid json" } };
  }
  const event = String(payload.event ?? "unknown");
  const data = payload.data ?? {};
  const key = webhookDedupeKey(event, data, rawBody);
  const recorded = await deps.recordEvent(key, event, payload);
  if (!recorded.isNew && recorded.processed) {
    return { status: 200, body: { received: true, detail: "duplicate ignored" } };
  }

  if (event !== "charge.success" || typeof data.reference !== "string") {
    await deps.markProcessed(key, null);
    return { status: 200, body: { received: true, detail: "event ignored" } };
  }

  try {
    // Never trust the webhook body for amounts: re-verify with the Paystack API.
    const result = await deps.processReference(data.reference);
    await deps.markProcessed(key, result.ok ? null : result.code);
    return { status: 200, body: { received: true, detail: result.code } };
  } catch (e) {
    await deps.markProcessed(key, (e as Error).message.slice(0, 200)).catch(() => {});
    // Non-2xx makes Paystack retry later.
    return { status: 500, body: { received: false, detail: "processing error" } };
  }
}
