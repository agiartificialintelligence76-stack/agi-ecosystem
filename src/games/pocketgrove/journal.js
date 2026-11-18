import { CITIES, NIGHTS, LANDMARKS, POSTCARDS, cityForWeek } from './cities.js';
import { issue, solve, arrive, startState, departures, feasible, home, noise } from './timetable.js';
export function journal(data) {
  const old = data?.windowSeat;
  const records = old?.nights && typeof old.nights === 'object' && !Array.isArray(old.nights) ? old.nights : {};
  const views = Array.isArray(old?.views) ? old.views.filter(v => typeof v === 'string') : [];
  const stops = Array.isArray(old?.stops) ? old.stops.filter(v => typeof v === 'string') : [];
  return {
    records,
    stops: [...new Set(stops)].slice(-80),
    views: [...new Set(views)].slice(-128),
    daily: old?.daily && typeof old.daily === 'object' ? old.daily : {}
  };
}
export function openCity(records, city) {
  if (city === 0) return true;
  return !!records[(city - 1) * 3]?.stars && Boolean(records[(city - 1) * 3 + 1]?.stars || records[(city - 1) * 3 + 2]?.stars);
}
export function choose(mode, selection, seed, data, now = Date.now()) {
  const {
    records
  } = journal(data);
  if (mode === 'daily') {
    const str = String(seed),
      decoded = Date.UTC(+str.slice(0, 4), +str.slice(4, 6) - 1, +str.slice(6, 8));
    const day = str.length === 8 && Number.isFinite(decoded) ? decoded : now;
    return cityForWeek(day) * 3 + Math.floor(noise(seed, 4) * 3);
  }
  if (selection === 'weekly') return cityForWeek(now) * 3 + (mode === 'ride' ? 1 : 0);
  const id = Number(selection);
  if (selection != null && selection !== 'continue' && Number.isInteger(id) && NIGHTS[id] && (mode === 'ride' || openCity(records, NIGHTS[id].city))) return id;
  return NIGHTS.find(n => openCity(records, n.city) && !records[n.id])?.id ?? 0;
}
export function keep(data, bill) {
  const old = journal(data),
    prior = old.records[bill.id];
  const records = {
      ...old.records
    },
    daily = {
      ...old.daily
    };
  if (bill.mode === 'journal' && bill.stars) records[bill.id] = {
    stars: Math.max(prior?.stars || 0, bill.stars),
    arrival: Math.min(prior?.arrival ?? Infinity, bill.arrival),
    postcard: bill.back
  };
  if (bill.mode === 'daily') daily[bill.seed] = Math.max(daily[bill.seed] || 0, bill.score);
  const recent = Object.fromEntries(Object.entries(daily).sort(([a], [b]) => +b - +a).slice(0, 31));
  return {
    ...data,
    windowSeat: {
      ...data.windowSeat,
      nights: records,
      daily: recent,
      stops: [...new Set([...old.stops, ...(bill.stops || [])])].slice(-80),
      views: [...new Set([...old.views, ...bill.views])].slice(-128)
    }
  };
}
export function parTimes(book) {
  return {
    home: solve(book).at(-1).arrive,
    star: solve(book, startState(), true).at(-1).arrive
  };
}
export function bill(book, state, album, rides, par) {
  const done = home(state),
    wishes = Number(!!(state.mask & 1)) + Number(!!(state.mask & 2));
  const stars = done ? 1 + Number(state.star) + Number(state.time <= (typeof par === 'number' ? par : state.star ? par.star : par.home) + 5) : 0;
  return {
    id: book.id,
    mode: book.mode,
    seed: book.seed,
    stars,
    arrival: state.time,
    rides,
    views: [...album],
    wishes,
    back: POSTCARDS[book.night.city][book.night.shift],
    score: wishes * 180 + (state.star ? 110 : 0) + album.size * 40 + rides * 12 + (done ? 230 + Math.max(0, book.limit - state.time) * 4 : 0)
  };
}
export function takeView(book, e, side, progress, album) {
  if (e.side !== side || progress < .32 || progress > .77) return false;
  const id = book.night.city + '/' + e.view + '/' + side;
  if (album.has(id)) return false;
  album.add(id);
  return LANDMARKS[e.view];
}
export function simulate(n, seed, skill, mode = 'journal') {
  const book = issue(n, seed, mode);
  let s = startState(),
    reads = 0,
    rides = 0,
    sec = 0,
    missed = 0;
  const views = new Set();
  const skillLevel = {
    newbie: 0,
    steady: 1,
    expert: 2
  }[skill];
  const par = parTimes(book);
  while (!home(s) && s.time < book.limit && rides < 36) {
    const desired = solve(book, s, skillLevel === 2 && !s.star) || solve(book, s);
    const list = departures(book, s);
    if (!list.length || !desired) break;
    const ideal = desired[0],
      chance = noise(seed, rides, book.id);
    const detour = chance < [.41, .12, .015][skillLevel];
    // Novices sometimes pick the earliest departure on the wrong branch.
    const chosen = detour ? list[0] : ideal;
    if (chosen.id !== ideal.id) missed++;
    const thought = [10.4, 7.6, 4.7][skillLevel] * (.7 + noise(seed, rides, 9) * .65);
    reads += list.length;
    sec += thought + travelSeconds(chosen, s);
    if (!feasible(book, s, chosen)) break;
    if (chance > [.62, .28, .06][skillLevel]) takeView(book, chosen, chosen.side, .54, views);
    s = arrive(book, s, chosen);
    rides++;
  }
  return {
    ...bill(book, s, views, rides, par),
    reads,
    sec,
    missed,
    done: home(s)
  };
}
export const travelSeconds = (edge, state) => Math.min(5, Math.max(0, edge.depart - state.time) * .34) + 7.2 + (edge.arrive - edge.depart) * 1.42;
export function journalPages(data) {
  const j = journal(data),
    pages = [];
  for (const [id, record] of Object.entries(j.records)) {
    const night = NIGHTS[+id];
    if (!night) continue;
    pages.push({
      type: 'CITY POSTCARD',
      title: night.name,
      detail: record.postcard || POSTCARDS[night.city][night.shift],
      foot: record.stars + ' seals · best ' + record.arrival + ' timetable minutes',
      city: night.city,
      stop: night.star
    });
  }
  for (const slug of j.views) {
    const [city, view, side] = slug.split('/');
    if (!CITIES[city] || !LANDMARKS[view]) continue;
    pages.push({
      type: 'WINDOW PRINT',
      title: LANDMARKS[view],
      detail: 'from the ' + side + ' window in ' + CITIES[city].name,
      foot: 'stamped from a moving train',
      city: +city,
      stop: +view
    });
  }
  for (const [date, score] of Object.entries(j.daily).reverse().slice(0, 7)) {
    pages.push({
      type: 'DATED TICKET',
      title: 'Excursion ' + date,
      detail: 'filed in the daily city timetable',
      foot: score + ' points',
      city: 0,
      stop: 0
    });
  }
  return pages;
}
