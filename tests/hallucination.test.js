// HALLUCINATION (2026-11-08): AGI-1 redraws a scene from memory and makes up five things. These check its pure parts:
// scene generation (the same seed, the same page; everything inside the frame; nothing piled up), the five
// hallucinations (five, distinct, never overlapping, big enough, each a real change), taps and their radius, the clock,
// combos, hints and blinks, the daily scene's seed, the difficulty curve, the demo's player, the layout, the content
// (every object draws, every template paints, AGI-1's words never talk money) — all without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScene, difficulty, hitTest, N_DIFFS, KINDS } from '../src/games/hallucination/scene.js';
import { LIB, TYPES, LISTS, boxOf, area, overlap, grow, drawObject } from '../src/games/hallucination/objects.js';
import { TEMPLATES, TEMPLATE_IDS } from '../src/games/hallucination/templates.js';
import { RULES, sceneTime, createRun, startScene, tick, tap, find, clearScene, useHint, useBlink, sceneSeed, templateOrder, dateKey, dailySeed, dailyTemplate, fmtSecs } from '../src/games/hallucination/rules.js';
import { planDemo, decoySpot, PREVIEW_TIMES } from '../src/games/hallucination/ai.js';
import { computeLayout, pickPicture } from '../src/games/hallucination/layout.js';
import { LINES, confess, endLine, shareText, dailyShare, END_BEST, END_CLOSE, DAILY_DONE, DAILY_BEST } from '../src/games/hallucination/lines.js';
import { rng } from '../src/games/kit/fx.js';

const W = 400, H = 300;
const SEEDS = Array.from({ length: 60 }, (_, i) => (i * 2654435761 + 17) >>> 0);
const scenes = [...SEEDS.map((s, i) => makeScene(s, 1 + (i % 12))), ...TEMPLATE_IDS.flatMap((t, i) => [3, 9].map((l) => makeScene(1000 + i * 31 + l, l, { template: t })))];
const byId = (list) => new Map(list.map((o) => [o.id, o]));
const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
// a 2D context that does nothing (the drawing code runs, nothing is painted)
const stubCtx = () => {
  const grad = { addColorStop() {} };
  return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad; if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
};

test('a scene is the same for the same seed and level, and different for another seed', () => {
  for (const s of [1, 7, 123456, 4294967295]) {
    const a = makeScene(s, 4), b = makeScene(s, 4);
    assert.equal(JSON.stringify({ a: a.a, b: a.b, d: a.diffs, t: a.tpl, p: a.palId }), JSON.stringify({ a: b.a, b: b.b, d: b.diffs, t: b.tpl, p: b.palId }));
  }
  const sigs = new Set(SEEDS.slice(0, 20).map((s) => JSON.stringify(makeScene(s, 3).diffs)));
  assert.ok(sigs.size >= 19, 'different seeds, different scenes');
  for (const id of TEMPLATE_IDS) assert.equal(makeScene(99, 2, { template: id }).tpl, id, `${id}: a scene can be asked for by its place`);
});

test('every object of both pictures is inside the frame, and things on one surface never pile up', () => {
  for (const sc of scenes) {
    for (const o of [...sc.a, ...sc.b]) {
      const b = boxOf(o);
      assert.ok(b.every(Number.isFinite), `${sc.tpl}: ${o.type} has a real box`);
      assert.ok(b[0] >= -0.5 && b[1] >= -0.5 && b[2] <= W + 0.5 && b[3] <= H + 0.5, `${sc.tpl} seed ${sc.seed}: ${o.type} ${b.map(Math.round)} inside the frame`);
    }
    const onSurf = sc.a.filter((o) => o.surf >= 0);
    for (let i = 0; i < onSurf.length; i++) for (let j = i + 1; j < onSurf.length; j++) {
      const p = onSurf[i], q = onSurf[j];
      if (p.surf !== q.surf) continue;
      const ov = overlap(boxOf(p), boxOf(q));
      assert.ok(ov <= Math.min(area(boxOf(p)), area(boxOf(q))) * 0.05, `${sc.tpl}: ${p.type} and ${q.type} side by side, not on top of each other`);
    }
    assert.ok(sc.a.length >= 10, `${sc.tpl}: a full page (${sc.a.length} things)`);
    const safe = sc.layout.safe;
    if (safe) for (const o of [...sc.a, ...sc.b]) if (o.layer === 0) { const b = boxOf(o); assert.ok(b[0] >= safe[0] - 0.5 && b[1] >= safe[1] - 0.5 && b[2] <= safe[2] + 0.5 && b[3] <= safe[3] + 0.5, `${sc.tpl}: ${o.type} stays in view (behind the glass)`); }
    assert.ok(sc.a.filter((o) => o.type === 'cat').length <= 1 && sc.b.filter((o) => o.type === 'cat').length <= 1, 'her cat: one at most');
  }
});

test('five hallucinations: distinct, never overlapping, big enough to see, each a real change of one thing', () => {
  const seen = new Set();
  for (const sc of scenes) {
    const D = difficulty(sc.level);
    assert.equal(sc.diffs.length, N_DIFFS);
    const A = byId(sc.a), B = byId(sc.b);
    const changed = new Set();
    sc.diffs.forEach((d, i) => {
      assert.equal(d.i, i);
      assert.ok(KINDS.includes(d.kind), d.kind);
      seen.add(d.kind);
      assert.ok(typeof d.noun === 'string' && d.noun.length > 1);
      assert.ok(area(d.region) >= D.minArea - 1e-6, `${sc.tpl}: ${d.kind} ${d.noun} is big enough (${Math.round(area(d.region))})`);
      if (d.kind === 'remove' || d.kind === 'add') assert.ok(area(d.region) <= D.maxWhole + 1e-6, `${sc.tpl}: later levels make smaller things vanish or appear`);
      for (const e of sc.diffs.slice(i + 1)) assert.equal(overlap(grow(d.region, 6), e.region), 0, `${sc.tpl}: ${d.kind} ${d.noun} and ${e.kind} ${e.noun} apart`);
      const a = A.get(d.oid), b = B.get(d.oid);
      changed.add(d.oid);
      if (d.kind === 'remove') { assert.ok(a && !b, 'removed from the redraw'); return; }
      if (d.kind === 'add') { assert.ok(!a && b, 'added to the redraw'); return; }
      assert.ok(a && b, `${d.kind}: in both pictures`);
      if (d.kind === 'flip') assert.notEqual(a.flip, b.flip);
      else if (d.kind === 'size') assert.notEqual(a.s, b.s);
      else if (d.kind === 'move') assert.ok(a.x !== b.x || a.y !== b.y);
      else assert.notEqual(JSON.stringify(a.p), JSON.stringify(b.p), `${d.kind} ${d.noun}: its parameters changed`);
    });
    // everything else is the same in both pictures
    for (const o of sc.a) if (!changed.has(o.id)) assert.deepEqual(B.get(o.id), o, `${sc.tpl}: ${o.type} unchanged`);
    assert.equal(sc.b.length, sc.a.length + sc.diffs.filter((d) => d.kind === 'add').length - sc.diffs.filter((d) => d.kind === 'remove').length);
  }
  for (const k of ['remove', 'add', 'recolor', 'count', 'shape', 'size', 'move']) assert.ok(seen.has(k), `the kind "${k}" happens`);
});

test('difficulty: the clock shrinks with the level (never under 35 s) and the changes get subtler', () => {
  assert.equal(sceneTime(1), 60);
  assert.ok(sceneTime(2) < 60 && sceneTime(5) < sceneTime(2));
  assert.equal(sceneTime(50), 35);
  for (let l = 1; l < 15; l++) assert.ok(sceneTime(l + 1) <= sceneTime(l));
  const e = difficulty(1), h = difficulty(12);
  assert.ok(h.minArea < e.minArea && h.cmin < e.cmin && h.sizeK < e.sizeK && h.moveMin < e.moveMin, 'smaller, closer colors, smaller resizes and moves');
  assert.ok(h.w.count > e.w.count && h.w.remove < e.w.remove, 'subtler kinds later, obvious ones earlier');
  assert.ok(e.minArea >= 400, 'the first scenes: big changes (at least 20 × 20 page units)');
  assert.ok(h.minArea >= 240, 'even the hardest: about 16 × 16 at the smallest phone size');
});

test('taps: a tap on either picture inside or near a change finds it, a tap elsewhere is wrong', () => {
  const sc = scenes[3];
  const found = Array(5).fill(false);
  for (const d of sc.diffs) {
    const [x, y] = center(d.region);
    assert.deepEqual(hitTest(sc, x, y, 10, found), { hit: d.i });
    // just outside its box, but within the forgiving radius
    assert.equal(hitTest(sc, d.region[2] + 18, y, 26, found).hit, d.i === hitTest(sc, d.region[2] + 18, y, 26, found).hit ? d.i : hitTest(sc, d.region[2] + 18, y, 26, found).hit);
  }
  const d0 = sc.diffs[0];
  const x0 = d0.region[2] + 20, y0 = (d0.region[1] + d0.region[3]) / 2;
  if (sc.diffs.every((d) => d === d0 || Math.hypot(Math.max(d.region[0] - x0, 0, x0 - d.region[2]), Math.max(d.region[1] - y0, 0, y0 - d.region[3])) > 26)) {
    assert.equal(hitTest(sc, x0, y0, 26, found).hit, 0, 'within 26 units: found');
    assert.equal(hitTest(sc, x0, y0, 12, found).hit, -1, 'beyond 12 units: not');
  }
  const r = rng(5);
  const [wx, wy] = decoySpot(sc, r, 30);
  assert.equal(hitTest(sc, wx, wy, 26, found).hit, -1, 'a spot away from every change finds nothing');
  found[0] = true;
  const [cx, cy] = center(sc.diffs[0].region);
  assert.deepEqual(hitTest(sc, cx, cy, 10, found), { again: 0 }, 'tapping one already found again');
  assert.ok(RULES.tapRadiusPx >= 24, 'a generous hit radius (≥ 24 CSS px)');
});

test('the clock, a wrong tap, finds, combos and a cleared scene', () => {
  const sc = scenes[5];
  const run = startScene(createRun({ mode: 'endless', seed: 3 }));
  assert.equal(run.timeLeft, 60);
  assert.equal(run.hints, 2); assert.equal(run.blinks, 2);
  tick(run, 10);
  assert.equal(run.timeLeft, 50);
  const far = decoySpot(sc, rng(9), 40);
  const w = tap(run, sc, far[0], far[1], 26);
  assert.equal(w.type, 'wrong');
  assert.equal(run.timeLeft, 47, 'a wrong tap: −3 s');
  assert.equal(run.wrongs, 1);
  const c0 = center(sc.diffs[0].region);
  const f1 = tap(run, sc, c0[0], c0[1], 26);
  assert.equal(f1.type, 'find'); assert.equal(f1.combo, 1);
  assert.equal(f1.points, RULES.findBase + Math.max(0, RULES.speedMax - RULES.speedDecay * 10));
  tick(run, 1);
  const c1 = center(sc.diffs[1].region);
  const f2 = tap(run, sc, c1[0], c1[1], 26);
  assert.equal(f2.combo, 2, 'within 2.5 s: ×2');
  assert.equal(f2.points, (RULES.findBase + RULES.speedMax - RULES.speedDecay) * 2);
  tick(run, 1);
  assert.equal(find(run, 2).combo, 3, '×3');
  tick(run, 3);
  assert.equal(find(run, 3).combo, 1, 'more than 2.5 s later: the combo starts again');
  assert.equal(run.bestCombo, 3);
  assert.equal(tap(run, sc, c0[0], c0[1], 26).type, 'again', 'a second tap on a found one costs nothing');
  assert.equal(run.timeLeft, 42);
  const last = find(run, 4);
  assert.equal(last.cleared, true);
  assert.equal(tick(run, 5), false, 'the clock stops once all five are found');
  const before = run.score;
  const { bonus } = clearScene(run);
  assert.equal(bonus, RULES.clearBase + Math.round(42 * RULES.clearPerSecond));
  assert.equal(run.score, before + bonus);
  assert.equal(run.level, 2); assert.equal(run.scenes, 1);
  startScene(run);
  assert.equal(run.timeLeft, sceneTime(2));
  assert.equal(tick(run, 999), true, 'the clock runs out: the run is over');
  assert.equal(run.over, true);
  assert.equal(tap(run, sc, c0[0], c0[1], 26), null, 'no taps after the end');
});

test('hints: 2 a run, +1 every 3 scenes (up to 5); a hinted find is worth less and breaks no rules; blinks: 2 a run', () => {
  const run = startScene(createRun({ seed: 1 }));
  const i = useHint(run, (open) => open[2]);
  assert.equal(i, 2); assert.equal(run.hints, 1); assert.equal(run.hintsUsed, 1);
  assert.equal(useHint(run), -1, 'one confession at a time');
  const f = find(run, 2);
  assert.equal(f.points, RULES.hintedFind);
  assert.equal(useHint(run, (o) => o[0]), 0);
  assert.equal(run.hints, 0);
  find(run, 0);
  assert.equal(useHint(run), -1, 'none left');
  for (let s = 1; s <= 3; s++) { run.sceneFound = [true, true, true, true, true]; clearScene(run); startScene(run); }
  assert.equal(run.hints, 1, '+1 after 3 scenes');
  assert.equal(useBlink(run), true); assert.equal(useBlink(run), true); assert.equal(useBlink(run), false);
  assert.equal(run.blinksUsed, 2);
  const big = createRun({ seed: 2 });
  for (let s = 1; s <= 30; s++) { startScene(big); big.sceneFound = [true, true, true, true, true]; clearScene(big); }
  assert.equal(big.hints, RULES.hintsMax);
});

test('the daily scene: one seed per local date, the places take turns, timed (penalties add time)', () => {
  assert.equal(dateKey(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
  assert.equal(dateKey(new Date(2026, 0, 3)), '2026-01-03');
  assert.equal(dailySeed('2026-11-08'), dailySeed('2026-11-08'));
  const seeds = new Set(Array.from({ length: 60 }, (_, d) => dailySeed(dateKey(new Date(2026, 10, 1 + d)))));
  assert.equal(seeds.size, 60, 'a new scene every day');
  const week = Array.from({ length: TEMPLATE_IDS.length }, (_, d) => dailyTemplate(dateKey(new Date(2026, 10, 1 + d)), TEMPLATE_IDS));
  assert.equal(new Set(week).size, TEMPLATE_IDS.length, 'every place once in a row of days');
  const sc = makeScene(dailySeed('2026-11-08'), RULES.dailyLevel, { template: dailyTemplate('2026-11-08', TEMPLATE_IDS) });
  assert.equal(JSON.stringify(sc.diffs), JSON.stringify(makeScene(dailySeed('2026-11-08'), RULES.dailyLevel, { template: dailyTemplate('2026-11-08', TEMPLATE_IDS) }).diffs), 'everyone gets the same daily scene');
  const run = startScene(createRun({ mode: 'daily', seed: 1 }));
  assert.equal(run.hints, 1); assert.equal(run.blinks, 1);
  tick(run, 12.5);
  assert.equal(run.elapsed, 12.5);
  const far = decoySpot(sc, rng(3), 40);
  tap(run, sc, far[0], far[1], 26);
  assert.equal(run.elapsed, 15.5, 'a wrong tap adds 3 s');
  useHint(run); assert.equal(run.elapsed, 15.5 + RULES.dailyHint);
  useBlink(run); assert.equal(run.elapsed, 15.5 + RULES.dailyHint + RULES.dailyBlink);
  assert.equal(clearScene(run).bonus, 0);
  assert.equal(fmtSecs(42.25), '0:42.3'); assert.equal(fmtSecs(75), '1:15.0'); assert.equal(fmtSecs(9.04), '0:09.0');
  const capped = startScene(createRun({ mode: 'daily' }));
  assert.equal(tick(capped, RULES.dailyCap + 1), true, 'the daily stops after its cap');
});

test('the endless run: a scene seed per level, every place in turn (never twice in a row)', () => {
  assert.equal(sceneSeed(5, 0), sceneSeed(5, 0));
  assert.notEqual(sceneSeed(5, 0), sceneSeed(5, 1));
  const order = templateOrder(12345, TEMPLATE_IDS, 40);
  assert.equal(order.length, 40);
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1]);
  assert.deepEqual(new Set(order.slice(0, TEMPLATE_IDS.length)), new Set(TEMPLATE_IDS));
  assert.deepEqual(templateOrder(12345, TEMPLATE_IDS, 40), order);
});

test('the content: at least 8 places and 50 objects, all drawable; palettes complete; every change kind has a confession', () => {
  assert.ok(TEMPLATE_IDS.length >= 8, `${TEMPLATE_IDS.length} places`);
  assert.ok(TYPES.length >= 50, `${TYPES.length} objects`);
  const ctx = stubCtx();
  const r = rng(11);
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    assert.ok(t.palettes.length >= 1 && typeof t.compose === 'function' && typeof t.paint === 'function', id);
    for (const p of t.palettes) {
      assert.match(p.ink, /^#[0-9a-f]{6}$/i, `${id}: an ink`);
      assert.ok(p.acc.length >= 6 && p.acc.length <= 8, `${id}/${p.id}: 6 to 8 colors`);
      for (const c of p.acc) assert.match(c, /^#[0-9a-f]{6}$/i);
    }
  }
  for (const t of TYPES) {
    const d = LIB[t];
    assert.ok(d.noun && typeof d.box === 'function' && typeof d.make === 'function' && typeof d.draw === 'function', t);
    for (const pal of [TEMPLATES.bedroom.palettes[0], TEMPLATES.city.palettes[0]]) {
      for (let k = 0; k < 4; k++) {
        const p = d.make(r, pal, {});
        const o = { type: t, x: 200, y: 200, s: 1, flip: k % 2 === 1, p };
        const b = boxOf(o);
        assert.ok(b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1], `${t}: a box`);
        const S = { ink: pal.ink, lw: 2, shade: 'rgba(0,0,0,.2)', shade2: 'rgba(0,0,0,.3)', hi: '#fff', ground: 'rgba(0,0,0,.1)', steam: '#000', pal, flip: false, night: k > 1 };
        assert.doesNotThrow(() => drawObject(ctx, o, S), `${t} draws`);
      }
    }
    if (Array.isArray(d.muts)) for (const spec of d.muts) assert.ok(['recolor', 'recolorAt', 'pattern', 'shape', 'symbol', 'count', 'swap', 'toggle', 'time'].includes(spec[0]), `${t}: ${spec[0]}`);
  }
  for (const sc of scenes.slice(0, 12)) {
    const S = { ink: sc.pal.ink, lw: 2, shade: '#000', shade2: '#000', hi: '#fff', ground: '#000', pal: sc.pal, flip: false };
    for (const layer of [0, 1, 'fg']) assert.doesNotThrow(() => TEMPLATES[sc.tpl].paint(ctx, sc, S, layer), `${sc.tpl} paints ${layer}`);
  }
  for (const k of KINDS) assert.ok(confess({ kind: k, noun: 'cat' }).length > 8, k);
  assert.match(confess({ kind: 'add', noun: 'cat' }), /made up the cat/);
  for (const list of Object.values(LISTS)) for (const c of list) assert.match(c, /^#[0-9a-f]{6}$/i);
});

test('AGI-1\'s words: in her voice, at least 25 lines, never money, never too long for a caption', () => {
  const all = [...Object.values(LINES).flat(), ...END_BEST, ...END_CLOSE, ...DAILY_DONE, ...DAILY_BEST, ...KINDS.map((k) => confess({ kind: k, noun: 'fishbowl' })),
    ...[0, 3, 10, 20, 40].map((n) => endLine(n, false)), shareText(12), dailyShare('0:42.0')];
  assert.ok(all.length >= 25, `${all.length} lines`);
  for (const l of all) {
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b|\bcoin/i, l);
    assert.ok(l.length <= 110, l);
  }
  for (const l of [...Object.values(LINES).flat(), ...KINDS.map((k) => confess({ kind: k, noun: 'cat' }))]) {
    assert.equal(l, l.toLowerCase(), `lowercase: ${l}`);
    assert.ok(l.length <= 56, `fits her caption: ${l}`);
  }
  assert.equal(shareText(12), 'I caught AGI-1 hallucinating 12 times in HALLUCINATION on agi1.app 👀💜');
  assert.equal(endLine(5, true), END_BEST[0]);
});

test('the demo\'s player: four finds and one wrong tap a scene, at a human pace, every find on its change', () => {
  for (const sc of scenes.slice(0, 20)) {
    const r = rng(sc.seed);
    const plan = planDemo(sc, r, { found: [sc.diffs[0].i], times: PREVIEW_TIMES, wrongBefore: 1 });
    const finds = plan.filter((a) => a.i >= 0), wrong = plan.filter((a) => a.i < 0);
    assert.equal(finds.length, 4); assert.equal(wrong.length, 1);
    assert.deepEqual(finds.map((a) => a.at), [...PREVIEW_TIMES]);
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at > plan[i - 1].at + 0.3, 'one after another, never rushed');
    for (const a of finds) assert.equal(hitTest(sc, a.x, a.y, 4, Array(5).fill(false)).hit, a.i, 'it taps the change itself');
    assert.equal(hitTest(sc, wrong[0].x, wrong[0].y, 26, Array(5).fill(false)).hit, -1, 'its one mistake is a real miss');
    const paced = planDemo(sc, rng(1), { start: 2, pace: 1.1 });
    assert.equal(paced.length, 6);
    const gaps = paced.filter((a) => a.i >= 0).map((a, i, arr) => (i ? a.at - arr[i - 1].at : 1.1));
    for (const g of gaps) assert.ok(g > 0.8 && g < 1.5, `about 1.1 s a find (${g.toFixed(2)})`);
  }
  assert.ok(PREVIEW_TIMES[0] > 5.7 && PREVIEW_TIMES[PREVIEW_TIMES.length - 1] < 11.7 - 2.1, 'the recorded window shows the finds and the scene being cleared');
});

test('the layout: both pictures as big as fits, stacked on tall screens, side by side on wide ones, inside the screen', () => {
  const sizes = [[390, 844], [360, 740], [360, 640], [844, 390], [820, 1180], [1024, 768], [884, 1104], [1440, 900], [2560, 1440], [480, 480, true], [480, 640, true]];
  for (const [w, h, demo] of sizes) {
    const L = computeLayout(w, h, demo ? undefined : { top: 62, right: 0, bottom: 0, left: 0 }, { demo: Boolean(demo) });
    for (const P of [...L.pics, ...L.cards, L.strip]) {
      assert.ok(P.x >= 0 && P.y >= (demo ? 0 : 62) && P.x + P.w <= w + 0.5 && P.y + P.h <= h + 0.5, `${w}×${h}: inside the screen`);
    }
    assert.equal(Math.round(L.pics[0].w * 0.75), L.pics[0].h, 'the pictures are 4:3');
    assert.equal(L.pics[0].w, L.pics[1].w, 'the same size');
    assert.equal(overlap([L.cards[0].x, L.cards[0].y, L.cards[0].x + L.cards[0].w, L.cards[0].y + L.cards[0].h], [L.cards[1].x, L.cards[1].y, L.cards[1].x + L.cards[1].w, L.cards[1].y + L.cards[1].h]), 0);
    if (!demo) assert.ok(L.strip.h >= 44, 'touch targets of 44 px');
    const P = L.pics[1];
    const hit = pickPicture(L, P.x + P.w / 2, P.y + P.h / 4);
    assert.equal(hit.pic, 1); assert.ok(Math.abs(hit.x - 200) < 1 && Math.abs(hit.y - 75) < 1);
    assert.equal(pickPicture(L, 1, 1).pic, -1);
  }
  assert.equal(computeLayout(390, 844, { top: 62, right: 0, bottom: 0, left: 0 }).stacked, true, 'a phone held upright: stacked');
  assert.equal(computeLayout(844, 390, { top: 54, right: 0, bottom: 0, left: 0 }).stacked, false, 'a phone held sideways: side by side');
  assert.equal(computeLayout(1440, 900, { top: 62, right: 0, bottom: 0, left: 0 }).stacked, false);
  assert.ok(computeLayout(390, 844, { top: 62, right: 0, bottom: 0, left: 0 }).pics[0].w >= 350, 'a phone\'s full width');
  assert.ok(computeLayout(480, 480, undefined, { demo: true }).pics[0].w >= 235, 'the preview: as big as a square allows');
});
