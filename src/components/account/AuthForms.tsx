"use client";
import { keepValues } from "@/components/ui/keepForm";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signIn, signUp, requestPasswordReset, updatePassword, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

function PasswordInput({ name, autoComplete, label = "Password", error }: { name: string; autoComplete: string; label?: string; error?: string }) {
  const [show, setShow] = useState(false);
  const id = `pw-${name}`;
  return (
    <div className="text-sm">
      <label htmlFor={id}>{label}</label>
      <span className="relative mt-1.5 block">
        <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required className="field pr-11" aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-err` : undefined} />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-plum" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
      {error && <span id={`${id}-err`} className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

function TextField({ name, label, type = "text", autoComplete, error }: { name: string; label: string; type?: string; autoComplete?: string; error?: string }) {
  const id = `f-${name}`;
  return (
    <div className="text-sm">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} autoComplete={autoComplete} required className="field mt-1.5" aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-err` : undefined} />
      {error && <span id={`${id}-err`} className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

function Message({ state }: { state: AuthState }) {
  if (!state?.message) return null;
  return <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-5" noValidate>
      <Message state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={state?.errors?.email} />
      <PasswordInput name="password" autoComplete="current-password" error={state?.errors?.password} />
      <div className="text-right">
        <Link href="/account/forgot-password" className="text-xs underline underline-offset-4 hover:text-rose-deep">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>Sign in</Button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-5" noValidate>
      <Message state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField name="full_name" label="Full name" autoComplete="name" error={state?.errors?.full_name} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={state?.errors?.email} />
      <PasswordInput name="password" autoComplete="new-password" error={state?.errors?.password} />
      <p className="text-xs text-muted">At least 8 characters, including a letter and a number.</p>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>Create account</Button>
      <p className="text-xs text-muted">
        By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-5" noValidate>
      <Message state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" />
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, null);
  if (state?.ok)
    return (
      <div className="space-y-5">
        <Message state={state} />
        <Link href="/account" className="underline underline-offset-4">Go to my account</Link>
      </div>
    );
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-5" noValidate>
      <Message state={state} />
      <PasswordInput name="password" autoComplete="new-password" label="New password" />
      <PasswordInput name="confirm" autoComplete="new-password" label="Confirm new password" />
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>Update password</Button>
    </form>
  );
}
