import { rng } from '../kit/fx.js';
import { begin, turn, complete, playable, signature, decodeToss, visible } from './patrol.js';
import { solve, lower } from './solver.js';
import { distances, neighbor, dirs } from './geometry.js';
import { campaign, noir } from './dossiers.js';
const profiles = {
  newcomer: { lapse: 0.39, wing: 0.078, read: 3.3, inspect: 3, field: 0 },
  regular: { lapse: 0.13, wing: 0.033, read: 2.12, inspect: 4.2, field: 1 },
  expert: { lapse: 0.031, wing: 0.012, read: 1.72, inspect: 3.6, field: 2 },
};
function floorCost(r, s, op) {
  const n = neighbor(r, s.p, dirs.indexOf(op));
  let bag = s.bag;
  const obj = r.items.indexOf(n);
  if (obj >= 0) bag |= 1 << obj;
  const base = lower(r, n, bag);
  return r.exitKey && !s.key && r.keyAt !== n
    ? Math.max(base, distances(r, r.keyAt, true)[n] + distances(r, r.exit, true)[r.keyAt])
    : base;
}
function unplanned(r, s, profile, dice, goal) {
  const options = playable(r, s, false).filter((op) => op !== 'Z');
  if (!options.length) return 'Z';
  const scored = options.map((op) => {
    const p = neighbor(r, s.p, dirs.indexOf(op)),
      simple = floorCost(r, s, op);
    let warning = 0;
    if (profile.field && s.guards.some((g, i) => visible(r, g, { ...s, p, pose: 0 }, r.ranges[i])))
      warning = profile.field === 2 ? 1.2 : 0.7;
    return { op, weight: simple + warning + dice.next() * (profile.field === 0 ? 3.6 : 0.8) };
  });
  scored.sort((a, b) => a.weight - b.weight);
  // A missed tape or a hurried wait often turns into the best-looking footstep.
  return scored[0].op;
}
function encounter(item, persona, dice, remaining, contractIndex = 0) {
  const { room: r, certificate: cert } = item,
    profile = profiles[persona];
  let state = begin(r),
    path = cert.route,
    ptr = 0,
    alerts = 0,
    undos = 0;
  const isContract = remaining !== Infinity;
  // The printed campaign exhibit includes a first-time route-reading budget.
  // Noir uses repeat plays; its impatient reader commits the first visible move.
  let seconds = profile.inspect + r.wing * 0.68 + (isContract ? 0 : 6),
    turns = 0,
    attempts = 1,
    hints = 0,
    throws = 0,
    diverted = 0,
    cones = 0,
    camera = 0,
    heard = 0,
    hood = 0,
    firstAlert = false;
  const cap = cert.par * 5 + 16,
    seen = new Map();
  for (; turns < cap && alerts < remaining && !complete(r, state); ) {
    const tutorial = !isContract && r.id === 1 && turns < 2;
    const old = state,
      planned = path[ptr],
      frequency = tutorial ? 0 : profile.lapse + profile.wing * r.wing + Math.min(0.11, contractIndex * 0.007);
    const lapse = dice.next() < frequency;
    let op = lapse || !planned ? unplanned(r, state, profile, dice, planned) : planned;
    const result = turn(r, state, op);
    if (!result.state) break;
    state = result.state;
    turns++;
    seconds +=
      profile.read * (0.78 + dice.next() * 0.48) * (isContract && persona === 'newcomer' ? 0.77 : 1) + 0.18;
    if (decodeToss(op)) {
      throws++;
      seconds += profile.read * 0.62;
    }
    if (result.events.includes('listen') || result.events.includes('interrupt')) diverted++;
    if (result.events.includes('heard steps')) heard++;
    if (r.tiles[state.p] === 'm' && state.pose) hood++;
    if (result.events.includes('seen') && !old.heat) {
      alerts++;
      firstAlert = true;
      if (result.events.includes('camera')) camera++;
      else cones++;
    }
    if (alerts >= remaining) break;
    if (state.caught) {
      attempts++;
      state = begin(r);
      path = cert.route;
      ptr = 0;
      seen.clear();
      seconds += 3.5;
      continue;
    }
    if (op === planned) {
      ptr++;
      continue;
    }
    const key = signature(state),
      count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (!state.heat && count < 2 && dice.next() < 0.11 && remaining === Infinity) {
      // Campaign allows stepping back once, including restoring sound/guard data.
      state = old;
      undos++;
      seconds += 0.7;
      continue;
    }
    let next = null;
    try {
      next =
        solve(r, state, { silent: !state.heat, limit: 1600 }) || solve(r, state, { silent: false, limit: 800 });
    } catch {
      /* An exhausted search is never counted as a solution. */
    }
    if (next) {
      path = next.route;
      ptr = 0;
      if (persona === 'newcomer' && count > 1) hints++;
    } else {
      path = [];
      ptr = 0;
      if (count > 1) {
        hints++;
        state = begin(r);
        path = cert.route;
        ptr = 0;
        attempts++;
        seconds += 3;
        seen.clear();
      }
    }
  }
  const clear = complete(r, state),
    stars = clear ? 1 + (alerts === 0 ? 1 : 0) + (alerts === 0 && turns <= cert.par ? 1 : 0) : 0;
  return {
    clear,
    stars,
    score: clear
      ? stars * 300 +
        r.items.length * 80 +
        Math.max(0, cert.par * 8 - (turns - cert.par) * 5) +
        (state.frag ? 60 : 0)
      : 0,
    seconds,
    turns,
    par: cert.par,
    alerts,
    attempts,
    hints,
    throws,
    diverted,
    cones,
    camera,
    heard,
    hood,
    undos,
    cleanFirst: clear && !firstAlert && attempts === 1 && hints === 0,
  };
}
export function campaignRun(room, persona, seed) {
  return encounter(campaign(room), persona, rng(seed * 3 + room.id * 37), Infinity);
}
export function contractRun(seed, persona) {
  const dice = rng(seed * 137 + 53),
    total = {
      rooms: 0,
      seconds: 0,
      turns: 0,
      score: 0,
      alerts: 0,
      throws: 0,
      diverted: 0,
      cones: 0,
      camera: 0,
      heard: 0,
      hood: 0,
      hints: 0,
      over: 0,
    };
  for (let i = 0; i < 45 && total.alerts < 3; i++) {
    const result = encounter(noir(seed, i), persona, dice, 3 - total.alerts, i);
    for (const key of [
      'seconds',
      'turns',
      'score',
      'alerts',
      'throws',
      'diverted',
      'cones',
      'camera',
      'heard',
      'hood',
      'hints',
    ])
      total[key] += result[key];
    if (!result.clear) {
      if (total.alerts < 3) total.exhausted = true;
      break;
    }
    total.rooms++;
    total.over += result.turns - result.par;
  }
  return total;
}
