// JAYWALK's sounds (2026-11-08): made in the browser with the arcade kit's synth (no files), and a small bouncy loop
// for the music switch. Every sound has a little pitch spread so a hundred hops never sound the same.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  let hopN = 0;
  return {
    hop(dir) {
      hopN++;
      const p = (dir === 'up' ? 1 : dir === 'down' ? 0.84 : 0.92) * (1 + (hopN % 3) * 0.03);
      audio.tone({ freq: 500 * p, type: 'triangle', dur: 0.07, vol: 0.11, slide: 840 * p, attack: 0.002 });
    },
    land(surface) {
      if (surface === 'river') audio.tone({ freq: 260, type: 'sine', dur: 0.09, vol: 0.12, slide: 170 });
      else audio.noise({ dur: 0.03, vol: 0.05, filter: 2200, type: 'lowpass' });
    },
    bump() { audio.tone({ freq: 170, type: 'square', dur: 0.07, vol: 0.07, slide: 110, filter: 900 }); },
    heart(big, streak = 0) {
      if (big) { audio.sfx('levelup', { pitch: 1.1 }); return; }
      audio.sfx('coin', { pitch: 1 + Math.min(streak, 6) * 0.06 });
    },
    near(train) { audio.sfx('whoosh', { pitch: train ? 0.75 : 1.3 }); },
    bell(vol = 1) {
      audio.tone({ freq: 1568, type: 'triangle', dur: 0.14, vol: 0.07 * vol });
      audio.tone({ freq: 2093, type: 'sine', dur: 0.1, vol: 0.04 * vol, at: 0.004 });
    },
    whoosh() {
      audio.noise({ dur: 0.75, vol: 0.2, filter: 420, type: 'bandpass', q: 0.6, slideFilter: 2600 });
      audio.tone({ freq: 74, type: 'sawtooth', dur: 0.55, vol: 0.06, filter: 420 });
    },
    splat() {
      audio.sfx('hit', { pitch: 0.9 });
      audio.tone({ freq: 560, type: 'square', dur: 0.34, vol: 0.07, slide: 90, filter: 1800, at: 0.05 });
    },
    splash() {
      audio.noise({ dur: 0.5, vol: 0.26, filter: 1500, type: 'lowpass', slideFilter: 240 });
      audio.tone({ freq: 700, type: 'sine', dur: 0.22, vol: 0.1, slide: 160, at: 0.03 });
      audio.tone({ freq: 420, type: 'sine', dur: 0.16, vol: 0.06, slide: 900, at: 0.2 });
    },
    zap() {
      audio.noise({ dur: 0.32, vol: 0.24, filter: 4200, type: 'highpass' });
      audio.tone({ freq: 1300, type: 'sawtooth', dur: 0.36, vol: 0.07, slide: 160, filter: 3200 });
      audio.sfx('explode', { pitch: 1.5 });
    },
    droneBeep(urgent = false) { audio.tone({ freq: urgent ? 1040 : 880, type: 'square', dur: 0.05, vol: 0.045 }); },
    grab() {
      audio.sfx('power', { pitch: 1.35 });
      [660, 520, 400].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.05, at: 0.12 + i * 0.09 }));
    },
    milestone() { audio.sfx('levelup'); },
    best() { audio.sfx('win'); },
    unlock() { audio.sfx('levelup', { pitch: 1.12 }); },
    select() { audio.sfx('select'); },
    error() { audio.sfx('error'); },
    go() { audio.sfx('pop', { pitch: 1.15 }); },
  };
}

// a bouncy 4-bar loop in C (C · Am · F · G), soft enough to play under a hundred hops
export function createMusic() {
  const roots = [48, 45, 41, 43];
  const bass = roots.flatMap((r) => [r, null, r + 12, null, r + 7, null, r + 12, null, r, null, r + 12, null, r + 7, null, r + 12, null]);
  const lead = [
    72, null, 76, null, 79, null, 76, null, 77, null, 76, null, 74, null, null, null,
    72, null, 76, null, 81, null, 79, null, 76, null, null, null, 74, null, 72, null,
    77, null, 81, null, 84, null, 81, null, 79, null, 77, null, 76, null, null, null,
    74, null, 77, null, 79, null, 83, null, 84, null, null, null, null, null, 79, null,
  ];
  const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const pad = chords.flatMap((c) => [null, null, c[0], null, null, null, c[1], null, null, null, c[2], null, null, null, c[1], null]);
  return createLoopMusic({
    bpm: 118, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.085, notes: bass, dur: 1.6 },
      { type: 'square', vol: 0.026, notes: lead, dur: 1.7, filter: 2400 },
      { type: 'triangle', vol: 0.03, notes: pad, dur: 1.2, octave: 1 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    },
  });
}
