// HEARTBEAT (2026-11-08): the rules, as numbers (pure: no DOM; tests/heartbeat.test.js reads them in Node).
//
// A tap is judged by how far it is from its note: PERFECT within 45 ms, GREAT 90, GOOD 135, else MISS (a note let
// through is a MISS too). A hold's head is judged like a tap; its tail is PERFECT when it's held to (almost) the end,
// and released early it counts as a GOOD that breaks the combo. The score runs to 1,000,000: 900,000 for accuracy
// (PERFECT 100 %, GREAT 70 %, GOOD 40 %, worth ×1.2 while FEVER burns) and 100,000 for keeping the combo going. All
// PERFECT is exactly 1,000,000.

export const LANES = 4;
export const WINDOW = Object.freeze({ perfect: 0.045, great: 0.09, good: 0.135 });
export const KINDS = Object.freeze(['perfect', 'great', 'good', 'miss']);
// each judgment's worth, in tenths (integers keep the sums exact)
export const WORTH = Object.freeze({ perfect: 10, great: 7, good: 4, miss: 0, break: 4 });
export const FEVER_AT = 50;              // the combo that lights FEVER
export const FEVER_X = 12;               // ×1.2, in tenths
export const HOLD_GRACE = 0.12;          // a hold let go this close to its end still counts as held
export const MAX_SCORE = 1_000_000;
export const ACC_PART = 900_000;
export const COMBO_PART = 100_000;
export const COMBO_CAP = 100;            // a unit's combo bonus stops growing here

export const GRADES = Object.freeze([['S+', 98], ['S', 95], ['A', 90], ['B', 80], ['C', 70], ['D', 0]]);

// error (s, + late) → its judgment, or null when it's too far to count for this note
export function judge(err) {
  const a = Math.abs(err);
  if (a <= WINDOW.perfect) return 'perfect';
  if (a <= WINDOW.great) return 'great';
  if (a <= WINDOW.good) return 'good';
  return null;
}

export function gradeOf(accuracy) {
  for (const [g, min] of GRADES) if (accuracy >= min - 1e-9) return g;
  return 'D';
}

// "an S+", "a B": for the post's words
export const withArticle = (g) => (/^[SAE]/.test(g) ? `an ${g}` : `a ${g}`);

// what an all-PERFECT run is worth (tenths): the first FEVER_AT units ×1, the rest ×1.2
export function maxValue(units) {
  return Math.min(units, FEVER_AT) * 10 * 10 + Math.max(0, units - FEVER_AT) * 10 * FEVER_X;
}
// the combo bonus of an unbroken run: Σ min(i, COMBO_CAP) for i = 1..units
export function maxComboSum(units) {
  const c = Math.min(units, COMBO_CAP);
  return (c * (c + 1)) / 2 + Math.max(0, units - COMBO_CAP) * COMBO_CAP;
}

// { value, comboSum, units } → the score (units: every judged thing of the whole chart: notes, and holds' tails)
export function scoreOf({ value, comboSum }, units) {
  if (!units) return 0;
  const s = (ACC_PART * value) / maxValue(units) + (COMBO_PART * comboSum) / maxComboSum(units);
  return Math.min(MAX_SCORE, Math.round(s));
}

// accuracy in percent (100 = all PERFECT), from the summed worth (tenths) of `judged` units
export const accuracyOf = (worth, judged) => (judged ? (worth * 10) / judged : 100);

// the stamp a finished run earns
export function stampOf(counts) {
  if (counts.miss === 0 && counts.break === 0 && counts.great === 0 && counts.good === 0) return 'ALL PERFECT';
  if (counts.miss === 0 && counts.break === 0) return 'FULL COMBO';
  return null;
}

// Settings: note speed (scroll ×0.8–×2.0, default ×1.2) and how many seconds of notes that shows
export const SPEED = Object.freeze({ min: 0.8, max: 2.0, step: 0.1, def: 1.2 });
export const approachOf = (speed) => 1.5 / Math.min(SPEED.max, Math.max(SPEED.min, speed || SPEED.def));
// the sync offset (ms, + = the player hears or taps late): ±200
export const OFFSET = Object.freeze({ min: -200, max: 200, step: 1, def: 0 });
export const clampOffset = (ms) => Math.round(Math.min(OFFSET.max, Math.max(OFFSET.min, Number(ms) || 0)));
export const clampSpeed = (v) => Math.round(Math.min(SPEED.max, Math.max(SPEED.min, Number(v) || SPEED.def)) * 10) / 10;
