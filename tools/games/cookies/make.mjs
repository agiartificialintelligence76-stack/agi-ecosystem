// ACCEPT ALL COOKIES: turns a level sketch into level data. A sketch is a level without its pixels and cat, plus
// `pixT` (the ticks of its reference solution where the three pixels should sit on the cookie's path, each optionally
// nudged: [tick, dx, dy]) and `catAt` (where the cat sits: { y } puts its mouth where the path first comes down to that
// height, { tick } where the cookie is at that tick, or [x, y] as it is). It plays the solution with the game's physics,
// places them, plays it again with them, and prints the level as it goes in ../../../src/games/cookies/levels.js.
//
//   node tools/games/cookies/make.mjs sketches.mjs [id…]      (a module exporting SKETCHES: [sketch…])
import { path } from './design.mjs';

export function make(S) {
  const { pixT = [], catAt = { y: 790 }, ...L } = S;
  const free = path({ ...L, cat: [-9999, -9999], pixels: [] }, L.sol);
  const P = free.path;
  const atTick = (t) => P.find((q) => q[0] === t);
  const pixels = pixT.map((p) => {
    const [t, dx = 0, dy = 0] = Array.isArray(p) ? p : [p];
    const q = atTick(t);
    if (!q) throw new Error(`${L.id}: no cookie at tick ${t}`);
    return [Math.round(q[1] + dx), Math.round(q[2] + dy)];
  });
  let cat;
  if (Array.isArray(catAt)) cat = catAt;
  else if (catAt.tick != null) { const q = atTick(catAt.tick); cat = [Math.round(q[1]), Math.round(q[2])]; }
  else {
    const i = P.findIndex((q, j) => j > 0 && P[j - 1][2] < catAt.y && q[2] >= catAt.y);
    if (i < 0) throw new Error(`${L.id}: the path never comes down to ${catAt.y}`);
    cat = [Math.round(P[i][1] + (catAt.dx || 0)), catAt.y];
  }
  const level = { ...L, pixels, cat };
  const res = path(level, L.sol, { keep: true });
  return { level, ok: res.status === 'won' && res.world.got === 3, res };
}

const fmt = (v) => JSON.stringify(v).replace(/"/g, "'").replace(/,/g, ', ').replace(/\[ /g, '[');
export function literal(L) {
  const keys = ['cookie', 'pins', 'ropes', 'hooks', 'popups', 'banners', 'pads', 'fans', 'bugs', 'tabs'];
  const head = `  {\n    id: '${L.id}', name: ${JSON.stringify(L.name)}${L.tip ? `, tip: ${JSON.stringify(L.tip)}` : ''},\n`;
  const body = keys.filter((k) => L[k] && (!Array.isArray(L[k]) || L[k].length)).map((k) => `${k}: ${fmt(L[k])}`).join(', ');
  return `${head}    ${body},\n    pixels: ${fmt(L.pixels)}, cat: ${fmt(L.cat)},\n    sol: ${fmt(L.sol)},\n  },`;
}

// node make.mjs sketches.mjs [id…] [--write]: --write puts every level, in order, between the markers in levels.js
if (process.argv[1] && process.argv[1].endsWith('make.mjs')) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const [src, ...ids] = args.filter((a) => a !== '--write');
  const { SKETCHES } = await import(new URL(src, `file://${process.cwd()}/`).href);
  const out = [];
  let bad = 0;
  for (const S of SKETCHES) {
    const quiet = ids.length && !ids.includes(S.id);
    try {
      const { level, ok, res } = make(S);
      if (!ok) bad++;
      const ev = res.events.filter((e) => e.type !== 'bounce' || e.pad).map((e) => `${e.t}:${e.type}${e.i ?? ''}${e.rope != null ? `r${e.rope}` : ''}`).join(' ');
      if (!quiet) console.log(`// ${ok ? 'OK' : 'NOT CLEARED'} ${level.id}: ${res.status} ${res.why} px ${res.world.got} | ${ev}`);
      if (!quiet && !write) console.log(literal(level));
      if (S.site) out.push(`  // ---------------------------------------------------------------- ${S.site}`);
      out.push(literal(level));
    } catch (e) { bad++; console.log(`// ERROR ${S.id}: ${e.message}`); }
  }
  if (write) {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const file = new URL('../../../src/games/cookies/levels.js', import.meta.url);
    const text = readFileSync(file, 'utf8');
    const a = text.indexOf('// <levels>'), b = text.indexOf('// </levels>');
    if (a < 0 || b < 0) throw new Error('levels.js has no // <levels> markers');
    writeFileSync(file, `${text.slice(0, a)}// <levels> (made by tools/games/cookies/make.mjs from its sketches)\n${out.join('\n')}\n  ${text.slice(b)}`);
    console.log(`wrote ${out.filter((l) => l.startsWith('  {')).length} levels${bad ? `, ${bad} NOT CLEARED` : ''}`);
  }
}
