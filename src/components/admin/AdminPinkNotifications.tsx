"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Bell, BellOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { playChime } from "@/components/assistant/chime";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

interface Alert {
  id: string;
  kind: "order" | "withdrawal";
  title: string;
  body: string;
  href: string;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const noSubscribe = () => () => {};
const permission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

/**
 * Pink pop-ups in the admin when a new order comes in (Haru) or a staff member asks to
 * withdraw (Jin), with a chime and — if allowed on this device — a system notification
 * when the admin tab is in the background. Uses Supabase Realtime, which only sends rows
 * the signed-in person is allowed to read.
 */
export function AdminPinkNotifications({ orders, withdrawals }: { orders: boolean; withdrawals: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [perm, setPerm] = useState<string>("default");
  const initialPerm = useSyncExternalStore(noSubscribe, permission, () => "default");
  const effectivePerm = perm === "default" ? initialPerm : perm;
  const unseen = useRef(0);
  const baseTitle = useRef<string | null>(null);

  const push = useCallback((a: Alert) => {
    setAlerts((list) => [a, ...list.filter((x) => x.id !== a.id)].slice(0, 5));
    playChime();
    if (document.hidden) {
      unseen.current += 1;
      baseTitle.current ??= document.title;
      document.title = `(${unseen.current}) ${a.title} · ${baseTitle.current}`;
      if (permission() === "granted") {
        try {
          const n = new Notification(a.title, { body: a.body, icon: a.kind === "order" ? "/mascots/girl-face.png" : "/mascots/boy-face.png", tag: a.id });
          n.onclick = () => {
            window.focus();
            window.location.href = a.href;
          };
        } catch {}
      }
    }
  }, []);

  // Reset the tab title when the admin comes back to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && baseTitle.current) {
        document.title = baseTitle.current;
        baseTitle.current = null;
        unseen.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!orders && !withdrawals) return;
    const db = createClient();
    const channel = db.channel("admin-alerts");
    if (orders) {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as { id: string; order_number: string; customer_name: string; total: number; currency: string };
        push({ id: `order-${o.id}`, kind: "order", title: "🎀 New Order!", body: `${o.order_number} · ${o.customer_name} · ${formatMoney(o.total, o.currency)}`, href: `/admin/orders/${o.id}` });
      });
    }
    if (withdrawals) {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_payments" }, async (payload) => {
        const p = payload.new as { id: string; staff_id: string; amount: number; type: string; status: string; bank_name: string | null; account_number: string | null };
        if (p.type !== "withdrawal" || p.status !== "pending") return;
        const { data } = await db.from("staff_members").select("full_name, email").eq("user_id", p.staff_id).maybeSingle();
        const who = data?.full_name || data?.email || "A staff member";
        push({
          id: `withdraw-${p.id}`,
          kind: "withdrawal",
          title: `💜 Withdrawal Request! ${naira(Number(p.amount))}`,
          body: `${who} wants ${naira(Number(p.amount))}${p.bank_name ? ` to ${p.bank_name} · ${p.account_number}` : ""}`,
          href: "/admin/staff",
        });
      });
    }
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [orders, withdrawals, push]);

  if (!orders && !withdrawals) return null;
  const close = (id: string) => setAlerts((list) => list.filter((a) => a.id !== id));

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[96] flex flex-col items-end gap-3 sm:left-auto sm:right-5 sm:w-[23rem]" aria-live="polite" data-testid="admin-alerts">
      <AnimatePresence initial={false}>
        {alerts.map((a) => (
          <m.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: 40, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className={cn(
              "pointer-events-auto relative w-full overflow-hidden rounded-[1.4rem] border-2 p-4 shadow-[0_18px_40px_-12px_rgba(233,78,138,0.55)]",
              a.kind === "order" ? "border-[#FFB6D9] bg-[#FFE4EF]" : "border-[#C084FC] bg-[#F5E8FF]",
            )}
            role="status"
            data-testid={`alert-${a.kind}`}
          >
            <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 text-5xl opacity-30">✨</span>
            <button type="button" onClick={() => close(a.id)} className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full text-[#C2185B] hover:bg-white/70" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3 pr-6">
              <m.span
                className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow"
                animate={{ rotate: [0, -8, 8, -6, 0], y: [0, -4, 0] }}
                transition={{ duration: 1.2, repeat: 2 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.kind === "order" ? "/mascots/girl-face.png" : "/mascots/boy-face.png"} alt={a.kind === "order" ? "Haru" : "Jin"} className="size-full object-cover" />
              </m.span>
              <div className="min-w-0">
                <p className={cn("font-display text-lg font-semibold leading-tight", a.kind === "order" ? "text-[#C2185B]" : "text-[#7E22CE]")}>{a.title}</p>
                <p className="mt-0.5 text-sm text-plum">{a.body}</p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={a.href}
                    onClick={() => close(a.id)}
                    className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold text-white", a.kind === "order" ? "bg-[#E94E8A]" : "bg-[#9333EA]")}
                  >
                    View
                  </Link>
                  <button type="button" onClick={() => close(a.id)} className="rounded-full border border-current bg-white px-3.5 py-1.5 text-xs font-bold text-[#C2185B]">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </m.div>
        ))}
      </AnimatePresence>
      {effectivePerm !== "granted" && effectivePerm !== "unsupported" && (
        <button
          type="button"
          onClick={async () => {
            playChime(); // also unlocks sound on this device
            setPerm(await Notification.requestPermission());
          }}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border-2 border-[#FFB6D9] bg-white px-3 py-1.5 text-xs font-bold text-[#C2185B] shadow"
          data-testid="alerts-enable"
        >
          {effectivePerm === "denied" ? <BellOff className="size-3.5" aria-hidden /> : <Bell className="size-3.5" aria-hidden />}
          {effectivePerm === "denied" ? "Phone alerts blocked in browser settings" : "Turn on order & withdrawal alerts"}
        </button>
      )}
    </div>
  );
}
