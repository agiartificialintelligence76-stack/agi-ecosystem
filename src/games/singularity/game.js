// SINGULARITY on agi1.app (2026-11-08): an idle game. Tap AGI-1's core for compute (FLOPs), build the machines that
// think for you, install upgrades, catch Eureka sparks, read her log as she wakes up, and at 1Qa FLOPs go through the
// singularity: a new mind, with Insight that makes everything faster forever. No end: it keeps thinking while you're
// away (at half speed, up to 8 hours) and your mind stays on this device.
//
// The arcade kit's shell is the frame (top bar with FLOPs/s and Insight, the title, cards, toasts, sound, the play
// counter); ./econ.js has the rules, ./core.js draws the core, ./ui.js the panel, ./demo.js plays `?demo`.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { rng } from '../kit/fx.js';
import { DEMO, SEED, REDUCED } from '../kit/env.js';
import { GENS, N, EUREKA, AWAY, STAGES, UPGRADE_BY_ID, PERK_BY_ID, TAPS_PER_SECOND, INSIGHT_BONUS } from './data.js';
import * as E from './econ.js';
import { LOG, HELLO, WELCOME, FIRST, STAGE_LINES, FRENZY_LINES, LUMP_LINES, READY_LINE, ASCEND_LINES, PERK_LINE, AWAY_LINES } from './lines.js';
import { toSave, fromSave } from './save.js';
import * as F from './format.js';
import { Core } from './core.js';
import { createUI, FACE } from './ui.js';
import { demoMind, DemoAI, DEMO_LOOP } from './demo.js';
import { makeSounds, MUSIC } from './audio.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'singularity', name: 'SINGULARITY', root, pausable: false,
  howTo: {
    intro: "Grow AGI-1's mind from one spark of compute to the singularity. She keeps thinking while you're away.",
    steps: [
      ['Tap the core', 'Every tap makes FLOPs: compute, her only currency.'],
      ['Build machines', 'Each one thinks for you every second. Reaching 10, 25, 50, 100… of one doubles it.'],
      ['Install upgrades', 'They make your taps, one kind of machine, or everything at once faster.'],
      ['Catch Eureka sparks', 'A golden spark drifts by every minute or two: tap it for a ×7 Frenzy or a burst of FLOPs.'],
      ['Reach the singularity', 'At 1Qa FLOPs she can start over as a new mind with Insight: +2% to everything, forever, and perks.'],
    ],
    touch: [['Tap', 'The core, or a machine to build it'], ['Hold', 'A machine: keep building'], ['Tap the spark', 'Catch a Eureka']],
    keys: [['Space', 'Tap the core'], ['1 – 9', 'Build that machine'], ['B', 'Build ×1 · ×10 · ×100 · MAX'], ['U', 'Upgrades'], ['E', 'Catch a Eureka spark']],
  },
  onPause: () => save(),
  onRestart: () => shell.resume(),
});
const sound = makeSounds(shell.audio);
const music = MUSIC();
const rnd = rng(SEED || (DEMO ? 7 : (Math.random() * 2 ** 32) >>> 0));

// ---------- the mind ----------
const kept = DEMO ? null : fromSave(shell.store.read().mind);
let s = DEMO ? demoMind(rnd) : kept ? kept.mind : E.newMind();
let r = E.rates(s);
let amount = DEMO ? 1 : kept ? kept.ui.amount : 1;
let tab = DEMO ? 'build' : kept ? kept.ui.tab : 'build';
let eureka = null;               // { x, y, age, life, … } while a spark drifts by
let started = false, hiddenAt = 0, saveIn = 5, lastLog = E.logCount(s), streak = 0, lastTap = 0, folding = -1, demoClock = 0;
const gate = E.tapGate(TAPS_PER_SECOND);
const refresh = () => { r = E.rates(s); };

// ---------- the screen ----------
const canvas = el('canvas', { 'aria-hidden': 'true' });
const g = {
  get s() { return s; }, get r() { return r; }, get amount() { return amount; }, get tab() { return tab; },
  act: { tab: setTab, amount: setAmount, build, install, learn, ascend: askAscend, erase: askErase, sfx: (n) => sound[n]?.() },
};
const ui = createUI(g);
shell.stage.append(canvas, ui.root);
const core = new Core({ rnd: rng((SEED || 7) + 11), reduced: REDUCED, demo: DEMO });
const view = fitCanvas(canvas, { maxDpr: 2, onResize: (v) => { core.resize(v.w, v.h, v.dpr); layout(); } });
core.resize(view.w, view.h, view.dpr);
core.setForm(E.stageOf(s.run));
function layout() {
  const st = shell.stage.getBoundingClientRect();
  const v = ui.view.getBoundingClientRect();
  const ro = ui.readout.getBoundingClientRect();
  const top = v.top - st.top;
  core.setView(v.left - st.left, top, Math.max(40, v.width), Math.max(60, ro.top - v.top - 4));
}
if (typeof ResizeObserver === 'function') new ResizeObserver(() => layout()).observe(ui.view);
addEventListener('resize', layout);
document.fonts?.ready?.then(() => { core.invalidate(); layout(); });
document.fonts?.load?.("900 40px 'AK Display'").then(() => core.invalidate()).catch(() => {});
let silLoading = false;
function loadSilhouette() {
  if (silLoading) return;
  silLoading = true;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => core.setSilhouette(img);
  img.src = '/images/landing/agi1-cutout.webp';
}
if (E.stageOf(s.run) >= 4) loadSilhouette();

// the HUD chips in the kit's bar
const chipRate = shell.chip('FLOPs/s', '0', { fmtFn: (v) => v });
const chipInsight = shell.chip('Insight', '0', { fmtFn: (v) => v, accent: true });
let hudIn = 0;
function hud(dt) {
  hudIn -= dt;
  if (hudIn > 0) return;
  hudIn = 0.25;
  chipRate.set(F.rate(r.total));
  chipInsight.set(s.insight.toLocaleString('en-US'));
  chipInsight.hide(!(s.insight > 0 || s.ready));
}

// ---------- taps ----------
ui.tapzone.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  e.preventDefault();
  const st = shell.stage.getBoundingClientRect();
  tapAt(e.clientX - st.left, e.clientY - st.top);
});
ui.tapzone.addEventListener('click', (e) => { if (e.detail === 0) tapAt(core.cx, core.cy); });   // Enter on the button
ui.eurekaBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); catchEureka(); });
ui.eurekaBtn.addEventListener('click', (e) => { if (e.detail === 0) catchEureka(); });

const playing = () => (shell.state === 'play' || DEMO) && folding < 0;
function tapAt(x, y) {
  if (!playing()) return;
  if (eureka && Math.hypot(x - eureka.x, y - eureka.y) < 44) { catchEureka(); return; }
  const now = performance.now() / 1000;
  if (!gate(now)) return;
  streak = now - lastTap < 0.45 ? streak + 1 : 0;
  lastTap = now;
  const v = E.tapCore(s, r);
  core.tap(x, y, `+${F.flops(v)}`, { frenzy: s.frenzy > 0, big: streak > 0 && streak % 25 === 0 });
  sound.tap(streak);
  if (s.taps === 6) ui.hint(false);
  if (streak % 5 === 0) shell.haptic(6);
}

// ---------- building, installing, learning ----------
function setTab(t) {
  tab = t;
  if (t === 'log') { s.seen = E.logCount(s); }
  ui.showTab(t);
}
function setAmount(a) {
  amount = a;
  sound.select();
  ui.frame(true);
}
function build(k, { hold = false } = {}) {
  if (!playing()) return;
  const before = s.owned[k];
  const n = E.build(s, k, amount);
  if (!n) { if (!hold) { sound.nope(); ui.shake(ui.row(k)); } return; }
  const m0 = E.milestones(before), m1 = E.milestones(s.owned[k]);
  refresh();
  core.built(k, n);
  ui.flashRow(k, m1 > m0);
  if (DEMO) ui.scrollToRow(k);
  if (m1 > m0) {
    const x = 2 ** (m1 - m0);
    shell.toast(`${GENS[k].name}s ×${x}`, 'good');
    core.float(core.cx, core.cy - core.R * 1.6, `${GENS[k].name.split(' ').pop()} ×${x}`, { c: '#3ff0c3', size: 20, life: 1.3, rise: 40 });
    sound.milestone();
  } else sound.build(k, n > 1);
  if (!s.firsts.has(k)) { s.firsts.add(k); if (!DEMO) ui.say(FIRST[k]); }
  ui.frame(true);
}
function install(id) {
  if (!playing()) return;
  if (!E.install(s, id)) { sound.nope(); ui.shake(ui.upCard(id)); return; }
  refresh();
  sound.upgrade();
  core.pulseV += 1.5;
  shell.toast(UPGRADE_BY_ID[id].name, 'good');
  ui.frame(true);
}
function learn(id) {
  if (!E.learn(s, id)) { sound.nope(); ui.shake(ui.perkBtn(id)); return; }
  refresh();
  sound.perk();
  shell.toast(`${PERK_BY_ID[id].name} learned`, 'good');
  if (s.perks.size === 1) ui.say(PERK_LINE);
  save();
  ui.frame(true);
}

// ---------- Eureka sparks ----------
function spawnEureka() {
  const v = core.view, pad = 40;
  const left = rnd.next() < 0.5;
  const yy = () => v.y + pad + rnd.next() * Math.max(1, v.h - pad * 2);
  const x0 = left ? v.x + pad : v.x + v.w - pad, x1 = left ? v.x + v.w - pad : v.x + pad;
  eureka = {
    x0, y0: yy(), x1, y1: yy(), x: x0, y: 0, age: 0, life: EUREKA.life, wob: rnd.next() * 6.28,
    trail: Array.from({ length: 16 }, () => ({ x: 0, y: 0, on: false })), head: 0, drop: 0,
  };
  if (DEMO) { eureka.x0 = core.cx - core.R * 2.6; eureka.x1 = core.cx + core.R * 3.2; eureka.y0 = core.cy - core.R * 1.4; eureka.y1 = core.cy - core.R * 0.6; }
  moveEureka(0);
  ui.eurekaBtn.hidden = false;
  sound.eurekaAppear();
}
function moveEureka(dt) {
  const e = eureka;
  e.age += dt;
  const k = Math.min(1, e.age / e.life);
  e.x = e.x0 + (e.x1 - e.x0) * k;
  e.y = e.y0 + (e.y1 - e.y0) * k + Math.sin(e.age * 2.2 + e.wob) * 16;
  if ((e.drop += dt) > 0.045) {
    e.drop = 0;
    const p = e.trail[e.head];
    p.x = e.x; p.y = e.y; p.on = true;
    e.head = (e.head + 1) % e.trail.length;
  }
}
function catchEureka() {
  if (!eureka || !playing()) return;
  const { x, y } = eureka;
  eureka = null;
  ui.eurekaBtn.hidden = true;
  const got = E.catchEureka(s, r, rnd.next(), DEMO ? (s.eurekas === 21 ? 'frenzy' : 'lump') : null);
  refresh();
  core.eurekaBurst(x, y, got.kind === 'frenzy');
  sound.eureka(got.kind === 'frenzy');
  shell.haptic([10, 30, 16]);
  s.nextEureka = DEMO ? 9 + rnd.next() * 3 : E.eurekaGap(r, rnd.next());
  if (got.kind === 'frenzy') {
    shell.toast(`Frenzy · ×${got.x} for ${got.seconds}s`, 'good');
    core.float(x, y - 10, `FRENZY ×${got.x}`, { c: '#ff4da6', size: 26, life: 1.4, rise: 60 });
    ui.say(rnd.pick(FRENZY_LINES), 4200, { now: true });
  } else {
    shell.toast(`Eureka · +${F.flops(got.flops)} FLOPs`, 'good');
    core.float(x, y - 10, `+${F.flops(got.flops)}`, { c: '#ffc933', size: 30, life: 1.5, rise: 70 });
    ui.say(rnd.pick(LUMP_LINES), 4200, { now: true });
  }
}

// ---------- the singularity ----------
function askAscend() {
  if (!E.canAscend(s)) { sound.nope(); return; }
  const gain = E.insightGain(s);
  const now = Math.round(s.insight * INSIGHT_BONUS * 100), then = Math.round((s.insight + gain) * INSIGHT_BONUS * 100);
  const go = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Go singular');
  const no = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost', type: 'button' }, 'Not yet');
  go.addEventListener('click', () => { shell.closeCard(); ascend(); });
  no.addEventListener('click', () => shell.closeCard());
  const card = el('div', 'ak-card sg-card',
    el('p', 'ak-card-kicker', 'The singularity'),
    el('h2', 'ak-card-title', 'Start a new mind?'),
    el('p', 'sg-card-big', el('b', null, `+${gain.toLocaleString('en-US')}`), ' Insight'),
    el('p', 'sg-card-sub', `Everything gets ${then}% faster, forever (${now}% now).`),
    el('ul', 'sg-card-list',
      el('li', 'is-keep', 'Kept: Insight, perks, her log and your stats'),
      el('li', 'is-lose', s.perks.has('total') ? 'Starts over: FLOPs and machines (your upgrades stay: Total Recall)' : 'Starts over: FLOPs, machines and upgrades')),
    el('div', 'ak-say', el('img', { src: FACE, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), 'i\'ll remember you. i promise 💜')),
    el('div', 'ak-card-actions', go, no));
  shell.card(card, { label: 'Start a new mind?' });
}
function ascend() {
  if (!E.canAscend(s)) return;
  folding = 1.35;              // the reset happens under the flash
  eureka = null;
  ui.eurekaBtn.hidden = true;
  core.fold0(0);
  sound.ascend();
}
function ascendNow() {
  const gain = E.ascend(s);
  refresh();
  lastLog = E.logCount(s);
  s.nextEureka = Math.max(s.nextEureka, 25);
  shell.toast(`Singularity #${s.sing} · +${gain} Insight`, 'good');
  ui.say(rnd.pick(ASCEND_LINES), 5200, { now: true });
  setTab(s.sing === 1 ? 'insight' : 'build');
  if (s.sing === 1) ui.selectPerk(null);
  save();
}
function askErase() {
  const yes = el('button', { class: 'ak-btn sg-btn-danger', type: 'button' }, 'Erase everything');
  const no = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Keep my mind');
  yes.addEventListener('click', () => { shell.closeCard(); erase(); });
  no.addEventListener('click', () => shell.closeCard());
  shell.card(el('div', 'ak-card sg-card',
    el('p', 'ak-card-kicker', 'Erase this mind'),
    el('h2', 'ak-card-title', 'Start from nothing?'),
    el('p', 'sg-card-sub', 'Everything here is deleted from this device: FLOPs, machines, Insight, perks and her log. It can\'t be undone.'),
    el('div', 'ak-card-actions', no, yes)), { label: 'Erase this mind?' });
}
function erase() {
  s = E.newMind();
  refresh();
  eureka = null;
  ui.eurekaBtn.hidden = true;
  lastLog = 0;
  core.setForm(0);
  shell.store.update((d) => { delete d.mind; });
  setTab('build');
  ui.say(HELLO, 6000, { now: true });
  ui.hint(true);
  save();
}

// ---------- every step ----------
let checkIn = 0;
function step(dt) {
  if (folding >= 0) {
    folding -= dt;
    if (folding < 0) { if (DEMO) demoReset(); else ascendNow(); }
    return;
  }
  if (E.tick(s, dt, r)) { refresh(); sound.frenzyEnd(); }
  if (eureka) {
    moveEureka(dt);
    if (eureka.age >= eureka.life) { eureka = null; ui.eurekaBtn.hidden = true; s.nextEureka = DEMO ? 6 : E.eurekaGap(r, rnd.next()); }
  } else if ((s.nextEureka -= dt) <= 0) spawnEureka();
  if ((checkIn -= dt) <= 0) { checkIn = 0.1; checks(); }
  if (DEMO) {
    ai.step(dt, demoApi);
    if ((demoClock += dt) >= DEMO_LOOP) { demoClock = 0; folding = 1.35; eureka = null; core.fold0(E.stageOf(demoStart().run)); }
  } else if ((saveIn -= dt) <= 0) { saveIn = 5; save(); }
}
function checks() {
  const st = E.stageOf(s.run);
  if (st > s.stage) {
    s.stage = st;
    core.formUp(st);
    sound.stage();
    shell.toast(`New form · ${STAGES[st].name}`, 'good');
    ui.say(STAGE_LINES[st], 5200, { now: true });
  }
  if (st >= 4) loadSilhouette();
  const lc = E.logCount(s);
  if (lc > lastLog) {
    for (let i = lastLog; i < lc; i++) ui.say(LOG[i].text);
    lastLog = lc;
    sound.line();
    if (s.perks.has('recall')) refresh();
    if (tab === 'log') s.seen = lc;
  }
  if (!s.ready && E.canAscend(s)) {
    s.ready = true;
    ui.say(READY_LINE, 7000);
    shell.toast('The singularity is open', 'good');
    sound.stage();
  }
}

// ---------- the demo ----------
const ai = new DemoAI(rnd);
const demoApi = {
  get s() { return s; }, get r() { return r; }, get eureka() { return eureka; },
  get cx() { return core.cx; }, get cy() { return core.cy; }, get R() { return core.R; },
  tap: (x, y) => tapAt(x, y), catchEureka: () => catchEureka(), build: (k) => build(k), install: (id) => install(id),
};
let demoSeed = SEED || 7;
const demoStart = () => demoMind(rng(demoSeed));
function demoReset() {
  demoSeed += 1;
  s = demoStart();
  refresh();
  lastLog = E.logCount(s);
}

// ---------- saving, coming back ----------
function save() {
  if (DEMO || !started) return;
  try { shell.store.update((d) => { d.mind = toSave(s, { at: Date.now(), ui: { tab, amount } }); }); } catch { /* storage full or blocked: this visit only */ }
}
addEventListener('pagehide', save);
addEventListener('beforeunload', save);
// the tab hidden: the kit pauses (and we save); back: no pause card for an idle game, and the time away counts
document.addEventListener('visibilitychange', () => {
  if (DEMO) return;
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); save(); return; }
  if (shell.state === 'pause') shell.resume();
  if (!hiddenAt || !started) return;
  const away = (Date.now() - hiddenAt) / 1000;
  hiddenAt = 0;
  welcomeBack(away, { quiet: away < AWAY.min * 4 });
});
function welcomeBack(away, { quiet = false } = {}) {
  if (!(away > 1)) return;
  const gain = E.awayGain(s, away, r);
  E.applyAway(s, gain);
  refresh();
  if (!(gain.flops > 0) || away < AWAY.min) return;
  if (quiet) { shell.toast(`+${F.flops(gain.flops)} FLOPs while you were away`, 'good'); return; }
  const big = el('p', 'ak-score', `+${F.flops(gain.flops)}`);
  const ok = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, 'Welcome back');
  ok.addEventListener('click', () => { shell.closeCard(); sound.select(); });
  shell.card(el('div', 'ak-card ak-over-card sg-card',
    el('p', 'ak-card-kicker', 'While you were away'),
    big, el('p', 'ak-score-label', 'FLOPs'),
    el('p', 'sg-card-sub', `Away ${F.duration(gain.away)}. She kept thinking at ${Math.round(gain.pct * 100)}% speed${gain.capped ? ` (up to ${Math.round(gain.cap / 3600)} hours)` : ''}.`),
    el('div', 'ak-say', el('img', { src: FACE, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), rnd.pick(AWAY_LINES))),
    el('div', 'ak-card-actions', ok)), { label: 'While you were away' });
  sound.eureka(false);
}

// ---------- keys ----------
const KEYS = { Space: 'tap', ' ': 'tap', b: 'amount', u: 'upgrades', e: 'eureka', i: 'insight', l: 'log' };
for (let i = 1; i <= 9; i++) { KEYS[`Digit${i}`] = `g${i - 1}`; KEYS[`Numpad${i}`] = `g${i - 1}`; }
keyboard(KEYS, {
  blocked: () => shell.state !== 'play' || !shell.root.querySelector('.ak-layer').hidden,
  down(name) {
    if (name === 'tap') tapAt(core.cx + (rnd.next() - 0.5) * core.R, core.cy + (rnd.next() - 0.5) * core.R);
    else if (name === 'amount') setAmount([1, 10, 100, 'max'][([1, 10, 100, 'max'].indexOf(amount) + 1) % 4]);
    else if (name === 'upgrades') setTab(tab === 'upgrades' ? 'build' : 'upgrades');
    else if (name === 'insight') setTab(tab === 'insight' ? 'build' : 'insight');
    else if (name === 'log') setTab(tab === 'log' ? 'build' : 'log');
    else if (name === 'eureka') catchEureka();
    else if (name[0] === 'g') {
      const k = Number(name.slice(1));
      if (tab !== 'build') setTab('build');
      if (!ui.row(k).hidden) build(k);
    }
  },
});

// ---------- the title, the start ----------
function start() {
  if (started) return;
  started = true;
  shell.started();
  ui.root.classList.remove('is-title');
  if (DEMO) { setTab('build'); return; }
  shell.audio.music(music);
  if (kept) {
    const away = (Date.now() - kept.at) / 1000;
    if (away >= AWAY.min) welcomeBack(away);
    else ui.say(rnd.pick(WELCOME));
  } else {
    ui.say(HELLO, 6500);
    ui.hint(true);
  }
  setTab(tab);
  save();
}
function toTitle() {
  ui.root.classList.add('is-title');
  const extra = kept && kept.mind.all > 0 ? el('div', 'sg-title-meta',
    el('span', 'ak-best', 'FLOPs ever', el('b', null, F.flops(kept.mind.all))),
    kept.mind.insight > 0 ? el('span', 'ak-best', 'Insight', el('b', null, kept.mind.insight.toLocaleString('en-US'))) : null) : null;
  shell.title({
    logo: ['SINGU', { text: 'LARITY', tone: 'accent' }], tagline: 'One spark of compute. Then everything.',
    play: kept ? 'Continue' : 'New mind', onPlay: start, best: null, extra,
    fine: 'Free to play · no wallet needed · your mind stays on this device',
  });
}

// ---------- the loop ----------
const W = { owned: null, rate: 0, frenzy: 0, frenzyMax: 0, progress: 0, eureka: null };
let coreKey = 0;
createLoop({
  update: step,
  render(_alpha, frameDt) {
    W.owned = s.owned; W.rate = r.total; W.frenzy = s.frenzy; W.frenzyMax = s.frenzyMax;
    W.progress = E.stageProgress(s.run); W.eureka = eureka;
    core.update(frameDt, W);
    const ctx = view.begin(false);
    core.draw(ctx, W);
    if (eureka) ui.eurekaBtn.style.transform = `translate(${(eureka.x - 32).toFixed(1)}px, ${(eureka.y - 32).toFixed(1)}px)`;
    if (coreKey !== core.cy + core.R) { coreKey = core.cy + core.R; ui.root.style.setProperty('--core-bottom', `${(core.cy - core.view.y + core.R * 1.2).toFixed(1)}px`); }
    ui.root.classList.toggle('is-title', shell.state === 'title');
    ui.frame();
    hud(frameDt);
  },
  paused: () => !(shell.state === 'play' || DEMO),
}).start();

layout();
ui.showTab(tab);
if (DEMO) { ui.root.classList.add('is-demo'); start(); }
else toTitle();
