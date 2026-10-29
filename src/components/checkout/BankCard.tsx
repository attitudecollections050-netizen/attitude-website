"use client";
import { useRef, useState } from "react";
import { Check, Copy, Landmark, ShieldCheck } from "lucide-react";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white hover:text-rose-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** The store's bank details as a raised, tilting card (like a payment provider's checkout). */
export function BankCard({ bankName, accountName, accountNumber, amount, amountPlain, orderNumber }: { bankName: string; accountName: string; accountNumber: string; amount: string; amountPlain: string; orderNumber?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const grouped = accountNumber.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
  const emboss = { textShadow: "0 1px 0 rgba(255,255,255,0.25), 0 -1px 0 rgba(0,0,0,0.35), 0 2px 6px rgba(37,25,35,0.35)" };

  return (
    <div className="[perspective:1400px]">
      <div
        ref={ref}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const r = ref.current!.getBoundingClientRect();
          setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -8, y: ((e.clientX - r.left) / r.width - 0.5) * 10 });
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, backgroundImage: "radial-gradient(120% 140% at 0% 0%, #f283b8 0%, #d94f91 38%, #b8357a 70%, #7a2458 100%)" }}
        className="relative overflow-hidden rounded-[22px] p-6 text-white shadow-[0_2px_0_rgba(255,255,255,0.35)_inset,0_-2px_0_rgba(0,0,0,0.15)_inset,0_30px_60px_-24px_rgba(184,53,122,0.75),0_14px_24px_-18px_rgba(37,25,35,0.6)] transition-transform duration-200 ease-out [transform-style:preserve-3d] sm:p-8"
      >
        {/* sheen and rings */}
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/12 blur-[1px]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full border-[28px] border-white/8" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_45%,transparent_60%)]" />

        <div className="relative flex items-start justify-between gap-4 [transform:translateZ(30px)]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30 shadow-inner">
              <Landmark className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Pay by bank transfer</p>
              <p className="text-lg font-bold" style={emboss}>{bankName}</p>
            </div>
          </div>
          {/* card chip */}
          <span aria-hidden className="hidden h-9 w-12 rounded-md bg-[linear-gradient(135deg,#ffe3b3,#d9a65b_45%,#f6d38f_60%,#b98337)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] sm:block" />
        </div>

        <div className="relative mt-7 [transform:translateZ(40px)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Account number</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[1.9rem] font-bold leading-none tracking-[0.12em] sm:text-4xl" style={emboss} data-testid="account-number">{grouped}</p>
            <CopyButton value={accountNumber} label="account number" />
          </div>
        </div>

        <div className="relative mt-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end [transform:translateZ(30px)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Account name</p>
            <p className="mt-1 text-base font-bold uppercase tracking-[0.06em]" style={emboss} data-testid="account-name">{accountName}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">Amount to pay</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-2xl font-extrabold tabular-nums" style={emboss} data-testid="amount-due">{amount}</p>
              <CopyButton value={amountPlain} label="amount" />
            </div>
          </div>
        </div>

        <div className="relative mt-6 space-y-1.5 border-t border-white/20 pt-4 text-xs text-white/85">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            <span>Please check the account name in your bank app before you transfer.</span>
          </p>
          {orderNumber && (
            <p className="pl-6">Add <strong className="font-bold">{orderNumber}</strong> as the transfer narration so we can match your payment quickly.</p>
          )}
        </div>
      </div>
    </div>
  );
}
