import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { RegisterForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/account/register">) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell eyebrow="Join us" title="Create account" footer={<>Already have an account? <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">Sign in</Link></>}>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
