import { requireStaffPage } from "@/lib/auth";
import { Notice } from "@/components/ui/Notice";
import { HaruNotificationList } from "@/components/work/HaruNotifications";
import { myNotifications, staffStreaks, staffTasks, WorkError, type StaffNotification, type StaffTask, type Streak } from "@/lib/staff-work";

export const metadata = { title: "Haru's Notifications" };

function Meter({ n, label, tone }: { n: number; label: string; tone: "good" | "poor" }) {
  return (
    <div className={`rounded-[1.2rem] border-2 p-4 ${tone === "good" ? "border-[#FFB6D9] bg-[#FFF5FA]" : "border-[#FDBA74] bg-[#FFF7ED]"}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/60">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{n}/3</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < n ? (tone === "good" ? "bg-[#E94E8A]" : "bg-[#EA580C]") : "bg-black/10"}`} />
        ))}
      </div>
    </div>
  );
}

export default async function StaffNotificationsPage() {
  const { user } = await requireStaffPage("work:self");
  let items: StaffNotification[] = [];
  let tasks: StaffTask[] = [];
  let me: Streak | undefined;
  let problem: string | null = null;
  try {
    [items, tasks, [me]] = await Promise.all([myNotifications("staff", 100), staffTasks({ staffId: user.id, limit: 200 }), staffStreaks().then((s) => s.filter((x) => x.staffId === user.id))]);
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
        <div className="grid gap-3 sm:grid-cols-3" data-testid="my-streak">
          <Meter n={me.good} label="Good streak → +₦25" tone="good" />
          <Meter n={me.poor} label="Poor streak → −₦25" tone="poor" />
          <div className="rounded-[1.2rem] border-2 border-black/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/60">Waiting for rating</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{waiting}</p>
          </div>
        </div>
      )}
      <HaruNotificationList role="staff" initial={items} taskStatus={taskStatus} />
    </div>
  );
}
