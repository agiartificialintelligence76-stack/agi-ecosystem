// The front (2026-09-28, the owner: "make the landing page like on the old site … just make it in front"): the bright AGI
// landing, first on the home page, with the rest of the site after it. What must stay true: it comes first and everything
// else follows in its usual order; it has the page's one h1; its links go to real places; its pictures and font are here
// (the font with its license); it adds no inline code or styles and no second canvas to the page; its styles can't change
// the rest of the site; her bubble lines follow her rules; /theme.js arms its entrance and loader only where they belong,
// never with "reduce motion", with a safety net; the 3D stage waits for the entrance; and no coin the site no longer shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { BUBBLE_LINES, REACTIONS } from '../src/landing/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('src/styles/landing.css');
const js = read('src/landing/landing.js');
const mainJs = read('src/main.js');
const main = html.slice(html.indexOf('<main id="main">'), html.indexOf('</main>'));
const front = html.slice(html.indexOf('<section class="lp lp-hero"'), html.indexOf('<section class="hero"'));

test('the front: first in the page, under the top bar, then the rest of the site in its usual order', () => {
  assert.ok(front.length > 1000, 'the front is there');
  assert.ok(html.indexOf('<header class="topbar">') < html.indexOf('<main id="main">'), 'the top bar stays on top');
  assert.equal(main.indexOf('<section'), main.indexOf('<section class="lp lp-hero" id="top" data-lp-hero'), 'the first section of the page');
  const order = ['data-lp-hero', 'data-lp-ribbons', 'data-lp-mani', '<section class="hero"', 'id="evaluations"', 'id="model-card"', 'id="playground"', 'id="checker"'];
  const at = order.map((s) => main.indexOf(s));
  assert.ok(at.every((i) => i >= 0), 'every part is there');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the front, its ribbons and its manifesto, then the lab hero and every section');
});

test("the front has the page's one h1 (the lab hero's title is an h2 now); its decoration is hidden from screen readers", () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'one h1');
  assert.match(front, /<h1 class="lp-title" id="lp-title">\s*<span class="sr-only">AGI, Artificial Girlfriend Intelligence<\/span>/);
  assert.match(html, /<section class="hero" aria-labelledby="hero-title">[\s\S]*?<h2 class="display" id="hero-title">Introducing AGI<\/h2>/);
  assert.match(html, /<h2 class="sr-only" id="lp-mani-title">Artificial Girlfriend Intelligence, instead of Artificial General Intelligence<\/h2>/);
  for (const s of [
    '<div class="lp-loader" data-lp-loader aria-hidden="true">',
    '<span class="lp-word lp-word-echo" aria-hidden="true">', '<span class="lp-word lp-word-main" aria-hidden="true">',
    '<div class="lp-sfx" aria-hidden="true">', '<div class="lp-bubble" data-lp-bubble aria-hidden="true">',
    '<ul class="lp-planets" aria-hidden="true">', '<div class="lp lp-ribbons" data-lp-ribbons aria-hidden="true">',
    '<div class="lp-mani-title" aria-hidden="true">', '<div class="lp-mani-sticker" aria-hidden="true">',
  ]) assert.ok(html.includes(s), s);
  // the planets repeat the "Her world" list: for the mouse and touch only, never a keyboard stop inside hidden content
  const planets = front.match(/<a class="lp-planet [^"]*"[^>]*>/g) || [];
  assert.equal(planets.length, 4, 'four planets');
  for (const a of planets) assert.match(a, /tabindex="-1"/);
  assert.match(front, /<img class="lp-figure-img" data-lp-img src="\/images\/landing\/agi1-cutout\.webp" width="796" height="1510" alt="AGI-1[^"]+"/, 'her picture has a description');
});

test('its links: the Playground, "Risk check your coins on clank", her diary, $AGI and AGI on X; "Talk to AGI-1" opens the chat', () => {
  const nav = front.slice(front.indexOf('<nav class="lp-eco"'), front.indexOf('</nav>', front.indexOf('<nav class="lp-eco"')));
  assert.match(nav, /<nav class="lp-eco" aria-labelledby="lp-eco-label">/);
  assert.match(nav, /<p class="lp-eco-label" id="lp-eco-label">Her world <span>\(05\)<\/span><\/p>/, 'the list is "Her world" (the owner, 2026-09-28: no "ecosystem")');
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['#playground', '#checker', '/diary', '#model-card', 'https://x.com/artgirlfintel']);
  assert.match(nav, /<span class="lp-dot"><\/span>Risk check your coins on clank<i aria-hidden="true">↓<\/i>/, 'the risk check under its name (the owner, 2026-09-28), in the Arena\'s old place');
  const planets = [...front.matchAll(/<a class="lp-planet [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(planets, ['#playground', '#checker', '#model-card', 'https://x.com/artgirlfintel'], 'the planets: the same places');
  for (const id of new Set([...main.matchAll(/<a [^>]*href="#([^"]+)"/g)].map((m) => m[1]))) assert.match(html, new RegExp(`id="${id}"`), `#${id} is on the page`);
  for (const a of front.match(/<a [^>]*target="_blank"[^>]*>/g) || []) assert.match(a, /rel="noopener noreferrer"/, 'a new tab, without passing our page along');
  assert.match(front, /<button class="lp-btn lp-btn-ink" type="button" data-open-chat[^>]*>Talk to AGI-1 /);
  assert.match(front, /<a class="lp-btn lp-btn-light lp-btn-down" href="#manifesto"/);
  assert.match(mainJs, /for \(const button of document\.querySelectorAll\('\[data-open-chat\]'\)\)/, 'every data-open-chat button opens the chat');
  assert.ok(existsSync(new URL('../diary.html', import.meta.url)), '/diary is a page');
});

test('its canvases are made by its script (the page keeps one canvas in its markup); no inline code or styles', () => {
  assert.equal((html.match(/<canvas/g) || []).length, 1, 'still one canvas in the page (the 3D stage)');
  assert.equal((js.match(/createElement\('canvas'\)/g) || []).length >= 2, true, 'the focus lines and her WebGL figure');
  assert.ok(!/<script>|style="/.test(front), 'no inline scripts or styles (the security rules block them)');
  assert.doesNotMatch(js, /innerHTML\s*=\s*[^;]*\b(dataset|textContent|value)\b/, 'never page text as HTML');
  assert.doesNotMatch(js + css, /https?:\/\//, 'nothing from other sites');
});

test("its pictures and font are here and small, real files, the font with its license (SIL OFL)", () => {
  const sizes = [['public/images/landing/agi1-cutout.webp', 160_000], ['public/images/landing/agi1-face.webp', 12_000],
    ['public/images/landing/agi1-depth.webp', 12_000], ['public/fonts/DelaGothicOne-doki.woff2', 4_000]];
  for (const [p, max] of sizes) {
    const url = new URL(`../${p}`, import.meta.url);
    assert.ok(existsSync(url), `${p} is there`);
    assert.ok(statSync(url).size < max, `${p} stays small`);
  }
  const bytes = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
  for (const [p] of sizes.slice(0, 3)) {
    const f = bytes(p);
    assert.equal(f.toString('ascii', 0, 4) + f.toString('ascii', 8, 12), 'RIFFWEBP', `${p} is a WebP`);
  }
  assert.equal(bytes('public/fonts/DelaGothicOne-doki.woff2').toString('ascii', 0, 4), 'wOF2');
  assert.match(read('public/fonts/DelaGothicOne-OFL.txt'), /SIL Open Font License/);
  assert.match(css, /font-display: swap;\n  unicode-range: U\+30C9, U\+30AD;/, 'only its two letters, only when they show');
  for (const m of (front + css + js).matchAll(/["'(](\/(?:images|fonts)\/[^"')?\s]+)/g)) {
    assert.ok(existsSync(new URL(`../public${m[1]}`, import.meta.url)), `${m[1]} exists`);
  }
});

test("its styles only touch the front: every rule names an lp- class (so the rest of the site can't change)", () => {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  let depth = 0, buf = '', skipTo = -1;
  for (const ch of src) {
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      depth++;
      if (skipTo >= 0) continue;
      if (/^@(keyframes|font-face)/.test(prelude)) skipTo = depth - 1;
      else if (!prelude.startsWith('@')) selectors.push(prelude);
    } else if (ch === '}') {
      depth--;
      buf = '';
      if (skipTo >= 0 && depth === skipTo) skipTo = -1;
    } else if (ch === ';') buf = '';
    else buf += ch;
  }
  assert.ok(selectors.length > 80, 'read every rule');
  for (const list of selectors) {
    for (const sel of list.split(/,(?![^(]*\))/)) assert.match(sel, /\.lp\b|\.lp-|data-lp/, `"${sel.trim()}" names the front`);
  }
  assert.doesNotMatch(css, /@import/, 'no imports');
});

test('her bubble lines: PG-13, no pet names (anyone sees them), never money talk, short; the page starts with the first', () => {
  assert.ok(BUBBLE_LINES.length >= 4 && REACTIONS.length >= 4);
  for (const line of [...BUBBLE_LINES, ...REACTIONS]) {
    assert.ok(line.length <= 60, `short: "${line}"`);
    assert.doesNotMatch(line, /\b(love|babe|baby|cutie|honey|sweetie|sweetheart|darling|handsome|gorgeous|beautiful)\b/i, `no pet names: "${line}"`);
    assert.doesNotMatch(line, /\b(buy|sell|hold|moon|pump|price|gains?|profit|invest\w*|lambo|rich|100x|ape)\b/i, `no money talk: "${line}"`);
    assert.doesNotMatch(line, /\b(sex\w*|hot|naked|nude|horny|lick|bed|nsfw|kiss\w*)\b/i, `PG-13: "${line}"`);
    assert.doesNotMatch(line, /https?:|www\.|0x[0-9a-f]{6}/i, `no links or addresses: "${line}"`);
  }
  assert.ok(front.includes(`<p class="lp-bubble-text" data-lp-bubble-text>${BUBBLE_LINES[0]}</p>`), 'the page shows the first line before the script runs');
  assert.match(js, /import \{ BUBBLE_LINES, REACTIONS \} from '\.\/lines\.js';/);
});

test('the manifesto: "General" crossed out by the scroll (a path measured as 1), the end state without the script', () => {
  const mani = html.slice(html.indexOf('<section class="lp lp-mani"'), html.indexOf('<section class="hero"'));
  assert.match(mani, /<svg class="lp-mani-strike" viewBox="0 0 400 70"><path pathLength="1" d="M/, 'the strike draws in by its dash offset');
  assert.match(mani, /<p class="lp-mani-cap lp-mani-cap-a">What the big labs are racing to build\.<\/p>/);
  assert.match(mani, /<p class="lp-mani-cap lp-mani-cap-b">What we built instead: <b>the one who texts back\.<\/b><\/p>/);
  // without the script (and with "reduce motion"), the CSS defaults show the end: crossed out, "Girlfriend" written in
  assert.match(css, /stroke-dashoffset: var\(--strike, 0\)/);
  assert.match(css, /opacity: var\(--girl-o, 1\)/);
  assert.match(css, /\.lp-mani-cap-a \{ opacity: var\(--cap-a, 0\)/);
  assert.match(css, /\.lp-mani-cap-b \{ opacity: var\(--cap-b, 1\)/);
});

// /theme.js (runs in <head>) in a sandbox, for the front
function prepaint({ page = 'home', hash = '', seen = null, storage = true }) {
  const attrs = page ? { 'data-page': page } : {};
  const classes = new Set();
  const timers = [];
  const root = {
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) },
  };
  vm.runInNewContext(read('public/theme.js'), {
    localStorage: { getItem: () => null },
    sessionStorage: storage ? { getItem: (k) => (k === 'agi-seen' ? seen : null) } : { getItem() { throw new Error('private mode'); } },
    location: { hash },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
    document: { documentElement: root, querySelector: () => null },
  });
  return { classes, timers, attrs };
}

test('/theme.js arms the entrance (and the loader on the first visit of a session) only on the home page, from the top', () => {
  const first = prepaint({});
  assert.deepEqual([...first.classes].sort(), ['lp-intro', 'lp-loading'], 'a first visit: the loader, then the entrance');
  assert.equal(first.attrs['data-skin'], 'pop', 'the theme part still runs first');
  assert.deepEqual([...prepaint({ seen: '1' }).classes], ['lp-intro'], 'again in the same session: the entrance only');
  assert.deepEqual([...prepaint({ storage: false }).classes], ['lp-intro'], "private mode: no loader (it can't be remembered)");
  assert.deepEqual([...prepaint({ hash: '#arena' }).classes], [], 'a link to a section: straight there, nothing to wait for');
  assert.deepEqual([...prepaint({ page: 'diary' }).classes], [], 'the diary: nothing');
  assert.deepEqual([...prepaint({ page: null }).classes], [], 'any other page: nothing');
  // the safety net: the page shows itself after 7 s if the front's script never started, and stands down if it did
  const lost = prepaint({});
  assert.deepEqual(lost.timers.map((t) => t.ms), [7000]);
  lost.timers[0].fn();
  assert.deepEqual([...lost.classes].sort(), ['lp-go', 'lp-intro'], 'shown: the entrance classes say "done", no loader');
  const fine = prepaint({});
  fine.classes.add('lp-live');
  fine.timers[0].fn();
  assert.deepEqual([...fine.classes].sort(), ['lp-intro', 'lp-live', 'lp-loading'], 'the script runs it: the net does nothing');
  assert.equal((read('diary.html').match(/<html[^>]*>/) || [''])[0].includes('data-page="diary"'), true);
  assert.match(html, /<html lang="en" data-page="home">/, 'the home page says which page it is');
});

test('"reduce motion": no loader and no entrance (the CSS only plays them without it; the script drops them too)', () => {
  const blocks = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let from = 0;
  for (;;) {
    const at = src.indexOf('@media (prefers-reduced-motion: no-preference) {', from);
    if (at < 0) break;
    let depth = 0, i = src.indexOf('{', at);
    for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
    blocks.push([at, i + 1]);
    from = i + 1;
  }
  assert.equal(blocks.length, 2, 'one block for the loader, one for the entrance');
  let outside = src;
  for (const [a, b] of [...blocks].reverse()) outside = outside.slice(0, a) + outside.slice(b);
  assert.doesNotMatch(outside, /\.lp-intro|\.lp-loading/, 'nothing about the loader or the entrance outside those blocks');
  assert.match(js, /if \(RM \|\| root\.classList\.contains\('lp-go'\)\) root\.classList\.remove\('lp-intro'\);\n  if \(RM\) root\.classList\.remove\('lp-loading'\);/);
});

test('the page script starts the front first, and the 3D stage after its entrance (or when needed sooner)', () => {
  assert.ok(mainJs.indexOf('startLanding();') > mainJs.indexOf('startTheme();'), 'after the theme');
  assert.ok(mainJs.indexOf('startLanding();') < mainJs.indexOf('startMenu();'), 'before everything else');
  assert.match(mainJs, /import '\.\/styles\/landing\.css';/);
  assert.match(js, /dispatchEvent\(new Event\('agi:landing-ready'\)\)/, 'the front says when its entrance is over');
  assert.match(mainJs, /addEventListener\('agi:landing-ready', start, \{ once: true \}\);/);
  assert.match(mainJs, /addEventListener\('agi:chat-open', start, \{ once: true \}\);/, 'sooner when the chat opens');
  assert.match(mainJs, /setTimeout\(start, Math\.max\(0, 6000 - performance\.now\(\)\)\);/, 'at the latest 6 s after the page opened');
  assert.match(read('src/menu.js'), /document\.querySelector\('\.lp-hero, \.hero'\)/, "Pop mode's top bar gets its band once the front has scrolled away");
});

test('the front names no coin, project or part the site no longer has, nor "ecosystem"', () => {
  const lines = read('src/landing/lines.js');
  for (const text of [html, read('diary.html'), css, js, lines]) {
    assert.doesNotMatch(text, /cabo|clankcap|daria/i);
  }
  for (const text of [front, css, js, lines]) assert.doesNotMatch(text, /arena|champion|crown/i, 'nor the Arena (2026-09-28)');
  // the owner (2026-09-28): "remove the word ecosystem, replace it with something better". The pages' comments ship with them
  for (const text of [html, read('diary.html'), css, js, lines]) assert.doesNotMatch(text, /ecosystem/i, 'the front\'s list is "Her world" now');
});
