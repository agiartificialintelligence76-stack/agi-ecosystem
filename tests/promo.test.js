// AGI-1's launch video (2026-10-03, tools/promo/: the owner's "create me a professional launch video with motion design
// using only code about the website and its features"). Its words hold her rules (only $AGI, never another coin or a
// price, "not financial advice" wherever money comes up, 18+, PG-13, an AI), its numbers are the site's own (imported, and
// checked here), AGI-1 is only ever her 2D self (her Live2D model and the front's 2D art, never the 3D model: the owner,
// "the 3d model is 18+"), CloakMesh is never in it (the owner: "dont announce on the video about cloackmesh"), and the
// picture and the music keep the same clock (every hit of the music lands on a moment of the picture).
// No browser or ffmpeg here (those only run on Claude's computer). PROMO_RENDER=1 also renders the whole music (about 10 s).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as W from '../tools/promo/words.js';
import { SCENES, TOTAL, MOMENTS as M, BAR, BEAT, at, sceneAt, sceneOf, scanPos, SCAN_ROWS } from '../tools/promo/timeline.js';
import { musicPlan, renderMusic, RATE } from '../tools/promo/music.js';
import { withoutSecrets } from '../tools/promo/make.mjs';
import { LEVELS } from '../src/lib/levels.js';
import { LANGS } from '../src/i18n/langs.js';
import { BENCHMARKS } from '../src/sections/evals-data.js';
import { BUBBLE_LINES } from '../src/landing/lines.js';
import { TOKENS } from '../src/prices/parse.js';
import { TEXTS_A_DAY } from '../server/tg-lines.js';
import { HOW } from '../server/launch-lines.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const files = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? (f === 'dist' ? [] : files(p)) : [p];
});
const CODE = files('tools/promo').filter((f) => /\.(m?js|html|css)$/.test(f));
const words = W.allWords();

// ---------- her rules ----------
test('only $AGI: no other coin, no price, no gains, no "buy": in every word on screen and in the post', () => {
  const all = [...words, W.POST];
  for (const w of all) {
    for (const m of w.matchAll(/\$([A-Za-z][A-Za-z0-9]*)/g)) assert.equal(m[1], 'AGI', `only $AGI on screen: "${w}"`);
    assert.doesNotMatch(w, /\b(buy|buying|sell|selling|hodl|moon\w*|pump\w*|profit\w*|gains?|lambo|100x|price|guarantee\w*|number go up|airdrop)\b/i, `never money talk: "${w}"`);
    assert.doesNotMatch(w, /\bsafe\b|\bscam\w*|\brug\w*/i, `never "safe", "scam" or "rug": "${w}"`);
    assert.doesNotMatch(w, /\b(babe|baby|cutie|honey|darling|sweetie)\b|sex|nude|naked|horny/i, `PG-13, no pet names (anyone watches): "${w}"`);
  }
  // "investment" only ever as "not an investment"
  for (const w of all) if (/invest/i.test(w)) assert.match(w, /not an investment/i, w);
  // never a real coin's name for a launch: her example's shape only
  assert.equal(W.LAUNCH.command, '/launch Name | TICKER | one line');
  assert.match(HOW, /\/launch [^|]+ \| [^|]+ \| /, 'the same shape as her own example');
});

test('"not financial advice" wherever $AGI, burning or launching comes up, and on the end card; 18+; she is an AI', () => {
  const nfa = /not financial advice/i;
  assert.match(W.BURN.fine, nfa);
  assert.match(W.BURN.fine, /not an investment/i);
  assert.match(W.LAUNCH.fine, nfa);
  assert.match(W.LAUNCH.fine, /18\+/);
  assert.match(W.LAUNCH.fine, /never promotes it/);
  assert.match(W.LAUNCH.fine, /can go to zero/);
  assert.match(W.CHECK.her, nfa);
  assert.match(W.CHECK.fine, /not an audit/i);
  assert.match(W.END.fine[0], nfa);
  assert.match(W.END.fine[0], /\$AGI is a meme token on Robinhood Chain/);
  assert.match(W.END.fine[1], /AGI-1 is an AI/);
  assert.match(W.END.fine[1], /18\+/);
  assert.match(W.END.fine[1], /PG-13/);
  assert.match(W.TEXTS.her, /\ban AI\b/, 'asked if she is real, she says she is an AI');
  assert.match(W.POST, nfa);
  assert.match(W.POST, /AGI-1 is an AI/);
  // X counts a link as 23 characters
  const xLen = [...W.POST.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;
  assert.ok(xLen <= 280, `the post fits a post on X (${xLen})`);
});

test('never CloakMesh, never her 3D model, never another coin\'s picture or name in the code that draws it', () => {
  for (const f of CODE) {
    const code = read(f);
    assert.doesNotMatch(code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /cloak ?mesh|inference\.agi1|cloakmesh/i, `${f}: no CloakMesh`);
    assert.doesNotMatch(code, /\.glb\b|src\/stage\/agi1\.js|stage\/agi1'|GLTFLoader|agi1-portrait|agi1-avatar|agi1-live\.webp/, `${f}: never the 3D model or its renders`);
    assert.doesNotMatch(code, /server\/checker|clank-chain|coinsSince|clank\.trade\/v1|mypinata/, `${f}: never reads clank.trade's coins`);
  }
  for (const w of words) assert.doesNotMatch(w, /cloak ?mesh|inference/i, w);
  // her 2D self: her Live2D model and the front's art
  assert.match(read('tools/promo/page/her.js'), /loadAgi1_2D/);
  assert.match(read('tools/promo/page/art.js'), /agi1-cutout\.webp/);
});

// ---------- the site's own words and numbers ----------
test('its numbers and lines are the site\'s own', () => {
  assert.deepEqual(W.CLOSER.cards.map((c) => [c.name, c.daily]), LEVELS.map((l) => [l.name, l.daily]), 'the levels and their messages a day');
  assert.equal(W.EVALS.benchmarks, BENCHMARKS, "the site's Figure 2");
  assert.equal(W.LANGS_SCENE.hellos.length, LANGS.length);
  assert.equal(W.LANGS_SCENE.stamp, `${LANGS.length} languages`);
  assert.deepEqual(W.LANGS_SCENE.hellos.map((h) => h.code), LANGS.map((l) => l.code));
  assert.equal(W.TEXTS_A_DAY, TEXTS_A_DAY, 'she texts first at most as often as her bot does');
  assert.match(W.TEXTS.sub.join(' '), TEXTS_A_DAY === 2 ? /twice a day/ : new RegExp(`${TEXTS_A_DAY}`));
  assert.equal(W.MEET.bubble, BUBBLE_LINES[0], "the front's bubble");
  assert.equal(W.CONTRACT, TOKENS[0].ca, 'the official contract');
  assert.equal(W.CHECK.contract, `${TOKENS[0].ca.slice(0, 6)}…${TOKENS[0].ca.slice(-4)}`, 'shown by its two ends');
  assert.ok(HOW.startsWith(W.LAUNCH.her), 'her launch line, from her bot');
  assert.ok(HOW.includes(W.LAUNCH.yours), 'the coin is yours: her own words');
  assert.equal(W.SITE, 'agi1.app');
  assert.equal(W.HANDLE, '@agi1dotapp');
});

// ---------- the clock ----------
test('the scenes: one after the other on bars of the music, 79 s in all', () => {
  assert.equal(BAR, 4 * BEAT);
  assert.equal(SCENES[0].from, 0);
  assert.equal(TOTAL, 79);
  SCENES.forEach((s, k) => {
    assert.ok(s.to > s.from, s.id);
    if (k) assert.equal(s.from, SCENES[k - 1].to, `${s.id} starts where ${SCENES[k - 1].id} ends`);
    assert.equal(s.from % BAR, 0, `${s.id} starts on a bar`);
  });
  assert.deepEqual(SCENES.map((s) => s.id), ['open', 'meet', 'evals', 'talk', 'langs', 'closer', 'burn', 'texts', 'check', 'launch', 'more', 'finale', 'end']);
  // every moment is inside the video, and in the scene it belongs to
  const flat = Object.entries(M).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]));
  for (const [k, t] of flat) assert.ok(t >= 0 && t < TOTAL, `${k} ${t}`);
  const inScene = { reveal: 'meet', bubble: 'meet', name: 'meet', sticker: 'evals', send: 'talk', reply: 'talk', stamp16: 'langs', levelUp: 'closer', trust: 'closer', burn: 'burn', ding: 'texts', groupReply: 'texts', scan: 'check', found: 'check', herCheck: 'check', launchCmd: 'launch', launched: 'launch', wave: 'finale', url: 'finale', hearts: 'finale' };
  for (const [k, id] of Object.entries(inScene)) assert.equal(sceneAt(M[k]).id, id, k);
  for (const t of M.langs) assert.equal(sceneAt(t).id, 'langs');
  for (const t of M.more) assert.equal(sceneAt(t).id, 'more');
  assert.equal(at(4), 8);
  assert.equal(sceneOf('end').to, TOTAL);
  // the scanner: it races, slows and lands on $AGI, never going back
  let last = -1;
  for (let t = M.scan - 0.5; t < M.found + 0.5; t += 0.01) { const p = scanPos(t); assert.ok(p >= last - 1e-9); last = p; }
  assert.equal(scanPos(M.found), SCAN_ROWS);
  assert.equal(scanPos(0), 0);
});

test('the music lands on the picture: every hit at its moment', () => {
  const plan = musicPlan();
  const near = (name, t, tol = 0.002) => plan.some((e) => e.name === name && Math.abs(e.t - t) <= tol);
  for (const t of M.heartbeats) assert.ok(near('heartbeat', t), `a heartbeat at ${t}`);
  for (const t of M.lastBeats) assert.ok(near('heartbeat', t), `a last heartbeat at ${t}`);
  for (const t of [M.agi, M.drop, M.drop2, M.launched, M.finale, M.end]) assert.ok(near('impact', t), `a hit at ${t}`);
  for (const t of [M.drop, M.drop2, M.end]) assert.ok(near('crash', t), `a crash at ${t}`);
  for (const t of [M.drop, M.drop2]) assert.ok(plan.some((e) => e.name === 'riser' && Math.abs(e.t - (t - 0.12)) < 0.01), `a riser into ${t}`);
  M.langs.forEach((t, k) => assert.ok(near('pluck', t), `her hello ${k + 1} has its note`));
  M.bars.forEach((t) => assert.ok(near('blip', t), `a benchmark's blip at ${t}`));
  M.more.forEach((t) => assert.ok(near('pop', t), `a card's pop at ${t}`));
  M.launchSteps.forEach((t) => assert.ok(near('blip', t), `a launch step at ${t}`));
  for (const t of [M.bubble, M.reply, M.groupReply]) assert.ok(near('pop', t), `a pop at ${t}`);
  for (const t of [M.write, M.reveal, M.herCheck, M.wave, M.hearts]) assert.ok(near('sparkle', t), `a sparkle at ${t}`);
  assert.ok(near('squeak', M.strike), '"General" struck out');
  assert.ok(near('click', M.click), 'the ✦ button pressed');
  // the scanner ticks once for each coin row that passes it (never for $AGI's: that's the lock-on)
  const ticks = plan.filter((e) => e.name === 'click' && e.t > M.scan - 0.2 && e.t <= M.found);
  assert.equal(ticks.length, SCAN_ROWS - 1);
  for (const e of ticks) assert.ok(Math.abs(scanPos(e.t) - Math.round(scanPos(e.t))) < 0.08, `a tick as a row passes (${e.t})`);
  // every cut has a sound right on it
  for (const s of SCENES.slice(1)) assert.ok(plan.some((e) => ['sweep', 'impact', 'crash'].includes(e.name) && Math.abs(e.t - s.from) <= 0.08), `the cut into ${s.id}`);
  // the beat: four kicks a bar in the drops, on the beat
  const kicks = plan.filter((e) => e.name === 'kick' && e.t >= M.drop && e.t < at(11));
  assert.equal(kicks.length, 7 * 4);
  for (const k of kicks) assert.ok(Math.abs(k.t / BEAT - Math.round(k.t / BEAT)) < 1e-6);
  // nothing outside the video, nothing in the breath before a drop, and the same plan every time
  for (const e of plan) assert.ok(e.t >= 0 && e.t < TOTAL, `${e.name} at ${e.t}`);
  for (const t of [M.drop, M.drop2]) assert.ok(!plan.some((e) => e.t > t - 0.11 && e.t < t - 0.001), `a breath before ${t}`);
  assert.deepEqual(musicPlan(), plan);
});

test('the music, rendered: the video\'s length, stereo, loud enough and never clipping (PROMO_RENDER=1)', { skip: !process.env.PROMO_RENDER }, () => {
  const wav = renderMusic();
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), RATE);
  const n = wav.readUInt32LE(40) / 4;
  assert.equal(n, Math.round(TOTAL * RATE));
  let peak = 0;
  const rms = (a, b) => { let s = 0; for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) { const v = wav.readInt16LE(44 + i * 4) / 32768; s += v * v; } return Math.sqrt(s / ((b - a) * RATE)); };
  for (let i = 0; i < n; i += 7) peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + i * 4)) / 32768, Math.abs(wav.readInt16LE(46 + i * 4)) / 32768);
  assert.ok(peak < 0.9, `below -0.9 dBFS (${peak})`);
  assert.ok(peak > 0.5, 'not quiet');
  assert.ok(rms(8.5, 15.5) > rms(0.5, 7.5) * 1.4, 'the drop is bigger than the cold open');
  assert.ok(rms(M.drop - 0.1, M.drop - 0.012) < 0.01, 'a breath before the drop');
  assert.ok(rms(TOTAL - 0.05, TOTAL) < 0.01, 'it fades out');
});

// ---------- the renderer ----------
test('the renderer: the 13 scenes in order, its cuts on the scenes\' boundaries, no secrets for the browser or ffmpeg', async () => {
  const promo = read('tools/promo/page/promo.js');
  const ids = SCENES.map((s) => s.id);
  for (const id of ids) assert.match(promo, new RegExp(`import ${id} from './scenes/${id}\\.js'`), id);
  assert.match(promo, new RegExp(`const MODULES = \\{ ${ids.join(', ')} \\}`));
  for (const id of ids) assert.match(read(`tools/promo/page/scenes/${id}.js`), new RegExp(`id: '${id}'`));
  const tr = read('tools/promo/page/transitions.js');
  assert.match(tr, /at: SCENES\[\+i \+ 1\]\.from/);
  assert.deepEqual(withoutSecrets({ PATH: '/bin', GEMINI_API_KEY: 'x', LIVE_SECRET: 'y', TELEGRAM_BOT_TOKEN: 'z', PASS_SECRET: 'p', HOME: '/h' }), { PATH: '/bin', HOME: '/h' });
  // not part of the website: nothing of it in the site's build, and its output never in git
  assert.doesNotMatch(read('vite.config.js'), /tools\/promo/);
  assert.match(read('.gitignore'), /^\/promo\/$/m);
  assert.match(read('package.json'), /tests\/promo\.test\.js/);
});
