import { CABINS, STATIONS, REPERTOIRE, voices } from './repertoire.js';
import { panel, poly, oval, line, gradient, sprite } from '../kit/field-art.js';
import { layout } from './layout.js';
const conduct = sprite(new URL('./agi.webp', import.meta.url));
const INK = '#25243d';
function label(c, txt, x, y, size, align = 'center', fill = INK, font = 'AK Display') {
  c.font = '800 ' + Math.max(12, size) + 'px "' + font + '", system-ui';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = fill;
  c.fillText(txt, x, y);
}
function fir(c, x, y, height, tone) {
  poly(c, [[x, y - height], [x - height * .27, y - height * .31], [x - height * .13, y - height * .33], [x - height * .38, y], [x + height * .34, y], [x + height * .13, y - height * .34], [x + height * .24, y - height * .32]], tone);
}
function mountains(c, l, s, time) {
  const {
      w,
      h
    } = l,
    station = STATIONS[s.sheet.station],
    sunX = w * (.73 - .014 * station.root % .12);
  c.fillStyle = gradient(c, 0, h, [[0, s.sheet.station >= 6 ? '#80a0c4' : '#82bacc'], [.63, '#fbdea7'], [1, '#a9bba1']]);
  c.fillRect(0, 0, w, h);
  oval(c, sunX, h * .20, h * .096, h * .096, '#ffedac');
  const banks = [['#959da9', .53, .23], ['#718c91', .63, .28], ['#486f70', .77, .22]];
  banks.forEach(([color, base, amplitude], layer) => {
    const points = [[-25, h + 2]];
    const count = l.wide ? 11 : 7;
    const skyline = [];
    for (let i = -1; i <= count + 1; i++) {
      const x = i * w / count + Math.sin(i * 2.13 + layer) * w * .025 + Math.sin(time * .10 + layer) * 3;
      const peak = base - amplitude * (i % 2 === 0 ? .15 : .7 + .28 * Math.sin(i * 3.37 + layer + s.sheet.station));
      const y = h * peak;
      skyline.push([x, y]);
      points.push([x, y]);
    }
    points.push([w + 25, h + 2]);
    poly(c, points, color);
    for (let i = 1; i < skyline.length - 1; i++) {
      const [x, y] = skyline[i],
        [bx, by] = skyline[i + 1];
      if (y >= by) continue;
      poly(c, [[x, y], [bx, by], [x + w * .037, h * (base + .042)], [x + w * .006, y + h * .043]], ['#778c9c', '#53787e', '#3b6064'][layer]);
      if (i % 2) line(c, [[x + w * .014, y + h * .035], [x + w * .028, y + h * .066], [x + w * .041, y + h * .083]], '#fff0cb55', 1.6);
    }
    if (layer < 2) for (let i = 2; i < skyline.length - 1; i += 2) {
      const [x, y] = skyline[i],
        [ax, ay] = skyline[i - 1],
        [bx, by] = skyline[i + 1];
      if (y >= ay || y >= by) continue;
      poly(c, [[x + (ax - x) * .54, y + (ay - y) * .54], [x, y], [x + (bx - x) * .55, y + (by - y) * .55], [x + (bx - x) * .24, y + (by - y) * .28 + 4], [x + 2, y + 5], [x + (ax - x) * .32, y + (ay - y) * .38]], '#fff0ce');
    }
  });
  for (let i = 0; i < 45; i++) {
    const x = i * 83.17 % w,
      y = h * (.70 + .08 * Math.sin(i * .33));
    fir(c, x, y, 8 + i * 11 % 24, '#365b59');
  }
  poly(c, [[0, h * .82], [w * .26, h * .69], [w * .66, h * .85], [w, h * .70], [w, h], [0, h]], '#6c9c83');
  for (let i = 0; i < 18; i++) {
    const x = i * 109 % w,
      y = h * (.84 + .042 * Math.sin(i * 4.2));
    const a = Math.min(13, w * .021);
    panel(c, x, y, a * 1.7, a, '#f6d58e', 1);
    poly(c, [[x - 2, y], [x + a * .7, y - a * .6], [x + a * 1.7 + 2, y]], '#a64b49');
    panel(c, x + a * .68, y + a * .41, a * .33, a * .58, '#6c5e55', 1);
    panel(c, x + a * .19, y + a * .3, a * .23, a * .27, '#557884', 1);
  }
  for (let i = 0; i < 14; i++) {
    const x = (i * 107 + 15) % w;
    fir(c, x, h * .98, 17 + i * 19 % 44, '#274e4f');
  }
}
function gondola(c, p, size, id, glow, time, reduced) {
  const col = CABINS[id].color;
  c.save();
  c.translate(p.x, p.y);
  c.rotate(reduced ? 0 : Math.sin(time * 1.7 + id) * .028 + glow * Math.sin(time * 9 + id) * .036);
  const a = size * .46,
    b = size * .35;
  if (glow > .05) {
    c.save();
    c.globalAlpha = glow * .48;
    oval(c, 0, 0, a * 1.4, b * 1.65, '#fff3a7');
    c.restore();
  }
  line(c, [[0, -b * 1.80], [-1, -b * 1.22], [a * .22, -b * .91]], INK, Math.max(2, size * .065));
  oval(c, 0, -b * 1.79, size * .072, size * .072, '#f5df9a', INK, 2);
  panel(c, -a + 2, -b + 4, a * 2, b * 2.30, INK, a * .30);
  panel(c, -a, -b, a * 2, b * 2.25, INK, a * .32);
  panel(c, -a + 2, -b + 2, a * 2 - 4, b * 2.25 - 5, glow > .4 ? '#fff0aa' : col, a * .29);
  panel(c, -a * .83, -b * .76, a * 1.66, b * .83, INK, 3);
  panel(c, -a * .75, -b * .66, a * 1.5, b * .63, '#a8e1db', 2);
  poly(c, [[-a * .68, -b * .64], [-a * .19, -b * .64], [-a * .51, -b * .09], [-a * .74, -b * .09]], '#eff6dc');
  line(c, [[0, -b * .72], [0, -b * .04]], INK, size * .039);
  label(c, CABINS[id].shape + ' ' + CABINS[id].note.toUpperCase(), 0, b * .62, Math.min(20, size * .23));
  if (glow > .28) label(c, '♪', a + 8, -b - 7 - glow * 5, Math.max(16, size * .32), 'left', '#fff2af');
  c.restore();
}
export function paint(c, s, w, h, reduced = false, shelf = null) {
  const l = layout(w, h),
    t = reduced ? 0 : s.elapsed;
  mountains(c, l, s, t);
  const cables = l.positions.map(p => [p.x, p.y - l.cabin * .63]);
  line(c, [[-40, cables[0][1] + 7], ...cables, [w + 15, cables[3][1] - 14]], INK, 4);
  line(c, [[-40, cables[0][1] + 2], ...cables.map(([x, y]) => [x, y - 4]), [w + 15, cables[3][1] - 19]], '#efe5cd', 1.4);
  l.positions.forEach((p, id) => gondola(c, p, l.cabin, id, s.glow[id], t, reduced));
  const ringing = voices(s.lastMask);
  if (ringing.length > 1 && s.phase === 'listen' && Math.max(...s.glow) > .24) {
    const a = l.positions[ringing[0]],
      b = l.positions[ringing.at(-1)],
      v = Math.max(...s.glow);
    const pts = Array.from({
      length: 18
    }, (_, j) => {
      const n = j / 17;
      return [a.x + (b.x - a.x) * n, a.y + (b.y - a.y) * n - Math.sin(n * Math.PI) * (l.cabin * .88 + 8 * v)];
    });
    line(c, pts, '#ffe281', 3);
    for (let j = 1; j < pts.length - 1; j += 4) oval(c, ...pts[j], 3, 3, '#fff4bd');
  }
  const textH = l.header * .76,
    age = s.phase === 'applause' ? Math.sin(Math.min(1, s.age / .8) * Math.PI) : 0;
  panel(c, 10, 8, w - 20, textH, INK, 7);
  label(c, s.sheet.title, 20, 8 + textH / 2, Math.min(24, w * .044), 'left', '#fff0cd');
  label(c, s.mode === 'climb' ? 'CLIMB ' + (s.round + 1) : 'STN ' + (s.sheet.station + 1), w - 22, 8 + textH / 2, Math.min(16, w * .032), 'right', '#bdeada', 'AK Mono');
  const actor = l.conductor,
    glow = Math.max(...s.glow);
  c.save();
  c.translate(actor.x, actor.y);
  c.rotate(reduced ? 0 : s.phase === 'applause' ? -.08 * age : .025 * (voices(s.lastMask)[0] ?? 0) - .026);
  conduct(c, -actor.size * .5, -actor.size + (reduced ? 0 : Math.sin(t * 2.6) * 2) - glow * 2, actor.size, actor.size);
  c.restore();
  const boxX = Math.max(l.conductor.x + l.conductor.size * .43, w * .32),
    boxW = w - boxX - 12,
    boxY = Math.min(h - 53, Math.max(l.scoreY - 5, h * .65)),
    boxH = Math.min(h - boxY - 6, Math.max(51, h * .22));
  panel(c, boxX + 2, boxY + 3, boxW, boxH, INK, 6);
  panel(c, boxX, boxY, boxW, boxH, '#fff0ce', 6);
  const heading = {
    listen: 'WATCH HER BATON',
    echo: 'YOUR ECHO',
    retry: 'REHEARSAL',
    applause: 'BRAVO!',
    over: 'CURTAIN'
  }[s.phase];
  label(c, heading, boxX + 9, boxY + 15, Math.min(17, boxW * .072), 'left', s.phase === 'echo' ? '#286862' : '#804c42', 'AK Sans');
  label(c, (s.phase === 'listen' ? s.shown : s.cursor) + ' / ' + s.melody.length, boxX + boxW - 10, boxY + 15, 12, 'right', '#636356', 'AK Mono');
  const count = s.melody.length,
    max = Math.max(4, Math.floor((boxW - 18) / 19)),
    start = Math.max(0, Math.min(count - max, (s.phase === 'listen' ? s.shown : s.cursor) - max + 1)),
    n = Math.min(count, max);
  const left = boxX + 15,
    right = boxX + boxW - 14,
    staff = boxY + boxH * .64,
    space = Math.min(7, boxH * .065);
  for (let j = -2; j <= 2; j++) line(c, [[left, staff + j * space], [right, staff + j * space]], '#8b856f75', .9);
  line(c, [[right, staff - 2 * space], [right, staff + 2 * space]], '#7b725f', 2);
  if (boxW > 400) label(c, '♫', left + 10, staff, 27, 'left', '#938369');
  const offset = boxW > 400 ? 37 : 6,
    slot = (right - left - offset) / Math.max(n, 4);
  for (let i = 0; i < n; i++) {
    const k = i + start,
      x = left + offset + (i + .5) * slot,
      y = staff;
    const mask = s.melody[k];
    const visible = s.phase === 'listen' ? s.shown === k + 1 || s.sheet.station === 0 && k < s.shown : k < s.cursor || s.phase === 'applause';
    if (visible) {
      const note = voices(mask);
      for (const n of note) {
        const ny = y + (1.5 - n) * space;
        oval(c, x, ny, Math.max(5, space * 1.16), Math.max(3.7, space * .78), CABINS[n].color, INK, 1.3);
        line(c, [[x + space, ny], [x + space, ny - 2.5 * space]], INK, 1.5);
      }
    } else {
      oval(c, x, y, k === s.cursor && s.phase === 'echo' ? 5 : 3, k === s.cursor && s.phase === 'echo' ? 5 : 3, '#b4a992');
    }
  }
  if (shelf) {
    const piece = REPERTOIRE[shelf.ids[shelf.i]],
      x = w * .10,
      y = h * .19,
      bw = w * .80,
      bh = h * .58;
    panel(c, x + 4, y + 5, bw, bh, INK, 9);
    panel(c, x, y, bw, bh, '#fff0ca', 9);
    label(c, 'THE CABLE SONGBOOK', x + 14, y + 22, Math.min(21, bw * .069), 'left', '#9f5147');
    label(c, piece.title, x + 14, y + bh * .39, Math.min(27, bw * .089), 'left', INK);
    label(c, STATIONS[piece.station].name + ' · refrain', x + 14, y + bh * .57, 14, 'left', '#3a6669');
    piece.notes.slice(0, 8).forEach((n, i) => {
      const dx = x + 19 + i * (bw - 39) / 8;
      oval(c, dx, y + bh * .75, 5, 5, CABINS[n].color, INK, 1.3);
    });
    label(c, 'PAGE ' + (shelf.i + 1) + ' / ' + shelf.ids.length, x + 14, y + bh - 15, 12, 'left', INK, 'AK Mono');
  }
  if (s.pendingChord) label(c, 'CHORD ' + s.pendingChord, boxX + 8, boxY - 10, 12, 'left', '#fff3c7', 'AK Mono');
}
