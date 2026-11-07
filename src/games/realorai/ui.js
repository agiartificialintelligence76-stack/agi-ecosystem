// REAL OR AI? (2026-11-08): the game's own buttons and words (real DOM, so they're crisp, wrap, and read out loud):
// the dock under (or beside) the photo with the AI and REAL buttons and the clock, the reveal panel (the verdict, both
// guesses, the clues, AGI-1's note, the photo's credit), the title's logo and "your eye", the day's recap strip and a
// viewer for one photo's reveal. Built with createElement / createElementNS and textContent only (the site's CSP).
import { TOPIC_WORDS, accuracy, sharpestTopic, multBand, CLOCK } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';
const FACE = '/images/landing/agi1-face.webp';

function h(tag, cls, ...kids) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}
function svg(viewBox, parts, cls = '') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (cls) s.setAttribute('class', cls);
  for (const [tag, attrs] of parts) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    s.append(n);
  }
  return s;
}
const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
export const ICON = {
  camera: () => svg('0 0 24 24', [
    ['path', { ...stroke, d: 'M4.2 8.4h2.9l1.7-2.6h6.4l1.7 2.6h2.9a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H4.2A1.6 1.6 0 0 1 2.6 18v-8a1.6 1.6 0 0 1 1.6-1.6z' }],
    ['circle', { ...stroke, cx: 12, cy: 13.4, r: 3.5 }],
    ['circle', { fill: 'currentColor', cx: 18.4, cy: 10.9, r: 1 }],
  ]),
  chip: () => svg('0 0 24 24', [
    ['rect', { ...stroke, x: 6.2, y: 6.2, width: 11.6, height: 11.6, rx: 2.2 }],
    ['rect', { fill: 'currentColor', x: 9.6, y: 9.6, width: 4.8, height: 4.8, rx: 0.8 }],
    ['path', { ...stroke, 'stroke-width': 1.9, d: 'M9.4 6.2V3.6M12 6.2V3.6M14.6 6.2V3.6M9.4 20.4v-2.6M12 20.4v-2.6M14.6 20.4v-2.6M6.2 9.4H3.6M6.2 12H3.6M6.2 14.6H3.6M20.4 9.4h-2.6M20.4 12h-2.6M20.4 14.6h-2.6' }],
  ]),
  flame: () => svg('0 0 24 24', [
    ['path', { fill: '#ff4da6', stroke: '#170a36', 'stroke-width': 1.8, 'stroke-linejoin': 'round', d: 'M12.2 2.2c.5 3.3 5.6 5.3 5.6 10.9a5.8 5.8 0 0 1-11.6 0c0-2.6 1.2-4.4 2.6-5.6.2 1.9 1.1 3 2.2 3.4.1-3.8-.5-6.1 1.2-8.7z' }],
    ['path', { fill: '#ffc933', d: 'M12.3 11.3c.4 1.9 3 2.8 3 5.5a3.2 3.2 0 0 1-6.4 0c0-1.4.7-2.4 1.5-3 .1.9.6 1.6 1.2 1.8.1-1.8-.1-3 .7-4.3z' }],
  ], 'rai-flame'),
  heart: (cls = '') => svg('0 0 24 24', [
    ['path', { class: 'rai-heart-fill', 'stroke-linejoin': 'round', d: 'M12 20.6s-7.9-4.8-7.9-10.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.9 2.4c0 5.8-7.9 10.6-7.9 10.6z' }],
    ['path', { class: 'rai-heart-crack', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 7.8l-1.6 3.6 2.6 1.8-1.9 3.4' }],
  ], `rai-heart ${cls}`),
  check: () => svg('0 0 24 24', [['path', { ...stroke, 'stroke-width': 3.2, d: 'M5 12.6l4.3 4.3L19.2 7' }]]),
  cross: () => svg('0 0 24 24', [['path', { ...stroke, 'stroke-width': 3.2, d: 'M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4' }]]),
  clock: () => svg('0 0 24 24', [['circle', { ...stroke, cx: 12, cy: 13, r: 7.6 }], ['path', { ...stroke, d: 'M12 9v4.2l2.6 1.6M9.5 2.8h5' }]]),
  next: () => svg('0 0 24 24', [['path', { ...stroke, 'stroke-width': 2.8, d: 'M5 12h13.2M13 6.2l5.8 5.8-5.8 5.8' }]]),
  close: () => svg('0 0 24 24', [['path', { ...stroke, 'stroke-width': 2.6, d: 'M6 6l12 12M18 6L6 18' }]]),
  eye: () => svg('0 0 24 24', [['path', { ...stroke, d: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' }], ['circle', { ...stroke, cx: 12, cy: 12, r: 3 }]]),
};
const face = (cls = 'rai-face') => {
  const img = document.createElement('img');
  img.className = cls;
  img.src = FACE;
  img.alt = '';
  img.width = 40; img.height = 40;
  img.decoding = 'async';
  return img;
};
const word = (g) => (g === 'ai' ? 'AI' : 'REAL');

// ---------- the dock: the buttons and the clock (asking), then the reveal ----------
export function createDock({ onChoice, onNext, onWhy, touch }) {
  // the status row: the streak's flame meter (Streak) or the day's ten pips (Daily), and the score against AGI-1
  const flame = ICON.flame();
  const mult = h('b', 'rai-mult', '×1');
  const ticks = h('span', 'rai-ticks');
  const meter = h('div', 'rai-meter', flame, mult, ticks);
  meter.setAttribute('aria-label', 'Streak multiplier');
  const pips = h('div', 'rai-pips');
  const youN = h('b', null, '0'), herN = h('b', null, '0');
  const tally = h('div', 'rai-tally', h('span', 'rai-tally-you', 'You', youN), h('span', 'rai-tally-vs', 'vs'), h('span', 'rai-tally-her', face('rai-face rai-face-sm'), 'AGI-1', herN));
  const score = h('div', 'rai-dscore', h('span', null, 'Score'), h('b', null, '0'));
  const status = h('div', 'rai-status', meter, pips, score, tally);

  // the two answers and the clock between them
  const btnAI = h('button', 'rai-choice is-ai', ICON.chip(), h('span', 'rai-choice-word', 'AI'), h('small', 'rai-choice-key', touch ? '‹ swipe' : '← A'));
  btnAI.type = 'button';
  btnAI.setAttribute('aria-label', 'AI-made picture');
  const btnReal = h('button', 'rai-choice is-real', ICON.camera(), h('span', 'rai-choice-word', 'REAL'), h('small', 'rai-choice-key', touch ? 'swipe ›' : 'D →'));
  btnReal.type = 'button';
  btnReal.setAttribute('aria-label', 'Real photo');
  const ring = svg('0 0 64 64', [
    ['circle', { class: 'rai-clock-track', cx: 32, cy: 32, r: 27, fill: 'none', 'stroke-width': 7 }],
    ['circle', { class: 'rai-clock-arc', cx: 32, cy: 32, r: 27, fill: 'none', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '169.65 169.65', transform: 'rotate(-90 32 32)' }],
  ]);
  const arc = ring.lastChild;
  const clockNum = h('b', null, '10'), clockLabel = h('small', null, 'sec');
  const clock = h('div', 'rai-clock', ring, clockNum, clockLabel);
  clock.setAttribute('role', 'timer');
  const choices = h('div', 'rai-choices', btnAI, clock, btnReal);
  const hint = h('p', 'rai-hint');
  // (wide screens: the question over the buttons)
  const qKicker = h('p', 'rai-q-kicker', '');
  const question = h('div', 'rai-q', qKicker, h('p', 'rai-q-text', 'Real photo, or made by AI?'));
  const ask = h('div', 'rai-ask', question, status, choices, hint);
  btnAI.addEventListener('click', () => onChoice('ai', btnAI));
  btnReal.addEventListener('click', () => onChoice('real', btnReal));

  // the reveal
  const vIcon = h('span', 'rai-v-icon');
  const vText = h('b', 'rai-v-text');
  const verdict = h('div', 'rai-verdict', vIcon, vText);
  const ptsN = h('b', null, '');
  const ptsX = h('span', 'rai-x', '');
  const pts = h('div', 'rai-pts', ptsN, ptsX);
  const truth = h('p', 'rai-truth');
  const youG = h('span', 'rai-g');
  const herG = h('span', 'rai-g is-her');
  const guesses = h('div', 'rai-guesses', youG, herG);
  const sayP = h('p', null);
  const say = h('div', 'rai-say', face(), sayP);
  const cluesHead = h('p', 'rai-kicker');
  const clues = h('ol', 'rai-clues');
  const credit = h('p', 'rai-credit');
  const more = h('div', 'rai-more', cluesHead, clues);
  const why = h('button', 'rai-why', 'Why?');
  why.type = 'button';
  const fill = h('i', 'rai-fill');
  const nextLabel = h('span', null, 'Next');
  const next = h('button', 'rai-next', fill, nextLabel, ICON.next());
  next.type = 'button';
  const actions = h('div', 'rai-actions', why, next);
  const revealInner = h('div', 'rai-reveal-in', h('div', 'rai-v-top', verdict, pts), truth, guesses, say, more, credit, actions);
  const reveal = h('section', 'rai-reveal', revealInner);
  reveal.setAttribute('aria-live', 'polite');
  reveal.setAttribute('aria-label', 'The answer');
  why.addEventListener('click', () => onWhy());
  next.addEventListener('click', () => onNext());

  const dock = h('div', 'rai-dock', ask, reveal);
  dock.hidden = true;

  let lastSec = -1, lastMult = -1, lastTicks = '';
  const api = {
    node: dock, ask, reveal, revealInner, btnAI, btnReal, next, why, clock,
    mode(m) {
      dock.dataset.mode = m;
      clockLabel.textContent = m === 'daily' ? 'bonus' : 'sec';
      meter.hidden = m !== 'streak';
      pips.hidden = m !== 'daily';
    },
    show(which) {
      dock.hidden = false;
      dock.dataset.show = which;
      const on = which === 'ask';
      btnAI.disabled = !on; btnReal.disabled = !on;
      ask.inert = !on;
      reveal.inert = on;
    },
    hide() { dock.hidden = true; },
    // the clock: `left` 0..1 of the photo's time, its number, urgent in the last seconds
    clock(left, num, urgent) {
      arc.setAttribute('stroke-dashoffset', String(169.65 * (1 - Math.max(0, Math.min(1, left)))));
      if (num !== lastSec) { lastSec = num; clockNum.textContent = String(num); }
      clock.classList.toggle('is-urgent', Boolean(urgent));
    },
    meter(streak, { up = false } = {}) {
      const b = multBand(streak);
      if (b.mult !== lastMult) { lastMult = b.mult; mult.textContent = `×${b.mult}`; meter.style.setProperty('--rai-heat', String(b.mult)); }
      const total = b.to == null ? 0 : b.to - b.from, done = streak - b.from;
      const key = `${total}:${done}`;
      if (key !== lastTicks) {
        lastTicks = key;
        ticks.replaceChildren(...(total ? Array.from({ length: total }, (_, i) => h('i', i < done ? 'is-on' : null)) : [h('em', null, 'max')]));
      }
      meter.classList.toggle('is-hot', b.mult > 1);
      if (up) { meter.classList.remove('is-up'); void meter.offsetWidth; meter.classList.add('is-up'); }
    },
    pips(answers, i, n) {
      pips.replaceChildren(...Array.from({ length: n }, (_, k) => {
        const a = answers[k];
        const p = h('i', a ? (a.correct ? 'is-ok' : 'is-bad') : k === i ? 'is-now' : null);
        return p;
      }));
      pips.setAttribute('aria-label', `Photo ${Math.min(i + 1, n)} of ${n}`);
    },
    tally(you, her) { youN.textContent = String(you); herN.textContent = String(her); },
    score(v) { score.lastChild.textContent = v.toLocaleString('en-US'); },
    hint(text) { hint.textContent = text || ''; hint.hidden = !text; },
    question(kicker) { qKicker.textContent = kicker; },
    // the reveal: res (rules.answer's result), line (AGI-1's words), { expanded, auto, last, mode }
    fill(res, { line, expanded, auto, last, mode }) {
      reveal.classList.toggle('is-ok', res.correct);
      reveal.classList.toggle('is-bad', !res.correct);
      vIcon.replaceChildren(res.correct ? ICON.check() : res.timeout ? ICON.clock() : ICON.cross());
      vText.textContent = res.correct ? (res.t < 2.5 ? 'Sharp!' : 'Right!') : res.timeout ? 'Time’s up' : 'Fooled!';
      if (res.correct) {
        ptsN.textContent = `+${res.pts.toLocaleString('en-US')}`;
        ptsX.textContent = res.mult > 1 ? `×${res.mult}` : '';
        ptsX.hidden = res.mult <= 1;
        pts.classList.remove('is-loss');
        pts.replaceChildren(ptsN, ptsX);
      } else if (mode === 'streak') {
        ptsN.textContent = '−1';
        ptsX.hidden = true;
        pts.classList.add('is-loss');
        pts.replaceChildren(ptsN, ICON.heart('is-lost'));
      } else {
        ptsN.textContent = '+0';
        ptsX.hidden = true;
        pts.classList.remove('is-loss');
        pts.replaceChildren(ptsN);
      }
      truth.replaceChildren(res.pic.ai ? 'It’s ' : 'It’s a ', h('b', res.pic.ai ? 'is-ai' : 'is-real', res.pic.ai ? 'AI-made' : 'real photo'), '.');
      const g = (who, guess, right, her) => [her ? face('rai-face rai-face-sm') : null, h('span', 'rai-g-who', who), h('b', guess === 'ai' ? 'is-ai' : guess === 'real' ? 'is-real' : null, guess ? word(guess) : '—'), h('span', `rai-g-mark ${right ? 'is-ok' : 'is-bad'}`, right ? ICON.check() : ICON.cross())].filter(Boolean);
      youG.replaceChildren(...g('You', res.guess, res.correct, false));
      herG.replaceChildren(...g('AGI-1', res.her.guess, res.her.right, true));
      herG.classList.remove('is-in'); void herG.offsetWidth; herG.classList.add('is-in');
      sayP.textContent = line || '';
      say.hidden = !line;
      const list = res.pic.clues || [];
      cluesHead.textContent = res.pic.ai ? 'What gives it away' : 'Why it’s real';
      clues.replaceChildren(...list.map((c, i) => h('li', null, h('i', 'rai-pin', String(i + 1)), h('span', null, c.text))));
      cluesHead.hidden = !list.length;
      clues.hidden = !list.length;
      credit.textContent = res.pic.credit || '';
      credit.hidden = !res.pic.credit;
      more.hidden = !expanded || !list.length;
      why.hidden = !auto || !list.length;
      nextLabel.textContent = last ? 'See results' : 'Next';
      next.classList.toggle('is-auto', Boolean(auto));
      next.classList.toggle('is-primary', !auto);
      api.autoFill(0);
      revealInner.scrollTop = 0;
    },
    expand() { more.hidden = !clues.childElementCount; why.hidden = true; next.classList.remove('is-auto'); next.classList.add('is-primary'); api.autoFill(0); },
    autoFill(k) { fill.style.transform = `scaleX(${Math.max(0, Math.min(1, k))})`; },
    // where the dock sits (CSS pixels), and how it lays itself out ('tall': under the photo, 'wide': beside it)
    place(rect, shape) {
      dock.dataset.shape = shape;
      dock.style.left = `${Math.round(rect.x)}px`;
      dock.style.top = `${Math.round(rect.y)}px`;
      dock.style.width = `${Math.round(rect.w)}px`;
      dock.style.height = `${Math.round(rect.h)}px`;
    },
    askHeight() { return ask.offsetHeight; },
    revealHeight() { return revealInner.scrollHeight; },
  };
  return api;
}

// ---------- the title ----------
// its wordmark: REAL in mint, a small "or", AI? in pink, with the fan of prints above it (a canvas the game draws)
export function titleLogo() {
  const fan = document.createElement('canvas');
  fan.className = 'rai-fan';
  fan.setAttribute('aria-hidden', 'true');
  const logo = h('h1', 'ak-logo rai-logo',
    h('span', 'ak-logo-line is-mint rai-logo-real', 'REAL'),
    h('span', 'ak-logo-line rai-logo-2', h('span', 'rai-logo-or', 'or'), h('span', 'rai-logo-ai', 'AI?')));
  logo.setAttribute('aria-label', 'REAL OR AI?');
  return { node: h('div', 'rai-title-top', fan, logo), fan };
}

// "your eye": accuracy, best streak, photos seen, the sharpest topic
export function eyePanel(stats, { dailyDays = 0 } = {}) {
  const acc = accuracy(stats);
  const best = sharpestTopic(stats);
  const cell = (num, label) => h('div', 'rai-eye-cell', h('b', null, num), h('span', null, label));
  const head = h('p', 'rai-eye-head', ICON.eye(), 'Your eye');
  if (!stats.seen) {
    return h('div', 'rai-eye is-new', head, h('p', 'rai-eye-line', 'Untested. Ten new photos every day, and a streak to chase.'));
  }
  const kids = [head, h('div', 'rai-eye-row', cell(`${acc}%`, 'right'), cell(String(stats.bestStreak), 'best streak'), cell(stats.seen.toLocaleString('en-US'), 'photos seen'))];
  if (best) kids.push(h('p', 'rai-eye-line', `Your eye for ${best.word}: `, h('b', null, `${best.pct}%`)));
  else if (dailyDays > 1) kids.push(h('p', 'rai-eye-line', 'Daily streak: ', h('b', null, `${dailyDays} days`)));
  return h('div', 'rai-eye', ...kids);
}

// ---------- the end of a daily: its ten photos, each with ✓ / ✗ (tap one to see its reveal again) ----------
export function recapStrip(answers, onOpen) {
  const list = h('ol', 'rai-recap');
  answers.forEach((a, i) => {
    const img = document.createElement('img');
    img.src = a.pic.file;
    img.alt = '';
    img.width = 64; img.height = 64;
    img.loading = 'lazy';
    img.decoding = 'async';
    const b = h('button', `rai-recap-b ${a.correct ? 'is-ok' : 'is-bad'}`, img, h('span', 'rai-recap-mark', a.correct ? ICON.check() : ICON.cross()));
    b.type = 'button';
    b.setAttribute('aria-label', `Photo ${i + 1}: ${a.pic.ai ? 'AI-made' : 'real'}, you were ${a.correct ? 'right' : 'wrong'}. See why.`);
    b.addEventListener('click', () => onOpen(a, i));
    list.append(h('li', null, b));
  });
  return h('div', 'rai-recap-wrap', h('p', 'rai-recap-head', 'Today’s ten · tap one to see why'), list);
}

// one photo's reveal again, over everything: the photo with its clues circled, its words, AGI-1's note, its credit
export function openViewer(res, { line, onClose }) {
  const img = document.createElement('img');
  img.src = res.pic.file;
  img.alt = res.pic.title || '';
  img.decoding = 'async';
  const marks = svg('0 0 100 100', []);
  marks.setAttribute('class', 'rai-v-marks');
  (res.pic.clues || []).forEach((c, i) => {
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', String(c.x * 100)); ring.setAttribute('cy', String(c.y * 100)); ring.setAttribute('r', String(Math.max(c.r * 100, 3)));
    ring.setAttribute('class', 'rai-v-ring');
    marks.append(ring);
    const a = -0.85;
    const px = Math.min(95, Math.max(5, c.x * 100 + Math.cos(a) * c.r * 100)), py = Math.min(95, Math.max(5, c.y * 100 + Math.sin(a) * c.r * 100));
    const pin = document.createElementNS(NS, 'circle');
    pin.setAttribute('cx', String(px)); pin.setAttribute('cy', String(py)); pin.setAttribute('r', '4.2');
    pin.setAttribute('class', 'rai-v-pin');
    const num = document.createElementNS(NS, 'text');
    num.setAttribute('x', String(px)); num.setAttribute('y', String(py + 1.9));
    num.setAttribute('class', 'rai-v-num');
    num.textContent = String(i + 1);
    marks.append(pin, num);
  });
  const close = h('button', 'ak-ibtn rai-v-close', ICON.close());
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  const photo = h('div', 'rai-v-photo', img, marks, h('span', `rai-v-stamp ${res.pic.ai ? 'is-ai' : 'is-real'}`, res.pic.ai ? 'AI' : 'REAL'));
  const list = h('ol', 'rai-clues', ...(res.pic.clues || []).map((c, i) => h('li', null, h('i', 'rai-pin', String(i + 1)), h('span', null, c.text))));
  const card = h('div', 'rai-v-card',
    close,
    photo,
    h('p', 'rai-v-title', res.pic.title || ''),
    h('p', 'rai-truth', 'It’s ', h('b', res.pic.ai ? 'is-ai' : 'is-real', res.pic.ai ? 'AI-made' : 'a real photo'), ' · you said ', h('b', null, res.guess ? word(res.guess) : 'nothing'), ' ', h('span', `rai-g-mark ${res.correct ? 'is-ok' : 'is-bad'}`, res.correct ? ICON.check() : ICON.cross())),
    list.childElementCount ? list : null,
    line ? h('div', 'rai-say', face(), h('p', null, line)) : null,
    res.pic.credit ? h('p', 'rai-credit', res.pic.credit) : null);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', `${res.pic.title || 'Photo'}: why`);
  const wrap = h('div', 'rai-viewer', card);
  const done = () => {
    removeEventListener('keydown', key, true);
    wrap.remove();
    onClose?.();
  };
  const key = (e) => {
    if (['Escape', 'Enter', ' ', 'r', 'R'].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') done();
    }
  };
  addEventListener('keydown', key, true);
  close.addEventListener('click', done);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) done(); });
  requestAnimationFrame(() => close.focus({ preventScroll: true }));
  return { node: wrap, close: done };
}

export const topicWord = (t) => TOPIC_WORDS[t] || t;
export const CLOCK_SECONDS = CLOCK;
