// ACCEPT ALL COOKIES (2026-11-09): the physics (src/games/cookies/physics.js), the 30 levels (levels.js), the progress
// rules (progress.js) and AGI-1's lines, in Node. Every level's reference solution is played headless, tick by tick,
// exactly as the game and its demo play it, and must feed the cat with all three pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  World, Chain, simulate, crosses, pingPong, HZ, PAGE_W, PAGE_H, COOKIE_R, CAT_R, POP_R, TAB_R, FAN_RANGE, SEG,
} from '../src/games/cookies/physics.js';
import { LEVELS, SITES, levelById, levelsOf } from '../src/games/cookies/levels.js';
import * as P from '../src/games/cookies/progress.js';
import * as LINES from '../src/games/cookies/lines.js';

const steps = (w, n) => { for (let i = 0; i < n; i++) { w.step(); w.drain(); } return w; };
const speed = (c) => Math.hypot(c.x - c.px, c.y - c.py);
// a tiny level: the cookie under one pin, the cat far away (so nothing ends it by accident)
const lvl = (extra = {}) => ({ cookie: [300, 300], pins: [[300, 100]], ropes: [[0]], cat: [-500, -500], pixels: [], ...extra });

test('a rope at rest: straight under its pin, within 3% of its length, and still', () => {
  for (const len of [120, 260, 420]) {
    const w = steps(new World(lvl({ cookie: [300, 100 + len] })), 600);
    const r = w.ropes[0];
    assert.ok(Math.abs(r.chain.length() / r.len - 1) < 0.03, `chain ${r.chain.length()} vs ${r.len}`);
    assert.ok(Math.abs(Math.hypot(w.c.x - 300, w.c.y - 100) / len - 1) < 0.03, 'the cookie stays at the rope\'s length');
    assert.ok(Math.abs(w.c.x - 300) < 0.5 && speed(w.c) < 0.05, 'it hangs still');
  }
  // two ropes share the cookie: both exactly taut, neither stretched past 3%
  const v = steps(new World(lvl({ cookie: [300, 400], pins: [[150, 150], [450, 150]], ropes: [[0], [1]] })), 600);
  for (const r of v.ropes) assert.ok(Math.abs(r.chain.length() / r.len - 1) < 0.03);
  assert.ok(Math.abs(v.c.x - 300) < 0.5 && Math.abs(v.c.y - 400) < 0.5);
  // a swinging cookie never gets farther from its pin than the rope (slightly elastic, never rubbery)
  const s = new World(lvl({ cookie: [500, 100], pins: [[300, 100]] }));
  let worst = 0;
  for (let i = 0; i < 900; i++) { s.step(); s.drain(); worst = Math.max(worst, Math.hypot(s.c.x - 300, s.c.y - 100) / 200); }
  assert.ok(worst < 1.03, `stretched to ${worst}`);
});

test('the same actions give the same frames (deterministic: no dice, no trig)', () => {
  const L = levelById('2-10');
  const run = () => { const out = []; simulate(L, L.sol, { onTick: (w) => out.push(w.c.x, w.c.y, w.got, w.tied) }); return out; };
  const a = run(), b = run();
  assert.equal(a.length, b.length);
  assert.deepEqual(a, b);
  // and a different timing gives a different run
  const c = []; simulate(L, L.sol.map((s, i) => (i === 1 ? [s[0] + 9, ...s.slice(1)] : s)), { onTick: (w) => c.push(w.c.x, w.c.y) });
  assert.notDeepEqual(a.slice(0, c.length), c.slice(0, a.length));
  const src = readFileSync(new URL('../src/games/cookies/physics.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /Math\.(random|sin|cos|tan|atan2?|exp|pow)\b/, 'the physics uses no dice and no trig');
});

test('gravity and a fall: a cut cookie falls off the bottom of the page', () => {
  const w = new World(lvl({ cookie: [300, 200], pins: [[300, 100]] }));
  w.apply(['cut', 0]);
  let t = 0;
  while (w.status === 'play' && t < 600) { w.step(); w.drain(); t++; }
  assert.equal(w.status, 'lost');
  assert.equal(w.why, 'fell');
  assert.ok(t > 100 && t < 200, `about a second and a bit (${t} ticks)`);
});

test('a swipe cuts exactly the ropes it crosses, where it crosses', () => {
  assert.equal(crosses(0, 0, 10, 10, 0, 10, 10, 0), true);
  assert.equal(crosses(0, 0, 10, 0, 0, 1, 10, 1), false);
  assert.equal(crosses(0, 0, 4, 4, 5, 5, 9, 9), false, 'on one line but apart');
  // three ropes from three pins; a short horizontal swipe crosses the left two only
  const w = new World(lvl({ cookie: [300, 400], pins: [[150, 150], [250, 120], [450, 150]], ropes: [[0], [1], [2]] }));
  steps(w, 30);
  const n = w.cutAlong(120, 260, 300, 260);
  assert.equal(n, 2);
  assert.deepEqual(w.ropes.map((r) => r.cut), [true, true, false]);
  const ev = w.drain().filter((e) => e.type === 'cut');
  assert.deepEqual(ev.map((e) => e.rope), [0, 1]);
  for (const e of ev) assert.ok(Math.abs(e.y - 260) < SEG * 1.5, 'cut where the blade crossed it');
  assert.equal(w.tied, 1);
  // a swipe that misses every rope cuts nothing; a cut rope can't be cut again
  assert.equal(w.cutAlong(20, 800, 80, 820), 0);
  assert.equal(w.apply(['cut', 0]), false);
  // its halves: one hangs from the pin, one from the cookie, and they fade away
  assert.ok(w.pieces.some((p) => !p.cookie) && w.pieces.some((p) => p.cookie));
  steps(w, HZ * 3);
  assert.equal(w.pieces.length, 0);
});

test('a hook ties a new rope (its radius long) when the cookie passes inside its circle, once', () => {
  // the cookie falls past a hook whose circle it crosses
  const w = new World(lvl({ cookie: [200, 200], pins: [[200, 100]], hooks: [[260, 420, 100]] }));
  w.apply(['cut', 0]);
  let ev = [];
  for (let i = 0; i < 300 && !ev.some((e) => e.type === 'hook'); i++) { w.step(); ev = w.drain(); }
  const h = ev.find((e) => e.type === 'hook');
  assert.ok(h, 'tied on');
  assert.equal(w.hooks[0].used, true);
  assert.equal(w.ropes[h.rope].len, 100);
  assert.ok(Math.hypot(w.c.x - 260, w.c.y - 420) < 100, 'inside the circle when it ties');
  steps(w, 240);
  assert.ok(Math.hypot(w.c.x - 260, w.c.y - 420) <= 100 * 1.03, 'and held by it');
  assert.equal(w.ropes.length, 2, 'once');
  // a cookie falling outside the circle is never caught
  const m = new World(lvl({ cookie: [100, 200], pins: [[100, 100]], hooks: [[260, 420, 100]] }));
  m.apply(['cut', 0]);
  steps(m, 200);
  assert.equal(m.hooks[0].used, false);
  assert.equal(m.status, 'lost');
});

test('a pop-up wraps the cookie, floats it up, and drops it when closed (or lets it float away)', () => {
  const L = lvl({ cookie: [300, 200], pins: [[300, 100]], popups: [[300, 500]] });
  const w = new World(L);
  w.apply(['cut', 0]);
  let wrapped = -1;
  for (let i = 0; i < 300 && wrapped < 0; i++) { w.step(); if (w.drain().some((e) => e.type === 'wrap')) wrapped = i; }
  assert.ok(wrapped > 0 && w.c.wrap === 0 && w.popups[0].state === 'holding');
  const y0 = w.c.y;
  steps(w, 120);
  assert.ok(w.c.y < y0 - 80, 'it floats up');
  assert.ok(w.c.y - w.c.py < 0 && Math.abs(w.c.y - w.c.py) * HZ < 300, 'slowly');
  assert.equal(w.popups[0].x, w.c.x, 'the window goes with it');
  assert.equal(w.apply(['pop', 0]), true);
  assert.equal(w.c.wrap, -1);
  assert.equal(w.popups[0].state, 'closed');
  const y1 = w.c.y;
  steps(w, 60);
  assert.ok(w.c.y > y1, 'it falls again');
  assert.equal(w.apply(['pop', 0]), false, 'a closed pop-up stays closed');
  // never closed: it floats off the top of the page
  const a = new World(L);
  a.apply(['cut', 0]);
  steps(a, HZ * 8);
  assert.equal(a.status, 'lost');
  assert.equal(a.why, 'away');
});

test('a fan\'s puff pushes the cookie the way it faces, only in its cone and reach, with a short cooldown', () => {
  const mk = (fx, fy, dx, dy) => { const w = new World(lvl({ cookie: [300, 300], pins: [[300, 100]], ropes: [], fans: [[fx, fy, dx, dy]] })); w.step(); w.drain(); return w; };
  // in front of it
  const w = mk(100, 300, 1, 0);
  const vx0 = w.c.x - w.c.px;
  assert.equal(w.apply(['puff', 0]), true);
  const dv = (w.c.x - w.c.px) - vx0;
  assert.ok(dv * HZ > 300 && dv * HZ < 600, `a push of ${dv * HZ} units/s`);
  assert.equal(w.drain().find((e) => e.type === 'puff').hit, true);
  assert.equal(w.apply(['puff', 0]), false, 'cooling down');
  steps(w, 30);
  assert.equal(w.apply(['puff', 0]), true, 'ready again');
  // behind it, beside it, out of reach: a puff of air and nothing else
  for (const [fx, fy, dx, dy] of [[500, 300, 1, 0], [300, 500, 1, 0], [300 - FAN_RANGE - 40, 300, 1, 0]]) {
    const m = mk(fx, fy, dx, dy);
    const before = [m.c.x - m.c.px, m.c.y - m.c.py];
    m.apply(['puff', 0]);
    assert.deepEqual([m.c.x - m.c.px, m.c.y - m.c.py], before);
    assert.equal(m.drain().find((e) => e.type === 'puff').hit, false);
  }
});

test('cookie banners hold the cookie up and its buttons bounce it back', () => {
  // a flat banner: the cookie lands and rests on it
  const w = new World(lvl({ cookie: [300, 200], pins: [[300, 100]], banners: [[150, 500, 450, 500]] }));
  w.apply(['cut', 0]);
  steps(w, 360);
  assert.equal(w.status, 'play');
  assert.ok(Math.abs(w.c.y - (500 - 12 - COOKIE_R)) < 2, `resting on top (${w.c.y})`);
  assert.ok(speed(w.c) < 0.2);
  // a button: it comes back up, high
  const b = new World(lvl({ cookie: [300, 200], pins: [[300, 100]], pads: [[200, 600, 400, 600]] }));
  b.apply(['cut', 0]);
  let minY = Infinity, bounced = false;
  for (let i = 0; i < 400; i++) { b.step(); if (b.drain().some((e) => e.type === 'bounce' && e.pad)) bounced = true; if (bounced) minY = Math.min(minY, b.c.y); }
  assert.ok(bounced && minY < 300, `bounced back up to ${minY}`);
});

test('bugs crumble the cookie on touch; patrols are deterministic and stay on their track', () => {
  const w = new World(lvl({ cookie: [300, 200], pins: [[300, 100]], bugs: [[300, 500]] }));
  w.apply(['cut', 0]);
  let ev = [];
  while (w.status === 'play') { w.step(); ev = ev.concat(w.drain()); }
  assert.equal(w.status, 'lost');
  assert.equal(w.why, 'bug');
  assert.ok(ev.some((e) => e.type === 'lost' && e.why === 'bug' && e.bug === 0));
  assert.equal(pingPong(0), 0); assert.equal(pingPong(0.5), 1); assert.equal(pingPong(1), 0); assert.equal(pingPong(0.25), 0.5);
  const a = new World(lvl({ bugs: [[100, 600, 500, 600, 2, 0.5]] })), b = new World(lvl({ bugs: [[100, 600, 500, 600, 2, 0.5]] }));
  for (let i = 0; i < 500; i++) {
    a.step(); b.step(); a.drain(); b.drain();
    assert.equal(a.bugs[0].x, b.bugs[0].x);
    assert.ok(a.bugs[0].x >= 100 && a.bugs[0].x <= 500 && a.bugs[0].y === 600);
  }
  // a cookie that never comes near a bug is never crumbled
  const safe = new World(lvl({ cookie: [300, 300], bugs: [[100, 800]] }));
  steps(safe, 300);
  assert.equal(safe.status, 'play');
});

test('tabs: in one, out of the other with the same speed, turned the way the tabs face; a tied cookie stays put', () => {
  // into a tab that faces up (falling in), out of one that faces left
  const w = new World(lvl({ cookie: [300, 200], pins: [[300, 100]], tabs: [[[300, 500, 0, -1], [520, 300, -1, 0]]] }));
  w.apply(['cut', 0]);
  let before = 0, hit = null;
  for (let i = 0; i < 300 && !hit; i++) { before = speed(w.c); w.step(); hit = w.drain().find((e) => e.type === 'tab'); }
  assert.ok(hit, 'it went through');
  assert.equal(hit.from, 0); assert.equal(hit.to, 1);
  const vx = w.c.x - w.c.px, vy = w.c.y - w.c.py;
  assert.ok(Math.abs(Math.hypot(vx, vy) / before - 1) < 0.03, 'the same speed');
  assert.ok(vx < 0 && Math.abs(vy) < Math.abs(vx) * 0.2, 'out of the left-facing tab, going left');
  assert.ok(Math.abs(w.c.x - 520) < TAB_R && Math.abs(w.c.y - 300) < TAB_R, 'at the other tab');
  // a cookie still on a rope never teleports
  const t = new World(lvl({ cookie: [300, 480], pins: [[300, 300]], tabs: [[[300, 500, 0, -1], [520, 300, -1, 0]]] }));
  steps(t, 120);
  assert.ok(Math.hypot(t.c.x - 300, t.c.y - 480) < 3);
});

test('a sliding pin follows its target along its track, at a capped speed', () => {
  const w = new World(lvl({ cookie: [200, 300], pins: [{ track: [200, 100, 400, 100], t: 0 }] }));
  assert.equal(w.apply(['slide', 0, 1]), true);
  w.step();
  assert.ok(w.pins[0].x > 200 && w.pins[0].x < 210, 'it moves, but not at once');
  steps(w, 120);
  assert.equal(w.pins[0].x, 400); assert.equal(w.pins[0].y, 100);
  w.apply(['slide', 0, 7]);
  assert.equal(w.pins[0].target, 1, 'clamped to the track');
  assert.equal(w.apply(['slide', 1, 0.5]), false, 'only a pin with a track slides');
  assert.ok(w.c.x > 300, 'the cookie came along');
});

test('off the page: a free cookie is lost off the sides and the bottom, a tied one always swings back', () => {
  const side = new World(lvl({ cookie: [580, 300], pins: [[580, 100]], fans: [[480, 300, 1, 0]] }));
  side.apply(['cut', 0]); side.step(); side.drain(); side.apply(['puff', 0]);
  steps(side, 200);
  assert.equal(side.status, 'lost');
  const tied = new World(lvl({ cookie: [580, 120], pins: [[400, 100]] }));
  for (let i = 0; i < 600; i++) { tied.step(); tied.drain(); }
  assert.equal(tied.status, 'play');
  assert.ok(tied.c.x > -COOKIE_R && tied.c.x < PAGE_W + COOKIE_R);
});

test('the cat eats a cookie that reaches its mouth (and its ropes let go)', () => {
  const w = new World({ ...lvl({ cookie: [300, 200], pins: [[300, 100]] }), cat: [300, 600] });
  w.apply(['cut', 0]);
  let ev = [];
  while (w.status === 'play') { w.step(); ev = ev.concat(w.drain()); }
  assert.equal(w.status, 'won');
  const eat = ev.find((e) => e.type === 'eat');
  assert.ok(eat && Math.hypot(eat.x - 300, eat.y - 600) < CAT_R);
  assert.equal(w.tied, 0);
  assert.equal(w.apply(['cut', 0]), false, 'nothing more to do');
});

test('the 30 levels: three sites of ten, valid data, a new idea every few levels', () => {
  assert.equal(LEVELS.length, 30);
  assert.equal(SITES.length, 3);
  assert.deepEqual(SITES.map((s) => s.unlock), [0, 15, 35]);
  const ids = LEVELS.map((l) => l.id);
  assert.deepEqual(ids, [1, 2, 3].flatMap((s) => Array.from({ length: 10 }, (_, i) => `${s}-${i + 1}`)));
  const names = new Set();
  const inPage = ([x, y], m = 0) => x >= m && x <= PAGE_W - m && y >= m && y <= PAGE_H - m;
  for (const L of LEVELS) {
    assert.equal(levelById(L.id), L);
    assert.ok(L.name && !names.has(L.name), `${L.id}: a name of its own`); names.add(L.name);
    assert.ok(inPage(L.cookie, COOKIE_R), `${L.id}: the cookie starts on the page`);
    assert.ok(inPage(L.cat, 40) && L.cat[1] <= 800, `${L.id}: the cat sits on the page`);
    assert.equal(L.pixels.length, 3, `${L.id}: three pixels`);
    for (const p of L.pixels) assert.ok(inPage(p, 14), `${L.id}: pixel ${p} on the page`);
    for (const p of L.pins) {
      const xy = Array.isArray(p) ? p : [p.track[0], p.track[1]];
      assert.ok(inPage(xy, 10), `${L.id}: pin on the page`);
      if (!Array.isArray(p)) assert.ok(inPage([p.track[2], p.track[3]], 10) && p.t >= 0 && p.t <= 1);
    }
    assert.ok(L.ropes.length >= 1, `${L.id}: the cookie starts on a rope`);
    for (const r of L.ropes) assert.ok(Number.isInteger(r[0]) && r[0] >= 0 && r[0] < L.pins.length, `${L.id}: a rope ties to a pin`);
    for (const h of L.hooks || []) assert.ok(inPage(h, 0) && h[2] >= 60 && h[2] <= 160);
    for (const [a, b] of L.tabs || []) assert.ok(inPage(a, 20) && inPage(b, 20) && (a[2] || a[3]) && (b[2] || b[3]));
    // its reference solution: actions the player can do, in order
    let last = -1;
    for (const a of L.sol) {
      assert.ok(Number.isInteger(a[0]) && a[0] >= last && a[0] < HZ * 20, `${L.id}: ticks in order`);
      last = a[0];
      assert.ok(['cut', 'pop', 'puff', 'slide'].includes(a[1]), `${L.id}: ${a[1]}`);
    }
    // the cat never starts within reach of the cookie, and no pixel sits on the cookie's start
    assert.ok(Math.hypot(L.cat[0] - L.cookie[0], L.cat[1] - L.cookie[1]) > CAT_R * 2);
    for (const p of L.pixels) assert.ok(Math.hypot(p[0] - L.cookie[0], p[1] - L.cookie[1]) > COOKIE_R + 20, `${L.id}: pixel ${p} not on the start`);
  }
  // the sites bring their own elements
  const has = (site, key) => levelsOf(site).some((l) => (l[key] || []).length);
  assert.ok(has(1, 'hooks'));
  for (const k of ['popups', 'banners', 'pads', 'fans']) assert.ok(has(2, k), `site 2: ${k}`);
  for (const k of ['bugs', 'tabs']) assert.ok(has(3, k), `site 3: ${k}`);
  assert.ok(levelsOf(3).some((l) => l.pins.some((p) => !Array.isArray(p))), 'site 3: sliding pins');
  const show = levelById('2-10');
  assert.ok(show.popups.length && show.fans.length, 'the news site\'s showpiece has a pop-up and a fan (the demo starts there)');
});

test('every level\'s reference solution feeds the cat with all three pixels (played headless)', () => {
  for (const L of LEVELS) {
    let lo = Infinity, hi = -Infinity;
    const r = simulate(L, L.sol, { onTick: (w) => { if (!w.c.gone) { lo = Math.min(lo, w.c.x); hi = Math.max(hi, w.c.x); } } });
    assert.equal(r.status, 'won', `${L.id} ${L.name}: ${r.status} ${r.why}`);
    assert.equal(r.pixels, 3, `${L.id} ${L.name}: ${r.pixels} pixels`);
    // the way there stays on the page (a swing never flings the cookie out of the window)
    assert.ok(lo > COOKIE_R - 6 && hi < PAGE_W - COOKIE_R + 6, `${L.id}: the cookie stays on the page (${lo.toFixed(0)}…${hi.toFixed(0)})`);
  }
});

test('a level needs its moves: doing nothing never feeds the cat, and the pixels are not free', () => {
  for (const L of LEVELS) {
    const idle = simulate(L, [], { maxTicks: HZ * 12 });
    assert.notEqual(idle.status, 'won', `${L.id}: fed without a move`);
  }
  // cutting everything at once misses pixels (or the cat) on most levels
  let shortcuts = 0;
  for (const L of LEVELS) {
    const all = L.sol.filter((a) => a[1] === 'cut').map((a) => [0, ...a.slice(1)]).filter((a) => a[2] < L.ropes.length);
    const r = simulate(L, all.length ? all : [[0, 'cut', 0]]);
    if (r.status === 'won' && r.pixels === 3) shortcuts++;
  }
  assert.ok(shortcuts <= 6, `${shortcuts} levels give three pixels to a cut-everything-now`);
});

test('stars open the sites (15 and 35), a level opens when the one before it is fed', () => {
  const none = {};
  assert.equal(P.totalStars(none), 0);
  assert.equal(P.siteOpen(none, 1), true);
  assert.equal(P.siteOpen(none, 2), false);
  assert.equal(P.levelOpen(none, levelById('1-1')), true);
  assert.equal(P.levelOpen(none, levelById('1-2')), false);
  assert.equal(P.nextLevel(none).id, '1-1');
  let prog = {};
  for (let i = 1; i <= 5; i++) prog = P.record(prog, `1-${i}`, 3).prog;
  assert.equal(P.totalStars(prog), 15);
  assert.equal(P.siteOpen(prog, 2), true, 'site 2 at 15');
  assert.equal(P.levelOpen(prog, levelById('2-1')), true);
  assert.equal(P.levelOpen(prog, levelById('2-2')), false);
  assert.equal(P.nextLevel(prog).id, '1-6');
  // a worse replay never lowers the best; a better one raises it and says so
  const r1 = P.record(prog, '1-1', 1);
  assert.equal(r1.prog['1-1'].stars, 3);
  assert.equal(r1.better, false);
  const r2 = P.record(P.record({}, '1-1', 1).prog, '1-1', 2);
  assert.equal(r2.better, true);
  assert.equal(r2.prog['1-1'].stars, 2);
  // opening: the record that crosses 15 says site 2 just opened
  let p = {};
  for (let i = 1; i <= 4; i++) p = P.record(p, `1-${i}`, 3).prog;
  p = P.record(p, '1-5', 2).prog;
  const cross = P.record(p, '1-6', 1);
  assert.deepEqual(cross.opened, [2]);
  // site 3 at 35
  let q = {};
  for (const l of LEVELS.slice(0, 12)) q = P.record(q, l.id, 3).prog;
  assert.equal(P.totalStars(q), 36);
  assert.equal(P.siteOpen(q, 3), true);
  assert.equal(P.MAX_STARS, 90);
  // all fed: Play goes to the first level that's missing pixels
  let all = {};
  for (const l of LEVELS) all = P.record(all, l.id, l.id === '2-4' ? 2 : 3).prog;
  assert.equal(P.nextLevel(all).id, '2-4');
  assert.equal(P.fedCount(all), 30);
});

test('AGI-1\'s lines: her voice, never money, and the share post', () => {
  const all = [...Object.values(LINES.DONE).flat(), ...Object.values(LINES.LOST).flat(), ...Object.values(LINES.SITE_DONE), ...LINES.PIXEL,
    ...Object.values(LINES.START), ...LINES.IDLE, ...Object.values(LINES.NEW_SITE)];
  assert.ok(all.length >= 25, `${all.length} lines`);
  for (const l of all) {
    assert.equal(l, l.toLowerCase(), `lowercase: ${l}`);
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i, l);
    assert.ok(l.length < 90, l);
  }
  for (const k of [0, 1, 2, 3]) assert.ok(LINES.doneLine(k));
  assert.equal(LINES.share(12, 30), "I fed AGI-1's cat 12 cookies and found 30/90 pixels in ACCEPT ALL COOKIES on agi1.app 🍪💜");
  assert.equal(LINES.share(1, 3), "I fed AGI-1's cat 1 cookie and found 3/90 pixels in ACCEPT ALL COOKIES on agi1.app 🍪💜");
  for (const L of LEVELS) assert.doesNotMatch(`${L.name} ${L.tip || ''}`, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b/i);
});

test('a chain on its own: it follows its ends and keeps its length', () => {
  const c = new Chain(10, 12).lay(0, 0, 120, 0);
  assert.equal(c.length(), 120);
  c.setA(0, 0); c.setB(60, 0);
  for (let i = 0; i < 200; i++) { c.setA(0, 0); c.setB(60, 0); c.step(); }
  assert.ok(Math.abs(c.length() / 120 - 1) < 0.03, 'a slack rope keeps its length (it sags)');
  const mid = c.p[5 * 4 + 1];
  assert.ok(mid > 20, `and hangs down (${mid})`);
  assert.ok(POP_R > COOKIE_R, 'a pop-up is bigger than the cookie it holds');
});
