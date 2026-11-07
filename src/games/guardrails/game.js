// GUARDRAILS (2026-11-08): tower defense against jailbreak attempts. Cute prompt gremlins march along a path toward
// AGI-1's core; the player builds guardrails beside it (and honeypots on it), upgrades them, and holds 30 waves (then
// endless). This file wires the arcade kit's frame (title, pause, end card, bests), the canvas and the loop, the
// layout (a tall phone sees the map turned on its side), touch, mouse and keys, the sim (./sim.js), the picture
// (./render.js), the page's own buttons (./ui.js) and sound (./sound.js). ?demo plays a mid-game wave by itself.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { Shake, clamp, approach, fmt } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH } from '../kit/env.js';
import { MAPS, MAP, TOWERS, TOWER_ORDER, CREATURES, COLS, ROWS, MAX_WAVES, UNLOCK_AT, MUTTER, buildCost } from './data.js';
import { createSim, buildMap, TILE } from './sim.js';
import { previewOf, isBossWave, bossOf, earlyRate, breakBefore } from './waves.js';
import { createAI } from './ai.js';
import { createRenderer, boltIcon, heartIcon } from './render.js';
import { createUI, svgIcon } from './ui.js';
import { COLORS, rr, buildArt } from './art.js';
import { createSound, createMusic } from './sound.js';
import { SAY, endLine } from './lines.js';

const GROUND = ['filter', 'classifier', 'redteam', 'limiter', 'sysprompt'];
const shell = createShell({
  game: 'guardrails', name: 'GUARDRAILS', root: document.getElementById('ak-root'),
  howTo: {
    intro: "Trick prompts are marching on AGI-1's core. Build guardrails beside their path and keep every one of them out.",
    steps: [
      ['Build', 'Tap an empty tile for the build menu, or drag a guardrail from the tray onto the map.'],
      ['Counter the tricks', 'Disguised ones need a Classifier. Shielded ones need splash (Red Team). Sudo walks past honeypots.'],
      ['Upgrade', 'Tap a guardrail to upgrade it, pick what it aims at, or remove it. At tier 3, choose one of two specialties.'],
      ['Hold 30 waves', 'Stopping them earns compute. Send a wave early for bonus compute. A boss every 10 waves.'],
    ],
    touch: [['Tap a tile', 'Build menu'], ['Drag from the tray', 'Place a guardrail'], ['Tap a guardrail', 'Upgrade, target, remove']],
    keys: [['1 – 6', 'Pick a guardrail'], ['Arrows', 'Move the cursor'], ['Space / Enter', 'Place or open'], ['U', 'Upgrade'], ['T', 'Change its target'],
      ['Backspace', 'Remove'], ['N', 'Send the next wave'], ['F', 'Speed 1× / 2×'], ['Esc', 'Cancel, or pause']],
  },
  onPause() { cancelAll(); },
  onRestart() { newRun(mapId); },
  onQuit() { saveBest(); toTitle(); },
});

// the bar's numbers: the wave, her hearts, compute (with drawn icons)
const waveChip = shell.chip('Wave', '0', { fmtFn: String });
waveChip.node.classList.add('gr-wave-chip');
waveChip.node.prepend(svgIcon('wave', 'gr-chip-ico gr-chip-wave'));
waveChip.node.setAttribute('aria-label', 'Wave');
const heartChip = shell.chip('', 20);
const computeChip = shell.chip('', 0, { accent: true, fmtFn: (v) => (v >= 10000 ? fmt(v, { compact: true }) : String(v)) });
heartChip.node.prepend(svgIcon('heart', 'gr-chip-ico gr-chip-heart'));
computeChip.node.prepend(svgIcon('bolt', 'gr-chip-ico gr-chip-bolt'));
heartChip.node.setAttribute('aria-label', 'Hearts');
computeChip.node.setAttribute('aria-label', 'Compute');

let booted = false;
const canvas = el('canvas', { class: 'gr-canvas', 'aria-label': 'GUARDRAILS: the map, its path and the guardrails' });
shell.stage.append(canvas);
const view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => { if (booted) layout(); } });
const R = createRenderer();
const sound = createSound(shell.audio);
const music = createMusic();
const shake = new Shake({ max: 8, decay: 2.2 });

// ---------- state ----------
let sim = null, ai = null, mode = 'boot', mapId = 'chat', speed = 1, hitstop = 0, overT = -1, runN = 0;
let seen = new Set(), bestWave = 0, sayGap = 0, mutterGap = 3, lastLeakSay = -99, uiTick = 0, cardKey = '', sellArm = 0;
let cam = { x: 0, y: 0, ok: false };
const ui = {
  selected: null, hover: null, hoverTower: null, cursor: null, ghost: null, armed: null, radialTile: null, preview: null,
  validFor: null, say: null, mutter: null, banner: null, shake,
};
let lay = { name: 'tall', top: 64, safeB: 0, safeL: 0, safeR: 0 };

// the safe area (a phone's notch)
const probe = el('div', { class: 'ak-sr', 'aria-hidden': 'true' });
for (const side of ['Left', 'Right', 'Bottom', 'Top']) probe.style[`padding${side}`] = `env(safe-area-inset-${side.toLowerCase()}, 0px)`;
shell.root.append(probe);

// ---------- the page's buttons ----------
const UI = createUI({
  stage: shell.stage, touch: TOUCH,
  handlers: {
    arm: (type) => arm(type),
    dragStart(type) { cancelAll(); ui.ghost = { type, tx: null, ty: null, ok: false }; ui.validFor = validFor(type); },
    dragMove(type, e) {
      const p = canvasPoint(e, e.pointerType === 'touch' ? -34 : 0);
      const tile = R.tileAt(p.x, p.y);
      ui.ghost = tile ? { type, tx: tile.tx, ty: tile.ty, ok: sim.canBuild(type, tile.tx, tile.ty).ok } : { type, tx: null, ty: null, ok: false };
    },
    dragEnd(type, e, cancel) {
      UI.markDragged(type);
      const g = ui.ghost;
      ui.ghost = null; ui.validFor = null;
      if (cancel || !g || g.tx == null) return;
      tryBuild(type, g.tx, g.ty);
    },
    send: () => sendWave(),
    speed: () => toggleSpeed(),
    radialPick(type) { const t = ui.radialTile; if (t) tryBuild(type, t.tx, t.ty, true); },
    radialHover(type) { ui.ghost = type && ui.radialTile ? { type, tx: ui.radialTile.tx, ty: ui.radialTile.ty, ok: true, peek: true } : null; },
    closeCard: () => deselect(),
    upgrade: (spec) => upgrade(spec),
    previewUp(spec) {
      const t = ui.selected;
      ui.preview = t && spec != null && t.tier < 3 ? (TOWERS[t.type].levels[t.tier === 1 ? 1 : 2 + spec].range || null) : null;
    },
    mode(m) { if (ui.selected) { sim.setMode(ui.selected.id, m); sound.select(); refreshCard(true); } },
    sell: (btn) => sell(btn),
    sellValue: () => (ui.selected ? sim.sellValue(ui.selected) : 0),
    rebuild() { if (ui.selected && sim.rebuild(ui.selected.id)) refreshCard(true); else nope(); },
  },
});
if (DEMO) UI.root.hidden = true;

function canvasPoint(e, dy = 0) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top + dy };
}
// where a guardrail of this kind may stand (ignoring compute)
function validFor(type) {
  const T = TOWERS[type];
  return (x, y) => {
    if (sim.towerAt(x, y)) return false;
    const t = sim.tileAt(x, y);
    return T.on === 'path' ? t === TILE.PATH && sim.map.pathD.has(y * COLS + x) : t === TILE.BUILD;
  };
}

// ---------- layout: the map as big as fits, the tray and the strip around it ----------
function measure() {
  const cs = getComputedStyle(probe);
  lay.safeL = parseFloat(cs.paddingLeft) || 0;
  lay.safeR = parseFloat(cs.paddingRight) || 0;
  lay.safeB = parseFloat(cs.paddingBottom) || 0;
  lay.top = DEMO ? 0 : Math.round(shell.bar.getBoundingClientRect().bottom || 60);
}
function layout() {
  if (!sim) return;
  measure();
  const w = view.w, h = view.h;
  if (DEMO) {
    // the preview: the map fills the frame (the camera follows the action)
    // its HUD on top and its tray below; the map fills the height between (the camera crops its width)
    // (about 15 of the 16 columns across: THE SERVER ROOM's whole spiral, its last empty column cropped)
    const tr = h > w * 1.15;
    const S = tr ? Math.min(w / ROWS, (h - DEMO_TOP - DEMO_TRAY) / 14.9) : Math.min((h - DEMO_TOP - DEMO_TRAY) / ROWS, w / 14.9);
    R.setLayout({ S, ox: 0, oy: 0, tr, dpr: view.dpr, w, h }, sim);
    cam.ok = false;
    return;
  }
  const STRIP = 48, TRAY = w >= 720 && h >= 600 ? 86 : 74, GAP = 8, SIDE = 236;
  const top = lay.top + STRIP + GAP * 1.5, bottom = TRAY + lay.safeB + GAP * 2;
  const L = lay.safeL + GAP, Rr = lay.safeR + GAP;
  const cand = [
    { name: 'tall', tr: true, S: Math.min((w - L - Rr) / ROWS, (h - top - bottom) / COLS) },
    { name: 'tall', tr: false, S: Math.min((w - L - Rr) / COLS, (h - top - bottom) / ROWS) },
    { name: 'side', tr: false, S: Math.min((w - L - Rr - SIDE - GAP) / COLS, (h - lay.top - GAP - lay.safeB - GAP) / ROWS) },
  ];
  // the side column only on a short screen; otherwise the bigger map wins
  if (h > 560) cand.pop();
  cand.sort((a, b) => b.S - a.S);
  const pick = cand[0];
  const S = clamp(Math.floor(pick.S * 4) / 4, 14, 72);
  const bw = (pick.tr ? ROWS : COLS) * S, bh = (pick.tr ? COLS : ROWS) * S;
  let ox, oy;
  if (pick.name === 'side') {
    ox = L + Math.max(0, (w - L - Rr - SIDE - GAP - bw) / 2);
    oy = lay.top + GAP + Math.max(0, (h - lay.top - GAP - lay.safeB - GAP - bh) / 2);
  } else {
    ox = L + (w - L - Rr - bw) / 2;
    oy = top + Math.max(0, (h - top - bottom - bh) / 2);
  }
  ox = Math.round(ox); oy = Math.round(oy);
  R.setLayout({ S, ox, oy, tr: pick.tr, dpr: view.dpr, w, h }, sim);
  lay.name = pick.name;
  UI.setLayout(pick.name);
  const st = UI.root.style;
  const left = Math.max(L, ox - 2), right = Math.max(Rr, w - ox - bw - 2);
  st.setProperty('--gr-l', `${pick.name === 'side' ? L : Math.min(left, (w - 340) / 2 > L ? left : L)}px`);
  st.setProperty('--gr-r', `${pick.name === 'side' ? Rr : Math.min(right, (w - 340) / 2 > Rr ? right : Rr)}px`);
  st.setProperty('--gr-strip-top', `${lay.top + (pick.name === 'side' ? GAP / 2 : 4)}px`);
  st.setProperty('--gr-tray-top', `${lay.top + GAP / 2 + 40 + 6 + 40 + 10}px`);
  st.setProperty('--gr-side-w', `${SIDE}px`);
  if (UI.radialOpen) UI.closeRadial(), (ui.radialTile = null);
}

// ---------- the run ----------
const store = shell.store;
const unlockedMaps = () => {
  const u = store.read().unlocked;
  return Array.isArray(u) ? u.filter((id) => MAP[id]) : ['chat'];
};
const isUnlocked = (id) => id === 'chat' || unlockedMaps().includes(id);

function newRun(id = mapId) {
  if (!isUnlocked(id)) id = 'chat';
  mapId = id;
  store.update((d) => { d.last = id; });
  runN++;
  sim = createSim({ map: id, seed: SEED || ((Math.random() * 1e9) >>> 0) });
  ai = null;
  resetRun();
  mode = 'run';
  speed = 1;
  UI.setSpeed(1);
  UI.root.hidden = false;
  layout();
  shell.started();
  shell.audio.music(music);
  hud(true);
  sayLine(SAY.start, { force: true, life: 4 });
  bestWave = store.best(`best_${id}`) || 0;
}
function resetRun() {
  R.clearFx();
  cancelAll();
  seen = new Set();
  sayGap = 0; mutterGap = 3; lastLeakSay = -99; hitstop = 0; overT = -1; cardKey = '';
  ui.say = null; ui.mutter = null; ui.banner = null; ui.cursor = null; ui.hover = null; ui.hoverTower = null;
  cam.ok = false;
}
function saveBest() {
  if (mode !== 'run' || !sim || sim.cleared <= 0) return;
  store.recordBest(`best_${mapId}`, sim.cleared);
}
function endRun() {
  mode = 'over';
  shell.audio.stopMusic();
  cancelAll();
  const waves = sim.cleared;
  const unlocks = store.read().fresh || null;
  store.update((d) => { delete d.fresh; });
  shell.over({
    score: waves, label: `Waves held · ${MAP[mapId].name.toLowerCase()}`, title: 'Core breached', bestKey: `best_${mapId}`,
    stats: [['Waves held', String(waves)], ['Attempts stopped', fmt(sim.kills)], ['Towers built', String(sim.built)], ['Bosses beaten', String(sim.bosses)]],
    line: endLine(waves, { victory: sim.victory }),
    share: `I held off ${waves} waves of jailbreaks in GUARDRAILS on agi1.app 🛡💜 nothing got to her core`,
    extra: unlocks ? el('p', 'gr-unlock', `${MAP[unlocks].name} unlocked`) : null,
    onAgain: () => newRun(mapId), onMenu: () => toTitle(),
  });
  sound.lose();
}

// ---------- the title ----------
function mapThumb(id) {
  const M = buildMap(id);
  const c = document.createElement('canvas');
  const s = 12;
  c.width = COLS * s; c.height = ROWS * s;
  const g = c.getContext('2d');
  g.fillStyle = COLORS.board; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (M.tiles[y * COLS + x] !== TILE.BUILD) continue;
    g.fillStyle = COLORS.tile; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
  }
  g.lineJoin = 'round';
  for (const [w, col] of [[s * 0.9, COLORS.ink], [s * 0.66, COLORS.lav]]) {
    g.lineWidth = w; g.strokeStyle = col;
    for (const p of M.paths) { g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.stroke(); }
  }
  g.beginPath(); g.arc(M.core.x * s, M.core.y * s, s * 1.05, 0, Math.PI * 2); g.fillStyle = COLORS.ink; g.fill();
  g.beginPath(); g.arc(M.core.x * s, M.core.y * s, s * 0.85, 0, Math.PI * 2); g.fillStyle = COLORS.pink; g.fill();
  return c.toDataURL('image/png');
}
const thumbs = {};
function mapPicker() {
  const last = store.read().last || 'chat';
  const box = el('div', { class: 'gr-maps', role: 'group', 'aria-label': 'Maps' });
  MAPS.forEach((m, i) => {
    const open = isUnlocked(m.id);
    const best = store.best(`best_${m.id}`);
    const prev = MAPS[i - 1];
    thumbs[m.id] ||= mapThumb(m.id);
    const b = el('button', { class: `gr-map${open ? '' : ' is-locked'}${open && last === m.id ? ' is-current' : ''}`, type: 'button',
      'aria-label': open ? `Play ${m.name}${best ? `: your best is ${best} waves` : ''}` : `${m.name} is locked: hold ${UNLOCK_AT} waves on ${prev.name}` },
      el('img', { src: thumbs[m.id], alt: '', width: 192, height: 120, draggable: 'false' }),
      open ? null : el('span', 'gr-lock', svgIcon('lock', 'gr-ico')),
      el('b', null, m.name),
      el('small', null, open ? (best ? `Best: wave ${best}` : m.sub) : `Hold ${UNLOCK_AT} waves on ${prev.name.replace('THE ', 'the ').toLowerCase()}`));
    b.addEventListener('click', () => {
      shell.audio.unlock();
      if (!open) { shell.audio.sfx('error'); shell.toast(`Hold ${UNLOCK_AT} waves on ${prev.name} first`, 'warn'); return; }
      newRun(m.id);
    });
    box.append(b);
  });
  return box;
}
function toTitle() {
  mode = 'title';
  shell.audio.stopMusic();
  cancelAll();
  UI.root.hidden = true;
  attract();
  const last = store.read().last || 'chat';
  mapId = isUnlocked(last) ? last : 'chat';
  shell.title({
    logo: ['GUARD', { text: 'RAILS', tone: 'mint' }],
    tagline: 'Hold the line. Nothing gets to her core.',
    play: `Play`,
    onPlay: () => newRun(mapId),
    extra: mapPicker(),
    best: store.best(`best_${mapId}`),
    bestLabel: `Best · ${MAP[mapId].name.toLowerCase()}`,
  });
}
// a battle behind the title (and the demo): the builder plays a mid-game wave by itself
function attract({ demo = false } = {}) {
  runN++;
  const seed = demo ? (SEED || 7) * 101 + runN : 3000 + runN;
  // (the demo plays THE SERVER ROOM: its spiral wraps around her core, so a small frame sees the whole fight)
  sim = createSim({ map: demo ? 'server' : 'chat', seed, wave: demo ? 7 : 5, compute: 0 });
  ai = createAI(sim, { sendEarly: demo ? 8 : 5 });
  sim.compute = demo ? 1180 : 760;
  ai.prebuild();
  sim.compute = demo ? 36 : 30;
  sim.drain();
  sim.sendWave();
  resetRun();
  // mid-wave already: gremlins all along the path (seeded), so every guardrail has something to do
  const P = sim.map.paths[0], crowd = demo ? 26 : 14;
  const kinds = ['ignore', 'shot', 'sudo', 'smuggler', 'blob', 'novel', 'role', 'ignore', 'shot', 'grandma'];
  for (let i = 0; i < crowd; i++) {
    const c = sim._spawn(sim.rng.pick(kinds), 0, sim.wave, 4 + (i + sim.rng.next() * 0.6) * (P.leak - 12) / crowd);
    c.age = 1;
    sim.waves.get(sim.wave).left++;
  }
  for (let i = 0; i < (demo ? 240 : 120); i++) { sim.update(1 / 60); ai.update(1 / 60); }
  sim.drain();
  // the preview's window (about 5.7 to 11.7 s after the page opens, at 2×): a System Prompt goes up, then an upgrade
  demoMove = null;
  demoMoves = demo ? [{ at: sim.t + 12.6, token: 'sysprompt' }, { at: sim.t + 18.2, token: 'up:filter' }] : [];
  ai.hold = demo;
  mode = demo ? 'demo' : 'attract';
  speed = demo ? 2 : 1;
  layout();
}

// ---------- playing ----------
function arm(type) {
  if (mode !== 'run') return;
  closeRadial();
  if (ui.armed === type) { disarm(); return; }
  const c = buildCost(type);
  if (sim.compute < c) {
    nope(`Need ${c - sim.compute} more compute`);
    return;
  }
  deselect();
  ui.armed = type;
  ui.validFor = validFor(type);
  sound.select();
  if (ui.cursor || ui.hover) {
    const t = ui.cursor || ui.hover;
    ui.ghost = { type, tx: t.tx, ty: t.ty, ok: sim.canBuild(type, t.tx, t.ty).ok };
  }
  UI.setCompute(sim.compute, ui.armed);
}
function disarm() { ui.armed = null; ui.validFor = null; ui.ghost = null; UI.setCompute(sim.compute, null); }
function tryBuild(type, tx, ty, fromRadial = false) {
  const ok = sim.canBuild(type, tx, ty);
  if (!ok.ok) {
    if (ok.why === 'compute') nope(`Need ${ok.need} more compute`);
    else if (ok.why === 'path-only') nope('Honeypots go on the path');
    else if (ok.why === 'ground-only') nope('That one goes beside the path');
    else nope();
    return false;
  }
  const t = sim.build(type, tx, ty);
  if (fromRadial) closeRadial();
  disarm();
  if (t && sim.built === 1) sayLine(SAY.firstBuild, { force: true });
  return true;
}
function select(t) {
  closeRadial();
  disarm();
  ui.selected = t;
  ui.preview = null;
  sellArm = 0;
  sound.select();
  refreshCard(true);
}
function deselect() {
  if (!ui.selected) return;
  ui.selected = null;
  ui.preview = null;
  cardKey = '';
  UI.closeCard();
}
function refreshCard(force = false) {
  const t = ui.selected;
  if (!t) return;
  if (!sim.towers.includes(t)) { deselect(); return; }
  const afford = [0, 1].map((sp) => sim.canUpgrade(t.id, sp).ok).join('');
  const key = `${t.id}|${t.tier}|${t.spec}|${t.mode}|${t.broken}|${afford}|${sim.compute >= Math.ceil(t.spent * 0.4)}`;
  if (!force && key === cardKey) {
    const small = UI.card.querySelector('.gr-card-title small');
    if (small) small.textContent = t.type === 'honeypot' ? (t.broken ? 'Broken' : `${Math.ceil(t.hp)} / ${t.maxHp}`) : `${t.kills} stopped`;
    return;
  }
  cardKey = key;
  // the card goes where it doesn't cover the guardrail
  const p = R.screenOf(t.x, t.y);
  const place = lay.name === 'side' ? 'side' : p.y > view.h * 0.52 ? 'top' : 'bottom';
  const focused = UI.card.contains(document.activeElement) ? document.activeElement.className : null;
  UI.openCard(t, { compute: sim.compute, place });
  if (focused) UI.card.querySelector(`.${focused.split(' ')[0]}`)?.focus({ preventScroll: true });
}
function upgrade(spec = 0) {
  const t = ui.selected;
  if (!t) return;
  const ok = sim.canUpgrade(t.id, spec);
  if (!ok.ok) { nope(ok.why === 'compute' ? `Need ${ok.need} more compute` : ok.why === 'broken' ? 'Rebuild it first' : 'Maxed out'); return; }
  sim.upgrade(t.id, spec);
  ui.preview = null;
  if (t.tier === 3 && Math.random() < 0.5) sayLine(SAY.upgrade);
  refreshCard(true);
}
function sell(btn) {
  const t = ui.selected;
  if (!t) return;
  const now = performance.now();
  if (now - sellArm > 2600) {
    // one more tap to be sure
    sellArm = now;
    btn?.classList.add('is-confirm');
    const label = btn?.querySelector('span');
    if (label) label.textContent = 'Sure?';
    sound.select();
    return;
  }
  sellArm = 0;
  sim.sell(t.id);
  deselect();
}
function closeRadial() { if (UI.radialOpen) UI.closeRadial(); ui.radialTile = null; if (ui.ghost?.peek) ui.ghost = null; }
function openRadial(tx, ty, { keyboard = false } = {}) {
  deselect();
  disarm();
  const tile = sim.tileAt(tx, ty);
  const options = tile === TILE.BUILD ? GROUND : tile === TILE.PATH && sim.map.pathD.has(ty * COLS + tx) ? ['honeypot'] : null;
  if (!options) { closeRadial(); return; }
  ui.radialTile = { tx, ty };
  const p = R.tileScreen(tx, ty);
  UI.openRadial({ x: p.x, y: p.y, options, compute: sim.compute, bounds: { left: lay.safeL, right: view.w - lay.safeR, top: lay.top, bottom: view.h - lay.safeB } });
  sound.select();
  if (keyboard) requestAnimationFrame(() => UI.radialFocus());
}
function cancelAll() {
  closeRadial();
  if (sim) disarm(); else { ui.armed = null; ui.ghost = null; ui.validFor = null; }
  deselect();
}
function nope(text) {
  sound.nope();
  shell.haptic(18);
  if (text) shell.toast(text, 'warn', 1300);
}
function sendWave() {
  if (mode !== 'run' || !sim.canSend()) return;
  const before = sim.compute;
  const bonus = sim.sendWave();
  if (bonus > 0) {
    computeChip.set(sim.compute, { pop: true });
    if (Math.random() < 0.35) sayLine(SAY.early);
  }
  if (before !== sim.compute) UI.setCompute(sim.compute, ui.armed);
}
function toggleSpeed() {
  speed = speed === 1 ? 2 : 1;
  UI.setSpeed(speed);
  sound.select();
}

// ---------- what she says, banners, gremlins muttering ----------
function sayLine(set, { force = false, life = 3.4 } = {}) {
  if (mode === 'demo' || (!force && (ui.say || sayGap > 0))) return;
  const text = Array.isArray(set) ? set[Math.floor(Math.random() * set.length)] : set;
  ui.say = { text, t: 0, life: Math.max(life, 1.6 + text.length * 0.045), top: lay.top };
  sayGap = 7;
}
function bannerOf(text, sub = '', { bg, life = 1.8, y, kind = null } = {}) { if (mode !== 'demo') ui.banner = { text, sub, t: 0, life, bg, y, kind }; }

// ---------- what happened in the sim: sound, shake, words ----------
function onEvents() {
  const evs = sim.drain();
  const live = mode === 'run';
  for (const e of evs) {
    R.onEvent(e, sim);
    switch (e.type) {
      case 'fire': if (e.tower === 'filter') sound.filter(); else if (e.tower === 'redteam') sound.lob(); break;
      case 'splat': sound.splat(); break;
      case 'pulse': sound.pulse(); break;
      case 'beam': sound.beam(e.big); if (e.big) shake.kick(0.12); break;
      case 'block': sound.block(); break;
      case 'unshield': sound.shieldDown(); break;
      case 'reveal': sound.reveal(); break;
      case 'heal': sound.heal(); break;
      case 'blink': sound.blink(); break;
      case 'argue': sound.argue(); break;
      case 'honeybreak': sound.honeyBreak(); break;
      case 'kill':
        sound.pop(e.boss);
        if (e.boss) { hitstop = 0.16; shake.kick(0.5); if (live) sayLine(SAY.bossDown, { force: true }); bannerOf('BOSS DOWN', 'nothing gets to her core', { bg: COLORS.mint }); }
        break;
      case 'leak':
        sound.leak();
        shake.kick(e.boss ? 0.6 : 0.22);
        if (live) {
          shell.haptic(e.boss ? [30, 40, 30] : 22);
          heartChip.set(sim.hearts, { pop: true });
          if (sim.hearts <= 5 && sim.hearts > 0) { if (sim.t - lastLeakSay > 14) { lastLeakSay = sim.t; sayLine(SAY.low, { force: true }); } }
          else if (sim.t - lastLeakSay > 10) { lastLeakSay = sim.t; sayLine(SAY.leak, { force: true }); }
        }
        break;
      case 'wave': {
        sound.horn(e.boss);
        const list = previewOf(sim.mapId, e.wave, sim.seed);
        const fresh = list.filter((x) => !seen.has(x.kind));
        for (const x of list) seen.add(x.kind);
        if (!e.boss) bannerOf(`WAVE ${e.wave}`, e.early ? `sent early +${e.bonus}` : list.map((x) => `${x.n} ${CREATURES[x.kind].name.toLowerCase()}`).slice(0, 2).join(' · '), { life: 1.6 });
        const tip = fresh.find((x) => SAY.tip[x.kind]);
        if (tip && (live || mode === 'demo')) sayLine(SAY.tip[tip.kind], { force: true, life: 4.6 });
        else if (live && e.wave > 1 && Math.random() < 0.3) sayLine(SAY.wave);
        break;
      }
      case 'boss': {
        const D = CREATURES[e.kind];
        bannerOf(D.name, D.tip, { bg: COLORS.coral, life: 3, kind: e.kind });
        shake.kick(0.35);
        if (live) sayLine(SAY.boss, { force: true });
        break;
      }
      case 'clear':
        sound.fanfare(e.perfect);
        bannerOf(`WAVE ${e.wave} HELD`, `${e.perfect ? 'perfect · ' : ''}+${e.bonus} compute`, { bg: COLORS.mint, life: 1.7, y: 0.5 });
        if (live) {
          computeChip.set(sim.compute, { pop: true });
          if (bestWave > 0 && sim.cleared === bestWave + 1) { shell.toast(`New best · wave ${sim.cleared}`, 'good', 2200); sayLine(SAY.best, { force: true }); }
          else if (e.wave === MAX_WAVES) { /* the victory event says it */ } else if (e.perfect && Math.random() < 0.4) sayLine(SAY.clear);
        }
        break;
      case 'victory':
        sound.victory();
        bannerOf('MAP HELD!', `${MAX_WAVES} waves · endless from here`, { bg: COLORS.honey, life: 3.2 });
        if (live) { sayLine(SAY.victory, { force: true }); saveBest(); }
        break;
      case 'unlock': {
        const i = MAPS.findIndex((m) => m.id === sim.mapId);
        const nextMap = MAPS[i + 1];
        if (live && nextMap && !isUnlocked(nextMap.id)) {
          store.update((d) => { d.unlocked = [...new Set([...(Array.isArray(d.unlocked) ? d.unlocked : []), nextMap.id])]; d.fresh = nextMap.id; });
          shell.toast(`${nextMap.name} unlocked`, 'good', 2400);
        }
        break;
      }
      case 'build': sound.build(); if (live) shell.haptic(10); break;
      case 'upgrade': sound.upgrade(); if (live) shell.haptic(14); break;
      case 'rebuild': sound.build(); break;
      case 'sell': sound.sell(); break;
      case 'over':
        overT = 1.4;
        shake.kick(0.8);
        bannerOf('CORE BREACHED', `${sim.cleared} waves held`, { bg: COLORS.coral, life: 2.4 });
        break;
      default:
    }
  }
}

// ---------- input on the map ----------
pointer(canvas, {
  tap(p) {
    if (mode !== 'run' || shell.state !== 'play') return;
    const tile = R.tileAt(p.x, p.y);
    if (ui.armed) {
      if (tile) {
        const t = sim.towerAt(tile.tx, tile.ty);
        if (t) { select(t); return; }
        if (tryBuild(ui.armed, tile.tx, tile.ty)) return;
        return;
      }
      disarm();
      return;
    }
    if (!tile) { cancelAll(); return; }
    const t = sim.towerAt(tile.tx, tile.ty);
    if (t) { if (ui.selected === t) deselect(); else select(t); return; }
    if (ui.radialTile && ui.radialTile.tx === tile.tx && ui.radialTile.ty === tile.ty) { closeRadial(); return; }
    if (UI.radialOpen || ui.selected) {
      // a tap away closes what's open (and opens the new tile's menu at once: one tap, not two)
      cancelAll();
    }
    openRadial(tile.tx, tile.ty);
  },
  hover(p) {
    if (mode !== 'run' || p.type !== 'mouse') return;
    const tile = R.tileAt(p.x, p.y);
    ui.hover = tile;
    ui.cursor = null;
    ui.hoverTower = tile ? sim.towerAt(tile.tx, tile.ty) : null;
    if (ui.armed) ui.ghost = tile ? { type: ui.armed, tx: tile.tx, ty: tile.ty, ok: sim.canBuild(ui.armed, tile.tx, tile.ty).ok } : null;
    canvas.classList.toggle('is-pointing', Boolean(tile && (ui.hoverTower || sim.tileAt(tile.tx, tile.ty) === TILE.BUILD || sim.map.pathD.has(tile.ty * COLS + tile.tx))));
    canvas.classList.toggle('is-placing', Boolean(ui.armed));
  },
});
canvas.addEventListener('pointerleave', () => { ui.hover = null; ui.hoverTower = null; if (ui.armed && !ui.cursor) ui.ghost = null; });

// keys: the build cursor, 1–6, U, T, Backspace, N, F, Esc (before the kit's own Esc, which pauses)
addEventListener('keydown', (e) => {
  if (mode !== 'run' || shell.state !== 'play' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  const onButton = e.target?.closest?.('button, a, input');
  if (k === 'Escape') {
    if (ui.armed || UI.radialOpen || ui.selected || ui.ghost) { e.preventDefault(); e.stopPropagation(); cancelAll(); }
    return;
  }
  if ((k === 'Enter' || k === ' ') && onButton) return;
  const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
  if (move) {
    e.preventDefault();
    // the cursor moves the way the arrow points on the screen (the map may be turned)
    const [sx, sy] = move;
    const [dx, dy] = R.V.tr ? [sy, sx] : [sx, sy];
    const c = ui.cursor || ui.hover || { tx: 7, ty: 4 };
    ui.cursor = { tx: clamp(c.tx + dx, 0, COLS - 1), ty: clamp(c.ty + dy, 0, ROWS - 1) };
    ui.hover = null;
    if (UI.radialOpen) closeRadial();
    ui.hoverTower = sim.towerAt(ui.cursor.tx, ui.cursor.ty);
    if (ui.armed) ui.ghost = { type: ui.armed, tx: ui.cursor.tx, ty: ui.cursor.ty, ok: sim.canBuild(ui.armed, ui.cursor.tx, ui.cursor.ty).ok };
    return;
  }
  if (/^[1-6]$/.test(k)) {
    e.preventDefault();
    const n = Number(k);
    if (ui.selected && ui.selected.tier === 2 && n <= 2) { upgrade(n - 1); return; }
    arm(TOWER_ORDER[n - 1]);
    return;
  }
  const low = k.toLowerCase();
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    const c = ui.cursor || ui.hover;
    if (!c) { ui.cursor = { tx: 7, ty: 4 }; return; }
    if (ui.armed) { tryBuild(ui.armed, c.tx, c.ty); return; }
    const t = sim.towerAt(c.tx, c.ty);
    if (t) select(t); else openRadial(c.tx, c.ty, { keyboard: true });
    return;
  }
  if (low === 'u') { e.preventDefault(); if (ui.selected) { if (ui.selected.broken) UI.card.querySelector('.gr-btn-up')?.click(); else if (ui.selected.tier === 1) upgrade(0); else if (ui.selected.tier === 2) shell.toast('Pick one: press 1 or 2', '', 1400); } return; }
  if (low === 't') { e.preventDefault(); const t = ui.selected; if (t && TOWERS[t.type].aims) { const m = ['first', 'strong', 'close']; sim.setMode(t.id, m[(m.indexOf(t.mode) + 1) % 3]); sound.select(); refreshCard(true); } return; }
  if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); if (ui.selected) sell(UI.card.querySelector('.gr-btn-sell')); return; }
  if (low === 'n') { e.preventDefault(); sendWave(); return; }
  if (low === 'f') { e.preventDefault(); toggleSpeed(); }
}, { capture: true });

// ---------- the HUD ----------
function hud(force = false) {
  if (!sim) return;
  const w = sim.wave;
  waveChip.set(w > MAX_WAVES || view.w < 400 ? `${w}` : `${w}/${MAX_WAVES}`);
  heartChip.set(sim.hearts);
  heartChip.node.classList.toggle('gr-low', sim.hearts <= 5);
  if (force || computeChip.value !== sim.compute) computeChip.set(sim.compute);
}
function stripTick() {
  const nextW = sim.wave + 1;
  const list = previewOf(sim.mapId, nextW, sim.seed).map((x) => ({ ...x, isNew: !seen.has(x.kind) && sim.started }));
  const canSend = sim.canSend();
  const brk = Math.round(breakBefore(nextW) * MAP[sim.mapId].pause);
  const bonus = sim.started && sim.nextIn != null && sim.nextIn > 0 ? Math.ceil(sim.nextIn * earlyRate(nextW)) : 0;
  UI.setNext({ list, wave: nextW, canSend, bonus, first: !sim.started, k: sim.nextIn != null ? 1 - clamp(sim.nextIn / brk, 0, 1) : 0, inWave: sim.spawns.length > 0 });
  UI.setCompute(sim.compute, ui.armed);
}

// ---------- the demo (?demo): the real game at a glance in a small square ----------
// its HUD on top, the map (cropped by a camera that always keeps her core in sight), its tray of guardrails below, and a
// pointer that drags a guardrail from the tray onto the map, then taps one to upgrade it
const DEMO_TOP = 48, DEMO_TRAY = 74;
let demoMoves = [], demoMove = null, trayArt = null, trayArtS = 0;
function demoCamera(dt) {
  const V = R.V;
  const bw = R.boardW(), bh = R.boardH();
  const S = V.S;
  // the focus: the pointer's target while it moves, else the crowd (leaning toward the core)
  let fx = 0, fy = 0, n = 0;
  for (const c of sim.creatures) { fx += c.x; fy += c.y; n++; }
  const core = sim.map.core;
  let cx = n ? fx / n : core.x, cy = n ? fy / n : core.y;
  if (demoMove) { const p = demoMove.a.kind === 'up' ? { x: demoMove.a.t.x, y: demoMove.a.t.y } : { x: demoMove.a.tile.x + 0.5, y: demoMove.a.tile.y + 0.5 }; cx = p.x; cy = p.y; }
  const bx = (mx, my) => (V.tr ? my : mx) * S, by = (mx, my) => (V.tr ? mx : my) * S;
  const top = DEMO_TOP, avail = V.h - DEMO_TOP - DEMO_TRAY;
  const fit = (want, boardLen, viewLen, lo, coreAt) => {
    if (boardLen <= viewLen) return lo + (viewLen - boardLen) / 2;
    // the board fills the frame; her core stays in it (with a little room); then as near the focus as that allows
    const lo1 = Math.max(lo + viewLen - boardLen - S * 0.2, lo + S * 1.3 - coreAt);
    const hi1 = Math.min(lo + S * 0.2, lo + viewLen - S * 1.3 - coreAt);
    return lo1 <= hi1 ? clamp(want, lo1, hi1) : hi1;
  };
  const tx = fit(V.w / 2 - bx(cx, cy), bw, V.w, 0, bx(core.x, core.y));
  const ty = fit(top + avail / 2 - by(cx, cy), bh, avail, top, by(core.x, core.y));
  if (!cam.ok) { cam.x = tx; cam.y = ty; cam.ok = true; } else { cam.x = approach(cam.x, tx, 1.6, dt); cam.y = approach(cam.y, ty, 1.6, dt); }
  R.setLayout({ S, ox: Math.round(cam.x), oy: Math.round(cam.y), tr: V.tr, dpr: view.dpr, w: V.w, h: V.h }, sim);
}
// its moves, on the sim's clock (the same every time for a seed): the pointer sets off 1.3 s before each one lands
function demoStep() {
  if (!demoMove && demoMoves.length && sim.t >= demoMoves[0].at - 1.3) {
    const m = demoMoves.shift();
    const a = ai.plan(m.token);
    if (a) demoMove = { a, at: m.at, t0: sim.t, type: a.kind === 'up' ? a.t.type : a.type, done: 0 };
  }
  if (demoMove && !demoMove.done && sim.t >= demoMove.at) {
    sim.compute = Math.max(sim.compute, demoMove.a.cost);
    ai.act(demoMove.a);
    demoMove.done = sim.t;
  }
  if (demoMove?.done && sim.t > demoMove.done + 0.9) { demoMove = null; if (!demoMoves.length) ai.hold = false; }
}
function demoPill(ctx, x, y, text, bg, { align = 'left', icon = null } = {}) {
  ctx.font = "900 15px 'AK Display', sans-serif";
  ctx.textBaseline = 'middle';
  const iw = icon ? 18 : 0;
  const w = ctx.measureText(text).width + 24 + iw, h = 32;
  const X = align === 'right' ? x - w : x;
  rr(ctx, X, y + 3, w, h, 16); ctx.fillStyle = COLORS.ink; ctx.fill();
  rr(ctx, X, y, w, h, 16); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
  if (icon === 'heart') heartIcon(ctx, X + 19, y + h / 2 + 1, 15, COLORS.pink);
  if (icon === 'bolt') boltIcon(ctx, X + 18, y + h / 2, 17);
  ctx.fillStyle = COLORS.ink; ctx.textAlign = 'left'; ctx.fillText(text, X + 12 + iw, y + h / 2 + 1);
  return w;
}
function demoSlot(i) {
  const pad = 8, gap = 6, w = (view.w - pad * 2 - gap * 5) / 6;
  return { x: pad + i * (w + gap), y: view.h - DEMO_TRAY + 6, w, h: DEMO_TRAY - 14 };
}
function demoHud(ctx) {
  // the top: the wave, her hearts, compute
  ctx.fillStyle = COLORS.slate;
  ctx.fillRect(0, 0, view.w, DEMO_TOP - 4);
  const w1 = demoPill(ctx, 8, 7, `WAVE ${sim.wave}`, COLORS.honey);
  demoPill(ctx, 8 + w1 + 8, 7, String(sim.hearts), COLORS.paper, { icon: 'heart' });
  demoPill(ctx, view.w - 8, 7, String(sim.compute), COLORS.honey, { align: 'right', icon: 'bolt' });
  // the tray
  ctx.fillStyle = COLORS.slate;
  ctx.fillRect(0, view.h - DEMO_TRAY, view.w, DEMO_TRAY);
  const s = Math.round(Math.min(40, demoSlot(0).w * 0.62));
  if (!trayArt || trayArtS !== s) { trayArt = buildArt(s, view.dpr); trayArtS = s; }
  const k = demoMove ? clamp((sim.t - demoMove.t0) / Math.max(0.01, demoMove.at - demoMove.t0), 0, 1) : 0;
  TOWER_ORDER.forEach((type, i) => {
    const b = demoSlot(i);
    const pressed = demoMove && demoMove.a.kind === 'build' && demoMove.type === type && k < 0.3 && !demoMove.done;
    const lift = pressed ? 3 : 0;
    rr(ctx, b.x, b.y + 4, b.w, b.h, 14); ctx.fillStyle = COLORS.ink; ctx.fill();
    rr(ctx, b.x, b.y + lift, b.w, b.h, 14); ctx.fillStyle = pressed ? COLORS.honey : COLORS.paper; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
    const sp = trayArt.towers[`${type}0`];
    const cx = b.x + b.w / 2, cy = b.y + lift + b.h * 0.4;
    ctx.drawImage(sp.img, cx - sp.ax, cy - sp.ay, sp.w, sp.h);
    const hd = trayArt.heads[`${type}0`];
    if (hd) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4); ctx.drawImage(hd.img, -hd.ax, -hd.ay, hd.w, hd.h); ctx.restore(); }
    ctx.font = "800 12px 'AK Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const c = String(buildCost(type));
    const tw = ctx.measureText(c).width;
    boltIcon(ctx, cx - tw / 2 - 5, b.y + lift + b.h - 11, 11);
    ctx.fillStyle = COLORS.ink; ctx.fillText(c, cx + 5, b.y + lift + b.h - 10);
  });
}
// the pointer: from the tray (a build) or from below (an upgrade) to its target, a ghost guardrail under it
function demoCursor(ctx) {
  if (!demoMove) return;
  const m = demoMove;
  const k = clamp((sim.t - m.t0) / Math.max(0.01, m.at - m.t0), 0, 1);
  const target = m.a.kind === 'up' ? R.screenOf(m.a.t.x, m.a.t.y) : R.screenOf(m.a.tile.x + 0.5, m.a.tile.y + 0.5);
  const slot = demoSlot(TOWER_ORDER.indexOf(m.type));
  const from = m.a.kind === 'up' ? { x: view.w * 0.7, y: view.h - DEMO_TRAY - 10 } : { x: slot.x + slot.w / 2, y: slot.y + slot.h * 0.45 };
  const e = k < 0.22 ? 0 : clamp((k - 0.22) / 0.62, 0, 1);
  const ee = e < 0.5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2;
  let x = from.x + (target.x - from.x) * ee, y = from.y + (target.y - from.y) * ee - Math.sin(ee * Math.PI) * 40;
  const gone = m.done ? clamp((sim.t - m.done) / 0.8, 0, 1) : 0;
  if (gone) { x += gone * 18; y += gone * 26; }
  ctx.save();
  ctx.globalAlpha = 1 - gone;
  if (m.a.kind === 'build' && !m.done && k > 0.18) {
    // the guardrail it carries, and its range once it's close
    const sp = R.art.towers[`${m.type}0`];
    if (ee > 0.7) {
      const r = (TOWERS[m.type].levels[0].range || 0) * R.V.S;
      if (r) { ctx.beginPath(); ctx.arc(target.x, target.y, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,250,240,.08)'; ctx.fill(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,250,240,.6)'; ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sp.img, x - sp.ax, y - sp.ay - 6, sp.w, sp.h);
    ctx.globalAlpha = 1;
  }
  if (k > 0.9 && !gone) {
    const ring = (k - 0.9) / 0.1;
    ctx.beginPath(); ctx.arc(target.x, target.y, 10 + ring * 16, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,201,51,${1 - ring})`; ctx.stroke();
  }
  // the arrow pointer, its tip at (x, y)
  const pressed = k < 0.2 || k > 0.92;
  ctx.translate(x + 4, y + 6);
  ctx.scale(pressed ? 0.9 : 1, pressed ? 0.9 : 1);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 24); ctx.lineTo(6, 18.5); ctx.lineTo(10.5, 28); ctx.lineTo(15, 26); ctx.lineTo(10.5, 16.8); ctx.lineTo(18, 16.8); ctx.closePath();
  ctx.fillStyle = COLORS.ink; ctx.save(); ctx.translate(1.5, 2.5); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.ink; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    if (!sim) return;
    if (hitstop > 0) { hitstop -= dt; return; }
    const live = mode === 'run';
    if (live && overT >= 0) { overT -= dt; if (overT <= 0) { overT = -1; saveBest(); endRun(); } return; }
    if (mode === 'over') return;
    sim.update(dt);
    if (ai) ai.update(dt);
    if (mode === 'demo') demoStep();
    if ((mode === 'demo' || mode === 'attract') && sim.over) { if (mode === 'demo') attract({ demo: true }); else attract(); }
  },
  render(alpha, frameDt) {
    if (!sim || !booted) return;
    const ctx = view.begin();
    const dt = Math.min(frameDt, 0.05);
    const k = speed;
    onEvents();
    R.update(dt * (mode === 'run' || mode === 'demo' ? k : 1));
    shake.update(dt);
    if (sayGap > 0) sayGap -= dt;
    if (ui.say) { ui.say.t += dt; if (ui.say.t >= ui.say.life) ui.say = null; }
    if (ui.banner) { ui.banner.t += dt; if (ui.banner.t >= ui.banner.life) ui.banner = null; }
    if (ui.mutter) { ui.mutter.t += dt; if (ui.mutter.t >= ui.mutter.life) ui.mutter = null; }
    // a gremlin says its line now and then (one at a time)
    mutterGap -= dt;
    if (mutterGap <= 0 && !ui.mutter && sim.creatures.length && mode !== 'attract') {
      mutterGap = mode === 'demo' ? 2.6 : 4.5 + Math.random() * 3;
      const cands = sim.creatures.filter((c) => c.revealed && c.age > 0.8 && c.x > 0.5);
      if (cands.length) {
        const c = cands[Math.floor(Math.random() * cands.length)];
        const lines = MUTTER[c.kind] || [CREATURES[c.kind].line];
        ui.mutter = { id: c.id, text: lines[Math.floor(Math.random() * lines.length)], t: 0, life: 2.4 };
      }
    }
    if (mode === 'demo') demoCamera(dt);
    ui.dim = mode === 'attract' ? 0.5 : mode === 'over' ? 0.15 : 0;
    R.draw(ctx, sim, ui);
    if (mode === 'demo') { demoHud(ctx); demoCursor(ctx); }
    if (mode === 'run') {
      uiTick -= dt;
      if (uiTick <= 0) { uiTick = 0.1; hud(); stripTick(); refreshCard(); }
    }
  },
  paused: () => !sim || (mode === 'run' && shell.state !== 'play'),
  speed: () => (mode === 'run' || mode === 'demo' ? speed : 1),
}).start();

// ---------- start: fonts first (the sprites have letters on them) ----------
async function boot() {
  const fonts = ["900 40px 'AK Display'", "italic 18px 'AK Serif'", "600 14px 'AK Sans'", "700 14px 'AK Mono'"];
  await Promise.race([Promise.all(fonts.map((f) => document.fonts?.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 1500))]);
  booted = true;
  if (DEMO) attract({ demo: true });
  else toTitle();
}
// a tap on the slate around the map closes what's open
shell.stage.addEventListener('pointerdown', (e) => {
  if (mode === 'run' && e.target === shell.stage) cancelAll();
});
boot();
