import { begin, turn, playable, complete, signature } from './patrol.js';
import { distances } from './geometry.js';
// Exact A*. An admissible bound is an optimal walk through the still-missing
// pages with every door open, all patrols stopped and no camera or tape cost.
const lowerCache = new WeakMap(),
  memo = new WeakMap();
export function lower(r, p, mask) {
  let tab = lowerCache.get(r);
  if (!tab) {
    tab = new Map();
    lowerCache.set(r, tab);
  }
  const key = p * 8 + mask;
  if (tab.has(key)) return tab.get(key);
  let n = 32767;
  if (mask === r.all) n = distances(r, r.exit, true)[p];
  else
    for (const [i, target] of r.items.entries())
      if (!(mask & (1 << i))) n = Math.min(n, distances(r, target, true)[p] + lower(r, target, mask | (1 << i)));
  tab.set(key, n);
  return n;
}
class Queue {
  a = [];
  less(a, b) {
    return a.f < b.f || (a.f === b.f && a.depth > b.depth);
  }
  add(item) {
    const a = this.a;
    let j = a.length;
    a.push(item);
    while (j) {
      const k = (j - 1) >> 1;
      if (!this.less(item, a[k])) break;
      a[j] = a[k];
      j = k;
    }
    a[j] = item;
  }
  pop() {
    const a = this.a,
      head = a[0],
      tail = a.pop();
    if (!a.length) return head;
    let i = 0;
    for (;;) {
      let j = i * 2 + 1;
      if (j >= a.length) break;
      if (j + 1 < a.length && this.less(a[j + 1], a[j])) j++;
      if (!this.less(a[j], tail)) break;
      a[i] = a[j];
      i = j;
    }
    a[i] = tail;
    return head;
  }
}
export function solve(r, from = begin(r), options = {}) {
  const { silent = true, decoy = true, limit = 155000, maxTurns = Infinity } = options;
  const key = signature(from) + '/' + silent + '/' + decoy + '/' + maxTurns;
  let cache = memo.get(r);
  if (!cache) {
    cache = new Map();
    memo.set(r, cache);
  }
  if (cache.has(key)) return cache.get(key);
  const seen = new Map(),
    queue = new Queue(),
    hist = [];
  const first = { state: from, depth: 0, f: lower(r, from.p, from.bag), op: null, prev: null };
  queue.add(first);
  seen.set(signature(from), 0);
  let expanded = 0;
  while (queue.a.length) {
    const n = queue.pop();
    if (n.f > maxTurns) break;
    if (seen.get(signature(n.state)) !== n.depth) continue;
    if (complete(r, n.state)) {
      const route = [];
      for (let p = n; p.prev; p = p.prev) route.push(p.op);
      const result = { par: n.depth, route: route.reverse(), expanded, lowerFrontier: hist.slice(0, n.depth) };
      if (cache.size < 350) cache.set(key, result);
      return result;
    }
    if (++expanded > limit) throw Error('Unproved search frontier in ' + r.name);
    hist[n.f] = (hist[n.f] || 0) + 1;
    for (const op of playable(r, n.state, decoy)) {
      const result = turn(r, n.state, op),
        s = result.state;
      if (!s || s.caught || (silent && result.events.includes('seen'))) continue;
      const cost = n.depth + 1,
        h = lower(r, s.p, s.bag);
      if (cost + h > maxTurns) continue;
      const sig = signature(s),
        old = seen.get(sig);
      if (old != null && old <= cost) continue;
      seen.set(sig, cost);
      queue.add({ state: s, depth: cost, f: cost + h, op, prev: n });
    }
  }
  return null;
}
export function replay(r, route, from = begin(r)) {
  let state = from;
  const events = [],
    trace = [state];
  for (const op of route) {
    const result = turn(r, state, op);
    if (!result.state) return { fault: result.fault, state, events, trace };
    state = result.state;
    trace.push(state);
    events.push(...result.events);
  }
  return { state, events, trace, ok: complete(r, state), silent: !events.includes('seen') };
}
