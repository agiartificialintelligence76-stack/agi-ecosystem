// AGI Studio's meme templates (2026-10-14, the owner: "ready made meme templates already the popular ones … the character on
// that meme will be replaced by their influencer by default", then "they can still edit the text after, change font, change the
// text color … animate it"): the templates and their words (src/studio/memes.js: every template and its samples to the studio's
// rules, a meme's layers checked and tidied, who else fits a template and what moves, its picture's box and shape, where the
// share mark goes), the words drawn as shapes with the real fonts (src/studio/meme-layout.js, server/meme-render.js: the font
// files and their licenses, what each font draws, words fitted to their boxes, an SVG of shapes only, a meme put together and
// its words drawn on it with sharp), and the share mark on a meme's photo and its 5-second video (server/inf-mark.js: its spot,
// ffmpeg's words, a stand-in ffmpeg; src/studio/video-edit.js and server/inf-cut.js: a video that carries its own mark). No
// network and never the real ffmpeg (a stand-in records what it's asked); small pictures, so the whole file takes a few seconds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
  MEME_CANVAS, MEME_FONTS, MEME_FALLBACK, MEME_EMOJI_FILE, memeFontUrl, MEME_COLORS, MEME_OUTLINES, MEME_BOXES, LAYERS, HEX, TEMPLATES,
  TEMPLATE_IDS, TEMPLATE_CATS, templateOf, CAST_BESIDE, castOf, roleOf, MOTION_DEFAULT, motionOf, MARK_RATIO, MARK_SPOTS, MARK_PREFER,
  isMarkSpot, markBoxAt, markSpot, picBox, memeRatio, memeQuality, memeShape, tidyText, upper, checkLayers, defaultLayers, layersCaption,
  newLayer, templateSketch,
} from '../src/studio/memes.js';
import { fontFor, missingChars, needsEmoji, wrapLines, fitLayer, layerShape, layersSvg, drawLayers, wordBoxes, OUTLINE } from '../src/studio/meme-layout.js';
import { memeFonts, undrawable, markSpotFor, picOf, composeBase, renderMeme, wordsPng } from '../server/meme-render.js';
import { checkLayerWords } from '../server/inf-words.js';
import { trouble } from '../server/studio-words.js';
import { MARK, PART, MEME_VIDEO, markFor, markPhoto, markSize, memeVideoPlan, memeVideoArgs, composeMemeVideo, forgetFfmpeg } from '../server/inf-mark.js';
import { MEME_NEEDS_MS } from '../server/inf-jobs.js';
import { layerOf } from '../server/inf-cut.js';
import { ownMark, markSpotOf, markBox, markTopLeft } from '../src/studio/video-edit.js';
import { MARK_LOOK } from '../src/studio/rules.js';
import { mp4Info } from '../server/mp4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bytesOf = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const FONT_DIR = 'public/fonts/meme';
// Every font is laid out. (Comic, Bangers, threw for any two characters until 2026-10-14: opentype.js 2.0.0 can't apply its
// 'ccmp', a chaining substitution of lookup type 6, format 2, so tools/studio/meme-fonts.py leaves that feature out of it.)
const LAID_OUT = Object.keys(MEME_FONTS);
// which of the fonts this is, by its name (a font is never compared whole: a failed assert would print both, every glyph, and
// run the test out of memory)
const fontName = (fonts, font) => (font === null ? null : Object.keys(fonts).find((k) => fonts[k] === font) ?? 'another font');
const canvasOf = (tpl) => MEME_CANVAS[tpl.canvas];
// a template's layers with these words, checked and tidied as our server keeps them
const layersOf = (tpl, sample) => {
  const r = checkLayers(defaultLayers(tpl, sample));
  assert.ok(r.ok, `${tpl.name}: ${JSON.stringify(r)}`);
  return r.layers;
};
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const solid = (width, height, background, channels = 3) => sharp({ create: { width, height, channels, background } });
const pixel = async (img, x, y) => [...await sharp(img).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer()];
// a picture's pixels, decoded once: (x, y) → its channels there
const pixelsOf = async (img) => {
  const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
  return (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x + 1) * info.channels)];
};
const near = (got, want, tol, what) => assert.ok(want.every((v, i) => Math.abs(got[i] - v) <= tol), `${what}: ${got} (want ${want})`);
// a picture decoded once (its colors, without its alpha), and the share of a box's pixels that changed between two of one size
// (the three channels together moved more than 90)
const rgbOf = (img) => sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
function changedIn(a, b, { left, top, width, height }) {
  assert.deepEqual([a.info.width, a.info.height], [b.info.width, b.info.height], 'two pictures of one size');
  const W = a.info.width;
  assert.ok(left >= 0 && top >= 0 && width > 0 && height > 0 && left + width <= W && top + height <= a.info.height, `a box inside the picture: ${left},${top} ${width}×${height}`);
  let n = 0;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const i = (y * W + x) * 3;
      if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 90) n++;
    }
  }
  return n / (width * height);
}
// An MP4's header as mp4Info reads it (its type box, its movie header, a video track with its size), and a little data
function mp4({ seconds = 5, width = 1080, height = 1080, fill = 64 } = {}) {
  const box = (type, ...bodies) => {
    const body = Buffer.concat(bodies);
    const b = Buffer.alloc(8 + body.length);
    b.writeUInt32BE(8 + body.length, 0); b.write(type, 4, 'latin1'); body.copy(b, 8);
    return b;
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(width * 65536, 76); tkhd.writeUInt32BE(height * 65536, 80);
  const hdlr = Buffer.concat([Buffer.alloc(8), Buffer.from('vide', 'latin1'), Buffer.alloc(12)]);
  const moov = box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd), box('mdia', box('hdlr', hdlr))));
  return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\x02\0isom', 'latin1')), moov, box('mdat', Buffer.alloc(fill, 7))]);
}

// ---------- the templates and their words ----------
test('templates: every template is well-formed (its name, category, card line, canvas, color, picture box, layers and samples), and the ids are the keys', () => {
  assert.deepEqual(TEMPLATE_IDS, Object.keys(TEMPLATES));
  assert.equal(new Set(TEMPLATE_IDS).size, TEMPLATE_IDS.length);
  assert.equal(TEMPLATE_IDS.length, 30);
  assert.deepEqual(TEMPLATE_CATS, { classic: 'Classics', choice: 'Choices', reaction: 'Reactions', panels: 'Panels' });
  assert.deepEqual(MEME_CANVAS, { square: { w: 1080, h: 1080, ratio: '1:1' }, tall: { w: 1080, h: 1920, ratio: '9:16' } });
  const KEYS = new Set(['name', 'cat', 'about', 'canvas', 'bg', 'pic', 'grid', 'ask', 'shows', 'layers', 'samples', 'motion', 'cast']);
  const names = new Set();
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    assert.match(id, /^[a-z]+$/, id);
    for (const k of Object.keys(t)) assert.ok(KEYS.has(k), `${id}: an unknown key "${k}"`);
    assert.ok(typeof t.name === 'string' && t.name.length >= 3 && t.name.length <= 24, `${id}: its name`);
    assert.ok(!names.has(t.name), `${id}: its name once`);
    names.add(t.name);
    assert.ok(Object.hasOwn(TEMPLATE_CATS, t.cat), `${id}: its category`);
    assert.ok(typeof t.about === 'string' && t.about.length >= 10 && t.about.length <= 70, `${id}: its card's line`);
    assert.ok(Object.hasOwn(MEME_CANVAS, t.canvas), `${id}: its canvas`);
    assert.match(t.bg, HEX, `${id}: its color`);
    // where the AI's picture goes: inside its canvas, never empty
    assert.ok(Array.isArray(t.pic) && t.pic.length === 4 && t.pic.every((v) => typeof v === 'number' && v >= 0 && v <= 1), `${id}: pic`);
    const [x, y, w, h] = t.pic;
    assert.ok(w > 0 && h > 0 && x + w <= 1 + 1e-9 && y + h <= 1 + 1e-9, `${id}: its picture inside its canvas`);
    assert.ok(t.grid === undefined || (t.grid.length === 2 && t.grid.every((n) => Number.isInteger(n) && n >= 1 && n <= 4) && t.grid[0] * t.grid[1] > 1), `${id}: grid`);
    // the classics ask for the person's own scene (their picture says it: no "shows" of their own); the others show their own
    assert.ok(t.ask === undefined || (t.cat === 'classic' && ['scene', 'optional'].includes(t.ask)), `${id}: ask`);
    if (!t.shows) assert.equal(t.ask, 'scene', `${id}: no "shows" only when its scene is asked for`);
    else assert.ok(typeof t.shows === 'string' && t.shows.length >= 40 && t.shows.length <= 320, `${id}: shows`);
    assert.ok(t.motion === undefined || (typeof t.motion === 'string' && t.motion.length >= 20 && t.motion.length <= 120), `${id}: motion`);
    // its layers: within LAYERS' limits, each labeled once
    assert.ok(Array.isArray(t.layers) && t.layers.length >= 1 && t.layers.length <= LAYERS.MAX, `${id}: its layers`);
    assert.equal(new Set(t.layers.map((l) => l.label)).size, t.layers.length, `${id}: its labels once each`);
    for (const l of t.layers) {
      assert.ok(typeof l.label === 'string' && l.label.length >= 2 && l.label.length <= 24, `${id}: a label`);
      assert.ok(l.x - l.w / 2 >= -1e-9 && l.x + l.w / 2 <= 1 + 1e-9 && l.y - l.h / 2 >= -1e-9 && l.y + l.h / 2 <= 1 + 1e-9, `${id}/${l.label}: inside its canvas`);
    }
    // "Surprise me": at least two, one text per layer, at least one with words, each within a layer's limits
    assert.ok(Array.isArray(t.samples) && t.samples.length >= 2, `${id}: its samples`);
    for (const s of t.samples) {
      assert.ok(Array.isArray(s) && s.length === t.layers.length, `${id}: one text per layer`);
      assert.ok(s.every((v) => typeof v === 'string') && s.some((v) => v.trim()), `${id}: ${JSON.stringify(s)}`);
      for (const v of s) {
        assert.ok([...v].length <= LAYERS.TEXT_MAX && v.split('\n').length <= LAYERS.LINES_MAX, `${id}: ${v}`);
      }
    }
  }
  // every category has templates
  for (const cat of Object.keys(TEMPLATE_CATS)) assert.ok(TEMPLATE_IDS.some((id) => TEMPLATES[id].cat === cat), cat);
  // templateOf: only a template's own id
  for (const id of TEMPLATE_IDS) assert.equal(templateOf(id), TEMPLATES[id]);
  for (const no of ['nope', '', 'TOPBOTTOM', '__proto__', 'toString', 'hasOwnProperty', 5, null, undefined, {}, ['topbottom']]) assert.equal(templateOf(no), null, String(no));
});

test("templates: their layers and every sample follow the studio's rules (checkLayers and the word rules, with and without AGI-1), never a real person, a character or money", () => {
  const famous = /\b(drake|dicaprio|leonardo|harold|crowder|spongebob|spider-?man|pikachu|predator|schwarzenegger|kc green|elon|musk|trump|biden|obama|taylor swift|kanye|mrbeast|pepe|wojak|doge|kermit|homer|simpson|shrek|boyfriend|girlfriend)\b/i;
  assert.doesNotMatch(JSON.stringify(TEMPLATES), famous, 'restaged in our own words: never the originals\' people, characters or names');
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    // every word the page shows or the AI gets: the studio's rules (no links, contacts, minors, hate, adult words, real people,
    // others' characters or anything passing for AGI-1)
    const words = [t.name, t.about, t.shows || '', t.motion || '', ...t.layers.map((l) => l.label), ...t.samples.flat(),
      ...castOf(t).flatMap((r) => [r.name, r.says, r.shows || ''])];
    for (const w of words) assert.equal(trouble(w), null, `${id}: ${w}`);
    // its own layers (with their labels as words): a meme's layers as checkLayers takes them, and the word rules
    const labeled = layersOf(t, t.layers.map((l) => l.label));
    assert.equal(labeled.length, t.layers.length);
    assert.deepEqual(checkLayerWords(labeled), { ok: true }, id);
    for (const s of t.samples) {
      const raw = defaultLayers(t, s);
      // one layer for each text with words, in order, without its label (an empty text leaves its layer out)
      assert.equal(raw.length, s.filter((v) => tidyText(v)).length, `${id}: ${JSON.stringify(s)}`);
      assert.ok(raw.every((l) => !('label' in l)), id);
      assert.deepEqual(raw.map((l) => l.t), s.map(tidyText).filter(Boolean), id);
      const layers = layersOf(t, s);
      assert.deepEqual(checkLayerWords(layers), { ok: true }, `${id}: ${JSON.stringify(s)}`);
      assert.deepEqual(checkLayerWords(layers, { agi1: true }), { ok: true }, `${id}: ${JSON.stringify(s)} (with AGI-1)`);
      assert.deepEqual(checkLayers(layers), { ok: true, layers }, `${id}: checked twice, the same`);
    }
    // no words, no layers (and the template itself untouched)
    assert.deepEqual(defaultLayers(t), []);
    assert.deepEqual(checkLayers(defaultLayers(t)), { ok: false, n: 0, why: 'empty' });
    assert.ok(t.layers.every((l) => typeof l.label === 'string'), `${id}: its labels kept`);
  }
  // the buttons' third text is empty in two samples: two layers there
  assert.equal(defaultLayers(TEMPLATES.buttons, TEMPLATES.buttons.samples[0]).length, 2);
  // the word rules on a meme's layers: the first layer in trouble, and why
  assert.deepEqual(checkLayerWords([{ t: 'fine' }, { t: 'buy now, 100x soon' }]), { ok: false, field: 'layers', n: 1, why: 'money' });
  assert.deepEqual(checkLayerWords([{ t: 'see agi1studio.com' }]), { ok: false, field: 'layers', n: 0, why: 'link' });
  assert.deepEqual(checkLayerWords([{ t: 'ok' }, { t: 'ok' }, { t: 'Elon Musk vibes' }]), { ok: false, field: 'layers', n: 2, why: 'person' });
  assert.deepEqual(checkLayerWords([{ t: 'AGI-1 texts back first' }]), { ok: false, field: 'layers', n: 0, why: 'her' });
  assert.deepEqual(checkLayerWords([{ t: 'AGI-1 texts back first' }], { agi1: true }), { ok: true }, 'her own name, in a meme she\'s in');
  assert.deepEqual(checkLayerWords([{ t: 'the official AGI-1' }], { agi1: true }), { ok: false, field: 'layers', n: 0, why: 'her' }, 'never "official"');
  assert.deepEqual(checkLayerWords([]), { ok: true });
  assert.deepEqual(checkLayerWords(null), { ok: true });
});

test("checkLayers: every reason a meme's layers are refused (with the layer it's about), colors only as #rrggbb, numbers kept in their ranges, each layer with only its own keys, and checking twice changes nothing", () => {
  const ok = { t: 'Hello', x: 0.5, y: 0.5, w: 0.5, h: 0.2, s: 0.07, f: 'classic', c: '#ffffff', o: '#111111', b: '', a: 'c', u: true };
  assert.deepEqual(LAYERS, { MAX: 8, TEXT_MAX: 120, LINES_MAX: 6, S: [0.02, 0.2], W: [0.08, 1], H: [0.04, 1], CAPTION_MAX: 1000 });
  // nothing to check, or too many
  for (const raw of [undefined, null, 'x', 5, {}, []]) assert.deepEqual(checkLayers(raw), { ok: false, n: 0, why: 'empty' }, JSON.stringify(raw));
  assert.equal(checkLayers(Array(LAYERS.MAX).fill(ok)).ok, true);
  assert.deepEqual(checkLayers(Array(LAYERS.MAX + 1).fill(ok)), { ok: false, n: LAYERS.MAX, why: 'many' });
  // a layer that isn't one
  assert.deepEqual(checkLayers([ok, ok, null]), { ok: false, n: 2, why: 'bad' });
  assert.deepEqual(checkLayers([ok, [ok]]), { ok: false, n: 1, why: 'bad' });
  assert.deepEqual(checkLayers([ok, 'Hello']), { ok: false, n: 1, why: 'bad' });
  // its words: none (after tidying), too long (in characters: an emoji is one), too many lines
  for (const t of [undefined, '', '   ', '\n\n', '​‍', '️']) assert.deepEqual(checkLayers([ok, { ...ok, t }]), { ok: false, n: 1, why: 'empty' }, JSON.stringify(t));
  assert.equal(checkLayers([{ ...ok, t: 'a'.repeat(LAYERS.TEXT_MAX) }]).ok, true);
  assert.deepEqual(checkLayers([{ ...ok, t: 'a'.repeat(LAYERS.TEXT_MAX + 1) }]), { ok: false, n: 0, why: 'long' });
  assert.equal(checkLayers([{ ...ok, t: '😀'.repeat(LAYERS.TEXT_MAX) }]).ok, true, '120 emoji are 120 characters');
  assert.deepEqual(checkLayers([{ ...ok, t: '😀'.repeat(LAYERS.TEXT_MAX + 1) }]), { ok: false, n: 0, why: 'long' });
  assert.equal(checkLayers([{ ...ok, t: '👍🏽'.repeat(LAYERS.TEXT_MAX) }]).ok, true, 'a skin tone is taken off before counting');
  assert.equal(checkLayers([{ ...ok, t: '1\n2\n3\n4\n5\n6' }]).ok, true);
  assert.deepEqual(checkLayers([ok, ok, ok, { ...ok, t: '1\n2\n3\n4\n5\n6\n7' }]), { ok: false, n: 3, why: 'lines' });
  assert.equal(checkLayers([{ ...ok, t: '1\n\n\n2\r\n\r\n3\n4\n5\n6\n\n' }]).ok, true, 'empty lines don\'t count');
  // its numbers: in their ranges (the ends included), numbers or numbers written as text, nothing else
  for (const [k, v] of [['x', -0.01], ['x', 1.01], ['y', 2], ['w', 0.07], ['w', 1.01], ['h', 0.03], ['h', 1.5], ['s', 0.019], ['s', 0.21],
    ['x', NaN], ['x', Infinity], ['x', 'abc'], ['x', ''], ['x', ' '], ['x', null], ['x', undefined], ['x', true], ['x', [0.5]], ['s', '1e9']]) {
    assert.deepEqual(checkLayers([ok, { ...ok, [k]: v }]), { ok: false, n: 1, why: 'bad' }, `${k}: ${String(v)}`);
  }
  // its one layer as it's kept (and that it was kept at all)
  const kept = (l) => { const res = checkLayers([l]); assert.equal(res.ok, true, JSON.stringify(res)); return res.layers[0]; };
  for (const [k, v] of [['x', 0], ['x', 1], ['y', 0], ['y', 1], ['w', 0.08], ['w', 1], ['h', 0.04], ['h', 1], ['s', 0.02], ['s', 0.2]]) {
    assert.equal(kept({ ...ok, [k]: v })[k], v, `${k}: ${v}`);
  }
  assert.deepEqual([kept({ ...ok, x: '0.25', s: ' 0.1 ' }).x, kept({ ...ok, x: '0.25', s: ' 0.1 ' }).s], [0.25, 0.1], 'numbers written as text');
  assert.deepEqual([kept({ ...ok, x: 0.123456, w: 0.333333 }).x, kept({ ...ok, x: 0.123456, w: 0.333333 }).w], [0.1235, 0.3333], 'four decimals');
  // its font, colors, outline, box, alignment and caps: only what the editor offers
  for (const [k, v] of [['f', 'comic sans'], ['f', '__proto__'], ['f', 'toString'], ['f', undefined], ['f', 'CLASSIC'],
    ['c', 'red'], ['c', '#fff'], ['c', '#12345g'], ['c', '#1234567'], ['c', ''], ['c', ' #ffffff'], ['c', '"/><script>alert(1)</script>'],
    ['o', 'black'], ['o', '#000'], ['o', 'url(#x)'], ['b', 'x'], ['b', '#ffd23f "'], ['a', 'x'], ['a', 'L'], ['a', ''], ['u', 'true'], ['u', 1], ['u', undefined], ['u', null]]) {
    assert.deepEqual(checkLayers([{ ...ok, [k]: v }]), { ok: false, n: 0, why: 'bad' }, `${k}: ${String(v)}`);
  }
  const loud = kept({ ...ok, c: '#FFD23F', o: '#ABCDEF', b: '#A259FF', a: 'r', u: false });
  assert.deepEqual([loud.c, loud.o, loud.b, loud.a, loud.u], ['#ffd23f', '#abcdef', '#a259ff', 'r', false], 'colors kept in lowercase');
  for (const f of Object.keys(MEME_FONTS)) assert.equal(checkLayers([{ ...ok, f }]).ok, true, f);
  for (const a of ['l', 'c', 'r']) assert.equal(checkLayers([{ ...ok, a }]).ok, true, a);
  // tidied, with only its own keys (a label, a style or anything else is dropped), and checking twice changes nothing
  const r = checkLayers([{ ...ok, t: '  Hello ​  there \r\n\n again ', label: 'Top', style: 'x', id: 7 }, { ...ok, c: '#FFFFFF', b: '#FFD23F', a: 'l' }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.layers[0], { t: 'Hello there\nagain', x: 0.5, y: 0.5, w: 0.5, h: 0.2, s: 0.07, f: 'classic', c: '#ffffff', o: '#111111', b: '', a: 'c', u: true });
  assert.deepEqual(Object.keys(r.layers[1]), ['t', 'x', 'y', 'w', 'h', 's', 'f', 'c', 'o', 'b', 'a', 'u']);
  assert.deepEqual(checkLayers(r.layers), r);
  assert.deepEqual(checkLayers(structuredClone(r.layers)), r, 'as our server reads them back');
  // "Add words": a new layer in the middle, which needs its words first
  assert.deepEqual(newLayer(), { t: '', x: 0.5, y: 0.5, w: 0.8, h: 0.16, s: 0.07, f: 'classic', c: '#ffffff', o: '#111111', b: '', a: 'c', u: true });
  assert.deepEqual(checkLayers([newLayer()]), { ok: false, n: 0, why: 'empty' });
  assert.deepEqual(checkLayers([newLayer('Hi')]), { ok: true, layers: [newLayer('Hi')] });
  assert.notEqual(newLayer('a'), newLayer('a'), 'a new one each time');
});

test("a meme's words tidied (new lines kept, spaces collapsed, invisible characters and emoji joiners gone), in capitals the same everywhere, and its caption counted in characters (an emoji is one)", () => {
  for (const [given, want] of [
    ['  a   b  ', 'a b'], ['a\r\nb\rc', 'a\nb\nc'], ['\n\n a \n\n b\n', 'a\nb'], ['ｆｕｌｌ ｗｉｄｔｈ', 'full width'], ['ﬁne', 'fine'],
    ['a​b', 'a b'], ['a­b', 'a b'], ['a\tb', 'a b'], ['a b', 'a b'], ['a　b', 'a b'], ['a b', 'a b'],
    ['left‮right', 'left right'], ['a⁦b⁩', 'a b'], ['﻿hi', 'hi'],
    ['👩‍💻', '👩💻'], ['👍🏽', '👍'], ['❤️', '❤'], ['🏳️‍🌈', '🏳🌈'], [null, ''], [undefined, ''], [5, '5'], ['', ''],
  ]) assert.equal(tidyText(given), want, JSON.stringify(given));
  assert.equal(tidyText(tidyText('  x ‍‍ y \n\n z ')), tidyText('  x ‍‍ y \n\n z '), 'tidying twice changes nothing');
  // ALL CAPS: English rules whatever the computer's language (never a Turkish dotted İ), German ß as SS
  for (const [given, want] of [['straße', 'STRASSE'], ['istanbul', 'ISTANBUL'], ['ﬁ', 'FI'], ['hi 😀', 'HI 😀'], ['Привет', 'ПРИВЕТ'], [5, '5']]) assert.equal(upper(given), want, given);
  // its caption: one line for each layer, its own new lines as spaces
  assert.equal(layersCaption([{ t: 'a\nb' }, { t: 'c' }]), 'a b\nc');
  assert.equal(layersCaption([]), '');
  assert.equal(layersCaption(null), '');
  // cut at CAPTION_MAX characters as the database counts them (an emoji is one), never in the middle of one
  const emoji = layersCaption([{ t: '😀'.repeat(999) }, { t: 'xyz' }]);
  assert.equal([...emoji].length, LAYERS.CAPTION_MAX);
  assert.equal(emoji.length, 999 * 2 + 1);
  assert.ok(emoji.endsWith('😀\n'));
  const long = layersCaption([{ t: '😀'.repeat(1200) }]);
  assert.equal([...long].length, LAYERS.CAPTION_MAX);
  assert.equal(long.length, 2 * LAYERS.CAPTION_MAX);
  assert.doesNotMatch(long, /[\ud800-\udbff]$/, 'no lone half of an emoji at its end');
  assert.equal(layersCaption([{ t: 'x'.repeat(600) }, { t: 'y'.repeat(600) }]), `${'x'.repeat(600)}\n${'y'.repeat(399)}`);
});

test('who else fits each template (castOf, roleOf: nobody, its own roles, or someone beside the character) and what moves when it comes to life (motionOf)', () => {
  assert.deepEqual(Object.keys(CAST_BESIDE), ['id', 'name', 'says']);
  assert.equal(CAST_BESIDE.id, 'beside');
  // nobody else fits (the character alone in each panel, or alone with the picture's things)
  const alone = TEMPLATE_IDS.filter((id) => castOf(TEMPLATES[id]).length === 0);
  assert.deepEqual(alone, ['nahyeah', 'buttons', 'galaxy', 'panik', 'trade', 'thenow', 'clown']);
  for (const id of alone) {
    assert.deepEqual(castOf(TEMPLATES[id]), []);
    for (const r of ['beside', 'other', 'friend', '']) assert.equal(roleOf(TEMPLATES[id], r), null, `${id}: ${r}`);
  }
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const cast = castOf(t);
    if (!Array.isArray(t.cast)) {
      // no roles said: someone beside the character
      assert.deepEqual(cast, [CAST_BESIDE], id);
      assert.equal(roleOf(t, 'beside'), CAST_BESIDE, id);
    } else assert.equal(cast, t.cast, id);
    assert.equal(new Set(cast.map((r) => r.id)).size, cast.length, `${id}: each role once`);
    for (const r of cast) {
      assert.match(r.id, /^[a-z]+$/, `${id}: ${r.id}`);
      assert.ok(r.name.length >= 5 && r.name.length <= 40, `${id}: ${r.name}`);
      // who they are in the picture, said in the middle of the AI's sentence ("in this picture they are <says> (in that place…")
      assert.ok(r.says.length >= 20 && r.says.length <= 160 && /^[a-z]/.test(r.says) && !/[.!?]$/.test(r.says), `${id}: ${r.says}`);
      assert.ok(r.shows === undefined || (r.shows.length >= 40 && /\bthe character\b/i.test(r.shows)), `${id}: ${r.shows}`);
      assert.equal(roleOf(t, r.id), r, `${id}: ${r.id}`);
    }
    for (const no of ['nope', undefined, null, 'BESIDE']) assert.equal(roleOf(t, no), null, `${id}: ${no}`);
    if (Array.isArray(t.cast)) assert.equal(roleOf(t, 'beside'), null, `${id}: its own roles only`);
  }
  // a template's own roles: the stranger and the partner; the twins' other one, with the whole picture told again
  assert.deepEqual(castOf(TEMPLATES.distracted).map((r) => r.id), ['stranger', 'partner']);
  assert.match(roleOf(TEMPLATES.distracted, 'partner').says, /partner on the right/);
  assert.match(roleOf(TEMPLATES.distracted, 'stranger').says, /stranger walking past on the left/);
  const other = roleOf(TEMPLATES.pointing, 'other');
  assert.match(other.says, /on the right/);
  assert.match(other.shows, /another character, on the right/);
  assert.equal(TEMPLATES.pointing.shows.includes('another character'), false, 'its own picture is two copies of the character');
  // no template-less roles
  assert.deepEqual(castOf(null), [CAST_BESIDE]);
  assert.deepEqual(castOf(undefined), [CAST_BESIDE]);
  assert.equal(roleOf(null, 'beside'), CAST_BESIDE);
  // what moves: its own words, else the default
  assert.match(MOTION_DEFAULT, /^The character moves a little.*\.$/);
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    assert.equal(motionOf(t), t.motion || MOTION_DEFAULT, id);
  }
  assert.deepEqual(TEMPLATE_IDS.filter((id) => motionOf(TEMPLATES[id]) === MOTION_DEFAULT), ['topbottom', 'caption', 'pov', 'reaction', 'twopanel'], 'the classics move a little');
  for (const t of [null, undefined, {}, { motion: '' }, { motion: 5 }, { motion: ['x'] }]) assert.equal(motionOf(t), MOTION_DEFAULT, JSON.stringify(t));
  assert.equal(motionOf({ motion: 'It waves.' }), 'It waves.');
});

test("every template's picture: its box in the canvas's pixels (picBox), the closest shape the picture model offers (memeRatio), Standard or HD (memeQuality), square or tall (memeShape)", () => {
  const RATIOS = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16, '3:2': 3 / 2, '2:3': 2 / 3, '5:4': 5 / 4, '4:5': 4 / 5 };
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const c = canvasOf(t);
    const b = picBox(t);
    assert.deepEqual(b, { x: Math.round(t.pic[0] * c.w), y: Math.round(t.pic[1] * c.h), w: Math.round(t.pic[2] * c.w), h: Math.round(t.pic[3] * c.h) }, id);
    assert.ok(Object.values(b).every(Number.isInteger) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= c.w && b.y + b.h <= c.h, `${id}: ${JSON.stringify(b)}`);
    // the model's shape closest to its box's own (the picture is cut to fit: cover), never far from it
    const ratio = memeRatio(t);
    assert.ok(Object.hasOwn(RATIOS, ratio), `${id}: ${ratio}`);
    const off = (r) => Math.abs(Math.log(RATIOS[r] / (b.w / b.h)));
    for (const r of Object.keys(RATIOS)) assert.ok(off(ratio) <= off(r) + 1e-12, `${id}: ${ratio} over ${r}`);
    assert.ok(off(ratio) < 0.12, `${id}: ${ratio} for ${b.w}×${b.h}`);
    // HD only when its picture area is big (never blown up much): the tall canvas
    assert.equal(memeQuality(t), Math.max(b.w, b.h) > 1200 ? 'hd' : 'std', id);
    assert.equal(memeQuality(t), t.canvas === 'tall' ? 'hd' : 'std', id);
    assert.equal(memeShape(t), t.canvas === 'tall' ? 'tall' : 'square', id);
  }
  // a few of them by hand
  assert.deepEqual([memeRatio(TEMPLATES.topbottom), memeRatio(TEMPLATES.caption), memeRatio(TEMPLATES.shocked), memeRatio(TEMPLATES.nahyeah), memeRatio(TEMPLATES.galaxy), memeRatio(TEMPLATES.pov)],
    ['1:1', '4:3', '3:2', '9:16', '9:16', '9:16']);
  assert.deepEqual(picBox(TEMPLATES.caption), { x: 0, y: 281, w: 1080, h: 799 });
  assert.deepEqual(picBox(TEMPLATES.galaxy), { x: 540, y: 0, w: 540, h: 1080 });
  assert.deepEqual(picBox(TEMPLATES.pov), { x: 0, y: 0, w: 1080, h: 1920 });
  assert.deepEqual([memeQuality(TEMPLATES.pov), memeShape(TEMPLATES.pov), memeQuality(TEMPLATES.distracted), memeShape(TEMPLATES.distracted)], ['hd', 'tall', 'std', 'square']);
});

test("the share mark's box on a meme at every spot (inside its canvas, the mark picture's shape), and where it goes: the first spot of its preference its words leave free, else the one they cover least", async () => {
  // its shape: the mark's own picture's (server/media/studio-mark.png)
  const mark = await sharp(bytesOf('server/media/studio-mark.png')).metadata();
  assert.equal(MARK_RATIO, mark.height / mark.width);
  assert.deepEqual(MARK_SPOTS, ['br', 'bl', 'tr', 'tl', 'mr', 'ml']);
  for (const kind of ['photo', 'video']) assert.deepEqual([...MARK_PREFER[kind]].sort(), [...MARK_SPOTS].sort(), kind);
  assert.equal(MARK_PREFER.photo[0], 'br', 'a photo: bottom right first');
  assert.equal(MARK_PREFER.video[0], 'tl', 'a video: top left first');
  assert.equal(MARK_PREFER.video.at(-1), 'br', 'a video: bottom right last (the apps\' own buttons sit there)');
  for (const s of MARK_SPOTS) assert.equal(isMarkSpot(s), true, s);
  for (const s of ['', 'TL', 'mm', 'tc', 'zz', null, undefined, 5, ['tl']]) assert.equal(isMarkSpot(s), false, String(s));
  for (const [W, H] of [[1080, 1080], [1080, 1920], [960, 960], [720, 1280], [1280, 720], [300, 200]]) {
    const short = Math.min(W, H);
    const w = Math.max(MARK_LOOK.MIN_W, Math.round(short * MARK_LOOK.SHARE));
    const m = Math.round(short * MARK_LOOK.MARGIN);
    for (const spot of MARK_SPOTS) {
      const b = markBoxAt(W, H, spot);
      const where = `${W}×${H} ${spot}`;
      assert.ok(Object.values(b).every(Number.isInteger), where);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${where}: inside`);
      assert.equal(b.w, w, where);
      assert.ok(Math.abs(b.h - b.w * MARK_RATIO) <= 0.5, `${where}: its shape`);
      assert.equal(b.x, spot[1] === 'l' ? m : W - w - m, `${where}: x`);
      if (spot[0] === 't') assert.equal(b.y, m, where);
      else if (spot[0] === 'b') assert.equal(b.y, H - b.h - m, where);
      else assert.ok(Math.abs(b.y + b.h / 2 - H / 2) <= 0.5, `${where}: the middle of its side`);
    }
  }
  // where it goes on a 1080 square
  const W = 1080, H = 1080;
  const at = (s) => markBoxAt(W, H, s);
  const gap = Math.round(W * 0.01);
  const room = (s) => { const b = at(s); return { x: b.x - gap, y: b.y - gap, w: b.w + 2 * gap, h: b.h + 2 * gap }; };
  for (const none of [[], null, undefined]) {
    assert.equal(markSpot(none, W, H), 'br', 'a photo by default');
    assert.equal(markSpot(none, W, H, MARK_PREFER.video), 'tl');
  }
  assert.equal(markSpot([at('br')], W, H), 'bl', 'words where it would go: the next spot');
  assert.equal(markSpot([at('br'), at('bl')], W, H), 'tr');
  assert.equal(markSpot([{ x: 0, y: 500, w: W, h: H - 500 }, at('tr')], W, H), 'tl', 'the whole bottom and the top right taken');
  assert.equal(markSpot([at('tl')], W, H, MARK_PREFER.video), 'tr');
  assert.equal(markSpot([{ x: 0, y: 0, w: W, h: 300 }, { x: 0, y: 800, w: W, h: 280 }], W, H), 'mr', 'top and bottom bands: the middle of a side');
  assert.equal(markSpot([{ x: 0, y: 0, w: W, h: 300 }, { x: 0, y: 800, w: W, h: 280 }], W, H, MARK_PREFER.video), 'ml');
  // a little room around it: words within 1% of it count, words just past that don't
  const br = at('br');
  assert.equal(markSpot([{ x: br.x - gap - 50 + 1, y: br.y, w: 50, h: 10 }], W, H), 'bl');
  assert.equal(markSpot([{ x: br.x - gap - 50, y: br.y, w: 50, h: 10 }], W, H), 'br');
  // every spot covered: the one covered least (its preference's first among equals)
  assert.equal(markSpot([{ x: 0, y: 0, w: W, h: H }], W, H), 'br');
  assert.equal(markSpot([{ x: 0, y: 0, w: W, h: H }], W, H, MARK_PREFER.video), 'tl');
  const covered = [...MARK_SPOTS.filter((s) => s !== 'ml').map(room), { x: at('ml').x + 5, y: at('ml').y + 5, w: 10, h: 10 }];
  for (const s of MARK_SPOTS) assert.ok(covered.some((b) => overlap(room(s), b) > 0), `${s} covered`);
  assert.equal(markSpot(covered, W, H), 'ml', 'every spot covered: the least');
  assert.equal(markSpot(covered, W, H, MARK_PREFER.video), 'ml');
  // only the spots it's given
  assert.equal(markSpot([at('ml')], W, H, ['ml', 'mr']), 'mr');
});

test("a template's card sketch (its canvas, its picture, its panels tiling it and a box for each layer) and the editor's colors, outlines, boxes and fonts", () => {
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const c = canvasOf(t);
    const s = templateSketch(t);
    assert.deepEqual(Object.keys(s), ['w', 'h', 'bg', 'pic', 'panels', 'boxes'], id);
    assert.deepEqual([s.w, s.h, s.bg], [c.w, c.h, t.bg], id);
    assert.deepEqual(s.pic, picBox(t), id);
    // its panels: as many as its grid says, tiling its picture exactly
    const [cols, rows] = t.grid || [1, 1];
    assert.equal(s.panels.length, cols * rows, id);
    let area = 0;
    for (const p of s.panels) {
      assert.ok(p.x >= s.pic.x - 1e-9 && p.y >= s.pic.y - 1e-9 && p.x + p.w <= s.pic.x + s.pic.w + 1e-9 && p.y + p.h <= s.pic.y + s.pic.h + 1e-9, `${id}: a panel inside its picture`);
      area += p.w * p.h;
    }
    assert.ok(Math.abs(area - s.pic.w * s.pic.h) < 1e-6, `${id}: its panels fill its picture`);
    for (let i = 0; i < s.panels.length; i++) for (let j = i + 1; j < s.panels.length; j++) assert.ok(overlap(s.panels[i], s.panels[j]) < 1e-6, `${id}: panels never on each other`);
    // a box for each layer, where its words go, dark words or a tag as they'll look
    assert.equal(s.boxes.length, t.layers.length, id);
    t.layers.forEach((l, k) => {
      const b = s.boxes[k];
      assert.ok(Math.abs(b.x - (l.x - l.w / 2) * c.w) < 1e-6 && Math.abs(b.y - (l.y - l.h / 2) * c.h) < 1e-6 && Math.abs(b.w - l.w * c.w) < 1e-6 && Math.abs(b.h - l.h * c.h) < 1e-6, `${id}/${l.label}`);
      assert.ok(b.x >= -1e-6 && b.y >= -1e-6 && b.x + b.w <= c.w + 1e-6 && b.y + b.h <= c.h + 1e-6, `${id}/${l.label}: inside its canvas`);
      assert.equal(b.dark, l.c === '#111111' && !l.b, `${id}/${l.label}: dark`);
      assert.equal(b.tag, Boolean(l.b), `${id}/${l.label}: tag`);
    });
  }
  assert.equal(templateSketch(TEMPLATES.galaxy).panels.length, 4);
  assert.deepEqual(templateSketch(TEMPLATES.twopanel).panels.map((p) => [p.x, p.y, p.w, p.h]), [[0, 0, 540, 1080], [540, 0, 540, 1080]]);
  // the editor's choices: every color, outline and box a layer may use, each named once; its fonts; the fallback font
  const hi = newLayer('Hi');
  for (const [list, key, may] of [[MEME_COLORS, 'c', false], [MEME_OUTLINES, 'o', true], [MEME_BOXES, 'b', true]]) {
    assert.equal(new Set(list.map(([v]) => v)).size, list.length, key);
    assert.equal(new Set(list.map(([, n]) => n)).size, list.length, key);
    for (const [v, name] of list) {
      assert.ok(HEX.test(v) || (may && v === ''), `${key}: ${v}`);
      assert.ok(name.length >= 3 && name.length <= 12, name);
      assert.equal(checkLayers([{ ...hi, [key]: v }]).ok, true, `${key}: ${v}`);
    }
  }
  assert.ok(MEME_OUTLINES.some(([v]) => v === '') && MEME_BOXES.some(([v]) => v === ''), 'none is a choice');
  assert.deepEqual(Object.keys(MEME_FONTS), ['classic', 'comic', 'marker', 'casual', 'bold', 'clean']);
  assert.equal(new Set(Object.values(MEME_FONTS).map((f) => f.name)).size, 6);
  for (const [k, f] of Object.entries(MEME_FONTS)) {
    assert.match(f.file, /^[a-z]+-v\d+\.woff$/, k);
    assert.ok(f.lh >= 1 && f.lh <= 1.3, `${k}: its line height`);
  }
  assert.equal(MEME_FALLBACK, 'clean');
  assert.match(MEME_EMOJI_FILE, /^emoji-v\d+\.woff$/);
  assert.equal(memeFontUrl('anton-v1.woff'), '/fonts/meme/anton-v1.woff');
  assert.ok(HEX.test('#a1b2c3') && !HEX.test('#A1B2C3') && !HEX.test('#abc') && !HEX.test('a1b2c3'));
});

// ---------- the real fonts ----------
test('the meme fonts: each a real WOFF with its license beside it, the same files as the tool that makes them, read by our server once (all six and the emoji font), each drawing what it should', async () => {
  const files = [...Object.values(MEME_FONTS).map((f) => f.file), MEME_EMOJI_FILE];
  for (const file of files) {
    const b = bytesOf(`${FONT_DIR}/${file}`);
    assert.equal(b.toString('latin1', 0, 4), 'wOFF', `${file}: a WOFF`);
    assert.equal(b.readUInt32BE(8), b.length, `${file}: its own length in its header`);
    assert.ok(['00010000', '4f54544f'].includes(b.toString('hex', 4, 8)), `${file}: TrueType or CFF outlines`);
    assert.ok(b.length > 10_000 && b.length < 150_000, `${file}: ${b.length} bytes (subset)`);
  }
  // the tool that makes them (tools/studio/meme-fonts.py): the same files, each font's license beside it
  const py = read('tools/studio/meme-fonts.py');
  const version = py.match(/^VERSION = '(v\d+)'$/m)?.[1];
  assert.ok(version);
  const made = [...py.matchAll(/^\s+'([a-z]+)': \('([^']+\.ttf)', (?:[A-Z_ +]+|None), '([^']+\.txt)'\),?$/gm)].map((m) => ({ key: m[1], license: m[3] }));
  assert.equal(made.length, 7);
  assert.deepEqual(made.map((m) => `${m.key}-${version}.woff`).sort(), [...files].sort());
  const inDir = readdirSync(new URL(`../${FONT_DIR}/`, import.meta.url));
  assert.deepEqual(inDir.filter((f) => f.endsWith('.woff')).sort(), [...files].sort(), 'only these fonts there');
  assert.deepEqual(inDir.filter((f) => f.endsWith('.txt')).sort(), made.map((m) => m.license).sort(), 'each font\'s license, and nothing else');
  for (const { key, license } of made) {
    const text = read(`${FONT_DIR}/${license}`);
    if (license.includes('Apache')) assert.match(text, /Apache License\s+Version 2\.0/, `${key}: Apache 2.0`);
    else assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/, `${key}: the SIL Open Font License`);
  }
  // our server names each file as the page does (Vercel's file tracer ships what's named)
  const server = read('server/meme-render.js');
  for (const [k, { file }] of Object.entries(MEME_FONTS)) assert.ok(server.includes(`${k}: read(readFileSync(new URL('../public/fonts/meme/${file}', import.meta.url)))`), k);
  assert.ok(server.includes(`emoji: read(readFileSync(new URL('../public/fonts/meme/${MEME_EMOJI_FILE}', import.meta.url)))`));
  // read once per server copy
  const fonts = await memeFonts();
  assert.ok(await memeFonts() === fonts, 'the same fonts, read once');
  assert.deepEqual(Object.keys(fonts), [...Object.keys(MEME_FONTS), 'emoji']);
  for (const [k, font] of Object.entries(fonts)) assert.ok(font.unitsPerEm > 0 && typeof font.charToGlyphIndex === 'function', k);
  // what each draws: the display fonts every printable ASCII character (and Latin letters with accents), Clean Greek and
  // Cyrillic too (the display fonts' fallback), the emoji font every emoji the tool keeps and no letters
  const has = (font, ch) => font.charToGlyphIndex(ch) > 0;
  const ascii = Array.from({ length: 0x7e - 0x21 + 1 }, (_, k) => String.fromCharCode(0x21 + k));
  const accents = [...'éñßøĉệŐ€™àüöçÉÑÜ'];
  for (const ch of accents) assert.ok(has(fonts.clean, ch), `clean: ${ch}`);
  for (const k of Object.keys(MEME_FONTS)) {
    for (const ch of ascii) assert.ok(has(fonts[k], ch), `${k}: ${ch}`);
    // a letter with an accent its own font hasn't drawn comes from Clean (fontFor), never left out
    for (const ch of accents) assert.equal(fontName(fonts, fontFor(fonts, k, ch)), has(fonts[k], ch) ? k : 'clean', `${k}: ${ch}`);
    for (const ch of 'éñßüç') assert.ok(has(fonts[k], ch), `${k}: its own ${ch}`);
    assert.equal(has(fonts[k], 'Ж') && has(fonts[k], 'Ω'), k === 'clean', `${k}: Greek and Cyrillic only in Clean`);
  }
  const emojiList = [...new Set([...[...py.match(/EMOJI = \(\n([\s\S]*?)\n\)/)[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('')])];
  assert.ok(emojiList.length > 250, `${emojiList.length} emoji`);
  for (const ch of emojiList) assert.ok(has(fonts.emoji, ch), `the emoji font: ${ch}`);
  assert.ok(ascii.every((ch) => !has(fonts.emoji, ch)), 'the emoji font: no letters');
  // every font lays out every character it has, alone and next to others: opentype.js applies its substitutions as it does,
  // and a lookup it can't apply throws (Comic's 'ccmp' did, for any two letters, until 2026-10-14: the tool leaves it out)
  const py2 = py.match(/^NOT_FEATURES = (\{.*\})$/m)?.[1];
  assert.equal(py2, "{'bangers': ['ccmp']}", "the tool leaves Comic's ccmp out");
  for (const [k, font] of Object.entries(fonts)) {
    const cps = Object.keys(font.tables.cmap.glyphIndexMap).map(Number).filter((c) => c > 0x20).sort((a, b) => a - b);
    const all = String.fromCodePoint(...cps);
    assert.doesNotThrow(() => { font.getPath(all, 0, 0, 40); font.getAdvanceWidth(all, 40); }, `${k}: all of its ${cps.length} characters in a row`);
    for (let i = 0; i < cps.length; i += 7) {
      const pair = String.fromCodePoint(cps[i], cps[(i * 13 + 5) % cps.length], cps[(i + 1) % cps.length]);
      assert.doesNotThrow(() => font.getPath(pair, 0, 0, 20), `${k}: ${pair}`);
    }
  }
});

test("which font draws a character (the layer's own, else Clean, else the emoji font), the characters none of them has (missingChars, undrawable) and when the page needs the emoji font", async () => {
  const fonts = await memeFonts();
  // a few characters none of the seven fonts has (Chinese, Thai, an emoji the tool doesn't keep)
  for (const ch of ['中', '文', 'ก', '🦖']) for (const [k, font] of Object.entries(fonts)) assert.equal(font.charToGlyphIndex(ch), 0, `${k} has no ${ch}`);
  for (const k of Object.keys(MEME_FONTS)) {
    const from = (ch) => fontName(fonts, fontFor(fonts, k, ch));
    assert.deepEqual(['A', 'Ж', '😀', '中'].map(from), [k, 'clean', 'emoji', null], `${k}: its own letters, Cyrillic from Clean, an emoji from the emoji font, nobody's`);
  }
  assert.equal(fontName(fonts, fontFor(fonts, 'nope', 'A')), 'clean', 'a font that isn\'t one: Clean');
  // the characters no font draws, each once (spaces and new lines aren't characters to draw)
  assert.deepEqual(missingChars(fonts, 'classic', 'Hi 中中文\n🦖 ok 中'), ['中', '文', '🦖']);
  assert.deepEqual(missingChars(fonts, 'marker', 'Hello 😀 Привет ệ'), []);
  assert.deepEqual(missingChars(fonts, 'classic', ''), []);
  // the page loads the emoji font only for what the layer's font and Clean can't draw
  assert.equal(needsEmoji(fonts, 'classic', 'Hello there'), false);
  assert.equal(needsEmoji(fonts, 'classic', 'Привет Ωμέγα'), false);
  assert.equal(needsEmoji(fonts, 'casual', 'gm 😀'), true);
  assert.equal(needsEmoji(fonts, 'clean', '\n \n'), false);
  // the first layer with a character no font draws (our server says so before it's saved)
  assert.equal(await undrawable([{ t: 'Hello 😀 Привет', f: 'classic' }, { t: 'Ωμέγα ß ệ 💜', f: 'bold' }]), null);
  assert.deepEqual(await undrawable([{ t: 'Hello', f: 'classic' }, { t: 'Hi 中 ok 中', f: 'casual' }, { t: 'ก', f: 'bold' }]), { n: 1, chars: ['中'] });
  assert.deepEqual(await undrawable([{ t: 'ก 🦖', f: 'clean' }]), { n: 0, chars: ['ก', '🦖'] });
  assert.equal(await undrawable([]), null);
  assert.equal(await undrawable(null), null);
  // tidied first, a skin-toned thumb is a thumb it draws
  assert.equal(await undrawable(checkLayers([{ ...newLayer('nice 👍🏽 ❤️') }]).layers), null);
});

test('words fitted to their box (wrapLines, fitLayer, layerShape): wrapped at the box\'s width, their own lines kept, the biggest size up to their own that fits, smaller for longer words, aligned left, middle or right, inside the box', async () => {
  const fonts = await memeFonts();
  const W = 1080, H = 1080;
  const font = fonts.classic;
  const width = (s, size) => font.getAdvanceWidth(s, size, { kerning: true });
  // wrapped: one line when it fits, their own new lines kept, extra spaces gone, never wider than the line (a word wider than a
  // whole line broken where it has to be)
  assert.deepEqual(wrapLines(fonts, 'classic', 'one two three', 60, 10_000), ['one two three']);
  assert.deepEqual(wrapLines(fonts, 'classic', 'one\n\ntwo  three', 60, 10_000), ['one', 'two three']);
  assert.deepEqual(wrapLines(fonts, 'classic', '1\n2\n3\n4\n5\n6', 60, 10_000).length, 6);
  const para = 'When the coffee finally kicks in and the whole day suddenly looks possible again';
  const lines = wrapLines(fonts, 'classic', para, 60, 300);
  assert.ok(lines.length > 2);
  assert.equal(lines.join(' '), para, 'every word, in order');
  for (const l of lines) assert.ok(width(l, 60) <= 300 + 1e-9, l);
  const word = 'W'.repeat(40);
  const broken = wrapLines(fonts, 'classic', `go ${word} now`, 60, 300);
  assert.ok(broken.length >= 3 && broken[0] === 'go', JSON.stringify(broken));
  assert.equal(broken.join('').replace(/ /g, ''), `go${word}now`, 'every letter, in order');
  for (const l of broken) assert.ok(width(l, 60) <= 300 + 1e-9, l);
  // fitted: its own size when it fits, in capitals when asked, its line height its font's
  for (const f of LAID_OUT) {
    const short = fitLayer(fonts, { ...newLayer('Hi there'), f, s: 0.07, u: true }, W, H);
    assert.equal(short.size, 0.07 * W, f);
    assert.equal(short.text, 'HI THERE', f);
    assert.equal(short.lh, short.size * MEME_FONTS[f].lh, f);
    assert.deepEqual(short.lines, ['HI THERE'], f);
    assert.equal(fitLayer(fonts, { ...newLayer('Hi there'), f, u: false }, W, H).text, 'Hi there', f);
    // longer words: never bigger, and they fit the box
    let last = Infinity;
    for (const n of [1, 4, 8, 16, 24]) {
      const t = Array.from({ length: n }, () => 'word').join(' ');
      const fit = fitLayer(fonts, { ...newLayer(t), f, w: 0.9, h: 0.2, s: 0.1 }, W, H);
      assert.ok(fit.size <= last + 1e-9, `${f}: ${n} words`);
      assert.ok(fit.lines.length * fit.lh <= 0.2 * H + 1e-6, `${f}: ${n} words fit`);
      assert.ok(fit.lines.every((l) => fit.text.includes(l)), f);
      last = fit.size;
    }
    assert.ok(last < 0.1 * W, `${f}: smaller for longer words`);
    // the smallest box can't hold six lines: 8 px is as small as words get (they run over it then)
    const tiny = fitLayer(fonts, { ...newLayer('1\n2\n3\n4\n5\n6'), f, w: LAYERS.W[0], h: LAYERS.H[0], s: 0.2 }, W, H);
    assert.equal(tiny.size, 8, f);
    assert.equal(tiny.lines.length, 6, f);
    assert.ok(tiny.lines.length * tiny.lh > LAYERS.H[0] * H, `${f}: past its box at 8 px`);
  }
  // inside its box (a glyph's own overhang and descenders past the line's edges: at most a fraction of the size), aligned as asked
  const texts = ['Hi', 'Quick jumpy foxes, gently waltzing; by "quiet" brigades: Zephyrs & Qq gyp jq, all day long with snacks and naps okay?',
    'one\ntwo\nthree\nfour\nfive\nsix', 'Supercalifragilisticexpialidociousnessly', 'gm 😀💜🔥 ok', 'Привет, Ωμέγα: ệ ñ ß', 'jjj ggg yyy ppp qqq ÇĘĄ'];
  const BOXES = [[0.5, 0.2, 0.2], [0.94, 0.18, 0.105], [0.3, 0.5, 0.06], [0.28, 0.14, 0.042]];
  let n = 0;
  for (const f of LAID_OUT) for (const t of texts) for (const [w, h, s] of BOXES) {
    // the two longest only in the widest box and the smallest (each wrapped the most there: they take the longest to lay out)
    if (t.length > 30 && w !== 0.94 && w !== 0.28) continue;
    // each alignment and both cases in turn (the alignment never changes the size: that's checked below)
    const a = ['l', 'c', 'r'][n % 3], u = Math.floor(n / 3) % 2 === 0;
    n++;
    const l = { ...newLayer(t), f, a, u, w, h, s, x: 0.5, y: 0.5 };
    const where = `${f} ${a} ${u} ${w}×${h} ${JSON.stringify(t.slice(0, 14))}`;
    const sh = layerShape(fonts, l, W, H);
    assert.ok(sh.lines * sh.size * MEME_FONTS[f].lh <= h * H + 1e-6, `${where}: fits`);
    if (n % 4 === 1) {
      // its shape is its fitted words (fitLayer), whichever way it's aligned
      const fit = fitLayer(fonts, l, W, H);
      assert.deepEqual([sh.size, sh.lines], [fit.size, fit.lines.length], where);
      assert.equal(layerShape(fonts, { ...l, a: a === 'l' ? 'r' : 'l' }, W, H).size, sh.size, `${where}: its size whatever its alignment`);
    }
    const left = (0.5 - w / 2) * W, right = (0.5 + w / 2) * W, top = (0.5 - h / 2) * H, bottom = (0.5 + h / 2) * H;
    const { x1, y1, x2, y2 } = sh.bbox;
    assert.ok(x1 >= left - 0.15 * sh.size && x2 <= right + 0.15 * sh.size, `${where}: inside its box's sides`);
    assert.ok(y1 >= top - 0.25 * sh.size && y2 <= bottom + 0.25 * sh.size, `${where}: inside its box's top and bottom`);
    assert.ok(x2 > x1 && y2 > y1, where);
    assert.match(sh.d, /^M[-0-9.]+ [-0-9.]+/, where);
    assert.equal(sh.stroke, Math.max(1, sh.size * OUTLINE), `${where}: its outline`);
    assert.equal(sh.bg, null, `${where}: no box`);
  }
  // aligned: its words start at the box's left, end at its right, or sit in its middle
  for (const f of LAID_OUT) {
    const l = { ...newLayer('Hello there'), f, x: 0.5, y: 0.5, w: 0.8, h: 0.2, s: 0.05, u: false, o: '' };
    const at = (a) => layerShape(fonts, { ...l, a }, W, H);
    const [L, C, R] = ['l', 'c', 'r'].map(at);
    assert.ok(Math.abs(L.bbox.x1 - 0.1 * W) <= 0.12 * L.size, `${f}: left ${L.bbox.x1}`);
    assert.ok(Math.abs(R.bbox.x2 - 0.9 * W) <= 0.12 * R.size, `${f}: right ${R.bbox.x2}`);
    assert.ok(Math.abs((C.bbox.x1 + C.bbox.x2) / 2 - 0.5 * W) <= 0.1 * C.size, `${f}: middle`);
    assert.ok(Math.abs((C.bbox.y1 + C.bbox.y2) / 2 - 0.5 * H) <= 0.25 * C.size, `${f}: middle, top to bottom`);
    assert.equal(L.stroke, 0, 'no outline');
    // a box behind its words: around them, its corners rounded
    const boxed = layerShape(fonts, { ...l, b: '#ffd23f' }, W, H);
    const { x1, y1, x2, y2 } = boxed.bbox;
    const padX = boxed.size * 0.28, padY = boxed.size * 0.2;
    assert.deepEqual(boxed.bg, { x: x1 - padX, y: y1 - padY, w: x2 - x1 + 2 * padX, h: y2 - y1 + 2 * padY, r: boxed.size * 0.18 }, f);
    assert.ok(boxed.d === C.d && boxed.size === C.size && boxed.stroke === 0, `${f}: a box changes nothing of its letters`);
    assert.equal(C.bg, null, `${f}: no box without one`);
  }
  // every template's samples: inside their boxes
  for (const id of TEMPLATE_IDS) {
    const tpl = TEMPLATES[id];
    const c = canvasOf(tpl);
    for (const s of tpl.samples) for (const l of layersOf(tpl, s)) {
      const sh = layerShape(fonts, l, c.w, c.h);
      const where = `${id}: ${l.t}`;
      assert.ok(sh.bbox.x1 >= (l.x - l.w / 2) * c.w - 0.05 * sh.size && sh.bbox.x2 <= (l.x + l.w / 2) * c.w + 0.05 * sh.size, where);
      assert.ok(sh.bbox.y1 >= (l.y - l.h / 2) * c.h - 0.05 * sh.size && sh.bbox.y2 <= (l.y + l.h / 2) * c.h + 0.05 * sh.size, where);
      assert.ok(sh.size <= l.s * c.w + 1e-9 && sh.size >= 8, where);
    }
  }
  // no words: nothing to draw, in the middle of its box
  const none = layerShape(fonts, { ...newLayer(''), x: 0.25, y: 0.75 }, W, H);
  assert.equal(none.d, '');
  assert.deepEqual(none.bbox, { x1: 0.25 * W, y1: 0.75 * H, x2: 0.25 * W, y2: 0.75 * H });
});

test("a meme's words as an SVG of shapes only (no text, font, link, script or picture in it, only #rrggbb colors), each layer's word box, and the page's canvas drawing the same shapes", async () => {
  const fonts = await memeFonts();
  const r = checkLayers([
    { t: '"><script>alert(1)</script> & <image href=x onload=y>', x: 0.5, y: 0.2, w: 0.9, h: 0.2, s: 0.08, f: 'classic', c: '#FFFFFF', o: '#111111', b: '', a: 'c', u: true },
    { t: "url(javascript:x) font-family: 'x'; style", x: 0.5, y: 0.5, w: 0.8, h: 0.15, s: 0.06, f: 'clean', c: '#ff3b30', o: '', b: '#FFD23F', a: 'l', u: false },
    { t: 'plain 😀 Привет', x: 0.5, y: 0.8, w: 0.8, h: 0.15, s: 0.06, f: 'marker', c: '#2f80ff', o: '#ffffff', b: '#111111', a: 'r', u: false },
  ]);
  assert.equal(r.ok, true);
  const svg = layersSvg(fonts, r.layers, 1080, 1080, { outW: 720, outH: 720 });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 1080 1080">'), svg.slice(0, 120));
  assert.ok(svg.endsWith('</svg>'));
  assert.deepEqual([...new Set([...svg.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]))].sort(), ['path', 'rect', 'svg']);
  const ATTRS = new Set(['xmlns', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'x', 'y', 'rx']);
  for (const [, name] of svg.matchAll(/\s([a-zA-Z:-]+)="/g)) assert.ok(ATTRS.has(name), name);
  assert.doesNotMatch(svg, /<text|font|url\(|script|<image|href|style|foreignObject|\son[a-z]+=|&|javascript/i, 'nothing but shapes: the words\' own letters never appear');
  for (const [, v] of svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)) assert.ok(v === 'none' || HEX.test(v), v);
  for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) assert.match(d, /^[MLCQZ0-9. -]+$/, 'path data: commands and numbers');
  // one path for each layer's letters, one more for an outline; a rect for a box
  assert.equal(svg.match(/<path /g).length, 3 + 2);
  assert.equal(svg.match(/<rect /g).length, 2);
  // its own size by default; nothing to draw, nothing drawn
  assert.ok(layersSvg(fonts, r.layers, 1080, 1920).startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'));
  assert.equal(layersSvg(fonts, [], 1080, 1080), '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"></svg>');
  assert.equal(layersSvg(fonts, null, 960, 960, { outW: 480, outH: 480 }), '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 960 960"></svg>');
  // where each layer's words are: its box (when it has one), else its letters and their outline with a little room
  const boxes = wordBoxes(fonts, r.layers, 1080, 1080);
  assert.equal(boxes.length, 3);
  r.layers.forEach((l, k) => {
    const sh = layerShape(fonts, l, 1080, 1080);
    const b = boxes[k];
    if (sh.bg) assert.deepEqual(b, { x: sh.bg.x, y: sh.bg.y, w: sh.bg.w, h: sh.bg.h }, `${k}: its box`);
    else {
      const pad = sh.stroke / 2 + sh.size * 0.08;
      assert.deepEqual(b, { x: sh.bbox.x1 - pad, y: sh.bbox.y1 - pad, w: sh.bbox.x2 - sh.bbox.x1 + 2 * pad, h: sh.bbox.y2 - sh.bbox.y1 + 2 * pad }, `${k}: its letters`);
    }
    assert.ok(b.x <= sh.bbox.x1 && b.y <= sh.bbox.y1 && b.x + b.w >= sh.bbox.x2 && b.y + b.h >= sh.bbox.y2, `${k}: around its letters`);
  });
  assert.deepEqual(wordBoxes(fonts, null, 1080, 1080), []);
  // the page: the same shapes on its canvas, in order (a box, the outline, the letters in their color)
  const hadPath2D = Object.getOwnPropertyDescriptor(globalThis, 'Path2D');
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  try {
    const s = r.layers.map((l) => layerShape(fonts, l, 1080, 1080));
    // each layer's letters by their name here (their path data is long: never in a failed assert's message)
    const pathName = (d) => { const k = s.findIndex((x) => x.d === d); return k < 0 ? 'another path' : `layer ${k}'s letters`; };
    const calls = [];
    const ctx = {
      set fillStyle(v) { calls.push(['fill style', v]); }, set strokeStyle(v) { calls.push(['stroke style', v]); },
      set lineWidth(v) { calls.push(['line width', v]); }, set lineJoin(v) { calls.push(['join', v]); }, set lineCap(v) { calls.push(['cap', v]); },
      beginPath() { calls.push(['begin']); }, roundRect(...a) { calls.push(['round rect', ...a]); }, rect() { calls.push(['rect']); },
      fill(p) { calls.push(p ? ['fill', pathName(p.d)] : ['fill box']); }, stroke(p) { calls.push(['stroke', pathName(p.d)]); },
    };
    drawLayers(ctx, fonts, r.layers, 1080, 1080);
    assert.deepEqual(calls, [
      ['stroke style', '#111111'], ['line width', s[0].stroke], ['join', 'round'], ['cap', 'round'], ['stroke', "layer 0's letters"], ['fill style', '#ffffff'], ['fill', "layer 0's letters"],
      ['fill style', '#ffd23f'], ['begin'], ['round rect', s[1].bg.x, s[1].bg.y, s[1].bg.w, s[1].bg.h, s[1].bg.r], ['fill box'], ['fill style', '#ff3b30'], ['fill', "layer 1's letters"],
      ['fill style', '#111111'], ['begin'], ['round rect', s[2].bg.x, s[2].bg.y, s[2].bg.w, s[2].bg.h, s[2].bg.r], ['fill box'],
      ['stroke style', '#ffffff'], ['line width', s[2].stroke], ['join', 'round'], ['cap', 'round'], ['stroke', "layer 2's letters"], ['fill style', '#2f80ff'], ['fill', "layer 2's letters"],
    ]);
    // a canvas without roundRect: a plain rect
    const old = [];
    drawLayers({ ...ctx, roundRect: undefined, rect: () => old.push('rect'), beginPath: () => old.push('begin'), fill: (p) => old.push(p ? 'fill' : 'fill box') }, fonts, [r.layers[1]], 1080, 1080);
    assert.deepEqual(old, ['begin', 'rect', 'fill box', 'fill']);
  } finally {
    if (hadPath2D) Object.defineProperty(globalThis, 'Path2D', hadPath2D);
    else delete globalThis.Path2D;
  }
});

test("a meme put together on our server: the AI's picture cut to its box whatever its shape (picOf, composeBase: the template's color around it), and its words drawn on it with the real fonts (renderMeme: the canvas's size, a small WebP)", async () => {
  // the AI's picture: 600 × 400, red on the left half, blue on the right
  const halves = await solid(600, 400, '#ff0000').composite([{ input: await solid(300, 400, '#0000ff').png().toBuffer(), left: 300, top: 0 }]).png().toBuffer();
  const RED = [255, 0, 0], BLUE = [0, 0, 255];
  // a band of color above it (caption), on its right (nahyeah), on its left (galaxy), none (topbottom), and the tall canvas (pov)
  for (const id of ['caption', 'nahyeah', 'galaxy', 'topbottom', 'pov']) {
    const tpl = TEMPLATES[id];
    const c = canvasOf(tpl);
    const p = picBox(tpl);
    const pic = await picOf(sharp, halves, tpl);
    const pm = await sharp(pic).metadata();
    assert.deepEqual([pm.format, pm.width, pm.height], ['jpeg', p.w, p.h], `${id}: its picture exactly its box's size`);
    const inPic = await pixelsOf(pic);
    near(inPic(4, p.h >> 1), RED, 12, `${id}: cut from its middle (its left)`);
    near(inPic(p.w - 5, p.h >> 1), BLUE, 12, `${id}: (its right)`);
    const base = await composeBase(sharp, halves, tpl);
    const bm = await sharp(base).metadata();
    assert.deepEqual([bm.format, bm.width, bm.height], ['jpeg', c.w, c.h], `${id}: its canvas`);
    const inBase = await pixelsOf(base);
    near(inBase(p.x + 6, p.y + (p.h >> 1)), RED, 12, `${id}: its picture in its box`);
    near(inBase(p.x + p.w - 7, p.y + (p.h >> 1)), BLUE, 12, `${id}: its picture in its box`);
    const bg = [1, 3, 5].map((k) => parseInt(tpl.bg.slice(k, k + 2), 16));
    if (p.y > 0) near(inBase(c.w >> 1, p.y >> 1), bg, 8, `${id}: its color above its picture`);
    if (p.x > 0) near(inBase(p.x >> 1, c.h >> 1), bg, 8, `${id}: its color left of its picture`);
    if (p.x + p.w < c.w) near(inBase(p.x + p.w + ((c.w - p.x - p.w) >> 1), c.h >> 1), bg, 8, `${id}: its color right of its picture`);
    // its picture already cut (picOf's) is put on as it is
    if (id === 'caption' || id === 'galaxy') near(await pixel(await composeBase(sharp, pic, tpl), p.x + 6, p.y + (p.h >> 1)), RED, 12, `${id}: from its cut picture`);
  }
  // the template's own color, whatever it is (every template with a band of color has a white one: a green one here)
  const green = await pixelsOf(await composeBase(sharp, halves, { ...TEMPLATES.caption, bg: '#22aa55' }));
  near(green(540, 140), [0x22, 0xaa, 0x55], 8, 'its own color above its picture');
  near(green(200, 700), RED, 12, 'its picture under it');
  // a tall picture for a wide box, and one a camera saved turned (it's turned first, then cut)
  const tall = await solid(400, 1000, '#00ff00').png().toBuffer();
  assert.deepEqual(await sharp(await picOf(sharp, tall, TEMPLATES.caption)).metadata().then((m) => [m.width, m.height]), [1080, 799]);
  const turned = await sharp(halves).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.equal((await sharp(turned).metadata()).orientation, 6);
  const tp = await pixelsOf(await picOf(sharp, turned, TEMPLATES.topbottom));
  near(tp(540, 20), RED, 12, 'turned: its left half on top');
  near(tp(540, 1059), BLUE, 12, 'turned: its right half at the bottom');
  await assert.rejects(picOf(sharp, Buffer.from('not a picture'), TEMPLATES.topbottom));
  // its words, drawn on a gray picture: where they are and nowhere else
  const gray = await solid(1080, 1080, '#808080').jpeg().toBuffer();
  const tpl = TEMPLATES.topbottom;
  const layers = layersOf(tpl, tpl.samples[0]);
  const { jpg, webp } = await renderMeme(sharp, gray, layers, tpl);
  assert.deepEqual(await sharp(jpg).metadata().then((m) => [m.format, m.width, m.height]), ['jpeg', 1080, 1080]);
  assert.deepEqual(await sharp(webp).metadata().then((m) => [m.format, m.width, m.height]), ['webp', 384, 384]);
  const fonts = await memeFonts();
  const [top, bottom] = wordBoxes(fonts, layers, 1080, 1080).map((b) => ({ left: Math.round(b.x), top: Math.round(b.y), width: Math.round(b.w), height: Math.round(b.h) }));
  const [drawn, plain] = await Promise.all([rgbOf(jpg), rgbOf(gray)]);
  assert.ok(changedIn(drawn, plain, top) > 0.2, 'its top words drawn');
  assert.ok(changedIn(drawn, plain, bottom) > 0.2, 'its bottom words drawn');
  assert.ok(changedIn(drawn, plain, { left: 290, top: 290, width: 500, height: 500 }) < 0.001, 'nothing drawn between them');
  assert.ok(changedIn(drawn, plain, { left: 0, top: top.top + top.height + 10, width: 1080, height: bottom.top - top.top - top.height - 20 }) < 0.001, 'nothing drawn across its middle');
  // a tall meme from a picture of another size: its canvas's size, its WebP 384 on its longest side
  const tallTpl = TEMPLATES.pov;
  const t = await renderMeme(sharp, await solid(500, 900, '#808080').jpeg().toBuffer(), layersOf(tallTpl, tallTpl.samples[0]), tallTpl);
  assert.deepEqual(await sharp(t.jpg).metadata().then((m) => [m.width, m.height]), [1080, 1920]);
  assert.deepEqual(await sharp(t.webp).metadata().then((m) => [m.width, m.height]), [216, 384]);
});

test("only a meme's words on a see-through picture of a video's size (wordsPng), and where the share mark goes on each template (markSpotFor): its words' boxes, a photo's preference or a video's, never on its words", async () => {
  const fonts = await memeFonts();
  const tpl = TEMPLATES.topbottom;
  const layers = layersOf(tpl, tpl.samples[1]);
  const png = await wordsPng(sharp, layers, tpl, 960, 960);
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.channels, meta.hasAlpha], ['png', 960, 960, 4, true]);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const k = 960 / 1080;
  const boxes = wordBoxes(fonts, layers, 1080, 1080).map((b) => ({ x: b.x * k - 2, y: b.y * k - 2, w: b.w * k + 4, h: b.h * k + 4 }));
  let ink = 0;
  const outside = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] === 0) continue;
      ink++;
      if (!boxes.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) outside.push(`${x},${y}`);
    }
  }
  assert.deepEqual(outside.slice(0, 5), [], `ink outside its words (${outside.length} pixels)`);
  assert.ok(ink / (960 * 960) > 0.03 && ink / (960 * 960) < 0.4, `its words: ${ink} pixels`);
  assert.equal((await pixel(png, 480, 480))[3], 0, 'see-through where there are no words');
  // its canvas's size by default, and whole pixels
  assert.deepEqual(await sharp(await wordsPng(sharp, layers, tpl)).metadata().then((m) => [m.width, m.height]), [1080, 1080]);
  const pov = TEMPLATES.pov;
  assert.deepEqual(await sharp(await wordsPng(sharp, layersOf(pov, pov.samples[0]), pov, 719.6, 1280.4)).metadata().then((m) => [m.width, m.height]), [720, 1280]);
  // where the mark goes: every template, every sample, a photo and a video
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const c = canvasOf(t);
    for (const s of t.samples) {
      const ls = layersOf(t, s);
      const words = wordBoxes(fonts, ls, c.w, c.h);
      const photo = await markSpotFor(ls, t, 'photo');
      const video = await markSpotFor(ls, t, 'video');
      assert.equal(photo, markSpot(words, c.w, c.h, MARK_PREFER.photo), `${id}: a photo`);
      assert.equal(video, markSpot(words, c.w, c.h, MARK_PREFER.video), `${id}: a video`);
      if (s === t.samples[0]) {
        assert.equal(await markSpotFor(ls, t), photo, `${id}: a photo by default`);
        assert.equal(await markSpotFor(ls, t, 'gif'), photo, `${id}: anything else as a photo`);
      }
      for (const spot of [photo, video]) {
        assert.ok(isMarkSpot(spot), `${id}: ${spot}`);
        const m = markBoxAt(c.w, c.h, spot);
        assert.ok(words.every((b) => overlap(m, b) === 0), `${id}: ${JSON.stringify(s)}: the mark at ${spot} on its words`);
      }
    }
  }
  // top and bottom words: the middle of a side; words only at the bottom: the photo's goes up, the video's stays top left
  assert.equal(await markSpotFor(layersOf(TEMPLATES.topbottom, TEMPLATES.topbottom.samples[0]), TEMPLATES.topbottom, 'photo'), 'mr');
  assert.equal(await markSpotFor(layersOf(TEMPLATES.topbottom, TEMPLATES.topbottom.samples[0]), TEMPLATES.topbottom, 'video'), 'ml');
  assert.equal(await markSpotFor(layersOf(TEMPLATES.caption, TEMPLATES.caption.samples[0]), TEMPLATES.caption, 'video'), 'bl', 'its caption across the top');
  assert.equal(await markSpotFor(layersOf(TEMPLATES.reaction, TEMPLATES.reaction.samples[0]), TEMPLATES.reaction, 'photo'), 'tr', 'its words across the bottom');
});

// ---------- the share mark on a meme's photo and its video ----------
test('the share mark on a picture at every spot (markFor: the middle of a side for mr and ml, inside the frame), the page\'s boxes the same, and a photo marked where it\'s asked (markPhoto)', async () => {
  assert.equal(MEME_NEEDS_MS, MEME_VIDEO.NEEDS_MS, 'the clock\'s time a meme video needs (server/inf-jobs.js): the same number');
  assert.deepEqual([MARK.SHARE, MARK.MARGIN], [MARK_LOOK.SHARE, MARK_LOOK.MARGIN], 'our server\'s mark and the page\'s');
  const ms = await markSize(sharp);
  assert.deepEqual(ms, { width: 506, height: 108 });
  for (const [w, h] of [[1080, 1080], [1080, 1920], [960, 960], [720, 1280], [1280, 720], [300, 200]]) {
    for (const spot of MARK_SPOTS) {
      const m = await markFor(sharp, w, h, spot);
      const mm = await sharp(m.png).metadata();
      const where = `${w}×${h} ${spot}`;
      assert.equal(mm.format, 'png', where);
      assert.ok(m.left >= 0 && m.top >= 0 && m.left + mm.width <= w && m.top + mm.height <= h, `${where}: inside the frame`);
      assert.equal(mm.width, Math.max(MARK_LOOK.MIN_W, Math.round(Math.min(w, h) * MARK.SHARE)), where);
      if (spot[0] === 'm') assert.ok(Math.abs(m.top + mm.height / 2 - h / 2) <= 1, `${where}: the middle of its side`);
      // where the page says it is (memes.js markBoxAt, video-edit.js markBox from the mark's own size)
      const page = markBoxAt(w, h, spot);
      const editor = markBox(w, h, ms.width, ms.height, spot);
      for (const b of [page, editor]) {
        assert.equal(m.left, b.x, `${where}: x`);
        assert.equal(mm.width, b.w, `${where}: w`);
        assert.ok(Math.abs(m.top - b.y) <= 1 && Math.abs(mm.height - b.h) <= 1, `${where}: y, h`);
      }
    }
    const any = await markFor(sharp, w, h, 'nope');
    const br = await markFor(sharp, w, h, 'br');
    assert.deepEqual([any.left, any.top], [br.left, br.top], `${w}×${h}: a spot that isn't one is bottom right`);
  }
  // a photo: the pill where it's asked and nowhere else, its size and kind kept
  const photo = await solid(800, 600, '#3a7bd5').jpeg({ quality: 95 }).toBuffer();
  const before = await rgbOf(photo);
  const all = { left: 0, top: 0, width: 800, height: 600 };
  for (const spot of [...MARK_SPOTS, undefined, 'zz']) {
    const marked = spot === undefined ? await markPhoto(sharp, photo) : await markPhoto(sharp, photo, spot);
    assert.deepEqual(await sharp(marked).metadata().then((m) => [m.format, m.width, m.height]), ['jpeg', 800, 600]);
    const after = await rgbOf(marked);
    const want = isMarkSpot(spot) ? spot : 'br';
    for (const s of MARK_SPOTS) {
      const b = markBoxAt(800, 600, s);
      const share = changedIn(after, before, { left: b.x, top: b.y, width: b.w, height: b.h });
      if (s === want) {
        assert.ok(share > 0.5, `${spot}: the pill at ${s} (${share})`);
        // and nothing outside its box (all the pixels that changed are in it)
        assert.ok(Math.abs(changedIn(after, before, all) * 800 * 600 - share * b.w * b.h) < 1, `${spot}: nothing changed outside its box`);
      } else assert.ok(share < 0.001, `${spot}: nothing at ${s} (${share})`);
    }
  }
  assert.equal(await markPhoto(sharp, Buffer.from('not a picture')), null);
  assert.equal(await markPhoto(sharp, Buffer.alloc(0)), null, 'an empty file: nothing, never a throw');
});

test("a meme's 5-second video: its plan for every template (even sides, a part's size), ffmpeg's exact words, and composeMemeVideo with a stand-in ffmpeg (its inputs, the mark where its spot says, its folder deleted)", async () => {
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const plan = memeVideoPlan(t);
    const [W, H] = PART.SIZE[t.canvas === 'tall' ? 'tall' : 'square'];
    assert.deepEqual([plan.w, plan.h], [W, H], id);
    const { x, y, w, h } = plan.pic;
    assert.ok([x, y, w, h].every((v) => Number.isInteger(v) && v % 2 === 0), `${id}: even (${x}, ${y}, ${w}, ${h})`);
    assert.ok(x >= 0 && y >= 0 && w >= 2 && h >= 2 && x + w <= W && y + h <= H, `${id}: inside`);
    const k = W / canvasOf(t).w;
    const p = picBox(t);
    assert.ok(Math.abs(x - p.x * k) <= 2 && Math.abs(y - p.y * k) <= 2 && Math.abs(w - p.w * k) <= 2 && Math.abs(h - p.h * k) <= 2, `${id}: its picture box, scaled`);
    assert.equal(plan.bg, t.bg, id);
  }
  // a picture box whose scaled sides land on odd pixels (42 and 541 of 1080 are 37.3 and 480.9 of 960): made even all the same
  const odd = memeVideoPlan({ ...TEMPLATES.caption, pic: [42 / 1080, 42 / 1080, 541 / 1080, 541 / 1080] });
  assert.deepEqual(odd.pic, { x: 38, y: 38, w: 480, h: 480 });
  assert.deepEqual(memeVideoPlan(TEMPLATES.caption), { w: 960, h: 960, pic: { x: 0, y: 250, w: 960, h: 710 }, bg: '#ffffff' });
  assert.deepEqual(memeVideoPlan(TEMPLATES.galaxy).pic, { x: 480, y: 0, w: 480, h: 960 });
  assert.deepEqual(memeVideoPlan(TEMPLATES.pov), { w: 720, h: 1280, pic: { x: 0, y: 0, w: 720, h: 1280 }, bg: '#111111' });
  assert.equal(memeVideoPlan({ ...TEMPLATES.caption, bg: '#ABCDEF' }).bg, '#abcdef');
  for (const bg of ['red', '', undefined, '#fff', 'x"; drawtext']) assert.equal(memeVideoPlan({ ...TEMPLATES.caption, bg }).bg, '#ffffff', String(bg));
  // ffmpeg's words: cut to fit its box (cover), padded to the canvas in its color, its words over it, the mark over them; H.264
  // superfast at 2.5 Mb/s, its sound (if any) copied as it is, its index first, the output last
  const plan = memeVideoPlan(TEMPLATES.caption);
  assert.deepEqual(memeVideoArgs({ input: '/t/in.mp4', words: '/t/words.png', mark: '/t/mark.png', output: '/t/out.mp4', plan, mx: 34, my: 852 }), [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', '/t/in.mp4', '-i', '/t/words.png', '-i', '/t/mark.png',
    '-filter_complex', '[0:v]scale=960:710:force_original_aspect_ratio=increase,crop=960:710,setsar=1,fps=24[p];'
      + '[p]pad=960:960:0:250:color=0xffffff[b];[b][1:v]overlay=x=0:y=0:format=auto[t];[t][2:v]overlay=x=34:y=852:format=auto,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'superfast', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '5000k',
    '-c:a', 'copy', '-movflags', '+faststart', '/t/out.mp4',
  ]);
  assert.deepEqual([MEME_VIDEO.FPS, MEME_VIDEO.KBPS, MEME_VIDEO.PRESET], [24, 2500, 'superfast']);
  // made with a stand-in ffmpeg: what it's given, read before its folder goes
  const video = mp4({ width: 1080, height: 1080 });
  const made = mp4({ width: 960, height: 960, fill: 4096 });
  const words = await solid(plan.w, plan.h, { r: 0, g: 0, b: 0, alpha: 0 }, 4).png().toBuffer();
  const runs = [];
  const run = async (args, ms) => {
    const inputs = args.flatMap((a, i) => (a === '-i' ? [args[i + 1]] : []));
    runs.push({ args, ms, inputs, files: await Promise.all(inputs.map((p) => readFile(p))) });
    await writeFile(args.at(-1), made);
  };
  const spots = {};
  for (const spot of ['tl', 'br']) {
    runs.length = 0;
    const out = await composeMemeVideo(sharp, video, { plan, words, spot, run, timeoutMs: 7000 });
    assert.ok(out.equals(made), `${spot}: what ffmpeg made`);
    assert.equal(runs.length, 1);
    const [r] = runs;
    assert.equal(r.ms, 7000);
    assert.deepEqual(r.inputs.map((p) => p.split(/[\\/]/).pop()), ['in.mp4', 'words.png', 'mark.png']);
    assert.equal(r.args.at(-1).split(/[\\/]/).pop(), 'out.mp4');
    assert.ok(r.files[0].equals(video) && r.files[1].equals(words), `${spot}: its video and its words as they are`);
    const m = await markFor(sharp, plan.w, plan.h, spot);
    assert.ok(r.files[2].equals(m.png), `${spot}: the mark at the video's size`);
    const filter = r.args[r.args.indexOf('-filter_complex') + 1];
    assert.ok(filter.endsWith(`[t][2:v]overlay=x=${m.left}:y=${m.top}:format=auto,format=yuv420p[v]`), filter);
    assert.deepEqual(r.args, memeVideoArgs({ input: r.inputs[0], words: r.inputs[1], mark: r.inputs[2], output: r.args.at(-1), plan, mx: m.left, my: m.top }));
    const dir = r.inputs[0].replace(/[\\/]in\.mp4$/, '');
    assert.equal(existsSync(dir), false, `${spot}: its folder deleted`);
    spots[spot] = [m.left, m.top];
  }
  assert.deepEqual(spots, { tl: [34, 34], br: [580, 852] }, 'top left, or bottom right: 3.5% in');
  assert.equal(mp4Info(made).width, 960);
  // what it refuses: a file that isn't a video, no words picture, a stand-in that makes no video, and no ffmpeg at all
  runs.length = 0;
  await assert.rejects(composeMemeVideo(sharp, Buffer.from('nope'), { plan, words, run }), /meme video: not a video we read/);
  await assert.rejects(composeMemeVideo(sharp, video, { plan, words: null, run }), /meme video: no words picture/);
  await assert.rejects(composeMemeVideo(sharp, video, { plan, words: Buffer.alloc(0), run }), /meme video: no words picture/);
  assert.equal(runs.length, 0, 'refused before anything was run');
  await assert.rejects(composeMemeVideo(sharp, video, { plan, words, run: async (args) => { await writeFile(args.at(-1), 'nothing'); } }), /meme video: ffmpeg made no video/);
  const saved = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = '/nonexistent/agi1-memes-test-ffmpeg';
  forgetFfmpeg();
  try {
    await assert.rejects(composeMemeVideo(sharp, video, { plan, words }), (e) => e.why === 'no_ffmpeg');
  } finally {
    if (saved === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = saved;
    forgetFfmpeg();
  }
});

test('a video that carries its own mark (a meme\'s video too), where that mark is, its box at every spot, and its maker\'s words never over it (layerOf clears exactly that box)', async () => {
  // its own mark: a long video in parts, one from the video editor, and since 2026-10-14 a template meme's video
  for (const j of [{ kind: 'video', layers: [] }, { kind: 'video', layers: [{ t: 'x' }] }, { kind: 'video', template: true }, { kind: 'video', editor: true },
    { kind: 'video', model: 'long', parts: 2 }]) assert.equal(ownMark(j), true, JSON.stringify(j));
  for (const j of [{ kind: 'video' }, { kind: 'video', template: 'yes' }, { kind: 'video', layers: 'x' }, { kind: 'video', model: 'long', parts: 1 },
    { kind: 'photo', layers: [] }, { kind: 'trend', template: true }, {}, null, undefined]) assert.equal(ownMark(j), false, JSON.stringify(j));
  // where it is: its row's, its view's, its cut's, else top left
  assert.equal(markSpotOf({ mark_spot: 'br', markSpot: 'tr', cut: { spot: 'bl' } }), 'br');
  assert.equal(markSpotOf({ mark_spot: 'zz', markSpot: 'mr', cut: { spot: 'bl' } }), 'mr');
  assert.equal(markSpotOf({ cut: { spot: 'bl' } }), 'bl');
  assert.equal(markSpotOf({ mark_spot: 'BR' }), 'tl');
  for (const j of [{}, null, undefined, { cut: null }, { markSpot: '' }]) assert.equal(markSpotOf(j), 'tl', JSON.stringify(j));
  // its box at every spot (from the mark's own size), top left the same as markTopLeft, a spot that isn't one top left
  const ms = await markSize(sharp);
  for (const [w, h] of [[720, 1280], [960, 960], [1280, 720]]) {
    for (const spot of MARK_SPOTS) {
      const b = markBox(w, h, ms.width, ms.height, spot);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, `${w}×${h} ${spot}: inside`);
      assert.deepEqual(b, markBoxAt(w, h, spot), `${w}×${h} ${spot}: where the page puts it`);
    }
    assert.deepEqual(markTopLeft(w, h, ms.width, ms.height), markBox(w, h, ms.width, ms.height, 'tl'));
    assert.deepEqual(markBox(w, h, ms.width, ms.height, 'zz'), markBox(w, h, ms.width, ms.height, 'tl'));
    assert.deepEqual(markBox(w, h, ms.width, ms.height), markBox(w, h, ms.width, ms.height, 'tl'));
  }
  // its maker's words over a video with its own mark: exactly that box (and 2 pixels around it) cleared, nothing else
  const W = 720, H = 1280;
  const opaque = await solid(W, H, { r: 10, g: 200, b: 30, alpha: 1 }, 4).png().toBuffer();
  const holeOf = async (png) => {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [W, H, 4]);
    let clear = 0, x1 = Infinity, y1 = Infinity, x2 = -1, y2 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = data[(y * W + x) * 4 + 3];
        if (a === 255) continue;
        assert.equal(a, 0, `${x},${y}: see-through or not, nothing between`);
        clear++;
        x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
      }
    }
    return { clear, x1, y1, x2, y2 };
  };
  for (const [spot, want] of [['br', 'br'], ['mr', 'mr'], ['tl', 'tl'], ['zz', 'tl']]) {
    const png = await layerOf(sharp, opaque, { w: W, h: H, own: true, spot });
    assert.ok(png, spot);
    const b = markBox(W, H, ms.width, ms.height, want);
    const hole = await holeOf(png);
    assert.deepEqual(hole, { clear: (b.w + 4) * (b.h + 4), x1: b.x - 2, y1: b.y - 2, x2: b.x + b.w + 1, y2: b.y + b.h + 1 }, `${spot}: its mark's box, cleared`);
  }
  // a video without its own mark: nothing cleared (its mark goes on top left when it's made)
  assert.equal((await holeOf(await layerOf(sharp, opaque, { w: W, h: H, own: false, spot: 'br' }))).clear, 0);
  assert.equal((await holeOf(await layerOf(sharp, opaque, { w: W, h: H }))).clear, 0);
  // only a real PNG of exactly its size
  assert.equal(await layerOf(sharp, opaque, { w: W - 1, h: H, own: true, spot: 'br' }), null);
  assert.equal(await layerOf(sharp, opaque, { w: W, h: H + 2 }), null);
  assert.equal(await layerOf(sharp, Buffer.from('not a picture at all, not even close to one'), { w: W, h: H }), null);
  assert.equal(await layerOf(sharp, await sharp(opaque).jpeg().toBuffer(), { w: W, h: H }), null);
  assert.equal(await layerOf(sharp, 'a string', { w: W, h: H }), null);
});
