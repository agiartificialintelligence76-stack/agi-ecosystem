const integer = (x, max) => Number.isInteger(x) && x >= 0 && x <= max ? x : 0;
function boundedMap(map, maxKey, minValue, maxValue) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
  return Object.fromEntries(Object.entries(map).filter(([key, value]) => /^\d+$/.test(key) && Number(key) <= maxKey && Number.isInteger(value) && value >= minValue && value <= maxValue));
}
export function notebook(data) {
  const p = data?.teaCounter || {};
  return {
    day: integer(p.day, 7),
    marks: boundedMap(p.marks, 7, 0, 3),
    baseBest: boundedMap(p.baseBest, 3, 0, 100),
    streak: integer(p.streak, 99999),
    guests: boundedMap(p.guests, 11, 0, 23),
    daily: boundedMap(p.daily, 4294967295, 0, 10000000)
  };
}
export function record(store, s, closedByClock) {
  const stars = s.served ? 1 + Number(s.perfect / Math.max(1, s.served) >= .48) + Number(s.lost === 0 && s.served >= Math.min(4, s.plan.length)) : 0;
  store?.update?.(data => {
    const p = notebook(data),
      marks = {
        ...p.marks
      },
      baseBest = {
        ...p.baseBest
      },
      guests = {
        ...p.guests,
        ...s.guestNotes
      },
      daily = {
        ...p.daily
      };
    for (const [k, v] of Object.entries(s.perfectPours)) baseBest[k] = Math.max(baseBest[k] || 0, v);
    if (s.receipt) guests[s.receipt.guest] = s.receipt.recipe;
    let day = p.day;
    if (s.mode === 'week' && closedByClock && s.served) {
      marks[s.day] = Math.max(marks[s.day] || 0, stars);
      day = Math.max(day, Math.min(7, s.day + 1));
    }
    if (s.mode === 'daily' && closedByClock) daily[s.seed] = Math.max(daily[s.seed] || 0, s.score);
    return {
      ...data,
      teaCounter: {
        day,
        marks,
        baseBest,
        guests,
        daily: Object.fromEntries(Object.entries(daily).sort(([a], [b]) => b.localeCompare(a)).slice(0, 40)),
        streak: Math.max(p.streak, s.bestStreak)
      }
    };
  });
  return stars;
}
