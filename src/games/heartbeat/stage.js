// HEARTBEAT (2026-11-08): the concert under the stars, behind the highway. A night sky (its stars twinkling, a moon
// sticker), stage lights sweeping, an equalizer skyline on the horizon (from the song's own sound, or the beat when there
// is none), AGI-1 on her stage dancing on the beat (a squash on each beat, a sway every two, hops in FEVER), her speech
// bubble, and the crowd's lights at the front. Everything static is drawn once per screen size; a frame only moves things.
import { LANE_COLORS, INK, PAPER, heartPath } from './sprites.js';
import { rng, TAU, clamp, lerp, ease, mix } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

const CALM = REDUCED ? 0.15 : 1;     // "reduce motion": the lights and the crowd barely move, she sways less
import { HER_ASPECT } from './layout.js';

const HER_SRC = '/images/landing/agi1-cutout.webp';

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

export function createStage(sprites) {
  const img = new Image();
  img.decoding = 'async';
  img.src = HER_SRC;
  let herCanvas = null, herKey = '';
  let sky = null, skyKey = '';
  let stars = [], sparkles = [], bars = [], crowd = [], beams = [];
  let horizon = 0, feverGrad = null, feverKey = '';
  const last = { headX: 0, headY: 0 };

  function herSprite(h, dpr) {
    if (!img.complete || !img.naturalWidth || !(h > 4) || !(dpr > 0)) return null;
    const key = `${Math.round(h)}:${dpr}`;
    if (herKey === key) return herCanvas;
    const w = h * HER_ASPECT;
    const c = offscreen(w * dpr, h * dpr);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    // big steps down look soft: halve first, then draw
    let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
    while (sw / 2 > c.width * 1.6 && sw > 8) {
      const half = offscreen(sw / 2, sh / 2);
      const hg = half.getContext('2d');
      hg.imageSmoothingQuality = 'high';
      hg.drawImage(src, 0, 0, half.width, half.height);
      src = half; sw = half.width; sh = half.height;
    }
    g.drawImage(src, 0, 0, c.width, c.height);
    herCanvas = c; herKey = key;
    return c;
  }

  function build(L, dpr) {
    const { w, h } = L;
    horizon = L.wide ? h * 0.62 : L.stageY - L.herH * 0.12;
    const r = rng(20261108);
    // the sky: deep ink at the top, violet at the horizon
    sky = offscreen(w * dpr, h * dpr);
    const g = sky.getContext('2d');
    g.scale(dpr, dpr);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#080418');
    gr.addColorStop(clamp(horizon / h - 0.32, 0.05, 0.9), '#140a35');
    gr.addColorStop(clamp(horizon / h, 0.1, 0.95), '#2d145e');
    gr.addColorStop(clamp(horizon / h + 0.12, 0.15, 0.98), '#1c0d40');
    gr.addColorStop(1, '#0e0727');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // a soft violet glow on the horizon behind her
    const hx = L.wide ? L.her.x + w * 0.12 : w / 2;
    const glow = g.createRadialGradient(hx, horizon, 0, hx, horizon, Math.max(w, h) * 0.55);
    glow.addColorStop(0, 'rgba(139,102,255,0.32)');
    glow.addColorStop(0.45, 'rgba(255,77,166,0.08)');
    glow.addColorStop(1, 'rgba(139,102,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // the still stars
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) {
      const x = r.range(0, w), y = r.range(0, horizon * 0.98);
      g.globalAlpha = r.range(0.25, 0.8) * (1 - y / horizon * 0.6);
      g.fillStyle = r.chance(0.2) ? '#ffe9a8' : '#e4d9ff';
      const s = r.chance(0.12) ? 1.6 : 1;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    skyKey = `${w}x${h}:${dpr}:${L.wide}`;
    // twinkling stars and a few sparkles
    stars = Array.from({ length: Math.round(n / 5) }, () => ({ x: r.range(0, w), y: r.range(0, horizon * 0.9), p: r.range(0, TAU), f: r.range(0.6, 1.8), s: r.range(1, 2.2) }));
    sparkles = Array.from({ length: L.wide ? 9 : 6 }, () => ({ x: r.range(0.04, 0.96) * w, y: r.range(0.05, 0.75) * horizon, p: r.range(0, TAU), f: r.range(0.35, 0.8), s: r.range(5, 10), c: r.pick(['#ffc933', '#e4d9ff', '#ff9fd0']) }));
    // the skyline: a city of equalizer bars, mirrored from the middle
    const count = clamp(Math.round(w / 20), 18, 72);
    const bw = w / count;
    bars = Array.from({ length: count }, (_, i) => {
      const mid = Math.abs(i + 0.5 - count / 2) / (count / 2);       // 0 middle … 1 edges
      return {
        x: i * bw, w: bw, band: Math.round(mid * 15), base: r.range(0.18, 0.55) * (1 - mid * 0.35),
        cap: LANE_COLORS[i % 4], windows: r.int(0, 3), wseed: r.int(0, 999), v: 0,
      };
    });
    // the crowd at the front: two rows of heads (back, then front), their lights up
    crowd = [];
    const rows = [{ dy: -16, gap: 25, size: 14, lights: 0.6, shade: '#160a33' }, { dy: 6, gap: 33, size: 19, lights: 0.4, shade: '#0a0419' }];
    for (const row of rows) {
      for (let x = -12; x < w + 24; x += row.gap * r.range(0.8, 1.2)) {
        crowd.push({ x, dy: row.dy + r.range(-3, 3), s: row.size * r.range(0.85, 1.18), light: r.chance(row.lights), c: r.int(0, 5), p: r.range(0, TAU), arm: r.range(16, 30) * (row.size / 15), shade: row.shade, stick: r.chance(0.35) });
      }
    }
    // stage lights: sources above the screen
    const nb = L.wide ? 5 : 4;
    beams = Array.from({ length: nb }, (_, i) => ({ x: (i + 0.5) / nb * w, c: i % 4, p: r.range(0, TAU), f: r.range(0.18, 0.32) * (i % 2 ? 1 : -1) }));
    feverKey = '';
  }

  function feverOverlay(ctx, L) {
    const key = `${L.w}x${L.h}`;
    if (feverKey !== key) {
      feverGrad = ctx.createLinearGradient(0, 0, 0, L.h);
      feverGrad.addColorStop(0, 'rgba(255,77,166,0.0)');
      feverGrad.addColorStop(0.5, 'rgba(255,77,166,0.16)');
      feverGrad.addColorStop(1, 'rgba(255,201,51,0.12)');
      feverKey = key;
    }
    return feverGrad;
  }

  function drawMoon(ctx, x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35 + Math.sin(t * 0.3) * 0.04);
    // a crescent: the moon minus an offset circle, as a sticker
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.arc(r * 0.42, -r * 0.18, r * 0.82, 0, TAU, true);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.save(); ctx.translate(0, r * 0.12); ctx.fill('evenodd'); ctx.restore();
    ctx.fillStyle = '#ffe08a';
    ctx.fill('evenodd');
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawSparkle(ctx, x, y, s, a, color) {
    if (a <= 0.02) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.16, y - s * 0.16, x + s, y);
    ctx.quadraticCurveTo(x + s * 0.16, y + s * 0.16, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.16, y + s * 0.16, x - s, y);
    ctx.quadraticCurveTo(x - s * 0.16, y - s * 0.16, x, y - s);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // her bubble: beside her head on tall screens, above it on wide ones (the highway is beside her there)
  function drawBubble(ctx, L, b, headX, headY, headTop) {
    const age = b.age;
    const life = b.life || 2.2;
    if (age > life) return;
    const pop = age < 0.25 ? ease.outBack(age / 0.25) : 1;
    const fade = age > life - 0.3 ? (life - age) / 0.3 : 1;
    const fs = clamp(L.w * 0.042, 15, 21);
    ctx.font = `italic ${fs}px 'AK Serif', Georgia, serif`;
    const tw = ctx.measureText(b.text).width;
    const bw = tw + fs * 2.1, bh = fs * 1.8;
    const above = L.wide;
    let bx, by;
    if (above) {
      bx = headX - bw * 0.3;
      by = headTop - bh - fs * 0.9;
      const roadLeft = L.cx - (L.farW + (L.nearW - L.farW) * clamp((by + bh - L.farY) / (L.hitY - L.farY), 0, 1)) / 2;
      bx = Math.min(bx, roadLeft - 8 - bw);
    } else {
      bx = headX + L.herH * 0.2;
      by = headY - bh * 0.3;
    }
    bx = clamp(bx, 8, L.w - bw - 8);
    by = clamp(by, L.top + 6, L.h - bh - 8);
    // the tail points at her head
    const tipX = clamp(headX - bx, fs * 0.6, bw - fs * 0.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(bx, by + bh / 2);
    ctx.scale(pop, pop);
    ctx.translate(0, -bh / 2);
    const shape = (dy) => {
      ctx.beginPath();
      const r = bh / 2;
      ctx.moveTo(r, dy); ctx.arcTo(bw, dy, bw, dy + bh, r); ctx.arcTo(bw, dy + bh, 0, dy + bh, r);
      ctx.arcTo(0, dy + bh, 0, dy, r); ctx.arcTo(0, dy, bw, dy, r); ctx.closePath();
    };
    const tail = above
      ? [[tipX - fs * 0.45, bh - 2], [tipX - fs * 0.1, bh + fs * 0.75], [tipX + fs * 0.5, bh - 2]]
      : [[fs * 0.9, bh - 2], [-fs * 0.2, bh + fs * 0.55], [fs * 1.8, bh - 2]];
    shape(3); ctx.fillStyle = INK; ctx.fill();
    shape(0); ctx.fillStyle = PAPER; ctx.fill();
    ctx.beginPath(); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[1]); ctx.lineTo(...tail[2]); ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    shape(0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tail[0][0], bh); ctx.lineTo(...tail[1]); ctx.lineTo(tail[2][0], bh); ctx.stroke();
    ctx.fillStyle = PAPER; ctx.fillRect(tail[0][0] + 1.5, bh - 3, tail[2][0] - tail[0][0] - 3, 4);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(b.text, fs * 0.75, bh / 2 + 1);
    heartPath(ctx, bw - fs * 0.75, bh / 2, fs * 0.62);
    ctx.fillStyle = '#ff4da6'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }

  return {
    image: img,
    get ready() { return img.complete && img.naturalWidth > 0; },
    // s: { t, beat, energy, fever (0..1), spectrum (array 0..1 per band, 16) | null, cheer (0..1), bubble, playing, dpr,
    //      her: { x, y, h } (where she stands, if not the layout's), platform (false: no stage under her) }
    draw(ctx, L, s) {
      const dpr = s.dpr;
      if (skyKey !== `${L.w}x${L.h}:${dpr}:${L.wide}`) build(L, dpr);
      const { w, h } = L;
      const t = s.t;
      const beatFrac = s.beat - Math.floor(s.beat);
      const onBeat = Math.pow(1 - beatFrac, 3);            // 1 right on a beat, fading
      const fever = s.fever;
      ctx.drawImage(sky, 0, 0, w, h);
      if (fever > 0.01) {
        ctx.globalAlpha = fever;
        ctx.fillStyle = feverOverlay(ctx, L);
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      // twinkles
      for (const st of stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.f * 2 + st.p));
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
      ctx.globalAlpha = 1;
      for (const sp of sparkles) {
        const a = Math.max(0, Math.sin(t * sp.f + sp.p)) ** 2;
        drawSparkle(ctx, sp.x, sp.y, sp.s * (0.7 + 0.3 * a), a * 0.95, sp.c);
      }
      // the moon
      const moonR = clamp(Math.min(w, h) * 0.05, 14, 40);
      const mx = L.wide ? L.cx + L.farW * 0.5 + (w - L.cx - L.farW * 0.5) * 0.18 + moonR : w - moonR * 2.1;
      const my = L.wide ? L.farY + moonR * 1.4 : L.top + moonR * 1.3;
      drawMoon(ctx, mx, my, moonR, t);
      // stage lights
      ctx.globalCompositeOperation = 'lighter';
      const target = L.wide ? { x: L.her.x, y: L.stageY - L.herH * 0.5 } : { x: w / 2, y: L.stageY - L.herH * 0.45 };
      const len = Math.hypot(w, h) * 0.95;
      for (const b of beams) {
        const sweep = Math.sin(t * (b.f * (1 + fever * 1.4)) + b.p) * (0.35 + fever * 0.15) * CALM;
        const ax = b.x, ay = L.top - 30;
        const base = Math.atan2(target.y - ay, target.x - ax) - Math.PI / 2;
        const ang = base + sweep;
        const spr = sprites.beams[fever > 0.5 && b.c === 3 ? 4 : b.c];
        const bw = w * (L.wide ? 0.34 : 0.62);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.globalAlpha = clamp(0.07 + 0.06 * s.energy + 0.08 * onBeat * (0.4 + s.energy) + fever * 0.1, 0, 0.32);
        ctx.drawImage(spr, -bw / 2, 0, bw, len);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // the skyline
      const maxH = L.wide ? h * 0.3 : Math.min(L.herH * 0.85, h * 0.24);
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        let lvl;
        if (s.spectrum) lvl = s.spectrum[b.band] || 0;
        else lvl = clamp((0.25 + 0.55 * s.energy) * (0.55 + 0.45 * Math.sin(b.wseed + s.beat * Math.PI * (1 + (b.band % 3)) * 0.5)) * (0.4 + 0.6 * onBeat * (1 - b.band / 22)), 0, 1);
        b.v = lerp(b.v, lvl, lvl > b.v ? 0.55 : 0.18);
        const bh = maxH * (b.base * 0.5 + b.v * 0.75);
        const x = b.x + 1.5, y = horizon - bh, bwid = b.w - 3;
        ctx.fillStyle = fever > 0.3 ? '#3a1352' : '#22134a';
        ctx.fillRect(x, y, bwid, bh + 2);
        ctx.strokeRect(x, y, bwid, bh + 2);
        ctx.fillStyle = b.cap;
        ctx.globalAlpha = 0.55 + 0.45 * b.v;
        ctx.fillRect(x + 1, y + 1, bwid - 2, Math.max(2, Math.min(5, bh * 0.12)));
        ctx.globalAlpha = 1;
        if (b.windows && bh > 26) {
          ctx.fillStyle = 'rgba(255,201,51,0.5)';
          for (let k = 0; k < b.windows; k++) {
            const wy = y + 10 + ((b.wseed * (k + 3)) % Math.max(1, bh - 18));
            if (((b.wseed + k + Math.floor(s.beat / 2)) % 4) !== 0) ctx.fillRect(x + bwid * 0.3, wy, Math.max(2, bwid * 0.4), 3);
          }
        }
      }
      // her stage: a sticker platform
      const her = s.her || L.her;
      const stW = L.wide ? Math.min(her.h * 0.62, (w - L.nearW) / 2 - 16) : Math.min(w * 0.62, L.herH * 1.15);
      const stH = clamp(her.h * 0.07, 10, 26);
      const stX = her.x - stW / 2, stY = her.y - stH * 0.35;
      if (s.platform !== false) {
        ctx.fillStyle = INK;
        roundRect(ctx, stX, stY + 4, stW, stH, stH / 2); ctx.fill();
        ctx.fillStyle = fever > 0.3 ? mix('#cdb8ff', '#ff9fd0', fever) : '#cdb8ff';
        roundRect(ctx, stX, stY, stW, stH, stH / 2); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        // the stage's footlights, blinking with the beat
        const nl = Math.max(3, Math.round(stW / 26));
        for (let i = 0; i < nl; i++) {
          const lx = stX + stW * (i + 0.5) / nl;
          const on = (Math.floor(s.beat) + i) % 2 === 0;
          ctx.fillStyle = on ? LANE_COLORS[i % 4] : '#6b5a99';
          ctx.beginPath(); ctx.arc(lx, stY + stH * 0.5, Math.max(2, stH * 0.17), 0, TAU); ctx.fill();
        }
      }
      // AGI-1: a squash on the beat, a sway every two, hops when she cheers
      const sprite = herSprite(her.h, dpr);
      const hop = (s.cheer > 0 ? Math.sin(Math.min(1, s.cheer) * Math.PI) * her.h * 0.07 : 0)
        + Math.sin(beatFrac * Math.PI) * her.h * (0.006 + 0.012 * s.energy + 0.02 * fever) * (s.playing || s.music ? 1 : 0.6) * CALM;
      const squash = 1 - onBeat * (0.022 + 0.02 * s.energy) * (REDUCED ? 0.4 : 1);
      const sway = Math.sin(s.beat * Math.PI / 2) * (0.018 + 0.012 * fever) * CALM;
      // her shadow
      ctx.fillStyle = 'rgba(10,4,24,0.45)';
      ctx.beginPath();
      ctx.ellipse(her.x, her.y - stH * 0.15, her.h * HER_ASPECT * 0.38 * (1 - hop / her.h * 2), stH * 0.32, 0, 0, TAU);
      ctx.fill();
      let headX = her.x, headY = her.y - her.h;
      if (sprite) {
        const hw = her.h * HER_ASPECT;
        ctx.save();
        ctx.translate(her.x, her.y - stH * 0.2 - hop);
        ctx.rotate(sway);
        ctx.scale(1 + (1 - squash) * 0.6, squash);
        ctx.drawImage(sprite, -hw / 2, -her.h, hw, her.h);
        ctx.restore();
        headY = her.y - her.h - hop + her.h * 0.12;
        last.headTop = her.y - stH * 0.2 - hop - her.h;
      }
      last.headX = headX; last.headY = headY;
      return { headX, headY };
    },

    // where her head is (for the hearts she sends up when she cheers)
    head() { return { x: last.headX, y: last.headTop ?? last.headY }; },

    // her speech bubble, over everything (beside her head; in wide layouts kept off the highway when it fits)
    bubble(ctx, L, b) {
      if (b) drawBubble(ctx, L, b, last.headX, last.headY, last.headTop ?? last.headY);
    },

    // the crowd in front: heads and raised lights swaying with the beat, along the bottom (`scale` bigger on the title)
    front(ctx, L, s, { scale = 1, clipTop = 0 } = {}) {
      if (!crowd.length) return;
      const beatFrac = s.beat - Math.floor(s.beat);
      const onBeat = Math.pow(1 - beatFrac, 3);
      const base = L.h - 6 * scale;
      ctx.save();
      if (clipTop) { ctx.beginPath(); ctx.rect(0, clipTop, L.w, L.h - clipTop); ctx.clip(); }
      for (const p of crowd) {
        const sz = p.s * scale;
        const y = base + p.dy * scale;
        const swayX = Math.sin(s.beat * Math.PI / 2 + p.p) * 6 * scale * (0.5 + s.energy) * CALM;
        if (p.light) {
          const lx = p.x + swayX, ly = y - p.arm * scale - sz * 0.6 - onBeat * 3 * scale;
          ctx.strokeStyle = p.shade; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, y - sz * 0.2); ctx.lineTo(lx, ly); ctx.stroke();
          const ds = (16 + 12 * onBeat * (0.4 + s.energy) + s.fever * 6) * scale;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.6 + 0.4 * onBeat;
          ctx.drawImage(sprites.dots[p.c], lx - ds / 2, ly - ds / 2, ds, ds);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          if (p.stick) {
            ctx.strokeStyle = LANE_COLORS[p.c % 4]; ctx.lineWidth = 3 * scale;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + swayX * 0.4, ly - 9 * scale); ctx.stroke();
          }
        }
        ctx.fillStyle = p.shade;
        ctx.beginPath(); ctx.ellipse(p.x, y, sz * 0.62, sz * 0.72, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x, y + sz * 1.1, sz * 1.25, sz * 0.75, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
