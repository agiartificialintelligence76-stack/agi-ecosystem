// ROBOTAXI RUSH: the endless road. Pure (no DOM).
//
// The road is made of pieces in the classic way: each piece eases a curve in, holds it and eases it out again, while its
// height eases from where the last piece ended to a new height. So the curve is 0 at every piece's start and end, and
// the height never jumps (each segment starts where the one before it ended). Pieces are drawn from a seeded die, a
// little wilder the further the run goes. Only the last RING segments are kept (the road behind the camera is forgotten).
import { rng } from '../kit/fx.js';
import { SEG, MPU, ZONE_SEGS, clamp, difficultyAt } from './config.js';

export const RING = 4096;
const MASK = RING - 1;

export const easeIn = (a, b, p) => a + (b - a) * p * p;
export const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

export const CURVE = Object.freeze({ easy: 1.7, medium: 3.1, hard: 4.4, max: 5.4 });
export const HILL_MAX = 4200;     // the road stays within ± this height
export const SLOPE_MAX = 0.11;    // a piece climbs at most this much on average (its steepest part is π/2 times that)
export const CALM = 90;           // the first segments of a run are straight and flat

// a 32-bit hash of a segment's index (scenery that's the same every time the segment is seen)
export function hash(i, salt = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
export const hash01 = (i, salt) => hash(i, salt) / 4294967296;

export const isGate = (i) => i > 0 && i % ZONE_SEGS === 0;

export function createTrack(seed = 1, { startIndex = 0, calm = CALM } = {}) {
  const r = rng((seed >>> 0) || 1);
  const curve = new Float32Array(RING);
  const yEnd = new Float64Array(RING);
  const first = startIndex - 40;            // a few segments behind the start, for the camera
  let built = first - 1;
  yEnd[built & MASK] = 0;
  const queue = [];
  let cur = null, at = 0, fromY = 0;

  const yNow = () => yEnd[built & MASK];
  function piece(enter, hold, leave, c, dy) { queue.push({ enter, hold, leave, curve: c, dy }); }
  // a climb or a dip that keeps the road within ±HILL_MAX, never steeper than SLOPE_MAX on average
  function hillTo(total, amount, y = queuedY()) {
    const room = SLOPE_MAX * total * SEG;
    let target = y + clamp(amount, -room, room);
    target = clamp(target, -HILL_MAX, HILL_MAX);
    return target - y;
  }
  function queuedY() {
    let y = cur ? fromY + cur.dy : yNow();
    for (const p of queue) y += p.dy;
    return y;
  }

  // the next few pieces, by how hard the road is at segment i
  function plan(i) {
    if (i < startIndex + calm) { piece(0, Math.max(1, startIndex + calm - i), 0, 0, 0); return; }
    const d = difficultyAt(i * SEG * MPU);
    const L = () => r.pick(d < 0.3 ? [40, 50, 60, 75] : [25, 40, 50, 60, 75]);
    const mag = () => {
      const roll = r.next();
      const hard = 0.08 + 0.42 * d, medium = 0.35 + 0.15 * d;
      const base = roll < hard ? CURVE.hard : roll < hard + medium ? CURVE.medium : CURVE.easy;
      return Math.min(CURVE.max, base * r.range(0.85, 1.18));
    };
    const kinds = [
      { k: 'straight', weight: 2.2 - 1.2 * d },
      { k: 'curve', weight: 3 },
      { k: 's', weight: 0.6 + 1.6 * d },
      { k: 'hill', weight: 1.4 },
      { k: 'curvehill', weight: 0.8 + 1.4 * d },
      { k: 'rolling', weight: 0.6 + 0.6 * d },
    ];
    const kind = r.weighted(kinds).k;
    const sign = r.sign();
    switch (kind) {
      case 'straight': {
        const n = Math.round(r.range(40, 130) * (1 - 0.45 * d));
        piece(0, n, 0, 0, r.chance(0.35) ? hillTo(n, r.range(-1, 1) * 900) : 0);
        break;
      }
      case 'curve': {
        const e = L(), h = L(), l = L();
        piece(e, h, l, sign * mag(), 0);
        break;
      }
      case 's': {
        const e = L(), h = Math.round(L() * 0.7), l = L();
        piece(e, h, l, sign * mag(), 0);
        piece(e, h, l, -sign * mag(), 0);
        break;
      }
      case 'hill': {
        const e = L(), h = L(), l = L(), n = e + h + l;
        piece(e, h, l, r.chance(0.4) ? sign * CURVE.easy * r.range(0.6, 1) : 0, hillTo(n, r.sign() * r.range(1600, 3800)));
        break;
      }
      case 'curvehill': {
        const e = L(), h = L(), l = L(), n = e + h + l;
        piece(e, h, l, sign * mag(), hillTo(n, r.sign() * r.range(1200, 3200)));
        break;
      }
      case 'rolling': {
        const bumps = r.int(3, 5);
        for (let b = 0; b < bumps; b++) {
          const n = 25 + r.int(0, 12);
          const h = Math.max(1, n - 2 * 10);
          piece(10, h, 10, r.chance(0.5) ? r.sign() * CURVE.easy * 0.6 : 0, hillTo(n, (b % 2 ? -1 : 1) * r.range(500, 1100)));
        }
        break;
      }
      default: piece(0, 50, 0, 0, 0);
    }
  }

  function addOne() {
    if (!cur) {
      if (!queue.length) plan(built + 1);
      cur = queue.shift();
      at = 0;
      fromY = yNow();
    }
    const i = built + 1;
    const { enter, hold, leave } = cur;
    const total = enter + hold + leave;
    let c;
    if (at < enter) c = easeIn(0, cur.curve, at / enter);
    else if (at < enter + hold) c = cur.curve;
    else c = easeInOut(cur.curve, 0, (at - enter - hold + 1) / leave);
    curve[i & MASK] = c;
    yEnd[i & MASK] = easeInOut(fromY, fromY + cur.dy, (at + 1) / total);
    built = i;
    if (++at >= total) cur = null;
  }

  const api = {
    seed, startIndex, first,
    get built() { return built; },
    // make sure every segment up to index i exists
    ensure(i) { while (built < i) addOne(); },
    curve(i) { return curve[i & MASK]; },
    // the road's height at a segment's near edge (y1) and far edge (y2)
    y1(i) { return yEnd[(i - 1) & MASK]; },
    y2(i) { return yEnd[i & MASK]; },
    // the road's height at a world z (between its segment's two edges)
    yAt(z) {
      const i = Math.floor(z / SEG), p = z / SEG - i;
      const a = yEnd[(i - 1) & MASK], b = yEnd[i & MASK];
      return a + (b - a) * p;
    },
    // the road's bend at a world z (the curve of its segment)
    curveAt(z) { return curve[Math.floor(z / SEG) & MASK]; },
    // how much the road bends over the next n segments from index i (for the AI: is it straight?)
    bendAhead(i, n) { let s = 0; for (let k = 0; k < n; k++) s += Math.abs(curve[(i + k) & MASK]); return s / n; },
    isGate,
  };
  api.ensure(startIndex + 260);
  return api;
}
