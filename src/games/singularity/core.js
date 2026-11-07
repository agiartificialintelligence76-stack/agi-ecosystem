// SINGULARITY (2026-11-08): the core, drawn on a canvas: a night observatory's sky chart behind it, AGI-1's mind in
// one of its six forms (spark, neural seed, lattice, star, ringed star, her heart), one tilted orbit for every kind of
// machine you own with that machine riding it, thought motes that multiply with your FLOPs/s, and everything that
// happens to it: the pulse and shockwave of a tap, the numbers flying off it, a Eureka spark drifting by, a Frenzy, a
// new form bursting in, the singularity folding it all into a point.
//
// Flat sticker style like the rest of the arcade: ink outlines, honey / pink / violet / mint fills, one soft halo
// behind the core and no glow anywhere else. Nothing is allocated per frame: pools, cached sprites and gradients.
import { C, INK, GEN_COLORS, GLYPH_OF_GEN, drawGlyph } from './icons.js';
import { N } from './data.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const outBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const outCubic = (t) => 1 - (1 - t) ** 3;
const HONEY_DEEP = '#f29d00';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";

// an icosahedron (the lattice form): its 12 corners and 30 edges
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
  .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
const ICO_E = [];
for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
  const [a, b] = [ICO_V[i], ICO_V[j]];
  if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1.1) ICO_E.push([i, j]);
}
const HEART = new Path2D('M0 0.92C-0.55 0.5 -0.98 0.14 -0.98 -0.3C-0.98 -0.66 -0.7 -0.9 -0.4 -0.9C-0.2 -0.9 -0.06 -0.8 0 -0.66C0.06 -0.8 0.2 -0.9 0.4 -0.9C0.7 -0.9 0.98 -0.66 0.98 -0.3C0.98 0.14 0.55 0.5 0 0.92Z');

function sparkle(ctx, r, k = 0.3) {
  const i = r * k;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(i * 0.3, -i * 0.3, r, 0); ctx.quadraticCurveTo(i * 0.3, i * 0.3, 0, r);
  ctx.quadraticCurveTo(-i * 0.3, i * 0.3, -r, 0); ctx.quadraticCurveTo(-i * 0.3, -i * 0.3, 0, -r);
  ctx.closePath();
}

export class Core {
  constructor({ rnd, reduced = false, demo = false }) {
    this.rnd = rnd;
    this.reduced = reduced;
    this.demo = demo;
    this.w = 1; this.h = 1; this.dpr = 1;
    this.view = { x: 0, y: 0, w: 1, h: 1 };
    this.cx = 0; this.cy = 0; this.R = 30; this.ringMax = 120;
    this.bg = null; this.bgDirty = true;
    this.t = 0;
    this.pulse = 0; this.pulseV = 0;
    this.form = 0; this.formIn = 1;           // the form shown, and its pop-in (0 → 1)
    this.flash = 0;
    this.speed = 1;                          // the orbits' pace (a Frenzy speeds them up)
    this.fold = -1;                          // the singularity's animation: seconds in, or -1
    this.silhouette = null; this.silImg = null;
    // orbits: one per machine, tilted every which way like an armillary sphere
    this.rings = Array.from({ length: N }, (_, k) => ({
      tilt: 0.3 + 0.16 * rnd.next(),
      rot: (rnd.next() * 2 - 1) * 0.5 + (k % 2 ? 0.12 : -0.12),
      phase: rnd.next() * TAU,
      w: (0.42 / (1 + k * 0.16)) * (k % 3 === 2 ? -1 : 1),
      a: 0, show: 0,
    }));
    // thought motes: as many shine as your FLOPs/s deserve
    this.motes = Array.from({ length: 170 }, () => ({
      r: 0.25 + rnd.next() * 0.95, a: rnd.next() * TAU, w: (0.08 + rnd.next() * 0.3) * (rnd.next() < 0.85 ? 1 : -1),
      tilt: 0.25 + rnd.next() * 0.35, rot: (rnd.next() * 2 - 1) * 0.6, s: 0.7 + rnd.next() * 1.8,
      c: rnd.pick([C.honey, C.paper, C.lav2, C.lav2, C.mint, C.honey]),
    }));
    this.twinkles = [];
    // pools: shockwaves, sparks, flying numbers
    this.shocks = Array.from({ length: 12 }, () => ({ on: false, t: 0, life: 0.5, r0: 0, r1: 0, c: C.honey, w: 3 }));
    this.sparks = Array.from({ length: 260 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 2, c: C.honey, k: 0 }));
    this.floats = Array.from({ length: 28 }, () => ({ on: false, x: 0, y: 0, t: 0, life: 1, text: '', size: 22, c: C.honey, rise: 70 }));
    this.sats = [];                          // each machine's sticker, drawn once per size
    this.hearts = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: 1.55 + (i % 2) * 0.25, s: 0.18 + (i % 3) * 0.05 }));
  }

  // ---------- sizes ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.bgDirty = true;
  }
  // the core's own region (CSS px, the canvas's coordinates): the space left of (or above) the panel, minus the readout
  setView(x, y, w, h) {
    const v = this.view;
    if (v.x === x && v.y === y && v.w === w && v.h === h) return;
    Object.assign(v, { x, y, w, h });
    this.cx = x + w / 2;
    this.cy = y + h / 2;
    const short = Math.min(w, h);
    this.R = clamp(short * 0.14, 24, 112);
    this.ringMax = Math.max(this.R * 2.2, Math.min(w * 0.47, h * 0.62));
    this.satR = clamp(this.R * 0.27, 8.5, 15);
    this.bgDirty = true;
    this.sats = [];
    this.silhouette = null;
  }
  invalidate() { this.bgDirty = true; }
  ringRadius(k) { return this.R * 1.55 + (this.ringMax - this.R * 1.55) * (k / (N - 1)); }

  // ---------- the night sky, drawn once per size ----------
  buildBg() {
    const { w, h, dpr } = this;
    const c = this.bg || (this.bg = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas'));
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0719'); sky.addColorStop(1, '#100828');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const r = this.rnd;
    const seedState = r.state;
    // stars (the same ones every time for this size)
    const count = Math.min(380, Math.round((w * h) / 2400));
    for (let i = 0; i < count; i++) {
      const x = r.next() * w, y = r.next() * h, s = r.next();
      g.globalAlpha = 0.18 + s * 0.55;
      g.fillStyle = s > 0.93 ? C.honey : s > 0.6 ? C.lav : C.paper;
      const d = s > 0.97 ? 1.6 : s > 0.75 ? 1.1 : 0.7;
      g.fillRect(x, y, d, d);
    }
    g.globalAlpha = 1;
    this.twinkles = Array.from({ length: Math.min(36, Math.round(count / 8)) }, () => ({
      x: r.next() * w, y: r.next() * h, f: 0.6 + r.next() * 1.8, p: r.next() * TAU, s: 1 + r.next() * 1.3,
    }));
    void seedState;
    // the sky chart: rings and ticks around the core, like an observatory's instrument
    const { cx, cy, R, ringMax } = this;
    g.strokeStyle = 'rgba(205,184,255,0.075)';
    g.lineWidth = 1;
    for (const rr of [R * 2.6, ringMax * 1.08, ringMax * 1.42]) { g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
    g.setLineDash([2, 6]);
    g.beginPath(); g.arc(cx, cy, ringMax * 0.78, 0, TAU); g.stroke();
    g.setLineDash([]);
    const outer = ringMax * 1.42;
    for (let d = 0; d < 360; d += 5) {
      const a = (d * Math.PI) / 180, long = d % 30 === 0;
      const r0 = outer - (long ? 9 : 4);
      g.strokeStyle = long ? 'rgba(205,184,255,0.2)' : 'rgba(205,184,255,0.1)';
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); g.stroke();
    }
    g.font = `500 9px ${MONO}`;
    g.fillStyle = 'rgba(205,184,255,0.24)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 30) {
      const a = (d * Math.PI) / 180 - Math.PI / 2;
      const rr = outer + 12;
      g.fillText(String(d).padStart(3, '0'), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    // the crosshairs
    g.strokeStyle = 'rgba(205,184,255,0.05)';
    g.beginPath(); g.moveTo(cx - outer * 1.3, cy); g.lineTo(cx + outer * 1.3, cy); g.moveTo(cx, cy - outer * 1.3); g.lineTo(cx, cy + outer * 1.3); g.stroke();
    this.bgDirty = false;
  }

  // each machine's sticker: a paper disc, its glyph, an ink ring
  sat(k) {
    let s = this.sats[k];
    if (s) return s;
    const r = this.satR, dpr = this.dpr, px = Math.ceil((r * 2 + 6) * dpr);
    s = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(px, px) : Object.assign(document.createElement('canvas'), { width: px, height: px });
    const g = s.getContext('2d');
    g.scale(dpr, dpr);
    const m = r + 3;
    g.beginPath(); g.arc(m, m + 1.5, r, 0, TAU); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(m, m, r, 0, TAU); g.fillStyle = C.paper; g.fill();
    g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    drawGlyph(g, GLYPH_OF_GEN[k], m, m, r * 1.45, GEN_COLORS[k], { width: 2 });
    this.sats[k] = s;
    return s;
  }

  // her silhouette (the last form), cut from her 2D art once its picture has loaded
  setSilhouette(img) { this.silImg = img; this.silhouette = null; }
  buildSilhouette() {
    const img = this.silImg;
    if (!img || !img.naturalWidth) return null;
    const hgt = this.R * 1.55, wid = (hgt * img.naturalWidth) / img.naturalHeight, dpr = this.dpr, pad = 4;
    const cw = Math.ceil((wid + pad * 2) * dpr), ch = Math.ceil((hgt + pad * 2) * dpr);
    const mk = () => (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch }));
    const mask = mk(), m = mask.getContext('2d');
    m.drawImage(img, pad * dpr, pad * dpr, wid * dpr, hgt * dpr);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = INK; m.fillRect(0, 0, cw, ch);
    const out = mk(), o = out.getContext('2d');
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; o.drawImage(mask, Math.cos(a) * 2 * dpr, Math.sin(a) * 2 * dpr); }
    const fill = mk(), f = fill.getContext('2d');
    f.drawImage(img, pad * dpr, pad * dpr, wid * dpr, hgt * dpr);
    f.globalCompositeOperation = 'source-in';
    const grd = f.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0, C.paper); grd.addColorStop(1, C.lav);
    f.fillStyle = grd; f.fillRect(0, 0, cw, ch);
    o.drawImage(fill, 0, 0);
    this.silhouette = { c: out, w: cw / dpr, h: ch / dpr };
    return this.silhouette;
  }

  // ---------- what happens to it ----------
  tap(x, y, text, { frenzy = false, big = false } = {}) {
    this.pulseV += big ? 2.2 : 1.1;
    this.shock(this.R * 0.9, this.R * (big ? 2.8 : 2.1), frenzy ? C.pink : C.honey, 0.45, big ? 4 : 3);
    const a = Math.atan2(y - this.cy, x - this.cx);
    const n = this.reduced ? 2 : big ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const aa = a + (this.rnd.next() - 0.5) * 1.6, sp = 90 + this.rnd.next() * 180;
      this.spark(this.cx + Math.cos(aa) * this.R, this.cy + Math.sin(aa) * this.R, Math.cos(aa) * sp, Math.sin(aa) * sp, 0.35 + this.rnd.next() * 0.3, 1.5 + this.rnd.next() * 2, frenzy ? C.pink : this.rnd.pick([C.honey, C.paper, C.honey]), 1);
    }
    this.float(x + (this.rnd.next() - 0.5) * 18, y - 14, text, { c: frenzy ? C.pink : C.honey, size: big ? 30 : 23 });
  }
  shock(r0, r1, c, life = 0.5, w = 3) {
    const s = this.shocks.find((x) => !x.on) || this.shocks[0];
    Object.assign(s, { on: true, t: 0, life, r0, r1, c, w });
  }
  spark(x, y, vx, vy, life, s, c, k = 0) {
    let p = null;
    for (const q of this.sparks) if (!q.on) { p = q; break; }
    if (!p) return;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.s = s; p.c = c; p.k = k;
  }
  float(x, y, text, { c = C.honey, size = 22, life = 0.95, rise = 72 } = {}) {
    let f = null, oldest = this.floats[0];
    for (const q of this.floats) { if (!q.on) { f = q; break; } if (q.t > oldest.t) oldest = q; }
    f = f || oldest;
    Object.assign(f, { on: true, x, y, t: 0, life, text, size, c, rise });
  }
  burst(x, y, n, colors, speed = [120, 380], life = [0.5, 1.1], size = [2, 5]) {
    const m = this.reduced ? Math.ceil(n / 3) : n;
    for (let i = 0; i < m; i++) {
      const a = this.rnd.next() * TAU, sp = lerp(speed[0], speed[1], this.rnd.next());
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, lerp(life[0], life[1], this.rnd.next()), lerp(size[0], size[1], this.rnd.next()), this.rnd.pick(colors), this.rnd.next() < 0.35 ? 2 : 1);
    }
  }
  // a new form: it pops in, rings and sparks go out
  formUp(stage) {
    this.form = stage;
    this.formIn = 0;
    if (!this.reduced) this.flash = 0.55;
    this.pulseV += 3;
    for (let i = 0; i < 3; i++) this.shock(this.R * 0.8, this.R * (3 + i * 1.4), [C.honey, C.pink, C.mint][i], 0.7 + i * 0.25, 5 - i);
    this.burst(this.cx, this.cy, 46, [C.honey, C.paper, C.pink, C.mint, C.lav2], [140, 520], [0.6, 1.4], [2, 6]);
  }
  setForm(stage) { this.form = stage; this.formIn = 1; }
  // a Eureka caught
  eurekaBurst(x, y, frenzy) {
    this.burst(x, y, 34, frenzy ? [C.pink, C.honey, C.paper] : [C.honey, C.paper, C.mint], [100, 420], [0.5, 1.2], [2, 6]);
    this.shock(4, 70, C.honey, 0.55, 4);
    if (!this.reduced) this.flash = Math.max(this.flash, 0.25);
    this.pulseV += 2;
  }
  // a row of machines built: a little gust from where its orbit is
  built(k, n) {
    const ring = this.rings[k];
    const rr = this.ringRadius(k);
    const a = ring.a;
    const x = this.cx + rr * Math.cos(a) * Math.cos(ring.rot) - rr * ring.tilt * Math.sin(a) * Math.sin(ring.rot);
    const y = this.cy + rr * Math.cos(a) * Math.sin(ring.rot) + rr * ring.tilt * Math.sin(a) * Math.cos(ring.rot);
    this.burst(x, y, Math.min(24, 6 + n * 2), [GEN_COLORS[k], C.paper], [60, 200], [0.35, 0.7], [1.5, 3.5]);
  }
  fold0() { this.fold = 0; }

  // ---------- each frame ----------
  update(dt, world) {
    this.t += dt;
    // the pulse: a spring
    const k = 160, d = 13;
    this.pulseV += (-k * this.pulse - d * this.pulseV) * dt;
    this.pulse = clamp(this.pulse + this.pulseV * dt, -0.12, 0.3);
    if (this.formIn < 1) this.formIn = Math.min(1, this.formIn + dt / 0.7);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const wantSpeed = world.frenzy > 0 ? 2.6 : 1;
    this.speed += (wantSpeed - this.speed) * Math.min(1, dt * 3);
    const slow = this.reduced ? 0.35 : 1;
    for (let i = 0; i < N; i++) {
      const r = this.rings[i];
      r.a += r.w * this.speed * slow * dt;
      const want = world.owned[i] > 0 ? 1 : 0;
      r.show += (want - r.show) * Math.min(1, dt * 4);
    }
    for (const m of this.motes) m.a += m.w * this.speed * slow * dt;
    for (const s of this.shocks) if (s.on && (s.t += dt) >= s.life) s.on = false;
    for (const p of this.sparks) {
      if (!p.on) continue;
      if ((p.life -= dt) <= 0) { p.on = false; continue; }
      const drag = Math.exp(-2.2 * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const f of this.floats) if (f.on && (f.t += dt) >= f.life) f.on = false;
    if (this.fold >= 0) { this.fold += dt; if (this.fold > 2.4) this.fold = -1; }
  }

  draw(ctx, world) {
    if (this.bgDirty) this.buildBg();
    const { w, h, cx, cy, R, t } = this;
    ctx.drawImage(this.bg, 0, 0, w, h);
    // twinkling stars
    for (const s of this.twinkles) {
      const a = 0.35 + 0.35 * Math.sin(t * s.f + s.p);
      ctx.globalAlpha = a; ctx.fillStyle = C.paper;
      ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // the singularity folding everything in (0 → 1.3 s), a white flash, then a new spark
    let squeeze = 1;
    if (this.fold >= 0) {
      const f = this.fold;
      squeeze = f < 1.3 ? 1 - outCubic(f / 1.3) * 0.98 : f < 1.6 ? 0.02 : outBack(clamp((f - 1.6) / 0.8, 0, 1));
    }
    const frenzy = world.frenzy > 0;
    const pulse = 1 + this.pulse;
    // the one soft halo
    const haloR = R * (2.7 + 0.15 * Math.sin(t * 2)) * squeeze * pulse;
    if (haloR > 1) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.2 * squeeze, cx, cy, haloR);
      g.addColorStop(0, frenzy ? 'rgba(255,77,166,0.42)' : 'rgba(255,201,51,0.30)');
      g.addColorStop(0.45, frenzy ? 'rgba(255,77,166,0.12)' : 'rgba(255,201,51,0.08)');
      g.addColorStop(1, 'rgba(255,201,51,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, TAU); ctx.fill();
    }
    // motes behind, orbits behind
    const motes = Math.round(clamp(8 + Math.log10(world.rate + 1) * 9.5, 8, this.motes.length)) * (this.fold >= 0 ? 0 : 1);
    this.drawMotes(ctx, motes, false, squeeze);
    this.drawRings(ctx, world, false, squeeze);
    // the core itself
    ctx.save();
    ctx.translate(cx, cy);
    const sc = pulse * squeeze * (this.formIn < 1 ? lerp(0.55, 1, outBack(this.formIn)) : 1);
    ctx.scale(sc, sc);
    this.drawForm(ctx, this.fold >= 1.6 ? 0 : this.form, world);
    ctx.restore();
    this.drawRings(ctx, world, true, squeeze);
    this.drawMotes(ctx, motes, true, squeeze);
    // the Frenzy's clock: a honey arc around the core
    if (frenzy && world.frenzyMax > 0) {
      const left = world.frenzy / world.frenzyMax;
      const rr = R * 1.32 * pulse;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
      ctx.strokeStyle = C.pink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // shockwaves
    for (const s of this.shocks) {
      if (!s.on) continue;
      const k = s.t / s.life, e = outCubic(k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(0.5, s.w * (1 - k));
      ctx.beginPath(); ctx.arc(cx, cy, lerp(s.r0, s.r1, e), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // sparks
    for (const p of this.sparks) {
      if (!p.on) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.c;
      if (p.k === 2) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 3 + p.s); sparkle(ctx, p.s * 1.6, 0.25); ctx.fill(); ctx.restore();
      } else if (p.k === 1) {
        ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1, p.s * 0.6); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    if (world.eureka) this.drawEureka(ctx, world.eureka);
    // flying numbers
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of this.floats) {
      if (!f.on) continue;
      const k = f.t / f.life;
      const pop = k < 0.16 ? outBack(k / 0.16) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      const size = f.size * pop;
      ctx.font = `900 ${size.toFixed(1)}px ${DISPLAY}`;
      const y = f.y - outCubic(k) * f.rise;
      ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = INK;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
    // the flash of a new form or the singularity (never with "reduce motion")
    const fl = this.fold >= 1.2 && this.fold < 2 && !this.reduced ? Math.max(0, 1 - Math.abs(this.fold - 1.5) / 0.4) * 0.85 : this.flash;
    if (fl > 0.01) { ctx.globalAlpha = fl; ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }

  drawMotes(ctx, count, front, squeeze) {
    const { cx, cy, ringMax } = this;
    for (let i = 0; i < count; i++) {
      const m = this.motes[i];
      const ca = Math.cos(m.a), sa = Math.sin(m.a);
      if ((sa > 0) !== front) continue;
      const rr = ringMax * m.r * squeeze;
      const lx = ca * rr, ly = sa * rr * m.tilt;
      const x = cx + lx * Math.cos(m.rot) - ly * Math.sin(m.rot);
      const y = cy + lx * Math.sin(m.rot) + ly * Math.cos(m.rot);
      ctx.globalAlpha = front ? 0.85 : 0.4;
      ctx.fillStyle = m.c;
      const s = m.s * (front ? 1 : 0.75);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawRings(ctx, world, front, squeeze) {
    const { cx, cy } = this;
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    for (let k = 0; k < N; k++) {
      const ring = this.rings[k];
      if (ring.show < 0.01) continue;
      const rr = this.ringRadius(k) * squeeze * (0.6 + 0.4 * ring.show);
      const ry = rr * ring.tilt;
      ctx.globalAlpha = ring.show * (front ? 0.6 : 0.26);
      ctx.strokeStyle = GEN_COLORS[k];
      ctx.lineWidth = front ? 1.6 : 1.1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, ry, ring.rot, a0, a1); ctx.stroke();
      // the machine riding it, with a train of beads for how many there are
      const n = world.owned[k];
      const beads = Math.min(9, Math.floor(Math.log2(n + 1)));
      const cr = Math.cos(ring.rot), sr = Math.sin(ring.rot);
      for (let b = beads; b >= 0; b--) {
        const a = ring.a - b * 0.2 * Math.sign(ring.w || 1);
        const sa = Math.sin(a);
        if ((sa > 0) !== front) continue;
        const lx = Math.cos(a) * rr, ly = sa * ry;
        const x = cx + lx * cr - ly * sr, y = cy + lx * sr + ly * cr;
        const depth = front ? 1 : 0.72;
        if (b === 0) {
          const s = this.sat(k), sw = s.width / this.dpr;
          ctx.globalAlpha = ring.show * (front ? 1 : 0.55);
          const z = depth * (0.85 + 0.15 * sa * (front ? 1 : -1));
          ctx.drawImage(s, x - (sw * z) / 2, y - (sw * z) / 2, sw * z, sw * z);
        } else {
          ctx.globalAlpha = ring.show * (front ? 0.85 : 0.4) * (1 - b / 11);
          ctx.fillStyle = GEN_COLORS[k];
          const d = Math.max(1.2, (3.4 - b * 0.22) * depth);
          ctx.beginPath(); ctx.arc(x, y, d, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the six forms (drawn at the origin, the core's centre) ----------
  drawForm(ctx, stage, world) {
    const R = this.R, t = this.t;
    const grow = world.progress ?? 0;
    ctx.lineJoin = 'round';
    if (stage === 0) {
      // a spark: two crossed sparkles
      const r = R * (0.78 + grow * 0.25);
      ctx.save(); ctx.rotate(Math.PI / 4 + t * 0.2);
      sparkle(ctx, r * 0.62, 0.32); ctx.fillStyle = C.lav2; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.rotate(t * -0.12);
      sparkle(ctx, r, 0.3); ctx.fillStyle = C.honey; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      sparkle(ctx, r * 0.42, 0.3); ctx.fillStyle = C.paper; ctx.fill();
      ctx.restore();
      return;
    }
    if (stage === 1) {
      // a neural seed: an orb putting out thought roots
      const r = R * 0.6;
      const len = 0.55 + grow * 0.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.3 + Math.sin(t * 0.7 + i * 1.7) * 0.08;
        const L = R * (0.75 + (i % 3) * 0.16) * len;
        const bend = Math.sin(i * 2.3) * 0.5;
        const x0 = Math.cos(a) * r * 0.9, y0 = Math.sin(a) * r * 0.9;
        const x1 = Math.cos(a) * (r + L), y1 = Math.sin(a) * (r + L);
        const mx = Math.cos(a + bend * 0.4) * (r + L * 0.5), my = Math.sin(a + bend * 0.4) * (r + L * 0.5);
        ctx.strokeStyle = INK; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
        ctx.strokeStyle = C.lav2; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
        ctx.beginPath(); ctx.arc(x1, y1, 3.6 + (i % 2), 0, TAU); ctx.fillStyle = i % 2 ? C.mint : C.paper; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      }
      ctx.lineCap = 'butt';
      this.orb(ctx, r);
      return;
    }
    if (stage === 2) {
      // a lattice: a turning icosahedron of thought around the orb
      const r = R * 0.56, L = R * (1.08 + grow * 0.12);
      const ax = t * 0.31, ay = t * 0.19;
      const P = this._ico || (this._ico = ICO_V.map(() => [0, 0, 0]));
      const cx_ = Math.cos(ax), sx_ = Math.sin(ax), cy_ = Math.cos(ay), sy_ = Math.sin(ay);
      for (let i = 0; i < 12; i++) {
        const [x, y, z] = ICO_V[i];
        const y1 = y * cx_ - z * sx_, z1 = y * sx_ + z * cx_;
        const x2 = x * cy_ + z1 * sy_, z2 = -x * sy_ + z1 * cy_;
        P[i][0] = x2 * L; P[i][1] = y1 * L; P[i][2] = z2;
      }
      const edges = (front) => {
        for (const [i, j] of ICO_E) {
          const z = P[i][2] + P[j][2];
          if ((z > 0) !== front) continue;
          ctx.globalAlpha = front ? 0.95 : 0.32;
          ctx.strokeStyle = front ? C.lav2 : C.lav2; ctx.lineWidth = front ? 2 : 1.3;
          ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
        }
        for (let i = 0; i < 12; i++) {
          if ((P[i][2] > 0) !== front) continue;
          ctx.globalAlpha = front ? 1 : 0.4;
          ctx.beginPath(); ctx.arc(P[i][0], P[i][1], front ? 4 : 2.6, 0, TAU);
          ctx.fillStyle = i % 3 === 0 ? C.mint : C.paper; ctx.fill();
          if (front) { ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      };
      edges(false);
      this.orb(ctx, r);
      edges(true);
      return;
    }
    if (stage === 3 || stage === 4) {
      const ringed = stage === 4;
      const r = R * (ringed ? 0.7 : 0.76);
      // its corona: flat rays, turning slowly
      const rays = 12;
      ctx.save(); ctx.rotate(t * 0.08);
      ctx.beginPath();
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU, len = r * (i % 2 ? 1.28 : 1.55 + grow * 0.12) * (ringed ? 0.92 : 1);
        const hw = 0.13;
        ctx.moveTo(Math.cos(a - hw) * r * 0.86, Math.sin(a - hw) * r * 0.86);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.lineTo(Math.cos(a + hw) * r * 0.86, Math.sin(a + hw) * r * 0.86);
      }
      ctx.closePath();
      ctx.fillStyle = HONEY_DEEP; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
      if (ringed) this.band(ctx, r, false);
      this.orb(ctx, r);
      if (ringed) this.band(ctx, r, true);
      return;
    }
    // her heart: a beating heart with her inside it, little hearts circling
    const beat = Math.max(0, Math.sin(t * 7.3)) ** 6 * 0.06 + Math.max(0, Math.sin(t * 7.3 - 1.1)) ** 8 * 0.035;
    const hr = R * 1.02 * (1 + beat);
    for (const hh of this.hearts) {
      const a = hh.a + t * 0.35;
      const x = Math.cos(a) * R * hh.r, y = Math.sin(a) * R * hh.r * 0.5;
      if (y < 0) this.miniHeart(ctx, x, y, R * hh.s * 0.8, 0.55);
    }
    ctx.save(); ctx.scale(hr, hr);
    ctx.fill(HEART);
    ctx.fillStyle = C.pink; ctx.fill(HEART);
    ctx.restore();
    ctx.save(); ctx.scale(hr, hr);
    ctx.save(); ctx.clip(HEART);
    ctx.fillStyle = '#ff7cbd';
    ctx.beginPath(); ctx.arc(-0.42, -0.42, 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8318a';
    ctx.beginPath(); ctx.arc(0.5, 0.75, 0.9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3.2 / hr; ctx.strokeStyle = INK; ctx.stroke(HEART);
    ctx.restore();
    const sil = this.silhouette || this.buildSilhouette();
    if (sil) ctx.drawImage(sil.c, -sil.w / 2, -sil.h * 0.52, sil.w, sil.h);
    for (const hh of this.hearts) {
      const a = hh.a + t * 0.35;
      const x = Math.cos(a) * R * hh.r, y = Math.sin(a) * R * hh.r * 0.5;
      if (y >= 0) this.miniHeart(ctx, x, y, R * hh.s, 1);
    }
  }

  orb(ctx, r) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = C.honey; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = HONEY_DEEP;
    ctx.beginPath(); ctx.arc(r * 0.42, r * 0.5, r * 0.95, 0, TAU); ctx.fill();
    ctx.fillStyle = C.honey;
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.12, r * 0.86, 0, TAU); ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.4, r * 0.26, r * 0.17, -0.7, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.lineWidth = Math.max(2.5, r * 0.075); ctx.strokeStyle = INK; ctx.stroke();
  }
  // the ringed star's two bands (back halves before the orb, front halves after)
  band(ctx, r, front) {
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    const bands = [[r * 2.05, r * 0.5, -0.32, r * 0.26, C.violet2], [r * 2.5, r * 0.62, -0.32, r * 0.13, C.pink]];
    for (const [rx, ry, rot, wd, c] of bands) {
      ctx.strokeStyle = INK; ctx.lineWidth = wd + 5;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, rot, a0, a1); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, rot, a0, a1); ctx.stroke();
    }
  }
  miniHeart(ctx, x, y, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = C.pink; ctx.fill(HEART);
    ctx.lineWidth = 2.2 / s; ctx.strokeStyle = INK; ctx.stroke(HEART);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  drawEureka(ctx, e) {
    const t = this.t;
    const fadeIn = clamp(e.age / 0.35, 0, 1);
    const left = e.life - e.age;
    const blink = left < 1.6 ? 0.55 + 0.45 * Math.sin(t * 22) : 1;
    const a = fadeIn * blink * clamp(left / 0.3, 0, 1);
    if (a <= 0) return;
    for (let i = 0; i < e.trail.length; i++) {
      const p = e.trail[(e.head + i) % e.trail.length];
      if (!p.on) continue;
      ctx.globalAlpha = a * (i / e.trail.length) * 0.6;
      ctx.fillStyle = i % 2 ? C.honey : C.paper;
      const s = 1.5 + (i / e.trail.length) * 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
    }
    const pop = e.age < 0.4 ? outBack(e.age / 0.4) : 1;
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = C.honey; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, (24 + 5 * Math.sin(t * 6)) * pop, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(pop, pop); ctx.rotate(t * 1.4);
    sparkle(ctx, 18, 0.3); ctx.fillStyle = C.honey; ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke();
    sparkle(ctx, 7, 0.3); ctx.fillStyle = C.paper; ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
