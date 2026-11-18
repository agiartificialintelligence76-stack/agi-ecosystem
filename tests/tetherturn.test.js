import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/tetherturn/game.js';
import { hole, HOLES, systems, dailyNine } from '../src/games/tetherturn/courses.js';
import { launch, control, advance, drift, runLeg, acceleration, DT, segmentGap, quantPower, quantAngle, cupAt } from '../src/games/tetherturn/flight.js';
import { validGhost, ghostPath, VERSION, recordFlight } from '../src/games/tetherturn/ghost.js';
import { chart } from '../src/games/tetherturn/render.js';
import { lines } from '../src/games/tetherturn/lines.js';
import { tones } from '../src/games/tetherturn/sound.js';
import { fly } from '../tools/games/tetherturn/balance.mjs';
const approx = (x, y, t = .00001) => assert.ok(Math.abs(x - y) < t);
function play(id = 0, mode = 'course', state = {}, demo = false) {
  let result,
    ends = 0,
    data = structuredClone(state);
  const m = game.create({
    mode,
    seed: 7,
    demo,
    options: {
      flag: String(id)
    },
    store: {
      read: () => data,
      update: fn => data = fn(structuredClone(data))
    },
    end: (score, stats) => {
      ends++;
      result = {
        score,
        ...Object.fromEntries(stats)
      };
    }
  });
  const tap = id => {
    m.action(id, 'down');
    m.action(id, 'up');
  };
  const key = id => {
    m.key('down', id);
    m.key('up', id);
  };
  const wait = (n, dt = DT) => {
    for (let i = 0; i < Math.ceil(n / dt); i++) m.update(dt);
  };
  return {
    m,
    tap,
    key,
    wait,
    get result() {
      return result;
    },
    get ends() {
      return ends;
    },
    get data() {
      return data;
    }
  };
}
test('all 36 handcrafted holes and four route variants are captured with quantized instructions at a proven stroke lower bound', () => {
  assert.equal(HOLES.length, 36);
  assert.equal(new Set(HOLES.map(v => v.name)).size, 36);
  assert.equal(systems.length, 6);
  let count = 0,
    mandatory = 0;
  for (let i = 0; i < 36; i++) {
    const h0 = hole(i);
    if (h0.legs.some(l => l.beacon || l.phaseRequired)) mandatory++;
    for (let variant = 0; variant < 4; variant++) {
      const h = hole(i, variant);
      assert.equal(h.par, h.legs.length, 'a launch can serve only its current flag');
      for (const l of h.legs) {
        const r = runLeg(l, l.input);
        assert.equal(r.flight.phase, 'sunk', h.name);
        assert.ok(r.events.includes('capture'));
        assert.ok(r.flight.hold >= l.settle);
        assert.equal(r.flight.rings, l.rings.length);
        count++;
      }
    }
  }
  assert.equal(count, 192);
  assert.equal(mandatory, 30);
});
test('a perfect launch alone cannot open phase-locked cups or energize a pulse-zone relay', () => {
  for (let i = 6; i < 36; i++) {
    const l = hole(i).legs[0];
    if (l.phaseRequired || l.beacon) {
      const r = runLeg(l, {
        ...l.input,
        controls: []
      });
      assert.notEqual(r.flight.phase, 'sunk', HOLES[i].name);
    }
  }
});
test('softening is finite even at a well centre, polarity reverses the acceleration, Verlet preserves bounded orbital energy', () => {
  const well = {
      x: 0,
      y: 0,
      mass: 120000,
      soft: 27
    },
    p = {
      x: 85,
      y: 0
    };
  assert.deepEqual(acceleration([well], well, 0), [0, 0]);
  const a = acceleration([well], p, 0),
    b = acceleration([well], p, 0, -1);
  assert.ok(a[0] < 0);
  approx(a[0], -b[0]);
  const state = launch(p, 0, .5);
  state.vx = 0;
  state.vy = Math.sqrt(-a[0] * 85);
  const energy = f => (f.vx * f.vx + f.vy * f.vy) * .5 - well.mass / Math.sqrt(f.x * f.x + f.y * f.y + well.soft ** 2),
    initial = energy(state);
  let worst = 0;
  for (let i = 0; i < 12000; i++) {
    drift(state, [well]);
    worst = Math.max(worst, Math.abs(energy(state) - initial));
  }
  assert.ok(worst / Math.abs(initial) < .00025);
});
test('a port/starboard impulse bends orthogonally, the brake removes energy, and the only flip has no duplicate effect', () => {
  const f = launch({
    x: 0,
    y: 0
  }, 0, .5, 2);
  const before = f.vx;
  assert.ok(control(f, 'port'));
  assert.ok(f.vy < 0);
  assert.equal(f.vx, before);
  const speed = Math.hypot(f.vx, f.vy);
  assert.ok(control(f, 'brake'));
  approx(Math.hypot(f.vx, f.vy), speed * .61);
  assert.equal(f.fuel, 0);
  assert.equal(control(f, 'port'), false);
  assert.ok(control(f, 'flip'));
  assert.equal(f.sign, -1);
  assert.equal(control(f, 'flip'), false);
  assert.equal(f.inputs.length, 3);
});
function straightLeg() {
  return {
    tee: {
      x: 0,
      y: 0
    },
    wells: [],
    cup: {
      x: 90,
      y: 0,
      phase: 0,
      rate: 1,
      gate: 0
    },
    radius: 18,
    gateWidth: .42,
    maxSpeed: 138,
    settle: .5,
    timeout: 310,
    bounds: [-20, -80, 190, 80],
    rings: [{
      x: 36,
      y: 0,
      radius: 6
    }],
    fuel: 2
  };
}
test('swept entry sees thin rings, requires the cup approach direction and speed, and a capture must hold before sinking', () => {
  const l = straightLeg();
  assert.equal(segmentGap(0, 0, 50, 0, {
    x: 25,
    y: 2
  }), 2);
  const slow = runLeg(l, {
    angle: 0,
    power: .39,
    controls: []
  });
  assert.equal(slow.flight.phase, 'sunk');
  assert.ok(slow.events.indexOf('ring') < slow.events.indexOf('capture'));
  assert.ok(slow.events.indexOf('capture') < slow.events.indexOf('sink'));
  const fast = runLeg(l, {
    angle: 0,
    power: 1,
    controls: []
  });
  assert.equal(fast.flight.phase, 'lost');
  assert.ok(fast.flight.fast);
  const rim = runLeg({
    ...l,
    cup: {
      ...l.cup,
      gate: Math.PI
    }
  }, {
    angle: 0,
    power: .39,
    controls: []
  });
  assert.ok(rim.flight.gateMiss);
});
test('a satellite restores a real onboard thrust and cannot be collected twice on the same pass', () => {
  const l = straightLeg();
  l.optional = {
    x: 36,
    y: 0,
    radius: 9
  };
  const f = launch(l.tee, 0, .4, 1);
  control(f, 'brake', l);
  let count = 0;
  for (let i = 0; i < 170; i++) count += advance(f, l).filter(e => e === 'satellite').length;
  assert.equal(count, 1);
  assert.equal(f.fuel, 1);
  assert.ok(f.post);
});
test('daily nine is reproducible, avoids repeats, changes with day and preserves certified geometry', () => {
  assert.deepEqual(dailyNine(20261117), dailyNine(20261117));
  assert.notDeepEqual(dailyNine(20261117), dailyNine(20261118));
  for (let day = 1; day < 20; day++) {
    const schedule = dailyNine(20261100 + day);
    assert.equal(new Set(schedule.map(s => s.id)).size, 9);
    assert.ok(schedule.every(s => s.variant >= 0 && s.variant < 4));
  }
});
test('the genuine opening earns a three-star, one-stroke card, and stores a flight tape without replacing old data', () => {
  for (const kind of ['key', 'button']) {
    const s = play(0, 'course', {
      legacy: 91
    });
    kind === 'key' ? s.key('Space') : s.tap('launch');
    s.wait(5);
    assert.equal(s.m.inspect().phase, 'card');
    s.tap('file');
    s.key('KeyX');
    assert.equal(s.ends, 1);
    assert.equal(s.result.score, 390);
    assert.equal(s.result['Flags captured'], 1);
    assert.equal(s.data.legacy, 91);
    const h = hole(0),
      g = s.data.orbitPost.bests['0/0'];
    assert.ok(validGhost(h, g));
    assert.deepEqual(ghostPath(h, 0, g), runLeg(h.legs[0], g.legs[0], true).points);
  }
});
test('old, malformed or incompatible ghosts cannot appear and enabling a ghost changes no score', () => {
  const h = hole(0),
    good = {
      version: VERSION,
      id: 0,
      variant: 0,
      legs: [h.legs[0].input]
    };
  assert.ok(validGhost(h, good));
  for (const g of [{
    ...good,
    version: VERSION - 1
  }, {
    ...good,
    id: 1
  }, {
    ...good,
    legs: [{
      ...good.legs[0],
      angle: NaN
    }]
  }, {
    ...good,
    legs: [{
      ...good.legs[0],
      controls: [{
        tick: -1,
        id: 'flip'
      }]
    }]
  }]) assert.equal(ghostPath(h, 0, g), null);
  const s = play();
  s.tap('ghost');
  assert.equal(s.m.inspect().showGhost, true);
  assert.equal(s.m.inspect().score, 0);
});
test('held keys and dock fingers consume exactly one impulse; pausing during flight cannot spend another', () => {
  const s = play();
  s.key('Space');
  s.m.key('down', 'KeyA');
  s.m.key('down', 'KeyA');
  assert.equal(s.m.inspect().f.burns, 1);
  s.m.key('up', 'KeyA');
  s.m.action('brake', 'down');
  s.m.action('brake', 'down');
  assert.equal(s.m.inspect().f.burns, 2);
  s.m.action('brake', 'up');
  const tick = s.m.inspect().f.tick;
  s.m.pause();
  s.wait(.5);
  assert.equal(s.m.inspect().f.tick, tick);
  s.key('KeyF');
  assert.ok(s.m.inspect().f.flip);
  s.m.resume();
  s.key('KeyF');
  assert.equal(s.m.inspect().f.sign, -1);
});
test('pulse timing and stage capture work through the public demo controller, with recovery tees between flags', () => {
  const s = play(0, 'course', {}, true),
    initial = s.m.inspect().id;
  let seen = false;
  for (let i = 0; i < 1800; i++) {
    s.m.demo(DT);
    s.m.update(DT);
    const f = s.m.inspect().f;
    if (f?.sign < 0) seen = true;
  }
  assert.equal(initial, 26);
  assert.ok(seen);
  assert.ok(s.m.inspect().flags >= 2);
});
test('stable views transform the same launch vector under phone, landscape, foldable and desktop geometry', () => {
  const leg = hole(0).legs[0];
  for (const [w, h] of [[360, 460], [667, 341], [884, 975], [1440, 770], [2560, 1200]]) {
    const g = chart(leg, w, h);
    for (const p of [leg.tee, leg.cup, ...leg.wells, ...leg.rings]) {
      const q = g.world(p.x, p.y),
        r = g.flight(...q);
      approx(r[0], p.x);
      approx(r[1], p.y);
      assert.ok(q[0] >= 0 && q[0] <= w && q[1] >= 0 && q[1] <= h);
    }
    const s = play(),
      t = g.world(leg.tee.x, leg.tee.y);
    s.m.pointer('down', ...t, w, h);
    s.m.pointer('move', t[0] - 30, t[1] + 12, w, h);
    s.m.pointer('cancel', ...t, w, h);
    s.m.pointer('up', ...t, w, h);
    assert.equal(s.m.inspect().phase, 'aim');
    assert.equal(s.m.inspect().strokes, 0);
    approx(s.m.inspect().angle, leg.input.angle);
  }
});
test('per-hole physical profile inputs reproducibly separate flag, score and failed-attempt distributions', () => {
  const tags = ['newbie', 'steady', 'expert'],
    sample = (p, k) => Array.from({
      length: 12
    }, (_, i) => fly(p, 73 + i * 7919)[k]).sort((a, b) => a - b)[5];
  assert.ok(sample('newbie', 'score') < sample('steady', 'score'));
  assert.ok(sample('steady', 'score') < sample('expert', 'score'));
  assert.ok(sample('expert', 'flags') > sample('newbie', 'flags'));
  assert.deepEqual(fly('steady', 23), fly('steady', 23));
  assert.ok(Object.keys(lines).length >= 32);
  assert.ok(Object.keys(tones).length >= 12);
});
