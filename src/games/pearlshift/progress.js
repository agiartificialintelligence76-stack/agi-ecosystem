import { SPECIES } from './catalog.js';
export function logBook(data = {}) {
  const raw = data?.hydrophoneLog || {};
  const records = {};
  for (const f of SPECIES) {
    const v = raw.records?.[f.id];
    if (v && Number.isFinite(v.finds) && v.finds > 0) records[f.id] = {
      finds: v.finds,
      best: Number.isFinite(v.best) ? v.best : 9,
      exact: Math.max(0, Number(v.exact) || 0),
      region: Number(v.region) || 0
    };
  }
  return {
    records,
    stations: [...new Set((Array.isArray(raw.stations) ? raw.stations : []).filter(i => Number.isInteger(i) && i >= 0 && i < 32))],
    daily: {
      ...raw.daily
    }
  };
}
export function persist(data, s, kind) {
  const book = logBook(data);
  if (kind === 'find') {
    const row = s.archive.at(-1),
      v = book.records[row.species] || {
        finds: 0,
        best: 99,
        exact: 0
      };
    book.records[row.species] = {
      finds: v.finds + 1,
      best: Math.min(v.best, row.pings),
      exact: v.exact + Number(row.exact),
      region: row.region
    };
  } else if (kind === 'stamp') {
    const n = s.stamps.at(-1);
    if (!book.stations.includes(n)) book.stations.push(n);
  } else if (kind === 'end' && s.mode === 'daily') {
    book.daily[s.seed] = Math.max(book.daily[s.seed] || 0, s.score);
    book.daily = Object.fromEntries(Object.entries(book.daily).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 32));
  }
  return {
    ...data,
    hydrophoneLog: book
  };
}
