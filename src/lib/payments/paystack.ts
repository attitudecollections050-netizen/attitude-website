import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverSecrets } from "@/lib/env";

// Overridable only for automated tests against a local mock; production uses the official API.
const API = process.env.PAYSTACK_API_BASE || "https://api.paystack.co";

export interface PaystackVerification {
  status: string; // success | failed | abandoned | ongoing | pending | reversed ...
  reference: string;
  amount: number; // minor units
  currency: string;
  id: number | string;
  channel: string | null;
  paid_at: string | null;
  gateway_response: string | null;
  raw: unknown;
}

export class PaystackError extends Error {}

function secretKey(): string {
  const key = serverSecrets().paystackSecretKey;
  if (!key) throw new PaystackError("Paystack is not configured (PAYSTACK_SECRET_KEY missing).");
  return key;
}

export function generatePaymentReference(orderNumber: string): string {
  return `${orderNumber}-${randomBytes(6).toString("hex")}`;
}

/** Verifies the x-paystack-signature header (HMAC-SHA512 of the raw body). */
export function verifyPaystackSignature(rawBody: string, signature: string | null, key: string): boolean {
  if (!signature || !key) return false;
  const expected = createHmac("sha512", key).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function initializeTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  /** Paystack payment channels to offer (e.g. card, bank, ussd, bank_transfer). Omit for the account default. */
  channels?: string[];
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      ...(input.channels?.length ? { channels: input.channels } : {}),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | { status: boolean; message: string; data?: { authorization_url: string; access_code: string; reference: string } }
    | null;
  if (!res.ok || !json?.status || !json.data) {
    throw new PaystackError(json?.message || `Paystack initialize failed (${res.status})`);
  }
  return { authorizationUrl: json.data.authorization_url, accessCode: json.data.access_code, reference: json.data.reference };
}

export async function verifyTransaction(reference: string): Promise<PaystackVerification> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | { status: boolean; message: string; data?: Record<string, unknown> }
    | null;
  if (!res.ok || !json?.status || !json.data) {
    throw new PaystackError(json?.message || `Paystack verify failed (${res.status})`);
  }
  const d = json.data;
  return {
    status: String(d.status),
    reference: String(d.reference),
    amount: Number(d.amount),
    currency: String(d.currency),
    id: d.id as number,
    channel: (d.channel as string) ?? null,
    paid_at: (d.paid_at as string) ?? (d.paidAt as string) ?? null,
    gateway_response: (d.gateway_response as string) ?? null,
    raw: { id: d.id, status: d.status, reference: d.reference, amount: d.amount, currency: d.currency,
           channel: d.channel, paid_at: d.paid_at, gateway_response: d.gateway_response },
  };
}
