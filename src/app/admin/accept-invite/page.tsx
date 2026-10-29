import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/brand/Wordmark";
import { Notice } from "@/components/ui/Notice";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Opened from the invitation link (which signs the person in once): choose a password. */
export default async function AcceptInvitePage() {
  const user = await getCurrentUser();
  const staff = user
    ? (await createServiceClient().from("staff_members").select("status, role, full_name").eq("user_id", user.id).maybeSingle()).data
    : null;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <div className="flex min-h-dvh items-center justify-center bg-plum px-4 py-16">
        <div className="w-full max-w-md bg-white p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Wordmark />
            <p className="eyebrow mt-6 text-rose-deep">Staff invitation</p>
          </div>
          <div className="mt-8">
            {!user ? (
              <Notice tone="error" title="This link has expired or was already used">
                Ask the store owner to send you a new invitation from Staff Management.
              </Notice>
            ) : !staff || staff.status === "disabled" ? (
              <Notice tone="error" title="No active invitation">
                This account doesn&apos;t have a staff invitation. If you think this is wrong, contact the store owner.
              </Notice>
            ) : (
              <>
                <h1 className="font-display text-3xl">Welcome to the team</h1>
                <p className="mt-2 text-sm text-plum-soft">
                  You&apos;ve been invited as <strong>{ROLE_LABELS[staff.role as AppRole] ?? staff.role}</strong> ({user.email}). Choose your own password to finish — never share it, and never use the owner&apos;s login.
                </p>
                <div className="mt-6">
                  <AcceptInviteForm defaultName={staff.full_name ?? ""} />
                </div>
              </>
            )}
          </div>
          <p className="mt-8 text-center text-xs text-muted">
            <Link href="/admin/login" className="underline underline-offset-4">Go to sign in</Link>
          </p>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
