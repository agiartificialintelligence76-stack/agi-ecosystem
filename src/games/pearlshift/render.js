import { SPECIES, REGIONS, DEPTH } from './catalog.js';
import { observations } from './rules.js';
import { bestFix, clamp } from './acoustics.js';
import { layout, project } from './layout.js';
import { panel, poly, oval, line, gradient, sprite } from '../kit/field-art.js';
const diver = sprite(new URL('./agi.webp', import.meta.url)),
  whale = sprite(new URL('./prop.webp', import.meta.url));
const INK = '#111931',
  mint = '#a9ffe2',
  paper = '#ffe7b1';
function text(c, label, x, y, sz = 14, align = 'left', color = mint, family = 'AK Sans') {
  c.fillStyle = color;
  c.font = '750 ' + Math.max(12, sz) + 'px "' + family + '", system-ui';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(label, x, y);
}
function recovered(c, id, x, y, width, t) {
  if (id === 0 && whale(c, x - width * .5, y - width * .28, width, width * .54)) return;
  const f = SPECIES[id],
    length = width * (id === 1 || id === 4 ? .78 : 1);
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 2) * .035);
  const tail = Math.sin(t * 2.4 + id) * length * .035,
    bulk = id === 4 ? .17 : id === 1 ? .15 : .118;
  poly(c, [[-length * .29, 0], [-length * .49, tail - length * .13], [-length * .46, tail], [-length * .53, tail + length * .068], [-length * .39, tail + length * .059], [-length * .24, length * .068]], f.color);
  oval(c, length * .042, 0, length * .35, length * bulk, f.color, '#153443', 2);
  oval(c, length * .09, length * bulk * .42, length * .26, length * bulk * .47, '#dcf2d3');
  poly(c, [[-length * .10, length * .04], [-length * .19, length * .20], [length * .04, length * .07]], '#4b8695');
  if (id === 7) poly(c, [[length * .32, -length * .045], [length * .61, -length * .062], [length * .34, 0]], '#f5e3b1');
  if (id === 2 || id === 8) poly(c, [[-length * .10, -length * .07], [-length * .04, -length * .29], [length * .018, -length * .08]], '#284551');
  if (id === 2) oval(c, length * .10, -length * .045, length * .065, length * .029, '#fff0d2');
  oval(c, length * .285, -length * .026, length * .012, length * .012, '#1b2437');
  c.restore();
}
function contour(c, r, s, t) {
  c.fillStyle = gradient(c, r.y, r.y + r.h, [[0, '#175666'], [.60, '#123c4f'], [1, '#18263c']]);
  c.fillRect(r.x, r.y, r.w, r.h);
  for (let i = 0; i < 18; i++) {
    const pts = [];
    for (let j = -1; j <= 27; j++) {
      const x = j / 26,
        y = .1 + i * .052 + .065 * Math.sin(x * 9 + i * .21 + s.region.id) + .037 * Math.sin(x * 20 + i * .7) + .025 * Math.sin(t * .13 + i * .37);
      pts.push(project(r, x, y));
    }
    line(c, pts, i % 4 === 0 ? '#4b9e9b80' : '#52969a47', i % 4 === 0 ? 1.55 : .85);
  }
  for (let k = 1; k < 10; k++) {
    const x = r.x + r.w * k / 10;
    line(c, [[x, r.y], [x, r.y + r.h]], '#aaf7d916', 1);
  }
  for (let k = 1; k < 7; k++) {
    const y = r.y + r.h * k / 7;
    line(c, [[r.x, y], [r.x + r.w, y]], '#aaf7d916', 1);
  }
  if (s.region.id >= 3) {
    const y = r.y + r.h * (.37 + .10 * Math.sin(s.region.id));
    const a = [];
    for (let i = 0; i < 26; i++) {
      const u = i / 25;
      a.push([r.x + r.w * u, y + Math.sin(u * 12 + t * .17) * 5]);
    }
    line(c, a, ['#e6cb926e', '#9acaeb85', '#9e9cdf85'][s.receiver.depth], 4);
  }
  for (let k = 0; k < 15; k++) {
    const u = (k * 67 + t * (3 + k % 3)) % 480 / 480,
      v = .76 + .055 * Math.sin(k * 3.1 + t * .4);
    const x = r.x + u * r.w,
      y = r.y + v * r.h;
    line(c, [[x - 3, y - 1], [x, y + 1.6], [x + 4, y]], '#91bfc181', 1);
  }
  const plants = [.012, .041, .068, .88, .93, .97];
  plants.forEach((x, i) => {
    const points = [];
    for (let j = 0; j < 6; j++) points.push(project(r, x + .008 * Math.sin(t * .7 + j * .7 + i), 1 - j * (.012 + .004 * (i % 4))));
    line(c, points, '#378d818d', 3);
  });
  for (let k = 0; k < 22; k++) {
    const x = r.x + k * 97.123 % r.w,
      y = r.y + r.h - (k * 28 + t * (3 + k % 4)) % r.h;
    oval(c, x + Math.sin(k + t * .3) * 2, y, 1.4, 1.4, '#b0f4da95');
  }
}
function ray(c, r, origin, angle, dist, color, width, dash = false) {
  const [x, y] = project(r, origin.x, origin.y),
    [tx, ty] = project(r, origin.x + dist * Math.cos(angle), origin.y + dist * Math.sin(angle));
  c.save();
  if (dash) c.setLineDash([6, 6]);
  line(c, [[x, y], [tx, ty]], color, width);
  c.restore();
}
function trace(c, x, y, w, h, fish, t, color) {
  const pts = [];
  for (let i = 0; i <= 70; i++) {
    const u = i / 70,
      b = u * 1.6;
    let curve = 0;
    for (let k = 0; k < fish.beats.length; k++) {
      const v = b - fish.beats[k];
      if (v < 0 || v > .42) continue;
      curve += Math.sin(v * 46 * fish.notes[k] + t) * Math.exp(-v * 6) * .53;
    }
    pts.push([x + u * w, y + h * .54 - curve * h * .66]);
  }
  line(c, pts, color, 2);
}
function display(c, s, l, t, list) {
  const {
    side: r,
    wide
  } = l;
  panel(c, r.x, r.y, r.w, r.h, INK, 9);
  const fish = SPECIES[s.tuned],
    wanted = SPECIES[s.request];
  const big = wide && r.h > 220,
    left = r.x + 11,
    top = r.y + 14,
    chipW = r.w - 22;
  text(c, 'HYDROPHONE  /  ' + DEPTH[s.receiver.depth].toUpperCase(), left, top, Math.min(16, r.w * .055), 'left', paper, 'AK Mono');
  if (big) {
    const size = Math.min(r.h * .23, r.w * .44),
      ox = r.x + r.w * .35,
      oy = r.y + r.h * .26;
    const gauge = Math.min(r.w * .25, r.h * .145),
      o = list.find(a => a.species === s.tuned);
    oval(c, ox, oy, gauge, gauge, '#153c4c', '#83bbaf', 2);
    oval(c, ox, oy, gauge * .66, gauge * .66, null, '#739b9555', 1);
    for (let tick = 0; tick < 24; tick++) {
      const a = tick * Math.PI / 12,
        inner = tick % 3 === 0 ? .81 : .90;
      line(c, [[ox + Math.cos(a) * gauge * inner, oy + Math.sin(a) * gauge * inner], [ox + Math.cos(a) * gauge * .98, oy + Math.sin(a) * gauge * .98]], '#a9e4cb', tick % 3 === 0 ? 2 : 1);
    }
    line(c, [[ox, oy], [ox + Math.cos(o.theta) * gauge * .82, oy + Math.sin(o.theta) * gauge * .82]], SPECIES[s.tuned].color, 3);
    oval(c, ox, oy, 4, 4, '#ffe6a5');
    text(c, 'BEARING', ox, oy + gauge + 11, 12, 'center', '#8cbfb3', 'AK Mono');
    diver(c, r.x + r.w * .74 - size * .5, oy - size * .53, size, size);
    const base = r.y + r.h * .52;
    text(c, 'REQUESTED SONG', left, base - 16, 12, 'left', '#9cbaba', 'AK Mono');
    text(c, wanted.title, left, base + 3, Math.min(21, r.w * .07), 'left', paper, 'AK Display');
    const rowH = Math.min(46, r.h * .073);
    s.contacts.forEach((id, i) => {
      const f = SPECIES[id],
        y = base + 34 + i * rowH;
      panel(c, left - 2, y - 12, chipW + 4, rowH - 5, id === s.tuned ? '#214657' : '#172e42', 4);
      text(c, (id === s.tuned ? '◆ ' : '· ') + f.name, left + 5, y + 2, 13, 'left', id === s.tuned ? f.color : '#a4b9bf');
      trace(c, left + chipW * .48, y - 7, chipW * .48, 22, f, t * 2, f.color);
    });
    if (s.contacts.length < 3) {
      const top = base + rowH * s.contacts.length + 33,
        gh = Math.max(10, Math.min(73, r.y + r.h - 46 - top));
      for (let j = 0; j < 4; j++) line(c, [[left, top + gh * j / 3], [left + chipW, top + gh * j / 3]], '#66888755', 1);
      for (let j = 0; j <= 12; j++) {
        const x = left + j * chipW / 12;
        line(c, [[x, top], [x, top + gh]], '#66888755', 1);
      }
      trace(c, left, top, chipW, gh, fish, t * 2, fish.color);
    }
    const cue = list.find(o => o.species === s.tuned);
    text(c, cue.layers === 0 ? 'CLEAR AT THIS DEPTH' : cue.layers > 0 ? 'MUFFLED • TRY DEEPER' : 'MUFFLED • TRY SHALLOWER', left, r.y + r.h - 16, 12, 'left', '#e4e9ca');
  } else {
    text(c, fish.name + ' · ' + fish.shape, left, top + 22, Math.min(15, r.w * .04), 'left', fish.color);
    const cue = list.find(o => o.species === s.tuned);
    const status = cue.layers > 0 ? 'Go deeper' : cue.layers < 0 ? 'Go shallower' : 'Clear depth';
    text(c, status, left, Math.min(r.y + r.h - 12, top + 43), 12, 'left', '#b2c6be');
    trace(c, r.x + r.w * .62, r.y + 9, r.w * .33, r.h * .65, fish, t * 2, fish.color);
  }
}
export function paint(c, s, w = 480, h = 480, reduced = false, book = null) {
  const l = layout(w, h),
    r = l.chart,
    t = reduced ? 0 : s.time,
    song = SPECIES[s.request],
    list = observations(s);
  c.fillStyle = '#d9d8bb';
  c.fillRect(0, 0, w, h);
  panel(c, 0, 0, w, l.head, INK, 0);
  text(c, 'ABYSS FM', l.margin, l.head * .34, Math.min(26, w * .061), 'left', mint, 'AK Display');
  text(c, s.shift.name, l.margin, l.head * .76, Math.min(14, w * .037), 'left', paper);
  const count = s.mode === 'night' ? Math.ceil(s.battery) + 's  •  ' + s.total + ' LOGGED' : s.part + '/' + s.shift.quota + '  FILED';
  text(c, count, w - l.margin, l.head * .52, Math.min(17, w * .034), 'right', paper, 'AK Mono');
  c.save();
  c.beginPath();
  c.roundRect(r.x, r.y, r.w, r.h, 8);
  c.clip();
  contour(c, r, s, t);
  for (const [i, p] of s.samples.entries()) {
    const col = SPECIES[p.species].color,
      [x, y] = project(r, p.x, p.y),
      age = s.age - p.time;
    ray(c, r, p, p.theta, 1.6, col, p.weak ? 1.35 : 2.1, p.weak);
    oval(c, x, y, 6, 6, INK, col, 2);
    text(c, String.fromCharCode(65 + i), x + 8, y - 10, 12, 'left', col, 'AK Mono');
    if (age < 1.4 && !reduced) oval(c, x, y, Math.max(2, age * r.w * .22), Math.max(2, age * r.h * .22), null, col + '77', 2);
  }
  const active = list.find(o => o.species === s.tuned);
  ray(c, r, s.receiver, active.theta, .19, active.layers ? '#d0bd966d' : '#b9ffe2ad', 3, true);
  const f = bestFix(s.samples.filter(p => p.depth === s.receiver.depth), s.tuned);
  if (f) {
    const [x, y] = project(r, f.x, f.y),
      rx = (.033 + .014 * (1 - f.quality) + Math.min(.04, (s.age - f.age) * .002)) * r.w;
    oval(c, x, y, rx, rx * r.h / r.w, '#ffe69216', '#ffe698b0', 1.4);
  }
  if (s.phase === 'found') {
    const q = s.archive.at(-1);
    const [x, y] = project(r, s.cursor.x, s.cursor.y),
      size = Math.min(r.w * .37, r.h * .47);
    c.save();
    c.translate(x, y);
    c.rotate(reduced ? 0 : Math.sin(t * 3) * .045);
    recovered(c, q.species, 0, 0, size, t);
    c.restore();
    text(c, SPECIES[q.species].name.toUpperCase(), x, Math.max(r.y + 15, y - size * .34), 16, 'center', paper, 'AK Display');
  } else {
    const [x, y] = project(r, s.cursor.x, s.cursor.y);
    const z = Math.min(78, Math.max(36, r.h * .20)),
      off = x > r.x + r.w * .76 ? -1 : 1,
      dx = clamp(x + off * z * .65, r.x + z / 2, r.x + r.w - z / 2),
      dy = clamp(y - z * .51, r.y + z * .49, r.y + r.h - z * .5);
    line(c, [[dx, dy], [x + off * 9, y + 6], [x, y]], '#f4d59d', 1.6);
    diver(c, dx - z * .5, dy - z * .53 + Math.sin(t * 1.7) * 2, z, z);
    oval(c, x, y, 11, 11, null, '#ffefc9', 2);
    line(c, [[x - 15, y], [x - 6, y]], paper, 2);
    line(c, [[x + 6, y], [x + 15, y]], paper, 2);
    line(c, [[x, y - 15], [x, y - 6]], paper, 2);
    line(c, [[x, y + 6], [x, y + 15]], paper, 2);
  }
  c.restore();
  panel(c, r.x + 6, r.y + 6, Math.min(r.w - 12, 240), 29, '#101c2dde', 4);
  text(c, 'FIND  ' + song.name.toUpperCase() + '  ·  ' + s.budget + ' PINGS', r.x + 13, r.y + 21, Math.min(14, r.w * .035), 'left', paper, 'AK Mono');
  display(c, s, l, t, list);
  if (book) {
    const id = book.ids[book.i] ?? s.request,
      f = SPECIES[id],
      x = w * .10,
      y = h * .18,
      bw = w * .80,
      bh = h * .62;
    panel(c, x + 3, y + 5, bw, bh, INK, 12);
    panel(c, x, y, bw, bh, '#f8e9cb', 12);
    text(c, 'FIELD RECORDINGS', x + 16, y + 23, Math.min(23, bw * .073), 'left', INK, 'AK Display');
    text(c, book.ids.length ? f.name : 'No voices filed yet', x + 16, y + bh * .36, Math.min(27, bw * .09), 'left', '#345863', 'AK Display');
    text(c, book.ids.length ? f.title + ' · ' + f.shape : 'Make your first fix to save a recording.', x + 16, y + bh * .53, Math.min(16, bw * .042), 'left', INK);
    if (book.ids.length) {
      trace(c, x + 16, y + bh * .62, bw - 32, bh * .17, f, t * 2, '#387b80');
      text(c, 'Recording ' + (book.i + 1) + ' of ' + book.ids.length, x + 16, y + bh - 16, 12, 'left', INK, 'AK Mono');
    }
  }
}
