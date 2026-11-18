import { ids, start, code, delivered, transition } from './rolling.js';
const memo = new WeakMap();
export function solve(d, from = start(d), limit = 180000) {
  let map = memo.get(d);
  if (!map) {
    map = new Map();
    memo.set(d, map);
  }
  const initial = code(from);
  if (map.has(initial)) return map.get(initial);
  const queue = [{ p: from, parent: -1, input: '', depth: 0 }],
    seen = new Set([initial]),
    frontiers = [];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    frontiers[node.depth] = (frontiers[node.depth] || 0) + 1;
    if (delivered(d, node.p)) {
      let j = i;
      const steps = [];
      while (queue[j].parent !== -1) {
        steps.push(queue[j].input);
        j = queue[j].parent;
      }
      const result = { steps: steps.reverse(), par: node.depth, visited: seen.size, frontiers };
      if (map.size < 150) map.set(initial, result);
      return result;
    }
    for (const input of node.p.parts ? ids : ids.slice(0, 4)) {
      const { state } = transition(d, node.p, input);
      if (!state) continue;
      const hash = code(state);
      if (seen.has(hash)) continue;
      if (seen.size >= limit) throw new Error('Unproved frontier in ' + d.name);
      seen.add(hash);
      queue.push({ p: state, input, parent: i, depth: node.depth + 1 });
    }
  }
  return null;
}
export function replay(d, steps, from = start(d)) {
  let state = from;
  const events = new Set();
  for (const input of steps) {
    const landing = transition(d, state, input);
    if (!landing.state) return { fault: landing.fault, state, events: [...events] };
    state = landing.state;
    for (const name of landing.events) events.add(name);
  }
  return { state, events: [...events], clear: delivered(d, state) };
}
export const stars = (rolls, par) => (rolls <= par ? 3 : rolls <= par + Math.ceil(par * 0.25) ? 2 : 1);
