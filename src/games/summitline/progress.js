export function book(data = {}) {
  const v = data?.cableSongbook || {};
  return {
    stamps: [...new Set((Array.isArray(v.stamps) ? v.stamps : []).filter(n => Number.isInteger(n) && n >= 0 && n < 24))],
    longest: Math.max(0, Number(v.longest) || 0),
    dailies: {
      ...(v.dailies || {})
    }
  };
}
export function enter(data, state, piece = null, finished = false) {
  const p = book(data);
  if (piece != null && !p.stamps.includes(piece)) p.stamps.push(piece);
  p.longest = Math.max(p.longest, state.longest);
  if (finished && state.mode === 'daily') p.dailies[state.seed] = Math.max(state.score, p.dailies[state.seed] || 0);
  const dates = Object.keys(p.dailies).sort().reverse();
  p.dailies = Object.fromEntries(dates.slice(0, 32).map(k => [k, p.dailies[k]]));
  return {
    ...data,
    cableSongbook: p
  };
}
