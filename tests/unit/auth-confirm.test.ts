import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }) }));

const go = async (qs: string) => {
  const { GET } = await import("@/app/auth/confirm/route");
  const res = await GET(new NextRequest(`https://shop.example/auth/confirm?${qs}`));
  const loc = new URL(res.headers.get("location")!);
  return loc.origin === "https://shop.example" ? loc.pathname + loc.search : loc.href;
};

describe("/auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null });
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("invitations go to choose-your-password, whatever next says", async () => {
    expect(await go("token_hash=abc&type=invite")).toBe("/auth/set-password");
    expect(await go("token_hash=abc&type=invite&next=/admin/accept-invite")).toBe("/auth/set-password");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "abc" });
  });

  it("password resets use the shop's reset page when named, else set-password", async () => {
    expect(await go("token_hash=abc&type=recovery&next=/account/reset-password")).toBe("/account/reset-password");
    expect(await go("token_hash=abc&type=recovery")).toBe("/auth/set-password");
  });

  it("sign-up confirmations and code links follow next (default /account)", async () => {
    expect(await go("token_hash=abc&type=email&next=/checkout")).toBe("/checkout");
    expect(await go("token_hash=abc&type=signup")).toBe("/account");
    expect(await go("code=xyz&next=/account/orders")).toBe("/account/orders");
  });

  it("never redirects to another website", async () => {
    expect(await go("token_hash=abc&type=email&next=https://evil.example")).toBe("/account");
    expect(await go("token_hash=abc&type=email&next=//evil.example/x")).toBe("/account");
    expect(await go("token_hash=abc&type=recovery&next=https://evil.example")).toBe("/auth/set-password");
  });

  it("bad, used or expired links go to the error page", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect(await go("token_hash=old&type=invite")).toBe("/auth/auth-code-error");
    expect(await go("type=invite")).toBe("/auth/auth-code-error");
    expect(await go("")).toBe("/auth/auth-code-error");
  });
});
