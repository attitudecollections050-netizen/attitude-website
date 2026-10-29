import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * Handles every link Supabase Auth emails out: staff invitations, sign-up confirmations,
 * password resets and magic links. The link signs the person in, then:
 * - invitations → /auth/set-password (they choose their own password)
 * - password resets → `next` if the link names one (the shop's reset page), else /auth/set-password
 * - everything else → `next` (only paths on this site), defaulting to /account
 * Bad, used or expired links go to /auth/auth-code-error.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next");
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  if (!ok) return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));

  let target: string;
  if (type === "invite") target = "/auth/set-password";
  else if (type === "recovery") target = safeNextPath(rawNext, "/auth/set-password");
  else target = safeNextPath(rawNext, "/account");
  return NextResponse.redirect(new URL(target, url.origin));
}
