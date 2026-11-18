import { lighting, playCue } from './productions.js';
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const initial = (cat = [0, 2]) => ({
  actors: [
    { x: 0, y: 0, dir: 1, pose: 'ready' },
    { x: cat[0], y: cat[1], dir: 1, pose: 'ready' },
  ],
  active: 0,
});
export function move(cast, code) {
  const actors = cast.actors.map((a) => ({ ...a, pose: 'ready' }));
  let active = cast.active;
  if (code === 'K') {
    active = 1 - active;
    actors[active].pose = 'enter';
  } else {
    const a = actors[active];
    if (code === 'S') {
      const [dx, dy] = directions[a.dir];
      a.x += dx;
      a.y += dy;
      a.pose = 'step';
    }
    if (code === 'R') a.dir = (a.dir + 1) % 4;
    if (code === 'L') a.dir = (a.dir + 3) % 4;
    if (code === 'B') a.pose = 'bow';
    if (code === 'P') a.pose = 'paw';
    if (code === 'W') a.pose = 'rest';
  }
  return { actors, active };
}
const memo = new WeakMap();
export function blocking(scene) {
  if (memo.has(scene)) return memo.get(scene);
  const hasCat = scene.act === 4;
  // The stage manager places the cat's stool near the apron, leaving both
  // performers room for every alternate blocking. Check the entire performance.
  let traces;
  for (const cat of [
    [1, 1],
    [0, 2],
    [-1, 1],
    [2, 2],
    [-2, 2],
    [0, 4],
    [-3, 0],
    [4, 3],
    [-5, 5],
    [12, 12],
  ]) {
    traces = Array.from({ length: scene.plots }, (_, plot) => {
      const trace = [initial(cat)];
      for (const [beat, card] of scene.beats.entries())
        trace.push(move(trace.at(-1), playCue(card, lighting(scene, beat, plot))));
      return trace;
    });
    if (!hasCat || traces.every((trace) => trace.every(({ actors: [a, b] }) => a.x !== b.x || a.y !== b.y))) break;
  }
  const stage = new Map();
  for (const trace of traces)
    for (const cast of trace) {
      for (const a of cast.actors.slice(0, hasCat ? 2 : 1)) stage.set([a.x, a.y].join(), [a.x, a.y]);
    }
  const cells = [...stage.values()];
  const xs = cells.map((p) => p[0]),
    ys = cells.map((p) => p[1]);
  const result = {
    traces,
    cells,
    hasCat,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  memo.set(scene, result);
  return result;
}
