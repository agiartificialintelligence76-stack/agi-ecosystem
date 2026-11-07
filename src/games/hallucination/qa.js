// HALLUCINATION: QA views for the screenshot scripts (`?qa=gallery`, `?qa=objects`), never on a link from the site.
// gallery: scenes side by side (memory | redraw), their five changes outlined; objects: every object, then its changes.
import { makeScene } from './scene.js';
import { drawScene, penFor } from './draw.js';
import { LIB, TYPES, drawObject, boxOf } from './objects.js';
import { TEMPLATES } from './templates.js';
import { W, H } from './paint.js';

export function runQa(kind, q) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  document.body.replaceChildren(cv);
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.margin = '0';
  document.body.style.background = '#1d0f2a';
  const ctx = cv.getContext('2d');
  if (kind === 'objects') {
    const pal = TEMPLATES[q.get('tpl') || 'bedroom'].palettes[Number(q.get('pal') || 0)];
    const cols = 8, cw = 120, ch = 120, rows = Math.ceil(TYPES.length / cols);
    cv.width = cols * cw * dpr; cv.height = rows * ch * dpr;
    cv.style.width = `${cols * cw}px`; cv.style.height = `${rows * ch}px`;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = pal.wall || pal.sky2 || '#f5efe6'; ctx.fillRect(0, 0, cols * cw, rows * ch);
    let seed = Number(q.get('seed') || 1);
    TYPES.forEach((t, i) => {
      const def = LIB[t];
      const r = rngLite(seed + i * 31);
      const p = def.make(r, pal, {});
      const o = { type: t, x: 0, y: 0, s: 1, flip: false, p, layer: 0, z: 0 };
      const b = boxOf(o);
      const k = Math.min(1.6, 96 / Math.max(b[2] - b[0], b[3] - b[1]));
      const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch / 2;
      ctx.save(); ctx.translate(cx - ((b[0] + b[2]) / 2) * k, cy - ((b[1] + b[3]) / 2) * k); ctx.scale(k, k);
      const S = penFor(pal, k * 1.2);
      drawObject(ctx, o, S);
      ctx.restore();
      ctx.fillStyle = '#170a36'; ctx.font = '11px monospace'; ctx.fillText(t, (i % cols) * cw + 4, Math.floor(i / cols) * ch + 12);
    });
    return;
  }
  const n = Number(q.get('n') || 6), lvl = Number(q.get('lvl') || 3), tpl = q.get('tpl') || undefined, seed = Number(q.get('seed') || 1);
  const k = Number(q.get('k') || 1.1), pw = W * k, ph = H * k, gap = 10;
  const outline = q.get('outline') !== '0';
  cv.width = (pw * 2 + gap * 3) * dpr; cv.height = ((ph + gap) * n + gap) * dpr;
  cv.style.width = `${pw * 2 + gap * 3}px`; cv.style.height = `${(ph + gap) * n + gap}px`;
  ctx.scale(dpr, dpr);
  for (let i = 0; i < n; i++) {
    const sc = makeScene(seed + i * 101, lvl, { template: tpl, palette: q.get('pal') != null ? Number(q.get('pal')) : undefined });
    for (const [j, which] of [[0, 'a'], [1, 'b']]) {
      ctx.save(); ctx.translate(gap + j * (pw + gap), gap + i * (ph + gap));
      drawScene(ctx, sc, which, k);
      if (outline && which === 'b') for (const d of sc.diffs) { const [x0, y0, x1, y1] = d.region; ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k); ctx.fillStyle = '#ff2d55'; ctx.font = '10px monospace'; ctx.fillText(`${d.kind}:${d.noun}`, x0 * k + 2, y0 * k - 2 < 8 ? y1 * k + 10 : y0 * k - 2); }
      ctx.restore();
    }
    ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText(`${sc.tpl}/${sc.palId} seed ${seed + i * 101} lvl ${lvl}`, gap + 4, gap + i * (ph + gap) + ph - 4);
  }
}
function rngLite(seed) { let a = seed >>> 0; const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return { next, range: (a1, b1) => a1 + (b1 - a1) * next(), int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p, sign: () => (next() < 0.5 ? -1 : 1), shuffle: (arr) => arr }; }
