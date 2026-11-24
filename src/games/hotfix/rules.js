// HOTFIX: the rules, pure and seeded (no DOM: tests/hotfix.test.js runs them in Node).
//
// Bugs are crawling through AGI-1's code. Her board is 6 × 5 chips of five kinds: Logic, Memory, Vision and Voice hit
// the bugs; Debug patches her uptime. A turn: pick up one chip and drag it round the board for a few seconds; it swaps
// with every chip it passes over (diagonals too). Let go, and every line of three or more of a kind clears: each cleared
// group is a combo, chips fall, new ones drop in, and new lines clear again (cascades). Every group hits the bug you're
// targeting with its kind (double on a bug weak to it, half on one that resists it), more for bigger groups and many
// combos. Then the bugs' countdowns tick, and those at zero bite her uptime (and some do worse: corrupt chips into junk,
// lock them, slow her down). Clear a floor, pick one of three patches, go deeper; every fifth floor is a boss.
// A turn is resolved all at once into a timeline (`turn`), so the page can play it back step by step.
import { rng } from '../kit/fx.js';

export const W = 6, H = 5, CELLS = W * H;
export const KINDS = Object.freeze([
  { id: 'logic', name: 'Logic', color: '#ffc933' },
  { id: 'memory', name: 'Memory', color: '#9b7bff' },
  { id: 'vision', name: 'Vision', color: '#59c8ff' },
  { id: 'voice', name: 'Voice', color: '#ff4da6' },
  { id: 'debug', name: 'Debug', color: '#3ff0c3' },
  { id: 'junk', name: 'Junk', color: '#8f88a6' },
]);
export const DEBUG = 4, JUNK = 5;
export const TUNE = Object.freeze({ uptime: 100, drag: 4, base: 20, heal: 9, hpGrow: 1.14, atkGrow: 1.08, comboStep: 0.25, sizeStep: 0.25 });
const K = (id) => KINDS.findIndex((k) => k.id === id);

export const BUGS = Object.freeze([
  { id: 'offbyone', name: 'Off-by-One', hp: 60, atk: 8, cd: 2, weak: 'logic', resist: 'voice', color: '#ffb3d6', glyph: '±1', what: 'Always one step behind.' },
  { id: 'nullptr', name: 'Null Pointer', hp: 80, atk: 10, cd: 3, weak: 'memory', resist: 'logic', color: '#cdb8ff', glyph: 'null', what: 'Points at nothing. Hits hard anyway.' },
  { id: 'race', name: 'Race Condition', hp: 55, atk: 5, cd: 1, weak: 'vision', resist: 'memory', color: '#ff9f43', glyph: '⇄', what: 'Attacks every single turn.' },
  { id: 'leak', name: 'Memory Leak', hp: 110, atk: 9, cd: 3, weak: 'logic', resist: 'memory', color: '#59c8ff', glyph: 'MB', what: 'Heals itself a little every turn.', ability: 'heal' },
  { id: 'spaghetti', name: 'Spaghetti Code', hp: 95, atk: 7, cd: 3, weak: 'voice', resist: 'vision', color: '#ffc933', glyph: '{{', what: 'Tangles three chips into junk.', ability: 'corrupt' },
  { id: 'conflict', name: 'Merge Conflict', hp: 90, atk: 8, cd: 3, weak: 'vision', resist: 'logic', color: '#ff5a5f', glyph: '<<<', what: 'Locks three chips in place.', ability: 'lock' },
  { id: 'loop', name: 'Infinite Loop', hp: 100, atk: 10, cd: 4, weak: 'memory', resist: 'voice', color: '#3ff0c3', glyph: '∞', what: 'Raises a shield that soaks up damage.', ability: 'shield' },
  { id: 'heisen', name: 'Heisenbug', hp: 70, atk: 12, cd: 3, weak: 'voice', resist: 'memory', color: '#b6f36b', glyph: '?', what: 'Halves the first hit it takes each turn.', ability: 'dodge' },
  { id: 'overflow', name: 'Stack Overflow', hp: 85, atk: 6, cd: 2, weak: 'logic', resist: 'vision', color: '#ff7ab8', glyph: '≡', what: 'Hits harder every time it attacks.', ability: 'grow' },
  { id: 'deadlock', name: 'Deadlock', hp: 120, atk: 14, cd: 4, weak: 'vision', resist: 'voice', color: '#8fb0ff', glyph: '⊘', what: 'Takes a second off her next drag.', ability: 'slow' },
  { id: 'flaky', name: 'Flaky Test', hp: 65, atk: 11, cd: 2, weak: 'memory', resist: 'vision', color: '#e9c7a0', glyph: '~', what: 'Its countdown is never the same twice.', ability: 'flaky' },
  { id: 'segfault', name: 'Segfault', hp: 130, atk: 22, cd: 5, weak: 'voice', resist: 'logic', color: '#9b7bff', glyph: 'SIG', what: 'Slow, then devastating.' },
]);
export const BOSSES = Object.freeze([
  { id: 'monolith', name: 'Legacy Monolith', hp: 520, atk: 16, cd: 3, weak: 'vision', resist: 'logic', color: '#c48a5a', glyph: 'v0.1', what: 'Twenty years of code. Corrupts chips.', ability: 'corrupt', boss: true },
  { id: 'prodfire', name: 'Prod Fire', hp: 600, atk: 11, cd: 2, weak: 'memory', resist: 'voice', color: '#ff6b5e', glyph: '500', what: 'Burns hotter every turn.', ability: 'grow', boss: true },
  { id: 'refactor', name: 'The Big Refactor', hp: 680, atk: 22, cd: 4, weak: 'voice', resist: 'memory', color: '#7fd6ff', glyph: 'TODO', what: 'Locks your chips while it rewrites everything.', ability: 'lock', boss: true },
]);
export const ALL_BUGS = Object.freeze([...BUGS, ...BOSSES]);

export const PATCHES = Object.freeze([
  { id: 'overclock', name: 'Overclock', what: '+1 second to drag', max: 3 },
  { id: 'logic', name: 'Logic boost', what: 'Logic hits 40% harder', max: 4 },
  { id: 'memory', name: 'Memory boost', what: 'Memory hits 40% harder', max: 4 },
  { id: 'vision', name: 'Vision boost', what: 'Vision hits 40% harder', max: 4 },
  { id: 'voice', name: 'Voice boost', what: 'Voice hits 40% harder', max: 4 },
  { id: 'combo', name: 'Combo engine', what: 'Each combo adds +10% more', max: 3 },
  { id: 'big', name: 'Big matches', what: 'Groups of 5+ hit ×1.5', max: 2 },
  { id: 'heal', name: 'Hot patch', what: 'Heal 35 now, +20 max uptime', max: 5 },
  { id: 'debug', name: 'Better debugging', what: 'Debug heals 60% more', max: 3 },
  { id: 'duck', name: 'Rubber duck', what: 'Blocks the first bite each floor', max: 1 },
  { id: 'linter', name: 'Linter', what: 'Bugs start each floor 1 turn slower', max: 2 },
  { id: 'gc', name: 'Garbage collector', what: 'Junk cleared deals 15 damage each', max: 3 },
]);

// ---------- the board ----------
const at = (x, y) => y * W + x;
export const xy = (i) => ({ x: i % W, y: (i / W) | 0 });
function newChip(run, avoid) {
  const r = run.rnd;
  let t;
  for (let tries = 0; tries < 8; tries++) {
    t = r.weighted([{ t: 0, w: 1 }, { t: 1, w: 1 }, { t: 2, w: 1 }, { t: 3, w: 1 }, { t: 4, w: 0.85 }], (o) => o.w).t;
    if (!avoid || !avoid(t)) break;
  }
  return { id: run.nextId++, t, lock: 0 };
}
// a fresh board with no lines already made
export function fillBoard(run) {
  const c = new Array(CELLS);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    c[at(x, y)] = newChip(run, (t) => (x >= 2 && c[at(x - 1, y)].t === t && c[at(x - 2, y)].t === t) || (y >= 2 && c[at(x, y - 1)].t === t && c[at(x, y - 2)].t === t));
  }
  return c;
}
export const adjacent = (a, b) => { const p = xy(a), q = xy(b); return a !== b && Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1; };

// the drag: the held chip swaps into each cell of the path in turn (locked chips can't be moved through)
export function applyPath(cells, path) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (!adjacent(a, b) || cells[b].lock) break;
    [cells[a], cells[b]] = [cells[b], cells[a]];
  }
  return cells;
}

// lines of three or more, joined into groups (each group one combo)
export function findGroups(cells) {
  const mark = new Uint8Array(CELLS);
  const ok = (i) => cells[i] && cells[i].t !== JUNK;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 2; x++) {
    const i = at(x, y);
    if (!ok(i)) continue;
    const t = cells[i].t;
    let n = 1;
    while (x + n < W && ok(at(x + n, y)) && cells[at(x + n, y)].t === t) n++;
    if (n >= 3) for (let k = 0; k < n; k++) mark[at(x + k, y)] = 1;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H - 2; y++) {
    const i = at(x, y);
    if (!ok(i)) continue;
    const t = cells[i].t;
    let n = 1;
    while (y + n < H && ok(at(x, y + n)) && cells[at(x, y + n)].t === t) n++;
    if (n >= 3) for (let k = 0; k < n; k++) mark[at(x, y + k)] = 1;
  }
  const seen = new Uint8Array(CELLS), groups = [];
  for (let i = 0; i < CELLS; i++) {
    if (!mark[i] || seen[i]) continue;
    const t = cells[i].t, g = [], q = [i];
    seen[i] = 1;
    while (q.length) {
      const j = q.pop(); g.push(j);
      const p = xy(j);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = at(nx, ny);
        if (mark[k] && !seen[k] && cells[k].t === t) { seen[k] = 1; q.push(k); }
      }
    }
    groups.push({ t, cells: g.sort((a, b) => a - b) });
  }
  return groups;
}

// ---------- a run ----------
function makeBug(def, floor, r) {
  const hp = Math.round(def.hp * TUNE.hpGrow ** (floor - 1));
  return { id: def.id, name: def.name, def, hp, max: hp, atk: Math.round(def.atk * TUNE.atkGrow ** (floor - 1)), cd: def.cd + (def.ability === 'flaky' ? r.int(0, 1) : 0), cd0: def.cd, shield: 0, dodged: false, uid: 0 };
}
export function floorBugs(floor, r) {
  if (floor % 5 === 0) return [makeBug(BOSSES[(floor / 5 - 1) % BOSSES.length], floor, r)];
  const n = floor <= 1 ? 1 : floor <= 3 ? r.int(1, 2) : r.int(2, 3);
  const pool = BUGS.filter((b, i) => i < Math.min(BUGS.length, 3 + floor));
  return Array.from({ length: n }, () => makeBug(r.pick(pool), floor, r));
}

export function createRun({ mode = 'run', seed = 1 } = {}) {
  const run = {
    mode, seed, rnd: rng(seed * 747796405 + 1), nextId: 1, floor: 1, uptime: TUNE.uptime, max: TUNE.uptime,
    patches: {}, bugs: [], target: 0, score: 0, damage: 0, turns: 0, bestCombo: 0, over: false, cause: null,
    offer: null, slow: 0, duck: false, seen: new Set(), lab: mode === 'lab' ? 10 : 0, moves: 0,
  };
  run.cells = fillBoard(run);
  if (mode !== 'lab') enterFloor(run);
  return run;
}
function enterFloor(run) {
  run.bugs = floorBugs(run.floor, run.rnd);
  run.bugs.forEach((b, i) => { b.uid = run.floor * 10 + i; b.cd += run.patches.linter || 0; run.seen.add(b.id); });
  run.target = 0;
  run.duck = Boolean(run.patches.duck);
}
export const alive = (run) => run.bugs.filter((b) => b.hp > 0);
export const dragTime = (run) => Math.max(1.5, TUNE.drag + (run.patches.overclock || 0) - (run.slow ? 1 : 0));

// how hard one group hits
export function groupPower(run, g, combos) {
  const n = g.n ?? g.cells.length;
  let v = TUNE.base * (1 + TUNE.sizeStep * (n - 3));
  if (n >= 5) v *= 1 + 0.5 * (run.patches.big || 0);
  const kindBoost = 1 + 0.4 * (run.patches[KINDS[g.t].id] || 0);
  const comboMul = 1 + (TUNE.comboStep + 0.1 * (run.patches.combo || 0)) * (combos - 1);
  return v * kindBoost * comboMul;
}

// one turn, resolved in full → a timeline for the page to play: drag, match, fall (repeated), hits, bites, end
export function turn(run, path) {
  if (run.over || run.offer) return [];
  const T = [];
  run.turns++;
  applyPath(run.cells, path);
  T.push({ kind: 'drag', path: [...path], cells: snap(run.cells) });
  // the board clears and cascades
  const combos = [];
  let junk = 0;
  for (let wave = 0; wave < 30; wave++) {
    const groups = findGroups(run.cells);
    if (!groups.length) break;
    const cleared = new Set();
    for (const g of groups) for (const i of g.cells) cleared.add(i);
    const junkHit = [];
    for (const i of cleared) {
      const p = xy(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = at(nx, ny);
        if (run.cells[k]?.t === JUNK && !cleared.has(k) && !junkHit.includes(k)) junkHit.push(k);
      }
    }
    junk += junkHit.length;
    for (const g of groups) combos.push({ t: g.t, n: g.cells.length, wave });
    for (const i of [...cleared, ...junkHit]) run.cells[i] = null;
    T.push({ kind: 'match', groups: groups.map((g) => ({ t: g.t, cells: g.cells })), junk: junkHit, combo: combos.length, cells: snap(run.cells) });
    // gravity, and new chips from the top
    const moves = [], spawns = [];
    for (let x = 0; x < W; x++) {
      let write = H - 1;
      for (let y = H - 1; y >= 0; y--) {
        const c = run.cells[at(x, y)];
        if (!c) continue;
        if (y !== write) { run.cells[at(x, write)] = c; run.cells[at(x, y)] = null; moves.push({ id: c.id, from: at(x, y), to: at(x, write) }); }
        write--;
      }
      for (let y = write, k = 1; y >= 0; y--, k++) { const c = newChip(run); run.cells[at(x, y)] = c; spawns.push({ id: c.id, to: at(x, y), drop: k }); }
    }
    T.push({ kind: 'fall', moves, spawns, cells: snap(run.cells) });
  }
  run.bestCombo = Math.max(run.bestCombo, combos.length);
  // the hits: each group at the target (overflow to the next bug), Debug heals
  const hits = [];
  let heal = 0;
  const n = combos.length;
  for (const c of combos) {
    const power = groupPower(run, c, n);
    if (c.t === DEBUG) { heal += TUNE.heal * (1 + TUNE.sizeStep * (c.n - 3)) * (1 + 0.6 * (run.patches.debug || 0)) * (1 + 0.15 * (n - 1)); continue; }
    if (run.mode === 'lab') { run.damage += power; hits.push({ t: c.t, amount: Math.round(power), uid: null }); continue; }
    let left = power;
    for (let guard = 0; guard < 4 && left > 0.5; guard++) {
      const live = alive(run);
      if (!live.length) break;
      const b = live.includes(run.bugs[run.target]) ? run.bugs[run.target] : live[0];
      const kind = KINDS[c.t].id;
      let dmg = left * (b.def.weak === kind ? 2 : b.def.resist === kind ? 0.5 : 1);
      if (b.def.ability === 'dodge' && !b.dodged) { dmg *= 0.5; b.dodged = true; }
      if (b.shield > 0) { const s = Math.min(b.shield, dmg); b.shield -= s; dmg -= s; }
      const done = Math.min(b.hp, dmg);
      b.hp -= done;
      run.damage += done;
      hits.push({ t: c.t, amount: Math.round(done), uid: b.uid, weak: b.def.weak === kind, resist: b.def.resist === kind, killed: b.hp <= 0 });
      // what's left over carries on to the next bug (scaled back to its own kind's terms)
      left = b.hp <= 0 && dmg > 0 ? left * ((dmg - done) / dmg) : 0;
      if (b.hp <= 0) { b.hp = 0; run.score += Math.round(b.max * 0.5); }
    }
  }
  if (junk && run.patches.gc) {
    const b = alive(run)[0];
    if (b) { const d = Math.min(b.hp, 15 * junk * run.patches.gc); b.hp -= d; run.damage += d; hits.push({ t: JUNK, amount: Math.round(d), uid: b.uid, killed: b.hp <= 0 }); }
  }
  heal = Math.round(heal);
  if (heal) run.uptime = Math.min(run.max, run.uptime + heal);
  run.score += Math.round(hits.reduce((s, h) => s + h.amount, 0)) + n * n * 5;
  T.push({ kind: 'hits', hits, heal, combos: n, junk });
  run.slow = 0;
  for (const b of run.bugs) b.dodged = false;
  for (const c of run.cells) if (c.lock) c.lock--;
  if (run.mode === 'lab') {
    run.lab--; run.moves++;
    if (run.lab <= 0) { run.over = true; run.cause = 'lab'; T.push({ kind: 'over', cause: 'lab' }); }
    return T;
  }
  // a floor cleared: three patches to pick from
  if (!alive(run).length) {
    run.score += run.floor * 100;
    run.offer = offerPatches(run);
    T.push({ kind: 'clear', floor: run.floor, offer: run.offer });
    return T;
  }
  // the bugs' turn
  const bites = [];
  for (const b of alive(run)) {
    b.cd--;
    if (b.def.ability === 'heal') { const h = Math.round(b.max * 0.06); b.hp = Math.min(b.max, b.hp + h); bites.push({ uid: b.uid, kind: 'heal', amount: h }); }
    if (b.cd > 0) continue;
    b.cd = b.def.ability === 'flaky' ? run.rnd.int(1, 3) : b.cd0;
    let dmg = b.atk;
    if (run.duck) { run.duck = false; dmg = 0; bites.push({ uid: b.uid, kind: 'duck' }); }
    run.uptime = Math.max(0, run.uptime - dmg);
    if (dmg) bites.push({ uid: b.uid, kind: 'bite', amount: dmg });
    switch (b.def.ability) {
      case 'corrupt': {
        const pick = run.rnd.shuffle([...Array(CELLS).keys()].filter((i) => run.cells[i].t !== JUNK)).slice(0, 3);
        for (const i of pick) run.cells[i] = { ...run.cells[i], t: JUNK };
        bites.push({ uid: b.uid, kind: 'corrupt', cells: pick });
        break;
      }
      case 'lock': {
        const pick = run.rnd.shuffle([...Array(CELLS).keys()]).slice(0, 3);
        for (const i of pick) run.cells[i].lock = 2;
        bites.push({ uid: b.uid, kind: 'lock', cells: pick });
        break;
      }
      case 'shield': b.shield = Math.round(b.max * 0.3); bites.push({ uid: b.uid, kind: 'shield', amount: b.shield }); break;
      case 'grow': b.atk += Math.max(1, Math.round(b.def.atk * 0.2)); bites.push({ uid: b.uid, kind: 'grow' }); break;
      case 'slow': run.slow = 1; bites.push({ uid: b.uid, kind: 'slow' }); break;
      default: break;
    }
  }
  T.push({ kind: 'bites', bites, uptime: run.uptime, cells: snap(run.cells) });
  if (run.uptime <= 0) { run.over = true; run.cause = 'crash'; T.push({ kind: 'over', cause: 'crash' }); }
  return T;
}
const snap = (cells) => cells.map((c) => (c ? { id: c.id, t: c.t, lock: c.lock } : null));

function offerPatches(run) {
  const open = PATCHES.filter((p) => (run.patches[p.id] || 0) < p.max);
  return run.rnd.shuffle([...open]).slice(0, 3).map((p) => p.id);
}
// the player picks a patch: on to the next floor
export function choose(run, id) {
  if (!run.offer || !run.offer.includes(id)) return false;
  run.patches[id] = (run.patches[id] || 0) + 1;
  if (id === 'heal') { run.max += 20; run.uptime = Math.min(run.max, run.uptime + 35); }
  run.offer = null;
  run.floor++;
  enterFloor(run);
  return true;
}
// (the preview starts a few floors down, where there's more going on)
export function startAt(run, floor) { run.floor = floor; enterFloor(run); }
export function setTarget(run, i) { if (run.bugs[i] && run.bugs[i].hp > 0) { run.target = i; return true; } return false; }

export function dailySeed(date = new Date()) {
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (const ch of `hotfix:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { key: k, seed: (h >>> 0) || 1 };
}
export const kindIndex = K;
