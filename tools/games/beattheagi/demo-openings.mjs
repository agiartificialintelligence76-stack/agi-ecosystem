// BEAT THE AGI: finds the boards for the arcade's preview (?demo) and the title's quiet game, and writes them to
// src/games/beattheagi/demo.js. Each candidate is a seeded mid-game board; the real game (./match.js, with its clock,
// its think times and its falling stones) plays it out in Node exactly as ?demo will: 13B playing pink for "you", 400B
// as AGI-1. A board is kept when, a couple of moves in, she finds a forced win mid-think (her bars turn honey at depth 3
// or deeper, "i see it now") and her four lands 2.4 to 6.4 s of game time later. The demo then times its clock so that
// think starts as the preview's recording does (5.75 s after the page opens) and her four follows about 4.2 s later.
//   node tools/games/beattheagi/demo-openings.mjs [how many = 6] [seconds to look = 240]
import { writeFileSync } from 'node:fs';
import { rng } from '../../../src/games/kit/fx.js';
import { createSearcher } from '../../../src/games/beattheagi/engine.js';
import { decide } from '../../../src/games/beattheagi/levels.js';
import { createBrain } from '../../../src/games/beattheagi/brain.js';
import { Match } from '../../../src/games/beattheagi/match.js';
import { emptyBoard, drop, legalCols, threatsNow, toPicture, PINK, MINT, other } from '../../../src/games/beattheagi/rules.js';
import { say } from '../../../src/games/beattheagi/lines.js';
import { DEMO_LEVELS } from '../../../src/games/beattheagi/demo.js';

const WANT = Number(process.argv[2] || 6);
const LO = 3.0, HI = 14;
const UNTIL = Date.now() + Number(process.argv[3] || 240) * 1000;   // stop looking after this many seconds
const brain = createBrain();
const s13 = createSearcher({ bits: 16 });

// a seeded board: k stones, a mix of a 13B and a centre-leaning die, nobody about to win
function opening(seed) {
  const r = rng(seed);
  const cells = emptyBoard();
  let who = r.chance(0.5) ? PINK : MINT;
  const k = r.int(9, 17);
  for (let i = 0; i < k; i++) {
    let col;
    if (r.chance(0.55)) col = decide(s13, cells, who, 2, { seed: seed * 13 + i }).move;
    else col = r.weighted(legalCols(cells).map((c) => ({ c, weight: [1, 2, 3, 4, 3, 2, 1][c] }))).c;
    const d = drop(cells, col, who);
    if (!d || d.line || d.full) return null;
    who = other(who);
  }
  if (threatsNow(cells, who).length || threatsNow(cells, other(who)).length > 1) return null;
  return { cells, turn: who };
}

function play(op, seed) {
  const r = rng(seed * 3 + 1);
  let hersSeen = 0, lossSeen = false;
  const thinks = [];
  const m = new Match({
    mode: 'demo', level: DEMO_LEVELS.her, pinkLevel: DEMO_LEVELS.you, cells: op.cells, turn: op.turn, seed,
    hooks: {
      think: (req) => {
        if (req.color === MINT) {
          const t = thinks[thinks.length - 1];
          const onDepth = req.onDepth;
          req = { ...req, onDepth: (x) => {
            if (t && t.provenAt == null && Math.abs(x.score) > 9900) { t.provenAt = x.depth; t.kind = x.score > 0 ? 'win' : 'loss'; }
            if (t) t.top = x.depth;
            onDepth?.(x);
          } };
        }
        return brain.think({ ...req, sync: true });
      },
      line: (k, level, vars) => say(k, level, (a) => a[0], vars),
      chance: (p) => r.next() < p,
    },
  });
  const marks = [];
  let lastPhase = '';
  const origStart = m.startThink.bind(m);
  m.startThink = () => { thinks.push({ start: m.t, ply: m.plies }); origStart(); };
  m.start();
  for (let i = 0; i < 120 * 14 && m.phase !== 'end'; i++) {
    m.update(1 / 120);
    if (m.phase !== lastPhase) {
      if (m.phase === 'think') hersSeen++;
      if (m.phase === 'commit') {
        const res = m.think?.result;
        Object.assign(thinks[thinks.length - 1], { depth: res.depth, score: res.score });
        if (res.score < -9900) lossSeen = true;
      }
      marks.push(`${m.t.toFixed(2)} ${m.phase}`);
      lastPhase = m.phase;
    }
  }
  return { winner: m.winner, at: m.t, plies: m.plies, hersSeen, lossSeen, marks, line: m.line, thinks };
}

const found = [];
for (let seed = 1; found.length < WANT && seed < 20000 && Date.now() < UNTIL; seed++) {
  const op = opening(seed);
  if (!op) continue;
  const res = play(op, seed);
  if (res.winner !== MINT || res.at < LO || res.at > HI) continue;
  // the first think where she's sure to win: found at depth 3 or deeper, a couple of moves into the game, and her four
  // not long after
  const real = res.thinks.find((x) => x.kind === 'win');
  if (!real || real.provenAt < 3 || real.start < 2.4) continue;
  const span = res.at - real.start;
  if (span < 2.4 || span > 6.4 || res.plies - real.ply > 6) continue;
  const k = 1;   // (times below in game seconds)
  // the four somewhere you can see it: not all of it in the bottom row
  const rows = res.line.map((i) => (i / 7) | 0);
  if (Math.max(...rows) === 0) continue;
  found.push({ pic: toPicture(op.cells), turn: op.turn === PINK ? 'x' : 'o', seed, R: Number(real.start.toFixed(3)), A: Number(res.at.toFixed(3)) });
  console.log(`seed ${seed}: ${res.winner === PINK ? 'you win' : 'she wins'} at ${res.at.toFixed(2)} s after ${res.plies} plies (${op.turn === PINK ? 'you' : 'she'} first); her thinks ${res.thinks.map((x) => `${(x.start * k).toFixed(1)}s d${x.top} ${x.kind || ''}@${x.provenAt ?? '-'}`).join(', ')}`);
}

// the title's quiet games: a few early boards (any outcome)
const attract = [];
for (let seed = 9001; attract.length < 6 && seed < 9200; seed++) {
  const r = rng(seed);
  const cells = emptyBoard();
  let who = PINK, ok = true;
  const k = r.int(4, 8);
  for (let i = 0; i < k && ok; i++) {
    const col = decide(s13, cells, who, 2, { seed: seed + i }).move;
    const d = drop(cells, col, who);
    if (!d || d.line) ok = false;
    who = other(who);
  }
  if (ok && !threatsNow(cells, who).length) attract.push({ pic: toPicture(cells), turn: who === PINK ? 'x' : 'o' });
}

const fmt = (o) => `  { pic: [${o.pic.map((r) => `'${r}'`).join(', ')}], turn: '${o.turn}'${o.seed != null ? `, seed: ${o.seed}, R: ${o.R}, A: ${o.A}` : ''} },`;
const out = `// BEAT THE AGI (2026-11-08): boards for the arcade's preview (?demo) and the title's quiet game.
// Written by tools/games/beattheagi/demo-openings.mjs, which plays each one with the real game's clock (./match.js):
// in the demo, 13B plays pink for "you" against her at 400B. \`R\`: the game time (s) her think starts in which she
// finds her forced win (her bars turn honey mid-think); \`A\`: when her four lands. The first game's clock is shifted and
// scaled (demoClock) so that think starts at DEMO_THINK_AT seconds after the page opens and her four about DEMO_SPAN
// seconds later: inside the preview's recording (5.7 to 11.7 s). Pictures: rows top first, 'x' pink, 'o' mint; \`turn\`:
// who moves next.
export const DEMO_LEVELS = { her: ${DEMO_LEVELS.her}, you: ${DEMO_LEVELS.you} };
export const DEMO_THINK_AT = 5.75;
export const DEMO_SPAN = 4.2;
export const DEMO_OPENINGS = [
${found.map(fmt).join('\n')}
];
export const ATTRACT_OPENINGS = [
${attract.map(fmt).join('\n')}
];

// the first demo game's clock: { speed, start } (start: the page time, in seconds, its game time is 0)
export function demoClock(op) {
  const speed = Math.max(0.85, Math.min(1.3, (op.A - op.R) / DEMO_SPAN));
  return { speed, start: DEMO_THINK_AT - op.R / speed };
}
`;
if (!found.length) { console.log('found nothing: demo.js left as it was'); process.exit(1); }
writeFileSync(new URL('../../../src/games/beattheagi/demo.js', import.meta.url), out);
console.log(`wrote ${found.length} demo boards and ${attract.length} title boards`);
