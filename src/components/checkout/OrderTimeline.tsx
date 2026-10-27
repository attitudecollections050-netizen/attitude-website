import { Check } from "lucide-react";
import { CUSTOMER_PROGRESS, CUSTOMER_STATUS_LABELS, progressIndex, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/cn";

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "refunded" || status === "pending_payment") {
    return (
      <p className={cn("inline-flex px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]", status === "pending_payment" ? "bg-[#fff8e8] text-warning" : "bg-neutral text-plum")}>
        {CUSTOMER_STATUS_LABELS[status]}
      </p>
    );
  }
  const idx = progressIndex(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={`Order status: ${CUSTOMER_STATUS_LABELS[status]}`}>
      {CUSTOMER_PROGRESS.map((s, i) => (
        <li key={s} className="flex flex-col gap-2">
          <span className={cn("h-1 rounded-full", i <= idx ? "bg-rose" : "bg-line")} />
          <span className={cn("flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-[0.12em]", i <= idx ? "text-plum" : "text-muted")}>
            {i <= idx && <Check className="size-3 text-rose" aria-hidden />}
            {CUSTOMER_STATUS_LABELS[s]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OrderHistory({ history }: { history: { status: OrderStatus; note: string | null; created_at: string }[] }) {
  if (history.length === 0) return null;
  return (
    <ol className="space-y-4 border-l border-line pl-5">
      {[...history].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-rose" aria-hidden />
          <p className="text-sm font-semibold">{CUSTOMER_STATUS_LABELS[h.status]}</p>
          {h.note && <p className="text-sm text-plum-soft">{h.note}</p>}
          <p className="text-xs text-muted">{new Date(h.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
        </li>
      ))}
    </ol>
  );
}

export function TrackingList({ tracking }: { tracking: { carrier: string | null; tracking_number: string | null; tracking_url: string | null; dispatched_at: string | null }[] }) {
  if (tracking.length === 0) return null;
  return (
    <ul className="space-y-3">
      {tracking.map((t, i) => (
        <li key={i} className="bg-neutral px-4 py-3 text-sm">
          <p className="font-semibold">{t.carrier ?? "Courier"}</p>
          {t.tracking_number && <p>Tracking number: <span className="font-mono">{t.tracking_number}</span></p>}
          {t.dispatched_at && <p className="text-xs text-muted">Dispatched {new Date(t.dispatched_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>}
          {t.tracking_url && (
            <a href={t.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-rose-deep underline underline-offset-4">
              Track with courier
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
