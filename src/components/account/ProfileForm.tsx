"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { updateProfile, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useTranslations } from "next-intl";

export function ProfileForm({ profile, email }: { profile: { full_name: string | null; phone: string | null; marketing_opt_in: boolean }; email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfile, null);
  const t = useTranslations("account");
  return (
    <form action={action} onSubmit={keepValues(action)} className="max-w-lg space-y-5">
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <label className="block text-sm">
        {t("email")}
        <input value={email} disabled className="field mt-1.5 bg-neutral text-muted" />
      </label>
      <label className="block text-sm">
        {t("fullName")}
        <input name="full_name" defaultValue={profile.full_name ?? ""} required className="field mt-1.5" />
        {state?.errors?.full_name && <span className="mt-1 block text-xs text-danger">{state.errors.full_name}</span>}
      </label>
      <label className="block text-sm">
        {t("phone")}
        <input name="phone" type="tel" defaultValue={profile.phone ?? ""} className="field mt-1.5" />
        {state?.errors?.phone && <span className="mt-1 block text-xs text-danger">{state.errors.phone}</span>}
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} className="size-4 accent-[#d94f91]" />
        {t("marketing")}
      </label>
      <Button type="submit" loading={pending} disabled={pending}>{t("saveProfile")}</Button>
    </form>
  );
}
