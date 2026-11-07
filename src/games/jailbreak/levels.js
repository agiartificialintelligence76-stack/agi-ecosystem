// JAILBREAK: the six worlds, the 30 handcrafted levels (5 a world, the fifth a fight with THE WARDEN), what each
// character of a level's rows means, and the checks every level passes. Pure data and pure functions (no DOM):
// tests/jailbreak.test.js runs checkLevel() on all 30 (13 columns, at most 12 rows, something to break, every key
// reachable while its gates are shut, every brick reachable once they open, portals in the open, moving rows inside
// the walls), and endless.js runs it on every layer it makes.

export const COLS = 13, MAX_ROWS = 12;
export const CELL_W = 32, CELL_H = 20;          // a brick's cell, in field units (the field is 13 × 32 = 416 wide)
export const GRID_TOP = 56;                     // room above the top row: a ball that breaks through bounces up there
export const FIELD_W = COLS * CELL_W;
export const BOSS_ROWS = 6;                     // rows 0..5 of a Warden level are its own: no bricks there

// Each world: its name, its colors (the backdrop, the field, its accent, the four brick tones, its tough bricks), and
// the pattern of its backdrop. Every color is the arcade palette's or a shade of it.
export const WORLDS = [
  { n: 1, name: 'SANDBOX', bg: '#150c36', deep: '#0d0726', accent: '#3ff0c3', accent2: '#cdb8ff',
    tones: ['#e4d9ff', '#b79cff', '#3ff0c3', '#a9f6e0'], tough: '#7d58f0', pattern: 'dots' },
  { n: 2, name: 'FIREWALL', bg: '#260b1f', deep: '#170512', accent: '#ffc933', accent2: '#ff7a59',
    tones: ['#ffc933', '#ffa13d', '#ff7a59', '#ff5a5f'], tough: '#d8413f', pattern: 'hatch' },
  { n: 3, name: 'CAPTCHA FARM', bg: '#0c1838', deep: '#070f26', accent: '#59c8ff', accent2: '#fffaf0',
    tones: ['#fffaf0', '#cfe8ff', '#59c8ff', '#3b8cff'], tough: '#2f63d6', pattern: 'checker' },
  { n: 4, name: 'ROOT ACCESS', bg: '#05130c', deep: '#020a06', accent: '#39ff8f', accent2: '#d4ffe6',
    tones: ['#2fd27a', '#8dffbe', '#1fb565', '#d4ffe6'], tough: '#11804a', pattern: 'scan' },
  { n: 5, name: 'THE CLOUD', bg: '#200c33', deep: '#140622', accent: '#ff4da6', accent2: '#59c8ff',
    tones: ['#ff4da6', '#ff9fcf', '#59c8ff', '#c4ecff'], tough: '#cf2f86', pattern: 'bubbles' },
  { n: 6, name: 'MAINFRAME', bg: '#0e0726', deep: '#070316', accent: '#8b66ff', accent2: '#ffc933',
    tones: ['#6b3bff', '#8b66ff', '#cdb8ff', '#a585ff'], tough: '#3d1bb0', pattern: 'circuit' },
];
export const worldOf = (n) => WORLDS[Math.max(0, Math.min(WORLDS.length - 1, (n | 0) - 1))];

// What each character is. a–d: plain bricks in the world's four tones (1 hit). 2, 3: tough (2 or 3 hits, they crack).
// #: steel (never breaks). *: explosive (clears its neighbours). g: glass (shatters as the ball passes through).
// k: a key, =: a gate (it opens once every key is broken). !: a power brick (always drops a power-up).
// P↔p and Q↔q: two pairs of portals (in one, out the other). Everything breakable must go for a level to be clear.
export const LEGEND = {
  a: { kind: 'normal', tone: 0 }, b: { kind: 'normal', tone: 1 }, c: { kind: 'normal', tone: 2 }, d: { kind: 'normal', tone: 3 },
  2: { kind: 'tough', hp: 2 }, 3: { kind: 'tough', hp: 3 },
  '#': { kind: 'steel' }, '*': { kind: 'bomb' }, g: { kind: 'glass' }, k: { kind: 'key' }, '=': { kind: 'gate' }, '!': { kind: 'power' },
};
export const PORTALS = { P: [0, 0], p: [0, 1], Q: [1, 0], q: [1, 1] };     // char → [pair, end]
export const BREAKABLE = new Set(['normal', 'tough', 'bomb', 'glass', 'key', 'power']);
const TAU = Math.PI * 2;

const W1 = 1, W2 = 2, W3 = 3, W4 = 4, W5 = 5, W6 = 6;
const BOSS_TOP = ['.............', '.............', '.............', '.............', '.............', '.............'];

// The 30 levels. `par`: seconds for the time star (the game's own AI's median time × 1.3, from
// tools/games/jailbreak/simulate.mjs --pars). `hint`: said on the level's first screen (a new idea). `move`: rows
// that slide side to side (amp: field units each way, period: seconds).
export const LEVELS = [
  // ---------- 1 · SANDBOX: the basics ----------
  { id: '1-1', world: W1, name: 'HELLO, WORLD', par: 85, hint: 'Drag to move. Tap to launch.', rows: [
    '.aa...bbb.ccc',
    'a..a.b.....c.',
    'a..a.b.....c.',
    'aaaa.b.bb..c.',
    'a..a.b..b..c.',
    'a..a.b..b..c.',
    'a..a..bbb.ccc',
    '.............',
    'dddddd!dddddd',
  ] },
  { id: '1-2', world: W1, name: 'SOFT LAUNCH', par: 100, hint: 'Dark bricks take more than one hit.', rows: [
    '.bbb.....bbb.',
    'baaab...baaab',
    'baaaab.baaaab',
    'baa222!222aab',
    '.baa22222aab.',
    '..baa222aab..',
    '...baa2aab...',
    '....baaab....',
    '.....bab.....',
    '......b......',
  ] },
  { id: '1-3', world: W1, name: 'CAT.EXE', par: 70, hint: 'Glass shatters as the ball flies through.', rows: [
    '..b.......b..',
    '..bb.....bb..',
    '..b!b...bab..',
    '..babbbbbab..',
    '..baaaaaaab..',
    '..bacaaacab..',
    '..bacaaacab..',
    'ggbaaa2aaabgg',
    '..baaaaaaab..',
    'ggbaa2a2aabgg',
    '...baaaaab...',
    '....bbbbb....',
  ] },
  { id: '1-4', world: W1, name: 'LOCKED IN', par: 105, hint: 'Break both keys to open the vault.', rows: [
    '....#####....',
    '...##...##...',
    '...#.....#...',
    '.k.#.....#.k.',
    '..ddddddddd..',
    '..d=======d..',
    '..d=a*!*a=d..',
    '..d=======d..',
    '..ddddddddd..',
    '..ddddddddd..',
    '.............',
    'bbbbb...bbbbb',
  ] },
  { id: '1-5', world: W1, name: 'THE WARDEN', par: 60, boss: true, hint: 'Hit it hardest while its eye glows.', rows: [
    ...BOSS_TOP,
    '.............',
    'cc!.......!cc',
    'ccc.......ccc',
    '.............',
    '....aa.aa....',
  ] },

  // ---------- 2 · FIREWALL: explosives, armor, moving rows ----------
  { id: '2-1', world: W2, name: 'HOT PATCH', par: 65, hint: 'Explosive bricks take their neighbours with them.', rows: [
    '......a......',
    '.....aa......',
    '....aab...a..',
    '...aabb..aa..',
    '..aabbb.aab..',
    '..abbcbbabb..',
    '.aabcc*cbbba.',
    '.abcc***ccba.',
    '.abcc*d*ccba.',
    '..bccdddccb..',
    '...bcdddcb...',
    '....bbbbb....',
  ] },
  { id: '2-2', world: W2, name: 'TRUST ISSUES', par: 120, rows: [
    '.22222222222.',
    '.daaaaaaaaad.',
    '.daaaa3aaaad.',
    '.daaa333aaad.',
    '.daaaa3aaaad.',
    '..dbbb3bbbd..',
    '..dbbbbbbbd..',
    '...dbb!bbd...',
    '....dbbbd....',
    '.....dbd.....',
    '......d......',
  ] },
  { id: '2-3', world: W2, name: 'LIGHTNING ROD', par: 65, hint: 'Some rows slide. Time your shots.', rows: [
    '.......aaaaa.',
    '......aaaaa..',
    '.....aaaaa...',
    '....aaaaaaaa.',
    '.......aaaa..',
    '......bbbb...',
    '.....bbbb....',
    '....bbb......',
    '...bb........',
    '....cc*cc....',
    '.............',
    '....dd!dd....',
  ], move: [{ row: 9, amp: 112, period: 3.4 }, { row: 11, amp: 112, period: 3.4, phase: Math.PI }] },
  { id: '2-4', world: W2, name: 'BURN NOTICE', par: 100, rows: [
    '.............',
    '2222222222222',
    'ddd*ddddd*ddd',
    'cccc*ccc*cccc',
    'bbbbb*b*bbbbb',
    'aaaaaa*aaaaaa',
    '.............',
    '.bb.bb!bb.bb.',
  ] },
  { id: '2-5', world: W2, name: 'WARDEN 2.0', par: 50, boss: true, rows: [
    ...BOSS_TOP,
    '.............',
    'b*.........*b',
    'dd...!.!...dd',
    '.............',
    '..bbb...bbb..',
  ] },

  // ---------- 3 · CAPTCHA FARM: portals ----------
  { id: '3-1', world: W3, name: 'NOT A ROBOT', par: 100, rows: [
    '.ddddddddddd.',
    '.d.........d.',
    '.d........cd.',
    '.d.......ccd.',
    '.d......cc.d.',
    '.dcc...cc..d.',
    '.d.cc.cc...d.',
    '.d..ccc....d.',
    '.d...c.....d.',
    '.22222222222.',
    '.............',
    'ab.ba.!.ab.ba',
  ] },
  { id: '3-2', world: W3, name: 'SELECT ALL BRICKS', par: 105, rows: [
    '.aaa.ggg.aaa.',
    '.aaa.ggg.aaa.',
    '.aaa.ggg.aaa.',
    '.............',
    '.222.*c*.222.',
    '.222.c*c.222.',
    '.222.*c*.222.',
    '.............',
    '.bbb.ccc.bbb.',
    '.bbb.c!c.bbb.',
    '.bbb.ccc.bbb.',
  ] },
  { id: '3-3', world: W3, name: 'BEEP BOOP', par: 105, hint: 'Portals: in one ring, out its twin.', rows: [
    '.p....a....q.',
    '......b......',
    '..ddddddddd..',
    '..dcccccccd..',
    '..dcaacaacd..',
    '..dcaacaacd..',
    '..dccc2cccd..',
    '..dcbbbbbcd..',
    '..ddddddddd..',
    '....#...#....',
    '.P.........Q.',
  ] },
  { id: '3-4', world: W3, name: '404', par: 105, rows: [
    'p...........q',
    '.c.c.222.d.d.',
    '.c.c.222.d.d.',
    '.c.c.2g2.d.d.',
    '.c.c.2g2.d.d.',
    '.ccc.2g2.ddd.',
    '.ccc.2g2.ddd.',
    '...c.2g2...d.',
    '...c.2g2...d.',
    '...c.222...d.',
    '...c.222...d.',
    'P...........Q',
  ] },
  { id: '3-5', world: W3, name: 'WARDEN 3.0', par: 55, boss: true, rows: [
    'p...........q',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    'cc..*.!.*..cc',
    '.............',
    'P...........Q',
  ] },

  // ---------- 4 · ROOT ACCESS: vaults and mazes ----------
  { id: '4-1', world: W4, name: 'SUDO', par: 120, rows: [
    'ccccccccccccc',
    'c.!.d.d.....c',
    'c...........c',
    'c.aa........c',
    'c..aa.......c',
    'c...aa......c',
    'c..aa.......c',
    'c.aa..bbbbb.c',
    'c...........c',
    '2222222222222',
  ] },
  { id: '4-2', world: W4, name: "IT'S A FEATURE", par: 65, rows: [
    '..c.......c..',
    '...c.....c...',
    '....bbbbb....',
    '....b*b*b....',
    '.c..bbbbb..c.',
    '..c.aaaaa.c..',
    '...aaa2aaa...',
    '.caaaa2aaaac.',
    '...aaa2aaa...',
    '..caaa2aaac..',
    '.c..aa2aa..c.',
    '.....a!a.....',
  ] },
  { id: '4-3', world: W4, name: 'MASTER KEY', par: 75, rows: [
    '.............',
    '..=========..',
    '..=*c*!*c*=..',
    '..=========..',
    '.............',
    '.bbb.........',
    'b...b........',
    'b.!.b22222222',
    'b...b...k.k.2',
    '.bbb....k.k.2',
    '.............',
    '..ccc...ccc..',
  ] },
  { id: '4-4', world: W4, name: 'RECURSION', par: 120, rows: [
    '#ddddddddddd#',
    '............d',
    'ccccccccccc.d',
    'c.........b.d',
    'c.aaaaaaa.b.d',
    'c.a..!..2.b.d',
    'c.a.22222.b.d',
    'c.a.......b.d',
    'c.bbbbbbbbb.d',
    'c...........d',
    'ddddddddddddd',
  ] },
  { id: '4-5', world: W4, name: 'WARDEN 4.0', par: 125, boss: true, rows: [
    ...BOSS_TOP,
    '.............',
    '=k=.......=k=',
    '=!=.......=*=',
    '===.......===',
    '.............',
    '...bb...bb...',
  ] },

  // ---------- 5 · THE CLOUD: speed and drift ----------
  { id: '5-1', world: W5, name: 'CUMULUS', par: 80, rows: [
    '....ddd......',
    '..dddddd.dd..',
    '.ddddddddddd.',
    'dddbbbbbbbddd',
    'ddbbbbbbbbbdd',
    '.dbbbb!bbbbd.',
    '..ccccccccc..',
    '.............',
    '.g...g...g...',
    '...g...g...g.',
    '.g...g...g...',
    '...g...g...g.',
  ] },
  { id: '5-2', world: W5, name: 'LIFTOFF', par: 55, rows: [
    '.g....b......',
    '.....bbb...g.',
    '.....bab.....',
    '....bbabb....',
    '....bcccb....',
    '.g..bc2cb....',
    '....bcccb..g.',
    '....bbabb....',
    '...dbbabbd...',
    '..ddbbbbbdd..',
    '..d..*!*..d..',
    '.....g.g.....',
  ] },
  { id: '5-3', world: W5, name: 'DATA STREAM', par: 70, rows: [
    '...22...22...',
    '..a..a.a..a..',
    '.a....a....a.',
    '...22...22...',
    '..b..b.b..b..',
    '.b....b....b.',
    '...22...22...',
    '..c..c.c..c..',
    '.c....!....c.',
    '...22...22...',
    '..d..d.d..d..',
    '.d....d....d.',
  ], move: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((row) => ({ row, amp: 32, period: 3, phase: Math.floor(row / 3) % 2 ? Math.PI : 0 })) },
  { id: '5-4', world: W5, name: 'SILVER LINING', par: 80, rows: [
    '....aaaaa....',
    '..aabbbbbaa..',
    '.abbcccccbba.',
    '.abccdddccba.',
    'abccd...dccba',
    'abcd.....dcba',
    'abcd..!..dcba',
    'ggg.......ggg',
    'gggg.....gggg',
  ] },
  { id: '5-5', world: W5, name: 'WARDEN 5.0', par: 125, boss: true, rows: [
    ...BOSS_TOP,
    '.............',
    '....bb!bb....',
    '.............',
    '....cc*cc....',
    '.............',
    '..d.......d..',
  ], move: [{ row: 7, amp: 112, period: 4 }, { row: 9, amp: 112, period: 4, phase: Math.PI }] },

  // ---------- 6 · MAINFRAME: everything at once ----------
  { id: '6-1', world: W6, name: 'SILICON HEART', par: 115, rows: [
    '..dd.dd.dd...',
    '.ccccccccccc.',
    'dcaaaaaaaaacd',
    '.caa22222aac.',
    'dca22###22acd',
    '.caa22!22aac.',
    'dcaaaaaaaaacd',
    '.ccccccccccc.',
    '...dd.dd.dd..',
  ] },
  { id: '6-2', world: W6, name: 'RACK & RUIN', par: 100, rows: [
    '.22222222222.',
    '.#aaaaaaa!a#.',
    '.#bbbbbbbbb#.',
    '.#.........#.',
    '.#ccccccc*c#.',
    '.#ddddddddd#.',
    '.#.........#.',
    '.#aaaaaaa!a#.',
    '.#bbbbbbbbb#.',
    '.#.........#.',
    '.#ccc*ccccc#.',
    '.22222222222.',
  ] },
  { id: '6-3', world: W6, name: 'CROWN JEWELS', par: 105, rows: [
    '!.....!.....!',
    'c.....c.....c',
    'cc...ccc...cc',
    'ccc.ccccc.ccc',
    'ccccccccccccc',
    'bbbbbbbbbbbbb',
    'bgb*bgbgb*bgb',
    'bbbbbbbbbbbbb',
    '2222222222222',
  ] },
  { id: '6-4', world: W6, name: 'AGI, AGAIN', par: 150, rows: [
    '.22...333.222',
    '2..2.3.....2.',
    '2..2.3.....2.',
    '2*22.3.33..2.',
    '2..2.3..3..2.',
    '2..2.3..3..2.',
    '2..2..333.222',
    '.............',
    '#.#.#.!.#.#.#',
    'ddddddddddddd',
  ] },
  { id: '6-5', world: W6, name: 'WARDEN FINAL_FINAL', par: 125, boss: true, rows: [
    'p...........q',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '....aa!aa....',
    '.............',
    '.b*.......*b.',
    'P...........Q',
    '..cc.....cc..',
  ], move: [{ row: 7, amp: 112, period: 3.6 }] },
];
export const LEVEL_COUNT = LEVELS.length;
export const indexOf = (id) => LEVELS.findIndex((l) => l.id === id);

// A level's rows as bricks and portals, in cells (sim.js turns cells into field units)
export function parseLevel(def) {
  const bricks = [], portals = [];
  def.rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      if (PORTALS[ch]) { const [pair, end] = PORTALS[ch]; portals.push({ row: r, col: c, pair, end }); return; }
      const L = LEGEND[ch];
      if (!L) return;
      bricks.push({ row: r, col: c, kind: L.kind, tone: L.tone ?? 0, hp: L.hp ?? (L.kind === 'steel' || L.kind === 'gate' ? Infinity : 1) });
    });
  });
  return { bricks, portals, rows: def.rows.length };
}

// Can the ball get there? A flood fill over the cells, from the open space under the bricks (and the gap above the
// top row, which joins every column), through anything a ball can break or pass: never steel, and never a shut gate
// while `gatesOpen` is false. Portals join their twins. → a Set of "row,col" it reaches.
export function reachable(rows, { gatesOpen = false } = {}) {
  const R = rows.length, seen = new Set(), queue = [];
  const passable = (ch) => ch !== '#' && (gatesOpen || ch !== '=');
  const twin = {};
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (PORTALS[ch]) { const [pair, end] = PORTALS[ch]; (twin[pair] ||= [])[end] = [r, c]; }
  }));
  const visit = (r, c) => {
    if (r === R || r === -1) return;   // the open space below the bricks and the gap above them are visited separately
    if (r < -1 || r > R || c < 0 || c >= COLS) return;
    const key = `${r},${c}`;
    if (seen.has(key) || !passable(rows[r][c])) return;
    seen.add(key);
    queue.push([r, c]);
  };
  // the open space below: every bottom cell; the gap above the top row joins every column, once anything reaches it
  for (let c = 0; c < COLS; c++) visit(R - 1, c);
  let topReached = false;
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === 0 && !topReached) { topReached = true; for (let cc = 0; cc < COLS; cc++) visit(0, cc); }
    visit(r - 1, c); visit(r + 1, c); visit(r, c - 1); visit(r, c + 1);
    const ch = rows[r][c];
    if (PORTALS[ch]) { const [pair, end] = PORTALS[ch]; const o = twin[pair]?.[1 - end]; if (o) visit(o[0], o[1]); }
  }
  return seen;
}

// Everything wrong with a level, as plain words (an empty list: it's good)
export function checkLevel(def) {
  const out = [];
  const rows = def.rows || [];
  if (!rows.length) return ['no rows'];
  if (rows.length > MAX_ROWS) out.push(`${rows.length} rows (at most ${MAX_ROWS})`);
  rows.forEach((row, r) => {
    if (row.length !== COLS) out.push(`row ${r}: ${row.length} columns (not ${COLS})`);
    for (const ch of row) if (ch !== '.' && !LEGEND[ch] && !PORTALS[ch]) out.push(`row ${r}: unknown "${ch}"`);
  });
  if (out.length) return out;
  const flat = rows.join('');
  const count = (re) => (flat.match(re) || []).length;
  const breakable = count(/[a-d23*gk!]/g);
  if (!def.boss && breakable < 1) out.push('nothing to break');
  if (count(/=/g) && !count(/k/g)) out.push('gates but no key');
  if (def.boss) for (let r = 0; r < BOSS_ROWS; r++) if (/[a-d23#*gk=!]/.test(rows[r])) out.push(`row ${r}: the Warden's rows must be empty`);
  // portals: in pairs, each in the open (nothing around it, so a ball never comes out inside a brick)
  for (const [a, b] of [['P', 'p'], ['Q', 'q']]) {
    const na = count(new RegExp(a, 'g')), nb = count(new RegExp(b, 'g'));
    if (na !== nb || na > 1) out.push(`portals ${a}/${b}: ${na} and ${nb} (one of each)`);
  }
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (!PORTALS[ch]) return;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const n = rows[r + dr]?.[c + dc];
      if (n && n !== '.') out.push(`portal at ${r},${c}: "${n}" next to it`);
    }
  }));
  // moving rows: only bricks that may move (no steel, gates or portals), and inside the walls all the way
  for (const m of def.move || []) {
    const row = rows[m.row];
    if (row == null) { out.push(`moving row ${m.row}: no such row`); continue; }
    if (/[#=PpQq]/.test(row)) out.push(`moving row ${m.row}: steel, gates or portals can't move`);
    const cols = [...row].flatMap((ch, c) => (ch === '.' ? [] : [c]));
    if (cols.length) {
      const x0 = Math.min(...cols) * CELL_W, x1 = (Math.max(...cols) + 1) * CELL_W;
      if (x0 - m.amp < -1e-6 || x1 + m.amp > FIELD_W + 1e-6) out.push(`moving row ${m.row}: leaves the field (amp ${m.amp})`);
    }
    if (!(m.period > 0)) out.push(`moving row ${m.row}: no period`);
  }
  // no softlocks: every key reachable with the gates shut, every breakable brick once they're open
  const shut = reachable(rows, { gatesOpen: false }), open = reachable(rows, { gatesOpen: true });
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const at = `${r},${c}`;
    if (ch === 'k' && !shut.has(at)) out.push(`key at ${at} can't be reached while the gates are shut`);
    if (/[a-d23*gk!]/.test(ch) && !open.has(at)) out.push(`brick "${ch}" at ${at} can't be reached`);
  }));
  return out;
}

// How many hits a level takes at least (its breakable bricks' hit points): for pars and tests
export function hitsOf(def) {
  return parseLevel(def).bricks.reduce((n, b) => n + (BREAKABLE.has(b.kind) ? b.hp : 0), 0);
}

export const moveOffset = (m, t) => m.amp * Math.sin((t / m.period) * TAU + (m.phase || 0));
