import { hole, dailyNine } from '../../../src/games/tetherturn/courses.js';
import { runLeg, quantAngle, quantPower } from '../../../src/games/tetherturn/flight.js';
import { rankFlight } from '../../../src/games/tetherturn/ghost.js';
const profiles = {
  newbie: [.22, .16, 42, .17, 3.1],
  steady: [.095, .085, 22, .045, 5.8],
  expert: [.044, .049, 12, .012, 4.4]
};
function randomizer(seed) {
  let n = seed >>> 0;
  return () => (n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296;
}
export function fly(profile, seed, tour = false) {
  const [aim, power, slip, omit, study] = profiles[profile],
    random = randomizer(seed),
    noise = () => random() + random() - 1;
  let flags = 0,
    reserve = 7,
    cleanChain = 0,
    shots = 0,
    rings = 0,
    score = 0,
    seconds = 0,
    recoveries = 0,
    flybys = 0,
    energy = 0,
    rims = 0;
  for (let run = 0; run < (tour ? 36 : 150) && (tour || reserve > 0); run++) {
    const def = tour ? {
        id: run,
        variant: 0
      } : run ? dailyNine(seed + run * 829)[run % 9] : {
        id: 0,
        variant: 0
      },
      h = hole(def.id, def.variant);
    let cleanRings = 0,
      strokes = 0,
      spent = 0,
      complete = true;
    for (const leg of h.legs) {
      seconds += (2.7 + leg.wells.length * 1.4 + leg.input.controls.length * 1.9) * (profile === 'expert' ? .45 : 1);
      let result;
      do {
        if (!tour && reserve <= 0) {
          complete = false;
          break;
        }
        const input = {
          angle: quantAngle(leg.input.angle + noise() * aim),
          power: quantPower(leg.input.power + noise() * power),
          controls: leg.input.controls.filter(() => random() > omit).map(c => ({
            id: c.id,
            tick: Math.max(0, c.tick + Math.round(noise() * slip))
          })).sort((a, b) => a.tick - b.tick)
        };
        result = runLeg(leg, input).flight;
        shots++;
        strokes++;
        reserve--;
        spent += result.burns;
        seconds += result.tick / 120 + study * (.72 + .7 * random()) + leg.wells.length * .8;
        if (result.phase !== 'sunk') {
          recoveries++;
          flybys += Number(result.fast);
          energy += Number(result.energyMiss);
          rims += Number(result.gateMiss);
        }
      } while (result.phase !== 'sunk' && strokes < 80);
      if (!complete || result.phase !== 'sunk') {
        complete = false;
        break;
      }
      cleanRings += result.rings;
    }
    if (!complete) break;
    flags++;
    rings += cleanRings;
    score += rankFlight(strokes, h.par, spent, cleanRings);
    if (strokes === h.par && cleanRings === h.legs.reduce((sum, l) => sum + l.rings.length, 0)) {
      cleanChain++;
      if (cleanChain === 2) {
        reserve++;
        cleanChain = 0;
      }
    } else cleanChain = 0;
    if (flags % 6 === 0) reserve += flags === 12 ? 5 : 3;
  }
  return {
    flags,
    score,
    seconds,
    rings,
    shots,
    recoveries,
    flybys,
    energy,
    rims
  };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/tetherturn/balance.mjs')) {
  const n = Number(process.argv[2]) || 64;
  for (const tag of Object.keys(profiles)) {
    const rows = Array.from({
        length: n
      }, (_, i) => fly(tag, 73 + i * 7919)),
      q = (k, p = .5) => rows.map(r => r[k]).sort((a, b) => a - b)[Math.floor((n - 1) * p)];
    console.log(tag + ' · seconds p10/50/90 ' + [.1, .5, .9].map(p => q('seconds', p).toFixed(1)).join('/') + ' · score p25/50/75 ' + [.25, .5, .75].map(p => q('score', p)).join('/') + ' · flags ' + q('flags') + ' · strokes ' + q('shots') + ' · rings ' + q('rings') + ' · recoveries ' + q('recoveries') + ' · fast/field/rim events ' + ['flybys', 'energy', 'rims'].map(k => rows.reduce((s, r) => s + r[k], 0)).join('/') + ' · full-tour median ' + Array.from({
      length: Math.min(n, 12)
    }, (_, i) => fly(tag, 23 + i * 97, true).seconds / 60).sort((a, b) => a - b)[Math.floor((Math.min(n, 12) - 1) / 2)].toFixed(1) + 'min');
  }
}
