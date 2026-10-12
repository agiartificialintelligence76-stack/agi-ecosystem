// 6. Memes and X banners (36–40 s): "Memes, starring them." Two of theirs, its five formats. Then an X banner made for
// Nova's profile: exactly 1500 × 500, with room for her profile picture.
import { S, backdrop, headline, pill, glow, costChip } from '../look.js';
import { card, popK, around, E, prog, clamp, mix, text, rr, media, panel } from '../parts.js';
import { MEMES_SCENE, CAST } from '../../words.js';

const B = { x: 120, y: 236, w: 1200, h: 400 };
const AV = { cx: 120 + 150, cy: 236 + 400, r: 104 };

export default {
  prepare(c) { c.irisFrom.memes = [AV.cx, AV.cy]; },
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.75, b: 0.7, ax: 0.8, ay: 0.1, bx: 0.15, by: 0.9 });
    headline(g, MEMES_SCENE.head, t, M.memes[0] - 0.02, { x: 80, y: 140, size: 88, out: M.banner - 0.32, outDur: 0.3 });

    // two memes, its formats
    // they leave before the banner comes (never two layouts on top of each other)
    const out = E.inCubic(prog(t, M.banner - 0.38, M.banner - 0.02));
    if (out < 1) {
      [['juno-meme', 450, 560, -0.05], ['kai-meme', 990, 540, 0.045]].forEach(([pic, x, y, rot], k) => {
        const p = popK(t, M.memes[k], 0.5);
        if (p <= 0) return;
        const bob = Math.sin((t - M.memes[k]) * 2 + k) * 5;
        glow(g, x, y, 340, k ? 'rgba(219,39,119,0.2)' : 'rgba(124,58,237,0.25)', clamp(p) * (1 - out));
        card(g, md.pic(pic), x + out * (k ? 140 : -140), y + bob + out * 90, 470, 470, { rot: rot * (1 + out * 2), sc: p * (1 - out * 0.12), alpha: clamp(p) * (1 - out), r: 22, sh: 0.8 });
      });
      // the five formats
      const widths = MEMES_SCENE.formats.map((f) => pill(g, f, 0, 0, { size: 24, measureOnly: true }).w);
      const total = widths.reduce((a, b) => a + b, 0) + 14 * (widths.length - 1);
      let x = W / 2 - total / 2;
      MEMES_SCENE.formats.forEach((f, k) => {
        const p = popK(t, M.formats[k], 0.4);
        if (p > 0) around(g, x + widths[k] / 2, 910, { sc: p, alpha: clamp(p) * (1 - out) }, () => pill(g, f, 0, 0, { size: 24, align: 'center', bg: k === 2 ? 'rgba(139,92,246,0.24)' : 'rgba(20,20,24,0.88)', line: k === 2 ? S.accent : S.line2 }));
        x += widths[k] + 14;
      });
    }

    // ---- an X banner on Nova's profile ----
    if (t >= M.banner - 0.05) {
      headline(g, MEMES_SCENE.banner, t, M.banner, { x: 80, y: 140, size: 88 });
      const p = E.outQuart(prog(t, M.banner, M.banner + 0.6));
      g.save();
      g.globalAlpha = clamp(p * 1.6);
      const sc = mix(0.94, 1, p);
      g.translate(W / 2, B.y + 300 + (1 - p) * 110); g.scale(sc, sc); g.translate(-W / 2, -(B.y + 300));
      // the profile's card
      panel(g, B.x - 24, B.y - 24, B.w + 48, 700, { r: 30, fill: S.panel });
      media(g, md.pic('nova-x-banner'), B.x, B.y, B.w, B.h, { r: 18, lw: 0 });
      // its profile picture, where X puts it
      g.beginPath(); g.arc(AV.cx, AV.cy, AV.r + 7, 0, Math.PI * 2); g.fillStyle = S.panel; g.fill();
      g.save(); g.beginPath(); g.arc(AV.cx, AV.cy, AV.r, 0, Math.PI * 2); g.clip();
      media(g, md.pic('nova-look-1'), AV.cx - AV.r, AV.cy - AV.r, AV.r * 2, AV.r * 2, { r: 0, lw: 0, focus: [0.5, 0.4] });
      g.restore();
      text(g, CAST.nova.name, { x: B.x + 40, y: B.y + B.h + 162, font: { f: 'sans', w: 800, s: 46 }, color: S.text });
      text(g, MEMES_SCENE.bio, { x: B.x + 40, y: B.y + B.h + 204, font: { f: 'sans', w: 500, s: 26 }, color: S.text3 });
      rr(g, B.x + B.w - 190, B.y + B.h + 34, 190, 62, 31); g.fillStyle = S.text; g.fill();
      text(g, 'Follow', { x: B.x + B.w - 95, y: B.y + B.h + 66, font: { f: 'sans', w: 700, s: 26 }, color: '#0b0b0c', align: 'center', base: 'middle' });
      g.restore();
      // its size, measured
      const d = E.outCubic(prog(t, M.bannerSize, M.bannerSize + 0.4));
      if (d > 0) {
        g.save();
        g.strokeStyle = S.accent; g.fillStyle = S.accent; g.lineWidth = 3;
        const y = B.y - 44, x2 = B.x + B.w * d;
        g.beginPath(); g.moveTo(B.x, y); g.lineTo(x2, y); g.stroke();
        g.beginPath(); g.moveTo(B.x, y - 12); g.lineTo(B.x, y + 12); g.moveTo(x2, y - 12); g.lineTo(x2, y + 12); g.stroke();
        const xr = B.x + B.w + 44, y2 = B.y + B.h * d;
        g.beginPath(); g.moveTo(xr, B.y); g.lineTo(xr, y2); g.stroke();
        g.beginPath(); g.moveTo(xr - 12, B.y); g.lineTo(xr + 12, B.y); g.moveTo(xr - 12, y2); g.lineTo(xr + 12, y2); g.stroke();
        g.restore();
        pill(g, '1500', B.x + B.w / 2, y, { size: 22, mono: true, align: 'center', bg: S.bg, line: S.accent, alpha: d });
        around(g, xr, B.y + B.h / 2, { rot: Math.PI / 2, alpha: d }, () => pill(g, '500', 0, 0, { size: 22, mono: true, align: 'center', bg: S.bg, line: S.accent }));
        const sp = popK(t, M.bannerSize + 0.25, 0.45);
        if (sp > 0) {
          around(g, B.x + B.w - 120, B.y + B.h + 192, { sc: sp, alpha: clamp(sp) }, () => {
            pill(g, `X banner · ${MEMES_SCENE.bannerSize}`, -40, 0, { size: 24, align: 'right', bg: 'rgba(139,92,246,0.2)', line: S.accent });
            costChip(g, MEMES_SCENE.bannerCost, 0, 0, { u: 1.9, align: 'left', bg: 'rgba(255,255,255,0.08)' });
          });
        }
      }
    }
  },
};
