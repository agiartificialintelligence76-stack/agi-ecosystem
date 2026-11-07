// The AGI arcade kit and its ten games (2026-11-08, the owner: "can you create 10 more high quality new games … optimized
// both for mobile devices … and on the /games page can you compact all the games so its easy to pick … and there should
// ba a preview of gameplay on every game"). The kit (src/games/kit/) is the frame every new game shares; each game is
// wired into the site the same way (its page, its address, its build entry, its link preview, its play counter, its
// reviews' AI context). Its pure parts run here in Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const KIT_IDS = ['mergeagi', 'blockchain', 'heartbeat', 'scamslayer', 'lastmodel', 'singularity', 'jailbreak', 'stacked', 'jaywalk', 'robotaxi', 'realorai', 'notarobot', 'alignment', 'gradient', 'epochs', 'synapse', 'overclock', 'beattheagi', 'hallucination', 'guardrails'];

test('the ten kit games are in the games list, after the first four, with their names and addresses', async () => {
  const { GAMES, isGame } = await import('../src/games/list.js');
  assert.deepEqual(Object.keys(GAMES).slice(4), KIT_IDS);
  for (const id of KIT_IDS) {
    assert.equal(isGame(id), true);
    assert.equal(GAMES[id].path, `/games/${id}`);
    assert.equal(GAMES[id].kit, true);
    assert.match(id, /^[a-z0-9]{2,24}$/, 'the same rule as arcade.sql and the API address');
    assert.ok(GAMES[id].name && GAMES[id].name === GAMES[id].name.toUpperCase(), `${id}: its name in capitals`);
  }
});

test('each kit game\'s page: the intro\'s cover, its root, its entry, its link preview, nothing inline (the CSP)', async () => {
  const { GAMES } = await import('../src/games/list.js');
  for (const id of KIT_IDS) {
    const html = read(`${id}.html`);
    const name = GAMES[id].name.replaceAll("'", '&#x27;');
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" \/>/, `${id}: the notch`);
    assert.ok(html.includes(`<title>${GAMES[id].name} · AGI games</title>`), `${id}: its title`);
    assert.ok(html.includes(`<link rel="canonical" href="__SITE__/games/${id}" />`));
    assert.ok(html.includes(`<meta property="og:url" content="__SITE__/games/${id}" />`));
    assert.ok(html.includes(`<meta property="og:image" content="__SITE__/cards/games/${id}.jpg" />`), `${id}: its own picture`);
    assert.ok(exists(`public/cards/games/${id}.jpg`), `${id}: its link preview's picture`);
    assert.match(html, /<meta name="description" content="[^"]*No wallet needed\.[^"]*" \/>/, `${id}: no wallet needed`);
    assert.ok(html.includes('<div class="gi" id="agi-intro" aria-hidden="true"></div>\n    <main id="ak-root">'), `${id}: the intro, then the kit's root`);
    assert.ok(html.includes(`<script type="module" src="/src/games/${id}/page.js"></script>`));
    assert.doesNotMatch(html, /<script>|<style|\sstyle=|\son\w+=/, `${id}: works with the strict CSP`);
    assert.ok(!name.includes('$') && !/\bbuy\b/i.test(html), `${id}: never money`);
    const entry = read(`src/games/${id}/page.js`);
    assert.match(entry.replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';/, `${id}: the intro first`);
  }
});

test('each kit game is wired into the site: its address, its build entry, the owner catalog, its link preview, its reviews', async () => {
  const vercel = JSON.parse(read('vercel.json'));
  const { default: config } = await import('../vite.config.js');
  const { BUILTIN_PAGES, normalizePath } = await import('../src/owner/catalog.js');
  const { LOOK_GAMES, lookSystem } = await import('../server/arcade.js');
  const share = read('scripts/share-pages.js');
  const { neededGameArt } = await import('../scripts/share-pages.js');
  const pkg = JSON.parse(read('package.json'));
  for (const id of KIT_IDS) {
    for (const path of [`/games/${id}`, `/games/${id}/`]) assert.ok(vercel.rewrites.some((r) => r.source === path && r.destination === `/${id}`), `${id}: ${path}`);
    assert.equal(config.build.rollupOptions.input[id], `${id}.html`, `${id}: built`);
    for (const hook of ['configureServer', 'configurePreviewServer']) {
      let rewrite;
      config.plugins[0][hook]({ middlewares: { use(fn) { rewrite = fn; } } });
      for (const [url, expected] of [[`/games/${id}`, `/${id}.html`], [`/games/${id}/?demo`, `/${id}.html?demo`], [`/games/${id}-x`, `/games/${id}-x`]]) {
        const req = { url, headers: {} };
        rewrite(req, {}, () => {});
        assert.equal(req.url, expected, `${hook}: ${url}`);
      }
    }
    assert.ok(BUILTIN_PAGES.some((p) => p.path === `/games/${id}`), `${id}: the owner's catalog`);
    assert.equal(normalizePath(`/${id}`), `/games/${id}`);
    assert.ok(share.includes(`'dist/${id}.html'`), `${id}: its link preview gets the site's address`);
    assert.ok(neededGameArt().includes(`cards/games/${id}.jpg`), `${id}: the build checks its picture is there`);
    assert.ok(Object.hasOwn(LOOK_GAMES, id), `${id}: its reviews judged as reviews of this game`);
    assert.ok(lookSystem(id).includes(`"${(await import('../src/games/list.js')).GAMES[id].name}"`));
    assert.ok(exists(`tests/${id}.test.js`), `${id}: its own tests`);
    assert.ok(pkg.scripts.test.includes(`tests/${id}.test.js`), `${id}: npm test runs them`);
  }
  assert.ok(pkg.scripts.test.includes('tests/arcade-kit.test.js'), 'npm test runs this file');
});

test('each kit game\'s link preview: a 1200 × 630 JPEG, small enough for X', () => {
  for (const id of KIT_IDS) {
    const jpg = readFileSync(new URL(`../public/cards/games/${id}.jpg`, import.meta.url));
    assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff], `${id}: a JPEG`);
    assert.ok(jpg.length < 260_000, `${id}: ${jpg.length} bytes`);
    let size = null;
    for (let i = 2; i < jpg.length - 9;) {
      if (jpg[i] !== 0xff) break;
      const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2);
      if (m === 0xc0 || m === 0xc2) { size = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; }
      i += 2 + len;
    }
    assert.deepEqual(size, [1200, 630], id);
  }
});

test('each kit game uses the kit\'s shell: its own id, one count a run, no requests of its own, no money words', () => {
  for (const id of KIT_IDS) {
    const files = readdirSync(new URL(`../src/games/${id}/`, import.meta.url), { recursive: true }).filter((f) => /\.js$/.test(f));
    const code = files.map((f) => read(`src/games/${id}/${f}`)).join('\n');
    assert.match(code, new RegExp(`createShell\\(\\{[\\s\\S]{0,200}game: '${id}'`), `${id}: the kit's shell, with its id`);
    assert.doesNotMatch(code, /fetch\(\s*['"`]\/api|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/, `${id}: no requests of its own (the kit counts plays)`);
    assert.doesNotMatch(code, /\beval\(|new Function\(|setAttribute\(\s*['"]style['"]|\.innerHTML\s*=\s*[^'"`]/, `${id}: the CSP (no eval, no style attributes, no HTML from data)`);
    assert.doesNotMatch(code, /https?:\/\/(?!x\.com\/intent|www\.w3\.org)/, `${id}: nothing from another site`);
    // never money (hard rule 8): its words never say $AGI, invest, profit or a price
    const words = [...code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join('\n');
    assert.doesNotMatch(words, /\$AGI|\binvest|\bprofit|\bfinancial advice\b(?! )|\bprice\b|\bpump\b|\bdump\b/i, `${id}: never money talk`);
  }
});

test('the kit: dice that repeat, numbers the arcade way, easing that lands, tweens, a seeded run', async () => {
  const fx = await import('../src/games/kit/fx.js');
  const a = fx.rng(42), b = fx.rng(42), c = fx.rng(43);
  const sa = Array.from({ length: 8 }, () => a.next()), sb = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(sa, sb, 'the same seed, the same dice');
  assert.notDeepEqual(sa, Array.from({ length: 8 }, () => c.next()));
  for (const x of sa) assert.ok(x >= 0 && x < 1);
  const r = fx.rng(7);
  for (let i = 0; i < 200; i++) { const n = r.int(2, 5); assert.ok(n >= 2 && n <= 5 && Number.isInteger(n)); }
  assert.equal(fx.fmt(12345), '12,345');
  assert.equal(fx.fmt(1234567, { compact: true }), '1.2M');
  assert.equal(fx.fmt(999, { compact: true }), '999');
  assert.equal(fx.fmt(3.4e18, { compact: true }), '3.4Qi');
  assert.equal(fx.fmt(Infinity), '∞');
  assert.equal(fx.fmtTime(125), '2:05');
  for (const [name, fn] of Object.entries(fx.ease)) {
    assert.ok(Math.abs(fn(0)) < 1e-9, `${name}(0)`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9, `${name}(1)`);
  }
  const tw = new fx.Tweens(), o = { x: 0 };
  let done = 0;
  tw.to(o, { x: 10 }, 1, fx.ease.linear, { done: () => done++ });
  tw.update(0.5); assert.equal(o.x, 5);
  tw.update(0.6); assert.equal(o.x, 10); assert.equal(done, 1);
  assert.equal(fx.clamp(5, 0, 3), 3);
  assert.equal(fx.mix('#000000', '#ffffff', 0.5), '#808080');
});

test('the kit: a game\'s save and the arcade\'s settings, kept only in this browser (bests, lower-is-better, the first zero isn\'t a best)', async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const { gameStore, settings } = await import('../src/games/kit/store.js');
  const s = gameStore('mergeagi');
  assert.deepEqual(s.read(), {});
  assert.deepEqual(s.recordBest('best', 0), { best: 0, isBest: false }, 'a first run of 0 isn\'t a "new best"');
  assert.deepEqual(s.recordBest('best', 120), { best: 120, isBest: true });
  assert.deepEqual(s.recordBest('best', 80), { best: 120, isBest: false });
  assert.deepEqual(s.recordBest('time', 42, { lower: true }), { best: 42, isBest: true });
  assert.deepEqual(s.recordBest('time', 50, { lower: true }), { best: 42, isBest: false });
  assert.equal(s.bump('runs'), 1);
  assert.equal(s.bump('runs'), 2);
  assert.ok(mem.has('agi_arcade:mergeagi'), 'one key per game');
  assert.deepEqual(settings.get(), { sound: true, music: true, haptics: true }, 'sound and music on by default');
  settings.set({ music: false });
  assert.equal(JSON.parse(mem.get('agi_arcade:settings')).music, false, 'the same in every game');
  const { shareUrl } = await import('../src/games/kit/share.js');
  const u = new URL(shareUrl({ text: 'I scored 1,234 in MERGE TO AGI 💜', path: '/games/mergeagi' }));
  assert.equal(u.origin + u.pathname, 'https://x.com/intent/post', 'X\'s own post box: the player posts');
  assert.equal(u.searchParams.get('url'), 'https://agi1.app/games/mergeagi');
  assert.equal(u.searchParams.get('text'), 'I scored 1,234 in MERGE TO AGI 💜');
  delete globalThis.localStorage;
});

test('the kit\'s files: its styles scoped to ak- classes, its shell builds with DOM methods, ?demo counts and saves nothing', () => {
  const css = read('src/games/kit/kit.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // every selector (an at-rule's own line, such as @media's, and keyframes' steps aren't selectors)
  for (const sel of css.replace(/@font-face\s*\{[^}]*\}/g, '').match(/[^{}]+(?=\{)/g).map((s) => s.trim()).filter((s) => s && !/^(@|from|to|\d+%)/.test(s))) {
    for (const one of sel.split(/,(?![^(]*\))/)) {   // (a comma inside :where(…) isn't a new selector)
      if (/^\s*(@|from|to|\d)/.test(one)) continue;
      assert.match(one.trim(), /(\.ak\b|\.ak-|html\.ak-page|:where\(\.ak\))/, `scoped: ${one.trim()}`);
    }
  }
  assert.doesNotMatch(css, /url\((?!'\/fonts\/)/, 'nothing from elsewhere: only its own fonts');
  const shell = read('src/games/kit/shell.js');
  assert.equal((shell.match(/innerHTML/g) || []).length, 1, 'one innerHTML: its own fixed icons');
  assert.match(shell, /t\.innerHTML = ICONS\[name\] \|\| '';/);
  assert.doesNotMatch(shell, /setAttribute\('style'|\.style\./, 'its styles in kit.css (the CSP)');
  const site = read('src/games/kit/site.js');
  assert.match(site, /if \(DEMO\) return;/, 'a demo counts nothing');
  assert.match(site, /action: 'game-play', game, player: playerId\(\), plays/);
  assert.match(read('src/games/kit/store.js'), /if \(DEMO\) return;/, 'a demo saves nothing');
  assert.match(read('src/games/kit/audio.js'), /!DEMO && s\.sound/, 'a demo is silent');
});
