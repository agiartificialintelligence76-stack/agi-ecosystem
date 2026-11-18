import {
  dirs,
  vec,
  neighbor,
  walkable,
  hearing,
  approach,
  cone,
  face,
  dist,
  throwSpots,
  TAPES,
} from './geometry.js';
export const toss = (type, at) => 'T' + type + '.' + at;
export const decodeToss = (op) => {
  const m = /^T([01])\.(\d+)$/.exec(op);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
export function begin(r) {
  return {
    p: r.start,
    pose: 0,
    key: 0,
    bag: 0,
    frag: 0,
    phase: r.phase || 0,
    charges: r.charges,
    tape: -1,
    type: 0,
    life: 0,
    heat: 0,
    guards: r.patrols.map((route) => ({ p: route[0].p, f: route[0].f, i: 0, to: -1, linger: 0 })),
    caught: false,
  };
}
export const complete = (r, s) =>
  !s.caught && s.p === r.exit && s.bag === r.all && (!r.exitKey || s.key) && !s.heat;
export function signature(s) {
  return [
    s.p,
    s.pose,
    s.key,
    s.bag,
    s.frag,
    s.phase,
    s.charges,
    s.tape,
    s.type,
    s.life,
    s.heat,
    ...s.guards.flatMap((g) => [g.p, g.f, g.i, g.to, g.linger]),
  ].join(',');
}
export function visible(r, guard, s, range = 4) {
  if (guard.p === s.p) return true;
  if (s.pose && r.tiles[s.p] === 'm' && dist(r, guard.p, s.p) > 1) return false;
  return cone(r, guard.p, guard.f, s.key, range).has(s.p);
}
export const lens = (r, c, phase) => c.pattern[(phase + c.offset) % c.pattern.length];
export function playable(r, s, includeTapes = true) {
  const list = [];
  for (let f = 0; f < 4; f++) if (walkable(r, neighbor(r, s.p, f), s.key)) list.push(dirs[f]);
  list.push('Z');
  if (s.charges && includeTapes)
    for (const q of throwSpots(r, s.p, s.key)) for (let t = 0; t < r.tapes; t++) list.push(toss(t, q));
  return list;
}
function inspect(r, g, target, key, newSignal, linger = 2) {
  const nearby = approach(r, g.p, target, key);
  if (newSignal && g.to !== target)
    return { ...g, f: face(r, g.p, nearby === g.p ? target : nearby, g.f), to: target, linger };
  if (g.p !== target && nearby !== g.p)
    return { ...g, p: nearby, f: face(r, g.p, nearby, g.f), to: target, linger };
  if (g.linger > 0) return { ...g, to: target, linger: g.linger - 1 };
  return { ...g, to: -1, linger: 0 };
}
function patrol(r, g, route, key) {
  const target = route[(g.i + 1) % route.length];
  if (g.p === route[g.i].p) return { ...g, p: target.p, f: target.f, i: (g.i + 1) % route.length };
  const next = approach(r, g.p, route[g.i].p, key);
  return { ...g, p: next, f: face(r, g.p, next, g.f) };
}
export function turn(r, s, op) {
  if (s.caught) return { fault: 'caught' };
  const next = { ...s, guards: [] },
    events = [],
    t = decodeToss(op),
    f = dirs.indexOf(op);
  let foot = 0;
  if (f >= 0 && op.length === 1) {
    const to = neighbor(r, s.p, f);
    if (!walkable(r, to, s.key)) return { fault: r.tiles[to] === '+' ? 'locked' : 'wall' };
    next.p = to;
    next.pose = 0;
    const tile = r.tiles[to];
    foot = tile === 't' ? 3 : tile === 'c' || tile === 'm' ? 0 : 1;
    events.push(tile === 't' ? 'tile' : tile === 'c' ? 'carpet' : 'step');
    if (tile === 'k' && !s.key) {
      next.key = 1;
      events.push('key');
    }
    if (tile === '+' && s.key) events.push('door');
    if (tile === 'm') events.push('cover');
    const obj = r.items.indexOf(to);
    if (obj >= 0 && !(s.bag & (1 << obj))) {
      next.bag |= 1 << obj;
      events.push('diary');
    }
    if (to === r.fragment && !s.frag) {
      next.frag = 1;
      events.push('fragment');
    }
  } else if (op === 'Z') {
    next.pose = 1;
    events.push('wait');
  } else if (t) {
    if (t[0] >= r.tapes || !s.charges || !throwSpots(r, s.p, s.key).includes(t[1]))
      return { fault: 'blocked throw' };
    next.tape = t[1];
    next.type = t[0];
    next.life = TAPES[t[0]].life;
    next.charges--;
    events.push('throw');
  } else return { fault: 'unknown cue' };
  next.phase = (s.phase + 1) % r.period;
  let seen = false,
    contact = false,
    listeners = 0,
    returned = 0;
  for (const [i, g] of s.guards.entries()) {
    const sees = visible(r, g, next, r.ranges[i]);
    const heard = next.life ? hearing(r, g.p, next.key, next.tape) : 32767;
    const sole = foot ? hearing(r, g.p, next.key, next.p) : 32767;
    const tapeAudible = next.life && heard <= TAPES[next.type].reach,
      soleAudible = foot && sole <= foot;
    let guard;
    if (sees) {
      seen = true;
      guard = inspect(r, g, next.p, next.key, true, 1);
    } else {
      // Favor the nearer audible event. On ties the distinctive prerecorded
      // pitch draws the ear. A nearer new event can replace an old destination.
      const source = tapeAudible && (!soleAudible || heard <= sole) ? next.tape : soleAudible ? next.p : -1;
      const nearer =
        source >= 0 &&
        (g.to < 0 || g.to === source || hearing(r, g.p, next.key, source) <= hearing(r, g.p, next.key, g.to));
      if (nearer) {
        if (source === next.tape && tapeAudible) {
          listeners++;
          if (g.to !== source) events.push(g.to >= 0 ? 'interrupt' : 'listen');
        } else if (soleAudible && g.to !== source) events.push('heard steps');
        guard = inspect(r, g, source, next.key, true);
      } else if (g.to !== -1) {
        guard = inspect(r, g, g.to, next.key, false);
        if (guard.to === -1) returned++;
      } else guard = patrol(r, g, r.patrols[i], next.key);
    }
    if (guard.p === next.p || (g.p === next.p && guard.p === s.p)) contact = true;
    if (visible(r, guard, next, r.ranges[i])) seen = true;
    next.guards.push(guard);
  }
  if (listeners > 1) events.push('double');
  if (t && !listeners) events.push('unheard');
  if (returned) events.push('return');
  for (const cam of r.cameras) {
    const active = lens(r, cam, next.phase),
      was = lens(r, cam, s.phase);
    if (active !== was && active >= 0) events.push('sweep');
    if (
      active >= 0 &&
      !(next.pose && r.tiles[next.p] === 'm') &&
      cone(r, cam.p, active, next.key, cam.range).has(next.p)
    ) {
      seen = true;
      events.push('camera');
    }
  }
  if (seen || contact) {
    events.push('seen');
    next.caught = contact || s.heat > 0;
    next.heat = 1;
  } else {
    if (s.heat) events.push('cool');
    next.heat = 0;
  }
  if (next.life > 0) {
    next.life--;
    if (!next.life) {
      next.tape = -1;
      next.type = 0;
      events.push('fade');
    }
  }
  if (complete(r, next)) events.push('exit');
  return { state: next, events };
}
