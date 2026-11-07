// ROBOTAXI RUSH: what's drawn over the road: the speedometer and the shields (bottom left), the boost meter (bottom
// right, where a touchscreen has its BOOST button instead), the chain of near misses (top), the checkpoint banner, and
// AGI-1's little lines with her face. Sticker style, like the arcade's top bar: paper, ink outlines, hard shadows.
import { roundRect, clamp, ease } from '../kit/fx.js';
import { INK, PAPER, HONEY, PINK, MINT, LAV, VIOLET } from './zones.js';
import { SHIELDS, NEAR_MISS, ZONE_NAMES } from './config.js';
import { kmh } from './sim.js';

const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, Menlo, monospace";
const SERIF = "'AK Serif', Georgia, serif";
export function font(g, weight, size, family = DISPLAY, stretch = 'expanded') {
  g.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in g) g.fontStretch = family === DISPLAY ? stretch : 'normal';
}

// a sticker: a rounded box with an ink outline and a hard ink shadow
function sticker(g, x, y, w, h, r, fill, { lw = 2.5, shadow = 3 } = {}) {
  if (shadow) { roundRect(g, x, y + shadow, w, h, r); g.fillStyle = INK; g.fill(); }
  roundRect(g, x, y, w, h, r);
  g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
}
function shieldPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s); g.lineTo(x + s * 0.85, y - s * 0.68);
  g.bezierCurveTo(x + s * 0.85, y + s * 0.2, x + s * 0.5, y + s * 0.72, x, y + s);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.72, x - s * 0.85, y + s * 0.2, x - s * 0.85, y - s * 0.68);
  g.closePath();
}

export function createHud() {
  const st = {
    shieldPop: [0, 0, 0], lastShields: SHIELDS,
    combo: 0, comboPop: 0, comboOut: 0, comboShown: 0,
    banner: null,           // { title, sub, pts, t }
    say: null,              // { text, t, dur }
    readyPulse: 0,
    speedShown: 0,
  };

  function event(e, run) {
    if (e.type === 'near') { st.combo = e.combo; st.comboShown = e.combo; st.comboPop = 1; st.comboOut = 0; }
    if (e.type === 'chainEnd') { st.comboOut = 1; }
    if (e.type === 'crash') { st.comboOut = st.combo >= 2 ? 1 : 0; st.combo = 0; }
    if (e.type === 'checkpoint') st.banner = { title: 'Checkpoint', sub: ZONE_NAMES[e.zone] || '', pts: e.pts, t: 0 };
    if (e.type === 'ready') st.readyPulse = 1;
  }
  function say(text, dur = 2.6) { st.say = { text, t: 0, dur }; }

  function update(dt, run) {
    for (let i = 0; i < 3; i++) st.shieldPop[i] = Math.max(0, st.shieldPop[i] - dt * 2.2);
    if (run.shields !== st.lastShields) {
      const i = run.shields < st.lastShields ? run.shields : run.shields - 1;
      if (i >= 0 && i < 3) st.shieldPop[i] = 1;
      st.lastShields = run.shields;
    }
    st.comboPop = Math.max(0, st.comboPop - dt * 3.2);
    if (st.comboOut > 0) { st.comboOut = Math.max(0, st.comboOut - dt * 2.4); if (!st.comboOut) st.comboShown = 0; }
    if (st.banner) { st.banner.t += dt; if (st.banner.t > 2.4) st.banner = null; }
    if (st.say) { st.say.t += dt; if (st.say.t > st.say.dur) st.say = null; }
    st.readyPulse = Math.max(0, st.readyPulse - dt * 0.7);
    st.speedShown += (kmh(run.speed) - st.speedShown) * Math.min(1, dt * 14);
  }
  function reset() { st.combo = 0; st.comboShown = 0; st.comboOut = 0; st.banner = null; st.say = null; st.lastShields = SHIELDS; st.shieldPop.fill(0); }

  // h: { view, safe {l, r, b, t}, top (the bar), demo, touch, face (her picture, maybe not loaded), time }
  function draw(g, run, h) {
    const W = h.view.w, H = h.view.h;
    const u = clamp(Math.min(W, H * 1.1) / 430, 0.78, 1.3);
    const pad = 14 * u;
    const L = pad + h.safe.l, B = H - pad - h.safe.b, R = W - pad - h.safe.r;
    g.save();
    g.textBaseline = 'middle';

    // ---- the speedometer: km/h, a strip of lights, the shields above it
    const sw = 132 * u, sh = 58 * u;
    const sx = L, sy = B - sh;
    sticker(g, sx, sy, sw, sh, 16 * u, PAPER);
    const v = Math.round(st.speedShown);
    font(g, 750, 27 * u, MONO);
    g.fillStyle = INK; g.textAlign = 'left';
    g.fillText(String(v).padStart(3, ' '), sx + 12 * u, sy + 23 * u);
    font(g, 850, 9.5 * u);
    g.fillStyle = '#4a3d6e';
    g.fillText('KM/H', sx + 12 * u + 60 * u, sy + 25 * u);
    const segs = 12, frac = clamp((v - 120) / 320, 0, 1);
    for (let i = 0; i < segs; i++) {
      const on = i < Math.round(frac * segs);
      g.fillStyle = on ? (i >= 9 ? PINK : i >= 6 ? HONEY : MINT) : '#e6dcf7';
      roundRect(g, sx + 12 * u + i * 9.2 * u, sy + 40 * u, 7 * u, 8 * u, 2 * u); g.fill();
    }
    // the shields
    const ss = 11 * u;
    for (let i = 0; i < SHIELDS; i++) {
      const have = i < run.shields;
      const pop = st.shieldPop[i];
      const cx = sx + 14 * u + i * 30 * u, cy = sy - 20 * u;
      const k = 1 + ease.outBack(pop) * 0.35 * (pop > 0 ? 1 : 0);
      g.save(); g.translate(cx, cy); g.scale(k, k);
      shieldPath(g, 0, 3 * u, ss); g.fillStyle = INK; g.fill();
      shieldPath(g, 0, 0, ss);
      g.fillStyle = have ? MINT : 'rgba(255,250,240,.16)'; g.fill();
      g.lineWidth = 2.4 * u; g.strokeStyle = have ? INK : 'rgba(255,250,240,.55)'; g.stroke();
      if (!have && pop > 0) { g.strokeStyle = PINK; g.lineWidth = 2.6 * u; g.beginPath(); g.moveTo(-ss * 0.5, -ss * 0.6); g.lineTo(ss * 0.1, 0); g.lineTo(-ss * 0.2, ss * 0.2); g.lineTo(ss * 0.4, ss * 0.7); g.stroke(); }
      g.restore();
    }

    // ---- the boost meter (a touchscreen has its button there instead)
    if (!h.touch || h.demo) {
      const bw = 156 * u, bh = 44 * u, bx = R - bw, by = B - bh;
      const ready = run.boost >= 1 && run.boostT <= 0, active = run.boostT > 0;
      const pulse = ready ? 0.5 + 0.5 * Math.sin(h.time * 7) : 0;
      sticker(g, bx, by - pulse * 2 * u, bw, bh, 14 * u, ready ? HONEY : active ? MINT : PAPER);
      const fx = bx + 10 * u, fw = bw - 20 * u, fy = by + bh - 15 * u - pulse * 2 * u;
      roundRect(g, fx, fy, fw, 7 * u, 3.5 * u); g.fillStyle = 'rgba(23,10,54,.18)'; g.fill();
      if (run.boost > 0.01) { roundRect(g, fx, fy, Math.max(7 * u, fw * run.boost), 7 * u, 3.5 * u); g.fillStyle = active ? INK : ready ? PINK : VIOLET; g.fill(); }
      font(g, 900, 12.5 * u);
      g.fillStyle = INK; g.textAlign = 'left';
      g.fillText(active ? 'BOOSTING' : ready ? 'BOOST READY' : 'BOOST', fx, by + 14 * u - pulse * 2 * u);
      if (!h.demo) {
        font(g, 700, 10.5 * u, MONO);
        g.textAlign = 'right';
        g.fillStyle = ready ? INK : '#4a3d6e';
        g.fillText(ready ? 'SPACE' : `${Math.floor(run.boost * 100)}%`, bx + bw - 10 * u, by + 14 * u - pulse * 2 * u);
      }
    }

    // ---- the chain of near misses: ×n, and how long until it runs out
    const shown = st.comboShown;
    if (shown >= 2 || (st.comboOut > 0 && shown >= 2)) {
      const out = st.comboOut > 0 ? 1 - st.comboOut : 0;
      const pop = ease.outBack(1 - st.comboPop) * 0.25 + 0.75 + st.comboPop * 0.25;
      const cy = h.top + 34 * u + (h.demo ? 6 * u : 0);
      g.save();
      g.globalAlpha = 1 - out;
      g.translate(W / 2, cy - out * 16 * u);
      g.scale(pop, pop);
      g.rotate(-0.035);
      const mult = Math.min(shown, NEAR_MISS.maxMult);
      const label = `×${mult}`;
      font(g, 900, 30 * u);
      const tw = g.measureText(label).width;
      font(g, 900, 11 * u);
      const lw = g.measureText('CHAIN').width;
      const bw = tw + lw + 34 * u, bh = 44 * u;
      sticker(g, -bw / 2, -bh / 2, bw, bh, bh / 2, shown >= 8 ? PINK : shown >= 4 ? HONEY : PAPER, { shadow: 3.5 * u });
      font(g, 900, 30 * u); g.fillStyle = INK; g.textAlign = 'left';
      g.fillText(label, -bw / 2 + 14 * u, 2 * u);
      font(g, 900, 11 * u);
      g.fillText('CHAIN', -bw / 2 + 20 * u + tw, 1 * u);
      // the time left in the chain
      const left = st.comboOut > 0 ? 0 : clamp(run.comboT / NEAR_MISS.chain, 0, 1);
      roundRect(g, -bw / 2 + 14 * u, bh / 2 - 8 * u, (bw - 28 * u) * left, 4 * u, 2 * u); g.fillStyle = INK; g.fill();
      g.restore();
    }

    // ---- the checkpoint banner
    if (st.banner) {
      const b = st.banner;
      const tIn = clamp(b.t / 0.35, 0, 1), tOut = clamp((b.t - 1.9) / 0.4, 0, 1);
      const y = H * 0.3 + (1 - ease.outBack(tIn)) * -40 * u - tOut * 30 * u;
      g.save();
      g.globalAlpha = 1 - tOut;
      g.translate(W / 2, y);
      g.rotate(-0.04);
      font(g, 900, 30 * u);
      const tw = Math.max(g.measureText(b.title.toUpperCase()).width, 150 * u);
      const bw = tw + 44 * u, bh = 52 * u;
      sticker(g, -bw / 2, -bh / 2, bw, bh, 14 * u, HONEY, { lw: 3, shadow: 5 * u });
      g.fillStyle = INK; g.textAlign = 'center';
      g.fillText(b.title.toUpperCase(), 0, 2 * u);
      font(g, 900, 13 * u);
      const sub = `${b.sub.toUpperCase()}  ·  +${b.pts.toLocaleString('en-US')}`;
      const sw2 = g.measureText(sub).width + 28 * u;
      sticker(g, -sw2 / 2, bh / 2 + 6 * u, sw2, 28 * u, 14 * u, PAPER, { shadow: 3 * u });
      g.fillStyle = INK; g.fillText(sub, 0, bh / 2 + 21 * u);
      g.restore();
    }

    // ---- AGI-1's line, with her face
    if (st.say) {
      const s = st.say;
      const tIn = clamp(s.t / 0.3, 0, 1), tOut = clamp((s.t - (s.dur - 0.35)) / 0.35, 0, 1);
      const fr = 21 * u;
      const x0 = L + 2 * u, y0 = h.top + 16 * u + (h.demo ? 0 : 52 * u);
      font(g, 400, 17 * u, SERIF);
      g.font = `italic 400 ${17 * u}px ${SERIF}`;
      const maxW = Math.min(W - x0 - 2 * fr - 30 * u - h.safe.r, 300 * u);
      const words = s.text.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const tw = Math.max(...lines.map((l) => g.measureText(l).width));
      const bw = tw + 24 * u, bh = lines.length * 20 * u + 16 * u;
      g.save();
      g.globalAlpha = 1 - tOut;
      g.translate((1 - ease.outBack(tIn)) * -30 * u, 0);
      // her face in a round sticker
      g.beginPath(); g.arc(x0 + fr, y0 + fr + 3 * u, fr, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.save(); g.beginPath(); g.arc(x0 + fr, y0 + fr, fr, 0, Math.PI * 2); g.fillStyle = LAV; g.fill(); g.clip();
      if (h.face && h.face.complete && h.face.naturalWidth) g.drawImage(h.face, x0, y0, fr * 2, fr * 2);
      g.restore();
      g.beginPath(); g.arc(x0 + fr, y0 + fr, fr, 0, Math.PI * 2); g.lineWidth = 2.5 * u; g.strokeStyle = INK; g.stroke();
      const bx = x0 + fr * 2 + 8 * u, by = y0 + 2 * u;
      sticker(g, bx, by, bw, bh, 12 * u, '#ffffff', { lw: 2.2 * u, shadow: 3 * u });
      g.fillStyle = INK; g.textAlign = 'left';
      lines.forEach((l, i) => g.fillText(l, bx + 12 * u, by + 18 * u + i * 20 * u));
      g.restore();
    }

    // ---- the demo has no top bar: its score and distance here
    if (h.demo) {
      font(g, 900, 10 * u);
      const items = [['KM', (run.z * (1 / 144) / 1000).toFixed(2)], ['SCORE', run.score.toLocaleString('en-US')]];
      let x = L;
      for (const [k, val] of items) {
        font(g, 750, 16 * u, MONO);
        const vw = g.measureText(val).width;
        font(g, 900, 9.5 * u);
        const kw = g.measureText(k).width;
        const bw = vw + kw + 30 * u, bh = 32 * u;
        sticker(g, x, pad + h.safe.t, bw, bh, bh / 2, PAPER, { shadow: 2.5 * u });
        g.fillStyle = '#4a3d6e'; g.textAlign = 'left';
        g.fillText(k, x + 12 * u, pad + h.safe.t + bh / 2 + 1 * u);
        font(g, 750, 16 * u, MONO); g.fillStyle = INK;
        g.fillText(val, x + 18 * u + kw, pad + h.safe.t + bh / 2 + 1 * u);
        x += bw + 8 * u;
      }
    }
    g.restore();
  }

  return { event, update, draw, say, reset, state: st };
}
