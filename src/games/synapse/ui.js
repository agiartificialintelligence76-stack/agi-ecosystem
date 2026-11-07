// SYNAPSE (2026-11-08): its own DOM over the board, in the arcade's sticker look (src/games/kit/kit.css): the tools
// under the board (Undo, Reset, Hint, Boards; Skip in Rush), the panel when a board is solved, AGI-1's bubble, and the
// cards: the campaign's packs and boards, and the Daily. Real buttons with labels; made with DOM methods only (the
// site's CSP), its icons drawn as SVG paths.
import { el } from '../kit/shell.js';
import { fmtTime } from '../kit/fx.js';
import { PACKS, packSize, UNLOCK_AT, DAILY } from './packs.js';
import { COLORS } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  undo: { s: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'] },
  reset: { s: ['M3.5 12a8.5 8.5 0 1 0 2.6-6.1', 'M3.5 4.5v5h5'] },
  hint: { s: ['M9.5 18.5h5', 'M10.5 21.5h3', 'M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.7.5 1.1 1.3 1.1 2.1h5.2c0-.8.4-1.6 1.1-2.1A6.2 6.2 0 0 0 12 2.8z'] },
  grid: { f: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'] },
  next: { s: ['M5 12h13', 'M12.5 5.5 19 12l-6.5 6.5'] },
  skip: { f: ['M4 5.5v13l8-6.5z', 'M12.5 5.5v13l8-6.5z'] },
  lock: { s: ['M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5'], f: ['M5.5 10.5h13v9.5h-13z'] },
  star: { f: ['M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z'] },
  check: { s: ['M5 12.5l4.5 4.5L19 7.5'] },
  back: { s: ['M15 5l-7 7 7 7'] },
  close: { s: ['M6 6l12 12', 'M18 6 6 18'] },
  bolt: { f: ['M13.5 2 4.5 13.5h6.5L10 22l9.5-12h-6.6z'] },
  sun: { s: ['M12 2.5v2.5', 'M12 19v2.5', 'M2.5 12H5', 'M19 12h2.5', 'M5.3 5.3l1.8 1.8', 'M16.9 16.9l1.8 1.8', 'M5.3 18.7l1.8-1.8', 'M16.9 7.1l1.8-1.8'], c: [12, 12, 4.2] },
};
export function svg(name, cls = 'sy-ico') {
  const def = PATHS[name];
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  for (const d of def.f || []) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'sy-f'); s.append(p); }
  for (const d of def.s || []) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'sy-s'); s.append(p); }
  if (def.c) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', def.c[0]); c.setAttribute('cy', def.c[1]); c.setAttribute('r', def.c[2]); c.setAttribute('class', 'sy-s'); s.append(c); }
  return s;
}

// ---------- the tools under (or beside) the board ----------
export function createTools(stage, on) {
  const btn = (name, label, icon, cls = '') => {
    const b = el('button', { class: `sy-tool ${cls}`, type: 'button', 'aria-label': label, 'data-tool': name },
      el('span', 'sy-tool-ico', svg(icon)), el('span', 'sy-tool-label', label));
    b.addEventListener('click', () => on[name]?.());
    return b;
  };
  const undo = btn('undo', 'Undo', 'undo');
  const reset = btn('reset', 'Reset', 'reset');
  const hint = btn('hint', 'Hint', 'hint');
  const badge = el('span', 'sy-badge', '3');
  hint.querySelector('.sy-tool-ico').append(badge);
  const boards = btn('boards', 'Boards', 'grid');
  const skip = btn('skip', 'Skip', 'skip');
  const bar = el('div', { class: 'sy-tools', role: 'toolbar', 'aria-label': 'Board tools' }, undo, reset, hint, boards, skip);
  // the solved panel
  const title = el('p', 'sy-done-title', 'Solved');
  const statsEl = el('p', 'sy-done-stats', '');
  const next = el('button', { class: 'ak-btn ak-btn-primary sy-next', type: 'button' }, el('span', null, 'Next'), svg('next'));
  next.addEventListener('click', () => on.next?.());
  const doneBoards = el('button', { class: 'ak-btn ak-btn-sm sy-done-boards', type: 'button', 'aria-label': 'All boards' }, svg('grid'));
  doneBoards.addEventListener('click', () => on.boards?.());
  const done = el('div', { class: 'sy-done', role: 'status', hidden: true }, el('div', 'sy-done-text', title, statsEl), el('div', 'sy-done-actions', doneBoards, next));
  stage.append(bar, done);
  let mode = 'camp';
  return {
    bar, done, next,
    setMode(m) {
      mode = m;
      hint.hidden = m === 'rush';
      boards.hidden = m !== 'camp';
      skip.hidden = m !== 'rush';
      doneBoards.hidden = m !== 'camp';
    },
    setHints(count) {
      badge.textContent = String(count);
      hint.classList.toggle('is-empty', count <= 0);
      hint.setAttribute('aria-label', `Hint (${count} left)`);
    },
    setEnabled({ undo: u = true, reset: r = true } = {}) { if (undo.disabled !== !u) undo.disabled = !u; if (reset.disabled !== !r) reset.disabled = !r; },
    show(v) { bar.hidden = !v; },
    place(L, demo) {
      if (demo || !L || !L.tools) { bar.hidden = true; done.hidden = true; return; }
      const t = L.tools;
      bar.classList.toggle('is-col', t.dir === 'col');
      Object.assign(bar.style, { left: `${t.x}px`, top: `${t.y}px`, width: `${t.w}px`, height: `${t.h}px` });
      if (L.mode === 'P') {
        const w = Math.min(t.w, 420);
        Object.assign(done.style, { left: `${t.x + (t.w - w) / 2}px`, top: `${t.y - 14}px`, width: `${w}px`, height: '' });
        done.classList.remove('is-side');
      } else {
        // under the board's name (its numbers make way: everything is filled by now)
        const inf = L.info;
        Object.assign(done.style, { left: `${inf.x}px`, top: `${L.head.y + L.headBig * 2.6}px`, width: `${inf.w}px`, height: '' });
        done.classList.add('is-side');
      }
    },
    // solved: { title, stats, perfect, nextLabel }
    solved(info) {
      title.replaceChildren(info.perfect ? svg('star', 'sy-ico sy-star') : svg('check', 'sy-ico'), el('span', null, info.title));
      title.classList.toggle('is-perfect', Boolean(info.perfect));
      statsEl.textContent = info.stats;
      next.firstChild.textContent = info.nextLabel || 'Next';
      done.hidden = false;
      bar.hidden = true;
      done.classList.remove('is-in'); void done.offsetWidth; done.classList.add('is-in');
    },
    unsolved() { done.hidden = true; bar.hidden = false; },
    get mode() { return mode; },
  };
}

// ---------- AGI-1's bubble ----------
export function createSay(stage) {
  const text = el('span', 'sy-say-text', '');
  const node = el('div', { class: 'sy-say', 'aria-live': 'polite', hidden: true },
    el('img', { src: '/images/landing/agi1-face.webp', alt: '', width: 40, height: 40 }), el('p', 'sy-say-body', el('span', 'ak-sr', 'AGI-1: '), text));
  stage.append(node);
  let timer = 0;
  return {
    node,
    show(line, ms = 3200) {
      if (!line) return;
      text.textContent = line;
      node.hidden = false;
      node.classList.remove('is-out', 'is-in'); void node.offsetWidth; node.classList.add('is-in');
      clearTimeout(timer);
      if (ms > 0) timer = setTimeout(() => this.hide(), ms);
    },
    hide() {
      clearTimeout(timer);
      if (node.hidden) return;
      node.classList.add('is-out');
      timer = setTimeout(() => { node.hidden = true; node.classList.remove('is-out'); }, 260);
    },
    place(L) {
      if (!L || !L.say) return;
      const s = L.say;
      node.classList.toggle('is-side', s.side);
      Object.assign(node.style, s.side
        ? { left: `${s.x - s.w / 2}px`, top: '', bottom: '', width: `${s.w}px`, transform: '' }
        : { left: `${s.x}px`, top: `${Math.max(4, s.y)}px`, width: '', maxWidth: `${s.w}px` });
      if (s.side) node.style.top = `${L.info.y + L.info.h - 4}px`;
    },
    get open() { return !node.hidden; },
  };
}

// ---------- the campaign: its packs, then a pack's boards ----------
// progress: { done(p, i) → 0 | 1 | 2 (solved, perfect), solvedIn(p), perfectIn(p), unlocked(p), next(p) }
export function campaignCard({ progress, onBoard, onClose, start = null }) {
  const card = el('div', 'ak-card sy-card');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, svg('close', 'sy-ico'));
  close.addEventListener('click', () => onClose?.());
  const body = el('div', 'sy-card-body');
  card.append(close, body);
  const packs = () => {
    const grid = el('div', 'sy-packs');
    PACKS.forEach((pk, p) => {
      const total = packSize(pk), solved = progress.solvedIn(p), perfect = progress.perfectIn(p), open = progress.unlocked(p);
      const bar = el('span', 'sy-pack-bar', el('span', 'sy-pack-fill'));
      bar.firstChild.style.width = `${Math.round((solved / total) * 100)}%`;
      const b = el('button', { class: `sy-pack is-${pk.tone}${open ? '' : ' is-locked'}`, type: 'button', 'aria-disabled': open ? null : 'true' },
        el('span', 'sy-pack-top', el('span', 'sy-pack-name', pk.name), open ? null : svg('lock', 'sy-ico sy-lock')),
        el('span', 'sy-pack-size', `${pk.size}${pk.twist && pk.twist !== 'mixed' ? ` · ${pk.twist}` : pk.twist === 'mixed' ? ' · everything' : ''}`),
        bar,
        el('span', 'sy-pack-count', open ? `${solved}/${total}` : `Solve ${UNLOCK_AT} in ${PACKS[p - 1].name}`,
          open && perfect ? el('span', 'sy-pack-stars', svg('star', 'sy-ico sy-star'), String(perfect)) : null));
      b.addEventListener('click', () => { if (open) boards(p); else b.classList.remove('is-shake'), void b.offsetWidth, b.classList.add('is-shake'); });
      grid.append(b);
    });
    body.replaceChildren(el('p', 'ak-card-kicker', 'Synapse'), el('h2', 'ak-card-title', 'Campaign'), grid);
    requestAnimationFrame(() => grid.querySelector('.sy-pack:not(.is-locked)')?.focus({ preventScroll: true }));
  };
  const boards = (p) => {
    const pk = PACKS[p];
    const back = el('button', { class: 'sy-back', type: 'button' }, svg('back', 'sy-ico'), 'Packs');
    back.addEventListener('click', () => packs());
    const grid = el('div', 'sy-boards');
    const nxt = progress.next(p);
    for (let i = 0; i < packSize(pk); i++) {
      const st = progress.done(p, i);
      const b = el('button', { class: `sy-board${st ? ' is-done' : ''}${st === 2 ? ' is-perfect' : ''}${i === nxt ? ' is-next' : ''}`, type: 'button', 'aria-label': `Board ${i + 1}${st === 2 ? ', perfect' : st ? ', solved' : ''}` },
        el('span', 'sy-board-n', String(i + 1)), st === 2 ? svg('star', 'sy-ico sy-star') : st ? svg('check', 'sy-ico') : null);
      b.addEventListener('click', () => onBoard(p, i));
      grid.append(b);
    }
    body.replaceChildren(back, el('p', 'ak-card-kicker', pk.size), el('h2', 'ak-card-title', pk.name), grid);
    requestAnimationFrame(() => (grid.children[nxt] || grid.firstChild)?.focus({ preventScroll: true }));
  };
  if (start != null) boards(start); else packs();
  return card;
}

// ---------- the Daily ----------
// day: { key, label, t: [secs | null ×3], perfect: [bool ×3], streak }
export function dailyCard({ day, specs, onPlay, onClose }) {
  const card = el('div', 'ak-card sy-card sy-daily');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, svg('close', 'sy-ico'));
  close.addEventListener('click', () => onClose?.());
  const rows = el('div', 'sy-daily-rows');
  const next = day.t.findIndex((t) => t == null);
  DAILY.forEach((d, slot) => {
    const t = day.t[slot];
    const spec = specs[slot];
    const twist = spec.bridges ? ' · bridges' : spec.gates ? ' · gates' : spec.holes ? ' · holes' : '';
    const b = el('button', { class: `sy-day${t != null ? ' is-done' : ''}${slot === next ? ' is-next' : ''}`, type: 'button' },
      el('span', 'sy-day-dot', String(slot + 1)),
      el('span', 'sy-day-name', d.label, el('small', null, `${spec.n}×${spec.n}${twist}`)),
      el('span', 'sy-day-time', t != null ? fmtTime(t) : slot === next ? 'Play' : '—'),
      t != null ? svg(day.perfect[slot] ? 'star' : 'check', `sy-ico${day.perfect[slot] ? ' sy-star' : ''}`) : null);
    b.addEventListener('click', () => onPlay(slot));
    rows.append(b);
  });
  const all = day.t.every((t) => t != null);
  const total = all ? day.t.reduce((a, b) => a + b, 0) : null;
  card.append(close, el('p', 'ak-card-kicker', day.label), el('h2', 'ak-card-title', 'Daily'),
    el('p', 'sy-daily-sub', all ? `All three done in ${fmtTime(total)}. New boards tomorrow.` : 'Three new boards every day, the same for everyone.'),
    rows,
    el('p', 'sy-daily-streak', svg('sun', 'sy-ico'), day.streak > 0 ? `${day.streak} day${day.streak === 1 ? '' : 's'} in a row` : 'Finish all three to start a streak'));
  requestAnimationFrame(() => (rows.children[Math.max(0, next)] || rows.firstChild)?.focus({ preventScroll: true }));
  return card;
}

// a pack finished: a short card
export function packDoneCard({ pack, perfect, total, nextPack, onNext, onClose }) {
  const card = el('div', 'ak-card sy-card sy-packdone');
  const go = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, nextPack ? `Open ${nextPack.name}` : 'All packs');
  go.addEventListener('click', () => onNext?.());
  const menu = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost', type: 'button' }, 'Menu');
  menu.addEventListener('click', () => onClose?.());
  card.append(el('p', 'ak-card-kicker', 'Pack complete'), el('h2', 'ak-card-title', pack.name),
    el('p', 'sy-daily-sub', `${total} boards wired. ${perfect} of them perfect.`),
    el('div', 'ak-card-actions', go, menu));
  return card;
}

export const swatch = (c) => COLORS[c % COLORS.length].hex;
