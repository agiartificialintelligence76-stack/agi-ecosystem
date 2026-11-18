import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { rooms } from '../../../src/games/inkveil/rooms.js';
import { begin, visible } from '../../../src/games/inkveil/patrol.js';
import { solve, replay } from '../../../src/games/inkveil/solver.js';
import { alterations, rebuild } from '../../../src/games/inkveil/variants.js';
import { rng } from '../../../src/games/kit/fx.js';
const dir = new URL('../../../src/games/inkveil/', import.meta.url);
const write = process.argv.includes('--write');
const paths = rooms.map((r) => {
  const p = solve(r),
    performance = replay(r, p.route);
  assert.ok(performance.ok && performance.silent, r.name);
  const sprint = solve(r, begin(r), { silent: false }),
    escaped = replay(r, sprint.route);
  assert.ok(escaped.ok);
  assert.equal(solve(r, begin(r), { silent: false, maxTurns: sprint.par - 1 }), null, r.name);
  assert.equal(solve(r, begin(r), { maxTurns: p.par - 1 }), null, r.name);
  return {
    id: r.id,
    par: p.par,
    route: p.route,
    expanded: p.expanded,
    cheaper: p.lowerFrontier.map((n) => n || 0),
    sprint: sprint.par,
    sprintRoute: sprint.route,
  };
});
function save(name, data) {
  const path = new URL(name, dir),
    s = JSON.stringify(data, null, 1) + '\n';
  if (write) writeFileSync(path, s);
  else assert.equal(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), s);
}
save('witnesses.json', paths);
const daily = [],
  unique = new Set();
if (write) {
  for (let i = 0; i < 256; i++) {
    const random = rng(i * 711 + 107),
      base = rooms[(i * 17) % rooms.length];
    let accepted = false;
    for (let trial = 0; trial < 80; trial++) {
      const spec = alterations(base, random.next);
      if (spec.entry === spec.exit || (spec.entry === base.start && spec.exit === base.exit)) continue;
      const signature = [spec.id, spec.entry, spec.exit, spec.layout, spec.lamp].join();
      if (unique.has(signature)) continue;
      const r = rebuild(spec),
        s = begin(r);
      if (s.guards.some((g, j) => visible(r, g, s, r.ranges[j]))) continue;
      try {
        const proof = solve(r, s, { limit: 1700 });
        if (!proof || proof.par < 4 || proof.par > 26) continue;
        assert.ok(replay(r, proof.route).ok);
        daily.push({ ...spec, par: proof.par, route: proof.route });
        unique.add(signature);
        accepted = true;
        break;
      } catch (error) {
        if (!/Unproved search/.test(error.message)) throw error;
      }
    }
    if (!accepted) throw Error('No approved variation for ' + i + ' / ' + base.name);
  }
  save('dossiers.json', daily);
} else {
  const items = JSON.parse(readFileSync(new URL('dossiers.json', dir), 'utf8'));
  for (const spec of items) {
    const r = rebuild(spec),
      result = replay(r, spec.route);
    assert.ok(result.ok && result.silent);
    assert.equal(spec.route.length, spec.par);
    assert.equal(solve(r).par, spec.par);
  }
  daily.push(...items);
}
console.log(
  paths.length +
    ' authored rooms · shortest clean route ' +
    Math.min(...paths.map((p) => p.par)) +
    '–' +
    Math.max(...paths.map((p) => p.par)) +
    ' turns · ' +
    daily.length +
    ' certified contract variants.'
);
