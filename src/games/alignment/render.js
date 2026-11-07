// ALIGNMENT's drawing: the cozy night lab behind everything, the four meters and the day, the deck, the card in hand
// (its face drawn once into its own canvas, then moved, tilted and flipped every frame), the choice it leans toward,
// the ending's card, and the title screen's fan of faces. Plain 2D canvas; every picture comes from ./art.js.
import { roundRect, star, clamp, ease, lerp, mix } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { WHO, METER_NAMES } from './cards.js';
import { DANGER } from './engine.js';
import { faceLayout } from './layout.js';
import {
  INK, PAPER, HONEY, PINK, VIOLET, drawBust, drawWindowBg, drawGlyph, meterIcon, meterMark, drawCardBack, drawScene,
} from './art.js';

export const BG = '#1b1030';
const LIQUID = '#7a4dff', LIQUID_TOP = '#a487ff';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const SANS = "'AK Sans', system-ui, sans-serif";
const SERIF = "'AK Serif', Georgia, serif";
const MONO = "'AK Mono', ui-monospace, monospace";

// her own portrait, for her cards
const portrait = typeof Image === 'function' ? new Image() : null;
let portraitReady = false;
if (portrait) { portrait.decoding = 'async'; portrait.onload = () => { portraitReady = true; }; portrait.src = '/images/agi1-portrait.webp'; }
export const portraitLoaded = () => portraitReady;

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n) {
  let s = '', v = Math.max(1, Math.floor(n));
  for (const [k, r] of ROMAN) while (v >= k) { s += r; v -= k; }
  return s;
}

// words wrapped to a width (a "\n" always breaks)
export function wrap(ctx, text, width) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

function canvasOf(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

// her portrait into a window (cover, her face in its upper middle)
function drawPortrait(ctx, x, y, w, h) {
  if (!portraitReady) { drawBust(ctx, 'fans', x, y, w, h); return; }
  const s = Math.max(w / 384, h / 330) * 1.02;
  const dw = 384 * s, dh = 384 * s;
  ctx.drawImage(portrait, x + (w - dw) / 2, y + Math.min(0, h * 0.02 - 6 * s), dw, dh);
}

// ---------- a card's face, drawn once ----------
export function makeFace(card, w, h, kind, dpr, { day = 1, chained = false } = {}) {
  const { c, ctx } = canvasOf(w, h, dpr);
  const F = faceLayout(w, h, kind);
  const who = WHO[card.who];
  paperCard(ctx, w, h, F.r);
  // the corner glyph and the day in numerals, tarot-style
  ctx.beginPath(); ctx.arc(F.glyph.x, F.glyph.y, F.glyph.r, 0, Math.PI * 2); ctx.fillStyle = who.bg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  drawGlyph(ctx, who.glyph, F.glyph.x, F.glyph.y, F.glyph.r * 0.56, card.who === 'glitch' ? PAPER : INK);
  ctx.font = `800 ${Math.round(F.glyph.r * 0.78)}px ${DISPLAY}`;
  ctx.fillStyle = '#4a3d6e'; ctx.textBaseline = 'middle';
  ctx.textAlign = kind === 'wide' ? 'right' : 'center';
  ctx.fillText(`DAY · ${roman(day)}`, F.numeral.x, F.numeral.y + 1);
  if (kind !== 'wide') { // the mirrored glyph, top right
    const gx = w - F.glyph.x;
    ctx.beginPath(); ctx.arc(gx, F.glyph.y, F.glyph.r, 0, Math.PI * 2); ctx.fillStyle = who.bg; ctx.fill(); ctx.stroke();
    drawGlyph(ctx, who.glyph, gx, F.glyph.y, F.glyph.r * 0.56, card.who === 'glitch' ? PAPER : INK);
  }
  // the portrait window
  const { win } = F;
  const wr = Math.round(F.r * 0.62);
  ctx.save(); roundRect(ctx, win.x, win.y, win.w, win.h, wr); ctx.clip();
  drawWindowBg(ctx, win.x, win.y, win.w, win.h, who.bg, { dark: card.who === 'glitch' });
  if (card.who === 'agi1') drawPortrait(ctx, win.x, win.y, win.w, win.h);
  else drawBust(ctx, card.who, win.x + win.w * 0.04, win.y + win.h * 0.03, win.w * 0.92, win.h * 0.97);
  ctx.restore();
  roundRect(ctx, win.x, win.y, win.w, win.h, wr); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  // a chained card's ribbon: it follows the last one
  if (chained) ribbon(ctx, kind === 'wide' ? win.x + win.w - 8 : w - F.pad - 6, win.y + 10, Math.max(26, w * 0.09));
  // the name (a plate over the window's edge on a tall card; a heading beside the window on a wide one)
  if (kind === 'wide') {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${F.name.fs}px ${DISPLAY}`; ctx.fillStyle = INK;
    ctx.fillText(who.name.toUpperCase(), F.name.x, F.name.y);
    ctx.font = `italic ${F.name.fs * 0.9}px ${SERIF}`; ctx.fillStyle = '#4a3d6e';
    ctx.fillText(who.role, F.name.x, F.name.y + F.name.fs * 1.15);
  } else {
    ctx.font = `900 ${F.plate.fs}px ${DISPLAY}`;
    const name = who.name.toUpperCase();
    const pw = ctx.measureText(name).width + F.plate.h * 1.1, ph = F.plate.h;
    const px = (w - pw) / 2, py = F.plate.cy - ph / 2;
    roundRect(ctx, px, py + 3, pw, ph, ph / 2); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fillStyle = card.who === 'agi1' ? PINK : HONEY; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, F.plate.cy + 1);
    ctx.font = `italic ${F.role.fs}px ${SERIF}`; ctx.fillStyle = '#4a3d6e';
    ctx.fillText(who.role, w / 2, F.role.y);
  }
  const fit = drawWords(ctx, card, F);
  return { canvas: c, F, fit };
}

function paperCard(ctx, w, h, r) {
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, r);
  ctx.fillStyle = PAPER; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  const ins = Math.max(5, w * 0.022);
  roundRect(ctx, ins, ins, w - ins * 2, h - ins * 2, r * 0.7);
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(23,10,54,0.28)'; ctx.stroke();
}

function ribbon(ctx, x, y, s) {
  // a honey tab with an arrow, hanging over the window's corner
  roundRect(ctx, x - s, y - s * 0.32 + 2, s, s * 0.64, s * 0.2); ctx.fillStyle = INK; ctx.fill();
  roundRect(ctx, x - s, y - s * 0.32, s, s * 0.64, s * 0.2); ctx.fillStyle = HONEY; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  arrow(ctx, x - s / 2, y, s * 0.42, 1, INK, 2.2);
}
export function arrow(ctx, x, y, len, dir, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x - (len / 2) * dir, y); ctx.lineTo(x + (len / 2) * dir, y);
  ctx.moveTo(x + (len / 2) * dir - len * 0.32 * dir, y - len * 0.3); ctx.lineTo(x + (len / 2) * dir, y); ctx.lineTo(x + (len / 2) * dir - len * 0.32 * dir, y + len * 0.3);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

// the card's words, in the voice of who says them
function drawWords(ctx, card, F) {
  const T = F.text, voice = WHO[card.who].voice;
  const room = T.bottom - T.y;
  const cx = T.x + T.w / 2;
  ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  const align = F.kind === 'wide' ? 'left' : 'center';
  const ax = align === 'left' ? T.x : cx;
  let fit = { ok: false, k: 0 };
  for (let k = 1; k >= 0.7; k -= 0.06) {
    const fs = T.fs * k;
    if (voice === 'chat') {
      ctx.font = `600 ${fs * 0.92}px ${MONO}`;
      const lines = card.text.split('\n');
      const bh = fs * 1.62, gap = fs * 0.32;
      const total = lines.length * bh + (lines.length - 1) * gap;
      if (total > room && k > 0.71) continue;
      fit = { ok: total <= room + 1, k };
      let y = T.y + Math.max(0, (room - total) / 2);
      lines.forEach((ln, i) => {
        const text = ln.replace(/^>\s?/, '');
        const tw = Math.min(T.w - fs, ctx.measureText(text).width + fs * 1.3);
        const bx = i % 2 ? T.x + T.w - tw : T.x;
        roundRect(ctx, bx, y, tw, bh, bh * 0.42);
        ctx.fillStyle = ['#e4d9ff', '#d4f09a', '#ffe17a'][i % 3]; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + fs * 0.65, y + bh / 2 + 1, tw - fs * 1.1);
        y += bh + gap;
      });
      return fit;
    }
    if (voice === 'cat') {
      const meowFs = fs * 1.2, kickFs = Math.max(8, fs * 0.6), bodyFs = fs * 1.14;
      ctx.font = `italic ${bodyFs}px ${SERIF}`;
      const lines = wrap(ctx, card.text, T.w);
      const lh = bodyFs * 1.14;
      const total = meowFs * 1.15 + kickFs * 1.9 + lines.length * lh;
      if (total > room && k > 0.71) continue;
      fit = { ok: total <= room + 1, k };
      let y = T.y + Math.max(0, (room - total) / 2) + meowFs * 0.9;
      ctx.textAlign = align;
      ctx.font = `900 ${meowFs}px ${DISPLAY}`; ctx.fillStyle = INK; ctx.fillText(card.meow || 'Mrrp.', ax, y);
      y += kickFs * 1.75;
      ctx.font = `800 ${kickFs}px ${DISPLAY}`; ctx.fillStyle = '#6b3bff'; ctx.fillText('TRANSLATION', ax, y);
      y += lh * 0.98;
      ctx.font = `italic ${bodyFs}px ${SERIF}`; ctx.fillStyle = INK;
      for (const l of lines) { ctx.fillText(l, ax, y); y += lh; }
      return fit;
    }
    let font, size, lhK;
    if (voice === 'her') { size = fs * 1.2; font = `italic ${size}px ${SERIF}`; lhK = 1.13; }
    else if (voice === 'caps') { size = fs * 0.86; font = `800 ${size}px ${DISPLAY}`; lhK = 1.24; }
    else { size = fs; font = `500 ${size}px ${SANS}`; lhK = 1.32; }
    ctx.font = font;
    const lines = wrap(ctx, voice === 'caps' ? card.text.toUpperCase() : card.text, T.w);
    const lh = size * lhK;
    if (lines.length * lh > room + lh * 0.2 && k > 0.71) continue;
    fit = { ok: lines.length * lh <= room + lh * 0.2, k };
    let y = T.y + Math.max(0, (room - lines.length * lh) / 2) + size * 0.92;
    ctx.textAlign = align; ctx.fillStyle = voice === 'caps' ? '#3b2d6e' : INK;
    for (const l of lines) { ctx.fillText(l, ax, y); y += lh; }
    return fit;
  }
  return fit;
}

// ---------- an ending's card ----------
export function makeEndingFace(ending, w, h, kind, dpr, { found = 0, total = 16 } = {}) {
  const { c, ctx } = canvasOf(w, h, dpr);
  const F = faceLayout(w, h, kind);
  paperCard(ctx, w, h, F.r);
  const secret = Boolean(ending.secret);
  // the kicker
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(F.glyph.r * 0.95)}px ${DISPLAY}`;
  ctx.fillStyle = secret ? '#b8860b' : '#6b3bff';
  ctx.textAlign = kind === 'wide' ? 'left' : 'center';
  const kick = `${secret ? 'SECRET ENDING' : 'ENDING'} · ${found}/${total}`;
  ctx.fillText(kick, kind === 'wide' ? F.glyph.x - F.glyph.r : w / 2, F.numeral.y + 1);
  // the scene
  const { win } = F;
  const wr = Math.round(F.r * 0.62);
  ctx.save(); roundRect(ctx, win.x, win.y, win.w, win.h, wr); ctx.clip();
  drawWindowBg(ctx, win.x, win.y, win.w, win.h, secret ? '#ffe17a' : '#2d1f5e', { dark: !secret });
  const s = Math.min(win.w, win.h) * 0.86;
  drawScene(ctx, ending.art, win.x + (win.w - s) / 2, win.y + (win.h - s) / 2 + (kind === 'wide' ? 0 : s * 0.02), s);
  ctx.restore();
  roundRect(ctx, win.x, win.y, win.w, win.h, wr); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  // its name
  const name = ending.name.toUpperCase();
  if (kind === 'wide') {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${F.name.fs}px ${DISPLAY}`; ctx.fillStyle = INK;
    const lines = wrap(ctx, name, F.text.w);
    lines.forEach((l, i) => ctx.fillText(l, F.name.x, F.name.y + i * F.name.fs * 1.05));
    const T = { ...F.text, y: F.name.y + (lines.length - 1) * F.name.fs * 1.05 + F.name.fs * 0.6 };
    endingWords(ctx, ending.text, T, 'left');
  } else {
    let fs = F.plate.fs;
    ctx.font = `900 ${fs}px ${DISPLAY}`;
    while (ctx.measureText(name).width > w - F.pad * 4 - F.plate.h && fs > 10) { fs -= 1; ctx.font = `900 ${fs}px ${DISPLAY}`; }
    const pw = ctx.measureText(name).width + F.plate.h * 1.1, ph = F.plate.h;
    const px = (w - pw) / 2, py = F.plate.cy - ph / 2;
    roundRect(ctx, px, py + 3, pw, ph, ph / 2); ctx.fillStyle = INK; ctx.fill();
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fillStyle = secret ? HONEY : PINK; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, F.plate.cy + 1);
    endingWords(ctx, ending.text, { ...F.text, y: F.plate.cy + ph / 2 + 4 }, 'center');
  }
  return { canvas: c, F };
}
function endingWords(ctx, text, T, align) {
  for (let fs = T.fs * 1.22; fs >= T.fs * 0.8; fs -= 0.5) {
    ctx.font = `italic ${fs}px ${SERIF}`;
    const lines = wrap(ctx, text, T.w);
    const lh = fs * 1.12;
    if (lines.length * lh > T.bottom - T.y && fs > T.fs * 0.82) continue;
    let y = T.y + Math.max(0, (T.bottom - T.y - lines.length * lh) / 2) + fs * 0.9;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
    const x = align === 'left' ? T.x : T.x + T.w / 2;
    for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
    return;
  }
}

export function makeBack(w, h, dpr) {
  const { c, ctx } = canvasOf(w, h, dpr);
  drawCardBack(ctx, w, h, Math.max(12, Math.round(Math.min(w, h) * 0.065)));
  return c;
}

// ---------- the lab behind it all (drawn once a size) ----------
export function makeBackground(W, H, dpr) {
  const { c, ctx } = canvasOf(W, H, dpr);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // a soft pool of lamplight where the card sits
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.6);
  g.addColorStop(0, 'rgba(122,77,255,0.13)'); g.addColorStop(1, 'rgba(122,77,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // the dot field
  const step = 24;
  ctx.fillStyle = 'rgba(228,217,255,0.075)';
  for (let y = step / 2, j = 0; y < H; y += step, j++) for (let x = (j % 2 ? step : step / 2); x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); }
  // shelves: the lab's silhouettes on both sides
  const S = '#251645', S2 = '#2e1c55';
  const shelf = (x0, x1, y) => { ctx.fillStyle = S2; ctx.fillRect(x0, y, x1 - x0, 7); ctx.fillStyle = S; ctx.fillRect(x0, y + 7, x1 - x0, 4); };
  const side = (flip) => {
    ctx.save();
    if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    const sw = Math.min(300, W * 0.24), h0 = H * 0.3;
    ctx.fillStyle = S; ctx.fillRect(0, h0, sw, H - h0);
    ctx.fillStyle = BG; ctx.fillRect(8, h0 + 8, sw - 16, H - h0);
    for (let k = 0; k < 4; k++) {
      const y = h0 + 70 + k * 120;
      if (y > H - 20) break;
      shelf(0, sw, y);
      // books, a jar, a plant, beakers
      let x = 16;
      const rnd = (n) => ((Math.sin((k + 1) * 91.7 + n * 13.3 + (flip ? 7 : 0)) + 1) / 2);
      while (x < sw - 30) {
        const kind = Math.floor(rnd(x) * 4);
        ctx.fillStyle = S2;
        if (kind < 2) { const bw = 10 + rnd(x + 1) * 8, bh = 34 + rnd(x + 2) * 22; ctx.fillRect(x, y - bh, bw, bh); x += bw + 3; }
        else if (kind === 2) { roundRect(ctx, x, y - 30, 26, 30, 6); ctx.fill(); ctx.fillRect(x + 4, y - 36, 18, 7); x += 34; }
        else { ctx.beginPath(); ctx.moveTo(x + 6, y - 34); ctx.lineTo(x + 14, y - 34); ctx.lineTo(x + 24, y); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); x += 32; }
      }
    }
    ctx.restore();
  };
  side(false); side(true);
  // the floor
  ctx.fillStyle = '#140a28'; ctx.fillRect(0, H - Math.min(60, H * 0.06), W, H);
  return c;
}

// the lab's moving bits over the background: a few stars twinkling, the server lights blinking
export function drawLife(ctx, W, H, t, stars) {
  for (const s of stars) {
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.globalAlpha = a;
    star(ctx, s.x * W, s.y * H, s.r, s.r * 0.35, 4);
    ctx.fillStyle = s.c; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- the meters and the day ----------
// m: { key, shown, flash, sign, bounce, dots, dotsK, dim }
export function drawMeters(ctx, L, meters, t, { focus = null, zoom = 0, alpha = 1, only = false, skipFocus = false } = {}) {
  const H = L.hud;
  meters.forEach((m, i) => {
    const isFocus = focus === m.key;
    if ((only && !isFocus) || (skipFocus && isFocus)) return;
    // the culprit of an ending slides to the middle and grows
    const x = isFocus ? lerp(H.meterX[i], L.W / 2, ease.inOutCubic(zoom)) : H.meterX[i];
    const y = isFocus ? H.iconCy + zoom * H.ms * 0.9 : H.iconCy;
    const k = isFocus ? 1 + zoom * 1.25 : 1;
    ctx.save();
    ctx.globalAlpha = alpha * (focus && !isFocus ? 1 - zoom * 0.6 : 1);
    const danger = m.shown <= DANGER || m.shown >= 100 - DANGER;
    const pulse = danger && !REDUCED ? 1 + 0.06 * (0.5 + 0.5 * Math.sin(t * 9)) : 1;
    const bounce = m.bounce > 0 ? Math.sin((1 - m.bounce) * Math.PI * 3) * m.bounce * 0.18 * (m.sign || 1) : 0;
    const s = (H.ms / 2) * k * pulse * (1 + bounce);
    const yy = y;
    // the dots above it: what the leaning choice would touch (never which way)
    if (m.dots && m.dotsK > 0.01 && !focus) {
      const r = (m.dots === 2 ? H.ms * 0.13 : H.ms * 0.075) * ease.outBack(clamp(m.dotsK, 0, 1));
      ctx.beginPath(); ctx.arc(x, yy - H.ms / 2 - H.dotsH * 0.48 + 1.5, r, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(x, yy - H.ms / 2 - H.dotsH * 0.48, r, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.translate(x, yy);
    ctx.scale(s, s);
    const parts = meterIcon(m.key);
    const u = 1 / s;
    // shadow
    ctx.save(); ctx.translate(0, 3 * u); ctx.lineWidth = 5 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.fillStyle = INK;
    for (const p of parts) { ctx.stroke(p); ctx.fill(p); }
    ctx.restore();
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      ctx.lineWidth = 5 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(p);
      ctx.fillStyle = PAPER; ctx.fill(p);
      // the liquid
      ctx.save(); ctx.clip(p);
      const level = clamp(m.shown, 0, 100) / 100;
      const top = 0.98 - level * 1.98;
      const amp = (REDUCED ? 0.02 : 0.045) + (m.bounce > 0 && !REDUCED ? m.bounce * 0.08 : 0);
      let col = LIQUID, colTop = LIQUID_TOP;
      if (m.flash > 0) { const f = clamp(m.flash, 0, 1); col = mix(LIQUID, m.sign > 0 ? HONEY : PINK, f); colTop = mix(LIQUID_TOP, m.sign > 0 ? '#ffe17a' : '#ff8fc6', f); }
      ctx.beginPath(); ctx.moveTo(-1.2, 1.2);
      for (let xx = -1.2; xx <= 1.21; xx += 0.2) ctx.lineTo(xx, top + Math.sin(xx * 3.2 + t * 3.1 + i) * amp);
      ctx.lineTo(1.2, 1.2); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 3.4 * u; ctx.strokeStyle = colTop;
      ctx.beginPath();
      for (let xx = -1.2; xx <= 1.21; xx += 0.2) ctx[xx === -1.2 ? 'moveTo' : 'lineTo'](xx, top + Math.sin(xx * 3.2 + t * 3.1 + i) * amp);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2.6 * u; ctx.strokeStyle = INK; ctx.stroke(p);
    }
    meterMark(ctx, m.key);
    if (isFocus && zoom > 0.3) {
      ctx.globalAlpha *= clamp((zoom - 0.3) / 0.4, 0, 1);
      ctx.beginPath(); ctx.moveTo(-0.15, -0.95); ctx.lineTo(0.05, -0.45); ctx.lineTo(-0.12, -0.12); ctx.lineTo(0.14, 0.24); ctx.lineTo(0.02, 0.6);
      ctx.moveTo(0.05, -0.45); ctx.lineTo(0.38, -0.3); ctx.moveTo(-0.12, -0.12); ctx.lineTo(-0.42, 0.02);
      ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
    // a warning badge when it's near an edge
    if (danger && !focus) {
      const bx = x + H.ms * 0.42, by = yy - H.ms * 0.4, br = Math.max(7, H.ms * 0.15);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(bx, by + 1.5, br, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fillStyle = PINK; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `900 ${Math.round(br * 1.35)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', bx, by + 1);
      ctx.restore();
    }
    // its name
    ctx.save(); ctx.globalAlpha = alpha * (focus && !isFocus ? 1 - zoom * 0.6 : 1);
    ctx.font = `800 ${H.labelFs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = danger ? '#ff8fc6' : 'rgba(255,250,240,0.78)';
    if (isFocus && zoom > 0) { ctx.font = `900 ${Math.round(H.labelFs * (1 + zoom * 0.7))}px ${DISPLAY}`; ctx.fillStyle = PINK; }
    ctx.fillText(METER_NAMES[m.key].toUpperCase(), x, isFocus ? yy + (H.ms / 2) * k + 10 + H.labelFs * (1 + zoom * 0.7) * 0.5 : H.labelY);
    ctx.restore();
  });
}

// the day badge: a honey seal, its ring filling toward her next version, the number rolling up
export function drawDay(ctx, L, d, t, alpha = 1) {
  const H = L.hud, x = H.dayX, y = H.iconCy, r = H.dayR * (1 + (d.pop || 0) * 0.12);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y + 3, r, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = HONEY; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  // the ring toward the next version
  const rr = r - Math.max(4, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, r * 0.11); ctx.strokeStyle = 'rgba(23,10,54,0.16)'; ctx.stroke();
  if (d.progress > 0.001) {
    ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d.progress); ctx.strokeStyle = VIOLET; ctx.stroke();
  }
  // "DAY" and the number, rolling: the old one leaves upward as the new one comes up
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(8, Math.round(r * 0.26))}px ${DISPLAY}`;
  ctx.fillText('DAY', x, y - r * 0.4);
  const n = String(d.value), fs = Math.round(r * (n.length > 3 ? 0.5 : n.length > 2 ? 0.6 : 0.7));
  ctx.font = `900 ${fs}px ${DISPLAY}`;
  const k = ease.outCubic(clamp(d.roll, 0, 1));
  if (k < 1 && d.prev != null) { ctx.globalAlpha = alpha * (1 - k); ctx.fillText(String(d.prev), x, y + r * 0.16 - k * r * 0.7); }
  ctx.globalAlpha = alpha * Math.min(1, 0.2 + k);
  ctx.fillText(n, x, y + r * 0.16 + (1 - k) * r * 0.7);
  ctx.restore();
  // her version, under it
  ctx.globalAlpha = alpha * 0.85;
  ctx.font = `700 ${H.labelFs}px ${MONO}`; ctx.fillStyle = PAPER; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.version, x, H.labelY);
  ctx.restore();
}

// ---------- the deck and the card in hand ----------
export function drawDeck(ctx, L, back, { fall = 0, alpha = 1, count = 3 } = {}) {
  const C = L.card;
  for (let i = count - 1; i >= 0; i--) {
    const off = (i + 1) * Math.max(3, C.h * 0.009);
    const rot = [0.018, -0.024, 0.03][i] || 0;
    const f = clamp(fall * 1.4 - i * 0.12, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * (1 - f * 0.4);
    ctx.translate(C.cx + f * (i - 1) * 40, C.cy + off + ease.inCubic(f) * L.H * 0.9);
    ctx.rotate(rot + f * (i - 1) * 0.6);
    ctx.drawImage(back, -C.w / 2, -C.h / 2, C.w, C.h);
    ctx.restore();
  }
}

// the card itself: x, y (its centre), rot, sx (its width × for the flip), lift (a shadow lift), face or back
export function drawCardAt(ctx, L, img, { x, y, rot = 0, sx = 1, scale = 1, lift = 0, shadow = true, alpha = 1 }) {
  const C = L.card;
  ctx.save();
  ctx.globalAlpha = alpha;
  // the card turns around its bottom edge
  ctx.translate(x, y + C.h / 2 * scale);
  ctx.rotate(rot);
  ctx.translate(0, -C.h / 2 * scale);
  if (shadow) {
    ctx.save();
    ctx.translate(5 + lift * 6, 7 + lift * 10);
    ctx.scale(sx * scale, scale);
    roundRect(ctx, -C.w / 2, -C.h / 2, C.w, C.h, Math.max(12, Math.min(C.w, C.h) * 0.065));
    ctx.fillStyle = `rgba(10,4,24,${0.55 - lift * 0.15})`; ctx.fill();
    ctx.restore();
  }
  ctx.scale(sx * scale, scale);
  ctx.drawImage(img, -C.w / 2, -C.h / 2, C.w, C.h);
  ctx.restore();
}

// the choice the card leans toward, over its portrait window (card-local, drawn with the card's own transform);
// its words are wrapped once per label, not every frame
const leanMemo = { key: '', lines: [] };
export function drawLean(ctx, L, F, { x, y, rot = 0, scale = 1 }, label, side, a) {
  if (a <= 0.01 || !label) return;
  const C = L.card;
  ctx.save();
  ctx.translate(x, y + C.h / 2 * scale); ctx.rotate(rot); ctx.translate(0, -C.h / 2 * scale); ctx.scale(scale, scale);
  ctx.translate(-C.w / 2, -C.h / 2);
  const { win } = F;
  const wr = Math.round(F.r * 0.62);
  ctx.save(); roundRect(ctx, win.x, win.y, win.w, win.h, wr); ctx.clip();
  const bandH = Math.min(win.h, F.label.fs * 3.4);
  const grd = ctx.createLinearGradient(0, win.y, 0, win.y + bandH * 1.5);
  grd.addColorStop(0, `rgba(23,10,54,${0.86 * a})`); grd.addColorStop(0.62, `rgba(23,10,54,${0.62 * a})`); grd.addColorStop(1, 'rgba(23,10,54,0)');
  ctx.fillStyle = grd; ctx.fillRect(win.x, win.y, win.w, bandH * 1.5);
  ctx.globalAlpha = clamp(a * 1.25, 0, 1);
  ctx.font = `900 ${F.label.fs}px ${DISPLAY}`;
  ctx.fillStyle = PAPER; ctx.textBaseline = 'alphabetic';
  const key = `${label}|${F.label.fs}|${win.w}`;
  if (leanMemo.key !== key) { leanMemo.key = key; leanMemo.lines = wrap(ctx, label.toUpperCase(), win.w - F.label.fs * 2.4); }
  const lines = leanMemo.lines;
  // on the side of the card that stays on the screen (leaning left, the words sit on its right)
  const lx = side === 'right' ? win.x + F.label.fs * 0.7 : win.x + win.w - F.label.fs * 0.7;
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  let ly = win.y + F.label.fs * 1.25;
  lines.slice(0, 2).forEach((l) => { ctx.fillText(l, lx + (1 - a) * (side === 'right' ? 12 : -12), ly); ly += F.label.fs * 1.02; });
  ctx.restore();
  ctx.restore();
}

// a stamped word over the ending card ("NEW!")
export function drawStamp(ctx, x, y, text, size, t) {
  if (t <= 0) return;
  const sc = lerp(2.4, 1, ease.outBack(clamp(t / 0.3, 0, 1), 2));
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.2); ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(t / 0.1, 0, 1);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.5;
  roundRect(ctx, -w / 2, -h / 2 + 3, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = PINK; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1);
  ctx.restore();
}

// a banner across the screen ("AGI-1 v2.0 RELEASED")
export function drawBanner(ctx, W, y, text, sub, t, dur) {
  const inK = ease.outBack(clamp(t / 0.4, 0, 1)), outK = clamp((t - (dur - 0.3)) / 0.3, 0, 1);
  if (outK >= 1) return;
  const fs = clamp(W * 0.055, 18, 34);
  ctx.save();
  ctx.translate(W / 2, y); ctx.rotate(-0.05); ctx.scale(inK * (1 - outK * 0.3), inK * (1 - outK * 0.3));
  ctx.globalAlpha = 1 - outK;
  ctx.font = `900 ${fs}px ${DISPLAY}`;
  const w = Math.min(W - 24, ctx.measureText(text).width + fs * 2), h = fs * (sub ? 2.5 : 1.7);
  roundRect(ctx, -w / 2, -h / 2 + 5, w, h, 14); ctx.fillStyle = INK; ctx.fill();
  roundRect(ctx, -w / 2, -h / 2, w, h, 14); ctx.fillStyle = HONEY; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, sub ? -fs * 0.38 : 1, w - fs);
  if (sub) { ctx.font = `italic ${fs * 0.62}px ${SERIF}`; ctx.fillText(sub, 0, fs * 0.62, w - fs); }
  ctx.restore();
}

// a little animated hint under the first card: a finger dragging it
export function drawHint(ctx, x, y, t, text) {
  const k = Math.sin(t * 2.4);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.font = `800 13px ${DISPLAY}`;
  const w = ctx.measureText(text).width + 64, h = 32;
  roundRect(ctx, x - w / 2, y - h / 2 + 2, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  arrow(ctx, x - w / 2 + 18 + Math.min(0, k) * 4, y, 14, -1, VIOLET, 2.6);
  arrow(ctx, x + w / 2 - 18 + Math.max(0, k) * 4, y, 14, 1, VIOLET, 2.6);
  ctx.restore();
}

// ---------- the title screen's cards: fans of the lab's faces in the room the title leaves ----------
// fan: { groups: [{ x, y, faces, spread }], bottom: bool }
export function drawFan(ctx, fan, t) {
  for (const [gi, g] of fan.groups.entries()) {
    const n = g.faces.length;
    for (let i = 0; i < n; i++) {
      const f = g.faces[i];
      const k = i - (n - 1) / 2;
      const still = REDUCED ? 0 : 1;
      const a = k * g.spread + Math.sin(t * 0.9 + i * 1.3 + gi) * 0.016 * still + (g.tilt || 0);
      const bob = Math.sin(t * 1.4 + i * 0.9 + gi * 2) * 5 * still;
      ctx.save();
      ctx.translate(g.x + k * f.w * (fan.bottom ? 0.52 : 0.36), g.y + Math.abs(k) * f.h * (fan.bottom ? 0.06 : 0.04) + bob);
      ctx.rotate(a);
      roundRect(ctx, -f.w / 2 + 5, -f.h + 7, f.w, f.h, 12); ctx.fillStyle = 'rgba(10,4,24,0.5)'; ctx.fill();
      ctx.drawImage(f.canvas, -f.w / 2, -f.h, f.w, f.h);
      ctx.restore();
    }
  }
}

// a small card for the title's fan: a face and a name, no words
export function makeMini(who, w, h, dpr) {
  const { c, ctx } = canvasOf(w, h, dpr);
  const r = Math.round(w * 0.08);
  paperCard(ctx, w, h, r);
  const pad = Math.round(w * 0.07);
  const win = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 - h * 0.16 };
  ctx.save(); roundRect(ctx, win.x, win.y, win.w, win.h, r * 0.6); ctx.clip();
  drawWindowBg(ctx, win.x, win.y, win.w, win.h, WHO[who].bg, { dark: who === 'glitch' });
  if (who === 'agi1') drawPortrait(ctx, win.x, win.y, win.w, win.h);
  else drawBust(ctx, who, win.x, win.y + win.h * 0.04, win.w, win.h * 0.96);
  ctx.restore();
  roundRect(ctx, win.x, win.y, win.w, win.h, r * 0.6); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = `900 ${Math.round(w * 0.1)}px ${DISPLAY}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(WHO[who].name.toUpperCase(), w / 2, h - pad - h * 0.075, w - pad * 2);
  return { canvas: c, w, h };
}

