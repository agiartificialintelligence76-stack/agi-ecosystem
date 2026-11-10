// ACCEPT ALL COOKIES: its sounds, made in the browser with the kit's synth (no files): a rope's twang (higher when it
// was taut), each pixel's blip a step higher than the last, the pop-up's bloop, a fan's puff, the cat's CHOMP and purr,
// a crumble, the stars stamping in with a rising chime; and a small cozy loop for music.
import { createLoopMusic } from '../kit/audio.js';

export function createSfx(a) {
  const r = () => 0.96 + Math.random() * 0.08;
  return {
    cut(taut = 1) {
      const p = (0.8 + taut * 0.5) * r();
      a.noise({ dur: 0.07, vol: 0.18, filter: 4200 * p, type: 'highpass' });
      a.tone({ freq: 420 * p, type: 'triangle', dur: 0.22, vol: 0.16, slide: 160 * p });
      a.tone({ freq: 840 * p, type: 'sine', dur: 0.12, vol: 0.06, slide: 300 * p, at: 0.01 });
    },
    swish() { a.noise({ dur: 0.09, vol: 0.05, filter: 2600 * r(), type: 'bandpass', q: 0.9, slideFilter: 5200 }); },
    pixel(n) {
      const base = [784, 988, 1175][Math.max(0, Math.min(2, n - 1))] * r();
      a.tone({ freq: base, type: 'square', dur: 0.06, vol: 0.07 });
      a.tone({ freq: base * 1.5, type: 'triangle', dur: 0.16, vol: 0.12, at: 0.05, slide: base * 2 });
    },
    hook() { a.tone({ freq: 300 * r(), type: 'triangle', dur: 0.09, vol: 0.14, slide: 620 }); a.noise({ dur: 0.05, vol: 0.08, filter: 3000, type: 'highpass', at: 0.02 }); },
    wrap() { a.tone({ freq: 220 * r(), type: 'sine', dur: 0.24, vol: 0.2, slide: 520, attack: 0.01 }); },
    bloop() { a.tone({ freq: 520 * r(), type: 'sine', dur: 0.12, vol: 0.24, slide: 180 }); a.noise({ dur: 0.05, vol: 0.06, filter: 1800 }); },
    puff(hit) { a.noise({ dur: 0.26, vol: hit ? 0.22 : 0.14, filter: 700 * r(), type: 'bandpass', q: 0.7, slideFilter: 2400 }); },
    bounce(v, pad) {
      const k = Math.min(1, v / 900);
      if (pad) { a.tone({ freq: 260 * r(), type: 'triangle', dur: 0.16, vol: 0.2, slide: 560 }); a.tone({ freq: 520 * r(), type: 'sine', dur: 0.1, vol: 0.08, slide: 1040, at: 0.03 }); }
      else a.tone({ freq: (140 + 90 * k) * r(), type: 'triangle', dur: 0.07, vol: 0.08 + 0.12 * k, slide: 90 });
    },
    tab() { a.tone({ freq: 300 * r(), type: 'sawtooth', dur: 0.22, vol: 0.07, slide: 1400, filter: 2600 }); a.tone({ freq: 1400 * r(), type: 'sine', dur: 0.16, vol: 0.08, slide: 500, at: 0.12 }); },
    slide() { a.tone({ freq: 180 * r(), type: 'triangle', dur: 0.03, vol: 0.05 }); },
    chomp() {
      a.noise({ dur: 0.09, vol: 0.32, filter: 900, type: 'lowpass' });
      a.tone({ freq: 150, type: 'square', dur: 0.08, vol: 0.12, slide: 70 });
      a.noise({ dur: 0.06, vol: 0.22, filter: 1400, type: 'lowpass', at: 0.13 });
      a.tone({ freq: 130, type: 'square', dur: 0.06, vol: 0.1, slide: 60, at: 0.13 });
      [523, 659, 784, 1047].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.1, at: 0.3 + i * 0.07 }));
    },
    // a purr: a low hum pulsing about 25 times a second
    purr(sec = 1.4) {
      const n = Math.round(sec * 24);
      for (let i = 0; i < n; i++) a.noise({ dur: 0.035, vol: 0.05 * (1 - i / n), filter: 260, type: 'lowpass', at: 0.5 + i / 24 });
    },
    crumble() {
      a.noise({ dur: 0.3, vol: 0.28, filter: 2400, type: 'bandpass', q: 0.5, slideFilter: 500 });
      [392, 330, 262].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.09, at: 0.1 + i * 0.09 }));
    },
    fall() { a.tone({ freq: 520, type: 'sine', dur: 0.5, vol: 0.12, slide: 150 }); },
    star(i) { const f = [659, 880, 1175][i] || 1175; a.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.08 }); a.tone({ freq: f * 2, type: 'triangle', dur: 0.24, vol: 0.1, at: 0.04 }); },
    site() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.12, at: i * 0.07 })); },
    select() { a.sfx('select'); },
    error() { a.sfx('error'); },
  };
}

// a cozy loop: soft triangle chords, a plucky melody, a lazy kick
export function createMusic() {
  // A major-ish, 92 bpm, 2 bars of 16 steps
  const M = [76, null, 73, null, 71, null, 69, null, 71, null, 73, 76, null, null, 74, null, 73, null, 71, null, 69, null, 66, null, 68, null, 69, null, null, null, null, null];
  const B = [45, null, null, null, 45, null, null, null, 42, null, null, null, 42, null, null, null, 38, null, null, null, 38, null, null, null, 40, null, null, null, 40, null, null, null];
  const P = [57, 61, 64, 61, 57, 61, 64, 61, 54, 57, 61, 57, 54, 57, 61, 57, 50, 54, 57, 54, 50, 54, 57, 54, 52, 56, 59, 56, 52, 56, 59, 56];
  return createLoopMusic({
    bpm: 92, steps: 16, bars: 2,
    tracks: [
      { type: 'triangle', vol: 0.05, notes: M, dur: 1.6 },
      { type: 'sine', vol: 0.09, notes: B, dur: 3.5 },
      { type: 'triangle', vol: 0.022, notes: P, dur: 0.9 },
    ],
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  });
}
