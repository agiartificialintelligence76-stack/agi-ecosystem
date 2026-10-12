// 14. The finale (90–98 s): everything at once. A tilted wall of everything the four made (photos, memes, trend videos,
// videos, styles), slammed in on the last drop and flowing. Then over it: the logo, "Create your own influencer.", the
// button and the address, and "Live now".
import { S, GRAD, grad, backdrop, headline, logo, pill, glow, icon, sheen } from '../look.js';
import { media, E, prog, clamp, mix, spring, around, popK, text, measure, rr, clipCard } from '../parts.js';
import { FINALE, SITE } from '../../words.js';

const COLS = [
  ['nova-look-2', 'kai-neon', 'style-watercolor', 'juno-video', 'mika-snow', 'nova-x-banner'],
  ['mika-rain-trend', 'juno-gaming', 'nova-cafe', 'kai-look-1', 'style-clay', 'mika-look-1'],
  ['kai-gaming', 'style-anime', 'nova-golden-trend', 'juno-meme', 'mika-body', 'kai-look-2'],
  ['juno-look-1', 'nova-beach', 'kai-meme', 'mika-flowers', 'style-popart', 'nova-look-4'],
  ['style-storybook', 'kai-neon-runway-trend', 'juno-body', 'nova-look-1', 'mika-look-2', 'style-toy'],
  ['mika-video', 'nova-cafe-edit-red', 'juno-look-2', 'kai-body', 'style-cyberpunk', 'nova-golden'],
  ['juno-confetti-trend', 'mika-flowers', 'style-pixel', 'nova-look-3', 'kai-neon', 'juno-gaming'],
  ['kai-look-1', 'nova-cafe-video', 'mika-snow', 'juno-meme', 'style-clay', 'nova-beach'],
];
const VIDS = new Set(['juno-video', 'mika-rain-trend', 'nova-golden-trend', 'kai-neon-runway-trend', 'mika-video', 'juno-confetti-trend', 'nova-cafe-video']);
const TW = 236, TH = 300, GAP = 18;

function wall(g, c, t, M) {
  const { W, H } = c;
  const intro = E.outCubic(prog(t, M.finale, M.finale + 0.9));
  const sc = mix(1.22, 1, intro) * (1 + 0.035 * E.inOutQuad(prog(t, M.finale + 0.9, M.finale + 8)));
  const rot = mix(-0.26, -0.17, intro);
  const total = COLS.length * TW + (COLS.length - 1) * GAP;
  g.save();
  g.translate(W / 2, H / 2); g.rotate(rot); g.scale(sc, sc);
  COLS.forEach((col, k) => {
    const dir = k % 2 ? 1 : -1;
    const span = col.length * (TH + GAP);
    const speed = 64 + (k % 3) * 14;
    const off = (((t - M.finale) * speed * dir + k * 97) % span + span) % span;
    const x = -total / 2 + k * (TW + GAP);
    for (let r = -2; r <= col.length + 1; r++) {
      const name = col[((r % col.length) + col.length) % col.length];
      const y = -span / 2 + r * (TH + GAP) - off + (k % 2 ? -70 : 30);
      if (y > 1150 || y + TH < -1150) continue;
      // each tile pops in on the drop, from the middle out
      const d = Math.hypot(x + TW / 2, y + TH / 2) / 1400;
      const p = E.outBack(prog(t, M.finale + d * 0.35, M.finale + d * 0.35 + 0.45), 1.4);
      if (p <= 0) continue;
      g.save();
      g.translate(x + TW / 2, y + TH / 2); g.scale(p, p);
      if (VIDS.has(name)) clipCard(g, c, name, t, M.finale - k * 0.4, -TW / 2, -TH / 2, TW, TH, { r: 18, lw: 1.2 });
      else media(g, c.media.pic(name), -TW / 2, -TH / 2, TW, TH, { r: 18, focus: [0.5, 0.32], lw: 1.2 });
      g.restore();
    }
  });
  g.restore();
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.6, b: 0.6 });
    wall(g, c, t, M);
    // the words' scrim: the wall darkens around the middle
    const sc = E.inOutCubic(prog(t, M.logo - 0.1, M.logo + 0.4));
    if (sc > 0) {
      g.fillStyle = `rgba(9,9,11,${0.5 * sc})`; g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W / 2, H * 0.52, 120, W / 2, H * 0.52, W * 0.62);
      rg.addColorStop(0, `rgba(9,9,11,${0.88 * sc})`); rg.addColorStop(0.6, `rgba(9,9,11,${0.6 * sc})`); rg.addColorStop(1, `rgba(9,9,11,${0.15 * sc})`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      glow(g, W / 2, H * 0.5, 520, 'rgba(124,58,237,0.36)', sc);
    }

    // ---- the logo ----
    if (t >= M.logo) {
      const k = spring(t, M.logo, { freq: 2.8, damp: 0.42 });
      const s = mix(1.6, 1, clamp(k)) + (k > 1 ? (k - 1) * 0.3 : 0);
      around(g, W / 2, 292, { sc: s, alpha: clamp(prog(t, M.logo, M.logo + 0.12)) }, () => logo(g, 0, 0, 52, { align: 'center' }));
    }
    // "Live now"
    const lp = popK(t, M.live, 0.5);
    if (lp > 0) around(g, W / 2, 196, { sc: lp, alpha: clamp(lp) }, () => {
      const p = pill(g, FINALE.live, 0, 0, { size: 24, align: 'center', weight: 650, measureOnly: true, padX: 22, dot: S.mint });
      pill(g, FINALE.live, 0, 0, { size: 24, align: 'center', weight: 650, padX: 22, dot: S.mint, bg: 'rgba(63,240,195,0.1)', line: 'rgba(63,240,195,0.55)', color: S.text });
      // its dot breathes
      const b = (Math.sin((t - M.live) * 5) + 1) / 2;
      g.beginPath(); g.arc(p.x + 22 + 24 * 0.3, 0, 7 + b * 9, 0, Math.PI * 2);
      g.fillStyle = `rgba(63,240,195,${0.35 * (1 - b)})`; g.fill();
    });

    // ---- "Create your own influencer." ----
    headline(g, [FINALE.lead], t, M.line, { x: W / 2, y: 470, size: 92, align: 'center', grad: [] });
    if (t >= M.line + 0.2) {
      const size = 148, font = { f: 'sans', w: 800, s: size }, sp = -0.038 * size;
      const w = measure(g, FINALE.word, font, sp);
      headline(g, [FINALE.word], t, M.line + 0.22, { x: W / 2, y: 630, size, align: 'center', grad: [0] });
      const u = E.outCubic(prog(t, M.line + 0.45, M.line + 1.0));
      if (u > 0) {
        g.save();
        g.beginPath(); g.roundRect(W / 2 - (w * u) / 2, 662, Math.max(10, w * u), 10, 5);
        g.fillStyle = grad(g, W / 2 - w / 2, 662, w, 10, GRAD.light, 90);
        g.shadowColor = 'rgba(232,121,249,0.6)'; g.shadowBlur = 20;
        g.fill();
        g.restore();
      }
    }

    // ---- its button and its address ----
    const bp = t >= M.cta ? spring(t, M.cta, { freq: 3, damp: 0.45 }) : 0;
    if (bp > 0) {
      const bw = 470, bh = 96, bx = W / 2 - bw / 2, by = 742;
      around(g, W / 2, by + bh / 2, { sc: mix(0.6, 1, clamp(bp)) + (bp > 1 ? (bp - 1) * 0.25 : 0), alpha: clamp(prog(t, M.cta, M.cta + 0.15)) }, () => {
        const x = -bw / 2, y = -bh / 2;
        glow(g, 0, 26, 330, 'rgba(162,28,175,0.6)', 0.9);
        rr(g, x, y, bw, bh, bh / 2);
        g.fillStyle = grad(g, x, y, bw, bh, GRAD.brand, 100); g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.stroke();
        const font = { f: 'sans', w: 750, s: 38 };
        const tw = measure(g, FINALE.cta, font, -0.5);
        const nudge = Math.sin((t - M.cta) * 6) * 4 * clamp(prog(t, M.cta + 0.5, M.cta + 0.9));
        text(g, FINALE.cta, { x: -(tw + 50) / 2, y: 13, font, color: '#fff', spacing: -0.5 });
        icon(g, 'arrow', (tw + 50) / 2 - 18 + nudge, 0, 38, '#fff', { lw: 2.6 });
        // a light crossing it now and then
        sheen(g, x, y, bw, bh, ((t - M.cta - 0.6) % 1.6) / 0.9, { r: bh / 2, alpha: 0.38 });
      });
    }
    const up = popK(t, M.cta + 0.25, 0.5);
    if (up > 0) around(g, W / 2, 910, { sc: up, alpha: clamp(up) }, () => {
      pill(g, SITE, 0, 0, { size: 34, mono: true, align: 'center', dot: S.accent, padX: 28, bg: 'rgba(20,18,30,0.92)', line: 'rgba(167,139,250,0.6)', lw: 2 });
    });
  },
};
