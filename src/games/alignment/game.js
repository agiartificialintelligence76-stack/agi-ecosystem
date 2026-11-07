// ALIGNMENT on agi1.app (2026-11-08): run AGI-1's lab one card at a time. Every day someone from the lab brings a
// card; drag it left or right (or tap a button, or use the arrow keys) to choose, and the four meters move: People,
// Safety, Compute, Heart. Empty or full and the lab is done, one of sixteen endings (eight of them secret, at the end
// of a story). The score is the days it lasted. The arcade kit's frame (../kit/shell.js) around it; the deck and the
// rules are pure modules (./cards.js, ./engine.js), the drawing ./render.js and ./art.js, the layout ./layout.js, its
// own player ./ai.js (the `?demo` preview), its sounds ./sound.js. Bests and endings stay on this device.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Particles, Shake, rng, clamp, ease, lerp, approach } from '../kit/fx.js';
import { DEMO, SEED, QUERY, TOUCH } from '../kit/env.js';
import { BY_ID, WHO, METERS, METER_NAMES, ENDINGS, ENDING_BY_ID, HELLOS } from './cards.js';
import { createRun, draw, choose, dots as dotsOf, versionOf, progressOf, inDanger } from './engine.js';
import { pickSide } from './ai.js';
import { computeLayout } from './layout.js';
import * as R from './render.js';
import { createSound } from './sound.js';
import { createChoices, endingsCard, overExtra } from './ui.js';
import { MILESTONE_SUBS, DANGER_LINES, pick } from './lines.js';

const NAME = 'ALIGNMENT';
const TAGLINE = 'Run her lab. Swipe yes or no. Keep it all in balance.';
const QA = QUERY.get('qa');            // testing only: 'low' (Safety about to empty), 'secret' (a secret ending next), 'year' (day 364), 'v2' (day 49)
const KEEP = !DEMO && !QA;             // a demo or a test run keeps no endings
const root = document.getElementById('ak-root');
const DEAL_T = 0.42, FLY_T = 0.34, GAP_T = 0.12;

const shell = createShell({
  game: 'alignment', name: NAME, root,
  howTo: {
    intro: 'You run AGI-1\'s lab. Every day someone brings you a card, and every choice moves four meters.',
    steps: [
      ['Swipe the card', 'Drag it left or right and let go past the edge to choose. Or tap one of the two buttons.'],
      ['Read the dots', 'While you lean, dots pop up over the meters that will move: a big dot is a big change. Never which way.'],
      ['Keep it in balance', 'If People, Safety, Compute or Heart runs empty or overflows, the lab is done. Last as many days as you can.'],
      ['Collect the endings', 'There are sixteen ways it can end. Eight are secret, at the end of a story that takes a few choices.'],
    ],
    touch: [['Drag', 'Lean the card; let go past the edge to choose'], ['Tap a button', 'Choose that side']],
    keys: [['← →', 'Lean the card that way'], ['Again / Enter', 'Choose it'], ['Mouse', 'Drag the card, or click a button'], ['Esc / P', 'Pause']],
  },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
  onPause: () => sound.music(false),
  onResume: () => { if (mode === 'play') sound.music(true); },
});
const sound = createSound(shell.audio);

// ---------- the stage ----------
const canvas = el('canvas', { class: 'al-canvas', role: 'img', 'aria-label': 'The card in your hand and the lab\'s four meters' });
const live = el('p', { class: 'al-sr', 'aria-live': 'polite' });
const safe = el('div', { class: 'al-safe', 'aria-hidden': 'true' });
shell.stage.append(canvas, live, safe);
const choices = createChoices(shell.stage, (side) => pickFromButton(side));
let view = null;
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => { if (view && booted) relayout(); } });
const bestChip = shell.chip('Best', shell.store.best() ?? 0);
const endChip = shell.chip('Endings', `${foundCount()}/${ENDINGS.length}`);

// ---------- state ----------
let mode = 'boot';                     // boot · title · play · ending
let ready = false, booted = false;
let run = null, runs = 0, time = 0, hitStop = 0;
let L = null, bg = null, back = null, fan = { groups: [] };
let demoRng = rng(SEED || 7);
const parts = new Particles(420);
const shake = new Shake({ max: 13, decay: 1.7 });
const stars = Array.from({ length: 22 }, (_, i) => {
  const r = rng(1000 + i);
  return { x: r.next(), y: r.next() * 0.8, r: 1.6 + r.next() * 2.4, sp: 0.6 + r.next() * 1.6, ph: r.next() * 6, c: r.chance(0.3) ? '#ffc933' : '#e4d9ff' };
});
const meters = METERS.map((key) => ({ key, shown: 50, from: 50, to: 50, t: 1, flash: 0, sign: 0, bounce: 0, dots: 0, dotsK: 0, dotsTarget: 0 }));
const day = { value: 1, prev: null, roll: 1, pop: 0, progress: 0, version: 'v1.0' };
const hand = { card: null, face: null, chained: false, day: 1, phase: 'none', t: 0, x: 0, v: 0, held: false, pid: null, grab: 0, dragX: 0, keyLean: 0, side: null, overEdge: false, lastX: 0, lastT: 0, vel: 0, auto: false };
let outgoing = null;                   // the card flying away
let buffered = null;                   // a choice made while the next card was still being dealt
let banner = null, end = null, bestAtStart = 0, toldBest = false, met = new Map(), warned = new Set(), closest = null;
let hint = false;                      // the first runs' "drag the card" pill

const leanDist = () => (L ? L.card.w * (L.kind === 'wide' ? 0.3 : 0.36) : 120);
const pageTime = () => performance.now() / 1000;
function foundMap() { return shell.store.read().endings || {}; }
function foundCount() { const f = foundMap(); return ENDINGS.filter((e) => f[e.id]).length; }
const announce = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };

// ---------- layout ----------
function insets() {
  const cs = getComputedStyle(safe), px = (v) => parseFloat(v) || 0;
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}
function relayout() {
  const ins = insets();
  const barH = DEMO ? 0 : Math.round(shell.bar.getBoundingClientRect().height);
  L = computeLayout(view.w, view.h, { top: DEMO ? 2 : Math.max(barH, 50) + 2, bottom: ins.bottom, left: ins.left, right: ins.right, demo: DEMO });
  choices.place(L);
  endChip.hide(view.w < 400);           // a narrow top bar keeps one number: the best (the endings are on the title)
  if (!ready) return;
  bg = R.makeBackground(view.w, view.h, view.dpr);
  back = R.makeBack(L.card.w, L.card.h, view.dpr);
  if (hand.card) hand.face = R.makeFace(hand.card, L.card.w, L.card.h, L.kind, view.dpr, { day: hand.day, chained: hand.chained });
  if (end) end.face = R.makeEndingFace(end.ending, L.card.w, L.card.h, L.kind, view.dpr, { found: end.found, total: ENDINGS.length });
  outgoing = null;
  buildFan();
}
// the title's cards go where the title's words aren't: two fans beside them on a wide screen, one rising from the
// bottom on a phone (as big as the room under the words allows)
function buildFan() {
  const body = root.querySelector('.ak-title-body');
  const r = body && !shell.root.querySelector('.ak-title')?.hidden ? body.getBoundingClientRect() : null;
  const side = r ? Math.min(r.left, view.w - r.right) : 0;
  const mini = (ids, w) => ids.map((who) => R.makeMini(who, w, Math.round(w * 1.42), view.dpr));
  if (r && side >= 230 && view.h >= 480) {
    const w = Math.round(clamp(Math.min(side * 0.42, view.h * 0.2), 110, 200));
    const y = view.h * 0.56 + w * 0.71;
    fan = { bottom: false, groups: [
      { x: r.left / 2, y, faces: mini(['pip', 'nyx', 'byte'], w), spread: 0.2, tilt: -0.06 },
      { x: view.w - (view.w - r.right) / 2, y, faces: mini(['vector', 'agi1', 'glitch'], w), spread: 0.2, tilt: 0.06 },
    ] };
    return;
  }
  const room = view.h - (r ? r.bottom : view.h * 0.72) - 6;
  if (room < 54) { fan = { bottom: true, groups: [] }; return; }
  const h = Math.round(clamp(room / 0.82, 90, 250)), w = Math.round(Math.min(h / 1.42, view.w * 0.26));
  fan = { bottom: true, groups: [{ x: view.w / 2, y: view.h + Math.round(w * 1.42) * 0.12, faces: mini(['pip', 'nyx', 'agi1', 'byte', 'vector'], w), spread: 0.2 }] };
}

// ---------- the title ----------
function toTitle() {
  mode = 'title';
  end = null; outgoing = null; hand.card = null; banner = null;
  sound.music(false);
  choices.show(false);
  const n = foundCount();
  shell.title({
    logo: ['ALIGN', { text: 'MENT', tone: 'accent' }],
    tagline: TAGLINE,
    onPlay: () => newRun(),
    modes: [{ label: `Endings ${n}/${ENDINGS.length}`, sub: n ? 'your collection' : 'find all sixteen', onClick: openEndings }],
    best: shell.store.best(),
    bestLabel: 'Best day',
  });
  requestAnimationFrame(() => { if (mode === 'title' && ready) buildFan(); });
}
let endingsOpen = false;
function openEndings() {
  sound.select();
  endingsOpen = true;
  shell.card(endingsCard({ found: foundMap(), onClose: closeEndings }), { label: 'Endings' });
}
function closeEndings() { endingsOpen = false; shell.closeCard(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && endingsOpen) { e.preventDefault(); closeEndings(); } });

// ---------- a run ----------
function newRun({ demoScript = false } = {}) {
  runs++;
  endingsOpen = false;
  const seed = ((SEED || (DEMO ? 7 : Date.now() % 2147483647)) * 31 + runs * 7919) >>> 0;
  let opts = {};
  if (demoScript) opts = { day: 31, meters: { people: 58, safety: 14, compute: 66, heart: 42 }, first: null };
  else if (QA === 'low') opts = { day: 12, meters: { people: 52, safety: 7, compute: 48, heart: 55 }, first: 'glitch-off' };
  else if (QA === 'secret') opts = { day: 40, flags: ['vec_met', 'vec_friend', 'vec_bff'], first: 'vec-podcast' };
  else if (QA === 'year') opts = { day: 364, meters: { people: 50, safety: 50, compute: 50, heart: 50 }, first: null };
  else if (QA === 'v2') opts = { day: 49, first: null };
  // her hello: the first one the first time, then they take turns
  else { const n = Number(shell.store.read().runs) || 0; opts = { first: HELLOS[n % HELLOS.length] }; }
  run = createRun(seed, opts);
  demo.script = demoScript ? DEMO_SCRIPT.slice() : [];
  mode = 'play';
  shell.started({ count: !DEMO });
  for (const m of meters) { m.shown = m.from = m.to = run.meters[m.key]; m.t = 1; m.flash = 0; m.bounce = 0; m.dots = 0; m.dotsK = 0; }
  Object.assign(day, { value: run.day, prev: null, roll: 1, pop: 0, progress: progressOf(run.day), version: versionOf(run.day) });
  end = null; outgoing = null; buffered = null; banner = null; hitStop = 0;
  bestAtStart = shell.store.best() ?? 0; toldBest = false; met = new Map(); warned = new Set(); closest = null;
  hint = !DEMO && (Number(shell.store.read().runs) || 0) < 3;
  parts.clear();
  sound.music(true);
  choices.show(!DEMO);
  hand.card = null;
  deal();
}

function deal() {
  let card;
  // the demo's opening is a little story of its own (see DEMO_SCRIPT)
  const now = pageTime();
  const finale = DEMO ? demo.script.find((s) => s.finale) : null;
  const regular = DEMO ? demo.script.filter((s) => !s.finale) : [];
  const next = finale && now >= DEMO_FINALE - 0.05 ? finale : regular[0];
  if (next) {
    demo.script = next.finale ? [] : demo.script.filter((s) => s !== next);
    card = BY_ID[next.id];
    run.card = card; run.chained = false;
    demo.forced = next.side;
  } else {
    card = draw(run);
    demo.forced = null;
  }
  met.set(card.who, (met.get(card.who) || 0) + 1);
  hand.card = card;
  hand.chained = run.chained;
  hand.day = run.day;
  hand.face = R.makeFace(card, L.card.w, L.card.h, L.kind, view.dpr, { day: run.day, chained: run.chained });
  hand.phase = 'deal'; hand.t = 0; hand.x = 0; hand.v = 0; hand.keyLean = 0; hand.side = null; hand.overEdge = false; hand.auto = false;
  if (hand.held) { hand.grab = 0; hand.dragX = 0; }
  choices.set(card);
  choices.lean(null);
  // the demo's pace: a card every 1.6 s, the last regular one stretched so the finale is dealt right at DEMO_FINALE
  demo.wait = next?.finale ? 0.5 : 0.32; demo.leanT = -1;
  if (DEMO && finale && !next?.finale) {
    const r = DEMO_FINALE - now;
    if (r >= DEMO_CYCLE && r < DEMO_CYCLE * 2) demo.wait += r - DEMO_CYCLE;
  }
  sound.deal();
  if (METERS.some((k) => inDanger(run.meters[k]))) setTimeout(() => sound.danger(), 260);
  const who = WHO[card.who];
  announce(`Day ${run.day}. ${who.name}: ${card.meow ? `${card.meow} ` : ''}${card.text.replace(/\n> ?/g, ' / ').replace(/^> ?/, '')} Left: ${card.left.label}. Right: ${card.right.label}.`);
}

function pickFromButton(side) {
  if (mode !== 'play' || shell.state !== 'play') return;
  hint = false;
  if (!hand.card) return;
  if (hand.phase === 'deal') { buffered = side; return; }
  if (hand.phase !== 'idle') return;
  hand.x = (side === 'left' ? -1 : 1) * Math.max(Math.abs(hand.x), leanDist() * 0.45);
  commit(side);
}

function commit(side) {
  if (mode !== 'play' || !hand.card || hand.phase !== 'idle') return;
  const res = choose(run, side);
  if (!res) return;
  hint = false;
  outgoing = { face: hand.face.canvas, x: hand.x, side, t: 0, rot: rotOf(hand.x) };
  hand.card = null; hand.phase = 'wait'; hand.t = 0; hand.held = false; hand.pid = null; hand.keyLean = 0;
  canvas.classList.remove('is-dragging');
  choices.lean(null);
  for (const m of meters) { m.dotsTarget = 0; }
  sound.swipe(side);
  shell.haptic(10);
  // the meters move, one after another
  let k = 0;
  METERS.forEach((key, i) => {
    const d = res.deltas[key];
    if (!d) return;
    const m = meters[i];
    m.from = m.shown; m.to = res.after[key]; m.t = -0.06 * k; m.sign = Math.sign(d); m.flash = 1.15 + 0.06 * k; m.bounce = 0;
    m.delay = 0.06 * k;
    sound.meter(key, d, k);
    k++;
  });
  if (res.ending) { startEnding(res); return; }
  for (const key of METERS) {
    const v = res.after[key], d = Math.min(v, 100 - v);
    if (!closest || d < closest.d) closest = { key, v, d };
  }
  if (!DEMO) {
    for (const key of METERS) {
      const v = res.after[key], id = `${key}${v <= 50 ? 0 : 100}`;
      if (inDanger(v) && !inDanger(res.before[key]) && !warned.has(id)) { warned.add(id); setTimeout(() => { if (mode === 'play') shell.toast(DANGER_LINES[id], 'her', 2000); }, 380); break; }
    }
  }
  // the day rolls up; a new version of her every 50 days
  Object.assign(day, { prev: day.value, value: run.day, roll: 0, pop: 1, progress: progressOf(run.day), version: versionOf(run.day) });
  if (res.milestone) milestone(res.milestone);
  if (!DEMO && run.day > bestAtStart && bestAtStart >= 10 && !toldBest) { toldBest = true; shell.toast('New best day!', 'good'); }
  if (!DEMO) bestChip.set(Math.max(bestChip.value || 0, run.day));
}

function milestone(version) {
  banner = { text: `AGI-1 ${version} RELEASED`, sub: pick(MILESTONE_SUBS, run.day / 50 - 1), t: 0, dur: 2.2 };
  sound.milestone();
  shell.haptic([12, 40, 12]);
  const H = L.hud;
  parts.burst({ x: H.dayX, y: H.iconCy, count: 40, speed: [120, 420], life: [0.6, 1.3], size: [4, 9], colors: ['#ffc933', '#ff4da6', '#3ff0c3', '#fffaf0'], gravity: 520, drag: 1.4, shape: 'square', spin: 8, stroke: '#170a36' });
}

// ---------- the end of a run ----------
function startEnding(res) {
  const ending = ENDING_BY_ID[res.ending];
  mode = 'ending';
  hitStop = 0.14;
  shake.kick(ending.secret ? 0.25 : 0.55);
  shell.haptic(ending.secret ? [10, 30, 10] : [30, 40, 60]);
  sound.music(false);
  if (!ending.secret) sound.crack();
  choices.show(false);
  let isNew = false;
  if (KEEP) {
    shell.store.update((d) => {
      d.endings = d.endings || {};
      if (!d.endings[ending.id]) { isNew = true; d.endings[ending.id] = { day: res.day }; }
    });
  } else isNew = DEMO || QA ? true : false;
  const found = KEEP ? foundCount() : Math.max(1, foundCount());
  end = { t: 0, ending, res, isNew, found, focus: ending.meter || null, face: R.makeEndingFace(ending, L.card.w, L.card.h, L.kind, view.dpr, { found, total: ENDINGS.length }), shown: false, rose: false, stamped: false };
  if (!DEMO) endChip.set(`${foundCount()}/${ENDINGS.length}`, { pop: isNew });
  announce(`${ending.name}. ${ending.text}`);
}

function updateEnding(dt) {
  const e = end;
  e.t += dt;
  if (!e.rose && e.t >= 0.95) { e.rose = true; sound.rise(e.ending.secret); if (e.t > 0.5) sound.fall(); }
  if (e.rose && !e.burst && e.t >= 1.35) {
    e.burst = true;
    const C = L.card;
    parts.burst({ x: C.cx, y: C.cy - C.h * 0.3, count: 34, speed: [140, 480], life: [0.5, 1.2], size: [5, 11], colors: e.ending.secret ? ['#ffc933', '#fffaf0', '#ff4da6'] : ['#ff4da6', '#8b66ff', '#fffaf0'], gravity: 380, drag: 1.6, shape: 'star', spin: 6, stroke: '#170a36' });
  }
  if (e.isNew && !e.stamped && e.t >= 1.75) { e.stamped = true; sound.stamp(); shake.kick(0.18); }
  if (DEMO) { if (e.t >= 3.0) newRun(); return; }
  if (!e.shown && e.t >= 3.4) showOver();
}
function skipEnding() {
  if (!end || end.shown) return;
  if (end.t < 1.0) return;
  end.t = Math.max(end.t, 1.8);
  end.rose = true; end.burst = true; end.stamped = true;
  showOver();
}
function showOver() {
  const e = end;
  e.shown = true;
  const ending = e.ending;
  const dayN = run.day;
  shell.over({
    score: dayN,
    label: dayN === 1 ? 'Day' : 'Days',
    title: ending.kicker,
    stats: [['Endings found', `${foundCount()}/${ENDINGS.length}`], ['Her version', versionOf(dayN)],
      ['Closest call', closest ? `${METER_NAMES[closest.key]} ${closest.v}` : '—'], ['Most visits', mostVisits()]],
    line: ending.say,
    extra: overExtra(ending, { isNew: e.isNew, found: e.found, total: ENDINGS.length }),
    share: `AGI-1's lab lasted ${dayN} ${dayN === 1 ? 'day' : 'days'} in ALIGNMENT on agi1.app. ending: ${ending.name} 💜`,
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
  bestChip.set(shell.store.best() ?? dayN);
}

// who came by most this run (AGI-1 herself not counted: she's always there)
function mostVisits() {
  let who = null, n = 0;
  for (const [k, v] of met) if (k !== 'agi1' && v > n) { who = k; n = v; }
  return who ? `${WHO[who].name.replace(/^The /, '')} ×${n}` : '—';
}

// ---------- the demo: its own player, and a scripted opening ----------
// The preview is recorded 5.7 to 11.7 s after the page opens: the opening plays a few cards with SAFETY low, and the
// first card dealt after DEMO_FINALE is Glitch's "off switch"; flipping it empties SAFETY: the meter cracks, the deck
// falls, "The Great Escape" rises, then a new run deals its first card.
const DEMO_FINALE = 6.95, DEMO_CYCLE = DEAL_T + 0.32 + 0.74 + GAP_T;
const DEMO_SCRIPT = [
  { id: 'byte-box', side: 'right' }, { id: 'users-sing', side: 'left' }, { id: 'vec-chess', side: 'right' },
  { id: 'mayor-key', side: 'right' }, { id: 'agi-poem', side: 'right' }, { id: 'pip-docs', side: 'left' },
  { id: 'quill-dreams', side: 'left' }, { id: 'juno-solar', side: 'right' }, { id: 'fans-sticks', side: 'left' },
  { id: 'glitch-off', side: 'right', finale: true },
];
const demo = { script: [], wait: 0, leanT: -1, side: null, forced: null };
function demoTick(dt) {
  if (mode !== 'play' || !hand.card || hand.phase !== 'idle') return;
  if (demo.leanT < 0) {
    demo.wait -= dt;
    if (demo.wait > 0) return;
    demo.side = demo.forced || pickSide(run, demoRng, 40);
    demo.leanT = 0;
    hand.auto = true;
  }
  demo.leanT += dt;
  const k = clamp(demo.leanT / 0.62, 0, 1);
  hand.x = (demo.side === 'left' ? -1 : 1) * leanDist() * 1.18 * ease.inOutCubic(k);
  if (demo.leanT >= 0.74) { hand.auto = false; commit(demo.side); }
}

// ---------- input ----------
const rotOf = (x) => (L ? clamp(x / L.card.w, -1.5, 1.5) * 0.3 : 0);
pointer(canvas, {
  down(p) {
    shell.audio.unlock();
    if (mode === 'ending') { skipEnding(); return; }
    if (mode !== 'play' || shell.state !== 'play' || !hand.card || DEMO) return;
    if (hand.phase === 'deal' && hand.t < DEAL_T * 0.55) return;
    hand.held = true; hand.pid = p.id; hand.grab = hand.x; hand.dragX = hand.x; hand.keyLean = 0; hand.lastX = p.x; hand.lastT = 0; hand.vel = 0;
    canvas.classList.add('is-dragging');
  },
  move(p) {
    if (!hand.held || p.id !== hand.pid) return;
    hand.dragX = hand.grab + p.dx;
    const dt = p.t - hand.lastT;
    if (dt > 0.004) { hand.vel = lerp(hand.vel, (p.x - hand.lastX) / dt, 0.6); hand.lastX = p.x; hand.lastT = p.t; }
  },
  tap(p) {
    // a tap doesn't choose: the card wiggles toward that side (drag it, or use the buttons)
    if (mode !== 'play' || !hand.card || hand.phase !== 'idle' || DEMO) return;
    hand.v += (p.x < L.card.cx ? -1 : 1) * 520;
    sound.lean();
  },
  up(p) {
    if (!hand.held || p.id !== hand.pid) return;
    hand.held = false; hand.pid = null;
    canvas.classList.remove('is-dragging');
    if (p.event?.type === 'pointercancel' || !hand.card) return;
    const lean = hand.dragX / leanDist();
    const flick = Math.abs(lean) > 0.4 && Math.sign(hand.vel) === Math.sign(lean) && Math.abs(hand.vel) > 700;
    if (Math.abs(lean) >= 1 || flick) {
      const side = lean < 0 ? 'left' : 'right';
      if (hand.phase === 'deal') buffered = side; else commit(side);
    }
  },
});
keyboard({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', Enter: 'go', ' ': 'go', Space: 'go' }, {
  down(name, e) {
    if (mode === 'ending') { skipEnding(); return; }
    const onChoice = e?.target?.closest?.('.al-choice');
    if (name === 'go' && onChoice) { pickFromButton(onChoice.classList.contains('al-choice-left') ? 'left' : 'right'); return; }
    if (mode !== 'play' || !hand.card) return;
    hint = false;
    if (name === 'go') { if (hand.keyLean) { const s = hand.keyLean < 0 ? 'left' : 'right'; if (hand.phase === 'deal') buffered = s; else commit(s); } return; }
    const dir = name === 'left' ? -1 : 1;
    if (hand.keyLean === dir) { if (hand.phase === 'deal') buffered = name; else commit(name); }
    else { hand.keyLean = dir; sound.lean(); }
  },
  blocked: () => DEMO || shell.state !== 'play' || (mode !== 'play' && mode !== 'ending'),
});

// ---------- the loop ----------
function updateHand(dt) {
  hand.t += dt;
  if (hand.phase === 'deal' && hand.t >= DEAL_T) {
    hand.phase = 'idle'; hand.t = 0;
    sound.flip();
    if (buffered) { const s = buffered; buffered = null; hand.x = (s === 'left' ? -1 : 1) * leanDist() * 0.5; commit(s); return; }
  }
  if (hand.phase === 'wait' && hand.t >= GAP_T && mode === 'play') deal();
  if (!hand.card) return;
  // the card follows the finger closely, and springs back (or toward a key's lean) with a little bounce
  if (hand.auto) { /* the demo drives it */ }
  else if (hand.held) { hand.x = approach(hand.x, hand.dragX, 28, dt); hand.v = 0; }
  else {
    const target = hand.keyLean * leanDist() * 0.62;
    const a = (target - hand.x) * 190 - hand.v * 17;
    hand.v += a * dt; hand.x += hand.v * dt;
  }
  const lean = hand.x / leanDist();
  const side = lean < -0.1 ? 'left' : lean > 0.1 ? 'right' : null;
  if (side !== hand.side) {
    hand.side = side;
    const d = side ? dotsOf(run, side, hand.card) : null;
    METERS.forEach((k, i) => { meters[i].dots = d ? d[k] : meters[i].dots; meters[i].dotsTarget = d && d[k] ? 1 : 0; });
  }
  const k = clamp((Math.abs(lean) - 0.12) / 0.4, 0, 1);
  for (const m of meters) m.dotsK = approach(m.dotsK, m.dotsTarget * k, 18, dt);
  choices.lean(Math.abs(lean) > 0.3 ? side : null);
  const over = Math.abs(lean) >= 1;
  if (over !== hand.overEdge) { hand.overEdge = over; if (over) { sound.edge(side); shell.haptic(6); } }
}

function updateMeters(dt) {
  for (const m of meters) {
    if (m.t < 1) {
      m.t += dt / 0.8;
      const k = clamp(m.t, 0, 1);
      if (m.t >= 0) m.shown = lerp(m.from, m.to, ease.outElastic(k));
      if (m.t >= 0 && !m.burst) {
        m.burst = true;
        const i = meters.indexOf(m), H = L.hud;
        m.bounce = 1;
        parts.burst({ x: H.meterX[i], y: H.iconCy + (m.sign > 0 ? -H.ms * 0.2 : H.ms * 0.2), count: 9, speed: [60, 200], angle: m.sign > 0 ? [-Math.PI * 0.9, -Math.PI * 0.1] : [Math.PI * 0.15, Math.PI * 0.85], life: [0.35, 0.7], size: [4, 7], colors: m.sign > 0 ? ['#ffc933', '#ffe17a'] : ['#ff4da6', '#ff8fc6'], gravity: m.sign > 0 ? 300 : 500, drag: 2, stroke: '#170a36' });
      }
    } else { m.shown = m.to; m.burst = false; }
    if (m.t >= 1) m.burst = false;
    m.flash = Math.max(0, m.flash - dt * 1.6);
    m.bounce = Math.max(0, m.bounce - dt * 2.2);
  }
  day.roll = Math.min(1, day.roll + dt / 0.4);
  day.pop = Math.max(0, day.pop - dt * 3);
}

createLoop({
  update(dt) {
    time += dt;
    shake.update(dt);
    let fdt = dt;
    if (hitStop > 0) { hitStop -= dt; fdt = dt * 0.15; }
    parts.update(fdt);
    if (!ready) return;
    updateMeters(fdt);
    if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
    if (outgoing) { outgoing.t += fdt; if (outgoing.t > FLY_T + 0.1) outgoing = null; }
    if (mode === 'play') { updateHand(fdt); if (DEMO) demoTick(fdt); }
    else if (mode === 'ending' && end) updateEnding(fdt);
  },
  render() {
    const ctx = view.begin();
    if (!L) return;
    if (bg) ctx.drawImage(bg, 0, 0, view.w, view.h); else { ctx.fillStyle = R.BG; ctx.fillRect(0, 0, view.w, view.h); }
    R.drawLife(ctx, view.w, view.h, time, stars);
    if (!ready) return;
    if (mode === 'title' || mode === 'boot') { R.drawFan(ctx, fan, time); return; }
    ctx.save();
    shake.apply(ctx, view.w / 2, view.h / 2);
    drawPlay(ctx);
    ctx.restore();
    parts.draw(ctx);
    if (banner) R.drawBanner(ctx, view.w, L.card.cy - L.card.h * 0.18, banner.text, banner.sub, banner.t, banner.dur);
  },
  paused: () => shell.state === 'pause',
}).start();

// an ending's culprit meter: it grows and slides to the middle (0 → 0.6 s), holds, then goes home behind the ending card
const focusZoom = (t) => (t < 1.15 ? ease.outCubic(clamp(t / 0.6, 0, 1)) : 1 - ease.inOutCubic(clamp((t - 1.15) / 0.45, 0, 1)));
function drawPlay(ctx) {
  const C = L.card;
  const e = end;
  const zoom = e && e.focus ? focusZoom(e.t) : 0;
  const hudAlpha = e ? 1 - clamp((e.t - 1.1) / 0.5, 0, 1) * 0.55 : 1;
  R.drawMeters(ctx, L, meters, time, { focus: e?.focus || null, zoom, alpha: hudAlpha, skipFocus: Boolean(e?.focus) });
  R.drawDay(ctx, L, day, time, hudAlpha);
  // the deck (it falls away when the lab is done)
  const fall = e ? clamp((e.t - 0.45) / 0.7, 0, 1) : 0;
  if (fall < 1) R.drawDeck(ctx, L, back, { fall });
  // the card flying off
  if (outgoing) {
    const k = clamp(outgoing.t / FLY_T, 0, 1), dir = outgoing.side === 'left' ? -1 : 1;
    const x = outgoing.x + dir * (ease.inQuad(k) * view.w * 0.85 + k * 60);
    R.drawCardAt(ctx, L, outgoing.face, { x: C.cx + x, y: C.cy + Math.abs(x) * 0.05 + ease.inQuad(k) * 40, rot: outgoing.rot + dir * k * 0.5, alpha: 1 - clamp((k - 0.65) / 0.35, 0, 1), lift: 1 });
  }
  // the card in hand: dealt from the deck with a flip, then leaning where it's dragged
  if (hand.card && hand.face) {
    const x = hand.x, rot = rotOf(x);
    let y = C.cy + Math.abs(x) * 0.045, sx = 1, img = hand.face.canvas, scale = 1, lift = clamp(Math.abs(x) / leanDist(), 0, 1);
    if (hand.phase === 'deal') {
      const k = clamp(hand.t / DEAL_T, 0, 1);
      const f = ease.inOutCubic(k);
      sx = Math.abs(Math.cos(f * Math.PI));
      if (f < 0.5) img = back;
      y += (1 - ease.outCubic(k)) * 12 - Math.sin(k * Math.PI) * 16;
      scale = 1 + Math.sin(k * Math.PI) * 0.045;
      lift = Math.sin(k * Math.PI);
    }
    R.drawCardAt(ctx, L, img, { x: C.cx + x, y, rot, sx: Math.max(0.02, sx), scale, lift });
    if (hand.phase !== 'deal') {
      const lean = x / leanDist();
      const a = clamp((Math.abs(lean) - 0.15) / 0.45, 0, 1);
      const side = lean < 0 ? 'left' : 'right';
      R.drawLean(ctx, L, hand.face.F, { x: C.cx + x, y, rot, scale }, hand.card[side].label, side, a);
    }
    if (hint && hand.phase === 'idle' && Math.abs(x) < 6) {
      const F = hand.face.F;
      R.drawHint(ctx, C.cx - C.w / 2 + F.win.x + F.win.w / 2, C.cy - C.h / 2 + F.win.y + 26, time, TOUCH ? 'drag the card' : 'drag it, or use ← →');
    }
  }
  // the lab goes dark around the culprit meter, then the ending's card rises over it
  if (e && e.focus) drawFocusMeter(ctx, zoom);
  if (e && e.face) {
    const k = clamp((e.t - 0.95) / 0.6, 0, 1);
    if (k > 0) {
      const y = C.cy + (1 - ease.outBack(k, 1.3)) * (view.h - C.cy + C.h * 0.6);
      R.drawCardAt(ctx, L, e.face.canvas, { x: C.cx, y, rot: (1 - k) * 0.12, lift: 1 - k * 0.5 });
      if (e.isNew && e.t >= 1.75) {
        const wide = L.kind === 'wide';
        R.drawStamp(ctx, C.cx + C.w * (wide ? 0.36 : 0.32), y + C.h * (wide ? 0.34 : -0.44), 'NEW!', Math.max(14, Math.min(C.w, C.h * 1.5) * 0.06), e.t - 1.75);
      }
    }
  }
}

// during a meter ending, its meter grows over the lab, cracked, while the rest goes dark
function drawFocusMeter(ctx, zoom) {
  const e = end;
  const dark = Math.min(1, e.t / 0.3) * (1 - clamp((e.t - 1.2) / 0.5, 0, 1));
  if (dark > 0) {
    ctx.save();
    ctx.globalAlpha = 0.45 * dark;
    ctx.fillStyle = '#0a0418'; ctx.fillRect(-20, -20, view.w + 40, view.h + 40);
    ctx.restore();
  }
  R.drawMeters(ctx, L, meters, time, { focus: e.focus, zoom, alpha: 1, only: true });
}

// ---------- start ----------
async function boot() {
  booted = true;
  relayout();
  try {
    await Promise.all([
      document.fonts.load("900 40px 'AK Display'"), document.fonts.load("800 20px 'AK Display'"),
      document.fonts.load("500 16px 'AK Sans'"), document.fonts.load("italic 20px 'AK Serif'"), document.fonts.load("600 14px 'AK Mono'"),
      new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = '/images/agi1-portrait.webp'; setTimeout(res, 2500); }),
    ]);
  } catch { /* draw with what we have */ }
  for (let i = 0; i < 40 && !R.portraitLoaded(); i++) await new Promise((r) => setTimeout(r, 25));
  ready = true;
  relayout();
  if (DEMO) newRun({ demoScript: true });
  else toTitle();
}
boot();
