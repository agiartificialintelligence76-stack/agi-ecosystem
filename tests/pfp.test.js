import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import {
  TRAITS, validatePortrait, randomPortrait, encodePortrait, decodePortrait,
  portraitCode, recolorPixels, rgbToHsl, renderPortrait,
  MAX_CAP_TEXT_LENGTH, normalizeCapText,
} from '../src/pfp/engine.js';
import { BUILTIN_PAGES } from '../src/owner/catalog.js';
import { finishCharacterEdge } from '../tools/pfp/finish-character-edges.mjs';
import { CAP_SURFACES, supportsCapText, layoutCapText, paintCapText } from '../src/pfp/cap-text.js';

const keys = Object.keys(TRAITS);
const base = () => ({ version: 1, seed: '0123456789abcdef0123456789abcdef', character: 0, hair: 0, outfit: 0, backdrop: 0 });
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const gold = [233, 189, 102, 255];
const paintedHair = (config) => [...recolorPixels(new Uint8ClampedArray(gold), config)];

test('PFP recipes validate every index and reject malformed untrusted configurations', () => {
  assert.equal(validatePortrait(base()), true);
  const invalid = [null, undefined, false, 1, '', [], {},
    { ...base(), version: '1' }, { ...base(), version: 2 },
    { ...base(), seed: '' }, { ...base(), seed: 'a'.repeat(31) },
    { ...base(), seed: 'a'.repeat(33) }, { ...base(), seed: 'A'.repeat(32) },
    { ...base(), seed: 'g'.repeat(32) }, { ...base(), seed: 123 },
  ];
  for (const key of keys) {
    for (const value of [-1, 0.5, NaN, Infinity, '0', null, undefined, TRAITS[key].length]) {
      invalid.push({ ...base(), [key]: value });
    }
    const missing = base();
    delete missing[key];
    invalid.push(missing);
  }
  for (const value of invalid) {
    assert.equal(validatePortrait(value), false);
    assert.throws(() => encodePortrait(value), /Invalid portrait/);
  }
});

test('PFP share recipes round-trip every selectable value, including the final choices', () => {
  for (const key of keys) {
    for (let index = 0; index < TRAITS[key].length; index++) {
      const config = { ...base(), [key]: index };
      assert.deepEqual(decodePortrait(encodePortrait(config)), config, `${key} ${index}`);
    }
  }
  const last = { ...base(), ...Object.fromEntries(keys.map((key) => [key, TRAITS[key].length - 1])) };
  assert.deepEqual(decodePortrait(encodePortrait(last)), last);
});

test('PFP existing version-one links and display IDs remain unchanged', () => {
  const releasedRecipe = '1.0123456789abcdef0123456789abcdef.0.0.0.0';
  assert.deepEqual(decodePortrait(releasedRecipe), base());
  assert.equal(encodePortrait(base()), releasedRecipe);
  assert.equal(portraitCode(base()), 'AGI-9B876E26');
});

test('PFP cap text normalizes Unicode and whitespace within the supported character limit', () => {
  assert.equal(MAX_CAP_TEXT_LENGTH, 500);
  assert.equal(normalizeCapText('  Cafe\u0301\t\n AGI\u00a0  club  '), 'Café AGI club');
  assert.equal(normalizeCapText('A\u200bB\u0000C\u202eD'), 'ABCD', 'invisible formatting and control characters do not survive into the print');
  assert.equal(normalizeCapText('👩‍💻 می\u200cروم'), '👩‍💻 می\u200cروم', 'emoji and international text keep meaningful joiners');
  assert.equal(normalizeCapText('A\ud800B\udc00C😀'), 'ABC😀', 'isolated UTF-16 surrogates are removed while valid pairs remain');
  assert.equal(normalizeCapText(' <AGI> & + / #1. '), '<AGI> & + / #1.', 'ordinary punctuation remains usable as literal text');
  for (const input of [undefined, null, 123, true, {}, []]) assert.equal(normalizeCapText(input), '');
  assert.equal(normalizeCapText('😀'.repeat(501)), '😀'.repeat(500), 'the limit counts Unicode code points without cutting a surrogate pair');
  assert.equal(normalizeCapText('a'.repeat(501)), 'a'.repeat(500));
  assert.equal(normalizeCapText(` ${'a'.repeat(500)} `), 'a'.repeat(500), 'surrounding whitespace does not consume the text limit');
  assert.equal(normalizeCapText('A\u200b\u0301'), 'Á', 'removing an invisible separator still leaves NFC text');
  const normalized = normalizeCapText('  Cafe\u0301\n猫 😀  ');
  assert.equal(normalizeCapText(normalized), normalized, 'normalization is stable');
});

test('PFP recipes accept canonical cap text and reject malformed or oversized stored text', () => {
  for (const capText of ['', 'Café 猫 😀', 'a'.repeat(500), '😀'.repeat(500)]) {
    assert.equal(validatePortrait({ ...base(), capText }), true);
  }
  for (const capText of [null, 42, false, [], {}, 'a'.repeat(501), '😀'.repeat(501), ' padded ', 'two  spaces', 'Cafe\u0301', 'A\u200bB', 'line\nbreak', '\ud800', '\udc00']) {
    const config = { ...base(), capText };
    assert.equal(validatePortrait(config), false, 'stored recipes must already contain bounded canonical text');
    assert.throws(() => encodePortrait(config), /Invalid portrait/);
  }
});

test('PFP cap text links round-trip Unicode and punctuation without changing old recipes', () => {
  for (const capText of ['AGI', 'A&B + #1/2? 100%', 'Café · AGI', '猫 / 🦄', '👩‍💻 می\u200cروم', '<svg>.AGI', 'a'.repeat(500), '😀'.repeat(500)]) {
    const config = { ...base(), capText };
    const encoded = encodePortrait(config);
    assert.match(encoded, /^2\./);
    assert.equal(encoded.split('.').length, 7, 'punctuation cannot add recipe fields');
    assert.deepEqual(decodePortrait(encoded), config);
    const shared = new URL(`https://www.agi1.app/pfp#p=${encoded}`);
    assert.deepEqual(decodePortrait(new URLSearchParams(shared.hash.slice(1)).get('p')), config, 'the real share URL preserves literal percent signs and punctuation');
    assert.notEqual(portraitCode(config), portraitCode(base()));
    assert.equal(portraitCode(decodePortrait(encoded)), portraitCode(config));
  }
  assert.notEqual(portraitCode({ ...base(), capText: 'ALICE' }), portraitCode({ ...base(), capText: 'BOB' }));
  assert.equal(encodePortrait({ ...base(), capText: '' }), encodePortrait(base()), 'empty text uses the existing version-one link');
});

test('PFP cap text share decoder rejects invalid encoding and noncanonical text', () => {
  const prefix = '2.0123456789abcdef0123456789abcdef.0.0.0.0.';
  const payload = (value) => Buffer.from(value).toString('base64url');
  const invalid = [
    `${prefix}%`, `${prefix}QQ==`, `${prefix}QR`, `${prefix}A.B`,
    `${prefix}${payload(Buffer.from([0xed, 0xa0, 0x80]))}`, `${prefix}${payload(Buffer.from([0xc0, 0xaf]))}`,
    ...[' AGI', 'AGI ', 'two  spaces', 'Cafe\u0301', 'A\u200bB', 'a'.repeat(501)].map((value) => prefix + payload(value)),
    `${prefix}${'a'.repeat(3000)}`,
  ];
  for (const recipe of invalid) assert.equal(decodePortrait(recipe), null, recipe.slice(0, 100));
});

test('PFP rerolls retain personal cap text even while another character is selected', () => {
  for (const locks of [[], ['character'], ['hair', 'outfit', 'backdrop'], keys]) {
    let current = { ...base(), capText: 'Café / AGI ♥' };
    for (let roll = 0; roll < 20; roll++) {
      const snapshot = { ...current };
      current = randomPortrait(current, locks);
      assert.equal(current.capText, snapshot.capText);
      assert.equal(validatePortrait(current), true);
      if (locks === keys) assert.deepEqual(current, snapshot);
    }
  }
});

test('PFP cap lettering is supported only on measured hat surfaces above the clothing', async () => {
  assert.equal(supportsCapText(0), true, 'the original cap supports custom lettering');
  assert.equal(supportsCapText(1), false, 'headphones are not treated as cap fabric');
  for (const value of [-1, TRAITS.character.length, 0.5, '0', null, undefined]) assert.equal(supportsCapText(value), false);
  for (const [character, quad] of Object.entries(CAP_SURFACES)) {
    assert.equal(supportsCapText(Number(character)), true);
    assert.equal(quad.length, 4);
    for (const [x, y] of quad) assert.ok(x >= 0 && x < 512 && y >= 0 && y < 200, 'the editable surface stays on the hat, clear of face and shirt');
  }
  const untouched = new Proxy({}, { get() { assert.fail('an unsupported hat or empty text must not touch the canvas'); } });
  await paintCapText(untouched, { ...base(), character: 1, capText: 'HELLO' });
  await paintCapText(untouched, { ...base(), capText: '' });
  await paintCapText(untouched, base());
});

test('PFP long cap text fits at most three lines without dropping Unicode or punctuation', () => {
  const context = {
    font: '',
    measureText(text) { return { width: Array.from(text).length * Number(/([\d.]+)px/.exec(this.font)[1]) * 0.6 }; },
  };
  for (const text of ['HELLO', 'My AGI & friends + 100%', '猫😀'.repeat(250), 'A'.repeat(500)]) {
    for (const [width, height] of [[140, 60], [64, 18]]) {
      const layout = layoutCapText(context, text, width, height);
      assert.ok(layout.size > 0 && Number.isFinite(layout.size));
      assert.ok(layout.lines.length > 0 && layout.lines.length <= 3);
      assert.equal(layout.lines.join('').replaceAll(' ', ''), text.replaceAll(' ', ''), 'fitting retains the entire requested text');
      context.font = `800 ${layout.size}px sans-serif`;
      for (const line of layout.lines) assert.ok(context.measureText(line).width <= width);
      assert.ok(layout.lines.length * layout.lineHeight <= height);
    }
  }
});

test('PFP cap ink changes only letter-mask pixels and preserves the original white shirt print', async (t) => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldFontFace = Object.getOwnPropertyDescriptor(globalThis, 'FontFace');
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document;
    if (oldFontFace) Object.defineProperty(globalThis, 'FontFace', oldFontFace); else delete globalThis.FontFace;
  });
  const printed = [];
  const ink = {
    font: '', scale() {},
    measureText(text) { return { width: Array.from(text).length * Number(/([\d.]+)px/.exec(this.font)[1]) * 0.6 }; },
    fillText(text) { printed.push(text); },
    getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      // A deterministic ink mask separates painted glyph samples from untouched fabric.
      for (let py = Math.floor(height / 3); py < height * 2 / 3; py++) {
        for (let px = Math.floor(width / 3); px < width * 2 / 3; px++) data[(py * width + px) * 4 + 3] = 255;
      }
      return { data, width, height };
    },
  };
  Object.defineProperty(globalThis, 'FontFace', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ink }) } });
  for (const character of Object.keys(CAP_SURFACES).map(Number)) {
    const source = await sharp(readFileSync(new URL(`../public/pfp/v1/character-${character}.png`, import.meta.url))).ensureAlpha().raw().toBuffer();
    const result = Buffer.from(source);
    const context = {
      getImageData(x, y, width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row++) data.set(result.subarray(((y + row) * 512 + x) * 4, ((y + row) * 512 + x + width) * 4), row * width * 4);
        return { data, width, height };
      },
      putImageData(image, x, y) {
        for (let row = 0; row < image.height; row++) result.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4), ((y + row) * 512 + x) * 4);
      },
    };
    await paintCapText(context, { ...base(), character, capText: '<AGI> 100%' });
    assert.notDeepEqual(result, source, `character ${character}: ink is visible on the supported cap`);
    assert.deepEqual(result.subarray(200 * 512 * 4), source.subarray(200 * 512 * 4), 'the face, clothing and original white AGI print stay byte-identical');
    const quad = CAP_SURFACES[character];
    const minX = Math.min(...quad.map(([x]) => x)), maxX = Math.max(...quad.map(([x]) => x));
    const minY = Math.min(...quad.map(([, y]) => y)), maxY = Math.max(...quad.map(([, y]) => y));
    let changed = 0;
    for (let offset = 0; offset < result.length; offset += 4) {
      assert.equal(result[offset + 3], source[offset + 3], 'lettering preserves source alpha');
      if (result[offset] === source[offset] && result[offset + 1] === source[offset + 1] && result[offset + 2] === source[offset + 2]) continue;
      changed++;
      const x = (offset / 4) % 512, y = Math.floor(offset / 4 / 512);
      assert.ok(x >= minX && x <= maxX && y >= minY && y <= maxY, 'ink cannot reach outside the measured cap');
    }
    assert.ok(changed < (maxX - minX) * (maxY - minY) / 2, 'unprinted cap fabric remains visible around the ink');
  }
  assert.ok(printed.some((line) => line.includes('<AGI>')), 'input reaches the text renderer as literal text');
});

test('PFP share decoder rejects oversized, incomplete, invalid-version and out-of-range hashes', () => {
  const recipe = encodePortrait(base());
  const bad = [null, undefined, {}, [], 123, '', 'a'.repeat(100_000),
    `#p=${recipe}`, `${recipe}.0`, recipe.split('.').slice(0, -1).join('.'),
    recipe.replace(/^1\./, '2.'), recipe.replace(/^1\./, '01.'),
    recipe.replace(base().seed, 'g'.repeat(32)),
    recipe.replace(base().seed, base().seed.toUpperCase()),
    recipe.replace(base().seed, '0'.repeat(31)),
    `${recipe}<script>`, `${recipe}\n`,
  ];
  for (let i = 0; i < keys.length; i++) {
    for (const value of ['-1', '0.5', '!', 'zz', TRAITS[keys[i]].length.toString(36)]) {
      const parts = recipe.split('.');
      parts[i + 2] = value;
      bad.push(parts.join('.'));
    }
  }
  for (const value of bad) assert.equal(decodePortrait(value), null, String(value).slice(0, 90));
});

test('PFP randomization preserves locked traits and changes an unlocked visible choice', () => {
  for (let mask = 0; mask < (1 << keys.length) - 1; mask++) {
    const locks = keys.filter((_, index) => mask & (1 << index));
    let previous = base();
    for (let roll = 0; roll < 30; roll++) {
      const snapshot = { ...previous };
      const next = randomPortrait(previous, locks);
      assert.ok(validatePortrait(next));
      assert.deepEqual(previous, snapshot, 'the existing pick is never mutated');
      for (const key of locks) {
        if (key === 'hair') assert.deepEqual(paintedHair(next), paintedHair(previous), 'the visible hair color remains locked');
        else assert.equal(next[key], previous[key], `${key} remains locked`);
      }
      assert.ok(keys.some((key) => !locks.includes(key) && next[key] !== previous[key]), 'the reroll changes a selectable trait');
      if (locks.includes('backdrop')) assert.equal(next.seed, previous.seed, 'the locked scene keeps its decoration');
      else assert.notEqual(next.seed, previous.seed);
      if (locks.length === 3 && !locks.includes('hair')) {
        assert.notDeepEqual(paintedHair(next), paintedHair(previous), 'a hair-only reroll visibly changes the hair');
      }
      previous = next;
    }
  }
});

test('PFP all-locked rerolls preserve the complete recipe and independent new rolls have unique seeds', () => {
  const original = base();
  const locked = randomPortrait(original, keys);
  assert.deepEqual(locked, original);
  assert.notEqual(locked, original, 'the returned recipe is a separate object');
  const seeds = new Set();
  for (let i = 0; i < 1000; i++) {
    const next = randomPortrait();
    assert.ok(validatePortrait(next));
    assert.ok(!seeds.has(next.seed), 'a fresh seed has not been used in this sample');
    seeds.add(next.seed);
  }
  assert.ok(validatePortrait(randomPortrait({ version: 99 }, keys)), 'an invalid restored recipe recovers to a valid portrait');
});

test('PFP signature hair matches each character reference and cannot cause a visually identical hair-only reroll', (t) => {
  const signatures = Array.from({ length: TRAITS.character.length }, (_, character) => character === 9 ? 2 : character === 10 ? 3 : character === 11 ? 4 : 1);
  for (let character = 0; character < signatures.length; character++) {
    const signature = { ...base(), character, hair: 0 };
    const explicit = { ...signature, hair: signatures[character] };
    assert.deepEqual(paintedHair(signature), paintedHair(explicit), `character ${character}'s reference color`);
  }
  let forcedChoice = 0;
  t.mock.method(globalThis.crypto, 'getRandomValues', (array) => {
    array.fill(array instanceof Uint32Array ? forcedChoice : 0xa5);
    return array;
  });
  for (const [character, hair, choice] of [[0, 1, 0], [9, 0, 1], [10, 0, 2], [11, 0, 3]]) {
    forcedChoice = choice;
    const previous = { ...base(), character, hair };
    const next = randomPortrait(previous, ['character', 'outfit', 'backdrop']);
    assert.notDeepEqual(paintedHair(next), paintedHair(previous), 'signature and its named color are not a false change');
    assert.equal(next.seed, previous.seed);
  }
});

test('PFP locking signature hair keeps its visible color when a different character is rolled', (t) => {
  let forcedChoice = 0;
  t.mock.method(globalThis.crypto, 'getRandomValues', (array) => {
    array.fill(array instanceof Uint32Array ? forcedChoice : 0xa5);
    return array;
  });
  for (const [character, choice] of [[0, 8], [9, 0], [10, 0], [11, 0]]) {
    forcedChoice = choice;
    const previous = { ...base(), character, hair: 0 };
    const next = randomPortrait(previous, ['hair', 'outfit', 'backdrop']);
    assert.notEqual(next.character, previous.character);
    assert.deepEqual(paintedHair(next), paintedHair(previous), 'changing the character cannot change locked hair color');
    assert.equal(next.outfit, previous.outfit);
    assert.equal(next.backdrop, previous.backdrop);
    assert.equal(next.seed, previous.seed);
  }
  const previous = { ...base(), character: 9, hair: 0 };
  const next = randomPortrait(previous, ['character', 'hair', 'backdrop']);
  assert.equal(next.hair, 0, 'the signature selection stays when the character stays');
  assert.deepEqual(paintedHair(next), paintedHair(previous));
});

test('PFP display IDs survive sharing and change when a recipe is edited', () => {
  const original = base();
  const code = portraitCode(original);
  assert.match(code, /^AGI-[0-9A-F]{8}$/);
  assert.equal(portraitCode(decodePortrait(encodePortrait(original))), code);
  for (const key of keys) assert.notEqual(portraitCode({ ...original, [key]: TRAITS[key].length - 1 }), code);
  assert.notEqual(portraitCode({ ...original, seed: 'f'.repeat(32) }), code);
  assert.throws(() => portraitCode({}), /Invalid portrait/);
});

test('PFP recoloring keeps transparency, white AGI lettering, skin and neutral outlines intact', () => {
  const pixels = [
    [233, 189, 102, 0], [145, 94, 205, 0], // hidden RGB must not bleed into edges
    [255, 255, 255, 255], [245, 245, 245, 255], [250, 249, 247, 190], // white and warm antialiasing
    [244, 204, 166, 255], [231, 169, 148, 255], [201, 145, 122, 128], // peach skin and shadow
    [28, 25, 30, 255], [194, 194, 194, 255], // outlines and neutral hardware
  ];
  const source = new Uint8ClampedArray(pixels.flat());
  const result = recolorPixels(source.slice(), { ...base(), hair: 8, outfit: 3 });
  assert.deepEqual(result, source);
});

test('PFP natural cream AGI lettering stays white while the surrounding gold hair recolors', async () => {
  const source = await sharp(readFileSync(new URL('../public/pfp/v1/character-14.png', import.meta.url))).ensureAlpha().raw().toBuffer();
  const lettering = [];
  for (let y = 430; y <= 483; y++) {
    for (let x = 230; x <= 344; x++) {
      const offset = (y * 512 + x) * 4;
      const rgb = source.subarray(offset, offset + 3);
      const [h, s] = rgbToHsl(...rgb);
      if (source[offset + 3] > 200 && Math.min(...rgb) >= 200 && h >= 36 && h <= 72 && s > 0.3) lettering.push(offset);
    }
  }
  assert.ok(lettering.length > 100, 'the original print contains warm cream pixels that could be mistaken for blonde hair');
  const hairOffset = (100 * 512 + 180) * 4;
  for (const hair of [2, 4, 5]) {
    const result = recolorPixels(Buffer.from(source), { ...base(), character: 14, hair, outfit: 2 });
    for (const offset of lettering) {
      assert.deepEqual(result.subarray(offset, offset + 4), source.subarray(offset, offset + 4), 'the natural AGI print keeps its original color and alpha');
    }
    assert.notDeepEqual(result.subarray(hairOffset, hairOffset + 3), source.subarray(hairOffset, hairOffset + 3), 'the selected hair color still changes actual gold strands');
    assert.equal(result[hairOffset + 3], source[hairOffset + 3]);
    assert.ok(Math.abs(rgbToHsl(...result.subarray(hairOffset, hairOffset + 3))[0] - TRAITS.hair[hair].h) < 3);
  }
});

test('PFP gold hair and purple fabric recolor independently without flattening their shading or alpha', () => {
  const pixels = [gold, [166, 128, 49, 160], [249, 223, 155, 255], [145, 94, 205, 255], [70, 42, 108, 128]];
  const source = new Uint8ClampedArray(pixels.flat());
  assert.deepEqual(recolorPixels(source.slice(), base()), source, 'the original palette remains exact');
  const hairOnly = recolorPixels(source.slice(), { ...base(), hair: 8 });
  const outfitOnly = recolorPixels(source.slice(), { ...base(), outfit: 3 });
  const combined = recolorPixels(source.slice(), { ...base(), hair: 8, outfit: 3 });
  for (let index = 0; index < pixels.length; index++) {
    const offset = index * 4;
    const before = source.slice(offset, offset + 3);
    const changed = combined.slice(offset, offset + 3);
    assert.notDeepEqual(changed, before);
    assert.equal(combined[offset + 3], pixels[index][3], 'semi-transparent edges retain their alpha');
    const hue = rgbToHsl(...changed)[0];
    assert.ok(Math.abs(hue - (index < 3 ? TRAITS.hair[8].h : TRAITS.outfit[3].h)) < 2, 'the selected palette determines the hue');
    assert.deepEqual((index < 3 ? outfitOnly : hairOnly).slice(offset, offset + 4), source.slice(offset, offset + 4), 'changing one trait leaves the other untouched');
  }
  const lightness = (index) => rgbToHsl(...combined.slice(index * 4, index * 4 + 3))[2];
  assert.ok(lightness(1) < lightness(0) && lightness(0) < lightness(2), 'hair shadow, midtone and highlight retain their order');
  assert.ok(lightness(4) < lightness(3), 'fabric shadow remains darker');
});

test('PFP expanded-character palette masks preserve exposed arms and necks', async () => {
  for (const [character, points] of [[35, [[125, 505], [303, 313]]], [47, [[282, 314]]]]) {
    const { data } = await sharp(readFileSync(new URL(`../public/pfp/v1/character-${character}.png`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const before = Buffer.from(data);
    recolorPixels(data, { ...base(), character, hair: 2 });
    for (const [x, y] of points) {
      const offset = (y * 512 + x) * 4;
      assert.ok(before[offset + 3] > 200, 'the versioned sample lies on visible skin');
      assert.deepEqual(data.subarray(offset, offset + 4), before.subarray(offset, offset + 4), `character ${character}: exposed skin at ${x},${y} retains its color`);
    }
  }
});

test('PFP warm hair beside the jaw and outer curls follows the selected palette', async () => {
  for (const [character, x, y, hair] of [[47, 292, 299, 2], [8, 151, 306, 4]]) {
    const { data } = await sharp(readFileSync(new URL(`../public/pfp/v1/character-${character}.png`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (y * 512 + x) * 4;
    const before = Buffer.from(data.subarray(offset, offset + 4));
    recolorPixels(data, { ...base(), character, hair });
    assert.ok(before[3] > 200, 'the versioned sample lies on an opaque strand');
    assert.notDeepEqual(data.subarray(offset, offset + 3), before.subarray(0, 3), `character ${character}: the warm hair edge recolors`);
    assert.equal(data[offset + 3], before[3], 'recoloring retains strand transparency');
    const hue = rgbToHsl(...data.subarray(offset, offset + 3))[0];
    assert.ok(Math.abs(hue - TRAITS.hair[hair].h) < 3, 'the strand uses the selected hair hue');
  }
});

test('PFP composition keeps the original clothing print visible without painting a badge over it', async (t) => {
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (oldImage) Object.defineProperty(globalThis, 'Image', oldImage); else delete globalThis.Image;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document;
  });
  class Canvas {
    constructor() {
      const events = [];
      this.context = {
        events, fillStyle: '',
        drawImage(image, ...args) { events.push({ kind: 'image', image, args }); },
        fillRect(...args) { events.push({ kind: 'fill', color: this.fillStyle, args }); },
        getImageData() { return { data: new Uint8ClampedArray(512 * 512 * 4) }; },
        putImageData() {},
      };
    }
    getContext() { return this.context; }
  }
  class LocalImage {
    set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: LocalImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new Canvas() } });
  const target = new Canvas();
  assert.equal(await renderPortrait(target, { ...base(), character: 47 }), target);
  assert.equal(target.width, 1024);
  assert.equal(target.height, 1024);
  const exported = target.context.events.at(-1);
  assert.equal(exported.kind, 'image');
  const composition = exported.image.context.events;
  assert.equal(composition.filter((event) => event.kind === 'image').length, 2, 'the scene and character are composited once each');
  const last = composition.at(-1);
  assert.equal(last.kind, 'image', 'no badge or paint is drawn over the character');
  assert.match(new URL(last.image.context.events[0].image.url, 'https://www.agi1.app').pathname, /character-47\.png$/, 'the final layer uses the source sprite with its original AGI lettering');

});

test('PFP bottom-edge finishing preserves the artwork and lettering through row 500 exactly', async () => {
  const original = new Uint8Array(512 * 512 * 4);
  for (let index = 0; index < original.length; index++) original[index] = (index * 17 + Math.floor(index / 2048) * 23) % 256;
  const png = await sharp(original, { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer();
  const result = await sharp(await finishCharacterEdge(png)).ensureAlpha().raw().toBuffer();
  assert.deepEqual(result.subarray(0, 501 * 512 * 4), Buffer.from(original.subarray(0, 501 * 512 * 4)), 'existing visible art never moves or changes');
  const clean = result.subarray(500 * 512 * 4, 501 * 512 * 4);
  for (let y = 501; y < 512; y++) assert.deepEqual(result.subarray(y * 512 * 4, (y + 1) * 512 * 4), clean);
});

test('PFP every declared character and scene has a decodable square local asset with clean character edges', async () => {
  const files = [
    ...TRAITS.character.map((_, index) => ({ file: `character-${index}.png`, character: true })),
    ...TRAITS.backdrop.map(({ file }) => ({ file: `${file}.webp`, character: false })),
  ];
  assert.equal(new Set(files.map(({ file }) => file)).size, files.length);
  for (const { file, character } of files) {
    assert.match(file, /^[a-z0-9-]+\.(png|webp)$/);
    const url = new URL(`../public/pfp/v1/${file}`, import.meta.url);
    assert.ok(existsSync(url), `${file} exists`);
    const metadata = await sharp(readFileSync(url)).metadata();
    assert.equal(metadata.width, metadata.height, `${file} is square`);
    assert.ok(metadata.width >= 512, `${file} has enough source detail`);
    if (character) {
      assert.equal(metadata.hasAlpha, true, `${file} can layer over its scene`);
      assert.equal(metadata.width, 512, 'source-coordinate palette masks remain aligned');
      const data = await sharp(readFileSync(url)).ensureAlpha().raw().toBuffer();
      const clean = data.subarray(500 * 512 * 4, 501 * 512 * 4);
      for (let y = 501; y < 512; y++) assert.deepEqual(data.subarray(y * 512 * 4, (y + 1) * 512 * 4), clean, `${file}: no stray strip or transparent gap in the clothing edge`);
    }
  }
});

test('PFP is built, reachable in local preview, linked from home and included in share metadata', async () => {
  const { default: config } = await import('../vite.config.js');
  assert.equal(config.build.rollupOptions.input.pfp, 'pfp.html');
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    const middleware = [];
    for (const plugin of config.plugins) plugin[hook]?.({ middlewares: { use: (handler) => middleware.push(handler) } });
    for (const [url, expected] of [['/pfp', '/pfp.html'], ['/pfp/?keep=1', '/pfp.html?keep=1']]) {
      const request = { url, headers: { host: 'localhost' } };
      for (const handler of middleware) handler(request, {}, () => {});
      assert.equal(request.url, expected, `${hook}: ${url}`);
    }
  }
  const html = read('pfp.html');
  assert.match(html, /<script type="module" src="\/src\/pfp\/page\.js"><\/script>/);
  assert.match(html, /rel="canonical" href="__SITE__\/pfp"/);
  assert.doesNotMatch(html, /<script\s*>|\sstyle=/i, 'production CSP does not need an inline-script or style exception');
  assert.match(read('scripts/share-pages.js'), /'dist\/pfp\.html'/);
  assert.ok(BUILTIN_PAGES.some((page) => page.path === '/pfp'));
  const home = read('index.html');
  for (const marker of ['id="site-nav"', 'class="foot-nav"']) {
    const start = home.indexOf(marker);
    assert.ok(start >= 0);
    assert.match(home.slice(start, home.indexOf('</nav>', start)), /href="\/pfp"/, 'home navigation and footer link to the generator');
  }
});

test('PFP stays available in every built page with the shared header and footer navigation', async () => {
  const { default: config } = await import('../vite.config.js');
  const failures = [];
  const checked = [];
  const attribute = (attributes, name) => new RegExp(`(?:^|\\s)${name}=(['"])(.*?)\\1`, 'i').exec(attributes)?.[2];
  for (const file of new Set(Object.values(config.build.rollupOptions.input))) {
    if (!file.endsWith('.html')) continue;
    const navs = [...read(file).matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)];
    const header = navs.filter((nav) => attribute(nav[1], 'id') === 'site-nav');
    if (!header.length) continue;
    checked.push(file);
    const footer = navs.filter((nav) => (attribute(nav[1], 'class') || '').split(/\s+/).includes('foot-nav'));
    for (const [label, groups] of [['header', header], ['footer', footer]]) {
      if (groups.length !== 1) { failures.push(`${file}: expected one shared ${label}`); continue; }
      const links = [...groups[0][2].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .filter((link) => attribute(link[1], 'href') === '/pfp');
      if (links.length !== 1) { failures.push(`${file}: ${label} has ${links.length} PFP links, expected one`); continue; }
      const attrs = links[0][1];
      const classes = (attribute(attrs, 'class') || '').split(/\s+/);
      if (classes.includes('nav-phone') || classes.includes('hidden') || /(?:^|\s)hidden(?:\s|=|$)/i.test(attrs) || attribute(attrs, 'aria-hidden') === 'true') {
        failures.push(`${file}: ${label} PFP link must remain available in desktop and phone navigation`);
      }
      if (file === 'pfp.html' && attribute(attrs, 'aria-current') !== 'page') failures.push(`${file}: ${label} must identify PFP as the current page`);
    }
  }
  for (const file of ['diary.html', 'memes.html', 'pfp.html']) assert.ok(checked.includes(file), `${file} uses the shared navigation under test`);
  assert.deepEqual(failures, [], failures.join('\n'));
});


test('PFP pale fabric highlights recolor smoothly across every outfit palette', async () => {
  const samples = [
    { character: 37, points: [[146, 447, [227, 185, 246, 253]], [147, 447, [237, 202, 249, 252]]] },
    { character: 33, points: [[195, 352, [230, 189, 242, 252]], [196, 352, [239, 202, 247, 252]]] },
    { character: 30, points: [[83, 449, [232, 189, 245, 253]], [84, 449, [236, 205, 245, 253]]] },
  ];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const { character, points } of samples) {
    const source = await sharp(readFileSync(new URL(`../public/pfp/v1/character-${character}.png`, import.meta.url))).ensureAlpha().raw().toBuffer();
    const offsets = points.map(([x, y, rgba]) => {
      const offset = (y * 512 + x) * 4;
      assert.deepEqual([...source.subarray(offset, offset + 4)], rgba, 'the regression uses the original measured garment pixels');
      return offset;
    });
    const originalGap = distance(points[0][2], points[1][2]);
    for (let outfit = 1; outfit < TRAITS.outfit.length; outfit++) {
      const result = recolorPixels(Buffer.from(source), { ...base(), character, hair: 1, outfit });
      const colors = offsets.map((offset, index) => {
        const color = [...result.subarray(offset, offset + 3)];
        assert.notDeepEqual(color, points[index][2].slice(0, 3), `character ${character}: both sides of the pale fabric edge follow ${TRAITS.outfit[outfit].label}`);
        assert.equal(result[offset + 3], points[index][2][3], 'recoloring never changes the fabric alpha');
        const [h, s] = rgbToHsl(...color);
        if (TRAITS.outfit[outfit].s > 0.15) {
          const hueGap = Math.abs(h - TRAITS.outfit[outfit].h);
          assert.ok(Math.min(hueGap, 360 - hueGap) < 8, 'a highlight cannot remain source-purple inside another outfit color');
        } else assert.ok(s < 0.15, 'Graphite highlights remain neutral');
        return color;
      });
      assert.ok(rgbToHsl(...colors[0])[2] < rgbToHsl(...colors[1])[2], 'the original shadow-to-highlight order is preserved');
      assert.ok(distance(...colors) < Math.max(45, originalGap * 2.5), 'nearby source shades cannot turn into contrasting paint speckles');
    }
  }
});

test('PFP every character has its own bounded anatomy mask', async () => {
  const { SKIN_REGIONS, skinMask } = await import('../src/pfp/skin-mask.js');
  assert.equal(SKIN_REGIONS.length, TRAITS.character.length, 'new characters cannot silently use an unrelated face outline');
  const buffers = new Set();
  for (let character = 0; character < TRAITS.character.length; character++) {
    const regions = SKIN_REGIONS[character];
    assert.ok(Array.isArray(regions) && regions.length >= 2, `character ${character} has measured face and neck regions`);
    for (const polygon of regions) {
      assert.ok(polygon.length >= 3);
      for (const [x, y] of polygon) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 512 && y >= 0 && y <= 512, 'anatomy coordinates stay inside the source sprite');
    }
    const mask = skinMask(character);
    assert.equal(mask.length, 512 * 512);
    assert.equal(buffers.has(mask), false, 'characters do not share a fallback mask');
    buffers.add(mask);
    let protectedPixels = 0;
    for (const material of mask) {
      assert.ok(material === 0 || material === 1 || material === 2 || material === 3, 'only empty, immutable face/accessory, lens, and anatomy-edge materials are present');
      if (material) protectedPixels++;
    }
    assert.ok(protectedPixels > 2000 && protectedPixels < 70000, 'the mask protects anatomy without freezing the whole portrait');
  }
});

test('PFP translucent visor recolors as one material while keeping hair changes independent', async () => {
  const source = await sharp(readFileSync(new URL('../public/pfp/v1/character-23.png', import.meta.url))).ensureAlpha().raw().toBuffer();
  const samples = [[240, 135, [120, 60, 187, 253]], [255, 131, [186, 109, 184, 253]], [210, 160, [249, 233, 212, 254]]];
  const hairOnly = recolorPixels(Buffer.from(source), { ...base(), character: 23, hair: 5 });
  const teal = recolorPixels(Buffer.from(source), { ...base(), character: 23, hair: 5, outfit: 8 });
  for (const [x, y, rgba] of samples) {
    const offset = (y * 512 + x) * 4;
    assert.deepEqual([...source.subarray(offset, offset + 4)], rgba, 'samples retain the source glass and its differently colored reflections');
    assert.deepEqual(hairOnly.subarray(offset, offset + 4), source.subarray(offset, offset + 4), 'changing hair does not paint over the visor');
    assert.notDeepEqual(teal.subarray(offset, offset + 3), source.subarray(offset, offset + 3), 'purple, pink, and warm lens reflections all follow the outfit');
    const hue = rgbToHsl(...teal.subarray(offset, offset + 3))[0];
    assert.ok(Math.abs(hue - TRAITS.outfit[8].h) < 5);
    assert.equal(teal[offset + 3], source[offset + 3]);
  }
});

test('PFP all 48 measured anatomy and hair samples behave correctly in every color', async () => {
  // Source coordinates and RGBA were independently inspected on the final artwork.
  // Each point records [name, x, y, protected, original RGBA]; these are not derived from the mask under test.
  const samples = [
    [0,[["face",275,255,1,[247,202,142,253]],["neck",268,350,1,[231,179,120,252]],["hair/bang",195,218,0,[255,212,103,253]],["lip",285,275,1,[77,38,21,253]],["arm",165,506,1,[231,170,120,252]]]],
    [1,[["face",282,253,1,[249,205,147,252]],["neck",275,332,1,[237,184,126,252]],["hair/bang",270,177,0,[227,162,88,252]]]],
    [2,[["face",285,255,1,[249,203,144,253]],["neck",275,341,1,[232,181,124,253]],["hair/bang",270,190,0,[251,210,106,252]]]],
    [3,[["face",288,254,1,[248,204,146,253]],["neck",255,327,1,[234,181,123,253]],["hair/bang",308,170,0,[251,200,96,253]]]],
    [4,[["face",275,239,1,[248,205,145,252]],["neck",265,322,1,[237,187,128,253]],["hair/bang",299,180,0,[249,200,97,252]]]],
    [5,[["face",270,250,1,[250,206,146,252]],["neck",262,331,1,[237,185,129,252]],["hair/bang",262,180,0,[251,201,96,253]]]],
    [6,[["face",280,231,1,[247,202,141,253]],["neck",275,304,1,[234,184,125,253]],["hair/bang",280,163,0,[250,200,97,253]]]],
    [7,[["face",273,251,1,[250,206,148,253]],["neck",273,328,1,[235,184,128,253]],["hair/bang",273,181,0,[228,165,69,252]],["arm",130,495,1,[249,203,144,253]]]],
    [8,[["face",270,235,1,[249,203,147,253]],["neck",268,315,1,[235,185,126,253]],["hair/bang",277,178,0,[250,198,88,253]]]],
    [9,[["face",260,238,1,[250,199,139,252]],["neck",267,352,1,[245,184,125,252]],["hair/bang",239,100,0,[241,182,72,253]],["neck edge",293,297,1,[234,176,117,252]],["clavicle",244,374,1,[221,148,99,253]],["ear",337,195,1,[226,147,97,252]],["iris",289,197,1,[4,2,1,252]]]],
    [10,[["face",260,250,1,[251,201,144,252]],["neck",264,345,1,[242,183,123,252]],["hair/bang",258,181,0,[254,210,100,252]]]],
    [11,[["face",320,258,1,[251,201,142,252]],["neck",329,362,1,[242,183,124,253]],["hair/bang",329,183,0,[250,200,81,252]]]],
    [12,[["face",285,263,1,[252,205,149,253]],["neck",275,366,1,[241,186,131,253]],["hair/bang",287,190,0,[251,199,75,253]]]],
    [13,[["face",280,248,1,[252,208,152,253]],["neck",270,369,1,[239,182,124,253]],["hair/bang",270,183,0,[252,205,78,253]]]],
    [14,[["face",260,255,1,[252,209,158,251]],["neck",268,350,1,[241,185,130,253]],["hair/bang",255,191,0,[233,164,55,253]]]],
    [15,[["face",291,246,1,[252,208,156,251]],["neck",270,344,1,[246,187,130,250]],["hair/bang",290,180,0,[252,205,76,253]],["ear",175,253,1,[233,145,85,253]]]],
    [16,[["face",275,245,1,[252,211,160,253]],["neck",275,345,1,[241,187,131,253]],["hair/bang",275,165,0,[229,159,51,253]]]],
    [17,[["face",284,263,1,[252,209,158,253]],["neck",286,365,1,[241,187,131,253]],["hair/bang",280,184,0,[252,204,79,253]]]],
    [18,[["face",282,278,1,[136,83,43,253]],["neck",275,365,1,[240,186,129,253]],["hair/bang",275,189,0,[251,205,79,253]],["ear",158,270,1,[245,163,100,253]]]],
    [19,[["face",270,255,1,[251,205,150,253]],["neck",263,350,1,[240,184,125,253]],["hair/bang",280,184,0,[252,208,81,253]],["ear",160,252,1,[234,155,92,253]]]],
    [20,[["face",269,260,1,[250,205,156,253]],["neck",265,329,1,[242,186,128,253]],["hair/bang",261,185,0,[252,205,79,253]],["ear",145,245,1,[231,149,73,253]]]],
    [21,[["face",276,275,1,[252,203,144,253]],["neck",270,359,1,[244,183,118,253]],["hair/bang",278,211,0,[251,208,74,253]]]],
    [22,[["face",263,263,1,[252,200,140,253]],["neck",265,345,1,[243,181,116,253]],["hair/bang",270,185,0,[251,207,76,253]]]],
    [23,[["face",306,272,1,[251,204,145,253]],["neck",301,368,1,[251,197,136,253]],["hair/bang",302,212,0,[251,212,85,253]]]],
    [24,[["face",290,270,1,[252,207,149,253]],["neck",258,353,1,[244,185,121,253]],["hair",314,174,0,[250,207,75,253]]]],
    [25,[["face",265,270,1,[229,112,72,253]],["neck",256,350,1,[243,183,118,253]],["hair",270,170,0,[251,205,73,253]]]],
    [26,[["forehead",235,200,1,[251,198,146,253]],["face",280,267,1,[252,206,144,253]],["neck",280,350,1,[243,182,118,253]],["hair",278,170,0,[252,213,81,253]]]],
    [27,[["face",280,250,1,[255,207,148,253]],["neck",275,335,1,[244,183,119,253]],["hair",289,162,0,[251,210,82,253]]]],
    [28,[["face",265,260,1,[251,198,138,253]],["neck",235,296,1,[242,181,120,253]],["hair",280,159,0,[251,209,79,253]]]],
    [29,[["face",288,265,1,[247,207,147,253]],["neck",280,340,1,[244,184,119,253]],["hair",295,170,0,[251,212,80,253]]]],
    [30,[["face",285,280,1,[251,204,142,252]],["neck",273,317,1,[208,131,85,252]],["hair",294,177,0,[250,198,91,253]],["eye",265,240,1,[41,33,54,253]]]],
    [31,[["hairCurl",265,375,0,[250,204,95,253]],["face",285,283,1,[248,204,138,252]],["neck",281,349,1,[240,184,120,253]],["hair",289,181,0,[250,205,90,253]],["ear",180,280,1,[244,189,124,252]]]],
    [32,[["face",281,289,1,[250,207,148,252]],["neck",272,333,1,[226,161,101,253]],["hair",283,194,0,[255,208,96,253]],["ear",173,286,1,[254,208,136,252]]]],
    [33,[["iris",369,239,1,[32,8,3,253]],["face",319,282,1,[101,42,26,253]],["neck",285,346,1,[240,184,120,253]],["hair",341,191,0,[251,203,92,253]],["ear",212,256,1,[241,185,126,253]]]],
    [34,[["face",302,257,1,[248,205,139,252]],["neck",286,302,1,[238,177,116,253]],["hair",298,154,0,[250,201,88,253]],["eyelash",216,221,1,[15,0,39,253]]]],
    [35,[["face",282,269,1,[250,206,145,252]],["neck",277,339,1,[238,183,120,252]],["hair",296,171,0,[252,215,99,253]],["ear",181,254,1,[248,198,136,253]],["arm",124,505,1,[220,147,102,252]]]],
    [36,[["hairShadow",250,320,0,[207,146,61,252]],["forehead",265,190,1,[62,19,0,252]],["iris",340,230,1,[235,128,43,253]],["face",296,275,1,[248,202,143,252]],["neck",288,345,1,[241,184,122,253]],["hair",297,167,0,[251,203,91,253]],["ear",187,263,1,[246,184,123,253]]]],
    [37,[["face",301,270,1,[49,20,8,252]],["neck",287,340,1,[240,184,123,252]],["hair",306,175,0,[250,206,97,252]]]],
    [38,[["face",316,282,1,[193,103,64,253]],["neck",299,320,1,[235,171,115,253]],["hair",315,183,0,[252,204,89,253]]]],
    [39,[["face",278,280,1,[242,184,129,252]],["neck",254,324,1,[232,172,117,252]],["hair",294,181,0,[252,215,106,253]]]],
    [40,[["face",280,277,1,[251,208,149,253]],["neck",271,340,1,[237,183,127,252]],["hair",284,180,0,[249,198,88,253]],["ear",165,255,1,[228,157,93,252]],["flower",142,143,1,[140,69,33,252]],["flowerPetal",385,105,1,[241,186,22,248]]]],
    [41,[["face",263,284,1,[153,84,49,253]],["neck",286,354,1,[238,181,124,253]],["hair",253,185,0,[237,182,77,253]],["ear",372,235,1,[234,162,106,252]]]],
    [42,[["face",287,271,1,[233,131,88,253]],["neck",256,328,1,[233,178,123,253]],["hair",304,164,0,[251,209,97,253]],["ear",174,217,1,[235,148,94,252]]]],
    [43,[["face",282,280,1,[252,210,150,252]],["neck",260,350,1,[236,181,124,253]],["hair",303,181,0,[254,216,102,252]]]],
    [44,[["face",280,294,1,[219,107,75,253]],["neck",260,343,1,[231,177,122,253]],["hair",279,195,0,[251,200,88,252]],["ear",169,280,1,[223,152,97,252]]]],
    [45,[["face",285,257,1,[251,209,148,252]],["neck",277,307,1,[237,178,122,253]],["hair",287,163,0,[252,211,100,253]]]],
    [46,[["face",283,266,1,[250,205,149,253]],["neck",281,332,1,[237,182,128,253]],["hair",288,174,0,[251,199,87,252]],["ear",175,254,1,[204,128,83,253]],["arm",135,503,1,[247,190,130,252]]]],
    [47,[["face",267,270,1,[251,211,159,252]],["neck",260,331,1,[239,183,128,253]],["hair",277,172,0,[252,207,97,253]],["ear",151,251,1,[215,126,74,252]]]],
  ];
  const { skinMask } = await import('../src/pfp/skin-mask.js');
  assert.deepEqual(samples.map(([character]) => character), TRAITS.character.map((_, index) => index), 'every selectable design has measured anatomy and hair coverage');
  const palettes = [
    ...TRAITS.hair.map((_, hair) => ({ hair, outfit: 0 })),
    ...TRAITS.outfit.map((_, outfit) => ({ hair: 1, outfit })),
  ];
  for (const [character, points] of samples) {
    const source = await sharp(readFileSync(new URL(`../public/pfp/v1/character-${character}.png`, import.meta.url))).ensureAlpha().raw().toBuffer();
    // Retain the full source coordinate space, but exercise only the measured
    // pixels so every palette remains inexpensive in the parallel build suite.
    const probe = Buffer.alloc(source.length);
    const mask = skinMask(character);
    assert.ok(points.some(([, , , protect]) => protect) && points.some(([, , , protect]) => !protect), 'each design tests protection and recoloring');
    for (const [name, x, y, protect, rgba] of points) {
      const offset = (y * 512 + x) * 4;
      assert.deepEqual([...source.subarray(offset, offset + 4)], rgba, `character ${character}: ${name} is the measured original pixel`);
      source.copy(probe, offset, offset, offset + 4);
      assert.ok(rgba[3] > 200, 'the measured point lies on visible artwork');
      const material = mask[y * 512 + x];
      assert.equal(Number(material === 1 || material === 3), protect, `character ${character}: ${name} has the correct protection`);
      if (['face', 'forehead', 'lip', 'eye', 'eyelash', 'iris', 'flower', 'flowerPetal'].includes(name)) {
        assert.equal(material, 1, 'faces, eyes and fixed accessories cannot inherit the fabric exception');
      }
    }
    for (const palette of palettes) {
      const result = recolorPixels(Buffer.from(probe), { ...base(), character, ...palette });
      for (const [name, x, y, protect] of points) {
        const offset = (y * 512 + x) * 4;
        const original = source.subarray(offset, offset + 4), actual = result.subarray(offset, offset + 4);
        const message = `character ${character}, ${name}: hair ${palette.hair}, outfit ${palette.outfit}`;
        assert.equal(actual[3], original[3], message + ' keeps alpha');
        if (protect || palette.hair === 1) assert.deepEqual(actual, original, message + ' preserves source color');
        else if (palette.hair > 1) assert.notDeepEqual(actual, original, message + ' recolors hair instead of freezing it as skin');
      }
    }
  }
});

test('PFP scanline anatomy masks match independent point-in-polygon coverage', async () => {
  const { SKIN_REGIONS, skinMask } = await import('../src/pfp/skin-mask.js');
  const { ACCESSORY_REGIONS_B } = await import('../src/pfp/skin-regions-b.js');
  function contains(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function coverage(regions) {
    const covered = new Uint8Array(512 * 512);
    for (const polygon of regions) {
      const xs = polygon.map(([x]) => x), ys = polygon.map(([, y]) => y);
      const left = Math.max(0, Math.floor(Math.min(...xs))), right = Math.min(511, Math.ceil(Math.max(...xs)));
      const top = Math.max(0, Math.floor(Math.min(...ys))), bottom = Math.min(511, Math.ceil(Math.max(...ys)));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        if (contains(x + 0.5, y + 0.5, polygon)) covered[y * 512 + x] = 1;
      }
    }
    return covered;
  }
  let overlappingFaceAndEdgePixels = 0;
  for (const character of [0, 9, 31, 33, 36, 47]) {
    const [face, ...edges] = SKIN_REGIONS[character];
    const immutable = coverage([face, ...(ACCESSORY_REGIONS_B[character] || [])]);
    const anatomyEdges = coverage(edges);
    const expected = Uint8Array.from(immutable, (fixed, index) => {
      if (fixed && anatomyEdges[index]) overlappingFaceAndEdgePixels++;
      return fixed ? 1 : anatomyEdges[index] ? 3 : 0;
    });
    const actual = skinMask(character);
    const mismatch = actual.findIndex((material, index) => material !== expected[index]);
    assert.equal(mismatch, -1, `character ${character}: optimized contour fill differs from point coverage at ${mismatch % 512},${Math.floor(mismatch / 512)}`);
  }
  assert.ok(overlappingFaceAndEdgePixels > 0, 'the differential check includes overlapping regions where immutable face protection must win');
});
