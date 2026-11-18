import { pockets, R, dist, clamp, simulateShot, openSpot } from './physics.js';
import { targets, ruling } from './rules.js';
export function seeded(seed) {
  let n = seed >>> 0;
  return () => (n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296;
}
function clear(points, x, y, ex, ey, skip) {
  const dx = ex - x,
    dy = ey - y,
    den = dx * dx + dy * dy || 1;
  return !points.some(b => {
    if (b.potted || skip.includes(b.id)) return false;
    const t = clamp(((b.x - x) * dx + (b.y - y) * dy) / den, 0, 1);
    return dist(b.x, b.y, x + t * dx, y + t * dy) < R * 1.88;
  });
}
export function options(balls, seat, wells, bank = true) {
  const cue = balls[0],
    valid = targets(balls, seat),
    rows = [];
  for (const id of valid) {
    const b = balls.find(b => b.id === id);
    for (let pocket = 0; pocket < 6; pocket++) for (const rail of bank ? [null, 'top', 'bottom'] : [null]) {
      let [px, py] = pockets[pocket],
        ty = py;
      if (rail) ty = rail === 'top' ? 28 - py : 772 - py;
      const d = dist(b.x, b.y, px, ty),
        dx = (px - b.x) / d,
        dy = (ty - b.y) / d,
        gx = b.x - 2 * R * dx,
        gy = b.y - 2 * R * dy;
      const gap = dist(cue.x, cue.y, gx, gy),
        angle = Math.atan2(gy - cue.y, gx - cue.x),
        dot = Math.cos(angle) * dx + Math.sin(angle) * dy;
      if (dot < .12 || gx < 13 || gx > 787 || gy < 13 || gy > 387) continue;
      let blocked = !clear(balls, cue.x, cue.y, gx, gy, [0, id]);
      if (!rail) blocked ||= !clear(balls, b.x, b.y, px, py, [0, id]);
      if (rail) {
        const y = rail === 'top' ? 14 : 386,
          t = (y - b.y) / (ty - b.y),
          x = b.x + (px - b.x) * t;
        if (t <= 0 || t >= 1 || x < 32 || x > 768 || Math.abs(x - 400) < 34) continue;
        blocked ||= !clear(balls, b.x, b.y, x, y, [0, id]) || !clear(balls, x, y, px, py, [0, id]);
      }
      const needed = Math.sqrt(2 * 91 * (gap + d / Math.max(.16, dot * dot) * (rail ? 1.29 : 1))) + 26;
      rows.push({
        angle,
        power: clamp((needed - 100) / 490, .20, .95),
        spin: 0,
        called: pocket,
        rail,
        id,
        rank: (blocked ? 3 : 0) + (1 - dot) * 1.55 + (gap + d) / 1400 + (rail ? .7 : 0)
      });
    }
  }
  return rows.sort((a, b) => a.rank - b.rank);
}
export function placement(balls, seat, skill, random) {
  const cue = balls[0];
  if (skill === 0 && random() < .70) return [cue.x, cue.y];
  let best = null;
  for (const id of targets(balls, seat)) for (const [px, py] of pockets) {
    const b = balls.find(o => o.id === id),
      d = dist(px, py, b.x, b.y),
      dx = (b.x - px) / d,
      dy = (b.y - py) / d;
    for (const away of [78, 52, 114]) {
      const x = b.x + dx * away,
        y = b.y + dy * away;
      if (!openSpot(balls, x, y)) continue;
      const blocked = !clear(balls, b.x, b.y, px, py, [0, id]) || !clear(balls, x, y, b.x, b.y, [0, id]);
      const value = d + away * .25 + (blocked ? 1000 : 0);
      if (!best || best.value > value) best = {
        x,
        y,
        value
      };
    }
  }
  return best ? [best.x, best.y] : [cue.x, cue.y];
}
export function choose(balls, wells, seat, skill, rng, condition = 0) {
  const legal = targets(balls, seat),
    cue = balls[0],
    first = balls.find(b => b.id === legal[0]);
  let plans = options(balls, seat, wells, skill >= 2 || condition === 1);
  const onMoon = balls.find(b => b.id === legal[0])?.suit === 'moon';
  if (onMoon && condition === 1) plans = plans.filter(s => s.rail);
  if (onMoon && condition === 2) plans = plans.filter(s => s.called === 1 || s.called === 4);
  let best = null,
    bestValue = -Infinity;
  for (const shot of plans.slice(0, 1 + skill * 2)) {
    const result = simulateShot(balls, wells, shot),
      verdict = ruling(balls, result.log, seat, shot.called, condition);
    const next = targets(result.balls, seat),
      leave = next.length ? Math.min(...result.balls.filter(b => next.includes(b.id)).map(b => dist(result.balls[0].x, result.balls[0].y, b.x, b.y))) : 0;
    const value = verdict.win ? 100 : verdict.foul ? -9 : verdict.own * 8 + 1 - leave / 1500 - shot.rank * .13;
    if (value > bestValue) {
      best = shot;
      bestValue = value;
    }
    if (verdict.win) break;
  }
  // A deliberate defensive contact can tuck the cue behind a screen if all obvious pots foul.
  if (!best || bestValue < -1) {
    const nearest = balls.filter(b => legal.includes(b.id)).sort((a, b) => dist(cue.x, cue.y, a.x, a.y) - dist(cue.x, cue.y, b.x, b.y))[0] || first;
    best = {
      angle: Math.atan2(nearest.y - cue.y, nearest.x - cue.x),
      power: .40,
      spin: -.28,
      called: 0,
      safety: true
    };
  }
  const deviation = [.21, .092, .038, .017, .007, .002][skill],
    err = rng() + rng() - 1;
  return {
    ...best,
    angle: best.angle + err * deviation,
    power: clamp(best.power + (rng() - .5) * deviation * .9, .1, 1)
  };
}
