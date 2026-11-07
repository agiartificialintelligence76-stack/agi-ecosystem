// OVERCLOCK: the table's sounds, made in the browser (the kit's synth): the flippers' thwack, the cores' pops (each core
// its own note), rubber, slingshots, the fan whirring with its speed, the ramp, the socket, jackpots, multiball, a drain.
// And the music: a driving synth loop that runs faster in OVERCLOCK and changes for multiball and AGI MODE.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  const A = audio;
  let lastWall = 0, lastSpin = 0;
  const now = () => performance.now();
  return {
    flip() {
      A.noise({ dur: 0.05, vol: 0.32, filter: 1100, type: 'lowpass' });
      A.tone({ freq: 118, type: 'square', dur: 0.05, vol: 0.12, slide: 70, filter: 900 });
    },
    unflip() { A.noise({ dur: 0.03, vol: 0.1, filter: 700, type: 'lowpass' }); },
    flipHit(speed) {
      const v = Math.min(1, speed / 2500);
      A.noise({ dur: 0.04, vol: 0.12 + v * 0.18, filter: 2600, type: 'bandpass', q: 1.4 });
    },
    pop(i, hot) {
      const f = [523, 659, 784][i] * (hot ? 1.5 : 1);
      A.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.1, slide: f * 0.5, filter: 3200 });
      A.noise({ dur: 0.06, vol: 0.24, filter: 1800, type: 'bandpass', q: 0.8 });
      A.tone({ freq: 90, type: 'sine', dur: 0.08, vol: 0.22, slide: 50 });
    },
    sling() {
      A.tone({ freq: 330, type: 'square', dur: 0.1, vol: 0.09, slide: 165, filter: 2200 });
      A.noise({ dur: 0.07, vol: 0.22, filter: 900, type: 'lowpass' });
    },
    rubber(speed) {
      const v = Math.min(1, speed / 1800);
      A.tone({ freq: 196 + v * 80, type: 'triangle', dur: 0.09, vol: 0.06 + v * 0.12, slide: 300 + v * 120 });
    },
    wall(speed) {
      const t = now();
      if (t - lastWall < 35) return;
      lastWall = t;
      const v = Math.min(1, speed / 2200);
      A.noise({ dur: 0.035, vol: 0.05 + v * 0.16, filter: 1400 + v * 1600, type: 'lowpass' });
    },
    target() {
      A.noise({ dur: 0.07, vol: 0.28, filter: 2400, type: 'highpass' });
      A.tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.08, slide: 440 });
    },
    gpuAll() { [784, 988, 1175, 1568].forEach((f, i) => A.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.07, at: i * 0.05 })); },
    lane(i) { A.tone({ freq: [1319, 1480, 1760][i] || 1319, type: 'sine', dur: 0.14, vol: 0.14 }); A.tone({ freq: 2637, type: 'sine', dur: 0.05, vol: 0.04 }); },
    ramAll() { [1047, 1319, 1568, 2093].forEach((f, i) => A.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.12, at: i * 0.06 })); },
    spin(w) {
      const t = now();
      if (t - lastSpin < 28) return;
      lastSpin = t;
      const v = Math.min(1, Math.abs(w) / 30);
      A.noise({ dur: 0.025, vol: 0.06 + v * 0.06, filter: 1800 + v * 3000, type: 'bandpass', q: 3 });
      A.tone({ freq: 600 + v * 900, type: 'square', dur: 0.02, vol: 0.025 });
    },
    rampIn() { A.noise({ dur: 0.45, vol: 0.16, filter: 500, type: 'bandpass', q: 0.9, slideFilter: 3800 }); },
    ramp() { A.tone({ freq: 1568, type: 'square', dur: 0.08, vol: 0.08 }); A.tone({ freq: 2093, type: 'square', dur: 0.12, vol: 0.08, at: 0.07 }); },
    rampFail() { A.tone({ freq: 392, type: 'triangle', dur: 0.2, vol: 0.08, slide: 262 }); },
    orbit() { A.noise({ dur: 0.3, vol: 0.1, filter: 900, type: 'bandpass', q: 1.2, slideFilter: 2600 }); A.tone({ freq: 988, type: 'triangle', dur: 0.1, vol: 0.08, at: 0.1 }); },
    socket() { A.tone({ freq: 120, type: 'sine', dur: 0.18, vol: 0.32, slide: 60 }); A.noise({ dur: 0.1, vol: 0.2, filter: 600, type: 'lowpass' }); },
    kick() { A.noise({ dur: 0.08, vol: 0.28, filter: 1200, type: 'lowpass' }); A.tone({ freq: 220, type: 'square', dur: 0.06, vol: 0.1, slide: 440 }); },
    launch(p) { A.noise({ dur: 0.12, vol: 0.2 + p * 0.15, filter: 900 + p * 1600, type: 'lowpass' }); A.tone({ freq: 140 + p * 120, type: 'triangle', dur: 0.18, vol: 0.16, slide: 520 + p * 300 }); },
    pull() { A.tone({ freq: 220, type: 'triangle', dur: 0.04, vol: 0.04 }); },
    skill() { [784, 988, 1175, 1568, 1976].forEach((f, i) => A.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.08, at: i * 0.06 })); },
    lock() { [392, 523, 659].forEach((f, i) => A.tone({ freq: f, type: 'square', dur: 0.14, vol: 0.09, at: i * 0.1, filter: 2600 })); A.tone({ freq: 70, type: 'sine', dur: 0.3, vol: 0.25 }); },
    lit() { A.tone({ freq: 1175, type: 'triangle', dur: 0.08, vol: 0.1 }); A.tone({ freq: 1568, type: 'triangle', dur: 0.12, vol: 0.1, at: 0.08 }); },
    jackpot() {
      A.noise({ dur: 0.6, vol: 0.22, filter: 400, type: 'bandpass', q: 0.7, slideFilter: 5200 });
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => A.tone({ freq: f, type: 'square', dur: 0.16, vol: 0.08, at: 0.05 + i * 0.07, filter: 4200 }));
      A.chord([523, 659, 784, 1047], { dur: 0.7, type: 'triangle', vol: 0.07, at: 0.5 });
    },
    multiball() {
      for (let k = 0; k < 3; k++) [523, 659, 784, 1047].forEach((f, i) => A.tone({ freq: f * (1 + k * 0.125), type: 'square', dur: 0.08, vol: 0.07, at: k * 0.32 + i * 0.06, filter: 3600 }));
      A.tone({ freq: 60, type: 'sawtooth', dur: 1.0, vol: 0.12, slide: 240, filter: 900 });
    },
    overclock() {
      A.tone({ freq: 110, type: 'sawtooth', dur: 0.9, vol: 0.14, slide: 880, filter: 2600 });
      A.noise({ dur: 0.9, vol: 0.12, filter: 300, type: 'bandpass', q: 1, slideFilter: 4000 });
      A.chord([440, 554, 659, 880], { dur: 0.5, type: 'square', vol: 0.05, at: 0.75, filter: 3000 });
    },
    overclockEnd() { A.tone({ freq: 660, type: 'triangle', dur: 0.5, vol: 0.1, slide: 220 }); },
    mission() { A.tone({ freq: 659, type: 'triangle', dur: 0.1, vol: 0.1 }); A.tone({ freq: 988, type: 'triangle', dur: 0.16, vol: 0.1, at: 0.1 }); },
    missionDone() { A.sfx('levelup'); A.chord([784, 988, 1175], { dur: 0.4, type: 'triangle', vol: 0.08, at: 0.3 }); },
    agi() { for (let i = 0; i < 8; i++) A.tone({ freq: [523, 659, 784, 1047][i % 4] * (i < 4 ? 1 : 2), type: 'triangle', dur: 0.2, vol: 0.09, at: i * 0.08 }); A.chord([523, 659, 784, 988], { dur: 1.2, type: 'sine', vol: 0.08, at: 0.7 }); },
    save() { A.tone({ freq: 988, type: 'sine', dur: 0.12, vol: 0.12 }); A.tone({ freq: 1319, type: 'sine', dur: 0.2, vol: 0.12, at: 0.1 }); },
    extra() { A.sfx('win'); A.sfx('coin', { pitch: 1.2 }); },
    drain() { [392, 349, 311, 262, 196].forEach((f, i) => A.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.13, at: i * 0.11 })); A.tone({ freq: 98, type: 'sine', dur: 0.6, vol: 0.18, slide: 49, at: 0.4 }); },
    tilt() { A.tone({ freq: 140, type: 'sawtooth', dur: 0.7, vol: 0.18, filter: 900 }); A.tone({ freq: 147, type: 'sawtooth', dur: 0.7, vol: 0.18, filter: 900 }); },
    danger() { A.tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.08 }); A.tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.08, at: 0.14 }); },
    nudge() { A.noise({ dur: 0.12, vol: 0.25, filter: 260, type: 'lowpass' }); A.tone({ freq: 55, type: 'sine', dur: 0.14, vol: 0.25, slide: 40 }); },
    bonusTick(i) { A.tone({ freq: 523 * 2 ** (i / 12), type: 'square', dur: 0.05, vol: 0.06 }); },
    bonusTotal() { A.chord([523, 659, 784], { dur: 0.3, type: 'triangle', vol: 0.09 }); },
    serve() { A.tone({ freq: 196, type: 'triangle', dur: 0.08, vol: 0.08 }); A.noise({ dur: 0.08, vol: 0.12, filter: 500, type: 'lowpass', at: 0.05 }); },
    over() { A.sfx('lose'); },
  };
}

// the soundtrack: E minor, driving eighths. Normal · OVERCLOCK (faster, brighter) · MULTIBALL · AGI MODE (sweeter)
const BASS = [40, null, 40, 52, 40, null, 43, 45, 36, null, 36, 48, 38, null, 38, 50];
const LEAD_A = [64, null, 67, null, 71, null, 69, 67, 64, null, 62, null, 64, null, null, null, 64, null, 67, null, 71, null, 74, 72, 71, null, 69, null, 67, null, null, null];
const LEAD_B = [76, 74, 71, 74, 76, 79, 76, 74, 72, 71, 67, 71, 74, 72, 71, 69];
const ARP = [52, 55, 59, 64, 52, 55, 59, 64, 48, 52, 55, 60, 50, 54, 57, 62];
const kick4 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const snare = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const hats = [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1];
export function music(kind = 'normal') {
  if (kind === 'overclock') return createLoopMusic({ bpm: 150, steps: 16, bars: 2, tracks: [
    { type: 'sawtooth', vol: 0.05, notes: BASS, filter: 900 }, { type: 'square', vol: 0.028, notes: LEAD_B, octave: 0, filter: 3400 },
    { type: 'triangle', vol: 0.03, notes: ARP, octave: 1 },
  ], drums: { kick: kick4, snare, hat: hats.map(() => 1) } });
  if (kind === 'multiball') return createLoopMusic({ bpm: 140, steps: 16, bars: 2, tracks: [
    { type: 'sawtooth', vol: 0.05, notes: BASS, filter: 1000 }, { type: 'square', vol: 0.03, notes: LEAD_B, filter: 3000 },
  ], drums: { kick: kick4, snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0], hat: hats } });
  if (kind === 'agi') return createLoopMusic({ bpm: 132, steps: 16, bars: 2, tracks: [
    { type: 'triangle', vol: 0.055, notes: BASS.map((n) => (n == null ? null : n + 12)) },
    { type: 'sine', vol: 0.05, notes: LEAD_A, octave: 1 }, { type: 'triangle', vol: 0.03, notes: ARP, octave: 1 },
  ], drums: { kick: kick4, hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] } });
  return createLoopMusic({ bpm: 128, steps: 16, bars: 2, tracks: [
    { type: 'sawtooth', vol: 0.045, notes: BASS, filter: 700 }, { type: 'square', vol: 0.022, notes: LEAD_A, filter: 2400 },
  ], drums: { kick: kick4, snare, hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] } });
}
