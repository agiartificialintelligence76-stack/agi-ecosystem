// PACKET LOSS: the eight mazes, drawn by hand as ASCII, and the parser that turns one into the grid the rules use.
// Pure (no DOM): tests/packetloss.test.js reads them in Node.
//
//   #  a wall (a cable conduit)          .  a route tile with a bit        _  a route tile, empty
//   o  an encryption key (4 a maze)      P  where the letter starts        H  the read receipt's spot
//   R  the repeater's spot               B  the quarantine box's wall       Q  inside the box
//   -  the box's door (gremlins only)    =  a firewall gate (group A)       ~  a firewall gate (group B)
//
// A row whose two edge tiles are route tiles is a tunnel: leave on one side, come back on the other.
// Every maze is 19 × 23, left-right mirrored, with no dead ends and the box in the middle.

export const W = 19;
export const H = 23;

export const WALL = 0, PATH = 1, BOXWALL = 2, BOX = 3, DOOR = 4, GATE = 5;

// up, right, down, left
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const OPP = [2, 3, 0, 1];

export const MAZES = [
  {
    id: 'home', name: 'Home Wi-Fi', tint: '#8b66ff',
    // the router in the middle, its signal in rings around it
    rows: [
      '###################',
      '#o...............o#',
      '#.#####.###.#####.#',
      '#.................#',
      '#.###.#######.###.#',
      '#.#.............#.#',
      '#.#.#####.#####.#.#',
      '#.#.#....H....#.#.#',
      '#.#.#.BBBBBBB.#.#.#',
      '_.....BQQQQQB....._',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#.#.BBB-BBB.#.#.#',
      '#.#.#...._....#.#.#',
      '#.#.###.###.###.#.#',
      '#.#.............#.#',
      '#.#######.#######.#',
      '#........R........#',
      '#.###.#######.###.#',
      '#o.......P.......o#',
      '#.#####.###.#####.#',
      '#.................#',
      '###################',
    ],
  },
  {
    id: 'cafe', name: 'Café hotspot', tint: '#ffc933',
    // little tables on an open floor
    rows: [
      '###################',
      '#o...............o#',
      '#.###.###.###.###.#',
      '#.................#',
      '#.#.###.###.###.#.#',
      '#.................#',
      '#.###.#.###.#.###.#',
      '_........H........_',
      '#.#.#.BBBBBBB.#.#.#',
      '#...#.BQQQQQB.#...#',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#...BQQQQQB...#.#',
      '#.#.#.BBB-BBB.#.#.#',
      '#........_........#',
      '#.#.###.#.#.###.#.#',
      '#........P........#',
      '#.###.###.###.###.#',
      '_........R........_',
      '#.#.###.###.###.#.#',
      '#.................#',
      '#.###.###.###.###.#',
      '#o...............o#',
      '###################',
    ],
  },
  {
    id: 'office', name: 'Office LAN', tint: '#59c8ff',
    // cubicles and long straight halls
    rows: [
      '###################',
      '#o.......R.......o#',
      '#.#####.#.#.#####.#',
      '#.#####.....#####.#',
      '#.#####.#.#.#####.#',
      '#.................#',
      '#.###.#######.###.#',
      '_...#....H....#..._',
      '#.#.#.BBBBBBB.#.#.#',
      '#...#.BQQQQQB.#...#',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#...BQQQQQB...#.#',
      '#.#.#.BBB-BBB.#.#.#',
      '#.#......_......#.#',
      '#.#.#####.#####.#.#',
      '#.#.#####.#####.#.#',
      '#.#.#####.#####.#.#',
      '#........P........#',
      '#.#####.#.#.#####.#',
      '#o#####.....#####o#',
      '#.#####.#.#.#####.#',
      '#.................#',
      '###################',
    ],
  },
  {
    id: 'datacenter', name: 'Data center', tint: '#ff8a3d',
    // aisles between the server racks; the middle aisle has two firewall gates
    rows: [
      '###################',
      '#o.......R.......o#',
      '#.###.###.###.###.#',
      '#.###.###.###.###.#',
      '#.###.###=###.###.#',
      '#.###.###.###.###.#',
      '#.###.###.###.###.#',
      '#........H........#',
      '#.###.BBBBBBB.###.#',
      '_...#.BQQQQQB.#..._',
      '#.#.#.BQQQQQB.#.#.#',
      '#...#.BQQQQQB.#...#',
      '#.###.BBB-BBB.###.#',
      '#........_........#',
      '#.###.###.###.###.#',
      '#.###.###.###.###.#',
      '#.###.###.###.###.#',
      '#........P........#',
      '#.###.###.###.###.#',
      '#.###.###~###.###.#',
      '#.###.###.###.###.#',
      '#o...............o#',
      '###################',
    ],
  },
  {
    id: 'undersea', name: 'Undersea cable', tint: '#3d7bff',
    // long cables across the ocean floor, three of them wrapping round
    rows: [
      '###################',
      '#o...............o#',
      '#.#####.###.#####.#',
      '_................._',
      '###.#####.#####.###',
      '#.................#',
      '#.#####.###.#####.#',
      '#........H........#',
      '#.###.BBBBBBB.###.#',
      '#...=.BQQQQQB.=...#',
      '#.#.#.BQQQQQB.#.#.#',
      '#...~.BQQQQQB.~...#',
      '#.###.BBB-BBB.###.#',
      '_........_........_',
      '#.#####.###.#####.#',
      '#.................#',
      '###.#####.#####.###',
      '#........P........#',
      '#.#####.###.#####.#',
      '_........R........_',
      '#.#.#####.#####.#.#',
      '#o...............o#',
      '###################',
    ],
  },
  {
    id: 'satellite', name: 'Satellite uplink', tint: '#ff4da6',
    // beams stepping in from the corners to the dish in the middle
    rows: [
      '###################',
      '#o.......R.......o#',
      '#.#.###.###.###.#.#',
      '#.#...#.....#...#.#',
      '#.###.###=###.###.#',
      '#...#...#.#...#...#',
      '#.#.###.#.#.###.#.#',
      '_...#....H....#..._',
      '#.#.#.BBBBBBB.#.#.#',
      '#.#.#.BQQQQQB.#.#.#',
      '#...#.BQQQQQB.#...#',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#.#.BBB-BBB.#.#.#',
      '_...#...._....#..._',
      '#.#.###.#.#.###.#.#',
      '#...#...#.#...#...#',
      '#.###.###~###.###.#',
      '#.#...#..P..#...#.#',
      '#.#.###.###.###.#.#',
      '#.................#',
      '#.#####.###.#####.#',
      '#o...............o#',
      '###################',
    ],
  },
  {
    id: 'moonbase', name: 'Moon base', tint: '#c9c6ff',
    // six domes; the outer ones open onto the tunnels, their lower airlocks on a cycle
    rows: [
      '###################',
      '#o....#.....#....o#',
      '#.###.#.###.#.###.#',
      '_.###...###...###._',
      '#.###.#.###.#.###.#',
      '#.....#.....#.....#',
      '###=#####.#####=###',
      '#........H........#',
      '#.###.BBBBBBB.###.#',
      '#.....BQQQQQB.....#',
      '###.#.BQQQQQB.#.###',
      '#.....BQQQQQB.....#',
      '#.###.BBB-BBB.###.#',
      '#........_........#',
      '#.###.###.###.###.#',
      '#........R........#',
      '###~#####.#####~###',
      '#.....#..P..#.....#',
      '#.###.#.###.#.###.#',
      '_.###...###...###._',
      '#.###.#.###.#.###.#',
      '#o....#.....#....o#',
      '###################',
    ],
  },
  {
    id: 'backbone', name: 'The backbone', tint: '#e05bff',
    // one long spine and its ribs, every rib behind a firewall
    rows: [
      '###################',
      '#o.......R.......o#',
      '#.###.###.###.###.#',
      '#.......=.=.......#',
      '#.#.#####.#####.#.#',
      '_...#...~.~...#..._',
      '#.###.###.###.###.#',
      '#........H........#',
      '#.###.BBBBBBB.###.#',
      '#...#.BQQQQQB.#...#',
      '#.#.#.BQQQQQB.#.#.#',
      '#.#...BQQQQQB...#.#',
      '#.#.#.BBB-BBB.#.#.#',
      '#........_........#',
      '#.###.###.###.###.#',
      '#.......=.=.......#',
      '#.#.#####.#####.#.#',
      '_...#...~P~...#..._',
      '#.###.###.###.###.#',
      '#.................#',
      '#.###.###.###.###.#',
      '#o...............o#',
      '###################',
    ],
  },
];

// one maze's grid: what each tile is, where the bits, keys, gates and spots are, and the box
export function parseMaze(def) {
  const rows = def.rows;
  const h = rows.length, w = rows[0].length;
  const cell = new Uint8Array(w * h), bits = new Uint8Array(w * h);
  const keys = [], gates = [];
  let start = null, receipt = null, repeater = null, door = null;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) throw new Error(`${def.id}: row ${y} is ${row.length} wide, not ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x], i = y * w + x;
      let c = WALL;
      switch (ch) {
        case '#': c = WALL; break;
        case '.': c = PATH; bits[i] = 1; break;
        case '_': c = PATH; break;
        case 'o': c = PATH; keys.push({ x, y }); break;
        case 'P': c = PATH; start = { x, y }; break;
        case 'H': c = PATH; receipt = { x, y }; break;
        case 'R': c = PATH; repeater = { x, y }; break;
        case 'B': c = BOXWALL; break;
        case 'Q': c = BOX; break;
        case '-': c = DOOR; door = { x, y }; break;
        case '=': c = GATE; gates.push({ x, y, group: 0 }); break;
        case '~': c = GATE; gates.push({ x, y, group: 1 }); break;
        default: throw new Error(`${def.id}: unknown tile "${ch}" at ${x},${y}`);
      }
      cell[i] = c;
      if (c === BOXWALL || c === BOX || c === DOOR) {
        if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (x > bx1) bx1 = x; if (y > by1) by1 = y;
      }
    }
  }
  if (!start || !door) throw new Error(`${def.id}: no start or no door`);
  // the door's outside: the route tile next to it (gremlins leave and come back that way)
  let exitDir = -1;
  for (let d = 0; d < 4; d++) {
    const nx = door.x + DX[d], ny = door.y + DY[d];
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && cell[ny * w + nx] === PATH) exitDir = d;
  }
  const exit = { x: door.x + DX[exitDir], y: door.y + DY[exitDir] };
  const inside = { x: door.x - DX[exitDir], y: door.y - DY[exitDir] };
  const tunnels = [];
  for (let y = 0; y < h; y++) if (cell[y * w] === PATH && cell[y * w + w - 1] === PATH) tunnels.push(y);
  // the box's inside, and three resting spots in it (left, middle, right of its middle row)
  const box = { x0: bx0, y0: by0, x1: bx1, y1: by1, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2 };
  const slots = [{ x: box.cx - 1.6, y: box.cy }, { x: box.cx, y: box.cy }, { x: box.cx + 1.6, y: box.cy }];
  let bitCount = 0;
  for (let i = 0; i < bits.length; i++) bitCount += bits[i];
  return {
    id: def.id, name: def.name, tint: def.tint, w, h, cell, bits, bitCount,
    keys, gates, start, receipt, repeater, door, exit, exitDir, inside, box, slots, tunnels,
  };
}

export const PARSED = MAZES.map(parseMaze);

// a route tile anyone may stand on (a gate counts, open or not: the rules check it)
export const isRoute = (c) => c === PATH || c === GATE;
