// AGI arcade kit (2026-11-08): the frame around every new AGI game. It builds the page's top bar (back to the arcade,
// the game's numbers, sound, full screen, pause), the title screen, the pause and how-to-play cards, the end-of-run card
// with the player's best and Share on X, and toasts; it counts plays, keeps bests and settings, pauses the game when the
// tab is hidden, and answers Esc / P (pause), Enter / Space (play, play again). The game draws its playfield in
// `shell.stage` and calls the shell at its moments:
//
//   import { createShell } from '../kit/shell.js';
//   const shell = createShell({
//     game: 'mergeagi', name: 'MERGE TO AGI', path: '/games/mergeagi',
//     root: document.getElementById('ak-root'),
//     howTo: { steps: [['Drop', 'Tap where you want it to fall.'], …], touch: [['Tap', 'Drop']], keys: [['← →', 'Aim'], ['Space', 'Drop']] },
//     onPause() {}, onResume() {}, onRestart() {}, onQuit() {},
//   });
//   shell.title({ logo: ['MERGE', 'TO AGI'], tagline: 'Merge your way up to her.', art: node, onPlay: () => start() });
//   shell.started()                      → a run began (counts a play, shows the pause button)
//   shell.over({ score, label: 'points', stats: [['Biggest', 'GPU']], line: 'cute. again?', share: 'I merged my way to …' })
//   shell.toast('COMBO ×3', 'good')
//   const score = shell.chip('Score', 0); score.set(120, { pop: true })
//
// Everything visible is made with DOM methods and textContent; styles are in kit.css (the CSP allows no inline styles).
import './kit.css';
import { DEMO, TOUCH, CAN_FULLSCREEN, CAN_VIBRATE } from './env.js';
const VIBRATES = CAN_VIBRATE && TOUCH;
import { gameStore, settings } from './store.js';
import { createAudio } from './audio.js';
import { createSite } from './site.js';
import { shareUrl } from './share.js';
import { fmt } from './fx.js';
import { vibrate } from './input.js';

const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  unfull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4.5h4.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
};
export const icon = (name) => {
  const t = document.createElement('template');
  t.innerHTML = ICONS[name] || '';
  const svg = t.content.firstElementChild;
  svg?.setAttribute('aria-hidden', 'true');
  svg?.setAttribute('focusable', 'false');
  return svg;
};

// a tiny element maker: el('div', 'ak-x', 'text') or el('button', { class: 'ak-btn', type: 'button', 'aria-label': … }, child…)
export function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  if (typeof attrs === 'string') node.className = attrs;
  else if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

const FACE = '/images/landing/agi1-face.webp';
// append only the real nodes (Element.append would write "null" for a missing one)
const put = (parent, ...kids) => { parent.append(...kids.flat().filter((k) => k != null && k !== false)); return parent; };

// the last way in was a key (focus the card's first button, and show its ring) or a pointer (leave focus alone)
let keyboardUser = false;
addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey) keyboardUser = true; }, { capture: true });
addEventListener('pointerdown', () => { keyboardUser = false; }, { capture: true });

export function createShell(opts) {
  const { game, name, path = `/games/${game}`, root, howTo = null } = opts;
  if (!root) throw new Error('createShell: no root');
  const store = gameStore(game);
  const audio = createAudio();
  const site = createSite(game);
  let state = 'boot';                 // boot · title · play · pause · over · menu (a game's own screen)
  let titleOpts = null, overOpts = null;
  let lastFocus = null;

  document.documentElement.classList.add('ak-page');
  root.classList.add('ak');
  root.dataset.akGame = game;
  if (DEMO) root.dataset.akDemo = '';

  // ---------- the frame ----------
  const stage = el('div', { class: 'ak-stage' });
  const hud = el('div', { class: 'ak-hud', 'aria-live': 'off' });
  const soundBtn = el('button', { class: 'ak-ibtn', type: 'button', 'data-ak-sound': true });
  const fullBtn = el('button', { class: 'ak-ibtn', type: 'button', 'aria-label': 'Full screen', hidden: !CAN_FULLSCREEN || TOUCH });
  const pauseBtn = el('button', { class: 'ak-ibtn', type: 'button', 'aria-label': 'Pause', hidden: true }, icon('pause'));
  const back = el('a', { class: 'ak-ibtn ak-back', href: '/games', 'aria-label': 'Back to AGI games' }, icon('back'), el('span', 'ak-back-label', 'Arcade'));
  const bar = el('header', 'ak-bar', back, hud, el('div', 'ak-tools', soundBtn, fullBtn, pauseBtn));
  const titleEl = el('section', { class: 'ak-screen ak-title', hidden: true, 'aria-label': `${name}: start` });
  const layer = el('div', { class: 'ak-layer', hidden: true });
  const toasts = el('div', { class: 'ak-toasts', role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(stage, bar, titleEl, layer, toasts);

  // ---------- sound ----------
  const drawSound = () => {
    const s = settings.get();
    const on = s.sound || s.music;
    soundBtn.replaceChildren(icon(on ? 'soundOn' : 'soundOff'));
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on: turn it off' : 'Sound off: turn it on');
  };
  soundBtn.addEventListener('click', () => {
    const s = settings.get();
    const on = !(s.sound || s.music);
    settings.set({ sound: on, music: on });
    audio.unlock();
    if (on) audio.sfx('select');
  });
  settings.on(drawSound);
  drawSound();

  // ---------- full screen (computers; phones play full screen already, and iPhones have no Fullscreen API) ----------
  const isFull = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const drawFull = () => {
    fullBtn.replaceChildren(icon(isFull() ? 'unfull' : 'full'));
    fullBtn.setAttribute('aria-label', isFull() ? 'Leave full screen' : 'Full screen');
  };
  fullBtn.addEventListener('click', () => {
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
    } catch { /* not allowed */ }
  });
  document.addEventListener('fullscreenchange', drawFull);
  drawFull();

  // ---------- cards (pause, how to play, the end of a run) ----------
  function showLayer(card, { dim = true, label } = {}) {
    lastFocus = document.activeElement;
    layer.replaceChildren(card);
    layer.classList.toggle('is-dim', dim);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    if (label) card.setAttribute('aria-label', label);
    layer.hidden = false;
    stage.inert = true;
    titleEl.inert = true;
    const first = card.querySelector('[data-ak-first]') || card.querySelector('button, a[href]');
    // keyboard players land on its first button; a tap leaves focus alone (no ring on a phone), the keys still work
    if (keyboardUser) requestAnimationFrame(() => first?.focus({ preventScroll: true }));
    else requestAnimationFrame(() => { card.tabIndex = -1; card.focus({ preventScroll: true }); });
  }
  function hideLayer() {
    layer.hidden = true;
    layer.replaceChildren();
    stage.inert = false;
    titleEl.inert = false;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus?.({ preventScroll: true });
    lastFocus = null;
  }
  // a click on the dim backdrop of the pause card resumes
  layer.addEventListener('click', (e) => { if (e.target === layer && state === 'pause') resume(); });

  function switchRow(label, key) {
    const b = el('button', { class: 'ak-switch', type: 'button', role: 'switch', 'aria-checked': String(settings.get()[key]) },
      el('span', null, label), el('span', { class: 'ak-switch-ui', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => {
      const v = !settings.get()[key];
      settings.set({ [key]: v });
      b.setAttribute('aria-checked', String(v));
      audio.unlock();
      if (v && key === 'sound') audio.sfx('select');
      if (v && key === 'haptics') vibrate(18, true);
    });
    return b;
  }
  const switches = () => el('div', 'ak-switches', switchRow('Sound effects', 'sound'), switchRow('Music', 'music'), VIBRATES ? switchRow('Vibration', 'haptics') : null);

  function howToCard({ fromPause = false } = {}) {
    const h = howTo || { steps: [] };
    const card = el('div', 'ak-card');
    const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
    close.addEventListener('click', () => (fromPause ? pauseCard() : hideHowTo()));
    const steps = el('ol', 'ak-steps', (h.steps || []).map(([t, d]) => el('li', 'ak-step', el('div', null, el('b', null, t), el('span', null, d)))));
    const controls = el('dl', 'ak-controls');
    const add = (title, rows) => {
      if (!rows?.length) return;
      controls.append(el('p', 'ak-controls-title', title));
      for (const [k, v] of rows) controls.append(el('dt', null, k), el('dd', null, v));
    };
    if (TOUCH) { add('Touch', h.touch); add('Keyboard', h.keys); } else { add('Keyboard & mouse', h.keys); add('Touch', h.touch); }
    const ok = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, fromPause ? 'Back' : 'Got it');
    ok.addEventListener('click', () => (fromPause ? pauseCard() : hideHowTo()));
    put(card, close, el('p', 'ak-card-kicker', name), el('h2', 'ak-card-title', 'How to play'), h.intro ? el('p', null, h.intro) : null, steps,
      controls.childElementCount ? controls : null, el('div', 'ak-card-actions', ok));
    return card;
  }
  let howToOpenFromTitle = false;
  function showHowTo() { howToOpenFromTitle = true; showLayer(howToCard(), { label: `How to play ${name}` }); }
  function hideHowTo() { howToOpenFromTitle = false; hideLayer(); }

  function pauseCard() {
    const card = el('div', 'ak-card');
    const resumeB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, icon('play'), 'Resume');
    resumeB.addEventListener('click', () => resume());
    const restart = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, icon('again'), 'Restart');
    restart.addEventListener('click', () => { hideLayer(); state = 'play'; opts.onRestart?.(); });
    const help = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, 'How to play');
    help.addEventListener('click', () => showLayer(howToCard({ fromPause: true }), { label: `How to play ${name}` }));
    const quit = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost', type: 'button' }, 'Quit to menu');
    quit.addEventListener('click', () => { hideLayer(); quitToTitle(); });
    put(card, el('p', 'ak-card-kicker', name), el('h2', 'ak-card-title', 'Paused'), switches(),
      el('div', 'ak-card-actions', resumeB, el('div', 'ak-card-row', restart, howTo ? help : null), quit),
      el('p', 'ak-fine', null, el('a', { class: 'ak-link', href: '/games' }, 'Back to all AGI games')));
    showLayer(card, { label: 'Paused' });
  }

  // ---------- the run's states ----------
  function pause() {
    if (state !== 'play') return;
    state = 'pause';
    root.dataset.akState = state;
    opts.onPause?.();
    audio.suspend();
    pauseCard();
  }
  function resume() {
    if (state !== 'pause') return;
    hideLayer();
    state = 'play';
    root.dataset.akState = state;
    audio.resume();
    opts.onResume?.();
  }
  function quitToTitle() {
    state = 'title';
    audio.resume();
    opts.onQuit?.();
    if (titleOpts) api.title(titleOpts);
  }
  pauseBtn.addEventListener('click', () => pause());

  // the tab hidden mid-run: paused (sound off until it comes back)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (state === 'play' && !DEMO) pause(); else audio.suspend(); }
    else if (state !== 'pause') audio.resume();
  });

  // keys: Esc / P pause and resume; Enter / Space play from the title and again after a run
  let overAt = 0;
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const k = e.key;
    if ((k === 'Escape' || k === 'p' || k === 'P') && state === 'play' && opts.pausable !== false) { e.preventDefault(); pause(); return; }
    if ((k === 'Escape' || k === 'p' || k === 'P') && state === 'pause') { e.preventDefault(); resume(); return; }
    if (k === 'Escape' && !layer.hidden && howToOpenFromTitle) { e.preventDefault(); hideHowTo(); return; }
    const onButton = e.target?.closest?.('button, a, input, select, textarea');
    if ((k === 'Enter' || k === ' ') && state === 'title' && layer.hidden && !onButton) { e.preventDefault(); titleOpts?.onPlay?.(); }
    if ((k === 'Enter' || k === ' ' || k === 'r' || k === 'R') && state === 'over' && performance.now() - overAt > 700 && !onButton && !e.repeat) {
      e.preventDefault(); overOpts?.onAgain?.();
    }
  });

  // ---------- the top bar's numbers ----------
  function chip(label, value = '', { accent = false, fmtFn = (v) => (typeof v === 'number' ? fmt(v) : String(v)) } = {}) {
    const v = el('span', 'ak-chip-value', fmtFn(value));
    const c = el('div', { class: `ak-chip${accent ? ' is-accent' : ''}` }, label ? el('span', 'ak-chip-label', label) : null, v);
    hud.append(c);
    let current = value;
    return {
      node: c,
      get value() { return current; },
      set(next, { pop = false } = {}) {
        if (next === current && !pop) return;
        current = next;
        v.textContent = fmtFn(next);
        if (pop) { c.classList.remove('is-pop'); void c.offsetWidth; c.classList.add('is-pop'); }
      },
      hide(h = true) { c.hidden = h; },
    };
  }

  function toast(text, tone = '', ms = 1400) {
    const t = el('div', { class: `ak-toast${tone ? ` is-${tone}` : ''}` }, text);
    toasts.append(t);
    while (toasts.childElementCount > 3) toasts.firstElementChild.remove();
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 260); }, ms);
  }

  // ---------- the title screen ----------
  function logoOf(logo) {
    if (logo instanceof Node) return logo;
    const lines = Array.isArray(logo) ? logo : [logo || name];
    return el('h1', 'ak-logo', lines.map((l) => (typeof l === 'string'
      ? el('span', 'ak-logo-line', l)
      : el('span', `ak-logo-line${l.small ? ' is-small' : ''}${l.tone ? ` is-${l.tone}` : ''}`, l.text))));
  }

  const api = {
    game, name, path, root, stage, hud, bar, audio, store, settings, el, icon,
    get state() { return state; },
    get touch() { return TOUCH; },
    get demo() { return DEMO; },
    chip, toast,
    haptic(pattern = 12) { vibrate(pattern, settings.get().haptics && !DEMO); },

    // the title screen: { logo: ['WORD', { text: 'WORD', tone: 'accent' | 'pink' | 'mint' | 'violet', small }] or a node,
    // tagline, art (a node behind it: the game's own attract mode), play: 'Play', onPlay, modes: [{ label, sub, onClick,
    // locked }], extra (a node under the buttons), best: number (null hides it), bestLabel, keysHint }
    title(o) {
      titleOpts = o;
      overOpts = null;
      state = 'title';
      root.dataset.akState = state;
      hideLayer();
      pauseBtn.hidden = true;
      hud.hidden = o.showHud !== true;          // the run's numbers show once it starts (a game may keep them: showHud)
      const playB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button' }, icon('play'), o.play || 'Play');
      playB.addEventListener('click', () => { audio.unlock(); o.onPlay?.(); });
      const modes = o.modes?.length ? el('div', 'ak-modes', o.modes.map((m) => {
        const b = el('button', { class: `ak-btn ak-btn-mode${m.locked ? ' is-locked' : ''}`, type: 'button', 'aria-disabled': m.locked ? 'true' : null }, m.label, m.sub ? el('small', null, m.sub) : null);
        b.addEventListener('click', () => { audio.unlock(); if (m.locked) { audio.sfx('error'); toast(m.lockedText || 'Locked', 'warn'); } else m.onClick?.(); });
        return b;
      })) : null;
      const best = o.best == null ? null : el('span', 'ak-best', o.bestLabel || 'Best', el('b', null, typeof o.best === 'number' ? fmt(o.best) : String(o.best)));
      const help = howTo ? el('button', { class: 'ak-link', type: 'button' }, 'How to play') : null;
      help?.addEventListener('click', () => showHowTo());
      const keysHint = !TOUCH && o.keysHint !== false ? el('p', 'ak-keys-hint', 'Press ', el('kbd', null, 'Space'), ' to play') : null;
      const art = el('div', { class: 'ak-title-art', 'aria-hidden': 'true' });
      if (o.art) art.append(o.art);
      titleEl.replaceChildren(art, el('div', { class: 'ak-screen-scrim', 'aria-hidden': 'true' }),
        el('div', 'ak-title-body',
          el('p', 'ak-kicker', 'AGI GAMES', el('b', null, 'Beta')),
          logoOf(o.logo),
          o.tagline ? el('p', 'ak-tagline', o.tagline) : null,
          el('div', 'ak-title-actions', o.hidePlay ? null : playB, modes),
          o.extra || null,
          el('div', 'ak-title-meta', best, help),
          keysHint,
          el('p', 'ak-fine', o.fine || 'Free to play · no wallet needed · your scores stay on this device')));
      titleEl.hidden = false;
      if (!DEMO && keyboardUser) requestAnimationFrame(() => playB.focus({ preventScroll: true }));
    },

    // a run began: counted (once per run), the title away, the pause button in the bar
    started({ count = true } = {}) {
      titleEl.hidden = true;
      hideLayer();
      hud.hidden = false;
      state = 'play';
      root.dataset.akState = state;
      pauseBtn.hidden = opts.pausable === false;
      if (count) site.play();
    },

    // the run ended: { score, label, best (null: the shell keeps it: `bestKey`), lower (lower is better), stats: [[label,
    // value, { wide }]], line (AGI-1's words), title ('Game over'), share (the post's whole words: the game puts the score
    // in them; without it, "I scored … in NAME on agi1.app"), onAgain, onMenu, extra (a node), again ('Play again'),
    // split (false: one column even on a short, wide screen, for a game with its own layout there) }
    over(o) {
      overOpts = o;
      state = 'over';
      root.dataset.akState = state;
      pauseBtn.hidden = true;
      overAt = performance.now();
      let best = o.best, isBest = Boolean(o.isBest);
      if (best === undefined && typeof o.score === 'number') {
        const r = store.recordBest(o.bestKey || 'best', o.score, { lower: o.lower });
        best = r.best; isBest = r.isBest;
      }
      store.bump('runs');
      const show = o.format || ((v) => (typeof v === 'number' ? fmt(v) : String(v)));
      const scoreEl = el('p', 'ak-score', show(0));
      const card = el('div', 'ak-card ak-over-card');
      const again = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, icon('again'), o.again || 'Play again');
      again.addEventListener('click', () => { audio.unlock(); o.onAgain?.(); });
      const menu = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, icon('home'), 'Menu');
      menu.addEventListener('click', () => { if (o.onMenu) o.onMenu(); else quitToTitle(); });
      const shareText = o.share ? `${o.share}` : `I scored ${show(o.score)} in ${name} on agi1.app 💜 can you beat it?`;
      const share = el('a', { class: 'ak-btn ak-btn-sm ak-share', href: shareUrl({ text: shareText, path }), target: '_blank', rel: 'noopener noreferrer' }, icon('x'), 'Share');
      const stats = o.stats?.length ? el('dl', 'ak-stats', o.stats.map(([k, v, x]) => el('div', `ak-stat${x?.wide ? ' is-wide' : ''}`, el('dt', null, k), el('dd', null, v)))) : null;
      const line = o.line ? el('div', 'ak-say', el('img', { src: FACE, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), o.line)) : null;
      // two halves: the run (its score, best, stats) and what's next (her line, the buttons). One column as usual; side by
      // side on a short, wide screen (a phone held sideways: Play again stays above the fold), unless `split: false`
      put(card,
        el('div', 'ak-over-main',
          el('p', 'ak-card-kicker', o.title || 'Game over'),
          scoreEl,
          el('p', 'ak-score-label', o.label || 'Score'),
          isBest ? el('p', 'ak-newbest', 'New best!') : null,
          !isBest && best != null ? el('p', 'ak-bestline', 'Your best ', el('b', null, show(best))) : null,
          stats),
        el('div', 'ak-over-side',
          line, o.extra || null,
          el('div', 'ak-card-actions', again, el('div', 'ak-card-row', share, menu)),
          el('div', 'ak-over-links', el('a', { class: 'ak-link', href: `/games#rate-${game}` }, 'Rate it'),
            el('a', { class: 'ak-link', href: '/games' }, 'More AGI games')),
          el('p', 'ak-fine', 'Scores stay on this device.')));
      if (o.split !== false) card.classList.add('is-split');
      showLayer(card, { dim: true, label: `${o.title || 'Game over'}: ${show(o.score)}` });
      // the tap that ended the run never lands on the card's buttons as it appears
      card.addEventListener('click', (e) => { if (performance.now() - overAt < 450) { e.preventDefault(); e.stopPropagation(); } }, { capture: true });
      // the score counts up
      const target = typeof o.score === 'number' ? o.score : null;
      if (target == null || DEMO) { scoreEl.textContent = show(o.score); return; }
      const t0 = performance.now(), dur = Math.min(1100, 350 + Math.log10(Math.abs(target) + 1) * 220);
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
        const v = Number.isInteger(target) ? Math.round(target * e) : Math.round(target * e * 100) / 100;
        scoreEl.textContent = show(k >= 1 ? target : v);
        if (k < 1 && state === 'over') requestAnimationFrame(tick); else scoreEl.textContent = show(target);
      };
      requestAnimationFrame(tick);
      if (isBest) setTimeout(() => audio.sfx('win'), 260);
    },

    // a game's own screen over the stage (a level map, an upgrade pick…): shown in the cards' layer
    card(node, { dim = true, label } = {}) { showLayer(node, { dim, label }); },
    closeCard() { hideLayer(); },
    menu() { quitToTitle(); },
    pause, resume,
    // the game's own pause: hide or show the bar's pause button (e.g. during a cutscene)
    pausable(on) { pauseBtn.hidden = !on || state !== 'play'; },
    showHowTo,
  };
  state = 'boot';
  root.dataset.akState = state;
  return api;
}
