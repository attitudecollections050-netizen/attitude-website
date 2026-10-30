"use client";
import { AssistantWidget } from "./AssistantWidget";

/**
 * <AttitudeAI /> — the store's mascot assistants, DJ ATTITUDE mini HARU (main, baby pink)
 * and DJ ATTITUDE mini JIN (hot pink): floating button, chat, voices and page reactions.
 * Mounted once in the store layout, so it's on every shop page (it hides itself on
 * checkout, order and admin pages so payments stay distraction-free).
 */
export function AttitudeAI({ whatsapp }: { whatsapp: string | null }) {
  return <AssistantWidget whatsapp={whatsapp} />;
}
