// The roadmap's video, scene 1 (0–4 s): its title, as the roadmap page's hero is in Pop mode: violet, comic focus lines,
// pink halftone, AGI-1 (the front's 2D art, revealed in halftone dots), "Roadmap · October 2026", The · AGI · roadmap
// slammed in one word a beat, "What's live today, and what's coming next.", and the road's six stops along the bottom.
import { C, E, prog, clamp, mix, text, pill, popWord, measure, around, slamK, popK, icon } from '../parts.js';
import { halftone, focusLines, canvas, riseWords } from '../../../promo/page/kit.js';
import { createArt } from '../../../promo/page/art.js';
import { TITLE, STEPS } from '../../words.js';

let art = null, dots = null;
// the page's pink halftone in a W × H picture's bottom left corner, fading out (rm-hero::after); `from`: the corner it
// grows from
export function makeDots(W, H, { cell = 17, reach = 0.62, from = [0, H] } = {}) {
  const cv = canvas(W, H);
  const d = cv.getContext('2d');
  d.drawImage(halftone(W, H, cell, C.pink, 0.13), 0, 0);
  d.globalCompositeOperation = 'destination-in';
  const gr = d.createRadialGradient(from[0], from[1], 0, from[0], from[1], Math.max(W, H) * reach);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  d.fillStyle = gr; d.fillRect(0, 0, W, H);
  return cv;
}
export async function prepare(ctx) {
  art = await createArt(ctx);
  dots = makeDots(ctx.W, ctx.H);
}

// the hero's background, shared with the end card and the graphics (cards.js: their own dots, `halftone`, for their size)
export function heroBackground(g, c, t, { cx = 1415, cy = 470, beat = 0, glow = 760, halftone: dd = dots } = {}) {
  const { W, H } = c;
  g.fillStyle = C.violet;
  g.fillRect(0, 0, W, H);
  focusLines(g, cx, cy, Math.hypot(W, H), t, { color: `rgba(255,255,255,${0.07 + 0.05 * beat})`, count: 54, spin: 0.035, seed: 5 });
  // a soft light behind her
  const gr = g.createRadialGradient(cx, cy, 40, cx, cy, glow);
  gr.addColorStop(0, 'rgba(205,184,255,0.32)'); gr.addColorStop(1, 'rgba(107,59,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (dd) { g.save(); g.globalAlpha = 0.9; g.drawImage(dd, 0, 0, W, H); g.restore(); }
}

// her art (the front's): o = { x, y, h, reveal, echo, hover, t }
export function drawArt(g, o) { if (art) art.draw(g, { x: o.x, y: o.y, h: o.h }, { reveal: o.reveal, echo: o.echo, hover: o.hover || 0, t: o.t, cell: o.cell || 12 }); }
export const artAspect = () => art?.aspect || 796 / 1510;

const WORD = [
  { s: 122, y: 330 },          // The
  { s: 300, y: 602 },          // AGI
  { s: 170, y: 778 },          // roadmap
];
const X0 = 130;
// her art: its height, its middle and where her feet are (the bottom of its box)
const ART = { h: 985, cx: 1436, feet: 1052 };
// the road's six stops along the bottom (the page's timeline, small)
const ROAD = { y: 962, x0: X0, gap: 182 };

// a little stop on the violet (the title's road, and the graphics'): live ones honey and checked, coming ones white with
// a pink dot, the locked one deep violet, dashed, with a lock. `r`: its size (21 for a live one)
export function stopDot(g, state, x, y, r = 21) {
  const k = r / 21;
  g.save();
  g.translate(x, y); g.scale(k, k);
  if (state === 'live') {
    g.beginPath(); g.arc(0, 3, 21, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
    g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fillStyle = C.honey; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    icon(g, 'check', 0, 0, 26, C.ink, { lw: 1.3 });
  } else if (state === 'soon') {
    g.beginPath(); g.arc(0, 3, 19, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
    g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill();
  } else {
    g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.fillStyle = C.violetDeep; g.fill();
    g.setLineDash([6, 5]); g.lineWidth = 3; g.strokeStyle = C.white; g.stroke(); g.setLineDash([]);
    icon(g, 'lock', 0, 1, 22, C.white, { lw: 1.2 });
  }
  g.restore();
}

export function draw(g, t, c) {
  const { M } = c;
  const slams = M.titleWords;
  const beat = slams.reduce((a, s) => a + (t >= s ? Math.exp(-(t - s) * 7) : 0), 0);
  heroBackground(g, c, t, { beat: clamp(beat) });

  // AGI-1, revealed in halftone dots from her feet up, then her print echoes; a flicker of color on each slam
  const reveal = clamp(prog(t, M.reveal, M.reveal + 1.55));
  const echo = E.outCubic(prog(t, M.titleWords[2], M.titleWords[2] + 0.8));
  // a slow push-in around her feet, so her shoes stay in the picture (the first cut grew her from her middle, and her
  // shoes went under the frame's bottom)
  const push = 1 + 0.035 * E.inOutQuad(prog(t, 0, 4));
  const h = ART.h * push;
  drawArt(g, { x: ART.cx - (h * artAspect()) / 2, y: ART.feet - h, h, reveal, echo, hover: clamp(beat) * 0.8, t });

  // "Roadmap · October 2026"
  const kk = popK(t, M.kicker, 0.45);
  around(g, X0, 196, { sc: kk, alpha: clamp(kk * 2) }, () => {
    pill(g, TITLE.kicker, { x: 0, y: 0, align: 'left', font: { f: 'mono', w: 700, s: 22 }, bg: C.honey, color: C.ink, line: C.ink, lw: 3, h: 48, padX: 20, shadow: 4, upper: true, spacing: 2.4, dot: C.ink });
  });

  // The · AGI · roadmap, slammed in on the beat (the page's title: lavender, an ink outline, a pink print echo)
  TITLE.words.forEach((w, k) => {
    const t0 = slams[k];
    if (t < t0) return;
    const font = { f: 'display', w: 900, s: WORD[k].s, st: 'expanded' };
    const ww = measure(g, w, font, -WORD[k].s * 0.03);
    const sc = slamK(t, t0, k === 1 ? 1.9 : 1.6, { freq: 3.1, damp: 0.42 });
    const a = clamp(prog(t, t0, t0 + 0.05));
    const cy = WORD[k].y - WORD[k].s * 0.36;
    around(g, X0 + ww / 2, cy, { sc, alpha: a }, () => {
      popWord(g, w, -ww / 2, WORD[k].s * 0.36, {
        font, align: 'left', fill: C.lav, stroke: C.ink, sw: Math.max(8, WORD[k].s * 0.055), echo: C.pink, off: WORD[k].s * 0.045, spacing: -WORD[k].s * 0.03,
      });
    });
  });

  // "What's live today, and what's coming next." (the page's subtitle, in its serif)
  riseWords(g, TITLE.sub.split(' '), t, M.sub, { x: X0 + 4, y: 884, font: { f: 'serif', w: 400, s: 54, i: true }, color: C.white, stagger: 0.05, dur: 0.5 });

  // the road's six stops: the line draws, then each stop pops on its blip (two live, three coming, one locked)
  const lp = E.inOutCubic(prog(t, M.road, M.road + 0.55));
  if (lp > 0) {
    const xEnd = ROAD.x0 + ROAD.gap * 5;
    const xNow = mix(ROAD.x0, xEnd, lp);
    const xLive = ROAD.x0 + ROAD.gap * 1.5;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = C.white; g.lineWidth = 6;
    g.beginPath(); g.moveTo(ROAD.x0, ROAD.y); g.lineTo(Math.min(xNow, xLive), ROAD.y); g.stroke();
    if (xNow > xLive) {
      g.setLineDash([14, 12]); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.beginPath(); g.moveTo(xLive, ROAD.y); g.lineTo(xNow, ROAD.y); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }
  STEPS.forEach((s, k) => {
    const t0 = M.dots[k];
    const pk = popK(t, t0, 0.42, 2.2);
    if (pk <= 0) return;
    const x = ROAD.x0 + ROAD.gap * k, y = ROAD.y;
    around(g, x, y, { sc: pk }, () => stopDot(g, s.state, 0, 0));
    const label = s.state === 'locked' ? `${s.name} ${s.mystery}` : s.name;
    text(g, label.toUpperCase(), { x, y: y + 48, font: { f: 'mono', w: 600, s: 14 }, color: 'rgba(255,255,255,0.86)', align: 'center', spacing: 1, alpha: clamp(prog(t, t0 + 0.05, t0 + 0.3)) });
  });
}

export default { prepare, draw };
