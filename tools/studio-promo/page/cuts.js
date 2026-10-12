// AGI Studio's launch video: the cuts between its scenes. Each is on the bar the scenes change on
// (tools/studio-promo/timeline.js), and the music marks it (a whoosh, a hit). Some only cover the picture (a dark breath,
// a band of the app's gradient), some move the pictures themselves (a push, a whip pan, an iris), and those draw a scene
// into a buffer first. A scene drawn before its start shows its first moment, one drawn after its end its last.
import { SCENES } from '../timeline.js';
import { E, prog, clamp, mix } from '../../promo/page/kit.js';
import { S, GRAD, grad } from './look.js';

const dark = (g, W, H, a) => { if (a > 0) { g.fillStyle = `rgba(9,9,11,${clamp(a)})`; g.fillRect(0, 0, W, H); } };

// a breath of dark, then the next scene slams in out of a light flash (the drops)
const slam = (pre, post, { flash = 0.85 } = {}) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    if (t < c.B.from) {
      c.drawA(g);
      dark(g, W, H, E.inQuad(prog(t, c.B.from - pre, c.B.from)));
      return;
    }
    const p = prog(t, c.B.from, c.B.from + post);
    const z = 1 + 0.07 * (1 - E.outCubic(p));
    g.save();
    g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    c.drawB(g);
    g.restore();
    const f = flash * (1 - E.outCubic(p));
    if (f > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(214,200,255,${f * 0.55})`;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  },
});

// both scenes move: B pushes A out (up, or to the left), a thin light seam between them
const push = (pre, post, dir = 'up') => ({
  pre, post,
  draw(g, t, c) {
    const { W, H, bufA, bufB, scale } = c;
    const p = E.inOutQuart(prog(t, c.B.from - pre, c.B.from + post));
    const up = dir === 'up';
    const off = -p * (up ? H : W);
    g.fillStyle = S.bg; g.fillRect(0, 0, W, H);
    const pairs = [[bufA, c.drawA, off], [bufB, c.drawB, off + (up ? H : W)]];
    for (const [buf, drawIt, d] of pairs) {
      if (Math.abs(d) >= (up ? H : W)) continue;
      buf.setTransform(scale, 0, 0, scale, 0, 0);
      drawIt(buf);
      if (up) g.drawImage(buf.canvas, 0, d, W, H); else g.drawImage(buf.canvas, d, 0, W, H);
    }
    const seam = up ? off + H : off + W;
    g.save();
    g.fillStyle = grad(g, 0, 0, W, H, GRAD.light, up ? 90 : 180);
    g.globalAlpha = 0.85 * Math.sin(Math.PI * p);
    if (up) g.fillRect(0, seam - 2, W, 4); else g.fillRect(seam - 2, 0, 4, H);
    g.restore();
  },
});

// a band of the app's gradient sweeps across: it covers A, and B is under it as it leaves
const wipe = (pre, post, { reverse = false, skew = 0.32 } = {}) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    const before = t < c.B.from;
    (before ? c.drawA : c.drawB)(g);
    const p = before ? E.inCubic(prog(t, c.B.from - pre, c.B.from)) : E.outCubic(prog(t, c.B.from, c.B.from + post));
    const k = H * skew;                    // the edges' slant
    g.save();
    if (reverse) { g.translate(W, 0); g.scale(-1, 1); }
    // before: the band's front edge goes from the left to past the right; after: its back edge does
    const front = before ? mix(-k, W + k, p) : W + k + 10;
    const back = before ? -k - 10 : mix(-k, W + k, p);
    g.beginPath();
    g.moveTo(back + k, 0); g.lineTo(front + k, 0); g.lineTo(front - k, H); g.lineTo(back - k, H); g.closePath();
    g.fillStyle = grad(g, 0, 0, W, H, GRAD.brand, 100);
    g.fill();
    // a light on its moving edge
    const edge = before ? front : back;
    g.beginPath(); g.moveTo(edge + k, 0); g.lineTo(edge - k, H);
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    g.restore();
  },
});

// a zoom into a soft light, and out of it into B (one flash: never a strobe)
const zoomFlash = (pre, post, { zoomA = 0.2, zoomB = 0.1 } = {}) => ({
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
    g.fillStyle = `rgba(236,232,255,${before ? clamp(p * 1.1 - 0.15) * 0.92 : p * 0.92})`;
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
    g.fillStyle = S.bg;
    g.fillRect(0, 0, W, H);
    const n = 7, len = 300 * p;
    for (let k = n - 1; k >= 0; k--) {
      g.globalAlpha = k === 0 ? 1 : 0.2 * (1 - k / n);
      g.drawImage(bufA.canvas, x0 + (before ? 1 : -1) * len * (k / n), 0, W, H);
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 12; k++) {
      const y = (k * 151.3) % H, w = 280 + ((k * 97.7) % 480);
      g.globalAlpha = 0.3 * p;
      g.fillStyle = k % 3 ? 'rgba(167,139,250,0.9)' : 'rgba(244,114,182,0.9)';
      g.fillRect(((k * 211.9 + t * 9000) % (W + w)) - w, y, w, 3);
    }
    g.globalAlpha = 1;
  },
});

// an iris: B opens in a growing circle from a point of A (with a gradient ring on its edge)
const iris = (pre, post, at = null) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H, bufB, scale } = c;
    const [x, y] = (typeof at === 'function' ? at(c) : at) || [W / 2, H / 2];
    const R = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) + 20;
    const p = E.inOutCubic(prog(t, c.B.from - pre, c.B.from + post));
    if (p >= 1) { c.drawB(g); return; }
    c.drawA(g);
    if (p <= 0) return;
    bufB.setTransform(scale, 0, 0, scale, 0, 0);
    c.drawB(bufB);
    const r = R * p;
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.drawImage(bufB.canvas, 0, 0, W, H);
    g.restore();
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.lineWidth = 10 * (1 - p) + 2;
    g.strokeStyle = grad(g, x - r, y - r, r * 2, r * 2, GRAD.light, 120);
    g.stroke();
    g.restore();
  },
});

// through the dark: A darkens, B comes out of it
const throughDark = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    const before = t < c.B.from;
    (before ? c.drawA : c.drawB)(g);
    dark(g, W, H, before ? E.inQuad(prog(t, c.B.from - pre, c.B.from)) : 1 - E.outQuad(prog(t, c.B.from, c.B.from + post)));
  },
});

// the cut into each scene (its index: SCENES[i] → SCENES[i + 1]), with how long it takes before and after the bar
const KINDS = {
  brand: slam(0.25, 0.4, { flash: 0.5 }),
  create: push(0.35, 0.3, 'up'),
  styles: wipe(0.28, 0.3),
  photos: zoomFlash(0.25, 0.3),
  memes: whip(0.18, 0.24),
  edit: iris(0.45, 0.05, (c) => c.irisFrom?.memes || [c.W * 0.3, c.H * 0.6]),
  trends: slam(0.25, 0.4, { flash: 0.6 }),
  videos: push(0.35, 0.3, 'left'),
  tools: wipe(0.28, 0.3, { reverse: true }),
  model: throughDark(0.3, 0.35),
  pay: iris(0.45, 0.05, (c) => c.irisFrom?.model || [c.W / 2, c.H / 2]),
  community: push(0.35, 0.3, 'up'),
  finale: slam(0.25, 0.45),
  end: throughDark(0.45, 0.5),
};
export const TRANSITIONS = SCENES.slice(1).map((s, k) => {
  const kind = KINDS[s.id];
  if (!kind) throw new Error(`no cut into ${s.id}`);
  return { i: k, at: s.from, id: s.id, ...kind };
});
export const cutKinds = () => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.pre + v.post]));
