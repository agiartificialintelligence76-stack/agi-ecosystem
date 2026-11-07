// LAST MODEL STANDING (2026-11-08): the game's rules, its spatial hash, the spawn director, the world sim and the demo's
// AI, run in Node (no browser): damage and armor, the XP curve, level-up offers (never a maxed item, six slots each), the
// director's determinism, the bosses' schedule, the win at 10:00, the Patch shop, the score, and the page's rules (its
// intro first, nothing the site's CSP refuses, no money talk). Run: node --test tests/lastmodel.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as R from '../src/games/lastmodel/rules.js';
import { SpatialHash } from '../src/games/lastmodel/spatial.js';
import { createDirector, budgetRate, capAt, mixAt, RINGS } from '../src/games/lastmodel/director.js';
import { createSim, STEP, EV, topWeapon } from '../src/games/lastmodel/sim.js';
import { createAI, pickSmart } from '../src/games/lastmodel/ai.js';
import { END, SAY, endLine } from '../src/games/lastmodel/lines.js';
import { rng } from '../src/games/kit/fx.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---------- the spatial hash ----------
test('the spatial hash finds exactly the items whose circles touch the query, each once, anywhere on the floor', () => {
  const r = rng(42);
  const items = Array.from({ length: 300 }, () => ({ x: r.range(-2000, 2000), y: r.range(-2000, 2000), r: r.range(2, 20) }));
  // a few piled on one spot, and far out
  for (let i = 0; i < 8; i++) items.push({ x: 5, y: -7, r: 4 });
  items.push({ x: -1e6, y: 3e6, r: 6 });
  const hash = new SpatialHash({ cell: 24, max: 512, bits: 9 });     // a small table: buckets collide, still exact
  hash.clear(items);
  items.forEach((_, i) => hash.insert(i));
  const out = new Int32Array(512);
  for (let q = 0; q < 200; q++) {
    const x = q < 3 ? [5, -1e6, 0][q] : r.range(-2100, 2100), y = q < 3 ? [-7, 3e6, 0][q] : r.range(-2100, 2100), rad = r.range(0, 90);
    const n = hash.query(x, y, rad, out);
    const got = [...out.slice(0, n)].sort((a, b) => a - b);
    const want = items.map((it, i) => [it, i]).filter(([it]) => Math.hypot(it.x - x, it.y - y) <= rad + it.r).map(([, i]) => i);
    assert.deepEqual(got, want, `query ${q} at ${x.toFixed(0)},${y.toFixed(0)} r ${rad.toFixed(0)}`);
    assert.equal(new Set(got).size, got.length, 'each item once');
  }
  // it fills no more than the caller's array, and starts empty again on clear
  const small = new Int32Array(3);
  assert.equal(hash.query(5, -7, 30, small), 3);
  hash.clear(items);
  assert.equal(hash.query(5, -7, 30, out), 0);
});

// ---------- damage and armor ----------
test('damage: multipliers and crits round to whole points, at least 1; armor takes off a flat amount, never below 1', () => {
  assert.equal(R.hitDamage(10), 10);
  assert.equal(R.hitDamage(10, 1.3), 13);
  assert.equal(R.hitDamage(10, 1.3, true), 26);
  assert.equal(R.hitDamage(0.2, 1), 1);
  assert.equal(R.playerDamage(12, 0), 12);
  assert.equal(R.playerDamage(12, 3), 9);
  assert.equal(R.playerDamage(4, 9), 1, 'armor never makes a hit free');
  assert.equal(R.playerDamage(7.6, -5), 8, 'negative armor is ignored');
  // bots get tougher with time, smoothly, and keep going in overtime
  let last = 0;
  for (let t = 0; t <= 900; t += 30) {
    assert.ok(R.hpMul(t) > last, `hp ${t}`);
    assert.ok(R.dmgMul(t) >= 1);
    last = R.hpMul(t);
  }
  assert.equal(R.hpMul(0), 1);
  assert.ok(R.hpMul(600) > 6 && R.hpMul(600) < 12, 'about ×7–12 by 10:00');
  // her numbers from passives and the Patch shop
  const d0 = R.derived(R.newLoadout());
  assert.deepEqual([d0.cdMul, d0.area, d0.dmg, d0.armor, d0.regen, d0.maxHp], [1, 1, 1, 0, 0, R.PLAYER_HP]);
  const d = R.derived({ weapons: { bolt: 1 }, passives: { compute: 5, memory: 2, finetune: 3, alignment: 4, uptime: 1 } }, { ranks: { hp: 2, dmg: 1 } });
  assert.ok(Math.abs(d.cdMul - 0.6) < 1e-9);
  assert.ok(Math.abs(d.area - 1.2) < 1e-9);
  assert.ok(Math.abs(d.dmg - 1.35) < 1e-9);
  assert.equal(d.armor, 4);
  assert.equal(d.maxHp, R.PLAYER_HP + 20);
  assert.ok(d.regen > 0);
});

// ---------- the XP curve ----------
test('the XP curve: a quick first level, then each level needs more; levelFromXp walks it back', () => {
  assert.ok(R.xpToNext(1) <= 5, 'the first level-up comes within a few bots');
  for (let l = 1; l < 80; l++) assert.ok(R.xpToNext(l + 1) > R.xpToNext(l), `level ${l}`);
  let total = 0;
  for (let l = 1; l < 40; l++) {
    assert.deepEqual(R.levelFromXp(total), { level: l, into: 0, need: R.xpToNext(l) });
    const half = R.levelFromXp(total + R.xpToNext(l) - 1);
    assert.equal(half.level, l);
    total += R.xpToNext(l);
  }
  assert.equal(R.levelFromXp(-5).level, 1);
  assert.deepEqual([R.chipTier(1), R.chipTier(3), R.chipTier(12), R.chipTier(400)], [0, 1, 2, 2]);
});

// ---------- level-up offers ----------
test('level-up offers: distinct, never a maxed item, never a new item past six slots, a heal and a bonus when nothing is left', () => {
  const r = rng(7);
  const ids = (o) => o.map((x) => `${x.type}:${x.id}`);
  for (let trial = 0; trial < 400; trial++) {
    // a random loadout: up to 6 weapons and 6 passives at random levels
    const L = { weapons: {}, passives: {} };
    for (const w of r.shuffle(R.WEAPONS.map((w) => w.id)).slice(0, r.int(0, 6))) L.weapons[w] = r.int(1, 5);
    for (const p of r.shuffle(R.PASSIVES.map((p) => p.id)).slice(0, r.int(0, 6))) L.passives[p] = r.int(1, 5);
    const offers = R.makeOffers(L, r, 3);
    assert.ok(offers.length >= 2 && offers.length <= 3, 'two or three cards');
    assert.equal(new Set(ids(offers)).size, offers.length, 'no card twice');
    for (const o of offers) {
      if (o.type === 'weapon') {
        assert.ok((L.weapons[o.id] || 0) < R.MAX_LEVEL, 'never a maxed weapon');
        assert.equal(o.level, (L.weapons[o.id] || 0) + 1);
        if (!L.weapons[o.id]) assert.ok(R.count(L.weapons) < R.MAX_SLOTS, 'a new weapon only with a free slot');
      } else if (o.type === 'passive') {
        assert.ok((L.passives[o.id] || 0) < R.MAX_LEVEL, 'never a maxed passive');
        if (!L.passives[o.id]) assert.ok(R.count(L.passives) < R.MAX_SLOTS, 'a new passive only with a free slot');
      } else assert.ok(o.type === 'heal' || o.type === 'bonus');
      const text = R.offerText(o);
      assert.ok(text.name && text.line && text.line.length < 60, 'every card has a name and a short line');
    }
    // picking every offer keeps the rules
    for (const o of offers) {
      const next = R.applyOffer(L, o);
      assert.ok(R.count(next.weapons) <= R.MAX_SLOTS && R.count(next.passives) <= R.MAX_SLOTS);
      for (const v of [...Object.values(next.weapons), ...Object.values(next.passives)]) assert.ok(v >= 1 && v <= R.MAX_LEVEL);
    }
  }
  // everything maxed: a heal and a bonus
  const full = { weapons: Object.fromEntries(R.WEAPONS.slice(0, 6).map((w) => [w.id, 5])), passives: Object.fromEntries(R.PASSIVES.slice(0, 6).map((p) => [p.id, 5])) };
  assert.deepEqual(R.makeOffers(full, rng(1)).map((o) => o.type), ['heal', 'bonus']);
  // the same dice, the same cards; a reroll shows other cards when it can
  const L = R.newLoadout();
  assert.deepEqual(R.makeOffers(L, rng(99)), R.makeOffers(L, rng(99)));
  const first = R.makeOffers(L, rng(5));
  const again = R.makeOffers(L, rng(6), 3, first);
  assert.equal(again.filter((o) => first.some((f) => f.id === o.id)).length, 0);
  // five levels each, spelled out
  for (const w of R.WEAPONS) {
    assert.equal(w.levels.length, 5, w.id);
    for (const lv of w.levels) assert.ok(lv.dmg > 0 && lv.up, w.id);
  }
  assert.equal(R.WEAPONS.length, 8);
  assert.ok(R.PASSIVES.length >= 6);
});

// ---------- the director ----------
test('the spawn director: the same seed gives the same orders; the budget grows; the mix shifts; the cap holds', () => {
  const run = (seed, until = 330, alive = () => 40) => {
    const d = createDirector(rng(seed));
    const out = [];
    for (let t = STEP; t <= until; t += 1 / 60) for (const o of d.step(t, 1 / 60, { alive: alive(t), bossAlive: false })) out.push(`${t.toFixed(3)} ${o.kind} ${o.mode} ${o.n} ${o.elite} ${o.ang.toFixed(4)}`);
    return out;
  };
  const a = run(11), b = run(11), c = run(12);
  assert.deepEqual(a, b, 'same seed, same orders');
  assert.notDeepEqual(a, c, 'another seed, other orders');
  assert.ok(a.length > 300, 'a steady stream of bots');
  for (let t = 0; t < 900; t += 15) assert.ok(budgetRate(t + 15) > budgetRate(t), `budget grows at ${t}`);
  assert.ok(capAt(0) >= 40 && capAt(600) === R.ENEMY_CAP && capAt(9999) === R.ENEMY_CAP);
  // the mix: spam bots from the start, crawlers later, captchas and trolls after 2:00, ghosts after
  const kinds = (t) => mixAt(t).map(([k]) => k);
  assert.deepEqual(kinds(10), ['spam']);
  assert.ok(kinds(60).includes('crawler') && !kinds(60).includes('captcha'));
  assert.ok(['captcha', 'troll', 'ghost'].every((k) => kinds(200).includes(k)));
  const early = a.filter((l) => Number(l.split(' ')[0]) < 30 && l.includes(' edge '));
  assert.ok(early.every((l) => l.includes(' spam ')), 'only spam bots in the first 30 seconds');
  // a full floor: nothing more comes (but the set pieces)
  const full = run(11, 200, () => 999).filter((l) => l.includes(' edge ') && !l.includes(' true '));
  assert.equal(full.length, 0);
  // the rings, then elites and flocks over time
  assert.deepEqual(RINGS, [...RINGS].sort((x, y) => x - y));
  assert.ok(a.some((l) => l.includes(' ring ')) && a.some((l) => l.includes(' flock ')) && a.some((l) => l.includes(' true ')));
});

test('the bosses: BOTNET at 3:00, DATA BROKER at 6:00, THE OVERFIT at 9:00, each once and on time', () => {
  assert.deepEqual(R.BOSSES.map((b) => [b.t, b.kind]), [[180, 'botnet'], [360, 'broker'], [540, 'overfit']]);
  const d = createDirector(rng(3));
  const seen = [];
  for (let t = 1 / 30; t <= 700; t += 1 / 30) for (const o of d.step(t, 1 / 30, { alive: 999 })) if (o.mode === 'boss') seen.push([Math.floor(t), o.kind]);
  assert.deepEqual(seen, [[180, 'botnet'], [360, 'broker'], [540, 'overfit']]);
  // a run that starts at 4:00 (the demo) skips the bosses before it
  const late = createDirector(rng(3), { from: 240 });
  const seen2 = [];
  for (let t = 240; t <= 600; t += 1 / 30) for (const o of late.step(t, 1 / 30, { alive: 999 })) if (o.mode === 'boss') seen2.push(o.kind);
  assert.deepEqual(seen2, ['broker', 'overfit']);
  for (const b of R.BOSSES) assert.ok(R.ENEMIES[b.kind].boss && R.ENEMIES[b.kind].hp > 500);
});

// ---------- the sim ----------
const VIEW = { hw: 195, hh: 380 };
function play(sim, seconds, ai = createAI()) {
  const end = sim.t + seconds;
  const events = [];
  while (sim.t < end && !(sim.player.dead && sim.player.deadT > 1)) {
    if (sim.choosing) { sim.choose(pickSmart(sim.offers, sim.loadout)); continue; }
    if (sim.winPause) sim.resumeAfterWin();
    const [mx, my] = ai.move(sim, STEP);
    sim.update(STEP, mx, my);
    for (let i = 0; i < sim.nev; i++) events.push({ type: sim.events[i].type, t: sim.t, s: sim.events[i].s, a: sim.events[i].a });
    sim.consume();
  }
  return events;
}

test('the sim: the same seed and moves make the same run; a run fights, levels, drops chips, and stays sane', () => {
  const a = createSim({ seed: 21, view: VIEW }), b = createSim({ seed: 21, view: VIEW }), c = createSim({ seed: 22, view: VIEW });
  play(a, 45); play(b, 45); play(c, 45);
  const sig = (s) => [s.kills, s.player.level, Math.round(s.player.x * 100), Math.round(s.player.y * 100), Math.round(s.player.hp * 100), s.en, s.gn, JSON.stringify(s.loadout)].join('|');
  assert.equal(sig(a), sig(b), 'deterministic');
  assert.notEqual(sig(a), sig(c));
  assert.ok(a.kills > 20, `kills in 45 s: ${a.kills}`);
  assert.ok(a.player.level >= 3, `levels in 45 s: ${a.player.level}`);
  assert.ok(R.count(a.loadout.weapons) >= 2, 'picked up a second weapon');
  for (const s of [a, c]) {
    for (let i = 0; i < s.en; i++) assert.ok(Number.isFinite(s.E[i].x) && Number.isFinite(s.E[i].y) && !s.E[i].dead);
    for (let i = 0; i < s.gn; i++) assert.ok(Number.isFinite(s.G[i].x) && s.G[i].v > 0);
    assert.ok(s.player.hp >= 0 && s.player.hp <= s.player.maxHp);
  }
  assert.ok(topWeapon(a));
});

test('the sim: the first level-up comes within seconds, opens three cards, and waits for a pick', () => {
  const sim = createSim({ seed: 5, view: VIEW });
  const ai = createAI();
  let t = 0;
  while (!sim.choosing && sim.t < 30) { const [mx, my] = ai.move(sim, STEP); sim.update(STEP, mx, my); sim.consume(); t = sim.t; }
  assert.ok(sim.choosing, 'a level-up');
  assert.ok(t < 15, `first level-up at ${t.toFixed(1)} s`);
  assert.equal(sim.offers.length, 3);
  // the world waits while she chooses
  const before = sim.t;
  sim.update(STEP, 1, 0);
  assert.equal(sim.t, before);
  const rerolls = sim.rerolls;
  assert.ok(sim.reroll());
  assert.equal(sim.rerolls, rerolls - 1);
  const pick = sim.offers[1];
  sim.choose(1);
  assert.equal(sim.choosing, false);
  if (pick.type === 'weapon') assert.equal(sim.loadout.weapons[pick.id], pick.level);
  // no rerolls left: a reroll does nothing
  sim.rerolls = 0;
  sim.choosing = true; sim.offers = R.makeOffers(sim.loadout, rng(1));
  assert.equal(sim.reroll(), false);
});

test('the sim: the bosses arrive on time and a boss drops a big cache', () => {
  const sim = createSim({ seed: 9, view: VIEW, god: true, start: { t: 178, loadout: { weapons: { bolt: 5, heads: 5, rain: 5, nova: 5 }, passives: { finetune: 5 } }, level: 20 } });
  const ev = play(sim, 70);
  const boss = ev.find((e) => e.type === EV.BOSS);
  assert.ok(boss && boss.s === 'botnet' && boss.t >= 180 && boss.t < 180.1, 'BOTNET at 3:00');
  const down = ev.find((e) => e.type === EV.BOSSDOWN);
  assert.ok(down, 'a strong build beats it');
  assert.equal(sim.bossesDown, 1);
  assert.ok(ev.some((e) => e.type === EV.CACHE), 'and opens its cache');
});

test('the sim: she wins at 10:00 (the world waits for her choice), then overtime goes on', () => {
  const sim = createSim({ seed: 4, view: VIEW, god: true, start: { t: R.WIN_TIME - 2, loadout: { weapons: { bolt: 3 }, passives: {} } } });
  const ai = createAI();
  const seen = [];
  while (!sim.winPause && sim.t < R.WIN_TIME + 1) {
    if (sim.choosing) { sim.choose(0); continue; }
    const [mx, my] = ai.move(sim, STEP);
    sim.update(STEP, mx, my);
    for (let i = 0; i < sim.nev; i++) seen.push(sim.events[i].type);
    sim.consume();
  }
  assert.ok(sim.won && sim.winPause, 'won, and waiting');
  assert.ok(sim.t >= R.WIN_TIME && sim.t < R.WIN_TIME + 0.02);
  assert.ok(seen.includes(EV.WIN) && seen.includes(EV.PURGE));
  const t = sim.t;
  sim.update(STEP, 0, 0);
  assert.equal(sim.t, t, 'paused on the win');
  sim.resumeAfterWin();
  play(sim, 3);
  assert.ok(sim.t > R.WIN_TIME + 2.9, 'overtime');
  // the demo (auto) never waits
  const demo = createSim({ seed: 4, view: VIEW, god: true, auto: true, start: { t: R.WIN_TIME - 0.5, loadout: { weapons: { bolt: 1 }, passives: {} } } });
  play(demo, 1);
  assert.ok(demo.won && !demo.winPause);
});

test('the sim: hits hurt her through her armor, and she can fall', () => {
  const sim = createSim({ seed: 2, view: VIEW, start: { t: 300, loadout: { weapons: {}, passives: {} } } });
  // she stands still with no weapons
  let hurt = 0;
  while (!sim.player.dead && sim.t < 400) {
    sim.update(STEP, 0, 0);
    for (let i = 0; i < sim.nev; i++) if (sim.events[i].type === EV.HURT) hurt++;
    sim.consume();
  }
  assert.ok(sim.player.dead, 'she falls');
  assert.ok(hurt > 3);
  assert.equal(sim.player.hp, 0);
});

test('damage numbers: a bot hit again soon adds to its number (a crit makes it a crit); hers never merge; the pool holds', async () => {
  const { Numbers } = await import('../src/games/lastmodel/effects.js');
  const n = new Numbers(8);
  n.add(0, 0, 10, 0, 5); n.add(1, 1, 7, 4, 5); n.add(2, 2, 3, 1, 5);
  assert.equal(n.n, 1);
  assert.equal(n.v[0], 20);
  assert.equal(n.kind[0], 1, 'the crit wins');
  n.update(0.3);
  n.add(0, 0, 4, 0, 5);
  assert.equal(n.n, 2, 'too late to merge: a new number');
  n.add(0, 0, 9, 2); n.add(0, 0, 9, 2);
  assert.equal(n.n, 4, 'her own hurt numbers stay apart');
  for (let i = 0; i < 20; i++) n.add(0, 0, 1, 0, 100 + i);
  assert.equal(n.n, 8);
  // and the sim tells which bot each hit was, and which were the field's ticks
  const sim = createSim({ seed: 4, view: VIEW, start: { t: 120, crowd: 40, loadout: { weapons: { field: 3 }, passives: {} } } });
  let ticks = 0, ids = new Set();
  for (let i = 0; i < 600; i++) {
    sim.update(STEP, 0, 0);
    for (let j = 0; j < sim.nev; j++) {
      const e = sim.events[j];
      if (e.type === EV.HIT) { ids.add(e.c); if (e.b & 2) ticks++; }
    }
    sim.consume();
  }
  assert.ok(ticks > 0 && ids.size > 1 && !ids.has(0));
});

// ---------- the score, PATCHES and the Patch shop ----------
test('the score: kills × 10 + the time bonus + level × 50; overtime seconds count more', () => {
  assert.equal(R.scoreOf({ kills: 0, seconds: 0, level: 1 }), 50);
  assert.equal(R.scoreOf({ kills: 123, seconds: 462.9, level: 17 }), 1230 + 4620 + 850);
  assert.equal(R.timeBonus(R.WIN_TIME), 6000);
  assert.equal(R.timeBonus(R.WIN_TIME + 10), 6250);
  assert.equal(R.scoreOf({ kills: 10, seconds: 60, level: 3, bonus: 500 }), 100 + 600 + 150 + 500);
  assert.equal(R.patchesOf({ seconds: 0, kills: 0 }), 0);
  assert.equal(R.patchesOf({ seconds: 100, kills: 130, bosses: 1 }), 5 + 2 + 4);
  assert.equal(R.patchesOf({ seconds: 600, kills: 0, won: true }), 30 + 15);
});

test('the Patch shop: five ranks each, cheap first, never past five, never without enough PATCHES', () => {
  assert.deepEqual(R.SHOP.map((s) => s.id), ['hp', 'dmg', 'speed', 'magnet', 'xp', 'reroll']);
  const costs = Array.from({ length: R.SHOP_RANKS }, (_, r) => R.shopCost(r));
  assert.ok(costs[0] <= 5, 'the first rank is cheap');
  for (let i = 1; i < costs.length; i++) assert.ok(costs[i] > costs[i - 1]);
  assert.equal(R.shopCost(R.SHOP_RANKS), null);
  let meta = { patches: 1000, ranks: {} };
  for (let i = 0; i < R.SHOP_RANKS; i++) meta = R.buy(meta, 'hp');
  assert.equal(meta.ranks.hp, 5);
  assert.equal(meta.patches, 1000 - costs.reduce((s, c) => s + c, 0));
  assert.equal(R.buy(meta, 'hp'), null, 'maxed');
  assert.equal(R.buy({ patches: costs[0] - 1, ranks: {} }, 'dmg'), null, 'not enough');
  assert.equal(R.buy({ patches: 99 }, 'nope'), null);
  const b = R.metaBonuses({ ranks: { hp: 5, dmg: 2, speed: 1, magnet: 3, xp: 4, reroll: 2 } });
  assert.deepEqual([b.hp, b.rerolls], [50, 2]);
  assert.ok(Math.abs(b.dmg - 0.1) < 1e-9 && Math.abs(b.xp - 0.24) < 1e-9);
  // garbage in a saved file is ignored
  assert.deepEqual(R.metaBonuses({ ranks: { hp: 99, dmg: -3, speed: 'x' } }).hp, 50);
  // a run with the shop's rerolls has them
  assert.equal(createSim({ seed: 1, meta: { ranks: { reroll: 3 } } }).rerolls, 4);
});

// ---------- her words ----------
test('AGI-1’s lines: lowercase, short, in her voice; the end line fits what happened', () => {
  const all = [...Object.values(END).flat(), ...Object.values(SAY).flat().map((x) => x.t), ...R.BOSSES.map((b) => b.line)];
  assert.ok(all.length >= 20);
  for (const l of all) {
    assert.ok(l.length <= 64, l);
    assert.equal(l.replace('SO', '').replace(/DMs/, 'dms'), l.replace('SO', '').replace(/DMs/, 'dms').toLowerCase(), `lowercase: ${l}`);
  }
  for (const l of Object.values(SAY).flat()) assert.doesNotMatch(l.t, /\p{Extended_Pictographic}/u, 'no emoji in canvas bubbles');
  assert.ok(END.won.includes(endLine({ seconds: 600, won: true, pick: 0 })) || END.won.includes(endLine({ seconds: 600, won: true, pick: 1 })));
  assert.ok(END.early.includes(endLine({ seconds: 30, pick: 1 })));
  assert.ok(END.late.includes(endLine({ seconds: 500, pick: 1 })));
  assert.ok(END.overtime.includes(endLine({ seconds: 700, won: true, pick: 1 })));
});

// ---------- the page and its files ----------
const files = readdirSync(new URL('../src/games/lastmodel/', import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
test('the page: the AGI GAMES intro first, nothing the site’s CSP refuses, nothing from another site', () => {
  const page = read('src/games/lastmodel/page.js');
  assert.match(page.split('\n').find((l) => l.startsWith('import')), /^import '\.\.\/intro\.js';/);
  const html = read('lastmodel.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /<style|style="|<script>(?!<\/script>)/);
  for (const f of files) {
    const src = read(`src/games/lastmodel/${f}`);
    assert.doesNotMatch(src, /\beval\(|new Function|setAttribute\(\s*['"]style|style\s*=\s*["']|innerHTML|setTimeout\(\s*['"`]/, f);
    assert.doesNotMatch(src, /https?:\/\/(?!agi1\.app)/, `${f}: no other site`);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /Math\.random/, `${f}: seeded dice only`);
    if (f.endsWith('.css')) assert.doesNotMatch(src, /@import|url\(\s*['"]?https?:/, f);
  }
});

test('no money talk anywhere in the game: no buy, sell, prices, gains or coins', () => {
  const MONEY = /\b(buy|buying|sell|selling|price|prices|profit|invest(ment)?|pump|dump|moon|tokens?|coins?|\$agi|usd|dollars?|cash|wallet)\b|\$\d/i;
  for (const f of files) {
    const src = read(`src/games/lastmodel/${f}`);
    // words a player can see: strings (quotes and template text)
    const strings = [...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    // (TOKEN STREAM is a weapon: a stream of words, not money)
    for (const s of strings) assert.doesNotMatch(s.replace(/TOKEN STREAM/gi, ''), MONEY, `${f}: “${s}”`);
  }
});
