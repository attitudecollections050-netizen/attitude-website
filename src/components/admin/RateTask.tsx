"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const QUICK_REASONS = ["Wrong design picked", "Wrong product", "Blurry / bad photo", "Wrong price", "Missing sizes or colours", "Spelling mistakes"];

/** ✅ Good / ❌ Poor for one piece of staff work. Poor asks what was wrong. */
export function RateTask({ taskId, staffName }: { taskId: string; staffName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "poor">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const send = async (rating: "good" | "poor") => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/staff-tasks/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, rating, reason: reason.trim() || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ tone: "error", text: d.error ?? "Couldn't save the rating." });
      const text =
        d.bonus > 0
          ? `🎉 3 Good in a row — ₦25 bonus added to ${staffName}'s wallet! Haru told them.`
          : d.penalty > 0
            ? `🌱 3 Poor in a row — ₦${d.penalty} deducted from ${staffName}. Haru sent them encouragement.`
            : rating === "good"
              ? `✅ Rated Good. Haru told ${staffName} (good streak ${d.goodStreak}/3).`
              : `❌ Rated Poor. Haru asked ${staffName} to correct it (poor streak ${d.poorStreak === 0 ? "3/3, balance was ₦0" : `${d.poorStreak}/3`}).`;
      setMsg({ tone: "ok", text });
      router.refresh();
    } catch {
      setMsg({ tone: "error", text: "Network problem. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  if (msg?.tone === "ok") return <p className="text-sm font-semibold text-[#166534]" role="status" data-testid="rate-done">{msg.text}</p>;
  return (
    <div className="space-y-2" data-testid="rate-task">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void send("good")} className="rounded-full bg-[#16A34A] px-5 py-2 text-sm font-bold text-white disabled:opacity-50" data-testid="rate-good">
            ✅ Good
          </button>
          <button type="button" disabled={busy} onClick={() => setMode("poor")} className="rounded-full bg-[#DC2626] px-5 py-2 text-sm font-bold text-white disabled:opacity-50" data-testid="rate-poor">
            ❌ Poor
          </button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length >= 3) void send("poor");
          }}
        >
          <label className="block text-sm font-semibold">
            What did they do wrong?
            <input
              className="field mt-1 !py-2 !text-sm"
              placeholder="e.g. Wrong product, picked No.2 instead of No.5…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              autoFocus
              required
              data-testid="poor-reason"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="Quick reasons">
            {QUICK_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", reason === r ? "border-[#DC2626] bg-[#FEF2F2] text-[#B91C1C]" : "border-black/20 hover:border-black")}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || reason.trim().length < 3} className="rounded-full bg-[#DC2626] px-5 py-2 text-sm font-bold text-white disabled:opacity-50" data-testid="poor-send">
              {busy ? "Saving…" : "Send Poor rating"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className="rounded-full border border-black px-4 py-2 text-sm font-semibold">
              Back
            </button>
          </div>
        </form>
      )}
      {msg?.tone === "error" && <p className="text-sm text-danger" role="alert">{msg.text}</p>}
    </div>
  );
}
