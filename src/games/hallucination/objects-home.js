// HALLUCINATION (2026-11-08): the picture book's things for indoors: furniture, what hangs on a wall, what stands on a
// table, and AGI-1's grey striped cat. Each one: its noun (for AGI-1's confessions), its box in its own units (origin at
// its foot for what stands, at its middle for what hangs), its parameters (made from the scene's palette), how it can
// change (`muts`: what a hallucination may do to it) and how it's drawn. Drawing is pure canvas (no DOM).
import { rr, el, ci, poly, paint, fill, ink, line, tube, blob, gloss, gs, glow, pattern, symbol, heartPath, starPath, moonPath, TAU, darker, lighter } from './paint.js';

export const DECOS = ['plain', 'stripe', 'dots', 'heart'];
export const PATS = ['stripes', 'dots', 'checks', 'zigzag', 'bands'];
export const POSTER_SYMS = ['heart', 'star', 'moon', 'bolt', 'note', 'planet', 'flower', 'smile', 'paw', 'sun', 'diamond', 'cat'];
export const NEON_SYMS = ['heart', 'star', 'moon', 'bolt', 'diamond', 'drop'];
export const FRAME_PICS = ['hills', 'sea', 'flower', 'tree', 'moon', 'heart'];
export const FRUIT = ['#e2574c', '#9cc95a', '#f39a3c', '#f4d35e', '#8a5a9e'];
export const FISH = ['#f28c38', '#f27a9b', '#f4c84e', '#6fc3e8'];
export const FLAME = '#ffb43b';

const pickN = (r, list, n) => Array.from({ length: n }, () => r.pick(list));
const leafPath = (ctx, x, y, len, wid, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  const tx = x + c * len, ty = y + s * len, nx = -s * wid, ny = c * wid, mx = x + c * len * 0.5, my = y + s * len * 0.5;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
  ctx.quadraticCurveTo(mx - nx, my - ny, x, y);
  ctx.closePath();
};
export function leaf(ctx, S, x, y, len, wid, ang, color, vein = true) {
  leafPath(ctx, x, y, len, wid, ang);
  paint(ctx, S, color);
  if (vein) line(ctx, S, [x, y, x + Math.cos(ang) * len * 0.72, y + Math.sin(ang) * len * 0.72], 0.55);
}
// a flowerpot standing at y = 0: `w` across its rim
export function pot(ctx, S, w, h, color, band = null) {
  const b = w * 0.38;
  poly(ctx, [-w * 0.43, -h + 3, w * 0.43, -h + 3, b, 0, -b, 0]);
  paint(ctx, S, color, [w * 0.12, -h, w, h]);
  rr(ctx, -w / 2, -h, w, Math.min(5, h * 0.35), 1.5);
  paint(ctx, S, band || lighter(color, 0.12), [w * 0.15, -h, w, 6]);
}
// a slim outlined leg or pole from (x, y0) to (x, y1)
const leg = (ctx, S, x, y0, y1, w, color) => { rr(ctx, x - w / 2, y0, w, y1 - y0, w * 0.35); paint(ctx, S, color); };
const twinkle = (ctx, x, y, s, color) => { starPath(ctx, x, y, s, 4, 0.32); fill(ctx, color); };

// ---------- the cat (her grey striped cat) ----------
const FUR = '#b6b3c0', FUR2 = '#8a8796', FUR3 = '#f1edf5', PINKY = '#f3a9bd';
function catFace(ctx, S, x, y, s, sleepy) {
  if (sleepy) {
    for (const ex of [-4.2, 4.2]) { ctx.beginPath(); ctx.arc(x + ex * s, y - 0.6 * s, 2 * s, 0.25, Math.PI - 0.25); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = S.ink; ctx.lineCap = 'round'; ctx.stroke(); }
  } else {
    for (const ex of [-4.2, 4.2]) { el(ctx, x + ex * s, y - 1 * s, 1.75 * s, 2.3 * s); fill(ctx, S.ink); ci(ctx, x + ex * s + 0.6 * s, y - 1.8 * s, 0.6 * s); fill(ctx, '#ffffff'); }
  }
  poly(ctx, [x - 1.3 * s, y + 1.4 * s, x + 1.3 * s, y + 1.4 * s, x, y + 2.6 * s]); fill(ctx, PINKY);
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y + 3.4 * s); ctx.quadraticCurveTo(x - 0.9 * s, y + 4.4 * s, x, y + 2.8 * s); ctx.quadraticCurveTo(x + 0.9 * s, y + 4.4 * s, x + 2 * s, y + 3.4 * s);
  ctx.lineWidth = S.lw * 0.6; ctx.strokeStyle = S.ink; ctx.stroke();
  el(ctx, x - 6.6 * s, y + 2 * s, 1.8 * s, 1 * s); fill(ctx, 'rgba(243,120,150,0.35)');
  el(ctx, x + 6.6 * s, y + 2 * s, 1.8 * s, 1 * s); fill(ctx, 'rgba(243,120,150,0.35)');
}
function catEars(ctx, S, x, y, s) {
  for (const k of [-1, 1]) {
    poly(ctx, [x + k * 10.5 * s, y - 2 * s, x + k * 8.8 * s, y - 13 * s, x + k * 2.6 * s, y - 7.5 * s]); paint(ctx, S, FUR);
    poly(ctx, [x + k * 9 * s, y - 4 * s, x + k * 8.3 * s, y - 10 * s, x + k * 4.6 * s, y - 7 * s]); fill(ctx, PINKY);
  }
}

export const HOME = {
  // ===== on the wall =====
  window: {
    noun: 'window', kind: 'hang', fixed: true,
    box: () => [-50, -48, 50, 52],
    make: (r, pal, o = {}) => ({ fc: pal.trim, cur: r.pick(pal.acc), pat: r.pick(['plain', 'plain', 'dots', 'stripes', 'checks']), panes: r.pick([2, 4]), view: o.view || pal.view || 'day', item: o.item || r.pick((o.view || pal.view) === 'night' ? ['moon', 'stars'] : ['sun', 'cloud', 'bird']) }),
    muts: [['recolor', 'cur', [-50, -48, 50, 46], 'acc', { noun: 'curtains' }], ['pattern', 'pat', ['plain', 'dots', 'stripes', 'checks', 'zigzag'], [-50, -48, 50, 46], { noun: 'curtains' }],
      ['shape', 'panes', [2, 4], [-34, -34, 34, 34]], ['symbol', 'item', (p) => (p.view === 'night' ? ['moon', 'stars', 'comet'] : ['sun', 'cloud', 'bird', 'balloon']), [-34, -34, 34, 34], { noun: 'sky' }]],
    draw(ctx, p, S) {
      rr(ctx, -40, -40, 80, 80, 3); paint(ctx, S, p.fc);
      ctx.save(); rr(ctx, -34, -34, 68, 68, 1); ctx.clip();
      const g = ctx.createLinearGradient(0, -34, 0, 34);
      const [a, b] = p.view === 'night' ? ['#1c2150', '#45407a'] : p.view === 'dusk' ? ['#f6a07a', '#ffd8a8'] : ['#8fd0f2', '#dff3fb'];
      g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(-34, -34, 68, 68);
      // the far roofs and hills
      ctx.fillStyle = p.view === 'night' ? '#2a2a5c' : p.view === 'dusk' ? '#c97a8c' : '#9fd39a';
      ctx.beginPath(); ctx.moveTo(-34, 34); ctx.lineTo(-34, 18); ctx.quadraticCurveTo(-14, 6, 4, 18); ctx.quadraticCurveTo(20, 10, 34, 16); ctx.lineTo(34, 34); ctx.fill();
      const ix = -12, iy = -14;
      if (p.item === 'sun') symbol(ctx, S, 'sun', ix, iy, 11, '#ffd45c');
      else if (p.item === 'moon') symbol(ctx, S, 'moon', ix, iy, 10, '#fff1b8');
      else if (p.item === 'cloud') { cloudShape(ctx, ix, iy, 9, 4); blob(ctx, S, '#ffffff'); }
      else if (p.item === 'bird') { ctx.beginPath(); ctx.moveTo(ix - 7, iy); ctx.quadraticCurveTo(ix - 3, iy - 5, ix, iy); ctx.quadraticCurveTo(ix + 3, iy - 5, ix + 7, iy); ctx.lineWidth = S.lw * 1.1; ctx.strokeStyle = S.ink; ctx.stroke(); ctx.beginPath(); ctx.moveTo(ix + 9, iy + 9); ctx.quadraticCurveTo(ix + 12, iy + 5, ix + 15, iy + 9); ctx.quadraticCurveTo(ix + 18, iy + 5, ix + 21, iy + 9); ctx.stroke(); }
      else if (p.item === 'stars') { for (const [x, y, s] of [[-18, -20, 4], [-4, -8, 3], [10, -22, 3.6], [18, -6, 2.6], [-22, 2, 2.6]]) twinkle(ctx, x, y, s, '#fff4c2'); }
      else if (p.item === 'comet') { ctx.save(); ctx.globalAlpha = 0.7; poly(ctx, [-24, -26, ix + 2, iy - 3, ix + 2, iy + 3]); fill(ctx, '#bfe6ff'); ctx.restore(); twinkle(ctx, ix + 2, iy, 6, '#fff4c2'); }
      else if (p.item === 'balloon') { ci(ctx, ix, iy, 6.5); paint(ctx, S, '#ff6f91'); line(ctx, S, [ix, iy + 6.5, ix + 2, iy + 16], 0.6); }
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; poly(ctx, [10, -34, 22, -34, -4, 34, -16, 34]); ctx.fill();
      ctx.restore();
      rr(ctx, -34, -34, 68, 68, 1); ink(ctx, S);
      rr(ctx, -2.5, -34, 5, 68, 1); paint(ctx, S, p.fc);
      if (p.panes === 4) { rr(ctx, -34, -2.5, 68, 5, 1); paint(ctx, S, p.fc); }
      rr(ctx, -48, 38, 96, 8, 2); paint(ctx, S, p.fc, [-48, 42, 96, 6]);
      // the curtains and their rod
      line(ctx, S, [-50, -46, 50, -46], 1.6);
      for (const k of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(k * 50, -46); ctx.lineTo(k * 30, -46);
        ctx.quadraticCurveTo(k * 33, -6, k * 40, 10); ctx.quadraticCurveTo(k * 36, 26, k * 34, 44);
        ctx.lineTo(k * 50, 44); ctx.closePath();
        ctx.fillStyle = p.cur; ctx.fill();
        ctx.clip();
        if (p.pat !== 'plain') pattern(ctx, p.pat, -50, -46, 100, 92, lighter(p.cur, 0.45), 4.5);
        ctx.fillStyle = S.shade; ctx.fillRect(k > 0 ? 42 : -44, -46, 6, 92);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(k * 50, -46); ctx.lineTo(k * 30, -46);
        ctx.quadraticCurveTo(k * 33, -6, k * 40, 10); ctx.quadraticCurveTo(k * 36, 26, k * 34, 44);
        ctx.lineTo(k * 50, 44); ctx.closePath(); ink(ctx, S);
        rr(ctx, k * 40 - 4, 8, 8, 4, 2); paint(ctx, S, lighter(p.cur, 0.3));
      }
    },
  },
  poster: {
    noun: 'poster', kind: 'hang', flip: false,
    box: () => [-18, -24, 18, 24],
    make: (r, pal) => { const bg = r.pick(pal.acc); let fg = r.pick(pal.acc); if (fg === bg) fg = pal.cream; return { bg, fg, sym: r.pick(POSTER_SYMS) }; },
    muts: [['recolor', 'bg'], ['recolor', 'fg', [-12, -16, 12, 8]], ['swap', 'bg', 'fg'], ['symbol', 'sym', POSTER_SYMS, [-14, -18, 14, 10]]],
    draw(ctx, p, S) {
      rr(ctx, -17, -23, 34, 46, 1.5); paint(ctx, S, p.bg, [9, -23, 10, 46]);
      symbol(ctx, S, p.sym, 0, -5, 9.5, p.fg);
      rr(ctx, -11, 11, 22, 3.2, 1.6); fill(ctx, p.fg); rr(ctx, -7, 16, 14, 2.4, 1.2); fill(ctx, p.fg);
      for (const k of [-1, 1]) { ctx.save(); ctx.translate(k * 15, -22); ctx.rotate(k * 0.6); rr(ctx, -5, -2, 10, 4.2, 0.8); fill(ctx, S.pal.tape || 'rgba(255,240,200,0.75)'); ctx.restore(); }
    },
  },
  frame: {
    noun: 'picture', kind: 'hang',
    box: () => [-21, -17, 21, 17],
    make: (r, pal) => ({ fc: r.chance(0.5) ? pal.wood : r.pick(pal.acc), pic: r.pick(FRAME_PICS) }),
    muts: [['recolor', 'fc', null, 'acc', { noun: 'frame' }], ['symbol', 'pic', FRAME_PICS, [-15, -11, 15, 11]]],
    draw(ctx, p, S) {
      rr(ctx, -20, -16, 40, 32, 2); paint(ctx, S, p.fc, [12, -16, 8, 32]);
      rr(ctx, -15, -11, 30, 22, 0.5); fill(ctx, S.pal.cream);
      ctx.save(); rr(ctx, -12.5, -8.5, 25, 17, 0); ctx.clip();
      const sky = p.pic === 'moon' ? '#3b3f7a' : '#bfe6f5';
      ctx.fillStyle = sky; ctx.fillRect(-13, -9, 26, 18);
      if (p.pic === 'hills') { ci(ctx, 6, -3, 3); fill(ctx, '#ffcf4d'); el(ctx, -6, 10, 12, 8); fill(ctx, '#7cc47a'); el(ctx, 8, 12, 12, 9); fill(ctx, '#5fae6a'); }
      else if (p.pic === 'sea') { ctx.fillStyle = '#4fa6d6'; ctx.fillRect(-13, 2, 26, 8); poly(ctx, [-2, 1, -2, -7, 4, 1]); fill(ctx, '#ffffff'); rr(ctx, -5, 1, 11, 2.4, 1); fill(ctx, '#d96d5a'); }
      else if (p.pic === 'flower') { ctx.fillStyle = '#f6e7c8'; ctx.fillRect(-13, -9, 26, 18); line(ctx, S, [0, 9, 0, -1], 0.7, '#4f9d63'); symbol(ctx, S, 'flower', 0, -2, 4.5, '#f27a9b', { w: 0.5 }); }
      else if (p.pic === 'tree') { ctx.fillStyle = '#f9e6b3'; ctx.fillRect(-13, -9, 26, 18); rr(ctx, -1, 1, 2.4, 8, 0.5); fill(ctx, '#8a5a3c'); ci(ctx, 0, -2, 6); fill(ctx, '#e88a5a'); }
      else if (p.pic === 'moon') { symbol(ctx, S, 'moon', -3, -1, 5.5, '#fff1b8', { w: 0.5 }); twinkle(ctx, 7, -4, 2.2, '#fff1b8'); twinkle(ctx, 5, 4, 1.6, '#fff1b8'); }
      else if (p.pic === 'heart') { ctx.fillStyle = '#fde2ea'; ctx.fillRect(-13, -9, 26, 18); symbol(ctx, S, 'heart', 0, 0, 6.5, '#ff6f91', { w: 0.5 }); }
      ctx.restore();
      rr(ctx, -12.5, -8.5, 25, 17, 0); ink(ctx, S, 0.6);
    },
  },
  clock: {
    noun: 'clock', kind: 'hang',
    box: () => [-17, -17, 17, 17],
    make: (r, pal) => ({ rim: r.pick(pal.acc), shape: r.pick(['round', 'round', 'square', 'octagon']), h: r.int(0, 11), m: r.pick([0, 10, 15, 20, 30, 40, 45, 50]) }),
    muts: [['recolor', 'rim'], ['shape', 'shape', ['round', 'square', 'octagon']], ['time']],
    draw(ctx, p, S) {
      const shape = (r) => {
        if (p.shape === 'square') rr(ctx, -r, -r, r * 2, r * 2, r * 0.3);
        else if (p.shape === 'octagon') { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; pts.push(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06); } poly(ctx, pts); }
        else ci(ctx, 0, 0, r);
      };
      shape(16); paint(ctx, S, p.rim, [8, -17, 10, 34]);
      shape(12); paint(ctx, S, S.pal.cream || '#fffaf0');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, r0 = i % 3 ? 9.6 : 8.4;
        line(ctx, S, [Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * 10.6, Math.sin(a) * 10.6], i % 3 ? 0.45 : 0.8);
      }
      const ha = ((p.h % 12) + p.m / 60) / 12 * TAU - Math.PI / 2, ma = p.m / 60 * TAU - Math.PI / 2;
      line(ctx, S, [0, 0, Math.cos(ha) * 6, Math.sin(ha) * 6], 1.5);
      line(ctx, S, [0, 0, Math.cos(ma) * 9.2, Math.sin(ma) * 9.2], 1.05);
      ci(ctx, 0, 0, 1.6); fill(ctx, S.ink);
    },
  },
  shelf: {
    noun: 'shelf', kind: 'hang', fixed: true,
    box: (p) => [-p.w / 2, -2, p.w / 2, 12],
    make: (r, pal, o = {}) => ({ w: o.w || 90, c: pal.wood }),
    surface: (p) => ({ x0: -p.w / 2 + 3, x1: p.w / 2 - 3, y: 0 }),
    draw(ctx, p, S) {
      for (const k of [-1, 1]) { poly(ctx, [k * (p.w / 2 - 12), 5, k * (p.w / 2 - 12), 12, k * (p.w / 2 - 20), 5]); paint(ctx, S, darker(p.c, 0.15)); }
      rr(ctx, -p.w / 2, 0, p.w, 5.5, 1.5); paint(ctx, S, p.c, [-p.w / 2, 3, p.w, 3]);
    },
  },
  bunting: {
    noun: 'flags', kind: 'hang',
    box: (p) => [-p.w / 2, -2, p.w / 2, 22],
    make: (r, pal, o = {}) => ({ w: o.w || 150, n: r.int(6, 8), cols: pickN(r, pal.acc, 10) }),
    muts: [['count', 'n', 5, 9], ['recolorAt', 'cols', 'n', (p, i) => { const x = flagX(p, i); return [x - 7, 0, x + 7, 20]; }]],
    draw(ctx, p, S) {
      const w = p.w;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, 14, w / 2, 0); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = S.ink; ctx.stroke();
      for (let i = 0; i < p.n; i++) {
        const x = flagX(p, i), t = (x + w / 2) / w, y = 2 * (1 - t) * t * 14;
        poly(ctx, [x - 6.5, y - 0.5, x + 6.5, y - 0.5, x, y + 15]); paint(ctx, S, p.cols[i]);
      }
    },
  },
  lights: {
    noun: 'fairy lights', kind: 'hang',
    box: (p) => [-p.w / 2, -2, p.w / 2, 18],
    make: (r, pal, o = {}) => ({ w: o.w || 170, n: r.int(7, 10), cols: [r.pick(pal.lights || pal.acc), r.pick(pal.lights || pal.acc), r.pick(pal.lights || pal.acc)] }),
    muts: [['count', 'n', 6, 11], ['recolorAt', 'cols', 3, null, { list: 'lights' }]],
    draw(ctx, p, S) {
      const w = p.w;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, 16, w / 2, 0); ctx.lineWidth = S.lw * 0.7; ctx.strokeStyle = S.ink; ctx.stroke();
      for (let i = 0; i < p.n; i++) {
        const t = (i + 0.5) / p.n, x = -w / 2 + w * t, y = 2 * (1 - t) * t * 16;
        const c = p.cols[i % 3];
        if (S.night) glow(ctx, x, y + 6, 9, c, 0.5);
        rr(ctx, x - 1.6, y, 3.2, 3, 0.6); fill(ctx, S.ink);
        el(ctx, x, y + 6, 3, 4); paint(ctx, S, c);
        ci(ctx, x - 0.9, y + 4.8, 0.9); fill(ctx, 'rgba(255,255,255,0.7)');
      }
    },
  },
  ledstrip: {
    noun: 'light strip', kind: 'hang', fixed: true,
    box: (p) => [-p.w / 2, -3, p.w / 2, 4],
    make: (r, pal, o = {}) => ({ w: o.w || 200, c: r.pick(pal.neon || pal.acc) }),
    muts: [['recolor', 'c', null, 'neon']],
    draw(ctx, p, S) {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, 34);
      g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.32; ctx.fillStyle = g; ctx.fillRect(-p.w / 2, 0, p.w, 34);
      ctx.restore();
      rr(ctx, -p.w / 2, -2.5, p.w, 5, 2.5); paint(ctx, S, p.c);
      rr(ctx, -p.w / 2 + 3, -1, p.w - 6, 1.6, 0.8); fill(ctx, 'rgba(255,255,255,0.75)');
    },
  },
  neon: {
    noun: 'neon sign', kind: 'hang',
    box: () => [-21, -19, 21, 19],
    make: (r, pal) => ({ c: r.pick(pal.neon || pal.acc), sym: r.pick(NEON_SYMS) }),
    muts: [['recolor', 'c', null, 'neon'], ['symbol', 'sym', NEON_SYMS]],
    draw(ctx, p, S) {
      rr(ctx, -20, -18, 40, 36, 5); paint(ctx, S, S.pal.plate || '#2a1f45');
      ctx.save(); rr(ctx, -20, -18, 40, 36, 5); ctx.clip();
      glow(ctx, 0, 0, 22, p.c, 0.55);
      ctx.restore();
      neonPath(ctx, p.sym, 0, 1, 11);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = 5.5; ctx.strokeStyle = rgbaOf(p.c, 0.35); ctx.stroke();
      ctx.lineWidth = 2.6; ctx.strokeStyle = p.c; ctx.stroke();
      ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    },
  },
  pendant: {
    noun: 'lamp', kind: 'hang',
    box: (p) => [-17, 0, 17, p.len + 18],
    make: (r, pal, o = {}) => ({ len: o.len || r.int(18, 30), c: r.pick(pal.acc), shape: r.pick(['dome', 'cone', 'globe']) }),
    muts: [['recolor', 'c', (p) => [-17, p.len - 2, 17, p.len + 18]], ['shape', 'shape', ['dome', 'cone', 'globe'], (p) => [-17, p.len - 2, 17, p.len + 18]]],
    draw(ctx, p, S) {
      line(ctx, S, [0, 0, 0, p.len], 0.8);
      const y = p.len;
      if (S.night || S.warm) glow(ctx, 0, y + 14, 20, '#ffd27a', 0.45);
      el(ctx, 0, y + 13, 4, 4); fill(ctx, '#fff3c4');
      if (p.shape === 'dome') { ctx.beginPath(); ctx.arc(0, y + 12, 15, Math.PI, 0); ctx.closePath(); paint(ctx, S, p.c, [5, y - 4, 12, 18]); }
      else if (p.shape === 'cone') { poly(ctx, [-4, y, 4, y, 15, y + 13, -15, y + 13]); paint(ctx, S, p.c, [5, y, 12, 14]); }
      else { ci(ctx, 0, y + 9, 9.5); paint(ctx, S, p.c, [4, y, 8, 20]); gloss(ctx, S, 0, y + 9, 6.5); }
      rr(ctx, -2.5, y - 2, 5, 3.5, 1); paint(ctx, S, S.pal.metal || '#c9c4d6');
    },
  },
  wallplant: {
    noun: 'hanging plant', kind: 'hang',
    box: (p) => [-17, -2, 17, 30 + p.n * 4 + 8],
    make: (r, pal) => ({ c: r.pick(pal.acc), n: r.int(2, 4), lf: pal.leaf }),
    muts: [['recolor', 'c', [-12, 12, 12, 30], 'acc', { noun: 'plant pot' }], ['count', 'n', 1, 5, null, { noun: 'vines' }]],
    draw(ctx, p, S) {
      for (const k of [-1, 0, 1]) line(ctx, S, [0, 0, k * 11, 16], 0.55);
      ci(ctx, 0, 0, 2); fill(ctx, S.ink);
      const xs = [-8, 7, -2, 11, -11];
      for (let i = 0; i < p.n; i++) {
        const x = xs[i], len = 22 + p.n * 4 + (i % 2) * 6;
        ctx.beginPath(); ctx.moveTo(x, 22); ctx.quadraticCurveTo(x + (i % 2 ? 5 : -5), 22 + len / 2, x + (i % 2 ? 2 : -2), 22 + len);
        ctx.lineWidth = S.lw * 0.75; ctx.strokeStyle = darker(p.lf, 0.35); ctx.stroke();
        for (let j = 1; j <= 3; j++) { const yy = 22 + len * j / 3.2; leaf(ctx, S, x + (j % 2 ? 1 : -1), yy, 6, 2.6, j % 2 ? 0.4 : Math.PI - 0.4, p.lf, false); }
      }
      ctx.beginPath(); ctx.moveTo(-12, 16); ctx.lineTo(12, 16); ctx.quadraticCurveTo(11, 28, 0, 29); ctx.quadraticCurveTo(-11, 28, -12, 16); ctx.closePath();
      paint(ctx, S, p.c, [4, 14, 10, 16]);
      for (const a of [-0.9, -0.3, 0.3, 0.9]) leaf(ctx, S, 0, 16, 9, 3.2, -Math.PI / 2 + a, p.lf, false);
    },
  },
  chalkboard: {
    noun: 'menu board', kind: 'hang',
    box: () => [-36, -27, 36, 27],
    make: (r, pal) => ({ fc: pal.wood, n: r.int(3, 4), doodle: r.pick(['cup', 'heart', 'star', 'cake']) }),
    muts: [['count', 'n', 2, 5, [-30, -12, 30, 22], { noun: 'menu lines' }], ['symbol', 'doodle', ['cup', 'heart', 'star', 'cake'], [-30, -24, -4, -6], { noun: 'menu doodle' }]],
    draw(ctx, p, S) {
      rr(ctx, -35, -26, 70, 52, 3); paint(ctx, S, p.fc);
      rr(ctx, -30, -21, 60, 42, 1); paint(ctx, S, '#2f4a40');
      const chalk = 'rgba(245,240,230,0.88)';
      const dx = -19, dy = -13;
      if (p.doodle === 'cup') { rr(ctx, dx - 6, dy - 4, 10, 9, 2); ctx.lineWidth = 1.1; ctx.strokeStyle = chalk; ctx.stroke(); ctx.beginPath(); ctx.arc(dx + 5, dy, 2.6, -1.4, 1.4); ctx.stroke(); line(ctx, { ...S, lw: 1 }, [dx - 3, dy - 7, dx - 2, dy - 10], 1, chalk); }
      else if (p.doodle === 'heart') { heartPath(ctx, dx, dy, 5); ctx.lineWidth = 1.2; ctx.strokeStyle = chalk; ctx.stroke(); }
      else if (p.doodle === 'star') { starPath(ctx, dx, dy, 6); ctx.lineWidth = 1.2; ctx.strokeStyle = chalk; ctx.stroke(); }
      else { rr(ctx, dx - 6, dy - 2, 12, 7, 1.5); ctx.lineWidth = 1.1; ctx.strokeStyle = chalk; ctx.stroke(); line(ctx, { ...S, lw: 1 }, [dx, dy - 2, dx, dy - 6], 1.1, chalk); ci(ctx, dx, dy - 7.5, 1); fill(ctx, '#ffd27a'); }
      for (let i = 0; i < p.n; i++) {
        const y = -2 + i * 7, w = 30 + ((i * 7) % 3) * 6;
        line(ctx, { ...S, lw: 1 }, [-22, y, -22 + w, y], 1.15, chalk);
        line(ctx, { ...S, lw: 1 }, [17, y, 23, y], 1.15, chalk);
      }
      line(ctx, { ...S, lw: 1 }, [2, -15, 24, -15], 1.4, chalk);
    },
  },

  // ===== furniture =====
  bed: {
    noun: 'bed', kind: 'stand', fixed: true,
    box: () => [-82, -64, 82, 0],
    make: (r, pal) => ({ fc: pal.wood, bl: r.pick(pal.acc), pat: r.pick(['plain', 'stripes', 'dots', 'checks', 'zigzag']), pc: pal.cream, pl: r.int(1, 2) }),
    surface: () => ({ x0: -36, x1: 72, y: -40 }),
    muts: [['recolor', 'bl', [-40, -44, 80, -10], 'acc', { noun: 'blanket' }], ['pattern', 'pat', ['plain', 'stripes', 'dots', 'checks', 'zigzag'], [-40, -44, 80, -10], { noun: 'blanket' }],
      ['count', 'pl', 1, 2, [-70, -52, -30, -34], { noun: 'pillows' }], ['recolor', 'pc', [-70, -52, -30, -34], 'acc', { noun: 'pillow' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 80);
      leg(ctx, S, -76, -10, 0, 5, darker(p.fc, 0.2)); leg(ctx, S, 76, -10, 0, 5, darker(p.fc, 0.2));
      rr(ctx, -80, -64, 16, 58, 6); paint(ctx, S, p.fc, [-70, -64, 6, 58]);
      rr(ctx, -66, -26, 146, 18, 4); paint(ctx, S, p.fc, [-66, -14, 146, 6]);
      rr(ctx, -64, -38, 142, 14, 5); paint(ctx, S, S.pal.cream || '#fffaf0');
      for (let i = 0; i < p.pl; i++) { rr(ctx, -62 + i * 7, -50 + i * 3, 30, 13, 6.5); paint(ctx, S, p.pc, [-50 + i * 7, -44 + i * 3, 20, 8]); }
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(20, -46, 76, -40); ctx.quadraticCurveTo(82, -38, 80, -12); ctx.lineTo(-30, -12); ctx.quadraticCurveTo(-38, -26, -34, -42); ctx.closePath();
      ctx.fillStyle = p.bl; ctx.fill(); ctx.clip();
      if (p.pat !== 'plain') pattern(ctx, p.pat, -40, -48, 124, 40, lighter(p.bl, 0.42), 5.5);
      ctx.fillStyle = S.shade; ctx.fillRect(-40, -22, 124, 12);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(20, -46, 76, -40); ctx.quadraticCurveTo(82, -38, 80, -12); ctx.lineTo(-30, -12); ctx.quadraticCurveTo(-38, -26, -34, -42); ctx.closePath(); ink(ctx, S);
      line(ctx, S, [-28, -38, 6, -40], 0.6, S.hi);
    },
  },
  sofa: {
    noun: 'sofa', kind: 'stand', fixed: true,
    box: () => [-62, -52, 62, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), pl: r.int(1, 2), pc: r.pick(pal.acc), pat: r.pick(['plain', 'dots', 'stripes']) }),
    surface: () => ({ x0: -42, x1: 42, y: -24 }),
    muts: [['recolor', 'c'], ['count', 'pl', 1, 2, [-46, -44, 46, -20], { noun: 'cushions' }], ['recolor', 'pc', [-46, -44, 46, -20], 'acc', { noun: 'cushion' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 60);
      for (const x of [-52, 52]) leg(ctx, S, x, -8, 0, 4.5, darker(S.pal.wood || '#9a6b45', 0.1));
      rr(ctx, -50, -52, 100, 34, 10); paint(ctx, S, p.c, [20, -52, 32, 34]);
      rr(ctx, -54, -28, 108, 22, 6); paint(ctx, S, p.c, [-54, -14, 108, 8]);
      line(ctx, S, [0, -28, 0, -8], 0.7);
      for (const k of [-1, 1]) { rr(ctx, k > 0 ? 46 : -62, -40, 16, 34, 7); paint(ctx, S, lighter(p.c, 0.08), [k > 0 ? 54 : -54, -40, 8, 34]); }
      for (let i = 0; i < p.pl; i++) {
        const x = p.pl === 1 ? -26 : -32 + i * 46;
        ctx.save(); ctx.translate(x, -36); ctx.rotate(i ? 0.12 : -0.12);
        rr(ctx, -11, -10, 22, 20, 6); ctx.fillStyle = p.pc; ctx.fill(); ctx.save(); ctx.clip();
        if (p.pat !== 'plain') pattern(ctx, p.pat, -11, -10, 22, 20, lighter(p.pc, 0.45), 4);
        ctx.restore(); ink(ctx, S);
        ctx.restore();
      }
    },
  },
  nightstand: {
    noun: 'nightstand', kind: 'stand',
    box: () => [-21, -38, 21, 0],
    make: (r, pal) => ({ c: r.chance(0.5) ? pal.wood : r.pick(pal.acc), dr: r.int(1, 2), kc: pal.honey || '#ffc933' }),
    surface: () => ({ x0: -17, x1: 17, y: -38 }),
    muts: [['recolor', 'c'], ['count', 'dr', 1, 2, [-17, -32, 17, -4], { noun: 'drawers' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 20);
      leg(ctx, S, -15, -6, 0, 4, darker(p.c, 0.2)); leg(ctx, S, 15, -6, 0, 4, darker(p.c, 0.2));
      rr(ctx, -19, -36, 38, 31, 3); paint(ctx, S, p.c, [10, -36, 10, 31]);
      rr(ctx, -21, -39, 42, 5, 2); paint(ctx, S, lighter(p.c, 0.1));
      const h = 27 / p.dr;
      for (let i = 0; i < p.dr; i++) {
        rr(ctx, -15, -33 + i * h, 30, h - 3, 2); paint(ctx, S, lighter(p.c, 0.08));
        ci(ctx, 0, -33 + i * h + (h - 3) / 2, 2.1); paint(ctx, S, p.kc);
      }
    },
  },
  table: {
    noun: 'table', kind: 'stand',
    box: (p) => [-p.w / 2, -p.h, p.w / 2, 0],
    make: (r, pal, o = {}) => ({ w: o.w || r.int(70, 110), h: o.h || 40, c: r.chance(0.6) ? pal.wood : r.pick(pal.acc), cloth: o.cloth ?? r.chance(0.35), cc: r.pick(pal.acc) }),
    surface: (p) => ({ x0: -p.w / 2 + 5, x1: p.w / 2 - 5, y: -p.h }),
    muts: [['recolor', 'c', (p) => [-p.w / 2, -p.h, p.w / 2, 0], 'acc', { noun: 'table' }], ['recolor', 'cc', (p) => [-p.w / 2 + 4, -p.h, p.w / 2 - 4, -p.h + 14], 'acc', { noun: 'tablecloth', when: (p) => p.cloth }]],
    draw(ctx, p, S) {
      const { w, h } = p;
      gs(ctx, S, w / 2 - 2);
      for (const x of [-w / 2 + 7, w / 2 - 7]) leg(ctx, S, x, -h + 4, 0, 5, darker(p.c, 0.12));
      rr(ctx, -w / 2, -h, w, 7, 2.5); paint(ctx, S, p.c, [-w / 2, -h + 4, w, 3]);
      if (p.cloth) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + 3, -h - 0.5); ctx.lineTo(w / 2 - 3, -h - 0.5); ctx.lineTo(w / 2 - 6, -h + 13);
        for (let x = w / 2 - 6; x > -w / 2 + 6; x -= 8) ctx.quadraticCurveTo(x - 4, -h + 16, x - 8, -h + 13);
        ctx.lineTo(-w / 2 + 3, -h - 0.5); ctx.closePath();
        ctx.save(); ctx.fillStyle = p.cc; ctx.fill(); ctx.clip(); pattern(ctx, 'checks', -w / 2, -h, w, 18, lighter(p.cc, 0.5), 4); ctx.restore();
        ink(ctx, S);
      }
    },
  },
  desk: {
    noun: 'desk', kind: 'stand', fixed: true, flip: false,
    box: (p) => [-p.w / 2, -46, p.w / 2, 0],
    make: (r, pal, o = {}) => ({ w: o.w || 140, c: o.c || r.pick(pal.desk || [pal.wood]), dc: r.pick(pal.acc), dr: r.int(2, 3) }),
    surface: (p) => ({ x0: -p.w / 2 + 6, x1: p.w / 2 - 6, y: -46 }),
    muts: [['recolor', 'dc', (p) => [p.w / 2 - 40, -40, p.w / 2 - 4, 0], 'acc', { noun: 'drawers' }], ['count', 'dr', 2, 3, (p) => [p.w / 2 - 40, -40, p.w / 2 - 4, 0], { noun: 'drawers' }]],
    draw(ctx, p, S) {
      const w = p.w;
      gs(ctx, S, w / 2);
      leg(ctx, S, -w / 2 + 8, -42, 0, 5, darker(p.c, 0.15));
      rr(ctx, w / 2 - 38, -42, 32, 42, 2); paint(ctx, S, p.dc, [w / 2 - 14, -42, 8, 42]);
      const dh = 38 / p.dr;
      for (let i = 0; i < p.dr; i++) { rr(ctx, w / 2 - 35, -40 + i * dh, 26, dh - 3, 1.5); paint(ctx, S, lighter(p.dc, 0.12)); rr(ctx, w / 2 - 26, -40 + i * dh + dh / 2 - 2.5, 8, 2.2, 1.1); fill(ctx, S.ink); }
      rr(ctx, -w / 2, -47, w, 7, 2.5); paint(ctx, S, p.c, [-w / 2, -43, w, 3]);
    },
  },
  chair: {
    noun: 'chair', kind: 'stand', flip: true,
    box: () => [-17, -62, 17, 0],
    make: (r, pal) => ({ c: r.chance(0.5) ? pal.wood : r.pick(pal.acc), back: r.pick(['round', 'square', 'slats']), cu: r.pick(pal.acc) }),
    muts: [['recolor', 'c'], ['shape', 'back', ['round', 'square', 'slats'], [-17, -62, -2, -26], { noun: 'chair back' }], ['recolor', 'cu', [-15, -34, 17, -24], 'acc', { noun: 'cushion' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 16);
      const d = darker(p.c, 0.12);
      leg(ctx, S, -12, -28, 0, 4, d); leg(ctx, S, 12, -28, 0, 4, d);
      leg(ctx, S, -13, -60, -28, 4.5, p.c);
      if (p.back === 'round') { rr(ctx, -15, -62, 13, 22, 6.5); paint(ctx, S, p.c, [-7, -62, 6, 22]); }
      else if (p.back === 'square') { rr(ctx, -15, -60, 11, 26, 2); paint(ctx, S, p.c, [-8, -60, 5, 26]); }
      else { for (const y of [-58, -49, -40]) { rr(ctx, -15.5, y, 11, 4.5, 2); paint(ctx, S, p.c); } }
      rr(ctx, -15, -31, 32, 6, 2.5); paint(ctx, S, p.c, [-15, -28, 32, 3]);
      rr(ctx, -13, -35, 28, 5, 2.5); paint(ctx, S, p.cu);
    },
  },
  gamerchair: {
    noun: 'chair', kind: 'stand',
    box: () => [-23, -86, 23, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), st: r.pick(pal.acc) }),
    muts: [['recolor', 'c'], ['recolor', 'st', [-10, -82, 10, -40], 'acc', { noun: 'chair stripe' }], ['swap', 'c', 'st']],
    draw(ctx, p, S) {
      gs(ctx, S, 20);
      for (const [x0, x1] of [[-2, -18], [2, 18]]) line(ctx, S, [x0, -14, x1, -4], 1.2);
      for (const x of [-18, 18, 0]) { ci(ctx, x, -3, 3); paint(ctx, S, '#3a3550'); }
      rr(ctx, -2.5, -26, 5, 14, 1.5); paint(ctx, S, S.pal.metal || '#c9c4d6');
      ctx.beginPath(); ctx.moveTo(-17, -42); ctx.quadraticCurveTo(-21, -86, 0, -86); ctx.quadraticCurveTo(21, -86, 17, -42); ctx.closePath();
      paint(ctx, S, p.c, [8, -86, 14, 46]);
      rr(ctx, -6, -82, 12, 40, 4); paint(ctx, S, p.st);
      rr(ctx, -9, -78, 18, 8, 4); paint(ctx, S, lighter(p.c, 0.15));
      rr(ctx, -20, -36, 40, 11, 5); paint(ctx, S, p.c, [-20, -30, 40, 5]);
      for (const k of [-1, 1]) { rr(ctx, k * 21 - 3, -48, 6, 16, 2); paint(ctx, S, '#3a3550'); }
    },
  },
  bookshelf: {
    noun: 'bookshelf', kind: 'stand', fixed: true,
    box: () => [-32, -98, 32, 0],
    make: (r, pal) => ({ fc: pal.wood, rows: [0, 1, 2].map(() => ({ n: r.int(3, 6), cols: pickN(r, pal.acc, 8), hs: Array.from({ length: 8 }, () => r.int(14, 21)) })) }),
    surface: () => ({ x0: -27, x1: 27, y: -98 }),
    muts(p, r, pal, D, H) {
      const i = r.int(0, 2), row = p.rows[i], yb = -66 + 28 * i;
      const out = [];
      out.push(H.count(p, r, D, row.n, 1, 7, (q, n) => { q.rows[i].n = n; }, [-28, yb - 24, 28, yb], 'books'));
      const j = r.int(0, row.n - 1), x = bookX(row, j);
      out.push(H.color(p, r, pal, D, row.cols[j], (q, c) => { q.rows[i].cols[j] = c; }, [x - 1, yb - row.hs[j] - 1, x + 7, yb], 'book'));
      out.push(H.color(p, r, pal, D, p.fc, (q, c) => { q.fc = c; }, null, 'bookshelf'));
      return out;
    },
    draw(ctx, p, S) {
      gs(ctx, S, 32);
      rr(ctx, -32, -98, 64, 98, 2.5); paint(ctx, S, p.fc, [20, -98, 12, 98]);
      rr(ctx, -27, -92, 54, 84, 1); fill(ctx, darker(p.fc, 0.3));
      for (let i = 0; i < 3; i++) {
        const yb = -66 + 28 * i, row = p.rows[i];
        for (let j = 0; j < row.n; j++) {
          const x = bookX(row, j), h = row.hs[j];
          rr(ctx, x, yb - h, 6.6, h, 1); paint(ctx, S, row.cols[j], [x + 4.2, yb - h, 3, h]);
          line(ctx, S, [x + 1.6, yb - h + 3.5, x + 5, yb - h + 3.5], 0.45, lighter(row.cols[j], 0.55));
        }
        rr(ctx, -28, yb, 56, 4, 0.5); paint(ctx, S, p.fc);
      }
      rr(ctx, -27, -92, 54, 84, 1); ink(ctx, S, 0.8);
    },
  },
  floorlamp: {
    noun: 'lamp', kind: 'stand',
    box: () => [-17, -102, 17, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), shape: r.pick(['drum', 'cone', 'dome']), pc: pal.metal || '#c9c4d6' }),
    muts: [['recolor', 'c', [-17, -102, 17, -74], 'acc', { noun: 'lampshade' }], ['shape', 'shape', ['drum', 'cone', 'dome'], [-17, -102, 17, -74], { noun: 'lampshade' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 13);
      if (S.night || S.warm) glow(ctx, 0, -70, 30, '#ffd27a', 0.5);
      el(ctx, 0, -3, 12, 3.5); paint(ctx, S, p.pc);
      rr(ctx, -2, -82, 4, 79, 1.5); paint(ctx, S, p.pc);
      if (p.shape === 'drum') { rr(ctx, -15, -102, 30, 24, 2); paint(ctx, S, p.c, [6, -102, 10, 24]); }
      else if (p.shape === 'cone') { poly(ctx, [-8, -102, 8, -102, 17, -76, -17, -76]); paint(ctx, S, p.c, [6, -102, 12, 26]); }
      else { ctx.beginPath(); ctx.arc(0, -78, 17, Math.PI, 0); ctx.closePath(); paint(ctx, S, p.c, [6, -96, 12, 18]); }
      line(ctx, S, [-9, -95, -10, -82], 0.6, S.hi);
    },
  },
  desklamp: {
    noun: 'desk lamp', kind: 'stand', flip: true,
    box: () => [-12, -42, 20, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 11);
      if (S.night || S.warm) glow(ctx, 14, -22, 16, '#ffd27a', 0.5);
      el(ctx, -2, -2.5, 10, 3); paint(ctx, S, p.c);
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-8, -24); ctx.lineTo(6, -38); tube(ctx, S, p.c, 2.4);
      ci(ctx, -8, -24, 2.2); paint(ctx, S, lighter(p.c, 0.2));
      ctx.save(); ctx.translate(8, -36); ctx.rotate(0.7);
      poly(ctx, [-4, -5, 4, -5, 9, 8, -9, 8]); paint(ctx, S, p.c, [3, -5, 7, 13]);
      ctx.restore();
    },
  },
  plant: {
    noun: 'plant', kind: 'stand',
    box: () => [-25, -78, 25, 0],
    make: (r, pal) => ({ pc: r.pick(pal.acc), kind: r.pick(['monstera', 'snake', 'fern']), lf: r.pick(pal.leaves || [pal.leaf]) }),
    muts: [['recolor', 'pc', [-14, -28, 14, 0], 'acc', { noun: 'plant pot' }], ['shape', 'kind', ['monstera', 'snake', 'fern'], [-25, -78, 25, -24], { noun: 'plant' }], ['recolor', 'lf', [-25, -78, 25, -24], 'leaves', { noun: 'leaves' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 13);
      const lf = p.lf, lf2 = darker(lf, 0.18);
      if (p.kind === 'monstera') {
        const L = [[-0.6, 34, 13], [-1.2, 40, 14], [-1.9, 38, 14], [-2.5, 33, 12], [-1.55, 46, 12]];
        L.forEach(([a, len, w], i) => {
          line(ctx, S, [0, -24, Math.cos(a) * len * 0.5, -24 + Math.sin(a) * len * 0.5], 0.8, darker(lf, 0.3));
          leafPath(ctx, Math.cos(a) * len * 0.42, -24 + Math.sin(a) * len * 0.42, len * 0.62, w, a);
          paint(ctx, S, i % 2 ? lf : lf2);
          const mx = Math.cos(a) * len * 0.72, my = -24 + Math.sin(a) * len * 0.72;
          ci(ctx, mx + Math.cos(a + 1.4) * 4, my + Math.sin(a + 1.4) * 4, 1.6); fill(ctx, S.pal.wall || '#f3e6d6');
        });
      } else if (p.kind === 'snake') {
        [[-9, 40, -0.2], [-3, 52, -0.05], [3, 46, 0.08], [9, 36, 0.22], [0, 30, 0]].forEach(([x, h, a], i) => {
          ctx.save(); ctx.translate(x, -24); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-5, -h * 0.6, 0, -h); ctx.quadraticCurveTo(5, -h * 0.6, 4, 0); ctx.closePath();
          paint(ctx, S, i % 2 ? lf : lf2);
          line(ctx, S, [-2, -h * 0.3, 2, -h * 0.34], 0.5, lighter(lf, 0.4)); line(ctx, S, [-2, -h * 0.55, 2, -h * 0.59], 0.5, lighter(lf, 0.4));
          ctx.restore();
        });
      } else {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.36, len = 40 - Math.abs(i - 3) * 3;
          ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(Math.cos(a) * len * 0.6, -24 + Math.sin(a) * len * 0.6 - 6, Math.cos(a) * len, -24 + Math.sin(a) * len + 6);
          ctx.lineWidth = S.lw * 0.7; ctx.strokeStyle = darker(lf, 0.3); ctx.stroke();
          for (let j = 1; j < 6; j++) {
            const t = j / 6, x = Math.cos(a) * len * t, y = -24 + Math.sin(a) * len * t - Math.sin(t * Math.PI) * 6;
            leaf(ctx, S, x, y, 7, 2.4, a - 0.9, i % 2 ? lf : lf2, false); leaf(ctx, S, x, y, 7, 2.4, a + 0.9, i % 2 ? lf : lf2, false);
          }
        }
      }
      pot(ctx, S, 28, 26, p.pc);
    },
  },
  rug: {
    noun: 'rug', kind: 'flat',
    box: () => [-64, -13, 64, 13],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = pal.cream; return { c1, c2, pat: r.pick(PATS), shape: r.pick(['oval', 'rect']) }; },
    muts: [['recolor', 'c1'], ['recolor', 'c2'], ['swap', 'c1', 'c2'], ['pattern', 'pat', PATS], ['shape', 'shape', ['oval', 'rect']]],
    draw(ctx, p, S) {
      const path = () => (p.shape === 'oval' ? el(ctx, 0, 0, 62, 12) : rr(ctx, -60, -11, 120, 22, 3));
      path(); ctx.save(); ctx.fillStyle = p.c1; ctx.fill(); ctx.clip();
      pattern(ctx, p.pat, -64, -13, 128, 26, p.c2, 5);
      ctx.fillStyle = S.shade; ctx.fillRect(-64, 5, 128, 10);
      ctx.restore(); path(); ink(ctx, S);
      if (p.shape === 'oval') { el(ctx, 0, 0, 52, 8.5); ctx.lineWidth = S.lw * 0.6; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke(); }
      else { for (const x of [-60, 60]) for (let y = -9; y <= 9; y += 4.5) line(ctx, S, [x, y, x + (x < 0 ? -4 : 4), y], 0.5); }
    },
  },
  guitar: {
    noun: 'guitar', kind: 'stand', flip: true,
    box: () => [-17, -80, 22, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      ctx.save(); ctx.rotate(0.24);
      rr(ctx, -2.6, -80, 5.2, 50, 1.5); paint(ctx, S, darker(S.pal.wood || '#9a6b45', 0.1));
      rr(ctx, -4, -86, 8, 10, 2); paint(ctx, S, darker(S.pal.wood || '#9a6b45', 0.25));
      for (let y = -74; y < -36; y += 7) line(ctx, S, [-2.6, y, 2.6, y], 0.4, S.hi);
      ctx.beginPath(); ctx.ellipse(0, -36, 10, 9.5, 0, 0, TAU); ctx.moveTo(15, -12); ctx.ellipse(0, -12, 15, 13, 0, 0, TAU);
      blob(ctx, S, p.c, [6, -48, 14, 50]);
      ci(ctx, 0, -24, 4.6); fill(ctx, S.ink);
      rr(ctx, -6, -8, 12, 3.4, 1.2); paint(ctx, S, darker(S.pal.wood || '#9a6b45', 0.2));
      line(ctx, S, [-1, -78, -1, -7], 0.3, S.hi); line(ctx, S, [1, -78, 1, -7], 0.3, S.hi);
      ctx.restore();
    },
  },
  catbed: {
    noun: 'cat bed', kind: 'stand',
    box: () => [-27, -19, 27, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    surface: () => ({ x0: -14, x1: 14, y: -7 }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 26);
      el(ctx, 0, -8, 26, 11); paint(ctx, S, p.c, [10, -19, 18, 22]);
      el(ctx, 0, -11, 19, 6); paint(ctx, S, darker(p.c, 0.18));
      el(ctx, 0, -10, 16, 4.2); fill(ctx, lighter(p.c, 0.2));
    },
  },
  cat: {
    noun: 'cat', kind: 'stand', flip: true,
    box: (p) => (p.pose === 'sit' ? [-14, -48, 23, 0] : p.pose === 'loaf' ? [-23, -30, 27, 0] : [-22, -24, 22, 0]),
    make: (r, pal, o = {}) => ({ pose: o.pose || r.pick(['sit', 'sit', 'loaf', 'curl']), col: r.pick(pal.acc), st: r.int(2, 3) }),
    muts: [['recolor', 'col', (p) => (p.pose === 'sit' ? [-11, -28, 11, -18] : [6, -18, 22, -6]), 'acc', { noun: 'cat\'s collar', when: (p) => p.pose !== 'curl' }], ['count', 'st', 1, 4, null, { noun: 'cat\'s stripes' }]],
    draw(ctx, p, S) {
      if (p.pose === 'sit') {
        gs(ctx, S, 16);
        ctx.beginPath(); ctx.moveTo(8, -3); ctx.bezierCurveTo(22, -2, 24, -14, 18, -26); tube(ctx, S, FUR, 5.4);
        ctx.beginPath(); ctx.moveTo(18, -26); ctx.lineTo(19, -30); ctx.lineWidth = 5.4; ctx.strokeStyle = FUR2; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.bezierCurveTo(-15, -14, -10, -28, 0, -28); ctx.bezierCurveTo(10, -28, 15, -14, 13, 0); ctx.closePath();
        paint(ctx, S, FUR, [5, -30, 10, 30]);
        for (let i = 0; i < p.st; i++) { const y = -20 + i * 5.5; line(ctx, S, [-12.6, y, -8, y + 1.6], 1.1, FUR2); line(ctx, S, [12.6, y, 8, y + 1.6], 1.1, FUR2); }
        el(ctx, 0, -14, 5.5, 9); fill(ctx, FUR3);
        el(ctx, -5, -1.8, 4.2, 2.6); paint(ctx, S, FUR3); el(ctx, 5, -1.8, 4.2, 2.6); paint(ctx, S, FUR3);
        rr(ctx, -9, -27.5, 18, 3.6, 1.8); paint(ctx, S, p.col); ci(ctx, 0, -22.5, 2); paint(ctx, S, '#ffd45c');
        catEars(ctx, S, 0, -36, 1);
        el(ctx, 0, -35, 12, 9.5); paint(ctx, S, FUR, [5, -46, 8, 20]);
        for (const dx of [-3, 0, 3]) line(ctx, S, [dx, -44, dx * 0.8, -40.5], 0.8, FUR2);
        el(ctx, 0, -31, 5.5, 3.6); fill(ctx, FUR3);
        catFace(ctx, S, 0, -34, 1, false);
      } else if (p.pose === 'loaf') {
        gs(ctx, S, 22);
        ctx.beginPath(); ctx.moveTo(-16, -2); ctx.bezierCurveTo(-24, -2, -24, 6, -12, 0); tube(ctx, S, FUR, 4.6);
        el(ctx, -2, -11, 21, 11); paint(ctx, S, FUR, [6, -22, 18, 22]);
        for (let i = 0; i < p.st; i++) { const x = -14 + i * 7; line(ctx, S, [x, -21, x + 2, -14], 1.1, FUR2); }
        el(ctx, 10, -2, 5, 2.4); paint(ctx, S, FUR3);
        rr(ctx, 8, -17, 4, 11, 2); paint(ctx, S, p.col);
        catEars(ctx, S, 15, -21, 0.85);
        el(ctx, 15, -19, 10.5, 8.5); paint(ctx, S, FUR, [20, -28, 8, 18]);
        el(ctx, 15, -15.6, 4.6, 3); fill(ctx, FUR3);
        catFace(ctx, S, 15, -18, 0.86, false);
      } else {
        gs(ctx, S, 20);
        el(ctx, 0, -10, 20, 10); paint(ctx, S, FUR, [8, -20, 14, 20]);
        for (let i = 0; i < p.st; i++) { const x = 2 + i * 6; ctx.beginPath(); ctx.arc(x, -6, 9, -2.2, -1.4); ctx.lineWidth = S.lw * 1.1; ctx.strokeStyle = FUR2; ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(18, -6); ctx.bezierCurveTo(22, 2, -4, 2, -14, -1); tube(ctx, S, FUR, 4.4);
        catEars(ctx, S, -10, -12, 0.75);
        el(ctx, -10, -10, 9.5, 7.5); paint(ctx, S, FUR);
        el(ctx, -10, -7.4, 4.2, 2.6); fill(ctx, FUR3);
        catFace(ctx, S, -10, -9.6, 0.75, true);
        ctx.lineWidth = S.lw * 0.7; ctx.strokeStyle = S.ink;
        poly(ctx, [-24, -22, -19, -22, -24, -17, -19, -17], false); ctx.stroke();
      }
    },
  },
  sneakers: {
    noun: 'sneakers', kind: 'stand', flip: true,
    box: () => [-22, -13, 22, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), lc: pal.cream || '#fffaf0' }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 21);
      for (const [x, k] of [[-7, 0.92], [6, 1]]) {
        ctx.save(); ctx.translate(x, 0); ctx.scale(k, k);
        ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-12, -10); ctx.quadraticCurveTo(-6, -13, -2, -10); ctx.quadraticCurveTo(6, -8, 13, -4); ctx.quadraticCurveTo(15, -1, 13, 0); ctx.lineTo(-13, 0); ctx.closePath();
        paint(ctx, S, p.c, [4, -12, 12, 12]);
        rr(ctx, -14, -3.4, 28.5, 3.4, 1.6); paint(ctx, S, '#fffaf0');
        for (const lx of [-4, -0.5, 3]) line(ctx, S, [lx, -10.5 + (lx + 4) * 0.25, lx + 2.6, -8 + (lx + 4) * 0.25], 0.7, p.lc);
        ctx.restore();
      }
    },
  },
  plushie: {
    noun: 'plushie', kind: 'stand',
    box: () => [-15, -34, 15, 0],
    make: (r, pal) => ({ kind: r.pick(['bunny', 'bear', 'chick']), c: r.pick(pal.acc), bow: r.pick(pal.acc) }),
    muts: [['shape', 'kind', ['bunny', 'bear', 'chick']], ['recolor', 'c'], ['recolor', 'bow', [-8, -18, 8, -10], 'acc', { noun: 'plushie\'s bow' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 13);
      const c = p.kind === 'chick' ? '#ffd65c' : p.c;
      el(ctx, -6, -3, 5, 3.4); paint(ctx, S, c); el(ctx, 6, -3, 5, 3.4); paint(ctx, S, c);
      el(ctx, 0, -10, 10, 9); paint(ctx, S, c, [4, -19, 8, 18]);
      el(ctx, 0, -9, 5.5, 5.5); fill(ctx, lighter(c, 0.35));
      if (p.kind === 'bunny') { for (const k of [-1, 1]) { el(ctx, k * 4.5, -32, 3.2, 8, k * 0.15); paint(ctx, S, c); el(ctx, k * 4.5, -31.5, 1.5, 5.5, k * 0.15); fill(ctx, '#f6b2c4'); } }
      if (p.kind === 'bear') { for (const k of [-1, 1]) { ci(ctx, k * 8, -28, 4); paint(ctx, S, c); ci(ctx, k * 8, -28, 1.8); fill(ctx, lighter(c, 0.35)); } }
      ci(ctx, 0, -22, 9); paint(ctx, S, c, [4, -31, 7, 18]);
      if (p.kind === 'chick') { poly(ctx, [-2.4, -21, 2.4, -21, 0, -17.6]); paint(ctx, S, '#f39a3c'); ctx.beginPath(); ctx.moveTo(-2, -31); ctx.quadraticCurveTo(0, -36, 2, -31); ink(ctx, S, 0.8); }
      else { el(ctx, 0, -19.5, 3.4, 2.4); fill(ctx, lighter(c, 0.4)); ci(ctx, 0, -20.4, 1); fill(ctx, S.ink); }
      ci(ctx, -3.6, -23.5, 1.25); fill(ctx, S.ink); ci(ctx, 3.6, -23.5, 1.25); fill(ctx, S.ink);
      el(ctx, -6.4, -20, 1.6, 1); fill(ctx, 'rgba(243,120,150,0.45)'); el(ctx, 6.4, -20, 1.6, 1); fill(ctx, 'rgba(243,120,150,0.45)');
      poly(ctx, [0, -13, -6, -16.5, -6, -9.5]); paint(ctx, S, p.bow); poly(ctx, [0, -13, 6, -16.5, 6, -9.5]); paint(ctx, S, p.bow); ci(ctx, 0, -13, 1.6); paint(ctx, S, p.bow);
    },
  },

  // ===== on a table =====
  books: {
    noun: 'books', kind: 'stand',
    box: (p) => [-19, -bookStackH(p), 19, 0],
    make: (r, pal) => ({ n: r.int(2, 4), cols: pickN(r, pal.acc, 6), ws: Array.from({ length: 6 }, () => r.int(28, 36)), off: Array.from({ length: 6 }, () => r.int(-3, 3)) }),
    muts: [['count', 'n', 1, 5, null, { noun: 'books' }], ['recolorAt', 'cols', 'n', (p, i) => { const y = -bookStackH(p, i + 1); return [-19, y, 19, y + 6.2]; }, { noun: 'book' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 17);
      let y = 0;
      for (let i = 0; i < p.n; i++) {
        const w = p.ws[i], x = -w / 2 + p.off[i];
        y -= 6.2;
        rr(ctx, x, y, w, 6.2, 1.2); paint(ctx, S, p.cols[i], [x, y + 4, w, 2.2]);
        rr(ctx, x + w - 5, y + 1.4, 4, 3.4, 0.6); fill(ctx, S.pal.cream || '#fffaf0');
        line(ctx, S, [x + 3, y + 3.1, x + 8, y + 3.1], 0.45, lighter(p.cols[i], 0.55));
      }
    },
  },
  mug: {
    noun: 'mug', kind: 'stand', flip: true, small: true,
    box: (p) => [-10, p.steam ? -33 : -21, 15, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), deco: r.pick(DECOS), steam: r.chance(0.5) }),
    muts: [['recolor', 'c', [-10, -21, 15, 0]], ['pattern', 'deco', DECOS, [-10, -21, 10, 0], { noun: 'mug' }], ['toggle', 'steam', 'shape', [-8, -33, 8, -20], { noun: 'steam' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 11);
      ctx.beginPath(); ctx.arc(9, -10, 5, -1.25, 1.25); tube(ctx, S, p.c, 2.6);
      rr(ctx, -9, -19, 18, 19, 3.5);
      ctx.save(); ctx.fillStyle = p.c; ctx.fill(); ctx.clip();
      const cr = S.pal.cream || '#fffaf0';
      if (p.deco === 'stripe') { ctx.fillStyle = cr; ctx.fillRect(-9, -13, 18, 4.2); }
      else if (p.deco === 'dots') pattern(ctx, 'dots', -9, -19, 18, 19, cr, 5);
      else if (p.deco === 'heart') { heartPath(ctx, 0, -9.5, 4.4); ctx.fillStyle = cr; ctx.fill(); }
      ctx.fillStyle = S.shade; ctx.fillRect(S.flip ? -9 : 3.5, -19, 6, 19);
      ctx.restore();
      rr(ctx, -9, -19, 18, 19, 3.5); ink(ctx, S);
      el(ctx, 0, -18.6, 7.4, 1.7); fill(ctx, S.pal.coffee || '#6b4430');
      if (p.steam) for (const x of [-3, 3]) { ctx.beginPath(); ctx.moveTo(x, -23); ctx.bezierCurveTo(x - 4, -26, x + 4, -28, x, -32); ctx.lineWidth = S.lw * 0.9; ctx.lineCap = 'round'; ctx.strokeStyle = S.steam || 'rgba(60,40,70,0.35)'; ctx.stroke(); }
    },
  },
  teapot: {
    noun: 'teapot', kind: 'stand', flip: true,
    box: () => [-23, -31, 21, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), pat: r.pick(['plain', 'dots', 'bands', 'hearts']) }),
    muts: [['recolor', 'c'], ['pattern', 'pat', ['plain', 'dots', 'bands', 'hearts']]],
    draw(ctx, p, S) {
      gs(ctx, S, 15);
      ctx.beginPath(); ctx.moveTo(-10, -7); ctx.quadraticCurveTo(-18, -9, -22, -22); ctx.lineTo(-18, -23); ctx.quadraticCurveTo(-16, -15, -10, -15); ctx.closePath(); paint(ctx, S, p.c);
      ctx.beginPath(); ctx.arc(12, -13, 6.4, -1.3, 1.3); tube(ctx, S, p.c, 2.8);
      el(ctx, 0, -12, 14, 12); ctx.save(); ctx.fillStyle = p.c; ctx.fill(); ctx.clip();
      if (p.pat !== 'plain') pattern(ctx, p.pat, -14, -24, 28, 24, lighter(p.c, 0.5), 4.5);
      ctx.fillStyle = S.shade; ctx.fillRect(S.flip ? -14 : 5, -24, 10, 24);
      ctx.restore(); el(ctx, 0, -12, 14, 12); ink(ctx, S);
      gloss(ctx, S, 0, -12, 9.5, 3.5, 4.3);
      el(ctx, 0, -23.5, 8, 2.8); paint(ctx, S, lighter(p.c, 0.1));
      ci(ctx, 0, -28, 2.6); paint(ctx, S, lighter(p.c, 0.1));
    },
  },
  cake: {
    noun: 'cake', kind: 'stand',
    box: () => [-21, -40, 21, 0],
    make: (r, pal) => ({ fr: r.pick(pal.frost || pal.acc), sp: r.pick(['#f6d7a7', '#e9b98a', '#8a5a44', '#f9c6d3']), n: r.int(1, 4), cc: pickN(r, pal.acc, 5) }),
    muts: [['count', 'n', 1, 5, [-16, -40, 16, -24], { noun: 'candles' }], ['recolor', 'fr', [-17, -27, 17, -16], 'frost', { noun: 'frosting' }], ['recolor', 'sp', [-15, -20, 15, -2], 'sponge', { noun: 'cake' }]],
    draw(ctx, p, S) {
      el(ctx, 0, -1.5, 21, 3.4); paint(ctx, S, S.pal.cream || '#fffaf0');
      rr(ctx, -15, -22, 30, 20, 2.5); paint(ctx, S, p.sp, [6, -22, 10, 20]);
      line(ctx, S, [-15, -11, 15, -11], 1.4, p.fr);
      ctx.beginPath(); ctx.moveTo(-16, -19); ctx.lineTo(-16, -24); ctx.quadraticCurveTo(-16, -27, -12, -27); ctx.lineTo(12, -27); ctx.quadraticCurveTo(16, -27, 16, -24); ctx.lineTo(16, -18);
      for (const [x, d] of [[12, 4], [7, 7], [1, 3.5], [-5, 6], [-11, 4]]) { ctx.lineTo(x + 1.6, -19); ctx.quadraticCurveTo(x, -19 + d * 2, x - 1.6, -19); }
      ctx.closePath(); paint(ctx, S, p.fr);
      for (let i = 0; i < p.n; i++) {
        const x = p.n === 1 ? 0 : -10 + (20 * i) / (p.n - 1);
        rr(ctx, x - 1.4, -35, 2.8, 9, 1); paint(ctx, S, p.cc[i]);
        line(ctx, S, [x - 1.4, -31, x + 1.4, -33], 0.4, '#ffffff');
        glow(ctx, x, -38, 5, '#ffcf6a', 0.5);
        ctx.beginPath(); ctx.moveTo(x, -42); ctx.quadraticCurveTo(x + 2.6, -38, x, -36); ctx.quadraticCurveTo(x - 2.6, -38, x, -42); fill(ctx, FLAME);
      }
    },
  },
  fruitbowl: {
    noun: 'fruit bowl', kind: 'stand',
    box: () => [-23, -27, 23, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), n: r.int(3, 5), fr: pickN(r, FRUIT, 5) }),
    muts: [['count', 'n', 2, 5, null, { noun: 'fruit' }], ['recolorAt', 'fr', 'n', (p, i) => { const [x, y] = FRUIT_AT[i]; return [x - 7, y - 7, x + 7, y + 7]; }, { list: 'fruit', noun: 'fruit' }], ['recolor', 'c', [-22, -13, 22, 0], 'acc', { noun: 'bowl' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      for (let i = p.n - 1; i >= 0; i--) {
        const [x, y] = FRUIT_AT[i];
        ci(ctx, x, y, 6.4); paint(ctx, S, p.fr[i], [x + 2, y - 7, 6, 14]);
        gloss(ctx, S, x, y, 4, 3.6, 4.4, 0.9);
        line(ctx, S, [x, y - 6, x + 1, y - 9], 0.7);
      }
      ctx.beginPath(); ctx.moveTo(-22, -13); ctx.lineTo(22, -13); ctx.quadraticCurveTo(20, -1, 0, -1); ctx.quadraticCurveTo(-20, -1, -22, -13); ctx.closePath();
      paint(ctx, S, p.c, [8, -13, 16, 13]);
      rr(ctx, -6, -2, 12, 2.4, 1); paint(ctx, S, darker(p.c, 0.15));
      line(ctx, S, [-15, -9, -5, -6], 0.6, S.hi);
    },
  },
  laptop: {
    noun: 'laptop', kind: 'stand',
    box: () => [-25, -30, 25, 0],
    make: (r, pal) => ({ c: r.pick(['#c9c4d6', '#3a3550', '#f2e6ff', '#ffd6e6']), sc: r.pick(pal.screen || ['#8be0d0', '#c9b6ff', '#ffb3cf', '#ffe08a']), sym: r.pick(['heart', 'star', 'moon', 'note', 'smile', 'bolt']) }),
    muts: [['recolor', 'sc', [-18, -27, 18, -6], 'screen', { noun: 'laptop screen' }], ['symbol', 'sym', ['heart', 'star', 'moon', 'note', 'smile', 'bolt'], [-14, -25, 14, -7], { noun: 'laptop screen' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 24);
      rr(ctx, -20, -30, 40, 26, 3); paint(ctx, S, p.c);
      rr(ctx, -17, -27, 34, 20, 1.5); fill(ctx, p.sc);
      if (S.night) glow(ctx, 0, -17, 18, p.sc, 0.35);
      symbol(ctx, S, p.sym, 0, -17, 6.4, '#ffffff', { w: 0.55 });
      rr(ctx, -17, -27, 34, 20, 1.5); ink(ctx, S, 0.7);
      poly(ctx, [-25, 0, 25, 0, 21, -5, -21, -5]); paint(ctx, S, p.c, [-25, -2, 50, 2]);
      rr(ctx, -5, -3.4, 10, 1.6, 0.8); fill(ctx, darker(p.c, 0.25));
    },
  },
  succulent: {
    noun: 'little plant', kind: 'stand', small: true,
    box: () => [-12, -27, 12, 0],
    make: (r, pal) => ({ pc: r.pick(pal.acc), kind: r.pick(['rosette', 'ball', 'sprout']) }),
    muts: [['recolor', 'pc', [-11, -14, 11, 0], 'acc', { noun: 'little pot' }], ['shape', 'kind', ['rosette', 'ball', 'sprout'], [-12, -27, 12, -10], { noun: 'little plant' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 9);
      const lf = S.pal.leaf || '#6cbf7a';
      if (p.kind === 'rosette') { for (const a of [-2.6, -2.1, -1.57, -1.05, -0.55]) leaf(ctx, S, 0, -12, 13, 4, a, Math.abs(a + 1.57) < 0.2 ? lighter(lf, 0.15) : lf, false); }
      else if (p.kind === 'ball') { el(ctx, 0, -18, 8.5, 8); paint(ctx, S, lf, [3, -26, 6, 16]); for (const x of [-4, 0, 4]) line(ctx, S, [x, -25, x * 1.2, -12], 0.45, darker(lf, 0.25)); symbol(ctx, S, 'flower', 0, -26, 3.2, '#ff8fb1', { w: 0.5 }); }
      else { line(ctx, S, [0, -12, 0, -21], 1); leaf(ctx, S, 0, -20, 9, 3.6, -2.7, lf, false); leaf(ctx, S, 0, -21, 9, 3.6, -0.45, lighter(lf, 0.1), false); }
      pot(ctx, S, 20, 14, p.pc);
    },
  },
  cactus: {
    noun: 'cactus', kind: 'stand',
    box: () => [-14, -49, 14, 0],
    make: (r, pal) => ({ pc: r.pick(pal.acc), arms: r.int(1, 2), fl: r.chance(0.6) }),
    muts: [['count', 'arms', 0, 2, [-14, -40, 14, -16], { noun: 'cactus arms' }], ['toggle', 'fl', 'shape', [-6, -49, 6, -39], { noun: 'cactus flower' }], ['recolor', 'pc', [-12, -15, 12, 0], 'acc', { noun: 'cactus pot' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 10);
      const g = S.pal.cactus || '#5fae7a';
      if (p.arms >= 1) { ctx.beginPath(); ctx.moveTo(-5, -22); ctx.lineTo(-10, -22); ctx.lineTo(-10, -32); tube(ctx, S, g, 5.6); }
      if (p.arms >= 2) { ctx.beginPath(); ctx.moveTo(5, -27); ctx.lineTo(10, -27); ctx.lineTo(10, -38); tube(ctx, S, g, 5.6); }
      rr(ctx, -6, -44, 12, 32, 6); paint(ctx, S, g, [2, -44, 5, 32]);
      for (const x of [-2.5, 2]) line(ctx, S, [x, -40, x, -16], 0.45, darker(g, 0.3));
      if (p.fl) symbol(ctx, S, 'flower', 0, -45, 4, '#ff7aa8', { w: 0.6 });
      pot(ctx, S, 22, 15, p.pc);
    },
  },
  fishbowl: {
    noun: 'fishbowl', kind: 'stand',
    box: () => [-20, -38, 20, 0],
    make: (r, pal) => ({ n: r.int(1, 3), fc: pickN(r, FISH, 4) }),
    muts: [['count', 'n', 1, 4, [-16, -26, 16, -6], { noun: 'fish' }], ['recolorAt', 'fc', 'n', (p, i) => { const [x, y] = FISH_AT[i]; return [x - 6, y - 4, x + 6, y + 4]; }, { list: 'fish', noun: 'fish' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      ctx.save(); ci(ctx, 0, -18, 18); ctx.clip();
      ctx.fillStyle = 'rgba(220,240,255,0.55)'; ctx.fillRect(-20, -38, 40, 40);
      ctx.fillStyle = '#8fd3ec'; ctx.fillRect(-20, -27, 40, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-20, -27, 40, 2);
      for (const [x, c] of [[-8, '#f6c15e'], [-3, '#ff9fb6'], [3, '#b9a7ff'], [8, '#f6c15e'], [0, '#ffffff']]) { ci(ctx, x, -2.5, 3); fill(ctx, c); }
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(6, -10, 10, -20); ctx.lineWidth = 2.4; ctx.strokeStyle = '#4fae6a'; ctx.stroke();
      for (let i = 0; i < p.n; i++) {
        const [x, y, d] = FISH_AT[i];
        ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
        poly(ctx, [-4, 0, -8, -3.4, -8, 3.4]); paint(ctx, S, p.fc[i]);
        el(ctx, 0, 0, 5.4, 3.6); paint(ctx, S, p.fc[i]);
        ci(ctx, 2.6, -0.8, 0.8); fill(ctx, S.ink);
        ctx.restore();
      }
      for (const [x, y] of [[-6, -21], [-4, -15]]) { ci(ctx, x, y, 1.1); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke(); }
      ctx.restore();
      ci(ctx, 0, -18, 18); ink(ctx, S);
      gloss(ctx, S, 0, -18, 14, 3.5, 4.4, 1.2);
      el(ctx, 0, -34.5, 9.5, 2.6); paint(ctx, S, 'rgba(240,250,255,0.9)');
    },
  },
  headphones: {
    noun: 'headphones', kind: 'stand', flip: (p) => p.mic,
    box: (p) => [p.mic ? -24 : -18, -32, 18, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), cu: r.pick(['#3a3550', '#fffaf0', '#f6b2c4']), mic: r.chance(0.5) }),
    muts: [['recolor', 'c'], ['recolor', 'cu', [-18, -16, 18, 0], 'cushion', { noun: 'headphone cushions' }], ['toggle', 'mic', 'shape', [-24, -14, -10, 0], { noun: 'headset mic' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 16);
      ctx.beginPath(); ctx.arc(0, -13, 14, Math.PI, 0); tube(ctx, S, p.c, 3.4);
      rr(ctx, -9, -31, 18, 4.5, 2); paint(ctx, S, lighter(p.c, 0.2));
      if (p.mic) { ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-22, -6, -18, 1); tube(ctx, S, '#3a3550', 1.8); ci(ctx, -18, -0.5, 2.6); paint(ctx, S, p.c); }
      for (const k of [-1, 1]) { rr(ctx, k * 13 - 4.5, -16, 9, 16, 3.5); paint(ctx, S, p.c, [k * 13, -16, 6, 16]); rr(ctx, k * 13 - (k > 0 ? 4.5 : -1.5) - 3, -14, 6, 12, 2.5); fill(ctx, p.cu); }
    },
  },
  monitor: {
    noun: 'monitor', kind: 'stand',
    box: () => [-33, -58, 33, 0],
    make: (r, pal) => ({ sc: r.pick(pal.screen || ['#8be0d0', '#c9b6ff', '#ffb3cf']), sym: r.pick(['heart', 'star', 'smile', 'note', 'moon', 'cat']), bz: '#2b2440' }),
    muts: [['recolor', 'sc', [-29, -55, 29, -20], 'screen', { noun: 'screen' }], ['symbol', 'sym', ['heart', 'star', 'smile', 'note', 'moon', 'cat'], [-16, -50, 16, -24], { noun: 'screen' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 15);
      el(ctx, 0, -2.5, 14, 3); paint(ctx, S, p.bz);
      rr(ctx, -3.5, -20, 7, 18, 1.5); paint(ctx, S, p.bz);
      rr(ctx, -33, -58, 66, 41, 4); paint(ctx, S, p.bz);
      rr(ctx, -29, -55, 58, 34, 2);
      const g = ctx.createLinearGradient(0, -55, 0, -21); g.addColorStop(0, lighter(p.sc, 0.35)); g.addColorStop(1, p.sc);
      ctx.fillStyle = g; ctx.fill();
      if (S.night) glow(ctx, 0, -38, 34, p.sc, 0.3);
      symbol(ctx, S, p.sym, 0, -38, 9, '#ffffff', { w: 0.6 });
      for (const [x, w] of [[-25, 9], [-25, 6]]) rr(ctx, x, -51 + (w === 6 ? 4 : 0), w, 2, 1), fill(ctx, 'rgba(255,255,255,0.75)');
      ci(ctx, 23, -50, 1.8); fill(ctx, '#ff5a7a');
      rr(ctx, -29, -55, 58, 34, 2); ink(ctx, S, 0.7);
    },
  },
  mic: {
    noun: 'microphone', kind: 'stand',
    box: () => [-10, -44, 10, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 9);
      el(ctx, 0, -2.5, 9, 2.8); paint(ctx, S, '#3a3550');
      rr(ctx, -1.6, -24, 3.2, 21, 1); paint(ctx, S, '#c9c4d6');
      ctx.beginPath(); ctx.arc(0, -28, 7.5, 0.1, Math.PI - 0.1); ctx.lineWidth = S.lw * 1.4; ctx.strokeStyle = S.ink; ctx.stroke();
      rr(ctx, -6, -44, 12, 20, 6); paint(ctx, S, p.c, [2, -44, 5, 20]);
      for (let y = -40; y < -28; y += 3.2) line(ctx, S, [-4, y, 4, y], 0.4, darker(p.c, 0.3));
    },
  },
  vase: {
    noun: 'flowers', kind: 'stand',
    box: () => [-15, -52, 15, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), shape: r.pick(['round', 'tall']), n: r.int(2, 4), fc: pickN(r, pal.flowers || pal.acc, 4) }),
    muts: [['count', 'n', 1, 4, [-15, -52, 15, -24], { noun: 'flowers' }], ['recolor', 'c', [-10, -24, 10, 0], 'acc', { noun: 'vase' }], ['shape', 'shape', ['round', 'tall'], [-10, -24, 10, 0], { noun: 'vase' }], ['recolorAt', 'fc', 'n', (p, i) => { const [x, y] = FLOWER_AT[i]; return [x - 6, y - 6, x + 6, y + 6]; }, { list: 'flowers', noun: 'flower' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 9);
      for (let i = 0; i < p.n; i++) {
        const [x, y] = FLOWER_AT[i];
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(x * 0.4, (y - 18) / 2 - 8, x, y); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = '#4f9d63'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 5, y - 7); ctx.lineTo(x - 2.4, y - 4.4); ctx.lineTo(x, y - 7.6); ctx.lineTo(x + 2.4, y - 4.4); ctx.lineTo(x + 5, y - 7); ctx.lineTo(x + 5, y - 2); ctx.quadraticCurveTo(x + 4.5, y + 3, x, y + 3); ctx.quadraticCurveTo(x - 4.5, y + 3, x - 5, y - 2); ctx.closePath();
        paint(ctx, S, p.fc[i]);
      }
      leaf(ctx, S, -2, -18, 11, 3, -2.4, '#5fae6a', false); leaf(ctx, S, 2, -18, 11, 3, -0.7, '#4f9d63', false);
      if (p.shape === 'round') { ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(4, -22); ctx.lineTo(4, -18); ctx.bezierCurveTo(14, -14, 12, 0, 0, 0); ctx.bezierCurveTo(-12, 0, -14, -14, -4, -18); ctx.closePath(); paint(ctx, S, p.c, [3, -22, 10, 22]); }
      else { ctx.beginPath(); ctx.moveTo(-5, -26); ctx.lineTo(5, -26); ctx.quadraticCurveTo(4, -14, 7, -2); ctx.lineTo(-7, -2); ctx.quadraticCurveTo(-4, -14, -5, -26); ctx.closePath(); paint(ctx, S, p.c, [2, -26, 8, 26]); rr(ctx, -7.5, -3, 15, 3, 1); paint(ctx, S, darker(p.c, 0.1)); }
    },
  },
  toaster: {
    noun: 'toaster', kind: 'stand',
    box: (p) => [-17, p.n ? -32 : -22, 17, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), n: r.int(0, 2) }),
    muts: [['recolor', 'c', [-17, -22, 17, 0]], ['count', 'n', 0, 2, [-12, -32, 12, -18], { noun: 'toast' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 15);
      for (let i = 0; i < p.n; i++) { const x = i ? 4.5 : -4.5; rr(ctx, x - 5, -32, 10, 14, 4); paint(ctx, S, '#f2c27b', [x + 1, -32, 4, 14]); rr(ctx, x - 3.5, -30.5, 7, 9, 3); fill(ctx, '#f8dba6'); }
      rr(ctx, -16, -22, 32, 21, 7); paint(ctx, S, p.c, [6, -22, 11, 21]);
      for (const x of [-4.5, 4.5]) { rr(ctx, x - 5, -22.6, 10, 2.6, 1.2); fill(ctx, S.ink); }
      rr(ctx, 12, -15, 6, 3, 1.2); paint(ctx, S, '#3a3550');
      line(ctx, S, [-12, -17, -12, -7], 0.8, S.hi);
      rr(ctx, -14, -1.6, 4, 1.6, 0.6); fill(ctx, S.ink); rr(ctx, 10, -1.6, 4, 1.6, 0.6); fill(ctx, S.ink);
    },
  },
  jar: {
    noun: 'cookie jar', kind: 'stand',
    box: () => [-13, -32, 13, 0],
    make: (r, pal) => ({ lid: r.pick(pal.acc), n: r.int(2, 4), lb: r.pick(pal.acc) }),
    muts: [['recolor', 'lid', [-11, -32, 11, -23], 'acc', { noun: 'jar lid' }], ['count', 'n', 1, 5, [-11, -22, 11, -2], { noun: 'cookies' }], ['recolor', 'lb', [-8, -16, 8, -6], 'acc', { noun: 'jar label' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 11);
      rr(ctx, -11, -24, 22, 24, 5); fill(ctx, 'rgba(225,242,250,0.7)');
      for (let i = 0; i < p.n; i++) { const x = [-5, 4, -1, 5, -6][i], y = [-5, -6, -12, -14, -15][i]; ci(ctx, x, y, 4.6); paint(ctx, S, '#d9a066'); for (const [dx, dy] of [[-1.5, -1], [1.4, 0.8], [0, 2]]) { ci(ctx, x + dx, y + dy, 0.8); fill(ctx, '#6b4430'); } }
      rr(ctx, -6.5, -17.5, 13, 8, 1.5); paint(ctx, S, p.lb);
      symbol(ctx, S, 'heart', 0, -13.6, 2.6, '#ffffff', { bare: true });
      rr(ctx, -11, -24, 22, 24, 5); ink(ctx, S);
      gloss(ctx, S, -4, -12, 6, 3.4, 4.2, 0.9);
      rr(ctx, -12, -28, 24, 5, 2); paint(ctx, S, p.lid); ci(ctx, 0, -30, 2.6); paint(ctx, S, p.lid);
    },
  },
  cookpot: {
    noun: 'pot', kind: 'stand',
    box: () => [-21, -36, 21, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), steam: r.chance(0.6) }),
    muts: [['recolor', 'c', [-21, -26, 21, 0]], ['toggle', 'steam', 'shape', [-10, -36, 10, -24], { noun: 'steam' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 16);
      for (const k of [-1, 1]) { rr(ctx, k * 18 - 4, -16, 8, 4, 2); paint(ctx, S, darker(p.c, 0.2)); }
      rr(ctx, -16, -21, 32, 20, 4); paint(ctx, S, p.c, [7, -21, 10, 20]);
      line(ctx, S, [-12, -15, -12, -6], 0.8, S.hi);
      el(ctx, 0, -21.5, 17, 3.4); paint(ctx, S, lighter(p.c, 0.15));
      ci(ctx, 0, -25, 2.6); paint(ctx, S, darker(p.c, 0.25));
      if (p.steam) for (const x of [-5, 1, 7]) { ctx.beginPath(); ctx.moveTo(x, -27); ctx.bezierCurveTo(x - 4, -30, x + 4, -32, x, -36); ctx.lineWidth = S.lw * 0.9; ctx.lineCap = 'round'; ctx.strokeStyle = S.steam || 'rgba(60,40,70,0.35)'; ctx.stroke(); }
    },
  },
  fridge: {
    noun: 'fridge', kind: 'stand', fixed: true,
    box: () => [-30, -116, 30, 0],
    make: (r, pal) => ({ c: r.pick(pal.fridge || pal.acc), n: r.int(2, 4), mc: pickN(r, pal.acc, 5) }),
    muts: [['recolor', 'c', null, 'fridge', { noun: 'fridge' }], ['count', 'n', 1, 5, [-22, -110, 22, -78], { noun: 'fridge magnets' }], ['recolorAt', 'mc', 'n', (p, i) => { const [x, y] = MAG_AT[i]; return [x - 5, y - 5, x + 5, y + 5]; }, { noun: 'magnet' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 28);
      rr(ctx, -28, -116, 56, 114, 6); paint(ctx, S, p.c, [16, -116, 13, 114]);
      line(ctx, S, [-28, -76, 28, -76], 0.9);
      for (const [y0, y1] of [[-108, -84], [-68, -40]]) rr(ctx, 19, y0, 4.5, y1 - y0, 2.2), paint(ctx, S, S.pal.metal || '#c9c4d6');
      line(ctx, S, [-22, -110, -22, -82], 0.8, S.hi);
      for (let i = 0; i < p.n; i++) { const [x, y, k] = MAG_AT[i]; symbol(ctx, S, k, x, y, 4.2, p.mc[i], { w: 0.7 }); }
      rr(ctx, -24, -2, 7, 2.4, 1); fill(ctx, S.ink); rr(ctx, 17, -2, 7, 2.4, 1); fill(ctx, S.ink);
    },
  },
  pastry: {
    noun: 'pastry', kind: 'stand', small: true,
    box: () => [-15, -19, 15, 0],
    make: (r, pal) => ({ kind: r.pick(['donut', 'cupcake', 'croissant']), fr: r.pick(pal.frost || pal.acc) }),
    muts: [['shape', 'kind', ['donut', 'cupcake', 'croissant']], ['recolor', 'fr', null, 'frost', { noun: 'icing' }]],
    draw(ctx, p, S) {
      el(ctx, 0, -1.5, 15, 2.8); paint(ctx, S, S.pal.cream || '#fffaf0');
      if (p.kind === 'donut') {
        el(ctx, 0, -8, 12, 7); paint(ctx, S, '#e8b375', [4, -15, 9, 14]);
        ctx.beginPath(); ctx.moveTo(-11, -9); ctx.quadraticCurveTo(-12, -15, 0, -15); ctx.quadraticCurveTo(12, -15, 11, -9); ctx.quadraticCurveTo(8, -6, 5, -8); ctx.quadraticCurveTo(0, -5, -5, -8); ctx.quadraticCurveTo(-8, -6, -11, -9); ctx.closePath(); paint(ctx, S, p.fr);
        el(ctx, 0, -11, 3.6, 1.6); fill(ctx, S.ink);
        for (const [x, y, c] of [[-6, -12, '#ffffff'], [5, -12.5, '#ffd45c'], [-2, -13.5, '#7fd6c2'], [7, -10, '#ffffff']]) { rr(ctx, x - 1.2, y - 0.5, 2.4, 1, 0.5); fill(ctx, c); }
      } else if (p.kind === 'cupcake') {
        poly(ctx, [-8, -10, 8, -10, 6, -2, -6, -2]); paint(ctx, S, '#f2c27b', [2, -10, 7, 8]);
        for (const x of [-4, 0, 4]) line(ctx, S, [x, -9, x * 0.8, -3], 0.45);
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(-11, -16, -5, -16); ctx.quadraticCurveTo(-3, -21, 1, -19); ctx.quadraticCurveTo(7, -19, 6, -15); ctx.quadraticCurveTo(11, -15, 10, -10); ctx.closePath(); paint(ctx, S, p.fr);
        ci(ctx, 1, -20, 2.2); paint(ctx, S, '#e2574c');
      } else {
        ctx.beginPath(); ctx.moveTo(-13, -4); ctx.quadraticCurveTo(-10, -15, 0, -15); ctx.quadraticCurveTo(10, -15, 13, -4); ctx.quadraticCurveTo(0, -1, -13, -4); ctx.closePath(); paint(ctx, S, '#e8a95b', [4, -15, 10, 12]);
        for (const x of [-6, 0, 6]) line(ctx, S, [x, -14, x * 1.3, -3], 0.6);
        el(ctx, 0, -10, 4, 2.4); fill(ctx, p.fr);
      }
    },
  },
};

// ---------- small geometry shared with the mutations ----------
function flagX(p, i) { return -p.w / 2 + p.w * ((i + 0.5) / p.n); }
function bookX(row, j) { const total = row.n * 7.6, x0 = -total / 2; return x0 + j * 7.6; }
function bookStackH(p, n = p.n) { return n * 6.2; }
export const FRUIT_AT = [[-9, -16], [0, -18], [9, -16], [-4.5, -23], [4.5, -23]];
export const FISH_AT = [[-5, -18, 1], [6, -10, -1], [-2, -7, 1], [7, -21, -1]];
export const FLOWER_AT = [[-6, -40], [6, -44], [0, -48], [-10, -33]];
export const MAG_AT = [[-14, -100, 'heart'], [-2, -94, 'star'], [10, -104, 'flower'], [-12, -86, 'note'], [8, -88, 'smile']];
export function cloudShape(ctx, x, y, s, n = 4) {
  ctx.beginPath();
  const pts = n === 3 ? [[-0.55, 0.1, 0.45], [0, -0.25, 0.6], [0.55, 0.1, 0.45]] : n === 5 ? [[-0.85, 0.15, 0.35], [-0.45, -0.18, 0.5], [0.05, -0.32, 0.6], [0.5, -0.12, 0.5], [0.88, 0.15, 0.35]] : [[-0.7, 0.12, 0.42], [-0.22, -0.22, 0.56], [0.3, -0.2, 0.52], [0.72, 0.12, 0.42]];
  for (const [dx, dy, r] of pts) { ctx.moveTo(x + dx * s * 2 + r * s * 2, y + dy * s * 2); ctx.arc(x + dx * s * 2, y + dy * s * 2, r * s * 2, 0, TAU); }
  ctx.moveTo(x - s * 1.6, y + s * 0.5); ctx.rect(x - s * 1.6, y, s * 3.2, s * 0.85);
}
function rgbaOf(hex, a) { const h = hex.replace('#', ''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
export function neonPath(ctx, kind, cx, cy, s) {
  if (kind === 'heart') heartPath(ctx, cx, cy, s * 0.8);
  else if (kind === 'star') starPath(ctx, cx, cy, s);
  else if (kind === 'moon') moonPath(ctx, cx - s * 0.1, cy, s * 0.9);
  else if (kind === 'bolt') poly(ctx, [cx + s * 0.18, cy - s, cx - s * 0.55, cy + s * 0.12, cx - s * 0.02, cy + s * 0.12, cx - s * 0.22, cy + s, cx + s * 0.58, cy - s * 0.18, cx + s * 0.04, cy - s * 0.18]);
  else if (kind === 'diamond') poly(ctx, [cx, cy - s, cx + s * 0.72, cy, cx, cy + s, cx - s * 0.72, cy]);
  else { ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.bezierCurveTo(cx + s * 0.3, cy - s * 0.4, cx + s * 0.75, cy, cx + s * 0.7, cy + s * 0.35); ctx.arc(cx, cy + s * 0.32, s * 0.7, 0.05, Math.PI - 0.05); ctx.bezierCurveTo(cx - s * 0.75, cy, cx - s * 0.3, cy - s * 0.4, cx, cy - s); }
}
