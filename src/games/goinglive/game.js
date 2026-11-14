// GOING LIVE: AGI-1 just started streaming. Zero followers, one bedroom. Pick what she streams and go live: a minute of
// her stream, her chat scrolling, questions to answer, spam bots to ban, raids to welcome, tech problems to fix, hearts to
// catch, clips to take and her big moment to tap through. Views buy things for her room; her room makes her streams
// better; her old streams keep earning while you're away; she moves up through four homes and climbs the board of made-up
// streamers to #1. (The owner, 2026-11-14, after asking about a famous YouTuber game: "yes exactly" to an AGI-1
// version, ours in every way.) Everything is made up and kept on this device: no wallet, no money, nothing to buy.
//
// The rules are ./stream.js (a stream) and ./econ.js (her career), pure; ./ai.js plays them (the tile's preview, the
// balance tool, the tests); this file is the page: what the rules' events look and sound like.
import './style.css';
import { createShell } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { clamp } from '../kit/fx.js';
import { CATS, SLOTS, TUNE, catOf } from './data.js';
import { newCareer, unlocked, isOpen, appeal, startViewers, busyOf, upgrade, moveRoom, applyStream, idleRate, awayGain, trendOf, rankOf } from './econ.js';
import { createStream, step, tap, drain } from './stream.js';
import { createPlayer, playStep, resetPlayer, PROFILES } from './ai.js';
import { fresh, load, earned } from './progress.js';
import { nameOf, colorOf, chatLine, askOf, botLine, botName, raidLine, techOf, say, TIPS, endLine, shareText } from './lines.js';
import { createRenderer, setRect, setLive, update, draw, toScreen, fx, HER } from './render.js';
import { createUI, shopCard, boardCard, recordsCard, awayCard, overExtra, titleExtra, fmt, full } from './ui.js';
import { createSound } from './sound.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'goinglive', name: 'GOING LIVE', root,
  howTo: {
    intro: 'AGI-1 just started streaming: zero followers, one bedroom. Go live, keep her chat happy, spend her views on her room and take her to #1 trending.',
    steps: [
      ['Pick what to stream', 'Each kind draws its own crowd, and her room helps some more than others. Chat gets tired of the same thing: mix it up, and watch what’s trending.'],
      ['Go live', 'A stream lasts a minute. Her viewers follow the hype: keep it up.'],
      ['Answer chat', 'Tap a question to answer it. Tap a spam bot to ban it before it scares viewers away.'],
      ['Catch the big stuff', 'Welcome raids, fix tech problems fast, catch hearts, clip her best moments, and tap fast through her big moment.'],
      ['Combos', 'Good moments in a row build a combo, and a combo brings viewers. A miss breaks it.'],
      ['Grow her room', 'Spend views on her room. Move to a bigger place once she has the followers. Her old streams keep earning while you’re away.'],
    ],
    touch: [['Tap', 'Answer, ban, welcome, fix, catch'], ['Tap fast', 'Her big moment']],
    keys: [['Mouse', 'Click anything on her stream'], ['Space / Enter', 'Take the most urgent thing'], ['1–8', 'Choose what to stream'], ['L', 'Go live'], ['Esc / P', 'Pause']],
  },
  onPause() { persist(); },
  onRestart() { if (mode === 'live' && S) startStream(S.cat); else if (mode !== 'title') enterHub({ quiet: true }); },
  onQuit() { S = null; mode = 'title'; ui.mode('title'); persist(); queueMicrotask(toTitle); },
});

const canvas = document.createElement('canvas');
canvas.className = 'gl-canvas';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'AGI-1 in her room, at her desk, streaming');
const topCanvas = document.createElement('canvas');
topCanvas.className = 'gl-top';
topCanvas.setAttribute('aria-hidden', 'true');
shell.stage.append(canvas);
const R = createRenderer(canvas, topCanvas);
const { sfx, music } = createSound(shell.audio);
const fChip = shell.chip('Followers', 0, { accent: true, fmtFn: fmt });
const vChip = shell.chip('Views', 0, { fmtFn: fmt });
fChip.node.classList.add('gl-chip-f'); vChip.node.classList.add('gl-chip-v');
const img = new Image();
img.decoding = 'async';
img.src = '/images/agi1-live-2d.webp';

// `?qa` (browser tests only): the game's state readable from the page, `&speed=n`, `&auto=good` for one of the game's own
// streamers, `&live=sing` to go live at once, `&f=`, `&tier=`, `&room=` to start a career there. Nothing is saved or
// counted in a `?qa` page.
const QA = QUERY.has('qa');
let qaSpeed = QA ? clamp(Number(QUERY.get('speed')) || 1, 0.25, 16) : 1;
const QA_AUTO = QA && PROFILES[QUERY.get('auto')] ? QUERY.get('auto') : null;

let save = load(shell.store.read());
if (DEMO) save = { ...fresh(), career: showcase() };
if (QA) {
  const c = save.career = newCareer();
  const f = Number(QUERY.get('f')), t = Number(QUERY.get('tier')), r = Number(QUERY.get('room'));
  if (Number.isFinite(f) && f > 0) { c.followers = f; c.views = Number(QUERY.get('views')) || f * 40; c.streams = Math.round(Math.log2(f + 1) * 3); }
  if (Number.isFinite(t) && t > 0) for (const s of SLOTS) c.owned[s.id] = Math.min(t, s.tiers.length - 1);
  if (Number.isFinite(r) && r > 0) c.room = Math.min(3, r);
}
let career = save.career;
const persist = () => QA || DEMO || shell.store.update((d) => Object.assign(d, { career: save.career, at: Date.now(), stickers: save.stickers, tips: save.tips, played: save.played }));
// the tile's preview: a streamer a few weeks in (the studio flat, a room half done)
function showcase() {
  const c = newCareer();
  c.followers = 46000; c.views = 2e5; c.streams = 34; c.room = 1;
  for (const s of SLOTS) c.owned[s.id] = 2;
  c.owned.chair = 1; c.owned.cam = 1;
  return c;
}

let mode = 'title', S = null, sel = null, bot = null, info = new Map();
let talkT = 0, emote = '', emoteT = 0, tilt = 0, chatT = 0, saveT = 5, hubT = 0, idleT = 9, demoNext = 0, cardNode = null, hiddenAt = 0;
// a card of ours is open (the pause card replaces it: then it isn't)
const cardOpen = () => Boolean(cardNode?.isConnected);

const ui = createUI(shell.stage, {
  pick(id) { if (mode !== 'hub' || !isOpen(career, id)) return; sel = id; ui.pick(id); ui.hub(career); sfx.pick(); },
  live() { if (mode === 'hub' && sel) startStream(sel); },
  shop() { if (mode === 'hub') openShop(); },
  board() { if (mode === 'hub') openCard((close) => boardCard({ career, onClose: close }), 'Trending'); },
  records() { if (mode === 'hub') openCard((close) => recordsCard({ save, onClose: close, onReset: resetCareer }), 'Records'); },
  tap(id) { if (mode !== 'live' || !S || S.over || bot || shell.state !== 'play') return; tap(S, id); flush(); },
});
shell.stage.append(topCanvas);

// ---------- her words and her face ----------
function speak(text, ms = 3000) { if (!text) return; ui.say(text, ms); talkT = Math.min(2.2, 0.5 + text.length * 0.035); }
function face(e, s = 1.3) { emote = e; emoteT = s; }
function tipOnce(key, text, ms = 7000) { if (save.tips[key] || DEMO) return; save.tips[key] = true; ui.tip(text, ms); persist(); }

// ---------- between streams ----------
const bestCat = () => {
  const tr = trendOf(career);
  return unlocked(career).map((k) => ({ id: k.id, a: appeal(career, k.id, { trend: tr }) })).sort((a, b) => b.a - a.a)[0]?.id || 'talk';
};
function enterHub({ quiet = false } = {}) {
  S = null; mode = 'hub'; keysAfter = performance.now() + 250;
  ui.mode('hub'); setLive(R, false);
  shell.started({ count: false });
  music.play('room');
  if (!sel || !isOpen(career, sel)) sel = bestCat();
  ui.pick(sel); ui.hub(career);
  if (!quiet && save.at && !QA && !DEMO) {
    const g = awayGain(career, (Date.now() - save.at) / 1000);
    if (g.counted >= TUNE.idle.min && g.views >= 1) { career.views += g.views; openCard((close) => awayCard({ gain: g, onClose: close }), 'While you were away'); speak(say('back')); }
  }
  if (!career.streams) speak(say('first'), 5200);
  tipOnce('hub', TIPS.hub);
  persist();
}
function openCard(make, label) {
  const close = () => { if (cardOpen()) shell.closeCard(); cardNode = null; if (mode === 'hub') ui.hub(career); };
  cardNode = make(close);
  shell.card(cardNode, { label });
}
function openShop() {
  tipOnce('shop', TIPS.shop);
  openCard((close) => shopCard({
    career, sel,
    onBuy(slot) { const t = upgrade(career, slot); if (!t) { sfx.miss(); return; } sfx.buy(); speak(Math.random() < 0.5 ? say('bought') : `${t.name}. ${say('bought')}`); stickers(); persist(); },
    onMove() { const r = moveRoom(career); if (!r) return; sfx.move(); speak(say('moved')); const p = toScreen(R, 500, 200); fx.confetti(R, p.x, p.y); stickers(); persist(); },
    onClose: close,
  }), 'Her room');
}
function stickers(r = null) {
  const got = earned(save, r);
  got.forEach((s, i) => setTimeout(() => { shell.toast(`Sticker: ${s.name}`, 'good', 2400); sfx.award(); }, 500 + i * 900));
  return got;
}
function resetCareer() {
  save = fresh(); career = save.career; sel = null;
  persist(); shell.closeCard(); cardNode = null;
  toTitle();
}

// ---------- a stream ----------
const seedNow = () => (SEED ? SEED * 7919 + career.streams * 31 : (Date.now() ^ (career.streams * 2654435761)) >>> 0);
function startStream(cat) {
  if (!isOpen(career, cat)) return;
  sel = cat; info = new Map();
  S = createStream({ cat, v0: startViewers(career, cat), busy: busyOf(career.followers), followers: career.followers, seed: seedNow() });
  mode = 'live'; keysAfter = performance.now() + 250;
  ui.mode('live'); ui.live.reset(S.viewers); setLive(R, true);
  shell.started({ count: !QA && !DEMO });
  sfx.goLive(); music.play('live');
  speak(say('start', cat), 3400); face('♪', 1.2);
  chatT = 0.3;
  if (bot) resetPlayer(bot);
  tipOnce('stream', TIPS.stream, 7500);
  if ((career.fresh[cat] ?? 1) < 0.7) tipOnce('tired', TIPS.tired, 6000);
}
// chat's own chatter (made up as it goes: the rules don't need it), busier with more viewers
const chatRate = (v) => Math.min(8, 0.9 + Math.log10(v + 1) * 1.55);
function chatter() {
  const n = Math.floor(Math.random() * 1e6);
  ui.live.msg({ name: nameOf(n), color: colorOf(n), text: chatLine(S.cat, n >> 3) });
  sfx.msg();
}
function flush() {
  if (!S) return;
  for (const e of drain(S)) {
    const x = e.target;
    if (e.type === 'spawn') {
      let i = {};
      if (x.kind === 'ask') { const n = x.why * 7 + S.seed, q = askOf(S.cat, x.why); i = { name: nameOf(n), color: colorOf(n), text: q.q, answer: q.a }; sfx.ask(); }
      else if (x.kind === 'bot') { i = { name: botName(x.why), text: botLine(x.why) }; sfx.bot(); }
      else if (x.kind === 'raid') { i = { text: raidLine(x) }; sfx.ask(); face('!', 1); }
      else if (x.kind === 'tech') { i = techOf(x.why, (career.owned.pet || 0) > 0); sfx.tech(); face('?', 1.4); }
      else if (x.kind === 'big') { i = { text: catOf(S.cat).mash }; sfx.bigStart(); face('!', 1.2); }
      info.set(x.id, i);
      ui.live.add(x, i);
    } else if (e.type === 'hit') {
      const i = info.get(x.id) || {}, at = ui.whereOf(x.id);
      ui.live.settle(x.id, true, i);
      const her = toScreen(R, HER.face[0], HER.face[1]);
      if (x.kind === 'ask') { sfx.answer(); speak(i.answer, 2600); face('♡', 1); fx.hearts(R, her.x, her.y, 6); }
      else if (x.kind === 'bot') { sfx.ban(); fx.poof(R, at.x, at.y); if (Math.random() < 0.35) speak(say('ban')); }
      else if (x.kind === 'raid') { sfx.raid(); fx.confetti(R, her.x, her.y - 30); fx.word(R, her.x, her.y - 60, `+${full(x.size)} viewers`, '#ffd84a', 26); speak(say('raid')); face('★', 1.4); }
      else if (x.kind === 'tech') { sfx.fix(); speak(say('fix')); }
      else if (x.kind === 'heart') { sfx.heart(); fx.hearts(R, at.x, at.y, 10); fx.word(R, at.x, at.y - 20, `+${fmt(e.gain)}`, '#ffffff', 18); }
      else if (x.kind === 'clip') { sfx.clip(); fx.sparkle(R, at.x, at.y); fx.word(R, at.x, at.y - 24, 'CLIPPED!', '#ffd84a', 24); speak(say('clip')); }
      else if (x.kind === 'big') { sfx.bigWin(); fx.confetti(R, her.x, her.y); speak(say('big')); face('★', 1.6); }
      if (e.combo && e.combo % 10 === 0) { sfx.combo(); speak(say('combo'), 2200); }
    } else if (e.type === 'miss' || e.type === 'gone') {
      ui.live.settle(x.id, false, info.get(x.id) || {});
      if (e.type === 'miss') {
        if (x.kind === 'raid') speak(say('raidMiss'));
        else if (x.kind === 'tech') { speak(say('techMiss')); face('?', 1.2); }
        else if (x.kind === 'big') { sfx.bigMiss(); speak(say('bigMiss')); }
        else sfx.miss();
      }
    } else if (e.type === 'bigtap') { ui.live.bigTap(x.id, e.taps, x.need); sfx.bigTap(e.taps / x.need); }
  }
}
function endStream() {
  const r = S.over, prevPeak = career.peak;
  const gained = applyStream(career, r);
  if (!DEMO && !QA) save.played++;
  const newStickers = DEMO ? [] : earned(save, r);
  persist();
  sfx.end(); music.play('room');
  if (gained.room) speak(say('moved'));
  if (gained.awards.length) setTimeout(() => sfx.award(), 600);
  if (DEMO) { demoNext = 1.4; return; }
  const rank = rankOf(career.followers);
  if (gained.rank[0] > 1 && rank === 1) speak(say('number1'), 5000);
  shell.over({
    title: 'Stream over', score: r.peak, label: `peak viewers · ${catOf(r.cat).name}`,
    best: career.streams > 1 ? Math.max(prevPeak, r.peak) : null, isBest: r.peak > prevPeak && career.streams > 1,
    stats: [
      ['New followers', `+${full(r.followers)}`],
      ['Views', `+${fmt(r.views)}`],
      ['Answered', `${r.stats.answered}/${r.stats.asked}`],
      ['Bots banned', `${r.stats.banned}/${r.stats.bots}`],
    ],
    line: endLine(r), share: shareText(r, rank),
    extra: overExtra({ result: r, gained, newStickers }),
    again: 'Go live again', onAgain: () => startStream(sel), onMenu: () => enterHub({ quiet: true }),
  });
}

// ---------- the keys ----------
// (the kit's own Space / Enter, which starts from the title and goes live again from the end card, lands first: the
// same key press never also reaches these, `keysAfter`)
let keysAfter = 0;
const busy = () => shell.state !== 'play' || Boolean(bot) || cardOpen() || performance.now() < keysAfter;
// Space / Enter: go live from her room, or take the most urgent thing on her stream (a focused button keeps them: it
// answers them itself)
keyboard({ ' ': 'act', Enter: 'act' }, {
  blocked: () => busy() || Boolean(document.activeElement?.closest?.('button, a, input, .ak-bar, .ak-layer')),
  down() {
    if (mode === 'hub') { if (sel) startStream(sel); return; }
    if (mode === 'live' && S && !S.over) {
      // the most urgent thing: the one with the least time left (her big moment takes every press while it's up)
      const big = S.targets.find((x) => x.kind === 'big');
      const x = big || [...S.targets].sort((a, b) => (a.life - a.age) - (b.life - b.age))[0];
      if (x) { tap(S, x.id); flush(); }
    }
  },
});
// 1–8: what to stream; L: go live
keyboard({ l: 'live', 1: 'c1', 2: 'c2', 3: 'c3', 4: 'c4', 5: 'c5', 6: 'c6', 7: 'c7', 8: 'c8' }, {
  blocked: busy,
  down(name) {
    if (mode !== 'hub') return;
    if (name === 'live') { if (sel) startStream(sel); return; }
    const k = CATS[Number(name.slice(1)) - 1];
    if (k && isOpen(career, k.id)) { sel = k.id; ui.pick(sel); ui.hub(career); sfx.pick(); }
  },
});

// ---------- the clock ----------
function tick(dt) {
  if (mode === 'hub' || mode === 'live') career.views += idleRate(career) * dt;
  if (mode === 'live' && S && !S.over) {
    if (bot) playStep(bot, S, dt);
    step(S, dt);
    flush();
    chatT -= dt;
    if (chatT <= 0) { chatT = (1 / chatRate(S.viewers)) * (0.6 + Math.random() * 0.8); chatter(); }
    music.hype(S.hype / 100);
    ui.live.count(Math.round(S.viewers));
    if (S.over) endStream();
  }
  if (DEMO && mode === 'live' && S?.over) { demoNext -= dt; if (demoNext <= 0) { const open = unlocked(career); startStream(open[(open.findIndex((k) => k.id === S.cat) + 1) % open.length].id); } }
  if (mode === 'hub' && !cardOpen()) {
    idleT -= dt;
    if (idleT <= 0) { idleT = 16 + Math.random() * 10; speak(say('idle')); }
  }
  talkT = Math.max(0, talkT - dt); emoteT = Math.max(0, emoteT - dt);
  tilt += ((talkT > 0 ? Math.sin(performance.now() / 260) * 0.6 : 0) - tilt) * Math.min(1, dt * 4);
  update(R, dt);
  saveT -= dt;
  if (saveT <= 0) { saveT = 5; persist(); }
}
// the tech problem on her stream right now, if any (what it is: ./lines.js techOf)
function glitchOf() {
  if (mode !== 'live' || !S || S.over) return '';
  const x = S.targets.find((y) => y.kind === 'tech');
  return x ? info.get(x.id)?.id || '' : '';
}
function titleRect() {
  const box = shell.stage.getBoundingClientRect(), top = shell.bar.getBoundingClientRect().bottom - box.top;
  return { x: 0, y: Math.max(0, top), w: box.width, h: box.height - Math.max(0, top) };
}
function frame(alpha, dt) {
  setRect(R, mode === 'title' ? titleRect() : ui.rect());
  draw(R, {
    room: career.room, owned: career.owned, followers: career.followers, live: mode === 'live', cat: S?.cat || sel,
    hype: S ? S.hype / 100 : 0, img, talk: talkT > 0 ? 1 : 0, tilt, emote: emoteT > 0 ? emote : '', glitch: glitchOf(),
  }, mode === 'title' ? 0.42 : 0);
  if (mode === 'live' && S) ui.live.hud({ viewers: S.viewers, hype: S.hype, combo: S.combo, t: S.t, dur: S.dur });
  fChip.set(career.followers); vChip.set(Math.floor(career.views));
  if (mode === 'hub' && !cardOpen()) { hubT -= dt; if (hubT <= 0) { hubT = 0.25; ui.hub(career); } }
}

// ---------- the title ----------
function toTitle() {
  S = null; mode = 'title';
  ui.mode('title'); setLive(R, false, true);
  music.stop();
  shell.title({
    logo: ['GOING', { text: 'LIVE', tone: 'accent' }],
    tagline: 'AGI-1 just started streaming. Zero followers, one bedroom, big dreams. Take her to #1.',
    play: career.streams ? 'Continue' : 'Play',
    onPlay: () => enterHub(),
    extra: career.streams ? titleExtra({ onRecords: () => openCard((close) => recordsCard({ save, onClose: () => { close(); toTitle(); }, onReset: resetCareer }), 'Records') }) : null,
    best: null,
    fine: 'Made-up streamers, chat and numbers · no wallet needed · her career stays on this device',
  });
}

// her old streams kept earning while the page was hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); persist(); return; }
  if (!hiddenAt || QA || DEMO) return;
  const g = awayGain(career, (Date.now() - hiddenAt) / 1000); hiddenAt = 0;
  if (g.counted >= TUNE.idle.min && g.views >= 1) { career.views += g.views; if (mode === 'hub' && !cardOpen()) openCard((close) => awayCard({ gain: g, onClose: close }), 'While you were away'); persist(); }
});
addEventListener('pagehide', () => persist());

const loop = createLoop({ step: 1 / 60, update: tick, render: frame, paused: () => shell.state === 'pause' || (shell.state === 'over' && !DEMO), speed: () => qaSpeed });
if (QA) window.__gl = { get S() { return S; }, get career() { return career; }, get save() { return save; }, get mode() { return mode; }, speed(n) { qaSpeed = clamp(Number(n) || 1, 0.25, 16); }, enterHub, startStream };

loop.start();
if (DEMO) { bot = createPlayer('demo', SEED || 7); shell.started({ count: false }); sel = 'game'; startStream('game'); }
else if (QA && QUERY.get('live')) { if (QA_AUTO) bot = createPlayer(QA_AUTO, SEED || 3); startStream(isOpen(career, QUERY.get('live')) ? QUERY.get('live') : 'talk'); }
else if (QA && QUERY.has('hub')) enterHub({ quiet: true });
else toTitle();
