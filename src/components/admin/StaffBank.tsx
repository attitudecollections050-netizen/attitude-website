"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
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

/** The staff member's big "Withdraw to my account" button (their whole balance, to their saved bank). */
export function WithdrawButton({ balance, bank }: { balance: number; bank: Bank | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/withdraw", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't request your withdrawal.");
        setConfirming(false);
        return;
      }
      setDone(`Withdrawal requested ✓ ${naira(Number(data.amount))} will be sent to your account once the owner approves it.`);
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="border-2 border-[#16A34A] bg-[#F0FDF4] p-4 text-sm font-semibold text-[#166534]" role="status" data-testid="withdraw-done">{done}</p>;
  return (
    <div data-testid="withdraw">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!bank || balance <= 0}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl bg-[#2563EB] px-6 py-5 text-white shadow-[6px_6px_0_#1E3A8A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[22rem]"
          data-testid="withdraw-btn"
        >
          <span className="text-lg font-extrabold uppercase tracking-[0.12em]">Withdraw {naira(balance)} to my account</span>
          {bank && <span className="text-xs font-semibold opacity-90">{bank.bankName} · {bank.accountNumber} · {bank.accountName}</span>}
        </button>
      ) : (
        <div className="border-2 border-[#2563EB] bg-[#EFF6FF] p-4 text-sm" data-testid="withdraw-confirm">
          <p>
            Withdraw <strong>{naira(balance)}</strong> to <strong>{bank?.bankName} - {bank?.accountNumber} - {bank?.accountName}</strong>?
          </p>
          <p className="mt-1 text-xs text-black/60">The owner sends it and marks it paid. Check your account details are right.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void withdraw()} className="rounded-full bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" data-testid="withdraw-yes">
              {busy ? "Sending request…" : "Yes, withdraw"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-full border border-black px-5 py-2.5 text-sm font-semibold">Back</button>
          </div>
        </div>
      )}
      {!bank && <p className="mt-2 text-xs font-semibold text-[#9A3412]">⚠️ Add your bank details above to withdraw.</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
