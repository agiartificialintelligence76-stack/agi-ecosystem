import { key, legal, solved } from './rules.js';
class Heap {
  constructor() {
    this.items = [];
  }
  push(n) {
    let i = this.items.length;
    this.items.push(n);
    while (i) {
      const p = i - 1 >> 1;
      if (this.items[p].f <= n.f) break;
      this.items[i] = this.items[p];
      i = p;
    }
    this.items[i] = n;
  }
  pop() {
    const items = this.items,
      head = items[0],
      last = items.pop();
    if (items.length) {
      let i = 0;
      while (2 * i + 1 < items.length) {
        let c = 2 * i + 1;
        if (c + 1 < items.length && items[c + 1].f < items[c].f) c++;
        if (items[c].f >= last.f) break;
        items[i] = items[c];
        i = c;
      }
      items[i] = last;
    }
    return head;
  }
}
function estimateFor(yard) {
  const distances = yard.windows.map(start => {
    const dist = Array(yard.points.length).fill(999),
      queue = [start];
    dist[start] = 0;
    for (let i = 0; i < queue.length; i++) for (const n of yard.points[queue[i]].links) {
      if (n >= 0 && dist[n] > dist[queue[i]] + 1) {
        dist[n] = dist[queue[i]] + 1;
        queue.push(n);
      }
    }
    return dist;
  });
  // A car changes at most one berth per roll, at most one car is served per roll,
  // and each uncoupled remaining car needs its own link operation. These disjoint costs are admissible.
  return s => {
    let far = 0,
      remaining = 0;
    for (let i = 0; i < s.cars.length; i++) if (s.cars[i] >= 0) {
      remaining++;
      far = Math.max(far, distances[yard.kitchen[i]][s.cars[i]]);
    }
    return Math.max(far, remaining) + remaining - s.chain.length;
  };
}
export function* search(yard, start = yard.start, budget = 250000) {
  const h = estimateFor(yard),
    heap = new Heap(),
    first = {
      s: start,
      g: 0,
      f: h(start),
      prev: null,
      a: -1
    };
  heap.push(first);
  const seen = new Map([[key(yard, start), 0]]);
  let expanded = 0;
  while (heap.items.length) {
    const item = heap.pop();
    if (item.g !== seen.get(key(yard, item.s))) continue;
    if (solved(item.s)) {
      const path = [];
      for (let p = item; p.prev; p = p.prev) path.push(p.a);
      return {
        path: path.reverse(),
        expanded,
        complete: true
      };
    }
    if (expanded++ >= budget) return {
      path: null,
      expanded,
      complete: false
    };
    if (expanded % 350 === 0) yield expanded;
    for (const [a, s] of legal(yard, item.s)) {
      const g = item.g + 1,
        k = key(yard, s);
      if ((seen.get(k) ?? Infinity) <= g) continue;
      seen.set(k, g);
      const heuristic = h(s);
      heap.push({
        s,
        g,
        prev: item,
        a,
        f: g + heuristic + heuristic * .000001
      });
    }
  }
  return {
    path: null,
    expanded,
    complete: true
  };
}
export function solve(yard, start = yard.start, budget = 250000) {
  const it = search(yard, start, budget);
  let result;
  do {
    result = it.next();
  } while (!result.done);
  return result.value;
}
