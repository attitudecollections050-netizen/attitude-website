"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { setPassword, type SetPasswordState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function SetPasswordForm({ submitLabel }: { submitLabel: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPassword, null);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-4">
      {state && <Notice tone="error">{state.message}</Notice>}
      <label className="block text-sm font-semibold">
        New password
        <span className="relative mt-1.5 block">
          <input name="password" type={show ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" className="field pr-12" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-3 grid place-items-center text-muted hover:text-rose-deep" aria-label={show ? "Hide passwords" : "Show passwords"}>
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </span>
      </label>
      <label className="block text-sm font-semibold">
        Confirm password
        <input name="confirm" type={show ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" className="field mt-1.5" />
      </label>
      <p className="text-xs text-muted">At least 8 characters, including a letter and a number.</p>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>
        <Lock className="size-3.5" aria-hidden /> {submitLabel}
      </Button>
    </form>
  );
}
