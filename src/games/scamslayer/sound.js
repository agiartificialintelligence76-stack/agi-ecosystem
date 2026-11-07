// SCAM SLAYER: its sounds, made in the browser with the kit's synth (no files). A slice is a bright "shhk" with a note
// that climbs a step for each scam in the same swipe (a combo you can hear), a combo is a rising arpeggio, a heart is a
// sad boing with a crack, a rug is a boom and a carpet flapping out. Each is called with the game's own reasons; nothing
// plays in a demo (the kit's audio is silent there). Plus a small lo-fi loop for a run (the cozy desk at night).
import { createLoopMusic } from '../kit/audio.js';

// a pentatonic ladder for the slices of one swipe (C major pentatonic, two octaves)
const LADDER = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
const at = (i) => LADDER[Math.min(LADDER.length - 1, Math.max(0, i))];

export function createSounds(audio) {
  let lastSlice = 0, lastLaunch = 0, lastSwish = 0, lastFuse = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const S = {
    swish(speed = 1) {
      const t = now();
      if (t - lastSwish < 110) return;
      lastSwish = t;
      const k = Math.min(1.6, Math.max(0.6, speed));
      audio.noise({ dur: 0.13, vol: 0.05 + 0.04 * k, filter: 700 * k, type: 'bandpass', q: 0.9, slideFilter: 3400 * k });
    },
    slice(n = 1, { crit = false, golden = false } = {}) {
      const t = now();
      if (t - lastSlice < 28) return;
      lastSlice = t;
      const f = at(n - 1);
      audio.noise({ dur: 0.09, vol: 0.2, filter: 4800, type: 'highpass' });
      audio.tone({ freq: 170, type: 'triangle', dur: 0.07, vol: 0.2, slide: 80 });
      audio.tone({ freq: f, type: 'sine', dur: 0.12, vol: 0.12, slide: f * 1.25, attack: 0.003 });
      audio.tone({ freq: f * 2, type: 'triangle', dur: 0.06, vol: 0.035, at: 0.01 });
      if (crit) { audio.tone({ freq: 2400, type: 'sine', dur: 0.16, vol: 0.08, at: 0.02 }); audio.tone({ freq: 3600, type: 'sine', dur: 0.12, vol: 0.05, at: 0.03 }); }
      if (golden) [1319, 1568, 2093, 2637].forEach((g, i) => audio.tone({ freq: g, type: 'square', dur: 0.07, vol: 0.05, at: 0.03 + i * 0.045 }));
    },
    combo(n) {
      const steps = Math.min(7, n);
      for (let i = 0; i < steps; i++) audio.tone({ freq: at(i + 2), type: i % 2 ? 'triangle' : 'square', dur: 0.09, vol: 0.06, at: 0.04 + i * 0.05 });
      audio.chord([at(steps), at(steps + 2), at(steps + 4)].map((f) => f / 2), { dur: 0.32, type: 'triangle', vol: 0.06, at: 0.06 + steps * 0.05 });
    },
    heart() {
      audio.tone({ freq: 620, type: 'sine', dur: 0.32, vol: 0.2, slide: 190 });
      audio.tone({ freq: 310, type: 'triangle', dur: 0.36, vol: 0.12, slide: 120, at: 0.04 });
      audio.noise({ dur: 0.14, vol: 0.16, filter: 6000, type: 'highpass', at: 0.02 });
      for (let i = 0; i < 4; i++) audio.noise({ dur: 0.02, vol: 0.12, filter: 7000 - i * 600, type: 'highpass', at: 0.05 + i * 0.035 });
    },
    rug(final = true) {
      audio.noise({ dur: 0.7, vol: 0.5, filter: 1100, type: 'lowpass', slideFilter: 90 });
      audio.tone({ freq: 96, type: 'sine', dur: 0.55, vol: 0.4, slide: 38 });
      audio.tone({ freq: 60, type: 'square', dur: 0.3, vol: 0.1, slide: 30, filter: 400 });
      // the carpet flapping as it unrolls
      for (let i = 0; i < (final ? 7 : 4); i++) audio.noise({ dur: 0.05, vol: 0.12 - i * 0.012, filter: 900 + i * 120, type: 'bandpass', q: 1.2, at: 0.18 + i * 0.075 });
      if (final) [392, 330, 262, 196].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.12, at: 0.75 + i * 0.13 }));
    },
    miss() {
      audio.tone({ freq: 140, type: 'sine', dur: 0.16, vol: 0.28, slide: 60 });
      audio.noise({ dur: 0.1, vol: 0.14, filter: 2400, type: 'bandpass', at: 0.02 });
      audio.tone({ freq: 233, type: 'square', dur: 0.12, vol: 0.06, at: 0.06, slide: 196 });
    },
    crack() {
      audio.noise({ dur: 0.08, vol: 0.18, filter: 5200, type: 'highpass' });
      audio.tone({ freq: 880, type: 'square', dur: 0.05, vol: 0.05, slide: 440, at: 0.02 });
    },
    launch() {
      const t = now();
      if (t - lastLaunch < 70) return;
      lastLaunch = t;
      audio.tone({ freq: 190 + Math.random() * 40, type: 'sine', dur: 0.08, vol: 0.07, slide: 320 });
    },
    fuse() {
      const t = now();
      if (t - lastFuse < 140) return;
      lastFuse = t;
      audio.noise({ dur: 0.04, vol: 0.035, filter: 5200 + Math.random() * 2000, type: 'highpass' });
    },
    power(p) {
      if (p === 'freeze') {
        audio.chord([1568, 2093, 2637], { dur: 0.7, type: 'sine', vol: 0.06, attack: 0.05, strum: 0.06 });
        audio.tone({ freq: 880, type: 'triangle', dur: 0.5, vol: 0.08, slide: 220 });
      } else if (p === 'frenzy') {
        audio.tone({ freq: 220, type: 'sawtooth', dur: 0.4, vol: 0.1, slide: 880, filter: 2600 });
        for (let i = 0; i < 6; i++) audio.noise({ dur: 0.04, vol: 0.12, filter: 1800, type: 'bandpass', at: i * 0.06 });
      } else {
        audio.tone({ freq: 988, type: 'square', dur: 0.06, vol: 0.08 });
        audio.tone({ freq: 1319, type: 'square', dur: 0.16, vol: 0.08, at: 0.06 });
        audio.tone({ freq: 1976, type: 'triangle', dur: 0.2, vol: 0.05, at: 0.12 });
      }
    },
    powerEnd() { audio.tone({ freq: 660, type: 'triangle', dur: 0.14, vol: 0.06, slide: 440 }); },
    close() { audio.tone({ freq: 1760, type: 'sine', dur: 0.18, vol: 0.06, slide: 2637 }); audio.noise({ dur: 0.1, vol: 0.06, filter: 3000, type: 'bandpass', q: 2 }); },
    rush() { [392, 494, 587, 784].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.06, at: i * 0.07 })); },
    tick(urgent) { audio.tone({ freq: urgent ? 1480 : 1180, type: 'square', dur: 0.03, vol: urgent ? 0.07 : 0.04 }); },
    best() { audio.sfx('levelup'); },
    saved() { audio.tone({ freq: 1047, type: 'sine', dur: 0.1, vol: 0.05, slide: 1319 }); },
    start() { [523, 659, 784].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.09, at: i * 0.06 })); },
    end() { audio.sfx('lose'); },
  };
  return S;
}

// The run's music: a mellow loop for a cozy desk at night (Fmaj7, Em7, Dm7, Cmaj7), soft drums under it.
export function runMusic() {
  const bar = (notes) => notes;
  const chord = (root, third, fifth, seventh) => [root, null, null, null, third, null, null, null, fifth, null, null, null, seventh, null, null, null];
  const pad = [...chord(53, 57, 60, 64), ...chord(52, 55, 59, 62), ...chord(50, 53, 57, 60), ...chord(48, 52, 55, 59)];
  const bass = [
    41, null, null, null, null, null, 41, null, 48, null, null, null, null, null, 46, null,
    40, null, null, null, null, null, 40, null, 47, null, null, null, null, null, 45, null,
    38, null, null, null, null, null, 38, null, 45, null, null, null, null, null, 43, null,
    36, null, null, null, null, null, 36, null, 43, null, null, null, 47, null, 48, null,
  ];
  const lead = bar([
    null, null, 72, null, 76, null, null, 79, null, null, 77, null, 76, null, null, null,
    null, null, 71, null, 74, null, null, 76, null, null, 74, null, 71, null, null, null,
    null, null, 69, null, 72, null, null, 77, null, null, 76, null, 74, null, null, null,
    null, null, 67, null, 71, null, null, 72, null, null, 74, null, 76, null, 79, null,
  ]);
  return createLoopMusic({
    bpm: 96, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.028, notes: pad, dur: 3.6, filter: 1600, attack: 0.03 },
      { type: 'sine', vol: 0.07, notes: bass, dur: 1.6 },
      { type: 'square', vol: 0.016, notes: lead, dur: 0.9, filter: 2400 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    },
  });
}
