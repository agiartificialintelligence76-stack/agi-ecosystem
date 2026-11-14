// GOING LIVE: the picture. Her room is drawn in art pixels on a small canvas of its own (the walls and floor, the things
// on the wall, the rugs, then everything standing on the floor and everyone walking about, nearest last), then scaled
// up onto the page by a whole number of screen pixels so every art pixel stays a crisp square. At night (her player's
// clock) the room's darker and her lamps glow. When she goes live the view is her stream: her face up close in front
// of her room. A second canvas over the page carries what flies: hearts, sparkles, the views she earns.
import { fitCanvas } from '../kit/canvas.js';
import { Particles, FloatText } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { itemOf, homeOf } from './data.js';
import { layer, canPlace } from './room.js';
import { CELL, ROW, WROW, INK, roomGeom, roomSprite, itemSprite, framesOf, herSprite, bustSprite, catSprite, dogSprite, botSprite, droneSprite, boxSprite, HER } from './pixel.js';
import { herPose, petPose, droneAt } from './actor.js';

const bufferOf = (w, h) => { if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function createRenderer(canvas, top) {
  const view = fitCanvas(canvas, { maxDpr: 3 });
  const over = fitCanvas(top, { maxDpr: 2 });
  return { view, over, rect: { x: 0, y: 0, w: 1, h: 1, round: 0 }, buf: null, bw: 0, bh: 0, cam: null, parts: new Particles(420), text: new FloatText(), t: 0, hits: [] };
}
export function setRect(R, r) { R.rect = { x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h), round: r.round || 0 }; }
export function update(R, dt) { R.t += dt; R.parts.update(dt); R.text.update(dt); }

// the camera: art pixels → the page (CSS pixels). The room as big as fits in whole device pixels.
function camera(R, G, zoom = 1, focus = null) {
  const d = R.view.dpr, r = R.rect;
  const k = Math.max(1, Math.floor(Math.min((r.w * d) / G.W, (r.h * d) / G.H) * zoom)), s = k / d;
  let cx = G.W / 2, cy = G.H / 2;
  if (focus) { cx = focus.x; cy = focus.y; }
  let ox = r.x + r.w / 2 - cx * s, oy = r.y + r.h / 2 - cy * s;
  if (focus) { ox = Math.min(r.x, Math.max(r.x + r.w - G.W * s, ox)); oy = Math.min(r.y, Math.max(r.y + r.h - G.H * s, oy)); }
  return { k, s, ox: Math.round(ox * d) / d, oy: Math.round(oy * d) / d };
}
export const toScreen = (R, ax, ay) => (R.cam ? { x: R.cam.ox + ax * R.cam.s, y: R.cam.oy + ay * R.cam.s } : { x: 0, y: 0 });
export const toArt = (R, sx, sy) => (R.cam ? { x: (sx - R.cam.ox) / R.cam.s, y: (sy - R.cam.oy) / R.cam.s } : { x: -1, y: -1 });

// where things are, in art pixels
export function cellPos(G, x, y) { return { x: G.x0 + x * CELL, y: G.floorTop + y * ROW }; }
// a thing's sprite and where its top-left goes
function placeOf(c, G, it, frame, v) {
  const def = itemOf(it.id), L = layer(it), spr = itemSprite(it.id, frame, v);
  if (!spr) return null;
  const x = G.x0 + it.x * CELL;
  if (L === 'wall') return { spr, x, y: G.wallTop + it.y * WROW, base: -1 };
  if (L === 'flat') return { spr, x, y: G.floorTop + it.y * ROW, base: -2 };
  if (L === 'top') {
    const s = c.items.find((t) => t.uid === it.on);
    const sd = s ? itemOf(s.id) : null;
    const base = G.floorTop + ((s?.y ?? 0) + (sd?.h ?? 1)) * ROW - (sd?.surface ?? 12) - Math.min(5, (sd?.h ?? 1) * ROW - 3);
    return { spr, x, y: base - spr.h, base: G.floorTop + ((s?.y ?? 0) + (sd?.h ?? 1)) * ROW + 0.5 };
  }
  const base = G.floorTop + (it.y + def.h) * ROW;
  return { spr, x, y: base - spr.h, base };
}
const drawSpr = (ctx, spr, x, y, flip = false, alpha = 1) => {
  if (!spr) return;
  ctx.globalAlpha = alpha;
  if (flip) { ctx.save(); ctx.translate(Math.round(x) + spr.w + 1, 0); ctx.scale(-1, 1); ctx.drawImage(spr.canvas, -1, Math.round(y) - 1); ctx.restore(); } else ctx.drawImage(spr.canvas, Math.round(x) - 1, Math.round(y) - 1);
  ctx.globalAlpha = 1;
};

// ---------- the room ----------
// `scene`: { night, edit, ghost: { id, x, y, on, flip, ok }, picked (uid being moved), boxes (deliveries), frame, hide (her) }
export function drawRoom(R, c, A, scene) {
  const home = homeOf(c), G = roomGeom(home);
  if (!R.buf || R.bw !== G.W || R.bh !== G.H) { R.buf = bufferOf(G.W, G.H); R.bw = G.W; R.bh = G.H; }
  const ctx = R.buf.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, G.W, G.H);
  ctx.drawImage(roomSprite(home).canvas, -1, -1);
  const v = { view: home.view, night: scene.night };
  const t = R.t, fr = (id) => (framesOf(id) > 1 && !REDUCED ? Math.floor(t * 4 + id.length) % framesOf(id) : 0);
  const hits = [];
  // the floor grid while decorating
  if (scene.edit || scene.ghost) {
    ctx.fillStyle = 'rgba(42,20,64,0.18)';
    for (let x = 0; x <= G.cols; x++) ctx.fillRect(G.x0 + x * CELL, G.floorTop, 1, G.rows * ROW);
    for (let y = 0; y <= G.rows; y++) ctx.fillRect(G.x0, G.floorTop + y * ROW, G.cols * CELL, 1);
    for (let x = 0; x <= G.cols; x++) ctx.fillRect(G.x0 + x * CELL, G.wallTop, 1, G.wall * WROW);
    for (let y = 0; y <= G.wall; y++) ctx.fillRect(G.x0, G.wallTop + y * WROW, G.cols * CELL, 1);
  }
  // wall things, then rugs
  const list = [];
  for (const it of c.items) {
    if (it.uid === scene.picked) continue;
    const p = placeOf(c, G, it, fr(it.id), v);
    if (!p || itemOf(it.id).pet) continue;
    if (p.base === -1 || p.base === -2) { drawSpr(ctx, p.spr, p.x, p.y, it.flip); hits.push({ kind: 'item', uid: it.uid, x: p.x, y: p.y, w: p.spr.w, h: p.spr.h, z: p.base }); }
    else list.push({ z: p.base + (layer(it) === 'top' ? 0.3 : 0), draw: () => drawSpr(ctx, p.spr, p.x, p.y, it.flip), hit: { kind: 'item', uid: it.uid, x: p.x, y: p.y, w: p.spr.w, h: p.spr.h } });
  }
  // her
  const h = A.her;
  if (!scene.hide) {
    const pose = herPose(A), spr = herSprite(pose);
    const seat = h.sit && h.sit !== 'desk' ? c.items.find((t) => t.uid === h.sit) : null;
    let x = G.x0 + (h.x + 0.5) * CELL - HER.w / 2, base = G.floorTop + (h.y + 1) * ROW - 2;
    if (pose === 'sleep' && seat) { x = G.x0 + seat.x * CELL + 2; base = G.floorTop + (seat.y + itemOf(seat.id).h) * ROW - 6; }
    else if (seat && pose === 'sit') base -= 3;
    const z = seat ? G.floorTop + (seat.y + itemOf(seat.id).h) * ROW + 0.2 : base + 2;
    list.push({ z: pose === 'sleep' ? z + 0.1 : z, draw: () => drawSpr(ctx, spr, x, base - spr.h, h.face < 0 && pose.startsWith('walk')), hit: { kind: 'her', x, y: base - spr.h, w: spr.w, h: spr.h } });
  }
  // her pets, the bots
  for (const p of A.pets.values()) {
    const spr = p.id === 'cat' ? catSprite(petPose(p)) : dogSprite(petPose(p));
    const x = G.x0 + (p.x + 0.5) * CELL - spr.w / 2, base = G.floorTop + (p.y + 1) * ROW - 1;
    if (scene.picked === p.uid) continue;
    list.push({ z: base + 1, draw: () => drawSpr(ctx, spr, x, base - spr.h, p.face < 0), hit: { kind: 'pet', uid: p.uid, x, y: base - spr.h, w: spr.w, h: spr.h } });
  }
  for (const b of A.bots.values()) {
    const spr = botSprite(Math.floor(t * 6 + b.id) % 2);
    const x = G.x0 + (b.x + 0.5) * CELL - spr.w / 2, base = G.floorTop + (b.y + 1) * ROW - 1;
    list.push({ z: base + 1, draw: () => drawSpr(ctx, spr, x, base - spr.h, b.face < 0, b.leaving ? 0.6 : 1), hit: { kind: 'bot', id: b.id, x: x - 3, y: base - spr.h - 3, w: spr.w + 6, h: spr.h + 6 } });
  }
  list.sort((a, b) => a.z - b.z);
  for (const e of list) { e.draw(); if (e.hit) hits.push({ ...e.hit, z: e.z }); }
  // what's being placed: a ghost on its cells, green where it fits
  if (scene.ghost) drawGhost(ctx, c, G, scene.ghost, v);
  // the drone, across the wall
  const dk = droneAt(A);
  if (dk >= 0) {
    const spr = droneSprite(Math.floor(t * 12) % 2), x = -20 + dk * (G.W + 40), y = G.wallTop + 8 + Math.sin(t * 5) * 2;
    drawSpr(ctx, spr, x, y);
    hits.push({ kind: 'drone', x: x - 6, y: y - 6, w: spr.w + 12, h: spr.h + 12, z: 999 });
  }
  // the boxes on their way, along the front edge of the floor from the right (the room's name is down on the left)
  (scene.boxes || []).forEach((d, i) => {
    const spr = boxSprite(d.ready ? 'ready' : 'wait'), x = G.x0 + G.cols * CELL - 2 - spr.w - i * 16, y = G.floorBottom - spr.h + 4 + (d.ready ? Math.round(Math.sin(t * 6 + i) * 1) : 0);
    drawSpr(ctx, spr, x, y);
    hits.push({ kind: 'box', uid: d.uid, x: x - 2, y: y - 4, w: spr.w + 4, h: spr.h + 6, z: 1000 + i, ready: d.ready, left: d.left });
  });
  // night: darker, and her lamps glow
  if (scene.night) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#7a72c8'; ctx.fillRect(0, 0, G.W, G.H);
    ctx.globalCompositeOperation = 'lighter';
    for (const it of c.items) {
      if (!itemOf(it.id).light) continue;
      const p = placeOf(c, G, it, 0, v); if (!p) continue;
      const cx = p.x + p.spr.w / 2, cy = p.y + Math.min(10, p.spr.h / 3), r = 18 + p.spr.w * 0.6;
      const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,214,150,0.38)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  R.hits = hits;
  return G;
}
function drawGhost(ctx, c, G, g, v) {
  const def = itemOf(g.id), L = def.place === 'wall' ? 'wall' : def.place === 'top' ? 'top' : def.place === 'flat' ? 'flat' : 'floor';
  const it = { uid: -1, id: g.id, x: g.x, y: g.y, on: g.on, flip: g.flip };
  const p = placeOf(c, G, it, 0, v);
  // the cells it takes
  ctx.fillStyle = g.ok ? 'rgba(47,214,166,0.45)' : 'rgba(255,59,92,0.45)';
  if (L === 'wall') ctx.fillRect(G.x0 + g.x * CELL, G.wallTop + g.y * WROW, def.w * CELL, def.h * WROW);
  else if (L === 'top') { if (p) ctx.fillRect(p.x, p.y + p.spr.h - 3, def.w * CELL, 3); }
  else ctx.fillRect(G.x0 + g.x * CELL, G.floorTop + g.y * ROW, def.w * CELL, def.h * ROW);
  if (p) drawSpr(ctx, p.spr, p.x, p.y, g.flip, 0.85);
}

// ---------- onto the page ----------
// `mode`: 'room' (the whole room), 'live' (her stream: her face up close), 'title' (the room, dimmed)
export function draw(R, c, A, scene, mode = 'room') {
  const G = drawRoom(R, c, A, scene);
  const ctx = R.view.begin(), d = R.view.dpr, r = R.rect;
  // the backdrop beyond the room
  ctx.save();
  ctx.beginPath();
  if (r.round && ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, r.round); else ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = mode === 'live' ? '#1d1238' : '#2a1440'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const cam = camera(R, G);
  R.cam = cam;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(R.buf, Math.round(cam.ox * d), Math.round(cam.oy * d), G.W * cam.k, G.H * cam.k);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  if (mode === 'live') drawLive(R, ctx, A, scene);
  if (mode === 'title') { ctx.fillStyle = 'rgba(16,8,40,0.45)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
  // what flies
  const o = R.over.begin();
  R.parts.draw(o); R.text.draw(o);
  return G;
}
// her stream, laid out like one: her room, and her face cam in the corner (bobbing, blinking, talking)
function drawLive(R, ctx, A, scene) {
  const r = R.rect, d = R.view.dpr, t = R.t;
  ctx.fillStyle = 'rgba(29,18,56,0.18)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const h = A.her, talk = h.talk > 0 && Math.floor(t * 8) % 2;
  const pose = scene.happy ? 'happy' : talk ? 'talk' : h.blink < 0 ? 'blink' : 'idle';
  const spr = bustSprite(pose);
  const k = Math.max(2, Math.floor((Math.min(r.h * 0.42, r.w * 0.3) * d) / 34)), s = k / d, size = 34 * s;
  const pad = 6, fx0 = r.x + r.w - size - pad * 2 - 10, fy0 = r.y + r.h - size - pad - 10;
  // the cam's frame
  ctx.fillStyle = '#2a1440'; roundRect(ctx, fx0 - 3, fy0 - 3, size + pad * 2 + 6, size + pad + 6, 12); ctx.fill();
  const bg = ctx.createLinearGradient(0, fy0, 0, fy0 + size + pad);
  bg.addColorStop(0, '#ffd1ea'); bg.addColorStop(1, '#c9b2ff');
  ctx.fillStyle = bg; roundRect(ctx, fx0, fy0, size + pad * 2, size + pad, 10); ctx.fill();
  ctx.save(); roundRect(ctx, fx0, fy0, size + pad * 2, size + pad, 10); ctx.clip();
  const bob = REDUCED ? 0 : Math.round(Math.sin(t * 2.4) * 1.2) * s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr.canvas, Math.round((fx0 + pad) * d), Math.round((fy0 + pad + bob) * d), 34 * k, 34 * k);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.restore();
  ctx.fillStyle = '#ff3b5c'; roundRect(ctx, fx0 + 6, fy0 + 6, 30, 13, 6); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '800 9px system-ui, sans-serif'; ctx.fillText('CAM', fx0 + 12, fy0 + 16);
  // the stream's own frame: a soft vignette
  const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,30,0.4)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
// what's under a point on the page: the drone, a box, a bot, a pet, her, a thing (the nearest first)
export function hitAt(R, sx, sy, kinds = null) {
  const a = toArt(R, sx, sy);
  const list = R.hits.filter((h) => (!kinds || kinds.includes(h.kind)) && a.x >= h.x && a.x < h.x + h.w && a.y >= h.y && a.y < h.y + h.h);
  list.sort((p, q) => q.z - p.z);
  return list[0] || null;
}
// the cell under a point: on the floor, or on the wall (for placing)
export function cellAt(R, c, sx, sy) {
  const G = roomGeom(homeOf(c)), a = toArt(R, sx, sy);
  const x = Math.floor((a.x - G.x0) / CELL);
  if (a.y < G.wallBottom) return { x, y: Math.floor((a.y - G.wallTop) / WROW), wall: true };
  return { x, y: Math.floor((a.y - G.floorTop) / ROW), wall: false };
}
// where a thing being placed under the pointer would go: its cells centred on the point (a small thing: the surface there)
export function ghostAt(R, c, id, sx, sy) {
  const def = itemOf(id), G = roomGeom(homeOf(c)), a = toArt(R, sx, sy);
  const L = def.place === 'wall' ? 'wall' : def.place === 'top' ? 'top' : 'floor';
  const x = Math.round((a.x - G.x0) / CELL - def.w / 2);
  if (L === 'wall') return { x, y: Math.round((a.y - G.wallTop) / WROW - def.h / 2) };
  if (L === 'top') {
    // the surface whose top is nearest the point
    let best = null, bd = Infinity;
    for (const s of c.items) {
      const sd = itemOf(s.id);
      if (!sd.surface || layer(s) !== 'floor') continue;
      const top = G.floorTop + (s.y + sd.h) * ROW - sd.surface, dx = a.x < G.x0 + s.x * CELL ? G.x0 + s.x * CELL - a.x : a.x > G.x0 + (s.x + sd.w) * CELL ? a.x - G.x0 - (s.x + sd.w) * CELL : 0;
      const dd = dx + Math.abs(a.y - top) * 0.7;
      if (dd < bd) { bd = dd; best = s; }
    }
    if (!best) return { x, y: 0, on: null };
    const sd = itemOf(best.id);
    return { x: Math.max(best.x, Math.min(best.x + sd.w - def.w, x)), y: best.y, on: best.uid };
  }
  return { x, y: Math.round((a.y - G.floorTop) / ROW - def.h + 0.5) };
}
export const fits = (c, g, ignore = null) => canPlace(c, g.id, g.x, g.y, { on: g.on, ignore }).ok;

// ---------- what flies ----------
export const fx = {
  hearts(R, x, y, n = 10) { R.parts.burst({ x, y, count: n, speed: [60, 220], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [0.6, 1.1], size: [7, 13], colors: ['#ff4da6', '#ff8ac0', '#b79cff'], gravity: 120, shape: 'star', spin: 3, stroke: INK }); },
  sparkle(R, x, y, colors = ['#ffd84a', '#ffffff', '#7fe0ff']) { R.parts.burst({ x, y, count: 14, speed: [80, 260], life: [0.35, 0.7], size: [3, 7], colors, shape: 'spark' }); },
  confetti(R, x, y) { R.parts.burst({ x, y, count: 46, speed: [160, 520], angle: [-Math.PI, 0], life: [0.8, 1.6], size: [5, 10], colors: ['#ff4da6', '#ffd84a', '#2fd6a6', '#6b74ff', '#ffffff'], gravity: 520, shape: 'square', spin: 8 }); },
  poof(R, x, y) { R.parts.burst({ x, y, count: 14, speed: [40, 160], life: [0.3, 0.6], size: [6, 12], colors: ['#c9c2dc', '#a89fc2', '#ffffff'], drag: 3, shape: 'square' }); },
  word(R, x, y, text, color = '#ffffff', size = 22) { R.text.add({ x, y, text, color, size, life: 1.2, rise: 54 }); },
};
