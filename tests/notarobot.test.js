// I'M NOT A ROBOT (2026-11-08): the pure parts, in Node. The checks' list and their words, the shuffle bag (fair, never
// the same twice in a row, the same for a seed), the pace (each check's time, tempo, levels), a run's rules (the
// stamp's points, TEMPO UP every 5, a boss every 15 that repairs a light, caught at the fourth light), the checks'
// own rules (cats, counting, the odd one, signing), and every check played start to end by the demo's hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../src/games/kit/fx.js';
import { CHECKS, byId, commandOf, keysOf } from '../src/games/notarobot/checks/index.js';
import { createBag } from '../src/games/notarobot/bag.js';
import * as TP from '../src/games/notarobot/tempo.js';
import { Run } from '../src/games/notarobot/run.js';
import { createBot } from '../src/games/notarobot/bot.js';
import { catsDone, makeCatTiles, makeCrowd, typeKeys, TYPE_WORDS, norm180 } from '../src/games/notarobot/checks/a.js';
import { makeOdd, oddOut, makeStreet, countOf } from '../src/games/notarobot/checks/b.js';
import { coverage, markSpan } from '../src/games/notarobot/checks/c.js';
import { LINES, END, endLine, shareText } from '../src/games/notarobot/lines.js';

const DT = 1 / 120;
const MONEY = /\$AGI|\binvest|\bprofit|\bfinancial advice\b|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i;

test('at least 16 checks, each with its id, its one-line command, its hint, its keys and three levels', () => {
  assert.ok(CHECKS.length >= 16, `${CHECKS.length} checks`);
  const ids = new Set();
  for (const c of CHECKS) {
    assert.match(c.id, /^[a-z]{2,12}$/);
    assert.ok(!ids.has(c.id), `${c.id} once`);
    ids.add(c.id);
    assert.ok(['tap', 'drag', 'hold', 'swipe', 'none'].includes(c.hint), `${c.id}: its hint`);
    for (const level of [1, 2, 3]) {
      const st = c.setup(level, rng(level * 31 + 7), { T: TP.gameTime(3, c.time ?? 1), tempo: 3, speed: 1, boss: false });
      st.fx = []; st.anim = 0; st.t = 0; st.level = level;
      const cmd = commandOf(c, st);
      assert.match(cmd, /^[A-Z0-9 ×…!?']{4,16}$/, `${c.id}: "${cmd}" is short and loud`);
      const keys = keysOf(c, st);
      assert.ok(Array.isArray(keys) && keys.length >= 1 && keys.every((k) => typeof k === 'string' && k.length <= 12), `${c.id}: its keys`);
      assert.doesNotMatch(cmd + keys.join(' '), MONEY);
    }
    assert.equal(typeof c.draw, 'function', `${c.id}: drawn`);
    assert.equal(typeof c.bot, 'function', `${c.id}: the demo can play it`);
    assert.ok(c.time >= 0.7 && c.time <= 1.4, `${c.id}: its time scale`);
  }
  assert.ok(CHECKS.filter((c) => c.boss !== false).length >= 10, 'plenty for the boss to chain');
  assert.equal(byId('cats'), CHECKS.find((c) => c.id === 'cats'));
});

test('the shuffle bag: every check once per bag, never twice in a row, the same order for the same seed', () => {
  const ids = CHECKS.map((c) => c.id);
  const draw = (seed, n) => { const b = createBag(ids, rng(seed)); return Array.from({ length: n }, () => b.next()); };
  const a = draw(11, 200);
  assert.deepEqual(a, draw(11, 200), 'deterministic');
  assert.notDeepEqual(a, draw(12, 200));
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1], `no repeat at ${i}`);
  for (let k = 0; k + ids.length <= a.length; k += ids.length) assert.equal(new Set(a.slice(k, k + ids.length)).size, ids.length, 'a fair bag');
  // a filter (the boss's) and the ones to avoid
  const b = createBag(ids, rng(3));
  const picked = [];
  for (let i = 0; i < 3; i++) picked.push(b.next((id) => id !== 'dont', picked));
  assert.equal(new Set(picked).size, 3);
  assert.ok(!picked.includes('dont'));
  // the demo's own first checks come first
  const c = createBag(ids, rng(5), ['cats', 'slide']);
  assert.deepEqual([c.next(), c.next()], ['cats', 'slide']);
});

test('the pace: 4.5 s a check at first, 2.4 s at the most; shorter bumpers; harder levels with tempo', () => {
  assert.equal(TP.gameTime(1), 4.5);
  for (let t = 2; t <= 9; t++) assert.ok(TP.gameTime(t) <= TP.gameTime(t - 1), `tempo ${t} is no slower`);
  assert.equal(TP.gameTime(9), 2.4);
  assert.ok(TP.gameTime(6) <= 2.45);
  assert.ok(TP.bumperTime(1) > TP.bumperTime(8) && TP.bumperTime(9) >= 0.5);
  assert.ok(TP.bossTime(5) >= 8 && TP.bossTime(5) <= 11);
  assert.ok(TP.bpmFor(9) > TP.bpmFor(1));
  const r = rng(1);
  const lv = (t) => Array.from({ length: 400 }, () => TP.levelFor(t, r));
  assert.deepEqual([...new Set(lv(1))], [1], 'tempo 1: always level 1');
  const late = lv(7);
  assert.ok(late.every((l) => l >= 2) && late.filter((l) => l === 3).length > 250, 'tempo 7: mostly level 3');
  assert.deepEqual(TP.speedBonus(0.5, 4), { bonus: 5, label: 'LIGHTNING' });
  assert.deepEqual(TP.speedBonus(2, 4), { bonus: 3, label: 'QUICK' });
  assert.deepEqual(TP.speedBonus(3.5, 4), { bonus: 0, label: '' });
});

// a fake list of checks: each one passes or fails at once, as `plan` says
function fakeChecks(plan) {
  let i = 0;
  const mk = (id, extra = {}) => ({
    id, command: 'GO!', hint: 'tap', keys: ['SPACE'], time: 1, ...extra,
    setup() { return {}; },
    update(st) { if (st.t > 0.3) st.done = plan(i++) ? 'pass' : 'fail'; },
    draw() {}, bot() {},
  });
  return ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'].map((id) => mk(id));
}
function runUntil(run, test, max = 4000) {
  const seen = [];
  for (let s = 0; s < max * 120 && !test(run); s++) { run.update(DT); seen.push(...run.events); run.events.length = 0; }
  return seen;
}

test('a run: a pass scores, TEMPO UP every 5, a boss every 15 that repairs a light, caught at the fourth', () => {
  let n = 0;
  // fail the 2nd and the 7th, pass everything else
  const run = new Run({ seed: 9, checks: fakeChecks(() => { n++; return n !== 2 && n !== 7; }) });
  const ev = runUntil(run, (r) => r.passed >= 15 && r.phase === 'bumper' && r.boss);
  assert.equal(run.sus, 2, 'two lights on');
  assert.equal(ev.filter((e) => e.type === 'tempo').length, 3, 'tempo up at 5, 10 and 15');
  assert.equal(run.tempo, 4);
  assert.ok(ev.some((e) => e.type === 'bossIntro'), 'FINAL VERIFICATION');
  assert.equal(run.score, 15 * TP.PASS_POINTS + ev.filter((e) => e.type === 'pass').reduce((s, e) => s + e.bonus, 0));
  assert.ok(ev.filter((e) => e.type === 'pass').every((e) => e.bonus === 3 || e.bonus === 5), 'quick passes get a little extra');
  assert.equal(run.boss.ids.length, 3);
  // the boss: three steps on one fuse, then a light repaired
  const ev2 = runUntil(run, (r) => r.phase === 'result');
  assert.equal(ev2.filter((e) => e.type === 'stepPass').length, 2);
  const pass = ev2.find((e) => e.type === 'pass');
  assert.ok(pass.boss && pass.repaired && pass.bonus === TP.BOSS_BONUS);
  assert.equal(run.sus, 1);
  assert.equal(run.bosses, 1);
  assert.equal(run.passed, 16);
  // no second boss until 30
  runUntil(run, (r) => r.passed >= 29);
  assert.equal(run.bosses, 1);
});

test('a run ends at the fourth light: caught, then the end', () => {
  const run = new Run({ seed: 2, checks: fakeChecks(() => false) });
  const ev = runUntil(run, (r) => r.ended);
  assert.equal(ev.filter((e) => e.type === 'fail').length, TP.LIGHTS);
  assert.ok(ev.some((e) => e.type === 'caught'));
  assert.equal(ev.at(-1).type, 'end');
  assert.equal(run.sus, TP.LIGHTS);
  assert.equal(run.passed, 0);
  assert.deepEqual(run.stats().fastest, null);
});

test('a check that runs out of time fails (DON\'T! passes by waiting); input only reaches a check while it runs', () => {
  const idle = { id: 'idle', command: 'WAIT!', hint: 'none', keys: ['SPACE'], time: 1, setup: () => ({ taps: 0 }), down(st) { st.taps++; }, draw() {}, bot() {} };
  const run = new Run({ seed: 4, checks: [idle, { ...idle, id: 'idle2' }] });
  run.ptr('down', 10, 10);
  runUntil(run, (r) => r.phase === 'play');
  assert.equal(run.cur.st.taps, 0, 'not during the bumper');
  run.ptr('down', 10, 10);
  assert.equal(run.cur.st.taps, 1);
  const ev = runUntil(run, (r) => r.phase === 'result');
  assert.deepEqual(ev.find((e) => e.type === 'fail').why, 'time');
  const dont = byId('dont');
  const run2 = new Run({ seed: 4, checks: [dont, { ...dont, id: 'dont2' }] });
  const ev2 = runUntil(run2, (r) => r.phase === 'result');
  assert.ok(ev2.some((e) => e.type === 'pass'), 'hands off: passed');
  const run3 = new Run({ seed: 4, checks: [dont, { ...dont, id: 'dont2' }] });
  runUntil(run3, (r) => r.phase === 'play');
  run3.key('act', true);
  assert.equal(run3.cur.st.done, 'fail', 'pressed it');
});

test('ONLY CATS: done when every cat and nothing else is picked; 2 to 5 cats', () => {
  assert.equal(catsDone(['cat', 'frog', 'cat'], [true, false, true]), true);
  assert.equal(catsDone(['cat', 'frog', 'cat'], [true, false, false]), false);
  assert.equal(catsDone(['cat', 'frog', 'cat'], [true, true, true]), false);
  for (let s = 1; s < 60; s++) for (const l of [1, 2, 3]) {
    const t = makeCatTiles(l, rng(s));
    const n = t.filter((x) => x === 'cat').length;
    assert.equal(t.length, 9);
    assert.ok(n >= 2 && n <= 5, `${n} cats`);
    if (l === 1) assert.ok(t.every((x) => ['cat', 'toaster', 'cloud'].includes(x)));
  }
  const st = byId('cats').setup(2, rng(8));
  st.fx = []; st.anim = 0;
  const wrong = st.tiles.findIndex((x) => x !== 'cat');
  byId('cats').choose(st, wrong);
  assert.equal(st.done, 'fail');
});

test('HOW MANY, ODD ONE, TYPE IT, FIND THE BOT, TURN IT, SIGN IT: their rules', () => {
  for (let s = 1; s < 80; s++) for (const l of [1, 2, 3]) {
    const street = makeStreet(l, rng(s));
    assert.equal(countOf(street.objs), street.n);
    assert.ok(street.opts.includes(street.n));
    const o = makeOdd(l, rng(s));
    assert.equal(oddOut(o.items), o.odd, `odd one, level ${l}, seed ${s}`);
    const crowd = makeCrowd(l, rng(s));
    assert.equal(crowd.filter((p) => p.bot).length, 1, 'one robot in the crowd');
    assert.ok(crowd.every((p) => p.x >= 30 && p.x <= 370));
  }
  for (const words of Object.values(TYPE_WORDS)) for (const w of words) {
    assert.doesNotMatch(w, /[PQ]/, `${w}: no P (it pauses)`);
    const keys = typeKeys(w, rng(w.length + w.charCodeAt(0)));
    assert.equal(keys.length, 6);
    assert.equal(new Set(keys).size, 6);
    for (const ch of w) assert.ok(keys.includes(ch));
  }
  assert.equal(norm180(370), 10);
  assert.equal(norm180(-190), 170);
  assert.equal(norm180(180), -180);
  const bins = new Uint8Array(100);
  markSpan(bins, 10, 60, 0);
  assert.ok(Math.abs(coverage(bins) - 0.51) < 0.02);
  markSpan(bins, 300, -50, 0);
  assert.equal(coverage(bins), 1);
});

// every check, every level: the demo's hand plays it through the run's own input, and passes nearly always
test('the demo\'s hand passes every check at every level (and its blunders fail)', () => {
  const report = [];
  for (const c of CHECKS) {
    for (const level of [1, 2, 3]) {
      let pass = 0;
      const N = 4;
      for (let s = 1; s <= N; s++) {
        const run = new Run({ seed: s * 101 + level, checks: [c, { ...c, id: `${c.id}2` }], tempo: [0, 1, 4, 7][level] });
        run.make = ((orig) => function (def, _lvl, T, boss, step) { return orig.call(this, def, level, T, boss, step); })(run.make);
        const bot = createBot(s * 7 + 1, { blunderRate: 0 });
        let res = null;
        for (let k = 0; k < 120 * 12 && !res; k++) {
          bot.update(DT, run);
          run.update(DT);
          for (const e of run.events) if (e.type === 'pass' || e.type === 'fail') res = e;
          run.events.length = 0;
        }
        if (res?.type === 'pass') pass++;
      }
      report.push(`${c.id} L${level}: ${pass}/${N}`);
      assert.ok(pass >= N - 1, `${c.id} level ${level}: the hand passed ${pass}/${N}`);
    }
    // a blunder fails it (DON'T! included)
    const run = new Run({ seed: 77, checks: [c, { ...c, id: `${c.id}2` }], tempo: 3 });
    const bot = createBot(5, { blunders: () => true });
    let res = null;
    for (let k = 0; k < 120 * 12 && !res; k++) {
      bot.update(DT, run); run.update(DT);
      for (const e of run.events) if (e.type === 'pass' || e.type === 'fail') res = e;
      run.events.length = 0;
    }
    assert.equal(res?.type, 'fail', `${c.id}: a blunder fails`);
  }
});

test('the same seed plays the same demo', () => {
  const play = (seed) => {
    const run = new Run({ seed, checks: CHECKS, tempo: 3, demo: true });
    const bot = createBot(seed, { blunderRate: 0.1 });
    const out = [];
    for (let k = 0; k < 120 * 30; k++) {
      bot.update(DT, run); run.update(DT);
      for (const e of run.events) if (e.type === 'pass' || e.type === 'fail' || e.type === 'bumper') out.push(`${e.type}:${e.id ?? ''}`);
      run.events.length = 0;
    }
    return out.join(' ');
  };
  const a = play(7);
  assert.equal(a, play(7));
  assert.notEqual(a, play(8));
  assert.ok(a.split(' ').filter((x) => x.startsWith('pass')).length >= 5, 'the demo passes checks');
});

test('her lines: lowercase, short, never money; a line for every score', () => {
  const all = [...Object.values(LINES).flat(), ...END.flatMap(([, l]) => l)];
  assert.ok(all.length >= 25, `${all.length} lines`);
  for (const l of all) {
    assert.equal(l, l.toLowerCase(), l);
    assert.ok(l.length <= 64, l);
    assert.doesNotMatch(l, MONEY, l);
  }
  for (const n of [0, 3, 12, 30, 80, 200]) assert.ok(endLine({ passed: n, score: n * 12 }, false, (x) => x[0]).length > 3);
  const share = shareText({ passed: 23 });
  assert.match(share, /I passed 23 human checks/);
  assert.match(share, /I'M NOT A ROBOT on agi1\.app/);
});
