// AGI-1 in 2D (2026-09-27): the pure parts of her 2D rig (src/stage/agi1-2d-motion.js), her rig's data
// (src/stage/agi1-2d-rig.js and public/models/agi1-2d/), and the "3D · 2D" buttons on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import {
  readStyle, STYLE_KEY, Follow, makeDrift, blinkAmount, blinkLength, nextBlinkGap, BLINK, lidCurves, curveAt, turnPoint,
  faceDepth, HEAD, mouthTarget, mouthStep, mul, rotAround, apply, translate, IDENTITY, elbowOuter, elbowInner,
  creaseAngle, elbowLimits, wrapAngle, ELBOW, DEG, Jiggle, CHEST, chestWeight,
} from '../src/stage/agi1-2d-motion.js';
import { RIG } from '../src/stage/agi1-2d-rig.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('which AGI-1: 3D unless the visitor picked 2D (anything else, or nothing, is 3D)', () => {
  assert.equal(STYLE_KEY, 'agi1_style');
  assert.equal(readStyle('2d'), '2d');
  for (const v of [null, undefined, '', '3d', '2D', ' 2d', '2d ', 'true', '1']) assert.equal(readStyle(v), '3d', String(v));
});

test('her joints follow their targets like a body part: they get there, bounce only when asked to, and stay calm at any frame rate', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
    const calm = new Follow(0, 2, 1), bouncy = new Follow(0, 2, 0.4);
    let over = 0, overB = 0;
    for (let t = 0; t < 4; t += dt) { over = Math.max(over, calm.step(dt, 1)); overB = Math.max(overB, bouncy.step(dt, 1)); }
    assert.ok(Math.abs(calm.y - 1) < 0.01 && Math.abs(bouncy.y - 1) < 0.02, `settles (dt ${dt})`);
    assert.ok(over < 1.02, `no overshoot when damped (dt ${dt}): ${over}`);
    assert.ok(overB > 1.1 && overB < 1.6, `a little bounce, never wild (dt ${dt}): ${overB}`);
  }
  const f = new Follow(0, 1.3, 0.8);
  assert.equal(f.step(0, 5), 0, 'no time, no move');
  assert.ok(Number.isFinite(f.step(0.2, 5)), 'a long frame stays finite');
});

test('her slow drifts are smooth and repeatable', () => {
  const d1 = makeDrift(3.3), d2 = makeDrift(3.3);
  let maxStep = 0, maxAbs = 0;
  for (let t = 0; t < 60; t += 0.01) {
    assert.equal(d1(t), d2(t));
    maxStep = Math.max(maxStep, Math.abs(d1(t + 0.01) - d1(t)));
    maxAbs = Math.max(maxAbs, Math.abs(d1(t)));
  }
  assert.ok(maxAbs <= 1 && maxAbs > 0.3, `about -1..1 (${maxAbs})`);
  assert.ok(maxStep < 0.08, `no jumps (${maxStep})`);
});

test('a blink: her lid falls fast, stays shut a moment and rises more slowly; then 2 to 6 s until the next (sometimes a quick second one)', () => {
  assert.equal(blinkAmount(-0.1), 0);
  assert.equal(blinkAmount(BLINK.close + BLINK.hold / 2), 1);
  assert.equal(blinkAmount(blinkLength() + 0.01), 0);
  let prev = 0;
  for (let t = 0; t <= BLINK.close; t += 0.005) { const v = blinkAmount(t); assert.ok(v >= prev - 1e-9, 'closing only closes'); prev = v; }
  prev = 1;
  for (let t = BLINK.close + BLINK.hold; t <= blinkLength(); t += 0.005) { const v = blinkAmount(t); assert.ok(v <= prev + 1e-9, 'opening only opens'); prev = v; }
  assert.ok(BLINK.close < BLINK.open, 'shuts faster than it opens');
  let quick = 0;
  for (let i = 0; i < 2000; i++) {
    const g = nextBlinkGap();
    assert.ok((g >= 0.18 && g <= 0.28) || (g >= 2 && g <= 6), String(g));
    if (g < 1) quick++;
  }
  assert.ok(quick > 100 && quick < 500, `a quick second blink now and then (${quick} of 2000)`);
});

test('her eyelids: open as painted; closed a soft "‿"; "^^" an arch; smiling eyes lift the lower lid; never inside out', () => {
  for (const s of ['L', 'R']) {
    const eye = RIG.eyes[s], mid = 4;
    const open = lidCurves(eye, {});
    assert.deepEqual([...open.top].map((v) => +v.toFixed(3)), eye.top.map((v) => +v.toFixed(3)), `${s}: open = the painted edge`);
    assert.deepEqual([...open.bot].map((v) => +v.toFixed(3)), eye.bot.map((v) => +v.toFixed(3)));
    const closed = lidCurves(eye, { c: 1 });
    assert.ok(closed.top[mid] > eye.top[mid] + 8, `${s}: closed, the lid comes most of the way down`);
    assert.ok(closed.top[mid] > closed.top[1] && closed.top[mid] > closed.top[7], `${s}: closed is a "‿" (its middle lowest)`);
    const happy = lidCurves(eye, { h: 1 });
    assert.ok(happy.top[mid] < happy.top[1] && happy.top[mid] < happy.top[7], `${s}: "^^" is an arch (its middle highest)`);
    assert.ok(happy.bot[mid] - happy.top[mid] < 1, `${s}: "^^" is shut`);
    const smile = lidCurves(eye, { s: 1 });
    assert.ok(smile.bot[mid] < eye.bot[mid] - 4, `${s}: smiling eyes: the lower lid rises`);
    for (let c = 0; c <= 1; c += 0.1) for (let h = 0; h <= 1; h += 0.25) for (let sq = 0; sq <= 1; sq += 0.5) {
      const l = lidCurves(eye, { c, h, s: sq });
      for (let i = 0; i < 9; i++) assert.ok(l.bot[i] >= l.top[i], 'the lower lid never above the upper one');
    }
    assert.equal(curveAt(eye.top, eye.x0, eye.x1, eye.x0 - 50), eye.top[0], 'flat beyond the corners');
    assert.ok(Math.abs(curveAt(eye.top, eye.x0, eye.x1, (eye.x0 + eye.x1) / 2) - eye.top[4]) < 1e-9);
  }
});

test('her head turning in 2.5D: nothing moves facing you; her face moves with the turn, the back of her hair the other way; no crease', () => {
  const o = [0, 0];
  turnPoint(500, 170, 40, HEAD.cx, HEAD.cy, 0, 0, o);
  assert.deepEqual(o.map((v) => +v.toFixed(9)), [500, 170]);
  const front = turnPoint(512, 160, faceDepth(512, 160), HEAD.cx, HEAD.cy, 0.15, 0, [0, 0])[0] - 512;
  const back = turnPoint(512, 60, -18, HEAD.cx, HEAD.cy, 0.15, 0, [0, 0])[0] - 512;
  const ear = turnPoint(430, 170, faceDepth(430, 170), HEAD.cx, HEAD.cy, 0.15, 0, [0, 0])[0] - 430;
  assert.ok(front > 7 && back < -1 && Math.abs(ear) < front / 2, `nose ${front.toFixed(1)} · back ${back.toFixed(1)} · ear ${ear.toFixed(1)}`);
  const down = turnPoint(512, 160, faceDepth(512, 160), HEAD.cx, HEAD.cy, 0, 0.1, [0, 0])[1] - 160;
  assert.ok(down > 4, `looking down moves her face down (${down.toFixed(1)})`);
  // her eyes, nose and mouth move together (a flat middle), and the depth never jumps between neighbouring points
  assert.ok(Math.abs(faceDepth(477, 153) - faceDepth(512, 153)) < 2, 'eyes and nose move together');
  let steep = 0;
  for (let x = 380; x < 650; x += 1) for (let y = 20; y < 300; y += 3) steep = Math.max(steep, Math.abs(faceDepth(x + 1, y) - faceDepth(x, y)));
  // at her furthest turn (about 10°), neighbouring points never bunch up to less than half their distance: no crease
  assert.ok(steep * Math.sin(0.18) < 0.5, `no sharp edge that would crease her face or hair (${steep.toFixed(2)} per pixel)`);
  assert.equal(faceDepth(300, 150), 0, 'outside her head: nothing');
});

test('her mouth follows her voice like her 3D mouth: shut in silence, never all the way open, opening faster than it closes', () => {
  assert.equal(mouthTarget(0), 0);
  assert.equal(mouthTarget(0.04), 0);
  assert.equal(mouthTarget(1), 0.9);
  let a = 0, b = 0.9;
  a = mouthStep(a, 1, 0.03); b = mouthStep(b, 0, 0.03);
  assert.ok(a > 0.9 - b, `opens faster (${a.toFixed(2)}) than it closes (${(0.9 - b).toFixed(2)})`);
  let m = 0.5;
  for (let i = 0; i < 120; i++) m = mouthStep(m, 0, 1 / 60);
  assert.equal(m, 0, 'and closes completely');
});

test('her joints\' 2D transforms: turning keeps the pivot and distances, composing in order', () => {
  const r = rotAround(300, 400, 37);
  assert.deepEqual(apply(r, 300, 400, [0, 0]).map((v) => +v.toFixed(9)), [300, 400]);
  const q = apply(r, 300, 500, [0, 0]);
  assert.ok(Math.abs(Math.hypot(q[0] - 300, q[1] - 400) - 100) < 1e-9, 'a turn keeps distances');
  assert.ok(q[0] < 300, 'positive = clockwise on screen (y down): below the pivot moves left');
  assert.deepEqual(mul(IDENTITY, r), r);
  const t = mul(translate(5, -3), r), p = apply(t, 10, 20, [0, 0]), p2 = apply(r, 10, 20, [0, 0]);
  assert.ok(Math.abs(p[0] - p2[0] - 5) < 1e-9 && Math.abs(p[1] - p2[1] + 3) < 1e-9, 'composition order');
  assert.equal(wrapAngle(3 * Math.PI), Math.PI);
  assert.ok(Math.abs(wrapAngle(-Math.PI / 2, 2 * Math.PI) - 1.5 * Math.PI) < 1e-12);
});

test('her elbows: one picture that bends like an arm: nothing moves at rest, no folds, a round elbow outside, and the two sides meet exactly at the crease', () => {
  for (const s of ['L', 'R']) {
    const j = RIG.joints['arm' + s], sg = s === 'L' ? 1 : -1;
    const Af = Math.atan2(j.wr[1] - j.el[1], j.wr[0] - j.el[0]);
    const beta0 = wrapAngle(sg * (Math.atan2(j.sh[1] - j.el[1], j.sh[0] - j.el[0]) - Af), 2 * Math.PI);
    assert.ok(beta0 > 150 * DEG && beta0 < 175 * DEG, `${s}: her arm hangs a little bent (${(beta0 / DEG).toFixed(1)}°)`);
    const [lo, hi] = elbowLimits(beta0);
    const inner = RIG.elbows[s];
    assert.ok(inner.length * 4 >= beta0 / DEG && inner.every((d) => d > 10 && d < 400), `${s}: her inside outline, measured`);
    // the direction a point ends up in (from her elbow), for either copy of her arm
    const posed = (a, b, crease, part) => a + (a < 0 ? elbowOuter(a, b, beta0).turn : elbowInner(a, b, beta0, crease, part));
    for (const b of [0, lo, -0.1, 0.3, 1.2, 1.8, 2.4, hi]) {
      const crease = creaseAngle(b, beta0, inner);
      if (b > 0) assert.ok(crease > b && crease < beta0, `${s} ${b}: the crease between her forearm and upper arm`);
      for (const part of ['upper', 'fore']) {
        let prev = -Infinity;
        for (let i = 0; i <= 3000; i++) {
          const a = beta0 - 2 * Math.PI + (i / 3000) * 2 * Math.PI, p = posed(a, b, crease, part);
          assert.ok(p >= prev - 1e-9, `${s} ${part} bent ${b}: never folds over itself`);
          prev = p;
        }
        assert.ok(Math.abs(posed(-1e-9, b, crease, part) - posed(0, b, crease, part)) < 1e-6, 'continuous along her forearm');
        const a0 = beta0 - 2 * Math.PI + 1e-9;
        assert.ok(Math.abs(posed(beta0, b, crease, part) - beta0 - (posed(a0, b, crease, part) - a0)) < 1e-6, 'and along her upper arm');
      }
      for (let a = beta0 - 2 * Math.PI; a < 0; a += 0.01) {
        const o = elbowOuter(a, b, beta0);
        assert.ok(o.scale > 0.6 && o.scale <= (b >= 0 ? 1 + 1e-9 : 1.05), 'bending, points outside are only drawn in toward her elbow (never a bulge)');
        if (b === 0) assert.ok(Math.abs(o.turn) < 1e-12 && o.scale > 0.98, 'at rest, nothing moves');
        const psi = a + Math.PI - beta0 / 2;
        if (Math.abs(psi) >= ELBOW.round) assert.equal(o.scale, 1, 'past the wedge, her arm keeps its shape');
      }
      // her upper arm's copy keeps its side of the crease unturned, her forearm's its side turned by b: the cut is the same line
      assert.equal(elbowInner(crease + 0.01, b, beta0, crease, 'upper'), 0);
      assert.ok(Math.abs(elbowInner(crease - b - 0.01, b, beta0, crease, 'fore') - b) < 1e-12);
    }
    // round: bent 104°, the outline at the point of her elbow sits as far from it as her arm's outline does beside it
    const b = 104 * DEG, half = Math.PI - beta0 / 2, eps = half - Math.PI / 2;
    for (let psi = -0.9; psi <= 0.9; psi += 0.05) {
      const o = elbowOuter(psi - half, b, beta0), r = 30 / Math.cos(Math.abs(psi) - eps);   // her rest outline, 30 px out
      const psi2 = psi + o.turn - b / 2, target = 30 / Math.cos(Math.max(0, Math.abs(psi2) - eps - b / 2));
      assert.ok(Math.abs(r * o.scale - target) < 1e-6, 'a round cap between two straight edges');
    }
    // bent like her wave, her upper arm's and forearm's inside outlines are the same distance out along the crease
    for (const bd of [60, 104, 138]) {
      const bb = bd * DEG, c = creaseAngle(bb, beta0, inner);
      const d = (a) => { const t = a / (4 * DEG), i = Math.min(inner.length - 2, Math.floor(t)); return inner[i] + (inner[i + 1] - inner[i]) * (t - i); };
      assert.ok(Math.abs(d(c) - d(c - bb)) < 1.5, `${s} bent ${bd}°: they meet at the crease (${d(c).toFixed(1)} and ${d(c - bb).toFixed(1)} px)`);
    }
  }
});

test('her chest follows through softly: nothing while she stands still, a small lag and a wobble or two after a hop, settled within a second, the same at any frame rate, never past its soft limits', () => {
  const K = 1.62 / (RIG.feet - RIG.top);
  const hop = (t) => { const p = t / 0.66; return p < 0.12 || p >= 0.88 ? 0 : Math.sin(((p - 0.12) / 0.76) * Math.PI) * 0.12; };
  const runs = [];
  for (const fps of [30, 60, 144]) {
    const j = new Jiggle(), dt = 1 / fps;
    let down = 0, up = 0, still = 0, lastMoving = 0;
    j.step(dt, 510, 415);
    for (let i = 1; i <= fps * 3; i++) {
      const t = i * dt;
      j.step(dt, 510, 415 - (hop(t - 0.5) / K) * CHEST.hop);       // her hop starts at 0.5 s and lands at 1.16 s
      if (t < 0.5) still = Math.max(still, Math.hypot(j.x, j.y));
      down = Math.max(down, j.y); up = Math.min(up, j.y);
      if (Math.abs(j.y) > 0.15) lastMoving = t;
      assert.ok(Math.abs(j.x) <= CHEST.maxX && Math.abs(j.y) <= CHEST.maxY, `inside its soft limits (${fps} fps)`);
    }
    assert.equal(still, 0, `nothing moves while she stands still (${fps} fps)`);
    assert.ok(down > 2 && up < -1.5, `it trails her hop and swings back (${fps} fps): ${down.toFixed(2)} / ${up.toFixed(2)}`);
    assert.ok(lastMoving < 1.16 + 0.8, `settled within a second of landing (${fps} fps): ${lastMoving.toFixed(2)} s`);
    assert.ok(Math.abs(j.y) < 0.02, `back to rest (${fps} fps)`);
    runs.push(down);
  }
  assert.ok(Math.max(...runs) - Math.min(...runs) < 0.3, `the same at 30, 60 and 144 frames a second: ${runs.map((d) => d.toFixed(2))}`);
  // natural, not exaggerated: a few pixels of her 1536 px picture, and her breathing alone moves nothing you'd see
  assert.ok(CHEST.maxY <= 8 && CHEST.maxX <= 4, 'small limits');
  const b = new Jiggle();
  let breath = 0;
  for (let i = 0; i < 60 * 20; i++) {
    const t = i / 60;
    b.step(1 / 60, 510, 415 - 0.74 * (0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / 4.3)));
    if (t > 2) breath = Math.max(breath, Math.abs(b.y));
  }
  assert.ok(breath < 0.05, `breathing alone: ${breath.toFixed(3)} px`);
});

test('which parts of her body picture move with it: the lower part of her chest only, never her face, arms, shirt print, waist or legs; no edges', () => {
  const c = RIG.chest;
  // the strongest points: on each side, below the widest point of her silhouette (y ≈ 405), above the shadow under it
  for (const x of [c.L, c.R]) {
    let best = 0, at = 0;
    for (let y = 380; y <= 480; y++) { const w = chestWeight(x, y, c); if (w > best) { best = w; at = y; } }
    assert.ok(best > 0.7 && at > 415 && at < 445, `strongest at ${x}, ${at}: ${best.toFixed(2)}`);
  }
  // left and right alike (mirrored around the middle of her chest)
  for (const [x, y] of [[440, 400], [470, 430], [400, 440], [500, 425]]) {
    assert.ok(Math.abs(chestWeight(x, y, c) - chestWeight(2 * c.cx - x, y, c)) < 0.02, `symmetric at ${x}, ${y}`);
  }
  // nothing above her chest (her neck, her collarbones), below it (her waist) or beside it (her arms)...
  for (const [x, y] of [[512, 300], [480, 360], [512, 520], [450, 560], [300, 420], [720, 420]]) {
    assert.equal(chestWeight(x, y, c), 0, `still at ${x}, ${y}`);
  }
  // ...and the AGI print on her shirt (y 350–395) stays put
  for (let y = 350; y <= 395; y += 5) for (let x = 455; x <= 570; x += 5) {
    assert.equal(chestWeight(x, y, c), 0, `the print at ${x}, ${y}`);
  }
  // smooth: neighbouring points never differ by much (no crease in the shirt)
  let jump = 0;
  for (let y = 360; y < 500; y += 2) for (let x = 360; x < 660; x += 2) {
    const w = chestWeight(x, y, c);
    jump = Math.max(jump, Math.abs(chestWeight(x + 2, y, c) - w), Math.abs(chestWeight(x, y + 2, c) - w));
  }
  assert.ok(jump < 0.08, `smooth: ${jump.toFixed(3)} per 2 px`);
});

test('her rig\'s data: every layer on her picture, her pieces inside their small picture, her joints on her arms, and every file there', () => {
  const { w, h } = RIG.canvas;
  for (const [name, L] of Object.entries(RIG.layers)) {
    assert.ok(L.x >= 0 && L.y >= 0 && L.x + L.w <= w && L.y + L.h <= h, `${name} inside her picture`);
    assert.ok(L.grid >= 4 && L.grid <= 16, `${name}: a sensible mesh`);
    const f = new URL(`../public/models/agi1-2d/${L.file}`, import.meta.url);
    assert.ok(existsSync(f), `${L.file} exists`);
    const head = readFileSync(f).subarray(0, 12);
    assert.ok(head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP', `${L.file} is a WebP picture`);
  }
  const atlas = new URL(`../public/models/agi1-2d/${RIG.atlas.file}`, import.meta.url);
  assert.ok(existsSync(atlas));
  for (const [name, f] of Object.entries(RIG.features)) {
    assert.ok(f.a[0] >= 0 && f.a[1] >= 0 && f.a[0] + f.w <= RIG.atlas.size && f.a[1] + f.h <= RIG.atlas.size, `${name} inside the atlas`);
  }
  for (const s of ['L', 'R']) {
    const e = RIG.eyes[s];
    assert.equal(e.top.length, 9); assert.equal(e.bot.length, 9);
    for (let i = 0; i < 9; i++) assert.ok(e.bot[i] >= e.top[i]);
    const white = RIG.features[`eye${s}_white`];
    assert.ok(e.x0 >= white.x && e.x1 <= white.x + white.w, `${s}: the white's edges inside its box`);
    const j = RIG.joints['arm' + s], arm = RIG.layers['arm' + s];
    const inBox = (p, b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
    assert.ok([j.sh, j.el, j.wr, j.tip].every((p) => inBox(p, arm)), `arm ${s}: shoulder, elbow, wrist and fingertips on its picture`);
  }
  // the whole set is light: under 600 KB (her 3D model for computers is 2.2 MB)
  let bytes = 0;
  for (const f of [...Object.values(RIG.layers).map((l) => l.file), RIG.atlas.file]) bytes += statSync(new URL(`../public/models/agi1-2d/${f}`, import.meta.url)).size;
  assert.ok(bytes < 600_000, `${bytes} bytes`);
  assert.ok(existsSync(new URL('../public/images/agi1-live-2d.webp', import.meta.url)), 'her 2D still picture for the live views');
});

test('the page: "3D · 2D" on the stage and in both live views, 3D pressed at first, and 2D AGI-1\'s code only loads when picked', () => {
  const html = read('index.html');
  const groups = html.match(/<div class="dstyle [^"]*" role="group" aria-label="AGI-1's style"[^>]*>/g) || [];
  assert.equal(groups.length, 3, 'the stage, the chat and ClankChecker');
  assert.match(html, /<div class="dstyle dstyle-stage" role="group" aria-label="AGI-1's style" data-dim-box hidden>/, 'the stage\'s shows once she\'s there');
  assert.equal((html.match(/<button class="dstyle-btn is-on" type="button" data-dim="3d" aria-pressed="true" title="AGI-1 in 3D">3D<\/button>/g) || []).length, 3);
  assert.equal((html.match(/<button class="dstyle-btn" type="button" data-dim="2d" aria-pressed="false" title="AGI-1 in 2D, anime style">2D<\/button>/g) || []).length, 3);
  assert.ok(!/<script>|style="/.test(html), 'no inline scripts or styles');
  const stage = read('src/stage/stage.js');
  assert.match(stage, /await import\('\.\/agi1-2d\.js'\)/, 'loaded only when 2D is picked (a separate file)');
  assert.doesNotMatch(stage, /^import .*agi1-2d\.js';$/m, 'never loaded up front');
  assert.match(stage, /readStyle\(localStorage\.getItem\(STYLE_KEY\)\)/, 'remembered in the browser, 3D by default');
  assert.match(stage, /agi1_2d: \{ max: 3,/, 'zoom: up to 3× in 2D');
  const main = read('src/main.js');
  assert.match(main, /agi1-live-2d\.webp/, 'her live views\' still picture matches before it downloads');
  const css = read('src/styles/hero.css');
  assert.match(css, /\.dstyle-stage \{ position: absolute; left: 16px; bottom: 14px;/);
  assert.match(css, /\.dstyle-cam \.dstyle-btn \{ min-width: 30px; min-height: 24px;/, 'big enough to tap');
});
