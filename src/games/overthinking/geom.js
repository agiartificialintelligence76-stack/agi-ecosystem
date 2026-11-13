// OVERTHINKING: the geometry of a ribbon of light. Where two strokes cross, what a loop holds, how big it is.
// Pure (no DOM, no dice): tests/overthinking.test.js runs it in Node.

// where segment a→b crosses segment c→d: { x, y, t (along a→b), u (along c→d) }, or null (apart, or parallel)
export function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rx * t, y: ay + ry * t, t, u };
}

// is the point inside the loop? (even-odd: a loop that crosses itself still gives an answer)
export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// the loop's area, signed (shoelace): positive one way round, negative the other
export function polyArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  return a / 2;
}

// its middle: the centroid of its area (the mean of its points when it has no area to speak of)
export function polyCentroid(pts) {
  const a = polyArea(pts);
  if (Math.abs(a) < 1e-9) {
    let x = 0, y = 0;
    for (const p of pts) { x += p.x; y += p.y; }
    const n = Math.max(1, pts.length);
    return { x: x / n, y: y / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    cx += (pts[j].x + pts[i].x) * f;
    cy += (pts[j].y + pts[i].y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

// the nearest point of segment a→b to p: its squared distance, where it is, and how far along (0..1)
export function nearOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t, y = ay + dy * t;
  return { d2: (px - x) * (px - x) + (py - y) * (py - y), x, y, t };
}

export function pathLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
