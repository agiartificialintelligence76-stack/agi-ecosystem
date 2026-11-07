// ROBOTAXI RUSH: the robotaxi driving itself (the ?demo preview, and the title screen behind the menu). Pure (no DOM).
//
// Ten or so times a second it looks a second and a half ahead: for each spot across the road worth trying (each lane,
// just beside each car coming up, each passenger pin) it plays the robotaxi's own steering forward against where every
// car will be (lane changes and all), and keeps the spot that crashes into nothing and brushes past the most cars. It
// boosts when the meter is full and the road ahead is fairly straight.
import { LANE_X, ROAD_HALF, PLAYER, SPEED, clamp, segOf } from './config.js';
import { HIT_W, predictX } from './traffic.js';

const H = 1.5, STEP = 0.05;
const cands = new Float64Array(72);
const minGap = new Float64Array(64), wasBeside = new Uint8Array(64), counted = new Uint8Array(64);

export function createAI({ safety = 80, greed = 1 } = {}) {
  let target = null, timer = 0;

  function evaluate(run, tx) {
    const cars = run.traffic.cars;
    const n = Math.min(cars.length, 64);
    // its own speed: back up towards cruise (or boost), as the sim does
    const top = run.cruise * (run.boostT > 0 ? SPEED.boost : 1);
    let v = run.speed;
    const safeUntil = Math.max(run.grace, run.boostT) - 0.12;
    let px = run.x, vx = run.vx, pz = run.z, score = 0;
    for (let k = 0; k < n; k++) { minGap[k] = Infinity; wasBeside[k] = 0; counted[k] = 0; }
    for (let t = STEP; t <= H + 1e-9; t += STEP) {
      const want = clamp((tx - px) * 9, -SPEED.lat, SPEED.lat);
      vx += (want - vx) * (1 - Math.exp(-SPEED.latRate * STEP));
      px += vx * STEP;
      if (t > run.boostT && run.boostT > 0) v = Math.max(run.cruise, v - SPEED.decel * STEP);
      else if (v < top) v = Math.min(top, v + SPEED.accel * STEP);
      pz += v * STEP;
      for (let k = 0; k < n; k++) {
        const c = cars[k];
        if (c.flying || c.hit || counted[k]) continue;
        const dz = c.z + c.v * t - pz;
        const reach = (c.len + PLAYER.len) / 2 + 40;
        if (dz > reach) continue;
        if (dz < -reach) {
          if (wasBeside[k]) {
            counted[k] = 1;
            const g = minGap[k];
            if (g < 230) score += 260 * greed + (g < 90 ? 120 * greed : 0);
          }
          continue;
        }
        const dx = Math.abs(predictX(c, t) - px);
        wasBeside[k] = 1;
        const vis = dx - (PLAYER.halfW + c.halfW);
        if (vis < minGap[k]) minGap[k] = vis;
        if (t > safeUntil && dx - (PLAYER.hitHalfW + c.halfW * HIT_W) < safety) return -10000 * (H + 0.2 - t) - Math.abs(tx - run.x);
      }
    }
    for (const it of run.traffic.items) {
      if (it.taken) continue;
      const dz = it.z - run.z;
      if (dz < 0 || dz > run.speed * H) continue;
      // roughly where it'll be when the pin comes by
      const t = dz / run.speed;
      const reachX = Math.abs(tx - run.x) < SPEED.lat * Math.max(0, t - 0.15) ? tx : run.x + Math.sign(tx - run.x) * SPEED.lat * Math.max(0, t - 0.15);
      if (Math.abs(reachX - it.x) < 480) score += it.kind === 'shield' && run.shields < 3 ? 900 : 380;
    }
    // stay on the road, settle in lanes, don't wander for nothing
    if (Math.abs(tx) > ROAD_HALF - 260) score -= 220;
    let lane = Infinity;
    for (const lx of LANE_X) lane = Math.min(lane, Math.abs(lx - tx));
    score -= lane * 0.04 + Math.abs(tx - run.x) * 0.05;
    return score;
  }

  function choose(run) {
    let n = 0;
    const add = (x) => {
      const cx = clamp(x, -ROAD_HALF + 170, ROAD_HALF - 170);
      for (let i = 0; i < n; i++) if (Math.abs(cands[i] - cx) < 45) return;
      if (n < cands.length) cands[n++] = cx;
    };
    add(run.x);
    if (target != null) add(target);
    for (const lx of LANE_X) add(lx);
    const horizon = run.speed * H + 1500;
    for (const c of run.traffic.cars) {
      if (c.flying || c.hit) continue;
      const dz = c.z - run.z;
      if (dz < -400 || dz > horizon) continue;
      const off = c.halfW + PLAYER.halfW + 115;
      add(c.x - off); add(c.x + off);
    }
    for (const it of run.traffic.items) if (!it.taken && it.z > run.z && it.z - run.z < horizon) add(it.x);
    let best = run.x, bestScore = -Infinity;
    for (let i = 0; i < n; i++) {
      let s = evaluate(run, cands[i]);
      if (target != null && Math.abs(cands[i] - target) < 45) s += 50;   // keep to a plan
      if (s > bestScore) { bestScore = s; best = cands[i]; }
    }
    return best;
  }

  return {
    reset() { target = null; timer = 0; },
    // fills `out` ({ steer, target, boost }) for this step
    drive(run, out, dt) {
      out.steer = 0;
      out.boost = false;
      timer -= dt;
      if (timer <= 0 || target == null) { timer = 0.08; target = choose(run); }
      out.target = target;
      if (run.boost >= 1 && run.boostT <= 0 && !run.over && run.track.bendAhead(segOf(run.z), 48) < 1.7) out.boost = true;
    },
    get target() { return target; },
  };
}
