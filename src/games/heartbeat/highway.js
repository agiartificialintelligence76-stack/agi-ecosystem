// HEARTBEAT (2026-11-08): the highway, drawn in perspective from AGI-1's stage down to the hit line: four lanes, the
// beat's lines rolling down with the notes, hearts (the notes), ribbons (holds), the hit line (a string of heart beads
// with a hollow heart per lane), the lanes lighting up when pressed, and everything a run says on top of it: the
// judgment, the combo, FEVER, the song's intro card, the countdown after a pause, the stamp at the end.
import { LANE_COLORS, INK, PAPER, drawHeart, heartPath } from './sprites.js';
import { project, laneX, depthOf } from './layout.js';
import { clamp, ease, rgba, TAU, mix } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

const JUDGE_STYLE = {
  perfect: { text: 'PERFECT', fill: '#ffc933', shadow: '#ff4da6' },
  great: { text: 'GREAT', fill: '#3ff0c3', shadow: INK },
  good: { text: 'GOOD', fill: '#cdb8ff', shadow: INK },
  miss: { text: 'MISS', fill: '#ff7a8a', shadow: INK },
  break: { text: 'BREAK', fill: '#ff7a8a', shadow: INK },
};

let wideText = null;
function setFont(ctx, weight, size, family = "'AK Display', 'Arial Black', sans-serif", stretch = 'expanded') {
  ctx.font = `${weight} ${size}px ${family}`;
  if (wideText === null) wideText = 'fontStretch' in ctx;
  if (wideText) ctx.fontStretch = stretch;
}

// words with an ink outline and a hard ink shadow (the arcade's sticker type)
export function stickerText(ctx, text, x, y, size, fill, { shadow = INK, stroke = INK, align = 'center', weight = 900, stretch = 'expanded' } = {}) {
  setFont(ctx, weight, size, undefined, stretch);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lw = Math.max(3, size * 0.16);
  ctx.lineWidth = lw;
  ctx.strokeStyle = shadow;
  ctx.strokeText(text, x, y + size * 0.09);
  ctx.fillStyle = shadow;
  ctx.fillText(text, x, y + size * 0.09);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function pill(ctx, x, y, w, h, fill, { stroke = INK, shadow = 3 } = {}) {
  const r = h / 2;
  const path = (dy) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y + dy); ctx.arcTo(x + w, y + dy, x + w, y + h + dy, r); ctx.arcTo(x + w, y + h + dy, x, y + h + dy, r);
    ctx.arcTo(x, y + h + dy, x, y + dy, r); ctx.arcTo(x, y + dy, x + w, y + dy, r); ctx.closePath();
  };
  if (shadow) { path(shadow); ctx.fillStyle = INK; ctx.fill(); }
  path(0); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
}

// the s of a screen y (below the hit line: negative)
function depthAtY(L, y) {
  const k = 1 - (L.hitY - y) * (1 - L.ratio) / (L.hitY - L.farY);
  return (1 / Math.max(0.05, k) - 1) / L.c;
}

const BULBS = ['#ffc933', '#ff4da6', '#fff4d6', '#3ff0c3'];
const DOT_OF = { '#ffc933': 1, '#ff4da6': 0, '#fff4d6': 4, '#3ff0c3': 2 };

// the combo: a big sticker number, and under it COMBO (or, while it burns, FEVER ×1.2)
// the words' places: the judgment just above the receptors, the combo in the middle of the road above it
export function hudPlaces(L) {
  const judge = clamp(L.nearW * 0.07, 19, 32);
  const judgeY = L.hitY - L.note * 0.62 - judge * 0.75;
  const combo = clamp(Math.min(L.nearW * 0.15, (L.hitY - L.farY) * 0.2), 34, 76);
  const top = L.farY + (L.hitY - L.farY) * 0.1;
  const bottom = judgeY - judge * 1.1;
  const comboY = Math.max(top + combo * 0.5, (top + bottom) / 2 - combo * 0.42);
  return { judge, judgeY, combo, comboY };
}

function drawCombo(ctx, L, v) {
  const P = hudPlaces(L);
  const size = P.combo;
  const bump = v.comboAge < 0.12 && !REDUCED ? 1 + 0.14 * (1 - v.comboAge / 0.12) : 1;
  const y = P.comboY;
  const f = v.fever > 0.5;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.translate(L.cx, y);
  ctx.scale(bump, bump);
  stickerText(ctx, String(v.combo), 0, 0, size, f ? '#ffc933' : PAPER, { shadow: f ? '#ff4da6' : INK });
  ctx.restore();
  ctx.save();
  const ly = y + size * 0.78;
  if (v.fever > 0.02) {
    const ls = Math.max(11, size * 0.23);
    setFont(ctx, 900, ls, undefined, 'expanded');
    const text = 'FEVER ×1.2';
    const w = ctx.measureText(text).width + ls * 1.5, h = ls * 1.75;
    const intro = v.feverAge < 0.35 ? ease.outBack(v.feverAge / 0.35) : 1;
    ctx.globalAlpha = Math.min(1, v.fever * 1.4);
    ctx.translate(L.cx, ly);
    ctx.rotate(-0.04);
    ctx.scale(intro * (1 + v.onBeat * 0.05), intro * (1 + v.onBeat * 0.05));
    pill(ctx, -w / 2, -h / 2, w, h, '#ff4da6', { shadow: 2.5 });
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);
  } else {
    setFont(ctx, 900, Math.max(11, size * 0.2), undefined, 'expanded');
    ctx.fillStyle = '#cdb8ff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.05)}px`;
    ctx.fillText('COMBO', L.cx, ly);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

export function createHighway(sprites) {
  let first = 0;
  let lastSong = -Infinity;
  const rings = [];

  function quad(ctx, l0, l1, s0, s1, a0 = 0, a1 = 0) {
    // a band between lane edges l0..l1 (lane units, -0.5 = left edge of lane 0) from depth s0 to s1
    const p0 = project(this, s0), p1 = project(this, s1);
    ctx.beginPath();
    ctx.moveTo(laneX(this, l0, p0.k) - a0, p0.y);
    ctx.lineTo(laneX(this, l1, p0.k) + a0, p0.y);
    ctx.lineTo(laneX(this, l1, p1.k) + a1, p1.y);
    ctx.lineTo(laneX(this, l0, p1.k) - a1, p1.y);
    ctx.closePath();
  }

  return {
    // a hit's ring at (x, y)
    ring(x, y, color, big = false) { rings.push({ x, y, color, big, age: 0 }); if (rings.length > 12) rings.shift(); },
    update(dt) {
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > 0.34) rings.splice(i, 1); }
    },
    // v: { songT, approach, notes, beats, bar, down[4], flash[4], missFlash[4], onBeat, fever, dpr, keys, touch, t,
    //      judgment {kind, age, err}, combo, comboAge, holding[4] }
    draw(ctx, L, v) {
      const q = quad.bind(L);
      const bottomS = v.keys ? depthAtY(L, L.hitY + 30) : depthAtY(L, L.h + 2);
      const fever = v.fever;
      // the road
      q(ctx, -0.5, 3.5, bottomS, 1);
      ctx.fillStyle = 'rgba(14,7,34,0.9)';
      ctx.fill();
      for (let l = 0; l < 4; l++) {
        q(ctx, l - 0.5, l + 0.5, bottomS, 1);
        ctx.fillStyle = rgba(LANE_COLORS[l], 0.035 + (v.down[l] ? 0.05 : 0));
        ctx.fill();
      }
      // pressed lanes light up
      for (let l = 0; l < 4; l++) {
        const f = Math.max(v.flash[l], v.down[l] ? 0.55 : 0);
        if (f > 0.02) {
          const p1 = project(L, 0.62);
          const g = ctx.createLinearGradient(0, L.hitY, 0, p1.y);
          g.addColorStop(0, rgba(LANE_COLORS[l], 0.42 * f));
          g.addColorStop(1, rgba(LANE_COLORS[l], 0));
          q(ctx, l - 0.48, l + 0.48, 0, 0.62);
          ctx.fillStyle = g;
          ctx.fill();
        }
        if (v.missFlash[l] > 0.02) {
          const top = project(L, 0.3).y;
          const g = ctx.createLinearGradient(0, L.h, 0, top);
          g.addColorStop(0, `rgba(255,90,95,${0.26 * v.missFlash[l]})`);
          g.addColorStop(1, 'rgba(255,90,95,0)');
          q(ctx, l - 0.5, l + 0.5, bottomS, 0.3);
          ctx.fillStyle = g;
          ctx.fill();
        }
      }
      // the beat's lines rolling down
      const beats = v.beats;
      if (beats && beats.length) {
        let k = Math.max(0, lowerBound(beats, v.songT - v.approach * 0.2));
        for (; k < beats.length; k++) {
          const s = depthOf(beats[k], v.songT, v.approach);
          if (s > 1) break;
          if (s < bottomS) continue;
          const p = project(L, s);
          const down = ((k - v.bar) % 4 + 4) % 4 === 0;
          ctx.strokeStyle = down ? 'rgba(205,184,255,0.34)' : 'rgba(205,184,255,0.12)';
          ctx.lineWidth = (down ? 2.2 : 1.2) * p.k;
          ctx.beginPath();
          ctx.moveTo(laneX(L, -0.5, p.k), p.y);
          ctx.lineTo(laneX(L, 3.5, p.k), p.y);
          ctx.stroke();
        }
      }
      // lane lines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(205,184,255,0.16)';
      const pf = project(L, 1), pb = project(L, bottomS);
      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        ctx.moveTo(laneX(L, l + 0.5, pf.k), pf.y);
        ctx.lineTo(laneX(L, l + 0.5, pb.k), pb.y);
        ctx.stroke();
      }
      // its edges: an ink rail with marquee bulbs rolling down with the song, chasing the beat (all lit in FEVER)
      for (const side of [-0.5, 3.5]) {
        const a = laneX(L, side, pf.k), b = laneX(L, side, pb.k);
        ctx.lineWidth = 7; ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.moveTo(a, pf.y); ctx.lineTo(b, pb.y); ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = fever > 0.05 ? mix('#8b66ff', '#ff4da6', fever) : '#6b3bff';
        ctx.beginPath(); ctx.moveTo(a, pf.y); ctx.lineTo(b, pb.y); ctx.stroke();
      }
      const step = 0.25 / v.approach;                    // a bulb every quarter second of song
      const phase = ((v.songT / v.approach) % step + step) % step;
      const beatN = Math.floor(v.beat || 0);
      ctx.lineWidth = 1.6;
      for (let i = 0, sb = 1 - ((1 - phase) % step); sb > bottomS; sb -= step, i++) {
        if (sb > 1) continue;
        const p = project(L, sb);
        const idx = Math.round((sb + v.songT / v.approach) / step);
        const lit = fever > 0.5 || ((idx + beatN) % 3 === 0);
        const r = 1.8 + 3.6 * p.k;
        for (const side of [-0.5, 3.5]) {
          const x = laneX(L, side, p.k);
          const col = BULBS[((idx % 4) + 4) % 4];
          if (lit) {
            const g = r * (4.2 + v.onBeat * 1.6);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.55 * (0.6 + 0.4 * p.k);
            ctx.drawImage(sprites.dots[DOT_OF[col]], x - g / 2, p.y - g / 2, g, g);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.fillStyle = lit ? col : '#3b2a66';
          ctx.beginPath(); ctx.arc(x, p.y, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = INK; ctx.stroke();
        }
      }
      // the far end melts into the stage
      const fogH = (L.hitY - L.farY) * 0.12;
      const fog = ctx.createLinearGradient(0, L.farY - 2, 0, L.farY + fogH);
      fog.addColorStop(0, 'rgba(20,10,50,0.95)');
      fog.addColorStop(1, 'rgba(20,10,50,0)');
      q(ctx, -0.55, 3.55, depthAtY(L, L.farY + fogH), 1.01);
      ctx.fillStyle = fog;
      ctx.fill();

      // the combo, behind the notes
      if (v.combo >= 4) drawCombo(ctx, L, v);

      // the hit line: a string of heart beads, a hollow heart per lane
      const hk = 1;
      const left = laneX(L, -0.5, hk), right = laneX(L, 3.5, hk);
      const sag = 5;
      ctx.lineWidth = 4; ctx.strokeStyle = INK;
      ctx.beginPath();
      for (let x = left; x <= right + 0.5; x += 4) {
        const u = ((x - left) / L.laneW) % 1;
        const y = L.hitY + Math.sin(u * Math.PI) * sag;
        if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = fever > 0.3 ? '#ffd166' : '#e4d9ff';
      ctx.stroke();
      const beadGap = Math.max(10, L.laneW / 6);
      let bi = 0;
      for (let x = left + beadGap / 2; x < right; x += beadGap, bi++) {
        const u = ((x - left) / L.laneW) % 1;
        if (u > 0.25 && u < 0.75) continue;
        const y = L.hitY + Math.sin(u * Math.PI) * sag;
        ctx.fillStyle = LANE_COLORS[bi % 4];
        ctx.beginPath(); ctx.arc(x, y, 2.6 + v.onBeat * 1.2, 0, TAU); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
      }
      const noteBase = L.note;
      for (let l = 0; l < 4; l++) {
        const x = laneX(L, l, 1);
        const held = v.holding[l];
        const press = v.down[l] || held ? 1 : 0;
        const size = noteBase * (1.06 + v.onBeat * 0.05 - press * 0.08);
        drawHeart(ctx, press ? sprites.pressed[l] : sprites.receptors[l], x, L.hitY - 2, size);
      }

      // the notes, far ones first
      const notes = v.notes;
      if (notes && notes.length) {
        if (v.songT < lastSong - 0.01) first = 0;
        lastSong = v.songT;
        while (first < notes.length && notes[first].end < v.songT - v.approach * 0.6 && (notes[first].head !== null || notes[first].end < v.songT - 1)) first++;
        let last = first;
        while (last < notes.length && notes[last].t <= v.songT + v.approach * 1.02) last++;
        // doubles: a bar between them
        for (let i = last - 1; i > first; i--) {
          const a = notes[i], b = notes[i - 1];
          if (a.t === b.t && a.head === null && b.head === null) {
            const s = depthOf(a.t, v.songT, v.approach);
            if (s < 0 || s > 1) continue;
            const p = project(L, s);
            ctx.lineWidth = 5 * p.k; ctx.strokeStyle = INK;
            ctx.beginPath(); ctx.moveTo(laneX(L, b.lane, p.k), p.y); ctx.lineTo(laneX(L, a.lane, p.k), p.y); ctx.stroke();
            ctx.lineWidth = 2.2 * p.k; ctx.strokeStyle = PAPER; ctx.stroke();
          }
        }
        for (let i = last - 1; i >= first; i--) {
          const n = notes[i];
          const hit = n.head !== null && n.head !== 'miss';
          const holding = hit && n.hold > 0 && n.tail === null;
          if (hit && n.tail === 'break' && n.cut != null) {
            // let go early: what was left of its ribbon slides away, grey
            const c0 = Math.max(bottomS, depthOf(n.cut, v.songT, v.approach)), c1 = Math.min(1, depthOf(n.end, v.songT, v.approach));
            if (c1 > c0) drawRibbon(ctx, L, q, n, c0, c1, false, v, true);
            continue;
          }
          if (hit && !holding) continue;
          let s = depthOf(n.t, v.songT, v.approach);
          const sEnd = depthOf(n.end, v.songT, v.approach);
          if (n.head === 'miss' && s < bottomS - 0.1) continue;
          if (holding) s = 0;
          if (n.hold > 0 && sEnd > bottomS) {
            const s0 = Math.max(n.head === 'miss' ? bottomS : 0, Math.min(s, 1)), s1 = Math.min(1, sEnd);
            if (s1 > s0) drawRibbon(ctx, L, q, n, s0, s1, holding, v, n.head === 'miss' || n.tail === 'break');
          }
          if (s > 1.02) continue;
          const p = project(L, Math.max(bottomS, s));
          const fadeIn = s > 0.86 ? clamp((1.02 - s) / 0.16, 0, 1) : 1;
          const size = noteBase * p.k * (holding ? 1.04 + 0.06 * Math.sin(v.t * 18) : 1);
          if (n.head === 'miss') {
            drawHeart(ctx, sprites.missed, laneX(L, n.lane, p.k), p.y, size, clamp(0.85 + s * 2, 0, 0.85));
          } else {
            drawHeart(ctx, fever > 0.5 ? sprites.fever[n.lane] : sprites.notes[n.lane], laneX(L, n.lane, p.k), p.y, size, fadeIn);
          }
        }
      }

      // keycaps under the lanes (a keyboard)
      if (v.keys) {
        const caps = sprites.keycaps(v.keys, v.dpr);
        const y = L.hitY + Math.max(36, (L.h - L.hitY) * 0.5);
        for (let l = 0; l < 4; l++) {
          const c = caps[l];
          const x = laneX(L, l, 1);
          const down = v.down[l] ? 3 : 0;
          ctx.drawImage(c.canvas, 0, down * v.dpr, c.canvas.width, c.canvas.height - down * v.dpr, x - c.w / 2, y - c.h / 2 + down, c.w, c.h - down);
        }
      }
    },

    // the run's words over the highway
    hud(ctx, L, v) {
      const cx = L.cx;
      // the hit rings
      for (const r of rings) {
        const k = r.age / 0.34;
        if (k >= 1) continue;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.strokeStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, L.note * (0.36 + 0.34 * ease.outCubic(k)) * (r.big ? 1.12 : 1), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // the judgment
      const j = v.judgment;
      if (j && j.age < 0.62) {
        const st = JUDGE_STYLE[j.kind];
        const P = hudPlaces(L);
        const size = P.judge;
        const pop = j.age < 0.12 && !REDUCED ? 1.32 - 0.32 * ease.outBack(j.age / 0.12) : 1;
        const a = j.age > 0.45 ? 1 - (j.age - 0.45) / 0.17 : 1;
        const y = P.judgeY - (j.kind === 'miss' ? 0 : ease.outCubic(Math.min(1, j.age / 0.3)) * 5);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(cx, y);
        ctx.scale(pop, pop);
        stickerText(ctx, st.text, 0, 0, size, st.fill, { shadow: st.shadow });
        if ((j.kind === 'great' || j.kind === 'good') && Math.abs(j.err) > 0.02) {
          setFont(ctx, 700, Math.max(11, size * 0.34), "'AK Mono', ui-monospace, monospace", 'normal');
          ctx.fillStyle = '#e4d9ff';
          ctx.textAlign = 'center';
          ctx.fillText(j.err < 0 ? 'EARLY' : 'LATE', 0, size * 0.82);
        }
        ctx.restore();
      }
      // the song's card while it starts
      if (v.intro && v.intro.alpha > 0.01) {
        const a = v.intro.alpha;
        const size = clamp(L.nearW * 0.09, 22, 44);
        const y = project(L, 0.55).y;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(cx, y);
        const sc = 0.9 + 0.1 * a;
        ctx.scale(sc, sc);
        stickerText(ctx, v.intro.title.toUpperCase(), 0, -size * 0.35, fitSize(ctx, v.intro.title.toUpperCase(), size, L.nearW * 0.9), PAPER);
        const tag = v.intro.tag;
        setFont(ctx, 900, size * 0.36, undefined, 'expanded');
        const tw = ctx.measureText(tag).width + size * 0.9;
        pill(ctx, -tw / 2, size * 0.45, tw, size * 0.72, v.intro.color);
        ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tag, 0, size * 0.45 + size * 0.37);
        ctx.restore();
      }
      // the first runs: what to do, just above the receptors
      if (v.hint) {
        const size = clamp(L.nearW * 0.032, 11, 15);
        setFont(ctx, 900, size, undefined, 'expanded');
        const w = ctx.measureText(v.hint).width + size * 2;
        const h = size * 2.2;
        const y = L.hitY - L.note * 0.62 - h - 6 + Math.sin(v.t * 5) * 2;
        pill(ctx, L.cx - w / 2, y, w, h, '#fffaf0', { shadow: 3 });
        ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(v.hint, L.cx, y + h / 2 + 1);
      }
      // the countdown after a pause
      if (v.countdown && v.countdown.n > 0) {
        const size = clamp(L.nearW * 0.3, 70, 150);
        const age = v.countdown.age;
        const pop = age < 0.18 && !REDUCED ? ease.outBack(age / 0.18) : 1;
        ctx.save();
        ctx.globalAlpha = age > 0.75 ? Math.max(0, 1 - (age - 0.75) / 0.25) : 1;
        ctx.translate(cx, project(L, 0.5).y);
        ctx.scale(pop, pop);
        stickerText(ctx, String(v.countdown.n), 0, 0, size, '#ffc933', { shadow: '#ff4da6' });
        ctx.restore();
      }
      // the stamp at the end
      if (v.stamp) {
        const age = v.stamp.age;
        const size = clamp(L.nearW * 0.11, 26, 58);
        const pop = age < 0.3 && !REDUCED ? 2.2 - 1.2 * ease.outBack(age / 0.3) : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, age / 0.12);
        ctx.translate(cx, project(L, 0.45).y);
        ctx.rotate(-0.08);
        ctx.scale(pop, pop);
        const text = v.stamp.text;
        setFont(ctx, 900, size, undefined, 'expanded');
        const w = Math.min(L.w * 0.9, ctx.measureText(text).width + size * 1.4);
        const fs = fitSize(ctx, text, size, w - size * 1.2);
        pill(ctx, -w / 2, -size * 0.85, w, size * 1.7, v.stamp.color, { shadow: 6 });
        stickerText(ctx, text, 0, 0, fs, PAPER);
        ctx.restore();
      }
    },
  };
}

function fitSize(ctx, text, size, maxW) {
  setFont(ctx, 900, size, undefined, 'expanded');
  const w = ctx.measureText(text).width;
  return w > maxW ? size * maxW / w : size;
}

function drawRibbon(ctx, L, q, n, s0, s1, holding, v, dead) {
  const color = dead ? '#6d6489' : LANE_COLORS[n.lane];
  const half = 0.2;
  q(ctx, n.lane - half, n.lane + half, s0, s1);
  ctx.fillStyle = dead ? 'rgba(109,100,137,0.45)' : rgba(color, holding ? 0.92 : 0.7);
  ctx.fill();
  // candy stripes, fixed to the song (they roll with it)
  if (!dead) {
    const step = 0.12 / v.approach;
    const phase = ((n.t / v.approach) % (step * 2) + step * 2) % (step * 2);
    ctx.fillStyle = holding ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.22)';
    const startS = s0 - ((s0 + phase) % (step * 2));
    for (let s = startS; s < s1; s += step * 2) {
      const a = Math.max(s0, s), b = Math.min(s1, s + step);
      if (b > a) { q(ctx, n.lane - half, n.lane + half, a, b); ctx.fill(); }
    }
  }
  q(ctx, n.lane - half, n.lane + half, s0, s1);
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  // its end: a little bow
  if (s1 < 1) {
    const p = project(L, s1);
    const x = laneX(L, n.lane, p.k);
    const r = L.laneW * 0.16 * p.k;
    ctx.fillStyle = dead ? '#6d6489' : color;
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.quadraticCurveTo(x + sgn * r * 1.6, p.y - r * 1.2, x + sgn * r * 1.5, p.y + r * 0.3);
      ctx.quadraticCurveTo(x + sgn * r * 0.8, p.y + r * 0.6, x, p.y);
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, p.y, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

function lowerBound(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

export { pill, setFont };
