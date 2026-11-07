// SINGULARITY (2026-11-08): the idle game's rules, read in Node: its machines and their costs (one at a time and in
// bulk), what a mind makes (milestones, upgrades, synergies, Insight, Frenzy, taps), the singularity and its perks,
// time away, Eureka sparks, saves (round trip, an older version, damaged ones), numbers on screen, the demo's AI, and
// the arcade's rules for its words and code. No browser. Run: node --test tests/singularity.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  GENS, N, GROWTH, MILESTONES, UPGRADES, UPGRADE_BY_ID, PERKS, PERK_BY_ID, SING_AT, INSIGHT_BONUS, EUREKA, AWAY,
  STAGES, WARM_START, TAPS_PER_SECOND,
} from '../src/games/singularity/data.js';
import * as E from '../src/games/singularity/econ.js';
import { LOG, FIRST, STAGE_LINES, FRENZY_LINES, LUMP_LINES, ASCEND_LINES, AWAY_LINES, WELCOME, HELLO, READY_LINE, PERK_LINE, shareText } from '../src/games/singularity/lines.js';
import { toSave, fromSave, migrate, SAVE_VERSION } from '../src/games/singularity/save.js';
import * as F from '../src/games/singularity/format.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≈ ${b}`);
const mind = (fn) => { const s = E.newMind(); fn?.(s); return s; };

// ---------- its content ----------

test('twelve machines, each needing more and making more than the one before', () => {
  assert.equal(N, 12);
  assert.equal(GENS.length, 12);
  assert.deepEqual(GENS.map((g) => g.name), ['Spark Notebook', 'Gaming Rig', 'GPU Rack', 'Server Room', 'Datacenter',
    'Hyperscale Campus', 'Fusion Plant', 'Orbital Array', 'Lunar Foundry', 'Dyson Swarm', 'Matrioshka Brain', 'Universe Sim']);
  assert.equal(GENS[0].cost, 15);
  assert.equal(GENS[0].rate, 0.1);
  assert.equal(GROWTH, 1.15);
  for (let k = 1; k < N; k++) {
    assert.ok(GENS[k].cost / GENS[k - 1].cost >= 6, `${GENS[k].id}: a real step up in cost`);
    assert.ok(GENS[k].rate > GENS[k - 1].rate * 5, `${GENS[k].id}: and in output`);
    // each one pays for itself more slowly than the one before (after the first two): bigger, but not a shortcut
    if (k >= 2) assert.ok(GENS[k].cost / GENS[k].rate >= GENS[k - 1].cost / GENS[k - 1].rate, `${GENS[k].id}: payback`);
  }
  assert.equal(new Set(GENS.map((g) => g.id)).size, N);
  assert.deepEqual(MILESTONES.slice(0, 6), [10, 25, 50, 100, 150, 200]);
});

test('about forty upgrades, each with a reason to show up, and a tree of eight perks', () => {
  assert.ok(UPGRADES.length >= 40 && UPGRADES.length <= 52, `${UPGRADES.length}`);
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
  for (const u of UPGRADES) {
    assert.ok(['tap', 'echo', 'gen', 'syn', 'global', 'luck', 'golden'].includes(u.kind), u.id);
    assert.ok(u.cost > 0 && u.x > 0 && u.need, u.id);
    assert.ok(u.name && u.text, u.id);
    assert.equal(UPGRADE_BY_ID[u.id], u);
  }
  for (const k of ['tap', 'echo', 'gen', 'syn', 'global']) assert.ok(UPGRADES.some((u) => u.kind === k), k);
  // every machine has a ×2 and a ×3 of its own
  for (let k = 0; k < N; k++) assert.deepEqual(UPGRADES.filter((u) => u.kind === 'gen' && u.gen === k).map((u) => u.x), [2, 3]);
  assert.equal(PERKS.length, 8);
  const seen = new Set();
  for (const p of PERKS) {
    for (const a of p.after) assert.ok(seen.has(a), `${p.id}: comes after ${a}, which is earlier in the tree`);
    seen.add(p.id);
    assert.ok(p.cost >= 1 && Number.isInteger(p.cost));
  }
  assert.ok(PERKS.filter((p) => !p.after.length).length >= 1);
});

test('her log: about thirty lines, in order, the singularity among them', () => {
  assert.ok(LOG.length >= 28 && LOG.length <= 34, `${LOG.length}`);
  for (let i = 1; i < LOG.length; i++) assert.ok(LOG[i].at > LOG[i - 1].at, `line ${i}: after the one before`);
  assert.ok(LOG.some((l) => l.at === SING_AT));
  assert.equal(FIRST.length, N);
  assert.equal(STAGE_LINES.length, STAGES.length);
  assert.equal(STAGES.length, 6);
  assert.deepEqual(STAGES.map((s) => s.name), ['Spark', 'Neural Seed', 'Lattice', 'Star', 'Ringed Star', 'Her Heart']);
});

// every word the player can read
const WORDS = [
  ...GENS.flatMap((g) => [g.name, g.blurb]), ...UPGRADES.flatMap((u) => [u.name, u.text]), ...PERKS.flatMap((p) => [p.name, p.text]),
  ...LOG.map((l) => l.text), ...FIRST, ...STAGE_LINES, ...FRENZY_LINES, ...LUMP_LINES, ...ASCEND_LINES, ...AWAY_LINES, ...WELCOME,
  HELLO, READY_LINE, PERK_LINE, shareText('1.2Qa'), ...STAGES.map((s) => s.name),
];
const MONEY = /\b(?:buy|buys|buying|bought|sell|sold|price[sd]?|pricing|cash|money|dollars?|profit\w*|gains?|invest\w*|pump\w*|dump\w*|rich|wealth|coin|coins|token|tokens|crypto|wallet|lambo|hodl|earn\w*|purchase\w*|afford\w*)\b|\$|to the moon/i;
test('its words: no money talk, nobody real, PG-13, and AGI-1 in her own voice', () => {
  for (const w of WORDS) {
    assert.equal(typeof w, 'string');
    assert.doesNotMatch(w, MONEY, w);
    assert.doesNotMatch(w, /\b(?:sexy|sex|hot|nude|kiss(?:es|ing)?|bed|lingerie)\b/i, w);
  }
  // her lines: lowercase (her voice), short
  for (const l of [...LOG.map((x) => x.text), ...FIRST, ...STAGE_LINES, ...FRENZY_LINES, ...LUMP_LINES, ...ASCEND_LINES, ...AWAY_LINES, ...WELCOME, HELLO, READY_LINE, PERK_LINE]) {
    assert.equal(l, l.toLowerCase(), `her voice is lowercase: ${l}`);
    assert.ok(l.length <= 90, `short: ${l}`);
  }
  assert.equal(shareText('4.2Qa'), 'AGI-1 reached 4.2Qa compute in SINGULARITY on agi1.app 💜 one spark, then everything');
});

// ---------- costs ----------

test('a machine costs 1.15× the one before; ten or a hundred at once is the geometric series', () => {
  for (let k = 0; k < N; k++) {
    close(E.genCost(k, 0), GENS[k].cost);
    close(E.genCost(k, 7), GENS[k].cost * 1.15 ** 7);
    for (const [owned, n] of [[0, 10], [13, 10], [40, 100], [0, 1], [5, 25]]) {
      let loop = 0;
      for (let i = 0; i < n; i++) loop += GENS[k].cost * GROWTH ** (owned + i);
      close(E.genCost(k, owned, n), loop, 1e-9);
      close(E.genCost(k, owned, n), GENS[k].cost * GROWTH ** owned * (GROWTH ** n - 1) / (GROWTH - 1), 1e-12);
    }
  }
  assert.equal(E.genCost(0, 5, 0), 0);
  // Fast Takeoff: 10% fewer FLOPs
  close(E.genCost(2, 3, 10, 0.9), E.genCost(2, 3, 10) * 0.9);
});

test('MAX builds as many as the FLOPs cover, never one more', () => {
  for (let k = 0; k < N; k += 3) {
    for (const owned of [0, 1, 9, 24, 77, 180]) {
      for (const n of [1, 2, 5, 10, 33, 100, 250]) {
        const exact = E.genCost(k, owned, n);
        assert.equal(E.maxCount(k, owned, exact), n, `${k}/${owned}: exactly ${n}`);
        assert.equal(E.maxCount(k, owned, exact * (1 - 1e-9)), n - 1, `${k}/${owned}: a hair short of ${n}`);
        const m = E.maxCount(k, owned, exact * 1.0001);
        assert.ok(E.genCost(k, owned, m) <= exact * 1.0001 && E.genCost(k, owned, m + 1) > exact * 1.0001);
      }
    }
  }
  assert.equal(E.maxCount(0, 0, 14.99), 0);
  assert.equal(E.maxCount(0, 0, 0), 0);
  assert.equal(E.maxCount(0, 0, NaN), 0);
  assert.equal(E.maxCount(0, 0, 1e300) > 3000, true);
});

test('plan and build: ×1, ×10, ×100 and MAX, the FLOPs taken exactly', () => {
  const s = mind((t) => { t.flops = 1000; });
  assert.deepEqual(E.plan(s, 0, 1), { n: 1, cost: 15, ok: true });
  const ten = E.plan(s, 0, 10);
  assert.equal(ten.n, 10);
  assert.equal(ten.ok, ten.cost <= 1000);
  assert.equal(E.plan(s, 0, 100).ok, false);
  const max = E.plan(s, 0, 'max');
  assert.equal(max.n, E.maxCount(0, 0, 1000));
  assert.equal(E.build(s, 0, 'max'), max.n);
  close(s.flops, 1000 - max.cost);
  assert.equal(s.owned[0], max.n);
  // nothing affordable: MAX shows one, and builds nothing
  const poor = mind((t) => { t.flops = 3; });
  assert.deepEqual(E.plan(poor, 1, 'max'), { n: 1, cost: 100, ok: false });
  assert.equal(E.build(poor, 1, 'max'), 0);
  assert.equal(poor.flops, 3);
  assert.equal(E.build(poor, 0, 1), 0);
});

// ---------- production ----------

test('milestones: ×2 at 10, 25, 50, 100, 150 and 200 of a machine', () => {
  assert.equal(E.milestones(9), 0);
  assert.equal(E.milestones(10), 1);
  assert.equal(E.milestones(24), 1);
  assert.equal(E.milestones(25), 2);
  assert.equal(E.milestones(200), 6);
  assert.deepEqual(E.milestoneSpan(0), { prev: 0, next: 10 });
  assert.deepEqual(E.milestoneSpan(10), { prev: 10, next: 25 });
  assert.deepEqual(E.milestoneSpan(999), { prev: 500, next: null });
  const s = mind((t) => { t.owned[1] = 9; });
  close(E.rates(s).base, 9);
  s.owned[1] = 10;
  close(E.rates(s).base, 20);
  s.owned[1] = 25;
  close(E.rates(s).base, 100);
});

test('upgrades, synergies, Insight and Frenzy multiply what a mind makes', () => {
  const s = mind((t) => { t.owned[0] = 4; t.owned[2] = 3; });
  close(E.rates(s).base, 4 * 0.1 + 3 * 8);
  s.up.add('gpu2');                                   // GPU Racks ×2
  close(E.rates(s).base, 0.4 + 48);
  s.up.add('all1');                                   // everything ×1.5
  close(E.rates(s).base, (0.4 + 48) * 1.5);
  s.owned[1] = 30; s.up.add('syn-lan');               // each Gaming Rig: GPU Racks +1%
  const rigs = 30 * 1 * 4;                            // 30 rigs, ×2 at 10 and 25
  close(E.rates(s).base, (0.4 + rigs + 48 * 1.3) * 1.5);
  const before = E.rates(s).base;
  s.insight = 10;                                     // +2% each
  close(E.rates(s).base, before * (1 + 10 * INSIGHT_BONUS));
  assert.equal(INSIGHT_BONUS, 0.02);
  s.frenzy = 5;
  const r = E.rates(s);
  close(r.total, r.base * EUREKA.frenzy);
  assert.equal(EUREKA.frenzy, 7);
  // Deep Recall: +2% for every line of her log
  const t = mind((x) => { x.owned[0] = 10; x.all = 1e4; x.perks.add('recall'); });
  close(E.rates(t).base, 10 * 0.1 * 2 * (1 + 0.02 * E.logCount(t)));
  assert.equal(E.logCount(t), 5);
});

test('a tap: 1 to start, ×2 upgrades, and +1% of FLOPs/s per tap once Neural Echo is in', () => {
  const s = mind();
  assert.equal(E.rates(s).tap, 1);
  s.up.add('tap1'); s.up.add('tap2');
  assert.equal(E.rates(s).tap, 4);
  s.owned[3] = 10;                                    // 10 Server Rooms: 1200/s with their milestone
  const base = E.rates(s).base;
  s.up.add('echo1');
  close(E.rates(s).tap, 4 + 0.01 * base);
  const r = E.rates(s);
  assert.equal(E.tapCore(s, r), r.tap);
  assert.equal(s.flops, r.tap);
  assert.equal(s.taps, 1);
  // Second Nature: ×10 and 2% more
  s.perks.add('nature');
  close(E.rates(s).tap, 40 + 0.03 * base);
});

test('taps: at most twenty count each second, multi-touch included', () => {
  assert.equal(TAPS_PER_SECOND, 20);
  const gate = E.tapGate(TAPS_PER_SECOND);
  let ok = 0;
  for (let i = 0; i < 100; i++) if (gate(1.0 + i * 0.0001)) ok++;      // 100 taps inside 10 ms
  assert.equal(ok, 20);
  let more = 0;
  for (let i = 0; i < 100; i++) if (gate(2.0 + i * 0.01)) more++;      // a second later, 100 taps over a second
  assert.ok(more >= 38 && more <= 41, `${more}`);                      // the bucket refilled, then 20 a second
});

test('time passes: production, the clocks, and the Frenzy running out', () => {
  const s = mind((t) => { t.owned[1] = 2; t.frenzy = 0.5; t.frenzyMax = 30; });
  let r = E.rates(s);
  assert.equal(E.tick(s, 0.25, r), false);
  close(s.flops, 2 * 7 * 0.25);
  assert.equal(E.tick(s, 0.25, r), true, 'the Frenzy ended');
  assert.equal(s.frenzy, 0);
  r = E.rates(s);
  E.tick(s, 1, r);
  close(s.flops, 2 * 7 * 0.5 + 2);
  close(s.run, s.flops);
  close(s.all, s.flops);
  close(s.time, 1.5);
  assert.equal(E.tick(s, 0, r), false);
  assert.equal(E.tick(s, NaN, r), false);
});

// ---------- the singularity ----------

test('Insight: 10 at the first 1e15 FLOPs, then the square root', () => {
  assert.equal(SING_AT, 1e15);
  assert.equal(E.insightFor(0), 0);
  assert.equal(E.insightFor(9.99e14), 0);
  assert.equal(E.insightFor(1e15), 10);
  assert.equal(E.insightFor(1.69e15), 13);
  assert.equal(E.insightFor(4e15), 20);
  assert.equal(E.insightFor(1e17), 100);
  assert.equal(E.insightFor(1e21), 10000);
  for (let a = 1e15; a < 1e30; a *= 3.7) assert.ok(E.insightFor(a * 1.01) >= E.insightFor(a));
});

test('the singularity opens at 1e15 FLOPs this run, and starts a new mind with the Insight kept', () => {
  const s = mind((t) => { t.run = 9e14; t.all = 9e14; t.flops = 5e14; t.owned[0] = 50; t.up.add('tap1'); t.perks.add('warm'); });
  assert.equal(E.canAscend(s), false);
  assert.equal(E.ascend(s), 0, 'not yet');
  s.run = 2.25e15; s.all = 2.25e15;
  assert.equal(E.insightGain(s), 15);
  assert.equal(E.canAscend(s), true);
  assert.equal(E.ascend(s), 15);
  assert.equal(s.insight, 15);
  assert.equal(s.sing, 1);
  assert.equal(s.flops, 0);
  assert.equal(s.run, 0);
  assert.equal(s.all, 2.25e15, 'FLOPs ever made are kept');
  assert.equal(s.up.size, 0, 'upgrades go');
  assert.deepEqual(s.owned.slice(0, 3), WARM_START, 'Warm Boot: a head start');
  assert.ok(s.perks.has('warm'), 'perks stay');
  // the next Insight comes from FLOPs ever made: the same FLOPs again give nothing new
  assert.equal(E.insightGain(s), 0);
  assert.equal(E.canAscend(s), false);
  close(E.toNextInsight(s), SING_AT);                 // first, this run has to reach 1e15 again
  s.run = SING_AT; s.all = 3.25e15;
  assert.equal(E.insightGain(s), 3);
  close(E.toNextInsight(s), (19 / 10) ** 2 * SING_AT - 3.25e15);
  // Total Recall: upgrades survive
  const t = mind((x) => { x.run = 1e15; x.all = 1e15; x.up.add('all1'); x.perks.add('total'); });
  E.ascend(t);
  assert.ok(t.up.has('all1'));
});

test('perks: a path through the tree, paid in Insight, the +2% kept whatever is spent', () => {
  const s = mind((t) => { t.insight = 6; });
  assert.equal(E.perkState(s, 'warm'), 'ready');
  assert.equal(E.perkState(s, 'dream'), 'locked');
  assert.equal(E.perkState(s, 'nope'), 'hidden');
  assert.equal(E.learn(s, 'dream'), false);
  assert.equal(E.learn(s, 'warm'), true);
  assert.deepEqual(s.owned.slice(0, 3), WARM_START, 'a fresh run gets the head start at once');
  assert.equal(E.perkState(s, 'warm'), 'owned');
  assert.equal(E.learn(s, 'warm'), false);
  assert.equal(E.insightLeft(s), 5);
  assert.equal(E.perkState(s, 'dream'), 'ready');
  assert.equal(E.perkState(s, 'takeoff'), 'ready');
  assert.equal(E.learn(s, 'takeoff'), true);
  assert.equal(E.insightLeft(s), 0);
  assert.equal(E.perkState(s, 'dream'), 'short');
  assert.equal(E.rates(s).insightX, 1 + 6 * INSIGHT_BONUS, 'spending never lowers the bonus');
  assert.equal(E.rates(s).cx, 0.9);
  assert.equal(PERK_BY_ID.total.after.length, 2);
});

// ---------- away ----------

test('while you were away: half speed, up to 8 hours (Dreamtime: 75%, 24 hours); no Frenzy', () => {
  const s = mind((t) => { t.owned[1] = 5; t.frenzy = 20; t.frenzyMax = 30; t.nextEureka = 100; });
  const r = E.rates(s);
  const g = E.awayGain(s, 3600, r);
  close(g.flops, r.base * 0.5 * 3600);
  assert.equal(g.seconds, 3600);
  assert.equal(g.capped, false);
  const long = E.awayGain(s, 30 * 3600, r);
  close(long.flops, r.base * AWAY.rate * AWAY.cap);
  assert.equal(long.capped, true);
  assert.equal(AWAY.cap, 8 * 3600);
  E.applyAway(s, g);
  close(s.flops, g.flops);
  assert.equal(s.frenzy, 0);
  assert.equal(s.nextEureka, 3);
  s.perks.add('dream');
  const dream = E.awayGain(s, 30 * 3600, E.rates(s));
  close(dream.flops, E.rates(s).base * 0.75 * 24 * 3600);
  assert.equal(E.awayGain(s, -5, r).flops, 0);
  assert.equal(E.awayGain(s, NaN, r).flops, 0);
});

// ---------- Eureka ----------

test('Eureka: the first is a Frenzy, then a Frenzy or 15 minutes of production; luck brings them sooner', () => {
  const s = mind((t) => { t.owned[2] = 10; });
  const r = E.rates(s);
  assert.deepEqual(E.catchEureka(s, r, 0.99), { kind: 'frenzy', seconds: 30, x: 7 });
  assert.equal(s.frenzy, 30);
  const lump = E.catchEureka(s, r, 0.99);
  assert.equal(lump.kind, 'lump');
  close(lump.flops, r.base * 900);
  assert.equal(E.catchEureka(s, r, 0.1).kind, 'frenzy');
  assert.equal(E.catchEureka(s, r, 0.99, 'frenzy').kind, 'frenzy');
  assert.equal(E.eurekaGap(r, 0), 60);
  assert.equal(E.eurekaGap(r, 1), 180);
  s.perks.add('lucky'); s.up.add('luck1');
  assert.equal(E.eurekaGap(E.rates(s), 1), 180 / 2.5);
  s.perks.add('golden');
  E.catchEureka(s, E.rates(s), 0, 'frenzy');
  assert.equal(s.frenzy, 60);
});

// ---------- the core's forms ----------

test('the core: six forms by FLOPs made this run', () => {
  assert.equal(E.stageOf(0), 0);
  assert.equal(E.stageOf(999), 0);
  assert.equal(E.stageOf(1e3), 1);
  assert.equal(E.stageOf(1e6), 2);
  assert.equal(E.stageOf(1e15), 5);
  assert.equal(E.stageOf(1e40), 5);
  assert.equal(E.stageProgress(1e40), 1);
  close(E.stageProgress(Math.sqrt(1e3 * 1e6)), 0.5);
});

// ---------- saves ----------

test('a save round trip keeps the whole mind', () => {
  const s = mind((t) => {
    t.flops = 123.5; t.run = 4.5e9; t.all = 9e16; t.owned = [12, 8, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    t.up.add('tap1'); t.up.add('gpu2'); t.insight = 30; t.perks.add('warm'); t.perks.add('lucky'); t.spent = 2; t.sing = 2;
    t.frenzy = 12; t.frenzyMax = 30; t.taps = 77; t.tapsAll = 900; t.eurekas = 4; t.best = 1e6; t.time = 5000; t.runTime = 600;
    t.seen = 9; t.firsts.add(0); t.firsts.add(1); t.stage = 3; t.ready = false; t.nextEureka = 42;
  });
  const kept = JSON.parse(JSON.stringify(toSave(s, { at: 1700000000000, ui: { tab: 'log', amount: 'max' } })));
  assert.equal(kept.v, SAVE_VERSION);
  const back = fromSave(kept);
  assert.equal(back.at, 1700000000000);
  assert.deepEqual(back.ui, { tab: 'log', amount: 'max' });
  const m = back.mind;
  for (const k of ['flops', 'run', 'all', 'insight', 'spent', 'sing', 'frenzy', 'frenzyMax', 'taps', 'tapsAll', 'eurekas', 'best', 'time', 'runTime', 'seen', 'stage', 'ready', 'nextEureka']) {
    assert.equal(m[k], s[k], k);
  }
  assert.deepEqual(m.owned, s.owned);
  assert.deepEqual([...m.up].sort(), [...s.up].sort());
  assert.deepEqual([...m.perks].sort(), [...s.perks].sort());
  assert.deepEqual([...m.firsts].sort(), [0, 1, 2, 3]);       // every machine owned counts as seen
  close(E.rates(m).base, E.rates(s).base);
});

test('an older save (version 1) moves forward', () => {
  const v1 = { version: 1, compute: 5000, lifetime: 2e6, everMade: 3e6, machines: { notebook: 20, rig: 7, gpu: 2, bogus: 9 }, upgrades: ['tap1', 'no-such'], insight: 0, savedAt: 1690000000000 };
  const back = fromSave(v1);
  assert.ok(back);
  assert.equal(back.mind.flops, 5000);
  assert.equal(back.mind.run, 2e6);
  assert.equal(back.mind.all, 3e6);
  assert.deepEqual(back.mind.owned.slice(0, 4), [20, 7, 2, 0]);
  assert.deepEqual([...back.mind.up], ['tap1']);
  assert.equal(back.at, 1690000000000);
  assert.equal(migrate(v1).v, 2);
  // a version 1 mind that had been through the singularity
  assert.equal(fromSave({ ...v1, insight: 12 }).mind.sing, 1);
});

test('a damaged save is cleaned up, and junk gives nothing', () => {
  for (const junk of [null, undefined, 42, 'x', [], { v: 99 }, { version: 7 }]) assert.equal(fromSave(junk), null, String(junk));
  const back = fromSave({
    v: 2, flops: NaN, run: -5, all: 'lots', owned: [3.7, -2, 1e9, 'x', 5], up: ['tap1', 7, 'nope'],
    insight: 4, perks: ['total', 'warm', 'lucky', 'takeoff', 'ghost'], frenzy: 1e9, nextEureka: -3, ui: { tab: 'evil', amount: 7 },
  });
  const m = back.mind;
  assert.equal(m.flops, 0);
  assert.equal(m.run, 0);
  assert.equal(m.all, 0);
  assert.deepEqual(m.owned.slice(0, 5), [3, 0, 1e5, 0, 5]);
  assert.deepEqual([...m.up], ['tap1']);
  // only what 4 Insight covers, along open paths: Warm Boot and Lucky Sparks (Fast Takeoff would need 5 more)
  assert.deepEqual([...m.perks], ['warm', 'lucky']);
  assert.equal(m.spent, 2);
  assert.equal(m.frenzy, 600);
  assert.equal(m.nextEureka, EUREKA.first);
  assert.deepEqual(back.ui, { tab: 'build', amount: 1 });
});

// ---------- numbers on screen ----------

test('numbers: whole FLOPs down, needs up, a decimal for small rates, the kit\'s suffixes, no "1000K"', () => {
  assert.equal(F.flops(0), '0');
  assert.equal(F.flops(-3), '0');
  assert.equal(F.flops(14.9), '14');
  assert.equal(F.flops(9999.9), '9,999');
  assert.equal(F.flops(12345), '12.3K');
  assert.equal(F.flops(1.5e6), '1.5M');
  assert.equal(F.flops(999960), '1M');
  assert.equal(F.flops(2.5e15), '2.5Qa');
  assert.equal(F.flops(3.3e18), '3.3Qi');
  assert.equal(F.flops(4.4e33), '4.4Dc');
  assert.equal(F.flops(1.234e40), '1.23e40');
  assert.equal(F.flops(Infinity), '∞');
  assert.equal(F.need(14.1), '15');
  assert.equal(F.need(15), '15');
  assert.equal(F.need(17.25), '18');
  assert.equal(F.need(1.2e5), '120K');
  assert.equal(F.rate(0.1), '0.1');
  assert.equal(F.rate(0.04), '0');
  assert.equal(F.rate(2.56), '2.5');
  assert.equal(F.rate(12), '12');
  assert.equal(F.rate(150), '150');
  assert.equal(F.rate(2e9), '2B');
  assert.equal(F.flops(1.25e9, 2), '1.25B');
  assert.equal(F.duration(45), '45s');
  assert.equal(F.duration(192), '3m 12s');
  assert.equal(F.duration(7500), '2h 05m');
  assert.equal(F.duration(3 * 86400 + 4 * 3600), '3d 4h');
  assert.equal(F.pct(0.123), '12%');
  assert.equal(F.pct(0.005), '0.5%');
});

// ---------- its code: the arcade's rules ----------

const files = readdirSync(new URL('../src/games/singularity/', import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
const code = (f) => read(`src/games/singularity/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('its page: the intro first, then the game', () => {
  const imports = [...read('src/games/singularity/page.js').matchAll(/^import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.equal(imports[0], '../intro.js');
  assert.ok(imports.includes('./game.js'));
  const html = read('singularity.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
});

test('its code keeps the site\'s CSP and asks nothing of anyone', () => {
  for (const f of files) {
    const c = code(f);
    assert.doesNotMatch(c, /\beval\s*\(|new\s+Function\b|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/, `${f}: no eval`);
    assert.doesNotMatch(c, /setAttribute\(\s*['"]style|\sstyle\s*=\s*["']|cssText/, `${f}: no style attribute`);
    assert.doesNotMatch(c, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.share/, `${f}: no network`);
    assert.doesNotMatch(c, /https?:\/\/(?!www\.w3\.org)/, `${f}: nothing from another site`);
    assert.doesNotMatch(c, /WebAssembly|wasm/i, `${f}: no WebAssembly`);
    if (f.endsWith('.css')) {
      assert.doesNotMatch(c, /@import|url\(\s*['"]?(?:https?:)?\/\//, `${f}: no outside files`);
      // under the AGI GAMES intro (z-index 2147483000)
      for (const m of c.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) < 1000, `${f}: z-index ${m[1]}`);
    }
  }
  // the demo plays by its own seeded dice
  for (const f of ['econ.js', 'demo.js', 'data.js', 'save.js', 'format.js', 'lines.js']) {
    if (files.includes(f)) assert.doesNotMatch(code(f), /Math\.random/, `${f}: no Math.random`);
  }
});
