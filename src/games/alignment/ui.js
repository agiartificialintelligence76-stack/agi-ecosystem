// ALIGNMENT's own buttons and cards (DOM, the kit's sticker look): the two choice buttons under (or beside) the card,
// the endings collection, and the ending's row on the end-of-run card. Words go in with textContent; icons are SVG made
// with createElementNS (the site's CSP).
import { el, icon } from '../kit/shell.js';
import { ENDINGS } from './cards.js';
import { drawScene } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
function arrowSvg(dir) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', dir < 0 ? 'M19 12H5.5M11 5.5 4.5 12l6.5 6.5' : 'M5 12h13.5M13 5.5l6.5 6.5-6.5 6.5');
  for (const [k, v] of [['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2.8'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) p.setAttribute(k, v);
  svg.append(p);
  return svg;
}

// the two choices: { root, set(card), lean(side | null), place(L), show(bool) }
export function createChoices(stage, onPick) {
  const make = (side) => {
    const label = el('span', 'al-choice-label', '');
    const b = el('button', { class: `ak-btn al-choice al-choice-${side}`, type: 'button' }, side === 'left' ? arrowSvg(-1) : null, label, side === 'right' ? arrowSvg(1) : null);
    b.addEventListener('click', () => onPick(side));
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    return { b, label };
  };
  const L = make('left'), R = make('right');
  const root = el('div', { class: 'al-choices', hidden: true }, L.b, R.b);
  stage.append(root);
  let leaning = null;
  return {
    root,
    set(card) {
      L.label.textContent = card.left.label;
      R.label.textContent = card.right.label;
      L.b.classList.toggle('is-long', card.left.label.length > 10);
      R.b.classList.toggle('is-long', card.right.label.length > 10);
      L.b.setAttribute('aria-label', `${card.left.label} (swipe left)`);
      R.b.setAttribute('aria-label', `${card.right.label} (swipe right)`);
    },
    lean(side) {
      if (side === leaning) return;
      leaning = side;
      L.b.classList.toggle('is-lean', side === 'left');
      R.b.classList.toggle('is-lean', side === 'right');
    },
    busy(on) { root.classList.toggle('is-busy', on); },
    place(lay) {
      const btns = lay?.btns;
      if (!btns) { root.hidden = true; return; }
      for (const [b, r] of [[L.b, btns.left], [R.b, btns.right]]) {
        b.style.left = `${r.x}px`; b.style.top = `${r.y}px`; b.style.width = `${r.w}px`; b.style.height = `${r.h}px`;
      }
      root.classList.toggle('is-flank', btns.mode === 'flank');
      root.classList.toggle('is-short', lay.short);
      root.classList.toggle('is-big', btns.left.h >= 90);
    },
    show(on) { root.hidden = !on; },
  };
}

// an ending's little picture in its own canvas (a locked one as a silhouette)
export function endingThumb(ending, size, { locked = false } = {}) {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const c = el('canvas', { class: 'al-thumb', width: Math.round(size * dpr), height: Math.round(size * dpr), 'aria-hidden': 'true' });
  c.style.width = `${size}px`; c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = locked ? '#241640' : ending.secret ? '#ffe17a' : '#2d1f5e';
  ctx.fillRect(0, 0, size, size);
  drawScene(ctx, ending.art, size * 0.08, size * 0.08, size * 0.84, { locked, lockColor: '#3d2a70' });
  return c;
}

// the collection: every ending, found or not (a locked one shows its silhouette and a hint)
export function endingsCard({ found, onClose }) {
  const n = ENDINGS.filter((e) => found[e.id]).length;
  const card = el('div', 'ak-card al-coll');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', onClose);
  const detail = el('div', { class: 'al-coll-detail', 'aria-live': 'polite' });
  const showDetail = (e) => {
    const isFound = Boolean(found[e.id]);
    detail.replaceChildren(
      el('p', 'al-coll-kicker', `${e.secret ? 'Secret ending' : 'Ending'}${isFound && found[e.id].day ? ` · day ${found[e.id].day}` : ''}`),
      el('h3', 'al-coll-name', isFound ? e.name : 'Not found yet'),
      el('p', 'al-coll-text', isFound ? e.text : `Hint: ${e.hint}.`),
    );
    detail.classList.toggle('is-locked', !isFound);
  };
  const grid = el('ul', 'al-coll-grid');
  for (const e of ENDINGS) {
    const isFound = Boolean(found[e.id]);
    const b = el('button', { class: `al-end${isFound ? '' : ' is-locked'}${e.secret ? ' is-secret' : ''}`, type: 'button', 'aria-label': isFound ? `${e.name}: found` : `Locked ending. Hint: ${e.hint}` },
      endingThumb(e, 76, { locked: !isFound }),
      el('span', 'al-end-name', isFound ? e.name : '???'));
    b.addEventListener('click', () => { for (const x of grid.querySelectorAll('.al-end')) x.classList.remove('is-on'); b.classList.add('is-on'); showDetail(e); });
    grid.append(el('li', null, b));
  }
  const bar = el('div', { class: 'al-coll-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ENDINGS.length), 'aria-valuenow': String(n), 'aria-label': 'Endings found' }, el('span'));
  bar.firstChild.style.width = `${(n / ENDINGS.length) * 100}%`;
  detail.append(el('p', 'al-coll-text', n ? 'Tap an ending to read it again.' : 'Every run ends somehow. Find all sixteen ways.'));
  const ok = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Back');
  ok.addEventListener('click', onClose);
  card.append(close, el('p', 'ak-card-kicker', 'ALIGNMENT'), el('h2', 'ak-card-title', 'Endings'),
    el('p', 'al-coll-count', el('b', null, `${n}`), ` of ${ENDINGS.length} found`), bar, detail, grid, el('div', 'ak-card-actions', ok));
  return card;
}

// the ending's row on the end-of-run card
export function overExtra(ending, { isNew, found, total }) {
  return el('div', `al-over-end${ending.secret ? ' is-secret' : ''}`,
    endingThumb(ending, 64),
    el('div', 'al-over-end-text',
      el('p', 'al-over-end-kicker', `${ending.secret ? 'Secret ending' : 'Ending'} · ${found}/${total}`),
      el('p', 'al-over-end-name', ending.name)),
    isNew ? el('span', 'al-over-new', 'New') : null);
}
