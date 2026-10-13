// 1. The hook (0–8 s): Nova's photos, a shutter each. "Meet Nova." Her feed, likes. One of them comes alive (a trend
// video of her). "She's not real." AI-generated. "You made her." ✦ Create, and Kai, Mika and Juno pop in.
import { S, backdrop, headline, aiPill, goButton, pointer, ripple, heartPop, glow } from '../look.js';
import { card, popK, frameOf, around, nameTag, E, prog, clamp, mix, spring, media } from '../parts.js';

const STACK = [
  { name: 'nova-beach', dx: -34, dy: 14, rot: -0.075 },
  { name: 'nova-cafe', dx: 28, dy: -8, rot: 0.055 },
  { name: 'nova-golden', dx: 0, dy: 0, rot: -0.018 },
];
const GRID = ['nova-beach', 'nova-cafe', 'nova-golden', 'nova-look-1', 'nova-cafe-edit-red', 'nova-body'];
// 16:9: the words on the left (from X), her photos in the right part, around MID
const MID = 1290, X = 140;
const CW = 206, CH = 258, GAP = 18, GX = MID - (3 * CW + 2 * GAP) / 2, GY = 273;
const cell = (k) => ({ cx: GX + (k % 3) * (CW + GAP) + CW / 2, cy: GY + Math.floor(k / 3) * (CH + GAP) + CH / 2 });
const BIG = { cx: MID - 10, cy: 540, w: 470, h: 836 };
const SQUAD = [
  { name: 'kai-look-1', who: 'Kai', cx: MID - 278, cy: 772, rot: -0.11 },
  { name: 'mika-look-1', who: 'Mika', cx: MID + 270, cy: 318, rot: 0.09 },
  { name: 'juno-look-1', who: 'Juno', cx: MID + 276, cy: 790, rot: 0.07 },
];
const LIKED = [0, 4, 1, 3];

export default {
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.85, b: 0.75, ax: 0.12, ay: 0.2, bx: 0.85, by: 0.85 });
    const zoomP = E.inOutCubic(prog(t, M.zoom, M.zoom + 0.55));

    // the big clip's light behind everything, once it's alive
    if (t >= M.zoom) {
      const bm = frameOf(c, 'nova-golden-trend', t - M.zoom, 300, { size: 's' });
      const sf = md.softFrame(bm);
      if (sf) {
        g.save();
        g.globalAlpha = 0.42 * zoomP;
        g.drawImage(sf, 0, -H * 0.4, W, W * (sf.height / sf.width));
        g.restore();
        g.fillStyle = `rgba(9,9,11,${0.45 * zoomP})`;
        g.fillRect(0, 0, W, H);
      }
      glow(g, BIG.cx, BIG.cy, 620, 'rgba(139,92,246,0.35)', zoomP);
    }

    // ---- her photos: a stack (0–2 s), then her feed (2–4 s), then one comes alive (4 s on) ----
    const toGrid = E.inOutCubic(prog(t, M.feed, M.feed + 0.48));
    // the three new cells of her feed
    if (t >= M.feed) {
      for (let k = 3; k < 6; k++) {
        const p = popK(t, M.grid[k], 0.45);
        if (p <= 0) continue;
        const { cx, cy } = cell(k);
        const away = E.inCubic(prog(t, M.zoom, M.zoom + 0.35));
        card(g, md.pic(GRID[k]), cx, cy, CW, CH, { sc: p * (1 - away * 0.25), alpha: clamp(p) * (1 - away), r: 18, sh: 0.55, focus: [0.5, 0.32] });
      }
    }
    STACK.forEach((s, k) => {
      const t0 = M.shots[k] - (k === 0 ? 0.2 : 0);       // the first one is there on the very first frame, still white
      if (t < t0) return;
      const drop = E.outCubic(prog(t, t0, t0 + 0.32));
      const flash = 1 - E.outQuad(prog(t, M.shots[k], M.shots[k] + 0.5));
      const stackX = MID + s.dx, stackY = 540 + s.dy - (1 - drop) * 90;
      const { cx: gx, cy: gy } = cell(k);
      let cx = mix(stackX, gx, toGrid), cy = mix(stackY, gy, toGrid);
      let w = mix(360, CW, toGrid), h = mix(450, CH, toGrid), rot = mix(s.rot, 0, toGrid);
      let alpha = clamp(drop * 1.6);
      if (k === 2 && t >= M.zoom) {           // the golden one comes alive
        cx = mix(gx, BIG.cx, zoomP); cy = mix(gy, BIG.cy, zoomP); w = mix(CW, BIG.w, zoomP); h = mix(CH, BIG.h, zoomP);
      } else if (t >= M.zoom) {
        const away = E.inCubic(prog(t, M.zoom, M.zoom + 0.35));
        alpha *= 1 - away; w *= 1 - away * 0.25; h *= 1 - away * 0.25;
      }
      if (alpha <= 0) return;
      const sc = mix(1.08, 1, drop);
      if (k === 2 && t >= M.zoom + 0.25) {
        const bm = frameOf(c, 'nova-golden-trend', t - M.zoom, h);
        const mixIn = E.outQuad(prog(t, M.zoom + 0.25, M.zoom + 0.6));
        card(g, md.pic(s.name), cx, cy, w, h, { rot, alpha: alpha * (1 - mixIn), r: 24, sh: 0.8, focus: [0.5, 0.4] });
        card(g, bm, cx, cy, w, h, { rot, alpha: alpha * mixIn, r: 24, sh: 0.8 * mixIn, focus: [0.5, 0.45] });
      } else {
        card(g, md.pic(s.name), cx, cy, w, h, { rot, sc, alpha, flash, r: mix(22, 18, toGrid), sh: 0.75, focus: [0.5, 0.36] });
      }
    });
    // likes on her feed
    if (t >= M.likes[0] - 0.01 && t < M.zoom + 0.3) {
      const fade = 1 - E.inCubic(prog(t, M.zoom, M.zoom + 0.25));
      LIKED.forEach((k, i) => {
        const t0 = M.likes[i];
        if (t < t0) return;
        const { cx, cy } = cell(k);
        heartPop(g, cx - CW / 2 + 36, cy + CH / 2 - 36, t, t0, { size: 40, alpha: fade });
      });
    }

    // ---- the words ----
    headline(g, ['Meet ', 'Nova.'], t, M.meet, { x: X, y: 572, size: 118, maxW: 560, out: M.feed - 0.23, outDur: 0.2 });
    headline(g, ['She posts ', 'every day.'], t, M.feed + 0.02, { x: X, y: 508, size: 104, maxW: 540, out: M.zoom - 0.05, grad: [1] });
    headline(g, ["She's not real."], t, M.notReal, { x: X, y: 508, size: 104, maxW: 540, out: M.youMade - 0.23, outDur: 0.2, grad: [] });
    if (t >= M.aiPill && t < M.youMade + 0.1) {
      const p = popK(t, M.aiPill, 0.4), out = 1 - prog(t, M.youMade - 0.12, M.youMade);
      around(g, X + 140, 694, { sc: p, alpha: clamp(p) * out }, () => aiPill(g, 0, 0, { size: 24, align: 'center' }));
    }
    // the stamp on her video too
    if (t >= M.aiPill) {
      const p = popK(t, M.aiPill + 0.08, 0.4);
      const fade = 1 - E.inCubic(prog(t, M.breath - 0.1, M.breath + 0.2)) * 0;
      around(g, BIG.cx - BIG.w / 2 + 128, BIG.cy - BIG.h / 2 + 44, { sc: p, alpha: clamp(p) * fade }, () => aiPill(g, 0, 0, { size: 22, align: 'center' }));
    }
    headline(g, ['You', ' made her.'], t, M.youMade, { x: X, y: 508, size: 112, maxW: 560, grad: [0] });

    // ✦ Create, and a click on it
    if (t >= M.youMade + 0.3) {
      const p = popK(t, M.youMade + 0.35, 0.45);
      const bx = X, by = 690, bw = 300;
      around(g, bx + bw / 2, by + 40, { sc: p, alpha: clamp(p) }, () => {
        goButton(g, 'Create', -bw / 2, -40, bw, { u: 1.85, press: clamp(1 - Math.abs(t - M.createClick) / 0.12), glowA: 0.6 + 0.4 * Math.exp(-Math.max(0, t - M.createClick) * 3) * (t >= M.createClick ? 1 : 0), align: 'center', size: 16 });
      });
      const keys = [[M.youMade + 0.5, X + 450, 980], [M.createClick, bx + bw * 0.6, by + 44, true], [M.breath, bx + bw * 0.62, by + 50]];
      const pt = keysAt(keys, t);
      ripple(g, bx + bw * 0.6, by + 44, t, M.createClick, { r: 70 });
      pointer(g, pt.x, pt.y, { s: 1.7, press: pt.press, alpha: clamp(prog(t, M.youMade + 0.45, M.youMade + 0.7)) });
    }

    // Kai, Mika and Juno pop in around her
    SQUAD.forEach((s, k) => {
      const t0 = M.squad[k];
      if (t < t0) return;
      const p = popK(t, t0, 0.5);
      const bob = Math.sin((t - t0) * 2.1 + k) * 5;
      card(g, md.pic(s.name), s.cx, s.cy + bob, 196, 245, { rot: s.rot, sc: p, alpha: clamp(p * 1.5), r: 18, sh: 0.8, focus: [0.5, 0.36] });
      around(g, s.cx, s.cy + bob + 150, { sc: p, alpha: clamp(p) }, () => nameTag(g, s.who, 0, 0, { size: 22 }));
    });
  },
};

// the pointer's path (as look.js's pointerAt, kept here so the click lands on the button's spot)
function keysAt(keys, t) {
  let x = keys[0][1], y = keys[0][2], press = 0;
  for (let i = 0; i < keys.length; i++) {
    const [ti, xi, yi] = keys[i];
    if (t >= ti) { x = xi; y = yi; }
    const nx = keys[i + 1];
    if (nx && t >= ti && t < nx[0]) {
      const p = E.inOutCubic(prog(t, ti, nx[0]));
      x = mix(xi, nx[1], p); y = mix(yi, nx[2], p) - Math.sin(p * Math.PI) * 30;
    }
    if (keys[i][3]) { const d = t - ti; if (d >= -0.06 && d < 0.16) press = d < 0 ? 1 + d / 0.06 : 1 - d / 0.16; }
  }
  return { x, y, press: clamp(press) };
}
void spring; void media;
