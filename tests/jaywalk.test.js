// JAYWALK (2026-11-08): its world (rows made from a seed, where every car, raft and maglev is at time t), its rules
// (hops and their queue, rafts, what gets her, the security drone, hearts, the score), its demo's pilot and the looks
// bought with hearts. Pure logic only: no browser, no three.js. Run: node --test tests/jaywalk.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createWorld, makeRow, reachOf, difficulty, T, COLS, HALF, EDGE, LOOP, HOP, BODY, FENCE, isSafe,
  entX, vehicleAt, raftAt, trainAt, trainWarning, trainArrive, trainEta, hazardAt, blockedAt,
} from '../src/games/jaywalk/world.js';
import {
  createRun, step, press, scoreOf, hopPlan, carriedOff, QUEUE, IDLE_GRAB, IDLE_WARN, BACK_GRAB, MILESTONE,
} from '../src/games/jaywalk/rules.js';
import { crossable, think, goodCols } from '../src/games/jaywalk/pilot.js';
import { CHARACTERS, looksOf, bank, unlock, canUnlock, pick, affordable, nextGoal, charOf } from '../src/games/jaywalk/chars.js';
import { LINES, lineFor, shareText } from '../src/games/jaywalk/lines.js';
import { rng } from '../src/games/kit/fx.js';

const DT = 1 / 120;
// a street made by hand: the rows given, a plain open sidewalk everywhere else
const street = (rows) => createWorld(1, { custom: (i) => rows[i] || makeRow(i, T.WALK) });
const run = (w, opts) => createRun(w, opts);
function advance(r, seconds) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) { step(r, DT); events.push(...r.events); r.events.length = 0; }
  return events;
}
const car = (x, len = 1.5) => ({ id: Math.round(x * 100) + 7, kind: 'car', len, v: 0, off: x + LOOP / 2 });

// ---------- the world ----------

test('the same seed makes the same street; another seed, another one', () => {
  const sig = (w) => {
    const out = [];
    for (let i = FENCE - 3; i <= 220; i++) {
      const r = w.row(i);
      out.push([r.type, r.dir, r.speed.toFixed(4), [...r.blocked].join(''), r.ents.map((e) => `${e.kind}${e.len}@${e.off.toFixed(3)}`).join(','),
        r.props.map((p) => `${p.kind}${p.x}`).join(','), r.hearts.map((h) => `${h.x}${h.big ? 'B' : ''}`).join(','), r.rail ? r.rail.phase.toFixed(4) : ''].join('|'));
    }
    return out.join('\n');
  };
  assert.equal(sig(createWorld(42)), sig(createWorld(42)));
  assert.notEqual(sig(createWorld(42)), sig(createWorld(43)));
  // asked in any order, the rows are the same (they're made in order, once)
  const a = createWorld(9), b = createWorld(9);
  b.row(150);
  assert.equal(sig(a), sig(b));
});

test('every kind of street shows up, gently at first, harder further on', () => {
  const w = createWorld(5);
  const seen = new Set();
  for (let i = 1; i <= 300; i++) seen.add(w.row(i).type + (w.row(i).still ? '-still' : ''));
  for (const t of [T.PARK, T.WALK, T.ROAD, T.BIKE, T.RIVER, T.RAIL]) assert.ok(seen.has(t), t);
  // the start: a sidewalk with a heart right ahead of her, then one quiet road
  assert.equal(w.row(1).type, T.WALK);
  assert.deepEqual(w.row(1).hearts, [{ x: 0, big: false }]);
  assert.equal(w.row(2).type, T.ROAD);
  // behind the start: never walkable
  for (let i = FENCE - 4; i <= FENCE; i++) assert.ok(COLS.every((c) => blockedAt(w.row(i), c)), `row ${i}`);
  assert.ok(difficulty(0) === 0 && difficulty(100) > 0.4 && difficulty(400) === 1);
  assert.ok(difficulty(0, 0.3) === 0.3);
  // traffic speeds up further on
  const speedOf = (from, to) => { let s = 0, n = 0; for (let i = from; i < to; i++) { const r = w.row(i); if (r.type === T.ROAD) { s += r.speed; n++; } } return s / n; };
  assert.ok(speedOf(220, 400) > speedOf(1, 60) * 1.3);
});

test('a safe row is never fully blocked, and always joins the way you came', () => {
  for (const seed of [1, 2, 3, 7, 11, 99]) {
    for (const base of [0, 0.3]) {
      const w = createWorld(seed, { base });
      for (let i = 0; i <= 500; i++) {
        const r = w.row(i);
        if (!isSafe(r.type)) continue;
        assert.ok(COLS.some((c) => !blockedAt(r, c)), `seed ${seed} row ${i}: something free`);
        assert.ok(r.reach.length >= 1, `seed ${seed} row ${i}: reachable`);
        const prev = w.row(i - 1);
        if (isSafe(prev.type) || prev.still) {
          assert.deepEqual(r.reach, reachOf(r.blocked, prev.reach), `seed ${seed} row ${i}: joined to the row before`);
        }
        for (const h of r.hearts) assert.ok(!blockedAt(r, h.x) && r.reach.includes(h.x), `seed ${seed} row ${i}: its heart can be picked up`);
      }
    }
  }
});

test('traffic always leaves gaps to hop through (in time, at any column)', () => {
  for (const seed of [1, 7, 13]) {
    const w = createWorld(seed);
    for (let i = 1; i <= 500; i++) {
      const r = w.row(i);
      if (r.type !== T.ROAD && r.type !== T.BIKE) continue;
      assert.ok(r.ents.length >= 1);
      const xs = r.ents.map((e) => ({ lo: e.off - e.len / 2, hi: e.off + e.len / 2 })).sort((a, b) => a.lo - b.lo);
      for (let k = 0; k < xs.length; k++) {
        const next = xs[(k + 1) % xs.length];
        const gap = (next.lo - xs[k].hi + LOOP) % LOOP;
        // the gap's time at one column, less her body: at least 0.55 s (well over a hop)
        assert.ok((gap - 2 * BODY) / r.speed >= 0.55, `seed ${seed} row ${i}: gap ${gap.toFixed(2)} at ${r.speed.toFixed(2)}/s`);
      }
    }
  }
});

test('maglevs: a warning before each one, and never two at once', () => {
  for (const seed of [1, 4, 8]) {
    const w = createWorld(seed);
    for (let i = 1; i <= 500; i++) {
      const r = w.row(i);
      if (r.type !== T.RAIL) continue;
      const { warn, period, len, speed } = r.rail;
      assert.ok(warn >= 1.15, 'over a second of warning');
      assert.ok(period >= warn + (len + LOOP) / speed, 'one train has gone before the next one warns');
    }
  }
  // by hand: it reaches the street's middle at t = 3 (going right), its warning from t = 1.5
  const rail = { dir: 1, speed: 30, len: 10, period: 8, phase: 3, warn: 1.5 };
  const row = makeRow(1, T.RAIL, { rail, dir: 1, speed: 30 });
  assert.equal(trainArrive(rail, 0), 3);
  assert.equal(trainWarning(row, 1.4), false);
  assert.equal(trainWarning(row, 1.6), true);
  assert.equal(trainWarning(row, 3.3), true);
  assert.equal(trainWarning(row, 4.0), false);
  assert.ok(Math.abs(trainEta(row, 2) - 1) < 1e-9);
  assert.equal(trainAt(row, 0, 2.9), null, 'not there yet');
  assert.ok(trainAt(row, 0, 3.0), 'its nose');
  assert.ok(trainAt(row, 0, 3.2), 'its body');
  assert.equal(trainAt(row, 0, 3 + 10 / 30 + 0.02), null, 'gone');
  assert.ok(trainAt(row, 0, 11.1), 'the next one, a period later');
});

test('a car hits the cell it covers at time t, and nothing else', () => {
  const row = makeRow(1, T.ROAD, { dir: 1, speed: 2, ents: [car(0)] });
  assert.equal(entX(row, row.ents[0], 0), 0);
  assert.ok(Math.abs(entX(row, row.ents[0], 1.5) - 3) < 1e-9);
  assert.ok(vehicleAt(row, 0, 0));
  assert.ok(vehicleAt(row, 0.9, 0), 'its end and her body overlap');
  assert.equal(vehicleAt(row, 1.1, 0), null, 'a cell further: clear');
  // it moves on: clear at x = 0 once its tail has passed her body
  assert.ok(vehicleAt(row, 0, 0.5));
  assert.equal(vehicleAt(row, 0, 0.53), null);
  // round the loop: back after LOOP / speed seconds
  assert.ok(vehicleAt(row, 0, LOOP / 2));
  const left = makeRow(1, T.ROAD, { dir: -1, speed: 2, ents: [car(0)] });
  assert.ok(Math.abs(entX(left, left.ents[0], 1) + 2) < 1e-9, 'the other way');
});

test('rafts: the one under you, its slots, and being carried off only on its way out', () => {
  const row = makeRow(1, T.RIVER, { dir: 1, speed: 2, ents: [{ id: 1, kind: 'rack', len: 3, off: LOOP / 2 }] });
  const hit = raftAt(row, 0.4, 0);
  assert.ok(hit && hit.e.id === 1);
  assert.ok(raftAt(row, 1.7, 0), 'just past its end still counts');
  assert.equal(raftAt(row, 1.9, 0), null, 'further: water');
  assert.equal(carriedOff(row, EDGE + 0.1), true, 'going right, past the right edge');
  assert.equal(carriedOff(row, -EDGE - 0.1), false, 'a raft coming in brings her back');
  assert.equal(carriedOff(makeRow(1, T.RIVER, { speed: 0, still: true }), EDGE + 0.2), false);
});

// ---------- the rules ----------

test('hops: one cell, HOP seconds, up to QUEUE presses kept while in the air', () => {
  const w = street({});
  const r = run(w);
  assert.equal(QUEUE, 2);
  assert.deepEqual([press(r, 'up'), press(r, 'up'), press(r, 'up')], [true, true, false]);
  const ev = advance(r, 0.05);
  assert.ok(r.hop && r.hop.toRow === 1, 'the first hop is in the air at once');
  advance(r, 1);
  assert.equal(r.row, 2, 'the third press was one too many');
  assert.equal(ev.filter((e) => e.type === 'hop').length, 1);
  // a hop takes HOP seconds (and a press during it starts the next one the moment it lands)
  const r2 = run(w);
  press(r2, 'right');
  advance(r2, HOP - 0.02);
  assert.equal(r2.row, 0);
  assert.ok(r2.x > 0.5 && r2.x < 1);
  press(r2, 'up');
  advance(r2, 0.04);
  assert.equal(r2.x, 1);
  assert.ok(r2.hop && r2.hop.toRow === 1, 'buffered: straight into the next hop');
  advance(r2, 0.2);
  assert.deepEqual([r2.row, r2.x], [1, 1]);
});

test('something in the way: a bump, and she stays put', () => {
  const blocked = makeRow(1, T.WALK);
  blocked.blocked[0 + HALF] = 1;
  const w = street({ 1: blocked });
  const r = run(w);
  press(r, 'up');
  const ev = advance(r, 0.3);
  assert.equal(r.row, 0);
  assert.ok(ev.some((e) => e.type === 'bump'));
  // the edge of the street, too
  const r2 = run(w);
  r2.x = HALF;
  press(r2, 'right');
  advance(r2, 0.3);
  assert.equal(r2.x, HALF);
  // and the hedge behind the start
  const r3 = run(createWorld(3));
  for (let k = 0; k < 4; k++) { press(r3, 'down'); advance(r3, 0.2); }
  assert.ok(r3.row > FENCE);
  assert.equal(hopPlan(createWorld(3), { row: FENCE + 1, x: 0, ride: null }, 'down', 0).bump, true);
});

test('a car flattens her; a quick crossing gets through', () => {
  // a car coming from the left: its front reaches her column (x = 0) at about t = 2
  const w = street({ 1: makeRow(1, T.ROAD, { dir: 1, speed: 2, ents: [car(-5)] }) });
  const stand = run(w);
  press(stand, 'up');
  const ev = advance(stand, 3);
  assert.equal(stand.alive, false);
  assert.equal(stand.death.kind, 'car');
  assert.ok(stand.death.t > 1.9 && stand.death.t < 2.1, `flattened at ${stand.death.t}`);
  assert.ok(ev.some((e) => e.type === 'death' && e.kind === 'car'));
  const cross = run(w);
  press(cross, 'up'); press(cross, 'up');
  advance(cross, 4);
  assert.equal(cross.alive, true);
  assert.equal(cross.row, 2);
  // hopping in just as it comes: flattened mid-hop
  const late = run(w);
  advance(late, 1.95);
  press(late, 'up');
  advance(late, 0.3);
  assert.equal(late.death?.kind, 'car');
});

test('a close call: a car through the spot she just left', () => {
  const w = street({ 1: makeRow(1, T.ROAD, { dir: 1, speed: 4, ents: [car(-2.1)] }) });
  const r = run(w);
  press(r, 'up'); press(r, 'up');
  const ev = advance(r, 1);
  assert.equal(r.alive, true);
  assert.ok(ev.some((e) => e.type === 'near'), 'a close call');
  assert.equal(r.near, 1);
});

test('rafts carry her; past the edge on one going out, or into the water: out', () => {
  // a 3-long rack centred on x = 0 at t = 0, drifting right at 2 cells a second
  const river = makeRow(1, T.RIVER, { dir: 1, speed: 2, ents: [{ id: 1, kind: 'rack', len: 3, off: LOOP / 2 }] });
  const w = street({ 1: river });
  const r = run(w);
  press(r, 'up');
  advance(r, HOP + 0.02);
  assert.ok(r.ride, 'on the raft');
  const x0 = r.x;
  advance(r, 0.5);
  assert.ok(Math.abs(r.x - (x0 + 1)) < 0.03, 'carried a cell in half a second');
  advance(r, 3);
  assert.equal(r.death?.kind, 'edge');
  assert.ok(r.death.x > EDGE);
  // hopping along it: still on it
  const r2 = run(w);
  press(r2, 'up');
  advance(r2, HOP + 0.02);
  press(r2, 'left');
  advance(r2, HOP + 0.02);
  assert.ok(r2.alive && r2.ride);
  // nothing there: a splash
  const w3 = street({ 1: makeRow(1, T.RIVER, { dir: 1, speed: 2, ents: [] }) });
  const r3 = run(w3);
  press(r3, 'up');
  advance(r3, 0.5);
  assert.equal(r3.death?.kind, 'splash');
});

test('a maglev on the tracks gets her (and the warning came first)', () => {
  const rail = { dir: 1, speed: 30, len: 10, period: 20, phase: 3, warn: 1.5 };
  const w = street({ 1: makeRow(1, T.RAIL, { rail, dir: 1, speed: 30 }) });
  const r = run(w);
  press(r, 'up');
  advance(r, 1.6);
  assert.equal(r.alive, true);
  assert.equal(trainWarning(w.row(1), r.t), true, 'its warning is on');
  advance(r, 2);
  assert.equal(r.death?.kind, 'train');
  assert.ok(r.death.t > 2.95 && r.death.t < 3.01);
  assert.ok(hazardAt(w, 1, 0, 3.05));
});

test('the security drone: standing still too long, or going back three rows', () => {
  const w = street({});
  const idle = run(w);
  const ev = advance(idle, IDLE_WARN + 0.1);
  assert.ok(ev.some((e) => e.type === 'drone-warn'));
  assert.equal(idle.alive, true);
  advance(idle, IDLE_GRAB - IDLE_WARN);
  assert.equal(idle.death?.kind, 'drone');
  assert.equal(idle.death.why, 'idle');
  // a hop (even a bump) keeps it away
  const busy = run(w);
  for (let k = 0; k < 4; k++) { advance(busy, 5); press(busy, k % 2 ? 'left' : 'right'); }
  advance(busy, 1);
  assert.equal(busy.alive, true);
  // three rows back from her best
  const back = run(w);
  for (let k = 0; k < 3; k++) { press(back, 'up'); advance(back, 0.2); }
  assert.equal(back.maxRow, 3);
  press(back, 'down'); advance(back, 0.2);
  const warned = (() => { press(back, 'down'); return advance(back, 0.2); })();
  assert.ok(warned.some((e) => e.type === 'drone-warn' && e.why === 'back'), 'two back: a warning');
  assert.equal(back.alive, true);
  press(back, 'down'); advance(back, 0.2);
  assert.equal(BACK_GRAB, 3);
  assert.equal(back.death?.kind, 'drone');
  assert.equal(back.death.why, 'back');
});

test('the score is the furthest row; hearts are picked up once; milestones and a new best are told', () => {
  const r1 = makeRow(1, T.WALK, { hearts: [{ x: 0, big: false }] });
  const r2 = makeRow(2, T.WALK, { hearts: [{ x: 0, big: true }] });
  const w = street({ 1: r1, 2: r2 });
  const r = run(w, { best: 1 });
  press(r, 'up'); advance(r, 0.2);
  press(r, 'up'); const ev = advance(r, 0.2);
  assert.equal(r.hearts, 6);
  assert.ok(ev.some((e) => e.type === 'heart' && e.big));
  assert.ok(ev.some((e) => e.type === 'best'), 'past her best of 1');
  press(r, 'down'); advance(r, 0.2);
  press(r, 'up'); advance(r, 0.2);
  assert.equal(r.hearts, 6, 'not twice');
  assert.equal(scoreOf(r), 2);
  press(r, 'down'); advance(r, 0.2);
  assert.equal(scoreOf(r), 2, 'going back keeps the score');
  // every MILESTONE rows
  const far = run(w);
  const all = [];
  for (let k = 0; k < MILESTONE; k++) { press(far, 'up'); all.push(...advance(far, 0.16)); }
  assert.equal(scoreOf(far), MILESTONE);
  assert.deepEqual(all.filter((e) => e.type === 'milestone').map((e) => e.row), [MILESTONE]);
});

// ---------- fair streets: every one can be crossed ----------

test('the street can always be crossed: 500 rows, several seeds, from two different moments', () => {
  for (const seed of [1, 2, 3, 7, 11]) {
    for (const base of [0, 0.3]) {
      const w = createWorld(seed, { base });
      let i = 0;
      while (i < 500) {
        while (isSafe(w.row(i + 1).type)) i++;
        const from = i;
        let to = i + 1;
        while (!isSafe(w.row(to).type)) to++;
        for (const t0 of [0, 13.7]) {
          const took = crossable(w, from, to, t0, { horizon: 24, half: 0.32 });
          assert.ok(took >= 0, `seed ${seed} (base ${base}): rows ${from}→${to} from t=${t0}`);
        }
        i = to;
      }
    }
  }
});

test('the pilot knows a dead end: columns that lead nowhere aren\'t "good"', () => {
  // row 1 open; row 2 blocks all but column -4; row 3 blocks -4: from row 1 only a pocket leads up
  const a = makeRow(1, T.WALK), b = makeRow(2, T.WALK), c = makeRow(3, T.WALK);
  for (const x of COLS) if (x !== -4) b.blocked[x + HALF] = 1;
  c.blocked[-4 + HALF] = 1;
  const w = createWorld(1, { custom: (i) => ({ 1: a, 2: b, 3: c }[i] || makeRow(i, T.ROAD, { dir: 1, speed: 1, ents: [car(30)] })) });
  assert.deepEqual([...goodCols(w, 2)], []);
  assert.deepEqual([...goodCols(w, 1)], [], 'everything on row 1 leads only into it');
  assert.equal(goodCols(w, 4), null, 'a road: anywhere');
});

// ---------- the demo's pilot ----------

function demo(seed, seconds) {
  const w = createWorld(seed, { base: 0.3 });
  const r = createRun(w);
  const pause = rng(seed);
  let wait = 0.35, best = 0, at = 0, n = 0;
  for (let t = 0; t < seconds; t += DT) {
    if (r.alive && !r.hop && !r.queue.length) {
      if (wait > 0) wait -= DT;
      else {
        if (r.maxRow > best) { best = r.maxRow; at = r.t; }
        const a = think(w, { row: r.row, x: r.x, ride: r.ride, t: r.t + DT }, { maxRow: r.maxRow, idle: r.idle, got: r.got, stuck: r.t - at });
        if (a === 'wait') wait = 0.05;
        else { press(r, a); n++; const to = w.row(r.row + (a === 'up' ? 1 : a === 'down' ? -1 : 0)); wait = isSafe(to.type) && a !== 'left' && a !== 'right' ? 0.05 + pause.next() * 0.14 : 0; }
      }
    }
    step(r, DT);
    r.events.length = 0;
  }
  return { rows: r.maxRow, alive: r.alive, hops: n, near: r.near };
}

test('the demo\'s pilot gets 25+ rows in 15 seconds, with close calls, the same way every time', () => {
  for (const seed of [7, 2, 3]) {
    const a = demo(seed, 15);
    assert.ok(a.alive, `seed ${seed}: still going`);
    assert.ok(a.rows >= 25, `seed ${seed}: ${a.rows} rows`);
    assert.ok(a.near >= 3, `seed ${seed}: ${a.near} close calls`);
    assert.deepEqual(demo(seed, 15), a, `seed ${seed}: the same again`);
  }
});

// ---------- looks and hearts ----------

test('looks: AGI-1 from the start, the rest for 100 to 500 hearts, spent once', () => {
  assert.ok(CHARACTERS.length >= 5 && CHARACTERS.length <= 6);
  assert.equal(CHARACTERS[0].id, 'agi');
  assert.equal(CHARACTERS[0].cost, 0);
  for (const c of CHARACTERS.slice(1)) assert.ok(c.cost >= 100 && c.cost <= 500, c.id);
  assert.ok(CHARACTERS.some((c) => c.id === 'cat'));
  let save = {};
  assert.deepEqual(looksOf(save), { hearts: 0, heartsEver: 0, owned: ['agi'], look: 'agi' });
  assert.equal(canUnlock(save, 'hoodie'), false);
  assert.equal(unlock(save, 'hoodie'), save, 'not enough hearts: nothing happens');
  save = bank(save, 120);
  assert.equal(looksOf(save).hearts, 120);
  assert.equal(affordable(save)?.id, 'hoodie');
  save = unlock(save, 'hoodie');
  assert.deepEqual(looksOf(save), { hearts: 20, heartsEver: 120, owned: ['agi', 'hoodie'], look: 'hoodie' });
  assert.equal(unlock(save, 'hoodie'), save, 'once');
  assert.deepEqual(nextGoal(save), { char: charOf('raincoat'), need: 130 });
  assert.equal(looksOf(pick(save, 'astro')).look, 'hoodie', 'only a look she has');
  assert.equal(looksOf(pick(save, 'agi')).look, 'agi');
  // a damaged save is cleaned up
  assert.deepEqual(looksOf({ hearts: -5, owned: ['nope', 'cat'], look: 'nope' }), { hearts: 0, heartsEver: 0, owned: ['agi', 'cat'], look: 'agi' });
});

test('her words: in her voice, never about money; the post for X', () => {
  const all = [...Object.values(LINES).flat(), ...CHARACTERS.flatMap((c) => [c.name, c.line]), shareText(42)];
  const MONEY = /\b(buy|sell|prices?|pump|dump|invest\w*|profit\w*|tokens?|coins?|crypto|wallet|dollars?)\b|\$/i;
  for (const s of all) assert.doesNotMatch(s, MONEY, s);
  for (const s of Object.values(LINES).flat()) assert.match(s, /^[a-z]/, `lowercase, like her: ${s}`);
  for (const s of Object.values(LINES).flat()) assert.ok(s.length <= 60, s);
  assert.ok(Object.values(LINES).flat().length >= 20);
  assert.equal(shareText(42), 'AGI-1 jaywalked 42 rows of 2049 traffic in JAYWALK on agi1.app 💜');
  assert.ok(LINES.best.includes(lineFor({ kind: 'car', rows: 80, isBest: true }, () => 0)));
  assert.ok(LINES.splash.includes(lineFor({ kind: 'splash', rows: 30 }, () => 0.99)));
  // the game's own words (its files, comments aside) never talk money either
  for (const f of ['game.js', 'ui.js', 'chars.js', 'lines.js']) {
    const src = readFileSync(new URL(`../src/games/jaywalk/${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
    const words = [...src.matchAll(/'([^'\n]*[a-z][^'\n]*)'|`([^`\n]*[a-z][^`\n]*)`/gi)].map((m) => m[1] || m[2]).filter((s) => / /.test(s));
    for (const s of words) assert.doesNotMatch(s, /\b(buy|sell|prices?|pump|dump|invest\w*|profit|crypto|wallet)\b|\$AGI/i, `${f}: ${s}`);
  }
});

test('its page: the intro first, no inline styles or scripts, nothing from other sites', () => {
  const page = readFileSync(new URL('../src/games/jaywalk/page.js', import.meta.url), 'utf8');
  assert.match(page, /^import '\.\.\/intro\.js';\s*$/m);
  assert.ok(page.indexOf("import '../intro.js'") < page.indexOf("import './game.js'"));
  for (const f of ['game.js', 'scene.js', 'ui.js', 'thumb.js', 'voxel.js', 'sound.js']) {
    const src = readFileSync(new URL(`../src/games/jaywalk/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /setAttribute\(\s*['"]style|\.innerHTML\s*=|\beval\s*\(|new Function\b|https?:\/\/(?!www\.w3\.org)/, f);
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/, `${f}: asks nothing of anyone`);
  }
});
