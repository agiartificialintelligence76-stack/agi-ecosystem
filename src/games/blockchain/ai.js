// BLOCKCHAIN's player (2026-11-08): plays the demo (`?demo`, the arcade's preview) and the title screen's little board.
// Greedy with a look one drop ahead: it tries every piece in every place, keeps the best few, and for each of those
// looks at the best next drop of the pieces left. A drop is worth its clears (several at once worth more), keeping the
// chain alive, and the board it leaves: few holes, smooth edges, the middle open, room for the big pieces. Pure and
// deterministic (no dice: ties go to the first piece and the first place), so the same run plays the same way.
import { rng as dice } from '../kit/fx.js';
import { PIECES, PIECE, N, CELLS, fits, fitsAnywhere, apply, nextChain, filled, CHAIN_GRACE } from './rules.js';
import { createGame, play } from './run.js';

const BIG = [PIECE['o3-0'], PIECE['i5-0'], PIECE['i5-1'], PIECE['bigl-0']].map((t) => PIECES[t]);
const BIG_BONUS = [12, 6, 6, 3];

// how good a board is to keep playing on (higher is better)
export function boardValue(b) {
  let blocks = 0, holes = 0, pockets = 0, trans = 0, middle = 0;
  for (let y = 0; y < N; y++) {
    let prev = 1;
    for (let x = 0; x < N; x++) {
      const i = y * N + x, f = b[i] ? 1 : 0;
      if (f !== prev) trans++;
      prev = f;
      if (f) {
        blocks++;
        if (x >= 2 && x <= 5 && y >= 2 && y <= 5) middle++;
      } else {
        const walls = (y === 0 || b[i - N] ? 1 : 0) + (y === N - 1 || b[i + N] ? 1 : 0)
          + (x === 0 || b[i - 1] ? 1 : 0) + (x === N - 1 || b[i + 1] ? 1 : 0);
        if (walls === 4) holes++;
        else if (walls === 3) pockets++;
      }
    }
    if (prev !== 1) trans++;
  }
  for (let x = 0; x < N; x++) {
    let prev = 1;
    for (let y = 0; y < N; y++) {
      const f = b[y * N + x] ? 1 : 0;
      if (f !== prev) trans++;
      prev = f;
    }
    if (prev !== 1) trans++;
  }
  let v = -blocks - holes * 14 - pockets * 3 - trans * 1.6 - middle * 0.6;
  for (let k = 0; k < BIG.length; k++) if (fitsAnywhere(b, BIG[k])) v += BIG_BONUS[k];
  return v;
}

// How it weighs things. PLAIN: steady. SHOW (the demo and the title's board): it likes clearing several lines at
// once more, lines that are nearly full (so it sets up doubles and triples for the camera) and keeping the chain going.
const PLAIN = Object.freeze({ multi: 30, w6: 0, w7: 0, keep: 1 });
const SHOW = Object.freeze({ multi: 90, w6: 2, w7: 5, keep: 3 });
function nearLines(b, w6, w7) {
  if (!w6 && !w7) return 0;
  let v = 0;
  for (let r = 0; r < N; r++) { let k = 0; for (let c = 0; c < N; c++) if (b[r * N + c]) k++; if (k === N - 1) v += w7; else if (k === N - 2) v += w6; }
  for (let c = 0; c < N; c++) { let k = 0; for (let r = 0; r < N; r++) if (b[r * N + c]) k++; if (k === N - 1) v += w7; else if (k === N - 2) v += w6; }
  return v;
}

// what one drop is worth: its clears, the chain, and the board it leaves
function dropValue(a, chain, misses, next, b, W) {
  let v = 0;
  if (a.lines) {
    v += 40 * a.lines + W.multi * a.lines * a.lines + 18 + 4 * W.keep * Math.min(next.chain, 10);
    if (!filled(b)) v += 400;
  } else if (chain > 0 && misses >= CHAIN_GRACE) {
    v -= W.keep * (15 + 6 * Math.min(chain, 10));
  }
  return v + boardValue(b) + nearLines(b, W.w6, W.w7);
}

// every drop of the tray's pieces on this board: { slot, t, x, y, b (the board after), a, ch, v }
function drops(board, tray, chain, misses, W) {
  const out = [];
  for (let slot = 0; slot < 3; slot++) {
    const t = tray[slot];
    if (t < 0) continue;
    const p = PIECES[t];
    for (let y = 0; y + p.h <= N; y++) {
      for (let x = 0; x + p.w <= N; x++) {
        if (!fits(board, p, x, y)) continue;
        const b = board.slice();
        const a = apply(b, p, x, y);
        const ch = nextChain(chain, misses, a.lines > 0);
        out.push({ slot, t, x, y, b, a, ch, v: dropValue(a, chain, misses, ch, b, W) });
      }
    }
  }
  return out;
}

// The best drop for run state s: { slot, x, y, value }, or null when nothing fits
export function chooseMove(s, { beam = 6, ahead = 0.65, show = false } = {}) {
  const W = show ? SHOW : PLAIN;
  const first = drops(s.board, s.tray, s.chain, s.misses, W);
  if (!first.length) return null;
  const order = first.map((d, i) => i).sort((i, j) => first[j].v - first[i].v || i - j);
  const left = s.tray.filter((t) => t >= 0).length;
  let best = null, bestV = -Infinity;
  for (const i of order.slice(0, beam)) {
    const d = first[i];
    let v = d.v;
    if (left > 1) {
      // the pieces left after this drop: their best next drop, and each one that would fit nowhere
      const tray2 = s.tray.slice();
      tray2[d.slot] = -1;
      let next = -Infinity, dead = 0;
      for (let slot = 0; slot < 3; slot++) {
        if (tray2[slot] < 0) continue;
        const only = [-1, -1, -1];
        only[slot] = tray2[slot];
        const nx = drops(d.b, only, d.ch.chain, d.ch.misses, W);
        if (!nx.length) { dead++; continue; }
        for (const e of nx) if (e.v > next) next = e.v;
      }
      v += next === -Infinity ? -1000 : ahead * next;
      v -= dead * 120;
    }
    if (v > bestV) { bestV = v; best = d; }
  }
  return { slot: best.slot, x: best.x, y: best.y, value: bestV };
}

// ---------- the demo's opening: a board half full, chosen so the first drops already clear lines ----------
// A board of piece-shaped clusters (like a run in its middle), with no full line and about 45 % of it filled.
export function messyBoard(roll, fill = 0.45) {
  const b = new Uint8Array(CELLS);
  const target = Math.round(CELLS * fill);
  const pool = PIECES.map((p, i) => i).filter((i) => PIECES[i].n >= 2 && PIECES[i].n <= 5);
  for (let tries = 0; tries < 600 && filled(b) < target; tries++) {
    const p = PIECES[roll.pick(pool)];
    const x = roll.int(0, N - p.w), y = roll.int(0, N - p.h);
    if (!fits(b, p, x, y)) continue;
    const o = y * N + x;
    for (const d of p.offs) b[o + d] = p.color + 1;
    // never a full line (it would just sit there): take the piece back
    let full = false;
    for (let r = y; r < y + p.h && !full; r++) { let k = 0; for (let c = 0; c < N; c++) if (b[r * N + c]) k++; if (k === N) full = true; }
    for (let c = x; c < x + p.w && !full; c++) { let k = 0; for (let r = 0; r < N; r++) if (b[r * N + c]) k++; if (k === N) full = true; }
    if (full) for (const d of p.offs) b[o + d] = 0;
  }
  return b;
}

// → { board, seed }: of a few seeded candidates, the one whose first drops (played by chooseMove) clear the most: the very
// first drop clears if any can, several lines at once count a lot, and so do drops 7 to 16 (the arcade's preview is
// recorded a few seconds in) with a chain that never breaks there. createGame({ seed, board }) then plays exactly as it
// was tried.
export const WINDOW = Object.freeze([7, 17]);
export function demoOpening(seed, { tries = 24, drops: n = 18, show = true } = {}) {
  const roll = dice((seed * 2654435761) >>> 0 || 1);
  let pick = null, pickV = -Infinity;
  for (let k = 0; k < tries; k++) {
    const board = messyBoard(roll, 0.42 + roll.next() * 0.08);
    const runSeed = ((seed * 7919 + k * 104729) >>> 0) || 1;
    const s = createGame({ seed: runSeed, board });
    let v = 0;
    for (let m = 0; m < n && !s.over; m++) {
      const mv = chooseMove(s, { show });
      if (!mv) break;
      const r = play(s, mv.slot, mv.x, mv.y);
      const seen = m >= WINDOW[0] && m < WINDOW[1];
      if (r.lines) v += (seen ? 2 : 1) * (r.lines * 10 + (r.lines > 1 ? 40 + 30 * (r.lines - 2) : 0));
      else if (m === 0) v -= 400;     // the very first drop clears (fireworks at once), whenever a candidate can
      if (r.broke && seen) v -= 40;
    }
    if (s.over) v -= 200;
    if (v > pickV) { pickV = v; pick = { board, seed: runSeed }; }
  }
  return pick;
}

