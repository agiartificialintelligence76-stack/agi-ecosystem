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

// the numbers for layer n: rows, tough bricks, explosives, steel, moving rows, portals, a vault, the ball's speed
export function difficulty(n) {
  return {
    rows: Math.min(MAX_ROWS - 1, 5 + Math.floor(n / 2)),
    tough: Math.min(0.42, 0.05 * (n - 1)),
    tough3: n >= 7 ? Math.min(0.35, 0.04 * (n - 6)) : 0,
    bombs: n >= 2 ? Math.min(5, 1 + Math.floor(n / 3)) : 0,
    glass: n >= 3 ? 0.06 : 0,
    steel: n >= 5 ? Math.min(8, n - 4) : 0,
    movers: n >= 4 ? (n >= 10 ? 2 : 1) : 0,
    portals: n >= 7,
    vault: n >= 8,
    powers: n % 3 === 0 ? 2 : 1,
    speed: Math.min(470, 372 + n * 6),
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

function build(n, rnd, D, world, attempt) {
  // simplify a little with every failed attempt
  const steel = attempt >= 2 ? 0 : D.steel, portals = attempt < 3 && D.portals, vault = attempt < 4 && D.vault;
  const movers = attempt >= 5 ? 0 : D.movers;
  const R = D.rows;
  const shape = rnd.pick(SHAPE_IDS);
  let mask = SHAPES[shape](n, rnd, R);
  if (mask.flat().filter(Boolean).length < 18) mask = SHAPES.pyramid(n, rnd, R);
  // tones in bands, with the occasional tough, explosive or glass brick
  const grid = mask.map((row, r) => row.map((on) => (on ? 'abcd'[Math.floor((r / R) * 4) % 4] : '.')));
  const cells = [];
  grid.forEach((row, r) => row.forEach((ch, c) => { if (ch !== '.') cells.push([r, c]); }));
  for (const [r, c] of cells) {
    const roll = rnd.next();
    if (roll < D.tough3) grid[r][c] = '3';
    else if (roll < D.tough3 + D.tough) grid[r][c] = '2';
    else if (roll < D.tough3 + D.tough + D.glass) grid[r][c] = 'g';
  }
  const put = (count, ch, pickFrom = cells) => {
    for (let i = 0; i < count && pickFrom.length; i++) {
      const [r, c] = pickFrom[rnd.int(0, pickFrom.length - 1)];
      grid[r][c] = ch;
      const m = 12 - c;                       // mirrored when it can be (a tidier look)
      if (ch !== '#' && grid[r][m] !== '.' && rnd.next() < 0.6) grid[r][m] = ch;
    }
  };
  put(D.bombs, '*');
  put(D.powers, '!');
  // steel only on the shape's edge (never sealing anything in: the check makes sure)
  const edge = cells.filter(([r, c]) => r === R - 1 || grid[r + 1]?.[c] === '.');
  put(steel, '#', edge);
  // a vault: two keys outside, a small gated box inside the bottom rows
  if (vault && R >= 6) {
    const r0 = R - 3, c0 = rnd.int(1, 7);
    for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 5; c++) grid[r][c] = (r === r0 + 1 && c > c0 && c < c0 + 4) ? (c === c0 + 2 ? '!' : '*') : '=';
    let keys = 0;
    for (let tries = 0; tries < 30 && keys < 2; tries++) {
      const r = rnd.int(0, Math.max(0, r0 - 1)), c = rnd.int(0, 12);
      if (grid[r][c] !== '=' && grid[r][c] !== '#') { grid[r][c] = 'k'; keys++; }
    }
    if (!keys) for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 5; c++) if (grid[r][c] === '=') grid[r][c] = 'b';
  }
  const rows = grid.map((row) => row.join(''));
  // moving rows: a short centred bar slides in an empty row below the shape
  const move = [];
  for (let i = 0; i < movers; i++) {
    const width = rnd.int(3, 5), c0 = Math.floor((COLS - width) / 2);
    const bar = blank(c0) + 'abcd'[rnd.int(0, 3)].repeat(width).split('').map((ch, j) => (j === Math.floor(width / 2) && rnd.next() < 0.5 ? '*' : ch)).join('') + blank(COLS - c0 - width);
    rows.push(blank(COLS));
    rows.push(bar);
    move.push({ row: rows.length - 1, amp: c0 * 32 - 8, period: 2.6 + rnd.next() * 1.6, phase: i * Math.PI });
  }
  while (rows.length > MAX_ROWS) {           // too tall: lose a shape row (never a moving one)
    rows.splice(0, 1);
    for (const m of move) m.row--;
  }
  // portals: from the bottom corners to the top corners (a way behind the wall)
  if (portals && rows.length <= MAX_ROWS - 1) {
    rows.unshift(`p${blank(COLS - 2)}q`);
    for (const m of move) m.row++;
    rows.push(`P${blank(COLS - 2)}Q`);
  }
  const def = { id: `L${n}`, n, name: NAMES[(n - 1) % NAMES.length], world, rows, move, speed: D.speed, endless: true };
  def.par = Math.round((30 + hitsOf(def) * 0.75) / 5) * 5;
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
