"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Volume2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { playChime } from "@/components/assistant/chime";
import { canSpeak, speak, stopSpeaking } from "@/components/assistant/voice";
import { cn } from "@/lib/cn";

export interface HaruNote {
  id: string;
  title: string;
  message: string;
  type: string;
  taskId: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  staffEmail?: string | null;
}

type Row = { id: string; title: string; message: string; type: string; task_id: string | null; link: string | null; is_read: boolean; created_at: string; to_role: string; staff_email: string | null };
const fromRow = (r: Row): HaruNote => ({ id: r.id, title: r.title, message: r.message, type: r.type, taskId: r.task_id, link: r.link, isRead: r.is_read, createdAt: r.created_at, staffEmail: r.staff_email });

/** Card colours per kind of message. */
const TONE: Record<string, { card: string; title: string; emoji: string }> = {
  bonus: { card: "border-[#F9A8D4] bg-gradient-to-br from-[#FFF1F7] to-[#FFE4EF]", title: "text-[#C2185B]", emoji: "🎉" },
  rated_good: { card: "border-[#FFB6D9] bg-[#FFF5FA]", title: "text-[#C2185B]", emoji: "✨" },
  rated_poor: { card: "border-[#FDBA74] bg-[#FFF7ED]", title: "text-[#C2410C]", emoji: "💪" },
  penalty: { card: "border-[#FCA5A5] bg-[#FEF2F2]", title: "text-[#B91C1C]", emoji: "🌱" },
  task_done: { card: "border-[#FFB6D9] bg-[#FFF5FA]", title: "text-[#C2185B]", emoji: "⭐" },
  corrected: { card: "border-[#C4B5FD] bg-[#F5F3FF]", title: "text-[#6D28D9]", emoji: "🔧" },
  encouragement: { card: "border-[#FFB6D9] bg-[#FFF5FA]", title: "text-[#C2185B]", emoji: "💖" },
};
const tone = (t: string) => TONE[t] ?? TONE.encouragement;
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const needsFix = (t: string) => t === "rated_poor" || t === "penalty";

async function markRead(ids: string[] | null) {
  await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => {});
}

const noSubscribe = () => () => {};

function HearButton({ text, className }: { text: string; className?: string }) {
  const [on, setOn] = useState(false);
  const supported = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (on) {
          stopSpeaking();
          setOn(false);
          return;
        }
        void speak(text, { onStart: () => setOn(true), onEnd: () => setOn(false) }, "haru");
      }}
      className={cn("inline-flex items-center gap-1 rounded-full border border-[#E94E8A] bg-white px-3 py-1.5 text-xs font-bold text-[#C2185B]", className)}
      aria-pressed={on}
      data-testid="hear-haru"
    >
      <Volume2 className="size-3.5" aria-hidden /> {on ? "Stop" : "Hear Haru"}
    </button>
  );
}

function HaruAvatar({ size = "size-12", wiggle = false }: { size?: string; wiggle?: boolean }) {
  return (
    <m.span
      className={cn("relative shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow", size)}
      animate={wiggle ? { rotate: [0, -8, 8, -6, 0], y: [0, -4, 0] } : undefined}
      transition={{ duration: 1.2, repeat: 2 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascots/girl-face.png" alt="Haru" className="size-full object-cover" />
    </m.span>
  );
}

/**
 * Haru's messages as pink anime cards, newest first, live. Staff get "Go Correct Now" and
 * "I fixed it" on work rated Poor; the owner gets a "Rate now" link on new work.
 */
export function HaruNotificationList({ initial, role, taskStatus = {} }: { initial: HaruNote[]; role: "admin" | "staff"; taskStatus?: Record<string, string> }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState(taskStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((n) => !n.isRead).length;

  useEffect(() => {
    const db = createClient();
    const channel = db
      .channel(`haru-list-${role}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_notifications" }, (payload) => {
        const r = payload.new as Row;
        if (r.to_role !== role) return;
        setItems((list) => (list.some((x) => x.id === r.id) ? list : [fromRow(r), ...list]));
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [role]);

  const readAll = async () => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    await markRead(null);
    router.refresh();
  };
  const readOne = (id: string) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    void markRead([id]);
  };
  const fixed = async (n: HaruNote) => {
    if (!n.taskId) return;
    setBusy(n.id);
    setError(null);
    try {
      const res = await fetch("/api/staff/tasks/corrected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: n.taskId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Couldn't send that. Please try again.");
      setStatus((s) => ({ ...s, [n.taskId!]: "corrected" }));
      readOne(n.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="haru-notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          {unread > 0 ? (
            <span className="rounded-full bg-[#E94E8A] px-2.5 py-0.5 text-xs font-bold text-white" data-testid="unread-badge">{unread} new</span>
          ) : (
            <span className="text-black/50">All caught up 💖</span>
          )}
        </p>
        {unread > 0 && (
          <button type="button" onClick={() => void readAll()} className="text-xs font-semibold underline underline-offset-4" data-testid="read-all">
            Mark all as read
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {items.length === 0 ? (
        <div className="mt-6 flex items-center gap-4 rounded-[1.4rem] border-2 border-dashed border-[#FFB6D9] bg-[#FFF5FA] p-6">
          <HaruAvatar />
          <p className="text-sm text-[#9D174D]">
            {role === "staff" ? "Annyeong! No messages yet. When the owner rates your work, I'll tell you here 💖" : "No staff work yet. When staff finish something, I'll tell you here so you can rate it 💖"}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((n) => {
            const t = tone(n.type);
            const st = n.taskId ? status[n.taskId] : undefined;
            return (
              <li
                key={n.id}
                className={cn("relative rounded-[1.4rem] border-2 p-4 shadow-[0_10px_28px_-16px_rgba(233,78,138,0.6)]", t.card, !n.isRead && "ring-2 ring-[#E94E8A]/40")}
                data-testid={`note-${n.type}`}
              >
                {!n.isRead && <span className="absolute right-4 top-4 size-2.5 rounded-full bg-[#E94E8A]" aria-label="Unread" />}
                <div className="flex gap-3">
                  <HaruAvatar />
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C2185B]/80">DJ ATTITUDE mini HARU · {when(n.createdAt)}</p>
                    <p className={cn("mt-0.5 font-display text-lg font-semibold leading-tight", t.title)}>
                      {t.emoji} {n.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-plum">{n.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {role === "staff" && needsFix(n.type) && n.link && st !== "corrected" && st !== "rated_good" && (
                        <Link href={n.link} onClick={() => readOne(n.id)} className="rounded-full bg-[#E94E8A] px-4 py-1.5 text-xs font-bold text-white" data-testid="go-correct">
                          Go Correct Now →
                        </Link>
                      )}
                      {role === "staff" && needsFix(n.type) && n.taskId && st === "rated_poor" && (
                        <button type="button" disabled={busy === n.id} onClick={() => void fixed(n)} className="rounded-full border-2 border-[#16A34A] bg-white px-4 py-1.5 text-xs font-bold text-[#166534] disabled:opacity-50" data-testid="mark-fixed">
                          {busy === n.id ? "Sending…" : "✅ I fixed it"}
                        </button>
                      )}
                      {role === "staff" && needsFix(n.type) && st === "corrected" && <span className="text-xs font-semibold text-[#166534]">✅ You fixed it — waiting for the owner to check</span>}
                      {role === "staff" && n.type === "bonus" && <Link href="/staff/earnings" onClick={() => readOne(n.id)} className="rounded-full bg-[#E94E8A] px-4 py-1.5 text-xs font-bold text-white">See my wallet →</Link>}
                      {role === "admin" && (n.type === "task_done" || n.type === "corrected") && (
                        <Link href="/admin/staff-tasks" onClick={() => readOne(n.id)} className="rounded-full bg-[#E94E8A] px-4 py-1.5 text-xs font-bold text-white" data-testid="rate-now">
                          Rate now →
                        </Link>
                      )}
                      <HearButton text={`${n.title}. ${n.message}`} />
                      {!n.isRead && (
                        <button type="button" onClick={() => readOne(n.id)} className="text-xs font-semibold text-black/50 underline underline-offset-4">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Live pink pop-ups for a staff member when Haru sends them something (a rating, bonus or
 * deduction). Realtime only delivers the person's own notifications.
 */
export function HaruToasts() {
  const [toasts, setToasts] = useState<HaruNote[]>([]);
  const close = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  useEffect(() => {
    const db = createClient();
    const channel = db
      .channel("haru-toasts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_notifications" }, (payload) => {
        const r = payload.new as Row;
        if (r.to_role !== "staff") return;
        setToasts((list) => [fromRow(r), ...list.filter((x) => x.id !== r.id)].slice(0, 3));
        playChime();
        if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(r.title, { body: r.message, icon: "/mascots/girl-face.png", tag: r.id });
          } catch {}
        }
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[96] flex flex-col items-end gap-3 sm:left-auto sm:right-5 sm:w-[24rem]" aria-live="polite" data-testid="haru-toasts">
      <AnimatePresence initial={false}>
        {toasts.map((n) => {
          const t = tone(n.type);
          return (
            <m.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 40, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className={cn("pointer-events-auto relative w-full overflow-hidden rounded-[1.4rem] border-2 p-4 shadow-[0_18px_40px_-12px_rgba(233,78,138,0.55)]", t.card)}
              role="status"
              data-testid={`toast-${n.type}`}
            >
              <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 text-5xl opacity-30">✨</span>
              <button type="button" onClick={() => close(n.id)} className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full text-[#C2185B] hover:bg-white/70" aria-label="Close">
                <X className="size-4" />
              </button>
              <div className="flex gap-3 pr-6">
                <HaruAvatar size="size-14" wiggle />
                <div className="min-w-0">
                  <p className={cn("font-display text-lg font-semibold leading-tight", t.title)}>{t.emoji} {n.title}</p>
                  <p className="mt-0.5 line-clamp-4 text-sm text-plum">{n.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={needsFix(n.type) && n.link ? n.link : n.type === "bonus" ? "/staff/earnings" : "/staff/notifications"}
                      onClick={() => close(n.id)}
                      className="rounded-full bg-[#E94E8A] px-3.5 py-1.5 text-xs font-bold text-white"
                    >
                      {needsFix(n.type) ? "Go Correct Now" : "View"}
                    </Link>
                    <HearButton text={`${n.title}. ${n.message}`} className="!py-1.5" />
                  </div>
                </div>
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Refreshes a server-rendered page whenever Haru sends this person a new notification. */
export function RefreshOnNotification({ role }: { role: "admin" | "staff" }) {
  const router = useRouter();
  useEffect(() => {
    const db = createClient();
    const channel = db
      .channel(`haru-refresh-${role}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_notifications" }, (payload) => {
        if ((payload.new as Row).to_role === role) router.refresh();
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [role, router]);
  return null;
}
