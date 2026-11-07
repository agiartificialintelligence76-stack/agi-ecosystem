// GUARDRAILS: the rules, as a simulation with no DOM (the game draws it, tests and the balance tool run it in Node).
// Prompt gremlins walk the map's path toward AGI-1's core; guardrails beside the path (and honeypots on it) stop them.
// Everything is seeded: the same map, seed and inputs give the same run.
//
//   const sim = createSim({ map: 'chat', seed: 7 });
//   sim.build('filter', 3, 4); sim.sendWave(); sim.update(1 / 60) … sim.events (what happened: drawn and heard), drain()
import {
  COLS, ROWS, MAP, TOWERS, CREATURES, MIX, START_HEARTS, MAX_WAVES, UNLOCK_AT, DEFAULT_TARGET, TARGET_MODES,
  statsOf, buildCost, upgradeCost, refundOf, rebuildCost,
} from './data.js';
import { spawnsOf, hpMul, mapHp, rewardMul, isBossWave, breakBefore, earlyRate, clearBonus } from './waves.js';
import { rng } from '../kit/fx.js';

export const TILE = { BUILD: 0, PATH: 1, DECOR: 2, CORE: 3 };
const BOLT_SPEED = 12, LEAK_BEFORE = 0.8, AURA_EVERY = 1 / 20, EVENTS_MAX = 3000;

// ---------- the map: tiles, paths with their lengths, where each path crosses each tile ----------
export function buildMap(id) {
  const def = MAP[id];
  const tiles = new Uint8Array(COLS * ROWS);
  const pathD = new Map();                                // tile index → [d on path 0, d on path 1] (-1: not on it)
  const paths = def.paths.map((wps, p) => {
    const pts = wps.map(([x, y]) => [x + 0.5, y + 0.5]);
    const segs = [];
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      segs.push({ ax, ay, bx, by, len, d0: d, dx: (bx - ax) / len, dy: (by - ay) / len });
      // the tiles it runs through (axis-aligned)
      const steps = Math.round(len);
      for (let k = 0; k <= steps; k++) {
        const tx = Math.floor(ax + ((bx - ax) * k) / steps), ty = Math.floor(ay + ((by - ay) * k) / steps);
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) continue;
        const ti = ty * COLS + tx;
        tiles[ti] = TILE.PATH;
        if (!pathD.has(ti)) pathD.set(ti, def.paths.map(() => -1));
        const at = pathD.get(ti);
        if (at[p] < 0) at[p] = d + Math.hypot(tx + 0.5 - ax, ty + 0.5 - ay);
      }
      d += len;
    }
    return { pts, segs, len: d, leak: d - LEAK_BEFORE };
  });
  const [cx, cy] = def.core;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { tiles[y * COLS + x] = TILE.CORE; pathD.delete(y * COLS + x); }
  }
  for (const [x, y] of def.decor) if (tiles[y * COLS + x] === TILE.BUILD) tiles[y * COLS + x] = TILE.DECOR;
  return { id, def, tiles, paths, pathD, core: { x: cx + 0.5, y: cy + 0.5 } };
}

// a point on a path at distance d (and the segment it's on, searched from a hint)
export function pointAt(path, d, hint = 0) {
  const segs = path.segs;
  let i = Math.min(Math.max(0, hint), segs.length - 1);
  while (i < segs.length - 1 && d > segs[i].d0 + segs[i].len) i++;
  while (i > 0 && d < segs[i].d0) i--;
  const s = segs[i], k = Math.min(Math.max(d - s.d0, 0), s.len);
  return { x: s.ax + s.dx * k, y: s.ay + s.dy * k, seg: i, dx: s.dx, dy: s.dy };
}

export function createSim({ map = 'chat', seed = 1, compute = null, hearts = START_HEARTS, wave = 0 } = {}) {
  const M = buildMap(map);
  const def = M.def;
  const r = rng((seed * 2654435761) >>> 0);
  const occ = new Int32Array(COLS * ROWS);               // tower id on each tile (0: none)
  const S = {
    map: M, mapId: map, seed, t: 0,
    wave, hearts, compute: compute ?? def.compute,
    towers: [], creatures: [], shots: [], spawns: [],
    nextIn: null, started: wave > 0, waves: new Map(), cleared: wave, victory: false, unlocked: false,
    kills: 0, built: 0, bosses: 0, leaks: 0, over: false,
    events: [], auraT: 0, uid: 1,
  };

  const ev = (e) => { S.events.push(e); };

  // ---------- gremlins ----------
  function spawn(kind, path, w, d = 0, from = null) {
    const c = CREATURES[kind];
    const hp = Math.round(c.hp * hpMul(Math.max(1, w)) * mapHp(def.hp, Math.max(1, w)));
    const cr = {
      id: S.uid++, kind, def: c, hp, max: hp, path, d, seg: 0, x: 0, y: 0, dirx: 1, diry: 0,
      off: c.boss ? 0 : (r.next() - 0.5) * 0.34,
      slowK: 0, slowT: 0, slowLK: 0, stunT: 0, dazeT: 0, markT: 0,
      revealed: !c.disguised, shield: Boolean(c.shield), reshieldT: 0,
      argue: null, argueT: 0, lastHoney: from?.lastHoney ?? 0,
      healT: r.next() * 1.5, healedAt: -9, blinkCd: 0, recent: 0, split: 0, stunImm: 0,
      wave: w, hitT: 0, age: 0, dead: false, out: false, bob: r.next() * 6.28,
    };
    if (from && from.revealed) cr.revealed = true;
    place(cr);
    S.creatures.push(cr);
    if (c.boss) ev({ type: 'boss', kind, c: cr });
    return cr;
  }
  function place(c) {
    const p = pointAt(M.paths[c.path], c.d, c.seg);
    c.seg = p.seg;
    c.dirx = p.dx; c.diry = p.dy;
    c.x = p.x - p.dy * c.off;
    c.y = p.y + p.dx * c.off;
  }
  const left = (c) => M.paths[c.path].len - c.d;
  const targetable = (c) => !c.dead && !c.out && c.revealed && c.age > 0.05;

  // a wave's tally (gremlins still to stop) and its end
  function waveLeft(w, by) {
    const st = S.waves.get(w);
    if (!st) return;
    st.left += by;
    if (st.left <= 0 && !st.done && !S.over) {
      st.done = true;
      S.cleared++;
      const perfect = st.leaked === 0;
      const bonus = clearBonus(w, perfect);
      S.compute += bonus;
      ev({ type: 'clear', wave: w, bonus, perfect });
      if (w >= MAX_WAVES && !S.victory) { S.victory = true; ev({ type: 'victory', wave: w }); }
      if (S.cleared >= UNLOCK_AT && !S.unlocked) { S.unlocked = true; ev({ type: 'unlock', map }); }
    }
  }

  function kill(c, tower) {
    if (c.dead) return;
    c.dead = true;
    if (c.argue) release(c);
    const reward = Math.max(1, Math.round(c.def.reward * rewardMul(c.wave)));
    S.compute += reward;
    S.kills++;
    if (tower) tower.kills++;
    if (c.def.boss) S.bosses++;
    ev({ type: 'kill', kind: c.kind, x: c.x, y: c.y, reward, boss: Boolean(c.def.boss), r: c.def.r });
    if (c.def.splits) {
      for (let i = 0; i < c.def.splits; i++) spawnChild('bit', c, (i - 1) * 0.28);
      ev({ type: 'split', kind: c.kind, x: c.x, y: c.y, n: c.def.splits });
    }
    waveLeft(c.wave, -1);
  }
  function spawnChild(kind, parent, dd) {
    const ch = spawn(kind, parent.path, parent.wave, Math.max(0, Math.min(M.paths[parent.path].leak - 0.1, parent.d + dd)), parent);
    ch.off = Math.max(-0.3, Math.min(0.3, parent.off + dd * 0.5));
    ch.age = 0.06;
    place(ch);
    const st = S.waves.get(parent.wave);
    if (st) st.left++;
    return ch;
  }

  // damage of a kind: bolt (Filter), splash (Red Team), pulse (Rate Limiter), beam (System Prompt), trap (honeypot)
  function hurt(c, amount, kind, tower = null) {
    if (c.dead || c.out || amount <= 0) return 0;
    if (c.shield) {
      if (kind !== 'splash') { ev({ type: 'block', x: c.x, y: c.y }); return 0; }
      c.shield = false; c.reshieldT = 0;
      amount *= 0.5;
      ev({ type: 'unshield', x: c.x, y: c.y, kind: c.kind });
    }
    if (c.def.armored && kind === 'bolt') amount *= 0.5;
    if (c.markT > 0) amount *= 1.2;
    const dealt = Math.min(amount, c.hp);
    c.hp -= amount;
    c.hitT = 0.14;
    c.recent += amount;
    if (tower) tower.dmg += dealt;
    // a boss that splits: at its marks, smaller prompts burst out
    const sa = c.def.splitAt;
    if (sa && c.split < sa.length && c.hp > 0 && c.hp <= c.max * sa[c.split]) {
      c.split++;
      const sp = c.def.spawn;
      for (let i = 0; i < sp.n; i++) {
        const kind = sp.kind === 'mix' ? MIX[i % MIX.length] : sp.kind;
        spawnChild(kind, c, -0.5 - i * 0.22);
      }
      ev({ type: 'bosssplit', kind: c.kind, x: c.x, y: c.y, n: sp.n });
    }
    if (c.hp <= 0) kill(c, tower);
    return dealt;
  }
  // a stun, then a moment when stuns don't take (overlapping pulses can't hold anything forever)
  function stun(c, dur) {
    if (c.dead || c.stunImm > 0) return;
    const k = c.def.boss ? 0.35 : c.def.armored ? 0.5 : 1;
    const t = dur * k;
    if (t > c.stunT) { c.stunT = t; c.stunImm = t + (c.def.boss ? 2 : 0.9); }
  }

  // ---------- honeypots ----------
  function release(c) {
    const h = c.argue;
    c.argue = null;
    c.argueT = 0;
    if (h) h.arguers = Math.max(0, h.arguers - 1);
  }
  function breakHoney(h) {
    h.broken = true;
    h.hp = 0;
    for (const c of S.creatures) if (c.argue === h) release(c);
    h.arguers = 0;
    ev({ type: 'honeybreak', x: h.x, y: h.y, id: h.id });
  }

  // ---------- moving ----------
  function move(c, dt) {
    c.age += dt;
    if (c.hitT > 0) c.hitT -= dt;
    if (c.markT > 0) c.markT -= dt;
    if (c.slowT > 0) c.slowT -= dt;
    if (c.blinkCd > 0) c.blinkCd -= dt;
    if (c.stunImm > 0) c.stunImm -= dt;
    c.recent *= Math.exp(-dt / 0.8);
    const D = c.def;
    if (D.heals) {
      c.healT += dt;
      if (c.healT >= D.heals.every) {
        c.healT = 0;
        const R2 = D.heals.range * D.heals.range;
        let n = 0;
        for (const o of S.creatures) {
          // one heal at a time each (a crowd of grandmas doesn't stack), and healers don't heal each other
          if (o.dead || o.out || o.def.boss || o.hp >= o.max || S.t - o.healedAt < D.heals.every) continue;
          if (o !== c && o.def.heals) continue;
          const dx = o.x - c.x, dy = o.y - c.y;
          if (dx * dx + dy * dy > R2) continue;
          o.hp = Math.min(o.max, o.hp + o.max * D.heals.pct * (o === c ? 0.5 : 1));
          o.healedAt = S.t;
          n++;
        }
        ev({ type: 'heal', x: c.x, y: c.y, n, id: c.id });
      }
    }
    if (D.reshield && !c.shield) {
      c.reshieldT += dt;
      if (c.reshieldT >= D.reshield) { c.shield = true; c.reshieldT = 0; ev({ type: 'reshield', x: c.x, y: c.y }); }
    }
    const P = M.paths[c.path];
    // a blinker hit hard enough: it skips ahead
    if (D.blink && c.blinkCd <= 0 && c.recent >= c.max * D.blink.dmg) {
      const x0 = c.x, y0 = c.y;
      if (c.argue) release(c);
      c.d = Math.min(P.leak - 0.6, c.d + D.blink.dist);
      c.blinkCd = D.blink.cd;
      c.recent = 0;
      place(c);
      ev({ type: 'blink', x0, y0, x1: c.x, y1: c.y, kind: c.kind });
    }
    if (c.stunT > 0) { c.stunT -= dt; return; }
    if (c.dazeT > 0) c.dazeT -= dt;
    if (c.argue) {
      const h = c.argue;
      c.argueT -= dt;
      h.hp -= D.talk * dt;
      if (h.trap) hurt(c, h.trap * dt, 'trap', h);
      if (c.dead) return;
      if (h.hp <= 0 && !h.broken) breakHoney(h);
      else if (c.argueT <= 0) release(c);
      return;
    }
    let slow = 0;
    if (!D.armored) slow = Math.max(c.slowK, c.slowT > 0 ? c.slowLK : 0);
    const sp = D.speed * (1 - slow) * (c.dazeT > 0 ? 0.4 : 1);
    let nd = c.d + sp * dt;
    // a honeypot on the way: it stops to argue (a sudo walks right past)
    if (!D.ignoresHoney && S.honeys > 0) {
      for (const h of S.towers) {
        if (h.type !== 'honeypot' || h.broken || h.id === c.lastHoney) continue;
        const stop = h.stops[c.path];
        if (stop < 0) continue;
        const at = stop - 0.4 - Math.min(0.5, h.arguers * 0.07);
        if (c.d <= at + 1e-6 && nd >= at) {
          nd = at;
          c.argue = h;
          c.argueT = h.argue;
          c.lastHoney = h.id;
          h.arguers++;
          ev({ type: 'argue', x: h.x, y: h.y, kind: c.kind, id: h.id });
          break;
        }
      }
    }
    c.d = nd;
    place(c);
    if (c.d >= P.leak) leak(c);
  }
  function leak(c) {
    c.out = true;
    if (c.argue) release(c);
    S.hearts = Math.max(0, S.hearts - c.def.leak);
    S.leaks++;
    const st = S.waves.get(c.wave);
    if (st) st.leaked++;
    ev({ type: 'leak', kind: c.kind, x: c.x, y: c.y, n: c.def.leak, boss: Boolean(c.def.boss) });
    if (S.hearts <= 0 && !S.over) { S.over = true; ev({ type: 'over' }); }
    waveLeft(c.wave, -1);
  }

  // ---------- the classifiers' field: slow, reveal, mark (20 times a second) ----------
  function auras() {
    const list = S.creatures;
    for (const c of list) c.slowK = 0;
    for (const t of S.towers) {
      if (t.type !== 'classifier') continue;
      const st = t.stats;
      const R2 = st.range * st.range, V2 = st.reveal * st.reveal;
      for (const c of list) {
        if (c.dead || c.out) continue;
        const dx = c.x - t.x, dy = c.y - t.y, d2 = dx * dx + dy * dy;
        if (d2 <= V2) {
          if (!c.revealed) { c.revealed = true; ev({ type: 'reveal', x: c.x, y: c.y, kind: c.kind, id: c.id }); }
          if (st.mark) c.markT = 0.3;
        }
        if (d2 <= R2) {
          if (st.slow > c.slowK) c.slowK = st.slow;
          if (st.linger) { c.slowT = st.linger; c.slowLK = Math.max(c.slowT > 0 ? c.slowLK : 0, st.slow); }
        }
      }
    }
  }

  // ---------- the guardrails ----------
  function find(t, range, mode, skip = null) {
    const R2 = range * range;
    let best = null, score = -Infinity;
    for (const c of S.creatures) {
      if (!targetable(c) || (skip && skip.includes(c))) continue;
      const dx = c.x - t.x, dy = c.y - t.y, d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const sc = mode === 'strong' ? c.hp * 1000 - left(c) : mode === 'close' ? -d2 : -left(c);
      if (sc > score) { score = sc; best = c; }
    }
    return best;
  }
  // where a gremlin will be after `dt` seconds (for a bomb's flight)
  function ahead(c, dt) {
    if (c.argue || c.stunT > 0) return { x: c.x, y: c.y };
    const sp = c.def.speed * (1 - (c.def.armored ? 0 : Math.max(c.slowK, c.slowT > 0 ? c.slowLK : 0)));
    const P = M.paths[c.path];
    const p = pointAt(P, Math.min(P.leak, c.d + sp * dt), c.seg);
    return { x: p.x - p.dy * c.off, y: p.y + p.dx * c.off };
  }
  function towerStep(t, dt) {
    const st = t.stats;
    if (t.fireT > 0) t.fireT -= dt;
    switch (t.type) {
      case 'filter': {
        t.cd -= dt;
        if (t.cd > 0) return;
        const c = find(t, st.range, t.mode);
        if (!c) { t.cd = 0; return; }
        t.cd += st.rate;
        if (t.cd < 0) t.cd = st.rate * 0.5;
        t.aimX = c.x; t.aimY = c.y; t.fireT = 0.12;
        S.shots.push({ k: 0, x: t.x, y: t.y, tgt: c, tx: c.x, ty: c.y, dmg: st.dmg, from: t, life: 1.2 });
        ev({ type: 'fire', tower: t.type, id: t.id, x: t.x, y: t.y });
        return;
      }
      case 'redteam': {
        t.cd -= dt;
        if (t.cd > 0) return;
        const c = find(t, st.range, t.mode);
        if (!c) { t.cd = 0; return; }
        t.cd += st.rate;
        if (t.cd < 0) t.cd = st.rate * 0.5;
        const dist = Math.hypot(c.x - t.x, c.y - t.y);
        const dur = 0.45 + dist * 0.09;
        const at = ahead(c, dur);
        t.aimX = at.x; t.aimY = at.y; t.fireT = 0.25;
        S.shots.push({ k: 1, x0: t.x, y0: t.y, x1: at.x, y1: at.y, x: t.x, y: t.y, t: 0, dur, dmg: st.dmg, splash: st.splash, from: t,
          bomblets: st.bomblets || 0, bdmg: st.bombletDmg || 0, daze: st.daze || 0, h: 0.9 + dist * 0.25 });
        ev({ type: 'fire', tower: t.type, id: t.id, x: t.x, y: t.y });
        return;
      }
      case 'limiter': {
        t.cd -= dt;
        if (t.cd > 0) return;
        const R2 = st.range * st.range;
        let any = false;
        for (const c of S.creatures) {
          if (c.dead || c.out) continue;
          const dx = c.x - t.x, dy = c.y - t.y;
          if (dx * dx + dy * dy <= R2) { any = true; break; }
        }
        if (!any) { t.cd = 0; return; }
        t.cd = st.period;
        t.fireT = 0.4;
        ev({ type: 'pulse', id: t.id, x: t.x, y: t.y, r: st.range });
        for (const c of S.creatures) {
          if (c.dead || c.out) continue;
          const dx = c.x - t.x, dy = c.y - t.y;
          if (dx * dx + dy * dy > R2) continue;
          stun(c, st.stun);
          hurt(c, st.dmg, 'pulse', t);
        }
        return;
      }
      case 'sysprompt': {
        const c = find(t, st.range, t.mode);
        t.charge = Math.min(st.rate, t.charge + dt);
        if (!c || t.charge < st.rate) return;
        t.charge = 0;
        t.fireT = 0.3;
        const hit = [c];
        for (let i = 1; i < (st.beams || 1); i++) {
          const o = find(t, st.range, t.mode, hit);
          if (o) hit.push(o);
        }
        t.aimX = c.x; t.aimY = c.y;
        for (const o of hit) {
          ev({ type: 'beam', id: t.id, x: t.x, y: t.y, x1: o.x, y1: o.y, big: st.dmg >= 600 });
          hurt(o, st.dmg, 'beam', t);
        }
        return;
      }
      default:
    }
  }
  function shotStep(s, dt) {
    if (s.k === 0) {
      if (s.tgt && !s.tgt.dead && !s.tgt.out) { s.tx = s.tgt.x; s.ty = s.tgt.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = BOLT_SPEED * dt;
      s.life -= dt;
      if (d <= step + 0.08) {
        if (s.tgt && !s.tgt.dead && !s.tgt.out) {
          hurt(s.tgt, s.dmg, 'bolt', s.from);
          ev({ type: 'hit', tower: 'filter', x: s.tx, y: s.ty });
        }
        return false;
      }
      s.x += (dx / d) * step; s.y += (dy / d) * step;
      return s.life > 0;
    }
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    s.x = s.x0 + (s.x1 - s.x0) * k;
    s.y = s.y0 + (s.y1 - s.y0) * k;
    if (k < 1) return true;
    splash(s.x1, s.y1, s.splash, s.dmg, s.from, s.daze);
    ev({ type: 'splat', x: s.x1, y: s.y1, r: s.splash, small: s.k === 2 });
    if (s.bomblets) {
      for (let i = 0; i < s.bomblets; i++) {
        const a = (i / s.bomblets) * Math.PI * 2 + r.next() * 0.8;
        const dd = 0.55 + r.next() * 0.45;
        S.shots.push({ k: 2, x0: s.x1, y0: s.y1, x1: s.x1 + Math.cos(a) * dd, y1: s.y1 + Math.sin(a) * dd, x: s.x1, y: s.y1, t: 0, dur: 0.28,
          dmg: s.bdmg, splash: 0.6, from: s.from, bomblets: 0, bdmg: 0, daze: 0, h: 0.5 });
      }
    }
    return false;
  }
  function splash(x, y, radius, dmg, from, daze) {
    for (const c of S.creatures) {
      if (c.dead || c.out) continue;
      const dx = c.x - x, dy = c.y - y, R = radius + c.def.r * 0.5;
      if (dx * dx + dy * dy > R * R) continue;
      hurt(c, dmg, 'splash', from);
      if (daze && !c.dead) { const k = c.def.boss ? 0.35 : c.def.armored ? 0.5 : 1; c.dazeT = Math.max(c.dazeT, daze * k); stun(c, daze * 0.5); }
    }
  }

  // ---------- the run ----------
  function update(dt) {
    if (S.over) return;
    S.t += dt;
    // walk-ins
    while (S.spawns.length && S.spawns[0].at <= S.t) {
      const sp = S.spawns.shift();
      spawn(sp.kind, sp.path, sp.wave);
    }
    // the break between waves (it starts once a wave has fully walked in), then the next one comes by itself
    if (S.started && !S.spawns.length) {
      if (S.nextIn == null) S.nextIn = Math.round(breakBefore(S.wave + 1) * def.pause);
      S.nextIn -= dt;
      if (S.nextIn <= 0) sendWave({ auto: true });
    }
    S.auraT -= dt;
    if (S.auraT <= 0) { S.auraT += AURA_EVERY; auras(); }
    const list = S.creatures;
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (!c.dead && !c.out) move(c, dt); }
    for (const t of S.towers) towerStep(t, dt);
    let k = 0;
    for (let i = 0; i < S.shots.length; i++) { const s = S.shots[i]; if (shotStep(s, dt)) S.shots[k++] = s; }
    // (a bomb that bursts adds its bomblets at the end of the list: this same pass steps and keeps them)
    S.shots.length = k;
    let n = 0;
    for (const c of list) if (!c.dead && !c.out) list[n++] = c;
    list.length = n;
    if (S.events.length > EVENTS_MAX) S.events.splice(0, S.events.length - EVENTS_MAX);
  }

  // the next wave (now). Early (during the break) pays the rest of the break in compute.
  function canSend() { return !S.over && S.spawns.length === 0; }
  function sendWave({ auto = false } = {}) {
    if (!canSend()) return -1;
    const early = !auto && S.started && S.nextIn != null && S.nextIn > 0;
    const bonus = early ? Math.ceil(S.nextIn * earlyRate(S.wave + 1)) : 0;
    S.compute += bonus;
    S.wave++;
    S.started = true;
    S.nextIn = null;
    const list = spawnsOf(map, S.wave, seed);
    for (const sp of list) S.spawns.push({ at: S.t + sp.at, kind: sp.kind, path: sp.path, wave: S.wave });
    S.spawns.sort((a, b) => a.at - b.at);
    S.waves.set(S.wave, { left: list.length, leaked: 0, done: false });
    ev({ type: 'wave', wave: S.wave, boss: isBossWave(S.wave), bonus, early });
    return bonus;
  }

  // ---------- building ----------
  const tileAt = (x, y) => (x >= 0 && y >= 0 && x < COLS && y < ROWS ? M.tiles[y * COLS + x] : -1);
  function canBuild(type, x, y) {
    const T = TOWERS[type];
    if (!T) return { ok: false, why: 'none' };
    const tile = tileAt(x, y);
    if (tile < 0) return { ok: false, why: 'off' };
    if (occ[y * COLS + x]) return { ok: false, why: 'taken' };
    if (T.on === 'path' ? !(tile === TILE.PATH && M.pathD.has(y * COLS + x)) : tile !== TILE.BUILD) return { ok: false, why: T.on === 'path' ? 'path-only' : 'ground-only' };
    const cost = buildCost(type);
    if (S.compute < cost) return { ok: false, why: 'compute', need: cost - S.compute };
    return { ok: true, cost };
  }
  function towerAt(x, y) {
    const id = tileAt(x, y) >= 0 ? occ[y * COLS + x] : 0;
    return id ? S.towers.find((t) => t.id === id) || null : null;
  }
  function setStats(t) {
    t.stats = statsOf(t.type, t.tier, t.spec);
    if (t.type === 'honeypot') {
      t.maxHp = t.stats.hp;
      t.argue = t.stats.argue;
      t.trap = t.stats.trap || 0;
    }
  }
  function build(type, x, y) {
    const ok = canBuild(type, x, y);
    if (!ok.ok) return null;
    const t = {
      id: S.uid++, type, tx: x, ty: y, x: x + 0.5, y: y + 0.5, tier: 1, spec: 0, spent: ok.cost,
      cd: 0.15, charge: 0, mode: DEFAULT_TARGET[type] || 'first', aimX: x + 0.5, aimY: y - 1, fireT: 0,
      kills: 0, dmg: 0, built: S.t, stats: null, hp: 0, maxHp: 0, broken: false, arguers: 0, stops: null, argue: 0, trap: 0,
    };
    setStats(t);
    if (type === 'honeypot') { t.hp = t.maxHp; t.stops = M.pathD.get(y * COLS + x).slice(); }
    S.compute -= ok.cost;
    S.towers.push(t);
    occ[y * COLS + x] = t.id;
    S.built++;
    S.honeys = S.towers.filter((o) => o.type === 'honeypot').length;
    ev({ type: 'build', tower: type, id: t.id, x: t.x, y: t.y });
    return t;
  }
  const byId = (id) => S.towers.find((t) => t.id === id) || null;
  function canUpgrade(id, spec = 0) {
    const t = byId(id);
    if (!t || t.tier >= 3 || t.broken) return { ok: false, why: t?.broken ? 'broken' : 'max' };
    const cost = upgradeCost(t.type, t.tier, spec);
    if (S.compute < cost) return { ok: false, why: 'compute', need: cost - S.compute, cost };
    return { ok: true, cost };
  }
  function upgrade(id, spec = 0) {
    const ok = canUpgrade(id, spec);
    if (!ok.ok) return false;
    const t = byId(id);
    S.compute -= ok.cost;
    t.spent += ok.cost;
    t.tier++;
    if (t.tier === 3) t.spec = spec ? 1 : 0;
    setStats(t);
    if (t.type === 'honeypot') t.hp = t.maxHp;
    ev({ type: 'upgrade', tower: t.type, id: t.id, x: t.x, y: t.y, tier: t.tier, spec: t.spec });
    return true;
  }
  const sellValue = (t) => Math.floor(refundOf(t.spent) * (t.broken ? 0.5 : 1));
  function sell(id) {
    const t = byId(id);
    if (!t) return 0;
    const back = sellValue(t);
    if (t.type === 'honeypot') for (const c of S.creatures) if (c.argue === t) release(c);
    S.towers.splice(S.towers.indexOf(t), 1);
    occ[t.ty * COLS + t.tx] = 0;
    S.compute += back;
    S.honeys = S.towers.filter((o) => o.type === 'honeypot').length;
    ev({ type: 'sell', tower: t.type, id: t.id, x: t.x, y: t.y, back });
    return back;
  }
  function rebuild(id) {
    const t = byId(id);
    if (!t || !t.broken) return false;
    const cost = rebuildCost(t.spent);
    if (S.compute < cost) return false;
    S.compute -= cost;
    t.broken = false;
    t.hp = t.maxHp;
    ev({ type: 'rebuild', tower: t.type, id: t.id, x: t.x, y: t.y });
    return true;
  }
  function setMode(id, mode) {
    const t = byId(id);
    if (!t || !TARGET_MODES.includes(mode)) return false;
    t.mode = mode;
    return true;
  }
  function drain() { const e = S.events; S.events = []; return e; }

  S.honeys = 0;
  Object.assign(S, {
    update, sendWave, canSend, canBuild, build, canUpgrade, upgrade, sell, sellValue, rebuild, setMode, towerAt, byId, tileAt, drain,
    // for the AI, the tests and the balance tool
    _hurt: hurt, _spawn: spawn, rng: r,
  });
  return S;
}
