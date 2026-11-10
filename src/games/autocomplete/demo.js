// AUTOCOMPLETE (2026-11-09): a player of its own, for the arcade's preview (`?demo`) and the title's board. It reads the
// board with the solver, asks itself what AGI-1 would guess for each word it could play, and plays like someone who
// loves to surprise her: mostly words longer than her guess, some other words, now and then her own pick. It swipes at a
// person's pace (about 0.12 s a key), so the path, her strip and her face all move as they would for a player.
// Seeded dice only (never Math.random): `?demo&seed=7` repeats exactly.
import { rng as dice } from '../kit/fx.js';
import { predict, lockLength, surpriseOf, COLS, ROWS } from './solver.js';
import { scoreWord } from './rules.js';
import { newBoard, refill } from './board.js';

// the words people know best (her vocabulary's first part): what the demo plays
export const KNOWN = 16000;

// what playing a word would do here: { word, path, kind, pick, points, tokens, glitch }
export function evaluate(tiles, dict, word, info) {
  const n = lockLength(tiles, info.path);
  const g = n ? predict(tiles, dict, info.path.slice(0, n), { k: 1 }) : [];
  const pick = g[0] ? g[0].word : null;
  const kind = surpriseOf(word, pick);
  const glitch = info.path.some((i) => tiles[i] && tiles[i].glitch);
  const { points } = scoreWord({ word, tokens: info.tokens, kind, glitch });
  return { word, path: info.path, kind, pick, points, tokens: info.tokens, glitch };
}

// the next word: { … evaluate() }. `words`: solve()'s map.
export function chooseWord(tiles, dict, words, rng) {
  const options = [];
  for (const [w, info] of words) {
    const r = dict.rankOf(w);
    if (r < 0 || r >= KNOWN || w.length > 9) continue;
    options.push(evaluate(tiles, dict, w, info));
  }
  if (!options.length) return null;
  const byPoints = (a, b) => b.points - a.points || (a.word < b.word ? -1 : 1);
  const glitchy = options.filter((o) => o.glitch && o.word.length >= 4);
  if (glitchy.length && rng.next() < 0.8) return glitchy.sort(byPoints)[0];
  const roll = rng.next();
  let pool = roll < 0.55 ? options.filter((o) => o.kind === 'longer' && o.word.length >= 5 && o.pick)
    : roll < 0.86 ? options.filter((o) => o.kind === 'surprise' && o.word.length >= 4)
      : options.filter((o) => o.kind === 'predictable' && o.word.length >= 4);
  if (!pool.length) pool = options.filter((o) => o.word.length >= 4);
  if (!pool.length) pool = options;
  pool.sort(byPoints);
  return pool[Math.floor(rng.next() * Math.min(3, pool.length))];
}

// The recorded opening: a board where a 4–5 letter word surprises her (A), then a 6–8 letter word with a token beats
// her guess by being longer (B), A never touching B's keys, B still there after A's refill (the same dice). → { tiles,
// rngState (the dice after the board), A, B, glitchCell } or null
export function planOpening(dict, seed) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = dice(((seed * 7919) ^ (attempt * 104729)) >>> 0 || 1);
    const { tiles, check } = newBoard(dict, r);
    const known = [...check.words].filter(([w]) => { const k = dict.rankOf(w); return k >= 0 && k < KNOWN; });
    const evals = known.map(([w, info]) => evaluate(tiles, dict, w, info));
    const Bs = evals.filter((e) => e.word.length >= 6 && e.word.length <= 8 && e.tokens >= 1 && e.kind === 'longer' && e.pick && e.pick.length <= 5)
      .sort((a, b) => b.points - a.points);
    if (!Bs.length) continue;
    const As = evals.filter((e) => e.word.length >= 4 && e.word.length <= 5 && e.kind === 'surprise' && e.pick)
      .sort((a, b) => b.points - a.points || (a.word < b.word ? -1 : 1));
    for (const B of Bs.slice(0, 4)) {
      for (const A of As) {
        if (A.path.some((i) => B.path.includes(i))) continue;
        const sim = refill(tiles, A.path, dict, dice(r.state));
        const info = sim.check.words.get(B.word);
        if (!info) continue;
        const eB = evaluate(sim.tiles, dict, B.word, info);
        if (eB.kind !== 'longer' || eB.tokens < 1) continue;
        // the glitch key: off both words, a single letter that some word she knows uses
        const used = new Set([...A.path, ...B.path]);
        let glitchCell = -1;
        for (const [, inf] of known) for (const i of inf.path) if (!used.has(i) && !tiles[i].token && glitchCell < 0) glitchCell = i;
        return { tiles, rngState: r.state, A, B: eB, glitchCell };
      }
    }
  }
  return null;
}

// A finger that swipes a path: reaches the first key, presses, glides key to key, holds a moment, lets go.
// update(dt, { start(cell), enter(cell), release() }) → the finger { x, y (in cells: a key's centre is col + .5,
// row + .5), down, show, alpha }
export function createSwiper({ pace = 0.12, reach = 0.2, hold = 0.12 } = {}) {
  let job = null;
  const finger = { x: COLS / 2, y: ROWS + 0.5, down: false, show: false, alpha: 0 };
  const at = (i) => ({ x: (i % COLS) + 0.5, y: Math.floor(i / COLS) + 0.5 });
  const smooth = (t) => t * t * (3 - 2 * t);
  return {
    finger,
    get busy() { return Boolean(job); },
    // swipe `path`, starting `delay` seconds from now
    start(path, delay = 0) { job = { path, phase: 'wait', t: -delay, k: 1, from: { x: finger.x, y: finger.y } }; },
    cancel() { job = null; finger.down = false; },
    update(dt, hooks) {
      if (!job) {
        finger.alpha = Math.max(0, finger.alpha - dt * 3);
        finger.show = finger.alpha > 0.02;
        return finger;
      }
      job.t += dt;
      const p0 = at(job.path[0]);
      if (job.phase === 'wait') {
        if (job.t < 0) { finger.alpha = Math.max(0, finger.alpha - dt * 3); finger.show = finger.alpha > 0.02; return finger; }
        job.phase = 'reach'; job.t = 0; job.from = { x: finger.x, y: finger.y };
      }
      if (job.phase === 'reach') {
        const k = Math.min(1, job.t / reach), e = smooth(k);
        finger.x = job.from.x + (p0.x - job.from.x) * e;
        finger.y = job.from.y + (p0.y - job.from.y) * e;
        finger.alpha = Math.min(1, finger.alpha + dt * 6); finger.show = true; finger.down = false;
        if (k >= 1) { job.phase = 'swipe'; job.t = 0; finger.down = true; hooks.start(job.path[0]); }
        return finger;
      }
      if (job.phase === 'swipe') {
        if (job.k >= job.path.length) { job.phase = 'hold'; job.t = 0; return finger; }
        const a = at(job.path[job.k - 1]), b = at(job.path[job.k]);
        const k = Math.min(1, job.t / pace), e = smooth(k);
        finger.x = a.x + (b.x - a.x) * e; finger.y = a.y + (b.y - a.y) * e;
        if (k >= 1) { hooks.enter(job.path[job.k]); job.k++; job.t = 0; }
        return finger;
      }
      if (job.phase === 'hold' && job.t >= hold) {
        finger.down = false;
        hooks.release();
        job = null;
      }
      return finger;
    },
  };
}
