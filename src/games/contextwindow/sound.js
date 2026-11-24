// CONTEXT WINDOW: its sounds, made in the browser (the kit's Web Audio: no files). Every token is a note: its color picks
// the note and the thought she's holding climbs a pentatonic scale, so a long run is a rising melody; a commit plays the
// whole run back as an arpeggio and lands on a chord (higher with each link of the chain). Junk buzzes, shatters like
// glass; forgetting slides down. A small loop plays under it, faster each level.
import { createLoopMusic } from '../kit/audio.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const ROOT = [523.25, 587.33, 659.25, 698.46, 783.99];   // honey, pink, mint, sky, violet
const semi = (f, n) => f * 2 ** (n / 12);

export function createSound(audio) {
  const a = audio;
  let loop = null;
  return {
    eat(c, run) {
      const f = semi(ROOT[c] ?? 523.25, PENTA[Math.min(run, PENTA.length - 1)]);
      a.tone({ freq: f, type: 'triangle', dur: 0.11, vol: 0.2, attack: 0.003 });
      a.tone({ freq: f * 2, type: 'sine', dur: 0.06, vol: 0.06, at: 0.012 });
    },
    spam() {
      a.tone({ freq: 140, type: 'square', dur: 0.16, vol: 0.09, slide: 90, filter: 900 });
      a.noise({ dur: 0.1, vol: 0.08, filter: 700, type: 'bandpass', q: 2 });
    },
    commit(n, chain) {
      const up = Math.min(chain - 1, 4) * 2;
      const steps = Math.min(n, 8);
      for (let i = 0; i < steps; i++) a.tone({ freq: semi(523.25, PENTA[i] + up), type: 'square', dur: 0.07, vol: 0.06, at: i * 0.034, filter: 3200 });
      const t = steps * 0.034;
      a.chord([semi(523.25, up), semi(659.25, up), semi(783.99, up), semi(1046.5, up)], { dur: 0.42, type: 'triangle', vol: 0.09, at: t, strum: 0.012 });
      a.noise({ dur: 0.3, vol: 0.05 + Math.min(0.08, n * 0.01), filter: 5200, type: 'highpass', at: t });
      if (n >= 6) a.tone({ freq: 70, type: 'sine', dur: 0.4, vol: 0.28, slide: 40, at: t });
    },
    shatter() {
      a.noise({ dur: 0.22, vol: 0.14, filter: 6400, type: 'highpass' });
      [2093, 2637, 3136].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.12, vol: 0.05, at: 0.02 + i * 0.03 }));
    },
    join() { [784, 988, 1319, 1568].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.1, vol: 0.08, at: i * 0.05 })); },
    forget() {
      a.tone({ freq: 620, type: 'sine', dur: 0.5, vol: 0.18, slide: 180 });
      a.noise({ dur: 0.35, vol: 0.06, filter: 500, type: 'lowpass', at: 0.05 });
    },
    special(kind) {
      switch (kind) {
        case 'wild': [1047, 1319, 1568, 2093, 2637].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.09, vol: 0.08, at: i * 0.035 })); break;
        case 'clear': a.sfx('whoosh', { pitch: 1.2 }); a.tone({ freq: 880, type: 'triangle', dur: 0.2, vol: 0.08, slide: 1760 }); break;
        case 'boost': a.sfx('power'); break;
        case 'coffee': [0, 0.07, 0.15].forEach((t, i) => a.tone({ freq: 300 + i * 90, type: 'sine', dur: 0.06, vol: 0.12, at: t, slide: 500 + i * 90 })); break;
        case 'heart': a.tone({ freq: 659, type: 'triangle', dur: 0.12, vol: 0.14 }); a.tone({ freq: 988, type: 'triangle', dur: 0.22, vol: 0.14, at: 0.1 }); break;
        default: a.sfx('coin');
      }
    },
    chain(n) { a.tone({ freq: semi(880, n * 2), type: 'square', dur: 0.09, vol: 0.06, at: 0.3 }); },
    level() { a.sfx('levelup'); },
    wall() { a.tone({ freq: 220, type: 'square', dur: 0.1, vol: 0.07, filter: 1200 }); a.tone({ freq: 196, type: 'square', dur: 0.12, vol: 0.07, at: 0.1, filter: 1200 }); },
    expire() { a.tone({ freq: 330, type: 'sine', dur: 0.08, vol: 0.05, slide: 220 }); },
    turn() { a.tone({ freq: 1500, type: 'sine', dur: 0.018, vol: 0.025 }); },
    crash() { a.sfx('explode', { pitch: 1.1 }); setTimeout(() => a.sfx('lose'), 260); },
    start() { a.sfx('select'); },
    music(level) {
      if (!loop) {
        loop = createLoopMusic({
          bpm: 104, steps: 16, bars: 2,
          tracks: [
            { type: 'triangle', vol: 0.05, octave: -1, dur: 2, notes: [45, null, null, 45, null, null, 48, null, 41, null, null, 41, null, null, 43, null, 45, null, null, 45, null, null, 52, null, 50, null, null, 48, null, null, 47, null] },
            { type: 'square', vol: 0.018, filter: 1800, notes: [69, null, 72, null, 76, null, 72, null, 69, null, 72, null, 77, null, 76, null, 69, null, 72, null, 76, null, 79, null, 77, null, 76, null, 72, null, 71, null] },
          ],
          drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
        });
        a.music(loop);
      }
      loop.setBpm(Math.min(150, 104 + (level - 1) * 5));
    },
    stopMusic() { a.stopMusic(); loop = null; },
  };
}
