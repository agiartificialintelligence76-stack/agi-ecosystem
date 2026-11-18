import { line, oval, panel, type } from '../kit/illustration.js';
import { clock } from './timetable.js';
import { LANDMARKS } from './cities.js';
import { coach } from './window.js';
import { seating } from './layout.js';
const ink = '#2d3541',
  cream = '#fff0ce',
  reel = '#326260';
const raw = (c, s, x, y, size, color, align = 'left', family = 'AK Sans', width) => {
  c.fillStyle = color;
  c.font = '750 ' + size + "px '" + family + "',system-ui";
  c.textAlign = align;
  c.textBaseline = 'middle';
  if (width) c.fillText(s, x, y, width);else c.fillText(s, x, y);
};
function drawnMap(c, box, b, s, e, plan, compact) {
  const {
    x,
    y,
    w,
    h
  } = box;
  const p = i => [x + b.city.xy[i][0] * w, y + b.city.xy[i][1] * h];
  const routes = [b.city.color, '#778a9a', '#c29755', '#9584a7'];
  for (const [n, service] of b.city.services.entries()) {
    c.save();
    if (n === 3) c.setLineDash([3, 5]);
    const pts = [...service[1]].map(z => {
      const [a, d] = p(+z);
      return [a, d + n * 1.2];
    });
    line(c, pts, routes[n], n === 0 ? 4 : n === 3 ? 1.5 : 2);
    c.restore();
  }
  for (const leg of [...plan, e].filter(Boolean)) line(c, [p(leg.from), p(leg.to)], '#244948', 3);
  const fs = compact ? 12 : 14;
  for (let i = 0; i < b.city.stops.length; i++) {
    const [px, py] = p(i),
      wish = b.wishes.some((v, k) => v.stop === i && !(s.mask & 1 << k)),
      star = b.star === i;
    const radius = compact ? 5 : 7;
    oval(c, px, py, i === s.station ? radius + 3 : radius, i === s.station ? radius + 3 : radius, wish ? '#f0ab83' : star ? '#f7c55f' : cream, ink, 1.6);
    if (i === s.station) oval(c, px, py, radius * .5, radius * .5, reel);
    if (!compact || i === s.station || wish) raw(c, b.city.stops[i], px, py + (i % 2 ? -(radius + 8) : radius + 8), fs, ink, 'center', 'AK Sans', Math.min(w * .3, 112));
  }
}
export function draw(c, w, h, v) {
  const {
      book: b,
      state: s,
      edge: e,
      phase,
      selected,
      plan
    } = v,
    L = seating(w, h),
    d = L.desk;
  c.fillStyle = '#e9d9b7';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < w + 22; i += 26) line(c, [[i, 0], [i - 7, 7]], '#6d8e87', 4);
  const narrow = w < 550,
    titlesize = narrow ? 21 : Math.min(36, w * .038);
  raw(c, b.city.name, L.pad, L.pad + L.head * .37, titlesize, ink, 'left', 'AK Display');
  raw(c, b.night.name, L.pad, L.pad + L.head * .85, 12, reel, 'left', 'AK Mono');
  const depClock = phase === 'ride' ? b.base + Math.round(v.tripStart + (e.arrive - v.tripStart) * v.fraction) : b.base + s.time;
  raw(c, clock(depClock), w - L.pad, L.pad + L.head * .36, narrow ? 20 : 27, ink, 'right', 'AK Mono');
  raw(c, 'LAST TRAIN ' + clock(b.base + b.limit), w - L.pad, L.pad + L.head * .85, 12, ink, 'right', 'AK Mono');
  coach(c, L.coach, b, {
    time: v.time,
    journey: v.journey,
    quiet: v.quiet,
    excited: phase === 'ride' && v.fraction > .34 && v.fraction < .77,
    side: v.side,
    view: phase === 'ride' ? e.view : null,
    viewSide: e?.side,
    fraction: v.fraction,
    destination: phase === 'ride' ? e.to : s.station
  });
  const wishes = b.wishes.map((g, i) => {
    const name = (s.mask & 1 << i ? '✓ ' : '○ ') + b.city.stops[g.stop];
    return name + '  ' + (g.from ? clock(b.base + g.from) + '–' : 'by ') + clock(b.base + g.until);
  });
  const wishWidth = Math.min(L.coach.w - 20, Math.max(...wishes.map(t => t.length)) * 7 + 18);
  panel(c, L.coach.x + 10, L.coach.y + 9, wishWidth, 35, '#fff1d8', 6);
  wishes.forEach((t, i) => raw(c, t, L.coach.x + 17, L.coach.y + 19 + i * 14, 12, ink, 'left', 'AK Sans', wishWidth - 11));
  panel(c, d.x, d.y, d.w, d.h, cream, 9);
  const margin = Math.min(14, d.w * .04),
    x = d.x + margin,
    y = d.y + margin,
    r = d.x + d.w - margin;
  const sub = phase === 'ride' ? e.service + '  ·  ' + (e.express ? 'LIMITED' : 'ON BOARD') : 'PLATFORM ' + (selected?.platform || 1) + '  /  ' + s.station.toString().padStart(2, '0');
  raw(c, sub, x, y + 5, 12, reel, 'left', 'AK Mono');
  const title = v.showBook ? 'My travel journal' : v.listing ? 'Departure board' : phase === 'ride' ? b.city.stops[e.to] : plan.length === 3 ? 'Pinned itinerary' : v.planning ? 'Pin from ' + b.city.stops[v.planning.station] : b.city.stops[s.station];
  raw(c, title, x, y + (d.h > 195 ? 32 : 25), Math.min(26, Math.max(17, d.w * .053)), ink, 'left', 'AK Display', d.w - 2 * margin);
  const head = d.h > 195 ? 48 : 37,
    mini = d.h < 169;
  const cartH = mini ? Math.max(40, d.h - head - 40) : Math.max(70, Math.min(d.h * .46, d.h - head - 45));
  if (v.showBook) {
    const pg = v.page,
      records = Object.values(v.saved.records);
    raw(c, pg ? pg.type + '  ' + v.pageNumber : records.length + ' / 15 night seals   ·   ' + v.saved.views.length + ' views', x, y + head + 6, 13, ink, 'left', 'AK Mono', d.w - 2 * margin);
    raw(c, pg ? pg.title : 'A blank page and a train at the platform.', x, y + head + 26, 14, reel, 'left', 'AK Serif', d.w - 2 * margin);
    if (d.h > 190 && pg) {
      raw(c, pg.detail, x, y + head + 48, 13, ink, 'left', 'AK Serif', d.w - 2 * margin);
      raw(c, pg.foot, x, y + head + 68, 12, reel, 'left', 'AK Mono', d.w - 2 * margin);
    }
  } else if (v.listing) {
    for (const [i, row] of v.departures.entries()) raw(c, clock(b.base + row.depart) + '  ' + b.city.stops[row.to] + '  → ' + clock(b.base + row.arrive), x, y + head + 6 + i * (d.h < 185 ? 15 : 24), 12, ink, 'left', 'AK Mono', d.w - 2 * margin);
  } else if (plan.length && phase === 'station') {
    plan.forEach((leg, i) => raw(c, i + 1 + '. ' + clock(b.base + leg.depart) + '  ' + b.city.stops[leg.from] + ' → ' + b.city.stops[leg.to], x, y + head + 5 + i * (mini ? 14 : 20), 12, ink, 'left', 'AK Mono', d.w - 2 * margin));
  } else {
    drawnMap(c, {
      x: x + 5,
      y: y + head,
      w: d.w - margin * 2 - 10,
      h: cartH
    }, b, s, phase === 'ride' ? e : selected, plan, mini || d.w < 550);
  }
  const by = d.y + d.h - (mini ? 35 : 53);
  c.fillStyle = phase === 'ride' ? '#345857' : '#37414a';
  c.fillRect(d.x, by, d.w, d.y + d.h - by);
  const nextDeparture = plan.length === 3 ? plan[0] : selected;
  const top = v.showBook ? v.page?.title || 'First print still ahead' : phase === 'ride' ? v.souvenir ? 'PRINT FILED' : v.fraction < .32 ? 'LANDMARK AHEAD' : v.fraction > .77 ? 'NEXT STOP' : 'LOOK ' + e.side.toUpperCase() : nextDeparture ? clock(b.base + nextDeparture.depart) + '  →  ' + b.city.stops[nextDeparture.to] : 'LAST SERVICE';
  raw(c, top, x, by + (mini ? 10 : 15), mini ? 12 : Math.min(18, d.w * .049), '#fff0d0', 'left', 'AK Display', d.w - margin * 2);
  const lower = v.showBook ? v.page?.detail || 'Hold one view in your window, then stamp it.' : phase === 'ride' ? LANDMARKS[e.view] + ' · ' + v.side + ' window' : nextDeparture ? nextDeparture.service + ' · arrives ' + clock(b.base + nextDeparture.arrive) : 'File tonight’s journey.';
  raw(c, lower, x, by + (mini ? 26 : 36), 12, '#d9d6bb', 'left', 'AK Mono', d.w - margin * 2);
  // A separate ticket keeps the two wishes readable throughout a ride.
  if (d.h > 300 && !v.showBook && !v.listing) {
    const stripY = y + head + cartH + 14;
    const wishes = b.wishes.map((ws, k) => (s.mask & 1 << k ? '✓ ' : '○ ') + b.city.stops[ws.stop]);
    raw(c, wishes.join('   '), x, stripY, 14, ink, 'left', 'AK Sans', d.w - margin * 2);
    raw(c, '★ ' + b.city.stops[b.star] + '  ·  ' + s.pass + ' express pass', x, stripY + 22, 12, reel, 'left', 'AK Mono', d.w - margin * 2);
  }
}
