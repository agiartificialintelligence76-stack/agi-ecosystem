// OVERTHINKING: its page furniture (everything that isn't the canvas), made with DOM methods and the arcade kit's
// sticker classes: AGI-1's panel under her thoughts (her face, "thinking…", her context meter, her train of thought,
// what she says), the night's banner, the tips a new player gets, and the cards (the week, her journal, the stickers
// and ribbons, a run's stars). Styles are in style.css (`ot-` classes); nothing is set with a style attribute.
import { el, icon } from '../kit/shell.js';
import { fmt } from '../kit/fx.js';
import { portrait } from './art.js';
import { KINDS, SPECIALS } from './kinds.js';
import { NIGHTS, MAX_STARS } from './nights.js';
import { JOURNAL, JOURNAL_PAGES, JOURNAL_SIZE, lineId } from './lines.js';
import { STICKERS, RIBBONS, totalStars, nightOpen, ribbonOpen } from './progress.js';

const FACE = '/images/agi1-portrait-2d.webp';
const labelOf = (kind) => (KINDS[kind] || SPECIALS[kind])?.label || kind;

// ---------- her panel ----------
export function createPanel(stage) {
  const sayText = el('p');
  const say = el('div', { class: 'ot-say', hidden: true }, el('span', 'ak-sr', 'AGI-1: '), sayText);
  const ava = el('div', 'ot-ava', el('img', { src: FACE, alt: '', width: 64, height: 64, draggable: 'false' }));
  const status = el('span', 'ot-status', 'thinking…');
  const trainNum = el('b', null, 'x1');
  const trainBar = el('i');
  const train = el('span', { class: 'ot-train', hidden: true }, el('small', null, 'Train'), trainNum, trainBar);
  const effect = el('span', { class: 'ot-effect', hidden: true });
  const fill = el('i', 'ot-meter-fill');
  const num = el('span', 'ot-meter-num', '0/40');
  const bar = el('div', { class: 'ot-meter-bar', role: 'meter', 'aria-label': 'Her context', 'aria-valuemin': 0, 'aria-valuemax': 40, 'aria-valuenow': 0 }, fill);
  const meter = el('div', 'ot-meter', el('span', 'ot-meter-label', 'Context'), bar, num);
  // the arcade's preview has no top bar: its numbers sit here
  const demoScore = el('b', null, '0'), demoClock = el('span', null, '12:00 AM');
  const demoHud = el('div', { class: 'ot-demo-hud', 'aria-hidden': 'true' }, demoScore, demoClock);
  const node = el('div', 'ot-her', say, ava,
    el('div', 'ot-her-main', el('div', 'ot-her-row', el('span', 'ot-name', 'AGI-1'), status, effect, train), meter), demoHud);
  stage.append(node);

  let sayTimer = 0, lastFill = -1, lastTrain = -1, lastStatus = '', lastEffect = '', lastNum = '';
  return {
    node,
    // where her head is on the page (the game sends new thoughts up from there)
    head() {
      const a = ava.getBoundingClientRect(), s = stage.getBoundingClientRect();
      return { x: a.left - s.left + a.width / 2, y: a.top - s.top + a.height / 2, r: a.width / 2 };
    },
    top() { return node.getBoundingClientRect().top - stage.getBoundingClientRect().top; },
    say(text, ms = 2800) {
      if (!text) return;
      sayText.textContent = text;
      say.hidden = false;
      say.classList.remove('is-in'); void say.offsetWidth; say.classList.add('is-in');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { say.hidden = true; }, ms);
    },
    hush() { clearTimeout(sayTimer); say.hidden = true; },
    // { count, cap, full, danger (0..1), train (×n), trainK (0..1 of its time left), status, effect, zen }
    set(o) {
      const k = Math.min(1, o.count / o.cap);
      if (Math.abs(k - lastFill) > 0.004) {
        lastFill = k;
        fill.style.width = `${(k * 100).toFixed(1)}%`;
        meter.dataset.level = k >= 1 ? 'full' : k >= 0.8 ? 'high' : k >= 0.55 ? 'mid' : 'low';
        bar.setAttribute('aria-valuenow', String(o.count));
      }
      const n = `${o.count}/${o.cap}`;
      if (n !== lastNum) { lastNum = n; num.textContent = n; }
      node.classList.toggle('is-full', Boolean(o.full));
      node.classList.toggle('is-zen', Boolean(o.zen));
      if (o.status !== lastStatus) { lastStatus = o.status; status.textContent = o.status; }
      if (o.train !== lastTrain) {
        lastTrain = o.train;
        train.hidden = o.train < 2;
        trainNum.textContent = `x${o.train}`;
        if (o.train >= 2) { train.classList.remove('is-pop'); void train.offsetWidth; train.classList.add('is-pop'); }
      }
      if (o.train >= 2) trainBar.style.width = `${Math.round(o.trainK * 100)}%`;
      if ((o.effect || '') !== lastEffect) { lastEffect = o.effect || ''; effect.hidden = !lastEffect; effect.textContent = lastEffect; }
    },
    demo(score, clock) { demoScore.textContent = fmt(score); demoClock.textContent = clock; },
  };
}

// ---------- the night's banner, and tips ----------
export function createBanner(stage) {
  const kicker = el('p', 'ot-banner-kicker'), title = el('h2', 'ot-banner-title'), blurb = el('p', 'ot-banner-blurb');
  const node = el('div', { class: 'ot-banner', hidden: true, role: 'status' }, kicker, title, blurb);
  stage.append(node);
  let timer = 0;
  return {
    show({ kicker: k, title: t, blurb: b }, ms = 2600) {
      kicker.textContent = k || ''; title.textContent = t || ''; blurb.textContent = b || '';
      node.hidden = false;
      node.classList.remove('is-in'); void node.offsetWidth; node.classList.add('is-in');
      clearTimeout(timer);
      timer = setTimeout(() => { node.hidden = true; }, ms);
    },
    hide() { clearTimeout(timer); node.hidden = true; },
  };
}

export function createTip(stage) {
  const text = el('span');
  const node = el('div', { class: 'ot-tip', hidden: true, role: 'status' }, el('b', null, 'Tip'), text);
  stage.append(node);
  let timer = 0;
  return {
    show(words, ms = 5200) {
      text.textContent = words;
      node.hidden = false;
      node.classList.remove('is-in'); void node.offsetWidth; node.classList.add('is-in');
      clearTimeout(timer);
      if (ms) timer = setTimeout(() => { node.hidden = true; }, ms);
    },
    hide() { clearTimeout(timer); node.hidden = true; },
    get open() { return !node.hidden; },
  };
}

// ---------- cards ----------
const starsRow = (n, big = false) => el('span', { class: `ot-stars${big ? ' is-big' : ''}`, role: 'img', 'aria-label': `${n} of 3 stars` },
  [0, 1, 2].map((i) => el('i', i < n ? 'is-on' : null, '★')));

function frame(kicker, title, onClose) {
  const card = el('div', 'ak-card ot-card');
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', onClose);
  card.append(close, el('p', 'ak-card-kicker', kicker), el('h2', 'ak-card-title', title));
  return card;
}

// the week: seven nights, each opening when the one before has seen its sunrise
export function weekCard({ save, onPick, onClose }) {
  const card = frame('Overthinking', 'The week', onClose);
  card.append(el('p', 'ot-card-sub', 'Seven nights. Keep her thoughts in order until sunrise. ', el('b', null, `★ ${totalStars(save)}/${MAX_STARS}`)));
  const list = el('ol', 'ot-nights');
  let first = true;
  for (const n of NIGHTS) {
    const kept = save.nights[n.id] || { stars: 0, best: 0 }, open = nightOpen(save, n.id);
    const b = el('button', { class: `ot-night${open ? '' : ' is-locked'}${kept.stars ? ' is-done' : ''}`, type: 'button', 'aria-disabled': open ? null : 'true',
      'data-ak-first': open && !kept.stars && first ? true : null },
      el('span', 'ot-night-day', n.day.slice(0, 3)),
      el('span', 'ot-night-main', el('b', null, n.title), el('small', null, open ? n.blurb : `See ${NIGHTS[n.id - 2].day}'s sunrise first.`)),
      el('span', 'ot-night-side', starsRow(kept.stars), kept.best ? el('small', null, fmt(kept.best)) : null));
    if (open && !kept.stars) first = false;
    b.addEventListener('click', () => { if (open) onPick(n.id); });
    list.append(el('li', null, b));
  }
  card.append(list, el('p', 'ak-fine', 'One star for the sunrise, two and three for the score.'));
  return card;
}

// her journal: every line she has written so far, a page per kind of thought
export function journalCard({ save, onClose }) {
  const have = new Set(save.journal);
  const card = frame('Overthinking', 'Her journal', onClose);
  card.classList.add('is-tall');
  card.append(el('p', 'ot-card-sub', 'What her thoughts turn into once you sort them. ', el('b', null, `${Math.min(have.size, JOURNAL_SIZE)}/${JOURNAL_SIZE}`)));
  for (const kind of JOURNAL_PAGES) {
    const page = JOURNAL[kind];
    const got = page.filter((_, i) => have.has(lineId(kind, i))).length;
    const list = el('ul', 'ot-lines', page.map((text, i) => (have.has(lineId(kind, i))
      ? el('li', null, text)
      : el('li', { class: 'is-blank', 'aria-label': 'Not written yet' }, '· · ·'))));
    card.append(el('section', 'ot-page', el('h3', null, portrait(kind, 30), labelOf(kind), el('small', null, `${got}/${page.length}`)), list));
  }
  const ok = el('button', { class: 'ak-btn ak-btn-sm', type: 'button', 'data-ak-first': true }, 'Back');
  ok.addEventListener('click', onClose);
  card.append(el('div', 'ak-card-actions', ok));
  return card;
}

// the stickers, and the ribbons they unlock
export function stickersCard({ save, onRibbon, onClose }) {
  const have = new Set(save.stickers);
  const card = frame('Overthinking', 'Stickers', onClose);
  card.classList.add('is-tall');
  card.append(el('p', 'ot-card-sub', 'Little wins. They unlock new ribbons. ', el('b', null, `${have.size}/${STICKERS.length}`)));
  card.append(el('ul', 'ot-stickers', STICKERS.map((s) => el('li', { class: have.has(s.id) ? 'is-on' : null },
    portrait(s.art, 44), el('b', null, s.name), el('small', null, s.how)))));
  const row = el('div', { class: 'ot-ribbons', role: 'radiogroup', 'aria-label': 'Your ribbon' });
  const draw = () => {
    row.replaceChildren(...RIBBONS.map((r) => {
      const open = ribbonOpen(save, r.id), on = save.ribbon === r.id;
      const sw = el('i', 'ot-ribbon-swatch');
      sw.style.background = `linear-gradient(90deg, ${r.colors.join(', ')})`;
      const b = el('button', { class: `ot-ribbon${on ? ' is-on' : ''}${open ? '' : ' is-locked'}`, type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-disabled': open ? null : 'true' },
        sw, el('b', null, r.name), el('small', null, open ? (on ? 'In use' : 'Use it') : `${r.need} stickers`));
      b.addEventListener('click', () => { if (open && !on) { onRibbon(r.id); save.ribbon = r.id; draw(); } });
      return b;
    }));
  };
  draw();
  card.append(el('h3', 'ot-sub-title', 'Your ribbon'), row);
  const ok = el('button', { class: 'ak-btn ak-btn-sm', type: 'button', 'data-ak-first': true }, 'Back');
  ok.addEventListener('click', onClose);
  card.append(el('div', 'ak-card-actions', ok));
  return card;
}

// under the title's buttons: her journal and the stickers
export function titleExtra({ save, onJournal, onStickers }) {
  const j = el('button', { class: 'ak-link ot-extra-link', type: 'button' }, `Journal ${Math.min(save.journal.length, JOURNAL_SIZE)}/${JOURNAL_SIZE}`);
  const s = el('button', { class: 'ak-link ot-extra-link', type: 'button' }, `Stickers ${save.stickers.length}/${STICKERS.length}`);
  j.addEventListener('click', onJournal);
  s.addEventListener('click', onStickers);
  return el('div', 'ot-extra', j, s);
}

// on the end card: a night's stars, and what the run unlocked
export function overExtra({ stars = null, newStickers = [], newLines = 0 }) {
  const kids = [];
  if (stars != null) kids.push(starsRow(stars, true));
  const row = [];
  if (newStickers.length > 2) {
    // a first good night earns a handful at once: one row of them, named for a screen reader
    const names = newStickers.map((s) => s.name).join(', ');
    row.push(el('p', { class: 'ot-new is-many', role: 'img', 'aria-label': `${newStickers.length} new stickers: ${names}`, title: names },
      el('span', 'ot-new-row', newStickers.slice(0, 6).map((s) => portrait(s.art, 26))),
      el('b', null, `${newStickers.length} new stickers`)));
  } else for (const s of newStickers) row.push(el('p', 'ot-new', portrait(s.art, 30), el('span', null, 'New sticker: ', el('b', null, s.name))));
  if (newLines > 0) row.push(el('p', 'ot-new is-plain', `+${newLines} in her journal`));
  if (row.length) kids.push(el('div', 'ot-new-list', row));
  return kids.length ? el('div', 'ot-over-extra', kids) : null;
}
