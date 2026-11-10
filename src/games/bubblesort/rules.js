// BUBBLE SORT: the rules, pure (no DOM, no clock): what a landed bubble does (match three, the SORT bubble's sort pass,
// WILD, BOMB, locked bubbles, memories), what falls, the score, the misses and the push, and a whole run (a level, or
// Endless). Every shot is resolved at once and returned as a list of what happened, in order, for the view to play.
import {
  Board, ROWS, LIMIT, STONE, LOCK, MEMORY, SORT, WILD, BOMB, isColor, isSpecial, SPECIALS, SYMBOL, parseRows,
} from './grid.js';
import { trace } from './path.js';
import { rng } from '../kit/fx.js';

export const POP = 10;                         // a popped bubble
export const DROP_CAP = 1280;                  // a dropped one: 10, 20, 40… doubling, at most this each
export const dropValue = (k) => Math.min(DROP_CAP, POP * 2 ** k);
export function dropTotal(n) { let s = 0; for (let k = 0; k < n; k++) s += dropValue(k); return s; }
export const comboMult = (streak) => Math.min(5, 1 + 0.5 * Math.max(0, streak - 1));   // ×1, ×1.5, ×2 … ×5
export const METER = 3;                        // popping shots in a row for a special
export const BOMB_RADIUS = 2;
export const MEMORY_BONUS = 500;
export const CLEAR_BONUS = 500, SHOT_BONUS = 150, ALL_CLEAR = 1000, ENDLESS_ALL_CLEAR = 2500;
export const LOCK_HITS = 2;

const key = (r, c) => r * 16 + c;

// ---------- the board's questions ----------
// the same-colour bubbles connected to (r, c), itself included: [[r, c], …]
export function groupOf(board, r, c) {
  const k = board.rows[r][c]?.k;
  if (!isColor(k)) return [];
  const seen = new Set([key(r, c)]);
  const out = [[r, c]];
  const nb = [];
  for (let i = 0; i < out.length; i++) {
    board.neighbours(out[i][0], out[i][1], nb);
    for (let j = 0; j < nb.length; j += 2) {
      const rr = nb[j], cc = nb[j + 1], kk = key(rr, cc);
      if (seen.has(kk)) continue;
      if (board.rows[rr][cc]?.k === k) { seen.add(kk); out.push([rr, cc]); }
    }
  }
  return out;
}

// everything no longer held up by the ceiling: [[r, c], …]
export function floating(board) {
  const seen = new Uint8Array(ROWS * 16);
  const stack = [];
  const top = board.top;
  for (let c = 0; c < board.width(top); c++) if (board.rows[top][c]) { seen[key(top, c)] = 1; stack.push(top, c); }
  const nb = [];
  while (stack.length) {
    const c = stack.pop(), r = stack.pop();
    board.neighbours(r, c, nb);
    for (let j = 0; j < nb.length; j += 2) {
      const rr = nb[j], cc = nb[j + 1];
      if (!seen[key(rr, cc)] && board.rows[rr][cc]) { seen[key(rr, cc)] = 1; stack.push(rr, cc); }
    }
  }
  const out = [];
  board.each((x, r, c) => { if (!seen[key(r, c)]) out.push([r, c]); });
  return out;
}

// WILD joins the biggest same-colour group next to it (ties: the lower colour); none next to it: the board's commonest
export function wildColour(board, r, c) {
  let best = 0, size = -1;
  const nb = board.neighbours(r, c, []);
  for (let j = 0; j < nb.length; j += 2) {
    const x = board.rows[nb[j]][nb[j + 1]];
    if (!x || !isColor(x.k)) continue;
    const n = groupOf(board, nb[j], nb[j + 1]).length;
    if (n > size || (n === size && x.k < best)) { size = n; best = x.k; }
  }
  if (best) return best;
  const counts = new Array(7).fill(0);
  board.each((x) => { if (isColor(x.k)) counts[x.k]++; });
  let k = 1;
  for (let i = 2; i <= 6; i++) if (counts[i] > counts[k]) k = i;
  return k;
}

// ---------- the SORT bubble ----------
// The rows it sorts: its own and the one above; if its own row holds fewer than two other coloured bubbles (it landed
// under the stack), the two rows above it instead. Rows above the ceiling, or with no colours, are left out.
export function sortRowsFor(board, r) {
  const coloured = (rr) => {
    if (rr < board.top || rr >= ROWS) return 0;
    let n = 0;
    for (let c = 0; c < board.width(rr); c++) if (isColor(board.rows[rr][c]?.k)) n++;
    return n;
  };
  const pick = (rows) => rows.filter((rr) => coloured(rr) > 0);
  const rows = pick(coloured(r) >= 2 ? [r - 1, r] : [r - 2, r - 1]);
  return rows.length ? rows : pick([r, r + 1]);
}
// One row, bubble-sorted by colour, in place (stable: equal colours never swap; stones, locks, memories and gaps stay
// where they are and the colours hop past them). → the swaps in order: [{ r, a, b, ida, idb }] (cells a and b swapped)
export function sortRow(board, r) {
  const row = board.rows[r], idx = [];
  for (let c = 0; c < board.width(r); c++) if (row[c] && isColor(row[c].k)) idx.push(c);
  const swaps = [];
  for (let end = idx.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      const A = row[idx[i]], B = row[idx[i + 1]];
      if (A.k > B.k) {
        row[idx[i]] = B; row[idx[i + 1]] = A;
        swaps.push({ r, a: idx[i], b: idx[i + 1], ida: A.id, idb: B.id });
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return swaps;
}

// the cells within `radius` of (r, c)
export function around(board, r, c, radius) {
  const out = [];
  for (let rr = Math.max(board.top, r - radius); rr <= Math.min(ROWS - 1, r + radius); rr++) {
    for (let cc = 0; cc < board.width(rr); cc++) if (board.distance(r, c, rr, cc) <= radius) out.push([rr, cc]);
  }
  return out;
}

// ---------- a bubble lands ----------
// Places kind `k` at (r, c) and resolves everything it does, in order. Mutates the board. →
// { r, c, id, k, wild, sort: { rows, swaps: [[…], […]], at } | null, bomb: [cells] | null,
//   pops: [{ id, r, c, k, order }], broken: [{ id, r, c }], cracked: [{ id, r, c, hits }], drops: [{ id, r, c, k }], freed }
export function resolve(board, r, c, k) {
  const placed = board.put(r, c, k);
  const out = { r, c, id: placed.id, k, wild: 0, sort: null, bomb: null, pops: [], broken: [], cracked: [], drops: [], freed: 0 };
  let hit = [];
  if (k === WILD) {
    placed.k = out.wild = wildColour(board, r, c);
  }
  if (isColor(placed.k)) {
    const g = groupOf(board, r, c);
    if (g.length >= 3) hit = g;
  } else if (k === SORT) {
    board.rows[r][c] = null;   // it dissolves into the sort
    const rows = sortRowsFor(board, r);
    const swaps = rows.map((rr) => sortRow(board, rr));
    out.sort = { rows, swaps, at: { r, c } };
    const seen = new Set();
    for (const rr of rows) {
      for (let cc = 0; cc < board.width(rr); cc++) {
        if (seen.has(key(rr, cc)) || !isColor(board.rows[rr][cc]?.k)) continue;
        const g = groupOf(board, rr, cc);
        for (const [gr, gc] of g) seen.add(key(gr, gc));
        if (g.length >= 3) hit.push(...g);
      }
    }
  } else if (k === BOMB) {
    board.rows[r][c] = null;
    hit = around(board, r, c, BOMB_RADIUS).filter(([rr, cc]) => board.rows[rr][cc] && board.rows[rr][cc].k !== MEMORY);
    out.bomb = hit.map(([rr, cc]) => ({ id: board.rows[rr][cc].id, r: rr, c: cc, k: board.rows[rr][cc].k }));
  }
  // pop them, in rings out from where it landed
  const popped = new Set();
  for (const [rr, cc] of hit) {
    const x = board.rows[rr][cc];
    if (!x || popped.has(key(rr, cc))) continue;
    popped.add(key(rr, cc));
    out.pops.push({ id: x.id, r: rr, c: cc, k: x.k, order: board.distance(r, c, rr, cc) });
    board.rows[rr][cc] = null;
  }
  out.pops.sort((a, b) => a.order - b.order || a.r - b.r || a.c - b.c);
  // a locked bubble next to a pop takes one hit a shot; two and it breaks
  if (out.pops.length) {
    const hitLocks = new Set();
    const nb = [];
    for (const p of out.pops) {
      board.neighbours(p.r, p.c, nb);
      for (let j = 0; j < nb.length; j += 2) {
        const x = board.rows[nb[j]][nb[j + 1]];
        if (x && x.k === LOCK && !hitLocks.has(x.id)) {
          hitLocks.add(x.id);
          x.hits++;
          if (x.hits >= LOCK_HITS) { out.broken.push({ id: x.id, r: nb[j], c: nb[j + 1], k: LOCK }); board.rows[nb[j]][nb[j + 1]] = null; }
          else out.cracked.push({ id: x.id, r: nb[j], c: nb[j + 1], hits: x.hits });
        }
      }
    }
  }
  // what nothing holds up any more falls
  for (const [rr, cc] of floating(board)) {
    const x = board.rows[rr][cc];
    out.drops.push({ id: x.id, r: rr, c: cc, k: x.k });
    if (x.k === MEMORY) out.freed++;
    board.rows[rr][cc] = null;
  }
  return out;
}

// ---------- Endless's rows ----------
// A new top row, made a little clumpy (a bubble often copies the one beside it or under it), so there's always
// something to aim for. `palette`: how many colours; `stones`: the chance of a stone.
export function rowMaker(board, rand, palette, stones = 0) {
  return (c, w) => {
    if (stones && rand.next() < stones) return STONE;
    const roll = rand.next();
    if (c > 0 && roll < 0.24) { const left = board.rows[0][c - 1]; if (left && isColor(left.k)) return left.k; }
    if (roll < 0.42) {
      // a bubble under it (row 1 is the old top row)
      const off = board.wide(0) ? -1 : 0, under = [c + off, c + off + 1].filter((cc) => board.has(1, cc));
      const pick = board.rows[1][under[Math.floor(rand.next() * under.length)]];
      if (pick && isColor(pick.k) && pick.k <= palette) return pick.k;
    }
    return 1 + Math.floor(rand.next() * palette);
  };
}
export function endlessBoard(rand, rows = 6, palette = 4) {
  const b = new Board();
  b.parity = rows % 2;   // after `rows` pushes the top row is wide again
  for (let i = 0; i < rows; i++) b.push(rowMaker(b, rand, palette));
  return b;
}
export const ENDLESS = Object.freeze({
  startRows: 6,
  palette: (rows) => (rows < 15 ? 4 : rows < 35 ? 5 : 6),
  missLimit: (rows) => (rows < 10 ? 5 : rows < 30 ? 4 : 3),
  stones: (rows) => (rows < 40 ? 0 : Math.min(0.08, 0.02 + (rows - 40) * 0.002)),
  timerFrom: 12,                                                     // rows survived before the slow timer starts
  interval: (rows) => Math.max(12, 28 - (rows - 12) * 0.4),         // seconds between its rows
  refillUnder: 10,                                                   // fewer bubbles than this: a row comes in at once
});

// ---------- a run: a level, or Endless ----------
export class Game {
  // { mode: 'level' | 'endless', def (a level), seed, board }
  constructor({ mode = 'level', def = null, seed = 1, board = null } = {}) {
    this.mode = mode;
    this.def = def;
    this.rand = rng(seed >>> 0 || 1);
    this.seed = seed;
    if (mode === 'level') {
      this.board = board || parseRows(def.rows);
      this.goal = def.goal;
      this.shotsLeft = def.shots;
      this.missLimit = def.misses || 5;
      this.specials = (def.specials || []).map((s) => SPECIALS[s]);
      this.gifts = def.gifts || {};
      this.palette = [...this.board.colours()].sort((a, b) => a - b);
    } else {
      this.board = board || endlessBoard(this.rand, ENDLESS.startRows, ENDLESS.palette(0));
      this.goal = null;
      this.shotsLeft = Infinity;
      this.missLimit = ENDLESS.missLimit(0);
      this.specials = [SORT, WILD, BOMB];
      this.gifts = {};
      this.palette = [1, 2, 3, 4];
    }
    this.memTotal = this.board.count((k) => k === MEMORY);
    this.freed = 0;
    this.drawn = 0;
    this.fired = 0;
    this.misses = 0;
    this.streak = 0;
    this.meter = 0;
    this.turn = 0;
    this.score = 0;
    this.rows = 0;            // Endless: rows pushed in (survived)
    this.timer = ENDLESS.interval(ENDLESS.timerFrom);
    this.stats = { pops: 0, drops: 0, biggestDrop: 0, bestCombo: 0, banks: 0, sorted: 0 };
    this.status = 'play';
    this.reason = '';
    this.queue = [];
    this.refill();
  }
  get loaded() { return this.queue[0] ?? 0; }
  get next() { return this.queue[1] ?? 0; }
  get timerOn() { return this.mode === 'endless' && this.rows >= ENDLESS.timerFrom; }
  get danger() { return this.board.lowest() >= LIMIT - 2; }
  // the loaded and the next bubble change places (free)
  swap() {
    if (this.status !== 'play' || this.queue.length < 2 || this.queue[0] === this.queue[1]) return false;
    [this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]];
    return true;
  }
  path(angle) { return trace(this.board, angle); }

  // a new bubble for the queue: a level's gift at this point, or a colour still on the board
  draw() {
    const gift = this.gifts[this.drawn++];
    if (gift) return SPECIALS[gift] || SYMBOL[gift];
    return this.colourPick();
  }
  colourPick() {
    const have = [...this.board.colours()].sort((a, b) => a - b);
    const from = have.length ? have : this.palette;
    return from[Math.floor(this.rand.next() * from.length)];
  }
  refill() {
    const want = Math.min(2, this.shotsLeft);
    while (this.queue.length < want) this.queue.push(this.draw());
  }
  // the loaded and the next bubble are always colours still on the board
  fixColours() {
    const have = this.board.colours();
    if (!have.size) return;
    for (let i = 0; i < this.queue.length; i++) if (isColor(this.queue[i]) && !have.has(this.queue[i])) this.queue[i] = this.colourPick();
  }

  // ---------- the stack moves down a row: a new row (Endless) or the ceiling (levels) ----------
  pushDown(by = 'misses') {
    let made = [];
    if (this.mode === 'endless') {
      const palette = ENDLESS.palette(this.rows);
      made = this.board.push(rowMaker(this.board, this.rand, palette, ENDLESS.stones(this.rows)));
      this.rows++;
      this.missLimit = ENDLESS.missLimit(this.rows);
      for (let k = 1; k <= palette; k++) if (!this.palette.includes(k)) this.palette.push(k);
    } else this.board.push(null);
    return { by, row: made, top: this.board.top, parity: this.board.parity };
  }

  // ---------- a shot ----------
  fire(angle) {
    if (this.status !== 'play' || !this.queue.length) return null;
    const k = this.queue[0];
    const path = trace(this.board, angle);
    const res = resolve(this.board, path.cell.r, path.cell.c, k);
    res.path = path;
    res.angle = angle;
    this.fired++;
    if (this.mode === 'level') this.shotsLeft--;
    // the score
    const popped = res.pops.length + res.broken.length;
    const productive = popped > 0;
    if (productive) this.streak++;
    else if (!isSpecial(k)) this.streak = 0;
    res.mult = productive ? comboMult(this.streak) : 1;
    res.streak = this.streak;
    res.points = Math.round((popped * POP + dropTotal(res.drops.length)) * res.mult) + res.freed * MEMORY_BONUS;
    this.freed += res.freed;
    this.stats.pops += popped;
    this.stats.drops += res.drops.length;
    this.stats.biggestDrop = Math.max(this.stats.biggestDrop, res.drops.length);
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.streak);
    if (productive && path.bounces > 0) this.stats.banks++;
    if (res.sort) this.stats.sorted++;
    // a miss: a shot that pops nothing (a special never counts); enough of them and the stack comes down a row
    res.miss = !productive && !isSpecial(k);
    res.special = 0;
    res.push = null;
    if (res.miss) {
      this.misses++;
      this.meter = 0;
      if (this.misses >= this.missLimit && !this.board.overflow()) { this.misses = 0; res.push = this.pushDown('misses'); }
    } else if (productive && this.specials.length) {
      this.meter++;
      if (this.meter >= METER) { this.meter = 0; res.special = this.specials[this.turn++ % this.specials.length]; }
    }
    // Endless: a cleared board, or nearly: fresh rows at once
    res.allClear = this.board.count() === 0;
    res.refill = [];
    if (this.mode === 'endless' && !res.push && !this.board.overflow()) {
      if (res.allClear) { res.points += ENDLESS_ALL_CLEAR; for (let i = 0; i < 3; i++) res.refill.push(this.pushDown('refill')); }
      else if (this.board.count() < ENDLESS.refillUnder) res.refill.push(this.pushDown('refill'));
    }
    this.score += res.points;
    // the queue: the next one moves up; a special earned goes first
    this.queue.shift();
    if (res.special) this.queue.unshift(res.special);
    if (this.queue.length > this.shotsLeft) this.queue.length = Math.max(0, this.shotsLeft);
    this.refill();
    this.fixColours();
    this.settle(res);
    return res;
  }
  // is it over? a level's goal, the deadline, the last shot
  settle(res) {
    const won = this.mode === 'level' && (this.goal === 'clear' ? this.board.count() === 0 : this.freed >= this.memTotal);
    if (won) {
      this.status = 'won';
      this.reason = this.goal;
      res.bonus = { clear: CLEAR_BONUS, shots: this.shotsLeft * SHOT_BONUS, all: this.goal === 'memories' && res.allClear ? ALL_CLEAR : 0 };
      res.bonus.total = res.bonus.clear + res.bonus.shots + res.bonus.all;
      this.score += res.bonus.total;
    } else if (this.board.overflow()) { this.status = 'lost'; this.reason = 'overflow'; }
    else if (this.mode === 'level' && this.shotsLeft <= 0) { this.status = 'lost'; this.reason = 'shots'; }
    res.status = this.status;
    res.reason = this.reason;
    res.score = this.score;
  }
  // Endless's slow timer (once it's on): a row every so often. → a push, or null
  tick(dt) {
    if (!this.timerOn || this.status !== 'play') return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer = ENDLESS.interval(this.rows);
    const push = this.pushDown('timer');
    if (this.board.overflow()) { this.status = 'lost'; this.reason = 'overflow'; }
    this.fixColours();
    return { push, status: this.status, reason: this.reason };
  }
  // a level's stars: by the shots left when it was cleared
  stars() { return this.status === 'won' ? starsFor(this.def, this.shotsLeft) : 0; }
}

export const starsFor = (def, left) => 1 + (left >= def.stars[0] ? 1 : 0) + (left >= def.stars[1] ? 1 : 0);
