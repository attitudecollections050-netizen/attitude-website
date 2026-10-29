// Original soundtrack for the homepage hero film, synthesised live with the Web Audio API
// (no audio files, nothing to license). 120 BPM, four-bar loop in A minor (Am – F – C – G):
// four-on-the-floor kick, claps, hi-hats, a plucky bass, soft chord pad and a sparkle
// arpeggio, plus a whoosh for scene changes and a chime for the final call to action.
// Browsers only allow sound after the visitor taps, so it's started from a click.

const BPM = 120;
const STEP = 60 / BPM / 4; // one 16th note
const STEPS = 64; // four bars

// Chord roots and notes per bar (MIDI numbers).
const CHORDS = [
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [53, 57, 60] }, // F
  { root: 48, notes: [55, 60, 64] }, // C
  { root: 43, notes: [55, 59, 62] }, // G
];
const BASS_STEPS = [0, 3, 6, 8, 10, 11, 14];
const ARP = [0, 1, 2, 1, 2, 0, 2, 1];

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface HeroTrack {
  /** Starts (or resumes) playback; must be called from a tap or click. */
  play(): Promise<void>;
  /** Fades out and suspends. */
  pause(): void;
  whoosh(): void;
  chime(): void;
  dispose(): void;
  readonly playing: boolean;
}

export function createHeroTrack(volume = 0.55): HeroTrack | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  // A short stereo-ish echo for space.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const noise = (() => {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  })();

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  const kick = (t: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(g, t, 0.9, 0.003, 0.32);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.4);
  };

  const noiseHit = (t: number, type: BiquadFilterType, f: number, peak: number, decay: number, send = false) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = f;
    const g = ctx.createGain();
    env(g, t, peak, 0.002, decay);
    src.connect(filter).connect(g).connect(master);
    if (send) g.connect(delay);
    src.start(t);
    src.stop(t + decay + 0.05);
  };

  const clap = (t: number) => {
    for (let i = 0; i < 3; i++) noiseHit(t + i * 0.012, "bandpass", 1600, 0.45, 0.09, i === 2);
  };

  const tone = (t: number, midi: number, type: OscillatorType, peak: number, attack: number, decay: number, cutoff: number, send = false) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    env(g, t, peak, attack, decay);
    o.connect(filter).connect(g).connect(master);
    if (send) g.connect(delay);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  };

  const scheduleStep = (step: number, t: number) => {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[bar];
    if (s % 4 === 0) kick(t);
    if (s === 4 || s === 12) clap(t);
    if (s % 2 === 1) noiseHit(t, "highpass", 8500, s % 4 === 3 ? 0.16 : 0.08, s % 4 === 3 ? 0.11 : 0.04);
    if (BASS_STEPS.includes(s)) tone(t, chord.root + (s === 14 ? 12 : 0), "sawtooth", 0.28, 0.005, 0.2, 520);
    if (s === 0) for (const n of chord.notes) tone(t, n, "sawtooth", 0.045, 0.35, STEP * 15, 1400);
    if (s % 2 === 0) tone(t, chord.notes[ARP[(s / 2) % ARP.length]] + 12, "triangle", 0.09, 0.004, 0.22, 4200, true);
  };

  let step = 0;
  let next = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let playing = false;

  const tick = () => {
    while (next < ctx.currentTime + 0.12) {
      scheduleStep(step, next);
      step = (step + 1) % STEPS;
      next += STEP;
    }
  };

  return {
    get playing() {
      return playing;
    },
    async play() {
      await ctx.resume();
      if (playing) return;
      playing = true;
      next = ctx.currentTime + 0.05;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.6);
      timer = setInterval(tick, 25);
      tick();
    },
    pause() {
      if (!playing) return;
      playing = false;
      if (timer) clearInterval(timer);
      timer = null;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      setTimeout(() => {
        if (!playing) void ctx.suspend();
      }, 320);
    },
    whoosh() {
      if (!playing) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(5000, t + 0.45);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.connect(filter).connect(g).connect(master);
      src.start(t);
      src.stop(t + 0.65);
    },
    chime() {
      if (!playing) return;
      const t = ctx.currentTime;
      [81, 84, 88, 93].forEach((n, i) => tone(t + i * 0.07, n, "sine", 0.12, 0.005, 0.9, 8000, true));
    },
    dispose() {
      if (timer) clearInterval(timer);
      playing = false;
      void ctx.close();
    },
  };
}
