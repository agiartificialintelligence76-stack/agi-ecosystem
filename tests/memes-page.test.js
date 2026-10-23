// Memes (2026-10-23, the owner: "create a MEMES tab here on top and on her world, put it in another page … ALL, IMAGES,
// VIDEOS, SLOPCORE … make sure they can watch and download it")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { MEMES, TABS, fileOf, thumbOf, downloadName, clock } from '../src/memes/list.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pub = (p) => new URL(`../public${p}`, import.meta.url);

test('memes: its own page, built, previewed and in the top bar and footer of every page', () => {
  const page = read('memes.html');
  assert.match(page, /<script type="module" src="\/src\/memes\/page\.js"><\/script>/);
  assert.ok(!/<script>|style="/.test(page), 'no inline scripts or styles (the security rules block them)');
  assert.match(page, /<a href="\/memes" aria-current="page">Memes<\/a>/);
  assert.match(page, /<link rel="canonical" href="__SITE__\/memes" \/>/);
  assert.match(read('vite.config.js'), /memes: 'memes\.html'/, 'the build makes it');
  assert.match(read('scripts/share-pages.js'), /'dist\/memes\.html'/, 'its link preview gets the address');
  for (const f of ['index.html', 'diary.html', 'games.html', 'giveaway.html', 'launch.html', 'live.html', 'roadmap.html', 'stake.html']) {
    const s = read(f);
    const nav = s.slice(s.indexOf('id="site-nav"'), s.indexOf('</nav>', s.indexOf('id="site-nav"')));
    assert.match(nav, /<a href="\/memes">Memes<\/a>/, `${f}: in the top bar, on computers too (not nav-phone)`);
    const foot = s.slice(s.indexOf('class="foot-nav"'), s.indexOf('</nav>', s.indexOf('class="foot-nav"')));
    assert.match(foot, /<a href="\/memes">Memes<\/a>/, `${f}: in the footer`);
  }
});

test('memes: the four tabs, and every meme has its files (web copy, card picture) and a title', () => {
  assert.deepEqual(TABS.map((t) => t.key), ['all', 'image', 'video', 'slopcore']);
  assert.deepEqual(TABS.map((t) => t.label.toUpperCase()), ['ALL', 'IMAGES', 'VIDEOS', 'SLOPCORE']);
  const ids = new Set();
  for (const m of MEMES) {
    assert.ok(!ids.has(m.id), `${m.id}: one of each`); ids.add(m.id);
    assert.ok(['image', 'video', 'slopcore'].includes(m.kind), `${m.id}: a known kind`);
    assert.ok(m.title && m.title.length < 70, `${m.id}: a short title`);
    if (existsSync(pub('/memes'))) {   // the files are made by tools/memes/encode.ps1
      assert.ok(existsSync(pub(fileOf(m))), `${m.id}: ${fileOf(m)}`);
      assert.ok(existsSync(pub(thumbOf(m))) && statSync(pub(thumbOf(m))).size > 0, `${m.id}: ${thumbOf(m)}`);
      assert.ok(statSync(pub(fileOf(m))).size < 95 * 1024 * 1024, `${m.id}: under GitHub's 100 MB limit`);
    }
    assert.match(downloadName(m), /^agi-[a-z0-9-]+\.(mp4|jpg)$/, `${m.id}: a clean download name`);
    if (m.kind !== 'image') assert.ok(m.secs > 0, `${m.id}: its length`);
  }
  for (const k of ['image', 'video', 'slopcore']) assert.ok(MEMES.some((m) => m.kind === k), `at least one ${k}`);
  assert.equal(clock(239), '3:59');
  assert.equal(clock(7), '0:07');
});

test('memes: the page script and its look follow the site\'s rules', () => {
  const js = read('src/memes/page.js');
  const css = read('src/styles/memes.css');
  assert.match(js, /startTheme\(\);\s*startMenu\(\);/, 'the theme and the phone menu, like every page');
  assert.match(js, /showModal\(\)/, 'the viewer is a real dialog (focus stays inside, Esc closes it)');
  assert.match(js, /removeAttribute\('src'\)/, 'a closed video stops downloading');
  // the owner, 2026-10-23: "so they dont have to scroll down really long and add load more"
  assert.match(js, /'mm-more-btn'/, 'each group has a Load more button');
  assert.match(js, /FIRST_ROWS = \{ all: 2, tab: 3 \}/, 'a few full rows first');
  assert.match(css, /\.mm-tab\[aria-selected='true'\] \{ background: #c6f24e;/, 'the open tab is the lime pill from the owner\'s picture');
  assert.match(css, /\.mm-card\[hidden\]/, 'the cards not loaded yet stay hidden');
  assert.ok(!/\.style\.cssText|setAttribute\('style'/.test(js), 'no style attributes (the CSP)');
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}@]+(?=\{)/g) || []) {
    const sel = rule.trim();
    if (!sel || /^(from|to|\d+%)$/.test(sel) || /^(keyframes|media|supports) /.test(sel) || /^(max-width|prefers)/.test(sel)) continue;
    assert.match(sel, /\.mm-/, `memes.css rule "${sel}" names an mm- class`);
  }
});
