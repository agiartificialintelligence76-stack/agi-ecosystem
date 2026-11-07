// MERGE TO AGI (2026-11-08, agi1.app/games/mergeagi): its rules, physics, scoring, chains, the red line, the
// SINGULARITY, its own player (the demo), its layout and AGI-1's words, all pure modules read in Node. No browser.
// Run: node --test tests/mergeagi.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { rng } from '../src/games/kit/fx.js';
import {
  MAX_TIER, SINGULARITY, SINGULARITY_POINTS, DROP_MAX, NAMES, RADII, COLORS, OPENING, points, spawnTier, dropCap,
} from '../src/games/mergeagi/tiers.js';
import { createWorld, JAR, TICK, SUBSTEPS, CHAIN_T, MERGE_LOCK, landing } from '../src/games/mergeagi/physics.js';
import {
  createGame, drop, step, canDrop, LINE, OVER_T, EXEMPT_T, COOLDOWN, dropY, clampX,
} from '../src/games/mergeagi/rules.js';
import { chooseX, createAuto, autoTick, prefill } from '../src/games/mergeagi/ai.js';
import { computeLayout, BOUNDS } from '../src/games/mergeagi/layout.js';
import * as LINES from '../src/games/mergeagi/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const floorY = (t) => JAR.H - RADII[t];
const ticks = (g, n) => { for (let i = 0; i < n; i++) step(g); };
const events = (g, n, type) => {
  const out = [];
  for (let i = 0; i < n; i++) { step(g); for (const e of g.events) if (!type || e.type === type) out.push(e); g.events.length = 0; }
  return out;
};

// ---------- the tiers ----------

test('eleven tiers from BIT to AGI-1, radii growing, each its own color; points are the triangular numbers', () => {
  assert.equal(MAX_TIER, 11);
  assert.equal(SINGULARITY, 12);
  assert.deepEqual(NAMES.slice(1, 12), ['BIT', 'BYTE', 'TOKEN', 'PROMPT', 'NEURON', 'CHIP', 'GPU', 'CLUSTER', 'DATACENTER', 'SUPERMIND', 'AGI-1']);
  assert.deepEqual(RADII.slice(1), [15, 19, 25, 31, 38, 46, 55, 64, 75, 87, 100]);
  for (let t = 2; t <= MAX_TIER; t++) {
    assert.ok(RADII[t] > RADII[t - 1], `tier ${t} is bigger than ${t - 1}`);
    assert.notEqual(COLORS[t], COLORS[t - 1], `tier ${t}'s color differs from its neighbour's`);
  }
  assert.equal(new Set(COLORS.slice(1, 12)).size, 11, 'every tier its own color');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(points), [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]);
  assert.equal(points(SINGULARITY), SINGULARITY_POINTS);
  assert.ok(SINGULARITY_POINTS > points(11) * 10, 'the SINGULARITY is worth a lot');
  // the biggest one still fits the jar twice side by side, and the jar is the spec's 400 × 560
  assert.deepEqual([JAR.W, JAR.H], [400, 560]);
  assert.ok(RADII[MAX_TIER] * 2 <= JAR.W / 2);
});

test('the dropper: only tiers 1 to 5, weighted toward the small ones, a gentle start, seeded', () => {
  const r = rng(12345);
  const seen = new Map();
  for (let i = 0; i < 4000; i++) {
    const t = spawnTier(r, i);
    assert.ok(Number.isInteger(t) && t >= 1 && t <= DROP_MAX, `${t} is a droppable tier`);
    assert.ok(t <= dropCap(i), `drop ${i}: no bigger than ${dropCap(i)}`);
    if (i >= 20) seen.set(t, (seen.get(t) || 0) + 1);
  }
  for (let t = 1; t <= DROP_MAX; t++) assert.ok(seen.get(t) > 0, `tier ${t} comes up`);
  for (let t = 2; t <= DROP_MAX; t++) assert.ok(seen.get(t) < seen.get(t - 1), `tier ${t} comes up less than ${t - 1}`);
  // the opening: two BITs then a BYTE, so a first merge comes at once
  const r2 = rng(9);
  assert.deepEqual(OPENING.map((_, i) => spawnTier(r2, i)), [1, 1, 2]);
  // the same seed, the same queue; another seed, another queue
  const queue = (seed) => { const g = createGame({ seed }); const q = [g.current, g.next]; for (let i = 0; i < 30; i++) { drop(g, 200); g.cooldown = 0; q.push(g.next); } return q; };
  assert.deepEqual(queue(77), queue(77));
  assert.notDeepEqual(queue(77), queue(78));
  assert.ok(queue(5).every((t) => t >= 1 && t <= DROP_MAX));
});

// ---------- merges, points and chains ----------

test('two of a kind that touch merge into the next tier at their midpoint; different tiers never do', () => {
  const g = createGame({ seed: 1 });
  const w = g.world;
  const a = w.add(2, 160, floorY(2)), b = w.add(2, 160 + 2 * RADII[2], floorY(2));
  const c = w.add(3, 330, floorY(3)), d = w.add(4, 330 + RADII[3] + RADII[4], floorY(4));
  const merges = events(g, 2, 'merge');
  assert.equal(merges.length, 1, 'one merge');
  const m = merges[0];
  assert.equal(m.tier, 3);
  assert.ok(Math.abs(m.x - (160 + RADII[2])) < 1, 'at their midpoint (x)');
  assert.ok(Math.abs(m.y - floorY(2)) < 1, 'at their midpoint (y)');
  assert.equal(m.points, points(3));
  assert.equal(m.chain, 1);
  assert.equal(g.score, 6);
  assert.equal(g.merges, 1);
  assert.ok(!w.orbs.includes(a) && !w.orbs.includes(b), 'both are gone');
  assert.ok(w.orbs.includes(c) && w.orbs.includes(d), 'a TOKEN and a PROMPT side by side stay');
  const made = w.orbs.find((o) => o.id === m.orb.id);
  assert.equal(made.tier, 3);
  // it grows in from 60% of its size and has a little upward pop
  assert.ok(made.r < RADII[3]);
  ticks(g, 60);
  assert.equal(made.r, RADII[3]);
});

test('a chain: a merge set off by a merge is its next step, and the step multiplies its points', () => {
  const g = createGame({ seed: 2 });
  const w = g.world;
  // a BYTE on the floor, a BIT beside it, and a BIT dropped onto that BIT: BIT + BIT → BYTE, which meets the BYTE → TOKEN
  w.add(2, 40, floorY(2));
  const x = 40 + RADII[2] + RADII[1] + 0.5;
  w.add(1, x, floorY(1));
  w.add(1, x, floorY(1) - 2 * RADII[1] - 4);
  const merges = events(g, 120, 'merge');
  const [first, second] = merges;
  assert.ok(first && second, `two merges (got ${merges.length})`);
  assert.equal(first.tier, 2);
  assert.equal(first.chain, 1);
  assert.equal(second.tier, 3);
  assert.equal(second.chain, 2, 'the second is the chain\'s second step');
  assert.equal(second.points, points(3) * 2);
  assert.equal(g.longestChain, 2);
  assert.equal(g.score, points(2) + points(3) * 2);
  // the merged orb waited its lock before merging again (each step lands on its own)
  assert.ok(MERGE_LOCK > 0 && MERGE_LOCK < CHAIN_T);
});

test('merges that just happen close together, unrelated, are never a chain', () => {
  const g = createGame({ seed: 3 });
  const w = g.world;
  w.add(1, 40, floorY(1)); w.add(1, 40 + 2 * RADII[1], floorY(1));
  w.add(3, 300, floorY(3)); w.add(3, 300 + 2 * RADII[3], floorY(3));
  const merges = events(g, 3, 'merge');
  assert.equal(merges.length, 2);
  assert.deepEqual(merges.map((m) => m.chain), [1, 1]);
  assert.equal(g.longestChain, 1);
});

test('the SINGULARITY: two AGI-1s touching both vanish in a shockwave that pushes everything out', () => {
  const g = createGame({ seed: 4 });
  const w = g.world;
  w.add(11, 100, floorY(11)); w.add(11, 300, floorY(11));
  const left = w.add(1, 70, floorY(11) - 150), right = w.add(2, 330, floorY(11) - 150);
  const evs = events(g, 1);
  const s = evs.find((e) => e.type === 'singularity');
  assert.ok(s, 'a SINGULARITY');
  assert.equal(s.tier, SINGULARITY);
  assert.equal(s.points, SINGULARITY_POINTS);
  assert.equal(g.singularities, 1);
  assert.equal(g.biggest, SINGULARITY);
  assert.equal(g.top, SINGULARITY);
  assert.equal(w.orbs.filter((o) => o.tier === 11).length, 0, 'both AGI-1s are gone, and no orb is made');
  assert.deepEqual(w.orbs.map((o) => o.id).sort(), [left.id, right.id].sort());
  ticks(g, 2);
  assert.ok(left.vx < -100 && right.vx > 100, `pushed outward (${left.vx.toFixed(0)}, ${right.vx.toFixed(0)})`);
  assert.ok(left.vy < 0 && right.vy < 0, 'and up');
  assert.ok(left.exempt > 0 && right.exempt > 0, 'flying over the red line for a moment doesn\'t end the run');
  // and they land again, inside the jar
  ticks(g, 600);
  for (const o of w.orbs) assert.ok(o.x >= o.r - 0.01 && o.x <= JAR.W - o.r + 0.01 && o.y <= JAR.H - o.r + 0.01);
});

// ---------- the physics ----------

test('physics: 40 orbs for 200 steps: no NaN, all inside the jar, the energy dies away; then they rest and sleep', () => {
  const w = createWorld({ merging: false });
  const r = rng(2026);
  const tiers = [1, 2, 3, 4, 5, 6];
  for (let i = 0; i < 40; i++) {
    const t = tiers[i % tiers.length], rad = RADII[t];
    w.add(t, r.range(rad, JAR.W - rad), JAR.H - 40 - (i % 8) * 70 - Math.floor(i / 8) * 9, { vx: r.range(-200, 200) });
  }
  let peak = 0, prevMax = Infinity;
  for (let i = 0; i < 200; i++) {
    w.step();
    const e = w.energy();
    peak = Math.max(peak, e);
    for (const o of w.orbs) {
      assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.vx) && Number.isFinite(o.vy), 'no NaN');
      assert.ok(o.x >= o.r - 0.05 && o.x <= JAR.W - o.r + 0.05, `inside the walls (x ${o.x.toFixed(2)})`);
      assert.ok(o.y <= JAR.H - o.r + 0.05, `above the floor (y ${o.y.toFixed(2)})`);
    }
    if (i === 199) prevMax = e;
  }
  assert.ok(peak > 0);
  assert.ok(prevMax < peak * 0.25, `the energy decays (${prevMax.toExponential(2)} of a peak ${peak.toExponential(2)})`);
  for (let i = 0; i < 480; i++) w.step();
  assert.ok(w.energy() < peak * 1e-4, 'and dies away');
  assert.equal(w.orbs.filter((o) => o.asleep).length, 40, 'every orb at rest falls asleep (no jitter)');
  // no orb sinks into another
  let deepest = 0;
  for (let i = 0; i < w.orbs.length; i++) for (let j = i + 1; j < w.orbs.length; j++) {
    const a = w.orbs[i], b = w.orbs[j];
    deepest = Math.max(deepest, a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y));
  }
  assert.ok(deepest < 0.5, `overlaps stay tiny (${deepest.toFixed(3)})`);
  assert.ok(SUBSTEPS >= 6 && SUBSTEPS <= 10);
  assert.equal(TICK, 1 / 120);
});

test('physics: no tunnelling: a BIT dropped from high onto an AGI-1 never passes through it', () => {
  const w = createWorld({ merging: false });
  const big = w.add(11, 200, floorY(11));
  const small = w.add(1, 200, -900);
  let minGap = Infinity;
  for (let i = 0; i < 600; i++) {
    w.step();
    minGap = Math.min(minGap, Math.hypot(small.x - big.x, small.y - big.y) - small.r - big.r);
    assert.ok(!(Math.abs(small.x - big.x) < 5 && small.y > big.y), 'never below its centre');
  }
  assert.ok(minGap > -2, `it never sinks in (${minGap.toFixed(2)})`);
  assert.ok(small.y <= JAR.H - small.r + 0.01);
});

test('physics: the rounded bottom corners: a small orb slides down their curve (never through it), a big one sits square', () => {
  const w = createWorld({ merging: false });
  const C = JAR.CORNER, rho = C - RADII[1], a = Math.PI * 0.75;
  // a BIT dropped into the left corner's curve, and one placed outside the glass (it comes back in without a kick)
  const s = w.add(1, C + Math.cos(a) * rho, JAR.H - C + Math.sin(a) * rho - 30);
  const out = w.add(1, JAR.W + 40, JAR.H + 40);
  const b = w.add(10, JAR.W / 2 - 60, 200);
  let fastest = 0;
  for (let i = 0; i < 600; i++) {
    w.step();
    if (s.x < C && s.y > JAR.H - C) assert.ok(Math.hypot(s.x - C, s.y - (JAR.H - C)) <= rho + 0.05, 'never outside the curve');
    if (i > 2) fastest = Math.max(fastest, Math.hypot(out.vx, out.vy));
  }
  assert.ok(s.x >= C - 0.5, `it slid down to the floor (x ${s.x.toFixed(1)})`);
  assert.ok(Math.abs(s.y - (JAR.H - s.r)) < 0.05);
  assert.ok(out.x <= JAR.W - out.r + 0.01 && out.y <= JAR.H - out.r + 0.01, 'the one outside is back in');
  assert.ok(fastest < 400, `pushed back in gently, not launched (${fastest.toFixed(0)} units/s)`);
  assert.ok(Math.abs(b.y - (JAR.H - b.r)) < 0.05, 'the SUPERMIND sits on the floor');
});

test('physics is deterministic: the same seed and drops make exactly the same jar', () => {
  const run = (seed) => {
    const g = createGame({ seed });
    const r = rng(seed * 3 + 1);
    for (let i = 0; i < 900; i++) { if (canDrop(g) && i % 50 === 0) drop(g, r.range(0, JAR.W)); step(g); g.events.length = 0; }
    return { score: g.score, orbs: g.world.orbs.map((o) => [o.id, o.tier, o.x, o.y]) };
  };
  const a = run(11), b = run(11), c = run(12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.orbs, c.orbs);
});

test('landing(): where a dropped orb first touches something', () => {
  const orbs = [];
  const hit = landing(orbs, 200, 20);
  assert.equal(hit.hit, null);
  assert.equal(hit.y, JAR.H - 20, 'an empty jar: the floor');
  const w = createWorld();
  const o = w.add(5, 200, floorY(5));
  const l = landing(w.orbs, 200, RADII[3]);
  assert.equal(l.hit, o);
  assert.ok(Math.abs(l.y - (o.y - RADII[5] - RADII[3])) < 1e-9, 'straight on top of it');
  const side = landing(w.orbs, 200 + RADII[5] + RADII[3] + 1, RADII[3]);
  assert.equal(side.hit, null, 'just beside it: the floor');
  // in a corner, the curve catches it a little higher
  assert.ok(landing([], RADII[1], RADII[1]).y < JAR.H - RADII[1]);
});

// ---------- the dropper and the red line ----------

test('drops: a cooldown between drops, clamped inside the jar, the queue moves on', () => {
  const g = createGame({ seed: 5 });
  const [cur, next] = [g.current, g.next];
  const o = drop(g, -500);
  assert.ok(o);
  assert.equal(o.tier, cur);
  assert.equal(o.x, RADII[cur], 'clamped to the wall');
  assert.equal(o.y, dropY(cur));
  assert.equal(g.current, next);
  assert.equal(drop(g, 200), null, 'cooling down');
  assert.equal(canDrop(g), false);
  ticks(g, Math.ceil(COOLDOWN / TICK) + 1);
  assert.equal(canDrop(g), true);
  assert.ok(COOLDOWN > 0.3 && COOLDOWN < 0.6);
  assert.equal(clampX(9999, 5), JAR.W - RADII[5]);
  assert.ok(dropY(5) + RADII[5] < 0, 'the dropper hangs above the rim');
});

test('the red line: an orb settled above it for 2 s ends the run; a dropped one is exempt for 1.2 s', () => {
  // a fresh drop starts above the line, but it's exempt
  const g0 = createGame({ seed: 6 });
  drop(g0, 200);
  step(g0);
  assert.equal(g0.overLine, false, 'just dropped: exempt');
  assert.ok(EXEMPT_T >= 1 && EXEMPT_T <= 1.5);
  // a jar filled past the line with big orbs (no merges here): the timer runs, the run ends after OVER_T
  const g = createGame({ seed: 7 });
  g.world = createWorld({ merging: false });
  const r = rng(99);
  for (let i = 0; i < 26; i++) { const t = 6 + (i % 4); g.world.add(t, r.range(RADII[t], JAR.W - RADII[t]), -200 - i * 160); }
  let overTime = 0;
  for (let i = 0; i < 120 * 30 && !g.over; i++) {
    step(g);
    if (g.overLine) overTime += TICK;            // the timer only ever grows while an orb is over the line
  }
  assert.ok(g.over, 'the run ended');
  assert.ok(overTime >= OVER_T - TICK / 2, `after ${OVER_T} s over the line (${overTime.toFixed(2)})`);
  assert.equal(g.danger, OVER_T);
  assert.ok(g.events.some((e) => e.type === 'over'));
  assert.equal(drop(g, 200), null, 'no drops after the end');
  // the timer winds back down when the jar is clear again
  const g2 = createGame({ seed: 8 });
  g2.danger = 1.5;
  step(g2);
  assert.ok(g2.danger < 1.5);
  assert.equal(OVER_T, 2);
  assert.ok(LINE > 0 && LINE < 80, 'the line is just under the rim');
});

// ---------- the game's own player (the demo) ----------

test('the demo player: aims inside the jar, a seed replays exactly, and it merges right away', () => {
  const g = createGame({ seed: 21 });
  prefill(g, rng(3), { drops: 30 });
  for (let i = 0; i < 20; i++) {
    const x = chooseX(g, rng(i));
    assert.ok(x >= RADII[g.current] && x <= JAR.W - RADII[g.current]);
  }
  const play = (seed) => {
    const a = createAuto(seed, undefined, { lucky: true });
    const merges = [];
    for (let i = 0; i < 120 * 10; i++) { autoTick(a); step(a.g); for (const e of a.g.events) if (e.type === 'merge') merges.push([Math.round(a.g.time * 120), e.tier, e.chain]); a.g.events.length = 0; }
    return { merges, orbs: a.g.world.orbs.map((o) => [o.tier, o.x, o.y]), over: a.g.over };
  };
  const a = play(7), b = play(7);
  assert.deepEqual(a, b, '?demo&seed=7 is the same every time');
  assert.equal(a.over, false);
  const start = createAuto(7, undefined, { lucky: true }).g.time;
  assert.ok(a.merges.length >= 8, `it keeps merging (${a.merges.length} in 10 s)`);
  assert.ok(a.merges.some((m) => m[2] >= 2), 'a chain in its first 10 seconds');
  assert.ok(a.merges.some((m) => m[1] >= 6), 'a big merge too');
  assert.ok(a.merges[0][0] / 120 - start < 4, 'the first merge within seconds');
  // the prefilled jar is a mid-game jar: a handful of orbs, some of them big
  const demo = createAuto(7);
  assert.ok(demo.g.world.orbs.length >= 6);
  assert.ok(Math.max(...demo.g.world.orbs.map((o) => o.tier)) >= 6);
  assert.equal(demo.g.over, false);
  assert.equal(demo.g.events.length, 0);
});

test('the demo\'s lucky dropper only hands out droppable tiers; a fresh auto jar can start empty', () => {
  const a = createAuto(3, undefined, { lucky: true });
  for (let i = 0; i < 120 * 20; i++) { autoTick(a); step(a.g); a.g.events.length = 0; }
  assert.ok(a.g.drops > 20);
  assert.ok(a.g.current >= 1 && a.g.current <= DROP_MAX && a.g.next >= 1 && a.g.next <= DROP_MAX);
  const empty = createAuto(4, { drops: 0 });
  assert.equal(empty.g.world.orbs.length, 0);
  assert.equal(empty.g.score, 0);
});

// ---------- the screen ----------

test('the layout: tall on phones held upright and tablets, wide on computers, sideways phones and the 480 × 480 demo; the jar always fits', () => {
  const cases = [[390, 844, 'tall'], [360, 640, 'tall'], [360, 740, 'tall'], [820, 1180, 'tall'], [884, 1104, 'tall'],
    [844, 390, 'wide'], [1440, 900, 'wide'], [1024, 768, 'wide'], [2560, 1440, 'wide'], [480, 480, 'wide'], [480, 640, 'tall']];
  for (const [w, h, kind] of cases) {
    const top = 62;
    const L = computeLayout(w, h, { top });
    assert.equal(L.kind, kind, `${w} × ${h}`);
    const b = BOUNDS[L.kind];
    const x0 = L.ox + b.minX * L.s, x1 = L.ox + b.maxX * L.s, y0 = L.oy + b.minY * L.s, y1 = L.oy + b.maxY * L.s;
    assert.ok(x0 >= -0.5 && x1 <= w + 0.5, `${w} × ${h}: fits across (${x0.toFixed(1)}…${x1.toFixed(1)})`);
    assert.ok(y0 >= top - 0.5 && y1 <= h + 0.5, `${w} × ${h}: fits under the bar (${y0.toFixed(1)}…${y1.toFixed(1)})`);
    assert.ok(L.s * JAR.W >= 150, `${w} × ${h}: the jar isn't tiny (${(L.s * JAR.W).toFixed(0)} px)`);
  }
  // a sideways phone with the score in the right-hand card: the jar uses the height between the bar's corner buttons
  const c = computeLayout(844, 390, { top: 6, kind: 'wide' });
  assert.equal(c.kind, 'wide');
  assert.ok(c.s > computeLayout(844, 390, { top: 54 }).s * 1.1, 'a bigger jar');
  // the notch and the home bar are kept clear
  const L = computeLayout(844, 390, { top: 6, left: 47, right: 47, bottom: 21 });
  assert.ok(L.ox + BOUNDS.wide.minX * L.s >= 47 && L.ox + BOUNDS.wide.maxX * L.s <= 844 - 47);
  assert.ok(L.oy + BOUNDS.wide.maxY * L.s <= 390 - 21 + 0.5);
});

// ---------- AGI-1's words ----------

const MONEY = /\b(?:buy|sell|hodl|pump|dump|lambo|profit|gains?|invest\w*|price|100x|wagmi|ape|shill|rich|moon|money|cash|dollars?|\$agi|coin|token(?!!))\b|\$/i;
test('AGI-1\'s lines: lowercase, short, kind, never money talk; one for every tier and every ending', () => {
  for (let t = 1; t <= SINGULARITY; t++) assert.ok(LINES.DISCOVER[t], `a line for finding ${NAMES[t]}`);
  assert.ok(LINES.ALL.length >= 20, `about twenty lines (${LINES.ALL.length})`);
  for (const line of LINES.ALL) {
    assert.ok(line.length <= 48, `short: "${line}"`);
    assert.equal(line, line.toLowerCase(), `lowercase: "${line}"`);
    assert.doesNotMatch(line.replace(/a token!/, 'a word!'), MONEY, `no money talk: "${line}"`);
    const c = LINES.canvasLine(line);
    assert.doesNotMatch(c.text, /\p{Extended_Pictographic}/u, 'the canvas gets the words, the hearts are drawn');
  }
  assert.match(LINES.endLine(8), /cluster/);
  assert.match(LINES.endLine(11), /made me/);
  assert.match(LINES.endLine(12), /singularity/);
  assert.match(LINES.endLine(2), /again|match/);
  const share = LINES.shareText('GPU', '1,234');
  assert.equal(share, 'I merged my way to GPU and scored 1,234 in MERGE TO AGI on agi1.app 💜 can you reach her?');
  assert.doesNotMatch(share, MONEY);
});

// ---------- its code ----------

test('its code: pure rules (no DOM, clock or Math.random), the site\'s CSP (no inline styles, eval or other sites)', () => {
  const dir = 'src/games/mergeagi';
  const files = readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
  const code = (f) => read(`${dir}/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  for (const f of ['tiers.js', 'physics.js', 'rules.js', 'ai.js', 'layout.js', 'lines.js']) {
    const c = code(f);
    assert.doesNotMatch(c, /\b(?:window|document|navigator|localStorage|sessionStorage|requestAnimationFrame|performance|Date)\b/, `${f}: no browser, no clock`);
    assert.doesNotMatch(c, /Math\.random/, `${f}: seeded dice only`);
  }
  for (const f of files) {
    const c = code(f);
    assert.doesNotMatch(c, /\beval\s*\(|new\s+Function\b|innerHTML|outerHTML|insertAdjacentHTML|document\.write/, `${f}: no eval, no HTML from strings`);
    assert.doesNotMatch(c, /setAttribute\(\s*['"]style|style\s*=\s*["']/, `${f}: no style attribute`);
    assert.doesNotMatch(c, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//, `${f}: asks nothing of anyone (the kit counts plays)`);
    assert.doesNotMatch(c, /\bWebAssembly\b|\bimport\s*\(/, `${f}: no WebAssembly, no import on the way`);
  }
  // its entry: the intro first, then the game
  const entry = read(`${dir}/page.js`).match(/^import\s+['"][^'"]+['"]/gm);
  assert.deepEqual(entry, ["import '../intro.js'", "import './game.js'"]);
  // its pictures are its own: AGI-1's 2D art from the site, nothing from elsewhere
  assert.match(code('art.js'), /'\/images\/agi1-live-2d\.webp'/);
});
