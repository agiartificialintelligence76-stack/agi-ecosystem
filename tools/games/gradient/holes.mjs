// GRADIENT DESCENT's hole checker (2026-11-08): for every hole (or the ones named), is the cup its lowest point, how
// does the demo's AI play it (strokes against par, and how long its search takes), and a top-down map as a PNG
// (the colour scale, contour lines, the start, the cup, the hazards) to look at while designing.
//   node tools/games/gradient/holes.mjs [--out <dir>] [--only banana,ridge] [--daily 2026-11-08] [--noai]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { HOLES } from '../../../src/games/gradient/holes.js';
import { buildHole, lowestPoint } from '../../../src/games/gradient/course.js';
import { playHole } from '../../../src/games/gradient/ai.js';
import { simulate } from '../../../src/games/gradient/physics.js';
import { dailyDef } from '../../../src/games/gradient/daily.js';
import { rng } from '../../../src/games/kit/fx.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', null);
const only = opt('only', '') ? opt('only', '').split(',') : null;
const noai = args.includes('--noai');
const ace = args.includes('--ace');
if (out) mkdirSync(out, { recursive: true });

const STOPS = [[0, '#1b0f52'], [0.2, '#2f2a9e'], [0.4, '#1585a8'], [0.56, '#2fd3ae'], [0.72, '#ffc933'], [0.87, '#ff8a5c'], [1, '#ff4da6']];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function cmap(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const k = (t - a) / (b - a), A = hex(ca), B = hex(cb);
      return A.map((v, j) => v + (B[j] - v) * k);
    }
  }
  return hex(STOPS[STOPS.length - 1][1]);
}

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function render(hole, path, shots = []) {
  const S = 22;                            // pixels per unit
  const [hx, hz] = hole.half;
  const W = Math.round(hx * 2 * S), H = Math.round(hz * 2 * S);
  const rgb = Buffer.alloc(W * H * 3);
  const hs = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hs[y * W + x] = hole.field.h(-hx + (x + 0.5) / S, -hz + (y + 0.5) / S);
  const span = hole.hmax - hole.hmin;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const h = hs[y * W + x];
    let c = cmap((h - hole.hmin) / span);
    // contour lines: where the band index changes between neighbours
    const b = Math.floor(h / hole.contour);
    const r = x + 1 < W ? Math.floor(hs[y * W + x + 1] / hole.contour) : b, d = y + 1 < H ? Math.floor(hs[(y + 1) * W + x] / hole.contour) : b;
    if (r !== b || d !== b) c = c.map((v) => v * 0.35);
    const px = -hx + (x + 0.5) / S, pz = -hz + (y + 0.5) / S;
    for (const s of hole.sticky) if (((px - s.x) / s.rx) ** 2 + ((pz - s.z) / s.rz) ** 2 < 1 && ((x + y) % 8) < 3) c = [220, 210, 255];
    for (const p of hole.pits) if ((px - p.x) ** 2 + (pz - p.z) ** 2 < p.r ** 2) c = [0, 0, 0];
    for (const p of hole.posts) if ((px - p.x) ** 2 + (pz - p.z) ** 2 < p.r ** 2) c = [255, 250, 240];
    if ((px - hole.cup[0]) ** 2 + (pz - hole.cup[1]) ** 2 < 0.56 ** 2) c = [255, 255, 255];
    if ((px - hole.start[0]) ** 2 + (pz - hole.start[1]) ** 2 < 0.3 ** 2) c = [255, 201, 51];
    for (const s of shots) if ((px - s.x) ** 2 + (pz - s.z) ** 2 < 0.18 ** 2) c = [255, 120, 0];
    rgb[(y * W + x) * 3] = c[0]; rgb[(y * W + x) * 3 + 1] = c[1]; rgb[(y * W + x) * 3 + 2] = c[2];
  }
  writeFileSync(path, png(W, H, rgb));
}

const defs = HOLES.filter((h) => !only || only.includes(h.id));
const dailyKey = opt('daily', null);
if (dailyKey) defs.push(dailyDef(dailyKey));
let total = 0, totalPar = 0;
for (const def of defs) {
  const hole = buildHole(def);
  const low = lowestPoint(hole);
  const off = Math.hypot(low.x - hole.cup[0], low.z - hole.cup[1]);
  let line = `${String(def.course ?? 'D')}.${(def.index ?? 0) + 1} ${def.id.padEnd(11)} par ${def.par}  h ${hole.hmin.toFixed(2)}..${hole.hmax.toFixed(2)}  cup (${hole.cup.map((v) => v.toFixed(2))}) lowest (${low.x.toFixed(2)}, ${low.z.toFixed(2)}) ${off < 0.35 ? 'ok' : `OFF by ${off.toFixed(2)}`}`;
  let shots = [];
  if (ace) {
    // how often a putt from the tee drops: every 1° within ±40° of the cup's direction, every 2.5% of power
    const base = Math.atan2(hole.cup[1] - hole.start[1], hole.cup[0] - hole.start[0]);
    let n = 0, sunk = 0, pit = 0;
    for (let d = -40; d <= 40; d += 1) for (let p = 0.05; p <= 1.0001; p += 0.025) {
      const r = simulate(hole, hole.start[0], hole.start[1], base + d * Math.PI / 180, p);
      n++; if (r.done === 'sink') sunk++; if (r.done === 'pit') pit++;
    }
    line += `  ace ${(100 * sunk / n).toFixed(2)}% pit ${(100 * pit / n).toFixed(0)}%`;
  }
  if (!noai) {
    const t0 = performance.now();
    const r = playHole(hole, { rand: rng(7), noise: 0 });
    const ms = performance.now() - t0;
    shots = r.shots;
    total += r.strokes; totalPar += def.par;
    line += `  AI ${r.strokes}${r.sunk ? '' : ' (no sink)'} [${r.shots.map((s) => `${(s.power * 100).toFixed(0)}%${s.done[0]}`).join(' ')}] ${ms.toFixed(0)} ms`;
  }
  console.log(line);
  if (out) render(hole, `${out}/${def.id}.png`, shots);
}
if (!noai) console.log(`AI total ${total} vs par ${totalPar}`);
