"use client";
import { useActionState } from "react";
import { acceptInvite } from "@/app/admin/actions/staff";
import type { AdminResult } from "@/app/admin/actions/types";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function AcceptInviteForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(acceptInvite, null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <label className="block text-sm">
        Your name
        <input name="full_name" defaultValue={defaultName} maxLength={120} autoComplete="name" className="field mt-1.5" />
      </label>
      <label className="block text-sm">
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field mt-1.5" />
      </label>
      <label className="block text-sm">
        Confirm password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field mt-1.5" />
      </label>
      <p className="text-xs text-muted">At least 8 characters, including a letter and a number.</p>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>
        Set password &amp; open dashboard
      </Button>
    </form>
  );
}
