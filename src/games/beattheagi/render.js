// BEAT THE AGI (2026-11-08): the board, the stones, AGI-1's attention over the columns, her portrait and her words,
// drawn on one canvas each frame from a Match (./match.js) and a layout (./layout.js). The static pictures come from
// ./art.js, made once per size.
import { roundRect, star, ease } from '../kit/fx.js';
import { C as COL, INK, makeStone, makeBack, makeFace, makePortrait, heartPath } from './art.js';
import { PINK, MINT } from './rules.js';
import { LEVELS } from './levels.js';

const TAU = Math.PI * 2;
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, Menlo, monospace";
const SERIF = "'AK Serif', Georgia, serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmtBoards = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

export function createRenderer({ reduced = false } = {}) {
  let cache = { C: 0, dpr: 0, bw: 0 };
  let portraitImg = null, portraitReady = false;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { portraitReady = true; cache.pd = 0; };
  img.src = '/images/agi1-live-2d.webp';
  portraitImg = img;
  const wrapCache = new Map();

  // the pictures for this size (made again only when the cell size, the pixel ratio or her portrait's size changes)
  function ensure(L, dpr) {
    if (cache.C !== L.C || cache.dpr !== dpr || cache.bw !== L.board.w) {
      cache = {
        C: L.C, dpr, bw: L.board.w,
        back: makeBack(L, dpr), face: makeFace(L, dpr),
        stones: { [PINK]: makeStone(PINK, L.stone, dpr), [MINT]: makeStone(MINT, L.stone, dpr) },
        pd: 0, pdpr: 0,
      };
    }
    const d = L.her.r * 2 * 0.86;
    if (cache.pd !== d || cache.pdpr !== dpr) { cache.portrait = makePortrait(portraitReady ? portraitImg : null, d, dpr); cache.pd = portraitReady ? d : -1; cache.pdpr = dpr; }
  }

  function stone(g, who, x, y, sx = 1, sy = sx, alpha = 1) {
    const s = cache.stones[who];
    if (!s) return;
    if (alpha !== 1) g.globalAlpha = alpha;
    const w = s.size * sx, h = s.size * sy;
    g.drawImage(s.canvas, x - w / 2, y - h / 2, w, h);
    if (alpha !== 1) g.globalAlpha = 1;
  }

  // ---------- text ----------
  function wrap(g, text, maxW, font) {
    const key = `${font}|${maxW | 0}|${text}`;
    let lines = wrapCache.get(key);
    if (lines) return lines;
    g.font = font;
    lines = [];
    let cur = '';
    // (an emoji stays with the word before it: never alone on a line)
    for (const word of text.replace(/ (\p{Extended_Pictographic})/gu, '\u00a0$1').split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (g.measureText(next).width > maxW && cur) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
    if (wrapCache.size > 200) wrapCache.clear();
    wrapCache.set(key, lines);
    return lines;
  }

  // ---------- the board ----------
  function drawBoard(g, L, M, t) {
    const b = L.board, Cc = L.C;
    const back = cache.back, face = cache.face;
    g.drawImage(back.canvas, b.x + back.dx, b.y + back.dy, back.w, back.h);
    // the stones in their holes
    const win = M.line;
    const endK = M.phase === 'end' ? M.endT : 0;
    for (let i = 0; i < 42; i++) {
      const v = M.cells[i];
      if (!v || i === M.hidden) continue;
      const c = i % 7, r = (i / 7) | 0;
      let s = 1 + M.pulse[i] * M.pulse[i] * 0.1;
      const k = win ? win.indexOf(i) : -1;
      if (k >= 0 && !reduced) s = 1 + 0.07 * Math.max(0, Math.sin(endK * 7 - k * 0.7)) + M.pulse[i] * 0.06;
      stone(g, v, L.cx(c), L.cy(r), s);
    }
    // the stone that's falling (behind the face, seen through the holes)
    const f = M.fall;
    if (f) {
      const sq = reduced ? 0 : f.squash;
      const pop = f.pop < 1 ? ease.outBack(f.pop) : 1;
      stone(g, f.who, L.cx(f.col), L.cy(f.y) + Cc * 0.05 * sq, pop * (1 + sq * 0.14), pop * (1 - sq * 0.2));
    }
    g.drawImage(face.canvas, b.x + face.dx, b.y + face.dy, face.w, face.h);

    // where a person points: the column lit, the landing hole ringed
    if (M.phase === 'input' && M.hover >= 0 && M.ghost > 0.05) {
      const c = M.hover;
      const x = b.x + (0.3 + c) * Cc;
      g.globalAlpha = 0.13 * M.ghost;
      g.fillStyle = '#ffffff';
      roundRect(g, x + Cc * 0.06, b.y + Cc * 0.12, Cc * 0.88, b.h - Cc * 0.24, Cc * 0.44); g.fill();
      g.globalAlpha = 1;
      let r = -1;
      for (let k = 0; k < 6; k++) if (!M.cells[k * 7 + c]) { r = k; break; }
      if (r >= 0) {
        const who = M.turn;
        g.globalAlpha = 0.55 * M.ghost;
        g.strokeStyle = who === PINK ? COL.pink : COL.mint;
        g.lineWidth = Math.max(2, Cc * 0.06);
        g.setLineDash([Cc * 0.12, Cc * 0.1]);
        g.lineDashOffset = -t * Cc * 0.5;
        g.beginPath(); g.arc(L.cx(c), L.cy(r), L.hole * 0.78, 0, TAU); g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }
    }

    // her threats (the training wheels, 1B to 13B)
    if (M.hint.length && M.phase === 'input') {
      const k = 0.5 + 0.5 * Math.sin(t * 6.5);
      for (const h of M.hint) {
        const x = L.cx(h.col), y = L.cy(h.row);
        g.strokeStyle = COL.honey; g.lineWidth = Math.max(2.5, Cc * 0.075);
        g.globalAlpha = 0.6 + 0.4 * k;
        g.beginPath(); g.arc(x, y, L.hole * (0.82 + 0.1 * k), 0, TAU); g.stroke();
        g.globalAlpha = 1;
        // a "!" badge
        const bx = x + L.hole * 0.72, by = y - L.hole * 0.72, br = Cc * 0.17;
        g.fillStyle = COL.honey; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, Cc * 0.04);
        g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = INK; g.font = `900 ${Math.round(br * 1.5)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', bx, by + br * 0.08);
      }
    }

    // four in a row: a beam through them, growing from the first to the last
    if (M.line && M.phase === 'end') {
      const first = M.line[0], last = M.line[M.line.length - 1];
      const x0 = L.cx(first % 7), y0 = L.cy((first / 7) | 0), x1 = L.cx(last % 7), y1 = L.cy((last / 7) | 0);
      const k = reduced ? 1 : ease.outCubic(clamp((M.endT - 0.05) / 0.32, 0, 1));
      const xe = x0 + (x1 - x0) * k, ye = y0 + (y1 - y0) * k;
      const herWin = M.winner === MINT && M.mode !== 'pp';
      const core = herWin ? COL.mint : M.winner === MINT ? COL.mint : COL.paper;
      g.lineCap = 'round';
      g.strokeStyle = INK; g.lineWidth = Cc * 0.3;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(xe, ye); g.stroke();
      g.strokeStyle = core; g.lineWidth = Cc * 0.17;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(xe, ye); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Cc * 0.05;
      g.beginPath(); g.moveTo(x0, y0 - Cc * 0.03); g.lineTo(xe, ye - Cc * 0.03); g.stroke();
      // a ring on each of the four
      for (const i of M.line) {
        const x = L.cx(i % 7), y = L.cy((i / 7) | 0);
        g.strokeStyle = INK; g.lineWidth = Math.max(3, Cc * 0.09);
        g.beginPath(); g.arc(x, y, L.hole * 0.98, 0, TAU); g.stroke();
        g.strokeStyle = M.winner === PINK ? COL.honey : COL.mint; g.lineWidth = Math.max(2, Cc * 0.05);
        g.beginPath(); g.arc(x, y, L.hole * 0.98, 0, TAU); g.stroke();
      }
    }
  }

  // ---------- the drop zone: your ghost stone, or her attention ----------
  function drawDropZone(g, L, M, t) {
    const Cc = L.C;
    // your ghost stone, bobbing above the column (pulsing while it shows a first-timer where to tap)
    if (M.ghost > 0.01) {
      const who = M.turn;
      const coaching = M.coach && M.hover < 0;
      const x = L.cx(M.gx), y = L.dropY + Math.sin(t * 4.2) * Cc * (coaching ? 0.1 : 0.04);
      stone(g, who, x, y, 1, 1, (coaching ? 0.55 + 0.35 * Math.sin(t * 5) : 0.92) * M.ghost);
      // a little chevron under it
      g.globalAlpha = 0.7 * M.ghost;
      g.strokeStyle = who === PINK ? COL.pink : COL.mint; g.lineWidth = Math.max(2, Cc * 0.055); g.lineCap = 'round'; g.lineJoin = 'round';
      const cy = L.board.y - Cc * 0.13 + Math.sin(t * 4.2 + 0.6) * Cc * 0.02;
      g.beginPath(); g.moveTo(x - Cc * 0.1, cy - Cc * 0.05); g.lineTo(x, cy + Cc * 0.03); g.lineTo(x + Cc * 0.1, cy - Cc * 0.05); g.stroke();
      g.globalAlpha = 1;
    }
    // her stone before it falls (it pops in above her column)
    if (M.barShow <= 0.001) return;
    const a = M.barShow;
    const bw = Math.max(6, Cc * 0.3), base = L.barBase, max = L.barMax;
    let topC = -1, topV = -1;
    for (let c = 0; c < 7; c++) {
      if (M.cells[35 + c] && !(M.fall && M.fall.col === c)) continue;
      if (M.bars[c] > topV) { topV = M.bars[c]; topC = c; }
    }
    for (let c = 0; c < 7; c++) {
      if (M.cells[35 + c]) continue;
      const x = L.cx(c) - bw / 2;
      // the track
      g.globalAlpha = 0.9 * a;
      g.fillStyle = 'rgba(205,184,255,0.10)';
      g.strokeStyle = 'rgba(205,184,255,0.28)'; g.lineWidth = 1.5;
      roundRect(g, x, base - max, bw, max, bw / 2); g.fill(); g.stroke();
      // the level
      const v = clamp(M.bars[c], 0, 1);
      const hgt = Math.max(bw * 0.9, max * (0.04 + 0.96 * v) * ease.outCubic(a));
      const kind = M.barKind[c];
      const fill = kind === 1 ? COL.honey : kind === -1 ? COL.pink : c === topC ? COL.mint : '#2fc79f';
      g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = Math.max(1.8, Cc * 0.045);
      roundRect(g, x, base - hgt, bw, hgt, bw / 2); g.fill(); g.stroke();
      // a shine down its left side
      g.globalAlpha = 0.45 * a;
      g.fillStyle = '#ffffff';
      roundRect(g, x + bw * 0.22, base - hgt + bw * 0.25, bw * 0.18, Math.max(0, hgt - bw * 0.5), bw * 0.09); g.fill();
      g.globalAlpha = 1;
      // she's sure: a proven loss is crossed out, a proven win gets a star
      if (kind === -1 && a > 0.5) {
        const cy = base - hgt - bw * 0.62;
        g.strokeStyle = COL.pink; g.lineWidth = Math.max(1.6, Cc * 0.045); g.lineCap = 'round';
        g.beginPath(); g.moveTo(x + bw * 0.2, cy - bw * 0.3); g.lineTo(x + bw * 0.8, cy + bw * 0.3); g.moveTo(x + bw * 0.8, cy - bw * 0.3); g.lineTo(x + bw * 0.2, cy + bw * 0.3); g.stroke();
      }
    }
    // her favourite: a star over its bar
    if (topC >= 0 && a > 0.4) {
      const v = clamp(M.bars[topC], 0, 1);
      const hgt = Math.max(bw * 0.9, max * (0.04 + 0.96 * v));
      const sx = L.cx(topC), sy = base - hgt - Cc * 0.2;
      const spin = reduced ? 0 : t * 1.4;
      g.globalAlpha = a;
      g.fillStyle = M.barKind[topC] === 1 ? COL.honey : COL.paper; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, Cc * 0.035);
      star(g, sx, sy, Cc * 0.13, Cc * 0.055, 4, spin); g.fill(); g.stroke();
      g.globalAlpha = 1;
    }
    // her pick flashes
    if (M.flash.t > 0 && M.flash.col >= 0) {
      const k = M.flash.t / 0.32;
      const x = L.cx(M.flash.col);
      g.globalAlpha = k * 0.9;
      g.fillStyle = '#ffffff';
      roundRect(g, x - bw * (0.5 + 0.5 * (1 - k)), base - max - Cc * 0.06, bw * (1 + (1 - k)), max + Cc * 0.06, bw); g.fill();
      g.globalAlpha = 1;
    }
  }

  // ---------- AGI-1 ----------
  function drawHer(g, L, M, t, info) {
    const { x: hx0, y: hy0, r: R } = L.her;
    const face = M.face;
    const mt = M.moodT;
    let hx = hx0, hy = hy0 + (reduced ? 0 : Math.sin(t * 1.9) * R * 0.025), rot = 0;
    if (!reduced) {
      if (face === 'shocked') { const k = Math.max(0, 1 - mt * 2.2); hy -= R * 0.12 * k * Math.abs(Math.sin(mt * 18)); hx += Math.sin(mt * 50) * R * 0.03 * k; }
      if (face === 'smug') rot = -0.07 * Math.min(1, mt * 5);
      if (face === 'worried') hx += Math.sin(t * 9) * R * 0.012;
      if (face === 'happy') hy -= Math.abs(Math.sin(t * 6)) * R * 0.05;
      if (face === 'flustered') rot = Math.sin(t * 5) * 0.035;
    }
    const ringColor = { think: COL.mint, smug: COL.pink, happy: COL.pink, worried: COL.sky, shocked: COL.red, flustered: COL.pink }[face] || COL.honey;
    g.save();
    g.translate(hx, hy);
    g.rotate(rot);
    // the sticker: a hard shadow, a colored ring, her picture, ink lines
    g.fillStyle = INK;
    g.beginPath(); g.arc(R * 0.07, R * 0.09, R, 0, TAU); g.fill();
    g.fillStyle = ringColor;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.lineWidth = Math.max(2.2, R * 0.05); g.strokeStyle = INK; g.stroke();
    const Ri = R * 0.86;
    if (cache.portrait) g.drawImage(cache.portrait, -Ri, -Ri, Ri * 2, Ri * 2);
    // gloom lines when she's losing
    if (face === 'shocked' || face === 'worried') {
      g.save();
      g.beginPath(); g.arc(0, 0, Ri, 0, TAU); g.clip();
      const k = face === 'shocked' ? 0.55 : 0.32;
      const gr = g.createLinearGradient(0, -Ri, 0, -Ri * 0.1);
      gr.addColorStop(0, `rgba(40,20,110,${k})`); gr.addColorStop(1, 'rgba(40,20,110,0)');
      g.fillStyle = gr; g.fillRect(-Ri, -Ri, Ri * 2, Ri * 0.95);
      g.strokeStyle = `rgba(40,20,110,${k * 0.9})`; g.lineWidth = Math.max(1, R * 0.022);
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * Ri * 0.13, -Ri); g.lineTo(i * Ri * 0.13, -Ri * (0.45 - Math.abs(i) * 0.04)); g.stroke(); }
      g.restore();
    }
    // a blush when she's pleased with herself (or flustered)
    if (face === 'smug' || face === 'happy' || face === 'flustered') {
      const k = face === 'flustered' ? 0.6 : 0.42;
      g.fillStyle = `rgba(255,90,150,${k})`;
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * Ri * 0.34, Ri * 0.18, Ri * 0.14, Ri * 0.07, 0, 0, TAU); g.fill(); }
      g.strokeStyle = `rgba(220,40,110,${k + 0.2})`; g.lineWidth = Math.max(1, R * 0.018); g.lineCap = 'round';
      for (const sx of [-1, 1]) for (let i = -1; i <= 1; i++) {
        const bx = sx * Ri * 0.34 + i * Ri * 0.07;
        g.beginPath(); g.moveTo(bx + Ri * 0.03, Ri * 0.14); g.lineTo(bx - Ri * 0.02, Ri * 0.23); g.stroke();
      }
    }
    g.lineWidth = Math.max(1.8, R * 0.035); g.strokeStyle = INK;
    g.beginPath(); g.arc(0, 0, Ri, 0, TAU); g.stroke();
    g.restore();

    // thinking: a dashed ring turning around her
    if (M.phase === 'think' || M.phase === 'commit') {
      g.save();
      g.translate(hx, hy);
      g.rotate(reduced ? 0 : t * (1.5 + M.level * 0.5));
      g.strokeStyle = COL.mint; g.lineWidth = Math.max(2.4, R * 0.06); g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, R * 1.14, i * TAU / 3, i * TAU / 3 + TAU / 6.5); g.stroke(); }
      g.restore();
    }
    // the little signs around her
    drawSigns(g, hx, hy, R, face, mt, t);
    drawName(g, L, M, info, hx, hy);
  }

  function drawSigns(g, x, y, R, face, mt, t) {
    if (face === 'smug' || face === 'happy') {
      // sparkles
      for (let i = 0; i < 3; i++) {
        const a = -0.9 + i * 0.55, rr = R * (1.12 + 0.06 * Math.sin(t * 5 + i));
        const sx = x + Math.cos(a - Math.PI / 2 + 0.6) * rr, sy = y + Math.sin(a - Math.PI / 2 + 0.6) * rr;
        const s = R * (0.12 + 0.05 * Math.sin(t * 7 + i * 2));
        g.fillStyle = i === 1 ? COL.honey : COL.paper; g.strokeStyle = INK; g.lineWidth = Math.max(1.2, R * 0.025);
        star(g, sx, sy, s, s * 0.38, 4, 0); g.fill(); g.stroke();
      }
      if (face === 'happy') {
        for (let i = 0; i < 2; i++) {
          const k = (t * 0.7 + i * 0.5) % 1;
          const hx = x - R * 0.9 + i * R * 0.2, hy = y - R * 0.4 - k * R * 0.8;
          g.globalAlpha = 1 - k;
          g.fillStyle = COL.pink; g.strokeStyle = INK; g.lineWidth = Math.max(1, R * 0.02);
          heartPath(g, hx, hy, R * 0.28); g.fill(); g.stroke();
          g.globalAlpha = 1;
        }
      }
    }
    if (face === 'worried' || face === 'shocked') {
      // a sweat drop at her temple
      const dx = x + R * 0.78, dy = y - R * 0.52 + (reduced ? 0 : Math.min(1, mt * 2) * R * 0.08);
      const s = R * 0.2;
      g.fillStyle = COL.sky; g.strokeStyle = INK; g.lineWidth = Math.max(1.4, R * 0.03);
      g.beginPath();
      g.moveTo(dx, dy - s * 1.1);
      g.bezierCurveTo(dx + s * 0.75, dy - s * 0.1, dx + s * 0.65, dy + s * 0.7, dx, dy + s * 0.7);
      g.bezierCurveTo(dx - s * 0.65, dy + s * 0.7, dx - s * 0.75, dy - s * 0.1, dx, dy - s * 1.1);
      g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(dx - s * 0.2, dy + s * 0.15, s * 0.12, s * 0.2, 0.3, 0, TAU); g.fill();
    }
    if (face === 'shocked') {
      // shock lines and a "!!"
      g.strokeStyle = COL.paper; g.lineWidth = Math.max(2, R * 0.045); g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 - 0.9 + i * 0.45;
        const r0 = R * 1.12, r1 = R * (1.32 + (reduced ? 0 : 0.06 * Math.sin(t * 20 + i)));
        g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
      }
    }
    if (face === 'flustered') {
      g.fillStyle = COL.pink; g.strokeStyle = INK; g.lineWidth = Math.max(1, R * 0.02);
      heartPath(g, x + R * 0.88, y - R * 0.66, R * 0.3); g.fill(); g.stroke();
    }
  }

  function pill(g, x, y, h, text, { bg = COL.paper, fg = INK, font, align = 'center', padX } = {}) {
    g.font = font;
    const tw = g.measureText(text).width;
    const px = padX ?? h * 0.48;
    const w = tw + px * 2;
    const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
    g.fillStyle = INK; roundRect(g, x0 + 1, y - h / 2 + Math.max(2, h * 0.1), w, h, h / 2); g.fill();
    g.fillStyle = bg; roundRect(g, x0, y - h / 2, w, h, h / 2); g.fill();
    g.lineWidth = Math.max(1.6, h * 0.075); g.strokeStyle = INK; g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x0 + w / 2, y + h * 0.04);
    return { x: x0, w };
  }

  // her name tag (and the level she's playing at), and in the wide layout the depth line under it
  function drawName(g, L, M, info, hx, hy) {
    const R = L.her.r;
    const h = clamp(R * (L.wide ? 0.26 : 0.36), 16, 30);
    const font = `850 ${Math.round(h * 0.5)}px ${DISPLAY}`;
    const label = info.levelLabel;
    const nx = L.wide ? L.name.x : hx, ny = L.wide ? L.name.y + h / 2 : hy + R * 0.98;
    g.font = font;
    const nameW = g.measureText('AGI-1').width + h * 0.9;
    g.font = `800 ${Math.round(h * 0.5)}px ${MONO}`;
    const lvW = label ? g.measureText(label).width + h * 0.8 : 0;
    const total = nameW + (label ? lvW - h * 0.25 : 0);
    const x0 = nx - total / 2;
    pill(g, x0 + nameW / 2, ny, h, 'AGI-1', { bg: INK, fg: COL.paper, font });
    if (label) pill(g, x0 + nameW - h * 0.25 + lvW / 2, ny, h, label, { bg: COL.mint, fg: INK, font: `800 ${Math.round(h * 0.5)}px ${MONO}`, padX: h * 0.4 });
    if (L.wide) drawDepth(g, M, nx, ny + h * 0.5 + clamp(R * 0.2, 11, 18), clamp(R * 0.14, 11, 15), 'center');
  }

  // "depth 7 · 8 · 9" while she thinks; what she looked at after
  function drawDepth(g, M, x, y, size, align) {
    let text = null, sub = null;
    if ((M.phase === 'think' || M.phase === 'commit') && M.depths.length) {
      text = M.phase === 'think' ? M.depthText : M.depthDone;
    } else if (M.phase === 'think') text = 'thinking…';
    else if (M.lastThink && M.mode !== 'pp') {
      const lt = M.lastThink;
      text = lt.book ? 'played from memory' : `looked ${lt.depth} deep · ${fmtBoards(lt.nodes)} boards`;
      sub = true;
    }
    if (!text) return;
    g.font = `700 ${Math.round(size)}px ${MONO}`;
    g.textAlign = align; g.textBaseline = 'middle';
    g.fillStyle = sub ? 'rgba(228,217,255,0.62)' : COL.mint;
    g.fillText(text, x, y);
  }

  // her bubble: what she says; in the tall layout the depth line goes beside her (under the bubble when she talks)
  function drawBubble(g, L, M, t, demo) {
    const B = L.bubble;
    if (!B || B.w < 60) return;
    const bub = M.bubble;
    const size = clamp(L.C * (L.wide ? 0.34 : 0.36), 14, 22) * (demo ? 0.95 : 1);
    const font = `italic 400 ${Math.round(size)}px ${SERIF}`;
    const depthSize = clamp(L.C * 0.26, 11, 15);
    const depthOn = !L.wide && M.mode !== 'pp' && (M.phase === 'think' || M.phase === 'commit' || M.lastThink);
    const padX = size * 0.75, padY = size * 0.5, lh = size * 1.22;
    let lines = [], h = 0, w = 0;
    if (bub) {
      lines = wrap(g, bub.text, B.w - padX * 2, font);
      if (lines.length > 3) lines = lines.slice(0, 3);
      g.font = font;
      for (const ln of lines) w = Math.max(w, g.measureText(ln).width);
      w = Math.min(B.w, w + padX * 2 + 2);
      h = lines.length * lh + padY * 2;
    }
    // the tall row: the bubble (and the depth under it) centred on her portrait
    const depthGap = depthOn ? depthSize * 1.7 : 0;
    const stackH = h + (bub && depthOn ? depthGap : 0);
    const room = demo ? B.h : B.h;
    const fitsBoth = !bub || !depthOn || stackH <= room + 2;
    const y = L.wide ? B.y : B.y + Math.max(0, (B.h - (fitsBoth ? stackH || depthSize : h)) / 2);
    if (bub) {
      const a = Math.min(1, bub.t * 8) * Math.min(1, (bub.life - bub.t) * 3);
      const pop = reduced ? 1 : ease.outBack(Math.min(1, bub.t * 6));
      const bx = L.wide ? B.x + (B.w - w) / 2 : B.x;
      const ox = L.wide ? B.x + B.w / 2 : B.x, oy = L.wide ? y : y + h / 2;
      g.save();
      g.globalAlpha = clamp(a, 0, 1);
      g.translate(ox, oy); g.scale(pop, pop); g.translate(-ox, -oy);
      g.fillStyle = INK;
      roundRect(g, bx + 2, y + 3, w, h, Math.min(16, h / 2)); g.fill();
      g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2;
      roundRect(g, bx, y, w, h, Math.min(16, h / 2)); g.fill(); g.stroke();
      // its tail toward her
      const tail = (close) => {
        g.beginPath();
        if (B.tail === 'left') { g.moveTo(bx + 1, y + h * 0.36); g.lineTo(bx - size * 0.55, y + h * 0.28); g.lineTo(bx + 1, y + h * 0.62); }
        else { const tx = bx + w / 2; g.moveTo(tx - size * 0.45, y + 1); g.lineTo(tx, y - size * 0.55); g.lineTo(tx + size * 0.45, y + 1); }
        if (close) g.closePath();
      };
      tail(true); g.fillStyle = '#ffffff'; g.fill();
      tail(false); g.strokeStyle = INK; g.stroke();
      g.fillStyle = '#ffffff';
      if (B.tail === 'left') g.fillRect(bx - 0.5, y + h * 0.36 + 1, 3, h * 0.26 - 2); else g.fillRect(bx + w / 2 - size * 0.42, y - 0.5, size * 0.84, 3);
      // the words, typed out
      g.fillStyle = INK; g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle';
      let left = reduced ? Infinity : Math.floor(bub.t * 48);
      lines.forEach((ln, i) => {
        if (left <= 0) return;
        g.fillText(left >= ln.length ? ln : ln.slice(0, left), bx + padX, y + padY + lh * (i + 0.5));
        left -= ln.length + 1;
      });
      g.restore();
    }
    if (depthOn && fitsBoth) drawDepth(g, M, B.x + (bub ? padX * 0.4 : 2), bub ? y + h + depthGap * 0.62 : y + depthSize * 0.5, depthSize, 'left');
  }

  // ---------- the status pill ----------
  function drawStatus(g, L, M, t, info) {
    const S = L.status;
    if (!S) return;
    let text = '', who = 0, tone = COL.paper;
    const pp = M.mode === 'pp';
    if (M.phase === 'end') {
      if (M.winner === 3) text = 'A draw';
      else if (pp) { text = M.winner === PINK ? 'Pink wins' : 'Mint wins'; who = M.winner; tone = M.winner === PINK ? COL.pink : COL.mint; }
      else { text = M.winner === PINK ? 'You win!' : 'AGI-1 wins'; who = M.winner; tone = M.winner === PINK ? COL.honey : COL.mint; }
    } else if (M.phase === 'think' || M.phase === 'commit') { text = `Thinking${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`; who = MINT; }
    else if (M.phase === 'input') {
      text = M.coach && !pp ? info.coachText || 'Tap a column' : pp ? (M.turn === PINK ? "Pink's move" : "Mint's move") : 'Your move';
      who = M.turn;
      if (M.coach && !pp) tone = COL.honey;
    }
    else if (M.phase === 'fall' && M.fall) { text = pp ? (M.fall.who === PINK ? "Pink's move" : "Mint's move") : M.fall.who === PINK ? 'Your move' : 'AGI-1 plays'; who = M.fall.who; }
    else if (M.phase === 'aim') { text = 'Your move'; who = PINK; }
    if (!text) return;
    const h = S.h;
    const font = `850 ${Math.round(h * 0.4)}px ${DISPLAY}`;
    g.font = font;
    const label = text.toUpperCase();
    const tw = g.measureText(label).width;
    const dot = h * 0.62;
    const w = Math.min(S.maxW, tw + h * 0.95 + (who ? dot + h * 0.2 : 0));
    const x0 = S.x - w / 2, y0 = S.y - h / 2;
    g.fillStyle = INK; roundRect(g, x0 + 1, y0 + Math.max(2, h * 0.1), w, h, h / 2); g.fill();
    g.fillStyle = tone; roundRect(g, x0, y0, w, h, h / 2); g.fill();
    g.lineWidth = Math.max(1.8, h * 0.07); g.strokeStyle = INK; g.stroke();
    let tx = x0 + h * 0.48;
    if (who) {
      stone(g, who, tx + dot / 2, S.y, dot / cache.stones[who].size * 1.08);
      tx += dot + h * 0.2;
    }
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(label, tx, S.y + h * 0.04);
  }

  // ---------- the ladder's chips (in the game: where you are on the climb) ----------
  function drawLadder(g, L, info) {
    const Ld = L.ladder;
    if (!Ld || !info.ladder) return;
    const { unlocked, current, beaten } = info.ladder;
    const n = LEVELS.length;
    const h = Ld.h;
    const font = `850 ${Math.round(h * 0.4)}px ${DISPLAY}`;
    if (Ld.vertical) {
      // the ladder's rails behind its rungs
      const span = (n - 1) * (h + Ld.gap) / 2 + h / 2;
      g.strokeStyle = 'rgba(205,184,255,0.22)'; g.lineWidth = 2; g.setLineDash([3, 5]);
      for (const dx of [-Ld.w * 0.3, Ld.w * 0.3]) { g.beginPath(); g.moveTo(Ld.x + dx, Ld.y - span - 10); g.lineTo(Ld.x + dx, Ld.y + span + 10); g.stroke(); }
      g.setLineDash([]);
    }
    for (let i = 0; i < n; i++) {
      let x, y, w;
      if (Ld.vertical) { w = Ld.w; x = Ld.x - w / 2; y = Ld.y + (n - 1 - i - (n - 1) / 2) * (h + Ld.gap) - h / 2; }
      else { const gap = h * 0.22; w = (Ld.w - gap * (n - 1)) / n; x = Ld.x - Ld.w / 2 + i * (w + gap); y = Ld.y - h / 2; }
      const locked = i > unlocked, cur = i === current, done = beaten[i];
      const bg = cur ? COL.mint : done ? COL.honey : locked ? 'rgba(23,10,54,0.7)' : COL.paper;
      g.globalAlpha = locked ? 0.75 : 1;
      if (!locked) { g.fillStyle = INK; roundRect(g, x + 1, y + Math.max(2, h * 0.1), w, h, h / 2); g.fill(); }
      g.fillStyle = bg; roundRect(g, x, y, w, h, h / 2); g.fill();
      g.lineWidth = Math.max(1.5, h * 0.07); g.strokeStyle = locked ? 'rgba(205,184,255,0.4)' : INK; g.stroke();
      g.fillStyle = locked ? 'rgba(228,217,255,0.75)' : INK;
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = LEVELS[i].id;
      if (locked) {
        drawLock(g, x + w / 2 - g.measureText(label).width / 2 - h * 0.24, y + h / 2, h * 0.32);
        g.fillText(label, x + w / 2 + h * 0.14, y + h / 2 + h * 0.04);
      } else g.fillText(label, x + w / 2, y + h / 2 + h * 0.04);
      if (done && !cur) {
        // a little check in the corner
        const cx = x + w - h * 0.12, cy = y + h * 0.1;
        g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, h * 0.22, 0, TAU); g.fill();
        g.strokeStyle = COL.honey; g.lineWidth = Math.max(1.4, h * 0.07); g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(cx - h * 0.1, cy); g.lineTo(cx - h * 0.02, cy + h * 0.08); g.lineTo(cx + h * 0.11, cy - h * 0.08); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  function drawLock(g, x, y, s) {
    g.strokeStyle = 'rgba(228,217,255,0.8)'; g.lineWidth = Math.max(1.2, s * 0.16);
    g.beginPath(); g.arc(x, y - s * 0.2, s * 0.3, Math.PI, 0); g.stroke();
    g.fillStyle = 'rgba(228,217,255,0.8)';
    roundRect(g, x - s * 0.42, y - s * 0.2, s * 0.84, s * 0.62, s * 0.12); g.fill();
  }

  // ---------- the frame ----------
  function draw(g, view, L, M, opts = {}) {
    ensure(L, view.dpr);
    const t = opts.t || 0;
    g.save();
    opts.shake?.apply(g, view.w / 2, view.h / 2);
    drawDropZone(g, L, M, t);
    drawBoard(g, L, M, t);
    g.restore();
    if (opts.title) return;
    drawHer(g, L, M, t, opts);
    drawBubble(g, L, M, t, opts.demo);
    if (!opts.demo) drawStatus(g, L, M, t, opts);
    drawLadder(g, L, opts);
    opts.parts?.draw(g);
    opts.floats?.draw(g);
    if (opts.glitch > 0 && !reduced) glitch(g, view, L, opts.glitch, t);
  }

  // her win: the board glitches for a moment: a few bands of the picture tear sideways (a new tear every ~70 ms, smaller
  // as it fades), each edged with a pink or mint line
  function glitch(g, view, L, k, t) {
    const b = L.board, cv = view.canvas, d = view.dpr;
    const seed = Math.floor(t * 14);
    const frac = (v) => v - Math.floor(v);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 3; i++) {
      const r = frac(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453);
      const r2 = frac(Math.sin(seed * 4.1414 + i * 13.37) * 9182.3127);
      if (r < 0.45) continue;
      const x = (b.x - L.C * 0.3) * d, w = (b.w + L.C * 0.6) * d;
      const sy = Math.round((b.y + b.h * r2 * 0.92) * d), sh = Math.round(Math.max(3, b.h * (0.03 + 0.07 * r)) * d);
      const dx = Math.round((r - 0.72) * L.C * 0.75 * k * d);
      if (!dx) continue;
      g.drawImage(cv, x, sy, w, sh, x + dx, sy, w, sh);
      g.fillStyle = i % 2 ? COL.mint : COL.pink;
      g.fillRect(x + dx + L.C * 0.3 * d, sy, w - L.C * 0.6 * d, Math.max(1, Math.round(1.5 * d)));
    }
    g.restore();
  }

  return { draw, ensure, get portraitReady() { return portraitReady; } };
}
