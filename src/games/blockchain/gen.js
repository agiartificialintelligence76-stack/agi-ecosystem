// BLOCKCHAIN's dealer (2026-11-08): each new tray of three pieces, fair and seeded. Pure (the dice come in), so
// tests/blockchain.test.js checks its promises in Node:
//   · at least one piece of every new tray fits the board as it is (it draws again, then hands one that fits);
//   · a crowded board gets smaller pieces (each block over three counts against a piece);
//   · never three huge pieces at once (one at most in the first trays, two after);
//   · the run grows harder slowly (fewer easy pieces, more awkward ones, over its first 40 trays);
//   · now and then, on a crowded board, one piece that can clear a line (a helping hand, never a sure thing).
import { PIECES, N, CELLS, filled, fits, fitsAnywhere, EASY, AWKWARD } from './rules.js';

export const DEAL = Object.freeze({
  earlyTurns: 6, hugeEarly: 1, hugeLater: 2,   // huge pieces a tray: the first trays, then
  rerolls: 14,                                 // draws before it hands a piece that fits
  crowdFrom: 0.34, crowdK: 4.2,                // how the board's crowding pushes toward small pieces
  helpFrom: 0.42, helpChance: 0.4,             // a crowded board: this often, one piece that can clear a line
  rampTurns: 40,                               // trays until the difficulty curve is at its top
});

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// how often each piece comes now (its base weight, the run's length, the board's crowding)
export function weightOf(p, fill, turn) {
  let w = p.weight;
  const d = clamp(turn / DEAL.rampTurns, 0, 1);
  if (EASY.has(p.family)) w *= 1 - 0.45 * d;
  if (AWKWARD.has(p.family)) w *= 1 + 0.7 * d;
  if (fill > DEAL.crowdFrom) w *= clamp(Math.exp(-DEAL.crowdK * (fill - DEAL.crowdFrom) * (p.n - 3)), 0.04, 3);
  return w;
}

function pickWeighted(weights, roll) {
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0)) return 0;
  let r = roll.next() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return 0;
}

// each piece's blocks per row and per column of its own box (to see which lines a drop fills)
const ROWN = PIECES.map((p) => { const a = new Array(p.h).fill(0); for (const [, y] of p.cells) a[y]++; return a; });
const COLN = PIECES.map((p) => { const a = new Array(p.w).fill(0); for (const [x] of p.cells) a[x]++; return a; });

// can piece number t clear at least one line somewhere on this board?
export function canClear(board, t) {
  const p = PIECES[t];
  const rowC = new Array(N).fill(0), colC = new Array(N).fill(0);
  for (let i = 0; i < CELLS; i++) if (board[i]) { rowC[(i / N) | 0]++; colC[i % N]++; }
  const rn = ROWN[t], cn = COLN[t];
  for (let y = 0; y + p.h <= N; y++) {
    for (let x = 0; x + p.w <= N; x++) {
      let hit = false;
      for (let k = 0; k < p.h && !hit; k++) if (rn[k] && rowC[y + k] + rn[k] === N) hit = true;
      for (let k = 0; k < p.w && !hit; k++) if (cn[k] && colC[x + k] + cn[k] === N) hit = true;
      if (hit && fits(board, p, x, y)) return true;
    }
  }
  return false;
}

// A new tray: three piece numbers (indexes into PIECES), for `board` on the run's `turn`-th tray
export function dealTray(board, roll, turn = 0) {
  const fill = filled(board) / CELLS;
  const weights = PIECES.map((p) => weightOf(p, fill, turn));
  const hugeCap = turn < DEAL.earlyTurns ? DEAL.hugeEarly : DEAL.hugeLater;
  const draw = () => {
    const tray = [];
    let huge = 0;
    for (let k = 0; k < 3; k++) {
      let t = pickWeighted(weights, roll);
      // too many huge ones, or the same shape twice: draw again (a few times)
      for (let tries = 0; tries < 10 && ((PIECES[t].huge && huge >= hugeCap) || tray.includes(t)); tries++) t = pickWeighted(weights, roll);
      if (PIECES[t].huge && huge >= hugeCap) t = pickWeighted(weights.map((w, i) => (PIECES[i].huge ? 0 : w)), roll);
      if (PIECES[t].huge) huge++;
      tray.push(t);
    }
    return tray;
  };
  const anyFits = (tray) => tray.some((t) => fitsAnywhere(board, PIECES[t]));
  let tray = draw();
  for (let i = 0; i < DEAL.rerolls && !anyFits(tray); i++) tray = draw();
  if (!anyFits(tray)) {
    // the last resort: a piece that fits, by its weight (a single block always fits a board with room)
    const ok = weights.map((w, i) => (!PIECES[i].huge && fitsAnywhere(board, PIECES[i]) ? Math.max(w, 1e-6) : 0));
    tray[0] = pickWeighted(ok, roll);
  }
  // a crowded board: now and then a piece that can clear a line, if none of the three can
  if (fill >= DEAL.helpFrom && roll.next() < DEAL.helpChance && !tray.some((t) => canClear(board, t))) {
    const slot = roll.int(0, 2);
    const hugeOthers = tray.filter((t, k) => k !== slot && PIECES[t].huge).length;
    const ok = weights.map((w, i) => ((PIECES[i].huge && hugeOthers >= hugeCap) || !canClear(board, i) ? 0 : w));
    if (ok.some((w) => w > 0)) tray[slot] = pickWeighted(ok, roll);
  }
  return tray;
}
