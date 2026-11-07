// HEARTBEAT on agi1.app (2026-11-08): AGI-1's seven songs as a four-lane rhythm game. "Her songs. Your fingers. Stay
// on the beat."
//
// The flow: the title (the kit's) → the setlist (screens.js) → a run → the kit's end card → again, or back to the
// setlist. A run plays the song on the audio clock and the chart on the same clock (music.js, clock.js); taps and keys
// are judged by when they really happened (event.timeStamp), minus the player's sync offset; the rules are engine.js and
// rules.js (pure, tested in tests/heartbeat.test.js); the picture is stage.js (the concert) and highway.js (the lanes).
// `?demo`: "Feel the AGI" on NORMAL from its chorus, FEVER already burning, played by its own AI on the loop's clock,
// silent, nothing kept.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, SEED, TOUCH, REDUCED } from '../kit/env.js';
import { Particles, Shake, rng, clamp, approach, fmt } from '../kit/fx.js';
import SONGS from './charts/index.json';
import { createRun } from './engine.js';
import { notesOf, beatAt, energyAt, DIFF_NAMES } from './chart.js';
import { createSongClock, eventPerf } from './clock.js';
import { createAutoplay } from './autoplay.js';
import { layoutOf, laneAt, laneX, project } from './layout.js';
import { createSprites, LANE_COLORS, drawHeart } from './sprites.js';
import { createStage } from './stage.js';
import { createHighway, stickerText, pill, setFont } from './highway.js';
import { createMusic, COVER } from './music.js';
import { createSelect, settingsCard, syncCard, recordKey, fmtMs } from './screens.js';
import { approachOf, clampOffset, clampSpeed, withArticle, SPEED, GRADES } from './rules.js';
import { endLine, STAGE } from './lines.js';

// each song's chart, loaded when it's picked (its own small file in the build)
const CHARTS = {
  'feel-the-agi': () => import('./charts/feel-the-agi.json'),
  'si-its-better': () => import('./charts/si-its-better.json'),
  'send-it': () => import('./charts/send-it.json'),
  mainrunner: () => import('./charts/mainrunner.json'),
  'save-slot-2': () => import('./charts/save-slot-2.json'),
  agi: () => import('./charts/agi.json'),
  'after-agi': () => import('./charts/after-agi.json'),
};
const LEAD = 2.4;                 // seconds from PLAY to the song's first sample
const REWIND = 3;                 // a resume replays the last 3 s with a countdown
const DEMO_SONG = 'feel-the-agi';
const KEYS = {
  KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
  ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
};
const DIFF_COLOR = { easy: '#3ff0c3', normal: '#ffc933', hard: '#ff4da6' };
const STAMP_COLOR = { 'ALL PERFECT': '#ffc933', 'FULL COMBO': '#ff4da6', 'SONG CLEAR': '#8b66ff' };
const dice = rng(SEED || (Date.now() >>> 0));
// the dev server only (never in a build): ?song=agi&diff=hard&from=60 opens the setlist on that song and starts runs
// at that second, for checking busy parts by eye
const DEV = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
const DEV_FROM = DEV ? Math.max(0, Number(DEV.get('from')) || 0) : 0;
const DEV_AUTO = Boolean(DEV?.get('auto'));
const pick = (arr) => arr[Math.floor(dice.next() * arr.length)];

// ---------- the frame ----------
const shell = createShell({
  game: 'heartbeat',
  name: 'HEARTBEAT',
  root: document.getElementById('ak-root'),
  howTo: {
    intro: 'AGI-1 sings. Hearts slide down four lanes toward the string of hearts at the bottom.',
    steps: [
      ['Hit on the beat', 'Tap a lane as its heart touches the line. PERFECT, GREAT, GOOD: the closer, the better.'],
      ['Hold the ribbons', 'A heart with a ribbon is a hold: keep your finger (or key) down until the ribbon ends.'],
      ['Light the FEVER', '50 in a row sets the stage on fire: every hit is worth ×1.2 until you miss.'],
      ['Find your sync', 'Taps landing late or early? Settings → Sync, or the tap-along test.'],
    ],
    touch: [['Tap', 'A lane (anywhere in its column)'], ['Two thumbs', 'Doubles: both at once'], ['Hold', 'Ribbons']],
    keys: [['D F J K', 'The four lanes'], ['← ↓ ↑ →', 'Or these'], ['Esc / P', 'Pause']],
  },
  onPause: () => pauseRun(),
  onResume: () => resumeRun(),
  onRestart: () => startRun(),
  onQuit: () => quitRun(),
});
const canvas = el('canvas', { 'aria-label': 'HEARTBEAT: four lanes of notes falling toward a hit line, AGI-1 singing on stage', role: 'img' });
shell.stage.append(canvas);
let L = null;
let titleY = null;
const scoreChip = shell.chip('Score', 0, { fmtFn: (v) => fmt(v) });
const accChip = shell.chip('Acc', '100.00%');
const view = fitCanvas(canvas, { maxDpr: 2, onResize: (v) => relayout(v) });

const sprites = createSprites();
const stage = createStage(sprites);
const highway = createHighway(sprites);
const music = createMusic(shell.audio);
const parts = new Particles(320);
const shake = new Shake({ max: 7, decay: 2.4 });

// ---------- what's kept on this device ----------
const saved = shell.store.read();
const prefs = { speed: SPEED.def, offset: 0, taps: true, ...(saved.prefs || {}) };
prefs.speed = clampSpeed(prefs.speed);
prefs.offset = clampOffset(prefs.offset);
const records = { ...(saved.records || {}) };
let last = saved.last && SONGS.some((s) => s.id === saved.last.id) ? saved.last : { id: SONGS[0].id, diff: 'normal' };
if (DEV?.get('song') && SONGS.some((x) => x.id === DEV.get('song'))) last = { id: DEV.get('song'), diff: DEV.get('diff') || last.diff };
const savePrefs = () => shell.store.update((d) => { d.prefs = { ...prefs }; d.last = { ...last }; });

// the levels each seat shows (made with the charts: index.json)
const LEVELS = Object.fromEntries(SONGS.map((s) => [s.id, s.levels]));

// ---------- the run's state ----------
let mode = 'boot';               // boot · title · select · loading · play · end
let song = null;                 // { id, diff, meta, data, buffer }
let run = null, auto = null;
let clock = createSongClock();
let songT = 0, vt = 0, demoT = 0;
let pausedAt = null, resumeTo = null;
let endTimer = 0;
let loadAbort = null;
const charts = new Map();        // id → its chart file
let danceData = null;            // the chart of the song the setlist is previewing (her dancing)
const down = [false, false, false, false];
const flash = [0, 0, 0, 0], missFlash = [0, 0, 0, 0], holding = [false, false, false, false];
const pointers = new Map();      // pointerId → lane
let judgment = null, comboAge = 9, feverV = 0, feverAge = 9, cheer = 0, bubble = null, stamp = null, introAlpha = 0;
let lastFever = false, sparkleT = 0;

async function chartOf(id) {
  if (charts.has(id)) return charts.get(id);
  const data = (await CHARTS[id]()).default;
  charts.set(id, data);
  return data;
}

function relayout(v = view) {
  L = layoutOf(v.w, v.h, { top: DEMO ? 44 : 64, keys: !TOUCH && !DEMO, demo: DEMO });
  accChip.hide(v.w < 560);
  titleY = null;
}
// where the title's words start (she stands there): read once per title and size
function titleTop() {
  if (titleY == null) {
    const body = shell.root.querySelector('.ak-title-body');
    const r = body && !body.closest('[hidden]') ? body.getBoundingClientRect() : null;
    titleY = r && r.height ? r.top : 0;
  }
  return titleY;
}

function say(lines, life = 2.2) {
  bubble = { text: pick(lines), age: 0, life };
}

// her cheer: little sticker hearts float up from her (FEVER, milestones, the end)
const hearts = [];
function cheerHearts(n = 7) {
  const h = stage.head();
  if (!h.x) return;
  for (let i = 0; i < n; i++) {
    if (hearts.length > 24) hearts.shift();
    hearts.push({ x: h.x + (dice.next() - 0.5) * 40, y: h.y + 30, vx: (dice.next() - 0.5) * 70, vy: -60 - dice.next() * 70, age: 0, life: 1.2 + dice.next() * 0.6, lane: i % 4, s: 12 + dice.next() * 10, wob: dice.next() * 6 });
  }
}
function heartsStep(dt) {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const p = hearts[i];
    p.age += dt;
    if (p.age > p.life) { hearts.splice(i, 1); continue; }
    p.x += (p.vx + Math.sin(p.age * 5 + p.wob) * 30) * dt;
    p.y += p.vy * dt;
    p.vy *= Math.exp(-0.8 * dt);
  }
}
function heartsDraw(ctx) {
  for (const p of hearts) {
    const k = p.age / p.life;
    const pop = Math.min(1, p.age / 0.15);
    drawHeart(ctx, sprites.notes[p.lane], p.x, p.y, p.s * pop * (1 - k * 0.3), Math.min(1, (1 - k) * 2));
  }
}

// ---------- the setlist ----------
const select = createSelect({
  root: shell.root,
  songs: SONGS,
  levels: LEVELS,
  records,
  onSelect(cur, changed) {
    shell.audio.sfx(changed ? 'select' : 'tap', { pitch: { easy: 0.9, normal: 1, hard: 1.12 }[cur.diff] });
    last = { ...cur };
    savePrefs();
    if (changed || !music.previewId) startPreview(cur.id);
    if (loadAbort && changed) { loadAbort.abort(); loadAbort = null; select.loading(null); mode = 'select'; }
  },
  onPlay: () => playSelected(),
  onSettings: () => openSettings(),
  onHelp: () => shell.showHowTo(),
});

function startPreview(id) {
  chartOf(id).then((d) => { if (last.id === id) danceData = d; }).catch(() => {});
  if (music.ensure()) music.preview(id);
}

function openSelect() {
  clearTimeout(endTimer);
  // the kit's own state goes back to its title (so its keys don't replay the last run), under the setlist
  if (shell.state !== 'title') shell.title(titleOptions());
  mode = 'select';
  stamp = null;
  run = null;
  shell.root.querySelector('.ak-title')?.setAttribute('hidden', '');
  hideCard();
  select.open(last);
  shell.root.classList.add('hb-in-select');
  startPreview(last.id);
}
function closeSelect() {
  select.close();
  shell.root.classList.remove('hb-in-select');
}

function titleOptions() {
  return {
    logo: ['HEART', { text: 'BEAT', tone: 'pink' }],
    tagline: 'Her songs. Your fingers. Stay on the beat.',
    play: 'Play',
    onPlay: () => (mode === 'select' ? playSelected() : mode === 'title' ? openSelect() : null),
    best: bestGrade(),
    bestLabel: 'Best grade',
    fine: 'Free to play · seven of her songs · your scores stay on this device',
  };
}
function toTitle() {
  mode = 'title';
  closeSelect();
  music.stopPreview();
  shell.title(titleOptions());
  titleY = null;
}

function bestGrade() {
  const rank = (g) => GRADES.findIndex(([x]) => x === g);
  let best = null;
  for (const r of Object.values(records)) if (r && (best == null || rank(r.grade) < rank(best))) best = r.grade;
  return best;
}

// ---------- settings and sync ----------
let openCard = null;
function showCard(node, label) {
  openCard?.dispose?.();
  openCard = node;
  select.node.inert = true;
  shell.card(node, { label });
}
function hideCard() {
  openCard?.dispose?.();
  openCard = null;
  select.node.inert = false;
  if (shell.state === 'title') shell.closeCard();
}
function openSettings() {
  showCard(settingsCard({
    get: () => prefs,
    set: (p) => { Object.assign(prefs, p); savePrefs(); },
    onSync: () => openSync(),
    onClose: () => { hideCard(); select.focusPlay(); if (mode === 'select') startPreview(last.id); },
  }), 'Settings');
}
function openSync() {
  music.stopPreview(0.2);
  const card = syncCard({
    music,
    current: prefs.offset,
    onUse: (v) => { prefs.offset = clampOffset(v); savePrefs(); shell.toast(`Sync ${fmtMs(prefs.offset)}`, 'good'); openSettings(); },
    onBack: () => openSettings(),
  });
  showCard(card, 'Sync: tap along');
}

// ---------- a run ----------
async function playSelected() {
  if (mode === 'loading') return;
  const { id, diff } = select.current;
  const meta = SONGS.find((s) => s.id === id);
  if (!music.ensure()) { shell.toast('Sound isn’t available here', 'warn'); return; }
  mode = 'loading';
  select.loading(0);
  loadAbort = new AbortController();
  const signal = loadAbort.signal;
  try {
    const data = await chartOf(id);
    let buffer = song && song.id === id ? song.buffer : null;
    if (!buffer) buffer = await music.load(id, (p) => select.loading(p), signal);
    if (signal.aborted) return;
    song = { id, diff, meta, data, buffer };
    loadAbort = null;
    select.loading(null);
    startRun();
  } catch (e) {
    if (signal.aborted) return;
    loadAbort = null;
    select.loading(null);
    mode = 'select';
    shell.toast('Couldn’t load the song. Try again?', 'warn');
  }
}

function resetFx() {
  parts.clear();
  for (let l = 0; l < 4; l++) { down[l] = false; flash[l] = 0; missFlash[l] = 0; holding[l] = false; }
  pointers.clear();
  judgment = null; comboAge = 9; feverV = 0; feverAge = 9; cheer = 0; stamp = null; lastFever = false;
  hearts.length = 0;
  pausedAt = null; resumeTo = null;
}

const firstNote = (r) => (r.notes.length ? r.notes[0].t : 0);
let firstRuns = (saved.runs || 0) < 2;
function startRun() {
  if (!song) { openSelect(); return; }
  firstRuns = (shell.store.read().runs || 0) < 2;
  clearTimeout(endTimer);
  music.stopPreview(0.25);
  closeSelect();
  resetFx();
  run = createRun(notesOf(song.data.charts[song.diff]), { from: DEV_FROM });
  auto = DEV_AUTO ? createAutoplay(run.notes, { seed: 3 }) : null;
  clock = createSongClock();
  const when = music.now() + LEAD;
  music.play(song.buffer, { when, from: DEV_FROM });
  clock.jump(DEV_FROM - LEAD, performance.now());
  songT = DEV_FROM - LEAD;
  mode = 'play';
  shell.started();
  shell.pausable(true);
  scoreChip.set(0);
  accChip.set('100.00%');
  say(STAGE.start, 2.4);
}

function pauseRun() {
  if (mode !== 'play' || !run) return;
  pausedAt = Math.max(songT, resumeTo ?? -Infinity);
  if (songT < 0) pausedAt = songT;
  music.stop();
  run.pauseHolds();
  clock.hold(true);
  pointers.clear();
  for (let l = 0; l < 4; l++) down[l] = false;
}

function resumeRun() {
  if (mode !== 'play' || !run || pausedAt == null) return;
  const from = pausedAt < 0 ? pausedAt : Math.max(-1, pausedAt - REWIND);
  const when = music.now() + 0.15;
  music.play(song.buffer, { when, from });
  clock = createSongClock();
  clock.jump(from - 0.15, performance.now());
  songT = from - 0.15;
  resumeTo = pausedAt;
  run.resumeHolds(pausedAt + 0.35);
  pausedAt = null;
}

function quitRun() {
  clearTimeout(endTimer);
  music.stop(0.3);
  run = null;
  mode = 'select';
  queueMicrotask(() => openSelect());
}

function finishRun() {
  if (!run || !song) return;
  const r = run;
  const { id, diff, meta } = song;
  const acc = r.finalAccuracy;
  const grade = r.grade;
  const st = r.stamp;
  const score = r.score;
  const key = recordKey(id, diff);
  const prev = records[key];
  const rec = { score, grade, acc: Math.round(acc * 100) / 100, combo: r.maxCombo, fc: st != null, ap: st === 'ALL PERFECT' };
  const isBest = !prev || score > prev.score;
  records[key] = isBest ? rec : { ...prev, fc: prev.fc || rec.fc, ap: prev.ap || rec.ap };
  shell.store.update((d) => { d.records = { ...records }; });
  const c = r.counts;
  const extra = st ? el('p', { class: `hb-stamp is-${st === 'ALL PERFECT' ? 'ap' : 'fc'}` }, st) : null;
  shell.over({
    score,
    label: `${meta.title} · ${DIFF_NAMES[diff]}`,
    title: 'Song clear',
    bestKey: `best:${key}`,
    stats: [
      ['Grade', el('span', { class: `hb-grade is-${grade === 'S+' ? 'splus' : grade.toLowerCase()}` }, grade)],
      ['Accuracy', `${acc.toFixed(2)}%`],
      ['Max combo', fmt(r.maxCombo)],
      ['Notes', `${fmt(r.units)}`],
      ['Perfect · Great · Good · Miss', `${c.perfect} · ${c.great} · ${c.good + c.break} · ${c.miss}`, { wide: true }],
    ],
    line: endLine({ stamp: st, grade, isBest: isBest && Boolean(prev) }, pick),
    share: `I got ${withArticle(grade)} on ${meta.title} (${DIFF_NAMES[diff]}) in HEARTBEAT on agi1.app 💜 her songs slap`,
    extra,
    again: 'Play again',
    onAgain: () => startRun(),
    onMenu: () => { music.stop(0.6); openSelect(); },
  });
  mode = 'select-pending';
  select.refresh();
}

// ---------- input ----------
function press(lane, stamp) {
  if (mode !== 'play' || shell.state !== 'play' || !run || DEMO) return;
  const t = clock.at(eventPerf(stamp, performance.now()));
  down[lane] = true;
  flash[lane] = 1;
  const e = run.press(lane, t);
  if (prefs.taps && e && (e.type === 'hit' || e.type === 'tap')) music.tick(lane, e.kind || 'good');
}
function release(lane, stamp) {
  if (!run || DEMO) return;
  down[lane] = false;
  if (mode !== 'play' || shell.state !== 'play') return;
  run.release(lane, clock.at(eventPerf(stamp, performance.now())));
}
pointer(canvas, {
  down(p) {
    if (mode !== 'play' || shell.state !== 'play' || !L) return;
    if (p.y < L.top - 8) return;
    const lane = laneAt(L, p.x);
    pointers.set(p.id, lane);
    press(lane, p.event?.timeStamp);
  },
  up(p) {
    const lane = pointers.get(p.id);
    if (lane == null) return;
    pointers.delete(p.id);
    if ([...pointers.values()].includes(lane)) return;      // another finger still on it
    release(lane, p.event?.timeStamp);
  },
});
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
addEventListener('keydown', (e) => {
  const lane = KEYS[e.code];
  if (lane == null || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
  if (mode !== 'play' || shell.state !== 'play') return;
  e.preventDefault();
  if (e.repeat || down[lane]) return;
  press(lane, e.timeStamp);
});
addEventListener('keyup', (e) => {
  const lane = KEYS[e.code];
  if (lane == null || !down[lane]) return;
  release(lane, e.timeStamp);
});
addEventListener('blur', () => { for (let l = 0; l < 4; l++) if (down[l]) release(l, performance.now()); });

// ---------- what a run's events do on screen ----------
function receptor(lane) { return { x: laneX(L, lane, 1), y: L.hitY - 2 }; }

function burst(lane, kind) {
  const { x, y } = receptor(lane);
  const c = LANE_COLORS[lane];
  const big = kind === 'perfect';
  parts.burst({ x, y, count: big ? 10 : 6, speed: [90, big ? 330 : 240], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.3, 0.6], size: [5, big ? 11 : 8], colors: [c, '#fffaf0'], gravity: 520, drag: 2.2, shape: 'star', spin: 6 });
  highway.ring(x, y, big ? '#fffaf0' : c, big);
  if (big) parts.burst({ x, y, count: 6, speed: [160, 380], angle: [-Math.PI * 0.85, -Math.PI * 0.15], life: [0.18, 0.32], size: [2, 4], colors: ['#ffe9a8', '#fffaf0'], shape: 'spark', drag: 3 });
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'hit') {
      judgment = { kind: e.kind, err: e.err, age: 0 };
      comboAge = 0;
      flash[e.lane] = 1;
      burst(e.lane, e.kind);
    } else if (e.type === 'miss') {
      judgment = { kind: 'miss', err: 0, age: 0 };
      missFlash[e.lane] = 1;
      music.dip();
      shake.kick(0.16);
      if (!DEMO) shell.haptic(16);
    } else if (e.type === 'tail') {
      if (e.kind === 'perfect') { burst(e.lane, 'great'); flash[e.lane] = 1; } else {
        judgment = { kind: 'break', err: 0, age: 0 };
        missFlash[e.lane] = 1;
      }
    } else if (e.type === 'fever') {
      if (e.on) {
        feverAge = 0;
        cheer = 0.001;
        cheerHearts(9);
        say(STAGE.fever, 1.8);
        for (const side of [0, 1]) parts.burst({ x: side ? L.w : 0, y: L.farY + 20, count: 22, speed: [180, 420], angle: side ? [Math.PI * 0.55, Math.PI * 0.95] : [Math.PI * 0.05, Math.PI * 0.45], life: [0.7, 1.3], size: [4, 8], colors: LANE_COLORS, gravity: 380, drag: 1.2, shape: 'square', spin: 8 });
        if (!DEMO) { shell.audio.sfx('levelup', { pitch: 1.1 }); shell.haptic([12, 40, 18]); }
      } else {
        parts.burst({ x: L.cx, y: L.farY + 30, count: 10, speed: [40, 120], life: [0.4, 0.7], size: [3, 6], colors: ['#7d7396', '#4a3d6e'], gravity: 200, shape: 'circle' });
      }
    } else if (e.type === 'milestone' && e.combo >= 100) {
      cheer = 0.001;
      cheerHearts(6);
      say(e.combo % 200 === 0 ? STAGE.hundred : STAGE.combo, 1.8);
      scoreChip.set(scoreChip.value, { pop: true });
    }
  }
}

// ---------- the frame ----------
function frameLogic(now) {
  if (DEMO || !run) return;
  const target = music.songTime(now) - prefs.offset / 1000;
  if (mode === 'play' && shell.state === 'play') {
    songT = clock.tick(now, target);
    if (auto) auto.step(run, songT);
    run.update(songT);
    if (resumeTo != null && songT > resumeTo + 0.4) resumeTo = null;
    if (run.done && songT > run.lastTime + 0.45 && !stamp) beginEnd();
  } else if ((mode === 'end' || mode === 'select-pending') && music.playing) {
    songT = clock.tick(now, target);         // the outro: she keeps dancing under the end card
  }
}

function beginEnd() {
  const st = run.stamp || 'SONG CLEAR';
  stamp = { text: st, age: 0, color: STAMP_COLOR[st] };
  mode = 'end';
  cheerHearts(10);
  shell.pausable(false);
  cheer = 0.001;
  say(STAGE.clear, 2);
  if (!DEMO) shell.audio.sfx(st === 'SONG CLEAR' ? 'clear' : 'win');
  parts.burst({ x: L.cx, y: project(L, 0.45).y, count: 36, speed: [200, 520], life: [0.8, 1.4], size: [5, 10], colors: [...LANE_COLORS, '#fffaf0'], gravity: 420, drag: 1.1, shape: 'star', spin: 6 });
  if (DEMO) return;
  endTimer = setTimeout(finishRun, 2100);
}

// the demo: its own run on the loop's clock
async function startDemo() {
  const data = await chartOf(DEMO_SONG);
  song = { id: DEMO_SONG, diff: 'normal', meta: SONGS.find((s) => s.id === DEMO_SONG), data, buffer: null };
  const from = data.preview[0];
  const notes = notesOf(data.charts.normal);
  let seed = SEED || 7;
  const begin = () => {
    resetFx();
    run = createRun(notes, { from: from - 0.12 });
    run.warm(84);
    lastFever = true;
    feverV = 1;
    feverAge = 2;
    auto = createAutoplay(run.notes, { seed: seed++ });
    demoT = from - 0.16;
    songT = demoT;
    mode = 'play';
  };
  begin();
  shell.started({ count: false });
  demo.restart = begin;
}
const demo = { restart: null };

function demoStep(dt) {
  if (!run || !auto) return;
  demoT += dt;
  songT = demoT;
  auto.step(run, demoT);
  run.update(demoT);
  if (mode === 'play' && run.done && demoT > run.lastTime + 0.4 && !stamp) beginEnd();
  if (stamp && stamp.age > 2.4) demo.restart?.();
}

const drawTimes = [];
const loop = createLoop({
  update(dt) {
    if (DEMO) demoStep(dt);
  },
  render(alpha, frameDt) {
    const now = performance.now();
    const dt = Math.min(0.05, frameDt || 0.016);
    vt += dt;
    if (!L) relayout();
    frameLogic(now);
    if (run) handleEvents(run.drain());
    // decays
    for (let l = 0; l < 4; l++) {
      flash[l] = Math.max(0, flash[l] - dt * 5);
      missFlash[l] = Math.max(0, missFlash[l] - dt * 3);
      holding[l] = Boolean(run && run.activeHold(l) && !run.activeHold(l).regrab);
    }
    if (judgment) judgment.age += dt;
    comboAge += dt;
    feverAge += dt;
    if (cheer > 0) { cheer += dt * 1.8; if (cheer > 1) cheer = 0; }
    if (bubble) { bubble.age += dt; if (bubble.age > bubble.life) bubble = null; }
    if (stamp) stamp.age += dt;
    const fevered = Boolean(run && run.fever && (mode === 'play' || mode === 'end'));
    feverV = approach(feverV, fevered ? 1 : 0, fevered ? 5 : 2.5, dt);
    parts.update(dt);
    heartsStep(dt);
    highway.update(dt);
    shake.update(dt);
    sparkleT += dt;
    if (run && sparkleT > 0.05) {
      sparkleT = 0;
      for (let l = 0; l < 4; l++) if (holding[l]) {
        const { x, y } = receptor(l);
        parts.burst({ x, y: y - 6, count: 2, speed: [60, 180], angle: [-Math.PI * 0.8, -Math.PI * 0.2], life: [0.25, 0.45], size: [3, 6], colors: [LANE_COLORS[l], '#fffaf0'], gravity: -60, shape: 'star', spin: 5 });
      }
    }
    if (DEV) { const a = performance.now(); draw(now); drawTimes.push(performance.now() - a); if (drawTimes.length > 240) drawTimes.shift(); } else draw(now);
  },
  paused: () => shell.state !== 'play' && !DEMO,
});

function visualBeat(now) {
  const playing = run && (mode === 'play' || mode === 'end' || mode === 'select-pending') && song;
  if (playing) {
    const b = beatAt(song.data.beats, songT);
    return { beat: b, energy: energyAt(song.data.energy, b), music: true };
  }
  const pt = music.previewTime(now);
  if (pt != null && danceData && music.previewId === danceData.id) {
    const b = beatAt(danceData.beats, danceData.preview[0] + pt);
    return { beat: b, energy: energyAt(danceData.energy, b), music: true };
  }
  return { beat: vt * (96 / 60), energy: 0.35, music: false };
}

function draw(now) {
  const ctx = view.begin();
  if (!ctx || !L) return;
  const { beat, energy, music: hasMusic } = visualBeat(now);
  const frac = beat - Math.floor(beat);
  const onBeat = Math.pow(1 - frac, 4);
  const showRoad = Boolean(run) && (mode === 'play' || mode === 'end' || mode === 'select-pending');
  ctx.save();
  if (showRoad) shake.apply(ctx, L.w / 2, L.h / 2);
  const spectrum = !DEMO && hasMusic ? music.readSpectrum() : null;
  const scene = { t: vt, beat, energy, fever: feverV, spectrum, cheer, bubble, playing: showRoad, music: hasMusic, dpr: view.dpr };
  // on the title she stands on its wordmark
  const titled = !showRoad && mode === 'title' && !L.wide;
  if (titled) {
    const top = titleTop();
    if (top - L.top > 150) { scene.her = { x: L.w / 2, y: top + 10, h: Math.min(top + 10 - L.top - 8, 560) }; scene.platform = false; }
  }
  stage.draw(ctx, L, scene);
  if (showRoad) {
    const approachS = approachOf(prefs.speed);
    const first = run.notes.length ? run.notes[0].t : 0;
    introAlpha = DEMO ? 0 : clamp((Math.min(4, first - approachS - 0.2) - songT) / 0.6, 0, 1);
    const countdown = resumeTo != null && songT < resumeTo ? { n: Math.ceil(resumeTo - songT), age: 1 - ((resumeTo - songT) % 1) } : null;
    const v = {
      songT, approach: approachS, notes: run.notes, beats: song.data.beats, bar: song.data.bar,
      down: DEMO ? demoDown() : down, flash, missFlash, holding, onBeat, beat, fever: feverV, dpr: view.dpr,
      keys: L.keys ? ['D', 'F', 'J', 'K'] : null, t: vt,
      judgment, combo: run.combo, comboAge, feverAge,
      intro: introAlpha > 0 ? { alpha: introAlpha, title: song.meta.title, tag: `${DIFF_NAMES[song.diff].toUpperCase()} · LV ${LEVELS[song.id][song.diff]}`, color: DIFF_COLOR[song.diff] } : null,
      countdown, stamp,
      hint: !DEMO && firstRuns && songT < Math.min(firstNote(run) - 0.25, 1.5) ? (TOUCH ? 'TAP AS EACH HEART HITS ITS OUTLINE' : 'PRESS D F J K AS EACH HEART HITS ITS OUTLINE') : null,
    };
    highway.draw(ctx, L, v);
    stage.front(ctx, L, scene, { scale: L.wide ? 0.9 : 1, clipTop: L.hitY + L.note * 0.62 });
    parts.draw(ctx);
    highway.hud(ctx, L, v);
    if (DEMO) { if (!DEV?.has('card')) demoHud(ctx); } else { progressBar(ctx); nowPlaying(ctx); }
  } else {
    stage.front(ctx, L, scene, { scale: L.wide ? 1.1 : 1.45 });
  }
  heartsDraw(ctx);
  stage.bubble(ctx, L, bubble);
  ctx.restore();
  // the chips
  if (run && !DEMO && mode === 'play') {
    scoreChip.set(run.score);
    accChip.set(`${run.accuracy.toFixed(2)}%`);
  }
}

// wide screens: a "now playing" ticket beside the highway (the song, its difficulty, where it is, how it's going)
const coverImg = new Image();
function nowPlaying(ctx) {
  const T = L.ticket;
  if (!T || !song) return;
  if (!coverImg.src.endsWith(COVER(song.id))) coverImg.src = COVER(song.id);
  const pad = 14, cs = 64, w = T.w;
  const h = pad * 2 + cs + 74;
  const x = T.x, y = T.y;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(0.025);
  ctx.translate(-w / 2, -h / 2);
  const round = (dy) => { ctx.beginPath(); ctx.moveTo(18, dy); ctx.arcTo(w, dy, w, h + dy, 18); ctx.arcTo(w, h + dy, 0, h + dy, 18); ctx.arcTo(0, h + dy, 0, dy, 18); ctx.arcTo(0, dy, w, dy, 18); ctx.closePath(); };
  round(6); ctx.fillStyle = '#170a36'; ctx.fill();
  round(0); ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#170a36'; ctx.stroke();
  if (coverImg.complete && coverImg.naturalWidth) {
    ctx.save();
    ctx.beginPath(); ctx.rect(pad, pad, cs, cs); ctx.clip();
    ctx.drawImage(coverImg, pad, pad, cs, cs);
    ctx.restore();
  }
  ctx.lineWidth = 2.5; ctx.strokeRect(pad, pad, cs, cs);
  ctx.fillStyle = '#6b3bff';
  setFont(ctx, 700, 10.5, "'AK Mono', ui-monospace, monospace", 'normal');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('NOW PLAYING', pad + cs + 12, pad + 12);
  ctx.fillStyle = '#170a36';
  let fs = 17;
  setFont(ctx, 900, fs, undefined, 'expanded');
  const title = song.meta.title.toUpperCase();
  const room = w - pad * 2 - cs - 12;
  while (ctx.measureText(title).width > room && fs > 11) { fs -= 1; setFont(ctx, 900, fs, undefined, 'expanded'); }
  ctx.fillText(title, pad + cs + 12, pad + 34);
  const tag = `${DIFF_NAMES[song.diff].toUpperCase()} · LV ${LEVELS[song.id][song.diff]}`;
  setFont(ctx, 900, 10.5, undefined, 'expanded');
  const tw = ctx.measureText(tag).width + 16;
  pill(ctx, pad + cs + 12, pad + 44, tw, 20, DIFF_COLOR[song.diff], { shadow: 0 });
  ctx.fillStyle = '#170a36'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tag, pad + cs + 12 + tw / 2, pad + 55);
  // where the song is
  const dur = song.data.duration;
  const p = clamp(songT / dur, 0, 1);
  const by = pad + cs + 18;
  ctx.fillStyle = '#e4d9ff';
  ctx.fillRect(pad, by, w - pad * 2, 8);
  ctx.fillStyle = feverV > 0.5 ? '#ffc933' : '#ff4da6';
  ctx.fillRect(pad, by, (w - pad * 2) * p, 8);
  ctx.lineWidth = 2; ctx.strokeRect(pad, by, w - pad * 2, 8);
  setFont(ctx, 700, 11.5, "'AK Mono', ui-monospace, monospace", 'normal');
  ctx.fillStyle = '#4a3d6e'; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillText(clockText(Math.max(0, songT)), pad, by + 24);
  ctx.textAlign = 'right'; ctx.fillText(clockText(dur), w - pad, by + 24);
  // how it's going
  const acc = run ? run.accuracy : 100;
  const stats = [['ACC', `${acc.toFixed(1)}%`], ['MAX', run ? String(run.maxCombo) : '0'], ['GRADE', run && run.judged ? gradeLive(acc) : '—']];
  const cw = (w - pad * 2) / 3;
  stats.forEach(([k, val], i) => {
    const cx = pad + cw * i + cw / 2;
    setFont(ctx, 900, 9.5, undefined, 'expanded');
    ctx.fillStyle = '#4a3d6e'; ctx.textAlign = 'center';
    ctx.fillText(k, cx, by + 44);
    setFont(ctx, 800, 15, "'AK Mono', ui-monospace, monospace", 'normal');
    ctx.fillStyle = '#170a36';
    ctx.fillText(val, cx, by + 62);
  });
  ctx.restore();
}
const clockText = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const gradeLive = (acc) => (GRADES.find(([, min]) => acc >= min) || ['D'])[0];

function demoDown() {
  return [0, 1, 2, 3].map((l) => Boolean(run && run.isDown(l)));
}

function progressBar(ctx) {
  const dur = song.data.duration;
  const p = clamp(songT / dur, 0, 1);
  const y = L.top - 1;
  const x0 = 12, x1 = L.w - 12;
  ctx.fillStyle = 'rgba(205,184,255,0.18)';
  ctx.fillRect(x0, y, x1 - x0, 3);
  ctx.fillStyle = feverV > 0.5 ? '#ffc933' : '#ff4da6';
  ctx.fillRect(x0, y, (x1 - x0) * p, 3);
}

function demoHud(ctx) {
  const size = clamp(L.w * 0.028, 11, 15);
  const h = size * 2.1, y = 8;
  setFont(ctx, 900, size, undefined, 'expanded');
  const title = song.meta.title.toUpperCase();
  const tw = ctx.measureText(title).width;
  setFont(ctx, 900, size * 0.82, undefined, 'expanded');
  const tag = 'NORMAL';
  const gw = ctx.measureText(tag).width + size * 1.1;
  const w = tw + gw + size * 1.9;
  pill(ctx, 10, y, w, h, '#fffaf0', { shadow: 3 });
  setFont(ctx, 900, size, undefined, 'expanded');
  ctx.fillStyle = '#170a36'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, 10 + size * 0.75, y + h / 2 + 1);
  pill(ctx, 10 + tw + size * 1.25, y + h * 0.18, gw, h * 0.64, '#ffc933', { shadow: 0 });
  setFont(ctx, 900, size * 0.82, undefined, 'expanded');
  ctx.fillStyle = '#170a36'; ctx.textAlign = 'center';
  ctx.fillText(tag, 10 + tw + size * 1.25 + gw / 2, y + h / 2 + 1);
  // the demo starts at the chorus: its score as if the verses before had gone this well too
  const before = song.data.preview[0] / song.data.duration;
  const score = fmt(run ? Math.round(before * 968000 + run.score * (1 - before)) : 0);
  setFont(ctx, 800, size * 1.08, "'AK Mono', ui-monospace, monospace", 'normal');
  const sw = ctx.measureText(score).width + size * 1.5;
  pill(ctx, L.w - 10 - sw, y, sw, h, '#ffc933', { shadow: 3 });
  ctx.fillStyle = '#170a36'; ctx.textAlign = 'center';
  ctx.fillText(score, L.w - 10 - sw / 2, y + h / 2 + 1);
}

// ---------- start ----------
async function boot() {
  const fonts = Promise.all([
    document.fonts?.load("900 40px 'AK Display'"),
    document.fonts?.load("italic 20px 'AK Serif'"),
    document.fonts?.load("700 14px 'AK Mono'"),
  ].filter(Boolean)).catch(() => {});
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]);
  relayout();
  loop.start();
  if (DEMO) { await startDemo(); return; }
  toTitle();
}
// Escape: closes a card of the setlist's, or goes back from the setlist to the title
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || shell.state !== 'title') return;
  if (openCard) { e.preventDefault(); hideCard(); if (mode === 'select') startPreview(last.id); return; }
  if (mode === 'select' && !document.querySelector('.ak-layer:not([hidden])')) { e.preventDefault(); toTitle(); }
});
boot();
// the dev server only: a peek at the run for checks by script
if (DEV) window.__hb = { drawTimes, clockAt: (perf) => clock.at(perf), audioAt: (perf) => music.songTime(perf) - prefs.offset / 1000, get mode() { return mode; }, get state() { return shell.state; }, get songT() { return songT; }, get stamp() { return stamp; }, get run() { return run; }, get vt() { return vt; } };
