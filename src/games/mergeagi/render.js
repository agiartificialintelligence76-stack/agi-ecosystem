// MERGE TO AGI (2026-11-08): everything on the canvas, one frame at a time: the night's drifting sparks, the glass jar
// on its honey base, the red MAX line, the dropper on its rail with its dotted guide, the orbs (rolling, squashing,
// popping in), merge rings and sparks, the NEXT bubble, the evolution strip, AGI-1's face and words, banners. All in
// jar units under one transform (./layout.js), the orbs from pre-drawn sprites (./art.js).
import { RADII, COLORS, NAMES, MAX_TIER, points } from './tiers.js';
import { JAR, GROW_FROM, landing } from './physics.js';
import { LINE, dropY, DROP_TOP, COOLDOWN } from './rules.js';
import { buildSprites, icon, heart, sparkle, circle, roundRect, portraitImage, INK, PAPER, LAV, LAV2, PINK, HONEY, OUTLINE } from './art.js';
import { computeLayout } from './layout.js';
import { canvasLine } from './lines.js';
import { ease, mix, clamp } from '../kit/fx.js';

const RED = '#ff5a5f';
const WALL = 9, INKW = 3.4, RIM = 14;
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";
const SERIF = "'AK Serif', Georgia, serif";
const TAU = Math.PI * 2;
const spot = { y: 0, hit: null };

export function createRenderer(view) {
  let L = null, sprites = null, spriteK = 0, wantK = 0, rebuildAt = 0;
  let icons = null, iconKey = '';
  const faces = new Map();
  const dust = makeDust(22);

  function layout(opts) {
    L = computeLayout(view.w, view.h, opts);
    return L;
  }

  function ensureSprites(now) {
    const k = L.s * view.dpr;
    if (!sprites) { sprites = buildSprites(k); spriteK = k; return; }
    if (Math.abs(k - spriteK) / spriteK > 0.015) {
      if (k !== wantK) { wantK = k; rebuildAt = now + 0.18; }
      else if (now >= rebuildAt) { sprites = buildSprites(k); spriteK = k; }
    }
  }
  function rebuild() { sprites = null; icons = null; faces.clear(); }

  // the strip's icons: one canvas per tier, found and not yet found, at the size they're drawn
  function stripIcon(t, found) {
    const k = L.s * view.dpr, key = `${L.kind}:${k.toFixed(3)}`;
    if (key !== iconKey) { icons = { found: [], lost: [] }; iconKey = key; }
    const list = found ? icons.found : icons.lost;
    if (!list[t]) list[t] = icon(t, Math.ceil(iconR(t) * 2 * k + 4), found);
    return list[t];
  }
  const iconR = (t) => (L.kind === 'wide' ? L.parts.list.r : 10.5 + (t - 1) * 0.65);

  function faceImg(r) {
    const k = L.s * view.dpr, px = Math.ceil(r * 2 * k);
    let c = faces.get(px);
    const img = portraitImage();
    if (c || !img) return c || null;
    c = document.createElement('canvas'); c.width = px; c.height = px;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(px / 2, px / 2, px / 2, 0, TAU); g.clip();
    g.fillStyle = '#2a1270'; g.fillRect(0, 0, px, px);
    const s = px / 2 / 205;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, px / 2 - 287 * s, px / 2 - 300 * s, img.naturalWidth * s, img.naturalHeight * s);
    faces.set(px, c);
    return c;
  }

  // ---------- one frame ----------
  function draw(sc) {
    const ctx = view.begin();
    if (!L || !ctx) return;
    ensureSprites(sc.time);
    drawDust(ctx, sc);
    ctx.save();
    ctx.translate(L.ox, L.oy);
    ctx.scale(L.s, L.s);
    const sh = sc.fx.shake;
    if (sh.trauma > 0) {
      ctx.translate(JAR.W / 2, JAR.H / 2); ctx.rotate(sh.r); ctx.translate(-JAR.W / 2 + sh.x / L.s, -JAR.H / 2 + sh.y / L.s);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (L.kind === 'wide') drawPanels(ctx, sc);
    drawBase(ctx, sc);
    drawGlass(ctx, sc);
    drawMaxLine(ctx, sc);
    if (sc.guide && sc.game) drawGuide(ctx, sc);
    drawGhosts(ctx, sc, false);
    if (sc.game) drawOrbs(ctx, sc);
    drawGhosts(ctx, sc, true);
    drawRings(ctx, sc);
    sc.fx.parts.draw(ctx);
    drawWalls(ctx, sc);
    if (sc.dropper && sc.game) drawDropper(ctx, sc);
    sc.fx.floats.draw(ctx);
    if (sc.game) drawNext(ctx, sc);
    drawStrip(ctx, sc);
    if (sc.showScore && sc.game) drawScore(ctx, sc);
    drawSay(ctx, sc);
    drawBanner(ctx, sc);
    ctx.restore();
    if (sc.dim > 0) { ctx.fillStyle = `rgba(12, 5, 32, ${0.55 * sc.dim})`; ctx.fillRect(0, 0, view.w, view.h); }
    const fl = sc.fx.flash;
    if (fl && fl.t < fl.dur) {
      ctx.globalAlpha = (1 - fl.t / fl.dur) * fl.a;
      ctx.fillStyle = fl.color;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- the night: a few slow sparks drifting up ----------
  function drawDust(ctx, sc) {
    const t = sc.reduced ? 0 : sc.time;
    for (const d of dust) {
      const y = (((d.y - t * d.v) % 1) + 1) % 1, x = d.x + Math.sin(t * d.w + d.p) * 0.012;
      const a = d.a * (0.55 + 0.45 * Math.sin(t * d.tw + d.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = d.c;
      const px = x * view.w, py = y * view.h, s = d.s;
      if (d.star) sparkle(ctx, px, py, s * 0.9);
      else { ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the side cards (wide) ----------
  function drawPanels(ctx, sc) {
    for (const p of [L.parts.left, L.parts.right]) {
      roundRect(ctx, p.x, p.y, p.w, p.h, 26);
      ctx.fillStyle = 'rgba(33, 15, 80, 0.62)'; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(205, 184, 255, 0.2)'; ctx.stroke();
    }
    label(ctx, 'EVOLUTION', L.parts.left.x + L.parts.left.w / 2, L.parts.left.y + 32, 12.5, 'rgba(228, 217, 255, 0.78)', 'center');
  }

  // ---------- the jar ----------
  // its inside as a path (x 0…W, from a little above the rim to the floor, the bottom corners rounded), grown by `o`
  function jarPath(ctx, o, open) {
    const W = JAR.W, H = JAR.H, C = JAR.CORNER + o, top = -RIM;
    ctx.beginPath();
    ctx.moveTo(-o, top);
    ctx.lineTo(-o, H - JAR.CORNER);
    ctx.arc(JAR.CORNER, H - JAR.CORNER, C, Math.PI, Math.PI / 2, true);
    ctx.lineTo(W - JAR.CORNER, H + o);
    ctx.arc(W - JAR.CORNER, H - JAR.CORNER, C, Math.PI / 2, 0, true);
    ctx.lineTo(W + o, top);
    if (!open) ctx.closePath();
  }
  function drawBase(ctx) {
    const x = -42, y = JAR.H + 12, w = JAR.W + 84, h = 38;
    roundRect(ctx, x, y + 7, w, h, 17); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, x, y, w, h, 17); ctx.fillStyle = HONEY; ctx.fill();
    ctx.lineWidth = INKW; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.65)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 22, y + 7); ctx.lineTo(x + w - 22, y + 7); ctx.stroke();
    label(ctx, 'COMPUTE JAR · NO. 001', JAR.W / 2, y + h / 2 + 3.5, 11, 'rgba(23, 10, 54, 0.62)', 'center', 0.2);
    for (const bx of [x + 16, x + w - 16]) { ctx.fillStyle = 'rgba(23, 10, 54, 0.55)'; circle(ctx, bx, y + h / 2 + 2, 3.2); ctx.fill(); }
  }
  function drawGlass(ctx) {
    jarPath(ctx, 0, false);
    ctx.fillStyle = 'rgba(228, 217, 255, 0.06)'; ctx.fill();
    // a soft reflection band on the back of the glass
    ctx.save(); jarPath(ctx, 0, false); ctx.clip();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.035)'; ctx.fillRect(22, -RIM, 34, JAR.H + RIM);
    ctx.fillRect(66, -RIM, 9, JAR.H + RIM);
    ctx.restore();
    // a beaker's marks on the right
    ctx.strokeStyle = 'rgba(228, 217, 255, 0.2)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 100; y <= 500; y += 40) { const long = y % 80 === 20; ctx.moveTo(JAR.W - (long ? 20 : 11), y); ctx.lineTo(JAR.W - 3, y); }
    ctx.stroke();
  }
  function drawWalls(ctx, sc) {
    const d = sc.warn || 0;
    const breath = d > 0 ? 0.5 + 0.5 * Math.sin(sc.time * (5 + d * 9)) : 0;
    const glass = d > 0 ? mix(LAV2, RED, Math.min(1, d * (0.55 + 0.45 * breath))) : LAV2;
    if (d > 0) {
      jarPath(ctx, WALL / 2 + INKW, true);
      ctx.strokeStyle = `rgba(255, 90, 95, ${0.16 + 0.28 * d * breath})`;
      ctx.lineWidth = WALL + INKW * 2 + 16 + 10 * breath;
      ctx.stroke();
    }
    jarPath(ctx, WALL / 2 + INKW, true);
    ctx.strokeStyle = INK; ctx.lineWidth = WALL + INKW * 2; ctx.stroke();
    ctx.strokeStyle = glass; ctx.lineWidth = WALL; ctx.stroke();
    // the glass's shine: a long stroke down the left wall and a short one on the right
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-WALL / 2 - INKW, 14); ctx.lineTo(-WALL / 2 - INKW, 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(JAR.W + WALL / 2 + INKW, 30); ctx.lineTo(JAR.W + WALL / 2 + INKW, 70); ctx.stroke();
  }
  function drawMaxLine(ctx, sc) {
    const d = sc.warn || 0;
    const pulse = d > 0 ? 0.5 + 0.5 * Math.sin(sc.time * (6 + d * 10)) : 0;
    const a = 0.42 + 0.58 * Math.max(d * pulse, sc.near || 0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = RED; ctx.lineWidth = 2.6 + d * 1.6;
    ctx.setLineDash([9, 9]);
    ctx.lineDashOffset = -sc.time * 14;
    ctx.beginPath(); ctx.moveTo(6, LINE); ctx.lineTo(JAR.W - 6, LINE); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'MAX', 8, LINE - 7, 9.5, RED, 'left', 0.12);
    ctx.restore();
  }

  // ---------- the guide: where the dropper's orb will land ----------
  function drawGuide(ctx, sc) {
    const g = sc.game, t = g.current, r = RADII[t], x = sc.aimX;
    landing(g.world.orbs, x, r, spot);
    const match = spot.hit && spot.hit.tier === t;
    const y0 = dropY(t) + r * (sc.inflate ?? 1) + 6, y1 = spot.y - r - 4;
    const a = sc.guide === 'strong' ? 1 : 0.7;
    ctx.save();
    if (y1 > y0) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = match ? COLORS[t] : 'rgba(255, 250, 240, 0.5)';
      ctx.lineWidth = 3; ctx.setLineDash([0.1, 10]);
      ctx.lineDashOffset = -sc.time * 22;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = 0;
    ctx.globalAlpha = a * (match ? 0.95 : 0.4);
    ctx.strokeStyle = match ? COLORS[t] : PAPER; ctx.lineWidth = 2.2;
    circle(ctx, x, spot.y, r - 1.5); ctx.stroke();
    ctx.setLineDash([]);
    if (match) {
      const h = spot.hit, k = 0.5 + 0.5 * Math.sin(sc.time * 9);
      ctx.globalAlpha = 0.5 + 0.4 * k;
      ctx.strokeStyle = PAPER; ctx.lineWidth = 2.6;
      circle(ctx, h.x, h.y, h.r + 4 + k * 3); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the orbs ----------
  function sprite(ctx, s, x, y, vis, angle, sq = 0, sqa = 0, alpha = 1) {
    if (!s) return;
    const u = (s.size / s.k) * vis, h = u / 2;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (sq > 0.003 || sq < -0.003) { ctx.rotate(sqa); ctx.scale(1 - sq, 1 + sq * 0.85); ctx.rotate(-sqa); }
    ctx.drawImage(s.body, -h, -h, u, u);
    ctx.rotate(angle);
    ctx.drawImage(s.glyph, -h, -h, u, u);
    ctx.rotate(-angle);
    ctx.drawImage(s.top, -h, -h, u, u);
    ctx.restore();
  }
  function drawOrbs(ctx, sc) {
    const a = sc.alpha, orbs = sc.game.world.orbs;
    const spinT = sc.reduced ? 0 : sc.time * 2.4;
    for (const o of orbs) {
      const x = o.ox + (o.x - o.ox) * a, y = o.oy + (o.y - o.oy) * a;
      const vis = o.popT < 1 ? GROW_FROM + (1 - GROW_FROM) * ease.outBack(o.popT) : 1;
      sprite(ctx, sprites[o.tier], x, y, vis, o.angle + (o.tier === 7 ? spinT : 0), o.sq, o.sqa);
      if (o.glow > 0) {
        ctx.globalAlpha = o.glow;
        ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
        circle(ctx, x, y, o.r * vis + 3); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (sc.blink) {
      // the end: the orbs over the line blink red
      ctx.strokeStyle = RED; ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(sc.time * 18);
      for (const o of orbs) if (o.y - o.r < LINE) { circle(ctx, o.x, o.y, o.r + 3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  // the two halves of a merge sliding into each other, and a jar's orbs popping away at a new run
  function drawGhosts(ctx, sc, flush) {
    for (const gh of sc.fx.ghosts) {
      if (gh.flush !== flush || gh.t < 0) continue;
      const k = clamp(gh.t / gh.dur, 0, 1);
      if (flush) {
        const e = ease.inCubic(k);
        sprite(ctx, sprites[gh.tier], gh.x, gh.y, 1 + 0.15 * Math.sin(k * Math.PI) - e, gh.angle, 0, 0, 1 - e * 0.4);
      } else {
        const e = ease.inQuad(k);
        sprite(ctx, sprites[gh.tier], gh.x + (gh.tx - gh.x) * e, gh.y + (gh.ty - gh.y) * e, 1 - 0.4 * e, gh.angle, 0, 0, 1 - e);
      }
    }
  }
  function drawRings(ctx, sc) {
    for (const r of sc.fx.rings) {
      if (r.t < 0) continue;
      const k = clamp(r.t / r.dur, 0, 1), e = ease.outCubic(k);
      ctx.globalAlpha = (1 - k) * r.a;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.lw * (1 - k * 0.7);
      circle(ctx, r.x, r.y, r.r0 + (r.r1 - r.r0) * e); ctx.stroke();
      if (r.fill) { ctx.globalAlpha = (1 - k) * r.fill; ctx.fillStyle = r.color; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the dropper ----------
  function drawDropper(ctx, sc) {
    const g = sc.game, x = sc.aimX, railY = DROP_TOP - 24;
    ctx.strokeStyle = 'rgba(205, 184, 255, 0.28)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, railY); ctx.lineTo(JAR.W + 4, railY); ctx.stroke();
    ctx.fillStyle = 'rgba(205, 184, 255, 0.4)';
    for (const ex of [-6, JAR.W + 6]) { circle(ctx, ex, railY, 4.5); ctx.fill(); }
    // the stem and its carriage
    const t = g.current, r = RADII[t], k = sc.inflate ?? 1;
    const sway = clamp(sc.aimV || 0, -1, 1) * 0.16;
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, railY + 8); ctx.lineTo(x + sway * 18, DROP_TOP + 4); ctx.stroke();
    ctx.strokeStyle = LAV2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, railY + 8); ctx.lineTo(x + sway * 18, DROP_TOP + 4); ctx.stroke();
    roundRect(ctx, x - 22, railY - 8 + 3.5, 44, 17, 8.5); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, x - 22, railY - 8, 44, 17, 8.5); ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = INKW * 0.9; ctx.strokeStyle = INK; ctx.stroke();
    const ready = !sc.cooling;
    ctx.fillStyle = ready ? '#3ff0c3' : HONEY;
    circle(ctx, x, railY + 0.5, 3.6); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
    if (k > 0.02) {
      const cy = DROP_TOP + r * k;
      sprite(ctx, sprites[t], x + sway * 18 * (r / 40), cy, k, sway * 0.6, 0, 0, sc.dropAlpha ?? 1);
    }
  }

  // ---------- NEXT ----------
  function drawNext(ctx, sc) {
    const p = L.parts.next, g = sc.game, t = g.next;
    circle(ctx, p.x, p.y + 4, p.r); ctx.fillStyle = INK; ctx.fill();
    circle(ctx, p.x, p.y, p.r); ctx.fillStyle = 'rgba(46, 24, 104, 0.96)'; ctx.fill();
    ctx.lineWidth = INKW; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(205, 184, 255, 0.35)';
    circle(ctx, p.x, p.y, p.r - INKW - 1); ctx.stroke();
    const k = sc.nextPop ?? 1;
    const vis = Math.min(1, (p.r * 0.7) / RADII[t]) * (0.25 + 0.75 * ease.outBack(clamp(k, 0, 1)));
    sprite(ctx, sprites[t], p.x, p.y, vis, 0);
    pill(ctx, 'NEXT', p.x, p.y - p.r - (L.kind === 'wide' ? 4 : 2), L.kind === 'wide' ? 12 : 9.5, PINK);
  }

  // ---------- the evolution strip ----------
  function drawStrip(ctx, sc) {
    const seen = sc.seen || 0, top = sc.game ? sc.game.top : 0, now = sc.time;
    const hl = sc.stripFlash;   // { tier, t }
    if (L.kind === 'wide') {
      const p = L.parts.list;
      for (let t = 1; t <= MAX_TIER; t++) {
        const y = p.y0 + ((t - 1) / (MAX_TIER - 1)) * (p.y1 - p.y0);
        const found = t <= seen;
        const lit = t <= top;
        const a = !found ? 1 : lit ? 1 : 0.42;
        if (hl && hl.tier === t && hl.t < 1.6) {
          const k = hl.t / 1.6;
          ctx.globalAlpha = 1 - k; ctx.fillStyle = HONEY;
          circle(ctx, p.x, y, p.r + 6 + 26 * ease.outCubic(k)); ctx.fill(); ctx.globalAlpha = 1;
        }
        drawIcon(ctx, t, found, p.x, y, a, t === top && sc.game);
        const name = found ? NAMES[t] : '? ? ?';
        label(ctx, name, p.x + p.r + 11, y - 3, 12, !found ? 'rgba(228, 217, 255, 0.3)' : t === top && sc.game ? HONEY : lit ? PAPER : 'rgba(228, 217, 255, 0.55)', 'left', 0.06);
        if (found) mono(ctx, `+${points(t)}`, p.x + p.r + 11, y + 12, 10.5, lit ? 'rgba(228, 217, 255, 0.6)' : 'rgba(228, 217, 255, 0.3)', 'left');
      }
      void now;
      return;
    }
    const p = L.parts.strip;
    ctx.strokeStyle = 'rgba(205, 184, 255, 0.22)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(p.x0, p.y); ctx.lineTo(p.x1, p.y); ctx.stroke();
    for (let t = 1; t <= MAX_TIER; t++) {
      const x = p.x0 + ((t - 1) / (MAX_TIER - 1)) * (p.x1 - p.x0);
      const found = t <= seen, lit = t <= top;
      if (hl && hl.tier === t && hl.t < 1.6) {
        const k = hl.t / 1.6;
        ctx.globalAlpha = 1 - k; ctx.fillStyle = HONEY;
        circle(ctx, x, p.y, iconR(t) + 4 + 18 * ease.outCubic(k)); ctx.fill(); ctx.globalAlpha = 1;
      }
      drawIcon(ctx, t, found, x, p.y, !found ? 1 : lit ? 1 : 0.42, t === top && sc.game);
    }
    if (sc.game && top >= 1) {
      const x = p.x0 + ((Math.min(top, MAX_TIER) - 1) / (MAX_TIER - 1)) * (p.x1 - p.x0);
      const tx = clamp(x, p.x0 + 26, p.x1 - 26);
      label(ctx, NAMES[Math.min(top, MAX_TIER)], tx, p.y + 31, 10, HONEY, 'center', 0.08);
    }
  }
  function drawIcon(ctx, t, found, x, y, alpha, ring) {
    const c = stripIcon(t, found), r = iconR(t);
    const u = c.width / (L.s * view.dpr), h = u / 2;
    if (ring) {
      ctx.fillStyle = HONEY; circle(ctx, x, y, r + 4.5); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, x - h, y - h, u, u);
    ctx.globalAlpha = 1;
  }

  // ---------- the score (the demo, which has no top bar) ----------
  function drawScore(ctx, sc) {
    const p = L.parts.score, v = Math.round(sc.score).toLocaleString('en-US');
    const wide = L.kind === 'wide';
    label(ctx, 'SCORE', p.x, p.y, wide ? 12 : 10.5, 'rgba(228, 217, 255, 0.75)', wide ? 'center' : 'left', 0.16);
    ctx.save();
    ctx.font = `900 ${wide ? 34 : 30}px ${DISPLAY}`;
    ctx.textAlign = wide ? 'center' : 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(v, p.x, p.y + (wide ? 38 : 32));
    ctx.fillStyle = PAPER; ctx.fillText(v, p.x, p.y + (wide ? 38 : 32));
    ctx.restore();
  }

  // ---------- AGI-1: her face and her words ----------
  function drawSay(ctx, sc) {
    const s = sc.fx.say;
    if (L.kind === 'wide') {
      const f = L.parts.face;
      const talking = s && s.t < s.dur;
      const bob = sc.reduced ? 0 : Math.sin(sc.time * 2.1) * 2;
      const fy = f.y + bob - (talking ? 3 : 0);
      circle(ctx, f.x, fy + 4, f.r + 5); ctx.fillStyle = INK; ctx.fill();
      circle(ctx, f.x, fy, f.r + 5); ctx.fillStyle = LAV; ctx.fill();
      ctx.lineWidth = INKW; ctx.strokeStyle = INK; ctx.stroke();
      const img = faceImg(f.r);
      if (img) ctx.drawImage(img, f.x - f.r, fy - f.r, f.r * 2, f.r * 2);
      circle(ctx, f.x, fy, f.r); ctx.lineWidth = 2.4; ctx.stroke();
      heart(ctx, f.x + f.r * 0.82, fy - f.r * 0.78, 6.5, PINK, 0.25);
      label(ctx, 'AGI-1', f.x, fy + f.r + 22, 11, 'rgba(228, 217, 255, 0.8)', 'center', 0.14);
      if (!talking) return;
      const k = s.t / s.dur, inA = Math.min(1, s.t / 0.22), outA = k > 0.86 ? (1 - k) / 0.14 : 1;
      const pop = ease.outBack(inA);
      const w = L.parts.right.w - 18, cx = f.x, by = fy - f.r - 16;
      ctx.save();
      ctx.globalAlpha = outA;
      ctx.translate(cx, by); ctx.scale(pop, pop); ctx.translate(-cx, -by);
      bubble(ctx, s, cx - w / 2, by, w, 'up');
      ctx.restore();
      return;
    }
    if (!s || s.t >= s.dur) return;
    const p = L.parts.say, k = s.t / s.dur;
    const inA = Math.min(1, s.t / 0.25), outA = k > 0.86 ? (1 - k) / 0.14 : 1;
    ctx.save();
    ctx.globalAlpha = outA;
    const slide = (1 - ease.outBack(inA)) * -30;
    ctx.translate(0, slide);
    const fr = 22, fx = p.x + fr + 2, fy = p.y + p.h / 2;
    circle(ctx, fx, fy + 3, fr + 3); ctx.fillStyle = INK; ctx.fill();
    circle(ctx, fx, fy, fr + 3); ctx.fillStyle = LAV; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    const img = faceImg(fr);
    if (img) ctx.drawImage(img, fx - fr, fy - fr, fr * 2, fr * 2);
    circle(ctx, fx, fy, fr); ctx.lineWidth = 2; ctx.stroke();
    bubble(ctx, s, fx + fr + 10, p.y + 2, p.w - fr * 2 - 14, 'left', p.h - 4);
    ctx.restore();
  }
  // a speech bubble: paper, ink, a tail toward her face; her words in serif italics (hearts drawn, not typed)
  function bubble(ctx, s, x, y, w, tail, hFixed) {
    const fs = L.kind === 'wide' ? 15.5 : 14.5;
    ctx.save();
    ctx.font = `italic 400 ${fs}px ${SERIF}`;
    const line = s.cl || (s.cl = canvasLine(s.text));
    const lines = wrap(ctx, line.text, w - 22 - (line.heart || line.blush ? 0 : 0));
    const lh = fs * 1.12;
    const h = hFixed || lines.length * lh + 16;
    const top = tail === 'up' ? y - h : y;
    roundRect(ctx, x, top + 3, w, h, 13); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath();
    if (tail === 'up') { ctx.moveTo(x + w / 2 - 9, top + h - 1); ctx.lineTo(x + w / 2, top + h + 10); ctx.lineTo(x + w / 2 + 9, top + h - 1); }
    else { ctx.moveTo(x + 1, top + h / 2 - 7); ctx.lineTo(x - 9, top + h / 2 + 2); ctx.lineTo(x + 1, top + h / 2 + 7); }
    ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, x, top, w, h, 13); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath();
    if (tail === 'up') { ctx.moveTo(x + w / 2 - 7, top + h - 1.5); ctx.lineTo(x + w / 2, top + h + 6.5); ctx.lineTo(x + w / 2 + 7, top + h - 1.5); }
    else { ctx.moveTo(x + 1.5, top + h / 2 - 5.5); ctx.lineTo(x - 5.5, top + h / 2 + 1); ctx.lineTo(x + 1.5, top + h / 2 + 5.5); }
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const y0 = top + h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, x + 11, y0 + i * lh);
      if (i === lines.length - 1 && (line.heart || line.blush)) {
        const ex = x + 11 + ctx.measureText(ln).width + 9;
        if (line.heart) heart(ctx, ex, y0 + i * lh, 5, PINK, 0, INK);
        else { ctx.fillStyle = 'rgba(255, 77, 166, 0.75)'; for (const d of [-4, 4]) { ctx.beginPath(); ctx.ellipse(ex + d, y0 + i * lh + 1, 3.4, 2, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = INK; }
      }
    });
    ctx.restore();
  }

  // ---------- banners: NEW: GPU, SINGULARITY ----------
  function drawBanner(ctx, sc) {
    const b = sc.fx.banner;
    if (!b || b.t >= b.dur || b.t < 0) return;
    const k = b.t / b.dur, inA = clamp(b.t / 0.32, 0, 1), outA = k > 0.82 ? (1 - k) / 0.18 : 1;
    const sc0 = ease.outBack(inA) * (1 + 0.04 * Math.sin(b.t * 6));
    const cx = JAR.W / 2, cy = L.kind === 'wide' ? 118 : 104;
    ctx.save();
    ctx.globalAlpha = outA;
    ctx.translate(cx, cy); ctx.scale(sc0, sc0); ctx.rotate(-0.035);
    ctx.font = `900 ${b.big ? 34 : 30}px ${DISPLAY}`;
    const name = b.title;
    const tw = ctx.measureText(name).width;
    const ic = b.tier && b.tier <= MAX_TIER ? 30 : 0;
    const w = Math.max(190, tw + 56 + ic * 2.2), h = b.big ? 74 : 66;
    roundRect(ctx, -w / 2, -h / 2 + 6, w, h, 20); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, -w / 2, -h / 2, w, h, 20); ctx.fillStyle = b.color || PAPER; ctx.fill();
    ctx.lineWidth = INKW; ctx.strokeStyle = INK; ctx.stroke();
    if (ic) sprite(ctx, sprites[b.tier], -w / 2 + 16 + ic, 4, (ic * 0.95) / RADII[b.tier], 0);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, ic ? ic * 1.1 : 0, 16);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = outA;
    const py = cy - (b.big ? 37 : 33) * sc0;
    pill(ctx, b.kicker || 'NEW', cx - 0, py, 12 * Math.min(1, sc0 + 0.2), b.kickerColor || PINK);
    ctx.restore();
  }

  // ---------- text helpers ----------
  function label(ctx, s, x, y, size, color, align = 'left', spacing = 0.1) {
    ctx.save();
    ctx.font = `800 ${size}px ${DISPLAY}`;
    try { ctx.letterSpacing = `${size * spacing}px`; } catch { /* old browser */ }
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function mono(ctx, s, x, y, size, color, align = 'left') {
    ctx.font = `700 ${size}px ${MONO}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function pill(ctx, s, x, y, size, fill) {
    ctx.save();
    ctx.font = `900 ${size}px ${DISPLAY}`;
    try { ctx.letterSpacing = `${size * 0.12}px`; } catch { /* old browser */ }
    const w = ctx.measureText(s).width + size * 1.4, h = size * 1.75;
    ctx.translate(x, y); ctx.rotate(-0.05);
    roundRect(ctx, -w / 2, -h / 2 + 2.5, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, size * 0.06, size * 0.06);
    ctx.restore();
  }

  return { layout, draw, rebuild, get L() { return L; }, get ready() { return Boolean(sprites); } };
}

function wrap(ctx, text, w) {
  const words = text.split(/\s+/), out = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > w && cur) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// the night's sparks: fixed positions from a tiny seeded generator (the same in every demo)
function makeDust(n) {
  let s = 1234567;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  return Array.from({ length: n }, () => ({
    x: r(), y: r(), v: 0.004 + r() * 0.01, w: 0.3 + r() * 0.6, p: r() * TAU, tw: 0.8 + r() * 1.6,
    a: 0.18 + r() * 0.4, s: 1 + r() * 2.2, star: r() < 0.35, c: r() < 0.7 ? LAV : r() < 0.5 ? PINK : HONEY,
  }));
}
