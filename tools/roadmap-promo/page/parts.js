// The roadmap's video: the pieces its scenes share, drawn in code in the roadmap page's own Pop mode look (roadmap.html,
// src/styles/pop.css): its icons (the page's own SVG paths), a stop on the road, a step's card with its status, the
// COMING SOON and UNDER WAY stamps, the locked card's "???" and its blacked-out lines, the meter ("2 of 10"). Every one a
// pure function of time: drawing a frame twice gives the same picture.
// Since 2026-10-19 (the roadmap's ten steps): "under way" (`going`) as the page marks it: a honey chip with an ink dot, a
// stop with an arc turning around it, a number outlined in violet, a half-filled segment in the meter.
import { C, E, prog, clamp, mix, spring, text, rr, measure, hash, graphemes, heart, spark, setFont } from '../../promo/page/kit.js';
import { pill, lines, popWord } from '../../promo/page/ui.js';
import { STEPS, LABELS, STAMPS, METER } from '../words.js';

export { C, E, prog, clamp, mix, spring, text, rr, measure, pill, popWord, heart, spark };

// 0 → 1 with a little overshoot, from t0 (a pop)
export const popK = (t, t0, d = 0.5, c = 1.9) => (t < t0 ? 0 : E.outBack(prog(t, t0, t0 + d), c));
// a slam: from `from` times its size down to its size, on a spring (a little squash after)
export function slamK(t, t0, from = 1.6, { freq = 3, damp = 0.42 } = {}) {
  if (t < t0) return 0;
  return mix(from, 1, spring(t, t0, { freq, damp }));
}
// in at a, out at b (0..1..0)
export function life(t, a, b, inD = 0.35, outD = 0.3) {
  if (t < a || t > b) return 0;
  return Math.min(E.outCubic(prog(t, a, a + inD)), 1 - E.inCubic(prog(t, b - outD, b)));
}
// draws fn around a point, turned and scaled
export function around(g, x, y, { rot = 0, sc = 1, alpha = 1 } = {}, fn) {
  if (alpha <= 0 || sc <= 0.001) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (sc !== 1) g.scale(sc, sc);
  fn();
  g.restore();
}

// ---------- the page's icons (24 × 24, line icons) ----------
const ICON = {
  check: [['M5.5 12.5 10 17l8.5-9.5', 2.4]],
  stake: [['M19 6.5a7 2.8 0 1 1-14 0a7 2.8 0 1 1 14 0Z', 1.7], ['M5 6.5v5.2c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6.5', 1.7], ['M5 11.7v5.3c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5.3', 1.7]],
  games: [['M7.6 7.5h8.8a4.6 4.6 0 0 1 4.5 5.6l-.8 3.6a2.3 2.3 0 0 1-3.9 1.1L14.1 16H9.9l-2.1 1.8a2.3 2.3 0 0 1-3.9-1.1l-.8-3.6a4.6 4.6 0 0 1 4.5-5.6Z', 1.7], ['M8.2 10.4v3.2M6.6 12h3.2', 1.7], ['M15.6 10.8h.01M17.6 13h.01', 2.4]],
  gift: [['M4.7 8.5h14.6a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2V9.7a1.2 1.2 0 0 1 1.2-1.2Z', 1.7], ['M5 12.5v6.3A1.2 1.2 0 0 0 6.2 20h11.6a1.2 1.2 0 0 0 1.2-1.2v-6.3M12 8.5V20', 1.7], ['M12 8.5C10.6 5 6.6 4.6 6.6 6.9c0 1.3 1.9 1.6 5.4 1.6Zm0 0c1.4-3.5 5.4-3.9 5.4-1.6 0 1.3-1.9 1.6-5.4 1.6Z', 1.7]],
  lock: [['M7.6 10.5h8.8a2.6 2.6 0 0 1 2.6 2.6v4.8a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 17.9v-4.8a2.6 2.6 0 0 1 2.6-2.6Z', 1.7], ['M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.4v2.3', 1.7]],
  spark: [['M12 3.5c.6 4.2 2.3 6.4 6.5 7.3-4.2.9-5.9 3.1-6.5 7.7-.6-4.6-2.3-6.8-6.5-7.7 4.2-.9 5.9-3.1 6.5-7.3Z', 1.6], ['M18.6 3.8v3M17.1 5.3h3', 1.5]],
  chat: [['M6 5.5h12a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-6.2L8 19.6v-3.1H6A2.5 2.5 0 0 1 3.5 14V8A2.5 2.5 0 0 1 6 5.5Z', 1.7], ['M8.5 11h.01M12 11h.01M15.5 11h.01', 2.6]],
  // 2026-10-19, the roadmap's new steps: burns (a flame), the flywheel (a cycle), governance (a ballot box), AUM (a dial)
  flame: [['M12.2 2.5c.4 3-1.4 4.8-3 6.6-1.5 1.7-2.9 3.4-2.9 6 0 3.6 2.7 6.4 5.9 6.4s5.9-2.6 5.9-6.2c0-2.7-1.4-4.4-2.6-5.6-.2 1.6-.9 2.7-2 3.2.5-3.5-.2-7.2-1.3-10.4Z', 1.7]],
  cycle: [['M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6', 1.7], ['M17.7 3v3.6h-3.6M6.3 21v-3.6h3.6', 1.7]],
  governance: [['M3.5 13.5h17v6.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-6.5Z', 1.7], ['M7 13.5V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9', 1.7], ['m9.5 8.5 2 2 3.5-4', 1.7]],
  aum: [['M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0Z', 1.7], ['M12 3.5V12l6 6', 1.7]],
};
const paths = new Map();
const path2d = (d) => { if (!paths.has(d)) paths.set(d, new Path2D(d)); return paths.get(d); };
// an icon centered at x, y, `size` px across
export function icon(g, name, x, y, size, color = C.ink, { lw = 1, alpha = 1, fill = null } = {}) {
  const list = ICON[name];
  if (!list || alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x - size / 2, y - size / 2);
  g.scale(size / 24, size / 24);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (fill) { g.fillStyle = fill; g.fill(path2d(list[0][0])); }
  g.strokeStyle = color;
  for (const [d, w] of list) { g.lineWidth = w * lw; g.stroke(path2d(d)); }
  g.restore();
}

// her face (the front's, public/images/landing/agi1-face.webp) in a circle with an ink ring
export function face(g, img, x, y, r, { alpha = 1, ring = C.ink, lw = 3, bg = C.lav } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = bg; g.fill();
  g.save();
  g.clip();
  if (img) {
    const s = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, x - (img.naturalWidth * s) / 2, y - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  }
  g.restore();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.lineWidth = lw; g.strokeStyle = ring; g.stroke();
  g.restore();
}

// ---------- a step's look (the page's: live ones checked in honey, under way ones with a turning arc, coming ones white
// with a pink dot, the locked one dashed) ----------
// each step's icon circle in its card: her face, the studio's ✦, coins, a gamepad, a flame, a cycle, a ballot box, a
// dial, a gift, a lock (the page's own icons)
export const LOOK = {
  '01': { icon: 'face', bg: C.lav },
  '02': { icon: 'spark', bg: C.violet, color: C.white },
  '03': { icon: 'stake', bg: C.mint },
  '04': { icon: 'games', bg: C.lav },
  '05': { icon: 'flame', bg: C.honey },
  '06': { icon: 'cycle', bg: C.mint },
  '07': { icon: 'governance', bg: C.lav },
  '08': { icon: 'aum', bg: C.mint },
  '09': { icon: 'gift', bg: C.honey },
  '10': { icon: 'lock', bg: C.pink },
};

// a status chip, as the page's Pop mode draws it: { live: "Live" (mint, ink dot), going: "Under way" (honey, ink dot),
// soon: "Coming soon" (white, pink dot), locked: "Locked" (ink, honey) }
export function status(g, state, x, y, { alpha = 1, s = 15, align = 'left' } = {}) {
  const font = { f: 'mono', w: 700, s };
  const o = { x, y, font, lw: 2.2, line: C.ink, align, alpha, spacing: 1.4, h: s * 2.05, padX: s * 0.85, upper: true };
  if (state === 'live') return pill(g, 'Live', { ...o, bg: C.mint, color: C.ink, dot: C.ink });
  if (state === 'going') return pill(g, STAMPS.going, { ...o, bg: C.honey, color: C.ink, dot: C.ink });
  if (state === 'soon') return pill(g, STAMPS.soon, { ...o, bg: C.white, color: C.ink, dot: C.pink });
  return pill(g, 'Locked', { ...o, bg: C.ink, color: C.honey, dot: C.honey });
}

// ---------- a step's card ----------
export const CARD = { w: 440, pad: 28, r: 26 };
const F = {
  name: { f: 'display', w: 850, s: 38, st: 'semi-expanded' },
  line: { f: 'sans', w: 500, s: 23 },
  more: { f: 'sans', w: 500, s: 19 },
  meta: { f: 'mono', w: 500, s: 14 },
  chip: { f: 'mono', w: 600, s: 14 },
  step: { f: 'mono', w: 600, s: 14 },
  adult: { f: 'display', w: 900, s: 74, st: 'expanded' },
};
const LH = { line: 31, more: 26, meta: 21 };

// a step's name beside its icon (`width` across): on one line at 38 px down to 30; else on two, broken at a space so the
// longer line is as short as it can be (after a comma when that's as good), 34 px down to 24; else on one line down to
// 26; else wrapped at 22 (2026-10-19: "Buybacks, burns, marketing & listings" is the first name too long for one line)
export function nameFit(g, name, width) {
  const fits = (str, s) => measure(g, str, { ...F.name, s }, -0.3) <= width;
  for (let s = F.name.s; s >= 30; s -= 1) if (fits(name, s)) return { s, lines: [name] };
  const words = name.split(' ');
  if (words.length > 1) {
    const splits = [];
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const longer = Math.max(measure(g, a, { ...F.name, s: 30 }, -0.3), measure(g, b, { ...F.name, s: 30 }, -0.3));
      splits.push({ a, b, longer: longer - (a.endsWith(',') ? 4 : 0) });
    }
    splits.sort((p, q) => p.longer - q.longer);
    const best = splits[0];
    for (let s = 34; s >= 24; s -= 1) if (fits(best.a, s) && fits(best.b, s)) return { s, lines: [best.a, best.b] };
  }
  for (let s = 29; s >= 26; s -= 1) if (fits(name, s)) return { s, lines: [name] };
  return { s: 22, lines: lines(g, name, { ...F.name, s: 22 }, width) };
}

// where everything in a step's card goes (measured once): its height, its rows
const layouts = new Map();
export function layout(g, step) {
  if (layouts.has(step.n)) return layouts.get(step.n);
  const { w, pad } = CARD;
  const inner = w - pad * 2;
  const L = { step };
  let y = pad;
  L.top = y + 16; y += 32 + 22;                                         // the status row
  if (step.state === 'locked') {
    L.adult = y + 62; y += 84;                                          // "18+ ???"
    L.redact = y + 4; y += 3 * 16 + 2 * 9 + 22;                         // three blacked-out lines
  } else {
    const fit = nameFit(g, step.name, inner - 80);
    L.nameS = fit.s; L.nameLines = fit.lines; L.nameLH = Math.round(fit.s * 1.06);
    const rowH = Math.max(64, fit.lines.length * L.nameLH);
    L.row = y + rowH / 2; y += rowH + 20;                               // its icon and its name
  }
  L.lines = lines(g, step.line, F.line, inner);
  L.line = y + 22; y += L.lines.length * LH.line;
  if (step.chips) {
    y += 14;
    const rows = [[]];
    let rowW = 0;
    for (const c of step.chips) {
      const cw = measure(g, c, F.chip, 0.6) + 30;
      if (rowW && rowW + 10 + cw > inner) { rows.push([]); rowW = 0; }
      rows.at(-1).push({ c, w: cw });
      rowW += (rowW ? 10 : 0) + cw;
    }
    L.chips = { y: y + 16, rows }; y += rows.length * 42 - 10;
  }
  if (step.more) {
    y += 10;
    L.moreLines = lines(g, step.more, F.more, inner);
    L.more = y + 19; y += L.moreLines.length * LH.more;
  }
  y += 18;
  L.rule = y; y += 16;
  const fine = metaFit(g, step.meta, inner);
  L.metaS = fine.s; L.metaLines = fine.lines;
  L.meta = y + 14; y += L.metaLines.length * LH.meta;
  y += pad - 6;
  L.h = Math.round(y);
  layouts.set(step.n, L);
  return L;
}

// a card's fine print: on one line when it fits at 13 to 14 px; else broken between its items (" · "), never inside one
// (the first cut left "live on" at the end of a line and "X" alone under it)
export function metaFit(g, str, width) {
  for (let s = F.meta.s; s >= 13; s -= 0.5) if (measure(g, str, { ...F.meta, s }, 0.2) <= width) return { s, lines: [str] };
  const out = [];
  let cur = '';
  for (const item of str.split(' · ')) {
    const next = cur ? `${cur} · ${item}` : item;
    if (cur && measure(g, next, F.meta, 0.2) > width) { out.push(`${cur} ·`); cur = item; } else cur = next;
  }
  if (cur) out.push(cur);
  return { s: F.meta.s, lines: out.flatMap((ln) => (measure(g, ln, F.meta, 0.2) > width ? lines(g, ln, F.meta, width) : [ln])) };
}

// the locked card's "???": seeded characters every 1/15 s until it settles (t0 → t1), then "???". Never a "$" or a "%"
// (2026-10-20): next to "18+" a money sign or a percent would read as a hint of money on the secret (hard rule 8)
export const GLYPHS = '#&@*!?█▓▒░<>/\\=+';
export function scramble(t, t0, t1, final = '???') {
  if (t >= t1 || t < t0) return final;
  const step = Math.floor((t - t0) * 15);
  return graphemes(final).map((ch, i) => GLYPHS[Math.floor(hash(step * 7.3 + i * 13.1) * GLYPHS.length)]).join('');
}

// a step's card, its bottom at `bottom`, centered at x. o: { alpha, sc, rot, img (her face), t, scrambleAt: [t0, t1],
// stamp: the stamp's slam (null | t0), chipsAt: [t0…] (the stake card's chips pop in), lockShake: t0 }
export function stepCard(g, step, x, bottom, o = {}) {
  const { alpha = 1, sc = 1, rot = 0, img = null, t = 0, chipsAt = null, scrambleAt = null, lockShake = null, adultAt = null } = o;
  if (alpha <= 0 || sc <= 0.001) return;
  const L = layout(g, step);
  const { w, pad, r } = CARD;
  const h = L.h, x0 = -w / 2, y0 = -h;
  const look = LOOK[step.n];
  const locked = step.state === 'locked';
  around(g, x, bottom, { rot, sc, alpha }, () => {
    // the card: white, an ink outline, a hard shadow under it (the locked one dashed, striped, no shadow)
    if (!locked) { rr(g, x0, y0 + 9, w, h, r); g.fillStyle = C.ink; g.fill(); }
    rr(g, x0, y0, w, h, r);
    g.fillStyle = locked ? C.paper : C.white; g.fill();
    if (locked) {
      g.save();
      rr(g, x0, y0, w, h, r); g.clip();
      g.strokeStyle = 'rgba(23,10,54,0.07)'; g.lineWidth = 11;
      for (let k = -h; k < w + h; k += 31) { g.beginPath(); g.moveTo(x0 + k, y0); g.lineTo(x0 + k - h, y0 + h); g.stroke(); }
      g.restore();
      g.setLineDash([12, 9]);
    }
    rr(g, x0, y0, w, h, r);
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    g.setLineDash([]);
    // its status, and "Step n of 10"
    status(g, step.state, x0 + pad, y0 + L.top);
    text(g, `Step ${Number(step.n)} of ${STEPS.length}`, { x: x0 + w - pad, y: y0 + L.top + 5, font: F.step, color: 'rgba(23,10,54,0.62)', align: 'right', spacing: 0.4 });
    if (locked) {
      // "18+" in pink with an ink outline, and its "???"
      const ak = adultAt == null ? 1 : popK(t, adultAt, 0.45);
      around(g, x0 + pad, y0 + L.adult, { sc: ak, alpha: clamp(ak * 3) }, () => {
        popWord(g, '18+', 0, 0, { font: F.adult, fill: C.pink, stroke: C.ink, sw: 7, echo: null, align: 'left', spacing: -2 });
      });
      const aw = measure(g, '18+', F.adult, -2);
      const q = scrambleAt ? scramble(t, scrambleAt[0], scrambleAt[1]) : '???';
      const settled = !scrambleAt || t >= scrambleAt[1];
      text(g, q, { x: x0 + pad + aw + 18, y: y0 + L.adult, font: { f: 'display', w: 900, s: 60, st: 'expanded' }, color: settled ? C.ink : C.violet, spacing: 2 });
      // three blacked-out lines (88%, 66%, 42%: the page's), shimmering a little
      const inner = w - pad * 2;
      [0.88, 0.66, 0.42].forEach((f, k) => {
        const sh = 0.8 + 0.2 * Math.sin(t * 3 + k * 0.9);
        rr(g, x0 + pad, y0 + L.redact + k * 25, inner * f, 16, 6);
        g.fillStyle = `rgba(23,10,54,${0.82 * sh})`; g.fill();
      });
      // a padlock badge on the card's top right corner, rattling
      const shake = lockShake == null ? 0 : Math.max(0, 1 - (t - lockShake) / 0.7) * (t >= lockShake ? Math.sin((t - lockShake) * 46) : 0);
      around(g, x0 + w + 4, y0 - 4, { rot: shake * 0.24 }, () => {
        g.beginPath(); g.arc(4, 5, 36, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
        g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill();
        g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
        icon(g, 'lock', 0, 1, 42, C.ink, { lw: 1.25 });
      });
    } else {
      // its icon in a circle, and its name
      const cx = x0 + pad + 32, cy = y0 + L.row;
      if (look.icon === 'face') face(g, img, cx, cy, 32, { lw: 3 });
      else {
        g.beginPath(); g.arc(cx + 3, cy + 4, 32, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
        g.beginPath(); g.arc(cx, cy, 32, 0, Math.PI * 2); g.fillStyle = look.bg; g.fill();
        g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
        icon(g, look.icon, cx, cy, 36, look.color || C.ink, { lw: 1.15 });
      }
      // its name, on one line or two, centered on its icon
      const n = L.nameLines.length;
      L.nameLines.forEach((ln, k) => text(g, ln, {
        x: x0 + pad + 80, y: cy + (k - (n - 1) / 2) * L.nameLH + L.nameS * 0.36,
        font: { ...F.name, s: L.nameS }, color: C.ink, spacing: -0.3,
      }));
    }
    // its sentence (the page's), and the stake card's chips, the games card's "more"
    L.lines.forEach((ln, k) => text(g, ln, { x: x0 + pad, y: y0 + L.line + k * LH.line, font: F.line, color: C.ink }));
    if (L.chips) {
      let n = 0;
      L.chips.rows.forEach((row, ri) => {
        let cx = x0 + pad;
        for (const ch of row) {
          const at = chipsAt?.[n] ?? null;
          const k = at == null ? 1 : popK(t, at, 0.4);
          around(g, cx + ch.w / 2, y0 + L.chips.y + ri * 42, { sc: k, alpha: clamp(k * 3) }, () => {
            pill(g, ch.c, { x: 0, y: 0, font: F.chip, bg: n === 0 ? C.mint : n === 1 ? C.lav : C.honey, color: C.ink, line: C.ink, lw: 2, h: 32, padX: 15, spacing: 0.6 });
          });
          cx += ch.w + 10;
          n++;
        }
      });
    }
    if (L.moreLines) L.moreLines.forEach((ln, k) => text(g, ln, { x: x0 + pad, y: y0 + L.more + k * LH.more, font: F.more, color: 'rgba(23,10,54,0.78)' }));
    // a thin rule, then its fine print (the page's meta line)
    g.fillStyle = 'rgba(23,10,54,0.14)';
    g.fillRect(x0 + pad, y0 + L.rule, w - pad * 2, 2);
    L.metaLines.forEach((ln, k) => text(g, ln, { x: x0 + pad, y: y0 + L.meta + k * LH.meta, font: { ...F.meta, s: L.metaS }, color: 'rgba(23,10,54,0.66)', spacing: 0.2 }));
  });
}

// ---------- the road's stops ----------
// a stop: live ones violet, then checked in honey; under way ones white with a violet ring and dot and a violet arc
// turning around them (the page's); coming ones white with a pink dot; the locked one dashed, with a lock
export function node(g, state, x, y, { r = 26, k = 1, check = 0, alpha = 1, glow = 0, t = 0 } = {}) {
  if (k <= 0 || alpha <= 0) return;
  around(g, x, y, { sc: k, alpha }, () => {
    if (glow > 0) {
      g.beginPath(); g.arc(0, 0, r + 10 + glow * 26, 0, Math.PI * 2);
      g.lineWidth = 6 * (1 - glow) + 1; g.strokeStyle = `rgba(255,77,166,${(1 - glow) * 0.9})`; g.stroke();
    }
    if (state === 'locked') {
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = C.paper; g.fill();
      g.setLineDash([7, 6]); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke(); g.setLineDash([]);
      icon(g, 'lock', 0, 1, r * 1.15, C.ink, { lw: 1.2 });
      return;
    }
    if (state === 'going') {
      // half a ring turning around it, one turn every 2.6 s (the page's)
      const a0 = (t / 2.6) * Math.PI * 2;
      g.beginPath(); g.arc(0, 0, r + 10, a0, a0 + Math.PI);
      g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = C.violet; g.stroke(); g.lineCap = 'butt';
    }
    g.beginPath(); g.arc(0, 5, r, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    const live = state === 'live';
    g.fillStyle = live ? (check > 0 ? C.honey : C.violet) : C.white; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = state === 'going' ? C.violet : C.ink; g.stroke();
    if (state === 'going') {
      g.beginPath(); g.arc(0, 0, r * 0.34, 0, Math.PI * 2); g.fillStyle = C.violet; g.fill();
      return;
    }
    if (live && check > 0) {
      // the check draws on
      g.save();
      g.translate(-r * 0.62, -r * 0.62); g.scale((r * 1.24) / 24, (r * 1.24) / 24);
      const p = path2d(ICON.check[0][0]);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 3.2; g.strokeStyle = C.ink;
      g.setLineDash([30, 30]); g.lineDashOffset = 30 * (1 - check);
      g.stroke(p);
      g.restore();
    } else if (!live) {
      g.beginPath(); g.arc(0, 0, r * 0.34, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill();
    } else {
      g.beginPath(); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
    }
  });
}

// the big step number under a stop (Anybody): live ones violet with a pink echo, under way ones outlined in violet,
// coming ones outlined in ink
export function stepNumber(g, n, x, y, { state = 'live', alpha = 1, sc = 1, s = 96 } = {}) {
  around(g, x, y, { sc, alpha }, () => {
    const font = { f: 'display', w: 900, s, st: 'expanded' };
    if (state === 'live') popWord(g, n, 0, 0, { font, fill: C.violet, stroke: null, sw: 0, echo: C.pink, off: s * 0.05, spacing: -2 });
    else {
      g.save();
      setFont(g, font);
      g.letterSpacing = '-2px';
      g.textAlign = 'center';
      g.lineJoin = 'round';
      g.lineWidth = 3; g.strokeStyle = state === 'locked' ? 'rgba(23,10,54,0.55)' : state === 'going' ? C.violet : C.ink;
      g.strokeText(n, 0, 0);
      g.restore();
    }
  });
}

// "COMING SOON" (pink) or "UNDER WAY" (honey), stamped onto a card as the page marks it: rotated, slammed on from big
export function stampOn(g, x, y, t, t0, { rot = -0.12, size = 34, alpha = 1, kind = 'soon' } = {}) {
  if (t < t0) return;
  const going = kind === 'going';
  const word = (going ? STAMPS.going : STAMPS.soon).toUpperCase();
  const k = spring(t, t0, { freq: 3.4, damp: 0.4 });
  const sc = mix(1.7, 1, clamp(k)) * (k > 1 ? 1 - (k - 1) * 0.35 : 1);
  const a = clamp(prog(t, t0, t0 + 0.08)) * alpha;
  const font = { f: 'display', w: 900, s: size, st: 'expanded' };
  const tw = measure(g, word, font, 1);
  const w = tw + size * 1.3, h = size * 1.75;
  around(g, x, y, { rot, sc, alpha: a }, () => {
    rr(g, -w / 2 + 6, -h / 2 + 7, w, h, 12); g.fillStyle = C.ink; g.fill();
    rr(g, -w / 2, -h / 2, w, h, 12); g.fillStyle = going ? C.honey : C.pink; g.fill();
    g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    rr(g, -w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 7);
    g.lineWidth = 2; g.strokeStyle = going ? 'rgba(23,10,54,0.45)' : 'rgba(255,255,255,0.75)'; g.stroke();
    if (going) text(g, word, { x: 0, y: size * 0.36, font, color: C.ink, align: 'center', spacing: 1 });
    else text(g, word, { x: 0, y: size * 0.36, font, color: C.white, align: 'center', spacing: 1, stroke: { color: C.ink, width: 5 } });
  });
}

// "We're here": a pink tag on a stem, its dot on the road, pinging
export function herePin(g, x, roadY, t, t0, { alpha = 1 } = {}) {
  if (t < t0) return;
  const drop = spring(t, t0, { freq: 2.6, damp: 0.38 });
  const dy = (1 - drop) * -260;
  const a = clamp(prog(t, t0, t0 + 0.1)) * alpha;
  g.save();
  g.globalAlpha *= a;
  // its dot, and a ring that pings out of it every second and a half
  const ping = ((t - t0) % 1.5) / 1.5;
  g.beginPath(); g.arc(x, roadY, 14 + ping * 34, 0, Math.PI * 2);
  g.lineWidth = 4 * (1 - ping); g.strokeStyle = `rgba(255,77,166,${1 - ping})`; g.stroke();
  g.beginPath(); g.arc(x, roadY, 14, 0, Math.PI * 2);
  g.fillStyle = C.pink; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  // the stem and the tag, dropping in
  const tagY = roadY - 150 + dy;
  g.fillStyle = C.ink;
  g.fillRect(x - 2, tagY + 24, 4, roadY - 14 - (tagY + 24));
  const font = { f: 'mono', w: 700, s: 22 };
  const box = pill(g, LABELS.here, { x, y: tagY, font, bg: C.pink, color: C.ink, line: C.ink, lw: 3, h: 50, padX: 22, shadow: 5, upper: true, spacing: 1.5 });
  void box;
  g.restore();
}

// ---------- the meter: "2 of 10", "live now · 3 under way · 5 coming soon", ten segments (the page's hero) ----------
export const METER_BOX = { w: 540, h: 196 };
export function meter(g, x, y, t, t0, { sc = 1, alpha = 1, rot = -0.02 } = {}) {
  if (t < t0) return;
  const k = popK(t, t0, 0.55);
  const { w, h } = METER_BOX;
  around(g, x, y, { sc: k * sc, alpha: clamp(k * 3) * alpha, rot }, () => {
    rr(g, -w / 2, -h / 2 + 9, w, h, 24); g.fillStyle = C.ink; g.fill();
    rr(g, -w / 2, -h / 2, w, h, 24); g.fillStyle = C.white; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    const big = { f: 'display', w: 900, s: 76, st: 'semi-expanded' };
    const left = -w / 2 + 36;
    const nw = popWord(g, METER.n, left, -12, { font: big, fill: C.violet, stroke: null, sw: 0, echo: C.pink, off: 4, align: 'left' });
    text(g, METER.of, { x: left + nw + 14, y: -12, font: { ...big, s: 46 }, color: C.ink, spacing: -1 });
    text(g, METER.text, { x: left, y: 26, font: { f: 'mono', w: 600, s: 17 }, color: 'rgba(23,10,54,0.72)', spacing: 0.4 });
    // a segment for each step, in the page's order: pink (live), half pink (under way), white (coming soon), striped
    // (locked), each lighting in turn
    const order = { live: 0, going: 1, soon: 2, locked: 3 };
    const segs = STEPS.map((s) => s.state).sort((a, b) => order[a] - order[b]);
    const sw = 40, gap = 6, sx = left, sy = 49;
    segs.forEach((state, i) => {
      const on = popK(t, t0 + 0.12 + i * 0.045, 0.3);
      const bx = sx + i * (sw + gap);
      around(g, bx + sw / 2, sy + 9, { sc: 0.6 + 0.4 * on }, () => {
        rr(g, -sw / 2, -9, sw, 18, 6);
        g.fillStyle = state === 'live' ? C.pink : C.white; g.fill();
        if (state === 'going' || state === 'locked') {
          g.save(); rr(g, -sw / 2, -9, sw, 18, 6); g.clip();
          if (state === 'going') { g.fillStyle = C.pink; g.fillRect(-sw / 2, -9, sw / 2, 18); }
          else {
            g.strokeStyle = C.ink; g.lineWidth = 2;
            for (let s2 = -30; s2 < 40; s2 += 6) { g.beginPath(); g.moveTo(s2, 10); g.lineTo(s2 + 20, -10); g.stroke(); }
          }
          g.restore();
        }
        rr(g, -sw / 2, -9, sw, 18, 6);
        g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      });
    });
  });
}
