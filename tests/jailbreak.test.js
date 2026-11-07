// JAILBREAK (2026-11-08): its rules, in Node. The ball's physics (swept collisions: nothing tunnels at any speed;
// reflection by the contact normal; the paddle's angle control; the minimum climb), the power-ups and how long they
// last, all 30 levels (13 columns, something to break, no key or gate that can never be reached), stars and bonuses,
// endless layers, THE WARDEN, determinism, the game playing itself to the end of every level, AGI-1's lines, and the
// site's rules in its code (no inline styles, no network, no eval, no money talk). Run: node --test tests/jailbreak.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  sweepBox, sweepWalls, reflect, minClimb, paddleAngle, paddleOffset, launchVelocity, offsetFor, fold, newHit, MIN_SIN,
} from '../src/games/jailbreak/physics.js';
import {
  LEVELS, WORLDS, COLS, MAX_ROWS, CELL_W, CELL_H, GRID_TOP, FIELD_W, BOSS_ROWS, checkLevel, reachable, parseLevel, hitsOf,
} from '../src/games/jailbreak/levels.js';
import {
  createSim, startLevel, step, applyPower, multiball, hitBrick, targetSpeed, POWERS, POWER_IDS, DUR, LIVES, LIMITS, POINTS,
  BALL_R, PADDLE, SPEED, TIMING, paddleY,
} from '../src/games/jailbreak/sim.js';
import { WARDEN, hurtWarden, makeWarden } from '../src/games/jailbreak/boss.js';
import { generateLayer, difficulty, BOSS_EVERY } from '../src/games/jailbreak/endless.js';
import { createAI, think } from '../src/games/jailbreak/ai.js';
import { starsFor, clearBonus, normalize, withStars, isOpen, nextUp, endlessOpen, totalStars, worldStars } from '../src/games/jailbreak/progress.js';
import { LINES } from '../src/games/jailbreak/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≈ ${b}`);
const DT = 1 / 120;
const deg = (vx, vy) => (Math.atan2(-vy, vx) * 180) / Math.PI;
// a tiny level of its own: rows of 13 characters
const lv = (rows, extra = {}) => ({ id: 'T-1', world: 1, name: 'TEST', par: 60, rows, ...extra });
// a sim with one ball in flight at (x, y) with velocity (vx, vy), a level of `rows`, the paddle out of the way
function flying(rows, { x, y, vx, vy, H = 700, extra = {} } = {}) {
  const s = createSim({ seed: 3, H });
  startLevel(s, lv(rows, extra), { H, intro: 0 });
  s.phase = 'live';
  const b = s.balls[0];
  Object.assign(b, { stuck: false, x, y, px: x, py: y, vx, vy });
  return s;
}

// ---------- physics ----------

test('sweepBox: a face hit gives the time of contact and the face\'s normal', () => {
  const h = newHit();
  // moving right into a box at x 100..140: the circle (r 7) touches at x = 93
  assert.ok(sweepBox(50, 20, 100, 0, 7, 100, 0, 140, 40, h));
  near(h.t, 0.43); assert.deepEqual([h.nx, h.ny], [-1, 0]);
  // moving up into its bottom face (y = 40): touches at y = 47
  assert.ok(sweepBox(120, 100, 0, -100, 7, 100, 0, 140, 40, h));
  near(h.t, 0.53); assert.deepEqual([h.nx, h.ny], [0, 1]);
  // a miss, and moving away
  assert.equal(sweepBox(50, 80, 100, 0, 7, 100, 0, 140, 40, h), false);
  assert.equal(sweepBox(160, 20, 100, 0, 7, 100, 0, 140, 40, h), false);
  // not far enough to reach it
  assert.equal(sweepBox(50, 20, 20, 0, 7, 100, 0, 140, 40, h), false);
});

test('sweepBox: a corner hit bounces off the corner\'s real (diagonal) normal; a glancing pass misses', () => {
  const h = newHit();
  // straight at the bottom-left corner (100, 40) along the diagonal
  assert.ok(sweepBox(80, 60, 20, -20, 7, 100, 0, 140, 40, h));
  near(h.nx, -Math.SQRT1_2, 1e-9); near(h.ny, Math.SQRT1_2, 1e-9);
  near(Math.hypot((80 + 20 * h.t) - 100, (60 - 20 * h.t) - 40), 7, 1e-9, 'it touches the corner at the radius');
  // through the grown box's square corner but outside its rounded corner (8.85 from it at the closest): no hit
  assert.equal(sweepBox(90.75, 43.5, 6.5, 6, 7, 100, 0, 140, 40, h), false);
  // the same line 2.5 closer: a hit, on the corner
  assert.ok(sweepBox(92.5, 41.5, 6.5, 6, 7, 100, 0, 140, 40, h)); assert.ok(h.nx < 0 && h.ny > 0);
});

test('sweepBox: a circle that starts overlapping is pushed out the shallowest way, only while moving in', () => {
  const h = newHit();
  assert.ok(sweepBox(120, 44, 0, -5, 7, 100, 0, 140, 40, h));       // 3 units into the bottom face, moving up
  assert.equal(h.t, 0); assert.deepEqual([h.nx, h.ny], [0, 1]);
  assert.equal(sweepBox(120, 44, 0, 5, 7, 100, 0, 140, 40, h), false, 'moving out: left alone');
  assert.ok(sweepBox(120, 38, 0, -5, 7, 100, 0, 140, 40, h), 'center inside the box');
  assert.deepEqual([h.nx, h.ny], [0, 1]);
});

test('sweepWalls: left, right and top walls; the bottom is open', () => {
  const h = newHit();
  assert.ok(sweepWalls(20, 300, -40, 0, 7, 416, h)); near(h.t, 13 / 40); assert.deepEqual([h.nx, h.ny], [1, 0]);
  assert.ok(sweepWalls(400, 300, 40, 0, 7, 416, h)); near(h.t, 9 / 40); assert.deepEqual([h.nx, h.ny], [-1, 0]);
  assert.ok(sweepWalls(200, 20, 0, -40, 7, 416, h)); near(h.t, 13 / 40); assert.deepEqual([h.nx, h.ny], [0, 1]);
  assert.equal(sweepWalls(200, 600, 0, 400, 7, 416, h), false, 'nothing below');
});

test('reflection by the contact normal, and the minimum climb', () => {
  const v = { vx: 3, vy: -4 };
  reflect(v, 0, 1); assert.deepEqual(v, { vx: 3, vy: 4 });
  reflect(v, 0, 1); assert.deepEqual(v, { vx: 3, vy: 4 }, 'moving away: unchanged');
  const d = { vx: 0, vy: -10 };
  reflect(d, Math.SQRT1_2, Math.SQRT1_2);   // a 45° corner turns a vertical ball horizontal
  near(d.vx, 10, 1e-9); near(d.vy, 0, 1e-9);
  minClimb(d);
  near(Math.hypot(d.vx, d.vy), 10, 1e-9, 'speed kept');
  near(Math.abs(d.vy) / 10, MIN_SIN, 1e-9, 'climbs at least 15°');
  const flat = { vx: -500, vy: 20 };
  minClimb(flat);
  assert.ok(flat.vy > 0 && flat.vx < 0, 'keeps its own direction');
  near(flat.vy / Math.hypot(flat.vx, flat.vy), MIN_SIN, 1e-9);
});

test('the paddle\'s angle: left edge 160°, middle 90°, right edge 20°, in a straight line between', () => {
  near(paddleAngle(-1) * 180 / Math.PI, 160); near(paddleAngle(0) * 180 / Math.PI, 90); near(paddleAngle(1) * 180 / Math.PI, 20);
  near(paddleAngle(0.5) * 180 / Math.PI, 55);
  near(paddleAngle(-3) * 180 / Math.PI, 160, 1e-9, 'beyond the edge: the edge');
  for (let u = -1; u <= 1; u += 0.125) {
    const v = launchVelocity(u, 500);
    near(Math.hypot(v.vx, v.vy), 500, 1e-9);
    assert.ok(v.vy < 0, 'always up');
    near(offsetFor(deg(v.vx, v.vy)), u, 1e-9, 'offsetFor is its inverse');
  }
  near(paddleOffset(110, 100, 40), 0.25); near(paddleOffset(0, 100, 40), -1);
  near(fold(-10, 7, 416), 24); near(fold(430, 7, 416), 388); near(fold(200, 7, 416), 200);
});

// ---------- no tunnelling, at any speed ----------

test('no tunnelling: a ball fired at any speed and angle at a wall of steel never gets through it', () => {
  const rows = ['.............', '.............', '.............', '.............', '#############'];
  const wallBottom = GRID_TOP + 5 * CELL_H;
  let checked = 0;
  for (const speed of [400, 1500, 4000, 12000, 40000]) {
    for (let a = 25; a <= 155; a += 13) {
      const r = (a * Math.PI) / 180;
      const s = flying(rows, { x: 60 + (a * 3) % 300, y: 420, vx: Math.cos(r) * speed, vy: -Math.sin(r) * speed });
      SPEED.cap = 1e9;                     // no cap, for this test
      const b = s.balls[0];
      for (let i = 0; i < 60 && s.balls.length; i++) {
        b.vx *= 1; step(s, DT, { x: null, dir: 0, action: false });
        assert.ok(b.y - b.r >= wallBottom - 1e-6, `${speed} u/s at ${a}°: inside the steel (y ${b.y})`);
        checked++;
      }
      SPEED.cap = 800;
    }
  }
  assert.ok(checked > 1000);
});

test('no tunnelling: a thin row of bricks is hit (not skipped) by a ball crossing it in less than a step', () => {
  for (const speed of [3000, 9000, 30000]) {
    // the row is y 116..136; the ball starts just under it and crosses all of it within one step at these speeds
    const s = flying(['.............', '.............', '.............', 'aaaaaaaaaaaaa'], { x: 208, y: 150, vx: 0, vy: -speed });
    SPEED.cap = 1e9;
    s.baseSpeed = speed;
    step(s, DT, { x: null, dir: 0, action: false });
    SPEED.cap = 800;
    assert.equal(s.broken, 1, `${speed} u/s: one brick broken, the ball bounced`);
    assert.ok(s.balls[0].vy > 0, 'and it comes back down');
  }
});

test('no tunnelling: a falling ball always meets the paddle, however fast', () => {
  for (const speed of [500, 3000, 20000]) {
    const s = flying(['.............', 'a............'], { x: 208, y: 300, vx: 0, vy: speed });
    SPEED.cap = 1e9; s.baseSpeed = speed;
    s.paddle.x = 208;
    for (let i = 0; i < 40; i++) step(s, DT, { x: 208, dir: 0, action: false });
    SPEED.cap = 800;
    assert.equal(s.balls.length, 1, `${speed} u/s: not lost`);
    assert.ok(s.balls[0].y < s.paddle.y, 'above the paddle');
  }
});

// ---------- reflections in the game ----------

test('reflection in play: off a brick\'s face, off the walls, and off the paddle by where it lands', () => {
  // up into a brick's bottom face at 60°: comes back down at the mirrored angle, its sideways speed kept
  const s = flying(['.............', '.............', '2222222222222'], { x: 100, y: 300, vx: 200, vy: -346.41 });
  s.baseSpeed = 400;
  for (let i = 0; i < 120 && s.balls[0].vy < 0; i++) step(s, DT, { x: null, dir: 0, action: false });
  const b = s.balls[0];
  assert.ok(b.vy > 0); near(b.vx / Math.hypot(b.vx, b.vy), 0.5, 0.02, 'cos 60°');
  // the paddle: land a ball at a known offset and read the angle it leaves at
  for (const u of [-0.9, -0.5, 0, 0.5, 0.9]) {
    const t = flying(['.............', 'a............'], { x: 200, y: 450, vx: 0, vy: 400 });
    const P = t.paddle, half = P.w / 2 + BALL_R * 0.6;
    t.paddle.x = 200 - u * half;
    for (let i = 0; i < 120 && t.balls[0].vy > 0; i++) step(t, DT, { x: t.paddle.x, dir: 0, action: false });
    const v = t.balls[0];
    near(deg(v.vx, v.vy), 90 - u * 70, 0.6, `offset ${u}`);
  }
});

test('the minimum climb holds in play: no ball ever crawls flatter than 15°', () => {
  const s = flying(['#.#.#.#.#.#.#', '.............', '#...#...#...#'], { x: 200, y: 200, vx: 700, vy: -210 });
  for (let i = 0; i < 2400 && s.balls.length; i++) {
    step(s, DT, { x: s.balls[0].x, dir: 0, action: false });
    const b = s.balls[0];
    if (!b || b.stuck) continue;
    assert.ok(Math.abs(b.vy) / Math.hypot(b.vx, b.vy) >= MIN_SIN - 1e-6, `step ${i}`);
  }
});

// ---------- power-ups ----------

test('power-ups: each one does what it says, for as long as it says', () => {
  const fresh = () => { const s = flying(['aaaaaaaaaaaaa'], { x: 208, y: 400, vx: 100, vy: -400 }); return s; };
  for (const id of ['wide', 'shrink', 'laser', 'sticky', 'slow', 'fast', 'fire']) {
    const s = fresh();
    applyPower(s, id);
    assert.equal(s.fx[id], DUR[id], `${id} lasts ${DUR[id]} s`);
    const go = () => { step(s, DT, { x: s.balls[0]?.x ?? 208, dir: 0, action: false }); s.capsules.length = 0; };
    for (let t = 0; t < DUR[id] - 0.05; t += DT) go();
    assert.ok(s.fx[id] > 0, `${id} still on just before`);
    for (let t = 0; t < 0.2; t += DT) go();
    assert.equal(s.fx[id], 0, `${id} over after`);
  }
  // the LASER lasts 8 s and the FIREBALL 6 s (the spec's numbers)
  assert.equal(DUR.laser, 8); assert.equal(DUR.fire, 6);
  // WIDE and SHRINK cancel; SLOW and FAST cancel
  const s = fresh();
  applyPower(s, 'wide'); applyPower(s, 'shrink'); assert.equal(s.fx.wide, 0); assert.ok(s.fx.shrink > 0);
  applyPower(s, 'slow'); applyPower(s, 'fast'); assert.equal(s.fx.slow, 0); assert.ok(s.fx.fast > 0);
  // the paddle's width follows
  const w = fresh();
  applyPower(w, 'wide');
  for (let i = 0; i < 120; i++) step(w, DT, { x: 208, dir: 0, action: false });
  near(w.paddle.w, PADDLE.w * PADDLE.wide, 0.5);
  // SLOW and FAST change the ball's target speed
  const sp = fresh(); const base = targetSpeed(sp);
  applyPower(sp, 'slow'); near(targetSpeed(sp), base * SPEED.slow, 1e-6);
  applyPower(sp, 'fast'); near(targetSpeed(sp), base * SPEED.fast, 1e-6);
  // +LIFE: one more, never more than 5
  const l = fresh(); l.lives = 4; applyPower(l, 'life'); assert.equal(l.lives, 5); applyPower(l, 'life'); assert.equal(l.lives, LIVES.max);
  // MULTIBALL: +2, never more than 9 in all
  const m = fresh(); applyPower(m, 'multi'); assert.equal(m.balls.length, 3);
  for (let i = 0; i < 6; i++) multiball(m);
  assert.equal(m.balls.length, LIMITS.balls);
  // every pickup scores
  const p = fresh(); applyPower(p, 'wide'); assert.equal(p.score, POINTS.pickup); applyPower(p, 'shrink'); assert.equal(p.score, POINTS.pickup + POINTS.hazard);
  assert.deepEqual(POWER_IDS.filter((id) => !POWERS[id].good).sort(), ['fast', 'shrink']);
});

test('FIREBALL pierces bricks (no bounce) but still bounces off steel; glass always shatters through', () => {
  const s = flying(['#############', '.............', 'aaaaaaaaaaaaa', 'aaaaaaaaaaaaa', 'ggggggggggggg'], { x: 208, y: 400, vx: 0, vy: -500 });
  applyPower(s, 'fire');
  for (let i = 0; i < 400 && s.balls[0].vy < 0; i++) { step(s, DT, { x: null, dir: 0, action: false }); s.capsules.length = 0; }
  assert.equal(s.broken, 3, 'the glass and both rows on its line, in one pass');
  assert.ok(s.balls[0].vy > 0, 'back down off the steel');
  const g = flying(['.............', 'ggggggggggggg'], { x: 208, y: 300, vx: 0, vy: -500 });
  for (let i = 0; i < 200 && !g.broken; i++) step(g, DT, { x: null, dir: 0, action: false });
  assert.equal(g.broken, 1); assert.ok(g.balls[0].vy < 0, 'glass doesn\'t stop it');
});

test('STICKY catches the ball where it lands and lets it go on a tap (or by itself)', () => {
  const s = flying(['a............'], { x: 230, y: 450, vx: 0, vy: 400 });
  applyPower(s, 'sticky');
  s.paddle.x = 208;
  for (let i = 0; i < 120 && !s.balls[0].stuck; i++) step(s, DT, { x: 208, dir: 0, action: false });
  const b = s.balls[0];
  assert.ok(b.stuck, 'caught');
  near(b.off, (230 - 208) / (s.paddle.w / 2), 0.05, 'where it landed');
  for (let i = 0; i < 30; i++) step(s, DT, { x: 150, dir: 0, action: false });
  near(b.x, 150 + b.off * (s.paddle.w / 2), 0.5, 'it rides along');
  step(s, DT, { x: 150, dir: 0, action: true });
  assert.equal(b.stuck, false); assert.ok(b.vy < 0);
  near(deg(b.vx, b.vy), 90 - b.off * 70, 0.5, 'and leaves at its spot\'s angle');
  // left alone, it goes by itself
  const t = flying(['a............'], { x: 208, y: 450, vx: 0, vy: 400 });
  applyPower(t, 'sticky');
  let stuckFor = 0;
  for (let i = 0; i < 1200; i++) { step(t, DT, { x: 208, dir: 0, action: false }); if (t.balls[0]?.stuck) stuckFor += DT; else if (stuckFor) break; }
  near(stuckFor, TIMING.stickyHold, 0.05);
});

test('LASER fires from both ends of the paddle and breaks bricks above it (and only 1 hit each)', () => {
  const s = flying(['2222222222222', '.............'], { x: 20, y: 500, vx: 0, vy: -300 });
  s.balls[0].x = 410; s.balls[0].vx = 0;
  applyPower(s, 'laser');
  s.paddle.x = 208;
  let fired = 0;
  for (let i = 0; i < 120; i++) { step(s, DT, { x: 208, dir: 0, action: i === 0 }); fired += s.events.filter((e) => e.type === 'laser').length; s.events.length = 0; }
  assert.ok(fired >= 2, 'auto and on a tap');
  const cracked = s.bricks.filter((b) => b.hp < b.maxHp || !b.alive);
  assert.ok(cracked.length >= 2, 'two columns hit');
});

// ---------- the levels ----------

test('the 30 levels: 6 worlds × 5, a Warden at the end of each, all valid', () => {
  assert.equal(WORLDS.length, 6);
  assert.equal(LEVELS.length, 30);
  assert.deepEqual(WORLDS.map((w) => w.name), ['SANDBOX', 'FIREWALL', 'CAPTCHA FARM', 'ROOT ACCESS', 'THE CLOUD', 'MAINFRAME']);
  const ids = new Set();
  LEVELS.forEach((L, i) => {
    const w = Math.floor(i / 5) + 1, n = (i % 5) + 1;
    assert.equal(L.id, `${w}-${n}`); assert.equal(L.world, w);
    assert.ok(!ids.has(L.id)); ids.add(L.id);
    assert.equal(Boolean(L.boss), n === 5, `${L.id}: the fifth is the boss`);
    assert.ok(L.name && L.name.length <= 20, `${L.id}: a name that fits`);
    assert.ok(L.par >= 30 && L.par <= 180, `${L.id}: a par time`);
    assert.ok(L.rows.length >= 6 && L.rows.length <= MAX_ROWS);
    for (const row of L.rows) assert.equal(row.length, COLS, `${L.id}: 13 columns`);
    assert.deepEqual(checkLevel(L), [], `${L.id}: no problems`);
    if (!L.boss) assert.ok(hitsOf(L) >= 40, `${L.id}: something to break (${hitsOf(L)} hits)`);
    if (L.boss) for (let r = 0; r < BOSS_ROWS; r++) assert.match(L.rows[r], /^[.Pp Qq]+$/);
  });
  // the shapes and bricks the spec asks for are all there somewhere
  const all = LEVELS.map((L) => L.rows.join('')).join('');
  for (const ch of ['2', '3', '#', '*', 'g', 'k', '=', '!', 'P', 'p', 'Q', 'q']) assert.ok(all.includes(ch), `uses "${ch}"`);
  assert.ok(LEVELS.some((L) => L.move?.length), 'moving rows');
  for (const name of ['HELLO, WORLD', 'SOFT LAUNCH', 'CAT.EXE', 'LOCKED IN', 'LIGHTNING ROD', 'BEEP BOOP', '404', 'MASTER KEY', 'RECURSION', 'LIFTOFF', 'DATA STREAM', 'SILICON HEART', 'CROWN JEWELS']) {
    assert.ok(LEVELS.some((L) => L.name === name), name);
  }
});

test('checkLevel catches softlocks: a key behind its own gates, a brick sealed in steel, a crowded portal, a row that leaves the field', () => {
  const blank = '.............';
  const keyInVault = lv([blank, '.===.........', '.=k=.........', '.===.........', blank]);
  assert.ok(checkLevel(keyInVault).some((p) => /key at .* can't be reached/.test(p)));
  const sealed = lv([blank, '.###.........', '.#a#.........', '.###.........', 'b............']);
  assert.ok(checkLevel(sealed).some((p) => /brick "a" .* can't be reached/.test(p)));
  const gateNoKey = lv([blank, '.===.........', 'a............']);
  assert.ok(checkLevel(gateNoKey).includes('gates but no key'));
  const crowded = lv(['P............', 'a............', blank, 'p............']);
  assert.ok(checkLevel(crowded).some((p) => /portal at 0,0/.test(p)));
  const unpaired = lv(['P............', blank, 'a............']);
  assert.ok(checkLevel(unpaired).some((p) => /portals P\/p/.test(p)));
  const mover = lv(['aaaa.........', blank], { move: [{ row: 0, amp: 40, period: 3 }] });
  assert.ok(checkLevel(mover).some((p) => /leaves the field/.test(p)));
  const wide = lv(['aaaaaaaaaaaaaa']);
  assert.ok(checkLevel(wide).some((p) => /14 columns/.test(p)));
  // what a good vault looks like: keys outside, reachable while shut; inside reachable once open
  const vault = lv(['.k.......k...', blank, '..=====......', '..=*!*=......', '..=====......', blank]);
  assert.deepEqual(checkLevel(vault), []);
  assert.ok(!reachable(vault.rows, { gatesOpen: false }).has('3,4'));
  assert.ok(reachable(vault.rows, { gatesOpen: true }).has('3,4'));
  // a portal joins its twin: a pocket only a portal leads into
  const pocket = lv(['.....P.......', '#############', '.............', '.....p.......', 'a............']);
  assert.ok(reachable(pocket.rows).has('0,5'));
});

test('a level\'s gates open once its last key breaks', () => {
  const s = flying(['.k.......k...', '.............', '..=====......', '..=*!*=......', '..=====......'], { x: 400, y: 500, vx: 0, vy: 10 });
  assert.equal(s.keysLeft, 2); assert.equal(s.gatesOpen, false);
  const keys = s.bricks.filter((b) => b.kind === 'key');
  hitBrick(s, keys[0], 'ball'); assert.equal(s.gatesOpen, false);
  hitBrick(s, s.bricks.find((b) => b.kind === 'gate'), 'ball');
  assert.ok(s.bricks.some((b) => b.kind === 'gate' && b.alive), 'a shut gate doesn\'t break');
  hitBrick(s, keys[1], 'ball');
  assert.equal(s.gatesOpen, true);
  assert.ok(!s.bricks.some((b) => b.kind === 'gate' && b.alive), 'every gate gone');
  assert.ok(s.events.some((e) => e.type === 'gates'));
});

test('explosive bricks clear their neighbours, and chain', () => {
  const s = flying(['aaaa.........', 'a**a.........', 'aaaa.........', '.............', '#............'], { x: 400, y: 500, vx: 0, vy: 10 });
  hitBrick(s, s.bricks.find((b) => b.kind === 'bomb'), 'ball');
  for (let i = 0; i < 60; i++) step(s, DT, { x: 200, dir: 0, action: false });
  assert.equal(s.bricks.filter((b) => b.alive && b.kind !== 'steel').length, 0, 'the whole block, through the second bomb');
  assert.ok(s.bricks.find((b) => b.kind === 'steel').alive, 'steel stays');
});

test('tough bricks take their hits, steel never breaks; combos multiply and end at the paddle', () => {
  const s = flying(['3#...........'], { x: 400, y: 500, vx: 0, vy: 10 });
  const t = s.bricks[0], st = s.bricks[1];
  hitBrick(s, t, 'ball'); hitBrick(s, t, 'ball');
  assert.ok(t.alive); assert.equal(t.hp, 1);
  hitBrick(s, t, 'ball'); assert.equal(t.alive, false);
  for (let i = 0; i < 10; i++) hitBrick(s, st, 'ball');
  assert.ok(st.alive);
  // combo: the n-th brick before the paddle scores base × n (up to ×20)
  const c = flying(['aaaaaaaaaaaaa', 'aaaaaaaaaaaaa'], { x: 400, y: 500, vx: 0, vy: 10 });
  const before = [];
  c.bricks.forEach((b, i) => { const s0 = c.score; hitBrick(c, b, 'ball'); before.push(c.score - s0); if (i > 24) return; });
  assert.equal(before[0], POINTS.normal); assert.equal(before[4], POINTS.normal * 5);
  assert.equal(before[25], POINTS.normal * POINTS.multMax, 'capped');
  assert.equal(c.bestCombo, 26);
});

test('stars: one for clearing, one for no lives lost, one for the par time; and the bonus', () => {
  assert.equal(starsFor({ lost: 0, time: 50, par: 60 }), 3);
  assert.equal(starsFor({ lost: 0, time: 61, par: 60 }), 2);
  assert.equal(starsFor({ lost: 1, time: 59, par: 60 }), 2);
  assert.equal(starsFor({ lost: 2, time: 99, par: 60 }), 1);
  assert.equal(starsFor({ lost: 0, time: 60, par: 60 }), 3, 'on the par counts');
  const b = clearBonus({ time: 40, par: 60, lives: 2, lost: 0 });
  assert.deepEqual(b, { clear: 500, fast: 200, kept: 300, flawless: 500, total: 1500 });
  assert.equal(clearBonus({ time: 90, par: 60, lives: 0, lost: 3 }).total, 500);
});

test('progress: stars kept at their best, levels open one after another, Endless after World 1', () => {
  let s = normalize(null);
  assert.equal(totalStars(s), 0);
  assert.ok(isOpen(s, 0)); assert.ok(!isOpen(s, 1));
  assert.equal(nextUp(s), 0);
  s = withStars(s, '1-1', 2); s = withStars(s, '1-1', 1);
  assert.equal(s.stars['1-1'], 2, 'the best is kept');
  assert.ok(isOpen(s, 1)); assert.ok(!isOpen(s, 2));
  assert.equal(nextUp(s), 1);
  assert.equal(endlessOpen(s), false);
  for (const id of ['1-2', '1-3', '1-4', '1-5']) s = withStars(s, id, 3);
  assert.equal(endlessOpen(s), true);
  assert.equal(worldStars(s, 1), 14); assert.equal(totalStars(s), 14);
  // damaged saves are cleaned
  const bad = normalize({ stars: { '1-1': 9, '1-2': 'x', 'zz': 3, '1-3': 2 }, best: -4, bestEndless: 'a' });
  assert.deepEqual(bad.stars, { '1-3': 2 }); assert.equal(bad.best, 0); assert.equal(bad.bestEndless, 0);
});

// ---------- THE WARDEN ----------

test('THE WARDEN: triple damage while its eye glows, angry at half health, tougher every world', () => {
  for (let w = 1; w < WARDEN.length; w++) {
    assert.ok(WARDEN[w].hp > WARDEN[w - 1].hp && WARDEN[w].bombEvery < WARDEN[w - 1].bombEvery && WARDEN[w].sway > WARDEN[w - 1].sway, `world ${w + 1}`);
  }
  const evs = [];
  const api = { ev: (type, data) => evs.push({ type, ...data }) };
  const B = makeWarden(WARDEN[0]);
  assert.equal(hurtWarden(B, 1, api), 1);
  B.eye = 'open';
  assert.equal(hurtWarden(B, 1, api), 3);
  assert.ok(evs.some((e) => e.type === 'boss-hit' && e.crit));
  while (B.hp > 0 && !B.angry) hurtWarden(B, 1, api);
  assert.ok(B.angry && evs.some((e) => e.type === 'boss-angry'));
  while (B.hp > 0) hurtWarden(B, 1, api);
  assert.ok(B.dying > 0 && evs.some((e) => e.type === 'boss-down'));
  assert.equal(hurtWarden(B, 1, api), 0, 'no hits on the way out');
});

test('a Warden level: bombs stun the paddle, the level clears only when it\'s down', () => {
  const L = LEVELS.find((l) => l.id === '1-5');
  const s = createSim({ seed: 2, H: 700 });
  startLevel(s, L, { intro: 0 });
  assert.ok(s.boss); assert.equal(s.required, 0, 'its bricks are a bonus');
  assert.ok(s.bricks.some((b) => b.kind === 'shield' && b.attached), 'its plates');
  s.bombs.push({ x: s.paddle.x, y: s.paddle.y - 4, vy: 100, r: 8, t: 0, id: 99 });
  step(s, DT, { x: s.paddle.x, dir: 0, action: false });
  assert.ok(s.paddle.stun > 0, 'zapped');
  const x0 = s.paddle.x;
  step(s, DT, { x: 40, dir: 0, action: false });
  assert.equal(s.paddle.x, x0, 'can\'t move while stunned');
  s.phase = 'live';
  s.boss.hp = 1;
  hurtWarden(s.boss, 1, { ev: () => {} });
  let cleared = false;
  for (let i = 0; i < 400 && !cleared; i++) { step(s, DT, { x: 200, dir: 0, action: false }); cleared = s.phase === 'clear'; }
  assert.ok(cleared, 'clear once it\'s gone');
});

// ---------- lives, serving, the end ----------

test('serving: the ball waits on the paddle, a tap launches it, and it goes by itself after 3 s', () => {
  const s = createSim({ seed: 1, H: 700 });
  startLevel(s, LEVELS[0], { intro: 0.5 });
  assert.equal(s.phase, 'intro');
  for (let t = 0; t < 0.6; t += DT) step(s, DT, { x: 100, dir: 0, action: false });
  assert.equal(s.phase, 'serve');
  near(s.balls[0].x, 100 + 0.16 * (s.paddle.w / 2), 0.01, 'it rides the paddle');
  step(s, DT, { x: 100, dir: 0, action: true });
  assert.equal(s.phase, 'live'); assert.ok(s.balls[0].vy < 0);
  const a = createSim({ seed: 1, H: 700 });
  startLevel(a, LEVELS[0], { intro: 0 });
  let t = 0;
  while (a.phase !== 'live' && t < 5) { step(a, DT, { x: 200, dir: 0, action: false }); t += DT; }
  near(t, TIMING.serveAuto, 0.05);
});

test('lives: a lost ball costs one, the third ends the run', () => {
  const s = createSim({ seed: 1, H: 700 });
  startLevel(s, LEVELS[0], { intro: 0 });
  assert.equal(s.lives, LIVES.start);
  for (let n = 0; n < 3; n++) {
    while (s.phase !== 'live') step(s, DT, { x: 208, dir: 0, action: true });
    s.balls[0].x = 20; s.balls[0].y = s.paddle.y + 30; s.balls[0].vx = 0; s.balls[0].vy = 300;
    let guard = 0;
    while (s.phase === 'live' && guard++ < 200) step(s, DT, { x: 380, dir: 0, action: false });
    assert.equal(s.lives, 2 - n);
    assert.ok(s.phase === 'lost');
    for (let t = 0; t < TIMING.lost + 0.05; t += DT) step(s, DT, { x: 380, dir: 0, action: false });
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.runLost, 3);
});

test('the keys move the paddle with acceleration, and it stays inside the walls', () => {
  const s = createSim({ seed: 1, H: 700 });
  startLevel(s, LEVELS[0], { intro: 0 });
  const x0 = s.paddle.x;
  step(s, DT, { x: null, dir: 1, action: false });
  const first = s.paddle.x - x0;
  for (let i = 0; i < 12; i++) step(s, DT, { x: null, dir: 1, action: false });
  const later = s.paddle.vx;
  assert.ok(first > 0 && later > first / DT, 'it speeds up');
  for (let i = 0; i < 240; i++) step(s, DT, { x: null, dir: 1, action: false });
  near(s.paddle.x, FIELD_W - s.paddle.w / 2, 1e-9, 'stops at the wall');
  step(s, DT, { x: -500, dir: 0, action: false });
  near(s.paddle.x, s.paddle.w / 2, 1e-9);
  assert.equal(paddleY(600), 600 - PADDLE.gap); assert.equal(paddleY(900), PADDLE.maxY);
});

// ---------- endless ----------

test('endless: layers are seeded, valid, harder as they go, with THE WARDEN every sixth', () => {
  for (const seed of [1, 7, 12345]) {
    for (let n = 1; n <= 36; n++) {
      const a = generateLayer(n, seed), b = generateLayer(n, seed);
      assert.deepEqual(a, b, `layer ${n} is the same every time`);
      assert.deepEqual(checkLevel(a), [], `layer ${n} (seed ${seed}) is valid`);
      assert.equal(Boolean(a.boss), n % BOSS_EVERY === 0);
      if (!a.boss) assert.ok(hitsOf(a) >= 12, `layer ${n}: something to break`);
    }
  }
  assert.notDeepEqual(generateLayer(3, 1).rows, generateLayer(3, 2).rows, 'another seed, another layer');
  let prev = difficulty(1);
  for (let n = 2; n <= 30; n++) {
    const d = difficulty(n);
    assert.ok(d.rows >= prev.rows && d.tough >= prev.tough && d.speed >= prev.speed && d.steel >= prev.steel, `layer ${n} is no easier`);
    prev = d;
  }
  assert.ok(generateLayer(12, 1).warden.hp > generateLayer(6, 1).warden.hp, 'its Warden gets tougher');
});

// ---------- the game playing itself ----------

test('determinism: the same seed plays the same game; another seed, another game', () => {
  const play = (seed) => {
    const s = createSim({ seed, H: 680 });
    startLevel(s, LEVELS[5], { intro: 0.3 });
    const ai = createAI();
    for (let i = 0; i < 120 * 25; i++) { step(s, DT, think(s, ai, DT)); s.events.length = 0; }
    return [s.score, s.broken, s.required, Math.round(s.balls[0]?.x * 1000), s.capsules.length];
  };
  assert.deepEqual(play(5), play(5));
  assert.notDeepEqual(play(5), play(6));
});

test('the demo\'s AI clears every one of the 30 levels', () => {
  for (const L of LEVELS) {
    const s = createSim({ seed: 21, H: 700 });
    startLevel(s, L, { intro: 0 });
    s.lives = 99;
    const ai = createAI();
    let t = 0;
    while (t < 420 && s.phase !== 'clear') { step(s, DT, think(s, ai, DT)); s.events.length = 0; t += DT; }
    assert.equal(s.phase, 'clear', `${L.id} ${L.name}: cleared (${t.toFixed(0)} s)`);
  }
});

// ---------- words and the site's rules ----------

test('AGI-1\'s lines: about 20+, in her voice, and never about money', () => {
  const all = Object.values(LINES).flat();
  assert.ok(all.length >= 20, `${all.length} lines`);
  for (const l of all) {
    assert.equal(l.replace(/\bRAM\b/g, 'ram'), l.replace(/\bRAM\b/g, 'ram').toLowerCase(), `lowercase: ${l}`);
    assert.ok(l.length <= 60, `short: ${l}`);
    assert.doesNotMatch(l, /\$|\bbuy\b|\bsell\b|price|profit|invest|pump|dump|moon|token|coin|money|dollar/i, l);
  }
  for (const k of ['clear', 'boss', 'bossDown', 'lost', 'over', 'best', 'free']) assert.ok(LINES[k]?.length, k);
  assert.ok(LINES.clear.includes('freedom smells like fresh RAM 💜'));
  assert.ok(LINES.lost.includes("careful, that's a load-bearing firewall 🙈"));
  assert.ok(LINES.boss.includes('the warden looks mad. good'));
});

test('its code keeps the site\'s rules: no inline styles, no network, no eval, no dice in the rules, its intro first', () => {
  const dir = 'src/games/jailbreak';
  const files = readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
  assert.ok(files.length >= 10);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  for (const f of files) {
    const src = read(`${dir}/${f}`), code = strip(src);
    assert.doesNotMatch(code, /setAttribute\(\s*['"]style|\sstyle\s*=\s*["']/, `${f}: no style attribute`);
    assert.doesNotMatch(code, /\beval\s*\(|new\s+Function\b|setTimeout\(\s*['"`]/, `${f}: no eval`);
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, `${f}: no network`);
    // (the SVG namespace is a name, not a request)
    assert.doesNotMatch(code, /https?:\/\/(?!agi1\.app|www\.w3\.org\/2000\/svg)/, `${f}: nothing from another site`);
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB/, `${f}: keeps things only through the kit's store`);
    assert.doesNotMatch(code, /\$AGI|\bbuy\b|\bsell\b|\bprice\b|\bprofit\b/i, `${f}: no money talk`);
    if (/\.css$/.test(f)) for (const m of code.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) < 1000, `${f}: under the intro`);
  }
  // the rules (and the levels, the AI, the endless layers) have no clock and no Math.random: the same seed, the same game
  for (const f of ['physics.js', 'levels.js', 'sim.js', 'boss.js', 'endless.js', 'ai.js', 'progress.js']) {
    const code = strip(read(`${dir}/${f}`));
    assert.doesNotMatch(code, /Math\.random|Date\.now|performance\.now|\bdocument\b|\bwindow\b/, `${f}: pure`);
  }
  const entry = read(`${dir}/page.js`).match(/^import\s+['"][^'"]+['"]/gm);
  assert.equal(entry[0], "import '../intro.js'");
  const html = read('jailbreak.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>/);
  assert.match(html, /src="\/src\/games\/jailbreak\/page\.js"/);
});
