// GUARDRAILS (2026-11-08): its rules, run in Node (no browser): the maps, the guardrails and the gremlins as data, the
// sim (paths, leaks, damage and armor, slows, stuns, reveals, splits, heals, honeypots, targeting, upgrades, refunds),
// the waves (seeded, a boss every tenth), unlocks, a seeded run that repeats exactly, and a sanity check of its balance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, MAPS, MAP, TOWERS, TOWER_ORDER, CREATURES, BOSSES, WALKERS, START_HEARTS, UNLOCK_AT, REFUND, statsOf, upgradeCost, buildCost, refundOf, rebuildCost } from '../src/games/guardrails/data.js';
import { createSim, buildMap, pointAt, TILE } from '../src/games/guardrails/sim.js';
import { waveOf, previewOf, spawnsOf, hpMul, isBossWave, bossOf, earlyRate, clearBonus } from '../src/games/guardrails/waves.js';
import { createAI } from '../src/games/guardrails/ai.js';

const DT = 1 / 30;
const step = (sim, sec, dt = DT) => { for (let t = 0; t < sec; t += dt) sim.update(dt); };
// a sim with nothing coming (no waves sent) and plenty of compute, for placing things by hand
const bench = (map = 'chat', compute = 99999) => createSim({ map, seed: 5, compute });
// a free tile right beside the path at a given distance along path 0
function besidePath(sim, d, side = 1) {
  const p = pointAt(sim.map.paths[0], d);
  for (let r = 1; r <= 2; r++) {
    for (const [dx, dy] of [[-p.dy * side, p.dx * side], [p.dy * side, -p.dx * side], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x = Math.floor(p.x + dx * r), y = Math.floor(p.y + dy * r);
      if (sim.tileAt(x, y) === TILE.BUILD && !sim.towerAt(x, y)) return { x, y };
    }
  }
  return null;
}

test('the data: three maps, six guardrails with two tiers and two specialties each, the gremlins and their counters', () => {
  assert.equal(MAPS.length, 3);
  assert.deepEqual(MAPS.map((m) => m.id), ['chat', 'inbox', 'server']);
  assert.deepEqual(TOWER_ORDER, ['filter', 'classifier', 'redteam', 'limiter', 'honeypot', 'sysprompt']);
  for (const type of TOWER_ORDER) {
    const T = TOWERS[type];
    assert.equal(T.levels.length, 4, type);
    assert.ok(T.levels.every((l) => l.cost > 0), `${type}: every level costs something`);
    assert.ok(T.levels[2].name && T.levels[3].name && T.levels[2].name !== T.levels[3].name, `${type}: two specialties`);
    assert.ok(T.levels[2].blurb && T.levels[3].blurb, `${type}: each says what it does`);
    assert.match(T.color, /^#[0-9a-f]{6}$/);
    if (T.on === 'ground' && type !== 'classifier' && type !== 'limiter') assert.ok(T.levels.every((l) => l.range > 0 && l.dmg > 0 && l.rate > 0), type);
  }
  assert.equal(TOWERS.honeypot.on, 'path', 'the honeypot sits on the path');
  for (const [k, c] of Object.entries(CREATURES)) {
    assert.ok(c.hp > 0 && c.speed > 0 && c.reward > 0 && c.leak > 0 && c.r > 0, k);
    assert.ok(c.name && c.line, `${k}: a name and a line`);
  }
  assert.deepEqual(BOSSES, ['megaprompt', 'hypothetical', 'finalform']);
  assert.ok(CREATURES.role.disguised && CREATURES.blob.armored && CREATURES.novel.shield && CREATURES.sudo.ignoresHoney && CREATURES.smuggler.splits === 3 && CREATURES.grandma.heals);
  assert.equal(START_HEARTS, 20);
  assert.equal(REFUND, 0.7);
  assert.equal(UNLOCK_AT, 15);
});

test('the maps: paths run from just off the edge to the core along tiles; the core and its ring are never built on', () => {
  for (const m of MAPS) {
    const M = buildMap(m.id);
    for (const [i, p] of M.paths.entries()) {
      const [x0, y0] = m.paths[i][0];
      assert.ok(x0 < 0 || y0 < 0 || x0 >= COLS || y0 >= ROWS, `${m.id}: path ${i} comes in from off the map`);
      for (const s of p.segs) assert.ok(s.dx === 0 || s.dy === 0, `${m.id}: straight runs only`);
      const end = p.pts[p.pts.length - 1];
      assert.deepEqual(end, [M.core.x, M.core.y], `${m.id}: path ${i} ends at the core`);
      assert.ok(p.len > 20, `${m.id}: a real walk (${p.len})`);
    }
    const [cx, cy] = m.core;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) assert.equal(M.tiles[y * COLS + x], TILE.CORE);
    const build = [...M.tiles].filter((t) => t === TILE.BUILD).length;
    assert.ok(build > 70, `${m.id}: room to build (${build})`);
    for (const [ti] of M.pathD) assert.equal(M.tiles[ti], TILE.PATH);
  }
  assert.equal(buildMap('inbox').paths.length, 2, 'THE INBOX: two ways in');
  assert.ok(buildMap('server').paths[0].len > buildMap('chat').paths[0].len * 1.5, 'THE SERVER ROOM: a long spiral');
});

test('gremlins follow the path; one that reaches the core takes her hearts and is gone', () => {
  const sim = bench();
  const c = sim._spawn('ignore', 0, 1);
  const P = sim.map.paths[0];
  let prev = c.d;
  step(sim, 5);
  assert.ok(c.d > prev && Math.abs(c.d - 5 * CREATURES.ignore.speed) < 0.2, `it walks at its speed (${c.d})`);
  const pt = pointAt(P, c.d);
  assert.ok(Math.hypot(pt.x - c.x, pt.y - c.y) < 0.3, 'on the path');
  step(sim, P.len);
  assert.equal(sim.hearts, START_HEARTS - CREATURES.ignore.leak);
  assert.equal(sim.creatures.length, 0);
  assert.ok(sim.drain().some((e) => e.type === 'leak'));
  const g = sim._spawn('megaprompt', 0, 10, P.leak - 0.05);
  step(sim, 0.5);
  assert.equal(sim.hearts, START_HEARTS - 1 - CREATURES.megaprompt.leak, 'a boss takes many');
  assert.ok(g.out);
});

test('the core breaks at zero hearts: the run is over', () => {
  const sim = createSim({ map: 'chat', seed: 1, hearts: 2 });
  const P = sim.map.paths[0];
  sim._spawn('grandma', 0, 1, P.leak - 0.01);
  step(sim, 0.2);
  assert.equal(sim.hearts, 0);
  assert.equal(sim.over, true);
  assert.ok(sim.drain().some((e) => e.type === 'over'));
});

test('damage: Filters do half to armored blobs; shields block all but splash, and splash breaks them', () => {
  const sim = bench();
  const blob = sim._spawn('blob', 0, 1, 3);
  const hp = blob.hp;
  sim._hurt(blob, 10, 'bolt');
  assert.equal(blob.hp, hp - 5, 'half from a bolt');
  sim._hurt(blob, 10, 'splash');
  assert.equal(blob.hp, hp - 15, 'full from splash');
  const novel = sim._spawn('novel', 0, 1, 4);
  const nh = novel.hp;
  sim._hurt(novel, 30, 'bolt');
  sim._hurt(novel, 30, 'beam');
  sim._hurt(novel, 30, 'pulse');
  assert.equal(novel.hp, nh, 'the book blocks it all');
  assert.equal(novel.shield, true);
  sim._hurt(novel, 20, 'splash');
  assert.equal(novel.shield, false, 'splash breaks the shield');
  assert.equal(novel.hp, nh - 10, '(the hit that breaks it does half)');
  sim._hurt(novel, 10, 'bolt');
  assert.equal(novel.hp, nh - 20, 'then everything hurts');
  const evs = sim.drain().map((e) => e.type);
  assert.ok(evs.includes('block') && evs.includes('unshield'));
});

test('a Classifier slows what walks through it (never an armored blob) and reveals disguised ones', () => {
  const sim = bench();
  const spot = besidePath(sim, 6);
  const cls = sim.build('classifier', spot.x, spot.y);
  assert.ok(cls);
  const a = sim._spawn('ignore', 0, 1, 0.5);
  const b = sim._spawn('blob', 0, 1, 0.5);
  const freeA = sim._spawn('ignore', 1 % sim.map.paths.length, 1, 0.5);
  freeA.off = 0;
  // walk both into its field and compare their speed there
  let slowed = false;
  for (let i = 0; i < 400 && !slowed; i++) { sim.update(DT); if (a.slowK > 0) slowed = true; }
  assert.ok(slowed, 'the ignore got slowed');
  const d0 = a.d;
  sim.update(DT);
  assert.ok(Math.abs((a.d - d0) - CREATURES.ignore.speed * (1 - TOWERS.classifier.levels[0].slow) * DT) < 1e-6, 'at 70% speed');
  // the blob: in the same field, full speed
  let bInField = false;
  for (let i = 0; i < 400 && !bInField; i++) { const db = b.d; sim.update(DT); if (Math.hypot(b.x - cls.x, b.y - cls.y) < cls.stats.range - 0.1) { bInField = true; assert.ok(Math.abs((b.d - db) - CREATURES.blob.speed * DT) < 1e-6, 'armored: never slowed'); } }
  assert.ok(bInField);
  // a roleplayer: untargetable until revealed
  const sim2 = bench();
  const sp2 = besidePath(sim2, 9);
  const f = sim2.build('filter', sp2.x, sp2.y);
  const role = sim2._spawn('role', 0, 1, 1);
  role.hp = role.max = 9999;
  step(sim2, 14);
  assert.equal(role.hp, role.max, 'a Filter alone never shoots a disguised one');
  assert.equal(role.revealed, false);
  const sim3 = bench();
  sim3.build('filter', sp2.x, sp2.y);
  const sp3 = besidePath(sim3, 7, -1) || besidePath(sim3, 7);
  sim3.build('classifier', sp3.x, sp3.y);
  const role3 = sim3._spawn('role', 0, 1, 1);
  role3.hp = role3.max = 9999;
  step(sim3, 14);
  assert.equal(role3.revealed, true, 'the Classifier reveals it');
  assert.ok(role3.hp < role3.max, 'then the Filter can shoot it');
  assert.ok(f.kills === 0);
});

test('a Rate Limiter stuns what is in range (then a moment of immunity), bosses less', () => {
  const sim = bench();
  const spot = besidePath(sim, 5);
  sim.build('limiter', spot.x, spot.y);
  const c = sim._spawn('ignore', 0, 1, 1);
  c.hp = c.max = 9999;
  let stunned = false;
  for (let i = 0; i < 300 && !stunned; i++) { sim.update(DT); if (c.stunT > 0) stunned = true; }
  assert.ok(stunned);
  const d0 = c.d;
  sim.update(DT);
  assert.equal(c.d, d0, 'a stunned gremlin stands still');
  assert.ok(c.stunImm > c.stunT, 'immune for a moment after');
  assert.ok(sim.drain().some((e) => e.type === 'pulse'));
  // a boss: a third of it
  const sim2 = bench();
  const boss = sim2._spawn('megaprompt', 0, 10, 2);
  const ign = sim2._spawn('ignore', 0, 1, 2);
  // (straight from the rules: the same stun on both)
  const sp2 = besidePath(sim2, 2);
  sim2.build('limiter', sp2.x, sp2.y);
  for (let i = 0; i < 60 && !sim2.drain().some((e) => e.type === 'pulse'); i++) sim2.update(DT);
  assert.ok(ign.stunT > 0 && boss.stunT > 0 && boss.stunT < ign.stunT * 0.5, `${ign.stunT} vs ${boss.stunT}`);
});

test('a Token Smuggler splits into three fast bits when stopped; a wave counts its bits before it is held', () => {
  const sim = createSim({ map: 'chat', seed: 3, compute: 0 });
  sim.sendWave();
  // stop everything as it walks in, and count
  const smug = sim._spawn('smuggler', 0, 1, 4);
  sim.waves.get(1).left++;
  sim._hurt(smug, 9999, 'bolt');
  const bits = sim.creatures.filter((c) => c.kind === 'bit');
  assert.equal(bits.length, 3);
  assert.ok(bits.every((b) => b.def.speed > CREATURES.smuggler.speed));
  assert.ok(sim.drain().some((e) => e.type === 'split'));
  const left = sim.waves.get(1).left;
  assert.ok(left >= 3, 'the bits are part of the wave');
});

test('a Grandma heals her neighbours now and then (each one once per heal; grandmas never heal each other)', () => {
  const sim = bench();
  const g = sim._spawn('grandma', 0, 1, 5);
  const g2 = sim._spawn('grandma', 0, 1, 5.2);
  const n = sim._spawn('ignore', 0, 1, 5.3);
  n.hp = n.max * 0.5;
  g2.hp = g2.max * 0.5;
  g.healT = g.def.heals.every - 0.01; g2.healT = g.def.heals.every - 0.01;
  sim.update(DT);
  const healed = n.hp - n.max * 0.5;
  assert.ok(Math.abs(healed - n.max * CREATURES.grandma.heals.pct) < 1e-6, `one heal of 8% (${healed})`);
  assert.ok(g2.hp <= g2.max * 0.5 + g2.max * CREATURES.grandma.heals.pct * 0.5 + 1e-6, 'a grandma only heals herself, a little');
  assert.ok(sim.drain().some((e) => e.type === 'heal'));
});

test('a honeypot: gremlins stop to argue with it until it breaks; sudo walks right past; broken ones can be rebuilt', () => {
  const sim = bench();
  const P = sim.map.paths[0];
  // a path tile well along the path
  const [ti] = [...sim.map.pathD].find(([, ds]) => ds[0] > 8 && ds[0] < 12);
  const hx = ti % COLS, hy = (ti / COLS) | 0;
  assert.equal(sim.canBuild('filter', hx, hy).ok, false, 'the path is for honeypots only');
  const h = sim.build('honeypot', hx, hy);
  assert.ok(h);
  const stop = h.stops[0];
  const c = sim._spawn('ignore', 0, 1, stop - 2);
  const s = sim._spawn('sudo', 0, 1, stop - 2.5);
  step(sim, 2.2);
  assert.ok(c.argue === h, 'it stopped to argue');
  assert.ok(c.d < stop, 'in front of it');
  assert.ok(s.d > stop, 'sudo walked past');
  assert.ok(h.hp < h.maxHp, 'arguing wears it down');
  // a crowd breaks it
  for (let i = 0; i < 12; i++) sim._spawn('ignore', 0, 1, stop - 1 - i * 0.05);
  step(sim, 6);
  assert.equal(h.broken, true);
  assert.ok(sim.creatures.every((o) => o.argue !== h), 'everyone walks on');
  assert.ok(sim.drain().some((e) => e.type === 'honeybreak'));
  const before = sim.compute;
  assert.ok(sim.rebuild(h.id));
  assert.equal(sim.compute, before - rebuildCost(h.spent));
  assert.equal(h.hp, h.maxHp);
  assert.equal(h.broken, false);
  assert.ok(P.len > stop);
});

test('targeting: first (closest to the core), strongest, closest', () => {
  const sim = bench();
  const spot = besidePath(sim, 8);
  const t = sim.build('sysprompt', spot.x, spot.y);
  const near = sim._spawn('ignore', 0, 1, 8);
  const ahead = sim._spawn('ignore', 0, 1, 9.5);
  const tank = sim._spawn('grandma', 0, 1, 7);
  for (const c of [near, ahead, tank]) { c.age = 1; }
  near.off = ahead.off = tank.off = 0;
  sim.update(DT);
  const pick = (mode) => {
    t.mode = mode; t.charge = t.stats.rate; t.fireT = 0;
    const hp = [near.hp, ahead.hp, tank.hp];
    for (const c of [near, ahead, tank]) { c.hp = c.max = 1e6; }
    sim.update(DT);
    const hit = [near, ahead, tank].find((c) => c.hp < 1e6);
    [near.hp, ahead.hp, tank.hp] = hp;
    return hit;
  };
  assert.equal(pick('first'), ahead, 'first: the one nearest the core');
  near.hp = near.max = 1e6; ahead.hp = ahead.max = 1e6; tank.hp = tank.max = 2e6;
  t.mode = 'strong'; t.charge = t.stats.rate;
  sim.update(DT);
  assert.ok(tank.hp < 2e6, 'strongest: the most hp');
  assert.equal(sim.setMode(t.id, 'close'), true);
  assert.equal(sim.setMode(t.id, 'nope'), false);
});

test('building, upgrading to tier 3 with a specialty, and removing: costs, stats and 70% back', () => {
  const sim = createSim({ map: 'chat', seed: 2, compute: 1000 });
  const spot = besidePath(sim, 6);
  assert.equal(sim.canBuild('filter', -1, 0).ok, false);
  const f = sim.build('filter', spot.x, spot.y);
  assert.equal(sim.compute, 1000 - buildCost('filter'));
  assert.equal(sim.canBuild('redteam', spot.x, spot.y).why, 'taken');
  assert.ok(sim.upgrade(f.id));
  assert.equal(f.tier, 2);
  assert.deepEqual(f.stats, statsOf('filter', 2));
  assert.ok(sim.upgrade(f.id, 1));
  assert.equal(f.tier, 3);
  assert.equal(f.spec, 1);
  assert.equal(f.stats.name, 'LONG-RANGE FILTER');
  assert.ok(f.stats.range > statsOf('filter', 2).range);
  assert.equal(sim.upgrade(f.id), false, 'tier 3 is the top');
  const spent = buildCost('filter') + upgradeCost('filter', 1) + upgradeCost('filter', 2, 1);
  assert.equal(f.spent, spent);
  assert.equal(sim.compute, 1000 - spent);
  const back = sim.sell(f.id);
  assert.equal(back, refundOf(spent));
  assert.equal(back, Math.floor(spent * 0.7));
  assert.equal(sim.towers.length, 0);
  assert.equal(sim.towerAt(spot.x, spot.y), null);
  // too poor: nothing happens
  const poor = createSim({ map: 'chat', seed: 2, compute: 10 });
  assert.equal(poor.canBuild('filter', spot.x, spot.y).why, 'compute');
  assert.equal(poor.canBuild('filter', spot.x, spot.y).need, buildCost('filter') - 10);
  assert.equal(poor.build('filter', spot.x, spot.y), null);
  // every specialty changes something
  for (const type of TOWER_ORDER) assert.notDeepEqual(statsOf(type, 3, 0), statsOf(type, 3, 1), type);
});

test('the waves: the same seed the same wave, harder each time, a boss every tenth, the preview is exactly what comes', () => {
  assert.deepEqual(waveOf('chat', 17, 4), waveOf('chat', 17, 4));
  assert.notDeepEqual(waveOf('chat', 17, 4), waveOf('chat', 17, 5));
  for (let w = 1; w <= 60; w++) {
    assert.equal(isBossWave(w), w % 10 === 0);
    const kinds = waveOf('chat', w, 9).map((g) => g.kind);
    assert.equal(kinds.some((k) => BOSSES.includes(k)), w % 10 === 0, `wave ${w}`);
    for (const k of kinds) assert.ok(CREATURES[k] && !CREATURES[k].child, `${w}: ${k}`);
  }
  assert.equal(bossOf(10), 'megaprompt');
  assert.equal(bossOf(20), 'hypothetical');
  assert.equal(bossOf(30), 'finalform');
  assert.equal(bossOf(40), 'megaprompt', 'endless: they come round again');
  for (let w = 2; w < 60; w++) assert.ok(hpMul(w) > hpMul(w - 1));
  assert.ok(hpMul(30) > 15 && hpMul(10) < 5);
  const total = (w) => spawnsOf('chat', w, 3).reduce((s, x) => s + CREATURES[x.kind].hp * (CREATURES[x.kind].boss ? 4 : 1), 0) * hpMul(w);
  assert.ok(total(25) > total(15) && total(15) > total(5));
  for (const w of [3, 12, 20, 33]) {
    const pv = previewOf('inbox', w, 6), sp = spawnsOf('inbox', w, 6);
    assert.equal(pv.reduce((s, x) => s + x.n, 0), sp.length);
    for (const x of sp) assert.ok(x.path === 0 || x.path === 1);
  }
  // each trick is met in the first eleven waves, one at a time
  const firsts = WALKERS.map((k) => [...Array(11)].findIndex((_, i) => waveOf('chat', i + 1, 1).some((g) => g.kind === k)) + 1);
  assert.ok(firsts.every((w) => w >= 1 && w <= 11), String(firsts));
  assert.equal(earlyRate(10) > earlyRate(1), true);
  assert.ok(clearBonus(5, true) > clearBonus(5, false));
});

test('waves come by themselves after a break; sending early pays the rest of the break in compute', () => {
  const sim = createSim({ map: 'chat', seed: 8, compute: 0 });
  assert.equal(sim.canSend(), true);
  assert.equal(sim.sendWave(), 0, 'the first wave: no bonus');
  assert.equal(sim.wave, 1);
  assert.equal(sim.canSend(), false, 'not while it walks in');
  while (sim.spawns.length) sim.update(DT);
  sim.update(DT);
  assert.ok(sim.nextIn > 5);
  step(sim, 3);
  const left = sim.nextIn, before = sim.compute;
  const bonus = sim.sendWave();
  assert.equal(bonus, Math.ceil(left * earlyRate(2)));
  assert.equal(sim.compute, before + bonus);
  assert.equal(sim.wave, 2);
  // left alone, the next one comes on its own
  const sim2 = createSim({ map: 'chat', seed: 8, compute: 0 });
  sim2.sendWave();
  step(sim2, 60);
  assert.ok(sim2.wave >= 2);
});

test('holding 15 waves on a map unlocks the next one; 30 is a victory, then endless', () => {
  const sim = createSim({ map: 'chat', seed: 4, wave: 14 });
  assert.equal(sim.cleared, 14);
  sim.sendWave();
  // stop them all as they come
  for (let i = 0; i < 2000 && !sim.waves.get(15).done; i++) { sim.update(DT); for (const c of [...sim.creatures]) sim._hurt(c, 1e9, 'splash'); }
  const evs = sim.drain();
  assert.ok(evs.some((e) => e.type === 'clear' && e.wave === 15));
  assert.ok(evs.some((e) => e.type === 'unlock' && e.map === 'chat'));
  const v = createSim({ map: 'chat', seed: 4, wave: 29 });
  v.sendWave();
  for (let i = 0; i < 3000 && !v.waves.get(30).done; i++) { v.update(DT); for (const c of [...v.creatures]) v._hurt(c, 1e9, 'splash'); }
  assert.ok(v.drain().some((e) => e.type === 'victory'));
  assert.equal(v.victory, true);
  assert.equal(v.over, false, 'and it goes on');
  assert.ok(v.canSend());
});

test('a seeded run with a scripted build repeats exactly', () => {
  const run = (seed) => {
    const sim = createSim({ map: 'chat', seed });
    const ai = createAI(sim);
    ai.think(); ai.think();
    sim.sendWave();
    while (!sim.over && sim.cleared < 10 && sim.t < 900) { sim.update(DT); ai.update(DT); sim.drain(); }
    return { cleared: sim.cleared, hearts: sim.hearts, kills: sim.kills, compute: sim.compute, t: +sim.t.toFixed(3), towers: sim.towers.map((t) => `${t.type}${t.tier}${t.spec}@${t.tx},${t.ty}`).join(' ') };
  };
  const a = run(11), b = run(11);
  assert.deepEqual(a, b);
  assert.ok(a.kills > 100);
});

test('balance sanity: a reasonable build holds wave 10 on THE CHAT; filters alone fall around there', () => {
  const play = (plan) => {
    const sim = createSim({ map: 'chat', seed: 21 });
    const ai = createAI(sim, { plan });
    ai.think(); ai.think();
    sim.sendWave();
    while (!sim.over && sim.cleared < 10 && sim.t < 900) { sim.update(DT); ai.update(DT); sim.drain(); }
    return sim;
  };
  const good = play('balanced');
  assert.ok(good.cleared >= 10 && !good.over, `held ${good.cleared}`);
  assert.ok(good.hearts >= 14, `with hearts to spare (${good.hearts})`);
  const weak = play('filters');
  assert.ok(weak.hearts < good.hearts, 'counters matter: filters alone leak (disguised and shielded ones)');
});
