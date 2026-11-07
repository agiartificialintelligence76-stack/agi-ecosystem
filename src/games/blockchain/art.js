// BLOCKCHAIN's look (2026-11-08): candy-sticker blocks (a rounded square, an ink outline, a flat color, a light bevel on
// its top and left, a shade along its bottom and a little shine), drawn once per color and size into small canvases;
// the board (a deep navy slab with an ink edge, a hard shadow and inset wells); the chain-link glyph; sticker text.
import { roundRect, mix } from '../kit/fx.js';

export const INK = '#170a36';
export const INK_DEEP = '#0c0722';
export const PAPER = '#fffaf0';
export const LAV = '#e4d9ff';
export const LAV2 = '#cdb8ff';
// the seven candy colors, in rules.js's COLORS order: honey, pink, mint, violet, sky, coral, lime
export const HEX = ['#ffc933', '#ff4da6', '#3ff0c3', '#8b66ff', '#59c8ff', '#ff7a59', '#b6f03f'];
export const BG = '#191d4d';
export const BG_LIGHT = '#232a6c';
export const BOARD = '#10142e';
export const WELL = '#0a0d25';
export const CORAL = '#ff7a59';
export const GREY = '#5d6188';

export const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
export const MONO = "'AK Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const SERIF = "'AK Serif', Georgia, serif";
export const SANS = "'AK Sans', system-ui, sans-serif";

// a canvas for `w × h` CSS pixels at `dpr`, its context drawing in CSS pixels
export function surface(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g };
}

// ---------- a block ----------
// The block's shape inside its cell: `s` its size; `pad` room around it in the sprite (for the outline's soft edge)
export const outlineOf = (s) => Math.max(1.4, Math.min(3.2, s * 0.062));
export function drawBlock(g, x, y, s, base, { light = 1 } = {}) {
  const o = outlineOf(s), r = s * 0.24;
  const shadeC = mix(base, INK, 0.3), hiC = mix(base, '#ffffff', 0.5 * light), lip = s * 0.12, bev = Math.max(1, s * 0.07);
  g.fillStyle = INK;
  roundRect(g, x, y, s, s, r); g.fill();
  // the lower lip in shade, then the face above it
  g.fillStyle = shadeC;
  roundRect(g, x + o, y + o, s - 2 * o, s - 2 * o, r - o * 0.7); g.fill();
  const fx = x + o, fy = y + o, fw = s - 2 * o, fh = s - 2 * o - lip, fr = Math.max(1, r - o * 0.8);
  g.fillStyle = hiC;
  roundRect(g, fx, fy, fw, fh, fr); g.fill();
  g.fillStyle = base;
  roundRect(g, fx + bev, fy + bev, fw - bev, fh - bev, Math.max(1, fr - bev * 0.5)); g.fill();
  // a little shine near its top-left corner
  g.fillStyle = 'rgba(255,255,255,0.82)';
  const sw = s * 0.2, sh = Math.max(1.5, s * 0.085);
  roundRect(g, fx + bev + s * 0.07, fy + bev + s * 0.06, sw, sh, sh / 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  const d = Math.max(1.5, s * 0.085);
  roundRect(g, fx + bev + s * 0.07 + sw + s * 0.045, fy + bev + s * 0.06, d, d, d / 2); g.fill();
}

// Its sprites at block size `s`: normal (one per color), ghost (one per color: where a piece would land), grey (the
// end of a run), white (a flash), shadow (an ink silhouette for lifted pieces), hole (an outline: a piece's home)
export function blockSprites(s, dpr) {
  const pad = 2, size = s + pad * 2;
  const make = (fn) => { const { c, g } = surface(size, size, dpr); fn(g); return c; };
  const r = s * 0.24;
  return {
    s, pad,
    normal: HEX.map((hex) => make((g) => drawBlock(g, pad, pad, s, hex))),
    ghost: HEX.map((hex) => make((g) => {
      const o = Math.max(1.5, s * 0.06);
      g.fillStyle = hex;
      g.globalAlpha = 0.26;
      roundRect(g, pad + o / 2, pad + o / 2, s - o, s - o, r); g.fill();
      g.globalAlpha = 0.95;
      g.strokeStyle = hex;
      g.lineWidth = o;
      roundRect(g, pad + o / 2, pad + o / 2, s - o, s - o, r - o / 2); g.stroke();
    })),
    grey: make((g) => drawBlock(g, pad, pad, s, GREY, { light: 0.5 })),
    white: make((g) => { g.fillStyle = '#ffffff'; roundRect(g, pad, pad, s, s, r); g.fill(); }),
    shadow: make((g) => { g.fillStyle = INK_DEEP; roundRect(g, pad, pad, s, s, r); g.fill(); }),
    hole: make((g) => {
      const o = Math.max(1.2, s * 0.05);
      g.strokeStyle = 'rgba(205,184,255,0.22)';
      g.lineWidth = o;
      g.setLineDash([Math.max(2, s * 0.16), Math.max(2, s * 0.12)]);
      roundRect(g, pad + o, pad + o, s - 2 * o, s - 2 * o, r * 0.8); g.stroke();
    }),
  };
}

// ---------- the board: its slab, shadow and wells, drawn once for a layout ----------
// fr: the frame's rect {x, y, w, h, r}; gx, gy: its first cell's corner; C the cell pitch, s the block size
export function boardSprite(fr, gx, gy, C, s, dpr, shadowDy) {
  const pad = 4;
  const W = fr.w + pad * 2, H = fr.h + shadowDy + pad * 2;
  const { c, g } = surface(W, H, dpr);
  const ox = pad, oy = pad;
  // the hard shadow, then the slab and its ink edge
  g.fillStyle = INK_DEEP;
  roundRect(g, ox, oy + shadowDy, fr.w, fr.h, fr.r); g.fill();
  g.fillStyle = INK;
  roundRect(g, ox, oy, fr.w, fr.h, fr.r); g.fill();
  const e = Math.max(2.5, C * 0.07);
  g.fillStyle = BOARD;
  roundRect(g, ox + e, oy + e, fr.w - e * 2, fr.h - e * 2, fr.r - e * 0.8); g.fill();
  // a lit top edge inside the slab
  g.strokeStyle = 'rgba(120,130,230,0.28)';
  g.lineWidth = Math.max(1, C * 0.03);
  g.beginPath();
  g.moveTo(ox + fr.r, oy + e + g.lineWidth);
  g.lineTo(ox + fr.w - fr.r, oy + e + g.lineWidth);
  g.stroke();
  // the wells
  const wr = s * 0.24, inset = (C - s) / 2;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const wx = ox + (gx - fr.x) + x * C + inset, wy = oy + (gy - fr.y) + y * C + inset;
      g.fillStyle = '#05071a';
      roundRect(g, wx, wy, s, s, wr); g.fill();
      g.fillStyle = WELL;
      roundRect(g, wx, wy + Math.max(1, s * 0.05), s, s - Math.max(1, s * 0.05), wr); g.fill();
      g.strokeStyle = 'rgba(80,92,190,0.16)';
      g.lineWidth = 1;
      roundRect(g, wx + 0.5, wy + 0.5, s - 1, s - 1, wr); g.stroke();
    }
  }
  return { c, ox: fr.x - pad, oy: fr.y - pad, w: W, h: H };
}

// ---------- the background: a deep indigo with a quiet grid of dots lined up with the board's cells ----------
export function backgroundSprite(W, H, dpr, { cx, cy, C }) {
  const { c, g } = surface(W, H, dpr);
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);
  const rad = Math.max(W, H) * 0.75;
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
  grad.addColorStop(0, BG_LIGHT);
  grad.addColorStop(1, BG);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const step = C, dot = Math.max(1.5, C * 0.07);
  const x0 = ((cx % step) + step) % step, y0 = ((cy % step) + step) % step;
  g.fillStyle = 'rgba(205,184,255,0.075)';
  for (let y = y0 - step / 2; y < H + step; y += step) {
    for (let x = x0 - step / 2; x < W + step; x += step) {
      roundRect(g, x - dot / 2, y - dot / 2, dot, dot, dot * 0.3); g.fill();
    }
  }
  return c;
}

// ---------- a chain link (a rounded loop seen flat, or edge-on) ----------
export function link(g, x, y, u, { edge = false, fill = null, stroke = INK, width = null } = {}) {
  const lw = width ?? Math.max(1.4, u * 0.28);
  if (edge) {
    // edge-on: a short bar between two flat loops
    g.lineCap = 'round';
    g.strokeStyle = stroke;
    g.lineWidth = lw * 1.25;
    g.beginPath(); g.moveTo(x - u * 0.42, y); g.lineTo(x + u * 0.42, y); g.stroke();
    if (fill) { g.strokeStyle = fill; g.lineWidth = lw * 0.45; g.beginPath(); g.moveTo(x - u * 0.42, y); g.lineTo(x + u * 0.42, y); g.stroke(); }
    return;
  }
  const w = u * 1.25, h = u * 0.78;
  roundRect(g, x - w / 2, y - h / 2, w, h, h / 2);
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.stroke();
  if (fill) {
    roundRect(g, x - w / 2, y - h / 2, w, h, h / 2);
    g.lineWidth = lw * 0.42;
    g.strokeStyle = fill;
    g.stroke();
  }
}

// ---------- sticker text: ink shadow, ink outline, a bright fill (the kit's wordmark, on a canvas) ----------
export function font(g, weight, size, family, stretch = null) {
  g.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in g) g.fontStretch = stretch || 'normal';
}
export function sticker(g, text, x, y, size, fill, { stroke = INK, shadow = 0.085, outline = 0.15, align = 'center', base = 'middle' } = {}) {
  g.textAlign = align;
  g.textBaseline = base;
  g.lineJoin = 'round';
  g.miterLimit = 2;
  if (shadow) {
    g.fillStyle = stroke;
    g.strokeStyle = stroke;
    g.lineWidth = size * outline;
    g.strokeText(text, x, y + size * shadow);
    g.fillText(text, x, y + size * shadow);
  }
  g.strokeStyle = stroke;
  g.lineWidth = size * outline;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}
