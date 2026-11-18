export const W = 800,
  H = 400,
  R = 10,
  DT = 1 / 120;
export const pockets = [[13, 13], [400, 8], [787, 13], [13, 387], [400, 392], [787, 387]];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const dist = (x, y, a, b) => Math.hypot(x - a, y - b);
export function ball(id, x, y, suit = 'sun') {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    suit,
    potted: false,
    spin: 0
  };
}
export const copyBalls = balls => balls.map(b => ({
  ...b
}));
export function moving(b) {
  return !b.potted && Math.hypot(b.vx, b.vy) > .0001;
}
export function journal() {
  return {
    first: null,
    contacts: [],
    rails: [],
    pots: [],
    events: [],
    time: 0
  };
}
function record(log, type, data) {
  if (!log) return;
  const ev = {
    type,
    t: log.time,
    ...data
  };
  if (log.events.length < 160) log.events.push(ev);
  if (type === 'contact') {
    log.contacts.push([data.a, data.b]);
    if (log.first === null && (data.a === 0 || data.b === 0)) log.first = data.a || data.b;
  }
  if (type === 'rail') log.rails.push({
    id: data.id,
    side: data.side,
    after: log.first !== null
  });
  if (type === 'pot') log.pots.push({
    id: data.id,
    pocket: data.pocket
  });
}
export function strike(balls, angle, power, english = 0) {
  const cue = balls.find(b => b.id === 0);
  if (!cue || cue.potted || balls.some(moving)) return false;
  const speed = 100 + clamp(power, 0, 1) * 490;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
  cue.spin = clamp(english, -1, 1);
  return true;
}
export function impact(a, b, log) {
  let dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy);
  if (d >= R * 2) return false;
  if (d < 1e-8) {
    dx = 1;
    dy = 0;
    d = 1e-8;
  }
  const nx = d < 1e-7 ? 1 : dx / d,
    ny = d < 1e-7 ? 0 : dy / d,
    overlap = (2 * R - d + .0002) * .5;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return false;
  const j = rel * .981;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  for (const [cue, sign] of [[a, 1], [b, -1]]) if (cue.id === 0 && cue.spin) {
    const impulse = cue.spin * rel * .28 * sign;
    cue.vx += nx * impulse;
    cue.vy += ny * impulse;
    cue.spin = 0;
  }
  record(log, 'contact', {
    a: a.id,
    b: b.id,
    speed: rel,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });
  return true;
}
function cushion(b, axis, pos, side, log) {
  const velocity = axis === 'x' ? 'vx' : 'vy',
    normal = side === 'left' || side === 'top' ? 1 : -1;
  b[axis] = pos;
  if (b[velocity] * normal >= 0) return;
  const speed = Math.abs(b[velocity]);
  b[velocity] *= -.89;
  record(log, 'rail', {
    id: b.id,
    side,
    speed,
    x: b.x,
    y: b.y
  });
}
export function wellAt(w, time) {
  return {
    x: w.x + (w.dx || 0) * Math.sin(time * .60 + (w.phase || 0)),
    y: w.y + (w.dy || 0) * Math.sin(time * .48 + (w.phase || 0))
  };
}
export function tick(balls, wells = [], log, dt = DT) {
  const maxSpeed = balls.reduce((s, b) => b.potted ? s : Math.max(s, Math.hypot(b.vx, b.vy)), 0);
  const steps = Math.max(1, Math.ceil(maxSpeed * dt / (R * .5))),
    h = dt / steps;
  for (let sub = 0; sub < steps; sub++) {
    if (log) log.time += h;
    for (const b of balls) {
      if (!moving(b)) continue;
      for (const well of wells) {
        const w = wellAt(well, log?.time || 0);
        const dx = w.x - b.x,
          dy = w.y - b.y,
          den = (dx * dx + dy * dy + 1500) ** 1.5;
        b.vx += dx * well.mass * h / den;
        b.vy += dy * well.mass * h / den;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
      const speed = Math.hypot(b.vx, b.vy),
        factor = Math.max(0, 1 - h * 91 / speed);
      b.vx *= factor;
      b.vy *= factor;
      if (Math.hypot(b.vx, b.vy) < 3.6) {
        b.vx = 0;
        b.vy = 0;
        b.spin = 0;
      }
      const pocket = pockets.findIndex(([px, py]) => dist(b.x, b.y, px, py) < 22.8);
      if (pocket >= 0) {
        b.potted = true;
        b.vx = b.vy = 0;
        record(log, 'pot', {
          id: b.id,
          pocket,
          x: b.x,
          y: b.y,
          speed
        });
        continue;
      }
      // Steel jaws round the side mouths. A glancing ball can leave them without falling.
      for (const [jx, jy] of [[374, 4], [426, 4], [374, 396], [426, 396]]) {
        const dx = b.x - jx,
          dy = b.y - jy,
          d = Math.hypot(dx, dy);
        if (d <= 0 || d > 13) continue;
        const nx = dx / d,
          ny = dy / d,
          v = b.vx * nx + b.vy * ny;
        if (v < 0) {
          b.x = jx + nx * 13;
          b.y = jy + ny * 13;
          b.vx -= 1.8 * v * nx;
          b.vy -= 1.8 * v * ny;
          record(log, 'rail', {
            id: b.id,
            side: 'jaw',
            speed: -v,
            x: b.x,
            y: b.y
          });
        }
      }
      if (b.x < R + 4) cushion(b, 'x', R + 4, 'left', log);else if (b.x > W - R - 4) cushion(b, 'x', W - R - 4, 'right', log);
      if (b.y < R + 4) cushion(b, 'y', R + 4, 'top', log);else if (b.y > H - R - 4) cushion(b, 'y', H - R - 4, 'bottom', log);
    }
    for (let i = 0; i < balls.length; i++) if (!balls[i].potted) for (let j = i + 1; j < balls.length; j++) if (!balls[j].potted) impact(balls[i], balls[j], log);
  }
}
export function simulateShot(balls, wells, input) {
  const result = copyBalls(balls),
    log = journal();
  if (!strike(result, input.angle, input.power, input.spin || 0)) return {
    balls: result,
    log
  };
  for (let i = 0; i < 1200 && result.some(moving); i++) tick(result, wells, log);
  return {
    balls: result,
    log
  };
}
export function openSpot(balls, x, y, ignore = 0) {
  return x > 23 && x < W - 23 && y > 23 && y < H - 23 && !pockets.some(([px, py]) => dist(x, y, px, py) < 31) && !balls.some(b => b.id !== ignore && !b.potted && dist(x, y, b.x, b.y) < 2 * R + 1);
}
export function respot(balls, id, x = 180, y = 200) {
  const b = balls.find(o => o.id === id);
  if (!b) return false;
  if (!openSpot(balls, x, y, id)) {
    let found = false;
    for (let r = 14; r < 780 && !found; r += 16) for (let a = 0; a < Math.PI * 2; a += .35) {
      const xx = x + Math.cos(a) * r,
        yy = y + Math.sin(a) * r;
      if (openSpot(balls, xx, yy, id)) {
        x = xx;
        y = yy;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  Object.assign(b, {
    x,
    y,
    vx: 0,
    vy: 0,
    potted: false,
    spin: 0
  });
  return true;
}
export function guide(balls, angle) {
  const cue = balls[0],
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  let max = 180,
    id = null;
  if (Math.abs(dx) > 1e-8) max = Math.min(max, ((dx > 0 ? W - 14 : 14) - cue.x) / dx);
  if (Math.abs(dy) > 1e-8) max = Math.min(max, ((dy > 0 ? H - 14 : 14) - cue.y) / dy);
  max = Math.max(0, max);
  for (const b of balls.slice(1)) if (!b.potted) {
    const tx = b.x - cue.x,
      ty = b.y - cue.y,
      along = tx * dx + ty * dy,
      off = Math.abs(tx * dy - ty * dx);
    if (along > 0 && off < 2 * R) {
      const contact = along - Math.sqrt(4 * R * R - off * off);
      if (contact >= 0 && contact < max) {
        max = contact;
        id = b.id;
      }
    }
  }
  return {
    x: clamp(cue.x + dx * max, 13, W - 13),
    y: clamp(cue.y + dy * max, 13, H - 13),
    id
  };
}
