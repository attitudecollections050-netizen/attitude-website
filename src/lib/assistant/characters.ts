// DJ ATTITUDE mini HARU (the main assistant, baby pink #FFB6D9) and DJ ATTITUDE mini JIN (hot pink #E94E8A),
// two Korean anime-style DJ mascots, shared by the widget and the server. Each reply starts
// with one action tag, e.g. "[[spin]]", that the widget plays; the tag is stripped first.

export type CharacterId = "haru" | "jin";

export const CHARACTERS: Record<CharacterId, { name: string; short: string; tagline: string; intro: string; color: string; art: string; face: string; fan: string }> = {
  haru: { name: "DJ ATTITUDE mini HARU", short: "Haru", tagline: "Your Drip Bestie", intro: "Hi I'm Haru!", color: "#FFB6D9", art: "/mascots/girl.png", face: "/mascots/girl-face.png", fan: "cutie" },
  jin: { name: "DJ ATTITUDE mini JIN", short: "Jin", tagline: "Your Fit Buddy", intro: "Yo, I'm Jin!", color: "#E94E8A", art: "/mascots/boy.png", face: "/mascots/boy-face.png", fan: "fam" },
};

/** Older saved values (from the previous characters) map onto the new ones. */
export const asCharacter = (v: unknown): CharacterId => (v === "jin" || v === "guy" ? "jin" : "haru");

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

/** Short caption the character says while doing an action. Clean, cute English only. */
export function actionLine(action: DripAction, c: CharacterId): string {
  const h = c === "haru";
  switch (action) {
    case "dab":
    case "blow_kiss":
      return h ? "Mwah! 💋 Added to your bag — great choice, cutie!" : "Nice! 💥 Added to your bag. That fit is going to hit.";
    case "spin":
      return h ? "Front, side, back — let me show you! 🔄" : "Let me spin so you can see the back 🔄";
    case "fire":
      return h ? "Daebak! This outfit is so fire! 🔥" : "Whoa, this drip is way too hard! 🔥";
    case "faint":
      return "Aigoo, this outfit is too cute, I can't! 😵";
    case "dance":
      return h ? "Yay! Happy dance for your order! 💃" : "Victory dance for your order! 🕺";
    case "measure":
      return h ? "Okay, take a deep breath — let me measure! 📏" : "Hold still, let me check your size 📏";
    case "try_on":
      return h ? "*snap* ✨ Is this my size? Let me try it on!" : "*snap* ✨ Magic try-on, check it out!";
    case "boxing":
      return "In this corner… 🥊 and in THIS corner… 🥊";
    case "roast":
      return h ? "Hmm, that combo is a little bit much, bestie. Try this one! 😤" : "Bro, that combo won't work. Let's fix it! 😤";
    case "celebrate":
      return h ? "Haru approved! 🎉 You're officially Attitude fam!" : "Jin approved! 🎆 Your drip is locked in!";
    case "wave":
      return h ? "Bye bye, cutie! See you when your package arrives 🛍️" : "Catch you later, fam ✌️";
    case "strut":
      return h ? "New drop just landed — watch me walk 💅" : "New drop alert — walk with me 😎";
    case "pose":
      return h ? "Hmm, what should I wear today? 📱" : "Just chilling in my fit 🛹";
    case "cross_arms":
      return h ? "Are you sure you don't want the black one too? 🤨" : "You sure you don't want the matching top? 🤨";
    case "beg":
      return h ? "Get two, please? Then we can match! 🥺" : "Grab the pair and complete the fit 🥺";
    case "hair_flip":
      return "Hair flip for the back design 💁‍♀️";
    case "whisper":
      return "Psst… come closer 🤫";
    case "think":
      return "Hmm, let me check… 🤔";
    default:
      return h ? "Annyeong, cutie! 💖" : "Yo, what's up, fam? 😎";
  }
}

/** Sweet appreciation lines the mascots drop into the chat now and then. */
export const SWEET_WORDS: Record<CharacterId, string[]> = {
  haru: [
    "We appreciate you so much, bestie! 💖",
    "Thanks for being part of Attitude fam! 🫶",
    "You have amazing taste, period! ✨",
    "We love having you here! 💕",
    "You make our drip special, cutie! 🌸",
    "Saranghae! Thank you for shopping with us 💗",
    "You make our brand shine! 🌟",
  ],
  jin: [
    "Real talk, we appreciate you, fam! 🙌",
    "Thanks for being part of Attitude fam! 🫶",
    "You've got amazing taste, no cap! ✨",
    "We love having you here! 💯",
    "You make our drip special, for real! 🔥",
    "Respect! Thanks for rolling with us 😎",
    "You make our brand shine! 🌟",
  ],
};

export function sweetWord(c: CharacterId, seed = Date.now()): string {
  const list = SWEET_WORDS[c];
  return list[Math.abs(seed) % list.length];
}

/** Splits a leading "[[action]]" tag from the reply text (unknown tags are dropped). */
export function parseAction(text: string): { action: DripAction | null; text: string } {
  const m = text.match(/^\s*\[\[\s*([a-z_]+)\s*\]\]\s*/i);
  if (!m) return { action: null, text: text.replace(/\[\[[a-z_ ]+\]\]/gi, "").trim() };
  const name = m[1].toLowerCase() as DripAction;
  return { action: (ACTIONS as readonly string[]).includes(name) ? name : null, text: text.slice(m[0].length).replace(/\[\[[a-z_ ]+\]\]/gi, "").trim() };
}

// ---------- the virtual model's shape (changeable by the shopper) ----------

export type Build = "slim" | "regular" | "thick";
export type Height = "short" | "average" | "tall";
export interface ModelLook {
  build: Build;
  height: Height;
}
export const DEFAULT_LOOK: Record<CharacterId, ModelLook> = {
  haru: { build: "regular", height: "average" },
  jin: { build: "regular", height: "average" },
};
