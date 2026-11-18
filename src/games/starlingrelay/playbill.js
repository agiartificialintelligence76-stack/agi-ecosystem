import { productions } from './productions.js';
import { VERSION, check, ink, stars } from './score.js';
export const blank = () => ({ v: VERSION, scenes: {}, daily: {}, rehearsal: null });
export function read(data) {
  const book = data?.playbill;
  if (!book || book.v !== VERSION) return blank();
  return { ...blank(), ...book, scenes: { ...book.scenes }, daily: { ...book.daily } };
}
export function unlocked(book, scene) {
  if (scene.act === 0) return true;
  const prev = productions.filter((x) => x.act === scene.act - 1);
  return prev.filter((x) => book.scenes[x.id]?.stars > 0).length >= 6 && unlocked(book, prev[0]);
}
export function daily(seed) {
  const pool = productions.filter((s) => s.plots >= 2),
    base = pool[(Math.imul(seed, 2654435761) >>> 0) % pool.length];
  return { ...base, lightSeed: seed, plots: Math.max(2, base.plots) };
}
export function saveShow(store, scene, program, par, mode, seed) {
  if (!check(scene, program).ok) return;
  store?.update?.((data) => {
    const book = read(data),
      value = ink(program),
      record = {
        ink: value,
        stars: stars(value, par),
        program: { main: [...program.main], dance: [...program.dance] },
      };
    if (mode === 'daily') {
      if (!book.daily[seed] || book.daily[seed].ink > value) book.daily[seed] = { ...record, id: scene.id };
      for (const key of Object.keys(book.daily).sort().slice(0, -35)) delete book.daily[key];
    } else if (!book.scenes[scene.id] || book.scenes[scene.id].ink > value) book.scenes[scene.id] = record;
    return { ...data, playbill: book };
  });
}
export function saveRehearsal(store, scene, program) {
  store?.update?.((data) => ({
    ...data,
    playbill: {
      ...read(data),
      rehearsal: { v: VERSION, id: scene.id, main: [...program.main], dance: [...program.dance] },
    },
  }));
}
export function sellouts(book) {
  return [0, 1, 2, 3, 4].filter((act) =>
    productions.filter((s) => s.act === act).every((s) => book.scenes[s.id]?.stars === 3)
  );
}
