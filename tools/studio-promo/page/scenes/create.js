// 3. Create (14–26 s): the app itself. Design it in a few taps (its look, age, hair, outfit, vibe, style, its name), ✦
// Create, 4 looks to pick from (about a minute later), its full body, ready. Or start from a photo: the photo, the OK box,
// and the three ways (4 looks, just its full body, the photo as it is), each with its price.
import { S, GRAD, grad, backdrop, headline, chip, seg, tile, goButton, costChip, progressBar, inputBox, typedAt, pointer, ripple, pill, icon, glow } from '../look.js';
import { appWindow, label, media, popK, around, card, E, prog, clamp, mix, text, rr, measure, captionFade } from '../parts.js';
import { CREATE, CAST } from '../../words.js';

const WIN = { x: 72, y: 190, w: 1296, h: 828 };
const UB = 1.65;            // the window's own scale
const U = 1.5;              // the panel's controls
const PW = 560;             // the panel's width
const FOOT = 132;           // its footer (what it costs, the button)
const LOOKS = ['nova-look-1', 'nova-look-2', 'nova-look-3', 'nova-look-4'];
const PHOTO = 'kai-body';
const STYLE_PICS = ['nova-look-2', 'style-anime', 'style-clay', 'style-watercolor'];

const split = (s) => { const w = s.split(' '); const k = Math.max(1, w.length - 2); return [`${w.slice(0, k).join(' ')} `, w.slice(k).join(' ')]; };

// a smooth value through keys [[t, v], …]
function keyed(keys, t, ease = E.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i], [b, vb] = keys[i + 1];
    if (t < b) return mix(va, vb, ease(prog(t, a, b)));
  }
  return keys[keys.length - 1][1];
}

// where everything in the panel goes (its own coordinates: 0 = the panel's top), measured once
let L = null;
function layout(g) {
  if (L) return L;
  const pad = 24, inner = PW - pad * 2;
  const rows = [];
  let y = 196;
  for (const r of CREATE.rows) {
    const chips = [];
    let x = 0, cy = y + 26;
    for (const ch of r.choices) {
      const { w, h } = chip(g, ch, 0, 0, { u: U, measureOnly: true, on: 1 });
      if (x + w > inner) { x = 0; cy += h + 8 * U; }
      chips.push({ label: ch, x: pad + x, y: cy, w, h, on: ch === r.pick });
      x += w + 8 * U;
    }
    rows.push({ label: r.label, y, chips });
    y = chips[chips.length - 1].y + 32 * U + 26;
  }
  const styleY = y + 6;
  const tw = (inner - 3 * 10) / 4, th = tw * 1.24;
  const tiles = CREATE.styles.map((s, k) => ({ label: s, pic: STYLE_PICS[k], x: pad + k * (tw + 10), y: styleY + 24, w: tw, h: th }));
  const nameY = styleY + 24 + th + 26;
  const input = { x: pad, y: nameY + 22, w: inner, h: 44 * U };
  L = { pad, inner, rows, styleY, tiles, nameY, input, end: input.y + input.h + 24 };
  return L;
}

export default {
  prepare() { L = null; },
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.75, b: 0.55, ax: 0.15, ay: 0.05, bx: 0.9, by: 0.95, grid: 0.3 });
    const lay = layout(g);
    const photoMode = t >= M.photoMode;

    // ---- the headline above the app: it changes with what happens ----
    const heads = CREATE.heads.map(split);
    const hT = [M.appIn + 0.1, M.looks[0] - 0.05, M.body, M.photoMode];
    heads.forEach((h, k) => {
      const out = k < 3 ? hT[k + 1] - 0.3 : null;
      if (t < hT[k] - 0.01 || (out != null && t > out + 0.7)) return;
      headline(g, h, t, hT[k], { x: 80, y: 136, size: 74, out, outDur: 0.3, stagger: 0.04 });
    });

    // ---- the window comes up ----
    const inP = E.outQuart(prog(t, M.appIn, M.appIn + 0.6));
    g.save();
    g.translate(0, (1 - inP) * 90);
    g.globalAlpha = clamp(inP * 1.4);
    const box = appWindow(g, WIN.x, WIN.y, WIN.w, WIN.h, { u: UB, credits: creditsAt(t, M) });
    const P = { x: box.x, y: box.y, w: PW, h: box.h };
    const R = { x: box.x + PW, y: box.y, w: box.w - PW, h: box.h };
    // the panel
    g.fillStyle = S.panel;
    g.fillRect(P.x, P.y, P.w, P.h);
    g.fillStyle = S.line2;
    g.fillRect(P.x + P.w - 1, P.y, 1.5, P.h);

    // its scroll: down as the taps go, back up for the photo
    const scroll = scrollAt(t, M);
    const view = { y0: P.y, y1: P.y + P.h - FOOT };
    g.save();
    g.beginPath(); g.rect(P.x, view.y0, P.w, view.y1 - view.y0); g.clip();
    const Y = (v) => P.y + v - scroll;           // panel coordinates → screen
    const X = (v) => P.x + v;

    // title, its price line, the two ways in
    text(g, CREATE.title, { x: X(lay.pad), y: Y(52), font: { f: 'sans', w: 750, s: 20 * U }, color: S.text, spacing: -0.4 });
    text(g, CREATE.sub, { x: X(lay.pad), y: Y(86), font: { f: 'sans', w: 500, s: 12.5 * U }, color: S.text3 });
    const segOn = keyed([[M.photoMode - 0.05, 0], [M.photoMode + 0.25, 1]], t, E.outCubic);
    seg(g, CREATE.modes, X(lay.pad), Y(108), lay.inner, { u: U, on: segOn, icons: ['spark', 'camera'] });

    const designA = 1 - E.inCubic(prog(t, M.photoMode, M.photoMode + 0.28));
    const photoA = E.outCubic(prog(t, M.photoMode + 0.2, M.photoMode + 0.5));
    if (designA > 0) {
      g.save();
      g.globalAlpha *= designA;
      // the rows of choices: each picked on its tap
      lay.rows.forEach((r, ri) => {
        label(g, r.label, X(lay.pad), Y(r.y), { u: U });
        const tapT = M.taps[ri + 1];
        for (const ch of r.chips) {
          const on = ch.on ? E.outBack(prog(t, tapT, tapT + 0.3)) : 0;
          const pulse = ch.on ? Math.exp(-Math.max(0, t - tapT) * 7) * (t >= tapT ? 1 : 0) : 0;
          chip(g, ch.label, X(ch.x), Y(ch.y), { u: U, on: clamp(on), pulse });
        }
      });
      // its style (optional): Realistic
      label(g, `${CREATE.styleLabel} · optional`, X(lay.pad), Y(lay.styleY + 10), { u: U });
      for (const [k, tl] of lay.tiles.entries()) {
        const on = k === 0 ? E.outBack(prog(t, M.taps[6], M.taps[6] + 0.3)) : 0;
        tile(g, md.pic(tl.pic), tl.label, X(tl.x), Y(tl.y), tl.w, tl.h, { u: U, on: clamp(on), size: 12 });
      }
      // its name
      label(g, CREATE.nameLabel, X(lay.pad), Y(lay.nameY + 10), { u: U });
      const typedName = typedAt(CREATE.name, t, M.typeName + 0.12, 9);
      inputBox(g, X(lay.input.x), Y(lay.input.y), lay.input.w, lay.input.h, typedName, { u: U, t, placeholder: 'Name it', focus: clamp(prog(t, M.typeName, M.typeName + 0.15)) * (t < M.create ? 1 : 0), caret: t >= M.typeName && t < M.create, size: 15 });
      g.restore();
    }
    if (photoA > 0) drawPhotoPanel(g, t, c, { X, Y, lay, alpha: photoA });
    g.restore();

    // the footer that stays: what it costs, what you have, the button with its price
    const fy = P.y + P.h - FOOT;
    g.fillStyle = 'rgba(14,14,17,0.96)';
    g.fillRect(P.x, fy, P.w - 1, FOOT);
    g.fillStyle = S.line2; g.fillRect(P.x, fy, P.w - 1, 1.2);
    const cost = photoMode ? (t >= M.pickWay ? CREATE.ways[2].cost : CREATE.ways[0].cost) : CREATE.goCost;
    text(g, `${cost} credits`, { x: P.x + lay.pad, y: fy + 36, font: { f: 'sans', w: 650, s: 13 * U }, color: S.text });
    text(g, `You have ${creditsAt(t, M).toLocaleString('en-US')}`, { x: P.x + P.w - lay.pad, y: fy + 36, font: { f: 'sans', w: 500, s: 12 * U }, color: S.text3, align: 'right' });
    const useMode = t >= M.useLook - 0.5 && t < M.body;
    const btnLabel = useMode ? CREATE.use : CREATE.go;
    const press = Math.max(clamp(1 - Math.abs(t - M.create) / 0.12), clamp(1 - Math.abs(t - M.useLook) / 0.12));
    goButton(g, btnLabel, P.x + lay.pad, fy + 54, P.w - lay.pad * 2, { u: U, cost: useMode ? null : cost, press, ic: useMode ? 'check' : 'spark', align: 'center', glowA: 0.45, size: 16 });

    // ---- the right side: what's being made ----
    drawRight(g, t, c, R);
    g.restore();

    // ---- the pointer ----
    const pk = pointerKeys(t, c, lay, P, box);
    const pt = keysAt(pk, t);
    for (const k of pk) if (k[3]) ripple(g, k[1], k[2], t, k[0], { r: 54 });
    pointer(g, pt.x, pt.y, { s: 1.7, press: pt.press, alpha: clamp(prog(t, M.appIn + 0.4, M.appIn + 0.7)) });
  },
};

// the panel's scroll: down as the taps go, back up for the photo, down to its three ways
function scrollAt(t, M) {
  return t >= M.photoMode
    ? keyed([[M.photoMode, 0], [M.ways[0] - 0.3, 0], [M.ways[0] + 0.15, 250], [M.ways[2] - 0.05, 372]], t)
    : keyed([[M.taps[3] + 0.2, 0], [M.taps[4] + 0.3, 116], [M.taps[5] + 0.3, 286], [M.typeName - 0.15, 470]], t);
}

function creditsAt(t, M) {
  let v = 1240;
  if (t >= M.create) v -= 100;
  return v;
}

// the photo way's panel: its note, the photo, the OK box, the three ways
function drawPhotoPanel(g, t, c, { X, Y, lay, alpha }) {
  const { M, media: md } = c;
  g.save();
  g.globalAlpha *= alpha;
  const pad = lay.pad, inner = lay.inner;
  label(g, 'Its photo', X(pad), Y(206), { u: U });
  const noteLines = ['A photo of you, of a friend who said OK,', 'or a character you drew.'];
  noteLines.forEach((l, i) => text(g, l, { x: X(pad), y: Y(240 + i * 26), font: { f: 'sans', w: 500, s: 12.5 * U }, color: S.text2 }));
  // the drop area, and the photo in it
  const dz = { x: X(pad), y: Y(290), w: inner, h: 236 };
  g.save();
  rr(g, dz.x, dz.y, dz.w, dz.h, 14 * U);
  g.fillStyle = S.surface; g.fill();
  g.setLineDash([10, 8]); g.lineWidth = 2; g.strokeStyle = S.line3; g.stroke();
  g.restore();
  const dropP = E.outBack(prog(t, M.photoDrop, M.photoDrop + 0.35), 1.4);
  if (t < M.photoDrop + 0.05) {
    icon(g, 'upload', dz.x + dz.w / 2, dz.y + dz.h / 2 - 18, 40, S.text3);
    text(g, 'Drop a photo, or tap to pick one', { x: dz.x + dz.w / 2, y: dz.y + dz.h / 2 + 30, font: { f: 'sans', w: 550, s: 12.5 * U }, color: S.text3, align: 'center' });
  }
  if (t >= M.photoDrop) {
    const tw = 150, th = 206;
    card(g, md.pic(PHOTO), dz.x + 28 + tw / 2, dz.y + dz.h / 2, tw, th, { sc: clamp(dropP), r: 12, sh: 0.5, focus: [0.5, 0.4] });
    const okP = clamp(prog(t, M.consent, M.consent + 0.3));
    text(g, 'Kai.jpg', { x: dz.x + 28 + tw + 24, y: dz.y + 70, font: { f: 'sans', w: 650, s: 14 * U }, color: S.text, alpha: clamp(dropP) });
    text(g, 'Checked ✓ shows the whole person', { x: dz.x + 28 + tw + 24, y: dz.y + 104, font: { f: 'sans', w: 500, s: 11.5 * U }, color: S.good, alpha: okP });
  }
  // the OK box
  const cy = Y(552);
  const tick = E.outBack(prog(t, M.consent, M.consent + 0.25));
  rr(g, X(pad), cy, 26, 26, 7);
  g.fillStyle = tick > 0 ? S.accent2 : S.surface; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = tick > 0 ? S.accent : S.line3; g.stroke();
  if (tick > 0) icon(g, 'check', X(pad) + 13, cy + 13, 22 * clamp(tick), '#fff', { lw: 3 });
  const cLines = ['This is me, someone who said OK,', 'or a character of my own.'];
  cLines.forEach((l, i) => text(g, l, { x: X(pad) + 42, y: cy + 19 + i * 26, font: { f: 'sans', w: 550, s: 12.5 * U }, color: S.text }));
  // the three ways, each with its price
  label(g, 'How should it be made?', X(pad), Y(650), { u: U });
  CREATE.ways.forEach((w, k) => {
    const t0 = M.ways[k];
    if (t < t0) return;
    const p = E.outCubic(prog(t, t0, t0 + 0.3));
    const y = Y(672 + k * 98), h = 86;
    const on = k === 2 ? E.outBack(prog(t, M.pickWay, M.pickWay + 0.3)) : 0;
    g.save();
    g.globalAlpha *= p;
    g.translate((1 - p) * 40, 0);
    rr(g, X(pad), y, inner, h, 12 * U);
    g.fillStyle = on > 0 ? 'rgba(139,92,246,0.16)' : S.surface; g.fill();
    g.lineWidth = on > 0 ? 3 : 1.5; g.strokeStyle = on > 0 ? S.accent : S.line2; g.stroke();
    text(g, w.name, { x: X(pad) + 20, y: y + 36, font: { f: 'sans', w: 650, s: 14 * U }, color: S.text });
    text(g, w.note, { x: X(pad) + 20, y: y + 66, font: { f: 'sans', w: 500, s: 12 * U }, color: S.text3 });
    costChip(g, w.cost, X(pad) + inner - 18, y + h / 2, { u: U, align: 'right', bg: 'rgba(255,255,255,0.07)' });
    g.restore();
  });
  g.restore();
}

// the right side of the app: a preview of what's picked, the 4 looks being made, picked, its full body; the photo
function drawRight(g, t, c, R) {
  const { M, media: md } = c;
  const cx = R.x + R.w / 2;
  g.save();
  g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  glow(g, cx, R.y + R.h * 0.5, 420, 'rgba(124,58,237,0.18)', 1);

  // before Create: its recipe, a chip for each tap
  const recipeA = 1 - E.inCubic(prog(t, M.create + 0.05, M.create + 0.35));
  if (t < M.create + 0.4) {
    g.save();
    g.globalAlpha *= recipeA;
    const top = R.y + 120;
    rr(g, cx - 150, top, 300, 300, 150);
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fill();
    g.setLineDash([12, 10]); g.lineWidth = 2; g.strokeStyle = S.line3; g.stroke(); g.setLineDash([]);
    icon(g, 'user', cx, top + 150, 120, 'rgba(167,139,250,0.55)', { lw: 1.4 });
    const name = typedAt(CREATE.name, t, M.typeName + 0.12, 9);
    text(g, name || 'Your influencer', { x: cx, y: top + 360, font: { f: 'sans', w: 750, s: name ? 44 : 30 }, color: name ? S.text : S.text3, align: 'center' });
    // the picks
    const picks = [...CREATE.rows.map((r) => r.pick), CREATE.styles[0]];
    const chips = picks.map((p, k) => ({ p, k, w: pill(g, p, 0, 0, { size: 20, measureOnly: true }).w }));
    let x = 0, row = 0;
    const lines = [[]];
    for (const ch of chips) {
      if (x + ch.w > R.w - 120) { lines.push([]); x = 0; row++; }
      lines[lines.length - 1].push({ ...ch, x }); x += ch.w + 10;
    }
    lines.forEach((ln, li) => {
      const lw = ln.reduce((a, ch) => a + ch.w, 0) + (ln.length - 1) * 10;
      for (const ch of ln) {
        const tapT = M.taps[ch.k + 1];
        if (t < tapT) continue;
        const p = E.outBack(prog(t, tapT, tapT + 0.35));
        const px = cx - lw / 2 + ch.x + ch.w / 2, py = top + 430 + li * 54;
        around(g, px, py, { sc: clamp(p), alpha: clamp(p) }, () => pill(g, ch.p, 0, 0, { size: 20, align: 'center', bg: 'rgba(139,92,246,0.18)', line: 'rgba(167,139,250,0.5)' }));
      }
    });
    g.restore();
  }

  // Create: its 4 looks' places, shimmering while they're made
  if (t >= M.create + 0.1 && t < M.looks[3] + 0.3) {
    const s = 300, gap = 22, gx = cx - s - gap / 2, gy = R.y + 88;
    for (let k = 0; k < 4; k++) {
      const a = E.outCubic(prog(t, M.create + 0.1 + k * 0.06, M.create + 0.45 + k * 0.06)) * (1 - E.outCubic(prog(t, M.looks[k], M.looks[k] + 0.2)));
      if (a <= 0) continue;
      const x = gx + (k % 2) * (s + gap), y = gy + Math.floor(k / 2) * (s + gap);
      g.save();
      g.globalAlpha *= a * 0.9;
      rr(g, x, y, s, s, 22);
      g.fillStyle = S.surface; g.fill();
      g.clip();
      const sx = x + (((t - M.create) * 0.9 + k * 0.17) % 1.4 - 0.2) * s * 1.6;
      const lg = g.createLinearGradient(sx - 160, y, sx + 160, y + s);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(167,139,250,0.14)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(x, y, s, s);
      g.restore();
    }
  }
  // Create: making its looks (about a minute: the honest skip)
  const makingA = Math.min(E.outCubic(prog(t, M.create + 0.15, M.create + 0.4)), 1 - E.inCubic(prog(t, M.looks[0] - 0.15, M.looks[0] + 0.05)));
  if (makingA > 0) {
    g.save();
    g.globalAlpha *= makingA;
    const p = t < M.create + 0.95 ? 0.36 * E.outCubic(prog(t, M.create + 0.2, M.create + 0.95)) : mix(0.36, 1, E.inOutCubic(prog(t, M.create + 1.0, M.looks[0] - 0.2)));
    const left = p < 0.5 ? 'about 40 s left' : p < 0.98 ? 'about 10 s left' : 'done';
    g.save(); rr(g, cx - 330, R.y + R.h / 2 - 86, 660, 210, 24); g.fillStyle = 'rgba(9,9,11,0.82)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = S.line2; g.stroke(); g.restore();
    progressBar(g, cx - 300, R.y + R.h / 2 - 10, 600, p, { u: 1.65, label: CREATE.making, left, t });
    const skip = E.outBack(prog(t, M.create + 0.62, M.create + 0.95));
    if (skip > 0) around(g, cx, R.y + R.h / 2 + 90, { sc: clamp(skip), alpha: clamp(skip) }, () => pill(g, CREATE.later, 0, 0, { size: 22, align: 'center', ic: 'ff', icColor: S.mint, bg: 'rgba(14,30,28,0.9)', line: 'rgba(63,240,195,0.5)', color: S.text }));
    g.restore();
  }

  // its 4 looks, one picked; then its full body
  const bodyP = E.inOutCubic(prog(t, M.body - 0.05, M.body + 0.45));
  if (t >= M.looks[0] && t < M.photoMode + 0.4) {
    const fade = 1 - E.inCubic(prog(t, M.photoMode - 0.05, M.photoMode + 0.3));
    const s = 300, gap = 22, gx = cx - s - gap / 2, gy = R.y + 88;
    text(g, CREATE.pickTitle, { x: cx, y: R.y + 58, font: { f: 'sans', w: 700, s: 26 }, color: S.text, align: 'center', alpha: (1 - bodyP) * fade });
    LOOKS.forEach((name, k) => {
      const p = popK(t, M.looks[k], 0.45);
      if (p <= 0) return;
      const on = k === 0 ? E.outBack(prog(t, M.pickLook, M.pickLook + 0.3)) : 0;
      const dim = t >= M.pickLook && k !== 0 ? 0.45 * E.outCubic(prog(t, M.pickLook, M.pickLook + 0.3)) : 0;
      let x = gx + (k % 2) * (s + gap), y = gy + Math.floor(k / 2) * (s + gap), w = s, h = s;
      // the picked one becomes a small avatar beside its full body
      if (k === 0) { x = mix(x, cx - 330, bodyP); y = mix(y, R.y + 110, bodyP); w = h = mix(s, 150, bodyP); }
      const a = k === 0 ? 1 : 1 - bodyP;
      around(g, x + w / 2, y + h / 2, { sc: clamp(p), alpha: clamp(p) * a * fade }, () => {
        tile(g, md.pic(name), null, -w / 2, -h / 2, w, h, { u: 1.6, on: clamp(on) * (1 - bodyP), r: 14, sh: 0.5, focus: [0.5, 0.4] });
        if (dim > 0) { rr(g, -w / 2, -h / 2, w, h, 22); g.fillStyle = `rgba(9,9,11,${dim})`; g.fill(); }
      });
    });
    if (t >= M.body - 0.05) {
      const bh = 610, bw = bh * 9 / 16;
      card(g, md.pic('nova-body'), cx + 80, R.y + 36 + bh / 2, bw, bh, { sc: mix(0.85, 1, bodyP), alpha: bodyP * fade, r: 18, sh: 0.7, focus: [0.5, 0.5] });
      const rp = popK(t, M.ready, 0.45);
      if (rp > 0) around(g, cx - 255, R.y + 330, { sc: rp, alpha: clamp(rp) * fade }, () => pill(g, CREATE.ready, 0, 0, { size: 22, align: 'center', ic: 'check', icColor: S.good, bg: 'rgba(16,32,24,0.92)', line: 'rgba(52,211,153,0.5)' }));
      if (rp > 0) text(g, CAST.nova.name, { x: cx - 255, y: R.y + 300, font: { f: 'sans', w: 750, s: 30 }, color: S.text, align: 'center', alpha: clamp(rp) * fade });
    }
  }

  // from a photo: the photo, checked
  if (t >= M.photoDrop) {
    const p = E.outCubic(prog(t, M.photoDrop + 0.1, M.photoDrop + 0.5));
    const bh = 600, bw = bh * 9 / 16;
    card(g, md.pic(PHOTO), cx, R.y + 40 + bh / 2, bw, bh, { sc: mix(0.9, 1, p), alpha: p, r: 18, sh: 0.7, focus: [0.5, 0.5] });
    const ok = popK(t, M.consent + 0.15, 0.45);
    if (ok > 0) around(g, cx, R.y + 40 + bh + 48, { sc: ok, alpha: clamp(ok) }, () => pill(g, "Looks good: it's checked and ready", 0, 0, { size: 21, align: 'center', ic: 'check', icColor: S.good, bg: 'rgba(16,32,24,0.92)', line: 'rgba(52,211,153,0.5)' }));
    const asis = popK(t, M.pickWay + 0.1, 0.45);
    if (asis > 0) around(g, cx + bw / 2 - 10, R.y + 80, { sc: asis, alpha: clamp(asis), rot: 0.06 }, () => pill(g, 'As it is · no AI', 0, 0, { size: 20, align: 'center', bg: 'rgba(14,14,17,0.92)', line: 'rgba(167,139,250,0.6)' }));
  }
  g.restore();
}

// where the pointer goes, from where the panel's things are at each tap
function pointerKeys(t, c, lay, P, box) {
  const { M } = c;
  const sAt = (tt) => scrollAt(tt, M);
  const at = (tt, x, y) => [tt, P.x + x, P.y + y - sAt(tt)];
  const keys = [[M.appIn + 0.3, 900, 1120]];
  keys.push([...at(M.taps[0], lay.pad + lay.inner * 0.25, 108 + 30 * U), true]);
  lay.rows.forEach((r, ri) => {
    const ch = r.chips.find((x) => x.on);
    keys.push([...at(M.taps[ri + 1], ch.x + ch.w * 0.55, ch.y + ch.h * 0.6), true]);
  });
  const tl = lay.tiles[0];
  keys.push([...at(M.taps[6], tl.x + tl.w * 0.55, tl.y + tl.h * 0.55), true]);
  keys.push([...at(M.typeName, lay.input.x + 90, lay.input.y + lay.input.h * 0.55), true]);
  const fy = P.h - FOOT + 54 + 22 * U;
  keys.push([M.create, P.x + PW / 2 + 20, P.y + fy, true]);
  // the first look, then Use this look
  const R = { x: box.x + PW, w: box.w - PW };
  const cx = R.x + R.w / 2;
  keys.push([M.looks[3] + 0.2, cx + 120, P.y + 520]);
  keys.push([M.pickLook, cx - 160, P.y + 230, true]);
  keys.push([M.useLook, P.x + PW / 2 + 20, P.y + fy, true]);
  keys.push([M.photoMode, P.x + lay.pad + lay.inner * 0.75, P.y + 108 + 30 * U, true]);
  keys.push([M.consent, P.x + lay.pad + 13, P.y + 552 + 13 - sAt(M.consent), true]);
  keys.push([M.pickWay, P.x + lay.pad + lay.inner * 0.5, P.y + 672 + 2 * 98 + 43 - sAt(M.pickWay), true]);
  return keys;
}
function keysAt(keys, t) {
  let x = keys[0][1], y = keys[0][2], press = 0;
  for (let i = 0; i < keys.length; i++) {
    const [ti, xi, yi] = keys[i];
    if (t >= ti) { x = xi; y = yi; }
    const nx = keys[i + 1];
    if (nx && t >= ti && t < nx[0]) {
      const travel = Math.min(0.38, nx[0] - ti);
      const p = E.inOutCubic(prog(t, nx[0] - travel, nx[0]));
      x = mix(xi, nx[1], p); y = mix(yi, nx[2], p) - Math.sin(p * Math.PI) * Math.min(36, Math.hypot(nx[1] - xi, nx[2] - yi) * 0.08);
    }
    if (keys[i][3]) { const d = t - ti; if (d >= -0.06 && d < 0.16) press = d < 0 ? 1 + d / 0.06 : 1 - d / 0.16; }
  }
  return { x, y, press: clamp(press) };
}
void GRAD; void grad; void media; void measure; void captionFade;
