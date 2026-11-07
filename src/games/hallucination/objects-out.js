// HALLUCINATION (2026-11-08): the picture book's things for outdoors, the sky, the sea, the city at night, space and the
// view from a train. The same rules as ./objects-home.js (its noun, its box, its parameters, how it may change, how it's
// drawn), the same pen (./paint.js).
import { rr, el, ci, poly, paint, fill, ink, line, tube, blob, gloss, gs, glow, pattern, symbol, starPath, TAU, darker, lighter } from './paint.js';
import { cloudShape, leaf } from './objects-home.js';

const pickN = (r, list, n) => Array.from({ length: n }, () => r.pick(list));
const SIGN_SYMS = ['arrow', 'heart', 'star', 'paw', 'note', 'cat', 'drop'];
const twinkle = (ctx, x, y, s, color) => { starPath(ctx, x, y, s, 4, 0.34); fill(ctx, color); };
const wheel = (ctx, S, x, y, r, hub = '#c9c4d6') => { ci(ctx, x, y, r); paint(ctx, S, '#3a3550'); ci(ctx, x, y, r * 0.45); paint(ctx, S, hub); };

export const OUT = {
  // ===== parks, streets, gardens =====
  tree: {
    noun: 'tree', kind: 'stand',
    box: (p) => (p.kind === 'pine' ? [-30, -116, 30, 0] : [-38, -112, 38, 0]),
    make: (r, pal) => ({ kind: r.pick(['round', 'round', 'pine']), c: r.pick(pal.leaves || [pal.leaf]), fr: r.int(0, 3), fc: r.pick(['#e2574c', '#f39a3c', '#ff8fb1']) }),
    muts: [['shape', 'kind', ['round', 'pine']], ['recolor', 'c', [-36, -112, 36, -40], 'leaves', { noun: 'tree' }], ['count', 'fr', 0, 4, [-30, -100, 30, -46], { noun: 'fruit on the tree', when: (p) => p.kind === 'round' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 22);
      const tw = S.pal.trunk || '#8a5a3c';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-4, -30, -5, -50); ctx.lineTo(5, -50); ctx.quadraticCurveTo(4, -30, 6, 0); ctx.closePath();
      paint(ctx, S, tw, [1, -50, 6, 50]);
      if (p.kind === 'pine') {
        ctx.beginPath();
        for (const [y, w] of [[-38, 30], [-62, 25], [-86, 19]]) { ctx.moveTo(-w, y); ctx.lineTo(0, y - 32); ctx.lineTo(w, y); ctx.closePath(); }
        blob(ctx, S, p.c, [6, -120, 30, 90]);
      } else {
        ctx.beginPath();
        for (const [x, y, r] of [[-18, -62, 18], [16, -64, 19], [-6, -84, 22], [12, -88, 17], [0, -60, 20]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        blob(ctx, S, p.c, [8, -112, 32, 72]);
        gloss(ctx, S, -8, -84, 13, 3.4, 4.4, 1.3);
        for (let i = 0; i < p.fr; i++) { const [x, y] = [[-16, -66], [14, -72], [-2, -92], [18, -90]][i]; ci(ctx, x, y, 3.6); paint(ctx, S, p.fc); }
      }
    },
  },
  bush: {
    noun: 'bush', kind: 'stand',
    box: () => [-28, -30, 28, 0],
    make: (r, pal) => ({ c: r.pick(pal.leaves || [pal.leaf]), n: r.int(0, 4), fc: r.pick(['#ff8fb1', '#ffffff', '#ffd45c']) }),
    muts: [['count', 'n', 0, 5, null, { noun: 'flowers on the bush' }], ['recolor', 'fc', null, 'flowers', { noun: 'bush flowers', when: (p) => p.n > 0 }], ['recolor', 'c', null, 'leaves', { noun: 'bush' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 26);
      ctx.beginPath();
      for (const [x, y, r] of [[-15, -11, 12], [0, -18, 14], [15, -11, 12], [0, -8, 13]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      ctx.rect(-27, -10, 54, 10);
      blob(ctx, S, p.c, [8, -32, 22, 32]);
      for (let i = 0; i < p.n; i++) { const [x, y] = [[-14, -16], [3, -24], [14, -14], [-4, -9], [9, -6]][i]; symbol(ctx, S, 'flower', x, y, 3.4, p.fc, { w: 0.55 }); }
    },
  },
  flowers: {
    noun: 'flowers', kind: 'stand',
    box: () => [-21, -27, 21, 0],
    make: (r, pal) => ({ n: r.int(3, 4), fc: pickN(r, pal.flowers || pal.acc, 5) }),
    muts: [['count', 'n', 2, 5, null, { noun: 'flowers' }], ['recolorAt', 'fc', 'n', (p, i) => { const [x, y] = FL_AT[i]; return [x - 6, y - 6, x + 6, y + 6]; }, { list: 'flowers', noun: 'flower' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 18);
      for (let i = 0; i < p.n; i++) { const [x, y] = FL_AT[i]; line(ctx, S, [x * 0.5, 0, x, y], 0.9, '#4f9d63'); }
      for (const [x, a] of [[-6, -2.3], [6, -0.8], [0, -1.7]]) { const lx = x, ly = -2; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + Math.cos(a) * 8 + 3, ly + Math.sin(a) * 8, lx + Math.cos(a) * 11, ly + Math.sin(a) * 11); ctx.quadraticCurveTo(lx + Math.cos(a) * 6 - 3, ly + Math.sin(a) * 6, lx, ly); paint(ctx, S, '#5fae6a'); }
      for (let i = 0; i < p.n; i++) { const [x, y] = FL_AT[i]; symbol(ctx, S, 'flower', x, y, 4.6, p.fc[i], { w: 0.6 }); }
    },
  },
  bench: {
    noun: 'bench', kind: 'stand',
    box: () => [-44, -38, 44, 0],
    make: (r, pal) => ({ c: r.chance(0.5) ? pal.wood : r.pick(pal.acc), n: r.int(2, 3) }),
    surface: () => ({ x0: -36, x1: 36, y: -18 }),
    muts: [['recolor', 'c'], ['count', 'n', 1, 3, [-40, -38, 40, -22], { noun: 'bench slats' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 40);
      const iron = '#3a3550';
      for (const x of [-34, 34]) { line(ctx, S, [x, 0, x, -36], 1.6, iron); line(ctx, S, [x - 4, 0, x + 4, 0], 1.6, iron); }
      for (let i = 0; i < p.n; i++) { rr(ctx, -42, -37 + i * 6, 84, 4.6, 2); paint(ctx, S, p.c, [-42, -35 + i * 6, 84, 3]); }
      rr(ctx, -44, -20, 88, 5.5, 2); paint(ctx, S, p.c, [-44, -17, 88, 3]);
      rr(ctx, -42, -14, 84, 3.4, 1.5); paint(ctx, S, darker(p.c, 0.12));
    },
  },
  streetlamp: {
    noun: 'street lamp', kind: 'stand',
    box: () => [-17, -126, 17, 0],
    make: (r, pal) => ({ pc: r.pick(pal.poles || ['#3a3550', '#2f6b5e', '#6b3bff']), head: r.pick(['lantern', 'globe', 'bell']), lc: r.pick(['#ffd27a', '#ffd27a', '#ffb3cf', '#bdf5e6']) }),
    muts: [['recolor', 'pc', [-6, -112, 6, 0], 'poles', { noun: 'lamp post' }], ['shape', 'head', ['lantern', 'globe', 'bell'], [-17, -126, 17, -98], { noun: 'street lamp' }], ['recolor', 'lc', [-17, -126, 17, -98], 'bulbs', { noun: 'street lamp light' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 12);
      if (S.night) { glow(ctx, 0, -110, 34, p.lc, 0.55); el(ctx, 0, 0, 30, 6); fill(ctx, `rgba(255,220,140,0.12)`); }
      rr(ctx, -8, -8, 16, 8, 2); paint(ctx, S, p.pc);
      rr(ctx, -2.6, -104, 5.2, 98, 2); paint(ctx, S, p.pc);
      rr(ctx, -5, -60, 10, 4, 1.5); paint(ctx, S, lighter(p.pc, 0.15));
      if (p.head === 'lantern') { poly(ctx, [-7, -104, 7, -104, 10, -120, -10, -120]); paint(ctx, S, p.lc); poly(ctx, [-12, -120, 12, -120, 0, -128]); paint(ctx, S, p.pc); line(ctx, S, [0, -104, 0, -120], 0.6); }
      else if (p.head === 'globe') { ci(ctx, 0, -114, 10); paint(ctx, S, p.lc); gloss(ctx, S, 0, -114, 6.5); rr(ctx, -4, -106, 8, 3, 1); paint(ctx, S, p.pc); }
      else { ctx.beginPath(); ctx.arc(0, -108, 13, Math.PI, 0); ctx.closePath(); paint(ctx, S, p.pc); el(ctx, 0, -107, 6, 3); paint(ctx, S, p.lc); }
    },
  },
  car: {
    noun: 'car', kind: 'stand', flip: true,
    box: () => [-48, -40, 48, 0],
    make: (r, pal) => ({ c: r.pick(pal.cars || pal.acc), shape: r.pick(['sedan', 'van', 'bubble']) }),
    muts: [['recolor', 'c', null, 'cars'], ['shape', 'shape', ['sedan', 'van', 'bubble']]],
    draw(ctx, p, S) {
      gs(ctx, S, 44);
      const glass = S.night ? '#4b5a9a' : '#bfe6f5';
      if (p.shape === 'van') {
        rr(ctx, -46, -40, 90, 32, 8); paint(ctx, S, p.c, [-46, -18, 90, 10]);
        rr(ctx, -38, -35, 22, 13, 3); paint(ctx, S, glass); rr(ctx, -12, -35, 22, 13, 3); paint(ctx, S, glass);
        ctx.beginPath(); ctx.moveTo(16, -35); ctx.lineTo(30, -35); ctx.quadraticCurveTo(38, -33, 40, -22); ctx.lineTo(16, -22); ctx.closePath(); paint(ctx, S, glass);
      } else if (p.shape === 'bubble') {
        ctx.beginPath(); ctx.moveTo(-44, -8); ctx.quadraticCurveTo(-44, -26, -26, -28); ctx.quadraticCurveTo(-14, -44, 10, -42); ctx.quadraticCurveTo(30, -40, 36, -26); ctx.quadraticCurveTo(46, -24, 46, -8); ctx.closePath();
        paint(ctx, S, p.c, [-46, -18, 94, 10]);
        ctx.beginPath(); ctx.moveTo(-18, -26); ctx.quadraticCurveTo(-10, -38, 4, -38); ctx.lineTo(4, -26); ctx.closePath(); paint(ctx, S, glass);
        ctx.beginPath(); ctx.moveTo(9, -26); ctx.lineTo(9, -38); ctx.quadraticCurveTo(24, -37, 30, -26); ctx.closePath(); paint(ctx, S, glass);
      } else {
        ctx.beginPath(); ctx.moveTo(-46, -8); ctx.lineTo(-46, -20); ctx.quadraticCurveTo(-44, -26, -30, -26); ctx.lineTo(-20, -38); ctx.lineTo(16, -38); ctx.lineTo(28, -26); ctx.quadraticCurveTo(46, -26, 46, -16); ctx.lineTo(46, -8); ctx.closePath();
        paint(ctx, S, p.c, [-46, -18, 94, 10]);
        poly(ctx, [-17, -34, -1, -34, -1, -26, -24, -26]); paint(ctx, S, glass); poly(ctx, [3, -34, 14, -34, 22, -26, 3, -26]); paint(ctx, S, glass);
      }
      rr(ctx, 40, -20, 6, 5, 2); paint(ctx, S, '#fff3b0');
      if (S.night) glow(ctx, 50, -17, 12, '#fff3b0', 0.6);
      rr(ctx, -47, -19, 5, 4, 1.5); paint(ctx, S, '#ff6b6b');
      line(ctx, S, [-2, -24, -2, -12], 0.6); rr(ctx, 2, -21, 6, 2, 1); fill(ctx, S.ink);
      wheel(ctx, S, -28, -6, 8); wheel(ctx, S, 28, -6, 8);
    },
  },
  sign: {
    noun: 'sign', kind: 'stand', flip: (p) => p.sym === 'arrow',
    box: () => [-16, -76, 16, 0],
    make: (r, pal) => ({ shape: r.pick(['circle', 'diamond', 'square', 'triangle']), c: r.pick(pal.signs || pal.acc), sym: r.pick(SIGN_SYMS) }),
    muts: [['shape', 'shape', ['circle', 'diamond', 'square', 'triangle'], [-16, -76, 16, -44], { noun: 'sign' }], ['recolor', 'c', [-16, -76, 16, -44], 'signs', { noun: 'sign' }], ['symbol', 'sym', SIGN_SYMS, [-16, -76, 16, -44], { noun: 'sign' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 6);
      rr(ctx, -2.2, -48, 4.4, 48, 1.5); paint(ctx, S, S.pal.metal || '#c9c4d6');
      const cy = -60;
      if (p.shape === 'circle') ci(ctx, 0, cy, 15);
      else if (p.shape === 'diamond') poly(ctx, [0, cy - 17, 17, cy, 0, cy + 17, -17, cy]);
      else if (p.shape === 'square') rr(ctx, -14, cy - 14, 28, 28, 4);
      else poly(ctx, [0, cy - 16, 16, cy + 12, -16, cy + 12]);
      paint(ctx, S, p.c);
      const inner = p.shape === 'triangle' ? [cy + 3, 6.5] : [cy, 8.5];
      symbol(ctx, S, p.sym, 0, inner[0], inner[1], '#fffaf0', { w: 0.6 });
    },
  },
  mailbox: {
    noun: 'mailbox', kind: 'stand', flip: true,
    box: () => [-15, -54, 20, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), up: r.chance(0.5) }),
    muts: [['recolor', 'c', [-15, -50, 15, -26]], ['toggle', 'up', 'shape', [6, -54, 20, -30], { noun: 'mailbox flag' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 8);
      rr(ctx, -3, -30, 6, 30, 1.5); paint(ctx, S, S.pal.wood || '#9a6b45');
      ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(-14, -40); ctx.arc(0, -40, 14, Math.PI, 0); ctx.lineTo(14, -26); ctx.closePath();
      paint(ctx, S, p.c, [6, -54, 9, 28]);
      el(ctx, -14, -38, 3, 11); paint(ctx, S, darker(p.c, 0.15));
      if (p.up) { rr(ctx, 13, -52, 3, 20, 1); paint(ctx, S, '#e2574c'); rr(ctx, 13, -52, 8, 6, 1); paint(ctx, S, '#e2574c'); }
      else { rr(ctx, 13, -34, 20, 3, 1); paint(ctx, S, '#e2574c'); }
    },
  },
  cone: {
    noun: 'traffic cone', kind: 'stand', small: true,
    box: () => [-13, -31, 13, 0],
    make: (r, pal) => ({ n: r.int(1, 2), c: r.pick(['#ff8a3d', '#ff8a3d', '#ff6fa8']) }),
    muts: [['count', 'n', 0, 3, null, { noun: 'stripes on the cone' }], ['recolor', 'c', null, 'cones', { noun: 'traffic cone' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 12);
      rr(ctx, -13, -4, 26, 4, 1.5); paint(ctx, S, p.c);
      poly(ctx, [-3.5, -30, 3.5, -30, 10, -4, -10, -4]); ctx.save(); ctx.fillStyle = p.c; ctx.fill(); ctx.clip();
      for (let i = 0; i < p.n; i++) { const y = -24 + i * 8 + (p.n === 1 ? 4 : 0); ctx.fillStyle = '#fffaf0'; ctx.fillRect(-12, y, 24, 4); }
      ctx.fillStyle = S.shade; ctx.fillRect(2, -30, 10, 26); ctx.restore();
      poly(ctx, [-3.5, -30, 3.5, -30, 10, -4, -10, -4]); ink(ctx, S);
    },
  },
  bicycle: {
    noun: 'bicycle', kind: 'stand', flip: true,
    box: () => [-35, -40, 35, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), bk: r.chance(0.5) }),
    muts: [['recolor', 'c'], ['toggle', 'bk', 'shape', [16, -38, 35, -20], { noun: 'bicycle basket' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 32);
      for (const x of [-22, 22]) { ci(ctx, x, -12, 12); ctx.lineWidth = S.lw * 2.2; ctx.strokeStyle = S.ink; ctx.stroke(); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = '#6a6480'; ctx.stroke(); ci(ctx, x, -12, 2); fill(ctx, S.ink); }
      ctx.beginPath(); ctx.moveTo(-22, -12); ctx.lineTo(-4, -12); ctx.lineTo(-10, -30); ctx.closePath(); ctx.moveTo(-4, -12); ctx.lineTo(16, -30); ctx.lineTo(-10, -30); ctx.moveTo(16, -30); ctx.lineTo(22, -12);
      tube(ctx, S, p.c, 2.6);
      line(ctx, S, [-10, -30, -12, -34], 1.2); rr(ctx, -18, -36, 12, 3.6, 1.8); paint(ctx, S, '#3a3550');
      line(ctx, S, [16, -30, 14, -38, 20, -38], 1.2);
      if (p.bk) { poly(ctx, [20, -34, 34, -34, 32, -22, 22, -22]); paint(ctx, S, S.pal.wicker || '#d9a066'); line(ctx, S, [21, -28, 33, -28], 0.5); }
    },
  },
  hydrant: {
    noun: 'fire hydrant', kind: 'stand', small: true,
    box: () => [-12, -31, 12, 0],
    make: (r) => ({ c: r.pick(['#e2574c', '#ffc933', '#6fb7e8']) }),
    muts: [['recolor', 'c', null, 'hydrants']],
    draw(ctx, p, S) {
      gs(ctx, S, 10);
      rr(ctx, -9, -3, 18, 3, 1); paint(ctx, S, darker(p.c, 0.15));
      rr(ctx, -7, -24, 14, 21, 3); paint(ctx, S, p.c, [2, -24, 6, 21]);
      for (const k of [-1, 1]) { rr(ctx, k * 9 - 3, -17, 6, 6, 1.5); paint(ctx, S, darker(p.c, 0.1)); }
      ctx.beginPath(); ctx.arc(0, -24, 7.5, Math.PI, 0); ctx.closePath(); paint(ctx, S, p.c);
      rr(ctx, -2, -33, 4, 3, 1); paint(ctx, S, darker(p.c, 0.2));
    },
  },
  snowman: {
    noun: 'snowman', kind: 'stand', flip: true,
    box: () => [-22, -68, 22, 0],
    make: (r, pal) => ({ sc: r.pick(pal.acc), hat: r.pick(['top', 'beanie']), hc: r.pick(['#3a3550', '#e2574c', '#6b3bff']), n: r.int(2, 3) }),
    muts: [['recolor', 'sc', [-12, -42, 16, -30], 'acc', { noun: 'snowman\'s scarf' }], ['shape', 'hat', ['top', 'beanie'], [-12, -68, 12, -52], { noun: 'snowman\'s hat' }], ['count', 'n', 1, 3, [-5, -32, 5, -8], { noun: 'snowman\'s buttons' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 20);
      const snow = '#fbfbff';
      ci(ctx, 0, -14, 15); paint(ctx, S, snow, [5, -30, 12, 30]);
      ci(ctx, 0, -37, 11); paint(ctx, S, snow, [4, -48, 9, 22]);
      ci(ctx, 0, -55, 8.5); paint(ctx, S, snow, [3, -64, 7, 18]);
      for (let i = 0; i < p.n; i++) { ci(ctx, 0, -31 + i * 6 - (p.n === 2 ? -3 : 0), 1.6); fill(ctx, S.ink); }
      ci(ctx, -3, -57, 1.2); fill(ctx, S.ink); ci(ctx, 3, -57, 1.2); fill(ctx, S.ink);
      poly(ctx, [0, -54.5, 10, -53, 0, -51.5]); paint(ctx, S, '#f39a3c');
      rr(ctx, -10, -47.5, 20, 5, 2.5); paint(ctx, S, p.sc); rr(ctx, 4, -45, 5, 12, 2); paint(ctx, S, p.sc);
      if (p.hat === 'top') { rr(ctx, -10, -64, 20, 3, 1); paint(ctx, S, p.hc); rr(ctx, -6.5, -76, 13, 13, 1.5); paint(ctx, S, p.hc); }
      else { ctx.beginPath(); ctx.arc(0, -61, 8.5, Math.PI, 0); ctx.closePath(); paint(ctx, S, p.hc); ci(ctx, 0, -70, 2.6); paint(ctx, S, '#fffaf0'); }
    },
  },
  bird: {
    noun: 'bird', kind: 'stand', flip: true, small: true,
    box: (p) => (p.pose === 'fly' ? [-12, -10, 12, 4] : [-11, -16, 11, 0]),
    make: (r, pal, o = {}) => ({ c: r.pick(pal.birds || ['#6fb7e8', '#f39a3c', '#ff7aa8', '#ffd45c']), pose: o.pose || 'sit' }),
    muts: [['recolor', 'c', null, 'birds']],
    draw(ctx, p, S) {
      if (p.pose === 'fly') {
        ctx.beginPath(); ctx.moveTo(-11, -6); ctx.quadraticCurveTo(-5, -12, -1, -3); ctx.quadraticCurveTo(5, -12, 11, -6); ctx.quadraticCurveTo(4, -5, 1, 2); ctx.quadraticCurveTo(-4, -5, -11, -6); ctx.closePath();
        paint(ctx, S, p.c);
        ci(ctx, 3, -2, 1); fill(ctx, S.ink);
        return;
      }
      poly(ctx, [-6, -6, -12, -10, -11, -4]); paint(ctx, S, darker(p.c, 0.12));
      el(ctx, 0, -7, 8, 6.5); paint(ctx, S, p.c, [3, -14, 6, 14]);
      el(ctx, 1.5, -5, 4.5, 3.2); fill(ctx, lighter(p.c, 0.45));
      ci(ctx, 5, -12, 4.6); paint(ctx, S, p.c);
      poly(ctx, [9, -12.6, 12.6, -11.4, 9, -10.2]); paint(ctx, S, '#f39a3c');
      ci(ctx, 6.4, -13, 1); fill(ctx, S.ink);
      line(ctx, S, [-1, -1, -1, 1], 0.8); line(ctx, S, [2.5, -1, 2.5, 1], 0.8);
    },
  },
  cloud: {
    noun: 'cloud', kind: 'float',
    box: (p) => [-p.n * 9 - 6, -16, p.n * 9 + 6, 9],
    make: (r, pal) => ({ n: r.pick([3, 4, 5]), c: r.pick(pal.clouds || ['#ffffff']) }),
    muts: [['shape', 'n', [3, 4, 5], null, { noun: 'cloud' }], ['recolor', 'c', null, 'clouds', { noun: 'cloud' }]],
    draw(ctx, p, S) {
      cloudShape(ctx, 0, 0, p.n * 3.4 + 4, p.n);
      blob(ctx, S, p.c, [-40, 2, 80, 10]);
    },
  },
  moon: {
    noun: 'moon', kind: 'float',
    box: () => [-20, -20, 20, 20],
    make: (r) => ({ shape: r.pick(['crescent', 'full']), c: r.pick(['#fff1b8', '#ffe0a3', '#f5f0ff']) }),
    muts: [['shape', 'shape', ['crescent', 'full']], ['recolor', 'c', null, 'moons']],
    draw(ctx, p, S) {
      glow(ctx, 0, 0, 26, p.c, 0.35);
      if (p.shape === 'full') { ci(ctx, 0, 0, 17); paint(ctx, S, p.c, [6, -18, 12, 36]); for (const [x, y, r] of [[-6, -4, 3.6], [5, 6, 2.6], [3, -9, 2]]) { ci(ctx, x, y, r); fill(ctx, darker(p.c, 0.1)); } }
      else symbol(ctx, S, 'moon', 0, 0, 17, p.c);
    },
  },
  sun: {
    noun: 'sun', kind: 'float',
    box: () => [-25, -25, 25, 25],
    make: (r) => ({ n: r.pick([8, 12]), c: r.pick(['#ffd45c', '#ffc040', '#ffe27a']), face: r.chance(0.5) }),
    muts: [['count', 'n', 8, 12, null, { noun: 'sun\'s rays', step: 4 }], ['toggle', 'face', 'shape', [-12, -12, 12, 12], { noun: 'sun' }], ['recolor', 'c', null, 'suns']],
    draw(ctx, p, S) {
      glow(ctx, 0, 0, 30, p.c, 0.35);
      for (let i = 0; i < p.n; i++) { const a = (i / p.n) * TAU, w = p.n > 8 ? 0.13 : 0.18; poly(ctx, [Math.cos(a - w) * 16, Math.sin(a - w) * 16, Math.cos(a) * 24, Math.sin(a) * 24, Math.cos(a + w) * 16, Math.sin(a + w) * 16]); paint(ctx, S, p.c); }
      ci(ctx, 0, 0, 15); paint(ctx, S, p.c, [6, -16, 10, 32]);
      if (p.face) { ci(ctx, -5, -2, 1.5); fill(ctx, S.ink); ci(ctx, 5, -2, 1.5); fill(ctx, S.ink); ctx.beginPath(); ctx.arc(0, 1, 5, 0.4, Math.PI - 0.4); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = S.ink; ctx.stroke(); el(ctx, -8, 3, 2.4, 1.4); fill(ctx, 'rgba(255,120,120,0.4)'); el(ctx, 8, 3, 2.4, 1.4); fill(ctx, 'rgba(255,120,120,0.4)'); }
    },
  },
  stars: {
    noun: 'stars', kind: 'float',
    box: () => [-30, -16, 30, 16],
    make: (r) => ({ n: r.int(3, 5), c: '#fff1b8' }),
    muts: [['count', 'n', 2, 5, null, { noun: 'stars' }]],
    draw(ctx, p, S) {
      for (let i = 0; i < p.n; i++) { const [x, y, s] = STAR_AT[i]; glow(ctx, x, y, s * 1.8, p.c, 0.3); twinkle(ctx, x, y, s, p.c); }
    },
  },
  balloon: {
    noun: 'balloons', kind: 'float',
    box: (p) => [p.n > 1 ? -17 : -10, -66, p.n > 1 ? 17 : 10, 0],
    make: (r, pal) => ({ n: r.int(1, 3), cols: pickN(r, pal.balloons || pal.acc, 3) }),
    muts: [['count', 'n', 1, 3, null, { noun: 'balloons' }], ['recolorAt', 'cols', 'n', (p, i) => { const [x, y] = BAL_AT[p.n][i]; return [x - 9, y - 11, x + 9, y + 11]; }, { list: 'balloons', noun: 'balloon' }]],
    draw(ctx, p, S) {
      const at = BAL_AT[p.n];
      for (let i = 0; i < p.n; i++) { const [x, y] = at[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(x * 0.3 + 3, y * 0.5, x, y + 11); ctx.lineWidth = S.lw * 0.6; ctx.strokeStyle = S.ink; ctx.stroke(); }
      for (let i = 0; i < p.n; i++) {
        const [x, y] = at[i];
        el(ctx, x, y, 8.6, 10.6); paint(ctx, S, p.cols[i], [x + 3, y - 12, 7, 24]);
        poly(ctx, [x - 2, y + 12.4, x + 2, y + 12.4, x, y + 10]); paint(ctx, S, p.cols[i]);
        gloss(ctx, S, x, y, 6, 3.5, 4.3, 1.1);
      }
    },
  },
  kite: {
    noun: 'kite', kind: 'float',
    box: () => [-18, -24, 18, 46],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = '#fffaf0'; return { c1, c2, n: r.int(2, 4) }; },
    muts: [['swap', 'c1', 'c2'], ['recolor', 'c1', [-18, -24, 18, 20], 'acc', { noun: 'kite' }], ['count', 'n', 1, 5, [-10, 16, 16, 46], { noun: 'bows on the kite\'s tail' }]],
    draw(ctx, p, S) {
      ctx.beginPath(); ctx.moveTo(0, 18); ctx.bezierCurveTo(10, 26, -6, 34, 8, 44); ctx.lineWidth = S.lw * 0.7; ctx.strokeStyle = S.ink; ctx.stroke();
      for (let i = 0; i < p.n; i++) { const t = (i + 1) / (p.n + 1), x = 10 * t * (1 - t) * 3 * (i % 2 ? -0.4 : 1) + 8 * t * t, y = 18 + 26 * t; poly(ctx, [x, y, x - 4, y - 3, x - 4, y + 3]); paint(ctx, S, p.c1); poly(ctx, [x, y, x + 4, y - 3, x + 4, y + 3]); paint(ctx, S, p.c1); }
      for (const [pts, c] of [[[0, -22, 16, -4, 0, 0], p.c1], [[0, -22, -16, -4, 0, 0], p.c2], [[-16, -4, 0, 18, 0, 0], p.c1], [[16, -4, 0, 18, 0, 0], p.c2]]) { poly(ctx, pts); paint(ctx, S, c); }
      line(ctx, S, [0, -22, 0, 18], 0.6); line(ctx, S, [-16, -4, 16, -4], 0.6);
    },
  },
  boat: {
    noun: 'boat', kind: 'stand', flip: true,
    box: () => [-30, -50, 30, 3],
    make: (r, pal) => ({ c: r.pick(pal.hulls || pal.acc), sc: r.pick(['#fffaf0', '#fffaf0', '#ffd45c', '#ff8fb1']), pat: r.pick(['plain', 'stripes']) }),
    muts: [['recolor', 'c', [-30, -12, 30, 3], 'hulls', { noun: 'boat' }], ['recolor', 'sc', [-22, -50, 22, -14], 'sails', { noun: 'sail' }], ['pattern', 'pat', ['plain', 'stripes'], [-22, -50, 22, -14], { noun: 'sail' }]],
    draw(ctx, p, S) {
      rr(ctx, -1.6, -50, 3.2, 40, 1); paint(ctx, S, S.pal.wood || '#9a6b45');
      poly(ctx, [-2, -48, -2, -14, -24, -14]); ctx.save(); ctx.fillStyle = p.sc; ctx.fill(); ctx.clip(); if (p.pat === 'stripes') pattern(ctx, 'bands', -26, -50, 26, 38, '#ff7a7a', 4); ctx.restore(); poly(ctx, [-2, -48, -2, -14, -24, -14]); ink(ctx, S);
      poly(ctx, [2, -44, 2, -16, 18, -16]); paint(ctx, S, p.sc);
      poly(ctx, [1.6, -52, 10, -49, 1.6, -46]); paint(ctx, S, '#ff6f91');
      ctx.beginPath(); ctx.moveTo(-28, -12); ctx.lineTo(28, -12); ctx.quadraticCurveTo(24, 2, 16, 2); ctx.lineTo(-18, 2); ctx.quadraticCurveTo(-26, 0, -28, -12); ctx.closePath();
      paint(ctx, S, p.c, [-28, -5, 56, 8]);
      line(ctx, S, [-25, -8, 25, -8], 0.6, lighter(p.c, 0.5));
    },
  },
  lighthouse: {
    noun: 'lighthouse', kind: 'stand', fixed: true,
    box: () => [-20, -100, 20, 0],
    make: (r, pal) => ({ n: r.int(2, 3), c: r.pick(['#e2574c', '#6b8fd6', '#ff7aa8']) }),
    muts: [['count', 'n', 1, 4, [-14, -70, 14, -8], { noun: 'stripes on the lighthouse' }], ['recolor', 'c', null, 'lighthouses', { noun: 'lighthouse' }]],
    draw(ctx, p, S) {
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-18, -9, -6, -10); ctx.quadraticCurveTo(10, -12, 20, 0); ctx.closePath(); paint(ctx, S, '#9a91a8');
      poly(ctx, [-10, -8, 10, -8, 7, -70, -7, -70]); ctx.save(); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.clip();
      const step = 62 / (p.n * 2);
      for (let i = 0; i < p.n; i++) { ctx.fillStyle = p.c; ctx.fillRect(-12, -70 + step * (i * 2 + 1), 24, step); }
      ctx.fillStyle = S.shade; ctx.fillRect(3, -72, 10, 66); ctx.restore();
      poly(ctx, [-10, -8, 10, -8, 7, -70, -7, -70]); ink(ctx, S);
      rr(ctx, -6, -24, 4, 7, 2); paint(ctx, S, '#3a3550');
      rr(ctx, -10, -73, 20, 4, 1); paint(ctx, S, '#3a3550');
      if (S.night || S.warm) glow(ctx, 0, -80, 22, '#fff1a8', 0.6);
      rr(ctx, -6, -86, 12, 13, 1); paint(ctx, S, '#fff1a8');
      line(ctx, S, [0, -86, 0, -73], 0.6);
      poly(ctx, [-9, -86, 9, -86, 0, -96]); paint(ctx, S, p.c);
    },
  },
  gull: {
    noun: 'seagull', kind: 'float', small: true,
    box: () => [-13, -8, 13, 5],
    make: () => ({}),
    draw(ctx, p, S) {
      ctx.beginPath(); ctx.moveTo(-13, -4); ctx.quadraticCurveTo(-6, -10, -1, -1); ctx.quadraticCurveTo(5, -10, 13, -4); ctx.quadraticCurveTo(5, -4, 1, 3); ctx.quadraticCurveTo(-4, -4, -13, -4); ctx.closePath();
      paint(ctx, S, '#fbfbff');
      poly(ctx, [2, 0, 6, 1, 2, 2]); paint(ctx, S, '#ffb43b');
    },
  },
  umbrella: {
    noun: 'beach umbrella', kind: 'stand', flip: true,
    box: () => [-44, -88, 44, 0],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = '#fffaf0'; return { c1, c2, n: r.pick([4, 6]) }; },
    muts: [['swap', 'c1', 'c2', [-44, -88, 44, -54], { noun: 'umbrella' }], ['recolor', 'c1', [-44, -88, 44, -54], 'acc', { noun: 'umbrella' }], ['count', 'n', 4, 6, [-44, -88, 44, -54], { noun: 'umbrella stripes', step: 2 }]],
    draw(ctx, p, S) {
      gs(ctx, S, 8);
      ctx.save(); ctx.rotate(0.14);
      rr(ctx, -1.8, -72, 3.6, 72, 1.5); paint(ctx, S, '#fffaf0');
      for (let i = 0; i < p.n; i++) {
        const a0 = Math.PI + (i / p.n) * Math.PI, a1 = Math.PI + ((i + 1) / p.n) * Math.PI;
        ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(Math.cos(a0) * 42, -60 + Math.sin(a0) * 4); ctx.quadraticCurveTo(Math.cos((a0 + a1) / 2) * 38, -58, Math.cos(a1) * 42, -60 + Math.sin(a1) * 4); ctx.closePath();
        ctx.fillStyle = i % 2 ? p.c2 : p.c1; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(-42, -60); ctx.quadraticCurveTo(-34, -86, 0, -86); ctx.quadraticCurveTo(34, -86, 42, -60);
      for (let i = p.n; i > 0; i--) { const a1 = Math.PI + ((i - 1) / p.n) * Math.PI, a0 = Math.PI + (i / p.n) * Math.PI; ctx.quadraticCurveTo(Math.cos((a0 + a1) / 2) * 38, -58, Math.cos(a1) * 42, -60); }
      ctx.closePath(); ink(ctx, S);
      ci(ctx, 0, -87, 2.4); paint(ctx, S, p.c1);
      ctx.restore();
    },
  },
  sandcastle: {
    noun: 'sandcastle', kind: 'stand',
    box: () => [-31, -50, 31, 0],
    make: (r, pal) => ({ n: r.int(2, 3), fc: r.pick(pal.acc) }),
    muts: [['count', 'n', 1, 3, null, { noun: 'sandcastle towers' }], ['recolor', 'fc', [-8, -50, 14, -36], 'acc', { noun: 'sandcastle flag' }]],
    draw(ctx, p, S) {
      const sand = '#e8c27e';
      gs(ctx, S, 28);
      const xs = p.n === 1 ? [0] : p.n === 2 ? [-14, 14] : [-20, 0, 20];
      line(ctx, S, [xs[Math.floor(xs.length / 2)], -36, xs[Math.floor(xs.length / 2)], -48], 0.8);
      poly(ctx, [xs[Math.floor(xs.length / 2)], -48, xs[Math.floor(xs.length / 2)] + 11, -45, xs[Math.floor(xs.length / 2)], -42]); paint(ctx, S, p.fc);
      for (const x of xs) {
        rr(ctx, x - 8, -34, 16, 20, 1.5); paint(ctx, S, sand, [x + 3, -34, 6, 20]);
        for (const dx of [-8, -2.6, 2.8]) { rr(ctx, x + dx, -38, 5.2, 4.5, 1); paint(ctx, S, sand); }
      }
      rr(ctx, -28, -16, 56, 16, 3); paint(ctx, S, sand, [10, -16, 18, 16]);
      ctx.beginPath(); ctx.arc(0, -2, 5.5, Math.PI, 0); ctx.lineTo(5.5, 0); ctx.lineTo(-5.5, 0); ctx.closePath(); paint(ctx, S, darker(sand, 0.35));
      for (const [x, y] of [[-18, -8], [17, -9], [-10, -24]]) { ci(ctx, x, y, 1); fill(ctx, darker(sand, 0.3)); }
    },
  },
  beachball: {
    noun: 'beach ball', kind: 'stand', small: true,
    box: () => [-13, -26, 13, 0],
    make: (r, pal) => ({ cols: pickN(r, pal.acc, 3) }),
    muts: [['recolorAt', 'cols', 3, null, { noun: 'beach ball' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 11);
      ctx.save(); ci(ctx, 0, -12.5, 12.5); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.clip();
      for (let i = 0; i < 6; i++) { if (i % 2) continue; const a = -Math.PI / 2 + (i * TAU) / 6; ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.arc(0, -12.5, 14, a - 0.5, a + 0.5); ctx.closePath(); ctx.fillStyle = p.cols[i / 2]; ctx.fill(); }
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * TAU) / 6 + 0.5; ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.lineTo(Math.cos(a) * 14, -12.5 + Math.sin(a) * 14); ctx.lineWidth = S.lw * 0.5; ctx.strokeStyle = S.ink; ctx.stroke(); }
      ctx.fillStyle = S.shade; ctx.fillRect(4, -26, 10, 26); ctx.restore();
      ci(ctx, 0, -12.5, 12.5); ink(ctx, S);
      ci(ctx, 0, -12.5, 2.4); paint(ctx, S, '#fffaf0');
      gloss(ctx, S, 0, -12.5, 9, 3.6, 4.4);
    },
  },
  towel: {
    noun: 'beach towel', kind: 'flat',
    box: () => [-40, -9, 40, 9],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = '#fffaf0'; return { c1, c2, pat: r.pick(['bands', 'stripes', 'checks', 'dots']) }; },
    muts: [['recolor', 'c1'], ['swap', 'c1', 'c2'], ['pattern', 'pat', ['bands', 'stripes', 'checks', 'dots']]],
    draw(ctx, p, S) {
      poly(ctx, [-34, -8, 38, -8, 34, 8, -38, 8]); ctx.save(); ctx.fillStyle = p.c1; ctx.fill(); ctx.clip();
      ctx.save(); ctx.translate(0, 0); if (p.pat === 'bands') { for (let x = -40; x < 40; x += 10) { ctx.fillStyle = p.c2; ctx.fillRect(x, -9, 5, 18); } } else pattern(ctx, p.pat, -40, -9, 80, 18, p.c2, 4.5); ctx.restore();
      ctx.restore(); poly(ctx, [-34, -8, 38, -8, 34, 8, -38, 8]); ink(ctx, S);
    },
  },
  crab: {
    noun: 'crab', kind: 'stand', small: true,
    box: () => [-15, -16, 15, 0],
    make: (r) => ({ c: r.pick(['#e2574c', '#ff7a5c', '#f39a3c']) }),
    muts: [['recolor', 'c', null, 'crabs']],
    draw(ctx, p, S) {
      gs(ctx, S, 11);
      for (const k of [-1, 1]) { for (const dx of [5, 8, 11]) line(ctx, S, [k * dx * 0.7, -4, k * dx, 0], 0.9); line(ctx, S, [k * 6, -7, k * 11, -11], 1.1); ci(ctx, k * 12, -12.5, 3.4); paint(ctx, S, p.c); }
      el(ctx, 0, -6, 9, 5.5); paint(ctx, S, p.c, [3, -12, 7, 12]);
      for (const k of [-1, 1]) { line(ctx, S, [k * 2.5, -10, k * 3, -14], 0.7); ci(ctx, k * 3, -14.5, 1.6); paint(ctx, S, '#fffaf0'); ci(ctx, k * 3, -14.5, 0.7); fill(ctx, S.ink); }
    },
  },
  palm: {
    noun: 'palm tree', kind: 'stand', flip: true,
    box: () => [-38, -116, 40, 0],
    make: (r) => ({ n: r.int(1, 3) }),
    muts: [['count', 'n', 0, 3, [-14, -100, 18, -82], { noun: 'coconuts' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 12);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-6, -60, 8, -94); ctx.lineTo(14, -92); ctx.quadraticCurveTo(4, -60, 6, 0); ctx.closePath();
      paint(ctx, S, S.pal.trunk || '#b07a52', [0, -94, 14, 94]);
      for (let y = -12; y > -86; y -= 9) { const t = -y / 94; line(ctx, S, [-5 + t * 12, y, 5 + t * 8, y - 2], 0.5); }
      const lf = '#5fae6a';
      for (const [a, len] of [[-3.0, 36], [-2.45, 40], [-1.9, 34], [-1.2, 36], [-0.6, 40], [-0.1, 34]]) {
        ctx.save(); ctx.translate(11, -96);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * len * 0.6 + 4, Math.sin(a) * len * 0.6 - 10, Math.cos(a) * len, Math.sin(a) * len + 8);
        ctx.quadraticCurveTo(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5 + 2, 0, 0); ctx.closePath();
        paint(ctx, S, lf); ctx.restore();
      }
      for (let i = 0; i < p.n; i++) { ci(ctx, [5, 14, 10][i], [-90, -88, -84][i], 4); paint(ctx, S, '#7a5236'); }
    },
  },
  bucket: {
    noun: 'bucket', kind: 'stand', small: true, flip: true,
    box: () => [-12, -24, 16, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 10);
      ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, 0); ctx.lineWidth = S.lw * 0.8; ctx.strokeStyle = S.ink; ctx.stroke();
      poly(ctx, [-10, -16, 10, -16, 7, 0, -7, 0]); paint(ctx, S, p.c, [2, -16, 8, 16]);
      rr(ctx, -11, -18, 22, 3.5, 1.5); paint(ctx, S, lighter(p.c, 0.2));
      ctx.save(); ctx.translate(10, -10); ctx.rotate(0.5); rr(ctx, -1.2, -12, 2.4, 14, 1); paint(ctx, S, '#ffd45c'); el(ctx, 0, 3, 3.4, 4.5); paint(ctx, S, '#ffd45c'); ctx.restore();
    },
  },
  icecream: {
    noun: 'ice cream', kind: 'stand', small: true,
    box: (p) => [-11, -16 - p.n * 9 - (p.ch ? 7 : 0), 11, 0],
    make: (r, pal) => ({ n: r.int(1, 3), cols: pickN(r, pal.scoops || ['#ffd3e0', '#fff4c9', '#c8f0dc', '#8a5a44', '#d6c4ff'], 3), ch: r.chance(0.5) }),
    muts: [['count', 'n', 1, 3, null, { noun: 'scoops' }], ['recolorAt', 'cols', 'n', (p, i) => { const y = -18 - i * 9; return [-10, y - 7, 10, y + 6]; }, { list: 'scoops', noun: 'ice cream scoop' }], ['toggle', 'ch', 'shape', (p) => [-5, -16 - p.n * 9 - 8, 5, -16 - p.n * 9 + 2], { noun: 'cherry' }]],
    draw(ctx, p, S) {
      poly(ctx, [-7.5, -16, 7.5, -16, 0, 0]); paint(ctx, S, '#e8b375', [1, -16, 7, 16]);
      line(ctx, S, [-5, -12, 2, -6], 0.4); line(ctx, S, [5, -12, -2, -6], 0.4);
      for (let i = 0; i < p.n; i++) { const y = -18 - i * 9; ctx.beginPath(); ctx.arc(0, y, 8, Math.PI * 0.95, Math.PI * 0.05); ctx.quadraticCurveTo(5, y + 5, 2, y + 3); ctx.quadraticCurveTo(0, y + 6, -3, y + 3); ctx.quadraticCurveTo(-6, y + 5, -8, y + 1); ctx.closePath(); paint(ctx, S, p.cols[i]); }
      if (p.ch) { const y = -16 - p.n * 9 - 3; ci(ctx, 0, y, 3); paint(ctx, S, '#e2574c'); line(ctx, S, [0, y - 3, 2, y - 6], 0.6); }
    },
  },
  house: {
    noun: 'house', kind: 'stand',
    box: () => [-28, -52, 28, 0],
    make: (r, pal) => ({ c: r.pick(pal.houses || pal.acc), rf: r.pick(pal.roofs || ['#e2574c', '#6b8fd6', '#8a5a44']), dc: r.pick(pal.acc), ch: r.chance(0.5), win: r.int(1, 2) }),
    muts: [['recolor', 'c', [-22, -30, 22, 0], 'houses', { noun: 'house' }], ['recolor', 'rf', [-28, -52, 28, -28], 'roofs', { noun: 'roof' }], ['toggle', 'ch', 'shape', [6, -52, 18, -34], { noun: 'chimney' }], ['count', 'win', 1, 2, [-20, -24, 20, -10], { noun: 'windows' }], ['recolor', 'dc', [-6, -18, 6, 0], 'acc', { noun: 'door' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 24);
      if (p.ch) { rr(ctx, 9, -50, 7, 14, 1); paint(ctx, S, '#9a6b6b'); }
      rr(ctx, -22, -30, 44, 30, 1.5); paint(ctx, S, p.c, [10, -30, 13, 30]);
      poly(ctx, [-28, -28, 0, -50, 28, -28]); paint(ctx, S, p.rf, [8, -52, 22, 26]);
      rr(ctx, -5, -16, 10, 16, 1.5); paint(ctx, S, p.dc); ci(ctx, 2.6, -8, 0.9); fill(ctx, S.ink);
      const glass = S.night ? '#ffd27a' : '#bfe6f5';
      for (let i = 0; i < p.win; i++) { const x = p.win === 1 ? -15 : [-15, 9][i]; rr(ctx, x - 1, -24, 9, 9, 1); paint(ctx, S, glass); line(ctx, S, [x + 3.5, -24, x + 3.5, -15], 0.5); }
    },
  },
  fence: {
    noun: 'fence', kind: 'stand',
    box: (p) => [-p.n * 6, -25, p.n * 6, 0],
    make: (r, pal) => ({ n: r.int(5, 7), c: r.pick(['#fffaf0', '#fffaf0', pal.wood]) }),
    muts: [['count', 'n', 4, 8, null, { noun: 'fence posts' }], ['recolor', 'c', null, 'acc', { noun: 'fence' }]],
    draw(ctx, p, S) {
      const w = p.n * 12;
      rr(ctx, -w / 2 + 1, -18, w - 2, 4, 1); paint(ctx, S, p.c); rr(ctx, -w / 2 + 1, -9, w - 2, 4, 1); paint(ctx, S, p.c);
      for (let i = 0; i < p.n; i++) { const x = -w / 2 + 2 + i * 12; poly(ctx, [x, 0, x, -21, x + 4, -25, x + 8, -21, x + 8, 0]); paint(ctx, S, p.c, [x + 5, -25, 4, 25]); }
    },
  },
  shop: {
    noun: 'shop', kind: 'stand', fixed: true,
    box: () => [-44, -84, 44, 0],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = '#fffaf0'; return { c: r.pick(pal.shops || pal.acc), c1, c2, pat: r.pick(['bands', 'plain']), sym: r.pick(['heart', 'star', 'moon', 'cat', 'note', 'flower']) }; },
    muts: [['swap', 'c1', 'c2', [-44, -66, 44, -48], { noun: 'shop awning' }], ['recolor', 'c1', [-44, -66, 44, -48], 'acc', { noun: 'shop awning' }], ['symbol', 'sym', ['heart', 'star', 'moon', 'cat', 'note', 'flower'], [-36, -84, -8, -66], { noun: 'shop sign' }], ['recolor', 'c', [-40, -46, 40, 0], 'shops', { noun: 'shop' }]],
    draw(ctx, p, S) {
      rr(ctx, -40, -84, 80, 84, 1); paint(ctx, S, p.c, [26, -84, 14, 84]);
      rr(ctx, -34, -40, 36, 30, 1.5); paint(ctx, S, S.night ? '#ffd98a' : '#cdebf6');
      if (S.night) glow(ctx, -16, -26, 26, '#ffd98a', 0.35);
      line(ctx, S, [-16, -40, -16, -10], 0.6);
      rr(ctx, 12, -42, 20, 42, 1.5); paint(ctx, S, darker(p.c, 0.3)); ci(ctx, 27, -20, 1.4); fill(ctx, '#ffd45c');
      ctx.save(); poly(ctx, [-44, -66, 44, -66, 40, -50, -40, -50]); ctx.fillStyle = p.c1; ctx.fill(); ctx.clip();
      if (p.pat === 'bands') for (let x = -44; x < 44; x += 11) { ctx.fillStyle = p.c2; ctx.fillRect(x, -66, 5.5, 18); }
      ctx.restore(); poly(ctx, [-44, -66, 44, -66, 40, -50, -40, -50]); ink(ctx, S);
      for (let x = -40; x < 40; x += 11) { ctx.beginPath(); ctx.arc(x + 5.5, -50, 5.5, 0, Math.PI); ctx.fillStyle = (Math.round((x + 40) / 11) % 2 && p.pat === 'bands') ? p.c2 : p.c1; ctx.fill(); ink(ctx, S, 0.8); }
      rr(ctx, -36, -82, 26, 14, 2); paint(ctx, S, '#2a1f45');
      symbol(ctx, S, p.sym, -23, -75, 5, '#ffd45c', { w: 0.5 });
    },
  },
  planter: {
    noun: 'planter', kind: 'stand',
    box: () => [-42, -52, 42, 0],
    make: (r, pal) => ({ c: r.chance(0.6) ? pal.wood : r.pick(pal.acc), n: r.int(2, 4), fc: r.pick(['#e2574c', '#ffd45c', '#ff8fb1']) }),
    muts: [['recolor', 'c', [-42, -24, 42, 0], 'acc', { noun: 'planter box' }], ['count', 'n', 1, 5, [-36, -52, 36, -22], { noun: 'tomatoes' }], ['recolor', 'fc', [-36, -52, 36, -22], 'fruit', { noun: 'tomatoes' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 40);
      for (const x of [-26, -6, 14, 30]) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.quadraticCurveTo(x - 4, -34, x + 2, -48); ctx.lineWidth = S.lw * 0.9; ctx.strokeStyle = '#3f8a52'; ctx.stroke(); for (const [dy, a] of [[-30, -2.6], [-38, -0.5], [-44, -2.2]]) leaf(ctx, S, x, dy, 9, 3.4, a, '#5fae6a'); }
      for (let i = 0; i < p.n; i++) { const [x, y] = [[-24, -34], [-4, -42], [16, -32], [30, -44], [-14, -46]][i]; ci(ctx, x, y, 4.2); paint(ctx, S, p.fc); poly(ctx, [x - 2, y - 4, x, y - 6, x + 2, y - 4]); fill(ctx, '#3f8a52'); }
      rr(ctx, -42, -22, 84, 22, 2); paint(ctx, S, p.c, [24, -22, 18, 22]);
      for (const y of [-15, -8]) line(ctx, S, [-42, y, 42, y], 0.5);
      rr(ctx, -40, -25, 80, 4, 1); fill(ctx, '#6b4a3a');
    },
  },
  loungechair: {
    noun: 'deck chair', kind: 'stand', flip: true,
    box: () => [-36, -40, 30, 0],
    make: (r, pal) => { const c1 = r.pick(pal.acc); let c2 = r.pick(pal.acc); if (c2 === c1) c2 = '#fffaf0'; return { c1, c2 }; },
    muts: [['swap', 'c1', 'c2'], ['recolor', 'c1']],
    draw(ctx, p, S) {
      gs(ctx, S, 30);
      const w = S.pal.wood || '#9a6b45';
      line(ctx, S, [-30, 0, 10, -22], 1.4, w); line(ctx, S, [24, 0, -6, -18], 1.4, w); line(ctx, S, [-34, -38, -14, 0], 1.4, w);
      ctx.save(); poly(ctx, [-32, -40, -18, -10, 22, -10, 26, -16, -12, -16, -24, -40]); ctx.fillStyle = p.c1; ctx.fill(); ctx.clip();
      for (let x = -40; x < 30; x += 8) { ctx.fillStyle = p.c2; ctx.fillRect(x, -42, 4, 34); }
      ctx.restore(); poly(ctx, [-32, -40, -18, -10, 22, -10, 26, -16, -12, -16, -24, -40]); ink(ctx, S);
    },
  },
  birdhouse: {
    noun: 'birdhouse', kind: 'stand',
    box: () => [-14, -60, 14, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), rf: r.pick(pal.acc) }),
    muts: [['recolor', 'c', [-11, -46, 11, -26], 'acc', { noun: 'birdhouse' }], ['recolor', 'rf', [-14, -60, 14, -44], 'acc', { noun: 'birdhouse roof' }], ['swap', 'c', 'rf', [-14, -60, 14, -26], { noun: 'birdhouse' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 5);
      rr(ctx, -2.5, -28, 5, 28, 1); paint(ctx, S, S.pal.wood || '#9a6b45');
      rr(ctx, -10, -46, 20, 20, 1.5); paint(ctx, S, p.c, [4, -46, 7, 20]);
      ci(ctx, 0, -38, 3.6); fill(ctx, S.ink);
      rr(ctx, -1, -32, 2, 4, 0.5); fill(ctx, S.ink);
      poly(ctx, [-14, -44, 0, -59, 14, -44]); paint(ctx, S, p.rf);
    },
  },
  wateringcan: {
    noun: 'watering can', kind: 'stand', flip: true, small: true,
    box: () => [-15, -26, 25, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(22, -20); ctx.lineWidth = 3.4 + S.lw * 2; ctx.strokeStyle = S.ink; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = p.c; ctx.stroke();
      rr(ctx, 19, -24, 7, 5, 1.5); paint(ctx, S, darker(p.c, 0.15));
      ctx.beginPath(); ctx.arc(-1, -18, 8, Math.PI, 0); ctx.lineWidth = S.lw * 1.8; ctx.strokeStyle = S.ink; ctx.stroke();
      rr(ctx, -13, -17, 24, 17, 3); paint(ctx, S, p.c, [4, -17, 8, 17]);
      line(ctx, S, [-9, -13, -9, -4], 0.7, S.hi);
    },
  },
  telescope: {
    noun: 'telescope', kind: 'stand', flip: true,
    box: () => [-18, -56, 30, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc) }),
    muts: [['recolor', 'c']],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      line(ctx, S, [0, -26, -12, 0], 1.3); line(ctx, S, [0, -26, 12, 0], 1.3); line(ctx, S, [0, -26, 0, 0], 1.3);
      ctx.save(); ctx.translate(2, -30); ctx.rotate(-0.55);
      rr(ctx, -16, -5, 30, 10, 3); paint(ctx, S, p.c, [-16, 1, 30, 4]);
      rr(ctx, 13, -6.5, 10, 13, 2); paint(ctx, S, darker(p.c, 0.15));
      rr(ctx, -20, -3, 5, 6, 1.5); paint(ctx, S, '#3a3550');
      ctx.restore();
    },
  },
  cow: {
    noun: 'cow', kind: 'stand', flip: true,
    box: () => [-28, -32, 30, 0],
    make: (r) => ({ n: r.int(2, 3), sc: r.pick(['#3a3550', '#8a5a44']), bell: r.pick(['#ffd45c', '#ff8fb1', '#7fd6c2']) }),
    muts: [['count', 'n', 1, 3, [-22, -26, 14, -8], { noun: 'cow\'s spots' }], ['recolor', 'bell', [12, -14, 22, -4], 'acc', { noun: 'cow bell' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 24);
      for (const x of [-16, -8, 8, 14]) { rr(ctx, x - 2.5, -10, 5, 10, 1.5); paint(ctx, S, '#fbfbff'); rr(ctx, x - 2.5, -2.4, 5, 2.4, 0.8); fill(ctx, S.ink); }
      ctx.beginPath(); ctx.moveTo(-22, -16); ctx.quadraticCurveTo(-28, -10, -26, -2); ctx.lineWidth = S.lw * 0.9; ctx.strokeStyle = S.ink; ctx.stroke();
      rr(ctx, -23, -27, 40, 19, 9); ctx.save(); ctx.fillStyle = '#fbfbff'; ctx.fill(); ctx.clip();
      for (let i = 0; i < p.n; i++) { const [x, y, rx, ry] = [[-12, -22, 7, 5], [4, -14, 6, 5], [-2, -26, 5, 3.5]][i]; el(ctx, x, y, rx, ry); fill(ctx, p.sc); }
      ctx.fillStyle = S.shade; ctx.fillRect(-24, -14, 42, 7); ctx.restore();
      rr(ctx, -23, -27, 40, 19, 9); ink(ctx, S);
      for (const k of [-1, 1]) { poly(ctx, [18 + k * 5, -30, 18 + k * 7, -36, 18 + k * 2, -31]); paint(ctx, S, '#f6e7c8'); }
      el(ctx, 19, -24, 8, 8); paint(ctx, S, '#fbfbff');
      el(ctx, 13, -27, 3.6, 2); paint(ctx, S, '#fbfbff'); el(ctx, 26, -27, 3.6, 2); paint(ctx, S, '#fbfbff');
      el(ctx, 20, -18.5, 7, 4.5); paint(ctx, S, '#f6b2c4');
      ci(ctx, 17.4, -18.5, 0.9); fill(ctx, S.ink); ci(ctx, 22.6, -18.5, 0.9); fill(ctx, S.ink);
      ci(ctx, 16.5, -25.5, 1.2); fill(ctx, S.ink); ci(ctx, 22.5, -25.5, 1.2); fill(ctx, S.ink);
      poly(ctx, [14, -12, 20, -12, 21, -6, 13, -6]); paint(ctx, S, p.bell);
    },
  },
  windmill: {
    noun: 'windmill', kind: 'stand', fixed: true,
    box: () => [-34, -96, 34, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), rot: r.pick([0, 1]) }),
    muts: [['recolor', 'c', [-14, -66, 14, -44], 'acc', { noun: 'windmill roof' }], ['shape', 'rot', [0, 1], [-34, -96, 34, -24], { noun: 'windmill sails' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 16);
      poly(ctx, [-13, 0, 13, 0, 8, -48, -8, -48]); paint(ctx, S, '#fbf3e4', [3, -48, 12, 48]);
      rr(ctx, -4, -14, 8, 14, 3); paint(ctx, S, '#8a5a44');
      ci(ctx, 0, -30, 3); paint(ctx, S, '#bfe6f5');
      poly(ctx, [-12, -46, 12, -46, 0, -64]); paint(ctx, S, p.c);
      const a0 = p.rot ? Math.PI / 4 : 0;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        ctx.save(); ctx.translate(0, -54); ctx.rotate(a);
        rr(ctx, -1.2, -36, 2.4, 36, 1); paint(ctx, S, '#8a5a44');
        rr(ctx, 1.2, -34, 7, 24, 0.5); paint(ctx, S, '#fffaf0');
        for (const y of [-28, -21, -14]) line(ctx, S, [1.2, y, 8.2, y], 0.4);
        ctx.restore();
      }
      ci(ctx, 0, -54, 2.6); paint(ctx, S, '#3a3550');
    },
  },
  suitcase: {
    noun: 'suitcase', kind: 'stand',
    box: () => [-26, -40, 26, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), n: r.int(1, 3), sc: pickN(r, ['#ffd45c', '#ff8fb1', '#7fd6c2', '#fffaf0', '#b9a7ff'], 3) }),
    muts: [['recolor', 'c'], ['count', 'n', 0, 3, [-22, -32, 22, -6], { noun: 'stickers on the suitcase' }], ['recolorAt', 'sc', 'n', (p, i) => { const [x, y] = STK_AT[i]; return [x - 7, y - 7, x + 7, y + 7]; }, { noun: 'sticker' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 24);
      rr(ctx, -8, -40, 16, 8, 3); ctx.lineWidth = S.lw * 1.8; ctx.strokeStyle = S.ink; ctx.stroke();
      rr(ctx, -24, -34, 48, 32, 5); paint(ctx, S, p.c, [12, -34, 13, 32]);
      for (const x of [-12, 12]) line(ctx, S, [x, -34, x, -2], 0.7, darker(p.c, 0.25));
      for (let i = 0; i < p.n; i++) { const [x, y, k] = STK_AT[i]; if (k === 'star') symbol(ctx, S, 'star', x, y, 5.5, p.sc[i], { w: 0.6 }); else { ci(ctx, x, y, 5); paint(ctx, S, p.sc[i]); symbol(ctx, S, k, x, y, 2.6, S.ink, { bare: true }); } }
      for (const x of [-18, 18]) { ci(ctx, x, -1, 2); paint(ctx, S, '#3a3550'); }
    },
  },
  sunglasses: {
    noun: 'sunglasses', kind: 'stand', small: true,
    box: () => [-16, -9, 16, 0],
    make: (r, pal) => ({ c: r.pick(pal.acc), shape: r.pick(['round', 'square', 'heart']) }),
    muts: [['recolor', 'c'], ['shape', 'shape', ['round', 'square', 'heart']]],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      line(ctx, S, [-3, -5, 3, -5], 1.1);
      for (const k of [-1, 1]) {
        const x = k * 8.5, y = -4.6;
        if (p.shape === 'round') ci(ctx, x, y, 5.2);
        else if (p.shape === 'square') rr(ctx, x - 5.6, y - 4.6, 11.2, 9.2, 2);
        else { ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.bezierCurveTo(x - 8, y - 0.5, x - 4, y - 6.5, x, y - 2.6); ctx.bezierCurveTo(x + 4, y - 6.5, x + 8, y - 0.5, x, y + 5); ctx.closePath(); }
        ctx.fillStyle = '#3a3550'; ctx.fill(); ctx.lineWidth = S.lw * 1.4; ctx.strokeStyle = p.c; ctx.stroke(); ctx.lineWidth = S.lw * 0.5; ctx.strokeStyle = S.ink; ctx.stroke();
        line(ctx, S, [x - 2.6, y - 2, x - 0.8, y - 3.4], 0.6, 'rgba(255,255,255,0.7)');
      }
    },
  },

  // ===== space =====
  planet: {
    noun: 'planet', kind: 'float',
    box: () => [-32, -24, 32, 24],
    make: (r, pal) => ({ c: r.pick(pal.planets || ['#ff9f7a', '#8fd0f2', '#c9a7ff', '#7fd6a2']), ring: r.chance(0.6), m: r.int(0, 2) }),
    muts: [['recolor', 'c', [-20, -20, 20, 20], 'planets', { noun: 'planet' }], ['toggle', 'ring', 'shape', null, { noun: 'planet\'s ring' }], ['count', 'm', 0, 2, [-32, -24, 32, -6], { noun: 'little moons' }]],
    draw(ctx, p, S) {
      const ringPart = (a0, a1) => { ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, -0.3, a0, a1); tube(ctx, S, '#fff3d6', 3.4); };
      if (p.ring) ringPart(Math.PI, TAU);
      ci(ctx, 0, 0, 17); ctx.save(); ctx.fillStyle = p.c; ctx.fill(); ctx.clip();
      for (const y of [-9, -1, 8]) { el(ctx, 0, y, 20, 2.4); fill(ctx, darker(p.c, 0.12)); }
      ctx.fillStyle = S.shade; ctx.fillRect(6, -18, 12, 36); ctx.restore();
      ci(ctx, 0, 0, 17); ink(ctx, S);
      gloss(ctx, S, 0, 0, 12, 3.6, 4.4);
      if (p.ring) ringPart(0, Math.PI);
      for (let i = 0; i < p.m; i++) { const [x, y] = [[-24, -16], [22, -18]][i]; ci(ctx, x, y, 3.6); paint(ctx, S, '#e8e2f2'); }
    },
  },
  rocket: {
    noun: 'rocket', kind: 'float',
    box: () => [-15, -32, 15, 30],
    make: (r, pal) => ({ c: r.pick(pal.acc), w: r.int(1, 2) }),
    muts: [['recolor', 'c', [-15, -32, 15, 20], 'acc', { noun: 'rocket' }], ['count', 'w', 1, 2, [-7, -18, 7, 6], { noun: 'rocket windows' }]],
    draw(ctx, p, S) {
      glow(ctx, 0, 22, 9, '#ffb43b', 0.6);
      ctx.beginPath(); ctx.moveTo(-5, 14); ctx.quadraticCurveTo(0, 32, 5, 14); fill(ctx, '#ffb43b'); ctx.beginPath(); ctx.moveTo(-2.5, 14); ctx.quadraticCurveTo(0, 24, 2.5, 14); fill(ctx, '#fff1a8');
      for (const k of [-1, 1]) { poly(ctx, [k * 7, 2, k * 15, 14, k * 7, 14]); paint(ctx, S, p.c); }
      ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-8, -10); ctx.quadraticCurveTo(-8, -26, 0, -32); ctx.quadraticCurveTo(8, -26, 8, -10); ctx.lineTo(8, 14); ctx.closePath();
      paint(ctx, S, '#f6f2fb', [3, -32, 6, 46]);
      ctx.beginPath(); ctx.moveTo(-6.8, -18); ctx.quadraticCurveTo(-5, -28, 0, -32); ctx.quadraticCurveTo(5, -28, 6.8, -18); ctx.closePath(); paint(ctx, S, p.c);
      for (let i = 0; i < p.w; i++) { const y = p.w === 1 ? -6 : [-10, 2][i]; ci(ctx, 0, y, 3.6); paint(ctx, S, '#8fd0f2'); gloss(ctx, S, 0, y, 2.2, 3.6, 4.4, 0.6); }
      rr(ctx, -8, 11, 16, 3.5, 1); paint(ctx, S, p.c);
    },
  },
  satellite: {
    noun: 'satellite', kind: 'float',
    box: () => [-34, -14, 34, 14],
    make: (r) => ({ c: r.pick(['#6b8fd6', '#9b7bff', '#4fb3a8']) }),
    muts: [['recolor', 'c', [-34, -10, 34, 10], 'panels', { noun: 'solar panels' }]],
    draw(ctx, p, S) {
      for (const k of [-1, 1]) { line(ctx, S, [k * 7, 0, k * 12, 0], 0.9); rr(ctx, k > 0 ? 12 : -33, -8, 21, 16, 1.5); paint(ctx, S, p.c); for (const x of [5, 10, 15]) line(ctx, S, [k > 0 ? 12 + x : -33 + x, -8, k > 0 ? 12 + x : -33 + x, 8], 0.45, lighter(p.c, 0.45)); line(ctx, S, [k > 0 ? 12 : -33, 0, k > 0 ? 33 : -12, 0], 0.45, lighter(p.c, 0.45)); }
      rr(ctx, -7, -9, 14, 18, 2.5); paint(ctx, S, '#d9d3e6', [2, -9, 6, 18]);
      ctx.beginPath(); ctx.arc(0, -13, 6, 0.1, Math.PI - 0.1); ctx.closePath(); paint(ctx, S, '#fffaf0');
      line(ctx, S, [0, -13, 0, -19], 0.7); ci(ctx, 0, -19.5, 1.4); fill(ctx, '#ff6f91');
    },
  },
  comet: {
    noun: 'comet', kind: 'float', flip: true,
    box: () => [-32, -11, 12, 11],
    make: (r) => ({ c: r.pick(['#fff1a8', '#bfe6ff', '#ffc7de']) }),
    muts: [['recolor', 'c', null, 'comets']],
    draw(ctx, p, S) {
      ctx.save();
      for (const [w, a] of [[9, 0.25], [6, 0.45], [3, 0.8]]) { poly(ctx, [-32, -2, 2, -w, 2, w, -32, 2]); ctx.globalAlpha = a; fill(ctx, p.c); }
      ctx.restore();
      starPath(ctx, 3, 0, 8.5, 5, 0.5, 0.3); paint(ctx, S, p.c);
    },
  },
  console: {
    noun: 'control panel', kind: 'stand', fixed: true,
    box: () => [-46, -42, 46, 0],
    make: (r, pal) => ({ c: '#d9d3e6', n: r.int(3, 5), bc: pickN(r, ['#ff6f91', '#ffd45c', '#7fd6c2', '#8fb8ff', '#c9a7ff'], 5), sym: r.pick(['heart', 'star', 'planet', 'smile', 'moon']), sc: r.pick(['#7fd6c2', '#8fb8ff', '#c9a7ff']) }),
    muts: [['count', 'n', 2, 5, [12, -30, 44, -14], { noun: 'buttons' }], ['recolorAt', 'bc', 'n', (p, i) => { const x = 16 + i * 6.5; return [x - 4, -26, x + 4, -16]; }, { noun: 'button' }], ['symbol', 'sym', ['heart', 'star', 'planet', 'smile', 'moon'], [-40, -38, -6, -14], { noun: 'console screen' }], ['recolor', 'sc', [-40, -38, -6, -14], 'screen', { noun: 'console screen' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 44);
      poly(ctx, [-46, 0, 46, 0, 46, -30, 40, -42, -40, -42, -46, -30]); paint(ctx, S, p.c, [-46, -12, 92, 12]);
      rr(ctx, -40, -38, 34, 24, 2); paint(ctx, S, '#2a2440');
      rr(ctx, -37, -35, 28, 18, 1.5); fill(ctx, p.sc);
      if (S.night) glow(ctx, -23, -26, 18, p.sc, 0.35);
      symbol(ctx, S, p.sym, -23, -26, 5.6, '#ffffff', { w: 0.5 });
      for (let i = 0; i < p.n; i++) { const x = 16 + i * 6.5; ci(ctx, x, -21, 2.6); paint(ctx, S, p.bc[i]); }
      rr(ctx, 4, -36, 34, 6, 3); paint(ctx, S, '#2a2440');
      for (let i = 0; i < 5; i++) { ci(ctx, 8 + i * 6.6, -33, 1.1); fill(ctx, i % 2 ? '#7fd6c2' : '#ffd45c'); }
      line(ctx, S, [-38, -8, 38, -8], 0.5);
    },
  },
  pod: {
    noun: 'plant pod', kind: 'stand',
    box: () => [-15, -36, 15, 0],
    make: (r, pal) => ({ lc: r.pick(['#c9a7ff', '#ff8fb1', '#7fd6c2']), kind: r.pick(['rosette', 'sprout', 'ball']) }),
    muts: [['recolor', 'lc', null, 'podlights', { noun: 'plant pod light' }], ['shape', 'kind', ['rosette', 'sprout', 'ball'], [-12, -32, 12, -8], { noun: 'space plant' }]],
    draw(ctx, p, S) {
      gs(ctx, S, 14);
      glow(ctx, 0, -16, 16, p.lc, 0.45);
      const lf = '#6cbf7a';
      if (p.kind === 'rosette') { for (const a of [-2.6, -2.1, -1.57, -1.05, -0.55]) leaf(ctx, S, 0, -9, 12, 3.6, a, lf, false); }
      else if (p.kind === 'ball') { el(ctx, 0, -15, 7, 7); paint(ctx, S, lf); symbol(ctx, S, 'flower', 0, -22, 2.8, '#ff8fb1', { w: 0.5 }); }
      else { line(ctx, S, [0, -9, 0, -18], 1); leaf(ctx, S, 0, -17, 8, 3.4, -2.7, lf, false); leaf(ctx, S, 0, -18, 8, 3.4, -0.45, lf, false); }
      ctx.save(); ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(0, -9, 13, Math.PI, 0); ctx.closePath(); fill(ctx, '#e4f6ff'); ctx.restore();
      ctx.beginPath(); ctx.arc(0, -9, 13, Math.PI, 0); ink(ctx, S, 0.8); gloss(ctx, S, 0, -9, 9.5, 3.6, 4.3, 0.9);
      rr(ctx, -14, -9, 28, 9, 2.5); paint(ctx, S, '#d9d3e6', [6, -9, 9, 9]);
      rr(ctx, -9, -5, 18, 2.4, 1.2); fill(ctx, p.lc);
    },
  },
};

export const FL_AT = [[-11, -14], [0, -22], [11, -15], [-5, -9], [7, -8]];
export const STAR_AT = [[-22, -6, 5], [-4, 4, 3.6], [12, -9, 4.6], [24, 6, 3.4], [2, -12, 2.8]];
export const BAL_AT = { 1: [[0, -54]], 2: [[-7, -52], [8, -55]], 3: [[-8, -50], [8, -52], [0, -58]] };
export const STK_AT = [[-16, -24, 'heart'], [2, -14, 'star'], [16, -25, 'moon']];
