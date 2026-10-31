"use client";
// Notification sound + system notifications for staff ratings and admin alerts.
// Plays /notification.mp3 (a soft "ding-dong"); if the browser refuses, falls back to the
// same tone made with Web Audio. Browsers only allow sound after the person has tapped the
// page once, so audio is unlocked on the first tap or key press.

const KEY = "ac_notify_sound";
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;
let clip: HTMLAudioElement | null = null;
const SOUND_URL = "/notification.mp3";
const played = new Map<string, number>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Unlock audio on the first interaction (iPhone/Chrome block sound before that). */
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = audio();
    if (c && c.state === "suspended") void c.resume();
    if (!clip && typeof Audio !== "undefined") {
      clip = new Audio(SOUND_URL);
      clip.preload = "auto";
      // iPhone: a muted play inside the tap unlocks this element for later.
      clip.muted = true;
      void clip.play().then(() => {
        clip!.pause();
        clip!.currentTime = 0;
        clip!.muted = false;
      }).catch(() => {
        if (clip) clip.muted = false;
      });
    }
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { passive: true });
  // A push arrived while a tab is open: the system shows it; this tab plays the ding once.
  navigator.serviceWorker?.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { type?: string; tag?: string } | null;
    if (d?.type === "push" && d.tag && firstTime(d.tag) && isSoundOn()) playSound();
  });
}

/** Sound is on unless the person switched it off on this device. */
export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore: re-render when the setting changes (also from another tab). */
export function subscribeSound(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Each notification makes a sound once, even when a pop-up and a list both receive it. */
function firstTime(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of played) if (now - t > 60_000) played.delete(k);
  if (played.has(id)) return false;
  played.set(id, now);
  return true;
}

function ding() {
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  try {
    const master = c.createGain();
    master.gain.value = 0.35;
    master.connect(c.destination);
    // "ding" (E6) then "dong" (C6), each with a soft bell overtone.
    [
      [1318.5, 0],
      [1046.5, 0.22],
    ].forEach(([f, delay]) => {
      const t = c.currentTime + delay;
      for (const [mult, vol] of [[1, 0.7], [2.01, 0.18]]) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f * mult;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.85);
      }
    });
  } catch {}
}

/** The notification sound: the mp3 file, or the Web Audio tone if the file can't play. */
export function playSound() {
  if (typeof Audio === "undefined") return ding();
  try {
    clip ??= new Audio(SOUND_URL);
    clip.muted = false;
    clip.currentTime = 0;
    const p = clip.play();
    if (p) p.catch(() => ding());
  } catch {
    ding();
  }
}

/** Plays the test sound (used by the toggle; the tap also unlocks audio). */
export function playTestSound() {
  playSound();
}

/**
 * A new notification arrived: play the sound (if on) and show a system notification when
 * the person allowed them and isn't looking at the tab. Safe to call several times per id.
 */
export function notify(id: string, title: string, body: string, opts: { icon?: string; href?: string } = {}) {
  if (!firstTime(id)) return;
  if (isSoundOn()) playSound();
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const n = new Notification(title, { body, icon: opts.icon ?? "/mascots/girl-face.png", tag: id });
    n.onclick = () => {
      window.focus();
      if (opts.href) window.location.href = opts.href;
    };
  } catch {}
}
