export const medal = (moves, par) => moves === par ? 3 : moves <= par + 2 ? 2 : 1;
export const mealScore = (moves, par) => Math.max(100, 230 + par * 18 + medal(moves, par) * 75 - Math.max(0, moves - par) * 7);
export const stations = data => data?.noodleRail?.stations || {};
export function openLine(records, line) {
  if (line === 0) return true;
  return Array.from({
    length: 6
  }, (_, i) => records[(line - 1) * 6 + i]).filter(Boolean).length >= 4;
}
export function accessible(records, id, mode) {
  return mode === 'sandbox' ? id === 0 || !!records[id] : openLine(records, Math.floor(id / 6));
}
export function stamp(store, yard, moves, par, mode, seed) {
  store?.update?.(data => {
    const old = data.noodleRail || {},
      records = {
        ...(old.stations || {})
      };
    const daily = {
      ...(old.daily || {})
    };
    const target = mode === 'daily' ? daily : records,
      k = mode === 'daily' ? String(seed) : yard.id;
    target[k] = target[k] === undefined ? moves : Math.min(target[k], moves);
    const recent = Object.entries(daily).sort(([a], [b]) => b.localeCompare(a)).slice(0, 45);
    return {
      ...data,
      noodleRail: {
        ...old,
        stations: records,
        daily: Object.fromEntries(recent),
        lastYard: mode === 'daily' ? old.lastYard : yard.id
      }
    };
  });
}
export function nextStop(records, current) {
  for (let n = 1; n <= 36; n++) {
    const id = (current + n) % 36;
    if (!records[id] && accessible(records, id, 'campaign')) return id;
  }
  return (current + 1) % 36;
}
