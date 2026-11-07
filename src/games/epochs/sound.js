// EPOCHS: its sounds, made in the browser with the kit's synth (no files), and a soft lab loop for the music.
import { createLoopMusic } from '../kit/audio.js';

export function createSfx(a) {
  let stepN = 0;
  const api = {
    step(t = 0) { stepN++; a.tone({ freq: 392 * 2 ** ((t % 8) / 24), type: 'triangle', dur: 0.05, vol: 0.09, slide: 470 * 2 ** ((t % 8) / 24) }); a.noise({ dur: 0.025, vol: 0.05, filter: 2400, type: 'highpass' }); },
    wait() { a.tone({ freq: 660, type: 'sine', dur: 0.04, vol: 0.05 }); },
    bump() { a.tone({ freq: 130, type: 'square', dur: 0.06, vol: 0.08, slide: 90, filter: 900 }); },
    push() { a.noise({ dur: 0.13, vol: 0.16, filter: 700, type: 'lowpass', slideFilter: 260 }); a.tone({ freq: 110, type: 'triangle', dur: 0.1, vol: 0.12, slide: 80 }); },
    plate(on) { a.noise({ dur: 0.02, vol: 0.15, filter: 3500, type: 'highpass' }); a.tone({ freq: on ? 520 : 400, type: 'sine', dur: 0.1, vol: 0.12, slide: on ? 780 : 300 }); },
    door(open) {
      if (open) { a.noise({ dur: 0.2, vol: 0.1, filter: 500, type: 'bandpass', q: 0.8, slideFilter: 2200 }); a.tone({ freq: 196, type: 'triangle', dur: 0.16, vol: 0.12, slide: 294 }); }
      else { a.tone({ freq: 98, type: 'sine', dur: 0.16, vol: 0.28, slide: 55 }); a.noise({ dur: 0.08, vol: 0.18, filter: 600, type: 'lowpass' }); }
    },
    toggle() { a.sfx('select', { pitch: 1.1 }); },
    timer() { [0, 0.07, 0.14].forEach((t) => a.tone({ freq: 1320, type: 'square', dur: 0.025, vol: 0.05, at: t })); },
    desync() { [0, 0.05, 0.1].forEach((t, i) => a.tone({ freq: [880, 620, 990][i], type: 'square', dur: 0.03, vol: 0.05, at: t })); },
    deprecate() { a.tone({ freq: 880, type: 'sawtooth', dur: 0.32, vol: 0.08, slide: 110, filter: 2600 }); a.noise({ dur: 0.25, vol: 0.1, filter: 4000, type: 'highpass' }); },
    zap() { a.sfx('hurt'); a.noise({ dur: 0.3, vol: 0.16, filter: 5200, type: 'highpass' }); },
    rewind() { a.noise({ dur: 0.5, vol: 0.14, filter: 3800, type: 'bandpass', q: 0.9, slideFilter: 300 }); a.tone({ freq: 1046, type: 'triangle', dur: 0.45, vol: 0.08, slide: 196 }); },
    spawn(i, live) { a.tone({ freq: (live ? 1047 : 659) * 2 ** (i / 12), type: 'triangle', dur: 0.12, vol: 0.09 }); a.tone({ freq: (live ? 1568 : 988) * 2 ** (i / 12), type: 'sine', dur: 0.1, vol: 0.06, at: 0.05 }); },
    undo() { a.tone({ freq: 523, type: 'triangle', dur: 0.05, vol: 0.08, slide: 392 }); },
    win() { a.sfx('levelup'); },
    star(i) { a.tone({ freq: [784, 988, 1319][i] || 1319, type: 'square', dur: 0.08, vol: 0.08 }); a.tone({ freq: ([784, 988, 1319][i] || 1319) * 1.5, type: 'triangle', dur: 0.2, vol: 0.08, at: 0.06 }); },
    world() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.1, at: i * 0.08 })); },
    out() { a.sfx('lose'); },
    select() { a.sfx('select'); },
    back() { a.sfx('back'); },
  };
  return api;
}

// a quiet lab loop: a soft arpeggio over a slow pulse
export function createMusic() {
  const n = null;
  return createLoopMusic({
    bpm: 88, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.035, dur: 1, notes: [
        69, n, 72, n, 76, n, 72, n, 69, n, 72, n, 76, n, 79, n,
        65, n, 69, n, 72, n, 69, n, 65, n, 69, n, 72, n, 74, n,
        67, n, 71, n, 74, n, 71, n, 67, n, 71, n, 74, n, 76, n,
        64, n, 67, n, 71, n, 67, n, 64, n, 67, n, 71, n, 72, n] },
      { type: 'sine', vol: 0.06, dur: 6, octave: -1, notes: [
        57, n, n, n, n, n, n, n, 57, n, n, n, n, n, n, n,
        53, n, n, n, n, n, n, n, 53, n, n, n, n, n, n, n,
        55, n, n, n, n, n, n, n, 55, n, n, n, n, n, n, n,
        52, n, n, n, n, n, n, n, 52, n, n, n, n, n, n, n] },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  });
}
