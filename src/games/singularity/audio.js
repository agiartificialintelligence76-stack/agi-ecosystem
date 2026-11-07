// SINGULARITY (2026-11-08): its sounds, made in the browser with the arcade kit's synth (no files): a glassy tick for
// every tap that climbs as you keep tapping, a chime for each machine (higher for bigger ones), a sweep for upgrades,
// a shimmer when a Eureka spark appears, and a slow pad underneath, very soft. Silent in a demo (the kit's rule).
import { createLoopMusic } from '../kit/audio.js';

export function makeSounds(audio) {
  const tone = (o) => audio.tone(o);
  const jitter = () => 1 + (Math.random() * 2 - 1) * 0.025;
  return {
    tap(streak = 0) {
      const p = (1 + Math.min(streak, 16) * 0.035) * jitter();
      tone({ freq: 1046 * p, type: 'sine', dur: 0.07, vol: 0.07, attack: 0.002 });
      tone({ freq: 2093 * p, type: 'triangle', dur: 0.035, vol: 0.025, attack: 0.001 });
    },
    build(tier, many = false) {
      const p = (1 + tier * 0.045) * jitter();
      tone({ freq: 659 * p, type: 'triangle', dur: 0.06, vol: 0.09 });
      tone({ freq: 988 * p, type: 'triangle', dur: 0.12, vol: 0.08, at: 0.05 });
      if (many) tone({ freq: 1319 * p, type: 'sine', dur: 0.16, vol: 0.06, at: 0.1 });
    },
    milestone() { audio.sfx('combo', { pitch: 1.1 }); tone({ freq: 1568, type: 'sine', dur: 0.3, vol: 0.05, at: 0.16 }); },
    upgrade() {
      tone({ freq: 392, type: 'sawtooth', dur: 0.28, vol: 0.06, slide: 1175, filter: 2200 });
      audio.chord([784, 988, 1175], { dur: 0.3, type: 'triangle', vol: 0.05, at: 0.12, strum: 0.03 });
    },
    nope() { tone({ freq: 220, type: 'square', dur: 0.07, vol: 0.04, filter: 900 }); tone({ freq: 196, type: 'square', dur: 0.09, vol: 0.04, at: 0.07, filter: 900 }); },
    eurekaAppear() { [1568, 2093, 2637].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.18, vol: 0.035, at: i * 0.07 })); },
    eureka(frenzy) {
      audio.sfx('win', { pitch: frenzy ? 1.06 : 1 });
      audio.noise({ dur: 0.35, vol: 0.06, filter: 900, type: 'bandpass', q: 0.8, slideFilter: 5200 });
    },
    frenzyEnd() { tone({ freq: 880, type: 'sine', dur: 0.2, vol: 0.04, slide: 587 }); },
    line() { tone({ freq: 1319, type: 'sine', dur: 0.12, vol: 0.035 }); tone({ freq: 1976, type: 'sine', dur: 0.2, vol: 0.03, at: 0.09 }); },
    stage() {
      audio.sfx('levelup', { pitch: 0.9 });
      audio.chord([523, 659, 784, 1047], { dur: 0.9, type: 'sine', vol: 0.035, at: 0.28, strum: 0.05 });
    },
    perk() { audio.sfx('levelup', { pitch: 1.2 }); },
    ascend() {
      audio.noise({ dur: 1.4, vol: 0.09, filter: 300, type: 'bandpass', q: 0.6, slideFilter: 6000 });
      tone({ freq: 110, type: 'sine', dur: 1.5, vol: 0.18, slide: 55 });
      audio.chord([262, 330, 392, 523, 659], { dur: 1.8, type: 'triangle', vol: 0.04, at: 1.35, strum: 0.07 });
    },
    select() { audio.sfx('select', { pitch: 1.1 }); },
  };
}

// a slow pad (Am · F · C · G), four bars at 64 bpm, with a few soft plucks above it
const bar = (notes) => { const a = new Array(16).fill(null); a[0] = notes; return a; };
const pad = (chord) => [...bar(chord[0]), ...bar(chord[1]), ...bar(chord[2]), ...bar(chord[3])];
const pluck = new Array(64).fill(null);
[[2, 76], [6, 72], [11, 79], [18, 77], [22, 72], [27, 81], [34, 79], [38, 76], [43, 84], [50, 79], [54, 74], [59, 83]].forEach(([i, n]) => { pluck[i] = n; });
export const MUSIC = () => createLoopMusic({
  bpm: 64, steps: 16, bars: 4,
  tracks: [
    { type: 'triangle', vol: 0.022, dur: 16, attack: 0.8, filter: 700, notes: pad([45, 41, 48, 43]) },
    { type: 'sine', vol: 0.02, dur: 16, attack: 0.9, notes: pad([60, 57, 55, 59]) },
    { type: 'sine', vol: 0.016, dur: 16, attack: 1, notes: pad([64, 60, 64, 62]) },
    { type: 'sine', vol: 0.012, dur: 2, attack: 0.005, notes: pluck },
  ],
});
