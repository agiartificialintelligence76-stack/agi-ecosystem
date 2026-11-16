// GOING LIVE: the picture. Her room is drawn in art pixels on a canvas of its own (the walls and floor, the things on
// the wall, the rugs, soft shadows, then everything standing on the floor and everyone walking about, nearest last), then
// scaled onto the page by a whole number of screen pixels so every art pixel stays a crisp square. Between streams the
// room fills the screen’s height and scrolls sideways (drag it, or it glides to her); live, her stream: her room at her
// desk and her face cam. At night (her player’s clock) the room’s darker and her lamps glow. A second canvas over the
// page carries what flies: hearts, sparkles, the views she earns.
import { fitCanvas } from '../kit/canvas.js';
import { Particles, FloatText } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { itemOf, homeOf } from './data.js';
import { layer, canPlace, deskSpot } from './room.js';
import { CELL, ROW, WROW, INK, roomGeom, roomSprite, itemSprite, framesOf, herSprite, bustSprite, petSprite, botSprite, droneSprite, emoteSprite, HER } from './pixel.js';
import { herPose, petPose, droneAt } from './actor.js';
import { useOf } from './uses.js';

const bufferOf = (w, h) => { if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function createRenderer(canvas, top) {
  const view = fitCanvas(canvas, { maxDpr: 3 });
  const over = fitCanvas(top, { maxDpr: 2 });
  return {
    view, over, rect: { x: 0, y: 0, w: 1, h: 1, round: 0 }, band: { top: 0, bottom: 0, left: 0, right: 0 }, fit: false, buf: null, bw: 0, bh: 0, cam: null,
    pan: { x: 0, v: 0, target: null, held: false }, vx: 0, vw: 1, parts: new Particles(420), text: new FloatText(), t: 0, hits: [], bump: null,
  };
}
export function setRect(R, r, band = null) { R.rect = { x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h), round: r.round || 0 }; if (band) R.band = band; }
export function update(R, dt) {
  R.t += dt; R.parts.update(dt); R.text.update(dt);
  const p = R.pan;
  if (p.target != null && !p.held) { const d = p.target - p.x; p.x += d * Math.min(1, dt * 6); if (Math.abs(d) < 0.5) p.target = null; }
  else if (!p.held && Math.abs(p.v) > 1) { p.x += p.v * dt; p.v *= Math.exp(-dt * 5); } else if (!p.held) p.v = 0;
  if (R.bump) { R.bump.t += dt; if (R.bump.t > 0.4) R.bump = null; }
}
// the room’s scale and where it sits: art pixels → the page (CSS pixels). Her room fills the height between the HUD’s
// bars (`band`: what they cover, CSS pixels); zoomed out (`fit`), the whole room fits.
function camera(R, G, mode) {
  const d = R.view.dpr, r = R.rect, b = mode === 'room' ? R.band : { top: 0, bottom: 0, left: 0, right: 0 };
  const avail = Math.max(40, r.h - b.top - b.bottom), availW = Math.max(40, r.w - (b.left || 0) - (b.right || 0));
  const byH = (avail * d) / G.H, byW = (availW * d) / G.W;
  // (behind the title: smaller, so it reads as her room)
  const k = Math.max(1, Math.floor(mode === 'room' && R.fit ? Math.min(byH, byW) : mode === 'title' ? byH * 0.62 : byH)), s = k / d;
  const vw = availW / s, wide = G.W > vw + 0.5;
  const p = R.pan;
  if (mode === 'live') { const desk = R.deskX ?? G.W / 2; p.x = desk - vw / 2; }
  if (mode === 'title') p.x = (G.W - vw) * (0.5 + 0.45 * Math.sin(R.t * 0.08));
  const max = Math.max(0, G.W - vw);
  if (p.x < 0 || p.x > max) { p.x = Math.max(0, Math.min(max, p.x)); p.v = 0; }
  if (p.target != null) p.target = Math.max(0, Math.min(max, p.target));
  const ox = wide ? r.x + (b.left || 0) - p.x * s : r.x + (b.left || 0) + (availW - G.W * s) / 2;
  const oy = r.y + b.top + (avail - G.H * s) / 2;
  R.vx = wide ? p.x : 0; R.vw = Math.min(G.W, vw);
  return { k, s, ox: Math.round(ox * d) / d, oy: Math.round(oy * d) / d, wide };
}
export const toScreen = (R, ax, ay) => (R.cam ? { x: R.cam.ox + ax * R.cam.s, y: R.cam.oy + ay * R.cam.s } : { x: 0, y: 0 });
export const toArt = (R, sx, sy) => (R.cam ? { x: (sx - R.cam.ox) / R.cam.s, y: (sy - R.cam.oy) / R.cam.s } : { x: -1, y: -1 });
// drag the room sideways (CSS pixels), let it glide, or bring something into view
export function panBy(R, dx) { if (R.cam) { R.pan.x -= dx / R.cam.s; R.pan.target = null; } }
export function fling(R, vx) { if (R.cam) R.pan.v = -vx / R.cam.s; }
export function panTo(R, ax, { ifHidden = false } = {}) {
  if (!R.cam || !R.cam.wide) return;
  if (ifHidden && ax > R.vx + R.vw * 0.15 && ax < R.vx + R.vw * 0.85) return;
  R.pan.target = ax - R.vw / 2;
}
export const cellX = (G, x) => G.x0 + (x + 0.5) * CELL;
// tapped: the thing bounces
export function bump(R, uid) { R.bump = { uid, t: 0 }; }

// where things are, in art pixels
export function cellPos(G, x, y) { return { x: G.x0 + x * CELL, y: G.floorTop + y * ROW }; }
// a thing’s sprite and where its top-left goes
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
const drawSpr = (ctx, spr, x, y, flip = false, alpha = 1, squash = 0) => {
  if (!spr) return;
  ctx.globalAlpha = alpha;
  const w = spr.w + 2, h = spr.h + 2, sw = Math.round(w * (1 - squash * 0.08)), sh = Math.round(h * (1 + squash * 0.14));
  const dx = Math.round(x) - 1 + Math.round((w - sw) / 2), dy = Math.round(y) - 1 + (h - sh);
  if (flip) { ctx.save(); ctx.translate(dx + sw, 0); ctx.scale(-1, 1); ctx.drawImage(spr.canvas, 0, dy, sw, sh); ctx.restore(); } else ctx.drawImage(spr.canvas, dx, dy, sw, sh);
  ctx.globalAlpha = 1;
};
const shadow = (ctx, cx, y, rx, ry = 2) => {
  ctx.fillStyle = 'rgba(42,20,64,0.2)';
  for (let j = -ry; j <= ry; j++) { const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2))); ctx.fillRect(Math.round(cx - half), Math.round(y + j), half * 2, 1); }
};

// ---------- the room ----------
// `scene`: { night, edit, ghost: { id, x, y, on, flip, ok }, picked (uid being moved), frame, outfit, hide (her) }
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
  const sq = (uid) => (R.bump && R.bump.uid === uid ? Math.sin((R.bump.t / 0.4) * Math.PI) : 0);
  // the grid while decorating
  if (scene.edit || scene.ghost) {
    ctx.fillStyle = 'rgba(42,20,64,0.16)';
    for (let x = 0; x <= G.cols; x++) ctx.fillRect(G.x0 + x * CELL, G.floorTop, 1, G.rows * ROW);
    for (let y = 0; y <= G.rows; y++) ctx.fillRect(G.x0, G.floorTop + y * ROW, G.cols * CELL, 1);
    for (let x = 0; x <= G.cols; x++) ctx.fillRect(G.x0 + x * CELL, G.wallTop, 1, G.wall * WROW);
    for (let y = 0; y <= G.wall; y++) ctx.fillRect(G.x0, G.wallTop + y * WROW, G.cols * CELL, 1);
  }
  // wall things, then rugs; then soft shadows under what stands on the floor
  const list = [];
  for (const it of c.items) {
    if (it.uid === scene.picked) continue;
    const def = itemOf(it.id);
    if (def.pet) continue;
    const p = placeOf(c, G, it, fr(it.id), v);
    if (!p) continue;
    const s = sq(it.uid);
    if (p.base === -1 || p.base === -2) { drawSpr(ctx, p.spr, p.x, p.y, it.flip, 1, s); hits.push({ kind: 'item', uid: it.uid, x: p.x, y: p.y, w: p.spr.w, h: p.spr.h, z: p.base }); }
    else {
      if (layer(it) === 'floor') shadow(ctx, p.x + p.spr.w / 2, p.base - 1, p.spr.w * 0.46, Math.min(3, def.h * 2));
      list.push({ z: p.base + (layer(it) === 'top' ? 0.3 : 0), draw: () => drawSpr(ctx, p.spr, p.x, p.y, it.flip, 1, s), hit: { kind: 'item', uid: it.uid, x: p.x, y: p.y, w: p.spr.w, h: p.spr.h } });
    }
  }
  // her
  const h = A.her, task = h.task && h.task.started ? h.task : null;
  if (!scene.hide) {
    const pose = herPose(A), spr = herSprite(pose, scene.outfit || 0);
    const seat = h.sit && h.sit !== 'desk' ? c.items.find((x) => x.uid === h.sit) : null;
    const on = h.on ? c.items.find((x) => x.uid === h.on) : null;
    let x = G.x0 + (h.x + 0.5) * CELL - HER.fx, base = G.floorTop + (h.y + 1) * ROW - 2, z = base + 2;
    if (pose === 'sleep' && seat) { x = G.x0 + seat.x * CELL + 2; base = G.floorTop + (seat.y + itemOf(seat.id).h) * ROW - 6; z = base + 6.2; }
    else if (seat) { if (pose === 'sit' || pose === 'talk') base -= 3; z = G.floorTop + (seat.y + itemOf(seat.id).h) * ROW + 0.2; }
    if (on) { const od = itemOf(on.id), ob = G.floorTop + (on.y + od.h) * ROW; x = G.x0 + (on.x + od.w / 2) * CELL - HER.fx; base = ob - (on.id === 'treadmill' ? 7 : on.id === 'slide' ? 20 : 4); z = ob + 0.5; }
    const shown = pose !== 'hide';
    if (shown && !(pose === 'sleep' && seat) && !on) shadow(ctx, x + HER.fx, base, 5, 1);
    const flip = h.face < 0 && (pose.startsWith('walk') || pose.startsWith('run'));
    if (shown) list.push({ z, her: true, draw: (alpha = 1) => drawSpr(ctx, spr, x, base - spr.h, flip, alpha), hit: { kind: 'her', x: x + 3, y: base - spr.h + 2, w: spr.w - 6, h: spr.h - 2 } });
    // what she’s doing, over her head
    if (h.emote && task) {
      const e = emoteSprite(h.emote), bob = REDUCED ? 0 : Math.round(Math.sin(t * 4) * 1.5), rise = h.emote === 'zzz' || h.emote === 'note' || h.emote === 'steam' ? Math.floor((t * 6) % 6) : 0;
      if (e) list.push({ z: 9999, draw: () => drawSpr(ctx, e, x + HER.fx - 4, base - HER.h - 9 + bob - rise + (pose === 'sleep' ? 10 : 0), false, 0.95) });
    }
  }
  // her pets, the bots
  for (const p of A.pets.values()) {
    if (scene.picked === p.uid) continue;
    const spr = petSprite(p.id, petPose(p));
    const x = G.x0 + (p.x + 0.5) * CELL - spr.w / 2, base = G.floorTop + (p.y + 1) * ROW - 1;
    shadow(ctx, x + spr.w / 2, base, spr.w * 0.4, 1);
    list.push({ z: base + 1, draw: () => drawSpr(ctx, spr, x, base - spr.h, p.face < 0, p.id === 'holocat' ? 0.8 : 1, sq(p.uid)), hit: { kind: 'pet', uid: p.uid, x: x - 2, y: base - spr.h - 2, w: spr.w + 4, h: spr.h + 4 } });
  }
  for (const b of A.bots.values()) {
    const spr = botSprite(Math.floor(t * 6 + b.id) % 2);
    const x = G.x0 + (b.x + 0.5) * CELL - spr.w / 2, base = G.floorTop + (b.y + 1) * ROW - 1;
    shadow(ctx, x + spr.w / 2, base, 4, 1);
    list.push({ z: base + 1, draw: () => drawSpr(ctx, spr, x, base - spr.h, b.face < 0, b.leaving ? 0.6 : 1), hit: { kind: 'bot', id: b.id, x: x - 4, y: base - spr.h - 4, w: spr.w + 8, h: spr.h + 8 } });
  }
  list.sort((a, b) => a.z - b.z);
  for (const e of list) { e.draw(); if (e.hit) hits.push({ ...e.hit, z: e.z }); }
  // she’s never lost behind her things: mostly hidden behind something nearer (a counter, a bookshelf), she shows
  // through it, faintly
  const me = list.findIndex((e) => e.her);
  if (me >= 0) {
    const a = list[me].hit, area = a.w * a.h;
    let hid = 0;
    for (let i = me + 1; i < list.length; i++) {
      const b = list[i].hit;
      if (!b || b.kind !== 'item') continue;
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 0 && hh > 0) hid = Math.max(hid, (w * hh) / area);
    }
    if (hid > 0.45) list[me].draw(0.42);
  }
  // what’s being placed: a ghost on its cells, green where it fits
  if (scene.ghost) drawGhost(ctx, c, G, scene.ghost, v);
  // the drone, across what’s in view
  const dk = droneAt(A);
  if (dk >= 0) {
    const spr = droneSprite(Math.floor(t * 12) % 2), x = R.vx - 20 + dk * (R.vw + 40), y = G.wallTop + 10 + Math.sin(t * 5) * 2;
    drawSpr(ctx, spr, x, y);
    hits.push({ kind: 'drone', x: x - 8, y: y - 8, w: spr.w + 16, h: spr.h + 16, z: 999 });
  }
  // night: darker, and her lamps glow
  if (scene.night) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#9d95dc'; ctx.fillRect(0, 0, G.W, G.H);
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
  const desk = deskSpot(c);
  R.deskX = desk ? G.x0 + (desk.x + 0.5) * CELL : G.W / 2;
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
// `mode`: ’room’ (her room, scrolling), ’live’ (her stream: her desk, her face cam), ’title’ (the room, dimmed, drifting)
export function draw(R, c, A, scene, mode = 'room') {
  const G = drawRoom(R, c, A, scene);
  const ctx = R.view.begin(), d = R.view.dpr, r = R.rect;
  ctx.save();
  ctx.beginPath();
  if (r.round && ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, r.round); else ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  // the backdrop beyond the room: her wall’s colour, darker
  const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  bg.addColorStop(0, '#2a1440'); bg.addColorStop(1, mode === 'live' ? '#1d1238' : '#1a0f33');
  ctx.fillStyle = bg; ctx.fillRect(r.x, r.y, r.w, r.h);
  const cam = camera(R, G, mode);
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
  const spr = bustSprite(pose, scene.outfit || 0);
  const k = Math.max(2, Math.floor((Math.min(r.h * 0.42, r.w * 0.3) * d) / 34)), s = k / d, size = 34 * s;
  const pad = 6, fx0 = r.x + r.w - size - pad * 2 - 10, fy0 = r.y + r.h - size - pad - 10;
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
  const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,30,0.4)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
// what’s under a point on the page: the drone, a bot, a pet, her, a thing (the nearest first)
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
// a thing’s middle on the page (for sparkles, and bringing it into view)
export function itemAt(R, c, it) {
  const G = roomGeom(homeOf(c)), def = itemOf(it.id), L = layer(it);
  const ax = G.x0 + (it.x + def.w / 2) * CELL;
  const ay = L === 'wall' ? G.wallTop + (it.y + def.h / 2) * WROW : G.floorTop + (it.y + def.h / 2) * ROW - 8;
  return { ax, ay, ...toScreen(R, ax, ay) };
}
void useOf;

// ---------- what flies ----------
export const fx = {
  hearts(R, x, y, n = 10) { R.parts.burst({ x, y, count: n, speed: [60, 220], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [0.6, 1.1], size: [7, 13], colors: ['#ff4da6', '#ff8ac0', '#b79cff'], gravity: 120, shape: 'star', spin: 3, stroke: INK }); },
  sparkle(R, x, y, colors = ['#ffd84a', '#ffffff', '#7fe0ff']) { R.parts.burst({ x, y, count: 14, speed: [80, 260], life: [0.35, 0.7], size: [3, 7], colors, shape: 'spark' }); },
  confetti(R, x, y) { R.parts.burst({ x, y, count: 46, speed: [160, 520], angle: [-Math.PI, 0], life: [0.8, 1.6], size: [5, 10], colors: ['#ff4da6', '#ffd84a', '#2fd6a6', '#6b74ff', '#ffffff'], gravity: 520, shape: 'square', spin: 8 }); },
  poof(R, x, y) { R.parts.burst({ x, y, count: 14, speed: [40, 160], life: [0.3, 0.6], size: [6, 12], colors: ['#c9c2dc', '#a89fc2', '#ffffff'], drag: 3, shape: 'square' }); },
  word(R, x, y, text, color = '#ffffff', size = 22) { R.text.add({ x, y, text, color, size, life: 1.2, rise: 54 }); },
};
