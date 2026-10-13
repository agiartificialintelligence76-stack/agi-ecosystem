// 2. The brand (8–14 s): the drop. AGI Studio slams in over a wall of what people made in it; then Explore's own
// moving heading: "Create your own" and the words after it taking turns (influencer · AGI-1 · AI · viral content),
// underlined; what it makes, in a line; its address.
import { S, GRAD, grad, backdrop, headline, logo, say, icon, glow, pill } from '../look.js';
import { media, E, prog, clamp, mix, spring, around, popK, text, measure } from '../parts.js';
import { BRAND, SITE } from '../../words.js';

// seven columns, edge to edge in the wide frame (five in 4:3)
const COLS = [
  ['kai-body', 'style-anime', 'nova-look-2', 'mika-snow', 'juno-meme', 'nova-cafe-edit-red'],
  ['nova-look-1', 'mika-flowers', 'style-storybook', 'kai-neon', 'juno-look-2', 'nova-golden'],
  ['kai-look-1', 'juno-gaming', 'mika-snow', 'style-clay', 'nova-cafe', 'style-cyberpunk'],
  ['mika-look-1', 'nova-beach', 'kai-gaming', 'style-anime', 'juno-meme', 'mika-look-2'],
  ['juno-look-1', 'style-popart', 'nova-look-3', 'mika-body', 'kai-look-2', 'style-watercolor'],
  ['nova-look-4', 'kai-meme', 'style-toy', 'juno-body', 'style-pixel', 'nova-x-banner'],
  ['mika-look-2', 'nova-body', 'style-clay', 'kai-look-1', 'nova-golden', 'style-popart'],
];
const TW = 268, TH = 335, GAP = 22;

function wall(g, c, t, alpha) {
  const { W, H } = c;
  const total = COLS.length * TW + (COLS.length - 1) * GAP;
  const x0 = (W - total) / 2;
  g.save();
  g.globalAlpha *= alpha;
  COLS.forEach((col, k) => {
    const dir = k % 2 ? 1 : -1;
    const span = col.length * (TH + GAP);
    const off = ((t * 38 * dir + k * 117) % span + span) % span;
    for (let r = -1; r <= col.length; r++) {
      const name = col[((r % col.length) + col.length) % col.length];
      const y = r * (TH + GAP) - off;
      if (y > H || y + TH < 0) continue;
      media(g, c.media.pic(name), x0 + k * (TW + GAP), y + (k % 2 ? -60 : 40), TW, TH, { r: 18, focus: [0.5, 0.3], lw: 0 });
    }
  });
  g.restore();
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.8, b: 0.6, grid: 0.25 });
    const wallA = 0.36 + 0.06 * Math.sin(t * 1.3);
    wall(g, c, t, wallA * E.outCubic(prog(t, M.drop, M.drop + 0.6)));
    // a scrim, so the words read on the wall
    const sg = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62);
    sg.addColorStop(0, 'rgba(9,9,11,0.9)'); sg.addColorStop(0.55, 'rgba(9,9,11,0.72)'); sg.addColorStop(1, 'rgba(9,9,11,0.35)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    glow(g, W / 2, H * 0.48, 560, 'rgba(124,58,237,0.32)', 0.9);

    // ---- the logo slams in, then moves up ----
    const up = E.inOutCubic(prog(t, M.headline - 0.05, M.headline + 0.45));
    const k = spring(t, M.drop, { freq: 2.6, damp: 0.38 });
    const sc = mix(1.7, 1, clamp(k)) + (k > 1 ? (k - 1) * 0.35 : 0);
    const ly = mix(470, 196, up), size = mix(92, 44, up);
    around(g, W / 2, ly, { sc }, () => logo(g, 0, 0, size, { align: 'center' }));
    // its shockwave and sparkles
    const wv = prog(t, M.drop, M.drop + 0.7);
    if (wv > 0 && wv < 1) {
      g.save();
      g.beginPath(); g.arc(W / 2, 470, 60 + 980 * E.outCubic(wv), 0, Math.PI * 2);
      g.lineWidth = 14 * (1 - wv); g.strokeStyle = grad(g, W / 2 - 400, 70, 800, 800, GRAD.light, 120);
      g.globalAlpha = 1 - wv; g.stroke();
      g.restore();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + 0.2, d = 120 + 640 * E.outCubic(wv) * (0.6 + 0.4 * ((i * 37) % 10) / 10);
        icon(g, 'spark', W / 2 + Math.cos(a) * d, 470 + Math.sin(a) * d * 0.8, 26 * (1 - wv) + 6, i % 3 === 0 ? S.pink : i % 3 === 1 ? S.accent : S.gold, { fill: true, lw: 1, alpha: 1 - wv });
      }
    }

    // ---- "Create your own" and its turning word ----
    headline(g, [BRAND.lead], t, M.headline, { x: W / 2, y: 520, size: 104, align: 'center', grad: [] });
    if (t >= M.rotate[0] - 0.01) {
      const size = 134, font = { f: 'sans', w: 800, s: size }, sp = -0.038 * size;
      const y = 680;
      const widths = BRAND.rotate.map((w) => measure(g, w, font, sp));
      // which word, and how far along its turn
      let cur = 0;
      M.rotate.forEach((m, i) => { if (t >= m) cur = i; });
      const inP = E.outQuart(prog(t, M.rotate[cur], M.rotate[cur] + 0.5));
      const uw = cur === 0 ? widths[0] * E.outCubic(prog(t, M.rotate[0], M.rotate[0] + 0.55)) : mix(widths[cur - 1], widths[cur], inP);
      g.save();
      g.beginPath(); g.rect(0, y - size * 1.02, W, size * 1.32); g.clip();
      for (let i = Math.max(0, cur - 1); i <= cur; i++) {
        const p = E.outQuart(prog(t, M.rotate[i], M.rotate[i] + 0.5));
        const q = i < cur ? E.inOutCubic(prog(t, M.rotate[i + 1] - 0.02, M.rotate[i + 1] + 0.42)) : 0;
        if (p <= 0 || q >= 1) continue;
        const dy = (1 - p) * size * 1.1 - q * size * 1.1;
        const w = widths[i];
        text(g, BRAND.rotate[i], { x: W / 2 - w / 2, y: y + dy, font, color: grad(g, W / 2 - w / 2, y - size, w, size * 1.2, GRAD.light, 100), spacing: sp });
      }
      g.restore();
      // the underline, as wide as its word
      const lw = 9;
      g.save();
      g.beginPath(); g.roundRect(W / 2 - uw / 2, y + 30, Math.max(lw, uw), lw, lw / 2);
      g.fillStyle = grad(g, W / 2 - uw / 2, y + 30, Math.max(lw, uw), lw, GRAD.light, 90);
      g.shadowColor = 'rgba(232,121,249,0.6)'; g.shadowBlur = 18;
      g.fill();
      g.restore();
    }
    // what it makes, and where
    if (t >= M.sub) {
      const p = E.outCubic(prog(t, M.sub, M.sub + 0.5));
      say(g, BRAND.sub, { x: W / 2, y: 812 + (1 - p) * 20, size: 36, weight: 500, color: S.text2, align: 'center', alpha: p });
    }
    if (t >= M.url) {
      const p = popK(t, M.url, 0.5);
      around(g, W / 2, 900, { sc: p, alpha: clamp(p) }, () => {
        glow(g, 0, 0, 260, 'rgba(167,139,250,0.4)', 0.8);
        pill(g, SITE, 0, 0, { size: 32, mono: true, align: 'center', dot: S.accent, padX: 26, bg: 'rgba(20,18,30,0.9)', line: 'rgba(167,139,250,0.6)', lw: 2 });
      });
    }
  },
};
