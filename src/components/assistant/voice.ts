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

// Natural-sounding female English voices, US/UK accents first. Male voices are skipped.
const PREFERRED = [
  /Jenny|Aria|Ava|Emma|Michelle|Ana\b/i, // Microsoft Edge "Online (Natural)" voices
  /Samantha|Allison|Susan|Zoe|Nicky/i, // Apple (US)
  /Google US English/i,
  /Sonia|Libby|Maisie|Serena|Kate|Martha|Google UK English Female/i, // UK
  /Zira|Hazel|Karen|Tessa|Moira|Fiona|Victoria|Catherine/i,
  /female|woman|girl/i,
];
const MALE = /\b(David|Mark|Guy|Ryan|Daniel|Alex|Fred|Thomas|George|James|Brian|Christopher|Eric|Roger|Steffan|William|Oliver|Arthur|Rishi|Aaron|Tom|Reed|Rocko|Grandpa|Male|Google UK English Male)\b/i;
const QUALITY = /Natural|Neural|Online|Enhanced|Premium/i;
const ACCENT_RANK = (lang: string) => (/en[-_]US/i.test(lang) ? 0 : /en[-_]GB/i.test(lang) ? 1 : /en[-_](AU|CA|IE|NZ)/i.test(lang) ? 2 : 3);
const VOICE_PREF_KEY = "ac_mini_voice_name";

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Voices load asynchronously (especially on phones); call early so the right voice is ready. */
export function primeVoices() {
  if (!canSpeak()) return;
  const update = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  update();
  window.speechSynthesis.addEventListener?.("voiceschanged", update);
}

let waitedForVoices = false;

function voicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length || waitedForVoices) return Promise.resolve((cachedVoices = now));
  waitedForVoices = true; // only ever wait once; some devices have no voices list at all
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", done);
      resolve((cachedVoices = window.speechSynthesis.getVoices()));
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

/** Female English voices on this device, best first (for the voice picker). */
export function englishVoices(voices: SpeechSynthesisVoice[] = cachedVoices): SpeechSynthesisVoice[] {
  const rank = (v: SpeechSynthesisVoice) => {
    const pref = PREFERRED.findIndex((re) => re.test(v.name));
    return (pref === -1 ? 50 : pref * 4) + ACCENT_RANK(v.lang) - (QUALITY.test(v.name) ? 3 : 0);
  };
  return voices.filter((v) => /^en([-_]|$)/i.test(v.lang) && !MALE.test(v.name)).sort((a, b) => rank(a) - rank(b));
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  if (preferredName) {
    const chosen = english.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  return englishVoices(voices)[0] ?? english[0] ?? null;
}

export function savedVoiceName(): string | null {
  try {
    return localStorage.getItem(VOICE_PREF_KEY);
  } catch {
    return null;
  }
}
export function saveVoiceName(name: string) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, name);
  } catch {}
}

/** A cute, light voice: a little higher and brighter than normal, but still natural English. */
export const CUTE_VOICE = { pitch: 1.35, rate: 1.02 };

/** Reads a reply aloud in English with Dj Attitude Mini's cute voice. */
export async function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!canSpeak()) return;
  const say = speakable(text);
  if (!say) return;
  window.speechSynthesis.cancel();
  const voices = await voicesReady();
  const u = new SpeechSynthesisUtterance(say);
  const voice = pickVoice(voices, savedVoiceName());
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.pitch = CUTE_VOICE.pitch;
  u.rate = CUTE_VOICE.rate;
  u.onstart = () => handlers.onStart?.();
  u.onend = () => handlers.onEnd?.();
  u.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
