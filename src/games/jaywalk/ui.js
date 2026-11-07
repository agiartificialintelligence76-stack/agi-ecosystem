// JAYWALK's own screens (2026-11-08), in the arcade's sticker look (style.css): the big row number, the look dock on
// the title (her picture, her name, your hearts), and the looks card (pick one, or spend hearts on a new one).
// Made with DOM methods only (the CSP: no HTML from strings, no style attributes).
import { el } from '../kit/shell.js';
import { CHARACTERS, charOf, looksOf, canUnlock } from './chars.js';

const SVG = 'http://www.w3.org/2000/svg';
function svg(viewBox, paths, cls) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (cls) s.setAttribute('class', cls);
  for (const [d, attrs = {}] of paths) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    s.append(p);
  }
  return s;
}
export const heartIcon = (cls = 'jw-heart') => svg('0 0 24 24', [[
  'M12 20.6c-.3 0-.6-.1-.8-.3C7.1 16.8 3 13.6 3 9.4 3 6.6 5.1 4.5 7.8 4.5c1.7 0 3.2.9 4.2 2.3 1-1.4 2.5-2.3 4.2-2.3 2.7 0 4.8 2.1 4.8 4.9 0 4.2-4.1 7.4-8.2 10.9-.2.2-.5.3-.8.3z',
  { fill: '#ff4da6', stroke: '#170a36', 'stroke-width': '2', 'stroke-linejoin': 'round' },
], ['M7.2 7.6c.6-.6 1.4-.8 2.1-.6', { fill: 'none', stroke: '#ffd1e8', 'stroke-width': '1.8', 'stroke-linecap': 'round' }]], cls);
const lockIcon = () => svg('0 0 24 24', [
  ['M7 10V8a5 5 0 0 1 10 0v2', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }],
  ['M5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-7A1.5 1.5 0 0 1 5.5 10z', { fill: 'currentColor' }],
], 'jw-lock');
const check = () => svg('0 0 24 24', [['M5 12.5l4.2 4.2L19 7', { fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]]);

// ---------- the HUD: rows (big), her best under it; hearts too in a demo (it has no top bar) ----------
export function createHud() {
  const rows = el('p', 'jw-rows', '0');
  const sub = el('p', 'jw-sub', '');
  const hearts = el('p', 'jw-hud-hearts', heartIcon(), el('span', null, '0'));
  const node = el('div', { class: 'jw-hud', 'aria-hidden': 'true' }, rows, sub, hearts);
  let shown = -1, best = 0, h = -1;
  return {
    node,
    set(n, { pop = false } = {}) {
      if (n === shown) return;
      shown = n;
      rows.textContent = String(n);
      if (pop) { rows.classList.remove('is-pop'); void rows.offsetWidth; rows.classList.add('is-pop'); }
      sub.textContent = best > 0 ? (n > best ? 'New best' : `Best ${best}`) : '';
      sub.classList.toggle('is-best', best > 0 && n > best);
    },
    best(b) { best = b || 0; const n = shown; shown = -1; this.set(Math.max(0, n)); },
    hearts(n) { if (n !== h) { h = n; hearts.lastChild.textContent = String(n); } },
  };
}

// ---------- the dock on the title: who's hopping, your hearts, and the way to the looks ----------
export function createDock({ thumb, onOpen }) {
  const img = el('img', { class: 'jw-dock-thumb', alt: '', width: 64, height: 64, draggable: 'false' });
  const name = el('b', null, '');
  const hint = el('small', null, '');
  const count = el('span', null, '0');
  const main = el('button', { class: 'jw-dock-main', type: 'button' }, img, el('span', 'jw-dock-text', name, hint), el('span', 'jw-dock-hearts', heartIcon(), count));
  main.addEventListener('click', () => onOpen());
  const node = el('div', 'jw-dock', main);
  return {
    node,
    update(save) {
      const s = looksOf(save);
      const c = charOf(s.look);
      const src = thumb(c.id);
      if (src && img.getAttribute('src') !== src) img.src = src;
      name.textContent = c.name;
      const ready = CHARACTERS.find((x) => !s.owned.includes(x.id) && s.hearts >= x.cost);
      hint.textContent = ready ? 'A new look is ready' : s.owned.length < CHARACTERS.length ? 'Tap to change look' : 'Every look is yours';
      main.classList.toggle('is-ready', Boolean(ready));
      count.textContent = String(s.hearts);
      main.setAttribute('aria-label', `Look: ${c.name}. ${s.hearts} hearts. ${ready ? 'A new look is ready. ' : ''}Change look`);
    },
  };
}

// ---------- the looks card ----------
export function lookCard({ save, thumb, onPick, onUnlock, onClose }) {
  const card = el('div', 'ak-card jw-picker');
  const bank = el('span', null, '');
  const grid = el('div', { class: 'jw-grid', role: 'group', 'aria-label': 'Looks' });
  const say = el('p', 'jw-pick-line', '');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, svg('0 0 24 24', [['M6 6l12 12M18 6L6 18', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round' }]]));
  close.addEventListener('click', () => onClose());
  const done = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Done');
  done.addEventListener('click', () => onClose());
  card.append(close, el('p', 'ak-card-kicker', 'JAYWALK'), el('h2', 'ak-card-title', 'Looks'),
    el('p', 'jw-bank', heartIcon(), bank, el('small', null, 'hearts to spend')), grid, say,
    el('div', 'ak-card-actions', done),
    el('p', 'ak-fine', 'Hearts are picked up on the street. Looks stay on this device.'));
  let cur = save;
  function draw(focusId = null) {
    const s = looksOf(cur);
    bank.textContent = String(s.hearts);
    grid.replaceChildren();
    for (const c of CHARACTERS) {
      const owned = s.owned.includes(c.id), on = s.look === c.id, ready = !owned && canUnlock(cur, c.id);
      const state = on ? 'Wearing' : owned ? 'Wear' : String(c.cost);
      const tile = el('button', {
        class: `jw-tile${on ? ' is-on' : ''}${owned ? '' : ready ? ' is-ready' : ' is-locked'}`, type: 'button',
        'aria-pressed': owned ? String(on) : null,
        'aria-label': owned ? `${c.name}${on ? ', wearing' : ''}` : ready ? `${c.name}: unlock for ${c.cost} hearts` : `${c.name}: locked, ${c.cost} hearts`,
        'data-id': c.id,
      },
      el('span', 'jw-tile-art', el('img', { src: thumb(c.id) || '', alt: '', width: 96, height: 96, draggable: 'false' }), on ? el('span', 'jw-tile-check', check()) : null,
        ready ? el('span', 'jw-tile-sticker', 'Unlock') : null),
      el('b', null, c.short || c.name),
      el('small', null, !owned && !ready ? lockIcon() : null, !owned ? heartIcon('jw-heart jw-heart-sm') : null, state));
      tile.addEventListener('click', () => {
        if (owned) { cur = onPick(c.id) || cur; draw(c.id); }
        else if (ready) { cur = onUnlock(c.id) || cur; draw(c.id); }
        else { say.textContent = `${c.name}: ${c.cost - s.hearts} more hearts. ${c.line}`; tile.classList.remove('is-shake'); void tile.offsetWidth; tile.classList.add('is-shake'); onPick(null); }
      });
      tile.addEventListener('pointerenter', () => { say.textContent = `${c.name}: ${c.line}`; });
      tile.addEventListener('focus', () => { say.textContent = `${c.name}: ${c.line}`; });
      grid.append(tile);
      if (focusId === c.id) requestAnimationFrame(() => tile.focus({ preventScroll: true }));
    }
    const c = charOf(s.look);
    if (!focusId) say.textContent = `${c.name}: ${c.line}`;
  }
  draw();
  return { card, redraw(next) { cur = next; draw(); } };
}
