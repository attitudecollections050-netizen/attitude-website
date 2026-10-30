import { afterEach, describe, expect, it } from "vitest";
import { FUN_QUESTIONS, JOKES, basicReply, linkify, speakable } from "@/lib/assistant/shared";
import { persona } from "@/lib/assistant/persona";
import { parseAction } from "@/lib/assistant/characters";

describe("Haru — basic mode", () => {
  it("tells jokes and asks fun questions", () => {
    expect(JOKES.some((j) => basicReply("tell me a joke", 3).startsWith(j))).toBe(true);
    expect(FUN_QUESTIONS).toContain(basicReply("ask me a question", 1));
  });

  it("points to the right pages without inventing facts", () => {
    expect(basicReply("where is my order?")).toContain("(/track-order)");
    expect(basicReply("how much is delivery to Abuja")).toMatch(/Outside Lagos: 2–3 days/);
    expect(basicReply("how much is delivery to Abuja")).not.toMatch(/₦\d/);
    expect(basicReply("can I return this")).toContain("(/returns-policy)");
    expect(basicReply("I want to talk to a human")).toContain("(/contact)");
    expect(basicReply("I'm looking for a pink dress")).toContain("/search?q=pink%20dress");
    expect(basicReply("asdfgh")).toMatch(/didn't quite catch/);
  });
});

describe("message formatting", () => {
  it("turns markdown and bare site paths into internal links only", () => {
    const parts = linkify("See [Track your order](/track-order) or visit /shop. Ignore [bad](https://evil.example).");
    expect(parts.filter((p) => p.type === "link")).toEqual([
      { type: "link", label: "Track your order", href: "/track-order" },
      { type: "link", label: "/shop", href: "/shop" },
    ]);
    expect(parts.map((p) => (p.type === "text" ? p.value : p.label)).join("")).toContain("[bad](https://evil.example)");
  });

  it("produces clean text to read aloud", () => {
    expect(speakable("Hi 💗 see [Track your order](/track-order) or https://x.com — **yay** 🎧")).toBe("Hi see Track your order or — yay");
  });
});

describe("persona guard rails", () => {
  it("forbids invented facts and payment secrets", () => {
    for (const c of ["haru", "jin"] as const) {
      const PERSONA = persona(c);
      expect(PERSONA).toMatch(/Never invent facts/);
      expect(PERSONA).toMatch(/Never ask for or accept card numbers/);
      expect(PERSONA).toMatch(/cannot see orders/);
      expect(PERSONA).toMatch(/never invent scarcity/);
      expect(PERSONA).toMatch(/never Pidgin/);
      expect(PERSONA).toMatch(/FREE SIZE/);
    }
  });
});

describe("assistant endpoint", () => {
  const key = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  });
  it("reports offline (basic mode) when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("@/app/api/assistant/route");
    const res = await POST(new Request("http://x/api/assistant", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) }) as never);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ offline: true });
  });
});

describe("voice", () => {
  const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
  it("picks a natural English voice: female for Haru, male for Jin, US accent first", async () => {
    const { pickVoice, englishVoices, VOICES } = await import("@/components/assistant/voice");
    const voices = [v("Google Deutsch", "de-DE"), v("Microsoft David", "en-US"), v("Microsoft Zira", "en-US"), v("Microsoft Jenny Online (Natural)", "en-US"), v("Amélie", "fr-CA")];
    expect(pickVoice(voices)?.name).toBe("Microsoft Jenny Online (Natural)");
    expect(pickVoice([v("Daniel", "en-GB"), v("Samantha", "en-US"), v("Thomas", "fr-FR")])?.name).toBe("Samantha");
    expect(pickVoice([v("Anna", "de-DE"), v("Google US English", "en-US")])?.name).toBe("Google US English");
    expect(pickVoice([v("English Nigeria", "en-NG"), v("English United States", "en-US")])?.name).toBe("English United States");
    expect(pickVoice([v("Thomas", "fr-FR")])).toBeNull();
    expect(englishVoices([v("Google UK English Male", "en-GB"), v("Kate", "en-GB")]).map((x) => x.name)).toEqual(["Kate"]);
    // a voice the shopper picked wins
    expect(pickVoice(voices, "Microsoft Zira")?.name).toBe("Microsoft Zira");
    expect(VOICES.haru).toMatchObject({ pitch: 1.3, rate: 0.95, gender: "female" });
    expect(VOICES.jin).toMatchObject({ pitch: 0.9, rate: 0.95, gender: "male" });
    // Jin gets a male US voice when there is one
    expect(pickVoice(voices, null, "male")?.name).toBe("Microsoft David");
  });

  it("allows the microphone for this site in the security headers", async () => {
    const config = (await import("../../next.config")).default;
    const rules = await config.headers!();
    const policy = rules.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")!.value;
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
  });
});

describe("mascots — action tags", () => {
  it("splits a known action tag from the reply", () => {
    expect(parseAction("[[fire]] Omo this drip too hard!")).toEqual({ action: "fire", text: "Omo this drip too hard!" });
  });
  it("drops unknown or stray tags", () => {
    expect(parseAction("[[explode]] Hello")).toEqual({ action: null, text: "Hello" });
    expect(parseAction("Hi [[dab]] there")).toEqual({ action: null, text: "Hi  there" });
    expect(parseAction("No tag here")).toEqual({ action: null, text: "No tag here" });
  });
});
