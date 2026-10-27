import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/account/AuthShell";
import { ForgotPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account help" title="Reset password" footer={<Link href="/account/login" className="underline underline-offset-4">Back to sign in</Link>}>
      <p className="mb-6 text-sm text-plum-soft">Enter your email and we&apos;ll send you a secure link to choose a new password.</p>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
