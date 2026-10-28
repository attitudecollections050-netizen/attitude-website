"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { submitContact, type FormState } from "@/app/actions/marketing";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useTranslations } from "next-intl";

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitContact, null);
  const e = state?.errors ?? {};
  const t = useTranslations("contact");
  if (state?.ok) return <Notice tone="success" title={t("sent")}>{state.message}</Notice>;
  return (
    <form action={action} onSubmit={keepValues(action)} className="grid gap-5 sm:grid-cols-2" noValidate>
      {state && !state.ok && <Notice tone="error" className="sm:col-span-2">{state.message}</Notice>}
      <label className="text-sm">
        {t("name")}
        <input name="name" required autoComplete="name" className="field mt-1.5" aria-invalid={Boolean(e.name) || undefined} aria-describedby={e.name ? "name-err" : undefined} />
      </label>
      {e.name && <span id="name-err" className="-mt-4 block text-xs text-danger">{e.name}</span>}
      <label className="text-sm">
        {t("email")}
        <input name="email" type="email" required autoComplete="email" className="field mt-1.5" aria-invalid={Boolean(e.email) || undefined} aria-describedby={e.email ? "email-err" : undefined} />
      </label>
      {e.email && <span id="email-err" className="-mt-4 block text-xs text-danger">{e.email}</span>}
      <label className="text-sm">
        {t("orderNumber")} <span className="text-muted">{t("optional")}</span>
        <input name="order_number" className="field mt-1.5" maxLength={30} />
      </label>
      <label className="text-sm">
        {t("subject")}
        <input name="subject" required className="field mt-1.5" maxLength={160} aria-invalid={Boolean(e.subject) || undefined} aria-describedby={e.subject ? "subject-err" : undefined} />
      </label>
      {e.subject && <span id="subject-err" className="-mt-4 block text-xs text-danger">{e.subject}</span>}
      <label className="text-sm sm:col-span-2">
        {t("message")}
        <textarea name="message" required rows={6} maxLength={5000} className="field mt-1.5" aria-invalid={Boolean(e.message) || undefined} aria-describedby={e.message ? "message-err" : undefined} />
      </label>
      {e.message && <span id="message-err" className="-mt-4 block text-xs text-danger sm:col-span-2">{e.message}</span>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={pending} disabled={pending}>{t("send")}</Button>
      </div>
    </form>
  );
}
