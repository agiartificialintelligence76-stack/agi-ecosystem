// HALLUCINATION (2026-11-08): the picture book's pen. Every scene is drawn in a 400 × 300 page with these few helpers, so
// all of it shares one style: flat fills, one darker tone on the side away from the light (the light comes from the upper
// left), a soft ground shadow under what stands, and an ink outline of one weight. Pure functions of a 2D context (no
// DOM): the tests draw every object with a stub context.
export const W = 400, H = 300, TAU = Math.PI * 2;

// ---------- paths (each starts a new path) ----------
export function rr(ctx, x, y, w, h, r = 0) {
  ctx.beginPath();
  const q = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  if (!q) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}
export function el(ctx, cx, cy, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(rx) + 0.001, Math.abs(ry) + 0.001, rot, 0, TAU); }
export function ci(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, Math.abs(r) + 0.001, 0, TAU); }
export function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

// ---------- paint ----------
// fill the current path, shade a band of it (a rect in the object's own units, mirrored with it, so the dark side stays
// on the right however it faces) and outline it in ink
export function paint(ctx, S, fill, sh = null, k = 1) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (sh) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = k === 1 ? S.shade : S.shade2;
    ctx.fillRect(S.flip ? -sh[0] - sh[2] : sh[0], sh[1], sh[2], sh[3]);
    ctx.restore();
  }
  ctx.lineWidth = S.lw;
  ctx.strokeStyle = S.ink;
  ctx.stroke();
}
export const fill = (ctx, color) => { ctx.fillStyle = color; ctx.fill(); };
export function ink(ctx, S, w = 1) { ctx.lineWidth = S.lw * w; ctx.strokeStyle = S.ink; ctx.stroke(); }
export function line(ctx, S, pts, w = 1, color = null) {
  poly(ctx, pts, false);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = S.lw * w;
  ctx.strokeStyle = color || S.ink;
  ctx.stroke();
}
// a thick outlined stroke (a handle, a stem, a string of lights): ink, then the color inside it
export function tube(ctx, S, color, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = w + S.lw * 2; ctx.strokeStyle = S.ink; ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
}
// a union of overlapping shapes (clouds, a tree's crown, a guitar's body) outlined once around the outside: the path
// (all its parts) stroked twice as thick, then filled over its inner half
export function blob(ctx, S, color, sh = null) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = S.lw * 2; ctx.strokeStyle = S.ink; ctx.stroke();
  ctx.fillStyle = color; ctx.fill();
  if (sh) { ctx.save(); ctx.clip(); ctx.fillStyle = S.shade; ctx.fillRect(S.flip ? -sh[0] - sh[2] : sh[0], sh[1], sh[2], sh[3]); ctx.restore(); }
}
// a little gloss: a short white arc
export function gloss(ctx, S, cx, cy, r, a0 = 3.6, a1 = 4.5, w = 1.2) {
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1);
  ctx.lineCap = 'round'; ctx.lineWidth = S.lw * w; ctx.strokeStyle = S.hi; ctx.stroke();
}
// the soft shadow under something that stands
export function gs(ctx, S, hw, y = 0) {
  el(ctx, 0, y, hw, Math.max(1.6, hw * 0.15));
  ctx.fillStyle = S.ground; ctx.fill();
}
// a glow (a lamp, a neon sign): soft circles, no blur filters (fast everywhere)
export function glow(ctx, x, y, r, color, a = 0.3) {
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = a * (0.45 / i);
    ci(ctx, x, y, r * (0.5 + i * 0.32));
    ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
}

// ---------- patterns, drawn inside the current clip ----------
export function pattern(ctx, kind, x, y, w, h, color, size = 6) {
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'stripes') {
    for (let i = x - h; i < x + w + h; i += size * 2) poly(ctx, [i, y + h, i + size, y + h, i + size + h, y, i + h, y]), ctx.fill();
  } else if (kind === 'bands') {
    for (let j = y + size * 0.5; j < y + h; j += size * 2) ctx.fillRect(x, j, w, size);
  } else if (kind === 'dots') {
    let row = 0;
    for (let j = y + size * 0.6; j < y + h + size; j += size * 1.25, row++) {
      for (let i = x + (row % 2 ? size * 1.1 : size * 0.3); i < x + w + size; i += size * 1.6) { ci(ctx, i, j, size * 0.32); ctx.fill(); }
    }
  } else if (kind === 'checks') {
    ctx.globalAlpha *= 0.55;
    for (let i = x; i < x + w; i += size * 2) ctx.fillRect(i, y, size, h);
    for (let j = y; j < y + h; j += size * 2) ctx.fillRect(x, j, w, size);
    ctx.globalAlpha /= 0.55;
  } else if (kind === 'zigzag') {
    ctx.lineWidth = size * 0.42; ctx.lineJoin = 'miter';
    for (let j = y + size * 0.8; j < y + h + size; j += size * 1.7) {
      ctx.beginPath(); ctx.moveTo(x - size, j);
      for (let i = x - size, k = 0; i < x + w + size; i += size * 0.8, k++) ctx.lineTo(i, j + (k % 2 ? -size * 0.45 : size * 0.45));
      ctx.stroke();
    }
  } else if (kind === 'hearts') {
    let row = 0;
    for (let j = y + size; j < y + h + size; j += size * 1.9, row++) {
      for (let i = x + (row % 2 ? size * 1.4 : size * 0.4); i < x + w + size; i += size * 2.2) { heartPath(ctx, i, j, size * 0.55); ctx.fill(); }
    }
  }
}

// ---------- symbols (posters, signs, neon, stickers, screens) ----------
export const SYMBOLS = ['heart', 'star', 'moon', 'bolt', 'note', 'planet', 'flower', 'smile', 'paw', 'drop', 'sun', 'diamond'];
export function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.75, cy - s * 1.2, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.75, cy - s * 1.2, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}
export function starPath(ctx, cx, cy, s, n = 5, inner = 0.46, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? s * inner : s, a = (i / (n * 2)) * TAU - Math.PI / 2 + rot;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}
export function moonPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.arc(cx, cy, s, Math.PI * 0.32, Math.PI * 1.68, false);
  ctx.arc(cx + s * 0.55, cy - s * 0.12, s * 0.82, Math.PI * 1.5, Math.PI * 0.55, true);
  ctx.closePath();
}
// draw a symbol filled with `color`, outlined in ink (or not: `bare`, for neon and screens)
export function symbol(ctx, S, kind, cx, cy, s, color, { bare = false, w = 1 } = {}) {
  const out = () => { if (!bare) { ctx.lineWidth = S.lw * w; ctx.strokeStyle = S.ink; ctx.lineJoin = 'round'; ctx.stroke(); } };
  ctx.fillStyle = color;
  switch (kind) {
    case 'heart': heartPath(ctx, cx, cy + s * 0.08, s * 0.72); ctx.fill(); out(); break;
    case 'star': starPath(ctx, cx, cy + s * 0.06, s); ctx.fill(); out(); break;
    case 'moon': moonPath(ctx, cx - s * 0.12, cy, s * 0.88); ctx.fill(); out(); break;
    case 'bolt': poly(ctx, [cx + s * 0.18, cy - s, cx - s * 0.55, cy + s * 0.12, cx - s * 0.02, cy + s * 0.12, cx - s * 0.22, cy + s, cx + s * 0.58, cy - s * 0.18, cx + s * 0.04, cy - s * 0.18]); ctx.fill(); out(); break;
    case 'note': {
      el(ctx, cx - s * 0.32, cy + s * 0.55, s * 0.36, s * 0.27, -0.4); ctx.fill(); out();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.02, cy + s * 0.5); ctx.lineTo(cx + s * 0.02, cy - s * 0.85);
      ctx.quadraticCurveTo(cx + s * 0.55, cy - s * 0.6, cx + s * 0.5, cy - s * 0.15);
      ctx.lineWidth = Math.max(S.lw * 1.3, s * 0.16); ctx.strokeStyle = bare ? color : S.ink; ctx.lineCap = 'round'; ctx.stroke();
      break;
    }
    case 'planet': {
      const rw = Math.max(S.lw * 1.1, s * 0.15);
      const ring = (a0, a1) => {
        ctx.beginPath(); ctx.ellipse(cx, cy, s * 1.02, s * 0.32, -0.35, a0, a1);
        if (bare) { ctx.lineWidth = rw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); } else tube(ctx, S, '#fff3d6', rw);
      };
      ring(Math.PI, TAU);
      ci(ctx, cx, cy, s * 0.56); ctx.fillStyle = color; ctx.fill(); out();
      ring(0, Math.PI);
      break;
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; ci(ctx, cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5, s * 0.38); ctx.fill(); out(); }
      ci(ctx, cx, cy, s * 0.3); ctx.fillStyle = bare ? color : '#ffd45c'; ctx.fill(); out();
      break;
    }
    case 'smile': {
      ci(ctx, cx, cy, s * 0.9); ctx.fill(); out();
      const ic = bare ? 'rgba(20,10,40,0.45)' : S.ink;
      ctx.fillStyle = ic;
      ci(ctx, cx - s * 0.3, cy - s * 0.18, s * 0.11); ctx.fill(); ci(ctx, cx + s * 0.3, cy - s * 0.18, s * 0.11); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + s * 0.02, s * 0.45, 0.35, Math.PI - 0.35);
      ctx.lineWidth = Math.max(S.lw, s * 0.13); ctx.strokeStyle = ic; ctx.lineCap = 'round'; ctx.stroke();
      break;
    }
    case 'paw': {
      el(ctx, cx, cy + s * 0.3, s * 0.5, s * 0.42); ctx.fill(); out();
      for (const [dx, dy] of [[-0.58, -0.22], [-0.22, -0.62], [0.22, -0.62], [0.58, -0.22]]) { el(ctx, cx + dx * s, cy + dy * s, s * 0.2, s * 0.25); ctx.fill(); out(); }
      break;
    }
    case 'drop': {
      ctx.beginPath(); ctx.moveTo(cx, cy - s);
      ctx.bezierCurveTo(cx + s * 0.3, cy - s * 0.4, cx + s * 0.75, cy, cx + s * 0.7, cy + s * 0.35);
      ctx.arc(cx, cy + s * 0.32, s * 0.7, 0.05, Math.PI - 0.05);
      ctx.bezierCurveTo(cx - s * 0.75, cy, cx - s * 0.3, cy - s * 0.4, cx, cy - s);
      ctx.fill(); out(); break;
    }
    case 'sun': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        poly(ctx, [cx + Math.cos(a - 0.2) * s * 0.62, cy + Math.sin(a - 0.2) * s * 0.62, cx + Math.cos(a) * s, cy + Math.sin(a) * s, cx + Math.cos(a + 0.2) * s * 0.62, cy + Math.sin(a + 0.2) * s * 0.62]);
        ctx.fill(); out();
      }
      ci(ctx, cx, cy, s * 0.55); ctx.fill(); out();
      break;
    }
    case 'diamond': poly(ctx, [cx, cy - s, cx + s * 0.72, cy, cx, cy + s, cx - s * 0.72, cy]); ctx.fill(); out(); break;
    case 'arrow': poly(ctx, [cx - s * 0.8, cy - s * 0.22, cx + s * 0.1, cy - s * 0.22, cx + s * 0.1, cy - s * 0.6, cx + s * 0.85, cy, cx + s * 0.1, cy + s * 0.6, cx + s * 0.1, cy + s * 0.22, cx - s * 0.8, cy + s * 0.22]); ctx.fill(); out(); break;
    case 'cat': {
      poly(ctx, [cx - s * 0.8, cy + s * 0.2, cx - s * 0.75, cy - s * 0.85, cx - s * 0.3, cy - s * 0.45, cx + s * 0.3, cy - s * 0.45, cx + s * 0.75, cy - s * 0.85, cx + s * 0.8, cy + s * 0.2]);
      ctx.fill(); out();
      el(ctx, cx, cy + s * 0.2, s * 0.8, s * 0.62); ctx.fill(); out();
      ctx.fillStyle = bare ? 'rgba(20,10,40,0.45)' : S.ink;
      el(ctx, cx - s * 0.3, cy + s * 0.12, s * 0.09, s * 0.14); ctx.fill(); el(ctx, cx + s * 0.3, cy + s * 0.12, s * 0.09, s * 0.14); ctx.fill();
      break;
    }
    case 'tree': {
      poly(ctx, [cx, cy - s, cx + s * 0.7, cy + s * 0.45, cx - s * 0.7, cy + s * 0.45]); ctx.fill(); out();
      break;
    }
    default: ci(ctx, cx, cy, s * 0.6); ctx.fill(); out();
  }
}

// ---------- colors ----------
export function hexRgb(hex) {
  const h = String(hex).replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// how different two colors look ("redmean": a cheap, decent stand-in for a perceptual distance), 0 … ~765
export function cdist(a, b) {
  const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b);
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
export function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
export const darker = (hex, t = 0.2) => mixHex(hex, '#1a0f24', t);
export const lighter = (hex, t = 0.3) => mixHex(hex, '#ffffff', t);
export function rgbaHex(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
