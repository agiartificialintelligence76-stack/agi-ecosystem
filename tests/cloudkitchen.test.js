import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/cloudkitchen/game.js';
import { act, open, step, cancel, drain, recipe, cupCount, sealPhase, qualities, emptyCup, assign, MAX_FILL, STEP } from '../src/games/cloudkitchen/counter.js';
import { RECIPES, DAYS, schedule, toolsFor, dailyMenu } from '../src/games/cloudkitchen/menu.js';
import { notebook, record } from '../src/games/cloudkitchen/progress.js';
import { simulate, barista } from '../src/games/cloudkitchen/barista.js';
import { layout, ticketHit } from '../src/games/cloudkitchen/render.js';
import { voice } from '../src/games/cloudkitchen/lines.js';
import { percussive } from '../src/games/cloudkitchen/sound.js';
const approx = (a, b, n = .00001) => assert.ok(Math.abs(a - b) < n, a + ' ≠ ' + b);
function advance(s, secs, dt = STEP) {
  for (let n = 0; n < Math.round(secs / dt); n++) {
    step(s, dt);
    drain(s);
  }
}
function session(mode = 'week', storage = {}, options = {}, demo = false) {
  let done,
    count = 0,
    buttons,
    db = structuredClone(storage);
  const m = game.create({
    seed: 7,
    mode,
    options,
    demo,
    store: {
      read: () => db,
      update: fn => db = fn(structuredClone(db))
    },
    controls: v => buttons = v,
    end: (score, stats) => {
      done = {
        score,
        ...Object.fromEntries(stats)
      };
      count++;
    }
  });
  const tap = id => {
      m.action(id, 'down');
      m.action(id, 'up');
    },
    press = k => {
      m.key('down', k);
      m.key('up', k);
    };
  const wait = secs => {
    for (let n = 0; n < Math.round(secs / STEP); n++) m.update(STEP);
  };
  return {
    m,
    tap,
    press,
    wait,
    get done() {
      return done;
    },
    get count() {
      return count;
    },
    get buttons() {
      return buttons;
    },
    get data() {
      return db;
    }
  };
}
test('eight handmade shifts last more than 26 minutes and offer 24 individually reachable receipts with three authored rushes each', () => {
  assert.equal(DAYS.length, 8);
  assert.equal(RECIPES.length, 24);
  assert.equal(new Set(RECIPES.map(r => r.name)).size, 24);
  assert.ok(DAYS.reduce((a, d) => a + d.length, 0) > 26 * 60);
  for (let day = 0; day < 8; day++) {
    const s = schedule(day),
      g = toolsFor(day);
    assert.deepEqual([...new Set(s.map(t => t.wave))], [0, 1, 2, 3]);
    assert.ok(s.every((t, i) => !i || t.time >= s[i - 1].time));
    for (const item of s) {
      const r = RECIPES[item.recipe];
      assert.ok(r.day <= day && r.base < g.bases && r.tea + r.milk <= MAX_FILL);
      if (r.shake) assert.ok(g.shake);
      if (r.star) assert.ok(g.star);
      if (r.ice) assert.ok(g.ice);
    }
    if (day < 2) {
      const upper = s.reduce((sum, t) => {
        const r = RECIPES[t.recipe];
        return sum + r.tea / 1.48 + r.milk / 1.30 + r.pearl * .4 + r.shake * .33 + 1.4;
      }, 0);
      assert.ok(upper < DAYS[day].length * .85);
    }
  }
  for (const r of RECIPES) {
    const s = open(r.day, 'bench', 7, r.id),
      operator = barista('expert', 61);
    for (let i = 0; i < 2400 && s.phase === 'open'; i++) {
      operator.run(s, STEP);
      step(s);
      drain(s);
    }
    assert.equal(s.served, 1, r.name);
    assert.ok(s.receipt.quality > .83, r.name);
  }
});
test('tea and milk conserve liquid at multiple update rates, filled cups spill only the excess, and the trailing stream has a finite bound', () => {
  const fill = dt => {
    const s = open(2, 'bench', 7, 7);
    act(s, 'tea');
    act(s, 'milk');
    advance(s, 2, dt);
    cancel(s);
    const before = s.cups[0].tea;
    advance(s, 1, dt);
    assert.ok(s.cups[0].tea - before <= .149);
    approx(s.dispensed, s.cups[0].tea + s.cups[0].milk + s.spilled);
    return s;
  };
  const a = fill(1 / 30),
    b = fill(1 / 120);
  approx(a.cups[0].tea, b.cups[0].tea, .00003);
  approx(a.cups[0].milk, b.cups[0].milk, .00003);
  act(a, 'tea');
  act(a, 'milk');
  advance(a, 7);
  approx(a.cups[0].tea + a.cups[0].milk, MAX_FILL);
  assert.ok(a.spilled > 5);
  approx(a.dispensed, a.cups[0].tea + a.cups[0].milk + a.spilled, .00005);
});
test('switching cups never moves a held valve to the other cup, and cancel closes held, latched and shaker controls', () => {
  const s = open(5, 'week', 7);
  act(s, 'tea');
  advance(s, .4);
  act(s, 'switch');
  assert.equal(s.active, 1);
  act(s, 'milk');
  advance(s, .5);
  assert.ok(s.cups[0].tea > .9);
  assert.ok(s.cups[1].milk > .45);
  assert.equal(s.cups[1].tea, 0);
  assert.equal(s.cups[0].milk, 0);
  act(s, 'latch');
  cancel(s);
  assert.equal(s.held.size, 0);
  assert.ok(s.cups.every(c => !c.latch));
  advance(s, 1.5);
  assert.ok(s.cups.every(c => c.flow.every(f => f < .0001)));
});
test('toppings have identities, ice toggles, the shaker alternates and caps speed, and its ready rim uses bounded windows', () => {
  const s = open(4, 'bench', 7, 14),
    c = s.cups[0];
  c.tea = 3.5;
  c.milk = 1;
  act(s, 'pearl');
  act(s, 'star');
  act(s, 'ice');
  assert.deepEqual([c.pearl, c.star, c.ice], [1, 1, 1]);
  act(s, 'ice');
  assert.equal(c.ice, 0);
  act(s, 'left');
  act(s, 'right');
  assert.equal(c.shake, 1);
  advance(s, .21);
  act(s, 'left');
  assert.equal(c.shake, 1);
  act(s, 'right');
  assert.equal(c.shake, 2);
  assert.equal(sealPhase(s, c).ready, false);
  advance(s, .77);
  assert.equal(sealPhase(s, c).clean, true);
  const r = RECIPES[14],
    a = qualities({
      ...c,
      pearl: 2,
      star: 1
    }, r),
    b = qualities({
      ...c,
      pearl: 1,
      star: 2
    }, r);
  assert.ok(a.toppings > b.toppings);
});
test('wrong-base drinks stay on the counter, and relabel can swap two live tickets without serving either twice', () => {
  const s = open(1, 'week', 7);
  advance(s, 10);
  assert.ok(s.queue.length >= 2);
  const targets = s.cups.map(c => c.target),
    r = recipe(s, 1),
    c = s.cups[0];
  Object.assign(c, {
    base: r.base,
    tea: r.tea,
    milk: r.milk,
    pearl: r.pearl,
    star: r.star,
    ice: r.ice,
    shake: r.shake,
    wet: s.time - .81
  });
  assert.ok(r.base !== recipe(s, 0).base);
  act(s, 'seal');
  assert.equal(s.served, 0);
  s.focus = targets[1];
  act(s, 'label');
  assert.deepEqual(s.cups.map(c => c.target), targets.slice().reverse());
  act(s, 'seal');
  assert.equal(s.served, 1);
  assert.equal(s.servedIds[0], targets[1]);
  assert.equal(new Set(s.servedIds).size, s.servedIds.length);
  assert.ok(!s.queue.some(t => t.id === targets[1]));
  assert.equal(Object.values(s.receipt.parts).reduce((a, b) => a + b, 0), s.receipt.score);
});
test('open kettle time creates a real cross-station decision, and compatible pair batches fill both cups simultaneously', () => {
  const s = open(5, 'week', 7);
  advance(s, 11);
  assert.ok(s.queue.length >= 2);
  const target = recipe(s, 0).base;
  assert.equal(target, recipe(s, 1).base);
  act(s, 'batch');
  advance(s, .7);
  assert.ok(s.cups.every(c => c.tea > .7));
  act(s, 'batch');
  assert.ok(s.cups.every(c => !c.latch));
  const hot = open(4, 'bench', 7, 12);
  act(hot, 'leaf');
  act(hot, 'leaf');
  assert.equal(hot.cups[0].base, 2);
  act(hot, 'tea');
  advance(hot, 1);
  assert.equal(hot.cups[0].tea, 0);
  advance(hot, 3);
  assert.ok(hot.cups[0].tea > .7);
});
test('paused play freezes patience, drops held inputs and resumes with only the physically remaining residual steam', () => {
  const q = session();
  q.m.key('down', 'KeyQ');
  q.wait(.5);
  const s = q.m.inspect().state;
  const p = s.queue[0].left,
    level = s.cups[0].tea;
  q.m.pause();
  q.wait(2);
  assert.equal(s.queue[0].left, p);
  assert.equal(s.cups[0].tea, level);
  q.m.resume();
  q.wait(1);
  assert.ok(s.cups[0].tea < level + .15);
  assert.equal(s.held.size, 0);
});
test('the first real valve-and-seal interaction closes the one-drink bench and returns a nonzero clean receipt exactly once', () => {
  for (const keyboard of [true, false]) {
    const q = session('bench', {
      legacy: 33
    });
    if (keyboard) q.m.key('down', 'KeyQ');else q.m.action('tea', 'down');
    q.wait(1.36);
    if (keyboard) q.m.key('up', 'KeyQ');else q.m.action('tea', 'up');
    q.wait(.69);
    assert.equal(q.m.inspect().state.cups[0].assisted, true);
    keyboard ? q.press('Space') : q.tap('seal');
    q.tap('file');
    assert.equal(q.count, 1);
    assert.equal(q.done['Drinks served'], 1);
    assert.equal(q.done['Clean cups'], 1);
    assert.ok(q.done.score >= 230);
    assert.equal(q.data.legacy, 33);
    assert.equal(q.data.teaCounter.day, 0);
  }
});
test('a shift can finish on the clock to unlock recipes; cashing out early and daily or bench visits preserve week progression', () => {
  let data = {
    legacy: 44
  };
  const store = {
    update: fn => data = fn(data)
  };
  const s = open(0, 'week', 7),
    bot = barista('steady', 441);
  for (let f = 0; f < 12000 && s.phase === 'open'; f++) {
    bot.run(s, STEP);
    step(s);
    drain(s);
  }
  assert.equal(s.phase, 'closed');
  assert.ok(s.served >= 10);
  record(store, s, false);
  assert.equal(notebook(data).day, 0);
  record(store, s, true);
  assert.equal(notebook(data).day, 1);
  assert.ok(notebook(data).marks[0]);
  const daily = {
    ...s,
    mode: 'daily',
    seed: 20261118
  };
  record(store, daily, true);
  assert.equal(notebook(data).day, 1);
  assert.equal(notebook(data).daily[20261118], s.score);
  assert.equal(data.legacy, 44);
  assert.equal(notebook({
    teaCounter: {
      day: 'broken',
      marks: null
    }
  }).day, 0);
});
test('six waiting tickets are bounded, patience belongs to each guest and three abandoned orders end Endless', () => {
  const s = open(0, 'endless', 7);
  const first = s.queue[0].id;
  advance(s, 16);
  assert.ok(s.queue.length >= 2);
  assert.ok(s.queue[0].left < s.queue[1].left);
  advance(s, 130);
  assert.equal(s.phase, 'closed');
  assert.ok(s.lost >= 3);
  assert.ok(s.peakQueue <= 6);
  assert.ok(!s.servedIds.includes(first));
});
test('daily menus match the seed, change on another date, and preserve unlocked equipment; regulars are remembered', () => {
  const d = dailyMenu(20261118);
  assert.deepEqual(d, dailyMenu(20261118));
  assert.deepEqual(schedule(d.day, d.seed, true), schedule(d.day, d.seed, true));
  assert.notDeepEqual(schedule(d.day, d.seed, true), schedule(d.day, d.seed + 1, true));
  for (let i = 0; i < 8; i++) assert.ok(schedule(i, 21, true).every(t => RECIPES[t.recipe].day <= i));
  assert.ok(Object.keys(voice).length >= 32);
  assert.ok(Object.keys(percussive).length >= 12);
});
test('touch station selection and ticket focusing work at four sizes; touch cancellation never changes the selected cup', () => {
  const q = session('week', {
      teaCounter: {
        day: 3
      }
    }),
    s = q.m.inspect().state;
  for (const [w, h] of [[360, 410], [667, 341], [884, 940], [1440, 760]]) {
    const g = layout(s, w, h),
      i = 1 - s.active,
      x = g.xs[i],
      y = g.base - g.unit * .4;
    q.m.pointer('down', x, y, w, h);
    q.m.pointer('cancel', x, y, w, h);
    q.m.pointer('up', x, y, w, h);
    assert.notEqual(s.active, i);
    q.m.pointer('down', x, y, w, h);
    q.m.pointer('up', x, y, w, h);
    assert.equal(s.active, i);
    assert.equal(ticketHit(s, g, 25, 30), s.queue[0].id);
  }
});
test('demo operates both stations and naturally seals a drink in the gameplay capture interval', () => {
  const q = session('week', {}, {}, true);
  let first = 0,
    second = false;
  for (let i = 0; i < 900; i++) {
    q.m.demo(STEP);
    q.m.update(STEP);
    const s = q.m.inspect().state;
    if (s.served && !first) first = s.time;
    second ||= s.cups[1].tea + s.cups[1].milk > .5;
  }
  assert.ok(second);
  assert.ok(first >= 5.7 && first <= 11.7, first);
  assert.ok(q.m.inspect().state.perfect >= 2);
});
test('three skill levels separate service, score, abandonment and survival on real touch-panel and keyboard paths', () => {
  const median = (who, k, layout) => Array.from({
    length: 10
  }, (_, i) => simulate(who, 173 + i * 7919, 'endless', 0, layout)[k]).sort((a, b) => a - b)[4];
  for (const route of ['keyboard', 'touch']) {
    const n = median('newbie', 'seconds', route),
      s = median('steady', 'seconds', route),
      e = median('expert', 'seconds', route);
    assert.ok(n >= 45 && s >= 120 && s <= 300 && e >= s * 1.4);
    assert.ok(median('expert', 'score', route) > median('steady', 'score', route));
  }
  assert.ok(simulate('newbie', 77, 'week', 0, 'touch').complete);
});
