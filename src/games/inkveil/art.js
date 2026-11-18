import { line, polygon, oval, panel, type } from '../kit/illustration.js';
import { createSprites, BOX } from '../epochs/sprite.js';
const ink = '#262439',
  ivory = '#fff1d6';
const cast = new Map();
function her(size) {
  const unit = Math.max(24, Math.min(134, Math.round(size / 3) * 3));
  if (!cast.has(unit)) {
    if (cast.size > 12) cast.clear();
    cast.set(unit, createSprites(unit, 1.5));
  }
  return cast.get(unit);
}
export function heroine(c, x, y, size, facing, time, walk, pose, sealed, reduced) {
  const art = her(size),
    u = art.u,
    step = !reduced && walk > 0.01 && walk < 0.9 ? 1 : 0,
    frame = sealed ? 2 : step;
  c.save();
  c.translate(x, y);
  const scale = size / u;
  const bob = reduced ? 0 : step ? -Math.sin(walk * Math.PI) * u * 0.05 : Math.sin(time * 2.5) * u * 0.009;
  oval(c, 0, 0, u * 0.39, u * 0.105, '#271d3288');
  c.scale(scale, scale * (pose ? 0.79 : 1));
  c.translate(0, bob);
  c.drawImage(art.get(facing, frame), -BOX.fx * u, -BOX.fy * u, BOX.w * u, BOX.h * u);
  // A narrow cloche, lavender satchel and hanging recorder belong to this case.
  c.save();
  c.translate(0, -u * 1.19);
  c.rotate(facing === 3 ? -0.08 : 0.07);
  oval(c, 0, 0, u * 0.34, u * 0.064, '#51445f', ink, Math.max(1, u * 0.019));
  c.beginPath();
  c.moveTo(-u * 0.26, -u * 0.02);
  c.quadraticCurveTo(-u * 0.22, -u * 0.29, -u * 0.07, -u * 0.25);
  c.quadraticCurveTo(u * 0.13, -u * 0.34, u * 0.24, -u * 0.1);
  c.lineTo(u * 0.27, -u * 0.02);
  c.closePath();
  c.fillStyle = '#a38fac';
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1, u * 0.019);
  c.stroke();
  line(
    c,
    [
      [-u * 0.24, -u * 0.055],
      [u * 0.02, -u * 0.028],
      [u * 0.25, -u * 0.078],
    ],
    '#6c4279',
    u * 0.042
  );
  c.restore();
  const sign = facing === 3 ? -1 : 1;
  line(
    c,
    [
      [sign * -u * 0.17, -u * 0.64],
      [sign * u * 0.23, -u * 0.33],
    ],
    '#7c5c53',
    u * 0.045
  );
  panel(c, sign * u * 0.22 - u * 0.1, -u * 0.38, u * 0.24, u * 0.19, '#765077', u * 0.03);
  oval(c, sign * u * 0.22 + u * 0.025, -u * 0.31, u * 0.035, u * 0.03, '#efd7aa');
  c.restore();
}
export function docent(c, x, y, s, g, time, listen) {
  c.save();
  c.translate(x, y);
  c.scale(s / 80, s / 80);
  const walking = g.to >= 0 ? Math.sin(time * 6) * 1.2 : 0;
  oval(c, 0, 0, 25, 5, '#28243570');
  line(
    c,
    [
      [-9, -13],
      [-11, -3 - walking],
      [-16, -2 - walking],
    ],
    ink,
    5
  );
  line(
    c,
    [
      [10, -14],
      [12, -3 + walking],
      [17, -2 + walking],
    ],
    ink,
    5
  );
  c.translate(0, walking * 0.4);
  polygon(
    c,
    [
      [-18, -38],
      [-10, -44],
      [10, -44],
      [18, -36],
      [16, -13],
      [-16, -13],
    ],
    '#5c6771',
    ink,
    2
  );
  polygon(
    c,
    [
      [-13, -36],
      [-2, -27],
      [12, -37],
      [9, -18],
      [-9, -18],
    ],
    '#a18a6b',
    ink,
    2
  );
  line(
    c,
    [
      [-13, -25],
      [11, -22],
    ],
    '#d6bd87',
    2
  );
  oval(c, 0, -21, 2, 2, '#f2cf70');
  polygon(
    c,
    [
      [-19, -47],
      [-20, -60],
      [-9, -53],
      [3, -55],
      [18, -59],
      [17, -44],
      [11, -38],
      [-10, -38],
    ],
    '#ad947b',
    ink,
    2
  );
  oval(c, -7, -47, 6.5, 6.2, '#ffdda2', ink, 2);
  oval(c, 7, -47, 6.5, 6.2, '#ffdda2', ink, 2);
  const [dx, dy] = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ][g.f];
  for (const ex of [-7, 7]) oval(c, ex + dx, -47 + dy, 2, 2.8, '#3a3441');
  polygon(
    c,
    [
      [-3, -44],
      [3, -44],
      [0, -39],
    ],
    '#eab35b',
    ink,
    1
  );
  line(
    c,
    [
      [-19, -32],
      [-26, -25],
      [-22, -20],
    ],
    '#b19168',
    4
  );
  const hand = g.f === 3 ? -24 : 24;
  line(
    c,
    [
      [g.f === 3 ? -15 : 15, -33],
      [hand, -29],
      [hand, -22],
    ],
    '#bc9b70',
    4
  );
  panel(c, hand - 5, -23, 11, 13, '#e7bf69', 2);
  line(
    c,
    [
      [hand - 6, -23],
      [hand + 6, -23],
    ],
    ink,
    2
  );
  if (listen) {
    for (let n = 0; n < 2; n++) {
      c.beginPath();
      c.arc(17, -54, 6 + n * 4, -1.3, 0.05);
      c.strokeStyle = '#9ce5d5';
      c.lineWidth = 1.8;
      c.stroke();
    }
  }
  c.restore();
}
export function keepsake(c, x, y, s, wing) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.13);
  c.scale(s / 70, s / 70);
  if (wing === 0 || wing === 2) {
    panel(c, -29, -18, 58, 36, wing === 2 ? '#b7dbea' : '#f1c37c', 5);
    line(
      c,
      [
        [-25, -9],
        [24, -9],
      ],
      ink,
      2
    );
    oval(c, -14, 3, 7, 7, wing === 2 ? '#be8f6e' : '#a6575d');
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [-1, -2 + i * 5],
          [19 - i * 3, -2 + i * 5],
        ],
        ink,
        1.5
      );
  } else if (wing === 1) {
    line(
      c,
      [
        [-18, 23],
        [-4, 2],
        [15, -25],
      ],
      '#345f58',
      3
    );
    for (let i = 0; i < 5; i++) {
      const yy = 14 - i * 7,
        xx = -12 + i * 5;
      polygon(
        c,
        [
          [xx, yy],
          [xx - 11, yy - 10],
          [xx - 9, yy + 2],
        ],
        '#74956f'
      );
      polygon(
        c,
        [
          [xx, yy],
          [xx + 13, yy - 8],
          [xx + 8, yy + 2],
        ],
        '#527b65'
      );
    }
  } else if (wing === 3) {
    panel(c, -27, -20, 54, 40, '#4c4057', 3);
    panel(c, -18, -14, 36, 27, '#cbb4bd', 1);
    polygon(
      c,
      [
        [-16, 9],
        [-4, -5],
        [2, 0],
        [9, -9],
        [16, 9],
      ],
      '#796782'
    );
    for (let i = 0; i < 4; i++) {
      panel(c, -24, -16 + i * 9, 3, 4, ivory, 0);
      panel(c, 21, -16 + i * 9, 3, 4, ivory, 0);
    }
  } else if (wing === 4) {
    polygon(
      c,
      [
        [-22, 19],
        [-10, -23],
        [24, -15],
        [14, 21],
      ],
      '#b1d9d8',
      ink,
      2
    );
    line(
      c,
      [
        [-14, 10],
        [5, -13],
        [18, -10],
      ],
      '#ecf6e4',
      3
    );
  } else {
    polygon(
      c,
      [
        [-13, -25],
        [13, -25],
        [11, 25],
        [0, 16],
        [-11, 25],
      ],
      '#9377a0',
      ink,
      2
    );
    oval(c, 0, -13, 4, 4, '#f0d095');
  }
  c.restore();
}
export function object(c, box, x, y, kind, theme, n) {
  const { pt, s } = box,
    p = (u, v, z = 0) => pt(x + u, y + v, z);
  if (kind === '#') {
    const bottom = [p(0.04, 0.04), p(0.96, 0.04), p(0.96, 0.96), p(0.04, 0.96)],
      top = [p(0.04, 0.04, 0.48), p(0.96, 0.04, 0.48), p(0.96, 0.96, 0.48), p(0.04, 0.96, 0.48)];
    polygon(c, [bottom[3], bottom[2], top[2], top[3]], '#73597b', ink, 1.6);
    polygon(c, [top[1], bottom[1], bottom[2], top[2]], '#51495d', ink, 1.5);
    polygon(c, top, '#ac9295', ink, 1.7);
    line(c, [p(0.08, 0.16, 0.49), p(0.87, 0.16, 0.49)], '#d7b99a', 1);
    const books = ['#c18b81', '#b9a57b', '#7f9e9b', '#ad88ad', '#787eaa'];
    for (let i = 0; i < 7; i++) {
      const u = 0.095 + i * 0.118,
        lift = 0.12 + ((i * 11 + n) % 6) * 0.018;
      polygon(
        c,
        [p(u, 0.96, 0.09), p(u + 0.09, 0.96, 0.09), p(u + 0.09, 0.96, 0.12 + lift), p(u, 0.96, 0.12 + lift)],
        books[(i + n) % 5]
      );
      line(c, [p(u, 0.96, 0.14), p(u + 0.085, 0.96, 0.14)], '#eee0b680', 1);
    }
  } else if (kind === '|') {
    polygon(
      c,
      [p(0.1, 0.53), p(0.91, 0.53), p(0.91, 0.53, 0.74), p(0.1, 0.53, 0.74)],
      '#9be5ec5e',
      '#b5eff1',
      1.8
    );
    line(c, [p(0.13, 0.55, 0.04), p(0.13, 0.55, 0.79)], ink, 2);
    line(c, [p(0.9, 0.55, 0.04), p(0.9, 0.55, 0.79)], ink, 2);
    line(c, [p(0.28, 0.54, 0.2), p(0.52, 0.54, 0.57)], '#e9ffffb0', 1.4);
  } else if (kind === 'C') {
    const [px, py] = p(0.5, 0.5, 0.13);
    c.save();
    c.translate(px, py);
    c.scale(s / 70, s / 70);
    line(
      c,
      [
        [0, 6],
        [0, -12],
        [9, -18],
      ],
      ink,
      4
    );
    polygon(
      c,
      [
        [-14, -25],
        [12, -26],
        [18, -17],
        [9, -10],
        [-13, -13],
      ],
      '#a9a2b1',
      ink,
      2
    );
    oval(c, 10, -18, 5, 4, '#f58b9e', ink, 1.5);
    c.restore();
  } else if (kind === '+') {
    line(
      c,
      [p(0.1, 0.3, 0.02), p(0.1, 0.3, 0.63), p(0.88, 0.3, 0.63), p(0.88, 0.3, 0.02)],
      '#71c7ca',
      Math.max(2, s * 0.05)
    );
  }
}
