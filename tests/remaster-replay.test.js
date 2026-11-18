import test from 'node:test';
import assert from 'node:assert/strict';
import { PROOFS } from '../src/games/rookery/proofs.js';

function memory(data = {}) {
  return {
    read: () => structuredClone(data),
    update(fn) {
      data = fn(structuredClone(data));
      return data;
    },
  };
}

async function play(id, store, openingProgress, mode, options = {}) {
  const game = (await import('../src/games/' + id + '/game.js')).default;
  const labels = [];
  let pads = [], result;
  const model = game.create({
    seed: 7, rng: () => .35, store, openingProgress, mode, options,
    hud: (...rows) => labels.push(...rows.map(String)),
    say: line => labels.push(line),
    controls: buttons => { pads = buttons.map(b => b.id); },
    end: (score, rows) => { result = { score, rows: Object.fromEntries(rows) }; },
  });
  model.update(1 / 60);
  return {
    labels, pads, model,
    finish() {
      for (let frame = 0; frame < 36000 && !result; frame++) {
        model.demo(1 / 60);
        model.update(1 / 60);
      }
      assert.ok(result?.score > 0, id + ' must finish normally');
      return result.rows;
    },
  };
}

const openings = [
  ['cloudkitchen', 'week', { teaCounter: { day: 1 } }, 0, 1, run => run.model.inspect().state.day],
  ['moonfreight', 'ladder', { moonSalon: { ladder: 2 } }, 0, 2, run => run.model.inspect().table.condition],
  ['switchyard', 'campaign', { noodleRail: { stations: { 0: 3 }, lastYard: 0 } }, 0, 1, run => run.model.inspect().yard],
  ['lanternlake', 'story', { radioBook: { v: 2, cases: { 1: { seals: 3 } } } }, 1, 2, run => run.model.snapshot().c.id],
  ['pearlshift', 'calm', { hydrophoneLog: { stations: [0,1,2,3] } }, 'Glasswater Pier', 'Tin Bell Bay'],
  ['summitline', 'book', { cableSongbook: { stamps: [0,1,2] } }, 'Meadow Lift', 'Pine Lantern'],
  ['nightpress', 'campaign', { pressBinder: { stars: [3] } }, '1', '2'],
  ['inkveil', 'campaign', { alibi: { v: 2, cases: { 1: { stars: 3 } } } }, '0 / 7', '0 / 9'],
  ['waxworks', 'campaign', { dispatch: { v: 1, jobs: { 1: { stars: 3 } } } }, '0 / 2', '0 / 4'],
  ['prismcourier', 'gallery', { mirrorBook: { version: 1, rooms: { 0: { stars: 3 } } } }, '1 / 40', '2 / 40'],
  ['starlingrelay', 'season', { playbill: { v: 1, scenes: { 1: { stars: 3 } } } }, '1 / 6', '0 / 7'],
  ['driftglass', 'ladder', { bandit: { wins: [true], last: { seed: 7, meet: 0 } } }, '1 / 12', '2 / 12'],
  ['mothlight', 'campaign', { photoBook: { stars: [3], last: { seed: 7, roll: 0 } } },
    'A wave under the blossoms. Keep my shoes in.', 'Leave the canal reflection below my shoes.'],
  ['tidepool', 'hosted', { dj: { grades: [3], lastHosted: { seed: 7, shift: 0 } } }, '1/6', '1/7'],
];

for (const [id, mode, completed, first, next, identify] of openings) {
  test(id + ' restores the filed opening while a fresh run selects the next edition at the same seed', async () => {
    const store = memory();
    const firstOpening = store.read();
    for (const [opening, expected] of [[firstOpening, first], [completed, next], [firstOpening, first]]) {
      if (opening === completed) store.update(() => completed);
      const run = await play(id, store, opening, mode);
      if (identify) assert.equal(identify(run), expected);
      else assert.ok(run.labels.includes(expected), 'Expected opening ' + expected + ' in ' + run.labels.join(' | '));
      run.model.dispose?.();
    }
    assert.deepEqual(firstOpening, {});
  });
}

test('Side B grants a newly unlocked cut on a fresh broadcast and preserves the original equipment on replay', async () => {
  const filed = { dj: { grades: [3], lastHosted: { seed: 7, shift: 0 } } };
  const live = memory(filed);
  for (const [opening, edits] of [[{}, false], [filed, true]]) {
    const run = await play('tidepool', live, opening, 'hosted', { episode: '0' });
    assert.equal(run.pads.includes('edit'), edits);
    run.model.dispose();
  }
});

for (const [id, mode, save, key, first, next] of [
  ['pocketgrove', 'journal', { windowSeat: { nights: { 0: { stars: 3 } } } }, 'Tonight', 'Bakery Lights', 'Low Tide Letters'],
  ['rookery', 'story', { napBook: { runs: { 1: PROOFS[0].witness }, last: { seed: 7, id: 1 } } }, 'Nap', 'Sleep Button', 'Two Seats'],
]) {
  test(id + ' files the original excursion again, including its real end card, without losing later progress', async () => {
    const live = memory({ ...save, otherGameRecord: 41 });
    for (const [opening, expected] of [[{}, first], [save, next], [{}, first]]) {
      const run = await play(id, live, opening, mode);
      assert.equal(run.finish()[key], expected);
      run.model.dispose?.();
    }
    assert.equal(live.read().otherGameRecord, 41);
    const records = id === 'rookery' ? live.read().napBook.runs : live.read().windowSeat.nights;
    assert.equal(Object.keys(records).length, 2);
  });
}

test('Wingwalk stamps the flown route and keeps the other route when replaying after a subsequent delivery', async () => {
  const live = memory({ wingwalk: { routes: { 0: { grade: 2, score: 1 } } } });
  const filed = live.read();
  for (const [opening, expectedRoutes] of [[{}, 1], [filed, 2], [{}, 2]]) {
    const run = await play('cloudfoil', live, opening, 'post', { route: 'next' });
    run.finish();
    assert.equal(Object.keys(live.read().wingwalk.routes).length, expectedRoutes);
    assert.ok(live.read().wingwalk.routes[0].score > 1);
    run.model.dispose?.();
  }
});

test('edition-specific high scores use the same opening as the game, including explicitly requested locked editions', async () => {
  for (const [id, mode, options, save, first, next] of [
    ['nightpress', 'campaign', { issue: '1' }, { pressBinder: { stars: [3] } }, 'issue/0', 'issue/1'],
    ['driftglass', 'ladder', { match: '1' }, { bandit: { wins: [true], last: { seed: 7, meet: 0 } } }, 'ladder/0', 'ladder/1'],
    ['mothlight', 'campaign', { roll: '1' }, { photoBook: { stars: [3], last: { seed: 7, roll: 0 } } }, 'campaign/0', 'campaign/1'],
    ['rookery', 'story', { nap: 'next' }, { napBook: { runs: { 1: PROOFS[0].witness }, last: { seed: 7, id: 1 } } }, 'bedtime/1', 'bedtime/2'],
  ]) {
    const game = (await import('../src/games/' + id + '/game.js')).default;
    const group = openingProgress => game.scoreGroup({ mode, options, seed: 7, openingProgress });
    assert.equal(group({}), first);
    assert.equal(group(save), next);
  }
});
