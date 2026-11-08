// SKYBREAK (2026-10-31): AGI-1's 3D chart climb at agi1.app/games/skybreak, brought in from its own project by
// tools/games/import-skybreak.mjs. Its card, stars and plays are in tests/page.test.js (beside VLAD RUNNER 2049's); its
// intro cover in tests/intro.test.js. Here: what the import wrote, the files it ships (and the ones it never does), its
// page's own CSP, and that its markup has everything its code looks for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
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

test('its title screen (2026-11-08): a game\'s start screen, not a web page\'s', () => {
  const page = read('skybreak.html');
  const game = page.slice(page.indexOf('<!-- game:start'), page.indexOf('<!-- game:end -->'));
  // no site header, editorial copy or footer bar: the arcade's back button, its logo, its modes and a big Play
  assert.doesNotMatch(game, /class="brand"|intro-footer|intro-side|FIELD SYSTEMS|ASCENT DIVISION/);
  assert.match(game, /<a class="exit-pill" href="\/games" aria-label="Back to AGI games">[\s\S]*?<span>ARCADE<\/span><\/a>/);
  assert.match(game, /<p class="kicker"><span>AGI GAMES<\/span><b>BETA<\/b><\/p>/);
  assert.match(game, /<h1 class="logo" aria-label="Skybreak">/);
  assert.match(game, /role="radiogroup" aria-label="Run mode">[\s\S]*data-mode="rift" role="radio" aria-checked="true"[\s\S]*data-mode="pure" role="radio" aria-checked="false"/);
  assert.match(game, /<button id="start" class="game-button play" disabled><span id="load-fill" class="play-fill"><\/span>/, 'Play fills as it loads');
  for (const id of ['how', 'settings', 'continue', 'title-sound', 'title-full', 'settings-screen', 'pause-settings', 'pause-help']) assert.match(game, new RegExp(`id="${id}"`));
  // its settings: sound, graphics, camera speed, and on a touchscreen camera follow and button size, kept on the device
  for (const set of ['sound', 'quality', 'look', 'follow', 'buttons']) assert.match(game, new RegExp(`data-set="${set}"`));
  assert.match(read(`${GAME}/save.js`), /export function getSettings\(\)/);
  // AGI-1 stands where its layout leaves room, facing you (the page measures it, the renderer frames her)
  assert.match(read(`${GAME}/main.js`), /renderer\.titleFrame = \{ x: /);
  assert.match(read(`${GAME}/renderer.js`), /titleShot\(p\) \{/);
  // its icons are its own inline SVG (no images, nothing from another site, nothing the CSP refuses)
  assert.doesNotMatch(game, /<img|https?:\/\/|\sstyle=/);
});

test('its phone and tablet controls: a floating stick that sprints at its edge, a thumb arc of buttons, on any touchscreen', () => {
  const page = read('skybreak.html');
  for (const id of ['touch-controls', 'touch-zone', 'touch-stick', 'touch-recover', 'touch-roll', 'touch-grapple', 'touch-jump']) assert.match(page, new RegExp(`id="${id}"`));
  const css = read(`${GAME}/style.css`);
  assert.match(css, /@media \(pointer:coarse\)\{\s*\.playing #touch-controls\{display:block\}/, 'any touchscreen, not only a narrow one');
  assert.match(css, /#touch-zone\{[^}]*touch-action:none/, 'the stick\'s zone never scrolls or zooms the page');
  assert.match(css, /\.big-buttons #touch-controls\{--tb:/, 'larger buttons in Settings');
  assert.match(css, /@media \(max-height:500px\)\{[\s\S]*\.title-main\{[^}]*overflow-y:auto/, 'Play always on screen on a phone held sideways');
  assert.match(css, /env\(safe-area-inset-bottom/, 'clear of a phone\'s rounded corners and home bar');
  const input = read(`${GAME}/input.js`);
  for (const id of ['touch-zone', 'touch-recover', 'touch-roll', 'touch-jump', 'touch-grapple']) assert.match(input, new RegExp(`getElementById\\('${id}'\\)|hold\\('${id}'`));
  assert.match(input, /this\.touchSprint=len>=STICK_EDGE/, 'pushed to its edge, it sprints');
  assert.match(input, /roll:this\.keys\.has\('KeyQ'\)\|\|this\.touchRoll/, 'ROLL on a touchscreen too');
  assert.match(input, /RECOVER_HOLD/, 'RECOVER is held a moment');
  assert.match(read(`${GAME}/main.js`), /matchMedia\('\(pointer: coarse\)'\)/, 'its hints name the stick');
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
  // (2026-11-08) AGI games' compact picker shows a still of it playing (public/images/games/skybreak.webp, from its recorded
  // preview) on its tile and its ratings tab; the key art stays its own page's link preview
  assert.equal([...read('games.html').matchAll(/\/images\/skybreak\/keyart\.webp"/g)].length, 0, 'the picker shows its gameplay');
  assert.equal([...read('games.html').matchAll(/\/images\/games\/skybreak\.webp" alt="" width="480" height="480"/g)].length, 2, 'its tile and its tab');
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
  const engineManifest = new URL(import.meta.resolve('@viggle/splat-engine/package.json'));
  const engine = readFileSync(engineManifest, 'utf8');
  assert.equal(JSON.parse(engine).version, '0.3.2', 'the engine the worker rule was checked with');
  const dist = fileURLToPath(new URL('./dist/', engineManifest));
  const workerFiles = readdirSync(dist, { recursive: true }).filter((f) => /spz-worker\.(m?js)$/.test(String(f)));
  assert.ok(workerFiles.length >= 1, 'its decoder is its own file, spz-worker');
});
