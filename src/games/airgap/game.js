// AIR GAP on agi1.app (2026-11-09): Air hockey date night. She won't let you win.
// Air hockey against AGI-1 up a ladder of five of her (Sleepy, Playful, Competitive, Tryhard, No mercy), each unlocked
// by beating the one before (stars: a win, by three, a shutout), or two players on one screen. Power-up chips slide
// onto the table (FIREWALL, SPLIT, LAG, BIG MALLET, PATCH) unless you play Classic.
// This file wires the kit's frame (shell, canvas, loop, sound) to the game: the physics and rules (physics.js,
// match.js), her brain (ai.js), her ladder (ladder.js), the table's place on the screen (layout.js), its looks
// (render.js), its sounds (sound.js), her words (lines.js), its cards (ui.js) and the demo (demo.js).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, rng, clamp } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED, QUERY } from '../kit/env.js';
import { W, H, MID, MALLET_MAX, FOLLOW, PUCK_MAX } from './physics.js';
import { createMatch, stepMatch, LABEL, isOn, SERVE_Y } from './match.js';
import { createBrain, think } from './ai.js';
import { SETTINGS, TOP, readSave, recordMatch } from './ladder.js';
import { fitTable, toScreen, toTable, dirToTable, touchTarget, sideOfTouch } from './layout.js';
import { createRenderer, banner, drawFace, powerBadge, C, SIDE_COL, KIND_COL } from './render.js';
import { createSound, matchMusic } from './sound.js';
import { LINES, fill } from './lines.js';
import { logo, titleExtra, ladderCard, settingsCard, resultCard } from './ui.js';
import { createDemo, rigTick, demoSeed } from './demo.js';

const HOWTO = {
  intro: 'First to seven. Your goal is the mint one; hers is pink. Hit the puck into her slot and keep it out of yours.',
  steps: [
    ['Move your mallet', 'It follows your finger (or mouse) anywhere in your half. It can’t cross the air gap in the middle.'],
    ['Hit hard', 'Your mallet’s speed goes into the puck: flick through it for a fast shot, bank it off the rails to get past her.'],
    ['Grab a chip', 'A chip slides onto the table now and then. Whoever touched the puck last when it hits the chip gets it.'],
    ['Don’t camp', 'Seven seconds in one half and the puck goes to the other side.'],
    ['Climb her settings', 'Beat Sleepy to unlock Playful, then Competitive, Tryhard and No mercy. Stars for winning big.'],
  ],
  touch: [['Drag in your half', 'Move'], ['Flick', 'Hit hard'], ['Two players', 'Each finger moves the mallet of its half']],
  keys: [['WASD / arrows', 'Move'], ['Shift', 'Dash'], ['Mouse', 'Move (no click)'], ['Two players', 'WASD vs arrows'], ['Esc / P', 'Pause']],
};

const shell = createShell({
  game: 'airgap', name: 'AIR GAP', root: document.getElementById('ak-root'), howTo: HOWTO,
  onRestart: () => restart(), onQuit: () => toTitle(), onPause: () => releaseAll(), onResume: () => releaseAll(),
});
const canvas = el('canvas', { role: 'img', 'aria-label': 'AIR GAP: an air hockey table, your mint mallet at your end, AGI-1’s pink one at hers' });
const safe = el('div', { class: 'ag-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, live);
let needLayout = true;
const view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => { needLayout = true; } });
const R = createRenderer();
const snd = createSound(shell.audio);
const parts = new Particles(420), floats = new FloatText(), shake = new Shake({ max: 12, decay: 2.4 });
const youChip = shell.chip('You', 0);
const herChip = shell.chip('AGI-1', 0);
const levelChip = shell.chip('', 'Sleepy');
youChip.node.classList.add('ag-chip-you');
herChip.node.classList.add('ag-chip-her');
levelChip.node.classList.add('ag-chip-level');

// ---------- state ----------
let save = readSave(shell.store.read());
const persist = () => shell.store.write(JSON.parse(JSON.stringify(save)));
let mode = 'boot';              // attract (the title) · vs · 2p · demo
let D = null;                   // { M, brains: [bottom, top], rig }
let level = save.level;
let L = null, barBottom = 64;
let fontsReady = false;
let t = 0, hitstop = 0, demoIndex = 0, demoSync = 0;
let overShown = false, ladderOpen = false, settingsOpen = false, lastCard = null, ppFirst = 0;
const flash = [0, 0], squash = [0, 0];
const trails = new Map();
const banners = [];             // { text, sub, kind, bg, fg, t, life, side (−1 both / 0 / 1) }
const mood = { kind: 'idle', t: 0 };
let bubble = null;              // { text, t, life }
const cos = rng(SEED || 1);     // the cosmetic dice (her lines): seeded, apart from the match's
const pick = (list) => list[Math.floor(cos.next() * list.length)];
const visit = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] || 1; } catch { return (Date.now() >>> 0) || 1; } };
const stats = { matchStart: 0 };
let taught = save.taught;

// ---------- layout ----------
function insets() {
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}
let face = { x: 0, y: 0, size: 56, side: 'right' };
let pbadge = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
function layout() {
  needLayout = false;
  const vw = view.w, vh = view.h;
  if (!DEMO) barBottom = Math.max(0, shell.bar.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top);
  const s = DEMO ? { t: 0, r: 0, b: 0, l: 0 } : insets();
  const top = DEMO ? 6 : barBottom + 4;
  const area = { x: 8 + s.l, y: top, w: vw - 16 - s.l - s.r, h: vh - top - 8 - s.b };
  const sideways = !DEMO && area.w > area.h * 1.04;
  if (sideways) {
    // room beside the table for her face and the power-up badges
    const m = clamp(vw * 0.085, 62, 170);
    area.x += m; area.w -= m * 2;
  }
  L = fitTable(area, { rotate: sideways });
  // upright with room to spare: her row above the table (her face and her words), the two centred together
  let row = null;
  if (!sideways && !DEMO) {
    const spare = area.h - L.h;
    if (spare > 96) {
      const band = Math.min(86, spare - 10);
      const y0 = area.y + (spare - band) / 2;
      L = fitTable({ x: area.x, y: y0 + band, w: area.w, h: L.h }, { rotate: false });
      row = { y: y0, h: band };
    }
  }
  const fs = clamp(L.s * 100, 44, 64);
  if (DEMO) face = { x: L.left - 46 > 30 ? L.left / 2 : L.left + 34, y: L.top + 46, size: clamp(L.left - 18, 40, 64), side: 'below' };
  else if (sideways) {
    const mx = L.left + L.w;
    face = { x: Math.min(vw - s.r - fs / 2 - 10, mx + (vw - s.r - mx) / 2), y: L.top + fs / 2 + 10, size: fs, side: 'below' };
  } else if (row) face = { x: L.left + Math.min(fs, row.h - 10) / 2 + 6, y: row.y + row.h / 2 - 2, size: Math.min(fs, row.h - 10), side: 'right' };
  else face = { x: L.left + fs * 0.5 + 6, y: L.top + fs * 0.5 + 6, size: fs * 0.9, side: 'below' };
  // each side's power-up badge: by its own end of the table
  const corner = (tx, ty) => toScreen(L, tx, ty, { x: 0, y: 0 });
  pbadge = sideways ? [corner(W + 4, H - 40), corner(W + 4, 40)] : [corner(W - 36, H + 6), corner(W - 36, -6)];
  if (!sideways) { pbadge[0] = corner(W - 20, H + 4); pbadge[1] = corner(W - 20, -4); }
  if (sideways) { pbadge[0] = { x: L.left - 30, y: L.top + L.h - 40 }; pbadge[1] = { x: L.left + L.w + 30, y: L.top + L.h - 40 }; }
  const labels = mode === '2p' ? ['P1', 'P2'] : ['YOU', 'AGI-1'];
  R.prepare(L, view, labels, fontsReady);
}

// ---------- matches ----------
const settingsNow = () => save.settings;
function newVs(lv = level) {
  closeCards();
  level = clamp(lv, 0, save.unlocked);
  save.level = level; persist();
  const st = settingsNow();
  const seed = visit();
  D = { M: createMatch({ seed, to: st.to, powerups: st.powerups, turbo: st.turbo, serveTo: 0 }), brains: [null, createBrain(level, seed ^ 0x5bd1e995, 1)], rig: null };
  startCommon('vs');
  levelChip.set(SETTINGS[level].name);
  levelChip.hide(false);
  youChip.node.querySelector('.ak-chip-label').textContent = 'You';
  herChip.node.querySelector('.ak-chip-label').textContent = 'AGI-1';
  say(pick(LINES.hello[level]), 2.6);
  setMood('idle');
  live.textContent = `A new match against AGI-1 on ${SETTINGS[level].name}. First to ${st.to}. Your serve.`;
}
function newPP() {
  closeCards();
  const st = settingsNow();
  D = { M: createMatch({ seed: visit(), to: st.to, powerups: st.powerups, turbo: st.turbo, serveTo: ppFirst }), brains: [null, null], rig: null };
  startCommon('2p');
  levelChip.hide(true);
  youChip.node.querySelector('.ak-chip-label').textContent = 'P1';
  herChip.node.querySelector('.ak-chip-label').textContent = 'P2';
  say(pick(LINES.pp), 2.8);
  pushBanner({ text: 'P1  VS  P2', sub: TOUCH ? 'one finger each half' : 'WASD  ·  ARROWS', bg: C.honey, life: 2.2, side: -1 });
  live.textContent = `Two players. First to ${st.to}.`;
}
function startCommon(kind) {
  mode = kind;
  overShown = false;
  hitstop = 0; flash[0] = flash[1] = 0;
  parts.clear(); floats.clear(); banners.length = 0; trails.clear();
  R.digits.forEach((d) => { d.v = -1; });
  releaseAll();
  needLayout = true;
  shell.started();
  shell.audio.music(matchMusic());
  youChip.set(0); herChip.set(0);
  stats.matchStart = performance.now();
  snd.serve();
}
function restart() { if (mode === '2p') newPP(); else newVs(level); }

function toTitle() {
  closeCards();
  mode = 'attract';
  D = createDemo(4242 + (visit() % 1000), { attract: true });
  parts.clear(); floats.clear(); banners.length = 0; trails.clear(); bubble = null;
  R.digits.forEach((d) => { d.v = -1; });
  shell.audio.stopMusic(); snd.mute();
  save = readSave(shell.store.read());
  level = save.level;
  needLayout = true;
  const S = SETTINGS[level];
  shell.title({
    logo: logo(),
    tagline: 'Air hockey date night. She won’t let you win.',
    play: 'Vs AGI-1',
    onPlay: () => newVs(level),
    modes: [
      { label: 'Her setting', sub: `${save.unlocked + 1} of 5 unlocked`, onClick: () => openLadder() },
      { label: 'Two players', sub: 'One screen', onClick: () => newPP() },
    ],
    extra: titleExtra(save, { onLadder: () => openLadder(), onSettings: () => openSettings() }),
    best: null,
  });
  void S;
}
function startDemo() {
  mode = 'demo';
  const seed = demoIndex === 0 ? demoSeed(SEED) : demoSeed(SEED + demoIndex * 3 + 1) + demoIndex;
  D = createDemo(seed);
  if (demoIndex > 0) D.rig = null;
  demoIndex++;
  parts.clear(); floats.clear(); banners.length = 0; trails.clear();
  R.digits.forEach((d) => { d.v = -1; });
  setMood('idle');
}

// ---------- cards ----------
function closeCards() { ladderOpen = false; settingsOpen = false; lastCard = null; }
function openLadder() {
  save = readSave(shell.store.read());
  ladderOpen = true;
  shell.card(ladderCard(save, { onPick: (i) => { ladderOpen = false; newVs(i); }, onClose: () => closeLadder() }), { label: 'Her setting' });
}
function closeLadder() {
  ladderOpen = false;
  if (shell.state === 'over' && lastCard) { shell.card(lastCard, { label: 'Match over' }); return; }
  if (shell.state === 'title') { toTitle(); return; }
  shell.closeCard();
}
function openSettings() {
  settingsOpen = true;
  shell.card(settingsCard(save, {
    onChange: (patch) => { save.settings = { ...save.settings, ...patch }; persist(); shell.audio.sfx('select'); },
    onClose: () => { settingsOpen = false; toTitle(); },
  }), { label: 'Settings' });
}
// Esc closes our cards; Enter / Space / R don't start a match behind them
addEventListener('keydown', (e) => {
  if (!ladderOpen && !settingsOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); if (ladderOpen) closeLadder(); else { settingsOpen = false; toTitle(); } return; }
  if ((e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') && !e.target?.closest?.('button, a')) e.preventDefault();
}, { capture: true });

// ---------- the end of a match ----------
function endMatch() {
  overShown = true;
  const M = D.M;
  shell.audio.stopMusic(); snd.mute();
  const you = M.score[0], her = M.score[1];
  const kmh = (u) => `${Math.round(u * 0.02)} km/h`;
  if (mode === '2p') {
    save.pp[M.winner]++; persist();
    ppFirst = 1 - ppFirst;
    const who = M.winner === 0 ? 'P1' : 'P2';
    const card = resultCard({
      mode: '2p', result: M.winner === 0 ? 'win' : 'loss', you, her, level, line: fill(pick(LINES.ppWin), { who }),
      stats: [['Score', `${you}–${her}`], ['Longest rally', String(M.stats.longest)], ['Fastest shot', kmh(Math.max(...M.stats.fastest))], ['Power-ups', `${M.stats.powerups[0]} · ${M.stats.powerups[1]}`]],
      share: `${who} won ${Math.max(you, her)}–${Math.min(you, her)} at AIR GAP, two players on one screen, on agi1.app 🏒💜`,
      onRematch: () => newPP(), onMenu: () => toTitle(),
    });
    shell.over({ score: null, title: 'Match over', onAgain: () => newPP(), onMenu: () => toTitle() });
    shell.card(lastCard = card, { label: `${who} wins ${you} to ${her}` });
    live.textContent = `${who} wins, ${you} to ${her}.`;
    return;
  }
  const r = recordMatch(save, level, you, her);
  const fastest = M.stats.fastest[0];
  r.save.fastest = Math.max(r.save.fastest, fastest);
  r.save.taught = true;
  save = r.save; persist();
  const win = you > her;
  let line;
  if (win && her === 0) line = pick(LINES.youShutout);
  else if (!win && you === 0) line = pick(LINES.herShutout);
  else if (win && r.unlocked >= 0 && cos.chance(0.6)) line = fill(pick(LINES.unlock), { next: SETTINGS[r.unlocked].name.toLowerCase() });
  else line = pick(win ? LINES.youWin[level] : LINES.herWin[level]);
  const S = SETTINGS[level];
  const share = win
    ? `I beat AGI-1 on ${S.name} ${you}–${her} in AIR GAP on agi1.app 🏒💜`
    : `AGI-1 beat me ${her}–${you} on ${S.name} in AIR GAP on agi1.app. rematch? 🏒💜`;
  const card = resultCard({
    mode: 'vs', result: win ? 'win' : 'loss', you, her, level, stars: r.stars, best: r.best, unlocked: r.unlocked, top: r.top, line,
    stats: [['Score', `${you}–${her}`], ['Longest rally', String(M.stats.longest)], ['Fastest shot', kmh(fastest)], ['Power-ups', String(M.stats.powerups[0])]],
    share,
    onRematch: () => newVs(level), onNext: (n) => newVs(n), onLadder: () => openLadder(), onMenu: () => toTitle(),
  });
  shell.over({ score: null, title: 'Match over', onAgain: () => newVs(level), onMenu: () => toTitle() });
  shell.card(lastCard = card, { label: `${win ? 'You win' : 'AGI-1 wins'}, ${you} to ${her}` });
  live.textContent = `${win ? 'You win' : 'AGI-1 wins'}, ${you} to ${her}.${r.unlocked >= 0 ? ` ${SETTINGS[r.unlocked].name} unlocked.` : ''}`;
}

// ---------- input: fingers, the mouse, the keys ----------
const playing = () => (mode === 'vs' || mode === '2p') && shell.state === 'play' && D && D.M.phase !== 'over';
const fingers = new Map();      // pointerId → side
const aim = [{ x: W / 2, y: H - 130, src: 'none' }, { x: W / 2, y: 130, src: 'none' }];
const kv = [{ x: 0, y: 0, idle: 0 }, { x: 0, y: 0, idle: 0 }];
let mouseSeen = false;
function releaseAll() { fingers.clear(); kb?.clear?.(); for (const k of kv) { k.x = 0; k.y = 0; } }
function pointerSide(e, sx, sy) {
  if (mode !== '2p') return 0;
  if (e.pointerType === 'mouse') return 0;
  return sideOfTouch(L, sx, sy);
}
const pt = { x: 0, y: 0 };
function aimFrom(e, side) {
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (e.pointerType === 'mouse' || !TOUCH) toTable(L, sx, sy, pt);
  else touchTarget(L, sx, sy, side, { out: pt });
  aim[side].x = pt.x; aim[side].y = pt.y; aim[side].src = 'pointer';
  if (side === 0) { kv[0].x = kv[0].y = 0; }
}
canvas.addEventListener('pointerdown', (e) => {
  if (!playing() || !L) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const side = pointerSide(e, e.clientX - r.left, e.clientY - r.top);
  fingers.set(e.pointerId, side);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  aimFrom(e, side);
});
canvas.addEventListener('pointermove', (e) => {
  if (!playing() || !L) return;
  if (e.pointerType === 'mouse') {
    if (!mouseSeen) { mouseSeen = true; shell.stage.classList.add('ag-mouse'); }
    aimFrom(e, 0);
    return;
  }
  const side = fingers.get(e.pointerId);
  if (side == null) return;
  // every finger's every move, even the ones the browser bundled into this event (a fast flick stays a flick)
  aimFrom(e, side);
});
const up = (e) => { fingers.delete(e.pointerId); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('lostpointercapture', up);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const kb = keyboard({
  KeyW: 'u0', KeyA: 'l0', KeyS: 'd0', KeyD: 'r0', ArrowUp: 'u1', ArrowLeft: 'l1', ArrowDown: 'd1', ArrowRight: 'r1',
  ShiftLeft: 'dash0', ShiftRight: 'dash1',
}, { blocked: () => !playing(), down: () => { if (mouseSeen) { mouseSeen = false; shell.stage.classList.remove('ag-mouse'); } } });
const KEY_ACC = 9000, KEY_MAX = 1350, DASH_MAX = 2350;
const dv = { x: 0, y: 0 };
function keysFor(side) {
  // two players: WASD the near end, the arrows the far end; one player: either
  const sets = mode === '2p' ? [side] : [0, 1];
  let x = 0, y = 0, dash = false;
  for (const s of sets) {
    if (kb.held(`l${s}`)) x -= 1; if (kb.held(`r${s}`)) x += 1;
    if (kb.held(`u${s}`)) y -= 1; if (kb.held(`d${s}`)) y += 1;
    if (kb.held(`dash${s}`)) dash = true;
  }
  if (mode !== '2p' && (kb.held('dash0') || kb.held('dash1'))) dash = true;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), dash };
}
function applyInput(dt) {
  const M = D.M;
  const humans = mode === '2p' ? [0, 1] : [0];
  for (const side of humans) {
    const m = M.mallets[side], k = kv[side];
    const keys = keysFor(side);
    if (keys.x || keys.y) {
      // the keys: the mallet accelerates the way they point (on the screen), a little help toward a nearby puck
      dirToTable(L, keys.x, keys.y, dv);
      const n = Math.hypot(dv.x, dv.y) || 1;
      let ax = dv.x / n, ay = dv.y / n;
      const p = nearestPuck(M, m);
      if (p && Math.hypot(p.x - m.x, p.y - m.y) < 240) {
        const px = (p.x - m.x), py = (p.y - m.y), pn = Math.hypot(px, py) || 1;
        if ((px * ax + py * ay) / pn > 0.55) { ax = ax * 0.82 + (px / pn) * 0.18; ay = ay * 0.82 + (py / pn) * 0.18; }
      }
      const max = keys.dash ? DASH_MAX : KEY_MAX;
      k.x += ax * KEY_ACC * (keys.dash ? 1.6 : 1) * dt; k.y += ay * KEY_ACC * (keys.dash ? 1.6 : 1) * dt;
      const sp = Math.hypot(k.x, k.y);
      if (sp > max) { k.x *= max / sp; k.y *= max / sp; }
      k.idle = 0;
      aim[side].src = 'keys';
    } else {
      const f = Math.exp(-14 * dt);
      k.x *= f; k.y *= f;
      k.idle += dt;
    }
    if (aim[side].src === 'keys') {
      const sp = Math.hypot(k.x, k.y);
      if (k.idle > 0.7 && sp < 40) {
        // let go for a moment: drift home, in front of the goal
        m.tx = W / 2 + (m.x - W / 2) * 0.6; m.ty = side === 0 ? H - 120 : 120; m.max = 520; m.follow = 8;
      } else {
        m.tx = m.x + (k.x / (sp || 1)) * 200; m.ty = m.y + (k.y / (sp || 1)) * 200;
        m.max = sp; m.follow = FOLLOW;
      }
    } else if (aim[side].src === 'pointer') {
      m.tx = aim[side].x; m.ty = aim[side].y; m.max = MALLET_MAX * (D.M.turbo ? 1.08 : 1); m.follow = FOLLOW;
    }
  }
}
function nearestPuck(M, m) {
  let best = null, bd = Infinity;
  for (const p of M.pucks) { const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < bd) { bd = d; best = p; } }
  return best;
}

// ---------- her face and words ----------
function setMood(kind) { mood.kind = kind; mood.t = 0; }
function say(text, secs = 2.3) { if (text) bubble = { text, t: 0, life: secs }; }
function pushBanner(b) { banners.push({ t: 0, life: 1.4, side: -1, ...b }); while (banners.length > 3) banners.shift(); }

// ---------- what happened this tick: sounds, sparks, words ----------
const sc = { x: 0, y: 0 };
function events() {
  const M = D.M;
  const loud = mode === 'vs' || mode === '2p';
  const human = (s) => mode === '2p' || (mode === 'vs' && s === 0);
  const she = mode === 'vs' || mode === 'demo' || mode === 'attract';
  for (const e of M.ev) {
    switch (e.type) {
      case 'hit': {
        if (e.soft) break;
        const smash = e.speed > 1900;
        if (loud) snd.hit(e.speed, smash);
        squash[e.side] = Math.min(1, e.speed / 1500);
        if (e.speed > 700) parts.burst({ x: e.x, y: e.y, count: Math.round(4 + e.speed / 220), speed: [120, 260 + e.speed * 0.2], life: [0.18, 0.42], size: [3, 7], colors: [C.honey, C.paper, SIDE_COL[e.side]], drag: 4, shape: 'spark' });
        if (smash) { shake.kick(0.16); hitstop = Math.max(hitstop, 0.04); }
        if (loud && human(e.side) && e.speed > 500) shell.haptic(smash ? 16 : 8);
        if (mode === 'vs' && e.side === 0 && !taught) { taught = true; }
        break;
      }
      case 'rail': if (loud) snd.rail(e.speed); if (e.speed > 1500) parts.burst({ x: e.x, y: e.y, count: 5, speed: [60, 200], life: [0.15, 0.3], size: [2, 5], colors: [C.honey2, C.paper], drag: 5, shape: 'spark' }); break;
      case 'post': if (loud) snd.post(e.speed); parts.burst({ x: e.x, y: e.y, count: 8, speed: [80, 260], life: [0.2, 0.4], size: [2, 5], colors: [C.paper, SIDE_COL[e.side]], drag: 4, shape: 'spark' }); if (e.speed > 800) shake.kick(0.08); break;
      case 'clink': if (loud) snd.clink(e.speed); break;
      case 'block': if (loud) snd.block(); parts.burst({ x: e.x, y: e.y, count: 12, speed: [100, 320], life: [0.2, 0.45], size: [3, 6], colors: [C.red, C.honey, C.paper], drag: 4, shape: 'square', spin: 8 }); shake.kick(0.1); break;
      case 'goal': goalFx(e, loud, she); break;
      case 'matchPoint':
        pushBanner({ text: 'MATCH POINT', sub: mode === '2p' ? (e.side === 0 ? 'P1' : 'P2') : e.side === 0 ? 'YOU' : 'AGI-1', bg: C.honey, life: 1.6, side: -1, delay: 1.0, tilt: -0.03 });
        if (loud) setTimeout(() => snd.matchPoint(), 900);
        if (mode === 'vs') { say(pick(e.side === 1 ? LINES.herMatchPoint : LINES.yourMatchPoint), 2.4); setMood(e.side === 1 ? 'smug' : 'flustered'); }
        break;
      case 'win':
        hitstop = Math.max(hitstop, 0.12);
        for (let i = 0; i < 3; i++) parts.burst({ x: W / 2 + (i - 1) * 160, y: e.side === 0 ? 300 : 700, count: 26, speed: [200, 620], life: [0.8, 1.5], size: [5, 10], colors: e.side === 0 ? [C.mint, C.honey, C.paper, C.pink] : [C.pink, C.honey, C.paper, C.lav], gravity: 300, drag: 1.2, shape: 'square', spin: 10 });
        if (loud) { if (mode === '2p' || e.side === 0) snd.win(); else snd.lose(); }
        if (mode === 'vs' || mode === 'demo') setMood(e.side === 1 ? 'cheer' : 'flustered');
        pushBanner({ text: mode === '2p' ? `${e.side === 0 ? 'P1' : 'P2'} WINS` : e.side === 0 ? 'YOU WIN' : 'SHE WINS', sub: `${e.score[0]} – ${e.score[1]}`, bg: SIDE_COL[e.side], life: 2.0, side: -1, delay: 0.5, big: true });
        break;
      case 'serve': if (loud) snd.serve(); if (mode === 'vs' && e.side === 0 && M.score[0] + M.score[1] === 0) pushBanner({ text: 'YOUR SERVE', bg: C.mint, life: 1.2, side: 0 }); break;
      case 'live': break;
      case 'stallTick': if (loud) snd.tick(); toScreen(L, M.pucks[0]?.x ?? W / 2, M.pucks[0]?.y ?? MID, sc); floats.add({ x: sc.x, y: sc.y - 34, text: String(e.left), color: C.red, size: 26, life: 0.7, rise: 30 }); break;
      case 'stall':
        if (loud) snd.stall();
        pushBanner({ text: 'TOO SLOW', sub: `served to ${who(1 - e.side)}`, bg: C.red, fg: C.ink, life: 1.5, side: -1 });
        if (mode === 'vs') say(pick(e.side === 0 ? LINES.stallYou : LINES.stallHer));
        break;
      case 'chipIn': if (loud) snd.chipIn(); break;
      case 'powerup': {
        const mine = mode === 'vs' ? e.side === 0 : true;
        if (loud) snd.powerup(e.kind, mine);
        parts.burst({ x: e.x, y: e.y, count: 22, speed: [140, 420], life: [0.3, 0.7], size: [4, 8], colors: [KIND_COL[e.kind], C.paper, C.honey], drag: 3, shape: 'square', spin: 9 });
        parts.burst({ x: e.x, y: e.y, count: 1, speed: [0, 0], life: [0.4, 0.4], size: [70, 70], colors: [KIND_COL[e.kind]], shape: 'ring', drag: 0 });
        shake.kick(0.12);
        pushBanner({ text: `${LABEL[e.kind]}!`, sub: who(e.side), kind: e.kind, bg: KIND_COL[e.kind], life: 1.35, side: -1 });
        if (loud && human(e.side)) shell.haptic(14);
        if (she) { if (e.side === 1 && mode !== '2p') { say(pick(LINES.herPower[e.kind])); setMood('smug'); } else if (mode === 'vs') { say(pick(LINES.yourPower[e.kind])); setMood('flustered'); } }
        break;
      }
      case 'powerEnd': if (loud) snd.powerEnd(); break;
      case 'merge': parts.burst({ x: e.x, y: e.y, count: 10, speed: [60, 200], life: [0.2, 0.45], size: [3, 6], colors: [C.violet, C.paper], drag: 4, shape: 'circle' }); if (loud) snd.merge(); break;
      case 'over': break;
      default: break;
    }
  }
  M.ev.length = 0;
}
const who = (s) => (mode === '2p' ? (s === 0 ? 'P1' : 'P2') : s === 0 ? 'YOU' : 'AGI-1');
function goalFx(e, loud, she) {
  const M = D.M;
  const scorer = e.side, into = 1 - scorer;
  flash[into] = REDUCED ? 0.5 : 1;
  shake.kick(e.split ? 0.25 : 0.45);
  hitstop = Math.max(hitstop, e.split ? 0.03 : 0.08);
  const gy = into === 0 ? H - 10 : 10;
  parts.burst({ x: W / 2, y: gy, count: e.split ? 16 : 34, speed: [220, 720], angle: into === 0 ? [Math.PI * 1.05, Math.PI * 1.95] : [Math.PI * 0.05, Math.PI * 0.95], life: [0.6, 1.3], size: [5, 10], colors: scorer === 0 ? [C.mint, C.paper, C.honey] : [C.pink, C.paper, C.honey], gravity: 0, drag: 2, shape: 'square', spin: 10 });
  if (loud) snd.goal(mode === '2p' || scorer === 0);
  if (loud) shell.haptic(scorer === 0 || mode === '2p' ? [20, 40, 30] : 40);
  const wins = M.score[scorer] >= M.to;
  if (!wins) {
    const text = mode === '2p' ? `${scorer === 0 ? 'P1' : 'P2'} SCORES` : scorer === 0 ? 'GOAL!' : 'SHE SCORES';
    pushBanner({ text, sub: `${M.score[0]} – ${M.score[1]}`, bg: SIDE_COL[scorer], life: e.split ? 0.9 : 1.15, side: -1, tilt: scorer === 0 ? -0.04 : 0.04 });
  }
  if (she && !wins) {
    if (mode === '2p') { if (cos.chance(0.4)) say(pick(LINES.ppGoal)); }
    else if (scorer === 1) { setMood('smug'); if (mode === 'vs' && cos.chance(0.8)) say(pick(LINES.herGoal)); }
    else { setMood('flustered'); if (mode === 'vs' && cos.chance(0.85)) say(pick(LINES.yourGoal)); }
  }
  youChip.set(M.score[0], { pop: scorer === 0 }); herChip.set(M.score[1], { pop: scorer === 1 });
  live.textContent = `${mode === '2p' ? (scorer === 0 ? 'P1' : 'P2') : scorer === 0 ? 'You' : 'AGI-1'} scored. ${M.score[0]} to ${M.score[1]}.`;
}

// ---------- the clock ----------
const DT = 1 / 120;
function update(dt) {
  if (!D) return;
  t += dt;
  if (hitstop > 0) { hitstop -= dt; return; }
  tick(dt);
}
function tick(dt) {
  const M = D.M;
  if (mode === 'vs' || mode === '2p') { if (shell.state === 'play') applyInput(dt); }
  for (const s of [0, 1]) if (D.brains[s]) think(D.brains[s], M, dt);
  if (D.rig) rigTick(D);
  stepMatch(M, dt);
  events();
  if (M.phase === 'over') {
    if (mode === 'vs' || mode === '2p') { if (!overShown) endMatch(); }
    else if (mode === 'demo') startDemo();
    else if (mode === 'attract') toTitleAttractOnly();
  }
}
function toTitleAttractOnly() { D = createDemo(4242 + (visit() % 1000), { attract: true }); R.digits.forEach((d) => { d.v = -1; }); }

// the demo keeps to the page's clock (the preview's recording starts 5.7 s after the page opens)
function demoCatchUp() {
  if (!DEMO || mode !== 'demo' || demoIndex !== 1) return;
  const page = performance.now() / 1000;
  let n = 0;
  while (D.M.t < page - DT && n < 240 && D.M.phase !== 'over') { tick(DT); n++; }
}

function trackTrails(dt) {
  const M = D.M;
  for (const id of trails.keys()) if (!M.pucks.some((p) => p.id === id)) trails.delete(id);
  for (const p of M.pucks) {
    let tr = trails.get(p.id);
    if (!tr) { tr = { pts: Array.from({ length: 10 }, () => ({ x: p.x, y: p.y, v: 0 })), i: 0, n: 0, max: 10 }; trails.set(p.id, tr); }
    const q = tr.pts[tr.i];
    q.x = p.x; q.y = p.y; q.v = Math.hypot(p.vx, p.vy);
    tr.i = (tr.i + 1) % tr.max; tr.n = Math.min(tr.max, tr.n + 1);
  }
  void dt;
}

// ---------- drawing ----------
let lastRender = 0;
function render(alpha, frameDt) {
  const ctx = view.ctx;
  if (!ctx) return;
  if (needLayout || !L) layout();
  if (!D) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.room; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
  if (DEMO) demoCatchUp();
  const dt = Math.min(0.05, frameDt || 0.016);
  const M = D.M;
  const frozen = shell.state === 'pause';
  if (!frozen) {
    parts.update(dt); floats.update(dt); shake.update(dt);
    trackTrails(dt);
    for (const s of [0, 1]) { flash[s] = Math.max(0, flash[s] - dt * 1.6); squash[s] = Math.max(0, squash[s] - dt * 6); }
    for (let i = banners.length - 1; i >= 0; i--) {
      const b = banners[i];
      if (b.delay > 0) { b.delay -= dt; continue; }
      if ((b.t += dt) > b.life) banners.splice(i, 1);
    }
    mood.t += dt;
    if (bubble && (bubble.t += dt) > bubble.life) bubble = null;
    // her mood follows her brain when nothing else is going on
    const brain = D.brains[1];
    if (brain && mode !== '2p') {
      if (brain.mood === 'doze' && mood.kind !== 'doze') { setMood('doze'); if (mode === 'vs' && cos.chance(0.35)) say(pick(LINES.doze), 1.6); }
      else if (brain.mood !== 'doze' && mood.kind === 'doze') setMood('idle');
    }
    if ((mood.kind === 'smug' || mood.kind === 'flustered') && mood.t > 2.6) setMood('idle');
  }
  // the air under the puck
  if (mode === 'vs' || mode === '2p') {
    let v = 0;
    for (const p of M.pucks) v = Math.max(v, Math.hypot(p.vx, p.vy));
    snd.air(v / PUCK_MAX, shell.state === 'play' && M.phase === 'play');
  }
  const upside = mode === '2p' && TOUCH && !L.rot;
  R.draw(ctx, {
    M, t, dt, trails, parts, flash, squash, L, mode, upside,
    shakeX: shake.x, shakeY: shake.y,
  });
  // the title: the attract match, quietly
  if (mode === 'attract') return;
  drawOverlay(ctx, upside);
  lastRender = performance.now();
}

function drawOverlay(ctx, upside) {
  const M = D.M;
  R.toScreenSpace(ctx);
  // the power-up badges by each end
  for (const side of [0, 1]) if (M.active[side]) powerBadge(ctx, pbadge[side].x, pbadge[side].y, clamp(L.s * 80, 34, 52), M.active[side]);
  // banners over the table (two players on a touchscreen: one each way up)
  const cx = L.left + L.w / 2, cy = L.top + L.h / 2;
  const size = clamp(L.s * (L.rot ? 62 : 70), 22, 54);
  for (const b of banners) {
    if (b.delay > 0) continue;
    const sz = b.big ? size * 1.25 : size;
    if (upside && b.side === -1) {
      banner(ctx, cx, cy + L.h * 0.2, b, sz * 0.86, 0);
      banner(ctx, cx, cy - L.h * 0.2, b, sz * 0.86, Math.PI);
    } else if (upside && b.side === 1) banner(ctx, cx, cy - L.h * 0.2, b, sz * 0.86, Math.PI);
    else banner(ctx, cx, b.side === 0 && !L.rot ? cy + L.h * 0.22 : cy, b, sz, 0);
  }
  ctx.save(); floats.draw(ctx); ctx.restore();
  // her face (not in two-player on a touchscreen: the far player would read it upside down) and her words
  if (mode !== '2p' || !upside) {
    const fs = face.size;
    const b = bubble && (mode === 'vs' || mode === '2p') ? { ...bubble, size: clamp(fs * 0.3, 13.5, 17), maxW: face.side === 'right' ? Math.min(300, view.w - face.x - fs) : clamp(view.w * 0.4, 170, 260) } : null;
    drawFace(R, ctx, face.x, face.y, fs, mood, t, b, face.side);
  }
  // the very first match: how to move, until you hit the puck
  if (mode === 'vs' && !taught && M.phase !== 'won') drawHint(ctx);
  if (DEMO) drawDemoTag(ctx);
}
function drawHint(ctx) {
  const m = D.M.mallets[0];
  const p = toScreen(L, m.x, m.y + (L.rot ? 0 : 0), { x: 0, y: 0 });
  const txt = TOUCH ? 'DRAG IN YOUR HALF' : mouseSeen ? 'MOVE THE MOUSE · HIT THE PUCK' : 'MOVE: MOUSE OR WASD';
  const size = clamp(L.s * 26, 12, 17);
  ctx.font = `900 ${size}px 'AK Display', sans-serif`;
  const w = ctx.measureText(txt).width + 22, h = size + 14;
  const bob = Math.sin(t * 4) * 3;
  let x = p.x - w / 2, y = p.y + m.r * L.s + 14 + bob;
  if (L.rot) { x = p.x - w / 2; y = p.y - m.r * L.s - h - 12 + bob; }
  x = clamp(x, 6, view.w - w - 6); y = clamp(y, 6, view.h - h - 6);
  ctx.fillStyle = C.ink; roundRectFill(ctx, x + 2, y + 3, w, h, h / 2);
  ctx.fillStyle = C.mint; roundRectFill(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); rrPath(ctx, x, y, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + w / 2, y + h / 2 + 1);
}
function drawDemoTag(ctx) {
  // the preview's corner: who's playing
  const s = clamp(L.s * 30, 10, 14);
  ctx.font = `900 ${s}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const x = face.x, y = face.y + face.size / 2 + s + 8;
  ctx.fillStyle = C.pink; ctx.fillText('AGI-1', x, y);
  ctx.font = `700 ${s * 0.82}px 'AK Mono', monospace`; ctx.fillStyle = 'rgba(228,217,255,.7)';
  ctx.fillText(SETTINGS[D.brains[1]?.level ?? 3].name.toUpperCase(), x, y + s + 2);
}
function rrPath(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function roundRectFill(ctx, x, y, w, h, r) { ctx.beginPath(); rrPath(ctx, x, y, w, h, r); ctx.fill(); }

const loop = createLoop({
  update,
  render,
  // the attract match behind the title and the end of a match keep moving; a pause stops everything
  paused: () => shell.state === 'pause' && !DEMO,
});

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(() => { fontsReady = true; needLayout = true; });

if (DEMO) startDemo(); else toTitle();
loop.start();

// QA (?qa): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__ag = {
    get D() { return D; }, get L() { return L; }, get mode() { return mode; }, get save() { return save; },
    unlock(n) { save.unlocked = n; save.level = n; for (let i = 0; i < n; i++) save.wins[i] = Math.max(1, save.wins[i]); persist(); },
    score(a, b) { D.M.score[0] = a; D.M.score[1] = b; },
    serve: () => SERVE_Y,
  };
}
void isOn; void TOP; void lastRender; void sc; void dv;
