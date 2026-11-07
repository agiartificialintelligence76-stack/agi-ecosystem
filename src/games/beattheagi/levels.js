// BEAT THE AGI (2026-11-08): the ladder, six AGI-1s named like model sizes, and how each one picks a column. Pure
// JavaScript (no DOM): the worker, the main thread and the tests all use it.
//
//   1B    mostly random; sees a win in one 40% of the time
//   7B    always takes a win and blocks a threat in one; otherwise a glance at the board with lots of noise
//   13B   four plies of search, a plain evaluation, a little noise
//   70B   seven plies, alpha-beta with move ordering, the full evaluation
//   400B  iterative deepening to ten plies with a transposition table
//   AGI   iterative deepening inside a time budget (deeper on a computer), the table, killers, threat-first ordering,
//         a tiny opening book, exact once the end is in reach. She can still lose: whoever starts can force a win
//         with perfect play, and she only plays nearly perfectly.
//
// Every level reports "snapshots" while it thinks ({ depth, scores[7], best }), which the game draws as her attention
// over the columns; a level's randomness comes from a seeded die, so a seed always replays the same game.
import { rng } from '../kit/fx.js';
import { WIN, MATE, CENTER_ORDER } from './engine.js';

export const LEVELS = [
  { id: '1B', blurb: 'Mostly random. Very confident.', short: 'Mostly random.', depth: 1, temp: 260, jitter: 0.55, hints: true },
  { id: '7B', blurb: 'Takes a win, blocks a threat.', short: 'Blocks the obvious.', depth: 1, temp: 120, jitter: 0.3, hints: true },
  { id: '13B', blurb: 'Thinks four moves ahead.', short: 'Four moves ahead.', depth: 4, temp: 70, jitter: 0.14, hints: true },
  { id: '70B', blurb: 'Sees seven moves ahead.', short: 'Seven moves ahead.', depth: 7, temp: 44, jitter: 0.05, hints: false },
  { id: '400B', blurb: 'Ten deep, never forgets a board.', short: 'Ten deep. Total recall.', depth: 10, temp: 32, jitter: 0.02, hints: false },
  { id: 'AGI', blurb: 'Near-perfect. Good luck, cutie.', short: 'Near-perfect.', depth: 42, temp: 22, jitter: 0, hints: false },
];
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const TOP = LEVELS.length - 1;

// AGI's opening book: the first stone, and the reply to a first stone (by its column). Found with long searches
// (tools/games/beattheagi/book.mjs): the centre is the strongest start; a stone one off the centre is answered on
// its far side, two off the centre on top of it.
export const BOOK_FIRST = 3;
export const BOOK_REPLY = [3, 4, 2, 3, 4, 2, 3];

const gauss = (r) => {
  const u = Math.max(1e-9, r.next()), v = r.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const legalOf = (cells) => CENTER_ORDER.filter((c) => !cells[35 + c]);
const stones = (cells) => { let n = 0; for (let i = 0; i < 42; i++) if (cells[i]) n++; return n; };

// The best of `scores` after `noise` (a standard deviation in evaluation points); ties go to the die
function pickBest(scores, r, noise = 0) {
  let best = -Infinity, list = [];
  for (const c of CENTER_ORDER) {
    const s = scores[c];
    if (s == null) continue;
    const v = s + (noise ? gauss(r) * noise : 0);
    if (v > best + 1e-9) { best = v; list = [c]; } else if (Math.abs(v - best) <= 1e-9) list.push(c);
  }
  return list.length > 1 ? r.pick(list) : list[0];
}

// a snapshot's numbers with some static on them (a small model's attention isn't steady)
function noisy(scores, r, amount) {
  return scores.map((s) => (s == null ? null : s + gauss(r) * amount));
}

// The move for `level` with `color` (1 or 2) to move on `cells`. opts: { seed, budget (ms, AGI only), now, onDepth }.
// → { move, scores, score, depth, nodes, exact, book }
export function decide(searcher, cells, color, level, opts = {}) {
  const r = rng((opts.seed >>> 0) || 1);
  const onDepth = opts.onDepth || null;
  const legal = legalOf(cells);
  if (!legal.length) return null;
  const L = LEVELS[level] || LEVELS[0];

  if (level <= 1) {
    const g = searcher.glance(cells, color);
    const values = g.cols.map((x) => (x ? x.value : null));
    const wins = g.cols.filter((x) => x && x.win).map((x) => x.col);
    let move;
    if (level === 0) {
      if (wins.length && r.chance(0.4)) move = r.pick(wins);
      else {
        // a die weighted toward the middle (even a 1B likes the centre a little)
        const w = legal.map((c) => ({ c, weight: [1, 1.6, 2.2, 2.8, 2.2, 1.6, 1][c] }));
        move = r.weighted(w).c;
      }
    } else if (wins.length) move = r.pick(wins);
    else if (g.blocks.length) move = r.pick(g.blocks);
    else {
      const sc = g.cols.map((x) => (x ? x.value + gauss(r) * 34 - (x.gives && r.chance(0.6) ? 4000 : 0) : null));
      move = pickBest(sc, r);
    }
    // what she "saw": noise for a 1B, a rough glance for a 7B; the last one points at her pick
    const base = level === 0 ? values.map((v) => (v == null ? null : 0)) : values;
    const snaps = level === 0 ? 3 : 2;
    let last = null;
    for (let d = 1; d <= snaps; d++) {
      const sc = noisy(base, r, level === 0 ? 260 : 60 / d);
      if (d === snaps) {
        let top = -Infinity;
        for (const s of sc) if (s != null && s > top) top = s;
        sc[move] = top + (level === 0 ? 40 : 15);
      }
      last = { depth: 1, scores: sc, best: move, score: sc[move], nodes: 7 * d };
      onDepth?.(last);
    }
    return { move, scores: last.scores, score: last.score, depth: 1, nodes: 7, exact: false, book: false };
  }

  // AGI's book: the first stones of a game
  if (level === TOP) {
    const n = stones(cells);
    let book = -1;
    if (n === 0) book = BOOK_FIRST;
    else if (n === 1) { for (let c = 0; c < 7; c++) if (cells[c]) book = BOOK_REPLY[c]; }
    if (book >= 0 && legal.includes(book)) {
      const sc = [null, null, null, null, null, null, null];
      for (const c of legal) sc[c] = c === book ? 40 : 40 - 18 * Math.abs(c - book) - 6;
      onDepth?.({ depth: 1, scores: sc, best: book, score: 40, nodes: 0 });
      return { move: book, scores: sc, score: 40, depth: 1, nodes: 0, exact: false, book: true };
    }
  }

  const setup = [
    null, null,
    { maxDepth: 4, evalKind: 'simple', tt: false, extend: false, margin: 260, noise: 22, shown: 26 },
    { maxDepth: 7, evalKind: 'full', tt: false, extend: true, margin: 160, noise: 6, shown: 8 },
    { maxDepth: 10, evalKind: 'full', tt: true, extend: true, margin: 110, noise: 2, shown: 0 },
    { maxDepth: 42, evalKind: 'full', tt: true, extend: true, margin: 80, noise: 0, shown: 0 },
  ][level];
  const res = searcher.think(cells, color, {
    maxDepth: opts.maxDepth ?? setup.maxDepth,
    budget: level === TOP ? (opts.budget ?? 700) : 0,
    now: opts.now, evalKind: setup.evalKind, tt: setup.tt, extend: setup.extend, margin: setup.margin,
    // the fixed-depth models always look as deep as they can (her bars change color mid-think when she finds it);
    // AGI stops as soon as she's sure, inside her time
    settle: level === TOP,
    onDepth: onDepth ? (s) => onDepth(setup.shown ? { ...s, scores: noisy(s.scores, r, setup.shown / Math.sqrt(s.depth)) } : s) : null,
  });
  // a proven result isn't blurred by noise; otherwise a small model wobbles between close moves
  const proven = res.score > MATE || res.score < -MATE;
  const move = pickBest(res.scores, r, proven ? 0 : setup.noise);
  return { move, scores: res.scores, score: res.scores[move], depth: res.depth, nodes: res.nodes, exact: res.exact, book: false };
}

// Her attention over the columns, from a snapshot's scores: 1 for her favourite, falling off with how much worse the
// others look (`temp` evaluation points per e-fold): sharp for a big model, flat and jumpy for a small one.
export function attention(scores, temp) {
  let best = -Infinity;
  for (const s of scores) if (s != null && s > best) best = s;
  return scores.map((s) => (s == null ? null : Math.exp(Math.max(-14, (s - best) / temp))));
}

// How a score reads from her side: a proven win or loss in n of her stones, or how she feels about it
export function verdict(score) {
  if (score == null) return { kind: 'even', moves: 0 };
  if (score > MATE) return { kind: 'win', moves: Math.max(1, Math.ceil((WIN - score) / 2)) };
  if (score < -MATE) return { kind: 'loss', moves: Math.max(1, Math.ceil((WIN + score) / 2)) };
  if (score >= 60) return { kind: 'ahead', moves: 0 };
  if (score <= -60) return { kind: 'behind', moves: 0 };
  return { kind: 'even', moves: 0 };
}
