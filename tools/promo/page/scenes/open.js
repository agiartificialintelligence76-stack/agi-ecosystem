// 0–8 s, the cold open, in the site's lab look (dark): a straight-faced AI lab launch film. A heart monitor sweeps along
// the bottom (the "doki doki" heartbeat in the music). "The biggest labs are racing to build" → "AGI" slams in → its
// letters fly into "Artificial / General / Intelligence" → "General" is struck out in pink and "Girlfriend" is written in
// (the site's own joke) → the cursor presses the ✦ button (Pop mode) → a violet circle swallows the screen: the drop.
import { C, FONTS, E, ep, prog, clamp, mix, text, measure, setFont, riseWords, canvas, spark, heart, rgba } from '../kit.js';
import { pill, cursor } from '../ui.js';

const BG = C.labBg;
let grid = null;

function layout(c) {
  const { W, H, wide } = c;
  const bar = wide ? { top: 0, h: 78, pad: 56 } : { top: 236, h: 86, pad: 64 };
  return {
    bar,
    eyebrowY: wide ? 268 : 620,
    leadY: wide ? 352 : 716,
    leadS: wide ? 50 : 46,
    agiS: wide ? 330 : 300, agiY: wide ? 720 : 1150,
    wordS: wide ? 118 : 104, lineY: wide ? [540, 662, 784] : [980, 1096, 1212],
    girlS: wide ? 140 : 104, gap: wide ? 40 : 26,
    ecgY: wide ? 942 : 1440,
  };
}

// the top bar: its pieces' places (the ✦ button is the one that matters: the cursor presses it)
function barPieces(g, c, Lo) {
  const { W, wide } = c;
  const { bar } = Lo;
  const mid = bar.top + bar.h / 2;
  const btn = { s: wide ? 42 : 50 };
  const tryFont = { f: 'sans', w: 600, s: wide ? 17 : 22 };
  const tryW = measure(g, 'Try AGI-1', tryFont) + (wide ? 38 : 46);
  const tryX = W - bar.pad - tryW;
  const spark = { x: tryX - (wide ? 16 : 20) - btn.s / 2, y: mid, r: btn.s / 2 };
  const theme = { x: spark.x - btn.s - (wide ? 10 : 12), y: mid, r: btn.s / 2 };
  return { mid, btn, tryFont, tryW, tryX, spark, theme };
}

function drawBar(g, c, Lo, t, P) {
  const { W, wide } = c;
  const { bar } = Lo;
  const a = ep(t, 0.15, 0.85);
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  g.translate(0, (1 - a) * -10);
  // hairline
  g.fillStyle = C.labLine;
  g.fillRect(0, bar.top + bar.h, W, 1.5);
  // wordmark
  text(g, 'AGI', { x: bar.pad, y: P.mid + 1, font: { f: 'sans', w: 650, s: wide ? 27 : 34 }, color: C.labFg, base: 'middle', spacing: -0.5 });
  // the links (computers), or the menu button (phones)
  if (wide) {
    let x = P.theme.x - P.btn.s / 2 - 34;
    const nav = c.words.OPEN.nav;
    for (let k = nav.length - 1; k >= 0; k--) {
      const w = text(g, nav[k], { x, y: P.mid + 1, font: { f: 'sans', w: 500, s: 17 }, color: C.labFg2, base: 'middle', align: 'right' });
      x -= w + 32;
    }
  } else {
    const mx = P.theme.x;
    g.strokeStyle = C.labFg; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(mx - 11, P.mid + k * 8); g.lineTo(mx + 11, P.mid + k * 8); g.stroke(); }
  }
  // the round buttons: the theme (a moon) on computers, ✦ (Pop mode)
  const round = (b) => { g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fillStyle = C.labBg2; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C.labLine; g.stroke(); };
  if (wide) {
    round(P.theme);
    g.beginPath(); g.arc(P.theme.x, P.theme.y, 8, 0, Math.PI * 2); g.fillStyle = C.labFg2; g.fill();
    g.beginPath(); g.arc(P.theme.x + 4.5, P.theme.y - 3.5, 7, 0, Math.PI * 2); g.fillStyle = C.labBg2; g.fill();
  }
  round(P.spark);
  // "Try AGI-1": the lab look's primary button (light on dark)
  const bh = wide ? 40 : 50;
  g.beginPath(); g.roundRect(P.tryX, P.mid - bh / 2, P.tryW, bh, bh / 2); g.fillStyle = C.labFg; g.fill();
  text(g, 'Try AGI-1', { x: P.tryX + P.tryW / 2, y: P.mid + 1, font: P.tryFont, color: C.labBg, base: 'middle', align: 'center' });
  g.restore();
}

// the heart monitor: a trace that sweeps along, with a beat on every heartbeat of the music
function ecg(g, c, Lo, t) {
  const { W } = c;
  const y0 = Lo.ecgY;
  const beats = c.M.heartbeats;
  const T0 = -0.55, T1 = 8.15;                          // the sweep's clock: x = 0 at T0, x = W at T1
  const xOf = (s) => ((s - T0) / (T1 - T0)) * W;
  const now = Math.min(t, 7.95);
  const yAt = (s) => {
    let y = 0;
    for (const b of beats) {
      const d = s - b;
      if (d < -0.25 || d > 0.5) continue;
      y += 7 * Math.exp(-(((d + 0.15) / 0.035) ** 2));                     // P
      y += -12 * Math.exp(-(((d + 0.01) / 0.012) ** 2));                   // Q
      y += 84 * Math.exp(-(((d - 0.025) / 0.014) ** 2));                   // R
      y += -30 * Math.exp(-(((d - 0.06) / 0.013) ** 2));                   // S
      y += 15 * Math.exp(-(((d - 0.28) / 0.06) ** 2));                     // T
    }
    return y;
  };
  const a = ep(t, 0.0, 0.6);
  const head = xOf(now);
  if (head <= 0 || a <= 0) return;
  g.save();
  g.globalAlpha = a;
  // the faint baseline ahead of the trace
  g.fillStyle = C.labLine;
  g.fillRect(head, y0, W - head, 1.5);
  // the trace: brighter near its head (a monitor's phosphor)
  const grad = g.createLinearGradient(Math.max(0, head - W * 0.55), 0, head, 0);
  grad.addColorStop(0, rgba(C.labAccent, 0));
  grad.addColorStop(0.75, rgba(C.labAccent, 0.55));
  grad.addColorStop(1, rgba(C.labAccent, 1));
  g.strokeStyle = grad;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.beginPath();
  const step = 3;
  for (let x = Math.max(0, head - W * 0.6); x <= head; x += step) {
    const s = T0 + (x / W) * (T1 - T0);
    const y = y0 - yAt(s);
    if (x === Math.max(0, head - W * 0.6)) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.lineTo(head, y0 - yAt(now));
  g.stroke();
  // its head: a glowing dot
  const hy = y0 - yAt(now);
  const glow = g.createRadialGradient(head, hy, 0, head, hy, 26);
  glow.addColorStop(0, rgba(C.labAccent, 0.75));
  glow.addColorStop(1, rgba(C.labAccent, 0));
  g.fillStyle = glow;
  g.fillRect(head - 26, hy - 26, 52, 52);
  g.beginPath(); g.arc(head, hy, 4.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  // a small label, like a lab's figure
  text(g, 'FIG. 0 · HEART RATE', { x: c.wide ? 56 : 64, y: y0 + 44, font: { f: 'mono', w: 500, s: c.wide ? 14 : 18 }, color: C.labFg3, spacing: 2, alpha: 0.85 });
  const bpm = t < 0.3 ? '—' : '120';
  text(g, `${bpm} BPM`, { x: W - (c.wide ? 56 : 64), y: y0 + 44, font: { f: 'mono', w: 500, s: c.wide ? 14 : 18 }, color: C.labFg3, spacing: 2, align: 'right', alpha: 0.85 });
  g.restore();
}

// the heartbeat's glow behind the words
const beatGlow = (t, beats) => beats.reduce((m, b) => Math.max(m, t >= b ? Math.exp(-(t - b) * 3.2) : 0), 0);

export default {
  id: 'open',
  prepare(c) {
    // a faint dot grid, like graph paper (made once)
    const { W, H } = c;
    grid = canvas(W, H);
    const x = grid.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.055)';
    for (let yy = 20; yy < H; yy += 40) for (let xx = 20; xx < W; xx += 40) { x.beginPath(); x.arc(xx, yy, 1.2, 0, Math.PI * 2); x.fill(); }
  },
  // where the cut to the next scene starts: the ✦ button
  exit(c) {
    const g = canvas(4, 4).getContext('2d');
    const P = barPieces(g, c, layout(c));
    return { x: P.spark.x, y: P.spark.y };
  },
  draw(g, t, c) {
    const { W, H, wide, M } = c;
    const Lo = layout(c);
    const P = barPieces(g, c, Lo);
    const O = c.words.OPEN;
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    const glowA = 0.05 + 0.1 * beatGlow(t, M.heartbeats);
    const rg = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.55);
    rg.addColorStop(0, rgba(C.labAccent, glowA));
    rg.addColorStop(1, rgba(C.labAccent, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = ep(t, 0, 1.2);
    g.drawImage(grid, 0, 0);
    g.globalAlpha = 1;
    ecg(g, c, Lo, t);
    drawBar(g, c, Lo, t, P);

    // ---- the words, with a slow push-in once AGI lands ----
    const push = 1 + 0.035 * ep(t, M.agi, 7.8, E.inOutQuad);
    g.save();
    const fy = wide ? H * 0.5 : H * 0.48;
    g.translate(W / 2, fy); g.scale(push, push); g.translate(-W / 2, -fy);

    // eyebrow: a pink dot and MODEL RELEASE · 2026, typed in
    const eb = `${O.eyebrow.toUpperCase()} · ${O.year}`;
    const ebN = Math.floor(clamp((t - 0.35) / 0.55) * eb.length);
    if (ebN > 0) {
      const ef = { f: 'mono', w: 500, s: wide ? 18 : 22 };
      const ew = measure(g, eb, ef, 4);
      const ex = W / 2 - ew / 2 + 14;
      g.beginPath(); g.arc(ex - 22, Lo.eyebrowY - 6, 5, 0, Math.PI * 2); g.fillStyle = C.labAccent; g.fill();
      text(g, eb.slice(0, ebN), { x: ex, y: Lo.eyebrowY, font: ef, color: C.labFg3, spacing: 4 });
    }
    // the lead line, word by word on the music
    {
      const font = { f: 'sans', w: 500, s: Lo.leadS };
      const words = O.lead;
      const at = M.openWords;
      const groups = [[0], [1], [2], [3, 4], [5, 6]];        // The · biggest · labs · are racing · to build
      setFont(g, font);
      const space = g.measureText(' ').width;
      const widths = words.map((w) => g.measureText(w).width);
      const total = widths.reduce((s, w) => s + w, 0) + space * (words.length - 1);
      let x = W / 2 - total / 2;
      const dim = 1 - 0.35 * ep(t, M.agi, M.agi + 0.4);
      words.forEach((w, k) => {
        const gi = groups.findIndex((gr) => gr.includes(k));
        const t0 = at[gi] + (groups[gi].indexOf(k) * 0.07) - 0.06;
        const p = ep(t, t0, t0 + 0.5, E.outQuart);
        if (p > 0) {
          g.save();
          g.beginPath(); g.rect(x - 10, Lo.leadY - font.s * 1.05, widths[k] + 20, font.s * 1.45); g.clip();
          text(g, w, { x, y: Lo.leadY + (1 - p) * font.s * 1.1, font, color: C.labFg, alpha: dim * (k >= 4 ? 1 : 0.92) });
          g.restore();
        }
        x += widths[k] + space;
      });
    }

    // "AGI" lands, then its letters fly into a stack: Artificial / General / Intelligence
    const big = { f: 'sans', w: 620, s: Lo.agiS };
    const small = { f: 'sans', w: 620, s: Lo.wordS };
    const words = O.words;                                       // Artificial, General, Intelligence
    const letters = ['A', 'G', 'I'];
    const bigSp = -Lo.agiS * 0.035, smallSp = -Lo.wordS * 0.03;
    const bw = letters.map((L) => measure(g, L, big, bigSp));
    const bigTotal = bw.reduce((s, w) => s + w, 0);
    const restW = words.map((w) => measure(g, w.slice(1), small, smallSp));
    const firstW = words.map((w) => measure(g, w[0], small, smallSp));
    const girlFont = { f: 'serif', w: 400, s: Lo.girlS, i: true };
    const girlW = measure(g, O.girl, girlFont);
    const genW = firstW[1] + restW[1];
    // the stack is centered; when "Girlfriend" is written in beside "General", it slides over to make room
    const stackW = Math.max(firstW[2] + restW[2], firstW[0] + restW[0], genW);
    const heartW = wide ? 60 : 50;
    const blockW = Math.max(stackW, genW + Lo.gap + girlW + heartW);
    const x0 = mix(W / 2 - stackW / 2, W / 2 - blockW / 2, ep(t, M.write - 0.2, M.write + 0.5, E.inOutCubic));
    const spread = ep(t, M.spread, M.spread + 0.6, E.lin);
    if (t >= M.agi - 0.08) {
      const land = ep(t, M.agi - 0.08, M.agi + 0.22, E.outExpo);
      const zoom = mix(1.32, 1, land);
      let bx = W / 2 - bigTotal / 2;
      letters.forEach((L, k) => {
        const sx = bx, sy = Lo.agiY;
        bx += bw[k];
        const ex = x0, ey = Lo.lineY[k];
        const lp = spread <= 0 ? 0 : E.inOutCubic(clamp((spread - k * 0.12) / 0.76));
        const s = mix(Lo.agiS * zoom, Lo.wordS, lp);
        // (zoomed around the word's middle while it lands)
        const zx = W / 2 + (sx - W / 2) * zoom, zy = Lo.agiY - (Lo.agiS * 0.35) * (zoom - 1);
        const x = mix(zx, ex, lp), y = mix(zy, ey, lp);
        const alpha = Math.min(1, ep(t, M.agi - 0.08, M.agi + 0.06, E.lin)) * (k === 1 ? 1 - 0.55 * ep(t, M.strike + 0.05, M.strike + 0.3) : 1);
        text(g, L, { x, y, font: { ...big, s }, color: C.labFg, spacing: mix(bigSp, smallSp, lp) * (s / mix(Lo.agiS, Lo.wordS, lp)), alpha });
      });
      // the rest of each word appears from its first letter
      words.forEach((w, k) => {
        const t0 = M.spread + 0.6 * (0.7 + k * 0.12);           // as its letter gets there
        const p = ep(t, t0, t0 + 0.5, E.outQuart);
        if (p <= 0) return;
        const x = x0 + firstW[k];
        g.save();
        g.beginPath(); g.rect(x - 4, Lo.lineY[k] - Lo.wordS * 1.05, (restW[k] + 30) * p + 4, Lo.wordS * 1.4); g.clip();
        text(g, w.slice(1), { x: x - (1 - p) * 30, y: Lo.lineY[k], font: small, color: C.labFg, spacing: smallSp, alpha: k === 1 ? 1 - 0.55 * ep(t, M.strike + 0.05, M.strike + 0.3) : 1 });
        g.restore();
      });
    }
    // "General" struck out in pink, a marker's stroke
    const sp = ep(t, M.strike, M.strike + 0.24, E.outQuad);
    if (sp > 0) {
      const y = Lo.lineY[1] - Lo.wordS * 0.32;
      const xa = x0 - 14, xb = x0 + genW + 14;
      g.save();
      g.strokeStyle = C.labAccent;
      g.lineWidth = Lo.wordS * 0.13;
      g.lineCap = 'round';
      g.beginPath();
      const n = 24;
      for (let k = 0; k <= n * sp; k++) {
        const q = k / n;
        const x = mix(xa, xb, q), yy = y + Math.sin(q * 9 + 1) * 2.2 - q * 7;
        if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
      g.restore();
    }
    // "Girlfriend" written in, beside it (Instrument Serif's italics, like handwriting), and a heart
    const wp = ep(t, M.write, M.write + 0.6, E.inOutQuad);
    if (wp > 0) {
      const gx = x0 + genW + Lo.gap, gy = Lo.lineY[1] - (wide ? 10 : 8);
      g.save();
      g.translate(gx, gy);
      g.rotate(-0.06);
      g.beginPath(); g.rect(-10, -girlFont.s * 1.1, (girlW + 30) * wp + 10, girlFont.s * 1.6); g.clip();
      text(g, O.girl, { x: 0, y: 0, font: girlFont, color: C.labAccent });
      g.restore();
      const hp = ep(t, M.write + 0.5, M.write + 0.8, E.outBack);
      if (hp > 0) heart(g, gx + girlW + (wide ? 34 : 28), gy - girlFont.s * 0.62, (wide ? 40 : 34) * hp, C.labAccent);
    }
    g.restore();

    // ---- the cursor goes to ✦ and presses it ----
    const cIn = ep(t, 6.55, 6.85);
    if (cIn > 0) {
      const mv = ep(t, 6.7, M.click - 0.18, E.inOutCubic);
      const sx = W * (wide ? 0.84 : 0.78), sy = wide ? H * 0.74 : H * 0.62;
      const tx = P.spark.x + 4, ty = P.spark.y + 6;
      const arc = Math.sin(mv * Math.PI) * (wide ? 90 : 120);
      const x = mix(sx, tx, mv) + arc * 0.3, y = mix(sy, ty, mv) - arc * 0.2;
      // its tooltip
      const tip = ep(t, M.click - 0.42, M.click - 0.3) * (1 - ep(t, M.click + 0.05, M.click + 0.15));
      if (tip > 0) pill(g, 'Pop mode: the bold AGI look', { x: P.spark.x - (wide ? 40 : 120), y: P.spark.y + P.btn.s / 2 + (wide ? 34 : 42), font: { f: 'sans', w: 500, s: wide ? 15 : 20 }, bg: C.labFg, color: C.labBg, line: null, alpha: tip, spacing: 0 });
      // the button lights up under it, then it's pressed
      const hov = ep(t, M.click - 0.3, M.click - 0.15);
      const press = Math.max(0, 1 - Math.abs(t - M.click) / 0.09);
      g.save();
      g.beginPath(); g.arc(P.spark.x, P.spark.y, P.spark.r * (1 - press * 0.08), 0, Math.PI * 2);
      g.fillStyle = rgba(C.violet, 0.35 * hov + 0.5 * press); g.fill();
      g.restore();
      const rot = ep(t, M.click - 0.02, M.click + 0.3, E.outBack) * Math.PI / 4;
      spark(g, P.spark.x, P.spark.y, (wide ? 11 : 13) * (1 - press * 0.15), hov > 0.5 ? C.white : C.labFg, 1, rot);
      // a ring when it's pressed
      const ring = prog(t, M.click, M.click + 0.3);
      if (ring > 0 && ring < 1) {
        g.beginPath(); g.arc(P.spark.x, P.spark.y, P.spark.r + 26 * E.outCubic(ring), 0, Math.PI * 2);
        g.lineWidth = 3; g.strokeStyle = rgba(C.violet, 1 - ring); g.stroke();
      }
      cursor(g, x, y, wide ? 1.45 : 1.9, { press, alpha: cIn });
    } else {
      spark(g, P.spark.x, P.spark.y, wide ? 11 : 13, C.labFg, ep(t, 0.15, 0.85));
    }

    // ---- Pop mode: a violet circle swallows the screen (the cut) ----
    const wipe = ep(t, M.click + 0.02, M.drop, E.inCubic);
    if (wipe > 0) {
      const R = Math.hypot(Math.max(P.spark.x, W - P.spark.x), Math.max(P.spark.y, H - P.spark.y)) + 20;
      g.beginPath(); g.arc(P.spark.x, P.spark.y, Math.max(1, R * wipe), 0, Math.PI * 2);
      g.fillStyle = C.violet; g.fill();
      if (wipe < 1) { g.lineWidth = 12; g.strokeStyle = C.pink; g.stroke(); }
    }
  },
};
