// The roadmap's video and its graphics (2026-10-14, tools/roadmap-promo/: the owner's "can you create a graphic and just
// short promotional video for the roadmap"; the owner's choices: 16:9 for X, about 20 seconds, music made in code and
// AGI-1's voice, an X post image, the roadmap's link preview and a square one). Its words are the roadmap page's own
// (roadmap.html, word for word), and they hold the site's rules for the roadmap (coming soon is a plan, never an offer:
// no rate, APY, amount, date or guarantee, never "buy"; "not financial advice" and 18+ wherever money comes up; PG-13;
// only $AGI; AGI-1 only as her 2D self; never CloakMesh; never an AI service's name). The picture and the sound keep one
// clock (timeline.js): its scenes on bars, the music on its moments, her four lines where nothing hits under them.
// No browser here, and never her takes (tools/roadmap-promo/media: made once, never in git): the renderer's own pure
// parts (its road's camera and motion blur, a card's fine print) are run in Node with a stand-in canvas.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as W from '../tools/roadmap-promo/words.js';
import { SCENES, TOTAL, MOMENTS as M, BAR, BEAT, at, sceneAt, sceneOf, ROAD, VOICE as PLACES } from '../tools/roadmap-promo/timeline.js';
import { musicPlan, BREATHS, SECTIONS, sectionAt, HOOK_BAR } from '../tools/roadmap-promo/music.js';
import { TRANSITIONS } from '../tools/roadmap-promo/page/cuts.js';
import { withoutSecrets, args, COVER_AT, OG_MAX, OG_FILE, voiceLines, LEN_SLACK } from '../tools/roadmap-promo/make.mjs';
import { VOICES } from '../tools/roadmap-promo/media.mjs';
import { CARDS, DRAW } from '../tools/roadmap-promo/page/cards.js';
import road, { blurAt as roadBlur, camShift, camWarp, SHUTTER } from '../tools/roadmap-promo/page/scenes/road.js';
import title from '../tools/roadmap-promo/page/scenes/title.js';
import end from '../tools/roadmap-promo/page/scenes/end.js';
import { metaFit, layout, CARD } from '../tools/roadmap-promo/page/parts.js';
import { planDucks, hitsOf, wav16, RATE } from '../tools/studio-promo/voice.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// its code, never its media (git-ignored) or its build
const files = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => {
  const p = `${dir}/${f}`;
  if (f === 'dist' || f === 'media') return [];
  return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? files(p) : [p];
});
const CODE = files('tools/roadmap-promo').filter((f) => /\.(m?js|html|css)$/.test(f));
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const words = W.allWords();
const all = [...words, W.POST];
// the roadmap page as text: its tags gone, its entities read
const PAGE = read('roadmap.html').replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
// a stand-in canvas: every letter as wide as half its font's size (its spacing too)
const fakeG = () => {
  let s = 20;
  return {
    set font(v) { s = +(/(\d+(?:\.\d+)?)px/.exec(v)?.[1] || 20); }, get font() { return `${s}px x`; },
    letterSpacing: '0px', textAlign: 'left', textBaseline: 'alphabetic', fontStretch: 'normal',
    measureText: (str) => ({ width: [...str].length * s * 0.5 }),
    save() {}, restore() {},
  };
};

// ---------- its words ----------
test('its words are the roadmap page\'s own, word for word, and its six steps are the page\'s', () => {
  assert.ok(words.length > 50, 'every word on screen is listed');
  const has = (s, why) => assert.ok(PAGE.includes(s), `on roadmap.html: "${s}"${why ? ` (${why})` : ''}`);
  has(W.TITLE.kicker); W.TITLE.words.forEach((w) => has(w)); has(W.TITLE.sub);
  assert.deepEqual(W.STEPS.map((s) => s.n), ['01', '02', '03', '04', '05', '06'], 'its six steps, in order');
  assert.deepEqual(W.STEPS.map((s) => s.state), ['live', 'live', 'soon', 'soon', 'soon', 'locked'], 'two live, three coming soon, one locked');
  for (const s of W.STEPS) {
    for (const w of [s.name, s.line, s.more, s.meta, s.status, ...(s.chips || [])].filter(Boolean)) has(w, s.n);
  }
  assert.equal(W.STEPS.find((s) => s.state === 'locked').mystery, '???', 'the locked one: a mystery, no details');
  Object.values(W.LABELS).forEach((w) => has(w)); has(W.STAMP); has(W.SAY, 'her line on the page');
  // the meter says what the steps are
  const live = W.STEPS.filter((s) => s.state === 'live').length;
  assert.equal(W.METER.n, String(live));
  assert.equal(W.METER.of, `of ${W.STEPS.length}`);
  assert.equal(W.METER.text, `live now · ${W.STEPS.length - live} coming soon`);
  has(`${W.METER.text}`);
  // her line says the same: two live, four on the way
  assert.match(W.SAY, /^two live, four on the way/);
  // the fine print and the safety pill say what the page's fine print says, in short
  for (const p of ['not built yet', 'no dates are promised', 'never guaranteed and never an investment', 'Not financial advice', '18+', "only where they're legal"]) has(p, 'the page\'s fine print');
  assert.match(W.END.fine.join(' '), /not built yet, no dates promised/);
  assert.match(W.END.fine.join(' '), /never guaranteed and never an investment/);
  assert.match(W.END.fine.join(' '), /18\+, only where it's legal/);
  assert.equal(W.SITE, 'agi1.app/roadmap');
  assert.equal(W.HANDLE, '@agi1dotapp');
});

test('its rules: a plan, never an offer (no rate, APY, amount, date or guarantee, never "buy"), PG-13, only $AGI, never an AI service', () => {
  const AI = /\b(fal(\.ai)?|kling|seedance|nano ?banana|gemini|google|meshy|dreamina|higgsfield|bytedance|openai|chat ?gpt|sora|veo|midjourney|suno|eleven ?labs)\b/i;
  for (const w of all) {
    assert.doesNotMatch(w, AI, `never an AI service's name: "${w}"`);
    for (const m of w.matchAll(/\$([A-Za-z][A-Za-z0-9]*)/g)) assert.equal(m[1], 'AGI', `only $AGI: "${w}"`);
    assert.doesNotMatch(w, /\$\s?\d|\d+(\.\d+)?\s?%|\bAPY\b|\bAPR\b|\byield|\bper (day|week|month|year)\b|\b\d[\d,.]*\s?(USDG|AGI|sAGI)\b/i, `never a rate or an amount: "${w}"`);
    assert.doesNotMatch(w, /\b(buy|buying|sell|selling|hodl|moon\w*|pump\w*|profit\w*|gains?|lambo|100x|number go up|airdrop|presale|wen)\b/i, `never money talk: "${w}"`);
    assert.doesNotMatch(w, /\bsafe\b|\bscam\w*|\brug\w*/i, `never "safe", "scam" or "rug": "${w}"`);
    assert.doesNotMatch(w, /\b(babe|baby|cutie|darling|sweetie)\b|sex|nude|naked|horny|lingerie|bikini|nsfw/i, `PG-13: "${w}"`);
    assert.doesNotMatch(w, /cloak ?mesh|inference\.agi1|daria/i, w);
    assert.doesNotMatch(w, /\b3D model\b|\bglb\b/i, `AGI-1 only as her 2D self: "${w}"`);
    if (/guarant/i.test(w)) assert.match(w, /never guaranteed/i, `"guaranteed" only as "never guaranteed": "${w}"`);
    if (/invest/i.test(w)) assert.match(w, /never an investment/i, `"investment" only as "never an investment": "${w}"`);
    // never a date it promises: the only month is the roadmap's own ("Roadmap · October 2026")
    for (const m of w.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december|Q[1-4]|20\d\d)\b/gi)) {
      assert.equal(w, W.TITLE.kicker, `a date only in the kicker (the roadmap's own month), never a promise: "${w}" (${m[0]})`);
    }
  }
  // "not financial advice" and 18+ wherever money comes up: each coming-soon step, the safety pill, the end card, the post
  for (const s of W.STEPS.filter((x) => x.state === 'soon')) {
    assert.match(s.meta, /coming soon/, s.n);
    assert.match(s.meta, /not financial advice/, s.n);
    assert.match(s.meta, /18\+/, s.n);
  }
  for (const s of W.STEPS.filter((x) => /stake|games/i.test(x.name))) assert.match(s.meta, /only where it's legal/, `${s.name}: where money is at stake`);
  for (const w of [W.SAFETY, W.END.fine.join(' '), W.POST]) {
    assert.match(w, /not financial advice/i, w);
    assert.match(w, /18\+/, w);
    assert.match(w, /coming soon/i, w);
  }
  assert.ok(W.POST.length <= 280, `the post fits X (${W.POST.length})`);
  assert.match(W.POST, /https:\/\/agi1\.app\/roadmap/);
  // the page's own words for how staking will pay: USDG and sAGI, never as "$USDG" or "$sAGI" (only $AGI is a ticker here)
  assert.deepEqual(W.STEPS[2].chips, ['in USDG only', 'in $AGI only', 'free AI with sAGI']);
});

test('her voice: four short lines, the video\'s own words, never over a hit, a drop\'s first moment or a breath', () => {
  assert.deepEqual(W.VOICE.map((l) => l.id), PLACES.map((l) => l.id), 'words.js and timeline.js name the same lines, in order');
  assert.deepEqual(VOICES.map(([id]) => id), W.VOICE.map((l) => l.id), 'media.mjs makes the same lines ready');
  for (const l of W.VOICE) {
    assert.ok(l.text.split(/\s+/).length <= 8, `short: "${l.text}"`);
    if (l.said) assert.equal(l.said.replace(/[^a-z' ]/gi, '').toLowerCase(), l.text.replace(/[^a-z' ]/gi, '').toLowerCase(), `"said" is how she says it, the same words: ${l.id}`);
  }
  assert.match(W.VOICE[0].text, /AGI roadmap/);
  assert.match(W.VOICE[1].text, /live/);
  assert.match(W.VOICE[2].text, /Staking, games and giveaways/);
  assert.match(W.VOICE[3].text, /secret/);
  const said = PLACES.reduce((a, l) => a + l.len, 0);
  assert.ok(said < TOTAL * 0.6, `her lines are a part of it, not a narration (${said.toFixed(1)} s of ${TOTAL})`);
  for (const [k, l] of PLACES.entries()) {
    const s = sceneAt(l.at);
    assert.equal(s.id, ['title', 'live', 'soon', 'secret'][k], `${l.id}: in its scene`);
    assert.ok(l.at + l.len <= sceneAt(l.at).to + (ROAD.includes(s.id) ? BAR * 2 : 0.01), `${l.id}: said before its scene (or the road) moves on`);
    if (k) assert.ok(l.at > PLACES[k - 1].at + PLACES[k - 1].len + 0.5, `${l.id}: a breath after the line before`);
  }
  // with the music's real hits (its impacts and crashes) and breaths, every line has room: the music dips under her,
  // never over a hit (each gets through at full level) or a breath's silence
  const plan = musicPlan();
  const ducks = planDucks(PLACES.map(({ id, at: a, len }) => ({ id, at: a, len })), { hits: hitsOf(plan), breaths: BREATHS });
  for (const d of ducks) assert.deepEqual(d.problems, [], `${d.id}: ${d.problems.join('; ')}`);
  // the hits at the picture's big moments are never under her words
  for (const t of [...M.titleWords.slice(0, 2), M.drop, M.drop2, ...M.stamps, M.lock, M.end, ...M.lastHits]) {
    for (const l of PLACES) assert.ok(t < l.at - 0.04 || t > l.at + l.len + 0.06, `the hit at ${t} s isn't under "${l.id}"`);
  }
});

// ---------- the clock ----------
test('the scenes: one after the other on bars of the music, 21.5 s in all, every moment in its own scene', () => {
  assert.deepEqual(SCENES.map((s) => s.id), ['title', 'live', 'soon', 'secret', 'end']);
  assert.equal(TOTAL, 21.5);
  assert.equal(BAR, 2); assert.equal(BEAT, 0.5); assert.equal(at(4, 2), 9);
  for (const [k, s] of SCENES.entries()) {
    assert.ok(s.to > s.from, s.id);
    assert.equal((s.from / BAR) % 1, 0, `${s.id} starts on a bar`);
    if (k) assert.equal(s.from, SCENES[k - 1].to, `${s.id} follows ${SCENES[k - 1].id}`);
  }
  assert.equal(SCENES[0].from, 0);
  assert.deepEqual(ROAD, ['live', 'soon', 'secret'], 'the road: one world, three scenes in a row');
  assert.equal(sceneOf('soon').from, sceneOf('live').to);
  const inScene = (t, id) => assert.equal(sceneAt(t).id, id, `${t} s in ${id}`);
  [M.open, M.reveal, M.kicker, ...M.titleWords, M.sub, M.road, ...M.dots, M.breath].forEach((t) => inScene(t, 'title'));
  [M.drop, ...M.nodes, ...M.cards, ...M.checks, M.pan, M.breath2].forEach((t) => inScene(t, 'live'));
  [M.drop2, M.soonHead, ...M.soonCards, ...M.chips, M.fine, ...M.stamps, M.pan2, M.breathLock].forEach((t) => inScene(t, 'soon'));
  [M.lock, M.adult, ...M.scramble, M.lockShake, M.zoomOut, ...M.pulses, M.meter, M.breath3].forEach((t) => inScene(t, 'secret'));
  [M.end, M.url, M.say, M.handle, M.fineEnd, ...M.lastHits].forEach((t) => inScene(t, 'end'));
  // the drops on the scenes' first beats, each after its breath
  assert.equal(M.drop, sceneOf('live').from); assert.equal(M.drop2, sceneOf('soon').from);
  assert.equal(M.lock, sceneOf('secret').from); assert.equal(M.end, sceneOf('end').from);
  for (const [a, b] of BREATHS) assert.ok(b - a >= 0.2 && b - a <= 0.3, `a breath of a beat or so before ${b} s`);
  // the end card: her bubble typed out, and everything on it, well before the fade (the last 0.6 s)
  const typed = M.say + 0.08 + [...new Intl.Segmenter().segment(W.SAY)].length / 55;
  assert.ok(typed < TOTAL - 0.6 - 1, `her bubble is typed out by ${typed.toFixed(2)} s, a second before the fade`);
  assert.ok(Math.max(M.url, M.handle, M.fineEnd) < M.lastHits[0], 'the address, the handle and the fine print are in before the last hits');
  assert.ok(COVER_AT > M.fineEnd + 0.5 && COVER_AT < TOTAL - 0.6, 'the cover: the end card with everything on it, before the fade');
});

test('the cuts: into the road and into the end only (the road is one world), each on its scene\'s first moment, short', () => {
  assert.deepEqual(TRANSITIONS.map((x) => SCENES[x.i + 1].id), ['live', 'end'], 'no cut inside the road');
  for (const x of TRANSITIONS) {
    assert.equal(x.at, SCENES[x.i + 1].from, `the cut into ${SCENES[x.i + 1].id} on its first moment`);
    assert.ok(x.pre > 0 && x.post > 0 && x.pre + x.post <= 0.75, `short (${x.pre} + ${x.post} s)`);
    assert.equal(typeof x.draw, 'function');
  }
});

test('the music lands on the picture: a sound on every moment that has one, four kicks a bar where it drops, nothing in a breath', () => {
  const plan = musicPlan();
  assert.deepEqual(plan, musicPlan(), 'the same plan every time');
  const near = (t, names, w = 0.03) => plan.some((e) => names.includes(e.name) && Math.abs(e.t - t) <= w);
  const has = (t, names, why) => assert.ok(near(t, names), `${why} at ${t} s (${names.join('/')})`);
  M.titleWords.forEach((t, k) => { has(t, ['impact'], `the title's slam ${k + 1}`); has(t, ['kick'], 'its kick'); });
  has(M.titleWords[2], ['crash'], 'the title\'s last slam, its crash');
  for (const [t, why] of [[M.drop, 'the drop'], [M.drop2, 'the second drop'], [M.lock, 'the lock'], [M.end, 'the end card']]) has(t, ['impact'], why);
  M.dots.forEach((t, k) => has(t, ['blip'], `the title's stop ${k + 1}`));
  M.checks.forEach((t, k) => has(t, ['click'], `check ${k + 1}`));
  M.stamps.forEach((t, k) => has(t, ['impact', 'snare'], `stamp ${k + 1}`));
  M.pulses.forEach((t, k) => has(t, ['bell', 'blip'], `the whole road's stop ${k + 1}`));
  M.lastHits.forEach((t, k) => has(t, ['kick'], `last hit ${k + 1}`));
  for (const t of [M.kicker, M.sub, M.soonHead, M.meter, M.url, M.handle, M.fineEnd, M.say, ...M.nodes, ...M.chips]) has(t, ['blip', 'pop'], `a pop or a blip at ${t}`);
  has(M.drop, ['reverse'], 'a reverse cymbal into the drop'); has(M.drop2, ['reverse'], 'and into the second'); has(M.breath, ['riser'], 'a riser up to the first breath');
  // four kicks a bar where it drops, on the beat
  for (let bar = 2; bar < 7; bar++) {
    for (let k = 0; k < 4; k++) assert.ok(near(at(bar, k), ['kick'], 0.001), `a kick on beat ${k + 1} of bar ${bar + 1}`);
  }
  // nothing starts in a breath (its silence makes the hit after it land harder)
  for (const [a, b] of BREATHS) {
    const inside = plan.filter((e) => e.t > a + 0.005 && e.t < b - 0.001);
    assert.deepEqual(inside.map((e) => `${e.name}@${e.t}`), [], `the breath ${a}–${b} s`);
  }
  // its sections on the scenes
  assert.equal(sectionAt(0).name, 'intro'); assert.equal(sectionAt(2).name, 'dropA'); assert.equal(sectionAt(4).name, 'dropB');
  assert.equal(sectionAt(7).name, 'dark'); assert.equal(sectionAt(9).name, 'end');
  for (const [bar] of SECTIONS) assert.ok(bar * BAR < TOTAL, `section at bar ${bar}`);
  assert.equal(sceneAt(HOOK_BAR * BAR).id, 'soon', 'the hook in full under the stamps');
  for (const e of plan) assert.ok(e.t >= 0 && e.t <= TOTAL, `${e.name} at ${e.t} s, inside the video`);
});

// ---------- the renderer ----------
test('the road\'s camera: motion blur only where it whips, from one sharp picture; the headlines stay sharp on top', () => {
  const c = { W: 1920, H: 1080 };
  assert.equal(SHUTTER, 0.5 / 60, 'a half-frame shutter');
  assert.equal(typeof road.blurAt, 'function', 'the road can blur');
  assert.equal(title.blurAt, undefined, 'the title never blurs');
  assert.equal(end.blurAt, undefined, 'the end card never blurs');
  // still on its cards, blurred on its whips (the pans and the pull-back), never more than 40 copies
  for (const t of [M.drop + 0.5, M.cards[1] + 0.4, M.checks[1] + 0.2, M.stamps[2] + 0.2, M.lock + 0.6, M.meter + 0.3]) assert.equal(roadBlur(t, c), 1, `still at ${t} s`);
  for (const t of [M.pan + 0.17, M.pan2 + 0.17, M.zoomOut + 0.35]) {
    const n = roadBlur(t, c);
    assert.ok(n > 1 && n <= 40, `blurred at ${t} s (${n})`);
  }
  for (let t = sceneOf('live').from; t < sceneOf('secret').to; t += 1 / 60) assert.ok(roadBlur(t, c) <= 40);
  // a copy at time ts is the picture at t warped as the camera moved: no move, no warp
  const w0 = camWarp(c, M.drop + 0.5, M.drop + 0.5);
  assert.deepEqual([w0.k, w0.dx, w0.dy].map((x) => +x.toFixed(9)), [1, 0, 0]);
  assert.ok(camShift(c, M.pan + 0.17, SHUTTER) > 2, 'a whip moves the picture more than 2 px in half a frame');
  // main.js: the world drawn once into its own canvas, copies laid over each other, then the screen's layer sharp
  const main = read('tools/roadmap-promo/page/main.js');
  assert.match(main, /drawOnce\(blurBuf, s, tt, 'world'\)/);
  assert.match(main, /globalAlpha = 1 \/ \(i \+ 1\)/, 'an even mix of the copies');
  assert.match(main, /drawOnce\(target, s, tt, 'screen'\)/);
  // the headlines are the page's words
  const roadSrc = read('tools/roadmap-promo/page/scenes/road.js');
  assert.match(roadSrc, /headline\(g, t, LABELS\.live,/);
  assert.match(roadSrc, /headline\(g, t, LABELS\.soon,/);
});

test('a card\'s fine print: on one line when it fits (smaller if it must), else broken at its dots, never a word alone', () => {
  const g = fakeG();
  const inner = CARD.w - CARD.pad * 2;
  for (const s of W.STEPS) {
    const f = metaFit(g, s.meta, inner);
    assert.ok(f.lines.length >= 1 && f.lines.length <= 3, `${s.n}: ${f.lines.length} lines`);
    assert.ok(f.s >= 13, `${s.n}: never under 13 px`);
    for (const ln of f.lines) assert.ok(ln.split(/\s+/).filter((x) => x && x !== '·').length >= 2 || f.lines.length === 1, `${s.n}: never a word alone on a line ("${ln}")`);
    assert.equal(f.lines.join(' ').replace(/\s+/g, ' '), s.meta, `${s.n}: every word, in order`);
  }
  // a long line breaks after a dot, its next part starting the next line
  const long = 'chat · voice · calls · 16 languages · live on X · and more · and even more';
  const f = metaFit(g, long, 200);
  assert.ok(f.lines.length > 1);
  for (const ln of f.lines.slice(0, -1)) assert.match(ln, / ·$/, `"${ln}" ends at a dot`);
  assert.doesNotMatch(f.lines.at(-1), /^X$/, 'never "X" alone');
  // layout() uses it
  const L = layout(g, W.STEPS[0]);
  assert.ok(L.metaLines.length >= 1 && L.metaS >= 13);
});

test('the renderer: its scenes, its graphics, its link preview, no secrets for the browser or ffmpeg, never in the site', () => {
  const main = read('tools/roadmap-promo/page/main.js');
  assert.match(main, /const MODULES = \{ title, live: road, soon: road, secret: road, end \}/, 'its five scenes, the road one module');
  assert.match(main, /SIZE = \{ W: 1920, H: 1080 \}/, '16:9');
  assert.deepEqual(CARDS, { x: { W: 1920, H: 1080 }, square: { W: 1080, H: 1080 }, og: { W: 1200, H: 630 } }, 'its three graphics');
  assert.deepEqual(Object.keys(DRAW), Object.keys(CARDS));
  // the options
  const a = args([]);
  assert.equal(a.out, 'promo/roadmap'); assert.equal(a.fps, 60); assert.equal(a.name, 'agi1-roadmap');
  assert.ok(a.music && a.voice && !a.cards);
  assert.deepEqual(args(['--cards', '--light', '12', '--no-voice']), { ...a, cards: true, light: 12, voice: false });
  assert.throws(() => args(['--nope']), /unknown option/);
  // its link preview: in the site, a real 1200 × 630 JPEG under its limit, on the roadmap's four pages
  assert.equal(OG_FILE.replace(/\\/g, '/').split('/').slice(-3).join('/'), 'public/cards/roadmap.jpg');
  const og = readFileSync(OG_FILE);
  assert.ok(og.length <= OG_MAX, `${og.length} bytes`);
  assert.deepEqual([...og.subarray(0, 3)], [0xff, 0xd8, 0xff], 'a JPEG');
  // its size, from its frame header (SOF0/SOF2)
  let size = null;
  for (let i = 2; i < og.length - 9;) {
    if (og[i] !== 0xff) break;
    const m = og[i + 1], len = og.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) { size = [og.readUInt16BE(i + 7), og.readUInt16BE(i + 5)]; break; }
    i += 2 + len;
  }
  assert.deepEqual(size, [1200, 630]);
  // (games.html is AGI games' own page since 2026-10-19, with its own picture: cards/games.jpg, tests/page.test.js)
  for (const p of ['roadmap', 'stake', 'giveaway']) assert.match(read(`${p}.html`), /<meta property="og:image" content="__SITE__\/cards\/roadmap\.jpg" \/>/, p);
  // nothing of the computer's secrets for the browser or ffmpeg
  const env = withoutSecrets({ PATH: '/bin', GEMINI_API_KEY: 'x', PASS_SECRET: 'y', TELEGRAM_BOT_TOKEN: 'z', FAL_KEY: 'w', HOME: '/root' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH']);
  // its code: never AGI-1's 3D model, CloakMesh, an AI service's name or another site
  for (const f of CODE) {
    const src = noComments(read(f));
    assert.doesNotMatch(src, /\.glb\b|three|agi1-2d|her\.js|live2d/i, `${f}: AGI-1 only as her 2D art (the front's), never 3D or her Live2D model`);
    assert.doesNotMatch(src, /cloak ?mesh/i, f);
    assert.doesNotMatch(src, /https?:\/\/(?!agi1\.app|127\.0\.0\.1|localhost|\$\{SITE\})/, `${f}: nothing from another site (the post's address is SITE, agi1.app/roadmap)`);
  }
  assert.match(read('tools/roadmap-promo/page/scenes/title.js'), /createArt\(ctx\)/, 'her art: the front\'s');
  // never in the site's build, its media and videos never in git
  assert.doesNotMatch(read('vite.config.js'), /roadmap-promo/);
  const ignore = read('.gitignore');
  assert.match(ignore, /^\/promo\/$/m, 'its videos (promo/roadmap) never in git');
  assert.match(ignore, /^tools\/roadmap-promo\/media\/$/m, 'her takes never in git');
  assert.match(ignore, /^dist\/$/m, 'its build never in git');
  assert.ok(existsSync(new URL('../tools/roadmap-promo/README.txt', import.meta.url)), 'its README for the owner');
  // it runs with every build
  assert.match(JSON.parse(read('package.json')).scripts.test, /tests\/studio-promo\.test\.js tests\/roadmap-promo\.test\.js /, 'in npm test, after the launch videos\' tests');
});

test('make.mjs: her lines as media.mjs made them ready, where timeline.js puts them; a take that doesn\'t fit is said', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rm-media-'));
  try {
    mkdirSync(join(dir, 'voice'));
    const take = (sec) => { const x = new Float32Array(Math.round(sec * RATE)); for (let i = 0; i < x.length; i++) x[i] = 0.2 * Math.sin(i / 9); return x; };
    const index = { voice: {} };
    for (const l of PLACES) {
      writeFileSync(join(dir, 'voice', `${l.id}.wav`), wav16([take(l.len + 0.35)]));
      index.voice[l.id] = { onset: 0.15, len: l.len };
    }
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
    const lines = voiceLines(dir);
    assert.deepEqual(lines.map((l) => [l.id, l.at, l.len]), PLACES.map((l) => [l.id, l.at, l.len]));
    assert.ok(lines.every((l) => l.pcm instanceof Float32Array && l.pcm.length > 0));
    // a take that lasts longer than its place was made for
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ voice: { ...index.voice, live: { onset: 0.15, len: PLACES[1].len + LEN_SLACK + 0.05 } } }));
    assert.throws(() => voiceLines(dir), /lasts .* and its place in timeline\.js/);
    // one not made ready
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ voice: { title: index.voice.title } }));
    assert.throws(() => voiceLines(dir), /isn't made ready: node tools\/roadmap-promo\/media\.mjs/);
    // a take that isn't 48 kHz mono
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
    writeFileSync(join(dir, 'voice', 'next.wav'), wav16([take(1), take(1)]));
    assert.throws(() => voiceLines(dir), /isn't as media\.mjs makes it/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
