// AGI-1's launch video: the cuts between scenes. Most are "covers": a shape in the next scene's color sweeps over the
// last moments of a scene, and the next one starts underneath it (cheap: one scene drawn at a time). A few move the
// pictures themselves (a push, a whip pan), and those draw a scene into a buffer first.
// Each cut is on the beat the scenes change on (tools/promo/timeline.js), and the music hits it.
import { SCENES } from '../timeline.js';
import { C, E, prog, clamp, mix } from './kit.js';

const BG = { meet: C.violet, evals: C.honey, talk: C.lav, langs: C.ink, closer: C.paper, burn: C.ink, texts: C.blue, check: C.mint, launch: C.pink, more: C.lav, finale: C.violet, end: C.ink };

// ---------- shapes that cover the picture (p: 0 = nothing, 1 = all of it) ----------
// a band rising from one edge, a little tilted, with an ink edge (Pop mode's outlines)
function slab(g, W, H, p, { color, from = 'bottom', tilt = -0.05, edge = C.ink, edgeW = 14 }) {
  if (p <= 0) return;
  g.save();
  const D = Math.hypot(W, H);
  g.translate(W / 2, H / 2);
  const ang = { bottom: 0, top: Math.PI, left: Math.PI / 2, right: -Math.PI / 2, corner: -Math.PI * 0.3 }[from] ?? 0;
  g.rotate(ang + tilt);
  // the band's top edge goes from below the screen (p = 0) to above it (p = 1), in rotated space
  const span = D / 2 + 40;
  const y = mix(span, -span - 60, p);
  g.fillStyle = color;
  g.fillRect(-D, y, D * 2, D * 2);
  if (edge && edgeW) { g.fillStyle = edge; g.fillRect(-D, y - edgeW, D * 2, edgeW); }
  g.restore();
}
// a circle growing from a point, with an ink ring
function circle(g, W, H, p, { color, x, y, ring = C.ink, ringW = 12 }) {
  if (p <= 0) return;
  const R = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) + ringW;
  const r = R * p;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  if (ring && p < 1) { g.lineWidth = ringW; g.strokeStyle = ring; g.stroke(); }
  g.restore();
}
// colored bands sweeping across one after the other; the last one is the next scene's color
function stripes(g, W, H, p, { colors, stagger = 0.12 }) {
  const n = colors.length, D = Math.hypot(W, H);
  const bandH = H / n * 1.6;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.22);
  for (let k = 0; k < n; k++) {
    const q = E.inOutCubic(clamp((p - k * stagger) / (1 - (n - 1) * stagger)));
    if (q <= 0) continue;
    const isLast = k === n - 1;
    g.fillStyle = colors[k];
    if (isLast) { g.fillRect(-D, -D, D * 2 * q, D * 2); continue; }       // the last fills everything
    const y = -D / 2 + k * bandH * 0.62;
    g.fillRect(-D, y - D * 0.1, D * 2 * q, bandH + D * 0.2);
  }
  g.restore();
}

// ---------- the cuts ----------
// A cover: the shape sweeps in over the end of scene A (pre seconds), scene B starts under it
const cover = (pre, shape, opts, post = 0, after = null) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    if (t < c.B.from) {
      c.drawA(g);
      const p = E.inCubic(prog(t, c.B.from - pre, c.B.from));
      shape(g, W, H, p, typeof opts === 'function' ? opts(c) : opts);
    } else {
      c.drawB(g);
      after?.(g, t, c);
    }
  },
});
// both scenes move: B pushes A out (to the left)
const push = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H, bufA, bufB, scale } = c;
    const p = E.inOutQuart(prog(t, c.B.from - pre, c.B.from + post));
    const dx = -p * W;
    for (const [buf, draw, x] of [[bufA, c.drawA, dx], [bufB, c.drawB, dx + W]]) {
      if (x <= -W || x >= W) continue;
      buf.setTransform(scale, 0, 0, scale, 0, 0);
      draw(buf);
      g.drawImage(buf.canvas, x, 0, W, H);
    }
    // a thin ink seam
    g.fillStyle = C.ink;
    g.fillRect(dx + W - 5, 0, 10, H);
  },
});
// a zoom into white, then out of white (one flash: never a strobe)
const flash = (pre, post, { zoomA = 0.22, zoomB = 0.12 } = {}) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    const before = t < c.B.from;
    const p = before ? E.inQuad(prog(t, c.B.from - pre, c.B.from)) : 1 - E.outCubic(prog(t, c.B.from, c.B.from + post));
    const z = before ? 1 + zoomA * p : 1 + zoomB * p;
    g.save();
    g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    (before ? c.drawA : c.drawB)(g);
    g.restore();
    g.fillStyle = `rgba(255,255,255,${before ? clamp(p * 1.15 - 0.15) : p})`;
    g.fillRect(0, 0, W, H);
  },
});
// through ink: A darkens, B comes out of the dark
const throughInk = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    const before = t < c.B.from;
    (before ? c.drawA : c.drawB)(g);
    const a = before ? E.inQuad(prog(t, c.B.from - pre, c.B.from)) : 1 - E.outQuad(prog(t, c.B.from, c.B.from + post));
    g.fillStyle = `rgba(23,10,54,${a})`;
    g.fillRect(0, 0, W, H);
  },
});
// a whip pan: the picture flies off to the left, smeared, and the next flies in from the right
const whip = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H, bufA, scale } = c;
    const before = t < c.B.from;
    const p = before ? E.inCubic(prog(t, c.B.from - pre, c.B.from)) : 1 - E.outCubic(prog(t, c.B.from, c.B.from + post));
    const x0 = before ? -p * W * 0.9 : p * W * 0.9;
    bufA.setTransform(scale, 0, 0, scale, 0, 0);
    (before ? c.drawA : c.drawB)(bufA);
    g.fillStyle = BG[before ? c.A.id : c.B.id] || C.ink;
    g.fillRect(0, 0, W, H);
    // the smear: copies along the motion, fainter further back
    const n = 7, len = 260 * p;
    for (let k = n - 1; k >= 0; k--) {
      g.globalAlpha = k === 0 ? 1 : 0.22 * (1 - k / n);
      g.drawImage(bufA.canvas, x0 + (before ? 1 : -1) * len * (k / n), 0, W, H);
    }
    g.globalAlpha = 1;
    // speed lines across
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 0; k < 14; k++) {
      const y = ((k * 137.3) % H), w = 300 + ((k * 91.7) % 500);
      g.globalAlpha = 0.35 * p;
      g.fillRect(((k * 211.9 + t * 9000) % (W + w)) - w, y, w, 3);
    }
    g.globalAlpha = 1;
  },
});

// where a scene's own cut comes from (its exit point), else the middle
const exitOf = (mods) => (id) => (c) => mods?.[id]?.exit?.(c) || { x: c.W / 2, y: c.H / 2 };
export let sceneExits = null;
export const setSceneExits = (mods) => { sceneExits = exitOf(mods); };
const from = (id, color) => (c) => ({ color, ...(sceneExits ? sceneExits(id)(c) : { x: c.W / 2, y: c.H / 2 }) });

// boundary i is between SCENES[i] and SCENES[i + 1]; open → meet has no cut of its own (the ✦ click's violet circle,
// drawn by the open scene, is the cut)
const CUTS = {
  1: cover(0.36, slab, { color: BG.evals, from: 'bottom', tilt: -0.06 }),
  2: push(0.28, 0.32),
  3: flash(0.22, 0.28),
  4: cover(0.5, stripes, { colors: [C.pink, C.honey, C.mint, C.blue, BG.closer] }),
  5: throughInk(0.32, 0.3),
  6: cover(0.36, circle, from('burn', BG.texts)),
  7: whip(0.2, 0.24),
  8: cover(0.36, circle, from('check', BG.launch)),
  9: cover(0.36, slab, { color: BG.more, from: 'corner', tilt: 0 }),
  10: cover(0.38, circle, from('more', BG.finale)),
  11: cover(0.4, slab, { color: BG.end, from: 'bottom', tilt: 0.04, edge: C.pink, edgeW: 10 }),
};
export const TRANSITIONS = Object.entries(CUTS).map(([i, c]) => ({ i: +i, at: SCENES[+i + 1].from, ...c }));
export { BG };
