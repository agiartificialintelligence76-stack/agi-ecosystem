import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/waxworks/game.js';
import { depots, daily, open, ledger, emblems, record } from '../src/games/waxworks/dispatch.js';
import { start, tip, footprint, transition, code, ids, delivered } from '../src/games/waxworks/rolling.js';
import { solve, replay, stars } from '../src/games/waxworks/solver.js';
import { deliver } from '../src/games/waxworks/crew.js';
import { impacts } from '../src/games/waxworks/sound.js';
import { lines } from '../src/games/waxworks/lines.js';
import { rig } from '../src/games/waxworks/warehouse.js';
const flat = (rows, extra = {}) => ({
  name: 'fixture',
  start: { x: 0, y: 0, o: 'up' },
  rows,
  required: 0,
  goal: '3,0',
  ...extra,
});
function memory() {
  let data = { foreign: 42 };
  return { read: () => data, update: (f) => (data = f(data)) };
}
function play(opts = {}) {
  let controls = [],
    hud = [],
    result = null,
    speech = '';
  const store = opts.store || memory(),
    model = game.create({
      seed: 7,
      store,
      ...opts,
      controls: (l) => (controls = l),
      hud: (...args) => (hud = args),
      say: (t) => (speech = t),
      end: (...a) => (result = a),
    });
  return {
    model,
    store,
    press: (id) => model.action(id, 'down'),
    get controls() {
      return controls;
    },
    get hud() {
      return hud;
    },
    get result() {
      return result;
    },
    get speech() {
      return speech;
    },
  };
}
test('42 authored shipping floors have distinct topologies and complete shortest frontier certificates', () => {
  assert.equal(depots.length, 42);
  const hashes = new Set(depots.map((d) => d.rows.join('/') + '|' + d.start.x + ',' + d.start.y + '|' + d.goal));
  assert.equal(hashes.size, 42);
  for (const d of depots) {
    const proof = solve(d);
    assert.equal(proof.par, d.certificate.par, d.name);
    assert.deepEqual(proof.frontiers.slice(0, -1), d.certificate.frontiers, d.name);
    assert.ok(replay(d, d.certificate.route).clear, d.name);
    assert.equal(d.certificate.route.length, proof.par);
    assert.ok(proof.par >= 2);
  }
});
test('independent layer enumeration finds no goal at any smaller depth', () => {
  for (const d of depots) {
    const seen = new Set(),
      canon = (p) =>
        JSON.stringify(p.parts ? [p.parts, p.active, p.post, p.broken] : [p.x, p.y, p.o, p.post, p.broken]);
    let layer = [start(d)];
    seen.add(canon(layer[0]));
    for (let depth = 0; depth < d.certificate.par; depth++) {
      assert.equal(
        layer.some((p) => delivered(d, p)),
        false,
        d.name
      );
      assert.equal(layer.length, d.certificate.frontiers[depth], d.name + ' frontier ' + depth);
      const next = [];
      for (const state of layer)
        for (const dir of state.parts ? ids : ids.slice(0, 4)) {
          const q = transition(d, state, dir).state;
          if (!q) continue;
          const id = canon(q);
          if (!seen.has(id)) {
            next.push(q);
            seen.add(id);
          }
        }
      layer = next;
    }
    assert.ok(
      layer.some((p) => delivered(d, p)),
      d.name
    );
  }
});
test('each depot teaching a new material uses it on its actual shortest witness', () => {
  for (const d of depots) {
    const events = replay(d, d.certificate.route).events;
    if (d.world === 1) assert.ok(events.includes('break'), d.name);
    if (d.world === 2) assert.ok(events.includes('belt'), d.name);
    if (d.world === 3) for (const e of ['split', 'seam', 'switch']) assert.ok(events.includes(e), d.name);
    if (d.world === 4) assert.ok(events.includes('chute'), d.name);
  }
});
test('tipping, upright support and the parallel side roll have distinct geometric footprints', () => {
  const p = { x: 3, y: 3, o: 'up' };
  assert.deepEqual(footprint(tip(p, 'W')), [
    [1, 3],
    [2, 3],
  ]);
  assert.deepEqual(footprint(tip(p, 'S')), [
    [3, 4],
    [3, 5],
  ]);
  assert.deepEqual(footprint(tip(tip(p, 'E'), 'S')), [
    [4, 4],
    [5, 4],
  ]);
  assert.deepEqual(footprint(tip(tip(p, 'N'), 'N')), [[3, 0]]);
  assert.deepEqual(footprint(tip(tip(p, 'E'), 'W')), [[3, 3]]);
  const d = flat(['#.##']);
  assert.equal(transition(d, start(d), 'E').fault, 'edge');
});
test('glass drops on departure, both panes drop in parallel and an invalid move leaves history intact', () => {
  const d = flat(['#~~#', '####']);
  let p = transition(d, start(d), 'E').state;
  assert.equal(p.broken, 0);
  assert.deepEqual(transition(d, p, 'N'), { fault: 'edge' });
  assert.equal(p.broken, 0);
  p = transition(d, p, 'S').state;
  assert.equal(p.broken, 3);
  assert.equal(transition(d, p, 'N').fault, 'edge');
  const fragile = flat(['###~']);
  assert.equal(replay(fragile, 'EE').fault, 'upright glass');
});
test('belts settle in one turn, paired chutes preserve orientation and repeat automatic states fail safely', () => {
  const belt = flat(['#>###']);
  const q = transition(belt, start(belt), 'E', true);
  assert.equal(q.path.length, 2);
  assert.equal(q.state.x, 2);
  assert.equal(q.state.o, 'x');
  const loop = flat(['#><##']);
  assert.equal(transition(loop, start(loop), 'E').fault, 'sorting loop');
  const chute = flat(['#O##O##'], {
    chutes: [
      [
        [1, 0],
        [4, 0],
      ],
    ],
  });
  const moved = transition(chute, start(chute), 'E');
  assert.equal(moved.state.x, 4);
  assert.equal(moved.state.o, 'x');
});
test('a split preserves unit identity, avoids occupied cells and only joins the printed seam', () => {
  const d = depots[24];
  let p = start(d);
  for (const op of 'EE') p = transition(d, p, op).state;
  assert.equal(p.parts.length, 2);
  const a = p.parts[0];
  const q = transition(d, p, 'X').state;
  assert.deepEqual(q.parts[0], a);
  assert.equal(q.active, 1);
  assert.equal(
    transition(
      d,
      {
        ...p,
        parts: [
          [1, 0],
          [2, 0],
        ],
      },
      'E'
    ).fault,
    'occupied'
  );
  assert.ok(replay(d, d.certificate.route).events.includes('seam'));
});
test('collected postage is required on the scale, and shadows of a flat crate cannot deliver it', () => {
  const d = flat(['#+##'], { required: 1 });
  assert.equal(delivered(d, { ...start(d), x: 3 }), false);
  assert.ok(replay(d, 'EE').clear);
  assert.equal(delivered(d, { ...start(d), x: 3, o: 'x', post: 1 }), false);
});
test('dated dispatches use a true solved transformed layout or the certified fallback', () => {
  const variants = new Set();
  for (const seed of [1, 2, 3, 4, 5, 14, 95, 20261119, 20261201, 20270109]) {
    const a = daily(seed),
      b = daily(seed);
    variants.add(a.rows.join('/') + '|' + a.goal);
    assert.deepEqual(a, b);
    assert.ok(replay(a, a.certificate.route).clear);
    assert.equal(solve(a).par, a.certificate.par);
  }
  assert.ok(variants.size >= 5);
});
test('ledger preserves better rolls, unlocks after five stamps, stores dated slips apart and ignores old saves', () => {
  assert.deepEqual(ledger({ obsolete: 1 }).jobs, {});
  const store = memory();
  assert.equal(open(ledger(store.read()), depots[8]), false);
  for (const d of depots.slice(0, 5)) record(store, d, 5, 2, 'campaign', 0);
  assert.ok(open(ledger(store.read()), depots[8]));
  record(store, depots[0], 2, 3, 'campaign', 0);
  record(store, depots[0], 8, 1, 'campaign', 0);
  record(store, depots[0], 4, 1, 'daily', 45);
  const book = ledger(store.read());
  assert.equal(book.jobs[1].rolls, 2);
  assert.equal(book.daily[45].rolls, 4);
  assert.equal(store.read().foreign, 42);
  assert.deepEqual(emblems(book), []);
  for (const d of depots.slice(5, 8)) record(store, d, 2, 3, 'campaign', 0);
  assert.deepEqual(emblems(ledger(store.read())), ['Twine']);
  for (const [par, a, b] of [
    [4, 5, 6],
    [5, 7, 8],
  ])
    assert.deepEqual([stars(par, par), stars(a, par), stars(b, par)], [3, 2, 1]);
});
test('physical buttons, keyboard, swipe cancellation, history, hint, next depot and file run through real game controls', () => {
  const g = play();
  g.press('N');
  assert.equal(g.hud[3], '0 / 2');
  g.model.pointer('down', 5, 5);
  g.model.pointer('cancel', 60, 50);
  g.model.pointer('up', 60, 50);
  assert.equal(g.hud[3], '0 / 2');
  g.model.pointer('down', 5, 5);
  g.model.pointer('up', 60, 50);
  assert.equal(g.hud[3], '1 / 2');
  g.model.key('down', 'KeyZ');
  assert.equal(g.hud[3], '0 / 2');
  g.press('hint');
  assert.match(g.speech, /East/);
  g.press('E');
  g.model.key('down', 'ArrowRight');
  assert.ok(g.controls.some((v) => v.id === 'file'));
  g.press('next');
  assert.equal(g.hud[1], 2);
  for (const dir of depots[1].certificate.route) g.press(dir);
  g.press('file');
  assert.ok(g.result[0] > 0);
  assert.equal(g.result[1][0][1], 2);
  assert.ok(ledger(g.store.read()).jobs[1]);
});
test('preview uses a real midworld split, can finish, and keeps its save untouched', () => {
  const g = play({ demo: true });
  for (let i = 0; i < 1800 && !g.result; i++) {
    g.model.demo(1 / 120);
    g.model.update(1 / 120);
  }
  assert.ok(g.result[0] > 0);
  assert.deepEqual(g.store.read(), { foreign: 42 });
});
test('all crews reach the scale, fixture sounds and personality banks are individual, and five layouts stay inside the view', () => {
  for (const persona of ['newcomer', 'regular', 'expert']) assert.ok(deliver(depots[39], persona, 23).solved);
  assert.ok(Object.values(lines).flat().length >= 32);
  assert.ok(Object.keys(impacts).length >= 12);
  for (const [w, h] of [
    [360, 380],
    [700, 285],
    [884, 880],
    [1440, 715],
    [2560, 1100],
  ])
    for (const d of depots) {
      const r = rig(w, h, d);
      for (let y = 0; y < d.rows.length; y++)
        for (let x = 0; x < d.rows[y].length; x++)
          if (d.rows[y][x] !== '.') {
            const [px, py] = r.pt(x + 0.5, y + 0.5, 0);
            assert.ok(px >= 0 && px <= w && py > 0 && py < h);
          }
    }
});
