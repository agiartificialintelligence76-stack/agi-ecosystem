import { fitCanvas } from './canvas.js';
import { createLoop } from './loop.js';
import { rng } from './fx.js';
import { DEMO, REDUCED, SEED } from './env.js';
import { COLLECTION } from '../collection.js';
import './cartridge.css';

// A 480-unit playfield. The model owns the rules, illustration and demo player.
// The shell owns the clock, input lifecycle, settings, scores and play reporting.
export function mountCartridge(id, game, makeShell, landscape) {
  const info = COLLECTION.find((entry) => entry.id === id);
  const root = document.getElementById('ak-root');
  root.classList.add('cartridge');
  root.style.setProperty('--ak-accent', info.accent);
  root.style.setProperty('--ak-bg', info.ground);
  root.dataset.marquee = info.style;
  const record = 'arcade-edition:' + info.name;
  let stopPreview = () => {};
  const shell = makeShell({
    root, name: info.name, howTo: { steps: game.instructions, keys: game.keys, touch: game.touch },
    onRestart: () => start(runSeed), onPause: release, onQuit() {
      release();
      stopPreview();
    }, onResume: () => canvas.focus({ preventScroll: true }),
  });
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', info.name + '. ' + game.instructions[0].join('. '));
  const field = document.createElement('div');
  field.className = 'cartridge-field';
  const announcement = document.createElement('span');
  announcement.className = 'ak-sr';
  announcement.setAttribute('role', 'status');
  field.append(canvas, announcement);
  const hint = document.createElement('p');
  hint.className = 'cartridge-hint';
  hint.textContent = (shell.touch ? game.touch : game.keys).map(([k, action]) => k + ' · ' + action).join('     /     ');
  shell.stage.append(field, hint);
  const view = fitCanvas(canvas, { maxDpr: 2 });
  const held = new Set();
  let model, pointerId = null, lastPoint, ended = false, runSeed = 0;
  const metrics = [shell.chip('Score', 0, { accent: true }), shell.chip('Stage', 1)];
  const labels = metrics.map((m) => m.node.querySelector('.ak-chip-label'));

  function release() {
    if (model?.cancelInput) model.cancelInput();
    else for (const key of held) model?.key?.('up', key);
    held.clear();
    if (pointerId !== null) {
      if (!model?.cancelInput) model?.pointer?.('cancel', lastPoint.x, lastPoint.y);
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      pointerId = null;
    }
  }
  const freshSeed = () => (Math.random() * 0x100000000) >>> 0;
  function start(seed = SEED || freshSeed()) {
    release();
    stopPreview();
    ended = false;
    announcement.textContent = '';
    runSeed = seed;
    const dice = rng(runSeed);
    model = game.create({
      rng: dice.next, reducedMotion: REDUCED,
      personalBest: (key) => DEMO ? null : shell.store.best(record + ':' + key),
      rememberBest: (key, value) => { if (!DEMO) shell.store.recordBest(record + ':' + key, value); },
      sound: (preset, options) => { if (!DEMO) shell.audio.sfx(preset, options); },
      announce: (text) => { if (!DEMO) announcement.textContent = text; },
      tone: (options) => { if (!DEMO) shell.audio.tone(options); },
      haptic: (ms) => shell.haptic(ms),
      hud: (a, x, b, y) => {
        for (const [i, name, value] of [[0, a, x], [1, b, y]]) {
          const metric = metrics[i];
          if (metric.node.hidden !== !name) metric.hide(!name);
          if (name && labels[i].textContent !== name) labels[i].textContent = name;
          if (name) metric.set(value);
        }
      },
      end: (score, stats, line) => {
        if (ended) return;
        ended = true;
        if (DEMO) return;
        const fresh = document.createElement('button');
        fresh.className = 'ak-btn ak-btn-sm cartridge-fresh';
        fresh.type = 'button';
        fresh.textContent = 'Start a fresh run';
        fresh.addEventListener('click', () => start(freshSeed()));
        shell.over({ bestKey: record, score: Math.round(score), stats, line, again: 'Replay this run',
          extra: fresh, onAgain: () => start(runSeed), onMenu: menu });
      },
    });
    shell.started();
    if (!DEMO) canvas.focus({ preventScroll: true });
  }
  function menu() {
    release();
    const poster = '/images/games/' + id + '.webp';
    const cover = landscape || poster;
    const art = document.createElement('div');
    art.className = 'cartridge-cover';
    const image = document.createElement('img');
    image.src = cover; image.alt = ''; image.decoding = 'async';
    const clip = document.createElement('video');
    clip.muted = true; clip.loop = true; clip.playsInline = true; clip.preload = 'none'; clip.poster = poster;
    clip.hidden = true;
    art.append(image, clip);
    const preview = document.createElement('button');
    preview.className = 'ak-link cartridge-preview';
    preview.type = 'button'; preview.textContent = 'Watch gameplay'; preview.setAttribute('aria-pressed', 'false');
    stopPreview = () => {
      clip.pause(); clip.hidden = true; image.hidden = false;
      preview.textContent = 'Watch gameplay'; preview.setAttribute('aria-pressed', 'false');
    };
    preview.addEventListener('click', () => {
      if (!clip.hidden) { stopPreview(); return; }
      if (!clip.getAttribute('src')) clip.src = '/images/games/' + id + '.mp4';
      image.hidden = true; clip.hidden = false;
      preview.textContent = 'Show cover'; preview.setAttribute('aria-pressed', 'true');
      clip.play().catch(stopPreview);
    });
    root.style.setProperty('--cartridge-art', 'url("' + cover + '")');
    shell.title({
      logo: info.wordmark.map((text, i) => ({ text, tone: i ? 'accent' : '' })),
      tagline: game.tagline, art, play: info.play, extra: preview,
      best: shell.store.best(record), onPlay: start,
    });
  }
  const playing = () => !DEMO && !ended && shell.state === 'play';
  function handlePointer(e) {
    const type = e.type.slice(7);
    if (!playing() || !e.isPrimary || (type === 'down' && e.button !== 0)) return;
    if (pointerId !== null && pointerId !== e.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 480 / rect.width;
    const y = (e.clientY - rect.top) * 480 / rect.height;
    lastPoint = { x, y };
    if (type === 'down') {
      pointerId = e.pointerId;
      canvas.setPointerCapture(pointerId);
      canvas.focus({ preventScroll: true });
    }
    model.pointer?.(type, x, y);
    if (type === 'up' || type === 'cancel') pointerId = null;
  }
  for (const type of ['down', 'move', 'up', 'cancel']) canvas.addEventListener('pointer' + type, handlePointer);
  addEventListener('keydown', (e) => {
    if (!playing() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.code === 'Tab' ||
        e.target.closest?.('a, button, input, select, textarea')) return;
    if (e.code.startsWith('Arrow') || ['Space', 'Enter', 'Backspace'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    model.key?.('down', e.code);
  });
  addEventListener('keyup', (e) => {
    if (!held.delete(e.code)) return;
    model?.key?.('up', e.code);
  });
  addEventListener('blur', release);
  const loop = createLoop({
    paused: () => shell.state !== 'play',
    update(dt) {
      if (ended) { if (DEMO) start(); return; }
      if (DEMO) model.demo?.(dt);
      if (!ended) model.update(dt);
    },
    render() {
      if (!model || shell.state !== 'play') return;
      const ctx = view.begin();
      ctx.save();
      ctx.scale(view.w / 480, view.h / 480);
      model.draw(ctx);
      ctx.restore();
    },
  });
  if (DEMO) start(); else menu();
  loop.start();
}
