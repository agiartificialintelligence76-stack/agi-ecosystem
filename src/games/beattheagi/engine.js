// BEAT THE AGI (2026-11-08): the four-in-a-row engine. Plain JavaScript, no DOM: it runs in a Web Worker (./worker.js),
// on the main thread (the title's quiet game, ?demo, a browser without workers) and in Node (tests/beattheagi.test.js).
//
// The board is a bitboard in the classic 7 × (6 + 1) layout: column c, row r (0 at the bottom) is bit c * 7 + r, with
// a spare bit on top of each column so shifted lines never wrap into the next one. JavaScript's bit operators are 32-bit,
// so a board is two halves: bits 0-31 (`l`) and 32-48 (`h`).
//
// The search is negamax with alpha-beta and principal-variation windows, a transposition table, killer moves and
// threat-first ordering, plus two prunings that never change the game's value: a single threat must be blocked (and
// that forced reply doesn't cost depth), and nobody plays right under the other side's winning cell. The evaluation
// counts the cells where each side would complete four (a "threat"), weighted by row parity (the side that moved first
// wants its threats on odd rows, the other on even rows, because of who will be forced to fill the board last), plus how
// central its stones are.
//
// The UI's board is `cells`: 42 numbers, index r * 7 + c (row 0 at the bottom), 0 empty, 1 pink, 2 mint.

export const COLS = 7;
export const ROWS = 6;
export const CELLS = 42;
export const WIN = 10000;            // a win on stone n from now scores WIN - n
export const MATE = WIN - 100;       // beyond ±MATE a score is a proven win or loss
const INF = 30000;
export const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

// how many lines of four run through each cell (row 0 at the bottom): the centre is worth the most
export const CELL_WEIGHT = [
  3, 4, 5, 7, 5, 4, 3,
  4, 6, 8, 10, 8, 6, 4,
  5, 8, 11, 13, 11, 8, 5,
  5, 8, 11, 13, 11, 8, 5,
  4, 6, 8, 10, 8, 6, 4,
  3, 4, 5, 7, 5, 4, 3,
];

// ---------- masks ----------
let BOARD_L = 0, BOARD_H = 0, BOTTOM_L = 0, BOTTOM_H = 0, ODD_L = 0, ODD_H = 0;
const WEIGHT_BIT = new Int8Array(49);
for (let c = 0; c < COLS; c++) {
  for (let r = 0; r < ROWS; r++) {
    const b = c * 7 + r;
    const lo = b < 32 ? 1 << b : 0, hi = b >= 32 ? 1 << (b - 32) : 0;
    BOARD_L |= lo; BOARD_H |= hi;
    if (r === 0) { BOTTOM_L |= lo; BOTTOM_H |= hi; }
    if (r % 2 === 0) { ODD_L |= lo; ODD_H |= hi; }     // rows 1, 3, 5 counting from 1: the first player's
    WEIGHT_BIT[b] = CELL_WEIGHT[r * 7 + c];
  }
}
const EVEN_L = BOARD_L & ~ODD_L, EVEN_H = BOARD_H & ~ODD_H;

// Zobrist keys: one random pair per (bit, who moved first or second), from a fixed seed (the same table everywhere)
const ZL = new Int32Array(98), ZH = new Int32Array(98);
{
  let a = 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
  };
  for (let i = 0; i < 98; i++) { ZL[i] = next(); ZH[i] = next() | 1; }
}

export function pop32(x) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

// ---------- the cells where a side would complete four ----------
// winning(stones, all stones) → RL / RH: every empty cell (anywhere, playable or not) that would make four for `stones`
let RL = 0, RH = 0;
function lines(pl, ph, d) {
  const d2 = d + d, d3 = d2 + d;
  const a1l = pl << d, a1h = (ph << d) | (pl >>> (32 - d));
  const a2l = pl << d2, a2h = (ph << d2) | (pl >>> (32 - d2));
  const a3l = pl << d3, a3h = (ph << d3) | (pl >>> (32 - d3));
  const b1l = (pl >>> d) | (ph << (32 - d)), b1h = ph >>> d;
  const b2l = (pl >>> d2) | (ph << (32 - d2)), b2h = ph >>> d2;
  const b3l = (pl >>> d3) | (ph << (32 - d3)), b3h = ph >>> d3;
  let xl = a1l & a2l, xh = a1h & a2h;            // two stones on one side: the third there, or one on the other side
  RL |= xl & (a3l | b1l); RH |= xh & (a3h | b1h);
  xl = b1l & b2l; xh = b1h & b2h;
  RL |= xl & (a1l | b3l); RH |= xh & (a1h | b3h);
}
function winning(pl, ph, ml, mh) {
  RL = (pl << 1) & (pl << 2) & (pl << 3);         // three stacked under it
  RH = ((ph << 1) | (pl >>> 31)) & ((ph << 2) | (pl >>> 30)) & ((ph << 3) | (pl >>> 29));
  lines(pl, ph, 7);                               // across
  lines(pl, ph, 6);                               // down-right diagonal
  lines(pl, ph, 8);                               // up-right diagonal
  RL &= ~ml & BOARD_L;
  RH &= ~mh & BOARD_H;
}

// does a side's bitboard hold four in a row?
export function hasFour(pl, ph) {
  for (const d of [1, 7, 6, 8]) {
    const d2 = d + d;
    const ml = pl & ((pl >>> d) | (ph << (32 - d))), mh = ph & (ph >>> d);
    if ((ml & ((ml >>> d2) | (mh << (32 - d2)))) | (mh & (mh >>> d2))) return true;
  }
  return false;
}

// a board of cells as two bitboards (for tests and checks)
export function bitsOf(cells, who) {
  let l = 0, h = 0;
  for (let i = 0; i < CELLS; i++) {
    if (cells[i] !== who) continue;
    const r = (i / 7) | 0, c = i % 7, b = c * 7 + r;
    if (b < 32) l |= 1 << b; else h |= 1 << (b - 32);
  }
  return [l, h];
}

// ---------- the searcher (one per thread: it owns its table) ----------
// const s = createSearcher({ bits: 19 }); s.think(cells, color, { maxDepth, budget, … }) → { move, scores[7], depth, … }
export function createSearcher({ bits = 18 } = {}) {
  const size = 1 << bits, tmask = size - 1;
  const tKey = new Int32Array(size), tVal = new Int16Array(size), tDep = new Int8Array(size), tInf = new Uint8Array(size);
  const killers = new Int8Array(128).fill(-1);
  const MV = new Int8Array(64 * 8), SC = new Int32Array(64 * 8);
  const height = new Int8Array(7);
  const pw = new Int32Array(2);
  let cl = 0, ch = 0, ml = 0, mh = 0, moves = 0, zl = 0, zh = 0;
  let nodes = 0, stopped = false, deadline = 0, clock = null;
  let useTT = true, extendForced = true, fullEval = true, threatOrder = true;

  function clear() {
    tKey.fill(0); tDep.fill(0);
    killers.fill(-1);
  }

  function load(cells, color) {
    cl = ch = ml = mh = 0; zl = zh = 0; pw[0] = pw[1] = 0; moves = 0;
    height.fill(0);
    for (let i = 0; i < CELLS; i++) if (cells[i]) moves++;
    const other = color === 1 ? 2 : 1;
    const first = moves % 2 === 0 ? color : other;    // who moved first (their stones are "parity 0")
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const v = cells[r * 7 + c];
        if (!v) break;
        const b = c * 7 + r;
        if (b < 32) ml |= 1 << b; else mh |= 1 << (b - 32);
        if (v === color) { if (b < 32) cl |= 1 << b; else ch |= 1 << (b - 32); }
        const p = v === first ? 0 : 1;
        zl ^= ZL[b * 2 + p]; zh ^= ZH[b * 2 + p];
        pw[p] += WEIGHT_BIT[b];
        height[c] = r + 1;
      }
    }
  }

  function play(c) {
    const b = c * 7 + height[c], p = moves & 1;
    cl ^= ml; ch ^= mh;                               // the stones of the side about to move
    if (b < 32) ml |= 1 << b; else mh |= 1 << (b - 32);
    zl ^= ZL[b * 2 + p]; zh ^= ZH[b * 2 + p];
    pw[p] += WEIGHT_BIT[b];
    height[c]++; moves++;
  }
  function undo(c) {
    height[c]--; moves--;
    const b = c * 7 + height[c], p = moves & 1;
    if (b < 32) ml &= ~(1 << b); else mh &= ~(1 << (b - 32));
    cl ^= ml; ch ^= mh;
    zl ^= ZL[b * 2 + p]; zh ^= ZH[b * 2 + p];
    pw[p] -= WEIGHT_BIT[b];
  }
  // the cells where a stone can go now
  let PL = 0, PH = 0;
  function possible() {
    const s = (ml >>> 0) + (BOTTOM_L >>> 0);
    PL = (s | 0) & BOARD_L;
    PH = (mh + BOTTOM_H + (s > 4294967295 ? 1 : 0)) & BOARD_H;
  }
  const bitIn = (l, h, b) => (b < 32 ? (l >>> b) & 1 : (h >>> (b - 32)) & 1);
  // can the side to move win by dropping in column c?
  function winsNow(c) {
    if (height[c] >= ROWS) return false;
    winning(cl, ch, ml, mh);
    return bitIn(RL, RH, c * 7 + height[c]) === 1;
  }

  // the static evaluation, for the side to move; (mtl, mth): its winning cells, (otl, oth): the opponent's
  function evaluate(mtl, mth, otl, oth) {
    const s = moves & 1;                               // 0: the side to move moved first
    let v = pw[s] - pw[s ^ 1];
    const mine = pop32(mtl) + pop32(mth), theirs = pop32(otl) + pop32(oth);
    if (!fullEval) return v + 14 * (mine - theirs);
    let myGood, theirGood;
    if (s === 0) { myGood = pop32(mtl & ODD_L) + pop32(mth & ODD_H); theirGood = pop32(otl & EVEN_L) + pop32(oth & EVEN_H); }
    else { myGood = pop32(mtl & EVEN_L) + pop32(mth & EVEN_H); theirGood = pop32(otl & ODD_L) + pop32(oth & ODD_H); }
    v += 26 * (myGood - theirGood) + 9 * ((mine - myGood) - (theirs - theirGood));
    // two winning cells stacked in one column: whoever owns it usually gets one of them
    const sml = mtl & ((mtl >>> 1) | (mth << 31)), smh = mth & (mth >>> 1);
    const sol = otl & ((otl >>> 1) | (oth << 31)), soh = oth & (oth >>> 1);
    v += 32 * (pop32(sml) + pop32(smh) - pop32(sol) - pop32(soh));
    return v;
  }

  function negamax(depth, alpha, beta, ply) {
    nodes++;
    if ((nodes & 1023) === 0 && deadline && clock() > deadline) stopped = true;
    if (stopped) return 0;
    possible();
    const pl = PL, ph = PH;
    winning(cl, ch, ml, mh);
    const mtl = RL, mth = RH;
    if ((mtl & pl) | (mth & ph)) return WIN - ply - 1;             // four with the next stone
    if (moves >= CELLS - 1) return 0;                               // the last stone can't win: a draw
    const ol = cl ^ ml, oh = ch ^ mh;
    winning(ol, oh, ml, mh);
    const otl = RL, oth = RH;
    let candL, candH, forced = false;
    const fl = pl & otl, fh = ph & oth;
    if (fl | fh) {
      if (pop32(fl) + pop32(fh) > 1) return -(WIN - ply - 2);       // two threats at once: lost
      candL = fl; candH = fh; forced = true;
    } else {
      const ul = (otl >>> 1) | (oth << 31), uh = oth >>> 1;           // the cells right under their winning cells
      candL = pl & ~ul; candH = ph & ~uh;
      if (!(candL | candH)) return -(WIN - ply - 2);                 // every move hands them four
      const lowest = -(WIN - ply - 4);                               // they can't win before their second stone from here
      if (alpha < lowest) { alpha = lowest; if (alpha >= beta) return alpha; }
    }
    const highest = WIN - ply - 3;                                   // nor can we before our second
    if (beta > highest) { beta = highest; if (alpha >= beta) return beta; }
    if (depth <= 0 && !(forced && extendForced)) return evaluate(mtl, mth, otl, oth);
    const nd = forced && extendForced ? depth : depth - 1;

    // the table
    let ttMove = -1;
    const idx = zl & tmask;
    if (useTT && tKey[idx] === zh && tDep[idx]) {
      const info = tInf[idx];
      ttMove = (info >> 2) - 1;
      if (tDep[idx] - 1 >= depth) {
        let v = tVal[idx];
        if (v > MATE) v -= ply; else if (v < -MATE) v += ply;
        const f = info & 3;
        if (f === 1) return v;
        if (f === 2) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
    }

    // the moves, best first: the table's, the killers, those that make the most winning cells, the centre
    const base = ply * 8;
    let n = 0;
    const k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (let i = 0; i < 7; i++) {
      const c = CENTER_ORDER[i];
      if (height[c] >= ROWS) continue;
      const b = c * 7 + height[c];
      if (!bitIn(candL, candH, b)) continue;
      let s = 7 - i;
      if (c === ttMove) s += 1 << 20;
      else if (c === k1) s += 1 << 16;
      else if (c === k2) s += 1 << 15;
      if (threatOrder && depth >= 3 && !forced) {
        const bl = b < 32 ? 1 << b : 0, bh = b < 32 ? 0 : 1 << (b - 32);
        winning(cl | bl, ch | bh, ml | bl, mh | bh);
        s += (pop32(RL) + pop32(RH)) << 6;
      }
      let j = n++;
      while (j > 0 && SC[base + j - 1] < s) { SC[base + j] = SC[base + j - 1]; MV[base + j] = MV[base + j - 1]; j--; }
      SC[base + j] = s; MV[base + j] = c;
    }

    const a0 = alpha;
    let best = -INF, bestC = MV[base];
    for (let i = 0; i < n; i++) {
      const c = MV[base + i];
      play(c);
      let v;
      if (i === 0) v = -negamax(nd, -beta, -alpha, ply + 1);
      else {
        v = -negamax(nd, -alpha - 1, -alpha, ply + 1);
        if (v > alpha && v < beta) v = -negamax(nd, -beta, -alpha, ply + 1);
      }
      undo(c);
      if (stopped) return 0;
      if (v > best) { best = v; bestC = c; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (c !== k1) { killers[ply * 2 + 1] = k1; killers[ply * 2] = c; }
        break;
      }
    }
    if (useTT) {
      let sv = best;
      if (sv > MATE) sv += ply; else if (sv < -MATE) sv -= ply;
      tKey[idx] = zh; tVal[idx] = sv; tDep[idx] = depth + 1;
      tInf[idx] = ((bestC + 1) << 2) | (best <= a0 ? 3 : best >= beta ? 2 : 1);
    }
    return best;
  }

  // every column's static value for the side to move, one stone deep (the small models' "thinking")
  function glance(cells, color) {
    load(cells, color);
    const out = [];
    for (let c = 0; c < COLS; c++) {
      if (height[c] >= ROWS) { out.push(null); continue; }
      const win = winsNow(c);
      play(c);
      possible();
      winning(cl, ch, ml, mh);                       // the opponent's (now to move) winning cells
      const otl = RL, oth = RH;
      const gives = ((otl & PL) | (oth & PH)) !== 0;
      winning(cl ^ ml, ch ^ mh, ml, mh);
      const value = -evaluate(otl, oth, RL, RH);
      undo(c);
      out.push({ col: c, win, gives, value });
    }
    // must it block? (the opponent's cells it could fill now)
    possible();
    winning(cl ^ ml, ch ^ mh, ml, mh);
    const blocks = [];
    for (let c = 0; c < COLS; c++) if (height[c] < ROWS && bitIn(RL & PL, RH & PH, c * 7 + height[c])) blocks.push(c);
    return { cols: out, blocks };
  }

  // Think about `cells` with `color` (1 or 2) to move. Options: maxDepth, budget (ms, with `now`), onDepth(snapshot)
  // after each finished depth, margin (root moves this far below the best only get a bound), evalKind 'full' | 'simple',
  // tt (use the table), extend (forced replies cost no depth), settle (stop once the result is proven; false: keep
  // going to maxDepth, so a fixed-depth model always shows its whole climb). → { move, scores[7] (null: a full column),
  // score, depth, nodes, exact }
  function think(cells, color, opts = {}) {
    const { maxDepth = 42, budget = 0, now = () => Date.now(), onDepth = null, margin = 90, evalKind = 'full', tt = true, extend = true, settle = true } = opts;
    useTT = tt; extendForced = extend; fullEval = evalKind === 'full'; threatOrder = opts.order !== false;
    load(cells, color);
    clock = now;
    nodes = 0;
    stopped = false;
    const start = now();
    deadline = 0;
    const legal = CENTER_ORDER.filter((c) => height[c] < ROWS);
    if (!legal.length) return null;
    const empties = CELLS - moves;
    let order = legal.slice();
    let done = null;
    const top = Math.max(1, Math.min(maxDepth, empties));
    for (let d = 1; d <= top; d++) {
      if (d >= 2 && budget) deadline = start + budget;               // the first depth always finishes
      stopped = false;
      const sc = [null, null, null, null, null, null, null];
      let best = -INF, bestC = -1;
      for (const c of order) {
        let v;
        if (winsNow(c)) v = WIN - 1;
        else {
          play(c);
          const lo = best === -INF ? -INF : Math.max(-INF, best - margin);
          v = -negamax(d - 1, -INF, -lo, 1);
          undo(c);
        }
        if (stopped) break;
        sc[c] = v;
        if (v > best) { best = v; bestC = c; }
      }
      if (stopped) break;
      done = { depth: d, scores: sc, best: bestC, score: best, nodes, exact: d >= empties || best > MATE || best < -MATE };
      onDepth?.({ depth: d, scores: sc.slice(), best: bestC, score: best, nodes });
      // the next depth looks at the best first (ties keep the centre first)
      order = order.slice().sort((a, b) => sc[b] - sc[a]);
      if (settle && (best > MATE || best < -MATE)) break;           // proven: deeper changes nothing (`settle: false` looks on)
      if (budget && d >= 2 && now() - start > budget * 0.55) break;  // the next depth wouldn't finish in time
    }
    return { ...done, move: done.best, ms: now() - start, nodes };
  }

  return {
    think, glance, clear,
    get nodes() { return nodes; },
  };
}
