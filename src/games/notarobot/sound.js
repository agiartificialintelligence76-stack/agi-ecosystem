// I'M NOT A ROBOT: its sounds, made in the browser with the kit's synth (no files). A whoosh and a two-note "ready?"
// for each command, a stamp's thud and a happy jingle that climbs with the tempo for a pass, a buzzer for a fail, an
// alarm bell as a suspicion light comes on, and little clicks, pops and splats for the checks themselves. The kit keeps
// them silent in a demo and when the player turned sound off. And a small chiptune loop that speeds up with the tempo.
import { createLoopMusic } from '../kit/audio.js';

export function createSfx(audio) {
  const j = (k = 0.03) => 1 + (Math.random() * 2 - 1) * k;
  let lastTick = 0;
  const S = {
    bumper(tempo = 1) {
      const p = 1 + (tempo - 1) * 0.045;
      audio.noise({ dur: 0.16, vol: 0.12, filter: 500, type: 'bandpass', q: 0.9, slideFilter: 3800 });
      audio.tone({ freq: 523 * p, type: 'square', dur: 0.06, vol: 0.07, filter: 2600 });
      audio.tone({ freq: 784 * p, type: 'square', dur: 0.09, vol: 0.07, filter: 2600, at: 0.07 });
    },
    slam() {
      audio.tone({ freq: 150, type: 'sine', dur: 0.14, vol: 0.32, slide: 55, attack: 0.002 });
      audio.noise({ dur: 0.07, vol: 0.12, filter: 1400, type: 'lowpass' });
    },
    pass(tempo = 1, bonus = 0, streak = 0) {
      const p = 1 + (tempo - 1) * 0.06 + Math.min(streak, 12) * 0.025;
      audio.noise({ dur: 0.06, vol: 0.2, filter: 900, type: 'lowpass' });
      audio.tone({ freq: 110, type: 'sine', dur: 0.12, vol: 0.3, slide: 60, attack: 0.002 });
      audio.tone({ freq: 784 * p, type: 'triangle', dur: 0.1, vol: 0.15, at: 0.05 });
      audio.tone({ freq: 1175 * p, type: 'triangle', dur: 0.2, vol: 0.15, at: 0.13 });
      if (bonus) audio.tone({ freq: 1568 * p, type: 'square', dur: 0.08, vol: 0.05, at: 0.22, filter: 4000 });
    },
    fail() {
      audio.tone({ freq: 140, type: 'square', dur: 0.36, vol: 0.12, filter: 1300 });
      audio.tone({ freq: 147, type: 'sawtooth', dur: 0.36, vol: 0.08, filter: 900 });
      audio.noise({ dur: 0.08, vol: 0.12, filter: 700, type: 'lowpass' });
    },
    light() {
      audio.tone({ freq: 1320, type: 'sine', dur: 0.24, vol: 0.12, at: 0.1 });
      audio.tone({ freq: 990, type: 'sine', dur: 0.3, vol: 0.1, at: 0.22 });
    },
    best() { [659, 784, 988, 1319, 1568].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.1, vol: 0.06, at: 0.25 + i * 0.07, filter: 3600 })); },
    repair() { [784, 988, 1175, 1568].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.09, at: 0.1 + i * 0.06 })); },
    tempo() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.07, at: i * 0.055, filter: 3600 }));
      audio.noise({ dur: 0.4, vol: 0.08, filter: 800, type: 'bandpass', q: 0.7, slideFilter: 6000 });
    },
    boss() {
      audio.chord([196, 233, 294], { type: 'sawtooth', dur: 0.7, vol: 0.06, filter: 1500 });
      audio.tone({ freq: 98, type: 'sine', dur: 0.6, vol: 0.3, slide: 49, attack: 0.002 });
      audio.noise({ dur: 0.5, vol: 0.12, filter: 600, type: 'lowpass', slideFilter: 120 });
      audio.chord([294, 349, 440], { type: 'square', dur: 0.4, vol: 0.04, filter: 2200, at: 0.5 });
    },
    step() { audio.tone({ freq: 880, type: 'triangle', dur: 0.08, vol: 0.12 }); audio.tone({ freq: 1320, type: 'triangle', dur: 0.12, vol: 0.1, at: 0.06 }); },
    caught() {
      for (let i = 0; i < 3; i++) audio.tone({ freq: 660, type: 'sawtooth', dur: 0.22, vol: 0.06, slide: 990, filter: 2400, at: i * 0.26 });
      [392, 330, 262, 196].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.12, at: 0.8 + i * 0.13 }));
    },
    fuse() {
      const now = performance.now();
      if (now - lastTick < 200) return;
      lastTick = now;
      audio.tone({ freq: 1600, type: 'square', dur: 0.02, vol: 0.035, filter: 5000 });
    },
    // the checks' own sounds (their `fx` events)
    fx(type, e = {}) {
      switch (type) {
        case 'tick': case 'snap':
          audio.noise({ dur: 0.02, vol: 0.22, filter: 4200, type: 'highpass' });
          audio.tone({ freq: 1250 * j(), type: 'triangle', dur: 0.06, vol: 0.14 });
          break;
        case 'good': audio.sfx('pop', { pitch: 1.1 }); break;
        case 'bad': audio.tone({ freq: 220, type: 'square', dur: 0.1, vol: 0.08, filter: 1200 }); break;
        case 'nope': audio.tone({ freq: 260 * j(), type: 'square', dur: 0.07, vol: 0.06, filter: 1100 }); audio.tone({ freq: 230, type: 'square', dur: 0.08, vol: 0.06, filter: 1100, at: 0.07 }); break;
        case 'whiff': audio.noise({ dur: 0.1, vol: 0.06, filter: 1200, type: 'bandpass', q: 1, slideFilter: 3000 }); break;
        case 'grab': audio.tone({ freq: 520 * j(), type: 'triangle', dur: 0.05, vol: 0.08, slide: 700 }); break;
        case 'type': audio.tone({ freq: (600 + (e.n || 1) * 90) * j(0.01), type: 'square', dur: 0.05, vol: 0.06, filter: 3000 }); audio.noise({ dur: 0.015, vol: 0.12, filter: 5000, type: 'highpass' }); break;
        case 'mash': audio.tone({ freq: 330 * 2 ** ((e.n || 1) / 12) , type: 'triangle', dur: 0.07, vol: 0.16, slide: 520 * 2 ** ((e.n || 1) / 12) }); break;
        case 'turn': audio.tone({ freq: 700 * j(), type: 'triangle', dur: 0.05, vol: 0.09, slide: 900 }); break;
        case 'hold': audio.tone({ freq: 300, type: 'triangle', dur: 0.08, vol: 0.1, slide: 380 }); break;
        case 'splat':
          audio.noise({ dur: 0.09, vol: 0.28, filter: 1600 * j(), type: 'lowpass' });
          audio.tone({ freq: 180 * j(), type: 'sine', dur: 0.08, vol: 0.18, slide: 70 });
          break;
        case 'no': audio.tone({ freq: (520 - (e.n % 2) * 60) * j(0.01), type: 'square', dur: 0.06, vol: 0.06, filter: 2400 }); break;
        case 'scribble': audio.noise({ dur: 0.05, vol: 0.05, filter: 3500 * j(0.2), type: 'bandpass', q: 2 }); break;
        case 'pant': audio.tone({ freq: 480, type: 'sine', dur: 0.12, vol: 0.06, slide: 300 }); break;
        default: break;
      }
    },
  };
  return S;
}

// The loop: a bouncy little chiptune in C, two bars, faster with every tempo (setBpm). The arcade's Music switch turns
// it off; a demo never plays it.
const _ = null;
export function createMusic(bpm = 116) {
  return createLoopMusic({
    bpm, steps: 16, bars: 4,
    tracks: [
      { type: 'square', vol: 0.03, dur: 0.8, filter: 2600, notes: [
        72, _, 76, _, 79, _, 76, _, 74, _, 77, _, 81, _, 77, _,
        72, _, 76, _, 79, _, 84, _, 83, _, 79, _, 76, _, 74, _,
        69, _, 72, _, 76, _, 72, _, 71, _, 74, _, 77, _, 74, _,
        72, _, 76, _, 79, _, 76, _, 74, _, 71, _, 67, _, _, _] },
      { type: 'triangle', vol: 0.07, dur: 1.6, filter: 1100, notes: [
        48, _, _, _, 48, _, 55, _, 50, _, _, _, 50, _, 57, _,
        48, _, _, _, 48, _, 55, _, 55, _, _, _, 55, _, 50, _,
        45, _, _, _, 45, _, 52, _, 50, _, _, _, 50, _, 53, _,
        48, _, _, _, 48, _, 55, _, 43, _, _, _, 47, _, 50, _] },
    ],
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0] },
  });
}
