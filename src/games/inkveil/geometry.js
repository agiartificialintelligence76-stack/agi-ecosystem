export const vec = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const dirs = 'NESW';
export const TAPES = [
  { name: 'Button click', reach: 4, life: 2, ink: '#63e3d0' },
  { name: 'Dropped keys', reach: 7, life: 3, ink: '#ffd375' },
];
export const cell = (r, x, y) => y * r.w + x;
export const xy = (r, p) => [p % r.w, Math.floor(p / r.w)];
export const dist = (r, a, b) =>
  Math.abs((a % r.w) - (b % r.w)) + Math.abs(Math.floor(a / r.w) - Math.floor(b / r.w));
export function neighbor(r, p, d) {
  const [x, y] = xy(r, p),
    [dx, dy] = vec[d];
  return x + dx < 0 || x + dx >= r.w || y + dy < 0 || y + dy >= r.h ? -1 : cell(r, x + dx, y + dy);
}
export function walkable(r, p, key = true) {
  if (p < 0 || p >= r.w * r.h) return false;
  const t = r.tiles[p];
  return !['#', '|', 'C', ' '].includes(t) && (t !== '+' || key);
}
function opacity(r, p, key) {
  return p < 0 || ['#', ' ', 'C'].includes(r.tiles[p]) || (r.tiles[p] === '+' && !key);
}
// Trace center-to-center. At a diagonal corner the ray touches the two
// side cells as well. Either opaque side occludes that exact corner.
export function lineOfSight(r, a, b, key = true) {
  if (a === b) return true;
  let [x, y] = xy(r, a);
  const [bx, by] = xy(r, b),
    dx = bx - x,
    dy = by - y,
    sx = Math.sign(dx),
    sy = Math.sign(dy),
    nx = Math.abs(dx),
    ny = Math.abs(dy);
  let ix = 0,
    iy = 0;
  while (ix < nx || iy < ny) {
    const hx = (1 + 2 * ix) * ny,
      hy = (1 + 2 * iy) * nx;
    if (hx === hy) {
      if (opacity(r, cell(r, x + sx, y), key) || opacity(r, cell(r, x, y + sy), key)) return false;
      x += sx;
      y += sy;
      ix++;
      iy++;
    } else if (hx < hy) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    if ((x !== bx || y !== by) && opacity(r, cell(r, x, y), key)) return false;
  }
  return true;
}
const cache = new WeakMap();
function tables(r) {
  if (!cache.has(r)) cache.set(r, { view: new Map(), paths: new Map(), hearing: new Map(), targets: new Map() });
  return cache.get(r);
}
export function cone(r, p, f, key, range = 4) {
  if (f < 0) return new Set();
  const memo = tables(r).view,
    id = [p, f, Number(key), range].join();
  if (memo.has(id)) return memo.get(id);
  const [x, y] = xy(r, p),
    [vx, vy] = vec[f],
    result = new Set();
  for (let yy = Math.max(0, y - range); yy <= Math.min(r.h - 1, y + range); yy++)
    for (let xx = Math.max(0, x - range); xx <= Math.min(r.w - 1, x + range); xx++) {
      const to = cell(r, xx, yy),
        dx = xx - x,
        dy = yy - y,
        front = dx * vx + dy * vy,
        side = Math.abs(dx * vy - dy * vx);
      if (front <= 0 || side > front * 0.78 || dx * dx + dy * dy > range * range || !walkable(r, to, key))
        continue;
      if (lineOfSight(r, p, to, key)) result.add(to);
    }
  memo.set(id, result);
  return result;
}
export function distances(r, from, key = true, acoustic = false) {
  const memo = tables(r)[acoustic ? 'hearing' : 'paths'],
    id = from * 2 + Number(key);
  if (memo.has(id)) return memo.get(id);
  const values = new Int16Array(r.tiles.length).fill(32767);
  values[from] = 0;
  // Carpet takes three audio units on either side of a boundary. Walking is
  // unweighted. The small queue reopens a square if a quieter detour improves it.
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (let d = 0; d < 4; d++) {
      const q = neighbor(r, p, d);
      if (!walkable(r, q, key)) continue;
      const cost = acoustic && (r.tiles[p] === 'c' || r.tiles[q] === 'c') ? 3 : 1;
      if (values[q] > values[p] + cost) {
        values[q] = values[p] + cost;
        queue.push(q);
      }
    }
  }
  memo.set(id, values);
  return values;
}
export function hearing(r, p, key, at) {
  return distances(r, at, key, true)[p];
}
export function face(r, from, to, prior = 0) {
  const [x, y] = xy(r, from),
    [tx, ty] = xy(r, to),
    dx = tx - x,
    dy = ty - y;
  if (!dx && !dy) return prior;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
export function approach(r, from, to, key) {
  if (from === to) return from;
  const field = distances(r, to, key);
  let next = from,
    best = field[from];
  for (let f = 0; f < 4; f++) {
    const p = neighbor(r, from, f);
    if (!walkable(r, p, key)) continue;
    if (field[p] < best) {
      best = field[p];
      next = p;
    }
  }
  return next;
}
export function throwSpots(r, from, key) {
  const memo = tables(r).targets,
    id = from * 2 + Number(key);
  if (memo.has(id)) return memo.get(id);
  const spots = [];
  for (let f = 0; f < 4; f++) {
    let q = from;
    for (let n = 0; n < 3; n++) {
      q = neighbor(r, q, f);
      if (!walkable(r, q, key)) break;
      spots.push(q);
    }
  }
  memo.set(id, spots);
  return spots;
}
