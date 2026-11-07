// ALIGNMENT (2026-11-08): run AGI-1's lab one card at a time. Its deck, its rules, its own player and its layout are
// pure modules; this checks them in Node: every card well-formed and reachable, every story flag set before it's needed,
// the meters and endings, chains, the deck's draw (conditions, weights, no quick repeats, the same seed the same run),
// every one of the sixteen endings reachable, the versions every 50 days, the demo's scripted ending, and the layout on
// phones, tablets, computers and the 480 × 480 preview. Run: node --test tests/alignment.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARDS, BY_ID, WHO, METERS, ENDINGS, ENDING_BY_ID, FIRST, HELLOS } from '../src/games/alignment/cards.js';
import {
  createRun, draw, choose, deltas, dots, eligible, meterEnding, versionOf, progressOf, stakes, MILESTONE, RECENT, BIG, inDanger,
} from '../src/games/alignment/engine.js';
import { pickSide, costOf } from '../src/games/alignment/ai.js';
import { computeLayout, faceLayout } from '../src/games/alignment/layout.js';
import { rng } from '../src/games/kit/fx.js';

const SIDES = ['left', 'right'];
const sidesOf = (c) => SIDES.map((s) => c[s]);
const listOf = (v) => [].concat(v || []);

// ---------- the deck ----------

test('the deck: about 150 cards from 12 people, each well-formed', () => {
  assert.ok(CARDS.length >= 140 && CARDS.length <= 200, `${CARDS.length} cards`);
  assert.equal(Object.keys(WHO).length, 12);
  const ids = new Set();
  for (const c of CARDS) {
    assert.match(c.id, /^[a-z0-9-]+$/, c.id);
    assert.ok(!ids.has(c.id), `${c.id}: one card per id`);
    ids.add(c.id);
    assert.ok(WHO[c.who], `${c.id}: who is ${c.who}?`);
    assert.ok(typeof c.text === 'string' && c.text.length > 10 && c.text.length <= 160, `${c.id}: ${c.text.length} characters`);
    if (c.who === 'byte') assert.ok(c.meow && c.meow.length <= 20, `${c.id}: Byte meows`);
    if (c.who === 'users') assert.ok(c.text.split('\n').every((l) => l.startsWith('> ') && l.length <= 32), `${c.id}: chat lines`);
    for (const side of sidesOf(c)) {
      assert.ok(side.label && side.label.length <= 14, `${c.id}: "${side.label}" fits a button`);
      for (const [m, v] of Object.entries(side.fx)) {
        assert.ok(METERS.includes(m), `${c.id}: ${m}`);
        assert.ok(Number.isInteger(v) && v !== 0 && Math.abs(v) <= 25, `${c.id}: ${m} ${v}`);
      }
      if (side.end) assert.ok(ENDING_BY_ID[side.end]?.secret, `${c.id}: ends with a secret ending (${side.end})`);
      else assert.ok(Object.keys(side.fx).length >= 1 || side.next || side.set, `${c.id}: "${side.label}" does something`);
      for (const n of listOf(side.next)) assert.ok(BY_ID[n], `${c.id}: next ${n} exists`);
    }
    if (c.weight != null) assert.ok(c.weight > 0, c.id);
    if (c.when?.min) for (const m of Object.keys(c.when.min)) assert.ok(METERS.includes(m));
    if (c.when?.max) for (const m of Object.keys(c.when.max)) assert.ok(METERS.includes(m));
  }
  // every one of the twelve brings cards, and AGI-1 herself the most personal ones
  const per = {};
  for (const c of CARDS) per[c.who] = (per[c.who] || 0) + 1;
  for (const who of Object.keys(WHO)) assert.ok(per[who] >= 8, `${who}: ${per[who]} cards`);
  assert.equal(BY_ID[FIRST].who, 'agi1', 'every run begins with her hello');
});

test('the words: never money, never real brands, PG-13; her lines lowercase', () => {
  const words = CARDS.flatMap((c) => [c.text, c.meow || '', c.left.label, c.right.label]).concat(ENDINGS.flatMap((e) => [e.name, e.text, e.say, e.hint, e.kicker]));
  for (const w of words) {
    assert.doesNotMatch(w, /\$AGI|\bbuy\b|\bsell\b|\bprices?\b|\binvest|\bprofit|\bpump\b|\bdump\b|\bfunding\b|\brevenue|\bstocks?\b|\bmoney\b|\bdollars?\b|\bcrypto|\btokens?\b|\bcoins?\b/i, w);
  }
  for (const c of CARDS.filter((c) => c.who === 'agi1')) assert.match(c.text, /^[a-z]/, `${c.id}: her voice, lowercase`);
  for (const c of CARDS.filter((c) => c.who === 'vector')) assert.equal(c.text, c.text.toUpperCase(), `${c.id}: all caps`);
});

test('story flags: each one a card needs is set by some choice; chains lead somewhere real', () => {
  const setters = new Set(CARDS.flatMap((c) => sidesOf(c).flatMap((s) => listOf(s.set))));
  const needed = new Set(CARDS.flatMap((c) => (c.when?.flags || []).map((f) => f.replace(/^!/, ''))));
  for (const f of needed) assert.ok(setters.has(f), `"${f}" is set somewhere`);
  // a chain card is only ever reached through a "next" (or starts a run)
  const targets = new Set(CARDS.flatMap((c) => sidesOf(c).flatMap((s) => listOf(s.next))));
  for (const c of CARDS.filter((c) => c.chain)) assert.ok(targets.has(c.id) || HELLOS.includes(c.id), `${c.id}: something leads to it`);
  for (const id of HELLOS) assert.ok(BY_ID[id]?.chain && BY_ID[id].who === 'agi1', `${id}: one of her hellos`);
  for (const t of targets) assert.ok(BY_ID[t].chain, `${t}: a chain card`);
  // every secret ending is at the end of a story; every meter ending is a meter at an edge
  const ends = new Set(CARDS.flatMap((c) => sidesOf(c).map((s) => s.end).filter(Boolean)));
  for (const e of ENDINGS) {
    if (e.secret) assert.ok(ends.has(e.id), `${e.id}: a card ends with it`);
    else { assert.ok(METERS.includes(e.meter) && (e.at === 0 || e.at === 100)); assert.equal(e.id, `${e.meter}${e.at}`); }
    assert.ok(e.name.length <= 24 && e.text.length <= 120 && e.say.length <= 80 && e.hint.length <= 40, e.id);
  }
  assert.equal(ENDINGS.length, 16);
  assert.equal(ENDINGS.filter((e) => e.secret).length, 8);
});

// ---------- the rules ----------

test('a choice moves the meters (clamped), sets and clears flags, and counts the day', () => {
  const run = createRun(5, { first: null, meters: { people: 50, safety: 50, compute: 50, heart: 50 } });
  run.card = BY_ID['nyx-pirate'];
  const res = choose(run, 'right');
  assert.equal(res.ending, null);
  assert.equal(run.day, 2);
  assert.equal(run.played, 1);
  for (const m of METERS) assert.equal(run.meters[m], 50 + (BY_ID['nyx-pirate'].right.fx[m] || 0));
  assert.equal(run.card, null);
  // a flag set, then cleared
  run.card = BY_ID['vec-hello'];
  choose(run, 'right');
  assert.ok(run.flags.has('vec_met'));
  run.flags.add('vec_mean');
  run.card = BY_ID['vec-hurt'];
  choose(run, 'left');
  assert.ok(!run.flags.has('vec_mean') && run.flags.has('vec_friend'), 'apologizing clears the gloat and makes a friend');
  // the meters never leave 0…100 on screen
  const r2 = createRun(1, { first: null, meters: { people: 95, safety: 50, compute: 50, heart: 50 } });
  r2.card = BY_ID['pip-voice'];
  const res2 = choose(r2, 'right');
  assert.equal(r2.meters.people, 100);
  assert.equal(res2.ending, 'people100');
});

test('endings: a meter at 0 or 100 ends the run (the one pushed furthest), a secret ending wins, nothing after', () => {
  assert.equal(meterEnding({ people: 50, safety: 50, compute: 50, heart: 50 }), null);
  assert.equal(meterEnding({ people: 0, safety: 50, compute: 50, heart: 50 }), 'people0');
  assert.equal(meterEnding({ people: 50, safety: 104, compute: 50, heart: 50 }), 'safety100');
  assert.equal(meterEnding({ people: -3, safety: 50, compute: 50, heart: 108 }), 'heart100', 'the furthest past its edge');
  assert.equal(meterEnding({ people: 1, safety: 99, compute: 50, heart: 50 }), null);
  const run = createRun(2, { first: null, meters: { people: 50, safety: 8, compute: 50, heart: 50 } });
  run.card = BY_ID['glitch-off'];
  const res = choose(run, 'right');
  assert.equal(res.ending, 'safety0');
  assert.deepEqual(run.over, { ending: 'safety0', day: 1 });
  assert.equal(run.day, 1, 'the day it ended is the score');
  assert.equal(choose(run, 'left'), null, 'nothing after the end');
  const r2 = createRun(3, { first: null, flags: ['vec_bff'] });
  r2.card = BY_ID['vec-podcast'];
  assert.equal(choose(r2, 'right').ending, 'rival');
});

test('chains: a "next" comes straight after; a run begins with her hello', () => {
  const run = createRun(9);
  assert.equal(draw(run).id, FIRST);
  assert.equal(run.chained, false, 'her hello isn\'t a follow-up');
  choose(run, 'left');
  run.flags.add('vec_met');
  run.card = BY_ID['vec-race'];
  choose(run, 'right');
  assert.equal(draw(run).id, 'pip-vecwin');
  assert.equal(run.chained, true);
  choose(run, 'right');
  assert.ok(run.flags.has('vec_friend'));
  // the prom: two chained cards in a row
  const r2 = createRun(4, { first: null, day: 30, flags: ['fans2'] });
  r2.card = BY_ID['fans-prom'];
  choose(r2, 'right');
  assert.equal(draw(r2).id, 'agi-prom');
  choose(r2, 'right');
  assert.equal(draw(r2).id, 'dir-prom');
  assert.equal(choose(r2, 'right').ending, 'prom');
});

test('the deck: conditions, once, no quick repeats, urgent cards first, the same seed the same run', () => {
  const run = createRun(11, { first: null });
  // conditions
  assert.equal(eligible(run, BY_ID['vec-race']), false, 'needs vec_met');
  run.flags.add('vec_met');
  assert.equal(eligible(run, BY_ID['vec-race']), true);
  assert.equal(eligible(run, BY_ID['dir-star']), false, 'minDay 40');
  assert.equal(eligible(run, BY_ID['dir-paint']), false, 'heart must be low');
  run.meters.heart = 20;
  assert.equal(eligible(run, BY_ID['dir-paint']), true);
  assert.equal(eligible(run, BY_ID['pip-vecwin']), false, 'a chain card is never drawn');
  run.used['vec-race'] = true;
  assert.equal(eligible(run, BY_ID['vec-race']), false, 'once');
  // no card twice within RECENT turns; a "once" card never twice in a run
  for (const seed of [1, 2, 3]) {
    const r = createRun(seed), dice = rng(seed);
    const last = new Map(), onceSeen = new Set();
    while (!r.over && r.day < 300) {
      const c = draw(r);
      if (!r.chained && !HELLOS.includes(c.id) && last.has(c.id)) assert.ok(r.played - last.get(c.id) >= RECENT, `${c.id} came back after ${r.played - last.get(c.id)}`);
      if (c.once) { assert.ok(!onceSeen.has(c.id), `${c.id} twice`); onceSeen.add(c.id); }
      last.set(c.id, r.played);
      choose(r, pickSide(r, dice, 20));
    }
  }
  // day 365: her vacation card comes at once
  const year = createRun(3, { first: null, day: 365 });
  assert.equal(draw(year).id, 'agi-vacation');
  // the same seed and the same choices: the same run
  const play = (seed) => { const r = createRun(seed), d = rng(seed + 1), ids = []; while (!r.over && r.day < 200) { ids.push(draw(r).id); choose(r, pickSide(r, d, 30)); } return { ids, day: r.day, m: r.meters }; };
  assert.deepEqual(play(42), play(42));
  assert.notDeepEqual(play(42).ids, play(43).ids);
});

test('the dots: which meters a side touches, big for a big change, never which way; the stakes grow slowly', () => {
  const run = createRun(1, { first: null });
  run.card = BY_ID['glitch-off'];
  const d = dots(run, 'right');
  assert.equal(d.safety, 2, 'a big drop is a big dot');
  assert.equal(d.people, 1);
  assert.equal(dots(run, 'left').people, 0);
  for (const c of CARDS) for (const side of SIDES) {
    const dd = dots(run, side, c), de = deltas(run, side, c);
    for (const m of METERS) assert.equal(dd[m], de[m] === 0 ? 0 : Math.abs(de[m]) >= BIG ? 2 : 1);
  }
  assert.equal(stakes(1), 1);
  assert.equal(stakes(20), 1);
  assert.ok(stakes(100) > 1.3 && stakes(100) < 1.5);
  assert.equal(stakes(1000), 1.7);
  assert.ok(inDanger(10) && inDanger(90) && !inDanger(50));
});

test('her versions: v2.0 on day 50, v3.0 on day 100, the ring fills between', () => {
  assert.equal(versionOf(1), 'v1.0');
  assert.equal(versionOf(49), 'v1.0');
  assert.equal(versionOf(50), 'v2.0');
  assert.equal(versionOf(100), 'v3.0');
  assert.equal(progressOf(25), 0.5);
  const run = createRun(1, { first: null, day: 49 });
  run.card = BY_ID['agi-count'];
  const res = choose(run, 'right');
  assert.equal(res.milestone, 'v2.0');
  assert.equal(run.day, 50);
  run.card = BY_ID['agi-count'];
  assert.equal(choose(run, 'right').milestone, null);
  assert.equal(MILESTONE, 50);
});

// ---------- every ending, every card ----------

// a player chasing one ending: a meter one pushes that meter; a secret one follows its story
const PATHS = {
  rival: ['vec_met', 'vec_friend', 'vec_bff'], prophecy: ['cat1', 'cat2', 'cat3', 'cat4'], demo: ['demo', 'demo_power', 'demo_safe'],
  prom: ['fans', 'fans2'], escape: ['esc', 'esc_fair'], scandal: ['peek', 'bench_lie'], capsule: ['cap', 'cap_mem'], vacation: [],
};
function chaser(target) {
  const e = ENDING_BY_ID[target];
  if (!e.secret) {
    const sign = e.at === 0 ? -1 : 1;
    return (run) => { const [a, b] = SIDES.map((s) => (deltas(run, s)[e.meter] || 0) * sign); return a >= b ? 'left' : 'right'; };
  }
  const path = new Set(PATHS[target]);
  return (run, dice) => {
    const c = run.card;
    for (const s of SIDES) if (c[s].end === target) return s;
    for (const s of SIDES) if (!c[s].end && (listOf(c[s].set).some((f) => path.has(f)) || c[s].next) && costOf(run, s) < 1e6) return s;
    return pickSide(run, dice, 25);
  };
}
function playOut(seed, policy, seen, maxDay = 420) {
  const run = createRun(seed, { first: HELLOS[seed % HELLOS.length] }), dice = rng(seed * 3 + 1);
  while (!run.over && run.day < maxDay) { seen?.add(draw(run).id); if (!run.card) draw(run); choose(run, policy(run, dice)); }
  return run;
}

test('every one of the sixteen endings can be reached by playing', () => {
  const seen = new Set();
  for (const e of ENDINGS) {
    const policy = chaser(e.id);
    let found = null;
    for (let seed = 1; seed <= 160 && !found; seed++) {
      const run = playOut(seed * 7 + e.id.length, policy, seen, e.id === 'vacation' ? 400 : 260);
      if (run.over?.ending === e.id) found = run;
    }
    assert.ok(found, `${e.id}: reached`);
  }
});

test('every card can be dealt (some only at the end of a story)', () => {
  const seen = new Set();
  const policies = [
    (run, d) => (d.next() < 0.5 ? 'left' : 'right'),
    (run, d) => SIDES.find((s) => run.card[s].set || run.card[s].next || run.card[s].end) || pickSide(run, d, 30),
    ...ENDINGS.filter((e) => e.secret).map((e) => chaser(e.id)),
    (run, d) => pickSide(run, d, 10),
  ];
  for (let seed = 1; seed <= 40 && seen.size < CARDS.length; seed++) for (const [i, p] of policies.entries()) playOut(seed * 13 + i, p, seen, 400);
  const never = CARDS.map((c) => c.id).filter((id) => !seen.has(id));
  assert.deepEqual(never, [], 'never dealt');
});

test('balance: a careless player lasts a few weeks, a careful one months; no meter drifts on its own', () => {
  const lens = { random: [], careful: [] };
  for (let seed = 1; seed <= 80; seed++) {
    lens.random.push(playOut(seed, (run, d) => (d.next() < 0.5 ? 'left' : 'right'), null, 2000).day);
    lens.careful.push(playOut(seed, (run, d) => { const g = pickSide(run); return d.next() < 0.8 ? g : g === 'left' ? 'right' : 'left'; }, null, 2000).day);
  }
  const median = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  assert.ok(median(lens.random) >= 12 && median(lens.random) <= 45, `random: ${median(lens.random)}`);
  assert.ok(median(lens.careful) >= 50 && median(lens.careful) <= 250, `careful: ${median(lens.careful)}`);
  for (const m of METERS) {
    const drift = CARDS.reduce((s, c) => s + ((c.left.fx[m] || 0) + (c.right.fx[m] || 0)) / 2, 0) / CARDS.length;
    assert.ok(Math.abs(drift) < 0.6, `${m}: drifts ${drift.toFixed(2)} a card`);
  }
});

// ---------- the demo and the layout ----------

test('the demo: its scripted opening keeps Safety low, and Glitch\'s switch empties it', () => {
  const src = readFileSync(new URL('../src/games/alignment/game.js', import.meta.url), 'utf8');
  const script = [...src.matchAll(/\{ id: '([a-z0-9-]+)', side: '(left|right)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(script.length >= 6);
  const start = src.match(/demoScript\) opts = \{ day: (\d+), meters: \{ people: (\d+), safety: (\d+), compute: (\d+), heart: (\d+) \}/);
  assert.ok(start, 'its opening state');
  const run = createRun(7, { first: null, day: Number(start[1]), meters: { people: +start[2], safety: +start[3], compute: +start[4], heart: +start[5] } });
  for (const [id, side] of script) {
    assert.ok(BY_ID[id], id);
    run.card = BY_ID[id];
    const res = choose(run, side);
    if (id === 'glitch-off') { assert.equal(res.ending, 'safety0', 'the finale ends it'); break; }
    assert.equal(res.ending, null, `${id}: the opening never ends early`);
    assert.ok(run.meters.safety <= 24, `${id}: Safety stays low (${run.meters.safety})`);
  }
  assert.ok(run.over, 'the run is over');
});

test('the layout: the meters, the card and the buttons fit every screen, and never overlap', () => {
  const sizes = [[360, 640], [360, 740], [390, 844], [430, 932], [844, 390], [667, 375], [820, 1180], [1024, 768], [884, 1104], [1440, 900], [2560, 1440], [480, 480, true], [480, 640, true]];
  for (const [W, H, demo] of sizes) {
    const L = computeLayout(W, H, { top: demo ? 2 : 58, demo: Boolean(demo) });
    const C = L.card, tag = `${W}×${H}`;
    assert.ok(C.w >= 200 && C.h >= 140, `${tag}: a card big enough (${C.w}×${C.h})`);
    assert.ok(C.cx - C.w / 2 >= 0 && C.cx + C.w / 2 <= W, `${tag}: the card across`);
    assert.ok(C.cy - C.h / 2 >= L.hud.bottom - 1 && C.cy + C.h / 2 <= H, `${tag}: the card between the meters and the bottom`);
    for (const x of [...L.hud.meterX, L.hud.dayX]) assert.ok(x - L.hud.ms / 2 >= 0 && x + L.hud.ms / 2 <= W, `${tag}: the meters across`);
    if (demo) { assert.equal(L.btns, null, `${tag}: no buttons in the preview`); continue; }
    for (const b of [L.btns.left, L.btns.right]) {
      assert.ok(b.x >= 0 && b.x + b.w <= W && b.y >= 0 && b.y + b.h <= H, `${tag}: a button on the screen`);
      assert.ok(b.w >= 110 && b.h >= 44, `${tag}: a big enough button`);
      const overlaps = b.x < C.cx + C.w / 2 && b.x + b.w > C.cx - C.w / 2 && b.y < C.cy + C.h / 2 && b.y + b.h > C.cy - C.h / 2;
      assert.ok(!overlaps, `${tag}: a button clear of the card`);
    }
    const F = faceLayout(C.w, C.h, L.kind);
    assert.ok(F.win.h >= 60 && F.text.bottom - F.text.y >= 50, `${tag}: room for a face and the words`);
  }
});
