"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState, useEffect, useRef } from "react";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import type { AdminResult } from "@/app/admin/actions/types";

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  resetOnSuccess = false,
  confirm,
  variant = "primary",
  inline = false,
  id,
}: {
  action: (prev: AdminResult, formData: FormData) => Promise<AdminResult>;
  children?: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  variant?: "primary" | "outline" | "rose" | "ghost";
  inline?: boolean;
  /** Lets inputs elsewhere (e.g. other table cells) join this form via their `form` attribute. */
  id?: string;
}) {
  const [state, formAction, pending] = useActionState<AdminResult, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      id={id}
      action={formAction}
      className={className}
      onSubmit={keepValues(formAction, () => !confirm || window.confirm(confirm))}
    >
      {children}
      <div className={inline ? "inline-flex items-center gap-3" : "mt-5 flex flex-wrap items-center gap-3"}>
        <Button type="submit" size="sm" variant={variant} loading={pending} disabled={pending}>
          {submitLabel}
        </Button>
        {state && !inline && (
          <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`} role={state.ok ? "status" : "alert"}>
            {state.message}
          </span>
        )}
      </div>
      {state && inline && !state.ok && <Notice tone="error" className="mt-2">{state.message}</Notice>}
    </form>
  );
}
