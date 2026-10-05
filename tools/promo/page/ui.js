// AGI-1's launch video: the site's own pieces, drawn on a canvas: pills and chips, buttons, chat bubbles, cards, a phone,
// little icons (all drawn in code, nobody's logo), and her ✦. Pop mode's look: ink outlines and hard shadows.
import { C, FONTS, setFont, text, rr, measure, spark, heart, clamp, E, prog, graphemes } from './kit.js';

// a pill with text: { x, y (center), font, color, bg, line, lw, h, padX, shadow, align ('center' | 'left' | 'right'),
// dot (a color), alpha, icon (a function(g, x, y, size)) } → its box
export function pill(g, str, o) {
  const { x, y, font = { f: 'mono', w: 600, s: 20 }, color = C.ink, bg = C.white, line = C.ink, lw = 2.5, h = font.s * 2.1,
    padX = font.s * 0.95, shadow = 0, shadowColor = C.ink, align = 'center', dot = null, alpha = 1, spacing = 1, icon = null, upper = false } = o;
  if (alpha <= 0) return null;
  const s = upper ? str.toUpperCase() : str;
  const tw = measure(g, s, font, spacing);
  const lead = (dot ? font.s * 0.95 : 0) + (icon ? font.s * 1.35 : 0);
  const w = tw + padX * 2 + lead;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow) { rr(g, x0 + shadow, y - h / 2 + shadow, w, h, h / 2); g.fillStyle = shadowColor; g.fill(); }
  rr(g, x0, y - h / 2, w, h, h / 2);
  if (bg) { g.fillStyle = bg; g.fill(); }
  if (line && lw) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  let tx = x0 + padX;
  if (dot) { g.beginPath(); g.arc(tx + font.s * 0.3, y, font.s * 0.3, 0, Math.PI * 2); g.fillStyle = dot; g.fill(); tx += font.s * 0.95; }
  if (icon) { icon(g, tx + font.s * 0.5, y, font.s * 1.05, color); tx += font.s * 1.35; }
  text(g, s, { x: tx, y: y + font.s * 0.04, font, color, base: 'middle', spacing });
  g.restore();
  return { x: x0, y: y - h / 2, w, h };
}

// a rounded button with a hard shadow (Pop mode), pressed = pushed into its shadow
export function button(g, str, o) {
  const { x, y, font = { f: 'sans', w: 700, s: 30 }, bg = C.honey, color = C.ink, h = font.s * 2.2, padX = font.s * 1.1,
    shadow = 7, press = 0, alpha = 1, align = 'center', icon = null, lw = 3.5 } = o;
  const tw = measure(g, str, font);
  const w = tw + padX * 2 + (icon ? font.s * 1.3 : 0);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const d = shadow * press;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x0 + shadow, y - h / 2 + shadow, w, h, h / 2); g.fillStyle = C.ink; g.fill();
  rr(g, x0 + d, y - h / 2 + d, w, h, h / 2); g.fillStyle = bg; g.fill();
  g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
  let tx = x0 + d + padX;
  if (icon) { icon(g, tx + font.s * 0.45, y + d, font.s * 1.0, color); tx += font.s * 1.3; }
  text(g, str, { x: tx, y: y + d + font.s * 0.05, font, color, base: 'middle' });
  g.restore();
  return { x: x0, y: y - h / 2, w, h };
}

// a card: a rounded rectangle with an ink outline and a hard shadow
export function card(g, x, y, w, h, { r = 26, fill = C.white, line = C.ink, lw = 3.5, shadow = 10, shadowColor = C.ink, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow) { rr(g, x + shadow, y + shadow, w, h, r); g.fillStyle = shadowColor; g.fill(); }
  rr(g, x, y, w, h, r);
  g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  g.restore();
}

// words laid out in lines inside maxW (emoji and her other alphabets kept whole)
export function lines(g, str, font, maxW) {
  setFont(g, font);
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (line && g.measureText(next).width > maxW) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

// a chat bubble: { x, y (top), maxW, font, side ('left' her | 'right' you), bg, color, typed (characters shown, null = all),
// tail, pop (0..1 scale-in), alpha, name } → its height
export function bubble(g, str, o) {
  const { x, y, maxW = 600, font = { f: 'sans', w: 500, s: 30 }, side = 'left', bg = C.white, color = C.ink, line = C.ink,
    lw = 3, shadow = 6, typed = null, pop = 1, alpha = 1, pad = font.s * 0.75, r = font.s * 0.9, measureOnly = false } = o;
  const all = lines(g, str, font, maxW - pad * 2);
  const lh = font.s * 1.3;
  setFont(g, font);
  const w = Math.min(maxW, Math.max(...all.map((l) => g.measureText(l).width)) + pad * 2);
  const h = all.length * lh + pad * 2 - (lh - font.s) * 0.6;
  if (measureOnly || alpha <= 0 || pop <= 0) return { w, h };
  const x0 = side === 'right' ? x - w : x;
  g.save();
  g.globalAlpha *= alpha;
  const ox = side === 'right' ? x0 + w : x0, oy = y + h;
  g.translate(ox, oy); g.scale(pop, pop); g.translate(-ox, -oy);
  if (shadow) { rr(g, x0 + shadow, y + shadow, w, h, r); g.fillStyle = C.ink; g.fill(); }
  rr(g, x0, y, w, h, r);
  if (bg) { g.fillStyle = bg; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  // the words, typed out if asked
  let left = typed == null ? Infinity : typed;
  all.forEach((l, i) => {
    if (left <= 0) return;
    const gs = graphemes(l);
    const shown = gs.slice(0, Math.min(gs.length, left)).join('');
    left -= gs.length + 1;
    text(g, shown, { x: x0 + pad, y: y + pad + i * lh + font.s * 0.82, font, color });
  });
  g.restore();
  return { w, h, x: x0 };
}

// three typing dots in a bubble
export function typingDots(g, x, y, t, { s = 1, bg = C.white, alpha = 1, side = 'left' } = {}) {
  if (alpha <= 0) return;
  const w = 96 * s, h = 54 * s;
  const x0 = side === 'right' ? x - w : x;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x0 + 5 * s, y + 5 * s, w, h, h / 2); g.fillStyle = C.ink; g.fill();
  rr(g, x0, y, w, h, h / 2); g.fillStyle = bg; g.fill();
  g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  for (let k = 0; k < 3; k++) {
    const b = Math.max(0, Math.sin(t * 9 - k * 0.9));
    g.beginPath();
    g.arc(x0 + w / 2 + (k - 1) * 22 * s, y + h / 2 - b * 6 * s, 7 * s, 0, Math.PI * 2);
    g.fillStyle = C.ink;
    g.globalAlpha = alpha * (0.45 + 0.55 * b);
    g.fill();
  }
  g.restore();
}

// ---------- icons (drawn in code, line icons in the site's style) ----------
const strokeIcon = (draw) => (g, x, y, s, color = C.ink, lw = null) => {
  g.save();
  g.translate(x, y);
  g.scale(s / 24, s / 24);
  g.lineWidth = lw ?? 2.2;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = color; g.fillStyle = color;
  draw(g);
  g.restore();
};
export const ICONS = {
  // ⤢ expand
  expand: strokeIcon((g) => { g.beginPath(); g.moveTo(3, -9); g.lineTo(9, -9); g.lineTo(9, -3); g.moveTo(9, -9); g.lineTo(2, -2); g.moveTo(-3, 9); g.lineTo(-9, 9); g.lineTo(-9, 3); g.moveTo(-9, 9); g.lineTo(-2, 2); g.stroke(); }),
  download: strokeIcon((g) => { g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 5); g.moveTo(-6, -1); g.lineTo(0, 5); g.lineTo(6, -1); g.moveTo(-10, 6); g.lineTo(-10, 10); g.lineTo(10, 10); g.lineTo(10, 6); g.stroke(); }),
  popout: strokeIcon((g) => { g.beginPath(); g.roundRect(-11, -9, 22, 18, 3); g.stroke(); g.beginPath(); g.roundRect(0, 0, 9, 7, 1.5); g.fill(); }),
  eye: strokeIcon((g) => { g.beginPath(); g.roundRect(-11, -9, 22, 15, 2.5); g.stroke(); g.beginPath(); g.moveTo(-4, 10); g.lineTo(4, 10); g.stroke(); g.beginPath(); g.moveTo(-7, -1.5); g.quadraticCurveTo(0, -8, 7, -1.5); g.quadraticCurveTo(0, 5, -7, -1.5); g.stroke(); g.beginPath(); g.arc(0, -1.5, 2.2, 0, Math.PI * 2); g.fill(); }),
  diary: strokeIcon((g) => { g.beginPath(); g.roundRect(-8, -11, 17, 22, 2.5); g.stroke(); g.beginPath(); g.moveTo(-4, -11); g.lineTo(-4, 11); g.moveTo(0, -5); g.lineTo(5, -5); g.moveTo(0, -1); g.lineTo(5, -1); g.stroke(); }),
  tap: strokeIcon((g) => { g.beginPath(); g.moveTo(-2, 11); g.lineTo(-6, 3); g.quadraticCurveTo(-7, 0, -4, 0); g.lineTo(-2, 3); g.lineTo(-2, -7); g.quadraticCurveTo(-2, -10, 0.5, -10); g.quadraticCurveTo(3, -10, 3, -7); g.lineTo(3, -2); g.lineTo(8, -1); g.quadraticCurveTo(10, 0, 9.5, 3); g.lineTo(8, 11); g.stroke(); g.beginPath(); g.moveTo(-9, -9); g.lineTo(-6, -6); g.moveTo(-10, -2); g.lineTo(-7, -2.5); g.moveTo(-3, -14); g.lineTo(-2.5, -11.5); g.stroke(); }),
  call: strokeIcon((g) => { g.beginPath(); g.moveTo(-9, -9); g.quadraticCurveTo(-11, -3, -5, 4); g.quadraticCurveTo(2, 11, 8, 9); g.lineTo(10, 6); g.lineTo(5, 2); g.lineTo(2, 4); g.quadraticCurveTo(-2, 2, -4, -2); g.lineTo(-2, -5); g.lineTo(-6, -10); g.closePath(); g.stroke(); }),
  spark: (g, x, y, s, color = C.ink) => spark(g, x, y, s * 0.5, color),
  speaker: strokeIcon((g) => { g.beginPath(); g.moveTo(-10, -4); g.lineTo(-5, -4); g.lineTo(1, -9); g.lineTo(1, 9); g.lineTo(-5, 4); g.lineTo(-10, 4); g.closePath(); g.fill(); g.beginPath(); g.arc(1, 0, 6, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(1, 0, 11, -0.8, 0.8); g.stroke(); }),
  heart: (g, x, y, s, color = C.pink) => heart(g, x, y + s * 0.05, s, color),
  check: strokeIcon((g) => { g.lineWidth = 3.4; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-2.5, 6); g.lineTo(9, -7); g.stroke(); }),
  globe: strokeIcon((g) => { g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(0, 0, 4.5, 10, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke(); }),
  lock: strokeIcon((g) => { g.beginPath(); g.roundRect(-8, -2, 16, 12, 2.5); g.stroke(); g.beginPath(); g.arc(0, -3, 5, Math.PI, 0); g.stroke(); }),
  wallet: strokeIcon((g) => { g.beginPath(); g.roundRect(-11, -8, 22, 17, 3); g.stroke(); g.beginPath(); g.roundRect(3, -2, 9, 6, 2); g.stroke(); }),
  chain: strokeIcon((g) => { g.beginPath(); g.roundRect(-11, -4, 12, 8, 4); g.stroke(); g.beginPath(); g.roundRect(-1, -4, 12, 8, 4); g.stroke(); }),
  rocket: strokeIcon((g) => { g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(7, -5, 5, 6); g.lineTo(-5, 6); g.quadraticCurveTo(-7, -5, 0, -12); g.stroke(); g.beginPath(); g.arc(0, -3, 2.4, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-5, 2); g.lineTo(-9, 8); g.lineTo(-5, 7); g.moveTo(5, 2); g.lineTo(9, 8); g.lineTo(5, 7); g.moveTo(-2, 9); g.lineTo(0, 13); g.lineTo(2, 9); g.stroke(); }),
  send: strokeIcon((g) => { g.beginPath(); g.moveTo(-10, -8); g.lineTo(11, 0); g.lineTo(-10, 8); g.lineTo(-6, 0); g.closePath(); g.stroke(); }),
  photo: strokeIcon((g) => { g.beginPath(); g.roundRect(-11, -9, 22, 18, 3); g.stroke(); g.beginPath(); g.arc(4, -3, 2.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-11, 7); g.lineTo(-3, -1); g.lineTo(5, 7); g.stroke(); }),
  flame: (g, x, y, s, color = C.honey) => flame(g, x, y, s, color),
  bell: strokeIcon((g) => { g.beginPath(); g.moveTo(-8, 6); g.quadraticCurveTo(-7, -9, 0, -9); g.quadraticCurveTo(7, -9, 8, 6); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-10, 6); g.lineTo(10, 6); g.stroke(); g.beginPath(); g.arc(0, 9, 2.5, 0, Math.PI); g.stroke(); }),
};

// the site's flame (the burn monitor's: index.html), centered at x, y, about s tall; `wob` makes it flicker
export function flame(g, x, y, s, color = C.honey, { wob = 0, line = null, lw = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.scale(s / 20, (s / 20) * (1 + wob * 0.05));
  g.translate(-12.2, -12.5);
  const p = new Path2D('M12.2 2.5c.4 3-1.4 4.8-3 6.6-1.5 1.7-2.9 3.4-2.9 6 0 3.6 2.7 6.4 5.9 6.4s5.9-2.6 5.9-6.2c0-2.7-1.4-4.4-2.6-5.6-.2 1.6-.9 2.7-2 3.2.5-3.5-.2-7.2-1.3-10.4Z');
  g.fillStyle = color;
  g.fill(p);
  if (line && lw) { g.lineWidth = lw / (s / 20); g.strokeStyle = line; g.lineJoin = 'round'; g.stroke(p); }
  g.restore();
}

// the mouse pointer (a plain arrow), its tip at x, y
export function cursor(g, x, y, s = 1.5, { press = 0, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  const k = s * (1 - press * 0.14);
  g.scale(k, k);
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 25); g.lineTo(6, 19.5); g.lineTo(10.5, 29); g.lineTo(14.5, 27.2); g.lineTo(10, 18); g.lineTo(18, 18); g.closePath();
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = C.white; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 1.6; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

// an eyebrow line (a dot and small mono capitals), as on the site's sections
export function eyebrow(g, str, x, y, { color = C.ink, dot = C.pink, s = 20, alpha = 1, align = 'left', spacing = 3 } = {}) {
  if (alpha <= 0) return 0;
  const font = { f: 'mono', w: 600, s };
  const tw = measure(g, str.toUpperCase(), font, spacing) + s * 1.1;
  const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath(); g.arc(x0 + s * 0.35, y - s * 0.33, s * 0.32, 0, Math.PI * 2); g.fillStyle = dot; g.fill();
  text(g, str.toUpperCase(), { x: x0 + s * 1.1, y, font, color, spacing });
  g.restore();
  return tw;
}

// a sticker: a circle (or a burst) with words, tilted, slammed on
export function sticker(g, x, y, r, wordsList, { fill = C.mint, color = C.ink, rot = -0.15, scale = 1, font = { f: 'display', w: 900, s: 34, st: 'expanded' }, burst = true, alpha = 1 } = {}) {
  if (scale <= 0 || alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y); g.rotate(rot); g.scale(scale, scale);
  const shape = (dx, dy) => {
    g.beginPath();
    if (burst) {
      const n = 22;
      for (let k = 0; k <= n * 2; k++) {
        const a = (k / (n * 2)) * Math.PI * 2, rr2 = k % 2 ? r * 0.9 : r;
        g.lineTo(dx + Math.cos(a) * rr2, dy + Math.sin(a) * rr2);
      }
      g.closePath();
    } else g.arc(dx, dy, r, 0, Math.PI * 2);
  };
  shape(9, 10); g.fillStyle = C.ink; g.fill();
  shape(0, 0); g.fillStyle = fill; g.fill(); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
  const lh = font.s * 1.05;
  wordsList.forEach((w, i) => text(g, w, { x: 0, y: (i - (wordsList.length - 1) / 2) * lh + font.s * 0.36, font, color, align: 'center' }));
  g.restore();
}

// Pop mode's big words: a fill, an ink outline, and a print echo (a second copy, offset, in another color)
export function popWord(g, str, x, y, { font, fill = C.lav, stroke = C.ink, sw = 10, echo = C.pink, off = 12, align = 'center', alpha = 1, spacing = 0, base = 'alphabetic' } = {}) {
  if (alpha <= 0 || !str) return 0;
  g.save();
  g.globalAlpha *= alpha;
  setFont(g, font);
  g.letterSpacing = `${spacing}px`;
  g.textAlign = align;
  g.textBaseline = base;
  g.lineJoin = 'round';
  g.miterLimit = 2;
  if (echo) {
    g.lineWidth = sw; g.strokeStyle = echo; g.fillStyle = echo;
    g.strokeText(str, x + off, y + off); g.fillText(str, x + off, y + off);
  }
  if (stroke && sw) { g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(str, x, y); }
  g.fillStyle = fill;
  g.fillText(str, x, y);
  const w = g.measureText(str).width;
  g.restore();
  return w;
}

// a tilted ribbon across the picture with words scrolling along it (the front's marquees)
export function ribbon(g, W, H, { y, angle = -0.06, bg = C.pink, color = C.ink, words, speed = 120, t = 0, s = 30, h = null, alpha = 1, line = C.ink } = {}) {
  if (alpha <= 0) return;
  const hh = h ?? s * 2.2;
  const D = Math.hypot(W, H) + 200;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(W / 2, y);
  g.rotate(angle);
  g.fillStyle = bg;
  g.fillRect(-D / 2, -hh / 2, D, hh);
  if (line) { g.fillStyle = line; g.fillRect(-D / 2, -hh / 2 - 3, D, 4); g.fillRect(-D / 2, hh / 2 - 1, D, 4); }
  const font = { f: 'display', w: 900, s, st: 'expanded' };
  const unit = `${words.join('  ✦  ')}  ✦  `;
  const uw = measure(g, unit, font);
  let x = -D / 2 - (((t * speed) % uw) + uw) % uw;
  while (x < D / 2) { text(g, unit, { x, y: s * 0.36, font, color }); x += uw; }
  g.restore();
}

// a burst of hearts (or sparks) from a point at time t0: a pure function of time, so any frame can be drawn alone
export function burst(g, x, y, t, t0, { n = 16, speed = 520, size = 34, colors = [C.pink, C.honey, C.violet, C.white], life = 1.1, seed = 1, gravity = 380, kind = 'heart', up = 0.6 } = {}) {
  const k = t - t0;
  if (k < 0 || k > life + 0.3) return;
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453, r1 = h1 - Math.floor(h1);
    const h2 = Math.sin((i + 1) * 39.3468 + seed * 11.135) * 43758.5453, r2 = h2 - Math.floor(h2);
    const a = (i / n) * Math.PI * 2 + r1 * 0.6 - Math.PI / 2 * up;
    const v = speed * (0.55 + 0.45 * r2);
    const life2 = life * (0.75 + 0.25 * r1);
    const p = k / life2;
    if (p >= 1) continue;
    const px = x + Math.cos(a) * v * k * (1 - p * 0.45);
    const py = y + Math.sin(a) * v * k * (1 - p * 0.45) + gravity * k * k * 0.5 - up * 160 * k;
    const s = size * (0.6 + 0.6 * r2) * Math.min(1, k / 0.12) * (1 - p * 0.3);
    const alpha = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
    const col = colors[i % colors.length];
    g.save();
    g.translate(px, py);
    g.rotate((r1 - 0.5) * 0.8 + k * (r2 - 0.5) * 3);
    if (kind === 'heart') { heart(g, 2, 3, s, 'rgba(23,10,54,0.85)', alpha); heart(g, 0, 0, s, col, alpha); } else spark(g, 0, 0, s * 0.5, col, alpha);
    g.restore();
  }
}

export { clamp, E, prog };
