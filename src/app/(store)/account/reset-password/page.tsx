import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/account/AuthShell";
import { ResetPasswordForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("chooseNewPassword"), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  const t = await getTranslations("account");
  return (
    <AuthShell eyebrow={t("help")} title={t("newPassword")}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <p className="text-sm text-plum-soft">
          {t.rich("resetFromEmail", { link: (c) => <Link href="/account/forgot-password" className="underline">{c}</Link> })}
        </p>
      )}
    </AuthShell>
  );
}
