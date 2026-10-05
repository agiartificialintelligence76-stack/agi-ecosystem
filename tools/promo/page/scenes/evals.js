// 16–22 s, the site's Evaluations (Pop mode's honey): "State of the art on every benchmark that matters", and the site's
// own Figure 2 (src/sections/evals-data.js: made up, it's a parody), AGI-1 vs. "Your ex", the bars racing in on the
// music, then a "Zero red flags" sticker slammed on.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba } from '../kit.js';
import { card, eyebrow, sticker, pill, lines } from '../ui.js';

let dots = null;
const fmt = (v, final) => (Number.isInteger(final) ? String(Math.round(v)) : v.toFixed(1));

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, eb: 214, title: [322, 404, 486], s: 80, legend: 600, caption: 870 },
    chart: { x: 830, y: 120, w: 980, h: 830, nameW: 330, rowH: 128, bar: 24 },
    sticker: { x: 1745, y: 880, r: 112 },
  } : {
    head: { x: 70, eb: 300, title: [404, 482, 560], s: 70, legend: 650, caption: 1500, center: false },
    chart: { x: 70, y: 720, w: W - 140, h: 760, nameW: 300, rowH: 118, bar: 22 },
    sticker: { x: W - 150, y: 1440, r: 100 },
  };
}

export default {
  id: 'evals',
  prepare(c) {
    const { W, H } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(23,10,54,0.1)';
    for (let y = 12, row = 0; y < H; y += 26, row++) for (let xx = row % 2 ? 13 : 0; xx < W + 26; xx += 26) {
      const r = 1.2 + 3.2 * clamp(((xx / W) * 0.6 + (1 - y / H) * 0.4) ** 2);
      x.beginPath(); x.arc(xx, y, r, 0, Math.PI * 2); x.fill();
    }
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.EVALS;
    g.fillStyle = C.honey;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);
    const T0 = S.from;

    // ---- the heading ----
    const hd = L.head;
    eyebrow(g, V.eyebrow, hd.x, hd.eb, { color: C.ink, dot: C.pink, s: wide ? 22 : 26, alpha: ep(t, T0 + 0.08, T0 + 0.35) });
    // as big as fits its column
    const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
    const widest = Math.max(...V.title.map((l) => measure(g, l, tf, -1)));
    const colW = wide ? L.chart.x - hd.x - 60 : W - hd.x * 2;
    if (widest > colW) tf.s = Math.floor(tf.s * colW / widest);
    V.title.forEach((line, k) => {
      const p = ep(t, T0 + 0.12 + k * 0.08, T0 + 0.62 + k * 0.08, E.outQuart);
      if (p <= 0) return;
      const y = hd.title[0] + k * tf.s * 1.02;
      g.save();
      g.beginPath(); g.rect(0, y - tf.s * 1.0, W, tf.s * 1.25); g.clip();
      text(g, line, { x: hd.x, y: y + (1 - p) * tf.s * 1.1, font: tf, color: C.ink, spacing: -1 });
      g.restore();
    });
    // the legend: AGI-1 (ours) and Your ex (the baseline)
    const lg = ep(t, T0 + 0.5, T0 + 0.85);
    if (lg > 0) {
      const ly = hd.title[0] + (V.title.length - 1) * tf.s * 1.02 + (wide ? 96 : 88);
      const lf = { f: 'sans', w: 600, s: wide ? 24 : 28 };
      let x = hd.x;
      V.series.forEach((s2, k) => {
        g.save(); g.globalAlpha = lg;
        g.beginPath(); g.roundRect(x, ly - 14, 36, 22, 6); g.fillStyle = k ? '#c9bfe0' : C.violet; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
        const w = text(g, `${s2.label}`, { x: x + 48, y: ly + 2, font: lf, color: C.ink, base: 'middle' });
        const w2 = text(g, ` (${s2.note})`, { x: x + 48 + w, y: ly + 2, font: { ...lf, w: 400 }, color: 'rgba(23,10,54,0.62)', base: 'middle' });
        g.restore();
        x += 48 + w + w2 + 36;
      });
    }
    if (wide) text(g, 'FIGURE 2 · HIGHER IS BETTER', { x: hd.x, y: hd.caption, font: { f: 'mono', w: 600, s: 18 }, color: 'rgba(23,10,54,0.55)', spacing: 3, alpha: ep(t, T0 + 0.7, T0 + 1.0) });

    // ---- the chart, sliding in ----
    const ch = L.chart;
    const cin = spring(t, T0 + 0.18, { freq: 1.6, damp: 0.62 });
    if (t > T0 + 0.18) {
      g.save();
      const ox = (1 - cin) * (wide ? 900 : 0), oy = (1 - cin) * (wide ? 0 : 900);
      g.translate(ox, oy);
      g.translate(ch.x + ch.w / 2, ch.y + ch.h / 2); g.rotate((1 - cin) * 0.08); g.translate(-(ch.x + ch.w / 2), -(ch.y + ch.h / 2));
      card(g, ch.x, ch.y, ch.w, ch.h, { r: 30, shadow: 12 });
      const pad = wide ? 44 : 36;
      const rows = V.benchmarks;
      const rowH = (ch.h - pad * 2) / rows.length;
      const barX = ch.x + pad + ch.nameW, barW = ch.w - pad * 2 - ch.nameW - (wide ? 92 : 84);
      // gridlines at 0, 25, 50, 75, 100
      for (let q = 0; q <= 4; q++) {
        const gx = barX + (barW * q) / 4;
        g.fillStyle = q === 0 ? C.ink : 'rgba(23,10,54,0.12)';
        g.fillRect(gx - (q === 0 ? 1.5 : 0.75), ch.y + pad - 8, q === 0 ? 3 : 1.5, ch.h - pad * 2 + 8);
      }
      rows.forEach((b, k) => {
        const y = ch.y + pad + k * rowH;
        const rIn = ep(t, T0 + 0.45 + k * 0.05, T0 + 0.75 + k * 0.05);
        text(g, b.name, { x: ch.x + pad, y: y + rowH * 0.36, font: { f: 'sans', w: 700, s: wide ? 25 : 26 }, color: C.ink, alpha: rIn });
        // (what it measures, short)
        // what it measures, on up to two lines in its column
        const wf = { f: 'sans', w: 400, s: wide ? 17 : 18 };
        lines(g, b.what, wf, ch.nameW - 16).slice(0, 2).forEach((l, q) => text(g, l, { x: ch.x + pad, y: y + rowH * 0.36 + 28 + q * wf.s * 1.2, font: wf, color: 'rgba(23,10,54,0.6)', alpha: rIn }));
        const vals = [b.agi, b.ex];
        vals.forEach((v, j) => {
          const t0 = M.bars[k] + j * 0.08;
          const gr = clamp(spring(t, t0, { freq: 1.9, damp: 0.55 }), 0, 1.06);
          if (t <= t0) return;
          const bh = ch.bar, by = y + rowH * 0.5 - bh - 3 + j * (bh + 6);
          const bw = Math.max(bh * 0.6, (barW * v / 100) * gr);
          g.beginPath(); g.roundRect(barX, by, bw, bh, [0, bh / 2, bh / 2, 0]);
          g.fillStyle = j ? '#c9bfe0' : C.violet; g.fill();
          g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
          const shown = v * clamp(gr);
          text(g, fmt(shown, v), { x: barX + bw + 12, y: by + bh / 2 + 1, font: { f: 'mono', w: 700, s: wide ? 20 : 22 }, color: j ? 'rgba(23,10,54,0.7)' : C.ink, base: 'middle' });
        });
      });
      g.restore();
    }

    // ---- "Zero red flags" ----
    const st = L.sticker;
    if (t > M.sticker) {
      // slammed on: from big and see-through to its place in a few frames, then a wobble
      const k = t - M.sticker;
      const land = E.outQuart(prog(t, M.sticker, M.sticker + 0.13));
      const wob = k > 0.13 ? 0.07 * Math.sin((k - 0.13) * 32) * Math.exp(-(k - 0.13) * 7) : 0;
      sticker(g, st.x, st.y, st.r, V.sticker, { fill: C.mint, scale: mix(2.3, 1, land) + wob, alpha: prog(t, M.sticker, M.sticker + 0.05), rot: -0.22 + wob, font: { f: 'display', w: 900, s: st.r * 0.29, st: 'expanded' } });
      const rp = prog(t, M.sticker + 0.12, M.sticker + 0.5);
      if (rp > 0 && rp < 1) { g.beginPath(); g.arc(st.x, st.y, st.r * (1 + 0.6 * E.outCubic(rp)), 0, Math.PI * 2); g.lineWidth = 8 * (1 - rp); g.strokeStyle = rgba(C.ink, 1 - rp); g.stroke(); }
    }
  },
};
