// AGI Studio's launch video (2026-10-13, the owner: "go make a promotional marketing launch video of AGI studio. all the
// features there, do it with top notch motion design and easy to understand and visible make it 4:3 video", then the
// same day: "i just decided can you make the launch video 16:9"): the page that draws it, one frame at a time.
// tools/studio-promo/make.mjs opens it in a browser, calls promo.load({ scale }), then promo.frame(0), promo.frame(1)…
// and turns the pictures into an MP4 with its music (tools/studio-promo/music.js). 1920 × 1080 (16:9; 1440 × 1080, 4:3,
// at first: every scene laid out again for the wide frame, never stretched), 60 frames a second. Every frame is a
// function of its time: drawing a frame twice gives the same picture (the clips' frames are waited for before a frame
// is finished: page/media.js).
// What it shows was made for it with the same kinds of AI models AGI Studio uses (made-up people, AI-generated: never
// "made in AGI Studio"), and what it says comes from the app's own words (tools/studio-promo/words.js). Never an AI
// service's name, never AGI-1 in 3D, never another coin.
import { SCENES, TOTAL, MOMENTS, BEAT, BAR, at, sceneAt } from '../timeline.js';
import * as WORDS from '../words.js';
import { canvas, grain, vignette, prog, E, clamp, noise1, text, rr, measure } from '../../promo/page/kit.js';
import { S, FONT, pill } from './look.js';
import { TRANSITIONS } from './cuts.js';
import * as media from './media.js';
import hook from './scenes/hook.js';
import brand from './scenes/brand.js';
import create from './scenes/create.js';
import styles from './scenes/styles.js';
import photos from './scenes/photos.js';
import memes from './scenes/memes.js';
import edit from './scenes/edit.js';
import trends from './scenes/trends.js';
import videos from './scenes/videos.js';
import tools from './scenes/tools.js';
import model from './scenes/model.js';
import pay from './scenes/pay.js';
import community from './scenes/community.js';
import finale from './scenes/finale.js';
import end from './scenes/end.js';

const MODULES = { hook, brand, create, styles, photos, memes, edit, trends, videos, tools, model, pay, community, finale, end };
export const SIZE = { W: 1920, H: 1080 };

let ctx = null, cv = null, g = null, bufA = null, bufB = null, scale = 1;

async function loadFonts() {
  const faces = [
    new FontFace('Geist', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Geist Mono', 'url(/fonts/GeistMono-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Anybody', 'url(/fonts/Anybody-Variable.woff2)', { weight: '100 900', stretch: '50% 150%' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
  // the emoji's font, asked for once so the first frame has it
  await document.fonts.load(`32px ${FONT.sans}`, '💜✨🔥😎⚡').catch(() => {});
}

// a beat's pulse: 1 on the beat, falling off quickly
export const pulse = (t, period = BEAT, sharp = 9) => { const ph = ((t % period) + period) % period; return Math.exp(-ph * sharp); };

// the screen shakes a little on the big hits
const M = MOMENTS;
const SHAKES = [
  [M.drop, 14, 0.45], [M.drop2, 14, 0.45], [M.finale, 12, 0.45], [M.stamp26, 6, 0.25], [M.coinLand, 8, 0.3],
  [M.logo, 6, 0.3], [M.youMade, 5, 0.25], [M.end, 6, 0.35],
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

// a slow push-in through the scenes that don't move their own camera
const DRIFT = { brand: 0.025, styles: 0.02, memes: 0.02, videos: 0.018, tools: 0.016, pay: 0.02, community: 0.02, end: 0.03 };
function drawScene(target, s, t) {
  const m = MODULES[s.id];
  const tt = Math.min(Math.max(t, s.from), s.to - 1e-4);     // before its start: its first moment; after its end: its last
  target.save();
  const k = shake(tt);
  if (k.x || k.y) target.translate(k.x, k.y);
  if (DRIFT[s.id]) {
    const z = 1 + DRIFT[s.id] * E.inOutQuad(clamp((tt - s.from) / (s.to - s.from)));
    target.translate(ctx.W / 2, ctx.H / 2); target.scale(z, z); target.translate(-ctx.W / 2, -ctx.H / 2);
  }
  m.draw(target, tt, { ...ctx, s, local: tt - s.from });
  target.restore();
}

// on top of every scene: the site's address (from the brand's url to the finale), a note that what's shown was made in
// AGI Studio (AI-generated), a little depth and grain
let grainCanvas = null;
function overlays(t) {
  const { W, H } = ctx;
  const show = Math.min(prog(t, M.appIn + 0.35, M.appIn + 0.85), 1 - prog(t, M.finale - 0.5, M.finale - 0.1));
  if (show > 0) {
    g.save();
    g.globalAlpha = show * 0.92;
    const label = WORDS.SITE;
    const p = pill(g, label, 0, 0, { size: 19, mono: true, measureOnly: true, dot: S.accent, padX: 16 });
    const x = W - 44 - p.w, y = 52;
    pill(g, label, x, y, { size: 19, mono: true, dot: S.accent, padX: 16, bg: 'rgba(14,14,17,0.72)', line: S.line2, color: S.text });
    g.restore();
  }
  // what's shown is AI-made: said in a corner from the hook's reveal (She's not real · AI-generated) to the end card
  // (which says it in its own words), on a dark plate so it reads over any picture
  const ex = Math.min(prog(t, M.aiPill + 0.2, M.aiPill + 0.7), 1 - prog(t, M.end - 0.6, M.end - 0.2));
  if (ex > 0) {
    const font = { f: 'mono', w: 500, s: 15 };
    const tw = measure(g, WORDS.OVERLAY, font, 0.4);
    g.save();
    g.globalAlpha = ex;
    rr(g, 30, H - 57, tw + 28, 32, 16);
    g.fillStyle = 'rgba(9,9,11,0.62)'; g.fill();
    g.restore();
    text(g, WORDS.OVERLAY, { x: 44, y: H - 36, font, color: 'rgba(236,236,239,0.62)', spacing: 0.4, alpha: ex });
  }
  vignette(g, W, H, 0.28);
  if (!grainCanvas) {
    grainCanvas = canvas(W, H);
    grain(grainCanvas.getContext('2d'), W, H, 0, 1);
  }
  g.save();
  g.globalAlpha = 0.035;
  g.globalCompositeOperation = 'overlay';
  g.drawImage(grainCanvas, 0, 0);
  g.restore();
}

function drawOnce(t, frame) {
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

// draws a frame, waiting for any clip frames it needs (at most a few passes), then starts loading the next ones
async function draw(t, frame = Math.round(t * 60)) {
  for (let pass = 0; pass < 5; pass++) {
    media.beginFrame();
    drawOnce(t, frame);
    if (!media.missing()) break;
    await media.fill();
  }
  media.prefetch(6);
}

async function load({ scale: sc = 1 } = {}) {
  scale = sc;
  media.setScale(sc);
  await loadFonts();
  const info = await media.loadMedia();
  cv = canvas(SIZE.W * scale, SIZE.H * scale);
  g = cv.getContext('2d', { alpha: false });
  document.body.append(cv);
  bufA = canvas(SIZE.W * scale, SIZE.H * scale).getContext('2d');
  bufB = canvas(SIZE.W * scale, SIZE.H * scale).getContext('2d');
  ctx = {
    W: SIZE.W, H: SIZE.H, cx: SIZE.W / 2, cy: SIZE.H / 2, scale,
    M, at, BEAT, BAR, TOTAL, words: WORDS, pulse, frame: 0, media, irisFrom: {},
  };
  for (const m of Object.values(MODULES)) await m.prepare?.(ctx);
  return { W: SIZE.W, H: SIZE.H, total: TOTAL, scenes: SCENES.map((s) => ({ ...s })), media: info };
}

const times = { draw: 0, encode: 0, n: 0 };
async function frame(i, fps = 60, quality = 0.92) {
  let t0 = performance.now();
  await draw(i / fps, i);
  times.draw += performance.now() - t0; t0 = performance.now();
  const jpg = cv.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
  times.encode += performance.now() - t0;
  times.n += 1;
  return jpg;
}
async function still(t, type = 'image/png') {
  await draw(t, Math.round(t * 60));
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
    await draw(t, Math.round(t * 60));
    const x = gap + (k % cols) * (cw + gap), y = gap + Math.floor(k / cols) * (chh + lab + gap);
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(cv, x, y + lab, cw, chh);
    sg.fillStyle = '#ddd'; sg.font = '600 16px monospace'; sg.textBaseline = 'middle';
    sg.fillText(`${t.toFixed(2)} s · ${sceneAt(t).id}`, x + 2, y + lab / 2);
  }
  return sc.toDataURL('image/png').split(',')[1];
}

window.promo = { load, frame, still, sheet, times: () => ({ ...times }), TOTAL };
export { rr };
