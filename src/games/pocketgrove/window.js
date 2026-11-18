import { landmark } from './landmarks.js';
import { polygon as poly, line, oval, panel, gradient } from '../kit/illustration.js';
const ink = '#30313f',
  brass = '#dab97c',
  butter = '#ffe5aa';
export function seatmate(c, x, y, scale, t, excited) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  const wave = excited ? Math.sin(t * 5) * 3 : 0,
    breath = Math.sin(t * 2) * .6;
  // Bent legs and a coat over the seat. Loose curls overlap her book.
  line(c, [[-3, 5], [10, 7], [18, 14], [14, 29]], ink, 7);
  line(c, [[4, 4], [16, 5], [23, 13], [23, 26]], '#51485c', 7);
  poly(c, [[11, 26], [16, 26], [18, 31], [11, 32], [7, 31]], '#674741', ink, 1.5);
  poly(c, [[20, 25], [25, 24], [29, 29], [24, 31], [20, 30]], '#674741', ink, 1.4);
  c.translate(0, breath);
  poly(c, [[-11, -20], [1, -24], [10, -17], [12, -6], [19, 2], [12, 7], [-11, 8], [-14, 2]], '#866ab2', ink, 1.8);
  poly(c, [[-11, -14], [-17, -7], [-13, 0], [-9, -4]], '#af93c7', ink, 1.5);
  poly(c, [[-13, -35], [-17, -23], [-19, -19], [-15, -17], [-20, -10], [-15, -7], [-16, -3], [-5, -8], [0, -21]], '#e5ac62', ink, 1.8);
  oval(c, -2, -30, 10, 12, '#ffdbb6', ink, 1.7);
  poly(c, [[-13, -29], [-11, -39], [-6, -43], [0, -42], [6, -39], [10, -33], [6, -34], [5, -31], [1, -35], [-1, -29], [-3, -33], [-7, -26], [-8, -30]], '#f3c575', ink, 1.5);
  oval(c, 2, -28.5, 1.45, 1.7, '#544457');
  oval(c, 7, -29, 1.05, 1.5, '#544457');
  line(c, [[4, -24], [6, -23.4], [7.5, -24.5]], '#b66b6b', 1.3);
  poly(c, [[-14, -36], [-16, -41], [-9, -48], [3, -49], [10, -44], [10, -40], [-1, -39]], '#ba738a', ink, 1.6);
  line(c, [[-9, -40], [6, -42], [12, -40]], '#e9a299', 2.5);
  poly(c, [[-6, -20], [4, -22], [8, -18], [1, -16], [-3, -13]], '#da815f', ink, 1.4);
  line(c, [[6, -17], [13, -10], [excited ? 24 : 19, excited ? -19 + wave : -12]], '#ffd4b0', 4);
  poly(c, [[3, -8], [11, -11], [19, -8], [13, -4], [8, -5]], butter, ink, 1);
  c.restore();
}
function building(c, x, y, u, kind, i) {
  const w = (13 + i % 4 * 4) * u,
    h = (15 + i * 13 % 30) * u;
  if (kind === 'orchard') {
    c.fillStyle = '#6b7361';
    c.fillRect(x - 1.5 * u, y - h * .5, 3 * u, h * .5);
    oval(c, x, y - h * .64, w * .65, h * .45, i % 2 ? '#69866c' : '#83975f');
    for (let k = 0; k < 3; k++) oval(c, x + (k - 1) * 6 * u, y - h * .55 - k % 2 * 5 * u, 1.8 * u, 1.8 * u, '#cf7961');
  } else if (kind === 'cliff') {
    poly(c, [[x - w, y], [x - w * .4, y - h], [x, y - h * 1.2], [x + w, y]], i % 2 ? '#80948b' : '#9c9e8e');
    poly(c, [[x - w * .4, y - h], [x, y - h * 1.2], [x + w * .28, y - h * .8]], '#eddebd');
  } else {
    c.fillStyle = i % 2 ? '#a18a83' : '#89949a';
    c.fillRect(x, y - h, w, h);
    if (kind === 'tower') poly(c, [[x - 2 * u, y - h], [x + w * .5, y - h - 11 * u], [x + w + 2 * u, y - h]], '#747589');else if (kind === 'quay') poly(c, [[x - w * .1, y - h], [x + w * .5, y - h - 6 * u], [x + w * 1.1, y - h]], '#aa7563');
    for (let row = 0; row < 2; row++) for (let k = 0; k < 2; k++) {
      c.fillStyle = (i + row + k) % 3 ? '#f4d898' : '#6e7680';
      c.fillRect(x + (3 + k * 6) * u, y - h + (3 + row * 7) * u, 2.7 * u, 3.2 * u);
    }
  }
}
const wrap = (v, k) => (v % k + k) % k;
export function coach(c, box, book, v) {
  const {
      x,
      y,
      w,
      h
    } = box,
    night = book.night.shift === 2,
    region = book.city;
  c.save();
  c.translate(x, y);
  const sceneY = 5,
    windowH = h * .77;
  panel(c, 0, 0, w, h, '#385254', 14);
  c.save();
  c.beginPath();
  c.roundRect(7, sceneY, w - 14, windowH, 12);
  c.clip();
  gradient(c, 0, 0, w, windowH, night ? ['#51597e', '#dbb29c'] : region.sky);
  const u = Math.max(1, Math.min(w / 330, windowH / 155)),
    motion = v.quiet ? 0 : v.journey;
  oval(c, w * .75, windowH * .35, windowH * .13, windowH * .13, '#f9dfa5');
  c.fillStyle = '#a7a992';
  c.beginPath();
  c.moveTo(-2, windowH);
  for (let i = -3; i < w + 7; i += 5) {
    c.lineTo(i, windowH * .65 + Math.sin(i / (w * .18) + motion * .07) * windowH * .095);
  }
  c.lineTo(w + 8, windowH);
  c.closePath();
  c.fill();
  for (let i = 0; i < 14; i++) {
    const bx = wrap(i * w * .112 - motion * 14, w + 60) - 32;
    building(c, bx, windowH * .79, u, region.type, i);
  }
  if (region.type === 'quay' || region.type === 'ferry') {
    c.fillStyle = '#77989a';
    c.fillRect(0, windowH * .77, w, windowH * .15);
    for (let i = 0; i < 18; i++) {
      const xx = wrap(i * 73 - motion * 12, w + 40) - 20,
        yy = windowH * (.79 + i % 3 * .032);
      line(c, [[xx, yy], [xx + 8 + i % 4, yy]], '#c8c2a4', 1.4);
    }
    const boat = wrap(w * .32 - motion * 8, w + 100) - 30;
    poly(c, [[boat, windowH * .8], [boat + 28 * u, windowH * .8], [boat + 22 * u, windowH * .84], [boat + 7 * u, windowH * .84]], '#5a6970');
    line(c, [[boat + 12 * u, windowH * .8], [boat + 12 * u, windowH * .8 - 16 * u]], '#68747a', 1.4);
    poly(c, [[boat + 12 * u, windowH * .8 - 16 * u], [boat + 12 * u, windowH * .79], [boat + 2 * u, windowH * .79]], butter);
  }
  if (v.view != null && v.fraction >= .27 && v.fraction <= .82) {
    const visible = v.side === v.viewSide;
    const transit = v.quiet ? .5 : (v.fraction - .27) / .55;
    const lx = w * (visible ? .85 - .47 * transit : .39 + .4 * transit);
    if (visible) {
      landmark(c, v.view, lx, windowH * .84, Math.min(w / 215, windowH / 92));
    } else {
      const u = Math.min(w / 215, windowH / 92);
      for (let i = 0; i < 3; i++) {
        const a = lx + (i - 1) * 34 * u;
        line(c, [[a - 12 * u, windowH * .87], [a, windowH * .33], [a + 13 * u, windowH * .87]], '#657476', 3 * u);
      }
    }
  }
  const signX = wrap(w * .61 - motion * 36, w + 150) - 30;
  line(c, [[signX + 6, windowH], [signX + 6, windowH * .66]], '#586964', 3);
  panel(c, signX, windowH * .63, Math.max(58, w * .17), windowH * .12, '#f6e9c7', 2);
  c.fillStyle = ink;
  c.font = "700 " + Math.max(12, Math.min(17, w * .035)) + "px 'AK Sans',sans-serif";
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(region.stops[v.destination], signX + Math.max(58, w * .17) * .5, windowH * .69, Math.max(55, w * .17) - 4);
  // Passing poles provide close parallax; two long diagonal bands are the glass.
  const pole = wrap(w * .93 - motion * 49, w + 120) - 65;
  line(c, [[pole, 0], [pole + 5, windowH]], '#65736b', 4 * u);
  poly(c, [[w * .16, 0], [w * .27, 0], [w * .04, windowH], [0, windowH], [0, windowH * .76]], '#fff8d51e');
  poly(c, [[w * .76, 0], [w * .80, 0], [w * .59, windowH], [w * .55, windowH]], '#fff8d52b');
  c.restore();
  const sill = windowH + 5;
  panel(c, 4, sill - 1, w - 8, 8, brass, 3);
  c.fillStyle = '#b48467';
  c.fillRect(0, sill + 9, w, h - sill - 9);
  for (let i = 0; i < 6; i++) line(c, [[i * w / 6, sill + 9], [i * w / 6, h]], '#94765c', 1);
  const ss = Math.min(w * .0034, h * .0060, 2.45);
  panel(c, w * .15, h - 12 * ss, 63 * ss, 10 * ss, '#65495b', 5);
  panel(c, w * .16, h - 37 * ss, 9 * ss, 31 * ss, '#825869', 4);
  seatmate(c, w * .19 + 11 * ss, h - 23 * ss, ss, v.quiet ? 0 : v.time, v.excited);
  c.restore();
}
