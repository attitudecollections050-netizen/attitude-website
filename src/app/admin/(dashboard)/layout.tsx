import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import { AdminNav } from "@/components/admin/AdminNav";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

const ALL: Permission[] = ["orders:read", "orders:update", "catalog:write", "shipping:write", "discounts:write", "settings:write", "suppliers:write", "messages:read", "customers:read", "feedback:manage", "reports:read"];

// Cart, session and stock are per-request: never prerender these routes.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, roles } = await requireStaffPage();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Lagos">
    <MotionProvider>
      <div className="flex min-h-dvh flex-col bg-neutral lg:flex-row">
        <AdminNav permissions={ALL.filter((p) => can(roles, p))} email={user.email ?? ""} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </MotionProvider>
    </NextIntlClientProvider>
  );
}
