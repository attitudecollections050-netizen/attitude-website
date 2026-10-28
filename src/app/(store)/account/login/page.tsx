import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { LoginForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { Notice } from "@/components/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("signIn"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("account");
  return (
    <AuthShell
      eyebrow={t("welcomeBack")}
      title={t("signIn")}
      footer={<>{t("newHere")} <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">{t("createAnAccount")}</Link></>}
    >
      {sp.error === "link" && <Notice tone="error" className="mb-5">{t("linkInvalid")}</Notice>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
