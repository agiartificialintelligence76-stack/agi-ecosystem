// SYNAPSE (2026-11-08): the campaign's six packs, the Daily's three boards and Rush's boards. Pure (no DOM).
// A campaign board is a generator seed (./campaign.js, picked and checked by tools/games/synapse/pick.mjs: one answer
// only, a good number of pairs, varied paths, easiest first); the game makes the board from its seed when it's played.
import { SEEDS, SUMS } from './campaign.js';
import { generate, withGates, uniqueBoard, encode, checksum } from './puzzle.js';

// each pack: its boards in segments (the same kind of board, easiest first), its twist introduced on its first board
export const PACKS = Object.freeze([
  {
    id: 'sprout', name: 'Sprout', size: '5×5', tone: 'mint', twist: null,
    segments: [{ spec: { n: 5, pairs: [4, 5] }, count: 24 }],
  },
  {
    id: 'cortex', name: 'Cortex', size: '6×6', tone: 'sky', twist: null,
    segments: [{ spec: { n: 6, pairs: [5, 6] }, count: 24 }],
  },
  {
    id: 'hippocampus', name: 'Hippocampus', size: '7×7', tone: 'honey', twist: 'holes',
    segments: [
      { spec: { n: 7, pairs: [6, 8] }, count: 10 },
      { spec: { n: 7, pairs: [6, 7], holes: [3, 6] }, count: 14 },
    ],
  },
  {
    id: 'myelin', name: 'Myelin', size: '7×7 – 8×8', tone: 'pink', twist: 'bridges',
    segments: [
      { spec: { n: 7, pairs: [6, 7], bridges: 1 }, count: 8 },
      { spec: { n: 8, pairs: [7, 8], bridges: [1, 2] }, count: 8 },
      { spec: { n: 8, pairs: [7, 9], bridges: [2, 3] }, count: 8 },
    ],
  },
  {
    id: 'gatekeeper', name: 'Gatekeeper', size: '8×8', tone: 'violet', twist: 'gates',
    segments: [
      { spec: { n: 8, pairs: [6, 7], gates: [2, 3] }, count: 12 },
      { spec: { n: 8, pairs: [5, 6], gates: [3, 5] }, count: 12 },
    ],
  },
  {
    id: 'neocortex', name: 'Neocortex', size: '9×9 – 10×10', tone: 'red', twist: 'mixed',
    segments: [
      { spec: { n: 9, pairs: [8, 10] }, count: 6 },
      { spec: { n: 9, pairs: [8, 9], holes: [4, 8], bridges: [0, 1] }, count: 6 },
      { spec: { n: 10, pairs: [9, 10], holes: [4, 10], bridges: [1, 2] }, count: 6 },
      { spec: { n: 10, pairs: [8, 9], holes: [0, 6], gates: [2, 4] }, count: 6 },
    ],
  },
]);
export const PACK = Object.freeze(Object.fromEntries(PACKS.map((p, i) => [p.id, i])));
export const packSize = (p) => p.segments.reduce((s, g) => s + g.count, 0);
export const TOTAL_BOARDS = PACKS.reduce((s, p) => s + packSize(p), 0);
// a pack opens once this many boards of the one before it are solved
export const UNLOCK_AT = 8;

// a stored gate list: base-36 cell numbers joined by dots
export const decodeGates = (str) => (str ? str.split('.').map((x) => parseInt(x, 36)) : []);
export const encodeGates = (cells) => cells.map((c) => c.toString(36)).join('.');

// the board `i` of pack `p` (an index into PACKS), made from its seed
export function boardAt(p, i) {
  const pack = PACKS[p];
  const entry = SEEDS[pack.id]?.[i];
  if (!entry) return null;
  const [seg, seed, gates] = entry;
  const pz = generate(pack.segments[seg].spec, seed);
  const out = gates ? withGates(pz, decodeGates(gates)) : pz;
  out.pack = p; out.index = i;
  return out;
}
// every board of a pack in one line each, and their checksum (tests: the generator still makes what was picked)
export const packLines = (p) => SEEDS[PACKS[p].id].map((_, i) => encode(boardAt(p, i)));
export const packSum = (p) => checksum(packLines(p));
export const storedSum = (p) => SUMS[PACKS[p].id];

// ---------- the Daily: three boards a day, the same for everyone that day (by the local date) ----------
export const DAILY = Object.freeze([
  { id: 'small', label: 'Small', spec: { n: 6, pairs: [5, 6] } },
  { id: 'medium', label: 'Medium', spec: { n: 7, pairs: [6, 8], holes: [0, 4] } },
  // the big one turns by the day of the week: plain, bridges, gates
  { id: 'large', label: 'Large', spec: null },
]);
const LARGE = [
  { n: 8, pairs: [7, 9] },
  { n: 8, pairs: [7, 8], bridges: [1, 2] },
  { n: 8, pairs: [6, 7], gates: 2 },
];
export function dayKey(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
// a day's number (days since 2026-01-01, by the calendar date, not the clock)
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}
export const daySeed = (key, slot) => (parseInt(checksum([`synapse-daily:${key}:${slot}`]), 36) >>> 0) || 1;
export function dailySpec(key, slot) {
  if (slot < 2) return DAILY[slot].spec;
  return LARGE[((dayNumber(key) % 3) + 3) % 3];
}
export function dailyBoard(key, slot) {
  const spec = dailySpec(key, slot);
  const { gates = 0, ...rest } = spec;
  return uniqueBoard(rest, daySeed(key, slot), { gates, budget: 120000 });
}
// days in a row: the streak goes on when yesterday was done too
export function nextStreak(prev, key) {
  if (!prev || !prev.last) return { last: key, n: 1 };
  const gap = dayNumber(key) - dayNumber(prev.last);
  if (gap === 0) return prev;
  return { last: key, n: gap === 1 ? (prev.n || 0) + 1 : 1 };
}

// ---------- Rush: small boards made live, a bit bigger as the run goes on ----------
export function rushSpec(k) {
  if (k < 3) return { n: 5, pairs: [4, 5] };
  if (k < 8) return { n: 6, pairs: [5, 6] };
  if (k < 12) return { n: 6, pairs: [5, 6], holes: [2, 4] };
  return { n: 7, pairs: [6, 7] };
}
export function rushBoard(runSeed, k) {
  return uniqueBoard(rushSpec(k), (Math.imul(runSeed >>> 0, 747796405) + k * 2891336453 + 12345) >>> 0, { budget: 40000 });
}
export const RUSH = Object.freeze({ seconds: 180, bonus: 10 });
