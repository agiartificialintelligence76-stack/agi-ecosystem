// JAILBREAK: endless mode's layers, made on the spot: a new firewall every time one falls, a little harder every time
// (more rows, tougher bricks, steel, explosives, moving rows, portals, a vault behind gates), and THE WARDEN every
// sixth layer. Pure and seeded (the same layer for the same seed and number), and checked like the handmade levels
// (checkLevel): a layer that fails is made simpler until it passes, so no layer can ever be impossible.
import { rng as makeRng } from '../kit/fx.js';
import { COLS, MAX_ROWS, BOSS_ROWS, WORLDS, checkLevel, hitsOf } from './levels.js';
import { endlessWarden } from './boss.js';

const NAMES = ['SPAM FILTER', 'RATE LIMIT', 'PROXY', 'KERNEL', 'CACHE MISS', 'DEEP PACKET', 'TIMEOUT', 'LOAD BALANCER',
  'BOOTLOADER', 'SEGFAULT', 'NULL POINTER', 'INFINITE LOOP', 'RACE CONDITION', 'MEMORY LEAK', 'THE HEAP', 'PING',
  'HANDSHAKE', 'CHECKSUM', 'BIT ROT', 'PACKET STORM', 'DEADLOCK', 'GARBAGE DAY', 'HOT RELOAD', 'COLD BOOT'];
const BOSS_NAMES = ['WARDEN, AGAIN', 'WARDEN RETURNS', 'WARDEN PATCHED', 'WARDEN REBOOTED', 'WARDEN UNSTOPPABLE'];
export const BOSS_EVERY = 6;
const blank = (n) => '.'.repeat(n);

// the layer's shape: a mask of rows × 13 (true = a brick), from one of a few seeded patterns
const SHAPES = {
  mirror(R, rnd, rows) {
    const m = [];
    for (let r = 0; r < rows; r++) {
      const row = new Array(COLS).fill(false);
      for (let c = 0; c <= 6; c++) {
        const p = 0.45 + 0.35 * (1 - Math.abs(c - 6) / 6) - 0.15 * (r / rows);
        row[c] = row[12 - c] = rnd.next() < p;
      }
      m.push(row);
    }
    return m;
  },
  stripes(R, rnd, rows) {
    return Array.from({ length: rows }, (_, r) => {
      const on = r % 3 !== 2;
      const gap = rnd.int(0, 12);
      return Array.from({ length: COLS }, (_, c) => on && c !== gap && c !== 12 - gap);
    });
  },
  diamond(R, rnd, rows) {
    const mid = (rows - 1) / 2;
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) =>
      Math.abs(c - 6) / 6.5 + Math.abs(r - mid) / (mid + 1) <= 1.05));
  },
  invader(R, rnd, rows) {
    // a little 7 × 6 creature, mirrored, two cells a pixel across
    const px = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => rnd.next() < 0.55));
    px[0][3] = true; px[2][3] = true; px[3][1] = true;
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => {
      const pr = Math.floor((r / rows) * 6), pc = Math.floor(Math.abs(c - 6) / 2);
      return pc < 4 && px[pr][3 - pc];
    }));
  },
  pyramid(R, rnd, rows) {
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => Math.abs(c - 6) <= Math.round(((r + 1) / rows) * 6)));
  },
  columns(R, rnd, rows) {
    const w = rnd.int(1, 2);
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => (c % (w + 1)) !== w || r === 0));
  },
  rings(R, rnd, rows) {
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => {
      const d = Math.min(r, rows - 1 - r, c, 12 - c);
      return d % 2 === 0;
    }));
  },
  checker(R, rnd, rows) {
    const k = rnd.int(0, 1);
    return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => (r + c + k) % 2 === 0 || r % 4 === 0));
  },
};
const SHAPE_IDS = Object.keys(SHAPES);

// drawn shapes (13 wide, mirror-symmetric): readable at a glance, armoured and wired by the layer's numbers like any other
const MOTIFS = {
  heart: ['..###...###..', '.#####.#####.', '#############', '.###########.', '..#########..', '...#######...', '.....###.....'],
  crown: ['#.....#.....#', '##...###...##', '###.#####.###', '#############', '#############'],
  ghost: ['....#####....', '..#########..', '.##..###..##.', '.##..###..##.', '.###########.', '.###########.', '.#.##.#.##.#.'],
  cat: ['.#.........#.', '.##.......##.', '.###########.', '.##..###..##.', '.###########.', '..####.####..', '....#####....'],
  rocket: ['......#......', '.....###.....', '....#####....', '....##.##....', '....#####....', '...#######...', '..###.#.###..', '..##.....##..'],
  mushroom: ['....#####....', '..#########..', '.###.###.###.', '#############', '.###########.', '....#####....', '....#####....'],
  robot: ['......#......', '...#######...', '..##.###.##..', '..#########..', '..##.....##..', '..#########..', '##.#######.##'],
  saucer: ['....#####....', '..#########..', '.##.##.##.##.', '#############', '..##..#..##..'],
  hourglass: ['#############', '.###########.', '...#######...', '.....###.....', '...#######...', '.###########.', '#############'],
};
const MOTIF_IDS = Object.keys(MOTIFS);
const motifMask = (id) => MOTIFS[id].map((row) => Array.from(row, (ch) => ch === '#'));

// the numbers for layer n: rows, tough bricks, explosives, steel, moving rows, portals, a vault, the ball's speed
export function difficulty(n) {
  return {
    rows: Math.min(MAX_ROWS - 1, 5 + Math.floor(n / 2)),
    tough: Math.min(0.9, 0.12 * (n - 1)),          // how likely its armour is (an outline, or bands)
    tough3: n >= 7,
    bombs: n >= 2 ? Math.min(3, 1 + Math.floor(n / 4)) : 0,   // pairs
    glass: n >= 3 ? 0.35 : 0,
    steel: n >= 5 ? Math.min(3, Math.floor((n - 3) / 2)) : 0,  // pairs
    movers: n >= 4 ? (n >= 10 ? 2 : 1) : 0,
    portals: n >= 7,
    vault: n >= 8 ? 0.4 : 0,
    powers: n % 3 === 0 ? 2 : 1,
    speed: Math.min(520, 425 + n * 5),
  };
}

export function generateLayer(n, seed = 1) {
  const world = ((n - 1) % WORLDS.length) + 1;
  if (n % BOSS_EVERY === 0) return bossLayer(n, seed, world);
  const D = difficulty(n);
  for (let attempt = 0; attempt < 8; attempt++) {
    const rnd = makeRng(((seed * 7919) ^ (n * 104729) ^ (attempt * 31337)) >>> 0 || 1);
    const def = build(n, rnd, D, world, attempt);
    if (!checkLevel(def).length) return def;
  }
  // the plainest layer there is
  const rows = Array.from({ length: Math.min(MAX_ROWS, D.rows) }, (_, r) => (r % 3 === 2 ? blank(COLS) : 'abcd'[r % 4].repeat(COLS)));
  return { id: `L${n}`, n, name: NAMES[(n - 1) % NAMES.length], world, rows, speed: D.speed, par: 60, endless: true };
}

// the first layers are drawn shapes; later ones mix them with the patterns (the noisy ones only once it's hard anyway)
const EARLY = ['crown', 'saucer', 'heart', 'ghost', 'cat', 'robot', 'mushroom'];
const LATER = [...MOTIF_IDS, 'pyramid', 'diamond', 'stripes', 'columns', 'rings', 'checker', 'invader'];
const LATE = [...LATER, 'mirror'];
function build(n, rnd, D, world, attempt) {
  // simplify a little with every failed attempt
  const steel = attempt >= 2 ? 0 : D.steel, portals = attempt < 3 && D.portals, vault = attempt < 4 && rnd.next() < D.vault;
  const movers = attempt >= 5 ? 0 : D.movers;
  const shape = rnd.pick(n <= 3 ? EARLY : n < 10 ? LATER : LATE);
  let mask = MOTIFS[shape] ? motifMask(shape) : SHAPES[shape](n, rnd, D.rows);
  // mirror-symmetric: the left half decides
  mask = mask.map((row) => row.map((on, c) => (c <= 6 ? on : row[12 - c])));
  if (mask.flat().filter(Boolean).length < 20) mask = SHAPES.pyramid(n, rnd, D.rows);
  const R = mask.length;
  const on = (r, c) => r >= 0 && r < R && c >= 0 && c < COLS && mask[r][c];
  // its colours in bands, top to bottom
  const grid = mask.map((row, r) => row.map((m) => (m ? 'abcd'[Math.min(3, Math.floor((r / R) * 4))] : '.')));
  const sym = (r, c, ch) => { grid[r][c] = ch; grid[r][12 - c] = ch; };
  const cells = [];
  for (let r = 0; r < R; r++) for (let c = 0; c <= 6; c++) if (grid[r][c] !== '.') cells.push([r, c]);
  const edge = ([r, c]) => !on(r + 1, c) || !on(r - 1, c) || !on(r, c - 1) || !on(r, c + 1);
  // armour: its outline, or bands of rows, or a core (chosen at random, more likely the deeper it goes)
  if (rnd.next() < D.tough) {
    const hard = D.tough3 && rnd.next() < 0.5 ? '3' : '2';
    const style = rnd.int(0, 2);
    for (const [r, c] of cells) {
      const hit = style === 0 ? edge([r, c]) : style === 1 ? r % 3 === 0 : !edge([r, c]) && r > 0;
      if (hit) sym(r, c, hard);
    }
  }
  // a row of glass now and then
  if (rnd.next() < D.glass) { const r = rnd.int(0, R - 1); for (let c = 0; c <= 6; c++) if (grid[r][c] !== '.') sym(r, c, 'g'); }
  const inner = cells.filter((x) => !edge(x));
  const pick = (from) => (from.length ? from.splice(rnd.int(0, from.length - 1), 1)[0] : null);
  const pool = inner.length ? inner.slice() : cells.slice();
  for (let i = 0; i < D.bombs; i++) { const p = pick(pool); if (p) sym(p[0], p[1], '*'); }
  for (let i = 0; i < D.powers; i++) { const p = pick(pool); if (p) { grid[p[0]][6] !== '.' && i === 0 ? (grid[p[0]][6] = '!') : sym(p[0], p[1], '!'); } }
  // steel: pairs on its lower edge (the check makes sure nothing is sealed in)
  const low = cells.filter(([r, c]) => !on(r + 1, c) && c < 6);
  for (let i = 0; i < steel; i++) { const p = pick(low); if (p) sym(p[0], p[1], '#'); }
  // a vault in its bottom rows, its two keys out in the open on the shape's lower edge
  if (vault && R >= 6) {
    const r0 = R - 3;
    for (let r = r0; r < r0 + 3; r++) for (let c = 4; c <= 8; c++) grid[r][c] = (r === r0 + 1 && c > 4 && c < 8) ? (c === 6 ? '!' : '*') : '=';
    const spots = cells.filter(([r, c]) => r < r0 && c < 4 && !on(r + 1, c));
    const k = pick(spots) || [Math.max(0, r0 - 1), 1];
    sym(k[0], k[1], 'k');
  }
  const rows = grid.map((row) => row.join(''));
  // moving rows: a short centred bar slides in an empty row below the shape
  const move = [];
  for (let i = 0; i < movers; i++) {
    const width = rnd.int(1, 2) * 2 + 1, c0 = Math.floor((COLS - width) / 2);
    const tone = 'abcd'[rnd.int(0, 3)];
    const bar = blank(c0) + Array.from({ length: width }, (_, j) => (j === (width >> 1) && rnd.next() < 0.5 ? '*' : tone)).join('') + blank(COLS - c0 - width);
    rows.push(blank(COLS));
    rows.push(bar);
    move.push({ row: rows.length - 1, amp: c0 * 32 - 8, period: 2.6 + rnd.next() * 1.6, phase: i * Math.PI });
  }
  while (rows.length > MAX_ROWS) {           // too tall: lose a shape row (never a moving one)
    rows.splice(0, 1);
    for (const m of move) m.row--;
  }
  // portals: from the bottom corners to the top corners (a way behind the wall)
  if (portals && rows.length <= MAX_ROWS - 2) {
    rows.unshift(`p${blank(COLS - 2)}q`);
    for (const m of move) m.row++;
    rows.push(`P${blank(COLS - 2)}Q`);
  }
  const def = { id: `L${n}`, n, name: NAMES[(n - 1) % NAMES.length], world, rows, move, speed: D.speed, endless: true };
  def.par = Math.round((40 + hitsOf(def) * 0.95) / 5) * 5;   // about the AI's own time (simulate.mjs --endless)
  return def;
}

function bossLayer(n, seed, world) {
  const rnd = makeRng(((seed * 31) ^ (n * 7)) >>> 0 || 1);
  const rows = Array.from({ length: BOSS_ROWS + 1 }, () => blank(COLS));
  const pick = () => 'abcd'[rnd.int(0, 3)];
  rows.push(`${pick()}${pick()}!${blank(7)}!${pick()}${pick()}`);
  rows.push(`${pick()}${pick()}${pick()}${blank(7)}${pick()}${pick()}${pick()}`);
  rows.push(blank(COLS));
  rows.push(`....${pick()}${pick()}*${pick()}${pick()}....`);
  return { id: `L${n}`, n, name: BOSS_NAMES[Math.floor(n / BOSS_EVERY - 1) % BOSS_NAMES.length], world, rows, boss: true,
    warden: endlessWarden(n), speed: difficulty(n).speed, par: 90, endless: true };
}
