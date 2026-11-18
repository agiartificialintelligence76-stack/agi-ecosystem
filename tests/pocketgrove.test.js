import test from 'node:test';
import assert from 'node:assert/strict';
import { issue, solve, arrive, departures, feasible, startState, home, waitForTrain, retainPlan, clock, walk } from '../src/games/pocketgrove/timetable.js';
import { NIGHTS, cityForWeek } from '../src/games/pocketgrove/cities.js';
import { choose, takeView, journal, journalPages, parTimes, keep, bill, simulate } from '../src/games/pocketgrove/journal.js';
import { tones } from '../src/games/pocketgrove/sound.js';
import { lines } from '../src/games/pocketgrove/lines.js';
import game from '../src/games/pocketgrove/game.js';
test('all fifteen authored nights and their 32 seeded schedules allow both wishes, the star and a lawful last ride', () => {
  for (const night of NIGHTS) for (let seed = 1; seed <= 32; seed++) {
    const b = issue(night.id, seed),
      path = solve(b, startState(), true);
    assert.ok(path?.length, night.name + ' ' + seed);
    const s = path.reduce((s, e) => {
      assert.ok(feasible(b, s, e));
      assert.ok(e.depart >= s.time);
      return arrive(b, s, e);
    }, startState());
    assert.ok(home(s) && s.star && s.time <= b.limit);
    assert.equal(s.time, path.at(-1).arrive);
  }
});
test('a local leaving earlier can reach the next station before the limited and a timetable includes final services', () => {
  const b = issue(0, 17);
  assert.ok(departures(b, startState()).some(e => e.depart === 0));
  assert.ok(b.edges.at(-1).arrive <= b.limit);
  const dep = departures(b, {
    ...startState(),
    time: b.limit
  });
  assert.deepEqual(dep, []);
  const next = waitForTrain(b, startState());
  assert.ok(next.time > 0);
  assert.ok(departures(b, next).every(e => e.depart >= next.time));
});
test('separate arrivals at a service change either side of the footbridge boundary', () => {
  const b = issue(10, 17),
    e = b.edges.find(e => e.line === 2 && e.depart > 8),
    gap = walk({
      line: 0
    }, e, b.night);
  const s = {
    ...startState(),
    station: e.from,
    line: 0,
    time: e.depart - gap
  };
  assert.equal(gap, 3);
  assert.ok(feasible(b, s, e));
  assert.ok(!feasible(b, {
    ...s,
    time: s.time + 1
  }, e));
});
test('only a valid boarding consumes a pass, which follows the same train for its continuing stops', () => {
  const b = issue(0, 7),
    e = b.edges.find(e => e.line === 3 && e.from === 0),
    s = startState();
  assert.ok(!arrive(b, {
    ...s,
    time: e.depart + 1
  }, e));
  assert.equal(s.pass, 1);
  const on = arrive(b, s, e);
  assert.equal(on.pass, 0);
  const next = b.edges.find(f => f.trip === e.trip && f.from === e.to);
  assert.ok(feasible(b, on, next));
  const later = b.edges.find(f => f.express && f.from === e.to && f.trip !== e.trip && f.depart > on.time);
  assert.ok(later);
  assert.ok(!feasible(b, on, later));
});
test('midnight is displayed on an elapsed service day and a new calendar week selects a new city', () => {
  assert.equal(clock(1439), '23:59');
  assert.equal(clock(1440), '00:00 +1');
  const sunday = Date.UTC(2026, 10, 15, 23),
    monday = Date.UTC(2026, 10, 16);
  assert.notEqual(cityForWeek(sunday), cityForWeek(monday));
  assert.equal(choose('daily', null, 20261118, {}, 0), choose('daily', null, 20261118, {}, Date.UTC(2033, 8, 8)));
});
test('an impossible middle pin trims the invalid suffix and a legal pin is unchanged', () => {
  const b = issue(8, 7),
    path = solve(b);
  assert.deepEqual(retainPlan(b, startState(), path.slice(0, 3)).kept, path.slice(0, 3));
  assert.deepEqual(retainPlan(b, startState(), [path[0], {
    ...path[1],
    depart: -1
  }, path[2]]).kept, [path[0]]);
});
test('a stamp depends on car side and time, is filed only once and has no device-specific coordinates', () => {
  const b = issue(0, 2),
    e = b.edges[0],
    album = new Set();
  assert.equal(takeView(b, e, e.side, .29, album), false);
  assert.equal(takeView(b, e, e.side === 'left' ? 'right' : 'left', .4, album), false);
  assert.ok(takeView(b, e, e.side, .5, album));
  assert.equal(takeView(b, e, e.side, .52, album), false);
  assert.equal(album.size, 1);
});
test('wishes are punched only when the train actually reaches the stop during its opening hours', () => {
  const b = issue(0, 7),
    e = b.edges[0];
  b.wishes = [{
    stop: e.to,
    from: e.arrive + 1,
    until: 100
  }, {
    stop: e.to,
    from: 0,
    until: e.arrive
  }];
  assert.equal(arrive(b, startState(), e).mask, 2);
});
test('a recovered journal preserves high seals, best earliest arrival, unlocked cities and a bounded recent daily list', () => {
  const b = issue(0, 7),
    s = solve(b, startState(), true).reduce((v, e) => arrive(b, v, e), startState());
  const form = bill(b, s, new Set(['7/right']), 6, s.time);
  const a = keep({
      older: 'ok'
    }, form),
    again = keep(a, {
      ...form,
      stars: 1,
      arrival: 200
    });
  assert.equal(again.older, 'ok');
  assert.equal(journal(again).records[0].stars, 3);
  assert.equal(journal(again).records[0].arrival, s.time);
  assert.equal(choose('journal', '8', 7, again), 1);
  const signed = keep(again, {
    ...form,
    id: 1
  });
  assert.equal(choose('journal', '4', 7, signed), 4);
  assert.deepEqual(journal({
    windowSeat: {
      nights: null,
      views: 'old'
    }
  }).views, []);
  let d = signed;
  for (let i = 1; i < 40; i++) d = keep(d, {
    ...form,
    mode: 'daily',
    seed: 20261000 + i
  });
  assert.equal(Object.keys(journal(d).daily).length, 31);
});
test('earliest-return search agrees with exhaustive timetable walk on a five-train interchange', () => {
  const base = issue(0),
    edge = (id, from, to, depart, arrive, line) => ({
      id,
      from,
      to,
      depart,
      arrive,
      line,
      trip: id,
      express: false
    });
  const edges = [edge('direct', 0, 2, 5, 10, 1), edge('early', 0, 1, 0, 3, 0), edge('conn', 1, 2, 4, 7, 0), edge('back', 2, 0, 9, 13, 2), edge('late', 2, 0, 14, 18, 1)];
  const b = {
    ...base,
    edges: [...edges].sort((a, b) => a.depart - b.depart),
    wishes: [{
      stop: 1,
      from: 0,
      until: 20
    }, {
      stop: 2,
      from: 0,
      until: 20
    }],
    limit: 30
  };
  const viable = [];
  function walkAll(s) {
    if (home(s)) viable.push(s.time);else for (const e of edges) {
      const next = arrive(b, s, e);
      if (next) walkAll(next);
    }
  }
  walkAll(startState());
  assert.equal(solve(b).at(-1).arrive, Math.min(...viable));
});
function session(seed = 7) {
  let saved = {},
    result = null,
    hud,
    calls = 0;
  const m = game.create({
    seed,
    mode: 'journal',
    hud: (...h) => hud = h,
    say() {},
    end(score, rows) {
      calls++;
      result = {
        score,
        rows: Object.fromEntries(rows)
      };
    },
    store: {
      read: () => saved,
      update: fn => saved = fn(saved)
    }
  });
  return {
    m,
    get saved() {
      return saved;
    },
    get result() {
      return result;
    },
    get calls() {
      return calls;
    },
    get hud() {
      return hud;
    },
    key(k) {
      m.key('down', k);
      m.key('up', k);
    }
  };
}
test('normal keyboard, desk actions and a mid-ride pause produce a real filed night and a replayable first wish', () => {
  for (const control of ['keys', 'pads']) {
    const g = session();
    if (control === 'keys') g.key('Enter');else g.m.action('board', 'down');
    g.m.pause();
    for (let i = 0; i < 1500; i++) g.m.update(1 / 60);
    g.m.resume();
    assert.equal(g.hud[1], '0/2');
    g.key('KeyV');
    assert.equal(g.hud[1], '1/2');
    g.key('KeyF');
    g.key('KeyF');
    assert.equal(g.calls, 1);
    assert.ok(g.result.score >= 180);
    assert.equal(g.result.rows.Wishes, '1 / 2');
    assert.ok(g.saved.windowSeat);
    assert.deepEqual(g.saved.windowSeat.nights, {});
  }
});
test('the real demo finishes a lawful tour and the same seed reproduces scoring, hints and views', () => {
  function preview() {
    const g = session();
    for (let i = 0; i < 36000 && !g.result; i++) {
      g.m.demo(1 / 60);
      g.m.update(1 / 60);
    }
    return g.result;
  }
  assert.ok(preview().score > 500);
  assert.deepEqual(preview(), preview());
  const first = simulate(14, 37, 'expert');
  assert.ok(first.done);
  assert.deepEqual(first, simulate(14, 37, 'expert'));
});
test('responsive travel UI uses real controls, unique lowercase travel notes and specific station cues', () => {
  assert.ok(game.controls.some(p => p.id === 'board'));
  assert.equal(game.modes.length, 3);
  assert.ok(Object.keys(lines).length >= 30);
  assert.ok(Object.values(lines).every(s => s === s.toLowerCase()));
  assert.equal(new Set(Object.values(lines)).size, Object.keys(lines).length);
  assert.ok(Object.keys(tones).length >= 16);
});
test('the print drawer keeps named landmarks, fastest postcard backs and visited neighborhoods', () => {
  const first = {
    id: 0,
    mode: 'journal',
    seed: 7,
    stars: 2,
    score: 1100,
    arrival: 37,
    back: 'the lantern caught the last train.',
    views: ['0/1/left'],
    stops: ['0/0', '0/1']
  };
  const saved = keep({}, first),
    pages = journalPages(saved);
  assert.deepEqual(journal(saved).stops, ['0/0', '0/1']);
  assert.equal(pages[0].detail, first.back);
  assert.equal(pages[1].title, 'bakery window');
  assert.match(pages[1].detail, /left window/);
});
test('pinning with I leaves a future boardable leg and playing it uses the first pinned train', () => {
  let pads = [];
  const m = game.create({
    seed: 7,
    hud() {},
    end() {},
    controls: v => pads = v
  });
  m.key('down', 'KeyI');
  assert.ok(pads.some(p => p.id === 'board' && p.label.includes('Crust Street')));
  m.action('board', 'down');
  assert.ok(pads.some(p => p.id === 'snap'));
  m.action('skip', 'down');
  assert.ok(pads.some(p => p.id === 'pin'));
});
test('all cities and nights have at least one reachable three-seal itinerary across 96 working schedules', () => {
  for (const n of NIGHTS) for (let seed = 1; seed <= 96; seed++) {
    const book = issue(n.id, seed),
      path = solve(book, startState(), true);
    const finish = path.reduce((s, e) => arrive(book, s, e), startState());
    assert.equal(bill(book, finish, new Set(), path.length, parTimes(book)).stars, 3, n.name);
  }
});
test('reading the journal cannot board or advance the platform clock with hidden shortcuts', () => {
  let controls = [];
  const m = game.create({
    seed: 5,
    hud() {},
    end() {},
    controls: r => controls = r
  });
  m.action('journal', 'down');
  const before = controls.map(x => x.id);
  m.key('down', 'Enter');
  m.key('down', 'KeyW');
  assert.deepEqual(controls.map(x => x.id), before);
  m.action('menu', 'down');
  assert.ok(controls.some(x => x.id === 'board'));
});
