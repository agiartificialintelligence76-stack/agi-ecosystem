// The AGI GAMES intro (2026-10-20, the owner: "can you add a short loading screen for every game like an intro "AGI GAMES"
// its gonna an 8bit version of AGI and the loading is like her smashing up the word AGI GAMES and its gonna go bigger"):
// its plan (what's on the screen at any moment: src/games/intro-plan.js), her 8-bit frames (src/games/intro-sprite.js,
// made from her 2D art), the runner with a stand-in browser (a window, a canvas, a clock and storage of our own:
// src/games/intro-run.js), and its place on a game's page (rideemagi.html, its entry, src/games/intro.css).
// No browser, no network. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import * as I from '../src/games/intro-plan.js';
import { PALETTE, SIZE, FEET, FRAMES } from '../src/games/intro-sprite.js';
import {
  startIntro, drawScene, spriteFrames, KEY, LATE_MS, SAFETY_MS, STILL_MS, FADE_MS, MAX_STEP, MAX_DPR, DONE,
} from '../src/games/intro-run.js';
import { GAMES } from '../src/games/list.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// every .css file in a game's folder, its subfolders too (Ride 'Em, AGI!'s game.css and fonts.css; TRENCHING SIMULATOR's
// trench.css, 2026-10-20)
const cssOf = (dir) => readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((e) =>
  (e.isDirectory() ? cssOf(`${dir}/${e.name}`) : e.name.endsWith('.css') ? [`${dir}/${e.name}`] : []));
const HEX = /^#[0-9a-f]{6}$/;
const { FULL, SHORT, COLORS, BANDS, BITS, GLYPHS, WORD, LANDS, MID } = I;
const landedAt = (tl) => (tl.enter ? tl.enter.to : tl.dive.from);   // from then on she's on the screen, whole
const rectsOf = (s) => s.letters.flatMap((l) => [...l.shadow, ...l.face]);

// ---------- its plan ----------

test('its letters: AGI GAMES in bold 7 × 7 letters, their uprights two pixels wide, the G of GAMES in its middle', () => {
  assert.equal(WORD, 'AGI GAMES');
  assert.equal(I.GW, 7);
  assert.equal(I.ADV, 8);
  assert.equal(I.ROWS, 7);
  assert.equal(I.COLS, WORD.length * I.ADV - 1);
  assert.equal(I.COLS, 71);
  const singles = [];
  for (const ch of new Set(WORD)) {
    const rows = GLYPHS[ch];
    assert.ok(rows, `a glyph for "${ch}"`);
    assert.equal(rows.length, 7, ch);
    for (const [r, row] of rows.entries()) {
      assert.match(row, /^[#.]{7}$/, `${ch}, row ${r}`);
      if (ch === ' ') assert.equal(row, '.......');
      for (const m of row.matchAll(/#+/g)) if (m[0].length < 2) singles.push(`${ch}${r}:${m.index}`);
    }
  }
  // a stroke one pixel wide read as a jumble under its shadow (its first contact sheets): only the M's middle point is
  assert.deepEqual(singles, ['M3:3']);
  // where she smashes it is the word's own middle
  assert.equal(WORD[MID], 'G');
  assert.equal(MID * I.ADV + I.GW / 2, I.COLS / 2);
  // she lands on every letter, in order, and jumps over the space
  assert.deepEqual(LANDS, [...WORD].flatMap((c, i) => (c === ' ' ? [] : [i])));
  // its colours: banded light to deep honey, a pink shadow, lavender stars, the night
  assert.equal(BANDS.length, 7);
  for (const c of [...BANDS, ...BITS, ...Object.values(COLORS)]) assert.match(c, HEX);
  const lum = (h) => [1, 3, 5].reduce((s, i, k) => s + parseInt(h.slice(i, i + 2), 16) * [0.2126, 0.7152, 0.0722][k], 0);
  for (let r = 1; r < 7; r++) assert.ok(lum(BANDS[r]) <= lum(BANDS[r - 1]), `band ${r} is never lighter than the one above`);
  assert.equal(COLORS.honey, BANDS[3]);
});

test('her 8-bit frames: from her 2D art, every frame the same size, standing on her soles, outlined in ink', () => {
  assert.deepEqual(SIZE, { w: 31, h: 62 });
  assert.equal(FEET.y, SIZE.h);
  assert.deepEqual(Object.keys(FRAMES), ['stand', 'crouch', 'air', 'dive', 'back']);
  assert.equal(PALETTE.h, COLORS.ink, 'her outline is the night\'s ink');
  for (const c of Object.values(PALETTE)) assert.match(c, HEX);
  for (const [name, rows] of Object.entries(FRAMES)) {
    assert.equal(rows.length, SIZE.h, name);
    let lowest = -1;
    for (const [y, row] of rows.entries()) {
      assert.equal(row.length, SIZE.w, `${name}, row ${y}`);
      for (const ch of row) assert.ok(ch === '.' || PALETTE[ch], `${name}: "${ch}" is a colour of her palette`);
      if (/[^.]/.test(row)) lowest = y;
    }
    // her soles are its last row, their middle where FEET says (so she stands where the plan puts her)
    assert.equal(lowest, SIZE.h - 1, `${name}: her soles in the last row`);
    const xs = [...rows[lowest]].flatMap((c, x) => (c === '.' ? [] : [x]));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(Math.abs(mean + 0.5 - FEET.x) <= 1, `${name}: her soles' middle (${mean + 0.5}) at FEET.x`);
    // every pixel of her that touches the night (or the frame's edge) is ink: a clean 8-bit outline on any background
    let notInk = 0;
    for (let y = 0; y < SIZE.h; y++) for (let x = 0; x < SIZE.w; x++) {
      const c = rows[y][x];
      if (c === '.') continue;
      const edge = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
        const yy = y + dy, xx = x + dx;
        return yy < 0 || yy >= SIZE.h || xx < 0 || xx >= SIZE.w || rows[yy][xx] === '.';
      });
      if (edge && c !== 'h') notInk++;
    }
    assert.equal(notInk, 0, `${name}: outlined in ink`);
  }
  // made by its tool from the front's 2D cutout (the owner: "use the 2d art"), never the 3D model ("the 3d model is 18+")
  const src = read('src/games/intro-sprite.js');
  assert.match(src.split('\n')[0], /^\/\/ Generated by tools\/games\/agi1-8bit\.py from her 2D art/);
  assert.doesNotMatch(src, /\bfunction\b|\bimport\b|=>/, 'data only');
  const tool = read('tools/games/agi1-8bit.py');
  assert.match(tool, /'agi1-cutout\.webp'/);
  assert.doesNotMatch(tool, /\.(glb|vrm|fbx|moc3)\b/i);
  assert.ok(existsSync(new URL('../public/images/landing/agi1-cutout.webp', import.meta.url)));
});

test('her back, for the far side of her spin: her air frame turned away (hair where her face was and down her back, no "AGI")', () => {
  // each colour's name, from the generated file's own comments (hy, hl, hb, hs, hd: her hair; ey, bl, mo: her face)
  const names = Object.fromEntries([...read('src/games/intro-sprite.js').matchAll(/'(\w)': '#[0-9a-f]{6}', \/\/ (\w\w)/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(names).sort(), Object.keys(PALETTE).sort());
  const group = (c) => (c === '.' ? '.' : names[c][0]);
  const isHair = (c) => c !== '.' && ['hy', 'hl', 'hb', 'hs', 'hd'].includes(names[c]);
  const air = FRAMES.air, back = FRAMES.back, mid = Math.floor(FEET.x);
  let changed = 0, face = 0;
  for (let y = 0; y < SIZE.h; y++) for (let x = 0; x < SIZE.w; x++) {
    const a = air[y][x], b = back[y][x];
    // her outline as her air frame's (the same silhouette, so her spin's two halves line up)
    assert.equal(b === '.', a === '.', `row ${y}, column ${x}: the same silhouette`);
    assert.equal(b === 'h', a === 'h', `row ${y}, column ${x}: the same ink`);
    // no face from behind
    assert.ok(!['e', 'b', 'm'].includes(group(b)), `row ${y}, column ${x}: no eyes, blush or mouth`);
    if (['e', 'b', 'm'].includes(group(a))) face++;
    // whatever isn't as in her air frame is her hair (her arms, her shorts and her legs as they are)
    if (a !== b) {
      changed++;
      assert.ok(isHair(b), `row ${y}, column ${x}: "${b}" (was "${a}") is her hair`);
    }
  }
  assert.ok(face >= 6, 'her air frame has her face (eyes, blush, mouth)');
  // her air frame's "AGI": the white on her tee, around her middle in the top half of her
  const letters = [];
  for (let y = 0; y < SIZE.h / 2; y++) for (let x = mid - 5; x <= mid + 5; x++) if (group(air[y][x]) === 'w') letters.push([y, x]);
  assert.ok(letters.length >= 15, `her front's letters (${letters.length} pixels)`);
  for (const [y, x] of letters) assert.ok(isHair(back[y][x]), `row ${y}, column ${x}: the letters are under her hair`);
  // her hair down her back: her middle is hair from the top of her head to past where her front's letters end
  const head = air.findIndex((row) => row[mid] !== '.' && row[mid] !== 'h');
  const lettersEnd = Math.max(...letters.map(([y]) => y));
  for (let y = head; y <= lettersEnd + 3; y++) assert.ok(isHair(back[y][mid]), `row ${y}: her hair down her middle`);
  assert.ok(!isHair(air[lettersEnd][mid]) && group(air[head + 4][mid]) === 's', 'her front has her face and her tee there');
  assert.ok(changed > 60, `${changed} pixels turned to hair`);
});

test('its sizes: the word and her pixels fit any screen, from a small phone to a 4K one', () => {
  // a computer at 1440 × 900, and an iPhone's screen (390 × 844 at 3 device pixels a CSS pixel)
  assert.deepEqual(I.layout(1440, 900), { W: 1440, H: 900, p: 12, pEnd: 18, k: 3, kEnd: 5, cx: 720, cy: 540, margin: 36 });
  assert.deepEqual(I.layout(1170, 2532), { W: 1170, H: 2532, p: 11, pEnd: 14, k: 3, kEnd: 4, cx: 585, cy: 1519, margin: 101 });
  assert.ok(Math.abs(I.makePlan(1440, 900).qCap - (720 - 2) / 37.6) < 1e-9);
  for (let W = 120; W <= 3840; W += 89) for (let H = 120; H <= 2560; H += 97) {
    const L = I.layout(W, H);
    for (const v of ['p', 'pEnd', 'k', 'kEnd', 'cx', 'cy', 'margin']) assert.ok(Number.isInteger(L[v]), `${W}×${H}: ${v}`);
    assert.ok(L.p >= 2 && L.pEnd >= L.p && L.k >= 1 && L.kEnd >= L.k, `${W}×${H}`);
    // the word starts at most 70% of the screen's width, and goes bigger to at most 90% (unless 2 pixels a letter pixel is all
    // there is room for)
    if (L.p > 2) assert.ok((I.COLS + 1) * L.p <= 0.7 * W + 1e-9, `${W}×${H}: p`);
    if (L.pEnd > L.p) assert.ok((I.COLS + 1) * L.pEnd <= 0.9 * W + 1e-9, `${W}×${H}: pEnd`);
  }
  // a size that's no size at all still makes a plan
  const tiny = I.makePlan(0, -5);
  assert.equal(tiny.W, 1);
  assert.equal(tiny.H, 1);
  assert.equal(I.scene(tiny, FULL.end).done, true);
});

test('every frame, at every size, on both timelines: the letters on the screen, her whole once she\'s landed, in whole pixels', () => {
  let frames = 0;
  for (let W = 240; W <= 3840; W += 197) for (let H = 240; H <= 3000; H += 173) for (const tl of [FULL, SHORT]) {
    const P = I.makePlan(W, H, tl);
    const landed = landedAt(tl);
    for (let f = 0; f <= Math.ceil(tl.end * 30) + 2; f++) {
      const t = f / 30;
      const s = I.scene(P, t);
      frames++;
      for (const r of rectsOf(s)) {
        // a letter may drop in from above the screen; never off its sides or its bottom
        if (!(r.slice(0, 4).every(Number.isInteger) && r[2] > 0 && r[3] > 0 && r[0] >= 0 && r[0] + r[2] <= W && r[1] + r[3] <= H)) {
          assert.fail(`${W}×${H} ${tl.name} at ${t.toFixed(3)} s: a letter's rectangle ${JSON.stringify(r)}`);
        }
      }
      for (const b of s.bits) if (!(Number.isInteger(b[0]) && Number.isInteger(b[1]) && Number.isInteger(b[2]) && b[2] >= 1)) assert.fail(`${W}×${H} ${tl.name} at ${t}: a bit ${JSON.stringify(b)}`);
      for (const h of s.holes) if (!(h.every(Number.isInteger) && h[2] > 0 && h[3] > 0 && h[0] >= 0 && h[1] >= 0 && h[0] + h[2] <= W && h[1] + h[3] <= H)) assert.fail(`${W}×${H} ${tl.name} at ${t}: a hole ${JSON.stringify(h)}`);
      for (const st of s.stars) if (!(st[0] >= 0 && st[0] < W && st[1] >= 0 && st[1] < H && Number.isInteger(st[2]))) assert.fail(`${W}×${H}: a star ${JSON.stringify(st)}`);
      if (!s.shake.every(Number.isInteger)) assert.fail(`${W}×${H} ${tl.name} at ${t}: its shake ${s.shake}`);
      if (s.her) {
        if (!(Number.isInteger(s.her.x) && Number.isInteger(s.her.y) && Number.isInteger(s.her.k) && s.her.k >= 1)) assert.fail(`${W}×${H} ${tl.name} at ${t}: her ${JSON.stringify(s.her)}`);
        const b = I.herBox(s.her);
        if (t >= landed && (b.top < 0 || b.left < 0 || b.right > W || b.bottom > H)) {
          assert.fail(`${W}×${H} ${tl.name} at ${t.toFixed(3)} s: her ${s.her.frame} at ${JSON.stringify(b)}, off the screen`);
        }
      }
    }
  }
  assert.ok(frames > 30000, `${frames} frames looked at`);
});

test('she falls onto the first letter, hops across the word letter by letter (higher over the space), spins and smashes its middle', () => {
  for (const [W, H] of [[1440, 900], [1170, 2532], [320, 568]]) {
    const P = I.makePlan(W, H);
    // she falls in from above the screen
    const fall = I.herAt(P, FULL.enter.from + 0.005);
    assert.equal(fall.frame, 'dive');
    assert.ok(I.herBox(fall).bottom < 0, 'from above the screen');
    assert.equal(I.herAt(P, FULL.enter.from - 0.001), null, 'nobody there before');
    // each landing: crouched, her feet's middle on that letter's top middle
    for (const [j, tL] of FULL.lands.entries()) {
      const t = tL + 0.001;
      const h = I.herAt(P, t), a = I.letterAt(P, LANDS[j], t);
      assert.equal(h.frame, 'crouch', `${W}×${H}, landing ${j}`);
      assert.equal(h.x, a.bx);
      assert.equal(h.y, a.top);
      // the letter she lands on flashes white for a moment
      assert.ok(a.hit > 0.5);
      assert.equal(I.scene(P, t).letters.find((l) => l.i === LANDS[j]).color, COLORS.white);
    }
    // in the air between them, above both; the hop over the space higher than the others
    const rises = [];
    for (let j = 0; j + 1 < FULL.lands.length; j++) {
      const t = FULL.lands[j] + 0.625 * (FULL.lands[j + 1] - FULL.lands[j]);
      const h = I.herAt(P, t), a = I.letterAt(P, LANDS[j], t), b = I.letterAt(P, LANDS[j + 1], t);
      assert.equal(h.frame, 'air');
      rises.push(Math.min(a.top, b.top) - h.y);
    }
    assert.ok(rises.every((r) => r > 0), `${W}×${H}: above the letters`);
    const overSpace = LANDS.findIndex((l, j) => LANDS[j + 1] - l > 1);
    assert.equal(overSpace, 2);
    for (const [j, r] of rises.entries()) if (j !== overSpace) assert.ok(rises[overSpace] > r, `${W}×${H}: over the space, higher`);
    // the spin: mirrored halfway round, and turned away (her back) for the far half of it, never her front's letters
    // read backwards
    assert.equal(I.herAt(P, 1.391).frame, 'back');
    assert.ok(I.herAt(P, 1.391).flip < -0.9);
    for (const tl of [FULL, SHORT]) {
      const Q = I.makePlan(W, H, tl);
      const seen = new Set();
      for (let t = tl.spin.from; t < tl.spin.to; t += 1 / 120) {
        const h = I.herAt(Q, t);
        seen.add(h.frame);
        if (h.flip < 0) assert.equal(h.frame, 'back', `${tl.name} at ${t.toFixed(3)} s: turned away`);
        else assert.ok(h.frame === 'air' || h.frame === 'crouch', `${tl.name} at ${t.toFixed(3)} s: facing us (${h.frame})`);
      }
      assert.ok(seen.has('back') && seen.has('air'), `${tl.name}: both halves of her turn`);
    }
    assert.equal(I.herAt(P, FULL.dive.from + 0.01).frame, 'dive');
    // the smash: crouched on the G of GAMES, and the word goes white from the middle outward
    for (const tl of [FULL, SHORT]) {
      const Q = I.makePlan(W, H, tl);
      const t = tl.impact + 0.01;
      const h = I.herAt(Q, t), m = I.letterAt(Q, MID, t);
      assert.equal(h.frame, 'crouch', tl.name);
      assert.equal(h.x, m.bx);
      assert.equal(h.y, m.top);
      assert.ok(m.hit > 0.5, `${tl.name}: the middle letter flashes`);
      const far = I.letterAt(Q, 0, t);
      assert.ok(far.hit < 0.5, `${tl.name}: the end letters a moment later`);
    }
    // then she floats above it
    const after = I.herAt(P, FULL.grow.to);
    assert.equal(after.frame, 'air');
    assert.ok(after.y < I.letterAt(P, MID, FULL.grow.to).top);
  }
  // a short one: she falls in spinning, straight above the middle
  const S = I.makePlan(1440, 900, SHORT);
  assert.equal(I.herAt(S, SHORT.spin.from - 0.01), null);
  assert.equal(I.herAt(S, SHORT.spin.from + 0.01).frame, 'air');
  assert.equal(I.herAt(S, SHORT.spin.from + 0.01).x, I.letterAt(S, MID, SHORT.spin.from + 0.01).bx);
});

test('the word goes bigger with a boing (never wider than the screen), and her with it', () => {
  assert.equal(I.ease.boing(0), 0);
  assert.equal(I.ease.boing(1), 1);
  let top = 0;
  for (let i = 0; i <= 2000; i++) top = Math.max(top, I.ease.boing(i / 2000));
  assert.ok(top > 1.2 && top < 1.3, 'past 1 by about a quarter');
  for (const [W, H] of [[1440, 900], [1170, 2532], [2880, 1800], [320, 568]]) {
    const P = I.makePlan(W, H);
    assert.equal(I.qAt(P, FULL.grow.from - 0.01), P.L.p);
    assert.equal(I.qAt(P, FULL.grow.to), P.L.pEnd);
    assert.equal(I.qAt(P, FULL.end), P.L.pEnd);
    assert.equal(I.kAt(P, 0), P.L.k);
    assert.equal(I.kAt(P, FULL.grow.to), P.L.kEnd);
    let most = 0;
    for (let i = 0; i <= 500; i++) most = Math.max(most, I.qAt(P, FULL.grow.from + (FULL.grow.to - FULL.grow.from) * (i / 500)));
    assert.ok(most <= P.qCap + 1e-9, `${W}×${H}: never past its cap`);
    assert.ok(most > P.L.pEnd || P.qCap <= P.L.pEnd + 1e-9, `${W}×${H}: a boing while there's room`);
  }
  // the screen's widest point in it: the end letters stay inside (the sweep above checks every frame)
  const P = I.makePlan(1440, 900);
  assert.ok(P.qCap * 37.6 <= P.W / 2);
});

test('its wipe shows the game underneath, from the smash outward, and nothing is left at its end', () => {
  for (const [W, H] of [[1440, 900], [1170, 2532], [333, 777]]) for (const tl of [FULL, SHORT]) {
    const P = I.makePlan(W, H, tl);
    assert.equal(I.scene(P, tl.wipe.from - 0.001).holes.length, 0, 'none before it');
    assert.equal(I.scene(P, tl.end - 0.001).done, false);
    const end = I.scene(P, tl.end);
    assert.equal(end.done, true);
    // its blocks tile the screen, and at its end each one is a hole
    assert.deepEqual(end.holes, P.blocks.map((b) => [b.x, b.y, b.w, b.h]));
    assert.equal(end.holes.reduce((a, h) => a + h[2] * h[3], 0), W * H);
    for (const b of P.blocks) assert.ok(b.d >= 0 && b.d <= 1);
    // mostly by how far a block is from the smash (a little at random)
    const xs = P.blocks.map((b) => Math.hypot(b.x + b.w / 2 - P.L.cx, b.y + b.h / 2 - P.L.cy)), ys = P.blocks.map((b) => b.d);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    assert.ok(sxy / Math.sqrt(sxx * syy) > 0.6, `${W}×${H}: from the middle outward`);
  }
});

test('the same intro every time; its flash one, never a strobe; its shake small and only after the smash', () => {
  const a = I.makePlan(1440, 900), b = I.makePlan(1440, 900);
  assert.deepEqual(a, b);
  for (const t of [0, 0.3, 0.9, 1.4, 1.63, 1.9, 2.3, 2.6]) assert.deepEqual(I.scene(a, t), I.scene(b, t));
  assert.notDeepEqual(I.makePlan(1440, 900, FULL, 7).stars, a.stars, 'another seed, other stars');
  const r = I.rng(I.SEED);
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
  assert.equal(a.stars.length, 36);
  assert.equal(a.bits.length, 3 * FULL.lands.length + 7 + 3 * (LANDS.length - 1), 'a puff where she lands, 28 when she smashes it');
  assert.equal(I.makePlan(1440, 900, SHORT).bits.length, 28);
  // the flash: at most FLASH (0.55 washed the screen grey), only just after the smash, and only ever fading
  assert.ok(I.FLASH > 0 && I.FLASH <= 0.5);
  for (const tl of [FULL, SHORT]) {
    const P = I.makePlan(1170, 2532, tl);
    assert.equal(I.scene(P, tl.impact).flash, I.FLASH);
    let last = Infinity;
    for (let i = 0; i <= Math.round(tl.end * 1000); i++) {
      const t = i / 1000, s = I.scene(P, t);
      assert.ok(s.flash >= 0 && s.flash <= I.FLASH);
      if (s.flash > 0) {
        assert.ok(t >= tl.impact && t < tl.impact + 0.16, `${tl.name}: a flash at ${t}`);
        assert.ok(s.flash <= last + 1e-12, `${tl.name}: it never flashes again`);
        last = s.flash;
      }
      const inShake = t >= tl.impact && t <= tl.impact + 0.3;
      if (!inShake) assert.ok(s.shake.every((v) => v === 0), `${tl.name}: no shake at ${t}`);
      for (const v of s.shake) assert.ok(Math.abs(v) <= Math.round(0.5 * P.L.p));
    }
  }
});

test('its timelines: about 2.5 s the first time, 1.2 s after, everything in order', () => {
  for (const tl of [FULL, SHORT]) {
    assert.equal(tl.spin.to, tl.dive.from, tl.name);
    assert.equal(tl.dive.to, tl.impact);
    assert.equal(tl.impact, tl.grow.from);
    assert.ok(tl.grow.to <= tl.wipe.from);
    assert.equal(tl.wipe.to, tl.end);
    // every letter is in before she smashes the word
    assert.ok(tl.letters.stagger * (WORD.length - 1) + tl.letters.dur <= tl.dive.from);
  }
  assert.ok(FULL.end >= 2.3 && FULL.end <= 2.7, 'about 2.5 s');
  assert.ok(SHORT.end >= 1 && SHORT.end <= 1.3, 'about 1.2 s');
  assert.equal(FULL.letters.how, 'drop');
  assert.equal(SHORT.letters.how, 'pop');
  assert.equal(FULL.enter.to, FULL.lands[0]);
  assert.equal(FULL.lands.length, LANDS.length);
  assert.equal(FULL.lands.at(-1), FULL.spin.from);
  for (let j = 1; j < FULL.lands.length; j++) {
    assert.ok(FULL.lands[j] > FULL.lands[j - 1]);
    // she lands on a letter only once it's in
    assert.ok(FULL.lands[j] >= FULL.letters.stagger * LANDS[j] + FULL.letters.dur);
  }
  assert.ok(FULL.lands[3] - FULL.lands[2] > FULL.lands[2] - FULL.lands[1], 'a longer hop over the space');
  assert.equal(SHORT.enter, null);
  assert.deepEqual(SHORT.lands, []);
  // the full one's letters drop in from above the screen; the short one's pop in
  const P = I.makePlan(1440, 900);
  assert.ok(I.letterAt(P, 0, 0.01).top < 0);
  const S = I.makePlan(1440, 900, SHORT);
  assert.ok(I.letterAt(S, 0, 0.002).sx < 0.5);
  // the space is never drawn
  assert.deepEqual(I.scene(P, 1).letters.map((l) => l.i), LANDS);
  assert.equal(I.letterAt(P, 3, 1), null);
});

test('a tap or a key: the wipe at once and quicker; after its wipe has begun, nothing changes', () => {
  const P = I.makePlan(1440, 900);
  const at = 0.8;
  assert.equal(I.scene(P, at - 0.001, { skipAt: at }).holes.length, 0);
  assert.ok(I.scene(P, at + 0.05, { skipAt: at }).holes.length > 0, 'the wipe starts at once');
  assert.equal(I.scene(P, at + I.SKIP_WIPE - 0.01, { skipAt: at }).done, false);
  assert.equal(I.scene(P, at + I.SKIP_WIPE, { skipAt: at }).done, true);
  assert.ok(I.SKIP_WIPE < FULL.wipe.to - FULL.wipe.from, 'quicker than its own');
  // a skip after its own wipe began: no change
  for (const t of [2.2, 2.4, 2.52]) assert.deepEqual(I.scene(P, t, { skipAt: 2.19 }), I.scene(P, t));
});

test('"reduce motion": one still card, the word gone bigger and her floating above it', () => {
  for (const [W, H] of [[1440, 900], [1170, 2532]]) for (const tl of [FULL, SHORT]) {
    const P = I.makePlan(W, H, tl);
    const s = I.stillScene(P);
    assert.deepEqual(s.bits, []);
    assert.equal(s.flash, 0);
    assert.ok(s.shake.every((v) => v === 0));
    assert.deepEqual(s.holes, []);
    assert.equal(s.done, false);
    assert.ok(s.stars.every((st) => st[3] === 0.6), 'no twinkle');
    assert.deepEqual(s.letters.map((l) => l.i), LANDS);
    assert.ok(s.letters.every((l) => l.color === null), 'none flashing');
    const heights = new Set(s.letters.flatMap((l) => l.face.map((r) => r[3])));
    assert.deepEqual([...heights], [P.L.pEnd], 'the word at its bigger size, settled');
    assert.equal(s.her.frame, 'air');
    assert.equal(s.her.flip, 1);
    assert.equal(s.her.x, Math.round(I.letterAt(P, MID, tl.grow.to + 0.03).bx));
    assert.deepEqual(I.stillScene(P), s);
  }
});

// ---------- the runner, in a stand-in browser ----------

// a window's listeners, with the capture phase first (the intro's), then the bubble phase (the game's)
function fakeWindow() {
  const ls = [];
  return {
    ls,
    addEventListener(type, fn, capture = false) {
      if (!ls.some((l) => l.type === type && l.fn === fn && l.capture === !!capture)) ls.push({ type, fn, capture: !!capture });
    },
    removeEventListener(type, fn, capture = false) {
      const i = ls.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture);
      if (i >= 0) ls.splice(i, 1);
    },
    captured: (type) => ls.filter((l) => l.capture && (!type || l.type === type)).length,
    dispatch(type, props = {}) {
      const ev = {
        type, cancelable: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...props,
        stopped: false, defaultPrevented: false,
        stopImmediatePropagation() { this.stopped = true; },
        preventDefault() { if (this.cancelable) this.defaultPrevented = true; },
      };
      const order = [...ls.filter((l) => l.type === type && l.capture), ...ls.filter((l) => l.type === type && !l.capture)];
      for (const l of order) {
        if (ev.stopped) break;
        if (ls.includes(l)) l.fn(ev);   // one removed meanwhile isn't called (as in a browser)
      }
      return ev;
    },
  };
}
const key = (code, k = code, more = {}) => ({ code, key: k, ...more });

// a canvas whose 2D context writes down what's drawn
function fakeCanvas(noCtx = false) {
  const ops = [];
  const ctx = {
    ops, imageSmoothingEnabled: true, fillStyle: '#000000', globalAlpha: 1,
    setTransform: (...a) => ops.push(['setTransform', ...a]),
    fillRect(x, y, w, h) { ops.push(['fillRect', x, y, w, h, this.fillStyle, this.globalAlpha]); },
    clearRect: (x, y, w, h) => ops.push(['clearRect', x, y, w, h]),
    drawImage: (img, ...a) => ops.push(['drawImage', img, ...a]),
  };
  return { width: 300, height: 150, className: '', ctx, getContext: (kind) => (kind === '2d' && !noCtx ? ctx : null) };
}

function fakeRoot() {
  const classes = new Set(['gi']);
  return {
    kids: [], removed: 0,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    has: (c) => classes.has(c),
    appendChild(c) { this.kids.push(c); return c; },
    remove() { this.removed++; },
  };
}

// The whole stand-in: a clock that only moves when run() moves it, animation frames 60 times a second, timers, storage, the
// screen's size, and a game listening on the page (bubble phase) for what reaches it.
function rig({ now = 120, reduced = false, store = new Map(), blocked = false, size = { w: 390, h: 844, dpr: 3 }, noCtx = false, sizeOk = Infinity } = {}) {
  const clock = { t: now };
  const rafs = new Map(), timers = new Map();
  let ids = 0, frameAt = null, sizeCalls = 0;
  const win = fakeWindow();
  const game = [];
  for (const type of ['keydown', 'keyup', 'pointerdown', 'click']) win.addEventListener(type, (e) => game.push(`${type} ${e.code || ''}`.trim()));
  const canvases = [], emitted = [], warned = [];
  const storage = blocked
    ? { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } }
    : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const env = {
    win, storage,
    makeCanvas: () => { const c = fakeCanvas(noCtx); canvases.push(c); return c; },
    now: () => clock.t,
    raf: (fn) => { const id = ++ids; rafs.set(id, fn); return id; },
    caf: (id) => { rafs.delete(id); },
    setTimeout: (fn, ms) => { const id = ++ids; timers.set(id, { at: clock.t + ms, fn }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    reduced: () => reduced,
    size: () => { if (++sizeCalls > sizeOk) throw new Error('the window went away'); return size; },
    emit: (name) => emitted.push(name),
    warn: (...a) => warned.push(a.map(String).join(' ')),
  };
  const root = fakeRoot();
  function run(ms, { frames = true, step = 1000 / 60 } = {}) {
    const end = clock.t + ms;
    if (frameAt == null || frameAt <= clock.t) frameAt = clock.t + step;
    for (let guard = 0; guard < 1e6; guard++) {
      const due = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      const tAt = due ? due[1].at : Infinity;
      const fAt = frames && rafs.size ? frameAt : Infinity;
      if (Math.min(tAt, fAt) > end) { clock.t = end; return; }
      if (tAt <= fAt) {
        clock.t = Math.max(clock.t, tAt);
        timers.delete(due[0]);
        due[1].fn();
      } else {
        clock.t = Math.max(clock.t, fAt);
        frameAt += step;
        const fs = [...rafs.values()];
        rafs.clear();
        for (const fn of fs) fn(clock.t);
      }
    }
    throw new Error('the stand-in clock never got there');
  }
  // run in small steps until it's gone (or maxMs): how long that took, in ms
  function runUntilGone(maxMs = 10000, step = 5) {
    const t0 = clock.t;
    while (!root.removed && clock.t - t0 < maxMs) run(step);
    return clock.t - t0;
  }
  return { env, win, root, game, canvases, emitted, warned, timers, rafs, clock, store, size, run, runUntilGone, start: () => startIntro(root, env) };
}
const SPRITE = (name) => Object.keys(FRAMES).indexOf(name) + 1;   // the canvases: the intro's first, then her frames in order

test('a first visit: the full intro on a canvas the size of the screen in device pixels, drawn before its first frame, then gone', () => {
  const r = rig();
  const h = r.start();
  assert.equal(r.store.get(KEY), '1', 'this tab has seen it now');
  assert.equal(KEY, 'agi_intro');
  const [main, ...sprites] = r.canvases;
  assert.equal(main.className, 'gi-canvas');
  assert.equal(main.width, 1170);
  assert.equal(main.height, 2532);
  assert.equal(main.ctx.imageSmoothingEnabled, false, 'its pixels never smoothed');
  assert.deepEqual(r.root.kids, [main]);
  assert.ok(r.root.has('is-live'), 'its own night goes once its first frame is on the canvas');
  assert.deepEqual(main.ctx.ops.slice(0, 2), [['setTransform', 1, 0, 0, 1, 0, 0], ['fillRect', 0, 0, 1170, 2532, COLORS.ink, 1]]);
  assert.equal(r.rafs.size, 1);
  assert.deepEqual(h.state(), { t: 0, ended: false, still: false, skipAt: null, tl: 'full', W: 1170, H: 2532 });
  // her frames: one canvas each, one canvas pixel a sprite pixel
  assert.equal(sprites.length, Object.keys(FRAMES).length);
  for (const c of sprites) assert.deepEqual([c.width, c.height], [SIZE.w, SIZE.h]);
  // its keys, taps and clicks are heard first, in the capture phase
  for (const type of ['keydown', 'keyup', 'pointerdown', 'click']) assert.equal(r.win.captured(type), 1, type);
  // it plays (frame after frame), and goes when its wipe has shown the game: about 2.5 s
  r.run(1000);
  assert.ok(main.ctx.ops.length > 1000);
  assert.ok(Math.abs(h.state().t - 1) < 0.02, `its clock: ${h.state().t}`);
  assert.equal(r.root.removed, 0);
  const ms = 1000 + r.runUntilGone();
  assert.ok(ms >= FULL.end * 1000 - 10 && ms <= FULL.end * 1000 + 40, `gone after ${ms} ms`);
  assert.equal(r.root.removed, 1);
  assert.equal(r.root.has('is-fade'), false, 'no fade: the wipe already showed the game');
  assert.deepEqual(r.emitted, [DONE]);
  assert.equal(DONE, 'agi:intro-done');
  assert.equal(h.state().ended, true);
  // nothing left behind: no listeners, no frames, no timers
  assert.equal(r.win.captured(), 0);
  assert.equal(r.rafs.size, 0);
  assert.equal(r.timers.size, 0);
  r.run(10000);
  assert.equal(r.root.removed, 1);
  assert.deepEqual(r.emitted, [DONE]);
  // and everything reaches the game now
  assert.equal(r.win.dispatch('keydown', key('Space', ' ')).stopped, false);
  assert.deepEqual(r.game, ['keydown Space']);
});

test('a later load in the same tab: the short one; storage blocked (a private window): the full one, every time', () => {
  const store = new Map([[KEY, '1']]);
  const r = rig({ store });
  const h = r.start();
  assert.equal(h.state().tl, 'short');
  const ms = r.runUntilGone();
  assert.ok(ms >= SHORT.end * 1000 - 10 && ms <= SHORT.end * 1000 + 40, `gone after ${ms} ms`);
  assert.deepEqual(r.emitted, [DONE]);
  const b = rig({ blocked: true });
  assert.doesNotThrow(() => b.start());
  assert.equal(b.start === undefined, false);
  const hb = startIntro(fakeRoot(), b.env);
  assert.equal(hb.state().tl, 'full');
});

test('a key skips it (the wipe at once), and the game never sees that key: not its press, its repeats or its letting go', () => {
  const r = rig();
  const h = r.start();
  r.run(500);
  const down = r.win.dispatch('keydown', key('Space', ' '));
  assert.ok(down.stopped, 'never reaches the game');
  assert.ok(down.defaultPrevented, 'and never scrolls the page or presses a button under it');
  assert.ok(Math.abs(h.state().skipAt - 0.5) < 0.03, `skipped at ${h.state().skipAt}`);
  // a repeat while it wipes: swallowed too
  assert.ok(r.win.dispatch('keydown', key('Space', ' ', { repeat: true })).stopped);
  const ms = r.runUntilGone();
  assert.ok(Math.abs(ms - I.SKIP_WIPE * 1000) <= 30, `gone ${ms} ms later`);
  assert.equal(r.root.has('is-fade'), false);
  assert.deepEqual(r.emitted, [DONE]);
  // still held down after it's gone: its repeats are still swallowed, other keys reach the game at once
  assert.ok(r.win.dispatch('keydown', key('Space', ' ', { repeat: true })).stopped);
  assert.equal(r.win.dispatch('keydown', key('KeyA', 'a')).stopped, false);
  assert.equal(r.win.dispatch('keyup', key('KeyA', 'a')).stopped, false);
  assert.equal(r.win.captured('pointerdown'), 0, 'taps reach the game at once');
  assert.equal(r.win.captured('click'), 0);
  // let go: that keyup is swallowed too (the game never sees half a key), and then nothing is
  const up = r.win.dispatch('keyup', key('Space', ' '));
  assert.ok(up.stopped);
  assert.equal(r.win.captured(), 0);
  assert.equal(r.win.dispatch('keydown', key('Space', ' ')).stopped, false);
  assert.deepEqual(r.game, ['keydown KeyA', 'keyup KeyA', 'keydown Space']);
});

test('a key pressed and let go while it wipes leaves nothing behind; one held for ever is let go of after 5 s', () => {
  const r = rig();
  r.start();
  r.run(300);
  assert.ok(r.win.dispatch('keydown', key('Enter')).stopped);
  r.run(50);
  assert.ok(r.win.dispatch('keyup', key('Enter')).stopped, 'its keyup, swallowed');
  r.runUntilGone();
  assert.equal(r.win.captured(), 0, 'gone with it');
  assert.deepEqual(r.game, []);
  const held = rig();
  held.start();
  held.run(300);
  held.win.dispatch('keydown', key('ArrowRight'));
  held.runUntilGone();
  assert.equal(held.win.captured('keydown'), 1);
  held.run(4900);
  assert.ok(held.win.dispatch('keydown', key('ArrowRight', 'ArrowRight', { repeat: true })).stopped);
  held.run(200);
  assert.equal(held.win.captured(), 0, 'given up 5 s after it ended');
  assert.equal(held.win.dispatch('keydown', key('ArrowRight', 'ArrowRight', { repeat: true })).stopped, false);
  assert.deepEqual(held.game, ['keydown ArrowRight']);
});

test('modifier keys and shortcuts pass through; Tab and F5 skip it but keep what they do', () => {
  const r = rig();
  const h = r.start();
  r.run(200);
  for (const k of [key('ShiftLeft', 'Shift'), key('ControlLeft', 'Control'), key('AltLeft', 'Alt'), key('MetaLeft', 'Meta'),
    key('CapsLock', 'CapsLock'), key('KeyR', 'r', { ctrlKey: true }), key('KeyR', 'r', { metaKey: true }), key('Tab', 'Tab', { altKey: true })]) {
    const ev = r.win.dispatch('keydown', k);
    assert.equal(ev.stopped, false, `${k.key} (${k.code}) passes`);
    assert.equal(ev.defaultPrevented, false);
  }
  assert.equal(h.state().skipAt, null, 'none of them skipped it');
  assert.equal(r.game.length, 8);
  const tab = r.win.dispatch('keydown', key('Tab'));
  assert.ok(tab.stopped);
  assert.equal(tab.defaultPrevented, false, 'the keyboard still moves on');
  assert.ok(h.state().skipAt != null);
  const f5 = r.win.dispatch('keydown', key('F5'));
  assert.ok(f5.stopped);
  assert.equal(f5.defaultPrevented, false, 'the page still reloads');
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'NumpadEnter']) assert.ok(r.win.dispatch('keydown', key(code)).defaultPrevented, code);
});

test('a tap skips it, and the game never sees that tap or its click; after it\'s gone, taps reach the game at once', () => {
  const r = rig();
  const h = r.start();
  r.run(400);
  const pd = r.win.dispatch('pointerdown', { pointerType: 'touch' });
  assert.ok(pd.stopped);
  assert.ok(pd.defaultPrevented);
  assert.ok(h.state().skipAt != null);
  r.run(80);
  assert.ok(r.win.dispatch('click').stopped, 'its click, swallowed');
  assert.equal(r.win.dispatch('click').stopped, false, 'only that one');
  r.runUntilGone();
  assert.equal(r.win.captured(), 0);
  assert.equal(r.win.dispatch('pointerdown').stopped, false);
  assert.deepEqual(r.game, ['click', 'pointerdown']);
  // a tap just as it ends (its wipe already begun): its click, a moment after it's gone, is still swallowed
  const late = rig();
  const hl = late.start();
  late.run(2300);
  assert.ok(late.win.dispatch('pointerdown').stopped);
  assert.equal(hl.state().skipAt, null, 'too late to skip: nothing changes');
  late.runUntilGone();
  assert.equal(late.win.captured('click'), 1);
  late.run(50);
  assert.ok(late.win.dispatch('click').stopped);
  assert.equal(late.win.dispatch('pointerdown').stopped, false);
  late.run(1500);
  assert.equal(late.win.captured(), 0);
  assert.equal(late.win.dispatch('click').stopped, false);
});

test('a page that came late: no intro, its overlay just fades (and exactly LATE_MS still plays it)', () => {
  const r = rig({ now: LATE_MS + 1 });
  const h = r.start();
  assert.equal(r.canvases.length, 0);
  assert.ok(r.root.has('is-fade'));
  assert.equal(r.root.has('is-live'), false);
  assert.equal(r.win.captured(), 0);
  assert.equal(r.store.has(KEY), false, 'not seen: the full one next time');
  assert.equal(h.state().ended, true);
  r.run(FADE_MS - 1);
  assert.equal(r.root.removed, 0);
  r.run(1);
  assert.equal(r.root.removed, 1);
  assert.deepEqual(r.emitted, [DONE]);
  const on = rig({ now: LATE_MS });
  on.start();
  assert.equal(on.canvases.length, 1 + Object.keys(FRAMES).length);
  assert.ok(on.root.has('is-live'));
  assert.ok(LATE_MS / 1000 < 4, 'the overlay\'s own fade (4 s, intro.css) comes after');
});

test('"reduce motion": one still card, no animation frames, then it fades; a key ends it at once', () => {
  const r = rig({ reduced: true });
  const h = r.start();
  assert.equal(h.state().still, true);
  assert.equal(r.rafs.size, 0);
  const ops = r.canvases[0].ctx.ops;
  assert.ok(ops.some((o) => o[0] === 'drawImage' && o[1] === r.canvases[SPRITE('air')]), 'her floating');
  assert.equal(ops.filter((o) => o[0] === 'clearRect').length, 0);
  assert.ok(r.root.has('is-live'));
  const n = ops.length;
  r.run(STILL_MS - 1);
  assert.equal(ops.length, n, 'drawn once');
  assert.equal(r.root.has('is-fade'), false);
  r.run(1);
  assert.ok(r.root.has('is-fade'));
  assert.equal(r.win.captured(), 0);
  r.run(FADE_MS);
  assert.equal(r.root.removed, 1);
  assert.deepEqual(r.emitted, [DONE]);
  const k = rig({ reduced: true });
  k.start();
  k.run(100);
  assert.ok(k.win.dispatch('keydown', key('Space', ' ')).stopped);
  assert.ok(k.root.has('is-fade'), 'at once');
  k.run(FADE_MS);
  assert.equal(k.root.removed, 1);
  assert.ok(k.win.dispatch('keyup', key('Space', ' ')).stopped);
  assert.equal(k.win.captured(), 0);
  assert.deepEqual(k.game, []);
});

test('a phone turned sideways: a new canvas size and plan, and it still ends on time', () => {
  const r = rig();
  const h = r.start();
  r.run(300);
  r.size.w = 844;
  r.size.h = 390;
  r.run(40);
  assert.deepEqual([r.canvases[0].width, r.canvases[0].height], [2532, 1170]);
  assert.equal(h.state().W, 2532);
  assert.equal(h.state().tl, 'full');
  const ms = 340 + r.runUntilGone();
  assert.ok(ms <= FULL.end * 1000 + 40, `gone after ${ms} ms`);
});

test('at most 3 canvas pixels a CSS pixel, and a screen that says nothing about its pixels gets 1', () => {
  for (const [dpr, want] of [[4, MAX_DPR], [2, 2], [1, 1], [0, 1], [undefined, 1], [Number.NaN, 1]]) {
    const r = rig({ size: { w: 400, h: 300, dpr } });
    r.start();
    assert.deepEqual([r.canvases[0].width, r.canvases[0].height], [400 * want, 300 * want], String(dpr));
  }
  assert.equal(MAX_DPR, 3);
});

test('when things go wrong: a frame that throws, no 2D canvas, a tab in the background, a stalled tab', () => {
  const t = rig({ sizeOk: 1 });
  t.start();
  t.run(20);
  assert.equal(t.root.removed, 1, 'gone at once');
  assert.match(t.warned[0], /^\[intro\] stopped: Error: the window went away/);
  assert.deepEqual(t.emitted, [DONE]);
  assert.equal(t.win.captured(), 0);
  const n = rig({ noCtx: true });
  n.start();
  assert.match(n.warned[0], /^\[intro\] not shown: Error: no 2D canvas/);
  assert.ok(n.root.has('is-fade'));
  assert.equal(n.root.kids.length, 0);
  assert.equal(n.win.captured(), 0);
  n.run(FADE_MS);
  assert.equal(n.root.removed, 1);
  // a tab in the background (no animation frames): gone by SAFETY_MS whatever happens
  const bg = rig();
  bg.start();
  bg.run(SAFETY_MS - 1, { frames: false });
  assert.equal(bg.root.removed, 0);
  bg.run(1, { frames: false });
  assert.equal(bg.root.removed, 1);
  assert.equal(bg.rafs.size, 0);
  assert.deepEqual(bg.emitted, [DONE]);
  assert.ok(SAFETY_MS > FULL.end * 1000 + 1000);
  // a stalled tab: one slow frame moves it on at most MAX_STEP (never jumps ahead to its end)
  const st = rig();
  const h = st.start();
  st.run(17);
  const before = h.state().t;
  st.run(2000, { frames: false });
  st.run(17);
  assert.ok(h.state().t - before <= MAX_STEP + 1e-9, `${h.state().t - before}`);
  assert.equal(st.root.removed, 0);
  // stop(): gone at once
  h.stop();
  assert.equal(st.root.removed, 1);
  h.stop();
  assert.equal(st.root.removed, 1, 'once');
});

test('drawScene: the night and its stars, then (shaken) the shadows, the faces, the bits and her, then the flash, then the holes', () => {
  const P = I.makePlan(1440, 900);
  const sprites = Object.fromEntries(Object.keys(FRAMES).map((k) => [k, { sprite: k }]));
  const draw = (S) => { const c = fakeCanvas(); drawScene(c.ctx, P, S, sprites); return c.ctx.ops; };
  // just after the smash: shake, bits, the flash, her crouched
  const S = I.scene(P, FULL.impact + 0.02);
  assert.ok(S.bits.length > 0 && S.flash > 0 && S.her.frame === 'crouch' && S.holes.length === 0);
  const ops = draw(S);
  let i = 0;
  assert.deepEqual(ops[i++], ['setTransform', 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(ops[i++], ['fillRect', 0, 0, P.W, P.H, COLORS.ink, 1]);
  for (const st of S.stars) assert.deepEqual(ops[i++], ['fillRect', st[0], st[1], st[2], st[2], COLORS.star, st[3]]);
  assert.deepEqual(ops[i++], ['setTransform', 1, 0, 0, 1, S.shake[0], S.shake[1]]);
  for (const l of S.letters) for (const r of l.shadow) assert.deepEqual(ops[i++], ['fillRect', r[0], r[1], r[2], r[3], COLORS.pink, 1], 'shadows first');
  for (const l of S.letters) for (const r of l.face) assert.deepEqual(ops[i++], ['fillRect', r[0], r[1], r[2], r[3], l.color || BANDS[r[4]], 1], 'then the faces, banded row by row');
  for (const b of S.bits) assert.deepEqual(ops[i++], ['fillRect', b[0], b[1], b[2], b[2], b[3], b[4]]);
  const box = I.herBox(S.her);
  assert.deepEqual(ops[i++], ['drawImage', sprites.crouch, box.left, box.top, box.right - box.left, box.bottom - box.top]);
  assert.deepEqual(ops[i++], ['setTransform', 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(ops[i++], ['fillRect', 0, 0, P.W, P.H, COLORS.white, S.flash], 'the flash over everything');
  assert.equal(ops.length, i);
  // some faces are white for a moment (the smash's wave), the rest banded light to deep honey
  assert.ok(ops.some((o) => o[0] === 'fillRect' && o[5] === COLORS.white && o[6] === 1));
  // mid-spin she's mirrored (x → her box's right edge − x), and it's her back
  const spin = I.scene(P, 1.391);
  assert.ok(spin.her.flip < 0);
  const sb = I.herBox(spin.her), sw = sb.right - sb.left;
  const so = draw(spin);
  const at = so.findIndex((o) => o[0] === 'drawImage');
  assert.deepEqual(so[at - 1], ['setTransform', -1, 0, 0, 1, sb.left + sw, 0]);
  assert.deepEqual(so[at], ['drawImage', sprites.back, 0, sb.top, sw, sb.bottom - sb.top]);
  // while it wipes, the holes are cleared last (the game shows through them)
  const W = I.scene(P, 2.3);
  const wo = draw(W);
  const first = wo.findIndex((o) => o[0] === 'clearRect');
  assert.ok(first > 0);
  assert.deepEqual(wo.slice(first), W.holes.map((h) => ['clearRect', ...h]));
  // before she's there: no her
  assert.equal(draw(I.scene(P, 0.1)).some((o) => o[0] === 'drawImage'), false);
});

test('her frames as small canvases: one canvas pixel a sprite pixel, each row\'s runs of a colour in one rectangle', () => {
  const made = [];
  const frames = spriteFrames(() => { const c = fakeCanvas(); made.push(c); return c; });
  assert.deepEqual(Object.keys(frames), Object.keys(FRAMES));
  for (const [name, c] of Object.entries(frames)) {
    assert.deepEqual([c.width, c.height], [SIZE.w, SIZE.h]);
    const lit = FRAMES[name].join('').replace(/\./g, '').length;
    let area = 0, prev = null;
    for (const [op, x, y, w, h, fill] of c.ctx.ops) {
      assert.equal(op, 'fillRect');
      assert.equal(h, 1);
      assert.ok(Object.values(PALETTE).includes(fill));
      assert.equal(FRAMES[name][y].slice(x, x + w), PALETTE_KEY(fill).repeat(w), `${name}: row ${y}`);
      if (prev && prev.y === y) assert.ok(prev.x + prev.w < x || prev.fill !== fill, 'runs merged');
      area += w;
      prev = { x, y, w, fill };
    }
    assert.equal(area, lit, `${name}: every lit pixel, once`);
  }
});
const PALETTE_KEY = (hex) => Object.keys(PALETTE).find((k) => PALETTE[k] === hex);

// ---- its place on a game's page, its code and its styles (read as text) ----

// a file's code without its comments (its words may name the browser; its code may not)
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const importsOf = (src) => [...src.matchAll(/^import\s+(?:[^'";]*?\s+from\s+)?'([^']+)';/gm)].map((m) => m[1]);
// a style sheet's rules, each with the at-rules around it (enough for ours: no strings with braces in it)
function cssRules(css) {
  const out = [], stack = [];
  let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') {
      const head = stack.pop();
      if (!head.startsWith('@')) {
        const decl = Object.fromEntries(buf.split(';').map((d) => d.trim()).filter(Boolean)
          .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
        out.push({ at: stack.slice(), sel: head, decl });
      }
      buf = '';
    } else buf += ch;
  }
  assert.equal(stack.length, 0, 'its braces match');
  return out;
}

test('every game\'s page: its overlay right after <body>, once, before the game; its entry starts the intro first', () => {
  const tag = '<div class="gi" id="agi-intro" aria-hidden="true"></div>';
  // (VLAD RUNNER 2049 too, since 2026-10-23: the intro, then its own illustrated title screen)
  const ids = Object.keys(GAMES);
  assert.ok(ids.includes('vladrunner2049'));
  for (const id of ids) {
    const html = read(`${id}.html`);
    assert.equal(html.split('id="agi-intro"').length - 1, 1, `${id}: one overlay`);
    assert.equal(html.split(tag).length - 1, 1, `${id}: the overlay exactly as intro.css and intro.js expect it`);
    const body = html.indexOf('<body>'), at = html.indexOf(tag), main = html.search(/<main[\s>]/);
    assert.ok(body > 0 && at > body && main > at, `${id}: after <body>, before <main>`);
    assert.match(html.slice(body + '<body>'.length, at), /^(?:\s|<!--[\s\S]*?-->)*$/, `${id}: nothing but comments before it`);
    const start = html.indexOf('<!-- game:start');
    if (start >= 0) assert.ok(start > at, `${id}: outside the markup its import tool writes, so a new version keeps it`);
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${id}: no style attribute (the CSP)`);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${id}: no inline script`);
    // its entry: the intro first, so its styles come before the game's, and its key and tap listeners before the game's
    const entry = html.match(/<script type="module" src="\/(src\/games\/[a-z0-9]+\/page\.js)"><\/script>/);
    assert.ok(entry, `${id}: its entry`);
    const imports = importsOf(read(entry[1]));
    assert.equal(imports[0], '../intro.js', `${id}: the intro first`);
    assert.equal(imports.filter((p) => /intro/.test(p)).length, 1, `${id}: once`);
  }
  // Ride 'Em, AGI!'s, exactly: the intro, the game's fonts' rules, its styles, its code
  assert.deepEqual(importsOf(read('src/games/rideemagi/page.js')), ['../intro.js', './fonts.css', './game.css', './game.js']);
  // TRENCHING SIMULATOR's (2026-10-20): the intro, its styles, its screens
  assert.deepEqual(importsOf(read('src/games/trenchingsimulator/page.js')), ['../intro.js', './trench.css', './menu.css', './boards/pomp.css', './shell.js']);
  // VLAD RUNNER 2049's (2026-10-23): the intro, then its styles before anything of the game
  assert.deepEqual(importsOf(read('src/games/vladrunner2049/page.js')).slice(0, 2), ['../intro.js', './style.css']);
  // AGI games' own page lists the games: it isn't one
  assert.doesNotMatch(read('games.html'), /agi-intro|class="gi"/);
});

test('intro.js: its styles, then the runner on the page\'s own overlay, and nothing else', () => {
  const lines = codeOf(read('src/games/intro.js')).split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(lines, [
    "import './intro.css';",
    "import { startIntro, browserEnv } from './intro-run.js';",
    "const root = document.getElementById('agi-intro');",
    'if (root) startIntro(root, browserEnv());',
  ]);
});

test('its code: the plan is pure, the runner reaches the browser only through browserEnv(), nothing from elsewhere', () => {
  const src = {
    plan: read('src/games/intro-plan.js'), run: read('src/games/intro-run.js'), sprite: read('src/games/intro-sprite.js'),
  };
  assert.deepEqual(importsOf(src.plan), ['./intro-sprite.js']);
  assert.deepEqual(importsOf(src.run), ['./intro-sprite.js', './intro-plan.js']);
  assert.deepEqual(importsOf(src.sprite), []);
  for (const [k, s] of Object.entries(src)) {
    const c = codeOf(s);
    assert.doesNotMatch(c, /\bimport\s*\(/, `${k}: no import on the way`);
    assert.doesNotMatch(c, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.style\b|setAttribute\(\s*['"]style/,
      `${k}: no HTML from strings, no style attribute`);
    assert.doesNotMatch(c, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\//, `${k}: asks nothing of anyone`);
    assert.doesNotMatch(c, /\beval\s*\(|new\s+Function\b/, `${k}: no eval`);
    assert.doesNotMatch(c, /localStorage|indexedDB|document\.cookie/, `${k}: keeps nothing but its one key in this tab`);
  }
  const BROWSER = /\b(?:window|document|navigator|performance|sessionStorage|requestAnimationFrame|cancelAnimationFrame|matchMedia|console|CustomEvent|devicePixelRatio)\b|Math\.random|Date\.now|new Date\b/;
  // the plan: no page, no clock, no chance (the same numbers on every computer: its stars from its own seed)
  assert.doesNotMatch(codeOf(src.plan), BROWSER);
  assert.doesNotMatch(codeOf(src.plan), /(?<![.\w])(?:setTimeout|setInterval)\s*\(/);
  // the runner: the browser only in browserEnv(), the last thing in it
  const run = codeOf(src.run);
  const at = run.indexOf('export function browserEnv');
  assert.ok(at > 0);
  const before = run.slice(0, at), env = run.slice(at);
  assert.doesNotMatch(before, BROWSER, 'nothing of the browser before browserEnv()');
  assert.doesNotMatch(before, /(?<![.\w])(?:setTimeout|clearTimeout|setInterval)\s*\(/, 'its timers are env\'s');
  assert.equal((env.match(/^export /gm) || []).length, 1, 'browserEnv() is the last thing in it');
  assert.match(env, /window\.sessionStorage/, 'its one key in this tab\'s sessionStorage');
  assert.match(env, /\(prefers-reduced-motion: reduce\)/);
  assert.equal(KEY, 'agi_intro');
});

test('its styles: every rule a gi- class, over the game from the first paint, gone by itself if its script never comes', () => {
  const css = read('src/games/intro.css');
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /!important|url\(|@import|expression\(/i);
  // its colors: the plan's own
  const hexes = [...new Set(code.match(/#[0-9a-fA-F]{3,8}\b/g))];
  assert.ok(hexes.length >= 3);
  for (const h of hexes) assert.ok(Object.values(COLORS).includes(h.toLowerCase()), `${h}: one of the plan's colors`);
  const rules = cssRules(css);
  const frames = rules.filter((r) => r.at[0]?.startsWith('@keyframes'));
  const plain = rules.filter((r) => !r.at.length);
  const media = rules.filter((r) => r.at.length && !r.at[0].startsWith('@keyframes'));
  // its at-rules: its two keyframes, named gi-, and "reduce motion"
  assert.deepEqual([...new Set(frames.map((r) => r.at[0]))].sort(), ['@keyframes gi-bail', '@keyframes gi-blink']);
  assert.deepEqual([...new Set(media.map((r) => r.at.join(' ')))], ['@media (prefers-reduced-motion: reduce)']);
  // every selector names .gi or a .gi- class first: nothing of the game is touched
  for (const r of [...plain, ...media]) {
    for (const s of r.sel.split(',').map((x) => x.trim())) assert.match(s, /^\.gi(?:-[a-z]+)*(?![\w-])/, s);
  }
  const rule = (sel) => {
    const found = plain.filter((r) => r.sel.split(',').map((x) => x.trim()).includes(sel));
    assert.equal(found.length, 1, `one rule for ${sel}`);
    return found[0].decl;
  };
  // the overlay: over the whole screen and everything of the game, the intro's night, from the first paint
  const gi = rule('.gi');
  assert.equal(gi.position, 'fixed');
  assert.equal(gi.inset, '0');
  assert.equal(gi.background, COLORS.ink);
  assert.equal(gi['touch-action'], 'none');
  const z = Number(gi['z-index']);
  for (const id of Object.keys(GAMES)) {
    const files = cssOf(`src/games/${id}`);
    assert.ok(files.length >= 1, `${id}: its styles`);
    for (const f of files) {
      for (const m of read(f).matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(z > Number(m[1]), `over ${f}'s z-index ${m[1]}`);
    }
  }
  // its own way out: if its script never comes, it fades by itself after 4 s, later than any script that comes in time
  const bail = gi.animation.match(/^gi-bail ([\d.]+)s ease ([\d.]+)s forwards$/);
  assert.ok(bail, gi.animation);
  assert.equal(Math.round(Number(bail[1]) * 1000), FADE_MS, 'the same fade as the script\'s');
  assert.ok(Number(bail[2]) * 1000 > LATE_MS, 'a script that comes in time takes over first');
  assert.ok(Number(bail[2]) * 1000 < SAFETY_MS, 'and it never stays longer than the script would');
  const gone = frames.filter((r) => r.at[0] === '@keyframes gi-bail');
  assert.deepEqual(gone.map((r) => [r.sel, r.decl]), [['to', { opacity: '0', visibility: 'hidden' }]], 'hidden too: no taps on it');
  // its script took over: no fade by itself, no night (the canvas draws it)
  assert.deepEqual(rule('.gi.is-live'), { background: 'transparent', animation: 'none' });
  // its end: the script's fade, as long as FADE_MS
  const fade = rule('.gi.is-fade');
  assert.equal(fade.opacity, '0');
  const t = fade.transition.match(/^opacity ([\d.]+)s/);
  assert.ok(t, fade.transition);
  assert.equal(Math.round(Number(t[1]) * 1000), FADE_MS);
  // its three blinking squares until then, never with "reduce motion", gone once it's live or fading
  assert.match(rule('.gi::after').animation, /^gi-blink /);
  assert.equal(rule('.gi.is-live::after').content, 'none');
  assert.equal(rule('.gi.is-fade::after').content, 'none');
  assert.deepEqual(media.map((r) => [r.sel, r.decl]), [['.gi::after', { animation: 'none' }]]);
  // the canvas: the whole overlay, its pixels never smoothed
  const canvas = rule('.gi-canvas');
  assert.equal(canvas['image-rendering'], 'pixelated');
  assert.equal(canvas.position, 'absolute');
  assert.equal(canvas.inset, '0');
  assert.deepEqual([canvas.width, canvas.height], ['100%', '100%']);
});

test('npm test runs this file', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\/intro\.test\.js/);
});
