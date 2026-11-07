// SCAM SLAYER (2026-11-08): the swipe-to-slice game's rules, run in Node: the blade's geometry (a fast swipe that jumps
// over a sticker between two frames still cuts it), combos, shields, hearts and rugs in each mode, Blitz's clock, the
// volleys (the same seed throws the same ones, every peak on the screen, a rug never thrown where a scam is), points,
// the demo's player (it never cuts a heart or a rug, and plays the same game twice), AGI-1's words, and the page's code.
// No browser, no network. Run: node --test tests/scamslayer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { rng } from '../src/games/kit/fx.js';
import { segCircle, segDist, throwTo, peakOf, closestApproach } from '../src/games/scamslayer/geom.js';
import { KINDS, SCAMS, POWERS, ALL_KINDS, HIT, hitRadius, isScam, UNIT } from '../src/games/scamslayer/kinds.js';
import { planVolley, frenzyLaunch, isFair, difficulty, peakBand, CLEAR, baseGravity } from '../src/games/scamslayer/waves.js';
import {
  createWorld, stepWorld, bladeDown, bladeMove, bladeUp, place, RULES, comboBonus, slicePoints, summary, resizeWorld,
} from '../src/games/scamslayer/engine.js';
import { createBot } from '../src/games/scamslayer/demo.js';
import { LINES, makeVoice, endKey, shareText } from '../src/games/scamslayer/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DT = 1 / 120;
// a quiet world: nothing is thrown unless a test places it
const quiet = (mode = 'classic', more = {}) => createWorld({ mode, seed: 5, W: 600, H: 1000, top: 60, firstAt: 1e9, timers: { golden: 1e9, power: 1e9, rush: 1e9 }, ...more });
const drain = (w) => { const e = w.events.slice(); w.events.length = 0; return e; };
const types = (evs) => evs.map((e) => e.type);
// a quick swipe from A to B in a few samples (1,200 units/s and up)
function swipe(w, id, ax, ay, bx, by, { ms = 0, steps = 6, dur = 60 } = {}) {
  bladeDown(w, id, ax, ay, ms);
  for (let i = 1; i <= steps; i++) bladeMove(w, id, ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps, ms + (dur * i) / steps);
  bladeUp(w, id);
}

// ---------- the blade's geometry ----------

test('segCircle: through the middle, past the edge, a miss, and its signed distance', () => {
  const h = segCircle(0, 0, 100, 0, 50, 0, 10);
  assert.ok(h);
  assert.ok(Math.abs(h.t - 0.5) < 1e-9);
  assert.ok(Math.abs(h.d) < 1e-9);
  assert.equal(segCircle(0, 0, 100, 0, 50, 11, 10), null, 'just past the edge: a miss');
  assert.ok(segCircle(0, 0, 100, 0, 50, 9.9, 10), 'just inside the edge: a hit');
  // the centre's side of the line: positive on the left of the direction of travel (y grows downward)
  assert.ok(segCircle(0, 0, 100, 0, 50, 5, 10).d > 0);
  assert.ok(segCircle(0, 0, 100, 0, 50, -5, 10).d < 0);
  assert.ok(segCircle(100, 0, 0, 0, 50, 5, 10).d < 0, 'the other way round, the other side');
  // the segment ends before the circle: no hit, even though its line passes through
  assert.equal(segCircle(0, 0, 30, 0, 50, 0, 10), null);
  // a zero-length segment is a point
  assert.ok(segCircle(50, 0, 50, 0, 52, 0, 10));
  assert.equal(segCircle(50, 0, 50, 0, 70, 0, 10), null);
});

test('a fast swipe that jumps over a sticker between two frames still cuts it', () => {
  // two samples, both far outside the circle, on either side: the segment between them crosses it
  assert.ok(segCircle(-400, 300, 900, 260, 250, 280, 54));
  const w = quiet();
  const o = place(w, 'airdrop', 300, 500);
  bladeDown(w, 'p', 0, 500, 0);
  const cut = bladeMove(w, 'p', 600, 500, 16);        // 600 units in one 16 ms frame
  assert.equal(cut, 1);
  assert.ok(o.dead);
  assert.deepEqual(types(drain(w)).filter((t) => t !== 'launch'), ['slice']);
});

test('segDist, throwTo and peakOf agree with each other', () => {
  assert.equal(segDist(0, 0, 10, 0, 5, 3), 3);
  assert.equal(segDist(0, 0, 10, 0, 13, 4), 5);
  const t = throwTo(100, 1000, 300, 200, 900);
  const p = peakOf({ x0: 100, y0: 1000, vx: t.vx, vy: t.vy, g: 900 });
  assert.ok(Math.abs(p.x - 300) < 1e-6 && Math.abs(p.y - 200) < 1e-6 && Math.abs(p.t - t.tPeak) < 1e-9);
});

// ---------- slicing ----------

test('a slow drag or a tap never cuts; a swipe does', () => {
  const w = quiet();
  const o = place(w, 'seed', 300, 500);
  bladeDown(w, 't', 300, 500, 0);                     // a tap right on it
  bladeUp(w, 't');
  assert.ok(!o.dead, 'a tap');
  bladeDown(w, 's', 200, 500, 0);
  for (let i = 1; i <= 40; i++) bladeMove(w, 's', 200 + i * 5, 500, i * 20);   // 250 units/s
  bladeUp(w, 's');
  assert.ok(!o.dead, 'a slow drag');
  assert.ok(RULES.minSpeed > 250);
  swipe(w, 'f', 150, 520, 450, 480);
  assert.ok(o.dead, 'a swipe');
});

test('generous for scams, strict for hearts and rugs', () => {
  assert.ok(HIT.scam > 1 && HIT.power > 1);
  assert.ok(HIT.heart < 1 && HIT.rug < 1);
  const w = quiet();
  const scam = place(w, 'hook', 300, 300), heart = place(w, 'heart', 300, 600);
  // a swipe that passes just outside each one's drawn edge
  swipe(w, 'a', 100, 300 - KINDS.hook.r - 4, 500, 300 - KINDS.hook.r - 4);
  swipe(w, 'b', 100, 600 - KINDS.heart.r * 0.85, 500, 600 - KINDS.heart.r * 0.85);
  assert.ok(scam.dead, 'grazing a scam cuts it');
  assert.ok(!heart.dead, 'grazing a heart doesn\'t');
  assert.equal(w.lives, RULES.lives);
});

test('combos: three or more scams in one swipe; the bonus is 5·n²', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(comboBonus), [0, 0, 45, 80, 125, 180]);
  const w = quiet();
  for (let i = 0; i < 4; i++) place(w, SCAMS[i], 100 + i * 130, 400);
  swipe(w, 'p', 20, 425, 580, 425);                      // off-centre (never a critical slice)
  const evs = drain(w);
  const combo = evs.find((e) => e.type === 'combo');
  assert.ok(combo);
  assert.equal(combo.n, 4);
  assert.equal(combo.bonus, 80);
  assert.equal(w.score, 4 * 10 + 80);
  assert.equal(w.stats.bestCombo, 4);
  // the slices count up within the swipe (for the rising sound)
  assert.deepEqual(evs.filter((e) => e.type === 'slice').map((e) => e.n), [1, 2, 3, 4]);
});

test('combos: two swipes are two swipes; a pause longer than the window ends one', () => {
  const w = quiet();
  place(w, 'airdrop', 100, 300); place(w, 'seed', 300, 300);
  place(w, 'hat', 100, 600); place(w, 'badge', 300, 600);
  swipe(w, 'a', 20, 325, 380, 325);
  swipe(w, 'a', 20, 625, 380, 625);
  assert.equal(drain(w).filter((e) => e.type === 'combo').length, 0, 'two and two: no combo');
  assert.equal(w.stats.bestCombo, 2);
  // one long press: two scams, a pause, two more → still no combo of four
  const v = quiet();
  place(v, 'airdrop', 100, 300); place(v, 'seed', 300, 300);
  place(v, 'hat', 100, 600); place(v, 'badge', 300, 600);
  bladeDown(v, 'm', 20, 325, 0);
  bladeMove(v, 'm', 380, 325, 50);
  for (let i = 0; i < 48; i++) stepWorld(v, DT);         // 0.4 s: longer than the combo window
  bladeMove(v, 'm', 20, 625, 100);
  bladeMove(v, 'm', 380, 625, 150);
  bladeUp(v, 'm');
  assert.equal(drain(v).filter((e) => e.type === 'combo').length, 0);
  assert.equal(v.score, 40);
});

test('points: 10 a scam, the golden one ×5, a critical slice ×2, Double ×2', () => {
  assert.equal(slicePoints('airdrop'), 10);
  assert.equal(slicePoints('golden'), 50);
  assert.equal(slicePoints('golden', { crit: true, double: true }), 200);
  assert.equal(slicePoints('freeze'), 10, 'power scams are scams');
  assert.equal(slicePoints('heart'), 0);
  assert.equal(slicePoints('rug'), 0);
  const w = quiet();
  w.power.double = 5;
  place(w, 'golden', 300, 400);
  swipe(w, 'p', 100, 425, 500, 425);                     // off-centre: never critical
  assert.equal(w.score, 100);
  assert.equal(w.stats.golden, 1);
  // Double doubles the combo bonus too
  const v = quiet();
  v.power.double = 5;
  for (let i = 0; i < 3; i++) place(v, SCAMS[i], 120 + i * 150, 400);
  swipe(v, 'p', 20, 425, 580, 425);
  assert.equal(v.score, 3 * 20 + 45 * 2);
});

test('a critical slice: fast and through the middle, sometimes', () => {
  let crits = 0;
  for (let s = 1; s <= 40; s++) {
    const w = quiet('classic', { seed: s });
    place(w, 'support', 300, 400);
    bladeDown(w, 'p', 0, 400, 0);
    bladeMove(w, 'p', 600, 400, 100);                  // 6,000 units/s, dead centre
    const e = drain(w).find((x) => x.type === 'slice');
    if (e.crit) { crits++; assert.equal(e.pts, 20); }
  }
  assert.ok(crits > 5 && crits < 35, `${crits} of 40`);
});

test('the cut runs along the blade, near the middle (fair halves)', () => {
  const w = quiet();
  place(w, 'badge', 300, 400);
  swipe(w, 'p', 100, 400 + 40, 500, 400 + 40);           // well below the centre
  const e = drain(w).find((x) => x.type === 'slice');
  assert.ok(Math.abs(e.ang) < 1e-9, 'along the blade');
  assert.ok(Math.abs(e.off) <= 0.32 * KINDS.badge.r + 1e-9, 'the offset is capped');
});

// ---------- shields, hearts, rugs, per mode ----------

test('Classic: a heart costs a shield, a missed scam costs a shield, three and it\'s over', () => {
  const w = quiet();
  place(w, 'heart', 300, 400);
  swipe(w, 'p', 100, 400, 500, 400);
  assert.equal(w.lives, 2);
  assert.ok(drain(w).some((e) => e.type === 'heart'));
  // a scam falls back down unsliced
  place(w, 'hat', 300, w.H - 10, { vy: 600, g: 100 });
  for (let i = 0; i < 60; i++) stepWorld(w, DT);
  assert.equal(w.lives, 1);
  assert.ok(drain(w).some((e) => e.type === 'miss'));
  // the golden scam, power scams and Frenzy's extras cost nothing when they get away
  place(w, 'golden', 200, w.H - 10, { vy: 600 });
  place(w, 'freeze', 300, w.H - 10, { vy: 600 });
  place(w, 'seed', 400, w.H - 10, { vy: 600, bonus: true });
  for (let i = 0; i < 60; i++) stepWorld(w, DT);
  assert.equal(w.lives, 1);
  assert.equal(w.stats.missed, 1);
  place(w, 'heart', 300, 400);
  swipe(w, 'p', 100, 400, 500, 400);
  assert.equal(w.lives, 0);
  assert.ok(w.over);
  assert.equal(w.reason, 'heart');
});

test('Classic: cutting a rug ends the run at once; nothing after it in the same swipe counts', () => {
  const w = quiet();
  place(w, 'rug', 200, 400);
  const after = place(w, 'airdrop', 420, 400);
  swipe(w, 'p', 40, 400, 580, 400);
  assert.ok(w.over);
  assert.equal(w.reason, 'rug');
  assert.ok(!after.dead, 'the scam behind the rug was never reached');
  assert.equal(w.score, 0);
  const evs = types(drain(w));
  assert.ok(evs.indexOf('rug') < evs.indexOf('over'));
  // a run that's over takes no more slices
  const s = place(w, 'seed', 300, 600);
  swipe(w, 'q', 100, 600, 500, 600);
  assert.ok(!s.dead);
});

test('hearts saved: a heart that falls back down unsliced', () => {
  const w = quiet();
  place(w, 'heart', 300, w.H - 5, { vy: 500 });
  for (let i = 0; i < 40; i++) stepWorld(w, DT);
  assert.equal(w.stats.heartsSaved, 1);
  assert.equal(w.lives, RULES.lives);
});

test('Blitz: no shields; a heart costs 5 s, a rug 10 s; the clock ends it at 60 s', () => {
  const w = quiet('blitz');
  assert.equal(w.timeLeft, 60);
  assert.equal(w.lives, Infinity);
  place(w, 'heart', 300, 300);
  swipe(w, 'a', 100, 300, 500, 300);
  assert.equal(w.timeLeft, 55);
  place(w, 'rug', 300, 500);
  swipe(w, 'b', 100, 500, 500, 500);
  assert.equal(w.timeLeft, 45);
  assert.ok(!w.over);
  place(w, 'airdrop', 300, w.H - 5, { vy: 500 });
  for (let i = 0; i < 40; i++) stepWorld(w, DT);
  assert.ok(!w.over, 'a missed scam costs nothing in Blitz');
  // (the cuts' hit-stops held the clock for a moment, as they hold everything)
  assert.ok(w.timeLeft > 44.5 && w.timeLeft < 45, `${w.timeLeft}`);
  const left = w.timeLeft;
  let steps = 0;
  while (!w.over && steps < 120 * 70) { stepWorld(w, DT); steps++; }
  assert.equal(w.reason, 'time');
  assert.ok(Math.abs(steps * DT - left) < 0.02, `${(steps * DT).toFixed(2)} s`);
  // a rug that takes the last seconds ends it
  const v = quiet('blitz');
  v.timeLeft = 4;
  place(v, 'rug', 300, 500);
  swipe(v, 'b', 100, 500, 500, 500);
  assert.ok(v.over);
  assert.equal(v.reason, 'time');
});

test('Blitz\'s clock slows down with everything else while frozen', () => {
  const w = quiet('blitz');
  place(w, 'freeze', 300, 400);
  swipe(w, 'p', 100, 400, 500, 400);
  assert.equal(w.power.freeze, RULES.freeze);
  for (let i = 0; i < 120; i++) stepWorld(w, DT);        // one real second
  assert.ok(w.timeLeft > 59.2 && w.timeLeft < 59.75, `${w.timeLeft}`);
  assert.ok(Math.abs(w.ts - RULES.freezeScale) < 0.01);
  for (let i = 0; i < 120 * 4; i++) stepWorld(w, DT);
  assert.equal(w.power.freeze, 0);
  assert.ok(w.ts > 0.99, 'back to full speed');
});

test('Attract (the title screen\'s): nothing is ever lost', () => {
  const w = quiet('attract');
  place(w, 'rug', 300, 300); place(w, 'heart', 300, 600);
  swipe(w, 'a', 100, 300, 500, 300);
  swipe(w, 'b', 100, 600, 500, 600);
  place(w, 'seed', 300, w.H - 5, { vy: 500 });
  for (let i = 0; i < 40; i++) stepWorld(w, DT);
  assert.ok(!w.over);
});

test('power scams: Freeze, Frenzy and Double, each for its own time', () => {
  for (const p of POWERS) {
    const w = quiet();
    place(w, p, 300, 400);
    swipe(w, 'p', 100, 400, 500, 400);
    assert.equal(w.power[p], RULES[p]);
    assert.ok(drain(w).some((e) => e.type === 'power' && e.power === p));
    let s = 0;
    while (w.power[p] > 0 && s < 2000) { stepWorld(w, DT); s++; }
    assert.ok(Math.abs(s * DT - RULES[p]) < 0.02, `${p}: ${s * DT}`);
    assert.ok(drain(w).some((e) => e.type === 'power-end' && e.power === p));
  }
  // Frenzy throws scams in from the sides (and only scams)
  const w = createWorld({ mode: 'classic', seed: 9, W: 900, H: 600, top: 50 });
  place(w, 'frenzy', 450, 300);
  swipe(w, 'p', 300, 300, 600, 300);
  drain(w);
  for (let i = 0; i < 120 * RULES.frenzy; i++) stepWorld(w, DT);
  const launched = drain(w).filter((e) => e.type === 'launch').map((e) => e.o);
  assert.ok(launched.length >= 20, `${launched.length}`);
  assert.ok(launched.every((o) => SCAMS.includes(o.kind) && o.bonus));
});

test('Frenzy\'s throws peak on the screen', () => {
  const r = rng(3);
  for (const [W, H, top] of [[600, 1300, 90], [1300, 600, 90], [600, 600, 10]]) {
    for (let i = 0; i < 300; i++) {
      const l = frenzyLaunch(r, { W, H, top, t: i, mode: 'classic' });
      const p = peakOf(l);
      const R = KINDS[l.kind].r;
      assert.ok(p.t > 0, 'it rises first');
      assert.ok(p.x >= R && p.x <= W - R, `x ${p.x}`);
      assert.ok(p.y >= top + R && p.y <= H - R, `y ${p.y}`);
    }
  }
});

// ---------- the volleys ----------

const SIZES = [[600, 600, 10], [600, 1298, 92], [1298, 600, 92], [960, 600, 70], [600, 857, 70], [600, 900, 120]];
const due = (i) => ({ golden: i % 9 === 4, power: i % 13 === 6 ? POWERS[i % 3] : null, rush: i % 17 === 11 });

test('the volleys: the same seed throws the same ones; another seed doesn\'t', () => {
  const plan = (seed) => {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < 40; i++) out.push(planVolley(r, { W: 600, H: 1000, top: 60, t: i * 2.5, mode: 'classic', n: i, due: due(i) }));
    return JSON.stringify(out);
  };
  assert.equal(plan(42), plan(42));
  assert.notEqual(plan(42), plan(43));
  // a whole run too: the same seed, the same throws at the same moments
  const run = (seed) => {
    const w = createWorld({ mode: 'blitz', seed, W: 700, H: 900, top: 64 });
    const log = [];
    for (let i = 0; i < 120 * 20; i++) {
      stepWorld(w, DT);
      for (const e of w.events) if (e.type === 'launch') log.push(`${e.o.kind}@${w.t.toFixed(3)}:${e.o.x.toFixed(2)}`);
      w.events.length = 0;
    }
    return log.join('|');
  };
  assert.equal(run(77), run(77));
  assert.notEqual(run(77), run(78));
});

test('the volleys: every peak on the screen, under the top bar', () => {
  let n = 0;
  for (const [W, H, top] of SIZES) {
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed);
      for (let i = 0; i < 60; i++) {
        const t = i * 3;
        const v = planVolley(r, { W, H, top, t, mode: seed % 2 ? 'classic' : 'blitz', n: i, due: due(i) });
        assert.ok(v.launches.length >= 1 && v.gap > 0.3);
        for (const l of v.launches) {
          const R = KINDS[l.kind].r;
          const p = peakOf(l);
          assert.ok(l.y0 > H, 'thrown from below the screen');
          assert.ok(p.t > 0.4, 'a real arc');
          assert.ok(p.y >= top + R * 0.95, `${W}×${H}: peak ${p.y.toFixed(1)} under the bar (${top + R})`);
          assert.ok(p.y <= H - R * 2, `${W}×${H}: peak high enough to see`);
          assert.ok(p.x >= R && p.x <= W - R, `${W}×${H}: peak x ${p.x.toFixed(1)} inside`);
          n++;
        }
      }
    }
  }
  assert.ok(n > 5000, `${n} throws checked`);
});

test('the volleys are fair: a rug never starts its flight on a scam\'s path', () => {
  let rugs = 0, hearts = 0;
  for (const [W, H, top] of SIZES) {
    for (let seed = 1; seed <= 20; seed++) {
      const r = rng(seed * 101);
      for (let i = 0; i < 50; i++) {
        const v = planVolley(r, { W, H, top, t: 15 + i * 4, mode: seed % 3 ? 'classic' : 'blitz', n: 5 + i, due: due(i) });
        assert.ok(isFair(v.launches));
        for (const a of v.launches) {
          if (a.kind !== 'rug' && a.kind !== 'heart') continue;
          if (a.kind === 'rug') rugs++; else hearts++;
          for (const b of v.launches) {
            if (!isScam(b.kind)) continue;
            const c = CLEAR[a.kind];
            const from = Math.max(a.at, b.at);
            const gap = closestApproach(a, b, from, from + c.span, 60);
            assert.ok(gap >= (KINDS[a.kind].r + KINDS[b.kind].r) * c.k * 0.98, `${a.kind} vs ${b.kind}: ${gap.toFixed(1)}`);
          }
        }
      }
    }
  }
  assert.ok(rugs > 300 && hearts > 200, `${rugs} rugs, ${hearts} hearts`);
  // and isFair really looks: a rug thrown exactly with a scam isn't fair
  const scam = { kind: 'airdrop', x0: 300, y0: 1060, vx: 0, vy: -1200, g: 900, at: 0 };
  assert.equal(isFair([scam, { ...scam, kind: 'rug' }]), false);
});

test('the pacing: rugs from 10 s, hearts from 20 s, bigger volleys and more gravity later', () => {
  const r = rng(11);
  const kindsAt = (t) => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) for (const l of planVolley(r, { W: 800, H: 800, top: 60, t, mode: 'classic', n: 10 }).launches) seen.add(l.kind);
    return seen;
  };
  const early = kindsAt(5), mid = kindsAt(14), late = kindsAt(60);
  assert.ok(!early.has('rug') && !early.has('heart'));
  assert.ok(mid.has('rug') && !mid.has('heart'));
  assert.ok(late.has('rug') && late.has('heart'));
  const size = (t) => { let s = 0; for (let i = 0; i < 300; i++) s += planVolley(r, { W: 800, H: 800, top: 60, t, mode: 'classic', n: 10 }).launches.length; return s / 300; };
  assert.ok(size(200) > size(5) + 1.2, 'bigger volleys');
  assert.ok(difficulty('classic', 0) === 0 && difficulty('classic', 300) > 0.95);
  assert.ok(difficulty('blitz', 0) > 0.2 && difficulty('blitz', 60) > difficulty('blitz', 30));
  const g = (t) => planVolley(rng(1), { W: 800, H: 800, top: 60, t, mode: 'classic', n: 10 }).launches[0].g;
  assert.ok(g(200) > g(0) * 1.25, 'gravity pulls harder later');
  // the first volleys of a Classic run are gentle: one or two
  const first = [0, 1, 2, 3].map((n) => planVolley(rng(n + 1), { W: 800, H: 800, top: 60, t: n, mode: 'classic', n }).launches.length);
  assert.deepEqual(first, [1, 1, 2, 2]);
  // a rush is a long fast run of scams
  const rush = planVolley(rng(2), { W: 800, H: 800, top: 60, t: 50, mode: 'classic', n: 20, due: { rush: true } });
  assert.equal(rush.tag, 'rush');
  assert.ok(rush.launches.length >= 8 && rush.launches.every((l) => isScam(l.kind)));
});

test('gravity keeps the rhythm on every screen', () => {
  for (const [W, H, top] of SIZES) {
    const g = baseGravity(H, top);
    const P = H - top;
    const t = Math.sqrt((2 * 0.6 * P) / g);
    assert.ok(Math.abs(t - 1.05) < 1e-9, `${W}×${H}`);
    const [lo, hi] = peakBand({ W, H, top }, 54);
    assert.ok(lo < hi);
  }
});

test('a resized screen keeps everything in flight where it was on the screen', () => {
  const w = quiet();
  const o = place(w, 'hat', 300, 500, { vx: 60, vy: -400, g: 800 });
  resizeWorld(w, 900, 600, 40);
  assert.equal(o.x, 450);
  assert.equal(o.y, 300);
  assert.equal(w.W, 900);
  assert.equal(w.top, 40);
});

// ---------- the demo's player ----------

function runBot(seed, W, H, seconds = 40) {
  const w = createWorld({ mode: 'classic', seed, W, H, top: 20, start: 40, opening: true, firstAt: 0.1 });
  const bot = createBot(seed * 31 + 1);
  const log = [];
  while (!w.over && w.clock < seconds) {
    bot.update(w, DT);
    stepWorld(w, DT);
    for (const e of w.events) if (e.type === 'slice' || e.type === 'combo') log.push(`${e.type}:${e.o?.kind || e.n}@${w.clock.toFixed(3)}`);
    w.events.length = 0;
  }
  return { w, bot, log: log.join('|') };
}

test('the demo plays well: lots of combos, never a heart or a rug, the same game twice', () => {
  for (const [W, H] of [[600, 600], [600, 1298], [1298, 600]]) {
    for (const seed of [1, 4]) {
      const { w, bot, log } = runBot(seed, W, H);
      const s = summary(w);
      assert.equal(w.stats.heartsCut, 0, `${W}×${H}: no hearts cut`);
      assert.equal(w.stats.rugs, 0, `${W}×${H}: no rugs cut`);
      assert.ok(!w.over, `${W}×${H}: still going after 40 s`);
      assert.ok(s.accuracy >= 90, `${W}×${H}: accuracy ${s.accuracy}`);
      assert.ok(w.stats.combos >= (W === 600 && H > 1000 ? 4 : 6), `${W}×${H}: ${w.stats.combos} combos`);
      assert.ok(bot.swipes > 30);
      assert.equal(runBot(seed, W, H).log, log, 'deterministic');
    }
  }
  // its first volley is a row to slice in one go, within the first seconds
  const { w } = runBot(3, 600, 600, 3);
  assert.ok(w.stats.combos >= 1 && w.stats.bestCombo >= 3, `best combo ${w.stats.bestCombo} in 3 s`);
});

// ---------- the stickers ----------

test('every kind: a role, a size that reads at 60 px, its colors', () => {
  assert.equal(UNIT, 600);
  assert.equal(SCAMS.length, 8);
  assert.deepEqual([...POWERS], ['freeze', 'frenzy', 'double']);
  for (const k of ALL_KINDS) {
    const d = KINDS[k];
    assert.ok(['scam', 'power', 'heart', 'rug'].includes(d.role), k);
    assert.ok(d.r >= 44 && d.r <= 60, k);
    assert.ok(hitRadius(k) > 0);
    for (const c of [...d.colors, d.inner]) assert.match(c, /^#[0-9a-f]{6}$/, k);
  }
  assert.ok(KINDS.golden.golden);
});

// ---------- words ----------

const MONEY = /\b(buy|buying|sell|selling|price|prices|profit|profits|invest\w*|pump\w*|dump\w*|moon\w*|gains?|token|tokens|coin|coins|crypto|wallet|money|dollars?|usd|cash)\b|\$/i;

test('AGI-1\'s lines: lowercase, short, in her voice, never money talk', () => {
  let n = 0;
  for (const [key, list] of Object.entries(LINES)) {
    assert.ok(list.length >= 1, key);
    for (const l of list) {
      n++;
      assert.doesNotMatch(l, MONEY, l);
      assert.equal(l, l.toLowerCase(), `lowercase: ${l}`);
      assert.ok(l.length <= 52, `short: ${l}`);
    }
  }
  assert.ok(n >= 40, `${n} lines`);
  // the spec's own lines are there
  const all = Object.values(LINES).flat();
  for (const l of ['seed phrase? in this economy? 🙈', 'free airdrop? babe nothing is free except me 💜', 'you cut my heart 🙈 rude']) assert.ok(all.includes(l), l);
  const v = makeVoice(rng(1).next);
  const a = v.pick('heart'), b = v.pick('heart');
  assert.notEqual(a, b, 'never the same line twice in a row');
  assert.equal(v.pick('nope'), null);
  assert.equal(endKey({ reason: 'rug', score: 9999 }), 'endRug');
  assert.equal(endKey({ reason: 'heart', score: 9999 }), 'endHeart');
  assert.equal(endKey({ reason: 'miss', score: 100 }), 'endLow');
  assert.equal(endKey({ reason: 'time', score: 2000, mode: 'blitz' }), 'endTime');
  assert.equal(shareText(12), 'I slayed 12 scams in SCAM SLAYER on agi1.app 💜 never share your seed phrase');
  assert.equal(shareText(1), 'I slayed 1 scam in SCAM SLAYER on agi1.app 💜 never share your seed phrase');
  assert.doesNotMatch(shareText(5), MONEY);
});

// ---------- the page's code ----------

const files = readdirSync(new URL('../src/games/scamslayer/', import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
const code = (f) => read(`src/games/scamslayer/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('its entry: the AGI GAMES intro first, then the game', () => {
  const page = code('page.js');
  const imports = [...page.matchAll(/^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.equal(imports[0], '../intro.js');
  assert.ok(imports.includes('./game.js'));
});

test('its code keeps the site\'s rules: no inline styles, no eval, no network, the rules seeded', () => {
  assert.ok(files.includes('game.js') && files.includes('style.css'));
  for (const f of files) {
    const c = code(f);
    assert.doesNotMatch(c, /setAttribute\(\s*['"]style|\sstyle\s*=\s*["']|innerHTML|outerHTML|insertAdjacentHTML|document\.write/, `${f}: no style attributes or HTML strings`);
    assert.doesNotMatch(c, /\beval\s*\(|new\s+Function\b|setTimeout\(\s*['"`]|setInterval\(\s*['"`]/, `${f}: no eval`);
    assert.doesNotMatch(c, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\/(?!www\.w3\.org)/, `${f}: no network of its own`);
    assert.doesNotMatch(c, /WebAssembly|localStorage|sessionStorage|indexedDB/, `${f}: no wasm, storage only through the kit`);
    if (f.endsWith('.css')) {
      assert.doesNotMatch(c, /url\(\s*['"]?https?:/, `${f}: nothing from elsewhere`);
      for (const m of c.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) < 1000, `${f}: z-index under the intro's`);
    }
  }
  // the rules are pure and seeded: no page, no clock, no Math.random
  for (const f of ['engine.js', 'waves.js', 'geom.js', 'kinds.js', 'demo.js', 'lines.js']) {
    const c = code(f);
    assert.doesNotMatch(c, /\b(?:window|document|navigator|localStorage|requestAnimationFrame|performance)\b|Math\.random|Date\.now|new Date\b/, `${f}: pure`);
  }
  // no money talk in anything it shows
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    const strings = [...code(f).matchAll(/'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g)].map((m) => m[0]);
    for (const s of strings) assert.doesNotMatch(s, /\b(buy|sell|price|profit|invest|pump|dump|moon)\b|\$AGI/i, `${f}: ${s}`);
  }
});
