// HALLUCINATION (2026-11-08): its sounds, made in the browser with the kit's synth (src/games/kit/audio.js): a bright
// ding that climbs with each find, a pen scribble, a short buzzer for a wrong tap, the clock's tick when time is short,
// a sparkle and a brush sweep when a scene is cleared, her little "hmm" for a hint, the blink's shutter clicks. Silent
// in a demo (the kit).
import { createLoopMusic } from '../kit/audio.js';
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4];
const _ = null;
const bars = (...b) => b.flat();
// a quiet music box while she waits to be caught: F, Dm, Bb, C, plucked high and slow, a soft round bass
export function createMusic() {
  return createLoopMusic({
    bpm: 76, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.03, dur: 3, filter: 3200, notes: bars(
        [81, _, _, _, 84, _, _, _, 89, _, _, _, 88, _, 84, _],
        [86, _, _, _, 81, _, _, _, 77, _, _, _, 81, _, _, _],
        [77, _, _, _, 82, _, _, _, 86, _, _, _, 84, _, 82, _],
        [76, _, _, _, 79, _, _, _, 84, _, _, _, _, _, 79, _]) },
      { type: 'sine', vol: 0.03, dur: 2, notes: bars(
        [_, _, 72, _, _, _, 77, _, _, _, 72, _, _, _, 77, _],
        [_, _, 69, _, _, _, 74, _, _, _, 69, _, _, _, 74, _],
        [_, _, 70, _, _, _, 74, _, _, _, 70, _, _, _, 74, _],
        [_, _, 67, _, _, _, 72, _, _, _, 67, _, _, _, 72, _]) },
      { type: 'sine', vol: 0.07, dur: 7, attack: 0.02, notes: bars(
        [41, _, _, _, _, _, _, _, 48, _, _, _, _, _, _, _], [38, _, _, _, _, _, _, _, 45, _, _, _, _, _, _, _],
        [34, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _], [36, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _]) },
    ],
  });
}
export function createSfx(audio) {
  return {
    find(n = 0, combo = 1) {
      const f = 784 * PENTA[Math.min(PENTA.length - 1, n)] * (combo > 1 ? 1.06 : 1);
      audio.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.2 });
      audio.tone({ freq: f * 2, type: 'sine', dur: 0.22, vol: 0.08, at: 0.03 });
      audio.tone({ freq: f * 3.01, type: 'sine', dur: 0.12, vol: 0.03, at: 0.05 });
      audio.noise({ dur: 0.22, vol: 0.05, filter: 2600, type: 'bandpass', q: 1.4, slideFilter: 5200, at: 0.02 });
      if (combo > 1) [0, 0.05, 0.1].forEach((t, i) => audio.tone({ freq: f * [1.5, 2, 2.5][i], type: 'square', dur: 0.06, vol: 0.035, at: 0.1 + t }));
    },
    wrong() {
      audio.tone({ freq: 170, type: 'square', dur: 0.1, vol: 0.09, filter: 1200 });
      audio.tone({ freq: 140, type: 'square', dur: 0.16, vol: 0.09, at: 0.09, filter: 1000 });
    },
    again() { audio.tone({ freq: 660, type: 'triangle', dur: 0.05, vol: 0.06 }); },
    tick(urgent = false) { audio.tone({ freq: urgent ? 1400 : 1150, type: 'square', dur: 0.025, vol: urgent ? 0.06 : 0.04 }); },
    clear() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.12, at: i * 0.07 }));
      audio.noise({ dur: 0.5, vol: 0.09, filter: 900, type: 'bandpass', q: 0.7, slideFilter: 4200, at: 0.42 });
      audio.tone({ freq: 1568, type: 'sine', dur: 0.4, vol: 0.05, at: 0.42, slide: 2093 });
    },
    hint() { audio.tone({ freq: 520, type: 'sine', dur: 0.14, vol: 0.12, slide: 470 }); audio.tone({ freq: 440, type: 'sine', dur: 0.2, vol: 0.1, at: 0.13, slide: 500 }); },
    blink() { for (let i = 0; i < 6; i++) audio.noise({ dur: 0.03, vol: 0.12, filter: 3800, type: 'highpass', at: i * 0.2 }); },
    whoosh() { audio.sfx('whoosh', { pitch: 0.9 }); },
    over() { audio.sfx('lose'); },
    start() { audio.sfx('select'); },
  };
}
