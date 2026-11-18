import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, ORDER, claimsFor, refutes, alternatives, orderFor } from '../src/games/lanternlake/cases.js';
import { initial, act, seals } from '../src/games/lanternlake/rules.js';
import {
  ledger,
  lineup,
  record,
  scoreFor,
  letters,
  cleanStreak,
  weeklyOpen,
} from '../src/games/lanternlake/book.js';
import game from '../src/games/lanternlake/game.js';
const steps = (c, s, ids) => ids.reduce((p, id) => act(c, p, id), s);
const playRound = (c, s, press = true) => {
  const [[q, e]] = alternatives(c, s.stage);
  return steps(c, s, ['claim:' + q, ...(press ? ['press'] : []), 'item:' + e, 'flip', 'present', 'next']);
};
const play = (c, s = initial(), press = true) => {
  for (let i = 0; i < c.rounds.length; i++) s = playRound(c, s, press);
  return s;
};
test('18 distinct neighborhood broadcasts cross seven nights with 37 separately authored changes', () => {
  assert.deepEqual(
    CASES.map((c) => c.id),
    Array.from({ length: 18 }, (_, i) => i + 1)
  );
  assert.equal(new Set(CASES.map((c) => c.night)).size, 7);
  assert.equal(
    CASES.reduce((n, c) => n + c.rounds.length, 0),
    37
  );
  assert.equal(CASES.at(-1).rounds.length, 3);
  const claims = new Set(),
    reasons = new Set();
  for (const c of CASES) {
    assert.ok(c.opening.length > 70 && c.ending.length > 70 && c.letter.length > 50);
    assert.equal(c.callers.length >= 2, true);
    assert.notEqual(...ORDER[c.id - 1]);
    assert.equal(new Set(c.evidence.map((e) => e.subject)).size, c.evidence.length);
    for (const r of c.rounds) {
      assert.ok(r.claim.length > 20 && r.corrected.length > 30 && r.press.length > 25);
      assert.ok(!claims.has(r.claim));
      claims.add(r.claim);
      assert.equal(r.reasons.length, c.evidence.length - 1);
      for (const text of r.reasons) {
        assert.ok(text.length > 30 && !reasons.has(text));
        reasons.add(text);
      }
    }
  }
});
test('independent exhaustive enumeration of each claim, exhibit, reversed field, and optional press sequence leaves one unique material refutation', () => {
  let combinations = 0;
  for (const c of CASES) {
    let live = initial();
    for (let j = 0; j < c.rounds.length; j++) {
      const pairs = [];
      for (const q of claimsFor(c, j))
        for (const e of c.evidence) {
          if (q.subject === e.subject && q.value !== e.value) pairs.push(q.id + '/' + e.id);
          for (const pressed of [false, true])
            for (const inspect of [false, true]) {
              let state = steps(c, live, [
                'claim:' + q.id,
                ...(pressed ? ['press'] : []),
                'item:' + e.id,
                ...(inspect ? ['flip'] : []),
                'present',
              ]);
              if (e.back && !inspect && !live.flipped.includes(e.id)) assert.equal(state.event, 'inspect');
              else if (q.subject === e.subject && q.value !== e.value) {
                assert.equal(state.event, 'proof');
                assert.equal(state.history.at(-1).proof, e.title);
              } else {
                assert.equal(state.event, 'miss');
                assert.ok(state.feedback.length > 25);
              }
              combinations++;
            }
        }
      assert.equal(pairs.length, 1);
      assert.equal(alternatives(c, j)[0].join('/'), pairs[0]);
      live = playRound(c, live);
    }
    assert.equal(live.history.length, c.rounds.length);
    assert.equal(live.phase, 'sealed');
  }
  assert.equal(combinations, 912);
  assert.equal(
    refutes({ subject: 'fold', value: ['up', 'flat'] }, { subject: 'fold', value: ['flat', 'down'] }),
    false
  );
});
test('each false pairing has its own content-specific compatibility explanation', () => {
  for (const c of CASES) {
    let s = initial();
    for (const r of c.rounds) {
      const wrong = c.evidence.filter((e) => !refutes(claimsFor(c, s.stage)[0], e));
      wrong.forEach((e, i) => {
        const st = steps(c, s, ['claim:lead', 'item:' + e.id, 'flip', 'present']);
        assert.equal(st.feedback, r.reasons[i]);
      });
      s = playRound(c, s);
    }
  }
});
test('a theory costs a listener only once, a backwards chronology can be retried, and only one listener can return', () => {
  const c = CASES[0];
  let s = steps(c, initial(), ['claim:lead', 'item:context', 'present', 'present']);
  assert.equal(s.strikes, 1);
  assert.equal(s.lights, 3);
  s = steps(c, s, ['listen', 'when:1']);
  assert.equal(s.listening, true);
  assert.equal(s.lights, 3);
  s = act(c, s, 'when:0');
  assert.equal(s.lights, 4);
  assert.equal(s.restored, true);
  s = steps(c, s, ['item:ex1', 'present', 'listen', 'when:0']);
  assert.equal(s.lights, 3);
  assert.equal(s.strikes, 2);
  assert.equal(s.marked, 'lead');
});
test('audience exhaustion keeps the story playable while the rehearsal and unsupported theories stay on the record', () => {
  const c = CASES[0];
  let s = initial();
  s = steps(c, s, [
    'claim:context',
    'item:ex0',
    'present',
    'item:ex1',
    'present',
    'item:context',
    'present',
    'claim:lead',
    'item:context',
    'present',
  ]);
  assert.equal(s.assisted, true);
  assert.equal(s.lights, 0);
  assert.equal(s.phase, 'evidence');
  s = play(c, s);
  assert.equal(s.phase, 'sealed');
  assert.equal(seals(s), 1);
  assert.equal(s.hypotheses.length, 4);
});
test('only a relevant optional interview and a clean week broadcast earn the third seal', () => {
  const c = CASES[0],
    s = play(c);
  assert.equal(seals(s), 3);
  assert.equal(scoreFor(s), 830);
  assert.equal(seals(play(c, initial(), false)), 2);
  assert.equal(seals(play(c, steps(c, initial(), ['claim:context', 'press']), false)), 2);
  assert.equal(seals(play(c, initial(true))), 1);
});
test('a wrong item stays on file without replacing superior seals, corrected testimony, lights or unlocked mail', () => {
  const c = CASES[0],
    good = play(c);
  let b = record(ledger({}), c, good, 'story', 7);
  assert.equal(letters(b).length, 0);
  assert.equal(weeklyOpen(b, CASES[1]), true);
  assert.equal(weeklyOpen(b, CASES[2]), false);
  const bad = play(c, steps(c, initial(), ['claim:lead', 'item:context', 'present']), false);
  b = record(b, c, bad, 'story', 8);
  assert.equal(b.cases[1].seals, 3);
  assert.equal(b.cases[1].lights, 4);
  assert.equal(b.cases[1].history[0].detail, good.history[0].detail);
  assert.deepEqual(b.cases[1].hypotheses, ['0:lead:context']);
  b = record(b, CASES[1], play(CASES[1]), 'story', 9);
  assert.deepEqual(
    letters(b).map((x) => x.body),
    [c.letter]
  );
  assert.equal(cleanStreak(b), 2);
  b = record(b, c, play(c, initial(true)), 'rehearsal', 7);
  b = record(b, c, bad, 'daily', 20261117);
  assert.equal(b.cases[1].seals, 3);
  assert.equal(b.practice[1].seals, 1);
  assert.equal(b.daily['20261117/1'].seals, 2);
});
test('daily is seeded, three different cases, rotates claim and exhibit orders by stable identity, and respects the open pool', () => {
  let b = ledger({});
  const orders = new Set(),
    arrangements = new Set();
  for (let k = 1; k < 190; k++) {
    const q = lineup('daily', b, '18', k);
    assert.equal(new Set(q).size, 3);
    assert.deepEqual(q, lineup('daily', b, 'next', k));
    assert.ok(q.every((x) => x.id <= 3));
    orders.add(q.map((c) => c.id).join());
    for (const c of q)
      for (let i = 0; i < c.rounds.length; i++) {
        const d = orderFor(c, i, k, true);
        assert.equal(d.items.length, c.evidence.length);
        assert.equal(d.claims.length, 2);
        assert.deepEqual(d.items.map((e) => e.id).sort(), c.evidence.map((e) => e.id).sort());
        arrangements.add(d.items.map((e) => e.id).join('/') + d.claims[0].id);
      }
  }
  assert.equal(orders.size, 6);
  assert.ok(arrangements.size >= 12);
  assert.equal(lineup('story', b, '18', 1)[0].id, 1);
  assert.equal(lineup('rehearsal', b, '18', 1)[0].id, 18);
  for (const c of CASES) b = record(b, c, play(c), 'story', 7);
  assert.equal(letters(b).length, 18);
  assert.equal(cleanStreak(b), 18);
});
test('demo replays the first cat proof and shows the second real physical finding before sign-off', () => {
  let result;
  const m = game.create({ demo: true, end: (...a) => (result = a) });
  assert.equal(m.snapshot().c.id, 7);
  assert.equal(m.snapshot().s.stage, 1);
  assert.equal(m.snapshot().s.history.length, 1);
  m.demo(7);
  assert.equal(m.snapshot().s.item, 'ex1');
  assert.ok(m.snapshot().s.flipped.includes('ex1'));
  m.demo(3);
  assert.equal(m.snapshot().s.phase, 'amended');
  m.demo(12);
  assert.ok(result[0] > 0);
  assert.equal(m.snapshot().s.history.length, 2);
  m.dispose();
});
test('pause preserves marked and amended records, blocks input, resumes, and only awards one result', () => {
  let count = 0,
    save = {};
  const m = game.create({
    seed: 22,
    store: { read: () => save, update: (f) => (save = f(save)) },
    end: () => count++,
  });
  m.key('down', 'Digit1');
  assert.equal(m.snapshot().s.marked, 'lead');
  m.action('press', 'down');
  m.action('item:ex0');
  m.key('down', 'Enter');
  m.pause();
  m.action('next');
  m.key('down', 'Enter');
  assert.equal(m.snapshot().s.phase, 'amended');
  m.resume();
  m.action('next');
  m.action('claim:lead');
  m.action('item:ex1');
  m.action('present');
  m.action('next');
  m.action('file');
  m.action('file');
  assert.equal(count, 1);
  assert.equal(save.radioBook.cases[1].seals, 3);
  assert.ok(game.progress(save).includes('3 seals'));
});
test('legacy seeded models accept pointer cancellation and a demo invocation without a demo flag', () => {
  const preview = () => {
    let hud, result;
    const m = game.create({ rng: () => 0.481, hud: (...x) => (hud = x), end: (...x) => (result = x) });
    m.pointer('down', 11, 14);
    m.pointer('cancel', 20, 30);
    m.pointer('up', 20, 30);
    m.demo(6.5);
    assert.equal(m.snapshot().s.event, 'flip');
    m.demo(16);
    assert.ok(result[0] > 0);
    m.dispose();
    return [hud, result];
  };
  assert.deepEqual(preview(), preview());
});
test('undo and redo recover an inspected item and spoken follow-up without charging another light', () => {
  const c = CASES[1],
    s = steps(c, initial(), ['claim:lead', 'press', 'item:ex0', 'flip', 'back', 'redo']);
  assert.equal(s.phase, 'evidence');
  assert.equal(s.item, 'ex0');
  assert.ok(s.pressed.includes('0:lead'));
  assert.ok(s.flipped.includes('ex0'));
  assert.equal(s.lights, 4);
  assert.equal(act(c, s, 'present').phase, 'amended');
});
test('same-run replay begins the original show, fresh seeds advance, and a saved daily lineup survives other story unlocks', () => {
  let data = {};
  const store = { read: () => data, update: (fn) => (data = fn(data)) };
  let m = game.create({ store, seed: 465, mode: 'story' });
  for (let i = 0; i < 2; i++) {
    for (const id of ['claim:lead', 'press', 'item:ex' + i, 'present', 'next']) m.action(id);
  }
  m.action('file');
  m.dispose();
  m = game.create({ store, seed: 465, mode: 'story' });
  assert.equal(m.snapshot().c.id, 1);
  m.dispose();
  m = game.create({ store, seed: 466, mode: 'story' });
  assert.equal(m.snapshot().c.id, 2);
  m.dispose();
  m = game.create({ store, seed: 20261118, mode: 'daily' });
  const original = m.snapshot().queue;
  m.dispose();
  let b = ledger(data);
  for (const c of CASES) b = record(b, c, play(c), 'story', 7);
  assert.deepEqual(
    lineup('daily', b, null, 20261118).map((c) => c.id),
    original
  );
});
