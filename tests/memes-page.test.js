// Memes (2026-10-23, the owner: "create a MEMES tab here on top and on her world, put it in another page … ALL, IMAGES,
// VIDEOS, SLOPCORE … make sure they can watch and download it")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { MEMES, TABS, fileOf, thumbOf, downloadName, clock } from '../src/memes/list.js';
import { MEDIA_PUBLIC_ROOT } from '../src/owner/media-model.js';
import { memeShare } from '../server/meme-share.js';
import { GET } from '../api/wallet.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pub = (p) => new URL(`../public${p}`, import.meta.url);
const shareContent = (memes = []) => ({ getContent: async () => Response.json({ document: { memes } }) });

test('meme previews accept hosting rewrite path parameters in either order and reject duplicate selections', async () => {
  const saved = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    for (const query of ['meme-share=vlad&id=vlad', 'id=vlad&meme-share=vlad']) {
      const response = await GET(new Request(`https://agi1.app/api/wallet?${query}`));
      assert.equal(response.status, 200);
      assert.match(await response.text(), /memes\/share\/agi-vlad\.jpg/);
    }
    assert.equal((await GET(new Request('https://agi1.app/api/wallet?meme-share=vlad&meme-share=other'))).status, 400);
  } finally {
    if (saved === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved;
  }
});

test('meme share previews identify the selected video and image before JavaScript runs', async () => {
  const video = await memeShare({}, 'vlad', shareContent());
  assert.equal(video.status, 200);
  assert.match(video.headers.get('content-type'), /text\/html/);
  const html = await video.text();
  assert.match(html, /property="og:title" content="AGI × Vlad/);
  assert.match(html, /property="og:image" content="https:\/\/agi1\.app\/memes\/share\/agi-vlad\.jpg"/);
  assert.match(html, /name="twitter:image" content="https:\/\/agi1\.app\/memes\/share\/agi-vlad\.jpg"/);
  assert.match(html, /property="og:url" content="https:\/\/agi1\.app\/share\/meme\/vlad"/);
  assert.match(html, /rel="canonical" href="https:\/\/agi1\.app\/share\/meme\/vlad"/);
  assert.match(html, /data-go="\/memes\?m=vlad"/);
  const picture = MEMES.find(m => m.kind === 'image');
  const pictureHtml = await (await memeShare({}, picture.id, shareContent())).text();
  assert.ok(pictureHtml.includes(`content="https://agi1.app${fileOf(picture)}"`));
});

test('meme share previews support owner uploads and escape saved titles', async () => {
  const uuid = '12345678-1234-4234-8234-123456789abc';
  const id = `upload-${uuid}`;
  const thumb = `${MEDIA_PUBLIC_ROOT}12345678-1234-4234-8234-123456789abd.jpg`;
  const entry = { id, custom: true, kind: 'video', title: 'A "title" <script>alert(1)</script> & more', note: '', src: `${MEDIA_PUBLIC_ROOT}${uuid}.mp4`, thumb, secs: 12 };
  const response = await memeShare({}, id, shareContent([entry]));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes(`content="${thumb}"`));
  assert.ok(html.includes('&quot;title&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; more'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  const image = { ...entry, kind: 'image', src: `${MEDIA_PUBLIC_ROOT}${uuid}.png`, thumb: '', secs: 0 };
  const imageHtml = await (await memeShare({}, id, shareContent([image]))).text();
  assert.ok(imageHtml.includes(`content="${image.src}"`));
});

test('meme share previews do not expose hidden or unknown items or cache storage failures', async () => {
  assert.equal((await memeShare({}, 'vlad', shareContent([{ id: 'vlad', hidden: true }]))).status, 404);
  assert.equal((await memeShare({}, 'missing-meme', shareContent())).status, 404);
  assert.equal((await memeShare({}, '../vlad', shareContent())).status, 400);
  const unavailable = await memeShare({}, 'vlad', { getContent: async () => Response.json({ error: 'busy' }, { status: 503 }) });
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.headers.get('cache-control'), /no-store/);
});

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
