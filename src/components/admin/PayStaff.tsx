"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useDialog } from "@/components/ui/useDialog";
import { buttonClasses } from "@/components/ui/Button";
import { inputCls } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** "Pay" button + modal: the owner records a payout (or a bonus) for a staff member. */
export function PayStaffButton({
  staffId,
  name,
  balanceLeft,
  earned,
  withdrawn,
  pending = 0,
  bank,
  label = "Pay",
  testId,
}: {
  staffId: string;
  name: string;
  balanceLeft: number;
  earned: number;
  withdrawn: number;
  pending?: number;
  bank: { bankName: string; accountNumber: string; accountName: string } | null;
  label?: string;
  testId?: string;
}) {
  const router = useRouter();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"withdrawal" | "bonus" | "earning">("withdrawal");
  const [description, setDescription] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const close = () => {
    setOpen(false);
    setConfirming(false);
    setError(null);
  };
  useDialog(open, close, panel);

  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(value) && value > 0 && value <= 100_000_000 && Math.round(value * 100) === value * 100;
  const over = type === "withdrawal" && valid && value > balanceLeft;
  const needsBank = type === "withdrawal" && !bank;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pay-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, amount: value, description: description.trim() || null, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Payment could not be saved.");
        setConfirming(false);
        return;
      }
      setDone(`${type === "withdrawal" ? "Paid" : "Added"} ${naira(value)}${typeof data.balance_left === "number" ? ` — balance left ${naira(data.balance_left)}` : ""}`);
      setToast(type === "withdrawal" ? `You paid ${name} ${naira(value)} — waiting for them to confirm receipt` : `You added a ${naira(value)} ${type === "bonus" ? "bonus" : "extra earning"} for ${name}`);
      setOpen(false);
      setConfirming(false);
      setAmount("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setDone(null); setOpen(true); }} className={buttonClasses("primary", "sm")} data-testid={testId ?? `pay-${staffId}`}>
        <Banknote className="size-4" aria-hidden /> {label}
      </button>
      {done && <p className="w-full text-xs font-semibold text-success" role="status">{done}</p>}
      {toast && (
        <div className="fixed inset-x-3 bottom-5 z-[95] mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-plum px-4 py-3 text-sm font-semibold text-white shadow-2xl" role="status" data-testid="pay-toast">
          <Banknote className="size-5 shrink-0 text-[#4ADE80]" aria-hidden />
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="-m-1 p-1 opacity-80 hover:opacity-100"><X className="size-4" /></button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-plum/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={close}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:rounded-3xl"
            data-testid="pay-modal"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`${id}-t`} className="font-display text-2xl">Pay {name}</h2>
                <p className="mt-1 text-sm" data-testid="pay-modal-totals">
                  Earned: <strong className="text-[#2563EB]">{naira(earned)}</strong> | Withdrawn: <strong className="text-[#EA580C]">{naira(withdrawn)}</strong> | Left:{" "}
                  <strong className="text-[#16A34A]">{naira(balanceLeft)}</strong>
                </p>
                {pending > 0 && <p className="mt-0.5 text-xs text-muted">{naira(pending)} sent and waiting for them to confirm.</p>}
              </div>
              <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full hover:bg-neutral" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className={cn("mt-4 rounded-2xl border px-4 py-3 text-sm", bank ? "border-line bg-neutral" : "border-[#EA580C] bg-[#FFF7ED] text-[#9A3412]")} data-testid="pay-modal-bank">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">Their account</p>
              {bank ? (
                <p className="mt-1 font-semibold">
                  {bank.bankName} - <span className="font-mono">{bank.accountNumber}</span> - {bank.accountName}
                </p>
              ) : (
                <p className="mt-1 font-semibold">⚠️ No bank details yet. Ask {name} to add them on their dashboard before you pay a payout.</p>
              )}
            </div>
            {!confirming ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) setConfirming(true);
                }}
              >
                <label className="block text-sm font-semibold">
                  Amount (₦)
                  <input
                    className={cn(inputCls, "mt-1.5")}
                    inputMode="decimal"
                    autoFocus
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    name="amount"
                    aria-invalid={amount !== "" && !valid}
                  />
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold">Type</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {([
                      ["withdrawal", "Payout (withdrawal)"],
                      ["bonus", "Bonus"],
                      ["earning", "Extra earning"],
                    ] as const).map(([v, label]) => (
                      <label key={v} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold", type === v ? "border-plum bg-plum text-white" : "border-line hover:border-plum")}>
                        <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {type === "withdrawal" ? "Money you paid them. It's added to “Withdrawn” and taken off their balance." : "Money you owe them on top of product earnings. It's added to their earnings and balance."}
                  </p>
                </fieldset>
                <label className="block text-sm font-semibold">
                  Description <span className="font-normal text-muted">(optional)</span>
                  <input className={cn(inputCls, "mt-1.5")} maxLength={200} placeholder="e.g. October payout, bank transfer" value={description} onChange={(e) => setDescription(e.target.value)} name="description" />
                </label>
                {needsBank && <p className="text-xs font-semibold text-[#9A3412]">A payout needs their bank details. You can still add a bonus.</p>}
                {over && <p className="rounded-xl bg-[#fff8e8] px-3 py-2 text-xs text-[#6b4a00]">This is more than their balance left — the balance will go negative ({naira(balanceLeft - value)}).</p>}
                {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                <button type="submit" disabled={!valid || needsBank} className={cn(buttonClasses("primary", "md"), "w-full disabled:opacity-50")}>Continue</button>
              </form>
            ) : (
              <div className="mt-5 space-y-4" data-testid="pay-confirm">
                <p className="rounded-2xl bg-neutral p-4 text-sm">
                  {type === "withdrawal" ? (
                    <>
                      Send <strong>{naira(value)}</strong> to <strong>{bank?.bankName} - {bank?.accountNumber} - {bank?.accountName}</strong>
                    </>
                  ) : (
                    <>
                      Record <strong>{naira(value)}</strong> as a <strong>{type}</strong> for <strong>{name}</strong>
                    </>
                  )}
                  {description.trim() ? <> — “{description.trim()}”</> : null}?
                  <span className="mt-1 block text-xs text-muted">
                    {type === "withdrawal" ? `Make the bank transfer, then confirm here. ${name} will be asked to confirm they received it.` : "Payments can't be edited later."}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirming(false)} className={cn(buttonClasses("outline", "md"), "flex-1")} disabled={busy}>Back</button>
                  <button type="button" onClick={() => void submit()} className={cn(buttonClasses("primary", "md"), "flex-1")} disabled={busy} data-testid="pay-confirm-btn">
                    {busy ? "Saving…" : type === "withdrawal" ? "Confirm & Pay" : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Refreshes the page when a staff payment is recorded (Supabase Realtime), so both
 * dashboards update without reloading. Staff only receive their own payments.
 */
export function PaymentsLive({ staffId }: { staffId?: string }) {
  const router = useRouter();
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
  return null;
}
