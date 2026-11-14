// GOING LIVE: the picture. Her room is drawn into the page's view (the box the page keeps for it): the whole room
// between streams, and when she goes live the camera glides in on her and her desk, like her stream's own camera. A
// second canvas over the page carries what flies: hearts, sparkles, the views she earns.
import { fitCanvas } from '../kit/canvas.js';
import { Particles, FloatText, clamp } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { drawRoom, INK } from './art.js';
import { ROOMS } from './data.js';

// the room is 1000 × 600; between streams the camera holds the room (a narrow box shows the middle of it), live it holds her
const LIVE = { x: 500, y: 278, w: 600, h: 345 };
function hubBox(rect) {
  const a = rect.w / Math.max(1, rect.h);
  return { x: 500, y: 300, w: clamp(a * 600, 720, 1000), h: 600 };
}
export function createRenderer(canvas, top) {
  const view = fitCanvas(canvas, { maxDpr: 2 });
  const over = fitCanvas(top, { maxDpr: 2 });
  return { view, over, rect: { x: 0, y: 0, w: 1, h: 1 }, live: false, k: 0, parts: new Particles(420), text: new FloatText(), t: 0, frozeAt: 0, dim: 0 };
}
// `r.round`: the view's rounded corners (its CSS border-radius), so the room never pokes out past them
export function setRect(R, r) { R.rect = { x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h), round: r.round || 0 }; }
// the camera: 0 the room … 1 live on her (it glides; `now` jumps)
export function setLive(R, live, now = false) { R.live = live; if (now || REDUCED) R.k = live ? 1 : 0; }
function camera(R) {
  const a = hubBox(R.rect), b = LIVE, k = R.k * R.k * (3 - 2 * R.k);
  const box = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
  const s = Math.min(R.rect.w / box.w, R.rect.h / box.h);
  return { s, ox: R.rect.x + R.rect.w / 2 - box.x * s, oy: R.rect.y + R.rect.h / 2 - box.y * s };
}
// a point in the room → the page's pixels (where to put a sparkle, a word)
export function toScreen(R, x, y) { const c = camera(R); return { x: c.ox + x * c.s, y: c.oy + y * c.s }; }
export const HER = { face: [500, 160], mouth: [500, 205], desk: [500, 430], chat: [760, 300] };

export function update(R, dt) {
  R.t += dt;
  const goal = R.live ? 1 : 0;
  R.k += clamp(goal - R.k, -dt * 1.8, dt * 1.8);
  R.parts.update(dt); R.text.update(dt);
}
// `scene`: what drawRoom needs (her room, her things, live or not…); `dim`: 0 … 1 (behind the title and the cards)
export function draw(R, scene, dim = 0) {
  const c = R.view.begin(), r = R.rect, room = ROOMS[scene.room || 0];
  c.save();
  c.beginPath();
  if (r.round && c.roundRect) c.roundRect(r.x, r.y, r.w, r.h, r.round); else c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  c.save();
  // beyond the room (a tall view): more wall above, more floor below
  c.fillStyle = room.wall; c.fillRect(r.x, r.y, r.w, r.h);
  const cam = camera(R);
  c.fillStyle = room.floor; c.fillRect(r.x, cam.oy + 440 * cam.s, r.w, r.h);
  c.translate(cam.ox, cam.oy); c.scale(cam.s, cam.s);
  drawRoom(c, { ...scene, t: scene.glitch === 'freeze' ? R.frozeAt : R.t });
  c.restore();
  if (scene.glitch !== 'freeze') R.frozeAt = R.t;
  // a tech problem shows on her stream: the lights out, the picture lagging, her model frozen (still, a cold tint)
  if (scene.glitch === 'lights') { c.fillStyle = 'rgba(8,4,24,0.64)'; c.fillRect(r.x, r.y, r.w, r.h); }
  else if (scene.glitch === 'freeze') { c.fillStyle = 'rgba(150,215,255,0.2)'; c.fillRect(r.x, r.y, r.w, r.h); }
  else if (scene.glitch === 'lag' && !REDUCED) {
    const d = R.view.dpr, k = Math.floor(R.t * 9);
    for (let i = 0; i < 3; i++) {
      const y = r.y + (((k * 37 + i * 41) % 90) / 100) * r.h, h = Math.max(4, r.h * 0.07), dx = ((k + i) % 2 ? 1 : -1) * (5 + ((k * 13 + i * 7) % 10));
      c.drawImage(c.canvas, r.x * d, y * d, r.w * d, h * d, r.x + dx, y, r.w, h);
    }
  }
  if (scene.live) {
    // the stream's own frame: a soft vignette
    const g = c.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.35, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,30,0.32)');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  }
  c.restore();
  if (dim > 0) { c.fillStyle = `rgba(16,8,40,${dim})`; c.fillRect(0, 0, R.view.w, R.view.h); }
  const o = R.over.begin();
  R.parts.draw(o); R.text.draw(o);
}

// ---------- what flies ----------
export const fx = {
  hearts(R, x, y, n = 10) { R.parts.burst({ x, y, count: n, speed: [60, 220], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [0.6, 1.1], size: [7, 13], colors: ['#ff4da6', '#ff8ac0', '#b79cff'], gravity: 120, shape: 'star', spin: 3, stroke: INK }); },
  sparkle(R, x, y, colors = ['#ffd84a', '#ffffff', '#7fe0ff']) { R.parts.burst({ x, y, count: 14, speed: [80, 260], life: [0.35, 0.7], size: [3, 7], colors, shape: 'spark' }); },
  confetti(R, x, y) { R.parts.burst({ x, y, count: 46, speed: [160, 520], angle: [-Math.PI, 0], life: [0.8, 1.6], size: [5, 10], colors: ['#ff4da6', '#ffd84a', '#2fd6a6', '#6b74ff', '#ffffff'], gravity: 520, shape: 'square', spin: 8 }); },
  poof(R, x, y) { R.parts.burst({ x, y, count: 12, speed: [40, 140], life: [0.3, 0.6], size: [6, 12], colors: ['#c9c2dc', '#a89fc2'], drag: 3 }); },
  word(R, x, y, text, color = '#ffffff', size = 22) { R.text.add({ x, y, text, color, size, life: 1.1, rise: 54 }); },
};
