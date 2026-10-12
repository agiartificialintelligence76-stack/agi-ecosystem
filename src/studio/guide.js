// AGI Studio's guide on the page (2026-10-11, the owner: "a video guide on the site on every step and arrows so they dont get
// confused … they have an option to X IT … put vosials and video on the guidses"): coach marks over the real app. Each page
// with a guide (src/studio/guide-steps.js: Explore, Create, an influencer's looks, its tools, My studio) starts it by itself
// the first time this browser opens that page; the bar's ? button shows it again, and Learn's links do (?guide=1).
//   • A card next to the step's real button, with an arrow pointing at it and a ring around it (the rest of the page a little
//     dimmer, still usable); its words; a short muted video of that step, recorded from the real app (src/studio/guide-media.js:
//     a computer's or a phone's, like the screen it's shown on), with a pause button (still pictures with "reduce motion",
//     and when the browser asks to save data); Back, Next (Done on the last), ✕, and "Skip all guides".
//   • Keyboard: the card is reachable (its title takes the keyboard when it starts), ← and → step, Escape closes it. Screen
//     readers hear each step (a live region); the video is decoration (its words say the same).
//   • Nothing is sent anywhere: which guides were seen, and "Skip all guides", stay in this browser (GUIDE_KEY).
//   • Hidden while a sheet is open (a sheet makes the rest of the page inert), and closed when the page changes.
import { h, icon, btn, toast } from './ui.js';
import { GUIDES, guideSteps, placeCard, ringBox, coverOf, COVER, readGuide, markSeen, setGuidesOff, shouldOffer } from './guide-steps.js';
import { CLIPS } from './guide-media.js';

const DRAWER = '(max-width: 959px)';  // the drawer's layout: the videos recorded on a phone
const NARROW = '(max-width: 719px)';  // the card spans the width; a tab bar at the bottom
const CARD_W = 360;                    // the card's width on a computer
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = () => navigator.connection?.saveData === true;
const sheetOpen = () => Boolean(document.querySelector('dialog[open]'));
const px = (v) => `${Math.round(v)}px`;

let page = null;     // this page's guide: { id, env }
let active = null;   // the guide on screen
let waiting = null;  // a guide about to start by itself (its timer)

// ---------- a page's guide ----------
// offerGuide(id, env, { force }): the page has this guide (env: what it's like now and how to show its parts:
// { signedIn(), mode(), instant(), open(), close() }). It starts by itself the first time this browser opens it (unless guides
// are off); force: now (the ? button, a Learn link). The same guide offered again (a page drawn again) changes nothing.
export function offerGuide(id, env = {}, { force = false } = {}) {
  if (!Object.hasOwn(GUIDES, id)) return;
  const same = page?.id === id;
  page = { id, env };
  if (active && active.id !== id) close();
  if (same && !force) return;
  if (force || shouldOffer(id)) whenReady(id, force);
}
// the page changed: its guide goes
export function leaveGuides() {
  page = null;
  clearTimeout(waiting);
  waiting = null;
  if (active) close();
}
// the bar's ? button: this page's guide from its first step (a page without one: false)
export function showGuide() {
  if (!page) return false;
  if (active) close();
  whenReady(page.id, true);
  return true;
}
export const guideOn = () => (active ? active.id : null);

// starts once the page is ready for it: no sheet open, the tab shown, its first step's button on the page (15 s at most)
function whenReady(id, force) {
  clearTimeout(waiting);
  const until = Date.now() + 15_000;
  const tick = () => {
    if (page?.id !== id) return;
    const steps = guideSteps(id, envNow(page.env));
    const ready = !sheetOpen() && document.visibilityState === 'visible' && steps.some((s) => findTarget(s.target, { anywhere: true }));
    if (ready) { waiting = null; start(id, force); return; }
    if (Date.now() < until) waiting = setTimeout(tick, 300);
  };
  waiting = setTimeout(tick, force ? 0 : 500);
}
const envNow = (env = {}) => {
  const read = (f) => (typeof f === 'function' ? f() : f);
  return { signedIn: read(env.signedIn) === true, mode: read(env.mode) || 'design', way: read(env.way) || 'looks', instant: read(env.instant) === true };
};

// the element a step points at: [data-guide="<name>"], the one most in view (a phone's tab bar or a computer's nav; a drawer's
// button rather than its copy off-screen)
function findTarget(name, { anywhere = false } = {}) {
  let best = null, bestArea = -1;
  for (const el of document.querySelectorAll(`[data-guide="${name}"]`)) {
    if (el.closest('[hidden], [inert]') && !anywhere) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const ht = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const area = w * ht;
    if (area > bestArea) { best = el; bestArea = area; }
  }
  return best;
}

// ---------- where things are ----------
const FIXED = '.sa-bar, .sa-tabs';    // the app's bars: always in view, nothing to scroll
// the part of the window the page shows: under the top bar, above a phone's tab bar (and above a phone's closed drawer, for
// what's behind it)
function edges(el) {
  const vh = innerHeight;
  const top = Math.max(0, document.querySelector('.sa-bar')?.getBoundingClientRect().bottom || 0);
  let bottom = vh;
  const tabs = document.querySelector('.sa-tabs');
  const tb = tabs?.getBoundingClientRect();
  if (tb && tb.height > 0 && tb.top < vh && tb.top > vh / 2) bottom = Math.min(bottom, tb.top);
  const drawer = document.querySelector('.sa-ws.is-drawer:not(.is-open) > .sa-ws-panel');
  const db = drawer && !drawer.hidden && !drawer.contains(el) ? drawer.getBoundingClientRect() : null;
  if (db && db.height > 0 && db.top > vh / 2) bottom = Math.min(bottom, db.top);
  return { top, bottom };
}
const clipsIt = (s) => s.overflowX !== 'visible' || s.overflowY !== 'visible';
// what's seen of it: its box inside the boxes that clip it (a panel's own scroll) and the window's part for the page
function seenBox(el) {
  const r = el.getBoundingClientRect();
  let b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (clipsIt(s)) {
      const c = p.getBoundingClientRect();
      b = { left: Math.max(b.left, c.left), top: Math.max(b.top, c.top), right: Math.min(b.right, c.right), bottom: Math.min(b.bottom, c.bottom) };
    }
    // (nothing above a fixed box clips what's in it)
    if (s.position === 'fixed') break;
  }
  const e = el.closest(FIXED) ? { top: 0, bottom: innerHeight } : edges(el);
  b = { left: Math.max(b.left, 0), top: Math.max(b.top, e.top), right: Math.min(b.right, document.documentElement.clientWidth || innerWidth), bottom: Math.min(b.bottom, e.bottom) };
  return b.right - b.left > 1 && b.bottom - b.top > 1 ? b : null;
}
// the box that scrolls it (a panel's, a drawer's), or none: the page's
function scrollerOf(el) {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}
// its button in view: at the top of what shows (a phone: its card goes under it) or, on a computer, in the middle when its card
// fits beside it (else at the top too: one as wide as the page has its card under it); a tall one from its top
function bringIn(el, phone) {
  if (el.closest(FIXED)) return;
  const behavior = calm() ? 'auto' : 'smooth';
  const r = el.getBoundingClientRect();
  const pad = 14;
  const sc = scrollerOf(el);
  const area = sc ? sc.getBoundingClientRect() : edges(el);
  const span = area.bottom - area.top;
  const vw = document.documentElement.clientWidth || innerWidth;
  const beside = !phone && (r.right + 14 + CARD_W + 12 <= vw || r.left - 14 - CARD_W >= 12);
  const want = !beside || r.height > span * 0.6 ? area.top + pad : area.top + (span - r.height) / 2;
  const by = Math.round(r.top - want);
  if (Math.abs(by) < 2) return;
  if (sc) sc.scrollBy({ top: by, behavior });
  else scrollBy({ top: by, behavior });
}
// until it stops moving (a smooth scroll, a drawer sliding open) in view: its place read every 90 ms, at most 1.5 s, or 3 s
// while it isn't in view yet. (2026-10-11: since its 26 styles, Create's panel is long, and a long smooth scroll on a slow
// phone can pause between frames, or outlast 1.5 s: its card then showed in the middle, without its ring, until it ended)
async function settle(g, token, el) {
  let last = '', still = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 1500 || (Date.now() - t0 < 3000 && !seenBox(el))) {
    await new Promise((r) => setTimeout(r, 90));
    if (token !== g.token || active !== g) return false;
    const r = el.getBoundingClientRect();
    const now = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (now === last) { if (++still >= 3 && seenBox(el)) return true; } else { still = 0; last = now; }
  }
  return true;
}

// ---------- the card ----------
function build() {
  const n = Math.random().toString(36).slice(2, 8);
  const title = h('h2', { class: 'sa-guide-title', id: `sa-guide-t-${n}`, tabindex: '-1' });
  const text = h('p', { class: 'sa-guide-text', id: `sa-guide-d-${n}` });
  const count = h('p', { class: 'sa-guide-count' });
  const video = h('video', { class: 'sa-guide-video', muted: true, loop: true, playsinline: true, preload: 'none', disablepictureinpicture: true, disableremoteplayback: true, 'aria-hidden': 'true', tabindex: '-1' });
  video.muted = true;
  video.defaultMuted = true;
  const play = h('button', { type: 'button', class: 'sa-guide-play' });
  const media = h('div', { class: 'sa-guide-media' }, video, play);
  // (a card that would cover its button with its video goes without it: this shows it)
  const watch = h('button', { type: 'button', class: 'sa-guide-watch' }, icon('play'), h('span', { text: 'Watch how' }));
  watch.hidden = true;
  const back = btn('Back', { kind: 'ghost', size: 'sm', class: 'sa-btn sa-btn-ghost sa-btn-sm sa-guide-back' });
  const next = btn('Next', { kind: 'primary', size: 'sm', class: 'sa-btn sa-btn-primary sa-btn-sm sa-guide-next' });
  const skip = h('button', { type: 'button', class: 'sa-guide-skip', text: 'Skip all guides' });
  const x = h('button', { type: 'button', class: 'sa-guide-x', 'aria-label': 'Close the guide' }, icon('close'));
  const arrow = h('span', { class: 'sa-guide-arrow', 'aria-hidden': 'true' });
  const live = h('p', { class: 'sa-sr', 'aria-live': 'polite' });
  const card = h('div', { class: 'sa-guide-card', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': title.id, 'aria-describedby': text.id },
    arrow, media, h('div', { class: 'sa-guide-body' }, h('div', { class: 'sa-guide-head' }, count, watch, x), title, text),
    h('div', { class: 'sa-guide-foot' }, skip, h('span', { class: 'sa-guide-nav' }, back, next)), live);
  const ring = h('div', { class: 'sa-guide-ring', 'aria-hidden': 'true' });
  const node = h('div', { class: 'sa-guide' }, ring, card);
  document.body.append(node);
  return { node, card, ring, arrow, title, text, count, video, play, media, watch, back, next, skip, x, live };
}

function start(id, force) {
  if (!page || page.id !== id) return;
  const steps = guideSteps(id, envNow(page.env));
  if (!steps.length) return;
  if (active) close();
  markSeen(id);
  const ui = build();
  const g = { id, steps, at: -1, ui, target: null, raf: 0, timer: 0, lost: 0, playing: !calm() && !saveData(), token: 0, forced: force, watch: -1, compact: false };
  active = g;
  ui.next.addEventListener('click', () => step(g, 1));
  ui.back.addEventListener('click', () => step(g, -1));
  ui.x.addEventListener('click', () => close());
  // "Watch how": this step's video after all (over its button now: they asked), playing
  ui.watch.addEventListener('click', () => {
    g.watch = g.at;
    g.playing = true;
    place(g);
    ui.play.focus({ preventScroll: true });
  });
  ui.skip.addEventListener('click', () => {
    setGuidesOff(true);
    close();
    toast('Guides are off. Tap ? on any page to see one.', 'good');
  });
  ui.play.addEventListener('click', () => setPlaying(g, !g.playing));
  ui.video.addEventListener('error', () => { ui.media.hidden = true; place(g); });
  ui.card.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !e.target.matches('input, textarea')) { e.preventDefault(); step(g, 1); }
    else if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea')) { e.preventDefault(); step(g, -1); }
  });
  g.onKey = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || sheetOpen()) return;
    close();
  };
  g.onMove = () => { cancelAnimationFrame(g.raf); g.raf = requestAnimationFrame(() => place(g)); };
  document.addEventListener('keydown', g.onKey);
  addEventListener('resize', g.onMove);
  addEventListener('scroll', g.onMove, { capture: true, passive: true });
  // the page can change under it (a part drawn again, a drawer sliding): its place is checked every half second
  g.timer = setInterval(() => place(g), 450);
  go(g, 0, 1, { first: true });
}

// to the next step (dir 1) or back (-1); past the last one: done
function step(g, dir) {
  if (active !== g) return;
  const to = g.at + dir;
  if (to < 0) return;
  if (to >= g.steps.length) { close(); return; }
  go(g, to, dir);
}

// shows step k (a step whose button isn't on the page is passed, the way it was going)
async function go(g, k, dir, { first = false } = {}) {
  const token = ++g.token;
  const s = g.steps[k];
  const env = page?.env || {};
  if (s.open === 'panel') env.open?.();
  else if (s.open === 'gallery') env.close?.();
  let el = findTarget(s.target);
  // a drawer sliding open, a part being drawn: a moment for it
  for (let t = 0; !el && t < 6; t++) {
    await new Promise((r) => setTimeout(r, 150));
    if (token !== g.token || active !== g) return;
    el = findTarget(s.target);
  }
  if (!el) {
    const to = k + (dir || 1);
    if (to >= 0 && to < g.steps.length) { go(g, to, dir || 1, { first }); return; }
    if (first) { close(); return; }
    // nothing more to show this way: the step it was on stays
    return;
  }
  g.at = k;
  g.target = s.target;
  g.lost = 0;
  g.watch = -1;
  const { ui } = g;
  ui.count.textContent = `${k + 1} of ${g.steps.length}`;
  ui.title.textContent = s.title;
  ui.text.textContent = s.text;
  ui.back.hidden = k === 0;
  ui.next.lastChild.textContent = k === g.steps.length - 1 ? 'Done' : 'Next';
  ui.next.setAttribute('aria-label', k === g.steps.length - 1 ? 'Done: close the guide' : `Next: step ${k + 2} of ${g.steps.length}`);
  ui.live.textContent = `Step ${k + 1} of ${g.steps.length}: ${s.title}. ${s.text}`;
  setClip(g, s.clip);
  // its button in view (in its own scrolling panel too), out of sight while the page moves, then the card beside it
  ui.node.classList.add('is-on', 'is-moving');
  bringIn(el, matchMedia(NARROW).matches);
  if (!(await settle(g, token, el))) return;
  ui.node.classList.remove('is-moving');
  place(g);
  if (first) ui.title.focus({ preventScroll: true });
}

// its video: a computer's or a phone's recording, like the screen it's on
function setClip(g, id) {
  const { ui } = g;
  const set = CLIPS[id]?.[matchMedia(DRAWER).matches ? 'p' : 'd'] || CLIPS[id]?.d || null;
  ui.media.hidden = !set;
  if (!set) { ui.video.removeAttribute('src'); ui.video.load(); return; }
  if (ui.video.dataset.clip !== `${id}`) {
    ui.video.dataset.clip = id;
    ui.video.poster = set.poster;
    ui.video.src = set.mp4;
  }
  // it plays once its card shows it (place())
  ui.video.pause();
  playButton(g);
}
function playButton(g) {
  const { ui } = g;
  ui.play.replaceChildren(icon(g.playing ? 'pause' : 'play'), h('span', { class: 'sa-sr', text: g.playing ? 'Pause the video' : 'Play the video' }));
  ui.play.classList.toggle('is-paused', !g.playing);
}
function setPlaying(g, on) {
  const { ui } = g;
  g.playing = Boolean(on);
  playButton(g);
  if (!g.playing) { ui.video.pause(); return; }
  const n = (g.plays = (g.plays || 0) + 1);
  ui.video.play().catch((err) => {
    // interrupted (its next step's video, a pause): not a "no"
    if (n !== g.plays || err?.name === 'AbortError') return;
    g.playing = false;
    playButton(g);
  });
}

// the card beside its button, the ring around it. What's seen of the button (a panel's scroll, the bars), and of a tall one its
// top: on a phone as much as leaves room for the card under it (a section's heading and its first row)
function place(g) {
  if (active !== g || g.at < 0) return;
  const { ui } = g;
  const el = findTarget(g.target);
  const view = { w: document.documentElement.clientWidth || innerWidth, h: innerHeight };
  const narrow = matchMedia(NARROW).matches;
  const e = edges(el);
  if (!el) g.lost += 1; else g.lost = 0;
  const cardW = narrow ? Math.min(view.w - 24, 460) : CARD_W;
  ui.card.style.setProperty('width', px(cardW));
  const seen = el ? seenBox(el) : null;
  const layout = () => {
    const cardH = ui.card.offsetHeight;
    const box = seen ? { ...seen } : null;
    if (box && narrow) {
      // a phone: the card goes under it (or over it, when there's room there): a tall one's top part, the card beside it
      const under = e.bottom - 12 - cardH - 14;
      const roomOver = box.top - 14 - (e.top + 12) >= cardH;
      if (box.bottom > under && !roomOver) box.bottom = Math.max(box.top + Math.min(48, box.bottom - box.top), under);
    }
    const where = placeCard({ target: box, card: { w: cardW, h: cardH }, view, top: e.top, bottom: view.h - e.bottom, phone: narrow });
    return { cardH, where, r: box ? ringBox(box, view) : null };
  };
  // with its video, unless that card would cover its button (a short screen, a button the page can't scroll up): then without
  // it, and "Watch how" shows it
  ui.card.classList.remove('is-compact');
  let L = layout();
  const clip = !ui.media.hidden;
  const compact = clip && g.watch !== g.at && coverOf(L.where, { w: cardW, h: L.cardH }, L.r) > COVER;
  if (compact) {
    ui.card.classList.add('is-compact');
    L = layout();
  }
  g.compact = compact;
  ui.watch.hidden = !compact;
  const { where, r } = L;
  ui.card.style.setProperty('left', px(where.left));
  ui.card.style.setProperty('top', px(where.top));
  ui.card.dataset.side = where.side || 'none';
  ui.card.style.setProperty('--sa-arrow', px(where.arrow));
  ui.ring.hidden = !r;
  if (r) for (const k of ['left', 'top', 'width', 'height']) ui.ring.style.setProperty(k, px(r[k]));
  // its video plays while it's shown (unless it was paused), never out of sight
  if (!clip || compact) { if (!ui.video.paused) ui.video.pause(); }
  else if (g.playing && ui.video.paused) setPlaying(g, true);
}

function close() {
  const g = active;
  if (!g) return;
  active = null;
  clearInterval(g.timer);
  cancelAnimationFrame(g.raf);
  document.removeEventListener('keydown', g.onKey);
  removeEventListener('resize', g.onMove);
  removeEventListener('scroll', g.onMove, { capture: true });
  const hadFocus = g.ui.card.contains(document.activeElement);
  g.ui.video.pause();
  g.ui.node.remove();
  // the keyboard goes back to the page (its main part), not to nowhere
  if (hadFocus) document.getElementById('sa-main')?.focus({ preventScroll: true });
}

// the bar's ? button (studio.html): this page's guide, else Learn
export function wireGuideButton(onNone) {
  for (const b of document.querySelectorAll('[data-sa-guide]')) {
    b.addEventListener('click', () => { if (!showGuide()) onNone?.(); });
  }
}

// (for tests in a browser: which guides this browser has seen, and whether they're off)
export const guideState = () => readGuide();
