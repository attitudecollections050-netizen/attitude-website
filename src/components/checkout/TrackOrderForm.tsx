"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { AnimatePresence, m } from "motion/react";
import { trackOrder, type TrackState } from "@/app/actions/orders";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useLocale, useTranslations } from "next-intl";
import { useShippingText } from "@/components/intl/useShippingText";
import { regionName } from "@/components/intl/PreferencesDialog";
import { OrderHistory, OrderProgress, TrackingList } from "./OrderTimeline";

export function TrackOrderForm({ initialOrder }: { initialOrder: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, null);
  const t = useTranslations("track");
  const to = useTranslations("order");
  const locale = useLocale();
  const ship = useShippingText();
  return (
    <div>
      <form action={action} onSubmit={keepValues(action)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm">
          {t("orderNumber")}
          <input name="order_number" defaultValue={initialOrder} required placeholder="AC100123" className="field mt-1.5 uppercase" autoComplete="off" />
        </label>
        <label className="text-sm">
          {t("email")}
          <input name="email" type="email" required autoComplete="email" className="field mt-1.5" />
        </label>
        <Button type="submit" loading={pending} disabled={pending} className="h-[3.05rem]">
          {t("submit")}
        </Button>
      </form>
      <div className="mt-10" aria-live="polite">
        <AnimatePresence mode="wait">
          {state && !state.ok && (
            <m.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Notice tone="error">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</Notice>
            </m.div>
          )}
          {state?.ok && (
            <m.div key={state.order.order_number} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div>
                <p className="eyebrow text-rose-deep">{to("number", { number: state.order.order_number })}</p>
                <p className="mt-1 text-sm text-muted">
                  {t("placed", {
                    date: new Date(state.order.created_at).toLocaleDateString(locale, { dateStyle: "long", timeZone: "Africa/Lagos" }),
                    place: `${state.order.destination.city}${state.order.destination.region ? `, ${state.order.destination.region}` : ""} (${regionName(state.order.destination.country_code, locale)})`,
                  })}
                </p>
              </div>
              <OrderProgress status={state.order.status} />
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-4">
                  <h2 className="font-display text-2xl">{t("delivery")}</h2>
                  <p className="text-sm">
                    {ship.method(state.order.shipping_method_name)}
                    {ship.window(state.order.shipping_min_days, state.order.shipping_max_days) && (
                      <span className="block text-xs text-muted">{to("estimatedAfterDispatch", { window: ship.window(state.order.shipping_min_days, state.order.shipping_max_days)! })}</span>
                    )}
                  </p>
                  {state.order.tracking.length > 0 ? <TrackingList tracking={state.order.tracking} /> : <p className="text-sm text-muted">{t("noTracking")}</p>}
                  <h2 className="pt-4 font-display text-2xl">{to("items")}</h2>
                  <ul className="text-sm text-plum-soft">
                    {state.order.items.map((i, k) => (
                      <li key={k}>
                        {i.quantity} × {i.name}
                        {i.variant ? ` (${i.variant})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="font-display text-2xl">{to("updates")}</h2>
                  <div className="mt-4">
                    <OrderHistory history={state.order.history} />
                  </div>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
