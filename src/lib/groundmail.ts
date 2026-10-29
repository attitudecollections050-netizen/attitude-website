import "server-only";
import { Groundmail, GroundmailError } from "groundmail";

/**
 * The one place the app sends email from. Every transactional email (orders,
 * invitations, notifications, anything added later) goes through sendEmail().
 *
 * Configuration (server-only, never NEXT_PUBLIC_):
 *   GROUNDMAIL_API_KEY  gm_… key with the emails:send scope
 *   EMAIL_FROM          sender, e.g. "Attitude Collections <noreply@attitudecollections.com>"
 *                       (the domain must be verified in Groundmail)
 *   EMAIL_REPLY_TO      optional reply-to address
 *   GROUNDMAIL_API_BASE optional, only for tests against a local mock
 */

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** What kind of email this is (e.g. "invite", "receipt"). Used in the default idempotency key, logs and tags. */
  type?: string;
  /**
   * Groundmail ignores a repeat send with the same key for 24 hours. Pass a stable key
   * (e.g. `receipt-${orderNumber}`) when the same email could be triggered twice.
   * Default: `${type}-${to}-${Date.now()}`.
   */
  idempotencyKey?: string;
  /** Overrides EMAIL_FROM for this send. */
  from?: string;
  replyTo?: string | string[];
  tags?: Record<string, string>;
}

export type SendEmailResult =
  | { ok: true; id: string; status: string; test: boolean }
  | { ok: false; reason: "not_configured" | "invalid" | "failed"; message: string; code?: string; status?: number };

let client: Groundmail | null = null;
let clientKey = "";

function config() {
  return {
    apiKey: process.env.GROUNDMAIL_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || "",
    baseUrl: process.env.GROUNDMAIL_API_BASE?.trim() || undefined,
  };
}

/** True when GROUNDMAIL_API_KEY and EMAIL_FROM are both set. */
export function isEmailConfigured(): boolean {
  const c = config();
  return Boolean(c.apiKey && c.from);
}

/** The shared Groundmail client (created once per server instance). */
export function getGroundmail(): Groundmail {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error("GROUNDMAIL_API_KEY is not set.");
  if (!client || clientKey !== apiKey) {
    client = new Groundmail(apiKey, baseUrl ? { baseUrl } : undefined);
    clientKey = apiKey;
  }
  return client;
}

/** Hides most of an address in logs: a***@example.com */
export function maskEmail(addr: string): string {
  return addr.replace(/^(.).*(@.*)$/, "$1***$2");
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Idempotency keys: printable, no spaces, at most 200 characters. */
export function idempotencyKeyFor(type: string, to: string | string[], now = Date.now()): string {
  return cleanKey(`${type}-${[to].flat().join(",")}-${now}`);
}
function cleanKey(key: string): string {
  return key.replace(/[^A-Za-z0-9@._:+,-]/g, "_").slice(0, 200);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Rate limits and server errors are worth one or two more tries; the idempotency key
// makes a retry safe even if the first attempt actually went through.
const RETRYABLE = (status: number) => status === 429 || status >= 500;
const RETRY_DELAYS_MS = [500, 1500];

/**
 * Sends one email. Never throws: returns { ok: false, … } and logs instead, so a mail
 * problem can't break checkout or an admin action. Callers decide whether to tell the user.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = config();
  const type = input.type ?? "email";
  const recipients = [input.to].flat().map((r) => r.trim()).filter(Boolean);
  const who = recipients.map(maskEmail).join(", ");

  if (!c.apiKey || !c.from) {
    console.info(`[email] not configured — skipped ${type} "${input.subject}" to ${who}`);
    return { ok: false, reason: "not_configured", message: "Email is not configured (GROUNDMAIL_API_KEY and EMAIL_FROM)." };
  }
  if (recipients.length === 0 || recipients.some((r) => !EMAIL_RE.test(r)) || !input.subject.trim() || !input.html.trim()) {
    console.warn(`[email] invalid ${type} email to ${who || "(nobody)"} — not sent`);
    return { ok: false, reason: "invalid", message: "Missing or invalid recipient, subject or content." };
  }

  const idempotencyKey = cleanKey(input.idempotencyKey ?? idempotencyKeyFor(type, recipients));
  const replyTo = input.replyTo ?? (c.replyTo || undefined);
  const params = {
    from: input.from ?? c.from,
    to: recipients.length === 1 ? recipients[0] : recipients,
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
    ...(replyTo ? { replyTo } : {}),
    tags: { type, ...input.tags },
    category: "transactional" as const,
    idempotencyKey,
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await getGroundmail().emails.send(params);
      console.info(`[email] sent ${type} to ${who} id=${res.id} status=${res.status}${res.test ? " (test)" : ""}`);
      return { ok: true, id: res.id, status: res.status, test: res.test === true };
    } catch (e) {
      // GroundmailError = the API answered; TypeError = the request never got through.
      const retryable = e instanceof GroundmailError ? RETRYABLE(e.status) : e instanceof TypeError;
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (e instanceof GroundmailError) {
        console.error(`[email] ${type} to ${who} failed`, { status: e.status, code: e.code, message: e.message, hint: e.hint, idempotencyKey });
        return { ok: false, reason: "failed", message: e.message, code: e.code, status: e.status };
      }
      console.error(`[email] ${type} to ${who} failed`, { message: (e as Error)?.message, idempotencyKey });
      return { ok: false, reason: "failed", message: (e as Error)?.message || "Email could not be sent." };
    }
  }
}
