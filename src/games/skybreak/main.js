import './style.css';
import { createWorld, formatTime, gravityScaleAt, SUMMIT_HEIGHT, ZONE_HEIGHT } from './world.js';
import { SkyPhysics, PHYSICS } from './physics.js';
import { SkyRenderer } from './renderer.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { PriceChart } from './hud.js';
import { ZONE_LOOKS } from './zones.js';
import { getBest, recordBest, getBestBag, recordBag, loadCheckpoint, saveCheckpoint, clearCheckpoint } from './save.js';
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

const progress = (pct, label) => { $('load-fill').style.width = `${pct}%`; $('load-status').textContent = label; };
function toast(message, tone = '') { const el = $('toast'); el.textContent = message; el.className = `toast show ${tone}`; toastTimer = 3.2; }
// Touchscreens (phones, tablets) play with the on-screen stick and buttons, so their first hint names those instead.
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
function hint(message) { $('hint').textContent = TOUCH && /^WASD/.test(message) ? 'Stick to move · ↑ to jump · Drag to look' : message; hintTimer = 7; }
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
    case 'grapple': if (event.attached) hint('Release E to carry your swing into the next jump.'); break;
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
  state = 'won'; input.active = false; document.exitPointerLock?.(); hide('hud'); show('win-screen');
  $('finish-time').textContent = formatTime(elapsed);
  $('finish-detail').textContent = `${mode === 'rift' ? 'Rift run' : 'Pure ascent'} · ${falls} recoveries · ${dumps} big dumps · ${SUMMIT_HEIGHT} metres`;
  $('finish-bag').textContent = `${bag.size} / ${world.coins.length} $AGI in the bag`;
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
  sound.unlock();
  for (const id of ['intro', 'pause-screen', 'win-screen', 'help-screen']) hide(id);
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
  renderer.cameraPos.set(physics.player.x, physics.player.y + 4, physics.player.z + 8);
  $('run-mode').textContent = mode === 'rift' ? 'RIFT RUN' : 'PURE ASCENT';
  $('best').textContent = getBest(mode) ? formatTime(getBest(mode)) : '—';
  if (!saved && !qa && mode === 'rift') clearCheckpoint();
  hint(saved ? 'Back at your rift. The chart is still climbing.' : 'WASD to move · Hold Space to jump · Mouse to look');
  // A host page (agi1.app counts runs started, never who) hears each run begin; the game itself needs nothing back.
  document.dispatchEvent(new CustomEvent('skybreak:run', { detail: { mode, continued: !!saved } }));
}

function pause(force) { if (state === 'playing') { state = 'paused'; input.active = false; input.clear(); document.exitPointerLock?.(); show('pause-screen'); } else if (state === 'paused' && !force) resume(); }
function resume() { hide('pause-screen'); state = 'playing'; input.active = true; lastNow = performance.now(); accumulator = 0; }
function recover() {
  if (state !== 'playing') return;
  falls++;
  physics.reset(mode === 'rift' && checkpoint ? checkpoint : world.spawn);
  accumulator = 0; peakAir = physics.player.y; airTime = 0;
  renderer.cameraPos.set(physics.player.x, physics.player.y + 4, physics.player.z + 8);
  toast(checkpoint && mode === 'rift' ? 'RIFT POSITION RESTORED' : 'BACK TO THE LAUNCHPAD');
  $('flash').className = ''; $('flash').style.opacity = '.25';
}
function menu() { state = 'menu'; input.active = false; input.clear(); document.exitPointerLock?.(); document.body.classList.remove('playing'); hide('hud'); hide('pause-screen'); hide('win-screen'); show('intro'); physics.reset(world.spawn); replay = null; updateContinue(); }
function updateContinue() {
  let button = $('continue');
  if (!button) { button = document.createElement('button'); button.id = 'continue'; button.className = 'text-button'; button.style.marginLeft = '24px'; button.textContent = 'Continue saved rift ↗'; $('how').after(button); button.onclick = () => { const saved = loadCheckpoint(world); if (saved) { mode = 'rift'; start(saved); } }; }
  button.classList.toggle('hidden', !loadCheckpoint(world) || mode !== 'rift');
}
function nearestAnchor() { const p = physics.player; let best = null, score = Infinity; for (const a of world.anchors) { const dx = a.x - p.x, dy = a.y - p.y - 1, dz = a.z - p.z, d = Math.hypot(dx, dy, dz); if (d > a.range) continue; const forward = -Math.sin(input.yaw) * dx - Math.cos(input.yaw) * dz; if (dy > -2 && forward > -2 && d < score) { score = d; best = a; } } return best; }

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
    const anchor = nearestAnchor();
    $('grapple-hint').classList.toggle('hidden', !anchor || !!physics.player.grapple);
    while (accumulator >= PHYSICS.fixedStep) { const controls = replay ? replay.sample(PHYSICS.fixedStep) : input.sample(anchor); physics.step(PHYSICS.fixedStep, controls); accumulator -= PHYSICS.fixedStep; if (state !== 'playing') break; }
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
    // Slow frames step the picture down, high → medium → low (the light city), for phones and older computers.
    if (state === 'playing' && renderer.quality !== 'low' && dt > .027) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 180) { quality = renderer.quality === 'high' ? 'medium' : 'low'; renderer.setQuality(quality); $('quality').textContent = quality === 'medium' ? 'MQ' : 'LQ'; slowFrames = 0; toast('VISUAL QUALITY ADJUSTED FOR SMOOTHER PLAY'); }
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  if (hintTimer > 0) { hintTimer -= dt; $('hint').style.opacity = hintTimer < 1 ? String(hintTimer) : '1'; }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('zone-banner').classList.remove('show'); }
  $('flash').style.opacity = String(Math.max(0, Number($('flash').style.opacity || 0) - dt));
}

$('start').onclick = () => start(); $('pause').onclick = () => pause(); $('resume').onclick = resume; $('restart').onclick = () => start(); $('again').onclick = () => start(); $('menu').onclick = menu; $('win-menu').onclick = menu;
$('how').onclick = () => show('help-screen'); $('help-close').onclick = () => hide('help-screen');
$('sound').onclick = () => { sound.enabled = !sound.enabled; $('sound').textContent = sound.enabled ? '♪' : '×'; $('sound').setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable sound'); };
$('quality').onclick = () => { quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high'; renderer.setQuality(quality); $('quality').textContent = quality === 'high' ? 'HQ' : quality === 'medium' ? 'MQ' : 'LQ'; };
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => { mode = button.dataset.mode; for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('active', b === button); updateContinue(); };
$('coin-total').textContent = String(world.coins.length);
$('route-steps').textContent = String(world.route.length - 1);
if (getBestBag()) $('best-bag').textContent = `BEST BAG ${getBestBag()} $AGI`;
if (qa) {
  const panel = document.createElement('aside'); panel.id = 'qa';
  panel.innerHTML = '<button id="qa-replay">Run input replay</button><pre id="qa-info"></pre>';
  document.body.append(panel);
  $('qa-replay').onclick = () => { if (state !== 'playing') start(); replay = createReplay(world, physics); };
}

try {
  input = new Input($('game'), pause, recover);
  physics = await SkyPhysics.create(world.platforms, { spawn: world.spawn, onEvent, gravityScale: (y) => gravityScaleAt(y, world.sections) });
  physics.setHazards(world.hazards);
  progress(10, 'The chart is printing…');
  renderer = await SkyRenderer.create($('game'), world, progress);
  renderer.onThunder = (strength) => sound.play('thunder', strength);
  chart = new PriceChart($('price-chart'));
  progress(100, 'MARKET OPEN.');
  $('start-label').textContent = 'BEGIN ASCENT'; $('start').disabled = false; state = 'menu'; updateContinue();
  lastNow = performance.now(); renderer.scene.app.on('update', frame);
  if (qa || params.has('view')) window.__skybreak = { world, physics, renderer, input, start, recover, get state() { return state; }, set yaw(v) { input.yaw = v; }, set pitch(v) { input.pitch = v; } };
} catch (error) {
  console.error(error);
  $('load-status').textContent = 'The world could not load.';
  $('error').textContent = `${error.message} Please reload in a browser with WebGL 2 turned on (a recent Chrome, Edge, Firefox or Safari, on a computer, phone or tablet).`;
  show('error');
}
