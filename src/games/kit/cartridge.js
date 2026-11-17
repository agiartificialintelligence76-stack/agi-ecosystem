import { fitCanvas } from './canvas.js';
import { createLoop } from './loop.js';
import { rng } from './fx.js';
import { DEMO, REDUCED, SEED } from './env.js';
import { COLLECTION } from '../collection.js';
import './cartridge.css';

// A 480-unit playfield. The model owns the rules, illustration and demo player.
// The shell owns the clock, input lifecycle, settings, scores and play reporting.
export function mountCartridge(id, game, makeShell) {
  const info = COLLECTION.find((entry) => entry.id === id);
  const root = document.getElementById('ak-root');
  root.classList.add('cartridge');
  root.style.setProperty('--ak-accent', info.accent);
  root.style.setProperty('--ak-bg', info.ground);
  const shell = makeShell({
    root, name: info.name, howTo: { steps: game.instructions, keys: game.keys, touch: game.touch },
    onRestart: start, onPause: release, onQuit: release, onResume: () => canvas.focus({ preventScroll: true }),
  });
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', info.name + '. ' + game.instructions[0].join('. '));
  const field = document.createElement('div');
  field.className = 'cartridge-field';
  field.append(canvas);
  const hint = document.createElement('p');
  hint.className = 'cartridge-hint';
  hint.textContent = (shell.touch ? game.touch : game.keys).map(([k, action]) => k + ' · ' + action).join('     /     ');
  shell.stage.append(field, hint);
  const view = fitCanvas(canvas, { maxDpr: 2 });
  const held = new Set();
  let model, pointerId = null, lastPoint, ended = false;
  const metrics = [shell.chip('Score', 0, { accent: true }), shell.chip('Stage', 1)];
  const labels = metrics.map((m) => m.node.querySelector('.ak-chip-label'));

  function release() {
    for (const key of held) model?.key?.('up', key);
    held.clear();
    if (pointerId !== null) {
      model?.pointer?.('cancel', lastPoint.x, lastPoint.y);
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      pointerId = null;
    }
  }
  function start() {
    release();
    ended = false;
    const dice = rng(SEED || undefined);
    model = game.create({
      rng: dice.next, reducedMotion: REDUCED,
      sound: (preset, options) => { if (!DEMO) shell.audio.sfx(preset, options); },
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
        if (!DEMO) shell.over({ score: Math.round(score), stats, line, onAgain: start, onMenu: menu });
      },
    });
    shell.started();
    if (!DEMO) canvas.focus({ preventScroll: true });
  }
  function menu() {
    release();
    const art = new Image();
    art.className = 'cartridge-poster';
    art.src = '/images/games/' + id + '.webp';
    art.alt = '';
    shell.title({
      logo: info.name.split(' ').map((text, i) => ({ text, tone: i ? 'accent' : '' })),
      tagline: game.tagline, art, best: shell.store.best() || null, onPlay: start,
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
