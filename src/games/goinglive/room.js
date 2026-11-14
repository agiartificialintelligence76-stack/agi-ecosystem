// GOING LIVE: her room's grid, pure (no page): where things can go and what's in the way. The floor is `cols` × `rows`
// cells (row 0 against the back wall), the wall `cols` × `wall` cells (row 0 at the top). A thing on the floor takes
// w × h cells; a rug ('flat') lies under things; a thing for the wall takes w × h wall cells; a small thing ('top')
// stands on a surface (a desk, a table, a shelf) in w of its columns. Moving to a bigger home keeps every thing where it
// was (the grid only grows). Her path across the floor goes round the things standing on it.
import { itemOf, homeOf } from './data.js';

// the room she starts with (her bedroom)
export const STARTER = Object.freeze([
  { id: 'window', x: 1, y: 0 },
  { id: 'desk', x: 3, y: 0 },
  { id: 'laptop', x: 4, onIndex: 1 },
  { id: 'stool', x: 4, y: 1 },
  { id: 'bed', x: 6, y: 0 },
]);
export function starterItems() {
  const out = [];
  STARTER.forEach((s, i) => {
    const it = { uid: i + 1, id: s.id, x: s.x, y: s.y ?? 0, flip: false };
    if (s.onIndex != null) { it.on = out[s.onIndex].uid; it.y = out[s.onIndex].y; }
    out.push(it);
  });
  return out;
}

const layerOf = (def) => (def.place === 'wall' ? 'wall' : def.place === 'top' ? 'top' : def.place === 'flat' ? 'flat' : 'floor');
export const layer = (it) => layerOf(itemOf(it.id));
const overlaps = (a, aw, ah, b) => {
  const d = itemOf(b.id);
  return a.x < b.x + d.w && b.x < a.x + aw && a.y < b.y + d.h && b.y < a.y + ah;
};

// the surface (a floor thing with `surface`) under columns x … x + w − 1, if one holds them all
export function surfaceFor(c, x, w, { ignore = null, near = null } = {}) {
  const list = c.items.filter((s) => s.uid !== ignore && itemOf(s.id).surface && layer(s) === 'floor' && x >= s.x && x + w <= s.x + itemOf(s.id).w);
  if (!list.length) return null;
  if (near != null) list.sort((a, b) => Math.abs(a.y - near) - Math.abs(b.y - near));
  return list[0];
}

// Can `id` go at x, y? (`on`: the surface for a small thing; `ignore`: the thing being moved.) → { ok, why, on }
export function canPlace(c, id, x, y, { on = null, ignore = null } = {}) {
  const def = itemOf(id), home = homeOf(c);
  if (!def) return { ok: false, why: 'unknown' };
  const L = layerOf(def);
  if (!Number.isInteger(x) || (L !== 'top' && !Number.isInteger(y))) return { ok: false, why: 'grid' };
  if (L === 'top') {
    const s = on != null ? c.items.find((t) => t.uid === on) : surfaceFor(c, x, def.w, { ignore, near: y });
    if (!s || s.uid === ignore || !itemOf(s.id).surface || x < s.x || x + def.w > s.x + itemOf(s.id).w) return { ok: false, why: 'surface' };
    const busy = c.items.some((t) => t.uid !== ignore && t.on === s.uid && x < t.x + itemOf(t.id).w && t.x < x + def.w);
    return busy ? { ok: false, why: 'taken' } : { ok: true, on: s.uid };
  }
  const rows = L === 'wall' ? home.wall : home.rows;
  if (x < 0 || y < 0 || x + def.w > home.cols || y + def.h > rows) return { ok: false, why: 'outside' };
  const hit = c.items.some((t) => t.uid !== ignore && layer(t) === L && overlaps({ x, y }, def.w, def.h, t));
  return hit ? { ok: false, why: 'taken' } : { ok: true };
}

export function nextUid(c) { c.nextUid = (c.nextUid || 1 + Math.max(0, ...c.items.map((t) => t.uid))); return c.nextUid++; }
// put a new thing in the room (it must fit: canPlace) → the placed thing
export function place(c, id, x, y, { flip = false, on = null } = {}) {
  const r = canPlace(c, id, x, y, { on });
  if (!r.ok) return null;
  const def = itemOf(id);
  const it = { uid: nextUid(c), id, x, y: layerOf(def) === 'top' ? c.items.find((s) => s.uid === r.on).y : y, flip: Boolean(flip) };
  if (r.on) it.on = r.on;
  c.items.push(it);
  return it;
}
// move a thing (what stands on it moves with it) → true if it moved
export function move(c, uid, x, y, { on = null } = {}) {
  const it = c.items.find((t) => t.uid === uid);
  if (!it) return false;
  const r = canPlace(c, it.id, x, y, { on, ignore: uid });
  if (!r.ok) return false;
  // the things on it come along, if they still fit on it
  const dx = x - it.x;
  if (itemOf(it.id).surface) for (const t of c.items) if (t.on === uid) { t.x += dx; t.y = y; }
  it.x = x;
  if (layer(it) === 'top') { it.on = r.on; it.y = c.items.find((s) => s.uid === r.on).y; } else it.y = y;
  return true;
}
export function flip(c, uid) { const it = c.items.find((t) => t.uid === uid); if (it) it.flip = !it.flip; return Boolean(it); }
// put a thing away (and what stands on it) → the ids put away
export function store(c, uid) {
  const it = c.items.find((t) => t.uid === uid);
  if (!it) return [];
  const gone = [it, ...c.items.filter((t) => t.on === uid)];
  c.items = c.items.filter((t) => !gone.includes(t));
  for (const t of gone) c.inv[t.id] = (c.inv[t.id] || 0) + 1;
  return gone.map((t) => t.id);
}
// every place a thing could go now (the game's own players, "find it a spot")
export function spotsFor(c, id) {
  const def = itemOf(id), home = homeOf(c), L = layerOf(def), out = [];
  if (L === 'top') {
    for (const s of c.items) {
      const sd = itemOf(s.id);
      if (!sd.surface || layer(s) !== 'floor') continue;
      for (let x = s.x; x + def.w <= s.x + sd.w; x++) if (canPlace(c, id, x, s.y, { on: s.uid }).ok) out.push({ x, y: s.y, on: s.uid });
    }
    return out;
  }
  const rows = L === 'wall' ? home.wall : home.rows;
  for (let y = 0; y + def.h <= rows; y++) for (let x = 0; x + def.w <= home.cols; x++) if (canPlace(c, id, x, y).ok) out.push({ x, y });
  return out;
}

// ---------- walking ----------
// the floor cells a thing stands on (rugs don't count)
export function blocked(c) {
  const b = new Set();
  for (const t of c.items) {
    if (layer(t) !== 'floor') continue;
    const d = itemOf(t.id);
    if (d.pet) continue;
    for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) b.add(`${t.x + i},${t.y + j}`);
  }
  return b;
}
export const thingAt = (c, x, y) => c.items.find((t) => layer(t) === 'floor' && !itemOf(t.id).pet && x >= t.x && x < t.x + itemOf(t.id).w && y >= t.y && y < t.y + itemOf(t.id).h) || null;
// the shortest way between two floor cells (4 directions), going round what's in the way; `to` may be a seat or a bed
// (she sits on it). → [cells…] (without `from`), or null when there's no way
export function path(c, from, to) {
  const home = homeOf(c), b = blocked(c);
  const key = (p) => `${p.x},${p.y}`, goal = key(to);
  if (key(from) === goal) return [];
  const prev = new Map([[key(from), null]]), q = [from];
  while (q.length) {
    const p = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy }, k = key(n);
      if (n.x < 0 || n.y < 0 || n.x >= home.cols || n.y >= home.rows || prev.has(k)) continue;
      if (b.has(k) && k !== goal) continue;
      prev.set(k, p);
      if (k === goal) { const out = [n]; let at = p; while (at && key(at) !== key(from)) { out.unshift(at); at = prev.get(key(at)); } return out; }
      q.push(n);
    }
  }
  return null;
}
// a free floor cell (to stand on), the nearest to `near` (or any)
export function freeCell(c, near = null, dice = () => 0.5) {
  const home = homeOf(c), b = blocked(c), all = [];
  for (let y = 0; y < home.rows; y++) for (let x = 0; x < home.cols; x++) if (!b.has(`${x},${y}`)) all.push({ x, y });
  if (!all.length) return { x: 0, y: home.rows - 1 };
  if (near) return all.sort((p, q) => Math.abs(p.x - near.x) + Math.abs(p.y - near.y) - Math.abs(q.x - near.x) - Math.abs(q.y - near.y))[0];
  return all[Math.floor(dice() * all.length)];
}
// where she sits to record: in front of the middle of her desk (on a seat if there's one there), facing it
export function deskSpot(c) {
  const desks = c.items.filter((t) => itemOf(t.id).desk && layer(t) === 'floor');
  if (!desks.length) return null;
  // the desk with the most on it (her computer's there)
  desks.sort((a, b) => c.items.filter((t) => t.on === b.uid).length - c.items.filter((t) => t.on === a.uid).length);
  const d = desks[0], dd = itemOf(d.id), home = homeOf(c);
  const y = d.y + dd.h;
  const xs = [Math.floor(d.x + dd.w / 2 - 0.5), Math.ceil(d.x + dd.w / 2 - 0.5), d.x, d.x + dd.w - 1];
  for (const x of xs) {
    if (y >= home.rows) break;
    const t = thingAt(c, x, y);
    if (!t || itemOf(t.id).seat) return { x, y, desk: d, seat: t || null };
  }
  return { x: xs[0], y: Math.min(home.rows - 1, y), desk: d, seat: null, blocked: true };
}
