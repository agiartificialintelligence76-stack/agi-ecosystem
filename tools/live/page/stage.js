// AGI-1's live show (2026-10-02): her set, in real time. tools/live/run.mjs opens this page in a browser window on the
// owner's server (1280 × 720), and ffmpeg sends what the window shows, with her voice, to X. The runner drives it through
// window.studio: what's on the card, the captions and her mouth (from her voice's loudness, in step with the sound ffmpeg
// sends), her reactions, where she looks, the "starting soon" / "be right back" / "thanks for watching" screens.
// She's AGI-1 in 2D, the site's own (src/stage/agi1-2d.js: her Live2D model, breathing, blinking, her hair, her moods).
// Since 2026-10-07 (the owner: "add more actions / can change her clothes / … / can dance / can change places / more effects
// … / move not just steady / make her act like a real streamer") also her rooms (rooms.js), her outfits (outfits.js), more
// of her moves and dances (moves.js), her effects (fx.js: the emojis she says, stickers, confetti, alerts, her TV, karaoke),
// the camera moving in on her now and then, and her song. And (2026-10-07, the owner's next list: "add more outfits and rooms,
// (real places in real life) … vehicles also like robotaxi … she can ride the vehicles as well and go to places. and meet
// random people … she can eat food in the stream … go to moon, mars. and add more emotions", then "can you add weathers
// also") her trips (places.js, vehicles.js: she rides there), the people she meets (people.js), her food (food.js), her
// emotions (moves.js) and the weather (weather.js). And (2026-10-07, the owner after its preview: "so bad", then "Painted
// art") the paintings of her set where they're there (paint.js): her places, her rooms, the inside of what she rides in,
// the people she meets and what she wears.
// Nothing here talks to the network: only this page's own files (and her videos, which the runner serves from its own disk).
import * as THREE from 'three';
import { loadAgi1_2D, createAgi1_2D } from '../../../src/stage/agi1-2d.js';
import { createEffects } from '../../../src/stage/effects.js';
import { drawRoom, fillAmbient, fillAmbientList, ROOMS } from './rooms.js';
import { createWardrobe, OUTFITS, PAINT_AT, UMBRELLA } from './outfits.js';
import { createMoves, ACTIONS, CAM_ZOOM, HOLD } from './moves.js';
import { createFx, emojisIn } from './fx.js';
import { PLACES, TRAVEL, drawPlace, drawTravel } from './places.js';
import { VEHICLES, rideMotion } from './vehicles.js';
import { paintLoad, isPainted, drawPainting } from './paint.js';
import { createPeople, PEOPLE } from './people.js';
import { createWeather, WEATHERS } from './weather.js';
import { FOODS } from './food.js';

export const W = 1280, H = 720, GL = 720;
// Her picture's place on the set is in stage.css (.her): the whole width of the set (since 2026-10-07, so she can move
// left and right: from x = 400 before, and 720 × 720 from x = 560 until its left edge cut off her waving hand, 2026-10-06),
// from the top to where the bar at the bottom starts. How many pixels it draws: ?gl=540 draws 540 for every 720 of the set
// (on a server with fewer cores; it's shown at its size on the set either way). ?fps=… caps the frames a second (30)
const opts = new URLSearchParams(location.search);
const DRAW = Math.min(GL, Math.max(360, Number(opts.get('gl')) || GL));
const FPS = Math.min(30, Math.max(10, Number(opts.get('fps')) || 30));
// where she is on the set (pixels): her middle, her eyes and her waist, framed waist up like a streamer's camera, the top of
// her head just under the top row (its "AI-generated" label ends at y = 64)
const FRAME = { x: 920, eyes: 264, waist: 774 };
const HEARTS = [0xff4da6, 0xffc933, 0xffffff];
// her arms' finer meshes, one level here (the website's are up to three: its close-ups): on the stream her elbows are small
// and mostly at the bar, and the finest meshes were about a seventh of drawing her on a server without a graphics card
const ARM_REFINE_LIVE = { upper: 1, fore: 1, hand: 1, sleeve: 1 };
const $ = (sel) => document.querySelector(sel);
const set = $('[data-set]');
const ui = {
  bg: $('[data-bg]'), amb: $('[data-amb]'), pic: $('[data-pic]'), clock: $('[data-clock]'), card: $('[data-card]'), kicker: $('[data-card-kicker]'), title: $('[data-card-title]'),
  list: $('[data-card-list]'), body: $('[data-card-body]'), stats: $('[data-card-stats]'), foot: $('[data-card-foot]'), post: $('[data-card-post]'),
  caption: $('[data-caption]'), captionText: $('[data-caption-text]'), queue: $('[data-queue]'), song: $('[data-song]'),
  oKicker: $('[data-overlay-kicker]'), oTitle: $('[data-overlay-title]'), oSub: $('[data-overlay-sub]'),
  wxBack: $('[data-wx-back]'), wxFront: $('[data-wx-front]'), flash: $('[data-flash]'), npc: $('[data-npc]'), npcBubble: $('[data-npc-bubble]'),
  place: $('[data-place]'), placeName: $('[data-place-name]'), placeCountry: $('[data-place-country]'),
  route: $('[data-route]'), routeKicker: $('[data-route-kicker]'), routeFrom: $('[data-route-from]'), routeTo: $('[data-route-to]'), routeIcon: $('[data-route-icon]'),
  hint: $('[data-hint]'),
};

// ---------- her room (rooms.js): drawn once each time she moves, its little moving bits in CSS ----------
// (2026-10-07, her painted set) or its painting (paint.js), loaded and decoded before it goes up, so a wipe never uncovers
// the old one; a painting has its own detail, so the little moving bits drawn for the code's rooms aren't on it (but the
// concert stage's flash on the beat is: its painting has its own light beams, and the code's looked like paper strips on it)
let room = 'studio';
const ON_PAINTINGS = /^stage-flash\b/;
async function painting(group, id) {
  const img = isPainted(group, id) ? await paintLoad(group, id) : null;
  return img ? () => { drawPainting(img, ui.bg); set.dataset.painted = 'on'; } : null;
}
// what puts a room, a place or the inside of a ride up (once it's ready): drawRoom(id), then draw()
async function roomDrawer(id) {
  const r = ROOMS[id] ? id : 'studio', paint = await painting('rooms', r);
  return () => {
    room = r;
    if (paint) { paint(); fillAmbientList(ROOMS[r].ambient.filter((a) => ON_PAINTINGS.test(a.cls)), ui.amb, r); }
    else { set.dataset.painted = 'off'; drawRoom(r, ui.bg); fillAmbient(r, ui.amb); }
    set.dataset.room = r;
    set.dataset.where = 'room';
    ui.place.hidden = true;
  };
}
// (2026-10-07) a real place (or the Moon, or Mars): drawn the same way, its moving bits too
async function placeDrawer(id) {
  if (!PLACES[id]) return null;
  const paint = await painting('places', id);
  return () => {
    room = id;
    if (paint) { paint(); ui.amb.replaceChildren(); }
    else { set.dataset.painted = 'off'; ui.bg.getContext('2d').clearRect(0, 0, W, H); drawPlace(id, ui.bg); fillAmbientList(PLACES[id].ambient || [], ui.amb, id); }
    set.dataset.room = id;
    set.dataset.where = 'place';
  };
}
// on her way: the inside of what she rides in (its painting), else the scene she'd see on the way, drawn
async function rideDrawer(vehicle, kind) {
  const paint = await painting('rides', vehicle);
  return () => {
    if (paint) { paint(); ui.amb.replaceChildren(); }
    else {
      const t = TRAVEL[kind] || TRAVEL.road;
      set.dataset.painted = 'off';
      ui.bg.getContext('2d').clearRect(0, 0, W, H);
      drawTravel(kind in TRAVEL ? kind : 'road', ui.bg);
      fillAmbientList(t.ambient || [], ui.amb, `travel-${kind}`);
    }
    set.dataset.room = `ride-${vehicle}`;
    set.dataset.where = 'travel';
  };
}

// ---------- her ----------
// Nothing plain and opaque may cover her picture (2026-10-06, her first test recording on the owner's server): Chromium there
// puts the window together in software (--disable-gpu-compositing, tools/live/run.mjs), and it misplaces the part of a
// WebGL canvas that something opaque covers: it leaves out the mirror image of it instead (the 64 px bar at the bottom
// covered her picture, and the top 64 px of it went missing: her head and her hearts cut flat). So her picture ends where
// the bar starts, and the boxes that can be over her (the card, the "starting soon" box, and since 2026-10-07 her alerts,
// her TV, stickers, karaoke, the wipe) are 1% see-through (stage.css).
// (Drawing her off the page and copying each picture onto a 2D canvas avoided it too, but slowed her down on the server:
// 9.5 frames a second.)
let renderer, scene, camera, model, agi, effects, box, perMetre, wardrobe, moves, fx, centre, eyesAt, people, wx;
let shift = 0;
const clockNow = () => Date.now() + shift;            // her set's clock: what's heard in the stream right now
async function load() {
  await document.fonts.ready;
  (await roomDrawer(room))();
  // her picture's place on the set (stage.css), and its size in pixels
  box = ui.pic.getBoundingClientRect();
  renderer = new THREE.WebGLRenderer({ canvas: ui.pic, antialias: false, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round((box.width * DRAW) / H), Math.round((box.height * DRAW) / H), false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  model = await loadAgi1_2D({ renderer, armRefine: ARM_REFINE_LIVE });
  scene.add(model.holder);
  const { eyes, waist } = model.landmarks;
  eyesAt = eyes;
  perMetre = (FRAME.waist - FRAME.eyes) / (eyes - waist);
  const tall = H / perMetre;
  centre = eyes - (H / 2 - FRAME.eyes) / perMetre;
  // the camera looks at her middle, its view as tall as the set; her picture is the part of that view where it is on the set
  const wide = 2 * Math.max(FRAME.x, W - FRAME.x);
  camera = new THREE.PerspectiveCamera(18, wide / H, 0.05, 60);
  camera.setViewOffset(wide, H, wide / 2 - FRAME.x + box.left, box.top, box.width, box.height);
  camera.position.set(0, centre, tall / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  camera.lookAt(0, centre, 0);
  // her texture at the size she's shown, one of its pixels to one of her picture's, without mipmaps (src/stage/agi1-2d.js:
  // fitTexture): about a quarter less drawing for a server without a graphics card, the same look
  model.fitTexture(Math.min(2048, Math.round((perMetre * DRAW) / H / model.uvPerMetre)));
  effects = createEffects(scene);
  effects.setHeartColors(HEARTS);
  fx = createFx({ set, layer: $('[data-fx]'), confetti: $('[data-confetti]'), alertEl: $('[data-alert]'), karaokeEl: $('[data-karaoke]'),
    tvEl: $('[data-tv]'), wipeEl: $('[data-wipe]'), clock: clockNow });
  wardrobe = createWardrobe(model);
  people = createPeople({ el: ui.npc, bubble: ui.npcBubble, clock: clockNow });
  wx = createWeather({ back: ui.wxBack, front: ui.wxFront, flash: ui.flash });
  moves = createMoves({
    clock: clockNow,
    onFx: (kind) => actionFx(kind),
    onProp: (what) => wardrobe.hold(what),
    onCam: (kind, seconds) => cam(kind, seconds),
    places,
    still: () => Boolean(ride || trip),           // (while she rides: nothing by herself)
    // (2026-10-08) her arms and the spots of her face this frame: her hands reach where they should as she moves
    body: () => (wardrobe.spots ? { arms: model.drawnArms, spots: wardrobe.spots } : null),
  });
  // her brows lift on a surprise (her model's own brow parameters don't move anything); her accessories follow her
  const D = model.core.drawables, ids = Array.from(D.ids);
  const brows = ['brow_L', 'brow_R'].map((n) => ids.indexOf(n)).filter((i) => i >= 0);
  const faceH = (() => { const p = D.vertexPositions[ids.indexOf('face')]; let a = Infinity, b = -Infinity; for (let k = 1; k < p.length; k += 2) { a = Math.min(a, p[k]); b = Math.max(b, p[k]); } return b - a; })();
  model.hooks.afterDeform = () => {
    const lift = moves.brows * faceH * 0.045;
    if (lift > 1e-6) for (const i of brows) { const p = D.vertexPositions[i]; for (let k = 1; k < p.length; k += 2) p[k] += lift; }
    wardrobe.update(moves.emote, { front: moves.front });
  };
  agi = createAgi1_2D(model, { camera, effects, reducedMotion: false, onGlow: () => {}, moves });
  agi.setCloseUp(true);                    // her streamer framing: no surprise dances (moves.js dances on the music's beat)
  agi.setPointer(null);
  for (let i = 0; i < FPS; i++) { agi.update(1 / FPS); effects.update(1 / FPS); }
  renderer.setAnimationLoop(frame);
  return { fps: FPS };
}

// where she may go on the set (metres from her usual place, her middle at x = 920): all the way left while nothing's on the
// left of the set, else only a little (a card or her TV is there); a little to the right (her right side past the edge)
const leftBusy = () => !ui.card.hidden || set.dataset.mode === 'tv' || set.dataset.mode === 'pic' || set.dataset.mode === 'meet';
function places() {
  if (ride || trip) { const x = moves?.figure.x || 0; return { min: x, max: x }; }
  return { min: leftBusy() ? (set.dataset.mode === 'meet' ? 0.05 : -0.08) : -(FRAME.x - 300) / perMetre, max: (1060 - FRAME.x) / perMetre };
}

// where her head is on the set (pixels), for the emojis she says and her stickers
const v3 = new THREE.Vector3();
function headAt(lift = 0) {
  if (!model) return { x: 920, y: 200 };
  model.marks.head.getWorldPosition(v3);
  v3.y += lift;
  v3.project(camera);
  return { x: box.left + ((v3.x + 1) / 2) * box.width, y: box.top + ((1 - v3.y) / 2) * box.height };
}
function actionFx(kind) {
  const at = headAt(0);
  if (kind === 'laugh') fx.sticker('laugh', { x: at.x - 215, y: at.y - 30 });
  else if (kind === 'surprise') fx.sticker('surprise', { x: at.x + 175, y: at.y - 55 });
  else if (kind === 'think') fx.sticker('think', { x: at.x + 170, y: at.y - 45 });
  else if (kind === 'clap') fx.sticker('clap', { x: at.x - 240, y: at.y + 150 });
  else if (kind === 'hearts') effects.spawnHearts(model.marks.chest.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)), { count: 16, spread: 0.5, size: 0.11, rise: 0.9 });
  else if (kind === 'sparkle') fx.sparkle({ x: at.x - 150, y: at.y - 10 }, 6);
  else if (kind === 'hearts-small') effects.spawnHearts(model.marks.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0)), { count: 6, spread: 0.3, size: 0.07, rise: 0.5 });
  // (2026-10-07) her emotions and her snacks
  else if (kind === 'hmph' || kind === 'hehe' || kind === 'dots' || kind === 'bang') fx.sticker(kind, { x: at.x - 215, y: at.y - 40 });
  else if (kind === 'zzz') fx.emoji(['💤'], { x: at.x - 190, y: at.y - 40 });
  else if (kind === 'snow') fx.emoji(['❄️', '❄️'], { x: at.x - 260, y: at.y + 20 });
  else if (kind === 'fire') fx.emoji(['🔥'], { x: at.x - 230, y: at.y + 60 });
  else if (kind === 'mmm') { fx.sticker('mmm', { x: at.x - 225, y: at.y - 30 }); actionFx('hearts-small'); }
  else if (kind === 'bite') { food.stage = Math.min(2, food.stage + 1); if (food.id) wardrobe.food(food.id, food.stage); fx.sticker('nom', { x: at.x - 205, y: at.y + 90 }); }
}

// ---------- the camera: now and then it moves in on her a little (a streamer leaning in), and on her song's big moments ----------
const camState = { z: 1, tz: 1, until: 0, next: 25_000, pulse: 0 };
function cam(kind, seconds = 6) {
  camState.tz = CAM_ZOOM[kind] || 1;
  camState.until = performance.now() + Math.max(1, Number(seconds) || 6) * 1000;
  return true;
}
function camFrame(dt, t) {
  if (camState.until && t > camState.until) { camState.tz = 1; camState.until = 0; }
  // by itself: a slow push in while she talks, every half a minute or so
  if (ride || trip) camState.tz = 1;
  if (!camState.until && t > camState.next && agi.mouthOpen > 0.05 && !singing && !ride && !trip) {
    cam('mid', 5 + Math.random() * 3);
    camState.next = t + 30_000 + Math.random() * 40_000;
  }
  const want = camState.tz * (1 + 0.045 * camState.pulse);
  camState.pulse *= Math.exp(-dt * 7);
  camState.z += (want - camState.z) * (1 - Math.exp(-dt * (camState.pulse > 0.05 ? 14 : 1.6)));
  if (Math.abs(camera.zoom - camState.z) < 1e-4) return;
  camera.zoom = camState.z;
  // her eyes a little higher as it moves in (her face, not her chest, in the middle of it)
  const eyeY = FRAME.eyes - (camState.z - 1) * 70;
  const y = eyesAt - (H / 2 - eyeY) / (perMetre * camState.z);
  camera.position.y = y;
  camera.lookAt(0, y, 0);
  camera.updateProjectionMatrix();
}

// ---------- what she says: her mouth and her captions follow the sound ffmpeg sends ----------
// say: { startAt (ms, this computer's clock: when her first word is heard in the stream), step (ms per envelope value),
// env (0..1: how loud she is), cues ([{ from, to, text }], seconds from startAt), react (a mood), act (one of her actions,
// as she starts), emoji (false: no emojis pop up) }
let speech = null, singing = false, song = null;
function say(s) {
  speech = { startAt: Number(s.startAt) || Date.now(), step: Number(s.step) || 20, env: Array.isArray(s.env) ? s.env : [], cues: Array.isArray(s.cues) ? s.cues : [],
    end: (Number(s.startAt) || Date.now()) + (Number(s.seconds) || 0) * 1000, reacted: false, react: s.react || null, act: s.act || null, cue: -1,
    emoji: s.emoji === false ? [] : emojisIn(s.cues?.map((c) => c.text).join(' ')), caption: s.caption !== false };
  // (2026-10-07) the language she speaks it in (her 16): the caption says so to the browser (its letters and line breaks)
  ui.caption.lang = typeof s.lang === 'string' && /^[a-z]{2,3}$/.test(s.lang) ? s.lang : 'en';
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
  const t = now - speech.startAt;
  if (t < 0) return;
  if (!speech.reacted) {
    speech.reacted = true;
    if (speech.react) agi.react(speech.react);
    if (speech.act) moves.act(speech.act);
    if (speech.emoji.length) { const h = headAt(0); fx.emoji(speech.emoji, { x: h.x - 250, y: h.y + 70 }); }
  }
  const level = speech.env[Math.floor(t / speech.step)] ?? 0;
  agi.setTalk(level);
  const sec = t / 1000;
  if (speech.caption) {
    const at = speech.cues.findIndex((c) => sec >= c.from && sec < c.to);
    if (at !== speech.cue) {
      speech.cue = at;
      if (at >= 0) { ui.captionText.textContent = speech.cues[at].text; ui.caption.hidden = false; } else ui.caption.hidden = true;
    }
  }
  if (now > speech.end + 400) stop();
}

// ---------- the card ----------
// { kind: 'question' | 'segment' | 'diary' | 'wyr' | 'post' | 'reply' | 'chart' | 'song', kicker, title, body, list: [text],
// pick (index in list), stats: [{ label, value, tone: 'up' | 'down' }], foot } or null
function card(c) {
  if (!c) { ui.card.hidden = true; return true; }
  ui.card.dataset.kind = c.kind || 'segment';
  ui.card.lang = typeof c.lang === 'string' && /^[a-z]{2,3}$/.test(c.lang) ? c.lang : 'en';
  ui.post.hidden = c.kind !== 'post';
  ui.kicker.textContent = c.kicker || '';
  ui.title.textContent = c.title || '';
  ui.body.textContent = c.body || '';
  ui.foot.textContent = c.foot || '';
  ui.list.replaceChildren(...(Array.isArray(c.list) ? c.list : []).map((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (c.pick === i) li.className = 'is-pick';
    return li;
  }));
  ui.stats.replaceChildren(...(Array.isArray(c.stats) ? c.stats.slice(0, 3) : []).map((s) => {
    const d = document.createElement('div');
    if (s.tone === 'up' || s.tone === 'down') d.className = s.tone;
    const dt = document.createElement('dt'); dt.textContent = s.label || '';
    const dd = document.createElement('dd'); dd.textContent = s.value || '—';
    d.append(dt, dd);
    return d;
  }));
  // a fresh card pops in again
  ui.card.hidden = true;
  void ui.card.offsetWidth;
  ui.card.hidden = false;
  if (moves && moves.figure.x < places().min) moves.move('center');
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
  // (her little things by herself only while she's on: not on "starting soon" or "be right back")
  moves?.auto(!SCREENS[kind]);
  return true;
}

// ---------- where she looks ----------
let lookTimer = null;
function look(where, ms = 0) {
  clearTimeout(lookTimer);
  if (where === 'card') { agi.setAttention('idle'); agi.setPointer({ x: -1.9, y: 0.35 }); }
  else if (where === 'tv') { agi.setAttention('idle'); agi.setPointer({ x: -1.6, y: 0.2 }); }
  else if (where === 'think') { agi.setPointer(null); agi.setAttention('thinking'); }
  else { agi.setPointer(null); agi.setAttention('idle'); }
  if (ms > 0 && where !== 'you') lookTimer = setTimeout(() => look('you'), ms);
  return true;
}

// ---------- her room and her outfit ----------
async function changeRoom(id, { instant = false } = {}) {
  if (!ROOMS[id]) return false;
  const draw = await roomDrawer(id);
  if (instant || !fx) { draw(); return true; }
  fx.wipe(draw);
  return true;
}
async function changeOutfit(id, { instant = false } = {}) {
  if (!OUTFITS[id]) return false;
  // (2026-10-07) its painted accessories, loaded first (paint.js)
  const ready = wardrobe.prepare(id);
  if (instant) { await ready; wardrobe.wear(id); return true; }
  // a hop and sparkles, and her new colors as she lands
  const at = headAt(-0.1);
  fx.sparkle({ x: at.x, y: at.y }, 9);
  fx.sparkle({ x: at.x - 120, y: at.y + 160 }, 7);
  agi.react('tap');
  await Promise.all([ready, wait(220)]);
  wardrobe.wear(id);
  return true;
}

// ---------- music: the stage's lights and the crowd follow its beat ----------
function music(m) {
  if (!m) { set.dataset.music = 'off'; return true; }
  const beat = 60 / (Number(m.bpm) || 120);
  set.dataset.music = 'on';
  set.style.setProperty('--beat', `${beat.toFixed(3)}s`);
  set.style.setProperty('--phase', `${(-(((clockNow() - Number(m.beat0 || clockNow())) / 1000) % beat)).toFixed(3)}s`);
  return true;
}

// ---------- her song: she sings it (her mouth from its vocals), karaoke for its hook, her moves on its beat ----------
// { startAt (ms: when it starts being heard), seconds, step, env (0..1, her mouth), lines (karaoke), beats, cues (her moves),
// sections (its big moments: the camera and the lights), title }
function sing(s) {
  if (!s) {
    singing = false; song = null; moves.sing(false); moves.dance(null); fx.karaoke(null); music(null);
    ui.song.hidden = true; set.dataset.mode = 'none'; wardrobe.hold(null); stop();
    return true;
  }
  singing = true;
  const startAt = Number(s.startAt);
  song = { startAt, end: startAt + (Number(s.seconds) || 0) * 1000, sections: Array.isArray(s.sections) ? s.sections : [], downbeats: Array.isArray(s.downbeats) ? s.downbeats : [], hit: -1 };
  say({ startAt, step: s.step || 20, env: s.env, cues: [], seconds: s.seconds, emoji: false, caption: false });
  fx.karaoke({ startAt, lines: s.lines });
  moves.sing(true);
  moves.dance({ beat0: startAt, beats: s.beats, cues: s.cues, until: song.end, bpm: s.bpm });
  const beats = Array.isArray(s.beats) ? s.beats : [];
  const bpm = beats.length > 8 ? 60 / ((beats[beats.length - 1] - beats[0]) / (beats.length - 1)) : Number(s.bpm) || 120;
  music({ bpm, beat0: startAt + (beats[0] || 0) * 1000 });
  ui.song.textContent = `♪ ${s.title || 'my song'}`;
  ui.song.hidden = false;
  set.dataset.mode = 'song';
  return true;
}
function songFrame(now) {
  if (!song) return;
  if (now > song.end + 300) { sing(null); return; }
  const s = (now - song.startAt) / 1000;
  // in its big moments the camera pulses on the downbeats
  const big = song.sections.some((x) => s >= x.from && s < x.to);
  if (big) {
    let k = -1;
    for (let i = 0; i < song.downbeats.length && song.downbeats[i] <= s; i++) k = i;
    if (k !== song.hit && k >= 0) { song.hit = k; camState.pulse = 1; }
  }
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
  const text = Number.isInteger(n) && n > 0 ? `${n} question${n === 1 ? '' : 's'} waiting` : '';
  if (ui.queue.textContent !== text) { ui.queue.textContent = text; fitHint(); }
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
  const on = markers.some((at) => now >= at && now < at + 200);
  if (markerEl.hidden === on) markerEl.hidden = !on;
}


// ---------- (2026-10-07) her trips: she rides there ----------
// (2026-10-07, her painted set; the owner after her first trips' preview: "so bad") A wipe, and she's in it: the painting of
// its inside behind her (the seat she rides in, the view out of its window), the route card, and the ride's own motion: the
// picture and her moving together, like a camera riding along (a car's bumps, a train's rhythm, a boat's roll, a rocket's
// rumble), slowly closer. Then a wipe, and she's there. (Until then a vehicle drawn in code pulled up, she hopped into its
// window and it drove off.)
let ride = null;                 // { vehicle, kind, t } while she rides
let trip = null;                 // { vehicle, to, kind } from tripGo until tripArrive is done
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// tripGo({ vehicle, kind, from, to, icon, seconds }): a wipe into it, the route card. Resolves when she's on her way.
async function tripGo({ vehicle = 'robotaxi', kind = null, from = 'home', to = '', icon = '➜', seconds = 14 } = {}) {
  if (!VEHICLES[vehicle] || trip) return false;
  const k = kind || VEHICLES[vehicle].kind;
  trip = { vehicle, kind: k, to };
  ui.card.hidden = true;
  stopTv();
  moves.move('center');
  camState.tz = 1;
  const draw = await rideDrawer(vehicle, k);
  await fx.wipe(() => {
    placeChip(null);
    draw();
    ride = { vehicle, kind: k, t: 0 };
    set.dataset.ride = vehicle;
    routeCard({ from, to, icon, seconds });
  });
  return true;
}
// tripArrive({ to, name, country }): a wipe, and she's there (its chip next to her name)
async function tripArrive({ to, name = '', country = '' } = {}) {
  if (!trip || !PLACES[to]) return false;
  const draw = await placeDrawer(to);
  await fx.wipe(() => {
    routeCard(null);
    ride = null;
    delete set.dataset.ride;
    ui.bg.style.transform = '';
    draw();
    placeChip({ name: name || PLACES[to].name, country: country || PLACES[to].country });
  });
  trip = null;
  return true;
}
// home again (or another room): a wipe (her trips home are quick: she "teleports" back to her room)
function goHome(id = 'studio') {
  if (ride) return false;
  trip = null;
  routeCard(null);
  placeChip(null);
  return changeRoom(ROOMS[id] ? id : 'studio');
}
function routeCard(r) {
  if (!r) { ui.route.hidden = true; return true; }
  ui.routeFrom.textContent = r.from || 'home';
  ui.routeTo.textContent = r.to || '';
  ui.routeIcon.textContent = r.icon || '➜';
  ui.routeKicker.textContent = r.kicker || 'On my way';
  ui.route.style.setProperty('--route-s', `${Math.max(3, Number(r.seconds) || 14)}s`);
  ui.route.hidden = true; void ui.route.offsetWidth; ui.route.hidden = false;
  return true;
}
function placeChip(p) {
  if (!p) { ui.place.hidden = true; return true; }
  ui.placeName.textContent = p.name || '';
  ui.placeCountry.textContent = p.country ? `· ${p.country}` : '';
  ui.place.hidden = false;
  return true;
}
function stopTv() { if (set.dataset.mode === 'tv' || set.dataset.mode === 'pic') { fx.tv(null); set.dataset.mode = 'none'; } }

// ---------- (2026-10-07) the people she meets: they walk in on the left, talk (their words in a bubble), wave, walk out ----------
async function meet(id) {
  if (!PEOPLE[id]) return false;
  stopTv();
  ui.card.hidden = true;
  set.dataset.mode = 'meet';
  moves.move('right');
  await people.show(id, { x: -460 });
  await people.walkTo(60, 1900);
  people.wave(1.6);
  // their bubble beside their head (a painted person is a little wider than one drawn in code)
  ui.npcBubble.style.left = `${60 + Math.round(people.w * 0.8)}px`;
  return true;
}
// their line, in step with their voice: { startAt, step, env, text, seconds }
function npcSay(sp) { return people.say(sp); }
async function bye() {
  if (!people.id) return false;
  people.wave(1.4);
  await wait(700);
  ui.npcBubble.hidden = true;
  await people.walkTo(-people.w - 60, 1700);
  people.hide();
  if (set.dataset.mode === 'meet') set.dataset.mode = 'none';
  moves.move('center');
  return true;
}

// ---------- (2026-10-07) her food: in her hand, a bite at a time ----------
const food = { id: null, stage: 0 };
function eat(id) {
  if (!FOODS[id]) return false;
  food.id = id; food.stage = 0;
  wardrobe.food(id, 0);
  return moves.act(FOODS[id].drink ? 'drink' : 'eat');
}

// ---------- (2026-10-07) the weather: in the rain she holds her umbrella ----------
function weather(id) {
  const w = id && WEATHERS[id] ? id : null;
  wx.set(w);
  moves.carry(w && WEATHERS[w].umbrella ? 'umbrella' : null);
  set.dataset.weather = w || 'none';
  return true;
}

// ---------- (2026-10-07, the owner: "make it interactive already so they know she can do everything") what to try asking ----------
let hints = null;
function hint(list, { every = 8 } = {}) {
  hints = Array.isArray(list) && list.length ? { list: list.slice(0, 40), i: -1, every: Math.max(3, every) * 1000, next: 0 } : null;
  if (!hints) ui.hint.textContent = '';
  return true;
}
function hintFrame(now) {
  if (!hints || now < hints.next) return;
  hints.i = (hints.i + 1) % hints.list.length;
  hints.next = now + hints.every;
  ui.hint.textContent = '';
  void ui.hint.offsetWidth;
  ui.hint.textContent = hints.list[hints.i];
  fitHint();
}
// a hint that doesn't fit next to the questions waiting is hidden until the next one (never cut off mid-word)
function fitHint() {
  ui.hint.classList.toggle('is-cut', Boolean(ui.hint.textContent) && ui.hint.scrollWidth > ui.hint.clientWidth + 1);
}

// ---------- every frame (at most 30 a second: a server without a graphics card draws her in software) ----------
let last = 0, drawn = 0, since = performance.now();
function frame(t) {
  if (t - last < 1000 / FPS - 2) return;
  const dt = Math.min(0.1, (t - last) / 1000 || 1 / FPS);
  last = t;
  const now = clockNow();
  speechFrame(now);
  songFrame(now);
  clockFrame(Date.now());
  markerFrame(now);
  camFrame(dt, t);
  agi.update(dt);
  // where she is (moves.js); while she rides, she and the picture behind her move together with the ride (vehicles.js)
  const f = moves.figure;
  let rx = 0, ry = 0;
  if (ride) {
    ride.t += dt;
    const m = rideMotion(ride.kind, ride.t);
    rx = m.x; ry = m.y;
    ui.bg.style.transform = `translate(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px) rotate(${m.r.toFixed(3)}deg) scale(${(1.05 + Math.min(1, ride.t / 16) * 0.03).toFixed(4)})`;
  }
  model.holder.position.set(f.x + rx / perMetre, f.y - ry / perMetre, 0);
  model.holder.scale.set(f.sx, f.sy, 1);
  effects.update(dt);
  fx.frame(dt, now);
  people.frame(dt);
  wx.frame(dt);
  hintFrame(Date.now());
  fadeHearts();
  renderer.render(scene, camera);
  drawn += 1;
}

// her hearts fade out as they come near her picture's left edge (the set's own edge since 2026-10-07: never a heart cut in two)
const EDGE_FADE = 90, at = new THREE.Vector3();
function fadeHearts() {
  for (const o of scene.children) {
    if (!o.isSprite) continue;
    at.copy(o.position).project(camera);
    const left = ((at.x + 1) / 2) * box.width - (o.scale.x * perMetre * camState.z) / 2;        // its left side, from the edge (set pixels)
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
  // (2026-10-07) her rooms, outfits, moves, dances, song, effects
  room: (id, o) => changeRoom(id, o),
  outfit: (id, o) => changeOutfit(id, o),
  act: (id) => (ACTIONS[id] ? moves.act(id) : false),
  dance: (d) => { moves.dance(d ? { ...d, beat0: Number(d.beat0) || clockNow() } : null); music(d ? { bpm: d.bpm, beat0: d.beat0 } : null); return true; },
  sing,
  cam,
  auto: (on) => moves.auto(on),
  pose: (p) => moves.hold(p),
  // (2026-10-08) something in her hand as it is, for a look at it (her moves give it to her otherwise)
  hold: (what) => wardrobe.hold(what),
  alert: (a) => fx.alert(a),
  confetti: (seconds) => { fx.burst(Number(seconds) || 3.5); return true; },
  sticker: (kind) => { const h = headAt(0); fx.sticker(kind, { x: h.x - 215, y: h.y - 30 }); return true; },
  emoji: (text) => { const h = headAt(0); fx.emoji(emojisIn(text), { x: h.x - 250, y: h.y + 70 }); return true; },
  // (a video: her captions step aside while it plays; a picture: she talks about it, her captions stay)
  tv: (v) => { set.dataset.mode = v ? (v.img ? 'pic' : 'tv') : 'none'; if (v && moves.figure.x < places().min) moves.move('center'); return fx.tv(v); },
  // (2026-10-07, viewers' requests) jumps, a twirl, moving around the set
  jump: (times) => moves.jump(times),
  twirl: (times) => moves.twirl(times),
  move: (where) => moves.move(where),
  // (2026-10-07) her trips, the people she meets, her food, the weather, what to try
  tripGo, tripArrive, home: (id) => goHome(id),
  // (back at a place she was visiting, after her song on the concert stage: a wipe, like a room)
  place: async (id, o = {}) => {
    if (!PLACES[id] || ride) return false;
    const draw = await placeDrawer(id);
    const go = () => { routeCard(null); draw(); if (o.chip !== false) placeChip({ name: PLACES[id].name, country: PLACES[id].country }); };
    if (o.instant || !fx) go(); else fx.wipe(go);
    return true;
  },
  meet, npcSay, bye, eat, weather,
  // (2026-10-07, her painted set) where a painted accessory sits, changed on the set while it's being tuned (outfits.js)
  paintAt: (key, v) => { PAINT_AT[key] = { ...(PAINT_AT[key] || {}), ...v }; return PAINT_AT[key]; },
  // (2026-10-08) and how she holds something (outfits.js HOLD)
  holdAt: (key, v) => (HOLD[key] ? Object.assign(HOLD[key], v) : null),
  // (2026-10-08) and where her umbrella rests (outfits.js UMBRELLA)
  umbrellaAt: (v) => Object.assign(UMBRELLA, v),
  lightning: () => wx.lightning(),
  hint,
  get state() {
    return { room, outfit: wardrobe?.current, held: wardrobe?.held, action: moves?.action, dancing: moves?.dancing, routine: moves?.routine,
      singing, zoom: camera?.zoom, pops: fx?.popping, mode: set.dataset.mode || 'none', x: moves?.figure.x, moving: moves?.moving,
      where: set.dataset.where || 'room', riding: Boolean(ride || trip), vehicle: trip?.vehicle || null, seated: Boolean(ride), painted: set.dataset.painted === 'on', npc: people?.id || null,
      weather: wx?.id || null, food: food.id, foodStage: food.stage, carrying: moves?.carrying || null, emote: moves?.emote?.kind || null };
  },
};
