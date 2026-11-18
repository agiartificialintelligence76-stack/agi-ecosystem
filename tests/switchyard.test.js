import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/switchyard/game.js';
import { plans, makeYard, dailyDish, lines } from '../src/games/switchyard/yards.js';
import { apply, key, legal, mirrorAction, moveRoute, solved, deviceLocked, ticketHead } from '../src/games/switchyard/rules.js';
import { book } from '../src/games/switchyard/station-book.js';
import { solve } from '../src/games/switchyard/solver.js';
import { medal, mealScore, openLine, accessible, stamp } from '../src/games/switchyard/progress.js';
import { geometry, nearest } from '../src/games/switchyard/geometry.js';
import { voiceBank } from '../src/games/switchyard/lines.js';
import { instruments } from '../src/games/switchyard/sound.js';
import { simulate } from '../src/games/switchyard/ai.js';
const actions = i => [...book[i]].map(a => parseInt(a, 16));
function replay(yard, steps, state = yard.start) {
  for (const a of steps) {
    const before = JSON.stringify(state),
      n = apply(yard, state, a);
    assert.ok(n, yard.name + ' action ' + a);
    assert.equal(JSON.stringify(state), before);
    state = n;
  }
  return state;
}
function session(mode = 'campaign', initial = {}) {
  let data = structuredClone(initial),
    result,
    buttons,
    last,
    ends = 0;
  const store = {
    read: () => structuredClone(data),
    update: fn => data = fn(structuredClone(data))
  };
  const api = {
    store,
    seed: 20261118,
    mode,
    end: (score, stats) => {
      ends++;
      result = {
        score,
        ...Object.fromEntries(stats)
      };
    },
    controls: b => buttons = b,
    say: l => last = l
  };
  const m = game.create(api);
  const press = code => {
    m.key('down', code);
    m.key('up', code);
  };
  const tap = id => {
    m.action(id, 'down');
    m.action(id, 'up');
  };
  return {
    m,
    store,
    press,
    tap,
    get result() {
      return result;
    },
    get ends() {
      return ends;
    },
    get buttons() {
      return buttons;
    },
    get last() {
      return last;
    }
  };
}
function breadth(y) {
  const queue = [[y.start, 0]],
    seen = new Set([JSON.stringify(y.start)]);
  for (let i = 0; i < queue.length; i++) {
    const [s, g] = queue[i];
    if (solved(s)) return g;
    for (let a = 0; a < 9 + y.devices.length; a++) {
      const n = apply(y, s, a);
      if (n) {
        const id = JSON.stringify(n);
        if (!seen.has(id)) {
          seen.add(id);
          queue.push([n, g + 1]);
        }
      }
    }
  }
  return Infinity;
}
test('all 36 authored stations have an exact optimal ticket, including working points, bridges and two kitchens', () => {
  assert.equal(plans.length, 36);
  assert.equal(lines.length, 6);
  assert.equal(new Set(plans.map(p => p.name)).size, 36);
  assert.equal(new Set(plans.map(p => p.rows.join('/'))).size, 36);
  for (let i = 0; i < 36; i++) {
    const y = makeYard(i),
      r = solve(y);
    assert.equal(r.complete, true, y.name);
    assert.equal(r.path.length, book[i].length, y.name);
    assert.ok(solved(replay(y, actions(i))));
  }
  assert.equal(book[0].length, 3);
  assert.equal(book[1].length, 9);
  assert.ok(book[16].length >= 25);
});
test('independent exhaustive search without state symmetry agrees on nine different operating rules', () => {
  for (const i of [0, 1, 2, 3, 12, 14, 15, 18, 24]) assert.equal(breadth(makeYard(i)), book[i].length);
});
test('the locomotive never drives through a loose car; push/couple/undo use reversible immutable state', () => {
  const y = makeYard(0),
    near = apply(y, y.start, 1);
  assert.equal(apply(y, near, 1), null);
  assert.equal(apply(y, near, 7), null);
  const coupled = apply(y, near, 5);
  assert.deepEqual(coupled.chain, [0]);
  assert.equal(apply(y, coupled, 8).chain.length, 0);
  const pull = apply(y, coupled, 3);
  assert.equal(pull.cars[0], near.e);
  assert.ok(solved(apply(y, coupled, 1)));
  const r = session();
  r.press('ArrowRight');
  r.press('Space');
  r.press('KeyZ');
  assert.deepEqual(r.m.inspect().state, near);
  assert.equal(r.m.inspect().steps, 1);
});
test('a whole ordered consist pushes together and releasing opens its outer jaw only', () => {
  const y = makeYard(33),
    s = replay(y, [7, 7, 7]);
  assert.deepEqual(s.chain, [2, 1, 0]);
  const drop = apply(y, s, 8);
  assert.deepEqual(drop.chain, [2, 1]);
  assert.deepEqual(drop.cars, s.cars);
  assert.equal(drop.e, s.e);
  const pushed = apply(y, s, 3);
  assert.deepEqual(pushed.chain, [2, 1]);
  assert.equal(pushed.cars[0], -1);
  assert.equal(pushed.cars[1], s.cars[0]);
  assert.ok(solved(replay(y, actions(33))));
});
test('same-kitchen duplicate ingredients are interchangeable; order and kitchen still govern departure', () => {
  const y = makeYard(33),
    s = replay(y, [7, 7, 7]);
  const positions = s.cars.slice();
  [positions[0], positions[2]] = [positions[2], positions[0]];
  const alternate = {
    ...s,
    cars: positions,
    chain: [0, 1, 2]
  };
  const n = apply(y, alternate, 3);
  assert.equal(n.cars[2], -1);
  assert.equal(ticketHead(y, n, 0), 1);
  assert.equal(y.dish[0], y.dish[2]);
  const blocked = {
    ...y,
    dish: [...y.dish]
  };
  blocked.dish[2] = 4;
  assert.notEqual(apply(blocked, alternate, 3).cars[2], -1);
  const twin = makeYard(24),
    east = replay(twin, [5, 1]);
  assert.equal(ticketHead(twin, east, 1), -1);
  assert.equal(ticketHead(twin, east, 0), 0);
});
test('facing and sprung points, occupied levers and one-way leads all constrain physical movement', () => {
  const y = makeYard(12),
    toLever = replay(y, [1, 1]);
  assert.equal(deviceLocked(y, toLever, 0), true);
  assert.equal(apply(y, toLever, 9), null);
  const link = apply(y, toLever, 5);
  assert.equal(apply(y, link, 1), null);
  const lined = replay(y, [9, 1, 1, 5, 1]);
  assert.ok(solved(lined));
  assert.equal(apply(y, apply(y, y.start, 1), 3), null);
  const off = replay(y, [9, 1]);
  const idx = y.devices[0].node,
    blocked = {
      ...off,
      cars: [idx]
    };
  assert.equal(apply(y, blocked, 9), null);
});
test('turntable aligns the opposite spokes, permits a single occupant and refuses to split a train', () => {
  const y = makeYard(18),
    cross = replay(y, [1, 1]);
  assert.equal(yardPoint(y, cross.e).ch, '%');
  assert.equal(apply(y, cross, 4), null);
  const turn = apply(y, cross, 9),
    joint = apply(y, turn, 4);
  assert.ok(joint);
  assert.equal(apply(y, joint, 9), null);
  assert.ok(solved(apply(y, joint, 0)));
  const parked = {
    ...y.start,
    cars: [cross.e]
  };
  assert.ok(apply(y, parked, 9));
  function yardPoint(y, i) {
    return y.points[i];
  }
});
test('a refuge accommodates the engine but cannot accept a coupled wagon', () => {
  const y = makeYard(30),
    at = y.points.findIndex(p => p.ch === '!'),
    left = y.points[at].links[3];
  const s = {
    ...y.start,
    e: at,
    cars: [left, y.start.cars[1]],
    chain: [0]
  };
  assert.equal(apply(y, s, 2), null);
  assert.ok(apply(y, {
    ...s,
    chain: []
  }, 2));
});
test('all 144 dispatch orientations match the certificates; daily tickets and solutions actually change', () => {
  for (let i = 0; i < 36; i++) for (let mirror = 0; mirror < 4; mirror++) {
    const y = makeYard(i, mirror, 3);
    assert.ok(solved(replay(y, actions(i).map(a => mirrorAction(a, mirror)))));
  }
  const keys = new Set();
  for (let day = 1; day <= 28; day++) {
    const y = dailyDish(20261100 + day);
    keys.add(y.id + '/' + y.mirror + '/' + y.dish);
    assert.deepEqual(y.start, dailyDish(20261100 + day).start);
  }
  assert.ok(keys.size >= 25);
  for (const seed of [2, 11, 40]) {
    const y = dailyDish(seed);
    assert.equal(solve(y).path.length, book[y.id].length);
  }
});
test('three star tiers, unlocks and PBs survive reload and preserve the prior game namespace', () => {
  assert.deepEqual([medal(10, 10), medal(12, 10), medal(13, 10)], [3, 2, 1]);
  const r = session('campaign', {
    oldRecord: 147
  });
  r.press('ArrowRight');
  r.press('Space');
  r.press('ArrowRight');
  r.press('KeyX');
  r.press('KeyX');
  assert.equal(r.ends, 1);
  assert.equal(r.result.score, mealScore(3, 3));
  assert.equal(r.result['Ingredients served'], 1);
  assert.equal(r.store.read().oldRecord, 147);
  const records = {
    0: 3,
    1: 9,
    2: 10
  };
  assert.equal(openLine(records, 1), false);
  records[3] = 9;
  assert.ok(openLine(records, 1));
  assert.ok(!accessible(records, 8, 'sandbox'));
  stamp(r.store, makeYard(0), 5, 3, 'campaign', 1);
  assert.equal(r.store.read().noodleRail.stations[0], 3);
  stamp(r.store, makeYard(18), 8, 5, 'daily', 11);
  assert.ok(!r.store.read().noodleRail.stations[18]);
  assert.equal(r.store.read().noodleRail.daily[11], 8);
  assert.equal(session('campaign', r.store.read()).m.inspect().yard, 1);
});
test('touch, keyboard, station selection and dock each work through the same operating actions', () => {
  for (const mode of ['touch', 'keyboard', 'dock']) {
    const r = session(),
      y = makeYard(0),
      g = geometry(y, 360, 430);
    if (mode === 'touch') {
      const tapNode = n => {
        const [x, y0] = g.at(n);
        r.m.pointer('down', x, y0, 360, 430);
        r.m.pointer('up', x, y0, 360, 430);
      };
      tapNode(1);
      tapNode(2);
      tapNode(2);
    } else if (mode === 'keyboard') {
      r.press('ArrowRight');
      r.press('Space');
      r.press('ArrowRight');
    } else {
      r.tap('go1');
      r.tap('link5');
      r.tap('go1');
    }
    assert.equal(r.m.inspect().done, true);
    r.tap('file');
    assert.equal(r.result.score, 509);
  }
  const s = session('sandbox');
  assert.ok(s.m.inspect().map);
  s.press('Enter');
  assert.ok(!s.m.inspect().map);
  s.press('KeyB');
  s.press('ArrowDown');
  s.press('Enter');
  assert.ok(s.m.inspect().map);
});
test('route previews contain only individual legal rolls; pause, focus loss and hint generation leave state intact', () => {
  const y = makeYard(18),
    route = moveRoute(y, y.start, y.devices[0].node);
  assert.deepEqual(route, [1, 1]);
  assert.equal(replay(y, route).e, y.devices[0].node);
  const r = session();
  r.press('KeyH');
  assert.match(r.m.inspect().lineText, /east/);
  r.m.pause();
  r.press('ArrowRight');
  assert.equal(r.m.inspect().steps, 0);
  r.m.resume();
  r.press('ArrowRight');
  const before = r.m.inspect().state;
  const [tx, ty] = geometry(makeYard(0), 360, 420).at(2);
  r.m.pointer('down', tx, ty, 360, 420);
  r.m.pointer('move', tx + 30, ty, 360, 420);
  r.m.pointer('up', tx, ty, 360, 420);
  assert.deepEqual(r.m.inspect().state, before);
  r.m.pointer('down', tx, ty, 360, 420);
  r.m.pointer('cancel', tx, ty, 360, 420);
  r.m.pointer('up', tx, ty, 360, 420);
  r.m.key('up', 'Space');
  r.m.cancelInput();
  r.m.update(.4);
  assert.deepEqual(r.m.inspect().state, before);
});
test('art hit tests contain every berth across the phone, folded laptop, desktop and landscape', () => {
  for (const [w, h] of [[360, 401], [390, 338], [667, 341], [884, 925], [1440, 760], [2560, 1300]]) for (let i = 0; i < 36; i++) {
    const y = makeYard(i),
      g = geometry(y, w, h);
    y.points.forEach((_, n) => {
      const [x, y0] = g.at(n);
      assert.ok(x >= 0 && x < w && y0 >= 0 && y0 < h);
      assert.equal(nearest(y, g, x, y0), n);
    });
  }
});
test('demo serves a two-course bridge ticket with an authored reaction bank and 12 distinct instruments', () => {
  const r = session();
  const demo = game.create({
    demo: true,
    seed: 7
  });
  assert.equal(demo.inspect().yard, 19);
  let max = 0;
  for (let i = 0; i < 1500; i++) {
    demo.demo(1 / 120);
    demo.update(1 / 120);
    max = Math.max(max, demo.inspect().state.cars.filter(c => c < 0).length);
  }
  assert.equal(max, 2);
  assert.ok(new Set(Object.values(voiceBank).flat()).size >= 32);
  assert.equal(Object.keys(instruments).length, 12);
  assert.ok(r.buttons.length >= 3);
});
test('three reproducible drivers show meaningful score, time, mistakes and mastery differences', () => {
  const [n, s, e] = ['newbie', 'steady', 'expert'].map(p => simulate(p, 7919));
  assert.equal(n.yards, 36);
  assert.deepEqual(simulate('steady', 7919), s);
  assert.ok(n.score < s.score && s.score < e.score);
  assert.ok(n.seconds > s.seconds && s.seconds > e.seconds);
  assert.ok(s.seconds > 20 * 60);
  assert.ok(n.failed > s.failed && s.failed > e.failed);
  assert.ok(n.perfect < s.perfect && s.perfect < e.perfect);
});
