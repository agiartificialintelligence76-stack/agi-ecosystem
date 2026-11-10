// ACCEPT ALL COOKIES: a level designer's helper. Plays a level's reference solution headless (the game's own physics)
// and writes what happened as JSON for ./plot.py: the cookie's path tick by tick, every event, the result. With
// --robust it also tries each action a few ticks early and late and reports the window in which the level is still
// cleared with all three pixels (a fair level isn't frame-perfect).
//
//   node tools/games/cookies/trace.mjs 1-4 [--out /tmp/x.json] [--robust] [--all] [--free] [--at 60,120] [--cross 760]
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulate, HZ } from '../../../src/games/cookies/physics.js';
import { LEVELS, levelById } from '../../../src/games/cookies/levels.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

function trace(L, actions = L.sol) {
  const path = [];
  const events = [];
  const res = simulate(L, actions, {
    onTick(w) {
      path.push([w.tick, +w.c.x.toFixed(1), +w.c.y.toFixed(1), w.c.wrap >= 0 ? 1 : 0, w.tied]);
      for (const e of w.events) events.push({ t: w.tick, ...e });
    },
  });
  return { result: { status: res.status, why: res.why, ticks: res.ticks, pixels: res.pixels }, path, events,
    bugs: res.world.bugs.map((b) => [b.ax, b.ay, b.bx, b.by]), pins: res.world.pins.map((p) => [p.x, p.y]) };
}
const ok = (r) => r.status === 'won' && r.pixels === 3;

// each action alone shifted by d ticks: the widest run of shifts around 0 that still clears with 3 pixels
function robust(L) {
  const out = [];
  for (let k = 0; k < L.sol.length; k++) {
    let lo = 0, hi = 0;
    for (let d = -1; d >= -40; d--) { const a = L.sol.map((s, j) => (j === k ? [Math.max(0, s[0] + d), ...s.slice(1)] : s)); if (!ok(simulate(L, a))) break; lo = d; }
    for (let d = 1; d <= 40; d++) { const a = L.sol.map((s, j) => (j === k ? [s[0] + d, ...s.slice(1)] : s)); if (!ok(simulate(L, a))) break; hi = d; }
    out.push({ action: L.sol[k], early: lo, late: hi, window: hi - lo + 1 });
  }
  return out;
}

if (flag('all')) {
  let bad = 0;
  for (const L of LEVELS) {
    const r = simulate(L);
    const good = ok(r);
    if (!good) bad++;
    const rb = flag('robust') ? robust(L).map((x) => x.window).join('/') : '';
    console.log(`${good ? 'ok ' : 'BAD'} ${L.id.padEnd(5)} ${L.name.padEnd(26)} ${r.status.padEnd(4)} ${r.why.padEnd(5)} px ${r.pixels} t ${(r.ticks / HZ).toFixed(2)}s ${rb}`);
  }
  console.log(bad ? `${bad} level(s) not cleared with 3 pixels` : 'all levels cleared with 3 pixels');
  process.exit(bad ? 1 : 0);
}

const id = args.find((a) => !a.startsWith('--') && /^\d-\d+$/.test(a));
let L = levelById(id);
if (!L) { console.error(`no level ${id}`); process.exit(1); }
// --free: the cat and the pixels taken away, to see where the cookie goes by itself
if (flag('free')) L = { ...L, cat: [-9999, -9999], pixels: [] };
const t = trace(L);
// --at 60,120: where the cookie is at those ticks · --cross 760: where it first reaches that height
for (const tk of (opt('at', '') || '').split(',').filter(Boolean).map(Number)) {
  const p = t.path.find((q) => q[0] === tk);
  console.log(`  @${tk}`, p ? `x ${p[1]} y ${p[2]}${p[3] ? ' (in a pop-up)' : ''} ropes ${p[4]}` : 'gone');
}
if (opt('cross')) {
  const Y = Number(opt('cross'));
  const p = t.path.find((q, i) => i > 0 && t.path[i - 1][2] < Y && q[2] >= Y);
  console.log(`  crosses y=${Y}`, p ? `at tick ${p[0]}, x ${p[1]}` : 'never');
}
console.log(JSON.stringify(t.result), 'events:', t.events.filter((e) => e.type !== 'bounce' || e.pad).map((e) => `${e.t}:${e.type}${e.i != null ? e.i : ''}${e.rope != null ? `r${e.rope}` : ''}`).join(' '));
if (flag('robust')) for (const r of robust(L)) console.log('  ', JSON.stringify(r.action), `early ${r.early} late +${r.late} (window ${r.window} ticks = ${(r.window / HZ * 1000).toFixed(0)} ms)`);
const out = opt('out', join(process.env.COOKIES_OUT || tmpdir(), `trace-${L.id}.json`));
writeFileSync(out, JSON.stringify({ level: L, ...t }));
console.log('→', out);
