import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION } from '../src/games/collection.js';
import { GAMES } from '../src/games/list.js';
import { SHELF, countIn, sortShelf } from '../src/games/shelf.js';
import { rng } from '../src/games/kit/fx.js';

test('twenty different games are discoverable from the latest release and the existing filters', () => {
  const ids = COLLECTION.map(game => game.id);
  assert.equal(new Set(ids).size, 20);
  assert.equal(new Set(COLLECTION.map(game => game.name)).size, 20);
  assert.deepEqual(SHELF.filter(g => g.tags.includes('new')).map(g => g.id), ids);
  assert.deepEqual(sortShelf('new').slice(0, 20).map(g => g.id), ids);
  assert.ok(['arcade','action','puzzle','3d','chill'].every(tag => countIn(tag) >= 13));
});

for (const { id } of COLLECTION) {
  test(id + ' exposes playable controls and a seeded demo through its own module', async () => {
    const { default: game } = await import('../src/games/' + id + '/game.js');
    assert.equal(game.title, GAMES[id].name);
    for (const guide of [game.instructions, game.keys, game.touch]) {
      assert.ok(guide.length);
      for (const row of guide) assert.ok(row.length === 2 && row.every(v => typeof v === 'string' && v.trim()));
    }
    function preview() {
      const random = rng(7);
      let latest = null, result = null;
      const model = game.create({ rng: random.next, hud: (...v) => { latest = v; },
        end: (...v) => { result = v; }, sound() {}, haptic() {} });
      for (const method of ['pointer','key','demo','draw','update']) assert.equal(typeof model[method], 'function');
      for (let frame = 0; frame < 900 && !result; frame++) {
        model.demo(1 / 120);
        model.update(1 / 120);
      }
      assert.ok(latest, 'the player can see run progress');
      return { latest, result };
    }
    assert.deepEqual(preview(), preview());
  });
}
