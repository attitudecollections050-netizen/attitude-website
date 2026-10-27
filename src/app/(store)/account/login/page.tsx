import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { LoginForm } from "@/components/account/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      footer={<>New to Attitude Collections? <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">Create an account</Link></>}
    >
      {sp.error === "link" && <Notice tone="error" className="mb-5">That link is invalid or has expired. Please try again.</Notice>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
