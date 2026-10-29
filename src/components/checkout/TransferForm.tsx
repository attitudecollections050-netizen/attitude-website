"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImageUp, Loader2, Lock } from "lucide-react";
import { submitTransferClaim, type TransferClaimState } from "@/app/actions/transfer";
import { WhatsAppIcon } from "@/components/ui/WhatsAppLink";
import { cn } from "@/lib/cn";

const field =
  "block w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-plum shadow-[0_1px_0_rgba(37,25,35,0.03)] outline-none transition placeholder:text-muted/70 focus:border-rose focus:ring-4 focus:ring-rose/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10";

function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-plum">
        <span>
          {label} {required && <span className="text-rose-deep" aria-hidden>*</span>}
        </span>
        {!required && <span className="text-[11px] font-normal text-muted">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TransferForm({ orderNumber, token, defaultName, defaultAmount, defaultWhatsApp, amountLabel }: { orderNumber: string; token: string; defaultName: string; defaultAmount: string; defaultWhatsApp: string; amountLabel: string }) {
  const [state, action, pending] = useActionState<TransferClaimState, FormData>(submitTransferClaim, null);
  // The chosen file belongs to one attempt: the form clears file inputs after each submit.
  const [picked, setPicked] = useState<{ name: string; attempt: TransferClaimState } | null>(null);
  const errors = state && !state.ok ? state.errors ?? {} : {};
  // After an error, keep what the customer typed (the form resets to these defaults).
  const v = state && !state.ok ? state.values ?? {} : {};
  const fileName = picked && picked.attempt === state ? picked.name : null;
  const fileLost = Boolean(picked && picked.attempt !== state && state && !state.ok);
  const done = state?.ok ? state : null;

  // After a successful submission, open WhatsApp with the payment details filled in.
  useEffect(() => {
    if (!done?.whatsappUrl) return;
    const timer = setTimeout(() => window.location.assign(done.whatsappUrl!), 2200);
    return () => clearTimeout(timer);
  }, [done]);

  if (done) {
    return (
      <div className="text-center" role="status" data-testid="transfer-success">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-rose to-rose-deep text-white shadow-[0_14px_30px_-12px_rgba(184,53,122,0.9)]">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="mt-6 font-display text-3xl sm:text-4xl">{done.message}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-plum-soft">
          We&apos;re checking our bank account now. Look out for a WhatsApp message from us in about 2–5 minutes confirming your order. We&apos;ve also sent a copy to your email.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          {done.whatsappUrl && (
            <>
              <a href={done.whatsappUrl} className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-rose to-rose-deep px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_-12px_rgba(184,53,122,0.9)] transition hover:-translate-y-0.5 sm:w-auto" data-testid="open-whatsapp">
                <WhatsAppIcon className="size-5" /> Send details on WhatsApp
              </a>
              <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Opening WhatsApp…</p>
            </>
          )}
          <Link href={done.orderUrl} className="text-sm font-semibold text-rose-deep underline underline-offset-4 hover:text-rose">View your order</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="order_number" value={orderNumber} />
      <input type="hidden" name="token" value={token} />

      <Field id="customer_name" label="Full name" hint="The name on the bank account you paid from." error={errors.customer_name} required>
        <input id="customer_name" name="customer_name" defaultValue={v.customer_name ?? defaultName} autoComplete="name" required maxLength={120} className={field} aria-invalid={Boolean(errors.customer_name)} aria-describedby={errors.customer_name ? "customer_name-error" : "customer_name-hint"} />
      </Field>

      <Field id="amount_paid" label="Amount paid" hint={`Your order total is ${amountLabel}.`} error={errors.amount_paid} required>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-semibold text-muted" aria-hidden>₦</span>
          <input id="amount_paid" name="amount_paid" defaultValue={v.amount_paid ?? defaultAmount} inputMode="decimal" required className={cn(field, "pl-9 tabular-nums")} aria-invalid={Boolean(errors.amount_paid)} aria-describedby={errors.amount_paid ? "amount_paid-error" : "amount_paid-hint"} />
        </div>
      </Field>

      <Field id="transfer_reference" label="Transaction reference / Session ID" hint="You'll find it on the transfer receipt in your bank app." error={errors.transfer_reference} required>
        <input id="transfer_reference" name="transfer_reference" defaultValue={v.transfer_reference ?? ""} placeholder="e.g. FT123456789" required maxLength={64} autoComplete="off" className={cn(field, "font-mono uppercase tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal")} aria-invalid={Boolean(errors.transfer_reference)} aria-describedby={errors.transfer_reference ? "transfer_reference-error" : "transfer_reference-hint"} />
      </Field>

      <Field id="whatsapp" label="WhatsApp number" hint="We'll confirm your payment here." error={errors.whatsapp} required>
        <input id="whatsapp" name="whatsapp" type="tel" defaultValue={v.whatsapp ?? defaultWhatsApp} inputMode="tel" autoComplete="tel" required maxLength={32} placeholder="0803 123 4567" className={field} aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"} />
      </Field>

      <Field id="proof" label="Screenshot of your receipt" hint="JPG, PNG or PDF, up to 5 MB. It helps us confirm faster." error={errors.proof}>
        <label htmlFor="proof" className={cn("flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 text-sm transition hover:border-rose hover:bg-blush/60", errors.proof ? "border-danger" : "border-rose/35 bg-blush/30")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-rose-deep shadow-sm ring-1 ring-rose/20"><ImageUp className="size-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-plum">{fileName ?? "Choose a file"}</span>
            <span className="block text-xs text-muted">{fileName ? "Tap to change" : "Tap to upload from your phone"}</span>
          </span>
        </label>
        <input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => {
            const name = e.currentTarget.files?.[0]?.name;
            setPicked(name ? { name, attempt: state } : null);
          }} />
        {fileLost && !errors.proof && <p className="mt-1.5 text-xs text-muted">Please choose your screenshot again.</p>}
      </Field>

      <div>
        <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition", errors.confirmed ? "border-danger bg-danger/5" : "border-rose/25 bg-blush/40 hover:border-rose")}>
          <input type="checkbox" name="confirmed" required defaultChecked={v.confirmed === "on"} className="mt-0.5 size-5 shrink-0 accent-[#d94f91]" aria-invalid={Boolean(errors.confirmed)} aria-describedby={errors.confirmed ? "confirmed-error" : undefined} />
          <span className="font-semibold text-plum">I have completed the transfer</span>
        </label>
        {errors.confirmed && <p id="confirmed-error" className="mt-1.5 text-xs font-medium text-danger" role="alert">{errors.confirmed}</p>}
      </div>

      {state && !state.ok && <p className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose to-rose-deep px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_-14px_rgba(184,53,122,0.95)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-14px_rgba(184,53,122,1)] disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
        {pending ? "Sending your details…" : "I Have Paid — Submit Order"}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted">Only tap this after you&apos;ve completed the transfer. We confirm every payment personally, usually within 2–5 minutes during business hours.</p>
    </form>
  );
}
