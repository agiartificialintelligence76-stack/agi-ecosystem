// I'M NOT A ROBOT: what every check shares. A check is drawn in its own units, a 400 × 360 page inside the browser
// window (the screen scales it); its rules are pure (tests/notarobot.test.js runs them, and the demo's hand plays them,
// in Node). A check reports what happened by `st.fx` (sounds and sparkles: the screen plays them) and ends itself with
// done(st, 'pass' | 'fail').
import { clamp, TAU } from '../../kit/fx.js';
import { INK, LW, C, rr, inked } from '../art.js';

// what a check is set up with when nobody says (a test)
export const OPTS = Object.freeze({ T: 4, tempo: 1, speed: 1, boss: false, kb: false });
export const W = 400;
export const H = 360;
export { clamp, TAU };

export function done(st, how, why = null) {
  if (st.done) return;
  st.done = how;
  if (why) st.why = why;
}
export const fx = (st, type, x, y, extra = null) => { st.fx.push(extra ? { type, x, y, ...extra } : { type, x, y }); };
export const hitCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const inBox = (x, y, b, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

// ---------- a cursor for the keyboard: the arrows move it, quicker the longer they're held ----------
export const kcursor = (x = W / 2, y = H * 0.75) => ({ x, y, vx: 0, vy: 0, on: false });
export function moveKcursor(kc, io, dt, max = 470, pad = 6) {
  const ax = (io.held('right') ? 1 : 0) - (io.held('left') ? 1 : 0);
  const ay = (io.held('down') ? 1 : 0) - (io.held('up') ? 1 : 0);
  if (ax || ay) kc.on = true;
  const n = Math.hypot(ax, ay) || 1;
  const k = 1 - Math.exp(-14 * dt);
  kc.vx += ((ax / n) * max - kc.vx) * k;
  kc.vy += ((ay / n) * max - kc.vy) * k;
  kc.x = clamp(kc.x + kc.vx * dt, pad, W - pad);
  kc.y = clamp(kc.y + kc.vy * dt, pad, H - pad);
}

// ---------- choosing among things with the arrow keys: the nearest one that way ----------
export function stepSel(items, i, dir) {
  const a = items[i];
  if (!a) return 0;
  const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir] || [0, 0];
  let best = -1, score = Infinity;
  items.forEach((b, j) => {
    if (j === i || b.gone) return;
    const vx = b.x - a.x, vy = b.y - a.y;
    const along = vx * dx + vy * dy;
    if (along <= 4) return;
    const side = Math.abs(vx * dy - vy * dx);
    const s = along + side * 2.2;
    if (s < score) { score = s; best = j; }
  });
  return best >= 0 ? best : i;
}
export const KEYDIR = new Set(['left', 'right', 'up', 'down']);

// the keyboard's choice: a thick honey ring around a thing
export function selRing(g, x, y, w, h, t, r = 16) {
  const p = 3 + Math.sin(t * 10) * 1.6;
  rr(g, x - p, y - p, w + p * 2, h + p * 2, r + p);
  g.lineWidth = LW * 3.2; g.strokeStyle = INK; g.stroke();
  g.lineWidth = LW * 1.7; g.strokeStyle = C.honey; g.stroke();
}
export function selCircle(g, x, y, r, t) {
  const p = r + 4 + Math.sin(t * 10) * 2;
  g.beginPath(); g.arc(x, y, p, 0, TAU);
  g.lineWidth = LW * 3.2; g.strokeStyle = INK; g.stroke();
  g.lineWidth = LW * 1.7; g.strokeStyle = C.honey; g.stroke();
}
// a tile of a grid (a page's card): paper, ink, a little shadow
export function tile(g, x, y, w, h, fill = C.paper, r = 14, off = 3) {
  rr(g, x + off * 0.5, y + off, w, h, r); g.fillStyle = INK; g.fill();
  rr(g, x, y, w, h, r); inked(g, fill);
}
// a seeded spot that keeps clear of the others (n tries, then the best found)
export function scatter(r, n, { x0, x1, y0, y1, gap }) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    let best = null, bestD = -1;
    for (let k = 0; k < 60; k++) {
      const p = { x: r.range(x0, x1), y: r.range(y0, y1) };
      const d = pts.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), Infinity);
      if (d >= gap) { best = p; bestD = d; break; }
      if (d > bestD) { best = p; bestD = d; }
    }
    pts.push(best);
  }
  return pts;
}
// a little shake for a wrong answer (seconds since it, → px)
export const wobble = (t) => (t >= 0 && t < 0.35 ? Math.sin(t * 60) * 7 * (1 - t / 0.35) : 0);
