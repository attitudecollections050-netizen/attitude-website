import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LogOut } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = { title: { default: "My Dashboard", template: "%s · Staff" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const link = "text-[11px] font-bold uppercase tracking-[0.16em] text-black/60 transition hover:text-black";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // Signed-in staff only; the page decides whose numbers may be shown.
  const { roles } = await requireStaffPage(null);
  const isOwner = roles.includes("admin");
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Lagos">
      <div className="min-h-dvh bg-white text-black">
        <header className="border-b border-black">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
            <Link href="/staff/dashboard" aria-label="My dashboard"><Wordmark /></Link>
            <nav aria-label="Staff" className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {isOwner ? (
                <Link href="/admin/staff" className={link}>← Staff Management</Link>
              ) : (
                <>
                  <Link href="/admin/products/new" className={link}>Add New Product</Link>
                  <Link href="/admin/products" className={link}>My Products</Link>
                  <Link href="/staff/dashboard#earnings" className={link}>My Earnings</Link>
                </>
              )}
              <form action={signOut}>
                <button className={`${link} inline-flex items-center gap-1.5`}><LogOut className="size-3.5" aria-hidden /> Logout</button>
              </form>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
