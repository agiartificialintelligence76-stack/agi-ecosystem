// The roadmap's video (2026-10-14, the owner: "can you create a graphic and just short promotional video for the
// roadmap"; the owner's choices: 16:9 for X, about 20 seconds, music made in code and AGI-1's voice, and three
// graphics): the page that draws it, one frame at a time. tools/roadmap-promo/make.mjs opens it in a browser, calls
// promo.load({ scale }), then promo.frame(0), promo.frame(1)… and turns the pictures into an MP4 with its sound (its music,
// tools/roadmap-promo/music.js, and her voice over it). 1920 × 1080, 60 frames a second. Every frame is a function of its
// time: drawing a frame twice gives the same picture. promo.card(kind) draws one of its graphics (cards.js).
// What it says is the roadmap page's own words (tools/roadmap-promo/words.js). AGI-1 only as her 2D self (the front's
// art and face), never 3D; never CloakMesh; never an AI service's name; coming soon is never a promise. Since 2026-10-19
// (the roadmap's ten steps, "in no particular order"): 23.5 s, its road's middle scene is what's next (`next`).
import { SCENES, TOTAL, MOMENTS, BEAT, BAR, at, sceneAt } from '../timeline.js';
import * as WORDS from '../words.js';
import { canvas, grain, vignette, prog, E, clamp, noise1, FONTS } from '../../promo/page/kit.js';
import { C, pill } from './parts.js';
import { TRANSITIONS } from './cuts.js';
import { CARDS, DRAW } from './cards.js';
import title from './scenes/title.js';
import road, { SHUTTER } from './scenes/road.js';
import end from './scenes/end.js';

const MODULES = { title, live: road, next: road, secret: road, end };
export const SIZE = { W: 1920, H: 1080 };

let ctx = null, cv = null, g = null, bufA = null, bufB = null, blurBuf = null, scale = 1;

async function loadFonts() {
  const faces = [
    new FontFace('Geist', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Geist Mono', 'url(/fonts/GeistMono-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Anybody', 'url(/fonts/Anybody-Variable.woff2)', { weight: '100 900', stretch: '50% 150%' }),
    new FontFace('Instrument Serif', 'url(/fonts/InstrumentSerif-Italic.woff2)', { style: 'italic', weight: '400' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
  // the emoji's font (her line ends in 💜), asked for once so the first frame has it
  await document.fonts.load(`32px ${FONTS.sans}`, '💜🔒').catch(() => {});
}

// the screen shakes a little on the big hits
const M = MOMENTS;
const SHAKES = [
  [M.titleWords[1], 8, 0.3], [M.titleWords[2], 11, 0.4], [M.drop, 12, 0.42], [M.drop2, 10, 0.4],
  ...M.stamps.map((s) => [s, 5, 0.22]), [M.lock, 13, 0.45], [M.lockShake, 4, 0.3], [M.end, 10, 0.4],
  ...M.lastHits.map((s) => [s, 4, 0.25]),
];
function shake(t) {
  let x = 0, y = 0;
  for (const [t0, amp, dur] of SHAKES) {
    const k = (t - t0) / dur;
    if (k < 0 || k > 1) continue;
    const a = amp * (1 - k) ** 2;
    x += noise1(t * 38 + t0) * a;
    y += noise1(t * 41 + t0 * 3 + 7) * a;
  }
  return { x, y };
}

// a slow push-in on the end card (the title has its own, and the road its own camera)
const DRIFT = { end: 0.03 };
function drawOnce(target, s, tt, layer) {
  const m = MODULES[s.id];
  target.save();
  const k = shake(tt);
  if (k.x || k.y) target.translate(k.x, k.y);
  if (DRIFT[s.id]) {
    const z = 1 + DRIFT[s.id] * E.inOutQuad(clamp((tt - s.from) / (s.to - s.from)));
    target.translate(ctx.W / 2, ctx.H / 2); target.scale(z, z); target.translate(-ctx.W / 2, -ctx.H / 2);
  }
  m.draw(target, tt, { ...ctx, s, local: tt - s.from, layer });
  target.restore();
}
// a scene at time t: before its start its first moment, after its end its last. Where the road's camera whips, motion
// blur: what the camera sees, drawn once, then copies of it laid over each other as the camera saw it across the frame's
// shutter (the middle one first, each next one 1/(i+1) over the ones before: an even mix); what stays put on the screen
// (the headlines, the meter) on top, sharp
function drawScene(target, s, t) {
  const m = MODULES[s.id];
  const tt = Math.min(Math.max(t, s.from), s.to - 1e-4);
  const n = m.blurAt ? m.blurAt(tt, ctx) : 1;
  if (n <= 1) { drawOnce(target, s, tt); return; }
  blurBuf.setTransform(scale, 0, 0, scale, 0, 0);
  drawOnce(blurBuf, s, tt, 'world');
  const order = Array.from({ length: n }, (_, i) => i / (n - 1) - 0.5).sort((a, b) => Math.abs(a) - Math.abs(b));
  order.forEach((u, i) => {
    const w = m.camWarp(ctx, tt, tt + u * SHUTTER);
    target.save();
    target.globalAlpha = 1 / (i + 1);
    target.translate(ctx.W / 2 + w.dx, ctx.H / 2 + w.dy); target.scale(w.k, w.k); target.translate(-ctx.W / 2, -ctx.H / 2);
    target.drawImage(blurBuf.canvas, 0, 0, ctx.W, ctx.H);
    target.restore();
  });
  drawOnce(target, s, tt, 'screen');
}

// on top of every scene: the roadmap's address (on the road), its safety line (from what's next to the whole road), a
// little depth and grain
let grainCanvas = null;
function overlays(t) {
  const { W, H } = ctx;
  const site = Math.min(prog(t, M.drop + 0.5, M.drop + 0.9), 1 - prog(t, M.end - 0.5, M.end - 0.25));
  if (site > 0) {
    pill(g, WORDS.SITE, { x: W - 46, y: 58, align: 'right', font: { f: 'mono', w: 700, s: 19 }, bg: C.white, color: C.ink, line: C.ink, lw: 2.5, h: 46, padX: 18, shadow: 4, dot: C.pink, alpha: site, spacing: 0.4 });
  }
  const safe = Math.min(prog(t, M.fine, M.fine + 0.4), 1 - prog(t, M.end - 0.5, M.end - 0.25));
  if (safe > 0) {
    pill(g, WORDS.SAFETY, { x: 46, y: H - 54, align: 'left', font: { f: 'mono', w: 600, s: 17 }, bg: C.white, color: C.ink, line: C.ink, lw: 2.5, h: 42, padX: 16, shadow: 4, alpha: safe, spacing: 0.3 });
  }
  vignette(g, W, H, 0.22);
  if (!grainCanvas) {
    grainCanvas = canvas(W, H);
    grain(grainCanvas.getContext('2d'), W, H, 0, 1);
  }
  g.save();
  g.globalAlpha = 0.04;
  g.globalCompositeOperation = 'overlay';
  g.drawImage(grainCanvas, 0, 0);
  g.restore();
}

function draw(t, frame = Math.round(t * 60)) {
  const { W, H } = ctx;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.frame = frame;
  const tr = TRANSITIONS.find((x) => t >= x.at - x.pre && t < x.at + x.post);
  if (!tr) drawScene(g, sceneAt(t), t);
  else {
    const A = SCENES[tr.i], B = SCENES[tr.i + 1];
    tr.draw(g, t, {
      ...ctx, A, B, bufA, bufB, scale,
      drawA: (target) => drawScene(target, A, t),
      drawB: (target) => drawScene(target, B, t),
    });
  }
  g.setTransform(scale, 0, 0, scale, 0, 0);
  overlays(t);
  const out = prog(t, TOTAL - 0.6, TOTAL - 0.02);
  if (out > 0) { g.fillStyle = `rgba(0,0,0,${E.inQuad(out)})`; g.fillRect(0, 0, W, H); }
}

async function load({ scale: sc = 1 } = {}) {
  scale = sc;
  await loadFonts();
  cv = canvas(SIZE.W * scale, SIZE.H * scale);
  g = cv.getContext('2d', { alpha: false });
  document.body.append(cv);
  bufA = canvas(SIZE.W * scale, SIZE.H * scale).getContext('2d');
  bufB = canvas(SIZE.W * scale, SIZE.H * scale).getContext('2d');
  blurBuf = canvas(SIZE.W * scale, SIZE.H * scale).getContext('2d', { alpha: false });
  ctx = { W: SIZE.W, H: SIZE.H, cx: SIZE.W / 2, cy: SIZE.H / 2, scale, M, at, BEAT, BAR, TOTAL, words: WORDS, frame: 0 };
  for (const m of new Set(Object.values(MODULES))) await m.prepare?.(ctx);
  return { W: SIZE.W, H: SIZE.H, total: TOTAL, scenes: SCENES.map((s) => ({ ...s })) };
}

const times = { draw: 0, encode: 0, n: 0 };
async function frame(i, fps = 60, quality = 0.92) {
  let t0 = performance.now();
  draw(i / fps, i);
  times.draw += performance.now() - t0; t0 = performance.now();
  const jpg = cv.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
  times.encode += performance.now() - t0;
  times.n += 1;
  return jpg;
}
async function still(t, type = 'image/png') {
  draw(t, Math.round(t * 60));
  return cv.toDataURL(type, 0.95).split(',')[1];
}
// a contact sheet: small pictures at those times, in one PNG
async function sheet(list, cols = 6) {
  const { W, H } = ctx;
  const cw = 320, chh = Math.round((cw * H) / W), gap = 10, lab = 26;
  const rows = Math.ceil(list.length / cols);
  const sc = canvas(cols * (cw + gap) + gap, rows * (chh + lab + gap) + gap);
  const sg = sc.getContext('2d');
  sg.fillStyle = '#222'; sg.fillRect(0, 0, sc.width, sc.height);
  for (const [k, t] of list.entries()) {
    draw(t, Math.round(t * 60));
    const x = gap + (k % cols) * (cw + gap), y = gap + Math.floor(k / cols) * (chh + lab + gap);
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(cv, x, y + lab, cw, chh);
    sg.fillStyle = '#ddd'; sg.font = '600 16px monospace'; sg.textBaseline = 'middle';
    sg.fillText(`${t.toFixed(2)} s · ${sceneAt(t).id}`, x + 2, y + lab / 2);
  }
  return sc.toDataURL('image/png').split(',')[1];
}

// one of its graphics, at its own size and at full resolution, as a PNG
async function card(kind) {
  const size = CARDS[kind];
  if (!size) throw new Error(`no graphic called ${kind}`);
  const kept = ctx.scale;
  ctx.scale = 1;                                 // her art at full resolution
  try {
    const c = canvas(size.W, size.H);
    const cg = c.getContext('2d', { alpha: false });
    DRAW[kind](cg, { ...ctx, W: size.W, H: size.H, cx: size.W / 2, cy: size.H / 2, scale: 1 });
    return c.toDataURL('image/png').split(',')[1];
  } finally {
    ctx.scale = kept;
  }
}

window.promo = { load, frame, still, sheet, card, cards: Object.keys(CARDS), times: () => ({ ...times }), TOTAL };
