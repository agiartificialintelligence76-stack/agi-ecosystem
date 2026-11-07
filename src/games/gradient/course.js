// GRADIENT DESCENT (2026-11-08): a hole, ready to play. Its parts become one height field (terrain.js) plus a small dip
// that holds the cup, the cup is moved onto the exact lowest point near where it was drawn, and its hazards become plain
// lists the physics reads every step. Pure: no DOM.
import { makeField, descend } from './terrain.js';
import { PHYS } from './physics.js';

export const DEFAULT_SIZE = [18, 18];
export const CUP_DIP = { a: -0.06, s: 0.62 };   // the cup's own little dip: a ball that stops at the rim trickles in

// def: { id, name, pun, par, size: [w, d], start: [x, z], hole: [x, z], parts: [...], pits: [[x, z, r]],
//        posts: [[x, z, r]], sticky: [[x, z, rx, rz]], contour, preview, cup: false (no dip) | { a, s } }
export function buildHole(def, extra = {}) {
  const size = def.size || DEFAULT_SIZE;
  const half = [size[0] / 2, size[1] / 2];
  const dip = def.cup === false ? null : { ...CUP_DIP, ...(def.cup || {}) };
  const parts = def.parts.map((p) => ({ ...p }));
  if (dip) parts.push({ t: 'gauss', c: def.hole, a: dip.a, s: dip.s, after: true });
  let field = makeField(parts);
  // a green is the course's lowest ground: if anything outside it lies lower, it sinks a little deeper
  const green = parts.find((p) => p.t === 'green');
  for (let i = 0; green && i < 4; i++) {
    const g = field.greens[0];
    let low = Infinity;
    const n = 48;
    for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
      const x = -half[0] + PHYS.R + ((2 * (half[0] - PHYS.R)) * k) / n, z = -half[1] + PHYS.R + ((2 * (half[1] - PHYS.R)) * j) / n;
      if (Math.hypot(x - g.cx, z - g.cz) < g.r + g.e) continue;
      low = Math.min(low, field.h(x, z));
    }
    if (low > g.level + 0.08) break;
    green.depth = (green.depth ?? 0.3) + (g.level - low) + 0.14;
    field = makeField(parts);
  }
  // the cup sits exactly at the bottom of its valley
  const m = descend(field, def.hole[0], def.hole[1], { bounds: [half[0] - 0.6, half[1] - 0.6] });
  const hole = {
    ...extra,
    id: def.id, name: def.name, pun: def.pun, par: def.par, size, half, def,
    field,
    cup: [m.x, m.z],
    cupH: m.h,
    start: def.start.slice(),
    pits: (def.pits || []).map(([x, z, r]) => ({ x, z, r })),
    posts: (def.posts || []).map(([x, z, r = 0.38]) => ({ x, z, r })),
    sticky: (def.sticky || []).map(([x, z, rx, rz = rx]) => ({ x, z, rx, rz })),
    contour: def.contour || 0.25,
    preview: def.preview ?? 0.5,
  };
  const r = sampleRange(hole, 64);
  hole.hmin = r.min; hole.hmax = r.max;
  return hole;
}

// the lowest and highest ground on an n × n grid (the colour scale), and where the lowest is
export function sampleRange(hole, n = 64) {
  let min = Infinity, max = -Infinity, mx = 0, mz = 0;
  const [hx, hz] = hole.half;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -hx + (2 * hx * i) / n, z = -hz + (2 * hz * j) / n;
      const h = hole.field.h(x, z);
      if (h < min) { min = h; mx = x; mz = z; }
      if (h > max) max = h;
    }
  }
  return { min, max, at: [mx, mz] };
}

// the lowest point of the playable ground (inside the rails, out of the pits), searched on a grid then polished
export function lowestPoint(hole, n = 160) {
  const [hx, hz] = hole.half;
  const m = PHYS.R;
  let best = Infinity, bx = 0, bz = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -hx + m + ((2 * (hx - m)) * i) / n, z = -hz + m + ((2 * (hz - m)) * j) / n;
      const h = hole.field.h(x, z);
      if (h < best) { best = h; bx = x; bz = z; }
    }
  }
  return { x: bx, z: bz, h: best };
}

// A cheap map of "how hard is it to get from here to the cup": the length of the easiest path, where climbing costs
// extra and pits, posts and sticky patches are avoided (Dijkstra on an n × n grid, from the cup outwards). The demo's
// AI scores where a shot would stop with it.
export function costField(hole, n = 56) {
  const [hx, hz] = hole.half;
  const N = n + 1;
  const cell = [(2 * hx) / n, (2 * hz) / n];
  const H = new Float64Array(N * N), block = new Uint8Array(N * N), slow = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -hx + i * cell[0], z = -hz + j * cell[1], k = j * N + i;
    H[k] = hole.field.h(x, z);
    for (const p of hole.pits) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 0.35) ** 2) block[k] = 1;
    for (const p of hole.posts) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 0.2) ** 2) block[k] = 1;
    for (const s of hole.sticky) if (((x - s.x) / s.rx) ** 2 + ((z - s.z) / s.rz) ** 2 < 1) slow[k] = 1;
  }
  const cost = new Float64Array(N * N).fill(Infinity);
  const ci = Math.round((hole.cup[0] + hx) / cell[0]), cj = Math.round((hole.cup[1] + hz) / cell[1]);
  const start = Math.max(0, Math.min(N - 1, cj)) * N + Math.max(0, Math.min(N - 1, ci));
  cost[start] = 0;
  // a small binary heap of [cost, index]
  const heap = [[0, start]];
  const push = (c, k) => {
    heap.push([c, k]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const UP = 3.2;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [c, k] = pop();
    if (c > cost[k]) continue;
    const i = k % N, j = (k - i) / N;
    for (const [di, dj] of dirs) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = nj * N + ni;
      if (block[nk]) continue;
      const len = Math.hypot(di * cell[0], dj * cell[1]);
      // the ball goes from nk to k: climbing from H[nk] up to H[k] is the hard part
      const climb = Math.max(0, H[k] - H[nk]);
      const nc = c + len * (slow[nk] ? 2.2 : 1) + UP * climb;
      if (nc < cost[nk]) { cost[nk] = nc; push(nc, nk); }
    }
  }
  const at = (x, z) => {
    const fi = Math.max(0, Math.min(n - 1e-9, (x + hx) / cell[0])), fj = Math.max(0, Math.min(n - 1e-9, (z + hz) / cell[1]));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const k = j * N + i;
    const a = cost[k], b = cost[k + 1], c = cost[k + N], d = cost[k + N + 1];
    const fin = (q) => (Number.isFinite(q) ? q : 80);
    return fin(a) * (1 - u) * (1 - v) + fin(b) * u * (1 - v) + fin(c) * (1 - u) * v + fin(d) * u * v;
  };
  return { n, cost, at };
}
