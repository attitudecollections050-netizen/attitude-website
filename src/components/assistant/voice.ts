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

// Natural-sounding English voices, US accent first.
const PREFERRED = [
  /Jenny|Aria|Ava|Emma|Michelle|Ana\b/i, // Microsoft Edge "Online (Natural)" voices
  /Samantha|Allison|Susan|Zoe|Nicky/i, // Apple (US)
  /Google US English/i,
  /Sonia|Libby|Maisie|Serena|Kate|Martha|Google UK English Female/i, // UK
  /Zira|Hazel|Karen|Tessa|Moira|Fiona|Victoria|Catherine/i,
  /female|woman|girl/i,
];
const PREFERRED_MALE = [
  /Andrew|Brian|Christopher|Eric|Guy|Roger|Steffan/i, // Microsoft Edge "Online (Natural)" voices
  /Aaron|Alex|Tom|Reed|Evan|Nathan/i, // Apple (US)
  /Google US English/i,
  /David|Mark|Daniel|Ryan|Google UK English Male/i,
  /male|man|boy/i,
];
const MALE = /\b(David|Mark|Guy|Ryan|Daniel|Alex|Fred|Thomas|George|James|Brian|Christopher|Eric|Roger|Steffan|William|Oliver|Arthur|Rishi|Aaron|Tom|Reed|Rocko|Andrew|Evan|Nathan|Grandpa|Male|Google UK English Male)\b/i;
const QUALITY = /Natural|Neural|Online|Enhanced|Premium/i;
const ACCENT_RANK = (lang: string) => (/en[-_]US/i.test(lang) ? 0 : /en[-_]GB/i.test(lang) ? 1 : /en[-_](AU|CA|IE|NZ)/i.test(lang) ? 2 : 3);
const VOICE_PREF_KEY = "ac_mascot_voice";

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

/** English voices on this device for a character (female for Haru, male for Jin), best first. */
export function englishVoices(voices: SpeechSynthesisVoice[] = cachedVoices, gender: "female" | "male" = "female"): SpeechSynthesisVoice[] {
  const rank = (v: SpeechSynthesisVoice) => {
    const prefs = gender === "female" ? PREFERRED : PREFERRED_MALE;
    const pref = prefs.findIndex((re) => re.test(v.name));
    return (pref === -1 ? 50 : pref * 4) + ACCENT_RANK(v.lang) - (QUALITY.test(v.name) ? 3 : 0);
  };
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const matching = english.filter((v) => (gender === "female" ? !MALE.test(v.name) : MALE.test(v.name)));
  return (matching.length ? matching : english).sort((a, b) => rank(a) - rank(b));
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null, gender: "female" | "male" = "female"): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  if (preferredName) {
    const chosen = english.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  return englishVoices(voices, gender)[0] ?? english[0] ?? null;
}

const voiceKey = (who: VoiceWho) => `${VOICE_PREF_KEY}_${who}`;
export function savedVoiceName(who: VoiceWho = "haru"): string | null {
  try {
    return localStorage.getItem(voiceKey(who));
  } catch {
    return null;
  }
}
export function saveVoiceName(name: string, who: VoiceWho = "haru") {
  try {
    localStorage.setItem(voiceKey(who), name);
  } catch {}
}

export type VoiceWho = "haru" | "jin";
/**
 * Cute voices in US English, a touch slower for a soft Korean-accent feel:
 * Haru sweet and high, Jin cool and a little lower.
 */
export const VOICES: Record<VoiceWho, { pitch: number; rate: number; gender: "female" | "male" }> = {
  haru: { pitch: 1.3, rate: 0.95, gender: "female" },
  jin: { pitch: 0.9, rate: 0.95, gender: "male" },
};

/** Reads a reply aloud in the character's cute voice. */
export async function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void } = {}, who: VoiceWho = "haru") {
  if (!canSpeak()) return;
  const say = speakable(text);
  if (!say) return;
  window.speechSynthesis.cancel();
  const voices = await voicesReady();
  const settings = VOICES[who];
  const u = new SpeechSynthesisUtterance(say);
  const voice = pickVoice(voices, savedVoiceName(who), settings.gender);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.pitch = settings.pitch;
  u.rate = settings.rate;
  u.onstart = () => handlers.onStart?.();
  u.onend = () => handlers.onEnd?.();
  u.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
