import { SHIFTS } from './shifts.js';
import { byId } from './catalog.js';

const bounded = (n, max) => Math.min(max, Math.max(0, Number.isInteger(n) ? n : 0));
export function readLibrary(raw = {}) {
  const source = raw?.dj || {};
  const grades = SHIFTS.map((_, i) => bounded(source.grades?.[i], 3));
  const enabled = grades.findIndex(stars => !stars);
  const unlocked = enabled < 0 ? SHIFTS.length - 1 : enabled;
  if(enabled>=0)grades.fill(0,enabled+1);
  const lastHosted=Number.isInteger(source.lastHosted?.seed)&&Number.isInteger(source.lastHosted?.shift)&&source.lastHosted.shift>=0&&source.lastHosted.shift<=unlocked
    ? {seed:source.lastHosted.seed,shift:source.lastHosted.shift} : null;
  const mixes = Array.isArray(source.mixes) ? source.mixes
    .filter(m => m && byId[m.a] && byId[m.b] && m.a !== m.b && Number.isFinite(m.points))
    .slice(0, 18).map(m => ({ a: m.a, b: m.b, points: bounded(m.points,100) })) : [];
  const signatures = Array.isArray(source.signatures) ? [...new Set(source.signatures.filter(s => typeof s === 'string' && s.length <= 22))].slice(0,24) : [];
  const daily = source.daily && typeof source.daily.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.daily.day)
    ? { day: source.daily.day, best: bounded(source.daily.best, 1000000) } : null;
  return { grades, unlocked, mixes, signatures, daily, lastHosted, longest: bounded(source.longest, 1000000), blends: bounded(source.blends, 10000000) };
}

export function availableEdits(library, shift, mode) {
  const level = mode === 'daily' ? 5 : Math.max(shift, library.unlocked);
  return ['hook', ...(level >= 1 ? ['intro'] : []), ...(level >= 3 ? ['break'] : []), ...(level >= 5 ? ['encore'] : [])];
}

export function archiveRun(library, result) {
  const next = readLibrary({ dj: library });
  next.blends += result.blends;
  if(result.mode==='hosted')next.lastHosted={seed:result.seed,shift:result.shift};
  if (result.mode === 'hosted' && result.finished && result.blends >= Math.ceil(result.count / 2)) {
    const avg = result.points / Math.max(1,result.count);
    const grade = avg >= 84 ? 3 : avg >= 66 ? 2 : 1;
    next.grades[result.shift] = Math.max(next.grades[result.shift],grade);
  }
  if (result.mode === 'late') next.longest = Math.max(next.longest,result.count);
  if (result.mode === 'daily') next.daily = { day: result.day, best: Math.max(result.score, next.daily?.day === result.day ? next.daily.best : 0) };
  for (const mix of result.mixes) {
    const old = next.mixes.find(m => m.a === mix.a && m.b === mix.b);
    if (!old) next.mixes.push({...mix});
    else old.points = Math.max(old.points,mix.points);
  }
  next.mixes.sort((a,b) => b.points-a.points);
  next.mixes = next.mixes.slice(0,18);
  next.signatures = [...new Set([...next.signatures,...result.signatures])].slice(0,24);
  return readLibrary({ dj:next });
}
