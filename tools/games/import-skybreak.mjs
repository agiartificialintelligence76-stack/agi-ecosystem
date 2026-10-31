// AGI games (2026-10-31): brings SKYBREAK, AGI-1's 3D chart climb, into the site as agi1.app/games/skybreak.
//
// The game is its own project in the owner's folder (skybreak/: its source, its tests, a local launcher and an optional
// asset pipeline; not in git). It's one page with its own modules, styles and two fonts, and its 3D files in
// public/games/skybreak/ (the publicDir its vite.config.js names). This tool writes it as the site's own files, changing
// only what has to change, each change a patch that must find its text exactly as many times as it says (a new version of
// the game that moved it stops the tool instead of doing it wrong):
//
//   src/games/skybreak/*.js        its modules as they are, except where its 3D files are: /games/skybreak/ (its own build
//                                  reads them next to its page, through Vite's BASE_URL; the site's pages are at its root),
//                                  and its sky's billboards and the Moon's flag (never $AGI's price: hard rule 8)
//   src/games/skybreak/style.css   its styles, its two fonts from ./fonts/
//   src/games/skybreak/fonts/      Geist and Geist Mono (woff2) and their license (SIL Open Font License 1.1)
//   skybreak.html                  its markup, between <!-- game:start --> and <!-- game:end -->: its header's mark links
//                                  back to agi1.app/games, and its title screen says beta instead of personal prototype
//   public/games/skybreak/         only the files it loads (RUNTIME), never the original 17.9 MB city or the provenance
//                                  records (they stay in the owner's folder; .gitignore keeps them out of git and the site)
//
// page.js (the AGI GAMES intro, then the run counter, then the game) and site.js (runs told to our server) are the site's
// own, not this tool's.
//
// Run (after a new version of the game; then npm test):
//   node tools/games/import-skybreak.mjs <the game's folder> [<its public folder>]
// the game's folder holding index.html, src/ and assets/ (skybreak/ in the owner's folder); its public folder by default
// <the game's folder>/../public/games/skybreak, which in the owner's folder is already this site's.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'src', 'games', 'skybreak');
const PAGE = join(ROOT, 'skybreak.html');
const PUBLIC = join(ROOT, 'public', 'games', 'skybreak');

// the files it loads, and only those (src/renderer.js: her 3D character, the launch city in two sizes, the list of her
// motions and the one motion in it)
export const RUNTIME = ['characters/agi1-high.vsplat', 'environment/launch-plaza-medium.spz', 'environment/launch-plaza-low.spz',
  'motions/manifest.json', 'motions/idle.glb'];
export const FONTS = ['geist.woff2', 'mono.woff2', 'FONT-LICENSE.txt'];
// the site's own files in its folder, never written or removed by this tool
export const OWN = ['page.js', 'site.js', 'keyart.webp'];

// [file, its text now, what it becomes, how many times it's there]
export const PATCHES = [
  ['renderer.js', 'const asset = path => `${import.meta.env.BASE_URL}${path}`;', 'const asset = path => `/games/skybreak/${path}`;', 1],
  // hard rule 8 (nothing on the site promises gains): its sky's chart billboards chart the game's own made-up $SKY (its
  // altitude, like its ticker), never $AGI's price, and the flag on the Moon is AGI-1's, not the token's
  ['renderer.js', "['$AGI / USD', 'AGI-1 / ETH', '$AGI 1H', 'SKY / USD']", "['$SKY / ALT', 'AGI-1 / ALT', '$SKY 1H', 'SKY / MOON']", 1],
  ['renderer.js', "art.signLabel('$AGI', '#16c784', 'TO THE MOON')", "art.signLabel('AGI-1', '#16c784', 'TO THE MOON')", 1],
  ['style.css', "url('../assets/geist.woff2')", "url('./fonts/geist.woff2')", 1],
  ['style.css', "url('../assets/mono.woff2')", "url('./fonts/mono.woff2')", 1],
];
// [its text now, what it becomes, how many times it's there] in its markup
export const MARKUP_PATCHES = [
  ['<a href="./" aria-label="Skybreak home">', '<a href="/games" aria-label="Back to AGI games">', 1],
  ['PERSONAL PROTOTYPE / BUILD 02', 'AGI GAMES · BETA / BUILD 02', 1],
  ['\n  <script type="module" src="./src/main.js"></script>', '', 1],   // the site's page.js loads it
];

const START = '<!-- game:start (written by tools/games/import-skybreak.mjs from the game\'s own markup: don\'t edit) -->';
const END = '<!-- game:end -->';

export function patch(text, patches, where) {
  let out = text;
  for (const [from, to, times] of patches) {
    const found = out.split(from).length - 1;
    if (found !== times) throw new Error(`${where}: expected ${times} × ${JSON.stringify(from.slice(0, 60))}, found ${found}`);
    out = out.split(from).join(to);
  }
  return out;
}

// the game's markup: everything in its <body>, patched, indented to sit in skybreak.html's <main>
export function markupOf(html) {
  const open = html.indexOf('<body>'), close = html.lastIndexOf('</body>');
  if (open < 0 || close < open) throw new Error('index.html: no <body>');
  const body = patch(html.slice(open + '<body>'.length, close), MARKUP_PATCHES, 'index.html');
  if (/\sstyle\s*=|<script|<style|\son\w+\s*=/i.test(body)) throw new Error('index.html: inline style, script or handler (the CSP allows none)');
  return body.split('\n').filter((l) => l.trim()).map((l) => `      ${l.replace(/^ {1,2}/, '').trimEnd()}`).join('\n');
}

export function writePage(page, markup) {
  const a = page.indexOf(START), b = page.indexOf(END);
  if (a < 0 || b < a) throw new Error('skybreak.html: no game:start / game:end markers');
  return `${page.slice(0, a + START.length)}\n${markup}\n      ${page.slice(b)}`;
}

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);

function main([gameArg, publicArg]) {
  if (!gameArg) throw new Error('usage: node tools/games/import-skybreak.mjs <the game\'s folder> [<its public folder>]');
  const game = resolve(gameArg);
  const pub = resolve(publicArg || join(game, '..', 'public', 'games', 'skybreak'));
  const src = join(game, 'src');
  for (const need of [join(game, 'index.html'), join(src, 'main.js'), join(src, 'style.css')]) {
    if (!existsSync(need)) throw new Error(`not the game's folder: ${need} is missing`);
  }

  // its modules and styles: what was there from an older version goes first (the site's own files stay)
  mkdirSync(join(OUT, 'fonts'), { recursive: true });
  for (const f of readdirSync(OUT)) if (/\.(js|css)$/.test(f) && !OWN.includes(f)) rmSync(join(OUT, f));
  const modules = readdirSync(src).filter((f) => /\.(js|css)$/.test(f)).sort();
  for (const f of modules) {
    if (OWN.includes(f)) throw new Error(`the game has a ${f}: the site's own file has that name`);
    const mine = PATCHES.filter(([file]) => file === f).map(([, from, to, times]) => [from, to, times]);
    writeFileSync(join(OUT, f), patch(readFileSync(join(src, f), 'utf8'), mine, f));
  }
  for (const [file] of PATCHES) if (!modules.includes(file)) throw new Error(`${file}: not in the game any more`);
  for (const f of FONTS) copyFileSync(join(game, 'assets', f), join(OUT, 'fonts', f));

  // its markup
  writeFileSync(PAGE, writePage(readFileSync(PAGE, 'utf8'), markupOf(readFileSync(join(game, 'index.html'), 'utf8'))));

  // its 3D files: only what it loads (copied unless its public folder is this site's own)
  const same = resolve(pub) === resolve(PUBLIC);
  for (const f of RUNTIME) {
    if (!existsSync(join(pub, f))) throw new Error(`its public folder has no ${f}`);
    if (!same) { mkdirSync(dirname(join(PUBLIC, f)), { recursive: true }); copyFileSync(join(pub, f), join(PUBLIC, f)); }
  }
  console.log(`✓ SKYBREAK: ${modules.length} modules and styles, ${FONTS.length} font files, its markup, and ${RUNTIME.length} 3D files`);
  for (const f of RUNTIME) console.log(`  ${f}  ${sha(join(PUBLIC, f))}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
