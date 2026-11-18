export const vectors = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const beltDir = { '^': 'N', '>': 'E', v: 'S', '<': 'W' };
export const ids = ['N', 'E', 'S', 'W', 'X'];
export const cell = (x, y) => x + ',' + y;
export function footprint(p) {
  if (p.parts) return p.parts;
  if (p.o === 'x')
    return [
      [p.x, p.y],
      [p.x + 1, p.y],
    ];
  if (p.o === 'y')
    return [
      [p.x, p.y],
      [p.x, p.y + 1],
    ];
  return [[p.x, p.y]];
}
export function tip(p, dir) {
  const [dx, dy] = vectors[dir],
    q = { ...p };
  if (p.parts) {
    q.parts = p.parts.map(([x, y], i) => (i === p.active ? [x + dx, y + dy] : [x, y]));
    return q;
  }
  if (p.o === 'up') {
    q.o = dx ? 'x' : 'y';
    q.x += dx < 0 ? -2 : dx;
    q.y += dy < 0 ? -2 : dy;
  } else if ((p.o === 'x' && dx) || (p.o === 'y' && dy)) {
    q.o = 'up';
    q.x += dx > 0 ? 2 : dx;
    q.y += dy > 0 ? 2 : dy;
  } else {
    q.x += dx;
    q.y += dy;
  }
  return q;
}
export function slide(p, dx, dy) {
  if (p.parts) return { ...p, parts: p.parts.map(([x, y], i) => (i === p.active ? [x + dx, y + dy] : [x, y])) };
  return { ...p, x: p.x + dx, y: p.y + dy };
}
export function anchor(p) {
  return p.parts ? p.parts[p.active] : [p.x, p.y];
}
export function start(depot) {
  return { ...depot.start, broken: 0, post: 0, parts: null, active: 0 };
}
export function code(p) {
  return p.parts
    ? ['h', ...p.parts.flat(), p.active, p.broken, p.post].join('/')
    : [p.x, p.y, p.o, p.broken, p.post].join('/');
}
export const delivered = (d, p) => !p.parts && p.o === 'up' && cell(p.x, p.y) === d.goal && p.post === d.required;
const lookup = new WeakMap();
export function materials(d) {
  if (lookup.has(d)) return lookup.get(d);
  const glass = new Map(),
    post = new Map(),
    warp = new Map(),
    split = new Map(),
    seams = new Set();
  for (let y = 0; y < d.rows.length; y++)
    for (let x = 0; x < d.rows[y].length; x++) {
      const tile = d.rows[y][x],
        id = cell(x, y);
      if (tile === '~') glass.set(id, 1 << glass.size);
      if (tile === '+') post.set(id, 1 << post.size);
    }
  for (const [a, b] of d.chutes || []) {
    warp.set(a.join(), b);
    warp.set(b.join(), a);
  }
  for (const [at, a, b] of d.stamps || []) split.set(at.join(), [a, b]);
  for (const [a, b] of d.seams || []) seams.add([a.join(), b.join()].sort().join(';'));
  const result = { glass, post, warp, split, seams };
  lookup.set(d, result);
  return result;
}
function landing(d, mat, old, q, events) {
  const from = footprint(old).map((pt) => pt.join()),
    onto = footprint(q).map((pt) => pt.join());
  if (q.parts && onto[0] === onto[1]) return 'occupied';
  for (const id of from) {
    const pane = mat.glass.get(id);
    if (pane && !onto.includes(id)) {
      q.broken |= pane;
      events.add('break');
    }
  }
  for (const [i, [x, y]] of footprint(q).entries()) {
    const tile = d.rows[y]?.[x],
      pane = mat.glass.get(onto[i]);
    if (!tile || tile === '.' || (pane && q.broken & pane)) return 'edge';
    if (pane && q.o === 'up' && !q.parts) return 'upright glass';
    if (pane) events.add('glass');
    if (mat.post.has(onto[i])) {
      q.post |= mat.post.get(onto[i]);
      if (q.post !== old.post) events.add('post');
    }
  }
  return '';
}
export function transition(d, p, input, trace = false) {
  if (input === 'X')
    return p.parts ? { state: { ...p, active: 1 - p.active }, events: ['switch'] } : { fault: 'whole parcel' };
  if (!vectors[input]) return { fault: 'unknown roll' };
  const mat = materials(d),
    events = new Set(),
    path = [];
  let old = p,
    q = tip(p, input),
    skipWarp = null;
  const seen = new Set();
  for (let count = 0; count < 64; count++) {
    const fault = landing(d, mat, old, q, events);
    if (fault) return { fault };
    if (trace) path.push({ ...q });
    const key = code(q) + '/' + skipWarp;
    if (seen.has(key)) return { fault: 'sorting loop' };
    seen.add(key);
    const [x, y] = anchor(q),
      id = cell(x, y),
      tile = d.rows[y][x];
    const spawn = mat.split.get(id);
    if (!q.parts && q.o === 'up' && spawn) {
      events.add('split');
      old = q;
      q = { ...q, parts: spawn.map((pt) => [...pt]), active: 0 };
      skipWarp = null;
      continue;
    }
    if (
      q.parts &&
      mat.seams.has(
        q.parts
          .map((pt) => pt.join())
          .sort()
          .join(';')
      )
    ) {
      const [[x1, y1], [x2, y2]] = q.parts;
      events.add('seam');
      old = q;
      q = { ...q, x: Math.min(x1, x2), y: Math.min(y1, y2), o: x1 === x2 ? 'y' : 'x', parts: null, active: 0 };
      skipWarp = null;
      continue;
    }
    const dest = mat.warp.get(id);
    if (dest && skipWarp !== id) {
      events.add('chute');
      old = q;
      q = slide(q, dest[0] - x, dest[1] - y);
      skipWarp = dest.join();
      continue;
    }
    const belt = beltDir[tile];
    if (belt) {
      events.add('belt');
      old = q;
      q = slide(q, ...vectors[belt]);
      skipWarp = null;
      continue;
    }
    return { state: q, events: [...events], path };
  }
  return { fault: 'sorting loop' };
}
