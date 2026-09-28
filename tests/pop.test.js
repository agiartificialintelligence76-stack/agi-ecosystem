// Pop mode (2026-09-27, the owner's idea): the whole page in the $AGI ecosystem site's look (agi1.app), same content, off
// until the visitor presses its button. These checks keep it that way: the button on both pages, the default look untouched
// (every Pop mode style is scoped to [data-skin="pop"]), its fonts self-hosted and licensed, the decoration only repeating
// what the page already says, and the choice applied before the page paints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const diary = read('diary.html');
const css = read('src/styles/pop.css');

test('Pop mode: a button next to the theme button on both pages, off by default, and a row in the small-phone menu', () => {
  for (const [name, page] of [['index.html', html], ['diary.html', diary]]) {
    const actions = page.slice(page.indexOf('<div class="topbar-actions">'), page.indexOf('</header>'));
    const theme = actions.indexOf('data-theme-toggle'), pop = actions.indexOf('data-skin-toggle');
    assert.ok(theme > 0 && pop > theme, `${name}: the Pop mode button comes right after the theme button`);
    assert.ok(actions.indexOf('data-open-chat') > pop || name === 'diary.html', `${name}: before Try AGI-1`);
    assert.match(actions, /<button class="icon-btn skin-toggle" type="button" data-skin-toggle aria-pressed="false" aria-label="Pop mode" title="[^"]+">/,
      `${name}: a real toggle button (pressed or not), named for screen readers, off at first`);
    const nav = page.slice(page.indexOf('<nav class="nav" id="site-nav"'), page.indexOf('</nav>', page.indexOf('id="site-nav"')));
    assert.ok(nav.includes('<button class="nav-pop" type="button" data-skin-toggle aria-pressed="false">Pop mode <span class="nav-pop-state mono" aria-hidden="true">Off</span></button>'),
      `${name}: the menu's Pop mode row (for screens under 380 px, where the top bar has no room for the button)`);
    assert.doesNotMatch(page.match(/<html[^>]*>/)[0], /data-skin/, `${name}: off by default (only /theme.js turns it on, from the visitor's own choice)`);
    assert.ok(!/<script>|style="/.test(page), `${name}: no inline scripts or styles (the security rules block them)`);
  }
  assert.match(diary, /<html lang="en" data-page="diary">/, 'the diary page says which page it is (its browser-bar color in Pop mode)');
});

test('Pop mode: the ribbons are decoration (hidden from screen readers) and only repeat what the page already says', () => {
  const start = html.indexOf('<div class="pop-ribbons" aria-hidden="true">');
  assert.ok(start > 0, 'the ribbons are hidden from screen readers');
  const end = html.indexOf('</div>\n', html.indexOf('pop-ribbon-b', start)) + 6;
  const ribbons = html.slice(start, end);
  const rest = (html.slice(0, start) + html.slice(end)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const phrases = [...ribbons.matchAll(/<span>([^<]+)<\/span>/g)].flatMap((m) => m[1].split(/[✦♥]/)).map((p) => p.trim()).filter(Boolean);
  assert.ok(phrases.length >= 10, `${phrases.length} phrases`);
  for (const p of new Set(phrases)) assert.ok(rest.includes(p.toLowerCase()), `"${p}" is already on the page`);
  assert.doesNotMatch(ribbons, /\b(buy|moon|pump|profit|gains?|100x|ape)\b/i, 'no money talk');
});

// every rule in pop.css, with the at-rule it sits in (a small parser: comments out, then blocks one by one)
function rules(source) {
  const out = [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (s, at) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const head = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (depth && j < s.length) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      const body = s.slice(open + 1, j - 1);
      if (/^@(media|supports)/.test(head)) walk(body, head);
      else out.push({ at, head, body });
      i = j;
    }
  };
  walk(text, '');
  return out;
}

// a selector list, split at its top-level commas (not the ones inside :is(…))
function splitList(list) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) { out.push(list.slice(from, i).trim()); from = i + 1; }
  }
  out.push(list.slice(from).trim());
  return out;
}

test('Pop mode never changes the default look: every rule is scoped to [data-skin="pop"], except a few shared ones', () => {
  // the only rules that apply without Pop mode: its fonts (downloaded only when used), hiding its extras, the ribbons'
  // own parts (inside the hidden ribbons), its button's icon size, and room for the new button on small phones
  const shared = new Set(['@font-face', '.pop-ribbons, .nav-pop', '.skin-toggle svg', '.pop-ribbon', '.pop-ribbon-a', '.pop-ribbon-b',
    '.pop-ribbon-track', '.pop-ribbon-track span', '.pop-ribbon-b .pop-ribbon-track', 'to', '.topbar-actions .icon-btn', '.topbar-actions',
    '.topbar-actions .skin-toggle', '.topbar.menu-open .nav-pop', '.nav-pop-state', ".nav-pop[aria-pressed='true'] .nav-pop-state"]);
  const all = rules(css);
  assert.ok(all.length > 300, `${all.length} rules`);
  const loose = [];
  for (const { at, head } of all) {
    if (head.startsWith('@keyframes')) continue;
    if (shared.has(head)) continue;
    for (const selector of splitList(head)) {
      if (!/^(:root)?\[data-skin='pop'\]/.test(selector)) loose.push(`${at} ${selector}`.trim());
    }
  }
  assert.deepEqual(loose, [], 'unscoped rules');
  // the shared small-phone rules only size things (never colors or fonts), so the default look stays the same
  for (const { head, body } of all) {
    if (['.topbar-actions .icon-btn', '.topbar-actions', '.topbar-actions .skin-toggle'].includes(head)) {
      assert.doesNotMatch(body, /color|background|font|border/, `${head} only sizes`);
    }
  }
  assert.doesNotMatch(css, /@import|url\(\s*['"]?(https?:)?\/\//, 'nothing from other sites (fonts are self-hosted)');
  for (const { at, head, body } of all) {
    if (body.includes('!important')) assert.match(at, /prefers-reduced-motion: reduce/, `${head}: !important only to switch motion off`);
  }
});

test('Pop mode: both pages load its styles, and its two fonts are self-hosted with their licenses', () => {
  for (const entry of ['src/main.js', 'src/diary.js']) assert.match(read(entry), /import '\.\/styles\/pop\.css';/, `${entry} imports pop.css`);
  const faces = [...css.matchAll(/@font-face\s*{([^}]+)}/g)].map((m) => m[1]);
  assert.equal(faces.length, 2, 'Anybody and Instrument Serif');
  for (const face of faces) {
    const file = face.match(/url\('(\/fonts\/[^']+\.woff2)'\)/)[1];
    const bytes = readFileSync(new URL(`../public${file}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${file} is a real WOFF2 font`);
    assert.ok(bytes.length < 80_000, `${file} is small (${bytes.length} bytes)`);
    assert.match(face, /font-display: swap/, 'text shows at once, in a fallback font, while it loads');
  }
  for (const license of ['Anybody-OFL.txt', 'InstrumentSerif-OFL.txt']) {
    const path = new URL(`../public/fonts/${license}`, import.meta.url);
    assert.ok(existsSync(path), `${license} is there`);
    assert.match(readFileSync(path, 'utf8'), /SIL Open Font License/, `${license} is the SIL Open Font License`);
  }
});

// /theme.js (runs in <head>) in a sandbox: what it sets for each saved choice, system setting and page
function prepaint({ skin, theme, systemDark = false, page = null, storage = true }) {
  const attrs = page ? { 'data-page': page } : {};
  const meta = { content: '#fafaf8', setAttribute(k, v) { this[k] = v; } };
  const root = { setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null };
  const store = { 'dr-skin': skin, 'dr-theme': theme };
  const localStorage = storage ? { getItem: (k) => store[k] ?? null } : { getItem() { throw new Error('private mode'); } };
  vm.runInNewContext(read('public/theme.js'), {
    localStorage, window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: root, querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null) },
  });
  return { skin: attrs['data-skin'] ?? null, theme: attrs['data-theme'], bar: meta.content };
}

test('Pop mode is applied before the page paints, only when the visitor turned it on, with the browser bar to match', async () => {
  // src/theme.js expects a browser: give it the little it reads when it loads
  globalThis.document ??= { documentElement: { dataset: {} }, querySelector: () => null, querySelectorAll: () => [] };
  globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
  const { barColor } = await import('../src/theme.js');
  assert.equal(prepaint({ skin: null, theme: 'light' }).skin, null, 'off by default');
  for (const odd of ['lab', 'POP', 'pop ', '1', 'true']) assert.equal(prepaint({ skin: odd, theme: 'light' }).skin, null, `"${odd}" isn't Pop mode`);
  assert.equal(prepaint({ skin: 'pop', theme: null, storage: false }).skin, null, 'private mode: the default look, no error');
  for (const page of [null, 'diary']) {
    for (const [theme, systemDark] of [['light', false], ['dark', false], [null, true], [null, false]]) {
      for (const skin of ['pop', null]) {
        const got = prepaint({ skin, theme, systemDark, page });
        const expectTheme = theme || (systemDark ? 'dark' : 'light');
        assert.equal(got.theme, expectTheme);
        assert.equal(got.skin, skin === 'pop' ? 'pop' : null);
        assert.equal(got.bar, barColor(skin === 'pop' ? 'pop' : 'lab', expectTheme, page === 'diary'), `${page || 'home'} · ${expectTheme} · ${skin || 'lab'}: the same color as the page's own script`);
      }
    }
  }
  // the colors themselves: the default look's background; in Pop mode the violet hero (home) or the page (diary)
  assert.equal(barColor('lab', 'light', false), '#fafaf8');
  assert.equal(barColor('lab', 'dark', true), '#0b0b0c');
  assert.equal(barColor('pop', 'light', false), '#6b3bff');
  assert.equal(barColor('pop', 'dark', false), '#2a0f7a');
  assert.equal(barColor('pop', 'light', true), '#f8f5ff');
  assert.equal(barColor('pop', 'dark', true), '#120828');
  assert.match(css, /\[data-skin='pop'\] \.hero \{[^}]*background: var\(--pop-violet\)/, 'the hero is that violet');
  assert.match(css, /\[data-skin='pop'\]\[data-theme='dark'\] \.hero \{ background: #2a0f7a; \}/, '…and that deep violet at night');
});

test('Pop mode: the phone menu starts where each look needs it (the CSS decides; the menu script follows)', () => {
  const layout = read('src/styles/layout.css'), menu = read('src/menu.js');
  assert.match(layout, /@media \(max-width: 920px\) {\n  \.menu-btn { display: inline-grid; }/, 'the default look: up to 920 px');
  assert.match(css, /@media \(min-width: 921px\) and \(max-width: 1040px\) {\n  \[data-skin='pop'\] \.menu-btn { display: inline-grid; }/, 'Pop mode: up to 1040 px');
  assert.match(css, /@media \(min-width: 1041px\) {\n  \[data-skin='pop'\] \.nav {/, 'Pop mode: the pill of links from 1041 px');
  assert.match(menu, /\['\(min-width: 921px\)', '\(min-width: 1041px\)'\]/, 'the menu closes when its links fit again');
  assert.match(menu, /addEventListener\('agi:skin', closeIfWide\)/, '…also when Pop mode is switched off');
});

test('Pop mode: switching keeps your place (2026-09-27: it used to show another part of the page)', () => {
  const theme = read('src/theme.js');
  // both buttons switch through keepPlace(): note what's in the middle of the screen, switch, scroll it back to the same spot
  assert.match(theme, /\[data-skin-toggle\]'\)\) \{\n    button\.addEventListener\('click', \(\) => keepPlace\(\(\) => applySkin\(/, 'the Pop mode buttons');
  assert.match(theme, /button\.addEventListener\('click', \(\) => keepPlace\(\(\) => apply\(currentTheme\(\)/, 'the theme button (Pop mode\'s night look has thinner outlines)');
  assert.match(theme, /if \(scrollY < 1\) return null;/, 'at the very top it stays at the top');
  assert.match(theme, /cs\.position === 'sticky' \|\| cs\.position === 'fixed'/, 'never holds on to something that stays put on the screen (the top bar, her live view strip)');
  assert.match(theme, /behavior: 'instant'/, 'jumps at once (the page otherwise scrolls smoothly)');
  assert.match(theme, /const POP_FONTS = \['900 1em Anybody', 'italic 400 1em "Instrument Serif"'\];/, 'once more when Pop mode\'s fonts arrive…');
  assert.match(theme, /if \(!touched\) restore\(spot\);/, '…unless the visitor scrolled or pressed something meanwhile');
  // the fonts it waits for are the ones pop.css uses
  assert.match(css, /font-family: 'Anybody';[\s\S]*?font-weight: 100 900;/);
  assert.match(css, /font-family: 'Instrument Serif';[\s\S]*?font-style: italic;/);
});
