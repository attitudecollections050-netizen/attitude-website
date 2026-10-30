// FAF Drip Guy and FAF Drip Queen — the store's two chat characters (shared by the
// widget and the server). Each reply starts with one action tag, e.g. "[[dab]]", that
// the widget plays as an animation; the tag is stripped before the text is shown.

export type CharacterId = "guy" | "queen";

export const CHARACTERS: Record<CharacterId, { name: string; short: string; fan: string }> = {
  guy: { name: "FAF Drip Guy", short: "Drip Guy", fan: "drip lord" },
  queen: { name: "FAF Drip Queen", short: "Drip Queen", fan: "baddie" },
};

export const ACTIONS = [
  "idle",
  "wave",
  "dab",
  "spin",
  "fire",
  "dance",
  "measure",
  "try_on",
  "boxing",
  "roast",
  "celebrate",
  "strut",
  "pose",
  "cross_arms",
  "beg",
  "blow_kiss",
  "hair_flip",
  "faint",
  "whisper",
  "think",
] as const;
export type DripAction = (typeof ACTIONS)[number];

/** Short caption the character says while doing an action (when there's no chat text for it). */
export function actionLine(action: DripAction, c: CharacterId): string {
  const q = c === "queen";
  switch (action) {
    case "dab":
      return q ? "Mwah! 💋 Added to cart — your wardrobe said thank you." : "Dab! 💥 Added to cart — the drip is loading.";
    case "blow_kiss":
      return "Mwah! 💋 Good choice, sis.";
    case "spin":
      return q ? "Front, side, yansh — check am! 🔄" : "Let me spin am make you see the back 🔄";
    case "fire":
      return q ? "Sis, this one na IG baddie fit, no be for house! 🔥" : "Omo this drip too hard! 🔥";
    case "faint":
      return "I'm dead, this drip kill me 😵";
    case "dance":
      return q ? "Amapiano for your order! 💃" : "Shaku shaku for your order! 🕺";
    case "measure":
      return q ? "Abeg breathe in, make I measure waist 📏" : "Hold am, make I measure your waist small 📏";
    case "try_on":
      return q ? "*snap* ✨ Is this my size? Let me check… 💃" : "*snap* ✨ Magic try-on — e don enter body!";
    case "boxing":
      return "In this corner… 🥊 and in THIS corner… 🥊";
    case "roast":
      return q ? "Girl, if you wear this with slippers, we go fight 😤" : "Baba, that combo no fit work abeg, try this one 😤";
    case "celebrate":
      return q ? "Drip Queen approved! 🎉" : "Drip approved! 🎆";
    case "wave":
      return q ? "Bye baddie, see you when your package land 🛍️" : "Catch you later, drip lord ✌️";
    case "strut":
      return q ? "New drop just landed — watch the walk 💅" : "New drop alert — walk with me 😎";
    case "pose":
      return q ? "Me sef I dey find what to wear 📱" : "Just chilling with the drip 🛹";
    case "cross_arms":
      return q ? "Hmm… you sure say you no want the black one too? 🤨" : "Hmm, you sure say you no want the matching shirt? 🤨";
    case "beg":
      return q ? "Buy 2 na, make I follow you go party 🥺" : "Cop the pair na, make the fit complete 🥺";
    case "hair_flip":
      return "Hair flip for the back design 💁‍♀️";
    case "whisper":
      return "Psst… come closer 🤫";
    case "think":
      return "Hmm, let me check… 🤔";
    default:
      return q ? "Heyy baddie! 💗" : "Wetin dey sup, drip lord? 😎";
  }
}

/** Splits a leading "[[action]]" tag from the reply text (unknown tags are dropped). */
export function parseAction(text: string): { action: DripAction | null; text: string } {
  const m = text.match(/^\s*\[\[\s*([a-z_]+)\s*\]\]\s*/i);
  if (!m) return { action: null, text: text.replace(/\[\[[a-z_ ]+\]\]/gi, "").trim() };
  const name = m[1].toLowerCase() as DripAction;
  return { action: (ACTIONS as readonly string[]).includes(name) ? name : null, text: text.slice(m[0].length).replace(/\[\[[a-z_ ]+\]\]/gi, "").trim() };
}

// ---------- the virtual model's look (changeable by the shopper) ----------

export const SKIN_TONES = ["#F3C9A8", "#D9A178", "#B47A50", "#8D5A3B", "#5E3A24"] as const;
export type Build = "slim" | "regular" | "thick";
export type Height = "short" | "average" | "tall";
export interface ModelLook {
  skin: string;
  build: Build;
  height: Height;
}
export const DEFAULT_LOOK: Record<CharacterId, ModelLook> = {
  guy: { skin: "#8D5A3B", build: "regular", height: "average" },
  queen: { skin: "#B47A50", build: "regular", height: "average" },
};
