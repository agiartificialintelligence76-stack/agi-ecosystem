// AUTOCOMPLETE (2026-11-09): the numbers of a run. Pure (no DOM).
//
//   a word's points   its letters' values × its length (3: ×1, 4: ×1.5, 5: ×2, 6: ×3, 7+: ×4) × +50% a token tile
//                     × how it did against AGI-1's pick (her pick ×1, another word ×1.5, a longer word ×2)
//                     × 2 with a glitch tile in it, × ½ for the word she completed for you. Always a multiple of 5.
//   the context window (Endless): drains, slowly at first and faster as the run goes on; every word refills it by its
//                     points; empty, the run ends.
//   glitch tiles (Endless, from 90 s): one at a time; play it within 3 words for ×2, or it corrupts and costs context.
//   Daily: today's board for everyone (its seed from the date), 2 minutes. Zen: no clock, no glitches.
import { LETTER_VALUE } from './tiles.js';

export const lengthMult = (n) => (n <= 3 ? 1 : n === 4 ? 1.5 : n === 5 ? 2 : n === 6 ? 3 : 4);
export const SURPRISE = Object.freeze({ predictable: 1, surprise: 1.5, longer: 2 });
export const TOKEN_BONUS = 0.5;
export const GLITCH_MULT = 2;
export const HINT_MULT = 0.5;

export function letterSum(word) { let v = 0; for (const c of word) v += LETTER_VALUE[c] || 0; return v; }

// { word, tokens (token tiles in it), kind ('predictable' | 'surprise' | 'longer'), glitch, hinted } → { base, mult, points }
export function scoreWord({ word, tokens = 0, kind = 'predictable', glitch = false, hinted = false }) {
  const base = letterSum(word);
  const mult = lengthMult(word.length) * (1 + TOKEN_BONUS * tokens) * (SURPRISE[kind] ?? 1) * (glitch ? GLITCH_MULT : 1) * (hinted ? HINT_MULT : 1);
  return { base, mult, points: Math.max(5, Math.round(base * mult * 2) * 5) };
}

// ---------- the context window ----------
export const CONTEXT = Object.freeze({
  max: 100,
  drain: 1.15,          // per second at the start…
  ramp: 0.019,          // …and this much faster every second of the run
  drainMax: 6.5,
  refillMin: 3, refillPer: 1 / 22, refillMax: 30,   // a word's refill: 3 + points / 22, at most 30
  glitchFixed: 8, glitchCorrupt: 16, hint: 10, low: 22,
});
export const drainAt = (t) => Math.min(CONTEXT.drainMax, CONTEXT.drain + CONTEXT.ramp * Math.max(0, t));
export const refillFor = (points) => Math.min(CONTEXT.refillMax, CONTEXT.refillMin + points * CONTEXT.refillPer);
// the window: { value, t (seconds it has drained), running }
export const newContext = () => ({ value: CONTEXT.max, t: 0, running: false });
export function drainContext(c, dt) {
  if (!c.running || c.value <= 0) return c.value;
  c.t += dt;
  c.value = Math.max(0, c.value - drainAt(c.t) * dt);
  return c.value;
}
// add (or take, with a negative amount) context; → what really changed
export function addContext(c, amount) {
  const before = c.value;
  c.value = Math.max(0, Math.min(CONTEXT.max, c.value + amount));
  return c.value - before;
}

// ---------- glitch tiles ----------
export const GLITCH = Object.freeze({ from: 90, gap: 14, words: 3 });
// the glitch's clock: { tileId (0: none), left (words), nextAt (run time when the next may appear) }
export const newGlitch = () => ({ tileId: 0, left: 0, nextAt: GLITCH.from });
export const glitchDue = (g, t) => !g.tileId && t >= g.nextAt;
export function startGlitch(g, tileId) { g.tileId = tileId; g.left = GLITCH.words; return g; }
// a word was played: did it hold the glitch tile? → 'none' (no glitch), 'fixed', 'tick' (one word fewer), 'corrupt'
export function glitchAfterWord(g, usedIt, t) {
  if (!g.tileId) return 'none';
  if (usedIt) { g.tileId = 0; g.left = 0; g.nextAt = t + GLITCH.gap; return 'fixed'; }
  g.left--;
  if (g.left <= 0) { g.tileId = 0; g.left = 0; g.nextAt = t + GLITCH.gap; return 'corrupt'; }
  return 'tick';
}
// which tile turns: one in many words she knows (so it can be played), never on the path being drawn. `words`:
// solve()'s map. → a cell, or -1
export function pickGlitchCell(tiles, words, dict, rng, avoid = []) {
  const uses = new Array(tiles.length).fill(0);
  for (const [w, info] of words) if (dict.rankOf(w) >= 0) for (const i of new Set(info.path)) uses[i]++;
  const cells = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i] && !tiles[i].token && !avoid.includes(i) && uses[i] >= 3) cells.push(i);
  if (!cells.length) return -1;
  return rng.pick(cells);
}

// ---------- Daily ----------
export const DAILY = Object.freeze({ seconds: 120, hintCost: 5 });
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// today's seed: FNV-1a of the date (never 0)
export function daySeed(key) {
  let h = 0x811c9dc5;
  for (const ch of `autocomplete:${key}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}

// ---------- a run's record ----------
export const newTally = () => ({ score: 0, words: 0, surprises: 0, longer: 0, longest: '', top: [] });
export function tallyWord(t, { word, points, kind }) {
  t.score += points;
  t.words++;
  if (kind !== 'predictable') t.surprises++;
  if (kind === 'longer') t.longer++;
  if (word.length > t.longest.length || (word.length === t.longest.length && word < t.longest)) t.longest = word;
  const same = t.top.find((x) => x.word === word);
  if (same) same.points = Math.max(same.points, points); else t.top.push({ word, points });
  t.top.sort((a, b) => b.points - a.points || (a.word < b.word ? -1 : 1));
  if (t.top.length > 3) t.top.length = 3;
  return t;
}
