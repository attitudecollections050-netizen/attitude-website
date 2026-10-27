import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRoles, getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { LoginForm } from "@/components/account/AuthForms";
import { Wordmark } from "@/components/brand/Wordmark";
import { Notice } from "@/components/ui/Notice";
import { signOut } from "@/app/actions/auth";
import { MotionProvider } from "@/components/ui/MotionProvider";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

// Cart, session and stock are per-request: never prerender these routes.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const roles = await getCurrentRoles();
  if (user && isStaffRole(roles)) redirect("/admin");

  return (
    <MotionProvider>
      <div className="flex min-h-dvh items-center justify-center bg-plum px-4 py-16">
        <div className="w-full max-w-md bg-white p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Wordmark />
            <p className="eyebrow mt-6 text-rose-deep">Store administration</p>
          </div>
          <div className="mt-8">
            {user ? (
              <div className="space-y-5">
                <Notice tone="error" title="Access denied">
                  The account {user.email} does not have administrator access. Access is granted by the store owner — it cannot be requested here.
                </Notice>
                <form action={signOut}>
                  <button className="text-sm underline underline-offset-4">Sign out</button>
                </form>
              </div>
            ) : (
              <>
                {sp.error === "forbidden" && <Notice tone="error" className="mb-5">Please sign in with an administrator account.</Notice>}
                <LoginForm next="/admin" />
              </>
            )}
          </div>
          <p className="mt-8 text-center text-xs text-muted">
            <Link href="/" className="underline underline-offset-4">Back to the store</Link>
          </p>
        </div>
      </div>
    </MotionProvider>
  );
}
