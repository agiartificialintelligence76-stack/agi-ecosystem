// GOING LIVE: AGI-1 just started streaming. Zero followers, one bare bedroom. Pick a video idea (two topics; trending
// ones get more) and she makes it at her desk while the clock runs down; the views buy things for her room, which come in
// boxes you open and drag where you like; every thing helps some topics, so her room makes her videos better. Her room
// fills the screen and scrolls sideways; when she isn’t recording she lives in it (games at her PC, naps, cooks, paints,
// dances…), and every thing you tap reacts. Mystery boxes (from levels, quests, the drone, good streams and every day)
// hold rare, epic and legendary finds for her collection book; complete a set for a bonus. Level up for skills, go live
// when the meter’s full (a minute of her stream, played live), move to bigger homes and climb the board of made-up
// streamers to #1. Her old videos keep earning while you’re away. (The owner, 2026-11-14: "yes exactly" to an AGI-1
// version of a famous YouTuber’s streamer game, ours in every way; then "Rebuild both" and "Short waits"; then, the same
// night, "take it down the site first then rework it then publish it to production": more space, a room that comes
// alive, boxes worth opening, better pixel art, a game’s buttons.) Made up and kept on this device: no wallet, no money,
// nothing to buy.
//
// The rules are ./econ.js (her career), ./room.js (her room’s grid) and ./stream.js (a live stream), pure; ./ai.js plays
// them (the tile’s preview, the balance tool, the tests); ./actor.js moves her; this file is the page.
import './style.css';
import { createShell } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY, REDUCED } from '../kit/env.js';
import { clamp } from '../kit/fx.js';
import { itemOf, topicOf, TUNE, HOMES, homeOf, boxOf, ITEMS } from './data.js';
import {
  tick, drain, startVideo, newIdeas, buy, openBox, tapBox, boxLeft, placeFromInv, autoSpot, moveHome, buyPerk, liveReady, liveNeed, liveStart, liveDone,
  catchDrone, zap, pet, comeBack, rankOf, grantBox, openMystery, got,
} from './econ.js';
import { canPlace, move as roomMove, store as roomStore, layer } from './room.js';
import { createStream, step, tap, drain as drainStream } from './stream.js';
import { createPlayer, playStep, resetPlayer, pickIdea, pickBuy, PROFILES } from './ai.js';
import { fresh, load, saveOf, earned } from './progress.js';
import { nameOf, colorOf, chatLine, askOf, botLine, botName, raidLine, techOf, say, pick, TIPS, endLine, liveShare, giftText, questText } from './lines.js';
import { createActors, update as updateActors, addBot, botLeaves, startDrone, droneAt, requestUse, drainActors } from './actor.js';
import { createRenderer, setRect, update, draw, toScreen, hitAt, ghostAt, fx, panBy, fling, panTo, bump, itemAt, cellX } from './render.js';
import { roomGeom, CELL, ROW, HER, OUTFITS } from './pixel.js';
import {
  createUI, shopCard, perksCard, questsCard, boardCard, recordsCard, awayCard, overExtra, titleExtra, collectionCard, mysteryCard, moreCard, fmt, full,
} from './ui.js';
import { createSound } from './sound.js';
import { USE_LINES, useOf, linesOf } from './uses.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'goinglive', name: 'GOING LIVE', root,
  howTo: {
    intro: 'AGI-1 just started streaming: zero followers, one bare bedroom. Make her videos, fill her room and take her to #1 trending.',
    steps: [
      ['Make videos', 'Tap one of her three video ideas down below. She records it at her desk while the clock runs down, then the views and new followers come in.'],
      ['Ride the trends', 'Each idea has two topics. Ideas about a trending topic (🔥) get more, two trending topics much more.'],
      ['Fill her room', 'Spend views in the Shop. Things come in a box: tap it, drag the thing where you like, tap ✓. Every thing helps the topics shown on it: a better room makes better videos.'],
      ['Her room', 'Drag it sideways to look around (🔍 shows all of it). Tap her things: each one reacts, and when she’s free she goes and uses it. She games, naps, cooks, paints, dances…'],
      ['Mystery boxes', 'Levels, quests, good streams, the fan-mail drone and every day bring mystery boxes: rare, epic and legendary finds the Shop doesn’t sell. Complete a set in her Collection for a bonus.'],
      ['Go live', 'Her videos fill the live meter. When it’s full, go live: a minute of her stream to play (answer chat, ban bots, welcome raids, fix problems). A good stream is the fastest way to grow.'],
      ['Little visitors', 'Tap the fan-mail drone for a gift, zap the spam bots, pet her cat. Her old videos keep earning while you’re away.'],
    ],
    touch: [['Tap', 'Ideas, boxes, her things, the drone, bots'], ['Drag', 'Her room sideways · a thing to its place']],
    keys: [['1–3', 'Make that idea'], ['← →', 'Look around her room'], ['S · D · L · C', 'Shop · Decorate · Go live · Collection'], ['Z', 'Zoom out / in'], ['Arrows · Enter · F', 'Move, place, flip a thing'], ['Space / Enter (live)', 'Take the most urgent thing'], ['Esc / P', 'Pause']],
  },
  onPause() { persist(); },
  // back from the pause card: what her old videos earned while the tab was hidden, if that’s waiting
  onResume() { showAway(); },
  onRestart() { if (mode === 'live' && S) startLive(S.cat); else if (mode !== 'title') enterHub({ quiet: true }); },
  onQuit() { S = null; endPlacing(); mode = 'title'; ui.mode('title'); persist(); queueMicrotask(toTitle); },
});

const canvas = document.createElement('canvas');
canvas.className = 'gl-canvas';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'AGI-1’s room, in pixel art: her things, her pets, and her');
const topCanvas = document.createElement('canvas');
topCanvas.className = 'gl-top';
topCanvas.setAttribute('aria-hidden', 'true');
shell.stage.append(canvas);
const R = createRenderer(canvas, topCanvas);
const { sfx, music } = createSound(shell.audio);
const fChip = shell.chip('Followers', 0, { accent: true, fmtFn: fmt });
const vChip = shell.chip('Views', 0, { fmtFn: fmt });
fChip.node.classList.add('gl-chip-f'); vChip.node.classList.add('gl-chip-v');

// `?qa` (browser tests only): the game’s state readable from the page, `&speed=n`, `&auto=good` (the game’s own player),
// `&live` to go live at once, `&f=` followers, `&level=`, `&home=`, `&views=`, `&items=a,b`, `&boxes=bronze,gold`,
// `&outfit=n`, `&got=all`, `&night` / `&day`. Nothing saved or counted.
const QA = QUERY.has('qa');
let qaSpeed = QA ? clamp(Number(QUERY.get('speed')) || 1, 0.25, 32) : 1;
const QA_AUTO = QA && PROFILES[QUERY.get('auto')] ? QUERY.get('auto') : null;

let save = load(shell.store.read(), (Date.now() >>> 0) || 1);
if (DEMO) save = { ...fresh(SEED || 7), career: showcase() };
if (QA) {
  save = fresh(SEED || 11);
  const c = save.career, f = Number(QUERY.get('f')), L = Number(QUERY.get('level')), h = Number(QUERY.get('home')), v = Number(QUERY.get('views'));
  if (Number.isFinite(f) && f > 0) c.followers = f;
  if (Number.isFinite(L) && L > 0) { c.level = L; c.points = Number(QUERY.get('points')) || 0; }
  if (Number.isFinite(h) && h > 0) c.home = Math.min(HOMES.length - 1, h);
  if (Number.isFinite(v) && v > 0) c.views = v;
  for (const id of (QUERY.get('items') || '').split(',').filter(Boolean)) if (itemOf(id)) { c.inv[id] = (c.inv[id] || 0) + 1; const at = autoSpot(c, id); if (at) placeFromInv(c, id, at.x, at.y, { on: at.on }); }
  for (const t of (QUERY.get('boxes') || '').split(',').filter(Boolean)) grantBox(c, t, 'qa');
  if (QUERY.get('got') === 'all') for (const x of ITEMS) got(c, x.id);
  if (QUERY.has('outfit')) c.outfit = clamp(Math.round(Number(QUERY.get('outfit')) || 0), 0, OUTFITS.length - 1);
  drain(c);
}
let c = save.career;
const persist = () => QA || DEMO || shell.store.update((d) => Object.assign(d, saveOf({ ...save, at: Date.now() })));
// the tile’s preview: a few weeks in, her studio loft full of things; she’s dancing when it starts
function showcase() {
  const k = fresh(SEED || 7).career;
  k.followers = 86000; k.views = 240000; k.level = 18; k.home = 2; k.videos = 120;
  for (const id of ['dancefloor', 'pc', 'gamerchair', 'monitor', 'arcade', 'sofa', 'tv', 'lamp', 'bookshelf', 'monstera', 'cat', 'robodog', 'neon', 'gameposter', 'discoball', 'mic', 'webcam',
    'aquarium', 'plushpile', 'jukebox', 'easel', 'clock', 'pottedplant', 'starposter', 'bear', 'cactus', 'lavalamp', 'synth', 'beanbag']) {
    k.inv[id] = (k.inv[id] || 0) + 1; const at = autoSpot(k, id); if (at) placeFromInv(k, id, at.x, at.y, { on: at.on });
  }
  k.perks = { fast: 3 };
  k.drone.next = 4.6; k.bots.next = 6.2; k.live = 4;
  grantBox(k, 'gold', 'demo');
  drain(k);
  return k;
}

let mode = 'title', S = null, bot = null, info = new Map(), cardNode = null, hiddenAt = 0;
let A = createActors(), placing = null, editing = false, drag = null, saveT = 5, hubT = 0, idleT = 12, demoT = 0, demoGap = 0, bandT = 0, lastPan = 99, edgeP = null;
let tipQ = [], tipUntil = 0, awayWaiting = null;
const cardOpen = () => Boolean(cardNode?.isConnected);
const night = () => (QUERY.has('night') ? true : QUERY.has('day') || DEMO ? false : (() => { const h = new Date().getHours(); return h >= 19 || h < 6; })());
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
resetHer();

const ui = createUI(shell.stage, {
  idea(k) { if (mode !== 'hub' || placing) return; makeVideo(k); },
  newIdeas() { if (newIdeas(c)) { sfx.pick(); ui.forceRender(); } },
  shop() { if (mode === 'hub' && !placing) openShop(); },
  edit() { if (mode !== 'hub') return; editing ? stopEdit() : startEdit(); },
  editDone() { stopEdit(); },
  live() { if (mode !== 'hub' || placing) return; if (liveReady(c)) startLive(); else { shell.toast(`Make ${liveNeed(c) - c.live} more video${liveNeed(c) - c.live === 1 ? '' : 's'} to fill the live meter`, 'info', 2200); sfx.nope(); } },
  collection() { if (mode === 'hub' && !placing) { sfx.pick(); openCollection(); } },
  more() { if (mode === 'hub' && !placing) { sfx.pick(); openMore(); } },
  perks: openPerks,
  zoom() { R.fit = !R.fit; ui.zoomed(R.fit); sfx.pick(); },
  mystery(uid) { if (mode === 'hub' && !placing) openMysteryBox(uid); },
  box(uid) { if (mode === 'hub' && !placing) tapDelivery(uid); },
  placeOk, placeFlip() { if (placing) { placing.flip = !placing.flip; sfx.pick(); } }, placeStore, placeCancel() { endPlacing(); if (editing) ui.edit(true); },
  tap(id) { if (mode !== 'live' || !S || S.over || bot || shell.state !== 'play') return; tap(S, id); flushLive(); },
});
shell.stage.append(topCanvas);

// ---------- her words, her face ----------
function speak(text, ms = 3000) { if (!text) return; ui.say(text, ms); A.her.talk = Math.min(2.2, 0.5 + text.length * 0.035); }
// tips, one at a time (a tip for her stream waits for her stream)
function tipOnce(key, text, ms = 7000, where = 'hub') {
  if (save.tips[key] || DEMO) return;
  save.tips[key] = true; persist();
  tipQ.push({ text, ms, where });
  pumpTips();
}
function pumpTips() {
  if (performance.now() < tipUntil || cardOpen()) return;
  const k = tipQ.findIndex((t) => t.where === mode);
  if (k < 0) return;
  const [t] = tipQ.splice(k, 1);
  ui.tip(t.text, t.ms); tipUntil = performance.now() + t.ms + 500;
}
function resetHer() {
  const home = homeOf(c);
  A = createActors(); A.her.x = Math.min(home.cols - 1, 2); A.her.y = Math.min(home.rows - 1, 2);
  R.pan.x = 0; R.pan.target = null; lastPan = 99;
}
// her head on the page (CSS pixels)
const herAt = () => { const G = roomGeom(homeOf(c)); return toScreen(R, G.x0 + (A.her.x + 0.5) * CELL, G.floorTop + (A.her.y + 1) * ROW - HER.h); };

// ---------- her room ----------
function enterHub({ quiet = false } = {}) {
  S = null; mode = 'hub'; keysAfter = performance.now() + 250;
  ui.mode('hub'); ui.hideTip(); tipUntil = 0;
  shell.started({ count: false });
  music.play('room');
  if (!quiet && save.at && !QA && !DEMO) {
    const before = c.videos, g = comeBack(c, (Date.now() - save.at) / 1000);
    flush(true);
    if (g.counted >= TUNE.idle.min && g.views >= 1) { openCard((close) => awayCard({ gain: g, done: c.videos - before, onClose: close }), 'While you were away'); speak(say('back')); }
  }
  tipOnce('hub', TIPS.hub);
  // her first day: she says hello before she wanders off
  if (!c.videos && !DEMO) { resetHer(); A.her.wait = 7; speak(say('first'), 6000); }
  // a box of the day
  if (!QA && !DEMO && save.daily !== today()) { save.daily = today(); grantBox(c, 'silver', 'daily'); flush(quiet); }
  persist();
}
function openCard(make, label) {
  // never over the kit’s pause card (closing ours would leave the game paused with no card to resume it from)
  if (shell.state === 'pause') return;
  const close = () => { if (cardOpen()) shell.closeCard(); cardNode = null; ui.forceRender(); };
  cardNode = make(close);
  shell.card(cardNode, { label });
}
function openShop(tab) {
  tipOnce('shop', TIPS.shop);
  openCard((close) => shopCard({
    career: c, tab,
    onBuy(id) { const d = buy(c, id); if (!d) { sfx.nope(); return; } sfx.buy(); flush(); if (Math.random() < 0.4) speak(say('bought')); persist(); },
    onPlace(id) { close(); startPlacing(id, { from: 'inv' }); },
    onMove() { const h = moveHome(c); if (h) { flush(); resetHer(); persist(); } },
    onClose: close,
  }), 'Shop');
}
function openPerks() {
  if (mode !== 'hub') return;
  openCard((close) => perksCard({ career: c, onBuy: (id) => { if (buyPerk(c, id)) { sfx.perk(); speak(say('perk')); flush(); persist(); } }, onClose: close }), 'Skills');
}
function openCollection() { openCard((close) => collectionCard({ career: c, onClose: close }), 'Collection'); }
function openMore() {
  openCard((close) => moreCard({
    career: c, onClose: close,
    onPick(id) {
      close();
      if (id === 'perks') openPerks();
      else if (id === 'quests') openCard((cl) => questsCard({ career: c, onClose: cl }), 'Quests');
      else if (id === 'board') openCard((cl) => boardCard({ career: c, onClose: cl }), 'Trending');
      else openCard((cl) => recordsCard({ save, onClose: cl, onReset: resetCareer }), 'Records');
    },
  }), 'More');
}
function openMysteryBox(uid) {
  const b = c.mystery.find((x) => x.uid === uid);
  if (!b) return;
  sfx.pick();
  openCard((close) => mysteryCard({
    box: b,
    onShake: () => sfx.shake(),
    onOpen() {
      const r = openMystery(c, uid);
      if (!r) return null;
      sfx.reveal(r.rarity);
      speak(say('opened', r.rarity), 3600);
      flush(); persist();
      return r;
    },
    onPlace(id) { close(); startPlacing(id, { from: 'inv' }); },
    onClose: close,
  }), boxOf(b.tier).name);
}
function makeVideo(k) {
  const u = startVideo(c, k);
  if (!u) { sfx.nope(); shell.toast('Her channel’s busy: wait for this video, or get a second channel in Skills', 'info', 2400); return; }
  flush();
  persist();
}
function resetCareer() {
  save = fresh((Date.now() >>> 0) || 1); c = save.career;
  persist(); shell.closeCard(); cardNode = null; endPlacing(); stopEdit(); resetHer();
  toTitle();
}

// ---------- placing a thing ----------
function startPlacing(id, { uid = null, from = 'inv' } = {}) {
  const it = uid != null ? c.items.find((t) => t.uid === uid) : null;
  const spot = it ? { x: it.x, y: it.y, on: it.on ?? null } : autoSpot(c, id);
  if (!spot && !it) { shell.toast(say('full'), 'warn', 2400); sfx.nope(); return false; }
  placing = { id, uid, from, x: spot.x, y: spot.y, on: spot.on ?? null, flip: it ? it.flip : false, ok: true };
  check();
  ui.edit(false);
  const G = roomGeom(homeOf(c));
  panTo(R, cellX(G, spot.x + itemOf(id).w / 2 - 0.5), { ifHidden: true }); lastPan = 0;
  tipOnce('place', TIPS.place, 5000);
  return true;
}
function check() { if (placing) placing.ok = canPlace(c, placing.id, placing.x, placing.y, { on: placing.on, ignore: placing.uid }).ok; refreshPlaceBar(); }
// her last desk stays: she records at it
const lastDesk = (uid) => {
  const it = uid != null && c.items.find((t) => t.uid === uid);
  return Boolean(it && itemOf(it.id).desk && c.items.filter((t) => itemOf(t.id).desk && layer(t) === 'floor').length <= 1);
};
function refreshPlaceBar() { if (!placing) { ui.place(null); return; } const def = itemOf(placing.id); ui.place({ name: def.name, ok: placing.ok, canStore: !lastDesk(placing.uid), flat: def.place === 'flat' }); }
function endPlacing() { placing = null; drag = null; edgeP = null; ui.place(null); }
function placeOk() {
  if (!placing) return;
  if (!placing.ok) { sfx.nope(); speak(say('full')); return; }
  const p = placing;
  if (p.uid != null) {
    const it = c.items.find((t) => t.uid === p.uid);
    if (it && roomMove(c, p.uid, p.x, p.y, { on: p.on })) { it.flip = p.flip; const pt = A.pets.get(p.uid); if (pt) { pt.x = p.x; pt.y = p.y; pt.route = []; } }
  } else if (!placeFromInv(c, p.id, p.x, p.y, { flip: p.flip, on: p.on })) { sfx.nope(); return; }
  sfx.place();
  const it = c.items.find((t) => (p.uid != null ? t.uid === p.uid : t.id === p.id && t.x === p.x));
  if (it) { const at = itemAt(R, c, it); fx.sparkle(R, at.x, at.y); bump(R, it.uid); }
  if (Math.random() < 0.45) speak(say('placed'));
  endPlacing(); flush(); persist();
  if (editing) ui.edit(true);
}
function placeStore() {
  if (!placing) return;
  if (lastDesk(placing.uid)) { sfx.nope(); shell.toast('She records at her desk: put another desk in first', 'info', 2400); return; }
  if (placing.uid != null) { roomStore(c, placing.uid); A.pets.delete(placing.uid); speak(say('stored')); }
  endPlacing(); sfx.pick(); persist();
  if (editing) ui.edit(true);
}
function startEdit() { editing = true; endPlacing(); ui.edit(true); sfx.pick(); }
function stopEdit() { editing = false; endPlacing(); ui.edit(false); }

// ---------- her room: drag it sideways, tap what’s in it ----------
const pos = (e) => { const s = shell.stage.getBoundingClientRect(); return { x: e.clientX - s.left, y: e.clientY - s.top }; };
ui.view.addEventListener('pointerdown', (e) => {
  if (mode !== 'hub' || shell.state !== 'play' || cardOpen() || e.button > 0 || bot) return;
  if (e.target.closest('button')) return;
  const p = pos(e);
  drag = { x0: p.x, y0: p.y, lx: p.x, lt: performance.now(), vx: 0, moved: false, id: e.pointerId, touch: e.pointerType === 'touch' };
  try { ui.view.setPointerCapture(e.pointerId); } catch { /* fine */ }
  if (placing) { moveGhost(p, drag.touch); edgeP = p; e.preventDefault(); }
});
ui.view.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = pos(e);
  if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) > 8) { drag.moved = true; if (!placing) { ui.root.classList.add('is-dragging'); R.pan.held = true; } }
  if (placing) { moveGhost(p, drag.touch); edgeP = p; e.preventDefault(); return; }
  if (drag.moved) {
    const now = performance.now(), dx = p.x - drag.lx, dt = Math.max(1, now - drag.lt);
    panBy(R, dx); lastPan = 0;
    drag.vx = drag.vx * 0.5 + ((dx / dt) * 1000) * 0.5; drag.lx = p.x; drag.lt = now;
  }
});
const up = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null; edgeP = null;
  ui.root.classList.remove('is-dragging'); R.pan.held = false;
  if (placing) return;
  if (!d.moved) tapRoom(pos(e));
  else if (performance.now() - d.lt < 90) fling(R, d.vx);
};
ui.view.addEventListener('pointerup', up);
ui.view.addEventListener('pointercancel', () => { drag = null; edgeP = null; ui.root.classList.remove('is-dragging'); R.pan.held = false; });
ui.view.addEventListener('wheel', (e) => {
  if (mode !== 'hub' || cardOpen()) return;
  const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (!dx) return;
  panBy(R, -dx * (e.deltaMode === 1 ? 16 : 1)); lastPan = 0;
  e.preventDefault();
}, { passive: false });
function moveGhost(p, touch) {
  const g = ghostAt(R, c, placing.id, p.x, p.y - (touch ? 26 : 0)), def = itemOf(placing.id), home = homeOf(c);
  // it stays in her room (dragged past the edge, it waits at the edge while the room scrolls)
  if (def.place !== 'top') { g.x = clamp(g.x, 0, home.cols - def.w); g.y = clamp(g.y, 0, (def.place === 'wall' ? home.wall : home.rows) - def.h); }
  if (g.x !== placing.x || g.y !== placing.y || g.on !== placing.on) { placing.x = g.x; placing.y = g.y; placing.on = g.on ?? null; check(); }
}
function tapRoom(p) {
  const h = hitAt(R, p.x, p.y, editing ? ['item', 'pet', 'drone', 'bot'] : ['drone', 'bot', 'pet', 'her', 'item']);
  if (!h) return;
  if (h.kind === 'drone') { const g = catchDrone(c); if (g) { fx.sparkle(R, p.x, p.y); A.drone = null; } flush(); return; }
  if (h.kind === 'bot') { if (zap(c, h.id)) { fx.poof(R, p.x, p.y); A.bots.delete(h.id); } flush(); return; }
  if (editing && (h.kind === 'item' || h.kind === 'pet')) { const it = c.items.find((t) => t.uid === h.uid); if (it) { startPlacing(it.id, { uid: it.uid, from: 'move' }); sfx.pick(); } return; }
  if (h.kind === 'pet') {
    const n = pet(c); sfx.pet(); bump(R, h.uid); fx.hearts(R, p.x, p.y, 6);
    if (n) fx.word(R, p.x, p.y - 20, `+${fmt(n)}`, '#ffffff', 16);
    requestUse(A, c, h.uid);
    if (Math.random() < 0.3) speak(say('pet'));
    flush(); return;
  }
  if (h.kind === 'her') { speak(say('tap')); A.her.cheer = 0.6; sfx.pick(); return; }
  if (h.kind === 'item') tapThing(h.uid, p);
}
// a thing tapped: it bounces, she says something about it, and (if she’s free) she goes and uses it
function tapThing(uid, p) {
  const it = c.items.find((t) => t.uid === uid);
  if (!it) return;
  const def = itemOf(it.id);
  bump(R, uid);
  sfx.thing(def.place === 'top' || def.w * def.h <= 1);
  fx.sparkle(R, p.x, p.y, ['#ffffff', '#ffd84a']);
  speak(pick(linesOf(it.id)), 2600);
  if (def.use && !def.desk) requestUse(A, c, uid);
  tipOnce('room', TIPS.room);
}
function tapDelivery(uid) {
  const d = c.deliveries.find((x) => x.uid === uid);
  if (!d) return;
  const p = ui.boxesAt();
  if (boxLeft(c, d) > 0) { tapBox(c, uid); sfx.boxTap(); fx.word(R, p.x, p.y - 12, `${Math.ceil(boxLeft(c, d))}s`, '#ffd84a', 14); return; }
  const id = openBox(c, uid);
  if (!id) return;
  sfx.box(); fx.confetti(R, p.x, p.y);
  if (editing) stopEdit();
  flush();
  startPlacing(id, { from: 'box' });
}

// ---------- what happened ----------
function flush(quiet = false) {
  for (const e of drain(c)) {
    const her = herAt();
    switch (e.type) {
      case 'start': if (!quiet) { sfx.record(); if (Math.random() < 0.35) speak(say('record')); } break;
      case 'video': {
        if (quiet) break;
        const u = e.upload;
        sfx.video(u.viral);
        fx.word(R, her.x, her.y - 10, `+${fmt(u.views)} 👁`, '#ffffff', 20);
        setTimeout(() => fx.word(R, her.x, her.y + 10, `+${fmt(u.followers)} 👥`, '#ffd84a', 18), 250);
        if (u.viral) { sfx.viral(); fx.confetti(R, her.x, her.y); speak(say('viral'), 3600); shell.toast(`“${u.title}” went viral! ×${TUNE.video.viralX}`, 'good', 3000); }
        else if (u.trend && Math.random() < 0.3) speak(say('trend')); else if (Math.random() < 0.25) speak(say('video'));
        if (!c.uploads.length) A.her.cheer = 1.1;
        if (DEMO) demoGap = 6.5;
        if (c.videos === 1) tipOnce('room', TIPS.room);
        if (liveReady(c) && c.live === liveNeed(c)) tipOnce('live', TIPS.live);
        break;
      }
      case 'level': {
        sfx.level();
        const bits = [`Level ${e.level}!`, `💡 +${e.points}`, e.level % 5 === 0 ? '🎁 gold box' : '🎁 box'];
        if (e.topic) bits.push(`${e.topic.icon} ${e.topic.name} videos open`);
        if (e.items) bits.push(`${e.items} new thing${e.items === 1 ? '' : 's'} in the shop`);
        shell.toast(bits.join(' · '), 'good', 3400);
        speak(e.topic ? say('topic') : say('level'));
        if (c.points) tipOnce('perks', TIPS.perks);
        break;
      }
      case 'mystery': {
        if (quiet) break;
        const why = e.box.why;
        if (why === 'daily') { sfx.mystery(); shell.toast(`🎁 Box of the day: a ${boxOf(e.box.tier).name.toLowerCase()}`, 'good', 3000); if (c.videos) speak(say('daily')); }
        else if (why === 'quest' || why === 'set') sfx.mystery();
        tipOnce('mystery', TIPS.mystery);
        break;
      }
      case 'set': sfx.set(); shell.toast(`⭐ Set complete: ${e.set.name}! ${topicOf(e.set.topic).icon} ${topicOf(e.set.topic).name} videos +${Math.round(TUNE.sets.bonus * 100)}% · 🎁 gold box`, 'good', 4200); speak(say('set'), 3400); { const s = herAt(); fx.confetti(R, s.x, s.y); } break;
      case 'quest': if (!quiet) { sfx.quest(); shell.toast(`Quest done: ${questText(e.quest)} · 👁 +${fmt(e.quest.reward.views)}${e.quest.reward.point ? ' · 💡 +1' : ''}${e.quest.reward.box ? ' · 🎁' : ''}`, 'good', 2800); } break;
      case 'drone': startDrone(A); sfx.drone(); break;
      case 'droneGone': if (A.drone && Math.random() < 0.3) speak(say('missMail')); break;
      case 'mail': sfx.mail(); shell.toast(`Fan mail: ${giftText(e.gift)}`, 'good', 2600); speak(say('mail')); break;
      case 'bot': addBot(A, c, e.bot.id); if (A.bots.size === 1 && !quiet) speak(say('bots')); break;
      case 'botGone': botLeaves(A, e.bot.id); break;
      case 'zapped': sfx.zap(); if (Math.random() < 0.3) speak(say('zap')); break;
      case 'arrived': if (!quiet) { sfx.box(); if (Math.random() < 0.5) speak(say('box')); tipOnce('box', TIPS.box); } break;
      case 'award': shell.toast(`🏆 ${e.award.name}! Its plaque is in her things: hang it up`, 'good', 3200); speak(say('award')); break;
      case 'homeReady': shell.toast(`🏠 She can move to the ${e.home.name}: it’s in the Shop`, 'good', 3200); speak(say('homeReady')); break;
      case 'home': sfx.move(); { const s = herAt(); fx.confetti(R, s.x, s.y); } speak(say('moved')); break;
      case 'passed': if (!quiet) {
        const top = e.rivals[e.rivals.length - 1];
        shell.toast(`📈 Passed ${top.name}! #${e.rank} trending`, 'good', 2600);
        if (e.rank === 1) { speak(say('number1'), 5000); fx.confetti(R, her.x, her.y); }
      } break;
      default: break;
    }
  }
  if (!DEMO && !QA) { const got = earned(save); got.forEach((s, i) => setTimeout(() => { shell.toast(`Sticker: ${s.name}`, 'good', 2400); sfx.award(); }, 600 + i * 900)); }
}
// what she started or finished doing with her things
function flushActors() {
  for (const e of drainActors(A)) {
    if (e.type !== 'use') continue;
    const u = useOf(e.kind);
    if (!u) continue;
    if (mode === 'hub' && !DEMO) sfx.use(u.sfx);
    if (u.outfit) { c.outfit = (c.outfit + 1) % OUTFITS.length; if (mode === 'hub') { const s = herAt(); fx.sparkle(R, s.x, s.y + 12, ['#ff4da6', '#ffd84a', '#ffffff']); } }
    if (u.confetti && mode === 'hub') { const s = herAt(); fx.confetti(R, s.x, s.y); }
    if ((e.kind === 'hug' || e.kind === 'pet') && mode === 'hub') { const s = herAt(); fx.hearts(R, s.x, s.y + 6, 5); }
    if (mode === 'hub' && Math.random() < (DEMO ? 0.7 : 0.4)) speak(pick(USE_LINES[e.kind] || ['']), 2600);
  }
}

// ---------- going live (a minute of her stream) ----------
const seedNow = () => (SEED ? SEED * 7919 + c.totals.live * 31 : (Date.now() ^ (c.totals.live * 2654435761)) >>> 0);
function startLive(topic = null) {
  endPlacing(); stopEdit();
  const L = liveStart(c, topic || undefined);
  if (!L) return;
  info = new Map();
  S = createStream({ cat: L.topic, v0: L.v0, busy: L.busy, followers: c.followers, seed: seedNow() });
  mode = 'live'; keysAfter = performance.now() + 250;
  ui.mode('live'); ui.live.reset(S.viewers); ui.hideTip(); tipUntil = 0;
  shell.started({ count: !QA && !DEMO });
  sfx.goLive(); music.play('live');
  speak(say('start', L.topic), 3400);
  chatT = 0.3;
  if (bot) resetPlayer(bot);
  tipOnce('stream', TIPS.stream, 7500, 'live');
}
let chatT = 0;
const chatRate = (v) => Math.min(8, 0.9 + Math.log10(v + 1) * 1.55);
function chatter() { const n = Math.floor(Math.random() * 1e6); ui.live.msg({ name: nameOf(n), color: colorOf(n), text: chatLine(S.cat, n >> 3) }); sfx.msg(); }
function flushLive() {
  if (!S) return;
  for (const e of drainStream(S)) {
    const x = e.target;
    if (e.type === 'spawn') {
      let i = {};
      if (x.kind === 'ask') { const n = x.why * 7 + S.seed, q = askOf(S.cat, x.why); i = { name: nameOf(n), color: colorOf(n), text: q.q, answer: q.a }; sfx.ask(); }
      else if (x.kind === 'bot') { i = { name: botName(x.why), text: botLine(x.why) }; sfx.bot(); }
      else if (x.kind === 'raid') { i = { text: raidLine(x) }; sfx.ask(); }
      else if (x.kind === 'tech') { i = techOf(x.why, c.items.some((t) => t.id === 'cat')); sfx.tech(); }
      else if (x.kind === 'big') { i = { text: topicOf(S.cat).mash }; sfx.bigStart(); }
      info.set(x.id, i);
      ui.live.add(x, i);
    } else if (e.type === 'hit') {
      const i = info.get(x.id) || {}, at = ui.whereOf(x.id), r = ui.rect(), mid = { x: r.x + r.w / 2, y: r.y + r.h * 0.45 };
      ui.live.settle(x.id, true, i);
      if (x.kind === 'ask') { sfx.answer(); speak(i.answer, 2600); fx.hearts(R, mid.x, mid.y, 6); }
      else if (x.kind === 'bot') { sfx.ban(); fx.poof(R, at.x, at.y); if (Math.random() < 0.35) speak(say('ban')); }
      else if (x.kind === 'raid') { sfx.raid(); fx.confetti(R, mid.x, mid.y - 30); fx.word(R, mid.x, mid.y - 60, `+${full(x.size)} viewers`, '#ffd84a', 26); speak(say('raid')); }
      else if (x.kind === 'tech') { sfx.fix(); speak(say('fix')); }
      else if (x.kind === 'heart') { sfx.heart(); fx.hearts(R, at.x, at.y, 10); fx.word(R, at.x, at.y - 20, `+${fmt(e.gain)}`, '#ffffff', 18); }
      else if (x.kind === 'clip') { sfx.clip(); fx.sparkle(R, at.x, at.y); fx.word(R, at.x, at.y - 24, 'CLIPPED!', '#ffd84a', 24); speak(say('clip')); }
      else if (x.kind === 'big') { sfx.bigWin(); fx.confetti(R, mid.x, mid.y); speak(say('big')); }
      if (e.combo && e.combo % 10 === 0) { sfx.combo(); speak(say('combo'), 2200); }
    } else if (e.type === 'miss' || e.type === 'gone') {
      ui.live.settle(x.id, false, info.get(x.id) || {});
      if (e.type === 'miss') {
        if (x.kind === 'raid') speak(say('raidMiss'));
        else if (x.kind === 'tech') speak(say('techMiss'));
        else if (x.kind === 'big') { sfx.bigMiss(); speak(say('bigMiss')); }
        else sfx.miss();
      }
    } else if (e.type === 'bigtap') { ui.live.bigTap(x.id, e.taps, x.need); sfx.bigTap(e.taps / x.need); }
  }
}
function endLive() {
  const r = S.over, prevPeak = c.peak;
  const gained = liveDone(c, r);
  if (!DEMO && !QA) save.played++;
  if (!DEMO && !QA) earned(save, r);
  flush();
  persist();
  sfx.end(); music.play('room');
  if (DEMO || QA_AUTO) { setTimeout(() => enterHub({ quiet: true }), 900); return; }
  const rank = rankOf(c.followers);
  shell.over({
    title: 'Stream over', score: r.peak, label: `peak viewers · ${topicOf(r.cat).name}`,
    best: c.totals.live > 1 ? Math.max(prevPeak, r.peak) : null, isBest: r.peak > prevPeak && c.totals.live > 1,
    stats: [['New followers', `+${full(gained.followers)}`], ['Views', `+${fmt(gained.views)}`], ['Answered', `${r.stats.answered}/${r.stats.asked}`], ['Bots banned', `${r.stats.banned}/${r.stats.bots}`]],
    line: endLine(r), share: liveShare(r, rank),
    extra: overExtra({ result: r, gained }),
    again: 'Back to her room', onAgain: () => enterHub({ quiet: true }), onMenu: () => { S = null; mode = 'title'; toTitle(); },
  });
}

// ---------- the keys ----------
// (the kit’s own Space / Enter, which starts from the title and acts on the end card, lands first: the same key press
// never also reaches these: `keysAfter`)
let keysAfter = 0;
const busy = () => shell.state !== 'play' || Boolean(bot) || cardOpen() || performance.now() < keysAfter;
keyboard({ ' ': 'act', Enter: 'act' }, {
  blocked: () => busy() || Boolean(document.activeElement?.closest?.('button, a, input, .ak-bar, .ak-layer')),
  down() {
    if (mode === 'hub' && placing) { placeOk(); return; }
    if (mode === 'live' && S && !S.over) {
      const big = S.targets.find((x) => x.kind === 'big');
      const x = big || [...S.targets].sort((a, b) => (a.life - a.age) - (b.life - b.age))[0];
      if (x) { tap(S, x.id); flushLive(); }
    }
  },
});
keyboard({ 1: 'i1', 2: 'i2', 3: 'i3', s: 'shop', d: 'edit', l: 'live', c: 'book', z: 'zoom', f: 'flip', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Backspace: 'store', Delete: 'store' }, {
  blocked: busy,
  down(name) {
    if (mode !== 'hub') return;
    if (placing) {
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[name];
      if (d) {
        const def = itemOf(placing.id);
        placing.x += d[0];
        if (def.place === 'top') { const G = roomGeom(homeOf(c)), at = toScreen(R, cellX(G, placing.x + def.w / 2 - 0.5), G.floorTop + (placing.y + d[1] * 2) * ROW); const g = ghostAt(R, c, placing.id, at.x, at.y); placing.x = g.x; placing.y = g.y; placing.on = g.on ?? null; }
        else placing.y += d[1];
        check();
        panTo(R, cellX(roomGeom(homeOf(c)), placing.x + def.w / 2 - 0.5), { ifHidden: true }); lastPan = 0;
        return;
      }
      if (name === 'flip') { placing.flip = !placing.flip; return; }
      if (name === 'store') { placeStore(); return; }
      return;
    }
    if (name === 'left' || name === 'right') { R.pan.target = (R.pan.target ?? R.pan.x) + (name === 'left' ? -1 : 1) * R.vw * 0.4; lastPan = 0; return; }
    if (name[0] === 'i') makeVideo(Number(name[1]) - 1);
    else if (name === 'shop') openShop();
    else if (name === 'edit') editing ? stopEdit() : startEdit();
    else if (name === 'book') openCollection();
    else if (name === 'zoom') { R.fit = !R.fit; ui.zoomed(R.fit); }
    else if (name === 'live') (liveReady(c) ? startLive() : sfx.nope());
  },
});

// ---------- the clock ----------
function tick_(dt) {
  if (mode === 'hub' || mode === 'live') {
    tick(c, dt, { events: mode === 'hub' });
    if (mode === 'hub') flush();
  }
  if (mode === 'hub' && bot) autoplay(dt);
  if (mode === 'live' && S && !S.over) {
    if (bot) playStep(bot, S, dt);
    step(S, dt);
    flushLive();
    chatT -= dt;
    if (chatT <= 0) { chatT = (1 / chatRate(S.viewers)) * (0.6 + Math.random() * 0.8); chatter(); }
    music.hype(S.hype / 100);
    ui.live.count(Math.round(S.viewers));
    if (S.over) endLive();
  }
  updateActors(A, c, dt, { live: mode === 'live', night: night() });
  flushActors();
  if (mode === 'hub') {
    // the room follows her when you haven’t looked round for a few seconds
    lastPan += dt;
    if ((DEMO || lastPan > 5) && !placing && !drag) panTo(R, cellX(roomGeom(homeOf(c)), A.her.x), { ifHidden: true });
    // dragging a thing to the edge: the room scrolls that way
    if (placing && edgeP) {
      const r = ui.rect(), band = R.band, left = r.x + 44, right = r.x + r.w - (band.right || 0) - 44;
      const dir = edgeP.x < left ? 1 : edgeP.x > right ? -1 : 0;
      if (dir) { panBy(R, dir * 260 * dt); moveGhost(edgeP, drag?.touch); }
    }
    if (!cardOpen() && !placing) {
      idleT -= dt;
      if (idleT <= 0) { idleT = 18 + Math.random() * 12; if (!c.uploads.length && !A.her.task) speak(say('idle')); }
    }
  }
  pumpTips();
  update(R, dt);
  saveT -= dt;
  if (saveT <= 0) { saveT = 5; persist(); }
}
// the game’s own player (the tile’s preview, `&auto=`): ideas, boxes, the drone and the bots, now and then the shop.
// The preview leaves her a few seconds between videos to live in her room.
function autoplay(dt) {
  demoT -= dt; demoGap -= dt;
  const slots = 1 + (c.perks.slot2 || 0) + (c.perks.slot3 || 0);
  if (!DEMO || demoGap <= 0) while (c.uploads.length < slots) { if (!startVideo(c, pickIdea(c, bot))) break; flush(); if (DEMO) break; }
  if (A.drone && droneAt(A) > 0.4 && Math.random() < dt * 2) { catchDrone(c); A.drone = null; flush(); }
  for (const b of [...A.bots.values()]) {
    if (b.leaving || b.x < 0.5 || Math.random() > dt * 0.7) continue;
    const G = roomGeom(homeOf(c)), at = toScreen(R, cellX(G, b.x), G.floorTop + (b.y + 0.5) * ROW);
    fx.poof(R, at.x, at.y); zap(c, b.id); A.bots.delete(b.id); flush();
  }
  for (const d of [...c.deliveries]) if (boxLeft(c, d) <= 0) { const id = openBox(c, d.uid), at = id && autoSpot(c, id); if (at) placeFromInv(c, id, at.x, at.y, { on: at.on }); flush(); }
  if (!DEMO) for (const b of [...c.mystery]) { const r = openMystery(c, b.uid), at = r && autoSpot(c, r.id); if (at) placeFromInv(c, r.id, at.x, at.y, { on: at.on }); flush(); }
  if (demoT <= 0) {
    demoT = DEMO ? 2.2 : 8;
    const id = !DEMO && pickBuy(c, bot); if (id) { buy(c, id); flush(); }
    if (liveReady(c) && QA_AUTO) startLive();
  }
}
function titleRect() {
  const box = shell.stage.getBoundingClientRect(), top = shell.bar.getBoundingClientRect().bottom - box.top;
  return { x: 0, y: Math.max(0, top), w: box.width, h: box.height - Math.max(0, top) };
}
function frame() {
  if (mode === 'hub') { bandT -= 1; if (ui.bandDirty() || bandT <= 0) { bandT = 30; setRect(R, ui.rect(), ui.band()); } else setRect(R, ui.rect()); }
  else setRect(R, mode === 'title' ? titleRect() : ui.rect());
  draw(R, c, A, {
    night: night(), edit: editing && !placing, picked: placing?.uid ?? null, outfit: c.outfit,
    ghost: placing ? { id: placing.id, x: placing.x, y: placing.y, on: placing.on, flip: placing.flip, ok: placing.ok } : null,
    happy: Boolean(S && S.combo >= 10),
  }, mode === 'title' ? 'title' : mode === 'live' ? 'live' : 'room');
  if (mode === 'live' && S) ui.live.hud({ viewers: S.viewers, hype: S.hype, combo: S.combo, t: S.t, dur: S.dur });
  if (mode === 'hub') { const h = herAt(), r = ui.rect(); ui.sayAt(h.x - r.x, h.y - r.y - 4, (R.band.top || 0) + 4); }
  fChip.set(c.followers); vChip.set(Math.floor(c.views));
  if (mode === 'hub') { hubT -= 1 / 60; if (hubT <= 0) { hubT = 0.2; ui.hub(c); } }
}

// ---------- the title ----------
function toTitle() {
  S = null; mode = 'title';
  ui.mode('title');
  music.stop();
  shell.title({
    logo: ['GOING', { text: 'LIVE', tone: 'accent' }],
    tagline: 'AGI-1 just started streaming. Zero followers, one bare bedroom. Make her videos, fill her room, take her to #1.',
    play: c.videos ? 'Continue' : 'Play',
    onPlay: () => enterHub(),
    extra: c.videos ? titleExtra({ onRecords: () => openCard((close) => recordsCard({ save, onClose: () => { close(); toTitle(); }, onReset: resetCareer }), 'Records') }) : null,
    best: null,
    fine: 'Made-up streamers, chat and numbers · no wallet needed · her career stays on this device',
  });
}

// her old videos kept earning while the page was hidden. (The kit pauses the game when the tab’s hidden: "While you
// were away" waits for Resume, so it never covers the pause card.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); persist(); return; }
  if (!hiddenAt || QA || DEMO) return;
  const secs = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
  if (mode !== 'hub' || secs < 5) return;
  const before = c.videos, g = comeBack(c, secs);
  flush(true);
  if (g.counted >= TUNE.idle.min && g.views >= 1) {
    const w = awayWaiting;
    awayWaiting = w ? { gain: { views: w.gain.views + g.views, counted: w.gain.counted + g.counted, capped: w.gain.capped || g.capped }, done: w.done + c.videos - before } : { gain: g, done: c.videos - before };
    showAway();
  }
  if (save.daily !== today()) { save.daily = today(); grantBox(c, 'silver', 'daily'); flush(); }
  persist();
});
function showAway() {
  if (!awayWaiting || mode !== 'hub' || shell.state !== 'play' || cardOpen()) return;
  const w = awayWaiting;
  awayWaiting = null;
  openCard((close) => awayCard({ gain: w.gain, done: w.done, onClose: close }), 'While you were away');
}
addEventListener('pagehide', () => persist());

const loop = createLoop({ step: 1 / 60, update: tick_, render: frame, paused: () => shell.state === 'pause' || (shell.state === 'over' && !DEMO), speed: () => qaSpeed });
if (QA) {
  window.__gl = {
    get c() { return c; }, get save() { return save; }, get mode() { return mode; }, get A() { return A; }, get placing() { return placing; }, get S() { return S; }, get card() { return cardOpen(); },
    speed(n) { qaSpeed = clamp(Number(n) || 1, 0.25, 32); }, enterHub, startLive, startPlacing, openShop, openMysteryBox, tapThing, R, ui,
    grant(tier = 'bronze') { const b = grantBox(c, tier, 'qa'); flush(); return b.uid; },
    use(id) { const it = c.items.find((t) => t.id === id); return Boolean(it && requestUse(A, c, it.uid)); },
  };
}
loop.start();
if (DEMO) {
  bot = createPlayer('demo', SEED || 7); shell.started({ count: false }); mode = 'hub'; ui.mode('hub'); music.play('room');
  // she dances until her next video calls her to her desk (`demoGap`), then lives in her room between videos
  demoGap = 5.4;
  const G = roomGeom(homeOf(c)), floor = c.items.find((t) => t.id === 'dancefloor');
  if (floor) { A.her.x = floor.x + 1; A.her.y = floor.y; R.pan.x = cellX(G, floor.x) - 100; requestUse(A, c, floor.uid); }
}
else if (QA && QUERY.has('live')) { if (QA_AUTO) bot = createPlayer(QA_AUTO, SEED || 3); c.live = 99; enterHub({ quiet: true }); startLive(); }
else if (QA && (QUERY.has('hub') || QA_AUTO)) { if (QA_AUTO) bot = createPlayer(QA_AUTO, SEED || 3); enterHub({ quiet: true }); }
else toTitle();
void REDUCED; void got;
