// WEB SCRAPER: its sounds (the kit's Web Audio, no files). Small things go down with a little gulp whose pitch falls as
// things get bigger; big ones rumble; swallowing a rival is a deep whoomp and a chord; being swallowed slides down into
// the dark. The last ten seconds tick. A bouncy loop plays under the round.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  const a = audio;
  let loop = null, last = 0, streak = 0, lastT = 0;
  return {
    eat(r, value) {
      const now = performance.now();
      if (now - last < 35) return;
      streak = now - lastT < 400 ? Math.min(12, streak + 1) : 0;
      last = now; lastT = now;
      const f = Math.max(90, 900 / (1 + r * 1.6)) * 2 ** (streak / 24);
      a.tone({ freq: f, type: 'sine', dur: 0.09 + Math.min(0.25, r * 0.08), vol: 0.14, slide: f * 0.45 });
      if (r > 1.4) { a.tone({ freq: 70, type: 'sine', dur: 0.4, vol: 0.3, slide: 35 }); a.noise({ dur: 0.35, vol: 0.12, filter: 500, slideFilter: 90 }); }
    },
    swallow() { a.tone({ freq: 120, type: 'sine', dur: 0.5, vol: 0.35, slide: 40 }); a.chord([523, 659, 784, 1047], { dur: 0.4, type: 'triangle', vol: 0.09, at: 0.15, strum: 0.04 }); },
    eaten() { a.tone({ freq: 500, type: 'sawtooth', dur: 0.8, vol: 0.12, slide: 60, filter: 1200 }); a.noise({ dur: 0.6, vol: 0.1, filter: 900, slideFilter: 100 }); },
    back() { a.sfx('power'); },
    found() { [1047, 1319, 1568].forEach((f, i) => a.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.06, at: i * 0.05 })); },
    tick() { a.tone({ freq: 1200, type: 'square', dur: 0.03, vol: 0.05 }); },
    end(win) { a.sfx(win ? 'win' : 'lose'); },
    start() { a.sfx('select'); },
    music() {
      if (loop) return;
      loop = createLoopMusic({
        bpm: 124, steps: 16, bars: 2,
        tracks: [
          { type: 'triangle', vol: 0.05, octave: -1, notes: [48, null, 48, 55, null, 48, 58, null, 46, null, 46, 53, null, 46, 57, null, 44, null, 44, 51, null, 44, 55, null, 43, null, 43, 50, null, 47, 50, 53] },
          { type: 'square', vol: 0.016, filter: 2600, notes: [72, null, 75, null, 79, null, 77, 75, 70, null, 74, null, 77, null, 74, null, 68, null, 72, null, 75, null, 72, 70, 67, null, 71, null, 74, null, 77, null] },
        ],
        drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] },
      });
      a.music(loop);
    },
    stopMusic() { a.stopMusic(); loop = null; },
  };
}
