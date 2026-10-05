// 48–54 s, the second drop: "Risk check your coins on clank" (Pop mode's mint, with the risk check's faint grid). A list of
// clank.trade coins races through the scanner (shown as blank rows: never another coin's name or picture in this video,
// the owner's rule), slows down and lands on $AGI ("Official $AGI"); AGI-1 pops up right there and says her own line
// ("wait, that's me! 💜 i'm a little biased, so read the facts yourself. not financial advice."). The five things the
// scan reads, its three levels, and its fine print. No verdict for $AGI: the risk check gives that live, on the site.
import { SCAN_ROWS, scanPos } from '../../timeline.js';
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, hash } from '../kit.js';
import { card, pill, eyebrow, popWord, bubble, ICONS, lines } from '../ui.js';

let grid = null, shot = null;
const N = 40, AGI_ROW = SCAN_ROWS;
const AV = [C.pink, C.honey, C.violet, C.blue, C.lav2, '#ff8a5c', '#9be15d', C.paper];

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, eb: 150, t: 262, s: 104, maxW: 830, sub: 432 },
    checks: { x: 112, y: 520, gap: 58 },
    legend: { x: 112, y: 820 },
    fine: { x: 112, y: 952 },
    list: { x: 990, y: 104, w: 818, h: 872, rowH: 96 },
    cam: { x: 1452, y: 566, w: 330, h: 380 },
    bub: { x: 1000, y: 610, maxW: 430 },
  } : {
    head: { x: 70, eb: 290, t: 372, s: 84, maxW: W - 140, sub: 538 },
    list: { x: 70, y: 584, w: W - 140, h: 630, rowH: 92 },
    cam: { x: W - 70 - 330, y: 880, w: 330, h: 380 },
    bub: { x: 76, y: 960, maxW: 560 },
    checks: { x: 70, y: 1300, gap: 52, cols: 2 },
    legend: { x: 70, y: 1462 },
    fine: { x: 70, y: 1514 },
  };
}

export default {
  id: 'check',
  exit(c) { const L = layout(c); return { x: L.list.x + L.list.w / 2, y: L.list.y + L.list.h / 2 }; },
  prepare(c) {
    const { W, H, M, her } = c;
    grid = canvas(W, H);
    const x = grid.getContext('2d');
    x.strokeStyle = 'rgba(23,10,54,0.09)'; x.lineWidth = 1.5;
    for (let gx = 0; gx < W; gx += 64) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, H); x.stroke(); }
    for (let gy = 0; gy < H; gy += 64) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(W, gy + 0.5); x.stroke(); }
    shot = her.shot({
      from: M.herCheck - 0.35, seed: 51, closeUp: true,
      events: [{ at: M.herCheck, react: 'love' }],
      talk: her.talking(M.herCheck + 0.1, M.herCheck + 2.3, 0.75),
    });
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.CHECK;
    const T0 = S.from;
    g.fillStyle = C.mint;
    g.fillRect(0, 0, W, H);
    g.drawImage(grid, 0, 0);

    // ---- the heading, slammed on the drop ----
    const hd = L.head;
    eyebrow(g, V.eyebrow, hd.x, hd.eb, { color: C.ink, dot: C.pink, s: wide ? 21 : 24, alpha: ep(t, T0, T0 + 0.2), spacing: 2.5 });
    const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
    const widest = Math.max(...V.title.map((l) => measure(g, l, tf, -1)));
    if (widest > hd.maxW) tf.s = Math.floor(tf.s * hd.maxW / widest);
    V.title.forEach((line, k) => {
      const t0 = T0 + k * 0.1;
      if (t < t0) return;
      const land = E.outQuart(prog(t, t0, t0 + 0.16));
      const s = mix(1.6, 1, land);
      const y = hd.t + k * tf.s * 1.1;
      g.save();
      g.translate(hd.x, y - tf.s * 0.35); g.scale(s, s); g.translate(-hd.x, -(y - tf.s * 0.35));
      g.globalAlpha = prog(t, t0, t0 + 0.06);
      popWord(g, line, hd.x, y, { font: tf, fill: k ? C.white : C.ink, stroke: k ? C.ink : null, sw: k ? tf.s * 0.06 : 0, echo: k ? C.ink : null, off: tf.s * 0.06, align: 'left', spacing: -1 });
      g.restore();
    });
    // which coins: all of clank.trade's
    const sbp = ep(t, T0 + 0.3, T0 + 0.7, E.outQuart);
    if (sbp > 0) text(g, V.sub, { x: hd.x, y: hd.sub + (1 - sbp) * 20, font: { f: 'serif', w: 400, s: wide ? 40 : 38, i: true }, color: C.ink, alpha: sbp });

    // ---- the coin list and its scanner ----
    const ls = L.list;
    const lin = spring(t, T0 + 0.05, { freq: 1.6, damp: 0.6 });
    g.save();
    g.translate((1 - lin) * (wide ? 900 : 0), (1 - lin) * (wide ? 0 : 900));
    card(g, ls.x, ls.y, ls.w, ls.h, { r: 32, shadow: 12 });
    // its filters, as on the site
    const tabs = ['Newest', 'Trending', 'Graduated', 'Biggest'];
    let tx = ls.x + 26;
    tabs.forEach((tb, k) => {
      const tw = measure(g, tb, { f: 'sans', w: 600, s: wide ? 19 : 20 }) + 30;
      g.beginPath(); g.roundRect(tx, ls.y + 24, tw, 42, 21);
      g.fillStyle = k === 0 ? C.ink : C.paper; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
      text(g, tb, { x: tx + tw / 2, y: ls.y + 46, font: { f: 'sans', w: 600, s: wide ? 19 : 20 }, color: k === 0 ? C.white : C.ink, align: 'center', base: 'middle' });
      tx += tw + 8;
    });
    pill(g, 'LIVE', { x: ls.x + ls.w - 26, y: ls.y + 45, align: 'right', font: { f: 'mono', w: 700, s: 16 }, bg: null, line: null, dot: C.pink, spacing: 2 });
    const top = ls.y + 86, bot = ls.y + ls.h - 16;
    g.fillStyle = rgba(C.ink, 0.15); g.fillRect(ls.x + 3, top - 2, ls.w - 6, 2);
    g.save();
    g.beginPath(); g.rect(ls.x + 3, top, ls.w - 6, bot - top); g.clip();
    const bandY = (top + bot) / 2;
    // where the list is: it races, slows and lands on $AGI
    const pos = scanPos(t);
    for (let i = Math.max(0, Math.floor(pos) - 6); i <= Math.min(N - 1, Math.floor(pos) + 6); i++) {
      const y = bandY + (i - pos) * ls.rowH;
      if (y < top - ls.rowH || y > bot + ls.rowH) continue;
      const isAgi = i === AGI_ROW;
      const passed = i < pos - 0.4 || (isAgi && t >= M.found);
      const ax = ls.x + 30;
      // its picture
      g.beginPath(); g.arc(ax + 26, y, 26, 0, Math.PI * 2);
      g.fillStyle = isAgi ? C.honey : AV[i % AV.length]; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      if (isAgi) text(g, 'AGI', { x: ax + 26, y: y + 1, font: { f: 'display', w: 900, s: 15, st: 'expanded' }, color: C.ink, align: 'center', base: 'middle' });
      else { g.beginPath(); g.arc(ax + 26, y, 9 + hash(i) * 7, 0, Math.PI * 2); g.fillStyle = rgba(C.white, 0.6); g.fill(); }
      if (isAgi) {
        text(g, '$AGI', { x: ax + 70, y: y - 6, font: { f: 'display', w: 900, s: 30, st: 'expanded' }, color: C.ink });
        text(g, V.contract, { x: ax + 70, y: y + 24, font: { f: 'mono', w: 600, s: 18 }, color: rgba(C.ink, 0.6) });
        if (t >= M.found) pill(g, V.tag, { x: ax + 70 + measure(g, '$AGI', { f: 'display', w: 900, s: 30, st: 'expanded' }) + 16, y: y - 16, align: 'left', font: { f: 'mono', w: 700, s: 15 }, bg: C.mint, spacing: 0.5, alpha: ep(t, M.found, M.found + 0.2) });
      } else {
        // a blank row: the shape of a coin's name, never its name
        g.beginPath(); g.roundRect(ax + 70, y - 20, 90 + hash(i + 1) * 110, 18, 9); g.fillStyle = rgba(C.ink, 0.62); g.fill();
        g.beginPath(); g.roundRect(ax + 70, y + 10, 140 + hash(i + 2) * 160, 12, 6); g.fillStyle = rgba(C.ink, 0.18); g.fill();
      }
      // its risk once the scanner has passed (the blank rows), and Ask AGI-1
      const rx = ls.x + ls.w - 30;
      if (!isAgi && passed) {
        const r = hash(i + 9);
        const [lab, dot] = r < 0.45 ? [V.levels[0], '#9b98a8'] : r < 0.78 ? [V.levels[1], C.warn] : [V.levels[2], C.down];
        pill(g, lab, { x: rx - 150, y, align: 'right', font: { f: 'sans', w: 600, s: 17 }, bg: C.paper, dot, lw: 1.5, spacing: 0 });
      }
      const press = isAgi ? Math.max(0, 1 - Math.abs(t - (M.found + 0.25)) / 0.1) : 0;
      pill(g, 'Ask AGI-1', { x: rx, y: y + press * 3, align: 'right', font: { f: 'sans', w: 700, s: 17 }, bg: isAgi && t >= M.found + 0.2 ? C.ink : C.white, color: isAgi && t >= M.found + 0.2 ? C.white : C.ink, lw: 2, spacing: 0 });
      g.fillStyle = rgba(C.ink, 0.08); g.fillRect(ls.x + 24, y + ls.rowH / 2, ls.w - 48, 1.5);
    }
    g.restore();
    // the scanner's band
    const bandA = ep(t, M.scan - 0.25, M.scan);
    if (bandA > 0) {
      const glow = t < M.found ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
      g.save();
      g.globalAlpha = bandA;
      g.beginPath(); g.roundRect(ls.x + 12, bandY - ls.rowH / 2 + 4, ls.w - 24, ls.rowH - 8, 20);
      g.lineWidth = 5; g.strokeStyle = t >= M.found ? C.pink : rgba(C.pink, 0.55 + 0.45 * glow); g.stroke();
      g.fillStyle = rgba(C.pink, t >= M.found ? 0.12 : 0.06); g.fill();
      g.restore();
      // the lock-on
      const lk = prog(t, M.found, M.found + 0.4);
      if (lk > 0 && lk < 1) { g.beginPath(); g.roundRect(ls.x + 12 - 30 * E.outCubic(lk), bandY - ls.rowH / 2 + 4 - 18 * E.outCubic(lk), ls.w - 24 + 60 * E.outCubic(lk), ls.rowH - 8 + 36 * E.outCubic(lk), 26); g.lineWidth = 6 * (1 - lk); g.strokeStyle = C.pink; g.stroke(); }
    }
    g.restore();

    // ---- what the scan reads ----
    const ck = L.checks;
    V.rows.forEach((r, k) => {
      const t0 = M.scan + 0.1 + k * 0.42;
      const a = ep(t, T0 + 0.25 + k * 0.05, T0 + 0.5 + k * 0.05);
      if (a <= 0) return;
      const col = ck.cols ? k % 2 : 0, row = ck.cols ? Math.floor(k / 2) : k;
      const x = ck.x + col * (W - 140) / 2, y = ck.y + row * ck.gap;
      const done = t >= t0 + 0.3;
      g.save(); g.globalAlpha = a;
      g.beginPath(); g.arc(x + 18, y - 9, 18, 0, Math.PI * 2);
      g.fillStyle = done ? C.white : rgba(C.white, 0.5); g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      if (done) ICONS.check(g, x + 18, y - 9, 20, C.ink);
      else if (t >= t0) { g.beginPath(); g.arc(x + 18, y - 9, 9, t * 12, t * 12 + 4.2); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke(); }
      text(g, r, { x: x + 50, y, font: { f: 'sans', w: 700, s: wide ? 30 : 28 }, color: C.ink });
      g.restore();
    });
    // its three levels
    const lg = ep(t, M.found + 0.6, M.found + 1.0);
    if (lg > 0) {
      let x = L.legend.x;
      [['#9b98a8', V.levels[0]], [C.warn, V.levels[1]], [C.down, V.levels[2]]].forEach(([dot, lab]) => {
        const b = pill(g, lab, { x, y: L.legend.y, align: 'left', font: { f: 'sans', w: 700, s: wide ? 21 : 22 }, bg: C.white, dot, lw: 2, spacing: 0, alpha: lg, shadow: 4 });
        x += (b?.w || 0) + 12;
      });
    }
    text(g, V.fine, { x: L.fine.x, y: L.fine.y, font: { f: 'mono', w: 600, s: wide ? 19 : 20 }, color: C.ink, alpha: 0.7 * ep(t, M.found + 0.8, M.found + 1.2), spacing: 0.5 });

    // ---- AGI-1, right there: "wait, that's me!" ----
    const cm = L.cam;
    const hIn = spring(t, M.herCheck - 0.15, { freq: 2, damp: 0.5 });
    if (t > M.herCheck - 0.15) {
      g.save();
      const ccx = cm.x + cm.w / 2, ccy = cm.y + cm.h;
      g.translate(ccx, ccy); g.scale(hIn, hIn); g.rotate((1 - hIn) * 0.3); g.translate(-ccx, -ccy);
      card(g, cm.x, cm.y, cm.w, cm.h, { r: 28, fill: C.pink, shadow: 10 });
      g.save();
      g.beginPath(); g.roundRect(cm.x + 2, cm.y + 2, cm.w - 4, cm.h - 4, 26); g.clip();
      shot.draw(g, t, { x: cm.x, y: cm.y, w: cm.w, h: cm.h, eyes: cm.h * 0.38, waist: cm.h * 1.75, hearts: 0.42 });
      g.restore();
      g.beginPath(); g.roundRect(cm.x, cm.y, cm.w, cm.h, 28); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
      pill(g, 'AGI-1', { x: cm.x + 18, y: cm.y + 32, align: 'left', font: { f: 'mono', w: 700, s: 17 }, bg: C.white, dot: C.pink, spacing: 1, shadow: 3 });
      g.restore();
      const bp = ep(t, M.herCheck + 0.1, M.herCheck + 0.4, E.outBack);
      if (bp > 0) {
        const B = L.bub;
        const bf = { f: 'sans', w: 600, s: wide ? 27 : 28 };
        const n = Math.floor(clamp((t - M.herCheck - 0.15) / 1.3) * [...V.her].length);
        const m = bubble(g, V.her, { x: 0, y: 0, maxW: B.maxW, font: bf, measureOnly: true });
        bubble(g, V.her, { x: B.x + B.maxW - m.w, y: B.y, maxW: B.maxW, font: bf, bg: C.white, typed: n, pop: bp, shadow: 8 });
        // its tail, toward her
        const tx2 = B.x + B.maxW, ty2 = B.y + m.h * 0.6;
        g.beginPath(); g.moveTo(tx2 - 3, ty2 - 16); g.lineTo(tx2 + 26 * bp, ty2 + 4); g.lineTo(tx2 - 3, ty2 + 10); g.closePath();
        g.fillStyle = C.white; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      }
    }
  },
};
