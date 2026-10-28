"use client";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CUSTOMER_PROGRESS, progressIndex, type OrderStatus } from "@/lib/orders/status";

/** Customer-facing status wording (internal supplier steps read as "Processing"). */
function useStatusLabel() {
  const t = useTranslations("orderStatus");
  return (s: OrderStatus) => t(s === "awaiting_supplier" || s === "ordered_from_supplier" ? "processing" : s);
}
import { cn } from "@/lib/cn";

export function OrderProgress({ status }: { status: OrderStatus }) {
  const label = useStatusLabel();
  const t = useTranslations("order");
  if (status === "cancelled" || status === "refunded" || status === "pending_payment") {
    return (
      <p className={cn("inline-flex px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]", status === "pending_payment" ? "bg-[#fff8e8] text-warning" : "bg-neutral text-plum")}>
        {label(status)}
      </p>
    );
  }
  const idx = progressIndex(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t("statusAria", { status: label(status) })}>
      {CUSTOMER_PROGRESS.map((s, i) => (
        <li key={s} className="flex flex-col gap-2">
          <span className={cn("h-1 rounded-full", i <= idx ? "bg-rose" : "bg-line")} />
          <span className={cn("flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-[0.12em]", i <= idx ? "text-plum" : "text-muted")}>
            {i <= idx && <Check className="size-3 text-rose" aria-hidden />}
            {label(s)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OrderHistory({ history }: { history: { status: OrderStatus; note: string | null; created_at: string }[] }) {
  const label = useStatusLabel();
  const locale = useLocale();
  if (history.length === 0) return null;
  return (
    <ol className="space-y-4 border-l border-line pl-5">
      {[...history].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-rose" aria-hidden />
          <p className="text-sm font-semibold">{label(h.status)}</p>
          {h.note && <p className="text-sm text-plum-soft">{h.note}</p>}
          <p className="text-xs text-muted">{new Date(h.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</p>
        </li>
      ))}
    </ol>
  );
}

export function TrackingList({ tracking }: { tracking: { carrier: string | null; tracking_number: string | null; tracking_url: string | null; dispatched_at: string | null }[] }) {
  const t = useTranslations("order");
  const locale = useLocale();
  if (tracking.length === 0) return null;
  return (
    <ul className="space-y-3">
      {tracking.map((x, i) => (
        <li key={i} className="bg-neutral px-4 py-3 text-sm">
          <p className="font-semibold">{x.carrier ?? t("courier")}</p>
          {x.tracking_number && <p>{t("trackingNumber")} <span className="font-mono">{x.tracking_number}</span></p>}
          {x.dispatched_at && <p className="text-xs text-muted">{t("dispatched", { date: new Date(x.dispatched_at).toLocaleDateString(locale, { dateStyle: "medium", timeZone: "Africa/Lagos" }) })}</p>}
          {x.tracking_url && (
            <a href={x.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-rose-deep underline underline-offset-4">
              {t("trackWithCourier")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
