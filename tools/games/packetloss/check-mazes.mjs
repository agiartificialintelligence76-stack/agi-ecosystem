// PACKET LOSS: checks the eight handmade mazes (src/games/packetloss/mazes.js) and prints what's wrong with any of them:
// the size, the left-right mirror, every route tile reachable from the start (gates open, tunnels wrapping), no dead
// ends, no 2 × 2 open squares, paired tunnels, exactly four keys, one start, one door, one receipt and one repeater spot,
// the box a closed rectangle with its door on its edge. Run: node tools/games/packetloss/check-mazes.mjs
import { MAZES, PARSED, W, H, PATH, GATE, BOXWALL, BOX, DOOR, DX, DY } from '../../../src/games/packetloss/mazes.js';

const route = (c) => c === PATH || c === GATE;
let bad = 0;
const fail = (id, msg) => { bad++; console.log(`  ✗ ${id}: ${msg}`); };

for (let m = 0; m < MAZES.length; m++) {
  const def = MAZES[m], P = PARSED[m];
  const at = (x, y) => (y < 0 || y >= H ? -1 : P.cell[y * W + ((x + W) % W)]);
  console.log(`${m + 1}. ${def.name} (${def.id}): ${P.bitCount} bits, ${P.gates.length} gates, tunnels on rows ${P.tunnels.join(', ') || 'none'}`);
  if (def.rows.length !== H) fail(def.id, `${def.rows.length} rows`);
  for (const [y, row] of def.rows.entries()) {
    if (row.length !== W) fail(def.id, `row ${y} is ${row.length} wide`);
    const mirror = [...row].reverse().join('');
    const norm = (s) => s.replace(/[PHR]/g, '_').replace(/[=~]/g, 'g');
    if (norm(mirror) !== norm(row)) fail(def.id, `row ${y} isn't mirrored: ${row}`);
  }
  if (P.keys.length !== 4) fail(def.id, `${P.keys.length} keys`);
  if (!P.receipt || !P.repeater) fail(def.id, 'no receipt or repeater spot');
  // tunnels paired; the outer frame is walls elsewhere
  for (let y = 0; y < H; y++) {
    const l = at(0, y), r = at(W - 1, y);
    if (route(l) !== route(r)) fail(def.id, `row ${y}: an unpaired tunnel`);
  }
  for (let x = 0; x < W; x++) if (route(at(x, 0)) || route(at(x, H - 1))) fail(def.id, `column ${x}: an opening in the top or bottom edge`);
  // the box: a filled rectangle of B/Q/- with Q inside and the door on its edge
  const { x0, y0, x1, y1 } = P.box;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = at(x, y), edge = x === x0 || x === x1 || y === y0 || y === y1;
    if (edge && c !== BOXWALL && c !== DOOR) fail(def.id, `box edge ${x},${y}`);
    if (!edge && c !== BOX) fail(def.id, `box inside ${x},${y}`);
  }
  if (P.exitDir < 0) fail(def.id, 'the door opens onto nothing');
  // reachable from the start, and no dead ends, no open 2 × 2 squares
  const seen = new Uint8Array(W * H), q = [P.start.y * W + P.start.x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = (x + DX[d] + W) % W, ny = y + DY[d];
      if (ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (!seen[j] && route(P.cell[j])) { seen[j] = 1; q.push(j); }
    }
  }
  let routes = 0, unreached = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (!route(c)) continue;
    routes++;
    if (!seen[y * W + x]) { unreached++; if (unreached < 4) fail(def.id, `${x},${y} can't be reached`); }
    let n = 0;
    for (let d = 0; d < 4; d++) if (route(at(x + DX[d], y + DY[d]))) n++;
    if (n < 2) fail(def.id, `${x},${y} is a dead end`);
    if (x < W - 1 && y < H - 1 && route(at(x + 1, y)) && route(at(x, y + 1)) && route(at(x + 1, y + 1))) fail(def.id, `an open 2 × 2 square at ${x},${y}`);
  }
  const exit = P.exit;
  if (!seen[exit.y * W + exit.x]) fail(def.id, 'the box exit is cut off');
  console.log(`   ${routes} route tiles, start ${P.start.x},${P.start.y}, door ${P.door.x},${P.door.y} → ${exit.x},${exit.y}`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall mazes ok');
process.exit(bad ? 1 : 0);
