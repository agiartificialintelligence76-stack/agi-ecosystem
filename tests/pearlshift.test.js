import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game from '../src/games/pearlshift/game.js';
import { SPECIES, REGIONS, SHIFTS } from '../src/games/pearlshift/catalog.js';
import { hearing, position, crossBearings, bestFix } from '../src/games/pearlshift/acoustics.js';
import { createSurvey, ping, move, tune, depth, broadcast, finish, step, drain, abandon } from '../src/games/pearlshift/rules.js';
import { simulate } from '../src/games/pearlshift/ai.js';
import { logBook, persist } from '../src/games/pearlshift/progress.js';
import { layout, project, unproject } from '../src/games/pearlshift/layout.js';
import { stationSound } from '../src/games/pearlshift/sound.js';
import { LINES } from '../src/games/pearlshift/lines.js';
const tick = (s, t = 1) => {
  for (let i = 0; i < Math.round(t * 60); i++) step(s, 1 / 60);
};
const ray = (x, y, target) => ({
  x,
  y,
  theta: Math.atan2(target.y - y, target.x - x),
  species: 0,
  depth: 0,
  time: 0
});
test('twelve original audio signatures and 32 watches have explicit learning goals and different physical constraints', () => {
  assert.equal(SPECIES.length, 12);
  assert.equal(new Set(SPECIES.map(f => f.hz + '/' + f.notes.join() + f.beats.join())).size, 12);
  for (const fish of SPECIES) {
    assert.equal(fish.notes.length, fish.beats.length);
    assert.ok(fish.beats.every((v, i) => i === 0 || v > fish.beats[i - 1]));
  }
  assert.equal(REGIONS.length, 8);
  assert.equal(SHIFTS.length, 32);
  assert.equal(REGIONS.at(-1).voices, 4);
  assert.ok(REGIONS.at(-1).speed > 0);
});
test('two bearing rays solve a planar fix and reject parallel, reversed and nearly colocated receivers', () => {
  const t = {
      x: .65,
      y: .42
    },
    a = ray(.18, .8, t),
    b = ray(.82, .82, t),
    f = crossBearings(a, b);
  assert.ok(Math.hypot(f.x - t.x, f.y - t.y) < 1e-7);
  assert.equal(crossBearings(a, {
    ...a,
    x: a.x + .2
  }), null);
  assert.equal(crossBearings(a, {
    ...a,
    x: a.x + .002
  }), null);
  assert.equal(crossBearings(a, {
    ...b,
    theta: b.theta + Math.PI
  }), null);
  assert.equal(bestFix([a, {
    ...b,
    depth: 1
  }], 0), null);
  assert.equal(bestFix([a, {
    ...b,
    species: 2
  }], 0), null);
});
test('one free opening bearing teaches the first fix, and repeated pings from the same spot preserve the budget', () => {
  const s = createSurvey();
  assert.equal(s.samples.length, 1);
  assert.equal(s.spent, 0);
  const budget = s.budget;
  tick(s, .4);
  assert.equal(ping(s), false);
  assert.equal(s.budget, budget);
  move(s, .78, .73);
  assert.equal(ping(s), true);
  const fix = bestFix(s.samples, 0);
  move(s, fix.x, fix.y);
  assert.equal(broadcast(s), true);
  assert.equal(s.total, 1);
  assert.equal(s.spent, 1);
  assert.equal(broadcast(s), false);
});
test('moving sources change position; correct receiver depth restores the real bearing, level, pan and bandwidth', () => {
  const fish = {
    species: 1,
    x: .60,
    y: .48,
    ax: .05,
    ay: .03,
    speed: .2,
    phase: 0,
    depth: 2
  };
  const recv = {
      x: .2,
      y: .62,
      depth: 0
    },
    r = REGIONS.at(-1),
    weak = hearing(recv, fish, 1, r),
    clear = hearing({
      ...recv,
      depth: 2
    }, fish, 1, r);
  assert.ok(weak.filter < clear.filter && weak.strength < clear.strength);
  assert.ok(Math.abs(clear.theta - weak.theta) > .2);
  assert.ok(clear.pan > 0);
  assert.notDeepEqual(position(fish, 0), position(fish, 10));
  assert.ok(hearing({
    ...recv,
    x: .91,
    depth: 2
  }, fish, 1, r).pan < 0);
});
test('a multilayer chorus requires concentration on the requested species, an actual fix and the matching source layer', () => {
  const s = createSurvey({
    start: 31,
    seed: 39
  });
  assert.ok(s.fish.length >= 3);
  const target = s.fish.find(f => f.species === s.request);
  while (s.tuned === s.request) tune(s);
  assert.equal(broadcast(s), false);
  assert.ok(drain(s).some(e => e.reason === 'voice'));
  while (s.tuned !== s.request) tune(s);
  while (s.receiver.depth !== target.depth) depth(s);
  assert.equal(broadcast(s), false);
  assert.ok(drain(s).some(e => e.reason === 'baseline'));
  move(s, .25, .74);
  ping(s);
  tick(s, .4);
  move(s, .79, .8);
  ping(s);
  const f = bestFix(s.samples, s.request);
  assert.ok(f);
  move(s, f.x, f.y);
  assert.equal(broadcast(s), true);
});
test('budget, damaged saves and Daily Water isolate each observation and keep local records', () => {
  const s = createSurvey({
    mode: 'daily',
    seed: 20261118
  });
  const b = createSurvey({
    mode: 'daily',
    seed: 20261118
  });
  assert.deepEqual(s.fish, b.fish);
  assert.ok(new Set(Array.from({
    length: 20
  }, (_, i) => JSON.stringify(createSurvey({
    mode: 'daily',
    seed: 20261101 + i
  }).fish))).size > 16);
  s.budget = 0;
  assert.equal(ping(s), false);
  abandon(s);
  tick(s, .6);
  assert.equal(s.phase, 'scan');
  const old = {
    vintageBest: 45,
    hydrophoneLog: {
      records: {
        0: {
          finds: -4
        }
      },
      stations: -1
    }
  };
  s.archive.push({
    species: 2,
    pings: 3,
    exact: true,
    region: 4
  });
  let d = persist(old, s, 'find');
  s.archive.push({
    species: 2,
    pings: 2,
    exact: true,
    region: 4
  });
  d = persist(d, s, 'find');
  assert.equal(d.vintageBest, 45);
  assert.deepEqual(logBook(d).records[2], {
    finds: 2,
    best: 2,
    exact: 2,
    region: 4
  });
});
test('night shift loses battery on a poor broadcast and closes exactly once at zero', () => {
  const s = createSurvey({
      mode: 'night'
    }),
    start = s.battery;
  broadcast(s);
  assert.ok(s.battery < start);
  s.battery = .1;
  tick(s, .3);
  finish(s);
  assert.equal(drain(s).filter(e => e.type === 'end').length, 1);
});
test('swimming gestures correctly invert landscape, square, phone and foldable charts; action dock and arrow moves both file a song', () => {
  for (const [w, h] of [[360, 399], [640, 274], [884, 966], [1440, 810], [2560, 1290]]) {
    const r = layout(w, h).chart,
      [x, y] = project(r, .64, .39),
      p = unproject(r, x, y);
    assert.ok(Math.hypot(p[0] - .64, p[1] - .39) < 1e-7);
    assert.equal(unproject(r, -1, 0), null);
  }
  for (const input of ['touch', 'keys']) {
    let result;
    const m = game.create({
      seed: 7,
      hud() {},
      end: (p, stats) => {
        result = Object.fromEntries(stats);
      }
    });
    const advance = n => {
      for (let i = 0; i < Math.round(n * 120); i++) m.update(1 / 120);
    };
    advance(.6);
    if (input === 'touch') {
      const r = layout(380, 440).chart;
      const point = (x, y) => {
        const p = project(r, x, y);
        m.pointer('down', ...p, 380, 440);
        m.pointer('up', ...p, 380, 440);
      };
      point(.78, .75);
      m.action('ping', 'down');
      point(.69, .42);
      m.action('broadcast', 'down');
      m.action('file', 'down');
    } else {
      const travel = (code, time) => {
        m.key('down', code);
        advance(time);
        m.key('up', code);
      };
      travel('ArrowRight', (.78 - .25) / .31);
      m.key('down', 'KeyE');
      m.key('up', 'KeyE');
      travel('ArrowLeft', (.78 - .69) / .31);
      travel('ArrowUp', (.72 - .42) / .31);
      m.key('down', 'Space');
      m.key('up', 'Space');
      m.key('down', 'KeyX');
    }
    assert.equal(result['Songs filed'], 1);
  }
});
test('the calm voyage lasts beyond twenty minutes and experts can reach every region', () => {
  const a = simulate('expert', 23, 'calm', 6500);
  assert.equal(a.region, 7);
  assert.ok(a.finds >= 110);
  assert.ok(a.time >= 1200 && a.time < 6500);
});
test('night shift skill changes duration, accuracy and score on the same seeds', () => {
  const a = ['newbie', 'steady', 'expert'].map(p => Array.from({
    length: 17
  }, (_, i) => simulate(p, i * 7919 + 23)).sort((x, y) => x.time - y.time)[8]);
  assert.ok(a[0].time > 45);
  assert.ok(a[1].time > 120 && a[1].time < 300);
  assert.ok(a[2].time > a[1].time * 1.12);
  assert.ok(a[2].finds > a[1].finds && a[1].finds > a[0].finds);
  assert.ok(a[2].score > a[1].score);
});
test('audio, visual equivalents, contextual scripts and pure deterministic rules work without a browser', () => {
  const kit = stationSound(null);
  kit.chorus([], 0);
  kit.archive(0);
  kit.stop();
  assert.equal(Object.values(LINES).flat().length, 32);
  for (const line of Object.values(LINES).flat()) assert.equal(line, line.toLowerCase());
  assert.ok(SPECIES.every(f => f.color && f.shape));
  assert.doesNotMatch(fs.readFileSync(new URL('../src/games/pearlshift/rules.js', import.meta.url), 'utf8'), /Math\.random|document\.|performance\./);
});
