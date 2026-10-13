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
// the nine tiles: two rows (five, then four) across the wide frame (a 3 × 3 grid in 4:3), their middle (and the
// stamp's) at GY: under them, room for the last line
const TW = 232, TH = 274, TG = 20, GY = 548;
const tileAt = (W, k) => {
  const row = k < 5 ? 0 : 1, n = row ? 4 : 5, i = row ? k - 5 : k;
  const rw = n * TW + (n - 1) * TG;
  return { x: W / 2 - rw / 2 + i * (TW + TG) + TW / 2, y: GY + (row - 0.5) * (TH + TG) };
};

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
        const cx = W / 2 + (k - 1.5) * 410, cy = 590 + away * 120;
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
      g.save();
      g.translate(W / 2, GY); g.rotate(-0.045); g.translate(-W / 2, -GY);
      STYLES.tiles.forEach(([pic, name], k) => {
        const t0 = M.styleTiles[k];
        const p = popK(t, t0, 0.45);
        if (p <= 0) return;
        const { x, y } = tileAt(W, k);
        const dim = t >= M.stamp26 ? 0.25 * E.outCubic(prog(t, M.stamp26, M.stamp26 + 0.3)) : 0;
        card(g, md.pic(pic), x, y, TW, TH, { sc: p, alpha: clamp(p), r: 18, sh: 0.6, focus: [0.5, 0.35], dim });
        around(g, x, y + TH / 2 - 26, { sc: clamp(p), alpha: clamp(p) }, () => pill(g, name, 0, 0, { size: 18, align: 'center', bg: 'rgba(10,10,13,0.82)', line: S.line2 }));
      });
      g.restore();
      stamp(g, STYLES.stamp, W / 2, GY, t, M.stamp26, { size: 104, rot: -0.07 });
    }
    // or Any style: under the tiles, clear of their lowest corner (about 880 px) however they're turned
    if (t >= M.anyStyle) {
      const p = E.outCubic(prog(t, M.anyStyle, M.anyStyle + 0.35));
      say(g, STYLES.any, { x: W / 2, y: 960 + (1 - p) * 14, size: 36, weight: 600, color: S.text2, align: 'center', alpha: p });
    }
  },
};
void mix;
