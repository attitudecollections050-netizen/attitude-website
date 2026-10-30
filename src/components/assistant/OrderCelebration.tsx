"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_LOOK, actionLine, asCharacter, type CharacterId, type DripAction, type ModelLook } from "@/lib/assistant/characters";
import { DripStage } from "./DripStage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const noop = () => () => {};

/** The shopper's chat character reacts on the order page: fireworks → shaku shaku → wave when paid. */
export function OrderCelebration({ paid, verifying }: { paid: boolean; verifying: boolean }) {
  const character = useSyncExternalStore(noop, () => asCharacter(read<string>("ac_drip_character", "haru")), () => "haru" as CharacterId);
  const looks = useSyncExternalStore(noop, () => sessionStorage.getItem("ac_drip_look") ?? "", () => "");
  const look: ModelLook = (looks ? (JSON.parse(looks) as Partial<Record<CharacterId, ModelLook>>)[character] : undefined) ?? DEFAULT_LOOK[character];
  const steps: DripAction[] = paid ? ["celebrate", "dance", "wave"] : verifying ? ["think"] : ["beg"];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= steps.length - 1) return;
    const t = setTimeout(() => setI((n) => n + 1), 3800);
    return () => clearTimeout(t);
  }, [i, steps.length]);
  const action = steps[Math.min(i, steps.length - 1)];
  const caption = paid ? null : verifying ? "Checking your transfer… once it lands, we party! 🎉" : "Finish your payment, cutie, and we can celebrate! 🥺";
  return (
    <div className="mx-auto mt-6 max-w-sm overflow-hidden rounded-3xl border-2 border-white shadow-[0_18px_40px_-12px_rgba(255,20,147,0.6)]" data-testid="order-celebration">
      <DripStage character={character} look={look} action={action} playKey={i} caption={caption ?? actionLine(action, character)} className="h-40" />
    </div>
  );
}
