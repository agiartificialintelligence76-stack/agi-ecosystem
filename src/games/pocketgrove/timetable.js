import { CITIES, NIGHTS } from './cities.js';
export function noise(seed, a, b = 0) {
  let n = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x21f0aaad)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x85ebca77);
  return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
export function clock(minute) {
  const m = Math.floor(minute),
    day = Math.floor(m / 1440),
    local = (m % 1440 + 1440) % 1440;
  return String(Math.floor(local / 60)).padStart(2, '0') + ':' + String(local % 60).padStart(2, '0') + (day > 0 ? ' +' + day : '');
}
export function issue(id, seed = 7, mode = 'journal') {
  const night = NIGHTS[id] || NIGHTS[0],
    city = CITIES[night.city];
  const base = night.shift === 2 ? 23 * 60 + 35 : 17 * 60 + 22 + 30 * night.shift + night.city * 8;
  const limit = mode === 'ride' ? 206 : night.shift === 0 ? 100 : night.shift === 1 ? 92 : 86;
  const edges = [],
    byStop = Array.from({
      length: city.stops.length
    }, () => []);
  for (const [line, service] of city.services.entries()) {
    const [serviceName, pattern, headway, first, minutes] = service;
    const offset = line === 0 ? 0 : Math.floor(noise(seed, night.id, line) * 3);
    const adjust = night.shift === 2 && line === 3 ? 1 : 0;
    for (let start = first + offset; start < limit; start += headway + adjust) {
      let depart = start;
      for (let i = 0; i < pattern.length - 1; i++) {
        const from = Number(pattern[i]),
          to = Number(pattern[i + 1]),
          express = line === 3;
        const duration = minutes + (noise(seed, line * 15 + i, night.id) > .56 ? 1 : 0),
          arrive = depart + duration;
        const edge = {
          id: line + '-' + start + '-' + i,
          line,
          service: serviceName,
          trip: line + '-' + start,
          from,
          to,
          depart,
          arrive,
          platform: line === 3 ? 3 : line === 2 ? 2 : line + 1,
          express,
          side: (from + to + line + night.id) % 2 ? 'left' : 'right',
          view: (to + i) % city.stops.length
        };
        if (arrive <= limit) {
          edges.push(edge);
          byStop[from].push(edge);
        }
        depart = arrive + 1;
      }
    }
  }
  edges.sort((a, b) => a.depart - b.depart || a.line - b.line);
  byStop.forEach(list => list.sort((a, b) => a.depart - b.depart || a.line - b.line));
  const wishes = night.wishes.map((stop, i) => ({
    stop,
    from: night.shift && i === 1 ? 12 + 6 * night.shift : 0,
    until: limit - (night.shift === 2 ? 10 : 4)
  }));
  return {
    id,
    mode,
    seed,
    night,
    city,
    base,
    limit,
    edges,
    byStop,
    wishes,
    star: night.star
  };
}
export const startState = () => ({
  station: 0,
  time: 0,
  line: -1,
  trip: null,
  pass: 1,
  mask: 0,
  star: false
});
export function walk(state, edge, night) {
  if (state.line === -1 || state.line === edge.line) return 0;
  if (night.city === 0 && night.shift === 0) return 1;
  return state.line === 2 || edge.line === 2 ? 3 : 2;
}
export const needsPass = (state, edge) => edge.express && state.trip !== edge.trip;
export function feasible(book, state, edge) {
  return edge.from === state.station && edge.depart >= state.time + walk(state, edge, book.night) && edge.arrive <= book.limit && (!needsPass(state, edge) || state.pass > 0);
}
export function arrive(book, state, edge) {
  if (!feasible(book, state, edge)) return null;
  let mask = state.mask;
  book.wishes.forEach((w, i) => {
    if (edge.to === w.stop && edge.arrive >= w.from && edge.arrive <= w.until) mask |= 1 << i;
  });
  return {
    station: edge.to,
    time: edge.arrive,
    line: edge.line,
    trip: edge.trip,
    pass: state.pass - Number(needsPass(state, edge)),
    mask,
    star: state.star || edge.to === book.star
  };
}
export const home = s => s.station === 0 && s.mask === 3;
export function departures(book, state) {
  const seen = new Set(),
    rows = [];
  for (const e of book.byStop[state.station]) {
    const key = e.line + '/' + e.to;
    if (seen.has(key) || !feasible(book, state, e)) continue;
    seen.add(key);
    rows.push(e);
  }
  return rows;
}
// Every edge is a real train on this evening's printed timetable. At a given
// station an earlier traveler can wait for anything a later one can catch.
export function solve(book, start = startState(), withStar = false) {
  if (home(start) && (!withStar || start.star)) return [];
  const keys = s => [s.station, s.line, s.line === 3 && !s.pass ? s.trip : '', s.pass, s.mask, withStar ? +s.star : 0].join('/');
  const reached = Array.from({
    length: book.city.stops.length
  }, () => new Map());
  reached[start.station].set(keys(start), {
    s: start,
    path: []
  });
  let best = null;
  for (const e of book.edges) {
    if (e.depart < start.time || best && e.depart >= best.time) continue;
    for (const {
      s,
      path
    } of reached[e.from].values()) {
      const n = arrive(book, s, e);
      if (!n) continue;
      const k = keys(n),
        old = reached[n.station].get(k);
      if (old && old.s.time <= n.time) continue;
      const record = {
        s: n,
        path: [...path, e]
      };
      reached[n.station].set(k, record);
      if (home(n) && (!withStar || n.star) && (!best || n.time < best.time)) best = {
        time: n.time,
        path: record.path
      };
    }
  }
  return best?.path || null;
}
export function retainPlan(book, state, pins) {
  const kept = [];
  let cursor = state;
  for (const edge of pins) {
    const next = arrive(book, cursor, edge);
    if (!next) break;
    kept.push(edge);
    cursor = next;
  }
  return {
    kept,
    cursor
  };
}
export function waitForTrain(book, state) {
  const rows = departures(book, state);
  const t = rows.length ? Math.max(state.time + 1, rows[0].depart + 1) : book.limit;
  return {
    ...state,
    time: Math.min(book.limit, t)
  };
}
