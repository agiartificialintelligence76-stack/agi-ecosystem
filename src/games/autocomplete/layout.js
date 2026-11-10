// AUTOCOMPLETE (2026-11-09): where things go on the screen. Pure (no DOM): numbers in, rectangles out.
//
// Upright screens (phones, tablets, computers): one column, centred: the context window, AGI-1's face and her
// suggestion strip, the board (5 × 6 keys), the tools. Short, wide screens (a phone held sideways): the board on the
// right, her strip, the context window and the tools in a panel on its left.
import { COLS, ROWS } from './solver.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// w, h: the canvas (CSS px); inset: { top, right, bottom, left } (the kit's bar, the notch); demo: the arcade's preview
export function computeLayout(w, h, inset = {}, { demo = false } = {}) {
  const t = inset.top || 0, r = inset.right || 0, b = inset.bottom || 0, l = inset.left || 0;
  const aw = Math.max(200, w - l - r), ah = Math.max(200, h - t - b);
  const side = !demo && aw > ah * 1.25 && ah < 620;
  const L = { w, h, side, demo };
  if (side) {
    // the board as tall as the screen allows, on the right; the panel on the left
    const pad = clamp(ah * 0.04, 8, 18);
    let pitch = Math.min((ah - pad * 2) / ROWS, (aw * 0.5) / COLS, 96);
    pitch = Math.max(pitch, 30);
    const bw = pitch * COLS, bh = pitch * ROWS;
    const panelW = clamp(aw - bw - pad * 3, 220, 480);
    const gx = l + (aw - (panelW + pad * 2 + bw)) / 2;
    L.pitch = pitch;
    L.board = { x: gx + panelW + pad * 2, y: t + (ah - bh) / 2, w: bw, h: bh };
    const stripH = clamp(pitch * 0.95, 46, 62);
    const faceR = stripH * 0.62;
    const ctxH = 14, toolsH = 50, gap = clamp(ah * 0.045, 10, 18);
    const stackH = faceR * 2 + gap * 0.6 + stripH + gap + ctxH + gap + toolsH;
    let y = t + Math.max(pad, (ah - stackH) / 2);
    const px = gx;
    L.face = { x: px + panelW / 2, y: y + faceR, r: faceR };
    y += faceR * 2 + gap * 0.6;
    L.strip = { x: px, y, w: panelW, h: stripH };
    y += stripH + gap;
    L.ctx = { x: px + 4, y, w: panelW - 8, h: ctxH };
    y += ctxH + gap;
    L.tools = { x: px, y, w: panelW, h: toolsH };
    L.say = { x: px, y: L.strip.y, w: panelW, h: stripH };
    return finish(L);
  }
  // one column
  const pad = demo ? 8 : clamp(aw * 0.04, 10, 20);
  const ctxH = demo ? 12 : 14, toolsH = demo ? 0 : 50;
  const gap1 = demo ? 8 : clamp(ah * 0.016, 8, 16);       // context → strip
  const gap2 = demo ? 10 : clamp(ah * 0.02, 10, 20);      // strip → board
  const gap3 = demo ? 0 : clamp(ah * 0.022, 10, 22);      // board → tools
  const maxW = demo ? aw - pad * 2 : Math.min(aw - pad * 2, 620);
  // the strip's height follows the key size; solve for the key size that fits both ways
  let pitch = Math.min(maxW / COLS, 104);
  for (let k = 0; k < 3; k++) {
    const stripH = clamp(pitch * 0.8, 44, 66);
    const fixed = pad * 2 + ctxH + gap1 + stripH + gap2 + gap3 + toolsH;
    pitch = Math.min(maxW / COLS, (ah - fixed) / ROWS, 104);
  }
  pitch = Math.max(pitch, 30);
  const stripH = clamp(pitch * 0.8, 44, 66);
  const bw = pitch * COLS, bh = pitch * ROWS;
  const stackH = ctxH + gap1 + stripH + gap2 + bh + gap3 + toolsH;
  let y = t + Math.max(pad, (ah - stackH) / 2);
  const cx = l + aw / 2;
  // the strip row (her face, then the strip) a little wider than the board when there's room
  const rowW = Math.min(maxW, Math.max(bw + pitch * 0.5, Math.min(maxW, 340)));
  const faceR = stripH * 0.56;
  L.pitch = pitch;
  L.ctx = { x: cx - rowW / 2, y, w: rowW, h: ctxH };
  y += ctxH + gap1;
  L.face = { x: cx - rowW / 2 + faceR, y: y + stripH / 2, r: faceR };
  const sx = L.face.x + faceR + Math.max(8, faceR * 0.3);
  L.strip = { x: sx, y, w: cx + rowW / 2 - sx, h: stripH };
  y += stripH + gap2;
  L.board = { x: cx - bw / 2, y, w: bw, h: bh };
  y += bh + gap3;
  L.tools = { x: cx - rowW / 2, y, w: rowW, h: toolsH };
  L.say = L.strip;
  return finish(L);
}

function finish(L) {
  const p = L.pitch;
  L.cap = p * 0.88;                  // a key's face
  L.depth = Math.max(3, p * 0.075);  // how far a key stands up (its hard shadow)
  L.hit = p * 0.38;                  // a key's circle while a finger slides (≈ 70% of the key: diagonals never clip)
  return L;
}

// the centre of a cell (CSS px)
export function cellCenter(L, i) {
  return { x: L.board.x + ((i % COLS) + 0.5) * L.pitch, y: L.board.y + (Math.floor(i / COLS) + 0.5) * L.pitch };
}
// the cell under a point: `loose` (a finger coming down: anywhere on its key) or its circle (a finger sliding); -1 none
export function cellAt(L, x, y, loose = false) {
  const gx = (x - L.board.x) / L.pitch, gy = (y - L.board.y) / L.pitch;
  const c = Math.floor(gx), r = Math.floor(gy);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  if (loose) return r * COLS + c;
  const dx = (gx - c - 0.5) * L.pitch, dy = (gy - r - 0.5) * L.pitch;
  return dx * dx + dy * dy <= L.hit * L.hit ? r * COLS + c : -1;
}
