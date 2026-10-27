"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState } from "react";
import { AnimatePresence, m } from "motion/react";
import { trackOrder, type TrackState } from "@/app/actions/orders";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatDeliveryWindow } from "@/lib/shipping/calculator";
import { OrderHistory, OrderProgress, TrackingList } from "./OrderTimeline";

export function TrackOrderForm({ initialOrder }: { initialOrder: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, null);
  return (
    <div>
      <form action={action} onSubmit={keepValues(action)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm">
          Order number
          <input name="order_number" defaultValue={initialOrder} required placeholder="AC100123" className="field mt-1.5 uppercase" autoComplete="off" />
        </label>
        <label className="text-sm">
          Email address
          <input name="email" type="email" required autoComplete="email" className="field mt-1.5" />
        </label>
        <Button type="submit" loading={pending} disabled={pending} className="h-[3.05rem]">
          Track
        </Button>
      </form>
      <div className="mt-10" aria-live="polite">
        <AnimatePresence mode="wait">
          {state && !state.ok && (
            <m.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Notice tone="error">{state.error}</Notice>
            </m.div>
          )}
          {state?.ok && (
            <m.div key={state.order.order_number} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div>
                <p className="eyebrow text-rose-deep">Order {state.order.order_number}</p>
                <p className="mt-1 text-sm text-muted">
                  Placed {new Date(state.order.created_at).toLocaleDateString("en-NG", { dateStyle: "long" })} · Delivering to {state.order.destination.city}
                  {state.order.destination.region ? `, ${state.order.destination.region}` : ""} ({state.order.destination.country_code})
                </p>
              </div>
              <OrderProgress status={state.order.status} />
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-4">
                  <h2 className="font-display text-2xl">Delivery</h2>
                  <p className="text-sm">
                    {state.order.shipping_method_name}
                    {formatDeliveryWindow(state.order.shipping_min_days, state.order.shipping_max_days) && (
                      <span className="block text-xs text-muted">Estimated {formatDeliveryWindow(state.order.shipping_min_days, state.order.shipping_max_days)} after dispatch</span>
                    )}
                  </p>
                  {state.order.tracking.length > 0 ? <TrackingList tracking={state.order.tracking} /> : <p className="text-sm text-muted">Tracking details will appear here once your order is dispatched.</p>}
                  <h2 className="pt-4 font-display text-2xl">Items</h2>
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
                  <h2 className="font-display text-2xl">Updates</h2>
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
