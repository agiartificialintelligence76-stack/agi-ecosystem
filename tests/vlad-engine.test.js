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
  s.platforms = []; s.props = []; // Isolate combat timing from authored obstacle placement.
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
  for (const character of ['vlad','agi']) {
  const s = createGame({ seed: 'complete-campaign', difficulty: 'normal', character });
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
    const obstacle = [...s.platforms,...s.props.filter(o => !o.broken)].some(o => o.height > p.z+2
      && Math.abs(o.x-(p.x+(input.x || p.face)*50)) < o.width/2+10 && Math.abs(o.y-p.y) < o.depth/2+10);
    if (obstacle) input.jump = tick % 2 === 0;
    stepGame(s, [input], FIXED_DT);
  }
  assert.equal(s.status, 'victory'); assert.equal(s.totalWaves, 12); assert.equal(s.stats.stagesCleared, 3);
  assert.ok(s.stats.kills >= 40 && s.maxCombo > 3 && s.stats.specials > 0 && s.score > 5000);
  assert.ok(s.elapsed > 60 && s.elapsed < 300, `${character} full campaign took ${s.elapsed}s`);
  }
});

test('running accelerates promptly, brakes without skating, and advances animation with distance', () => {
  const s = createGame(), p = s.players[0], start = p.x;
  stepGame(s, [{ x: 1 }], FIXED_DT);
  assert.ok(p.moveX > 0 && p.moveX < 265, 'first movement frame eases into the run');
  run(s, .1, { x: 1 }); assert.equal(p.moveX, 265); assert.ok(p.runCycle > 0);
  const movingX = p.x, cycle = p.runCycle;
  run(s, .15, {});
  assert.equal(p.moveX, 0); assert.equal(p.moveSpeed, 0); assert.equal(p.pose, 'idle');
  assert.ok(p.x - movingX < 12, 'releasing movement stops within a short, readable distance');
  const stoppedCycle = p.runCycle; run(s, .25, {}); assert.equal(p.runCycle, stoppedCycle);
  assert.ok(p.x > start && stoppedCycle > cycle);
});

test('a strike has active frames, hits a late entrant once, and exposes synchronized animation phases', () => {
  const { s, p, e } = target(); e.x = p.x + 230;
  stepGame(s, [{ attack: true }], FIXED_DT);
  assert.equal(p.attack.phase, 'windup'); assert.equal(p.attack.stage, 1);
  run(s, .075); assert.equal(e.hp, 1000); assert.equal(p.attack.phase, 'active');
  e.x = p.x + 75; stepGame(s, [{}], FIXED_DT);
  assert.equal(e.hp, 984); assert.deepEqual(p.attack.hitIds, [e.id]); assert.equal(p.attack.connected, true);
  assert.ok(p.actionPhase > 0 && p.actionPhase < 1);
  for (let i = 0; i < 9; i++) { e.x = p.x + 75; e.vx = 0; stepGame(s, [{}], FIXED_DT); }
  assert.equal(e.hp, 984, 'active frames cannot repeat damage on the same enemy');
  assert.equal(p.attack.phase, 'recovery');
});

test('contact hitstop freezes simulation and animation while preserving a quick buffered next attack', () => {
  const { s, p, e } = target(); run(s, .1, { attack: true });
  assert.ok(s.hitStop > 0);
  const age = p.attack.age, simTime = s.simulationTime, elapsed = s.elapsed, x = e.x;
  stepGame(s, [{ heavy: true }], FIXED_DT);
  assert.equal(p.attack.age, age); assert.equal(e.x, x); assert.equal(s.simulationTime, simTime);
  assert.ok(s.elapsed > elapsed); assert.equal(p.pending.heavy, true);
  run(s, .5, {});
  assert.ok(s.events.some(event => event.type === 'attack' && event.attackKind === 'heavy'), 'short tap survives the contact pause');
  assert.ok(s.events.some(event => event.type === 'hit' && event.strength === 'light' && event.comboStep === 1));
});

test('a light tap buffers through recovery and movement turns only the next combo attack', () => {
  const s = createGame(), p = s.players[0];
  stepGame(s, [{ attack: true, x: 1 }], FIXED_DT);
  run(s, .13, { x: -1 }); assert.equal(p.face, 1, 'committed strike retains its facing');
  stepGame(s, [{ attack: true, x: -1 }], FIXED_DT);
  run(s, .16, { x: -1 });
  assert.equal(p.attack.stage, 2); assert.equal(p.face, -1);
  assert.deepEqual(s.events.filter(event => event.type === 'attack').map(event => event.text), ['combo1', 'combo2']);
});

test('dodge and jump cancel attack recovery without cancelling its anticipation or granting free damage', () => {
  for (const action of ['dodge', 'jump']) {
    const s = createGame(), p = s.players[0];
    stepGame(s, [{ heavy: true }], FIXED_DT);
    stepGame(s, [{ [action]: true }], FIXED_DT);
    assert.equal(p.attack.kind, 'heavy'); assert.equal(p.dodgeTime, 0); assert.equal(p.z, 0);
    run(s, .3, {}); assert.equal(p.attack.phase, 'recovery');
    stepGame(s, [{ [action]: true }], FIXED_DT);
    assert.equal(p.attack, null); assert.equal(p.cooldown, 0);
    assert.ok(action === 'jump' ? p.z > 0 : p.dodgeTime > 0);
  }
});

test('nearby lane assistance catches visual overlap without turning or snapping distant targets', () => {
  const near = target(); near.e.y = near.p.y + 65;
  run(near.s, .19, { attack: true }); assert.ok(near.e.hp < 1000);
  assert.ok(near.p.y > 560 && near.p.y <= 578.01, 'lane assist is capped at 18 pixels');
  const far = target(); far.e.y = far.p.y + 100; run(far.s, .2, { attack: true });
  assert.equal(far.e.hp, 1000); assert.equal(far.p.y, 560);
  const rear = target(); rear.e.x = rear.p.x - 85; run(rear.s, .2, { attack: true });
  assert.equal(rear.e.hp, 1000); assert.equal(rear.p.face, 1);
});

test('ranged enemies do not kite forever when a hero approaches, and landing emits one timed impact', () => {
  const { s, p, e } = target('ranger'); e.x = p.x + 115; e.speed = 112; e.cooldown = .3; e.baseCooldown = 2.4;
  const enemyX = e.x; run(s, .15); assert.equal(e.x, enemyX, 'ranged enemy holds ground during its recovery');
  const jump = createGame(); stepGame(jump, [{ jump: true }], FIXED_DT); run(jump, 1.1);
  const landings = jump.events.filter(event => event.type === 'land');
  assert.equal(landings.length, 1); assert.ok(landings[0].amount > 300); assert.equal(jump.players[0].z, 0);
});

test('a boss resumes its visible windup after a non-staggering light hit', () => {
  const s = startBoss(0), e = s.boss, p = s.players[0];
  s.enemies = [e]; Object.assign(e, { spawnTime: 0, cooldown: 0 });
  p.x = e.x - 75; p.y = e.y; p.face = 1;
  stepGame(s, [{}], FIXED_DT); assert.equal(e.telegraph, true);
  run(s, .1, { attack: true }); assert.equal(e.pose, 'hurt'); assert.equal(e.telegraph, true);
  run(s, .11, {});
  assert.equal(e.hurtTime, 0); assert.equal(e.telegraph, true); assert.equal(e.pose, 'idle');
  assert.ok(e.windup > 0 && e.windup < e.totalWindup);
  const contact = s.events.find(event => event.type === 'hit');
  assert.ok(Number.isFinite(contact.simulationTime) && contact.simulationTime <= contact.time + 1e-10);
});

function traversalWorld() {
  const s = createGame({seed:'platform-test'});
  s.nextGate = Infinity; s.platforms = []; s.props = []; s.hazards = []; s.pickups = [];
  return s;
}
const deck = (id = 9000, more = {}) => ({id,kind:'service-deck',x:350,y:560,width:200,depth:84,height:56,broken:false,...more});

test('all districts have distinct authored jumpable routes and fresh breakable props', () => {
  const s = createGame(), arrangements = [];
  for (let stage = 0; stage < 3; stage++) {
    assert.equal(s.platforms.length,9); assert.equal(s.props.length,6); assert.equal(s.hazards.length,4);
    assert.ok(s.worldWidth>=5000 && s.worldWidth<=5400);
    assert.ok(s.pickups.some(item=>item.groundZ>0 && item.life>300),'raised routes reward optional exploration');
    assert.ok(s.platforms.every(o => o.height > 0 && o.height <= 72 && o.depth < s.floor.maxY-s.floor.minY));
    arrangements.push(s.platforms.map(o => [o.x,o.y,o.kind]));
    const oldIds = new Set([...s.platforms,...s.props].map(o => o.id));
    s.props[0].broken = true;
    if (stage < 2) {
      s.status = 'upgrade'; s.upgradeChoices = [UPGRADES[0]]; assert.equal(chooseUpgrade(s,UPGRADES[0].id),true);
      assert.ok(s.props.every(o => !o.broken && o.hp === o.maxHp));
      assert.ok([...s.platforms,...s.props].every(o => !oldIds.has(o.id)));
    }
  }
  assert.notDeepEqual(arrangements[0],arrangements[1]); assert.notDeepEqual(arrangements[1],arrangements[2]);
});

test('solid objects stop walking, but a jump lands on their top and permits another jump', () => {
  const s = traversalWorld(), p = s.players[0], platform = deck(); s.platforms = [platform]; p.y = 560;
  run(s,.5,{x:1}); assert.equal(p.x,241,'a solid face cannot be walked through'); assert.equal(p.z,0);
  stepGame(s,[{x:1,jump:true}],FIXED_DT); run(s,.45,{x:1}); run(s,.3,{});
  assert.equal(p.platformId,platform.id); assert.equal(p.groundZ,56); assert.equal(p.z,56); assert.equal(p.vz,0);
  run(s,.2,{}); assert.equal(p.pose,'idle','standing on a platform is not an airborne pose');
  stepGame(s,[{jump:true}],FIXED_DT); assert.ok(p.z > 56 && p.vz > 0,'a supported runner can jump again');
  run(s,1,{}); assert.equal(p.z,56); assert.equal(p.platformId,platform.id);
  run(s,1,{x:1}); assert.equal(p.platformId,null); assert.equal(p.groundZ,0); assert.equal(p.z,0,'walking off the edge falls to the floor');
});

test('landing and ledge physics remain deterministic across render frame partitions', () => {
  const a = traversalWorld(), b = traversalWorld(); a.platforms = [deck()]; b.platforms = [deck()];
  for (const s of [a,b]) { s.players[0].x = 235; s.players[0].y = 560; }
  for(let i=0;i<90;i++) {
    const input = {x:i<18 || i>45 ? 1 : 0,jump:i===0};
    stepGame(a,[input],1/30); stepGame(b,[input],1/60); stepGame(b,[input],1/60);
  }
  assert.deepEqual(a,b);
});

test('breakable props reward one pickup and a runner falls when their support breaks', () => {
  const {s,p,e} = target('grunt',{coop:true}); e.x = 950;
  const prop = {id:9990,kind:'crate',x:580,y:560,width:60,depth:50,height:38,hp:28,maxHp:28,broken:false,breakTime:0};
  s.props = [prop];
  const partner = s.players[1]; Object.assign(partner,{x:580,y:560,z:38,groundZ:38,platformId:prop.id});
  run(s,.8,[{heavy:true},{}]);
  assert.equal(prop.broken,true); assert.equal(s.stats.propsBroken,1); assert.ok(prop.breakTime>0);
  assert.equal(s.events.filter(ev=>ev.type==='prop-break').length,1);
  assert.equal(partner.platformId,null); assert.equal(partner.z,0);
  assert.ok(s.events.some(ev=>ev.type==='pickup') || s.pickups.some(item=>item.kind==='health'));
  run(s,1,[{attack:true},{}]); assert.equal(s.stats.propsBroken,1,'debris cannot be harvested repeatedly');
});

test('ground strikes cannot hit a high supported target, while same-height combat still works', () => {
  const {s,p,e} = target(); const platform = deck(9991,{x:650,width:180,height:72}); s.platforms = [platform];
  Object.assign(e,{x:610,z:72,groundZ:72,platformId:platform.id});
  run(s,.2,{attack:true}); assert.equal(e.hp,1000,'a ground jab cannot strike through the raised platform');
  run(s,.4,{}); Object.assign(p,{x:590,y:560,z:72,groundZ:72,platformId:platform.id,vx:0,moveX:0});
  e.x = 665; run(s,.2,{attack:true}); assert.ok(e.hp<1000,'standing at positive elevation does not disable normal punches');
});

test('bolts obey absolute elevation and solid cover, including elevated enemy shots', () => {
  const {s,p,e} = target('ranger'); const platform = deck(9992,{x:p.x,width:100,height:72}); s.platforms = [platform];
  Object.assign(p,{z:72,groundZ:72,platformId:platform.id});
  const bolt = z => ({id:9993,x:p.x,y:p.y,z,vx:0,vy:0,damage:20,life:1});
  s.projectiles = [bolt(38)]; stepGame(s,[{}],FIXED_DT); assert.equal(p.hp,p.maxHp); assert.equal(s.projectiles.length,0,'platform face blocks a low shot');
  s.projectiles = [bolt(110)]; stepGame(s,[{}],FIXED_DT); assert.equal(p.hp,p.maxHp-20,'a bolt at the supported torso elevation hits');
  s.hitStop = 0; s.projectiles = []; Object.assign(e,{x:820,z:0,vz:0,groundZ:0,platformId:null,cooldown:0,baseWindup:.2,damage:8});
  run(s,.3,{}); assert.ok(s.projectiles.some(b=>b.vz>0),'rangers aim their shot toward the locked target elevation');
});

test('enemies can hop onto a player platform and attack there without inaccessible encounters', () => {
  const {s,p,e} = target(); const platform = deck(9994,{x:650,width:160,height:64}); s.platforms = [platform];
  Object.assign(p,{x:650,y:560,z:64,groundZ:64,platformId:platform.id,invuln:100});
  Object.assign(e,{x:475,y:560,speed:132,cooldown:0,damage:8});
  let reached = false;
  for(let i=0;i<360;i++) { stepGame(s,[{}],FIXED_DT); if(e.platformId===platform.id) reached=true; }
  assert.ok(reached,'melee enemies traverse the obstacle rather than getting trapped below it');
  assert.ok(s.events.some(ev=>ev.type==='enemyAttack'),'they can fight after landing at the player elevation');
});

test('heavy launch has distinct airborne, down and protected get-up states before an enemy resumes', () => {
  const {s,e} = target(); stepGame(s,[{heavy:true}],FIXED_DT);
  const seen = new Set(); let downHeight = null, airProgress = 0;
  for(let i=0;i<140;i++) {
    stepGame(s,[{}],FIXED_DT); if(e.knockdown) seen.add(e.knockdown);
    if(e.knockdown==='air') airProgress=Math.max(airProgress,e.knockdownProgress);
    if(e.knockdown==='down') { downHeight=e.z; assert.equal(e.vz,0); }
    if(e.knockdown==='getup') assert.ok(e.invuln>0 && e.knockdownProgress>=0 && e.knockdownProgress<=1);
  }
  assert.deepEqual([...seen],['air','down','getup']); assert.equal(downHeight,0); assert.equal(e.knockdown,null);
  assert.ok(airProgress>.4,'the drawn tumble progresses through its airborne phase');
  assert.ok(s.events.some(ev=>ev.type==='knockdown')); assert.ok(s.events.some(ev=>ev.type==='getup'));
});

const vent = (more = {}) => ({id:9900,kind:'steam',x:220,y:550,width:120,depth:62,height:24,period:4.2,
  offset:0,warningDuration:.85,activeDuration:.65,damage:11,phase:'idle',phaseProgress:0,telegraph:false,active:false,...more});

test('ground hazards give a warning before damage and are deterministic across frame partitions', () => {
  const a = traversalWorld(), b = traversalWorld(); a.hazards=[vent({offset:2.72})]; b.hazards=[vent({offset:2.72})];
  const hp=a.players[0].hp;
  for(let i=0;i<20;i++) { stepGame(a,[{}],1/30); stepGame(b,[{}],1/60); stepGame(b,[{}],1/60); }
  assert.deepEqual(a,b); assert.equal(a.hazards[0].phase,'telegraph'); assert.equal(a.players[0].hp,hp);
  for(let i=0;i<10;i++) { stepGame(a,[{}],1/30); stepGame(b,[{}],1/60); stepGame(b,[{}],1/60); }
  assert.deepEqual(a,b); assert.equal(a.hazards[0].phase,'active'); assert.equal(a.players[0].hp,hp-11);
  assert.ok(a.events.findIndex(e=>e.type==='hazardWarning')<a.events.findIndex(e=>e.type==='hazardActive'));
});

test('jump height and raised platforms evade a ground pulse, with no damage outside its footprint', () => {
  for(const position of ['ground','air','platform','outside']) {
    const s=traversalWorld(), p=s.players[0]; s.hazards=[vent({offset:3.7})];
    if(position==='air') { p.z=40; p.vz=100; }
    if(position==='platform') { const platform=deck(9901,{x:220,y:550,height:56}); s.platforms=[platform]; Object.assign(p,{z:56,groundZ:56,platformId:platform.id}); }
    if(position==='outside') p.y=630;
    stepGame(s,[{}],FIXED_DT);
    assert.equal(p.hp,p.maxHp-(position==='ground'?11:0),position);
  }
});

test('a perfect early dodge awards one counter, and the next connected strike deals fifty percent more damage', () => {
  const {s,p,e}=target(); p.energy=20;
  const bolt=()=>({id:9902,x:p.x,y:p.y,z:p.z+38,vx:0,vy:0,damage:10,life:1});
  s.projectiles=[bolt()]; stepGame(s,[{dodge:true}],FIXED_DT);
  assert.equal(p.hp,p.maxHp); assert.equal(s.stats.perfectDodges,1); assert.ok(p.energy>=38 && p.energy<39);
  assert.ok(p.counterReady && p.counterTime>3.4);
  s.projectiles=[bolt()]; stepGame(s,[{}],FIXED_DT);
  assert.equal(s.stats.perfectDodges,1,'overlapping threats cannot farm the same dodge');
  s.projectiles=[]; run(s,.35,{}); Object.assign(e,{x:p.x+70,y:p.y,vx:0,invuln:0});
  run(s,.12,{attack:true}); assert.equal(e.hp,976); assert.equal(p.counterReady,false); assert.equal(p.counterTime,0);
  assert.equal(s.events.filter(ev=>ev.type==='counterHit').length,1);
});

test('late dodge invulnerability grants no counter, and a charged platform jump keeps its next-attack bonus', () => {
  const late=target(); late.p.dodgeTime=.1; late.p.invuln=.2;
  late.s.projectiles=[{id:9903,x:late.p.x,y:late.p.y,z:38,vx:0,vy:0,damage:10,life:1}];
  stepGame(late.s,[{}],FIXED_DT); assert.equal(late.p.hp,late.p.maxHp); assert.equal(late.p.counterReady,false);
  const {s,p,e}=target(); const platform=deck(9904,{x:600,width:320,height:56}); s.platforms=[platform];
  Object.assign(p,{z:56,groundZ:56,platformId:platform.id,counterReady:true,counterTime:3.5});
  Object.assign(e,{x:575,z:56,groundZ:56,platformId:platform.id});
  stepGame(s,[{jump:true}],FIXED_DT); run(s,.1,{}); run(s,.12,{attack:true});
  assert.equal(e.hp,970,'a charged airborne kick includes its normal air bonus and counter multiplier');
  assert.equal(p.counterReady,false);
  const expired=target(); expired.p.counterReady=true; expired.p.counterTime=.01; run(expired.s,.12,{attack:true});
  assert.equal(expired.e.hp,984,'expired counters cannot power a later attack');
});

test('normal enemies attack more frequently with modest damage, while story assistance keeps long tells', () => {
  const normal=encounter({difficulty:'normal'}).enemies[0], story=encounter({difficulty:'story'}).enemies[0];
  assert.equal(normal.maxHp,48,'normal difficulty does not inflate basic enemy health');
  assert.ok(Math.abs(normal.damage-8*1.16)<1e-9); assert.ok(Math.abs(normal.baseCooldown-1.7*.85)<1e-9);
  assert.ok(story.damage<normal.damage); assert.equal(story.baseCooldown,1.7); assert.equal(story.baseWindup,.52);
});

test('a subset of normal grunts flank an engaged runner once, with a bounded route and no endless orbit', () => {
  for(const difficulty of ['normal','story']) {
    const {s,p,e}=target('grunt',{difficulty}); Object.assign(p,{invuln:100});
    Object.assign(e,{id:300,x:p.x+180,y:p.y,speed:132,cooldown:0});
    s.enemies.push({...e,id:301,x:p.x+65,speed:0,cooldown:100});
    let crossed=false;
    for(let i=0;i<300;i++) { stepGame(s,[{}],FIXED_DT); if(e.x<p.x-60) crossed=true; }
    if(difficulty==='normal') { assert.ok(e.flankUsed); assert.ok(crossed,'the grunt reaches the opposite side while its teammate engages'); assert.equal(e.flankTime,0); }
    else { assert.equal(e.flankUsed,false); assert.equal(crossed,false,'story keeps the direct, more forgiving approach'); }
  }
});
