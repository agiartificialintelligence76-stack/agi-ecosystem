// GOING LIVE: AGI-1 just started streaming. Zero followers, one bare bedroom. Pick a video idea (two topics; trending
// ones get more) and she makes it at her desk while the clock runs down; the views buy things for her room, which come in
// boxes you tap open and drag where you like; every thing helps some topics, so her room makes her videos better. Level
// up for skills, do quests, catch the fan-mail drone, zap the spam bots, go live when the meter's full (a minute of her
// stream, played live), move to bigger homes and climb the board of made-up streamers to #1. Her old videos keep earning
// while you're away. (The owner, 2026-11-14: "yes exactly" to an AGI-1 version of a famous YouTuber's streamer game, ours
// in every way; then "Rebuild both" (its mechanics and its look) and "Short waits".) Made up and kept on this device: no
// wallet, no money, nothing to buy.
//
// The rules are ./econ.js (her career), ./room.js (her room's grid) and ./stream.js (a live stream), pure; ./ai.js plays
// them (the tile's preview, the balance tool, the tests); this file is the page.
import './style.css';
import { createShell } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY, REDUCED } from '../kit/env.js';
import { clamp } from '../kit/fx.js';
import { itemOf, topicOf, TUNE, RIVALS, HOMES } from './data.js';
import {
  tick, drain, startVideo, newIdeas, buy, openBox, tapBox, boxLeft, placeFromInv, autoSpot, moveHome, buyPerk, liveReady, liveNeed, liveStart, liveDone,
  catchDrone, zap, pet, comeBack, awayGain, rankOf, idleRate,
} from './econ.js';
import { canPlace, move as roomMove, store as roomStore, layer } from './room.js';
import { createStream, step, tap, drain as drainStream } from './stream.js';
import { createPlayer, playStep, resetPlayer, pickIdea, pickBuy, PROFILES } from './ai.js';
import { fresh, load, saveOf, earned } from './progress.js';
import { nameOf, colorOf, chatLine, askOf, botLine, botName, raidLine, techOf, say, TIPS, endLine, liveShare, giftText, questText } from './lines.js';
import { createActors, update as updateActors, addBot, botLeaves, startDrone, droneAt } from './actor.js';
import { createRenderer, setRect, update, draw, toScreen, hitAt, ghostAt, fx } from './render.js';
import { roomGeom, CELL, ROW } from './pixel.js';
import { createUI, shopCard, perksCard, questsCard, boardCard, recordsCard, awayCard, overExtra, titleExtra, fmt, full } from './ui.js';
import { createSound } from './sound.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'goinglive', name: 'GOING LIVE', root,
  howTo: {
    intro: 'AGI-1 just started streaming: zero followers, one bare bedroom. Make her videos, fill her room and take her to #1 trending.',
    steps: [
      ['Make videos', 'Tap one of her three video ideas. She records it at her desk while the clock runs down, then the views and new followers come in.'],
      ['Ride the trends', 'Each idea has two topics. Ideas about a trending topic (🔥) get more, two trending topics much more.'],
      ['Fill her room', 'Spend views in the Shop. Things come in a box: tap it open, drag the thing where you like, tap ✓. Every thing helps the topics shown on it: a better room makes better videos.'],
      ['Level up', 'Every level opens new things in the Shop (and new topics now and then) and gives an idea point 💡 for Skills.'],
      ['Go live', 'Her videos fill the live meter. When it’s full, go live: a minute of her stream to play (answer chat, ban bots, welcome raids, fix problems). A good stream is the fastest way to grow.'],
      ['Little visitors', 'Tap the fan-mail drone for a gift, zap the spam bots, pet her cat. Her old videos keep earning while you’re away.'],
    ],
    touch: [['Tap', 'Ideas, boxes, the drone, bots, her cat'], ['Drag', 'A thing to its place']],
    keys: [['1–3', 'Make that idea'], ['S', 'Shop'], ['D', 'Decorate'], ['L', 'Go live'], ['Arrows · Enter · F', 'Move, place, flip a thing'], ['Space / Enter (live)', 'Take the most urgent thing'], ['Esc / P', 'Pause']],
  },
  onPause() { persist(); },
  onRestart() { if (mode === 'live' && S) startLive(S.cat, { again: true }); else if (mode !== 'title') enterHub({ quiet: true }); },
  onQuit() { S = null; endPlacing(); mode = 'title'; ui.mode('title'); persist(); queueMicrotask(toTitle); },
});

const canvas = document.createElement('canvas');
canvas.className = 'gl-canvas';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'AGI-1’s room, in pixel art: her desk, her things, and her');
const topCanvas = document.createElement('canvas');
topCanvas.className = 'gl-top';
topCanvas.setAttribute('aria-hidden', 'true');
shell.stage.append(canvas);
const R = createRenderer(canvas, topCanvas);
const { sfx, music } = createSound(shell.audio);
const fChip = shell.chip('Followers', 0, { accent: true, fmtFn: fmt });
const vChip = shell.chip('Views', 0, { fmtFn: fmt });
fChip.node.classList.add('gl-chip-f'); vChip.node.classList.add('gl-chip-v');

// `?qa` (browser tests only): the game's state readable from the page, `&speed=n`, `&auto=good` (the game's own player),
// `&live` to go live at once, `&f=` followers, `&level=`, `&home=`, `&views=`, `&night` / `&day`. Nothing saved or counted.
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
  if (Number.isFinite(h) && h > 0) c.home = Math.min(3, h);
  if (Number.isFinite(v) && v > 0) c.views = v;
  for (const id of (QUERY.get('items') || '').split(',').filter(Boolean)) if (itemOf(id)) { c.inv[id] = (c.inv[id] || 0) + 1; const at = autoSpot(c, id); if (at) placeFromInv(c, id, at.x, at.y, { on: at.on }); }
  drain(c);
}
let c = save.career;
const persist = () => QA || DEMO || shell.store.update((d) => Object.assign(d, saveOf({ ...save, at: Date.now() })));
// the tile's preview: a few weeks in (the studio flat, a cosy room)
function showcase() {
  const k = fresh(SEED || 7).career;
  k.followers = 26000; k.views = 90000; k.level = 13; k.home = 1; k.videos = 70;
  for (const id of ['pc', 'monitor', 'gamerchair', 'rug', 'lamp', 'bookshelf', 'monstera', 'cat', 'gameposter', 'neon', 'mic', 'webcam', 'cactus', 'bear', 'sofa', 'aquarium', 'tv', 'clock', 'pottedplant', 'starposter']) {
    k.inv[id] = (k.inv[id] || 0) + 1; const at = autoSpot(k, id); if (at) placeFromInv(k, id, at.x, at.y, { on: at.on });
  }
  // two videos on the go, one nearly done (the loop shows one land, her cheer and the next start), the drone and the bots
  // coming by while it records
  k.perks = { slot2: 1, fast: 4 };
  for (const back of [5.2, 1.8]) { const u = startVideo(k, 0); if (u) u.start -= back; }
  k.drone.next = 4.5; k.bots.next = 6.5; k.live = 3;
  drain(k);
  return k;
}

let mode = 'title', S = null, bot = null, info = new Map(), cardNode = null, hiddenAt = 0;
let A = createActors(), placing = null, editing = false, drag = null, saveT = 5, hubT = 0, idleT = 12, demoT = 0;
const cardOpen = () => Boolean(cardNode?.isConnected);
const night = () => (QUERY.has('night') ? true : QUERY.has('day') || DEMO ? false : (() => { const h = new Date().getHours(); return h >= 19 || h < 6; })());
resetHer();

const ui = createUI(shell.stage, {
  idea(k) { if (mode !== 'hub' || placing) return; makeVideo(k); },
  newIdeas() { if (newIdeas(c)) { sfx.pick(); ui.forceRender(); } },
  shop() { if (mode === 'hub' && !placing) openShop(); },
  edit() { if (mode !== 'hub') return; editing ? stopEdit() : startEdit(); },
  editDone() { stopEdit(); },
  live() { if (mode !== 'hub' || placing) return; if (liveReady(c)) startLive(); else { shell.toast(`Make ${liveNeed(c) - c.live} more video${liveNeed(c) - c.live === 1 ? '' : 's'} to fill the live meter`, 'info', 2200); sfx.nope(); } },
  perks() { if (mode === 'hub') openCard((close) => perksCard({ career: c, onBuy: (id) => { if (buyPerk(c, id)) { sfx.perk(); speak(say('perk')); flush(); persist(); } }, onClose: close }), 'Skills'); },
  quests() { if (mode === 'hub') openCard((close) => questsCard({ career: c, onClose: close }), 'Quests'); },
  board() { if (mode === 'hub') openCard((close) => boardCard({ career: c, onClose: close }), 'Trending'); },
  records() { if (mode === 'hub') openCard((close) => recordsCard({ save, onClose: close, onReset: resetCareer }), 'Records'); },
  placeOk, placeFlip() { if (placing) { placing.flip = !placing.flip; sfx.pick(); } }, placeStore, placeCancel() { endPlacing(); if (editing) ui.edit(true); },
  tap(id) { if (mode !== 'live' || !S || S.over || bot || shell.state !== 'play') return; tap(S, id); flushLive(); },
});
shell.stage.append(topCanvas);

// ---------- her words, her face ----------
function speak(text, ms = 3000) { if (!text) return; ui.say(text, ms); A.her.talk = Math.min(2.2, 0.5 + text.length * 0.035); }
function tipOnce(key, text, ms = 7000) { if (save.tips[key] || DEMO) return; save.tips[key] = true; ui.tip(text, ms); persist(); }
function resetHer() { const G = roomGeom(HOMES[c.home || 0]); A = createActors(); A.her.x = Math.min(G.cols - 1, 2); A.her.y = Math.min(G.rows - 1, 2); }
const herAt = () => { const G = roomGeom(HOMES[c.home || 0]); return toScreen(R, G.x0 + (A.her.x + 0.5) * CELL, G.floorTop + (A.her.y + 1) * ROW - 22); };

// ---------- her room ----------
function enterHub({ quiet = false } = {}) {
  S = null; mode = 'hub'; keysAfter = performance.now() + 250;
  ui.mode('hub');
  shell.started({ count: false });
  music.play('room');
  if (!quiet && save.at && !QA && !DEMO) {
    const before = c.videos, g = comeBack(c, (Date.now() - save.at) / 1000);
    flush(true);
    if (g.counted >= TUNE.idle.min && g.views >= 1) { openCard((close) => awayCard({ gain: g, done: c.videos - before, onClose: close }), 'While you were away'); speak(say('back')); }
  }
  if (!c.videos && !DEMO) speak(say('first'), 6000);
  tipOnce('hub', TIPS.hub);
  persist();
}
function openCard(make, label) {
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
  tipOnce('place', TIPS.place, 5000);
  return true;
}
function check() { if (placing) placing.ok = canPlace(c, placing.id, placing.x, placing.y, { on: placing.on, ignore: placing.uid }).ok; refreshPlaceBar(); }
// her last desk stays: she records at it
const lastDesk = (uid) => {
  const it = uid != null && c.items.find((t) => t.uid === uid);
  return Boolean(it && itemOf(it.id).desk && c.items.filter((t) => itemOf(t.id).desk && layer(t) === 'floor').length <= 1);
};
function refreshPlaceBar() { if (!placing) { ui.place(null); return; } const def = itemOf(placing.id); ui.place({ name: def.name, ok: placing.ok, canStore: !lastDesk(placing.uid), flat: false }); }
function endPlacing() { placing = null; drag = null; ui.place(null); }
function placeOk() {
  if (!placing) return;
  if (!placing.ok) { sfx.nope(); speak(say('full')); return; }
  const p = placing;
  if (p.uid != null) {
    const it = c.items.find((t) => t.uid === p.uid);
    if (it && roomMove(c, p.uid, p.x, p.y, { on: p.on })) { it.flip = p.flip; const pt = A.pets.get(p.uid); if (pt) { pt.x = p.x; pt.y = p.y; pt.route = []; } }
  } else if (!placeFromInv(c, p.id, p.x, p.y, { flip: p.flip, on: p.on })) { sfx.nope(); return; }
  sfx.place();
  const G = roomGeom(HOMES[c.home || 0]), at = toScreen(R, G.x0 + (p.x + itemOf(p.id).w / 2) * CELL, layer({ id: p.id }) === 'wall' ? G.wallTop + p.y * 16 + 8 : G.floorTop + p.y * ROW);
  fx.sparkle(R, at.x, at.y);
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

// taps and drags on her room
const pos = (e) => { const s = shell.stage.getBoundingClientRect(); return { x: e.clientX - s.left, y: e.clientY - s.top }; };
ui.view.addEventListener('pointerdown', (e) => {
  if (mode !== 'hub' || shell.state !== 'play' || cardOpen() || e.button > 0) return;
  if (e.target.closest('button')) return;
  const p = pos(e);
  drag = { x0: p.x, y0: p.y, moved: false, id: e.pointerId, touch: e.pointerType === 'touch' };
  try { ui.view.setPointerCapture(e.pointerId); } catch { /* fine */ }
  if (placing) { moveGhost(p, drag.touch); e.preventDefault(); }
});
ui.view.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = pos(e);
  if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 8) drag.moved = true;
  if (placing) { moveGhost(p, drag.touch); e.preventDefault(); }
});
const up = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (!placing && !d.moved) tapRoom(pos(e));
};
ui.view.addEventListener('pointerup', up);
ui.view.addEventListener('pointercancel', () => { drag = null; });
function moveGhost(p, touch) {
  const g = ghostAt(R, c, placing.id, p.x, p.y - (touch ? 26 : 0));
  if (g.x !== placing.x || g.y !== placing.y || g.on !== placing.on) { placing.x = g.x; placing.y = g.y; placing.on = g.on ?? null; check(); }
}
function tapRoom(p) {
  const h = hitAt(R, p.x, p.y, editing ? ['item', 'pet', 'box', 'drone', 'bot'] : ['drone', 'box', 'bot', 'pet', 'her']);
  if (!h) return;
  if (h.kind === 'drone') { const g = catchDrone(c); if (g) { fx.sparkle(R, p.x, p.y); A.drone = null; } flush(); return; }
  if (h.kind === 'bot') { if (zap(c, h.id)) { fx.poof(R, p.x, p.y); A.bots.delete(h.id); } flush(); return; }
  if (h.kind === 'box') { tapDelivery(h.uid, p); return; }
  if (editing && (h.kind === 'item' || h.kind === 'pet')) { const it = c.items.find((t) => t.uid === h.uid); if (it) { startPlacing(it.id, { uid: it.uid, from: 'move' }); sfx.pick(); } return; }
  if (h.kind === 'pet') { const n = pet(c); sfx.pet(); fx.hearts(R, p.x, p.y, 6); if (n) fx.word(R, p.x, p.y - 20, `+${fmt(n)}`, '#ffffff', 16); if (Math.random() < 0.3) speak(say('pet')); flush(); return; }
  if (h.kind === 'her') { speak(say('tap')); A.her.cheer = 0.6; sfx.pick(); }
}
function tapDelivery(uid, p) {
  const d = c.deliveries.find((x) => x.uid === uid);
  if (!d) return;
  if (boxLeft(c, d) > 0) { tapBox(c, uid); sfx.boxTap(); fx.word(R, p.x, p.y - 12, `${Math.ceil(boxLeft(c, d))}s`, '#ffd84a', 14); return; }
  const id = openBox(c, uid);
  if (!id) return;
  sfx.box(); fx.confetti(R, p.x, p.y);
  if (editing) stopEdit();
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
        if (liveReady(c) && c.live === liveNeed(c) && !save.tips.live) tipOnce('live', TIPS.live);
        break;
      }
      case 'level': {
        sfx.level();
        const bits = [`Level ${e.level}!`, `💡 +${e.points}`];
        if (e.topic) bits.push(`${e.topic.icon} ${e.topic.name} videos open`);
        if (e.items) bits.push(`${e.items} new thing${e.items === 1 ? '' : 's'} in the shop`);
        shell.toast(bits.join(' · '), 'good', 3200);
        speak(e.topic ? say('topic') : say('level'));
        if (c.points && !save.tips.perks) tipOnce('perks', TIPS.perks);
        break;
      }
      case 'quest': if (!quiet) { sfx.quest(); shell.toast(`Quest done: ${questText(e.quest)} · 👁 +${fmt(e.quest.reward.views)}${e.quest.reward.point ? ' · 💡 +1' : ''}`, 'good', 2800); } break;
      case 'drone': startDrone(A); sfx.drone(); break;
      case 'droneGone': if (A.drone && Math.random() < 0.3) speak(say('missMail')); break;
      case 'mail': sfx.mail(); shell.toast(`Fan mail: ${giftText(e.gift)}`, 'good', 2600); speak(say('mail')); break;
      case 'bot': addBot(A, c, e.bot.id); if (A.bots.size === 1 && !quiet) { speak(say('bots')); } break;
      case 'botGone': botLeaves(A, e.bot.id); break;
      case 'zapped': sfx.zap(); if (Math.random() < 0.3) speak(say('zap')); break;
      case 'bought': break;
      case 'arrived': if (!quiet) { sfx.box(); if (Math.random() < 0.5) speak(say('box')); tipOnce('box', TIPS.box); } break;
      case 'placed': break;
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

// ---------- going live (a minute of her stream) ----------
const seedNow = () => (SEED ? SEED * 7919 + c.totals.live * 31 : (Date.now() ^ (c.totals.live * 2654435761)) >>> 0);
function startLive(topic = null) {
  endPlacing(); stopEdit();
  const L = liveStart(c, topic || undefined);
  if (!L) return;
  info = new Map();
  S = createStream({ cat: L.topic, v0: L.v0, busy: L.busy, followers: c.followers, seed: seedNow() });
  mode = 'live'; keysAfter = performance.now() + 250;
  ui.mode('live'); ui.live.reset(S.viewers);
  shell.started({ count: !QA && !DEMO });
  sfx.goLive(); music.play('live');
  speak(say('start', L.topic), 3400);
  chatT = 0.3;
  if (bot) resetPlayer(bot);
  tipOnce('stream', TIPS.stream, 7500);
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
// (the kit's own Space / Enter, which starts from the title and acts on the end card, lands first: the same key press
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
keyboard({ 1: 'i1', 2: 'i2', 3: 'i3', s: 'shop', d: 'edit', l: 'live', f: 'flip', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Backspace: 'store', Delete: 'store' }, {
  blocked: busy,
  down(name) {
    if (mode !== 'hub') return;
    if (placing) {
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[name];
      if (d) { placing.x += d[0]; if (itemOf(placing.id).place !== 'top') placing.y += d[1]; else { const g = ghostAt(R, c, placing.id, 0, 0); void g; } check(); return; }
      if (name === 'flip') { placing.flip = !placing.flip; return; }
      if (name === 'store') { placeStore(); return; }
      return;
    }
    if (name[0] === 'i') makeVideo(Number(name[1]) - 1);
    else if (name === 'shop') openShop();
    else if (name === 'edit') editing ? stopEdit() : startEdit();
    else if (name === 'live') ui.root && (liveReady(c) ? startLive() : sfx.nope());
  },
});

// ---------- the clock ----------
function tick_(dt) {
  if (mode === 'hub' || mode === 'live') {
    tick(c, dt, { events: mode === 'hub' });
    if (mode === 'hub') flush();
  }
  if (mode === 'hub' && (bot || DEMO)) autoplay(dt);
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
  updateActors(A, c, dt, { live: mode === 'live' });
  if (mode === 'hub' && !cardOpen() && !placing) {
    idleT -= dt;
    if (idleT <= 0) { idleT = 18 + Math.random() * 12; if (!c.uploads.length) speak(say('idle')); }
  }
  update(R, dt);
  saveT -= dt;
  if (saveT <= 0) { saveT = 5; persist(); }
}
// the game's own player (the tile's preview, `&auto=`): ideas, boxes, the drone and the bots, now and then the shop
function autoplay(dt) {
  if (!bot) return;
  demoT -= dt;
  while (c.uploads.length < 1 + (c.perks.slot2 || 0) + (c.perks.slot3 || 0)) { if (!startVideo(c, pickIdea(c, bot))) break; flush(); }
  if (A.drone && droneAt(A) > 0.35 && Math.random() < dt * 2) { catchDrone(c); A.drone = null; flush(); }
  for (const b of [...A.bots.values()]) if (!b.leaving && Math.random() < dt * 0.8) { zap(c, b.id); A.bots.delete(b.id); flush(); }
  for (const d of [...c.deliveries]) if (boxLeft(c, d) <= 0) { const id = openBox(c, d.uid), at = id && autoSpot(c, id); if (at) placeFromInv(c, id, at.x, at.y, { on: at.on }); flush(); }
  if (demoT <= 0) {
    demoT = DEMO ? 2.2 : 8;
    const id = pickBuy(c, bot); if (id) { buy(c, id); flush(); }
    if (liveReady(c) && QA_AUTO) startLive();
  }
}
function titleRect() {
  const box = shell.stage.getBoundingClientRect(), top = shell.bar.getBoundingClientRect().bottom - box.top;
  return { x: 0, y: Math.max(0, top), w: box.width, h: box.height - Math.max(0, top) };
}
function frame() {
  setRect(R, mode === 'title' ? titleRect() : ui.rect());
  const boxes = c.deliveries.map((d) => ({ uid: d.uid, ready: boxLeft(c, d) <= 0, left: boxLeft(c, d) }));
  draw(R, c, A, {
    night: night(), edit: editing && !placing, boxes, picked: placing?.uid ?? null,
    ghost: placing ? { id: placing.id, x: placing.x, y: placing.y, on: placing.on, flip: placing.flip, ok: placing.ok } : null,
    happy: Boolean(S && S.combo >= 10),
  }, mode === 'title' ? 'title' : mode === 'live' ? 'live' : 'room');
  if (mode === 'live' && S) ui.live.hud({ viewers: S.viewers, hype: S.hype, combo: S.combo, t: S.t, dur: S.dur });
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

// her old videos kept earning while the page was hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); persist(); return; }
  if (!hiddenAt || QA || DEMO) return;
  const secs = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
  if (mode !== 'hub' || secs < 5) return;
  const before = c.videos, g = comeBack(c, secs);
  flush(true);
  if (g.counted >= TUNE.idle.min && g.views >= 1 && !cardOpen()) openCard((close) => awayCard({ gain: g, done: c.videos - before, onClose: close }), 'While you were away');
  persist();
});
addEventListener('pagehide', () => persist());

const loop = createLoop({ step: 1 / 60, update: tick_, render: frame, paused: () => shell.state === 'pause' || (shell.state === 'over' && !DEMO), speed: () => qaSpeed });
if (QA) window.__gl = { get c() { return c; }, get save() { return save; }, get mode() { return mode; }, get A() { return A; }, get placing() { return placing; }, get S() { return S; }, speed(n) { qaSpeed = clamp(Number(n) || 1, 0.25, 32); }, enterHub, startLive, startPlacing, openShop, R };
loop.start();
if (DEMO) { bot = createPlayer('demo', SEED || 7); shell.started({ count: false }); mode = 'hub'; ui.mode('hub'); music.play('room'); startVideo(c, 0); drain(c); }
else if (QA && QUERY.has('live')) { if (QA_AUTO) bot = createPlayer(QA_AUTO, SEED || 3); c.live = 99; enterHub({ quiet: true }); startLive(); }
else if (QA && (QUERY.has('hub') || QA_AUTO)) { if (QA_AUTO) bot = createPlayer(QA_AUTO, SEED || 3); enterHub({ quiet: true }); }
else toTitle();
void REDUCED; void RIVALS; void idleRate; void awayGain;
