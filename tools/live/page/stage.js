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
// also") her trips (places.js, vehicles.js: she rides there, her picture placed in its seat), the people she meets
// (people.js), her food (food.js), her emotions (moves.js) and the weather (weather.js).
// Nothing here talks to the network: only this page's own files (and her videos, which the runner serves from its own disk).
import * as THREE from 'three';
import { loadAgi1_2D, createAgi1_2D } from '../../../src/stage/agi1-2d.js';
import { createEffects } from '../../../src/stage/effects.js';
import { drawRoom, fillAmbient, fillAmbientList, ROOMS } from './rooms.js';
import { createWardrobe, OUTFITS } from './outfits.js';
import { createMoves, ACTIONS, CAM_ZOOM } from './moves.js';
import { createFx, emojisIn } from './fx.js';
import { PLACES, TRAVEL, drawPlace, drawTravel } from './places.js';
import { createVehicles, VEHICLES } from './vehicles.js';
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
  vehBack: $('[data-veh-back]'), vehFront: $('[data-veh-front]'), place: $('[data-place]'), placeName: $('[data-place-name]'), placeCountry: $('[data-place-country]'),
  route: $('[data-route]'), routeKicker: $('[data-route-kicker]'), routeFrom: $('[data-route-from]'), routeTo: $('[data-route-to]'), routeIcon: $('[data-route-icon]'),
  hint: $('[data-hint]'),
};

// ---------- her room (rooms.js): drawn once each time she moves, its little moving bits in CSS ----------
let room = 'studio';
function showRoom(id) {
  room = ROOMS[id] ? id : 'studio';
  drawRoom(room, ui.bg);
  fillAmbient(room, ui.amb);
  set.dataset.room = room;
  set.dataset.where = 'room';
  ui.place.hidden = true;
}
// (2026-10-07) a real place (or the Moon, or Mars): drawn the same way, its moving bits too; and the scene on her way there
function showPlace(id) {
  if (!PLACES[id]) return false;
  room = id;
  ui.bg.getContext('2d').clearRect(0, 0, W, H);
  drawPlace(id, ui.bg);
  fillAmbientList(PLACES[id].ambient || [], ui.amb, id);
  set.dataset.room = id;
  set.dataset.where = 'place';
  return true;
}
function showTravel(kind) {
  const t = TRAVEL[kind] || TRAVEL.road;
  ui.bg.getContext('2d').clearRect(0, 0, W, H);
  drawTravel(kind in TRAVEL ? kind : 'road', ui.bg);
  fillAmbientList(t.ambient || [], ui.amb, `travel-${kind}`);
  set.dataset.room = `travel-${kind}`;
  set.dataset.where = 'travel';
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
let renderer, scene, camera, model, agi, effects, box, perMetre, wardrobe, moves, fx, centre, eyesAt, veh, people, wx;
let shift = 0;
const clockNow = () => Date.now() + shift;            // her set's clock: what's heard in the stream right now
async function load() {
  await document.fonts.ready;
  showRoom(room);
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
  veh = createVehicles({ back: ui.vehBack, front: ui.vehFront });
  people = createPeople({ el: ui.npc, bubble: ui.npcBubble, clock: clockNow });
  wx = createWeather({ back: ui.wxBack, front: ui.wxFront, flash: ui.flash });
  moves = createMoves({
    clock: clockNow,
    onFx: (kind) => actionFx(kind),
    onProp: (what) => wardrobe.hold(what),
    onCam: (kind, seconds) => cam(kind, seconds),
    places,
    still: () => Boolean(ride || trip),           // (in a vehicle, or hopping in or out: nothing by herself)
  });
  // her brows lift on a surprise (her model's own brow parameters don't move anything); her accessories follow her
  const D = model.core.drawables, ids = Array.from(D.ids);
  const brows = ['brow_L', 'brow_R'].map((n) => ids.indexOf(n)).filter((i) => i >= 0);
  const faceH = (() => { const p = D.vertexPositions[ids.indexOf('face')]; let a = Infinity, b = -Infinity; for (let k = 1; k < p.length; k += 2) { a = Math.min(a, p[k]); b = Math.max(b, p[k]); } return b - a; })();
  model.hooks.afterDeform = () => {
    const lift = moves.brows * faceH * 0.045;
    if (lift > 1e-6) for (const i of brows) { const p = D.vertexPositions[i]; for (let k = 1; k < p.length; k += 2) p[k] += lift; }
    wardrobe.update(moves.emote);
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
function changeRoom(id, { instant = false } = {}) {
  if (!ROOMS[id]) return false;
  if (instant || !fx) { showRoom(id); return true; }
  fx.wipe(() => showRoom(id));
  return true;
}
function changeOutfit(id, { instant = false } = {}) {
  if (!OUTFITS[id]) return false;
  if (instant) { wardrobe.wear(id); return true; }
  // a hop and sparkles, and her new colors as she lands
  const at = headAt(-0.1);
  fx.sparkle({ x: at.x, y: at.y }, 9);
  fx.sparkle({ x: at.x - 120, y: at.y + 160 }, 7);
  agi.react('tap');
  setTimeout(() => wardrobe.wear(id), 220);
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


// ---------- (2026-10-07) her trips: a vehicle pulls up, she hops in, it takes her there ----------
// While she rides, her picture is placed in its seat every frame (her eyes on the seat, scaled down) and cut below its
// sill (a scissor on her canvas: her legs never hang out of a scooter or a balloon's basket). Its body is behind her while
// it pulls up, and over her once she's in.
const BAR_TOP = H - 64;
let ride = null;                 // { from: { ex, ey, s }, t, ms, out } while she hops in or out; { seated: true } in her seat
let trip = null;                 // { vehicle, to, kind } from tripGo until tripArrive is done
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// where it stands on the set (its size k, its top y): on the ground at the bar, or in the sky
function vehSpot(id) {
  const v = VEHICLES[id];
  const k = id === 'plane' ? 0.78 : id === 'bus' || id === 'train' || id === 'jeepney' ? 0.86 : 1;
  let y;
  if (v.wheels.length) y = BAR_TOP + 6 - Math.max(...v.wheels.map(([, wy, r]) => wy + r)) * k;
  else if (id === 'boat') y = BAR_TOP - v.h * k + 40;
  else if (id === 'balloon') y = BAR_TOP - v.sill * k - 30;
  else if (id === 'rocket') y = BAR_TOP - v.h * k + 30;
  else if (id === 'cablecar') y = 40;
  else y = (BAR_TOP - v.h * k) / 2 + 30;
  return { k, y };
}
// where she is right now (set pixels): her eyes, her size
function herNow() {
  if (ride?.seated) { const st = veh.seat(); return { ex: st.x, ey: st.y, s: st.s }; }
  const f = moves.figure;
  return { ex: FRAME.x + f.x * perMetre, ey: FRAME.eyes - f.y * perMetre, s: 1 };
}
// the hop: from where she is into the seat (or out of it to her place), an arc, her picture's cut sliding to the sill
function hop(into, ms = 900) {
  return new Promise((done) => { ride = { from: herNow(), t: 0, ms, into, done }; });
}
function rideFrame(dt) {
  if (!ride) return null;
  if (ride.seated) { const st = veh.seat(); return { ex: st.x, ey: st.y, s: st.s, cut: st.sill }; }
  ride.t += dt * 1000;
  const p = Math.min(1, ride.t / ride.ms), e = easeIO(p);
  const st = veh.seat() || { x: ride.from.ex, y: ride.from.ey, s: 1, sill: BAR_TOP };
  const to = ride.into ? { ex: st.x, ey: st.y, s: st.s } : { ex: FRAME.x, ey: FRAME.eyes, s: 1 };
  const from = ride.into ? ride.from : { ex: st.x, ey: st.y, s: st.s };
  const arc = Math.sin(p * Math.PI) * (ride.into ? 110 : 90);
  const out = { ex: from.ex + (to.ex - from.ex) * e, ey: from.ey + (to.ey - from.ey) * e - arc, s: from.s + (to.s - from.s) * e };
  // its body comes over her halfway (she's in), or goes behind her (she's out); her cut slides with it
  const inside = ride.into ? p >= 0.5 : p < 0.5;
  if (veh.over !== inside) veh.layer(inside);
  const k = ride.into ? smoothK(0.35, 0.7, p) : 1 - smoothK(0.3, 0.65, p);
  out.cut = BAR_TOP + (st.sill - BAR_TOP) * k;
  if (p >= 1) {
    const d = ride.done;
    ride = ride.into ? { seated: true } : null;
    d(true);
  }
  return out;
}
const smoothK = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// tripGo({ vehicle, kind, from, to, icon }): it pulls up, she hops in, it drives off, then the scene on her way (and the
// route card). Resolves when she's on her way.
async function tripGo({ vehicle = 'robotaxi', kind = null, from = 'home', to = '', icon = '➜', seconds = 14 } = {}) {
  if (!VEHICLES[vehicle] || trip) return false;
  const v = VEHICLES[vehicle], sp = vehSpot(vehicle);
  trip = { vehicle, kind: kind || v.kind, to };
  ui.card.hidden = true;
  stopTv();
  moves.move('center');
  camState.tz = 1;
  await wait(700);
  const stopX = 640 - v.seat.x * sp.k;
  const fly = v.kind === 'space' || vehicle === 'balloon', air = v.kind === 'sky' && !fly;
  veh.show(vehicle, { x: fly ? stopX : 1320, y: fly ? -v.h * sp.k - 40 : air ? sp.y - 220 : sp.y, k: sp.k, over: false });
  await veh.moveTo(stopX, sp.y, fly ? 2000 : 1700);
  await hop(true, 950);
  await wait(250);
  // off it goes, with her in it
  if (fly) await veh.moveTo(stopX, -v.h * sp.k - 60, 1500);
  else await veh.moveTo(-v.w * sp.k - 80, air ? sp.y - 260 : sp.y, 1700);
  // the scene on her way
  await new Promise((r) => fx.wipe(() => {
    showTravel(trip.kind);
    const sp2 = vehSpot(vehicle);
    veh.show(vehicle, { x: (W - v.w * sp2.k) / 2 + (vehicle === 'plane' ? 40 : 90), y: sp2.y, k: sp2.k, over: true });
    veh.travel({ bob: v.kind === 'sea' ? 0.5 : v.kind === 'space' ? 2.2 : 1.4, speed: 700 });
    routeCard({ from, to, icon, seconds });
    r();
  }));
  return true;
}
// tripArrive({ to, name, country }): the place, it pulls in, she hops out where she always stands, it leaves
async function tripArrive({ to, name = '', country = '' } = {}) {
  if (!trip || !PLACES[to]) return false;
  const vehicle = trip.vehicle, v = VEHICLES[vehicle], sp = vehSpot(vehicle);
  const fly = v.kind === 'space' || vehicle === 'balloon', air = v.kind === 'sky' && !fly;
  const stopX = 600 - v.seat.x * sp.k;
  await new Promise((r) => fx.wipe(() => {
    routeCard(null);
    veh.stopTravel();
    showPlace(to);
    veh.show(vehicle, { x: fly ? stopX : -v.w * sp.k - 60, y: fly ? -v.h * sp.k - 40 : air ? sp.y - 220 : sp.y, k: sp.k, over: true });
    r();
  }));
  await veh.moveTo(stopX, sp.y, fly ? 2000 : 1800);
  await hop(false, 900);
  placeChip({ name: name || PLACES[to].name, country: country || PLACES[to].country });
  await wait(300);
  if (fly) await veh.moveTo(stopX, -v.h * sp.k - 60, 1500);
  else await veh.moveTo(W + 60, air ? sp.y - 240 : sp.y, 1500);
  veh.hide();
  trip = null;
  return true;
}
// home again (or another room): no vehicle, a wipe (her trips home are quick: she "teleports" back to her room)
function goHome(id = 'studio') {
  if (ride) return false;
  trip = null;
  veh.hide();
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
  people.show(id, { x: -330 });
  await people.walkTo(80, 1900);
  people.wave(1.6);
  ui.npcBubble.style.left = `${80 + 250}px`;
  return true;
}
// their line, in step with their voice: { startAt, step, env, text, seconds }
function npcSay(sp) { return people.say(sp); }
async function bye() {
  if (!people.id) return false;
  people.wave(1.4);
  await wait(700);
  ui.npcBubble.hidden = true;
  await people.walkTo(-340, 1700);
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
  veh.frame(dt);
  const r = rideFrame(dt);
  if (r) {
    // in a vehicle: her eyes on its seat, her size its, her picture cut at its sill
    model.holder.position.set((r.ex - FRAME.x) / perMetre, eyesAt - r.s * eyesAt - (r.ey - FRAME.eyes) / perMetre, 0);
    model.holder.scale.set(r.s, r.s, 1);
  } else {
    const f = moves.figure;
    model.holder.position.set(f.x, f.y, 0);
    model.holder.scale.set(f.sx, f.sy, 1);
  }
  effects.update(dt);
  fx.frame(dt, now);
  people.frame(dt);
  wx.frame(dt);
  hintFrame(Date.now());
  fadeHearts();
  if (r && r.cut < box.bottom - 1) {
    // only above the cut: the canvas cleared whole first (a scissor limits the clear too)
    const size = renderer.getSize(v2), k = size.y / box.height, hPx = Math.max(0, Math.round((r.cut - box.top) * k));
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    renderer.setScissor(0, size.y - hPx, size.x, hPx);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
  } else renderer.render(scene, camera);
  drawn += 1;
}
const v2 = new THREE.Vector2();

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
  place: (id, o = {}) => {
    if (!PLACES[id] || ride) return false;
    const go = () => { routeCard(null); showPlace(id); if (o.chip !== false) placeChip({ name: PLACES[id].name, country: PLACES[id].country }); };
    if (o.instant || !fx) go(); else fx.wipe(go);
    return true;
  },
  meet, npcSay, bye, eat, weather,
  lightning: () => wx.lightning(),
  hint,
  get state() {
    return { room, outfit: wardrobe?.current, held: wardrobe?.held, action: moves?.action, dancing: moves?.dancing, routine: moves?.routine,
      singing, zoom: camera?.zoom, pops: fx?.popping, mode: set.dataset.mode || 'none', x: moves?.figure.x, moving: moves?.moving,
      where: set.dataset.where || 'room', riding: Boolean(ride || trip), vehicle: veh?.id || null, seated: Boolean(ride?.seated), npc: people?.id || null,
      weather: wx?.id || null, food: food.id, foodStage: food.stage, carrying: moves?.carrying || null, emote: moves?.emote?.kind || null };
  },
};
