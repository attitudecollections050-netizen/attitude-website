"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, track } from "@/lib/analytics/client";
import type { ClientEvent } from "@/lib/analytics/shared";
import { useCart } from "@/components/cart/CartProvider";

/** Records a page view on every storefront navigation (consented visitors only). */
export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view");
  }, [pathname]);
  useEffect(() => {
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === "granted") track("page_view");
    };
    window.addEventListener(CONSENT_CHANGED, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED, onConsent);
  }, []);
  return null;
}

/** Sends one event when mounted (product views, checkout starts). */
export function TrackEvent({ type, productId }: { type: ClientEvent; productId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(type, productId ? { productId } : {});
  }, [type, productId]);
  return null;
}

/** "Checkout started" = the checkout page was opened with at least one item in the bag. */
export function TrackCheckoutStart() {
  const { cart } = useCart();
  const hasItems = cart.itemCount > 0;
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !hasItems) return;
    sent.current = true;
    track("checkout_start");
  }, [hasItems]);
  return null;
}
