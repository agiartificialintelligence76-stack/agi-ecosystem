// SYNAPSE (2026-11-08): a player that draws by itself (the arcade's preview, the title screen's board, a hint's
// stroke). It works the board exactly as a finger would (./rules.js: pick up a neuron, step cell by cell, let go), at a
// natural pace, with a visible fingertip. Deterministic: no dice at all.
export class Autoplayer {
  // board: a Board; sol: each color's cells (source → target); hooks: { press(c), step(result, cell, c, k), end(result),
  // done() }; pace: seconds a cell; wait: seconds before the first stroke
  constructor(board, { pace = 0.12, travel = 0.32, wait = 0, hooks = {}, from = null } = {}) {
    this.board = board;
    this.pace = pace;
    this.travel = travel;
    this.hooks = hooks;
    const n = board.n;
    this.finger = { x: from ? from.x : n / 2, y: from ? from.y : n + 0.6, down: false, alpha: 0 };
    this.strokes = planStrokes(board, this.finger);
    this.i = 0;
    this.phase = 'wait';
    this.t = -wait;
    this.k = 0;
    this.from = { x: this.finger.x, y: this.finger.y };
    this.finished = false;
  }
  get busy() { return !this.finished; }
  update(dt) {
    if (this.finished) return;
    this.t += dt;
    const f = this.finger, b = this.board, n = b.n;
    const at = (cell) => ({ x: (cell % n) + 0.5, y: ((cell / n) | 0) + 0.5 });
    if (this.phase !== 'wait' || this.t >= 0) f.alpha = Math.min(1, f.alpha + dt * 4);
    for (let guard = 0; guard < 8; guard++) {
      if (this.phase === 'wait') {
        if (this.t < 0) return;
        if (this.i >= this.strokes.length) { this.finish(); return; }
        this.phase = 'travel'; this.from = { x: f.x, y: f.y };
        continue;
      }
      const s = this.strokes[this.i];
      if (this.phase === 'travel') {
        const to = at(s[0]);
        const dur = this.travel * Math.min(1.4, 0.55 + Math.hypot(to.x - this.from.x, to.y - this.from.y) / 4);
        const k = Math.min(1, this.t / dur), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        f.x = this.from.x + (to.x - this.from.x) * e; f.y = this.from.y + (to.y - this.from.y) * e;
        if (k < 1) return;
        this.t -= dur; this.phase = 'press';
        f.down = true;
        b.begin(b.pick(s[0]));
        this.hooks.press?.(b.dragColor);
        continue;
      }
      if (this.phase === 'press') {
        if (this.t < 0.07) return;
        this.t -= 0.07; this.phase = 'draw'; this.k = 1;
        continue;
      }
      if (this.phase === 'draw') {
        if (this.k >= s.length) { this.phase = 'lift'; continue; }
        const a = at(s[this.k - 1]), z = at(s[this.k]);
        const k = Math.min(1, this.t / this.pace);
        f.x = a.x + (z.x - a.x) * k; f.y = a.y + (z.y - a.y) * k;
        if (k >= 0.5 && !this.entered) {
          this.entered = true;
          const c = b.dragColor, r = b.stepTo(s[this.k]);
          this.hooks.step?.(r, s[this.k], c, this.k);
        }
        if (k < 1) return;
        this.t -= this.pace; this.k++; this.entered = false;
        continue;
      }
      if (this.phase === 'lift') {
        if (this.t < 0.08) return;
        this.t -= 0.08;
        f.down = false;
        const r = b.end();
        this.hooks.end?.(r);
        this.i++;
        this.phase = this.i >= this.strokes.length ? 'wait' : 'travel';
        this.from = { x: f.x, y: f.y };
        if (this.i >= this.strokes.length) { this.finish(); return; }
        continue;
      }
      return;
    }
  }
  finish() {
    this.finished = true;
    this.finger.down = false;
    this.hooks.done?.();
  }
}

// the strokes still to draw: each color not already drawn the answer's way, from whichever of its neurons is nearer
// the finger, the next one always the nearest
export function planStrokes(board, finger) {
  const n = board.n, sol = board.pz.sol;
  const left = [];
  for (let c = 0; c < board.K; c++) {
    const P = board.paths[c];
    const ok = P.length === sol[c].length && (P.every((v, k) => v === sol[c][k]) || P.every((v, k) => v === sol[c][sol[c].length - 1 - k]));
    if (!ok) left.push(c);
  }
  const out = [];
  let fx = finger.x, fy = finger.y;
  const d = (cell) => Math.hypot((cell % n) + 0.5 - fx, ((cell / n) | 0) + 0.5 - fy);
  while (left.length) {
    let best = 0, bestD = Infinity, rev = false;
    left.forEach((c, i) => {
      const P = sol[c];
      const a = d(P[0]), b = d(P[P.length - 1]);
      if (a < bestD) { bestD = a; best = i; rev = false; }
      if (b < bestD) { bestD = b; best = i; rev = true; }
    });
    const c = left.splice(best, 1)[0];
    const cells = rev ? sol[c].slice().reverse() : sol[c].slice();
    out.push(cells);
    const last = cells[cells.length - 1];
    fx = (last % n) + 0.5; fy = ((last / n) | 0) + 0.5;
  }
  return out;
}
// how long drawing these strokes takes at `pace`
export function strokeTime(strokes, { pace = 0.12, travel = 0.32 } = {}) {
  return strokes.reduce((t, s) => t + travel * 0.9 + 0.07 + (s.length - 1) * pace + 0.08, 0);
}
// some colors already drawn (their answer's path), the board's other paths as they are
export function prefill(board, colors) {
  for (const c of colors) board.paths[c] = board.pz.sol[c].slice();
  board.view = board.paths;
  board.derive();
}
