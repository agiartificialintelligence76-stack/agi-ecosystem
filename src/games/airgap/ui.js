// AIR GAP: its own cards, in the kit's sticker language (.ak-card, .ak-btn, ink outlines, hard shadows): the title's
// logo and its ladder strip, "Her setting" (pick who you face), Settings, and the end of a match. Built with DOM
// methods and textContent only (the site's CSP).
import { el, icon } from '../kit/shell.js';
import { shareUrl } from '../kit/share.js';
import { SETTINGS, TOP, isUnlocked } from './ladder.js';
import { TARGETS } from './match.js';

const SVG = 'http://www.w3.org/2000/svg';
function svg(kind) {
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
  const stroke = (w = 2.6) => ({ fill: 'none', stroke: 'currentColor', 'stroke-width': String(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (kind === 'lock') {
    path('M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5', stroke());
    path('M5.5 10.5h13a1.5 1.5 0 0 1 1.5 1.5v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a1.5 1.5 0 0 1 1.5-1.5z', { fill: 'currentColor' });
  } else if (kind === 'star') {
    path('M12 2.8l2.75 5.8 6.35.8-4.65 4.4 1.2 6.3L12 17l-5.65 3.1 1.2-6.3L2.9 9.4l6.35-.8z', { fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '1.2', 'stroke-linejoin': 'round' });
  } else if (kind === 'next') {
    path('M5 12h13M13 6l6 6-6 6', stroke(2.8));
  } else if (kind === 'gear') {
    path('M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z', stroke(2.4));
    path('M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.85 1.85M7.35 16.65 5.5 18.5M18.5 18.5l-1.85-1.85M7.35 7.35 5.5 5.5', stroke(2.4));
  } else if (kind === 'two') {
    path('M8 4.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM16.5 6a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', { fill: 'currentColor' });
    path('M2.5 19.5c.4-3.6 2.7-5.6 5.5-5.6s5.1 2 5.5 5.6M13.8 14.6c.8-.4 1.7-.6 2.7-.6 2.6 0 4.6 1.8 5 5', stroke(2.4));
  } else if (kind === 'ladder') {
    path('M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10', stroke(2.4));
  } else if (kind === 'heart') {
    path('M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.4 7.2 4.4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.2 4.4 6.7-1.7 4.8-9.2 9.4-9.2 9.4z', { fill: 'currentColor' });
  }
  return s;
}
const stars = (n, cls = 'ag-stars') => el('span', { class: cls, 'aria-label': `${n} of 3 stars` }, [0, 1, 2].map((i) => el('span', `ag-star${i < n ? ' is-on' : ''}`, svg('star'))));

// ---------- the title ----------
export function logo() {
  return el('h1', { class: 'ak-logo ag-logo', 'aria-label': 'AIR GAP' },
    el('span', { class: 'ak-logo-line', 'aria-hidden': 'true' }, 'AIR'),
    el('span', { class: 'ag-seam', 'aria-hidden': 'true' }, el('i', 'ag-seam-puck')),
    el('span', { class: 'ak-logo-line is-mint', 'aria-hidden': 'true' }, 'GAP'));
}

// under the big button: who you'll face (her five settings as pips), and Settings
export function titleExtra(save, { onLadder, onSettings }) {
  const level = save.level;
  const pips = el('ol', { class: 'ag-pips', 'aria-hidden': 'true' }, SETTINGS.map((s, i) => {
    const cls = ['ag-pip', save.stars[i] ? 'is-done' : '', i === level ? 'is-current' : '', !isUnlocked(save, i) ? 'is-locked' : ''].filter(Boolean).join(' ');
    return el('li', cls, !isUnlocked(save, i) ? svg('lock') : save.stars[i] ? svg('star') : el('b', null, String(i + 1)));
  }));
  const strip = el('button', { class: 'ag-strip', type: 'button', 'aria-label': `Her setting: ${SETTINGS[level].name}. ${save.unlocked + 1} of 5 unlocked. Pick another` },
    el('span', 'ag-strip-k', 'Her setting'), pips, el('b', 'ag-strip-name', SETTINGS[level].name));
  strip.addEventListener('click', () => onLadder?.());
  const gear = el('button', { class: 'ak-btn ak-btn-sm ag-gear', type: 'button' }, svg('gear'), 'Settings');
  gear.addEventListener('click', () => onSettings?.());
  return el('div', 'ag-title-extra', strip, gear);
}

// ---------- Her setting: the ladder ----------
export function ladderCard(save, { onPick, onClose }) {
  const card = el('div', 'ak-card ag-card ag-ladder');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => onClose?.());
  const list = el('ol', 'ag-levels');
  SETTINGS.forEach((S, i) => {
    const locked = !isUnlocked(save, i);
    const rec = save.wins[i] + save.losses[i] ? `${save.wins[i]}–${save.losses[i]}` : 'new';
    const b = el('button', {
      class: `ag-level${locked ? ' is-locked' : ''}${i === save.level ? ' is-current' : ''}${save.stars[i] ? ' is-done' : ''}`,
      type: 'button', 'aria-disabled': locked ? 'true' : null, 'data-ak-first': i === save.level ? true : null,
      'aria-label': `${S.name}. ${S.blurb} ${locked ? `Locked: beat ${SETTINGS[i - 1].name} to unlock.` : `${save.stars[i]} of 3 stars. Wins ${save.wins[i]}, losses ${save.losses[i]}.`}`,
    },
    el('span', 'ag-level-n', locked ? svg('lock') : el('b', null, String(i + 1))),
    el('span', 'ag-level-text',
      el('span', 'ag-level-name', S.name, el('small', null, S.tag)),
      el('span', 'ag-level-meta', locked ? `Beat ${SETTINGS[i - 1].name} to unlock` : S.blurb)),
    locked ? el('span', 'ag-level-rec') : el('span', 'ag-level-rec', stars(save.stars[i]), el('small', null, rec)),
    locked ? null : el('span', 'ag-level-go', svg('next')));
    b.addEventListener('click', () => {
      if (!locked) { onPick?.(i); return; }
      b.classList.remove('is-nope'); void b.offsetWidth; b.classList.add('is-nope');
    });
    list.append(el('li', null, b));
  });
  card.append(close,
    el('p', 'ak-card-kicker', 'Air gap'),
    el('h2', 'ak-card-title', 'Her setting'),
    list,
    el('p', 'ag-legend', stars(1, 'ag-stars is-mini'), 'a win', stars(2, 'ag-stars is-mini'), 'by three', stars(3, 'ag-stars is-mini'), 'a shutout'));
  return card;
}

// ---------- Settings ----------
function seg(label, options, value, onPick) {
  const g = el('div', { class: 'ag-seg', role: 'group', 'aria-label': label });
  for (const [v, text, sub] of options) {
    const b = el('button', { class: 'ag-seg-btn', type: 'button', 'aria-pressed': String(v === value) }, el('b', null, text), sub ? el('small', null, sub) : null);
    b.addEventListener('click', () => {
      for (const x of g.children) x.setAttribute('aria-pressed', String(x === b));
      onPick(v);
    });
    g.append(b);
  }
  return el('div', 'ag-set-row', el('span', 'ag-set-label', label), g);
}
export function settingsCard(save, { onChange, onClose }) {
  const card = el('div', 'ak-card ag-card ag-settings');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => onClose?.());
  const st = save.settings;
  const done = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Done');
  done.addEventListener('click', () => onClose?.());
  card.append(close,
    el('p', 'ak-card-kicker', 'Air gap'),
    el('h2', 'ak-card-title', 'Settings'),
    el('div', 'ag-set',
      seg('Power-ups', [[true, 'On', 'chips slide in'], [false, 'Classic', 'just the puck']], st.powerups, (v) => onChange?.({ powerups: v })),
      seg('Match to', TARGETS.map((n) => [n, String(n), n === 5 ? 'quick' : n === 7 ? 'classic' : 'long']), st.to, (v) => onChange?.({ to: v })),
      seg('Puck', [[false, 'Normal', ''], [true, 'Turbo', 'faster, slicker']], st.turbo, (v) => onChange?.({ turbo: v }))),
    el('div', 'ak-card-actions', done));
  return card;
}

// ---------- the end of a match ----------
// o: { mode: 'vs' | '2p', result: 'win' | 'loss', you, her, level, stars, best, unlocked, top, line, stats, share,
//      onRematch, onNext, onLadder, onMenu }
export function resultCard(o) {
  const pp = o.mode === '2p';
  const win = o.result === 'win';
  const card = el('div', `ak-card ak-over-card ag-card ag-result ${win ? 'is-win' : 'is-loss'}${pp ? ' is-pp' : ''}`);
  const S = SETTINGS[o.level];
  const kicker = pp ? 'Two players' : `AGI-1 · ${S.name}`;
  const title = pp ? (win ? 'P1 wins' : 'P2 wins') : win ? 'You win' : 'She wins';
  const score = el('p', { class: 'ag-final', 'aria-label': `${o.you} to ${o.her}` },
    el('span', 'ag-final-you', String(o.you)), el('span', 'ag-final-dash', '–'), el('span', 'ag-final-her', String(o.her)));
  const names = el('p', 'ag-final-names', el('span', null, pp ? 'P1' : 'You'), el('span', null, pp ? 'P2' : 'AGI-1'));
  let banner = null;
  if (!pp && o.top) banner = el('div', 'ag-banner is-top', el('b', null, 'You beat No mercy'), el('span', null, 'Top of the ladder. Tell everyone.'));
  else if (!pp && o.unlocked >= 0) banner = el('div', 'ag-banner', el('b', null, 'Unlocked'), el('span', 'ag-promo', svg('lock'), el('span', null, SETTINGS[o.unlocked].name)));
  else if (!pp && o.best && o.stars) banner = el('div', 'ag-banner is-stars', el('b', null, 'New best'), stars(o.stars));
  const earned = !pp && win ? el('div', 'ag-earned', stars(o.stars), el('span', null, o.stars === 3 ? 'Shutout' : o.stars === 2 ? 'Won by three' : 'A win')) : null;
  const statList = o.stats?.length ? el('dl', 'ak-stats', o.stats.map(([k, v]) => el('div', 'ak-stat', el('dt', null, k), el('dd', null, v)))) : null;
  const line = o.line ? el('div', 'ak-say', el('img', { src: '/images/landing/agi1-face.webp', alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), o.line)) : null;
  const btn = (cls, kids, fn, attrs = {}) => {
    const b = el('button', { class: cls, type: 'button', ...attrs }, ...kids);
    b.addEventListener('click', fn);
    return b;
  };
  const canNext = !pp && o.unlocked >= 0 && o.unlocked <= TOP;
  const primary = canNext
    ? btn('ak-btn ak-btn-primary ak-btn-play', [svg('next'), `Play ${SETTINGS[o.unlocked].name}`], () => o.onNext?.(o.unlocked), { 'data-ak-first': true })
    : btn('ak-btn ak-btn-primary ak-btn-play', [icon('again'), 'Rematch'], () => o.onRematch?.(), { 'data-ak-first': true });
  const row1 = el('div', 'ak-card-row',
    canNext ? btn('ak-btn ak-btn-sm', [icon('again'), 'Rematch'], () => o.onRematch?.()) : null,
    pp ? null : btn('ak-btn ak-btn-sm', [svg('ladder'), 'Her setting'], () => o.onLadder?.()));
  const share = o.share ? el('a', { class: 'ak-btn ak-btn-sm ak-share', href: shareUrl({ text: o.share, path: '/games/airgap' }), target: '_blank', rel: 'noopener noreferrer' }, icon('x'), 'Share') : null;
  const row2 = el('div', 'ak-card-row', share, btn('ak-btn ak-btn-sm', [icon('home'), 'Menu'], () => o.onMenu?.()));
  card.append(
    el('div', 'ak-over-main', el('p', 'ak-card-kicker', kicker), el('h2', 'ag-result-title', title), score, names, earned, banner, statList),
    el('div', 'ak-over-side', line,
      el('div', 'ak-card-actions', primary, row1.childElementCount ? row1 : null, row2),
      el('div', 'ak-over-links', el('a', { class: 'ak-link', href: '/games#rate-airgap' }, 'Rate it'), el('a', { class: 'ak-link', href: '/games' }, 'More AGI games')),
      el('p', 'ak-fine', pp ? 'Rematch swaps who serves first.' : 'Your stars stay on this device.')));
  card.classList.add('is-split');
  return card;
}

export { svg };
