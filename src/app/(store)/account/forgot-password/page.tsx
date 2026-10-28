import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/account/AuthShell";
import { ForgotPasswordForm } from "@/components/account/AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("resetPassword"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("account");
  return (
    <AuthShell eyebrow={t("help")} title={t("resetPassword")} footer={<Link href="/account/login" className="underline underline-offset-4">{t("backToSignIn")}</Link>}>
      <p className="mb-6 text-sm text-plum-soft">{t("forgotIntro")}</p>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
