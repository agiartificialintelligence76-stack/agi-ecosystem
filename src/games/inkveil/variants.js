import { rooms, indexRoom } from './rooms.js';
import { xy, dirs, vec, walkable, dist } from './geometry.js';
// Matinee contracts alter the actual entrance, exit, camera phase and orientation.
// The guard and the glass do move with their room. Path ties still use global
// compass directions, so every altered room is certified through the reducer.
export function rebuild(spec) {
  const base = rooms[spec.id - 1],
    w = base.w,
    h = base.h,
    rotation = spec.layout & 3,
    reflect = !!(spec.layout & 4);
  function place(x, y) {
    if (reflect) x = w - 1 - x;
    return rotation === 0
      ? [x, y]
      : rotation === 1
        ? [h - 1 - y, x]
        : rotation === 2
          ? [w - 1 - x, h - 1 - y]
          : [y, w - 1 - x];
  }
  function orient(dir) {
    const [ox, oy] = place(0, 0),
      [xx, yy] = place(...vec[dir]);
    return vec.findIndex(([dx, dy]) => dx === xx - ox && dy === yy - oy);
  }
  const ww = rotation % 2 ? h : w,
    hh = rotation % 2 ? w : h;
  const rows = Array.from({ length: hh }, () => Array(ww).fill(' '));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let ch = base.tiles[y * w + x];
      if (ch === 'S' || ch === 'E') ch = '.';
      if (y * w + x === spec.entry) ch = 'S';
      if (y * w + x === spec.exit) ch = 'E';
      const [xx, yy] = place(x, y);
      rows[yy][xx] = ch;
    }
  const patrol = base.patrol.replace(/[NESWnesw]/g, (c) => {
    const transformed = dirs[orient(dirs.indexOf(c.toUpperCase()))];
    return c === c.toLowerCase() ? transformed.toLowerCase() : transformed;
  });
  const pattern = base.cameras[0]?.pattern.map((n) => (n < 0 ? -1 : orient(n)));
  return indexRoom({
    ...base,
    rows: rows.map((row) => row.join('')),
    patrol,
    pattern,
    offset: spec.lamp || 0,
    phase: 0,
  });
}
export function alterations(base, dice) {
  const spots = [];
  for (let p = 0; p < base.tiles.length; p++)
    if (walkable(base, p, false) && ['.', 'c', 'm', 't', 'S', 'E'].includes(base.tiles[p])) spots.push(p);
  const entry = spots.filter((p) => dist(base, p, base.start) <= 2 && p !== base.exit && p !== base.fragment);
  const exit = spots.filter((p) => dist(base, p, base.exit) <= 2 && p !== base.start && p !== base.fragment);
  const choose = (a) => a[Math.floor(dice() * a.length)];
  return {
    id: base.id,
    layout: Math.floor(dice() * 8),
    lamp: Math.floor(dice() * 4),
    entry: choose(entry),
    exit: choose(exit),
  };
}
