import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Empty, PageHeader } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";
import { RateTask } from "@/components/admin/RateTask";
import { RefreshOnNotification } from "@/components/work/HaruNotifications";
import { staffStreaks, staffTasks, TASK_LABELS, WorkError, type StaffTask, type Streak } from "@/lib/staff-work";

export const metadata = { title: "Rate Staff Work" };

const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

function Dots({ n, tone }: { n: number; tone: "good" | "poor" }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${n} of 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`size-2.5 rounded-full ${i < n ? (tone === "good" ? "bg-[#16A34A]" : "bg-[#DC2626]") : "bg-black/10"}`} />
      ))}
    </span>
  );
}

export default async function StaffTasksPage() {
  await requireStaffPage("staff:manage");
  let waiting: StaffTask[] = [];
  let rated: StaffTask[] = [];
  let streaks: Streak[] = [];
  let problem: string | null = null;
  try {
    [waiting, rated, streaks] = await Promise.all([
      staffTasks({ status: ["pending_review", "corrected"], limit: 100 }),
      staffTasks({ status: ["rated_good", "rated_poor"], limit: 30 }),
      staffStreaks(),
    ]);
  } catch (e) {
    problem = e instanceof WorkError ? e.message : "Couldn't load staff work.";
  }
  const names = new Map(streaks.map((s) => [s.staffId, s.name]));
  const nameOf = (t: StaffTask) => names.get(t.staffId) ?? t.staffEmail ?? "Former staff";

  // A thumbnail so the owner can judge the work right here: the design they set, or the product's first photo.
  const db = await createClient();
  const productIds = [...new Set(waiting.map((t) => t.link?.match(/^\/admin\/products\/([0-9a-f-]{36})$/)?.[1]).filter(Boolean))] as string[];
  const taskIds = waiting.filter((t) => t.taskType === "set_design").map((t) => t.id);
  const [{ data: imgs }, { data: designRows }] = await Promise.all([
    productIds.length ? db.from("product_images").select("product_id, url, sort_order").in("product_id", productIds).order("sort_order") : Promise.resolve({ data: [] as { product_id: string; url: string }[] }),
    taskIds.length ? db.from("staff_tasks").select("id, order_items ( selected_image )").in("id", taskIds) : Promise.resolve({ data: [] as { id: string; order_items: unknown }[] }),
  ]);
  const productImage = new Map<string, string>();
  for (const i of imgs ?? []) if (!productImage.has(i.product_id)) productImage.set(i.product_id, i.url);
  const designImage = new Map<string, string>();
  for (const r of (designRows ?? []) as { id: string; order_items: { selected_image: string | null } | { selected_image: string | null }[] | null }[]) {
    const it = Array.isArray(r.order_items) ? r.order_items[0] : r.order_items;
    if (it?.selected_image) designImage.set(r.id, it.selected_image);
  }
  const thumb = (t: StaffTask) => designImage.get(t.id) ?? productImage.get(t.link?.split("/").pop() ?? "");

  return (
    <div className="space-y-6">
      <RefreshOnNotification role="admin" />
      <PageHeader
        title="Rate Staff Work"
        description="Every product, design or order update your staff finish appears here. Rate it Good or Poor and Haru tells them straight away. 3 Good in a row = +₦25 bonus; 3 Poor in a row = −₦25 (never below ₦0). Added and taken from their wallet automatically."
        actions={<Link href="/admin/notifications" className="text-sm font-semibold underline underline-offset-4">Staff notifications →</Link>}
      />
      {problem && <Notice tone="warning">{problem}</Notice>}

      {streaks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="streaks">
          {streaks.map((s) => (
            <div key={s.staffId} className="border border-line bg-white p-4">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="mt-2 flex items-center justify-between text-xs"><span className="text-muted">Good streak → +₦25</span><Dots n={s.good} tone="good" /></p>
              <p className="mt-1.5 flex items-center justify-between text-xs"><span className="text-muted">Poor streak → −₦25</span><Dots n={s.poor} tone="poor" /></p>
            </div>
          ))}
        </div>
      )}

      <Card title={`Waiting for your rating (${waiting.length})`} description="Oldest at the bottom. Open the work to check it, then rate.">
        {waiting.length === 0 ? (
          <Empty>Nothing to rate right now 💖 New staff work will pop up here.</Empty>
        ) : (
          <ul className="divide-y divide-line" data-testid="tasks-waiting">
            {waiting.map((t) => {
              const img = thumb(t);
              return (
                <li key={t.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start" data-testid="task">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="size-20 shrink-0 border border-line object-cover" />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center border border-dashed border-line text-2xl" aria-hidden>{TASK_LABELS[t.taskType].slice(0, 2)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-plum">{nameOf(t)}</span>
                      <span>· {TASK_LABELS[t.taskType]}</span>
                      <span>· {when(t.createdAt)}</span>
                      {t.status === "corrected" && <Badge tone="plum">🔧 Says they fixed it</Badge>}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{t.details}</p>
                    {t.status === "corrected" && t.lastRating?.reason && <p className="mt-0.5 text-xs text-danger">Was Poor: “{t.lastRating.reason}”</p>}
                    {t.link && <Link href={t.link} className="mt-1 inline-block text-xs font-semibold underline underline-offset-4">Open to check →</Link>}
                  </div>
                  <div className="sm:w-80">
                    <RateTask taskId={t.id} staffName={nameOf(t)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Recently rated">
        {rated.length === 0 ? (
          <Empty>No ratings yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm" data-testid="tasks-rated">
            {rated.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold">{nameOf(t)}</span>
                  <span className="text-muted"> · {t.details}</span>
                  {t.status === "rated_poor" && t.lastRating?.reason && <span className="block text-xs text-danger">“{t.lastRating.reason}”</span>}
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={t.status === "rated_good" ? "success" : "danger"}>{t.status === "rated_good" ? "✅ Good" : "❌ Poor"}</Badge>
                  <span className="text-xs text-muted">{when(t.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
