// AGI-1's daily clips (2026-09-29, the owner's idea "video"): draws one clip, frame by frame, the same way every time.
// tools/clips/make.mjs opens this page in a browser, calls clip.load(), clip.start(spec), then clip.frame(0), clip.frame(1)…
// and turns the pictures into a video with her voice (ffmpeg). She's AGI-1 in 2D (src/stage/agi1-2d.js, her Live2D model,
// as on the site since 2026-10-01: her face, her hair, her mouth following her voice, her reactions), on a Pop mode
// background (the site's colors),
// with a title, her captions, and "AI-generated · not financial advice" on every frame.
// Nothing here is random: the rig's little random moves (blinks, glances) come from a fixed seed, and time moves exactly
// 1/30 s a frame, however long a frame takes to draw.
import * as THREE from 'three';
import { loadAgi1_2D, createAgi1_2D } from '../../../src/stage/agi1-2d.js';
import { createEffects } from '../../../src/stage/effects.js';

export const W = 1080, H = 1920, FPS = 30;
const INK = '#170a36', VIOLET = '#6b3bff', PAPER = '#ffffff';
// the look (Pop mode's colors: her diary is honey, with pink and violet)
const THEMES = {
  diary: { bg: '#ffc933', glow: '#ffe28a', dot: 'rgba(23,10,54,0.09)', ray: 'rgba(255,255,255,0.2)', title: INK, stroke: PAPER, echo: '#ff4da6', pill: PAPER, meta: INK, hearts: [0xff4da6, 0x6b3bff, 0xffffff] },
};
// where she is in the picture: her eyes and her waist (pixels of the frame)
const FRAME = { eyes: 850, waist: 1770 };
// what TikTok, Reels and Shorts cover with their own buttons and text: the top ~180 px (their tabs) and the bottom
// ~380 px (the account name, the post's text), and a column on the right. The label, the title and the captions stay
// clear of them.
const LABEL_Y = 205, KICKER_Y = 292, TITLE_TOP = 350;
// her captions' card: its top above her shirt's print, and always tall enough to cover all of it (never half of it):
// `cover` is set from her model when it loads
const CARD = { top: 1235, width: 860, cover: 0 };
const FADE = [1500, 1690];                   // where she fades out (pixels of the frame)

// a seeded random number maker (mulberry32): the same seed, the same clip
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const easeOutBack = (x) => { const c = 1.7; const y = clamp(x, 0, 1) - 1; return 1 + (c + 1) * y * y * y + c * y * y; };

// ---------- the pictures that don't change during a clip ----------
function background(theme) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  const cx = W / 2, cy = FRAME.eyes - 40;
  g.fillStyle = theme.bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(cx, cy, 30, cx, cy, 820);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, theme.bg);
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  // comic focus lines from behind her head, of uneven widths (the same every time)
  g.fillStyle = theme.ray;
  let a = 0;
  for (let i = 0; a < Math.PI * 2; i++) {
    const w = 0.035 + 0.05 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    if (i % 2 === 0) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * 2600, cy + Math.sin(a) * 2600);
      g.lineTo(cx + Math.cos(a + w) * 2600, cy + Math.sin(a + w) * 2600);
      g.closePath();
      g.fill();
    }
    a += w;
  }
  // halftone dots, bigger toward the edges
  g.fillStyle = theme.dot;
  const step = 34;
  for (let y = step / 2, row = 0; y < H; y += step, row++) {
    for (let x = row % 2 ? step / 2 : 0; x < W + step; x += step) {
      const r = clamp(Math.hypot(x - cx, (y - cy) * 0.8) / 1000, 0, 1) * 10;
      if (r < 1) continue;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

// ---------- text ----------
function setFont(g, { weight = 700, size = 60, family = 'Geist', style = 'normal', stretch = 'normal' }) {
  g.font = `${style} ${weight} ${size}px "${family}"`;
  g.fontStretch = stretch;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
// the look of the site's big Pop mode words: an ink outline and a print echo in another color
function popText(g, text, x, y, { size, fill, stroke, echo, stretch = 'expanded', sw = 12, off = 10 }) {
  setFont(g, { weight: 900, size, family: 'Anybody', stretch });
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineWidth = sw;
  g.strokeStyle = echo; g.fillStyle = echo;
  g.strokeText(text, x + off, y + off);
  g.fillText(text, x + off, y + off);
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}
// a pill with a hard shadow, like the site's chips
function pill(g, text, cx, cy, { bg, ink = INK, border = INK, size = 34, family = 'Geist Mono', weight = 700, h = 72, padX = 30, shadow = INK, spacing = '0.06em' }) {
  setFont(g, { weight, size, family });
  g.letterSpacing = spacing;
  const w = g.measureText(text).width + padX * 2;
  const x = cx - w / 2, y = cy - h / 2;
  roundRect(g, x, y + 7, w, h, h / 2);
  g.fillStyle = shadow;
  g.fill();
  roundRect(g, x, y, w, h, h / 2);
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = border;
  g.stroke();
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, cx, cy + 2);
  g.letterSpacing = '0px';
}
// her words as pieces to lay out: $AGI in violet, the rest in ink
const pieces = (text) => text.split(' ').filter(Boolean).map((w) => ({ w, color: /^\$AGI\b/i.test(w) ? VIOLET : INK }));
function wrap(g, words, width) {
  const lines = [];
  let line = [], lw = 0;
  const space = g.measureText(' ').width;
  for (const p of words) {
    const pw = g.measureText(p.w).width;
    if (line.length && lw + space + pw > width) { lines.push(line); line = []; lw = 0; }
    line.push({ ...p, pw });
    lw += (line.length > 1 ? space : 0) + pw;
  }
  if (line.length) lines.push(line);
  return lines;
}
// the caption card: white, an ink outline and a hard shadow; her words centered, at most three lines
function captionCard(g, text, age, { end = false } = {}) {
  const width = CARD.width, inner = width - 96;
  let size = 64, lines;
  for (;;) {
    setFont(g, { weight: 700, size, family: end ? 'Anybody' : 'Geist', stretch: end ? 'expanded' : 'normal' });
    lines = wrap(g, end ? [{ w: text, color: VIOLET }] : pieces(text), inner);
    if (lines.length <= (size > 56 ? 2 : 3) || size <= 44) break;
    size -= 4;
  }
  const lh = Math.round(size * 1.22), h = Math.max(lines.length * lh + 70, CARD.cover - CARD.top);
  const pad = (h - lines.length * lh) / 2;            // (35 px above and below, more when it's taller for her print)
  const s = 0.94 + 0.06 * easeOutBack(age / 0.16);
  const cx = W / 2, top = CARD.top;
  g.save();
  g.translate(cx, top + h / 2);
  g.scale(s, s);
  g.translate(-cx, -(top + h / 2));
  roundRect(g, cx - width / 2, top + 14, width, h, 44);
  g.fillStyle = INK;
  g.fill();
  roundRect(g, cx - width / 2, top, width, h, 44);
  g.fillStyle = PAPER;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.stroke();
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const space = g.measureText(' ').width;
  lines.forEach((line, i) => {
    const lw = line.reduce((s2, p) => s2 + p.pw, 0) + space * (line.length - 1);
    let x = cx - lw / 2;
    const y = top + pad + lh * i + size * 0.98;
    for (const p of line) {
      g.fillStyle = p.color;
      g.fillText(p.w, x, y);
      x += p.pw + space;
    }
  });
  g.restore();
}

// ---------- the frame ----------
// Without a graphics card (GitHub's computers have none), the browser's software 3D renderer is slow at filling big
// areas: every full-frame layer costs about a tenth of a second. So the 3D renderer only draws her (and her hearts), at
// 720 × 1280 (about her art's own sharpness in this framing), and plain 2D drawing does the rest at the full 1080 × 1920:
// the background, her (scaled up), then the title, her captions and the label, which stay sharp. The top layer is only
// redrawn when it changes (a new caption, and the few frames when something pops in).
const GL_W = 720, GL_H = 1280;
let model = null, renderer = null, scene = null, camera = null, clip = null, raw = null, topKey = null;
const soft = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
const [overlay, g] = soft(W, H);            // the top layer
const [her, hg] = soft(GL_W, GL_H);         // her, as the 3D renderer drew her
const [out, og] = soft(W, H);               // the finished frame
const herPixels = new ImageData(GL_W, GL_H);

async function loadFonts() {
  const faces = [
    new FontFace('Anybody', 'url(/fonts/Anybody-Variable.woff2)', { weight: '100 900', stretch: '50% 150%' }),
    new FontFace('Instrument Serif', 'url(/fonts/InstrumentSerif-Italic.woff2)', { style: 'italic', weight: '400' }),
    new FontFace('Geist', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Geist Mono', 'url(/fonts/GeistMono-Variable.woff2)', { weight: '100 900' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
}

async function load() {
  await loadFonts();
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(GL_W, GL_H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  model = await loadAgi1_2D({ renderer });
  scene.add(model.holder);
  // framed like a VTuber: her eyes and her waist where FRAME says (her model's own heights), a long lens (little perspective)
  const { eyes, waist } = model.landmarks;
  const perMetre = (FRAME.waist - FRAME.eyes) / (eyes - waist);
  const tall = H / perMetre;
  const centre = eyes - (H / 2 - FRAME.eyes) / perMetre;
  camera = new THREE.PerspectiveCamera(18, W / H, 0.05, 60);
  const dist = tall / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, centre, dist);
  camera.lookAt(0, centre, 0);
  CARD.cover = Math.round(FRAME.eyes + (eyes - model.landmarks.print.bottom) * perMetre) + 14;
  raw = new Uint8Array(GL_W * GL_H * 4);
  return { width: W, height: H, fps: FPS };
}

// spec: { kind, kicker, title, meta, label, site, cues: [{ from, to, text }], reactions: [{ at, react }], talk: [0..1 a frame],
//         frames, seed }
function start(spec) {
  Math.random = seeded(spec.seed || 1);                  // (the rig and the hearts use it)
  const theme = THEMES[spec.kind] || THEMES.diary;
  const effects = createEffects(scene);
  effects.setHeartColors(theme.hearts);
  const agi = createAgi1_2D(model, { camera, effects, reducedMotion: false, onGlow: () => {} });
  agi.setCloseUp(true);                                   // framed close: her video-call wave, and no surprise dances
  agi.setPointer(null);                                   // she looks at you
  // a second of life before the first frame, so she's already breathing and her hair has settled
  for (let i = 0; i < FPS; i++) { agi.update(1 / FPS); effects.update(1 / FPS); }
  clip = {
    spec, theme, agi, effects, bg: background(theme),
    reactions: [...(spec.reactions || [])].sort((a, b) => a.at - b.at), next: 0,
    lastCue: (spec.cues || []).at(-1)?.to ?? 0,
  };
  topKey = null;
  return { frames: spec.frames };
}

// the top layer at time t: the label, the title (it pops in), her caption (each pops in) or, after her last words, the site
const TITLE_POP = 0.4, CARD_POP = 0.16;
function drawTop(t) {
  const { spec, theme } = clip;
  const cues = spec.cues || [];
  const at = cues.findIndex((c) => t >= c.from && t < c.to);
  const end = at < 0 && clip.lastCue > 0 && t >= clip.lastCue;
  const cardAge = at >= 0 ? t - cues[at].from : end ? t - clip.lastCue : 0;
  const titleAge = t - 0.05;
  // what the layer shows (redrawn only when this changes)
  const key = `${titleAge < TITLE_POP ? Math.round(titleAge * FPS) : 'title'}|${at >= 0 ? at : end ? 'end' : '-'}|${cardAge < CARD_POP && (at >= 0 || end) ? Math.round(cardAge * FPS) : ''}`;
  if (key === topKey) return;
  topKey = key;
  g.clearRect(0, 0, W, H);
  // she fades into the background below her waist (the frame ends above her hips), with the site's name there
  const fade = g.createLinearGradient(0, FADE[0], 0, FADE[1]);
  fade.addColorStop(0, `${theme.bg}00`);
  fade.addColorStop(1, theme.bg);
  g.fillStyle = fade;
  g.fillRect(0, FADE[0], W, FADE[1] - FADE[0]);
  g.fillStyle = theme.bg;
  g.fillRect(0, FADE[1], W, H - FADE[1]);
  setFont(g, { weight: 800, size: 46, family: 'Anybody', stretch: 'expanded' });
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.globalAlpha = 0.75;
  g.fillStyle = theme.meta;
  if (!end) g.fillText(spec.site, W / 2, H - 150);      // (the end card says it)
  g.globalAlpha = 1;
  // the label, on every frame (the owner's rule: clips say they're AI, and never advice)
  pill(g, spec.label.toUpperCase(), W / 2, LABEL_Y, { bg: 'rgba(23,10,54,0.82)', ink: PAPER, border: 'rgba(255,255,255,0.9)', size: 25, h: 56, padX: 26, shadow: 'rgba(0,0,0,0)' });
  const pop = easeOutBack(titleAge / TITLE_POP * 1.0);
  if (titleAge > 0) {
    g.save();
    g.translate(W / 2, TITLE_TOP);
    g.scale(pop, pop);
    g.translate(-W / 2, -TITLE_TOP);
    pill(g, spec.kicker.toUpperCase(), W / 2, KICKER_Y, { bg: theme.pill });
    // as big as fits, its outline and print echo included (a long ticker gets smaller, never cut off)
    let size = 120;
    setFont(g, { weight: 900, size, family: 'Anybody', stretch: 'expanded' });
    while (g.measureText(spec.title).width + 22 > 940 && size > 40) { size -= 4; setFont(g, { weight: 900, size, family: 'Anybody', stretch: 'expanded' }); }
    const base = TITLE_TOP + 98;
    popText(g, spec.title, W / 2, base, { size, fill: theme.title, stroke: theme.stroke, echo: theme.echo, sw: Math.max(6, size / 10), off: Math.max(5, size / 12) });
    if (spec.meta) {
      setFont(g, { weight: 400, size: 48, family: 'Instrument Serif', style: 'italic' });
      g.textAlign = 'center';
      g.fillStyle = theme.meta;
      g.fillText(spec.meta, W / 2, base + 70);
    }
    g.restore();
  }
  if (at >= 0) captionCard(g, cues[at].text, cardAge);
  else if (end) captionCard(g, spec.site, cardAge, { end: true });
}

const times = { rig: 0, top: 0, render: 0, compose: 0, jpeg: 0, n: 0 };     // where a frame's time goes (make.mjs logs it)
function frame(i) {
  const { spec, agi, effects } = clip;
  const t = i / FPS;
  let t0 = performance.now();
  while (clip.next < clip.reactions.length && clip.reactions[clip.next].at <= t) agi.react(clip.reactions[clip.next++].react);
  agi.setTalk(spec.talk?.[i] ?? 0);
  agi.update(1 / FPS);
  effects.update(1 / FPS);
  times.rig += performance.now() - t0; t0 = performance.now();
  drawTop(t);
  times.top += performance.now() - t0; t0 = performance.now();
  renderer.clear();
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  gl.readPixels(0, 0, GL_W, GL_H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  times.render += performance.now() - t0; t0 = performance.now();
  // her pixels: WebGL's rows go from the bottom up, and its colors come multiplied by their opacity (a 2D canvas wants
  // them plain)
  const d = herPixels.data, row = GL_W * 4;
  for (let y = 0; y < GL_H; y++) {
    const from = (GL_H - 1 - y) * row, to = y * row;
    for (let x = 0; x < row; x += 4) {
      const a = raw[from + x + 3];
      if (a === 0) { d[to + x + 3] = 0; continue; }
      if (a === 255) { d[to + x] = raw[from + x]; d[to + x + 1] = raw[from + x + 1]; d[to + x + 2] = raw[from + x + 2]; d[to + x + 3] = 255; continue; }
      const k = 255 / a;
      d[to + x] = Math.min(255, raw[from + x] * k); d[to + x + 1] = Math.min(255, raw[from + x + 1] * k); d[to + x + 2] = Math.min(255, raw[from + x + 2] * k); d[to + x + 3] = a;
    }
  }
  hg.putImageData(herPixels, 0, 0);
  og.drawImage(clip.bg, 0, 0);
  og.imageSmoothingEnabled = true;
  og.imageSmoothingQuality = 'high';
  og.drawImage(her, 0, 0, W, H);
  og.drawImage(overlay, 0, 0);
  times.compose += performance.now() - t0; t0 = performance.now();
  const picture = out.toDataURL('image/jpeg', 0.9).slice('data:image/jpeg;base64,'.length);
  times.jpeg += performance.now() - t0;
  times.n += 1;
  return picture;
}

window.clip = { load, start, frame, W, H, FPS, times: () => ({ ...times }) };
