import { sprite } from '../kit/field-art.js';
import { geometry } from './geometry.js';
import { names, palettes, lines } from './yards.js';
import { bit, solved } from './rules.js';
const driver = sprite(new URL('./agi.webp', import.meta.url));
const dye = ['#ef8239', '#f4bc3c', '#65c88b', '#ebbd50', '#f26759', '#ee9eb4'];
const ink = '#293946',
  cream = '#fff6d9',
  navy = '#265962';
function shape(c, pts, fill, stroke = ink, weight = 2) {
  c.beginPath();
  for (const [i, [x, y]] of pts.entries()) i ? c.lineTo(x, y) : c.moveTo(x, y);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = weight;
    c.stroke();
  }
}
function path(c, pts, col, width = 2) {
  c.beginPath();
  for (const [i, [x, y]] of pts.entries()) i ? c.lineTo(x, y) : c.moveTo(x, y);
  c.strokeStyle = col;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}
function box(c, x, y, w, h, r, fill, stroke = ink, weight = 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = weight;
    c.stroke();
  }
}
function dot(c, x, y, rx, ry, color, stroke = null, weight = 2) {
  c.beginPath();
  c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, 2 * Math.PI);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = weight;
    c.stroke();
  }
}
function text(c, s, x, y, size, col = ink, align = 'center', weight = 850, max = 10000) {
  c.fillStyle = col;
  c.font = weight + ' ' + size + 'px "AK Sans",system-ui,sans-serif';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, y, max);
}
function noodle(c, x, y, u, n) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  if (n === 0) {
    dot(c, 0, 2, 10, 5, '#fcaf4c', ink, 1.6);
    path(c, [[-7, 0], [-4, 2], [-1, 0], [3, 2], [7, 0]], cream, 1.4);
  } else if (n === 1) {
    dot(c, 0, 0, 7, 9, cream, ink, 1.5);
    dot(c, 1, 1, 3.6, 3.8, '#ef9c35');
  } else if (n === 2) {
    for (let i = -1; i <= 1; i++) {
      path(c, [[i * 2, 7], [i * 5, -6]], ink, 5);
      path(c, [[i * 2, 7], [i * 5, -6]], '#75d292', 3);
    }
  } else if (n === 3) {
    box(c, -5, -8, 10, 16, 4, '#ffc84e', ink, 1.4);
    for (let i = -1; i < 2; i++) path(c, [[-3, i * 3], [3, i * 3]], '#c47923', 1);
  } else if (n === 4) {
    shape(c, [[-8, 7], [-2, 2], [2, -6], [7, -4], [5, 1], [1, 6]], '#ea6157', ink, 1.4);
    path(c, [[4, -6], [5, -9], [8, -9]], '#4b9269', 2);
  } else {
    dot(c, 0, 0, 8, 8, '#fff1dc', ink, 1.4);
    c.strokeStyle = '#f2899d';
    c.lineWidth = 1.7;
    c.beginPath();
    for (let a = 0; a <= 12; a += .3) {
      const rr = a * .43;
      const xx = rr * Math.cos(a),
        yy = rr * Math.sin(a);
      a ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    }
    c.stroke();
  }
  c.restore();
}
function landmark(c, x, y, k, line, tm, pal) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const body = '#f6d79c',
    steel = pal[3],
    roof = pal[2];
  if (line === 0) {
    // Broth tower. The tilted chopsticks and enamel bowl distinguish the kitchen district.
    for (const sign of [-1, 1]) {
      path(c, [[sign * 16, -29], [sign * 23, 0]], steel, 4);
    }
    path(c, [[-18, -22], [20, -5]], steel, 2);
    path(c, [[18, -22], [-20, -5]], steel, 2);
    path(c, [[5, -36], [26, -67]], steel, 2.5);
    path(c, [[10, -35], [32, -63]], steel, 2.5);
    c.beginPath();
    c.moveTo(-33, -38);
    c.quadraticCurveTo(-26, -13, 0, -15);
    c.quadraticCurveTo(22, -13, 31, -38);
    c.closePath();
    c.fillStyle = roof;
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = 2;
    c.stroke();
    dot(c, 0, -38, 32, 7, cream, ink, 2);
    path(c, [[-21, -36], [-9, -40], [0, -36], [8, -39], [16, -37]], '#ca8b52', 2.3);
  } else if (line === 1) {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * 29;
      box(c, lx - 13, -32, 27, 32, 2, body, steel);
      shape(c, [[lx - 17, -32], [lx, -48], [lx + 17, -32]], roof, steel);
      box(c, lx - 6, -22, 12, 22, 5, steel, null);
    }
  } else if (line === 2) {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * 23,
        top = -36 - 9 * (i % 2);
      path(c, [[lx, 0], [lx, top - 13]], steel, 4);
      const a = i === 1 ? -.6 : .15,
        end = [lx + 20 * Math.cos(a), top + 20 * Math.sin(a)];
      path(c, [[lx, top], end], steel, 7);
      path(c, [[lx, top], end], i === 1 ? '#ed7665' : '#f7d99b', 4);
      dot(c, lx, top, 3, 3, cream, steel, 1);
    }
  } else if (line === 3) {
    box(c, -42, -33, 84, 34, 2, body, steel);
    shape(c, [[-49, -32], [-28, -53], [12, -59], [44, -31]], roof, steel);
    for (let i = -1; i <= 1; i++) {
      const lx = i * 24;
      box(c, lx - 8, -24, 16, 25, [8, 8, 0, 0], steel, null);
      path(c, [[lx - 9, 0], [lx - 15, 8]], steel, 1.5);
      path(c, [[lx + 9, 0], [lx + 15, 7]], steel, 1.5);
    }
    dot(c, -6, -39, 6, 6, cream, steel, 1.3);
    path(c, [[-6, -43], [-6, -39], [-3, -38]], steel, 1.3);
  } else if (line === 4) {
    for (let i = 0; i < 2; i++) {
      const lx = (i - .5) * 46;
      box(c, lx - 19, -34, 38, 34, 1, body, steel);
      shape(c, [[lx - 24, -34], [lx - 16, -49], [lx + 20, -47], [lx + 25, -34]], i ? steel : roof, ink, 1.6);
      for (let a = -1; a <= 1; a++) box(c, lx + a * 11 - 4, -33, 10, 10, [0, 0, 3, 3], i ? '#70abb8' : roof, steel, 1);
    }
  } else {
    path(c, [[-49, -40], [0, -32], [49, -40]], steel, 1.7);
    for (let i = -2; i <= 2; i++) {
      const lx = i * 18,
        yy = -30 - Math.abs(i) * 3;
      path(c, [[lx, yy - 3], [lx, yy + 4]], steel, 1.6);
      dot(c, lx, yy + 8, 5, 8, '#ffd78a', steel, 1.4);
      path(c, [[lx - 2, yy + 16], [lx + 2, yy + 16]], steel, 2);
    }
    for (const lx of [-42, 42]) path(c, [[lx, -44], [lx, 0]], steel, 3);
  }
  c.restore();
}
function city(c, w, h, yard, tm) {
  const pal = palettes[yard.line],
    horizon = h * .53;
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, pal[0]);
  bg.addColorStop(1, pal[1]);
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  const sun = Math.min(w * .17, h * .17);
  dot(c, w * .79, h * .23, sun, sun, '#ffefbb');
  if (yard.line === 5) dot(c, w * .79 + sun * .37, h * .23 - sun * .19, sun * .84, sun * .84, pal[0]);
  c.save();
  c.globalAlpha = .2;
  c.fillStyle = pal[3];
  for (let y = 19; y < horizon; y += 13) for (let x = y % 2 * 6; x < w; x += 15) {
    dot(c, x, y, 1.2, 1.2, pal[3]);
  }
  c.restore();
  const far = '#fff0cf';
  for (let i = 0; i < 7; i++) {
    const x = (i * w * .197 + tm * 1.35) % (w + 120) - 60,
      y = h * (.17 + i % 3 * .08);
    box(c, x, y, 55 + i * 6, 4, 2, far, null);
    box(c, x + 11, y - 5, 29 + i, 4, 2, far, null);
  }
  c.save();
  c.globalAlpha = .48;
  for (let i = -1; i < w / 43 + 2; i++) {
    const x = i * 43 + yard.id % 4 * 3,
      top = horizon - 16 - ((i + 9) * 43 + yard.id * 31) % 53;
    box(c, x, top, 38, horizon - top + 5, 1, pal[3], null);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) box(c, x + 6 + 9 * a, top + 8 + 10 * b, 4, 5, 0, pal[0], null);
  }
  c.restore();
  c.fillStyle = pal[1];
  c.fillRect(0, horizon, w, h - horizon);
  for (let x = -30; x < w + 30; x += 75) {
    box(c, x, horizon + 1, 10, 15, 1, pal[3], null);
    path(c, [[x, horizon], [x + 70, horizon]], pal[3], 2);
  }
  c.save();
  c.globalAlpha = .22;
  for (let x = -w; x < w * 2; x += 37) path(c, [[x, horizon + 17], [x + w * .4, h]], pal[3], 1);
  c.restore();
  // The kitchen town has roofed stalls, striped awnings and a little water tank at the edge of the yard.
  function shop(x, y, k) {
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    box(c, -29, -40, 58, 40, 1, '#ffe4af', ink, 2);
    shape(c, [[-36, -42], [-23, -54], [22, -56], [34, -42]], pal[3]);
    box(c, -24, -28, 47, 11, 1, '#725550', ink, 1.5);
    for (let i = 0; i < 6; i++) box(c, -25 + 9 * i, -34, 9, 11, [0, 0, 3, 3], i % 2 ? cream : pal[2], ink, 1);
    box(c, -26, -6, 52, 8, 1, '#af7a59');
    path(c, [[-14, -47], [15, -48]], cream, 2);
    for (let i = -1; i <= 1; i++) {
      const xx = 8 * i + Math.sin(tm + i) * 2;
      path(c, [[xx, -59], [xx - 3, -66], [xx + 1, -70]], cream, 2);
    }
    c.restore();
  }
  const k = Math.min(1.15, w / 525, h / 520);
  shop(w * .09, horizon + 4, k);
  shop(w * .90, horizon - 3, k * .82);
  landmark(c, w * .72, horizon - 12, k * 1.5, yard.line, tm, pal);
  c.save();
  c.translate(w * .08, h * .85);
  c.scale(k, k);
  for (let i = 0; i < 2; i++) path(c, [[-14 + 24 * i, -29], [-20 + 35 * i, 4]], navy, 4);
  box(c, -18, -54, 36, 27, 5, '#81ad9e', ink);
  dot(c, 0, -54, 18, 5, '#b1d6b5', ink);
  path(c, [[-19, -38], [18, -38]], cream, 3);
  c.restore();
}
function tie(c, x, y, nx, ny, u) {
  const dx = nx - x,
    dy = ny - y,
    mag = Math.hypot(dx, dy),
    px = -dy / mag,
    py = dx / mag;
  const draw = (t, off) => [x + dx * t + px * off, y + dy * t + py * off];
  for (let i = 0; i < 5; i++) {
    const t = (i + .5) / 5;
    path(c, [draw(t, -u * .135), draw(t, u * .135)], '#6e594e', Math.max(3, u * .055));
  }
  for (const offset of [-u * .062, u * .062]) {
    path(c, [draw(0, offset), draw(1, offset)], ink, Math.max(2.5, u * .045));
    path(c, [draw(0, offset - 1), draw(1, offset - 1)], '#fff4bf', Math.max(1, u * .015));
  }
}
function railbed(c, g, yard, palette) {
  const u = g.unit;
  const corners = (x, y) => [[x - u * .55, y - u * .08], [x + u * .33, y - u * .38], [x + u * .55, y + u * .07], [x - u * .33, y + u * .37]];
  const order = yard.points.map((_, i) => i).sort((a, b) => g.at(a)[1] - g.at(b)[1]);
  for (const i of order) {
    const [x, y] = g.at(i),
      p = corners(x, y);
    const drop = Math.max(4, u * .105);
    shape(c, [p[2], p[3], [p[3][0], p[3][1] + drop], [p[2][0], p[2][1] + drop]], '#a47c5b', ink, 1.5);
    shape(c, [p[1], p[2], [p[2][0], p[2][1] + drop], [p[1][0], p[1][1] + drop]], '#c09870', ink, 1.5);
    shape(c, p, i % 3 ? '#e9ca98' : '#f0d5a9', '#b89167', 1);
    for (let n = 0; n < 3; n++) dot(c, x + (n - 1) * u * .18, y + u * (.21 - .08 * n), 1.3, 1, '#94785d');
  }
  for (const [i, p] of yard.points.entries()) {
    const [x, y] = g.at(i);
    for (const [d, j] of p.links.entries()) {
      if (j < 0 || j < i) continue;
      const [nx, ny] = g.at(j);
      tie(c, x, y, nx, ny, u);
      let a = null;
      if (yard.oneWay.has(j + ',' + i)) a = 1;
      if (yard.oneWay.has(i + ',' + j)) a = -1;
      if (a) {
        c.save();
        c.translate((x + nx) / 2, (y + ny) / 2);
        c.rotate(Math.atan2(ny - y, nx - x) + (a < 0 ? Math.PI : 0));
        shape(c, [[-5, -5], [5, 0], [-5, 5]], '#ffe679', ink, 1.5);
        c.restore();
      }
    }
    if (p.ch === '!') {
      dot(c, x, y, u * .23, u * .12, '#ffe988', ink, 2);
      text(c, 'CAB', x, y, Math.max(10, u * .11));
    }
  }
}
function equipment(c, g, yard, s) {
  const u = g.unit;
  for (const [i, d] of yard.devices.entries()) {
    const [x, y] = g.at(d.node),
      set = bit(s, i);
    if (d.type === '%') {
      dot(c, x, y, u * .34, u * .216, '#716582', ink);
      dot(c, x, y, u * .275, u * .163, '#d4b6b1', ink, 1);
      const vertical = d.axis ^ set,
        dx = vertical ? u * .30 : u * .09,
        dy = vertical ? -u * .045 : u * .23;
      path(c, [[x - dx, y - dy], [x + dx, y + dy]], ink, u * .11);
      path(c, [[x - dx, y - dy], [x + dx, y + dy]], '#ffe19c', u * .06);
    } else {
      const arm = d.dirs[set ? 2 : 1],
        dest = yard.points[d.node].links[arm];
      if (dest >= 0) {
        const [dx, dy] = g.at(dest);
        path(c, [[x, y], [x + (dx - x) * .38, y + (dy - y) * .38]], '#50c29f', Math.max(4, u * .07));
      }
      path(c, [[x - u * .18, y + u * .17], [x - u * .18 + (set ? 6 : -6), y - u * .05]], ink, 3);
      dot(c, x - u * .18 + (set ? 6 : -6), y - u * .05, 4, 4, '#ed634d', ink, 1);
    }
  }
  for (const [k, w] of yard.windows.entries()) {
    const [x, y] = g.at(w),
      col = k ? '#387b9a' : '#d55547';
    dot(c, x, y, u * .27, u * .14, '#ffe5ac', col, 3);
    path(c, [[x + u * .26, y], [x + u * .26, y - u * .48]], ink, Math.max(2, u * .035));
    box(c, x + u * .10, y - u * .56, u * .32, u * .22, 3, col, ink, 1.7);
    text(c, String.fromCharCode(65 + k), x + u * .26, y - u * .447, Math.max(12, u * .145), cream);
  }
}
function car(c, x, y, u, n, linked, badge) {
  c.save();
  c.translate(x, y);
  c.scale(u / 100, u / 100);
  dot(c, 0, 2, 38, 9, '#705b59');
  for (const xx of [-23, 19]) {
    dot(c, xx, 0, 8, 8, ink);
    dot(c, xx, 0, 3, 3, '#b1b5a9');
  }
  shape(c, [[-37, -22], [19, -30], [36, -20], [36, -5], [-20, 3], [-37, -8]], '#e4b67f', ink, 2.7);
  shape(c, [[-37, -23], [20, -30], [35, -21], [-20, -12]], '#ffe3ab', ink, 2);
  dot(c, 0, -21, 27, 9, cream, ink, 2);
  c.beginPath();
  c.moveTo(-26, -21);
  c.quadraticCurveTo(-20, -1, 1, -3);
  c.quadraticCurveTo(19, -3, 26, -21);
  c.closePath();
  c.fillStyle = dye[n];
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 2;
  c.stroke();
  dot(c, 0, -22, 24, 6, '#af6d45', ink, 1.5);
  noodle(c, 0, -25, 1.24, n);
  if (badge) {
    dot(c, 24, -28, 8, 8, badge === 'A' ? '#b44637' : '#286b84', cream, 1.6);
    text(c, badge, 24, -28, 12, cream);
  }
  if (linked) {
    box(c, -27, 1, 11, 4, 2, '#83ead0', ink, 1.2);
    box(c, 21, -4, 10, 4, 2, '#83ead0', ink, 1.2);
  }
  c.restore();
}
function engine(c, x, y, u, face, time, reduced, livery) {
  c.save();
  c.translate(x, y);
  c.scale(face < 0 ? -1 : 1, 1);
  dot(c, 0, 3, u * .38, u * .095, '#665957');
  if (!driver(c, -u * .48, -u * .73, u * .93, u * .88)) {
    box(c, -u * .37, -u * .42, u * .76, u * .34, 6, '#e87372', ink);
    box(c, -u * .18, -u * .68, u * .3, u * .33, 3, cream, ink);
    for (const xx of [-.22, .22]) dot(c, xx * u, 0, u * .12, u * .12, ink);
  }
  if (livery >= 0) {
    path(c, [[-u * .11, -u * .52], [-u * .11, -u * .80]], ink, Math.max(1.5, .025 * u));
    shape(c, [[-u * .11, -u * .8], [-u * .39, -u * .75], [-u * .11, -u * .68]], dye[livery], ink, 1.5);
  }
  if (!reduced) for (let i = 0; i < 3; i++) {
    const age = (time * .58 + i / 3) % 1;
    c.globalAlpha = (1 - age) * .75;
    dot(c, u * (.20 + .13 * age), u * (-.57 - .34 * age), u * (.025 + .052 * age), u * (.018 + .046 * age), cream);
  }
  c.restore();
}
function ticket(c, w, yard, s, moves, par, summary) {
  const compact = w < 530,
    x = 8,
    y = 7,
    bw = Math.min(w - 16, compact ? 478 : 690),
    h = compact ? 60 : 64;
  box(c, x + 3, y + 3, bw, h, 9, ink, null);
  box(c, x, y, bw, h, 9, cream, ink, 2);
  const zone = compact ? Math.min(120, bw * .39) : 188;
  box(c, x + 3, y + 3, zone - 5, h - 6, 6, palettes[yard.line][3], null);
  text(c, 'LINE ' + (yard.line + 1) + '  /  ' + String(yard.id + 1).padStart(2, '0'), x + 11, y + 15, 12, '#ffdf87', 'left');
  text(c, yard.name, x + 11, y + 35, compact ? 17 : 23, cream, 'left', 900, zone - 18);
  const area = bw - zone - 10,
    groups = yard.tickets.length;
  for (let k = 0; k < groups; k++) {
    const left = x + zone + 6 + k * area / groups,
      slot = area / groups;
    text(c, 'KITCHEN ' + String.fromCharCode(65 + k), left, y + 14, 12, k ? '#286780' : '#9e4638', 'left');
    const step = Math.min(36, (slot - 3) / yard.tickets[k].length);
    yard.tickets[k].forEach((car, i) => {
      const p = left + step * (i + .5),
        done = i < yard.tickets[k].filter(n => s.cars[n] < 0).length;
      dot(c, p, y + 38, Math.min(14, step * .41), 13, done ? '#a9e3c9' : '#fff0cd', done ? '#357963' : '#ab9172', 1.5);
      if (done) text(c, '✓', p, y + 38, 16, '#2b6e59');else noodle(c, p, y + 37, Math.min(1, step * .045), yard.dish[car]);
    });
  }
  if (w > 900) {
    text(c, lines[yard.line].toUpperCase(), w - 21, 22, 15, ink, 'right');
    text(c, 'PAR ' + par + '   /   ' + moves + ' SHUNTS', w - 21, 44, 15, ink, 'right');
  }
}
export function mapButtons(w, h) {
  const left = Math.max(12, (w - Math.min(w - 24, 600)) / 2),
    width = w - 2 * left,
    gap = 7,
    cols = 3,
    bw = (width - 2 * gap) / 3,
    bh = Math.max(44, Math.min(82, (h - 139) / 2));
  return Array.from({
    length: 6
  }, (_, i) => ({
    x: left + i % cols * (bw + gap),
    y: h * .44 + (Math.floor(i / 3) - .56) * (bh + gap),
    w: bw,
    h: bh
  }));
}
export function paint(c, w, h, view) {
  const {
    yard,
    state,
    prev,
    age,
    time,
    plan,
    mark,
    done,
    moves,
    par,
    records,
    map,
    pick,
    page,
    allowed
  } = view;
  const g = geometry(yard, w, h),
    u = g.unit;
  c.save();
  city(c, w, h, yard, time);
  railbed(c, g, yard, palettes[yard.line]);
  equipment(c, g, yard, state);
  if (plan?.path?.length) {
    let at = state.e;
    const pts = [g.at(at)];
    for (const dir of plan.path) {
      at = yard.points[at].links[dir];
      if (at < 0) break;
      pts.push(g.at(at));
    }
    path(c, pts, '#fff6c7', Math.max(4, u * .08));
    path(c, pts, '#3b9d86', Math.max(2, u * .035));
  }
  for (const d of view.afford) {
    const at = yard.points[state.e].links[d];
    if (at < 0) continue;
    const [x, y] = g.at(at);
    dot(c, x, y, u * .12, u * .072, '#a3f1cf', '#327663', 1.8);
  }
  const eased = 1 - (1 - Math.min(1, age / .19)) ** 2;
  const pos = (node, old) => {
    const p = g.at(node);
    if (old == null || old < 0 || eased === 1) return p;
    const b = g.at(old);
    return [b[0] + (p[0] - b[0]) * eased, b[1] + (p[1] - b[1]) * eased];
  };
  const positions = state.cars.map((n, i) => n < 0 ? null : pos(n, prev?.cars[i])),
    cab = pos(state.e, prev?.e);
  let back = cab;
  for (const i of state.chain) {
    const p = positions[i];
    path(c, [back, p], ink, Math.max(5, .085 * u));
    path(c, [back, p], '#71dbbf', Math.max(2, .035 * u));
    back = p;
  }
  const sprites = positions.map((p, i) => p && {
    p,
    i
  }).filter(Boolean);
  sprites.push({
    p: cab,
    i: -1
  });
  sprites.sort((a, b) => a.p[1] - b.p[1]);
  for (const {
    p: [x, y],
    i
  } of sprites) if (i === -1) engine(c, x, y, u, view.face, time, view.reduced, view.livery);else car(c, x, y, u, yard.dish[i], state.chain.includes(i), yard.windows.length > 1 ? String.fromCharCode(65 + yard.kitchen[i]) : null);
  if (mark && mark.t > 0) {
    const [x, y] = g.at(mark.node);
    const elapsed = 1 - mark.t / 1.4;
    c.globalAlpha = Math.min(1, mark.t * 3);
    dot(c, x, y - u * .4 - Math.max(0, elapsed) * 26, 13, 13, cream, '#2b7664', 2);
    text(c, '✓', x, y - u * .4 - Math.max(0, elapsed) * 26, 19, '#2b7664');
    c.globalAlpha = 1;
  }
  ticket(c, w, yard, state, moves, par, done);
  if (!map) {
    const line = done ? 'TICKET PUNCHED   ' + '★'.repeat(view.stars) + '☆'.repeat(3 - view.stars) : view.message;
    if (line) {
      const size = w < 480 ? 12 : 15;
      c.font = '850 ' + size + 'px system-ui';
      const wrapped = [''];
      for (const word of line.split(' ')) {
        const last = wrapped.length - 1,
          candidate = (wrapped[last] + ' ' + word).trim();
        if (wrapped[last] && c.measureText(candidate).width > w - 42) wrapped.push(word);else wrapped[last] = candidate;
      }
      const bw = Math.min(w - 16, Math.max(...wrapped.map(t => c.measureText(t).width)) + 28),
        bh = 10 + wrapped.length * (size + 2),
        y = Math.max(71, h - 40 - bh);
      box(c, (w - bw) / 2, y, bw, bh, 10, done ? '#176352' : '#fff3cd', ink, 1.5);
      wrapped.forEach((t, i) => text(c, t, w / 2, y + 6 + (i + .5) * (size + 2), size, done ? cream : ink));
    }
  }
  if (map) {
    c.fillStyle = '#253844d4';
    c.fillRect(0, 0, w, h);
    text(c, 'STATION PASS', w / 2, Math.max(23, h * .12), Math.min(33, w * .072), cream);
    text(c, 'LINE ' + (page + 1) + '  /  ' + lines[page].toUpperCase(), w / 2, Math.max(46, h * .21), 14, '#ffdc88');
    const rect = mapButtons(w, h);
    rect.forEach(({
      x,
      y,
      w: bw,
      h: bh
    }, i) => {
      const id = page * 6 + i,
        open = allowed(id),
        selected = id === pick;
      box(c, x, y, bw, bh, 8, selected ? '#ffe996' : open ? cream : '#a9b3aa', selected ? '#f6745f' : ink, selected ? 4 : 2);
      text(c, 'STN ' + String(id + 1).padStart(2, '0'), x + bw / 2, y + bh * .29, 12, ink);
      text(c, view.plans[id].name, x + bw / 2, y + bh * .60, Math.min(15, bw * .14), ink, 'center', 850, bw - 7);
      if (records[id]) {
        const par = view.book[id].length,
          stars = records[id] === par ? 3 : records[id] <= par + 2 ? 2 : 1;
        text(c, '★'.repeat(stars) + ' · ' + records[id] + ' SHUNTS', x + bw / 2, y + bh * .83, 12, '#257357', 'center', 850, bw - 8);
      }
    });
    const count = Array.from({
      length: 6
    }, (_, i) => !!records[page * 6 + i]).filter(Boolean).length;
    text(c, count === 6 ? 'PENNANT EARNED · ' + lines[page].toUpperCase() : count + ' / 6 STAMPS  ·  4 OPEN THE NEXT LINE', w / 2, Math.min(h - 34, rect.at(-1).y + rect.at(-1).h + 23), 12, '#ffe393');
  }
  c.restore();
}
