// PACKET LOSS: its own screens and pieces of DOM, in the arcade's sticker look (./style.css): AGI-1's comms panel (her
// face and her lines, below or beside the maze, or a small bubble when there's no room), the signal chip's bars, the
// DELIVERED card after a maze (her face, her line, the bonus counting up, what's next), and the title's row of maze
// stamps. DOM methods only (the CSP: no HTML from strings, no style attributes).
import { el } from '../kit/shell.js';

const PORTRAIT = '/images/agi1-portrait-2d.webp';
const SVG = 'http://www.w3.org/2000/svg';
function svg(viewBox, parts, cls = '') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (cls) s.setAttribute('class', cls);
  for (const [tag, attrs] of parts) {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    s.append(n);
  }
  return s;
}
// the letter as an icon: paper, ink, a pink heart seal
export function letterIcon(cls = 'pl-letter') {
  return svg('0 0 48 36', [
    ['rect', { x: 3, y: 3, width: 42, height: 30, rx: 5, fill: '#fffaf0', stroke: '#170a36', 'stroke-width': 3.2 }],
    ['path', { d: 'M6 7 L24 21 L42 7', fill: 'none', stroke: '#170a36', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }],
    ['path', { d: 'M24 27 C17 22 18 15.5 21.5 15.5 C23 15.5 24 17 24 17 C24 17 25 15.5 26.5 15.5 C30 15.5 31 22 24 27 Z', fill: '#ff4da6', stroke: '#170a36', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }],
  ], cls);
}

// ---------- the signal chip: three bars ----------
export function signalBars(chip) {
  const bars = [0, 1, 2].map((i) => el('i', `pl-bar b${i}`));
  const box = el('span', { class: 'pl-bars', role: 'img', 'aria-label': 'Signal: 3 of 3 bars' }, bars);
  const value = chip.node.querySelector('.ak-chip-value');
  value.replaceChildren(box);
  chip.node.classList.add('pl-chip-signal');
  let shown = -1;
  return {
    set(n, { pop = false } = {}) {
      if (n === shown && !pop) return;
      shown = n;
      bars.forEach((b, i) => b.classList.toggle('is-on', i < n));
      box.setAttribute('aria-label', `Signal: ${n} of 3 bars`);
      chip.node.classList.toggle('is-low', n <= 1);
      if (pop) { chip.node.classList.remove('is-pop', 'pl-hurt'); void chip.node.offsetWidth; chip.node.classList.add('is-pop'); }
    },
    hurt() { chip.node.classList.remove('pl-hurt'); void chip.node.offsetWidth; chip.node.classList.add('pl-hurt'); },
  };
}

// ---------- AGI-1's comms panel ----------
export function createComms(stage) {
  const img = el('img', { src: PORTRAIT, alt: '', width: 96, height: 96, decoding: 'async', draggable: 'false' });
  const face = el('div', 'pl-face', img, el('span', 'pl-live'));
  const name = el('p', 'pl-name', 'AGI-1', el('small', null, 'online'));
  const text = el('span', null, '');
  const bubble = el('p', 'pl-bubble', el('span', 'ak-sr', 'AGI-1: '), text);
  const node = el('aside', { class: 'pl-comms is-hidden', 'aria-live': 'polite' }, face, el('div', 'pl-comms-say', name, bubble));
  stage.append(node);
  let hideAt = 0, mode = 'hidden';
  return {
    node,
    // where it goes: 'below' / 'side' (a rect in CSS pixels) or 'mini' (a bubble at the top of the maze) or 'hidden'
    place(m, r) {
      mode = m;
      node.classList.toggle('is-hidden', m === 'hidden');
      node.classList.toggle('is-below', m === 'below');
      node.classList.toggle('is-side', m === 'side');
      node.classList.toggle('is-mini', m === 'mini');
      if (r) {
        node.style.left = `${Math.round(r.x)}px`; node.style.top = `${Math.round(r.y)}px`;
        node.style.width = `${Math.round(r.w)}px`;
        node.style.height = m === 'mini' ? '' : `${Math.round(r.h)}px`;
      }
      if (m === 'mini') node.classList.toggle('is-quiet', performance.now() > hideAt);
    },
    say(line, ms = 3200) {
      text.textContent = line;
      bubble.classList.remove('is-new'); void bubble.offsetWidth; bubble.classList.add('is-new');
      hideAt = performance.now() + ms;
      node.classList.remove('is-quiet');
    },
    // the mini bubble goes quiet a while after her last line
    tick() { if (mode === 'mini') node.classList.toggle('is-quiet', performance.now() > hideAt); },
    clear() { text.textContent = ''; hideAt = 0; },
    get mode() { return mode; },
  };
}

// ---------- DELIVERED ----------
// { n (maze number), name, tint, bonus: { delivery, signal, lossless, total }, signal, line, next (name), onNext }
export function deliveredCard({ n, name, bonus, signal, line, next, onNext }) {
  const rows = [
    ['Delivery', bonus.delivery],
    [`Signal × ${signal}`, bonus.signal],
    ['Lossless', bonus.lossless],
  ];
  const vals = rows.map(([, v]) => el('b', null, v ? '+0' : '—'));
  const total = el('b', 'pl-total-v', '+0');
  const btn = el('button', { class: 'ak-btn ak-btn-primary pl-next', type: 'button', 'data-ak-first': true, 'aria-label': `Next maze: ${next}` },
    el('span', 'pl-next-text', 'Next maze', el('small', null, next)),
    svg('0 0 24 24', [['path', { d: 'M9 5l7 7-7 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]]));
  btn.addEventListener('click', () => onNext());
  const card = el('section', { class: 'pl-card pl-deliver', role: 'dialog', 'aria-label': `Maze ${n} delivered` },
    el('p', 'pl-kicker', `Maze ${n} · ${name}`),
    el('h2', 'pl-title', letterIcon('pl-title-ico'), 'Delivered'),
    el('div', 'pl-say', el('img', { src: PORTRAIT, alt: '', width: 56, height: 56 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line)),
    el('dl', 'pl-rows', rows.map(([k, v], i) => el('div', `pl-row${v ? '' : ' is-zero'}`, el('dt', null, k), el('dd', null, vals[i])))),
    el('div', 'pl-total', el('span', null, 'Bonus'), total),
    btn,
  );
  // the numbers count up, one row after another
  const start = performance.now();
  let done = false;
  const fmt = (v) => `+${Math.round(v).toLocaleString('en-US')}`;
  const timeline = rows.map(([, v], i) => ({ v, from: 0.25 + i * 0.32, dur: 0.3 }));
  function update(onTick) {
    if (done) return;
    const t = (performance.now() - start) / 1000;
    let all = true;
    timeline.forEach((row, i) => {
      if (!row.v) return;
      const k = Math.min(1, Math.max(0, (t - row.from) / row.dur));
      if (k < 1) all = false;
      if (k > 0 && !row.started) { row.started = true; onTick?.(i); }
      vals[i].textContent = fmt(row.v * k);
    });
    const kt = Math.min(1, Math.max(0, (t - 1.2) / 0.35));
    total.textContent = fmt(bonus.total * kt);
    if (kt < 1) all = false;
    if (all) { done = true; card.classList.add('is-counted'); }
  }
  return { card, update, btn };
}

// ---------- the title: a stamp for each maze delivered ----------
export function mazeStamps(mazes, reached) {
  const row = el('div', { class: 'pl-stamps', role: 'img', 'aria-label': `${Math.min(reached, mazes.length)} of ${mazes.length} mazes delivered` },
    mazes.map((m, i) => {
      const s = el('span', `pl-stamp${i < reached ? ' is-on' : ''}`);
      s.style.setProperty('--tint', m.tint);
      return s;
    }));
  return el('div', 'pl-record', row, el('span', 'pl-record-text', reached ? `${Math.min(reached, mazes.length)}/${mazes.length} delivered` : 'Deliver all 8 mazes'));
}
