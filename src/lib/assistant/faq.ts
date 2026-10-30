// Quick answers confirmed by the store owner. Used by the AI mascots (as store facts)
// and by basic mode when no AI key is set. Edit the wording here.
export const STORE_FAQ = {
  size: "FREE SIZE items fit S to XL (UK 6–14) because they're super stretchy. If an item isn't free size, check the size options and chart on its product page — or tell me your measurements and I'll help!",
  delivery: "We deliver nationwide! Lagos: same day. Outside Lagos: 2–3 days. You'll see the exact delivery fee at checkout.",
  payment:
    "In Lagos you can pay on delivery — message us on WhatsApp to arrange it. Outside Lagos, please pay by bank transfer before delivery. At checkout you can also pay securely online.",
  fallback: "Hmm, let me connect you to WhatsApp so the team can help you right away! 💖",
} as const;

/** Matches the mascots' hand-off line, so the chat can show a WhatsApp button under it. */
export const WHATSAPP_HANDOFF = /connect you (to|with) (us on |the team on )?WhatsApp/i;
