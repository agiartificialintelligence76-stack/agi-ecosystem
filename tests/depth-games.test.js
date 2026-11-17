import test from 'node:test';
import assert from 'node:assert/strict';
import cloudfoil from '../src/games/cloudfoil/game.js';
import switchyard from '../src/games/switchyard/game.js';
import pearlshift from '../src/games/pearlshift/game.js';
import moonfreight from '../src/games/moonfreight/game.js';
import summitline from '../src/games/summitline/game.js';
import driftglass from '../src/games/driftglass/game.js';

const circuits = [
  [cloudfoil, 'Hoops', v => v === '12 / 12'],
  [switchyard, 'Correct platforms', v => v === 15],
  [pearlshift, 'Pearls landed', v => v >= 10],
  [moonfreight, 'Freight delivered', v => v === '5/5'],
  [summitline, 'Stations served', v => v === '5/5'],
  [driftglass, 'Clean gates', v => v === '18/18'],
];
function trial(game, autopilot, seed) {
  let result = null, state = seed;
  const model = game.create({
    rng: () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296),
    sound() {}, haptic() {}, hud() {},
    end(score, stats) {
      assert.equal(result, null, 'one result per run');
      assert.ok(Number.isFinite(score) && score >= 0);
      result = { score, stats: Object.fromEntries(stats) };
    },
  });
  const dt = 1 / 60;
  for (let frame = 0; !result && frame < 120 * 60; frame++) {
    if (autopilot) model.demo(dt);
    model.update(dt);
  }
  assert.ok(result, 'the run reaches a result');
  for (let n = 0; n < 120; n++) model.update(dt);
  return result;
}
for (const [game, label, finished] of circuits) {
  test(game.title + ' can be completed, repeats a seeded run, and rewards active play', () => {
    const idle = trial(game, false, 7);
    const played = trial(game, true, 7);
    assert.deepEqual(trial(game, true, 7), played);
    assert.ok(finished(played.stats[label]), label);
    assert.ok(played.score > idle.score);
    assert.ok(finished(trial(game, true, 91).stats[label]), 'alternate course');
  });
}

test('PEARL SHIFT lets both touch and keyboard pilots gather a shell, then bank it at the surface', () => {
  for (const input of ['pointer', 'keyboard']) {
    let catchScore = 0;
    const model = pearlshift.create({
      rng: () => .5, sound() {}, haptic() {},
      hud(_label, score) { catchScore = score; },
      end() { assert.fail('a single dive does not end the shift'); },
    });
    const wait = seconds => {
      for (let i = 0; i < Math.round(seconds * 60); i++) model.update(1 / 60);
    };
    const tap = (x, y) => {
      model.pointer('down', x, y);
      model.pointer('up', x, y);
    };
    const space = () => { model.key('down', 'Space'); model.key('up', 'Space'); };
    if (input === 'pointer') {
      tap(362, 267);
      tap(360, 440);
    } else {
      space();
      model.key('down', 'ArrowRight');
      wait(1.58);
      model.key('up', 'ArrowRight');
    }
    wait(3.5);
    assert.equal(catchScore, 0, 'the pearl still sits inside the bell');
    if (input === 'pointer') tap(360, 440); else space();
    wait(2.6);
    assert.equal(catchScore, 100, input);
  }
});
