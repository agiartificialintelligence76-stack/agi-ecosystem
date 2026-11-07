// SYNAPSE (2026-11-08): the music in a board. Pure (no DOM, no sound).
// The board is a musical grid: each cell has a note of a major pentatonic scale, one step higher for each cell to the
// right or up (folded back down past two octaves), so a path's shape is its melody: it climbs, falls, wanders. Each
// color is a voice (its own register and timbre). When a board is solved the network fires: a pulse runs every path
// from its source neuron to its target, each cell it reaches playing its note in that path's voice, all at once.
export const SCALE = Object.freeze([0, 2, 4, 7, 9]);          // major pentatonic: no note can clash
export const ROOT = 60;                                         // C4
// the ten voices (by color): an octave offset, an oscillator, a filter (0: none), how long a note rings, its level
export const VOICES = Object.freeze([
  { oct: 0, wave: 'triangle', filter: 0, ring: 0.42, vol: 0.13 },     // pink
  { oct: 1, wave: 'sine', filter: 0, ring: 0.7, vol: 0.12, bell: 3 },  // honey: a bell
  { oct: 0, wave: 'sine', filter: 0, ring: 0.5, vol: 0.14, bell: 2 },  // sky
  { oct: -1, wave: 'triangle', filter: 0, ring: 0.5, vol: 0.15 },      // mint
  { oct: -1, wave: 'square', filter: 1500, ring: 0.36, vol: 0.06 },    // violet
  { oct: 0, wave: 'square', filter: 2200, ring: 0.3, vol: 0.05 },      // orange
  { oct: 1, wave: 'triangle', filter: 0, ring: 0.45, vol: 0.1 },       // lime
  { oct: -2, wave: 'sawtooth', filter: 700, ring: 0.5, vol: 0.07 },    // red: the bass
  { oct: 1, wave: 'sine', filter: 0, ring: 0.8, vol: 0.1, bell: 4 },   // white: a high bell
  { oct: -1, wave: 'sine', filter: 0, ring: 0.55, vol: 0.14, bell: 2 },// tan
]);
export const voiceOf = (c) => VOICES[c % VOICES.length];
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// the scale step of a cell: right and up are higher; past 9 steps it folds back down (two octaves of pentatonic)
export function degreeOf(n, cell) {
  const x = cell % n, y = (cell / n) | 0;
  const d = x + (n - 1 - y);
  const span = 9, m = d % (span * 2);
  return m <= span ? m : span * 2 - m;
}
export function midiOf(n, cell, c) {
  const deg = degreeOf(n, cell);
  return ROOT + voiceOf(c).oct * 12 + SCALE[deg % 5] + 12 * Math.floor(deg / 5);
}

// the firing: every path (cells from source to target) at once, a pulse a cell every `step` seconds, each color a hair
// later than the one before so they strum. → { step, strum, notes: [{ t, c, k, cell, midi, last }], end, arrive: [t per color] }
export function firingPlan(n, flows, { maxTime = 2.3, minStep = 0.07, maxStep = 0.13, strum = 0.045 } = {}) {
  const longest = Math.max(2, ...flows.map((P) => P.length));
  const step = Math.min(maxStep, Math.max(minStep, maxTime / (longest - 1)));
  const notes = [];
  const arrive = [];
  flows.forEach((P, c) => {
    const t0 = c * strum;
    for (let k = 0; k < P.length; k++) notes.push({ t: t0 + k * step, c, k, cell: P[k], midi: midiOf(n, P[k], c), last: k === P.length - 1 });
    arrive.push(t0 + (P.length - 1) * step);
  });
  notes.sort((a, b) => a.t - b.t || a.c - b.c);
  return { step, strum, notes, arrive, end: Math.max(0, ...arrive) };
}

// the final chord when the board blooms: the scale's tonic chord spread over the voices that played
export function bloomChord(count) {
  const tones = [0, 4, 7, 12, 16, 19, 24];
  return tones.slice(0, Math.max(3, Math.min(tones.length, count))).map((t) => ROOT - 12 + t);
}
