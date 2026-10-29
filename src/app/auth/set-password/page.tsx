import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentRoles, getCurrentUser } from "@/lib/auth";
import { isStaffRole, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/admin";
import { serverSecrets } from "@/lib/env";
import { Wordmark } from "@/components/brand/Wordmark";
import { Notice } from "@/components/ui/Notice";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Choose your password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Reached from an invitation or password-reset link (which signs the person in once). */
export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  const staff =
    user && serverSecrets().supabaseSecretKey
      ? (await createServiceClient().from("staff_members").select("status, role").eq("user_id", user.id).maybeSingle()).data
      : null;
  const invited = staff?.status === "invited";
  const toDashboard = Boolean(user) && (invited || isStaffRole(await getCurrentRoles()));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-plum px-4 py-16">
      <div className="w-full max-w-md rounded-[1.6rem] bg-white p-8 shadow-[0_40px_90px_-40px_rgba(217,79,145,0.8)] sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Wordmark />
          <p className="eyebrow mt-6 text-rose-deep">{invited ? "Staff invitation" : "Account security"}</p>
        </div>
        <div className="mt-8">
          {!user ? (
            <Notice tone="error" title="This link has expired or was already used">
              Invitation and reset links work once and expire after a while. Ask the store owner for a new invitation, or request a new reset link from the sign-in page.
            </Notice>
          ) : staff?.status === "disabled" ? (
            <Notice tone="error" title="Access is switched off">This staff account has been disabled. Please contact the store owner.</Notice>
          ) : (
            <>
              <h1 className="font-display text-3xl">{invited ? "Welcome to the team" : "Choose a new password"}</h1>
              <p className="mt-2 text-sm text-plum-soft">
                {invited ? (
                  <>
                    You&apos;ve been invited as <strong>{ROLE_LABELS[staff!.role as AppRole] ?? staff!.role}</strong> ({user.email}). Choose your own password to finish. Never share it, and never use the owner&apos;s login.
                  </>
                ) : (
                  <>Signed in as {user.email}. Choose a new password for your account.</>
                )}
              </p>
              <div className="mt-6">
                <SetPasswordForm submitLabel={toDashboard ? "Save password & open dashboard" : "Save password"} />
              </div>
            </>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted">
          <Link href={toDashboard ? "/admin/login" : "/account/login"} className="underline underline-offset-4">Go to sign in</Link>
        </p>
      </div>
    </div>
  );
}
