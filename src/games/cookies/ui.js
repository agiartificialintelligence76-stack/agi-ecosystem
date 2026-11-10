// ACCEPT ALL COOKIES: its own screens, in the arcade's sticker look (./style.css): the dock beside the browser window
// (retry, levels, AGI-1's speech bubble), the level select (three sites as browser tabs, ten levels each with their
// pixels), and the level-complete card (the pixels stamping in, her line, Next / Replay / Levels / Share). DOM methods
// only (the CSP: no HTML from strings, no style attributes).
import { el } from '../kit/shell.js';

const SVG = 'http://www.w3.org/2000/svg';
export function svgIcon(d, { fill = false, cls = '', vb = '0 0 24 24' } = {}) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', vb);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (cls) s.setAttribute('class', cls);
  for (const one of [].concat(d)) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', one);
    if (fill) p.setAttribute('fill', 'currentColor');
    else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.6'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    s.append(p);
  }
  return s;
}
export const ICON = {
  retry: () => svgIcon(['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 4.5v4.5h4.5']),
  grid: () => svgIcon(['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'], { fill: true }),
  next: () => svgIcon(['M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z'], { fill: true }),
  x: () => svgIcon(['M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'], { fill: true }),
  close: () => svgIcon(['M6 6l12 12M18 6L6 18']),
  lock: () => svgIcon(['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-6A1.5 1.5 0 0 1 5.5 11z']),
  // a pixel: a little square with a shine
  pixel: (on, cls = '') => svgIcon(['M5 5h14v14H5z', 'M8 8h3v3H8z'], { fill: true, cls: `ck-px${on ? ' is-on' : ''} ${cls}` }),
};

// a row of three pixels, `n` of them found
export const pixelRow = (n, cls = '') => el('span', { class: `ck-pixels ${cls}`, 'aria-label': `${n} of 3 pixels` }, [0, 1, 2].map((i) => ICON.pixel(i < n)));

// ---------- the dock: retry, levels, and AGI-1's bubble ----------
export function createDock(parent, { onRetry, onLevels, face }) {
  const retry = el('button', { class: 'ck-ibtn', type: 'button', 'aria-label': 'Retry the level (R)', title: 'Retry (R)' }, ICON.retry());
  const levels = el('button', { class: 'ck-ibtn', type: 'button', 'aria-label': 'Levels (L)', title: 'Levels (L)' }, ICON.grid());
  retry.addEventListener('click', () => onRetry());
  levels.addEventListener('click', () => onLevels());
  const node = el('div', { class: 'ck-dock', hidden: true }, retry, levels);
  const text = el('p', null, '');
  const say = el('div', { class: 'ck-say', 'aria-hidden': 'true' }, el('img', { src: face, alt: '', width: 44, height: 44 }), text);
  const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
  parent.append(node, say, live);
  let timer = 0;
  return {
    node, retry, levels, say, live,
    show(on) { node.hidden = !on; if (!on) this.hush(); },
    // AGI-1 pops in with a line for a moment
    speak(line, ms = 2800) {
      clearTimeout(timer);
      text.textContent = line;
      say.classList.remove('is-on'); void say.offsetWidth; say.classList.add('is-on');
      live.textContent = `AGI-1: ${line}`;
      timer = setTimeout(() => say.classList.remove('is-on'), ms);
    },
    hush() { clearTimeout(timer); say.classList.remove('is-on'); },
  };
}

// ---------- the level select: the three sites as browser tabs ----------
export function levelSelect({ sites, levels, prog, open, siteOpenFn, starsOf, siteStars, total, current, site, onPick, onClose, onSite }) {
  const card = el('div', 'ak-card ck-select');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, ICON.close());
  close.addEventListener('click', () => onClose());
  const tabs = el('div', { class: 'ck-tabs', role: 'tablist', 'aria-label': 'Sites' });
  const body = el('div', 'ck-site');
  let focusMe = null;
  const show = (sid) => {
    const s = sites.find((x) => x.id === sid);
    for (const b of tabs.children) {
      const on = Number(b.dataset.site) === sid;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const isOpen = siteOpenFn(sid);
    const ls = levels.filter((l) => l.site === sid);
    focusMe = null;
    const tiles = ls.map((l) => {
      const ok = open(l), st = starsOf(l.id), done = Boolean(prog[l.id]);
      const isCur = l.id === current;
      const b = el('button', {
        class: `ck-tile${ok ? '' : ' is-locked'}${done ? ' is-done' : ''}${isCur ? ' is-current' : ''}${l.n === 10 ? ' is-show' : ''}`,
        type: 'button', 'aria-disabled': ok ? null : 'true',
        'aria-label': ok ? `Level ${l.id}, ${l.name}${done ? `, ${st} of 3 pixels` : ''}` : `Level ${l.id}, locked`,
      }, ok ? el('b', null, String(l.n)) : ICON.lock(), ok ? pixelRow(st, 'is-sm') : null);
      b.addEventListener('click', () => onPick(l, ok));
      if (isCur && ok) focusMe = b;
      return b;
    });
    const head = el('div', 'ck-site-head',
      el('span', 'ck-url', el('i', null, 'cookies.agi1.app/'), s.key),
      el('span', 'ck-site-stars', ICON.pixel(true), `${siteStars(sid)}/30`));
    const lock = isOpen ? null : el('div', 'ck-site-lock', ICON.lock(), el('b', null, `Find ${s.unlock} pixels to open`), el('span', null, `You have ${total}`));
    body.replaceChildren(head, el('div', `ck-tiles${isOpen ? '' : ' is-shut'}`, tiles), lock);
    onSite?.(sid);
  };
  for (const s of sites) {
    const b = el('button', { class: `ck-tab${siteOpenFn(s.id) ? '' : ' is-locked'}`, type: 'button', role: 'tab', 'data-site': String(s.id) },
      siteOpenFn(s.id) ? null : ICON.lock(), el('span', null, s.name));
    b.addEventListener('click', () => show(s.id));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = sites.findIndex((x) => x.id === s.id), j = (i + (e.key === 'ArrowRight' ? 1 : sites.length - 1)) % sites.length;
      show(sites[j].id); tabs.children[j].focus();
    });
    tabs.append(b);
  }
  card.append(close, el('p', 'ak-card-kicker', 'ACCEPT ALL COOKIES'), el('h2', 'ak-card-title', 'Levels'),
    el('p', 'ck-progress', el('span', null, ICON.pixel(true), `${total}/90 pixels`)), tabs, body);
  show(site);
  return { card, focusMe: () => focusMe };
}

// ---------- a level fed ----------
export function doneCard({ L, stars, best, line, next, share, onNext, onReplay, onLevels, face, kicker }) {
  const card = el('div', 'ak-card ck-done');
  const big = el('div', { class: 'ck-bigpx', 'aria-label': `${stars} of 3 pixels` }, [0, 1, 2].map((i) => {
    const s = el('span', `ck-bigpx-one${i < stars ? ' is-on' : ''}`, ICON.pixel(i < stars));
    s.style.setProperty('--d', `${0.22 + i * 0.24}s`);
    return s;
  }));
  const say = el('div', 'ak-say', el('img', { src: face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line));
  const nextB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, ICON.next(), next ? 'Next' : 'Levels');
  nextB.addEventListener('click', () => onNext());
  const replay = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.retry(), 'Replay');
  replay.addEventListener('click', () => onReplay());
  const levelsB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.grid(), 'Levels');
  levelsB.addEventListener('click', () => onLevels());
  const shareA = el('a', { class: 'ak-btn ak-btn-sm ak-share', href: share, target: '_blank', rel: 'noopener noreferrer' }, ICON.x(), 'Share');
  card.append(
    el('div', 'ck-done-main',
      el('p', 'ak-card-kicker', kicker || `Level ${L.id} · cookie accepted`),
      el('h2', 'ak-card-title', L.name),
      big,
      best ? el('p', 'ak-newbest', best) : null),
    el('div', 'ck-done-side', say,
      el('div', 'ak-card-actions', nextB, el('div', 'ak-card-row', replay, next ? levelsB : null, shareA)),
      el('p', 'ak-fine', 'Pixels stay on this device.')));
  return card;
}
