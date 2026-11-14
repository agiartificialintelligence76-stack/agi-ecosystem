// GOING LIVE: its sound, all made in the browser (the arcade kit's audio: no files). Between streams a soft lo-fi loop
// in her room; live, a bouncy loop that speeds up with the hype. A ding for an answered question, a bonk for a banned
// bot, a fanfare for a raid, a shutter for a clip, a drum for each tap of her big moment. Nothing here was heard by its
// author (it was written in a silent workspace): the notes are from theory, the volumes kept modest.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  const a = audio;
  let lastMsg = 0;
  const sfx = {
    msg() { const now = performance.now(); if (now - lastMsg < 140) return; lastMsg = now; a.tone({ freq: 1760, type: 'sine', dur: 0.03, vol: 0.018 }); },
    ask() { a.tone({ freq: 880, type: 'sine', dur: 0.06, vol: 0.05 }); a.tone({ freq: 1175, type: 'sine', dur: 0.08, vol: 0.045, at: 0.05 }); },
    answer() { a.tone({ freq: 1046.5, type: 'triangle', dur: 0.09, vol: 0.08 }); a.tone({ freq: 1568, type: 'triangle', dur: 0.14, vol: 0.07, at: 0.06 }); },
    bot() { a.tone({ freq: 140, type: 'square', dur: 0.12, vol: 0.04, filter: 900 }); },
    ban() { a.sfx('hit', { pitch: 1.3 }); a.noise({ dur: 0.16, vol: 0.06, filter: 2400, type: 'bandpass', slideFilter: 600 }); },
    raid() { a.sfx('levelup'); a.chord([523, 659, 784, 1046], { dur: 0.5, type: 'square', vol: 0.04, strum: 0.05, at: 0.28, filter: 2600 }); },
    tech() { a.sfx('error'); },
    fix() { a.tone({ freq: 660, type: 'square', dur: 0.05, vol: 0.05 }); a.tone({ freq: 990, type: 'square', dur: 0.08, vol: 0.05, at: 0.05 }); },
    heart() { for (let i = 0; i < 3; i++) a.tone({ freq: 1568 * (1 + i * 0.25), type: 'sine', dur: 0.06, vol: 0.04, at: i * 0.035 }); },
    clip() { a.noise({ dur: 0.05, vol: 0.12, filter: 5000, type: 'highpass' }); a.noise({ dur: 0.07, vol: 0.08, filter: 3000, type: 'highpass', at: 0.08 }); a.tone({ freq: 2093, type: 'sine', dur: 0.1, vol: 0.04, at: 0.12 }); },
    bigStart() { for (let i = 0; i < 8; i++) a.tone({ freq: 196, type: 'triangle', dur: 0.05, vol: 0.05 + i * 0.006, at: i * 0.06 }); },
    bigTap(k = 0) { a.tone({ freq: 160 + k * 220, type: 'sine', dur: 0.08, vol: 0.1, slide: 90 + k * 140, attack: 0.002 }); a.noise({ dur: 0.03, vol: 0.05, filter: 1600 }); },
    bigWin() { a.chord([523, 659, 784, 1046, 1319], { dur: 0.7, type: 'triangle', vol: 0.07, strum: 0.04 }); },
    bigMiss() { a.sfx('lose', { pitch: 1.2 }); },
    miss() { a.tone({ freq: 330, type: 'triangle', dur: 0.16, vol: 0.05, slide: 220 }); },
    combo() { a.sfx('combo', { pitch: 1.2 }); },
    goLive() { a.sfx('power'); a.chord([523, 784, 1046], { dur: 0.4, type: 'triangle', vol: 0.06, at: 0.3 }); },
    end() { for (const [m, v] of [[1, 0.08], [2.01, 0.04], [3, 0.03]]) a.tone({ freq: 659 * m, type: 'sine', dur: 1.2, vol: v }); a.tone({ freq: 523, type: 'sine', dur: 1.4, vol: 0.07, at: 0.35 }); },
    buy() { a.sfx('select'); a.chord([659, 831, 988], { dur: 0.28, type: 'triangle', vol: 0.06, strum: 0.03 }); },
    move() { a.sfx('levelup'); a.chord([523, 659, 784, 1046], { dur: 0.8, type: 'triangle', vol: 0.06, strum: 0.06, at: 0.3 }); },
    award() { for (let i = 0; i < 5; i++) a.tone({ freq: 1046.5 * (1 + i * 0.12), type: 'sine', dur: 0.09, vol: 0.05, at: i * 0.05 }); },
    pick() { a.sfx('tap'); },
  };

  const bar = (fill) => Array.from({ length: 16 }, (_, i) => fill(i));
  const hold = (seq) => seq.flatMap((n) => bar((i) => (i === 0 ? n : null)));
  // her room: a soft lo-fi loop (Fmaj7 · Em7 · Dm7 · Cmaj7), a lazy kick, a brushed hat
  const room = {
    bpm: 80, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.05, dur: 6, filter: 700, notes: hold([41, 40, 38, 36]) },
      { type: 'sine', vol: 0.03, dur: 14, notes: hold([64, 62, 60, 59]) },
      { type: 'sine', vol: 0.026, dur: 14, notes: hold([69, 67, 65, 64]) },
      { type: 'triangle', vol: 0.018, dur: 2, filter: 2200, notes: [
        ...bar((i) => ({ 2: 76, 6: 72, 10: 74, 14: 69 }[i] ?? null)), ...bar((i) => ({ 2: 74, 6: 71, 10: 67 }[i] ?? null)),
        ...bar((i) => ({ 2: 72, 6: 69, 10: 77, 14: 76 }[i] ?? null)), ...bar((i) => ({ 2: 71, 6: 67, 12: 64 }[i] ?? null)),
      ] },
    ],
    drums: { kick: bar((i) => (i === 0 || i === 10 ? 1 : 0)), snare: bar((i) => (i === 8 ? 1 : 0)), hat: bar((i) => (i % 4 === 2 ? 1 : 0)) },
  };
  // live: C · G · Am · F, a bouncing bass, a bright arpeggio, four on the floor
  const arp = (root) => bar((i) => (i % 2 === 0 ? root + [0, 4, 7, 12, 7, 4, 0, 7][(i / 2) % 8] : null));
  const live = {
    bpm: 118, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.06, dur: 1.5, filter: 900, notes: [36, 43, 45, 41].flatMap((r) => bar((i) => (i % 2 === 0 ? (i % 4 === 0 ? r : r + 12) : null))) },
      { type: 'square', vol: 0.018, dur: 1, filter: 2600, notes: [...arp(72), ...arp(67), ...arp(69), ...arp(65)] },
      { type: 'sine', vol: 0.025, dur: 15, notes: hold([64, 62, 64, 65]) },
    ],
    drums: { kick: bar((i) => (i % 4 === 0 ? 1 : 0)), snare: bar((i) => (i % 8 === 4 ? 1 : 0)), hat: bar((i) => (i % 2 === 1 ? 1 : 0)) },
  };
  const loops = { room: createLoopMusic(room), live: createLoopMusic(live) };
  let now = null, bpm = 0;
  const music = {
    play(which) { if (now === which) return; now = which; bpm = 0; a.music(loops[which]); },
    stop() { a.stopMusic(); now = null; },
    // the live loop speeds up with the hype (0 … 1)
    hype(h) { if (now !== 'live') return; const b = Math.round(112 + h * 20); if (Math.abs(b - bpm) >= 3) { bpm = b; loops.live.setBpm(b); } },
  };
  return { sfx, music };
}
