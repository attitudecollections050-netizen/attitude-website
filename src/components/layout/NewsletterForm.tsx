"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter, type FormState } from "@/app/actions/marketing";

export function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeNewsletter, null);
  const dark = tone === "dark";
  const t = useTranslations("newsletter");
  return (
    <form action={action} onSubmit={keepValues(action)} className="w-full max-w-md" noValidate>
      <label htmlFor={`nl-email-${tone}`} className="sr-only">
        {t("email")}
      </label>
      <div className={`flex items-center border-b ${dark ? "border-white/40 focus-within:border-white" : "border-plum/40 focus-within:border-plum"} transition-colors`}>
        <input
          id={`nl-email-${tone}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("placeholder")}
          className={`min-w-0 flex-1 bg-transparent py-3 text-sm outline-none ${dark ? "placeholder:text-white/50" : "placeholder:text-muted"}`}
        />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <button type="submit" disabled={pending} className="group flex items-center gap-2 py-3 pl-3 text-[0.68rem] font-bold uppercase tracking-[0.2em]">
          {pending ? t("joining") : t("subscribe")}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
      <p className={`mt-2 min-h-5 text-xs ${state?.ok ? (dark ? "text-pale" : "text-success") : dark ? "text-[#ffb3c7]" : "text-danger"}`} role="status">
        {state?.message}
      </p>
    </form>
  );
}
