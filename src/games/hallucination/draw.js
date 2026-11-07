// HALLUCINATION (2026-11-08): one picture of a scene, the memory (`a`) or her redraw (`b`), drawn into a 2D context at
// `k` pixels per page unit: its background, its things in order, its last light. The ink stays about 2 px on any screen.
import { TEMPLATES } from './templates.js';
import { drawObject } from './objects.js';
import { rgbaHex, W, H } from './paint.js';

export function penFor(pal, k) {
  const px = Math.min(2.5, Math.max(1.6, 1.25 + 0.55 * k));
  return {
    ink: pal.ink, lw: px / k, flip: false, pal,
    shade: rgbaHex(pal.ink, 0.15), shade2: rgbaHex(pal.ink, 0.26),
    ground: rgbaHex(pal.ink, 0.15), hi: 'rgba(255,255,255,0.6)', steam: rgbaHex(pal.ink, 0.32),
    night: Boolean(pal.night), warm: Boolean(pal.warm),
  };
}

// draw it with its top-left at (0, 0) of the current transform
export function drawScene(ctx, sc, which = 'a', k = 1) {
  const tpl = TEMPLATES[sc.tpl];
  const list = which === 'b' ? sc.b : sc.a;
  const S = penFor(sc.pal, k);
  ctx.save();
  ctx.scale(k, k);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let layer = 0;
  tpl.paint(ctx, sc, S, 0);
  for (const o of list) {
    while (o.layer > layer) { layer++; tpl.paint(ctx, sc, S, layer); }
    drawObject(ctx, o, S);
  }
  while (layer < 1) { layer++; tpl.paint(ctx, sc, S, layer); }
  tpl.paint(ctx, sc, S, 'fg');
  ctx.restore();
}

// a picture on its own canvas (re-made when its size changes)
export function renderPicture(canvas, sc, which, w, h, dpr) {
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw, ph);
  drawScene(ctx, sc, which, pw / W);
  return canvas;
}
