import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

// Cart, session and stock are per-request: never prerender these routes.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Any staff role may enter; each page then checks its own permission.
  const { user, permissions } = await requireStaffPage(null);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Lagos">
    <MotionProvider>
      <div className="flex min-h-dvh flex-col bg-neutral lg:flex-row">
        <AdminNav permissions={permissions} email={user.email ?? ""} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </MotionProvider>
    </NextIntlClientProvider>
  );
}
