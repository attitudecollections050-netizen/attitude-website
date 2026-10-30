// A short sweet "ding-ding" chime (Web Audio, no files). Must be called from a tap or click.
export function playChime() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
    [1318.5, 1760, 2093, 2637].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => void ctx.close(), 1600);
  } catch {}
}
