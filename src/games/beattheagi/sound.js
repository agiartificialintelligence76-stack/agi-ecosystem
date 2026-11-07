// BEAT THE AGI (2026-11-08): its sounds, made in the browser with the kit's synth (no files). A stone's clack lower and
// fuller the further it fell (yours a woody tock, hers a bright digital one), a soft blip for each depth she reaches
// (climbing as she looks deeper), a lock-in when she commits, the end of a game. Silent in a demo and when sound is off.
import { createLoopMusic } from '../kit/audio.js';

export function createSfx(audio) {
  const j = (k = 0.03) => 1 + (Math.random() * 2 - 1) * k;
  let lastHover = 0, lastBlip = 0;
  return {
    // a stone hit the stack after falling `rows` cells (0..6.5); who: 1 pink, 2 mint
    clack(rows, who) {
      const fall = Math.min(1, rows / 6.5);
      const p = (1.18 - fall * 0.32) * j(0.025);
      const vol = 0.16 + fall * 0.2;
      if (who === 1) {
        audio.tone({ freq: 340 * p, type: 'triangle', dur: 0.07, vol: vol * 0.9, slide: 170 * p, attack: 0.001 });
        audio.noise({ dur: 0.045, vol: vol * 0.55, filter: 2600 * p, type: 'bandpass', q: 1.3 });
      } else {
        audio.tone({ freq: 520 * p, type: 'sine', dur: 0.08, vol: vol * 0.85, slide: 260 * p, attack: 0.001 });
        audio.tone({ freq: 1560 * p, type: 'square', dur: 0.025, vol: vol * 0.12, attack: 0.001 });
        audio.noise({ dur: 0.04, vol: vol * 0.45, filter: 4200 * p, type: 'bandpass', q: 1.6 });
      }
      audio.tone({ freq: 90 * p, type: 'sine', dur: 0.1, vol: 0.12 + fall * 0.16, slide: 55, attack: 0.002 });
    },
    // a stone let go (a soft click, then the fall)
    drop(who) {
      audio.tone({ freq: (who === 1 ? 1180 : 1560) * j(), type: 'triangle', dur: 0.03, vol: 0.05, attack: 0.001 });
      audio.noise({ dur: 0.16, vol: 0.035, filter: 900, type: 'bandpass', q: 0.9, slideFilter: 2600 });
    },
    bounce(who) {
      audio.tone({ freq: (who === 1 ? 420 : 640) * j(), type: who === 1 ? 'triangle' : 'sine', dur: 0.04, vol: 0.06, attack: 0.001 });
    },
    hover(col) {
      const now = performance.now();
      if (now - lastHover < 35) return;
      lastHover = now;
      audio.tone({ freq: 880 + col * 70, type: 'sine', dur: 0.025, vol: 0.035, attack: 0.001 });
    },
    // she finished looking `depth` deep
    blip(depth, level) {
      const now = performance.now();
      if (now - lastBlip < 45) return;
      lastBlip = now;
      const f = 520 * 2 ** (Math.min(depth, 24) / 14) * (level >= 5 ? 1.5 : 1);
      audio.tone({ freq: f, type: level >= 4 ? 'sine' : 'triangle', dur: 0.035, vol: 0.03, attack: 0.002 });
    },
    commit(level) {
      const p = level >= 5 ? 1.25 : 1;
      audio.tone({ freq: 660 * p, type: 'square', dur: 0.045, vol: 0.05, filter: 3000 });
      audio.tone({ freq: 990 * p, type: 'square', dur: 0.08, vol: 0.05, filter: 3000, at: 0.045 });
    },
    nope() {
      audio.tone({ freq: 210, type: 'square', dur: 0.06, vol: 0.05, filter: 900 });
      audio.tone({ freq: 180, type: 'square', dur: 0.08, vol: 0.05, filter: 900, at: 0.07 });
    },
    threat() {
      audio.tone({ freq: 392, type: 'triangle', dur: 0.12, vol: 0.08 });
      audio.tone({ freq: 370, type: 'triangle', dur: 0.16, vol: 0.08, at: 0.13 });
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.1, at: i * 0.075 }));
      audio.chord([523, 659, 784, 1047], { type: 'sine', dur: 0.8, vol: 0.05, at: 0.36 });
      audio.noise({ dur: 0.6, vol: 0.05, filter: 5000, type: 'highpass', slideFilter: 11000, at: 0.3 });
    },
    // her win: a soft glitch, then a little descending chime
    lose() {
      audio.tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.05, filter: 2400, slide: 220 });
      audio.noise({ dur: 0.18, vol: 0.06, filter: 3000, type: 'bandpass', q: 3, slideFilter: 600, at: 0.05 });
      [659, 523, 440, 330].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.09, at: 0.18 + i * 0.11 }));
    },
    draw() { audio.chord([392, 494, 587], { type: 'triangle', dur: 0.45, vol: 0.07, strum: 0.05 }); },
    promote() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.05, at: i * 0.06, filter: 3600 }));
      audio.chord([523, 784, 1047], { type: 'sine', dur: 0.9, vol: 0.05, at: 0.4 });
    },
    undo() { audio.tone({ freq: 600, type: 'triangle', dur: 0.1, vol: 0.07, slide: 380 }); },
  };
}

// A quiet loop while a game is on (the arcade's Music switch turns it off): a board-game-night lounge in A minor,
// Am9 · Fmaj7 · Cmaj7 · E7sus, a muted pluck, a round bass, a brushed hat. Made of notes, no files.
const _ = null;
export function createMusic() {
  return createLoopMusic({
    bpm: 88, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.03, dur: 1.6, filter: 2200, notes: [
        69, _, 72, _, 76, _, 71, _, _, _, 72, _, 76, _, 79, _,
        65, _, 69, _, 72, _, 76, _, _, _, 72, _, 69, _, 72, _,
        67, _, 71, _, 72, _, 76, _, _, _, 74, _, 71, _, 67, _,
        64, _, 68, _, 71, _, 74, _, _, _, 71, _, 69, _, 68, _] },
      { type: 'sine', vol: 0.02, dur: 15, attack: 0.3, notes: [
        60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 56, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _] },
      { type: 'triangle', vol: 0.055, dur: 4, filter: 800, notes: [
        45, _, _, _, _, _, 45, _, _, _, 52, _, _, _, _, _, 41, _, _, _, _, _, 41, _, _, _, 48, _, _, _, _, _,
        48, _, _, _, _, _, 48, _, _, _, 43, _, _, _, _, _, 40, _, _, _, _, _, 40, _, _, _, 47, _, _, _, 44, _] },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 1] },
  });
}
