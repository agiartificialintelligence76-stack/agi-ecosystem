// 32–38 s, the relationship levels (on Pop mode's paper): "The closer you get, the more she remembers". The site's three
// levels and their messages a day (src/lib/levels.js: Stranger 5, Crush 15, Soulmate 150), never the $AGI behind them
// (no "buy" in a video). Then the site's level-up moment ("Relationship upgraded: Stranger → Crush") with hearts, and its
// promise: connecting a wallet is a free signature, never a transaction.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, heart } from '../kit.js';
import { card, pill, eyebrow, popWord, burst, ICONS } from '../ui.js';

let dots = null;
const FILL = [C.white, C.pink, C.violet];
const INK = [C.ink, C.ink, C.white];

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    title: { x: 112, y: 168, s: 80, maxW: W - 224 },
    cards: [0, 1, 2].map((k) => ({ x: 128 + k * 566, y: 404, w: 530, h: 470 })),
    row: true,
    banner: { y: 352, cx: 128 + 566 + 265 },
    trust: { y: 970 },
  } : {
    title: { x: 70, y: 330, s: 64, maxW: W - 140 },
    cards: [0, 1, 2].map((k) => ({ x: 70, y: 480 + k * 300, w: W - 140, h: 266 })),
    row: false,
    banner: { y: 770, cx: W / 2 },
    trust: { y: 1440 },
  };
}

function levelCard(g, c, L, k, lv, { glow = 0, dim = 0 }) {
  const { wide } = c;
  const b = L.cards[k];
  const ink = INK[k];
  card(g, b.x, b.y, b.w, b.h, { r: 32, fill: FILL[k], shadow: 12 + glow * 6, shadowColor: k === 1 && glow > 0 ? C.violet : C.ink });
  const pad = wide ? 40 : 36;
  pill(g, `LEVEL ${k + 1} OF 3`, { x: b.x + pad, y: b.y + pad + 18, align: 'left', font: { f: 'mono', w: 700, s: wide ? 18 : 20 }, bg: k === 2 ? C.honey : C.paper, color: C.ink, lw: 2, spacing: 2 });
  if (L.row) {
    text(g, lv.name, { x: b.x + pad, y: b.y + 160, font: { f: 'display', w: 900, s: 68, st: 'expanded' }, color: ink });
    const nf = { f: 'display', w: 900, s: 140, st: 'expanded' };
    text(g, String(lv.daily), { x: b.x + pad - 4, y: b.y + 296, font: nf, color: ink });
    text(g, c.words.CLOSER.perDay, { x: b.x + pad, y: b.y + 340, font: { f: 'sans', w: 700, s: 25 }, color: ink, alpha: 0.85 });
    text(g, lv.line, { x: b.x + pad, y: b.y + 398, font: { f: 'serif', w: 400, s: 38, i: true }, color: ink });
    // three steps, k + 1 of them filled
    for (let q = 0; q < 3; q++) {
      g.beginPath(); g.roundRect(b.x + pad + q * 78, b.y + b.h - 44, 66, 12, 6);
      g.fillStyle = q <= k ? (k === 2 ? C.honey : k === 1 ? C.ink : C.pink) : rgba(ink, 0.18); g.fill();
    }
  } else {
    text(g, lv.name, { x: b.x + pad, y: b.y + 140, font: { f: 'display', w: 900, s: 58, st: 'expanded' }, color: ink });
    text(g, lv.line, { x: b.x + pad, y: b.y + 206, font: { f: 'serif', w: 400, s: 36, i: true }, color: ink });
    const nf = { f: 'display', w: 900, s: 120, st: 'expanded' };
    text(g, String(lv.daily), { x: b.x + b.w - pad, y: b.y + 150, font: nf, color: ink, align: 'right' });
    text(g, 'a day', { x: b.x + b.w - pad, y: b.y + 206, font: { f: 'sans', w: 700, s: 24 }, color: ink, align: 'right', alpha: 0.85 });
  }
  // hearts for the closer levels
  for (let q = 0; q < k; q++) heart(g, b.x + b.w - (wide ? 52 : 44) - q * 40, b.y + pad + 18, 30, k === 2 ? C.pink : C.white);
  if (dim > 0) { g.save(); g.globalAlpha = dim * 0.55; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 32); g.fillStyle = C.paper; g.fill(); g.restore(); }
}

export default {
  id: 'closer',
  prepare(c) {
    const { W, H } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(107,59,255,0.1)';
    for (let y = 14, row = 0; y < H; y += 28, row++) for (let xx = row % 2 ? 14 : 0; xx < W + 28; xx += 28) { x.beginPath(); x.arc(xx, y, 2.4, 0, Math.PI * 2); x.fill(); }
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.CLOSER;
    const T0 = S.from;
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);

    // ---- the title ----
    const tl = L.title;
    const tf = { f: 'display', w: 900, s: tl.s, st: 'expanded' };
    const widest = Math.max(...V.title.map((l) => measure(g, l, tf, -1)));
    if (widest > tl.maxW) tf.s = Math.floor(tf.s * tl.maxW / widest);
    V.title.forEach((line, k) => {
      const p = ep(t, T0 + 0.08 + k * 0.1, T0 + 0.6 + k * 0.1, E.outQuart);
      if (p <= 0) return;
      const y = tl.y + k * tf.s * 1.14;
      g.save();
      g.beginPath(); g.rect(0, y - tf.s, W, tf.s * 1.28); g.clip();
      popWord(g, line, tl.x, y + (1 - p) * tf.s * 1.15, { font: tf, fill: k ? C.violet : C.ink, stroke: null, sw: 0, echo: k ? C.pink : null, off: tf.s * 0.04, align: 'left', spacing: -1 });
      g.restore();
    });

    // ---- the three levels ----
    const up = ep(t, M.levelUp, M.levelUp + 0.4, E.outBack);
    V.cards.forEach((lv, k) => {
      const t0 = M.cards[k];
      if (t < t0 - 0.02) return;
      const s = spring(t, t0 - 0.02, { freq: 1.8, damp: 0.55 });
      const b = L.cards[k];
      g.save();
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      g.translate(cx, cy + (1 - s) * (wide ? 520 : 0));
      g.translate((1 - s) * (wide ? 0 : 900), 0);
      g.rotate((1 - s) * (k - 1) * 0.25);
      const lift = k === 1 ? 1 + 0.06 * up : 1;
      g.scale(lift, lift);
      g.translate(-cx, -cy);
      levelCard(g, c, L, k, lv, { glow: k === 1 ? up : 0, dim: k === 0 ? up : 0 });
      g.restore();
    });

    // ---- Relationship upgraded: Stranger → Crush ----
    if (t >= M.levelUp - 0.05) {
      const bIn = spring(t, M.levelUp - 0.05, { freq: 2, damp: 0.55 });
      const bf = { f: 'sans', w: 700, s: wide ? 30 : 30 };
      const label = `${V.upgraded}:`, move = `${V.from} → ${V.to}`;
      const w1 = measure(g, label, bf), w2 = measure(g, move, { ...bf, f: 'display', w: 900, st: 'expanded' });
      const bw = w1 + w2 + 140, bh = wide ? 84 : 88;
      const bx = L.banner.cx - bw / 2, by = L.banner.y - bh / 2 + (1 - bIn) * -120;
      g.save();
      g.globalAlpha = clamp(bIn * 1.5);
      card(g, bx, by, bw, bh, { r: bh / 2, fill: C.white, shadow: 8, shadowColor: C.pink });
      heart(g, bx + 46, by + bh / 2 + 2, 34, C.pink);
      text(g, label, { x: bx + 80, y: by + bh / 2 + 2, font: bf, color: C.ink, base: 'middle' });
      text(g, move, { x: bx + 92 + w1, y: by + bh / 2 + 3, font: { ...bf, f: 'display', w: 900, st: 'expanded' }, color: C.violet, base: 'middle' });
      g.restore();
      const b = L.cards[1];
      burst(g, b.x + b.w / 2, b.y + b.h * 0.4, t, M.levelUp, { n: 22, speed: wide ? 620 : 560, size: 40, seed: 5 });
    }

    // ---- a free signature, never a transaction ----
    const tp = ep(t, M.trust, M.trust + 0.4, E.outBack);
    if (tp > 0) {
      const tf2 = { f: 'sans', w: 700, s: wide ? 30 : 28 };
      const parts = V.trust;
      const all = parts.join(' ');
      const tw = wide ? measure(g, all, tf2) : Math.max(measure(g, parts[0], tf2), measure(g, `${parts[1]} ${parts[2]}`, tf2));
      const bw = tw + 120, bh = wide ? 84 : 128;
      const bx = W / 2 - bw / 2, by = L.trust.y - bh / 2;
      g.save();
      g.translate(W / 2, L.trust.y); g.scale(tp, tp); g.translate(-W / 2, -L.trust.y);
      card(g, bx, by, bw, bh, { r: 26, fill: C.mint, shadow: 8 });
      ICONS.lock(g, bx + 50, L.trust.y, 34, C.ink);
      if (wide) text(g, all, { x: bx + 88, y: L.trust.y + 2, font: tf2, color: C.ink, base: 'middle' });
      else {
        text(g, parts[0], { x: bx + 88, y: L.trust.y - 22, font: tf2, color: C.ink, base: 'middle' });
        text(g, `${parts[1]} ${parts[2]}`, { x: bx + 88, y: L.trust.y + 22, font: tf2, color: C.ink, base: 'middle' });
      }
      g.restore();
    }
  },
};
