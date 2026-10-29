"use client";
import { useActionState, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { inviteStaff, resendInvite, type InviteResult } from "@/app/admin/actions/staff";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field, inputCls } from "./ui";

function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-[3px] border border-line bg-white p-3">
      <p className="text-xs text-muted">Private invitation link — send it only to this person. It works once and expires.</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={link} className={`${inputCls} flex-1 font-mono !text-xs`} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:border-plum"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function StaffInviteForm() {
  const [state, action, pending] = useActionState<InviteResult, FormData>(inviteStaff, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Email address">
          <input name="email" type="email" required autoComplete="off" className={inputCls} placeholder="friend@example.com" />
        </Field>
        <Field label="Name (optional)">
          <input name="full_name" maxLength={120} className={inputCls} />
        </Field>
        <Field label="Role">
          <select name="role" defaultValue="product_staff" className={inputCls}>
            <option value="product_staff">Product Staff — add & edit products</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="can_delete_products" className="size-4 accent-[#d94f91]" /> Allow deleting products
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending} disabled={pending}>
          <Send className="size-4" aria-hidden /> Send invitation
        </Button>
        {state && <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`} role={state.ok ? "status" : "alert"}>{state.message}</span>}
      </div>
      {state?.ok && state.link && <LinkBox link={state.link} />}
    </form>
  );
}

export function ResendInviteButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<InviteResult, FormData>(resendInvite, null);
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="user_id" value={userId} />
        <button type="submit" disabled={pending} className="text-xs font-semibold underline underline-offset-4 hover:text-rose-deep disabled:opacity-50">
          {pending ? "Sending…" : "Re-send invitation"}
        </button>
      </form>
      {state && !state.ok && <Notice tone="error" className="mt-2">{state.message}</Notice>}
      {state?.ok && !state.link && <p className="mt-1 text-xs text-success" role="status">{state.message}</p>}
      {state?.ok && state.link && <LinkBox link={state.link} />}
    </div>
  );
}
