// HEARTBEAT (2026-11-08): the game's own screens, in the arcade's sticker look: the setlist (each song a concert ticket:
// its cover, its length and tempo, three seats for EASY / NORMAL / HARD with your best grade on each), the settings card
// (note speed, sync, tap sounds) and the sync helper (tap along to a metronome; it measures how late you hear and tap).
// Real buttons with labels; the keyboard works everywhere (↑ ↓ songs, ← → difficulty, Enter plays).
import { el, icon } from '../kit/shell.js';
import { TOUCH } from '../kit/env.js';
import { DIFFS, DIFF_NAMES, clock } from './chart.js';
import { SPEED, OFFSET, clampOffset, clampSpeed } from './rules.js';
import { eventPerf } from './clock.js';
import { COVER } from './music.js';

// its two icons, built with DOM methods (a gear for settings, a question mark for how to play)
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgIcon(paths, { circle = null } = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2.4');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (circle) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', circle[0]); c.setAttribute('cy', circle[1]); c.setAttribute('r', circle[2]);
    s.append(c);
  }
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}
const gearIcon = () => svgIcon(['M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5'], { circle: [12, 12, 3.2] });
const helpIcon = () => svgIcon(['M9.2 9.3a2.9 2.9 0 1 1 4 2.7c-.8.3-1.2 1-1.2 1.8v.6', 'M12 17.6v.1']);

export const recordKey = (id, diff) => `${id}:${diff}`;

// ---------- the setlist ----------

export function createSelect({ root, songs, levels, records, onSelect, onPlay, onSettings, onHelp }) {
  let current = { id: songs[0].id, diff: 'normal' };
  let loading = null;
  const node = el('section', { class: 'hb-select', 'aria-labelledby': 'hb-sel-title', hidden: true });
  const helpB = el('button', { class: 'ak-ibtn hb-round', type: 'button', 'aria-label': 'How to play' }, helpIcon());
  const gearB = el('button', { class: 'ak-ibtn hb-round', type: 'button', 'aria-label': 'Settings: note speed, sync, tap sounds' }, gearIcon());
  helpB.addEventListener('click', () => onHelp());
  gearB.addEventListener('click', () => onSettings());
  const head = el('header', 'hb-sel-head',
    el('div', 'hb-sel-words', el('p', 'hb-kicker', 'Tonight’s setlist'), el('h2', { class: 'hb-sel-title', id: 'hb-sel-title' }, 'Pick a song')),
    el('div', 'hb-sel-tools', helpB, gearB));
  const list = el('ol', { class: 'hb-list', 'aria-label': 'Her songs' });
  const cards = new Map();
  songs.forEach((s, i) => {
    const main = el('button', { class: 'hb-tk-main', type: 'button', 'aria-pressed': 'false', 'aria-label': `${s.title}, ${clock(s.duration)}, ${Math.round(s.bpm)} BPM` },
      el('span', 'hb-tk-cover', el('img', { src: COVER(s.id), alt: '', width: 160, height: 160, loading: i < 4 ? 'eager' : 'lazy', decoding: 'async' })),
      el('span', 'hb-tk-words',
        el('span', 'hb-tk-no', `No. ${String(i + 1).padStart(2, '0')}`),
        el('span', 'hb-tk-title', s.title),
        el('span', 'hb-tk-meta', el('span', null, 'AGI-1'), el('b', null, clock(s.duration)), el('b', null, `${Math.round(s.bpm)} BPM`))),
      el('span', { class: 'hb-tk-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i')),
      el('span', { class: 'hb-tk-stamp', 'aria-hidden': 'true' }, 'Now playing'));
    main.addEventListener('click', () => pick(s.id, current.id === s.id ? current.diff : current.diff));
    const seats = el('div', { class: 'hb-seats', role: 'group', 'aria-label': `${s.title}: difficulty` });
    const seatB = {};
    for (const d of DIFFS) {
      const grade = el('span', 'hb-seat-grade');
      const best = el('span', 'hb-seat-best', '—');
      const b = el('button', { class: `hb-seat is-${d}`, type: 'button', 'aria-pressed': 'false' },
        el('span', 'hb-seat-name', DIFF_NAMES[d]), el('span', 'hb-seat-lv', `Lv ${levels[s.id][d]}`), grade, best);
      b.addEventListener('click', () => {
        const again = current.id === s.id && current.diff === d && !loading;
        pick(s.id, d);
        if (again) onPlay();                     // a second tap on the chosen seat plays it
      });
      seats.append(b);
      seatB[d] = { b, grade, best };
    }
    const card = el('li', 'hb-tk', el('article', { class: 'hb-ticket', 'data-song': s.id }, main, el('div', { class: 'hb-perf', 'aria-hidden': 'true' }), seats));
    list.append(card);
    cards.set(s.id, { card, main, seatB });
  });
  // the dock: what's chosen, and PLAY
  const dockCover = el('img', { class: 'hb-dock-cover', src: COVER(songs[0].id), alt: '', width: 96, height: 96 });
  const dockTitle = el('p', 'hb-dock-title', '');
  const dockSub = el('p', 'hb-dock-sub', '');
  const playLabel = el('span', 'hb-go-label', 'Play');
  const playB = el('button', { class: 'ak-btn ak-btn-primary hb-go', type: 'button' }, icon('play'), playLabel);
  playB.addEventListener('click', () => onPlay());
  const dock = el('footer', 'hb-dock', el('div', 'hb-dock-info', dockCover, el('div', 'hb-dock-words', dockTitle, dockSub)), playB);
  node.append(el('div', 'hb-sel-scroll', head, list, el('p', 'hb-sel-fine', 'Play with your thumbs on the four lanes, or D F J K. Songs by AGI-1, made with AI.')), dock);
  root.append(node);

  function refresh() {
    for (const s of songs) {
      const c = cards.get(s.id);
      const on = s.id === current.id;
      c.card.classList.toggle('is-on', on);
      c.main.setAttribute('aria-pressed', String(on));
      for (const d of DIFFS) {
        const r = records[recordKey(s.id, d)];
        const { b, grade, best } = c.seatB[d];
        best.textContent = r ? r.score.toLocaleString('en-US') : 'not played';
        best.classList.toggle('is-new', !r);
        const sel = on && d === current.diff;
        b.setAttribute('aria-pressed', String(sel));
        b.classList.toggle('is-on', sel);
        grade.textContent = r ? r.grade : '—';
        grade.className = `hb-seat-grade${r ? ` is-${gradeClass(r.grade)}` : ''}${r?.fc ? ' is-fc' : ''}`;
        b.setAttribute('aria-label', `${s.title}, ${DIFF_NAMES[d]}, level ${levels[s.id][d]}${r ? `, best ${r.grade}, ${r.score.toLocaleString('en-US')}${r.ap ? ', all perfect' : r.fc ? ', full combo' : ''}` : ', not played yet'}`);
      }
    }
    const s = songs.find((x) => x.id === current.id);
    dockCover.src = COVER(s.id);
    dockTitle.textContent = s.title;
    const r = records[recordKey(s.id, current.diff)];
    dockSub.textContent = `${DIFF_NAMES[current.diff]} · Lv ${levels[s.id][current.diff]}${r ? ` · best ${r.grade} ${r.score.toLocaleString('en-US')}` : ''}`;
  }
  function pick(id, diff, { focus = false, scroll = true } = {}) {
    const changed = id !== current.id;
    current = { id, diff };
    refresh();
    if (scroll && changed) cards.get(id).card.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (focus) cards.get(id).seatB[diff].b.focus({ preventScroll: true });
    onSelect(current, changed);
  }
  function onKey(e) {
    if (node.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.ak-layer:not([hidden])')) return;
    const i = songs.findIndex((s) => s.id === current.id);
    const di = DIFFS.indexOf(current.diff);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + songs.length) % songs.length;
      pick(songs[n].id, current.diff, { focus: true });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = DIFFS[Math.max(0, Math.min(2, di + (e.key === 'ArrowRight' ? 1 : -1)))];
      pick(current.id, d, { focus: true });
    }
  }
  addEventListener('keydown', onKey);
  refresh();

  return {
    node,
    get current() { return current; },
    open(sel) {
      if (sel && cards.has(sel.id)) current = { id: sel.id, diff: DIFFS.includes(sel.diff) ? sel.diff : 'normal' };
      node.hidden = false;
      refresh();
      requestAnimationFrame(() => {
        cards.get(current.id).card.scrollIntoView({ block: 'center' });
        cards.get(current.id).seatB[current.diff].b.focus({ preventScroll: true });
      });
    },
    close() { node.hidden = true; },
    get open_() { return !node.hidden; },
    refresh,
    // the song's download: 0..1, or null when done (or stopped)
    loading(p) {
      loading = p;
      playB.classList.toggle('is-loading', p != null);
      playB.style.setProperty('--hb-p', String(p ?? 0));
      playLabel.textContent = p == null ? 'Play' : p >= 1 ? 'Ready…' : `Tuning up ${Math.round(p * 100)}%`;
      playB.setAttribute('aria-busy', String(p != null));
    },
    focusPlay() { playB.focus({ preventScroll: true }); },
  };
}

export const gradeClass = (g) => (g === 'S+' ? 'splus' : g.toLowerCase());

// ---------- settings ----------

export function settingsCard({ get, set, onSync, onClose }) {
  const s = get();
  const speedOut = el('output', 'hb-val', `×${s.speed.toFixed(1)}`);
  const speed = el('input', { type: 'range', min: SPEED.min, max: SPEED.max, step: SPEED.step, value: s.speed, 'aria-label': 'Note speed' });
  speed.addEventListener('input', () => { const v = clampSpeed(speed.value); speedOut.textContent = `×${v.toFixed(1)}`; set({ speed: v }); });
  const syncOut = el('output', 'hb-val', fmtMs(s.offset));
  const sync = el('input', { type: 'range', min: OFFSET.min, max: OFFSET.max, step: OFFSET.step, value: s.offset, 'aria-label': 'Sync offset in milliseconds' });
  const setSync = (v) => { const o = clampOffset(v); sync.value = String(o); syncOut.textContent = fmtMs(o); set({ offset: o }); };
  sync.addEventListener('input', () => setSync(sync.value));
  const nudge = (d) => { const b = el('button', { class: 'hb-nudge', type: 'button', 'aria-label': `${d > 0 ? 'Later' : 'Earlier'} by 5 ms` }, d > 0 ? '+5' : '−5'); b.addEventListener('click', () => setSync(get().offset + d)); return b; };
  const test = el('button', { class: 'ak-btn ak-btn-sm hb-sync-test', type: 'button' }, 'Tap-along test');
  test.addEventListener('click', () => onSync());
  const tapSw = el('button', { class: 'ak-switch', type: 'button', role: 'switch', 'aria-checked': String(s.taps) }, el('span', null, 'Tap sounds'), el('span', { class: 'ak-switch-ui', 'aria-hidden': 'true' }));
  tapSw.addEventListener('click', () => { const v = !get().taps; set({ taps: v }); tapSw.setAttribute('aria-checked', String(v)); });
  const done = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Done');
  done.addEventListener('click', () => onClose());
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => onClose());
  return el('div', 'ak-card hb-card',
    close,
    el('p', 'ak-card-kicker', 'HEARTBEAT'),
    el('h2', 'ak-card-title', 'Settings'),
    el('div', 'hb-field', el('div', 'hb-field-head', el('label', null, 'Note speed'), speedOut), speed,
      el('p', 'hb-hint', 'Faster notes spread out, so busy parts read easier.')),
    el('div', 'hb-field', el('div', 'hb-field-head', el('label', null, 'Sync'), syncOut),
      el('div', 'hb-sync-row', nudge(-5), sync, nudge(5)),
      el('p', 'hb-hint', 'If your taps land late, move it up (+); early, down (−). Wireless headphones usually need +.'), test),
    el('div', 'ak-switches', tapSw),
    el('p', 'hb-hint hb-keys', TOUCH ? 'Tap the lanes with your thumbs. On a keyboard: D F J K, ← ↓ ↑ → or 1 2 3 4.' : 'Keys: D F J K, ← ↓ ↑ → or 1 2 3 4. Or click the lanes.'),
    el('div', 'ak-card-actions', done));
}

export const fmtMs = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} ms`;

// ---------- the sync helper ----------

export const CAL = Object.freeze({ lead: 4, count: 16, gap: 0.6 });

// the taps' errors (s, + late) → the offset to use (ms), or null with too few taps
export function syncFrom(errors) {
  const e = errors.filter((x) => Number.isFinite(x) && Math.abs(x) < 0.3).sort((a, b) => a - b);
  if (e.length < 6) return null;
  const mid = e.length >> 1;
  const med = e.length % 2 ? e[mid] : (e[mid - 1] + e[mid]) / 2;
  return clampOffset(med * 1000);
}

export function syncCard({ music, current, onUse, onBack }) {
  let clicks = [], errors = [], raf = 0, running = false, endAt = 0;
  const heart = el('button', { class: 'hb-cal-heart', type: 'button', 'aria-label': 'Tap on each click' }, el('span', { 'aria-hidden': 'true' }));
  const dots = el('div', { class: 'hb-cal-dots', 'aria-hidden': 'true' }, Array.from({ length: CAL.count }, () => el('i')));
  const say = el('p', { class: 'hb-cal-say', role: 'status', 'aria-live': 'polite' }, `Now: ${fmtMs(current)}. Press Start, then tap the heart (or any lane key) on every click.`);
  const start = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Start');
  const use = el('button', { class: 'ak-btn', type: 'button', hidden: true }, 'Use it');
  const back = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost', type: 'button' }, 'Back');
  let found = null;
  const tap = (stamp) => {
    if (!running) return;
    const h = music.heard(eventPerf(stamp, performance.now()));
    let best = null;
    for (const c of clicks.slice(CAL.lead)) if (best == null || Math.abs(h - c) < Math.abs(h - best)) best = c;
    if (best == null) return;
    const d = h - best;
    if (Math.abs(d) > 0.3) return;
    const i = clicks.indexOf(best) - CAL.lead;
    if (errors[i] != null) return;
    errors[i] = d;
    const dot = dots.children[i];
    dot.className = Math.abs(d) <= 0.045 ? 'is-good' : d < 0 ? 'is-early' : 'is-late';
  };
  heart.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e.timeStamp); });
  const keyTap = (e) => {
    if (!running || e.repeat) return;
    if (['KeyD', 'KeyF', 'KeyJ', 'KeyK', 'Space', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Enter'].includes(e.code)) {
      e.preventDefault(); e.stopPropagation();
      tap(e.timeStamp);
    }
  };
  addEventListener('keydown', keyTap, true);
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!running) return;
    const h = music.heard(performance.now());
    let near = Infinity;
    for (const c of clicks) near = Math.min(near, Math.abs(h - c) + (h < c ? 0.2 : 0));
    heart.style.setProperty('--hb-pulse', String(Math.exp(-near * 14).toFixed(3)));
    if (h > endAt) finish();
  };
  function finish() {
    running = false;
    heart.style.setProperty('--hb-pulse', '0');
    const v = syncFrom(errors.filter((x) => x != null));
    found = v;
    start.textContent = 'Try again';
    if (v == null) { say.textContent = 'Too few taps to tell. Try again, tapping on every click.'; use.hidden = true; return; }
    const ms = Math.abs(v);
    say.textContent = ms <= 5 ? `You're right on time (${fmtMs(v)}).` : `You tap ${ms} ms ${v > 0 ? 'late' : 'early'}. Use ${fmtMs(v)}?`;
    use.textContent = `Use ${fmtMs(v)}`;
    use.hidden = false;
  }
  start.addEventListener('click', () => {
    if (!music.ensure()) { say.textContent = 'Sound isn’t available in this browser.'; return; }
    errors = [];
    for (const d of dots.children) d.className = '';
    use.hidden = true;
    const at = music.now() + 0.5;
    clicks = music.clicks(at, CAL.lead + CAL.count, CAL.gap, CAL.lead);
    endAt = clicks[clicks.length - 1] + 0.5;
    running = true;
    say.textContent = 'Listen… 4 to count you in, then tap.';
    heart.focus({ preventScroll: true });
  });
  use.addEventListener('click', () => { if (found != null) onUse(found); });
  back.addEventListener('click', () => onBack());
  raf = requestAnimationFrame(loop);
  const card = el('div', 'ak-card hb-card hb-cal',
    el('p', 'ak-card-kicker', 'Sync'),
    el('h2', 'ak-card-title', 'Tap along'),
    heart, dots, say,
    el('div', 'ak-card-actions', start, use, back));
  card.dispose = () => { running = false; cancelAnimationFrame(raf); removeEventListener('keydown', keyTap, true); };
  return card;
}
