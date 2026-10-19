// The roadmap's video, scenes 2–4 (4–20 s): the road, one world seen by one moving camera (the roadmap page's timeline,
// laid on its side): "Live now", 01 Talk to AGI-1 and 02 AGI Studio landing and checked; "We're here", then "What's next"
// with the page's note (in no particular order), 03 to 09 in three holds (03–05, 06–08, 09), each stamped COMING SOON or
// UNDER WAY as the page marks it; then the lights go down on the locked 10 (18+ ???, its lock rattling), and the camera
// pulls back to the whole road: 2 of 10 live now.
// Its words are the page's own (words.js). Ten stops since 2026-10-19 (six before).
import { C, E, prog, clamp, mix, popK, slamK, around, life, stepCard, layout, node, stepNumber, stampOn, herePin, meter, measure, popWord, pill, CARD } from '../parts.js';
import { halftone } from '../../../promo/page/kit.js';
import { burst } from '../../../promo/page/ui.js';
import { STEPS, LABELS, NOTE } from '../../words.js';

// ---------- the world (its own units: one is a pixel at the camera's zoom 1) ----------
export const ROAD_Y = 700;
const CAP_X = 120, END_X = 6000;
export const STOPS = { '01': 520, '02': 1080, '03': 1880, '04': 2400, '05': 2920, '06': 3440, '07': 3960, '08': 4480, '09': 5000, '10': 5680 };
export const HERE_X = 1460;
const CARD_BOTTOM = 640;           // every card hangs at the same height above the road
const NUM_Y = 838;
// what's next: every step after "We're here" but the locked one, in the page's order (03…09); and the locked one
export const NEXT = STEPS.filter((s) => s.state !== 'live' && s.state !== 'locked').map((s) => s.n);
const LAST = STEPS.at(-1);

let faceImg = null;
export async function prepare(ctx) {
  faceImg = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/images/landing/agi1-face.webp'; });
  ctx.faceImg = faceImg;
}

// ---------- its camera: where it looks (cx, cy) and how close (z), from one key to the next ----------
// live now (01, 02) · "We're here" · what's next in three holds (03–05 around 2400, 06–08 around 3960, 09 at 5000), each
// a quick pan from the last · the locked 10, close · the whole road at once
const CAM = [
  [4.0, 790, 545, 1.15],
  [7.5, 850, 545, 1.15, E.lin],
  [8.0, 1400, 500, 1.1, E.inOutCubic],
  [9.0, 2400, 480, 1.0, E.inOutCubic],
  [11.0, 2440, 480, 1.0, E.lin],
  [11.5, 3960, 480, 1.0, E.inOutCubic],
  [13.75, 4000, 480, 1.0, E.lin],
  [14.25, 5000, 480, 1.05, E.inOutCubic],
  [15.5, 5020, 480, 1.05, E.lin],
  [16.0, 5680, 520, 1.34, E.inOutCubic],
  [18.5, 5680, 516, 1.44, E.lin],
  // the whole road, in the middle of what's left under the meter (cy 300: the road at about y 660 on screen; at cy 600
  // it sat at y 570, with the lower half of the picture empty)
  [19.4, 3060, 300, 0.30, E.inOutCubic],
  [20.0, 3060, 300, 0.296, E.lin],
];
export function camAt(t) {
  if (t <= CAM[0][0]) return { cx: CAM[0][1], cy: CAM[0][2], z: CAM[0][3] };
  for (let i = 1; i < CAM.length; i++) {
    const [t1, x1, y1, z1, ease] = CAM[i];
    if (t <= t1) {
      const [t0, x0, y0, z0] = CAM[i - 1];
      const p = ease(prog(t, t0, t1));
      return { cx: mix(x0, x1, p), cy: mix(y0, y1, p), z: z0 * (z1 / z0) ** p };      // zoom on a log scale: an even speed
    }
  }
  const last = CAM.at(-1);
  return { cx: last[1], cy: last[2], z: last[3] };
}
// a world point on screen
export const toScreen = (c, cam, x, y) => ({ x: (x - cam.cx) * cam.z + c.W / 2, y: (y - cam.cy) * cam.z + c.H / 2 });
// how far the picture moves on screen in `dt` seconds (the most of its middle and two corners), in pixels
export function camShift(c, t, dt) {
  const a = camAt(t - dt), b = camAt(t);
  let d = 0;
  for (const [sx, sy] of [[c.W / 2, c.H / 2], [0, 0], [c.W, c.H]]) {
    const p = toScreen(c, a, (sx - c.W / 2) / b.z + b.cx, (sy - c.H / 2) / b.z + b.cy);
    d = Math.max(d, Math.hypot(p.x - sx, p.y - sy));
  }
  return d;
}
// motion blur where the camera whips: main.js draws what the camera sees once, then lays copies of it over each other
// as the camera saw it at moments across the frame's shutter (half a frame), so it smears along the camera's own move
// (its pan and its zoom). blurAt: how many copies (one for every 2.5 px the picture moves while the shutter is open, at
// most 40; 1 = no blur). camWarp: where a copy goes, the picture at t as the camera saw it at ts (a scale about the
// screen's middle, and a shift)
export const SHUTTER = 0.5 / 60;
export function blurAt(t, c) {
  const smear = camShift(c, t + SHUTTER / 2, SHUTTER);
  return smear < 2 ? 1 : Math.min(40, Math.ceil(smear / 2.5) + 1);
}
export function camWarp(c, t, ts) {
  const a = camAt(t), b = camAt(ts);
  return { k: b.z / a.z, dx: (a.cx - b.cx) * b.z, dy: (a.cy - b.cy) * b.z };
}

// ---------- when each part comes in ----------
function times(M) {
  const [a, b] = STEPS;
  const node = { [a.n]: M.nodes[0], [b.n]: M.nodes[1] };
  const card = { [a.n]: M.cards[0], [b.n]: M.cards[1] };
  const stamp = {};
  NEXT.forEach((n, k) => { node[n] = M.nextCards[k] - 0.06; card[n] = M.nextCards[k]; stamp[n] = M.stamps[k]; });
  node[LAST.n] = M.lock; card[LAST.n] = M.lock;
  return {
    line: [M.drop, M.drop + 0.7],
    // the coming road draws on in four goes, [from, to, where it reaches]: past the first hold, the second, toward the
    // locked stop, then to its end as the lock slams in
    dash: [
      [M.drop2, M.drop2 + 1.4, STOPS[NEXT[2]] + 380],
      [M.panB, M.panB + 0.8, STOPS[NEXT[5]] + 380],
      [M.panC, M.panC + 0.6, STOPS[LAST.n] - 150],
      [M.pan2, M.lock, END_X],
    ],
    node, card, stamp,
    check: { [a.n]: M.checks[0], [b.n]: M.checks[1] },
    pulse: Object.fromEntries(STEPS.map((s, k) => [s.n, M.pulses[k]])),
    dark: [M.lock, M.lock + 0.3, M.zoomOut, M.zoomOut + 0.55],
  };
}

function background(g, c, cam) {
  const { W, H } = c;
  g.fillStyle = C.lav;
  g.fillRect(0, 0, W, H);
  // the page's faint dots, moving a little slower than the road (depth)
  const cell = 24, ry = cell * 0.7071 * 2;
  const tile = halftone(W + cell * 2, H + ry * 2, cell, 'rgba(23,10,54,0.07)', 0.16);
  const ox = ((cam.cx * cam.z * 0.45) % cell + cell) % cell, oy = ((cam.cy * cam.z * 0.45) % ry + ry) % ry;
  g.drawImage(tile, -ox - cell, -oy - ry);
}

// the road itself: violet where it's live (from its honey cap to "We're here"), ink dashes after, slowly moving
function road(g, t, T) {
  const lp = E.outCubic(prog(t, T.line[0], T.line[1]));
  if (lp > 0) {
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = C.violet; g.lineWidth = 9;
    g.beginPath(); g.moveTo(CAP_X, ROAD_Y); g.lineTo(mix(CAP_X, HERE_X, lp), ROAD_Y); g.stroke();
    g.restore();
  }
  let dEnd = HERE_X;
  for (const [a, b, x] of T.dash) dEnd = mix(dEnd, x, E.inOutQuad(prog(t, a, b)));
  if (dEnd > HERE_X + 0.5) {
    g.save();
    g.setLineDash([18, 14]); g.lineDashOffset = -t * 22;
    g.strokeStyle = 'rgba(23,10,54,0.45)'; g.lineWidth = 6; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(HERE_X, ROAD_Y); g.lineTo(dEnd, ROAD_Y); g.stroke();
    g.restore();
  }
  // its cap: a honey dot ringed in lavender
  const ck = popK(t, T.line[0], 0.4);
  around(g, CAP_X, ROAD_Y, { sc: ck }, () => {
    g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fillStyle = C.lav; g.fill();
    g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fillStyle = C.honey; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  });
}

// the part of the road on screen, as a headline at the top left: "Live now" (violet, like the live road) slammed in on the
// drop, "What's next" (white, like the coming stops) on its blip; a line under it in the road's own style draws on (the
// live road with its honey cap; the coming road's dashes from "We're here"'s pink dot); each slides away as the camera
// moves on. Screen space: the camera never moves it.
const HEAD = { x: 88, y: 168, s: 116 };
function headline(g, t, str, t0, t1, live) {
  if (t < t0 || t > t1 + 0.4) return;
  const { x, y, s } = HEAD;
  const font = { f: 'display', w: 900, s, st: 'expanded' };
  const sp = -s * 0.03;
  const w = measure(g, str, font, sp);
  const out = E.inCubic(prog(t, t1, t1 + 0.35));
  const a = clamp(prog(t, t0, t0 + 0.06)) * (1 - out);
  if (a <= 0) return;
  const dx = -out * 180;
  around(g, x + w / 2 + dx, y - s * 0.36, { sc: slamK(t, t0, 1.45, { freq: 3.1, damp: 0.45 }), alpha: a, rot: -0.02 }, () => {
    popWord(g, str, -w / 2, s * 0.36, { font, align: 'left', fill: live ? C.violet : C.white, stroke: C.ink, sw: 7, echo: C.pink, off: s * 0.045, spacing: sp });
  });
  const lp = E.outCubic(prog(t, t0 + 0.14, t0 + 0.75));
  if (lp <= 0) return;
  const ly = y + 40, x0 = x + 18 + dx, x1 = x0 + (w - 30) * lp;
  g.save();
  g.globalAlpha *= a;
  if (live) {
    g.lineCap = 'round'; g.strokeStyle = C.violet; g.lineWidth = 9;
    g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke();
  } else {
    g.setLineDash([18, 14]); g.lineDashOffset = -t * 22;
    g.strokeStyle = 'rgba(23,10,54,0.45)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke();
    g.setLineDash([]);
  }
  g.beginPath(); g.arc(x0, ly, live ? 13 : 12, 0, Math.PI * 2);
  g.fillStyle = live ? C.honey : C.pink; g.fill();
  g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  g.restore();
}

// the page's note under "What's next" ("In no particular order: any of these could come first."), on a white sticker:
// it pops in after the headline and slides away with it
export const NOTE_AT = { x: HEAD.x + 10, y: 268, s: 25 };
function note(g, t, t0, t1) {
  if (t < t0 || t > t1 + 0.4) return;
  const out = E.inCubic(prog(t, t1, t1 + 0.35));
  const k = popK(t, t0, 0.45, 1.8);
  const a = clamp(k * 3) * (1 - out);
  if (a <= 0) return;
  around(g, NOTE_AT.x - out * 180, NOTE_AT.y, { sc: k, rot: -0.012 }, () => {
    pill(g, NOTE, { x: 0, y: 0, font: { f: 'sans', w: 600, s: NOTE_AT.s }, align: 'left', bg: C.white, color: C.ink, line: C.ink, lw: 3, h: 52, padX: 22, shadow: 5, spacing: 0, alpha: a });
  });
}

// a step's connector, from its card down to its stop: ink, violet when it's under way (the page's), dashed for the locked one
function connector(g, x, bottom, k, state) {
  if (k <= 0) return;
  g.save();
  g.strokeStyle = state === 'going' ? C.violet : C.ink; g.lineWidth = 3.5;
  if (state === 'locked') g.setLineDash([8, 7]);
  g.beginPath(); g.moveTo(x, bottom + 2); g.lineTo(x, mix(bottom + 2, ROAD_Y - 28, k)); g.stroke();
  g.restore();
}

function drawWorld(g, t, c) {
  const { M, W, H } = c;
  const T = times(M);
  const cam = camAt(t);
  background(g, c, cam);

  g.save();
  g.translate(W / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-cam.cx, -cam.cy);

  road(g, t, T);

  for (const step of STEPS) {
    const x = STOPS[step.n];
    const tc = T.card[step.n], tn = T.node[step.n];
    const locked = step.state === 'locked';
    // its card: rises into place (the locked one slams in)
    const L = layout(g, step);
    let k = 0, dy = 0, sc = 1;
    if (t >= tc) {
      if (locked) { sc = slamK(t, tc, 1.32, { freq: 2.8, damp: 0.45 }); k = clamp(prog(t, tc, tc + 0.08)); } else {
        k = popK(t, tc, 0.55, 1.6);
        dy = (1 - E.outCubic(prog(t, tc, tc + 0.5))) * 90;
      }
    }
    connector(g, x, CARD_BOTTOM, clamp(prog(t, tc + 0.12, tc + 0.4)), step.state);
    if (k > 0) {
      stepCard(g, step, x, CARD_BOTTOM + dy, {
        alpha: clamp(k * 1.6), sc: locked ? sc : mix(0.9, 1, clamp(k)), t, img: c.faceImg,
        chipsAt: step.chips ? M.chips : null, scrambleAt: locked ? M.scramble : null, lockShake: locked ? M.lockShake : null, adultAt: locked ? M.adult : null,
      });
    }
    // its stop on the road, and its number under it
    const pulse = T.pulse[step.n];
    const glow = t >= pulse ? prog(t, pulse, pulse + 0.7) : 0;
    const nk = popK(t, tn, 0.45, 2.2);
    const check = T.check[step.n] ? E.outCubic(prog(t, T.check[step.n], T.check[step.n] + 0.32)) : 0;
    node(g, step.state, x, ROAD_Y, { k: nk, check, glow: glow > 0 && glow < 1 ? glow : 0, r: 27, t });
    stepNumber(g, step.n, x, NUM_Y, { state: step.state, sc: nk, alpha: clamp(nk * 2), s: 92 });
    // a little burst of sparks when it's checked
    if (T.check[step.n]) burst(g, x, ROAD_Y, t, T.check[step.n], { n: 12, speed: 420, size: 26, kind: 'spark', colors: [C.honey, C.pink, C.violet, C.mint], life: 0.8, seed: Number(step.n) * 3, gravity: 200, up: 0.4 });
    // COMING SOON or UNDER WAY, stamped on
    const ts = T.stamp[step.n];
    if (ts != null && t >= ts) stampOn(g, x + 70, CARD_BOTTOM - L.h + 30, t, ts, { rot: -0.11 + (Number(step.n) % 2) * 0.05, size: 32, kind: step.state });
  }

  // "We're here", between the live road and the coming one
  herePin(g, HERE_X, ROAD_Y, t, M.drop2);

  g.restore();

  // the lights go down on the locked card (a spotlight on it), and come back up as the camera pulls back
  const dk = Math.min(E.inOutQuad(prog(t, T.dark[0], T.dark[1])), 1 - E.inOutQuad(prog(t, T.dark[2], T.dark[3])));
  if (dk > 0) {
    const Ll = layout(g, LAST);
    const p = toScreen(c, cam, STOPS[LAST.n], CARD_BOTTOM - Ll.h * 0.42);
    const R = 470 * cam.z;
    const gr = g.createRadialGradient(p.x, p.y, R * 0.55, p.x, p.y, R * 1.25);
    gr.addColorStop(0, 'rgba(23,10,54,0)');
    gr.addColorStop(1, `rgba(23,10,54,${0.8 * dk})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
}

// what stays put on the screen while the camera moves: the headlines, the note and the meter (never motion-blurred)
function drawScreen(g, t, c) {
  const { M, W } = c;
  // the part of the road on screen: "Live now", then "What's next" with its note
  headline(g, t, LABELS.live, M.drop + 0.12, M.pan, true);
  headline(g, t, LABELS.next, M.nextHead, M.pan2, false);
  note(g, t, M.note, M.pan2);
  // the whole road at once: "2 of 10 · live now · 3 under way · 5 coming soon"
  meter(g, W / 2, 168, t, M.meter);
}

// c.layer: 'world' (what the camera sees), 'screen' (what stays put) or neither (both)
export function draw(g, t, c) {
  if (c.layer !== 'screen') drawWorld(g, t, c);
  if (c.layer !== 'world') drawScreen(g, t, c);
}

export default { prepare, draw, blurAt, camWarp };
export { CARD, life };
