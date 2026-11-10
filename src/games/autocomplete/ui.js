// AUTOCOMPLETE (2026-11-09): its own DOM over the board, in the arcade's sticker look (src/games/kit/kit.css): the
// keycap logo, the tools (her "complete it for me" with her face, Zen's Finish), the "Show her guess" switch (the title
// and the pause card), the end card's top words. Real buttons with labels; DOM methods only (the site's CSP).
import { el } from '../kit/shell.js';
import { fmt } from '../kit/fx.js';

const FACE = '/images/landing/agi1-face.webp';

// the logo: AUTO typed on keys, then COMPLETE as the swipe that finishes it
export function logoNode() {
  const key = (ch, i, cls) => {
    const k = el('span', `ac-key ${cls}`, ch);
    k.style.setProperty('--i', String(i));
    return k;
  };
  const top = el('span', 'ac-logo-row ac-logo-typed', [...'AUTO'].map((c, i) => key(c, i, 'is-typed')));
  const bottom = el('span', 'ac-logo-row ac-logo-done', el('span', { class: 'ac-logo-path', 'aria-hidden': 'true' }), [...'COMPLETE'].map((c, i) => key(c, i, 'is-done')));
  return el('h1', { class: 'ac-logo', 'aria-label': 'AUTOCOMPLETE' }, el('span', { 'aria-hidden': 'true', class: 'ac-logo-keys' }, top, bottom));
}

// a switch row in the kit's look (role switch): its label, on/off
export function switchRow(label, get, set, cls = '') {
  const b = el('button', { class: `ak-switch ${cls}`, type: 'button', role: 'switch', 'aria-checked': String(get()) },
    el('span', null, label), el('span', { class: 'ak-switch-ui', 'aria-hidden': 'true' }));
  b.addEventListener('click', () => { const v = !get(); set(v); b.setAttribute('aria-checked', String(v)); });
  return b;
}

// the title's chip for her guess: a tap turns it on or off
export function guessChip(get, set) {
  const chip = el('button', { class: 'ac-guess-chip', type: 'button', role: 'switch', 'aria-checked': String(get()) },
    el('img', { src: FACE, alt: '', width: 28, height: 28 }), el('span', 'ac-guess-chip-label', 'Show her guess'), el('b', null, get() ? 'On' : 'Off'));
  chip.addEventListener('click', () => {
    const v = !get(); set(v);
    chip.setAttribute('aria-checked', String(v));
    chip.querySelector('b').textContent = v ? 'On' : 'Off';
  });
  return el('div', 'ac-title-extra', chip);
}

// the tools under the board: her hint ("complete it for me") and Zen's Finish
export function createTools(stage, on) {
  const cost = el('span', 'ac-hint-cost', '');
  const hint = el('button', { class: 'ac-tool ac-hint', type: 'button', 'aria-label': 'Complete it for me: AGI-1 shows a word' },
    el('img', { src: FACE, alt: '', width: 34, height: 34 }), el('span', 'ac-hint-text', el('b', null, 'Complete it'), el('small', null, 'for me')), cost);
  hint.addEventListener('click', () => on.hint?.());
  const finish = el('button', { class: 'ac-tool ac-finish', type: 'button' }, 'Finish');
  finish.addEventListener('click', () => on.finish?.());
  const bar = el('div', { class: 'ac-tools', role: 'toolbar', 'aria-label': 'Tools' }, hint, finish);
  stage.append(bar);
  return {
    bar, hint, finish,
    place(R, show) {
      bar.hidden = !show || !R || R.h <= 0;
      if (bar.hidden) return;
      Object.assign(bar.style, { left: `${R.x}px`, top: `${R.y}px`, width: `${R.w}px`, height: `${R.h}px` });
    },
    set({ mode, cost: c, enabled = true, active = false }) {
      finish.hidden = mode !== 'zen';
      cost.textContent = c;
      cost.hidden = !c;
      hint.disabled = !enabled;
      hint.classList.toggle('is-active', active);
    },
  };
}

// the end card's top words: the run's three best, as keys
export function topWordsNode(top) {
  if (!top.length) return null;
  return el('div', 'ac-top',
    el('p', 'ac-top-title', 'Top words'),
    el('ol', 'ac-top-list', top.map((t, i) => el('li', `ac-top-item${i === 0 ? ' is-first' : ''}`,
      el('span', 'ac-top-word', t.word.toUpperCase()), el('span', 'ac-top-pts', `+${fmt(t.points)}`)))));
}

// a line read out to screen readers
export function createLive(stage) {
  const node = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
  stage.append(node);
  return (text) => { node.textContent = text; };
}
