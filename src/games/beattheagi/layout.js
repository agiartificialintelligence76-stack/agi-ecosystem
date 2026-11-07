// BEAT THE AGI (2026-11-08): where everything goes, for any screen (pure maths, no DOM). Two arrangements:
//   tall (phones held upright, tablets upright, the 480 × 480 demo): AGI-1's portrait and bubble in a row on top, her
//     attention bars / your ghost stone in the drop zone, the board, then the status pill and the ladder's chips
//   wide (phones on their side, computers): the ladder's chips on the left (when there's room), the board in the
//     middle, AGI-1's panel on the right (portrait, name, depth, bubble, status)
// Sizes are in CSS pixels; C is one cell.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const PAD = 0.3;          // the frame around the holes (in cells)
export const DROP = 1.25;        // the drop zone above the board
export const HOLE = 0.405;       // hole radius
export const STONE = 0.365;      // stone radius
export const SHADOW = 0.11;      // the hard shadow's offset
export const FEET = 0.36;        // the stand's feet under the board

export function layout(w, h, ins = {}, { demo = false } = {}) {
  const top = ins.top || 0, right = ins.right || 0, bottom = ins.bottom || 0, left = ins.left || 0;
  const aw = Math.max(200, w - left - right), ah = Math.max(200, h - top - bottom);
  const wide = !demo && aw / ah > 1.08 && aw >= 560;
  return wide ? wideLayout(left, top, aw, ah) : tallLayout(left, top, aw, ah, demo);
}

export const DROP_AT = 6.42;     // where a stone starts its fall, in rows (row 0 is the bottom row)
function boardAt(L, x, y, drop = DROP) {
  const C = L.C;
  L.drop = drop;
  L.board = { x, y, w: 7 * C + 2 * PAD * C, h: 6 * C + 2 * PAD * C };
  L.r = C * 0.34;
  L.cx = (c) => x + PAD * C + (c + 0.5) * C;
  L.cy = (r) => y + PAD * C + (5 - r + 0.5) * C;
  L.dropY = L.cy(DROP_AT);                       // the ghost stone, and every stone before it falls
  L.barBase = y - C * 0.16;                      // the attention bars stand on this line
  L.barMax = drop * C - C * 0.34;
  L.hole = HOLE * C;
  L.stone = STONE * C;
  return L;
}

function tallLayout(x0, y0, aw, ah, demo) {
  const m = clamp(aw * 0.035, 8, 22);
  const Cw = (aw - 2 * m) / (7 + 2 * PAD + SHADOW);
  // the stack in cells: portrait row (~1.7, or 1.1 in the demo), gap, drop zone, board, shadow and feet, gap, status
  const herK = demo ? 1.08 : 1.72;
  const statusK = demo ? 0 : 0.95;
  const stackK = herK + 0.18 + DROP + 6 + 2 * PAD + SHADOW + FEET + statusK;
  const Ch = (ah - 2 * m) / stackK;
  const C = Math.max(18, Math.min(Cw, Ch, 104));
  const L = { C, wide: false, demo, m };
  const boardW = 7 * C + 2 * PAD * C;
  let P = demo ? clamp(C * 1.02, 40, 76) : clamp(C * 1.62, 52, 128);
  const statusH = demo ? 0 : clamp(C * 0.62, 30, 46);
  const stripH = clamp(C * 0.56, 26, 40);
  const core = () => P + C * 0.18 + DROP * C + 6 * C + 2 * PAD * C + SHADOW * C + FEET * C + (demo ? 0 : C * 0.33 + statusH);
  let free = ah - 2 * m - core();
  // a tall screen: a bigger portrait first, then the ladder's strip, then air (more of it above the board, which
  // brings the board down toward the thumbs)
  if (!demo && free > 0) { const grow = Math.min(free * 0.45, Math.min(C * 2.25, 150) - P); if (grow > 0) { P += grow; free -= grow; } }
  const strip = !demo && free > stripH + C * 0.4;
  if (strip) free -= stripH + C * 0.28;
  free = Math.max(0, free);
  const gapTop = demo ? free / 2 : free * 0.3, gapMid = demo ? 0 : free * 0.2, gapLow = demo ? 0 : free * 0.12;
  let y = y0 + m + gapTop;
  const bx = x0 + (aw - boardW - SHADOW * C) / 2;
  // her row: the portrait at the board's left edge, the bubble beside it
  L.her = { x: bx + P / 2 + C * 0.06, y: y + P / 2, r: P / 2 };
  const bubX = L.her.x + P / 2 + clamp(C * 0.36, 10, 22);
  L.bubble = { x: bubX, y, w: bx + boardW - bubX, h: P, tail: 'left' };
  L.name = { x: bubX, y: y + P * 0.06, align: 'left' };
  y += P + C * 0.18 + gapMid + DROP * C;
  boardAt(L, bx, y);
  y += 6 * C + 2 * PAD * C + SHADOW * C + FEET * C;
  if (!demo) {
    y += C * 0.33 + gapLow;
    L.status = { x: bx + boardW / 2, y: y + statusH / 2, h: statusH, maxW: boardW };
    y += statusH;
  }
  if (strip) {
    y += C * 0.28;
    L.ladder = { vertical: false, x: bx + boardW / 2, y: y + stripH / 2, h: stripH, w: Math.min(boardW, stripH * 9.6) };
  }
  return L;
}

const WIDE_DROP = 1.12;
function wideLayout(x0, y0, aw, ah) {
  const m = clamp(ah * 0.03 - 4, 5, 24);
  const panelW = clamp(aw * 0.27, 196, 360);
  const ladderW = aw >= 1080 && ah >= 560 ? clamp(aw * 0.068, 70, 92) : 0;
  const gap = clamp(aw * 0.03, 16, 48);
  const boardAreaW = aw - panelW - ladderW - gap * (ladderW ? 2 : 1) - 2 * m;
  const Cw = boardAreaW / (7 + 2 * PAD + SHADOW);
  const Ch = (ah - 2 * m) / (WIDE_DROP + 6 + 2 * PAD + SHADOW + FEET);
  const C = Math.max(18, Math.min(Cw, Ch, 112));
  const L = { C, wide: true, demo: false, m };
  const boardW = 7 * C + 2 * PAD * C;
  const blockH = (WIDE_DROP + 6 + 2 * PAD + SHADOW + FEET) * C;
  const groupW = (ladderW ? ladderW + gap : 0) + boardW + SHADOW * C + gap + panelW;
  let x = x0 + (aw - groupW) / 2;
  const by = y0 + (ah - blockH) / 2 + WIDE_DROP * C;
  if (ladderW) {
    const chipH = clamp(C * 0.62, 30, 48);
    L.ladder = { vertical: true, x: x + ladderW / 2, y: by + (6 * C + 2 * PAD * C) / 2, h: chipH, w: ladderW, gap: chipH * 0.42 };
    x += ladderW + gap;
  }
  boardAt(L, x, by, WIDE_DROP);
  x += boardW + SHADOW * C + gap;
  // her panel: portrait, name, depth, bubble, status
  const P = clamp(Math.min(panelW * 0.56, ah * 0.3), 76, 184);
  const statusH = clamp(C * 0.6, 30, 46);
  const bubH = clamp(ah * 0.2, 64, 132);
  const nameH = clamp(P * 0.22, 22, 34);
  const depthH = clamp(P * 0.16, 16, 24);
  const panelH = P + nameH * 0.5 + nameH + depthH + 14 + bubH + 14 + statusH;
  let py = y0 + Math.max(m, (ah - panelH) / 2);
  L.her = { x: x + panelW / 2, y: py + P / 2, r: P / 2 };
  py += P + nameH * 0.15;
  L.name = { x: x + panelW / 2, y: py, align: 'center', h: nameH };
  py += nameH + depthH + 14;
  L.bubble = { x, y: py, w: panelW, h: bubH, tail: 'top' };
  py += bubH + 14;
  L.status = { x: x + panelW / 2, y: py + statusH / 2, h: statusH, maxW: panelW };
  L.panel = { x, w: panelW };
  return L;
}

// the column under a point (generous: anywhere from the drop zone to the stand, and a little past the frame)
export function columnAt(L, px, py) {
  if (!L?.board) return -1;
  const b = L.board, C = L.C;
  if (py < b.y - L.drop * C - C * 0.6 || py > b.y + b.h + C * 0.6) return -1;
  if (px < b.x - C * 0.4 || px > b.x + b.w + C * 0.4) return -1;
  const c = Math.floor((px - b.x - PAD * C) / C);
  return Math.max(0, Math.min(6, c));
}
