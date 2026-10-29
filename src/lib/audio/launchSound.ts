// Sound for the launch countdown: a soft clock tick, a chime between lines, the hero
// soundtrack at a low level, and the two characters' voices (the browser's built-in
// speech voices). Browsers only allow sound after the visitor taps, so start it from a click.
import { createHeroTrack, type HeroTrack } from "@/lib/audio/heroTrack";

export interface LaunchSound {
  start(): Promise<void>;
  tick(): void;
  chime(): void;
  speak(text: string, who: 0 | 1 | 2): void;
  stop(): void;
}

const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}✨️]/gu, "").trim();

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const female = /female|samantha|zira|susan|karen|moira|tessa|victoria|serena|fiona|google uk english female|google us english/i;
  return en.find((v) => /en-NG/i.test(v.lang)) ?? en.find((v) => female.test(v.name)) ?? en[0] ?? null;
}

export function createLaunchSound(): LaunchSound | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  let music: HeroTrack | null = null;
  let on = false;
  let closed = false;

  const blip = (f: number, peak: number, decay: number, type: OscillatorType = "sine", at = 0) => {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.02);
  };

  return {
    async start() {
      await ctx.resume();
      on = true;
      music ??= createHeroTrack(0.16);
      await music?.play();
    },
    tick() {
      if (!on) return;
      blip(2400, 0.18, 0.03, "square");
      blip(1200, 0.12, 0.05, "sine", 0.004);
    },
    chime() {
      if (!on) return;
      [1318, 1760, 2093].forEach((f, i) => blip(f, 0.08, 0.5, "sine", i * 0.06));
    },
    speak(text, who) {
      if (!on || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(stripEmoji(text));
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1.05;
      u.pitch = who === 0 ? 1.55 : who === 1 ? 1.2 : 1.4;
      synth.speak(u);
    },
    stop() {
      if (closed) return;
      closed = true;
      on = false;
      window.speechSynthesis?.cancel();
      music?.dispose();
      music = null;
      void ctx.close();
    },
  };
}
