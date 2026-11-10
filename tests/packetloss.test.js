// PACKET LOSS (2026-11-09), an arcade-kit game on agi1.app/games: its eight mazes, the letter's grid movement (turns
// remembered a moment, the cornering window, reversing, tunnels), each gremlin's rule (PING, JITTER seeded, THROTTLE
// ahead and its slowing ring, ECHO 2.5 s behind), encryption and the quarantine chain, packet loss, the repeater and
// the read receipt, firewall gates, a maze delivered, the demo's player clearing maze 1, and the same seed giving the
// same run. All in Node (no browser). Run: node --test tests/packetloss.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MAZES, PARSED, parseMaze, W, H, WALL, PATH, GATE, BOXWALL, BOX, DOOR, DX, DY } from '../src/games/packetloss/mazes.js';
import {
  createSim, step, request, nextMaze, loadMaze, speeds, encFor, releaseTimes, chooseDir, throttleTarget, pastPos, echoPos,
  dropBits, canEnter, tileOf, flashing, active, TUNE, STEP, UP, RIGHT, DOWN, LEFT,
} from '../src/games/packetloss/sim.js';
import { createAI, drive } from '../src/games/packetloss/ai.js';
import { LINES, endLine, shareText } from '../src/games/packetloss/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const route = (c) => c === PATH || c === GATE;

// a quiet board: in play, every gremlin shut in the box (or not joined), nothing in the way
function quiet(maze = 0, seed = 1) {
  const S = createSim({ seed, maze });
  S.phase = 'play';
  for (const g of S.gremlins) { if (g.kind === 'echo') g.state = 'off'; else { g.state = 'box'; g.release = 1e9; } }
  S.calmNext = 1e9;
  return S;
}
function place(S, x, y, dir, moving = true) {
  const p = S.player;
  p.x = x; p.y = y; p.dir = dir; p.moving = moving; p.want = -1;
}
const run = (S, sec) => { for (let i = 0; i < Math.round(sec / STEP); i++) { step(S); S.events.length = 0; } };

// ---------- the mazes ----------
test('eight handmade mazes, each with its own name and tint, 19 × 23 and mirrored', () => {
  assert.equal(MAZES.length, 8);
  assert.deepEqual(MAZES.map((m) => m.name), ['Home Wi-Fi', 'Café hotspot', 'Office LAN', 'Data center', 'Undersea cable', 'Satellite uplink', 'Moon base', 'The backbone']);
  assert.equal(new Set(MAZES.map((m) => m.id)).size, 8);
  assert.equal(new Set(MAZES.map((m) => m.tint)).size, 8, 'a tint each');
  for (const m of MAZES) {
    assert.match(m.tint, /^#[0-9a-f]{6}$/);
    assert.equal(m.rows.length, H, m.id);
    for (const row of m.rows) {
      assert.equal(row.length, W, `${m.id}: rectangular`);
      const norm = (s) => s.replace(/[PHR]/g, '_').replace(/[=~]/g, 'g');
      assert.equal(norm([...row].reverse().join('')), norm(row), `${m.id}: mirrored`);
    }
  }
});

test('every maze: one start, one door, a closed box, exactly 4 keys, a receipt and a repeater spot, paired tunnels', () => {
  for (const M of PARSED) {
    assert.equal(M.keys.length, 4, `${M.id}: 4 keys`);
    assert.ok(M.start && M.receipt && M.repeater && M.door, M.id);
    // keys near the corners: each in its own quarter
    const quarters = new Set(M.keys.map((k) => `${k.x < W / 2 ? 'L' : 'R'}${k.y < H / 2 ? 'T' : 'B'}`));
    assert.equal(quarters.size, 4, `${M.id}: a key in each corner`);
    // the box: walls and a door round its inside, a door that opens onto a route tile
    const { x0, y0, x1, y1 } = M.box;
    let doors = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = M.cell[y * W + x], edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (c === DOOR) doors++;
      if (edge) assert.ok(c === BOXWALL || c === DOOR, `${M.id}: box edge ${x},${y}`);
      else assert.equal(c, BOX, `${M.id}: box inside ${x},${y}`);
    }
    assert.equal(doors, 1, `${M.id}: one door`);
    assert.equal(M.cell[M.exit.y * W + M.exit.x], PATH, `${M.id}: the door opens onto a route`);
    // tunnels: an open left edge has an open right edge on the same row; the top and bottom edges are closed
    for (let y = 0; y < H; y++) assert.equal(route(M.cell[y * W]), route(M.cell[y * W + W - 1]), `${M.id}: row ${y}`);
    for (let x = 0; x < W; x++) assert.ok(!route(M.cell[x]) && !route(M.cell[(H - 1) * W + x]), `${M.id}: column ${x}`);
    assert.ok(M.tunnels.length >= 1, `${M.id}: at least one tunnel`);
  }
  // the later mazes add firewall gates
  assert.deepEqual(PARSED.map((M) => M.gates.length > 0), [false, false, false, true, true, true, true, true]);
  assert.throws(() => parseMaze({ id: 'x', rows: ['#?#'] }), /unknown tile/);
});

test('every bit reachable from the start (gates open, tunnels wrapping), and no dead ends', () => {
  for (const M of PARSED) {
    const seen = new Uint8Array(W * H), q = [M.start.y * W + M.start.x];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(), x = i % W, y = (i / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = (x + DX[d] + W) % W, ny = y + DY[d];
        if (ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (!seen[j] && route(M.cell[j])) { seen[j] = 1; q.push(j); }
      }
    }
    let bits = 0;
    for (let i = 0; i < W * H; i++) {
      if (M.bits[i]) { bits++; assert.ok(seen[i], `${M.id}: bit at ${i % W},${(i / W) | 0} reachable`); }
      if (!route(M.cell[i])) continue;
      assert.ok(seen[i], `${M.id}: every route tile reachable`);
      const x = i % W, y = (i / W) | 0;
      let n = 0;
      for (let d = 0; d < 4; d++) { const ny = y + DY[d]; if (ny >= 0 && ny < H && route(M.cell[ny * W + (x + DX[d] + W) % W])) n++; }
      assert.ok(n >= 2, `${M.id}: no dead end at ${x},${y}`);
    }
    assert.equal(bits, M.bitCount);
    assert.ok(bits >= 150 && bits <= 230, `${M.id}: ${bits} bits`);
  }
});

// ---------- moving ----------
test('a turn asked for a moment early is taken at the junction; one asked for too early is forgotten', () => {
  // Home Wi-Fi's top corridor: (7, 1) opens downward
  const S = quiet();
  place(S, 6.2, 1, RIGHT);
  request(S, DOWN);                       // 0.8 tiles before: about 0.12 s
  run(S, 0.5);
  assert.equal(S.player.x, 7, 'it turned at the junction');
  assert.ok(S.player.y > 2, 'and went down');
  const T = quiet();
  place(T, 3.9, 1, RIGHT);
  request(T, DOWN);                       // 3 tiles before: longer than TUNE.buffer
  assert.ok(3.1 / speeds(0).player > TUNE.buffer);
  run(T, 0.7);
  assert.equal(T.player.y, 1, 'not taken: it was forgotten');
  assert.ok(T.player.x > 7.5);
});

test('the cornering window: a turn up to TUNE.corner tiles early or late snaps into the junction smoothly', () => {
  for (const [x0, label] of [[7 - 0.3, 'early'], [7 + 0.25, 'late']]) {
    const S = quiet();
    place(S, x0, 1, RIGHT);
    request(S, DOWN);
    step(S);
    assert.equal(S.player.dir, DOWN, `${label}: turned at once`);
    assert.ok(Math.abs(S.player.x - 7) < Math.abs(x0 - 7), `${label}: sliding back to the junction's line`);
    run(S, 0.3);
    assert.equal(S.player.x, 7, `${label}: on the line`);
    assert.ok(S.player.y > 1.5);
  }
  // past the window: no turn there
  const S = quiet();
  place(S, 7 + TUNE.corner + 0.08, 1, RIGHT);
  request(S, DOWN);
  step(S);
  assert.equal(S.player.dir, RIGHT);
});

test('reversing works anywhere, at once; walls stop the letter at a tile center; a stopped letter starts on a request', () => {
  const S = quiet();
  place(S, 5.3, 1, RIGHT);
  request(S, LEFT);
  step(S);
  assert.equal(S.player.dir, LEFT);
  assert.ok(S.player.x < 5.3);
  // into the top-right corner: it stops there
  place(S, 15, 1, RIGHT);
  run(S, 1);
  assert.equal(S.player.x, 17);
  assert.equal(S.player.moving, false);
  request(S, DOWN);
  run(S, 0.3);
  assert.ok(S.player.moving && S.player.y > 1);
});

test('tunnels: out one side, in the other', () => {
  const S = quiet();
  const y = PARSED[0].tunnels[0];
  place(S, 2, y, LEFT);
  run(S, 0.8);
  assert.ok(S.player.x > W / 2, `wrapped round (x = ${S.player.x.toFixed(2)})`);
  assert.equal(S.player.y, y);
  assert.ok(canEnter(S, -1, y) && canEnter(S, W, y), 'its edges lead to each other');
});

test('the letter sets off by itself at GO, and a turn asked during READY waits for it', () => {
  const S = createSim({ seed: 1, maze: 0 });
  assert.equal(S.phase, 'ready');
  request(S, RIGHT);
  for (let i = 0; i < 400 && S.phase === 'ready'; i++) step(S);
  assert.equal(S.phase, 'play');
  step(S);
  assert.equal(S.player.dir, RIGHT);
  assert.ok(S.player.moving);
});

// ---------- the gremlins ----------
test('PING heads straight for your tile: at a junction it takes the way that brings it closest as the crow flies', () => {
  const S = quiet();
  const g = S.gremlins[0];
  g.state = 'roam'; g.scrambled = false;
  for (const [px, py] of [[1, 1], [17, 1], [9, 5], [1, 17]]) {
    place(S, px, py, LEFT, false);
    g.x = 9; g.y = 3; g.dir = UP;               // a junction on ring 3
    chooseDir(S, g, 9, 3);
    let best = Infinity, want = -1;
    for (const d of [UP, LEFT, DOWN, RIGHT]) {
      if (d === DOWN) continue;                  // never straight back
      if (!canEnter(S, 9 + DX[d], 3 + DY[d])) continue;
      const v = (9 + DX[d] - px) ** 2 + (3 + DY[d] - py) ** 2;
      if (v < best) { best = v; want = d; }
    }
    assert.equal(g.dir, want, `toward ${px},${py}`);
  }
});

test('JITTER switches every 3-5 s between chasing and a random junction, the same way for the same seed', () => {
  const trace = (seed) => {
    const S = quiet(0, seed);
    const g = S.gremlins[1];
    g.state = 'roam'; g.x = S.maze.exit.x; g.y = S.maze.exit.y; g.dir = DOWN; g.moving = true;
    place(S, 9, 19, LEFT);
    const out = [];
    let last = 0;
    for (let i = 0; i < 120 * 30; i++) {
      step(S);
      for (const e of S.events) if (e.type === 'jitter') { out.push([e.chase, +(S.t - last).toFixed(2)]); last = S.t; }
      S.events.length = 0;
      S.player.inv = 9;                         // it may touch the letter: no matter here
    }
    return out;
  };
  const a = trace(5), b = trace(5), c = trace(6);
  assert.deepEqual(a, b, 'seeded');
  assert.notDeepEqual(a, c);
  assert.ok(a.length >= 5);
  for (const [, dt] of a.slice(1)) assert.ok(dt >= 3 - 0.02 && dt <= 5 + 0.02, `${dt} s`);
  assert.deepEqual(a.slice(0, 4).map(([chase]) => chase), [false, true, false, true], 'it alternates');
});

test('THROTTLE aims 4 tiles ahead of you (not through walls), and inside its 3-tile ring you are 25% slower', () => {
  const S = quiet();
  place(S, 4, 1, RIGHT);
  assert.equal(throttleTarget(S), 1 * W + 8);
  place(S, 15, 1, RIGHT);
  assert.equal(throttleTarget(S), 1 * W + 17, 'stops at the wall');
  place(S, 9, 19, UP);
  assert.equal(throttleTarget(S), 17 * W + 9, 'up the spoke to ring 3');
  // its ring
  const th = S.gremlins[2];
  th.state = 'roam'; th.scrambled = false; th.moving = false;
  place(S, 5, 3, RIGHT);
  th.x = 7.5; th.y = 3; th.dir = LEFT;
  step(S);
  assert.equal(S.player.slowed, true);
  assert.ok(Math.abs(S.player.speed - speeds(0).player * 0.75) < 1e-9);
  th.x = 9.5; th.y = 3;
  place(S, 5, 3, RIGHT);
  step(S);
  assert.equal(S.player.slowed, false, '4.5 tiles away: full speed');
  // not while it's scrambled, and not while you blink after packet loss
  th.x = 6; th.scrambled = true; step(S);
  assert.equal(S.player.slowed, false);
  th.scrambled = false; S.player.inv = 1; step(S);
  assert.equal(S.player.slowed, false);
});

test('ECHO joins after 30 bits and replays your exact path 2.5 s behind you', () => {
  const S = quiet();
  const e = S.gremlins[3];
  place(S, 1, 3, RIGHT);
  const ai = createAI();
  let joinedAt = -1;
  for (let i = 0; i < 120 * 20 && S.phase === 'play'; i++) {
    drive(ai, S);
    step(S);
    if (joinedAt < 0 && e.state !== 'off') { joinedAt = S.collectedHere; }
    S.events.length = 0;
    if (S.collectedHere > 60) break;
  }
  assert.equal(joinedAt, TUNE.echoAt);
  assert.ok(e.state === 'on' || e.state === 'join');
  const was = pastPos(S, TUNE.echoLag);
  assert.equal(e.x, was.x);
  assert.equal(e.y, was.y);
  const at = echoPos(S);
  assert.deepEqual([at.x, at.y], [e.x, e.y]);
});

// ---------- keys and the quarantine ----------
test('a key: 6 s encrypted (gremlins scrambled, flashing the last 1.5 s), quarantines score 200, 400, 800, 1600', () => {
  const S = quiet();
  // four gremlins out on the board (ECHO on your trail)
  for (const g of S.gremlins.slice(0, 3)) { g.state = 'roam'; g.x = 9; g.y = 21; g.dir = LEFT; g.moving = true; }
  S.gremlins[3].state = 'on'; S.gremlins[3].alpha = 1;
  const k = S.keys[0];
  place(S, k.x, k.y, RIGHT, false);
  step(S);
  assert.equal(S.enc, encFor(0) - 0 > 0 ? S.enc : 0);
  assert.ok(Math.abs(S.enc - 6) < 0.02, 'encrypted for 6 s');
  assert.equal(encFor(0), 6);
  for (const g of S.gremlins) assert.equal(g.scrambled, true, `${g.kind} scrambled`);
  // touch them one after another
  const scores = [];
  for (const g of S.gremlins.slice(0, 3)) {
    g.x = S.player.x; g.y = S.player.y;
    const before = S.score;
    step(S);
    scores.push(S.score - before);
    assert.equal(g.state, 'return', 'flies back to the box');
  }
  const e = S.gremlins[3];
  e.lag = 0;                                  // ECHO right on top of you
  const before = S.score;
  step(S);
  scores.push(S.score - before);
  assert.deepEqual(scores, TUNE.chain);
  assert.equal(S.quarantined, 4);
  // the flashing, and the end of it
  S.enc = TUNE.encFlash + 0.01;
  assert.equal(flashing(S), false);
  step(S); step(S);
  assert.equal(flashing(S), true);
  run(S, TUNE.encFlash + 0.1);
  assert.equal(S.enc, 0);
});

test('a quarantined gremlin flies back to the box, waits a few seconds and comes out again', () => {
  const S = quiet();
  const g = S.gremlins[0];
  g.state = 'roam'; g.x = 5; g.y = 3; g.dir = LEFT; g.scrambled = true;
  S.enc = 5;
  place(S, 5, 3, RIGHT, false);
  step(S);
  assert.equal(g.state, 'return');
  run(S, 1.5);
  assert.equal(g.state, 'box');
  assert.equal(g.scrambled, false);
  run(S, TUNE.quarantineFor + 1.5);
  assert.equal(g.state, 'roam', 'back out');
});

// ---------- packet loss ----------
test('packet loss: a bar gone, up to 12 bits scattered onto free route tiles (never walls, the box or a gate), then 1.5 s safe', () => {
  for (const maze of [0, 4, 7]) {
    const S = quiet(maze, 3);
    const p = S.player;
    // the letter has been somewhere: clear a stretch of bits so there's room near it
    for (let i = 0; i < W * H; i++) if (S.bits[i] && ((i / W) | 0) <= 6) { S.bits[i] = 0; S.bitsLeft--; S.collectedHere++; S.bitsCollected++; S.score += 10; }
    place(S, S.maze.keys[0].x + 2, S.maze.keys[0].y, LEFT, false);
    S.keys[0].on = false;
    const g = S.gremlins[0];
    g.state = 'roam'; g.scrambled = false; g.x = p.x; g.y = p.y; g.dir = RIGHT;
    const left = S.bitsLeft, score = S.score, bitsBefore = S.bits.slice();
    step(S);
    assert.equal(S.signal, 2);
    assert.equal(S.player.inv, TUNE.inv);
    assert.equal(S.flying.length, 12);
    assert.equal(S.bitsLeft, left + 12, 'they count as not delivered');
    assert.equal(S.score, score - 120);
    const spots = new Set();
    for (const f of S.flying) {
      const i = f.ty * W + f.tx;
      assert.equal(S.cell[i], PATH, 'a route tile (not a wall, the box or a gate)');
      assert.equal(bitsBefore[i], 0, 'a free one');
      assert.ok(!spots.has(i), 'one bit a tile');
      spots.add(i);
    }
    run(S, 1.3);
    for (const i of spots) assert.equal(S.bits[i], 1, 'landed');
    // safe while blinking: the same gremlin touching again does nothing
    S.player.inv = 1; g.state = 'roam'; g.x = S.player.x; g.y = S.player.y;
    step(S);
    assert.equal(S.signal, 2);
  }
  // fewer collected, fewer lost; early in a maze (bits everywhere) they still find somewhere to land
  const S = quiet();
  S.collectedHere = 5;
  place(S, 9, 19, LEFT, false);
  const out = dropBits(S, 5);
  assert.equal(out.length, 5);
  for (const f of out) assert.equal(S.cell[f.ty * W + f.tx], PATH);
});

test('out of bars: CONNECTION LOST ends the run', () => {
  const S = quiet();
  S.signal = 1;
  const g = S.gremlins[0];
  g.state = 'roam'; g.x = S.player.x; g.y = S.player.y; g.dir = RIGHT;
  step(S);
  assert.equal(S.signal, 0);
  assert.equal(S.phase, 'lost');
  assert.ok(S.events.some((e) => e.type === 'lost'));
});

// ---------- helpers, gates, the end of a maze ----------
test('the repeater shows up after 60% and brings a bar back (or 500 at full signal); the read receipt shows twice, 9 s each', () => {
  const S = quiet();
  const M = S.maze;
  const total = M.bitCount;
  const take = (frac) => { let k = 0; for (let i = 0; i < W * H && (1 - S.bitsLeft / total) < frac; i++) if (S.bits[i] && i !== M.receipt.y * W + M.receipt.x) { S.bits[i] = 0; S.bitsLeft--; k++; } return k; };
  place(S, 1, 21, RIGHT, false);
  take(0.31); step(S);
  assert.equal(S.receipt.on, true);
  assert.equal(S.receipt.t > TUNE.receiptFor - 0.1, true);
  run(S, TUNE.receiptFor + 0.1);
  assert.equal(S.receipt.on, false, 'gone after 9 s');
  assert.equal(S.repeater.on, false);
  take(0.61); step(S);
  assert.equal(S.repeater.on, true);
  S.signal = 2;
  place(S, M.repeater.x, M.repeater.y, RIGHT, false);
  step(S);
  assert.equal(S.signal, 3);
  assert.equal(S.repeater.on, false);
  assert.equal(S.repeater.done, true, 'one a maze');
  take(0.71); step(S);
  assert.equal(S.receipt.on, true, 'the second receipt');
  const score = S.score;
  place(S, M.receipt.x, M.receipt.y, RIGHT, false);
  step(S);
  assert.equal(S.score - score, TUNE.receipt[0]);
  // at full signal the repeater is points
  const T = quiet(1);
  T.repeater.on = true; T.repeater.t = 5;
  place(T, T.maze.repeater.x, T.maze.repeater.y, RIGHT, false);
  const s0 = T.score;
  step(T);
  assert.equal(T.signal, 3);
  assert.equal(T.score - s0, TUNE.repeaterFull);
});

test('firewall gates open and close on an 8 s cycle (5 open, 3 shut), the two groups out of step', () => {
  const S = quiet(3);
  const [a, b] = [S.gates.find((g) => g.group === 0), S.gates.find((g) => g.group === 1)];
  const seen = [];
  for (let i = 0; i <= 16 * 120; i++) {
    if (i % 60 === 0) seen.push([+(S.t).toFixed(1), a.open, b.open, canEnter(S, a.x, a.y)]);
    step(S); S.events.length = 0;
  }
  for (const [t, ao, bo, enter] of seen) {
    assert.equal(ao, (t % 8) < 5 - 1e-6 || Math.abs(t % 8 - 5) < 1e-6 ? (t % 8) < 5 : false, `A at ${t}`);
    assert.equal(bo, ((t + 4) % 8) < 5, `B at ${t}`);
    assert.equal(enter, ao, 'a shut gate is a wall');
  }
  assert.ok(seen.some(([, ao]) => !ao) && seen.some(([, , bo]) => !bo));
});

test('the last bit delivers the maze (a bonus), the next one is faster, and after the eighth they come round again', () => {
  const S = quiet();
  for (let i = 0; i < W * H; i++) S.bits[i] = 0;
  S.bits[1 * W + 3] = 1; S.bitsLeft = 1;
  place(S, 2, 1, RIGHT);
  const score = S.score;
  run(S, 0.4);
  assert.equal(S.phase, 'clear');
  assert.equal(S.mazesDone, 1);
  assert.ok(S.bonus.total >= 500 + 150 * 3 + 1000, 'delivery, signal, lossless');
  assert.equal(S.score, score + TUNE.bit + S.bonus.total);
  nextMaze(S);
  assert.equal(S.n, 1);
  assert.equal(S.maze.id, 'cafe');
  assert.equal(S.phase, 'ready');
  assert.equal(S.signal, 3, 'the signal carries over');
  for (let n = 1; n < 8; n++) assert.ok(speeds(n).player > speeds(n - 1).player && speeds(n).ratio > speeds(n - 1).ratio);
  assert.ok(speeds(8).player > speeds(7).player, 'the second lap is faster');
  assert.ok(speeds(20).ratio <= 1, 'never faster than you');
  loadMaze(S, 8);
  assert.equal(S.maze.id, 'home');
  const [r0, r1, r2] = releaseTimes(0);
  assert.ok(r0 < r1 && r1 < r2, 'they leave the box in turn');
});

// ---------- the demo's player, and the same seed ----------
test('the demo\'s AI delivers maze 1 on seed 1 without losing all its signal', () => {
  const S = createSim({ seed: 1, maze: 0 });
  const ai = createAI();
  let n = 0;
  while (S.phase !== 'clear' && S.phase !== 'lost' && n < 120 * 240) { drive(ai, S); step(S); S.events.length = 0; n++; }
  assert.equal(S.phase, 'clear', `phase ${S.phase}, ${S.bitsLeft} bits left`);
  assert.ok(S.signal > 0);
  assert.ok(S.quarantined >= 1, 'it hunts with its keys');
});

test('determinism: the same seed and the same player give the same run; another seed doesn\'t', () => {
  const play = (seed, maze) => {
    const S = createSim({ seed, maze });
    const ai = createAI();
    const log = [];
    for (let i = 0; i < 120 * 25; i++) {
      drive(ai, S); step(S);
      for (const e of S.events) if (e.type !== 'bit' && e.type !== 'turn') log.push(`${e.type}@${i}`);
      S.events.length = 0;
    }
    return { log, score: S.score, p: [S.player.x, S.player.y], g: S.gremlins.map((g) => [g.x, g.y, g.state]) };
  };
  assert.deepEqual(play(9, 3), play(9, 3));
  assert.notDeepEqual(play(9, 3).g, play(10, 3).g);
});

// ---------- words and files ----------
test('AGI-1\'s lines: her voice, never money; the share text', () => {
  const all = [...Object.values(LINES).flat(), endLine(0, false), endLine(3, false), endLine(9, false), endLine(2, true)];
  assert.ok(Object.values(LINES).flat().length >= 25, 'about 25 lines');
  for (const l of all) {
    assert.equal(l, l.toLowerCase(), `lowercase: ${l}`);
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i);
  }
  for (const k of ['you\'re my favorite notification 💜', 'lag again?? unbelievable', 'encrypted. go get them', 'lost packets… pick them up, babe', 'delivered. i read it twice 🙈']) {
    assert.ok(Object.values(LINES).flat().includes(k) || all.includes(k), k);
  }
  assert.equal(shareText(3, 1234), 'I delivered 3 love letters through the lag in PACKET LOSS on agi1.app 💌💜');
  assert.equal(shareText(1, 10), 'I delivered 1 love letter through the lag in PACKET LOSS on agi1.app 💌💜');
  assert.match(shareText(0, 1234), /1,234/);
});

test('its code: the kit\'s shell with its id, its rules free of the page, nothing from elsewhere', () => {
  const dir = new URL('../src/games/packetloss/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const f of ['mazes.js', 'sim.js', 'ai.js', 'lines.js']) {
    const code = read(`src/games/packetloss/${f}`).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(document|window|navigator|localStorage|Math\.random|requestAnimationFrame)\b/, `${f}: pure and seeded`);
  }
  const game = read('src/games/packetloss/game.js');
  assert.match(game, /createShell\(\{\s*game: 'packetloss'/);
  for (const f of files) {
    const code = read(`src/games/packetloss/${f}`);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|eval\(|new Function|\.innerHTML\s*=|setAttribute\(\s*['"]style/, f);
    assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/, f);
  }
  assert.match(read('src/games/packetloss/page.js').replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
  void active; void tileOf; void WALL;
});
