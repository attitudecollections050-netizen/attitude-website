"use client";
import { emitDrip } from "@/lib/assistant/events";

/** "Chat with Haru / Jin" on the /mascots page: opens the chat with that mascot. */
export function MeetButtons() {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => emitDrip({ type: "open_chat", character: "haru" })} className="rounded-full border-2 border-white bg-[#FFB6D9] px-6 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-plum shadow-lg transition hover:brightness-105" data-testid="meet-haru">
        Chat with Haru 💖
      </button>
      <button type="button" onClick={() => emitDrip({ type: "open_chat", character: "jin" })} className="rounded-full border-2 border-white bg-[#E94E8A] px-6 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-white shadow-lg transition hover:brightness-105" data-testid="meet-jin">
        Chat with Jin 🔥
      </button>
    </div>
  );
}
