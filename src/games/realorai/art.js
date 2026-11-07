// REAL OR AI? (2026-11-08): the photo lab's things, drawn once into offscreen canvases (never per frame): the two rubber
// stamps (REAL with a camera, AI with a chip, inked with a worn texture and an ink shadow so they read on any photo),
// the ✓ / ✗ stickers, the backs of the prints, film grain, a strip of tape, and the glyphs the stamps and buttons share.
export const INK = '#170a36';
export const PAPER = '#fffaf0';
export const BACK = '#f1eadc';
export const TABLE = '#14132b';
export const MINT = '#3ff0c3';
export const PINK = '#ff4da6';
export const VIOLET = '#8b66ff';
export const HONEY = '#ffc933';
export const RED = '#ff5a5f';
export const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
export const MONO = "'AK Mono', ui-monospace, Menlo, monospace";
export const SERIF = "'AK Serif', Georgia, serif";
export const SANS = "'AK Sans', system-ui, sans-serif";

// the print: its borders as fractions of its width (a thicker margin at the bottom, like a lab print)
export const PRINT = { side: 0.045, bottom: 0.1 };
PRINT.pic = 1 - 2 * PRINT.side;
PRINT.ratio = PRINT.side + PRINT.pic + PRINT.bottom;          // height / width

export const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const wide = (ctx, on = true) => { try { if ('fontStretch' in ctx) ctx.fontStretch = on ? 'expanded' : 'normal'; } catch { /* older browsers */ } };

export function rrect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------- glyphs (s = their height) ----------
export function camera(ctx, x, y, s, color, lw = s * 0.11) {
  const w = s * 1.32, h = s * 0.86, top = y + s * 0.14;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the body and the viewfinder's hump
  ctx.beginPath();
  const l = x - w / 2, r = x + w / 2, b = top + h, rr = s * 0.14;
  ctx.moveTo(l + rr, top);
  ctx.lineTo(x - s * 0.3, top);
  ctx.lineTo(x - s * 0.2, y);
  ctx.lineTo(x + s * 0.2, y);
  ctx.lineTo(x + s * 0.3, top);
  ctx.lineTo(r - rr, top);
  ctx.arcTo(r, top, r, top + rr, rr);
  ctx.lineTo(r, b - rr);
  ctx.arcTo(r, b, r - rr, b, rr);
  ctx.lineTo(l + rr, b);
  ctx.arcTo(l, b, l, b - rr, rr);
  ctx.lineTo(l, top + rr);
  ctx.arcTo(l, top, l + rr, top, rr);
  ctx.closePath();
  ctx.stroke();
  // the lens, and its glint
  ctx.beginPath(); ctx.arc(x, top + h * 0.52, s * 0.27, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, top + h * 0.52, s * 0.1, 0, Math.PI * 2); ctx.fill();
  // the flash
  ctx.beginPath(); ctx.arc(r - s * 0.22, top + s * 0.2, s * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function chip(ctx, x, y, s, color, lw = s * 0.1) {
  const b = s * 0.66, l = x - b / 2, t = y + (s - b) / 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  rrect(ctx, l, t, b, b, s * 0.1);
  ctx.stroke();
  // its die
  rrect(ctx, l + b * 0.27, t + b * 0.27, b * 0.46, b * 0.46, s * 0.04);
  ctx.fill();
  // three pins on each side
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const k = t + b * (0.22 + i * 0.28);
    const kx = l + b * (0.22 + i * 0.28);
    ctx.moveTo(l, k); ctx.lineTo(l - s * 0.15, k);
    ctx.moveTo(l + b, k); ctx.lineTo(l + b + s * 0.15, k);
    ctx.moveTo(kx, t); ctx.lineTo(kx, t - s * 0.15);
    ctx.moveTo(kx, t + b); ctx.lineTo(kx, t + b + s * 0.15);
  }
  ctx.stroke();
  ctx.restore();
}

export function check(ctx, x, y, s, color, lw = s * 0.2) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, y + s * 0.02); ctx.lineTo(x - s * 0.12, y + s * 0.32); ctx.lineTo(x + s * 0.44, y - s * 0.3); ctx.stroke();
  ctx.restore();
}
export function cross(ctx, x, y, s, color, lw = s * 0.2) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.32, y - s * 0.32); ctx.lineTo(x + s * 0.32, y + s * 0.32); ctx.moveTo(x + s * 0.32, y - s * 0.32); ctx.lineTo(x - s * 0.32, y + s * 0.32); ctx.stroke();
  ctx.restore();
}

// ---------- the worn ink of a rubber stamp ----------
// a seeded dice, so the stamps look the same every visit
function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wear(ctx, w, h, seed, amount = 1) {
  const r = dice(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  // fine speckles all over
  for (let i = 0; i < 900 * amount; i++) {
    ctx.globalAlpha = 0.35 + r() * 0.65;
    const s = 0.6 + r() * r() * 3.2;
    ctx.beginPath(); ctx.arc(r() * w, r() * h, s, 0, Math.PI * 2); ctx.fill();
  }
  // a few thin-inked blotches (the stamp pressed unevenly)
  for (let i = 0; i < 14 * amount; i++) {
    ctx.globalAlpha = 0.1 + r() * 0.22;
    const s = 10 + r() * 34;
    ctx.beginPath(); ctx.ellipse(r() * w, r() * h, s * (1 + r()), s, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // short scratches
  ctx.lineCap = 'round';
  for (let i = 0; i < 26 * amount; i++) {
    ctx.globalAlpha = 0.5 + r() * 0.5;
    ctx.lineWidth = 0.8 + r() * 1.6;
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 4 + r() * 16;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}
// a canvas's shape filled with one color (its shadow)
function silhouette(src, color) {
  const c = canvasOf(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// The stamp: a double frame, its glyph and its word, inked in its color, worn, with an ink shadow behind.
// → { canvas, w, h, ax, ay } (ax, ay: its middle, without the shadow)
export function makeStamp(kind) {
  const word = kind === 'ai' ? 'AI' : 'REAL';
  const color = kind === 'ai' ? PINK : MINT;
  const H = 210, pad = 34, glyph = 104, gap = 22, sh = 7;
  const m = canvasOf(10, 10).getContext('2d');
  m.font = `900 128px ${DISPLAY}`;
  wide(m);
  const tw = m.measureText(word).width;
  const W = Math.ceil(pad + glyph * 1.3 + gap + tw + pad);
  const s = canvasOf(W + 8, H + 8), g = s.getContext('2d');
  g.translate(4, 4);
  g.strokeStyle = color; g.fillStyle = color;
  // the frame: thick outside, thin inside
  g.lineWidth = 13; rrect(g, 6.5, 6.5, W - 13, H - 13, 30); g.stroke();
  g.lineWidth = 4.5; rrect(g, 22, 22, W - 44, H - 44, 18); g.stroke();
  // the glyph
  const gx = pad + (glyph * 1.3) / 2;
  if (kind === 'ai') chip(g, gx, H / 2 - glyph / 2, glyph, color, 11);
  else camera(g, gx, H / 2 - glyph / 2 + 4, glyph * 0.92, color, 11);
  // the word
  g.font = `900 128px ${DISPLAY}`;
  wide(g);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(word, pad + glyph * 1.3 + gap, H / 2 + 7);
  wear(g, W, H, kind === 'ai' ? 7 : 11);
  // the shadow, then the ink
  const out = canvasOf(s.width + sh, s.height + sh), o = out.getContext('2d');
  o.globalAlpha = 0.92;
  o.drawImage(silhouette(s, INK), sh, sh);
  o.globalAlpha = 1;
  o.drawImage(s, 0, 0);
  return { canvas: out, w: out.width, h: out.height, ax: (W + 8) / 2, ay: (H + 8) / 2, color, word };
}

// ✓ or ✗: a round sticker
export function makeBadge(ok) {
  const S = 132, R = 54, c = canvasOf(S, S), g = c.getContext('2d');
  const cx = 60, cy = 60;
  g.fillStyle = INK;
  g.beginPath(); g.arc(cx + 6, cy + 7, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = ok ? MINT : RED;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  if (ok) check(g, cx, cy + 2, 62, INK, 13); else cross(g, cx, cy, 62, INK, 13);
  return { canvas: c, w: S, h: S, ax: cx, ay: cy, r: R };
}

// film grain: a tile of soft specks, light and dark
export function makeGrain(size = 192, seed = 3) {
  const c = canvasOf(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data, r = dice(seed);
  for (let i = 0; i < d.length; i += 4) {
    const v = r();
    const light = v > 0.5;
    d[i] = d[i + 1] = d[i + 2] = light ? 255 : 0;
    d[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 255 * (r() < 0.5 ? 0.35 : 1));
  }
  g.putImageData(img, 0, 0);
  return c;
}

// the paper's own fibre, very faint
export function makePaper(size = 128, seed = 5) {
  const c = canvasOf(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data, r = dice(seed);
  for (let i = 0; i < d.length; i += 4) {
    const v = r();
    d[i] = 120; d[i + 1] = 100; d[i + 2] = 80;
    d[i + 3] = Math.floor(v * v * 26);
  }
  g.putImageData(img, 0, 0);
  return c;
}

// the back of a print: lab paper, our own lab's words printed over it, a big question mark
export function makeBack(w = 420) {
  const h = Math.round(w * PRINT.ratio);
  const c = canvasOf(w, h), g = c.getContext('2d');
  g.fillStyle = BACK;
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-Math.PI / 7);
  g.fillStyle = 'rgba(23, 10, 54, 0.085)';
  g.font = `700 ${Math.round(w * 0.036)}px ${MONO}`;
  g.textAlign = 'center';
  const line = 'AGI-1 PHOTO LAB  ·  REAL OR AI?  ·  ';
  for (let y = -h; y < h; y += w * 0.075) g.fillText(line.repeat(4), (y / (w * 0.075)) % 2 ? w * 0.08 : 0, y);
  g.restore();
  // the question mark, in a ring
  g.strokeStyle = 'rgba(23, 10, 54, 0.16)';
  g.lineWidth = w * 0.022;
  g.beginPath(); g.arc(w / 2, h * 0.47, w * 0.2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(23, 10, 54, 0.2)';
  g.font = `900 ${Math.round(w * 0.27)}px ${DISPLAY}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', w / 2, h * 0.485);
  return c;
}

// a strip of tape: see-through, a little torn at the ends
export function makeTape(w = 120, h = 34, seed = 9) {
  const c = canvasOf(w, h), g = c.getContext('2d'), r = dice(seed);
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= w; x += w / 10) g.lineTo(x, r() * 3);
  for (let y = 0; y <= h; y += h / 5) g.lineTo(w - r() * 5, y);
  for (let x = w; x >= 0; x -= w / 10) g.lineTo(x, h - r() * 3);
  for (let y = h; y >= 0; y -= h / 5) g.lineTo(r() * 5, y);
  g.closePath();
  g.fillStyle = 'rgba(255, 236, 190, 0.62)';
  g.fill();
  g.strokeStyle = 'rgba(23, 10, 54, 0.25)';
  g.lineWidth = 1.5;
  g.stroke();
  return c;
}

// A hand-drawn grease-pencil loop around a clue: a little wobbly, overshooting where it started (`n` points, its own
// seed). Points are on a unit circle; the renderer scales them.
export function loopPath(seed, n = 54) {
  const r = dice(seed);
  const pts = [];
  const start = r() * Math.PI * 2, over = 0.42 + r() * 0.25, squash = 0.88 + r() * 0.16, tilt = r() * Math.PI;
  const f1 = 0.035 + r() * 0.03, p1 = r() * 6;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = start + k * (Math.PI * 2 + over);
    const rad = 1 + Math.sin(a * 3 + p1) * f1 + (k - 0.5) * 0.12;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad * squash;
    pts.push([x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pts;
}
