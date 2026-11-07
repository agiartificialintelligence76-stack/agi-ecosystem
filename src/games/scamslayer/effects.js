// SCAM SLAYER: everything that only looks and sounds like something (the rules are engine.js's): sliced halves flying
// apart, shards and sparks, paint splats on the wall, floating points and combo words, banners, flashes, the rug's
// carpet-unroll explosion, the shields cracking, AGI-1's face reacting and her speech bubble. World things are in world
// units (drawn under the world's scale), screen things (banners, flashes, the HUD's animations) in CSS pixels.
import { Particles, Shake, ease } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { KINDS } from './kinds.js';

const MAX_PIECES = 34, MAX_SPLATS = 14, MAX_FLOATS = 24;

export function createEffects() {
  const fx = {
    pieces: [], splats: [], floats: [], rings: [], banners: [],
    tags: [],                             // first-time labels riding on a sticker: { o, text, color, t, life, ghost }
    parts: new Particles(520),
    top: new Particles(140),             // sparks drawn over everything (crits, golden)
    shake: new Shake({ max: 16, decay: 2.2 }),
    flash: { a: 0, color: '#ffffff' },
    rug: null,                            // the rug's explosion: { x, y, r, t, final, dir }
    avatar: { mood: 'idle', t: 0, hold: 0, bump: 0 },
    bubble: null,                         // { text, t, life }
    shields: [0, 0, 0],                   // how long ago each shield cracked (for its animation), 0 = whole
    scorePop: 0, timerPop: 0,
    time: 0,
    reset() {
      for (const p of fx.pieces) fx.halves?.release(p.cv);
      fx.pieces.length = 0; fx.splats.length = 0; fx.floats.length = 0; fx.rings.length = 0; fx.banners.length = 0; fx.tags.length = 0;
      fx.parts.clear(); fx.top.clear();
      fx.flash.a = 0; fx.rug = null; fx.bubble = null;
      fx.avatar.mood = 'idle'; fx.avatar.hold = 0; fx.shields = [0, 0, 0];
    },
  };

  // ---------- making things ----------
  fx.addHalves = (e, sprites, halves) => {
    const o = e.o, sp = sprites?.[o.kind];
    if (!sp || !halves) return;
    fx.halves = halves;
    const k = KINDS[o.kind];
    const ux = Math.cos(e.ang), uy = Math.sin(e.ang), nx = -uy, ny = ux;
    const along = Math.min(420, (e.speed || 900) * 0.12);
    for (const side of [1, -1]) {
      while (fx.pieces.length >= MAX_PIECES) { const old = fx.pieces.shift(); halves.release(old.cv); }
      const cv = halves.make(sp, e.ang - o.rot, e.off, side, k.inner, sp.R / k.r);
      if (!cv) continue;
      const sep = 150 + Math.random() * 90;
      fx.pieces.push({
        cv, kind: o.kind, r: k.r,
        x: o.x, y: o.y,
        vx: o.vx * 0.55 + nx * side * sep + ux * along,
        vy: Math.min(o.vy * 0.55, 200) + ny * side * sep + uy * along - 120,
        g: o.g || 1400, rot: o.rot, spin: o.spin * 0.6 + side * (1.6 + Math.random() * 2.2), age: 0,
      });
    }
  };

  fx.splat = (x, y, color, r) => {
    if (fx.splats.length >= MAX_SPLATS) fx.splats.shift();
    fx.splats.push({ x, y, color, r, i: (Math.random() * 4) | 0, rot: Math.random() * Math.PI * 2, t: 0, life: 2.4, s: 0.9 + Math.random() * 0.35 });
  };

  fx.shards = (o, ang, n = 14) => {
    const c = KINDS[o.kind].colors;
    fx.parts.burst({ x: o.x, y: o.y, count: n, speed: [180, 620], life: [0.45, 0.95], size: [7, 15], colors: [c[0], c[1], c[0]], gravity: 1500, drag: 1.4, shape: 'square', spin: 14, stroke: '#170a36' });
    // sparks thrown along the blade
    fx.parts.burst({ x: o.x, y: o.y, count: 8, speed: [500, 1100], angle: [ang - 0.35, ang + 0.35], life: [0.18, 0.34], size: [4, 7], colors: ['#fffaf0', '#ffe28a'], gravity: 0, drag: 3, shape: 'spark' });
  };

  // floating words; a big one (a combo, the golden scam) replaces the big one before it, so they never pile up
  fx.float = (x, y, text, { size = 30, color = '#fffaf0', life = 0.85, rise = 70, big = false, delay = 0 } = {}) => {
    if (big) for (let i = fx.floats.length - 1; i >= 0; i--) if (fx.floats[i].big && fx.floats[i].max - fx.floats[i].life > 0.12) fx.floats.splice(i, 1);
    // a small word right where another one just appeared goes above it, not on top of it
    if (!big) {
      for (const f of fx.floats) {
        if (!f.big && f.max - f.life < 0.35 && Math.abs(f.x - x) < 90 && Math.abs(f.y - y) < size * 0.9) y = f.y - size * 1.05;
      }
    }
    if (fx.floats.length >= MAX_FLOATS) fx.floats.shift();
    fx.floats.push({ x, y, text: String(text), size, color, life, max: life, rise, big, delay });
  };
  // where floats may go (world units): under the HUD, inside the screen
  fx.bounds = { minY: 0, W: 600 };

  fx.ring = (x, y, color, max = 160, life = 0.45, width = 10) => fx.rings.push({ x, y, color, max, life, t: 0, width });

  // a label that rides on a sticker the first time a player meets its kind ("DON'T CUT!" on the first rug); `ghost`
  // also draws a blade streaking through it (the very first scam: how to slice)
  fx.tag = (o, text, color, { life = 2.6, ghost = false } = {}) => fx.tags.push({ o, text, color, t: 0, life, ghost });

  fx.banner = (text, sub = '', color = '#ffc933', life = 1.3) => {
    fx.banners.length = 0;
    fx.banners.push({ text, sub, color, t: 0, life });
  };

  fx.doFlash = (color, a = 0.6) => { if (REDUCED) return; fx.flash.color = color; fx.flash.a = Math.max(fx.flash.a, a); };

  fx.mood = (mood, hold = 1.4) => { fx.avatar.mood = mood; fx.avatar.hold = hold; fx.avatar.t = 0; fx.avatar.bump = 1; };

  fx.say = (text, life = 2.6) => { if (text) fx.bubble = { text, t: 0, life }; };

  fx.crack = (i) => { if (i >= 0 && i < fx.shields.length) fx.shields[i] = 0.0001; };

  fx.startRug = (o, final) => {
    const dir = o.x < 0 ? 1 : o.x > 1 ? -1 : 1;
    fx.rug = { x: o.x, y: o.y, r: o.r, t: 0, final, dir, rot: o.rot };
    fx.ring(o.x, o.y, '#ffc933', 330, 0.55, 18);
    fx.ring(o.x, o.y, '#ff5a5f', 220, 0.4, 12);
    fx.parts.burst({ x: o.x, y: o.y, count: 36, speed: [260, 900], life: [0.6, 1.3], size: [9, 20], colors: ['#ff5a5f', '#ffc933', '#c8343a', '#fffaf0'], gravity: 1300, drag: 1.2, shape: 'square', spin: 10, stroke: '#170a36' });
    fx.parts.burst({ x: o.x, y: o.y, count: 18, speed: [80, 260], life: [0.7, 1.2], size: [28, 54], colors: ['#3a2a5c', '#4a3d6e', '#2b1d4f'], gravity: -120, drag: 2.4, grow: 40 });
    fx.shake.kick(final ? 0.95 : 0.6);
    fx.doFlash('#ffe28a', final ? 0.72 : 0.5);
  };

  // ---------- each frame ----------
  fx.update = (dt, ts = 1, H = 1000) => {
    fx.time += dt;
    const sdt = dt * ts;
    for (let i = fx.pieces.length - 1; i >= 0; i--) {
      const p = fx.pieces[i];
      p.age += sdt;
      p.x += p.vx * sdt; p.y += p.vy * sdt + 0.5 * p.g * sdt * sdt; p.vy += p.g * sdt;
      p.rot += p.spin * sdt;
      if (p.y > H + p.r * 2.4 || p.age > 4) { fx.halves?.release(p.cv); fx.pieces.splice(i, 1); }
    }
    for (let i = fx.splats.length - 1; i >= 0; i--) { const s = fx.splats[i]; s.t += dt; if (s.t >= s.life) fx.splats.splice(i, 1); }
    for (let i = fx.floats.length - 1; i >= 0; i--) {
      const f = fx.floats[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.life -= dt; if (f.life <= 0) fx.floats.splice(i, 1);
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) { const r = fx.rings[i]; r.t += dt; if (r.t >= r.life) fx.rings.splice(i, 1); }
    for (let i = fx.banners.length - 1; i >= 0; i--) { const b = fx.banners[i]; b.t += dt; if (b.t >= b.life) fx.banners.splice(i, 1); }
    for (let i = fx.tags.length - 1; i >= 0; i--) { const g = fx.tags[i]; g.t += dt; if (g.t >= g.life || g.o.dead) fx.tags.splice(i, 1); }
    fx.parts.update(sdt);
    fx.top.update(dt);
    fx.shake.update(dt);
    fx.flash.a = Math.max(0, fx.flash.a - dt * 3.2);
    if (fx.rug) { fx.rug.t += dt; if (fx.rug.t > 2.2) fx.rug = null; }
    const a = fx.avatar;
    a.t += dt; a.bump = Math.max(0, a.bump - dt * 3.5);
    if (a.hold > 0) { a.hold -= dt; if (a.hold <= 0) a.mood = 'idle'; }
    if (fx.bubble) { fx.bubble.t += dt; if (fx.bubble.t >= fx.bubble.life) fx.bubble = null; }
    for (let i = 0; i < fx.shields.length; i++) if (fx.shields[i] > 0) fx.shields[i] += dt;
    fx.scorePop = Math.max(0, fx.scorePop - dt * 4);
    fx.timerPop = Math.max(0, fx.timerPop - dt * 3);
  };

  // ---------- drawing (world things, in world units: the caller set the world's transform) ----------
  fx.drawSplats = (ctx, splats) => {
    for (const s of fx.splats) {
      const k = s.t / s.life;
      const a = 0.5 * (k < 0.06 ? k / 0.06 : 1 - ease.inQuad(Math.max(0, (k - 0.35) / 0.65)));
      if (a <= 0.01) continue;
      const cv = splats.get(s.i, s.color);
      const size = s.r * 2.3 * s.s * (k < 0.08 ? 0.7 + 0.3 * ease.outBack(k / 0.08) : 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(s.x, s.y + ease.inQuad(k) * 26);
      ctx.rotate(s.rot);
      ctx.drawImage(cv, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  };

  fx.drawPieces = (ctx, pad) => {
    for (const p of fx.pieces) {
      const half = p.r * pad;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.age > 1.6) ctx.globalAlpha = Math.max(0, 1 - (p.age - 1.6) / 0.6);
      ctx.drawImage(p.cv, -half, -half, half * 2, half * 2);
      ctx.restore();
    }
  };

  fx.drawRings = (ctx) => {
    for (const r of fx.rings) {
      const k = r.t / r.life, e = ease.outCubic(k);
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = r.width * (1 - k) + 2;
      ctx.strokeStyle = '#170a36';
      ctx.beginPath(); ctx.arc(r.x, r.y, r.max * e, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(1, (r.width * (1 - k) + 2) * 0.55);
      ctx.strokeStyle = r.color; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  fx.drawFloats = (ctx) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of fx.floats) {
      if (f.delay > 0) continue;
      const t = 1 - f.life / f.max;
      const pop = t < 0.16 ? ease.outBack(t / 0.16, 2.4) : 1;
      const a = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      const size = f.size * pop;
      if (size < 1) continue;
      ctx.font = `900 ${size}px 'AK Display', 'Arial Black', system-ui, sans-serif`;
      const half = ctx.measureText(f.text).width / 2 + size * 0.2;
      const B = fx.bounds;
      const x = Math.max(half + 6, Math.min(B.W - half - 6, f.x));
      const y = Math.max(B.minY + f.size * 0.6, f.y - ease.outCubic(t) * f.rise);
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = size * (f.big ? 0.26 : 0.22);
      ctx.strokeStyle = '#170a36';
      ctx.fillStyle = '#170a36';
      ctx.fillText(f.text, x, y + size * 0.1);
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  };

  fx.drawTags = (ctx, t) => {
    for (const g of fx.tags) {
      const o = g.o;
      const a = Math.min(1, g.t / 0.15, (g.life - g.t) / 0.3);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      if (g.ghost) {
        // a ghost blade streaking through it, again and again
        const k = (g.t % 0.9) / 0.9, e = ease.inOutCubic(Math.min(1, k / 0.7));
        const ax = o.x - o.r * 1.9, ay = o.y + o.r * 1.1, bx = o.x + o.r * 1.9, by = o.y - o.r * 1.1;
        const hx = ax + (bx - ax) * e, hy = ay + (by - ay) * e;
        const tx = ax + (bx - ax) * Math.max(0, e - 0.35), ty = ay + (by - ay) * Math.max(0, e - 0.35);
        if (k < 0.75) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#170a36'; ctx.lineWidth = 15;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        }
      }
      // the label, bobbing over it
      const size = 24;
      ctx.font = `900 ${size}px 'AK Display', 'Arial Black', system-ui, sans-serif`;
      const w = ctx.measureText(g.text).width + size * 1.1, h = size * 1.45;
      const x = Math.max(w / 2 + 6, Math.min(fx.bounds.W - w / 2 - 6, o.x));
      // over it, or under it when it's up against the top
      const below = o.y - o.r * 1.55 < fx.bounds.minY + h;
      const y = (below ? o.y + o.r * 1.6 : o.y - o.r * 1.55) + Math.sin(t * 6) * 4;
      ctx.translate(x, y);
      const tipX = Math.max(-w / 2 + 14, Math.min(w / 2 - 14, o.x - x));
      ctx.beginPath();
      if (below) { ctx.moveTo(tipX - 9, -h / 2 + 2); ctx.lineTo(tipX, -h / 2 - 11); ctx.lineTo(tipX + 9, -h / 2 + 2); }
      else { ctx.moveTo(tipX - 9, h / 2 - 2); ctx.lineTo(tipX, h / 2 + 11); ctx.lineTo(tipX + 9, h / 2 - 2); }
      ctx.closePath();
      ctx.fillStyle = g.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#170a36'; ctx.stroke();
      const r = h / 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r); ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); ctx.closePath();
      ctx.fillStyle = '#170a36'; ctx.save(); ctx.translate(3, 4); ctx.fill(); ctx.restore();
      ctx.fillStyle = g.color; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#170a36'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.text, 0, size * 0.06);
      ctx.restore();
    }
  };

  return fx;
}
