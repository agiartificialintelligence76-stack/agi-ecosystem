// Full-screen talk and the AGI-1 app (2026-10-02, the owner: "a full screen button on the chat … agi-1 will be in full
// screen on the right and her chat will be on the left", then "a windows app and mac app … make this better then
// continue"). agi1.app/talk is the home page in another layout (src/chat/fullscreen.js, src/styles/fullscreen.css), decided
// before the page paints (/theme.js); the app is this site installed from the browser (public/manifest.webmanifest,
// src/chat/install.js), opening there. These checks keep its address, its first paint, its manifest and icons, its
// buttons and its promise ("we never send app files") as they should be. The layout itself is checked in a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('src/styles/fullscreen.css');

// the light DOM these modules touch when they're imported in Node
globalThis.document ??= { documentElement: { dataset: {}, classList: { contains: () => false } }, querySelector: () => null, querySelectorAll: () => [] };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });

test('its address: agi1.app/talk (and /talk/), the home page at another address, on the same site', async () => {
  const { isTalkPath, TALK_PATH, TALK_TITLE } = await import('../src/chat/fullscreen.js');
  assert.equal(TALK_PATH, '/talk');
  assert.equal(TALK_TITLE, 'Talk to AGI-1 · AGI');
  for (const yes of ['/talk', '/talk/']) assert.equal(isTalkPath(yes), true, yes);
  for (const no of ['/', '', '/talks', '/talkative', '/talk/x', '/Talk', '/diary', '/launch/abc', undefined, null]) assert.equal(isTalkPath(no), false, String(no));
  // Vercel serves the home page there (a rewrite to its clean address, never a .html one: cleanUrls is on)
  const vercel = JSON.parse(read('vercel.json'));
  for (const source of ['/talk', '/talk/']) {
    assert.deepEqual(vercel.rewrites.find((r) => r.source === source), { source, destination: '/' }, `${source} → the home page`);
  }
  for (const r of vercel.rewrites) assert.doesNotMatch(r.destination, /\.html$/);
  // the same security headers as every page (no new domain: the app is the site), and the icons cached a day
  assert.equal(vercel.headers[0].source, '/(.*)');
  assert.doesNotMatch(vercel.headers[0].headers[0].value, /manifest-src/, 'the manifest uses the site’s default source');
  assert.match(vercel.headers[0].headers[0].value, /worker-src 'self' blob:;/, 'the 3D renderer only uses local workers');
  assert.ok(vercel.headers.some((h) => h.source === '/icons/(.*)' && /max-age=86400/.test(h.headers[0].value)));
  // and `npm run dev` / `vite preview` serve it too
  assert.match(read('vite.config.js'), /if \(\/\^\\\/talk\\\/\?\$\/\.test\(path\)\) req\.url = /);
});

// /theme.js (runs in <head>) in a sandbox
function prepaint({ path = '/', page = 'home', skin = null, theme = null, hash = '' }) {
  const attrs = page ? { 'data-page': page } : {};
  const classes = new Set();
  const doc = { title: 'Introducing AGI · Artificial Girlfriend Intelligence' };
  const meta = { content: '#fafaf8', setAttribute(k, v) { this[k] = v; } };
  const root = {
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) },
  };
  Object.assign(doc, { documentElement: root, querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null) });
  vm.runInNewContext(read('public/theme.js'), {
    localStorage: { getItem: (k) => ({ 'dr-skin': skin, 'dr-theme': theme })[k] ?? null },
    sessionStorage: { getItem: () => null },
    location: { pathname: path, hash },
    setTimeout: () => {},
    document: doc,
  });
  return { classes, title: doc.title, bar: meta.content, skin: attrs['data-skin'] ?? null, theme: attrs['data-theme'] };
}

test('/theme.js: at /talk the page starts in full-screen talk before it paints (no loader, no entrance), with its title and bar color', async () => {
  const { barColor } = await import('../src/theme.js');
  const talk = prepaint({ path: '/talk' });
  assert.deepEqual([...talk.classes], ['is-talk'], 'full-screen talk, and not the front\'s loader or entrance (the front isn\'t shown)');
  assert.equal(talk.title, 'Talk to AGI-1 · AGI');
  assert.deepEqual([...prepaint({ path: '/talk/' }).classes], ['is-talk']);
  for (const skin of [null, 'pop', 'lab']) {
    for (const theme of [null, 'dark', 'light']) {
      const got = prepaint({ path: '/talk', skin, theme });
      assert.equal(got.bar, barColor(got.skin === 'pop' ? 'pop' : 'lab', got.theme, false, true), `${skin}/${theme}: the same color as src/theme.js`);
    }
  }
  assert.equal(barColor('pop', 'dark', false, true), '#1a0d3d', 'Pop mode at night: the Playground\'s deep violet');
  assert.equal(barColor('pop', 'light', false, true), '#e4d9ff', 'Pop mode: the Playground\'s lavender');
  assert.equal(barColor('lab', 'dark', false, true), '#0b0b0c');
  assert.equal(barColor('pop', 'dark', false), '#2a0f7a', 'the home page as before');
  // the rest of the site as before
  const home = prepaint({ path: '/' });
  assert.ok(home.classes.has('lp-intro') && !home.classes.has('is-talk'), 'the home page: the front\'s entrance, not full-screen talk');
  assert.equal(home.title, 'Introducing AGI · Artificial Girlfriend Intelligence');
  assert.equal(prepaint({ path: '/talk', page: 'diary' }).classes.size, 0, 'only the home page has it');
  for (const page of ['index.html', 'diary.html', 'launch.html', 'live.html']) assert.match(read(page), /<script src="\/theme\.js\?v=8"><\/script>/, `${page}: the new /theme.js (browsers keep the old one a day)`);
});

test('the ways in: in the Playground only (never the crowded top bar), as links to /talk', () => {
  const links = html.match(/<a [^>]*data-talk-open[^>]*>/g) || [];
  assert.equal(links.length, 2, 'two: the "Talk full screen" button in the Playground\'s heading, the ⤢ on her live view');
  for (const a of links) assert.match(a, /href="\/talk"/, 'a real link (Ctrl-click or a middle click: a new tab)');
  const playground = html.slice(html.indexOf('<section class="section" id="playground"'), html.indexOf('</section>', html.indexOf('<div class="pg" data-playground>')));
  const head = playground.slice(0, playground.indexOf('</header>'));
  assert.match(head, /data-talk-open><svg[^]*?<\/svg>Talk full screen<\/a>/);
  assert.match(head, /<button class="btn btn-ghost btn-sm" type="button" data-app-open>[^]*Get the AGI-1 app<\/button>/);
  const topbar = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>', html.indexOf('<header class="topbar">')));
  assert.doesNotMatch(topbar, /data-talk-open|data-app-open|\/talk/, 'nothing new in the top bar');
  // in her live view: the ⤢, and her buttons for full-screen talk (shown only there): the app, the browser's full screen, back
  const cam = html.slice(html.indexOf('<div class="pg-cam" data-cam hidden>'), html.indexOf('<div class="pg-log"'));
  assert.match(cam, /<a class="pg-cam-full" href="\/talk" data-talk-open aria-label="Talk to her full screen" title="Full screen">/);
  assert.match(cam, /<div class="pg-talk-ctl" role="group" aria-label="Full-screen talk">/);
  assert.match(cam, /<button class="pg-talk-btn pg-talk-app" type="button" data-app-open>[^]*<span>Get the app<\/span><\/button>/);
  assert.match(cam, /<button class="pg-talk-btn" type="button" data-talk-fs aria-label="Full screen" title="Full screen" hidden>/, 'shown where the browser has full screen');
  assert.match(cam, /<button class="pg-talk-btn" type="button" data-talk-close aria-label="Back to the site" title="Back to the site">/);
  assert.ok(cam.indexOf('pg-talk-ctl') < cam.indexOf('data-call'), 'before the Call button (the keyboard\'s order: top, then bottom)');
  assert.doesNotMatch(html, /<script>|\sstyle=|\son[a-z]+=/i, 'no inline code (the CSP)');
  assert.equal(html.match(/<canvas/g).length, 1, 'still one canvas: the stage\'s, which moves into her big view');
});

test('the AGI-1 app: a manifest that opens full-screen talk, her icons, and nothing to download', async () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, 'AGI-1');
  assert.equal(m.short_name, 'AGI-1');
  assert.equal(m.id, '/talk');
  assert.equal(m.start_url, '/talk', 'it opens straight into full-screen talk');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone', 'her own window');
  assert.ok(!('prefer_related_applications' in m), 'no store app to send people to');
  const { barColor } = await import('../src/theme.js');
  assert.equal(m.theme_color, barColor('pop', 'dark', false, true), 'the title bar: the default look\'s color around her');
  assert.equal(m.background_color, m.theme_color);
  assert.match(m.description, /18\+/);
  assert.match(m.description, /not financial advice/);
  // Chrome and Edge install a site with a 192 px and a 512 px icon (and use a "maskable" one for round or squircle shapes)
  const sizes = (file) => { const b = readFileSync(new URL(`../public${file}`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20), b]; };
  const want = [['/icons/agi1-192.png', 192, 'any'], ['/icons/agi1-512.png', 512, 'any'], ['/icons/agi1-maskable-512.png', 512, 'maskable']];
  assert.deepEqual(m.icons.map((i) => [i.src, Number(i.sizes.split('x')[0]), i.purpose]), want);
  for (const icon of m.icons) {
    assert.equal(icon.type, 'image/png');
    const [w, h, bytes] = sizes(icon.src);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', `${icon.src} is a real PNG`);
    assert.deepEqual([w, h], icon.sizes.split('x').map(Number), `${icon.src} is ${icon.sizes}`);
    assert.ok(bytes.length < 150_000, `${icon.src} stays small (${bytes.length} bytes)`);
  }
  // the page: its manifest, Apple's icon and name (iPhone's Home Screen, the Mac's Dock)
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/agi1-180\.png" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="AGI-1" \/>/);
  assert.deepEqual(sizes('/icons/agi1-180.png').slice(0, 2), [180, 180]);
  assert.ok(!existsSync(new URL('../public/sw.js', import.meta.url)), 'no service worker (not needed to install, and one can serve an old site after a push)');
  // the app's screen: what it is, and the promise against fake downloads (a classic crypto scam)
  const dlg = html.slice(html.indexOf('<dialog class="wdlg appdlg" data-app-dialog'), html.indexOf('</dialog>', html.indexOf('data-app-dialog')));
  assert.match(dlg, /Her own window, straight into full-screen talk\./);
  assert.match(dlg, /straight into talking with her\. Free, nothing from an app store, and it updates itself\./);
  assert.match(dlg, /18\+, PG-13, not financial advice\./);
  assert.match(dlg, /It only ever comes from agi1\.app: we never send app files or download links in messages, on Telegram or on X, so an “AGI-1 download” from anyone else isn't us\./);
  assert.match(dlg, /<button class="btn btn-primary btn-sm" type="button" data-appdlg-install hidden>Install AGI-1<\/button>/);
  assert.match(dlg, /role="status" aria-live="polite"/);
  // and the safety note says it too (every sentence there stays true)
  const foot = html.slice(html.indexOf('<footer class="foot"'), html.indexOf('</footer>'));
  assert.match(foot, /The AGI-1 app is this website installed from your browser \(“Get the AGI-1 app”\), and it only ever comes from agi1\.app: we never send app files or download links in messages, on Telegram or on X, so an “AGI-1 download” from anyone else isn't ours\./);
});

test('how each browser installs her: the right words for Chrome, Edge, Safari on a Mac, iPhones and iPads, Android, Firefox', async () => {
  const { installHow, HOW_WORDS } = await import('../src/chat/install.js');
  const UA = {
    chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
    firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0',
    telegramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/12.0',
    x: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/11.0',
    webview: 'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36',
  };
  assert.equal(installHow({ ua: UA.chromeWin }), 'desktop', 'Chrome before it offers its prompt: its menu');
  assert.equal(installHow({ ua: UA.chromeWin, prompt: true }), 'prompt', 'Chrome offered it: our Install button');
  assert.equal(installHow({ ua: UA.edge, prompt: true }), 'prompt');
  assert.equal(installHow({ ua: UA.edge }), 'desktop');
  assert.equal(installHow({ ua: UA.chromeMac }), 'desktop');
  assert.equal(installHow({ ua: UA.safariMac, platform: 'MacIntel', touchPoints: 0 }), 'mac-safari');
  assert.equal(installHow({ ua: UA.safariMac, platform: 'MacIntel', touchPoints: 5 }), 'ios', 'an iPad (it says "Macintosh")');
  assert.equal(installHow({ ua: UA.iphone }), 'ios');
  assert.equal(installHow({ ua: UA.chromeIos, prompt: false }), 'ios', 'any iPhone browser: Share → Add to Home Screen');
  assert.equal(installHow({ ua: UA.android }), 'android');
  assert.equal(installHow({ ua: UA.android, prompt: true }), 'prompt');
  assert.equal(installHow({ ua: UA.firefox }), 'firefox');
  assert.equal(installHow({ ua: UA.firefoxAndroid }), 'android', 'Firefox on Android can add to the home screen');
  assert.equal(installHow({ ua: UA.chromeWin, standalone: true, prompt: true }), 'installed', 'inside the app itself');
  assert.equal(installHow({ ua: 'curl/8' }), 'other');
  for (const inapp of ['telegramIos', 'x', 'webview']) assert.equal(installHow({ ua: UA[inapp], prompt: true }), 'inapp', `${inapp}: a link opened inside an app can't install anything: open it in the browser`);
  for (const key of ['prompt', 'desktop', 'mac-safari', 'ios', 'android', 'inapp', 'firefox', 'other', 'installed']) {
    assert.ok(typeof HOW_WORDS[key] === 'string' && HOW_WORDS[key].length > 20, `words for ${key}`);
    assert.doesNotMatch(HOW_WORDS[key], /<|>|\.exe|\.dmg|\.apk|download/i, `${key}: plain words, never a file to download`);
  }
  assert.match(HOW_WORDS.ios, /Share.*on iOS 26 it's in the ⋯ menu.*Add to Home Screen/);
  assert.match(HOW_WORDS.ios, /her own chat history, apart from Safari's/, 'iPhones keep a home screen app\'s data apart: said, not hidden');
  assert.match(HOW_WORDS['mac-safari'], /File → Add to Dock.*keeps its own chat history, apart from Safari's/);
  assert.match(HOW_WORDS.desktop, /Install AGI-1 \(or Install page as app\)/);
  assert.match(HOW_WORDS.desktop, /Install this site as an app/);
  assert.match(HOW_WORDS.inapp, /Open in browser/);
  assert.match(HOW_WORDS.firefox, /agi1\.app\/talk in Chrome, Edge or Safari/);
  // install.js: the browser's own prompt kept for our button, Safari sent to /talk first (Safari keeps the address it's on)
  const js = read('src/chat/install.js');
  assert.match(js, /addEventListener\('beforeinstallprompt', \(e\) => \{\n    e\.preventDefault\(\);\n    deferred = e;/);
  assert.match(js, /if \(\(h === 'ios' \|\| h === 'mac-safari'\) && !inTalk\(\)\) dispatchEvent\(new CustomEvent\('agi:talk-open', \{ detail: \{ full: false \} \}\)\);/);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
});

test('the layout: everything for it names .is-talk (the page itself only gets the new buttons), her framing, her chat bar by its width', () => {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // every rule with the block headers around it (@media, @container…)
  const rules = [];
  const stack = [];
  let text = '';
  for (const ch of src) {
    if (ch === '{') { stack.push(text.trim()); text = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head && !head.startsWith('@')) rules.push([head, [...stack]]); text = ''; }
    else if (ch === ';' && stack.length && !stack[stack.length - 1].startsWith('@')) text = '';
    else text += ch;
  }
  assert.ok(rules.length > 60, `the rules were read (${rules.length})`);
  // (and her pop-out window, 2026-10-02: the card while she's in it, .is-popped, and her window's own page, .is-pip)
  const pageOnly = /\.pg-head-actions|\.pg-cam-full|\.pg-cam \.dstyle-cam|\.pg\.is-gated \.pg-call|\.pg-talk-ctl|\.pg-talk-btn|\.appdlg-|\.pg-away|\.is-popped|\.is-pip/;
  for (const [sel, heads] of rules) {
    // (inside @container pgbar / talk / pgcam: containers that exist only in full-screen talk, checked below)
    if (heads.some((h) => h.startsWith('@container'))) continue;
    for (const one of sel.split(',').map((x) => x.trim()).filter(Boolean)) {
      assert.ok(/\.is-talk/.test(one) || pageOnly.test(one), `"${one}" names .is-talk or one of the new buttons`);
    }
  }
  assert.doesNotMatch(src, /!important|url\(/, 'no !important, nothing from elsewhere');
  assert.match(src, /html\.is-talk \.pg-bar \{[^}]*container: pgbar \/ inline-size;/, 'the chat bar is a container only in full-screen talk');
  assert.match(src, /html\.is-talk body > :not\(main\):not\(dialog\), html\.is-talk main > :not\(#playground\) \{ display: none; \}/, 'only the chat, and the dialogs it opens');
  assert.match(src, /top: var\(--talk-top, 0px\); height: var\(--talk-h, 100%\);/, 'phones: the part of the screen you can see');
  assert.match(src, /--cam-frame: \.74; --cam-frame-3d: \.74; --cam-headroom: \.1;/, 'her waist up in 2D and 3D, with room above her hair');
  for (const name of ['pgbar / inline-size', 'talk / size', 'pgcam / size']) assert.ok(new RegExp(`html\\.is-talk [^{]*\\{[^}]*container: ${name.replace('/', '\\/')}`).test(src), `the ${name} container only in full-screen talk`);
  assert.match(src, /@container talk \(max-height: 560px\) \{\n  \.pg-examples \{ display: none; \}/, 'a short screen (a phone\'s keyboard): the chat keeps its room');
  assert.match(src, /@media \(max-aspect-ratio: 4\/5\), \(max-width: 760px\) and \(orientation: portrait\) \{\n  html\.is-talk \.pg \{\n    grid-template-columns: minmax\(0, 1fr\);/, 'phones standing up and tall windows: her on top (a phone on its side: side by side)');
  assert.match(src, /html\.is-talk \.pg-gate \{[^}]*max-height: 100%; overflow-y: auto;/, 'the 18+ check scrolls on a short screen (its button always reachable)');
  assert.match(src, /html\.is-talk \.pg-models \{ max-height: calc\(100cqh - 84px\); overflow-y: auto;/, 'her 16 languages: the menu scrolls inside the screen');
  assert.match(src, /@container talk \(max-height: 340px\) \{\n    \.pg \{ grid-template-rows: 0 /, 'very little room: the chat alone');
  // the stage frames her by those numbers, draws a big picture with a sensible number of pixels, her sharper 2D texture
  const stage = read('src/stage/stage.js');
  assert.match(stage, /meters\('--cam-frame'\), frame3d = meters\('--cam-frame-3d'\)/);
  assert.match(stage, /getPropertyValue\('--cam-headroom'\)/);
  assert.match(stage, /const MAX_PIXELS = mobile \? 1\.8e6 : 3\.4e6;/);
  assert.match(stage, /const h = Math\.min\(Math\.max\(0\.78, base\), Math\.max\(base, \(x1 - x0\) \/ aspect, top - bottom\)\);/, 'never past her waist while she waves');
  assert.match(stage, /if \(dock\.on && dock\.big && !mobile && current === 'agi1' && agi1Slot === 'agi1_2d'\) models\.agi1_2d\?\.sharpen\?\.\(\);/);
  // Pop mode's colors for it are scoped like every other Pop mode rule (tests/pop.test.js checks all of pop.css)
  assert.match(read('src/styles/pop.css'), /\[data-skin='pop'\]\.is-talk \.pg-cam \{ margin: 16px 16px 22px;/);
});

test('the page\'s parts in it: the chat (her live view before the 18+ check, no surprise card, the same chat in another tab), the stage at once, the front later', () => {
  const chat = read('src/chat/chat.js');
  assert.match(chat, /const showCam = \(\) => \{ if \(cam\) cam\.hidden = !gate\.hidden && !talkMode\(\); \};/, 'her big view before the 18+ check (as on the stage: PG-13, for everyone)');
  assert.match(chat, /root\.classList\.toggle\('is-gated', on\);/, 'no Call before it');
  assert.match(chat, /if \(talkMode\(\)\) \{ \(gate\.hidden \? input : \$\('\[data-gate-ok\]'\)\)\.focus\(\{ preventScroll: true \}\); return; \}/);
  assert.match(chat, /history = base\.concat\(history\.slice\(synced\)\)\.slice\(-KEEP\);/, 'two tabs: this tab\'s new messages go after what\'s stored (never written over)');
  assert.match(chat, /if \(busy\) stale = true;\s+\/\/ [^\n]*\n\s+else reload\(\);/, 'another tab\'s change: shown at once, or after her reply');
  assert.match(chat, /history = \[\]; synced = 0; store\.del\(KEYS\.history\);/, 'Clear: a clear wins over what other tabs had');
  assert.match(read('src/lib/notify.js'), /if \(document\.documentElement\.classList\.contains\('is-talk'\)\) return null;/, 'no card over her: the moment is in her chat');
  const main = read('src/main.js');
  assert.match(main, /import '\.\/styles\/fullscreen\.css';/);
  assert.ok(main.indexOf("import './styles/fullscreen.css'") > main.indexOf("import './styles/pop.css'"), 'after Pop mode\'s styles');
  assert.match(main, /startFullscreen\(document\);/);
  assert.match(main, /startInstall\(document\);/);
  assert.match(main, /if \(!front \|\| talkAtStart\) start\(\);/, 'the stage at once (she\'s the point of it)');
  assert.match(main, /if \(talkAtStart\) addEventListener\('agi:talk', \(e\) => \{ if \(!e\.detail\) startFront\(\); \}\);\nelse startFront\(\);/, 'the front once you leave it');
  const fs = read('src/chat/fullscreen.js');
  assert.match(fs, /if \(e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/, 'a new tab when you ask for one');
  assert.match(fs, /history\.pushState\(\{ agiTalk: 1 \}, '', TALK_PATH \+ location\.search\);/, 'Back leaves it');
  assert.match(fs, /if \(full && canFull\(\)\) goFull\(\);/, 'real full screen only from a click on the page');
  assert.match(fs, /if \(state\.on && state\.fromPage && !state\.leaving && !busyElsewhere\(\)\) leave\(\);/, 'leaving the browser\'s full screen goes back to the page (not when the Esc was for a screen or a menu)');
  assert.match(fs, /if \(state\.backing\) return;/, 'two ✕ at once go back once');
  assert.doesNotMatch(fs, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.doesNotMatch(fs + read('src/chat/install.js'), /eth_|ethereum|wallet\.request|sendTransaction/, 'nothing about wallets (hard rule 9)');
});
