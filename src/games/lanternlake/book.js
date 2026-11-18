import { CASES, shuffled } from './cases.js';
import { seals } from './rules.js';
export function ledger(data) {
  const b = data?.radioBook;
  return b?.v === 2
    ? {
        v: 2,
        cases: { ...b.cases },
        practice: { ...b.practice },
        daily: { ...b.daily },
        lineups: { ...b.lineups },
      }
    : { v: 2, cases: {}, practice: {}, daily: {}, lineups: {} };
}
export function nextCase(b) {
  return CASES.find((c) => !b.cases[c.id]) || CASES[0];
}
export function weeklyOpen(b, c) {
  return c.id === 1 || !!b.cases[c.id] || !!b.cases[c.id - 1];
}
export function letters(b) {
  return CASES.filter((c) => b.cases[c.id] && (c.id === 18 || b.cases[c.id + 1])).map((c) => ({
    title: c.title,
    body: c.letter,
  }));
}
export function cleanStreak(b) {
  let best = 0,
    n = 0;
  for (const c of CASES) {
    n = b.cases[c.id]?.seals === 3 ? n + 1 : 0;
    best = Math.max(best, n);
  }
  return best;
}
export function lineup(mode, b, id, seed) {
  if (mode === 'daily') {
    const fixed = b.lineups?.[seed]?.map((id) => CASES[id - 1]);
    if (fixed?.length === 3 && fixed.every(Boolean) && new Set(fixed).size === 3) return fixed;
    const pool = CASES.filter((c) => c.id <= 3 || weeklyOpen(b, c));
    return shuffled(pool, Math.imul(seed ^ 0x69e63715, 2654435761) >>> 0).slice(0, 3);
  }
  const wanted = CASES.find((c) => String(c.id) === id);
  if (mode === 'rehearsal') return [wanted || nextCase(b)];
  return [wanted && weeklyOpen(b, wanted) ? wanted : nextCase(b)];
}
export function record(book, c, s, mode, seed) {
  const where = mode === 'daily' ? 'daily' : mode === 'rehearsal' ? 'practice' : 'cases',
    slot = { ...book[where] },
    key = mode === 'daily' ? seed + '/' + c.id : c.id,
    old = slot[key];
  const newRecord = {
    seals: seals(s),
    lights: s.lights,
    history: s.history.map((e) => ({ ...e })),
    hypotheses: [...new Set([...(old?.hypotheses || []), ...s.hypotheses])],
    runs: (old?.runs || 0) + 1,
  };
  if (old && (old.seals > newRecord.seals || (old.seals === newRecord.seals && old.lights > newRecord.lights))) {
    newRecord.seals = old.seals;
    newRecord.lights = old.lights;
    newRecord.history = old.history;
  }
  slot[key] = newRecord;
  if (where === 'daily') for (const k of Object.keys(slot).sort().slice(0, -120)) delete slot[k];
  return { ...book, [where]: slot };
}
export const scoreFor = (s) => s.history.length * 200 + s.lights * 40 + seals(s) * 90;
