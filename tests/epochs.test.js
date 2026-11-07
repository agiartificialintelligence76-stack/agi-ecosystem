// EPOCHS (2026-11-08): the rules (src/games/epochs/engine.js) and the 30 levels (src/games/epochs/levels.js), in Node.
// Every level's reference solution is played the way a player would (each epoch's moves, then a new epoch) and must
// solve it with its own par; the rules are checked one by one on small maps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, initWorld, tick, Run, playSolution, codeOf, toCodes, toWords, keyOf, SYMBOLS,
  PLAY, WON, ZAPPED, WALL, DOOR, PLATE, TOGGLE, TIMER, EMIT, EXIT } from '../src/games/epochs/engine.js';
import { LEVELS, WORLDS, levelById } from '../src/games/epochs/levels.js';
import { SOLVED, PERFECT, ZAPPED as ZAP_LINES, OUT, WORLD, START } from '../src/games/epochs/lines.js';

const lvl = (map, extra = {}) => parseLevel({ name: 't', T: 20, K: 3, map, ...extra });
const at = (L, x, y) => y * L.w + x;
const xy = (L, p) => [p % L.w, (p / L.w) | 0];
// one tick with inputs as letters (one per body, the live AGI-1 last)
const step = (L, W, letters) => { const ev = []; tick(L, W, [...letters].map(codeOf), ev); return ev; };

test('moves: one tile a tick, walls stop you, waiting is a move', () => {
  const L = lvl(['#####', '#S.X#', '#.#.#', '#####']);
  const W = initWorld(L, 1);
  assert.deepEqual(xy(L, W.bp[0]), [1, 1]);
  const ev = step(L, W, 'U');
  assert.deepEqual(xy(L, W.bp[0]), [1, 1], 'a wall: she stays');
  assert.ok(ev.some((e) => e.type === 'bump'));
  assert.equal(W.t, 1, 'a bump still takes a tick');
  step(L, W, 'W');
  assert.equal(W.t, 2);
  step(L, W, 'R');
  assert.deepEqual(xy(L, W.bp[0]), [2, 1]);
  const ev2 = step(L, W, 'R');
  assert.equal(W.status, WON, 'the exit');
  assert.ok(ev2.some((e) => e.type === 'win'));
});

test('plates open doors while pressed; a door never closes on someone in it', () => {
  // S . a . A X : the plate two tiles from the door
  const L = lvl(['#######', '#S.a.AX', '#######'].map((r) => r.padEnd(7, '#')));
  const W = initWorld(L, 1);
  const door = at(L, 5, 1);
  assert.equal(L.kind[door], DOOR);
  assert.equal(W.open[door], 0);
  step(L, W, 'R'); step(L, W, 'R');            // on the plate
  assert.equal(W.open[door], 1, 'pressed: open');
  step(L, W, 'R');                              // off it
  assert.equal(W.open[door], 0, 'let go: closed again');
  // jam: the plate right next to the door, step from it into the doorway
  const J = lvl(['######', '#S.aAX', '######']);
  const V = initWorld(J, 1);
  step(J, V, 'R'); step(J, V, 'R');
  assert.equal(V.open[at(J, 4, 1)], 1);
  step(J, V, 'R');                              // into the doorway: the plate is free, but she stands in the door
  assert.equal(V.open[at(J, 4, 1)], 1, 'jammed open');
  assert.equal(V.status, PLAY);
  step(J, V, 'R');
  assert.equal(V.status, WON);
});

test('a door with two plates needs both; an echo holds one', () => {
  const L = lvl(['#########', '#a.S..a.#', '####A####', '####X####', '#########']);
  const run = new Run({ ...L, K: 3, T: 20 });
  for (const ch of 'LL') run.step(codeOf(ch));
  run.newEpoch();                               // v1 holds the left plate
  for (const ch of 'RRR') run.step(codeOf(ch));
  assert.equal(run.world.open[at(L, 4, 2)], 1, 'echo + live on the plates: open');
  run.step(codeOf('L'));
  assert.equal(run.world.open[at(L, 4, 2)], 0, 'one plate free: closed');
});

test('echoes replay their inputs in lockstep, and stay where they stopped', () => {
  const L = lvl(['#######', '#S...#', '#####'].map((r) => r.padEnd(7, '#')));
  const run = new Run({ ...L, K: 3 });
  for (const ch of 'RR') run.step(codeOf(ch));
  assert.ok(run.newEpoch());
  assert.equal(run.epoch, 2);
  assert.equal(run.world.n, 2, 'an echo and the live AGI-1');
  assert.deepEqual(xy(L, run.world.bp[0]), [1, 1], 'everyone starts again');
  run.step(codeOf('W'));
  assert.deepEqual(xy(L, run.world.bp[0]), [2, 1], 'v1 does what you did on tick 1');
  run.step(codeOf('W')); run.step(codeOf('W')); run.step(codeOf('W'));
  assert.deepEqual(xy(L, run.world.bp[0]), [3, 1], 'out of moves: she stays');
});

test('an echo can\'t step where the live AGI-1 stands (desync), but they can walk into a tile together', () => {
  const L = lvl(['#######', '#S...#', '#.....', '#######'].map((r) => r.padEnd(7, '#')));
  // epoch 1: wait, then right twice
  const run = new Run({ ...L, K: 3 });
  for (const ch of 'WRR') run.step(codeOf(ch));
  run.newEpoch();
  // epoch 2: step right and stand there: v1's first R (tick 2) is blocked
  run.step(codeOf('R'));
  const ev = run.step(codeOf('W'));
  assert.deepEqual(xy(L, run.world.bp[0]), [1, 1], 'blocked by her: v1 waits');
  assert.ok(ev.some((e) => e.type === 'desync' && e.i === 0), 'shown as a desync');
  // together: both walk right on the same tick
  const run2 = new Run({ ...L, K: 3 });
  run2.step(codeOf('R'));
  run2.newEpoch();
  run2.step(codeOf('R'));
  assert.deepEqual(xy(L, run2.world.bp[0]), [2, 1]);
  assert.deepEqual(xy(L, run2.world.bp[1]), [2, 1], 'the same tile, no desync');
});

test('boxes: anyone pushes one tile; not into walls or other boxes; boxes press plates', () => {
  const L = lvl(['########', '#S.o.a.#', '#..oo..#', '########']);
  const W = initWorld(L, 1);
  step(L, W, 'R'); step(L, W, 'R');            // pushes the box from (3,1) to (4,1)
  assert.equal(W.boxes[0], at(L, 4, 1));
  step(L, W, 'R');                              // onto the plate
  assert.equal(W.boxes[0], at(L, 5, 1));
  assert.equal(W.pressed[at(L, 5, 1)], 1, 'a box presses a plate');
  // two boxes in a row can't be pushed
  const V = initWorld(L, 1);
  step(L, V, 'D'); step(L, V, 'R');
  const ev = step(L, V, 'R');
  assert.ok(ev.some((e) => e.type === 'bump'), 'box into box: blocked');
  assert.deepEqual(xy(L, V.bp[0]), [2, 2]);
  // an echo pushes too
  const run = new Run({ ...L, K: 2 });
  for (const ch of 'RRR') run.step(codeOf(ch));
  run.newEpoch();
  for (const ch of 'DWW') run.step(codeOf(ch));
  assert.equal(run.world.boxes[0], at(L, 5, 1), 'v1 pushed the box onto the plate');
});

test('toggles flip their door on every step onto them; timers open theirs for N ticks', () => {
  const L = lvl(['#########', '#Sb.B..X#', '#########'], { keys: { b: 'toggle' } });
  const W = initWorld(L, 1);
  step(L, W, 'R');
  assert.equal(W.open[at(L, 4, 1)], 1, 'on: open');
  step(L, W, 'R');
  assert.equal(W.open[at(L, 4, 1)], 1, 'stays open when you step off');
  step(L, W, 'L');
  assert.equal(W.open[at(L, 4, 1)], 0, 'stepped on again: closed');
  const T = lvl(['#########', '#Sc..C.X#', '#########'], { keys: { c: 'timer2' } });
  const V = initWorld(T, 1);
  step(T, V, 'R');                              // press: open for two ticks
  assert.equal(V.open[at(T, 5, 1)], 1);
  step(T, V, 'R');
  assert.equal(V.open[at(T, 5, 1)], 1);
  step(T, V, 'R');
  assert.equal(V.open[at(T, 5, 1)], 0, 'two ticks later: closed');
  assert.equal(V.timers[2], 0);
});

test('lasers: stopped by boxes and bodies; the live AGI-1 in a beam is zapped, an echo takes the hit for one tick', () => {
  const L = lvl(['#######', '#S....#', '#..o..#', '>.....#', '#.....#', '#####X#']);
  const W = initWorld(L, 1);
  assert.equal(W.beams.length, 1);
  assert.equal(W.beams[0].end, at(L, 6, 3), 'nothing in the way: the wall');
  step(L, W, 'R'); step(L, W, 'R'); step(L, W, 'D');   // push the box down into the beam
  assert.equal(W.boxes[0], at(L, 3, 3));
  assert.equal(W.beams[0].end, at(L, 3, 3), 'a box stops it');
  step(L, W, 'R'); step(L, W, 'D');                     // cross behind the box: safe
  assert.equal(W.status, PLAY);
  // without the box: zapped
  const Z = initWorld(L, 1);
  step(L, Z, 'D');
  const ev = step(L, Z, 'D');
  assert.equal(Z.status, ZAPPED);
  assert.ok(ev.some((e) => e.type === 'zap'));
  // an echo walking into the beam: hit (it stops the beam that tick), gone the next
  const run = new Run({ ...L, K: 2 });
  run.step(codeOf('D'));
  run.step(codeOf('D'));
  assert.equal(run.status, 'zapped', 'epoch 1 ended in the beam');
  assert.equal(run.canStep(), false);
  assert.ok(run.newEpoch(), 'a zapped epoch can be kept as an echo');
  run.step(codeOf('R'));
  const ev2 = run.step(codeOf('R'));
  assert.ok(ev2.some((e) => e.type === 'deprecate' && e.i === 0), 'v1 takes the hit');
  assert.equal(run.world.bs[0], 1, 'still there this tick');
  assert.equal(run.world.beams[0].end, at(L, 1, 3), 'and the beam stops at her');
  assert.equal(run.status, 'play');
  run.step(codeOf('W'));
  assert.equal(run.world.bs[0], 2, 'gone the next');
  assert.equal(run.world.beams[0].end, at(L, 6, 3), 'and the beam runs on to the wall');
});

test('one-way floors: only crossed in their direction', () => {
  const L = lvl(['######', '#S→.X#', '######']);
  const W = initWorld(L, 1);
  step(L, W, 'R');
  assert.deepEqual(xy(L, W.bp[0]), [2, 1]);
  step(L, W, 'R'); step(L, W, 'L');
  assert.deepEqual(xy(L, W.bp[0]), [3, 1], 'can\'t walk back onto it');
});

test('undo, retry an epoch, restart, and undo back across a new epoch', () => {
  const L = levelById('1-1');
  const P = parseLevel(L);
  const run = new Run(P);
  for (const ch of 'DD') run.step(codeOf(ch));
  run.undo();
  assert.equal(run.t, 1);
  assert.deepEqual(xy(P, run.world.bp[0]), [1, 2]);
  run.step(codeOf('D'));
  run.newEpoch();
  assert.equal(run.epoch, 2);
  run.step(codeOf('R'));
  run.restartEpoch();
  assert.equal(run.t, 0);
  assert.equal(run.epoch, 2, 'retry keeps the echoes');
  assert.ok(run.undo(), 'at an epoch\'s start: back into the last one');
  assert.equal(run.epoch, 1);
  assert.equal(run.t, 2);
  run.restartLevel();
  assert.equal(run.epoch, 1);
  assert.equal(run.t, 0);
  assert.equal(run.undo(), false, 'nothing to undo');
});

test('out of ticks: a new epoch comes, out of epochs on the last', () => {
  const P = parseLevel({ name: 't', T: 3, K: 2, map: ['######', '#S...#', '####X#', '######'] });
  const run = new Run(P);
  for (const ch of 'WWW') run.step(codeOf(ch));
  assert.equal(run.status, 'timeup');
  assert.equal(run.canStep(), false);
  run.newEpoch();
  for (const ch of 'WWW') run.step(codeOf(ch));
  assert.equal(run.status, 'out');
  assert.equal(run.canNewEpoch(), false);
  assert.ok(run.undo());
  assert.equal(run.status, 'play', 'one move back and you can try again');
});

test('the worlds and levels: 5 × 6, every map valid, links matched, symbols known', () => {
  assert.equal(WORLDS.length, 5);
  assert.equal(LEVELS.length, 30);
  const ids = new Set();
  for (const def of LEVELS) {
    assert.match(def.id, /^[1-5]-[1-6]$/, def.id);
    assert.ok(!ids.has(def.id), `${def.id}: unique`);
    ids.add(def.id);
    assert.equal(def.world, Number(def.id[0]));
    assert.ok(def.name && def.name.length <= 18, `${def.id}: a short name`);
    assert.ok(def.tip && def.tip.length <= 90, `${def.id}: a short tip`);
    const L = parseLevel(def);
    assert.deepEqual(L.problems, [], `${def.id}: ${L.problems.join('; ')}`);
    assert.ok(L.w >= 6 && L.w <= 12 && L.h >= 4 && L.h <= 10, `${def.id}: ${L.w}x${L.h}`);
    for (const row of def.map) for (const ch of row) assert.ok(SYMBOLS.includes(ch), `${def.id}: symbol ${ch}`);
    // closed all round: the edge is walls (or emitters)
    for (let x = 0; x < L.w; x++) for (const y of [0, L.h - 1]) assert.ok([WALL, EMIT].includes(L.kind[at(L, x, y)]), `${def.id}: edge ${x},${y}`);
    for (let y = 0; y < L.h; y++) for (const x of [0, L.w - 1]) assert.ok([WALL, EMIT].includes(L.kind[at(L, x, y)]), `${def.id}: edge ${x},${y}`);
    assert.equal(L.kind[L.exit], EXIT);
    assert.ok(def.K >= 2 && def.K <= 4 && def.T >= 6 && def.T <= 20, `${def.id}: T ${def.T}, K ${def.K}`);
    // nobody starts in a beam
    const W = initWorld(L, 1);
    assert.equal(W.status, PLAY, `${def.id}: safe at the start`);
    // every emitter faces into the room
    for (const em of L.emitters) { const q = em.p + [-L.w, 1, L.w, -1][em.dir]; assert.ok(q >= 0 && q < L.n && L.kind[q] !== WALL, `${def.id}: an emitter facing a wall`); }
    for (const id of L.ids) assert.ok([PLATE, TOGGLE, TIMER].includes(L.devs[id].type));
  }
  // the worlds bring in their things in order
  const has = (def, test2) => def.map.join('').split('').some(test2);
  for (const def of LEVELS.filter((l) => l.world === 1)) assert.ok(!has(def, (c) => 'o><^v'.includes(c)) && !def.keys, `${def.id}: world 1 is plates and doors`);
  for (const def of LEVELS.filter((l) => l.world === 2)) assert.ok(has(def, (c) => c === 'o') && !has(def, (c) => '><^v'.includes(c)), `${def.id}: world 2 has boxes, no lasers`);
  for (const def of LEVELS.filter((l) => l.world === 3)) assert.ok(has(def, (c) => '><^v'.includes(c)), `${def.id}: world 3 has lasers`);
  for (const def of LEVELS.filter((l) => l.world === 4)) assert.ok(def.keys || has(def, (c) => '→←↑↓'.includes(c)), `${def.id}: world 4 has toggles, timers or arrows`);
  for (const def of LEVELS.filter((l) => l.world === 5)) assert.ok(def.K >= 3, `${def.id}: world 5 needs 3 or 4 epochs`);
  assert.equal(levelById('2-3').name, LEVELS[8].name);
  assert.equal(levelById('9-9'), null);
});

test('every level\'s reference solution solves it, in exactly its par', () => {
  for (const def of LEVELS) {
    const L = parseLevel(def);
    assert.equal(def.sol.length, def.K, `${def.id}: a solution uses all its epochs (par = K)`);
    for (const e of def.sol) { assert.match(e, /^[UDLRW]+$/, def.id); assert.ok(e.length <= def.T, `${def.id}: an epoch fits in T`); }
    const p = playSolution(L, def.sol);
    assert.ok(p.won, `${def.id} ${def.name}: ${p.why}`);
    assert.equal(p.epochs, def.par.epochs, `${def.id}: par epochs`);
    assert.equal(p.ticks, def.par.ticks, `${def.id}: par ticks`);
    assert.equal(p.run.stars(def.par), 3, `${def.id}: the reference earns three stars`);
    // one move fewer in the last epoch never solves it
    const short = def.sol.slice();
    short[short.length - 1] = short[short.length - 1].slice(0, -1);
    assert.equal(playSolution(L, short).won, false, `${def.id}: its last move matters`);
  }
});

test('no level is solved by its last epoch alone (the echoes are needed)', () => {
  for (const def of LEVELS) {
    const L = parseLevel(def);
    const alone = playSolution(L, [def.sol[def.sol.length - 1]]);
    assert.equal(alone.won, false, `${def.id}: the last epoch's moves alone`);
  }
});

test('stars: one for solving, one for par epochs, one for par moves', () => {
  const def = levelById('1-2');
  const L = parseLevel(def);
  const p = playSolution(L, ['UURRRRRRW', 'WWWWWWWRRRRR']);
  assert.ok(p.won);
  assert.equal(p.run.stars(def.par), 2, 'more moves than par: two stars');
  assert.equal(new Run(L).stars(def.par), 0, 'not solved: none');
});

test('the same moves, the same world (determinism); the solver\'s key ignores echo order', () => {
  for (const def of LEVELS.slice(0, 30)) {
    const L = parseLevel(def);
    const a = playSolution(L, def.sol), b = playSolution(L, def.sol);
    assert.equal(keyOf(a.run.world, false), keyOf(b.run.world, false), def.id);
    assert.deepEqual(Array.from(a.run.world.bp), Array.from(b.run.world.bp));
  }
  assert.deepEqual(toCodes('UDLRW'), [0, 2, 3, 1, -1]);
  assert.equal(toWords([0, 1, 2, 3, -1]), 'URDLW');
});

test('AGI-1\'s lines: lowercase, short, never money', () => {
  const all = [...SOLVED, ...PERFECT, ...ZAP_LINES, ...OUT, ...START, ...Object.values(WORLD)];
  assert.ok(all.length >= 25, `${all.length} lines`);
  for (const line of all) {
    assert.equal(line, line.toLowerCase(), line);
    assert.ok(line.length <= 80, line);
    assert.doesNotMatch(line, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i);
  }
});
