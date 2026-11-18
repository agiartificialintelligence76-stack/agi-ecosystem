import catalog from './depots.json' with { type: 'json' };
import { solve, replay } from './solver.js';
import { vectors, beltDir } from './rolling.js';
export const depots = catalog;
export const worlds = [
  { name: 'Packing bench', tone: '#f6bf71', dark: '#27665e', trim: '#c2ead1', emblem: 'Twine' },
  { name: 'Glassworks', tone: '#9cd8ed', dark: '#275275', trim: '#d0faff', emblem: 'Prism' },
  { name: 'Sorting belt', tone: '#f7ba79', dark: '#744159', trim: '#ffd1ad', emblem: 'Chevron' },
  { name: 'Stamp office', tone: '#f1a2b8', dark: '#65395d', trim: '#ffd0e4', emblem: 'Ribbon' },
  { name: 'Returns desk', tone: '#bec4ff', dark: '#374565', trim: '#f5dd8c', emblem: 'Airmail' },
];
export function ledger(data) {
  const old = data?.dispatch;
  if (!old || old.v !== 1) return { v: 1, jobs: {}, daily: {} };
  return { v: 1, jobs: { ...old.jobs }, daily: { ...old.daily } };
}
export function open(book, d) {
  if (!d.world) return true;
  const prev = depots.filter((x) => x.world === d.world - 1);
  return prev.filter((x) => book.jobs[x.id]?.stars > 0).length >= 5 && open(book, prev[0]);
}
export const emblems = (book) =>
  worlds
    .filter((_, w) => depots.filter((d) => d.world === w).every((d) => book.jobs[d.id]?.stars > 0))
    .map((w) => w.emblem);
export function record(store, d, rolls, stars, mode, seed) {
  store?.update?.((save) => {
    const book = ledger(save),
      entries = mode === 'daily' ? book.daily : book.jobs,
      key = mode === 'daily' ? seed : d.id;
    if (!entries[key] || entries[key].rolls > rolls) entries[key] = { id: d.id, rolls, stars };
    if (mode === 'daily') for (const stamp of Object.keys(entries).sort().slice(0, -35)) delete entries[stamp];
    return { ...save, dispatch: book };
  });
}
function shift(d, variant) {
  const w = d.rows[0].length,
    h = d.rows.length,
    turn = variant % 4,
    flip = variant >= 4;
  function locate([x, y]) {
    if (flip) x = w - 1 - x;
    if (turn === 0) return [x, y];
    if (turn === 1) return [h - 1 - y, x];
    if (turn === 2) return [w - 1 - x, h - 1 - y];
    return [y, w - 1 - x];
  }
  const rows = Array.from({ length: turn % 2 ? w : h }, () => Array(turn % 2 ? h : w));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [nx, ny] = locate([x, y]);
      let tile = d.rows[y][x],
        dir = beltDir[tile];
      if (dir) {
        const [dx, dy] = vectors[dir],
          [ax, ay] = locate([x + dx, y + dy]);
        tile = ax > nx ? '>' : ax < nx ? '<' : ay > ny ? 'v' : '^';
      }
      rows[ny][nx] = tile;
    }
  const [x, y] = locate([d.start.x, d.start.y]);
  return {
    ...d,
    start: { x, y, o: 'up' },
    goal: locate(d.goal.split(',').map(Number)).join(),
    rows: rows.map((a) => a.join('')),
    stamps: d.stamps.map((r) => r.map(locate)),
    chutes: d.chutes.map((r) => r.map(locate)),
    seams: d.seams.map((r) => r.map(locate)),
  };
}
export function daily(seed) {
  let n = seed >>> 0;
  const next = () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n;
  };
  // Rotating an asymmetric two-cell chute changes which lip catches a crate.
  // Solve the actual transformed floor before accepting a public daily.
  for (let k = 0; k < 12; k++) {
    const base = depots[4 + (next() % (depots.length - 4))],
      d = shift(base, (next() >>> 16) % 8);
    const pallets = [];
    for (let y = 0; y < d.rows.length; y++)
      for (let x = 0; x < d.rows[y].length; x++) {
        if (d.rows[y][x] === '#' && [x, y].join() !== d.goal && [x, y].join() !== [d.start.x, d.start.y].join())
          pallets.push([x, y]);
      }
    if (pallets.length && k < 7) {
      const [px, py] = pallets[(next() >>> 8) % pallets.length],
        row = [...d.rows[py]];
      row[px] = '.';
      d.rows[py] = row.join('');
    }
    try {
      const cert = solve(d);
      if (cert && cert.par >= 6 && cert.par <= 30 && replay(d, cert.steps).clear)
        return {
          ...d,
          lesson: 'Daily dispatch · ' + base.lesson,
          certificate: { par: cert.par, route: cert.steps.join(''), frontiers: cert.frontiers.slice(0, -1) },
        };
    } catch {
      /* An exhausted search is never an acceptance certificate. */
    }
  }
  return depots[12];
}
