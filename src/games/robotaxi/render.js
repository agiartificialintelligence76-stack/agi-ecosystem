// ROBOTAXI RUSH: drawing the world. The classic way: the road's segments are projected near to far (a hill hides what's
// behind it: each segment is clipped to the top of the road already drawn in front of it), then everything standing on
// them is drawn far to near, cut off where a nearer hill covers it. The road is drawn in a few big batches (one fill per
// color and haze step) rather than segment by segment: cheap on phones.
import { SEG, ROAD_HALF, RUMBLE, DRAW, CAM_H, NEAR, PLAYER, ZONES, clamp, lerp, zoneOfIndex } from './config.js';
import { LOOKS, roadColors, FOG_STEPS, INK, PAPER, HONEY, PINK, MINT } from './zones.js';
import { decorAt, decorBuffer } from './decor.js';
import { playerSprite, TAIL_SPOTS } from './sprites.js';
import { createScenery } from './scenery.js';
import { zoomView } from './camera.js';
import { REDUCED } from '../kit/env.js';

const N = DRAW + 2;
const LANE_LINE = 0.016, EDGE_IN = 0.962, EDGE_OUT = 0.986, RUMBLE_IN = 0.97;
const GRID_F = [1.45, 2.05, 2.8, 3.75, 5, 6.7];
const GRID_FAR = 110;               // past this segment the grid's lines are lost in the haze anyway
const LANES_F = [-0.5, 0, 0.5];
const COLORS = Object.fromEntries(ZONES.map((z) => [z, roadColors(LOOKS[z])]));
const ZI = Object.fromEntries(ZONES.map((z, i) => [z, i]));

export function createRenderer(g, sprites) {
  const P = {
    sx: new Float32Array(N), sy: new Float32Array(N), sw: new Float32Array(N), z: new Float32Array(N), cw: new Float32Array(N),
    vis: new Uint8Array(N), nx: new Float32Array(N), ny: new Float32Array(N), nw: new Float32Array(N), clip: new Float32Array(N),
    k: new Uint8Array(N), alt: new Uint8Array(N), zi: new Uint8Array(N), idx: new Int32Array(N),
  };
  const runStart = new Int32Array(N), runEnd = new Int32Array(N), runZ = new Uint8Array(N), runK = new Uint8Array(N);
  let runs = 0;
  const decor = decorBuffer();
  const scenery = createScenery();
  const cam = { x: 0, y: 0, z: 0, base: 0, pz: 0, px: 0 };
  let V = null;                        // the view this frame (with the boost's zoom)
  const zv = {};
  // the things standing on each segment this frame (cars, pins, the robotaxi): a reused pool
  const pool = Array.from({ length: 160 }, () => ({ kind: 0, ref: null, z: 0, x: 0 }));
  let used = 0;
  const bucket = Array.from({ length: N }, () => []);
  let playerImgs = null, playerPx = 0;
  const lastPlayer = { x: 0, y: 0, w: 0, h: 0 };
  const pr = { x: 0, y: 0, s: 0 };

  // ---------- projecting the road ----------
  function projectRoad(track, camZ, camY, camX) {
    const base = Math.floor(camZ / SEG), pct = camZ / SEG - base;
    track.ensure(base + N + 2);
    let x = 0, dx = -track.curve(base) * pct;
    for (let n = 0; n < N; n++) {
      const i = base + n;
      const z = i * SEG - camZ;
      const s = 1 / Math.max(NEAR, z);
      P.cw[n] = x;
      P.sx[n] = V.cx + V.fx * (x - camX) * s;
      P.sy[n] = V.horizon - V.fy * (track.y1(i) - camY) * s;
      P.sw[n] = V.fx * ROAD_HALF * s;
      P.z[n] = z;
      P.idx[n] = i;
      x += dx;
      dx += track.curve(i);
    }
    cam.base = base;
  }
  // the road's curve offset (world x of its middle) at a z, between the projected edges
  function curveXAt(z) {
    const f = (z - cam.base * SEG) / SEG;
    const n = Math.floor(f);
    if (n < 0) return P.cw[0];
    if (n >= N - 1) return P.cw[N - 1];
    return P.cw[n] + (P.cw[n + 1] - P.cw[n]) * (f - n);
  }

  let lastMaxy = 0;
  function clipRoad(H) {
    let maxy = H;
    runs = 0;
    let lastZ = -1, lastK = -1;
    for (let n = 0; n < N - 1; n++) {
      const i = P.idx[n];
      const zone = zoneOfIndex(i);
      const look = LOOKS[zone];
      P.zi[n] = ZI[zone];
      P.k[n] = Math.min(FOG_STEPS - 1, Math.floor((n / DRAW) * FOG_STEPS * look.fogDensity));
      P.alt[n] = Math.floor(i / 3) & 1;
      P.clip[n] = maxy;
      P.vis[n] = 0;
      if (P.z[n + 1] <= NEAR) continue;
      const y1 = P.sy[n], y2 = P.sy[n + 1];
      if (y2 >= maxy || y2 >= y1 - 0.01) continue;
      P.vis[n] = 1;
      if (y1 > maxy) {
        const t = (maxy - y2) / (y1 - y2);
        P.nx[n] = P.sx[n + 1] + (P.sx[n] - P.sx[n + 1]) * t;
        P.nw[n] = P.sw[n + 1] + (P.sw[n] - P.sw[n + 1]) * t;
        P.ny[n] = maxy;
      } else { P.nx[n] = P.sx[n]; P.nw[n] = P.sw[n]; P.ny[n] = y1; }
      maxy = y2;
      if (P.zi[n] !== lastZ || P.k[n] !== lastK) {
        if (runs) runEnd[runs - 1] = n;
        runStart[runs] = n; runZ[runs] = P.zi[n]; runK[runs] = P.k[n]; runs++;
        lastZ = P.zi[n]; lastK = P.k[n];
      }
    }
    if (runs) runEnd[runs - 1] = N - 1;
    lastMaxy = maxy;
  }

  // a band of road between two fractions of its half width (a < b), from segment n's near edge to its far edge
  function band(n, a, b) {
    const x1 = P.nx[n], w1 = P.nw[n], y1 = P.ny[n], x2 = P.sx[n + 1], w2 = P.sw[n + 1], y2 = P.sy[n + 1];
    const l1 = x1 + a * w1, r1 = x1 + b * w1, l2 = x2 + a * w2, r2 = x2 + b * w2;
    if ((l1 > V.w && l2 > V.w) || (r1 < 0 && r2 < 0)) return;
    g.moveTo(l1, y1 + 0.6); g.lineTo(r1, y1 + 0.6); g.lineTo(r2, y2); g.lineTo(l2, y2); g.closePath();
  }

  // a thin strip between two fractions of the half width, along segments a..b (split where a hill hides the road)
  function ribbon(a, b, f0, f1) {
    let n = a;
    while (n < b) {
      while (n < b && !P.vis[n]) n++;
      if (n >= b) return;
      let m = n;
      while (m < b && P.vis[m] && (m === n || P.ny[m] >= P.sy[m] - 0.5)) m++;
      // near edge of n (clipped), far edges of n..m-1
      const nearL = P.nx[n] + f0 * P.nw[n], nearR = P.nx[n] + f1 * P.nw[n];
      const farL = P.sx[m] + f0 * P.sw[m], farR = P.sx[m] + f1 * P.sw[m];
      if (!((nearL > V.w && farL > V.w) || (nearR < 0 && farR < 0))) {
        g.moveTo(nearL, P.ny[n] + 0.6);
        for (let k = n + 1; k <= m; k++) g.lineTo(P.sx[k] + f0 * P.sw[k], P.sy[k]);
        for (let k = m; k > n; k--) g.lineTo(P.sx[k] + f1 * P.sw[k], P.sy[k]);
        g.lineTo(nearR, P.ny[n] + 0.6);
        g.closePath();
      }
      n = m;
    }
  }

  // the ground on one side of segment n: from the screen's edge to the road's edge plus `pad` (half widths)
  function side(n, left, pad) {
    const x1 = P.nx[n], w1 = P.nw[n], y1 = P.ny[n], x2 = P.sx[n + 1], w2 = P.sw[n + 1], y2 = P.sy[n + 1];
    const f = 1 + RUMBLE - pad;
    if (left) {
      const e1 = x1 - f * w1, e2 = x2 - f * w2;
      if (e1 <= 0 && e2 <= 0) return;
      g.moveTo(-2, y2); g.lineTo(e2, y2); g.lineTo(e1, y1 + 1); g.lineTo(-2, y1 + 1); g.closePath();
    } else {
      const e1 = x1 + f * w1, e2 = x2 + f * w2;
      if (e1 >= V.w && e2 >= V.w) return;
      g.moveTo(e2, y2); g.lineTo(V.w + 2, y2); g.lineTo(V.w + 2, y1 + 1); g.lineTo(e1, y1 + 1); g.closePath();
    }
  }

  function drawRoad() {
    const W = V.w;
    for (let r = 0; r < runs; r++) {
      const C = COLORS[ZONES[runZ[r]]], k = runK[r], a = runStart[r], b = runEnd[r];
      const coast = Boolean(C.groundR);
      // the ground on both sides (sand and sea on the coast)
      for (let alt = 0; alt < 2; alt++) {
        g.beginPath();
        for (let n = a; n < b; n++) if (P.vis[n] && (Math.floor(P.idx[n] / 6) & 1) === alt) { side(n, true, 0.04); if (!coast) side(n, false, 0.04); }
        g.fillStyle = C.ground[alt][k]; g.fill();
        if (coast) {
          g.beginPath();
          for (let n = a; n < b; n++) if (P.vis[n] && (Math.floor(P.idx[n] / 6) & 1) === alt) side(n, false, 0.04);
          g.fillStyle = C.groundR[alt][k]; g.fill();
        }
      }
      if (coast) {
        // lines of surf along the shore, drifting
        g.beginPath();
        for (let n = a; n < b; n++) if (P.vis[n] && P.idx[n] % 9 < 2) { band(n, 1.5, 1.62); band(n, 2.6, 2.7); band(n, 4.1, 4.2); }
        g.fillStyle = C.foam[k]; g.fill();
      }
      if (C.grid) {
        g.beginPath();
        // each line along the ground as one ribbon over the run's visible stretch (near to far, and back)
        const end = Math.min(b, GRID_FAR);
        for (const f0 of GRID_F) for (const f of [f0, -f0]) ribbon(a, end, f - 0.022, f + 0.022);
        for (let n = a; n < b; n++) {
          if (!P.vis[n]) continue;
          if (P.idx[n] % 6 === 0) {
            const y2 = P.sy[n + 1], h = Math.max(1, P.sw[n + 1] * 0.012), e = P.sw[n + 1] * (1 + RUMBLE);
            g.rect(0, y2 - 0.5, Math.max(0, P.sx[n + 1] - e), h); g.rect(P.sx[n + 1] + e, y2 - 0.5, Math.max(0, W - P.sx[n + 1] - e), h);
          }
        }
        g.fillStyle = C.grid[k]; g.fill();
      }
      // rumble strips, then the road over their inner edge, then its lines
      for (let alt = 0; alt < 2; alt++) {
        g.beginPath();
        for (let n = a; n < b; n++) if (P.vis[n] && P.alt[n] === alt) { band(n, RUMBLE_IN, 1 + RUMBLE); band(n, -1 - RUMBLE, -RUMBLE_IN); }
        g.fillStyle = C.rumble[alt][k]; g.fill();
      }
      for (let alt = 0; alt < 2; alt++) {
        g.beginPath();
        for (let n = a; n < b; n++) if (P.vis[n] && P.alt[n] === alt) band(n, -1, 1);
        g.fillStyle = C.road[alt][k]; g.fill();
      }
      if (C.shine) {
        // the wet road's shine: a few lighter streaks
        g.beginPath();
        for (let n = a; n < b; n++) if (P.vis[n] && P.idx[n] % 5 === 0) { band(n, -0.78, -0.62); band(n, 0.18, 0.34); }
        g.fillStyle = C.shine[k]; g.fill();
      }
      g.beginPath();
      for (let n = a; n < b; n++) if (P.vis[n]) { band(n, EDGE_IN, EDGE_OUT); band(n, -EDGE_OUT, -EDGE_IN); }
      g.fillStyle = C.edge[k]; g.fill();
      g.beginPath();
      for (let n = a; n < b; n++) if (P.vis[n] && P.idx[n] % 8 < 3) for (const f of LANES_F) band(n, f - LANE_LINE, f + LANE_LINE);
      g.fillStyle = C.lane[k]; g.fill();
    }
  }

  // ---------- sprites ----------
  function level(sp, dw) {
    const want = dw * V.dpr;
    const L = sp.levels;
    let i = L.length - 1;
    while (i > 0 && L[i].width < want) i--;
    return L[i];
  }
  // draw a sprite standing at (x, y) with `s` px per world unit, cut off below clipY
  function drawSprite(sp, x, y, s, clipY, alpha = 1, scaleW = 1) {
    const dw = sp.ww * s * scaleW;
    if (dw < 0.7) return;
    const dh = dw * (sp.h / sp.w);
    const dx = x - dw * sp.ax, dy = y - dh * sp.ay;
    if (dx > V.w || dx + dw < 0 || dy > V.h || dy + dh < 0 || dy >= clipY) return;
    const img = level(sp, dw);
    let sh = img.height, ddh = dh;
    const over = dy + dh - clipY;
    if (over > 0) { ddh = dh - over; sh = img.height * (ddh / dh); }
    if (sh < 0.5) return;
    if (alpha < 1) g.globalAlpha = alpha;
    g.drawImage(img, 0, 0, img.width, sh, dx, dy, dw, ddh);
    if (alpha < 1) g.globalAlpha = 1;
  }
  function glowAt(img, x, y, r, alpha) {
    if (r < 0.6 || alpha <= 0.01) return;
    if (r > 150) { alpha *= 150 / r; r = 150; }
    g.globalAlpha = alpha;
    g.drawImage(img, x - r, y - r, r * 2, r * 2);
  }

  const fogAlpha = (n, dens) => clamp((DRAW * 0.97 / dens - n) / (DRAW * 0.36 / dens), 0, 1);

  function propSprite(kind, v, zone) {
    switch (kind) {
      case 'palm': return sprites.palm.dusk;
      case 'palmC': return sprites.palm.coast;
      case 'lampL': return sprites.lampL;
      case 'lampR': return sprites.lampR;
      case 'neon': return sprites.neon[v % sprites.neon.length];
      case 'billboard': return sprites.billboard[v % sprites.billboard.length];
      case 'building': return sprites.building[v % sprites.building.length];
      case 'gantry': return sprites.gantry[v % sprites.gantry.length];
      case 'gate': return sprites.gate;
      default: return sprites[kind] || null;
    }
  }

  // ---------- the robotaxi ----------
  function playerFrames(px) {
    const want = Math.round(px * V.dpr);
    if (!playerImgs || Math.abs(want - playerPx) > Math.max(6, playerPx * 0.06)) {
      playerPx = want;
      playerImgs = [-1, -0.5, 0, 0.5, 1].map((l) => playerSprite(want, l));
    }
    return playerImgs;
  }

  function drawPlayer(run, f, x, y, s, lights) {
    const sp = playerFrames(PLAYER.halfW * 2 * s * (216 / 200))[clamp(Math.round((run.lean + 1) * 2), 0, 4)];
    const dw = sp.ww * s, dh = dw * (sp.h / sp.w);
    // its shadow, and its neon underglow
    g.globalAlpha = 0.9;
    g.drawImage(sprites.shadow, x - dw * 0.6, y - dw * 0.08, dw * 1.2, dw * 0.3);
    if (lights > 0.2) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * lights;
      g.drawImage(sprites.glow.mint, x - dw * 0.62, y - dw * 0.1, dw * 1.24, dw * 0.24);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
    // the boost's exhaust: a flickering plasma tail
    if (f.boost > 0.02) {
      g.globalCompositeOperation = 'lighter';
      const flick = 0.75 + 0.25 * Math.sin(f.time * 61) * Math.sin(f.time * 37);
      const L = dw * (0.32 + 0.18 * flick) * f.boost;
      for (const side of [-1, 1]) {
        g.globalAlpha = 0.9 * f.boost;
        g.drawImage(sprites.glow.pink, x + side * dw * 0.24 - dw * 0.09, y - dh * 0.1, dw * 0.18, L);
        g.globalAlpha = 0.7 * f.boost;
        g.drawImage(sprites.glow.mint, x + side * dw * 0.24 - dw * 0.05, y - dh * 0.08, dw * 0.1, L * 0.7);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // spinning out: a wobble; wrecked: a tumble
    let rot = run.lean * 0.045 + f.tilt, sx = 1, lift = f.bounce;
    if (run.spin > 0 && !run.over) { const p = run.spin; rot += Math.sin(p * 22) * 0.28 * Math.min(1, p * 2) * run.spinDir; sx = 1 - 0.18 * Math.abs(Math.sin(p * 11)); }
    if (run.over) { const t = Math.min(1, run.overT / 1.1); rot += run.spinDir * (t * Math.PI * 2.4); lift += Math.sin(Math.min(1, run.overT / 0.9) * Math.PI) * dh * 0.55; }
    let alpha = 1;
    // ghosting after a hit: it blinks (steadily see-through with "reduce motion": no strobing)
    if (run.grace > 0 && !run.over && run.boostT <= 0) alpha = REDUCED ? 0.55 : Math.floor(f.time * 14) % 2 ? 0.35 : 0.95;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y - lift - dh * 0.45);
    g.rotate(rot);
    g.scale(sx * f.squash, 1 / f.squash);
    g.drawImage(sp.canvas, -dw / 2, -dh * 0.55, dw, dh);
    g.restore();
    // its tail lights glow at night
    if (lights > 0.2 && alpha > 0.5) {
      g.globalCompositeOperation = 'lighter';
      const ty = y - lift - dh * 0.4;
      glowAt(sprites.glow.pink, x, ty, dw * 0.55, 0.5 * lights);
      glowAt(sprites.glow.honey, x + Math.sin(rot) * dh * 0.4, y - lift - dh * 0.9, dw * 0.16, 0.6 * lights);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    return { x, y: y - lift, w: dw, h: dh };
  }

  // ---------- one frame ----------
  // f: { view, alpha (between steps), time, boost (0..1 eased), shake {x, y, r}, tilt, bounce, squash, flash }
  function draw(run, f) {
    const base = f.view;
    V = zoomView(base, 1 - 0.16 * f.boost * (REDUCED ? 0.3 : 1), zv);
    V.dpr = base.dpr;
    const { track, traffic } = run;
    const a = f.alpha;
    const pz = run.prevZ + (run.z - run.prevZ) * a;
    const px = run.prevX + (run.x - run.prevX) * a;
    const roadY = track.yAt(pz);
    cam.z = pz - V.camBack;
    cam.y = roadY + CAM_H;
    // curve offsets first (they don't depend on the camera's x), then the camera's x, then the projection
    projectRoad(track, cam.z, cam.y, 0);
    const roadMid = curveXAt(pz);
    cam.x = roadMid + px * V.follow;
    for (let n = 0; n < N; n++) { const s = 1 / Math.max(NEAR, P.z[n]); P.sx[n] -= V.fx * cam.x * s; }
    clipRoad(V.h);

    // the sky: this zone's, fading into the next one's just after a gate
    const zone = zoneOfIndex(Math.floor(pz / SEG));
    const prevZone = f.fromZone && f.fromZone !== zone ? f.fromZone : null;
    const lift = clamp(-roadY / 4200, -1, 1) * 10;
    g.save();
    if (f.shake) { g.translate(V.cx, V.horizon); g.rotate(f.shake.r); g.translate(-V.cx + f.shake.x, -V.horizon + f.shake.y); }
    if (prevZone && f.zoneFade < 1) {
      scenery.draw(g, prevZone, V, { pan: f.pan, lift, time: f.time, alpha: 1 });
      scenery.draw(g, zone, V, { pan: f.pan, lift, time: f.time, alpha: f.zoneFade, flash: f.flash });
    } else scenery.draw(g, zone, V, { pan: f.pan, lift, time: f.time, alpha: 1, flash: f.flash });
    // the far ground under the horizon, then the road
    const C = COLORS[zone];
    const reach = Math.max(V.horizon, lastMaxy) + 2;
    g.fillStyle = C.farGround;
    g.fillRect(-20, V.horizon - 1, V.w + 40, reach - V.horizon + 1);
    if (C.farGroundR) { const mid = P.sx[N - 1]; g.fillStyle = C.farGroundR; g.fillRect(mid, V.horizon - 1, V.w - mid + 20, reach - V.horizon + 1); }
    drawRoad();

    // what stands on the road, far to near
    used = 0;
    for (let n = 0; n < N; n++) bucket[n].length = 0;
    const put = (kind, ref, z, x) => {
      const nn = Math.floor((z - cam.base * SEG) / SEG);
      if (nn < 0 || nn >= N - 1 || used >= pool.length) return;
      const t = pool[used++]; t.kind = kind; t.ref = ref; t.z = z; t.x = x;
      bucket[nn].push(t);
    };
    for (const c of traffic.cars) put(1, c, c.prevZ + (c.z - c.prevZ) * a, c.prevX + (c.x - c.prevX) * a);
    for (const it of traffic.items) if (!it.taken) put(2, it, it.z, it.x);
    put(3, run, pz, px);

    const look = LOOKS[zone];
    const lights = look.lights;
    let playerBox = null;
    for (let n = N - 2; n >= 0; n--) {
      const zFar = P.z[n];
      if (P.z[n + 1] <= NEAR) continue;
      const clipY = P.clip[n];
      const segZone = ZONES[P.zi[n]];
      const dens = LOOKS[segZone].fogDensity;
      const fa = fogAlpha(n, dens);
      // the scenery by the road
      if (zFar > NEAR && fa > 0.02) {
        const cnt = decorAt(P.idx[n], segZone, track.curve(P.idx[n]), decor);
        const s = P.sw[n] / ROAD_HALF;
        for (let d = 0; d < cnt; d++) {
          const o = decor[d];
          const sp = propSprite(o.kind, o.v, segZone);
          if (!sp) continue;
          const x = P.sx[n] + o.x * s;
          let pa = fa;
          if (P.z[n] < V.camBack && lastPlayer.w) {
            // nearer than the robotaxi and over it: see-through, so it never hides her
            const dw = sp.ww * s * 0.5;
            if (Math.abs(x - sp.ax * 0 - lastPlayer.x) < dw + lastPlayer.w * 0.5) pa = Math.min(pa, 0.32);
          }
          drawSprite(sp, x, P.sy[n], s, clipY, pa);
          if ((o.kind === 'lampL' || o.kind === 'lampR') && LOOKS[segZone].lights > 0.5) {
            const dw = sp.ww * s, dh = dw * (sp.h / sp.w);
            const hx = x - dw * sp.ax + dw * sp.head[0], hy = P.sy[n] - dh + dh * sp.head[1];
            if (hy < clipY) {
              g.globalCompositeOperation = 'lighter';
              glowAt(sprites.glow.honey, hx, hy, dw * 0.34, 0.75 * fa);
              g.globalCompositeOperation = 'source-over';
              g.globalAlpha = 1;
            }
          }
        }
      }
      const B = bucket[n];
      if (!B.length) continue;
      if (B.length > 1) B.sort(byFar);
      for (const t of B) {
        const relZ = t.z - cam.z;
        if (relZ <= NEAR) continue;
        const s = 1 / relZ;
        const mid = curveXAt(t.z);
        const x = V.cx + V.fx * (mid + t.x - cam.x) * s;
        const yW = track.yAt(t.z);
        let y = V.horizon - V.fy * (yW - cam.y) * s;
        const sc = V.fx * s;
        if (t.kind === 1) {
          const c = t.ref;
          const sp = sprites.cars[c.type][c.paint];
          const dw = sp.ww * sc, dh = dw * (sp.h / sp.w);
          if (x + dw < -20 || x - dw > V.w + 20) continue;
          if (c.flying) {
            const fy = c.fly.y * (V.fy / V.fx) * sc;
            g.save();
            g.globalAlpha = Math.max(0, 1 - c.fly.t / 1.5) * fa;
            g.translate(x, y - fy - dh * 0.5);
            g.rotate(c.fly.rot);
            g.drawImage(level(sp, dw), -dw / 2, -dh / 2, dw, dh);
            g.restore();
            continue;
          }
          // its shadow (and its tail lights' reflection on a wet road)
          if (y - dh * 0.1 < clipY) {
            g.globalAlpha = 0.85 * fa;
            g.drawImage(sprites.shadow, x - dw * 0.58, y - dw * 0.09, dw * 1.16, Math.min(dw * 0.26, Math.max(0, clipY - y + dw * 0.09)));
            g.globalAlpha = 1;
          }
          if (look.wet && fa > 0.1 && y < clipY) {
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.35 * fa;
            g.drawImage(sprites.glow.tail, x - dw * 0.4, y - dw * 0.04, dw * 0.8, Math.min(dw * 0.7, clipY - y));
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
          }
          drawSprite(sp, x, y, sc, clipY, fa);
          const L = LOOKS[segZone].lights;
          const ts = TAIL_SPOTS[c.type];
          if (L > 0.2 && y - dh * (1 - ts[2]) < clipY) {
            g.globalCompositeOperation = 'lighter';
            const ty = y - dh * (1 - ts[2]), r = dw * 0.2;
            glowAt(sprites.glow.tail, x - dw / 2 + dw * ts[0], ty, r, 0.75 * L * fa);
            if (ts[1] !== ts[0]) glowAt(sprites.glow.tail, x - dw / 2 + dw * ts[1], ty, r, 0.75 * L * fa);
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
          }
          // the blinker, on the side it's moving to
          if ((c.blinkT > 0 || c.shiftT > 0) && Math.floor(f.time * 5.5) % 2 === 0) {
            const side = Math.sign(c.laneTo - c.lane) || 1;
            const bx = x + side * dw * 0.47, by = y - dh * (1 - ts[2]) - dh * 0.06;
            if (by < clipY) {
              g.globalCompositeOperation = 'lighter';
              glowAt(sprites.glow.honey, bx, by, Math.max(4, dw * 0.24), fa);
              g.globalCompositeOperation = 'source-over';
              g.globalAlpha = fa;
              g.fillStyle = HONEY; g.beginPath(); g.arc(bx, by, Math.max(1.5, dw * 0.045), 0, Math.PI * 2); g.fill();
              g.lineWidth = Math.max(1, dw * 0.014); g.strokeStyle = INK; g.stroke();
              g.globalAlpha = 1;
            }
          }
        } else if (t.kind === 2) {
          const it = t.ref;
          const sp = it.kind === 'fare' ? sprites.fare : sprites.shield;
          const bob = Math.sin(it.t * 3.2) * 70 + 260;
          const hy = bob * (V.fy / V.fx) * sc;
          // its ring on the road
          if (y < clipY) {
            g.globalAlpha = 0.55 * fa;
            g.strokeStyle = it.kind === 'fare' ? PINK : MINT;
            g.lineWidth = Math.max(1, sc * 50);
            const pulse = 1 + 0.12 * Math.sin(it.t * 6);
            g.beginPath(); g.ellipse(x, y, sc * 420 * pulse, sc * 420 * pulse * 0.22 * (V.fy / V.fx), 0, 0, Math.PI * 2); g.stroke();
            g.globalAlpha = 1;
          }
          g.globalCompositeOperation = 'lighter';
          glowAt(it.kind === 'fare' ? sprites.glow.pink : sprites.glow.mint, x, y - hy - sp.ww * sc * 0.6, sp.ww * sc * 0.9, 0.5 * fa);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1;
          drawSprite(sp, x, y - hy, sc, clipY + 9999, fa);
        } else if (t.kind === 3) {
          y = V.carY;
          const s0 = V.fx / V.camBack;
          playerBox = drawPlayer(run, f, V.cx + V.fx * (roadMid + px - cam.x) / V.camBack, y, s0, lights);
          lastPlayer.x = playerBox.x; lastPlayer.y = playerBox.y; lastPlayer.w = playerBox.w; lastPlayer.h = playerBox.h;
        }
      }
    }
    g.restore();
    return playerBox;
  }

  // where a world point is on screen right now (for particles and words that start at a car or a pin)
  function toScreen(run, z, x, h = 0) {
    if (!V) return null;
    const relZ = z - cam.z;
    if (relZ <= NEAR) return null;
    const s = 1 / relZ;
    pr.x = V.cx + V.fx * (curveXAt(z) + x - cam.x) * s;
    pr.y = V.horizon - V.fy * (run.track.yAt(z) + h - cam.y) * s;
    pr.s = V.fx * s;
    return pr;
  }

  return { draw, toScreen, get view() { return V; }, resetScenery: () => scenery.clear() };
}

const byFar = (a, b) => b.z - a.z;
export { PINK, PAPER, INK };
