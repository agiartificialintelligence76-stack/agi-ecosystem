// LAST MODEL STANDING: the demo's player (and the title screen's): it kites. Every think it scores sixteen ways to go:
// away from the crowd and the bullets (two look-ahead distances), around the horde rather than straight away (circling
// keeps the crowd behind her), toward chips when it's calm, toward hearts when she's hurt and caches always, and a little
// toward the way it was already going (no jitter). Reads the sim, never changes it; deterministic (no Math.random).
const DIRS = 16;
const CX = Array.from({ length: DIRS }, (_, i) => Math.cos((i / DIRS) * Math.PI * 2));
const CY = Array.from({ length: DIRS }, (_, i) => Math.sin((i / DIRS) * Math.PI * 2));

export function createAI({ spin = 1 } = {}) {
  let mx = 0, my = 0, tx = 0, ty = 0, think = 0, orbit = spin;
  const score = new Float64Array(DIRS);

  function decide(sim) {
    const P = sim.player, E = sim.E, B = sim.B;
    score.fill(0);
    // the horde's middle (nearby bots) → circle around it
    let cx = 0, cy = 0, cn = 0;
    for (let i = 0; i < sim.en; i++) {
      const e = E[i];
      if (e.dead || e.kind === 9) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d2 = dx * dx + dy * dy;
      if (d2 > 260 * 260) continue;
      const w = e.boss ? 6 : e.elite ? 3 : 1;
      cx += dx * w; cy += dy * w; cn += w;
      const d = Math.sqrt(d2) || 1;
      const danger = (e.boss ? 2.6 : e.elite ? 2 : e.k === 'captcha' ? 1.5 : 1) * (e.hidden ? 0.35 : 1);
      // how bad each way is: being near this bot after a short and a longer step
      for (let k = 0; k < DIRS; k++) {
        for (const ahead of [16, 44]) {
          const ax = P.x + CX[k] * ahead - e.x, ay = P.y + CY[k] * ahead - e.y;
          const dd = Math.max(4, Math.sqrt(ax * ax + ay * ay) - e.r);
          score[k] -= (danger * (ahead === 16 ? 1.6 : 1)) / (dd * dd) * 900;
        }
      }
      void d;
    }
    // bullets: where each will be in a moment
    for (let i = 0; i < sim.bn; i++) {
      const b = B[i];
      for (const tt of [0.12, 0.3]) {
        const bx = b.x + b.vx * tt, by = b.y + b.vy * tt;
        if (Math.abs(bx - P.x) > 90 || Math.abs(by - P.y + 8) > 90) continue;
        for (let k = 0; k < DIRS; k++) {
          const ax = P.x + CX[k] * P.speed * tt - bx, ay = P.y - 8 + CY[k] * P.speed * tt - by;
          const dd = Math.max(3, Math.sqrt(ax * ax + ay * ay) - b.r);
          score[k] -= 2600 / (dd * dd);
        }
      }
    }
    // a broker about to dash: off its line
    if (sim.boss && sim.boss.k === 'broker' && sim.boss.state === 2) {
      const e = sim.boss;
      for (let k = 0; k < DIRS; k++) {
        const ax = P.x + CX[k] * 30 - e.x, ay = P.y + CY[k] * 30 - e.y;
        const side = Math.abs(ax * e.hy - ay * e.hx);
        if (side < 26) score[k] -= (26 - side) * 6;
      }
    }
    // circling: the way around the horde's middle
    if (cn > 0) {
      cx /= cn; cy /= cn;
      const cl = Math.hypot(cx, cy) || 1;
      const ox = -cy / cl * orbit, oy = cx / cl * orbit;
      for (let k = 0; k < DIRS; k++) score[k] += (CX[k] * ox + CY[k] * oy) * 1.1 - (CX[k] * cx + CY[k] * cy) / cl * 0.7;
    }
    // chips (when it's calm enough) and pickups
    const hurt = P.hp / P.maxHp;
    let gx = 0, gy = 0, gb = 0;
    for (let i = 0; i < sim.gn; i++) {
      const g = sim.G[i];
      const dx = g.x - P.x, dy = g.y - P.y, d2 = dx * dx + dy * dy;
      if (d2 > 170 * 170 || g.pulled) continue;
      const w = (1 + g.tier * 2) / (40 + Math.sqrt(d2));
      gx += dx * w; gy += dy * w; gb += w;
    }
    for (const k of sim.K) {
      const dx = k.x - P.x, dy = k.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d > 280) continue;
      const want = k.kind === 'cache' ? 3 : k.kind === 'heart' ? (hurt < 0.7 ? 3 : 0.3) : 1.5;
      gx += (dx / d) * want; gy += (dy / d) * want; gb += want;
    }
    if (gb > 0) {
      // how calm is it right here? (the best way's danger) → chips matter more when it's calm
      let calm = -1e9;
      for (let k = 0; k < DIRS; k++) if (score[k] > calm) calm = score[k];
      const want = calm > -0.6 ? 2.4 : calm > -2 ? 1.2 : 0.5;
      const gl = Math.hypot(gx, gy) || 1;
      for (let k = 0; k < DIRS; k++) score[k] += ((CX[k] * gx + CY[k] * gy) / gl) * want;
    }
    // keep going the way it was going
    for (let k = 0; k < DIRS; k++) score[k] += (CX[k] * tx + CY[k] * ty) * 0.6;
    let best = 0;
    for (let k = 1; k < DIRS; k++) if (score[k] > score[best]) best = k;
    // a sudden turn back means it's cornered on this side: circle the other way next time
    if (tx * CX[best] + ty * CY[best] < -0.6 && cn > 0) orbit = -orbit;
    tx = CX[best]; ty = CY[best];
  }

  return {
    // her move this step: [x, y], each -1..1
    move(sim, dt) {
      think -= dt;
      if (think <= 0) { think = 0.06; decide(sim); }
      const k = 1 - Math.exp(-12 * dt);
      mx += (tx - mx) * k; my += (ty - my) * k;
      return [mx, my];
    },
    reset() { mx = my = tx = ty = 0; think = 0; },
  };
}

// a decent player's card pick (the balance runs in tests use it; the demo takes the first card): weapons first while
// she has few, then her weapons' levels, then damage, cooldown and area
const PRIORITY = { finetune: 6, compute: 5.5, memory: 4.5, alignment: 4, uptime: 3, bandwidth: 2.5, context: 2 };
export function pickSmart(offers, loadout) {
  let best = 0, bs = -1e9;
  const nw = Object.keys(loadout.weapons).length;
  offers.forEach((o, i) => {
    let s = 0;
    if (o.type === 'weapon') s = o.isNew ? (nw < 4 ? 9 : nw < 6 ? 4 : 0) : 7 + o.level * 0.3;
    else if (o.type === 'passive') s = (PRIORITY[o.id] || 1) + (o.isNew ? 0 : 0.5);
    else s = o.type === 'heal' ? 1 : 0.5;
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}
