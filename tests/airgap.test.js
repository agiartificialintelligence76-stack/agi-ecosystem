// AIR GAP (2026-11-09): air hockey against AGI-1 on the arcade kit. Its pure parts run here in Node: the table's
// physics (no tunnelling at full speed, the rails' bounce, the mallets' speed cap and halves, the hit's direction, a
// squeezed puck), the match's rules (goals only through the mouth, the serve, the stall rule, first to N, the power-ups
// and their timers), her brain (her half, her defence), her ladder, the screen's two ways up and two players' fingers,
// the deterministic maths, the demo's opening (a power-up and goals inside the preview's recording) and her words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { W, H, MID, PUCK_R, MALLET_R, BIG, MOUTH, PUCK_MAX, MALLET_MAX, DRAG, buildWalls, makePuck, makeMallet, stepPhysics, confine, mouthOf, scored } from '../src/games/airgap/physics.js';
import { createMatch, stepMatch, spawnChip, STALL, SERVE_BREATH, GOAL_TIME, WIN_TIME, DURATION, KINDS, isOn, lagged, splitOn, CHIP_IN, SERVE_Y, LABEL } from '../src/games/airgap/match.js';
import { createBrain, think, PERSONAS, project, timeTo } from '../src/games/airgap/ai.js';
import { SETTINGS, TOP, readSave, recordMatch, starsFor } from '../src/games/airgap/ladder.js';
import { fitTable, toScreen, toTable, dirToTable, dirToScreen, sideOfTouch, touchTarget } from '../src/games/airgap/layout.js';
import { createDemo, rigTick, demoSeed, DEMO_SEEDS, DEMO_LEVELS } from '../src/games/airgap/demo.js';
import { dexp, dlog, dsin, dcos, len } from '../src/games/airgap/dmath.js';
import { LINES } from '../src/games/airgap/lines.js';

const DT = 1 / 120;
const [ML, MR] = mouthOf(false);
const world = (pucks, mallets = []) => ({ pucks, mallets, walls: buildWalls(), puckMax: PUCK_MAX, drag: DRAG });
const parked = (side) => { const m = makeMallet(side); m.x = m.tx = m.px = 60; m.y = m.ty = m.py = side === 0 ? MID + MALLET_R + 2 : MID - MALLET_R - 2; return m; };
// inside the playfield, or in a goal's slot (through its mouth)
const onTable = (p) => (p.y >= -60 - PUCK_R && p.y <= H + 60 + PUCK_R) && (p.y > 0 && p.y < H ? p.x >= PUCK_R - 1 && p.x <= W - PUCK_R + 1 : p.x >= ML - 1 && p.x <= MR + 1);

test('a full-speed puck never tunnels through a rail, at any angle', () => {
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const p = makePuck(1, W / 2, MID, Math.cos(a) * PUCK_MAX, Math.sin(a) * PUCK_MAX);
    const S = world([p]);
    for (let k = 0; k < 240 && scored(p) < 0; k++) {
      stepPhysics(S, DT);
      assert.ok(!p.lost && onTable(p), `angle ${i}: off the table at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`);
      assert.ok(Math.hypot(p.vx, p.vy) <= PUCK_MAX + 1e-6, 'never faster than its cap');
    }
  }
});

test('a full-speed puck never tunnels through a mallet, standing or sweeping', () => {
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const m = makeMallet(0);
    m.x = m.px = m.tx = W / 2; m.y = m.py = m.ty = 750;
    const p = makePuck(1, W / 2 + Math.cos(a) * 200, 750 + Math.sin(a) * 200, -Math.cos(a) * PUCK_MAX, -Math.sin(a) * PUCK_MAX);
    const S = world([p], [m]);
    let closest = Infinity, bounced = null;
    for (let k = 0; k < 60; k++) {
      const ev = [];
      stepPhysics(S, DT, ev);
      closest = Math.min(closest, Math.hypot(p.x - m.x, p.y - m.y));
      if (bounced === null && ev.some((e) => e.type === 'hit')) bounced = (p.x - m.x) * p.vx + (p.y - m.y) * p.vy > 0;
    }
    assert.ok(closest >= PUCK_R + MALLET_R - 1.5, `angle ${i}: ${closest.toFixed(2)} apart at the closest`);
    assert.equal(bounced, true, `angle ${i}: it bounced back off the mallet`);
  }
  // a mallet swept at full speed through a still puck hits it (never passes under it)
  for (const y of [700, 730, 760, 790]) {
    const m = makeMallet(0);
    m.x = m.px = 60; m.y = m.py = 750; m.tx = W - 60; m.ty = 750;
    const p = makePuck(1, W / 2, y);
    const S = world([p], [m]);
    let closest = Infinity, sent = null;
    for (let k = 0; k < 40; k++) {
      const ev = [];
      stepPhysics(S, DT, ev);
      closest = Math.min(closest, Math.hypot(p.x - m.x, p.y - m.y));
      if (sent === null && ev.some((e) => e.type === 'hit')) sent = p.vx;
    }
    assert.ok(sent > 600, `the sweep sent it on (y ${y}: vx ${sent})`);
    assert.ok(closest >= PUCK_R + MALLET_R - 1.5);
  }
});

test('the rails bounce it back at about 0.9, the air table lets it glide', () => {
  const p = makePuck(1, 150, MID, -1000, 0);
  const S = world([p]);
  let before = 0;
  while (p.vx < 0) { before = p.vx; stepPhysics(S, DT); }
  const ratio = p.vx / -before;
  assert.ok(ratio > 0.85 && ratio <= 0.9 + 1e-9, `restitution ${ratio.toFixed(3)}`);
  // a slide along it is barely touched (never stopped dead)
  const q = makePuck(2, 200, 400, -900, 300);
  const S2 = world([q]);
  let vy0 = 0;
  while (q.vx < 0) { vy0 = q.vy; stepPhysics(S2, DT); }
  assert.ok(q.vy / vy0 > 0.94 && q.vy / vy0 < 1, 'it keeps nearly all of its slide along the rail');
  // a free puck: about 15% slower after a second (low friction), and a crawling one comes to rest
  const r = makePuck(3, W / 2, 30, 0, 1000);
  const S3 = world([r]);
  for (let k = 0; k < 120; k++) stepPhysics(S3, DT);
  const s = Math.hypot(r.vx, r.vy);
  assert.ok(s > 820 && s < 880, `after a second: ${s.toFixed(0)}`);
  const c = makePuck(4, W / 2, 300, 0, 4);
  const S4 = world([c]);
  for (let k = 0; k < 240; k++) stepPhysics(S4, DT);
  assert.equal(Math.hypot(c.vx, c.vy), 0, 'a crawling puck stops');
});

test('mallets: capped speed, never past the air gap or the rails', () => {
  for (const side of [0, 1]) {
    const m = makeMallet(side);
    const S = world([], [m]);
    for (const [tx, ty] of [[W / 2, side === 0 ? 0 : H], [-300, H / 2], [W + 300, side === 0 ? H + 300 : -300], [10, side === 0 ? H - 5 : 5], [W / 2, MID]]) {
      m.tx = tx; m.ty = ty;
      for (let k = 0; k < 90; k++) {
        const x0 = m.x, y0 = m.y;
        stepPhysics(S, DT);
        assert.ok(Math.hypot(m.x - x0, m.y - y0) <= MALLET_MAX * DT + 1e-6, 'never faster than its cap (a flick sweeps, never teleports)');
        assert.ok(side === 0 ? m.y >= MID + m.r - 1e-9 : m.y <= MID - m.r + 1e-9, 'its whole body stays in its half');
        assert.ok(m.x >= m.r - 1e-9 && m.x <= W - m.r + 1e-9 && m.y >= m.r - 1e-9 && m.y <= H - m.r + 1e-9, 'inside the rails');
      }
    }
  }
  const c = confine(-50, H + 50, MALLET_R, 0);
  assert.ok(Math.hypot(c.x - 80, c.y - (H - 80)) <= 80 - MALLET_R + 1e-9, 'tucked into the rounded corner');
});

test('a hit sends the puck where the mallet pushes it, with the mallet\'s speed (restitution 0.95)', () => {
  const m = makeMallet(0);
  m.x = m.px = W / 2; m.y = m.py = 900; m.tx = W / 2; m.ty = 500; m.max = 800;
  const p = makePuck(1, W / 2, 780);
  const S = world([p], [m]);
  const ev = [];
  for (let k = 0; k < 40 && !ev.length; k++) stepPhysics(S, DT, ev);
  assert.equal(ev[0]?.type, 'hit');
  assert.equal(ev[0].side, 0);
  assert.ok(Math.abs(p.vx) < 1 && p.vy < -1450 && p.vy > -1600, `straight up the table at about 1.95× the mallet: ${p.vy.toFixed(0)}`);
  // an off-centre hit: along the line between their centres
  const m2 = makeMallet(0);
  m2.x = m2.px = 260; m2.y = m2.py = 900; m2.tx = 260; m2.ty = 500; m2.max = 800;
  const q = makePuck(2, 300, 780);
  const S2 = world([q], [m2]);
  for (let k = 0; k < 40 && q.vy === 0; k++) stepPhysics(S2, DT);
  assert.ok(q.vx > 100 && q.vy < 0, 'glanced off to the right');
  // the cap holds for a smash
  const m3 = makeMallet(0);
  m3.x = m3.px = W / 2; m3.y = m3.py = 960; m3.tx = W / 2; m3.ty = 0;
  const r = makePuck(3, W / 2, 700, 0, 2600);
  const S3 = world([r], [m3]);
  for (let k = 0; k < 40; k++) { stepPhysics(S3, DT); assert.ok(Math.hypot(r.vx, r.vy) <= PUCK_MAX + 1e-6); }
});

test('a puck squeezed against a rail by a mallet is held cleanly, and isn\'t flung when let go', () => {
  for (const [px, py, mx, my] of [[PUCK_R + 2, 760, 140, 760], [W - PUCK_R - 2, 300, W - 140, 300], [90, H - 90, 200, H - 200]]) {
    const side = py > MID ? 0 : 1;
    const m = makeMallet(side);
    m.x = m.px = mx; m.y = m.py = my; m.tx = px + (px - mx); m.ty = py + (py - my);
    const p = makePuck(1, px, py);
    const S = world([p], [m]);
    for (let k = 0; k < 120; k++) {
      stepPhysics(S, DT);
      assert.ok(onTable(p) && Number.isFinite(p.vx), 'never pushed through the rail');
      assert.ok(Math.hypot(p.x - m.x, p.y - m.y) >= PUCK_R + MALLET_R - 1, 'never inside the mallet');
    }
    assert.ok(Math.hypot(p.vx, p.vy) < 250, `held, not pumped up: ${Math.hypot(p.vx, p.vy).toFixed(0)}`);
    m.tx = W / 2; m.ty = side === 0 ? 800 : 200;
    let fastest = 0;
    for (let k = 0; k < 60; k++) { stepPhysics(S, DT); fastest = Math.max(fastest, Math.hypot(p.vx, p.vy)); }
    assert.ok(fastest < 400, `let go, it isn't fired out: ${fastest.toFixed(0)}`);
  }
});

function shoot(M, x, toward, speed = 1500) {
  M.phase = 'play'; M.phaseT = 0;
  M.mallets[0] = parked(0); M.mallets[1] = parked(1);
  M.pucks = [makePuck(99, x, toward === 0 ? 700 : 300, 0, toward === 0 ? speed : -speed)];
  M.last = 1 - toward;
  M.ev.length = 0;
  for (let k = 0; k < 120; k++) {
    stepMatch(M, DT);
    const g = M.ev.find((e) => e.type === 'goal');
    if (g) return g;
    M.ev.length = 0;
  }
  return null;
}

test('a goal only through the mouth (the whole puck past the line); PATCH halves it', () => {
  for (const x of [ML + PUCK_R + 4, W / 2, MR - PUCK_R - 4]) {
    const g = shoot(createMatch({ seed: 1, powerups: false }), x, 0);
    assert.ok(g && g.side === 1, `x ${x}: in, for her`);
    const g2 = shoot(createMatch({ seed: 1, powerups: false }), x, 1);
    assert.ok(g2 && g2.side === 0, `x ${x}: in, for you`);
  }
  for (const x of [PUCK_R + 10, ML - PUCK_R - 6, MR + PUCK_R + 6, W - PUCK_R - 10]) {
    const M = createMatch({ seed: 1, powerups: false });
    assert.equal(shoot(M, x, 0), null, `x ${x}: off the end rail, no goal`);
    assert.deepEqual(M.score, [0, 0]);
  }
  // PATCH on your goal: a shot that would have gone in near the post bounces out
  const M = createMatch({ seed: 1 });
  M.active[0] = { kind: 'patch', t: 8, dur: 8 };
  assert.equal(shoot(M, ML + PUCK_R + 4, 0), null, 'the patch covers the outer part of the mouth');
  const [pl, pr] = mouthOf(true);
  assert.equal(pr - pl, MOUTH / 2);
  assert.ok(shoot(M, W / 2, 0), 'the middle is still open');
});

test('the serve: still on the conceder\'s side, live after a one-second breath; a goal serves to who let it in', () => {
  const M = createMatch({ seed: 3, powerups: false });
  assert.equal(M.phase, 'serve');
  assert.equal(M.pucks.length, 1);
  assert.deepEqual([M.pucks[0].x, M.pucks[0].y, M.pucks[0].vx, M.pucks[0].vy], [W / 2, SERVE_Y[0], 0, 0]);
  M.mallets[0] = parked(0); M.mallets[1] = parked(1);
  let live = -1;
  for (let k = 0; k < 240 && live < 0; k++) { stepMatch(M, DT); if (M.ev.some((e) => e.type === 'live')) live = M.t; M.ev.length = 0; }
  assert.ok(Math.abs(live - SERVE_BREATH) < 0.02, `live after ${live}`);
  assert.equal(M.phase, 'play');
  const g = shoot(M, W / 2, 0);
  assert.equal(g.side, 1);
  assert.equal(M.phase, 'goal');
  for (let k = 0; k < Math.ceil(GOAL_TIME * 120) + 2; k++) { stepMatch(M, DT); M.ev.length = 0; }
  assert.equal(M.phase, 'serve');
  assert.equal(M.serveTo, 0, 'served to you: you conceded');
  assert.equal(M.pucks[0].y, SERVE_Y[0]);
});

test('the stall rule: seven seconds in one half and it goes to the other side, with a countdown', () => {
  const M = createMatch({ seed: 4, powerups: false });
  M.mallets[0] = parked(0); M.mallets[1] = parked(1);
  M.phase = 'play'; M.pucks[0].ghost = 0;
  const ticks = [];
  let stall = null;
  for (let k = 0; k < 120 * 8 && !stall; k++) {
    stepMatch(M, DT);
    for (const e of M.ev) { if (e.type === 'stallTick') ticks.push(e.left); if (e.type === 'stall') stall = { ...e, t: M.t }; }
    M.ev.length = 0;
  }
  assert.ok(stall, 'stalled');
  assert.equal(stall.side, 0);
  assert.ok(Math.abs(stall.t - STALL) < 0.05, `after ${stall.t.toFixed(2)} s`);
  assert.deepEqual(ticks, [3, 2, 1]);
  assert.equal(M.phase, 'serve');
  assert.equal(M.serveTo, 1);
  assert.equal(M.pucks[0].y, SERVE_Y[1], 'now it waits on her side');
});

test('first to N: match point, then the win and the end', () => {
  for (const to of [5, 7, 11]) {
    const M = createMatch({ seed: 5, to, powerups: false });
    const points = [];
    let won = null;
    for (let i = 0; i < to; i++) {
      const g = shoot(M, W / 2, 1);
      assert.equal(g.side, 0);
      if (M.phase === 'goal') for (let k = 0; k < 200 && M.phase !== 'serve'; k++) { stepMatch(M, DT); M.ev.length = 0; }
    }
    assert.equal(M.score[0], to);
    assert.equal(M.phase, 'won');
    assert.equal(M.winner, 0);
    for (let k = 0; k < Math.ceil(WIN_TIME * 120) + 2 && M.phase !== 'over'; k++) {
      stepMatch(M, DT);
      for (const e of M.ev) { if (e.type === 'over') won = e; if (e.type === 'matchPoint') points.push(e); }
      M.ev.length = 0;
    }
    assert.equal(M.phase, 'over');
    assert.equal(won?.winner, 0);
  }
  // the match point banner fires when a side gets to one short
  const M = createMatch({ seed: 6, to: 5, powerups: false });
  let mp = null;
  for (let i = 0; i < 4 && !mp; i++) {
    M.ev.length = 0;
    M.phase = 'play';
    M.pucks = [makePuck(50 + i, W / 2, 200, 0, -1500)];
    M.mallets[0] = parked(0); M.mallets[1] = parked(1);
    for (let k = 0; k < 120 && !mp; k++) { stepMatch(M, DT); mp = M.ev.find((e) => e.type === 'matchPoint'); if (M.phase === 'goal') break; }
  }
  assert.equal(mp?.side, 0);
  assert.equal(M.score[0], 4);
});

function pickUp(M, kind, side) {
  M.phase = 'play';
  M.mallets[0] = parked(0); M.mallets[1] = parked(1);
  spawnChip(M, kind, { x: 300, y: 650 });
  M.chip.state = 'on'; M.chip.t = 0;
  M.pucks = [makePuck(M.nextId++, 300, 760, 0, -900)];
  M.last = side;
  M.ev.length = 0;
  for (let k = 0; k < 60 && !M.ev.some((e) => e.type === 'powerup'); k++) stepMatch(M, DT);
  return M.ev.find((e) => e.type === 'powerup');
}

test('power-ups: whoever touched the puck last gets the chip; each does its thing, then ends on time', () => {
  for (const kind of KINDS) {
    for (const side of [0, 1]) {
      const M = createMatch({ seed: 7 });
      const e = pickUp(M, kind, side);
      assert.ok(e, `${kind} picked up`);
      assert.equal(e.side, side);
      assert.equal(M.active[side].kind, kind);
      assert.equal(M.chip, null);
      if (kind === 'split') { assert.equal(M.pucks.length, 3, 'three pucks'); assert.ok(splitOn(M)); }
      if (kind === 'lag') assert.ok(lagged(M, 1 - side) && !lagged(M, side), 'the other mallet stutters');
      if (kind === 'firewall') assert.ok(M.walls.some((w) => w.tag === 'firewall' && w.side === side), 'a wall across its goal');
      if (kind === 'patch') {
        const ends = M.walls.filter((w) => w.tag === 'end' && w.side === side);
        assert.ok(ends.some((w) => Math.max(w.ax, w.bx) > ML + 1 && Math.max(w.ax, w.bx) < W / 2), 'its end rail reaches further in');
      }
      // it runs out on time (the match kept from scoring: no pucks)
      M.pucks = [makePuck(500, 300, 400)];
      M.mallets[0] = parked(0); M.mallets[1] = parked(1);
      let ended = -1;
      const t0 = M.t;
      for (let k = 0; k < (DURATION[kind] + 1) * 120 && ended < 0; k++) {
        if (kind === 'big' && k === 60) assert.ok(Math.abs(M.mallets[side].r - MALLET_R * BIG) < 1e-9, 'a bigger mallet');
        M.stall.t = 0;
        stepMatch(M, DT);
        if (M.ev.some((x) => x.type === 'powerEnd')) ended = M.t - t0;
        M.ev.length = 0;
        if (M.phase !== 'play') { M.phase = 'play'; M.pucks = [makePuck(600 + k, 300, 400)]; }
      }
      assert.ok(Math.abs(ended - DURATION[kind]) < 0.05, `${kind} ends after ${DURATION[kind]} s (${ended.toFixed(2)})`);
      assert.equal(M.active[side], null);
      assert.ok(!isOn(M, side, kind));
      if (kind === 'split') assert.equal(M.pucks.length, 1, 'back to one puck');
      if (kind === 'big') { for (let k = 0; k < 60; k++) stepMatch(M, DT); assert.equal(M.mallets[side].r, MALLET_R); }
    }
  }
  // at most one per side: a second chip replaces the first
  const M = createMatch({ seed: 8 });
  pickUp(M, 'big', 0);
  pickUp(M, 'patch', 0);
  assert.equal(M.active[0].kind, 'patch');
  assert.ok(!isOn(M, 0, 'big'));
  // a puck nobody has touched since the serve doesn't take the chip
  const N = createMatch({ seed: 9 });
  assert.equal(pickUp(N, 'lag', -1), undefined);
  assert.ok(N.chip, 'the chip is still there');
  assert.equal(Object.keys(LABEL).sort().join(), [...KINDS].sort().join());
});

test('chips slide in on their own every ~12 s, never in a goal crease, and only while power-ups are on', () => {
  for (const powerups of [true, false]) {
    const M = createMatch({ seed: 10, powerups });
    const A = createBrain(2, 11, 0), B = createBrain(2, 12, 1);
    const spawns = [];
    for (let k = 0; k < 120 * 60; k++) {
      think(A, M, DT); think(B, M, DT); stepMatch(M, DT);
      for (const e of M.ev) if (e.type === 'chipIn') spawns.push(e);
      M.ev.length = 0;
    }
    if (!powerups) { assert.equal(spawns.length, 0, 'Classic: no chips'); continue; }
    assert.ok(spawns.length >= 3, `${spawns.length} chips in a minute`);
    for (const c of spawns) assert.ok(c.y >= 250 && c.y <= H - 250 && c.x >= 100 && c.x <= W - 100, 'in the middle of the table');
  }
});

test('her brain keeps her mallet in her half, and she gets back in front of her goal', () => {
  for (let level = 0; level < PERSONAS.length; level++) {
    const M = createMatch({ seed: 20 + level, to: 99 });
    const A = createBrain(level, 3, 0), B = createBrain(level, 4, 1);
    for (let k = 0; k < 120 * 25; k++) {
      think(A, M, DT); think(B, M, DT); stepMatch(M, DT); M.ev.length = 0;
      assert.ok(M.mallets[1].y <= MID - M.mallets[1].r + 1e-9 && M.mallets[0].y >= MID + M.mallets[0].r - 1e-9, 'each in its own half');
    }
  }
  // a shot at her goal while she's out of position: she comes back to cover it
  for (let level = 0; level < PERSONAS.length; level++) {
    let covered = 0;
    for (let s = 0; s < 6; s++) {
      const M = createMatch({ seed: 40 + s, to: 99, powerups: false });
      M.phase = 'play';
      M.mallets[0] = parked(0);
      const her = M.mallets[1];
      her.x = her.px = s % 2 ? 90 : W - 90; her.y = her.py = MID - 60;
      const B = createBrain(level, 100 + s, 1);
      const x0 = 220 + s * 30;
      M.pucks = [makePuck(1, x0, 820, (W / 2 - x0) * 1.3, -1250)];
      M.last = 0;
      let y = null;
      for (let k = 0; k < 120 * 1.2 && M.pucks.length && M.pucks[0].y > 160; k++) { think(B, M, DT); stepMatch(M, DT); M.ev.length = 0; }
      y = her.y;
      if (y < MID - 150 && Math.abs(her.x - W / 2) < 170) covered++;
    }
    assert.ok(covered >= (level >= 2 ? 5 : 3), `${PERSONAS[level].id}: back in front of her goal ${covered}/6`);
  }
});

test('her settings get harder in order: each beats the ones two below it', () => {
  const play = (bottom, top, seed) => {
    const M = createMatch({ seed, to: 5 });
    const A = createBrain(bottom, seed * 7 + 1, 0), B = createBrain(top, seed * 13 + 5, 1);
    for (let k = 0; k < 120 * 400 && M.phase !== 'over'; k++) { think(A, M, DT); think(B, M, DT); stepMatch(M, DT); M.ev.length = 0; }
    return M.winner;
  };
  for (let a = 0; a + 2 < PERSONAS.length; a++) {
    let wins = 0;
    for (let i = 0; i < 4; i++) wins += i % 2 ? (play(a + 2, a, 300 + i) === 0) : (play(a, a + 2, 300 + i) === 1);
    assert.ok(wins >= 3, `${PERSONAS[a + 2].id} beats ${PERSONAS[a].id}: ${wins}/4`);
  }
});

test('the same seed, the same match (her mistakes come from the seeded dice)', () => {
  const run = (seed) => {
    const M = createMatch({ seed, to: 99 });
    const A = createBrain(3, seed + 1, 0), B = createBrain(4, seed + 2, 1);
    for (let k = 0; k < 120 * 20; k++) { think(A, M, DT); think(B, M, DT); stepMatch(M, DT); M.ev.length = 0; }
    return JSON.stringify([M.score, M.pucks.map((p) => [p.x, p.y, p.vx, p.vy]), M.mallets.map((m) => [m.x, m.y]), M.chip?.kind ?? null]);
  };
  assert.equal(run(77), run(77));
  assert.notEqual(run(77), run(78));
});

test('the demo opens at 3–3, Tryhard against Competitive, and every opening lands a power-up and a goal inside the preview\'s recording', () => {
  assert.equal(demoSeed(7), 213, '?demo&seed=7 (the preview) opens the best one');
  assert.equal(demoSeed(0), demoSeed(7), 'no seed: the same as 7');
  assert.deepEqual(DEMO_LEVELS, [2, 3]);
  for (const seed of DEMO_SEEDS) {
    const D = createDemo(seed);
    assert.deepEqual(D.M.score, [3, 3]);
    assert.ok(D.M.powerups);
    let power = null;
    const goals = [];
    for (let k = 0; k < 120 * 11.7; k++) {
      think(D.brains[0], D.M, DT); think(D.brains[1], D.M, DT); rigTick(D);
      stepMatch(D.M, DT);
      for (const e of D.M.ev) { if (e.type === 'powerup' && !power) power = { ...e, t: D.M.t }; if (e.type === 'goal') goals.push(D.M.t); }
      D.M.ev.length = 0;
    }
    assert.equal(power?.kind, 'split', `seed ${seed}: the SPLIT`);
    assert.ok(power.t >= 5.8 && power.t <= 7.4, `seed ${seed}: SPLIT at ${power.t.toFixed(2)} s (the recording is 5.7–11.7)`);
    assert.ok(goals.some((t) => t > power.t && t < 11.4), `seed ${seed}: a goal after it, inside the recording (${goals.map((t) => t.toFixed(2))})`);
    assert.ok(!goals.some((t) => t < 5.6), `seed ${seed}: nothing decided before the recording starts`);
  }
});

test('her ladder: beat one to unlock the next, stars for winning big, a save that can\'t be cheated open', () => {
  assert.equal(SETTINGS.length, 5);
  assert.deepEqual(SETTINGS.map((s) => s.id), PERSONAS.map((p) => p.id), 'one brain per setting, in order');
  assert.deepEqual(SETTINGS.map((s) => s.name), ['Sleepy', 'Playful', 'Competitive', 'Tryhard', 'No mercy']);
  assert.equal(starsFor(7, 5), 1);
  assert.equal(starsFor(7, 4), 2);
  assert.equal(starsFor(7, 0), 3);
  assert.equal(starsFor(5, 7), 0);
  let save = readSave(null);
  assert.equal(save.unlocked, 0);
  let r = recordMatch(save, 0, 4, 7);
  assert.equal(r.unlocked, -1, 'a loss unlocks nothing');
  assert.equal(r.save.losses[0], 1);
  r = recordMatch(r.save, 0, 7, 5);
  assert.equal(r.unlocked, 1);
  assert.equal(r.stars, 1);
  r = recordMatch(r.save, 0, 7, 0);
  assert.equal(r.unlocked, -1, 'already open');
  assert.equal(r.best, true);
  assert.equal(r.save.stars[0], 3);
  r = recordMatch(r.save, 0, 7, 6);
  assert.equal(r.save.stars[0], 3, 'the best stars are kept');
  save = r.save;
  for (let lv = 1; lv < TOP; lv++) { r = recordMatch(save, lv, 7, 2); save = r.save; assert.equal(r.unlocked, lv + 1); }
  assert.equal(save.unlocked, TOP, 'No mercy, after Tryhard');
  r = recordMatch(save, TOP, 7, 6);
  assert.equal(r.top, true);
  // what's kept is checked: nothing past a win, no junk
  const hacked = readSave({ unlocked: 4, level: 4, wins: [1, 0, 0, 0, 0], stars: [9, -1, 'x'], settings: { to: 8, powerups: 'no', turbo: 1 } });
  assert.equal(hacked.unlocked, 1);
  assert.equal(hacked.level, 1);
  assert.deepEqual(hacked.stars, [0, 0, 0, 0, 0]);
  assert.deepEqual(hacked.settings, { powerups: true, to: 7, turbo: false });
});

test('the table on the screen: upright or turned a quarter (never stretched); two players\' fingers by half', () => {
  const up = fitTable({ x: 0, y: 64, w: 390, h: 780 });
  const side = fitTable({ x: 0, y: 54, w: 844, h: 336 });
  assert.equal(up.rot, false);
  assert.equal(side.rot, true);
  for (const L of [up, side]) {
    for (const [x, y] of [[0, 0], [W, H], [123, 456], [W / 2, MID]]) {
      const s = toScreen(L, x, y), t = toTable(L, s.x, s.y);
      assert.ok(Math.abs(t.x - x) < 1e-9 && Math.abs(t.y - y) < 1e-9, 'there and back');
    }
    const d = dirToTable(L, 1, 0), back = dirToScreen(L, d.x, d.y);
    assert.deepEqual([back.x, back.y], [1, 0]);
  }
  // upright: your goal at the bottom; turned: on the left; hers opposite
  assert.ok(toScreen(up, W / 2, H).y > toScreen(up, W / 2, 0).y);
  assert.ok(toScreen(side, W / 2, H).x < toScreen(side, W / 2, 0).x);
  assert.ok(Math.abs((toScreen(side, W, 0).y - toScreen(side, 0, 0).y) / (toScreen(side, 0, 0).x - toScreen(side, 0, H).x) - W / H) < 1e-9, 'the same shape, turned');
  // two players: a finger belongs to the half it lands in (a touch off the table: the nearer half)
  for (const L of [up, side]) {
    for (let i = 0; i < 20; i++) {
      const y = ((i + 0.5) / 20) * H;
      const s = toScreen(L, W * 0.3, y);
      assert.equal(sideOfTouch(L, s.x, s.y), y >= MID ? 0 : 1);
    }
    const below = toScreen(L, W / 2, H + 300), above = toScreen(L, W / 2, -300);
    assert.equal(sideOfTouch(L, below.x, below.y), 0);
    assert.equal(sideOfTouch(L, above.x, above.y), 1);
  }
  // a finger's mallet sits a little ahead of it, toward the centre (less near the back rail)
  const s = toScreen(up, W / 2, 800), t = touchTarget(up, s.x, s.y, 0);
  assert.ok(t.y < 800 && 800 - t.y < 100 && Math.abs(t.x - W / 2) < 1e-9);
  const s2 = toScreen(up, W / 2, 200), t2 = touchTarget(up, s2.x, s2.y, 1);
  assert.ok(t2.y > 200, 'the far player\'s too, toward the centre');
  const back = toScreen(up, W / 2, H - 20), tb = touchTarget(up, back.x, back.y, 0);
  assert.ok((H - 20) - tb.y < 800 - t.y, 'a smaller gap at the back');
});

test('the deterministic maths matches the engine\'s to the last few digits', () => {
  for (let i = 0; i <= 400; i++) {
    const x = -8 + i * 0.04;
    assert.ok(Math.abs(dexp(x) - Math.exp(x)) <= Math.exp(x) * 4e-15);
    assert.ok(Math.abs(dsin(x * 3) - Math.sin(x * 3)) < 4e-15 && Math.abs(dcos(x * 3) - Math.cos(x * 3)) < 4e-15);
    if (x > 0) assert.ok(Math.abs(dlog(x) - Math.log(x)) < 4e-15);
  }
  assert.equal(len(3, 4), 5);
  assert.equal(dexp(-1000), 0);
  // her predictor agrees with the physics for a puck crossing the table (no mallets)
  const p = makePuck(1, 200, 800, 300, -1200);
  const S = world([p]);
  const t = timeTo(800, -1200, 300);
  for (let k = 0; k < Math.round(t * 120); k++) stepPhysics(S, DT);
  const q = project(200, 800, 300, -1200, Math.round(t * 120) / 120, 2, { x: 0, y: 0, vx: 0, vy: 0 });
  assert.ok(Math.abs(q.y - p.y) < 8 && Math.abs(q.x - p.x) < 8, `predicted ${q.x.toFixed(0)},${q.y.toFixed(0)} · real ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
});

test('her words: lowercase, short, kind, never money; a hello, a win and a loss for every setting', () => {
  const all = [];
  const walk = (v) => { if (typeof v === 'string') all.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(LINES);
  assert.ok(all.length >= 30, `${all.length} lines`);
  for (const line of all) {
    assert.ok(line.length <= 64, `short: ${line}`);
    assert.equal(line, line.toLowerCase(), `lowercase: ${line}`);
    assert.doesNotMatch(line, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b|\bcoin/i, `never money: ${line}`);
  }
  for (const k of ['hello', 'youWin', 'herWin']) assert.equal(LINES[k].length, SETTINGS.length, k);
  for (const k of KINDS) assert.ok(LINES.herPower[k]?.length && LINES.yourPower[k]?.length, k);
});
