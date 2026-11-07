// SCAM SLAYER: the blade you see. Each finger (or the mouse, or the demo) leaves a ribbon of its last ~120 ms: thick at
// the tip, tapering to nothing at the tail, smoothed through its points, drawn three times (an ink outline, its colored
// body, a bright core) like the arcade's stickers. Its color climbs with the swipe's combo.
const LIFE = 0.15;         // seconds a point stays in the ribbon
const MAXP = 48;

export function createBlades() {
  const map = new Map();
  // scratch arrays (no allocation while drawing)
  const xs = new Float32Array(512), ys = new Float32Array(512), ws = new Float32Array(512);
  const lx = new Float32Array(512), ly = new Float32Array(512), rx = new Float32Array(512), ry = new Float32Array(512);

  const api = {
    down(id, x, y, t) {
      let b = map.get(id);
      if (!b) { b = { pts: [], down: true, n: 0 }; map.set(id, b); }
      b.down = true; b.n = 0;
      b.pts.length = 0;
      b.pts.push({ x, y, t });
    },
    move(id, x, y, t) {
      const b = map.get(id);
      if (!b || !b.down) return;
      const last = b.pts[b.pts.length - 1];
      if (last && Math.abs(last.x - x) + Math.abs(last.y - y) < 0.8) { last.t = t; return; }
      b.pts.push({ x, y, t });
      if (b.pts.length > MAXP) b.pts.shift();
    },
    up(id) { const b = map.get(id); if (b) b.down = false; },
    combo(id, n) { const b = map.get(id); if (b) b.n = n; },
    clear() { map.clear(); },
    get size() { return map.size; },
    // the newest point of a blade that's down (for the parallax and the combo counter)
    tip(id) { const b = map.get(id); return b && b.down ? b.pts[b.pts.length - 1] : null; },
    anyTip() { for (const b of map.values()) if (b.down && b.pts.length) return b.pts[b.pts.length - 1]; return null; },

    update(now) {
      for (const [id, b] of map) {
        while (b.pts.length && now - b.pts[0].t > LIFE) {
          if (b.down && b.pts.length === 1) break;        // a finger held still keeps its last point
          b.pts.shift();
        }
        if (!b.down && !b.pts.length) map.delete(id);
      }
    },

    // world units: `width` the body's width at the tip; colors: { body, core, ink }
    draw(ctx, now, { width = 13, palette }) {
      for (const b of map.values()) {
        const pts = b.pts;
        if (pts.length < 2) continue;
        // smooth: Catmull-Rom through the points, 4 steps a segment
        let n = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            if (n >= 500) break;
            const t = s / steps, t2 = t * t, t3 = t2 * t;
            xs[n] = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            ys[n] = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            const age = now - (p1.t + (p2.t - p1.t) * t);
            ws[n] = Math.max(0, 1 - age / LIFE);
            n++;
          }
        }
        const last = pts[pts.length - 1];
        xs[n] = last.x; ys[n] = last.y; ws[n] = Math.max(0, 1 - (now - last.t) / LIFE); n++;
        if (n < 2) continue;
        // the ribbon's width: tapering along it (and with age)
        for (let i = 0; i < n; i++) {
          const along = i / (n - 1);
          ws[i] = Math.min(ws[i], Math.pow(along, 0.85));
        }
        const pal = palette(b.n);
        for (const [scale, color, add] of [[1, pal.ink, 0.62], [1, pal.body, 0], [0.42, pal.core, 0]]) {
          const W = width * scale;
          for (let i = 0; i < n; i++) {
            const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
            let dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0];
            const L = Math.hypot(dx, dy) || 1;
            dx /= L; dy /= L;
            const half = (W * ws[i]) / 2 + add * width * 0.5 * Math.min(1, ws[i] * 5);
            lx[i] = xs[i] - dy * half; ly[i] = ys[i] + dx * half;
            rx[i] = xs[i] + dy * half; ry[i] = ys[i] - dx * half;
          }
          ctx.beginPath();
          ctx.moveTo(lx[0], ly[0]);
          for (let i = 1; i < n; i++) ctx.lineTo(lx[i], ly[i]);
          // a round tip
          const tipR = (W * ws[n - 1]) / 2 + add * width * 0.5 * Math.min(1, ws[n - 1] * 5);
          const ang = Math.atan2(ly[n - 1] - ys[n - 1], lx[n - 1] - xs[n - 1]);
          ctx.arc(xs[n - 1], ys[n - 1], Math.max(0.01, tipR), ang, ang - Math.PI, true);
          for (let i = n - 1; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    },
  };
  return api;
}

// the blade's colors for a combo count (and a power that's on)
export function bladePalette(n, power) {
  const ink = '#170a36';
  if (power === 'freeze') return { ink, body: '#59c8ff', core: '#ffffff' };
  if (power === 'double') return { ink, body: '#3ff0c3', core: '#ffffff' };
  if (n >= 7) return { ink, body: '#8b66ff', core: '#ffffff' };
  if (n >= 5) return { ink, body: '#3ff0c3', core: '#ffffff' };
  if (n >= 3) return { ink, body: '#ff4da6', core: '#ffffff' };
  return { ink, body: '#ffc933', core: '#fffaf0' };
}
