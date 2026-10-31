// SKYBREAK (2026-10-31): AGI-1's 3D chart climb at agi1.app/games/skybreak, brought in from its own project by
// tools/games/import-skybreak.mjs. Its card, stars and plays are in tests/page.test.js (beside VLAD RUNNER 2049's); its
// intro cover in tests/intro.test.js. Here: what the import wrote, the files it ships (and the ones it never does), its
// page's own CSP, and that its markup has everything its code looks for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (name) => readFileSync(join(ROOT, name), 'utf8');
const GAME = 'src/games/skybreak';
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((f) => (statSync(join(ROOT, dir, f)).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));

test('its import: the game\'s modules with only the tool\'s patches, the site\'s own page.js and site.js beside them', async () => {
  const { PATCHES, MARKUP_PATCHES, OWN, FONTS } = await import('../tools/games/import-skybreak.mjs');
  for (const [file, from, to] of PATCHES) {
    const text = read(`${GAME}/${file}`);
    assert.ok(text.includes(to), `${file}: patched`);
    assert.ok(!text.includes(from), `${file}: nothing left of what it replaced`);
  }
  const page = read('skybreak.html');
  for (const [from, to] of MARKUP_PATCHES) {
    if (to) assert.ok(page.includes(to), `markup: ${to}`);
    assert.ok(!page.includes(from.trim()), `markup: no ${from.trim()}`);
  }
  assert.deepEqual(OWN.filter((f) => existsSync(join(ROOT, GAME, f))).sort(), ['page.js', 'site.js'], 'the site\'s own files (its key art is in public/images)');
  for (const f of FONTS) assert.ok(existsSync(join(ROOT, GAME, 'fonts', f)), `fonts/${f}`);
  // its 3D files from /games/skybreak/, never Vite's BASE_URL (the site's pages are at its root)
  const renderer = read(`${GAME}/renderer.js`);
  assert.match(renderer, /const asset = path => `\/games\/skybreak\/\$\{path\}`;/);
  assert.doesNotMatch(read(`${GAME}/renderer.js`) + read(`${GAME}/main.js`), /import\.meta\.env\.BASE_URL/);
  // hard rule 8: its sky never charts $AGI's price, and the Moon's flag is AGI-1's
  assert.doesNotMatch(renderer, /'\$AGI \/ USD'|'\$AGI 1H'|AGI-1 \/ ETH|SKY \/ USD|signLabel\('\$AGI'/);
  // its fonts come with it (the CSP: fonts from our own site only)
  const css = read(`${GAME}/style.css`);
  assert.deepEqual([...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]), ['./fonts/geist.woff2', './fonts/mono.woff2']);
  assert.doesNotMatch(css, /@import|https?:/, 'nothing from another site');
});

test('its page: the AGI GAMES intro, then the run counter, then the game, loaded after them', () => {
  const entry = read(`${GAME}/page.js`);
  const statics = [...entry.matchAll(/^import (?:\{[^}]*\} from )?'([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(statics, ['../intro.js', './site.js'], 'the intro first, then its counter');
  assert.match(entry, /await import\('\.\/main\.js'\)/, 'the game\'s engine arrives while the intro plays');
  assert.ok(entry.indexOf("addEventListener('skybreak:run'") < entry.indexOf("import('./main.js')"), 'counting before the game can start a run');
  // its markup between the import tool's markers, after the intro's cover
  const page = read('skybreak.html');
  const start = page.indexOf('<!-- game:start'), end = page.indexOf('<!-- game:end -->');
  assert.ok(page.indexOf('id="agi-intro"') < start && start < end, 'the cover first, then the game');
  // every element its code asks for by id is in its markup (main.js's $('…') and getElementById, input.js's too)
  const code = ['main.js', 'input.js', 'hud.js', 'renderer.js'].map((f) => read(`${GAME}/${f}`)).join('\n');
  const asked = new Set([...code.matchAll(/\$\('([a-z0-9-]+)'\)|getElementById\('([a-z0-9-]+)'\)|querySelector\('#([a-z0-9-]+)'\)/g)].map((m) => m[1] || m[2] || m[3]));
  const made = new Set(['qa-replay', 'qa-info', 'continue']);   // made by its own code (its QA panel, its Continue button)
  const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const id of asked) assert.ok(ids.has(id) || made.has(id), `#${id} is in skybreak.html`);
  assert.ok(asked.size > 30, `${asked.size} ids looked for`);
});

test('its phone and tablet controls: the stick and buttons on any touchscreen, a compact title on a short screen', () => {
  const page = read('skybreak.html');
  for (const id of ['touch-controls', 'touch-stick', 'touch-recover', 'touch-grapple', 'touch-jump']) assert.match(page, new RegExp(`id="${id}"`));
  const css = read(`${GAME}/style.css`);
  assert.match(css, /@media \(pointer:coarse\)\{\.playing #touch-controls\{display:block\}/, 'any touchscreen, not only a narrow one');
  assert.match(css, /@media \(max-height:500px\)\{[\s\S]*\.intro-content\{[^}]*overflow-y:auto/, 'Begin Ascent always on screen on a phone held sideways');
  assert.match(read(`${GAME}/input.js`), /getElementById\('touch-recover'\)/);
  assert.match(read(`${GAME}/main.js`), /matchMedia\('\(pointer: coarse\)'\)/, 'its first hint names the stick');
});

test('its files on the site: only what it loads, never the original city or its provenance', async () => {
  const { RUNTIME } = await import('../tools/games/import-skybreak.mjs');
  const shipped = walk('public/games/skybreak').map((f) => f.slice('public/games/skybreak/'.length)).sort();
  assert.deepEqual(shipped, [...RUNTIME].sort(), 'its 3D files, its motion list, nothing else');
  const renderer = read(`${GAME}/renderer.js`);
  const loaded = [...renderer.matchAll(/asset\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(loaded)].sort(), ['characters/agi1-high.vsplat', 'environment/launch-plaza-low.spz', 'environment/launch-plaza-medium.spz', 'motions/manifest.json'].sort());
  const motions = JSON.parse(read('public/games/skybreak/motions/manifest.json'));
  for (const f of Object.values(motions)) assert.ok(RUNTIME.includes(`motions/${f}`), `motions/${f}`);
  const ignore = read('.gitignore');
  for (const f of ['environment/launch-plaza.spz', 'environment/launch-plaza-lods.json', 'motions/provenance.json']) {
    assert.ok(ignore.split('\n').includes(`public/games/skybreak/${f}`), `${f}: never in git, never on the site`);
  }
  // its key art: the card's, the ratings tab's and its link preview's, at the size its tags say
  const sharp = (await import('sharp')).default;
  const art = await sharp(join(ROOT, 'public/images/skybreak/keyart.webp')).metadata();
  assert.deepEqual([art.format, art.width, art.height], ['webp', 1600, 900]);
  assert.ok(statSync(join(ROOT, 'public/images/skybreak/keyart.webp')).size < 200_000, 'small');
  for (const html of [read('games.html'), read('skybreak.html')]) {
    const tags = [...html.matchAll(/\/images\/skybreak\/keyart\.webp" alt="[^"]*" width="(\d+)" height="(\d+)"/g)];
    for (const m of tags) assert.deepEqual([Number(m[1]), Number(m[2])], [1600, 900]);
  }
  assert.equal([...read('games.html').matchAll(/\/images\/skybreak\/keyart\.webp" alt="[^"]*" width="1600" height="900"/g)].length, 2, 'its card and its tab');
  assert.match(read('skybreak.html'), /<meta property="og:image:width" content="1600" \/>\s*<meta property="og:image:height" content="900" \/>/);
});

test('its CSP: the site\'s own, plus WebAssembly for its page and its 3D city\'s decoder, nowhere else', () => {
  const v = JSON.parse(read('vercel.json'));
  const cspOf = (rule) => rule.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  const site = cspOf(v.headers[0]);
  assert.equal(v.headers[0].source, '/(.*)');
  assert.doesNotMatch(site, /wasm|unsafe-eval|data: https:\/\/api/, 'every other page as before');
  const page = v.headers.find((h) => h.source === '/(games/skybreak/?|skybreak)');
  const worker = v.headers.find((h) => h.source === '/assets/spz-worker-(.*)');
  assert.ok(page && worker);
  // the same policy, one word more for its page (its physics, Rapier, is WebAssembly) ...
  assert.equal(cspOf(page), site.replace("script-src 'self' ", "script-src 'self' 'wasm-unsafe-eval' "));
  // ... and for the worker that unpacks its city (SPZ): its decoder is WebAssembly it reads from a data: address
  assert.equal(cspOf(worker), site.replace("script-src 'self' ", "script-src 'self' 'wasm-unsafe-eval' ").replace("connect-src 'self' blob: ", "connect-src 'self' blob: data: "));
  // later rules win for the same header (Vercel), so both come after the site's
  const at = (rule) => v.headers.indexOf(rule);
  assert.ok(at(page) > 0 && at(worker) > 0);
  for (const rule of v.headers) {
    const csp = cspOf(rule);
    if (csp && csp.includes('wasm-unsafe-eval')) assert.ok(rule === page || rule === worker, `${rule.source}: no WebAssembly`);
  }
  // its 3D files kept a day; its page never (Vercel's default for HTML)
  const files = v.headers.find((h) => h.source === '/games/skybreak/(characters|environment|motions)/(.*)');
  assert.deepEqual(files.headers, [{ key: 'Cache-Control', value: 'public, max-age=86400' }]);
  // the address the engine names its decoder by, as the build writes it (Vite: <name>-<hash>.js)
  const engine = readFileSync(join(ROOT, 'node_modules/@viggle/splat-engine/package.json'), 'utf8');
  assert.equal(JSON.parse(engine).version, '0.3.2', 'the engine the worker rule was checked with');
  const dist = join(ROOT, 'node_modules/@viggle/splat-engine/dist');
  const workerFiles = readdirSync(dist, { recursive: true }).filter((f) => /spz-worker\.(m?js)$/.test(String(f)));
  assert.ok(workerFiles.length >= 1, 'its decoder is its own file, spz-worker');
});
