// 4. Styles (26–30 s): "Any look. Any style." The four of them side by side (realistic, realistic, anime, 3D cartoon),
// then nine of its styles, one a sixteenth, and the stamp: 26 styles. Or Any style: it follows your words.
import { S, backdrop, headline, say, pill, glow } from '../look.js';
import { card, popK, around, nameTag, stamp, E, prog, clamp, mix } from '../parts.js';
import { STYLES, CAST } from '../../words.js';

const LINEUP = [
  { pic: 'nova-body', who: CAST.nova },
  { pic: 'kai-body', who: CAST.kai },
  { pic: 'mika-body', who: CAST.mika },
  { pic: 'juno-body', who: CAST.juno },
];
// the nine tiles' grid, its middle (and the stamp's) at GY: under it, room for the last line
const TW = 204, TH = 240, TG = 18, GY = 566;

export default {
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.7, b: 0.8, ax: 0.5, ay: 0.0, bx: 0.5, by: 1.1, grid: 0.35 });
    headline(g, STYLES.head, t, M.lineup[0] - 0.05, { x: W / 2, y: 142, size: 92, align: 'center' });

    // the four of them
    const away = E.inCubic(prog(t, M.styleTiles[0] - 0.4, M.styleTiles[0] + 0.05));
    if (away < 1) {
      LINEUP.forEach((l, k) => {
        const p = popK(t, M.lineup[k], 0.5);
        if (p <= 0) return;
        const cx = W / 2 + (k - 1.5) * 330, cy = 590 + away * 120;
        const rot = (k - 1.5) * 0.035;
        const bob = Math.sin((t - M.lineup[k]) * 1.8 + k) * 4;
        glow(g, cx, cy + 40, 260, k % 2 ? 'rgba(219,39,119,0.18)' : 'rgba(124,58,237,0.22)', clamp(p) * (1 - away));
        card(g, md.pic(l.pic), cx, cy + bob, 338, 600, { rot, sc: p * (1 - away * 0.1), alpha: clamp(p) * (1 - away), r: 22, sh: 0.8, focus: [0.5, 0.5] });
        around(g, cx, cy + 352 + bob, { sc: clamp(p), alpha: clamp(p) * (1 - away) }, () => {
          nameTag(g, `${l.who.name}`, 0, 0, { size: 24, sub: l.who.style });
        });
      });
    }

    // nine of its styles
    if (t >= M.styleTiles[0] - 0.02) {
      const gw = TW * 3 + TG * 2, gh = TH * 3 + TG * 2;
      const gx = W / 2 - gw / 2, gy = GY - gh / 2;
      g.save();
      g.translate(W / 2, GY); g.rotate(-0.045); g.translate(-W / 2, -GY);
      STYLES.tiles.forEach(([pic, name], k) => {
        const t0 = M.styleTiles[k];
        const p = popK(t, t0, 0.45);
        if (p <= 0) return;
        const x = gx + (k % 3) * (TW + TG) + TW / 2, y = gy + Math.floor(k / 3) * (TH + TG) + TH / 2;
        const dim = t >= M.stamp26 ? 0.25 * E.outCubic(prog(t, M.stamp26, M.stamp26 + 0.3)) : 0;
        card(g, md.pic(pic), x, y, TW, TH, { sc: p, alpha: clamp(p), r: 18, sh: 0.6, focus: [0.5, 0.35], dim });
        around(g, x, y + TH / 2 - 26, { sc: clamp(p), alpha: clamp(p) }, () => pill(g, name, 0, 0, { size: 18, align: 'center', bg: 'rgba(10,10,13,0.82)', line: S.line2 }));
      });
      g.restore();
      stamp(g, STYLES.stamp, W / 2, GY, t, M.stamp26, { size: 104, rot: -0.07 });
    }
    // or Any style: under the grid, clear of its lowest corner (958 px) however it's turned
    if (t >= M.anyStyle) {
      const p = E.outCubic(prog(t, M.anyStyle, M.anyStyle + 0.35));
      say(g, STYLES.any, { x: W / 2, y: 1024 + (1 - p) * 14, size: 34, weight: 600, color: S.text2, align: 'center', alpha: p });
    }
  },
};
void mix;
