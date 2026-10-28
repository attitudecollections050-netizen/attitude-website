"use client";
import { speakable } from "@/lib/assistant/shared";

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib everywhere).
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

/** Voice messages are always understood as English (US English has the widest browser support). */
export const RECOGNITION_LANG = "en-US";

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Asks the browser for microphone access (this is what shows the "Allow
 * microphone?" prompt). The site can't grant itself access — only the
 * visitor can, once; after that the browser remembers it.
 */
export async function requestMicrophone(): Promise<"granted" | "blocked" | "unavailable"> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "granted"; // let speech recognition ask itself
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotFoundError" || name === "OverconstrainedError") return "unavailable";
    return "blocked";
  }
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// Light, young-sounding English voices first ("Ana" is a child voice on Windows/Edge),
// then other female English voices. Male voices are never picked when a female one exists.
const PREFERRED = [
  /\bAna\b/i,
  /Jenny|Aria|Michelle|Emma|Ava|Sonia|Libby|Maisie|Natasha|Clara/i,
  /Samantha|Karen|Tessa|Moira|Fiona|Victoria|Allison|Susan|Zira|Hazel|Catherine/i,
  /Google US English|Google UK English Female/i,
  /female|woman|girl/i,
];
const MALE = /\b(David|Mark|Guy|Ryan|Daniel|Alex|Fred|Thomas|George|James|Brian|Christopher|Eric|Roger|Steffan|William|Oliver|Arthur|Rishi|Aaron|Male)\b/i;

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Voices load asynchronously in Chrome; call early so the right voice is ready. */
export function primeVoices() {
  if (!canSpeak()) return;
  const update = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  update();
  window.speechSynthesis.addEventListener?.("voiceschanged", update);
}

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = english.filter((v) => !MALE.test(v.name));
  for (const re of PREFERRED) {
    const v = pool.find((x) => re.test(x.name));
    if (v) return v;
  }
  return pool.find((v) => /en[-_]US/i.test(v.lang)) ?? pool[0] ?? english[0] ?? null;
}

/** A cute, light "baby" voice: high pitch, slightly quick — in English. */
export const BABY_VOICE = { pitch: 1.9, rate: 1.08 };

/** Reads a reply aloud in English with Dj Attitude Mini's baby voice. */
export function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!canSpeak()) return;
  const say = speakable(text);
  if (!say) return;
  window.speechSynthesis.cancel();
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices();
  const u = new SpeechSynthesisUtterance(say);
  const voice = pickVoice(cachedVoices);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.pitch = BABY_VOICE.pitch;
  u.rate = BABY_VOICE.rate;
  u.onstart = () => handlers.onStart?.();
  u.onend = () => handlers.onEnd?.();
  u.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
