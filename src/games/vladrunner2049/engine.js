// VLAD RUNNER 2049 — deterministic, local-only belt-scrolling combat.
// World positions and velocities use pixels / seconds. No DOM, wall clock, random global, service or persistence.
export const FIXED_DT = 1 / 60;
export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'neon', name: 'Neon Downpour', subtitle: 'Break the city lockdown', width: 3600,
    boss: 'warden', bossName: 'The Neon Warden', color: '#35d6ff', encounters: Object.freeze([760, 1470, 2220, 3050]) }),
  Object.freeze({ id: 'orange', name: 'Orange Expanse', subtitle: 'Cross the abandoned solar fields', width: 3800,
    boss: 'juggernaut', bossName: 'Solar Juggernaut', color: '#ff9b45', encounters: Object.freeze([780, 1550, 2350, 3220]) }),
  Object.freeze({ id: 'spire', name: 'Memory Spire', subtitle: 'Restore the stolen memories', width: 3700,
    boss: 'archon', bossName: 'The Memory Archon', color: '#e28dff', encounters: Object.freeze([760, 1500, 2290, 3130]) }),
]);
export const UPGRADES = Object.freeze([
  Object.freeze({ id: 'kinetic', name: 'Kinetic Circuit', label: 'Kinetic Circuit', description: '+18% attack damage for both runners.' }),
  Object.freeze({ id: 'repair', name: 'Reinforced Core', label: 'Reinforced Core', description: '+25 maximum health and an extra 35 health repair.' }),
  Object.freeze({ id: 'capacitor', name: 'Energy Capacitor', label: 'Energy Capacitor', description: '+25 energy capacity and faster energy recovery.' }),
  Object.freeze({ id: 'reflex', name: 'Ghost Reflex', label: 'Ghost Reflex', description: 'Faster movement and a shorter dodge cooldown.' }),
  Object.freeze({ id: 'salvage', name: 'Recovery Protocol', label: 'Recovery Protocol', description: 'Defeating an enemy restores 4 health.' }),
  Object.freeze({ id: 'sync', name: 'Duo Resonance', label: 'Duo Resonance', description: 'Build the duo meter 35% faster.' }),
]);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const ACTIONS = ['attack', 'heavy', 'jump', 'dodge', 'special', 'tag', 'duo'];
const GRAVITY = 1250;
const approach = (value, target, step) => value < target ? Math.min(target, value + step) : Math.max(target, value - step);
const enemyTypes = {
  grunt: { hp: 48, speed: 132, damage: 8, range: 92, windup: .52, cooldown: 1.7, value: 110 },
  shield: { hp: 82, speed: 100, damage: 10, range: 102, windup: .68, cooldown: 2.1, value: 180 },
  ranger: { hp: 40, speed: 112, damage: 7, range: 430, windup: .82, cooldown: 2.4, value: 160 },
  warden: { hp: 380, speed: 118, damage: 14, range: 145, windup: .88, cooldown: 2.0, value: 1800 },
  juggernaut: { hp: 470, speed: 98, damage: 17, range: 170, windup: 1.05, cooldown: 2.4, value: 2300 },
  archon: { hp: 440, speed: 140, damage: 13, range: 420, windup: .9, cooldown: 2.0, value: 2800 },
};

function hash(seed) { let n = 2166136261; for (const ch of String(seed)) { n ^= ch.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0 || 1; }
function random(s) { let n = s.rng += 0x6d2b79f5; s.rng >>>= 0; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }
const nextId = (s) => ++s.sequence;
function emit(s, type, entity = {}, more = {}) {
  s.events.push({ id: ++s.eventId, type, time: s.elapsed, simulationTime: s.simulationTime,
    x: entity.x || 0, y: entity.y || 0, kind: entity.kind || '', ...more });
  if (s.events.length > 120) s.events.splice(0, s.events.length - 120);
}
function effect(s, kind, entity, life = .3, more = {}) {
  s.effects.push({ id: nextId(s), kind, x: entity.x, y: entity.y, z: entity.z || 0, face: entity.face || 1, life, maxLife: life, ...more });
  if (s.effects.length > 160) s.effects.shift();
}
function body(s, kind, x, y, hp) {
  return { id: nextId(s), kind, x, y, z: 0, vz: 0, vx: 0, vy: 0, hp, maxHp: hp, energy: 60, maxEnergy: 100,
    face: 1, pose: 'idle', animTime: 0, attackTime: 0, attack: null, cooldown: 0, invuln: 0, hurtTime: 0,
    dodgeTime: 0, dodgeCooldown: 0, tagCooldown: 0, comboStep: 0, comboTime: 0, dead: false, deadTime: 0,
    telegraph: false, windup: 0, attackKind: null, targetX: 0, targetY: 0, guardBreak: 0, staggerCooldown: 0, bufferAction: null, bufferTime: 0,
    moveX: 0, moveY: 0, moveSpeed: 0, runCycle: 0, actionPhase: 0, hurtDuration: 0, landingTime: 0, jumpBuffer: 0, dodgeBuffer: 0 };
}
function player(s, kind, index) {
  const p = body(s, kind, 220 + index * 75, 550 + index * 55, s.difficulty === 'story' ? 210 : 150);
  p.index = index; p.previous = {}; p.pending = {}; p.input = {}; p.tagBufferTime = 0; p.isPlayer = true; return p;
}

export function createGame({ mode = 'story', seed = 'vlad-runner-2049', character = 'vlad', coop = false, difficulty = 'normal' } = {}) {
  const s = { version: 1, mode: ['story', 'endless', 'daily'].includes(mode) ? mode : 'story',
    seed: String(seed).slice(0, 128), rng: hash(seed), difficulty: difficulty === 'story' ? 'story' : 'normal', coop: Boolean(coop),
    width: 1280, height: 720, floor: { minY: 475, maxY: 650 }, worldWidth: DISTRICTS[0].width, cameraX: 0,
    district: DISTRICTS[0], stage: 0, loop: 0, wave: 0, stageWave: 0, totalWaves: 0, cleared: 0,
    elapsed: 0, simulationTime: 0, ticks: 0, accumulator: 0, score: 0, combo: 0, maxCombo: 0, comboTime: 0, style: 'D', duo: 0,
    status: 'playing', objective: 'Move right · clear the lockdown', players: [], enemies: [], projectiles: [], pickups: [], effects: [], events: [],
    sequence: 0, eventId: 0, boss: null, arena: { left: 0, right: DISTRICTS[0].width, active: false },
    nextGate: DISTRICTS[0].encounters[0], waveHits: 0, waveStarted: 0, waveClearDelay: 0, transitionTime: 0, cameraShake: 0, hitStop: 0,
    upgradeChoices: [], upgrades: [], mods: { damage: 1, speed: 1, dodge: 1, regen: 1, healOnKill: 0, duo: 1 },
    stats: { kills: 0, hits: 0, damageTaken: 0, damageDealt: 0, dodges: 0, specials: 0, duos: 0, noHitWaves: 0, stagesCleared: 0 } };
  s.players.push(player(s, character === 'agi' ? 'agi' : 'vlad', 0));
  if (s.coop) s.players.push(player(s, s.players[0].kind === 'vlad' ? 'agi' : 'vlad', 1));
  emit(s, 'stage', {}, { text: s.district.name, stage: 0 }); return s;
}

export function switchCharacter(s, index = 0) {
  const p = s?.players?.[index];
  if (!p || s.status !== 'playing' || s.coop || p.dead || p.tagCooldown > 0 || p.hurtTime > 0 || p.dodgeTime > 0 || p.attack) return false;
  p.kind = p.kind === 'vlad' ? 'agi' : 'vlad'; p.tagCooldown = 1.5; p.tagBufferTime = 0; p.invuln = Math.max(p.invuln, .22);
  effect(s, 'burst', p, .45); emit(s, 'tag', p); return true;
}
function spawnEnemy(s, kind, x, y) {
  const cfg = enemyTypes[kind], boss = ['warden', 'juggernaut', 'archon'].includes(kind);
  const scale = (s.coop ? 1.55 : 1) * (s.difficulty === 'story' ? .78 : 1) * (1 + s.loop * .16);
  const e = body(s, kind, clamp(x, 30, s.worldWidth - 30), y, Math.round(cfg.hp * scale));
  Object.assign(e, { boss, name: boss ? s.district.bossName : kind === 'grunt' ? 'City enforcer' : kind === 'shield' ? 'Shield sentinel' : 'Pulse ranger',
    speed: cfg.speed * (1 + Math.min(.4, s.loop * .04)), damage: cfg.damage * (s.difficulty === 'story' ? .62 : 1),
    range: cfg.range, baseWindup: cfg.windup, baseCooldown: cfg.cooldown, value: cfg.value,
    cooldown: .8 + random(s) * 1.0, spawnTime: .45, phase: 1, bossphase: 1, attackCount: 0, chargeTime: 0, chargeHits: [] });
  e.face = -1; s.enemies.push(e); effect(s, 'spawn', e, .55);
  if (boss) { s.boss = e; emit(s, 'boss', e, { text: e.name }); }
  return e;
}
function startWave(s) {
  const gate = s.district.encounters[s.stageWave], final = s.stageWave === 3;
  s.arena = { left: Math.max(20, gate - 520), right: Math.min(s.worldWidth - 20, gate + 410), active: true };
  s.wave = s.totalWaves + 1; s.waveHits = 0; s.waveStarted = s.elapsed; s.waveClearDelay = 0;
  s.objective = final ? `Defeat ${s.district.bossName}` : `Clear encounter ${s.stageWave + 1} / 4`;
  for (const p of s.players) if (!p.dead) p.x = clamp(p.x, s.arena.left + 30, s.arena.right - 30);
  if (final) {
    spawnEnemy(s, s.district.boss, gate + 160, 560);
    if (s.stage > 0) spawnEnemy(s, s.stage === 2 ? 'ranger' : 'grunt', gate + 280, 630);
  } else {
    const count = 3 + s.stageWave + (s.stage > 0 ? 1 : 0) + (s.coop ? 1 : 0) + Math.min(3, s.loop);
    for (let i = 0; i < count; i++) {
      const roll = random(s);
      const kind = s.stageWave === 0 && s.stage === 0 && i < 2 ? 'grunt' : roll > .78 ? 'ranger' : roll > .52 ? 'shield' : 'grunt';
      spawnEnemy(s, kind, gate + 70 + random(s) * 280, 485 + (i % 3) * 66 + random(s) * 12);
    }
  }
  emit(s, 'wave', {}, { amount: s.wave, text: s.objective });
}

function hitPlayer(s, p, amount, attacker) {
  if (p.dead || p.invuln > 0 || p.dodgeTime > 0) return false;
  const damage = Math.max(1, Math.round(amount)); p.hp = Math.max(0, p.hp - damage); p.invuln = .72; p.hurtTime = .25;
  p.attack = null; p.cooldown = 0; p.pose = 'hurt'; p.animTime = 0; p.hurtDuration = .25;
  p.moveX = 0; p.moveY = 0; p.vx = (p.x < attacker.x ? -1 : 1) * 180;
  s.combo = 0; s.comboTime = 0; s.waveHits++; s.stats.damageTaken += damage; s.cameraShake = Math.max(s.cameraShake, .22);
  s.hitStop = Math.max(s.hitStop, .05);
  effect(s, 'hit', p, .25, { color: '#ff6c75' }); emit(s, 'hurt', p, { amount: damage, face: p.face, strength: 'heavy' });
  if (p.hp <= 0) { p.dead = true; p.deadTime = 0; p.pose = 'hurt'; emit(s, 'down', p); }
  return true;
}
function pickup(s, kind, x, y) {
  s.pickups.push({ id: nextId(s), kind, x, y, z: 8, life: 22, maxLife: 22 });
  if (s.pickups.length > 30) s.pickups.shift();
}
function hitEnemy(s, e, p, attack) {
  if (e.dead || e.spawnTime > 0 || e.invuln > 0) return false;
  const frontal = (p.x - e.x) * e.face > 0;
  const guarded = e.kind === 'shield' && e.guardBreak <= 0 && frontal && !attack.crush && p.z < 35;
  const damage = Math.max(1, Math.round(attack.damage * s.mods.damage * (guarded ? .22 : 1)));
  e.hp = Math.max(0, e.hp - damage); s.stats.damageDealt += damage;
  if (guarded) { effect(s, 'ring', e, .25, { color: '#75d5ff' }); emit(s, 'block', e); p.energy = Math.min(p.maxEnergy, p.energy + 1); }
  else {
    if (e.kind === 'shield' && attack.crush) e.guardBreak = 1.6;
    const stagger = !e.boss || attack.crush && e.staggerCooldown <= 0;
    e.hurtTime = e.boss ? stagger ? .16 : .025 : attack.stun || .25; e.hurtDuration = e.hurtTime;
    if (stagger) {
      e.telegraph = false; e.windup = 0; e.attack = null;
      if (e.boss) { e.staggerCooldown = 2.4; e.chargeTime = 0; }
    }
    e.pose = 'hurt'; e.animTime = 0; e.moveX = 0; e.moveY = 0; e.vx = p.face * (e.boss ? 45 : attack.knockback || 110);
    if (attack.launch && !e.boss) { e.vz = attack.launch; e.z = Math.max(8, e.z); }
    s.combo++; s.maxCombo = Math.max(s.combo, s.maxCombo); s.comboTime = 3; s.stats.hits++;
    const multiplier = 1 + Math.min(4, Math.floor(s.combo / 8));
    s.score += Math.round((12 + damage * .45) * multiplier); s.duo = Math.min(100, s.duo + 2 * s.mods.duo);
    p.energy = Math.min(p.maxEnergy, p.energy + 4);
    s.cameraShake = Math.max(s.cameraShake, attack.crush ? .14 : .07);
    s.hitStop = Math.max(s.hitStop, attack.crush ? .066 : .033);
    effect(s, 'hit', { ...e, z: e.z + 40 }, .22, { strength: attack.crush ? 'heavy' : 'light', face: p.face });
    emit(s, 'hit', e, { amount: damage, player: p.index, combo: s.combo, attackKind: attack.kind || 'duo',
      comboStep: attack.stage || 0, strength: attack.crush ? 'heavy' : 'light', face: p.face });
  }
  if (e.hp <= 0) {
    e.dead = true; e.deadTime = 0; e.telegraph = false; e.windup = 0; e.attack = null; e.pose = 'hurt';
    s.stats.kills++; s.score += Math.round(e.value * (1 + Math.min(2, s.combo / 25))); s.duo = Math.min(100, s.duo + 4 * s.mods.duo);
    for (const hero of s.players) if (!hero.dead) hero.hp = Math.min(hero.maxHp, hero.hp + s.mods.healOnKill);
    const roll = random(s); if (e.boss || roll < .19) pickup(s, 'health', e.x, e.y); else if (roll < .4) pickup(s, 'energy', e.x, e.y); else if (roll < .58) pickup(s, 'score', e.x, e.y);
    effect(s, 'burst', e, .6, { color: s.district.color }); emit(s, 'kill', e, { amount: e.value, boss: e.boss });
  }
  return true;
}
function beginAttack(s, p, type) {
  if (p.attack || p.cooldown > 0 || p.hurtTime > 0 || p.dodgeTime > 0 || p.dead) return false;
  let a;
  if (type === 'special') {
    if (p.energy < 35) return false;
    p.energy -= 35; p.invuln = Math.max(p.invuln, .58); s.stats.specials++;
    a = { kind: type, damage: p.kind === 'vlad' ? 44 : 38, range: p.kind === 'vlad' ? 220 : 270, width: 130,
      impactAt: .15, activeUntil: .25, duration: .58, cancelAt: .49, stage: 3,
      crush: true, radial: true, launch: 400, knockback: 270, stun: .65 };
    emit(s, 'special', p, { attackKind: type, strength: 'special', face: p.face, swingDelay: a.impactAt });
  } else if (type === 'heavy') {
    a = { kind: type, damage: p.kind === 'vlad' ? 34 : 29, range: 142, width: 60, impactAt: .18, activeUntil: .29,
      duration: .51, cancelAt: .39, stage: 3, lunge: 35,
      crush: true, launch: 390, knockback: 240, stun: .55 };
    emit(s, 'attack', p, { text: 'heavy', attackKind: type, strength: 'heavy', face: p.face, swingDelay: a.impactAt });
  } else {
    p.comboStep = p.comboTime > 0 ? p.comboStep % 3 + 1 : 1; p.comboTime = .85;
    const finisher = p.comboStep === 3, air = p.z > 20;
    const quick = p.kind === 'agi' ? .025 : 0;
    a = { kind: air ? 'air' : 'light', damage: (p.kind === 'vlad' ? 16 : 13) + (finisher ? 8 : 0) + (air ? 4 : 0),
      range: p.kind === 'agi' ? 134 : 125, width: 58, impactAt: finisher ? .14 : p.comboStep === 2 ? .095 : .075,
      activeUntil: finisher ? .24 : .17, duration: (finisher ? .43 : p.comboStep === 2 ? .32 : .29) - quick,
      cancelAt: (finisher ? .34 : .24) - quick, stage: p.comboStep, lunge: finisher ? 34 : 20,
      crush: finisher || air, launch: finisher || air ? 310 : 0, knockback: finisher ? 220 : 42, stun: finisher ? .47 : .3 };
    emit(s, 'attack', p, { text: air ? 'air' : `combo${p.comboStep}`, attackKind: a.kind,
      comboStep: p.comboStep, strength: finisher ? 'heavy' : 'light', face: p.face, swingDelay: a.impactAt });
  }
  // A small forward/lane correction catches enemies that already overlap the animation's
  // reach. Never turn toward somebody behind the hero or pull a distant lane into a hit.
  const nearby = s.enemies.filter(e => !e.dead && e.spawnTime <= 0 && (e.x - p.x) * p.face >= -12
    && (e.x - p.x) * p.face < a.range + 35 && Math.abs(e.y - p.y) < 72)
    .sort((e, f) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 - Math.abs(f.x - p.x) - Math.abs(f.y - p.y) * 2)[0];
  const aimY = nearby && Math.abs(p.input.y || 0) < .1 ? clamp(nearby.y - p.y, -18, 18) : 0;
  p.attack = { ...a, age: 0, progress: 0, phase: 'windup', impacted: false, connected: false, hitIds: [], aimY };
  p.cooldown = a.duration; p.attackTime = a.duration; p.animTime = 0; p.actionPhase = 0;
  p.pose = type === 'special' ? 'special' : type === 'heavy' || p.comboStep === 3 || p.z > 20 ? 'kick' : 'punch'; return true;
}
function duoMove(s, p) {
  if (s.duo < 100 || p.dead || p.hurtTime > 0) return false;
  s.duo = 0; s.stats.duos++;
  for (const hero of s.players) if (!hero.dead) { hero.invuln = 1.1; hero.attack = null; hero.attackTime = .85; hero.attackDuration = .85;
    hero.cooldown = .85; hero.pose = 'special'; hero.animTime = 0; hero.moveX = 0; hero.moveY = 0; }
  const blast = { damage: 105, crush: true, launch: 470, knockback: 320, stun: 1 };
  for (const e of s.enemies) if (!e.dead && Math.abs(e.x - p.x) < 650) hitEnemy(s, e, p, blast);
  s.projectiles = []; effect(s, 'ring', p, 1, { radius: 620, color: '#e697ff' }); s.cameraShake = .5; emit(s, 'duo', p); return true;
}
function timers(s, p) {
  p.animTime += FIXED_DT;
  const wasDodging = p.dodgeTime > 0;
  for (const key of ['cooldown', 'invuln', 'hurtTime', 'dodgeTime', 'dodgeCooldown', 'tagCooldown', 'tagBufferTime', 'comboTime', 'attackTime', 'guardBreak', 'spawnTime', 'bufferTime', 'staggerCooldown', 'landingTime', 'jumpBuffer', 'dodgeBuffer'])
    if (p[key] > 0) p[key] = Math.max(0, p[key] - FIXED_DT);
  if (p.dead) p.deadTime += FIXED_DT;
  if (p.z > 0 || p.vz > 0) { p.z += p.vz * FIXED_DT; p.vz -= GRAVITY * FIXED_DT;
    if (p.z <= 0) { const impact = Math.abs(p.vz); p.z = 0; p.vz = 0; p.landingTime = .12;
      if (impact > 150) { effect(s, 'dust', p, .22); emit(s, 'land', p, { amount: impact, player: p.index }); } } }
  if (wasDodging && p.dodgeTime <= 0) { p.vx *= .18; p.vy *= .18; }
  p.x += p.vx * FIXED_DT; p.y += p.vy * FIXED_DT;
  if (p.dodgeTime <= 0 && !p.chargeTime) { p.vx *= p.z > 5 ? .93 : .78; p.vy *= .78; }
  p.actionPhase = p.hurtTime > 0 ? clamp(1 - p.hurtTime / Math.max(FIXED_DT, p.hurtDuration), 0, 1)
    : p.attackTime > 0 && !p.attack ? clamp(1 - p.attackTime / Math.max(FIXED_DT, p.attackDuration || .36), 0, 1) : 0;
}
function updatePlayer(s, p) {
  timers(s, p); if (p.dead) { p.tagBufferTime = 0; p.moveSpeed = 0; return; }
  p.energy = Math.min(p.maxEnergy, p.energy + (p.kind === 'agi' ? 3.2 : 2.6) * s.mods.regen * FIXED_DT);
  const input = p.input, pending = p.pending; p.pending = {};
  if (pending.special || pending.heavy || pending.attack) {
    // Do not let the held light button erase an intentional heavy/special tap.
    if (pending.special || pending.heavy || !p.bufferAction) p.bufferAction = pending.special ? 'special' : pending.heavy ? 'heavy' : 'light';
    p.bufferTime = .32;
  }
  if (p.bufferTime <= 0) p.bufferAction = null;
  if (pending.jump) p.jumpBuffer = .16;
  if (pending.dodge && p.hurtTime <= 0) p.dodgeBuffer = .16;
  // Keep one short tag request through recovery, without repeating a held key.
  if (pending.tag && !s.coop) p.tagBufferTime = .5;
  if (p.tagBufferTime > 0) switchCharacter(s, p.index);
  if (pending.duo) duoMove(s, p);
  const mx = input.x || 0, my = input.y || 0, norm = Math.hypot(mx, my), ux = norm > 1 ? mx / norm : mx, uy = norm > 1 ? my / norm : my;
  const recovery = p.attack ? p.attack.age >= p.attack.activeUntil : p.attackTime <= 0;
  if (p.dodgeBuffer > 0 && recovery && p.dodgeCooldown <= 0 && p.hurtTime <= 0 && p.z < 20) {
    const dx = norm > .1 ? ux : p.face, dy = norm > .1 ? uy : 0;
    p.dodgeTime = .24; p.invuln = Math.max(p.invuln, .29); p.dodgeCooldown = .72 * s.mods.dodge;
    p.attack = null; p.attackTime = 0; p.cooldown = 0; p.dodgeBuffer = 0; p.moveX = 0; p.moveY = 0;
    p.vx = dx * 590; p.vy = dy * 320; p.face = dx ? Math.sign(dx) : p.face; p.pose = 'run'; p.animTime = 0; s.stats.dodges++;
    effect(s, 'dodge', p, .3); emit(s, 'dodge', p);
  }
  if (p.hurtTime <= 0 && p.dodgeTime <= 0) {
    if (p.jumpBuffer > 0 && recovery && p.z <= 0) {
      p.vz = 480; p.z = 1; p.jumpBuffer = 0; p.attack = null; p.attackTime = 0; p.cooldown = 0; p.animTime = 0;
      emit(s, 'jump', p);
    }
    if (mx && !p.attack) p.face = Math.sign(mx);
    // One buffered input starts at the combo recovery window; the strike still gets
    // its anticipation and active frames. Finishing a move never requires key repeat.
    if (p.attack && p.attack.age >= p.attack.cancelAt && p.tagBufferTime <= 0
      && (p.bufferAction || input.attack) && p.attack.kind !== 'special') {
      p.attack = null; p.cooldown = 0; p.attackTime = 0;
    }
    if (mx && !p.attack) p.face = Math.sign(mx);
    if (p.bufferAction && beginAttack(s, p, p.bufferAction)) { p.bufferAction = null; p.bufferTime = 0; }
    else if (input.attack) beginAttack(s, p, 'light');
    const speed = (p.kind === 'agi' ? 290 : 265) * s.mods.speed;
    const mobility = p.attack ? p.attack.phase === 'recovery' ? .65 : .24 : p.attackTime > 0 ? .1 : 1;
    const accel = p.z > 0 ? 1800 : 3000, brake = p.z > 0 ? 1500 : 3600;
    p.moveX = approach(p.moveX, ux * speed * mobility, (Math.abs(ux) > .05 ? accel : brake) * FIXED_DT);
    p.moveY = approach(p.moveY, uy * speed * .64 * mobility, (Math.abs(uy) > .05 ? accel : brake) * FIXED_DT);
    p.x += p.moveX * FIXED_DT; p.y += p.moveY * FIXED_DT;
    if (!p.attack && p.attackTime <= 0) p.pose = p.z > 0 ? 'jump' : Math.hypot(p.moveX, p.moveY) > 12 ? 'run' : 'idle';
  } else { p.moveX = 0; p.moveY = 0; }
  p.moveSpeed = Math.hypot(p.moveX, p.moveY);
  if (p.z <= 0 && p.dodgeTime <= 0 && p.moveSpeed > 12) {
    const previousStep = Math.floor(p.runCycle / Math.PI);
    p.runCycle += p.moveSpeed * FIXED_DT / 94 * Math.PI;
    if (!p.attack && p.moveSpeed > 80 && Math.floor(p.runCycle / Math.PI) !== previousStep)
      emit(s, 'footstep', p, { amount: p.moveSpeed, player: p.index, stage: s.stage });
  }
  if (p.attack) {
    const a = p.attack; a.age += FIXED_DT;
    a.progress = clamp(a.age / a.duration, 0, 1); p.actionPhase = a.progress;
    a.phase = a.age < a.impactAt ? 'windup' : a.age <= a.activeUntil ? 'active' : 'recovery';
    if (a.age <= a.activeUntil && a.age >= a.impactAt) {
      p.x += p.face * (a.lunge || 0) * FIXED_DT / (a.activeUntil - a.impactAt);
      p.y += a.aimY * FIXED_DT / (a.activeUntil - a.impactAt);
    }
    if (!a.impacted && a.age >= a.impactAt) {
      a.impacted = true;
      effect(s, a.radial ? 'ring' : 'slash', { ...p, x: p.x + (a.radial ? 0 : p.face * 60), z: p.z + 45 }, .15,
        { radius: a.range, strength: a.crush ? 'heavy' : 'light', comboStep: a.stage });
      if (a.radial) effect(s, 'burst', p, .35, { color: p.kind === 'agi' ? '#eb85ff' : '#56e3ff' });
    }
    if (a.age >= a.impactAt && a.age <= a.activeUntil) {
      for (const e of s.enemies) {
        if (a.hitIds.includes(e.id)) continue;
        const dx = (e.x - p.x) * p.face;
        if ((a.radial ? Math.abs(e.x - p.x) <= a.range : dx >= -25 && dx <= a.range)
          && Math.abs(e.y - p.y) <= a.width && Math.abs(e.z - p.z) < 135 && hitEnemy(s, e, p, a)) {
          a.hitIds.push(e.id); a.connected = true;
        }
      }
    }
    if (a.age >= a.duration) p.attack = null;
  }
  // Consume the request as this move ends, before held Combo can start another.
  if (p.tagBufferTime > 0) switchCharacter(s, p.index);
  const left = s.arena.active ? s.arena.left : 20, right = s.arena.active ? s.arena.right : s.worldWidth - 20;
  p.x = clamp(p.x, left, right); p.y = clamp(p.y, s.floor.minY, s.floor.maxY);
}

function shoot(s, e, spread = 0) {
  const angle = Math.atan2(e.targetY - e.y, e.targetX - e.x) + spread;
  const speed = e.boss ? 360 : 310;
  s.projectiles.push({ id: nextId(s), kind: 'bolt', team: 'enemy', owner: e.id, x: e.x + e.face * 30, y: e.y, z: 38,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: e.damage, life: 3.5 });
  if (s.projectiles.length > 48) s.projectiles.shift();
}
function enemyStrike(s, e) {
  e.telegraph = false; e.windup = 0; e.cooldown = e.baseCooldown / (1 + (e.phase - 1) * .12); e.attackCount++;
  e.attackTime = .36; e.attackDuration = .36; e.actionPhase = 0; e.animTime = 0; e.moveSpeed = 0;
  e.pose = e.attackKind === 'shot' ? 'special' : 'kick';
  if (e.attackKind === 'shot') { shoot(s, e); if (e.kind === 'archon') { shoot(s, e, -.18); shoot(s, e, .18); } }
  else if (e.attackKind === 'charge') {
    e.chargeTime = .55; e.vx = e.face * 650; e.chargeHits = []; effect(s, 'dodge', e, .5, { color: '#ffae50' });
  } else if (e.attackKind === 'ring') {
    effect(s, 'ring', e, .45, { radius: 205, color: '#ff6c75' });
    for (const p of s.players) if (Math.abs(p.x - e.x) < 205 && Math.abs(p.y - e.y) < 100 && p.z < 65) hitPlayer(s, p, e.damage, e);
  } else for (const p of s.players) {
    const dx = (p.x - e.x) * e.face;
    if (dx > -24 && dx < e.range + 28 && Math.abs(p.y - e.y) < (e.boss ? 65 : 43) && p.z < 52) hitPlayer(s, p, e.damage, e);
  }
  emit(s, 'enemyAttack', e, { text: e.attackKind });
}
function updateEnemy(s, e) {
  timers(s, e); if (e.dead) { e.moveSpeed = 0; return; }
  e.moveSpeed = 0; e.moveX = 0; e.moveY = 0;
  if (e.boss) {
    const phase = e.hp / e.maxHp < .32 ? 3 : e.hp / e.maxHp < .65 ? 2 : 1;
    if (phase !== e.phase) { e.phase = phase; e.bossphase = phase; emit(s, 'bossPhase', e, { amount: phase }); effect(s, 'ring', e, .55); }
  }
  if (e.chargeTime > 0) {
    e.chargeTime = Math.max(0, e.chargeTime - FIXED_DT);
    for (const p of s.players) if (!e.chargeHits.includes(p.id) && Math.abs(p.x - e.x) < 75 && Math.abs(p.y - e.y) < 52 && p.z < 65) {
      if (hitPlayer(s, p, e.damage, e)) e.chargeHits.push(p.id);
    }
    if (!e.chargeTime) e.vx = 0;
  }
  e.x = clamp(e.x, s.arena.left + 15, s.arena.right - 15); e.y = clamp(e.y, s.floor.minY, s.floor.maxY);
  if (e.spawnTime > 0 || e.hurtTime > 0 || e.z > 5 || e.chargeTime > 0) return;
  const living = s.players.filter((p) => !p.dead);
  if (!living.length) return;
  const target = living.reduce((a, p) => Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 1.4 < Math.abs(a.x - e.x) + Math.abs(a.y - e.y) * 1.4 ? p : a);
  if (e.telegraph) {
    // A boss can absorb a light hit without cancelling its windup. Once that
    // brief recoil ends, show the committed warning again instead of a stale hurt pose.
    e.pose = 'idle';
    e.windup -= FIXED_DT; e.actionPhase = clamp(1 - e.windup / (e.totalWindup || e.baseWindup), 0, 1);
    if (e.windup <= 0) enemyStrike(s, e); return;
  }
  if (e.attackTime > 0) return;
  const dx = target.x - e.x, dy = target.y - e.y, dist = Math.abs(dx);
  if (Math.abs(dx) > 8) e.face = Math.sign(dx);
  const ranged = e.kind === 'ranger' || e.kind === 'archon';
  const wantsCharge = e.kind === 'juggernaut' && e.attackCount % 2 === 0;
  const reach = wantsCharge ? 520 : ranged ? 470 : e.range;
  const aligned = Math.abs(dy) < (ranged ? 100 : 37);
  const otherAttacks = s.enemies.filter((n) => !n.dead && n.id !== e.id && (n.telegraph || n.attackTime > 0 || n.chargeTime > 0)).length;
  if (dist < reach && aligned && e.cooldown <= 0 && otherAttacks < (s.coop ? 3 : 2)) {
    e.attackKind = wantsCharge ? 'charge' : e.kind === 'archon' && dist < 190 ? 'ring' : ranged ? 'shot'
      : e.kind === 'warden' && e.phase >= 2 && e.attackCount % 3 === 2 ? 'ring' : 'melee';
    e.telegraph = true; e.windup = e.baseWindup * (s.difficulty === 'story' ? 1.2 : 1);
    e.totalWindup = e.windup; e.actionPhase = 0;
    e.targetX = target.x; e.targetY = target.y; e.pose = 'idle'; e.animTime = 0; return;
  }
  // Rangers make one short space-making step after firing. Constant backwards
  // kiting made attacking heroes chase them indefinitely at their attack speed.
  const retreat = ranged && dist < 125 && e.cooldown > e.baseCooldown * .72;
  const moveX = dist > (ranged ? 290 : e.range * .73) ? Math.sign(dx) : retreat ? -Math.sign(dx) : 0;
  const approachLane = dy + (!ranged && dist > 150 ? (e.id % 3 - 1) * 25 : 0);
  const moveY = Math.abs(approachLane) > 12 ? Math.sign(approachLane) : 0;
  e.moveX = moveX * e.speed; e.moveY = moveY * e.speed * .52;
  e.x += e.moveX * FIXED_DT; e.y += e.moveY * FIXED_DT;
  e.moveSpeed = Math.hypot(e.moveX, e.moveY); e.runCycle += e.moveSpeed * FIXED_DT / 94 * Math.PI;
  e.x = clamp(e.x, s.arena.left + 15, s.arena.right - 15); e.y = clamp(e.y, s.floor.minY, s.floor.maxY);
  e.pose = moveX || moveY ? 'run' : 'idle';
}

function finishWave(s) {
  s.arena.active = false; s.totalWaves++; s.cleared++; s.stageWave++;
  const noHit = s.waveHits === 0;
  const bonus = 350 + (noHit ? 650 : 0) + Math.max(0, Math.round(300 - (s.elapsed - s.waveStarted) * 5));
  s.score += bonus; if (noHit) s.stats.noHitWaves++;
  emit(s, 'waveClear', {}, { amount: bonus, text: noHit ? 'NO HIT · sector clear' : 'Sector clear', noHit });
  for (const p of s.players) {
    if (p.dead) { p.dead = false; p.hp = Math.round(p.maxHp * .35); p.z = 0; p.vz = 0; p.invuln = 2; }
    p.energy = Math.min(p.maxEnergy, p.energy + 15);
    if (p.hp < p.maxHp * .55) pickup(s, 'health', p.x + 35, p.y);
  }
  if (s.stageWave < 4) { s.nextGate = s.district.encounters[s.stageWave]; s.objective = 'Sector clear · move right'; return; }
  s.stats.stagesCleared++;
  if (s.stage === 2 && s.mode !== 'endless') {
    s.status = 'victory'; s.objective = 'Memories restored · city liberated'; s.score += 3000 + Math.max(0, Math.round(240 - s.elapsed) * 10);
    emit(s, 'victory', {}, { amount: s.score, text: s.objective });
  } else {
    s.status = 'upgrade'; s.objective = 'Choose an upgrade for the next district';
    const options = [...UPGRADES];
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    s.upgradeChoices = options.slice(0, 3); emit(s, 'upgrade', {}, { text: s.objective });
  }
}

export function chooseUpgrade(s, id) {
  if (!s || s.status !== 'upgrade' || !s.upgradeChoices.some((u) => u.id === id)) return false;
  s.upgrades.push(id);
  if (id === 'kinetic') s.mods.damage *= 1.18;
  else if (id === 'reflex') { s.mods.speed *= 1.10; s.mods.dodge *= .82; }
  else if (id === 'salvage') s.mods.healOnKill += 4;
  else if (id === 'sync') s.mods.duo *= 1.35;
  else if (id === 'capacitor') { s.mods.regen *= 1.4; for (const p of s.players) p.maxEnergy += 25; }
  else if (id === 'repair') for (const p of s.players) { p.maxHp += 25; p.hp += 35; }
  s.stage++; if (s.stage >= DISTRICTS.length) { s.stage = 0; s.loop++; }
  s.district = DISTRICTS[s.stage]; s.worldWidth = s.district.width; s.cameraX = 0;
  s.stageWave = 0; s.nextGate = s.district.encounters[0]; s.enemies = []; s.projectiles = []; s.pickups = []; s.effects = [];
  s.boss = null; s.arena = { left: 0, right: s.worldWidth, active: false }; s.status = 'playing'; s.upgradeChoices = [];
  s.objective = s.district.subtitle; s.accumulator = 0;
  for (const p of s.players) {
    p.x = 220 + p.index * 75; p.y = 550 + p.index * 55; p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0;
    p.moveX = 0; p.moveY = 0; p.moveSpeed = 0; p.runCycle = 0; p.jumpBuffer = 0; p.dodgeBuffer = 0; p.actionPhase = 0;
    p.hp = Math.min(p.maxHp, Math.max(p.maxHp * .55, p.hp + 32)); p.energy = p.maxEnergy; p.dead = false;
    p.attack = null; p.cooldown = 0; p.hurtTime = 0; p.invuln = 1.0; p.pose = 'idle'; p.pending = {}; p.previous = {}; p.bufferAction = null; p.bufferTime = 0; p.tagBufferTime = 0;
  }
  emit(s, 'stage', {}, { stage: s.stage, text: s.district.name }); return true;
}

function fixedStep(s) {
  s.ticks++; s.elapsed = s.ticks * FIXED_DT;
  // Contact freezes bodies and animation for two to four frames. Inputs are still
  // collected by stepGame, so hit confirmation never swallows a quick next move.
  if (s.hitStop > 0) { s.hitStop = Math.max(0, s.hitStop - FIXED_DT); return; }
  s.simulationTime += FIXED_DT;
  s.comboTime = Math.max(0, s.comboTime - FIXED_DT); if (!s.comboTime) s.combo = 0;
  s.style = s.combo >= 45 ? 'SS' : s.combo >= 28 ? 'S' : s.combo >= 16 ? 'A' : s.combo >= 8 ? 'B' : s.combo >= 3 ? 'C' : 'D';
  s.cameraShake = Math.max(0, s.cameraShake - FIXED_DT);
  for (const p of s.players) updatePlayer(s, p);
  if (!s.arena.active && s.stageWave < 4 && s.players.some((p) => !p.dead && p.x >= s.nextGate - 430)) startWave(s);
  for (const e of s.enemies) updateEnemy(s, e);
  // Light separation prevents unreadable enemy stacks without adding random steering.
  for (let i = 0; i < s.enemies.length; i++) for (let j = i + 1; j < s.enemies.length; j++) {
    const a = s.enemies[i], b = s.enemies[j];
    if (a.dead || b.dead || a.boss || b.boss || a.telegraph || b.telegraph) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 48 && Math.abs(dy) < 32) { const direction = dy ? Math.sign(dy) : a.id % 2 ? 1 : -1;
      a.y = clamp(a.y - direction * 35 * FIXED_DT, s.floor.minY, s.floor.maxY);
      b.y = clamp(b.y + direction * 35 * FIXED_DT, s.floor.minY, s.floor.maxY); }
  }
  for (const bolt of s.projectiles) {
    bolt.x += bolt.vx * FIXED_DT; bolt.y += bolt.vy * FIXED_DT; bolt.life -= FIXED_DT;
    for (const p of s.players) if (!p.dead && Math.abs(p.x - bolt.x) < 27 && Math.abs(p.y - bolt.y) < 25 && p.z < 65) {
      if (hitPlayer(s, p, bolt.damage, bolt)) { bolt.life = 0; break; }
    }
  }
  s.projectiles = s.projectiles.filter((b) => b.life > 0 && b.x > -100 && b.x < s.worldWidth + 100 && b.y > 350 && b.y < 780);
  for (const item of s.pickups) {
    item.life -= FIXED_DT;
    const p = s.players.find((p) => !p.dead && Math.abs(p.x - item.x) < 45 && Math.abs(p.y - item.y) < 35 && p.z < 40);
    if (!p) continue;
    if (item.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + 30);
    else if (item.kind === 'energy') p.energy = Math.min(p.maxEnergy, p.energy + 32);
    else s.score += 200;
    item.life = 0; effect(s, 'heal', p, .45); emit(s, 'pickup', item);
  }
  s.pickups = s.pickups.filter((p) => p.life > 0);
  for (const fx of s.effects) fx.life -= FIXED_DT;
  s.effects = s.effects.filter((fx) => fx.life > 0); s.enemies = s.enemies.filter((e) => !e.dead || e.deadTime < .8);
  if (s.players.every((p) => p.dead)) {
    s.status = 'gameover'; s.objective = 'Connection lost · run ended'; emit(s, 'gameover', {}, { amount: s.score });
  } else if (s.arena.active && !s.enemies.some((e) => !e.dead)) {
    s.waveClearDelay += FIXED_DT; if (s.waveClearDelay >= .65) finishWave(s);
  }
  const living = s.players.filter((p) => !p.dead), focus = living.length ? living.reduce((n, p) => n + p.x, 0) / living.length : s.players[0].x;
  const target = clamp(focus - 450, 0, Math.max(0, s.worldWidth - s.width));
  s.cameraX += (target - s.cameraX) * .12;
  // Co-op stays in one readable camera; a runner cannot vanish several screens away.
  if (s.coop && living.length === 2) {
    const left = Math.min(...living.map((p) => p.x)); for (const p of living) p.x = Math.min(p.x, left + 900);
  }
}

export function stepGame(s, inputs = [], dt = FIXED_DT) {
  if (!s || s.status !== 'playing') return s;
  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i], input = inputs[i] || {};
    p.input = { x: clamp(finite(input.x), -1, 1), y: clamp(finite(input.y), -1, 1), attack: Boolean(input.attack) };
    for (const action of ACTIONS) { const down = Boolean(input[action]); if (down && !p.previous[action]) p.pending[action] = true; p.previous[action] = down; }
  }
  s.accumulator += clamp(finite(dt), 0, .25);
  let count = 0;
  while (s.accumulator + 1e-10 >= FIXED_DT && count++ < 15 && s.status === 'playing') {
    s.accumulator = Math.max(0, s.accumulator - FIXED_DT); fixedStep(s);
  }
  return s;
}
