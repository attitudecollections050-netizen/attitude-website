import type { Metadata } from "next";
import Link from "next/link";
import { CHARACTERS } from "@/lib/assistant/characters";
import { MeetButtons } from "@/components/assistant/MeetButtons";

export const metadata: Metadata = {
  title: "Meet DJ ATTITUDE mini HARU & JIN",
  description: "Meet DJ ATTITUDE mini HARU & JIN — your Attitude drip assistants. They help you find your size, match your fit and shop with a smile.",
};

const SHADES = [
  { name: "Baby Pink", hex: "#FFB6D9", who: "HARU", text: "Soft, sweet and bright — Haru's shade. It's the light, friendly side of Attitude: you'll see it whenever Haru is helping you." },
  { name: "Hot Pink / Dusty Rose", hex: "#E94E8A", who: "JIN", text: "Bold and cool — Jin's shade. It's the confident street side of Attitude, and the chat turns hot pink when Jin takes over." },
];

export default function MascotsPage() {
  const haru = CHARACTERS.haru;
  const jin = CHARACTERS.jin;
  return (
    <div className="pb-24">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_30%_70%,#FFF0F7_0%,#FFB6D9_45%,#E94E8A_100%)] px-4 pb-10 pt-12 text-center">
        <p className="eyebrow text-[#8E1B54]">Your Attitude Drip Assistants</p>
        <h1 className="display mx-auto mt-3 max-w-3xl text-4xl text-plum sm:text-6xl">Meet DJ ATTITUDE mini HARU &amp; JIN</h1>
        <div className="mx-auto mt-8 flex max-w-xl items-end justify-center gap-6">
          {[haru, jin].map((c) => (
            <figure key={c.name} className="flex w-1/2 flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.art} alt={`${c.name}, ${c.tagline}`} className="h-64 w-auto drop-shadow-[0_12px_24px_rgba(120,20,70,0.35)] sm:h-80" />
              <figcaption className="mt-3 rounded-full border-2 border-white px-3 py-1 text-xs font-extrabold tracking-wide text-plum shadow" style={{ background: c.color }}>
                {c.name}
              </figcaption>
            </figure>
          ))}
        </div>
        <MeetButtons />
      </section>

      <div className="container-luxe mt-14 grid max-w-5xl gap-10 lg:grid-cols-2">
        <article className="rounded-[2rem] border-2 border-[#FFB6D9] bg-[#FFF5FA] p-7">
          <h2 className="font-display text-3xl">HARU 💖 — Your Drip Bestie</h2>
          <p className="mt-3 text-sm leading-relaxed text-plum-soft">
            Haru is our head assistant and the face you see in the pink circle. A sweet Korean anime-style DJ, she spins tracks by night and styles fits by day. She&rsquo;s here to help you find your size, match your top with your pants, explain free-size pieces and cheer you on. She says it best: &ldquo;You make our drip special!&rdquo;
          </p>
        </article>
        <article className="rounded-[2rem] border-2 border-[#E94E8A] bg-[#FFE6EF] p-7">
          <h2 className="font-display text-3xl">JIN 🔥 — Your Fit Buddy</h2>
          <p className="mt-3 text-sm leading-relaxed text-plum-soft">
            Jin is Haru&rsquo;s cool DJ partner and our streetwear expert: cargo and baggy pants, hoodies, jerseys and sneakers. He jumps in on the men&rsquo;s side of the shop — Haru waves &ldquo;Jin got you!&rdquo; — and you can switch to him anytime in the chat.
          </p>
        </article>
      </div>

      <section className="container-luxe mt-14 max-w-5xl">
        <h2 className="display text-3xl sm:text-4xl">Two shades of pink</h2>
        <p className="mt-2 max-w-2xl text-sm text-plum-soft">Both wear the Attitude Collections cargo hoodie and pants, but each has a shade of their own so you always know who&rsquo;s helping you.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {SHADES.map((s) => (
            <div key={s.hex} className="flex gap-4 rounded-3xl border border-line bg-white p-5">
              <span className="size-16 shrink-0 rounded-2xl border-4 border-white shadow-lg" style={{ background: s.hex }} aria-hidden />
              <div>
                <p className="font-semibold">
                  {s.name} <span className="font-mono text-xs text-muted">{s.hex}</span>
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-rose-deep">{s.who}</p>
                <p className="mt-1 text-sm text-plum-soft">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-luxe mt-14 max-w-5xl">
        <h2 className="display text-3xl sm:text-4xl">What they can do</h2>
        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <li className="rounded-2xl bg-[#FFF5FA] p-4">👗 <b>Style you:</b> tell them your height, fit, budget and occasion, and they pick real pieces from the shop.</li>
          <li className="rounded-2xl bg-[#FFF5FA] p-4">📏 <b>Size help:</b> they read each item&rsquo;s sizes and explain FREE SIZE pieces (fits S to XL).</li>
          <li className="rounded-2xl bg-[#FFF5FA] p-4">🚚 <b>Quick answers:</b> delivery, payment, returns and tracking — or they connect you to WhatsApp.</li>
          <li className="rounded-2xl bg-[#FFF5FA] p-4">🔊 <b>Cute voices:</b> tap the speaker on any message to hear them (English with a sweet Korean-style touch).</li>
        </ul>
        <p className="mt-8 text-sm">
          Ready? <Link href="/shop" className="font-semibold text-rose-deep underline underline-offset-4">Start shopping</Link> and tap Haru&rsquo;s pink circle anytime.
        </p>
      </section>
    </div>
  );
}
