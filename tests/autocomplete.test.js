// AUTOCOMPLETE (2026-11-09): a word game against AGI-1's autocomplete (src/games/autocomplete/). Its pure parts: the
// shipped dictionary (clean, fair, lean), the path rules, tokens, the scoring, her prediction, the solver, refills that
// always leave words to find, the Daily's seed, the context window and glitch tiles, and that a seed repeats a game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createDict } from '../src/games/autocomplete/dict.js';
import { makeTile, census, drawTile, LETTER_VALUE, TOKENS } from '../src/games/autocomplete/tiles.js';
import { solve, predict, lockLength, surpriseOf, typedPath, stepPath, adjacent, wordOf, hintWord, NEIGHBORS, COLS, ROWS, SIZE } from '../src/games/autocomplete/solver.js';
import { newBoard, refill, checkBoard, GUARANTEE } from '../src/games/autocomplete/board.js';
import {
  scoreWord, lengthMult, letterSum, CONTEXT, drainAt, refillFor, newContext, drainContext, addContext, GLITCH, newGlitch, glitchDue,
  startGlitch, glitchAfterWord, pickGlitchCell, dayKey, daySeed, DAILY, newTally, tallyWord,
} from '../src/games/autocomplete/rules.js';
import { LINES, say, endLine, shareText } from '../src/games/autocomplete/lines.js';
import { rng } from '../src/games/kit/fx.js';

const file = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const bin = file('public/games/autocomplete/words.bin');
const commonText = file('public/games/autocomplete/common.txt').toString('utf8');
const dict = createDict(new Uint32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4), commonText);
const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 84) % 26) + 97));
// a board from rows of tile letters ('th', 'ing'… are tokens)
const boardOf = (rows) => rows.flatMap((r) => r.split(' ').map((s) => makeTile(s)));

test('the dictionary: sorted, unique, a–z, 3 to 15 letters, the size we built, lean to send', () => {
  const words = [...dict.words()];
  assert.equal(words.length, dict.count, 'the header counts every word');
  assert.ok(words.length > 160_000 && words.length < 180_000, `${words.length} words`);
  for (let i = 0; i < words.length; i++) {
    assert.match(words[i], /^[a-z]{3,15}$/, words[i]);
    if (i) assert.ok(words[i - 1] < words[i], `sorted and unique: ${words[i - 1]} ${words[i]}`);
  }
  const her = commonText.split('\n').filter(Boolean);
  assert.equal(new Set(her).size, her.length, 'her vocabulary: each word once');
  assert.ok(her.length > 38_000 && her.length < 46_000, `${her.length} words she knows`);
  for (let i = 0; i < her.length; i += 7) assert.ok(dict.has(her[i]), `her word ${her[i]} is accepted`);
  assert.deepEqual(her.slice(0, 5), ['the', 'and', 'that', 'his', 'was'], 'the most likely first');
  const sent = gzipSync(bin).length + gzipSync(commonText).length;
  assert.ok(sent < 900_000, `${sent} bytes gzipped`);
});

test('the dictionary is PG-13: blocked words are never accepted, and their innocent look-alikes still are', () => {
  // (ROT13, so this file holds none of them in plain text)
  const blocked = ['shpx', 'fuvg', 'phag', 'ovgpu', 'jnaxre', 'cvffrq', 'qnza', 'nffubyr', 'avttre', 'snttbg', 'snt', 'xvxr', 'fcvp', 'puvax', 'tbbx',
    'jrgonpx', 'qlxr', 'genaal', 'ergneq', 'fcnfgvp', 'cbea', 'frk', 'frkl', 'betnfz', 'cravf', 'intvan', 'gvgf', 'obbof', 'juber', 'fyhg',
    'encr', 'encvfg', 'cvzc', 'cbbsgnu', 'anmv', 'fjnfgvxn', 'ylapuvat', 'zbyrfg', 'vaprfg', 'pbpx', 'qvpx', 'chffl', 'phz', 'frzra', 'uryy',
    'penc', 'gheq', 'fyhggl', 'frkhny', 'frkcybvgngvba', 'jubevfu', 'avtevsl', 'erqfxva', 'fdhnj', 'tlc', 'tlcfl', 'zvqtrg'];
  for (const w of blocked.map(rot13)) assert.equal(dict.has(w), false, `blocked: ${rot13(w)} (rot13)`);
  for (const w of blocked.map(rot13)) assert.equal(dict.rankOf(w), -1);
  for (const w of ['assess', 'class', 'glass', 'therapist', 'grape', 'scrape', 'sextant', 'sextet', 'swanky', 'hello', 'shell', 'cocoon',
    'raccoon', 'title', 'pimple', 'sclerotic', 'spice', 'suspicious', 'japan', 'dike', 'cocky', 'gypsum', 'lynchpin', 'tardy'])
    assert.equal(dict.has(w), true, `kept: ${w}`);
});

test('her vocabulary leaves out money talk and dark words, but keeps their innocent neighbours', () => {
  for (const w of ['buy', 'sell', 'money', 'cash', 'coin', 'tokens', 'trade', 'market', 'kill', 'dead', 'gun', 'beer', 'stupid', 'naked'])
    assert.equal(dict.rankOf(w), -1, `she never suggests ${w}`);
  for (const w of ['buy', 'sell', 'money', 'trade', 'kill', 'beer']) assert.equal(dict.has(w), true, `${w} is still a word you can play`);
  for (const w of ['fundamental', 'muffin', 'hello', 'psychology', 'demonstrate', 'cashew', 'heroine', 'farther', 'star', 'start'])
    assert.ok(dict.rankOf(w) >= 0, `she knows ${w}`);
  assert.ok(dict.rankOf('star') < dict.rankOf('starboard'), 'common words first');
});

test('paths: neighbours in 8 directions, no tile twice, sliding back undoes the last tile', () => {
  assert.equal(NEIGHBORS[0].length, 3);
  assert.equal(NEIGHBORS[COLS + 1].length, 8);
  assert.ok(adjacent(0, 6) && adjacent(6, 0) && adjacent(1, 5) && !adjacent(0, 2) && !adjacent(4, 5), 'diagonals yes, row wraps no');
  let p = stepPath([], 0);
  assert.deepEqual([p.action, p.path], ['add', [0]]);
  p = stepPath(p.path, 6); assert.deepEqual([p.action, p.path], ['add', [0, 6]]);
  p = stepPath(p.path, 12); assert.deepEqual([p.action, p.path], ['add', [0, 6, 12]]);
  assert.equal(stepPath(p.path, 12).action, 'same');
  assert.equal(stepPath(p.path, 0).action, 'blocked', 'no tile twice');
  assert.equal(stepPath(p.path, 24).action, 'blocked', 'only neighbours');
  p = stepPath(p.path, 6); assert.deepEqual([p.action, p.path], ['undo', [0, 6]]);
  p = stepPath(p.path, 0); assert.deepEqual([p.action, p.path], ['undo', [0]]);
});

test('tokens: a tile of several letters counts as all of them, both ways of playing', () => {
  const tiles = boardOf(['th ing s e x', 'a b c d o', 'r st re er u', 'n on l m p', 'qu i t e y', 'w ly k z j']);
  assert.equal(tiles[0].token, true);
  assert.equal(tiles[0].value, LETTER_VALUE.t + LETTER_VALUE.h);
  assert.equal(wordOf(tiles, [0, 1]), 'thing');
  const words = solve(tiles, dict);
  assert.ok(words.has('thing') && words.has('things'), 'the solver reads tokens');
  assert.deepEqual(words.get('thing').path, [0, 1]);
  assert.equal(words.get('thing').tokens, 2);
  assert.ok(words.has('quit') || words.has('quite'), 'QU is a Q and a U');
  // typed letters: whole tokens, and a token begun
  assert.deepEqual(typedPath(tiles, 'thing'), { path: [0, 1], partial: 0, complete: true });
  const half = typedPath(tiles, 'thin');
  assert.deepEqual(half, { path: [0, 1], partial: 1, complete: false }, 'ING begun: two of its three letters typed');
  assert.equal(typedPath(tiles, 'zzz'), null);
  assert.equal(census(tiles).tokenTiles, 8);
});

test('the scoring table: letters × length × tokens × how it did against her pick', () => {
  assert.deepEqual([3, 4, 5, 6, 7, 9].map(lengthMult), [1, 1.5, 2, 3, 4, 4]);
  assert.equal(letterSum('star'), 4);
  assert.equal(scoreWord({ word: 'star' }).points, 60);
  assert.equal(scoreWord({ word: 'star', kind: 'surprise' }).points, 90);
  assert.equal(scoreWord({ word: 'stars', kind: 'longer' }).points, 200);
  assert.equal(scoreWord({ word: 'started', tokens: 1, kind: 'longer' }).points, 960, 'STARTED with ED, longer than her pick');
  assert.equal(scoreWord({ word: 'star', glitch: true }).points, 120);
  assert.equal(scoreWord({ word: 'star', hinted: true }).points, 30);
  assert.equal(scoreWord({ word: 'quiz' }).points % 5, 0);
  for (const w of ['cat', 'zebra', 'quixotic']) assert.ok(scoreWord({ word: w }).points >= 5);
});

test('her prediction: the most likely word of her vocabulary that goes on from your first letters, here', () => {
  const tiles = boardOf(['s t a r e', 'z q j v d', 'k v w y b', 'f g p m h', 'c l u i n', 'o o b k d']);
  const words = solve(tiles, dict);
  for (const w of ['star', 'stare', 'stared', 'tar', 'tare', 'tared'].filter((x) => dict.has(x))) assert.ok(words.has(w), `found ${w}`);
  assert.equal(lockLength(tiles, [0]), 0);
  assert.equal(lockLength(tiles, [0, 1]), 2, 'two letters: she guesses');
  const g = predict(tiles, dict, [0, 1]);
  assert.ok(g.length >= 2);
  assert.equal(g[0].word, 'star', 'STAR is the likeliest ST… word on this board');
  assert.deepEqual(g[0].path, [0, 1, 2, 3], 'her guess comes with its path (the ghost on the board)');
  for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].rank < g[i].rank, 'in her order');
  for (const x of g) assert.ok(dict.rankOf(x.word) >= 0);
  // a token tile is two letters by itself
  const t2 = boardOf(['th e n x z', 'j q k v w', 'b c d f g', 'h l m p y', 'z x j q k', 'v w b c d']);
  assert.equal(lockLength(t2, [0]), 1);
  assert.equal(predict(t2, dict, [0])[0].word, 'the');
});

test('surprise rules: her pick ×1, another word ×1.5, a longer word (or no guess at all) ×2', () => {
  assert.equal(surpriseOf('star', 'star'), 'predictable');
  assert.equal(surpriseOf('stab', 'star'), 'surprise');
  assert.equal(surpriseOf('sat', 'star'), 'surprise');
  assert.equal(surpriseOf('stare', 'star'), 'longer');
  assert.equal(surpriseOf('stoa', null), 'longer');
});

test('every new board keeps words to find, and so does every refill (200 seeded refills)', () => {
  const r = rng(2026);
  let { tiles, check } = newBoard(dict, r);
  assert.ok(check.ok && check.words.size >= GUARANTEE.words && check.common >= GUARANTEE.common && check.long > 0);
  let rerolled = 0;
  for (let k = 0; k < 200; k++) {
    const words = [...check.words].filter(([w]) => dict.rankOf(w) >= 0);
    const [, info] = words[Math.floor(r.next() * words.length)];
    const res = refill(tiles, info.path, dict, r);
    assert.ok(res.check.ok, `refill ${k} keeps the guarantee`);
    assert.equal(res.tiles.filter(Boolean).length, SIZE);
    // the new tiles drop in at the top of their columns
    for (const s of res.spawns) if (!s.pop) assert.ok(s.from < 0 && s.to >= 0);
    // the board stays in range: Q only as QU, vowels 35–45% or close, a few tokens
    const c = census(res.tiles);
    assert.ok(!res.tiles.some((t) => t.s === 'q'));
    assert.ok(c.vowels / c.letters > 0.26 && c.vowels / c.letters < 0.55, `vowels ${c.vowels}/${c.letters}`);
    assert.ok(c.tokenTiles <= 6);
    rerolled += res.rerolls;
    tiles = res.tiles; check = res.check;
  }
  assert.ok(rerolled < 60, `${rerolled} rerolls`);
});

test('a seed repeats a game exactly: the board, its refills, her guesses', () => {
  const play = (seed) => {
    const r = rng(seed);
    let { tiles, check } = newBoard(dict, r);
    const log = [tiles.map((t) => t.s).join('')];
    for (let k = 0; k < 6; k++) {
      const [w, info] = [...check.words].filter(([x]) => x.length >= 4 && dict.rankOf(x) >= 0)[0];
      log.push(w, predict(tiles, dict, info.path.slice(0, 2)).map((g) => g.word).join(','));
      ({ tiles, check } = refill(tiles, info.path, dict, r));
      log.push(tiles.map((t) => t.s).join(''));
    }
    return log;
  };
  assert.deepEqual(play(7), play(7));
  assert.notDeepEqual(play(7), play(8));
});

test('the Daily: one seed a day, the same for everyone, different the next day', () => {
  const d = new Date(2026, 10, 9, 15, 30);
  assert.equal(dayKey(d), '2026-11-09');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
  assert.equal(daySeed('2026-11-09'), daySeed(dayKey(new Date(2026, 10, 9, 23, 59))));
  assert.notEqual(daySeed('2026-11-09'), daySeed('2026-11-10'));
  assert.ok(Number.isInteger(daySeed('2026-11-09')) && daySeed('2026-11-09') > 0);
  const a = newBoard(dict, rng(daySeed('2026-11-09'))).tiles.map((t) => t.s).join('');
  const b = newBoard(dict, rng(daySeed('2026-11-09'))).tiles.map((t) => t.s).join('');
  assert.equal(a, b, "today's board is everyone's");
  assert.equal(DAILY.seconds, 120);
});

test('the context window drains faster as a run goes on, and words fill it back up', () => {
  assert.ok(drainAt(0) < drainAt(60) && drainAt(60) < drainAt(180));
  assert.ok(drainAt(10_000) <= CONTEXT.drainMax);
  const c = newContext();
  assert.equal(c.value, CONTEXT.max);
  drainContext(c, 5);
  assert.equal(c.value, CONTEXT.max, 'it waits for the first swipe');
  c.running = true;
  for (let i = 0; i < 120; i++) drainContext(c, 1 / 120);
  assert.ok(Math.abs(c.value - (CONTEXT.max - drainAt(0.5))) < 0.2, `one second drained: ${c.value}`);
  assert.ok(refillFor(60) < refillFor(300) && refillFor(5000) === CONTEXT.refillMax && refillFor(0) === CONTEXT.refillMin);
  addContext(c, -10);
  const got = addContext(c, 50);
  assert.ok(got <= 50 && c.value === CONTEXT.max, 'never over full');
  // a run with no words ends: the window empties within a minute
  const idle = newContext(); idle.running = true;
  let t = 0;
  while (idle.value > 0 && t < 120) { drainContext(idle, 0.05); t += 0.05; }
  assert.ok(t > 45 && t < 75, `an idle window lasts ${t.toFixed(1)} s`);
});

test('glitch tiles: from 90 s, one at a time; play it for ×2, or it corrupts after 3 words', () => {
  const g = newGlitch();
  assert.equal(glitchDue(g, 30), false);
  assert.equal(glitchDue(g, GLITCH.from), true);
  startGlitch(g, 42);
  assert.equal(glitchDue(g, 200), false, 'one at a time');
  assert.equal(glitchAfterWord(g, false, 100), 'tick');
  assert.equal(glitchAfterWord(g, false, 104), 'tick');
  assert.equal(glitchAfterWord(g, false, 108), 'corrupt');
  assert.equal(g.tileId, 0);
  assert.equal(glitchDue(g, 110), false, 'a gap before the next');
  assert.equal(glitchDue(g, 108 + GLITCH.gap), true);
  startGlitch(g, 7);
  assert.equal(glitchAfterWord(g, true, 130), 'fixed');
  assert.equal(glitchAfterWord(g, false, 131), 'none');
  const { tiles, check } = newBoard(dict, rng(5));
  const cell = pickGlitchCell(tiles, check.words, dict, rng(1), [0, 1]);
  assert.ok(cell >= 2 && !tiles[cell].token, 'a single letter, off the path being drawn');
});

test('the hint, the tally and her lines', () => {
  const { tiles, check } = newBoard(dict, rng(11));
  const h = hintWord(tiles, dict, check.words, (w, info) => scoreWord({ word: w, tokens: info.tokens }).points);
  assert.ok(h && dict.rankOf(h.word) >= 0 && wordOf(tiles, h.path) === h.word, 'a word she knows, with its path');
  const t = newTally();
  tallyWord(t, { word: 'star', points: 60, kind: 'predictable' });
  tallyWord(t, { word: 'started', points: 960, kind: 'longer' });
  tallyWord(t, { word: 'stab', points: 90, kind: 'surprise' });
  tallyWord(t, { word: 'stab', points: 90, kind: 'surprise' });
  tallyWord(t, { word: 'rat', points: 30, kind: 'surprise' });
  assert.deepEqual([t.score, t.words, t.surprises, t.longest], [1230, 5, 4, 'started']);
  assert.deepEqual(t.top.map((x) => x.word), ['started', 'stab', 'star']);
  for (const [kind, list] of Object.entries(LINES)) {
    assert.ok(list.length, kind);
    for (const l of list) assert.ok(l === l.toLowerCase() || /NOT/.test(l), `her voice is lower case: ${l}`);
  }
  assert.equal(Object.values(LINES).flat().length >= 30, true, 'about 30 lines');
  assert.ok(say('predictable').length > 0);
  assert.match(endLine({ score: 20000, isBest: false, mode: 'endless', surprises: 9, words: 20 }), /./);
  assert.match(shareText({ surprises: 7, score: '4,210', mode: 'endless' }), /^I surprised AGI-1's autocomplete 7 times and scored 4,210 in AUTOCOMPLETE on agi1\.app/);
  const words = Object.values(LINES).flat().join(' ') + shareText({ surprises: 1, score: 1, mode: 'daily' });
  assert.doesNotMatch(words, /\$AGI|\bbuy\b|\bsell\b|\bprice\b|\bpump\b|\bdump\b|\binvest|\bprofit/i, 'never money');
  // a fresh tile is drawn the same way for the same dice
  assert.equal(drawTile([], rng(3)).s, drawTile([], rng(3)).s);
  assert.ok(TOKENS.includes('tion') && TOKENS.includes('qu'));
  assert.equal(ROWS * COLS, SIZE);
});
