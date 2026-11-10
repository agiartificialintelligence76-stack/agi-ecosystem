// BUBBLE SORT: a shot's path, pure. The guide the player sees and the shot that flies are this one function, so they
// always agree: from the launcher, straight, mirrored off the side walls, until the bubble's centre comes within CONTACT
// of a bubble (or reaches the ceiling's row); then it snaps to the nearest free cell next to what it touched.
import { W, CONTACT, LAUNCHER, ROWS } from './grid.js';

export const MIN_ANGLE = (10 * Math.PI) / 180;
export const MAX_ANGLE = (170 * Math.PI) / 180;
export const clampAngle = (a) => (a < MIN_ANGLE ? MIN_ANGLE : a > MAX_ANGLE ? MAX_ANGLE : a);
const C2 = CONTACT * CONTACT;
const LEFT = 1, RIGHT = W - 1;          // where a bubble's centre meets a wall
const EPS = 1e-9;

// → { points: [{x, y}] (the launcher, each bounce, where it touched), end: {x, y}, hit: {r, c} | null (the ceiling),
//     cell: {r, c}, bounces, length }
export function trace(board, angle, from = LAUNCHER) {
  const a = clampAngle(angle);
  let x = from.x, y = from.y, dx = Math.cos(a), dy = -Math.sin(a);
  const points = [{ x, y }];
  const ceil = board.y(board.top);
  let length = 0, bounces = 0;
  for (let seg = 0; seg < 40; seg++) {
    const tWall = dx > EPS ? (RIGHT - x) / dx : dx < -EPS ? (LEFT - x) / dx : Infinity;
    const tCeil = (y - ceil) / -dy;
    let tHit = Infinity, hr = -1, hc = -1;
    for (let r = board.top; r < ROWS; r++) {
      const row = board.rows[r], w = board.width(r), by = board.y(r) - y;
      // a row too far from this segment's band can't be touched (a cheap skip)
      if (by > CONTACT + EPS) continue;
      for (let c = 0; c < w; c++) {
        if (!row[c]) continue;
        const qx = board.x(r, c) - x, qy = by;
        const b = qx * dx + qy * dy;
        if (b <= -CONTACT) continue;
        const d2 = qx * qx + qy * qy - b * b;
        if (d2 >= C2) continue;
        const s = Math.sqrt(C2 - d2);
        if (b + s < 0) continue;                 // its whole contact circle is behind
        const t = b - s < 0 ? 0 : b - s;          // (already touching: right here)
        if (t < tHit - EPS || (Math.abs(t - tHit) <= EPS && (r > hr || (r === hr && c < hc)))) { tHit = t; hr = r; hc = c; }
      }
    }
    if (tHit <= tWall + EPS && tHit <= tCeil + EPS) {
      x += dx * tHit; y += dy * tHit; length += tHit;
      points.push({ x, y });
      const cell = snap(board, x, y, { r: hr, c: hc });
      return { points, end: { x, y }, hit: { r: hr, c: hc }, cell, bounces, length };
    }
    if (tCeil <= tWall + EPS) {
      x += dx * tCeil; y = ceil; length += tCeil;
      points.push({ x, y });
      return { points, end: { x, y }, hit: null, cell: snap(board, x, y, null), bounces, length };
    }
    x += dx * tWall; y += dy * tWall; length += tWall;
    x = dx > 0 ? RIGHT : LEFT;
    dx = -dx; bounces++;
    points.push({ x, y });
  }
  // (never: at the shallowest angle a shot reaches the top in about nine bounces)
  return { points, end: { x, y }, hit: null, cell: snap(board, x, y, null), bounces, length };
}

// the free cell nearest to where the shot touched: next to the bubble it hit, or in the ceiling's row
const scratch = [];
export function snap(board, x, y, hit) {
  let best = null, bd = Infinity;
  const consider = (r, c) => {
    if (r < board.top || !board.has(r, c) || board.rows[r][c]) return;
    const ex = board.x(r, c) - x, ey = board.y(r) - y, d = ex * ex + ey * ey;
    if (d < bd - EPS) { bd = d; best = { r, c }; }
  };
  if (!hit) for (let c = 0; c < board.width(board.top); c++) consider(board.top, c);
  else {
    const nb = board.neighbours(hit.r, hit.c, scratch);
    for (let i = 0; i < nb.length; i += 2) consider(nb[i], nb[i + 1]);
  }
  if (best) return best;
  // (a safety net the tests never reach: any free cell touching something, or in the top row)
  for (let r = board.top; r < ROWS; r++) {
    for (let c = 0; c < board.width(r); c++) {
      if (board.rows[r][c]) continue;
      const nb = board.neighbours(r, c, []);
      let touching = r === board.top;
      for (let i = 0; i < nb.length && !touching; i += 2) touching = Boolean(board.rows[nb[i]][nb[i + 1]]);
      if (touching) consider(r, c);
    }
  }
  return best || { r: board.top, c: 0 };
}
