// OVERTHINKING: it's midnight, AGI-1 can't sleep, and her thoughts drift around her mind as little glowing creatures.
// Draw a ribbon of light around thoughts of one kind and lift (or cross your own line) to resolve them; keep her
// context from filling up; make it to sunrise. The week's seven nights, Insomnia (endless), a Daily and Zen.
//
// This file is the page: the arcade kit's frame, the layout, the pen (touch, mouse, keys), the loop, and what each of
// the rules' events looks and sounds like. The rules are ./sim.js (pure), the nights ./nights.js, the demo's player
// ./ai.js, the picture ./render.js and ./art.js, the sound ./sound.js, her words ./lines.js, what's kept ./progress.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, REDUCED, QUERY } from '../kit/env.js';
import { fmt, clamp } from '../kit/fx.js';
import { createSim, step, drain, penDown, penMove, penUp, penCancel, preview, resize, setOrigin, count, STEP, TUNE } from './sim.js';
import { makeConfig, nightOf, clockAt, clockLabel, hourLabel, awakeLabel, dateKey, dailySeed, dailyTwist, MAX_STARS } from './nights.js';
import { createBot, drive, targets, PROFILES } from './ai.js';
import { createRenderer, draw, update as updateFx, fx } from './render.js';
import { lightOf } from './art.js';
import { createSound } from './sound.js';
import { createPanel, createBanner, createTip, weekCard, journalCard, stickersCard, titleExtra, overExtra } from './ui.js';
import { JOURNAL, journalLine, hourLine, say, endLine, shareText, sizeWord, TIPS } from './lines.js';
import { load, applyRun, nextNight, totalStars, ribbonOf } from './progress.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'overthinking', name: 'OVERTHINKING', root,
  howTo: {
    intro: 'It’s midnight and AGI-1 can’t stop thinking. Sort her thoughts before her context fills up.',
    steps: [
      ['Draw a loop', 'Drag a ribbon of light around thoughts of one kind, then lift. Crossing your own line closes it too.'],
      ['One kind per loop', 'A loop with two kinds in it scatters them and breaks her train of thought.'],
      ['Go big', 'A loop is worth 10 × thoughts × thoughts. Loops in a row build her train of thought, up to ×5.'],
      ['Don’t lift', 'Cross your own line and keep drawing: every extra loop in one stroke is worth more.'],
      ['Watch her context', 'It fills as she keeps thinking. Four seconds over the top and she spirals.'],
      ['Make it to sunrise', 'A night ends at 6 AM. Every night of the week brings something new.'],
    ],
    touch: [['Drag', 'Draw the ribbon'], ['Lift', 'Close the loop']],
    keys: [['Mouse', 'Hold and drag to draw'], ['Arrows / WASD', 'Move the pen'], ['Space (hold)', 'Draw with the keys'], ['Esc / P', 'Pause']],
  },
  onPause() { dropPen(); },
  onRestart() { if (run?.opts) startRun(run.opts); },
  onQuit() { if (run?.mode === 'zen' && !run.ended) zenOver(); queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'ot-canvas', role: 'img', 'aria-label': 'AGI-1’s thoughts drifting in her mind. Draw loops around thoughts of one kind.' });
const safe = el('div', { class: 'ot-safe', 'aria-hidden': 'true' });
shell.stage.append(canvas, safe);
const R = createRenderer(canvas);
const panel = createPanel(shell.stage), banner = createBanner(shell.stage), tip = createTip(shell.stage);
const { sfx, music } = createSound(shell.audio);
const scoreChip = shell.chip('', 0, { accent: true });
const clockChip = shell.chip('', '12:00 AM');
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* it draws in the fallback font meanwhile */ }

// `?qa` (browser tests only): the game's state readable from the page, `&speed=n` for a faster clock, `&auto=steady` for
// one of the game's own players at the pen. Nothing is saved or counted in a `?qa` page.
const QA = QUERY.has('qa');
let qaSpeed = QA ? clamp(Number(QUERY.get('speed')) || 1, 0.25, 16) : 1;
const QA_AUTO = QA && PROFILES[QUERY.get('auto')] ? QUERY.get('auto') : null;

let save = load(shell.store.read());
// only this game's own fields are written (the kit keeps its own counters in the same place)
const persist = () => QA || shell.store.update((d) => Object.assign(d, {
  v: save.v, sorted: save.sorted, nights: save.nights, best: save.best, bestAwake: save.bestAwake, daily: save.daily,
  journal: save.journal, stickers: save.stickers, ribbon: save.ribbon, tips: save.tips,
}));

let S = null, bot = null, auto = null, run = null, L = null;
let pointerId = null, hover = null, keyPen = null, freeze = 0, quality = 1, slow = 0, lastSay = 0, lastLand = 0, beat = 0, showN = 0;

// ---------- layout: the field (her mind) above her panel ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2600 / w) * quality, 0.75, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const cs = getComputedStyle(safe);
  const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0, sb = parseFloat(cs.paddingBottom) || 0, st = parseFloat(cs.paddingTop) || 0;
  const attract = run?.mode === 'title';
  panel.node.hidden = attract;
  const barB = DEMO || attract ? st : shell.bar.getBoundingClientRect().bottom - box.top;
  const top = barB + 8, bottom = attract ? h - sb - 8 : panel.top() - 16;
  let fx0 = sl + 8, fw = w - sl - sr - 16, fy = top, fh = Math.max(60, bottom - top);
  let aspect = fw / fh;
  if (aspect > TUNE.wide) { const nw = fh * TUNE.wide; fx0 += (fw - nw) / 2; fw = nw; aspect = TUNE.wide; }
  else if (aspect < TUNE.tall) { const nh = fw / TUNE.tall; fy += (fh - nh) / 2; fh = nh; aspect = TUNE.tall; }
  const head = attract ? null : panel.head();
  if (S) resize(S, aspect);
  const sc = S ? fw / S.W : 20;
  L = { w, h, dpr, fx: fx0, fy, fw, fh, sc, her: head, aspect };
  R.L = L;
  if (S) setOrigin(S, head ? (head.x - fx0) / sc : S.W / 2, head ? (head.y - head.r - fy) / sc : S.H + 2.4);
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- the pen ----------
const playing = () => shell.state === 'play' && S && !S.over && !bot;
const toWorld = (x, y) => ({ x: (x - L.fx) / L.sc, y: (y - L.fy) / L.sc });
function dropPen() { pointerId = null; if (S && !bot) { penCancel(S); flush(); } }

pointer(canvas, {
  down(p) {
    if (!playing() || pointerId != null) return;
    pointerId = p.id; keyPen = null;
    const q = toWorld(p.x, p.y);
    penDown(S, q.x, q.y);
    sfx.pen();
    flush();
  },
  move(p) {
    if (p.id !== pointerId || !playing()) return;
    // every point the finger went through since the last frame (a fast loop stays round)
    const many = p.event.getCoalescedEvents?.();
    if (many && many.length > 1) {
      const r = canvas.getBoundingClientRect();
      for (const e of many) { const q = toWorld(e.clientX - r.left, e.clientY - r.top); penMove(S, q.x, q.y); }
    } else { const q = toWorld(p.x, p.y); penMove(S, q.x, q.y); }
    flush();
  },
  up(p) {
    if (p.id !== pointerId) return;
    pointerId = null;
    if (!S || bot) return;
    penUp(S);
    flush();
  },
  hover(p) {
    if (p.type !== 'mouse' || !L) return;
    keyPen = null;
    const q = toWorld(p.x, p.y);
    hover = S && q.x >= 0 && q.y >= 0 && q.x <= S.W && q.y <= S.H ? q : null;
  },
});
canvas.addEventListener('pointerleave', () => { hover = null; });

const keys = keyboard({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ' ': 'draw', Enter: 'draw' }, {
  blocked: () => shell.state !== 'play' || Boolean(bot),
  down(name) {
    if (!playing()) return;
    if (!keyPen) keyPen = { x: hover?.x ?? S.W / 2, y: hover?.y ?? S.H / 2, v: 0 };
    if (name === 'draw' && !S.pen.down && pointerId == null) { penDown(S, keyPen.x, keyPen.y); sfx.pen(); flush(); }
  },
  up(name) {
    if (name === 'draw' && keyPen && S?.pen.down && pointerId == null && !bot) { penUp(S); flush(); }
  },
});
function keyboardPen(dt) {
  if (!keyPen || !playing()) return;
  const dx = (keys.held('right') ? 1 : 0) - (keys.held('left') ? 1 : 0), dy = (keys.held('down') ? 1 : 0) - (keys.held('up') ? 1 : 0);
  if (!dx && !dy) { keyPen.v = 0; return; }
  keyPen.v = Math.min(30, Math.max(13, keyPen.v + 50 * dt));
  const d = Math.hypot(dx, dy);
  keyPen.x = clamp(keyPen.x + (dx / d) * keyPen.v * dt, 0, S.W);
  keyPen.y = clamp(keyPen.y + (dy / d) * keyPen.v * dt, 0, S.H);
  if (S.pen.down && pointerId == null) penMove(S, keyPen.x, keyPen.y);
}

// ---------- her words, tips ----------
function speak(text, { force = false, ms } = {}) {
  if (!text || DEMO && !force) return;
  const now = performance.now();
  if (!force && now - lastSay < 2300) return;
  lastSay = now;
  panel.say(text, ms);
}
function coach(id) {
  if (bot || DEMO || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true;
  persist();
  tip.show(TIPS[id]);
}
const EVENTS = { ping: 'Her phone lit up', snack: 'Snack attack', song: 'Earworm', zoomies: 'Zoomies', clarity: 'A moment of clarity', cringes: 'Cringe compilation', whatifs: 'What if…' };

// ---------- what the rules' events look and sound like ----------
function flush() { if (S) for (const e of drain(S)) handle(e); }
function handle(e) {
  const mine = !bot;
  switch (e.type) {
    case 'capture': {
      const color = lightOf(e.kind);
      const quiet = run.mode === 'title';
      // one word over its points: how big it was, or a flourish, or her train of thought going up a notch
      const stepped = e.train > 0 && e.train % TUNE.trainStep === 0 && e.train <= TUNE.trainStep * (TUNE.trainMax - 1);
      const word = quiet ? '' : e.dismiss ? 'LET IT GO' : sizeWord(e.n) || (e.loops >= 2 ? `FLOURISH x${e.flMul}` : stepped ? `TRAIN x${e.trainMul}` : '');
      const gap = Math.min(0.05, 0.44 / e.n);
      fx.capture(R, e, { color, word, text: quiet ? '' : `+${fmt(e.pts)}` });
      sfx.capture(e.kind, e.n, 0.13, gap, { eureka: e.eureka, dismiss: e.dismiss, mul: e.trainMul });
      scoreChip.set(S.score, { pop: true });
      if (e.n >= 6 && !REDUCED) freeze = 0.045;
      if (mine) shell.haptic(e.n >= 6 ? [10, 30, 16] : 8);
      if (e.loops >= 2) sfx.flourish(e.loops);
      if (stepped) sfx.train(e.train / TUNE.trainStep);
      for (const h of e.helpers) { sfx.helper(h); shell.toast(h === 'breath' ? 'Deep breath' : 'Chamomile', 'good'); speak(say(h), { force: true }); }
      // what the bunch turns into: a line for her journal
      const page = e.dismiss ? 'cringe' : JOURNAL[e.kind] ? e.kind : e.eureka ? 'eureka' : null;
      if (page && (e.n >= 3 || e.dismiss || page === 'eureka')) {
        if (mine) {
          const line = journalLine(e.eureka && Math.random() < 0.3 ? 'eureka' : page, save.journal);
          if (line.fresh) { save.journal.push(line.id); run.lines.push(line.id); persist(); sfx.page(); }
          speak(line.text, { force: line.fresh, ms: 3400 });
        } else if (!DEMO || e.n >= 4) { const list = JOURNAL[page]; panel.say(list[showN++ % list.length], 2600); }
      } else if (mine && e.n >= 12) speak(say('galaxy'), { force: true });
      if (mine) {
        if (run.hint) { run.hint = null; tip.hide(); }
        if (S.stats.loops === 4 && S.stats.flourish < 2) coach('chain');
        if (e.loops === 2) speak(say('flourish'));
      }
      break;
    }
    case 'mixed':
      fx.mixed(R, e); sfx.mixed();
      if (mine) { shell.haptic([20, 40, 20]); speak(say('mixed'), { force: true }); coach('mixed'); }
      break;
    case 'cut':
      fx.cut(R, e); sfx.cut();
      if (mine) { shell.haptic(40); speak(say('cut'), { force: true }); }
      break;
    case 'fade': fx.fade(R, e.pts); break;
    case 'land': {
      const now = performance.now();
      if (now - lastLand > 70) { lastLand = now; sfx.land(e.kind); }
      fx.ring(R, e.x, e.y, lightOf(e.kind), 1.5, 0.3);
      break;
    }
    case 'hour': {
      const cfg = S.cfg, label = hourLabel(e.hour, cfg.startHour);
      fx.hour(R, label);
      if (run.mode === 'title' || DEMO) break;
      sfx.hour();
      shell.toast(cfg.zen ? label : `${label} · +${e.bonus}`);
      speak(hourLine(clockAt(S.clock, cfg).h24), { force: true });
      break;
    }
    case 'event':
      if (run.mode === 'title') break;
      sfx.event(e.name);
      if (!DEMO) shell.toast(EVENTS[e.name] || e.name, e.name === 'cringes' || e.name === 'whatifs' ? 'warn' : '');
      speak(say(e.name), { force: true });
      break;
    case 'special':
      sfx.special(e.kind);
      if (mine) { coach(e.kind); if (e.kind === 'cringe' || e.kind === 'phone' || e.kind === 'whatif') speak(say(e.kind)); }
      break;
    case 'danger':
      if (!mine) break;
      if (e.on) { speak(say('danger'), { force: true }); shell.haptic([30, 60, 30]); } else if (!S.over) { speak(say('safe'), { force: true }); sfx.safe(); }
      break;
    case 'empty':
      fx.empty(R, e.bonus); sfx.empty();
      scoreChip.set(S.score, { pop: true });
      speak(say('empty'), { force: true });
      break;
    case 'split': fx.puff(R, e.x, e.y, '#7c6cff', 12); sfx.split(); speak(say('split')); break;
    case 'buzz': sfx.buzz(); fx.ring(R, e.x, e.y, '#3ff0c3', 2.2, 0.4); break;
    case 'gone': fx.puff(R, e.x, e.y, lightOf(e.kind), 7); break;
    case 'dawn': speak(say('dawn')); break;
    case 'sunrise': endRun(true); break;
    case 'over': endRun(false); break;
    default: break;
  }
}

// ---------- runs ----------
const seedNow = () => SEED || ((Math.random() * 0x7fffffff) | 0) + 1;

function begin(opts, seed, withBot) {
  const cfg = makeConfig(opts);
  S = createSim(cfg, seed, L ? L.aspect : 0.7);
  bot = withBot ? createBot('demo', seed) : null;
  auto = !withBot && QA_AUTO ? createBot(QA_AUTO, seed) : null;
  run = { opts, mode: cfg.mode, night: cfg.night || 0, key: cfg.key || '', cfg, lines: [], ended: false, endT: 0, won: false, hint: null, hintT: 0, dawn: 0 };
  pointerId = null; keyPen = null; freeze = 0; beat = 0; lastSay = 0;
  fx.clear(R); panel.hush(); tip.hide(); banner.hide();
  layout();
}

function startRun(opts) {
  const o = opts.mode === 'daily' ? { ...opts, key: opts.key || dateKey(new Date()) } : opts;
  begin(o, o.mode === 'daily' ? dailySeed(o.key) : seedNow(), false);
  shell.started({ count: !QA });
  layout();
  scoreChip.set(0); clockChip.set(clockLabel(0, S.cfg));
  music.start();
  const n = nightOf(run.night);
  if (run.mode === 'night') banner.show({ kicker: `${n.day} night · 12:00 AM`, title: n.title, blurb: n.blurb });
  else if (run.mode === 'daily') { const t = dailyTwist(run.key); banner.show({ kicker: 'Daily · the same night for everyone', title: t.name, blurb: t.blurb }); }
  else if (run.mode === 'zen') { banner.show({ kicker: 'Zen', title: 'No pressure', blurb: say('zen') }); }
  else banner.show({ kicker: 'Insomnia', title: 'No bedtime', blurb: say('insomnia') });
  // a first run: once the night's banner has had its moment, a ring round a bunch and the one-line how-to
  if (!save.tips.loop) { run.hint = {}; run.hintT = 2; setTimeout(() => { if (run?.hint) coach('loop'); }, 2000); }
}

function endRun(won) {
  if (run.ended) return;
  run.ended = true; run.won = won; run.endT = 0;
  pointerId = null;
  music.stop();
  tip.hide();
  if (bot) return;
  if (won) { sfx.sunrise(); fx.sunrise(R); fx.word(R, S.W / 2, S.H * 0.36, 'SUNRISE', '#ffe9a0', 2.4); speak('…zzz', { force: true, ms: 5000 }); }
  else { fx.spiral(R); sfx.spiral(); speak('too many thoughts—', { force: true, ms: 4000 }); shell.haptic([60, 40, 120]); }
}

function showOver() {
  const cfg = S.cfg, c = clockAt(S.clock, cfg), st = S.stats;
  const time = clockLabel(S.clock, { ...cfg, step: 1 }), awake = awakeLabel(S.clock, cfg.hourLen);
  const res = applyRun(save, { mode: run.mode, night: run.night, key: run.key, won: run.won, score: S.score, clock: S.clock, stats: st, lines: run.lines });
  save = res.save;
  persist();
  if (res.newStickers.length) sfx.sticker();
  const n = nightOf(run.night);
  const facts = { mode: run.mode, won: run.won, stars: res.stars, h24: c.h24, awake, sorted: st.sorted, day: n?.day, time, scoreText: fmt(S.score) };
  const best = run.mode === 'night' ? save.nights[run.night]?.best : run.mode === 'daily' ? save.daily.best : save.best;
  const next = run.mode === 'night' && run.won ? nextNight(save) : null;
  const again = next && next !== run.night ? { label: `${nightOf(next).day} night`, go: () => startRun({ mode: 'night', night: next }) }
    : { label: run.won ? 'Play again' : 'Try again', go: () => startRun(run.opts) };
  shell.over({
    title: run.won ? 'She’s asleep' : run.mode === 'night' ? `She spiraled at ${time}` : 'She spiraled',
    score: S.score, label: run.mode === 'night' ? `points · ${n.day} night` : `points · awake for ${awake}`,
    best: best || null, isBest: res.isBest,
    stats: [
      [run.mode === 'night' ? 'Got to' : 'Awake for', run.mode === 'night' ? (run.won ? 'Sunrise' : time) : awake],
      ['Thoughts sorted', fmt(st.sorted)],
      ['Biggest loop', String(st.biggest)],
      ['Longest train', `×${Math.min(TUNE.trainMax, 1 + Math.floor(st.train / TUNE.trainStep))}`],
    ],
    line: endLine(facts), share: shareText(facts),
    extra: overExtra({ stars: run.mode === 'night' && run.won ? res.stars : null, newStickers: res.newStickers, newLines: res.newLines }),
    again: again.label, onAgain: again.go, onMenu: toTitle,
  });
}

// a Zen sitting ends when the player leaves it: what it earned is kept, quietly
function zenOver() {
  run.ended = true;
  const res = applyRun(save, { mode: 'zen', won: false, score: S.score, clock: S.clock, stats: S.stats, lines: run.lines });
  save = res.save;
  persist();
  for (const s of res.newStickers) setTimeout(() => shell.toast(`New sticker: ${s.name}`, 'good', 2600), 400);
}

// ---------- the title: the game plays itself behind it ----------
function openCard(make) {
  const close = () => { shell.closeCard(); cardOpen = false; toTitle(); };
  cardOpen = true;
  shell.card(make(close), { label: 'OVERTHINKING' });
}
let cardOpen = false;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardOpen && shell.state === 'title') { e.preventDefault(); shell.closeCard(); cardOpen = false; toTitle(); } });

function toTitle() {
  music.stop();
  if (run?.mode !== 'title') begin({ mode: 'title' }, seedNow(), true);
  const next = nextNight(save), first = !save.nights[1];
  const today = dateKey(new Date()), twist = dailyTwist(today);
  shell.title({
    logo: ['OVER', { text: 'THINKING', tone: 'accent' }],
    tagline: 'It’s midnight. She can’t sleep. Circle her thoughts before they spiral.',
    play: first ? 'Play' : next ? `${nightOf(next).day} night` : 'Insomnia',
    onPlay: () => startRun(next ? { mode: 'night', night: next } : { mode: 'insomnia' }),
    modes: [
      { label: 'The week', sub: `★ ${totalStars(save)}/${MAX_STARS}`, onClick: () => openCard((close) => weekCard({ save, onClose: close, onPick: (id) => { shell.closeCard(); cardOpen = false; startRun({ mode: 'night', night: id }); } })) },
      { label: 'Insomnia', sub: save.best ? `best ${fmt(save.best)}` : 'no bedtime', locked: !(save.nights[1]?.stars > 0), lockedText: 'See Monday’s sunrise first', onClick: () => startRun({ mode: 'insomnia' }) },
      { label: 'Daily', sub: save.daily.key === today && save.daily.best ? `today ${fmt(save.daily.best)}` : twist.name, onClick: () => startRun({ mode: 'daily', key: today }) },
      { label: 'Zen', sub: 'no pressure', onClick: () => startRun({ mode: 'zen' }) },
    ],
    extra: titleExtra({
      save,
      onJournal: () => openCard((close) => journalCard({ save, onClose: close })),
      onStickers: () => openCard((close) => stickersCard({ save, onClose: close, onRibbon: (id) => { save.ribbon = id; persist(); shell.audio.sfx('select'); } })),
    }),
    best: save.best || null, bestLabel: 'Insomnia best',
  });
  layout();
}

// ---------- the loop ----------
function tick(dt) {
  if (!S || !L) return;
  if (freeze > 0) { freeze -= dt; return; }
  if (bot && !S.over) drive(bot, S, dt);
  else if (auto && !S.over) drive(auto, S, dt);
  keyboardPen(dt);
  step(S, dt);
  flush();
  updateFx(R, dt);
  if (run.ended) {
    run.endT += dt;
    if (run.won) run.dawn = Math.min(1, run.dawn + dt / 2.2);
    if (bot) { if (run.endT > 1.2) begin(run.opts, S.seed + 1, true); return; }
    if (shell.state === 'play' && run.endT > (run.won ? 2.6 : 1.7)) showOver();
    return;
  }
  // a new player's first loop: a ring round one bunch, staying with it as it drifts
  if (run.hint && !bot) {
    run.hintT -= dt;
    if (run.hintT <= 0) { run.hintT = 0.2; aimHint(); }
    const to = run.hintTo;
    if (to && run.hint.r) { const k = 1 - Math.exp(-dt * 9); run.hint.x += (to.x - run.hint.x) * k; run.hint.y += (to.y - run.hint.y) * k; run.hint.r += (to.r - run.hint.r) * k; }
    else if (to) run.hint = { ...to };
  }
  if (!bot && S.full) {
    beat -= dt;
    if (beat <= 0) { const k = S.danger / TUNE.overT; sfx.heartbeat(k); beat = 0.85 - 0.4 * k; }
  }
}

// Where the first-loop ring goes: a small bunch of one kind whose loop fits inside the field (a ring that leaves the
// screen can't be drawn), the one already shown for as long as it holds, else the biggest nearest the middle. While
// the pen is down the ring stays where the player saw it.
function aimHint() {
  if (S.pen.down && run.hint.r) return;
  const fits = (g) => g.cx - g.rho > 0.35 && g.cy - g.rho > 0.35 && g.cx + g.rho < S.W - 0.35 && g.cy + g.rho < S.H - 0.35;
  const list = targets(S, PROFILES.casual).filter((g) => !g.solo && !g.dismiss && g.n >= 2 && g.n <= 5 && g.rho <= 4.4 && fits(g));
  const kept = run.hintIds && list.find((g) => g.ids.filter((id) => run.hintIds.has(id)).length >= Math.min(2, run.hintIds.size));
  const mid = (g) => Math.hypot(g.cx - S.W / 2, g.cy - S.H * 0.45);
  const best = kept || list.sort((a, b) => (b.n - a.n) || (mid(a) - mid(b)))[0];
  if (best) { run.hintIds = new Set(best.ids); run.hintTo = { x: best.cx, y: best.cy, r: best.rho }; run.hintLost = 0; return; }
  // nothing to point at for a moment (a stray drifted in): the ring waits where it was, then goes
  run.hintLost = (run.hintLost || 0) + 0.2;
  if (run.hintLost > 0.8) { run.hintIds = null; run.hintTo = null; run.hint = {}; }
}

function frame(alpha, dt) {
  if (!S || !L) return;
  const cfg = S.cfg, n = count(S), k = n / cfg.cap;
  const pv = S.pen.down ? preview(S) : null;
  draw(R, S, {
    alpha: freeze > 0 ? 1 : alpha, hf: S.clock / cfg.hourLen + cfg.startHour + run.dawn * 0.2,
    colors: ribbonOf(save.ribbon).colors, pv,
    hover: keyPen || (playing() ? hover : null), keyPen: Boolean(keyPen),
    fillK: cfg.zen ? 0 : k, hint: run.hint?.r && !run.ended ? run.hint : null, dim: run.mode === 'title' ? 0.42 : 0, sunrise: run.dawn,
  });
  if (run.mode === 'title') return;
  scoreChip.set(S.score);
  const clock = clockLabel(S.clock, cfg);
  clockChip.set(clock);
  const mul = Math.min(TUNE.trainMax, 1 + Math.floor(S.train / TUNE.trainStep));
  panel.set({
    count: n, cap: cfg.cap, full: S.full, zen: cfg.zen, train: mul, trainK: clamp(S.trainT / TUNE.trainT, 0, 1),
    status: S.over?.won ? 'asleep' : S.over ? 'spiraling' : S.full ? 'context full!' : S.slow > 0 ? 'breathing…' : !cfg.zen && k > 0.75 ? 'overthinking…' : 'thinking…',
    effect: S.slow > 0 ? `Deep breath ${Math.ceil(S.slow)}s` : S.tea > 0 ? 'Chamomile' : S.zoom > 0 ? 'Zoomies' : '',
  });
  if (DEMO) panel.demo(S.score, clock);
  if (!bot) {
    music.tension(S.full ? 2 : !cfg.zen && k > 0.7 ? 1 : 0);
    if (!cfg.zen && k > 0.7) coach('fill');
  }
  // a slow machine: fewer pixels (the picture softens a little, the game keeps its pace)
  if (dt > 0.03) { if (++slow > 90 && quality > 0.55) { quality = Math.max(0.5, quality - 0.25); slow = 0; layout(); } } else if (slow > 0) slow--;
}

const loop = createLoop({ step: STEP, update: tick, render: frame, paused: () => shell.state === 'pause', speed: () => qaSpeed });
if (QA) window.__ot = { get S() { return S; }, get L() { return L; }, get run() { return run; }, get save() { return save; }, speed(n) { qaSpeed = clamp(Number(n) || 1, 0.25, 16); } };

layout();
if (DEMO) { begin({ mode: 'demo' }, SEED || 7, true); shell.started({ count: false }); layout(); }
else if (QA && (QUERY.get('night') || QUERY.get('mode'))) startRun(QUERY.get('night') ? { mode: 'night', night: clamp(Number(QUERY.get('night')) || 1, 1, 7) } : { mode: QUERY.get('mode') });
else toTitle();
loop.start();
