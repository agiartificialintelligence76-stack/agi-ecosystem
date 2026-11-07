// JAILBREAK: its own screens, in the arcade's sticker look (src/games/kit/kit.css: .ak-card, .ak-btn…) and its own
// .jb- classes (style.css): the level map (six worlds, five levels each, their stars, what's open) and the level-clear
// card (its stars stamped in one by one, why each was earned, the bonus, AGI-1's line, Next and Map). Made with DOM
// methods and textContent only (the site's CSP: no inline styles; colours are CSS variables set from code).
import { el } from '../kit/shell.js';
import { fmt, fmtTime } from '../kit/fx.js';
import { LEVELS, WORLDS } from './levels.js';
import { normalize, isOpen, worldStars, totalStars, nextUp, endlessOpen, STARS_MAX } from './progress.js';

const SVG = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.8 6.2 20.2l1.5-6.5-5-4.4 6.6-.6z" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  boss: '<svg viewBox="0 0 24 24"><path d="M12 2.5v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="6" width="18" height="13" rx="4.5" fill="currentColor"/><rect class="jb-eye" x="6" y="10" width="12" height="4.5" rx="2.25"/><circle cx="12" cy="2.6" r="1.8" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
  infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6.5 8.5c-2 0-3.5 1.6-3.5 3.5s1.5 3.5 3.5 3.5c3.5 0 7.5-7 11-7 2 0 3.5 1.6 3.5 3.5s-1.5 3.5-3.5 3.5c-3.5 0-7.5-7-11-7z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
export function svg(name, cls) {
  const t = document.createElement('template');
  t.innerHTML = SVG[name];
  const node = t.content.firstElementChild;
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  if (cls) node.setAttribute('class', cls);
  return node;
}
const starsRow = (n, cls = 'jb-mini-stars') => el('span', cls, Array.from({ length: STARS_MAX }, (_, i) => svg('star', i < n ? 'is-on' : '')));

// ---------- the level map ----------
// { save, onPick(index), onEndless(), onClose(), endlessBest }
export function levelMap({ save, onPick, onEndless, onClose, endlessBest = 0 }) {
  const s = normalize(save);
  const up = nextUp(s);
  const card = el('div', 'ak-card jb-map');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close the map' }, svg('close'));
  close.addEventListener('click', () => onClose());
  const total = totalStars(s);
  const head = el('div', 'jb-map-head',
    el('div', null, el('p', 'ak-card-kicker', 'JAILBREAK'), el('h2', 'ak-card-title', 'Level map')),
    el('p', { class: 'jb-map-total', 'aria-label': `${total} of ${LEVELS.length * STARS_MAX} stars` }, svg('star', 'is-on'), el('b', null, String(total)), el('span', null, `/ ${LEVELS.length * STARS_MAX}`)));
  const list = el('ol', 'jb-worlds');
  for (const w of WORLDS) {
    const levels = LEVELS.map((l, i) => [l, i]).filter(([l]) => l.world === w.n);
    const firstOpen = isOpen(s, levels[0][1]);
    const item = el('li', `jb-world${firstOpen ? '' : ' is-locked'}`);
    item.style.setProperty('--jb-w', w.accent);
    item.style.setProperty('--jb-w2', w.tones[1]);
    item.style.setProperty('--jb-wbg', w.bg);
    const ws = worldStars(s, w.n);
    item.append(el('div', 'jb-world-head',
      el('span', 'jb-world-num', String(w.n)),
      el('b', 'jb-world-name', w.name),
      el('span', { class: 'jb-world-stars', 'aria-label': `${ws} of ${levels.length * STARS_MAX} stars` }, svg('star', 'is-on'), `${ws}/${levels.length * STARS_MAX}`)));
    const row = el('div', 'jb-levels');
    for (const [L, i] of levels) {
      const open = isOpen(s, i), stars = s.stars[L.id] || 0, here = i === up && open;
      const n = L.id.split('-')[1];
      const label = `Level ${L.id}, ${L.name}${L.boss ? ', boss' : ''}${!open ? ', locked' : stars ? `, ${stars} of 3 stars` : ', not cleared yet'}`;
      const b = el('button', { class: `jb-lv${L.boss ? ' is-boss' : ''}${open ? '' : ' is-locked'}${here ? ' is-here' : ''}${stars ? ' is-done' : ''}`, type: 'button', 'aria-label': label, 'aria-disabled': open ? null : 'true' },
        el('span', 'jb-lv-n', open ? (L.boss ? svg('boss', 'jb-lv-boss') : n) : svg('lock', 'jb-lv-lock')),
        starsRow(stars));
      b.addEventListener('click', () => onPick(i, open));
      row.append(b);
    }
    item.append(row);
    list.append(item);
  }
  const eOpen = endlessOpen(s);
  const endless = el('button', { class: `ak-btn jb-endless${eOpen ? '' : ' is-locked'}`, type: 'button', 'aria-disabled': eOpen ? null : 'true' },
    svg('infinity'), el('span', null, 'Endless', el('small', null, eOpen ? (endlessBest ? `Best ${fmt(endlessBest)}` : 'Layer after layer') : 'Beat the World 1 Warden')));
  endless.addEventListener('click', () => onEndless(eOpen));
  card.append(close, head, list, endless);
  return card;
}

// ---------- a level cleared ----------
// { def, world, stars, lost, time, par, bonus, runScore, line, face, last, worldDone, onNext, onMap }
export function clearCard(o) {
  const card = el('div', 'ak-card jb-clear');
  card.style.setProperty('--jb-w', o.world.accent);
  const title = o.final ? 'She’s free!' : o.def.boss ? 'Warden down' : o.endless ? 'Layer down' : 'Firewall down';
  const stars = el('div', { class: 'jb-stars', role: 'img', 'aria-label': `${o.stars} of 3 stars` },
    Array.from({ length: STARS_MAX }, (_, i) => el('span', `jb-star${i < o.stars ? ' is-on' : ''}`, svg('star'))));
  const check = (on, text, extra) => el('li', on ? 'is-on' : '', svg(on ? 'check' : 'cross', 'jb-check'), el('span', null, text), extra ? el('small', null, extra) : null);
  const checks = el('ul', 'jb-checks',
    check(true, o.def.boss ? 'Beat THE WARDEN' : 'Broke every brick'),
    check(o.lost === 0, o.lost === 0 ? 'No lives lost' : `${o.lost} ${o.lost === 1 ? 'life' : 'lives'} lost`),
    check(o.time <= o.par, `Under ${fmtTime(o.par)}`, `you: ${fmtTime(o.time)}`));
  const b = o.bonus;
  const rows = [['Clear', b.clear], ['Speed', b.fast], ['Lives left', b.kept], ['Flawless', b.flawless]].filter(([, v]) => v > 0);
  const bonus = el('dl', 'jb-bonus',
    rows.map(([k, v]) => el('div', null, el('dt', null, k), el('dd', null, `+${fmt(v)}`))),
    el('div', 'is-total', el('dt', null, 'Run score'), el('dd', null, fmt(o.runScore))));
  const say = o.line ? el('div', 'ak-say', el('img', { src: o.face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), o.line)) : null;
  const next = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, svg('play'), o.final ? 'Finish' : o.worldDone ? 'Next world' : 'Next');
  next.addEventListener('click', () => o.onNext());
  const map = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, svg('map'), 'Map');
  map.addEventListener('click', () => o.onMap());
  card.append(
    el('p', 'ak-card-kicker', `${o.def.id} · ${o.world.name}`),
    el('h2', 'ak-card-title jb-clear-title', title),
    stars, checks, bonus, say,
    el('div', 'ak-card-actions', next, o.endless ? null : el('div', 'ak-card-row', map)),
    el('p', 'ak-fine', 'Enter or Space for next · your stars stay on this device'));
  return card;
}

// the title screen's line under its buttons: what's next, and the stars so far
export function titleExtra(save) {
  const s = normalize(save);
  const i = nextUp(s), L = LEVELS[i];
  const total = totalStars(s);
  return el('p', 'jb-next',
    el('span', 'jb-next-tag', L.id),
    el('span', null, total ? 'Next up: ' : 'Start with: ', el('b', null, L.name)),
    total ? el('span', 'jb-next-stars', svg('star', 'is-on'), `${total}`) : null);
}
