// FINAL ANSWER: live 60fps Game-Show Studio Stage renderer (Canvas 2D).
// Sweeping volumetric spotlights, reactive midnight-to-gold tier palettes, perspective Hot Seat studio floor,
// twinkling arena crowd arc, laser slice FX, pulse shockwaves, and starburst confetti!
import { Particles, Shake, clamp, lerp, rng } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

const THEMES = {
  1: { top: '#110730', mid: '#1d1054', bot: '#0c0520', beamA: 'rgba(124, 92, 255, 0.26)', beamB: 'rgba(63, 240, 195, 0.18)', ring: '#8b66ff' },
  2: { top: '#180736', mid: '#321269', bot: '#0e0522', beamA: 'rgba(255, 77, 166, 0.24)', beamB: 'rgba(139, 102, 255, 0.22)', ring: '#ff4da6' },
  3: { top: '#1f0628', mid: '#44124f', bot: '#12041b', beamA: 'rgba(255, 201, 51, 0.25)', beamB: 'rgba(255, 77, 166, 0.25)', ring: '#ffc933' },
  4: { top: '#211008', mid: '#4b234d', bot: '#12061c', beamA: 'rgba(255, 215, 70, 0.34)', beamB: 'rgba(255, 110, 180, 0.26)', ring: '#ffe066' },
};

export function createStudioRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const parts = new Particles(520);
  const shake = new Shake({ max: 11, decay: 2.2 });
  const dustDice = rng(20261123);

  const motes = Array.from({ length: 44 }, () => ({
    x: dustDice.next(),
    y: dustDice.next(),
    r: 1.2 + dustDice.next() * 2.4,
    vy: 0.015 + dustDice.next() * 0.035,
    ph: dustDice.next() * Math.PI * 2,
    gold: dustDice.next() < 0.38,
  }));

  const crowd = Array.from({ length: 68 }, (_, i) => {
    const row = i % 3;
    const t = (i / 67) * Math.PI;
    return {
      ang: Math.PI * 0.08 + t * 0.84,
      row,
      ph: dustDice.next() * Math.PI * 2,
      col: dustDice.next() < 0.34 ? '#ffc933' : dustDice.next() < 0.5 ? '#ff4da6' : '#8b66ff',
    };
  });

  const beams = [
    { ax: 0.1,  base: 0.42, amp: 0.26, spd: 0.52, ph: 0.0, w: 0.14, warm: false },
    { ax: 0.28, base: 0.22, amp: 0.22, spd: 0.64, ph: 1.4, w: 0.13, warm: true  },
    { ax: 0.46, base: 0.06, amp: 0.18, spd: 0.48, ph: 2.7, w: 0.12, warm: false },
    { ax: 0.54, base: -0.06, amp: 0.18, spd: 0.51, ph: 4.0, w: 0.12, warm: true  },
    { ax: 0.72, base: -0.22, amp: 0.22, spd: 0.61, ph: 5.1, w: 0.13, warm: false },
    { ax: 0.9,  base: -0.42, amp: 0.26, spd: 0.55, ph: 0.8, w: 0.14, warm: true  },
  ];

  let t = 0;
  let tier = 1;
  let mood = 'idle';      // idle | play | suspense | correct | wrong | million
  let fever = false;
  let suspenseMix = 0;
  let flash = 0;
  let flashColor = '#3ff0c3';
  let lasers = [];        // { t, dur, y1, y2 }
  let rings = [];         // { t, dur, color }
  let w = 1, h = 1, dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }

  function burstCorrect(isBig = false) {
    mood = isBig ? 'million' : 'correct';
    flash = REDUCED ? 0 : (isBig ? 0.5 : 0.26);
    flashColor = isBig ? '#ffc933' : '#3ff0c3';
    rings.push({ t: 0, dur: 0.85, color: isBig ? '#ffc933' : '#3ff0c3' });
    if (isBig) rings.push({ t: -0.18, dur: 1.0, color: '#ff4da6' });
    if (REDUCED) return;
    const count = isBig ? 95 : 36;
    const cols = ['#3ff0c3', '#ffc933', '#ff4da6', '#fffaf0', '#8b66ff'];
    parts.burst({
      x: w * 0.5, y: h * 0.46, count,
      speed: [140, isBig ? 560 : 380],
      life: [0.6, isBig ? 2.1 : 1.15],
      size: [6, 12],
      colors: cols, gravity: 380, drag: 1.4, shape: 'star', spin: 7, stroke: '#170a36',
    });
    if (isBig) {
      for (let i = 0; i < 5; i++) {
        parts.burst({
          x: w * (0.14 + i * 0.18), y: h * 0.15, count: 24,
          speed: [90, 380], angle: [Math.PI * 0.15, Math.PI * 0.85],
          life: [1.2, 2.5], size: [6, 13],
          colors: cols, gravity: 460, drag: 1.1, shape: 'square', spin: 9, stroke: '#170a36',
        });
      }
      shake.kick(0.42);
    } else {
      shake.kick(0.16);
    }
  }

  function burstWrong() {
    mood = 'wrong';
    flash = REDUCED ? 0 : 0.28;
    flashColor = '#ff4da6';
    rings.push({ t: 0, dur: 0.75, color: '#ff4da6' });
    if (!REDUCED) {
      shake.kick(0.36);
      parts.burst({
        x: w * 0.5, y: h * 0.52, count: 24,
        speed: [110, 320], life: [0.35, 0.8], size: [5, 9],
        colors: ['#ff4da6', '#ff5a5f', '#170a36'], gravity: 520, drag: 2.2, shape: 'square', spin: 8,
      });
    }
  }

  function fireLasers() {
    if (REDUCED) return;
    lasers.push({ t: 0, dur: 0.55, y1: h * 0.42, y2: h * 0.64 });
    parts.burst({
      x: w * 0.5, y: h * 0.56, count: 26,
      speed: [140, 420], life: [0.3, 0.7], size: [3, 7],
      colors: ['#3ff0c3', '#ffc933', '#fffaf0'], gravity: 280, drag: 2.8, shape: 'circle',
    });
    shake.kick(0.14);
  }

  function pulseRing(color = '#ffc933') {
    rings.push({ t: 0, dur: 0.7, color });
  }

  function update(dt) {
    t += dt;
    const targetSusp = mood === 'suspense' ? 1 : 0;
    suspenseMix = lerp(suspenseMix, targetSusp, clamp(dt * 4.5, 0, 1));
    if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
    parts.update(dt);
    shake.update(dt);
    if (!REDUCED) {
      const sp = fever ? 1.9 : 1;
      for (const m of motes) {
        m.y -= m.vy * dt * sp;
        if (m.y < -0.05) { m.y = 1.05; m.x = (m.x + 0.37) % 1; }
      }
    }
    for (let i = lasers.length - 1; i >= 0; i--) {
      lasers[i].t += dt;
      if (lasers[i].t >= lasers[i].dur) lasers.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].t += dt;
      if (rings[i].t >= rings[i].dur) rings.splice(i, 1);
    }
  }

  function draw() {
    if (!ctx) return;
    resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sx = REDUCED ? 0 : shake.x;
    const sy = REDUCED ? 0 : shake.y;
    ctx.save();
    ctx.translate(sx, sy);

    const th = THEMES[tier] || THEMES[1];
    // 1. Deep televised studio dome gradient
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.28, 12, w * 0.5, h * 0.52, Math.max(w, h) * 0.86);
    bg.addColorStop(0, th.mid);
    bg.addColorStop(0.55, th.top);
    bg.addColorStop(1, th.bot);
    ctx.fillStyle = bg;
    ctx.fillRect(-16, -16, w + 32, h + 32);

    // 2. Dim studio darkness smoothly during Final Answer suspense
    if (suspenseMix > 0.01) {
      ctx.fillStyle = `rgba(6, 2, 18, ${(suspenseMix * 0.52).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Distant studio audience LED arc
    const cx = w * 0.5;
    const arcY = h * 0.72;
    const rxBase = Math.min(w * 0.62, 620);
    const ryBase = Math.min(h * 0.24, 175);
    for (const c of crowd) {
      const scale = 0.82 + c.row * 0.14;
      const x = cx - Math.cos(c.ang) * rxBase * scale;
      const y = arcY - Math.sin(c.ang) * ryBase * scale * 0.55;
      const pulse = REDUCED ? 0.32 : 0.16 + 0.26 * (0.5 + 0.5 * Math.sin(t * 2.2 + c.ph));
      const dim = 1 - suspenseMix * 0.65;
      ctx.globalAlpha = pulse * dim;
      ctx.fillStyle = c.col;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + c.row * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Perspective Hot Seat studio floor rings
    const floorY = h * 0.86;
    const floorRx = Math.min(w * 0.54, 480);
    const floorRy = Math.min(h * 0.16, 108);
    ctx.save();
    const floorGlow = ctx.createRadialGradient(cx, floorY, 10, cx, floorY, floorRx);
    floorGlow.addColorStop(0, fever ? 'rgba(255, 201, 51, 0.24)' : 'rgba(107, 59, 255, 0.22)');
    floorGlow.addColorStop(0.65, 'rgba(23, 10, 54, 0.12)');
    floorGlow.addColorStop(1, 'rgba(23, 10, 54, 0)');
    ctx.fillStyle = floorGlow;
    ctx.beginPath();
    ctx.ellipse(cx, floorY, floorRx * 1.12, floorRy * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Concentric stage rings
    const ringCol = mood === 'correct' ? '#3ff0c3' : mood === 'wrong' ? '#ff4da6' : mood === 'million' ? '#ffc933' : th.ring;
    for (let i = 1; i <= 4; i++) {
      const k = i / 4;
      const pulse = REDUCED ? 0 : Math.sin(t * (2.6 + tier * 0.5) - i * 0.9) * 0.08;
      ctx.strokeStyle = ringCol;
      ctx.globalAlpha = clamp((0.26 - k * 0.04 + pulse) * (1 - suspenseMix * 0.35), 0.05, 0.45);
      ctx.lineWidth = i === 1 ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, floorY, floorRx * k, floorRy * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Radial floor light spokes
    ctx.globalAlpha = 0.12 * (1 - suspenseMix * 0.5);
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * Math.PI * 2 + (REDUCED ? 0 : t * (fever ? 0.18 : 0.06));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * floorRx * 0.22, floorY + Math.sin(a) * floorRy * 0.22);
      ctx.lineTo(cx + Math.cos(a) * floorRx, floorY + Math.sin(a) * floorRy);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Sweeping volumetric stage spotlights!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const speedMult = fever ? 1.85 : 1 + (tier - 1) * 0.2;
    for (const b of beams) {
      const ox = w * b.ax;
      const oy = -28;
      // Smooth oscillation; during suspense beams converge dramatically toward center stage!
      const sway = REDUCED ? 0 : Math.sin(t * b.spd * speedMult + b.ph) * b.amp;
      const centerAngle = Math.atan2(cx - ox, h * 0.58 - oy);
      const freeAngle = b.base + sway;
      const ang = lerp(freeAngle, centerAngle, suspenseMix * 0.78);
      const len = Math.hypot(w, h) * 1.15;
      const spread = (b.w * lerp(1, 0.58, suspenseMix)) * (fever ? 1.15 : 1);

      const x1 = ox + Math.sin(ang - spread) * len;
      const y1 = oy + Math.cos(ang - spread) * len;
      const x2 = ox + Math.sin(ang + spread) * len;
      const y2 = oy + Math.cos(ang + spread) * len;

      const grad = ctx.createLinearGradient(ox, oy, ox + Math.sin(ang) * len * 0.78, oy + Math.cos(ang) * len * 0.78);
      let col = b.warm ? th.beamB : th.beamA;
      if (mood === 'correct') col = 'rgba(63, 240, 195, 0.3)';
      else if (mood === 'wrong') col = 'rgba(255, 77, 166, 0.26)';
      else if (mood === 'million') col = 'rgba(255, 201, 51, 0.36)';
      else if (suspenseMix > 0.35) col = b.warm ? 'rgba(255, 201, 51, 0.26)' : 'rgba(139, 102, 255, 0.16)';
      grad.addColorStop(0, col);
      grad.addColorStop(0.65, col.replace(/[\d.]+\)$/, '0.06)'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 6. Floating stage stardust
    for (const m of motes) {
      const a = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4 + m.ph));
      ctx.globalAlpha = a * (1 - suspenseMix * 0.4);
      ctx.fillStyle = m.gold ? '#ffc933' : '#e4d9ff';
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 7. Expanding energy rings (correct / milestone / lock)
    for (const r of rings) {
      if (r.t < 0) continue;
      const k = clamp(r.t / r.dur, 0, 1);
      const rad = lerp(24, Math.max(w, h) * 0.62, 1 - (1 - k) ** 3);
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - k) * 0.65;
      ctx.lineWidth = Math.max(1.5, 7 * (1 - k));
      ctx.beginPath();
      ctx.arc(cx, h * 0.48, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 8. 50:50 Laser slice beams
    for (const l of lasers) {
      const k = clamp(l.t / l.dur, 0, 1);
      const sweep = Math.min(1, k * 2.4);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = '#3ff0c3';
      ctx.lineWidth = 6 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, l.y1);
      ctx.lineTo(w * sweep, l.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ff4da6';
      ctx.lineWidth = 4 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.moveTo(w, l.y1 + 24);
      ctx.lineTo(w * (1 - sweep), l.y2 - 20);
      ctx.stroke();
      ctx.restore();
    }

    // 9. Particles (confetti / sparks)
    parts.draw(ctx);

    // 10. Soft color flash
    if (flash > 0.005) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flash;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  return {
    resize,
    update,
    draw,
    setTier(n) { tier = Math.max(1, Math.min(4, n | 0)); },
    setMood(m) { mood = m || 'idle'; },
    setFever(on) { fever = Boolean(on); },
    burstCorrect,
    burstWrong,
    fireLasers,
    pulseRing,
    clear() { parts.clear(); lasers = []; rings = []; flash = 0; },
  };
}
