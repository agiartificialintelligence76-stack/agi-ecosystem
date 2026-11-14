// GOING LIVE: its sound, all made in the browser (the arcade kit’s audio: no files). In her room a little chiptune loop
// (square and triangle waves, like her pixel room); live, a bouncy loop that speeds up with the hype. Blips for a video
// out, a box, a thing put down, the drone, a zap, a level. A ding for an answered question, a bonk for a banned
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
    record() { a.tone({ freq: 523, type: 'square', dur: 0.05, vol: 0.04, filter: 2400 }); a.tone({ freq: 784, type: 'square', dur: 0.07, vol: 0.04, at: 0.06, filter: 2400 }); },
    video(big = false) { a.chord(big ? [784, 988, 1175, 1568] : [784, 988, 1175], { dur: 0.32, type: 'square', vol: 0.035, strum: 0.05, filter: 3200 }); },
    viral() { a.sfx('levelup'); a.chord([523, 659, 784, 1046, 1319], { dur: 0.9, type: 'square', vol: 0.04, strum: 0.06, at: 0.25, filter: 2800 }); },
    box() { a.noise({ dur: 0.08, vol: 0.07, filter: 1800, type: 'bandpass' }); a.tone({ freq: 1046, type: 'square', dur: 0.06, vol: 0.035, at: 0.06, filter: 2600 }); },
    boxTap() { a.tone({ freq: 392, type: 'square', dur: 0.04, vol: 0.035, filter: 1600 }); },
    place() { a.tone({ freq: 196, type: 'triangle', dur: 0.08, vol: 0.09 }); a.noise({ dur: 0.05, vol: 0.05, filter: 900 }); },
    nope() { a.tone({ freq: 220, type: 'square', dur: 0.08, vol: 0.035, filter: 900 }); a.tone({ freq: 185, type: 'square', dur: 0.1, vol: 0.035, at: 0.08, filter: 900 }); },
    drone() { a.tone({ freq: 330, type: 'sawtooth', dur: 0.6, vol: 0.012, slide: 360, filter: 1200 }); },
    mail() { a.chord([988, 1319, 1568], { dur: 0.3, type: 'square', vol: 0.035, strum: 0.04, filter: 3000 }); },
    zap() { a.tone({ freq: 1400, type: 'square', dur: 0.12, vol: 0.04, slide: 200, filter: 3000 }); a.noise({ dur: 0.1, vol: 0.05, filter: 3000, type: 'highpass' }); },
    level() { a.chord([523, 659, 784], { dur: 0.18, type: 'square', vol: 0.04, filter: 3000 }); a.chord([659, 784, 1046], { dur: 0.4, type: 'square', vol: 0.045, at: 0.16, filter: 3000 }); },
    quest() { a.tone({ freq: 1175, type: 'square', dur: 0.07, vol: 0.035, filter: 3000 }); a.tone({ freq: 1568, type: 'square', dur: 0.12, vol: 0.035, at: 0.08, filter: 3000 }); },
    pet() { a.tone({ freq: 880, type: 'triangle', dur: 0.12, vol: 0.05, slide: 1200 }); },
    perk() { a.sfx('select'); a.tone({ freq: 1319, type: 'square', dur: 0.1, vol: 0.035, at: 0.05, filter: 3000 }); },
    // a thing tapped: a little boop, higher for small things
    thing(small = false) { a.tone({ freq: small ? 1175 : 784, type: 'square', dur: 0.05, vol: 0.03, slide: small ? 1568 : 988, filter: 2600 }); },
    // what she does with her things
    use(kind) {
      const f = {
        whoopee: () => a.tone({ freq: 90, type: 'sawtooth', dur: 0.5, vol: 0.05, slide: 60, filter: 700 }),
        game: () => [0, 1, 2].forEach((i) => a.tone({ freq: [659, 784, 988][i], type: 'square', dur: 0.06, vol: 0.03, at: i * 0.08, filter: 2600 })),
        camera: () => { a.noise({ dur: 0.05, vol: 0.1, filter: 5000, type: 'highpass' }); a.tone({ freq: 2093, type: 'sine', dur: 0.08, vol: 0.03, at: 0.06 }); },
        sing: () => [0, 1, 2, 3].forEach((i) => a.tone({ freq: [523, 587, 659, 784][i], type: 'triangle', dur: 0.16, vol: 0.05, at: i * 0.15 })),
        tinker: () => [0, 1, 2].forEach((i) => a.noise({ dur: 0.03, vol: 0.06, filter: 3200, type: 'bandpass', at: i * 0.11 })),
        bubble: () => [0, 1, 2].forEach((i) => a.tone({ freq: 600 + i * 260, type: 'sine', dur: 0.06, vol: 0.04, slide: 1200 + i * 200, at: i * 0.09 })),
        munch: () => [0, 1].forEach((i) => a.noise({ dur: 0.06, vol: 0.06, filter: 1400, type: 'bandpass', at: i * 0.14 })),
        sizzle: () => a.noise({ dur: 0.7, vol: 0.035, filter: 4200, type: 'highpass' }),
        keys: () => [0, 1, 2, 3].forEach((i) => a.tone({ freq: [523, 659, 784, 1046][i], type: 'triangle', dur: 0.2, vol: 0.05, at: i * 0.12 })),
        drums: () => { a.tone({ freq: 110, type: 'sine', dur: 0.15, vol: 0.12, slide: 55 }); a.noise({ dur: 0.08, vol: 0.06, filter: 2000, at: 0.18 }); a.tone({ freq: 110, type: 'sine', dur: 0.15, vol: 0.12, slide: 55, at: 0.36 }); },
        beat: () => [0, 1, 2, 3].forEach((i) => (i % 2 ? a.noise({ dur: 0.05, vol: 0.05, filter: 2600, at: i * 0.16 }) : a.tone({ freq: 100, type: 'sine', dur: 0.12, vol: 0.1, slide: 50, at: i * 0.16 }))),
        water: () => a.noise({ dur: 0.4, vol: 0.04, filter: 1800, type: 'bandpass', slideFilter: 900 }),
        pet: () => a.tone({ freq: 880, type: 'triangle', dur: 0.12, vol: 0.05, slide: 1200 }),
        splash: () => a.noise({ dur: 0.3, vol: 0.08, filter: 1600, type: 'bandpass', slideFilter: 500 }),
        wheee: () => a.tone({ freq: 1400, type: 'triangle', dur: 0.5, vol: 0.05, slide: 500 }),
        claw: () => { a.tone({ freq: 300, type: 'square', dur: 0.4, vol: 0.025, slide: 500, filter: 1400 }); a.tone({ freq: 660, type: 'square', dur: 0.06, vol: 0.03, at: 0.45, filter: 2400 }); },
        party: () => { a.noise({ dur: 0.12, vol: 0.1, filter: 3000, type: 'highpass' }); a.chord([784, 988, 1175], { dur: 0.3, type: 'triangle', vol: 0.05, strum: 0.04, at: 0.1 }); },
        capsule: () => { a.tone({ freq: 392, type: 'square', dur: 0.1, vol: 0.03, filter: 1600 }); a.tone({ freq: 1046, type: 'triangle', dur: 0.12, vol: 0.05, at: 0.3 }); },
      }[kind];
      if (f) f();
    },
    // a mystery box: a rattle, then what’s inside (a bigger chord the rarer it is)
    shake() { for (let i = 0; i < 6; i++) a.noise({ dur: 0.04, vol: 0.05, filter: 1400, type: 'bandpass', at: i * 0.13 }); },
    reveal(rarity = 'common') {
      const k = { common: 0, rare: 1, epic: 2, legendary: 3 }[rarity] ?? 0;
      a.noise({ dur: 0.1, vol: 0.08, filter: 2600, type: 'bandpass' });
      a.chord([523, 659, 784, 1046, 1319].slice(0, 3 + Math.min(2, k)), { dur: 0.5 + k * 0.2, type: k >= 2 ? 'square' : 'triangle', vol: 0.05, strum: 0.05, at: 0.05, filter: 3200 });
      if (k >= 3) { a.sfx('levelup'); for (let i = 0; i < 6; i++) a.tone({ freq: 1568 * (1 + i * 0.12), type: 'sine', dur: 0.1, vol: 0.04, at: 0.5 + i * 0.06 }); }
    },
    mystery() { a.chord([784, 1046, 1319], { dur: 0.3, type: 'triangle', vol: 0.05, strum: 0.06 }); },
    set() { a.sfx('levelup'); a.chord([523, 659, 784, 1046, 1319], { dur: 0.9, type: 'triangle', vol: 0.06, strum: 0.06, at: 0.25 }); },
  };

  const bar = (fill) => Array.from({ length: 16 }, (_, i) => fill(i));
  const hold = (seq) => seq.flatMap((n) => bar((i) => (i === 0 ? n : null)));
  // her room: a little chiptune loop (F · Em · Dm · C): a triangle bass, a soft square melody, a quiet tick
  const room = {
    bpm: 96, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.05, dur: 1.6, filter: 900, notes: [41, 40, 38, 36].flatMap((r) => bar((i) => (i % 4 === 0 ? r : i % 4 === 2 ? r + 12 : null))) },
      { type: 'square', vol: 0.016, dur: 1.5, filter: 1800, notes: [
        ...bar((i) => ({ 0: 72, 2: 76, 4: 79, 6: 76, 8: 77, 10: 76, 12: 72 }[i] ?? null)), ...bar((i) => ({ 0: 71, 2: 74, 4: 79, 8: 76, 12: 74 }[i] ?? null)),
        ...bar((i) => ({ 0: 69, 2: 72, 4: 77, 6: 76, 8: 74, 12: 72 }[i] ?? null)), ...bar((i) => ({ 0: 67, 4: 72, 8: 71, 12: 67 }[i] ?? null)),
      ] },
      { type: 'square', vol: 0.008, dur: 0.6, filter: 2600, notes: [65, 64, 62, 60].flatMap((r) => bar((i) => (i % 2 === 1 ? r + 24 + [0, 4, 7, 12][(i >> 1) % 4] : null))) },
    ],
    drums: { kick: bar((i) => (i === 0 || i === 8 ? 1 : 0)), snare: bar(() => 0), hat: bar((i) => (i % 4 === 2 ? 1 : 0)) },
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
