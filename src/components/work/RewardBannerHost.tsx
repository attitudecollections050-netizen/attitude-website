"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { notify } from "@/lib/notify-sound";
import { RewardBanner } from "./RewardBanner";

export interface RewardNote {
  id: string;
  type: "bonus" | "penalty";
  title: string;
  message: string;
}

/**
 * Shows the full-screen reward banner for a staff member: right away when the owner's rating
 * completes 3 positives (+₦25) or 3 negatives (−₦25), or on their next visit if they weren't
 * online. Closing it marks that message read, so it shows once.
 */
export function RewardBannerHost({ initial }: { initial: RewardNote | null }) {
  const router = useRouter();
  const [note, setNote] = useState<RewardNote | null>(initial);

  useEffect(() => {
    const db = createClient();
    const channel = db
      .channel("reward-banner")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_notifications" }, (payload) => {
        const r = payload.new as { id: string; to_role: string; type: string; title: string; message: string };
        if (r.to_role !== "staff" || (r.type !== "bonus" && r.type !== "penalty")) return;
        setNote({ id: r.id, type: r.type, title: r.title, message: r.message });
        // Ka-ching for a win; the gentle ding for a loss (once, shared with the other pop-ups).
        notify(`note-${r.id}`, r.title, r.message, { sound: r.type === "bonus" ? "payment" : "default", href: "/staff/earnings" });
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, []);

  const close = useCallback(() => {
    if (!note) return;
    void fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [note.id] }) }).catch(() => {});
    setNote(null);
  }, [note]);

  if (!note) return null;
  const win = note.type === "bonus";
  return (
    <RewardBanner
      variant={win ? "win" : "loss"}
      title={note.title}
      message={note.message}
      actionLabel={win ? "See my wallet 💖" : "I'll do better 💪"}
      onAction={() => {
        close();
        router.push(win ? "/staff/earnings" : "/staff/notifications");
      }}
      onClose={close}
    />
  );
}
