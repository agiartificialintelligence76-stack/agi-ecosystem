// SCAM SLAYER: the geometry of a slice (pure, no DOM).

// Does the blade's segment A→B cross the circle (C, r)? The blade moves between two samples of the pointer, so a fast
// swipe that jumps over a sticker between frames still cuts it: the whole segment is tested, not its ends.
// → null, or { t: where along A→B the closest point is (0..1), d: the centre's signed distance to the blade's line
//   (positive on the left of the direction of travel, screen coordinates) }
export function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((cx - ax) * dx + (cy - ay) * dy) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const ex = cx - (ax + dx * t), ey = cy - (ay + dy * t);
  if (ex * ex + ey * ey > r * r) return null;
  const len = Math.sqrt(len2);
  const d = len > 1e-9 ? ((cy - ay) * dx - (cx - ax) * dy) / len : Math.hypot(cx - ax, cy - ay);
  return { t, d };
}

// The shortest distance from the point P to the segment A→B
export function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Where something thrown from (x0, y0) with (vx, vy) under gravity g is after `t` seconds
export function arcAt(o, t) {
  return { x: o.x0 + o.vx * t, y: o.y0 + o.vy * t + 0.5 * o.g * t * t };
}

// The throw that peaks at (xPeak, yPeak) from (x0, y0) under gravity g (y grows downward, so the peak is above):
// → { vx, vy, tPeak }
export function throwTo(x0, y0, xPeak, yPeak, g) {
  const rise = Math.max(1, y0 - yPeak);
  const vy = -Math.sqrt(2 * g * rise);
  const tPeak = -vy / g;
  return { vx: (xPeak - x0) / tPeak, vy, tPeak };
}

// The peak of a throw (where vy reaches 0)
export function peakOf(o) {
  const tPeak = o.vy < 0 ? -o.vy / o.g : 0;
  return { t: tPeak, ...arcAt(o, tPeak) };
}

// The closest two throws come to each other in a time window (in seconds after the volley starts). Each throw has its
// own start `at`; before that it isn't in the air, so only times when both are flying count.
export function closestApproach(a, b, from, to, steps = 24) {
  const t0 = Math.max(from, a.at, b.at);
  if (to <= t0) return Infinity;
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((to - t0) * i) / steps;
    const pa = arcAt(a, t - a.at), pb = arcAt(b, t - b.at);
    const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    if (d < best) best = d;
  }
  return best;
}
