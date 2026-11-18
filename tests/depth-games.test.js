import test from 'node:test';
import assert from 'node:assert/strict';
import wingwalk from '../src/games/cloudfoil/game.js';
import railway from '../src/games/switchyard/game.js';
import billiards from '../src/games/moonfreight/game.js';
import bandit from '../src/games/driftglass/game.js';

function play(game, random) {
  let outcome, hud, calls = 0;
  const sounds = [];
  const model = game.create({
    rng: random, sound: (name, options) => sounds.push([name, options]), haptic() {},
    hud: (...chips) => { hud = chips; },
    end(score, stats) {
      calls++;
      assert.equal(calls, 1);
      outcome = { score, stats: Object.fromEntries(stats) };
    },
  });
  function wait(seconds, demo = false) {
    for (let frame = 0; frame < Math.round(seconds * 120); frame++) {
      if (demo && !outcome) model.demo(1 / 120);
      model.update(1 / 120);
    }
  }
  const tap = (x, y) => { model.pointer('down', x, y); model.pointer('up', x, y); };
  const press = code => { model.key('down', code); model.key('up', code); };
  return { model, wait, tap, press, sounds, get outcome() { return outcome; }, get hud() { return hud; } };
}
function seeded(seed) {
  let v = seed;
  return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const objectives = [
  [wingwalk, 'Letters delivered', '8/8'], [railway, 'Suppers delivered', '5/5'],
  [billiards, 'Tables cleared', '5/5'], [bandit, 'Broadcast', 'Your station'],
];
for (const [game, key, result] of objectives) {
  test(game.title + ' completes on different seeds, repeats the same run, and rewards play', () => {
    const run = (seed, demo) => {
      const session = play(game, seeded(seed));
      session.wait(120, demo);
      assert.ok(session.outcome);
      return session.outcome;
    };
    const best = run(7, true);
    assert.deepEqual(run(7, true), best);
    assert.equal(best.stats[key], result);
    assert.equal(run(91, true).stats[key], result);
    assert.ok(best.score > run(7, false).score);
  });
}

for (const input of ['touch', 'keyboard']) {
  test(input + ' directly delivers mail, shunts supper, shoots and steals', () => {
    const make = game => play(game, () => .5);
    const operate = (run, key, x, y) => input === 'touch' ? run.tap(x, y) : run.press(key);

    const mail = make(wingwalk);
    const jump = () => {
      if (input === 'touch') mail.model.pointer('down', 70, 431); else mail.model.key('down', 'Space');
      mail.wait(.46);
      if (input === 'touch') mail.model.pointer('up', 70, 431); else mail.model.key('up', 'Space');
      mail.wait(2.6);
    };
    jump();
    assert.ok(mail.hud[1] > 0, 'the first letter lands');
    const first = mail.hud[1];
    jump();
    assert.equal(mail.hud[1], first, 'a mismatched flight depth misses the second landing');
    operate(mail, 'ArrowUp', 267, 444);
    jump();
    assert.ok(mail.hud[1] > first, 'steering into the far lane delivers the second letter');

    const train = make(railway);
    operate(train, 'Space', 320, 436);
    const trackTap = col => [54 + col * 47 + 2 * 21, 184 - col * 13 + 2 * 35];
    operate(train, 'ArrowRight', ...trackTap(2));
    operate(train, 'KeyZ', 65, 436);
    for (const col of [2, 3, 4]) operate(train, 'ArrowRight', ...trackTap(col));
    train.wait(1.2);
    assert.equal(train.hud[1], 530, 'undo and three coupled pushes achieve the chef’s par');

    const pool = make(billiards);
    operate(pool, 'Space', 322, 429);
    pool.wait(.2);
    assert.equal(pool.hud[3], 11, 'one launch spends one piece of chalk');
    assert.ok(pool.sounds.some(([name]) => name === 'slice'));

    const chase = make(bandit);
    if (input === 'touch') chase.tap(201, 217);
    else { chase.model.key('down', 'ArrowUp'); chase.wait(.43); chase.model.key('up', 'ArrowUp'); }
    chase.wait(2);
    operate(chase, 'Space', 245, 440);
    chase.wait(.5);
    assert.ok(parseFloat(chase.hud[1]) > 0, 'the player took the live cassette');
  });
}

test('an interrupted hold cancels the jump and cue', () => {
  for (const game of [wingwalk, billiards]) {
    const run = play(game, () => .5);
    run.model.key('down', 'Space'); run.wait(.4); run.model.cancelInput(); run.model.key('up', 'Space');
    assert.ok(run.sounds.every(([name]) => name !== 'whoosh' && name !== 'slice'));
  }
});
