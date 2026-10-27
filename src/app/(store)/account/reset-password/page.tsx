import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/account/AuthShell";
import { ResetPasswordForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <AuthShell eyebrow="Account help" title="New password">
      {user ? (
        <ResetPasswordForm />
      ) : (
        <p className="text-sm text-plum-soft">
          This page is opened from the reset link in your email. <Link href="/account/forgot-password" className="underline">Request a new link</Link>.
        </p>
      )}
    </AuthShell>
  );
}
