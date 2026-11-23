// FINAL ANSWER gameplay, question-bank, lifeline, safety-net, Blitz, Daily, demo AI, and CSP tests (Node only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QUESTIONS, CATEGORIES } from '../src/games/finalanswer/questions.js';
import {
  LADDER, LETTERS, MODES, BASE_SAFE_INDEX, CUSTOM_FLOOR_MIN, CUSTOM_FLOOR_MAX,
  buildDeck, createRun, currentQuestion, currentRung, guaranteedValue, walkValue,
  canWalkAway, canSetCustomFloor, setCustomFloor, armOption, lockAnswer, advanceRung,
  useLifeline, walkAway, timeoutQuestion, summary, shareGrid, shareText,
  cleanStats, recordRunStats, dailySeed, blitzMultiplier,
} from '../src/games/finalanswer/rules.js';
import { LINES, endLineFor } from '../src/games/finalanswer/lines.js';
import { createDemoBot } from '../src/games/finalanswer/ai.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('question bank: rich coverage across all 4 tiers, 4 distinct answers each, valid categories, zero money words', () => {
  assert.ok(QUESTIONS.length >= 180, `at least 180 questions (${QUESTIONS.length})`);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), `unique id: ${q.id}`);
    ids.add(q.id);
    assert.ok([1, 2, 3, 4].includes(q.tier), q.id);
    counts[q.tier]++;
    assert.ok(CATEGORIES.includes(q.cat), `${q.id}: valid category ${q.cat}`);
    assert.ok(typeof q.q === 'string' && q.q.length >= 14 && q.q.length <= 165, `${q.id}: readable length`);
    assert.equal(q.a.length, 4, `${q.id}: four choices`);
    assert.equal(new Set(q.a.map((x) => x.toLowerCase().trim())).size, 4, `${q.id}: four unique choices`);
    for (const opt of q.a) assert.ok(opt.trim().length >= 1 && opt.length <= 72, `${q.id}: option length`);
    assert.ok(typeof q.hint === 'string' && q.hint.trim().length >= 8, `${q.id}: hint`);
    assert.ok(typeof q.fact === 'string' && q.fact.trim().length >= 12, `${q.id}: fact`);
    const text = [q.q, ...q.a, q.hint, q.fact].join(' ');
    assert.doesNotMatch(text, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b/i, `${q.id}: no money talk`);
  }
  assert.ok(counts[1] >= 50, `tier 1 count (${counts[1]})`);
  assert.ok(counts[2] >= 50, `tier 2 count (${counts[2]})`);
  assert.ok(counts[3] >= 45, `tier 3 count (${counts[3]})`);
  assert.ok(counts[4] >= 20, `tier 4 count (${counts[4]})`);
});

test('ladder and deck builder: 15 rungs to 1,000,000, deterministic by seed, all 4 answer slots used, daily seed repeatable', () => {
  assert.equal(LADDER.length, 15);
  assert.equal(LADDER[0].value, 100);
  assert.equal(LADDER[BASE_SAFE_INDEX].value, 1000);
  assert.equal(LADDER[14].value, 1000000);

  const a = buildDeck({ seed: 42 });
  const b = buildDeck({ seed: 42 });
  const c = buildDeck({ seed: 43 });
  assert.deepEqual(a.deck.map((q) => [q.id, q.correct, q.options]), b.deck.map((q) => [q.id, q.correct, q.options]));
  assert.notDeepEqual(a.deck.map((q) => q.id), c.deck.map((q) => q.id));
  assert.equal(new Set(a.deck.map((q) => q.id)).size, 15, '15 distinct questions per show');

  const slots = new Set();
  for (let s = 1; s <= 12; s++) {
    for (const q of buildDeck({ seed: s * 17 }).deck) slots.add(q.correct);
  }
  assert.deepEqual([...slots].sort(), [0, 1, 2, 3], 'every option slot A-D hosts right answers');

  // Seen questions pushed behind unseen ones
  const firstRunIds = a.deck.map((q) => q.id);
  const nextRun = buildDeck({ seed: 42, seen: firstRunIds });
  const overlap = nextRun.deck.filter((q) => firstRunIds.includes(q.id)).length;
  assert.equal(overlap, 0, 'fresh run prioritizes unseen questions');

  // Daily mode matches across calls for the same date
  assert.equal(dailySeed('2026-11-23'), dailySeed('2026-11-23'));
  assert.notEqual(dailySeed('2026-11-23'), dailySeed('2026-11-24'));
  const d1 = createRun({ mode: 'daily', date: '2026-11-23' });
  const d2 = createRun({ mode: 'daily', date: '2026-11-23' });
  assert.deepEqual(d1.deck.map((q) => q.id), d2.deck.map((q) => q.id));
});

test('classic climb to 1,000,000: base floor at Q5, fever at 3-streak, SWAP unlock at Q10, million victory at Q15', () => {
  const run = createRun({ mode: 'classic', seed: 99 });
  assert.equal(run.lifelines.swap.locked, true, 'SWAP starts locked until Q10');
  assert.equal(canWalkAway(run), false, 'cannot walk before clearing Q1');
  let sawFever = false;
  let sawBaseSafe = false;
  let sawSwapUnlock = false;

  for (let i = 0; i < 15; i++) {
    const q = currentQuestion(run);
    assert.ok(q);
    assert.equal(armOption(run, q.correct), true);
    const res = lockAnswer(run, q.correct, 4.5);
    assert.equal(res.ok, true);
    if (res.ignitedFever) sawFever = true;
    if (res.milestone === 'base_safe') sawBaseSafe = true;
    if (res.unlockedSwap) sawSwapUnlock = true;
    if (i < 14) {
      assert.equal(res.result, 'correct');
      assert.equal(advanceRung(run), true);
    } else {
      assert.equal(res.result, 'million');
    }
  }

  assert.equal(sawFever, true);
  assert.equal(sawBaseSafe, true);
  assert.equal(sawSwapUnlock, true);
  assert.equal(run.lifelines.swap.locked, false);
  assert.equal(run.lifelines.swap.available, true);
  assert.equal(run.over, true);
  assert.equal(run.endReason, 'million');
  assert.equal(run.finalLadder, 1000000);
  assert.ok(run.finalScore > 1000000, 'speed bonus adds atop 1,000,000');
  assert.equal(summary(run).wonMillion, true);
  assert.match(shareGrid(run), /👑$/);
  assert.match(shareText(run), /15 rungs/);
});

test('custom 2nd safety net: must earn the planted rung before it locks as your fallback floor', () => {
  // Case A: plant at Q8 (8,000), miss ON Q8 -> drops to base floor (1,000)
  const rA = createRun({ mode: 'classic', seed: 15 });
  assert.equal(canSetCustomFloor(rA, 3), false, 'cannot plant below Q7');
  assert.equal(canSetCustomFloor(rA, 14), false, 'cannot plant on Q15');
  assert.equal(setCustomFloor(rA, 7).ok, true, 'planted at Q8 (index 7, 8,000)');
  assert.equal(setCustomFloor(rA, 9).ok, false, 'can only plant once');
  for (let i = 0; i < 7; i++) {
    lockAnswer(rA, currentQuestion(rA).correct, 8);
    advanceRung(rA);
  }
  assert.equal(guaranteedValue(rA), 1000, 'not locked yet before clearing Q8');
  const wrongIdx = (currentQuestion(rA).correct + 1) % 4;
  const miss = lockAnswer(rA, wrongIdx, 10);
  assert.equal(miss.result, 'wrong');
  assert.equal(miss.floorValue, 1000);
  assert.equal(rA.finalLadder, 1000);

  // Case B: plant at Q11 (64,000), clear Q11, then miss on Q13 -> safely lands on 64,000!
  const rB = createRun({ mode: 'classic', seed: 21 });
  assert.equal(setCustomFloor(rB, 10).ok, true, 'planted at Q11 (index 10, 64,000)');
  for (let i = 0; i < 12; i++) {
    const res = lockAnswer(rB, currentQuestion(rB).correct, 7);
    if (i === 10) assert.equal(res.milestone, 'custom_safe');
    advanceRung(rB);
  }
  assert.equal(guaranteedValue(rB), 64000);
  const w2 = (currentQuestion(rB).correct + 1) % 4;
  const m2 = lockAnswer(rB, w2, 9);
  assert.equal(m2.floorValue, 64000);
  assert.equal(rB.finalLadder, 64000);
  assert.equal(rB.finalScore, 64000 + rB.speedPot);
});

test('all 5 lifelines: 50:50, Ask Chat, Ask AGI-1, Double Dip (2nd shot + no walk), and Switch', () => {
  const run = createRun({ mode: 'classic', seed: 77 });
  const q0 = currentQuestion(run);

  // 1. 50:50 slices 2 wrong answers, never the right one
  const sp = useLifeline(run, 'split');
  assert.equal(sp.ok, true);
  assert.equal(sp.removed.length, 2);
  assert.ok(!sp.removed.includes(q0.correct), 'never removes the correct answer');
  assert.equal(useLifeline(run, 'split').ok, false, 'one use per show');

  // 2. Ask Chat sums to 100%, 0% on eliminated options, 5 chat messages
  const ch = useLifeline(run, 'chat');
  assert.equal(ch.ok, true);
  assert.equal(ch.poll.pct.reduce((a, b) => a + b, 0), 100);
  for (const elim of sp.removed) assert.equal(ch.poll.pct[elim], 0, 'eliminated option gets 0%');
  assert.equal(ch.poll.messages.length, 5);

  // 3. Ask AGI-1 picks a live option with valid confidence
  const agi = useLifeline(run, 'agi');
  assert.equal(agi.ok, true);
  assert.ok(!sp.removed.includes(agi.advice.pick));
  assert.ok(agi.advice.confidence >= 48 && agi.advice.confidence <= 98);
  assert.ok(agi.advice.note.includes(LETTERS[agi.advice.pick]));

  // Advance to Q2 to test Double Dip + Walk Away disable
  lockAnswer(run, q0.correct, 5);
  advanceRung(run);
  assert.equal(canWalkAway(run), true);
  const dd = useLifeline(run, 'double');
  assert.equal(dd.ok, true);
  assert.equal(canWalkAway(run), false, 'Double Dip disables walking away');

  const q1 = currentQuestion(run);
  const wrong1 = (q1.correct + 1) % 4;
  const shot1 = lockAnswer(run, wrong1, 6);
  assert.equal(shot1.result, 'double_miss', '1st miss cracks shield, stays alive');
  assert.equal(run.over, false);
  assert.ok(run.eliminated.includes(wrong1));
  const shot2 = lockAnswer(run, q1.correct, 9);
  assert.equal(shot2.result, 'correct');

  // Climb past Q10 so Switch unlocks, then fire Switch
  advanceRung(run);
  for (let i = 2; i < 10; i++) {
    lockAnswer(run, currentQuestion(run).correct, 6);
    advanceRung(run);
  }
  assert.equal(run.lifelines.swap.available, true);
  const beforeQ = currentQuestion(run);
  const sw = useLifeline(run, 'swap');
  assert.equal(sw.ok, true);
  assert.notEqual(currentQuestion(run).id, beforeQ.id);
  assert.equal(currentQuestion(run).tier, beforeQ.tier);
});

test('Walk Away banks cleared rung + speed pot; High Voltage enforces hard clock, no walk, and streak multiplier', () => {
  const r = createRun({ mode: 'classic', seed: 33 });
  for (let i = 0; i < 4; i++) {
    lockAnswer(r, currentQuestion(r).correct, 5);
    advanceRung(r);
  }
  assert.equal(walkValue(r), 500);
  const w = walkAway(r);
  assert.equal(w.ok, true);
  assert.equal(w.haul, 500);
  assert.equal(r.over, true);
  assert.equal(r.endReason, 'walk');
  assert.equal(r.finalScore, 500 + r.speedPot);

  const b = createRun({ mode: 'blitz', seed: 55 });
  assert.equal(b.cfg.hardClock, true);
  assert.equal(b.cfg.clock, 15);
  assert.equal(b.lifelines.swap.available, true, 'Blitz includes Switch from start');
  for (let i = 0; i < 5; i++) {
    lockAnswer(b, currentQuestion(b).correct, 3);
    advanceRung(b);
  }
  assert.equal(canWalkAway(b), false);
  assert.equal(blitzMultiplier(5), 2);
  const to = timeoutQuestion(b);
  assert.equal(to.ok, true);
  assert.equal(to.result, 'timeout');
  assert.equal(b.over, true);
  assert.equal(b.finalLadder, 1000);
  assert.equal(b.finalScore, 1000 * 2 + b.speedPot);
});

test('stats persistence, host lines, demo bot determinism, and strict CSP hygiene', () => {
  const run = createRun({ mode: 'daily', date: '2026-11-23' });
  lockAnswer(run, currentQuestion(run).correct, 4);
  advanceRung(run);
  walkAway(run);

  let st = cleanStats(null);
  st = recordRunStats(st, run);
  assert.equal(st.runs, 1);
  assert.equal(st.bestRung, 1);
  assert.equal(st.daily['2026-11-23'].cleared, 1);
  assert.ok(endLineFor(summary(run)).length > 0);
  assert.ok(LINES.welcome.length >= 2);

  // Demo bot is deterministic
  const r1 = createRun({ mode: 'classic', seed: 7, startRung: 6 });
  const r2 = createRun({ mode: 'classic', seed: 7, startRung: 6 });
  assert.deepEqual(createDemoBot(7).plan(r1), createDemoBot(7).plan(r2));

  // Strict CSP check across all source files
  const files = readdirSync(new URL('../src/games/finalanswer/', import.meta.url));
  for (const f of files) {
    const src = read(`src/games/finalanswer/${f}`);
    if (f.endsWith('.js')) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
      assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|setAttribute\(\s*['"]style['"]|\beval\(|new Function\(/, `${f}: CSP clean`);
    }
    if (f.endsWith('.css')) {
      for (const m of src.matchAll(/z-index:\s*(\d+)/g)) {
        assert.ok(Number(m[1]) < 100, `${f}: z-index ${m[1]} well below intro`);
      }
    }
  }
});
