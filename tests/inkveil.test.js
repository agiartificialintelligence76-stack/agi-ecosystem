import test from 'node:test';
import assert from 'node:assert/strict';
import game, { cancelAimOnEscape } from '../src/games/inkveil/game.js';
import { rooms, indexRoom, wings } from '../src/games/inkveil/rooms.js';
import { begin, turn, complete, signature, toss, visible, lens, playable } from '../src/games/inkveil/patrol.js';
import {
  neighbor,
  cone,
  throwSpots,
  hearing,
  lineOfSight,
  distances,
  walkable,
} from '../src/games/inkveil/geometry.js';
import { solve, replay, lower } from '../src/games/inkveil/solver.js';
import {
  campaign,
  witnesses,
  dossiers,
  daily,
  noir,
  notebook,
  unlocked,
  labels,
  starCount,
  keep,
} from '../src/games/inkveil/dossiers.js';
import { rebuild } from '../src/games/inkveil/variants.js';
import { layout } from '../src/games/inkveil/layout.js';
import { lines } from '../src/games/inkveil/lines.js';
import { colors } from '../src/games/inkveil/sound.js';
import { campaignRun, contractRun } from '../src/games/inkveil/ai.js';
const fixture = (rows, more = {}) =>
  indexRoom({ id: 1, wing: 0, name: 'Fixture', rows, patrol: 'E:e', tapes: 2, charges: 2, ...more });
function store() {
  let data = { other: 9 };
  return { read: () => data, update: (f) => (data = f(data)) };
}
function playing(opt = {}) {
  let h = [],
    controls = [],
    result = null,
    say = '',
    sav = opt.store || store();
  const model = game.create({
    seed: 7,
    store: sav,
    ...opt,
    hud: (...args) => (h = args),
    controls: (list) => (controls = list),
    end: (...args) => (result = args),
    say: (s) => (say = s),
  });
  return {
    model,
    store: sav,
    press: (id) => model.action(id, 'down'),
    key: (id) => model.key('down', id),
    get h() {
      return h;
    },
    get buttons() {
      return controls;
    },
    get msg() {
      return say;
    },
    get result() {
      return result;
    },
  };
}
test('36 individually blocked exhibits, six two-page finales, 36 diary fragments and two optimality certificates per exhibit', () => {
  assert.equal(rooms.length, 36);
  assert.equal(wings.length, 6);
  assert.equal(new Set(rooms.map((r) => r.rows.join('/'))).size, 36);
  assert.equal(new Set(rooms.map((r) => r.fragmentText)).size, 36);
  for (const r of rooms) {
    if (r.id % 6 === 0) {
      assert.equal(r.items.length, 2);
      assert.ok(r.fragment >= 0);
    }
    const proof = witnesses[r.id - 1],
      clean = replay(r, proof.route),
      fast = replay(r, proof.sprintRoute);
    assert.ok(clean.ok && clean.silent, r.name);
    assert.ok(fast.ok, r.name);
    assert.equal(solve(r).par, proof.par);
    assert.equal(solve(r, begin(r), { silent: false }).par, proof.sprint);
    assert.equal(solve(r, begin(r), { maxTurns: proof.par - 1 }), null);
    assert.equal(solve(r, begin(r), { silent: false, maxTurns: proof.sprint - 1 }), null);
    assert.ok(lower(r, r.start, 0) <= proof.sprint);
    if (r.wing === 2) assert.ok(clean.state.key);
  }
});
test('independent breadth-first search agrees with both A* objectives on the introductory rooms', () => {
  for (const room of [rooms[0], rooms[2], rooms[6]])
    for (const silent of [true, false]) {
      const queue = [begin(room)],
        seen = new Set([signature(queue[0])]);
      let depth = 0,
        at = 0;
      while (true) {
        let end = queue.length;
        let won = false;
        for (; at < end; at++) {
          const s = queue[at];
          if (complete(room, s)) {
            won = true;
            break;
          }
          for (const op of playable(room, s)) {
            const result = turn(room, s, op),
              n = result.state;
            if (!n || n.caught || (silent && result.events.includes('seen'))) continue;
            const k = signature(n);
            if (!seen.has(k)) {
              seen.add(k);
              queue.push(n);
            }
          }
        }
        if (won) break;
        depth++;
        assert.ok(depth < 30 && queue.length > at);
      }
      assert.equal(depth, silent ? witnesses[room.id - 1].par : witnesses[room.id - 1].sprint);
    }
});
test('25 campaign rooms require a tape for any silent solution and it strictly shortens five others', () => {
  let needs = 0,
    faster = 0;
  for (const r of rooms) {
    const q = solve(r, begin(r), { decoy: false });
    if (!q) needs++;
    else if (q.par > witnesses[r.id - 1].par) faster++;
  }
  assert.equal(needs, 25);
  assert.equal(faster, 5);
});
test('256 daily floor and entrance variations replay silently and their computed minimum equals the signed cost', () => {
  const keys = new Set();
  for (const spec of dossiers) {
    const r = rebuild(spec);
    assert.ok(replay(r, spec.route).ok);
    assert.equal(solve(r).par, spec.par);
    keys.add([spec.id, spec.layout, spec.lamp, spec.entry, spec.exit].join());
  }
  assert.equal(keys.size, 256);
  assert.deepEqual(daily(20261119).certificate, daily(20261119).certificate);
  assert.notDeepEqual(daily(20261119).certificate, daily(20261120).certificate);
  assert.notEqual(noir(7, 0).certificate, noir(7, 1).certificate);
});
test('a wall cuts both light and sound, while a glass cabinet stops sound and allows a clear view', () => {
  const glass = fixture(['S|D..', '..a.E']);
  assert.ok(lineOfSight(glass, 0, 2));
  assert.ok(hearing(glass, 2, true, 0) > 2);
  assert.equal(walkable(glass, 1), false);
  const solid = fixture(['S#D..', '..a.E']);
  assert.equal(lineOfSight(solid, 0, 2), false);
  const corner = fixture(['S#..', '..D.', 'a..E']);
  assert.equal(lineOfSight(corner, 0, 5), false);
  const blank = fixture(['S...', '..D.', 'a..E']);
  assert.ok(lineOfSight(blank, 0, 5));
});
test('carpet is quiet and attenuates a propagated lure; closed keycard doors block light and listening', () => {
  const r = fixture(['Sc+aDE']);
  assert.equal(hearing(r, 3, false, 0), 32767);
  assert.equal(hearing(r, 3, true, 0), 7);
  assert.equal(lineOfSight(r, 0, 3, false), false);
  assert.ok(lineOfSight(r, 0, 3, true));
  const a = turn(r, begin(r), 'E');
  assert.ok(a.events.includes('carpet'));
  assert.equal(turn(r, a.state, 'E').fault, 'locked');
  const secured = rooms[12];
  assert.ok(replay(secured, witnesses[12].route).events.includes('key'));
});
test('the chosen recorder is a source only, has finite life, blocked diagonal throws cannot consume a charge, and a visible girl has priority', () => {
  const room = fixture(['S..D.', '..#aE', '.....'], { patrol: 'W:w' }),
    s = begin(room);
  assert.equal(turn(room, s, toss(0, 6)).fault, 'blocked throw');
  assert.equal(s.charges, 2);
  assert.ok(throwSpots(room, s.p, false).includes(3));
  const launched = turn(room, s, toss(1, 3));
  assert.equal(launched.state.p, s.p);
  assert.equal(launched.state.bag, 0);
  assert.equal(launched.state.life, 2);
  assert.equal(launched.state.charges, 1);
  const inView = fixture(['S.aDE'], { patrol: 'W:w' }),
    caught = turn(inView, begin(inView), toss(1, 3));
  assert.ok(caught.events.includes('seen'));
  assert.equal(caught.state.guards[0].to, 0);
});
test('a fresh nearby sound interrupts a search and stable equidistant action selection repeats exactly', () => {
  const r = fixture(['S.....', '....aD', '.....E'], { patrol: 'E:e' }),
    s = begin(r);
  s.guards[0] = { ...s.guards[0], to: 0, linger: 2 };
  const first = turn(r, s, toss(1, 3));
  assert.ok(first.events.includes('interrupt'));
  assert.equal(first.state.guards[0].to, 3);
  assert.deepEqual(first, turn(r, s, toss(1, 3)));
  assert.equal(s.guards[0].to, 0);
});
test('the hood masks an active camera only when crouched; waiting advances one clock tick and noise never opens a door', () => {
  const r = fixture(['Sm.CD', 'a...E'], { patrol: 'S:s', pattern: [3, 3, 3, 3] }),
    s = begin(r);
  let q = { ...s, p: 1 };
  assert.ok(turn(r, q, 'Z').state.pose);
  assert.equal(turn(r, q, 'Z').events.includes('camera'), false);
  const seen = turn(r, s, 'E');
  assert.ok(seen.events.includes('camera'));
  assert.equal(seen.state.phase, 1);
  assert.equal(lens(r, r.cameras[0], 1), 3);
  assert.ok(cone(r, r.cameras[0].p, 3, false).has(1));
});
test('one warning can be escaped, two sightings or contact end the attempt, and all state is immutable', () => {
  const room = fixture(['S.aDE', '.....'], { patrol: 'W:w' }),
    s = begin(room),
    before = structuredClone(s);
  const first = turn(room, s, 'Z');
  assert.equal(first.state.heat, 1);
  assert.deepEqual(s, before);
  const repeat = turn(room, first.state, 'Z');
  assert.equal(repeat.state.caught, true);
  assert.equal(turn(room, repeat.state, 'E').fault, 'caught');
  const contact = turn(room, { ...s, p: 1 }, 'E');
  assert.equal(contact.state.caught, true);
});
test('stars, four-case wing opening, tape collectibles, optional scraps and independent dated scores persist together', () => {
  const sav = store();
  assert.equal(unlocked(notebook(sav.read()), rooms[6]), false);
  for (const room of rooms.slice(0, 4))
    keep(sav, 'campaign', room, 7, { stars: 3, turns: 7, route: ['Z'], fragment: false });
  assert.ok(unlocked(notebook(sav.read()), rooms[6]));
  keep(sav, 'campaign', rooms[0], 8, { stars: 1, turns: 30, route: [], fragment: true });
  assert.equal(notebook(sav.read()).cases[1].turns, 7);
  assert.ok(notebook(sav.read()).cases[1].fragment);
  assert.equal(sav.read().other, 9);
  for (const room of rooms.slice(4, 6))
    keep(sav, 'campaign', room, 7, { stars: 2, turns: 10, route: [], fragment: false });
  assert.deepEqual(labels(notebook(sav.read())), ['Foyer brass']);
  keep(sav, 'daily', rooms[0], 20261119, { stars: 3, turns: 7, route: ['Z'] });
  assert.equal(notebook(sav.read()).dailies[20261119].stars, 3);
  assert.deepEqual([starCount(7, 7, 0), starCount(8, 7, 0), starCount(7, 7, 1)], [3, 2, 1]);
});
test('normal input owns the clock, Escape cancels targeting, undo restores the whole beat and a complete first case makes a nonzero card', () => {
  const g = playing();
  for (let i = 0; i < 3600; i++) g.model.update(1 / 60);
  assert.equal(g.h[3], '0 / 7');
  g.key('Space');
  g.key('KeyT');
  assert.ok(cancelAimOnEscape());
  assert.equal(g.h[3], '1 / 7');
  g.press('aim');
  g.press('throw');
  g.key('KeyZ');
  assert.equal(g.h[3], '1 / 7');
  g.press('aim');
  g.press('throw');
  g.key('ArrowRight');
  g.key('ArrowRight');
  g.press('S');
  g.press('E');
  g.press('S');
  assert.equal(g.h[3], '7 / 7');
  g.press('ghost');
  g.press('journal');
  g.press('back');
  g.press('file');
  assert.equal(g.result[0], 1036);
  g.model.dispose();
  assert.equal(cancelAimOnEscape(), false);
});
test('native gesture cancellation, touch movement, independent demo and stage projection work without advancing phantom beats', () => {
  const g = playing();
  g.model.pointer('down', 10, 10, 360, 400);
  g.model.pointer('cancel', 50, 50, 360, 400);
  g.model.pointer('up', 90, 10, 360, 400);
  assert.equal(g.h[3], '0 / 7');
  g.model.pointer('down', 30, 30, 360, 400);
  g.model.pointer('up', 30, 95, 360, 400);
  assert.equal(g.h[3], '1 / 7');
  const demo = playing({ demo: true });
  for (let i = 0; i < 2000 && !demo.result; i++) {
    demo.model.demo(1 / 120);
    demo.model.update(1 / 120);
  }
  assert.ok(demo.result[0] > 0);
  assert.deepEqual(demo.store.read(), { other: 9 });
  for (const [w, h] of [
    [360, 370],
    [680, 276],
    [884, 901],
    [1440, 700],
    [2560, 1120],
  ])
    for (const r of rooms) {
      const b = layout(w, h, r);
      for (let p = 0; p < r.tiles.length; p++) {
        const [x, y] = b.pt((p % r.w) + 0.5, Math.floor(p / r.w) + 0.5);
        assert.equal(b.tile(x, y), p);
        assert.ok(x > 0 && x < b.playW && y > b.head && y < h - b.foot);
      }
    }
});
test('every Film Noir profile consumes precisely three alerts through actual sentries and all named sound/voice actions exist', () => {
  for (const persona of ['newcomer', 'regular', 'expert']) {
    const visit = contractRun(18, persona);
    assert.equal(visit.alerts, 3);
    assert.ok(visit.turns >= 3);
  }
  assert.deepEqual(campaignRun(rooms[1], 'regular', 7), campaignRun(rooms[1], 'regular', 7));
  assert.ok(Object.keys(colors).length >= 15);
  assert.equal(Object.keys(lines).length, 34);
});
