import witnesses from './witnesses.json' with { type: 'json' };
import dossiers from './dossiers.json' with { type: 'json' };
import { rooms, wings } from './rooms.js';
import { rebuild } from './variants.js';
export { witnesses, dossiers };
export const campaign = (room) => ({ room, certificate: witnesses[room.id - 1] });
const prepared = new Map();
function contract(index) {
  if (!prepared.has(index)) {
    const spec = dossiers[index],
      room = rebuild(spec);
    prepared.set(index, { room, certificate: spec });
  }
  return prepared.get(index);
}
export function daily(seed) {
  let mixed = seed >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x45d9f3b) >>> 0;
  mixed ^= mixed >>> 16;
  return contract((mixed >>> 0) % dossiers.length);
}
export function noir(seed, index) {
  const wing = Math.min(5, Math.floor(index / 2)),
    pool = dossiers
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => rooms[d.id - 1].wing === wing && d.route.some((op) => op[0] === 'T'));
  // Each wing is visited twice before the next one opens. A rotating offset
  // avoids immediately drawing the same recovered exhibit in consecutive cases.
  const n = (Math.imul(seed + wing, 2654435761) >>> 0) % pool.length;
  return contract(pool[(n + index * 7) % pool.length].i);
}
const version = 2;
export const notebook = (data) =>
  data?.alibi?.v === version
    ? {
        v: version,
        cases: { ...data.alibi.cases },
        dailies: { ...data.alibi.dailies },
        noir: Math.max(0, Number(data.alibi.noir) || 0),
      }
    : { v: version, cases: {}, dailies: {}, noir: 0 };
export const starCount = (turns, par, alarms) =>
  1 + (alarms === 0 ? 1 : 0) + (alarms === 0 && turns <= par ? 1 : 0);
export function unlocked(book, r) {
  if (!r.wing) return true;
  return (
    rooms.filter((s) => s.wing === r.wing - 1 && book.cases[s.id]?.stars > 0).length >= 4 &&
    unlocked(book, rooms[(r.wing - 1) * 6])
  );
}
export const labels = (book) =>
  wings
    .filter((_, i) => rooms.filter((r) => r.wing === i).every((r) => book.cases[r.id]?.stars > 0))
    .map((w) => w.label);
export function keep(store, mode, r, seed, record) {
  store?.update?.((data) => {
    const book = notebook(data),
      clean = {
        stars: record.stars,
        turns: record.turns,
        fragment: !!record.fragment,
        route: record.route.slice(0, 150),
      };
    if (mode === 'noir') book.noir = Math.max(book.noir, record.rooms || 0);
    else {
      const slot = mode === 'daily' ? book.dailies : book.cases,
        key = mode === 'daily' ? seed : r.id,
        old = slot[key];
      if (!old || clean.stars > old.stars || (clean.stars === old.stars && clean.turns < old.turns))
        slot[key] = { ...clean, fragment: clean.fragment || !!old?.fragment };
      else if (clean.fragment) slot[key] = { ...old, fragment: true };
      if (mode === 'daily') for (const date of Object.keys(slot).sort().slice(0, -40)) delete slot[date];
    }
    return { ...data, alibi: book };
  });
}
