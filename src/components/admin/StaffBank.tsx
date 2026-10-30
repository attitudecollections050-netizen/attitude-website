"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const field = "mt-1.5 w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E94E8A]";

interface Bank {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/** 💳 My Account Details — staff save where they want to be paid. */
export function BankDetailsForm({ banks, initial, readOnly = false }: { banks: readonly string[]; initial: Bank | null; readOnly?: boolean }) {
  const router = useRouter();
  const known = initial && banks.includes(initial.bankName);
  const [editing, setEditing] = useState(!initial && !readOnly);
  const [bank, setBank] = useState(initial ? (known ? initial.bankName : "Other") : "");
  const [otherBank, setOtherBank] = useState(initial && !known ? initial.bankName : "");
  const [number, setNumber] = useState(initial?.accountNumber ?? "");
  const [name, setName] = useState(initial?.accountName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const bankName = bank === "Other" ? otherBank.trim() : bank;
  const digits = number.replace(/\D/g, "");
  const numberOk = /^\d{10}$/.test(digits);
  const valid = bankName.length >= 2 && numberOk && name.trim().length >= 2;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/staff/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_name: bankName, account_number: digits, account_name: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ tone: "error", text: data.error ?? "Couldn't save your details." });
      setMsg({ tone: "ok", text: "Saved! The owner will pay you into this account." });
      setEditing(false);
      router.refresh();
    } catch {
      setMsg({ tone: "error", text: "Network problem. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-black p-6" aria-labelledby="bank-h" data-testid="bank-details">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="bank-h" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
          <CreditCard className="size-4" aria-hidden /> 💳 My Account Details
        </h2>
        {initial && !editing && !readOnly && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold underline underline-offset-4">Change</button>
        )}
      </div>
      {!initial && (
        <p className="mt-3 border border-[#EA580C] bg-[#FFF7ED] px-3 py-2 text-sm font-semibold text-[#9A3412]" role="alert" data-testid="bank-warning">
          ⚠️ Add your bank details to receive payments
        </p>
      )}
      {initial && !editing && (
        <p className="mt-3 text-sm" data-testid="bank-saved">
          <span className="font-semibold">{initial.bankName}</span> · <span className="font-mono">{initial.accountNumber}</span> · {initial.accountName}
        </p>
      )}
      {editing && (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save();
          }}
        >
          <label className="block text-sm font-semibold">
            Bank name
            <select className={field} value={bank} onChange={(e) => setBank(e.target.value)} required name="bank">
              <option value="" disabled>Choose your bank…</option>
              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value="Other">Other bank…</option>
            </select>
            {bank === "Other" && <input className={field} placeholder="Type your bank" value={otherBank} onChange={(e) => setOtherBank(e.target.value)} maxLength={60} aria-label="Bank name" />}
          </label>
          <label className="block text-sm font-semibold">
            Account number
            <input
              className={cn(field, "font-mono tracking-wider", number && !numberOk && "border-danger")}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0123456789"
              maxLength={10}
              value={digits}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
              name="account_number"
              aria-invalid={Boolean(number) && !numberOk}
              aria-describedby="acct-hint"
            />
            <span id="acct-hint" className={cn("mt-1 block text-[11px] font-normal", number && !numberOk ? "text-danger" : "text-black/50")}>
              {number && !numberOk ? `${digits.length}/10 digits` : "10 digits (NUBAN)"}
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Account name
            <input className={cn(field, "uppercase")} placeholder="As it appears on your account" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required name="account_name" />
            <span className="mt-1 block text-[11px] font-normal text-black/50">Must match your bank account exactly.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <button type="submit" disabled={!valid || busy} className={cn(buttonClasses("primary", "sm"), "disabled:opacity-50")} data-testid="bank-save">
              {busy ? "Saving…" : "Save Account Details"}
            </button>
            {initial && <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold underline">Cancel</button>}
          </div>
        </form>
      )}
      {msg && <p className={cn("mt-3 text-sm font-semibold", msg.tone === "ok" ? "text-success" : "text-danger")} role="status">{msg.text}</p>}
    </section>
  );
}

/** 🔔 PAYMENT ALERT — the staff member confirms whether a payout reached their account. */
export function PayoutAlert({
  payout,
  canAnswer,
  readOnly = false,
}: {
  payout: { id: string; amount: number; createdAt: string; bank: Bank | null };
  canAnswer: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const date = new Date(payout.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

  const answer = async (received: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/confirm-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: payout.id, received, note: received ? null : note.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Couldn't save your answer.");
      setAnswered(received ? `Thanks! ${naira(payout.amount)} is now in your Withdrawn total.` : "Thanks — the owner has been told it didn't arrive. The money is back in your balance.");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (answered) return <p className="border-2 border-[#16A34A] bg-[#F0FDF4] p-4 text-sm font-semibold text-[#166534]" role="status">{answered}</p>;
  return (
    <section className="border-2 border-[#E94E8A] bg-[#FFF0F7] p-6 shadow-[6px_6px_0_#E94E8A]" aria-labelledby={`alert-${payout.id}`} data-testid="payout-alert">
      <h2 id={`alert-${payout.id}`} className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#C2185B]">🔔 Payment alert</h2>
      <p className="mt-3 text-lg font-semibold">
        Owner sent <span className="text-2xl font-extrabold">{naira(payout.amount)}</span> to your account:
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-black/60">Bank:</dt>
        <dd className="font-semibold">{payout.bank?.bankName ?? "—"}</dd>
        <dt className="text-black/60">Number:</dt>
        <dd className="font-mono font-semibold">{payout.bank?.accountNumber ?? "—"}</dd>
        <dt className="text-black/60">Name:</dt>
        <dd className="font-semibold">{payout.bank?.accountName ?? "—"}</dd>
        <dt className="text-black/60">Date:</dt>
        <dd className="font-semibold">{date}</dd>
      </dl>
      {readOnly ? (
        <p className="mt-4 text-xs text-black/60">Waiting for the staff member to confirm.</p>
      ) : (
        <>
          <p className="mt-4 font-semibold">Did you receive it?</p>
          {!canAnswer && <p className="mt-1 text-xs text-[#9A3412]">⚠️ Add your bank details above first.</p>}
          {asking ? (
            <div className="mt-3 space-y-2">
              <label className="block text-sm">
                What happened? <span className="text-black/50">(optional)</span>
                <input className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Nothing arrived yet" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void answer(false)} disabled={busy || !canAnswer} className={cn(buttonClasses("outline", "sm"), "disabled:opacity-50")} data-testid="payout-no-confirm">
                  Send: I did not receive it
                </button>
                <button type="button" onClick={() => setAsking(false)} className="text-xs font-semibold underline">Back</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void answer(true)} disabled={busy || !canAnswer} className="inline-flex items-center gap-2 rounded-full bg-[#16A34A] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" data-testid="payout-yes">
                <CheckCircle2 className="size-4" aria-hidden /> ✅ Yes, Confirm I Received {naira(payout.amount)}
              </button>
              <button type="button" onClick={() => setAsking(true)} disabled={busy || !canAnswer} className="inline-flex items-center gap-2 rounded-full border-2 border-danger px-5 py-3 text-sm font-bold text-danger transition hover:bg-white disabled:opacity-50" data-testid="payout-no">
                <XCircle className="size-4" aria-hidden /> ❌ No, I Did Not Receive
              </button>
            </div>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </section>
  );
}
