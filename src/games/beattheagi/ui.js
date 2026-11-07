// BEAT THE AGI (2026-11-08): its own cards, in the kit's sticker language (.ak-card, .ak-btn, ink outlines, hard
// shadows): the ladder (pick a level, who starts), the end of a game (rematch, the next level, a promotion), and the
// title's little ladder. Built with DOM methods and textContent only (the site's CSP).
import { el, icon } from '../kit/shell.js';
import { shareUrl } from '../kit/share.js';
import { LEVELS, TOP } from './levels.js';
import { record } from './rules.js';

const SVG = 'http://www.w3.org/2000/svg';
function svgIcon(kind) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  const path = (d, attrs = {}) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    s.append(p);
  };
  if (kind === 'lock') {
    path('M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round' });
    path('M5.5 10.5h13a1.5 1.5 0 0 1 1.5 1.5v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a1.5 1.5 0 0 1 1.5-1.5z', { fill: 'currentColor' });
  } else if (kind === 'check') {
    path('M5 12.5l4.2 4.2L19 7', { fill: 'none', stroke: 'currentColor', 'stroke-width': '3.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  } else if (kind === 'next') {
    path('M5 12h13M13 6l6 6-6 6', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  } else if (kind === 'ladder') {
    path('M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' });
  } else if (kind === 'undo') {
    path('M9 7L4.5 11.5 9 16', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    path('M5 11.5h9a5 5 0 0 1 0 10h-2', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round' });
  }
  return s;
}

// a level's little sticker: done (a check), the one you're on, open, or locked
function chip(i, save, { current = -1, small = false } = {}) {
  const st = save.stats[LEVELS[i].id];
  const locked = i > save.unlocked;
  const done = st.w > 0;
  const cls = ['bt-chip', small ? 'is-small' : '', locked ? 'is-locked' : '', done ? 'is-done' : '', i === current ? 'is-current' : ''].filter(Boolean).join(' ');
  return el('span', { class: cls }, locked && !small ? svgIcon('lock') : null, el('b', null, LEVELS[i].id), done && !locked ? svgIcon('check') : null);
}

// the title: six chips, where you are on the climb
export function miniLadder(save) {
  const row = el('ol', { class: 'bt-mini', 'aria-label': `The ladder: ${save.unlocked + 1} of ${LEVELS.length} levels open` });
  LEVELS.forEach((L, i) => row.append(el('li', null, chip(i, save, { current: save.level, small: true }))));
  return el('div', 'bt-mini-wrap', row);
}

// The ladder card: pick a level (an open one starts it), and who starts. onPick(level), onStarter(value), onClose()
export function ladderCard(save, { onPick, onStarter, onClose }) {
  const card = el('div', 'ak-card bt-card bt-ladder');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => onClose?.());
  const list = el('ol', 'bt-levels');
  // the top of the ladder first: AGI at the top, 1B at the bottom
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const L = LEVELS[i];
    const st = save.stats[L.id];
    const locked = i > save.unlocked;
    const played = st.w + st.d + st.l;
    const meta = locked ? `Beat ${LEVELS[i - 1].id} to unlock` : played ? `${record(st)} · best streak ${st.best}` : 'Not played yet';
    const b = el('button', {
      class: `bt-level${locked ? ' is-locked' : ''}${i === save.level ? ' is-current' : ''}${st.w ? ' is-done' : ''}`,
      type: 'button', 'aria-disabled': locked ? 'true' : null, 'data-ak-first': i === save.level ? true : null,
      'aria-label': `${L.id}: ${L.blurb} ${locked ? `Locked. Beat ${LEVELS[i - 1].id} to unlock.` : `Record ${st.w} wins, ${st.d} draws, ${st.l} losses.`}`,
    },
    chip(i, save, { current: save.level }),
    el('span', 'bt-level-text', el('span', 'bt-level-blurb', el('span', 'bt-long', L.blurb), el('span', 'bt-short', L.short)), el('span', 'bt-level-meta', meta)),
    locked ? null : el('span', 'bt-level-go', svgIcon('next')));
    b.addEventListener('click', () => {
      if (!locked) { onPick?.(i); return; }
      b.classList.remove('is-nope');
      void b.offsetWidth;
      b.classList.add('is-nope');
    });
    list.append(el('li', null, b));
  }
  const seg = el('div', { class: 'bt-seg', role: 'group', 'aria-label': 'Who starts' });
  for (const [v, label] of [['you', 'You'], ['her', 'AGI-1'], ['swap', 'Take turns']]) {
    const b = el('button', { class: 'bt-seg-btn', type: 'button', 'aria-pressed': String(save.starter === v) }, label);
    b.addEventListener('click', () => {
      for (const x of seg.children) x.setAttribute('aria-pressed', String(x === b));
      onStarter?.(v);
    });
    seg.append(b);
  }
  card.append(close,
    el('p', 'ak-card-kicker', 'Beat the AGI'),
    el('h2', 'ak-card-title', 'The ladder'),
    el('p', 'bt-lede', 'Beat each AGI-1 once to unlock the next one up.'),
    list,
    el('div', 'bt-starter', el('span', 'bt-starter-label', 'Who starts'), seg),
    el('p', 'bt-note', 'Whoever starts can always force a win with perfect play. She knows it. Do you?'));
  return card;
}

// The end of a game. o: { result: 'win'|'loss'|'draw' (or 'pink'|'mint'|'draw' in pass & play), level, save,
// promoted, next, firstAgi, line, stats: [[k, v]…], share, pp: { pink, mint, draws }, onRematch, onNext, onLadder, onMenu }
export function resultCard(o) {
  const pp = o.mode === 'pp';
  const card = el('div', `ak-card ak-over-card bt-card bt-result is-${o.result}${o.promoted ? ' is-promoted' : ''}`);
  const L = LEVELS[o.level];
  let kicker, title;
  if (pp) { kicker = 'Pass & play'; title = o.result === 'draw' ? 'A draw' : o.result === 'pink' ? 'Pink wins' : 'Mint wins'; }
  else { kicker = `AGI-1 · ${L.id}`; title = o.result === 'win' ? 'You win' : o.result === 'loss' ? 'She wins' : 'A draw'; }
  const head = el('div', 'bt-result-head',
    el('p', 'ak-card-kicker', kicker),
    el('h2', 'bt-result-title', title));
  let banner = null;
  if (o.firstAgi) banner = el('div', 'bt-banner is-agi', el('b', null, 'You beat the AGI'), el('span', null, 'Top of the ladder. Tell no one. Or everyone.'));
  else if (o.promoted) {
    banner = el('div', 'bt-banner',
      el('b', null, 'Promoted'),
      el('span', 'bt-promo', el('span', 'bt-promo-from', `you beat ${L.id}`), svgIcon('next'), el('span', 'bt-promo-to', `next: ${LEVELS[o.next].id}`)));
  }
  const stats = o.stats?.length ? el('dl', 'ak-stats', o.stats.map(([k, v]) => el('div', 'ak-stat', el('dt', null, k), el('dd', null, v)))) : null;
  const line = o.line ? el('div', 'ak-say', el('img', { src: '/images/landing/agi1-face.webp', alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), o.line)) : null;

  const btn = (cls, kids, fn, attrs = {}) => {
    const b = el('button', { class: cls, type: 'button', ...attrs }, ...kids);
    b.addEventListener('click', fn);
    return b;
  };
  const canNext = !pp && o.level < TOP && o.level + 1 <= o.save.unlocked;
  const primary = o.promoted
    ? btn('ak-btn ak-btn-primary ak-btn-play', [svgIcon('next'), `Play ${LEVELS[o.next].id}`], () => o.onNext?.(o.next), { 'data-ak-first': true })
    : btn('ak-btn ak-btn-primary ak-btn-play', [icon('again'), 'Rematch'], () => o.onRematch?.(), { 'data-ak-first': true });
  const row1 = el('div', 'ak-card-row',
    o.promoted ? btn('ak-btn ak-btn-sm', [icon('again'), 'Rematch'], () => o.onRematch?.(), { 'aria-label': `Rematch ${L.id}` })
      : canNext ? btn('ak-btn ak-btn-sm', [svgIcon('next'), `Next: ${LEVELS[o.level + 1].id}`], () => o.onNext?.(o.level + 1)) : null,
    pp ? null : btn('ak-btn ak-btn-sm', [svgIcon('ladder'), 'Ladder'], () => o.onLadder?.()));
  const share = o.share ? el('a', { class: 'ak-btn ak-btn-sm ak-share', href: shareUrl({ text: o.share, path: '/games/beattheagi' }), target: '_blank', rel: 'noopener noreferrer' }, icon('x'), 'Share') : null;
  const row2 = el('div', 'ak-card-row', share, btn('ak-btn ak-btn-sm', [icon('home'), 'Menu'], () => o.onMenu?.()));
  card.append(
    el('div', 'ak-over-main', head, banner, stats),
    el('div', 'ak-over-side', line,
      el('div', 'ak-card-actions', primary, row1.childElementCount ? row1 : null, row2),
      el('div', 'ak-over-links', el('a', { class: 'ak-link', href: '/games#rate-beattheagi' }, 'Rate it'), el('a', { class: 'ak-link', href: '/games' }, 'More AGI games')),
      el('p', 'ak-fine', pp ? 'Rematch swaps who starts.' : 'Your record stays on this device.')));
  for (const k of [...card.querySelectorAll('.ak-card-actions > :empty')]) k.remove();
  card.classList.add('is-split');
  return card;
}

export function undoButton(onUndo) {
  const b = el('button', { class: 'ak-btn ak-btn-sm bt-undo', type: 'button', 'aria-label': 'Undo the last move', hidden: true }, svgIcon('undo'), 'Undo');
  b.addEventListener('click', () => onUndo?.());
  return b;
}
