import { CASES, claimsFor, orderFor, refutes, ORDER } from '../../../src/games/lanternlake/cases.js';
import { initial, act, seals } from '../../../src/games/lanternlake/rules.js';
import { scoreFor } from '../../../src/games/lanternlake/book.js';
const profiles = [
  { name: 'New listener', error: 0.43, speed: 153, consider: 2, compare: 1 },
  { name: 'Steady producer', error: 0.145, speed: 181, consider: 2.0, compare: 0.82 },
  { name: 'Veteran editor', error: 0.023, speed: 214, consider: 1.8, compare: 0.66 },
];
const words = (s) => (s || '').match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length || 0;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function random(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function run(c, p, seed) {
  const rng = random(Math.imul(seed ^ Math.imul(c.id, 2654435761), 73856093) ^ 0x78134863);
  let s = initial(),
    reads = words(c.opening),
    actions = 0;
  const doIt = (id) => {
    s = act(c, s, id);
    actions++;
  };
  for (let stage = 0; stage < c.rounds.length; stage++) {
    const o = orderFor(c, stage, seed, true);
    reads += o.claims.reduce((a, q) => a + words(q.text), 0);
    const lead = o.claims.find((q) => o.items.some((e) => refutes(q, e))),
      correct = o.items.find((e) => refutes(lead, e)),
      other = o.claims.find((q) => q !== lead);
    if (p === profiles[0]) {
      doIt('claim:' + other.id);
      doIt('press');
      reads += words(other.press);
      doIt('back');
    }
    doIt('claim:' + lead.id);
    doIt('press');
    reads += words(lead.press);
    // A new producer inspects every exhibit. An experienced editor recognizes labels,
    // but still opens the item and reads the field before they can present it.
    const viewed = new Set();
    for (const e of o.items) {
      reads += words(e.title);
      if (e === correct || rng() > p.compare) continue;
      doIt('item:' + e.id);
      reads += words(e.front);
      if (e.back) {
        doIt('flip');
        reads += words(e.back);
      }
      viewed.add(e.id);
    }
    const wrong = o.items.filter((e) => e !== correct);
    if (rng() < p.error) {
      const mistakes = p === profiles[0] && rng() < 0.46 ? 2 : 1;
      for (const e of wrong.slice(0, mistakes)) {
        doIt('item:' + e.id);
        if (!viewed.has(e.id)) reads += words(e.front) + words(e.back);
        if (e.back) doIt('flip');
        doIt('present');
        reads += words(s.feedback);
      }
    }
    if (s.lights <= 2 && !s.restored && rng() < 0.68) {
      doIt('listen');
      reads += ORDER[c.id - 1].reduce((a, line) => a + words(line), 0);
      if (p === profiles[0] && rng() < 0.22) {
        doIt('when:1');
        reads += words(s.feedback);
      }
      doIt('when:0');
    }
    doIt('item:' + correct.id);
    reads += words(correct.front) + words(correct.back);
    if (correct.back) doIt('flip');
    doIt('present');
    if (s.phase !== 'amended') throw Error('Missing correction ' + c.id);
    reads += words(s.feedback);
    doIt('next');
  }
  reads += words(c.ending);
  if (s.phase !== 'sealed') throw Error('Incomplete show');
  return {
    seconds: (reads / p.speed) * 60 + actions * p.consider,
    score: scoreFor(s),
    corrected: s.history.length,
    unaided: !s.assisted,
    clean: seals(s) === 3,
    errors: s.strikes,
  };
}
console.log(
  '48 seeded exhibit and testimony orderings per 18-case week, per policy. Times model words actually read plus per-decision time.'
);
for (const p of profiles) {
  const rows = CASES.map((c) => Array.from({ length: 48 }, (_, i) => run(c, p, 20260201 + i)));
  const all = rows.flat(),
    mean = (set, field) => avg(set.map((r) => Number(r[field])));
  console.log(
    '\n' +
      p.name +
      ': ' +
      (mean(all, 'seconds') / 60).toFixed(2) +
      ' min/case, ' +
      ((mean(all, 'seconds') * 18) / 60).toFixed(1) +
      ' min/week, pilot unaided ' +
      (100 * mean(rows[0], 'unaided')).toFixed(1) +
      '%, clean two-edit ' +
      (100 * mean(rows.slice(0, -1).flat(), 'clean')).toFixed(1) +
      '%, assisted ' +
      (100 * (1 - mean(all, 'unaided'))).toFixed(1) +
      '%, ' +
      mean(all, 'errors').toFixed(2) +
      ' lost lights/case.'
  );
  const weekScores = Array.from({ length: 48 }, (_, i) => rows.reduce((a, rr) => a + rr[i].score, 0)).sort(
    (a, b) => a - b
  );
  console.log(
    'Weekly score P10 / median / P90: ' +
      [0.1, 0.5, 0.9].map((v) => weekScores[Math.floor(v * (weekScores.length - 1))]).join(' / ')
  );
  console.log('Case | edits | seconds | lost lights | rehearsal %');
  rows.forEach((rr, j) =>
    console.log(
      String(j + 1).padStart(2, '0') +
        '   | ' +
        mean(rr, 'corrected').toFixed(0) +
        '     | ' +
        mean(rr, 'seconds').toFixed(0) +
        '      | ' +
        mean(rr, 'errors').toFixed(2) +
        '        | ' +
        (100 * (1 - mean(rr, 'unaided'))).toFixed(1)
    )
  );
}
