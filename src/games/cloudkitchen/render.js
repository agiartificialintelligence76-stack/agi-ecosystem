import { sprite } from '../kit/field-art.js';
import { RECIPES, DAYS, BASES, baseColor, GUESTS } from './menu.js';
import { cupCount, ticketBy, recipe, sealPhase, clamp } from './counter.js';
const portrait = sprite(new URL('/memes/previews/agi-cooking.webp', import.meta.url));
const ink = '#45313d',
  vanilla = '#fff1d4',
  mint = '#90ceb7',
  pink = '#e5798c',
  tea = '#b66f49',
  gold = '#efbf65';
const shirts = ['#dd8796', '#70afa8', '#a492c9', '#efae6b', '#8eb18c', '#6d91b1'];
function stroke(c, points, col = ink, width = 2) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = col;
  c.lineWidth = width;
  c.lineJoin = c.lineCap = 'round';
  c.stroke();
}
function inkShape(c, pts, fill, border = ink, weight = 2) {
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (border) {
    c.strokeStyle = border;
    c.lineWidth = weight;
    c.stroke();
  }
}
function box(c, x, y, w, h, r, fill, border = ink, weight = 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (border) {
    c.strokeStyle = border;
    c.lineWidth = weight;
    c.stroke();
  }
}
function disc(c, x, y, rx, ry, fill, border, width = 1.5) {
  c.beginPath();
  c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (border) {
    c.strokeStyle = border;
    c.lineWidth = width;
    c.stroke();
  }
}
function text(c, s, x, y, px, col = ink, align = 'left', weight = 850, max = 1e5) {
  c.font = weight + ' ' + px + 'px "AK Sans",system-ui';
  c.fillStyle = col;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, y, max);
}
function star(c, x, y, r, col) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5,
      rr = i % 2 ? r * .49 : r;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  inkShape(c, pts, col, ink, 1);
}
function face(c, x, y, r, index, watch = 0) {
  c.save();
  c.translate(x, y);
  const hair = ['#59404f', '#694343', '#535053', '#a36549'];
  const skin = ['#e9ad88', '#b97f69', '#ecc69e', '#ca947c'];
  disc(c, 0, 1, r, r, skin[index % 4], ink, 1.6);
  c.beginPath();
  c.arc(0, -1, r, Math.PI * .96, Math.PI * 2 + .08);
  c.quadraticCurveTo(r * .58, -r * .73, r * .26, -r * .27);
  c.quadraticCurveTo(0, -r * .57, -r * .26, -r * .20);
  c.closePath();
  c.fillStyle = hair[index % 4];
  c.fill();
  for (const xx of [-.36, .36]) disc(c, r * xx + watch * r * .08, r * .10, r * .085, r * .12, ink);
  c.beginPath();
  c.arc(0, r * .20, r * .23, .22, Math.PI - .20);
  c.lineWidth = Math.max(1, r * .10);
  c.strokeStyle = ink;
  c.stroke();
  if (index % 3 === 1) {
    for (const xx of [-.34, .34]) disc(c, xx * r, r * .12, r * .25, r * .21, null, ink, 1);
  }
  c.restore();
}
export function layout(s, w, h) {
  const compact = w < 580,
    header = compact ? 82 : 89,
    base = h - (compact ? 76 : 66),
    slots = cupCount(s),
    available = Math.max(110, base - header);
  const unit = Math.max(40, Math.min(compact ? 115 : 169, available * .385, w / (slots === 2 ? 3.08 : 2.80)));
  const xs = slots === 1 ? [w * (compact ? .62 : .65)] : [w * (compact ? .29 : .44), w * (compact ? .72 : .72)];
  const chefX = slots === 1 ? w * .26 : compact ? w * .50 : w * .21;
  const ticketW = compact ? Math.max(140, w * .62) : Math.min(282, w * .30),
    vis = compact ? 2 : Math.min(4, Math.max(2, Math.floor(w / (ticketW + 7))));
  return {
    compact,
    header,
    base,
    unit,
    xs,
    slots,
    chefX,
    ticketW,
    vis,
    w,
    h
  };
}
function backdrop(c, g, s, tm) {
  const {
      w,
      h,
      base,
      header
    } = g,
    wall = c.createLinearGradient(0, header, 0, base);
  wall.addColorStop(0, '#d9eee0');
  wall.addColorStop(1, '#a8cec1');
  c.fillStyle = wall;
  c.fillRect(0, 0, w, h);
  for (let yy = header * .70; yy < base; yy += 30) {
    stroke(c, [[0, yy], [w, yy]], '#80b6a690', 1.4);
    for (let xx = Math.floor(yy / 30) % 2 * 29; xx < w; xx += 58) stroke(c, [[xx, yy], [xx, yy + 30]], '#8ebcaf90', 1.2);
  }
  const winW = Math.max(85, w * .32),
    winH = Math.max(59, (base - header) * .42),
    wx = w * .04,
    wy = header + 9;
  box(c, wx, wy, winW, winH, 12, '#b3927e', ink, 2);
  box(c, wx + 5, wy + 5, winW - 10, winH - 10, 9, s.day >= 6 ? '#b2abc5' : s.day === 1 ? '#adcad4' : '#c6e7df', ink, 1.2);
  c.save();
  c.beginPath();
  c.roundRect(wx + 6, wy + 6, winW - 12, winH - 12, 8);
  c.clip();
  for (let i = 0; i < 6; i++) {
    const xx = wx + i * winW / 5.5,
      hh = winH * (.20 + i % 3 * .077);
    box(c, xx, wy + winH - hh, winW * .17, hh, 1, '#91b1aa', null);
    inkShape(c, [[xx - 2, wy + winH - hh], [xx + winW * .045, wy + winH - hh - 7], [xx + winW * .14, wy + winH - hh - 7], [xx + winW * .18, wy + winH - hh]], '#cf9185', null);
  }
  if (s.day === 1) for (let i = 0; i < 12; i++) {
    const xx = wx + 6 + i * 31 % winW,
      yy = wy + (i * 11 + tm * 24) % winH;
    stroke(c, [[xx, yy], [xx - 4, yy + 8]], '#fff9d7', 1);
  }
  c.restore();
  stroke(c, [[wx + winW * .54, wy + 5], [wx + winW * .54, wy + winH - 5]], '#977e6b', 3);
  const shelfX = w * .73,
    shelfY = header + (base - header) * .32,
    js = Math.min(1.5, w / 640);
  for (let i = 0; i < 3; i++) {
    const x = shelfX + i * 28 * js;
    box(c, x, shelfY - 27 * js, 21 * js, 27 * js, 4, ['#e8bf86', '#d79ba0', '#abc7a2'][i], ink, 1.2);
    box(c, x - 1, shelfY - 29 * js, 23 * js, 5 * js, 2, '#b0796b', ink, 1);
    for (let a = 0; a < 5; a++) disc(c, x + (4 + a * 7 % 13) * js, shelfY - (4 + a % 3 * 5) * js, 1.7 * js, 1.7 * js, ink);
  }
  stroke(c, [[shelfX - 6, shelfY + 2], [w - 9, shelfY + 2]], '#8b6a60', 4);
  // Scalloped shop canvas and biscuit-colored wood counter.
  const aw = Math.max(16, Math.min(34, w / 15));
  for (let i = 0; i < w / aw + 1; i++) box(c, i * aw, -4, aw + 1, 19, [0, 0, 7, 7], i % 2 ? '#fff0cc' : '#e58f93', ink, 1);
  const top = base - g.unit * .25;
  inkShape(c, [[0, top], [w, top - 8], [w, base + 14], [0, base + 17]], '#efc797', '#9a735e', 2);
  box(c, 0, base + 14, w, h - base, 0, '#bd8f77', null);
  for (let x = 0; x < w; x += 53) stroke(c, [[x, base + 17], [x + 6, h]], '#a27d70', 1.2);
}
function chef(c, g, s, v) {
  const size = Math.min(g.unit / 121, (g.base - g.header) * .83 / 236),
    x = g.chefX,
    y = g.base - 2,
    busy = s.held.size || s.cups[s.active].latch;
  const tm = v.reduced ? 0 : v.time,
    beat = busy && !v.reduced ? Math.sin(tm * 7) : Math.sin(tm * 2) * .18;
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  c.rotate(beat * .013);
  c.translate(-128, -237);
  function fragment(points, hinge, turn) {
    c.save();
    if (hinge) {
      c.translate(...hinge);
      c.rotate(turn);
      c.translate(-hinge[0], -hinge[1]);
    }
    c.beginPath();
    points.forEach(([xx, yy], i) => i ? c.lineTo(xx, yy) : c.moveTo(xx, yy));
    c.closePath();
    c.clip();
    portrait(c, 0, 0, 260, 260);
    c.restore();
  }
  // Articulated cook: her real hair, blouse and hat form the torso. The original two arms
  // pivot separately at their sleeves; the spoon follows the shaker rhythm.
  const torso = [[98, 0], [90, 7], [85, 20], [89, 29], [99, 37], [89, 52], [86, 64], [80, 73], [88, 72], [80, 89], [66, 101], [69, 105], [57, 120], [51, 137], [49, 151], [57, 142], [67, 131], [61, 138], [78, 150], [82, 152], [81, 171], [75, 191], [69, 201], [73, 212], [83, 202], [85, 225], [174, 225], [171, 204], [179, 182], [177, 161], [190, 155], [196, 149], [205, 164], [212, 177], [213, 169], [207, 151], [199, 131], [189, 113], [197, 121], [195, 112], [185, 99], [175, 82], [176, 68], [168, 54], [161, 41], [176, 36], [180, 27], [177, 13], [167, 0]];
  fragment(torso, null, 0);
  const armL = [[62, 136], [78, 145], [83, 151], [89, 162], [99, 180], [95, 187], [87, 183], [80, 176], [74, 180], [66, 178], [55, 187], [45, 188], [40, 184], [43, 174], [49, 164], [55, 150]];
  const armR = [[176, 158], [192, 151], [198, 161], [205, 179], [210, 187], [214, 196], [212, 203], [203, 204], [198, 208], [192, 209], [187, 216], [181, 214], [176, 207], [179, 198], [185, 188]];
  fragment(armL, [66, 140], beat * .09);
  fragment(armR, [184, 156], -beat * .055);
  stroke(c, [[88 + beat * 2, 173], [100 + beat * 4, 203]], '#8d5637', 3.5);
  c.save();
  c.translate(0, v.seal > 0 ? -Math.sin(v.seal * 9) * 2 : 0);
  fragment([[79, 198], [90, 196], [163, 196], [168, 199], [177, 198], [178, 205], [168, 207], [167, 239], [163, 247], [87, 249], [77, 245], [78, 209], [74, 207], [76, 199]], null, 0);
  c.restore();
  for (let j = 0; j < 3; j++) {
    const a = (tm * .65 + j * .34) % 1;
    c.save();
    c.globalAlpha = .64 * (1 - a);
    stroke(c, [[102 + j * 15, 193 - a * 11], [99 + j * 15, 185 - a * 14], [104 + j * 15, 179 - a * 16]], '#fff0ce', 1.5);
    c.restore();
  }
  c.restore();
}
function cup(c, g, s, i, v) {
  const cup = s.cups[i],
    rec = recipe(s, i),
    x = g.xs[i],
    u = g.unit,
    b = g.base;
  const active = i === s.active;
  c.save();
  c.translate(x, b);
  c.scale(u / 100, u / 100);
  const t = v.reduced ? 0 : v.time,
    wiggle = v.reduced ? 0 : cup.foam * Math.sin(t * 19) * 2;
  disc(c, 0, -1, 40, 6, '#926c674a');
  box(c, -48, -3, 96, 6, 2, active ? '#ecb268' : '#b3bcb0', ink, 1.3);
  // Dual brass tap heads are suspended above the rim with distinct tea and milk knobs.
  for (const [k, xx] of [-17, 16].entries()) {
    const cap = k ? '#fff0cc' : baseColor[cup.base];
    stroke(c, [[xx - 5, -122], [xx - 5, -111], [xx, -108], [xx, -98]], ink, 10);
    stroke(c, [[xx - 5, -122], [xx - 5, -111], [xx, -108], [xx, -98]], '#c7a77f', 6);
    box(c, xx - 15, -137, 25, 17, 5, cap, ink, 1.8);
    disc(c, xx - 4, -119, 5, 3, '#b8876b', ink, 1.2);
    if (cup.flow[k] > .05) {
      const y = -9 - (cup.tea + cup.milk) * 9.1;
      stroke(c, [[xx, -99], [xx + Math.sin(t * 17 + i) * .7, y]], k ? '#f7e4c1' : cap, 1.8 + cup.flow[k] * 1.3);
    }
  }
  c.translate(wiggle, 0);
  const glass = () => {
    c.beginPath();
    c.moveTo(-33, -85);
    c.lineTo(33, -85);
    c.lineTo(25, -5);
    c.quadraticCurveTo(0, 2, -25, -5);
    c.closePath();
  };
  glass();
  c.fillStyle = '#fffcee82';
  c.fill();
  c.save();
  glass();
  c.clip();
  const teaTop = -5 - cup.tea * 9.2,
    milkTop = teaTop - cup.milk * 9.2,
    swish = (cup.flow[0] + cup.flow[1] + cup.foam) * 1.15;
  function liquid(y, color, amp) {
    c.beginPath();
    c.moveTo(-39, 2);
    c.lineTo(-39, y);
    for (let j = 0; j <= 15; j++) c.lineTo(-39 + j * 5.2, y + Math.sin(j * .67 + t * 5) * amp);
    c.lineTo(40, 4);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }
  if (cup.milk > .01) liquid(milkTop, '#f4deb8', swish);
  if (cup.tea > .01) liquid(teaTop, baseColor[cup.base], swish * .72);
  if (cup.shake) {
    c.globalAlpha = Math.min(.5, cup.shake * .064);
    liquid(milkTop, baseColor[cup.base], swish);
    c.globalAlpha = 1;
  }
  for (let j = 0; j < cup.pearl * 3; j++) {
    const xx = -20 + j * 17 % 43,
      yy = -7 - 4 * Math.floor(j / 5) + Math.sin(t * 4 + j) * cup.foam * 2;
    disc(c, xx, yy, 3.8, 3.6, '#4e3341', ink, 1);
    disc(c, xx - 1, yy - 1, 1, 1, '#c49699');
  }
  for (let j = 0; j < cup.star; j++) star(c, -13 + j * 12, teaTop + 7 + j % 2 * 4, 6, '#ffd177');
  if (cup.ice) for (let j = 0; j < 2; j++) {
    c.save();
    c.translate(-11 + j * 19, milkTop + 7);
    c.rotate(.23 - j * .5);
    box(c, -5, -4, 10, 9, 2, '#ddf5e6c7', '#90c5c1', 1.1);
    c.restore();
  }
  for (let j = 0; j < 6; j++) {
    const yy = -5 - (t * 10 + j * 13) % Math.max(1, (cup.tea + cup.milk) * 8);
    if (yy < milkTop + 2 || cup.tea + cup.milk < .2) continue;
    disc(c, -20 + j * 8, yy, .85 + j % 2 * .35, .85 + j % 2 * .35, '#fff1c69a');
  }
  c.restore();
  glass();
  c.strokeStyle = active ? '#47323b' : '#7c7570';
  c.lineWidth = 2.6;
  c.stroke();
  stroke(c, [[-26, -77], [-22, -32]], '#fff6de', 2.8);
  for (let n = 1; n <= 7; n++) stroke(c, [[19, -5 - n * 9.2], [n % 2 ? 25 : 28, -5 - n * 9.2]], '#766467', 1.1);
  if (rec) {
    c.setLineDash([3, 3]);
    stroke(c, [[-29, -5 - rec.tea * 9.2], [28, -5 - rec.tea * 9.2]], '#633e54', 1.2);
    if (rec.milk) stroke(c, [[-30, -5 - (rec.tea + rec.milk) * 9.2], [30, -5 - (rec.tea + rec.milk) * 9.2]], '#6b877a', 1.2);
    c.setLineDash([]);
  }
  if (rec && cup.tea + cup.milk > .6) {
    const rim = sealPhase(s, cup);
    disc(c, 0, -85, 33, 3.9, null, rim.ready ? '#43ab83' : '#dc9182', rim.clean ? 3 : 1.5);
  }
  if (v.seal > 0 && i === s.active) {
    const d = 1 - v.seal / .50;
    box(c, -35, -93 + Math.sin(d * Math.PI) * 7, 70, 6, 3, pink, ink, 1.5);
  }
  c.restore();
  const labelY = b + 11,
    sz = g.compact ? 12 : 15;
  text(c, (i ? 'B' : 'A') + ' · ' + BASES[cup.base], x, labelY, sz, ink, 'center', 900, Math.min(g.w / 2 - 12, 210));
  if (rec) text(c, 'T ' + cup.tea.toFixed(1) + ' / ' + rec.tea + '   M ' + cup.milk.toFixed(1) + ' / ' + rec.milk, x, labelY + 15, 12, ink, 'center', 820, Math.min(g.w / 2 - 6, 230));
}
function tickets(c, g, s) {
  const list = [...s.queue].sort((a, b) => Number(b.id === s.focus) - Number(a.id === s.focus));
  const start = 8,
    y = 9,
    hh = g.header - 14;
  for (let i = 0; i < Math.min(g.vis, list.length); i++) {
    const o = list[i],
      r = RECIPES[o.recipe],
      full = !g.compact || i === 0,
      xx = start + i * (g.ticketW + 6),
      ww = Math.min(g.ticketW, g.w - xx - 6);
    if (ww < 42) break;
    box(c, xx + 2, y + 3, ww, hh, 7, '#7b645c', null);
    box(c, xx, y, ww, hh, 7, full ? vanilla : '#ffdfc1', ink, 1.6);
    const ratio = clamp(o.left / o.max, 0, 1);
    box(c, xx + 5, y + hh - 7, ww - 10, 4, 2, '#d8c6af', null);
    box(c, xx + 5, y + hh - 7, Math.max(1, (ww - 10) * ratio), 4, 2, ratio < .25 ? '#d96d79' : '#6fa995', null);
    face(c, xx + 17, y + 17, 10, o.guest, s.active ? .65 : -.65);
    text(c, GUESTS[o.guest] + ' · ' + String(o.id).padStart(2, '0'), xx + 32, y + 13, 12, '#865257', 'left', 820, ww - 39);
    text(c, r.name, xx + 8, y + 30, full ? 16 : 13, ink, 'left', 900, ww - 12);
    if (full) {
      const required = 'T ' + r.tea + '   M ' + r.milk + '    ● ' + r.pearl + '   ★ ' + r.star;
      text(c, required, xx + 8, y + 47, 12, ink, 'left', 800, ww - 14);
    }
    if (!g.compact) text(c, BASES[r.base] + ' · ' + (r.ice ? 'iced' : 'warm') + ' · ' + r.shake + ' shakes', xx + 8, y + 63, 12, '#72595b', 'left', 750, ww - 14);
  }
}
export function ticketHit(s, g, x, y) {
  if (y < 9 || y > g.header - 3) return null;
  const ix = Math.floor((x - 8) / (g.ticketW + 6));
  return ix >= 0 && ix < g.vis ? [...s.queue].sort((a, b) => Number(b.id === s.focus) - Number(a.id === s.focus))[ix]?.id : null;
}
export function paint(c, w, h, s, v) {
  const g = layout(s, w, h);
  c.save();
  backdrop(c, g, s, v.reduced ? 0 : v.time);
  chef(c, g, s, v);
  g.xs.forEach((_, i) => cup(c, g, s, i, v));
  tickets(c, g, s);
  if (s.queue.length === 1) {
    const left = g.ticketW + 19,
      pw = w - left - 7;
    if (pw > 82) {
      box(c, left, 15, pw, 43, 7, '#4b6e67', ink, 1.6);
      text(c, s.mode === 'bench' ? 'RECIPE BENCH' : s.mode === 'endless' ? 'RUSH SHIFT' : 'DAY ' + (s.day + 1), left + 7, 28, 12, vanilla, 'left', 850, pw - 14);
      text(c, s.dayInfo.name, left + 7, 44, 12, '#ffe2ac', 'left', 750, pw - 14);
    }
  }
  if (!s.queue.length) text(c, s.dayInfo.name.toUpperCase() + '   ·   KETTLE WARM', 12, 35, 18, ink);
  const r = recipe(s);
  if (g.compact && r) {
    const y = g.header + 10;
    box(c, 7, y - 8, Math.min(w - 14, 218), 20, 7, '#e6eddaee', '#7ca38f', 1);
    text(c, BASES[r.base] + ' · ' + (r.ice ? 'iced' : 'warm') + ' · ' + r.shake + ' shakes', 14, y + 2, 12, ink);
  }
  if (v.panel === 'finish' && r) {
    const c0 = s.cups[s.active],
      lid = sealPhase(s, c0),
      x = w - 67,
      y = g.header + 15;
    box(c, x, y, 59, 39, 8, lid.ready ? '#a4dfb8' : '#ffe0b8', ink, 1.6);
    text(c, 'SEAL', x + 29, y + 10, 12, ink, 'center');
    box(c, x + 6, y + 23, 47, 5, 2, '#b7aa99', null);
    box(c, x + 20, y + 23, 20, 5, 2, '#5ea680', null);
    disc(c, x + 6 + 47 * lid.fraction, y + 24.5, 2.3, 5, '#704963');
  }
  if (s.receipt && s.time - s.lastServed < 2) {
    const u = Math.min(1, (s.time - s.lastServed) * 4),
      yy = g.header + 21 - (v.reduced ? 0 : 5 * u);
    c.save();
    c.translate(w * .50, yy);
    c.rotate(-.055);
    box(c, -60, -11, 120, 23, 5, '#fff4d9', '#a35b68', 2);
    text(c, 'SERVED   ' + '♥'.repeat(s.receipt.hearts), 0, 1, 14, '#9c5267', 'center');
    c.restore();
  }
  if (v.panel === 'book' || v.panel === 'receipt') {
    const bw = Math.min(w - 26, 440),
      bh = Math.min(h - 85, 245),
      left = (w - bw) / 2,
      top = Math.max(20, (h - bh) / 2);
    c.fillStyle = '#44344055';
    c.fillRect(0, 0, w, h);
    box(c, left + 4, top + 5, bw, bh, 12, '#684f50', null);
    box(c, left, top, bw, bh, 12, vanilla, ink, 2.5);
    const receipt = v.panel === 'receipt' && s.receipt,
      entry = receipt ? RECIPES[receipt.recipe] : RECIPES[v.bookIndex],
      xx = left + 17;
    text(c, receipt ? 'COUNTER RECEIPT' : 'RECIPE BOOK  /  ' + String(entry.id + 1).padStart(2, '0'), xx, top + 20, 12, '#a35d71');
    text(c, entry.name, xx, top + 48, Math.min(23, bw * .069), ink, 'left', 950, bw - 36);
    stroke(c, [[xx, top + 67], [left + bw - 16, top + 67]], '#b6977e', 1);
    const rows = receipt ? [['Service', receipt.parts.service], ['Tea / milk / base', receipt.parts.tea + ' / ' + receipt.parts.milk + ' / ' + receipt.parts.base], ['Toppings / ice', receipt.parts.toppings + ' / ' + receipt.parts.ice], ['Shake / seal', receipt.parts.shake + ' / ' + receipt.parts.seal], ['Patience / streak', receipt.parts.patience + ' / ' + receipt.parts.streak], ['Total', receipt.score + ' pts']] : [['Leaf', BASES[entry.base]], ['Tea / milk marks', entry.tea + ' / ' + entry.milk], ['Pearls / stars', entry.pearl + ' / ' + entry.star], ['Temperature', entry.ice ? 'Iced' : 'Warm'], ['Shaker strokes', String(entry.shake)], ['Introduced', DAYS[entry.day].name]];
    rows.forEach(([label, val], i) => {
      const yy = top + 83 + i * Math.min(24, (bh - 96) / 6);
      text(c, label, xx, yy, 13, ink);
      text(c, String(val), left + bw - 18, yy, 13, i === 5 ? '#8d465f' : '#497361', 'right');
    });
  }
  c.restore();
}
