// AGI Studio's guide videos: what happens in each one (tools/studio/guide-record.mjs films it from the real app, with the demo
// studio behind it). One scene for each video of src/studio/guide-steps.js (CLIP_IDS): where it starts (path), what it starts
// from (setup: before the browser opens; before: in the page, before the camera rolls), and what happens (run). Each scene is
// filmed twice, on a computer's screen and on a phone's (phone: true), the way each is used there: a mouse and a computer's
// layout, or taps and a phone's (its tab bar, its drawer of controls, its sheets from the bottom).
import { LOOKS, LOOKS2, look, body, cutRun } from './guide-record.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (t) => new RegExp(`^\\s*${esc(t)}\\s*$`);
const SHEET = 'dialog.sa-sheet[open]';

// ---------- finding things on the page ----------
// a chip of one of Create's groups: its group's name (its legend) and its words
const chip = (page, legend, text) => page.locator('fieldset.sa-chips').filter({ has: page.locator('legend', { hasText: exact(legend) }) })
  .locator('label').filter({ has: page.locator('.sa-chip-text', { hasText: exact(text) }) }).first();
// an option of a segmented control, by its words
const seg = (root, text) => root.locator('.sa-seg label').filter({ hasText: exact(text) }).first();
// a model card, by its name
const card = (page, name) => page.locator('.sa-cards label').filter({ has: page.locator('.sa-card-name', { hasText: exact(name) }) }).first();
// a button or a link, by its words
const byText = (root, text) => root.locator('button, a').filter({ hasText: exact(text) }).first();
const openSheet = (page) => page.locator(SHEET).last();

// ---------- the demo's AI at work: what's being made moves along ----------
// Each request waits in the AI service's line a moment, is made, and is done (the demo's fake service: tests/influencer.test.js);
// the page asks again (as it does every few seconds, sooner here: the page's own "you came back" check) until done() says so
async function finish(page, B, done, { ms = 70_000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const now = Date.now();
    for (const r of B.fake.fal.requests.values()) {
      r.seenAt ??= now;
      if (r.status === 'IN_QUEUE' && now - r.seenAt > 1400) { r.status = 'IN_PROGRESS'; r.madeAt = now; }
      else if (r.status === 'IN_PROGRESS' && now - (r.madeAt || now) > 2600) r.status = 'COMPLETED';
    }
    if (await done()) return;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {});
    await sleep(800);
  }
  throw new Error('what was being made never finished');
}
const shown = (loc) => async () => (await loc.count()) > 0 && loc.first().isVisible();

// ---------- a phone's drawer of controls ----------
async function openDrawer(film, page) {
  if (!film.phone || await page.locator('.sa-ws.is-drawer.is-open').count()) return;
  await film.click(page.locator('.sa-ws-quick button').first(), { after: 650 });
}
async function closeDrawer(film, page) {
  if (!film.phone || !(await page.locator('.sa-ws.is-drawer.is-open').count())) return;
  await film.click(page.locator('.sa-ws-toggle').first(), { after: 650 });
}
// a phone's drawer opened before the camera rolls (no tap filmed)
async function drawerOpen(page, phone) {
  if (!phone || await page.locator('.sa-ws.is-drawer.is-open').count()) return;
  await page.locator('.sa-ws-quick button').first().click();
  await sleep(600);
}
// a tool of an influencer's page (Photo, Trend, Video, 3D, Coin), picked before the camera rolls
async function toolNow(page, id) {
  await page.locator(`.sa-tooltab[data-tool="${id}"]`).click();
  await sleep(400);
}

// ---------- what some scenes start from ----------
// Mira, being made: her 4 looks ready to pick (looks: the made-up people of her next 4, if 4 new ones are asked for)
async function pickState(B, state, { next = LOOKS } = {}) {
  const inf = await B.readyInf({ name: 'Mira', style: 'anime' });
  const i = B.fake.db.infs.get(inf.id);
  Object.assign(i, { status: 'pick', pick: null, body_job: null, ready: null, public: false });
  B.fake.db.jobs.delete(inf.body);
  for (let k = 0; k < 4; k++) await state.putPic(B.picPath(inf.id, inf.looks, k), await look(LOOKS[k]));
  state.looks = next;
  state.pick = inf;
}
// Create's choices for an influencer like Mira (a scene that starts from them)
async function designMira(page) {
  for (const [legend, text] of [['Look', 'Feminine'], ['Age', '20s']]) await chip(page, legend, text).click();
  await page.locator('#sa-name').fill('Mira');
  await page.locator('.sa-ws-body').evaluate((el) => el.scrollTo({ top: 0 }));
  await sleep(300);
}

// a part of something big (a panel, a sheet, a wall): from its top-left corner (dx, dy in), w × h at most; what the camera
// shows of it, so its words stay big enough to read
async function partOf(loc, { w = Infinity, h = 400, dx = 0, dy = 0 } = {}) {
  const b = await loc.first().boundingBox();
  return b ? { x: b.x + dx, y: b.y + dy, width: Math.max(1, Math.min(b.width - dx, w)), height: Math.max(1, Math.min(b.height - dy, h)) } : null;
}
const topOf = (loc, h = 400) => partOf(loc, { h });
// the box around several things (a guide's card and what its arrow points at)
async function around(...locs) {
  const bs = [];
  for (const l of locs) if (await l.count()) { const b = await l.first().boundingBox(); if (b) bs.push(b); }
  if (!bs.length) return null;
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  return { x: x0, y: y0, width: Math.max(...bs.map((b) => b.x + b.width)) - x0, height: Math.max(...bs.map((b) => b.y + b.height)) - y0 };
}
// Explore's top, where a clip starts: a computer's camera sees all of its words; a phone's narrower picture, its heading
// first (2026-10-11: the holders' line made its words taller than a phone's picture), then follows what's pressed
async function heroStart(page, phone) {
  const copy = page.locator('.sa-hero-copy').first();
  return phone ? topOf(copy, 236) : copy;
}
// a sheet's own scroller (its words; on a phone it comes up from the bottom)
const sheetIn = (page) => page.locator(`${SHEET} .sa-sheet-in`).last();
// the guide settled on its step (it scrolls what its arrow points at into view first)
const guideStill = (page) => page.waitForFunction(() => document.querySelector('.sa-guide-card') && !document.querySelector('.sa-guide.is-moving'));

// a photo of Mira's to open (the first one in her creations)
const aPhoto = (page) => page.locator('.sa-inf-gallery .sa-media-open[aria-label$=": a photo"]').first();
// (2026-10-12) a video of hers to open (not her trend video)
const aVideo = (page) => page.locator('.sa-inf-gallery .sa-media-open[aria-label$=": a video"]').first();
// (2026-10-12) a video on the screen: playing, its picture there, then a moment for the screen to show it
async function playingNow(page, video, ms = 600) {
  await video.waitFor();
  await video.evaluate((el) => (el.readyState >= 2 ? null : new Promise((r) => {
    el.addEventListener('loadeddata', r, { once: true }); el.addEventListener('error', r, { once: true }); setTimeout(r, 8000);
  })));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await sleep(ms);
}

// what's just being made, in her creations: the frame around it (a computer's: the wall from the tile's side, as tall as the
// tile, never the panel of controls beside the wall; a phone's: the tile), given where the tile is (dy: how far the page is
// about to scroll)
async function makingFrame(page, tile, phone, dy = 0) {
  const b = await tile.boundingBox();
  if (!b) return null;
  const t = { ...b, y: b.y - dy };
  if (phone) return { box: t, room: 1.05 };
  const wall = await page.locator('.sa-inf-gallery .sa-wall').first().boundingBox();
  const h = t.height + 40, w = h * 1.6;
  const x = Math.max((wall?.x ?? t.x) - 12, t.x + t.width + 12 - w);
  return { box: { x, y: t.y - 20, width: w, height: h }, room: 1 };
}
// the page scrolled (gently) to what's just being made, the camera going there with it
async function toMaking(film, page, tile, phone) {
  const dy = await tile.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bar = document.querySelector('.sa-bar')?.getBoundingClientRect().bottom || 0;
    const want = r.top - bar - Math.max(0, (innerHeight - bar - r.height) / 2);
    const max = document.scrollingElement.scrollHeight - innerHeight - scrollY;
    return Math.round(Math.max(-scrollY, Math.min(want, max)));
  });
  const f = await makingFrame(page, tile, phone, dy);
  if (f) await film.cam(f.box, { room: f.room, dur: 0.9 });
  if (Math.abs(dy) > 2) await page.evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), dy);
  await sleep(950);
}
// the camera on it again, where it is (it's done)
async function onMade(film, page, tile, phone) {
  const f = await makingFrame(page, tile, phone);
  if (f) await film.cam(f.box, { room: f.room });
}
// a phone: a sheet comes up from the bottom, as tall as most of the screen (92% of its height: studio-app.css), so the camera
// goes up to where its top lands as it's tapped open (left where the tap was, it showed the middle of the sheet, a photo or a
// video, big, for a second before going up)
async function upToSheet(film, phone) {
  if (!phone) return;
  const V = film.lay.view;
  await film.cam({ x: 0, y: Math.round(V.height * 0.08), width: V.width, height: V.width / 1.6 }, { room: 1, dur: 0.45 });
}
// (2026-10-12) a picture on the screen: loaded, decoded, then a moment for the screen to show it (on a computer without a
// graphics card the screen shows what the page did up to about half a second later)
async function painted(page, img, ms = 900) {
  await img.waitFor();
  await img.evaluate((el) => (el.complete && el.naturalWidth ? null : new Promise((r) => {
    el.addEventListener('load', r, { once: true }); el.addEventListener('error', r, { once: true }); setTimeout(r, 8000);
  })));
  await img.evaluate((el) => (el.decode ? el.decode().catch(() => {}) : null));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await sleep(ms);
}
// a phone, a done video's sheet: after its top (its name, what it is), the video's middle (its person), where it plays
async function onVideo(film, page, phone) {
  if (!phone) { await film.wait(2000); return; }
  await film.wait(900);
  await film.cam(openSheet(page).locator('.sa-player').first(), { room: 1, dur: 0.8 });
  await film.wait(1700);
}

// ---------- the scenes ----------
// (the camera: start() frames where a clip begins; a click or a hover keeps its target in the picture, moving only if it has
// to; cam() frames something new: a page that just opened, a sheet, a part of a long page. Each clip about 6 to 12 seconds)
export const SCENES = {
  // Explore: "Create an influencer" → Create
  'explore-start': {
    path: '/explore',
    async run({ page, film, phone }) {
      const cta = page.locator('[data-guide="start"]').first();
      await film.start(await heroStart(page, phone), { room: phone ? 1.02 : 1.08 });
      await film.still('hero');
      await film.wait(phone ? 1700 : 1000);
      await film.hover(cta, { after: phone ? 150 : 450 });
      film.poster();
      await film.click(cta, { after: 250 });
      await page.locator('[data-guide="mode"]').first().waitFor();
      await sleep(350);
      await film.cam(await topOf(page.locator('.sa-ws-panel'), phone ? 250 : 330), { room: phone ? 1.02 : 1.08 });
      await film.still('create');
      await film.wait(1700);
      await film.end(400);
    },
  },

  // Explore's gallery: a trend clip (it plays under a computer's mouse), opened, its prompt copied
  'explore-trends': {
    path: '/explore',
    async run({ page, film, phone }) {
      await film.start(await heroStart(page, phone), { room: phone ? 1.02 : 1.08 });
      await film.wait(700);
      await film.click(byText(page, 'Browse trends'), { after: 1100 });
      const row = page.locator('.sa-trend-row').first();
      await row.waitFor();
      await film.cam(await partOf(row, { w: phone ? 390 : 600, h: phone ? 230 : 290 }), { room: phone ? 1 : 1.04 });
      await film.wait(500);
      await film.still('gallery');
      const tile = row.locator('.sa-trend').first();
      if (!phone) {
        await film.hover(tile, { after: 1100 });
        film.poster();
        await film.still('hover');
      }
      await film.click(tile, { after: 80 });
      await upToSheet(film, phone);
      await openSheet(page).waitFor();
      await sleep(phone ? 250 : 100);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 400), { room: phone ? 1.02 : 1.06 });
      if (phone) film.poster();
      await film.wait(1000);
      const prompt = openSheet(page).locator('.sa-prompt').first();
      await film.scrollTo(prompt, { within: '.sa-sheet-in' });
      await film.cam(prompt, { room: phone ? 1.02 : 1.2 });
      await film.click(prompt.locator('button').first(), { after: 1200 });
      await film.still('copied');
      await film.end(400);
    },
  },

  // Connect wallet: the wallets in this browser, a free signature, connected (a Crush)
  'explore-wallet': {
    path: '/explore',
    signedIn: false,
    async run({ page, film, phone }) {
      const acct = page.locator('[data-guide="account"]').first();
      await film.start(acct, { room: phone ? 4 : 3 });
      await film.wait(700);
      await film.click(acct.locator('button').first(), { after: 600 });
      await openSheet(page).locator('.sa-wallet').first().waitFor();
      await sleep(250);
      await film.cam(await topOf(sheetIn(page), phone ? 240 : 300), { room: phone ? 1.02 : 1.06 });
      await film.wait(800);
      await film.still('wallets');
      await film.click(openSheet(page).locator('.sa-wallet').first(), { after: 400 });
      film.poster();
      await page.locator(SHEET).waitFor({ state: 'detached', timeout: 15000 });
      await page.locator('.sa-pill').first().waitFor();
      await film.cam(acct, { room: phone ? 3.5 : 3 });
      await film.wait(1300);
      await film.still('connected');
      await film.end(400);
    },
  },

  // the credits pill's +: Buy credits (an amount, the studio's wallet to send USDG to, Copy)
  'explore-credits': {
    path: '/explore',
    async run({ page, film, phone }) {
      const acct = page.locator('[data-guide="account"]').first();
      await page.locator('.sa-pill').first().waitFor();
      await film.start(acct, { room: phone ? 3.5 : 3 });
      await film.wait(800);
      await film.click(page.locator('.sa-pill-plus').first(), { after: 600 });
      await openSheet(page).waitFor();
      await sleep(250);
      await film.cam(await topOf(sheetIn(page), phone ? 240 : 260), { room: phone ? 1.02 : 1.06 });
      await film.wait(500);
      await film.click(openSheet(page).locator('.sa-amount').nth(1), { after: 700 });
      film.poster();
      await film.still('amount');
      const pay = openSheet(page).locator('.sa-pay').first();
      await film.scrollTo(pay, { within: '.sa-sheet-in' });
      await film.cam(pay, { room: phone ? 1.02 : 1.12 });
      await film.wait(400);
      await film.click(pay.locator('.sa-addr-row button').first(), { after: 1200 });
      await film.still('copied');
      await film.end(400);
    },
  },

  // finding your way: a computer's bar (Explore · Create · My studio), a phone's tab bar
  'explore-nav': {
    path: '/explore',
    async run({ page, film, phone }) {
      const nav = page.locator(phone ? '.sa-tabs' : '.sa-nav').first();
      // (a computer: the bar's left, the page under it; a phone: the tab bar at the bottom, the page above it)
      if (phone) await film.start(nav, { room: 1, y: 0.1 });
      else await film.start({ x: 0, y: 0, width: 620, height: 388 }, { room: 1 });
      await film.wait(800);
      await film.click(nav.locator('a[data-sa-route="create"]'), { cam: false, after: 1300 });
      film.poster();
      await film.still('create');
      await film.click(nav.locator('a[data-sa-route="me"]'), { cam: false, after: 900 });
      await page.locator('[data-guide="credits"]').first().waitFor();
      await film.wait(900);
      await film.still('me');
      await film.end(400);
    },
  },

  // the bar's ?: this page's guide again (its arrows, its steps), and its ✕
  'explore-again': {
    path: '/explore',
    async run({ page, film, phone }) {
      const q = page.locator('[data-guide="guide"]').first();
      await film.start(phone ? { x: 0, y: 0, width: film.lay.view.width, height: film.lay.view.width / 1.6 } : q, { room: phone ? 1 : 6 });
      await film.wait(800);
      await film.click(q, { after: 300 });
      await guideStill(page);
      await sleep(250);
      await film.cam(await around(page.locator('.sa-guide-card'), page.locator('.sa-guide-arrow')), { room: phone ? 1.02 : 1.15 });
      film.poster();
      await film.still('step1');
      await film.wait(1500);
      await film.click(page.locator('.sa-guide-next').first(), { after: 250 });
      await guideStill(page);
      await sleep(250);
      await film.cam(await around(page.locator('.sa-guide-card'), page.locator('.sa-guide-arrow')), { room: phone ? 1.02 : 1.15 });
      await film.wait(1300);
      await film.still('step2');
      await film.click(page.locator('.sa-guide-x').first(), { after: 900 });
      await film.end(300);
    },
  },

  // Create: how it starts (from a photo, or designed)
  'create-mode': {
    path: '/create',
    async run({ page, film, phone }) {
      const box = page.locator('[data-guide="mode"]').first();
      await box.waitFor();
      await film.start(await topOf(page.locator('.sa-ws-panel'), phone ? 250 : 330), { room: phone ? 1.02 : 1.08 });
      await film.wait(900);
      await film.click(seg(box, 'From a photo'), { after: 1500 });
      film.poster();
      await film.still('photo');
      await film.click(seg(box, 'Design it'), { after: 1300 });
      await film.still('design');
      await film.end(400);
    },
  },

  // its look: a tap picks one (again: unpicked), its age, and More details
  'create-look': {
    path: '/create',
    async run({ page, film, phone }) {
      const box = page.locator('[data-guide="look"]').first();
      await box.waitFor();
      await film.start(await topOf(box, phone ? 230 : 300), { room: phone ? 1.02 : 1.06 });
      await film.wait(600);
      await film.click(chip(page, 'Look', 'Masculine'), { after: 550 });
      await film.click(chip(page, 'Look', 'Masculine'), { after: 550 });
      await film.click(chip(page, 'Look', 'Feminine'), { after: 450 });
      film.poster();
      await film.click(chip(page, 'Age', '20s'), { after: 550 });
      await film.still('picked');
      const more = box.locator('details.sa-more summary').first();
      await film.scrollTo(more, { within: '.sa-ws-body', block: 'start' });
      await film.cam(await partOf(page.locator('details.sa-more').first(), { h: phone ? 220 : 280 }), { room: phone ? 1.02 : 1.06 });
      await film.click(more, { after: 600 });
      await film.click(chip(page, 'Hair style', 'Long'), { after: 1000 });
      await film.still('more');
      await film.end(400);
    },
  },

  // from a photo: tick the box, choose one, it's checked
  'create-photo': {
    path: '/create?mode=picture',
    async run({ page, film, phone }) {
      const box = page.locator('[data-guide="look"]').first();
      await box.locator('.sa-consent').waitFor();
      await film.start(await topOf(box, phone ? 230 : 300), { room: phone ? 1.02 : 1.06 });
      await film.wait(800);
      await film.click(box.locator('.sa-consent label').first(), { dx: 0.08, after: 600 });
      const drop = box.locator('label.sa-drop').first();
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), film.click(drop, { after: 200 })]);
      await chooser.setFiles({ name: 'my-photo.jpg', mimeType: 'image/jpeg', buffer: await look('sofia') });
      await box.locator('.sa-upload-preview img').waitFor();
      await page.waitForFunction(() => /checked and ready/.test(document.querySelector('.sa-up-state')?.textContent || ''), null, { timeout: 20000 });
      await film.scrollTo(box.locator('.sa-upload-preview'), { within: '.sa-ws-body' });
      await film.cam(await around(box.locator('.sa-upload-preview'), box.locator('.sa-up-state')), { room: phone ? 1.02 : 1.1 });
      film.poster();
      await film.wait(1600);
      await film.still('checked');
      await film.end(400);
    },
  },

  // from a photo, how it's made (2026-10-11): 4 looks, just its full body, or the photo as it is (only for a photo of the
  // whole person, head to feet: the check says so), the price on the cards and the button following. The photo is checked
  // before the camera rolls (create-photo films that); the camera stays on the words and the cards (the demo's paintings are
  // waist up: a whole person's photo isn't one of them, so its picture stays out of the picture)
  'create-way': {
    path: '/create?mode=picture',
    async setup({ B }) { B.fake.gemini.picture = { full: true, head: [200, 340, 400, 760] }; },
    async before({ page, phone }) {
      const box = page.locator('[data-guide="look"]').first();
      await box.locator('.sa-consent input').check();
      await page.locator('#sa-pic-file').setInputFiles({ name: 'my-photo.jpg', mimeType: 'image/jpeg', buffer: await body('sofia') });
      await page.waitForFunction(() => /whole person/.test(document.querySelector('.sa-up-state')?.textContent || ''), null, { timeout: 20000 });
      // (the check's words a little below the panel's top: the photo as it is hides its style and words, and a panel scrolled
      // further down would then move up under the camera)
      await page.locator('[data-guide="way"]').first().evaluate((el, phone) => {
        const sc = el.closest('.sa-ws-body');
        const st = phone ? el : sc.querySelector('.sa-up-state') || el;
        sc.scrollTop += st.getBoundingClientRect().top - sc.getBoundingClientRect().top - (phone ? 70 : 110);
      }, phone);
      await sleep(500);
    },
    async run({ page, film, phone }) {
      const way = page.locator('[data-guide="way"]').first();
      const said = page.locator('.sa-up-state').first();
      // (a computer: the check's words and the three ways; a phone's narrower picture: the three ways)
      await film.start(phone ? way : await around(said, way), { room: phone ? 1.02 : 1.06 });
      await film.wait(phone ? 1700 : 1400);
      await film.still('ways');
      await film.click(card(page, 'Just its full body'), { after: phone ? 1500 : 1100 });
      await film.still('body');
      await film.click(card(page, 'Use my photo as it is'), { after: phone ? 1300 : 900 });
      film.poster();
      await film.still('asis');
      // what it costs now, on the button
      const foot = page.locator('.sa-ws-foot').first();
      await film.cam(foot, { room: phone ? 1.02 : 1.2, y: phone ? 0.6 : 0.5 });
      await film.wait(1500);
      await film.still('price');
      await film.end(400);
    },
  },

  // its style (optional: 26 in four sections), its outfit, its vibe
  'create-style': {
    path: '/create',
    async run({ page, film, phone }) {
      const style = page.locator('[data-guide="style"]').first();
      await style.waitFor();
      await style.evaluate((el) => { const sc = el.closest('.sa-ws-body'); sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; });
      await sleep(300);
      await film.start(await topOf(style, phone ? 230 : 280), { room: phone ? 1.02 : 1.08 });
      await film.wait(800);
      await film.click(chip(page, 'Style', 'Film photo'), { after: 700 });
      const anime = style.locator('.sa-chip-sec[data-section="anime"]').first();
      await film.scrollTo(anime, { within: '.sa-ws-body', block: 'start' });
      await film.cam(await topOf(anime, phone ? 230 : 280), { room: phone ? 1.02 : 1.08 });
      await film.wait(300);
      await film.click(chip(page, 'Style', 'Storybook anime'), { after: 800 });
      film.poster();
      await film.still('style');
      const outfit = chip(page, 'Outfit', 'Cozy knit');
      await film.scrollTo(outfit, { within: '.sa-ws-body' });
      await film.click(outfit, { after: 700 });
      const vibe = chip(page, 'Vibe', 'Cheerful');
      await film.scrollTo(vibe, { within: '.sa-ws-body' });
      await film.click(vibe, { after: 900 });
      await film.still('vibe');
      await film.end(400);
    },
  },

  // its name: typed, or Suggest
  'create-name': {
    path: '/create',
    async run({ page, film, phone }) {
      const field = page.locator('[data-guide="name"]').first();
      await field.waitFor();
      await field.evaluate((el) => { const sc = el.closest('.sa-ws-body'); sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 120; });
      await sleep(300);
      await film.start(field, { room: phone ? 1.02 : 1.25 });
      await film.wait(600);
      const suggest = byText(field, 'Suggest');
      await film.click(suggest, { after: 800 });
      await film.click(suggest, { after: 800 });
      await film.still('suggested');
      const input = page.locator('#sa-name');
      await film.click(input, { dx: 0.3, after: 150 });
      await input.fill('');
      await input.pressSequentially('Mira', { delay: 110 });
      film.poster();
      await film.wait(1100);
      await film.still('typed');
      await film.end(400);
    },
  },

  // Create: its price on the button → its 4 looks being made → ready to pick
  'create-go': {
    path: '/create',
    async before({ page }) { await designMira(page); },
    async run({ page, film, phone, B }) {
      const go = page.locator('.sa-ws-foot [data-guide="go"]').first();
      await film.start(page.locator('.sa-ws-foot').first(), { room: phone ? 1.02 : 1.3, y: phone ? 0.6 : 0.5 });
      await film.wait(900);
      await film.click(go, { after: phone ? 150 : 300 });
      const making = page.locator('.sa-making').first();
      await making.waitFor({ timeout: 15000 });
      await sleep(phone ? 200 : 400);
      await film.cam(await partOf(making, { w: phone ? 390 : 880, h: phone ? 240 : 470 }), { room: phone ? 1 : 1.02 });
      await film.wait(1300);
      await film.still('making');
      film.fast(4);
      await finish(page, B, shown(page.locator('.sa-looks[role="radiogroup"]')));
      film.normal();
      await sleep(400);
      await film.cam(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 880, h: phone ? 250 : 470 }), { room: phone ? 1 : 1.02 });
      film.poster();
      await film.wait(1700);
      await film.still('looks');
      await film.end(400);
    },
  },

  // its 4 looks: one picked, "Use this look" → its full body → ready
  'pick-look': {
    path: (state) => `/i/${state.pick.id}`,
    async setup({ B, state }) { await pickState(B, state); },
    async run({ page, film, phone, B }) {
      const looks = page.locator('[data-guide="looks"]').first();
      await looks.waitFor();
      await film.start(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 880, h: phone ? 250 : 470 }), { room: phone ? 1 : 1.02 });
      await film.wait(800);
      await film.click(looks.locator('.sa-look').nth(0), { after: 700 });
      film.poster();
      await film.still('picked');
      await film.click(byText(page, 'Use this look'), { after: 400 });
      await page.locator('.sa-making h2', { hasText: 'Making its full body' }).waitFor({ timeout: 15000 });
      await sleep(250);
      await film.cam(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 620, h: phone ? 240 : 380 }), { room: phone ? 1 : 1.04 });
      await film.wait(1000);
      await film.still('body');
      film.fast(4);
      await finish(page, B, shown(page.locator('.sa-profile .sa-profile-stats')));
      film.normal();
      await sleep(500);
      await film.cam(await partOf(page.locator('.sa-profile').first(), { w: phone ? 390 : 700, h: phone ? 260 : 420 }), { room: phone ? 1 : 1.04 });
      await film.wait(1700);
      await film.still('ready');
      await film.end(400);
    },
  },

  // not quite it: 4 new looks
  'pick-reroll': {
    path: (state) => `/i/${state.pick.id}`,
    async setup({ B, state }) { await pickState(B, state, { next: LOOKS2 }); },
    async run({ page, film, phone, B }) {
      const reroll = page.locator('[data-guide="reroll"]').first();
      await reroll.waitFor();
      await film.start(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 880, h: phone ? 250 : 470 }), { room: phone ? 1 : 1.02 });
      await film.wait(900);
      await film.click(reroll, { after: phone ? 150 : 400 });
      await page.locator('.sa-making h2', { hasText: 'Making its looks' }).waitFor({ timeout: 15000 });
      await sleep(phone ? 150 : 250);
      await film.cam(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 880, h: phone ? 240 : 470 }), { room: phone ? 1 : 1.02 });
      await film.wait(1000);
      await film.still('making');
      film.fast(4);
      await finish(page, B, shown(page.locator('.sa-looks[role="radiogroup"]')));
      film.normal();
      await sleep(400);
      await film.cam(await partOf(page.locator('.sa-making').first(), { w: phone ? 390 : 880, h: phone ? 250 : 470 }), { room: phone ? 1 : 1.02 });
      film.poster();
      await film.wait(1700);
      await film.still('new');
      await film.end(400);
    },
  },

  // what to make: the tools (Photo, Trend, Video, 3D, Coin)
  'make-tools': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone }) {
      const tabs = page.locator('[data-guide="tools"]').first();
      await tabs.waitFor();
      if (phone) {
        await film.start(page.locator('.sa-ws-quick').first(), { room: 1, y: 0.5 });
        await film.wait(700);
        await openDrawer(film, page);
        await film.cam(await topOf(page.locator('.sa-ws-panel'), 240), { room: 1 });
      } else {
        await film.start(await topOf(page.locator('.sa-ws-panel'), 280), { room: 1.08 });
      }
      await film.wait(700);
      for (const id of ['trend', 'video', '3d', 'coin', 'photo']) {
        const t = tabs.locator(`.sa-tooltab[data-tool="${id}"]`);
        if (!(await t.count())) continue;
        await film.click(t, { after: 750 });
        if (id === 'video') film.poster();
      }
      await film.still('tools');
      await film.end(400);
    },
  },

  // the scene: typed, or an idea; references if you like
  'make-scene': {
    path: (state) => `/i/${state.mira.id}`,
    async before({ page, phone }) { await drawerOpen(page, phone); },
    async run({ page, film, phone }) {
      const field = page.locator('[data-guide="scene"]').first();
      await field.waitFor();
      await film.start(field, { room: phone ? 1.02 : 1.12 });
      await film.wait(600);
      const ideas = field.locator('.sa-idea');
      await film.click(ideas.nth(1), { after: 800 });
      await film.click(ideas.nth(0), { after: 800 });
      film.poster();
      await film.still('idea');
      const area = field.locator('textarea');
      await film.click(area, { dx: 0.9, dy: 0.5, after: 150 });
      await page.keyboard.press('End');
      await area.pressSequentially(', a latte in hand', { delay: 70 });
      await film.wait(400);
      const refs = page.locator('.sa-refs').first();
      await film.scrollTo(refs, { within: '.sa-ws-body' });
      await film.cam(refs, { room: phone ? 1.02 : 1.2 });
      await film.hover(refs.locator('.sa-ref-add').first(), { after: 1200 });
      await film.still('refs');
      await film.end(400);
    },
  },

  // the model menu: Classic or Crisp, its quality, its price
  'make-models': {
    path: (state) => `/i/${state.mira.id}`,
    async before({ page, phone }) { await drawerOpen(page, phone); },
    async run({ page, film, phone }) {
      const box = page.locator('[data-guide="models"]').first();
      await box.waitFor();
      await box.evaluate((el) => { const sc = el.closest('.sa-ws-body'); sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; });
      await sleep(300);
      await film.start(await topOf(box, phone ? 230 : 280), { room: phone ? 1.02 : 1.1 });
      await film.wait(600);
      await film.click(card(page, 'Crisp'), { after: 900 });
      film.poster();
      await film.still('crisp');
      await film.click(card(page, 'Classic'), { after: 700 });
      const hd = page.locator('.sa-tool .sa-seg label').filter({ hasText: /^\s*HD\b/ }).first();
      await film.click(hd, { after: 800 });
      await film.cam(page.locator('.sa-ws-foot').first(), { room: phone ? 1.02 : 1.3 });
      await film.wait(1300);
      await film.still('price');
      await film.end(400);
    },
  },

  // Make photo: its price on the button → it's made in Creations, with its progress bar
  'make-go': {
    path: (state) => `/i/${state.mira.id}`,
    async before({ page, phone }) {
      await drawerOpen(page, phone);
      await page.locator('[data-guide="scene"] .sa-idea').first().click();
      await sleep(300);
    },
    async run({ page, film, phone, B }) {
      const go = page.locator('.sa-ws-foot [data-guide="go"]').first();
      await film.start(page.locator('.sa-ws-foot').first(), { room: phone ? 1.02 : 1.3, y: phone ? 0.6 : 0.5 });
      await film.wait(900);
      await film.click(go, { after: 250 });
      await closeDrawer(film, page);
      const tile = page.locator('.sa-inf-gallery .sa-media.is-making').first();
      await tile.waitFor({ timeout: 15000 });
      const id = await tile.getAttribute('id');
      await toMaking(film, page, tile, phone);
      await film.wait(700);
      await film.still('making');
      film.fast(4);
      await finish(page, B, shown(page.locator(`#${id} .sa-media-open`)));
      film.normal();
      await sleep(500);
      await onMade(film, page, page.locator(`#${id}`), phone);
      film.poster();
      await film.wait(1500);
      await film.still('done');
      await film.end(400);
    },
  },

  // Instant: switched on, one tap on an idea makes it
  'make-instant': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone, B }) {
      const sw = page.locator('[data-guide="instant"]').first();
      if (phone) {
        await film.start(page.locator('.sa-ws-quick').first(), { room: 1, y: 0.5 });
        await film.wait(600);
        await openDrawer(film, page);
        await film.cam(await topOf(page.locator('.sa-ws-panel'), 240), { room: 1 });
      } else {
        await film.start(await topOf(page.locator('.sa-ws-panel'), 280), { room: 1.08 });
        await film.wait(700);
      }
      await sw.waitFor();
      await film.click(sw, { after: 800 });
      const cafe = page.locator('.sa-ichip').filter({ hasText: 'Café morning' }).first();
      await cafe.waitFor();
      await film.cam(await topOf(page.locator('.sa-igroup').first(), phone ? 230 : 280), { room: phone ? 1.02 : 1.1 });
      film.poster();
      await film.wait(1000);
      await film.still('ideas');
      await film.click(cafe, { after: 600 });
      await closeDrawer(film, page);
      const tile = page.locator('.sa-inf-gallery .sa-media.is-making').first();
      await tile.waitFor({ timeout: 15000 });
      const id = await tile.getAttribute('id');
      await toMaking(film, page, tile, phone);
      await film.wait(800);
      film.fast(4);
      await finish(page, B, shown(page.locator(`#${id} .sa-media-open`)));
      film.normal();
      await sleep(500);
      await onMade(film, page, page.locator(`#${id}`), phone);
      await film.wait(1300);
      await film.still('done');
      await film.end(400);
    },
  },

  // (2026-10-11) its profile picture: the camera on its picture → its pictures → its full body, the square dragged onto its face
  // and zoomed a little (a computer: the Zoom slider; a phone: two fingers) → Use this picture → its new picture on its page
  'make-pfp': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone }) {
      const camBtn = page.locator('[data-guide="pfp"]').first();
      await camBtn.waitFor();
      const head = page.locator('.sa-profile').first();
      const headView = async () => partOf(head, { w: phone ? 390 : 600, h: phone ? 236 : 330 });
      await film.start(await headView(), { room: phone ? 1 : 1.04 });
      await film.wait(400);
      await film.click(camBtn, { after: phone ? 80 : 250 });
      await upToSheet(film, phone);
      const sh = openSheet(page);
      await sh.locator('.sa-pp-tile').first().waitFor();
      await sleep(300);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 400), { room: phone ? 1.02 : 1.06 });
      await film.wait(450);
      await film.still('pictures');
      const full = sh.locator('.sa-pp-tile').filter({ has: page.locator('.sa-pp-cap', { hasText: exact('Full body') }) }).first();
      await film.click(full, phone ? { after: 0, lead: 240 } : { after: 200 });
      // (2026-10-12) a cut from its tile to its picture, framed: what's between (its stage black while its picture loads, a
      // phone's sheet scrolling to it, the camera still where the tiles were) is left out of the video (see Film.cut). Its
      // picture painted before the cut ends: decoded, then a moment for the screen (on a computer without a graphics card the
      // screen shows what the page did about half a second later)
      film.cut();
      await sh.locator('.sa-framer-stage:not(.is-loading)').first().waitFor();
      const img = sh.locator('.sa-framer-img').first();
      const box = sh.locator('.sa-framer-box').first();
      await painted(page, img);
      // the camera on the picture and its square, at once (and never on the page behind the sheet): a phone's on the top half of
      // its picture, where its face is; a computer's as wide as the sheet, from the picture's top
      const panel = await sheetIn(page).boundingBox();
      const pic = await img.boundingBox();
      const inSheet = (top) => ({ x: panel.x, y: top, width: panel.width, height: panel.width / 1.6 });
      if (phone) await film.cam(img, { room: 1, y: 0.3, dur: 0 });
      else await film.cam(inSheet(pic.y - 14), { room: 1, dur: 0 });
      film.normal();
      // (the sheet's backdrop without its blur while the camera sees only the sheet: see plainBackdrop in guide-record.mjs)
      await film.plainBackdrop(true);
      await film.wait(450);
      // the square dragged onto its face (the demo's painting: its face about 38% down, in the middle), slowly at first (the
      // screen still shows a drag a little after the page takes it)
      const b = await box.boundingBox();
      await film.drag({ x: b.x + b.width / 2, y: b.y + b.height * 0.45 }, { x: pic.x + pic.width * 0.5, y: pic.y + pic.height * 0.385 + b.height * -0.05 }, { ms: 1300, hold: 220, after: 450 });
      // (its poster: the square on its face)
      if (!phone) film.poster();
      // zoomed in a little, around its middle (a computer: the camera down to the Zoom and its previews first, still in the sheet)
      if (phone) {
        const b2 = await box.boundingBox();
        await film.pinch({ x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 }, 58, 72, { ms: 1000, hold: 220, after: 450 });
        film.poster();
      } else {
        const range = sh.locator('.sa-framer-zoom input[type="range"]').first();
        const rb = await range.boundingBox();
        await film.cam(inSheet(rb.y + rb.height + 52 - panel.width / 1.6), { room: 1, dur: 0.6 });
        await film.wait(500);
        const v = Number(await range.inputValue());
        const xAt = (val) => rb.x + 8 + (rb.width - 16) * ((val - 100) / 400);
        await film.drag({ x: xAt(v), y: rb.y + rb.height / 2 }, { x: xAt(v + 45), y: rb.y + rb.height / 2 }, { ms: 900, hold: 200, after: 400, cam: false });
      }
      await film.wait(phone ? 350 : 200);
      await film.still('framed');
      await film.plainBackdrop(false);
      await film.click(byText(sh.locator('.sa-sheet-foot'), 'Use this picture'), { after: 120 });
      // (the camera back on its page at once, while the sheet goes: its new picture there)
      await film.cam(await headView(), { room: phone ? 1 : 1.04, dur: 0.8 });
      await page.waitForFunction(() => !document.querySelector('dialog.sa-sheet[open]'), null, { timeout: 15000 });
      await film.wait(1050);
      await film.still('changed');
      await film.end(400);
    },
  },

  // Creations: one opened (its prompt, Copy prompt), then Captions
  'make-creations': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone }) {
      const gallery = page.locator('[data-guide="creations"]').first();
      await gallery.waitFor();
      await gallery.evaluate((el) => scrollBy({ top: el.getBoundingClientRect().top - 70 }));
      await sleep(400);
      await film.start(await partOf(gallery, { w: phone ? 390 : 640, h: phone ? 240 : 400 }), { room: phone ? 1 : 1.04 });
      await film.wait(700);
      await film.click(aPhoto(page), { after: phone ? 80 : 200 });
      await upToSheet(film, phone);
      await openSheet(page).waitFor();
      if (phone) {
        await sleep(250);
        await film.cam(await topOf(sheetIn(page), 250), { room: 1.02 });
        // (2026-10-12, the editor) its poster once the camera's there and its photo is painted: Make another and Delete over it
        // (taken as the camera set off, it was the blur behind the sheet still coming up)
        await painted(page, openSheet(page).locator('.sa-big-pic').first(), 700);
      } else {
        // (2026-10-12) a computer: a cut to its photo, big (a black box while it loaded was in the video, and was its poster)
        film.cut();
        await painted(page, openSheet(page).locator('.sa-big-pic').first());
        await film.cam(await topOf(sheetIn(page), 420), { room: 1.06, dur: 0 });
        film.normal();
      }
      film.poster();
      await film.wait(800);
      await film.still('photo');
      const prompt = openSheet(page).locator('.sa-prompt').first();
      await film.scrollTo(prompt, { within: '.sa-sheet-in' });
      await film.cam(prompt, { room: phone ? 1.02 : 1.2 });
      await film.click(prompt.locator('button').first(), { after: 900 });
      await film.click(byText(openSheet(page).locator('.sa-sheet-foot'), 'Captions'), { after: phone ? 80 : 200 });
      await upToSheet(film, phone);
      await openSheet(page).locator('.sa-caption').first().waitFor();
      await sleep(150);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 360), { room: phone ? 1.02 : 1.06 });
      await film.wait(700);
      await film.click(openSheet(page).locator('.sa-caption button').first(), { after: 1100 });
      await film.still('caption');
      await film.end(400);
    },
  },

  // My studio: credits (and Buy credits), the holder perks beside it
  'me-credits': {
    path: '/me',
    async run({ page, film, phone }) {
      const credits = page.locator('[data-guide="credits"]').first();
      await credits.waitFor();
      await page.waitForFunction(() => !/…/.test(document.querySelector('.sa-stat-credits .sa-stat-big')?.textContent || '…'));
      await film.start(credits, { room: phone ? 1.02 : 1.12 });
      await film.wait(1200);
      film.poster();
      await film.click(byText(credits, 'Buy credits'), { after: 600 });
      await openSheet(page).waitFor();
      await sleep(250);
      await film.cam(await topOf(sheetIn(page), phone ? 240 : 260), { room: phone ? 1.02 : 1.06 });
      await film.wait(400);
      await film.click(openSheet(page).locator('.sa-amount').nth(2), { after: 800 });
      const pay = openSheet(page).locator('.sa-pay').first();
      await film.scrollTo(pay, { within: '.sa-sheet-in' });
      await film.cam(pay, { room: phone ? 1.02 : 1.12 });
      await film.wait(1500);
      await film.still('pay');
      await film.end(400);
    },
  },

  // My studio: your influencers, one opened
  'me-infs': {
    path: '/me',
    async run({ page, film, phone }) {
      const mine = page.locator('[data-guide="mine"]').first();
      await mine.locator('.sa-person:not(.sa-person-new)').first().waitFor();
      await mine.evaluate((el) => scrollBy({ top: el.getBoundingClientRect().top - 80 }));
      await sleep(400);
      await film.start(await partOf(mine, { w: phone ? 390 : 640, h: phone ? 240 : 400 }), { room: phone ? 1 : 1.04 });
      await film.wait(1100);
      film.poster();
      await film.click(mine.locator('.sa-person:not(.sa-person-new)').first(), { after: 500 });
      await page.locator('.sa-profile .sa-profile-stats').first().waitFor();
      await sleep(400);
      await film.cam(await partOf(page.locator('.sa-profile').first(), { w: phone ? 390 : 700, h: phone ? 260 : 420 }), { room: phone ? 1 : 1.04 });
      await film.wait(1700);
      await film.still('opened');
      await film.end(400);
    },
  },

  // gifts and invites: your invite link and how invites went, then a gift link made
  'me-gifts': {
    path: '/me',
    async run({ page, film, phone }) {
      const gifts = page.locator('[data-guide="gifts"]').first();
      await gifts.locator('.sa-link-box').first().waitFor({ timeout: 15000 });
      await gifts.evaluate((el) => scrollBy({ top: el.getBoundingClientRect().top - 80 }));
      await sleep(400);
      await film.start(await partOf(gifts, { w: phone ? 390 : 640, h: phone ? 240 : 360 }), { room: phone ? 1 : 1.04 });
      await film.wait(1600);
      await film.still('invite');
      // giving: its own part of the card (what you can give, to a wallet or as a link)
      const make = byText(gifts, 'Make a gift link');
      const give = gifts.locator('.sa-gift-part').filter({ has: page.locator('button, a').filter({ hasText: exact('Make a gift link') }) }).first();
      await film.scrollTo(give);
      await film.cam(await partOf(give, { w: phone ? 390 : 560, h: phone ? 230 : 210 }), { room: phone ? 1.02 : 1.08 });
      await film.wait(700);
      await film.click(make, { after: 150 });
      await openSheet(page).waitFor();
      await sleep(200);
      await film.cam(await topOf(sheetIn(page), phone ? 240 : 300), { room: phone ? 1.02 : 1.06 });
      await film.wait(400);
      await film.click(openSheet(page).locator('.sa-idea').filter({ hasText: exact('500') }).first(), { after: 600 });
      await film.click(byText(openSheet(page), 'Make the link'), { after: 150 });
      await openSheet(page).locator('.sa-gift-hero').first().waitFor({ timeout: 15000 });
      await sleep(150);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 330), { room: phone ? 1.02 : 1.06 });
      film.poster();
      await film.wait(1500);
      await film.still('link');
      await film.end(400);
    },
  },

  // Help & support: the helper answers
  'me-help': {
    path: '/me',
    async run({ page, film, phone }) {
      const help = page.locator('[data-guide="help"]').first();
      await help.waitFor();
      await help.evaluate((el) => scrollBy({ top: el.getBoundingClientRect().top - 100 }));
      await sleep(400);
      await film.start(await partOf(help, { w: phone ? 390 : 520, h: 200 }), { room: phone ? 1.02 : 1.08 });
      await film.wait(800);
      await film.click(byText(help, 'Get help'), { after: 800 });
      const quick = page.locator('.sa-help-quick .sa-idea').first();
      await quick.waitFor();
      await sleep(300);
      await film.cam(await around(page.locator('.sa-help-ask, .sa-help-box').first(), page.locator('.sa-help-quick').first()), { room: phone ? 1.02 : 1.08 });
      await film.wait(600);
      await film.click(quick, { after: 400 });
      await page.locator('.sa-help-text').first().waitFor({ timeout: 15000 });
      await sleep(300);
      await film.cam(page.locator('.sa-help-item').first(), { room: phone ? 1.02 : 1.12 });
      film.poster();
      await film.wait(2000);
      await film.still('answer');
      await film.end(400);
    },
  },

  // a trend video: a trend clip picked (its prompt to copy) → made → it plays
  'make-trend': {
    path: (state) => `/i/${state.mira.id}`,
    async before({ page, phone }) { await drawerOpen(page, phone); await toolNow(page, 'trend'); },
    async run({ page, film, phone, B }) {
      const grid = page.locator('.sa-trend-grid').first();
      await grid.waitFor();
      await film.start(await topOf(grid, phone ? 230 : 300), { room: phone ? 1.02 : 1.08 });
      await film.wait(700);
      await film.click(grid.locator('.sa-trend').nth(3), { after: 800 });
      film.poster();
      await film.still('picked');
      await film.click(page.locator('.sa-ws-foot [data-guide="go"]').first(), { after: 500 });
      await closeDrawer(film, page);
      const tile = page.locator('.sa-inf-gallery .sa-media.is-making').first();
      await tile.waitFor({ timeout: 15000 });
      const id = await tile.getAttribute('id');
      await toMaking(film, page, tile, phone);
      await film.wait(800);
      film.fast(5);
      await finish(page, B, shown(page.locator(`#${id} .sa-media-open`)));
      film.normal();
      await sleep(300);
      await film.click(page.locator(`#${id} .sa-media-open`), { cam: false, after: 80 });
      await upToSheet(film, phone);
      await openSheet(page).waitFor();
      await sleep(phone ? 250 : 100);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 420), { room: phone ? 1.02 : 1.06 });
      await onVideo(film, page, phone);
      await film.still('playing');
      await film.end(400);
    },
  },

  // a video: its model, an idea → made → it plays
  'make-video': {
    path: (state) => `/i/${state.mira.id}`,
    async before({ page, phone }) { await drawerOpen(page, phone); await toolNow(page, 'video'); },
    async run({ page, film, phone, B }) {
      const models = page.locator('[data-guide="models"]').first();
      await models.waitFor();
      await film.start(await topOf(models, phone ? 230 : 280), { room: phone ? 1.02 : 1.1 });
      await film.wait(800);
      const idea = page.locator('[data-guide="scene"] .sa-idea').first();
      await film.scrollTo(idea, { within: '.sa-ws-body' });
      await film.click(idea, { after: 700 });
      film.poster();
      await film.still('idea');
      await film.click(page.locator('.sa-ws-foot [data-guide="go"]').first(), { after: 500 });
      await closeDrawer(film, page);
      const tile = page.locator('.sa-inf-gallery .sa-media.is-making').first();
      await tile.waitFor({ timeout: 15000 });
      const id = await tile.getAttribute('id');
      await toMaking(film, page, tile, phone);
      await film.wait(800);
      film.fast(5);
      await finish(page, B, shown(page.locator(`#${id} .sa-media-open`)));
      film.normal();
      await sleep(300);
      await film.click(page.locator(`#${id} .sa-media-open`), { cam: false, after: 80 });
      await upToSheet(film, phone);
      await openSheet(page).waitFor();
      await sleep(phone ? 250 : 100);
      await film.cam(await topOf(sheetIn(page), phone ? 250 : 420), { room: phone ? 1.02 : 1.06 });
      await onVideo(film, page, phone);
      await film.still('playing');
      await film.end(400);
    },
  },

  // (2026-10-12, the editor) the photo editor, Learn's lesson on photos: one of her photos opened → "Edit photo" → (a computer:
  // cropped square) a filter, her words and a sticker on it → saved as a new photo next to it ("Edited"). A computer's camera
  // sees its photo and its tools together; a phone's goes from its tools to its photo (a phone's screen has its photo on top,
  // its tools under it)
  // (2026-10-12) at most 14 s: the photo in view before the camera rolls (no scroll to it), a computer's cut while its photo
  // loads, no crop step, and a computer's editing a little faster (its cursor travels further than a phone's taps)
  'make-editor': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone }) {
      const gallery = page.locator('[data-guide="creations"]').first();
      await gallery.waitFor();
      const photo = aPhoto(page);
      await photo.waitFor();
      await photo.evaluate((el, top) => scrollBy({ top: el.getBoundingClientRect().top - top }), phone ? 150 : 170);
      await sleep(400);
      const g = await gallery.boundingBox(), p = await photo.boundingBox();
      await film.start({ x: g.x, y: Math.max(0, p.y - (phone ? 70 : 110)), width: Math.min(g.width, phone ? 390 : 640), height: phone ? 240 : 400 },
        { room: phone ? 1 : 1.04 });
      await film.wait(250);
      await film.click(photo, { after: phone ? 80 : 200 });
      await upToSheet(film, phone);
      const big = openSheet(page);
      await big.waitFor();
      const row = big.locator('.sa-edit-row').first();
      if (phone) {
        await painted(page, big.locator('.sa-big-pic').first(), 300);
        await film.cam(row, { room: 1.02 });
      } else {
        // (a cut to its photo, big: a black box while it loads was in the video)
        film.cut();
        await painted(page, big.locator('.sa-big-pic').first(), 400);
        await film.cam(row, { room: 1.6, dur: 0 });
        film.normal();
      }
      await film.wait(300);
      await film.click(row.locator('button').filter({ hasText: exact('Edit photo') }), { after: 100, lead: phone ? 200 : 0 });
      // a cut to the editor, its photo drawn (the sheet going and the next one coming up are left out)
      film.cut();
      const ed = page.locator(`${SHEET} .sa-pe`).last();
      await ed.locator('.sa-pe-stage:not(.is-loading)').waitFor();
      await sleep(900);
      const canvas = ed.locator('.sa-pe-canvas').first();
      const panel = ed.locator('.sa-pe-panel').first();
      // (a computer: its photo and its tools; a phone: its photo, then the camera down to its tools for each tap)
      const whole = async () => around(canvas, panel);
      const onPhoto = async (y = 0.5, dur = 0.55) => { await film.cam(canvas, { room: 1, y, dur }); await film.wait(650); };
      const tab = (name) => panel.locator('[role="tab"]').filter({ hasText: exact(name) }).first();
      const press = (target, after, more = {}) => film.click(target, { after, ...(phone ? {} : { hold: 160 }), ...more });
      if (phone) await film.cam(canvas, { room: 1, dur: 0 });
      else await film.cam(await whole(), { room: 1.02, dur: 0 });
      film.normal();
      await film.wait(350);
      if (!phone) film.fast(1.45);
      await press(tab('Filters'), phone ? 150 : 250);
      await press(panel.locator('.sa-pe-filter').filter({ hasText: exact('Warm') }).first(), phone ? 60 : 320);
      if (phone) await onPhoto(0.45);
      await film.still('warm');
      await press(tab('Text'), phone ? 150 : 250);
      const words = panel.locator('.sa-pe-add input').first();
      await press(words, 120, { dx: 0.3 });
      await words.pressSequentially('Sunday mood', { delay: 45 });
      await press(panel.locator('.sa-pe-add button').first(), phone ? 60 : 380);
      if (phone) await onPhoto(0.8);
      film.poster();
      await film.still('words');
      await press(tab('Stickers'), phone ? 150 : 250);
      await press(panel.locator('.sa-pe-sticker').filter({ hasText: '✨' }).first(), phone ? 60 : 420);
      if (phone) await onPhoto(0.42);
      await film.still('sticker');
      if (!phone) film.normal();
      // saved: a new photo next to it (its tile says "Edited"), the camera back on her creations
      await film.click(page.locator(`${SHEET} .sa-pe-save`).last(), { after: 100 });
      film.cut();
      await page.waitForFunction(() => !document.querySelector('dialog.sa-sheet[open]'), null, { timeout: 20000 });
      const fresh = gallery.locator('.sa-media').filter({ has: page.locator('.sa-media-tag', { hasText: 'Edited' }) }).first();
      await fresh.waitFor({ timeout: 15000 });
      await painted(page, fresh.locator('img').first(), 500);
      await fresh.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await film.cam(await partOf(gallery, { w: phone ? 390 : 640, h: phone ? 240 : 400 }), { room: phone ? 1 : 1.04, dur: 0 });
      await film.follow(fresh, { dur: 0 });
      film.normal();
      await film.wait(950);
      await film.still('saved');
      await film.end(300);
    },
  },

  // (2026-10-12, the editor) the video editor, Learn's lesson on videos: one of her videos opened → "Edit video" → its part
  // trimmed (its start dragged on), Square, her words on it → saved as a new video next to it ("Edited"), made by our clock
  // (here: the clock's own code, with ffmpeg making VP9: this Chromium plays no H.264; sped up) → done, her words on its
  // picture. A computer's camera sees its video and its tools together; a phone's goes from its tools to its video
  // (at most 14 s: a cut while its video loads, a computer's editing a little faster, the clock's minute much faster, and the
  // clip ends on the new video in her creations, as the photo editor's does)
  'make-cut': {
    path: (state) => `/i/${state.mira.id}`,
    async run({ page, film, phone, B }) {
      const gallery = page.locator('[data-guide="creations"]').first();
      await gallery.waitFor();
      const vid = aVideo(page);
      await vid.waitFor();
      await vid.evaluate((el, top) => scrollBy({ top: el.getBoundingClientRect().top - top }), phone ? 150 : 170);
      await sleep(400);
      const g = await gallery.boundingBox(), v = await vid.boundingBox();
      const galleryView = (y) => ({ x: g.x, y: Math.max(0, y), width: Math.min(g.width, phone ? 390 : 640), height: phone ? 240 : 400 });
      await film.start(galleryView(v.y - (phone ? 70 : 110)), { room: phone ? 1 : 1.04 });
      await film.wait(250);
      await film.click(vid, { after: phone ? 80 : 150 });
      await upToSheet(film, phone);
      const big = openSheet(page);
      await big.waitFor();
      const row = big.locator('.sa-edit-row').first();
      // (a cut to its video, playing: a black box while it loads was in the video)
      film.cut();
      await playingNow(page, big.locator('.sa-player').first(), 400);
      await film.cam(row, { room: phone ? 1.02 : 1.6, dur: 0 });
      film.normal();
      await film.wait(250);
      await film.click(row.locator('button').filter({ hasText: exact('Edit video') }), { after: 100, lead: phone ? 200 : 0 });
      // a cut to the editor, its video there (the sheet going and the next one coming up are left out)
      film.cut();
      const ed = page.locator(`${SHEET} .sa-ve`).last();
      await ed.locator('.sa-ve-stage:not(.is-loading)').waitFor({ timeout: 15000 });
      await playingNow(page, ed.locator('.sa-ve-video').first(), 700);
      const frame = ed.locator('.sa-ve-frame').first();
      const panel = ed.locator('.sa-pe-panel').first();
      const whole = async () => around(ed.locator('.sa-ve-stage').first(), panel);
      const onClip = async (y = 0.5, ms = 450) => { await film.cam(frame, { room: 1, y, dur: 0.5 }); await film.wait(ms); };
      const tab = (name) => panel.locator('[role="tab"]').filter({ hasText: exact(name) }).first();
      const press = (target, after, more = {}) => film.click(target, { after, ...(phone ? {} : { hold: 140 }), ...more });
      // Trim: its start dragged on to about a second in (its part: the rest of it)
      const startR = panel.locator('.sa-pe-range').filter({ has: page.locator('label', { hasText: exact('Start') }) }).locator('input[type="range"]').first();
      if (phone) {
        await startR.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await sleep(300);
        await film.cam(startR, { room: 1.6, dur: 0 });
      } else await film.cam(await whole(), { room: 1.02, dur: 0 });
      film.normal();
      await film.wait(300);
      if (!phone) film.fast(1.7);
      const rb = await startR.boundingBox();
      const max = Number(await startR.getAttribute('max')) || 3;
      const xAt = (val) => rb.x + 9 + (rb.width - 18) * (val / max);
      await film.drag({ x: xAt(0), y: rb.y + rb.height / 2 }, { x: xAt(Math.min(max, 1)), y: rb.y + rb.height / 2 }, { ms: 700, hold: 150, after: 250, cam: false });
      await film.still('trimmed');
      // Shape: Square (its frame over the whole video)
      await press(tab('Shape'), phone ? 120 : 200);
      await press(seg(panel, 'Square 1:1'), phone ? 60 : 320);
      if (phone) await onClip(0.5);
      await film.still('square');
      // Text: her words on it
      await press(tab('Text'), phone ? 120 : 200);
      const words = panel.locator('.sa-pe-add input').first();
      await press(words, 100, { dx: 0.3 });
      await words.pressSequentially('Sunset walk', { delay: 35 });
      await press(panel.locator('.sa-pe-add button').first(), phone ? 60 : 350);
      if (phone) await onClip(0.62, 800);
      film.poster();
      await film.still('words');
      if (!phone) film.normal();
      // saved: a new video next to it, made by our clock (much faster), then done
      // (a phone: its finger on Save a moment before the cut, so the tap shows)
      await film.click(page.locator(`${SHEET} .sa-pe-save`).last(), { after: 100, lead: phone ? 250 : 0 });
      film.cut();
      await page.waitForFunction(() => !document.querySelector('dialog.sa-sheet[open]'), null, { timeout: 20000 });
      const tile = gallery.locator('.sa-media.is-making').first();
      await tile.waitFor({ timeout: 15000 });
      const id = (await tile.getAttribute('id')).replace(/^v-/, '');
      await tile.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await film.cam(await partOf(gallery, { w: phone ? 390 : 640, h: phone ? 240 : 400 }), { room: phone ? 1 : 1.04, dur: 0 });
      await film.follow(tile, { dur: 0 });
      film.normal();
      await film.wait(700);
      film.fast(12);
      const made = await B.tick(id, { encode: true, run: cutRun, deadline: Date.now() + 45_000 });
      if (made?.state !== 'done') throw new Error(`the cut wasn't made: ${JSON.stringify(made)}`);
      await finish(page, B, shown(page.locator(`#v-${id} .sa-media-open`)));
      // its poster: a frame of it, made by the page (her words on it)
      const cover = page.locator(`#v-${id} img.sa-media-pic[src*="poster"]`).first();
      await cover.waitFor({ timeout: 15000 }).catch(() => {});
      if (await cover.count()) await painted(page, cover, 300);
      await film.follow(page.locator(`#v-${id}`).first(), { dur: 0.3 });
      film.normal();
      await film.wait(1100);
      await film.still('made');
      await film.end(300);
    },
  },
};
