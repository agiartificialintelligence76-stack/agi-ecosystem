import { HOLES, hole } from '../../../src/games/tetherturn/courses.js';
import { runLeg } from '../../../src/games/tetherturn/flight.js';
let solved = 0,
  mandatory = 0;
for (const h of HOLES) {
  const root = hole(h.id),
    requires = root.legs.some(l => l.beacon || l.phaseRequired);
  mandatory += Number(requires);
  // A tee can capture exactly one flag. Successive legs only open at a prior capture,
  // so the number of distinct required flags is a lower bound on full-hole strokes.
  if (root.par !== root.legs.length) throw Error('lower bound ' + h.name);
  for (let v = 0; v < 4; v++) for (const l of hole(h.id, v).legs) {
    const r = runLeg(l, l.input);
    if (r.flight.phase !== 'sunk') throw Error(h.name + ' variant ' + v);
    solved++;
  }
  console.log(String(h.id + 1).padStart(2), h.name, 'par', root.par, requires ? 'in-flight action required' : 'open flight');
}
console.log(solved + ' verified legs across 144 whole-hole variants; ' + mandatory + ' of 36 holes require in-flight input.');
