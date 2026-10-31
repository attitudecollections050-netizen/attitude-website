"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { buttonClasses } from "@/components/ui/Button";
import { inputCls } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

const TOAST_EVENT = "staff-payments-toast";
const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** One withdrawal request on the owner's Staff page: send the transfer, then Approve — or Decline with a reason. */
export function WithdrawalReview({
  paymentId,
  name,
  amount,
  bank,
}: {
  paymentId: string;
  name: string;
  amount: number;
  bank: { bankName: string; accountNumber: string; accountName: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payouts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId, approve, note: approve ? null : note.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Couldn't save. Please try again.");
      // Shown by PaymentsLive, which stays on the page after this request disappears from the list.
      window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: approve ? `You paid ${name} ${naira(amount)}` : `Declined ${name}'s request — ${naira(amount)} is back in their balance` }));
      setMode("idle");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`review-${paymentId}`}>
      {mode === "idle" && (
        <>
          <button type="button" onClick={() => setMode("approve")} className={buttonClasses("primary", "sm")} data-testid="approve">
            <Banknote className="size-4" aria-hidden /> Approve
          </button>
          <button type="button" onClick={() => setMode("decline")} className={buttonClasses("ghost", "sm")} data-testid="decline">
            Decline
          </button>
        </>
      )}
      {mode === "approve" && (
        <div className="w-full rounded-2xl border border-line bg-neutral p-3 text-sm" data-testid="approve-confirm">
          <p>
            Send <strong>{naira(amount)}</strong> to <strong>{bank ? `${bank.bankName} - ${bank.accountNumber} - ${bank.accountName}` : "their account"}</strong>, then mark it paid.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void review(true)} className={buttonClasses("primary", "sm")} data-testid="approve-yes">
              {busy ? "Saving…" : "I've sent it — mark paid"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className={buttonClasses("outline", "sm")}>Back</button>
          </div>
        </div>
      )}
      {mode === "decline" && (
        <div className="w-full rounded-2xl border border-line bg-neutral p-3 text-sm">
          <label className="block font-semibold">
            Reason <span className="font-normal text-muted">(they&apos;ll see it)</span>
            <input className={cn(inputCls, "mt-1.5")} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Account name doesn't match" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void review(false)} className={buttonClasses("outline", "sm")} data-testid="decline-yes">
              {busy ? "Saving…" : "Decline request"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className={buttonClasses("ghost", "sm")}>Back</button>
          </div>
        </div>
      )}
      {error && <p className="w-full text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

/**
 * Refreshes the page when a staff payment is recorded (Supabase Realtime), so both
 * dashboards update without reloading. Staff only receive their own payments.
 */
export function PaymentsLive({ staffId }: { staffId?: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const onToast = (e: Event) => setToast((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const db = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (db) {
      channel = db
        .channel(`staff-payments-${staffId ?? "all"}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "staff_payments", ...(staffId ? { filter: `staff_id=eq.${staffId}` } : {}) }, () => router.refresh())
        .subscribe();
    }
    // Also refresh when the tab comes back into view (covers networks that block live updates).
    const onFocus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      if (channel && db) void db.removeChannel(channel);
    };
  }, [router, staffId]);
  if (!toast) return null;
  return (
    <div className="fixed inset-x-3 bottom-5 z-[95] mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-plum px-4 py-3 text-sm font-semibold text-white shadow-2xl" role="status" data-testid="pay-toast">
      <Banknote className="size-5 shrink-0 text-[#4ADE80]" aria-hidden />
      <span className="flex-1">{toast}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="-m-1 p-1 opacity-80 hover:opacity-100"><X className="size-4" /></button>
    </div>
  );
}
