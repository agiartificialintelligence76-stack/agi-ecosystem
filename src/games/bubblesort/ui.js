// BUBBLE SORT's own DOM, in the arcade's sticker look (./style.css on top of the kit's): AGI-1's speech bubble, the memory
// banks (the level select: stars per level, each bank's total), and the cards when a level ends (cleared: its stars
// stamping in; or out of shots / overflow). Real buttons with labels; built with DOM methods only (the site's CSP); its
// icons are SVG paths.
import { el } from '../kit/shell.js';
import { fmt } from '../kit/fx.js';
import { BANKS, LEVELS, PER_BANK } from './levels.js';

const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  star: { f: ['M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z'] },
  lock: { s: ['M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5'], f: ['M5.5 10.5h13v9.5h-13z'] },
  grid: { f: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'] },
  retry: { s: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 4.5v4.5h4.5'] },
  next: { f: ['M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z'] },
  close: { s: ['M6 6l12 12', 'M18 6 6 18'] },
  home: { s: ['M4 11l8-6.5 8 6.5', 'M6.5 9.5V19h11V9.5'] },
  x: { f: ['M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'] },
  heart: { f: ['M12 20.5S3 14.8 3 8.9A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 9 2.3c0 5.9-9 11.6-9 11.6z'] },
};
export function svg(name, cls = 'bs-ico') {
  const def = PATHS[name];
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  for (const d of def.f || []) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'bs-f'); s.append(p); }
  for (const d of def.s || []) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'bs-s'); s.append(p); }
  return s;
}
const starsRow = (n, cls = '') => el('span', `bs-stars-row ${cls}`, [0, 1, 2].map((i) => svg('star', `bs-ico bs-star${i < n ? ' is-on' : ''}`)));

// ---------- AGI-1's bubble ----------
export function createSay(stage) {
  const text = el('span', 'bs-say-text', '');
  const node = el('div', { class: 'bs-say', 'aria-live': 'polite', hidden: true }, el('p', 'bs-say-body', el('span', 'ak-sr', 'AGI-1: '), text));
  stage.append(node);
  let timer = 0, until = 0;
  return {
    node,
    show(line, ms = 2600, { force = false } = {}) {
      if (!line) return;
      if (!force && !node.hidden && performance.now() < until - 900) return;   // don't talk over herself
      text.textContent = line;
      node.hidden = false;
      node.classList.remove('is-out', 'is-in'); void node.offsetWidth; node.classList.add('is-in');
      clearTimeout(timer);
      until = performance.now() + ms;
      timer = setTimeout(() => this.hide(), ms);
    },
    hide() {
      clearTimeout(timer);
      if (node.hidden) return;
      node.classList.add('is-out');
      timer = setTimeout(() => { node.hidden = true; node.classList.remove('is-out'); }, 240);
    },
    place(L) {
      if (!L || !L.say) return;
      const s = L.say;
      const maxW = Math.max(150, Math.min(s.maxW, L.w - s.x - 12));
      node.style.left = `${Math.round(s.x)}px`;
      node.style.top = `${Math.round(s.y)}px`;
      node.style.maxWidth = `${Math.round(maxW)}px`;
      node.classList.toggle('is-wide', L.kind === 'W');
    },
    get open() { return !node.hidden; },
  };
}

// ---------- the memory banks: every level, its stars, each bank's total ----------
// progress: { stars(n), unlocked(n), next } ; onPick(n) ; onClose()
export function levelsCard({ progress, onPick, onClose }) {
  const card = el('div', 'ak-card bs-card bs-levels');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, svg('close', 'bs-ico'));
  close.addEventListener('click', () => onClose());
  const total = LEVELS.reduce((s, l) => s + progress.stars(l.n), 0);
  let focus = null;
  const banks = BANKS.map((b) => {
    const levels = LEVELS.filter((l) => l.bank === b.n);
    const got = levels.reduce((s, l) => s + progress.stars(l.n), 0);
    const open = progress.unlocked(levels[0].n);
    const tiles = levels.map((l) => {
      const ok = progress.unlocked(l.n), st = progress.stars(l.n), isNext = l.n === progress.next;
      const b2 = el('button', {
        class: `bs-tile${ok ? '' : ' is-locked'}${st ? ' is-done' : ''}${isNext ? ' is-next' : ''}`, type: 'button',
        'aria-label': ok ? `Level ${l.n}: ${l.name}${st ? `, ${st} of 3 stars` : ''}` : `Level ${l.n}: locked`,
        'aria-disabled': ok ? null : 'true',
      }, ok ? el('b', 'bs-tile-n', String(l.n)) : svg('lock', 'bs-ico bs-lock'), ok ? starsRow(st, 'is-sm') : null,
      l.goal === 'memories' && ok ? svg('heart', 'bs-ico bs-tile-mem') : null);
      b2.addEventListener('click', () => onPick(l.n, ok));
      if (isNext && ok) focus = b2;
      return b2;
    });
    return el('section', `bs-bank is-${b.tone}${open ? '' : ' is-locked'}`,
      el('div', 'bs-bank-head', el('span', 'bs-bank-n', `Bank ${b.n}`), el('b', 'bs-bank-name', b.name),
        el('span', 'bs-bank-stars', svg('star', 'bs-ico bs-star is-on'), `${got}/${levels.length * 3}`)),
      el('div', 'bs-tiles', tiles));
  });
  card.append(close, el('p', 'ak-card-kicker', 'BUBBLE SORT'), el('h2', 'ak-card-title', 'Memory banks'),
    el('p', 'bs-total', svg('star', 'bs-ico bs-star is-on'), el('b', null, `${total}`), ` of ${LEVELS.length * 3} stars`, el('span', 'bs-total-hint', ' · ', svg('heart', 'bs-ico bs-tile-mem'), ' free the memories')),
    el('div', 'bs-banks', banks));
  return { card, focus };
}

// ---------- a level cleared ----------
export function clearCard({ def, stars, score, shotsLeft, drop, best, line, face, next, share, bankDone, onNext, onRetry, onLevels }) {
  const card = el('div', 'ak-card bs-card bs-done');
  const big = el('div', 'bs-bigstars', [0, 1, 2].map((i) => {
    const s = el('span', `bs-bigstar${i < stars ? ' is-on' : ''}`, svg('star', 'bs-ico'));
    s.style.setProperty('--d', `${0.2 + i * 0.24}s`);
    return s;
  }));
  const nextB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, svg('next', 'bs-ico'), next ? 'Next level' : 'Memory banks');
  nextB.addEventListener('click', () => onNext());
  const retryB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, svg('retry', 'bs-ico'), 'Retry');
  retryB.addEventListener('click', () => onRetry());
  const levelsB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button', 'aria-label': 'Memory banks' }, svg('grid', 'bs-ico'), 'Levels');
  levelsB.addEventListener('click', () => onLevels());
  const shareA = el('a', { class: 'ak-btn ak-btn-sm ak-share', href: share, target: '_blank', rel: 'noopener noreferrer' }, svg('x', 'bs-ico'), 'Share');
  card.append(
    el('div', 'bs-done-main',
      el('p', 'ak-card-kicker', bankDone ? `Memory bank ${def.bank} · sorted` : `Level ${def.n} · cleared`),
      el('h2', 'ak-card-title', def.name),
      big,
      el('p', 'bs-done-score', el('b', null, fmt(score)), el('span', null, best ? ' new best' : ' points')),
      el('dl', 'ak-stats',
        el('div', 'ak-stat', el('dt', null, 'Stars'), el('dd', null, `${stars}/3`)),
        el('div', 'ak-stat', el('dt', null, 'Shots left'), el('dd', null, String(shotsLeft))),
        el('div', 'ak-stat is-wide', el('dt', null, 'Biggest drop'), el('dd', null, `${drop} bubble${drop === 1 ? '' : 's'}`)))),
    el('div', 'bs-done-side',
      el('div', 'ak-say', el('img', { src: face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line)),
      el('div', 'ak-card-actions', nextB, el('div', 'ak-card-row', retryB, levelsB, shareA)),
      el('p', 'ak-fine', 'Stars stay on this device.')));
  return card;
}

// ---------- a level lost: out of shots, or the stack crossed the deadline ----------
export function failCard({ def, reason, left, line, face, onRetry, onLevels, onMenu }) {
  const card = el('div', 'ak-card bs-card bs-fail');
  const retryB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, svg('retry', 'bs-ico'), 'Try again');
  retryB.addEventListener('click', () => onRetry());
  const levelsB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, svg('grid', 'bs-ico'), 'Levels');
  levelsB.addEventListener('click', () => onLevels());
  const menuB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, svg('home', 'bs-ico'), 'Menu');
  menuB.addEventListener('click', () => onMenu());
  card.append(el('p', 'ak-card-kicker', `Level ${def.n} · ${def.name}`),
    el('h2', 'ak-card-title', reason === 'overflow' ? 'Memory overflow' : 'Out of shots'),
    el('p', 'bs-fail-left', left),
    el('div', 'ak-say', el('img', { src: face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line)),
    el('div', 'ak-card-actions', retryB, el('div', 'ak-card-row', levelsB, menuB)));
  return card;
}

export { PER_BANK };
