import { polygon, line, oval, panel } from '../kit/illustration.js';
const ink = '#364855',
  straw = '#f4cf8c',
  chalk = '#ffedd2';
export function landmark(c, view, x, y, scale) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  if (view === 0) {
    line(c, [[0, 0], [0, -42]], ink, 4);
    oval(c, 0, -46, 14, 14, chalk, ink, 3);
    line(c, [[0, -55], [0, -46], [8, -42]], ink, 2);
  } else if (view === 1 || view === 4) {
    panel(c, -26, -40, 52, 40, view === 1 ? '#b88165' : '#758e95', 2);
    panel(c, -23, -34, 46, 27, ink, 2);
    panel(c, -27, -47, 54, 10, straw, 2);
    if (view === 1) {
      for (const dx of [-10, 9]) {
        oval(c, dx, -17, 9, 7, '#dbad6b', straw, 1.4);
        for (const z of [-4, 2]) line(c, [[dx + z, -21], [dx + z + 3, -18]], '#99764f', 1.4);
      }
    } else {
      c.fillStyle = '#d48a88';
      c.fillRect(-16, -31, 25, 22);
      oval(c, 6, -20, 9, 9, '#344455', chalk, 1.5);
      oval(c, 6, -20, 2.7, 2.7, straw);
    }
  } else if (view === 2) {
    panel(c, -24, -35, 48, 35, chalk, 3);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const sx = -21 + col * 10,
        sy = -32 + row * 9;
      polygon(c, [[sx, sy], [sx + 8, sy], [sx + 8, sy + 7]], (col + row) % 2 ? '#5f929c' : '#bf775d');
    }
  } else if (view === 3) {
    for (const x of [-15, 9]) {
      line(c, [[x, 0], [x, -38]], ink, 3);
      oval(c, x, -39, 7, 10, '#ffd181', ink, 2);
      line(c, [[x - 8, -47], [x + 8, -47]], ink, 3);
    }
  } else if (view === 5) {
    line(c, [[-21, 0], [-21, -25], [20, -25], [20, 0]], ink, 3);
    polygon(c, [[-28, -24], [-19, -40], [18, -40], [29, -24]], '#df8a76', ink, 2);
    for (const x of [-13, -1, 11]) line(c, [[x, -38], [x - 4, -26]], chalk, 3);
    for (const x of [-12, -3, 6, 15]) oval(c, x, -10, 4, 4, straw, ink, 1);
    line(c, [[-22, -5], [22, -5]], ink, 3);
  } else if (view === 6) {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = ['#c38370', '#d4b189', '#6b9693'][i % 3];
      c.fillRect(-24 + i * 8, -i * 5, 38 - i * 4, i * 5 + 4);
    }
    line(c, [[-25, -8], [12, -35], [26, -35]], ink, 2.4);
  } else {
    for (let i = 0; i < 5; i++) {
      const x = -23 + i * 9,
        h = [21, 33, 44, 29, 20][i];
      c.fillStyle = '#637484';
      c.fillRect(x, -h, 8, h);
      for (let yy = -h + 3; yy < -3; yy += 6) {
        c.fillStyle = straw;
        c.fillRect(x + 3, yy, 2, 3);
      }
    }
  }
  c.restore();
}
