import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, switchCharacter, chooseUpgrade, DISTRICTS, UPGRADES, FIXED_DT } from '../src/games/vladrunner2049/engine.js';

const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(s, Array.isArray(input) ? input : [input], FIXED_DT); return s; };
function encounter(options = {}) {
  const s = createGame({ seed: 'combat-test', ...options });
  s.players[0].x = s.nextGate - 429; stepGame(s, [{}], FIXED_DT);
  return s;
}
function target(kind = 'grunt', options = {}) {
  const s = encounter(options), p = s.players[0], e = s.enemies[0];
  s.enemies = [e]; p.x = 500; p.y = 560; p.face = 1;
  Object.assign(e, { kind, x: 580, y: 560, z: 0, vz: 0, face: -1, hp: 1000, maxHp: 1000, cooldown: 100,
    spawnTime: 0, speed: 0, boss: false, value: 100 });
  return { s, p, e };
}
function startBoss(stage = 0, options = {}) {
  const s = createGame({ seed: 'boss-test', ...options });
  s.stage = stage; s.district = DISTRICTS[stage]; s.worldWidth = s.district.width; s.stageWave = 3;
  s.nextGate = s.district.encounters[3]; s.players[0].x = s.nextGate - 429;
  stepGame(s, [{}], FIXED_DT); return s;
}

test('runner world and daily waves are deterministic, independent of frame partition and wall clock', () => {
  const a = createGame({ mode: 'daily', seed: '2049-10-22' }), b = createGame({ mode: 'daily', seed: '2049-10-22' });
  for (let i = 0; i < 180; i++) { stepGame(a, [{ x: 1, y: i < 30 ? .5 : 0, attack: true }], 1 / 30);
    stepGame(b, [{ x: 1, y: i < 30 ? .5 : 0, attack: true }], 1 / 60); stepGame(b, [{ x: 1, y: i < 30 ? .5 : 0, attack: true }], 1 / 60); }
  assert.deepEqual(a, b);
  const c = encounter({ mode: 'daily', seed: '2049-10-23' }), d = encounter({ mode: 'daily', seed: '2049-10-22' });
  assert.notDeepEqual(c.enemies.map((e) => [e.kind, e.x, e.y]), d.enemies.map((e) => [e.kind, e.x, e.y]));
  assert.equal(a.width, 1280); assert.equal(a.height, 720); assert.equal(DISTRICTS.length, 3);
});

test('movement remains in the belt and active arena; invalid time cannot teleport or poison a run', () => {
  const s = encounter(), p = s.players[0];
  run(s, 8, { x: -1, y: -1 }); assert.equal(p.x, s.arena.left); assert.equal(p.y, s.floor.minY);
  p.invuln = 100; run(s, 10, { x: 1, y: 1 }); assert.ok(p.x <= s.arena.right); assert.equal(p.y, s.floor.maxY);
  const elapsed = s.elapsed; stepGame(s, [{ x: Infinity, y: NaN }], NaN); assert.equal(s.elapsed, elapsed);
  stepGame(s, [{}], 5000); assert.ok(s.elapsed - elapsed <= .251, 'background stalls have a bounded catch-up budget');
  assert.ok(Number.isFinite(p.x) && Number.isFinite(s.cameraX));
});

test('held light attacks cycle three hit combos with impact timing, launch, score and cooldown', () => {
  const { s, p, e } = target();
  stepGame(s, [{ attack: true }], FIXED_DT); assert.equal(e.hp, 1000, 'windup precedes impact');
  run(s, .1, { attack: true }); assert.equal(e.hp, 984); assert.equal(s.stats.hits, 1);
  // Keep the target in range so this isolates combo cadence, not knockback distance.
  for (let i = 0; i < 38; i++) { e.x = p.x + 65; e.y = p.y; e.vx = 0; stepGame(s, [{ attack: true }], FIXED_DT); }
  assert.ok(s.stats.hits >= 3); assert.ok(e.z > 0 || e.vz > 0); assert.ok(s.maxCombo >= 3); assert.ok(s.score > 0);
  const attacks = s.events.filter((ev) => ev.type === 'attack'); assert.deepEqual(attacks.slice(0, 3).map((ev) => ev.text), ['combo1', 'combo2', 'combo3']);
  assert.ok(attacks.length < 5, 'holding attack does not bypass cooldown');
});

test('heavy attacks buffer behind a light attack, break frontal shields and launch enemies', () => {
  const normal = target('shield'); run(normal.s, .1, { attack: true }); assert.equal(normal.e.hp, 996, 'shield blocks most frontal light damage');
  normal.e.x = normal.p.x + 65; normal.e.vx = 0;
  stepGame(normal.s, [{ heavy: true }], FIXED_DT);
  run(normal.s, .55, {});
  assert.ok(normal.e.hp < 975, 'buffered heavy executes when the first attack recovers');
  assert.ok(normal.e.guardBreak > 0); assert.ok(normal.e.z > 0);
  const rear = target('shield'); rear.e.face = 1; rear.e.telegraph = true; rear.e.windup = 2;
  run(rear.s, .1, { attack: true }); assert.equal(rear.e.hp, 984, 'a shield does not block a flank while committed to its telegraph');
});

test('jumping permits air kicks and juggle hits; edge controls survive a sub-frame tap', () => {
  const { s, p, e } = target();
  stepGame(s, [{ jump: true }], 1 / 120); assert.equal(p.z, 0);
  stepGame(s, [{}], 1 / 120); assert.ok(p.z > 0, 'a tap is retained until the next fixed tick');
  run(s, .12, {}); e.x = p.x + 70; e.y = p.y;
  run(s, .12, { attack: true }); assert.ok(e.hp < 1000); assert.ok(e.z > 0); assert.equal(p.pose, 'kick');
  run(s, 1.5, {}); assert.equal(p.z, 0); assert.equal(p.vz, 0);
});

test('dodge grants a brief invulnerable window and cannot be retriggered by holding the button', () => {
  const { s, p } = target(); const hp = p.hp;
  const bolt = () => ({ id: 9999, kind: 'bolt', team: 'enemy', x: p.x, y: p.y, z: 38, vx: 0, vy: 0, damage: 20, life: 2 });
  s.projectiles.push(bolt()); stepGame(s, [{ dodge: true }], FIXED_DT); assert.equal(p.hp, hp); assert.ok(p.invuln > 0);
  run(s, 1.3, { dodge: true }); assert.equal(s.stats.dodges, 1);
  s.projectiles = [bolt()]; stepGame(s, [{}], FIXED_DT); assert.equal(p.hp, hp - 20);
  stepGame(s, [{ dodge: true }], FIXED_DT); assert.equal(s.stats.dodges, 1, 'being hurt cannot be cancelled instantly into dodge');
  run(s, .5, {}); stepGame(s, [{ dodge: true }], FIXED_DT); assert.equal(s.stats.dodges, 2);
});

test('energy specials spend energy once, duo requires full charge, and tag preserves resources', () => {
  const { s, p, e } = target();
  p.energy = 10; run(s, .6, { special: true }); assert.equal(s.stats.specials, 0);
  run(s, .05, {}); p.energy = 60; stepGame(s, [{ special: true }], FIXED_DT); assert.ok(p.energy < 26); run(s, .65, { special: true });
  assert.equal(s.stats.specials, 1); assert.ok(e.hp < 1000);
  run(s, .1, {}); stepGame(s, [{ duo: true }], FIXED_DT); assert.equal(s.stats.duos, 0);
  run(s, .05, {}); s.duo = 100; stepGame(s, [{ duo: true }], FIXED_DT); assert.equal(s.stats.duos, 1); assert.ok(s.duo < 100);
  run(s, 1, {}); const hp = p.hp, energy = p.energy;
  assert.equal(switchCharacter(s), true); assert.equal(p.kind, 'agi'); assert.equal(p.hp, hp); assert.equal(p.energy, energy);
  assert.equal(switchCharacter(s), false, 'tag has a cooldown'); assert.equal(switchCharacter(createGame({ coop: true })), false);
});

test('a quick tag tap survives special, heavy, hurt and dodge recovery and switches once', () => {
  for (const busy of ['special', 'heavy', 'hurt', 'dodge']) {
    const s = createGame({ seed: `tag-buffer-${busy}` }), p = s.players[0];
    if (busy === 'hurt') p.hurtTime = .4;
    else stepGame(s, [{ [busy]: true }], FIXED_DT);
    run(s, .15);
    stepGame(s, [{ tag: true }], FIXED_DT);
    assert.equal(p.kind, 'vlad', `${busy} finishes before switching`);
    // Let go of Tag and immediately hold Combo, as in the reported browser sequence.
    run(s, .5, { attack: true });
    assert.equal(p.kind, 'agi', `${busy} does not swallow the quick tap`);
    assert.equal(s.events.filter(e => e.type === 'tag').length, 1);
    assert.equal(p.tagBufferTime, 0);
    run(s, 2, { attack: true });
    assert.equal(p.kind, 'agi', 'the request cannot repeat after its cooldown');
  }
});

test('tag buffering expires after half a second, merges taps, honors held edges and leaves co-op unchanged', () => {
  const stale = createGame(), p = stale.players[0]; p.hurtTime = .9;
  stepGame(stale, [{ tag: true }], FIXED_DT); run(stale, 1.5);
  assert.equal(p.kind, 'vlad', 'a stale request must not surprise the player much later');
  assert.equal(p.tagBufferTime, 0);

  const queued = createGame(), hero = queued.players[0]; hero.hurtTime = .3;
  for (let i = 0; i < 12; i++) stepGame(queued, [{ tag: i % 2 === 0 }], FIXED_DT);
  run(queued, 2, { tag: true });
  assert.equal(hero.kind, 'agi'); assert.equal(queued.events.filter(e => e.type === 'tag').length, 1);
  run(queued, .05); stepGame(queued, [{ tag: true }], FIXED_DT);
  assert.equal(hero.kind, 'vlad', 'a fresh edge still switches after cooldown');

  const coop = createGame({ coop: true });
  run(coop, .1, [{ special: true }, { dodge: true }]);
  run(coop, 2, [{ tag: true }, { tag: true }]);
  assert.deepEqual(coop.players.map(p => p.kind), ['vlad', 'agi']);
  assert.ok(coop.players.every(p => p.tagBufferTime === 0));
  assert.equal(coop.events.some(e => e.type === 'tag'), false);
});

test('melee and ranged enemies telegraph before attacking and can be avoided by changing lanes', () => {
  const a = target(); a.e.cooldown = 0; a.e.range = 100; a.e.damage = 8; a.e.baseWindup = .5;
  stepGame(a.s, [{}], FIXED_DT); assert.equal(a.e.telegraph, true); assert.ok(a.e.windup > .4); assert.equal(a.p.hp, a.p.maxHp);
  run(a.s, .55, { y: 1 }); assert.equal(a.p.hp, a.p.maxHp, 'moving out of the locked melee lane avoids the strike');
  const r = target('ranger'); r.e.x = r.p.x + 320; r.e.cooldown = 0; r.e.baseWindup = .4; r.e.damage = 7;
  run(r.s, .5, {}); assert.ok(r.s.projectiles.length > 0); assert.equal(r.s.projectiles[0].team, 'enemy');
  assert.ok(r.s.events.some((e) => e.type === 'enemyAttack' && e.text === 'shot'));
});

test('each boss has health phases and a distinct readable attack, without immediate untelegraphed damage', () => {
  for (const [stage, expected] of ['warden', 'juggernaut', 'archon'].entries()) {
    const s = startBoss(stage), e = s.boss, p = s.players[0];
    assert.equal(e.kind, expected); assert.ok(e.boss); assert.equal(e.name, DISTRICTS[stage].bossName);
    s.enemies = [e]; e.spawnTime = 0; e.cooldown = 0; e.hp = e.maxHp * .25; p.x = e.x - (stage === 2 ? 280 : 100); p.y = e.y;
    stepGame(s, [{}], FIXED_DT); assert.equal(e.phase, 3); assert.equal(e.telegraph, true); assert.ok(e.windup > .5);
    assert.equal(p.hp, p.maxHp);
    assert.equal(e.attackKind, stage === 1 ? 'charge' : stage === 2 ? 'shot' : 'melee');
  }
});

test('boss telegraphs survive sustained light attacks; a heavy stagger has a recovery limit', () => {
  const s = startBoss(0), e = s.boss, p = s.players[0];
  s.enemies = [e]; Object.assign(e, { spawnTime: 0, cooldown: 0, hp: 5000, maxHp: 5000 });
  p.x = e.x - 70; p.y = e.y; p.face = 1; p.invuln = 100;
  for (let i = 0; i < 300; i++) {
    e.x = p.x + 70; e.y = p.y; e.vx = 0;
    stepGame(s, [{ attack: true }], FIXED_DT);
  }
  assert.ok(s.events.some((event) => event.type === 'enemyAttack' && event.kind === 'warden'), 'holding light attack cannot lock a boss out of all retaliation');
  assert.ok(s.stats.hits > 10); assert.ok(e.staggerCooldown >= 0);
});

test('no-hit wave clear awards one bonus; pickups restore resources; co-op revives after a surviving clear', () => {
  const s = encounter({ coop: true }), p = s.players[0], other = s.players[1];
  p.hp = 70; p.energy = 5;
  s.pickups = [{ id: 90, kind: 'health', x: p.x, y: p.y, z: 0, life: 10 }, { id: 91, kind: 'energy', x: p.x, y: p.y, z: 0, life: 10 }];
  stepGame(s, [{}, {}], FIXED_DT); assert.equal(p.hp, 100); assert.ok(p.energy > 37); assert.equal(s.pickups.length, 0);
  other.dead = true; other.hp = 0; for (const e of s.enemies) { e.dead = true; e.hp = 0; }
  run(s, 1, [{}, {}]); assert.equal(s.stats.noHitWaves, 1); assert.equal(s.totalWaves, 1); assert.ok(!other.dead && other.hp > 0);
  const score = s.score; run(s, 1, [{}, {}]); assert.equal(s.score, score, 'a cleared wave cannot award twice');
});

test('district upgrades are validated, apply to both players, and campaign victory ends simulation', () => {
  const s = startBoss(0, { coop: true }); for (const e of s.enemies) { e.dead = true; e.hp = 0; }
  run(s, 1, [{}, {}]); assert.equal(s.status, 'upgrade'); assert.equal(s.upgradeChoices.length, 3);
  assert.equal(new Set(s.upgradeChoices.map((u) => u.id)).size, 3); assert.ok(s.upgradeChoices.every((u) => UPGRADES.includes(u)));
  assert.equal(chooseUpgrade(s, 'not-real'), false); const chosen = s.upgradeChoices[0].id;
  assert.equal(chooseUpgrade(s, chosen), true); assert.equal(s.stage, 1); assert.equal(s.status, 'playing'); assert.ok(s.upgrades.includes(chosen));
  assert.ok(s.players.every((p) => p.energy === p.maxEnergy && p.hp >= p.maxHp * .55));
  const last = startBoss(2); for (const e of last.enemies) { e.dead = true; e.hp = 0; }
  run(last, 1); assert.equal(last.status, 'victory'); const frozen = JSON.stringify(last); run(last, 10, { attack: true }); assert.equal(JSON.stringify(last), frozen);
});

test('endless mode loops after the third boss; death ends a run and effects/events remain bounded', () => {
  const endless = startBoss(2, { mode: 'endless' }); for (const e of endless.enemies) { e.dead = true; e.hp = 0; }
  run(endless, 1); assert.equal(endless.status, 'upgrade'); chooseUpgrade(endless, endless.upgradeChoices[0].id);
  assert.equal(endless.stage, 0); assert.equal(endless.loop, 1); assert.equal(endless.status, 'playing');
  const dead = target(); dead.p.hp = 1; dead.s.projectiles = [{ id: 99, x: dead.p.x, y: dead.p.y, vx: 0, vy: 0, damage: 50, life: 3 }];
  stepGame(dead.s, [{}], FIXED_DT); assert.equal(dead.s.status, 'gameover'); assert.equal(dead.s.events.at(-1).type, 'gameover');
  const long = createGame(); run(long, 80, { attack: true }); assert.ok(long.events.length <= 120); assert.ok(long.effects.length <= 160);
  assert.ok(long.events.every((e, i, a) => !i || e.id > a[i - 1].id));
});

test('a competent deterministic player can finish all three districts with combat, pickups and upgrades', () => {
  const s = createGame({ seed: 'complete-campaign', difficulty: 'normal' });
  for (let tick = 0; tick < 60 * 360 && !['victory', 'gameover'].includes(s.status); tick++) {
    if (s.status === 'upgrade') { chooseUpgrade(s, s.upgradeChoices[0].id); continue; }
    const p = s.players[0], e = s.enemies.filter((e) => !e.dead).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 2 - Math.abs(b.x - p.x) - Math.abs(b.y - p.y) * 2)[0];
    let input = { x: 1 };
    if (e) {
      const dx = e.x - p.x, dy = e.y - p.y;
      input = { x: Math.abs(dx) > 75 ? Math.sign(dx) : 0, y: Math.abs(dy) > 12 ? Math.sign(dy) : 0,
        attack: true, heavy: tick % 60 === 0, special: p.energy >= 35 && Math.abs(dx) < 230 && tick % 90 === 0,
        duo: s.duo >= 100, dodge: e.telegraph && e.windup < .12 && tick % 5 === 0, jump: tick % 110 === 0 };
      if (Math.abs(dx) < 75) p.face = Math.sign(dx) || p.face;
    }
    stepGame(s, [input], FIXED_DT);
  }
  assert.equal(s.status, 'victory'); assert.equal(s.totalWaves, 12); assert.equal(s.stats.stagesCleared, 3);
  assert.ok(s.stats.kills >= 40 && s.maxCombo > 3 && s.stats.specials > 0 && s.score > 5000);
  assert.ok(s.elapsed > 60 && s.elapsed < 300, `full campaign took ${s.elapsed}s`);
});
