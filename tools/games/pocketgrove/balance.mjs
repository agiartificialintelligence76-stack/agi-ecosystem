import { simulate } from '../../../src/games/pocketgrove/journal.js';
import { NIGHTS } from '../../../src/games/pocketgrove/cities.js';
const q = (v, p = .5) => v.sort((a, b) => a - b)[Math.floor((v.length - 1) * p)];
console.log('Five cities, 15 authored working nights. Thirty-two service days per night and traveler.');
for (const skill of ['newbie', 'steady', 'expert']) {
  const rows = [],
    sessions = [];
  for (let seed = 1; seed <= 32; seed++) {
    let sec = 0;
    for (const n of NIGHTS) {
      const run = simulate(n.id, seed, skill);
      rows.push(run);
      sec += run.sec;
    }
    sessions.push(sec / 60);
  }
  console.log(skill + ' · night seconds P10/50/90 ' + [.1, .5, .9].map(p => Math.round(q(rows.map(r => r.sec), p))).join('/') + ' · score P10/50/90 ' + [.1, .5, .9].map(p => q(rows.map(r => r.score), p)).join('/') + ' · median full journal ' + q(sessions).toFixed(1) + ' min · returned with wishes ' + rows.filter(r => r.done).length + '/' + rows.length + ' · detours ' + rows.reduce((n, r) => n + r.missed, 0) + ' · missing return ' + rows.filter(r => !r.done).length);
}
