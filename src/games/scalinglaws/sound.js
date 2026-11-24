// SCALING LAWS: its sounds (the kit's Web Audio, no files). A good gate is a rising run of notes (higher for ×3 than for
// +5), a bad one a falling buzz; parameters knocked off tick like popcorn; a rival fight is a rattle of clashes; each
// benchmark step is one note higher; crystals chime. A synthwave loop drives it along.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  const a = audio;
  let loop = null, lastPop = 0, lastClash = 0;
  return {
    gate(op, good) {
      if (good) {
        const notes = op.t === 'x' ? (op.v >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047]) : [523, 659, 784];
        notes.forEach((f, i) => a.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.07, at: i * 0.045, filter: 3600 }));
        a.tone({ freq: notes[notes.length - 1] * 2, type: 'sine', dur: 0.3, vol: 0.06, at: notes.length * 0.045 });
      } else {
        a.tone({ freq: 330, type: 'sawtooth', dur: 0.35, vol: 0.1, slide: 110, filter: 1200 });
        a.tone({ freq: 196, type: 'square', dur: 0.25, vol: 0.06, at: 0.08, slide: 98, filter: 800 });
      }
    },
    pop() {
      const now = performance.now();
      if (now - lastPop < 45) return;
      lastPop = now;
      a.tone({ freq: 700 + Math.random() * 500, type: 'sine', dur: 0.04, vol: 0.06, slide: 300 });
    },
    clash() {
      const now = performance.now();
      if (now - lastClash < 60) return;
      lastClash = now;
      a.noise({ dur: 0.05, vol: 0.12, filter: 2400 + Math.random() * 2000, type: 'bandpass', q: 2 });
      a.tone({ freq: 180 + Math.random() * 80, type: 'square', dur: 0.04, vol: 0.05, filter: 900 });
    },
    beat() { a.sfx('combo'); },
    gem() { a.sfx('coin', { pitch: 1.1 }); },
    step(i) { a.tone({ freq: 392 * 2 ** (i * 2 / 12), type: 'triangle', dur: 0.14, vol: 0.13 }); a.tone({ freq: 784 * 2 ** (i * 2 / 12), type: 'sine', dur: 0.1, vol: 0.05, at: 0.02 }); },
    won() { a.sfx('win'); setTimeout(() => a.sfx('levelup'), 380); },
    lose() { a.sfx('lose'); a.noise({ dur: 0.5, vol: 0.12, filter: 600, slideFilter: 120 }); },
    go() { a.sfx('power'); },
    upgrade() { a.sfx('levelup', { pitch: 1.2 }); },
    music() {
      if (loop) return;
      loop = createLoopMusic({
        bpm: 118, steps: 16, bars: 2,
        tracks: [
          { type: 'sawtooth', vol: 0.03, octave: -1, filter: 900, notes: [45, 45, 57, 45, 45, 57, 45, 57, 43, 43, 55, 43, 43, 55, 43, 55, 41, 41, 53, 41, 41, 53, 41, 53, 40, 40, 52, 40, 43, 55, 43, 55] },
          { type: 'square', vol: 0.016, filter: 2400, dur: 2, notes: [69, null, 72, null, 76, null, 74, null, 72, null, 71, null, 67, null, 71, null, 69, null, 72, null, 77, null, 76, null, 74, null, 72, null, 71, null, 74, null] },
        ],
        drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
      });
      a.music(loop);
    },
    stopMusic() { a.stopMusic(); loop = null; },
  };
}
