// HALLUCINATION (2026-11-08): the playfield on the screen. A deep plum desk with faint doodles; the two pictures as
// Polaroid-like cards (paper grain, ink outline, a hard shadow, a caption in the bottom margin: "MEMORY", and "HER
// REDRAW" with AGI-1's face sticker, where her words appear when she talks); ink-scribble circles around what's found,
// a pink ✗ for a wrong tap, a honey pulse for a hint; scenes dropping in, sliding together and fixing themselves with a
// brush sweep; the clock strip; the demo's fingertip. Pictures are drawn once into their own canvases (./draw.js).
import { W, H, TAU, heartPath, starPath } from './paint.js';
import { ease, clamp, lerp, roundRect } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

export const C = Object.freeze({ ink: '#170a36', ink2: '#4a3d6e', paper: '#fffaf0', card: '#fbf5ea', pink: '#ff4da6', marker: '#ff3d9a', honey: '#ffc933', mint: '#3ff0c3', plum: '#1d0f2a', lav: '#e4d9ff', violet: '#8b66ff' });
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif", MONO = "'AK Mono', ui-monospace, monospace", SERIF = "'AK Serif', Georgia, serif";
export const IN_DUR = 0.62, CLEAR_DUR = 2.0, MISS_DUR = 1.9;

// ---------- a scribble: a quick pen circle, a little more than once round, never quite round ----------
export function makeScribble(seedFn = Math.random) {
  const n = 46, turns = 1.16, pts = new Float32Array(n * 2);
  const a0 = -Math.PI * (0.55 + seedFn() * 0.5), dir = 1;
  const p1 = seedFn() * TAU, p2 = seedFn() * TAU, w1 = 0.035 + seedFn() * 0.03, w2 = 0.02 + seedFn() * 0.02;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * turns, a = a0 + dir * u * TAU;
    const spiral = u > 1 ? -0.07 * ((u - 1) / (turns - 1)) : 0.04 * (1 - u);
    const r = 1 + w1 * Math.sin(3 * a + p1) + w2 * Math.sin(5 * a + p2) + spiral;
    pts[i * 2] = Math.cos(a) * r; pts[i * 2 + 1] = Math.sin(a) * r;
  }
  return { pts, n, rot: (seedFn() - 0.5) * 0.3 };
}
function strokeScribble(ctx, sc, cx, cy, rx, ry, prog, alpha = 1, dashed = false) {
  const last = Math.max(1, Math.floor(prog * (sc.n - 1)));
  const cr = Math.cos(sc.rot), sr = Math.sin(sc.rot);
  ctx.beginPath();
  for (let i = 0; i <= last; i++) {
    const ux = sc.pts[i * 2] * rx, uy = sc.pts[i * 2 + 1] * ry;
    const x = cx + ux * cr - uy * sr, y = cy + ux * sr + uy * cr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.globalAlpha = 0.92 * alpha; ctx.lineWidth = 6.6; ctx.strokeStyle = C.paper; ctx.stroke();
  ctx.globalAlpha = alpha; ctx.lineWidth = 3.4; ctx.strokeStyle = dashed ? C.pink : C.marker; ctx.stroke();
  if (dashed) ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
// a region (page units) → its ellipse on a picture (screen px)
export function ringOf(region, P, k) {
  const cx = P.x + ((region[0] + region[2]) / 2) * k, cy = P.y + ((region[1] + region[3]) / 2) * k;
  const rx = Math.max(16, ((region[2] - region[0]) / 2) * k + 7), ry = Math.max(16, ((region[3] - region[1]) / 2) * k + 7);
  return { cx, cy, rx: Math.min(rx, ry * 3.2), ry: Math.min(ry, rx * 3.2) };
}

export function createRenderer() {
  let bg = null, bgKey = '';
  const grain = makeGrain();
  let grainPat = null;
  const face = new Image();
  let faceOk = false;
  face.onload = () => { faceOk = true; };
  face.src = '/images/landing/agi1-face.webp';

  function ensureBg(w, h, dpr) {
    const key = `${w}x${h}@${dpr}`;
    if (bg && key === bgKey) return;
    bgKey = key;
    bg = bg || document.createElement('canvas');
    bg.width = Math.round(w * dpr); bg.height = Math.round(h * dpr);
    const g = bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grd = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, '#2a1640'); grd.addColorStop(1, '#150a20');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // faint doodles: little circles, hearts, stars, squiggles and pencil dashes
    let s = 1234567;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    const cell = 74;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let y = -20; y < h + cell; y += cell) for (let x = -20; x < w + cell; x += cell) {
      const px = x + rnd() * cell * 0.7, py = y + rnd() * cell * 0.7, k = rnd(), rot = rnd() * TAU, sz = 6 + rnd() * 7;
      g.save(); g.translate(px, py); g.rotate(rot);
      g.strokeStyle = rnd() < 0.5 ? 'rgba(205,184,255,0.075)' : 'rgba(255,77,166,0.06)'; g.fillStyle = g.strokeStyle; g.lineWidth = 2;
      if (k < 0.2) { g.beginPath(); g.ellipse(0, 0, sz * 1.3, sz, 0, 0, TAU * 0.92); g.stroke(); }
      else if (k < 0.38) { heartPath(g, 0, 0, sz * 0.7); g.stroke(); }
      else if (k < 0.54) { starPath(g, 0, 0, sz, 5, 0.45); g.stroke(); }
      else if (k < 0.72) { g.beginPath(); g.moveTo(-sz * 1.5, 0); for (let i = 1; i <= 6; i++) g.quadraticCurveTo(-sz * 1.5 + (i - 0.5) * sz * 0.5, (i % 2 ? -1 : 1) * sz * 0.5, -sz * 1.5 + i * sz * 0.5, 0); g.stroke(); }
      else if (k < 0.86) { g.beginPath(); g.moveTo(-sz, -sz * 0.6); g.lineTo(sz, sz * 0.6); g.moveTo(sz, -sz * 0.6); g.lineTo(-sz, sz * 0.6); g.stroke(); }
      else { g.beginPath(); g.arc(0, 0, sz * 0.25, 0, TAU); g.fill(); }
      g.restore();
    }
  }

  // ---------- one card ----------
  function cardPath(ctx, c) { roundRect(ctx, c.x, c.y, c.w, c.h, 5); }
  function drawCard(ctx, G, L, i, T, now) {
    const c = L.cards[i], P = L.pics[i];
    ctx.save();
    if (T) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      ctx.translate(cx + T.dx, cy + T.dy); ctx.rotate(T.rot); ctx.scale(T.s, T.s); ctx.translate(-cx, -cy);
      ctx.globalAlpha = T.a;
    }
    // the card: a hard shadow, paper with grain, ink outline
    roundRect(ctx, c.x + L.sh * 0.4, c.y + L.sh, c.w, c.h, 5); ctx.fillStyle = C.ink; ctx.fill();
    cardPath(ctx, c); ctx.fillStyle = C.card; ctx.fill();
    if (!grainPat) grainPat = ctx.createPattern(grain, 'repeat');
    if (grainPat) { ctx.fillStyle = grainPat; ctx.fill(); }
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    // the picture
    const pic = i === 0 ? G.picA : G.picB;
    if (pic) {
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      ctx.drawImage(pic, P.x, P.y, P.w, P.h);
      if (i === 1 && G.sweep > 0 && G.picA) drawSweep(ctx, G, P, G.sweep);
      overlays(ctx, G, L, i, P, now);
      ctx.restore();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; ctx.strokeRect(P.x, P.y, P.w, P.h);
    }
    caption(ctx, G, L, i, c, now);
    ctx.restore();
  }
  // the redraw fixes itself: the memory brushed over it, left to right, with a wavy wet edge
  function drawSweep(ctx, G, P, u) {
    const e = ease.inOutCubic(clamp(u, 0, 1));
    const edge = P.x - P.w * 0.15 + e * P.w * 1.32;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(P.x - 2, P.y - 2);
    const steps = 16;
    for (let j = 0; j <= steps; j++) { const y = P.y + (P.h * j) / steps; ctx.lineTo(edge + Math.sin(j * 1.7 + u * 3) * P.w * 0.035 - (j / steps) * P.w * 0.08, y); }
    ctx.lineTo(P.x - 2, P.y + P.h + 2); ctx.closePath();
    ctx.save(); ctx.clip(); ctx.drawImage(G.picA, P.x, P.y, P.w, P.h); ctx.restore();
    if (u < 1) {
      ctx.globalAlpha = 0.85 * (1 - e * 0.6);
      ctx.lineWidth = Math.max(6, P.w * 0.03); ctx.strokeStyle = 'rgba(255,250,240,0.9)'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineWidth = Math.max(2, P.w * 0.01); ctx.strokeStyle = C.honey; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function overlays(ctx, G, L, i, P, now) {
    const k = P.w / W, sc = G.sc;
    if (!sc) return;
    // the hint: a honey pulse around the one she confessed
    if (G.hint && !G.found.some((f) => f.i === G.hint.i)) {
      const d = sc.diffs[G.hint.i], R = ringOf(d.region, P, k);
      const t = now - G.hint.t0, pulse = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.beginPath(); ctx.ellipse(R.cx, R.cy, R.rx + 6 + pulse * 5, R.ry + 6 + pulse * 5, 0, 0, TAU);
      ctx.lineWidth = 9; ctx.strokeStyle = C.honey; ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.lineWidth = 2.4; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    // a little lens pop where a find was just made (both pictures)
    for (const f of G.found) {
      const t = (now - f.t0) / 0.42;
      if (t < 0 || t >= 1 || REDUCED) continue;
      const d = sc.diffs[f.i], R = ringOf(d.region, P, k);
      const pic = i === 0 ? G.picA : G.picB, s = 1 + 0.16 * Math.sin(Math.PI * t) * (1 - t * 0.4);
      const sx = (pic.width / P.w), sy = (pic.height / P.h);
      const bx = R.cx - R.rx, by = R.cy - R.ry, bw = R.rx * 2, bh = R.ry * 2;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(R.cx, R.cy, R.rx, R.ry, 0, 0, TAU); ctx.clip();
      ctx.translate(R.cx, R.cy); ctx.scale(s, s); ctx.translate(-R.cx, -R.cy);
      ctx.drawImage(pic, (bx - P.x) * sx, (by - P.y) * sy, bw * sx, bh * sy, bx, by, bw, bh);
      ctx.restore();
    }
    // what's found: an ink scribble, drawn quickly
    for (const f of G.found) {
      const d = sc.diffs[f.i], R = ringOf(d.region, P, k);
      const t = now - f.t0 - (i === 0 ? 0.06 : 0);
      if (t < 0) continue;
      const prog = REDUCED ? 1 : ease.outCubic(clamp(t / 0.34, 0, 1));
      const wob = REDUCED ? 0 : Math.sin(clamp(t / 0.5, 0, 1) * Math.PI) * 0.08;
      strokeScribble(ctx, f.sc, R.cx, R.cy, R.rx * (1 + wob), R.ry * (1 + wob), prog, G.clearFade ?? 1);
    }
    // the ones missed when the clock ran out: dashed, pulsing
    if (G.missed) {
      const t = now - G.missed.t0;
      sc.diffs.forEach((d) => {
        if (G.found.some((f) => f.i === d.i)) return;
        const R = ringOf(d.region, P, k);
        const a = clamp(t / 0.3, 0, 1) * (REDUCED ? 1 : 0.75 + 0.25 * Math.sin(t * 8));
        strokeScribble(ctx, G.missSc[d.i], R.cx, R.cy, R.rx, R.ry, clamp(t / 0.5, 0, 1), a, true);
      });
    }
    // a wrong tap: a pink ✗ (strong where it was tapped, faint on the other picture)
    for (const m of G.marks) {
      const t = now - m.t0;
      if (t > 0.9) continue;
      const x = P.x + m.x * k, y = P.y + m.y * k;
      const pop = t < 0.16 ? ease.outBack(t / 0.16) : 1, a = (t > 0.55 ? 1 - (t - 0.55) / 0.35 : 1) * (m.pic === i ? 1 : 0.45);
      const s = 10 * pop;
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      ctx.lineWidth = 8; ctx.strokeStyle = C.paper; ctx.stroke();
      ctx.lineWidth = 4.2; ctx.strokeStyle = C.pink; ctx.stroke();
      ctx.restore();
    }
    // the keyboard's magnifier: the same spot on both pictures
    if (G.reticle?.on) {
      const x = P.x + G.reticle.x * k, y = P.y + G.reticle.y * k, r = Math.max(14, 22 * Math.min(1.4, k * 1.1));
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(23,10,54,0.55)'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = C.mint; ctx.stroke();
      ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * r * 0.45, y + dy * r * 0.45); ctx.lineTo(x + dx * r * 0.8, y + dy * r * 0.8); }
      ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
    }
  }
  // the bottom margin of a card: its name, or her words; her face sticker on the redraw
  function caption(ctx, G, L, i, c, now) {
    const fb = L.fb, y = c.y + c.h - fb / 2 + 0.5, x = c.x + L.f + 2;
    const size = clamp(fb * 0.44, 9.5, 19);
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (i === 0) {
      cameraIcon(ctx, x + size * 0.55, y, size * 0.95);
      ctx.font = `900 ${size}px ${DISPLAY}`; ctx.fillStyle = C.ink2;
      setSpacing(ctx, size * 0.12);
      ctx.fillText('MEMORY', x + size * 1.45, y + 0.5);
      setSpacing(ctx, 0);
      if (G.capLeft) { ctx.textAlign = 'right'; ctx.font = `700 ${size * 0.92}px ${MONO}`; ctx.fillStyle = C.ink2; ctx.fillText(G.capLeft, c.x + c.w - L.f - 2, y + 0.5); }
    } else {
      const fr = Math.min(fb * 0.86, 30), fx = c.x + c.w - L.f - fr + 2, fy = c.y + c.h - fb / 2 - 1;
      const talk = G.say && now - G.say.t0 < G.say.dur ? G.say : null;
      const ta = talk ? clamp((now - talk.t0) / 0.18, 0, 1) * clamp((talk.dur - (now - talk.t0)) / 0.3, 0, 1) : 0;
      if (ta < 1) {
        ctx.globalAlpha = 1 - ta;
        pencilIcon(ctx, x + size * 0.55, y, size);
        ctx.font = `900 ${size}px ${DISPLAY}`; ctx.fillStyle = C.ink2;
        setSpacing(ctx, size * 0.12);
        ctx.fillText('HER REDRAW', x + size * 1.45, y + 0.5);
        setSpacing(ctx, 0);
      }
      if (ta > 0) {
        ctx.globalAlpha = ta;
        let fs = clamp(fb * 0.6, 12, 26);
        ctx.font = `italic 400 ${fs}px ${SERIF}`;
        const maxW = fx - fr - x - 6;
        while (fs > 10 && ctx.measureText(talk.text).width > maxW) { fs -= 1; ctx.font = `italic 400 ${fs}px ${SERIF}`; }
        ctx.fillStyle = C.ink;
        ctx.fillText(talk.text, x, y + 1, maxW);
      }
      ctx.globalAlpha = 1;
      // her face sticker, hopping when she talks, blushing when caught
      const hop = talk && !REDUCED ? Math.abs(Math.sin((now - talk.t0) * 9)) * 2.5 * (1 - clamp((now - talk.t0) / 0.7, 0, 1)) : 0;
      ctx.save(); ctx.translate(fx, fy - hop); ctx.rotate(-0.12);
      ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.fillStyle = C.lav; ctx.fill();
      if (faceOk) { ctx.save(); ctx.clip(); ctx.drawImage(face, -fr, -fr, fr * 2, fr * 2); ctx.restore(); }
      const blush = G.blush ? clamp(1 - (now - G.blush) / 2.4, 0, 1) : 0;
      if (blush > 0) {
        ctx.globalAlpha = 0.55 * Math.min(1, blush * 2);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * fr * 0.37, fr * 0.02, fr * 0.17, fr * 0.09, 0, 0, TAU); ctx.fillStyle = '#ff6fa0'; ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- the strip: found dots, the clock's bar and time ----------
  function strip(ctx, G, L, now) {
    const S = L.strip, run = G.run;
    if (!run) return;
    const x0 = S.x + L.btnW + (L.btnW ? 12 : 4), x1 = S.x + S.w - L.btnW - (L.btnW ? 12 : 4);
    const mw = x1 - x0, cy = S.y + S.h / 2;
    const daily = run.mode === 'daily';
    const low = !daily && run.timeLeft < 10 && !run.cleared;
    const twoRows = mw < 250 && !L.demo;
    const dotR = L.demo ? 5 : clamp(S.h * 0.13, 6, 9.5);
    const dotsW = 5 * dotR * 2 + 4 * dotR * 0.8;
    const rowY1 = twoRows ? S.y + S.h * 0.3 : cy, rowY2 = twoRows ? S.y + S.h * 0.74 : cy;
    // the found dots ●●●○○
    const dx = twoRows ? x0 + (mw - dotsW) / 2 : x0;
    for (let j = 0; j < 5; j++) {
      const x = dx + dotR + j * dotR * 2.8;
      const got = run.sceneFound[j] ? G.found.find((f) => f.i === j) : null;
      const order = got ? G.found.indexOf(got) : -1;
      const pop = got ? ease.outBack(clamp((now - got.t0) / 0.3, 0, 1)) : 1;
      ctx.beginPath(); ctx.arc(x, rowY1, dotR * (got ? pop : 1), 0, TAU);
      ctx.fillStyle = got ? (order >= 0 ? C.pink : C.pink) : 'rgba(255,250,240,0.12)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = got ? C.ink : 'rgba(255,250,240,0.6)'; ctx.stroke();
      if (got) { ctx.beginPath(); ctx.moveTo(x - dotR * 0.45, rowY1); ctx.lineTo(x - dotR * 0.1, rowY1 + dotR * 0.38); ctx.lineTo(x + dotR * 0.5, rowY1 - dotR * 0.4); ctx.lineWidth = 2; ctx.strokeStyle = C.paper; ctx.lineCap = 'round'; ctx.stroke(); }
    }
    // the time
    const tsz = L.demo ? 13 : clamp(S.h * 0.33, 14, 23);
    ctx.font = `750 ${tsz}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    const secs = daily ? run.elapsed : run.timeLeft;
    const txt = daily ? fmtTenths(secs) : fmtClock(secs);
    const tw = ctx.measureText(daily ? '0:00.0' : '0:00').width;
    const tickPop = low && !REDUCED ? 1 + 0.22 * clamp(((run.timeLeft % 1) - 0.72) / 0.28, 0, 1) : 1;
    ctx.save(); ctx.translate(x1, rowY2); ctx.scale(tickPop, tickPop);
    ctx.fillStyle = low ? C.pink : C.paper; ctx.fillText(txt, 0, 1);
    ctx.restore();
    // the bar (endless: the clock; daily: no bar, the clock counts up)
    const bx0 = twoRows ? x0 : dx + dotsW + 14, bx1 = x1 - tw - 12;
    if (!daily && bx1 - bx0 > 24) {
      const bh = L.demo ? 9 : clamp(S.h * 0.22, 10, 13), by = rowY2 - bh / 2;
      const frac = clamp(run.timeLeft / run.timeMax, 0, 1), show = G.barShow ?? frac;
      roundRect(ctx, bx0, by, bx1 - bx0, bh, bh / 2); ctx.fillStyle = 'rgba(255,250,240,0.1)'; ctx.fill();
      if (show > 0.001) {
        roundRect(ctx, bx0, by, Math.max(bh, (bx1 - bx0) * show), bh, bh / 2);
        const pulse = low && !REDUCED ? 0.75 + 0.25 * Math.sin(now * 12) : 1;
        ctx.globalAlpha = pulse; ctx.fillStyle = low ? C.pink : C.honey; ctx.fill(); ctx.globalAlpha = 1;
      }
      roundRect(ctx, bx0, by, bx1 - bx0, bh, bh / 2); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      if (G.penalty && now - G.penalty < 0.5) {
        const a = 1 - (now - G.penalty) / 0.5;
        roundRect(ctx, bx0 - 2, by - 2, bx1 - bx0 + 4, bh + 4, bh / 2 + 2); ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = C.pink; ctx.stroke(); ctx.globalAlpha = 1;
      }
    } else if (daily && !twoRows) {
      ctx.textAlign = 'left'; ctx.font = `800 ${clamp(S.h * 0.24, 10, 12)}px ${DISPLAY}`; ctx.fillStyle = 'rgba(255,250,240,0.7)';
      setSpacing(ctx, 1.5); ctx.fillText(G.dailyLabel || 'TODAY\'S SCENE', dx + dotsW + 16, rowY2 + 1); setSpacing(ctx, 0);
    }
  }

  // ---------- the demo's fingertip ----------
  function finger(ctx, F, now) {
    if (!F || F.a <= 0) return;
    const press = F.press > 0 ? Math.sin(clamp(F.press, 0, 1) * Math.PI) : 0;
    ctx.save();
    ctx.globalAlpha = F.a;
    if (F.ring > 0 && F.ring < 1) {
      ctx.beginPath(); ctx.arc(F.rx, F.ry, 8 + F.ring * 22, 0, TAU);
      ctx.globalAlpha = F.a * (1 - F.ring); ctx.lineWidth = 3; ctx.strokeStyle = C.paper; ctx.stroke(); ctx.globalAlpha = F.a;
    }
    const fs = F.scale || 1;
    ctx.translate(F.x, F.y); ctx.rotate(-0.42); ctx.scale(fs * (1 - press * 0.1), fs * (1 - press * 0.1));
    const w = 23, len = 74;
    roundRect(ctx, -w / 2 + 3, 5, w, len, w / 2); ctx.fillStyle = 'rgba(23,10,54,0.35)'; ctx.fill();
    roundRect(ctx, -w / 2, 0, w, len, w / 2); ctx.fillStyle = '#ffe0cc'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(214,120,110,0.25)'; ctx.fillRect(w * 0.12, 0, w, len); ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    roundRect(ctx, -w * 0.3, 3.5, w * 0.6, 13, 5); ctx.fillStyle = '#fff3ec'; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.25, 30); ctx.quadraticCurveTo(0, 33, w * 0.25, 30); ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }

  // ---------- the blink: one big picture, the redraw flickering over the memory ----------
  function blinkView(ctx, G, L, now) {
    const B = G.blink;
    const t = now - B.t0, dur = B.dur;
    const inA = ease.outCubic(clamp(t / 0.16, 0, 1)) * clamp((dur - t) / 0.16, 0, 1);
    if (inA <= 0) return;
    const V = L.blinkView;
    ctx.save();
    ctx.globalAlpha = inA * 0.7; ctx.fillStyle = '#0a0418'; ctx.fillRect(L.area.x - 40, L.area.y - 40, L.area.w + 80, L.area.h + 80);
    ctx.globalAlpha = inA;
    const s = 0.94 + 0.06 * inA, cx = V.x + V.w / 2, cy = V.y + V.h / 2;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    roundRect(ctx, V.x - 7, V.y - 7 + 5, V.w + 14, V.h + 14, 6); ctx.fillStyle = C.ink; ctx.fill();
    roundRect(ctx, V.x - 7, V.y - 7, V.w + 14, V.h + 14, 6); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    const a = B.picA || G.picA, b = B.picB || G.picB;
    let mixB;
    if (REDUCED) mixB = 0.5 - 0.5 * Math.cos(t * TAU * 1.1);
    else { const ph = Math.floor(t / 0.2) % 2; mixB = ph ? 1 : 0; }
    ctx.drawImage(a, V.x, V.y, V.w, V.h);
    if (mixB > 0) { ctx.globalAlpha = inA * mixB; ctx.drawImage(b, V.x, V.y, V.w, V.h); ctx.globalAlpha = inA; }
    ctx.lineWidth = 1.5; ctx.strokeRect(V.x, V.y, V.w, V.h);
    // the circles already found, on the big view too
    const k = V.w / W;
    for (const f of G.found) { const R = ringOf(G.sc.diffs[f.i].region, V, k); strokeScribble(ctx, f.sc, R.cx, R.cy, R.rx, R.ry, 1, inA); }
    ctx.font = `900 ${clamp(V.w * 0.03, 11, 15)}px ${DISPLAY}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const tag = mixB > 0.5 ? 'HER REDRAW' : 'MEMORY';
    const tw = ctx.measureText(tag).width;
    roundRect(ctx, V.x + 8, V.y + 8, tw + 16, 22, 11); ctx.fillStyle = mixB > 0.5 ? C.pink : C.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(tag, V.x + 16, V.y + 13);
    ctx.restore();
  }

  function draw(ctx, G, L, vw, vh, dpr, now) {
    ensureBg(vw, vh, dpr);
    ctx.drawImage(bg, 0, 0, vw, vh);
    if (!L || !G.sc) return;
    ctx.save();
    if (G.shake) G.shake.apply(ctx, vw / 2, vh / 2);
    for (let i = 0; i < 2; i++) drawCard(ctx, G, L, i, G.cardT ? G.cardT[i] : null, now);
    strip(ctx, G, L, now);
    G.parts?.draw(ctx);
    G.floats?.draw(ctx);
    if (G.blink) blinkView(ctx, G, L, now);
    finger(ctx, G.finger, now);
    ctx.restore();
  }
  return { draw, ensureBg, ready: () => faceOk, face: () => (faceOk ? face : null) };
}

// ---------- small drawings ----------
function cameraIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  roundRect(ctx, -s * 0.55, -s * 0.36, s * 1.1, s * 0.76, s * 0.14); ctx.fillStyle = C.ink2; ctx.fill();
  roundRect(ctx, -s * 0.22, -s * 0.5, s * 0.44, s * 0.2, s * 0.06); ctx.fill();
  ctx.beginPath(); ctx.arc(0, s * 0.03, s * 0.22, 0, TAU); ctx.fillStyle = C.card; ctx.fill();
  ctx.restore();
}
function pencilIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.78);
  ctx.fillStyle = C.pink; ctx.fillRect(-s * 0.55, -s * 0.17, s * 0.85, s * 0.34);
  ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.17); ctx.lineTo(s * 0.62, 0); ctx.lineTo(s * 0.3, s * 0.17); ctx.closePath(); ctx.fillStyle = '#f2c79b'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.06); ctx.lineTo(s * 0.62, 0); ctx.lineTo(s * 0.5, s * 0.06); ctx.fillStyle = C.ink; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = C.ink; ctx.strokeRect(-s * 0.55, -s * 0.17, s * 0.85, s * 0.34);
  ctx.restore();
}
function setSpacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; }
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  let s = 99;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.6 ? `rgba(90,60,40,${0.03 + rnd() * 0.05})` : `rgba(255,255,255,${0.2 + rnd() * 0.3})`;
    g.fillRect(rnd() * 96, rnd() * 96, 1 + rnd(), 1 + rnd());
  }
  return c;
}
const fmtClock = (s) => { const v = Math.max(0, Math.ceil(s)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
const fmtTenths = (s) => { const v = Math.max(0, s); const m = Math.floor(v / 60); const r = v - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
