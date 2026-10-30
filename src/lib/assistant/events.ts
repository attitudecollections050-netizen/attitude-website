import type { Audience } from "@/lib/catalog/free-size";

// Store events the mascots react to (a kiss on add to cart, a party on a paid order,
// switching to Haru or Jin for women's / men's products, the free-size announcement…).
export type DripEvent =
  | { type: "add_to_cart" }
  | { type: "order_confirmed" }
  | { type: "context"; audience: Audience; freeSize?: boolean; product?: string }
  | { type: "open_chat"; character: "haru" | "jin" };

export function emitDrip(event: DripEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DripEvent>("drip", { detail: event }));
}

export function onDrip(handler: (event: DripEvent) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<DripEvent>).detail);
  window.addEventListener("drip", fn);
  return () => window.removeEventListener("drip", fn);
}
