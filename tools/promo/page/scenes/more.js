// 60–68 s, everything else (on Pop mode's lavender), one a second on the music: full-screen talk, the AGI-1 app, her
// pop-out window, show her a window, her diary, tap her, call her, Pop mode. Each card pops in with its icon moving.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, heart, spark } from '../kit.js';
import { card, pill, eyebrow, popWord, ICONS } from '../ui.js';

let dots = null;
const TINT = [C.pink, C.honey, C.mint, C.violet, C.lav2, C.pink, C.blue, C.honey];
const ICON = { fullscreen: ICONS.expand, app: ICONS.download, popout: ICONS.popout, show: ICONS.eye, diary: ICONS.diary, tap: ICONS.tap, call: ICONS.call, pop: ICONS.spark };

function layout(c) {
  const { W, H, wide } = c;
  if (wide) {
    const cols = 4, gx = 24, x0 = 112, w = (W - 224 - gx * (cols - 1)) / cols, h = 330;
    return { head: { x: 112, eb: 150, t: 246, s: 86 }, cols, cell: (k) => ({ x: x0 + (k % cols) * (w + gx), y: 316 + Math.floor(k / cols) * (h + 28), w, h }) };
  }
  const cols = 2, gx = 22, x0 = 70, w = (W - 140 - gx) / 2, h = 250;
  return { head: { x: 70, eb: 288, t: 376, s: 74 }, cols, cell: (k) => ({ x: x0 + (k % cols) * (w + gx), y: 430 + Math.floor(k / cols) * (h + 18), w, h }) };
}

export default {
  id: 'more',
  exit(c) { const b = layout(c).cell(c.wide ? 6 : 7); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; },
  prepare(c) {
    const { W, H } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(107,59,255,0.12)';
    for (let y = 14, row = 0; y < H; y += 28, row++) for (let xx = row % 2 ? 14 : 0; xx < W + 28; xx += 28) { x.beginPath(); x.arc(xx, y, 2.6, 0, Math.PI * 2); x.fill(); }
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.MORE, HD = words.MORE_HEAD;
    const T0 = S.from;
    g.fillStyle = C.lav;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);
    // a slow drift across, so it never sits still
    const drift = (t - T0) * (wide ? -6 : -4);
    g.save();
    g.translate(drift, 0);

    const hd = L.head;
    eyebrow(g, HD.eyebrow, hd.x, hd.eb, { color: C.ink, dot: C.violet, s: wide ? 22 : 25, alpha: ep(t, T0 + 0.05, T0 + 0.3), spacing: 3 });
    const tp = ep(t, T0 + 0.1, T0 + 0.6, E.outQuart);
    if (tp > 0) {
      const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
      const tw = measure(g, HD.title, tf);
      if (tw > W - hd.x * 2) tf.s = Math.floor(tf.s * (W - hd.x * 2) / tw);
      g.save();
      g.beginPath(); g.rect(0, hd.t - tf.s * 1.05, W, tf.s * 1.4); g.clip();
      popWord(g, HD.title, hd.x, hd.t + (1 - tp) * tf.s * 1.2, { font: tf, fill: C.ink, stroke: null, sw: 0, echo: C.pink, off: tf.s * 0.06, align: 'left', spacing: -1 });
      g.restore();
    }

    V.forEach((it, k) => {
      const t0 = M.more[k];
      if (t < t0 - 0.05) return;
      const b = L.cell(k);
      const s = spring(t, t0 - 0.05, { freq: 2.2, damp: 0.5 });
      const age = t - t0;
      const fresh = clamp(1 - age / 1.0);
      g.save();
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      g.translate(cx, cy + (1 - s) * 120); g.rotate((1 - s) * (k % 2 ? 0.2 : -0.2)); g.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s); g.translate(-cx, -cy);
      card(g, b.x, b.y, b.w, b.h, { r: 28, fill: C.white, shadow: 9 + 4 * fresh, shadowColor: fresh > 0.05 ? C.pink : C.ink });
      // its icon, moving a little as it arrives
      const ir = wide ? 46 : 42, ix = b.x + 30 + ir, iy = b.y + 30 + ir;
      g.beginPath(); g.arc(ix + 4, iy + 5, ir, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
      g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fillStyle = TINT[k]; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      const wiggle = Math.sin(age * 14) * Math.exp(-age * 3);
      const icol = TINT[k] === C.violet || TINT[k] === C.blue ? C.white : C.ink;
      g.save();
      g.translate(ix, iy);
      if (it.k === 'call' || it.k === 'tap') g.rotate(wiggle * 0.35);
      if (it.k === 'app') g.translate(0, Math.abs(wiggle) * 8);
      if (it.k === 'pop') g.rotate(E.outBack(clamp(age / 0.6)) * Math.PI / 2);
      const sc = it.k === 'fullscreen' ? 1 + 0.25 * Math.abs(wiggle) : 1;
      g.scale(sc, sc);
      (ICON[it.k] || ICONS.spark)(g, 0, 0, ir * (it.k === 'pop' ? 1.7 : 1.05), icol);
      g.restore();
      if (it.k === 'tap' && age < 1) { const rp = (age * 1.6) % 1; g.beginPath(); g.arc(ix, iy, ir * (1 + rp * 0.8), 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = rgba(C.pink, 1 - rp); g.stroke(); }
      if (it.k === 'tap' && age > 0.2) heart(g, ix + ir * 0.9, iy - ir * 0.9 - Math.min(age, 1) * 20, 26, C.pink, clamp(1.6 - age));
      // its words
      const titleF = { f: 'sans', w: 800, s: wide ? 32 : 30 };
      text(g, it.title, { x: b.x + 30, y: b.y + b.h - (wide ? 82 : 78), font: titleF, color: C.ink });
      text(g, it.sub, { x: b.x + 30, y: b.y + b.h - (wide ? 40 : 38), font: { f: it.k === 'fullscreen' ? 'mono' : 'sans', w: 500, s: wide ? 21 : 21 }, color: rgba(C.ink, 0.68) });
      g.restore();
    });
    g.restore();
  },
};
