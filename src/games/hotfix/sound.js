// HOTFIX: its sounds (the kit's Web Audio, no files). Every swap of the held chip ticks a little higher; every combo pops
// one note further up a bright scale; hits thud (with a sparkle when the bug is weak to them); a squashed bug splats;
// a bite crunches; Debug chimes; junk glitches; a floor cleared gets a fanfare. A punchy loop plays under it.
import { createLoopMusic } from '../kit/audio.js';

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760, 2093];
export function createSound(audio) {
  const a = audio;
  let loop = null;
  return {
    pick() { a.tone({ freq: 440, type: 'triangle', dur: 0.06, vol: 0.12, slide: 660 }); },
    swap(n) { a.tone({ freq: 300 * 2 ** (Math.min(n, 24) / 24), type: 'square', dur: 0.03, vol: 0.05, filter: 2200 }); },
    combo(n) { const f = SCALE[Math.min(n - 1, SCALE.length - 1)]; a.tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.14 }); a.tone({ freq: f * 2, type: 'sine', dur: 0.08, vol: 0.05, at: 0.02 }); a.noise({ dur: 0.06, vol: 0.05, filter: 6000, type: 'highpass' }); },
    hit(weak) { a.noise({ dur: 0.08, vol: 0.22, filter: 1400, type: 'lowpass' }); a.tone({ freq: 150, type: 'square', dur: 0.06, vol: 0.1, slide: 80 }); if (weak) a.tone({ freq: 1568, type: 'sine', dur: 0.12, vol: 0.07, slide: 2349 }); },
    kill() { a.tone({ freq: 220, type: 'sawtooth', dur: 0.18, vol: 0.12, slide: 60, filter: 1600 }); a.noise({ dur: 0.25, vol: 0.18, filter: 900 }); setTimeout(() => a.sfx('coin'), 120); },
    bite() { a.noise({ dur: 0.14, vol: 0.3, filter: 2600, type: 'bandpass', q: 0.9 }); a.tone({ freq: 110, type: 'square', dur: 0.12, vol: 0.14, slide: 55 }); },
    heal() { [880, 1108.7, 1318.5].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.14, vol: 0.09, at: i * 0.05 })); },
    glitch() { for (let i = 0; i < 5; i++) a.tone({ freq: 200 + Math.random() * 1200, type: 'square', dur: 0.03, vol: 0.06, at: i * 0.03 }); },
    lock() { a.tone({ freq: 700, type: 'square', dur: 0.05, vol: 0.08 }); a.tone({ freq: 520, type: 'square', dur: 0.08, vol: 0.08, at: 0.06 }); },
    shield() { a.tone({ freq: 330, type: 'sine', dur: 0.3, vol: 0.1, slide: 660 }); },
    floor() { a.sfx('win'); },
    patch() { a.sfx('levelup'); },
    crash() { a.sfx('explode'); setTimeout(() => a.sfx('lose'), 250); },
    start() { a.sfx('select'); },
    music() {
      if (loop) return;
      loop = createLoopMusic({
        bpm: 112, steps: 16, bars: 2,
        tracks: [
          { type: 'triangle', vol: 0.05, octave: -1, notes: [45, null, 45, null, 52, null, 45, 48, 43, null, 43, null, 50, null, 43, 47, 41, null, 41, null, 48, null, 41, 45, 40, null, 40, null, 47, null, 44, 47] },
          { type: 'square', vol: 0.015, filter: 2400, notes: [69, 72, 76, null, 74, null, 72, null, 67, 71, 74, null, 72, null, 71, null, 65, 69, 72, null, 74, null, 76, null, 64, 68, 71, null, 76, null, 74, null] },
        ],
        drums: { kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0], hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1] },
      });
      a.music(loop);
    },
    stopMusic() { a.stopMusic(); loop = null; },
  };
}
