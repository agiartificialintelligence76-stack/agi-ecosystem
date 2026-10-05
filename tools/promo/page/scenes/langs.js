// 28–32 s, her languages (on ink): "hi, it's me" in each of her 16 languages (her own line on the site, imported from
// src/i18n/lines/*.js), rolling through a picker like the chat bar's language menu, faster and faster on the music;
// then they fly out into a ring around "16 languages · She answers in yours."
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba } from '../kit.js';
import { pill, eyebrow, ICONS, popWord } from '../ui.js';

let glow = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? { cy: H * 0.52, rowH: 112, s: 78, bandW: 1180, chipY: 150, ring: { rx: 790, ry: 385, cy: H * 0.53 }, stampS: 122, stampY: H * 0.53, subY: H * 0.53 + 96 }
    : { cy: H * 0.5, rowH: 104, s: 64, bandW: 960, chipY: 330, ring: { rx: 410, ry: 600, cy: H * 0.5 }, stampS: 96, stampY: H * 0.49, subY: H * 0.49 + 84 };
}

export default {
  id: 'langs',
  prepare(c) {
    const { W, H } = c;
    glow = canvas(W, H);
    const x = glow.getContext('2d');
    const rg = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    rg.addColorStop(0, 'rgba(107,59,255,0.55)');
    rg.addColorStop(1, 'rgba(107,59,255,0)');
    x.fillStyle = rg; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(205,184,255,0.12)';
    for (let y = 14, row = 0; y < H; y += 30, row++) for (let xx = row % 2 ? 15 : 0; xx < W + 30; xx += 30) { x.beginPath(); x.arc(xx, y, 2.2, 0, Math.PI * 2); x.fill(); }
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.LANGS_SCENE;
    const items = V.hellos;
    g.fillStyle = C.ink;
    g.fillRect(0, 0, W, H);
    g.drawImage(glow, 0, 0);

    // where the picker is: each hello snaps in on its note
    let pos = -1.6;
    M.langs.forEach((at, k) => {
      const d = Math.min(0.2, k < 4 ? 0.2 : 0.11);
      pos += (k === 0 ? 1.6 : 1) * E.outCubic(prog(t, at - 0.02, at - 0.02 + d));
    });
    const cur = clamp(Math.round(pos), 0, items.length - 1);
    // after the last one, they fly out into a ring
    const out = ep(t, M.stamp16 - 0.2, M.stamp16 + 0.45, E.inOutCubic);
    const font = { f: 'sans', w: 600, s: L.s };

    // the language menu's chip (the chat bar's "🌐 English ▾"), following along
    const chipA = ep(t, S.from, S.from + 0.25) * (1 - ep(t, M.stamp16 - 0.3, M.stamp16));
    if (chipA > 0) pill(g, `${items[cur].native}  ▾`, { x: W / 2, y: L.chipY, font: { f: 'sans', w: 600, s: wide ? 26 : 30 }, bg: C.white, icon: ICONS.globe, shadow: 5, shadowColor: C.pink, alpha: chipA, spacing: 0 });

    const ringAngle = (k) => (k / items.length) * Math.PI * 2 - Math.PI / 2 + (t - M.stamp16) * 0.12;
    const drawItem = (it, k, color, inBand) => {
      const d = k - pos;
      if (out <= 0 && Math.abs(d) > 3.6) return;
      // in the picker
      const s1 = 1 - 0.16 * Math.min(Math.abs(d), 3);
      const y1 = L.cy + Math.sign(d) * Math.min(Math.abs(d), 4) ** 0.92 * L.rowH;
      const a1 = inBand ? 1 : clamp(1 - Math.abs(d) * 0.26) * 0.85;
      // in the ring
      const a = ringAngle(k);
      const x2 = W / 2 + Math.cos(a) * L.ring.rx, y2 = L.ring.cy + Math.sin(a) * L.ring.ry;
      const q = E.inOutCubic(clamp((out - (k % 8) * 0.03) / 0.79));
      const x = mix(W / 2, x2, q), y = mix(y1, y2, q);
      const s = mix(s1, wide ? 0.42 : 0.44, q);
      const alpha = mix(a1, 0.95, q);
      if (alpha <= 0.01) return;
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      const f2 = { ...font };
      const tw = measure(g, it.text, f2);
      const nf = { f: 'mono', w: 600, s: L.s * 0.32 };
      const nw = measure(g, it.native, nf) + L.s * 0.62;
      const gap = L.s * 0.32;
      const total = nw + gap + tw;
      const x0 = -total / 2;
      // its language, in a small pill
      g.globalAlpha = alpha;
      g.beginPath(); g.roundRect(x0, -L.s * 0.33 - L.s * 0.28, nw, L.s * 0.56, L.s * 0.28);
      g.fillStyle = inBand ? C.ink : rgba(C.lav2, 0.22 + 0.3 * q); g.fill();
      text(g, it.native, { x: x0 + nw / 2, y: -L.s * 0.33 + 1, font: nf, color: inBand ? C.white : C.white, base: 'middle', align: 'center' });
      text(g, it.text, { x: x0 + nw + gap, y: 0, font: f2, color, dir: it.rtl ? 'ltr' : 'ltr' });
      g.restore();
    };

    // the picker's rows, then the band in the middle (the hello in it in ink)
    items.forEach((it, k) => drawItem(it, k, C.white, false));
    const bandA = 1 - out;
    if (bandA > 0.01 && t >= M.langs[0] - 0.2) {
      const bw = L.bandW, bh = L.rowH * 0.94;
      const bx = W / 2 - bw / 2, by = L.cy - L.s * 0.36 - bh / 2;
      const pop = spring(t, M.langs[0] - 0.15, { freq: 2.4, damp: 0.5 });
      g.save();
      g.globalAlpha = bandA;
      g.translate(W / 2, by + bh / 2); g.scale(pop, pop); g.translate(-W / 2, -(by + bh / 2));
      g.beginPath(); g.roundRect(bx + 8, by + 9, bw, bh, bh / 2); g.fillStyle = C.pink; g.fill();
      g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fillStyle = C.white; g.fill(); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
      g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.clip();
      items.forEach((it, k) => { if (Math.abs(k - pos) < 1.2) drawItem(it, k, C.ink, true); });
      g.restore();
    }

    // ---- 16 languages · She answers in yours. ----
    if (t >= M.stamp16) {
      const k2 = t - M.stamp16;
      const land = E.outQuart(prog(t, M.stamp16, M.stamp16 + 0.16));
      const wob = k2 > 0.16 ? 0.05 * Math.sin((k2 - 0.16) * 30) * Math.exp(-(k2 - 0.16) * 7) : 0;
      const s = mix(2.1, 1, land) + wob;
      g.save();
      g.translate(W / 2, L.stampY - L.stampS * 0.35); g.rotate(-0.04); g.scale(s, s); g.translate(-W / 2, -(L.stampY - L.stampS * 0.35));
      g.globalAlpha = prog(t, M.stamp16, M.stamp16 + 0.06);
      popWord(g, V.stamp, W / 2, L.stampY, { font: { f: 'display', w: 900, s: L.stampS, st: 'expanded' }, fill: C.honey, stroke: C.ink, sw: L.stampS * 0.07, echo: C.pink, off: L.stampS * 0.06 });
      g.restore();
      const sp = ep(t, M.stamp16 + 0.25, M.stamp16 + 0.7, E.outQuart);
      if (sp > 0) {
        const sf = { f: 'serif', w: 400, s: wide ? 58 : 52, i: true };
        g.save();
        g.beginPath(); g.rect(0, L.subY - sf.s, W, sf.s * 1.4); g.clip();
        text(g, V.sub, { x: W / 2, y: L.subY + (1 - sp) * sf.s * 1.2, font: sf, color: C.white, align: 'center' });
        g.restore();
      }
    }
  },
};
