// EPOCHS (2026-11-08): the rules, with no DOM, so tests/epochs.test.js and tools/games/epochs/ run them in Node.
//
// A level is a small grid. Each move of the player is one tick. An epoch (one try) lasts at most `T` ticks; a level
// gives `K` of them. When a new epoch starts the world resets, and every earlier epoch replays itself as an echo of
// AGI-1, in lockstep with the new one, input by input. The rules of one tick:
//   1. echoes zapped by a laser on the last tick fade out (they're gone);
//   2. the live AGI-1 moves first, then the echoes, oldest first. A body walks onto floor, plates, buttons, the exit,
//      an open door, or a one-way tile in its own direction; it pushes a box one tile when the tile behind it is free.
//      The live AGI-1 walks through echoes (they're the past); an echo can't step where she stands, and a blocked echo
//      just waits that tick ("desync": the rules never break, the echo only drifts);
//   3. devices: a plate is pressed while anything stands on it (AGI-1, an echo, a box); a door opens while all its
//      plates are pressed; a toggle flips its door each time something steps on it; a timer button opens its door for
//      N ticks; a door never closes on something standing in it;
//   4. lasers: a beam runs from its emitter until a wall, a closed door, a box or a body. The live AGI-1 in a beam:
//      that epoch is zapped (undo, retry, or keep it as an echo). An echo in a beam takes the hit for that one tick
//      (the beam stops there) and is gone on the next ("deprecated");
//   5. the live AGI-1 on the exit: solved.
// Doors' states and the beams are worked out at the end of a tick and used by the moves of the next one.

export const DIRS = 'URDL';                    // input codes 0..3 (and -1: wait)
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const WAIT = -1;
export const INPUT = { W: -1, U: 0, R: 1, D: 2, L: 3 };
export const charOf = (a) => (a < 0 ? 'W' : DIRS[a]);
export const codeOf = (ch) => (ch === 'W' ? -1 : DIRS.indexOf(ch));

// what a cell is
export const VOID = 0, FLOOR = 1, WALL = 2, EXIT = 3, PLATE = 4, TOGGLE = 5, TIMER = 6, DOOR = 7, EMIT = 8, ARROW = 9;
// the world's state
export const PLAY = 0, WON = 1, ZAPPED = 2;

const ARROWS = { '↑': 0, '→': 1, '↓': 2, '←': 3 };
const EMITTERS = { '^': 0, '>': 1, 'v': 2, '<': 3 };
export const SYMBOLS = '#. SXo' + 'abcdefgh' + 'ABCDEFGH' + Object.keys(ARROWS).join('') + Object.keys(EMITTERS).join('');

// A level from its data: { name, T, K, map: [rows], keys: { b: 'toggle', c: 'timer3' }, open: 'B', sol: [...] }
export function parseLevel(def) {
  const rows = def.map.map((r) => [...r]);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const n = w * h;
  const kind = new Uint8Array(n), arg = new Int8Array(n).fill(-1);
  let start = -1, exit = -1;
  const boxes = [], emitters = [], devCells = {}, doorCells = {}, problems = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? ' ', p = y * w + x;
      if (ch === '#') kind[p] = WALL;
      else if (ch === ' ') kind[p] = VOID;
      else if (ch === '.') kind[p] = FLOOR;
      else if (ch === 'S') { kind[p] = FLOOR; if (start >= 0) problems.push('two starts'); start = p; }
      else if (ch === 'X') { kind[p] = EXIT; if (exit >= 0) problems.push('two exits'); exit = p; }
      else if (ch === 'o') { kind[p] = FLOOR; boxes.push(p); }
      else if (ch >= 'a' && ch <= 'h') { arg[p] = ch.charCodeAt(0) - 97; (devCells[arg[p]] ||= []).push(p); }
      else if (ch >= 'A' && ch <= 'H') { kind[p] = DOOR; arg[p] = ch.charCodeAt(0) - 65; (doorCells[arg[p]] ||= []).push(p); }
      else if (ch in ARROWS) { kind[p] = ARROW; arg[p] = ARROWS[ch]; }
      else if (ch in EMITTERS) { kind[p] = EMIT; arg[p] = EMITTERS[ch]; emitters.push({ p, dir: EMITTERS[ch] }); }
      else problems.push(`unknown symbol "${ch}" at ${x},${y}`);
    }
  }
  // devices: plates unless the level says otherwise
  const devs = [];
  for (const [idStr, cells] of Object.entries(devCells)) {
    const id = Number(idStr), letter = String.fromCharCode(97 + id);
    const spec = (def.keys && def.keys[letter]) || 'plate';
    let type = PLATE, ticks = 0;
    if (spec === 'toggle') type = TOGGLE;
    else if (/^timer\d+$/.test(spec)) { type = TIMER; ticks = Number(spec.slice(5)); }
    else if (spec !== 'plate') problems.push(`unknown device kind ${spec}`);
    for (const p of cells) kind[p] = type;
    devs[id] = { id, type, ticks, cells };
    if (!doorCells[id]) problems.push(`device ${letter} opens no door`);
  }
  const doors = [];
  let open0 = 0;
  for (const [idStr, cells] of Object.entries(doorCells)) {
    const id = Number(idStr);
    if (!devs[id]) problems.push(`door ${String.fromCharCode(65 + id)} has no device`);
    doors[id] = { id, cells };
    if ((def.open || '').includes(String.fromCharCode(65 + id))) open0 |= 1 << id;
  }
  if (start < 0) problems.push('no start');
  if (exit < 0) problems.push('no exit');
  if (rows.some((r) => r.length !== w)) problems.push('rows of different lengths');
  return {
    def, name: def.name, w, h, n, kind, arg, start, exit, boxes, emitters, devs, doors, open0,
    T: def.T, K: def.K, problems,
    ids: devs.map((d, i) => (d ? i : -1)).filter((i) => i >= 0),
  };
}

export const neighbor = (L, p, a) => {
  const x = (p % L.w) + DX[a], y = ((p / L.w) | 0) + DY[a];
  return x < 0 || y < 0 || x >= L.w || y >= L.h ? -1 : y * L.w + x;
};

// a fresh world: every body at the start (the last one is the live AGI-1; the others are echoes, oldest first)
export function initWorld(L, bodies) {
  const W = {
    t: 0, n: bodies, status: PLAY,
    bp: new Int16Array(bodies).fill(L.start),
    bd: new Int8Array(bodies).fill(2),               // facing (0..3): down at first
    bs: new Uint8Array(bodies),                      // 0 here · 1 zapped this tick (still here) · 2 gone
    boxes: Int16Array.from(L.boxes),
    base: L.open0,                                   // toggled doors: a bit each
    timers: new Int8Array(8),
    open: new Uint8Array(L.n),                       // door cells: open now
    pressed: new Uint8Array(L.n),                    // plates and buttons: something on them now
    beams: [],                                       // [{ from, to (the last lit cell), end: p or -1, dir }]
  };
  settle(L, W, 0, 0, null);
  return W;
}

export function cloneWorld(W) {
  return {
    t: W.t, n: W.n, status: W.status,
    bp: W.bp.slice(), bd: W.bd.slice(), bs: W.bs.slice(), boxes: W.boxes.slice(), base: W.base,
    timers: W.timers.slice(), open: W.open.slice(), pressed: W.pressed.slice(), beams: W.beams.map((b) => ({ ...b })),
  };
}

const boxAt = (W, p) => { for (let i = 0; i < W.boxes.length; i++) if (W.boxes[i] === p) return i; return -1; };
const bodyAt = (W, p) => { for (let i = 0; i < W.n; i++) if (W.bs[i] !== 2 && W.bp[i] === p) return i; return -1; };
export { boxAt, bodyAt };

// can something moving in direction `a` step onto cell q (its terrain only)?
function enterable(L, W, q, a) {
  const k = L.kind[q];
  if (k === WALL || k === VOID || k === EMIT) return false;
  if (k === DOOR) return W.open[q] === 1;
  if (k === ARROW) return L.arg[q] === a;
  return true;
}

// One tick. inputs[i]: body i's input (-1 wait, 0..3 a direction); the last body is the live AGI-1.
// `ev` (an array, or null) collects what happened, for the screen and the sound.
export function tick(L, W, inputs, ev = null) {
  W.t++;
  const n = W.n, live = n - 1;
  for (let i = 0; i < n; i++) if (W.bs[i] === 1) { W.bs[i] = 2; ev?.push({ type: 'gone', i }); }
  let flips = 0, timed = 0;
  const liveFrom = W.bp[live];
  const enter = (q, who) => {
    const k = L.kind[q];
    if (k === TOGGLE) { flips ^= 1 << L.arg[q]; ev?.push({ type: 'toggle', p: q, who }); }
    else if (k === TIMER) { timed |= 1 << L.arg[q]; ev?.push({ type: 'timer', p: q, who }); }
  };
  for (let k = 0; k < n; k++) {
    const i = k === 0 ? live : k - 1;
    if (W.bs[i] === 2) continue;
    const a = inputs[i];
    if (a == null || a < 0) continue;
    W.bd[i] = a;
    const p = W.bp[i], q = neighbor(L, p, a);
    if (q < 0 || !enterable(L, W, q, a)) { ev?.push({ type: 'bump', i, a, p }); continue; }
    // an echo can't step where the live AGI-1 stands (still: walking into the same cell together is fine)
    if (i !== live && W.bp[live] === q && liveFrom === q) { ev?.push({ type: 'bump', i, a, p, by: 'live' }); continue; }
    const bi = boxAt(W, q);
    if (bi >= 0) {
      const r = neighbor(L, q, a);
      if (r < 0 || !enterable(L, W, r, a) || boxAt(W, r) >= 0 || bodyAt(W, r) >= 0) { ev?.push({ type: 'bump', i, a, p, box: bi }); continue; }
      W.boxes[bi] = r;
      ev?.push({ type: 'push', box: bi, from: q, to: r, i, a });
      enter(r, -1);
    }
    W.bp[i] = q;
    ev?.push({ type: 'move', i, from: p, to: q, a });
    enter(q, i);
  }
  settle(L, W, flips, timed, ev);
  return W;
}

// the end of a tick: timers, toggles, plates, doors, lasers, the exit
function settle(L, W, flips, timed, ev) {
  const occ = W.pressed;                       // reused: what stands where now
  occ.fill(0);
  for (let i = 0; i < W.n; i++) if (W.bs[i] !== 2) occ[W.bp[i]] = 1;
  for (let i = 0; i < W.boxes.length; i++) occ[W.boxes[i]] = 1;
  W.base ^= flips;
  for (const id of L.ids) {
    const d = L.devs[id];
    let cond;
    if (d.type === TIMER) {
      if (W.timers[id] > 0) W.timers[id]--;
      if (timed & (1 << id)) W.timers[id] = d.ticks;
      cond = W.timers[id] > 0;
    } else if (d.type === TOGGLE) cond = Boolean(W.base & (1 << id));
    else { cond = true; for (const c of d.cells) if (!occ[c]) { cond = false; break; } }
    const door = L.doors[id];
    if (!door) continue;
    for (const c of door.cells) {
      const o = cond || occ[c] ? 1 : 0;
      if (o !== W.open[c]) { W.open[c] = o; ev?.push({ type: 'door', p: c, open: Boolean(o), jam: Boolean(o && !cond) }); }
    }
  }
  // lasers
  W.beams.length = 0;
  for (const em of L.emitters) {
    let q = neighbor(L, em.p, em.dir), last = em.p, end = -1, hit = false;
    while (q >= 0) {
      const k = L.kind[q];
      if (k === WALL || k === VOID || k === EMIT || (k === DOOR && !W.open[q])) { end = q; break; }
      if (boxAt(W, q) >= 0) { end = q; break; }
      let any = false;
      for (let i = 0; i < W.n; i++) {
        if (W.bs[i] === 2 || W.bp[i] !== q) continue;
        any = true;
        if (i === W.n - 1) { if (W.status === PLAY) { W.status = ZAPPED; ev?.push({ type: 'zap', i, p: q }); } }
        else if (W.bs[i] === 0) { W.bs[i] = 1; ev?.push({ type: 'deprecate', i, p: q }); }
      }
      if (any) { end = q; hit = true; break; }
      last = q;
      q = neighbor(L, q, em.dir);
    }
    W.beams.push({ from: em.p, to: last, end, dir: em.dir, hit });
  }
  if (W.status === PLAY && W.n > 0 && L.kind[W.bp[W.n - 1]] === EXIT) { W.status = WON; ev?.push({ type: 'win' }); }
}

// A compact key of a world (the solver's: what matters for what can happen next)
export function keyOf(W, sortEchoes = true) {
  const parts = [];
  for (let i = 0; i < W.n - 1; i++) parts.push(W.bs[i] === 2 ? -1 : W.bp[i] * 2 + (W.bs[i] === 1 ? 1 : 0));
  if (sortEchoes) parts.sort((a, b) => a - b);
  const boxes = Array.from(W.boxes).sort((a, b) => a - b);
  return `${W.bp[W.n - 1]}|${parts.join(',')}|${boxes.join(',')}|${W.base}|${W.timers.join('')}`;
}

// ---------- a level being played: its epochs, the recording, undo ----------
// recs: the epochs already done ({ inputs: [codes], track: [the live AGI-1's cell after each tick, from tick 0] }).
export class Run {
  constructor(L) {
    this.L = L;
    this.recs = [];
    this.inputs = [];
    this.world = initWorld(L, 1);
    this.track = [L.start];
    this.ins = [WAIT];
  }
  get epoch() { return this.recs.length + 1; }            // 1-based: the epoch being played
  get t() { return this.world.t; }
  get status() {
    const s = this.world.status;
    if (s === WON) return 'won';
    if (s === ZAPPED) return 'zapped';
    if (this.world.t >= this.L.T) return this.epoch >= this.L.K ? 'out' : 'timeup';
    return 'play';
  }
  get ticks() { return this.recs.reduce((s, r) => s + r.inputs.length, 0) + this.inputs.length; }
  canStep() { return this.world.status === PLAY && this.world.t < this.L.T; }
  canNewEpoch() { return this.epoch < this.L.K && this.world.status !== WON; }

  // the inputs of every body on the next tick
  nextInputs() {
    const n = this.world.n, t = this.world.t;
    if (this.ins.length !== n) this.ins = new Array(n).fill(WAIT);
    for (let i = 0; i < n - 1; i++) { const r = this.recs[i].inputs; this.ins[i] = t < r.length ? r[t] : WAIT; }
    return this.ins;
  }
  // one move (a code: -1 wait, 0..3). → the tick's events (with `desync` for echoes pushed off their old path), or null
  step(a) {
    if (!this.canStep()) return null;
    const W = this.world, ins = this.nextInputs();
    ins[W.n - 1] = a;
    const before = W.bp.slice();
    const ev = [];
    tick(this.L, W, ins, ev);
    this.inputs.push(a);
    this.track.push(W.bp[W.n - 1]);
    // an echo that moved on this tick when it was recorded, but couldn't now: it drifts ("desync")
    for (let i = 0; i < W.n - 1; i++) {
      const tr = this.recs[i].track, t = W.t;
      if (W.bs[i] === 2 || t >= tr.length) continue;
      if (tr[t] !== tr[t - 1] && W.bp[i] === before[i]) ev.push({ type: 'desync', i });
    }
    return ev;
  }
  // keep this epoch as an echo and start the next one
  newEpoch() {
    if (!this.canNewEpoch()) return false;
    this.recs.push({ inputs: this.inputs.slice(), track: this.track.slice() });
    this.inputs = [];
    this._resim();
    return true;
  }
  restartEpoch() { this.inputs = []; this._resim(); }
  restartLevel() { this.recs = []; this.inputs = []; this._resim(); }
  // one tick back; at the start of an epoch, back into the one before (unless that one ran out of time: then a tick
  // before its end too, so it isn't over again at once). → false when there's nothing to undo
  undo() {
    if (this.inputs.length) { this.inputs.pop(); this._resim(); return true; }
    if (!this.recs.length) return false;
    const r = this.recs.pop();
    this.inputs = r.inputs.slice();
    if (this.inputs.length >= this.L.T) this.inputs.pop();
    this._resim();
    return true;
  }
  _resim() {
    this.world = initWorld(this.L, this.recs.length + 1);
    this.track = [this.L.start];
    const keep = this.inputs;
    this.inputs = [];
    for (const a of keep) if (!this.step(a)) break;
  }
  // stars: 1 solved · 2 within par epochs · 3 within par ticks
  stars(par) {
    if (this.world.status !== WON) return 0;
    return 1 + (this.epoch <= par.epochs ? 1 : 0) + (this.ticks <= par.ticks ? 1 : 0);
  }
}

// a solution's words ("RRDW") as codes, and back
export const toCodes = (s) => [...s].map(codeOf);
export const toWords = (codes) => codes.map(charOf).join('');

// Play a whole solution (one string of inputs per epoch) the way a player would: each epoch's moves, then a new epoch.
// → { run, won, epochs, ticks }
export function playSolution(L, sol) {
  const run = new Run(L);
  for (let e = 0; e < sol.length; e++) {
    if (e > 0 && !run.newEpoch()) return { run, won: false, why: `no epoch ${e + 1}` };
    for (const ch of sol[e]) {
      if (!run.step(codeOf(ch))) return { run, won: false, why: `epoch ${e + 1}: blocked at tick ${run.t} (${run.status})` };
    }
    if (run.status === 'won') return { run, won: e === sol.length - 1, epochs: run.epoch, ticks: run.ticks, why: e === sol.length - 1 ? '' : `won early in epoch ${e + 1}` };
  }
  return { run, won: false, why: `not solved (${run.status})` };
}
