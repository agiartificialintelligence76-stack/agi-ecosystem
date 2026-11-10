// AIR GAP: where the table goes on the screen, and which way. Pure: no DOM.
// The table runs along the long side: on a screen held upright your goal is at the bottom and hers at the top; on a
// screen held sideways (and a computer) your goal is on the left and hers on the right. The logical table is turned a
// quarter (never stretched): screen = origin + R(table) × scale.
import { W, H, MID, SLOT } from './physics.js';

export const RAIL = 34;                        // the rails' thickness (table units, outside the playfield)
export const SHADOW = 10;                      // their hard shadow
// the table's box in its own units, rails and their shadow included (the same margin all round: centred either way up)
const PAD = RAIL + SHADOW;
export const BOX = { x0: -PAD, y0: -PAD, x1: W + PAD, y1: H + PAD };

// → { rot (false: upright, true: turned), s (px per unit), ox, oy (where the table's (0, 0) lands), w, h (its box on
// screen) } for a free area (x, y, w, h) in CSS pixels
export function fitTable(area, { rotate = null } = {}) {
  const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
  const turned = rotate ?? area.w > area.h * 1.04;
  const s = turned ? Math.min(area.w / bh, area.h / bw) : Math.min(area.w / bw, area.h / bh);
  if (!turned) {
    const w = bw * s, h = bh * s;
    const left = area.x + (area.w - w) / 2, top = area.y + (area.h - h) / 2;
    return { rot: false, s, ox: left - BOX.x0 * s, oy: top - BOX.y0 * s, w, h, left, top };
  }
  // turned: table y runs to the left on screen (your goal, y = H, on the left), table x runs down
  const w = bh * s, h = bw * s;
  const left = area.x + (area.w - w) / 2, top = area.y + (area.h - h) / 2;
  // screen x = ox − y·s, screen y = oy + x·s; the box's y1 (your end) at `left`, x0 at `top`
  return { rot: true, s, ox: left + BOX.y1 * s, oy: top - BOX.x0 * s, w, h, left, top };
}

// table → screen
export function toScreen(L, x, y, out = { x: 0, y: 0 }) {
  if (!L.rot) { out.x = L.ox + x * L.s; out.y = L.oy + y * L.s; }
  else { out.x = L.ox - y * L.s; out.y = L.oy + x * L.s; }
  return out;
}
// screen → table
export function toTable(L, sx, sy, out = { x: 0, y: 0 }) {
  if (!L.rot) { out.x = (sx - L.ox) / L.s; out.y = (sy - L.oy) / L.s; }
  else { out.x = (sy - L.oy) / L.s; out.y = (L.ox - sx) / L.s; }
  return out;
}
// a direction on screen (keys: right, down…) → the same direction on the table
export function dirToTable(L, dx, dy, out = { x: 0, y: 0 }) {
  if (!L.rot) { out.x = dx; out.y = dy; } else { out.x = dy; out.y = -dx; }
  return out;
}
// a direction on the table → on screen
export function dirToScreen(L, dx, dy, out = { x: 0, y: 0 }) {
  if (!L.rot) { out.x = dx; out.y = dy; } else { out.x = -dy; out.y = dx; }
  return out;
}

// Two players on one touchscreen: a finger belongs to the half of the table it started in (side 0: the bottom / left,
// side 1: the top / right). A touch outside the table counts for the half it's nearest to.
export function sideOfTouch(L, sx, sy) {
  const p = toTable(L, sx, sy);
  return p.y >= MID ? 0 : 1;
}

// A finger's mallet sits a little ahead of it, toward the table's centre, so the thumb never hides it; the gap shrinks
// near the back rail so the mallet can still tuck into the goal mouth. → the target on the table
export function touchTarget(L, sx, sy, side, { offsetPx = 46, out = { x: 0, y: 0 } } = {}) {
  const p = toTable(L, sx, sy, out);
  const back = side === 0 ? H - p.y : p.y;          // table units from her own back rail
  const k = Math.max(0.25, Math.min(1, (back * L.s) / 120));
  const off = (offsetPx * k) / L.s;
  p.y += side === 0 ? -off : off;
  return p;
}

// the goal slot's depth on screen, for the layout's margins
export const SLOT_PX = (L) => SLOT * L.s;
