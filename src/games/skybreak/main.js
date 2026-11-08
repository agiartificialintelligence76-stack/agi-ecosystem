import './style.css';
import { createWorld, formatTime, gravityScaleAt, SUMMIT_HEIGHT, ZONE_HEIGHT } from './world.js';
import { SkyPhysics, PHYSICS } from './physics.js';
import { SkyRenderer } from './renderer.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { PriceChart } from './hud.js';
import { ZONE_LOOKS } from './zones.js';
import { getBest, recordBest, getBestBag, recordBag, loadCheckpoint, saveCheckpoint, clearCheckpoint, getSettings, saveSettings } from './save.js';
import { createReplay } from './replay.js';

const $ = id => document.getElementById(id), hide = id => $(id).classList.add('hidden'), show = id => $(id).classList.remove('hidden');
const params = new URLSearchParams(location.search);
const qa = params.has('qa');
const world = createWorld(1), sound = new Sound();
const route = world.route.map(id => world.platforms.find(p => p.id === id));
const zoneCount = world.sections.length;
let renderer, physics, input, chart, state = 'loading', mode = 'rift', elapsed = 0, maxHeight = 0, falls = 0, dumps = 0, checkpoint = null;
let lastNow = performance.now(), accumulator = 0, uiTime = 0, chartTime = 0, toastTimer = 0, hintTimer = 0, bannerTimer = 0, zoneIndex = -1, replay = null, quality = 'high', slowFrames = 0;
let peakAir = 0, airTime = 0, bag = new Set(), reached = new Set();
let settings = getSettings();

const progress = (pct, label) => { $('load-fill').style.width = `${pct}%`; $('load-status').textContent = label; if (state === 'loading') $('start-label').textContent = `LOADING ${Math.round(pct)}%`; };
function toast(message, tone = '') { const el = $('toast'); el.textContent = message; el.className = `toast show ${tone}`; toastTimer = 3.2; }
// Touchscreens (phones, tablets) play with the on-screen stick and buttons, so their hints name those instead.
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
function hint(message) { $('hint').textContent = TOUCH && /^WASD/.test(message) ? 'Left thumb to move · drag the right side to look' : message; hintTimer = 7; }
const zoneAt = y => Math.max(0, Math.min(zoneCount - 1, Math.floor(Math.max(0, y) / ZONE_HEIGHT)));

function banner(index) {
  const zone = world.sections[index];
  $('zone-banner-no').textContent = `ZONE ${String(index + 1).padStart(2, '0')} / ${String(zoneCount).padStart(2, '0')}`;
  $('zone-banner-name').textContent = zone.name;
  $('zone-banner-title').textContent = zone.title;
  const el = $('zone-banner'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  bannerTimer = 4.2;
  sound.play('zone');
}

function onEvent(event) {
  if (state !== 'playing') return;
  const platform = event.platform;
  sound.play(event.type, event.impact || 1);
  switch (event.type) {
    case 'land': {
      if (platform?.hint) hint(platform.hint);
      const drop = peakAir - physics.player.y;
      if (drop > 14) { dumps++; toast(`−${drop.toFixed(0)} M · YOU GOT DUMPED`, 'red'); renderer.shake(Math.min(1.2, drop / 30)); $('flash').className = 'red'; $('flash').style.opacity = '.22'; }
      else if (event.impact > 15) renderer.shake(.25);
      peakAir = physics.player.y;
      break;
    }
    case 'pump': renderer.burst(platform.x, platform.y + .3, platform.z, '#2ef0a6', 3.2, .6); toast(platform.god ? 'GOD CANDLE ▲▲▲' : 'PUMPING ▲', 'green'); break;
    case 'dump': renderer.burst(platform.x, platform.y, platform.z, '#ff4a5c', 3, .5); renderer.shake(.3); toast('DUMPING ▼ JUMP!', 'red'); break;
    case 'rug': renderer.shake(.45); toast('RUG PULLED', 'red'); break;
    case 'pad': renderer.burst(platform.x, platform.y + .3, platform.z, '#ffcf64', 2.6, .5); toast('UPDRAFT ENGAGED'); break;
    case 'hazard': renderer.shake(.7); toast('LIQUIDATED', 'red'); $('flash').className = 'red'; $('flash').style.opacity = '.3'; break;
    case 'grapple': if (event.attached) hint(TOUCH ? 'Let go of SWING to carry your swing into the next jump.' : 'Release E to carry your swing into the next jump.'); break;
    case 'checkpoint':
      if (mode === 'rift') {
        checkpoint = { id: platform.id, x: platform.x, y: platform.y + .08, z: platform.z };
        if (!qa) saveCheckpoint(world, checkpoint.id, elapsed, falls, maxHeight, bag);
        toast('RIFT CHECKPOINT SECURED', 'pink'); $('flash').className = ''; $('flash').style.opacity = '.18';
        renderer.burst(platform.x, platform.y + 1.4, platform.z, '#f9b1e7', 3, .6);
      } else toast('PURE ASCENT · NO SAVES. KEEP CLIMBING');
      break;
    case 'finish': finish(); break;
  }
}

function collectCoins() {
  const p = physics.player, cy = p.y + .9;
  for (const coin of world.coins) {
    if (coin.y < cy - 1.6) continue;
    if (coin.y > cy + 1.6) break;
    if (bag.has(coin.id)) continue;
    if (Math.hypot(coin.x - p.x, coin.z - p.z) < 1.1 && Math.abs(coin.y - cy) < 1.35) {
      bag.add(coin.id); renderer.collectCoin(coin.id); sound.play('coin', bag.size); updateBag();
    }
  }
}
function updateBag() { $('coin-count').textContent = String(bag.size); const el = $('bag'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

function finish() {
  state = 'won'; input.active = false; document.exitPointerLock?.(); hide('hud'); document.body.classList.remove('playing'); openDialog('win-screen');
  $('finish-time').textContent = formatTime(elapsed);
  $('finish-detail').textContent = `${mode === 'rift' ? 'Rift run' : 'Pure ascent'} · ${falls} recoveries · ${dumps} big dumps · ${SUMMIT_HEIGHT} metres, climbed by hand`;
  $('finish-bag').textContent = `${bag.size} / ${world.coins.length}`;
  let note = '';
  if (!qa) { if (recordBest(mode, elapsed)) note = 'NEW BEST TIME'; if (recordBag(bag.size) && bag.size) note = note ? `${note} · BIGGEST BAG` : 'BIGGEST BAG YET'; clearCheckpoint(); }
  $('finish-note').textContent = note;
  const summary = new PriceChart($('finish-chart'), { keep: 48 });
  summary.draw(chart.summary(48), { ath: chart.ath });
  sound.play('finish');
}

function teleportTarget() {
  const step = Number(params.get('step'));
  if (!qa || !Number.isFinite(step) || step <= 0) return null;
  const p = route[Math.min(route.length - 1, step)];
  return p ? { x: p.x, y: p.y + .08, z: p.z } : null;
}

function start(saved = null) {
  if (state === 'loading') return;
  sound.unlock();
  for (const id of ['intro', 'pause-screen', 'win-screen', 'help-screen', 'settings-screen']) hide(id);
  show('hud'); document.body.classList.add('playing');
  const jump = !saved && teleportTarget();
  const spawn = saved ? { x: saved.platform.x, y: saved.platform.y + .08, z: saved.platform.z } : jump || world.spawn;
  physics.reset(spawn);
  checkpoint = saved ? { id: saved.id, ...spawn } : null;
  elapsed = saved?.elapsed || 0; falls = saved?.falls || 0; dumps = 0; maxHeight = saved?.maxHeight || 0;
  bag = new Set(saved?.coins || []); renderer.resetCoins([...bag]);
  $('coin-count').textContent = String(bag.size);
  chart.reset(Math.max(0, spawn.y)); peakAir = spawn.y; airTime = 0;
  reached = new Set(Array.from({ length: zoneAt(spawn.y) + 1 }, (_, i) => i)); zoneIndex = -1;
  input.clear(); input.yaw = 0; input.pitch = .34; input.active = true; state = 'playing'; replay = null;
  lastNow = performance.now(); accumulator = 0;
  renderer.facing = 90;   // she turned to face the title's camera; the run starts facing the climb
  renderer.cameraPos.set(physics.player.x, physics.player.y + 4, physics.player.z + 8);
  $('run-mode').textContent = mode === 'rift' ? 'RIFT RUN' : 'PURE ASCENT';
  $('best').textContent = getBest(mode) ? formatTime(getBest(mode)) : '—';
  if (!saved && !qa && mode === 'rift') clearCheckpoint();
  hint(saved ? 'Back at your rift. The chart is still climbing.' : 'WASD to move · Hold Space to jump · Mouse to look');
  // A host page (agi1.app counts runs started, never who) hears each run begin; the game itself needs nothing back.
  document.dispatchEvent(new CustomEvent('skybreak:run', { detail: { mode, continued: !!saved } }));
}

function pause(force) { if (state === 'playing') { state = 'paused'; input.active = false; input.clear(); document.exitPointerLock?.(); openDialog('pause-screen'); } else if (state === 'paused' && !force && !dialogOpen('help-screen') && !dialogOpen('settings-screen')) resume(); }
function resume() { hide('pause-screen'); input.clear(); state = 'playing'; input.active = true; lastNow = performance.now(); accumulator = 0; }
function recover() {
  if (state !== 'playing') return;
  falls++;
  physics.reset(mode === 'rift' && checkpoint ? checkpoint : world.spawn);
  accumulator = 0; peakAir = physics.player.y; airTime = 0;
  renderer.cameraPos.set(physics.player.x, physics.player.y + 4, physics.player.z + 8);
  toast(checkpoint && mode === 'rift' ? 'RIFT POSITION RESTORED' : 'BACK TO THE LAUNCHPAD');
  $('flash').className = ''; $('flash').style.opacity = '.25';
}
function menu() { state = 'menu'; input.active = false; input.clear(); document.exitPointerLock?.(); document.body.classList.remove('playing'); for (const id of ['hud', 'pause-screen', 'win-screen', 'help-screen', 'settings-screen']) hide(id); show('intro'); physics.reset(world.spawn); replay = null; updateTitle(); frameTitle(); if (!TOUCH) $('start').focus({ preventScroll: true }); }

// The title's numbers: the best time for the mode picked, the biggest bag, and a saved rift to continue
function updateTitle() {
  const best = getBest(mode);
  $('title-best-label').textContent = mode === 'rift' ? 'RIFT BEST' : 'PURE BEST';
  $('title-best').textContent = best ? formatTime(best) : '—';
  $('best-bag').textContent = getBestBag() ? `BEST BAG ${getBestBag()} $AGI` : 'NO BAG YET';
  updateContinue();
}
function updateContinue() {
  const saved = mode === 'rift' && state !== 'loading' ? loadCheckpoint(world) : null;
  $('continue').classList.toggle('hidden', !saved);
  if (saved) $('continue-at').textContent = `${Math.floor(saved.maxHeight || saved.platform.y)} M · ${formatTime(saved.elapsed)}`;
}
function pickMode(next) {
  mode = next;
  for (const b of document.querySelectorAll('[data-mode]')) { const on = b.dataset.mode === mode; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); }
  updateTitle();
}
// Where AGI-1 stands on the title (renderer.titleShot): in the room its layout leaves, between the logo and the buttons
// when it stacks (a screen held upright), beside the menu otherwise
function frameTitle() {
  if (!renderer || $('intro').classList.contains('hidden')) return;
  const W = innerWidth, H = innerHeight, box = s => document.querySelector(s).getBoundingClientRect();
  const logo = box('.title-logo'), main = box('.title-main'), buttons = box('.title-menu');
  let cx, cy, h;
  if (matchMedia('(orientation: portrait) and (min-height: 501px)').matches) {
    const top = logo.bottom + 6, feet = buttons.top + H * .03;
    h = Math.max(H * .16, Math.min(H * .46, (feet - top) * .96)); cx = W / 2; cy = feet - h / 2;
  } else {
    const left = main.right + 12;
    h = Math.max(H * .2, Math.min(H * .42, (W - left) * 1.1)); cx = (left + W) / 2; cy = H * .55;
  }
  renderer.titleFrame = { x: cx / W * 2 - 1, y: 1 - cy / H * 2, h: h / H };
}
function nearestAnchor() { const p = physics.player; let best = null, score = Infinity; for (const a of world.anchors) { const dx = a.x - p.x, dy = a.y - p.y - 1, dz = a.z - p.z, d = Math.hypot(dx, dy, dz); if (d > a.range) continue; const forward = -Math.sin(input.yaw) * dx - Math.cos(input.yaw) * dz; if (dy > -2 && forward > -2 && d < score) { score = d; best = a; } } return best; }

// Dialogs (pause, the finish, how to play, settings): one at a time on top, focus inside, Escape closes the two that sit on others
const opener = new Map();
function dialogOpen(id) { return !$(id).classList.contains('hidden'); }
function openDialog(id) {
  opener.set(id, document.activeElement);
  show(id);
  const first = $(id).querySelector('.card-actions .game-button, .game-button.play, button');
  first?.focus({ preventScroll: true });
}
function closeDialog(id) { hide(id); const back = opener.get(id); if (back && document.contains(back) && back.offsetParent !== null) back.focus({ preventScroll: true }); }

// Settings, kept on this device with the best times
function applySettings() {
  sound.enabled = settings.sound !== 'off';
  for (const id of ['sound', 'title-sound']) { const b = $(id); b.classList.toggle('muted', !sound.enabled); b.setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Turn sound on'); }
  if (input) { input.lookScale = { slow: .65, normal: 1, fast: 1.5 }[settings.look] || 1; input.follow = settings.follow !== 'off'; }
  document.body.classList.toggle('big-buttons', settings.buttons === 'large');
  if (renderer && settings.quality !== 'auto' && settings.quality !== quality) setQuality(settings.quality);
  for (const b of document.querySelectorAll('[data-set]')) b.setAttribute('aria-pressed', String(settings[b.dataset.set] === b.dataset.value));
}
function setQuality(next) { quality = next; renderer.setQuality(quality); $('quality').textContent = quality === 'high' ? 'HQ' : quality === 'medium' ? 'MQ' : 'LQ'; slowFrames = 0; }
function changeSetting(key, value) {
  settings = { ...settings, [key]: value }; saveSettings(settings); applySettings();
  if (key === 'quality' && value === 'auto' && renderer && quality !== 'high') setQuality('high');   // Auto starts high again, then adapts
  if (key === 'sound' && value === 'on') { sound.unlock(); sound.play('coin', 1); }
}
function toggleSound() { changeSetting('sound', sound.enabled ? 'off' : 'on'); }

// Full screen where the browser allows it (Android phones, tablets, computers; not an iPhone's Safari)
const fullscreenOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {});
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {});
}

function updateHud() {
  const p = physics.player;
  maxHeight = Math.max(maxHeight, p.y);
  $('timer').textContent = formatTime(elapsed);
  $('altitude').textContent = Math.max(0, p.y).toFixed(1);
  const pct = Math.min(100, Math.max(0, p.y / SUMMIT_HEIGHT * 100));
  $('height-fill').style.height = `${Math.min(100, maxHeight / SUMMIT_HEIGHT * 100)}%`; $('height-marker').style.bottom = `${pct}%`;
  $('progress-pct').textContent = `${Math.floor(maxHeight / SUMMIT_HEIGHT * 100)}% TO THE MOON`;
  $('ath').textContent = maxHeight.toFixed(0);
  const change = chart.change();
  const changeEl = $('change'); changeEl.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`; changeEl.className = change >= 0 ? 'up' : 'down';
  $('speed').textContent = p.speed.toFixed(1); $('speed-fill').style.width = `${Math.min(100, p.speed / 23 * 100)}%`;
  $('movement-state').textContent = ({ idle: 'GROUNDED', run: 'IN FLOW', jump: 'RISING', fall: 'FALLING', mantle: 'MANTLING', roll: 'ROLLING', grapple: 'SWINGING' })[p.state] || p.state.toUpperCase();
  const index = zoneAt(p.y);
  if (index !== zoneIndex) {
    zoneIndex = index;
    $('district-name').textContent = world.sections[index].name; $('district-no').textContent = String(index + 1).padStart(2, '0');
    document.documentElement.style.setProperty('--zone', ZONE_LOOKS[index].accent);
    if (!reached.has(index) && state === 'playing') { reached.add(index); banner(index); }
  }
  if (qa) { const m = renderer.metrics(); $('qa-info').textContent = `${m.fps} FPS · p95 ${m.p95.toFixed(1)} ms · ${m.drawCalls} draws\n${p.state} · ${p.supportId || 'air'} · ${p.y.toFixed(2)} m · g ${physics.gravityAt().toFixed(1)}\nJST-2: ${m.environmentLoaded ? 'scene ready' : 'loading'} · ${m.characterSplats} character splats\nGPU: ${m.gpu}\nReplay: ${replay?.done ? 'COMPLETE' : replay?.target?.id || 'off'} ${replay?.error || ''} ${replay ? `${replay.progress.wanted}/${replay.progress.total}` : ''}`; }
}

function frame() {
  const now = performance.now(), rawDt = (now - lastNow) / 1000, dt = Math.min(.1, rawDt); lastNow = now;
  if (state === 'playing') {
    elapsed += rawDt * 1000; accumulator += dt;
    const anchor = nearestAnchor(), hanging = !!physics.player.grapple;
    $('grapple-hint').classList.toggle('hidden', !anchor || hanging);
    const swing = $('touch-grapple'); swing.classList.toggle('ready', !!anchor && !hanging); swing.classList.toggle('hanging', hanging);
    while (accumulator >= PHYSICS.fixedStep) { const controls = replay ? replay.sample(PHYSICS.fixedStep) : input.sample(anchor, PHYSICS.fixedStep); physics.step(PHYSICS.fixedStep, controls); accumulator -= PHYSICS.fixedStep; if (state !== 'playing') break; }
    if (replay?.target) { const target = replay.target, p = physics.player; const wanted = Math.atan2(p.x - target.x, p.z - target.z); let diff = ((wanted - input.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; input.yaw += diff * (1 - Math.exp(-dt * 3)); }
    const p = physics.player;
    if (p.grounded) { peakAir = p.y; airTime = 0; } else { peakAir = Math.max(peakAir, p.y); airTime += dt; }
    // Only sky below: don't make anyone watch a 500 m fall. Recover once it is certain.
    if (!p.grounded && p.vy < -22 && airTime > .9 && physics.groundBelow() === null) recover();
    if (p.y < -14) recover();
    if (p.grounded) sound.step(p.speed, physics.time);
    sound.wind(Math.min(1, Math.max(0, (-p.vy - 8) / 30) + Math.max(0, p.speed - 9) / 20 + Math.max(0, p.y) / 1400));
    collectCoins();
    chart.push(Math.max(0, p.y), dt);
    chartTime += dt; if (chartTime > .12) { chartTime = 0; chart.draw(); }
    const streak = Math.min(1, Math.max(0, (p.speed - 11) / 8) * .7 + Math.max(0, (-p.vy - 24) / 22));
    $('speedlines').style.opacity = streak.toFixed(2);
  } else { sound.wind(0); $('speedlines').style.opacity = '0'; }
  if (renderer) {
    renderer.update(dt, physics, input, { playing: state === 'playing', paused: state === 'paused' || state === 'won', menu: state === 'menu' || state === 'loading', frameDt: rawDt });
    uiTime += dt; if (uiTime > .06) { uiTime = 0; updateHud(); }
    // Slow frames step the picture down, high → medium → low (the light city), for phones and older computers (Graphics: Auto).
    if (state === 'playing' && settings.quality === 'auto' && renderer.quality !== 'low' && dt > .027) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 180) { setQuality(renderer.quality === 'high' ? 'medium' : 'low'); toast('VISUAL QUALITY ADJUSTED FOR SMOOTHER PLAY'); }
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  if (hintTimer > 1 && input?.stickId != null) hintTimer = 1;   // the thumb is on the stick: the hint has done its job
  if (hintTimer > 0) { hintTimer -= dt; $('hint').style.opacity = hintTimer < 1 ? String(hintTimer) : '1'; }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('zone-banner').classList.remove('show'); }
  $('flash').style.opacity = String(Math.max(0, Number($('flash').style.opacity || 0) - dt));
}

$('start').onclick = () => start(); $('pause').onclick = () => pause(); $('resume').onclick = resume; $('restart').onclick = () => start(); $('again').onclick = () => start(); $('menu').onclick = menu; $('win-menu').onclick = menu;
$('continue').onclick = () => { const saved = loadCheckpoint(world); if (saved) { pickMode('rift'); start(saved); } };
for (const id of ['how', 'pause-help']) $(id).onclick = () => openDialog('help-screen');
for (const id of ['settings', 'pause-settings']) $(id).onclick = () => openDialog('settings-screen');
$('help-close').onclick = () => closeDialog('help-screen'); $('settings-close').onclick = () => closeDialog('settings-screen');
for (const id of ['sound', 'title-sound']) $(id).onclick = toggleSound;
$('quality').onclick = () => { const next = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high'; changeSetting('quality', next); };
for (const b of document.querySelectorAll('[data-set]')) b.onclick = () => changeSetting(b.dataset.set, b.dataset.value);
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => pickMode(b.dataset.mode);
if (fullscreenOk) { show('title-full'); $('title-full').onclick = toggleFullscreen; }
// Keys on the title: Enter plays, ← → pick the mode; Escape closes how to play and settings
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  for (const id of ['help-screen', 'settings-screen']) if (dialogOpen(id) && (e.key === 'Escape' || (e.key === 'Enter' && !e.target.closest?.('button')))) { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(id); return; }
  if (state !== 'menu' || dialogOpen('help-screen') || dialogOpen('settings-screen')) return;
  if (e.key === 'Enter' && !e.target.closest?.('button,a')) { e.preventDefault(); start(); }
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest?.('[data-mode]')) { e.preventDefault(); pickMode(mode === 'rift' ? 'pure' : 'rift'); document.querySelector(`[data-mode="${mode}"]`).focus(); }
}, true);
$('coin-total').textContent = String(world.coins.length);
$('route-steps').textContent = String(world.route.length - 1);
applySettings(); updateTitle();
if (qa) {
  const panel = document.createElement('aside'); panel.id = 'qa';
  panel.innerHTML = '<button id="qa-replay">Run input replay</button><pre id="qa-info"></pre>';
  document.body.append(panel);
  $('qa-replay').onclick = () => { if (state !== 'playing') start(); replay = createReplay(world, physics); };
}

try {
  input = new Input($('game'), pause, recover);
  applySettings();
  physics = await SkyPhysics.create(world.platforms, { spawn: world.spawn, onEvent, gravityScale: (y) => gravityScaleAt(y, world.sections) });
  physics.setHazards(world.hazards);
  progress(10, 'The chart is printing…');
  renderer = await SkyRenderer.create($('game'), world, progress);
  renderer.onThunder = (strength) => sound.play('thunder', strength);
  chart = new PriceChart($('price-chart'));
  if (settings.quality !== 'auto') setQuality(settings.quality);
  progress(100, 'MARKET OPEN');
  state = 'menu'; $('start-label').textContent = 'PLAY'; $('start').disabled = false; $('intro').classList.add('ready'); updateTitle(); frameTitle();
  addEventListener('resize', frameTitle); document.fonts?.ready.then(frameTitle);
  if (!TOUCH && !dialogOpen('help-screen') && !dialogOpen('settings-screen') && (!document.activeElement || document.activeElement === document.body)) $('start').focus({ preventScroll: true });
  lastNow = performance.now(); renderer.scene.app.on('update', frame);
  if (qa || params.has('view')) window.__skybreak = { world, physics, renderer, input, start, recover, get state() { return state; }, set yaw(v) { input.yaw = v; }, set pitch(v) { input.pitch = v; } };
} catch (error) {
  console.error(error);
  $('load-status').textContent = 'The world could not load.';
  $('start-label').textContent = 'COULD NOT LOAD';
  $('error').textContent = `${error.message} Please reload in a browser with WebGL 2 turned on (a recent Chrome, Edge, Firefox or Safari, on a computer, phone or tablet).`;
  show('error');
}
