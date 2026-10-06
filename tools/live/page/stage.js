// AGI-1's live show (2026-10-02): her set, in real time. tools/live/run.mjs opens this page in a browser window on the
// owner's server (1280 × 720), and ffmpeg sends what the window shows, with her voice, to X. The runner drives it through
// window.studio: what's on the card, the captions and her mouth (from her voice's loudness, in step with the sound ffmpeg
// sends), her reactions, where she looks, the "starting soon" / "be right back" / "thanks for watching" screens.
// She's AGI-1 in 2D, the site's own (src/stage/agi1-2d.js: her Live2D model, breathing, blinking, her hair, her moods).
// Nothing here talks to the network: only this page's own files.
import * as THREE from 'three';
import { loadAgi1_2D, createAgi1_2D } from '../../../src/stage/agi1-2d.js';
import { createEffects } from '../../../src/stage/effects.js';

export const W = 1280, H = 720, GL = 720;
// Her picture's place on the set is in stage.css (.her): from x = 400 to the right edge, and from the top to where the bar
// at the bottom starts (2026-10-06: it was 720 × 720 from x = 560, and its left edge cut off her waving hand). How many
// pixels it draws: ?gl=540 draws 540 for every 720 of the set (on a server with fewer cores; it's shown at its size on the
// set either way). ?fps=… caps the frames a second (30)
const opts = new URLSearchParams(location.search);
const DRAW = Math.min(GL, Math.max(360, Number(opts.get('gl')) || GL));
const FPS = Math.min(30, Math.max(10, Number(opts.get('fps')) || 30));
// where she is on the set (pixels): her middle, her eyes and her waist, framed waist up like a streamer's camera, the top of
// her head just under the top row (its "AI-generated" label ends at y = 64)
const FRAME = { x: 920, eyes: 264, waist: 774 };
const HEARTS = [0xff4da6, 0xffc933, 0xffffff];
const $ = (sel) => document.querySelector(sel);
const set = $('[data-set]');
const ui = {
  bg: $('[data-bg]'), pic: $('[data-pic]'), clock: $('[data-clock]'), card: $('[data-card]'), kicker: $('[data-card-kicker]'), title: $('[data-card-title]'),
  list: $('[data-card-list]'), body: $('[data-card-body]'), caption: $('[data-caption]'), captionText: $('[data-caption-text]'), queue: $('[data-queue]'),
  oKicker: $('[data-overlay-kicker]'), oTitle: $('[data-overlay-title]'), oSub: $('[data-overlay-sub]'),
};

// ---------- the set: violet, with comic focus lines and halftone dots behind her (drawn once) ----------
function drawSet() {
  const g = ui.bg.getContext('2d');
  const cx = 920, cy = 250;
  const sky = g.createRadialGradient(cx, cy, 40, cx, cy, 900);
  sky.addColorStop(0, '#7d52ff');
  sky.addColorStop(0.45, '#4b1fc2');
  sky.addColorStop(1, '#22095f');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  let a = 0;
  for (let i = 0; a < Math.PI * 2; i++) {
    const w = 0.03 + 0.045 * (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;
    if (i % 2 === 0) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * 1800, cy + Math.sin(a) * 1800);
      g.lineTo(cx + Math.cos(a + w) * 1800, cy + Math.sin(a + w) * 1800);
      g.closePath();
      g.fill();
    }
    a += w;
  }
  g.fillStyle = 'rgba(255,77,166,0.16)';
  for (let y = 10, row = 0; y < H; y += 26, row++) {
    for (let x = row % 2 ? 13 : 0; x < W + 26; x += 26) {
      const r = Math.min(1, Math.hypot(x - cx, (y - cy) * 0.8) / 900) * 6.5;
      if (r < 0.8) continue;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// ---------- her ----------
// Nothing plain and opaque may cover her picture (2026-10-06, her first test recording on the owner's server): Chromium there
// puts the window together in software (--disable-gpu-compositing, tools/live/run.mjs), and it misplaces the part of a
// WebGL canvas that something opaque covers: it leaves out the mirror image of it instead (the 64 px bar at the bottom
// covered her picture, and the top 64 px of it went missing: her head and her hearts cut flat). So her picture ends where
// the bar starts, and the boxes that can be over her (the card, the "starting soon" box) are 1% see-through (stage.css).
// (Drawing her off the page and copying each picture onto a 2D canvas avoided it too, but slowed her down on the server:
// 9.5 frames a second.)
let renderer, scene, camera, model, agi, effects, box, perMetre;
async function load() {
  await document.fonts.ready;
  drawSet();
  // her picture's place on the set (stage.css), and its size in pixels
  box = ui.pic.getBoundingClientRect();
  renderer = new THREE.WebGLRenderer({ canvas: ui.pic, antialias: false, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round((box.width * DRAW) / H), Math.round((box.height * DRAW) / H), false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  model = await loadAgi1_2D({ renderer });
  scene.add(model.holder);
  const { eyes, waist } = model.landmarks;
  perMetre = (FRAME.waist - FRAME.eyes) / (eyes - waist);
  const tall = H / perMetre;
  const centre = eyes - (H / 2 - FRAME.eyes) / perMetre;
  // the camera looks at her middle, its view as tall as the set; her picture is the part of that view where it is on the set
  const wide = 2 * Math.max(FRAME.x, W - FRAME.x);
  camera = new THREE.PerspectiveCamera(18, wide / H, 0.05, 60);
  camera.setViewOffset(wide, H, wide / 2 - FRAME.x + box.left, box.top, box.width, box.height);
  camera.position.set(0, centre, tall / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  camera.lookAt(0, centre, 0);
  effects = createEffects(scene);
  effects.setHeartColors(HEARTS);
  agi = createAgi1_2D(model, { camera, effects, reducedMotion: false, onGlow: () => {} });
  agi.setCloseUp(true);                    // her streamer framing: no surprise dances
  agi.setPointer(null);
  for (let i = 0; i < FPS; i++) { agi.update(1 / FPS); effects.update(1 / FPS); }
  renderer.setAnimationLoop(frame);
  return { fps: FPS };
}

// ---------- what she says: her mouth and her captions follow the sound ffmpeg sends ----------
// say: { startAt (ms, this computer's clock: when her first word is heard in the stream), step (ms per envelope value),
// env (0..1: how loud she is), cues ([{ from, to, text }], seconds from startAt), react (a mood) }
let speech = null, shift = 0;
function say(s) {
  speech = { startAt: Number(s.startAt) || Date.now(), step: Number(s.step) || 20, env: Array.isArray(s.env) ? s.env : [], cues: Array.isArray(s.cues) ? s.cues : [],
    end: (Number(s.startAt) || Date.now()) + (Number(s.seconds) || 0) * 1000, reacted: !s.react, react: s.react || null, cue: -1 };
  return true;
}
function stop() {
  speech = null;
  agi?.setTalk(0);
  ui.caption.hidden = true;
  return true;
}
function speechFrame(now) {
  if (!speech) return;
  const t = now + shift - speech.startAt;
  if (t < 0) return;
  if (!speech.reacted && t >= 0) { speech.reacted = true; agi.react(speech.react); }
  const level = speech.env[Math.floor(t / speech.step)] ?? 0;
  agi.setTalk(level);
  const sec = t / 1000;
  const at = speech.cues.findIndex((c) => sec >= c.from && sec < c.to);
  if (at !== speech.cue) {
    speech.cue = at;
    if (at >= 0) { ui.captionText.textContent = speech.cues[at].text; ui.caption.hidden = false; } else ui.caption.hidden = true;
  }
  if (now + shift > speech.end + 400) stop();
}

// ---------- the card ----------
// { kind: 'question' | 'segment' | 'diary' | 'wyr', kicker, title, body, list: [text], pick (index in list) } or null
function card(c) {
  if (!c) { ui.card.hidden = true; return true; }
  ui.card.dataset.kind = c.kind || 'segment';
  ui.kicker.textContent = c.kicker || '';
  ui.title.textContent = c.title || '';
  ui.body.textContent = c.body || '';
  ui.list.replaceChildren(...(Array.isArray(c.list) ? c.list : []).map((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (c.pick === i) li.className = 'is-pick';
    return li;
  }));
  // a fresh card pops in again
  ui.card.hidden = true;
  void ui.card.offsetWidth;
  ui.card.hidden = false;
  return true;
}
function pick(i) {
  [...ui.list.children].forEach((li, k) => li.classList.toggle('is-pick', k === i));
  return true;
}

// ---------- the screens: starting soon, be right back, thanks for watching ----------
const SCREENS = {
  starting: { kicker: 'AGI-1 · live on X', title: 'Starting soon' },
  brb: { kicker: 'AGI-1 · live on X', title: 'Be right back' },
  ended: { kicker: 'AGI-1 · live on X', title: 'Thanks for watching' },
};
let until = null;
function overlay(kind, { sub = '', untilMs = null } = {}) {
  set.dataset.overlay = SCREENS[kind] ? kind : 'none';
  if (SCREENS[kind]) {
    ui.oKicker.textContent = SCREENS[kind].kicker;
    ui.oTitle.textContent = SCREENS[kind].title;
    ui.oSub.textContent = sub;
  }
  until = kind === 'starting' && Number.isFinite(untilMs) ? { at: untilMs, sub } : null;
  if (kind) { ui.card.hidden = true; }
  return true;
}

// ---------- where she looks ----------
let lookTimer = null;
function look(where, ms = 0) {
  clearTimeout(lookTimer);
  if (where === 'card') { agi.setAttention('idle'); agi.setPointer({ x: -1.9, y: 0.35 }); }
  else if (where === 'think') { agi.setPointer(null); agi.setAttention('thinking'); }
  else { agi.setPointer(null); agi.setAttention('idle'); }
  if (ms > 0 && where !== 'you') lookTimer = setTimeout(() => look('you'), ms);
  return true;
}

// ---------- the clock and the line ----------
let started = null;
const two = (n) => String(n).padStart(2, '0');
function clockFrame(now) {
  if (until) {
    const left = Math.max(0, Math.round((until.at - now) / 1000));
    ui.oSub.textContent = `${left > 0 ? `Starting in ${two(Math.floor(left / 60))}:${two(left % 60)}. ` : ''}${until.sub}`;
  }
  const s = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const text = s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
  if (ui.clock.textContent !== text) ui.clock.textContent = text;
}
function queue(n) {
  ui.queue.textContent = Number.isInteger(n) && n > 0 ? `${n} question${n === 1 ? '' : 's'} waiting` : '';
  return true;
}

// ---------- a sync marker (tools/live/run.mjs --sync-check): a white square in the corner, shown when a beep is heard ----------
const markers = [];
let markerEl = null;
function marker(at) {
  if (!markerEl) {
    markerEl = document.createElement('div');
    markerEl.className = 'sync-marker';
    markerEl.hidden = true;
    set.append(markerEl);
  }
  markers.push(Number(at));
  return true;
}
function markerFrame(now) {
  if (!markerEl) return;
  const t = now + shift;
  const on = markers.some((at) => t >= at && t < at + 200);
  if (markerEl.hidden === on) markerEl.hidden = !on;
}

// ---------- every frame (at most 30 a second: a server without a graphics card draws her in software) ----------
let last = 0, drawn = 0, since = performance.now();
function frame(t) {
  if (t - last < 1000 / FPS - 2) return;
  const dt = Math.min(0.1, (t - last) / 1000 || 1 / FPS);
  last = t;
  const now = Date.now();
  speechFrame(now);
  clockFrame(now);
  markerFrame(now);
  agi.update(dt);
  effects.update(dt);
  fadeHearts();
  renderer.render(scene, camera);
  drawn += 1;
}

// her hearts fade out as they come near her picture's left edge (it's in the middle of the set: never a heart cut in two)
const EDGE_FADE = 90, at = new THREE.Vector3();
function fadeHearts() {
  for (const o of scene.children) {
    if (!o.isSprite) continue;
    at.copy(o.position).project(camera);
    const left = ((at.x + 1) / 2) * box.width - (o.scale.x * perMetre) / 2;        // its left side, from the edge (set pixels)
    if (left < EDGE_FADE) o.material.opacity *= THREE.MathUtils.clamp(left / EDGE_FADE, 0, 1);
  }
}
function stats() {
  const now = performance.now();
  const fps = drawn / Math.max(0.001, (now - since) / 1000);
  drawn = 0;
  since = now;
  return { fps: Math.round(fps * 10) / 10 };
}

window.studio = {
  load, say, stop, card, pick, overlay, look, queue, stats, marker,
  react: (mood) => { agi?.react(mood); return true; },
  start: (ms) => { started = Number(ms) || Date.now(); return true; },
  shift: (ms) => { shift = Number(ms) || 0; return true; },          // her mouth ahead of (+) or behind (−) the clock, ms
  get talking() { return Boolean(speech); },
};
