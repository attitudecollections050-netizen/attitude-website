import { afterEach, describe, expect, it } from "vitest";
import { FUN_QUESTIONS, JOKES, basicReply, linkify, speakable } from "@/lib/assistant/shared";
import { PERSONA } from "@/lib/assistant/persona";

describe("Dj Attitude Mini — basic mode", () => {
  it("tells jokes and asks fun questions", () => {
    expect(JOKES.some((j) => basicReply("tell me a joke", 3).startsWith(j))).toBe(true);
    expect(FUN_QUESTIONS).toContain(basicReply("ask me a question", 1));
  });

  it("points to the right pages without inventing facts", () => {
    expect(basicReply("where is my order?")).toContain("(/track-order)");
    expect(basicReply("how much is delivery to Abuja")).toMatch(/calculated for your exact address at checkout/);
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
    expect(PERSONA).toMatch(/Never invent facts/);
    expect(PERSONA).toMatch(/Never ask for or accept card numbers/);
    expect(PERSONA).toMatch(/cannot see orders/);
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
