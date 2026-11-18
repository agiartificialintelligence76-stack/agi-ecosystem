import { gradient, line, oval, polygon, panel, type } from '../kit/illustration.js';
import { worlds } from './dispatch.js';
import { footprint, materials, anchor, vectors, beltDir } from './rolling.js';
const ink = '#292438',
  cream = '#fff2ce',
  sans = '"AK Sans",sans-serif',
  mono = '"AK Mono",monospace',
  display = '"AK Display",sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const label = (c, text, x, y, size, fill = cream, align = 'center', family = sans) =>
  type(c, text, x, y, size, fill, align, family);
const cachedRig = new WeakMap();
export function rig(w, h, d) {
  const cached = cachedRig.get(d);
  if (cached?.w === w && cached.h === h) return cached;
  const head = Math.min(70, Math.max(38, h * 0.14)),
    foot = Math.min(58, Math.max(20, h * 0.11));
  const flats = [];
  for (let y = 0; y < d.rows.length; y++)
    for (let x = 0; x < d.rows[y].length; x++)
      if (d.rows[y][x] !== '.') {
        for (const [a, b] of [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ])
          flats.push([x + a - y - b, (x + a + y + b) * 0.52]);
      }
  const xs = flats.map((p) => p[0]),
    ys = flats.map((p) => p[1]),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys) - 2.15,
    ymax = Math.max(...ys) + 0.6;
  const s = Math.min((w * 0.91) / (xmax - xmin + 1), (h - head - foot) / (ymax - ymin + 0.75), 76);
  const ox = w * 0.5 - ((xmin + xmax) * s) / 2,
    oy = head + (h - head - foot) * 0.53 - ((ymin + ymax) * s) / 2;
  const result = {
    w,
    h,
    s,
    head,
    foot,
    pt: (x, y, z = 0) => [ox + (x - y) * s, oy + (x + y) * s * 0.52 - z * s * 1.16],
  };
  cachedRig.set(d, result);
  return result;
}
function block(c, pt, x, y, z, width, depth, height, colors, weight = 1.6) {
  const a = pt(x, y, z + height),
    b = pt(x + width, y, z + height),
    d = pt(x, y + depth, z + height),
    e = pt(x + width, y + depth, z + height);
  polygon(c, [a, b, e, d], colors[0], ink, weight);
  polygon(c, [b, pt(x + width, y, z), pt(x + width, y + depth, z), e], colors[1], ink, weight);
  polygon(c, [d, e, pt(x + width, y + depth, z), pt(x, y + depth, z)], colors[2], ink, weight);
}
function agi(c, x, y, s, time, lean, stamp) {
  c.save();
  c.translate(x, y);
  c.scale(s / 65, s / 65);
  const bob = Math.sin(time * 3) * 0.7;
  oval(c, 1, 1, 18, 4, '#2525346f');
  c.translate(0, bob);
  const pivot = lean ? -0.16 * Math.sin(lean * Math.PI) : 0;
  c.rotate(pivot);
  line(
    c,
    [
      [-6, -17],
      [-8, -6],
      [-12, -2],
      [-17, -2],
    ],
    ink,
    4
  );
  line(
    c,
    [
      [6, -17],
      [9, -6],
      [14, -3],
    ],
    ink,
    4
  );
  polygon(
    c,
    [
      [-10, -46],
      [-17, -50],
      [-22, -31],
      [-28, -24],
      [-17, -23],
      [-7, -37],
    ],
    '#c6e8ff',
    ink,
    2
  );
  polygon(
    c,
    [
      [8, -46],
      [15, -48],
      [19, -29],
      [25, -24],
      [16, -25],
      [8, -37],
    ],
    '#dceaff',
    ink,
    2
  );
  polygon(
    c,
    [
      [-9, -34],
      [9, -34],
      [15, -16],
      [-13, -16],
    ],
    '#355964',
    ink,
    2
  );
  polygon(
    c,
    [
      [-7, -34],
      [-2, -27],
      [4, -33],
      [8, -24],
      [9, -18],
      [-8, -18],
    ],
    '#faa976',
    ink,
    1.5
  );
  line(
    c,
    [
      [1, -24],
      [4, -21],
    ],
    '#fff0b7',
    2
  );
  oval(c, 0, -43, 12, 12, '#ffe2c6', ink, 2);
  polygon(
    c,
    [
      [-12, -45],
      [-11, -52],
      [-4, -58],
      [8, -55],
      [14, -48],
      [11, -44],
      [8, -48],
      [3, -44],
      [1, -49],
      [-5, -44],
      [-9, -47],
    ],
    '#e5f2ff',
    ink,
    1.7
  );
  polygon(
    c,
    [
      [-14, -50],
      [-12, -57],
      [1, -62],
      [12, -57],
      [15, -53],
      [3, -52],
      [-5, -49],
    ],
    '#e58a59',
    ink,
    2
  );
  for (const dx of [-4, 5]) oval(c, dx, -43, 1.7, 2.3, '#a2356a');
  line(
    c,
    [
      [-9, -31],
      [-16, -22],
      [-21, -21],
    ],
    '#f4c3ab',
    4
  );
  line(
    c,
    [
      [9, -32],
      [18, stamp ? -42 : -25],
      [23, stamp ? -47 : -25],
    ],
    '#f4c3ab',
    4
  );
  if (stamp) {
    panel(c, 19, -56, 8, 11, '#a16b43', 2);
    panel(c, 16, -48, 15, 4, ink, 1);
  } else {
    line(
      c,
      [
        [22, -27],
        [26, -25],
        [29, -8],
        [41, -7],
      ],
      '#493743',
      2.6
    );
    oval(c, 29, -5, 3.5, 3.5, '#2c3848', cream, 0.9);
  }
  c.restore();
}
function parcel(c, r, old, dir, t, offset = [0, 0], half = false, active = true) {
  const { pt, s } = r,
    flat = half ? 'half' : old.o,
    w = flat === 'x' ? 2 : 1,
    d = flat === 'y' ? 2 : 1,
    h = flat === 'up' ? 2 : 1;
  const bx = old.x,
    by = old.y;
  const [dx, dy] = vectors[dir] || [0, 0],
    rot = (dx || dy) && !half ? (t * Math.PI) / 2 : 0,
    cs = Math.cos(rot),
    sn = Math.sin(rot);
  const pivotX = bx + (dx > 0 ? w : 0),
    pivotY = by + (dy > 0 ? d : 0);
  function corner(u, v, z) {
    let x = bx + u * w,
      y = by + v * d,
      height = z * h;
    if (dx && rot) {
      const local = x - pivotX;
      x = pivotX + local * cs + dx * height * sn;
      height = height * cs - dx * local * sn;
    }
    if (dy && rot) {
      const local = y - pivotY;
      y = pivotY + local * cs + dy * height * sn;
      height = height * cs - dy * local * sn;
    }
    return [x + offset[0], y + offset[1], height];
  }
  const faces = [
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [1, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  ];
  const colors = active
    ? ['#b88460', '#ffe39e', '#bb855c', '#e9a968', '#c99365', '#d19365']
    : ['#918192', '#cab1b4', '#aa92a0', '#b29ba5', '#a68c9b', '#b599a4'];
  const sides = faces
    .map((points, i) => {
      const c3 = points.map((p) => corner(...p));
      return { p: c3.map((k) => pt(...k)), i, depth: c3.reduce((n, [x, y, z]) => n + x + y + z * 0.86, 0) };
    })
    .sort((a, b) => a.depth - b.depth);
  for (const face of sides) {
    const [a, b, , d] = face.p;
    const affine = (u, v) => [
      a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v,
      a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v,
    ];
    polygon(c, face.p, colors[face.i], ink, Math.max(1, s * 0.045));
    polygon(
      c,
      [
        [0.42, 0],
        [0.57, 0],
        [0.57, 1],
        [0.42, 1],
      ].map(([u, v]) => affine(u, v)),
      '#e76c64'
    );
    if (face.i % 2 === 1) {
      polygon(
        c,
        [
          [0.08, 0.14],
          [0.35, 0.14],
          [0.35, 0.45],
          [0.08, 0.45],
        ].map(([u, v]) => affine(u, v)),
        '#fff4c8'
      );
      for (let k = 0; k < 3; k++)
        line(
          c,
          [affine(0.125, 0.21 + k * 0.065), affine(0.3, 0.21 + k * 0.065)],
          '#4b5052',
          Math.max(0.6, s * 0.022)
        );
      for (let k = 0; k < 5; k++)
        line(
          c,
          [affine(0.68, 0.7 + k * 0.039), affine(0.9, 0.7 + k * 0.039)],
          '#81584277',
          Math.max(0.4, s * 0.014)
        );
      c.save();
      c.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
      c.translate(0.78, 0.31);
      c.scale(0.2, 0.2);
      oval(c, 0, 0, 0.88, 0.88, '#ffedb8', '#855744', 0.065);
      polygon(
        c,
        [
          [-0.38, -0.3],
          [-0.68, -0.43],
          [-0.77, 0.27],
          [-0.44, 0.17],
        ],
        '#e0eafa',
        '#443c52',
        0.09
      );
      polygon(
        c,
        [
          [0.38, -0.3],
          [0.68, -0.43],
          [0.76, 0.27],
          [0.44, 0.17],
        ],
        '#e0eafa',
        '#443c52',
        0.09
      );
      oval(c, 0, 0.02, 0.46, 0.5, '#ffd1b1', '#49394d', 0.09);
      polygon(
        c,
        [
          [-0.46, -0.12],
          [-0.38, -0.41],
          [0.06, -0.54],
          [0.4, -0.36],
          [0.48, -0.05],
          [0.18, -0.17],
          [0.02, 0.02],
          [-0.12, -0.14],
          [-0.25, -0.02],
        ],
        '#e5f1ff',
        '#594657',
        0.065
      );
      oval(c, -0.17, 0.09, 0.06, 0.09, '#994267');
      oval(c, 0.18, 0.09, 0.06, 0.09, '#994267');
      c.restore();
    }
  }
}
function tile(c, r, d, state, x, y, v) {
  const { pt, s } = r,
    id = x + ',' + y,
    kind = d.rows[y][x],
    mat = materials(d);
  if (kind === '.' || mat.glass.get(id) & state.broken) return;
  const world = worlds[d.world],
    goal = d.goal === id,
    seam = d.seams.some((pair) => pair.some((p) => p.join() === id)),
    top = goal
      ? '#f8d667'
      : seam
        ? '#c4ddbb'
        : kind === '~'
          ? '#a8e7ef'
          : kind === 'O'
            ? '#bbb2f4'
            : beltDir[kind]
              ? '#b8bac4'
              : kind === '*'
                ? '#f6b9c4'
                : kind === '+'
                  ? '#ffe99e'
                  : world.trim;
  block(
    c,
    pt,
    x + 0.025,
    y + 0.025,
    -0.22,
    0.95,
    0.95,
    0.22,
    [top, '#526873', '#789087'],
    Math.max(0.65, s * 0.028)
  );
  const [cx, cy] = pt(x + 0.5, y + 0.5, 0.01),
    size = Math.max(10, s * 0.48);
  if (goal) {
    oval(c, cx, cy, s * 0.55, s * 0.24, '#c5a13c', ink, 1.4);
    oval(c, cx, cy, s * 0.31, s * 0.12, '#ffed9e');
  } else if (kind === '~') {
    line(
      c,
      [pt(x + 0.18, y + 0.4, 0.02), pt(x + 0.55, y + 0.42, 0.02), pt(x + 0.7, y + 0.77, 0.02)],
      '#4b9fbc',
      1.4
    );
  } else if (kind === 'O') {
    oval(c, cx, cy, s * 0.52, s * 0.26, '#463a72', ink, 1.4);
    const pair = d.chutes.findIndex((pair) => pair.some((p) => p.join() === id));
    label(c, String.fromCharCode(65 + pair), cx, cy, Math.max(10, size * 0.8), cream);
  } else if (beltDir[kind]) {
    const [dx, dy] = vectors[beltDir[kind]],
      [ex, ey] = pt(x + 0.5 + dx * 0.36, y + 0.5 + dy * 0.36, 0.02),
      [sx, sy] = pt(x + 0.5 - dx * 0.35, y + 0.5 - dy * 0.35, 0.02);
    line(
      c,
      [
        [sx, sy],
        [ex, ey],
      ],
      ink,
      2
    );
    const vx = ex - sx,
      vy = ey - sy;
    polygon(
      c,
      [
        [ex, ey],
        [ex - vx * 0.4 + vy * 0.34, ey - vy * 0.4 - vx * 0.34],
        [ex - vx * 0.4 - vy * 0.34, ey - vy * 0.4 + vx * 0.34],
      ],
      ink
    );
  } else if (kind === '*' || seam || kind === '+')
    label(c, kind === '*' ? '✂' : seam ? '╫' : state.post & mat.post.get(id) ? '✓' : '+', cx, cy, size, ink);
  if (v.preview?.includes(id)) {
    const path = [
      [0.11, 0.11],
      [0.89, 0.11],
      [0.89, 0.89],
      [0.11, 0.89],
      [0.11, 0.11],
    ].map(([a, b]) => pt(x + a, y + b, 0.025));
    line(c, path, '#ff6146', 2);
  }
}
export function draw(c, w, h, v) {
  const { depot: d, state, previous, time, fraction, roll } = v,
    r = rig(w, h, d),
    world = worlds[d.world],
    { pt, s, head, foot } = r;
  gradient(c, 0, 0, w, h, [world.dark, '#304752', '#293642']);
  loadingBay(c, w, head, h - foot, world, d.world, v.reduced ? 0 : time);
  // Numbered sorting cubbies, steel rails and hanging cable lights.
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 12; col++) {
      const bw = Math.max(42, w / 8),
        x = col * bw - 15,
        y = head + row * 24;
      panel(c, x, y, bw - 5, 20, '#f1daac12', 2);
      line(
        c,
        [
          [x + 4, y + 17],
          [x + bw * 0.6, y + 17],
        ],
        '#fff1c722',
        1
      );
    }
  for (let i = 0; i < 8; i++) {
    const x = (w * (i + 0.45)) / 8;
    line(
      c,
      [
        [x, head],
        [x, head + 9],
      ],
      '#172e37',
      2
    );
    oval(c, x, head + 11, 4, 2, '#ffe6a0');
  }
  panel(c, 0, h - foot * 0.84, w, foot, '#192f37', 0);
  for (let x = -30; x < w + 30; x += 32)
    polygon(
      c,
      [
        [x, h - foot * 0.84],
        [x + 9, h - foot * 0.84],
        [x + 18, h - foot * 0.84 + 6],
        [x + 9, h - foot * 0.84 + 6],
      ],
      '#dfbf6e'
    );
  for (let sum = 0; sum < d.rows.length + d.rows[0].length; sum++)
    for (let y = Math.max(0, sum - d.rows[0].length + 1); y <= Math.min(d.rows.length - 1, sum); y++)
      tile(c, r, d, state, sum - y, y, v);
  const [gx, gy] = d.goal.split(',').map(Number),
    [flagX, flagY] = pt(gx + 0.75, gy + 0.1, 0.05);
  line(
    c,
    [
      [flagX, flagY],
      [flagX, flagY - s * 0.66],
    ],
    ink,
    2
  );
  polygon(
    c,
    [
      [flagX, flagY - s * 0.69],
      [flagX + s * 0.4, flagY - s * 0.65],
      [flagX + s * 0.24, flagY - s * 0.4],
      [flagX, flagY - s * 0.43],
    ],
    '#ffcf65',
    ink,
    1
  );
  const old = previous,
    newPoint = anchor(state),
    oldPoint = anchor(old),
    a = fraction;
  const helper = pt(lerp(oldPoint[0], newPoint[0], a) - 0.31, lerp(oldPoint[1], newPoint[1], a) + 0.72, 0);
  const points = state.parts || [[state.x, state.y]];
  if (roll && old && !old.parts && !state.parts && a < 1 && v.pure) {
    parcel(c, r, old, roll, a);
  } else if (state.parts) {
    for (const [i, [x, y]] of points.entries()) {
      const from = old.parts?.[i] || oldPoint;
      parcel(
        c,
        r,
        { x: lerp(from[0], x, a), y: lerp(from[1], y, a), o: 'half' },
        null,
        0,
        [0, 0],
        true,
        i === state.active
      );
    }
  } else {
    parcel(c, r, state, null, 0, [lerp(oldPoint[0] - state.x, 0, a), lerp(oldPoint[1] - state.y, 0, a)]);
  }
  agi(c, helper[0], helper[1], Math.max(37, Math.min(93, s * 1.1)), v.reduced ? 0 : time, a < 1 ? a : 0, v.sealed);
  if (v.burst > 0 && !v.reduced) {
    const [x, y] = pt(newPoint[0] + 0.4, newPoint[1] + 0.4, 0.6);
    for (let i = 0; i < 12; i++) {
      const q = ((1 - v.burst) * Math.PI * 2 * i) / 12,
        rad = (1 - v.burst) * s * 0.85;
      oval(c, x + Math.cos(q + i) * rad, y + Math.sin(q + i) * rad, 2.1, 1.3, i % 2 ? world.tone : cream);
    }
  }
  panel(c, 0, 0, w, head, '#1c3541', 0);
  label(
    c,
    world.name.toUpperCase() + '  /  DEPOT ' + String(d.id).padStart(2, '0'),
    13,
    head * 0.26,
    12,
    world.tone,
    'left',
    mono
  );
  label(c, d.name, 13, head * 0.7, Math.max(17, Math.min(31, w * 0.046)), cream, 'left', display);
  if (w > 520)
    label(
      c,
      'PARCEL POST  ✦  ROUTE ' + String(d.id).padStart(3, '0'),
      w - 13,
      head * 0.52,
      14,
      world.trim,
      'right',
      mono
    );
  const instruction = v.sealed
    ? 'SIGNED FOR  ' + '★'.repeat(v.stars)
    : state.parts
      ? 'HALF ' + (state.active + 1) + '  •  JOIN THE STRIPED SEAM'
      : d.required
        ? state.post === d.required
          ? 'POSTAGE ✓   •   FIND THE SCALE'
          : 'COLLECT +   •   FIND THE SCALE'
        : 'STAND ON THE GOLD SCALE';
  if (foot >= 29)
    label(c, instruction, w / 2, h - foot * 0.34, Math.max(12, Math.min(17, foot * 0.32)), cream, 'center', mono);
}

function loadingBay(c, w, top, bottom, world, index, time) {
  const h = bottom - top,
    rail = top + h * 0.35,
    low = bottom - h * 0.071;
  c.save();
  c.beginPath();
  c.rect(0, top, w, h);
  c.clip();
  const light = '#e6e0bc42',
    shadow = '#172c384d',
    wash = world.trim + '39';
  // Cast iron desk uprights disappear behind the illuminated sorting island.
  for (const side of [0, 1]) {
    c.save();
    if (side) {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    const bw = w * 0.17;
    for (let i = 0; i < 3; i++) {
      const y = rail + i * h * 0.19;
      line(
        c,
        [
          [0, y],
          [bw, y],
        ],
        light,
        2.2
      );
      polygon(
        c,
        [
          [0, y],
          [bw * 0.52, y],
          [0, y + h * 0.095],
        ],
        shadow
      );
      if (index === 0 || index === 4) {
        for (let k = 0; k < 3; k++) {
          const x = k * bw * 0.27 + 1,
            height = h * (0.026 + ((k + i) % 3) * 0.012);
          panel(c, x, y - height, bw * 0.23, height, '#d7a77544', 1);
          line(
            c,
            [
              [x + bw * 0.115, y - height],
              [x + bw * 0.115, y],
            ],
            light,
            1.5
          );
        }
      }
      if (index === 1) {
        for (let k = 0; k < 3; k++) {
          const x = k * bw * 0.28;
          polygon(
            c,
            [
              [x, y - 3],
              [x + bw * 0.13, y - h * 0.09],
              [x + bw * 0.27, y - h * 0.073],
              [x + bw * 0.2, y],
            ],
            '#a7e4e240',
            '#c1edf559',
            1
          );
        }
      }
      if (index === 2) {
        for (let j = 0; j < 5; j++) {
          const x = j * bw * 0.19;
          oval(c, x, y - 5, bw * 0.073, bw * 0.073, '#35404d', light, 1.4);
          line(
            c,
            [
              [x, y - 5],
              [x + Math.cos(time * 1.4 + j) * bw * 0.055, y - 5 + Math.sin(time * 1.4 + j) * bw * 0.055],
            ],
            light,
            1
          );
        }
      }
      if (index === 3) {
        for (let j = 0; j < 4; j++) {
          const x = j * bw * 0.23;
          panel(c, x, y - h * 0.047, bw * 0.16, h * 0.04, light, 2);
          panel(c, x + bw * 0.06, y - h * 0.091, bw * 0.047, h * 0.047, '#d2b18861', 1);
        }
      }
    }
    line(
      c,
      [
        [bw, rail - h * 0.045],
        [bw, low],
      ],
      '#112e3a52',
      4
    );
    c.restore();
  }
  // The pressed-metal back wall carries the depot's own postmark.
  const cx = w * 0.76,
    cy = top + h * 0.25,
    r = Math.min(w * 0.065, h * 0.09);
  c.save();
  c.translate(cx, cy);
  c.rotate(-0.12);
  for (const k of [0.7, 1]) {
    c.beginPath();
    c.arc(0, 0, r * k, 0, Math.PI * 2);
    c.strokeStyle = light;
    c.lineWidth = 1.6;
    c.stroke();
  }
  for (let j = 0; j < 3; j++) {
    c.beginPath();
    c.moveTo(r * 0.75, j * r * 0.24 - r * 0.24);
    c.quadraticCurveTo(r * 1.4, j * r * 0.24 - r * 0.56, r * 2, j * r * 0.24 - r * 0.24);
    c.strokeStyle = light;
    c.lineWidth = 1.4;
    c.stroke();
  }
  const mark = ['✦', '◇', '»', '✂', '✉'][index];
  label(c, mark, 0, 0, Math.max(12, r), light);
  c.restore();
  for (let i = 0; i < 6; i++) {
    const x = (w * (i + 0.3)) / 6;
    line(
      c,
      [
        [x, low],
        [w * 0.5 + (x - w * 0.5) * 1.65, bottom],
      ],
      '#d7dbbb16',
      1.4
    );
  }
  line(
    c,
    [
      [0, low],
      [w, low],
    ],
    wash,
    1.5
  );
  if (index === 4) {
    for (let i = 0; i < 3; i++) {
      const x = ((time * 10 + i * w * 0.42) % (w * 1.2)) - 0.08 * w,
        y = top + h * (0.16 + i * 0.075);
      polygon(
        c,
        [
          [x, y],
          [x + 15, y - 4],
          [x + 7, y + 5],
          [x + 3, y + 1],
        ],
        world.trim + '6b'
      );
    }
  }
  c.restore();
}
export function drawLedger(c, w, h, catalog, index, book, badges) {
  const depot = catalog[index],
    world = worlds[depot.world],
    m = Math.max(10, Math.min(44, w * 0.06)),
    x = m + 15;
  gradient(c, 0, 0, w, h, ['#263c45', world.dark]);
  panel(c, m, m, w - m * 2, h - m * 2, '#fff1cd', 5);
  for (let i = 0; i < (w - m * 2) / 22; i++)
    panel(c, m + 3 + i * 22, m + 3, 10, 3, i % 2 ? '#ab4d54' : '#546d86', 0);
  const header = m + Math.min(50, h * 0.13),
    base = header + Math.min(61, h * 0.17),
    entries = catalog.filter((d) => d.world === depot.world);
  label(c, 'ROUTING LEDGER', x, header, Math.max(17, Math.min(34, w * 0.052)), ink, 'left', display);
  label(
    c,
    'DEPOT ' + (depot.world + 1) + '   /   ' + world.name.toUpperCase(),
    x,
    header + 23,
    12,
    world.dark,
    'left',
    mono
  );
  const gap = Math.min(34, (h - base - m - 29) / entries.length);
  for (const [i, item] of entries.entries()) {
    const y = base + i * gap,
      r = book.jobs[item.id];
    if (item.id === depot.id) panel(c, x - 5, y - gap * 0.43, w - 2 * x + 10, gap * 0.88, world.tone, 3);
    label(
      c,
      String(item.id).padStart(2, '0') + '   ' + item.name,
      x,
      y,
      Math.max(12, Math.min(18, w * 0.034)),
      ink,
      'left'
    );
    label(c, r ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '—', w - x, y, 13, world.dark, 'right');
  }
  label(
    c,
    badges.includes(world.emblem)
      ? world.emblem.toUpperCase() + ' EMBLEM  ✦'
      : 'EMBLEMS   ' + badges.length + ' / 5',
    x,
    h - m - 13,
    12,
    world.dark,
    'left',
    mono
  );
}
