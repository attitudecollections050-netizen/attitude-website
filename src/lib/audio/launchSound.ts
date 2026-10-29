// Sound for the launch countdown: a soft clock tick, a chime between lines, the hero
// soundtrack at a low level, and the two characters' voices (the browser's built-in
// speech voices). Browsers only allow sound after the visitor taps, so start it from a click.
import { createHeroTrack, type HeroTrack } from "@/lib/audio/heroTrack";

export interface LaunchSound {
  start(): void;
  tick(): void;
  chime(): void;
  speak(text: string, who: 0 | 1 | 2, now?: boolean): void;
  stop(): void;
}

const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}✨️]/gu, "").trim();

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const female = /female|samantha|zira|susan|karen|moira|tessa|victoria|serena|fiona|google uk english female|google us english/i;
  return en.find((v) => /en-NG/i.test(v.lang)) ?? en.find((v) => female.test(v.name)) ?? en[0] ?? null;
}

// iPhones mute Web Audio while the silent switch is on; playing a (silent) media element
// first moves the page into "playback" mode so the music and ticks can be heard.
let unlocker: HTMLAudioElement | null = null;
function unlockIOS() {
  if (unlocker) {
    void unlocker.play().catch(() => {});
    return;
  }
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  unlocker = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
  unlocker.loop = true;
  unlocker.setAttribute("playsinline", "");
  void unlocker.play().catch(() => {});
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
    start() {
      // Everything here runs straight from the tap, with no await before it: phones
      // (iPhone especially) only allow sound that starts inside the tap itself.
      on = true;
      unlockIOS();
      void ctx.resume();
      music ??= createHeroTrack(0.3);
      void music?.play();
      if ("speechSynthesis" in window) {
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      }
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
    speak(text, who, now = false) {
      if (!on || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      if (!now) synth.cancel();
      const u = new SpeechSynthesisUtterance(stripEmoji(text));
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v?.lang ?? "en-GB";
      u.rate = 1.05;
      u.pitch = who === 0 ? 1.55 : who === 1 ? 1.2 : 1.4;
      u.volume = 1;
      // Chrome can drop an utterance queued in the same moment as cancel(), so wait a beat.
      // (A tap's first line is spoken at once: phones only allow speech that starts inside the tap.)
      if (now) synth.speak(u);
      else
        setTimeout(() => {
          if (on) synth.speak(u);
        }, 120);
    },
    stop() {
      if (closed) return;
      closed = true;
      on = false;
      window.speechSynthesis?.cancel();
      unlocker?.pause();
      music?.dispose();
      music = null;
      void ctx.close();
    },
  };
}
