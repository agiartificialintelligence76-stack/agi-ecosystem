// AGI games (2026-10-19): brings the owner's game, Ride 'Em, AGI!, into the site as agi1.app/games/rideemagi.
//
// The game was made in another of the owner's projects (VTuber_Project/18_ride_em_agi: its source in
// backup/p18_code_v1.zip, its five pictures in game/). It was one page for a single-file publisher: a <style> block, a
// <script> and Google Fonts. The site's CSP allows none of that inline (and no font from another site), so this tool
// writes it as the site's own files, changing only what has to change, each change a patch that must find its text
// exactly as many times as it says (a new version of the game that moved it stops the tool instead of doing it wrong):
//
//   src/games/rideemagi/game.js     its code, as one ES module (its pictures imported, so Vite gives each its own
//                                   address), plays counted on our server (Site.play(): no sign-in), since 2026-10-22
//                                   its endless runs and daily mod on the leaderboards (Ranked: ./ranked.js), never Cabo (the
//                                   owner, 2026-09-28: "remove everything about cabo"), two bars' widths through the
//                                   CSS object model, a way back to agi1.app/games and to rating it
//   src/games/rideemagi/game.css    its styles (and the page reset its publisher added), the stars' font named
//   src/games/rideemagi/*.webp      its five pictures as they are (an app's label taken out: the files are the same)
//   rideemagi.html                  its markup, between <!-- game:start --> and <!-- game:end -->
//
// Its fonts are tools/games/game-fonts.py's (public/fonts/games/, src/games/rideemagi/fonts.css).
//
// Run (after a new version of the game; then npm test):
//   node tools/games/import-rideemagi.mjs <the game's code folder> <the game's picture folder>
// the code folder holding game/src/ and sprites/sprites.json (p18_code_v1.zip unpacked), the picture folder
// run.webp, jump.webp, duck.webp, dduck.webp and keyart.webp (18_ride_em_agi/game).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'src', 'games', 'rideemagi');
const PAGE = join(ROOT, 'rideemagi.html');

export const PICTURES = ['run', 'jump', 'duck', 'dduck', 'keyart'];
const KEEP = ['file', 'w', 'h', 'n', 'cols', 'ax', 'ay', 'bot', 'top'];   // a sprite sheet's fields the game reads

const BACK = '<a class="btn ghost sm" href="/games" aria-label="Back to AGI games">${ICON.back}<span>Games</span></a>';
const RATE = '<a class="btn ghost sm" href="/games#rate" aria-label="Rate it on the games page">${ICON.star}<span>Rate it</span></a>';

// [file, its text now, what it becomes, how many times it's there]
export const PATCHES = [
  ['10_core.js', "'use strict';\n", '', 1],                                    // a module is strict already
  ['20_art.js', 'const FONT_D = \'"Mochiy Pop One", "Arial Rounded MT Bold"',
    'const FONT_D = \'"Mochiy Pop One", "M PLUS Rounded 1c", "Arial Rounded MT Bold"', 1],   // its stars: Mochiy has none
  ['30_levels.js', "desc: 'Cabo goes full speed and smashes everything'", "desc: 'Her cat goes full speed and smashes everything'", 1],
  ['30_levels.js', "desc: 'Cabo chases the dot over everything'", "desc: 'Her cat chases the dot over everything'", 1],
  ['31_game.js', '// laser pointer: Cabo pounces after the dot', '// laser pointer: her cat pounces after the dot', 1],
  ['40_ui.js', '    this.el.innerHTML = html; this.el.scrollTop = 0;\n',
    '    this.el.innerHTML = html; this.el.scrollTop = 0;\n' +
    "    // (agi1.app) bars' widths through the CSS object model: the site's CSP allows no style attributes\n" +
    "    this.el.querySelectorAll('[data-w]').forEach((e) => { e.style.width = e.dataset.w + '%'; });\n", 1],
  ['40_ui.js', '<i style="width:${Math.round(Rider.prog * 100)}%"></i>', '<i data-w="${Math.round(Rider.prog * 100)}"></i>', 1],
  ['40_ui.js', '<i style="width:${Math.round(p * 100)}%"></i>', '<i data-w="${Math.round(p * 100)}"></i>', 1],
  ['40_ui.js', '<span class="l2">AGI-1 × Cabo</span>', '<span class="l2">AGI-1 and her cat</span>', 2],
  ['40_ui.js', 'aria-label="Loading Cabo"', 'aria-label="Loading the game"', 1],
  ['40_ui.js', '<span>Waking Cabo up…</span>', '<span>Waking her cat up…</span>', 1],
  ['40_ui.js', '<img class="keyart" src="keyart.webp" alt="AGI-1 riding Cabo the cat"',
    '<img class="keyart" src="${KEYART}" alt="AGI-1 riding her cat"', 1],
  ['40_ui.js', '<h2>Cabo needs a nap</h2>', '<h2>Her cat needs a nap</h2>', 1],
  ['40_ui.js', 'AGI-1 and Cabo beat VAC-9000 MAX.', 'AGI-1 and her cat beat VAC-9000 MAX.', 1],
  // (agi1.app) a way back to the games page, and to rating it there
  ['40_ui.js', '      <h2 class="q">How are you playing?</h2>',
    `      <div class="topbar">${BACK}</div>\n      <h2 class="q">How are you playing?</h2>`, 1],
  ['40_ui.js', 'return `<div class="topbar"><button class="btn ghost sm keep" data-act="go" data-to="device"',
    `return \`<div class="topbar">${BACK}${RATE}<button class="btn ghost sm keep" data-act="go" data-to="device"`, 1],
  ['50_main.js', "if (!this.ready) { UI.toast('Waking Cabo up…'); await this.readyP; }",
    "if (!this.ready) { UI.toast('Waking her cat up…'); await this.readyP; }", 1],
  ['50_main.js', '    Missions.runStart();\n',
    '    Missions.runStart();\n    Site.play();                                   // (agi1.app) one more play on our server: no sign-in\n' +
    '    Ranked.start(cfg);                             // (agi1.app) its ticket for the leaderboard (endless runs, the daily mod)\n', 1],
  // (2026-10-22) a ranked run's numbers for the leaderboard, as it ends (and again after a revive): ./ranked.js
  ['50_main.js', '    const out = Prog.apply(r);\n',
    '    const out = Prog.apply(r);\n    Ranked.result(r, st);                          // (agi1.app) a ranked run\'s numbers for the leaderboard\n', 1],
  // the publisher's live-reload hooks: nothing on agi1.app has them
  ['50_main.js', "  try { const H = window.claude && window.claude.hot; if (H && H.snapshot) H.snapshot(() => ({ past: UI.cur !== 'device' && !!Save.d.device })); } catch (e) { }\n", '', 1],
  ['50_main.js', 'function start() {\n  const H = window.claude && window.claude.hot;\n' +
    '  try { if (H && H.ready) { H.ready((data) => boot(data || {})); return; } } catch (e) { }\n' +
    '  boot((H && H.data) || {});\n}\n', 'function start() { boot({}); }\n', 1],
];

export const CSS_PATCHES = [
  ['--display: "Mochiy Pop One", "Arial Rounded MT Bold"', '--display: "Mochiy Pop One", "M PLUS Rounded 1c", "Arial Rounded MT Bold"', 1],
];

// The page reset the game's publisher wrapped it in (it was made and tested inside it), then what agi1.app adds
export const RESET = '*,*::before,*::after{box-sizing:border-box}:root{color-scheme:light;padding-top:env(safe-area-inset-top);' +
  'padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
const ADDED = `
/* (agi1.app) its links look like its buttons */
a.btn { text-decoration: none; }
`;

const count = (text, part) => text.split(part).length - 1;

export function patch(text, patches, where) {
  for (const [old, now, times] of patches) {
    const n = count(text, old);
    if (n !== times) throw new Error(`${where}: "${old.slice(0, 70)}" is there ${n} times, not ${times}: the game changed, check this patch`);
    text = text.split(old).join(now);
  }
  return text;
}

// A WebP without the Claude app's label (its C2PA chunk): the same picture, its RIFF size made right again
export function withoutLabel(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a WebP');
  const parts = [buf.subarray(0, 12)];
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString('latin1', at, at + 4), size = buf.readUInt32LE(at + 4), end = at + 8 + size + (size & 1);
    if (end > buf.length) throw new Error('a WebP chunk runs past its end');
    if (id !== 'C2PA') parts.push(buf.subarray(at, end));
    at = end;
  }
  const out = Buffer.concat(parts);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

export function build(code, art) {
  const src = join(code, 'game', 'src');
  const files = readdirSync(src).filter((f) => f.endsWith('.js')).sort();
  const byFile = new Map();
  for (const [file, ...p] of PATCHES) byFile.set(file, [...(byFile.get(file) || []), p]);
  for (const f of byFile.keys()) if (!files.includes(f)) throw new Error(`the game has no ${f}`);
  const sha = createHash('sha256');
  let js = '';
  for (const f of files) {
    const text = readFileSync(join(src, f), 'utf8');
    sha.update(f + '\0' + text);
    js += patch(text, byFile.get(f) || [], f).trimEnd() + '\n';
  }
  // its sprite sheets: the fields it reads, each file's address from Vite
  const meta = JSON.parse(readFileSync(join(code, 'sprites', 'sprites.json'), 'utf8'));
  const sheets = Object.entries(meta).filter(([, v]) => v && typeof v === 'object');
  const names = sheets.map(([k]) => k).sort();
  if (names.join() !== PICTURES.filter((p) => p !== 'keyart').sort().join()) throw new Error('its sprite sheets changed: ' + names.join());
  const sprites = '{' + sheets.map(([k, v]) => {
    const fields = KEEP.filter((f) => f !== 'file' && f in v).map((f) => `${JSON.stringify(f)}:${JSON.stringify(v[f])}`);
    if (v.file !== `${k}.webp`) throw new Error(`${k}'s file is ${v.file}`);
    return `${JSON.stringify(k)}:{"file":PIC_${k.toUpperCase()},${fields.join(',')}}`;
  }).join(',') + '}';
  const head = readFileSync(join(src, '00_head.html'), 'utf8');
  sha.update('00_head.html\0' + head);
  const body = readFileSync(join(src, '05_body.html'), 'utf8');
  sha.update('05_body.html\0' + body);
  const version = sha.digest('hex').slice(0, 16);

  const out = '// GENERATED by tools/games/import-rideemagi.mjs from the owner\'s game (its source ' + version + '): don\'t edit it.\n' +
    '// Ride \'Em, AGI!: AGI-1 and her cat. Change the game, or the tool\'s patches, and run the tool again.\n' +
    "import { Site } from './site.js';\n" +
    "import { Ranked } from './ranked.js';\n" +
    PICTURES.map((p) => `import PIC_${p.toUpperCase()} from './${p}.webp';\n`).join('') +
    'const KEYART = PIC_KEYART;\n' +
    `const SPRITES = ${sprites};\n` + js;

  const style = head.match(/<style>\n?([\s\S]*?)<\/style>/);
  if (!style) throw new Error('its <style> block is gone');
  const css = '/* GENERATED by tools/games/import-rideemagi.mjs from the owner\'s game (its source ' + version + '): don\'t edit it. */\n' +
    RESET + '\n' + patch(style[1], CSS_PATCHES, '00_head.html') + ADDED;

  return { js: out, css, body: body.trim(), version, art };
}

function main() {
  const [code, art] = process.argv.slice(2);
  if (!code || !art) { console.error('node tools/games/import-rideemagi.mjs <the game\'s code folder> <the game\'s picture folder>'); process.exit(2); }
  const g = build(code, art);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'game.js'), g.js);
  writeFileSync(join(OUT, 'game.css'), g.css);
  for (const p of PICTURES) {
    const file = withoutLabel(readFileSync(join(art, `${p}.webp`)));
    writeFileSync(join(OUT, `${p}.webp`), file);
  }
  // its markup between the marks, at the start mark's own indent
  const page = readFileSync(PAGE, 'utf8');
  const marks = page.match(/^([ \t]*)(<!-- game:start[^>]*-->)[\s\S]*?(<!-- game:end -->)/m);
  if (!marks) throw new Error('rideemagi.html has no <!-- game:start --> … <!-- game:end -->');
  const ind = marks[1];
  writeFileSync(PAGE, page.replace(marks[0], ind + marks[2] + '\n' + g.body.replace(/^/gm, ind) + '\n' + ind + marks[3]));
  console.log(`game.js ${(g.js.length / 1024).toFixed(1)} KB, game.css ${(g.css.length / 1024).toFixed(1)} KB, source ${g.version}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
