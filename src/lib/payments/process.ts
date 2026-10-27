// Orchestrates "verify with provider -> finalise in database". Shared by the
// redirect callback and the webhook, and safe to run any number of times.
import type { PaystackVerification } from "./paystack";

export interface FinalizeResult {
  ok: boolean;
  code: "paid" | "already_processed" | "duplicate_payment" | "amount_mismatch" | "unknown_reference" | "failed" | "already_paid" | "pending";
  order_id?: string;
  order_number?: string;
  inventory_conflict?: boolean;
}

export interface PaymentDeps {
  verify: (reference: string) => Promise<PaystackVerification>;
  finalize: (v: PaystackVerification) => Promise<FinalizeResult>;
  recordFailure: (reference: string, reason: string, raw: unknown) => Promise<FinalizeResult>;
  onFirstPaid?: (result: FinalizeResult) => Promise<void>;
}

const FAILED_STATUSES = new Set(["failed", "abandoned", "reversed"]);

export async function processPaymentReference(reference: string, deps: PaymentDeps): Promise<FinalizeResult> {
  if (!/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) {
    return { ok: false, code: "unknown_reference" };
  }
  const verification = await deps.verify(reference);
  if (verification.reference !== reference) {
    return { ok: false, code: "unknown_reference" };
  }
  if (verification.status === "success") {
    const result = await deps.finalize(verification);
    if (result.ok && result.code === "paid" && deps.onFirstPaid) {
      try {
        await deps.onFirstPaid(result);
      } catch (e) {
        console.error("[payments] post-payment hook failed:", (e as Error).message);
      }
    }
    return result;
  }
  if (FAILED_STATUSES.has(verification.status)) {
    const result = await deps.recordFailure(reference, verification.gateway_response || verification.status, verification.raw);
    return { ...result, ok: false, code: result.code === "already_paid" ? "already_paid" : "failed" };
  }
  return { ok: false, code: "pending" };
}
