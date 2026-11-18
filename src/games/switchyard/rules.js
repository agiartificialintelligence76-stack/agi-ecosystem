// Actions 0..3 are N/E/S/W, 4..7 connect at the free end, 8 releases its last car,
// 9 onward operate individual devices. Every successful action costs exactly one.
export const DIRECTION = ['north', 'east', 'south', 'west'];
export const GLYPH = ['↑', '→', '↓', '←'];
export const opposite = d => (d + 2) % 4;
export const bit = (state, index) => state.bits >> index & 1;
export const solved = state => state.cars.every(p => p < 0);
export function ticketHead(yard, state, kitchen) {
  const ticket = yard.tickets[kitchen];
  const served = ticket.reduce((n, car) => n + Number(state.cars[car] < 0), 0);
  return ticket[served] ?? -1;
}
export function deviceLocked(yard, s, index) {
  const d = yard.devices[index],
    at = d.node;
  if (d.type === '+') return s.e === at || s.cars.includes(at);
  return s.chain.length > 0 && (s.e === at || s.chain.some(car => s.cars[car] === at));
}
function bridgeAllows(yard, s, node, dir) {
  const d = yard.devices[yard.points[node].dev];
  return !d || d.type !== '%' || dir % 2 === (d.axis ^ bit(s, yard.points[node].dev));
}
function selectedPath(yard, s, node, incoming, dir) {
  const id = yard.points[node].dev,
    d = yard.devices[id];
  if (d?.type !== '+' || incoming === dir || incoming < 0) return true;
  const [stem, first, second] = d.dirs,
    exit = bit(s, id) ? second : first;
  return incoming === stem ? dir === exit : dir === stem;
}
function edge(yard, s, node, dir, incoming = -1) {
  const next = yard.points[node].links[dir];
  if (next < 0 || yard.oneWay.has(node + ',' + next) || !bridgeAllows(yard, s, node, dir) || !bridgeAllows(yard, s, next, dir) || !selectedPath(yard, s, node, incoming, dir)) return -1;
  return next;
}
export function apply(yard, s, a) {
  if (solved(s)) return null;
  if (a >= 9) {
    const i = a - 9,
      d = yard.devices[i];
    if (!d || deviceLocked(yard, s, i)) return null;
    let h = s.h;
    if (d.type === '%' && s.e === d.node) h = (h + (bit(s, i) ? 3 : 1)) % 4;
    return {
      ...s,
      h,
      bits: s.bits ^ 1 << i
    };
  }
  const train = s.chain,
    tail = train.length ? s.cars[train.at(-1)] : s.e;
  if (a === 8) return train.length ? {
    ...s,
    chain: train.slice(0, -1)
  } : null;
  if (a >= 4) {
    const dir = a - 4,
      next = yard.points[tail].links[dir];
    if (next < 0 || !bridgeAllows(yard, s, tail, dir) || !bridgeAllows(yard, s, next, dir)) return null;
    const wagon = s.cars.indexOf(next);
    if (wagon < 0 || train.includes(wagon)) return null;
    return {
      ...s,
      chain: [...train, wagon]
    };
  }
  const from = opposite(s.h),
    target = edge(yard, s, s.e, a, from);
  if (target < 0) return null;
  const occupant = s.cars.indexOf(target);
  if (occupant >= 0 && train[0] !== occupant) return null;
  const cars = s.cars.slice();
  if (train.length) {
    if (occupant >= 0) {
      const prev = train.length === 1 ? s.e : cars[train.at(-2)],
        incoming = yard.points[tail].links.indexOf(prev);
      const straight = opposite(incoming),
        hand = yard.mirror === 1 || yard.mirror === 2 ? 3 : 1;
      const dirs = [straight, (straight + hand) % 4, (straight + 4 - hand) % 4];
      // Passive forks continue straight where possible. An obstructed selected path buffers the train.
      const dir = dirs.find(d => edge(yard, s, tail, d, incoming) >= 0);
      if (dir === undefined) return null;
      const ahead = yard.points[tail].links[dir];
      if (ahead === s.e || s.cars.includes(ahead)) return null;
      for (let i = 0; i < train.length - 1; i++) cars[train[i]] = s.cars[train[i + 1]];
      cars[train.at(-1)] = ahead;
    } else {
      for (let i = train.length - 1; i >= 0; i--) cars[train[i]] = i ? s.cars[train[i - 1]] : s.e;
    }
    // Every wheel must follow an open physical edge; no loose wagon can enter an engine refuge.
    for (let i = 0; i < train.length; i++) {
      const car = train[i],
        start = s.cars[car],
        end = cars[car],
        dir = yard.points[start].links.indexOf(end);
      if (dir < 0 || edge(yard, s, start, dir) < 0 || yard.points[end].ch === '!') return null;
    }
  }
  let chain = train;
  if (train.length) {
    const car = train.at(-1),
      window = yard.kitchen[car];
    if (cars[car] === yard.windows[window] && yard.dish[ticketHead(yard, s, window)] === yard.dish[car]) {
      cars[car] = -1;
      chain = train.slice(0, -1);
    }
  }
  return {
    e: target,
    h: a,
    cars,
    chain,
    bits: s.bits
  };
}
export function legal(yard, s) {
  const result = [];
  for (let a = 0; a < 9 + yard.devices.length; a++) {
    const n = apply(yard, s, a);
    if (n) result.push([a, n]);
  }
  return result;
}
export function key(yard, s) {
  // Heading constrains turnout traversal only. On an ordinary berth the locomotive can reverse freely.
  const device = yard.devices[yard.points[s.e].dev];
  return s.e + '|' + (device?.type === '+' ? s.h : 0) + '|' + s.bits + '|' + s.cars.join('.') + '|' + s.chain.join('.');
}
export function moveRoute(yard, s, target) {
  const queue = [{
      s,
      path: []
    }],
    seen = new Set([key(yard, s)]);
  for (let i = 0; i < queue.length && i < 500; i++) {
    const item = queue[i];
    if (item.s.e === target) return item.path;
    if (item.path.length >= 10) continue;
    for (let a = 0; a < 4; a++) {
      const n = apply(yard, item.s, a);
      if (!n) continue;
      const k = key(yard, n);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({
        s: n,
        path: [...item.path, a]
      });
    }
  }
  return null;
}
export function mirrorAction(action, mirror) {
  if (action >= 8) return action;
  const d = action % 4;
  return action - d + (mirror & 1 && d % 2 ? (4 - d) % 4 : mirror & 2 && !(d % 2) ? (d + 2) % 4 : d);
}
export function label(yard, s, a) {
  if (a < 4) return 'Roll ' + DIRECTION[a];
  if (a < 8) return 'Couple ' + DIRECTION[a - 4];
  if (a === 8) return 'Drop tail';
  const d = yard.devices[a - 9];
  return d.type === '%' ? 'Turn bridge' : 'Throw point ' + (a - 8);
}
