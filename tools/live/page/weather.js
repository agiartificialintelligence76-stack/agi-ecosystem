// AGI-1's live show (2026-10-07, the owner: "can you add weathers also"): the weather on her set, drawn in code. Two
// canvases: one behind her (the sky's tint, a rainbow, the sun's glow, a night for shooting stars), drawn once when the
// weather changes, and one over her (rain, snow, petals, leaves, dust, fog, sparkles), drawn every frame at half size (it's
// shown at the set's size: cheaper for a server without a graphics card). Lightning is a flash over everything, when the
// runner says (it plays the thunder a moment later). The names are server/live-acts.js WEATHERS' (the tests check they're the
// same). Nothing here is plain and opaque over her picture (stage.js says why): the canvas over her is see-through, the
// flash too.

export const WEATHERS = {
  rain: { name: 'rain', tint: 'rgba(40, 50, 90, 0.28)', umbrella: true },
  storm: { name: 'a thunderstorm', tint: 'rgba(16, 12, 44, 0.5)', umbrella: true },
  snow: { name: 'snow', tint: 'rgba(225, 235, 255, 0.22)' },
  sunny: { name: 'sunshine', tint: null },
  petals: { name: 'cherry blossom petals', tint: 'rgba(255, 210, 230, 0.12)' },
  leaves: { name: 'autumn leaves', tint: 'rgba(255, 170, 80, 0.12)' },
  fog: { name: 'fog', tint: 'rgba(232, 232, 244, 0.45)' },
  rainbow: { name: 'a rainbow', tint: null },
  stars: { name: 'shooting stars', tint: 'rgba(8, 6, 40, 0.55)' },
  dust: { name: 'a dust storm', tint: 'rgba(200, 110, 60, 0.32)' },
};
export const WEATHER_IDS = Object.keys(WEATHERS);
const FW = 640, FH = 328, K = FW / 1280;          // the canvas over her: half size (1280 × 656 on the set)

// back, front: the two canvases (stage.css .wx-back under her picture, .wx-front over it); flash: the lightning element
export function createWeather({ back, front, flash, rnd = Math.random }) {
  const gb = back.getContext('2d'), gf = front.getContext('2d');
  let cur = null;                    // { id, parts, t, next }
  let fading = 0;                    // its strength: 0..1 (fades in and out)
  let target = 0, bolt = null;
  const R = (a, b) => a + rnd() * (b - a);

  function drawBack(id) {
    gb.clearRect(0, 0, 1280, 720);
    const w = WEATHERS[id];
    if (!w) return;
    if (w.tint) { gb.fillStyle = w.tint; gb.fillRect(0, 0, 1280, 720); }
    if (id === 'sunny') {
      // the sun's glow in the top right corner and its rays
      const g = gb.createRadialGradient(1180, 40, 10, 1180, 40, 520);
      g.addColorStop(0, 'rgba(255, 244, 190, 0.85)'); g.addColorStop(0.35, 'rgba(255, 220, 120, 0.35)'); g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      gb.fillStyle = g; gb.fillRect(0, 0, 1280, 720);
      gb.fillStyle = 'rgba(255, 240, 180, 0.16)';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.52 + i * 0.075);
        gb.beginPath(); gb.moveTo(1180, 40); gb.lineTo(1180 + Math.cos(a) * 1500, 40 + Math.sin(a) * 1500); gb.lineTo(1180 + Math.cos(a + 0.03) * 1500, 40 + Math.sin(a + 0.03) * 1500); gb.closePath(); gb.fill();
      }
    } else if (id === 'rainbow') {
      // an arc across the sky behind her
      const cols = ['#ff4d6d', '#ff9a3d', '#ffd23f', '#3fdc8a', '#3fa9ff', '#8a5cff'];
      gb.lineWidth = 26;
      cols.forEach((c, i) => { gb.beginPath(); gb.arc(640, 760, 720 - i * 26, Math.PI * 1.06, Math.PI * 1.94); gb.strokeStyle = c; gb.globalAlpha = 0.5; gb.stroke(); });
      gb.globalAlpha = 1;
    } else if (id === 'fog') {
      for (let i = 0; i < 4; i++) {
        const y = 200 + i * 120, g = gb.createLinearGradient(0, y - 80, 0, y + 80);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        gb.fillStyle = g; gb.fillRect(0, y - 80, 1280, 160);
      }
    }
  }
  // its particles, in the front canvas's own pixels (half size)
  function make(id) {
    const n = { rain: 150, storm: 230, snow: 110, petals: 46, leaves: 34, dust: 120, fog: 7, sunny: 14, rainbow: 12, stars: 26 }[id] || 0;
    return Array.from({ length: n }, () => spawn(id, true));
  }
  function spawn(id, anywhere = false) {
    const y0 = anywhere ? R(-FH * 0.2, FH) : R(-40, -6);
    switch (id) {
      case 'rain': case 'storm': return { x: R(-40, FW + 40), y: y0, v: id === 'storm' ? R(560, 720) : R(420, 560), len: R(9, 17), a: R(0.55, 0.9) };
      case 'snow': return { x: R(0, FW), y: y0, v: R(14, 34), r: R(1, 2.6), ph: R(0, 7), sw: R(6, 16) };
      case 'petals': return { x: R(-20, FW + 60), y: y0, v: R(22, 40), r: R(4.5, 7), ph: R(0, 7), rot: R(0, 7), vr: R(-2, 2), c: rnd() < 0.5 ? '#ffc2dc' : '#ffd6e8' };
      case 'leaves': return { x: anywhere ? R(0, FW) : FW + R(10, 60), y: anywhere ? R(0, FH) : R(-20, FH * 0.7), vx: -R(70, 130), vy: R(14, 36), r: R(6, 10), ph: R(0, 7), rot: R(0, 7), vr: R(-4, 4), c: ['#ff8a3d', '#e8562a', '#ffc23f', '#c9402f'][Math.floor(rnd() * 4)] };
      case 'dust': return { x: anywhere ? R(0, FW) : FW + R(0, 80), y: R(0, FH), vx: -R(140, 260), len: R(3, 10), a: R(0.2, 0.55), r: R(0.6, 1.6) };
      case 'fog': return { x: R(-100, FW + 100), y: R(FH * 0.25, FH * 0.95), vx: R(-10, -4), rx: R(140, 240), ry: R(30, 60) };
      case 'sunny': case 'rainbow': return { x: R(0, FW), y: R(0, FH * 0.8), ph: R(0, 7), sp: R(1, 2.2), r: R(2, 4) };
      case 'stars': return { x: R(0, FW), y: R(0, FH * 0.55), ph: R(0, 7), sp: R(1, 3), r: R(0.6, 1.4), shoot: null };
      default: return null;
    }
  }

  function set(id) {
    if (!id || !WEATHERS[id]) { target = 0; return true; }
    if (cur && cur.id === id) { target = 1; return true; }
    cur = { id, parts: make(id), t: 0, nextShoot: 0.5 };
    drawBack(id);
    fading = 0; target = 1;
    back.hidden = false; front.hidden = false;
    return true;
  }
  function lightning() {
    if (!cur) return false;
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    // a bolt from the sky, over her for a moment
    const x = R(80, FW - 80);
    const pts = [[x, -4]];
    for (let y = 0; y < FH * 0.7; y += R(18, 34)) pts.push([pts[pts.length - 1][0] + R(-24, 24), y]);
    bolt = { pts, t: 0.35 };
    return true;
  }

  function frame(dt) {
    if (!cur) return;
    fading += Math.sign(target - fading) * Math.min(Math.abs(target - fading), dt / 1.2);
    back.style.opacity = String(fading);
    front.style.opacity = String(Math.min(0.99, fading));
    if (fading <= 0 && target === 0) { cur = null; gf.clearRect(0, 0, FW, FH); gb.clearRect(0, 0, 1280, 720); back.hidden = true; front.hidden = true; return; }
    cur.t += dt;
    const id = cur.id, P = cur.parts;
    gf.clearRect(0, 0, FW, FH);
    if (id === 'rain' || id === 'storm') {
      gf.strokeStyle = 'rgba(215, 235, 255, 1)'; gf.lineWidth = id === 'storm' ? 1.5 : 1.3; gf.lineCap = 'round';
      for (const p of P) {
        p.y += p.v * dt; p.x -= p.v * 0.16 * dt;
        if (p.y > FH + 10) Object.assign(p, spawn(id));
        gf.globalAlpha = p.a; gf.beginPath(); gf.moveTo(p.x, p.y); gf.lineTo(p.x + p.len * 0.16, p.y - p.len); gf.stroke();
      }
      gf.globalAlpha = 1;
    } else if (id === 'snow') {
      gf.fillStyle = '#ffffff';
      for (const p of P) {
        p.y += p.v * dt; p.ph += dt * 1.4;
        if (p.y > FH + 4) Object.assign(p, spawn(id));
        gf.globalAlpha = 0.9; gf.beginPath(); gf.arc(p.x + Math.sin(p.ph) * p.sw * 0.3, p.y, p.r, 0, 7); gf.fill();
      }
      gf.globalAlpha = 1;
    } else if (id === 'petals' || id === 'leaves') {
      for (const p of P) {
        if (id === 'petals') { p.y += p.v * dt; p.x += Math.sin(p.ph) * 14 * dt - 8 * dt; } else { p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.ph) * 20 * dt; }
        p.ph += dt * 1.6; p.rot += p.vr * dt;
        if (p.y > FH + 12 || p.x < -24) Object.assign(p, spawn(id));
        gf.save(); gf.translate(p.x, p.y); gf.rotate(p.rot); gf.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.ph)));
        gf.fillStyle = p.c; gf.strokeStyle = 'rgba(23,10,54,0.55)'; gf.lineWidth = 0.8;
        gf.beginPath();
        if (id === 'petals') gf.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, 7);
        else { gf.moveTo(-p.r, 0); gf.quadraticCurveTo(0, -p.r * 0.9, p.r, 0); gf.quadraticCurveTo(0, p.r * 0.9, -p.r, 0); }
        gf.fill(); gf.stroke(); gf.restore();
      }
    } else if (id === 'dust') {
      gf.strokeStyle = 'rgb(232, 170, 120)'; gf.lineCap = 'round';
      for (const p of P) {
        p.x += p.vx * dt;
        if (p.x < -20) Object.assign(p, spawn(id));
        gf.globalAlpha = p.a; gf.lineWidth = p.r; gf.beginPath(); gf.moveTo(p.x, p.y); gf.lineTo(p.x + p.len, p.y + p.len * 0.08); gf.stroke();
      }
      gf.globalAlpha = 1;
    } else if (id === 'fog') {
      for (const p of P) {
        p.x += p.vx * dt;
        if (p.x < -p.rx * 1.2) p.x = FW + p.rx;
        const g = gf.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
        g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        gf.fillStyle = g; gf.save(); gf.translate(p.x, p.y); gf.scale(1, p.ry / p.rx); gf.translate(-p.x, -p.y);
        gf.beginPath(); gf.arc(p.x, p.y, p.rx, 0, 7); gf.fill(); gf.restore();
      }
    } else if (id === 'sunny' || id === 'rainbow') {
      // little glints of light
      for (const p of P) {
        p.ph += dt * p.sp;
        const a = Math.max(0, Math.sin(p.ph));
        if (a < 0.02) continue;
        gf.globalAlpha = a * 0.85; gf.fillStyle = id === 'sunny' ? '#fff6c8' : '#ffffff';
        star4(gf, p.x, p.y, p.r * (0.6 + a));
      }
      gf.globalAlpha = 1;
    } else if (id === 'stars') {
      for (const p of P) {
        p.ph += dt * p.sp;
        gf.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(p.ph)); gf.fillStyle = '#ffffff';
        gf.beginPath(); gf.arc(p.x, p.y, p.r, 0, 7); gf.fill();
      }
      // a shooting star every second or two
      cur.nextShoot -= dt;
      if (cur.nextShoot <= 0) { cur.shoot = { x: R(FW * 0.3, FW * 1.05), y: R(5, FH * 0.35), t: 0 }; cur.nextShoot = R(1.2, 2.6); }
      if (cur.shoot) {
        const s = cur.shoot; s.t += dt;
        const k = s.t / 0.7, x = s.x - k * 260, y = s.y + k * 110;
        if (k > 1) cur.shoot = null;
        else {
          const g = gf.createLinearGradient(x, y, x + 60, y - 25);
          g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          gf.globalAlpha = 1 - k; gf.strokeStyle = g; gf.lineWidth = 1.6; gf.beginPath(); gf.moveTo(x, y); gf.lineTo(x + 60, y - 25); gf.stroke();
        }
      }
      gf.globalAlpha = 1;
    }
    if (bolt) {
      bolt.t -= dt;
      if (bolt.t <= 0) bolt = null;
      else {
        gf.globalAlpha = Math.min(1, bolt.t * 4); gf.strokeStyle = '#fffbe0'; gf.lineWidth = 2.4; gf.lineJoin = 'round';
        gf.beginPath(); bolt.pts.forEach(([x, y], i) => (i ? gf.lineTo(x, y) : gf.moveTo(x, y))); gf.stroke();
        gf.globalAlpha = 1;
      }
    }
  }
  return { set, frame, lightning, get id() { return target > 0 && cur ? cur.id : null; } };
}
function star4(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y - r * 2); g.quadraticCurveTo(x, y, x + r * 2, y); g.quadraticCurveTo(x, y, x, y + r * 2); g.quadraticCurveTo(x, y, x - r * 2, y); g.quadraticCurveTo(x, y, x, y - r * 2); g.fill();
}
export const FRONT_SIZE = { w: FW, h: FH, k: K };
