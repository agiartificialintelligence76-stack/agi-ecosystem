export const DT = 1 / 120,
  TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const quantAngle = a => Math.round(a * 360 / Math.PI) * Math.PI / 360;
export const quantPower = x => Math.round(clamp(x, .08, 1) * 100) / 100;
export function acceleration(wells, pos, t, sign = 1) {
  let ax = 0,
    ay = 0;
  for (const w of wells) {
    const wx = w.x + Math.sin(t * (w.rate || 0) + (w.phase || 0)) * (w.drift || 0),
      wy = w.y + Math.cos(t * (w.rate || 0) + (w.phase || 0)) * (w.drift || 0);
    const dx = wx - pos.x,
      dy = wy - pos.y,
      rr = dx * dx + dy * dy + (w.soft || 27) ** 2;
    const k = w.mass * sign / (rr * Math.sqrt(rr));
    ax += dx * k;
    ay += dy * k;
  }
  return [ax, ay];
}
export function launch(tee, aim, power, fuel = 3) {
  const a = quantAngle(aim),
    p = quantPower(power),
    speed = 72 + 130 * p;
  return {
    x: tee.x,
    y: tee.y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    tick: 0,
    sign: 1,
    fuel,
    flip: true,
    charged: false,
    rings: 0,
    ringMask: 0,
    phase: 'flight',
    hold: 0,
    entered: false,
    fast: false,
    gateMiss: false,
    energyMiss: false,
    close: false,
    near: 1e6,
    burns: 0,
    stamps: [],
    inputs: [],
    tail: []
  };
}
export function control(f, id, leg) {
  if (f.phase !== 'flight') return false;
  if (id === 'flip') {
    if (!f.flip) return false;
    f.flip = false;
    f.sign *= -1;
  } else if (['port', 'starboard', 'brake'].includes(id)) {
    if (f.fuel <= 0) return false;
    f.fuel--;
    f.burns++;
    if (id === 'brake') {
      f.vx *= .61;
      f.vy *= .61;
    } else {
      const speed = Math.max(1, Math.hypot(f.vx, f.vy)),
        hand = id === 'port' ? -1 : 1;
      const dx = -f.vy / speed * hand * 37,
        dy = f.vx / speed * hand * 37;
      f.vx += dx;
      f.vy += dy;
    }
    if (leg?.beacon && gap(f, leg.beacon) < leg.beacon.radius) f.charged = true;
  } else return false;
  f.inputs.push({
    tick: f.tick,
    id
  });
  return true;
}
export function drift(f, wells) {
  const t = f.tick * DT,
    [ax, ay] = acceleration(wells, f, t, f.sign);
  f.vx += ax * DT * .5;
  f.vy += ay * DT * .5;
  f.x += f.vx * DT;
  f.y += f.vy * DT;
  const [bx, by] = acceleration(wells, f, t + DT, f.sign);
  f.vx += bx * DT * .5;
  f.vy += by * DT * .5;
  f.tick++;
}
export function cupAt(leg, tick) {
  const t = tick * DT,
    m = leg.cup;
  return {
    x: m.x + (m.dx || 0) * Math.sin(t * (m.rate || 1) + m.phase),
    y: m.y + (m.dy || 0) * Math.cos(t * (m.rate || 1) + m.phase),
    vx: (m.dx || 0) * (m.rate || 1) * Math.cos(t * (m.rate || 1) + m.phase),
    vy: -(m.dy || 0) * (m.rate || 1) * Math.sin(t * (m.rate || 1) + m.phase),
    gate: m.gate + (m.swing || 0) * Math.sin(t * (m.rate || 1) + m.phase)
  };
}
export function segmentGap(x, y, nx, ny, p) {
  const dx = nx - x,
    dy = ny - y,
    u = clamp(((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x + u * dx - p.x, y + u * dy - p.y);
}
export function advance(f, leg) {
  if (f.phase !== 'flight' && f.phase !== 'capture') return [];
  const events = [],
    x = f.x,
    y = f.y,
    wasCapture = f.phase === 'capture',
    cup = cupAt(leg, f.tick);
  if (wasCapture) {
    const dx = f.x - cup.x,
      dy = f.y - cup.y,
      rvx = f.vx - cup.vx,
      rvy = f.vy - cup.vy;
    f.vx += (-8.8 * dx - 2.7 * rvx - 1.95 * dy) * DT;
    f.vy += (-8.8 * dy - 2.7 * rvy + 1.95 * dx) * DT;
    f.x += f.vx * DT;
    f.y += f.vy * DT;
    f.tick++;
  } else drift(f, leg.wells);
  const next = cupAt(leg, f.tick),
    speed = Math.hypot(f.vx - next.vx, f.vy - next.vy),
    distance = gap(f, next);
  if (wasCapture) {
    if (distance > leg.radius * 1.22 || speed > leg.maxSpeed * 1.12) {
      f.phase = 'flight';
      f.hold = 0;
      f.entered = false;
      events.push('rim');
    } else {
      f.hold += DT;
      if (f.hold >= leg.settle) {
        f.phase = 'sunk';
        events.push('sink');
      }
    }
  } else {
    for (const [i, r] of leg.rings.entries()) if (!(f.ringMask & 1 << i) && segmentGap(x, y, f.x, f.y, r) < r.radius) {
      f.ringMask |= 1 << i;
      f.rings++;
      f.stamps.push(i);
      events.push('ring');
    }
    if (leg.optional && !f.post && segmentGap(x, y, f.x, f.y, leg.optional) < leg.optional.radius) {
      f.post = true;
      f.fuel = Math.min(4, f.fuel + 1);
      events.push('satellite');
    }
    for (const w of leg.wells) {
      const distance = gap(f, w);
      f.near = Math.min(f.near, distance);
      if (distance < w.soft + 10 && !f.close) {
        f.close = true;
        events.push('close');
      }
    }
    if (!f.entered && segmentGap(x, y, f.x, f.y, next) < leg.radius) {
      f.entered = true;
      const angle = Math.atan2(f.vy - next.vy, f.vx - next.vx),
        okAngle = Math.cos(angle - next.gate) > Math.cos(leg.gateWidth);
      if (leg.phaseRequired && f.sign !== -1 || leg.beacon && !f.charged) {
        f.energyMiss = true;
        events.push('field');
      } else if (speed > leg.maxSpeed) {
        f.fast = true;
        events.push('fast');
      } else if (!okAngle) {
        f.gateMiss = true;
        events.push('rim');
      } else {
        f.phase = 'capture';
        f.hold = 0;
        events.push('capture');
      }
    } else if (f.entered && distance > leg.radius * 1.26) f.entered = false;
    if (f.tick > leg.timeout || f.x < leg.bounds[0] || f.x > leg.bounds[2] || f.y < leg.bounds[1] || f.y > leg.bounds[3]) {
      f.phase = 'lost';
      events.push('lost');
    }
  }
  if (f.tick % 4 === 0) {
    f.tail.push([f.x, f.y]);
    if (f.tail.length > 23) f.tail.shift();
  }
  return events;
}
export function runLeg(leg, input, trace = false) {
  const f = launch(leg.tee, input.angle, input.power, leg.fuel),
    points = [];
  let index = 0,
    events = [];
  while (f.phase === 'flight' || f.phase === 'capture') {
    while (input.controls[index]?.tick === f.tick) {
      control(f, input.controls[index++].id, leg);
    }
    events.push(...advance(f, leg));
    if (trace && f.tick % 6 === 0) points.push([f.x, f.y]);
  }
  return {
    flight: f,
    points,
    events
  };
}
