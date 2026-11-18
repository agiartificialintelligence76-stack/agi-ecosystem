import { writeFileSync } from 'node:fs';
import { ATLAS } from '../../../src/games/moonfreight/tables.js';
import { copyBalls, simulateShot } from '../../../src/games/moonfreight/physics.js';
import { options } from '../../../src/games/moonfreight/ai.js';
import { featMet } from '../../../src/games/moonfreight/rules.js';
function rest(balls, card, todo) {
  if (!todo.length) return [];
  const view = copyBalls(balls);
  for (const b of view) b.suit = todo.includes(b.id) ? 'sun' : 'stripe';
  const opts = options(view, 0, card.wells, true);
  for (const shot of opts.slice(0, 22)) for (const delta of [0, .006, -.006, .014, -.014, .027, -.027]) for (const boost of [0, .11]) {
    const input = {
      angle: shot.angle + delta,
      power: Math.min(1, shot.power + boost),
      spin: 0,
      called: shot.called
    };
    const out = simulateShot(balls, card.wells, input);
    if (out.log.pots.some(p => !p.id)) continue;
    const hit = todo.filter(id => out.balls.find(b => b.id === id).potted);
    if (!hit.length) continue;
    const tail = rest(out.balls, card, todo.filter(n => !hit.includes(n)));
    if (tail) return [input, ...tail];
  }
  return null;
}
const certificates = [],
  leaves = [];
for (const c of ATLAS) {
  let found = null,
    leave = null;
  const powers = c.feat === 'bank' ? [.83, .91, 1, .74, .70] : c.feat === 'combo' ? [.53, .65, .73, .82, .90] : [.35, .42, .49, .56, .62, .73, .82, .94];
  for (let i = 0; i <= 120 && !found; i++) {
    const off = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1) * .0018;
    for (const power of powers) {
      const input = {
        angle: Number((c.aim + off).toFixed(7)),
        power,
        spin: c.spin,
        called: c.pocket
      };
      const out = simulateShot(c.balls, c.wells, input);
      if (featMet(c, input, out.log)) {
        const todo = c.extra.filter(id => !out.balls.find(b => b.id === id).potted),
          tail = rest(out.balls, c, todo);
        if (tail) {
          found = [input, ...tail];
          leave = [Math.round(out.balls[0].x), Math.round(out.balls[0].y)];
          break;
        }
      }
    }
  }
  certificates.push(found);
  leaves.push(leave);
  console.log(c.id + 1, c.name, found?.length ?? 'NO', c.par);
}
if (process.argv.includes('--save') && !certificates.includes(null)) writeFileSync(new URL('../../../src/games/moonfreight/atlas-book.js', import.meta.url), '// Legal demonstrations verified against the playing engine.\nexport const certificates = ' + JSON.stringify(certificates, null, 2) + ';\nexport const leaves = ' + JSON.stringify(leaves) + ';\n');
