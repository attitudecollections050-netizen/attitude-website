import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// A local stand-in for the Groundmail API: records requests and answers with a scripted status.
type Call = { path: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
let calls: Call[] = [];
let script: number[] = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      calls.push({ path: req.url ?? "", headers: req.headers, body: raw ? JSON.parse(raw) : {} });
      const status = script.shift() ?? 200;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          status < 300
            ? { id: `msg_${calls.length}`, status: "queued" }
            : { error: { message: status === 422 ? "Domain not verified" : "Try again", code: status === 422 ? "domain_not_verified" : "rate_limited", hint: "Verify the domain" } },
        ),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GROUNDMAIL_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  delete process.env.GROUNDMAIL_API_BASE;
});
beforeEach(() => {
  calls = [];
  script = [];
  process.env.GROUNDMAIL_API_KEY = "gm_test_123";
  process.env.EMAIL_FROM = "Attitude Collections <noreply@example.com>";
  delete process.env.EMAIL_REPLY_TO;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("sendEmail (Groundmail)", () => {
  it("sends with the API key, sender, idempotency key and tags", async () => {
    const { sendEmail } = await import("@/lib/groundmail");
    const res = await sendEmail({ to: "ada@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi", type: "invite", idempotencyKey: "invite-ada@example.com-1" });
    expect(res).toMatchObject({ ok: true, id: "msg_1", status: "queued" });
    expect(calls).toHaveLength(1);
    const [c] = calls;
    expect(c.path).toBe("/emails");
    expect(c.headers.authorization).toBe("Bearer gm_test_123");
    expect(c.headers["idempotency-key"]).toBe("invite-ada@example.com-1");
    expect(c.body).toMatchObject({ from: "Attitude Collections <noreply@example.com>", to: "ada@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
    expect(JSON.stringify(c.body)).toContain("invite");
  });

  it("always sets an idempotency key (default: type-to-timestamp)", async () => {
    const { sendEmail } = await import("@/lib/groundmail");
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    await sendEmail({ to: "ada@example.com", subject: "S", html: "<p>x</p>", type: "notification" });
    expect(calls[0].headers["idempotency-key"]).toBe("notification-ada@example.com-1700000000000");
    vi.mocked(Date.now).mockRestore();
  });

  it("does nothing (and says so) when not configured", async () => {
    delete process.env.GROUNDMAIL_API_KEY;
    const { sendEmail, isEmailConfigured } = await import("@/lib/groundmail");
    expect(isEmailConfigured()).toBe(false);
    const res = await sendEmail({ to: "ada@example.com", subject: "S", html: "<p>x</p>" });
    expect(res).toMatchObject({ ok: false, reason: "not_configured" });
    expect(calls).toHaveLength(0);
  });

  it("rejects bad recipients before calling the API", async () => {
    const { sendEmail } = await import("@/lib/groundmail");
    expect(await sendEmail({ to: "not-an-email", subject: "S", html: "<p>x</p>" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await sendEmail({ to: [], subject: "S", html: "<p>x</p>" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("retries rate limits and server errors with the same key, then succeeds", async () => {
    const { sendEmail } = await import("@/lib/groundmail");
    script = [429, 503];
    const res = await sendEmail({ to: "ada@example.com", subject: "S", html: "<p>x</p>", idempotencyKey: "receipt-AC-1" });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((c) => c.headers["idempotency-key"]))).toEqual(new Set(["receipt-AC-1"]));
  });

  it("returns the API error without retrying client errors, and never throws", async () => {
    const { sendEmail } = await import("@/lib/groundmail");
    script = [422];
    const res = await sendEmail({ to: "ada@example.com", subject: "S", html: "<p>x</p>" });
    expect(res).toMatchObject({ ok: false, reason: "failed", status: 422, code: "domain_not_verified" });
    expect(calls).toHaveLength(1);
    expect(vi.mocked(console.error).mock.calls[0].join(" ")).not.toContain("ada@example.com");
  });

  it("masks addresses and cleans keys", async () => {
    const { maskEmail, idempotencyKeyFor } = await import("@/lib/groundmail");
    expect(maskEmail("ada@example.com")).toBe("a***@example.com");
    expect(idempotencyKeyFor("invite", "a b@x.com", 5)).toBe("invite-a_b@x.com-5");
    expect(idempotencyKeyFor("x", "y@z.com", 1).length).toBeLessThanOrEqual(200);
  });
});

describe("email templates", () => {
  it("each template returns subject, html and text, and escapes user input", async () => {
    const t = await import("@/lib/emails/templates");
    const evil = `<script>alert(1)</script>`;
    const all = [
      t.inviteEmail({ name: evil, role: "Product Staff", link: "https://shop.example/auth/confirm?x=1" }),
      t.verificationEmail({ name: evil, link: "https://shop.example/verify", code: "123456" }),
      t.passwordResetEmail({ name: evil, link: "https://shop.example/reset" }),
      t.receiptEmail({ orderNumber: "AC-1", customerName: evil, lines: [{ name: evil, quantity: 2, amount: "₦10,000" }], total: "₦10,000", link: "https://shop.example/order/AC-1" }),
      t.notificationEmail({ title: "Back in stock", message: evil, actionUrl: "https://shop.example" }),
    ];
    for (const e of all) {
      expect(e.subject.length).toBeGreaterThan(3);
      expect(e.html).toContain("ATTITUDE COLLECTIONS");
      expect(e.html).not.toContain("<script>");
      expect(e.text.length).toBeGreaterThan(5);
    }
    expect(all[0].html).toContain("https://shop.example/auth/confirm?x=1".replace("&", "&amp;"));
    expect(all[1].text).toContain("123456");
    expect(all[3].html).toContain("₦10,000");
  });

  it("refuses non-http links in buttons", async () => {
    const { notificationEmail } = await import("@/lib/emails/templates");
    expect(notificationEmail({ title: "x", message: "y", actionUrl: "javascript:alert(1)" }).html).not.toContain("javascript:");
  });
});
