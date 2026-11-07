// SCAM SLAYER: one frame. The room (two layers, a little parallax), the paint splats, the HUD (the score big at the top,
// the shields or the clock, the powers that are on, AGI-1's face and her bubble), the stickers in flight with their hard
// shadows, the halves, the shards, the blades, the floating words, and over everything the banners, the flashes, the
// frost of Freeze, the speed lines of Frenzy and the rug's carpet unrolling.
import { ease, clamp, fmt, fmtTime, roundRect } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { KINDS } from './kinds.js';
import { buildSprites, createHalves, createSplats, mk, INK, PAPER } from './art.js';
import { buildScene } from './scene.js';
import { bladePalette } from './blade.js';

const PAD = 1.42;
const MOOD_RING = { idle: '#cdb8ff', happy: '#3ff0c3', love: '#ff4da6', surprised: '#ffc933', sad: '#59c8ff' };
const FONT = "'AK Display', 'Arial Black', system-ui, sans-serif";

function shieldPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x - s * 0.44, y - s * 0.46);
  c.quadraticCurveTo(x, y - s * 0.6, x + s * 0.44, y - s * 0.46);
  c.lineTo(x + s * 0.44, y - s * 0.02);
  c.quadraticCurveTo(x + s * 0.4, y + s * 0.36, x, y + s * 0.56);
  c.quadraticCurveTo(x - s * 0.4, y + s * 0.36, x - s * 0.44, y - s * 0.02);
  c.closePath();
}
function heartAt(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.8);
  c.bezierCurveTo(x - s * 1.1, y + s * 0.1, x - s * 0.9, y - s * 0.9, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.9, y - s * 0.9, x + s * 1.1, y + s * 0.1, x, y + s * 0.8);
  c.closePath();
}

export function createRenderer() {
  const R = {
    scale: 1, dpr: 1, w: 1, h: 1, sprites: null, spriteKey: '', halves: createHalves(), splats: null,
    scene: null, sceneKey: '', frost: null, avatar: null, avatarImg: null, layout: null,
    par: { x: 0, y: 0 },
  };

  // AGI-1's face for the corner: a round crop of her 2D portrait (loaded once, same-origin)
  const img = new Image();
  img.decoding = 'async';
  img.src = '/images/agi1-live-2d.webp';
  img.onload = () => { R.avatarImg = img; R.avatar = null; };

  function buildAvatar(px) {
    if (!R.avatarImg) return null;
    const size = Math.round(px);
    const cv = mk(size, size);
    const c = cv.getContext('2d');
    c.beginPath(); c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#e4d9ff'; c.fillRect(0, 0, size, size);
    // her face in the 574 × 718 portrait: centred near (287, 318)
    const crop = 300, sx = 287 - crop / 2, sy = 318 - crop / 2 - 10;
    c.drawImage(R.avatarImg, sx, sy, crop, crop, 0, 0, size, size);
    return cv;
  }

  function buildFrost(w, h) {
    const k = 0.5;
    const cv = mk(w * k, h * k);
    const c = cv.getContext('2d');
    c.scale(k, k);
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(160,220,255,0)'); g.addColorStop(1, 'rgba(190,232,255,0.5)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // ice crystals in the corners
    c.strokeStyle = 'rgba(235,248,255,0.55)'; c.lineCap = 'round';
    const u = Math.min(w, h) / 600;
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      for (let i = 0; i < 7; i++) {
        const a = Math.atan2(h / 2 - cy, w / 2 - cx) + (i - 3) * 0.24;
        const len = (70 + ((i * 37) % 60)) * u;
        c.lineWidth = 3 * u;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        for (const f of [0.45, 0.7]) {
          const bx = cx + Math.cos(a) * len * f, by = cy + Math.sin(a) * len * f;
          c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.7) * len * 0.22, by + Math.sin(a + 0.7) * len * 0.22);
          c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.7) * len * 0.22, by + Math.sin(a - 0.7) * len * 0.22);
        }
        c.stroke();
      }
    }
    return cv;
  }

  // the screen changed (or the first frame): sizes, sprites, the room
  R.resize = (w, h, dpr, layout) => {
    R.w = w; R.h = h; R.dpr = dpr; R.layout = layout;
    R.scale = Math.min(w, h) / 600;
    const key = `${(R.scale * dpr).toFixed(3)}`;
    if (key !== R.spriteKey) {
      R.sprites = buildSprites(R.scale * dpr);
      R.splats = createSplats(80 * R.scale * dpr);
      R.spriteKey = key;
    }
    const skey = `${w}x${h}`;
    if (skey !== R.sceneKey) { R.scene = buildScene(w, h); R.frost = null; R.sceneKey = skey; }
    R.avatar = null;
  };
  R.refreshSprites = () => { R.spriteKey = ''; R.resize(R.w, R.h, R.dpr, R.layout); };

  // ---------- the parts of a frame ----------
  function drawRoom(ctx, s) {
    const sc = R.scene;
    if (!sc) { ctx.fillStyle = '#1c0e38'; ctx.fillRect(0, 0, R.w, R.h); return; }
    const m = sc.m;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const bx = R.par.x * m * 0.9, by = R.par.y * m * 0.6;
    ctx.drawImage(sc.back, -m + bx, -m + by, R.w + m * 2, R.h + m * 2);
    ctx.drawImage(sc.room, -m + bx * 0.35, -m + by * 0.35, R.w + m * 2, R.h + m * 2);
  }

  function drawObjects(ctx, world, t) {
    const sprites = R.sprites;
    if (!sprites) return;
    // shadows first (hard, down and right, like the arcade's stickers)
    ctx.globalAlpha = 0.42;
    for (const o of world.objs) {
      if (o.dead) continue;
      const sp = sprites[o.kind], half = o.r * PAD;
      ctx.save(); ctx.translate(o.x + 6, o.y + 9); ctx.rotate(o.rot);
      ctx.drawImage(sp.shadow, -half, -half, half * 2, half * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const o of world.objs) {
      if (o.dead) continue;
      const sp = sprites[o.kind], half = o.r * PAD;
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.role === 'power') {
        // a power scam: a ring of dashes turning around it
        ctx.save(); ctx.rotate(t * 1.6);
        ctx.setLineDash([9, 8]); ctx.lineWidth = 5; ctx.strokeStyle = KINDS[o.kind].colors[0];
        ctx.beginPath(); ctx.arc(0, 0, o.r * 1.32, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.rotate(o.rot);
      let s = 1;
      if (o.role === 'heart') s = 1 + 0.07 * Math.max(0, Math.sin(t * 9 + o.id)) ** 6;
      if (s !== 1) ctx.scale(s, s);
      ctx.drawImage(sp.canvas, -half, -half, half * 2, half * 2);
      if (o.kind === 'golden') {
        // a shine sweeping across it
        const k = ((t * 0.9 + o.id * 0.37) % 1.4) / 1.4;
        if (k < 0.5) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.restore(); ctx.save();
          ctx.translate(o.x, o.y); ctx.rotate(o.rot);
          ctx.globalAlpha = 0.6 * Math.sin((k / 0.5) * Math.PI);
          ctx.fillStyle = '#ffffff';
          const sx = -o.r + k * 4 * o.r;
          ctx.beginPath(); ctx.moveTo(sx, -o.r * 1.2); ctx.lineTo(sx + o.r * 0.28, -o.r * 1.2); ctx.lineTo(sx - o.r * 0.2, o.r * 1.1); ctx.lineTo(sx - o.r * 0.48, o.r * 1.1); ctx.closePath();
          ctx.save(); ctx.beginPath(); ctx.arc(0, -o.r * 0.15, o.r * 0.68, 0, Math.PI * 2); ctx.clip();
          ctx.beginPath(); ctx.moveTo(sx, -o.r * 1.2); ctx.lineTo(sx + o.r * 0.28, -o.r * 1.2); ctx.lineTo(sx - o.r * 0.2, o.r * 1.1); ctx.lineTo(sx - o.r * 0.48, o.r * 1.1); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (o.role === 'rug') {
        // the lit fuse: a flickering spark at its tip
        const fx = -1.0 * 1.12 * o.r, fy = -0.8 * 1.12 * o.r;
        const f = 0.75 + 0.35 * Math.sin(t * 41 + o.id) * Math.sin(t * 23);
        ctx.translate(fx, fy);
        ctx.rotate(t * 7);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rad = (i % 2 ? 0.16 : 0.42) * o.r * f; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        ctx.closePath();
        ctx.fillStyle = '#ffc933'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, o.r * 0.1 * f, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // the rug's carpet unrolling out of the explosion (world units)
  function drawRug(ctx, rug, world) {
    if (!rug) return;
    const t = rug.t;
    const u = clamp((t - 0.06) / 0.75, 0, 1), e = ease.outCubic(u);
    const pull = clamp((t - (rug.final ? 1.25 : 0.7)) / 0.35, 0, 1);
    const len = Math.max(world.W, world.H) * 1.4 * e;
    const wid = rug.r * 1.5;
    const a = Math.atan2(world.H * 1.2 - rug.y, (rug.x < world.W / 2 ? world.W * 1.1 : -world.W * 0.1) - rug.x);
    ctx.save();
    ctx.translate(rug.x, rug.y);
    ctx.rotate(a);
    ctx.translate(-ease.inCubic(pull) * len * 1.2, 0);
    if (len > 2) {
      // the carpet: red with honey zigzags and a paper border, fringe at its end
      ctx.fillStyle = INK;
      ctx.fillRect(-6, -wid / 2 - 6, len + 6, wid + 12);
      ctx.fillStyle = '#ff5a5f';
      ctx.fillRect(0, -wid / 2, len, wid);
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(0, -wid / 2 + wid * 0.08, len, wid * 0.06);
      ctx.fillRect(0, wid / 2 - wid * 0.14, len, wid * 0.06);
      ctx.strokeStyle = '#ffc933'; ctx.lineWidth = wid * 0.1; ctx.lineJoin = 'miter';
      ctx.beginPath();
      const step = wid * 0.42;
      for (let x = 0, i = 0; x < len; x += step, i++) ctx.lineTo(x, (i % 2 ? -1 : 1) * wid * 0.2);
      ctx.stroke();
      for (let x = step * 1.5; x < len - step; x += step * 3) {
        ctx.fillStyle = '#ffc933';
        ctx.beginPath(); ctx.moveTo(x, -wid * 0.32); ctx.lineTo(x + wid * 0.1, -wid * 0.24); ctx.lineTo(x, -wid * 0.16); ctx.lineTo(x - wid * 0.1, -wid * 0.24); ctx.fill();
      }
      ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const y = -wid / 2 + (i + 0.5) * (wid / 8); ctx.moveTo(-4, y); ctx.lineTo(-16, y); }
      ctx.stroke();
      // the roll at its leading end, shrinking as it unrolls
      const rr2 = wid * 0.5 * (1 - e * 0.6) + 4;
      ctx.translate(len, 0);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, rr2 * 0.62 + 4, wid / 2 + 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8343a'; ctx.beginPath(); ctx.ellipse(0, 0, rr2 * 0.62, wid / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffc9a8'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const aa = i * 0.42 + t * 14, rad = 2 + i * (wid / 2 / 30); ctx.lineTo(Math.cos(aa) * rad * 0.6, Math.sin(aa) * rad); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlays(ctx, world, state) {
    const { w, h } = R;
    const p = world?.power;
    // Freeze: frost at the edges
    const fz = state.freezeA;
    if (fz > 0.01) {
      if (!R.frost) R.frost = buildFrost(w, h);
      ctx.globalAlpha = fz;
      ctx.drawImage(R.frost, 0, 0, w, h);
      ctx.fillStyle = 'rgba(89,200,255,0.07)'; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    // Frenzy: speed lines up both edges
    if (p && p.frenzy > 0 && !REDUCED) {
      const a = Math.min(1, p.frenzy * 2, (4 - p.frenzy) * 4);
      ctx.globalAlpha = 0.55 * a;
      ctx.strokeStyle = '#ffc933'; ctx.lineCap = 'round';
      const t = state.t;
      for (let i = 0; i < 14; i++) {
        const side = i % 2, x = side ? w - 8 - ((i * 13) % 40) : 8 + ((i * 17) % 40);
        const y = h - ((t * (700 + i * 40) + i * 140) % (h + 200));
        ctx.lineWidth = 3 + (i % 3);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60 + (i % 4) * 30); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- the HUD (CSS pixels) ----------
  function drawScore(ctx, L, state) {
    const { fs } = L;
    const pop = 1 + 0.2 * ease.outCubic(state.fx.scorePop);
    const x = R.w / 2, y = L.hudTop + fs * 0.56;
    ctx.save();
    ctx.translate(x, y); ctx.scale(pop, pop);
    ctx.font = `900 ${fs}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const text = fmt(state.shownScore);
    ctx.fillStyle = INK; ctx.fillText(text, 0, fs * 0.1);
    ctx.lineWidth = fs * 0.2; ctx.strokeStyle = INK; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = state.double ? '#3ff0c3' : state.beatBest ? '#ffc933' : PAPER;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawShields(ctx, L, state) {
    const s = L.sh, gap = s * 0.92;
    const y = L.hudTop + s * 0.68;
    for (let i = 0; i < 3; i++) {
      const x = L.left + s * 0.5 + i * gap;
      const lost = i >= state.lives;
      const k = state.fx.shields[i];
      ctx.save();
      let ox = 0, oy = 0;
      if (k > 0 && k < 0.5) { const q = 1 - k / 0.5; ox = Math.sin(k * 70) * 4 * q; oy = -6 * q * q; }
      ctx.translate(x + ox, y + oy);
      shieldPath(ctx, 2, 3, s); ctx.fillStyle = INK; ctx.fill();
      shieldPath(ctx, 0, 0, s);
      ctx.fillStyle = lost ? '#3a2d5c' : '#cdb8ff'; ctx.fill();
      if (!lost) {
        ctx.save(); shieldPath(ctx, 0, 0, s); ctx.clip();
        ctx.fillStyle = '#efe8ff'; ctx.fillRect(-s * 0.5, -s * 0.6, s * 0.22, s * 1.2);
        ctx.restore();
        heartAt(ctx, 0, -s * 0.04, s * 0.2); ctx.fillStyle = '#8b66ff'; ctx.fill();
      }
      shieldPath(ctx, 0, 0, s); ctx.lineWidth = Math.max(2, s * 0.09); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      if (lost) {
        ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.52); ctx.lineTo(s * 0.06, -s * 0.18); ctx.lineTo(-s * 0.1, s * 0.06); ctx.lineTo(s * 0.04, s * 0.5);
        ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.strokeStyle = '#8f80b8'; ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawTimer(ctx, L, state) {
    const s = L.sh, x = L.left, y = L.hudTop + 2;
    const left = state.timeLeft;
    const urgent = left <= 10;
    const pulse = urgent && !REDUCED ? 1 + 0.08 * Math.max(0, Math.sin(state.t * 10)) : 1;
    const w = s * 3.5, h = s * 1.22;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pulse, pulse);
    if (state.fx.timerPop > 0) ctx.translate(Math.sin(state.t * 70) * 5 * state.fx.timerPop, 0);
    roundRect(ctx, -w / 2 + 2, -h / 2 + 3, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = state.fx.timerPop > 0.3 ? '#ff5a5f' : urgent ? '#ff4da6' : PAPER; ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.09); ctx.strokeStyle = INK; ctx.stroke();
    // a clock face
    const cx = -w / 2 + h * 0.52, r = h * 0.3;
    ctx.beginPath(); ctx.arc(cx, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#ffc933'; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.stroke();
    const frac = left / 60;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.sin(frac * Math.PI * 2) * r * 0.7, -Math.cos(frac * Math.PI * 2) * r * 0.7); ctx.stroke();
    ctx.font = `750 ${Math.round(h * 0.56)}px 'AK Mono', ui-monospace, monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.fillText(fmtTime(Math.ceil(left)), cx + r + h * 0.22, h * 0.03);
    ctx.restore();
    // a draining bar under it
    const by = y + h + 6, bw = w, bh = Math.max(5, s * 0.22);
    roundRect(ctx, x, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(23,10,54,0.7)'; ctx.fill();
    roundRect(ctx, x, by, Math.max(bh, bw * clamp(frac, 0, 1)), bh, bh / 2); ctx.fillStyle = urgent ? '#ff4da6' : '#ffc933'; ctx.fill();
    roundRect(ctx, x, by, bw, bh, bh / 2); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  }

  function drawPowers(ctx, L, state) {
    const p = state.power;
    if (!p) return;
    const list = [];
    if (p.freeze > 0) list.push(['freeze', p.freeze / 4, '#59c8ff', 'SLOW-MO']);
    if (p.frenzy > 0) list.push(['frenzy', p.frenzy / 4, '#ffc933', 'FRENZY']);
    if (p.double > 0) list.push(['double', p.double / 8, '#3ff0c3', '×2 POINTS']);
    if (!list.length) return;
    const h = Math.max(24, L.fs * 0.52), fsz = Math.round(h * 0.46);
    ctx.font = `900 ${fsz}px ${FONT}`;
    const widths = list.map((x) => ctx.measureText(x[3]).width + h * 1.5);
    const total = widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 8;
    let x = R.w / 2 - total / 2;
    const y = L.hudTop + L.fs * 1.18;
    list.forEach(([, frac, color, word], i) => {
      const w = widths[i];
      roundRect(ctx, x + 2, y + 3, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
      roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = PAPER; ctx.fill();
      ctx.save(); roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
      ctx.restore();
      roundRect(ctx, x, y, w, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word, x + w / 2, y + h / 2 + 1);
      x += w + 8;
    });
  }

  function drawAvatar(ctx, L, state) {
    const fx = state.fx, a = fx.avatar;
    const d = L.av, x = L.right - d / 2, y = L.hudTop + d / 2;
    if (!R.avatar && R.avatarImg) R.avatar = buildAvatar(d * R.dpr);
    const mood = a.mood;
    let ox = 0, oy = 0, rot = 0, sc = 1 + 0.12 * ease.outCubic(a.bump);
    if (!REDUCED) {
      if (mood === 'surprised' && a.t < 0.5) ox = Math.sin(a.t * 60) * 4 * (1 - a.t / 0.5);
      if (mood === 'sad') { oy = 3; rot = -0.12; }
      if (mood === 'happy' || mood === 'love') oy = -Math.abs(Math.sin(a.t * 9)) * 4 * Math.max(0, 1 - a.t / 1.2);
      sc *= 1 + 0.015 * Math.sin(state.t * 2.2);
    }
    ctx.save();
    ctx.translate(x + ox, y + oy); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.arc(3, 4, d / 2 + 3, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, d / 2 + 3, 0, Math.PI * 2); ctx.fillStyle = MOOD_RING[mood] || MOOD_RING.idle; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    if (R.avatar) ctx.drawImage(R.avatar, -d / 2 + 3, -d / 2 + 3, d - 6, d - 6);
    if (mood === 'sad') { ctx.beginPath(); ctx.arc(0, 0, d / 2 - 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,80,160,0.22)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, d / 2 - 3, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    // her face's little extras
    const k = d / 64;
    if (mood === 'happy' || mood === 'love') {
      ctx.fillStyle = 'rgba(255,120,170,0.45)';
      ctx.beginPath(); ctx.ellipse(-d * 0.2, d * 0.13, d * 0.08, d * 0.045, 0, 0, Math.PI * 2); ctx.ellipse(d * 0.2, d * 0.13, d * 0.08, d * 0.045, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (mood === 'happy') {
      for (const [sx, sy, s, ph] of [[d * 0.5, -d * 0.42, 9 * k, 0], [-d * 0.52, -d * 0.3, 6 * k, 1.7]]) {
        const tw = 0.7 + 0.3 * Math.sin(state.t * 8 + ph);
        ctx.save(); ctx.translate(sx, sy); ctx.scale(tw, tw);
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0); ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s); ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0); ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s);
        ctx.fillStyle = '#ffc933'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.restore();
      }
    }
    if (mood === 'love') {
      for (let i = 0; i < 3; i++) {
        const q = ((a.t * 0.9 + i / 3) % 1);
        const hx = -d * 0.42 + i * d * 0.42 + Math.sin(q * 7 + i) * 3, hy = -d * 0.38 - q * d * 0.5;
        ctx.globalAlpha = 1 - q;
        heartAt(ctx, hx, hy, 6 * k); ctx.fillStyle = '#ff4da6'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (mood === 'surprised') {
      ctx.save(); ctx.translate(d * 0.48, -d * 0.4); ctx.rotate(0.2);
      roundRect(ctx, -7 * k, -11 * k, 14 * k, 22 * k, 5 * k); ctx.fillStyle = '#ffc933'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = `900 ${Math.round(17 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('!', 0, 1);
      ctx.restore();
    }
    if (mood === 'sad' || mood === 'surprised') {
      const sx = -d * 0.36, sy = -d * 0.22 + (mood === 'sad' ? Math.min(1, a.t * 1.4) * 6 : 0);
      ctx.beginPath(); ctx.moveTo(sx, sy - 9 * k); ctx.quadraticCurveTo(sx + 6 * k, sy, sx, sy + 5 * k); ctx.quadraticCurveTo(sx - 6 * k, sy, sx, sy - 9 * k);
      ctx.fillStyle = '#a8e4ff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const t = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawBubble(ctx, L, state) {
    const b = state.fx.bubble;
    if (!b) return;
    const k = b.t < 0.2 ? ease.outBack(b.t / 0.2, 2) : b.t > b.life - 0.25 ? 1 - ease.inQuad((b.t - (b.life - 0.25)) / 0.25) : 1;
    if (k <= 0.01) return;
    const fsz = clamp(Math.round(Math.min(R.w, R.h) * 0.034), 15, 21);
    ctx.font = `italic ${fsz}px 'AK Serif', Georgia, serif`;
    const maxW = Math.min(300, R.w * 0.62);
    const lines = wrap(ctx, b.text, maxW - 24);
    const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = lw + 26, lh = fsz * 1.18, bh = lines.length * lh + 16;
    const right = L.right, top = L.hudTop + L.av + 12;
    const x = right - bw, y = top;
    ctx.save();
    ctx.translate(right - L.av / 2, top);
    ctx.scale(k, k);
    ctx.translate(-(right - L.av / 2), -top);
    roundRect(ctx, x + 3, y + 4, bw, bh, 14); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, x, y, bw, bh, 14); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    // its tail, up to her face
    const tx = right - L.av / 2;
    ctx.beginPath(); ctx.moveTo(tx - 9, y + 1.5); ctx.lineTo(tx, y - 10); ctx.lineTo(tx + 7, y + 1.5); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 9, y + 1); ctx.lineTo(tx, y - 10); ctx.lineTo(tx + 7, y + 1); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + 13, y + 8 + lh * (i + 0.5)));
    ctx.restore();
  }

  function drawBanner(ctx, state) {
    const b = state.fx.banners[0];
    if (!b) return;
    const t = b.t, life = b.life;
    const kin = t < 0.22 ? ease.outBack(t / 0.22, 2.2) : 1;
    const out = t > life - 0.25 ? 1 - ease.inQuad((t - (life - 0.25)) / 0.25) : 1;
    if (out <= 0) return;
    const fs = clamp(Math.round(Math.min(R.w, R.h) * 0.11), 34, 84);
    const cy = R.layout ? (R.layout.hudTop + R.h) * 0.45 : R.h * 0.45;
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(R.w / 2, cy);
    ctx.rotate(-0.06);
    ctx.scale(kin * (REDUCED ? 1 : 1 + (1 - out) * 0.15), kin);
    ctx.font = `900 ${fs}px ${FONT}`;
    const tw = ctx.measureText(b.text).width;
    const bw = tw + fs * 0.9, bh = fs * 1.15;
    roundRect(ctx, -bw / 2 + 5, -bh / 2 + 7, bw, bh, bh * 0.28); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh * 0.28); ctx.fillStyle = b.color; ctx.fill();
    ctx.lineWidth = Math.max(3, fs * 0.07); ctx.strokeStyle = INK; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.16; ctx.strokeStyle = INK; ctx.strokeText(b.text, 0, fs * 0.04);
    ctx.fillStyle = PAPER; ctx.fillText(b.text, 0, fs * 0.04);
    if (b.sub) {
      const ss = Math.round(fs * 0.3);
      ctx.font = `850 ${ss}px ${FONT}`;
      const sw = ctx.measureText(b.sub).width + ss * 1.4;
      roundRect(ctx, -sw / 2, bh / 2 - ss * 0.2, sw, ss * 1.5, ss * 0.75); ctx.fillStyle = INK; ctx.fill();
      ctx.fillStyle = PAPER; ctx.fillText(b.sub, 0, bh / 2 + ss * 0.56);
    }
    ctx.restore();
  }

  function drawCombo(ctx, state) {
    const c = state.fx.combo;
    if (!c || c.n < 2) return;
    const k = c.t < 0.12 ? ease.outBack(c.t / 0.12, 2.5) : 1;
    const a = c.t > 0.6 ? 1 - (c.t - 0.6) / 0.3 : 1;
    const size = (26 + Math.min(6, c.n) * 4) * k;
    if (size < 1) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(c.x, c.y - 70);
    ctx.rotate(-0.08);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const text = `×${c.n}`;
    ctx.fillStyle = INK; ctx.fillText(text, 2, size * 0.1);
    ctx.lineWidth = size * 0.24; ctx.strokeStyle = INK; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = bladePalette(c.n).body; ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // ---------- the frame ----------
  // state: { world, fx, blades, t, hud (bool), shownScore, lives, timeLeft, power, double, beatBest, freezeA, mode, palette }
  R.frame = (ctx, state) => {
    const { world, fx } = state;
    const L = R.layout;
    ctx.save();
    if (!REDUCED) fx.shake.apply(ctx, R.w / 2, R.h / 2);
    drawRoom(ctx, state);
    const s = R.scale;
    // world things
    ctx.save();
    ctx.scale(s, s);
    if (R.splats) fx.drawSplats(ctx, R.splats);
    ctx.restore();
    if (state.hud && L) {
      drawScore(ctx, L, state);
      if (state.mode === 'blitz') drawTimer(ctx, L, state); else drawShields(ctx, L, state);
      drawPowers(ctx, L, state);
      drawAvatar(ctx, L, state);
      drawBubble(ctx, L, state);
    }
    ctx.save();
    ctx.scale(s, s);
    if (world) drawObjects(ctx, world, state.t);
    fx.drawPieces(ctx, PAD);
    if (world) drawRug(ctx, fx.rug, world);
    fx.parts.draw(ctx);
    fx.drawRings(ctx);
    state.blades.draw(ctx, state.vt, { width: 15, palette: state.palette });
    fx.drawFloats(ctx);
    drawCombo(ctx, state);
    fx.top.draw(ctx);
    ctx.restore();
    ctx.restore();
    drawOverlays(ctx, world, state);
    drawBanner(ctx, state);
    if (fx.flash.a > 0.01) {
      ctx.globalAlpha = Math.min(1, fx.flash.a);
      ctx.fillStyle = fx.flash.color; ctx.fillRect(0, 0, R.w, R.h);
      ctx.globalAlpha = 1;
    }
  };

  return R;
}
