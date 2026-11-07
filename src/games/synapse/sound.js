// SYNAPSE (2026-11-08): its sounds, all made in the browser on the arcade kit's audio (src/games/kit/audio.js).
// Each color is a voice (./melody.js): drawing plays a path's notes softly as it grows, a pair connecting plucks its
// target's note, and the firing plays every path at once. A demo is silent (the kit mutes it).
import { createLoopMusic } from '../kit/audio.js';
import { voiceOf, midiOf, hz, bloomChord } from './melody.js';

export function createSound(audio) {
  // a plucked note in a color's voice; `vol` scales its level, `at` delays it
  const pluck = (midi, c, { vol = 1, at = 0, ring = null } = {}) => {
    const v = voiceOf(c), f = hz(midi), dur = ring ?? v.ring;
    audio.tone({ freq: f, type: v.wave, dur, vol: v.vol * vol, at, attack: 0.004, release: dur * 0.92, filter: v.filter || null });
    if (v.bell) audio.tone({ freq: f * v.bell, type: 'sine', dur: dur * 0.55, vol: v.vol * vol * 0.32, at, attack: 0.002, release: dur * 0.5 });
  };
  let lastTick = 0;
  return {
    pluck,
    // the head moved onto a cell: its note, quietly (never more than ~30 a second)
    cell(n, cell, c, k = 0) {
      const now = performance.now();
      if (now - lastTick < 32) return;
      lastTick = now;
      pluck(midiOf(n, cell, c), c, { vol: 0.42 + Math.min(0.2, k * 0.01), ring: 0.16 });
    },
    back() { audio.tone({ freq: 520, type: 'triangle', dur: 0.035, vol: 0.05, slide: 380 }); },
    press(c) { audio.tone({ freq: 300 + c * 18, type: 'sine', dur: 0.06, vol: 0.12, slide: 520 + c * 18, attack: 0.002 }); },
    cut() { audio.noise({ dur: 0.06, vol: 0.12, filter: 2600, type: 'bandpass', q: 1.4 }); audio.tone({ freq: 240, type: 'square', dur: 0.05, vol: 0.04, slide: 150 }); },
    blocked() { audio.sfx('error', { pitch: 1.3 }); },
    // a pair connected: its target's note, then an octave sparkle
    connect(n, cell, c) {
      const m = midiOf(n, cell, c);
      pluck(m, c, { vol: 1.3 });
      pluck(m + 12, c, { vol: 0.5, at: 0.07 });
      audio.tone({ freq: hz(m + 24), type: 'sine', dur: 0.12, vol: 0.05, at: 0.12 });
    },
    clear() { audio.tone({ freq: 420, type: 'triangle', dur: 0.12, vol: 0.09, slide: 180 }); },
    undo() { audio.sfx('back'); },
    hint() { audio.chord([hz(72), hz(76), hz(79)], { type: 'sine', dur: 0.4, vol: 0.07, strum: 0.05 }); },
    // the firing: one note per cell the pulses reach (the game calls it as they get there)
    fire(note, count) { pluck(note.midi, note.c, { vol: (note.last ? 1.25 : 0.95) / Math.sqrt(Math.max(1, count / 3)) }); },
    bloom(voices) {
      bloomChord(voices).forEach((m, i) => audio.tone({ freq: hz(m), type: i % 2 ? 'sine' : 'triangle', dur: 1.8, vol: 0.06, at: i * 0.03, attack: 0.05, release: 1.6 }));
      audio.noise({ dur: 0.9, vol: 0.05, filter: 5200, type: 'highpass', at: 0.02 });
    },
    perfect() { [0, 4, 7, 12].forEach((s, i) => audio.tone({ freq: hz(84 + s), type: 'sine', dur: 0.22, vol: 0.06, at: 0.5 + i * 0.07 })); },
    tick() { audio.sfx('tick', { pitch: 1.1 }); },
    whoosh() { audio.sfx('whoosh', { pitch: 1.3 }); },
    select() { audio.sfx('select'); },
    gain() { audio.sfx('coin', { pitch: 1.2 }); },
  };
}

// a calm loop for the background: soft pad chords (C, A minor, F, G) and a few high drops of the scale
export function createMusic() {
  const S = 16, rest = null;
  const chord = (root) => [root, rest, rest, rest, rest, rest, rest, rest, root, rest, rest, rest, rest, rest, rest, rest];
  const bass = [...chord(36), ...chord(33), ...chord(29), ...chord(31)];
  const padA = [...chord(60), ...chord(57), ...chord(57), ...chord(59)];
  const padB = [...chord(64), ...chord(64), ...chord(60), ...chord(62)];
  const drops = Array(S * 4).fill(rest);
  [[2, 79], [7, 76], [11, 84], [18, 81], [23, 76], [29, 79], [34, 72], [39, 77], [45, 74], [50, 79], [55, 86], [61, 81]].forEach(([i, m]) => { drops[i] = m; });
  return createLoopMusic({
    bpm: 74, steps: S, bars: 4,
    tracks: [
      { type: 'sine', vol: 0.05, notes: bass, dur: 7, attack: 0.08 },
      { type: 'triangle', vol: 0.022, notes: padA, dur: 7.5, attack: 0.25 },
      { type: 'triangle', vol: 0.02, notes: padB, dur: 7.5, attack: 0.3 },
      { type: 'sine', vol: 0.018, notes: drops, dur: 2.5, attack: 0.01 },
    ],
  });
}
