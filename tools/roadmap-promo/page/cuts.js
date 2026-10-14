// The roadmap's video: its two cuts (the road's three scenes are one world seen by one moving camera: no cut between
// them). Each is on the bar the scenes change on (tools/roadmap-promo/timeline.js), after the music's breath before it.
//   into the road: the title's little road at the bottom comes at us (a dive into it, the page going lavender), and the
//                  road's world opens out of a flash on the drop
//   into the end:  a violet slab with a pink edge rises over the whole road, and the end card is on it
// A scene drawn before its start shows its first moment, one drawn after its end its last.
import { SCENES } from '../timeline.js';
import { C, E, prog, clamp, mix } from '../../promo/page/kit.js';

// the title's road starts here (scenes/title.js ROAD): the dive goes into it
const ROAD_START = [130, 962];

const dive = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    if (t < c.B.from) {
      // the title rushes at us around its road's start, washing out to the road's lavender
      const p = E.inQuad(prog(t, c.B.from - pre, c.B.from));
      const z = 1 + 0.75 * p;
      const [x, y] = ROAD_START;
      g.save();
      g.translate(x, y); g.scale(z, z); g.translate(-x, -y);
      c.drawA(g);
      g.restore();
      g.fillStyle = `rgba(228,217,255,${clamp(p * 1.15 - 0.1)})`;
      g.fillRect(0, 0, W, H);
      return;
    }
    // the road's world, settling from a little closer, out of a flash
    const p = E.outCubic(prog(t, c.B.from, c.B.from + post));
    const z = mix(1.1, 1, p);
    g.save();
    g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    c.drawB(g);
    g.restore();
    const f = 1 - p;
    if (f > 0) { g.fillStyle = `rgba(248,245,255,${f * 0.85})`; g.fillRect(0, 0, W, H); }
  },
});

const slab = (pre, post) => ({
  pre, post,
  draw(g, t, c) {
    const { W, H } = c;
    if (t >= c.B.from) {
      c.drawB(g);
      const f = 1 - E.outCubic(prog(t, c.B.from, c.B.from + post));
      if (f > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,214,240,${f * 0.35})`; g.fillRect(0, 0, W, H); g.restore(); }
      return;
    }
    c.drawA(g);
    // the slab: violet, its top edge a little slanted, a pink band and an ink line on it
    const p = E.inOutCubic(prog(t, c.B.from - pre, c.B.from));
    const slant = 90;
    const top = mix(H + slant + 40, -slant - 40, p);
    const edge = (dy) => { g.beginPath(); g.moveTo(0, top + slant / 2 + dy); g.lineTo(W, top - slant / 2 + dy); g.lineTo(W, H + 200); g.lineTo(0, H + 200); g.closePath(); };
    edge(-22); g.fillStyle = C.pink; g.fill();
    edge(-14); g.fillStyle = C.ink; g.fill();
    edge(0); g.fillStyle = C.violet; g.fill();
  },
});

// the cut into each scene that has one, with how long it takes before and after the bar
const KINDS = {
  live: dive(0.25, 0.32),
  end: slab(0.38, 0.22),
};
export const TRANSITIONS = SCENES.map((s, i) => ({ s, i })).filter(({ s, i }) => i > 0 && KINDS[s.id])
  .map(({ s, i }) => ({ i: i - 1, at: s.from, id: s.id, ...KINDS[s.id] }));
export const cutKinds = () => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.pre + v.post]));
