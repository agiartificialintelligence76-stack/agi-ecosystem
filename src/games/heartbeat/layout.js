// HEARTBEAT (2026-11-08): where everything goes, for any screen (pure: tests/heartbeat.test.js checks the shapes).
//
// Tall screens (phones held upright, tablets, the demo's square): AGI-1 sings on a stage at the top, and the highway
// runs from the stage's edge down to the hit line, wide at the bottom like a runway seen from the crowd.
// Wide screens (phones turned, computers): the highway sits in the middle (at most 520 px wide at the hit line), AGI-1
// stands big on her stage beside it, and a "now playing" ticket sits on the other side when there's room.
//
// The highway is drawn in perspective: s = 0 at the hit line, 1 at the far end. k(s) = 1 / (1 + c·s) is how big
// things are there (1 at the hit line, `ratio` at the far end).
export const MAX_W = 520;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const HER_ASPECT = 796 / 1510;       // her cutout's width ÷ height

export function layoutOf(w, h, { top = 64, keys = false, demo = false } = {}) {
  const wide = w / h >= 1.15;
  const L = { w, h, top, wide, keys };
  if (!wide) {
    const gutter = clamp(w * 0.03, 8, 24);
    L.nearW = Math.min(w - 2 * gutter, MAX_W);
    L.pad = clamp(h * 0.12, 64, 124) + (keys ? 14 : 0);
    L.hitY = h - L.pad;
    const room = L.hitY - top;
    L.herH = clamp(room * (demo ? 0.38 : 0.36), 110, 360);
    L.stageY = top + L.herH + (demo ? 2 : 6);
    L.farY = L.stageY + 4;
    // a short screen: keep at least 44 % of the height for the highway
    const minRoad = h * 0.44;
    if (L.hitY - L.farY < minRoad) {
      const cut = minRoad - (L.hitY - L.farY);
      L.herH = Math.max(90, L.herH - cut);
      L.stageY = top + L.herH + 6;
      L.farY = L.stageY + 4;
    }
    L.ratio = 0.34;
    L.cx = w / 2;
    L.her = { x: w / 2, y: L.stageY, h: L.herH };
    L.ticket = null;
  } else {
    L.nearW = Math.min(MAX_W, w * 0.56);
    L.pad = clamp(h * 0.14, 52, 124) + (keys ? 10 : 0);
    L.hitY = h - L.pad;
    L.farY = top + clamp(h * 0.07, 8, 90);
    L.ratio = 0.4;
    L.cx = w / 2;
    const side = (w - L.nearW) / 2;
    L.herH = Math.min(h - top - 8, h * 0.82, (side * 0.92) / HER_ASPECT);
    L.stageY = h - Math.max(6, h * 0.02);
    L.her = { x: side * 0.5, y: L.stageY, h: L.herH };
    // the "now playing" ticket on the right, when it fits
    const tw = Math.min(280, side - 32);
    L.ticket = tw >= 170 && h >= 360 ? { x: w - side / 2 - tw / 2, y: top + 18, w: tw } : null;
  }
  L.farW = L.nearW * L.ratio;
  L.c = 1 / L.ratio - 1;
  L.laneW = L.nearW / 4;
  L.left = L.cx - L.nearW / 2;
  return L;
}

// s (0 hit line … 1 far end; below 0 past the line) → { y, k }
export function project(L, s) {
  const k = 1 / (1 + L.c * Math.max(-0.4, s));
  const y = L.hitY - (L.hitY - L.farY) * (1 - k) / (1 - L.ratio);
  return { y, k };
}

// the x of a lane's centre (or edge: lane - 0.5) at depth k
export const laneX = (L, lane, k) => L.cx + (lane - 1.5) * L.laneW * k;

// a finger or the mouse at x (CSS px) → its lane: the four columns of the hit line, the outer two reaching the edges
export function laneAt(L, x) {
  return clamp(Math.floor((x - L.left) / L.laneW), 0, 3);
}

// a note's time → s, `approach` seconds of song from the far end to the hit line
export const depthOf = (noteT, songT, approach) => (noteT - songT) / approach;
