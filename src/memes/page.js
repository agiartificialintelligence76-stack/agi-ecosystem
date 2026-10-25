// Memes (2026-10-23): memes.html. The tabs (All, Images, Videos, Slopcore; agi1.app/memes#images etc. opens one), the cards
// from src/memes/list.js, and the viewer: a <dialog> that plays the video with its controls or shows the whole picture,
// with Download, Copy link (agi1.app/memes?m=<id> opens that meme) and the previous and next ones (arrow keys, swipe).
// No inline code or styles anywhere (the site's CSP): everything is made here with the DOM. The look: src/styles/memes.css.
// Load more (the owner, 2026-10-23: "so they dont have to scroll down really long and add load more"): each group shows a
// few full rows (2 on All, 3 on its own tab; the row length is read from the grid, so no half-empty rows), and its
// "Load more" button shows 3 more rows. Switching tabs starts over.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import '../styles/memes.css';
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { TABS, mergeMemes, fileOf, thumbOf, downloadName, downloadUrl, clock } from './list.js';
import { getSiteContent } from '../owner/runtime.js';

const GROUPS = [
  { kind: 'slopcore', title: 'Slopcore', note: 'the long cuts. headphones on.', grid: 'mm-grid-slop', tag: 'Slopcore' },
  { kind: 'video', title: 'Videos', note: 'short, loud, made to repost.', grid: 'mm-grid-video', tag: '' },
  { kind: 'image', title: 'Images', note: 'save them. post them. tag @agi1dotapp.', grid: 'mm-grid-image', tag: '' },
];
const KIND_WORD = { slopcore: 'Slopcore', video: 'Video', image: 'Image' };
const HASH_OF = { all: 'all', image: 'images', video: 'videos', slopcore: 'slopcore' };
const TAB_OF = Object.fromEntries(Object.entries(HASH_OF).map(([k, v]) => [v, k]));

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.8v14.4c0 .8.9 1.3 1.6.8l11-7.2c.6-.4.6-1.2 0-1.6l-11-7.2C7.9 3.5 7 4 7 4.8Z"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5-7 7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.5 5 7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const el = (tag, cls, attrs = {}) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : String(v));
  return node;
};
const isVideo = (m) => m.kind !== 'image';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canPeek = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion() && !navigator.connection?.saveData;

let current = 'all';          // the open tab
let open = [];                // the memes the viewer steps through (the open tab's, in the page's order)
let at = -1;                  // which of them the viewer shows
let memes = mergeMemes(getSiteContent()?.memes);
let libraryKey = JSON.stringify(memes);
let linkedOpened = false;
const linkedId = new URLSearchParams(location.search).get('m');
let cardCleanups = [];
const rows = {};              // how many rows each group shows now
const FIRST_ROWS = { all: 2, tab: 3 };
const MORE_ROWS = 3;
// the viewer's parts (declared up here: start() below makes them, and a `let` further down isn't usable yet)
let dlg, stage, kindEl, titleEl, noteEl, countEl, dlBtn, prevBtn, nextBtn;

startTheme();
startMenu();
start();
addEventListener('agi-site-content', (event) => updateLibrary(event.detail?.document));

function start() {
  const root = document.querySelector('[data-mm-groups]');
  const tabs = document.querySelector('[data-mm-tabs]');
  if (!root || !tabs) return;
  counts();
  makeTabs(tabs);
  for (const g of GROUPS) root.append(makeGroup(g));
  viewer();
  pick(TAB_OF[location.hash.slice(1)] || 'all', false);
  addEventListener('hashchange', () => { const t = TAB_OF[location.hash.slice(1)]; if (t) pick(t, false); });
  // a wider or narrower window changes how many cards fit in a row
  let frame = 0;
  const relayout = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { for (const g of GROUPS) layout(g.kind); }); };
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(root); else addEventListener('resize', relayout);
  openLinked();
}

function openLinked() {
  if (linkedOpened || !linkedId) return;
  const meme = memes.find((m) => m.id === linkedId);
  if (meme) { linkedOpened = true; show(meme); }
}

function updateLibrary(document) {
  const next = mergeMemes(document?.memes);
  const key = JSON.stringify(next);
  if (key === libraryKey) return;
  libraryKey = key;
  const viewed = dlg?.open ? open[at] : null;
  const root = window.document.querySelector('[data-mm-groups]');
  if (!root) return;
  for (const stop of cardCleanups.splice(0)) stop();
  memes = next;
  root.replaceChildren(...GROUPS.map(makeGroup));
  for (const group of root.querySelectorAll('.mm-group')) group.hidden = current !== 'all' && group.dataset.group !== current;
  for (const group of GROUPS) layout(group.kind);
  counts();
  for (const tab of window.document.querySelectorAll('.mm-tab')) {
    const n = tab.dataset.tab === 'all' ? memes.length : memes.filter((m) => m.kind === tab.dataset.tab).length;
    tab.title = `${n} ${tab.textContent.toLowerCase()}`;
  }
  if (viewed) {
    const replacement = memes.find((m) => m.id === viewed.id);
    if (!replacement) dlg.close();
    else {
      setPlaylist(replacement);
      if (fileOf(viewed) !== fileOf(replacement) || isVideo(viewed) !== isVideo(replacement)) render();
      else renderInfo(); // A title/category change must not restart a video someone is watching.
    }
  }
  openLinked();
}

function counts() {
  const n = { all: memes.length, image: 0, video: 0, slopcore: 0 };
  for (const m of memes) n[m.kind] += 1;
  for (const node of document.querySelectorAll('[data-mm-count]')) node.textContent = String(n[node.dataset.mmCount] ?? '');
}

function makeTabs(list) {
  for (const t of TABS) {
    const n = t.key === 'all' ? memes.length : memes.filter((m) => m.kind === t.key).length;
    const b = el('button', 'mm-tab', { type: 'button', role: 'tab', id: `mm-tab-${t.key}`, 'data-tab': t.key, 'aria-selected': 'false', tabindex: '-1', title: `${n} ${t.label.toLowerCase()}` });
    b.textContent = t.label;
    b.addEventListener('click', () => pick(t.key, true));
    list.append(b);
  }
  // arrows move between the tabs (the usual tab list keys)
  list.addEventListener('keydown', (e) => {
    const keys = TABS.map((t) => t.key);
    const i = keys.indexOf(current);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const k = keys[(to + keys.length) % keys.length];
    pick(k, true);
    document.getElementById(`mm-tab-${k}`)?.focus();
  });
}

function pick(key, fromClick) {
  current = key;
  for (const b of document.querySelectorAll('.mm-tab')) {
    const on = b.dataset.tab === key;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  for (const g of document.querySelectorAll('.mm-group')) g.hidden = key !== 'all' && g.dataset.group !== key;
  for (const g of GROUPS) { rows[g.kind] = key === 'all' ? FIRST_ROWS.all : FIRST_ROWS.tab; layout(g.kind); }
  const panel = document.querySelector('[data-mm-groups]');
  panel?.setAttribute('aria-labelledby', `mm-tab-${key}`);
  if (fromClick) {
    history.replaceState(null, '', key === 'all' ? `${location.pathname}${location.search}` : `#${HASH_OF[key]}`);
    const bar = document.querySelector('.mm-bar');
    if (bar && bar.getBoundingClientRect().top <= 80) panel?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

function makeGroup(g) {
  const items = memes.filter((m) => m.kind === g.kind);
  const sec = el('section', `mm-group mm-group-${g.kind === 'slopcore' ? 'slop' : g.kind}`, { 'data-group': g.kind, 'aria-labelledby': `mm-h-${g.kind}` });
  const head = el('div', 'mm-group-head');
  const h = el('h2', 'mm-group-title', { id: `mm-h-${g.kind}` });
  h.append(g.title, ' ');
  const n = el('span', 'mm-group-n'); n.textContent = `(${String(items.length).padStart(2, '0')})`; h.append(n);
  const p = el('p', 'mm-group-note'); p.textContent = g.note;
  head.append(h, p);
  const grid = el('ul', `mm-grid ${g.grid}`, { role: 'list', id: `mm-grid-${g.kind}` });
  for (const m of items) grid.append(makeCard(m, g));
  if (!items.length) { const e = el('p', 'mm-empty'); e.textContent = 'Nothing here yet.'; sec.append(head, e); return sec; }
  const more = el('div', 'mm-more', { hidden: true });
  const btn = el('button', 'mm-more-btn', { type: 'button', 'aria-controls': grid.id });
  btn.addEventListener('click', () => {
    const first = [...grid.children].findIndex((c) => c.hidden);
    rows[g.kind] += MORE_ROWS;
    layout(g.kind);
    // keyboard users carry on from the first new card; the page doesn't jump
    grid.children[first]?.querySelector('.mm-open')?.focus({ preventScroll: true });
  });
  more.append(btn);
  sec.append(head, grid, more);
  return sec;
}

// show the group's first rows[kind] full rows and say how many are left
function layout(kind) {
  const sec = document.querySelector(`.mm-group[data-group="${kind}"]`);
  const grid = sec?.querySelector('.mm-grid');
  if (!grid || sec.hidden) return;   // a hidden grid has no row length; it's laid out when its tab opens
  const cards = [...grid.children];
  const limit = columns(grid) * (rows[kind] || FIRST_ROWS.all);
  cards.forEach((c, i) => { c.hidden = i >= limit; });
  const left = Math.max(0, cards.length - limit);
  const more = sec.querySelector('.mm-more');
  const btn = more?.querySelector('.mm-more-btn');
  if (!more || !btn) return;
  more.hidden = left === 0;
  btn.textContent = 'Load more ';
  const n = el('span', 'mm-more-n'); n.textContent = `${left} more`; btn.append(n);
  btn.setAttribute('aria-label', `Load more ${KIND_WORD[kind].toLowerCase()}s (${left} more)`);
}

function columns(grid) {
  const t = getComputedStyle(grid).gridTemplateColumns;
  const n = t && t !== 'none' && !t.includes('repeat') ? t.trim().split(/\s+/).length : 1;
  return Math.max(1, n);
}

function makeCard(m, g) {
  const li = el('li', 'mm-card', { 'data-id': m.id });
  const btn = el('button', 'mm-open', { type: 'button', 'aria-label': `${isVideo(m) ? 'Play' : 'Open'}: ${m.title}` });
  const thumb = thumbOf(m);
  if (thumb) {
    const img = el('img', 'mm-thumb', { src: thumb, alt: '', loading: 'lazy', decoding: 'async', width: 720, height: m.kind === 'image' ? 720 : 405 });
    btn.append(img);
  } else {
    // A confirmed video remains usable when the browser could not generate a cover frame.
    const fallback = el('video', 'mm-thumb', { src: fileOf(m), preload: 'metadata', muted: true, playsinline: true, 'aria-hidden': 'true' });
    fallback.muted = true; btn.append(fallback);
    cardCleanups.push(() => { fallback.pause(); fallback.removeAttribute('src'); fallback.load(); });
  }
  if (isVideo(m)) {
    const play = el('span', 'mm-play', { 'aria-hidden': 'true' }); play.innerHTML = ICON.play; btn.append(play);
    const t = el('span', 'mm-time'); t.textContent = m.loop ? 'LOOP' : m.secs > 0 ? clock(m.secs) : 'VIDEO'; btn.append(t);
    if (g.tag) { const tag = el('span', 'mm-tag'); tag.textContent = g.tag; btn.append(tag); }
    cardCleanups.push(peek(li, btn, m));
  }
  btn.addEventListener('click', () => show(m));
  const body = el('div', 'mm-body');
  const words = el('div', 'mm-words');
  const name = el('p', 'mm-name'); name.textContent = m.title; name.title = m.title;
  const note = el('p', 'mm-note'); note.textContent = m.note || '';
  words.append(name, note);
  const dl = el('a', 'mm-dl', { href: downloadUrl(m), download: downloadName(m), 'aria-label': `Download ${m.title}`, title: 'Download' });
  dl.innerHTML = ICON.down;
  body.append(words, dl);
  li.append(btn, body);
  return li;
}

// a muted preview while the mouse rests on a video card (computers only, never with "reduce motion" or data saver); the
// one-second loop just plays on its own
function peek(li, btn, m) {
  let timer = 0;
  let vid = null;
  let observer = null;
  const startPeek = () => {
    if (vid) return;
    vid = el('video', 'mm-peek', { muted: true, playsinline: true, loop: true, preload: 'auto', 'aria-hidden': 'true', tabindex: '-1' });
    vid.muted = true;
    vid.src = fileOf(m);
    btn.append(vid);
    vid.play().then(() => li.classList.add('is-peeking')).catch(() => {});
  };
  const stopPeek = (force = false) => {
    clearTimeout(timer);
    if (!vid || (m.loop && !force)) return;
    vid.pause(); vid.removeAttribute('src'); vid.load(); vid.remove(); vid = null;
    li.classList.remove('is-peeking');
  };
  if (m.loop) {
    if (reducedMotion()) return () => {};
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
      for (const e of es) { if (e.isIntersecting) { startPeek(); vid?.play().catch(() => {}); } else vid?.pause(); }
    }) : null;
    observer = io;
    if (io) io.observe(li); else startPeek();
    return () => { observer?.disconnect(); stopPeek(true); };
  }
  li.addEventListener('mouseenter', () => { if (canPeek()) timer = setTimeout(startPeek, 280); });
  li.addEventListener('mouseleave', () => stopPeek());
  return () => { observer?.disconnect(); stopPeek(true); };
}

// ---------- the viewer ----------

function viewer() {
  dlg = el('dialog', 'mm-viewer', { 'aria-labelledby': 'mm-v-title' });
  const wrap = el('div', 'mm-v-in');
  stage = el('div', 'mm-v-stage');
  prevBtn = el('button', 'mm-v-nav mm-v-prev', { type: 'button', 'aria-label': 'Previous' }); prevBtn.innerHTML = ICON.prev;
  nextBtn = el('button', 'mm-v-nav mm-v-next', { type: 'button', 'aria-label': 'Next' }); nextBtn.innerHTML = ICON.next;
  const close = el('button', 'mm-v-btn mm-v-round mm-v-close', { type: 'button', 'aria-label': 'Close' }); close.innerHTML = ICON.close;
  const bar = el('div', 'mm-v-bar');
  const words = el('div', 'mm-v-words');
  kindEl = el('p', 'mm-v-kind');
  titleEl = el('h2', 'mm-v-title', { id: 'mm-v-title' });
  noteEl = el('p', 'mm-v-note');
  words.append(kindEl, titleEl, noteEl);
  const acts = el('div', 'mm-v-acts');
  countEl = el('span', 'mm-v-count');
  const copy = el('button', 'mm-v-btn', { type: 'button', title: 'Copy link' }); copy.innerHTML = `${ICON.link}<span>Copy link</span>`;
  dlBtn = el('a', 'mm-v-btn mm-v-main', { title: 'Download' }); dlBtn.innerHTML = `${ICON.down}<span>Download</span>`;
  acts.append(countEl, copy, dlBtn);
  bar.append(words, acts);
  wrap.append(stage, bar);
  dlg.append(close, wrap);
  document.body.append(dlg);

  close.addEventListener('click', () => dlg.close());
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  copy.addEventListener('click', () => copyLink(open[at]));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // a click on the dark backdrop
  dlg.addEventListener('close', clear);
  dlg.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLVideoElement && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;   // the video seeks
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  let x0 = null;
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0]?.clientX ?? null; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0; x0 = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function show(m) {
  setPlaylist(m);
  render();
  if (!dlg.open) dlg.showModal();
}

function setPlaylist(m) {
  open = current === 'all' ? GROUPS.flatMap((g) => memes.filter((x) => x.kind === g.kind)) : memes.filter((x) => x.kind === current);
  if (!open.includes(m)) open = memes.filter((x) => x.kind === m.kind);
  at = open.indexOf(m);
}

function step(d) {
  if (open.length < 2) return;
  at = (at + d + open.length) % open.length;
  render();
}

function render() {
  const m = open[at];
  if (!m) return;
  clear();
  let media;
  if (isVideo(m)) {
    media = el('video', 'mm-v-media', { controls: true, autoplay: true, playsinline: true, preload: 'auto', poster: thumbOf(m), loop: m.loop || false });
    media.src = fileOf(m);
    if (m.loop) media.muted = true;
    media.play?.().catch(() => {});
  } else {
    media = el('img', 'mm-v-media', { src: fileOf(m), alt: `${m.title}${m.note ? `: ${m.note}` : ''}`, width: m.w, height: m.h, decoding: 'async' });
  }
  stage.append(prevBtn, media, nextBtn);
  renderInfo();
  // the next picture is fetched ahead, so stepping through pictures is instant
  const nx = open[(at + 1) % open.length];
  if (nx && !isVideo(nx)) { const pre = new Image(); pre.src = fileOf(nx); }
}

function renderInfo() {
  const m = open[at];
  if (!m) return;
  prevBtn.hidden = nextBtn.hidden = open.length < 2;
  kindEl.textContent = `${KIND_WORD[m.kind]}${isVideo(m) && !m.loop && m.secs > 0 ? ` · ${clock(m.secs)}` : ''}`;
  titleEl.textContent = m.title;
  noteEl.textContent = m.note || '';
  const picture = stage.querySelector('img.mm-v-media'); if (picture) picture.alt = `${m.title}${m.note ? `: ${m.note}` : ''}`;
  const video = stage.querySelector('video.mm-v-media'); if (video) { const poster = thumbOf(m); if (poster) video.setAttribute('poster', poster); else video.removeAttribute('poster'); }
  countEl.textContent = `${at + 1} / ${open.length}`;
  dlBtn.href = downloadUrl(m);
  dlBtn.setAttribute('download', downloadName(m));
  dlBtn.setAttribute('aria-label', `Download ${m.title}`);
}

// stop the video and its download when the viewer closes or moves on
function clear() {
  for (const v of stage.querySelectorAll('video')) { v.pause(); v.removeAttribute('src'); v.load(); }
  for (const node of [...stage.children]) if (node !== prevBtn && node !== nextBtn) node.remove();
}

async function copyLink(m) {
  if (!m) return;
  const url = `${location.origin}/memes?m=${encodeURIComponent(m.id)}`;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch { ok = false; }
  toast(ok ? 'Link copied' : url);
}

let toastTimer = 0;
function toast(text) {
  let t = document.querySelector('.mm-toast');
  if (!t) { t = el('p', 'mm-toast', { role: 'status', hidden: true }); (dlg.open ? dlg : document.body).append(t); }
  if (dlg.open && t.parentNode !== dlg) dlg.append(t);
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}
