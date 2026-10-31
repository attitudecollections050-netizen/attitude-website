import "server-only";
import { createClient } from "@/lib/supabase/server";

// Staff work ratings + Haru's notifications (see migration 20261031000024_staff_work_ratings.sql).
// Staff work is logged by database triggers; the owner rates it through rate_staff_task(), which
// also handles the 3-in-a-row ₦25 bonus/penalty. Everything runs with the signed-in person's
// session, so the database decides who can see or rate what.

export type TaskType = "set_design" | "upload_product" | "update_order";
export type TaskStatus = "pending_review" | "rated_good" | "rated_poor" | "corrected";
export type NotificationType = "task_done" | "corrected" | "rated_poor" | "rated_good" | "penalty" | "bonus" | "encouragement";

export const TASK_LABELS: Record<TaskType, string> = { set_design: "🎨 Set a design", upload_product: "📦 Uploaded a product", update_order: "🚚 Updated an order" };

export interface StaffTask {
  id: string;
  staffId: string;
  staffEmail: string | null;
  taskType: TaskType;
  details: string;
  link: string | null;
  status: TaskStatus;
  createdAt: string;
  correctedAt: string | null;
  /** Latest rating, if any. */
  lastRating: { rating: "good" | "poor"; reason: string | null } | null;
}

export interface StaffNotification {
  id: string;
  staffId: string | null;
  staffEmail: string | null;
  toRole: "admin" | "staff";
  title: string;
  message: string;
  type: NotificationType;
  taskId: string | null;
  link: string | null;
  amount: number | null;
  isRead: boolean;
  createdAt: string;
}

export class WorkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const MESSAGES: Record<string, [string, number]> = {
  forbidden: ["Only the store owner can rate staff work.", 403],
  invalid_rating: ["Choose Good or Poor.", 400],
  reason_required: ["Tell them what was wrong (at least 3 letters), so they can fix it.", 400],
  not_found: ["That task wasn't found.", 404],
  already_rated: ["This task has already been rated.", 409],
  not_staff: ["That person isn't on your staff list any more.", 404],
  not_poor: ["Only work rated Poor can be marked as corrected.", 409],
};
const notInstalled = (e: { code?: string; message: string }) =>
  e.code === "PGRST202" || e.code === "PGRST205" || e.code === "42883" || e.code === "42P01" || /could not find the (function|table)|does not exist|schema cache/i.test(e.message);
function toError(e: { message: string; code?: string }): WorkError {
  if (notInstalled(e)) return new WorkError("Staff ratings aren't set up in this database yet.", 503);
  const key = Object.keys(MESSAGES).find((k) => e.message.includes(k));
  if (!key) console.error("[staff-work]", e.code, e.message);
  const [msg, status] = key ? MESSAGES[key] : ["Something went wrong. Please try again.", 500];
  return new WorkError(msg, status);
}

type NotificationRow = {
  id: string; staff_id: string | null; staff_email: string | null; to_role: "admin" | "staff"; title: string; message: string; type: NotificationType;
  task_id: string | null; link: string | null; amount: string | number | null; is_read: boolean; created_at: string;
};
export const mapNotification = (r: NotificationRow): StaffNotification => ({
  id: r.id,
  staffId: r.staff_id,
  staffEmail: r.staff_email,
  toRole: r.to_role,
  title: r.title,
  message: r.message,
  type: r.type,
  taskId: r.task_id,
  link: r.link,
  amount: r.amount == null ? null : Number(r.amount),
  isRead: r.is_read,
  createdAt: r.created_at,
});

/** Notifications the signed-in person may read: the owner gets "admin" ones, staff their own. */
export async function myNotifications(toRole: "admin" | "staff", limit = 100): Promise<StaffNotification[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("staff_notifications")
    .select("id, staff_id, staff_email, to_role, title, message, type, task_id, link, amount, is_read, created_at")
    .eq("to_role", toRole)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toError(error);
  return (data as NotificationRow[]).map(mapNotification);
}

export async function unreadCount(toRole: "admin" | "staff"): Promise<number> {
  const db = await createClient();
  const { count, error } = await db.from("staff_notifications").select("id", { count: "exact", head: true }).eq("to_role", toRole).eq("is_read", false);
  return error ? 0 : count ?? 0;
}

export async function markNotificationsRead(ids: string[] | null): Promise<number> {
  const db = await createClient();
  const { data, error } = await db.rpc("mark_notifications_read", { p_ids: ids });
  if (error) throw toError(error);
  return Number(data ?? 0);
}

type TaskRow = {
  id: string; staff_id: string; staff_email: string | null; task_type: TaskType; task_details: string; link: string | null; status: TaskStatus;
  created_at: string; corrected_at: string | null; staff_ratings: { rating: "good" | "poor"; reason: string | null; created_at: string }[] | null;
};
const mapTask = (r: TaskRow): StaffTask => {
  const last = [...(r.staff_ratings ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    id: r.id,
    staffId: r.staff_id,
    staffEmail: r.staff_email,
    taskType: r.task_type,
    details: r.task_details,
    link: r.link,
    status: r.status,
    createdAt: r.created_at,
    correctedAt: r.corrected_at,
    lastRating: last ? { rating: last.rating, reason: last.reason } : null,
  };
};

/** Tasks: the owner sees everyone's, staff only their own (RLS). */
export async function staffTasks(opts: { status?: TaskStatus[]; staffId?: string; limit?: number } = {}): Promise<StaffTask[]> {
  const db = await createClient();
  let q = db
    .from("staff_tasks")
    .select("id, staff_id, staff_email, task_type, task_details, link, status, created_at, corrected_at, staff_ratings ( rating, reason, created_at )")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status) q = q.in("status", opts.status);
  if (opts.staffId) q = q.eq("staff_id", opts.staffId);
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data as TaskRow[]).map(mapTask);
}

export interface Streak {
  staffId: string;
  name: string;
  email: string;
  good: number;
  poor: number;
}

/** Each staff member's current Good / Poor streak (owner: everyone; staff: themselves). */
export async function staffStreaks(): Promise<Streak[]> {
  const db = await createClient();
  const { data, error } = await db.from("staff_members").select("user_id, full_name, email, good_streak, poor_streak").neq("status", "disabled").order("full_name");
  if (error) throw toError(error);
  return (data ?? []).map((r) => ({ staffId: r.user_id, name: r.full_name || r.email, email: r.email, good: r.good_streak ?? 0, poor: r.poor_streak ?? 0 }));
}

export interface RatingResult {
  rating: "good" | "poor";
  goodStreak: number;
  poorStreak: number;
  bonus: number;
  penalty: number;
  balanceLeft: number;
}

export async function rateTask(input: { taskId: string; rating: "good" | "poor"; reason: string | null }): Promise<RatingResult> {
  const db = await createClient();
  const { data, error } = await db.rpc("rate_staff_task", { p_task_id: input.taskId, p_rating: input.rating, p_reason: input.reason });
  if (error) throw toError(error);
  const r = data as { rating: "good" | "poor"; good_streak: number; poor_streak: number; bonus: number; penalty: number; balance_left: number };
  return { rating: r.rating, goodStreak: r.good_streak, poorStreak: r.poor_streak, bonus: Number(r.bonus), penalty: Number(r.penalty), balanceLeft: Number(r.balance_left) };
}

export async function markTaskCorrected(taskId: string): Promise<void> {
  const db = await createClient();
  const { error } = await db.rpc("mark_task_corrected", { p_task_id: taskId });
  if (error) throw toError(error);
}

/** Counts for the admin menu: work waiting for the owner's rating and unread notifications. */
export async function navBadges(permissions: string[]): Promise<Record<string, number>> {
  try {
    const db = await createClient();
    if (permissions.includes("staff:manage")) {
      const [waiting, unread] = await Promise.all([
        db.from("staff_tasks").select("id", { count: "exact", head: true }).in("status", ["pending_review", "corrected"]),
        db.from("staff_notifications").select("id", { count: "exact", head: true }).eq("to_role", "admin").eq("is_read", false),
      ]);
      return { "/admin/staff-tasks": waiting.count ?? 0, "/admin/notifications": unread.count ?? 0 };
    }
    if (permissions.includes("work:self")) return { "/staff/notifications": await unreadCount("staff") };
  } catch {}
  return {};
}
