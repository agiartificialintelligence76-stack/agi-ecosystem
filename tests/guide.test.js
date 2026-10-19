// AGI Studio's guide (2026-10-11, the owner: "theres should be a video guide on the site on every step and arrows so they dont
// get confused everyone gets that ofcourse they have an option to X IT but put vosials and video on the guidses please"; the
// owner's choice: arrows that walk through each step on the real buttons, with an X to close, and a short video for each step,
// recorded from the real app): each page's guide and its steps (src/studio/guide-steps.js: their buttons on the pages, their
// words, their videos, when they show), what's kept in this browser, where a step's card goes (never off the window, never
// over its button while there's room), the coach marks' code (src/studio/guide.js: words as text, a muted video that never
// plays by itself with "reduce motion", every way to close it), the pages offering their guide and the bar's ? button, Learn's
// lessons with their videos and "Show me with arrows", the videos themselves (src/studio/guide-media.js, made by
// tools/studio/guide-record.mjs from the real app) and the recorder's promises (only made-up 2D people, never the 3D model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  GUIDE_KEY, GUIDES, CLIP_IDS, LESSON_CLIPS, guideSteps, readGuide, markSeen, setGuidesOff, shouldOffer, placeCard, ringBox,
  coverOf, COVER,
} from '../src/studio/guide-steps.js';
import { CLIPS } from '../src/studio/guide-media.js';
import { LESSONS } from '../src/studio/views/learn.js';
import { trouble } from '../server/studio-words.js';
import { mp4Info } from '../server/mp4.js';
import { helpGuide } from '../server/inf-help.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const AI_NAMES = /\b(fal|kling|seedance|gemini|meshy|nano banana|google|bytedance|kuaishou|openai|claude|anthropic)\b/i;
const VIEWS = ['studio.html', 'src/studio/views/explore.js', 'src/studio/views/gallery.js', 'src/studio/views/create.js', 'src/studio/views/workspace.js',
  'src/studio/views/influencer.js', 'src/studio/views/me.js'];

test('the guides: each page\'s steps (its own ids), their buttons on the pages, their words (PG-13, never an AI service named, never "buy"), their videos, when they show', () => {
  assert.equal(GUIDE_KEY, 'agi_guide');
  assert.deepEqual(Object.keys(GUIDES), ['explore', 'create', 'pick', 'make', 'me']);
  const pages = VIEWS.map(read).join('\n');
  const WHENS = new Set(['signedIn', 'signedOut', 'design', 'photo', 'styled', 'instantOff']);
  for (const [id, g] of Object.entries(GUIDES)) {
    assert.ok(g.name && g.steps.length >= 2 && g.steps.length <= 7, id);
    assert.equal(new Set(g.steps.map((s) => s.id)).size, g.steps.length, `${id}: its steps' own ids`);
    for (const s of g.steps) {
      const where = `${id}/${s.id}`;
      assert.match(s.id, /^[a-z]+$/, where);
      assert.match(s.target, /^[a-z]+$/, where);
      // its button is on a page: data-guide="<target>" (studio.html) or dataset { guide: '<target>' } (a view)
      assert.ok(new RegExp(`data-guide="${s.target}"|guide: '${s.target}'|dataset\\.guide = '${s.target}'`).test(pages), `${where}: its button "${s.target}" on a page`);
      assert.ok(s.title.length >= 6 && s.title.length <= 40, where);
      assert.ok(s.text.length >= 30 && s.text.length <= 140, `${where}: ${s.text.length}`);
      assert.equal(trouble(`${s.title} ${s.text}`), null, where);
      assert.doesNotMatch(`${s.title} ${s.text}`, AI_NAMES, where);
      assert.doesNotMatch(`${s.title} ${s.text}`, /\bbuy (some )?\$?AGI\b|investment|profit|\bmoon\b/i, where);
      assert.ok(CLIP_IDS.includes(s.clip), where);
      assert.ok(!s.when || WHENS.has(s.when), where);
      assert.ok(!s.open || ['panel', 'gallery'].includes(s.open), where);
    }
  }
  // its videos: one name for each, a page's and two of the lessons' own
  assert.equal(new Set(CLIP_IDS).size, CLIP_IDS.length);
  for (const c of CLIP_IDS) assert.match(c, /^(explore|create|pick|make|me)-[a-z]+$/, c);
  assert.ok(CLIP_IDS.includes('make-trend') && CLIP_IDS.includes('make-video'));
  assert.equal(CLIP_IDS.length, 31);
  // (2026-10-11) from a photo, how it's made: its own step and video
  assert.ok(CLIP_IDS.includes('create-way'));
  // (2026-10-11) its profile picture: the camera on its picture (only on its own ready influencer: the step is left out where
  // the camera isn't), its own video, and Learn's first lesson ends with it
  const pfp = GUIDES.make.steps.find((s) => s.id === 'pfp');
  assert.deepEqual({ target: pfp.target, open: pfp.open, clip: pfp.clip, when: pfp.when }, { target: 'pfp', open: 'gallery', clip: 'make-pfp', when: undefined });
  assert.match(pfp.text, /camera/);
  assert.match(pfp.text, /Free\.$/);
  assert.equal(LESSON_CLIPS.start.clips.at(-1), 'make-pfp');
  // (2026-10-12, the editor) "Your creations": one opened shows Edit with words and Edit photo (a photo's) or Edit video (a
  // video's), Make another and Delete first, and its words say so; the photo editor's own video, in Learn's lesson on photos,
  // and the video editor's, in its lesson on videos (its guide is full: 7 steps)
  assert.match(GUIDES.make.steps.find((s) => s.id === 'creations').text, /^Open one to edit it with words or in the photo or video editor \(free\), make another, delete it, /);
  assert.ok(CLIP_IDS.includes('make-editor'));
  assert.equal(LESSON_CLIPS.photos.clips.at(-1), 'make-editor');
  // (2026-10-19, meme templates) a meme from a template: its own video, in Learn's lesson on photos, just before the photo editor's
  assert.ok(CLIP_IDS.includes('make-meme'));
  assert.deepEqual(LESSON_CLIPS.photos.clips.slice(-2), ['make-meme', 'make-editor']);
  assert.ok(CLIP_IDS.includes('make-cut'));
  assert.equal(LESSON_CLIPS.videos.clips.at(-1), 'make-cut');
});

test('a page\'s steps as it is now: signed in or out, designed or from a photo, Instant on or off; an unknown guide has none', () => {
  const ids = (id, env) => guideSteps(id, env).map((s) => s.id);
  assert.deepEqual(ids('explore', {}), ['start', 'gallery', 'wallet', 'nav', 'again']);
  assert.deepEqual(ids('explore', { signedIn: true }), ['start', 'gallery', 'credits', 'nav', 'again']);
  assert.deepEqual(ids('create', { mode: 'design' }), ['mode', 'look', 'style', 'name', 'go']);
  assert.deepEqual(ids('create', {}), ['mode', 'look', 'style', 'name', 'go']);
  // (2026-10-11) from a photo: how it's made (its way); its photo as it is keeps its own look (no style, outfit or vibe)
  assert.deepEqual(ids('create', { mode: 'picture' }), ['mode', 'photo', 'way', 'style', 'name', 'go']);
  assert.deepEqual(ids('create', { mode: 'picture', way: 'body' }), ['mode', 'photo', 'way', 'style', 'name', 'go']);
  assert.deepEqual(ids('create', { mode: 'picture', way: 'asis' }), ['mode', 'photo', 'way', 'name', 'go']);
  assert.deepEqual(ids('create', { mode: 'design', way: 'asis' }), ['mode', 'look', 'style', 'name', 'go']);
  assert.deepEqual(ids('pick', {}), ['looks', 'reroll']);
  assert.deepEqual(ids('make', { instant: false }), ['tools', 'scene', 'models', 'go', 'instant', 'pfp', 'creations']);
  assert.deepEqual(ids('make', { instant: true }), ['instant', 'pfp', 'creations']);
  assert.deepEqual(ids('me', { signedIn: true }), ['credits', 'mine', 'gifts', 'help']);
  assert.deepEqual(ids('me', {}), ['connect', 'help']);
  assert.deepEqual(guideSteps('nope', {}), []);
  assert.deepEqual(guideSteps('__proto__', {}), []);
  // a phone's drawer: its controls' steps open it first, "Your creations" closes it (what's behind it shows)
  for (const s of GUIDES.create.steps) assert.equal(s.open, 'panel', s.id);
  assert.deepEqual(GUIDES.make.steps.map((s) => s.open), ['panel', 'panel', 'panel', 'panel', 'panel', 'gallery', 'gallery']);
});

test('what\'s kept in this browser (never sent anywhere): the guides seen, and "Skip all guides"; a broken or blocked store is harmless', () => {
  const mem = new Map();
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  assert.deepEqual(readGuide(store), { seen: [], off: false });
  assert.equal(shouldOffer('explore', store), true);
  markSeen('explore', store); markSeen('explore', store); markSeen('me', store);
  markSeen('nope', store);                                                     // (only real guides)
  assert.deepEqual(JSON.parse(mem.get(GUIDE_KEY)), { seen: ['explore', 'me'], off: false });
  assert.deepEqual([shouldOffer('explore', store), shouldOffer('me', store), shouldOffer('create', store), shouldOffer('nope', store)], [false, false, true, false]);
  setGuidesOff(true, store);
  assert.deepEqual(readGuide(store), { seen: ['explore', 'me'], off: true });
  assert.equal(shouldOffer('create', store), false);
  setGuidesOff(false, store);
  assert.equal(shouldOffer('create', store), true);
  // someone else's (or an old) value: only what's ours is read
  mem.set(GUIDE_KEY, JSON.stringify({ seen: ['explore', 'explore', 'x', 7, null], off: 'yes' }));
  assert.deepEqual(readGuide(store), { seen: ['explore'], off: false });
  mem.set(GUIDE_KEY, '{broken');
  assert.deepEqual(readGuide(store), { seen: [], off: false });
  mem.set(GUIDE_KEY, '"text"');
  assert.deepEqual(readGuide(store), { seen: [], off: false });
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readGuide(blocked), { seen: [], off: false });
  assert.doesNotThrow(() => markSeen('me', blocked));
  assert.doesNotThrow(() => setGuidesOff(true, blocked));
  assert.equal(shouldOffer('me', blocked), true);
  assert.deepEqual(readGuide(undefined), { seen: [], off: false });
});

test('where a step\'s card goes: beside its button on a computer (right, then left), else under or over it; a phone: the width of the window, under it or over it; never off the window, never over its button while there\'s room; its arrow at its button', () => {
  const view = { w: 1440, h: 900 };
  const card = { w: 360, h: 240 };
  const T = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });
  // beside it: on its right (the arrow on the card's left edge, at the button's middle)
  let t = T(100, 300, 180, 44), p = placeCard({ target: t, card, view });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 280 + 14);
  assert.equal(p.top + p.arrow, 322);
  // no room on its right: on its left
  t = T(1200, 300, 200, 44); p = placeCard({ target: t, card, view });
  assert.equal(p.side, 'right');
  assert.equal(p.left + 360 + 14, 1200);
  // in the top bar (its middle above where an arrow can point beside it): under it
  t = T(150, 10, 240, 32); p = placeCard({ target: t, card, view, top: 52 });
  assert.equal(p.side, 'top');
  assert.equal(p.top, 42 + 14);
  // a button as wide as the window, low: over it
  t = T(0, 760, 1440, 60); p = placeCard({ target: t, card, view });
  assert.equal(p.side, 'bottom');
  assert.equal(p.top + 240 + 14, 760);
  // no button found: the middle of the window, no arrow
  p = placeCard({ target: null, card, view, top: 52 });
  assert.equal(p.side, null);
  assert.equal(p.left, (1440 - 360) / 2);
  // a phone: as wide as the window (12 px each side), under it when it fits, its arrow at the button's middle
  const phone = { w: 390, h: 844 };
  const pc = { w: 366, h: 200 };
  t = T(40, 120, 120, 48); p = placeCard({ target: t, card: pc, view: phone, top: 52, bottom: 80, phone: true });
  assert.deepEqual([p.side, p.left, p.top], ['top', 12, 168 + 14]);
  assert.equal(p.left + p.arrow, 100);
  // near the tab bar: over it
  t = T(0, 770, 390, 74); p = placeCard({ target: t, card: pc, view: phone, top: 52, bottom: 0, phone: true });
  assert.equal(p.side, 'bottom');
  assert.equal(p.top + 200 + 14, 770);
  // the arrow stays on the card's edge (never past its rounded corner)
  t = T(0, 120, 20, 40); p = placeCard({ target: t, card: pc, view: phone, top: 52, phone: true });
  assert.ok(p.arrow >= 22 && p.arrow <= 366 - 22);

  // anywhere a button can be (in the window), and any card that fits: the card in the window; off its button whenever there's
  // room on some side; its arrow along its edge
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let n = 0; n < 4000; n++) {
    const isPhone = n % 2 === 1;
    const v = isPhone ? { w: 320 + Math.round(rnd() * 140), h: 560 + Math.round(rnd() * 360) } : { w: 960 + Math.round(rnd() * 1000), h: 620 + Math.round(rnd() * 500) };
    const top = 52, bottom = isPhone ? 64 + Math.round(rnd() * 40) : 0, margin = 12;
    const c = { w: isPhone ? Math.min(v.w - 24, 460) : 360, h: 150 + Math.round(rnd() * 260) };
    if (c.h > v.h - top - bottom - 2 * margin) continue;
    const tw = 20 + rnd() * (v.w - 20), th = 20 + rnd() * 300;
    const tl = rnd() * (v.w - tw), tt = top + rnd() * Math.max(1, v.h - bottom - top - th);
    const tg = T(tl, tt, tw, th);
    const q = placeCard({ target: tg, card: c, view: v, top, bottom, phone: isPhone });
    const where = JSON.stringify({ v, c, tg, q, isPhone });
    assert.ok(q.left >= margin - 0.5 && q.left + q.w <= v.w - margin + 0.5, `inside left/right ${where}`);
    assert.ok(q.top >= top + margin - 0.5 && q.top + c.h <= v.h - bottom - margin + 0.5, `inside top/bottom ${where}`);
    const edge = q.side === 'left' || q.side === 'right' ? c.h : q.w;
    assert.ok(q.arrow >= 22 - 0.5 && q.arrow <= edge - 22 + 0.5, `arrow on its edge ${where}`);
    const over = Math.max(0, Math.min(q.left + q.w, tg.right) - Math.max(q.left, tg.left)) * Math.max(0, Math.min(q.top + c.h, tg.bottom) - Math.max(q.top, tg.top));
    const roomUnder = v.h - bottom - margin - (tg.bottom + 14), roomOver = tg.top - 14 - (top + margin);
    const cy = (tg.top + tg.bottom) / 2;
    const roomSide = !isPhone && ((v.w - margin - tg.right - 14 >= c.w) || (tg.left - 14 - margin >= c.w))
      && cy >= top + margin + 22 && cy <= v.h - bottom - margin - 22;
    if (c.h <= roomUnder || c.h <= roomOver || roomSide) {
      assert.equal(over, 0, `never over its button with room ${where}`);
    }
  }
});

test('the ring around a step\'s button: a little room around it, inside the window; none for a button too small to see or none at all', () => {
  const view = { w: 390, h: 844 };
  assert.deepEqual(ringBox({ left: 100, top: 200, right: 200, bottom: 240 }, view), { left: 94, top: 194, width: 112, height: 52 });
  assert.deepEqual(ringBox({ left: 0, top: 0, right: 390, bottom: 60 }, view), { left: 2, top: 2, width: 386, height: 64 });
  assert.deepEqual(ringBox({ left: -50, top: 800, right: 500, bottom: 900 }, view), { left: 2, top: 794, width: 386, height: 48 });
  assert.equal(ringBox(null, view), null);
  assert.equal(ringBox({ left: 400, top: 10, right: 410, bottom: 20 }, view), null);
  // how much of its ring a card covers (a card with its video that would cover more than COVER of it goes without it)
  const ring = { left: 100, top: 300, width: 200, height: 100 };
  assert.ok(COVER > 0 && COVER <= 0.1, `${COVER}`);
  assert.equal(coverOf({ left: 320, top: 280, w: 300 }, { w: 300, h: 200 }, ring), 0, 'beside it');
  assert.equal(coverOf({ left: 100, top: 414, w: 300 }, { w: 300, h: 200 }, ring), 0, 'under it');
  assert.equal(coverOf({ left: 50, top: 250, w: 300 }, { w: 300, h: 200 }, ring), 1, 'all over it');
  assert.equal(coverOf({ left: 100, top: 350, w: 200 }, { w: 200, h: 200 }, ring), 0.5, 'its lower half');
  assert.equal(coverOf({ left: 0, top: 380 }, { w: 400, h: 100 }, ring), 0.2, "the card's own width when placeCard gives none");
  assert.equal(coverOf(null, { w: 300, h: 200 }, ring), 0);
  assert.equal(coverOf({ left: 0, top: 0, w: 300 }, { w: 300, h: 200 }, null), 0, 'no ring: nothing to cover');
  // a real case: a phone's "Name it" near the end of a drawer it can't scroll further, the card with its video (about 400 px)
  // fits neither under nor over it, so it would cover it; without its video (about 200 px) it goes under it
  const phone = { w: 360, h: 740 };
  const name = { left: 18, top: 300, right: 342, bottom: 372 };
  const full = placeCard({ target: name, card: { w: 336, h: 400 }, view: phone, top: 52, bottom: 80, phone: true });
  assert.ok(coverOf(full, { w: 336, h: 400 }, ringBox(name, phone)) > COVER, JSON.stringify(full));
  const small = placeCard({ target: name, card: { w: 336, h: 200 }, view: phone, top: 52, bottom: 80, phone: true });
  assert.equal(coverOf(small, { w: 336, h: 200 }, ringBox(name, phone)), 0, JSON.stringify(small));
  assert.equal(small.side, 'top');
});

test('the coach marks (src/studio/guide.js): words only as text, a card the keyboard and screen readers can use, a muted video that never plays by itself with "reduce motion" or "save data", ✕, Escape, Back, Next, "Skip all guides", and only the CSS object model for its places (the CSP)', () => {
  const g = read('src/studio/guide.js');
  assert.doesNotMatch(g, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  assert.doesNotMatch(g, /style\.cssText|setAttribute\('style'|\.style\.[a-z]+\s*=/i);
  assert.match(g, /ui\.title\.textContent = s\.title;/);
  assert.match(g, /ui\.text\.textContent = s\.text;/);
  assert.match(g, /role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': title\.id, 'aria-describedby': text\.id/);
  assert.match(g, /h\('p', \{ class: 'sa-sr', 'aria-live': 'polite' \}\)/);
  assert.match(g, /'aria-label': 'Close the guide'/);
  assert.match(g, /text: 'Skip all guides'/);
  // its video: muted, inline, nothing downloaded before it's needed, hidden from screen readers (its words say the same);
  // paused from the start with "reduce motion" or "save data"
  assert.match(g, /h\('video', \{ class: 'sa-guide-video', muted: true, loop: true, playsinline: true, preload: 'none', disablepictureinpicture: true, disableremoteplayback: true, 'aria-hidden': 'true', tabindex: '-1' \}\)/);
  assert.match(g, /video\.muted = true;\s*video\.defaultMuted = true;/);
  assert.match(g, /playing: !calm\(\) && !saveData\(\)/);
  assert.match(g, /const saveData = \(\) => navigator\.connection\?\.saveData === true;/);
  assert.doesNotMatch(g, /autoplay/);
  // a computer's or a phone's recording, like the screen it's on
  assert.match(g, /CLIPS\[id\]\?\.\[matchMedia\(DRAWER\)\.matches \? 'p' : 'd'\]/);
  assert.match(g, /const DRAWER = '\(max-width: 959px\)';/);
  // a card that would cover its button with its video goes without it ("Watch how" shows it, playing); its video plays only
  // while it's shown (never out of sight), and an interrupted play() isn't taken as a "no"
  assert.match(g, /h\('button', \{ type: 'button', class: 'sa-guide-watch' \}, icon\('play'\), h\('span', \{ text: 'Watch how' \}\)\)/);
  assert.match(g, /const compact = clip && g\.watch !== g\.at && coverOf\(L\.where, \{ w: cardW, h: L\.cardH \}, L\.r\) > COVER;/);
  assert.match(g, /ui\.card\.classList\.add\('is-compact'\);\s*L = layout\(\);/);
  assert.match(g, /ui\.watch\.hidden = !compact;/);
  assert.match(g, /if \(!clip \|\| compact\) \{ if \(!ui\.video\.paused\) ui\.video\.pause\(\); \}\s*else if \(g\.playing && ui\.video\.paused\) setPlaying\(g, true\);/);
  assert.match(g, /if \(n !== g\.plays \|\| err\?\.name === 'AbortError'\) return;/);
  assert.match(g, /g\.watch = -1;/);
  // a computer: its button in the middle only when its card fits beside it; else at the top, its card under it
  assert.match(g, /const beside = !phone && \(r\.right \+ 14 \+ CARD_W \+ 12 <= vw \|\| r\.left - 14 - CARD_W >= 12\);/);
  // never over a sheet (an open sheet makes the page inert), and closed when the page changes; Escape not for a sheet's
  assert.match(g, /const sheetOpen = \(\) => Boolean\(document\.querySelector\('dialog\[open\]'\)\);/);
  assert.match(g, /if \(e\.key !== 'Escape' \|\| e\.defaultPrevented \|\| sheetOpen\(\)\) return;/);
  assert.match(g, /export function leaveGuides\(\)/);
  // the arrow keys step, in its card (never in a box being typed in)
  assert.match(g, /e\.key === 'ArrowRight' && !e\.target\.matches\('input, textarea'\)/);
  // "Skip all guides": off in this browser, and said
  assert.match(g, /setGuidesOff\(true\);\s*close\(\);\s*toast\('Guides are off\. Tap \? on any page to see one\.', 'good'\);/);
  // the keyboard back on the page when it closes (never nowhere)
  assert.match(g, /if \(hadFocus\) document\.getElementById\('sa-main'\)\?\.focus\(\{ preventScroll: true \}\);/);
  // its button scrolled into view (smooth only without "reduce motion"), out of sight while the page moves
  assert.match(g, /const behavior = calm\(\) \? 'auto' : 'smooth';/);
  assert.match(g, /ui\.node\.classList\.add\('is-on', 'is-moving'\);/);
  // (2026-10-11) shown once it's still and in view: a long smooth scroll (Create's panel, since its 26 styles) can pause
  // between frames on a slow phone, or outlast 1.5 s: up to 3 s while its button isn't in view yet
  assert.match(g, /while \(Date\.now\(\) - t0 < 1500 \|\| \(Date\.now\(\) - t0 < 3000 && !seenBox\(el\)\)\) \{/);
  assert.match(g, /if \(now === last\) \{ if \(\+\+still >= 3 && seenBox\(el\)\) return true; \}/);
  // the words a guide uses and its places: nothing else on the page changes (its own elements, its own styles)
  const css = read('src/styles/studio-app.css');
  for (const c of ['sa-guide', 'sa-guide-ring', 'sa-guide-card', 'sa-guide-arrow', 'sa-guide-media', 'sa-guide-video', 'sa-guide-play', 'sa-guide-x', 'sa-guide-skip', 'sa-guide-btn', 'sa-guide-watch']) {
    assert.ok(css.includes(`.${c}`), c);
  }
  assert.match(css, /\.sa-guide-card\.is-compact \.sa-guide-media \{ display: none; \}/);
  assert.match(css, /\.sa-guide-watch\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.sa-guide\.is-moving \.sa-guide-card, \.sa-guide\.is-moving \.sa-guide-ring \{ opacity: 0; \}/);
  const calm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce) {'));
  assert.match(calm, /\.sa-guide-ring::after \{ animation: none;/);
  assert.match(calm, /\.sa-guide-card \{ animation: none; transition: none; \}/);
});

test('each page offers its guide (the first time by itself, the bar\'s ? button again, Learn\'s links with ?guide=1), and the guide goes with its page', () => {
  const app = read('src/studio/app.js');
  assert.match(app, /import \{ offerGuide, leaveGuides, wireGuideButton \} from '\.\/guide\.js';/);
  assert.match(app, /leaveGuides\(\);/);
  assert.match(app, /let guideNow = route\.q\.get\('guide'\) === '1';/);
  assert.match(app, /q\.delete\('guide'\);/);
  assert.match(app, /offerGuide\(id, \{ signedIn: \(\) => Boolean\(state\.session\), \.\.\.env \}, \{ force: forced\(\) \}\);/);
  assert.match(app, /wireGuideButton\(\(\) => nav\(href\('\/learn'\)\)\);/);
  assert.match(app, /for \(const b of \$\$\('\[data-sa-guide\]'\)\) b\.hidden = route\.view === 'learn';/);
  // the first-time tips are gone: the guide took their place
  assert.doesNotMatch(app, /firstTip/);
  const html = read('studio.html');
  assert.match(html, /<button type="button" class="sa-guide-btn" data-sa-guide data-guide="guide" aria-label="Show me around this page" title="Show me around">/);
  assert.equal((html.match(/data-guide="nav"/g) || []).length, 2);
  assert.match(html, /data-sa-account data-guide="account"/);
  assert.match(read('src/studio/views/explore.js'), /ctx\.guide\('explore'\);/);
  assert.match(read('src/studio/views/create.js'), /ctx\.guide\('create', \{ mode: \(\) => st\.mode, way: \(\) => wayNow\(\), open: \(\) => ws\.open\(\), close: \(\) => ws\.close\(\) \}\);/);
  assert.match(read('src/studio/guide.js'), /way: read\(env\.way\) \|\| 'looks'/);
  assert.match(read('src/studio/views/create.js'), /dataset: \{ guide: 'way' \}/);
  const inf = read('src/studio/views/influencer.js');
  assert.match(inf, /if \(pickOrMaking && i\.status === 'pick'\) ctx\.guide\('pick'\);/);
  assert.match(inf, /ctx\.guide\('make', \{ instant: \(\) => instant, open: \(\) => ws\.open\(\), close: \(\) => ws\.close\(\) \}\);/);
  assert.match(read('src/studio/views/me.js'), /ctx\.guide\('me'\);/);
});

test('Learn: its lessons each with its video (its steps\' videos, one after the other, never playing by itself) and "Show me with arrows" where a page has a guide; no first-time tips', () => {
  assert.deepEqual(Object.keys(LESSON_CLIPS), LESSONS.map((l) => l.id));
  for (const [id, l] of Object.entries(LESSON_CLIPS)) {
    assert.ok(l.clips.length >= 1, id);
    for (const c of l.clips) assert.ok(CLIP_IDS.includes(c), `${id}: ${c}`);
    assert.ok(l.guide === null || ['/create', '/explore', '/me'].includes(l.guide), id);
  }
  const src = read('src/studio/views/learn.js');
  assert.match(src, /import \{ LESSON_CLIPS \} from '\.\.\/guide-steps\.js';/);
  assert.match(src, /linkBtn\('Show me with arrows', `\$\{ctx\.href\(more\.guide\)\}\?guide=1`/);
  assert.match(src, /h\('video', \{ class: 'sa-learn-video', muted: true, playsinline: true, preload: 'none'/);
  assert.doesNotMatch(src, /autoplay|innerHTML|TIPS|firstTip|markTip|tipSeen/);
  assert.doesNotMatch(src, AI_NAMES);
});

test('the videos (src/studio/guide-media.js, made by the recorder from the real app): each step\'s, a computer\'s and a phone\'s, short, small and real MP4s (soundless H.264, their posters WebP); the recorder\'s promises', () => {
  const media = read('src/studio/guide-media.js');
  assert.doesNotMatch(media, /https?:\/\//, 'only our own files');
  const dir = fileURLToPath(new URL('../src/studio/guide/', import.meta.url));
  let total = 0;
  for (const [id, set] of Object.entries(CLIPS)) {
    assert.ok(CLIP_IDS.includes(id), id);
    for (const k of ['d', 'p']) {
      const c = set[k];
      assert.ok(c, `${id}: a ${k === 'd' ? "computer's" : "phone's"} recording`);
      assert.ok(Number.isInteger(c.w) && Number.isInteger(c.h) && c.w > c.h, `${id}/${k}: landscape, its size`);
      assert.ok(c.s > 2 && c.s <= 14, `${id}/${k}: ${c.s} s`);
      const mp4 = `${id}-${k}.mp4`, poster = `${id}-${k}.webp`;
      assert.ok(media.includes(`'./guide/${mp4}'`) && media.includes(`'./guide/${poster}'`), `${id}/${k}: imported by its own address`);
      assert.ok(existsSync(dir + mp4) && existsSync(dir + poster), `${id}/${k}: its files`);
      const bytes = readFileSync(dir + mp4);
      total += bytes.length + statSync(dir + poster).size;
      assert.ok(bytes.length < 700_000, `${id}/${k}: ${bytes.length} bytes`);
      const info = mp4Info(bytes);
      assert.ok(info && Math.abs(info.seconds - c.s) < 0.5 && info.width === c.w && info.height === c.h, `${id}/${k}: its header ${JSON.stringify(info)}`);
      assert.equal(readFileSync(dir + poster).subarray(8, 12).toString('latin1'), 'WEBP', `${id}/${k}: a WebP poster`);
      // soundless: its only track a video's (a guide's video plays muted; no sound to carry)
      const handlers = [];
      for (let i = bytes.indexOf('hdlr'); i >= 0; i = bytes.indexOf('hdlr', i + 4)) handlers.push(bytes.toString('latin1', i + 12, i + 16));
      assert.ok(handlers.includes('vide') && !handlers.includes('soun'), `${id}/${k}: ${handlers}`);
    }
  }
  if (Object.keys(CLIPS).length) {
    // all of them, once recorded
    assert.deepEqual(Object.keys(CLIPS).sort(), [...CLIP_IDS].sort());
    assert.ok(total < 20_000_000, `${total} bytes in all`);
  }
  // the recorder: only made-up people, painted in 2D (the live show's paintings), never the 3D model or a render of it; nothing
  // from the real site's data; no secrets for the browser or ffmpeg
  const rec = existsSync(fileURLToPath(new URL('../tools/studio/guide-record.mjs', import.meta.url))) ? read('tools/studio/guide-record.mjs') : null;
  if (rec) {
    assert.doesNotMatch(rec, /agi1-portrait|\.glb\b|agi1\.glb|stage\.js|three/i);
    assert.match(rec, /tools\/live\/page\/art\/people/);
    assert.match(rec, /withoutSecrets/);
    assert.doesNotMatch(rec, /https:\/\/(?!studio\.agi1\.app)[a-z]/i);
  }
});

test('the AI helper knows where the guide is (the ? in the top bar, ✕, "Skip all guides", Learn\'s lessons with their videos) and what the tools make now (the model menu, memes, references, Long videos, Instant), never naming an AI service', () => {
  const g = helpGuide({});
  const line = g.split('\n').find((l) => l.startsWith('THE GUIDE AND LEARN:'));
  assert.ok(line, 'its own line');
  for (const words of ['arrows point at its real buttons', 'a short video', 'the ? in the top bar', '✕ closes it', '"Skip all guides" turns them off', 'Learn', '"Show me with arrows"']) {
    assert.ok(line.includes(words), words);
  }
  const make = g.split('\n').find((l) => l.startsWith('MAKING THINGS'));
  for (const words of ['Classic', 'Crisp', 'a meme', 'references', 'Long, 20 to 60 seconds', 'Anime', 'Instant']) assert.ok(make.includes(words), words);
  assert.doesNotMatch(g, AI_NAMES);
});
