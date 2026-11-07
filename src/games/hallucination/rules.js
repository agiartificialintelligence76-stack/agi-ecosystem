// HALLUCINATION (2026-11-08): the rules of a run, pure (no DOM): the clock of each scene, what a find is worth, combos,
// the cost of a wrong tap, hints and blinks, the endless run's levels and the daily scene's seed. ./game.js calls these.
import { hitTest } from './scene.js';

export const RULES = Object.freeze({
  timeBase: 60, timeStep: 2.5, timeMin: 35,       // a scene's clock: 60 s, 2.5 s less each level, never under 35 s
  wrong: 3,                                        // a wrong tap: −3 s (the daily: +3 s)
  comboWindow: 2.5, comboMax: 5,                   // finds within 2.5 s of each other: ×2, ×3 … ×5
  findBase: 100, speedMax: 60, speedDecay: 6,      // a find: 100 + up to 60 for speed (6 less a second since the last one)
  hintedFind: 50,                                  // a find she confessed: 50, no combo
  clearBase: 250, clearPerSecond: 15,              // a scene cleared: 250 + 15 a second left
  hintsStart: 2, hintEvery: 3, hintsMax: 5,        // 2 hints, +1 every 3 scenes
  blinksStart: 2, blinkTime: 1.2,                  // 2 blinks a run, 1.2 s each
  tapRadiusPx: 26,                                 // the forgiving radius of a tap, in CSS px (at least 24)
  dailyLevel: 4, dailyHint: 8, dailyBlink: 4, dailyCap: 300,
});

export const sceneTime = (level) => Math.max(RULES.timeMin, RULES.timeBase - RULES.timeStep * (Math.max(1, level) - 1));

// a run: mode 'endless' (scene after scene until a clock runs out) or 'daily' (one scene, timed: lower is better)
export function createRun({ mode = 'endless', seed = 1 } = {}) {
  return {
    mode, seed: seed >>> 0, level: 1, score: 0, found: 0, scenes: 0, wrongs: 0,
    hints: mode === 'daily' ? 1 : RULES.hintsStart, hintsUsed: 0,
    blinks: mode === 'daily' ? 1 : RULES.blinksStart, blinksUsed: 0,
    combo: 0, bestCombo: 0, lastFind: -1e9,
    t: 0, timeMax: sceneTime(1), timeLeft: sceneTime(1), elapsed: 0,
    sceneFound: [], hinted: -1, cleared: false, over: false,
  };
}
// a new scene begins (its clock full)
export function startScene(run, nDiffs = 5) {
  run.t = 0;
  run.timeMax = run.mode === 'daily' ? RULES.dailyCap : sceneTime(run.level);
  run.timeLeft = run.timeMax;
  run.sceneFound = Array.from({ length: nDiffs }, () => false);
  run.hinted = -1;
  run.lastFind = -1e9;
  run.combo = 0;
  run.cleared = false;
  return run;
}
// the clock: returns true when it has just run out
export function tick(run, dt) {
  if (run.over || run.cleared) return false;
  run.t += dt;
  if (run.mode === 'daily') {
    run.elapsed += dt;
    if (run.elapsed >= RULES.dailyCap) { run.elapsed = RULES.dailyCap; run.over = true; return true; }
    return false;
  }
  run.timeLeft = Math.max(0, run.timeLeft - dt);
  if (run.timeLeft <= 0) { run.over = true; return true; }
  return false;
}
export const allFound = (run) => run.sceneFound.length > 0 && run.sceneFound.every(Boolean);

// a tap at (x, y) in page units, `rad` page units forgiving. → { type: 'find', i, points, combo } | { type: 'again', i } |
// { type: 'wrong', penalty }
export function tap(run, sc, x, y, rad) {
  if (run.over || run.cleared) return null;
  const h = hitTest(sc, x, y, rad, run.sceneFound);
  if (h.hit >= 0) return find(run, h.hit);
  if (h.again != null) return { type: 'again', i: h.again };
  run.wrongs++;
  run.combo = 0;
  if (run.mode === 'daily') run.elapsed += RULES.wrong;
  else run.timeLeft = Math.max(0, run.timeLeft - RULES.wrong);
  return { type: 'wrong', penalty: RULES.wrong };
}
export function find(run, i) {
  if (run.sceneFound[i]) return { type: 'again', i };
  run.sceneFound[i] = true;
  run.found++;
  let points;
  if (i === run.hinted) {
    points = RULES.hintedFind;
    run.combo = 0;
    run.hinted = -1;
  } else {
    const since = run.t - run.lastFind;
    run.combo = since <= RULES.comboWindow ? Math.min(RULES.comboMax, run.combo + 1) : 1;
    const speed = Math.max(0, Math.round(RULES.speedMax - RULES.speedDecay * Math.min(since, run.t)));
    points = (RULES.findBase + speed) * run.combo;
  }
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  run.lastFind = run.t;
  run.score += points;
  const done = allFound(run);
  if (done) run.cleared = true;
  return { type: 'find', i, points, combo: run.combo, cleared: done };
}
// the scene is cleared: its bonus for the time left (endless), the next level, a hint every 3 scenes
export function clearScene(run) {
  const bonus = run.mode === 'daily' ? 0 : RULES.clearBase + Math.round(run.timeLeft * RULES.clearPerSecond);
  run.score += bonus;
  run.scenes++;
  run.level++;
  let hint = false;
  if (run.mode === 'endless' && run.scenes % RULES.hintEvery === 0 && run.hints < RULES.hintsMax) { run.hints++; hint = true; }
  return { bonus, hint };
}
// "ask her": she confesses one she made up (the one with the least time spent near it: the first not found)
export function useHint(run, pick = (list) => list[0]) {
  if (run.over || run.cleared || run.hints <= 0 || run.hinted >= 0) return -1;
  const open = run.sceneFound.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  if (!open.length) return -1;
  run.hints--;
  run.hintsUsed++;
  run.hinted = pick(open);
  if (run.mode === 'daily') run.elapsed += RULES.dailyHint;
  return run.hinted;
}
export function useBlink(run) {
  if (run.over || run.cleared || run.blinks <= 0) return false;
  run.blinks--;
  run.blinksUsed++;
  if (run.mode === 'daily') run.elapsed += RULES.dailyBlink;
  return true;
}

// ---------- the endless run's scenes and the daily scene ----------
// the endless run's scene seeds: one after another from the run's seed
export const sceneSeed = (runSeed, index) => ((Math.imul(runSeed ^ 0x9e3779b9, 2654435761) + index * 0x85ebca6b) >>> 0) || 1;
// the places come round in a shuffled order (no place twice in a row)
export function templateOrder(runSeed, ids, n = 40) {
  const out = [];
  let a = (runSeed >>> 0) || 7;
  const next = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  while (out.length < n) {
    const deck = ids.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (out.length && deck[0] === out[out.length - 1]) deck.push(deck.shift());
    out.push(...deck);
  }
  return out.slice(0, n);
}
// the local date's key and its seed (everyone on the same date gets the same scene)
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function dailySeed(key) {
  let h = 2166136261;
  for (const ch of `hallucination:${key}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}
// the daily's place: each day the next one (by days since 2026-01-01), so a week shows them all
export function dailyTemplate(key, ids) {
  const [y, m, d] = key.split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5);
  return ids[((days % ids.length) + ids.length) % ids.length];
}
export const fmtSecs = (s) => { const v = Math.max(0, s); const m = Math.floor(v / 60); const r = v - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
