import { gradient, line, polygon, oval, panel, type } from '../kit/illustration.js';
import { wings } from './rooms.js';
import { xy, cone, hearing, dist, TAPES, vec, walkable } from './geometry.js';
import { lens } from './patrol.js';
import { heroine, docent, keepsake, object } from './art.js';
import { layout } from './layout.js';
const ink = '#222035',
  paper = '#fff1d5',
  amber = '#f4c776',
  aqua = '#85dbc8',
  rose = '#fc9baf';
const sans = '"AK Sans",sans-serif',
  display = '"AK Display",sans-serif',
  mono = '"AK Mono",monospace';
const label = (c, text, x, y, size, fill = paper, align = 'center', font = sans) =>
  type(c, text, x, y, size, fill, align, font);
const lerp = (a, b, t) => a + (b - a) * t;
function led(c, x, y, size, color) {
  oval(c, x, y, size, size, color + '36');
  oval(c, x, y, size * 0.57, size * 0.57, color, ink, 1);
}
function floor(c, b, r, p, guard, cam, sound, aim, goal, ghost) {
  const [x, y] = xy(r, p),
    { pt, s } = b,
    t = r.tiles[p],
    at = (a, v, z = 0) => pt(x + a, y + v, z);
  const narrow = Math.max(0.7, s * 0.021),
    face = [at(0.04, 0.04), at(0.96, 0.04), at(0.96, 0.96), at(0.04, 0.96)];
  const carpet = t === 'c',
    hood = t === 'm',
    brass = t === 't';
  const colors = carpet
    ? ['#718987', '#839992']
    : brass
      ? ['#d1b39a', '#d4bda2']
      : hood
        ? ['#748293', '#748899']
        : ['#c1afa0', '#cfbb9e'];
  polygon(c, face, colors[(x + y) % 2], '#4c4b58', narrow);
  line(c, [at(0.11, 0.79), at(0.76, 0.79)], carpet ? '#abc2ae60' : '#efe1bc65', Math.max(0.6, narrow * 0.75));
  if (carpet)
    for (let i = 0; i < 3; i++)
      line(
        c,
        [at(0.13, 0.2 + i * 0.21), at(0.28, 0.3 + i * 0.21), at(0.38, 0.2 + i * 0.21)],
        '#c4d5be88',
        Math.max(0.65, s * 0.015)
      );
  if (hood) {
    polygon(c, [at(0.1, 0.16), at(0.9, 0.16), at(0.9, 0.88), at(0.1, 0.88)], '#6e7e8c');
    line(c, [at(0.22, 0.72), at(0.5, 0.34), at(0.78, 0.72)], '#d8e0d2', Math.max(1, s * 0.028));
  }
  if (brass) {
    for (const a of [0.22, 0.74])
      for (const v of [0.22, 0.74]) {
        const [bx, by] = at(a, v);
        oval(c, bx, by, Math.max(0.8, s * 0.023), Math.max(0.7, s * 0.017), '#88786a');
      }
  }
  if (guard) {
    polygon(c, face, '#efaa4685');
    line(c, [at(0.11, 0.17), at(0.83, 0.17)], '#ffe7a0', Math.max(1, s * 0.026));
  }
  if (cam) {
    polygon(c, face, '#df698a84');
    for (let i = 0; i < 3; i++)
      line(c, [at(0.12 + i * 0.25, 0.86), at(0.29 + i * 0.25, 0.46)], '#ffd5df9e', Math.max(1, s * 0.017));
  }
  if (sound) {
    polygon(c, face, '#64c3ad5f');
    line(c, [at(0.18, 0.83), at(0.48, 0.83), at(0.63, 0.66)], '#d5ffdf', Math.max(1, s * 0.027));
  }
  if (aim || ghost) {
    const g = aim ? aqua : '#ebe6ff';
    c.save();
    c.setLineDash([Math.max(2, s * 0.11), Math.max(2, s * 0.08)]);
    line(c, [...face, face[0]], g, Math.max(1.5, s * 0.041));
    c.restore();
  }
  if (goal) {
    const [bx, by] = at(0.5, 0.5);
    oval(c, bx, by, s * 0.32, s * 0.18, goal === 'open' ? '#76a996' : '#697078', ink, Math.max(1, s * 0.023));
    line(c, [at(0.32, 0.55), at(0.52, 0.55), at(0.66, 0.38)], paper, Math.max(1, s * 0.035));
  }
}
function recorder(c, x, y, s, t, active = true) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.12);
  c.scale(s / 48, s / 48);
  panel(c, -17, -10, 34, 22, '#332c46', 4);
  panel(c, -14, -8, 28, 14, active ? '#b8dac3' : '#b4a399', 3);
  for (const off of [-7, 7]) {
    oval(c, off, -1, 4, 4, '#4c4651');
    for (let j = 0; j < 3; j++) {
      const a = t * 3 + j * 2.09;
      line(
        c,
        [
          [off, -1],
          [off + Math.cos(a) * 3, -1 + Math.sin(a) * 3],
        ],
        paper,
        1
      );
    }
  }
  panel(c, -8, 7, 16, 3, '#76677b', 1);
  c.restore();
}
function marker(c, b, r, p, kind) {
  const [gx, gy] = xy(r, p),
    { pt, s } = b,
    [x, y] = pt(gx + 0.52, gy + 0.52, 0.06);
  c.save();
  c.translate(x, y);
  c.scale(s / 60, s / 60);
  c.rotate(-0.17);
  if (kind === 'key') {
    panel(c, -15, -8, 29, 16, '#9ce3da', 3);
    panel(c, -13, -4, 25, 3, '#447b83', 0);
    oval(c, -8, 3, 2, 2, paper);
  } else if (kind === 'fragment') {
    polygon(
      c,
      [
        [-8, -10],
        [10, -7],
        [7, 10],
        [-10, 7],
      ],
      '#e8c3cc',
      ink,
      1
    );
    line(
      c,
      [
        [-5, -1],
        [5, 2],
      ],
      '#8a6878',
      1.4
    );
  } else {
    polygon(
      c,
      [
        [-14, -8],
        [0, -11],
        [14, -7],
        [13, 8],
        [1, 6],
        [-14, 8],
      ],
      '#f7db97',
      ink,
      1.8
    );
    line(
      c,
      [
        [0, -10],
        [1, 6],
      ],
      '#9b6863',
      1.6
    );
    for (let j = 0; j < 3; j++)
      line(
        c,
        [
          [3, -4 + 3 * j],
          [10, -3 + 3 * j],
        ],
        '#ba8770',
        1
      );
  }
  c.restore();
}
function backdrop(c, b, w, h, theme) {
  gradient(c, 0, 0, w, h, [theme.ink, '#383246', '#211e34']);
  const bottom = h - b.foot;
  const gw = b.playW,
    roomH = bottom - b.head;
  // Printed arches and shadow-box mullions sit behind the tabletop, lit by
  // its wing's display lamps. A brass catalog clock hangs from the picture rail.
  for (let i = 0; i < 5; i++) {
    const cx = (gw * (i + 0.5)) / 5,
      aw = gw * 0.145,
      top = b.head + roomH * (0.13 + (i % 2) * 0.025),
      base = b.head + roomH * 0.6;
    c.beginPath();
    c.moveTo(cx - aw * 0.45, base);
    c.lineTo(cx - aw * 0.45, top + aw * 0.25);
    c.quadraticCurveTo(cx, top - aw * 0.34, cx + aw * 0.45, top + aw * 0.25);
    c.lineTo(cx + aw * 0.45, base);
    c.closePath();
    c.fillStyle = theme.light + '13';
    c.fill();
    c.strokeStyle = theme.light + '3c';
    c.lineWidth = Math.max(1, gw * 0.0017);
    c.stroke();
    line(
      c,
      [
        [cx, top + aw * 0.04],
        [cx, base],
      ],
      theme.light + '30',
      1.6
    );
    line(
      c,
      [
        [cx - aw * 0.42, top + aw * 0.39],
        [cx + aw * 0.42, top + aw * 0.39],
      ],
      theme.light + '30',
      1.4
    );
  }
  const cx = gw * 0.75,
    cy = b.head + roomH * 0.17,
    radius = Math.min(33, roomH * 0.065);
  line(
    c,
    [
      [cx, b.head],
      [cx, cy - radius],
    ],
    '#bba07866',
    1.8
  );
  oval(c, cx, cy, radius, radius, '#28263788', '#bea77b77', 2);
  line(
    c,
    [
      [cx, cy - radius * 0.6],
      [cx, cy],
      [cx + radius * 0.44, cy - radius * 0.1],
    ],
    '#d9bc8580',
    1.8
  );
  for (const edge of [0, 1]) {
    c.save();
    if (edge) {
      c.translate(b.playW, 0);
      c.scale(-1, 1);
    }
    const span = b.playW * 0.14;
    for (let row = 0; row < 4; row++) {
      const y = b.head + (bottom - b.head) * (0.12 + row * 0.2);
      line(
        c,
        [
          [0, y],
          [span, y],
        ],
        '#b09b8865',
        2
      );
      for (let i = 0; i < 6; i++) {
        const x = (i * span) / 6,
          hh = (11 + ((i * 7 + row * 3) % 15)) * (b.wide ? 1.55 : 1);
        panel(c, x, y - hh, Math.max(2, span / 8), hh, ['#9d7c794a', '#adc3ac42', '#cfac894a'][(i + row) % 3], 1);
      }
    }
    c.restore();
  }
  for (let i = 0; i < 7; i++) {
    const x = (b.playW * (i + 0.3)) / 7;
    line(
      c,
      [
        [x, b.head],
        [x, b.head + 8 + (i % 3) * 4],
      ],
      '#161d2c',
      2
    );
    oval(c, x, b.head + 9 + (i % 3) * 4, 3, 2, theme.light);
  }
}
function glowCone(c, b, r, origin, facing, mask, paint) {
  if (!mask.size || facing < 0) return;
  const [ox, oy] = xy(r, origin),
    [ax, ay] = b.pt(ox + 0.5, oy + 0.5),
    [dx, dy] = vec[facing];
  const [bx, by] = b.pt(ox + 0.5 + dx * 4.5, oy + 0.5 + dy * 4.5);
  c.save();
  c.beginPath();
  for (const p of mask) {
    const [x, y] = xy(r, p),
      a = b.pt(x + 0.035, y + 0.035),
      z = b.pt(x + 0.965, y + 0.035),
      d = b.pt(x + 0.965, y + 0.965),
      e = b.pt(x + 0.035, y + 0.965);
    c.moveTo(...a);
    c.lineTo(...z);
    c.lineTo(...d);
    c.lineTo(...e);
    c.closePath();
  }
  c.clip();
  const shine = c.createLinearGradient(ax, ay, bx, by);
  shine.addColorStop(0, paint + 'd4');
  shine.addColorStop(0.5, paint + '6b');
  shine.addColorStop(1, paint + '00');
  c.fillStyle = shine;
  c.fillRect(0, 0, b.playW, b.h);
  const farX = ox + 0.5 + dx * 4,
    farY = oy + 0.5 + dy * 4;
  for (const factor of [-0.7, -0.32, 0.32, 0.7]) {
    const q = b.pt(farX - dy * factor * 4, farY + dx * factor * 4);
    line(c, [[ax, ay], q], paint + '69', Math.max(1, b.s * 0.025));
  }
  c.restore();
}
function compactBrief(c, b, r, s) {
  const low = b.pt(r.w, r.h)[1] + b.s * 0.24,
    space = b.h - b.foot - low;
  if (space < 43 || b.wide) return;
  const y = low + Math.min(22, space * 0.35),
    guard = s.guards[0],
    threat = s.heat ? 'Searching for AGI-1' : guard.to >= 0 ? 'Following sound' : 'Patrolling';
  panel(c, b.playW * 0.12, y - 10, b.playW * 0.76, Math.min(43, space - 6), '#282939b3', 6);
  led(c, b.playW * 0.12 + 12, y + 3, 4, guard.to >= 0 ? aqua : amber);
  label(c, 'DOCENT   ' + threat, b.playW * 0.12 + 23, y + 3, 12, paper, 'left', mono);
  if (space >= 58 && r.cameras.length) {
    const cam = r.cameras[0],
      now = lens(r, cam, s.phase),
      next = lens(r, cam, (s.phase + 1) % r.period),
      compass = ['N', 'E', 'S', 'W'];
    label(
      c,
      'CAMERA   ' + (compass[now] || 'dark') + '  →  ' + (compass[next] || 'dark'),
      b.playW * 0.12 + 23,
      y + 20,
      12,
      rose,
      'left',
      mono
    );
  } else if (space >= 58) {
    const note =
      s.guards.length > 1
        ? 'SECOND   ' + (s.guards[1].to < 0 ? 'Patrolling' : 'Following sound')
        : 'AMBER   Line of sight';
    label(c, note, b.playW * 0.12 + 23, y + 20, 12, amber, 'left', mono);
  }
}
function status(state, r) {
  if (state.caught) return 'SPOTTED';
  if (state.heat) return 'IN SIGHT';
  return state.pose ? 'CROUCHED' : 'UNSEEN';
}
function sidebar(c, b, v, theme) {
  const { room: r, state: s } = v,
    x = b.playW + 13,
    y = b.head + 18,
    w = b.side - 25,
    h = b.h - b.head - 35;
  panel(c, x, y, w, h, '#e3d5bf', 10);
  panel(c, x + 7, y + 7, w - 14, h - 14, '#f1e3cb', 6);
  label(c, 'EVIDENCE SLIP', x + 18, y + 27, 14, theme.ink, 'left', mono);
  label(c, 'No. ' + String(r.id).padStart(3, '0'), x + w - 17, y + 27, 13, theme.ink, 'right', mono);
  const cy = y + Math.min(h * 0.2, 105);
  keepsake(c, x + w * 0.52, cy, Math.min(96, h * 0.19), r.wing);
  line(
    c,
    [
      [x + 15, cy + 50],
      [x + w - 15, cy + 50],
    ],
    '#9e8e83',
    1
  );
  let yy = cy + 74;
  const gap = Math.max(19, Math.min(31, h * 0.064));
  for (const [i, g] of s.guards.entries()) {
    label(c, 'DOCENT ' + (i + 1), x + 18, yy, 12, '#675c66', 'left', mono);
    label(
      c,
      g.to < 0 ? 'On patrol' : s.heat ? 'Checking sighting' : 'Following sound',
      x + 18,
      yy + gap * 0.73,
      Math.min(18, w * 0.066),
      ink,
      'left'
    );
    yy += gap * 1.95;
  }
  if (r.cameras.length && yy < h + y - 75) {
    label(c, 'PROJECTOR', x + 18, yy, 12, '#675c66', 'left', mono);
    const cam = r.cameras[0],
      a = lens(r, cam, s.phase),
      next = lens(r, cam, (s.phase + 1) % r.period),
      d = ['north', 'east', 'south', 'west'];
    label(
      c,
      (a < 0 ? 'dark' : d[a]) + '  →  ' + (next < 0 ? 'dark' : d[next]),
      x + 18,
      yy + gap * 0.73,
      16,
      ink,
      'left'
    );
  }
  label(c, 'QUIET PAR  ' + v.par, x + 18, y + h - 22, 15, theme.ink, 'left', mono);
}
export function render(c, w, h, v) {
  const r = v.room,
    s = v.state,
    b = layout(w, h, r),
    theme = wings[r.wing];
  backdrop(c, b, w, h, theme);
  const grd = new Set(),
    cam = new Set(),
    loud = new Set();
  for (const [i, g] of s.guards.entries()) for (const p of cone(r, g.p, g.f, s.key, r.ranges[i])) grd.add(p);
  for (const device of r.cameras)
    for (const p of cone(r, device.p, lens(r, device, s.phase), s.key, device.range)) cam.add(p);
  const source = v.aim ? v.target : s.tape,
    tapeType = v.aim ? v.tape : s.type;
  if (source >= 0 && (v.aim || s.life))
    for (let p = 0; p < r.tiles.length; p++)
      if (walkable(r, p, s.key) && hearing(r, p, s.key, source) <= TAPES[tapeType].reach) loud.add(p);
  const p0 = b.pt(0, 0),
    p1 = b.pt(r.w, 0),
    p2 = b.pt(r.w, r.h),
    p3 = b.pt(0, r.h),
    depth = b.s * 0.19;
  polygon(c, [p3, p2, [p2[0], p2[1] + depth], [p3[0], p3[1] + depth]], '#645865', ink, 2);
  polygon(c, [p1, p2, [p2[0], p2[1] + depth], [p1[0], p1[1] + depth]], '#4a4255', ink, 2);
  polygon(c, [p0, p1, p2, p3], '#6a6066', ink, 2);
  const ghosts = v.ghost ? new Set(v.ghost) : null;
  for (let p = 0; p < r.tiles.length; p++)
    if (r.tiles[p] !== ' ')
      floor(
        c,
        b,
        r,
        p,
        grd.has(p),
        cam.has(p),
        loud.has(p),
        p === v.target && v.aim,
        p === r.exit ? (s.bag === r.all && (!r.exitKey || s.key) ? 'open' : 'closed') : null,
        ghosts?.has(p)
      );
  for (const [i, g] of s.guards.entries())
    glowCone(c, b, r, g.p, g.f, cone(r, g.p, g.f, s.key, r.ranges[i]), '#f8ca76');
  for (const device of r.cameras) {
    const dir = lens(r, device, s.phase);
    glowCone(c, b, r, device.p, dir, cone(r, device.p, dir, s.key, device.range), '#fa9bab');
  }
  const t = v.reduced ? 1 : v.phase,
    herFrom = xy(r, v.previous.p),
    herTo = xy(r, s.p),
    hx = lerp(herFrom[0], herTo[0], t),
    hy = lerp(herFrom[1], herTo[1], t);
  const objects = [];
  for (let p = 0; p < r.tiles.length; p++) {
    const [x, y] = xy(r, p),
      kind = r.tiles[p];
    if (['#', '|', 'C', '+'].includes(kind) && !(kind === '+' && s.key))
      objects.push({ y: y + 0.6, draw: () => object(c, b, x, y, kind, theme, p) });
    const obj = r.items.indexOf(p),
      icon =
        obj >= 0 && !(s.bag & (1 << obj))
          ? 'diary'
          : kind === 'k' && !s.key
            ? 'key'
            : p === r.fragment && !s.frag
              ? 'fragment'
              : null;
    if (icon) objects.push({ y: y + 0.46, draw: () => marker(c, b, r, p, icon) });
  }
  if (source >= 0 && (v.aim || s.life)) {
    const [xx, yy] = xy(r, source),
      [x, y] = b.pt(xx + 0.5, yy + 0.55);
    objects.push({
      y: yy + 0.51,
      draw: () => {
        if (!v.reduced) {
          const pulse = (v.time * 1.3) % 1;
          oval(c, x, y, b.s * (0.23 + pulse * 0.24), b.s * (0.13 + pulse * 0.13), '', aqua, 2);
        }
        recorder(c, x, y, b.s * 0.52, v.time, !v.aim);
      },
    });
  }
  for (const [i, g] of s.guards.entries()) {
    const prev = v.previous.guards[i] || g,
      a = xy(r, prev.p),
      z = xy(r, g.p),
      gx = lerp(a[0], z[0], t),
      gy = lerp(a[1], z[1], t),
      [x, y] = b.pt(gx + 0.53, gy + 0.66);
    objects.push({
      y: gy + 0.65,
      draw: () => {
        docent(c, x, y, b.s * 0.76, g, v.reduced ? 0 : v.time, g.to >= 0);
        const [dx, dy] = vec[g.f],
          [endX, endY] = b.pt(gx + 0.53 + dx * 0.48, gy + 0.66 + dy * 0.48);
        line(
          c,
          [
            [x, y],
            [endX, endY],
          ],
          amber,
          Math.max(1.5, b.s * 0.035)
        );
      },
    });
  }
  const [px, py] = b.pt(hx + 0.47, hy + 0.73);
  objects.push({
    y: hy + 0.72,
    draw: () => heroine(c, px, py, b.s * 0.61, v.facing, v.time, t, s.pose, v.sealed, v.reduced),
  });
  objects.sort((a, z) => a.y - z.y).forEach((o) => o.draw());
  if (v.hintAt >= 0) {
    const [hx, hy] = xy(r, v.hintAt),
      [x, y] = b.pt(hx + 0.5, hy + 0.57, 0.03);
    oval(c, x, y, b.s * 0.2, b.s * 0.13, '', aqua, Math.max(2, b.s * 0.04));
  }
  panel(c, 0, 0, w, b.head, '#241f34', 0);
  label(c, 'NIGHT ARCHIVE   /   ' + theme.name.toUpperCase(), 13, b.head * 0.25, 12, theme.light, 'left', mono);
  label(c, r.name, 13, b.head * 0.71, Math.min(30, Math.max(19, w * 0.046)), paper, 'left', display);
  if (b.wide) sidebar(c, b, v, theme);
  else compactBrief(c, b, r, s);
  const top = h - b.foot + 3,
    footW = b.playW;
  panel(c, 8, top, footW - 16, b.foot - 7, '#252436', 7);
  recorder(c, 32, top + b.foot * 0.46, 35, v.reduced ? 0 : v.time, !!s.charges);
  const mode = v.sealed
    ? 'DOSSIER FILED'
    : v.aim
      ? 'AIMING   ·   ' + TAPES[v.tape].name.toUpperCase()
      : status(s, r);
  label(
    c,
    mode,
    58,
    top + b.foot * 0.34,
    Math.min(16, Math.max(12, footW * 0.035)),
    s.heat ? rose : v.aim ? aqua : theme.light,
    'left',
    mono
  );
  const have = r.items.filter((_, i) => s.bag & (1 << i)).length;
  label(
    c,
    'Pages ' +
      have +
      '/' +
      r.items.length +
      '  •  Tapes ' +
      s.charges +
      (r.keyAt >= 0 ? '  •  Card ' + (s.key ? '✓' : '–') : ''),
    58,
    top + b.foot * 0.69,
    Math.min(15, Math.max(12, footW * 0.03)),
    paper,
    'left'
  );
  if (footW > 550)
    label(
      c,
      'TURN  ' + v.turns + '   /   QUIET PAR ' + v.par,
      footW - 22,
      top + b.foot * 0.48,
      14,
      theme.light,
      'right',
      mono
    );
}
export function journal(c, w, h, r, entry, page, earned) {
  const theme = wings[r.wing],
    m = Math.max(12, Math.min(w, h) * 0.045);
  gradient(c, 0, 0, w, h, [theme.ink, '#302839']);
  panel(c, m, m, w - 2 * m, h - 2 * m, '#f3e4ca', 10);
  const x = m + 16;
  label(c, 'RECOVERED EXHIBITS', x, m + 21, 13, theme.ink, 'left', mono);
  label(c, r.name, x, m + 52, Math.min(33, Math.max(19, w * 0.043)), ink, 'left', display);
  keepsake(c, w * 0.5, h * 0.43, Math.max(48, Math.min(138, h * 0.3)), r.wing);
  const text = entry ? r.fragmentText : 'A sealed exhibit. Recover its diary to reveal the slip.',
    words = text.split(' ');
  let lineText = '',
    yy = h * 0.7;
  c.font = '700 16px ' + sans;
  for (const word of words) {
    if (lineText && c.measureText(lineText + ' ' + word).width > w - 2 * x) {
      label(c, lineText, w / 2, yy, 16, ink);
      lineText = '';
      yy += 20;
    }
    lineText += (lineText ? ' ' : '') + word;
  }
  label(c, lineText, w / 2, yy, 16, ink);
  const sig = entry
    ? '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars) + '   •   ' + entry.turns + ' turns'
    : 'CASE ' + String(page + 1).padStart(2, '0') + '  /  36';
  label(c, sig, w / 2, h - m - 41, 15, theme.ink, 'center', mono);
  label(
    c,
    earned ? 'TAPE LABEL  ·  ' + theme.label.toUpperCase() : 'WING OBJECT  ·  ' + theme.object.toUpperCase(),
    w / 2,
    h - m - 15,
    12,
    theme.ink,
    'center',
    mono
  );
}
