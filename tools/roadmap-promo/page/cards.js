// The roadmap's graphics (2026-10-14, the owner's "X post image, Roadmap link preview, Square 1:1"): still pictures in
// the video's look, each on its own canvas at its own size, drawn once (no clock: everything in its place).
//   x       1920 × 1080: for a post on X (the title, its six stops on the road, her, agi1.app/roadmap)
//   square  1080 × 1080: the same, its stops in a list
//   og      1200 × 630:  the roadmap pages' link preview (public/cards/roadmap.jpg)
// Its words are the roadmap page's (words.js), like the video's.
import { C, text, pill, popWord, measure } from './parts.js';
import { button } from '../../promo/page/ui.js';
import { heroBackground, drawArt, stopDot, makeDots } from './scenes/title.js';
import { SITE, TITLE, STEPS, LABELS, METER, SAFETY } from '../words.js';

export const CARDS = { x: { W: 1920, H: 1080 }, square: { W: 1080, H: 1080 }, og: { W: 1200, H: 630 } };

const dotsFor = new Map();
const halftoneOf = (W, H) => { const k = `${W}x${H}`; if (!dotsFor.has(k)) dotsFor.set(k, makeDots(W, H, { cell: Math.round(17 * Math.min(1, W / 1920 + 0.2)) })); return dotsFor.get(k); };

// the title, two lines (The AGI / roadmap), lavender with an ink outline and a pink echo, at (x, baseline y1 / y2)
function title(g, x, y1, y2, s) {
  const font = { f: 'display', w: 900, s, st: 'expanded' };
  const lines = [`${TITLE.words[0]} ${TITLE.words[1]}`, TITLE.words[2]];
  lines.forEach((str, k) => popWord(g, str, x, k ? y2 : y1, { font, align: 'left', fill: C.lav, stroke: C.ink, sw: Math.max(6, s * 0.055), echo: C.pink, off: s * 0.045, spacing: -s * 0.03 }));
  return Math.max(...lines.map((l) => measure(g, l, font, -s * 0.03)));
}
const kicker = (g, x, y, s = 22) => pill(g, TITLE.kicker, { x, y, align: 'left', font: { f: 'mono', w: 700, s }, bg: C.honey, color: C.ink, line: C.ink, lw: 3, h: s * 2.2, padX: s * 0.9, shadow: 4, upper: true, spacing: s * 0.11, dot: C.ink });
const chipOf = (g, state, x, y, s, align = 'center') => {
  const font = { f: 'mono', w: 700, s };
  const o = { x, y, font, lw: 2, line: C.ink, align, spacing: 1, h: s * 2, padX: s * 0.75, upper: true };
  if (state === 'live') return pill(g, 'Live', { ...o, bg: C.mint, color: C.ink, dot: C.ink });
  if (state === 'soon') return pill(g, 'Coming soon', { ...o, bg: C.white, color: C.ink, dot: C.pink });
  return pill(g, 'Locked', { ...o, bg: C.ink, color: C.honey, dot: C.honey });
};
const nameOf = (s) => (s.state === 'locked' ? `${s.name} ${s.mystery}` : s.name);

// the road across: a white line to "We're here", dashed after it, its six stops, their numbers, names and states
function roadAcross(g, x0, gap, y, { r = 26, name = 26, num = 18, chip = 13, here = true } = {}) {
  const xs = STEPS.map((_, k) => x0 + gap * k);
  const hereX = (xs[1] + xs[2]) / 2;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 7;
  g.beginPath(); g.moveTo(xs[0], y); g.lineTo(hereX, y); g.stroke();
  g.setLineDash([16, 13]); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(hereX, y); g.lineTo(xs[5], y); g.stroke();
  g.restore();
  STEPS.forEach((s, k) => {
    stopDot(g, s.state, xs[k], y, r);
    text(g, s.n, { x: xs[k], y: y + r + num + 16, font: { f: 'mono', w: 700, s: num }, color: 'rgba(255,255,255,0.72)', align: 'center', spacing: 1 });
    text(g, nameOf(s), { x: xs[k], y: y + r + num + 16 + name + 10, font: { f: 'display', w: 850, s: name, st: 'semi-expanded' }, color: C.white, align: 'center', spacing: -0.3 });
    chipOf(g, s.state, xs[k], y + r + num + 16 + name + 10 + chip * 2.4, chip);
  });
  if (here) {
    // "We're here": a pink dot on the road, its tag above on a stem
    g.beginPath(); g.arc(hereX, y, 12, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.fillRect(hereX - 2, y - 66, 4, 54);
    pill(g, LABELS.here, { x: hereX, y: y - 84, font: { f: 'mono', w: 700, s: 17 }, bg: C.pink, color: C.ink, line: C.ink, lw: 3, h: 40, padX: 16, shadow: 4, upper: true, spacing: 1.2 });
  }
}

// ---------- each graphic ----------
function drawX(g, c) {
  const { W, H } = c;
  heroBackground(g, c, 0, { cx: 1590, cy: 520, glow: 820, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 1318, y: 62, h: 1000, reveal: 1, echo: 1, t: 0.6 });
  // the title a little smaller than the video's, so "roadmap" ends well before her hand
  kicker(g, 110, 128, 23);
  title(g, 110, 318, 490, 176);
  text(g, TITLE.sub, { x: 114, y: 596, font: { f: 'serif', w: 400, s: 54, i: true }, color: C.white });
  roadAcross(g, 200, 206, 742, { r: 25, name: 25, num: 17, chip: 12 });   // its first name starts where the title does
  const bf = { f: 'display', w: 850, s: 34, st: 'semi-expanded' };
  const b = button(g, SITE, { x: 110, y: 996, align: 'left', font: bf, bg: C.honey, color: C.ink, h: 76, padX: 34, shadow: 7, lw: 3.5 });
  text(g, SAFETY, { x: b.x + b.w + 34, y: 1004, font: { f: 'mono', w: 600, s: 19 }, color: 'rgba(255,255,255,0.84)', spacing: 0.4 });
}

function drawSquare(g, c) {
  const { W, H } = c;
  // her on the right, big, her face clear of every word; the title, its line, the address and the road on the left
  heroBackground(g, c, 0, { cx: 840, cy: 330, glow: 560, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 588, y: 130, h: 920, reveal: 1, echo: 1, t: 0.6 });
  kicker(g, 64, 84, 17);
  title(g, 64, 210, 293, 90);
  text(g, TITLE.sub, { x: 66, y: 362, font: { f: 'serif', w: 400, s: 30, i: true }, color: C.white });
  const bf = { f: 'display', w: 850, s: 24, st: 'semi-expanded' };
  button(g, SITE, { x: 64, y: 430, align: 'left', font: bf, bg: C.honey, color: C.ink, h: 56, padX: 24, shadow: 6, lw: 3.5 });
  // its stops in a list, down a road on the left
  const x = 94, rows = [536, 612, 732, 808, 884, 960], hereY = 672;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x, rows[0]); g.lineTo(x, hereY); g.stroke();
  g.setLineDash([12, 10]); g.lineWidth = 4.5; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(x, hereY); g.lineTo(x, rows[5]); g.stroke();
  g.restore();
  STEPS.forEach((s, k) => {
    stopDot(g, s.state, x, rows[k], 19);
    const nf = { f: 'display', w: 850, s: 30, st: 'semi-expanded' };
    text(g, `${s.n}`, { x: x + 42, y: rows[k] + 10, font: { f: 'mono', w: 700, s: 16 }, color: 'rgba(255,255,255,0.7)', spacing: 1 });
    const nw = text(g, nameOf(s), { x: x + 80, y: rows[k] + 11, font: nf, color: C.white, spacing: -0.3 });
    chipOf(g, s.state, x + 80 + nw + 14, rows[k], 12, 'left');
  });
  g.beginPath(); g.arc(x, hereY, 11, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  pill(g, LABELS.here, { x: x + 32, y: hereY, align: 'left', font: { f: 'mono', w: 700, s: 15 }, bg: C.pink, color: C.ink, line: C.ink, lw: 2.5, h: 34, padX: 14, shadow: 3, upper: true, spacing: 1 });
  text(g, SAFETY, { x: 64, y: H - 34, font: { f: 'mono', w: 600, s: 15 }, color: 'rgba(255,255,255,0.8)', spacing: 0.3 });
}

function drawOg(g, c) {
  const { W, H } = c;
  heroBackground(g, c, 0, { cx: 1010, cy: 300, glow: 460, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 852, y: 26, h: 600, reveal: 1, echo: 1, t: 0.6, cell: 8 });
  kicker(g, 60, 74, 17);
  title(g, 60, 214, 330, 112);
  text(g, TITLE.sub, { x: 62, y: 400, font: { f: 'serif', w: 400, s: 36, i: true }, color: C.white });
  // its six stops, small, and the meter's words
  const y = 482, x0 = 82, gap = 112;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 5;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + gap * 1.5, y); g.stroke();
  g.setLineDash([11, 9]); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(x0 + gap * 1.5, y); g.lineTo(x0 + gap * 5, y); g.stroke();
  g.restore();
  STEPS.forEach((s, k) => stopDot(g, s.state, x0 + gap * k, y, 19));
  text(g, `${METER.n} ${METER.of} ${METER.text}`, { x: 62, y: 560, font: { f: 'mono', w: 700, s: 22 }, color: C.white, spacing: 0.6 });
  text(g, SITE, { x: 62, y: 598, font: { f: 'mono', w: 600, s: 18 }, color: C.honey, spacing: 0.6 });
  void W; void H;
}

export const DRAW = { x: drawX, square: drawSquare, og: drawOg };
