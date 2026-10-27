import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyPaystackSignature, type PaystackVerification } from "@/lib/payments/paystack";
import { processPaymentReference, type FinalizeResult, type PaymentDeps } from "@/lib/payments/process";
import { handlePaystackWebhook, type WebhookDeps } from "@/lib/payments/webhook";

const KEY = "sk_test_example";
const sign = (body: string, key = KEY) => createHmac("sha512", key).update(body).digest("hex");

const verification = (over: Partial<PaystackVerification> = {}): PaystackVerification => ({
  status: "success", reference: "AC100001-abc123def456", amount: 44_000_00, currency: "NGN", id: 99,
  channel: "card", paid_at: "2026-10-26T10:00:00Z", gateway_response: "Successful", raw: {}, ...over,
});

const deps = (over: Partial<PaymentDeps> = {}): PaymentDeps => ({
  verify: vi.fn(async (ref: string) => verification({ reference: ref })),
  finalize: vi.fn(async (): Promise<FinalizeResult> => ({ ok: true, code: "paid", order_id: "o1", order_number: "AC100001" })),
  recordFailure: vi.fn(async (): Promise<FinalizeResult> => ({ ok: true, code: "failed" })),
  onFirstPaid: vi.fn(async () => {}),
  ...over,
});

describe("webhook signature", () => {
  it("accepts a correct HMAC-SHA512 signature and rejects tampering", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    expect(verifyPaystackSignature(body, sign(body), KEY)).toBe(true);
    expect(verifyPaystackSignature(body + " ", sign(body), KEY)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body, "sk_test_other"), KEY)).toBe(false);
    expect(verifyPaystackSignature(body, null, KEY)).toBe(false);
  });
});

describe("payment verification flow", () => {
  it("finalises only after the provider confirms success", async () => {
    const d = deps();
    const r = await processPaymentReference("AC100001-abc123def456", d);
    expect(r.code).toBe("paid");
    expect(d.verify).toHaveBeenCalledOnce();
    expect(d.finalize).toHaveBeenCalledOnce();
    expect(d.onFirstPaid).toHaveBeenCalledOnce();
  });

  it("records failed payments without finalising", async () => {
    const d = deps({ verify: vi.fn(async (ref: string) => verification({ reference: ref, status: "failed", gateway_response: "Declined" })) });
    const r = await processPaymentReference("AC100001-abc123def456", d);
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect(d.finalize).not.toHaveBeenCalled();
    expect(d.recordFailure).toHaveBeenCalledWith("AC100001-abc123def456", "Declined", {});
  });

  it("leaves pending payments untouched", async () => {
    const d = deps({ verify: vi.fn(async (ref: string) => verification({ reference: ref, status: "ongoing" })) });
    expect((await processPaymentReference("AC100001-abc123def456", d)).code).toBe("pending");
    expect(d.finalize).not.toHaveBeenCalled();
  });

  it("does not repeat side effects for already-processed payments", async () => {
    const d = deps({ finalize: vi.fn(async (): Promise<FinalizeResult> => ({ ok: true, code: "already_processed", order_id: "o1" })) });
    await processPaymentReference("AC100001-abc123def456", d);
    expect(d.onFirstPaid).not.toHaveBeenCalled();
  });

  it("rejects malformed references and mismatched verification data", async () => {
    const d = deps();
    expect((await processPaymentReference("../../etc", d)).code).toBe("unknown_reference");
    const d2 = deps({ verify: vi.fn(async () => verification({ reference: "SOMETHING-ELSE" })) });
    expect((await processPaymentReference("AC100001-abc123def456", d2)).code).toBe("unknown_reference");
    expect(d2.finalize).not.toHaveBeenCalled();
  });
});

describe("webhook handling", () => {
  const body = JSON.stringify({ event: "charge.success", data: { id: 99, reference: "AC100001-abc123def456", amount: 1 } });

  function webhookDeps(over: Partial<WebhookDeps> = {}) {
    const seen = new Map<string, boolean>();
    return {
      secretKey: KEY,
      verifySignature: verifyPaystackSignature,
      recordEvent: vi.fn(async (key: string) => {
        const existing = seen.get(key);
        if (existing === undefined) seen.set(key, false);
        return { isNew: existing === undefined, processed: existing ?? false };
      }),
      markProcessed: vi.fn(async (key: string) => { seen.set(key, true); }),
      processReference: vi.fn(async (): Promise<FinalizeResult> => ({ ok: true, code: "paid" })),
      ...over,
    } satisfies WebhookDeps;
  }

  it("rejects requests with a bad signature", async () => {
    const d = webhookDeps();
    const r = await handlePaystackWebhook(body, "bad", d);
    expect(r.status).toBe(401);
    expect(d.processReference).not.toHaveBeenCalled();
  });

  it("re-verifies via the API (not the webhook amount) and ignores duplicate deliveries", async () => {
    const d = webhookDeps();
    const first = await handlePaystackWebhook(body, sign(body), d);
    const second = await handlePaystackWebhook(body, sign(body), d);
    expect(first).toMatchObject({ status: 200, body: { detail: "paid" } });
    expect(second).toMatchObject({ status: 200, body: { detail: "duplicate ignored" } });
    expect(d.processReference).toHaveBeenCalledTimes(1);
    expect(d.processReference).toHaveBeenCalledWith("AC100001-abc123def456");
  });

  it("asks Paystack to retry when processing fails", async () => {
    const d = webhookDeps({ processReference: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await handlePaystackWebhook(body, sign(body), d)).status).toBe(500);
  });

  it("acknowledges unrelated events without processing", async () => {
    const other = JSON.stringify({ event: "transfer.success", data: { id: 1, reference: "T1" } });
    const d = webhookDeps();
    expect((await handlePaystackWebhook(other, sign(other), d)).body.detail).toBe("event ignored");
    expect(d.processReference).not.toHaveBeenCalled();
  });
});
