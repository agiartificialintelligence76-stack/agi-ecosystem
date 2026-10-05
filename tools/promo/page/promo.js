// AGI-1's launch video (2026-10-03, the owner: "create me a professional launch video with motion design using only code
// about the website and its features … make it really good"): the page that draws it, one frame at a time.
// tools/promo/make.mjs opens it in a browser, calls promo.load({ format, scale }), then promo.frame(0), promo.frame(1)…
// and turns the pictures into an MP4 with the music (tools/promo/music.js). Two formats: 'wide' (1920 × 1080, for X and
// YouTube) and 'tall' (1080 × 1920, for TikTok, Reels and Shorts), the same story laid out for each.
// Every frame is a pure function of its time: drawing a frame twice gives the same picture (the scenes' randomness is
// seeded, and AGI-1's motion is stepped in fixed steps from the start of her shot).
// AGI-1 is only ever her 2D self here: her Live2D model (src/stage/agi1-2d.js) and the front's 2D art. Never the 3D
// model (the owner: "use the 2d art … the 3d model is 18+"), and never CloakMesh (the owner: "dont announce on the video
// about cloackmesh").
import { SCENES, TOTAL, MOMENTS, BEAT, BAR, at, sceneAt } from '../timeline.js';
import * as WORDS from '../words.js';
import { C, FONTS, canvas, grain, vignette, prog, E, clamp, hash, noise1, text, rr } from './kit.js';
import { TRANSITIONS, setSceneExits } from './transitions.js';
import { createHer } from './her.js';
import { createArt } from './art.js';
import open from './scenes/open.js';
import meet from './scenes/meet.js';
import evals from './scenes/evals.js';
import talk from './scenes/talk.js';
import langs from './scenes/langs.js';
import closer from './scenes/closer.js';
import burn from './scenes/burn.js';
import texts from './scenes/texts.js';
import check from './scenes/check.js';
import launch from './scenes/launch.js';
import more from './scenes/more.js';
import finale from './scenes/finale.js';
import end from './scenes/end.js';

const MODULES = { open, meet, evals, talk, langs, closer, burn, texts, check, launch, more, finale, end };
setSceneExits(MODULES);
export const FORMATS = { wide: { W: 1920, H: 1080 }, tall: { W: 1080, H: 1920 } };

let ctx = null, cv = null, g = null, bufA = null, bufB = null, scale = 1;

async function loadFonts() {
  const faces = [
    new FontFace('Geist', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Geist Mono', 'url(/fonts/GeistMono-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Anybody', 'url(/fonts/Anybody-Variable.woff2)', { weight: '100 900', stretch: '50% 150%' }),
    new FontFace('Instrument Serif', 'url(/fonts/InstrumentSerif-Italic.woff2)', { style: 'italic', weight: '400' }),
    new FontFace('Dela Gothic One', 'url(/fonts/DelaGothicOne-doki.woff2)', { weight: '400' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
  // the fallbacks the browser uses for emoji and her other alphabets: asked for once, so the first frame has them
  const probe = ['💜📓🙈😤✦♥', '你好日本語한국어', 'สวัสดี', 'नमस्ते', 'مرحبا'];
  await Promise.all(probe.map((s) => document.fonts.load(`32px ${FONTS.sans}`, s).catch(() => {})));
}

// a beat's pulse: 1 on the beat, falling off quickly (bounces on the music)
export const pulse = (t, period = BEAT, sharp = 9) => { const ph = ((t % period) + period) % period; return Math.exp(-ph * sharp); };

// the screen shakes a little on the big hits
const SHAKES = [
  [MOMENTS.agi, 10, 0.35], [MOMENTS.drop, 16, 0.45], ...MOMENTS.letters.map((m) => [m, 9, 0.22]),
  [MOMENTS.sticker, 8, 0.3], [MOMENTS.drop2, 16, 0.45], [MOMENTS.found, 7, 0.25], [MOMENTS.launched, 10, 0.35],
  [MOMENTS.finale, 12, 0.4], [MOMENTS.end, 9, 0.4],
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

// a slow push-in through most scenes, so nothing ever sits still (the others move their own camera)
const DRIFT = { evals: 0.024, talk: 0.018, closer: 0.024, burn: 0.03, check: 0.02, launch: 0.022, finale: 0.03, end: 0.035 };
function drawScene(target, s, t) {
  const m = MODULES[s.id];
  target.save();
  const k = shake(t);
  if (k.x || k.y) target.translate(k.x, k.y);
  if (DRIFT[s.id]) {
    const z = 1 + DRIFT[s.id] * E.inOutQuad(clamp((t - s.from) / (s.to - s.from)));
    target.translate(ctx.W / 2, ctx.H / 2); target.scale(z, z); target.translate(-ctx.W / 2, -ctx.H / 2);
  }
  m.draw(target, t, { ...ctx, S: s });
  target.restore();
}

// what's drawn on top of every scene: the site's address (from the drop to the end card), a little grain and depth
function overlays(t, frame) {
  const { W, H, wide } = ctx;
  const show = Math.min(prog(t, MOMENTS.drop + 0.7, MOMENTS.drop + 1.1), 1 - prog(t, MOMENTS.end - 0.35, MOMENTS.end));
  if (show > 0) {
    const s = wide ? 1 : 1.05;
    const label = WORDS.SITE;
    g.save();
    g.globalAlpha = show * 0.92;
    const font = { f: 'mono', w: 600, s: 21 * s };
    g.font = `600 ${21 * s}px ${FONTS.mono}`;
    g.letterSpacing = '1px';
    const tw = g.measureText(label).width;
    g.letterSpacing = '0px';
    const h = 40 * s, w = tw + 46 * s + 16 * s;
    const x = wide ? W - 48 - w : (W - w) / 2, y = wide ? 40 : 214;
    rr(g, x, y, w, h, h / 2);
    g.fillStyle = 'rgba(23,10,54,0.78)';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.stroke();
    g.beginPath();
    g.arc(x + 22 * s, y + h / 2, 5 * s, 0, Math.PI * 2);
    g.fillStyle = C.pink;
    g.globalAlpha = show * (0.55 + 0.45 * pulse(t, BEAT * 2, 3));
    g.fill();
    g.globalAlpha = show * 0.92;
    text(g, label, { x: x + 38 * s, y: y + h / 2 + 1, font, color: C.white, base: 'middle', spacing: 1 });
    g.restore();
  }
  vignette(g, W, H, 0.22);
  // a fine grain, the same on every frame (a texture: moving grain would cost the video's bitrate for nothing)
  grain(g, W, H, 0, 0.04);
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
  overlays(t, frame);
  // the very end fades to black
  const out = prog(t, TOTAL - 0.45, TOTAL - 0.02);
  if (out > 0) { g.fillStyle = `rgba(0,0,0,${E.inQuad(out)})`; g.fillRect(0, 0, W, H); }
}

async function load({ format = 'wide', scale: sc = 1 } = {}) {
  const F = FORMATS[format];
  if (!F) throw new Error(`unknown format ${format}`);
  scale = sc;
  await loadFonts();
  cv = canvas(F.W * scale, F.H * scale);
  g = cv.getContext('2d', { alpha: false, willReadFrequently: false });
  document.body.append(cv);
  bufA = canvas(F.W * scale, F.H * scale).getContext('2d');
  bufB = canvas(F.W * scale, F.H * scale).getContext('2d');
  const wide = format === 'wide';
  ctx = {
    format, W: F.W, H: F.H, wide, tall: !wide, cx: F.W / 2, cy: F.H / 2, scale,
    // where nothing important goes in the tall version: the apps' own buttons and text (top ~200, bottom ~380, right column)
    safe: wide ? { l: 96, r: F.W - 96, t: 80, b: F.H - 80 } : { l: 70, r: F.W - 70, t: 230, b: F.H - 400 },
    M: MOMENTS, at, BEAT, BAR, TOTAL, words: WORDS, pulse, frame: 0,
  };
  ctx.her = await createHer(ctx);
  ctx.art = await createArt(ctx);
  for (const m of Object.values(MODULES)) await m.prepare?.(ctx);
  return { W: F.W, H: F.H, total: TOTAL, scenes: SCENES.map((s) => ({ ...s })) };
}

const times = { draw: 0, encode: 0, n: 0 };
function frame(i, fps = 60, quality = 0.92) {
  let t0 = performance.now();
  draw(i / fps, i);
  times.draw += performance.now() - t0; t0 = performance.now();
  const jpg = cv.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
  times.encode += performance.now() - t0;
  times.n += 1;
  return jpg;
}
function still(t, type = 'image/png') {
  draw(t, Math.round(t * 60));
  return cv.toDataURL(type, 0.95).split(',')[1];
}

// a contact sheet: small pictures at those times, in one PNG (to look over the whole video at once)
function sheet(list, cols = 6) {
  const { W, H } = ctx;
  const cw = W > H ? 360 : 200, chh = Math.round((cw * H) / W), gap = 10, lab = 26;
  const rows = Math.ceil(list.length / cols);
  const sc = canvas(cols * (cw + gap) + gap, rows * (chh + lab + gap) + gap);
  const sg = sc.getContext('2d');
  sg.fillStyle = '#222'; sg.fillRect(0, 0, sc.width, sc.height);
  list.forEach((t, k) => {
    draw(t, Math.round(t * 60));
    const x = gap + (k % cols) * (cw + gap), y = gap + Math.floor(k / cols) * (chh + lab + gap);
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(cv, x, y + lab, cw, chh);
    sg.fillStyle = '#ddd'; sg.font = '600 16px monospace'; sg.textBaseline = 'middle';
    sg.fillText(`${t.toFixed(2)} s · ${sceneAt(t).id}`, x + 2, y + lab / 2);
  });
  return sc.toDataURL('image/png').split(',')[1];
}

window.promo = { load, frame, still, sheet, times: () => ({ ...times }), TOTAL };
