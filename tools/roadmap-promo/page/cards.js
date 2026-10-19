// The roadmap's graphics (2026-10-14, the owner's "X post image, Roadmap link preview, Square 1:1"): still pictures in
// the video's look, each on its own canvas at its own size, drawn once (no clock: everything in its place).
//   x       1920 × 1080: for a post on X (the title, its ten stops on a road that turns back once, her, agi1.app/roadmap)
//   square  1080 × 1080: the same, its stops in a list down a road
//   og      1200 × 630:  the roadmap pages' link preview (public/cards/roadmap.jpg): its ten stops, small
// Its words are the roadmap page's (words.js), like the video's. Since 2026-10-19 (the roadmap's ten steps, "in no
// particular order"): ten stops, the page's note, and a legend of what each stop's look means (live, under way, coming
// soon, locked), in the page's own words.
import { C, text, pill, popWord, measure } from './parts.js';
import { button, lines } from '../../promo/page/ui.js';
import { heroBackground, drawArt, stopDot, makeDots } from './scenes/title.js';
import { SITE, TITLE, STEPS, LABELS, METER, SAFETY, NOTE } from '../words.js';

export const CARDS = { x: { W: 1920, H: 1080 }, square: { W: 1080, H: 1080 }, og: { W: 1200, H: 630 } };

const dotsFor = new Map();
const halftoneOf = (W, H) => { const k = `${W}x${H}`; if (!dotsFor.has(k)) dotsFor.set(k, makeDots(W, H, { cell: Math.round(17 * Math.min(1, W / 1920 + 0.2)) })); return dotsFor.get(k); };

// the title, two lines (The AGI / roadmap), lavender with an ink outline and a pink echo, at (x, baseline y1 / y2)
function title(g, x, y1, y2, s) {
  const font = { f: 'display', w: 900, s, st: 'expanded' };
  const ls = [`${TITLE.words[0]} ${TITLE.words[1]}`, TITLE.words[2]];
  ls.forEach((str, k) => popWord(g, str, x, k ? y2 : y1, { font, align: 'left', fill: C.lav, stroke: C.ink, sw: Math.max(6, s * 0.055), echo: C.pink, off: s * 0.045, spacing: -s * 0.03 }));
  return Math.max(...ls.map((l) => measure(g, l, font, -s * 0.03)));
}
const kicker = (g, x, y, s = 22) => pill(g, TITLE.kicker, { x, y, align: 'left', font: { f: 'mono', w: 700, s }, bg: C.honey, color: C.ink, line: C.ink, lw: 3, h: s * 2.2, padX: s * 0.9, shadow: 4, upper: true, spacing: s * 0.11, dot: C.ink });
// the page's note ("In no particular order…"), on a white sticker
const note = (g, x, y, s) => pill(g, NOTE, { x, y, align: 'left', font: { f: 'sans', w: 600, s }, bg: C.white, color: C.ink, line: C.ink, lw: 3, h: s * 2.05, padX: s * 0.85, shadow: 4, spacing: 0 });
const nameOf = (s) => (s.state === 'locked' ? `${s.name} ${s.mystery}` : s.name);
const NAME = (s) => ({ f: 'display', w: 850, s, st: 'semi-expanded' });

// every name at one size: the biggest (from `from` down to `to`) at which each one fits its width (`widths[k]`) on one
// line, or on two broken at a space (the split whose longer line is shortest); else wrapped at `to`
function fitNames(g, names, widths, from, to) {
  const fits = (str, s, w) => measure(g, str, NAME(s), -0.3) <= w;
  const twoLines = (name, s, w) => {
    const words = name.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      if (!fits(a, s, w) || !fits(b, s, w)) continue;
      const longer = Math.max(measure(g, a, NAME(s), -0.3), measure(g, b, NAME(s), -0.3));
      if (!best || longer < best.longer) best = { lines: [a, b], longer };
    }
    return best?.lines || null;
  };
  for (let s = from; s >= to; s -= 1) {
    const out = names.map((n, k) => (fits(n, s, widths[k]) ? [n] : twoLines(n, s, widths[k])));
    if (out.every(Boolean)) return { s, lines: out };
  }
  return { s: to, lines: names.map((n, k) => lines(g, n, NAME(to), widths[k])) };
}

// what a stop's look means, in the page's own words for each state (Live, Under way, Coming soon, Locked): its dot, then
// its word, one after another from x; returns where it ends
const STATES = ['live', 'going', 'soon', 'locked'].map((state) => ({ state, word: STEPS.find((s) => s.state === state)?.status })).filter((s) => s.word);
function legend(g, x, y, { r = 12, s = 17, gap = 26, color = C.white } = {}) {
  let cx = x;
  for (const { state, word } of STATES) {
    stopDot(g, state, cx + r, y, r);
    const w = text(g, word, { x: cx + r * 2 + 10, y: y + s * 0.36, font: { f: 'mono', w: 700, s }, color, spacing: 0.6 });
    cx += r * 2 + 10 + w + gap;
  }
  return cx - gap;
}

// "We're here": a pink dot on the road, its tag above it on a stem
function here(g, x, y, { s = 17, stem = 54, dot = 12 } = {}) {
  g.beginPath(); g.arc(x, y, dot, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.fillRect(x - 2, y - dot - stem, 4, stem);
  pill(g, LABELS.here, { x, y: y - dot - stem - s * 1.05, font: { f: 'mono', w: 700, s }, bg: C.pink, color: C.ink, line: C.ink, lw: 3, h: s * 2.35, padX: s * 0.95, shadow: 4, upper: true, spacing: 1.2 });
}

// the road as the X picture draws it, in two rows read like lines of text: 01 to 05 on row A, 06 to 10 on row B, the
// road running on past 05 and coming in again before 06; solid from 01 to "We're here" (between the live steps and the
// rest), dashed after it. Each stop its number above it and its name under it (the last of a row may spread wider:
// nothing is right of it)
function roadRows(g, xs, yA, yB, { r = 23, num = 18, nameW = 236, lastW = 330, from = 27, to = 21, run = 54 } = {}) {
  const hereX = (xs[1] + xs[2]) / 2;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 7;
  g.beginPath(); g.moveTo(xs[0], yA); g.lineTo(hereX, yA); g.stroke();
  g.setLineDash([16, 13]); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(hereX, yA); g.lineTo(xs.at(-1) + run, yA); g.stroke();
  g.beginPath(); g.moveTo(xs[0] - run, yB); g.lineTo(xs.at(-1), yB); g.stroke();
  g.restore();
  const widths = STEPS.map((_, k) => (k === 4 ? lastW : nameW));
  const fit = fitNames(g, STEPS.map(nameOf), widths, from, to);
  const lh = Math.round(fit.s * 1.08);
  STEPS.forEach((s, k) => {
    const x = xs[k % 5], y = k < 5 ? yA : yB;
    stopDot(g, s.state, x, y, r);
    text(g, s.n, { x, y: y - r - 14, font: { f: 'mono', w: 700, s: num }, color: 'rgba(255,255,255,0.78)', align: 'center', spacing: 1 });
    fit.lines[k].forEach((ln, i) => text(g, ln, { x, y: y + r + 12 + fit.s * 0.82 + i * lh, font: NAME(fit.s), color: C.white, align: 'center', spacing: -0.3 }));
  });
  here(g, hereX, yA);
}

// ---------- each graphic ----------
function drawX(g, c) {
  const { W, H } = c;
  heroBackground(g, c, 0, { cx: 1590, cy: 520, glow: 820, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 1318, y: 62, h: 1000, reveal: 1, echo: 1, t: 0.6 });
  // the title a little smaller than the video's, so the road below has room for its ten stops
  kicker(g, 110, 94, 21);
  title(g, 110, 254, 396, 146);
  text(g, TITLE.sub, { x: 113, y: 468, font: { f: 'serif', w: 400, s: 46, i: true }, color: C.white });
  note(g, 110, 528, 21);
  roadRows(g, [170, 440, 710, 980, 1250], 676, 856);
  const bf = { f: 'display', w: 850, s: 30, st: 'semi-expanded' };
  const b = button(g, SITE, { x: 110, y: 1014, align: 'left', font: bf, bg: C.honey, color: C.ink, h: 66, padX: 30, shadow: 6, lw: 3.5 });
  legend(g, b.x + b.w + 36, 1002, { r: 11, s: 16, gap: 24 });
  text(g, SAFETY, { x: b.x + b.w + 36, y: 1038, font: { f: 'mono', w: 600, s: 16 }, color: 'rgba(255,255,255,0.84)', spacing: 0.4 });
}

function drawSquare(g, c) {
  const { W, H } = c;
  // her on the right, big, her face clear of every word; the title, its line, the address, the road and the note on the
  // left
  heroBackground(g, c, 0, { cx: 860, cy: 330, glow: 560, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 640, y: 150, h: 900, reveal: 1, echo: 1, t: 0.6 });
  kicker(g, 60, 62, 16);
  title(g, 60, 164, 240, 80);
  text(g, TITLE.sub, { x: 62, y: 296, font: { f: 'serif', w: 400, s: 28, i: true }, color: C.white });
  const bf = { f: 'display', w: 850, s: 21, st: 'semi-expanded' };
  button(g, SITE, { x: 60, y: 350, align: 'left', font: bf, bg: C.honey, color: C.ink, h: 48, padX: 21, shadow: 5, lw: 3 });
  // its stops in a list, down a road on the left: their names as big as fit beside her (on two lines where they must),
  // "We're here" between the live ones and the rest
  const x = 82, nx = x + 70, nameW = 440;
  const fit = fitNames(g, STEPS.map(nameOf), STEPS.map(() => nameW), 26, 21);
  const lh = Math.round(fit.s * 1.04), gapY = 12, hereGap = 30;
  let y = 426;
  const rows = fit.lines.map((ls, k) => {
    if (k === 2) y += hereGap;
    const h = Math.max(32, ls.length * lh);
    const row = { y: y + h / 2, ls };
    y += h + gapY;
    return row;
  });
  const hereY = (rows[1].y + rows[2].y) / 2;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x, rows[0].y); g.lineTo(x, hereY); g.stroke();
  g.setLineDash([12, 10]); g.lineWidth = 4.5; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(x, hereY); g.lineTo(x, rows.at(-1).y); g.stroke();
  g.restore();
  STEPS.forEach((s, k) => {
    const row = rows[k];
    stopDot(g, s.state, x, row.y, 16);
    text(g, s.n, { x: x + 32, y: row.y + 5, font: { f: 'mono', w: 700, s: 14 }, color: 'rgba(255,255,255,0.72)', spacing: 1 });
    row.ls.forEach((ln, i) => text(g, ln, { x: nx, y: row.y - ((row.ls.length - 1) * lh) / 2 + i * lh + fit.s * 0.36, font: NAME(fit.s), color: C.white, spacing: -0.3 }));
  });
  g.beginPath(); g.arc(x, hereY, 10, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  pill(g, LABELS.here, { x: nx - 4, y: hereY, align: 'left', font: { f: 'mono', w: 700, s: 13 }, bg: C.pink, color: C.ink, line: C.ink, lw: 2.5, h: 28, padX: 11, shadow: 3, upper: true, spacing: 1 });
  note(g, 60, y + 18, 16);
  legend(g, 60, H - 74, { r: 10, s: 14, gap: 20 });
  text(g, SAFETY, { x: 60, y: H - 32, font: { f: 'mono', w: 600, s: 14 }, color: 'rgba(255,255,255,0.8)', spacing: 0.3 });
}

function drawOg(g, c) {
  const { W, H } = c;
  heroBackground(g, c, 0, { cx: 1010, cy: 300, glow: 460, halftone: halftoneOf(W, H) });
  drawArt(g, { x: 852, y: 26, h: 600, reveal: 1, echo: 1, t: 0.6, cell: 8 });
  kicker(g, 60, 74, 17);
  title(g, 60, 214, 330, 112);
  text(g, TITLE.sub, { x: 62, y: 400, font: { f: 'serif', w: 400, s: 36, i: true }, color: C.white });
  // its ten stops, small, their numbers under them, and the meter's words
  const y = 470, x0 = 80, gap = 70;
  const xs = STEPS.map((_, k) => x0 + gap * k), hereX = (xs[1] + xs[2]) / 2;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.white; g.lineWidth = 5;
  g.beginPath(); g.moveTo(xs[0], y); g.lineTo(hereX, y); g.stroke();
  g.setLineDash([11, 9]); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.78)';
  g.beginPath(); g.moveTo(hereX, y); g.lineTo(xs.at(-1), y); g.stroke();
  g.restore();
  STEPS.forEach((s, k) => {
    stopDot(g, s.state, xs[k], y, 17);
    text(g, s.n, { x: xs[k], y: y + 46, font: { f: 'mono', w: 700, s: 14 }, color: 'rgba(255,255,255,0.78)', align: 'center', spacing: 0.6 });
  });
  text(g, `${METER.n} ${METER.of} ${METER.text}`, { x: 62, y: 564, font: { f: 'mono', w: 700, s: 22 }, color: C.white, spacing: 0.6 });
  text(g, SITE, { x: 62, y: 600, font: { f: 'mono', w: 600, s: 18 }, color: C.honey, spacing: 0.6 });
  void W; void H;
}

export const DRAW = { x: drawX, square: drawSquare, og: drawOg };
