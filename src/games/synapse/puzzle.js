// SYNAPSE (2026-11-08): the boards. A pure module (no DOM) shared by the game, the campaign's seed picker
// (tools/games/synapse/pick.mjs) and the tests.
//
// A board is an n × n grid of cells: plain cells, dead cells (holes, not part of the board), myelin bridges (one path
// may cross straight over another there: a horizontal lane and a vertical lane) and gates (a path goes straight
// through, the way the arrow points, read from its source neuron). Pairs of neurons sit on plain cells.
//
// The generator: the board's cells (and each bridge's two lanes) as a graph, covered by "thin" paths: a path never
// touches itself (no two of its cells side by side unless they follow each other), so it has no shortcut, and a board
// made of thin paths almost always has exactly one answer. It starts from every cell on its own, then walks: an end of
// one path takes over a neighbouring path's piece, or two paths join, while every path stays thin, until there are as
// many paths as the board wants, each 3 cells or longer; a few hundred more moves shuffle where the ends sit. The two
// ends of each path are a pair of neurons.
// The solver: grows each color from its source, most constrained first, with dead-end, stranded-region and gate
// checks, and counts the answers up to a limit (a campaign board has exactly one).
import { rng } from '../kit/fx.js';

export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
export const DX = Object.freeze([0, 1, 0, -1]);
export const DY = Object.freeze([-1, 0, 1, 0]);
export const OPP = Object.freeze([2, 3, 0, 1]);
export const CELL = 0, DEAD = 1, BRIDGE = 2, GATE = 3;
export const MAX_N = 10;

const NB = new Map();
// the four neighbours of every cell (−1 off the board), cached per size
export function neighbors(n) {
  let nb = NB.get(n);
  if (nb) return nb;
  nb = new Int16Array(n * n * 4).fill(-1);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= 0 && ny >= 0 && nx < n && ny < n) nb[(y * n + x) * 4 + d] = ny * n + nx;
    }
  }
  NB.set(n, nb);
  return nb;
}
// the direction from cell a to its neighbour b (−1 if they aren't neighbours)
export function dirOf(n, a, b) {
  const ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0;
  if (ay === by && bx === ax + 1) return RIGHT;
  if (ay === by && bx === ax - 1) return LEFT;
  if (ax === bx && by === ay + 1) return DOWN;
  if (ax === bx && by === ay - 1) return UP;
  return -1;
}
export const adjacent = (n, a, b) => dirOf(n, a, b) >= 0;

// ---------- the board's shape: holes and bridges ----------
function liveCheck(n, kind) {
  const nb = neighbors(n), N2 = n * n;
  let start = -1, live = 0;
  for (let i = 0; i < N2; i++) {
    if (kind[i] === DEAD) continue;
    live++;
    if (start < 0) start = i;
    let deg = 0;
    for (let d = 0; d < 4; d++) { const j = nb[i * 4 + d]; if (j >= 0 && kind[j] !== DEAD) deg++; }
    if (deg < 2) return false;
  }
  if (start < 0) return false;
  const seen = new Uint8Array(N2), stack = [start];
  seen[start] = 1;
  let reached = 1;
  while (stack.length) {
    const i = stack.pop();
    for (let d = 0; d < 4; d++) {
      const j = nb[i * 4 + d];
      if (j >= 0 && kind[j] !== DEAD && !seen[j]) { seen[j] = 1; reached++; stack.push(j); }
    }
  }
  return reached === live;
}

// holes: small shapes (a cell, two, an L, a 2 × 2 block), mostly bitten out of the edge so the board's outline turns
// irregular, mirrored (half a turn round, or left to right) most of the time so it looks designed
const STAMPS = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]]];
function carveHoles(n, kind, r, holes) {
  const N2 = n * n;
  const rot = (i) => N2 - 1 - i, flip = (i) => ((i / n) | 0) * n + (n - 1 - (i % n));
  let left = holes, guard = 0;
  while (left > 0 && guard++ < 80) {
    const stamp = STAMPS[Math.min(STAMPS.length - 1, (r.next() * Math.min(STAMPS.length, left + 1)) | 0)];
    const w = 1 + Math.max(...stamp.map((c) => c[0])), h = 1 + Math.max(...stamp.map((c) => c[1]));
    let x = r.int(0, n - w), y = r.int(0, n - h);
    if (r.chance(0.7)) {
      // against an edge
      const side = r.int(0, 3);
      if (side === 0) y = 0; else if (side === 1) x = n - w; else if (side === 2) y = n - h; else x = 0;
    }
    const cells = stamp.map(([dx, dy]) => (y + dy) * n + x + dx);
    const mirror = cells.length * 2 <= left + 1 && r.chance(0.85) ? (r.chance(0.5) ? rot : flip) : null;
    const all = mirror ? [...new Set(cells.concat(cells.map(mirror)))] : cells;
    if (all.some((i) => kind[i] !== CELL) || all.length > left + 1) continue;
    for (const i of all) kind[i] = DEAD;
    left -= all.length;
  }
}

function placeBridges(n, kind, r, count) {
  const nb = neighbors(n);
  const spots = [];
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) spots.push(y * n + x);
  r.shuffle(spots);
  const placed = [];
  for (const i of spots) {
    if (placed.length >= count) break;
    if (kind[i] !== CELL) continue;
    let ok = true;
    for (let d = 0; d < 4 && ok; d++) if (kind[nb[i * 4 + d]] !== CELL) ok = false;
    // apart from each other: no two bridges share a neighbouring cell
    for (const b of placed) if (Math.abs((b % n) - (i % n)) + Math.abs(((b / n) | 0) - ((i / n) | 0)) <= 2) ok = false;
    if (!ok) continue;
    kind[i] = BRIDGE;
    placed.push(i);
  }
  return placed.length === count;
}

export function makeShape(spec, r) {
  const n = spec.n, N2 = n * n;
  for (let attempt = 0; attempt < 300; attempt++) {
    const kind = new Uint8Array(N2);
    if (spec.holes) carveHoles(n, kind, r, typeof spec.holes === 'number' ? spec.holes : r.int(spec.holes[0], spec.holes[1]));
    if (spec.bridges && !placeBridges(n, kind, r, typeof spec.bridges === 'number' ? spec.bridges : r.int(spec.bridges[0], spec.bridges[1]))) continue;
    if (liveCheck(n, kind)) return kind;
  }
  return null;
}

// ---------- the graph: one node per cell, two per bridge (its horizontal lane is the cell's id, its vertical lane
// n² + the cell's id) ----------
export function buildGraph(n, kind) {
  const N2 = n * n, nb = neighbors(n);
  const adj = Array.from({ length: N2 * 2 }, () => []);
  const node = (j, d) => (kind[j] === BRIDGE ? ((d & 1) ? j : N2 + j) : j);
  let count = 0;
  for (let i = 0; i < N2; i++) {
    if (kind[i] === DEAD) continue;
    count += kind[i] === BRIDGE ? 2 : 1;
    for (let d = 0; d < 4; d++) {
      const j = nb[i * 4 + d];
      if (j < 0 || kind[j] === DEAD) continue;
      const a = node(i, d), b = node(j, d);
      adj[a].push(b);
    }
  }
  const virtual = new Uint8Array(N2 * 2);
  for (let i = 0; i < N2; i++) if (kind[i] === BRIDGE) { virtual[i] = 1; virtual[N2 + i] = 1; }
  const full = kind.every((k) => k === CELL);
  return { n, N2, adj, count, virtual, full, cell: (v) => (v >= N2 ? v - N2 : v) };
}

// ---------- thin paths ----------
// cover every node with thin paths (no path touches itself), walking toward `target` paths of minLen nodes or more;
// then `settle` more moves that keep the count and the lengths, to shuffle where the ends sit
function thinCover(G, r, { target, minLen, settle }) {
  const V = G.adj.length;
  const owner = new Int16Array(V).fill(-1), pos = new Int16Array(V).fill(-1);
  const paths = [];
  const index = (p) => { const P = paths[p]; for (let k = 0; k < P.length; k++) { owner[P[k]] = p; pos[P[k]] = k; } };
  // a bridge's lane always runs through: it starts as [one side, the lane, the other side]
  for (let v = 0; v < V; v++) if (G.virtual[v] && G.adj[v].length === 2) { paths.push([G.adj[v][0], v, G.adj[v][1]]); index(paths.length - 1); }
  for (let v = 0; v < V; v++) if (G.adj[v].length && owner[v] < 0) { paths.push([v]); index(paths.length - 1); }
  const mark = new Int32Array(V);
  let stamp = 0;
  // P + take stays thin: no link between them but P's end to take's first node
  const thin = (P, take) => {
    stamp++;
    for (const x of P) mark[x] = stamp;
    const e = P[P.length - 1];
    for (let i = 0; i < take.length; i++) for (const z of G.adj[take[i]]) if (mark[z] === stamp && !(i === 0 && z === e)) return false;
    return true;
  };
  const drop = (q) => {
    const last = paths.length - 1;
    if (q !== last) { paths[q] = paths[last]; index(q); }
    paths.pop();
  };
  const shortest = () => paths.reduce((m, P) => Math.min(m, P.length), Infinity);
  const budget = V * 260 + settle;
  let settled = 0;
  for (let it = 0; it < budget; it++) {
    const reached = paths.length <= target && shortest() >= minLen;
    if (reached && settled++ >= settle) break;
    // work from short paths more often
    let p = (r.next() * paths.length) | 0;
    if (!reached && r.next() < 0.5) {
      for (let t = 0; t < 3; t++) { const c = (r.next() * paths.length) | 0; if (paths[c].length < paths[p].length) p = c; }
    }
    const P = paths[p];
    if (r.next() < 0.5) { P.reverse(); index(p); }
    const e = P[P.length - 1];
    const nbs = G.adj[e];
    const u = nbs[(r.next() * nbs.length) | 0];
    const q = owner[u];
    if (q === p || G.virtual[u]) continue;
    const Q = paths[q], j = pos[u];
    const fromStart = r.next() < 0.5;
    const take = fromStart ? Q.slice(0, j + 1).reverse() : Q.slice(j);
    const rest = fromStart ? Q.slice(j + 1) : Q.slice(0, j);
    if (rest.length) {
      if (G.virtual[fromStart ? rest[0] : rest[rest.length - 1]]) continue;
      // once there: keep the count and every length (a short piece left behind only now and then before)
      if (rest.length < minLen && (reached || (Q.length >= minLen && r.next() < 0.85))) continue;
    } else if (reached) continue;
    if (!thin(P, take)) continue;
    paths[p] = P.concat(take);
    index(p);
    if (rest.length) { paths[q] = rest; index(q); } else drop(q);
  }
  return paths.length <= target && shortest() >= minLen ? paths : null;
}

// ---------- a whole board ----------
// spec: { n, pairs: [min, max], holes: count | [min, max], bridges: count | [min, max], minLen }
// → { n, kind, gdir, pairs: [{ s, t }] (s: the source), sol: [[cells from s to t]], seed }
export function generate(spec, seed) {
  const r = rng((seed >>> 0) || 1);
  const n = spec.n, N2 = n * n;
  const minLen = spec.minLen || 3;
  for (let attempt = 0; attempt < 120; attempt++) {
    const kind = makeShape(spec, r);
    if (!kind) continue;
    const G = buildGraph(n, kind);
    const k = r.int(spec.pairs[0], spec.pairs[1]);
    const paths = thinCover(G, r, { target: k, minLen, settle: G.count * 6 });
    if (!paths || paths.length < spec.pairs[0]) continue;
    const sol = paths.map((P) => P.map(G.cell));
    // each pair's source: one end, at random; the colors in a shuffled order
    const order = r.shuffle(sol.map((_, i) => i));
    const out = order.map((i) => (r.chance(0.5) ? sol[i].slice().reverse() : sol[i]));
    return {
      n, kind, gdir: new Int8Array(N2).fill(-1), seed: seed >>> 0,
      pairs: out.map((P) => ({ s: P[0], t: P[P.length - 1] })),
      sol: out,
    };
  }
  throw new Error(`synapse: no board for ${JSON.stringify(spec)} #${seed}`);
}

// a copy (the game changes nothing in a board, but gates are added to copies)
export const clone = (pz) => ({ ...pz, kind: pz.kind.slice(), gdir: pz.gdir.slice(), pairs: pz.pairs.map((p) => ({ ...p })), sol: pz.sol.map((P) => P.slice()) });

// where the answer goes straight through a plain cell (a gate can sit there), with its direction from the source
export function straightCells(pz) {
  const out = [];
  pz.sol.forEach((P, c) => {
    for (let k = 1; k < P.length - 1; k++) {
      const i = P[k];
      if (pz.kind[i] !== CELL) continue;
      const d1 = dirOf(pz.n, P[k - 1], i), d2 = dirOf(pz.n, i, P[k + 1]);
      if (d1 === d2 && d1 >= 0) out.push({ cell: i, dir: d1, color: c });
    }
  });
  return out;
}
// gates on these cells, each pointing the way the answer goes through it
export function withGates(pz, cells) {
  const out = clone(pz);
  const byCell = new Map(straightCells(pz).map((s) => [s.cell, s]));
  for (const c of cells) {
    const s = byCell.get(c);
    if (!s) throw new Error(`synapse: no gate at ${c}`);
    out.kind[c] = GATE;
    out.gdir[c] = s.dir;
  }
  return out;
}

// ---------- the solver ----------
// Each color grows from both of its neurons at once (two heads); every step the most constrained head anywhere on the
// board moves (one way: no choice at all), straight on through gates (the arrow's way, read from the source) and
// bridges. After each step: every free cell still needs two ways in, every free lane and gate both of its ends, every
// region of free space a color with both heads on its edge, and every color its two heads in one region.
// → { count (answers found, up to `limit`; −1 if it ran out of budget first), nodes, solutions (with collect: each
// color's cells from its source to its target) }
export function solve(pz, { limit = 2, budget = 400000, collect = false } = {}) {
  const { n, kind, gdir, pairs } = pz;
  const N2 = n * n, K = pairs.length, nb = neighbors(n);
  const occ = new Int8Array(N2 * 2);         // [cell or H lane | V lane]: color + 1
  const headAt = new Int8Array(N2);          // (color · 2 + side) + 1 of the head on this cell
  const head = new Int16Array(K * 2), done = new Uint8Array(K);
  const CAP = N2 * 2 + 2;
  const pcells = new Int16Array(K * 2 * CAP), plen = new Int16Array(K * 2);
  // undo log: [what, index, old value]
  let log = new Int32Array(3 * 8192), top = 0;
  const OCC = 0, HEADAT = 1, HEAD = 2, DONE = 3, PLEN = 4;
  const put = (t, i, v) => {
    if (top + 3 > log.length) { const bigger = new Int32Array(log.length * 2); bigger.set(log); log = bigger; }
    let old;
    if (t === OCC) { old = occ[i]; occ[i] = v; } else if (t === HEADAT) { old = headAt[i]; headAt[i] = v; }
    else if (t === HEAD) { old = head[i]; head[i] = v; } else if (t === DONE) { old = done[i]; done[i] = v; }
    else { old = plen[i]; plen[i] = v; }
    log[top++] = t; log[top++] = i; log[top++] = old;
  };
  const undo = (mark) => {
    while (top > mark) {
      const old = log[--top], i = log[--top], t = log[--top];
      if (t === OCC) occ[i] = old; else if (t === HEADAT) headAt[i] = old; else if (t === HEAD) head[i] = old;
      else if (t === DONE) done[i] = old; else plen[i] = old;
    }
  };
  let free = 0;
  for (let i = 0; i < N2; i++) if (kind[i] !== DEAD) free += kind[i] === BRIDGE ? 2 : 1;
  for (let c = 0; c < K; c++) {
    const { s, t } = pairs[c];
    occ[s] = c + 1; occ[t] = c + 1;
    head[c * 2] = s; head[c * 2 + 1] = t;
    headAt[s] = c * 2 + 1; headAt[t] = c * 2 + 2;
    pcells[c * 2 * CAP] = s; pcells[(c * 2 + 1) * CAP] = t;
    plen[c * 2] = 1; plen[c * 2 + 1] = 1;
    free -= 2;
  }
  const laneOf = (j, d) => ((d & 1) ? j : N2 + j);
  // a gate lets a head through when the flow (source → target) runs the arrow's way: forward from the source, backward
  // from the target
  const gateOk = (j, d, side) => gdir[j] === (side ? OPP[d] : d);

  // can this head (color c, side 0 from the source or 1 from the target) step in direction d?
  const canStep = (c, side, d) => {
    const e = c * 2 + side, other = head[e ^ 1];
    let j = nb[head[e] * 4 + d];
    for (;;) {
      if (j < 0) return false;
      if (j === other) return true;
      const k = kind[j];
      if (k === CELL) return occ[j] === 0;
      if (k === DEAD) return false;
      if (k === GATE) { if (occ[j] || !gateOk(j, d, side)) return false; }
      else if (occ[laneOf(j, d)]) return false;
      j = nb[j * 4 + d];
    }
  };
  // the two heads of color c meet in one step?
  const meets = (c) => {
    const other = head[c * 2 + 1];
    for (let d = 0; d < 4; d++) {
      let j = nb[head[c * 2] * 4 + d];
      while (j >= 0 && j !== other) {
        const k = kind[j];
        if (k === GATE ? (occ[j] || gdir[j] !== d) : k === BRIDGE ? occ[laneOf(j, d)] : true) break;
        j = nb[j * 4 + d];
      }
      if (j === other) return true;
    }
    return false;
  };
  const step = (c, side, d) => {
    const e = c * 2 + side, from = head[e], other = head[e ^ 1];
    const base = e * CAP;
    let j = nb[from * 4 + d];
    for (;;) {
      if (j === other) {
        put(DONE, c, 1); put(HEADAT, from, 0); put(HEADAT, other, 0);
        return;
      }
      pcells[base + plen[e]] = j; put(PLEN, e, plen[e] + 1);
      free--;
      const k = kind[j];
      if (k === CELL) {
        put(OCC, j, c + 1);
        put(HEADAT, from, 0); put(HEADAT, j, e + 1); put(HEAD, e, j);
        return;
      }
      put(OCC, k === GATE ? j : laneOf(j, d), c + 1);
      j = nb[j * 4 + d];
    }
  };
  const freeAlong = (j, d) => {
    const k = kind[j];
    if (k === CELL) return occ[j] === 0;
    if (k === GATE) return occ[j] === 0 && (gdir[j] & 1) === (d & 1);
    if (k === BRIDGE) return occ[laneOf(j, d)] === 0;
    return false;
  };
  const queue = new Int16Array(N2 * 2);
  const seen = new Int32Array(N2 * 2);
  let stamp = 0;
  const dead = () => {
    for (let i = 0; i < N2; i++) {
      const k = kind[i];
      if (k === CELL) {
        if (occ[i]) continue;
        let ways = 0;
        for (let d = 0; d < 4 && ways < 2; d++) {
          const j = nb[i * 4 + d];
          if (j >= 0 && (headAt[j] || freeAlong(j, d))) ways++;
        }
        if (ways < 2) return true;
      } else if (k === GATE) {
        if (occ[i]) continue;
        const g = gdir[i], a = nb[i * 4 + OPP[g]], b = nb[i * 4 + g];
        if (a < 0 || b < 0) return true;
        // in from a source-side head (or free space), out to a target-side head (or free space)
        if (!(freeAlong(a, g) || (headAt[a] && !((headAt[a] - 1) & 1)))) return true;
        if (!(freeAlong(b, g) || (headAt[b] && ((headAt[b] - 1) & 1)))) return true;
      } else if (k === BRIDGE) {
        if (!occ[i]) {
          const a = nb[i * 4 + LEFT], b = nb[i * 4 + RIGHT];
          if (!(headAt[a] || freeAlong(a, LEFT)) || !(headAt[b] || freeAlong(b, RIGHT))) return true;
        }
        if (!occ[N2 + i]) {
          const a = nb[i * 4 + UP], b = nb[i * 4 + DOWN];
          if (!(headAt[a] || freeAlong(a, UP)) || !(headAt[b] || freeAlong(b, DOWN))) return true;
        }
      }
    }
    // regions of free space: each needs a color with both heads on its edge
    stamp++;
    let ok = 0;
    for (let start = 0; start < N2 * 2; start++) {
      const cell = start >= N2 ? start - N2 : start;
      const k = kind[cell];
      if ((start >= N2 && k !== BRIDGE) || k === DEAD || occ[start] || seen[start] === stamp) continue;
      let qh = 0, qt = 0, m0 = 0, m1 = 0;
      queue[qt++] = start; seen[start] = stamp;
      while (qh < qt) {
        const u = queue[qh++];
        const ci = u >= N2 ? u - N2 : u, ku = kind[ci];
        for (let d = 0; d < 4; d++) {
          if (ku === GATE ? (d & 1) !== (gdir[ci] & 1) : ku === BRIDGE && (u >= N2 ? (d & 1) : !(d & 1))) continue;
          const j = nb[ci * 4 + d];
          if (j < 0) continue;
          const kj = kind[j];
          if (kj === CELL) {
            if (!occ[j]) { if (seen[j] !== stamp) { seen[j] = stamp; queue[qt++] = j; } }
            else if (headAt[j]) { const h = headAt[j] - 1; if (h & 1) m1 |= 1 << (h >> 1); else m0 |= 1 << (h >> 1); }
          } else if (kj === GATE) {
            if (!occ[j] && (gdir[j] & 1) === (d & 1) && seen[j] !== stamp) { seen[j] = stamp; queue[qt++] = j; }
          } else if (kj === BRIDGE) {
            const v = laneOf(j, d);
            if (!occ[v] && seen[v] !== stamp) { seen[v] = stamp; queue[qt++] = v; }
          }
        }
      }
      const both = m0 & m1;
      if (!both) return true;
      ok |= both;
    }
    for (let c = 0; c < K; c++) if (!done[c] && !((ok >> c) & 1) && !meets(c)) return true;
    return false;
  };

  let nodes = 0, found = 0, aborted = false;
  const solutions = [];
  const answer = () => Array.from({ length: K }, (_, c) => {
    const a = Array.from(pcells.subarray(c * 2 * CAP, c * 2 * CAP + plen[c * 2]));
    const b = Array.from(pcells.subarray((c * 2 + 1) * CAP, (c * 2 + 1) * CAP + plen[c * 2 + 1]));
    return a.concat(b.reverse());
  });
  const search = () => {
    if (++nodes > budget) { aborted = true; return; }
    let best = -1, bestN = 5, bestMask = 0, open = false;
    for (let e = 0; e < K * 2 && bestN > 1; e++) {
      const c = e >> 1;
      if (done[c]) continue;
      open = true;
      let cnt = 0, mask = 0;
      for (let d = 0; d < 4; d++) if (canStep(c, e & 1, d)) { cnt++; mask |= 1 << d; }
      if (!cnt) return;
      if (cnt < bestN) { bestN = cnt; best = e; bestMask = mask; }
    }
    if (!open) {
      for (let c = 0; c < K && !open; c++) if (!done[c]) open = true;
    }
    if (!open) {
      if (free === 0) { found++; if (collect) solutions.push(answer()); }
      return;
    }
    for (let d = 0; d < 4; d++) {
      if (!((bestMask >> d) & 1)) continue;
      const mark = top, f = free;
      step(best >> 1, best & 1, d);
      if (!dead()) search();
      undo(mark);
      free = f;
      if (found >= limit || aborted) return;
    }
  };
  if (!dead()) search();
  return { count: aborted ? -1 : found, nodes, solutions };
}

// the same answer? (each color's cells, in order)
export const sameSolution = (a, b) => a.length === b.length && a.every((P, c) => P.length === b[c].length && P.every((v, k) => v === b[c][k]));

// add gates (one-way synapses) where a second answer disagrees with the board's own, until the board has one answer;
// then a few more where the answer goes straight, up to `min`.
// → { gates: cells, needed: how many it took to make the answer the only one } or null (more than one answer after
// `max` gates, or the solver ran out of budget)
export function gateUntilUnique(pz, r, { min = 0, max = 5, budget = 400000 } = {}) {
  let cur = pz;
  const gates = [];
  const straight = straightCells(pz);
  for (let round = 0; round <= max; round++) {
    const res = solve(cur, { limit: 2, budget, collect: true });
    if (res.count <= 0) return null;
    if (res.count === 1) {
      const needed = gates.length;
      const extra = straight.filter((s) => !gates.includes(s.cell) && !nextToGate(pz.n, gates, s.cell));
      r.shuffle(extra);
      while (gates.length < min && extra.length) {
        const s = extra.pop();
        if (!nextToGate(pz.n, gates, s.cell)) gates.push(s.cell);
      }
      return { gates: gates.sort((x, y) => x - y), needed };
    }
    if (gates.length >= max) return null;
    const other = res.solutions.find((x) => !sameSolution(x, pz.sol));
    if (!other) return null;
    const how = traversal(pz.n, other);
    const cand = straight.filter((s) => {
      if (gates.includes(s.cell) || nextToGate(pz.n, gates, s.cell)) return false;
      const t = how.get(s.cell);
      return !t || t.din !== s.dir || t.dout !== s.dir;
    });
    if (!cand.length) return null;
    gates.push(cand[(r.next() * cand.length) | 0].cell);
    cur = withGates(pz, gates);
  }
  return null;
}
const nextToGate = (n, gates, c) => gates.some((g) => adjacent(n, g, c));
// how each cell is crossed in an answer: its color, the direction in and out (from its source)
function traversal(n, sol) {
  const m = new Map();
  sol.forEach((P, c) => {
    for (let k = 1; k < P.length - 1; k++) m.set(P[k], { c, din: dirOf(n, P[k - 1], P[k]), dout: dirOf(n, P[k], P[k + 1]) });
  });
  return m;
}

// a board in one line (for tests and the seed picker): its cells, its pairs
export function encode(pz) {
  const k = Array.from(pz.kind, (v, i) => (v === GATE ? 'g' + pz.gdir[i] : '.#B'[v])).join('');
  return `${pz.n}:${k}:${pz.pairs.map((p) => `${p.s}-${p.t}`).join(',')}`;
}
// a short checksum of some boards (FNV-1a), to notice if the generator ever changes what a seed makes
export function checksum(strings) {
  let h = 0x811c9dc5;
  for (const s of strings) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// a board with one answer, made live (Rush, the Daily): seed after seed until the solver agrees (deterministic)
export function uniqueBoard(spec, seed, { tries = 60, budget = 60000, gates = 0 } = {}) {
  for (let k = 0; k < tries; k++) {
    const s = (Math.imul(seed >>> 0, 2654435761) + k * 40503 + 1) >>> 0;
    const pz = generate(spec, s);
    if (gates) {
      const g = gateUntilUnique(pz, rng(s ^ 0x5bd1e995), { min: gates, max: gates + 3, budget });
      if (g) return withGates(pz, g.gates);
      continue;
    }
    if (solve(pz, { limit: 2, budget }).count === 1) return pz;
  }
  return null;
}
