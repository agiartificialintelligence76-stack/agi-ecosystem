// BUBBLE SORT's sounds, made in the browser (the kit's audio): a soft thwip to fire, a tick off the walls, a tok when it
// sticks, pops climbing in pitch through a cluster, a plink for each dropped bubble (higher from higher up), the sort's
// tick-tock speeding up, a heavy thunk when the stack comes down, and a little loop of music under it all.
import { createLoopMusic } from '../kit/audio.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createSfx(audio) {
  const a = audio;
  let lastPop = 0;
  return {
    fire() { a.noise({ dur: 0.09, vol: 0.12, filter: 900, type: 'bandpass', q: 1.2, slideFilter: 3800 }); a.tone({ freq: 520, slide: 900, type: 'triangle', dur: 0.07, vol: 0.12 }); },
    bounce(p = 1) { a.tone({ freq: 1100 * p, type: 'square', dur: 0.025, vol: 0.05 }); a.noise({ dur: 0.02, vol: 0.08, filter: 5200, type: 'highpass' }); },
    stick() { a.tone({ freq: 240, slide: 170, type: 'sine', dur: 0.07, vol: 0.22 }); a.noise({ dur: 0.025, vol: 0.06, filter: 2400, type: 'bandpass' }); },
    // the i-th pop of n: climbing a pentatonic scale (a few a frame at most)
    pop(i = 0, n = 1) {
      const now = performance.now();
      if (i > 0 && now - lastPop < 18) return;
      lastPop = now;
      const note = 72 + PENTA[Math.min(PENTA.length - 1, Math.floor(i * (n > 10 ? 0.6 : 1)))];
      a.tone({ freq: midi(note), slide: midi(note + 7), type: 'sine', dur: 0.08, vol: 0.2, attack: 0.002 });
      a.tone({ freq: midi(note + 12), type: 'triangle', dur: 0.04, vol: 0.05 });
    },
    plink(p = 1) { a.tone({ freq: 760 * p, type: 'triangle', dur: 0.06, vol: 0.07, slide: 820 * p }); },
    drop(n) { a.tone({ freq: 300, slide: 140, type: 'sine', dur: 0.14, vol: 0.18 }); },
    bigdrop(n) { a.chord([midi(67), midi(71), midi(74)], { dur: 0.22, type: 'triangle', vol: 0.1, strum: 0.04 }); a.noise({ dur: 0.3, vol: 0.12, filter: 500, type: 'lowpass', slideFilter: 120 }); },
    mega(n) {
      a.tone({ freq: 110, slide: 45, type: 'sine', dur: 0.5, vol: 0.35 });
      a.noise({ dur: 0.45, vol: 0.16, filter: 800, type: 'lowpass', slideFilter: 90 });
      [67, 71, 74, 79, 83].forEach((m, i) => a.tone({ freq: midi(m), type: 'triangle', dur: 0.16, vol: 0.09, at: 0.08 + i * 0.06 }));
    },
    combo(streak) { const base = 67 + Math.min(12, streak * 2); [0, 4, 7].forEach((d, i) => a.tone({ freq: midi(base + d), type: 'square', dur: 0.07, vol: 0.06, at: i * 0.05 })); },
    sortStart() { a.tone({ freq: 330, slide: 990, type: 'sawtooth', dur: 0.28, vol: 0.07, filter: 2600 }); a.noise({ dur: 0.25, vol: 0.06, filter: 1200, type: 'bandpass', slideFilter: 5200 }); },
    // the sort's comparisons: a tick-tock, higher as it speeds up
    swap(i = 0) { const up = Math.min(14, i * 0.5); a.tone({ freq: midi((i % 2 ? 84 : 79) + up), type: 'square', dur: 0.025, vol: 0.045 }); },
    sorted() { a.chord([midi(72), midi(76), midi(79), midi(84)], { dur: 0.26, type: 'triangle', vol: 0.09, strum: 0.035 }); },
    wild() { [76, 79, 83, 88].forEach((m, i) => a.tone({ freq: midi(m), type: 'sine', dur: 0.09, vol: 0.09, at: i * 0.035 })); },
    bomb() { a.sfx('explode'); },
    crack() { a.noise({ dur: 0.06, vol: 0.16, filter: 3800, type: 'highpass' }); a.tone({ freq: 1500, type: 'square', dur: 0.03, vol: 0.04 }); },
    thunk(by) { if (by === 'refill') { a.tone({ freq: 180, slide: 120, type: 'sine', dur: 0.12, vol: 0.14 }); return; } a.tone({ freq: 95, slide: 42, type: 'sine', dur: 0.36, vol: 0.4 }); a.noise({ dur: 0.18, vol: 0.18, filter: 420, type: 'lowpass' }); },
    miss() { a.tone({ freq: 196, type: 'triangle', dur: 0.08, vol: 0.06 }); },
    special() { a.sfx('power'); a.sfx('coin', { pitch: 1.1 }); },
    memory() { [84, 88, 91, 96].forEach((m, i) => a.tone({ freq: midi(m), type: 'sine', dur: 0.14, vol: 0.09, at: i * 0.07 })); },
    swapQueue() { a.tone({ freq: 660, slide: 880, type: 'triangle', dur: 0.06, vol: 0.1 }); a.tone({ freq: 880, slide: 660, type: 'triangle', dur: 0.06, vol: 0.08, at: 0.05 }); },
    warn() { a.tone({ freq: 110, type: 'sine', dur: 0.12, vol: 0.18 }); a.tone({ freq: 104, type: 'sine', dur: 0.12, vol: 0.14, at: 0.16 }); },
    star(i) { a.tone({ freq: midi([79, 83, 86][i] || 86), type: 'triangle', dur: 0.2, vol: 0.13 }); a.tone({ freq: midi(([79, 83, 86][i] || 86) + 12), type: 'sine', dur: 0.12, vol: 0.05 }); },
    clear() { a.sfx('levelup'); setTimeout(() => a.sfx('win'), 260); },
    fail() { a.sfx('lose'); },
    select() { a.sfx('select'); },
    error() { a.sfx('error'); },
    aim() { a.tone({ freq: 1800, type: 'sine', dur: 0.012, vol: 0.02 }); },
  };
}

// a dreamy little loop: soft triangle arpeggios over a round bass, a light hat (on the music bus: its own switch)
export function createMusic() {
  return createLoopMusic({
    bpm: 96, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.035, dur: 1, notes: [
        64, null, 67, null, 71, null, 67, null, 69, null, 72, null, 76, null, 72, null,
        62, null, 66, null, 69, null, 66, null, 64, null, 67, null, 71, null, 74, null,
        64, null, 67, null, 71, null, 67, null, 69, null, 72, null, 76, null, 79, null,
        62, null, 66, null, 69, null, 74, null, 71, null, 67, null, 64, null, 62, null,
      ] },
      { type: 'sine', vol: 0.07, dur: 6, notes: [
        40, null, null, null, null, null, null, null, 45, null, null, null, null, null, null, null,
        38, null, null, null, null, null, null, null, 43, null, null, null, null, null, null, null,
        40, null, null, null, null, null, null, null, 45, null, null, null, null, null, null, null,
        38, null, null, null, null, null, null, null, 43, null, null, null, 38, null, null, null,
      ] },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  });
}
