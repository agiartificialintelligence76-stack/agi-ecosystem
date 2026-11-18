import { ids, code, anchor, start, transition, delivered } from './rolling.js';
import { solve, stars } from './solver.js';
import { rng } from '../kit/fx.js';
function distance(d, p) {
  const [x, y] = anchor(p),
    [gx, gy] = d.goal.split(',').map(Number);
  if (p.parts) {
    const [a, b] = p.parts;
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + 2;
  }
  return Math.abs(x - gx) + Math.abs(y - gy) + (p.o === 'up' ? 0 : 0.3);
}
function look(d, p, depth, visited) {
  if (delivered(d, p)) return -15;
  if (!depth) return distance(d, p);
  let best = 25;
  for (const op of p.parts ? ids : ids.slice(0, 4)) {
    const next = transition(d, p, op).state;
    if (!next || visited.has(code(next))) continue;
    const route = new Set(visited);
    route.add(code(next));
    best = Math.min(best, 1 + look(d, next, depth - 1, route));
  }
  return best;
}
export function deliver(d, persona, seed) {
  const dice = rng(seed + Math.imul(d.id, 781)),
    expert = persona === 'expert',
    steady = persona === 'regular';
  const route = d.certificate.route,
    stack = [],
    visited = new Set();
  let bill = 0,
    state = start(d),
    seconds = 2.8,
    edges = 0,
    undos = 0,
    detours = 0,
    hints = 0,
    commands = 0;
  const dwell = () =>
    expert ? 0.88 + dice.next() * 0.35 : steady ? 2.35 + dice.next() * 1.65 : 3.75 + dice.next() * 2.7;
  for (const correct of route) {
    if (!expert) {
      const options = state.parts ? ids : ids.slice(0, 4);
      const available = options.map((op) => ({ op, ...transition(d, state, op) }));
      const misread = dice.next() < (steady ? 0.095 : 0.38);
      const bad = available.filter((n) => !n.state);
      if (misread && bad.length) {
        edges++;
        commands++;
        seconds += dwell();
      }
      const legal = available.filter((n) => n.state);
      // A mistaken out-and-back is a real paid pair when the dispatcher keeps
      // it on the slip. Fragile and automatic moves need not be reversible.
      if (dice.next() < (steady ? 0.12 : 0.29)) {
        const original = code(state);
        for (const n of legal) {
          const back = (n.state.parts ? ids : ids.slice(0, 4))
            .map((op) => transition(d, n.state, op).state)
            .find((p) => p && code(p) === original);
          if (back && !delivered(d, n.state)) {
            state = back;
            bill += 2;
            commands += 2;
            seconds += dwell() + dwell();
            break;
          }
        }
      }
      legal.sort(
        (a, b) =>
          look(d, a.state, steady ? 2 : 0, new Set([code(state)])) -
          look(d, b.state, steady ? 2 : 0, new Set([code(state)]))
      );
      const choice = legal.find((n) => !visited.has(code(n.state))) || legal[0];
      if (choice.op !== correct && dice.next() < (steady ? 0.45 : 0.85)) {
        stack.push(state);
        state = choice.state;
        visited.add(code(state));
        detours++;
        commands++;
        seconds += dwell();
        // After a wrong turn, read the next footprint before deciding to undo.
        if (!steady && dice.next() < 0.3) {
          const another = (state.parts ? ids : ids.slice(0, 4))
            .map((op) => transition(d, state, op).state)
            .find((n) => n && !visited.has(code(n)));
          if (another) {
            stack.push(state);
            state = another;
            visited.add(code(state));
            detours++;
            commands++;
            seconds += dwell();
          }
        }
        while (stack.length) {
          state = stack.pop();
          undos++;
          commands++;
          seconds += 0.6 + dice.next() * 1.1;
        }
        hints++;
        seconds += steady ? 1.4 : 2.8;
      }
    }
    state = transition(d, state, correct).state;
    if (!state) throw Error('Invalid registered route: ' + d.name);
    visited.add(code(state));
    seconds += dwell();
    commands++;
    bill++;
  }
  if (!delivered(d, state)) throw Error('Crew failed delivery: ' + d.name);
  return {
    solved: true,
    seconds,
    commands,
    bill,
    score: stars(bill, route.length) * 250 + route.length * 12,
    edges,
    hints,
    undos,
    detours,
  };
}
