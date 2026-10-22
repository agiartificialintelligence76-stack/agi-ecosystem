import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { createGame } from '../src/games/vladrunner2049/engine.js';
import { SAVE_KEY, DEFAULT_SETTINGS, ACHIEVEMENTS, readSave, writeSave, recordRun, bestRecord, dailySeed } from '../src/games/vladrunner2049/save.js';

function memory(initial = null) {
  const values = new Map(initial === null ? [] : [[SAVE_KEY, typeof initial === 'string' ? initial : JSON.stringify(initial)]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}
const at = '2026-10-22T11:00:00.000Z';
function completed(options = {}, extra = {}) {
  const s = createGame({ seed: 'personal-run', ...options });
  Object.assign(s, { status: 'gameover', score: 100, elapsed: 65, maxCombo: 3 }, extra);
  return s;
}
function storedRecord(extra = {}) {
  return { mode: 'story', seed: 'personal-run', difficulty: 'normal', coop: false,
    score: 1234, combo: 7, kills: 4, seconds: 65, won: false, at, ...extra };
}

test('runner saving survives unavailable, corrupt, oversized, and quota-blocked storage', () => {
  const blank = readSave(null);
  assert.deepEqual(blank.settings, DEFAULT_SETTINGS);
  assert.deepEqual(blank.records, []);
  for (const raw of ['not json', 'null', '[]', '42', 'x'.repeat(300001)]) assert.deepEqual(readSave(memory(raw)), blank);
  assert.deepEqual(readSave({ getItem() { throw new Error('blocked'); } }), blank);
  assert.equal(writeSave(null, blank), false);
  assert.equal(writeSave({}, blank), false);
  assert.equal(writeSave({ setItem() { throw new Error('quota'); } }, blank), false);
  const before = structuredClone(blank);
  assert.equal(writeSave(memory(), blank), true);
  assert.deepEqual(blank, before, 'writing must not alter the active save');
});

test('runner storage only admits bounded settings, known achievements, and explicit record fields', () => {
  const good = storedRecord({ combo: { html: '<script>' }, kills: -99, seconds: 'forever', won: 'yes', extra: 'untrusted' });
  const invalid = [null, 'record', [],
    storedRecord({ score: -1 }), storedRecord({ score: 1.2 }), storedRecord({ score: 1e10 }),
    storedRecord({ at: 'yesterday' }), storedRecord({ at: '2026-02-30T00:00:00.000Z' }),
    storedRecord({ seed: 'x'.repeat(129) }), storedRecord({ seed: 'bad\nseed' }),
    storedRecord({ mode: 'daily', seed: 'daily-2026-02-30' }), storedRecord({ mode: 'other' }),
    storedRecord({ difficulty: 'impossible' }), storedRecord({ coop: 'false' })];
  const save = readSave(memory({ settings: { music: 2, sfx: -1, shake: false, touch: 'true', reducedMotion: true, other: true },
    records: [...invalid, good], achievements: ['city', 'city', '__proto__', 'contact', {}], runs: 12.9, other: 'drop me' }));
  assert.deepEqual(save.settings, { music: 1, sfx: 0, shake: false, touch: false, reducedMotion: true });
  assert.equal(save.records.length, 1);
  assert.deepEqual(save.records[0], storedRecord({ combo: 0, kills: 0, seconds: 0 }));
  assert.deepEqual(save.achievements, ['contact', 'city']);
  assert.equal(save.runs, 12);
  assert.equal('other' in save, false);
  const store = memory(); writeSave(store, { ...save, other: '<script>', records: [...save.records, ...invalid] });
  assert.deepEqual(readSave(store), save);
});

test('personal best survives more than 24 later runs and a reload; legacy records migrate', () => {
  const save = readSave(memory({ records: [storedRecord({ score: 80000 })], runs: 1 }));
  for (let i = 0; i < 40; i++) recordRun(save, completed({}, { score: i + 1 }), at);
  assert.equal(save.records.length, 24);
  assert.equal(save.records.some(r => r.score === 80000), false);
  assert.equal(bestRecord(save, 'story').score, 80000);
  const store = memory(); assert.equal(writeSave(store, save), true);
  const loaded = readSave(store);
  assert.equal(loaded.runs, 41);
  assert.equal(bestRecord(loaded, 'story').score, 80000);
  recordRun(loaded, completed({}, { score: 80001 }), at);
  assert.equal(bestRecord(loaded, 'story').score, 80001);
  assert.equal(loaded.bests.length, 1);
});

test('best scores separate campaign, endless, co-op, assist, and exact daily seed', () => {
  const save = readSave(null); let score = 100;
  for (const mode of ['story', 'endless', 'daily']) for (const coop of [false, true]) for (const difficulty of ['normal', 'story']) {
    const seed = mode === 'daily' ? 'daily-2026-10-22' : 'same-seed';
    recordRun(save, completed({ mode, seed, coop, difficulty }, { score: score++ }), at);
  }
  score = 100;
  for (const mode of ['story', 'endless', 'daily']) for (const coop of [false, true]) for (const difficulty of ['normal', 'story']) {
    assert.equal(bestRecord(save, mode, { seed: 'daily-2026-10-22', coop, difficulty }).score, score++);
  }
  assert.equal(bestRecord(save, 'daily', { seed: 'daily-2026-10-23' }), null);
  assert.equal(bestRecord(save, 'daily'), null);
  assert.equal(bestRecord(save, 'other'), null);
});

test('daily date rolls at UTC midnight and keeps the newest 31 played dates without evicting permanent bests', () => {
  assert.equal(dailySeed(new Date('2026-10-22T07:59:59.999+08:00')), 'daily-2026-10-21');
  assert.equal(dailySeed(new Date('2026-10-22T08:00:00.000+08:00')), 'daily-2026-10-22');
  assert.equal(dailySeed(new Date('2027-01-01T00:00:00Z')), 'daily-2027-01-01');
  assert.equal(dailySeed(new Date('2028-02-29T23:59:59Z')), 'daily-2028-02-29');
  const save = readSave(null);
  recordRun(save, completed({}, { score: 50000 }), at);
  for (let day = 0; day < 40; day++) {
    const date = new Date(Date.UTC(2026, 8, 1 + day)), seed = dailySeed(date);
    for (const coop of [false, true]) for (const difficulty of ['normal', 'story'])
      recordRun(save, completed({ mode: 'daily', seed, coop, difficulty }, { score: day + 1 }), date.toISOString());
  }
  recordRun(save, completed({ mode: 'daily', seed: 'daily-2026-09-01' }, { score: 999999 }), at);
  const store = memory(); writeSave(store, save); const loaded = readSave(store);
  assert.equal(bestRecord(loaded, 'story').score, 50000);
  assert.equal(bestRecord(loaded, 'daily', { seed: 'daily-2026-09-01' }), null);
  assert.equal(bestRecord(loaded, 'daily', { seed: 'daily-2026-09-10' }).score, 10);
  assert.equal(bestRecord(loaded, 'daily', { seed: 'daily-2026-10-10', coop: true, difficulty: 'story' }).score, 40);
  assert.equal(new Set(loaded.bests.filter(r => r.mode === 'daily').map(r => r.seed)).size, 31);
  assert.equal(loaded.bests.length, 31 * 4 + 1);
  assert.ok(store.values.get(SAVE_KEY).length < 40000, 'local history remains small after many daily runs');
});

test('only completed valid runs save and achievement thresholds unlock once across reloads', () => {
  const save = readSave(null), playing = createGame({ seed: 'run' });
  const before = structuredClone(save);
  assert.deepEqual(recordRun(save, playing, at), { record: null, unlocked: [] });
  assert.deepEqual(recordRun(save, completed({}, { score: NaN }), at), { record: null, unlocked: [] });
  assert.deepEqual(save, before);
  const almost = completed({}, { score: 24999, maxCombo: 19 });
  Object.assign(almost.stats, { kills: 1, noHitWaves: 2, duos: 0 });
  assert.deepEqual(recordRun(save, almost, at).unlocked, ['contact']);
  const victory = completed({ coop: true }, { status: 'victory', score: 25000, maxCombo: 20 });
  Object.assign(victory.stats, { kills: 30, noHitWaves: 3, duos: 1 });
  assert.deepEqual(recordRun(save, victory, at).unlocked, ['combo', 'clean', 'duo', 'city', 'legend', 'friends']);
  const store = memory(); writeSave(store, save); const loaded = readSave(store);
  assert.deepEqual(recordRun(loaded, victory, at).unlocked, []);
  assert.equal(loaded.achievements.length, ACHIEVEMENTS.length);
  assert.equal(loaded.runs, 3);
  assert.equal(loaded.records[0].seconds, 65);
  const endless = readSave(null);
  recordRun(endless, completed({ mode: 'endless', coop: true }, { status: 'victory' }), at);
  assert.equal(endless.achievements.includes('city'), false);
  assert.equal(endless.achievements.includes('friends'), false);
});

test('asset metadata matches share art, backgrounds cover the arena, and the full art download stays under 8 MB', async () => {
  const directory = new URL('../public/images/vladrunner2049/', import.meta.url);
  const names = (await readdir(directory)).filter(name => /\.(webp|png|jpe?g)$/i.test(name));
  for (const name of ['keyart.webp', 'vlad.webp', 'agi.webp', 'agi-left.webp', 'neon.webp', 'orange.webp', 'spire.webp', 'enemies.webp', 'bosses.webp',
    'vlad-run.webp', 'agi-run.webp', 'agi-run-left.webp', 'vlad-combo.webp', 'agi-combo.webp', 'agi-combo-left.webp', 'enforcer-motion.webp'])
    assert.ok(names.includes(name), `${name} ships with the game`);
  let total = 0;
  for (const name of names) total += (await stat(new URL(name, directory))).size;
  assert.ok(total < 8 * 1024 * 1024, `all art is ${total} bytes`);
  const html = await readFile(new URL('../vladrunner2049.html', import.meta.url), 'utf8');
  const meta = key => html.match(new RegExp(`<meta\\s+property="${key}"\\s+content="([^"]+)"`))?.[1];
  const image = meta('og:image');
  assert.equal(image, '__SITE__/images/vladrunner2049/keyart.webp');
  const keyart = await sharp(await readFile(new URL('keyart.webp', directory))).metadata();
  assert.equal(Number(meta('og:image:width')), keyart.width);
  assert.equal(Number(meta('og:image:height')), keyart.height);
  for (const name of ['keyart', 'neon', 'orange', 'spire']) {
    const info = await sharp(await readFile(new URL(`${name}.webp`, directory))).metadata();
    assert.equal(info.format, 'webp');
    assert.ok(info.width >= 1280 && info.height >= 720, `${name} covers the logical game arena`);
    assert.ok(Math.abs(info.width / info.height - 16 / 9) < .01, `${name} is widescreen`);
  }
});

test('all hero atlases, including left-facing AGI, contain eight visible animation cells with real transparency', async () => {
  for (const name of ['vlad', 'agi', 'agi-left']) {
    const file = await readFile(new URL(`../public/images/vladrunner2049/${name}.webp`, import.meta.url));
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.width % 4, 0); assert.equal(metadata.height % 2, 0);
    const cw = metadata.width / 4, ch = metadata.height / 2;
    assert.ok(cw >= 256 && ch >= 384, `${name} animation frames retain detail`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cells = Array.from({ length: 8 }, () => ({ visible: 0, transparent: 0 }));
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const cell = cells[Math.floor(y / ch) * 4 + Math.floor(x / cw)], alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha > 28) cell.visible++;
      if (alpha === 0) cell.transparent++;
    }
    for (const [i, cell] of cells.entries()) {
      assert.ok(cell.visible > cw * ch * .1, `${name} frame ${i} contains a character`);
      assert.ok(cell.transparent > cw * ch * .25, `${name} frame ${i} has transparent surroundings`);
    }
  }
});

test('enemy and boss atlases contain three distinct character rows and four visible transparent poses per row', async () => {
  for (const name of ['enemies', 'bosses']) {
    const file = await readFile(new URL(`../public/images/vladrunner2049/${name}.webp`, import.meta.url));
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.width, metadata.height, `${name} uses the square four-column, three-row layout`);
    const cw = metadata.width / 4, ch = metadata.height / 3;
    assert.ok(cw >= 280 && ch >= 384, `${name} retains readable character detail`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cells = Array.from({ length: 12 }, () => ({ visible: 0, transparent: 0, hash: 2166136261 }));
    // Column boundaries can be fractional; use the same normalized grid as the renderer.
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const cell = cells[Math.floor(y / ch) * 4 + Math.floor(x / cw)], start = (y * info.width + x) * info.channels;
      const alpha = data[start + 3];
      if (alpha > 28) cell.visible++;
      if (alpha === 0) cell.transparent++;
      for (let channel = 0; channel < 4; channel++) cell.hash = Math.imul(cell.hash ^ data[start + channel], 16777619) >>> 0;
    }
    for (const [i, cell] of cells.entries()) {
      assert.ok(cell.visible > cw * ch * .1, `${name} frame ${i} contains a character`);
      assert.ok(cell.transparent > cw * ch * .25, `${name} frame ${i} has transparent surroundings`);
    }
    assert.equal(new Set(cells.map(cell => cell.hash)).size, 12, `${name} has distinct character/pose cells, not repeated placeholder frames`);
  }
});

test('revised run, combo and enforcer atlases contain complete, distinct transparent animation cells', async () => {
  const layouts = [
    ['vlad-run', 2], ['agi-run', 2], ['agi-run-left', 2],
    ['vlad-combo', 3], ['agi-combo', 3], ['agi-combo-left', 3], ['enforcer-motion', 3],
  ];
  for (const [name, rows] of layouts) {
    const file = await readFile(new URL(`../public/images/vladrunner2049/${name}.webp`, import.meta.url));
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, true, `${name} has a real alpha channel`);
    const cw = metadata.width / 4, ch = metadata.height / rows;
    assert.ok(cw >= 350 && ch >= (rows === 2 ? 400 : 330), `${name} keeps readable per-frame detail`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cells = Array.from({ length: 4 * rows }, () => ({ visible: 0, transparent: 0, hash: 2166136261 }));
    // Generated atlases can have fractional cell boundaries, including the 1774px
    // run sheet. Match the renderer's normalized grid rather than rounding a cell size.
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const cell = cells[Math.min(rows - 1, Math.floor(y / ch)) * 4 + Math.min(3, Math.floor(x / cw))];
      const start = (y * info.width + x) * info.channels, alpha = data[start + 3];
      if (alpha > 28) cell.visible++;
      if (alpha === 0) cell.transparent++;
      for (let channel = 0; channel < 4; channel++) cell.hash = Math.imul(cell.hash ^ data[start + channel], 16777619) >>> 0;
    }
    for (const [index, cell] of cells.entries()) {
      assert.ok(cell.visible > cw * ch * .15, `${name} frame ${index} contains a substantial drawing`);
      assert.ok(cell.transparent > cw * ch * .30, `${name} frame ${index} has transparent surroundings`);
    }
    assert.equal(new Set(cells.map(cell => cell.hash)).size, cells.length, `${name} supplies ${cells.length} distinct frame cells`);
  }
});
