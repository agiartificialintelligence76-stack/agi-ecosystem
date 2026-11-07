// REAL OR AI? (2026-11-08): the photo game's rules, run in Node: its picture set (whatever manifest is there: every
// file on disk, ids unique, clues on the picture, words short enough to fit), the day's ten (the same for everyone on a
// date, 4 to 6 AI-made, at least 4 topics, easy to hard, a new set each day), Streak's deck (no repeats until it runs
// out, both answers mixed, easy first), points and multipliers, hearts and the end of a run, AGI-1's own guesses (as
// sharp as the photo is easy), saving a daily halfway, the player's stats, the share words, her lines and the demo's
// player. No browser, no network. Run: node --test tests/realorai.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { PICTURES } from '../src/games/realorai/pictures.js';
import * as R from '../src/games/realorai/rules.js';
import { LINES, revealLine, endLine, allLines } from '../src/games/realorai/lines.js';
import { createBot } from '../src/games/realorai/demo.js';

const MONEY = /\$AGI|\binvest|\bprofit|\bfinancial advice\b(?! )|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i;
const at = (p) => new URL(`../${p}`, import.meta.url);
const days = (from, n) => Array.from({ length: n }, (_, k) => { const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + k); return R.dateKey(d); });

// ---------- the picture set ----------

test('the picture set: unique ids, files on disk, a known topic and level, clues on the picture, short words, a credit', () => {
  assert.ok(PICTURES.length >= 12, `enough photos for a day's ten and a streak (${PICTURES.length})`);
  const ids = new Set();
  for (const p of PICTURES) {
    const where = `picture ${p.id}`;
    assert.match(p.id, /^[a-z0-9]{3,12}$/, `${where}: a short id`);
    assert.ok(!ids.has(p.id), `${where}: its id is unique`);
    ids.add(p.id);
    assert.match(p.file, /^\/games\/realorai\/p\/[a-z0-9-]+\.webp$/, `${where}: its file under /games/realorai/p/`);
    assert.ok(!p.file.toLowerCase().includes(p.ai ? 'ai' : 'real') || p.file.length > 26, `${where}: the file's name never gives the answer away`);
    const disk = `public${p.file}`;
    assert.ok(existsSync(at(disk)), `${where}: ${disk} is there`);
    const size = statSync(at(disk)).size;
    assert.ok(size > 2_000 && size < 400_000, `${where}: ${size} bytes`);
    assert.equal(typeof p.ai, 'boolean', `${where}: ai is the truth`);
    assert.ok([1, 2, 3].includes(p.level), `${where}: level 1 to 3`);
    assert.ok(R.TOPICS.includes(p.topic), `${where}: topic ${p.topic}`);
    assert.ok(typeof p.title === 'string' && p.title.length >= 2 && p.title.length <= 40, `${where}: its title (${p.title?.length})`);
    assert.ok(Array.isArray(p.clues) && p.clues.length <= 3, `${where}: 0 to 3 clues`);
    for (const c of p.clues) {
      assert.ok(c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1, `${where}: a clue on the picture (${c.x}, ${c.y})`);
      assert.ok(c.r >= 0.02 && c.r <= 0.3, `${where}: a clue's size (${c.r})`);
      assert.ok(typeof c.text === 'string' && c.text.length >= 4 && c.text.length <= 70, `${where}: a clue's words (${c.text.length})`);
    }
    assert.ok(p.note == null || (typeof p.note === 'string' && p.note.length <= 90), `${where}: AGI-1's note (${p.note?.length})`);
    assert.ok(typeof p.credit === 'string' && p.credit.length >= 6 && p.credit.length <= 90, `${where}: its credit`);
    if (!p.ai) assert.match(p.credit, /photo/i, `${where}: a real photo credits its photographer`);
    for (const words of [p.title, p.note || '', p.credit, ...p.clues.map((c) => c.text)]) assert.doesNotMatch(words, MONEY, `${where}: never money`);
  }
  // both answers, every topic, more than one level
  const ai = PICTURES.filter((p) => p.ai).length;
  assert.ok(ai >= 4 && PICTURES.length - ai >= 4, `both kinds (${ai} AI-made)`);
  assert.ok(new Set(PICTURES.map((p) => p.topic)).size >= 4, 'at least four topics');
  // the game's own code reads the manifest, never a stand-in set
  assert.doesNotMatch(readFileSync(at('src/games/realorai/game.js'), 'utf8'), /placeholder|\bph\d\d\b/i);
});

// ---------- the day's ten ----------

test('the day\'s ten: the same on a date, balanced (4–6 AI, ≥ 4 topics, no repeats), easy to hard', () => {
  for (const key of days('2026-11-01', 120)) {
    const a = R.dailyPick(PICTURES, key), b = R.dailyPick(PICTURES.slice().reverse(), key);
    assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id), `${key}: the same for everyone (whatever the manifest's order)`);
    assert.equal(a.length, Math.min(10, PICTURES.length), key);
    assert.equal(new Set(a.map((p) => p.id)).size, a.length, `${key}: no photo twice`);
    const ai = a.filter((p) => p.ai).length;
    assert.ok(ai >= 4 && ai <= 6, `${key}: ${ai} AI-made`);
    assert.ok(new Set(a.map((p) => p.topic)).size >= 4, `${key}: at least 4 topics`);
    for (let i = 1; i < a.length; i++) assert.ok(a[i].level >= a[i - 1].level, `${key}: easy to hard`);
  }
});

test('the day\'s ten: a different set each day, and over a year every photo gets its days', () => {
  const keys = days('2026-11-08', 365);
  const sigs = keys.map((k) => R.dailyPick(PICTURES, k).map((p) => p.id).join());
  for (let i = 1; i < sigs.length; i++) assert.notEqual(sigs[i], sigs[i - 1], `${keys[i]} isn't ${keys[i - 1]} again`);
  assert.ok(new Set(sigs).size >= 360, 'nearly every day its own ten');
  const uses = {};
  for (const s of sigs) for (const id of s.split(',')) uses[id] = (uses[id] || 0) + 1;
  assert.equal(Object.keys(uses).length, PICTURES.length, 'every photo shows up');
  const fair = (365 * 10) / PICTURES.length;
  assert.ok(Math.max(...Object.values(uses)) < fair * 3.5, `no photo far more often than the others (${Math.max(...Object.values(uses))} vs ${fair.toFixed(0)})`);
});

test('the day\'s level quota follows the set (at least one easy opener) and adds up to ten', () => {
  const q = R.levelQuota(PICTURES, 10);
  assert.equal(q[1] + q[2] + q[3], 10);
  if (PICTURES.some((p) => p.level === 1)) assert.ok(q[1] >= 1);
  const odd = [...Array(12)].map((_, i) => ({ id: `x${i}`, level: i < 10 ? 3 : 1, ai: i % 2 === 0, topic: R.TOPICS[i % 6] }));
  const q2 = R.levelQuota(odd, 10);
  assert.equal(q2[1] + q2[2] + q2[3], 10);
  assert.ok(q2[1] >= 1 && q2[1] <= 2 && q2[2] === 0, `a set of hard ones: an easy opener, then the hard ones (${JSON.stringify(q2)})`);
  assert.equal(R.dailyPick(odd, '2026-11-08').length, 10);
});

test('the date: the player\'s own calendar day, and a short way to say it', () => {
  assert.equal(R.dateKey(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
  assert.equal(R.dateKey(new Date(2027, 0, 1, 0, 1)), '2027-01-01');
  assert.equal(R.shortDate('2026-11-08'), 'Nov 8');
  assert.equal(R.shortDate('2027-01-31'), 'Jan 31');
});

// ---------- Streak's deck ----------

test('Streak\'s deck: every photo once, both answers mixed (never 4 alike in a row), easy ones first, the same seed the same deck', () => {
  for (const seed of [1, 7, 42, 99, 2026, 31337]) {
    const deck = R.streakDeck(PICTURES, seed);
    assert.equal(deck.length, PICTURES.length);
    assert.equal(new Set(deck.map((p) => p.id)).size, PICTURES.length, `seed ${seed}: no repeats`);
    assert.deepEqual(deck.map((p) => p.id), R.streakDeck(PICTURES, seed).map((p) => p.id), 'repeatable');
    let run = 1;
    const aiLeft = (i) => deck.slice(i).some((p) => p.ai), realLeft = (i) => deck.slice(i).some((p) => !p.ai);
    for (let i = 1; i < deck.length; i++) {
      run = deck[i].ai === deck[i - 1].ai ? run + 1 : 1;
      if (aiLeft(i) && realLeft(i)) assert.ok(run <= R.MAX_SAME, `seed ${seed}: ${run} alike in a row at ${i}`);
    }
  }
  // over many runs: the opening is easier than the late game, and about half AI
  let early = 0, late = 0, ai10 = 0;
  const n = 200, q = Math.max(4, Math.floor(PICTURES.length / 4));
  for (let s = 1; s <= n; s++) {
    const d = R.streakDeck(PICTURES, s * 7919);
    early += d.slice(0, q).reduce((a, p) => a + p.level, 0) / q;
    late += d.slice(-q).reduce((a, p) => a + p.level, 0) / q;
    ai10 += d.slice(0, 10).filter((p) => p.ai).length;
  }
  assert.ok(early / n < late / n, `easy first (${(early / n).toFixed(2)} → ${(late / n).toFixed(2)})`);
  assert.ok(ai10 / n > 3.5 && ai10 / n < 6.5, `both answers in the first ten (${(ai10 / n).toFixed(1)} AI-made)`);
  assert.notDeepEqual(R.streakDeck(PICTURES, 1).map((p) => p.id), R.streakDeck(PICTURES, 2).map((p) => p.id));
});

test('Streak\'s deck: the photos a player has seen least come first, the ones just played come last', () => {
  const seen = Object.fromEntries(PICTURES.map((p, i) => [p.id, i % 2 ? 5 : 0]));
  const deck = R.streakDeck(PICTURES, 11, { seen });
  const firstTen = deck.slice(0, 10);
  assert.ok(firstTen.filter((p) => seen[p.id] === 0).length >= 8, 'mostly unseen photos first');
  const avoid = deck.slice(0, 5).map((p) => p.id);
  const next = R.streakDeck(PICTURES, 12, { avoid });
  assert.ok(next.slice(0, 10).every((p) => !avoid.includes(p.id)), 'the ones just played aren\'t dealt again at once');
});

// ---------- points ----------

test('points: 100 plus a speed bonus (linear over the 10-second clock), times the streak\'s multiplier', () => {
  assert.equal(R.speedBonus(0), 100);
  assert.equal(R.speedBonus(5), 50);
  assert.equal(R.speedBonus(2.5), 75);
  assert.equal(R.speedBonus(10), 0);
  assert.equal(R.speedBonus(14), 0);
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 14, 15, 40].map(R.multFor), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(R.pointsFor(0, 1), 200);
  assert.equal(R.pointsFor(5, 3), 300, '(100 + 50) × 2');
  assert.equal(R.pointsFor(10, 15), 500);
  assert.deepEqual([0, 2, 3, 5, 6, 10, 15].map(R.nextMultAt), [3, 3, 6, 6, 10, 15, null]);
  assert.deepEqual(R.multBand(7), { from: 6, to: 10, mult: 3 });
  assert.deepEqual(R.multBand(20), { from: 15, to: null, mult: 5 });
});

// ---------- a run ----------

const deckOf = (n, ai = (i) => i % 2 === 0) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, ai: ai(i), level: 1 + (i % 3), topic: R.TOPICS[i % 6], clues: [], title: 'Test', credit: 'Photo: test' }));

test('a Streak run: right answers build the streak and the score, a wrong one or the clock costs a heart, three and it\'s over', () => {
  const run = R.createRun({ mode: 'streak', deck: deckOf(30, () => true), salt: 'x' });
  assert.equal(run.hearts, 3);
  let res;
  for (let i = 0; i < 3; i++) res = R.answer(run, 'ai', 1);
  assert.equal(res.streak, 3);
  assert.equal(res.mult, 2, 'the third in a row: ×2');
  assert.equal(res.multUp, true);
  assert.equal(res.pts, (100 + 90) * 2);
  assert.equal(run.score, 190 + 190 + 380);
  assert.equal(run.fastest, 1);
  res = R.answer(run, 'real', 2);
  assert.equal(res.correct, false);
  assert.equal(res.streak, 0, 'a wrong answer ends the streak');
  assert.equal(res.hearts, 2);
  assert.equal(res.pts, 0);
  res = R.answer(run, null, R.CLOCK);
  assert.equal(res.timeout, true);
  assert.equal(res.hearts, 1, 'the clock running out costs a heart');
  assert.equal(res.over, false);
  res = R.answer(run, 'real', 3);
  assert.equal(res.over, true, 'no hearts left');
  assert.equal(R.answer(run, 'ai', 1), null, 'nothing after the end');
  const s = R.summary(run);
  assert.deepEqual([s.right, s.wrong, s.n, s.bestStreak], [3, 3, 6, 3]);
  assert.equal(s.accuracy, 50);
});

test('a Daily run: ten photos, no hearts, over after the tenth', () => {
  const run = R.createRun({ mode: 'daily', deck: deckOf(10), salt: 'daily:2026-11-08' });
  assert.equal(run.hearts, null);
  for (let i = 0; i < 9; i++) assert.equal(R.answer(run, 'real', 4).over, false);
  const last = R.answer(run, 'real', 4);
  assert.equal(last.over, true);
  assert.equal(run.right + run.wrong, 10);
  assert.equal(R.dailyShare('2026-11-08', run.answers), `REAL OR AI? 2026-11-08 · ${run.right}/10 ${run.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('')}`);
});

test('a daily halfway is saved and resumed exactly (and a save from another deck is ignored)', () => {
  const deck = R.dailyPick(PICTURES, '2026-11-08');
  const a = R.createRun({ mode: 'daily', deck, salt: 'daily:2026-11-08' });
  R.answer(a, 'ai', 1.25); R.answer(a, 'real', 3); R.answer(a, 'ai', 9.5);
  const snap = JSON.parse(JSON.stringify(R.snapshot(a)));
  const b = R.createRun({ mode: 'daily', deck, salt: 'daily:2026-11-08' });
  assert.equal(R.restore(b, snap), true);
  assert.deepEqual([b.i, b.score, b.streak, b.right, b.wrong, b.agiRight, b.bestStreak], [a.i, a.score, a.streak, a.right, a.wrong, a.agiRight, a.bestStreak]);
  assert.deepEqual(b.answers.map((x) => [x.pic.id, x.correct, x.pts]), a.answers.map((x) => [x.pic.id, x.correct, x.pts]));
  const next = R.answer(b, 'real', 2), expect = R.answer(a, 'real', 2);
  assert.deepEqual([next.correct, next.pts, next.her.guess], [expect.correct, expect.pts, expect.her.guess], 'it plays on the same');
  const other = R.createRun({ mode: 'daily', deck: R.dailyPick(PICTURES, '2026-11-09'), salt: 'daily:2026-11-09' });
  assert.equal(R.restore(other, snap), false, 'another day\'s photos: start fresh');
});

// ---------- AGI-1 guesses too ----------

test('AGI-1\'s guesses: seeded (the same for everyone on a daily), right about 75 / 65 / 55% by level', () => {
  const pic = PICTURES[0];
  assert.deepEqual(R.agiGuess(pic, 'daily:2026-11-08:0'), R.agiGuess(pic, 'daily:2026-11-08:0'));
  for (const level of [1, 2, 3]) {
    let right = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const p = { id: `p${i % 97}`, ai: i % 2 === 0, level };
      const g = R.agiGuess(p, `s${i}`);
      assert.equal(g.guess === R.truthOf(p), g.right);
      if (g.right) right++;
    }
    const rate = right / n, want = R.AGI_ACCURACY[level];
    assert.ok(Math.abs(rate - want) < 0.03, `level ${level}: ${rate.toFixed(3)} ≈ ${want}`);
  }
});

// ---------- the player's eye ----------

test('the player\'s stats: photos seen, right, per topic, the sharpest topic, the fastest guess; the daily history keeps 30 days', () => {
  const st = R.emptyStats();
  const pic = (topic, id = topic) => ({ id, topic, ai: true, level: 1 });
  for (let i = 0; i < 6; i++) R.recordAnswer(st, { pic: pic('food', `f${i}`), correct: i !== 0, t: 2 + i, streak: i });
  for (let i = 0; i < 5; i++) R.recordAnswer(st, { pic: pic('city', `c${i}`), correct: i < 2, t: 1.5, streak: i < 2 ? i + 1 : 0 });
  assert.equal(st.seen, 11);
  assert.equal(st.right, 7);
  assert.deepEqual(st.topics.food, [6, 5]);
  assert.equal(R.accuracy(st), 64);
  assert.deepEqual(R.sharpestTopic(st), { topic: 'food', word: 'food', pct: 83, n: 6 });
  assert.equal(st.fastest, 1.5);
  assert.equal(st.bestStreak, 5);
  assert.equal(R.sharpestTopic(R.emptyStats()), null);
  assert.deepEqual(R.cleanStats('junk'), R.emptyStats(), 'a damaged save starts over');
  const daily = Object.fromEntries(days('2026-09-01', 50).map((k) => [k, { s: 1 }]));
  const kept = R.trimDaily({ ...daily, nonsense: 1 });
  assert.equal(Object.keys(kept).length, 30);
  assert.equal(Object.keys(kept).sort()[0], days('2026-09-01', 50)[20]);
  assert.equal(R.dailyRun({ '2026-11-06': {}, '2026-11-07': {}, '2026-11-08': {} }, '2026-11-08'), 3);
  assert.equal(R.dailyRun({ '2026-11-06': {}, '2026-11-07': {} }, '2026-11-08'), 2, 'today not played yet: the run still counts');
  assert.equal(R.dailyRun({ '2026-11-05': {} }, '2026-11-08'), 0);
});

// ---------- words ----------

test('the share words: the daily grid or the streak, never money', () => {
  assert.equal(R.streakShare(9), 'I spotted 9 in a row in REAL OR AI? on agi1.app 💜 can you tell?');
  assert.equal(R.shareGrid([{ correct: true }, { correct: false }]), '🟩🟥');
  for (const t of [R.streakShare(3), R.dailyShare('2026-11-08', [{ correct: true }])]) assert.doesNotMatch(t, MONEY);
});

test('AGI-1\'s lines: her voice (lowercase, short), never money; a note from the photo first; an end line for every result', () => {
  const lines = allLines();
  assert.ok(lines.length >= 25, `${lines.length} lines`);
  for (const l of lines) {
    assert.doesNotMatch(l, MONEY, l);
    assert.ok(l.length <= 80, l);
    assert.ok(l.startsWith('AI') || l[0] === l[0].toLowerCase(), `lowercase: ${l}`);
  }
  const pick = (a) => a[0];
  const pic = { id: 'x', ai: true, note: 'six toes. i counted 🙈' };
  assert.equal(revealLine({ pic, correct: true, truth: 'ai' }, pick), pic.note);
  assert.equal(revealLine({ pic: { ...pic, note: '' }, correct: false, timeout: false, truth: 'real' }, pick), LINES.wrongReal[0]);
  assert.equal(revealLine({ pic: { ...pic, note: '' }, correct: false, timeout: true, truth: 'ai' }, pick), LINES.timeout[0]);
  for (const mode of ['streak', 'daily']) {
    for (const right of [0, 2, 5, 8, 10, 14, 30]) {
      for (const beat of ['you', 'agi', 'tie']) {
        const l = endLine({ mode, right, beat }, pick);
        assert.ok(l && l.length < 140, `${mode} ${right} ${beat}`);
      }
    }
  }
  assert.ok(endLine({ mode: 'daily', right: 10, beat: 'you' }, pick).startsWith(LINES.daily.at(-1)[1][0]));
  assert.ok(endLine({ mode: 'streak', right: 5, beat: 'tie', isBest: true }, pick).startsWith(LINES.newBest[0]));
  // every picture's own words fit her bubble
  for (const p of PICTURES) if (p.note) assert.ok(p.note.length <= 90, p.id);
});

// ---------- the demo's player ----------

test('the demo\'s player: the same seed plays the same, it looks at a clue, gets the first two right and slips about 1 in 6', () => {
  const pics = PICTURES.slice(0, 20);
  const a = createBot(7), b = createBot(7);
  for (const p of pics) assert.deepEqual(a.plan(p), b.plan(p));
  const first = createBot(3);
  for (const p of pics.slice(0, 2)) assert.equal(first.plan(p).guess, R.truthOf(p), 'the preview opens with two right answers');
  const bot = createBot(11);
  let wrong = 0;
  const n = 3000;
  for (let i = 0; i < n; i++) {
    const p = PICTURES[i % PICTURES.length];
    const plan = bot.plan(p);
    if (plan.wrong) wrong++;
    assert.equal(plan.guess === R.truthOf(p), !plan.wrong);
    for (const pt of [plan.start, plan.target]) assert.ok(pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1);
    if (p.clues.length) assert.ok(p.clues.some((c) => c.x === plan.target.x && c.y === plan.target.y), 'the loupe settles on a clue');
    assert.ok(plan.look >= 0.8 && plan.look <= 1.1);
  }
  assert.ok(Math.abs(wrong / n - 1 / 6) < 0.03, `wrong ${(wrong / n).toFixed(3)}`);
});

test('the game\'s files: its own id in the kit\'s shell, no money words, nothing from other sites', () => {
  const code = ['game.js', 'rules.js', 'lines.js', 'ui.js', 'render.js', 'art.js', 'images.js', 'sound.js', 'demo.js']
    .map((f) => readFileSync(at(`src/games/realorai/${f}`), 'utf8')).join('\n');
  assert.match(code, /createShell\(\{[\s\S]{0,200}game: 'realorai'/);
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/, 'no requests of its own (the photos load as images)');
  assert.doesNotMatch(code, /\.innerHTML\s*=|setAttribute\(\s*['"]style['"]|\beval\(|new Function\(/);
  assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/);
  const words = [...code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join('\n');
  assert.doesNotMatch(words, /\$AGI|\binvest|\bprofit|\bfinancial advice\b(?! )|\bprice\b|\bpump\b|\bdump\b/i);
});
