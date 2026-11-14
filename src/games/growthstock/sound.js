// GROWTH STOCK: its sound, all made in the browser (the arcade kit's audio: no files). Each crop harvested plucks a note
// up a bright scale; each unit sold is a small coin, higher when the rate is over its usual; a bumper sparkles; the bear
// grumbles; the bull stampedes; a bell at the close. A light country loop plays under the day and thins out at night.
// Nothing here was heard by its author (it was written in a silent workspace): the notes are from theory, the volumes
// kept modest.
import { createLoopMusic } from '../kit/audio.js';

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
const CROP_NOTE = { gme: 0, ko: 1, aapl: 2, tsla: 4, amzn: 3, msft: 2, brka: 0, nvda: 5, nflx: 1 };

export function createSound(audio) {
  const a = audio;
  let lastRipe = 0, lastCoin = 0;
  const sfx = {
    plant() { a.tone({ freq: 180, type: 'sine', dur: 0.09, vol: 0.12, slide: 95, attack: 0.002 }); a.noise({ dur: 0.05, vol: 0.05, filter: 3200, type: 'highpass' }); },
    water() { a.noise({ dur: 0.22, vol: 0.06, filter: 2400, type: 'bandpass', q: 0.8, slideFilter: 5200 }); a.tone({ freq: 1400, type: 'sine', dur: 0.05, vol: 0.03, at: 0.04, slide: 1900 }); },
    harvest(id, n, bump) {
      const base = CROP_NOTE[id] || 0;
      a.noise({ dur: 0.06, vol: 0.08, filter: 1800, type: 'bandpass', q: 1 });
      for (let i = 0; i < Math.min(n, 5); i++) a.tone({ freq: SCALE[Math.min(SCALE.length - 1, base + i)], type: 'triangle', dur: 0.12, vol: 0.09, at: 0.03 + i * 0.05, attack: 0.002 });
      if (bump) for (let i = 0; i < 4; i++) a.tone({ freq: 2093 + i * 262, type: 'sine', dur: 0.07, vol: 0.04, at: 0.12 + i * 0.03 });
    },
    // one unit sold: a coin; `k` is the rate over its usual (1 = usual)
    coin(k = 1) {
      const now = performance.now();
      if (now - lastCoin < 40) return;
      lastCoin = now;
      const f = 1900 * Math.min(1.5, Math.max(0.7, k));
      a.tone({ freq: f, type: 'sine', dur: 0.07, vol: 0.06, attack: 0.001 });
      a.tone({ freq: f * 1.5, type: 'sine', dur: 0.05, vol: 0.035, at: 0.02 });
    },
    sold(gold) { if (gold >= 60) a.chord([784, 988, 1175, 1568], { dur: 0.3, type: 'triangle', vol: 0.05, strum: 0.04 }); },
    ripe() { const now = performance.now(); if (now - lastRipe < 400) return; lastRipe = now; a.tone({ freq: 1568, type: 'sine', dur: 0.05, vol: 0.025 }); },
    bad() { a.tone({ freq: 220, type: 'square', dur: 0.12, vol: 0.05, slide: 160, filter: 1200 }); },
    rot() { a.tone({ freq: 160, type: 'sawtooth', dur: 0.25, vol: 0.05, slide: 70, filter: 700 }); a.noise({ dur: 0.15, vol: 0.05, filter: 500, type: 'lowpass' }); },
    buy() { a.sfx('select'); a.chord([523, 659, 784], { dur: 0.22, type: 'triangle', vol: 0.06, strum: 0.03 }); },
    news() { a.tone({ freq: 880, type: 'sine', dur: 0.1, vol: 0.05 }); a.tone({ freq: 1318, type: 'sine', dur: 0.14, vol: 0.05, at: 0.1 }); },
    order() { for (let i = 0; i < 4; i++) a.tone({ freq: [660, 990, 880, 1320][i], type: 'square', dur: 0.06, vol: 0.035, at: i * 0.06, filter: 2600 }); },
    deliver() { a.chord([523, 659, 784, 1046], { dur: 0.4, type: 'triangle', vol: 0.06, strum: 0.05 }); },
    bear() { a.tone({ freq: 95, type: 'sawtooth', dur: 0.6, vol: 0.09, slide: 70, filter: 420 }); a.noise({ dur: 0.5, vol: 0.06, filter: 300, type: 'lowpass' }); },
    shoo(n) { a.tone({ freq: 380 + n * 120, type: 'sine', dur: 0.12, vol: 0.09, slide: 760 + n * 160, attack: 0.002 }); },
    bearGone() { a.noise({ dur: 0.35, vol: 0.07, filter: 900, type: 'bandpass', slideFilter: 200 }); },
    eaten() { a.noise({ dur: 0.12, vol: 0.09, filter: 900, type: 'lowpass' }); a.tone({ freq: 140, type: 'square', dur: 0.08, vol: 0.05, filter: 600 }); },
    bull() {
      for (let i = 0; i < 10; i++) a.tone({ freq: 70, type: 'sine', dur: 0.09, vol: 0.12, slide: 45, at: i * 0.17, attack: 0.002 });
      a.chord([392, 494, 587], { dur: 0.5, type: 'sawtooth', vol: 0.04, filter: 1800, at: 0.05 });
      a.chord([523, 659, 784], { dur: 0.6, type: 'sawtooth', vol: 0.04, filter: 2000, at: 0.45 });
    },
    morning() { for (let i = 0; i < 3; i++) a.tone({ freq: [784, 988, 1175][i], type: 'triangle', dur: 0.14, vol: 0.05, at: i * 0.12 }); },
    bell() { for (const [m, v] of [[1, 0.1], [2.76, 0.05], [5.4, 0.03]]) { a.tone({ freq: 523 * m, type: 'sine', dur: 1.4, vol: v }); a.tone({ freq: 523 * m, type: 'sine', dur: 1.4, vol: v, at: 0.55 }); } },
    sticker() { for (let i = 0; i < 5; i++) a.tone({ freq: 1046.5 * (1 + i * 0.12), type: 'sine', dur: 0.09, vol: 0.05, at: i * 0.05 }); },
    tap() { a.tone({ freq: 1200, type: 'sine', dur: 0.03, vol: 0.03 }); },
  };

  // a light country loop: G · C · D · G, a plucked bass, a fiddle-ish line, a shaker
  const bar = (fill) => Array.from({ length: 16 }, (_, i) => fill(i));
  const bass = (roots) => roots.flatMap((r) => bar((i) => (i % 4 === 0 ? (i % 8 === 0 ? r : r + 7) : null)));
  const pattern = {
    bpm: 104, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.06, dur: 2, filter: 900, notes: bass([43, 48, 50, 43]) },
      { type: 'triangle', vol: 0.03, dur: 1, notes: [...bar((i) => (i % 4 === 2 ? 67 : null)), ...bar((i) => (i % 4 === 2 ? 64 : null)), ...bar((i) => (i % 4 === 2 ? 66 : null)), ...bar((i) => (i % 4 === 2 ? 67 : null))] },
      { type: 'square', vol: 0.022, dur: 2, filter: 2400, notes: [
        ...bar((i) => ({ 0: 79, 3: 81, 6: 83, 8: 86, 12: 83 }[i] ?? null)), ...bar((i) => ({ 0: 84, 4: 83, 6: 81, 8: 79, 12: 76 }[i] ?? null)),
        ...bar((i) => ({ 0: 78, 3: 79, 6: 81, 8: 83, 12: 81 }[i] ?? null)), ...bar((i) => ({ 0: 79, 4: 74, 8: 79, 14: 83 }[i] ?? null)),
      ] },
    ],
    drums: { kick: bar((i) => (i % 8 === 0 ? 1 : 0)), snare: bar(() => 0), hat: bar((i) => (i % 2 === 0 ? 1 : 0)) },
  };
  const loop = createLoopMusic(pattern);
  let mood = -1;
  const music = {
    start() { a.music(loop); mood = -1; music.mood(0); },
    stop() { a.stopMusic(); mood = -1; },
    // 0 day · 1 night (quieter, slower) · 2 bear (a low thump) · 3 bull (faster)
    mood(m) {
      if (m === mood) return;
      mood = m;
      pattern.drums.hat = bar((i) => (m === 1 ? (i % 8 === 4 ? 1 : 0) : i % 2 === 0 ? 1 : 0));
      pattern.drums.kick = bar((i) => (m === 2 ? (i % 4 === 0 ? 1 : 0) : i % 8 === 0 ? 1 : 0));
      pattern.tracks[2].vol = m === 1 ? 0.012 : 0.022;
      loop.setBpm(m === 3 ? 124 : m === 1 ? 92 : 104);
    },
  };
  return { sfx, music };
}
