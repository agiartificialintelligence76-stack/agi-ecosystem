// BUBBLE SORT (2026-11-09): the board's geometry and its cells. Pure (no DOM, no clock): the tests run it in Node.
//
// The board is hex-packed: a wide row holds 11 bubbles, a narrow row 10, offset by half a bubble. Every length is in
// bubble radii (a bubble is 2 across), so the board is 22 wide; a row is √3 tall. Which rows are wide flips with
// `parity`, so when the whole stack moves down a row (a push) each row keeps its own shape. Rows above `top` are the
// ceiling (it comes down in the levels); a bubble left in row LIMIT or below has crossed the deadline.
export const COLS = 11;
export const LIMIT = 14;                 // rows 0…13 are above the deadline
export const ROWS = LIMIT + 1;           // one more: a bubble can land there (and ends the run if it stays)
export const W = 22;
export const RH = Math.sqrt(3);
// a shot sticks when its centre comes this close to a bubble's centre: 82% of a diameter, so it slips past a corner
// it only grazes (forgiving) but can never pass between two bubbles that touch (fair)
export const CONTACT = 1.64;
export const rowY = (r) => 1 + r * RH;
export const DEADLINE_Y = rowY(LIMIT - 1) + 1;
export const LAUNCHER = Object.freeze({ x: W / 2, y: DEADLINE_Y + 3 });
export const FIELD_H = LAUNCHER.y + 2.75;  // the board's inner height (the ceiling to the bottom of the launcher bay)

// what a cell holds: a colour 1–6, or a fixed piece; and what a shot can be besides a colour
export const STONE = 7, LOCK = 8, MEMORY = 9;
export const SORT = 10, WILD = 11, BOMB = 12;
export const isColor = (k) => k >= 1 && k <= 6;
export const isSpecial = (k) => k >= SORT;
export const SPECIALS = Object.freeze({ sort: SORT, wild: WILD, bomb: BOMB });
export const SPECIAL_NAME = Object.freeze({ [SORT]: 'sort', [WILD]: 'wild', [BOMB]: 'bomb' });

export class Board {
  constructor() {
    this.parity = 0;   // row r is wide when (r + parity) is even
    this.top = 0;      // the ceiling's row (it comes down in the levels)
    this.rows = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    this.nid = 1;      // the next bubble's id (the view follows bubbles by id)
  }
  clone() {
    const b = new Board();
    b.parity = this.parity; b.top = this.top; b.nid = this.nid;
    for (let r = 0; r < ROWS; r++) {
      const src = this.rows[r], dst = b.rows[r];
      for (let c = 0; c < COLS; c++) { const x = src[c]; dst[c] = x ? { id: x.id, k: x.k, hits: x.hits } : null; }
    }
    return b;
  }
  wide(r) { return ((r + this.parity) & 1) === 0; }
  width(r) { return this.wide(r) ? COLS : COLS - 1; }
  has(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < this.width(r); }
  at(r, c) { return this.has(r, c) ? this.rows[r][c] : null; }
  put(r, c, k) {
    const cell = { id: this.nid++, k, hits: 0 };
    this.rows[r][c] = cell;
    return cell;
  }
  x(r, c) { return (this.wide(r) ? 1 : 2) + 2 * c; }
  y(r) { return rowY(r); }
  // the six cells around (r, c) that exist (empty or not)
  neighbours(r, c, out = []) {
    out.length = 0;
    if (this.has(r, c - 1)) out.push(r, c - 1);
    if (this.has(r, c + 1)) out.push(r, c + 1);
    const off = this.wide(r) ? -1 : 0;
    for (let rr = r - 1; rr <= r + 1; rr += 2) {
      if (this.has(rr, c + off)) out.push(rr, c + off);
      if (this.has(rr, c + off + 1)) out.push(rr, c + off + 1);
    }
    return out;   // flat pairs: [r0, c0, r1, c1, …]
  }
  each(fn) {
    for (let r = 0; r < ROWS; r++) {
      const w = this.width(r), row = this.rows[r];
      for (let c = 0; c < w; c++) if (row[c]) fn(row[c], r, c);
    }
  }
  count(pred = () => true) { let n = 0; this.each((x) => { if (pred(x.k)) n++; }); return n; }
  colours() { const s = new Set(); this.each((x) => { if (isColor(x.k)) s.add(x.k); }); return s; }
  // the lowest row with anything in it (-1: empty)
  lowest() {
    for (let r = ROWS - 1; r >= 0; r--) { const w = this.width(r); for (let c = 0; c < w; c++) if (this.rows[r][c]) return r; }
    return -1;
  }
  // the doubled-width column (wide cells even, narrow cells odd): hex distance works on it
  col2(r, c) { return 2 * c + (this.wide(r) ? 0 : 1); }
  distance(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2), dc = Math.abs(this.col2(r1, c1) - this.col2(r2, c2));
    return dr + Math.max(0, (dc - dr) / 2);
  }
  // the cell nearest to a point (in the grid's rows)
  cellAt(x, y) {
    const r = Math.max(0, Math.min(ROWS - 1, Math.round((y - 1) / RH)));
    const c = Math.max(0, Math.min(this.width(r) - 1, Math.round((x - (this.wide(r) ? 1 : 2)) / 2)));
    return { r, c };
  }
  // the whole stack one row down (its shapes kept): a new row at the top (Endless) or the ceiling coming down (levels).
  // `make(c)` gives row 0's kinds (Endless); without it the ceiling comes down a row. → the new row's cells
  push(make = null) {
    this.rows.pop();
    this.rows.unshift(new Array(COLS).fill(null));
    this.parity ^= 1;
    const made = [];
    if (make) {
      const w = this.width(0);
      for (let c = 0; c < w; c++) { const k = make(c, w); if (k) made.push({ ...this.put(0, c, k), r: 0, c }); }
    } else this.top++;
    return made;
  }
  // anything in a row at or under the deadline
  overflow() {
    for (let r = LIMIT; r < ROWS; r++) { const w = this.width(r); for (let c = 0; c < w; c++) if (this.rows[r][c]) return true; }
    return false;
  }
}

// a level's rows as written: wide rows "a b c …" (11 cells, 21 characters), narrow rows " a b …" (a space, then 10
// cells: 20 characters), so the source looks like the board. `.` empty, a–f colours, # stone, * locked, M memory
export const SYMBOL = Object.freeze({ '.': 0, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, '#': STONE, '*': LOCK, M: MEMORY });
export function parseRows(lines) {
  const b = new Board();
  lines.forEach((line, r) => {
    const wide = b.wide(r);
    for (let c = 0; c < b.width(r); c++) {
      const ch = line[wide ? 2 * c : 2 * c + 1];
      const k = SYMBOL[ch];
      if (k === undefined) throw new Error(`row ${r}: "${ch}" isn't a cell`);
      if (k) b.put(r, c, k);
    }
  });
  return b;
}
// …and back (the tests, the tools)
export function rowsOf(board) {
  const sym = Object.fromEntries(Object.entries(SYMBOL).map(([s, k]) => [k, s]));
  const out = [];
  for (let r = 0; r <= Math.max(0, board.lowest()); r++) {
    const cells = [];
    for (let c = 0; c < board.width(r); c++) cells.push(sym[board.rows[r][c]?.k || 0]);
    out.push((board.wide(r) ? '' : ' ') + cells.join(' '));
  }
  return out;
}
