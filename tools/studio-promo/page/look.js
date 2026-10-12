// AGI Studio's launch video: AGI Studio's own look on a canvas. Its colors (src/styles/studio-app.css), its type (Geist,
// heavy and tight for headlines), its pieces drawn at video size (panels, chips, tiles, the Create button with its price,
// the credits pill, a progress bar, its line icons, its logo), media cards (a picture or a video frame, cropped, with
// rounded corners and a soft shadow), the backdrop's slow glows, and headlines whose words rise into place.
// Everything is a pure function of time: drawing a frame twice gives the same picture.
import { E, prog, clamp, mix, ep, canvas, setFont, measure, text, rr, graphemes } from '../../promo/page/kit.js';

// ---------- colors (the app's own) ----------
export const S = {
  bg: '#09090b', panel: '#0e0e11', surface: '#141418', raised: '#1b1b20', raised2: '#232329',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.11)', line3: 'rgba(255,255,255,0.18)',
  text: '#ececef', text2: '#a1a1aa', text3: '#8a8a94',
  accent: '#a78bfa', accent2: '#8b5cf6', accentBg: 'rgba(139,92,246,0.16)',
  pink: '#f472b6', fuchsia: '#e879f9', honey: '#fbbf24', gold: '#fde68a', good: '#34d399', bad: '#f87171',
  mint: '#3ff0c3', aqua: '#22d3ee', violet: '#7c3aed', plum: '#a21caf', rose: '#db2777', white: '#ffffff',
};
// the app's gradients: --sa-grad (buttons), the rotor's underline (light), its progress bar, the gold one, Instant's
export const GRAD = {
  brand: [[0, '#7c3aed'], [0.58, '#a21caf'], [1, '#db2777']],
  light: [[0, '#a78bfa'], [0.5, '#e879f9'], [1, '#f472b6']],
  bar: [[0, '#8b5cf6'], [0.62, '#d946ef'], [1, '#f472b6']],
  gold: [[0, '#fde68a'], [0.45, '#fbbf24'], [1, '#f59e0b']],
  instant: [[0, '#3ff0c3'], [1, '#22d3ee']],
};
export const FONT = {
  sans: "'Geist', 'Noto Sans', sans-serif",
  mono: "'Geist Mono', 'Noto Sans Mono', monospace",
};

// a CSS-like linear gradient (its angle in degrees, 90 = left to right) over a box
export function grad(g, x, y, w, h, stops = GRAD.light, deg = 100) {
  const a = ((deg - 90) * Math.PI) / 180;
  const cx = x + w / 2, cy = y + h / 2;
  const half = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  const dx = Math.cos(a) * half, dy = Math.sin(a) * half;
  const gr = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

// ---------- type ----------
// headline type: Geist, heavy and tight (the app's .sa-display, bigger)
export const H = (s, w = 800) => ({ f: 'sans', w, s });
export const tracking = (s) => -0.038 * s;
const wordsOf = (str) => String(str).split(/(\s+)/).filter((x) => x && !/^\s+$/.test(x));

// A headline that rises into place word by word, each from behind a mask; its gradient parts (by default the last part
// of several) filled with the app's light gradient across their whole width. parts: ['Photos in ', 'any scene.']
// o: { x, y (the first line's baseline), size, weight, align, maxW, lead (line height ×), stagger, dur, grad (indices),
//      color, out (a time: it leaves, upwards), outDur, alpha, glow } → { w, h, lines }
export function headline(g, parts, t, t0, o = {}) {
  const { x = 0, y = 0, size = 96, weight = 800, align = 'left', maxW = 1e9, lead = 1.04, stagger = 0.055, dur = 0.6,
    color = S.text, out = null, outDur = 0.35, alpha = 1, rise = 1, measureOnly = false } = o;
  const gi = o.grad ?? (parts.length > 1 ? [parts.length - 1] : []);
  const font = H(size, weight), sp = tracking(size);
  setFont(g, font);
  g.letterSpacing = `${sp}px`;
  const space = g.measureText(' ').width;
  // the words, each with its part
  const items = [];
  parts.forEach((p, pi) => {
    const nl = p.startsWith('\n');
    wordsOf(p).forEach((w, k) => items.push({ w, pi, width: g.measureText(w).width, br: nl && k === 0 }));
  });
  g.letterSpacing = '0px';
  // lines
  const lines = [[]];
  let lw = 0;
  for (const it of items) {
    const cur = lines[lines.length - 1];
    const add = (cur.length ? space : 0) + it.width;
    if (cur.length && (it.br || lw + add > maxW)) { lines.push([it]); lw = it.width; } else { cur.push(it); lw += add; }
  }
  const lh = size * lead;
  const widths = lines.map((l) => l.reduce((a, it, k) => a + it.width + (k ? space : 0), 0));
  const res = { w: Math.max(...widths), h: lh * (lines.length - 1) + size, lines: lines.length, lh };
  if (measureOnly || alpha <= 0) return res;
  // where each word goes
  let n = 0;
  lines.forEach((l, li) => {
    let cx = align === 'center' ? x - widths[li] / 2 : align === 'right' ? x - widths[li] : x;
    for (const it of l) { it.x = cx; it.y = y + li * lh; it.n = n++; cx += it.width + space; }
  });
  // the gradient spans each gradient part's words on their line
  const gradFor = new Map();
  for (const [li, l] of lines.entries()) {
    for (const pi of gi) {
      const ws = l.filter((it) => it.pi === pi);
      if (!ws.length) continue;
      const x0 = ws[0].x, x1 = ws[ws.length - 1].x + ws[ws.length - 1].width;
      gradFor.set(`${li}:${pi}`, grad(g, x0, y + li * lh - size, x1 - x0, size * 1.2, GRAD.light, 100));
    }
  }
  g.save();
  g.globalAlpha *= alpha;
  lines.forEach((l, li) => {
    for (const it of l) {
      const pIn = E.outQuart(prog(t, t0 + it.n * stagger, t0 + it.n * stagger + dur));
      if (pIn <= 0) continue;
      const pOut = out == null ? 0 : E.inCubic(prog(t, out + it.n * stagger * 0.5, out + it.n * stagger * 0.5 + outDur));
      if (pOut >= 1) continue;
      const dy = (1 - pIn) * size * 1.08 * rise - pOut * size * 1.08;
      g.save();
      g.beginPath();
      g.rect(it.x - size * 0.12, it.y - size * 1.0, it.width + size * 0.24, size * 1.32);
      g.clip();
      const fill = gi.includes(it.pi) ? gradFor.get(`${li}:${it.pi}`) : color;
      text(g, it.w, { x: it.x, y: it.y + dy, font, color: fill, spacing: sp, alpha: pIn < 1 ? 0.35 + 0.65 * pIn : 1 });
      g.restore();
    }
  });
  g.restore();
  return res;
}

// a small label: a dot and mono capitals (the site's eyebrows)
export function kicker(g, str, x, y, o = {}) {
  const { size = 20, color = S.text3, dot = S.accent, alpha = 1, align = 'left', spacing = 3.2 } = o;
  if (alpha <= 0) return 0;
  const font = { f: 'mono', w: 600, s: size };
  const s = str.toUpperCase();
  const tw = measure(g, s, font, spacing) + size * 1.15;
  const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  g.save();
  g.globalAlpha *= alpha;
  if (dot) { g.beginPath(); g.arc(x0 + size * 0.34, y - size * 0.34, size * 0.3, 0, Math.PI * 2); g.fillStyle = dot; g.fill(); }
  text(g, s, { x: x0 + (dot ? size * 1.15 : 0), y, font, color, spacing });
  g.restore();
  return tw;
}

// plain text with the app's type: o = { x, y, size, weight, color, align, base, mono, alpha, spacing }
export function say(g, str, o = {}) {
  const { size = 30, weight = 500, mono = false, spacing = null } = o;
  return text(g, str, { ...o, font: { f: mono ? 'mono' : 'sans', w: weight, s: size }, spacing: spacing ?? (mono ? 0 : -0.01 * size) });
}

// ---------- icons: the app's own line icons (24 × 24, stroked: src/studio/ui.js) ----------
const PATHS = {
  spark: ['M12 3c.7 4.6 2.6 7 7 8-4.4 1-6.3 3.4-7 9-.7-5.6-2.6-8-7-9 4.4-1 6.3-3.4 7-8Z'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z'],
  plus: ['M12 5v14M5 12h14'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5'],
  image: ['M4 5h16v14H4z', 'm4 16 4.5-4.5 3.5 3.5 2.5-2.5L20 17', 'M15.5 9.5a1.5 1.5 0 1 0 0-.01'],
  film: ['M4 5h16v14H4z', 'M8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4'],
  cube: ['M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z', 'M4 7.5 12 12l8-4.5M12 12v9'],
  coin: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.5 9.2c.4-1 1.4-1.6 2.6-1.6 1.6 0 2.6.8 2.6 2 0 2.6-5.2 1.6-5.2 4.3 0 1.2 1.1 2 2.6 2 1.3 0 2.3-.6 2.6-1.6M12 6v1.6M12 16v2'],
  camera: ['M4 8h3l1.8-2.5h6.4L17 8h3v11H4z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'],
  upload: ['M12 15V4M7.5 8.5 12 4l4.5 4.5', 'M4 15v4h16v-4'],
  download: ['M12 4v11M7.5 10.5 12 15l4.5-4.5', 'M4 15v4h16v-4'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  next: ['m9 5 7 7-7 7'],
  play: ['M8 5.5v13l10.5-6.5L8 5.5Z'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  bolt: ['M13.5 2.5 6 13h5.5l-1 8.5L18 11h-5.5l1-8.5Z'],
  wand: ['M5 19 15 9M13.5 5.5l.8-2 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM18 12l.5-1.2.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z'],
  sound: ['M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Z', 'M16 9.2a4 4 0 0 1 0 5.6M18.5 6.8a7.5 7.5 0 0 1 0 10.4'],
  heart: ['M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z'],
  trophy: ['M8 4h8v5.5a4 4 0 0 1-8 0V4Z', 'M8 6H5.2a3 3 0 0 0 2.9 4.2M16 6h2.8a3 3 0 0 1-2.9 4.2', 'M12 13.5V17M8.5 20.5h7M9.5 17h5'],
  rocket: ['M14.5 4.5c2.6-.9 4.4-.8 5-.2.6.6.7 2.4-.2 5-1 2.9-3.6 5.7-6.4 7.4l-3.6-3.6c1.7-2.8 4.3-5.4 5.2-8.6Z', 'M9.3 13.1 6 12.6l2.6-3.1 3.3-.3M10.9 14.7l.5 3.3 3.1-2.6.3-3.3', 'M6.7 16.4c-1.3.4-2 1.4-2.2 3.1 1.7-.2 2.7-.9 3.1-2.2'],
  grid: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  caption: ['M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5v-10Z', 'M8 9.5h8M8 12.5h5'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17h.01'],
  send: ['M4.5 11.5 19.5 4.5l-5 15-3.2-6.3-6.8-1.7Z', 'M11.3 13.2 19.5 4.5'],
  chart: ['M4 20h16', 'M7 16v-4M12 16V8M17 16v-7'],
  gift: ['M4.5 11h15v9h-15z', 'M3.5 7.5h17V11h-17z', 'M12 7.5V20', 'M12 7.5c-.6-2.6-2.4-4-4-4-1.4 0-2.2 1-1.7 2.1.6 1.3 2.8 1.9 5.7 1.9Zm0 0c.6-2.6 2.4-4 4-4 1.4 0 2.2 1 1.7 2.1-.6 1.3-2.8 1.9-5.7 1.9Z'],
  invite: ['M10 11a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z', 'M3.5 20c1-3.2 3.5-4.9 6.5-4.9 1.3 0 2.5.3 3.5.9', 'M18 13.5v6M15 16.5h6'],
  ff: ['m4.5 6.5 5.5 5.5-5.5 5.5', 'm12 6.5 5.5 5.5-5.5 5.5'],
  smile: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8.5 14.2c.9 1.3 2.1 1.9 3.5 1.9s2.6-.6 3.5-1.9', 'M9 9.8h.01M15 9.8h.01'],
  learn: ['M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z', 'M6.5 11.4v4.5c1.5 1.4 3.4 2.1 5.5 2.1s4-.7 5.5-2.1v-4.5', 'M21.5 9.5v5'],
  crop: ['M6.5 3v12.5a2 2 0 0 0 2 2H21', 'M17.5 21V8.5a2 2 0 0 0-2-2H3'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4'],
  filter: ['M12 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M8 19a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M16 19a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z'],
  type: ['M5 7V4.5h14V7', 'M12 4.5v15', 'M9 19.5h6'],
  sticker: ['M20.5 12a8.5 8.5 0 1 0-8.5 8.5l8.5-8.5Z', 'M20.5 12H16a4 4 0 0 0-4 4v4.5', 'M9 9.5h.01M14.5 9.5h.01'],
  scissors: ['M6.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 20.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M20 4.5 8.8 15.7M14.4 14.2 20 19.5M8.8 8.3l3.3 3.3'],
  wallet: ['M4 7.5h15a1 1 0 0 1 1 1V19H5a1 1 0 0 1-1-1V7.5Z', 'M4 7.5 16 4v3.5', 'M16 13.2h.01'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  flame: ['M12 21c-3.8 0-6.5-2.6-6.5-6.3 0-3.2 2.2-5 3.5-7.4.6 1.6 1.6 2.6 2.7 3 .1-2.9 1.3-5.6 3.5-7.3-.2 2.6.6 4.4 2 6.2 1.3 1.6 1.8 3 1.8 4.9 0 4-3 6.9-7 6.9Z'],
  share: ['M8 12.5 16 8M8 11.5l8 4.5', 'M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  arrow: ['M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5'],
};
const P2D = {};
export function icon(g, name, x, y, size, color = S.text, { lw = 1.8, fill = false, alpha = 1 } = {}) {
  const paths = PATHS[name];
  if (!paths || alpha <= 0) return;
  P2D[name] ||= paths.map((d) => new Path2D(d));
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x - size / 2, y - size / 2);
  g.scale(size / 24, size / 24);
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.fillStyle = color;
  for (const p of P2D[name]) { if (fill) g.fill(p); g.stroke(p); }
  g.restore();
}
// the credits' bolt, filled (the app's go-cost bolt is honey-light)
export function bolt(g, x, y, size, color = S.gold, alpha = 1) { icon(g, 'bolt', x, y, size, color, { fill: true, lw: 1.2, alpha }); }

// ---------- the logo: its mark (the star on the brand gradient) and "AGI Studio" ----------
export function logo(g, x, y, size, { alpha = 1, align = 'left', word = true, studioColor = S.text2 } = {}) {
  if (alpha <= 0) return 0;
  const m = size * 1.73;                     // the mark's box (26 px for 15 px type)
  const font = { f: 'sans', w: 750, s: size };
  const wA = measure(g, 'AGI', font, -0.01 * size);
  const wS = measure(g, 'Studio', { f: 'sans', w: 500, s: size }, -0.01 * size);
  const gap = size * 0.55, space = size * 0.28;
  const total = m + (word ? gap + wA + space + wS : 0);
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x0, y - m / 2, m, m, m * 0.31);
  g.fillStyle = grad(g, x0, y - m / 2, m, m, GRAD.brand, 100);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = Math.max(1, m * 0.025);
  g.stroke();
  icon(g, 'spark', x0 + m / 2, y, m * 0.62, '#fff', { lw: 1.8 });
  if (word) {
    text(g, 'AGI', { x: x0 + m + gap, y: y + size * 0.36, font, color: S.text, spacing: -0.01 * size });
    text(g, 'Studio', { x: x0 + m + gap + wA + space, y: y + size * 0.36, font: { f: 'sans', w: 500, s: size }, color: studioColor, spacing: -0.01 * size });
  }
  g.restore();
  return total;
}

// ---------- surfaces ----------
// a soft drop shadow, as a nine-slice of one blurred rounded rectangle (cheap at any size)
const shadowSprites = new Map();
function shadowSprite(r, blur) {
  const key = `${r}:${blur}`;
  if (shadowSprites.has(key)) return shadowSprites.get(key);
  const pad = blur * 2.2, c = canvas(pad * 2 + r * 2 + 4, pad * 2 + r * 2 + 4), x = c.getContext('2d');
  x.filter = `blur(${blur}px)`;
  x.fillStyle = '#000';
  rr(x, pad, pad, r * 2 + 4, r * 2 + 4, r);
  x.fill();
  const sp = { c, pad, r };
  shadowSprites.set(key, sp);
  return sp;
}
export function shadow(g, x, y, w, h, { r = 24, blur = 40, alpha = 0.55, dy = 18 } = {}) {
  if (alpha <= 0 || w <= 0 || h <= 0) return;
  const R = Math.round(Math.min(r, w / 2, h / 2) / 4) * 4, B = Math.round(blur / 4) * 4;
  const { c, pad } = shadowSprite(R, B);
  const k = pad + R;                       // the corner's size, in the sprite and on screen
  const X = x - pad, Y = y - pad + dy, Wd = w + pad * 2, Ht = h + pad * 2;
  const cw = c.width, ch = c.height;
  const mx = Math.max(0, Wd - k * 2), my = Math.max(0, Ht - k * 2);
  g.save();
  g.globalAlpha *= alpha;
  const piece = (sx, sy, sw, sh, dx, dy2, dw, dh) => { if (dw > 0 && dh > 0) g.drawImage(c, sx, sy, sw, sh, dx, dy2, dw, dh); };
  piece(0, 0, k, k, X, Y, k, k);
  piece(cw - k, 0, k, k, X + Wd - k, Y, k, k);
  piece(0, ch - k, k, k, X, Y + Ht - k, k, k);
  piece(cw - k, ch - k, k, k, X + Wd - k, Y + Ht - k, k, k);
  piece(k, 0, cw - k * 2, k, X + k, Y, mx, k);
  piece(k, ch - k, cw - k * 2, k, X + k, Y + Ht - k, mx, k);
  piece(0, k, k, ch - k * 2, X, Y + k, k, my);
  piece(cw - k, k, k, ch - k * 2, X + Wd - k, Y + k, k, my);
  piece(k, k, cw - k * 2, ch - k * 2, X + k, Y + k, mx, my);
  g.restore();
}
// a panel: the app's surfaces, a hairline and a shadow
export function panel(g, x, y, w, h, { r = 22, fill = S.panel, line = S.line2, lw = 1.5, sh = 0.6, blur = 48, dy = 24, alpha = 1, glowTop = true } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (sh) shadow(g, x, y, w, h, { r, blur, alpha: sh, dy });
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (glowTop) {          // a faint light on its top edge (the app's inset highlight)
    g.save(); g.clip();
    const lg = g.createLinearGradient(0, y, 0, y + Math.min(140, h));
    lg.addColorStop(0, 'rgba(255,255,255,0.045)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(x, y, w, Math.min(140, h));
    g.restore();
  }
  if (lw) { rr(g, x + lw / 2, y + lw / 2, w - lw, h - lw, r); g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  g.restore();
}

// a picture (or a video frame) cropped to a box like object-fit: cover, around a focus point; o: { r, focus [0..1, 0..1],
// zoom, shadow (0..1), line, alpha, dim (0..1 black over it), tint } (img may be missing: a dark stand-in)
export function media(g, img, x, y, w, h, o = {}) {
  const { r = 22, focus = [0.5, 0.5], zoom = 1, sh = 0, blur = 44, dy = 22, line = S.line2, lw = 1.5, alpha = 1, dim = 0, smooth = true, flip = false } = o;
  if (alpha <= 0 || w <= 1 || h <= 1) return;
  g.save();
  g.globalAlpha *= alpha;
  if (sh) shadow(g, x, y, w, h, { r, blur, alpha: sh, dy });
  rr(g, x, y, w, h, r);
  g.save();
  g.clip();
  if (img) {
    const iw = img.width, ih = img.height;
    const s = Math.max(w / iw, h / ih) * zoom;
    const sw = w / s, sh2 = h / s;
    const sx = clamp(focus[0] * iw - sw / 2, 0, Math.max(0, iw - sw)), sy = clamp(focus[1] * ih - sh2 / 2, 0, Math.max(0, ih - sh2));
    g.imageSmoothingEnabled = smooth;
    g.imageSmoothingQuality = 'high';
    if (flip) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, sx, sy, sw, sh2, 0, 0, w, h); } else g.drawImage(img, sx, sy, sw, sh2, x, y, w, h);
  } else {
    g.fillStyle = grad(g, x, y, w, h, [[0, '#261c45'], [1, S.surface]], 170);
    g.fillRect(x, y, w, h);
  }
  if (dim > 0) { g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(x, y, w, h); }
  g.restore();
  if (lw && line) { rr(g, x + lw / 2, y + lw / 2, w - lw, h - lw, r); g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  g.restore();
}
// a bottom fade on a media card, for words over it (the app's tile captions)
export function captionFade(g, x, y, w, h, r = 22, k = 0.45, alpha = 0.85) {
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  const lg = g.createLinearGradient(0, y + h * (1 - k), 0, y + h);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(1, `rgba(0,0,0,${alpha})`);
  g.fillStyle = lg;
  g.fillRect(x, y + h * (1 - k), w, h * k);
  g.restore();
}
// a light sweep across a box (a sheen on reveal), p 0 → 1
export function sheen(g, x, y, w, h, p, { r = 22, alpha = 0.32, width = 0.35 } = {}) {
  if (p <= 0 || p >= 1) return;
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  const cx = x - w * 0.6 + (w * 2.2) * p;
  const lg = g.createLinearGradient(cx - w * width, y, cx + w * width, y + h * 0.3);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.globalCompositeOperation = 'screen';
  g.fillRect(x, y, w, h);
  g.restore();
}
// a soft round light
export function glow(g, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, color);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = rg;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// ---------- the backdrop: near-black, two slow glows (violet, pink), a faint dot grid ----------
let dotGrid = null;
export function backdrop(g, W, H, t, { a = 1, b = 1, grid = 0.5, hueA = 'rgba(124,58,237,0.42)', hueB = 'rgba(219,39,119,0.26)', ax = 0.18, ay = 0.12, bx = 0.86, by = 0.9 } = {}) {
  g.fillStyle = S.bg;
  g.fillRect(0, 0, W, H);
  const d1x = Math.sin(t * 0.21) * 70, d1y = Math.cos(t * 0.17) * 50, d2x = Math.cos(t * 0.19) * 80, d2y = Math.sin(t * 0.23) * 60;
  glow(g, W * ax + d1x, H * ay + d1y, W * 0.62, hueA, a);
  glow(g, W * bx + d2x, H * by + d2y, W * 0.58, hueB, b);
  if (grid > 0) {
    if (!dotGrid) {
      const c = canvas(W, H), x = c.getContext('2d');
      x.fillStyle = 'rgba(255,255,255,0.09)';
      for (let yy = 20; yy < H; yy += 40) for (let xx = 20; xx < W; xx += 40) { x.beginPath(); x.arc(xx, yy, 1.1, 0, Math.PI * 2); x.fill(); }
      // brighter in the middle, gone at the edges
      x.globalCompositeOperation = 'destination-in';
      const rg = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.5);
      rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, W, H);
      dotGrid = c;
    }
    g.save(); g.globalAlpha = grid; g.drawImage(dotGrid, 0, 0, W, H); g.restore();
  }
}

// ---------- the app's controls, at video size (u = how many video pixels an app pixel is) ----------
// a chip (a choice): on = picked (the app's accent background and ring); p = how far it has been picked (0..1, animated)
export function chip(g, label, x, y, { u = 2, on = 0, alpha = 1, h = 32, padX = 11, size = 13, measureOnly = false, icon: ic = null, pulse = 0, dim = 0 } = {}) {
  const font = { f: 'sans', w: on > 0.5 ? 600 : 500, s: size * u };
  const tw = measure(g, label, font, -0.01 * size * u) + (ic ? (size + 6) * u : 0);
  const w = tw + padX * 2 * u, hh = h * u;
  if (measureOnly || alpha <= 0) return { w, h: hh };
  g.save();
  g.globalAlpha *= alpha * (1 - dim * 0.6);
  const sc = 1 + pulse * 0.08;
  g.translate(x + w / 2, y + hh / 2); g.scale(sc, sc); g.translate(-(x + w / 2), -(y + hh / 2));
  rr(g, x, y, w, hh, 8 * u);
  g.fillStyle = on > 0 ? `rgba(${mix(27, 139, on) | 0},${mix(27, 92, on) | 0},${mix(32, 246, on) | 0},${mix(1, 0.2, on)})` : S.raised;
  g.fill();
  g.lineWidth = u * (1 + on * 0.5);
  g.strokeStyle = on > 0 ? `rgba(167,139,250,${0.25 + on * 0.75})` : S.line2;
  g.stroke();
  if (on > 0) glow(g, x + w / 2, y + hh / 2, w * 0.7, 'rgba(139,92,246,0.35)', on * 0.6);
  let tx = x + padX * u;
  if (ic) { icon(g, ic, tx + size * u * 0.5, y + hh / 2, size * u * 1.05, on > 0.5 ? '#fff' : S.text2); tx += (size + 6) * u; }
  text(g, label, { x: tx, y: y + hh / 2 + size * u * 0.04, font, color: on > 0.5 ? '#fff' : S.text2, base: 'middle', spacing: -0.01 * size * u });
  g.restore();
  return { w, h: hh };
}
// a segmented control (Design it | From a photo): on = the index picked (a fraction slides between them)
export function seg(g, options, x, y, w, { u = 2, on = 0, alpha = 1, h = 40, icons = [] } = {}) {
  if (alpha <= 0) return;
  const hh = h * u, n = options.length, pad = 3 * u, cw = (w - pad * 2) / n;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x, y, w, hh, 10 * u); g.fillStyle = S.surface; g.fill();
  g.lineWidth = u; g.strokeStyle = S.line; g.stroke();
  const kx = x + pad + cw * on;
  rr(g, kx, y + pad, cw, hh - pad * 2, 8 * u); g.fillStyle = S.raised2; g.fill();
  g.lineWidth = u; g.strokeStyle = S.line2; g.stroke();
  options.forEach((o, i) => {
    const d = 1 - clamp(Math.abs(on - i));
    const cx = x + pad + cw * i + cw / 2;
    const font = { f: 'sans', w: 600, s: 13.5 * u };
    const ic = icons[i];
    const tw = measure(g, o, font) + (ic ? 22 * u : 0);
    let tx = cx - tw / 2;
    if (ic) { icon(g, ic, tx + 8 * u, y + hh / 2, 16 * u, d > 0.5 ? S.accent : S.text3); tx += 22 * u; }
    text(g, o, { x: tx, y: y + hh / 2 + 0.6 * u, font, color: d > 0.5 ? S.text : S.text3, base: 'middle' });
  });
  g.restore();
}
// a picture tile with its name (Create's choices, the styles): on = picked (a ring and a check)
export function tile(g, img, label, x, y, w, h, { u = 2, on = 0, alpha = 1, focus = [0.5, 0.35], labelIn = true, size = 12.5, r = 10, sh = 0 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  media(g, img, x, y, w, h, { r: r * u, focus, lw: u, line: S.line2, sh });
  if (labelIn && label) {
    captionFade(g, x, y, w, h, r * u, 0.42, 0.8);
    text(g, label, { x: x + 8 * u, y: y + h - 9 * u, font: { f: 'sans', w: 600, s: size * u }, color: '#fff', spacing: -0.01 * size * u });
  }
  if (on > 0) {
    g.save();
    g.globalAlpha *= on;
    rr(g, x - 1.5 * u, y - 1.5 * u, w + 3 * u, h + 3 * u, (r + 1.5) * u);
    g.lineWidth = 2.5 * u; g.strokeStyle = S.accent; g.stroke();
    const cr = 11 * u * (0.6 + 0.4 * E.outBack(clamp(on)));
    g.beginPath(); g.arc(x + w - 15 * u, y + 15 * u, cr, 0, Math.PI * 2); g.fillStyle = S.accent2; g.fill();
    icon(g, 'check', x + w - 15 * u, y + 15 * u, cr * 1.3, '#fff', { lw: 2.6 });
    g.restore();
  }
  g.restore();
}
// the primary button (the brand gradient), with its price on it: ✦ Create  ⚡ 100
export function goButton(g, label, x, y, w, { u = 2, cost = null, press = 0, alpha = 1, h = 44, ic = 'spark', glowA = 0.5, size = 14.5, align = 'left' } = {}) {
  if (alpha <= 0) return;
  const hh = h * u;
  g.save();
  g.globalAlpha *= alpha;
  const sc = 1 - press * 0.05;
  g.translate(x + w / 2, y + hh / 2); g.scale(sc, sc); g.translate(-(x + w / 2), -(y + hh / 2));
  glow(g, x + w / 2, y + hh * 0.75, w * 0.62, 'rgba(162,28,175,0.55)', glowA);
  rr(g, x, y, w, hh, 10 * u);
  g.fillStyle = grad(g, x, y, w, hh, GRAD.brand, 100);
  g.fill();
  g.save(); g.clip();
  const lg = g.createLinearGradient(0, y, 0, y + hh * 0.5);
  lg.addColorStop(0, 'rgba(255,255,255,0.18)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(x, y, w, hh * 0.5);
  g.restore();
  const font = { f: 'sans', w: 650, s: size * u };
  let tx = x + 16 * u;
  if (align === 'center') {
    const tw = measure(g, label, font) + (ic ? 24 * u : 0);
    tx = x + w / 2 - tw / 2 - (cost != null ? 30 * u : 0);
  }
  if (ic) { icon(g, ic, tx + 8 * u, y + hh / 2, 17 * u, '#fff', { lw: 1.9 }); tx += 24 * u; }
  text(g, label, { x: tx, y: y + hh / 2 + 0.5 * u, font, color: '#fff', base: 'middle' });
  if (cost != null) costChip(g, cost, x + w - 12 * u, y + hh / 2, { u, align: 'right' });
  g.restore();
}
// the price on a button: a dark chip, a bolt and its credits
export function costChip(g, value, x, y, { u = 2, align = 'left', alpha = 1, size = 12.5, bg = 'rgba(0,0,0,0.24)' } = {}) {
  if (alpha <= 0) return 0;
  const font = { f: 'sans', w: 650, s: size * u };
  const s = String(value);
  const tw = measure(g, s, font);
  const w = tw + 8 * u * 2 + 16 * u, hh = 22 * u;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x0, y - hh / 2, w, hh, 7 * u); g.fillStyle = bg; g.fill();
  bolt(g, x0 + 8 * u + 6 * u, y, 13 * u);
  text(g, s, { x: x0 + 8 * u + 16 * u, y: y + 0.5 * u, font, color: '#fff', base: 'middle' });
  g.restore();
  return w;
}
// the credits pill (the top bar's): ⚡ 1,240
export function creditsPill(g, value, x, y, { u = 2, alpha = 1, align = 'left', glowA = 0, pulse = 0 } = {}) {
  if (alpha <= 0) return 0;
  const font = { f: 'sans', w: 650, s: 13 * u };
  const s = typeof value === 'number' ? Math.round(value).toLocaleString('en-US') : String(value);
  const tw = measure(g, s, font);
  const w = tw + 34 * u, hh = 32 * u;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  g.save();
  g.globalAlpha *= alpha;
  const sc = 1 + pulse * 0.06;
  g.translate(x0 + w / 2, y); g.scale(sc, sc); g.translate(-(x0 + w / 2), -y);
  if (glowA) glow(g, x0 + w / 2, y, w, 'rgba(251,191,36,0.35)', glowA);
  rr(g, x0, y - hh / 2, w, hh, 9 * u); g.fillStyle = S.surface; g.fill();
  g.lineWidth = u; g.strokeStyle = S.line2; g.stroke();
  bolt(g, x0 + 15 * u, y, 15 * u, S.honey);
  text(g, s, { x: x0 + 26 * u, y: y + 0.5 * u, font, color: S.text, base: 'middle' });
  g.restore();
  return w;
}
// a progress bar with its percentage and the time left (the app's): p 0..1
export function progressBar(g, x, y, w, p, { u = 2, label = null, left = null, alpha = 1, t = 0 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  const hh = 8 * u;
  if (label) {
    text(g, label, { x, y: y - 12 * u, font: { f: 'sans', w: 600, s: 13.5 * u }, color: S.text });
    text(g, `${Math.round(p * 100)}%${left ? ` · ${left}` : ''}`, { x: x + w, y: y - 12 * u, font: { f: 'mono', w: 500, s: 12 * u }, color: S.text2, align: 'right' });
  }
  rr(g, x, y, w, hh, hh / 2); g.fillStyle = 'rgba(255,255,255,0.09)'; g.fill();
  const fw = Math.max(hh, w * clamp(p));
  rr(g, x, y, fw, hh, hh / 2);
  g.fillStyle = grad(g, x, y, w, hh, GRAD.bar, 90);
  g.fill();
  // its shimmer
  g.save(); rr(g, x, y, fw, hh, hh / 2); g.clip();
  const sx = x + ((t * 0.8) % 1.4 - 0.2) * w;
  const lg = g.createLinearGradient(sx - 60 * u, 0, sx + 60 * u, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.32)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(x, y, fw, hh);
  g.restore();
  g.restore();
}
// a text box (the app's inputs): its words typed so far, a caret
export function inputBox(g, x, y, w, h, str, { u = 2, caret = true, t = 0, placeholder = '', size = 14, alpha = 1, focus = 0, lines = 1, mono = false } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x, y, w, h, 9 * u); g.fillStyle = S.surface; g.fill();
  g.lineWidth = u * (1 + focus * 0.5); g.strokeStyle = focus > 0 ? `rgba(167,139,250,${0.3 + focus * 0.6})` : S.line2; g.stroke();
  const font = { f: mono ? 'mono' : 'sans', w: 500, s: size * u };
  const pad = 12 * u;
  const lh = size * u * 1.35;
  const shown = str || '';
  let lastX = x + pad, lastY = y + pad + size * u * 0.95;
  if (!shown && placeholder) text(g, placeholder, { x: x + pad, y: lastY, font, color: S.text3 });
  else {
    // wrap inside the box
    setFont(g, font);
    const out = [];
    let line = '';
    for (const word of shown.split(' ')) {
      const nx = line ? `${line} ${word}` : word;
      if (line && g.measureText(nx).width > w - pad * 2) { out.push(line); line = word; } else line = nx;
    }
    out.push(line);
    const vis = out.slice(-lines);
    vis.forEach((l, i) => {
      text(g, l, { x: x + pad, y: y + pad + size * u * 0.95 + i * lh, font, color: S.text });
    });
    setFont(g, font);
    lastX = x + pad + g.measureText(vis[vis.length - 1]).width;
    lastY = y + pad + size * u * 0.95 + (vis.length - 1) * lh;
  }
  if (caret && Math.floor(t * 2.2) % 2 === 0) { g.fillStyle = S.accent; g.fillRect(lastX + 2 * u, lastY - size * u * 0.85, 1.6 * u, size * u * 1.05); }
  g.restore();
}
// how many characters are typed at t (a steady hand, a little uneven)
export function typedAt(str, t, t0, cps = 18) {
  if (t < t0) return '';
  const all = graphemes(str);
  let k = 0, acc = t0;
  for (; k < all.length; k++) {
    acc += (1 / cps) * (0.75 + 0.5 * Math.abs(Math.sin(k * 2.17)));
    if (acc > t) break;
  }
  return all.slice(0, k).join('');
}

// ---------- the pointer, a click ----------
export function pointer(g, x, y, { s = 1.6, press = 0, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  const k = s * (1 - press * 0.16);
  g.scale(k, k);
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 25); g.lineTo(6, 19.5); g.lineTo(10.5, 29); g.lineTo(14.5, 27.2); g.lineTo(10, 18); g.lineTo(18, 18); g.closePath();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  g.fillStyle = '#fff'; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 1.6; g.strokeStyle = '#0b0b0c'; g.lineJoin = 'round'; g.stroke();
  g.restore();
}
// the ring a click leaves, from t0
export function ripple(g, x, y, t, t0, { r = 46, color = '167,139,250', dur = 0.55 } = {}) {
  const k = prog(t, t0, t0 + dur);
  if (k <= 0 || k >= 1) return;
  g.save();
  g.beginPath(); g.arc(x, y, r * E.outCubic(k), 0, Math.PI * 2);
  g.lineWidth = 3 + 5 * (1 - k); g.strokeStyle = `rgba(${color},${0.75 * (1 - k)})`; g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.45 * E.outCubic(k), 0, Math.PI * 2);
  g.fillStyle = `rgba(${color},${0.25 * (1 - k)})`; g.fill();
  g.restore();
}
// A pointer's path: keys [time, x, y, click?]; it glides (ease in-out) between them and presses on a click
export function pointerAt(keys, t) {
  if (!keys.length) return null;
  let x = keys[0][1], y = keys[0][2], press = 0;
  for (let i = 0; i < keys.length; i++) {
    const [ti, xi, yi] = keys[i];
    if (t >= ti) { x = xi; y = yi; }
    const nx = keys[i + 1];
    if (nx && t >= ti && t < nx[0]) {
      const travel = Math.min(0.42, nx[0] - ti);              // it moves in the last stretch before the next key
      const p = E.inOutCubic(prog(t, nx[0] - travel, nx[0]));
      x = mix(xi, nx[1], p); y = mix(yi, nx[2], p);
      // a slight arc
      y -= Math.sin(p * Math.PI) * Math.min(40, Math.hypot(nx[1] - xi, nx[2] - yi) * 0.08);
    }
    if (keys[i][3]) { const d = t - ti; if (d >= -0.06 && d < 0.16) press = d < 0 ? 1 + d / 0.06 : 1 - d / 0.16; }
  }
  return { x, y, press: clamp(press) };
}

// ---------- small things ----------
// a pill: rounded, a hairline, small words (o: { bg, line, color, size, h, padX, dot, ic, align, alpha, weight, mono })
export function pill(g, str, x, y, o = {}) {
  const { bg = 'rgba(20,20,24,0.82)', line = S.line2, color = S.text, size = 18, h = size * 2, padX = size * 0.8, dot = null, ic = null,
    align = 'left', alpha = 1, weight = 600, mono = false, spacing = 0, icColor = null, lw = 1.5, measureOnly = false } = o;
  const font = { f: mono ? 'mono' : 'sans', w: weight, s: size };
  const tw = measure(g, str, font, spacing);
  const lead = (dot ? size * 0.95 : 0) + (ic ? size * 1.3 : 0);
  const w = tw + padX * 2 + lead;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (measureOnly || alpha <= 0) return { x: x0, w, h };
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x0, y - h / 2, w, h, h / 2);
  if (bg) { g.fillStyle = bg; g.fill(); }
  if (line && lw) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  let tx = x0 + padX;
  if (dot) { g.beginPath(); g.arc(tx + size * 0.3, y, size * 0.28, 0, Math.PI * 2); g.fillStyle = dot; g.fill(); tx += size * 0.95; }
  if (ic) { icon(g, ic, tx + size * 0.5, y, size * 1.05, icColor || color); tx += size * 1.3; }
  text(g, str, { x: tx, y: y + size * 0.03, font, color, base: 'middle', spacing });
  g.restore();
  return { x: x0, w, h };
}
// a heart that pops (likes), with its count going up
export function heartPop(g, x, y, t, t0, { size = 30, count = null, from = 0, alpha = 1 } = {}) {
  const k = t - t0;
  const on = k >= 0;
  const sc = on ? 1 + 0.45 * Math.exp(-k * 7) * Math.sin(k * 22 + 0.4) * (k < 0.6 ? 1 : 0) : 1;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y); g.scale(sc, sc);
  icon(g, 'heart', 0, 0, size, on ? S.pink : 'rgba(255,255,255,0.85)', { fill: on, lw: 2 });
  g.restore();
  if (count != null) {
    const n = on ? from + 1 : from;
    text(g, n.toLocaleString('en-US'), { x: x + size * 0.75, y: y + size * 0.32, font: { f: 'sans', w: 650, s: size * 0.72 }, color: '#fff', alpha });
  }
  if (on && k < 0.7) {               // a few sparks around it
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, d = size * (0.6 + k * 2.2);
      g.save();
      g.globalAlpha = alpha * (1 - k / 0.7);
      g.fillStyle = i % 2 ? S.pink : S.fuchsia;
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, size * 0.07, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
}
// the "AI-generated" pill (the share mark's words)
export function aiPill(g, x, y, { alpha = 1, size = 18, align = 'left' } = {}) {
  return pill(g, 'AI-generated', x, y, { size, alpha, align, ic: 'spark', icColor: S.accent, bg: 'rgba(14,14,17,0.82)', mono: false });
}

export { E, prog, clamp, mix, ep };
