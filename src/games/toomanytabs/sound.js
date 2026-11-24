// TOO MANY TABS: its sounds (the kit's Web Audio, no files). A tab picked is a soft "tock" whose note rises when it makes
// a pair; three alike close with a little chime that climbs with the streak; a blocked tab is a dull knock; a frozen
// taskbar is a glitchy fall. A gentle loop plays under the boards.
import { createLoopMusic } from '../kit/audio.js';

const NOTE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
export function createSound(audio) {
  const a = audio;
  let loop = null;
  return {
    pick(count) {
      const f = count >= 2 ? 784 : 523;
      a.noise({ dur: 0.025, vol: 0.14, filter: 2600, type: 'bandpass', q: 1.2 });
      a.tone({ freq: f, type: 'triangle', dur: 0.09, vol: 0.16, slide: f * 1.06 });
    },
    land() { a.tone({ freq: 220, type: 'sine', dur: 0.05, vol: 0.12 }); },
    triple(combo) {
      const up = Math.min(4, combo - 1);
      [0, 2, 4].forEach((n, i) => a.tone({ freq: NOTE[n + up] || 1568, type: 'triangle', dur: 0.16, vol: 0.12, at: i * 0.05 }));
      a.tone({ freq: (NOTE[up + 5] || 2093) * 2, type: 'sine', dur: 0.25, vol: 0.05, at: 0.15 });
      a.noise({ dur: 0.16, vol: 0.06, filter: 6000, type: 'highpass', at: 0.12 });
    },
    blocked() { a.tone({ freq: 140, type: 'square', dur: 0.06, vol: 0.08, filter: 600 }); a.noise({ dur: 0.05, vol: 0.08, filter: 500 }); },
    full() { a.tone({ freq: 440, type: 'sawtooth', dur: 0.6, vol: 0.12, slide: 90, filter: 1400 }); [0, 0.08, 0.16].forEach((t) => a.noise({ dur: 0.05, vol: 0.1, filter: 3000, type: 'bandpass', at: t })); },
    clear(stars) { a.sfx('win'); [0, 1, 2].slice(0, stars).forEach((i) => a.tone({ freq: 1046.5 * (1 + i * 0.25), type: 'square', dur: 0.12, vol: 0.06, at: 0.45 + i * 0.16 })); },
    undo() { a.tone({ freq: 660, type: 'triangle', dur: 0.12, vol: 0.12, slide: 440 }); },
    shuffle() { a.sfx('whoosh'); for (let i = 0; i < 6; i++) a.tone({ freq: 500 + i * 120, type: 'sine', dur: 0.05, vol: 0.05, at: i * 0.03 }); },
    out() { a.tone({ freq: 330, type: 'triangle', dur: 0.18, vol: 0.12, slide: 660 }); },
    revive() { a.sfx('power'); },
    tick() { a.tone({ freq: 1400, type: 'sine', dur: 0.03, vol: 0.05 }); },
    start() { a.sfx('select'); },
    music() {
      if (loop) return;
      loop = createLoopMusic({
        bpm: 92, steps: 16, bars: 2,
        tracks: [
          { type: 'triangle', vol: 0.045, octave: -1, dur: 3, notes: [48, null, null, null, 55, null, null, null, 53, null, null, null, 50, null, null, null, 48, null, null, null, 55, null, null, null, 57, null, null, null, 55, null, null, null] },
          { type: 'sine', vol: 0.03, notes: [72, null, 76, 79, null, 76, null, 74, 72, null, 74, 76, null, null, 79, null, 81, null, 79, 76, null, 74, null, 72, 74, null, 76, null, 79, null, null, null] },
        ],
        drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
      });
      a.music(loop);
    },
    stopMusic() { a.stopMusic(); loop = null; },
  };
}
