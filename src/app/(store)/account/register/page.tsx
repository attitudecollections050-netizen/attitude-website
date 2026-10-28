import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { RegisterForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("createAccount"), robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: PageProps<"/account/register">) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("account");
  return (
    <AuthShell eyebrow={t("joinUs")} title={t("createAccount")} footer={<>{t("haveAccount")} <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">{t("signIn")}</Link></>}>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
