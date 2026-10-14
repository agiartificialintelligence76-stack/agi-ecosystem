// The roadmap's video, its end card (18–21.5 s): the hero's violet again, AGI-1 printed in halftone dots on the left
// (the front's 2D art), her line from the page ("two live, four on the way. i'm a little excited 💜") in a bubble by
// her face, and on the right "The AGI roadmap", "Be the first to know.", agi1.app/roadmap, Follow @agi1dotapp and the
// page's fine print. Hearts on the last two hits.
import { C, E, prog, clamp, mix, text, pill, popWord, measure, around, slamK, popK } from '../parts.js';
import { button, bubble, burst } from '../../../promo/page/ui.js';
import { heroBackground, drawArt } from './title.js';
import { SITE, SAY, END } from '../../words.js';

const X0 = 1000;                    // the right column
const MAXW = 1820 - X0;             // as wide as its words may be
const HER = { x: 300, y: 118, h: 912 };
// her bubble: wide enough for her line in two lines, above the kicker (its tail toward her face)
const BUBBLE = { x: 700, y: 120, maxW: 380, font: { f: 'sans', w: 600, s: 27 }, cps: 55 };
const TITLE = { s: 118, lines: [['Be', 'the', 'first'], ['to', 'know.']], y: [468, 600] };

// the two lines' size: as big as fits the column
let sized = null;
function titleFont(g) {
  if (sized) return sized;
  let s = TITLE.s;
  const f = () => ({ f: 'display', w: 900, s, st: 'semi-expanded' });
  while (s > 70 && Math.max(...TITLE.lines.map((l) => measure(g, l.join(' '), f(), -s * 0.03))) > MAXW) s -= 2;
  sized = f();
  return sized;
}

export function draw(g, t, c) {
  const { M, W, H } = c;
  const hits = [M.end, ...M.lastHits];
  const beat = hits.reduce((a, s) => a + (t >= s ? Math.exp(-(t - s) * 6) : 0), 0);
  heroBackground(g, c, t, { cx: HER.x + 250, cy: 520, beat: clamp(beat) });

  // AGI-1, printed again: she rises a little as her dots come in, then her print echoes
  const rise = 1 - E.outCubic(prog(t, M.end, M.end + 0.7));
  const reveal = clamp(prog(t, M.end, M.end + 0.95));
  const echo = E.outCubic(prog(t, M.end + 0.6, M.end + 1.3));
  drawArt(g, { x: HER.x, y: HER.y + rise * 120, h: HER.h, reveal, echo, hover: clamp(beat) * 0.7, t, cell: 11 });

  // her line, in a bubble by her face, its tail toward her, typed out
  const sk = popK(t, M.say, 0.45, 1.8);
  if (sk > 0) {
    const m = bubble(g, SAY, { x: 0, y: 0, maxW: BUBBLE.maxW, font: BUBBLE.font, measureOnly: true });
    const typed = Math.floor(Math.max(0, t - M.say - 0.08) * BUBBLE.cps);
    around(g, BUBBLE.x, BUBBLE.y + m.h, { sc: sk, alpha: clamp(sk * 2) }, () => {
      const tail = () => { g.beginPath(); g.moveTo(22, -14); g.lineTo(64, -6); g.lineTo(-38, 34); g.closePath(); };
      g.save(); g.translate(6, 6); tail(); g.fillStyle = C.ink; g.fill(); g.restore();
      tail(); g.fillStyle = C.white; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke();
      bubble(g, SAY, { x: 0, y: -m.h, maxW: BUBBLE.maxW, font: BUBBLE.font, typed, lw: 3, shadow: 6 });
    });
  }

  // "The AGI roadmap"
  const kk = popK(t, M.end + 0.05, 0.45);
  around(g, X0, 300, { sc: kk, alpha: clamp(kk * 2) }, () => {
    pill(g, END.kicker, { x: 0, y: 0, align: 'left', font: { f: 'mono', w: 700, s: 24 }, bg: C.honey, color: C.ink, line: C.ink, lw: 3, h: 52, padX: 22, shadow: 5, upper: true, spacing: 2.4, dot: C.ink });
  });

  // "Be the first / to know.", slammed in a line a beat
  const font = titleFont(g);
  TITLE.lines.forEach((words, k) => {
    const t0 = M.end + k * 0.25;
    if (t < t0) return;
    const str = words.join(' ');
    const ww = measure(g, str, font, -font.s * 0.03);
    const sc = slamK(t, t0, 1.5, { freq: 3.1, damp: 0.42 });
    const cy = TITLE.y[k] - font.s * 0.36;
    around(g, X0 + ww / 2, cy, { sc, alpha: clamp(prog(t, t0, t0 + 0.05)) }, () => {
      popWord(g, str, -ww / 2, font.s * 0.36, { font, align: 'left', fill: C.lav, stroke: C.ink, sw: Math.max(8, font.s * 0.06), echo: C.pink, off: font.s * 0.05, spacing: -font.s * 0.03 });
    });
  });

  // agi1.app/roadmap, as a big honey button that bounces on the last hits
  const uk = t < M.url ? 0 : slamK(t, M.url, 1.35, { freq: 2.8, damp: 0.4 });
  if (uk > 0) {
    const press = M.lastHits.reduce((a, s) => a + (t >= s ? Math.exp(-(t - s) * 9) : 0), 0);
    const bf = { f: 'display', w: 850, s: 48, st: 'semi-expanded' };
    const bw = measure(g, SITE, bf) + 48 * 2.1;
    around(g, X0 + bw / 2, 735, { sc: uk, alpha: clamp(prog(t, M.url, M.url + 0.06)) }, () => {
      button(g, SITE, { x: 0, y: 0, font: bf, bg: C.honey, color: C.ink, h: 104, padX: 50, shadow: 9, press: clamp(press), lw: 4 });
    });
    for (const [k, s] of M.lastHits.entries()) {
      burst(g, X0 + bw * (k ? 0.82 : 0.2), 700, t, s, { n: 14, speed: 560, size: 34, kind: 'heart', colors: [C.pink, C.honey, C.white, C.lav], life: 1.0, seed: 11 + k * 7, gravity: 420, up: 0.75 });
    }
  }

  // Follow @agi1dotapp
  const fk = popK(t, M.handle, 0.42);
  around(g, X0, 852, { sc: fk, alpha: clamp(fk * 2) }, () => {
    pill(g, END.follow, { x: 0, y: 0, align: 'left', font: { f: 'mono', w: 700, s: 25 }, bg: C.white, color: C.ink, line: C.ink, lw: 3, h: 56, padX: 24, shadow: 5, spacing: 0.6 });
  });

  // the page's fine print
  const fa = clamp(prog(t, M.fineEnd, M.fineEnd + 0.35));
  END.fine.forEach((ln, k) => text(g, ln, { x: X0, y: 948 + k * 28, font: FINE, color: 'rgba(255,255,255,0.84)', alpha: fa }));
  void W; void H; void mix;
}
const FINE = { f: 'mono', w: 500, s: 15 };

export default { draw };
