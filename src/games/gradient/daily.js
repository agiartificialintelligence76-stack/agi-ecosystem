// GRADIENT DESCENT (2026-11-08): the daily hole. One new landscape a day, the same for everyone on that date (seeded by
// the player's local date): a broad valley around the cup, a few hills, a decoy dip or two, sometimes ripples, a ridge,
// posts, a sticky patch or a NaN pit. A candidate is kept only if the cup is clearly the lowest point (every other dip
// sits higher), the start is clear of hazards, no pit sits on the way, and the cup is far enough to be a real hole.
// Pure: no DOM.
import { rng } from '../kit/fx.js';
import { buildHole, lowestPoint } from './course.js';
import { PHYS } from './physics.js';

export const DAILY_NAMES = ['Fresh Init', 'Random Restart', 'Daily Batch', 'New Epoch', 'Morning Warmup', 'Seed of the Day',
  'Today’s Loss', 'Fresh Weights', 'The Daily Draw', 'Unseen Data'];
export const DAILY_PUNS = ['A new landscape. Same old gravity.', 'Never seen it before. Neither has anyone.',
  'Today’s minimum is out there somewhere.', 'Fresh weights, fresh hopes.', 'Same seed for everyone today.'];

// 'YYYY-MM-DD' in the player's own time zone
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function seedOf(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const SIZES = [[18, 18], [20, 16], [16, 20], [20, 20], [18, 20]];

function candidate(r) {
  const size = r.pick(SIZES);
  const hx = size[0] / 2, hz = size[1] / 2;
  // the start near one corner, the cup across the course
  const sx = r.sign(), sz = r.sign();
  const start = [sx * r.range(hx * 0.62, hx * 0.8), sz * r.range(hz * 0.55, hz * 0.8)];
  const cup = [-sx * r.range(hx * 0.4, hx * 0.72), -sz * r.range(hz * 0.3, hz * 0.7)];
  const far = (p, q, d) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= d;
  const spot = (minCup, minStart, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      const p = [r.range(-hx + 1.2, hx - 1.2), r.range(-hz + 1.2, hz - 1.2)];
      if (far(p, cup, minCup) && far(p, start, minStart)) return p;
    }
    return null;
  };
  const parts = [
    { t: 'bowl', c: [cup[0] * 0.8, cup[1] * 0.8], a: r.range(0.012, 0.022), b: r.range(0.012, 0.022), rot: r.range(0, 180) },
    { t: 'gauss', c: cup.slice(), a: -r.range(1.2, 2.0), s: r.range(1.9, 2.8) },
  ];
  for (let i = 0, n = r.int(3, 5); i < n; i++) {
    const p = spot(3.4, 2.2); if (p) parts.push({ t: 'gauss', c: p, a: r.range(0.5, 1.5), s: [r.range(1.1, 2.4), r.range(1.1, 2.4)], rot: r.range(0, 180) });
  }
  for (let i = 0, n = r.int(1, 2); i < n; i++) {
    const p = spot(5.5, 3); if (p) parts.push({ t: 'gauss', c: p, a: -r.range(0.45, 0.9), s: r.range(1.2, 1.9) });
  }
  if (r.chance(0.4)) parts.push({ t: 'ripple', c: [0, 0], rot: r.range(0, 180), a: r.range(0.07, 0.16), f: [r.range(1.4, 2.4), r.range(1.0, 2.2)], ph: [r.range(0, 6), r.range(0, 6)], s: 0 });
  if (r.chance(0.45)) {
    const p = spot(4, 4);
    if (p) { const a = r.range(0, Math.PI), l = r.range(2.5, 5); parts.push({ t: 'ridge', p: [p[0] - Math.cos(a) * l, p[1] - Math.sin(a) * l], q: [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l], a: r.range(0.7, 1.3), s: r.range(0.8, 1.2) }); }
  }
  const posts = [], pits = [], sticky = [];
  for (let i = 0, n = r.int(0, 3); i < n; i++) { const p = spot(2.6, 2.4); if (p) posts.push([p[0], p[1], r.range(0.32, 0.45)]); }
  for (let i = 0, n = r.int(0, 2); i < n; i++) { const p = spot(3.6, 3.2); if (p) pits.push([p[0], p[1], r.range(0.6, 0.8)]); }
  if (r.chance(0.5)) { const p = spot(3, 3); if (p) sticky.push([p[0], p[1], r.range(1.0, 1.8), r.range(0.8, 1.4)]); }
  return { size, start, hole: cup, parts, posts, pits, sticky };
}

// the other dips: grid points lower than all their neighbours, apart from the cup's own valley
function decoys(hole, n = 48) {
  const [hx, hz] = hole.half, N = n + 1;
  const H = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = hole.field.h(-hx + (2 * hx * i) / n, -hz + (2 * hz * j) / n);
  const out = [];
  for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
    const k = j * N + i, h = H[k];
    if (h < H[k - 1] && h < H[k + 1] && h < H[k - N] && h < H[k + N] && h < H[k - N - 1] && h < H[k - N + 1] && h < H[k + N - 1] && h < H[k + N + 1]) {
      const x = -hx + (2 * hx * i) / n, z = -hz + (2 * hz * j) / n;
      if (Math.hypot(x - hole.cup[0], z - hole.cup[1]) > 1.5) out.push({ x, z, h });
    }
  }
  return out;
}

function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

export function validDaily(hole) {
  const low = lowestPoint(hole, 120);
  if (Math.hypot(low.x - hole.cup[0], low.z - hole.cup[1]) > 0.35) return false;
  for (const d of decoys(hole)) if (d.h < hole.cupH + 0.35) return false;
  if (Math.hypot(hole.start[0] - hole.cup[0], hole.start[1] - hole.cup[1]) < 9) return false;
  for (const p of hole.pits) {
    if (Math.hypot(p.x - hole.start[0], p.z - hole.start[1]) < p.r + 1.5) return false;
    if (Math.hypot(p.x - hole.cup[0], p.z - hole.cup[1]) < p.r + 2.2) return false;
    if (distToSegment([p.x, p.z], hole.start, hole.cup) < p.r + 0.9) return false;
  }
  for (const p of hole.posts) if (Math.hypot(p.x - hole.start[0], p.z - hole.start[1]) < p.r + PHYS.R + 0.8) return false;
  const [hx, hz] = hole.half;
  if (Math.abs(hole.cup[0]) > hx - 1.2 || Math.abs(hole.cup[1]) > hz - 1.2) return false;
  return true;
}

// the day's hole definition (buildHole() makes it playable)
export function dailyDef(key = dateKey()) {
  const seed = seedOf(key);
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng((seed + attempt * 0x9e3779b1) >>> 0);
    const c = candidate(r);
    const hazards = c.pits.length + c.posts.length + c.sticky.length;
    const dist = Math.hypot(c.start[0] - c.hole[0], c.start[1] - c.hole[1]);
    const def = {
      id: 'daily', course: 0, index: 0, key, attempt,
      name: DAILY_NAMES[seed % DAILY_NAMES.length], pun: DAILY_PUNS[(seed >>> 8) % DAILY_PUNS.length],
      par: hazards >= 3 || dist > 15 ? 4 : 3, preview: 0.4, ...c,
    };
    if (validDaily(buildHole(def))) return def;
  }
  // (never reached in practice: a plain bowl, always fine)
  return { id: 'daily', course: 0, index: 0, key, attempt: -1, name: DAILY_NAMES[0], pun: DAILY_PUNS[0], par: 3, preview: 0.4,
    size: [18, 18], start: [-6.5, -6], hole: [5, 4.6], parts: [{ t: 'bowl', c: [4, 3.6], a: 0.025, b: 0.025 }], posts: [], pits: [], sticky: [] };
}
