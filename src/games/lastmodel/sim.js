// LAST MODEL STANDING: the world, simulated. AGI-1 on an endless server floor, the bots the director sends, her eight
// weapons, the chips, hearts, magnets, purges and caches they drop, the bosses, level-ups and the win at 10:00. No DOM, no
// clock, no Math.random: a seed and her moves make the run (the demo repeats exactly; tests/lastmodel.test.js runs it in
// Node). Fixed steps (STEP). What happens is told to the screen and the speakers as events (`events`, `nev`), read and
// cleared once a frame by ./game.js. Hot loops allocate nothing: bots, shots, chips and events live in pools.
import {
  WEAPONS, WEAPON, ENEMIES, KINDS, ELITE, BOSSES, WIN_TIME, ENEMY_CAP, PLAYER_RADIUS, IFRAMES, CRIT_CHANCE,
  hpMul, dmgMul, speedMul, xpToNext, chipTier, hitDamage, playerDamage, derived, newLoadout, makeOffers, applyOffer, offerPool,
  metaBonuses,
} from './rules.js';
import { SpatialHash } from './spatial.js';
import { createDirector } from './director.js';
import { rng as makeRng } from '../kit/fx.js';

export const STEP = 1 / 120;
export const EV = {
  HIT: 1, KILL: 2, XP: 3, LEVEL: 4, HURT: 5, FIRE: 6, BLAST: 7, STRIKE: 8, NOVA: 9, BOSS: 10, BOSSDOWN: 11, PICK: 12,
  CACHE: 13, WIN: 14, DEATH: 15, ELITE: 16, RING: 17, FLOCK: 18, SHOOT: 19, DASH: 20, CRATE: 21, PURGE: 22, WALL: 23,
  SUMMON: 24, CHARGE: 25, HEAL: 26,
};
export const CRATE = 9;                       // a breakable server crate (an "enemy" that never moves or bites)
const W_INDEX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
const MAX_E = ENEMY_CAP + 60, MAX_P = 420, MAX_B = 320, MAX_G = 420, MAX_K = 24, MAX_EV = 768;
const TAU = Math.PI * 2;

const newEnemy = () => ({
  kind: 0, k: 'spam', x: 0, y: 0, kx: 0, ky: 0, r: 6, scale: 1, hp: 1, maxHp: 1, speed: 0, dmg: 0, xp: 0, mass: 0,
  elite: false, boss: false, dead: false, t: 0, flash: 0, slow: 0, slowAmt: 0, stun: 0, phase: 0, hidden: false,
  cd: 0, cd2: 0, state: 0, st: 0, ang: 0, wob: 0, hx: 0, hy: 0, id: 0, face: 1, alpha: 1, n: 0, flock: 0,
  hitFire: -9, hitBack: -9, streamId: 0, novaId: 0, noTarget: false, moving: 0,
});
const newShot = () => ({ kind: 0, x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 0, life: 0, t: 0, pierce: 0, hits: new Int32Array(8), nh: 0, target: null, tid: 0, state: 0, sp: 0, ang: 0, w: 0, x0: 0, y0: 0, dead: false });
const newBullet = () => ({ kind: 0, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 0, life: 0, t: 0 });
const newGem = () => ({ x: 0, y: 0, v: 1, tier: 0, pulled: false, sp: 0, t: 0, vx: 0, vy: 0 });
const newEvent = () => ({ type: 0, x: 0, y: 0, a: 0, b: 0, c: 0, s: '' });

export const SHOT = { BOLT: 1, HEAD: 2, BACK: 3 };
export const BULLET = { TROLL: 1, PACKET: 2, COOKIE: 3, OVERFIT: 4 };

export function createSim({ seed = 1, meta = {}, start = null, view = { hw: 200, hh: 320 }, auto = false, god = false } = {}) {
  const rng = makeRng(seed >>> 0 || 1);
  const from = start?.t || 0;
  // (the demo asks for a busier floor: `start.busy` multiplies the director's budget)
  const director = createDirector(makeRng(((seed * 2654435761) ^ 0x5bd1e995) >>> 0 || 7), { from, busy: start?.busy || 1 });
  const mb = metaBonuses(meta);
  const hash = new SpatialHash({ cell: 24, max: MAX_E, bits: 11 });
  const found = new Int32Array(MAX_E);
  const found2 = new Int32Array(64);

  const E = Array.from({ length: MAX_E }, newEnemy);
  const S = Array.from({ length: MAX_P }, newShot);
  const B = Array.from({ length: MAX_B }, newBullet);
  const G = Array.from({ length: MAX_G }, newGem);
  const K = [];                                  // pickups: { kind, x, y, t, n, pulled }
  const events = Array.from({ length: MAX_EV }, newEvent);

  const sim = {
    seed, t: from, events, nev: 0, view: { hw: view.hw, hh: view.hh }, auto, god,
    E, en: 0, S, sn: 0, B, bn: 0, G, gn: 0, K,
    beams: [], novas: [], strikes: [], fw: { on: false, t: 0, ang: 0, n: 0, r: 0, blocks: [] }, field: { r: 0, t: 0 },
    player: {
      x: 0, y: 0, vx: 0, vy: 0, fx: 1, fy: 0, face: 1, hp: 100, maxHp: 100, iframes: 0, level: 1, xp: 0, need: xpToNext(1),
      dead: false, deadT: 0, moving: false, walk: 0, hurtT: 0, regenAcc: 0, magnet: 30, speed: 86,
    },
    loadout: newLoadout('bolt'), D: null,
    kills: 0, bossesDown: 0, bonus: 0, won: false, winPause: false, choosing: false, pending: 0, offers: [], rerolls: 1 + mb.rerolls,
    boss: null, dmgBy: new Float64Array(WEAPONS.length), lastCache: [], nextId: 1, streamN: 0, novaN: 0, xpChain: 0,
    gemsTaken: 0, ended: false,
  };
  const P = sim.player;
  const wstate = Object.fromEntries(WEAPONS.map((w) => [w.id, { cd: 0.4, burst: 0, bt: 0, tick: 0 }]));

  // ---------- events ----------
  function emit(type, x = 0, y = 0, a = 0, b = 0, c = 0, s = '') {
    if (sim.nev >= MAX_EV) { if (type === EV.HIT || type === EV.XP) return; sim.nev = MAX_EV - 1; }
    const e = events[sim.nev++];
    e.type = type; e.x = x; e.y = y; e.a = a; e.b = b; e.c = c; e.s = s;
  }

  // ---------- her numbers ----------
  function restat() {
    sim.D = derived(sim.loadout, meta);
    const hpWas = P.maxHp;
    P.maxHp = sim.D.maxHp + (start?.hp || 0);
    if (P.maxHp > hpWas) P.hp += P.maxHp - hpWas;
    P.hp = Math.min(P.hp, P.maxHp);
    P.magnet = sim.D.magnet;
    P.speed = sim.D.speed;
  }
  restat();
  P.hp = P.maxHp;

  // ---------- where things appear: just off the screen, along the ray at `ang` ----------
  function edgePoint(ang, margin = 22) {
    const hw = sim.view.hw + margin, hh = sim.view.hh + margin;
    const c = Math.cos(ang), s = Math.sin(ang);
    const k = Math.min(Math.abs(c) > 1e-6 ? hw / Math.abs(c) : 1e9, Math.abs(s) > 1e-6 ? hh / Math.abs(s) : 1e9);
    return [P.x + c * k, P.y + s * k];
  }

  // ---------- bots ----------
  function spawn(k, x, y, { elite = false, bossHp = 1 } = {}) {
    if (sim.en >= MAX_E) return null;
    const def = k === 'crate' ? null : ENEMIES[k];
    const e = E[sim.en++];
    const mul = def?.boss ? (start?.bossHpMul || 1) * bossHp : hpMul(sim.t);
    e.k = k; e.kind = def ? def.id : CRATE; e.x = x; e.y = y; e.kx = 0; e.ky = 0;
    e.elite = elite; e.boss = Boolean(def?.boss); e.dead = false; e.t = 0; e.flash = 0; e.slow = 0; e.slowAmt = 0; e.stun = 0;
    e.scale = elite ? ELITE.scale : 1;
    e.r = (def ? def.r : 7) * e.scale;
    e.maxHp = e.hp = def ? Math.round(def.hp * mul * (elite ? ELITE.hpMul : 1)) : 1;
    e.speed = def ? def.speed * (elite ? ELITE.speedMul : 1) * (def.boss ? 1 : speedMul(sim.t)) * (0.92 + rng.next() * 0.16) : 0;
    e.dmg = def ? def.dmg * (elite ? ELITE.dmgMul : 1) : 0;
    e.xp = def ? (elite ? ELITE.xp : def.xp) : 0;
    e.mass = def ? (elite ? Math.max(0.6, def.mass) : def.mass) : 1;
    e.phase = rng.range(0, 4); e.hidden = false; e.alpha = 1;
    e.cd = rng.range(0.8, 2.6); e.cd2 = rng.range(1, 3); e.state = 0; e.st = 0; e.n = 0;
    e.ang = rng.range(-0.55, 0.55); e.wob = rng.range(0, TAU); e.hx = 0; e.hy = 0;
    e.id = sim.nextId++; e.face = x < P.x ? 1 : -1; e.flock = 0; e.moving = 0;
    e.hitFire = -9; e.hitBack = -9; e.streamId = 0; e.novaId = 0;
    e.noTarget = !def;
    if (e.boss) { sim.boss = e; e.cd = 3; e.cd2 = 5; }
    return e;
  }
  function spawnOrder(o) {
    if (o.mode === 'boss') {
      const [x, y] = edgePoint(o.ang, 40);
      const e = spawn(o.kind, x, y);
      if (e) emit(EV.BOSS, x, y, ENEMIES[o.kind].id, 0, 0, o.kind);
    } else if (o.mode === 'ring') {
      const R = Math.max(sim.view.hw, sim.view.hh) + 34;
      for (let i = 0; i < o.n; i++) {
        const a = (i / o.n) * TAU;
        const e = spawn(o.kind, P.x + Math.cos(a) * R, P.y + Math.sin(a) * R);
        if (e) e.ang = 0;
      }
      emit(EV.RING, P.x, P.y, o.n);
    } else if (o.mode === 'flock') {
      const [x, y] = edgePoint(o.ang, 30);
      const hx = P.x - x, hy = P.y - y, hd = Math.hypot(hx, hy) || 1;
      const flock = sim.nextId;
      const n = Math.min(o.n, Math.max(4, ENEMY_CAP + 20 - sim.en));
      for (let i = 0; i < n; i++) {
        const e = spawn('swarm', x + rng.range(-26, 26), y + rng.range(-26, 26));
        if (!e) break;
        e.hx = hx / hd; e.hy = hy / hd; e.flock = flock;
      }
      emit(EV.FLOCK, x, y, n);
    } else {
      const [x, y] = edgePoint(o.ang);
      const e = spawn(o.kind, x, y, { elite: o.elite });
      if (e && o.elite) emit(EV.ELITE, x, y, e.kind);
    }
  }

  // ---------- hurting bots ----------
  function hurt(e, base, w, kx = 0, ky = 0, kb = 0) {
    if (e.dead || e.hidden) return false;
    const crit = rng.next() < CRIT_CHANCE;
    const dmg = hitDamage(base, sim.D.dmg, crit);
    e.hp -= dmg;
    // the field's ticks hit everything around her at once: a blink, not a full flash (she'd vanish in white)
    const tick = w === W_INDEX.field;
    e.flash = tick ? 0.045 : 0.1;
    if (w >= 0) sim.dmgBy[w] += Math.min(dmg, e.hp + dmg);
    if (kb) {
      const push = kb * (1 - e.mass);
      e.kx += kx * push; e.ky += ky * push;
    }
    // b: 1 a crit, 2 a tick of the field · c: the bot's id (its numbers add up instead of piling)
    emit(EV.HIT, e.x, e.y - e.r * 0.6, dmg, (crit ? 1 : 0) | (tick ? 2 : 0), e.id);
    if (e.hp <= 0) kill(e, w);
    return true;
  }
  function kill(e, w, { quiet = false } = {}) {
    if (e.dead) return;
    e.dead = true;
    if (e.kind === CRATE) { breakCrate(e); return; }
    sim.kills++;
    emit(EV.KILL, e.x, e.y, e.kind, e.elite ? 1 : 0, e.scale, quiet ? 'q' : '');
    if (e.boss) {
      sim.bossesDown++;
      if (sim.boss === e) sim.boss = null;
      emit(EV.BOSSDOWN, e.x, e.y, e.kind, 0, 0, e.k);
      dropPickup('cache', e.x, e.y, 3);
      for (let i = 0; i < 10; i++) dropGem(e.x + rng.range(-22, 22), e.y + rng.range(-22, 22), Math.ceil(e.xp / 10));
      return;
    }
    if (e.elite) dropPickup('cache', e.x, e.y, 1);
    if (e.k === 'swarm' && rng.next() < 0.4) return;
    dropGem(e.x, e.y, e.xp);
    const roll = rng.next();
    if (roll < 0.0035) dropPickup('heart', e.x, e.y);
    else if (roll < 0.0052) dropPickup('magnet', e.x, e.y);
    else if (roll < 0.0062) dropPickup('purge', e.x, e.y);
  }
  function breakCrate(e) {
    emit(EV.CRATE, e.x, e.y);
    const r = rng.next();
    dropPickup(r < 0.42 ? 'heart' : r < 0.7 ? 'magnet' : r < 0.86 ? 'purge' : 'chip', e.x, e.y);
  }

  // ---------- chips and pickups ----------
  function dropGem(x, y, v) {
    if (v <= 0) return;
    if (sim.gn >= MAX_G) {
      // too many on the floor: this one joins the oldest one still lying there (nothing is lost)
      const g = G[(sim.gemsTaken++) % sim.gn];
      g.v += v; g.tier = chipTier(g.v);
      return;
    }
    const g = G[sim.gn++];
    g.x = x; g.y = y; g.v = v; g.tier = chipTier(v); g.pulled = false; g.sp = 0; g.t = 0;
    const a = rng.range(0, TAU), s = rng.range(10, 34);
    g.vx = Math.cos(a) * s; g.vy = Math.sin(a) * s;
  }
  function dropPickup(kind, x, y, n = 1) {
    if (kind === 'chip') { dropGem(x, y, 16); return; }
    if (K.length >= MAX_K) {
      const i = K.findIndex((k) => k.kind !== 'cache');
      if (i < 0) return;
      K.splice(i, 1);
    }
    K.push({ kind, x, y, t: 0, n, pulled: false });
  }

  // ---------- XP and level-ups ----------
  function gainXp(v) {
    P.xp += v * sim.D.xp;
    while (P.xp >= P.need) {
      P.xp -= P.need;
      P.level++;
      P.need = xpToNext(P.level);
      sim.pending++;
      emit(EV.LEVEL, P.x, P.y, P.level);
    }
    if (sim.pending && !sim.choosing) openChoice();
  }
  function openChoice() {
    sim.offers = makeOffers(sim.loadout, rng, 3);
    sim.choosing = true;
    if (sim.auto) sim.choose(0);
  }
  function apply(offer) {
    if (offer.type === 'heal') { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4); emit(EV.HEAL, P.x, P.y, P.maxHp * 0.4); }
    else if (offer.type === 'bonus') sim.bonus += 500;
    else {
      const had = offer.type === 'weapon' ? sim.loadout.weapons[offer.id] : 0;
      sim.loadout = applyOffer(sim.loadout, offer);
      if (offer.type === 'weapon' && !had) wstate[offer.id].cd = 0.2;
      restat();
    }
  }
  sim.choose = (i) => {
    if (!sim.choosing) return null;
    const offer = sim.offers[Math.max(0, Math.min(sim.offers.length - 1, i | 0))];
    if (!offer) return null;
    apply(offer);
    sim.pending = Math.max(0, sim.pending - 1);
    sim.choosing = false;
    sim.offers = [];
    if (sim.pending) openChoice();
    return offer;
  };
  sim.reroll = () => {
    if (!sim.choosing || sim.rerolls <= 0) return false;
    sim.rerolls--;
    sim.offers = makeOffers(sim.loadout, rng, 3, sim.offers);
    return true;
  };
  // a cache: `n` upgrades, picked for her (more likely what she already has)
  function openCache(n) {
    sim.lastCache = [];
    for (let i = 0; i < n; i++) {
      const pool = offerPool(sim.loadout);
      let offer;
      if (pool.length) {
        const pick = rng.weighted(pool);
        offer = { type: pick.type, id: pick.id, level: pick.level, isNew: pick.isNew };
      } else offer = i % 2 ? { type: 'bonus', id: 'bonus', level: 0, isNew: false } : { type: 'heal', id: 'heal', level: 0, isNew: false };
      apply(offer);
      sim.lastCache.push(offer);
    }
    emit(EV.CACHE, P.x, P.y, n);
  }

  // ---------- her ----------
  function hurtPlayer(raw) {
    if (P.dead || P.iframes > 0 || sim.god) return;
    const dmg = playerDamage(raw * dmgMul(sim.t), sim.D.armor);
    P.hp -= dmg;
    P.iframes = IFRAMES;
    P.hurtT = 0.25;
    emit(EV.HURT, P.x, P.y, dmg, P.hp / P.maxHp);
    if (P.hp <= 0) {
      P.hp = 0;
      P.dead = true;
      P.deadT = 0;
      emit(EV.DEATH, P.x, P.y);
    }
  }

  // ---------- targeting ----------
  function nearest(x, y, maxD = 1e9, skipId = 0) {
    let best = null, bd = maxD * maxD;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead || e.hidden || e.noTarget || e.id === skipId) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // the k nearest (distinct), into `found2`; → how many
  function nearestK(k, maxD) {
    let n = 0;
    const lim = maxD * maxD;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead || e.hidden || e.noTarget) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = dx * dx + dy * dy;
      if (d > lim) continue;
      if (n < k) { found2[n++] = i; }
      else {
        // replace the farthest kept one if this one is nearer
        let far = 0, fd = -1;
        for (let j = 0; j < n; j++) {
          const f = E[found2[j]], ddx = f.x - P.x, ddy = f.y - P.y, dd = ddx * ddx + ddy * ddy;
          if (dd > fd) { fd = dd; far = j; }
        }
        if (d < fd) found2[far] = i;
      }
    }
    return n;
  }
  const inView = (e, m = 0) => Math.abs(e.x - P.x) < sim.view.hw + m && Math.abs(e.y - P.y) < sim.view.hh + m;

  // ---------- shots ----------
  function shot(kind) {
    if (sim.sn >= MAX_P) return null;
    const s = S[sim.sn++];
    s.kind = kind; s.nh = 0; s.dead = false; s.t = 0; s.state = 0; s.target = null; s.tid = 0; s.ang = 0; s.sp = 0;
    return s;
  }
  function fireBolt(lv, target) {
    const s = shot(SHOT.BOLT);
    if (!s) return;
    let ax = P.fx, ay = P.fy;
    if (target) { const dx = target.x - P.x, dy = target.y - 3 - P.y, d = Math.hypot(dx, dy) || 1; ax = dx / d; ay = dy / d; }
    s.x = P.x + ax * 6; s.y = P.y - 8 + ay * 6;
    s.vx = ax * lv.speed; s.vy = ay * lv.speed;
    s.r = 3.2 * Math.sqrt(sim.D.area); s.dmg = lv.dmg; s.life = 1.25; s.pierce = lv.pierce;
    emit(EV.SHOOT, s.x, s.y, W_INDEX.bolt, Math.atan2(ay, ax));
  }

  // ---------- each weapon, each step ----------
  function weapons(dt) {
    const L = sim.loadout.weapons, D = sim.D;
    // PROMPT BOLT: a burst at the nearest bots
    if (L.bolt) {
      const lv = WEAPON.bolt.levels[L.bolt - 1], w = wstate.bolt;
      if (w.burst > 0) {
        w.bt -= dt;
        if (w.bt <= 0) {
          const i = lv.count - w.burst;
          const n = nearestK(lv.count, 300);
          const target = n ? E[found2[i % n]] : null;
          if (target || i === 0) fireBolt(lv, target);
          w.burst--; w.bt = 0.075;
        }
      } else if ((w.cd -= dt) <= 0) {
        if (nearest(P.x, P.y, 300)) { w.burst = lv.count; w.bt = 0; w.cd = lv.cd * D.cdMul; }
        else w.cd = 0.1;
      }
    }
    // FIREWALL: blocks orbit while it's up
    const fw = sim.fw;
    if (L.firewall) {
      const lv = WEAPON.firewall.levels[L.firewall - 1];
      fw.t -= dt;
      if (fw.t <= 0) {
        fw.on = !fw.on || lv.off === 0;
        fw.t = fw.on ? lv.on : lv.off * D.cdMul;
        if (fw.on) emit(EV.WALL, P.x, P.y, lv.count);
      }
      fw.n = lv.count; fw.r = lv.r * D.area;
      fw.ang += lv.spin * dt;
      if (fw.on) {
        const br = 8 * Math.sqrt(D.area);
        for (let b = 0; b < lv.count; b++) {
          const a = fw.ang + (b / lv.count) * TAU;
          const bx = P.x + Math.cos(a) * fw.r, by = P.y - 6 + Math.sin(a) * fw.r;
          if (!fw.blocks[b]) fw.blocks[b] = { x: 0, y: 0 };
          fw.blocks[b].x = bx; fw.blocks[b].y = by;
          const n = hash.query(bx, by, br, found, maxR);
          for (let j = 0; j < n; j++) {
            const e = E[found[j]];
            if (e.dead || sim.t - e.hitFire < 0.42) continue;
            e.hitFire = sim.t;
            const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
            hurt(e, lv.dmg, W_INDEX.firewall, dx / d, dy / d, 90);
          }
        }
      }
    } else fw.on = false;
    // TOKEN STREAM: a beam the way she's heading (and behind her later)
    if (L.stream) {
      const lv = WEAPON.stream.levels[L.stream - 1], w = wstate.stream;
      if ((w.cd -= dt) <= 0) {
        w.cd = lv.cd * D.cdMul;
        const id = ++sim.streamN;
        // where she's heading, locked onto the nearest bot within 50° of it (or straight ahead)
        let ax = P.fx, ay = P.fy, best = 1e9;
        for (let j = 0; j < sim.en; j++) {
          const e = E[j];
          if (e.dead || e.hidden || e.noTarget) continue;
          const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
          if (d > lv.len * D.area || d >= best || (dx * P.fx + dy * P.fy) / d < 0.64) continue;
          best = d; ax = dx / d; ay = dy / d;
        }
        for (let k = 0; k < (lv.dual ? 2 : 1); k++) {
          const dir = k ? -1 : 1;
          sim.beams.push({ id, dx: ax * dir, dy: ay * dir, len: lv.len * D.area, w: lv.w * Math.sqrt(D.area), t: 0, life: 0.26, dmg: lv.dmg });
        }
        emit(EV.FIRE, P.x, P.y, W_INDEX.stream, Math.atan2(ay, ax));
      }
    }
    for (let i = sim.beams.length - 1; i >= 0; i--) {
      const bm = sim.beams[i];
      bm.t += dt;
      if (bm.t >= bm.life) { sim.beams.splice(i, 1); continue; }
      const x0 = P.x, y0 = P.y - 8, len = bm.len * Math.min(1, bm.t / 0.06), hw = bm.w / 2;
      for (let j = 0; j < sim.en; j++) {
        const e = E[j];
        if (e.dead || e.hidden || e.streamId === bm.id) continue;
        const px = e.x - x0, py = e.y - y0;
        const along = px * bm.dx + py * bm.dy;
        if (along < -e.r || along > len + e.r) continue;
        const side = Math.abs(px * bm.dy - py * bm.dx);
        if (side > hw + e.r) continue;
        e.streamId = bm.id;
        hurt(e, bm.dmg, W_INDEX.stream, bm.dx, bm.dy, 70);
      }
    }
    // GRADIENT RAIN: strikes on random bots on the screen
    if (L.rain) {
      const lv = WEAPON.rain.levels[L.rain - 1], w = wstate.rain;
      if ((w.cd -= dt) <= 0) {
        let n = 0;
        for (let i = 0; i < sim.en && n < found.length; i++) {
          const e = E[i];
          if (!e.dead && !e.hidden && !e.noTarget && inView(e, -6)) found[n++] = i;
        }
        if (!n) w.cd = 0.15;
        else {
          w.cd = lv.cd * D.cdMul;
          const big = sim.boss && !sim.boss.dead && inView(sim.boss, -10) ? sim.boss : null;
          for (let k = 0; k < lv.count; k++) {
            if (big && rng.next() < 0.35) { sim.strikes.push({ x: big.x + rng.range(-6, 6), y: big.y - 6 + rng.range(-6, 6), t: -k * 0.07, fall: 0.2, r: lv.r * D.area, dmg: lv.dmg, done: false }); continue; }
            const j = rng.int(0, n - 1), e = E[found[j]];
            found[j] = found[--n];
            sim.strikes.push({ x: e.x, y: e.y, t: -k * 0.07, fall: 0.2, r: lv.r * D.area, dmg: lv.dmg, done: false });
            if (!n) break;
          }
          emit(EV.FIRE, P.x, P.y, W_INDEX.rain);
        }
      }
    }
    for (let i = sim.strikes.length - 1; i >= 0; i--) {
      const st = sim.strikes[i];
      st.t += dt;
      if (!st.done && st.t >= st.fall) {
        st.done = true;
        const n = hash.query(st.x, st.y, st.r, found, maxR);
        for (let j = 0; j < n; j++) {
          const e = E[found[j]];
          const dx = e.x - st.x, dy = e.y - st.y, d = Math.hypot(dx, dy) || 1;
          hurt(e, st.dmg, W_INDEX.rain, dx / d, dy / d, 50);
        }
        emit(EV.STRIKE, st.x, st.y, st.r);
      }
      if (st.t > st.fall + 0.35) sim.strikes.splice(i, 1);
    }
    // ATTENTION HEADS: homing eyes
    if (L.heads) {
      const lv = WEAPON.heads.levels[L.heads - 1], w = wstate.heads;
      if ((w.cd -= dt) <= 0) {
        const n = nearestK(lv.count + 3, 300);
        if (!n) w.cd = 0.15;
        else {
          w.cd = lv.cd * D.cdMul;
          // attention goes where it matters: the toughest bots near her first (a boss, an elite)
          for (let a = 1; a < n; a++) for (let c = a; c > 0 && E[found2[c]].hp > E[found2[c - 1]].hp; c--) { const t = found2[c]; found2[c] = found2[c - 1]; found2[c - 1] = t; }
          for (let k = 0; k < lv.count; k++) {
            const s = shot(SHOT.HEAD);
            if (!s) break;
            const target = E[found2[k % Math.min(n, lv.count)]];
            const a = Math.atan2(target.y - P.y, target.x - P.x) + (k - (lv.count - 1) / 2) * 0.9 + Math.PI * (k % 2 ? 0.25 : -0.25);
            s.x = P.x; s.y = P.y - 10; s.ang = a; s.sp = 70; s.vx = Math.cos(a) * 70; s.vy = Math.sin(a) * 70;
            s.target = target; s.tid = target.id; s.dmg = lv.dmg; s.r = 4; s.w = lv.r * D.area; s.life = 3.2; s.x0 = lv.speed;
          }
          emit(EV.FIRE, P.x, P.y, W_INDEX.heads);
        }
      }
    }
    // BACKPROP: boomerangs out and back
    if (L.backprop) {
      const lv = WEAPON.backprop.levels[L.backprop - 1], w = wstate.backprop;
      if ((w.cd -= dt) <= 0) {
        w.cd = lv.cd * D.cdMul;
        const t0 = nearest(P.x, P.y, 260);
        const base = t0 ? Math.atan2(t0.y - P.y, t0.x - P.x) : Math.atan2(P.fy, P.fx);
        for (let k = 0; k < lv.count; k++) {
          const s = shot(SHOT.BACK);
          if (!s) break;
          const a = base + (k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / Math.max(3, lv.count)) : 0);
          const range = lv.range * Math.sqrt(D.area);
          const v0 = (2 * range) / 0.6;
          s.x = P.x; s.y = P.y - 8; s.ang = a; s.sp = v0; s.vx = Math.cos(a) * v0; s.vy = Math.sin(a) * v0;
          s.r = lv.r * D.area; s.dmg = lv.dmg; s.life = 3.5; s.state = 0; s.x0 = v0;
        }
        emit(EV.FIRE, P.x, P.y, W_INDEX.backprop);
      }
    }
    // HALLUCINATION FIELD: an aura that hurts and slows
    const fl = sim.field;
    if (L.field) {
      const lv = WEAPON.field.levels[L.field - 1], w = wstate.field;
      fl.r = lv.r * D.area;
      fl.t += dt;
      if ((w.tick -= dt) <= 0) {
        w.tick = lv.tick * D.cdMul;
        const n = hash.query(P.x, P.y - 4, fl.r, found, maxR);
        for (let j = 0; j < n; j++) {
          const e = E[found[j]];
          if (e.kind === CRATE) continue;
          const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
          if (lv.slow) { e.slow = 0.5; e.slowAmt = lv.slow; }
          hurt(e, lv.dmg, W_INDEX.field, dx / d, dy / d, 22);
        }
      }
    } else fl.r = 0;
    // OVERCLOCK NOVA: a shockwave
    if (L.nova) {
      const lv = WEAPON.nova.levels[L.nova - 1], w = wstate.nova;
      if ((w.cd -= dt) <= 0) {
        w.cd = lv.cd * D.cdMul;
        sim.novas.push({ id: ++sim.novaN, r: 0, maxR: lv.r * D.area, t: 0, dur: 0.4, dmg: lv.dmg, stun: lv.stun });
        emit(EV.NOVA, P.x, P.y, lv.r * D.area);
      }
    }
    for (let i = sim.novas.length - 1; i >= 0; i--) {
      const nv = sim.novas[i];
      nv.t += dt;
      const k = Math.min(1, nv.t / nv.dur);
      nv.r = nv.maxR * (1 - (1 - k) ** 3);
      const n = hash.query(P.x, P.y - 4, nv.r, found, maxR);
      for (let j = 0; j < n; j++) {
        const e = E[found[j]];
        if (e.novaId === nv.id) continue;
        e.novaId = nv.id;
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
        if (nv.stun && !e.boss) e.stun = Math.max(e.stun, nv.stun);
        hurt(e, nv.dmg, W_INDEX.nova, dx / d, dy / d, 170);
      }
      if (nv.t >= nv.dur + 0.15) sim.novas.splice(i, 1);
    }
  }

  // ---------- shots in flight ----------
  function shots(dt) {
    for (let i = 0; i < sim.sn; i++) {
      const s = S[i];
      if (s.dead) continue;
      s.t += dt;
      if (s.t >= s.life) { s.dead = true; continue; }
      if (s.kind === SHOT.HEAD) {
        // turn toward its bot (a new one if it's gone), speed up
        let tg = s.target;
        if (!tg || tg.dead || tg.id !== s.tid || tg.hidden) {
          tg = nearest(s.x, s.y, 320);
          s.target = tg; s.tid = tg ? tg.id : 0;
        }
        s.sp = Math.min(s.x0, s.sp + 260 * dt);
        if (tg) {
          const want = Math.atan2(tg.y - s.y, tg.x - s.x);
          let da = want - s.ang;
          da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
          const turn = 6 * dt;
          s.ang += Math.max(-turn, Math.min(turn, da));
        }
        s.vx = Math.cos(s.ang) * s.sp; s.vy = Math.sin(s.ang) * s.sp;
      } else if (s.kind === SHOT.BACK) {
        s.ang += 14 * dt;
        if (s.state === 0) {
          // out: slowing down
          const sp = Math.max(0, s.x0 * (1 - s.t / 0.6));
          const d = Math.hypot(s.vx, s.vy) || 1;
          s.vx = (s.vx / d) * sp; s.vy = (s.vy / d) * sp;
          if (s.t >= 0.6) { s.state = 1; s.sp = 0; }
        } else {
          // back: speeding up toward her
          s.sp = Math.min(s.x0 * 1.15, s.sp + s.x0 * 2.6 * dt);
          const dx = P.x - s.x, dy = P.y - 8 - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx = (dx / d) * s.sp; s.vy = (dy / d) * s.sp;
          if (d < 10) { s.dead = true; continue; }
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      const n = hash.query(s.x, s.y, s.r, found, maxR);
      for (let j = 0; j < n && !s.dead; j++) {
        const e = E[found[j]];
        if (e.dead || e.hidden) continue;
        if (s.kind === SHOT.BOLT) {
          let seen = false;
          for (let h = 0; h < s.nh; h++) if (s.hits[h] === e.id) { seen = true; break; }
          if (seen) continue;
          if (s.nh < 8) s.hits[s.nh++] = e.id;
          const d = Math.hypot(s.vx, s.vy) || 1;
          hurt(e, s.dmg, W_INDEX.bolt, s.vx / d, s.vy / d, 55);
          if (--s.pierce < 0) s.dead = true;
        } else if (s.kind === SHOT.HEAD) {
          // explode on the first bot it touches
          const m = hash.query(s.x, s.y, s.w, found2, maxR);
          for (let q = 0; q < m; q++) {
            const f = E[found2[q]];
            const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy) || 1;
            hurt(f, s.dmg, W_INDEX.heads, dx / d, dy / d, 60);
          }
          emit(EV.BLAST, s.x, s.y, s.w);
          s.dead = true;
        } else if (s.kind === SHOT.BACK) {
          if (sim.t - e.hitBack < 0.3) continue;
          e.hitBack = sim.t;
          const d = Math.hypot(s.vx, s.vy) || 1;
          hurt(e, s.dmg, W_INDEX.backprop, s.vx / d, s.vy / d, 45);
        }
      }
    }
    // put the live ones together
    let w = 0;
    for (let i = 0; i < sim.sn; i++) {
      if (!S[i].dead) { if (w !== i) { const t = S[w]; S[w] = S[i]; S[i] = t; } w++; }
    }
    sim.sn = w;
  }

  // ---------- bots' bullets ----------
  function bullet(kind, x, y, ang, speed, dmg, r = 4, life = 5) {
    if (sim.bn >= MAX_B) return;
    const b = B[sim.bn++];
    b.kind = kind; b.x = x; b.y = y; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.r = r; b.dmg = dmg; b.life = life; b.t = 0;
  }
  function bullets(dt) {
    let w = 0;
    for (let i = 0; i < sim.bn; i++) {
      const b = B[i];
      b.t += dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      let alive = b.t < b.life;
      if (alive && !P.dead) {
        const dx = b.x - P.x, dy = b.y - (P.y - 8), rr = b.r + PLAYER_RADIUS;
        if (dx * dx + dy * dy < rr * rr) { hurtPlayer(b.dmg); alive = false; }
      }
      if (alive && (Math.abs(b.x - P.x) > sim.view.hw + 200 || Math.abs(b.y - P.y) > sim.view.hh + 200)) alive = false;
      if (alive) { if (w !== i) { const t = B[w]; B[w] = B[i]; B[i] = t; } w++; }
    }
    sim.bn = w;
  }

  // ---------- bots moving, crowding, biting ----------
  function bots(dt) {
    const px = P.x, py = P.y;
    const hw = sim.view.hw, hh = sim.view.hh;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.kind === CRATE) continue;
      let dx = px - e.x, dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      let sp = e.speed * (e.slow > 0 ? 1 - e.slowAmt : 1);
      let mx = dx, my = dy;
      if (e.stun > 0) { e.stun -= dt; sp = 0; }
      // a little spread while far away, so a crowd fans out instead of making a line
      const spread = e.ang * Math.min(1, Math.max(0, (d - 36) / 160));
      if (spread) { const c = Math.cos(spread), s = Math.sin(spread); const ox = mx; mx = ox * c - my * s; my = ox * s + my * c; }
      switch (e.k) {
        case 'crawler': {
          const wob = Math.sin(e.t * 9 + e.wob) * 0.7;
          mx += -dy * wob; my += dx * wob;
          break;
        }
        case 'swarm': {
          // a flock keeps its heading, turning slowly toward her
          const turn = Math.min(1, 1.1 * dt);
          e.hx += (dx - e.hx) * turn; e.hy += (dy - e.hy) * turn;
          const hd = Math.hypot(e.hx, e.hy) || 1;
          e.hx /= hd; e.hy /= hd;
          const wob = Math.sin(e.t * 7 + e.wob) * 0.35;
          mx = e.hx - e.hy * wob; my = e.hy + e.hx * wob;
          break;
        }
        case 'troll': {
          // keeps its distance and lobs "???" at her
          if (d < 92) { mx = -dx * 0.8 + -dy * 0.5; my = -dy * 0.8 + dx * 0.5; }
          else if (d < 140) { mx = -dy * 0.6 * Math.sign(Math.sin(e.wob)); my = dx * 0.6 * Math.sign(Math.sin(e.wob)); }
          if ((e.cd -= dt) <= 0 && d < 230 && inView(e, -4) && !P.dead) {
            e.cd = 2.6 + rng.range(0, 0.8);
            e.st = 0.35;
            bullet(BULLET.TROLL, e.x, e.y - 10, Math.atan2(py - 8 - (e.y - 10), px - e.x), 74, e.dmg * 1.1, 4.5, 4.5);
            emit(EV.SHOOT, e.x, e.y, -1, 0, BULLET.TROLL);
          }
          if (e.st > 0) e.st -= dt;
          break;
        }
        case 'ghost': {
          // fades out (can't be hit, can't hurt, quicker), and back in near her
          e.phase += dt;
          const cyc = e.phase % 4.2;
          e.hidden = cyc > 2.6 && cyc < 3.9;
          e.alpha = cyc < 2.6 ? 1 : cyc < 2.9 ? 1 - (cyc - 2.6) / 0.3 * 0.82 : cyc < 3.6 ? 0.18 : cyc < 3.9 ? 0.18 + (cyc - 3.6) / 0.3 * 0.82 : 1;
          if (e.hidden) sp *= 1.7;
          break;
        }
        case 'botnet': bossBotnet(e, dt, d); if (d > 110) sp *= 2.2; break;
        case 'broker': { const r = bossBroker(e, dt, d, dx, dy); mx = r[0]; my = r[1]; sp = r[2]; break; }
        case 'overfit': { const r = bossOverfit(e, dt, d, dx, dy); mx = r[0]; my = r[1]; sp = r[2]; break; }
        default: break;
      }
      if (e.boss && e.k !== 'botnet' && d > 200 && sp > 0) sp = Math.max(sp, e.speed * 2);
      const ml = Math.hypot(mx, my) || 1;
      e.x += ((mx / ml) * sp + e.kx) * dt;
      e.y += ((my / ml) * sp + e.ky) * dt;
      const decay = Math.exp(-10 * dt);
      e.kx *= decay; e.ky *= decay;
      e.moving = sp > 1 ? 1 : 0;
      if (Math.abs(mx) > 0.15) e.face = mx > 0 ? 1 : -1;
      // fell far behind: comes around from the other side (bosses too); a flock that flew past is gone
      const ax = e.x - px, ay = e.y - py;
      if (Math.abs(ax) > hw + 170 || Math.abs(ay) > hh + 170) {
        if (e.k === 'swarm') { e.dead = true; continue; }
        const [nx, ny] = edgePoint(Math.atan2(-ay, -ax) + rng.range(-0.5, 0.5), e.boss ? 30 : 18);
        e.x = nx; e.y = ny;
      }
    }
    // crowding: bots push each other apart (each pair once), every other step (a soft push: half the work, the same look)
    if ((crowdTick ^= 1)) for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead) continue;
      const n = hash.query(e.x, e.y, e.r, found, maxR);
      for (let j = 0; j < n; j++) {
        const fi = found[j];
        if (fi <= i) continue;
        const f = E[fi];
        if (f.dead) continue;
        let dx = f.x - e.x, dy = f.y - e.y;
        let d = Math.hypot(dx, dy);
        const min = (e.r + f.r) * 0.86;
        if (d >= min) continue;
        if (d < 0.01) { dx = rng.range(-1, 1); dy = rng.range(-1, 1); d = Math.hypot(dx, dy) || 1; }
        const push = (min - d) * 0.75;
        const we = e.kind === CRATE || e.boss ? 0 : 1 - e.mass * 0.7, wf = f.kind === CRATE || f.boss ? 0 : 1 - f.mass * 0.7;
        const tot = we + wf || 1;
        const ux = dx / d, uy = dy / d;
        e.x -= ux * push * (we / tot) * 2 * 0.5; e.y -= uy * push * (we / tot) * 2 * 0.5;
        f.x += ux * push * (wf / tot) * 2 * 0.5; f.y += uy * push * (wf / tot) * 2 * 0.5;
      }
    }
    if (P.dead) return;
    // touching her: a bite (then a moment of safety); a crate breaks when she walks into it
    const n = hash.query(P.x, P.y - 4, PLAYER_RADIUS, found, maxR);
    for (let j = 0; j < n; j++) {
      const e = E[found[j]];
      if (e.dead || e.hidden) continue;
      if (e.kind === CRATE) { kill(e, -1); continue; }
      hurtPlayer(e.dmg * (e.k === 'broker' && e.state === 3 ? 1.35 : 1));
      // and they're nudged out of her
      const dx = e.x - P.x, dy = e.y - (P.y - 4), d = Math.hypot(dx, dy) || 1;
      const min = (e.r + PLAYER_RADIUS) * 0.8;
      if (d < min && !e.boss) { e.x += (dx / d) * (min - d); e.y += (dy / d) * (min - d); }
    }
  }

  // ---------- the bosses ----------
  function bossBotnet(e, dt, d) {
    // summons swarmlets around itself, and bursts of packets after a glow
    if ((e.cd -= dt) <= 0) {
      e.cd = 4.6;
      const k = sim.en < ENEMY_CAP ? 5 : 0;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * TAU + e.t;
        const s = spawn('swarm', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26);
        if (s) { s.hx = Math.cos(a); s.hy = Math.sin(a); }
      }
      emit(EV.SUMMON, e.x, e.y, k);
    }
    if (e.state === 0 && (e.cd2 -= dt) <= 0) { e.state = 1; e.st = 0.7; emit(EV.CHARGE, e.x, e.y, e.kind); }
    if (e.state === 1 && (e.st -= dt) <= 0) {
      e.state = 0; e.cd2 = 4.8;
      const n = 14, off = rng.range(0, TAU);
      for (let i = 0; i < n; i++) bullet(BULLET.PACKET, e.x, e.y - 14, off + (i / n) * TAU, 66, 9, 4.5, 6);
      emit(EV.SHOOT, e.x, e.y, -1, 0, BULLET.PACKET);
    }
    return d;
  }
  // DATA BROKER: walks, aims (a line on the floor), dashes; every third dash it throws cookies
  const brokerOut = [0, 0, 0];
  function bossBroker(e, dt, d, dx, dy) {
    e.st -= dt;
    brokerOut[0] = dx; brokerOut[1] = dy; brokerOut[2] = e.speed;
    if (e.state === 0) {
      if (e.st <= 0) { e.state = 1; e.st = 2.1; }
    } else if (e.state === 1) {
      if (e.st <= 0) {
        e.state = 2; e.st = 0.75;
        e.hx = dx; e.hy = dy;
        emit(EV.DASH, e.x, e.y, Math.atan2(dy, dx), 340 * 0.55);
      }
    } else if (e.state === 2) {
      brokerOut[2] = 0;
      if (e.st <= 0) { e.state = 3; e.st = 0.55; e.n++; }
    } else if (e.state === 3) {
      brokerOut[0] = e.hx; brokerOut[1] = e.hy; brokerOut[2] = 340;
      if (e.st <= 0) {
        e.state = 1; e.st = 1.6;
        if (e.n % 3 === 0) {
          const off = rng.range(0, TAU);
          for (let i = 0; i < 10; i++) bullet(BULLET.COOKIE, e.x, e.y - 12, off + (i / 10) * TAU, 58, 10, 5, 6);
          emit(EV.SHOOT, e.x, e.y, -1, 0, BULLET.COOKIE);
        }
      }
    }
    return brokerOut;
  }
  // THE OVERFIT: keeps its distance; spirals, rings with a gap, aimed fans
  const overOut = [0, 0, 0];
  function bossOverfit(e, dt, d, dx, dy) {
    overOut[0] = dx; overOut[1] = dy;
    overOut[2] = d > 88 ? e.speed : d < 48 ? -e.speed * 0.7 : 0;
    if (overOut[2] < 0) { overOut[0] = -dx; overOut[1] = -dy; overOut[2] = -overOut[2]; }
    e.st -= dt;
    if (e.st <= 0) {
      e.state = (e.state + 1) % 6;            // 0 rest · 1 spiral · 2 rest · 3 ring · 4 rest · 5 fan
      e.st = e.state % 2 === 0 ? 1.1 : e.state === 1 ? 2.8 : e.state === 3 ? 1.3 : 1.3;
      e.cd = 0; e.n = 0;
      if (e.state % 2 === 1) emit(EV.CHARGE, e.x, e.y, e.kind);
    }
    if (P.dead) return overOut;
    const ox = e.x, oy = e.y - 18;
    const aim = Math.atan2(P.y - 8 - oy, P.x - ox);
    if (e.state === 1 && (e.cd -= dt) <= 0) {
      e.cd = 0.13;
      const a = e.t * 2.2;
      for (let k = 0; k < 3; k++) bullet(BULLET.OVERFIT, ox, oy, a + (k / 3) * TAU, 60, 10, 4, 7);
      if (e.n++ % 3 === 0) emit(EV.SHOOT, ox, oy, -1, 0, BULLET.OVERFIT);
    } else if (e.state === 3 && (e.cd -= dt) <= 0 && e.n < 2) {
      e.cd = 0.62; e.n++;
      // the gap (where she can slip through) is somewhere near her, never quite on her
      const n = 28, gap = 5, open = aim + rng.sign() * rng.range(0.5, 1.3);
      for (let i = 0; i < n - gap; i++) bullet(BULLET.OVERFIT, ox, oy, open + ((i + gap / 2 + 0.5) / n) * TAU, 56, 10, 4, 7);
      emit(EV.SHOOT, ox, oy, -1, 0, BULLET.OVERFIT);
    } else if (e.state === 5 && (e.cd -= dt) <= 0 && e.n < 3) {
      e.cd = 0.4; e.n++;
      for (let i = -2; i <= 2; i++) bullet(BULLET.OVERFIT, ox, oy, aim + i * 0.17, 88, 10, 4, 6);
      emit(EV.SHOOT, ox, oy, -1, 0, BULLET.OVERFIT);
    }
    return overOut;
  }

  // ---------- chips and pickups on the floor ----------
  function floorItems(dt) {
    const mag = P.magnet, mag2 = mag * mag;
    let w = 0;
    for (let i = 0; i < sim.gn; i++) {
      const g = G[i];
      g.t += dt;
      let taken = false;
      const dx = P.x - g.x, dy = P.y - 6 - g.y, d2 = dx * dx + dy * dy;
      if (!P.dead) {
        if (!g.pulled && d2 < mag2) g.pulled = true;
        if (g.pulled) {
          const d = Math.sqrt(d2) || 1;
          g.sp = Math.min(460, g.sp + 900 * dt);
          const step = Math.min(d, g.sp * dt);
          g.x += (dx / d) * step; g.y += (dy / d) * step;
          if (d < 9) taken = true;
        } else if (g.vx || g.vy) {
          g.x += g.vx * dt; g.y += g.vy * dt;
          const k = Math.exp(-7 * dt);
          g.vx *= k; g.vy *= k;
          if (Math.abs(g.vx) + Math.abs(g.vy) < 1) { g.vx = 0; g.vy = 0; }
        }
      }
      if (taken) {
        gainXp(g.v);
        sim.gemsTaken++;
        emit(EV.XP, g.x, g.y, g.v, g.tier);
        continue;
      }
      if (w !== i) { const t = G[w]; G[w] = G[i]; G[i] = t; }
      w++;
    }
    sim.gn = w;
    for (let i = K.length - 1; i >= 0; i--) {
      const k = K[i];
      k.t += dt;
      if (P.dead) continue;
      const dx = P.x - k.x, dy = P.y - 6 - k.y, d = Math.hypot(dx, dy) || 1;
      if (!k.pulled && d < mag * (k.kind === 'cache' ? 1.4 : 1)) k.pulled = true;
      if (k.pulled && k.t > 0.4) {
        const step = Math.min(d, 260 * dt);
        k.x += (dx / d) * step; k.y += (dy / d) * step;
      }
      if (d < 12) {
        K.splice(i, 1);
        pickUp(k);
      }
    }
  }
  function pickUp(k) {
    emit(EV.PICK, k.x, k.y, 0, 0, 0, k.kind);
    if (k.kind === 'heart') { const h = 30; P.hp = Math.min(P.maxHp, P.hp + h); emit(EV.HEAL, P.x, P.y, h); }
    else if (k.kind === 'magnet') for (let i = 0; i < sim.gn; i++) G[i].pulled = true;
    else if (k.kind === 'purge') purge(false);
    else if (k.kind === 'cache') openCache(k.n);
  }
  // every bot on the screen pops (bosses lose a slice); `quiet`: the win's own sweep
  function purge(quiet) {
    let n = 0;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead || !inView(e, 30)) continue;
      if (e.boss) { hurt(e, e.maxHp * 0.08 / Math.max(1, sim.D.dmg), -1); continue; }
      if (e.kind === CRATE) continue;
      kill(e, -1, { quiet: true });
      n++;
    }
    emit(EV.PURGE, P.x, P.y, n, quiet ? 1 : 0);
  }

  // ---------- crates now and then ----------
  let nextCrate = (start?.t || 0) + 18;
  function crates() {
    if (sim.t < nextCrate) return;
    nextCrate = sim.t + rng.range(22, 34);
    let alive = 0;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.kind !== CRATE || e.dead) continue;
      // one left far behind goes (no drop)
      if (Math.abs(e.x - P.x) > sim.view.hw + 420 || Math.abs(e.y - P.y) > sim.view.hh + 420) { e.dead = true; continue; }
      alive++;
    }
    if (alive >= 3) return;
    const a = rng.range(0, TAU), r = rng.range(110, 190);
    spawn('crate', P.x + Math.cos(a) * r, P.y + Math.sin(a) * r);
  }

  // ---------- one step ----------
  let lastInput = 0, crowdTick = 0, maxR = 24;
  sim.update = (dt, mx = 0, my = 0) => {
    if (sim.choosing || sim.winPause || sim.ended) return;
    sim.t += dt;
    // her
    if (!P.dead) {
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      P.vx = mx * P.speed; P.vy = my * P.speed;
      P.x += P.vx * dt; P.y += P.vy * dt;
      P.moving = ml > 0.08;
      if (P.moving) {
        const l = Math.hypot(mx, my) || 1;
        P.fx = mx / l; P.fy = my / l;
        if (Math.abs(mx) > 0.12) P.face = mx > 0 ? 1 : -1;
        P.walk += dt * (4 + 6 * Math.min(1, ml));
        lastInput = sim.t;
      }
      if (P.iframes > 0) P.iframes -= dt;
      if (P.hurtT > 0) P.hurtT -= dt;
      if (sim.D.regen && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + sim.D.regen * dt);
    } else P.deadT += dt;
    // the director's orders
    let alive = 0;
    for (let i = 0; i < sim.en; i++) if (!E[i].dead && E[i].kind !== CRATE) alive++;
    if (!P.dead) {
      const orders = director.step(sim.t, dt, { alive, bossAlive: Boolean(sim.boss && !sim.boss.dead) });
      for (const o of orders) spawnOrder(o);
      if (start?.bossAt && !sim.demoBoss && sim.t >= start.bossAt) {
        sim.demoBoss = true;
        spawnOrder({ kind: start.bossKind || 'botnet', mode: 'boss', ang: rng.range(0, TAU) });
      }
      crates();
    }
    // the floor's map of bots, then everything that needs it
    hash.clear(E);
    maxR = 4;
    for (let i = 0; i < sim.en; i++) if (!E[i].dead) { hash.insert(i); if (E[i].r > maxR) maxR = E[i].r; }
    if (!P.dead) weapons(dt);
    shots(dt);
    bots(dt);
    bullets(dt);
    floorItems(dt);
    // the fallen go
    let w = 0;
    for (let i = 0; i < sim.en; i++) {
      if (!E[i].dead) { if (w !== i) { const t = E[w]; E[w] = E[i]; E[i] = t; } w++; }
      else if (sim.boss === E[i]) sim.boss = null;
    }
    sim.en = w;
    // 10:00: she won (a sweep of the screen, then overtime if they like)
    if (!sim.won && !P.dead && sim.t >= WIN_TIME) {
      sim.won = true;
      purge(true);
      emit(EV.WIN, P.x, P.y);
      if (!sim.auto) sim.winPause = true;
    }
  };
  sim.idle = () => sim.t - lastInput;
  sim.weaponLevel = (id) => sim.loadout.weapons[id] || 0;
  sim.startAt = from;
  sim.resumeAfterWin = () => { sim.winPause = false; };
  sim.consume = () => { sim.nev = 0; };

  // ---------- a fresh run: a few spam bots already on their way (the first chips land close, the first level-up comes
  // in seconds); a run that starts later (the demo): her loadout, then a crowd already around her ----------
  if (!start) {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + rng.range(-0.25, 0.25), r = rng.range(88, 150);
      const e = spawn('spam', Math.cos(a) * r, Math.sin(a) * r);
      if (e) e.ang = 0;
    }
  }
  if (start) {
    if (start.level) { P.level = start.level; P.need = xpToNext(P.level); }
    if (start.loadout) sim.loadout = { weapons: { ...start.loadout.weapons }, passives: { ...start.loadout.passives } };
    restat();
    P.hp = P.maxHp;
    for (const id of Object.keys(sim.loadout.weapons)) wstate[id].cd = rng.range(0.05, 0.6);
    for (let i = 0; i < (start.crowd || 0); i++) {
      const a = rng.range(0, TAU), r = rng.range(64, 230);
      const k = rng.weighted([['spam', 6], ['crawler', 3], ['ghost', 1.5], ['captcha', 1.2], ['troll', 1]], (x) => x[1])[0];
      spawn(k, Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let i = 0; i < (start.chips || 0); i++) dropGem(rng.range(-160, 160), rng.range(-200, 200), rng.pick([1, 1, 1, 4]));
  }
  return sim;
}

// the weapon she leaned on most (by damage dealt) → its id, or null
export function topWeapon(sim) {
  let best = -1, bd = 0;
  for (let i = 0; i < WEAPONS.length; i++) if (sim.dmgBy[i] > bd) { bd = sim.dmgBy[i]; best = i; }
  return best >= 0 ? WEAPONS[best].id : null;
}
export { KINDS, BOSSES };
