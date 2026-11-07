// SYNAPSE (2026-11-08): the player's board. Pure (no DOM): the game, the demo's player and the tests drive it the
// same way.
//
// Each color has at most one path, kept from the neuron where it was started (its anchor). Pressing a neuron or a
// path picks it up: a neuron starts its color again from there (or keeps the path up to it), a path cell keeps the path
// up to that cell. Dragging moves the path's head one cell at a time: back onto itself cuts it back, into another
// color's path cuts that one at the crossing (only for as long as the drag goes on: back off and it comes back, like a
// rubber band), into its twin neuron connects the pair. Bridges carry one path across and one over (each goes
// straight on); a gate is crossed straight on, the way its arrow points, read from the color's source neuron (so from
// the other end it's crossed against the arrow). Letting go keeps the path. A quick tap on a path clears it.
// Solved: every pair connected and every cell (both lanes of every bridge) filled.
import { CELL, DEAD, BRIDGE, GATE, OPP, DX, DY, UP, RIGHT, DOWN, LEFT, neighbors, dirOf } from './puzzle.js';

export class Board {
  constructor(pz) {
    this.pz = pz;
    this.n = pz.n;
    this.N2 = pz.n * pz.n;
    this.K = pz.pairs.length;
    this.nb = neighbors(pz.n);
    this.endAt = new Int8Array(this.N2).fill(-1);
    pz.pairs.forEach((p, c) => { this.endAt[p.s] = c; this.endAt[p.t] = c; });
    this.units = 0;
    for (let i = 0; i < this.N2; i++) if (pz.kind[i] !== DEAD) this.units += pz.kind[i] === BRIDGE ? 2 : 1;
    this.paths = Array.from({ length: this.K }, () => []);
    this.history = [];
    this.moves = 0;
    this.lastColor = -1;
    this.undos = 0;
    this.hints = 0;
    this.hinted = new Set();
    this.drag = null;          // { c, cur, base, moved }
    this.view = this.paths;    // what's on the board right now (the drag's version while dragging)
    this.own = new Int8Array(this.N2 * 2);
    this.derive();
  }

  // ---------- reading the board ----------
  // the unit a path's k-th cell takes: the cell, or the bridge lane it crosses (n² + cell for the vertical lane)
  unitOf(P, k) {
    const v = P[k];
    if (this.pz.kind[v] !== BRIDGE) return v;
    const d = k > 0 ? dirOf(this.n, P[k - 1], v) : dirOf(this.n, v, P[k + 1]);
    return d & 1 ? v : this.N2 + v;
  }
  other(c, cell) { const p = this.pz.pairs[c]; return cell === p.s ? p.t : p.s; }
  connected(c, P = this.view[c]) {
    return P.length >= 2 && this.endAt[P[0]] === c && P[P.length - 1] === this.other(c, P[0]);
  }
  // who is on a cell (−1: nobody): a bridge answers for its lane, `axis` 1 across, 0 up and down
  ownerAt(cell, axis = 1) {
    if (this.pz.kind[cell] === BRIDGE) return this.own[axis ? cell : this.N2 + cell] - 1;
    return this.own[cell] - 1;
  }
  derive() {
    const own = this.own;
    own.fill(0);
    this.view.forEach((P, c) => { for (let k = 0; k < P.length; k++) own[this.unitOf(P, k)] = c + 1; });
    for (let c = 0; c < this.K; c++) { const p = this.pz.pairs[c]; own[p.s] = c + 1; own[p.t] = c + 1; }
  }
  stats() {
    let pairs = 0, filled = 0;
    for (let c = 0; c < this.K; c++) if (this.connected(c)) pairs++;
    for (let i = 0; i < this.N2; i++) {
      const k = this.pz.kind[i];
      if (k === DEAD) continue;
      if (k === BRIDGE) { if (this.own[i]) filled++; if (this.own[this.N2 + i]) filled++; } else if (this.own[i]) filled++;
    }
    return { pairs, total: this.K, filled, units: this.units, pct: Math.floor((filled / this.units) * 100 + 1e-9) };
  }
  solved() {
    const s = this.stats();
    return s.pairs === s.total && s.filled === s.units;
  }
  get perfect() { return this.moves <= this.K && this.undos === 0 && this.hints === 0; }

  // ---------- picking a path up ----------
  // what a press on `cell` would pick up: { c, cell, k (index in its path, −1 for a neuron not on it) } or null.
  // On a bridge with two paths, `axis` says which: 1 across (a press nearer its left or right), 0 up and down.
  pick(cell, axis = 0) {
    if (cell < 0 || cell >= this.N2 || this.pz.kind[cell] === DEAD) return null;
    const e = this.endAt[cell];
    if (e >= 0) return { c: e, cell, k: this.paths[e].indexOf(cell) };
    if (this.pz.kind[cell] === BRIDGE) {
      const h = this.own[cell] - 1, v = this.own[this.N2 + cell] - 1;
      const across = h >= 0 && (v < 0 || axis === 1);
      const c = across ? h : v;
      if (c < 0) return null;
      const P = this.paths[c], lane = across ? cell : this.N2 + cell;
      for (let k = 0; k < P.length; k++) if (P[k] === cell && this.unitOf(P, k) === lane) return { c, cell, k };
      return null;
    }
    const c = this.own[cell] - 1;
    if (c < 0) return null;
    return { c, cell, k: this.paths[c].indexOf(cell) };
  }
  // start dragging what `pick` found
  begin(p) {
    if (!p) return false;
    const { c, cell, k } = p;
    const P = this.paths[c];
    const cur = k >= 0 ? P.slice(0, k + 1) : [cell];
    this.drag = { c, cur, base: this.paths.map((x) => x.slice()), moved: false, blocked: null };
    this.refresh();
    return true;
  }
  get head() { const d = this.drag; return d ? d.cur[d.cur.length - 1] : -1; }
  get dragColor() { return this.drag ? this.drag.c : -1; }

  // ---------- dragging ----------
  // one step of the head to a neighbouring cell → 'step' | 'back' | 'cut' (back onto itself) | 'done' (connected) |
  // false (not allowed) | 'gate' (a gate's arrow said no)
  stepTo(j) {
    const d0 = this.drag;
    if (!d0) return false;
    const { c, cur } = d0;
    const n = this.n, kind = this.pz.kind;
    const h = cur[cur.length - 1];
    const d = dirOf(n, h, j);
    if (d < 0) return false;
    // back the way it came
    if (cur.length >= 2 && j === cur[cur.length - 2]) {
      cur.pop();
      d0.moved = true;
      this.refresh();
      return 'back';
    }
    // on a bridge or a gate the head goes straight on
    if (cur.length >= 2 && (kind[h] === BRIDGE || kind[h] === GATE) && dirOf(n, cur[cur.length - 2], h) !== d) return false;
    if (kind[j] === DEAD) return false;
    // into its own path: cut back to there (a bridge's other lane is crossed instead)
    for (let k = cur.length - 1; k >= 0; k--) {
      if (cur[k] !== j) continue;
      if (kind[j] === BRIDGE) {
        const lane = d & 1 ? j : this.N2 + j;
        if (this.unitOf(cur, k) !== lane) continue;
      }
      cur.length = k + 1;
      d0.moved = true;
      this.refresh();
      return 'cut';
    }
    // past its twin: no further
    if (this.connected(c, cur)) return false;
    const e = this.endAt[j];
    if (e >= 0) {
      if (e !== c) return false;
      cur.push(j);
      d0.moved = true;
      this.refresh();
      return 'done';
    }
    if (kind[j] === GATE) {
      const fromSource = cur[0] === this.pz.pairs[c].s;
      if (d !== (fromSource ? this.pz.gdir[j] : OPP[this.pz.gdir[j]])) { d0.blocked = j; return 'gate'; }
    }
    cur.push(j);
    d0.moved = true;
    this.refresh();
    return 'step';
  }
  // walk the head toward any cell, a step at a time (a quick drag skips cells: the axis with further to go first)
  towards(t) {
    if (!this.drag || t < 0) return [];
    const out = [];
    const n = this.n, tx = t % n, ty = (t / n) | 0;
    for (let guard = 0; guard < n * 3; guard++) {
      const h = this.head;
      if (h === t) break;
      if (dirOf(n, h, t) >= 0) { const r = this.stepTo(t); if (r) out.push(r); break; }
      // somewhere back along its own path: straight back there
      const k = this.drag.cur.lastIndexOf(t);
      if (k >= 0 && this.pz.kind[t] !== BRIDGE) { this.drag.cur.length = k + 1; this.drag.moved = true; this.refresh(); out.push('cut'); break; }
      const hx = h % n, hy = (h / n) | 0, dx = tx - hx, dy = ty - hy;
      const across = dx > 0 ? RIGHT : dx < 0 ? LEFT : -1, upDown = dy > 0 ? DOWN : dy < 0 ? UP : -1;
      const order = Math.abs(dx) >= Math.abs(dy) ? [across, upDown] : [upDown, across];
      let moved = false;
      for (const dir of order) {
        if (dir < 0) continue;
        const j = this.nb[h * 4 + dir];
        if (j < 0) continue;
        const r = this.stepTo(j);
        if (r === 'gate') out.push(r);
        else if (r) { out.push(r); moved = true; break; }
      }
      if (!moved) break;
    }
    return out;
  }
  // the board as it would be with the drag let go now: the drag's color is `cur`, every other color cut where `cur`
  // crosses it (from its own anchor, up to the crossing)
  refresh() {
    const dg = this.drag;
    if (!dg) { this.view = this.paths; this.derive(); return; }
    const taken = new Set();
    for (let k = 0; k < dg.cur.length; k++) taken.add(this.unitOf(dg.cur, k));
    this.view = dg.base.map((P, o) => {
      if (o === dg.c) return dg.cur;
      for (let k = 1; k < P.length; k++) if (taken.has(this.unitOf(P, k))) return P.slice(0, k);
      return P;
    });
    this.derive();
  }
  // which colors the drag is cutting right now
  cutting() {
    const dg = this.drag;
    if (!dg) return [];
    return dg.base.map((P, o) => (o !== dg.c && this.view[o].length < P.length ? o : -1)).filter((o) => o >= 0);
  }
  // let go: the drag's board is kept → { changed, c, connected (newly), cleared }
  end({ tap = false } = {}) {
    const dg = this.drag;
    if (!dg) return null;
    this.drag = null;
    let next = this.view.map((P) => P.slice());
    if (tap && !dg.moved) next[dg.c] = [];
    // a lone neuron is no path
    next = next.map((P) => (P.length < 2 ? [] : P));
    const changed = next.some((P, o) => !same(P, dg.base[o]));
    const was = this.connected(dg.c, dg.base[dg.c]);
    if (changed) {
      this.history.push(dg.base.map((P) => (P.length < 2 ? [] : P)));
      if (this.history.length > 200) this.history.shift();
      this.paths = next;
      if (dg.c !== this.lastColor) { this.moves++; this.lastColor = dg.c; }
    }
    this.view = this.paths;
    this.derive();
    return { changed, c: dg.c, connected: !was && this.connected(dg.c), cleared: tap && changed && !this.paths[dg.c].length };
  }
  // the system took the touch away: back as it was
  cancel() {
    if (!this.drag) return;
    this.drag = null;
    this.view = this.paths;
    this.derive();
  }

  // ---------- the buttons ----------
  undo() {
    if (this.drag || !this.history.length) return false;
    this.paths = this.history.pop();
    this.view = this.paths;
    this.undos++;
    this.lastColor = -1;
    this.derive();
    return true;
  }
  restart() {
    if (this.drag) this.cancel();
    if (!this.paths.some((P) => P.length)) return false;
    this.history.push(this.paths.map((P) => P.slice()));
    this.paths = this.paths.map(() => []);
    this.view = this.paths;
    this.moves = 0;
    this.lastColor = -1;
    this.undos = 0;
    this.derive();
    return true;
  }
  // a hint: the first color not yet drawn the way the answer goes, drawn for you (from its source); colors in its way
  // are cut. → the color, or −1 (nothing to show)
  hint() {
    if (this.drag) this.cancel();
    const sol = this.pz.sol;
    let c = -1;
    for (let o = 0; o < this.K && c < 0; o++) {
      const P = this.paths[o];
      if (!(same(P, sol[o]) || same(P.slice().reverse(), sol[o]))) c = o;
    }
    if (c < 0) return -1;
    this.history.push(this.paths.map((P) => P.slice()));
    const taken = new Set(sol[c].map((_, k) => this.unitOf(sol[c], k)));
    this.paths = this.paths.map((P, o) => {
      if (o === c) return sol[c].slice();
      for (let k = 1; k < P.length; k++) if (taken.has(this.unitOf(P, k))) return k < 2 ? [] : P.slice(0, k);
      return P;
    });
    this.view = this.paths;
    this.hints++;
    this.hinted.add(c);
    this.lastColor = -1;
    this.derive();
    return c;
  }
  // every path as its cells from its source to its target (the firing runs that way); unfinished ones as drawn
  flows() {
    return this.paths.map((P, c) => (P.length && P[0] === this.pz.pairs[c].t ? P.slice().reverse() : P.slice()));
  }
}

function same(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// the cell's centre in board units (for the demo's finger and the drawing)
export const center = (n, i) => ({ x: (i % n) + 0.5, y: ((i / n) | 0) + 0.5 });
export { DX, DY, CELL, GATE, BRIDGE, DEAD };
