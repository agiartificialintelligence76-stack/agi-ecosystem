const version = 1;
export function takeKey(chart) {
  return [chart.song, chart.difficulty, chart.part].join('/');
}
export function readBook(store) {
  const raw = store?.read?.()?.duetBook;
  if (!raw || raw.version !== version || typeof raw.records !== 'object' || !raw.records) {
    return {version,records:{},days:{}};
  }
  return {version,records:{...raw.records},days:{...(raw.days || {})}};
}
export function keepTake(store, chart, result, day = null) {
  const key = takeKey(chart);
  const book = readBook(store);
  const old = book.records[key];
  const record = {song:chart.title, grade:result.grade, accuracy:Math.round(result.accuracy * 1000), score:result.score,
    combo:result.bestCombo, takes:(old?.takes || 0) + 1};
  const better = !old || record.accuracy > old.accuracy || (record.accuracy === old.accuracy && record.score > old.score);
  store?.update?.(save => {
    const latest = readBook({read:() => save});
    const current = latest.records[key];
    latest.records[key] = !current || record.accuracy > current.accuracy || (record.accuracy === current.accuracy && record.score >= current.score)
      ? {...record,takes:(current?.takes||0)+1} : {...current,takes:current.takes+1};
    if (day) {
      const previous = latest.days[day];
      if (!previous || record.accuracy > previous.accuracy) latest.days[day] = {key, grade:record.grade, accuracy:record.accuracy};
    }
    save.duetBook = latest;
  });
  return {better, previous:old || null};
}
