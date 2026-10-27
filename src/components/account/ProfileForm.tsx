"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { updateProfile, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function ProfileForm({ profile, email }: { profile: { full_name: string | null; phone: string | null; marketing_opt_in: boolean }; email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfile, null);
  return (
    <form action={action} onSubmit={keepValues(action)} className="max-w-lg space-y-5">
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <label className="block text-sm">
        Email
        <input value={email} disabled className="field mt-1.5 bg-neutral text-muted" />
      </label>
      <label className="block text-sm">
        Full name
        <input name="full_name" defaultValue={profile.full_name ?? ""} required className="field mt-1.5" />
      </label>
      <label className="block text-sm">
        Phone
        <input name="phone" type="tel" defaultValue={profile.phone ?? ""} className="field mt-1.5" />
        {state?.errors?.phone && <span className="mt-1 block text-xs text-danger">{state.errors.phone}</span>}
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} className="size-4 accent-[#d94f91]" />
        Email me about new arrivals and offers
      </label>
      <Button type="submit" loading={pending} disabled={pending}>Save profile</Button>
    </form>
  );
}
