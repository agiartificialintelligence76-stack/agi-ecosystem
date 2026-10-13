// 15. The end card (98–103 s): the four of them, AGI Studio, its line, its address and its account, and the fine print
// (18+, AI-generated, PG-13; credits have no cash value; not financial advice). The music's two last hits (100, 100.5)
// pulse its mark and send a ring out from it; then the page fades to black (page/main.js).
import { S, GRAD, grad, backdrop, logo, pill, glow, icon } from '../look.js';
import { media, E, prog, clamp, mix, spring, around, popK, text } from '../parts.js';
import { END, SITE, HANDLE } from '../../words.js';

const FACES = ['nova', 'kai', 'mika', 'juno'];
const D = 128, STEP = 100, FACE_Y = 318;      // the four: round, overlapping a little
const LOGO_Y = 488, LOGO = 66;
const LINE_Y = 610, PILLS_Y = 720;

// how hard the last hits are felt now (0..1)
function hit(t, M) {
  let k = 0;
  for (const h of M.lastHits) { const d = t - h; if (d >= 0 && d < 0.6) k = Math.max(k, Math.exp(-d * 7)); }
  return k;
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.75, b: 0.55, grid: 0.35 });
    const hk = hit(t, M);
    glow(g, W / 2, LOGO_Y + 20, 640 + 80 * hk, 'rgba(124,58,237,0.34)', 0.9 + 0.1 * hk);

    // ---- the rings of the last hits, from its mark ----
    for (const h of M.lastHits) {
      const p = prog(t, h, h + 1.1);
      if (p <= 0 || p >= 1) continue;
      g.save();
      // from just outside the card's words (never across them) to past the frame's edges
      g.beginPath(); g.arc(W / 2, LOGO_Y, 370 + 820 * E.outCubic(p), 0, Math.PI * 2);
      g.lineWidth = 9 * (1 - p) + 1;
      g.strokeStyle = grad(g, W / 2 - 820, LOGO_Y - 820, 1640, 1640, GRAD.light, 120);
      g.globalAlpha = 0.6 * (1 - p);
      g.stroke();
      g.restore();
    }

    // ---- its four ----
    const x0 = W / 2 - (STEP * (FACES.length - 1)) / 2;
    FACES.forEach((who, k) => {
      const p = popK(t, M.end + 0.12 + k * 0.09, 0.5);
      if (p <= 0) return;
      const x = x0 + k * STEP, bob = Math.sin((t - M.end) * 1.7 + k * 1.4) * 3 - hk * 6 * (k % 2 ? 1 : 0.6);
      around(g, x, FACE_Y + bob, { sc: p, alpha: clamp(p * 1.4) }, () => {
        g.save();
        g.beginPath(); g.arc(0, 0, D / 2 + 5, 0, Math.PI * 2);
        g.fillStyle = grad(g, -D / 2, -D / 2, D, D, GRAD.brand, 120); g.fill();
        g.beginPath(); g.arc(0, 0, D / 2 + 1, 0, Math.PI * 2);
        g.fillStyle = S.bg; g.fill();
        g.restore();
        media(g, c.media.pic(`${who}-look-1`), -D / 2 + 3, -D / 2 + 3, D - 6, D - 6, { r: (D - 6) / 2, focus: [0.5, 0.34], lw: 0 });
      });
    });
    // a few sparks around them as they arrive
    const sp = prog(t, M.end + 0.2, M.end + 1.1);
    if (sp > 0 && sp < 1) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.4, d = 150 + 210 * E.outCubic(sp) * (0.7 + 0.3 * ((i * 7) % 5) / 5);
        icon(g, 'spark', W / 2 + Math.cos(a) * d * 1.5, FACE_Y + Math.sin(a) * d * 0.55, 18 * (1 - sp) + 6,
          i % 3 === 0 ? S.pink : i % 3 === 1 ? S.accent : S.gold, { fill: true, lw: 1, alpha: 1 - sp });
      }
    }

    // ---- AGI Studio, its mark pulsing on the last hits ----
    if (t >= M.end + 0.3) {
      const k = spring(t, M.end + 0.3, { freq: 2.6, damp: 0.42 });
      const s = mix(0.7, 1, clamp(k)) + (k > 1 ? (k - 1) * 0.3 : 0) + 0.07 * hk;
      around(g, W / 2, LOGO_Y, { sc: s, alpha: clamp(prog(t, M.end + 0.3, M.end + 0.45)) }, () => logo(g, 0, 0, LOGO, { align: 'center' }));
    }

    // ---- its line ----
    const tl = E.outCubic(prog(t, M.end + 0.6, M.end + 1.1));
    if (tl > 0) {
      text(g, END.tagline, { x: W / 2, y: LINE_Y + 14 * (1 - tl), font: { f: 'sans', w: 650, s: 48 }, color: S.text, align: 'center', spacing: -0.9, alpha: tl });
    }

    // ---- its address and its account, side by side ----
    const ap = popK(t, M.end + 0.9, 0.5), hp = popK(t, M.end + 1.05, 0.5);
    if (ap > 0 || hp > 0) {
      const a = pill(g, SITE, 0, 0, { size: 32, mono: true, dot: S.accent, padX: 26, measureOnly: true });
      const b = pill(g, HANDLE, 0, 0, { size: 26, mono: true, ic: 'user', padX: 22, measureOnly: true });
      const gap = 18, total = a.w + gap + b.w, xa = W / 2 - total / 2, y = PILLS_Y;
      around(g, xa + a.w / 2, y, { sc: ap, alpha: clamp(ap) }, () => {
        pill(g, SITE, 0, 0, { size: 32, mono: true, dot: S.accent, padX: 26, align: 'center', bg: 'rgba(20,18,30,0.92)', line: 'rgba(167,139,250,0.6)', lw: 2 });
      });
      around(g, xa + a.w + gap + b.w / 2, y, { sc: hp, alpha: clamp(hp) }, () => {
        pill(g, HANDLE, 0, 0, { size: 26, mono: true, ic: 'user', padX: 22, align: 'center', color: S.text2, icColor: S.text3, bg: 'rgba(20,18,30,0.86)', line: S.line2 });
      });
    }

    // ---- the fine print ----
    const fp = E.outCubic(prog(t, M.end + 1.3, M.end + 1.8));
    if (fp > 0) {
      END.fine.forEach((line, i) => {
        text(g, line, { x: W / 2, y: 950 + i * 36, font: { f: 'sans', w: 500, s: 21 }, color: S.text3, align: 'center', alpha: fp });
      });
    }
  },
};
