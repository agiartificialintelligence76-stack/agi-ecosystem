import { writeFileSync } from 'node:fs';
import { plans } from './plans.mjs';
import {
  start,
  tip,
  slide,
  anchor,
  footprint,
  vectors,
  beltDir,
  code,
  cell,
} from '../../../src/games/waxworks/rolling.js';
import { replay, solve } from '../../../src/games/waxworks/solver.js';

function carve(plan, index) {
  const [name, source, lesson] = plan;
  let words = (source.includes(' ') ? source.split(' ') : [...source]).filter(Boolean);
  if (name === 'Sideways Load') words = ['E>v', 'E', 'N', 'N'];
  const landed = new Map(),
    fixtures = new Map(),
    candidates = [],
    moves = [],
    path = [],
    stamps = [],
    seams = [],
    chutes = [];
  let p = { x: 0, y: 0, o: 'up', parts: null, active: 0 },
    last = null;
  const paint = (q) => {
    for (const [x, y] of footprint(q)) landed.set(cell(x, y), [x, y]);
  };
  paint(p);
  const spawn = [0, 0];
  const stamp = (xy, mark) => {
    const id = xy.join();
    if (fixtures.has(id) && fixtures.get(id) !== mark)
      throw Error('Fixture collision ' + id + ' ' + mark + ' / ' + fixtures.get(id));
    fixtures.set(id, mark);
  };
  function step(dir) {
    moves.push(dir);
    p = dir === 'X' ? { ...p, active: 1 - p.active } : tip(p, dir);
    if (p.parts && p.parts[0].join() === p.parts[1].join()) throw Error('Overlap on ' + moves.join(''));
    paint(p);
    path.push({ ...p });
  }
  function seam() {
    if (!p.parts) throw Error('No pieces for seam');
    // Walk the selected half around the other to the nearest empty rail.
    // A stationary unit is an obstacle even to a one-square part.
    let [[ax, ay], [bx, by]] = p.parts;
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) {
      const target = p.parts[1 - p.active],
        queue = [[anchor(p), []]],
        seen = new Set();
      for (let i = 0; i < queue.length; i++) {
        const [[x, y], route] = queue[i];
        if (seen.has(cell(x, y))) continue;
        seen.add(cell(x, y));
        if (Math.abs(x - target[0]) + Math.abs(y - target[1]) === 1) {
          for (const dir of route) step(dir);
          break;
        }
        for (const dir of ['N', 'E', 'S', 'W']) {
          const [dx, dy] = vectors[dir],
            nx = x + dx,
            ny = y + dy;
          if (nx !== target[0] || ny !== target[1])
            queue.push([
              [nx, ny],
              [...route, dir],
            ]);
        }
      }
    }
    [[ax, ay], [bx, by]] = p.parts;
    seams.push(p.parts.map((a) => [...a]));
    p = { ...p, x: Math.min(ax, bx), y: Math.min(ay, by), o: ax === bx ? 'y' : 'x', parts: null, active: 0 };
    paint(p);
  }
  for (let word of words) {
    if (word === '=') {
      seam();
      continue;
    }
    const dir = word[0];
    if (!vectors[dir] && dir !== 'X') throw Error(word);
    if (word.includes('*') && tip(p, dir).o !== 'up') {
      // Advance to the next upright in the chosen aisle for the perforator.
      const orientation = tip(p, dir).o;
      step(dir);
      const next = orientation === 'x' ? 'E' : 'N';
      word = next + '*';
    }
    step(word[0]);
    const special = word.slice(1),
      at = anchor(p);
    if (special === 'g') candidates.push(footprint(p).map((pt) => pt.join()));
    if (special.startsWith('@')) {
      const [dx, dy] = special.slice(1).split(',').map(Number),
        dest = [at[0] + dx, at[1] + dy];
      stamp(at, 'O');
      stamp(dest, 'O');
      chutes.push([at, dest]);
      p = slide(p, dx, dy);
      paint(p);
    } else if (special === '*') {
      stamp(at, '*');
      const a = [p.x - 1, p.y],
        b = [p.x + 1, p.y];
      stamps.push([at, a, b]);
      p = { ...p, parts: [a, b], active: 0 };
      paint(p);
    } else if (['>', '<', '^', 'v'].includes(special[0])) {
      for (const mark of special) {
        const loc = anchor(p);
        stamp(loc, mark);
        p = slide(p, ...vectors[beltDir[mark]]);
        paint(p);
      }
    }
    last = word[0];
  }
  if (p.parts) throw Error('Missing seam');
  if (p.o !== 'up') step(p.o === 'x' ? 'E' : 'N');
  let goal = anchor(p);
  // Put the scale on an unobstructed, distinct square. A fixture is never
  // hidden beneath the required final orientation.
  if (fixtures.has(goal.join()) || goal.join() === '0,0') {
    step('E');
    step('E');
    goal = anchor(p);
  }
  const points = [...landed.values()],
    minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const local = (pt) => [pt[0] - minX, pt[1] - minY];
  const floors = Array.from({ length: maxY - minY + 1 }, () => Array(maxX - minX + 1).fill('.'));
  function put(pt, g) {
    const [x, y] = local(pt);
    floors[y][x] = g;
  }
  for (const pt of points) put(pt, '#');
  for (const [id, mark] of fixtures) put(id.split(',').map(Number), mark);
  const base = {
    id: index + 1,
    name,
    world: Math.min(4, Math.floor(index / 8)),
    lesson,
    start: { x: -minX, y: -minY, o: 'up' },
    goal: local(goal).join(),
    required: 0,
    chutes: chutes.map((pair) => pair.map(local)),
    stamps: stamps.map((record) => record.map(local)),
    seams: seams.map((pair) => pair.map(local)),
  };
  function packed() {
    return { ...base, rows: floors.map((row) => row.join('')) };
  }
  if (!replay(packed(), moves).clear) {
    const result = replay(packed(), moves);
    throw Error('Witness fails ' + result.fault + ' ' + code(result.state) + ' ' + moves.join(''));
  }
  if (candidates.length) {
    for (const group of candidates) {
      const preference = [
        ...group,
        ...path.filter((s) => s.parts || s.o !== 'up').flatMap((s) => footprint(s).map((pt) => pt.join())),
      ];
      let added = false;
      for (const id of preference) {
        if (fixtures.has(id) || id === goal.join() || id === '0,0') continue;
        const xy = id.split(',').map(Number);
        put(xy, '~');
        const candidate = packed(),
          best = solve(candidate);
        if (replay(candidate, moves).clear && best && replay(candidate, best.steps).events.includes('glass')) {
          fixtures.set(id, '~');
          added = true;
          break;
        }
        put(xy, '#');
      }
      if (!added) throw Error('No legal pane');
    }
  }
  // An adhesive label offers an optional detour early; later it records a
  // required passage across the far end of an aisle on the way to the scale.
  if (index >= 4) {
    const options = path.slice(2, -2).flatMap((state) => footprint(state));
    const ordered = [...options.slice(Math.floor(options.length * 0.45)), ...options];
    const seal = ordered.find(
      (pt) => pt.join() !== goal.join() && pt.join() !== '0,0' && !fixtures.has(pt.join())
    );
    if (seal) {
      put(seal, '+');
      base.required = 1;
    }
  }
  const level = packed(),
    best = solve(level);
  if (!best || !replay(level, moves).clear || best.par < 1) throw Error('Unsolved');
  return {
    ...level,
    certificate: { par: best.par, route: best.steps.join(''), frontiers: best.frontiers.slice(0, -1) },
  };
}
const depots = [];
let faults = 0;
for (const [i, entry] of plans.entries()) {
  try {
    const depot = carve(entry, i);
    depots.push(depot);
    console.log(
      depot.id,
      depot.name,
      depot.certificate.par,
      replay(depot, depot.certificate.route).events.join(',')
    );
  } catch (error) {
    faults++;
    console.error(i + 1, entry[0], error.message);
  }
}
if (faults) process.exitCode = 1;
else
  writeFileSync(
    new URL('../../../src/games/waxworks/depots.json', import.meta.url),
    JSON.stringify(depots, null, 2) + '\n'
  );
