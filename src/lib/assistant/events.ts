// Store events the chat characters react to (dab on add to cart, celebrate on a paid order…).
export type DripEvent = { type: "add_to_cart" } | { type: "order_confirmed" };

export function emitDrip(event: DripEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DripEvent>("drip", { detail: event }));
}

export function onDrip(handler: (event: DripEvent) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<DripEvent>).detail);
  window.addEventListener("drip", fn);
  return () => window.removeEventListener("drip", fn);
}
