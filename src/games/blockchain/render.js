// BLOCKCHAIN on a canvas (2026-11-08): the layout for any screen, and a Session (./session.js) drawn into it.
//
// Three arrangements, and the one that gives the board the biggest cells wins:
//   P (phones held upright): the score, the status line, the board with its chain tag, the tray of three below;
//   S (sideways and computers): the score and AGI-1 on the left, the board, the tray as a column on the right;
//   K (squarish: tablets sideways, the 480 × 480 preview): the score above, the board, the tray on the right.
import { PIECES, N, CELLS, fitsAnywhere, linksLeft, CHAIN_GRACE } from './rules.js';
import {
  HEX, INK, INK_DEEP, PAPER, LAV2, CORAL, DISPLAY, MONO, SERIF, blockSprites, boardSprite, backgroundSprite, link, font,
  sticker,
} from './art.js';
import { roundRect, ease, clamp, lerp, fmt } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { T } from './session.js';

// sizes in cells (C, the board's cell pitch)
const PAD = 0.24, PAD_TOP = 0.4, SHADOW = 0.17, TAG = 0.64;
const FRAME_W = 8 + 2 * PAD, FRAME_H = 8 + PAD + PAD_TOP;
const P_HEAD = 1.16 + 0.64 + 0.1, P_GAP = 0.44, P_TRAY = 2.8;
const S_PANEL = 3.7, S_GAP = 0.5, COL = 3.0, K_HEAD = 1.32, K_GAP = 0.42;
export const MODES = Object.freeze({
  P: { w: FRAME_W, h: P_HEAD + TAG / 2 + FRAME_H + SHADOW + P_GAP + P_TRAY },
  S: { w: S_PANEL + S_GAP + FRAME_W + S_GAP + COL, h: TAG / 2 + FRAME_H + SHADOW },
  K: { w: FRAME_W + K_GAP + COL, h: K_HEAD + TAG / 2 + FRAME_H + SHADOW },
});

// The layout for a W × H canvas with `ins` kept clear (the top bar, the notch): cell sizes, the board's corner, the
// tray's slots, where the words go
export function computeLayout(W, H, ins, { cmax = 76 } = {}) {
  const aw = Math.max(60, W - ins.left - ins.right), ah = Math.max(60, H - ins.top - ins.bottom);
  let pick = null;
  for (const mode of ['P', 'S', 'K']) {
    const m = MODES[mode];
    const C = Math.min(aw / m.w, ah / m.h, cmax);
    if (!pick || C > pick.C * 1.04) pick = { mode, C };
  }
  const mode = pick.mode, m = MODES[mode];
  const C = Math.max(12, Math.floor(pick.C * 2) / 2);
  const ox = Math.round(ins.left + (aw - m.w * C) / 2), oy = Math.round(ins.top + (ah - m.h * C) / 2);
  const L = { mode, W, H, C, s: C - Math.max(2, Math.round(C * 0.08)) };
  const frame = { w: FRAME_W * C, h: FRAME_H * C, r: Math.round(C * 0.42) };
  let slots;
  if (mode === 'P') {
    frame.x = ox;
    frame.y = oy + (P_HEAD + TAG / 2) * C;
    L.score = { x: ox + frame.w / 2, y: oy + 0.6 * C, size: C * 1.04, maxW: frame.w * 0.92, align: 'center' };
    L.status = { x: ox + frame.w / 2, y: oy + (1.16 + 0.34) * C, maxW: frame.w, align: 'center', h: 0.64 * C };
    const ty = frame.y + frame.h + (SHADOW + P_GAP) * C, gap = 0.14 * C, sw = (frame.w - gap * 2) / 3;
    slots = [0, 1, 2].map((k) => ({ x: ox + k * (sw + gap), y: ty, w: sw, h: P_TRAY * C }));
    L.enter = { dx: 0, dy: 1.6 * C };
  } else if (mode === 'S') {
    frame.x = ox + (S_PANEL + S_GAP) * C;
    frame.y = oy + (TAG / 2) * C;
    L.panel = { x: ox, y: frame.y, w: S_PANEL * C, h: frame.h };
    L.score = { x: ox + S_PANEL * C, y: frame.y + 1.38 * C, size: C * 1.1, maxW: S_PANEL * C, align: 'right' };
    L.status = null;
    L.face = { x: ox + S_PANEL * C - 0.66 * C, y: frame.y + frame.h - 0.7 * C, r: 0.62 * C };
    slots = colSlots(frame.x + frame.w + S_GAP * C, frame.y, frame.h, C);
    L.enter = { dx: 1.6 * C, dy: 0 };
  } else {
    frame.x = ox;
    frame.y = oy + (K_HEAD + TAG / 2) * C;
    L.score = { x: ox, y: oy + 0.5 * C, size: C * 0.96, maxW: frame.w * 0.62, align: 'left' };
    L.status = { x: ox, y: oy + 1.14 * C, maxW: frame.w + (K_GAP + COL) * C, align: 'left', h: 0.5 * C };
    slots = colSlots(frame.x + frame.w + K_GAP * C, frame.y, frame.h, C);
    L.enter = { dx: 1.6 * C, dy: 0 };
  }
  for (const sl of slots) { sl.cx = sl.x + sl.w / 2; sl.cy = sl.y + sl.h / 2; }
  L.frame = frame;
  L.slots = slots;
  L.gx = frame.x + PAD * C;
  L.gy = frame.y + PAD_TOP * C;
  L.tag = { cx: frame.x + frame.w / 2, cy: frame.y, h: TAG * C };
  L.scorePos = { x: L.score.align === 'center' ? L.score.x : L.score.align === 'right' ? L.score.x - C * 1.2 : L.score.x + C * 1.2, y: L.score.y };
  // the tray's cells: the same size for every piece (a 5-long one just fits its slot)
  const sw = slots[0].w, sh = slots[0].h;
  L.ts = Math.floor(Math.min(0.52 * C, (sw - 0.34 * C) / 5, (sh - 0.34 * C) / 5) * 2) / 2;
  L.tss = L.ts - Math.max(1, Math.round(L.ts * 0.08));
  L.center = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
  return L;
}
function colSlots(x, y, h, C) {
  const gap = 0.14 * C, sh = (h - gap * 2) / 3;
  return [0, 1, 2].map((k) => ({ x, y: y + k * (sh + gap), w: COL * C, h: sh }));
}

// ---------- drawing ----------
export function createRenderer() {
  let L = null, dpr = 1, spr = null, tspr = null, board = null, bg = null;
  const face = new Image();
  face.decoding = 'async';
  face.src = '/images/landing/agi1-face.webp';
  // counts of each row and column (to find lines one block short of full)
  const rowN = new Uint8Array(N), colN = new Uint8Array(N);

  function layout(W, H, d, ins) {
    const next = computeLayout(W, H, ins);
    const same = L && spr && dpr === d && L.C === next.C && L.W === W && L.H === H && L.frame.x === next.frame.x && L.frame.y === next.frame.y && L.ts === next.ts;
    L = next;
    if (!same) {
      dpr = d;
      spr = blockSprites(L.s, dpr);
      tspr = blockSprites(L.tss, dpr);
      board = boardSprite(L.frame, L.gx, L.gy, L.C, L.s, dpr, SHADOW * L.C);
      bg = backgroundSprite(W, H, dpr, { cx: L.gx, cy: L.gy, C: L.C });
    }
    return L;
  }

  // a sprite centered at (x, y), `k` times its size
  const blit = (g, sp, set, x, y, k = 1) => {
    const S = (set.s + set.pad * 2) * k;
    g.drawImage(sp, x - S / 2, y - S / 2, S, S);
  };

  function draw(g, se, { title = false, bot = null, keys = false, hover = -1 } = {}) {
    const W = L.W, H = L.H, now = se.time;
    g.drawImage(bg, 0, 0, W, H);
    g.save();
    if (title) {
      // the title screen: the little board plays behind the logo, quieter and tilted
      g.globalAlpha = 0.46;
      g.translate(L.center.x, L.center.y);
      g.rotate(-0.07);
      g.scale(0.94, 0.94);
      g.translate(-L.center.x, -L.center.y);
    }
    se.shake.apply(g, W / 2, H / 2);
    drawBoard(g, se, now);
    drawTray(g, se, now, keys, hover);
    drawTag(g, se, now);
    se.parts.draw(g);
    drawLabels(g, se, now);
    se.floats.draw(g);
    if (!title) drawHead(g, se, now);
    drawDrag(g, se, now, bot);
    g.restore();
    g.globalAlpha = 1;
  }

  // ---------- the board ----------
  function drawBoard(g, se, now) {
    const C = L.C, b = se.s.board, fr = L.frame;
    g.drawImage(board.c, board.ox, board.oy, board.w, board.h);
    // its edge: a pulse of coral when the room runs out, a flash of the clear's color
    const edge = (color, a, w) => {
      g.globalAlpha = a;
      g.strokeStyle = color;
      g.lineWidth = w;
      roundRect(g, fr.x + w / 2, fr.y + w / 2, fr.w - w, fr.h - w, fr.r - w / 2);
      g.stroke();
      g.globalAlpha = 1;
    };
    if (se.danger) edge(CORAL, 0.45 + 0.35 * Math.sin((now - se.dangerT) * 5.5), Math.max(3, C * 0.09));
    const ga = now - se.disp.glow;
    if (ga >= 0 && ga < 0.45) edge(se.disp.glowColor, 1 - ga / 0.45, Math.max(3, C * 0.1));
    // lines one block short of full: their empty well glows softly (a hint, never a tell)
    rowN.fill(0); colN.fill(0);
    for (let i = 0; i < CELLS; i++) if (b[i]) { rowN[(i / N) | 0]++; colN[i % N]++; }
    const gh = se.ghost, s = L.s;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3.2);
    if (!se.busy) {
      g.fillStyle = PAPER;
      for (let i = 0; i < CELLS; i++) {
        if (b[i]) continue;
        const r = (i / N) | 0, c = i % N;
        if (rowN[r] === N - 1 || colN[c] === N - 1) {
          g.globalAlpha = 0.045 + 0.05 * pulse;
          roundRect(g, L.gx + c * C + (C - s) / 2, L.gy + r * C + (C - s) / 2, s, s, s * 0.24);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    // the lines the dragged piece would clear: a band of its color
    const preview = gh && gh.ok && (gh.rows || gh.cols);
    const gcolor = gh ? HEX[gh.t.color] : null;
    if (preview) {
      g.fillStyle = gcolor;
      g.globalAlpha = 0.14 + 0.08 * pulse;
      for (let k = 0; k < N; k++) {
        if (gh.rows & (1 << k)) { roundRect(g, L.gx - C * 0.05, L.gy + k * C + C * 0.02, C * 8.1, C * 0.96, C * 0.24); g.fill(); }
        if (gh.cols & (1 << k)) { roundRect(g, L.gx + k * C + C * 0.02, L.gy - C * 0.05, C * 0.96, C * 8.1, C * 0.24); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    // the blocks
    const grey = se.grey;
    for (let i = 0; i < CELLS; i++) {
      const v = b[i];
      if (!v) continue;
      let x = L.gx + ((i % N) + 0.5) * C, y = L.gy + (((i / N) | 0) + 0.5) * C, k = 1;
      const land = now - se.landT[i];
      if (land >= 0 && land < T.slide) {
        const e = 1 - ease.outCubic(land / T.slide);
        x += se.slideX[i] * e; y += se.slideY[i] * e;
      }
      const pa = now - se.popT[i];
      if (pa >= 0 && pa < T.pop && !REDUCED) k = 1 + 0.15 * Math.exp(-5.5 * (pa / T.pop)) * Math.cos(9 * (pa / T.pop));
      else if (pa < 0 && land >= 0) k = 1.04;
      const inPreview = preview && gh.cells.has(i);
      blit(g, spr.normal[inPreview ? gh.t.color : v - 1], spr, x, y, k);
      if (inPreview) {
        g.globalAlpha = 0.12 + 0.2 * pulse;
        blit(g, spr.white, spr, x, y, k);
        g.globalAlpha = 1;
      }
      if (grey) {
        const ga2 = now - grey[i];
        if (ga2 >= 0) { g.globalAlpha = Math.min(1, ga2 / 0.12); blit(g, spr.grey, spr, x, y, k); g.globalAlpha = 1; }
      }
    }
    // cleared blocks: a white flash as the sweep reaches them, then a pop and they're gone
    for (const e of se.clearing) {
      let x = L.gx + ((e.i % N) + 0.5) * C, y = L.gy + (((e.i / N) | 0) + 0.5) * C;
      if (e.land != null) {
        const la = now - (e.land - 0.0);
        if (la >= 0 && la < T.slide) { const f = 1 - ease.outCubic(la / T.slide); x += e.dx * f; y += e.dy * f; }
      }
      const to = e.at - now;
      if (to > 0) {
        blit(g, spr.normal[e.c], spr, x, y, 1);
        const w = clamp(1 - to / 0.09, 0, 1);
        if (w > 0) { g.globalAlpha = w * 0.85; blit(g, spr.white, spr, x, y, 1); g.globalAlpha = 1; }
      } else {
        const k = clamp(-to / T.burst, 0, 1);
        const sc = k < 0.25 ? 1 + 0.14 * (k / 0.25) : 1.14 * (1 - ease.inQuad((k - 0.25) / 0.75));
        if (sc > 0.02) {
          g.globalAlpha = 1 - k * 0.3;
          blit(g, spr.normal[e.c], spr, x, y, sc);
          g.globalAlpha = (1 - k) * 0.9;
          blit(g, spr.white, spr, x, y, sc);
          g.globalAlpha = 1;
        }
      }
    }
    // where the piece would land
    if (gh) {
      const p = gh.t;
      let jx = 0;
      if (gh.shake != null) { const a = now - gh.shake; if (a < 0.3) jx = Math.sin(a * 60) * C * 0.1 * (1 - a / 0.3); }
      const ga3 = clamp((now - gh.t0) / 0.08, 0, 1);
      for (const [cx, cy] of p.cells) {
        const x = L.gx + (gh.x + cx + 0.5) * C + jx, y = L.gy + (gh.y + cy + 0.5) * C;
        if (!gh.ok) {
          g.globalAlpha = 0.95 * ga3;
          blit(g, spr.ghost[5], spr, x, y, 1);
          g.strokeStyle = CORAL;
          g.lineWidth = Math.max(1.5, C * 0.06);
          g.lineCap = 'round';
          const q = s * 0.16;
          g.beginPath(); g.moveTo(x - q, y - q); g.lineTo(x + q, y + q); g.moveTo(x + q, y - q); g.lineTo(x - q, y + q); g.stroke();
        } else if (preview) {
          g.globalAlpha = 0.9 * ga3;
          blit(g, spr.normal[p.color], spr, x, y, 1);
          g.globalAlpha = (0.2 + 0.25 * pulse) * ga3;
          blit(g, spr.white, spr, x, y, 1);
        } else {
          g.globalAlpha = (0.78 + 0.18 * pulse) * ga3;
          blit(g, spr.ghost[p.color], spr, x, y, 1);
        }
      }
      g.globalAlpha = 1;
    }
    // the sweep: a bright line running out from the drop along each cleared line
    for (const bm of se.beams) {
      const a = now - bm.t0;
      if (a < 0) continue;
      const ext = ease.outCubic(clamp(a / (T.sweep * 1.15), 0, 1)) * N;
      const fade = a < 0.22 ? 1 : Math.max(0, 1 - (a - 0.22) / 0.3);
      if (fade <= 0) continue;
      const lo = clamp(bm.o - ext, 0, N), hi = clamp(bm.o + ext, 0, N);
      const th = C * 0.2;
      g.globalAlpha = fade * 0.45;
      g.fillStyle = bm.color;
      if (bm.row) roundRect(g, L.gx + lo * C, L.gy + (bm.k + 0.5) * C - C * 0.42, (hi - lo) * C, C * 0.84, C * 0.3);
      else roundRect(g, L.gx + (bm.k + 0.5) * C - C * 0.42, L.gy + lo * C, C * 0.84, (hi - lo) * C, C * 0.3);
      g.fill();
      g.globalAlpha = fade;
      g.fillStyle = '#ffffff';
      if (bm.row) roundRect(g, L.gx + lo * C, L.gy + (bm.k + 0.5) * C - th / 2, (hi - lo) * C, th, th / 2);
      else roundRect(g, L.gx + (bm.k + 0.5) * C - th / 2, L.gy + lo * C, th, (hi - lo) * C, th / 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // a perfect clear: a shimmer across the empty wells, a flash
    const wa = now - se.disp.wave;
    if (wa >= 0 && wa < 1.2) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < CELLS; i++) {
        const c = i % N, r = (i / N) | 0, w = wa - (c + r) * 0.035;
        if (w < 0 || w > 0.4) continue;
        g.globalAlpha = (1 - w / 0.4) * 0.55;
        roundRect(g, L.gx + c * C + (C - s) / 2, L.gy + r * C + (C - s) / 2, s, s, s * 0.24);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    const fa = now - se.disp.flash;
    if (!REDUCED && fa >= 0 && fa < 0.35) {
      g.globalAlpha = 0.32 * (1 - fa / 0.35);
      g.fillStyle = '#ffffff';
      roundRect(g, fr.x, fr.y, fr.w, fr.h, fr.r); g.fill();
      g.globalAlpha = 1;
    }
  }

  // ---------- the tray ----------
  function drawPiece(g, p, cx, cy, pitch, set, sprite, k = 1) {
    const ox = cx - p.w * pitch / 2, oy = cy - p.h * pitch / 2;
    for (const [x, y] of p.cells) blit(g, sprite, set, ox + (x + 0.5) * pitch, oy + (y + 0.5) * pitch, k);
  }
  function drawTray(g, se, now, keys, hover) {
    const C = L.C, ts = L.ts, s = se.s;
    for (let k = 0; k < 3; k++) {
      const sl = L.slots[k], t = s.tray[k], tr = se.tray[k];
      const sel = se.kb && se.kb.slot === k;
      // its socket
      g.fillStyle = 'rgba(8,8,34,0.34)';
      roundRect(g, sl.x, sl.y, sl.w, sl.h, C * 0.34); g.fill();
      g.lineWidth = sel ? Math.max(2.5, C * 0.07) : 1.5;
      g.strokeStyle = sel ? HEX[0] : (hover === k ? 'rgba(205,184,255,0.32)' : 'rgba(205,184,255,0.12)');
      roundRect(g, sl.x + g.lineWidth / 2, sl.y + g.lineWidth / 2, sl.w - g.lineWidth, sl.h - g.lineWidth, C * 0.34 - g.lineWidth / 2); g.stroke();
      if (keys && t >= 0) {
        font(g, 700, Math.max(10, C * 0.24), MONO);
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.fillStyle = sel ? HEX[0] : 'rgba(205,184,255,0.42)';
        g.fillText(String(k + 1), sl.x + C * 0.2, sl.y + C * 0.16);
      }
      if (t < 0) continue;
      const p = PIECES[t];
      const fit = se.busy || fitsAnywhere(s.board, p);
      if (se.drag && se.drag.slot === k) {
        // its home while it's out: a dashed outline
        drawPiece(g, p, sl.cx, sl.cy, ts, tspr, tspr.hole);
        continue;
      }
      if (tr.back) {
        const bp = se.backPos(k);
        if (!bp.done) { drawPiece(g, p, bp.x, bp.y, C * bp.scale, spr, spr.normal[p.color], bp.scale); continue; }
        tr.back = null;
      }
      // a new tray: each piece comes in with a bounce
      let x = sl.cx, y = sl.cy, sc = 1, a = 1;
      const ea = now - tr.enter;
      if (ea < 0) continue;
      if (ea < T.deal) {
        const e = ease.outBack(ea / T.deal, 1.6);
        x += L.enter.dx * (1 - e); y += L.enter.dy * (1 - e);
        a = clamp(ea / 0.12, 0, 1);
        sc = REDUCED ? 1 : lerp(0.6, 1, e);
      }
      // the end of the run: the pieces that don't fit shake no
      const sa = now - tr.shake;
      if (sa >= 0 && sa < 0.9) x += Math.sin(sa * 38) * C * 0.13 * (1 - sa / 0.9);
      if (hover === k && !se.drag && fit) sc *= 1.05;
      if (sel) y -= C * 0.1;
      g.globalAlpha = a * (fit ? 1 : 0.62);
      drawPiece(g, p, x, y, ts * sc, tspr, fit ? tspr.normal[p.color] : tspr.grey, sc);
      g.globalAlpha = 1;
      if (!fit && !se.busy) noFit(g, sl.x + sl.w - C * 0.36, sl.y + C * 0.36, C * 0.22);
      if (se.busy && sa >= 0 && sa < 1.6) noFit(g, sl.x + sl.w - C * 0.36, sl.y + C * 0.36, C * 0.22 * (1 + 0.15 * Math.sin(sa * 14)));
    }
  }
  // the "doesn't fit" badge: a coral disc with a slash
  function noFit(g, x, y, r) {
    g.fillStyle = INK;
    g.beginPath(); g.arc(x, y + r * 0.16, r * 1.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = CORAL;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.5, r * 0.2);
    g.stroke();
    g.strokeStyle = PAPER;
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.6, r * 0.26);
    g.beginPath(); g.moveTo(x - r * 0.42, y - r * 0.42); g.lineTo(x + r * 0.42, y + r * 0.42); g.stroke();
  }

  // ---------- the chain tag, clipped on the board's top edge ----------
  function chainIcon(g, x, y, u, stroke) {
    g.save();
    g.translate(x, y);
    g.rotate(-0.62);
    link(g, -u * 0.42, 0, u, { stroke, width: Math.max(1.6, u * 0.3) });
    link(g, u * 0.42, 0, u, { stroke, width: Math.max(1.6, u * 0.3) });
    g.restore();
  }
  function drawTag(g, se, now) {
    const tg = L.tag, h = tg.h, chain = se.s.chain, left = linksLeft(chain, se.s.misses);
    const label = chain > 0 ? `×${chain}` : 'CHAIN';
    font(g, 900, Math.round(h * (chain > 0 ? 0.56 : 0.42)), DISPLAY, 'semi-expanded');
    const tw = g.measureText(label).width;
    const u = h * 0.34, padX = h * 0.36, iconW = h * 0.62, linkStep = u * 1.02, linksW = linkStep * 2 + u * 1.25;
    const w = padX + iconW + h * 0.1 + tw + h * 0.28 + linksW + padX;
    let sc = 1, jx = 0;
    const pa = now - se.disp.chainPop;
    if (!REDUCED && pa >= 0 && pa < 0.42) sc = 1 + 0.32 * Math.sin((pa / 0.42) * Math.PI) * (1 - pa / 0.42);
    const ba = now - se.disp.chainBreak;
    const breaking = ba >= 0 && ba < 0.5;
    if (breaking && !REDUCED) jx = Math.sin(ba * 50) * h * 0.12 * (1 - ba / 0.5);
    g.save();
    g.translate(tg.cx + jx, tg.cy);
    g.scale(sc, sc);
    const x0 = -w / 2, y0 = -h / 2, r = h / 2;
    g.fillStyle = INK_DEEP;
    roundRect(g, x0, y0 + h * 0.12, w, h, r); g.fill();
    const hot = chain >= 10;
    g.fillStyle = breaking ? CORAL : chain > 0 ? (hot ? HEX[2] : HEX[0]) : '#262b66';
    roundRect(g, x0, y0, w, h, r); g.fill();
    g.lineWidth = Math.max(2, h * 0.075);
    g.strokeStyle = INK;
    roundRect(g, x0 + g.lineWidth / 2, y0 + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, r - g.lineWidth / 2); g.stroke();
    const on = chain > 0;
    const ink = on || breaking ? INK : 'rgba(205,184,255,0.75)';
    let x = x0 + padX + iconW / 2;
    chainIcon(g, x, 0, u * 0.86, ink);
    x += iconW / 2 + h * 0.1;
    g.fillStyle = ink;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(label, x, h * 0.03);
    x += tw + h * 0.28 + u * 0.62;
    // the three links of grace: full after a clear, one gone for each drop without one
    for (let k = 0; k < CHAIN_GRACE + 1; k++) {
      const full = on && k < left;
      g.globalAlpha = full ? 1 : 0.28;
      link(g, x + k * linkStep, 0, u, { stroke: on || breaking ? INK : LAV2, width: Math.max(1.4, u * 0.3) });
    }
    g.globalAlpha = 1;
    // a link that just dropped off falls away
    for (const ll of se.disp.lostLinks) {
      const a = now - ll.t0;
      if (a < 0) continue;
      const k = a / 0.8;
      g.globalAlpha = 1 - k;
      g.save();
      g.translate(x + ll.k * linkStep + a * h * 0.6, a * a * h * 7 + h * 0.1);
      g.rotate(a * 5);
      link(g, 0, 0, u, { stroke: INK, width: Math.max(1.4, u * 0.3) });
      g.restore();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // ---------- labels: DOUBLE, TRIPLE…, CHAIN ×n, PERFECT CLEAR, NO ROOM ----------
  function drawLabels(g, se, now) {
    for (const lb of se.labels) {
      const a = now - lb.t0;
      if (a < 0) continue;
      const kin = clamp(a / 0.26, 0, 1);
      const sc = REDUCED ? 1 : lerp(1.85, 1, ease.outBack(kin, 2.2));
      const out = lb.stay ? 0 : clamp((a - (lb.life - 0.32)) / 0.32, 0, 1);
      g.save();
      g.globalAlpha = (REDUCED ? 1 : clamp(a / 0.06, 0, 1)) * (1 - out);
      g.translate(lb.x, lb.y - out * L.C * 0.6);
      g.rotate(lb.rot);
      g.scale(sc, sc);
      const size = lb.size;
      let y = 0;
      if (lb.text) {
        font(g, 900, Math.round(size), DISPLAY, 'expanded');
        const fit = Math.min(1, (L.C * 8.2) / Math.max(1, g.measureText(lb.text2 && lb.text2.length > lb.text.length ? lb.text2 : lb.text).width));
        if (fit < 1) font(g, 900, Math.round(size * fit), DISPLAY, 'expanded');
        const fs = Math.round(size * fit);
        if (lb.text2) {
          sticker(g, lb.text, 0, -fs * 0.5, fs, lb.color);
          sticker(g, lb.text2, 0, fs * 0.52, fs, PAPER);
          y = fs * 1.25;
        } else {
          sticker(g, lb.text, 0, 0, fs, lb.color);
          y = fs * 0.85;
        }
      }
      if (lb.sub) {
        const fs = Math.round(lb.text ? size * 0.5 : size);
        font(g, 900, fs, DISPLAY, 'expanded');
        const txt = `CHAIN ×${lb.sub}`;
        const tw = g.measureText(txt).width;
        const iu = fs * 0.5;
        const total = iu * 1.7 + fs * 0.2 + tw;
        const x0 = -total / 2;
        chainIcon(g, x0 + iu * 0.85, y + fs * 0.08, iu, INK);
        g.save();
        g.translate(0, -fs * 0.05);
        chainIcon(g, x0 + iu * 0.85, y + fs * 0.08, iu, HEX[0]);
        g.restore();
        sticker(g, txt, x0 + iu * 1.7 + fs * 0.2, y, fs, HEX[0], { align: 'left' });
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  // ---------- the score, the ticker, AGI-1 ----------
  const tickerText = (n) => (n > 0 ? ['BLOCK ', `#${fmt(n)}`, ' CONFIRMED'] : ['AWAITING ', 'GENESIS', ' BLOCK']);
  function drawScore(g, se, now) {
    const sp = L.score;
    let size = sp.size;
    const txt = fmt(se.disp.score);
    font(g, 900, Math.round(size), DISPLAY, 'semi-expanded');
    const w = g.measureText(txt).width + size * 0.2;
    if (w > sp.maxW) { size *= sp.maxW / w; font(g, 900, Math.round(size), DISPLAY, 'semi-expanded'); }
    const pa = now - se.disp.scorePop;
    const k = !REDUCED && pa >= 0 && pa < 0.32 ? 1 + 0.16 * Math.sin((pa / 0.32) * Math.PI) : 1;
    const fa = now - se.disp.scoreFlash;
    const fill = fa >= 0 && fa < 0.5 ? HEX[0] : PAPER;
    g.save();
    const ax = sp.align === 'center' ? sp.x : sp.align === 'right' ? sp.x - g.measureText(txt).width / 2 : sp.x + g.measureText(txt).width / 2;
    g.translate(ax, sp.y);
    g.scale(k, k);
    sticker(g, txt, 0, 0, Math.round(size), fill, { outline: 0.14, shadow: 0.08 });
    g.restore();
    // a new best in this run: a stamp beside the score
    const ba = now - se.disp.best;
    if (ba >= 0 && ba < 2.6) {
      const tw = g.measureText(txt).width;
      const bx = sp.align === 'right' ? sp.x - tw - L.C * 0.2 : ax + tw / 2 + L.C * 0.15, by = sp.y - size * 0.55;
      const kin = clamp(ba / 0.3, 0, 1), sc = REDUCED ? 1 : lerp(2, 1, ease.outBack(kin, 2.6));
      g.save();
      g.globalAlpha = 1 - clamp((ba - 2.2) / 0.4, 0, 1);
      g.translate(bx, by);
      g.rotate(-0.12);
      g.scale(sc, sc);
      pill(g, 'NEW BEST', 0, 0, Math.max(11, L.C * 0.26), HEX[1], sp.align === 'right' ? 'right' : 'left');
      g.restore();
    }
  }
  function pill(g, text, x, y, fs, fill, align = 'left') {
    font(g, 900, Math.round(fs), DISPLAY, 'expanded');
    const tw = g.measureText(text).width, h = fs * 1.7, w = tw + fs * 1.3;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    g.fillStyle = INK;
    roundRect(g, x0, y - h / 2 + fs * 0.18, w, h, h / 2); g.fill();
    g.fillStyle = fill;
    roundRect(g, x0, y - h / 2, w, h, h / 2); g.fill();
    g.lineWidth = Math.max(1.5, fs * 0.14);
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x0 + w / 2, y + fs * 0.04);
  }
  function drawTicker(g, se, now, x, y, size, align, maxW) {
    const parts = tickerText(se.disp.ticker);
    font(g, 650, Math.round(size), MONO);
    if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.08).toFixed(2)}px`;
    let widths = parts.map((t) => g.measureText(t).width);
    let total = widths[0] + widths[1] + widths[2];
    if (total > maxW) {
      size *= maxW / total;
      font(g, 650, Math.round(size), MONO);
      if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.08).toFixed(2)}px`;
      widths = parts.map((t) => g.measureText(t).width);
      total = widths[0] + widths[1] + widths[2];
    }
    let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const fa = now - se.disp.tickerFlash;
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k === 1 ? (fa >= 0 && fa < 0.16 ? HEX[2] : PAPER) : 'rgba(205,184,255,0.72)';
      g.fillText(parts[k], x0, y);
      x0 += widths[k];
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  // her face in a sticker circle
  function drawFace(g, x, y, r) {
    g.fillStyle = INK_DEEP;
    g.beginPath(); g.arc(x, y + r * 0.12, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e4d9ff';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (face.complete && face.naturalWidth) {
      g.save();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
      g.drawImage(face, x - r, y - r, r * 2, r * 2);
      g.restore();
    }
    g.lineWidth = Math.max(2, r * 0.1);
    g.strokeStyle = INK;
    g.beginPath(); g.arc(x, y, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  }
  // her line's presence: 0 → 1 → 0 over its time
  const lineAlpha = (se, now) => {
    if (!se.line) return 0;
    const a = now - se.line.t0;
    return clamp(Math.min(a / 0.18, (T.say - a) / 0.25), 0, 1);
  };
  function drawStatus(g, se, now) {
    const st = L.status, C = L.C;
    const la = lineAlpha(se, now);
    const tickA = 1 - la;
    if (tickA > 0.01) {
      g.globalAlpha = tickA;
      drawTicker(g, se, now, st.x, st.y + (1 - tickA) * C * 0.15, Math.max(10.5, C * 0.29), st.align, st.maxW);
      g.globalAlpha = 1;
    }
    if (la > 0.01) {
      const r = st.h * 0.46, gap = C * 0.16;
      let fs = Math.max(13, C * 0.4);
      font(g, 'italic 400', Math.round(fs), SERIF);
      let tw = g.measureText(se.line.text).width;
      const maxT = st.maxW - r * 2 - gap - C * 0.1;
      if (tw > maxT) { fs *= maxT / tw; font(g, 'italic 400', Math.round(fs), SERIF); tw = g.measureText(se.line.text).width; }
      const total = r * 2 + gap + tw;
      const x0 = st.align === 'center' ? st.x - total / 2 : st.x;
      const y = st.y + (1 - la) * C * 0.2;
      g.globalAlpha = la;
      drawFace(g, x0 + r, y, r);
      g.fillStyle = PAPER;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(se.line.text, x0 + r * 2 + gap, y + fs * 0.04);
      g.globalAlpha = 1;
    }
  }
  function wrap(g, text, maxW) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function drawPanel(g, se, now) {
    const pn = L.panel, C = L.C;
    font(g, 900, Math.round(Math.max(10, C * 0.27)), DISPLAY, 'expanded');
    if ('letterSpacing' in g) g.letterSpacing = `${(C * 0.04).toFixed(2)}px`;
    g.fillStyle = 'rgba(205,184,255,0.72)';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText('SCORE', pn.x + pn.w, pn.y + 0.42 * C);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    drawScore(g, se, now);
    // the ticker on two lines
    const parts = tickerText(se.disp.ticker);
    const fs = Math.max(10.5, C * 0.27);
    font(g, 650, Math.round(fs), MONO);
    g.textAlign = 'right';
    const fa = now - se.disp.tickerFlash;
    g.fillStyle = 'rgba(205,184,255,0.72)';
    const top = parts[0].trim(), mid = parts[1];
    const tw = g.measureText(` ${mid}`).width;
    g.fillText(top, pn.x + pn.w - tw, pn.y + 2.3 * C);
    g.fillStyle = fa >= 0 && fa < 0.16 ? HEX[2] : PAPER;
    g.fillText(` ${mid}`, pn.x + pn.w, pn.y + 2.3 * C);
    g.fillStyle = 'rgba(205,184,255,0.72)';
    g.fillText(parts[2].trim(), pn.x + pn.w, pn.y + 2.3 * C + fs * 1.35);
    // AGI-1 at the bottom, her line in a bubble above her
    const f = L.face;
    const la = lineAlpha(se, now);
    const bob = se.line ? Math.sin(Math.min(1, (now - se.line.t0) / 0.25) * Math.PI) * C * 0.08 : 0;
    drawFace(g, f.x, f.y - bob, f.r);
    if (la > 0.01) {
      let bs = Math.max(13, C * 0.36);
      font(g, 'italic 400', Math.round(bs), SERIF);
      const maxW = pn.w - C * 0.5;
      let lines = wrap(g, se.line.text, maxW);
      if (lines.length > 3) { bs *= 0.85; font(g, 'italic 400', Math.round(bs), SERIF); lines = wrap(g, se.line.text, maxW); }
      const lh = bs * 1.15, bw = Math.min(pn.w, Math.max(...lines.map((l) => g.measureText(l).width)) + C * 0.5), bh = lines.length * lh + C * 0.36;
      const bx = pn.x + pn.w - bw, by = f.y - f.r - C * 0.32 - bh + (1 - la) * C * 0.2;
      g.globalAlpha = la;
      g.fillStyle = INK;
      roundRect(g, bx, by + C * 0.08, bw, bh, C * 0.24); g.fill();
      g.fillStyle = PAPER;
      roundRect(g, bx, by, bw, bh, C * 0.24); g.fill();
      g.lineWidth = Math.max(1.5, C * 0.05);
      g.strokeStyle = INK;
      g.stroke();
      // its tail, down to her
      g.fillStyle = PAPER;
      g.beginPath();
      g.moveTo(f.x - C * 0.28, by + bh - 1);
      g.lineTo(f.x - C * 0.02, by + bh + C * 0.26);
      g.lineTo(f.x + C * 0.06, by + bh - 1);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillRect(f.x - C * 0.26, by + bh - g.lineWidth * 1.5, C * 0.3, g.lineWidth * 1.4);
      g.fillStyle = INK;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, bx + C * 0.25, by + C * 0.18 + lh * (i + 0.5)));
      g.globalAlpha = 1;
    }
  }
  function drawHead(g, se, now) {
    if (L.mode === 'S') { drawPanel(g, se, now); return; }
    drawScore(g, se, now);
    drawStatus(g, se, now);
  }

  // ---------- the piece in hand ----------
  function drawDrag(g, se, now, bot) {
    const d = se.drag;
    if (d) {
      const pos = se.dragPos(), C = L.C, p = d.p, k = pos.scale;
      g.save();
      g.translate(pos.x, pos.y);
      g.rotate(REDUCED ? 0 : d.tilt);
      // its hard shadow, then the piece
      g.globalAlpha = 0.4;
      drawPiece(g, p, C * 0.1 * k, C * 0.24 * k, C * k, spr, spr.shadow, k);
      g.globalAlpha = 1;
      drawPiece(g, p, 0, 0, C * k, spr, spr.normal[p.color], k);
      g.restore();
    }
    // the demo's finger
    const f = bot && bot.finger;
    if (f) {
      const C = L.C;
      let a = 1;
      if (f.up != null) a = 1 - clamp((now - f.up) / 0.22, 0, 1);
      if (a > 0) {
        const r = C * (0.42 - 0.06 * (f.down || 0));
        g.globalAlpha = a;
        g.fillStyle = 'rgba(255,250,240,0.22)';
        g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fill();
        g.lineWidth = Math.max(2, C * 0.07);
        g.strokeStyle = INK;
        g.beginPath(); g.arc(f.x, f.y, r + g.lineWidth * 0.5, 0, Math.PI * 2); g.stroke();
        g.lineWidth = Math.max(1.5, C * 0.045);
        g.strokeStyle = PAPER;
        g.beginPath(); g.arc(f.x, f.y, r - g.lineWidth * 0.2, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  return { layout, draw, get L() { return L; } };
}
