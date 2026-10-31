import { requireStaffPage } from "@/lib/auth";
import { Notice } from "@/components/ui/Notice";
import { HaruNotificationList } from "@/components/work/HaruNotifications";
import { PushControls } from "@/components/work/PushControls";
import { myNotifications, ratingSummaries, staffStreaks, staffTasks, WorkError, type RatingSummary, type StaffNotification, type StaffTask, type Streak } from "@/lib/staff-work";
import { RatingHistory, RatingStats } from "@/components/work/RatingStats";

export const metadata = { title: "Haru's Notifications" };

export default async function StaffNotificationsPage() {
  const { user } = await requireStaffPage("work:self");
  let items: StaffNotification[] = [];
  let tasks: StaffTask[] = [];
  let me: Streak | undefined;
  let summary: RatingSummary | undefined;
  let problem: string | null = null;
  try {
    [items, tasks, [me]] = await Promise.all([myNotifications("staff", 100), staffTasks({ staffId: user.id, limit: 200 }), staffStreaks().then((s) => s.filter((x) => x.staffId === user.id))]);
    summary = (await ratingSummaries({ staffId: user.id, limit: 20 })).get(user.id);
  } catch (e) {
    problem = e instanceof WorkError ? e.message : "Couldn't load your notifications.";
  }
  const taskStatus = Object.fromEntries(tasks.map((t) => [t.id, t.status]));
  const waiting = tasks.filter((t) => t.status === "pending_review" || t.status === "corrected").length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascots/girl-face.png" alt="" className="size-16 rounded-full border-2 border-[#FFB6D9] object-cover" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C2185B]">DJ ATTITUDE mini HARU 💖</p>
          <h1 className="font-display text-3xl font-semibold">My Notifications</h1>
          <p className="mt-1 text-sm text-black/60">When the owner rates your work, I tell you here. 3 Good in a row = +₦25 bonus! 3 Poor in a row = −₦25.</p>
        </div>
      </header>
      {problem && <Notice tone="warning">{problem}</Notice>}
      {me && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]" data-testid="my-streak">
          <div className="rounded-[1.2rem] border-2 border-[#FFB6D9] bg-[#FFF5FA] p-4">
            <RatingStats good={me.good} poor={me.poor} summary={summary} />
          </div>
          <div className="rounded-[1.2rem] border-2 border-black/10 p-4 sm:min-w-40">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/60">Waiting for rating</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{waiting}</p>
          </div>
        </div>
      )}
      {summary && summary.recent.length > 0 && (
        <details className="rounded-[1.2rem] border-2 border-black/10 p-4">
          <summary className="cursor-pointer text-sm font-bold">My rating history ({summary.totalGood + summary.totalPoor})</summary>
          <div className="mt-3"><RatingHistory entries={summary.recent} /></div>
        </details>
      )}
      <PushControls who="staff" />
      <HaruNotificationList role="staff" initial={items} taskStatus={taskStatus} />
    </div>
  );
}
