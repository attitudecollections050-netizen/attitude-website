import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";
import { HaruNotificationList } from "@/components/work/HaruNotifications";
import { myNotifications, WorkError, type StaffNotification } from "@/lib/staff-work";

export const metadata = { title: "Staff Notifications" };

export default async function AdminNotificationsPage() {
  await requireStaffPage("staff:manage");
  let items: StaffNotification[] = [];
  let problem: string | null = null;
  try {
    items = await myNotifications("admin", 100);
  } catch (e) {
    problem = e instanceof WorkError ? e.message : "Couldn't load notifications.";
  }
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Staff Notifications"
        description="Haru tells you here, live, whenever a staff member finishes some work or fixes something you rated Poor."
        actions={<Link href="/admin/staff-tasks" className="text-sm font-semibold underline underline-offset-4">Rate staff work →</Link>}
      />
      {problem && <Notice tone="warning">{problem}</Notice>}
      <HaruNotificationList role="admin" initial={items} />
    </div>
  );
}
