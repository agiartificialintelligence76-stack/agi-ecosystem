// EPOCHS: its own screens and controls, in the arcade's sticker look (./style.css): the console beside or under the
// board (the level, the epochs v1…vK, the tick bar, Undo / Retry / New epoch), the D-pad, the level select, and the
// level-solved and out-of-epochs cards. DOM methods only (the CSP: no HTML from strings, no style attributes).
import { el } from '../kit/shell.js';
import { TINTS } from './sprite.js';

const SVG = 'http://www.w3.org/2000/svg';
export function svgIcon(d, { fill = false, cls = '' } = {}) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
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
  undo: () => svgIcon(['M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11']),
  retry: () => svgIcon(['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 4.5v4.5h4.5']),
  epoch: () => svgIcon(['M11 6L5 12l6 6', 'M19 6l-6 6 6 6']),
  grid: () => svgIcon(['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'], { fill: true }),
  restart: () => svgIcon(['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5']),
  lock: () => svgIcon(['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-6A1.5 1.5 0 0 1 5.5 11z']),
  star: (cls) => svgIcon(['M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.13L12 16.86l-5.5 2.9 1.05-6.13L3.1 9.3l6.15-.9z'], { fill: true, cls }),
  next: () => svgIcon(['M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z'], { fill: true }),
  x: () => svgIcon(['M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'], { fill: true }),
  close: () => svgIcon(['M6 6l12 12M18 6L6 18']),
  arrow: (r) => { const s = svgIcon(['M12 5l7 8h-4.5v6h-5v-6H5z'], { fill: true }); s.setAttribute('class', `ep-pad-ico r${r}`); return s; },
  dot: () => svgIcon(['M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z'], { fill: true }),
};

// ---------- the console ----------
export function createConsole({ onAct, touch }) {
  const lvlId = el('b', 'ep-lvl-id', '1-1');
  const lvlName = el('span', 'ep-lvl-name', '');
  const levelsBtn = el('button', { class: 'ep-ibtn', type: 'button', 'aria-label': 'Levels', title: 'Levels' }, ICON.grid());
  const restartBtn = el('button', { class: 'ep-ibtn', type: 'button', 'aria-label': 'Restart level (Shift R)', title: 'Restart level' }, ICON.restart());
  levelsBtn.addEventListener('click', () => onAct('levels'));
  restartBtn.addEventListener('click', () => onAct('restart'));
  const slots = el('div', { class: 'ep-slots', role: 'list', 'aria-label': 'Epochs' });
  const ticks = el('div', { class: 'ep-ticks', role: 'meter', 'aria-label': 'Ticks used', 'aria-valuemin': '0' });
  const tickText = el('span', 'ep-tick-text', '');
  const tip = el('p', 'ep-tip', '');
  const act = (name, label, icon, key, cls = '') => {
    const b = el('button', { class: `ep-btn ${cls}`, type: 'button', 'data-act': name }, icon, el('span', 'ep-btn-label', label), !touch && key ? el('kbd', null, key) : null);
    b.addEventListener('click', () => onAct(name));
    return b;
  };
  const undoB = act('undo', 'Undo', ICON.undo(), 'Z');
  const retryB = act('retry', 'Retry', ICON.retry(), 'R');
  const epochB = act('epoch', 'New epoch', ICON.epoch(), 'E', 'ep-btn-epoch');
  const acts = el('div', 'ep-acts', undoB, retryB, epochB);
  const pad = createPad(onAct);
  const ctrl = el('div', 'ep-ctrl', acts, pad.node);
  const info = el('div', 'ep-info',
    el('div', 'ep-head', el('p', 'ep-lvl', lvlId, lvlName), el('div', 'ep-tools', levelsBtn, restartBtn)),
    el('div', 'ep-row', slots, tickText),
    ticks, tip);
  const dock = el('section', { class: 'ep-dock', 'aria-label': 'Level console' }, info, ctrl);
  let shownT = -1, shownK = -1, tickEls = [], slotEls = [];
  return {
    node: dock, pad, epochB, undoB, retryB, info, ctrl, tip,
    level(def) {
      lvlId.textContent = def.id;
      lvlName.textContent = def.name;
      tip.textContent = def.tip || '';
      if (shownT !== def.T) {
        shownT = def.T;
        tickEls = Array.from({ length: def.T }, () => el('i'));
        ticks.replaceChildren(...tickEls);
        ticks.setAttribute('aria-valuemax', String(def.T));
      }
      if (shownK !== def.K) {
        shownK = def.K;
        slotEls = Array.from({ length: def.K }, (_, i) => el('span', { class: 'ep-slot', role: 'listitem' }, `v${i + 1}`));
        slots.replaceChildren(...slotEls);
      }
    },
    // the run's state: which epoch, how many ticks, what the big button says
    state({ epoch, K, t, T, status, rewinding }) {
      for (let i = 0; i < slotEls.length; i++) {
        const s = slotEls[i];
        const used = i < epoch - 1, cur = i === epoch - 1;
        s.className = `ep-slot${used ? ` is-used t${i % 4}` : ''}${cur ? ' is-live' : ''}`;
        s.textContent = cur ? 'you' : `v${i + 1}`;
        s.setAttribute('aria-label', cur ? `Epoch ${i + 1}: you, now` : used ? `Epoch ${i + 1}: echo v${i + 1}` : `Epoch ${i + 1}: not yet`);
      }
      for (let i = 0; i < tickEls.length; i++) tickEls[i].className = i < t ? (rewinding ? 'is-on is-back' : 'is-on') : i === t ? 'is-next' : '';
      ticks.setAttribute('aria-valuenow', String(t));
      tickText.textContent = `${t}/${T}`;
      const zapped = status === 'zapped';
      const last = epoch >= K;
      epochB.querySelector('.ep-btn-label').textContent = zapped && !last ? 'Keep as echo' : last ? 'Last epoch' : 'New epoch';
      epochB.classList.toggle('is-hot', !last && (zapped || (t > 0 && status === 'play' && t >= T - 2)));
      epochB.classList.toggle('is-last', last);
      epochB.disabled = last || status === 'won';
      undoB.disabled = t === 0 && epoch === 1;
      retryB.disabled = t === 0 || status === 'won';
    },
  };
}

// the D-pad: four arrows round a wait button; a press moves at once, holding repeats (game.js)
function createPad(onAct) {
  const mk = (dir, label, r, cls) => {
    const b = el('button', { class: `ep-pad-b ${cls}`, type: 'button', 'aria-label': label, 'data-dir': dir }, dir === 'W' ? ICON.dot() : ICON.arrow(r));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); onAct('pad-down', dir); });
    const up = () => onAct('pad-up', dir);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    // a keyboard press on a focused pad button (Enter/Space)
    b.addEventListener('click', (e) => { if (e.detail === 0) onAct('pad-tap', dir); });
    return b;
  };
  const node = el('div', { class: 'ep-pad', role: 'group', 'aria-label': 'Move' },
    mk('U', 'Up', 0, 'is-u'), mk('L', 'Left', 3, 'is-l'), mk('W', 'Wait a tick', 0, 'is-w'), mk('R', 'Right', 1, 'is-r'), mk('D', 'Down', 2, 'is-d'));
  return { node };
}

// ---------- stars ----------
function starRow(n, size = '') {
  return el('span', { class: `ep-stars ${size}`, 'aria-label': `${n} of 3 stars` }, [0, 1, 2].map((i) => ICON.star(i < n ? 'is-on' : '')));
}

// ---------- the level select ----------
export function levelSelect({ worlds, levels, progress, unlocked, current, onPick, onClose, touch, padOn, onPad }) {
  const card = el('div', 'ak-card ep-select');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, ICON.close());
  close.addEventListener('click', () => onClose());
  const solved = levels.filter((l) => progress[l.id]?.stars > 0).length;
  const stars = levels.reduce((s, l) => s + (progress[l.id]?.stars || 0), 0);
  const list = el('div', 'ep-worlds');
  let focusMe = null;
  for (const w of worlds) {
    const ls = levels.filter((l) => l.world === w.id);
    const open = unlocked(ls[0]);
    const wStars = ls.reduce((s, l) => s + (progress[l.id]?.stars || 0), 0);
    const tiles = ls.map((l, i) => {
      const ok = unlocked(l), st = progress[l.id]?.stars || 0;
      const isCur = l.id === current;
      const b = el('button', {
        class: `ep-tile${ok ? '' : ' is-locked'}${st ? ' is-done' : ''}${isCur ? ' is-current' : ''}`,
        type: 'button', 'aria-disabled': ok ? null : 'true',
        'aria-label': ok ? `Level ${l.id}, ${l.name}${st ? `, ${st} of 3 stars` : ''}` : `Level ${l.id}, locked`,
      }, ok ? el('b', null, String(i + 1)) : ICON.lock(), ok ? starRow(st, 'is-sm') : null);
      b.addEventListener('click', () => onPick(l, ok));
      if (isCur && ok) focusMe = b;
      return b;
    });
    list.append(el('section', `ep-world${open ? '' : ' is-locked'}`,
      el('div', 'ep-world-head', el('span', 'ep-world-n', `World ${w.id}`), el('b', null, w.name), el('span', 'ep-world-stars', ICON.star('is-on'), `${wStars}/18`)),
      el('div', 'ep-tiles', tiles)));
  }
  const padRow = touch ? (() => {
    const b = el('button', { class: 'ak-switch', type: 'button', role: 'switch', 'aria-checked': String(padOn) }, el('span', null, 'On-screen D-pad'), el('span', { class: 'ak-switch-ui', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onPad(v); });
    return el('div', 'ak-switches ep-switches', b);
  })() : null;
  card.append(close, el('p', 'ak-card-kicker', 'EPOCHS'), el('h2', 'ak-card-title', 'Levels'),
    el('p', 'ep-progress', el('span', null, `${solved}/${levels.length} solved`), el('span', 'ep-progress-stars', ICON.star('is-on'), `${stars}/${levels.length * 3}`)),
    list, padRow);
  return { card, focusMe };
}

// ---------- a level solved ----------
export function solvedCard({ def, stars, epochs, ticks, par, best, line, worldDone, allDone, next, share, onNext, onRetry, onLevels, face }) {
  const card = el('div', 'ak-card ep-done');
  const kicker = allDone ? 'All 30 solved' : worldDone ? `World ${def.world} complete` : `Level ${def.id} · solved`;
  const starsEl = el('div', 'ep-bigstars', [0, 1, 2].map((i) => {
    const s = el('span', `ep-bigstar${i < stars ? ' is-on' : ''}`, ICON.star());
    s.style.setProperty('--d', `${0.18 + i * 0.22}s`);
    return s;
  }));
  const goals = el('ul', 'ep-goals',
    el('li', 'is-on', ICON.star('is-on'), el('span', null, 'Solved')),
    el('li', epochs <= par.epochs ? 'is-on' : '', ICON.star(epochs <= par.epochs ? 'is-on' : ''), el('span', null, `${par.epochs} epochs or fewer`), el('b', null, String(epochs))),
    el('li', ticks <= par.ticks ? 'is-on' : '', ICON.star(ticks <= par.ticks ? 'is-on' : ''), el('span', null, `${par.ticks} moves or fewer`), el('b', null, String(ticks))));
  const say = el('div', 'ak-say', el('img', { src: face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line));
  const nextB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, ICON.next(), next ? 'Next level' : 'Levels');
  nextB.addEventListener('click', () => onNext());
  const retryB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.retry(), 'Retry');
  retryB.addEventListener('click', () => onRetry());
  const levelsB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.grid(), 'Levels');
  levelsB.addEventListener('click', () => onLevels());
  const shareA = el('a', { class: 'ak-btn ak-btn-sm ak-share', href: share, target: '_blank', rel: 'noopener noreferrer' }, ICON.x(), 'Share');
  card.append(
    el('div', 'ep-done-main',
      el('p', 'ak-card-kicker', kicker),
      el('h2', 'ak-card-title', def.name),
      starsEl,
      best ? el('p', 'ak-newbest', best) : null,
      goals),
    el('div', 'ep-done-side', say,
      el('div', 'ak-card-actions', nextB, el('div', 'ak-card-row', retryB, next ? levelsB : null, shareA)),
      el('p', 'ak-fine', 'Stars stay on this device.')));
  if (worldDone || allDone) card.classList.add('is-world');
  return card;
}

// ---------- out of epochs ----------
export function outCard({ def, line, face, onRetry, onUndo, onLevels }) {
  const card = el('div', 'ak-card ep-out');
  const retryB = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, ICON.retry(), 'Retry level');
  retryB.addEventListener('click', () => onRetry());
  const undoB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.undo(), 'Undo a move');
  undoB.addEventListener('click', () => onUndo());
  const levelsB = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, ICON.grid(), 'Levels');
  levelsB.addEventListener('click', () => onLevels());
  card.append(el('p', 'ak-card-kicker', `Level ${def.id}`), el('h2', 'ak-card-title', 'Out of epochs'),
    el('div', 'ak-say', el('img', { src: face, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line)),
    el('div', 'ak-card-actions', retryB, el('div', 'ak-card-row', undoB, levelsB)));
  return card;
}

export { TINTS };
