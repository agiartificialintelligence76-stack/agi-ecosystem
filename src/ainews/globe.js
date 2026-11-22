// Interactive 3D Orthographic World Globe for agi1.app/ainews.
// Renders real continent outlines, glowing great-circle AI signal arcs, and clickable regional hub beacons
// with smooth drag rotation, inertia, click-to-focus camera tweening, and theme-aware palettes across all 4 AGI looks.

const DEG = Math.PI / 180;

// Lightweight world continent polygons [lon, lat] for crisp orthographic rendering
const CONTINENTS = [
  // North America
  [[-165, 62], [-145, 68], [-115, 70], [-82, 65], [-60, 52], [-66, 44], [-75, 36], [-81, 25], [-90, 21], [-97, 19], [-105, 20], [-117, 32], [-124, 42], [-130, 54], [-152, 60], [-165, 62]],
  // Greenland
  [[-52, 60], [-42, 65], [-20, 74], [-26, 82], [-54, 81], [-68, 76], [-56, 68], [-52, 60]],
  // South America
  [[-80, 9], [-72, 12], [-60, 8], [-48, 0], [-35, -6], [-39, -18], [-48, -28], [-58, -38], [-67, -54], [-74, -52], [-72, -35], [-71, -18], [-81, -4], [-80, 9]],
  // Europe
  [[-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 54], [10, 58], [5, 61], [15, 68], [28, 70], [42, 66], [42, 55], [38, 46], [28, 41], [22, 37], [15, 38], [12, 44], [5, 43], [-5, 36], [-9, 37]],
  // UK & Ireland
  [[-6, 50], [-5, 58], [-1, 58], [2, 52], [-2, 50], [-6, 50]],
  // Africa
  [[-17, 15], [-13, 28], [-5, 36], [10, 37], [25, 32], [33, 31], [43, 12], [51, 12], [41, -2], [40, -15], [33, -26], [20, -35], [14, -22], [11, -6], [8, 4], [-8, 5], [-17, 15]],
  // Asia + China + India + SE Asia
  [[42, 66], [70, 72], [105, 74], [140, 70], [172, 65], [160, 54], [141, 53], [136, 44], [128, 36], [121, 39], [122, 31], [120, 23], [108, 20], [109, 12], [100, 7], [97, 16], [88, 22], [80, 8], [72, 20], [66, 25], [56, 25], [48, 30], [36, 36], [38, 46], [42, 55], [42, 66]],
  // Japan
  [[130, 31], [134, 34], [140, 36], [141, 41], [144, 44], [141, 43], [137, 37], [131, 34], [130, 31]],
  // Indonesia / Philippines cluster
  [[96, 5], [106, -6], [118, -8], [128, -4], [122, 2], [110, 1], [96, 5]],
  [[120, 18], [126, 12], [124, 6], [120, 12], [120, 18]],
  // Australia
  [[114, -22], [128, -14], [142, -11], [153, -27], [148, -38], [136, -35], [115, -34], [114, -22]],
];

const ARCS = [
  ['sf', 'hangzhou'],
  ['sf', 'beijing'],
  ['sf', 'london'],
  ['sf', 'nyc'],
  ['nyc', 'london'],
  ['london', 'paris'],
  ['hangzhou', 'beijing'],
  ['beijing', 'tokyo'],
  ['paris', 'hangzhou'],
  ['tokyo', 'sf'],
];

function project(lat, lon, rotLon, rotLat, cx, cy, r) {
  const phi = lat * DEG;
  const lam = (lon - rotLon) * DEG;
  const phi0 = rotLat * DEG;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const cosLam = Math.cos(lam);
  const sinLam = Math.sin(lam);

  const x = cosPhi * sinLam;
  const y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLam;
  const z = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLam;
  return { x: cx + x * r, y: cy - y * r, z, visible: z > -0.04 };
}

function interpolateGreatCircle(a, b, steps = 28) {
  const toVec = (lat, lon) => {
    const p = lat * DEG;
    const l = lon * DEG;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  };
  const v0 = toVec(a.lat, a.lon);
  const v1 = toVec(b.lat, b.lon);
  const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega) || 1;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s0 = Math.sin((1 - t) * omega) / sinOmega;
    const s1 = Math.sin(t * omega) / sinOmega;
    const x = s0 * v0[0] + s1 * v1[0];
    const y = s0 * v0[1] + s1 * v1[1];
    const z = s0 * v0[2] + s1 * v1[2];
    const norm = Math.hypot(x, y, z) || 1;
    const lat = Math.asin(z / norm) / DEG;
    const lon = Math.atan2(y / norm, x / norm) / DEG;
    const lift = 1 + Math.sin(t * Math.PI) * 0.14;
    pts.push({ lat, lon, lift, t });
  }
  return pts;
}

function globePalette() {
  const root = document.documentElement;
  const pop = root.dataset.skin === 'pop';
  const dark = root.dataset.theme === 'dark';
  if (pop && !dark) {
    return {
      halo: 'rgba(107, 59, 255, 0.24)',
      oceanA: '#241152',
      oceanB: '#12072b',
      rim: '#170a36',
      rimGlow: 'rgba(63, 240, 195, 0.45)',
      grid: 'rgba(205, 184, 255, 0.15)',
      landFill: 'rgba(139, 102, 255, 0.38)',
      landStroke: 'rgba(228, 217, 255, 0.62)',
      arc: 'rgba(63, 240, 195, 0.45)',
      pulse: '#ffc933',
      labelBg: 'rgba(23, 10, 54, 0.88)',
      labelText: '#ffffff',
      labelBorder: 'rgba(205, 184, 255, 0.55)',
    };
  }
  if (pop && dark) {
    return {
      halo: 'rgba(255, 77, 166, 0.22)',
      oceanA: '#22104a',
      oceanB: '#0c051c',
      rim: '#cdb8ff',
      rimGlow: 'rgba(255, 77, 166, 0.45)',
      grid: 'rgba(205, 184, 255, 0.14)',
      landFill: 'rgba(107, 59, 255, 0.42)',
      landStroke: 'rgba(205, 184, 255, 0.65)',
      arc: 'rgba(63, 240, 195, 0.5)',
      pulse: '#ffc933',
      labelBg: 'rgba(18, 8, 40, 0.92)',
      labelText: '#f4efff',
      labelBorder: 'rgba(205, 184, 255, 0.55)',
    };
  }
  if (!dark) {
    return {
      halo: 'rgba(199, 40, 95, 0.14)',
      oceanA: '#1d2230',
      oceanB: '#0f131c',
      rim: '#111111',
      rimGlow: 'rgba(199, 40, 95, 0.35)',
      grid: 'rgba(255, 255, 255, 0.1)',
      landFill: 'rgba(255, 255, 255, 0.18)',
      landStroke: 'rgba(255, 255, 255, 0.42)',
      arc: 'rgba(255, 92, 147, 0.5)',
      pulse: '#3ff0c3',
      labelBg: 'rgba(17, 17, 17, 0.88)',
      labelText: '#ffffff',
      labelBorder: 'rgba(255, 255, 255, 0.28)',
    };
  }
  return {
    halo: 'rgba(255, 92, 147, 0.16)',
    oceanA: '#171923',
    oceanB: '#090a0e',
    rim: '#3b3b44',
    rimGlow: 'rgba(255, 92, 147, 0.36)',
    grid: 'rgba(255, 255, 255, 0.09)',
    landFill: 'rgba(255, 255, 255, 0.16)',
    landStroke: 'rgba(255, 255, 255, 0.38)',
    arc: 'rgba(255, 92, 147, 0.52)',
    pulse: '#3ecf8e',
    labelBg: 'rgba(11, 11, 12, 0.9)',
    labelText: '#ededed',
    labelBorder: 'rgba(255, 255, 255, 0.22)',
  };
}

export function createWorldGlobe(canvas, { hubs = [], onSelectHub, onHoverHub } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setHubs() {}, focusHub() {}, setAutoRotate() {}, destroy() {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hubList = hubs.slice();
  let hubMap = Object.fromEntries(hubList.map((h) => [h.id, h]));
  let arcPaths = [];

  const rebuildArcs = () => {
    hubMap = Object.fromEntries(hubList.map((h) => [h.id, h]));
    arcPaths = ARCS
      .map(([fromId, toId], idx) => {
        const a = hubMap[fromId];
        const b = hubMap[toId];
        if (!a || !b) return null;
        return { fromId, toId, idx, points: interpolateGreatCircle(a, b, 26) };
      })
      .filter(Boolean);
  };
  rebuildArcs();

  // Start facing Pacific-to-Eurasia/Americas sweet spot (around China/US/Japan)
  let rotLon = 10;
  let rotLat = 24;
  let velLon = 0;
  let targetLon = null;
  let targetLat = null;
  let autoRotate = !reduced;
  let selectedHubId = null;
  let hoveredHubId = null;
  let pingHubId = null;
  let pingUntil = 0;

  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;
  let width = 460;
  let height = 400;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let screenHubs = [];
  let raf = 0;
  let destroyed = false;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };
  resize();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);

  function normalizeLon(l) {
    let out = l % 360;
    if (out > 180) out -= 360;
    if (out < -180) out += 360;
    return out;
  }

  function focusHub(hubId, { ping = false } = {}) {
    selectedHubId = hubId || null;
    const hub = hubId ? hubMap[hubId] : null;
    if (hub) {
      targetLon = hub.lon;
      targetLat = Math.max(-35, Math.min(52, hub.lat * 0.72));
      velLon = 0;
      if (ping) {
        pingHubId = hub.id;
        pingUntil = performance.now() + 2600;
      }
    } else {
      targetLon = null;
      targetLat = 22;
    }
  }

  function findHubAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = null;
    let bestDist = 30;
    for (const h of screenHubs) {
      if (!h.visible) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  const onPointerDown = (e) => {
    dragging = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    targetLon = null;
    targetLat = null;
    velLon = 0;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.classList.add('is-dragging');
  };

  const onPointerMove = (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
      rotLon = normalizeLon(rotLon - dx * 0.42);
      rotLat = Math.max(-55, Math.min(60, rotLat + dy * 0.34));
      velLon = -dx * 0.25;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    const hit = findHubAt(e.clientX, e.clientY);
    const nextHover = hit?.id || null;
    if (nextHover !== hoveredHubId) {
      hoveredHubId = nextHover;
      canvas.classList.toggle('is-hover-hub', Boolean(nextHover));
      onHoverHub?.(nextHover ? hubMap[nextHover] : null);
    }
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('is-dragging');
    canvas.releasePointerCapture?.(e.pointerId);
    if (!dragMoved) {
      const hit = findHubAt(e.clientX, e.clientY);
      if (hit) {
        const nextId = selectedHubId === hit.id ? null : hit.id;
        focusHub(nextId, { ping: Boolean(nextId) });
        onSelectHub?.(nextId);
      }
    }
  };

  const onPointerLeave = () => {
    if (hoveredHubId) {
      hoveredHubId = null;
      canvas.classList.remove('is-hover-hub');
      onHoverHub?.(null);
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  function draw(now) {
    if (destroyed) return;
    const t = now * 0.001;

    if (!dragging) {
      if (targetLon !== null) {
        let diffLon = normalizeLon(targetLon - rotLon);
        rotLon = normalizeLon(rotLon + diffLon * 0.085);
        if (Math.abs(diffLon) < 0.15) targetLon = null;
      } else if (Math.abs(velLon) > 0.02) {
        rotLon = normalizeLon(rotLon + velLon);
        velLon *= 0.93;
      } else if (autoRotate && !hoveredHubId) {
        rotLon = normalizeLon(rotLon + 0.12);
      }
      if (targetLat !== null) {
        const diffLat = targetLat - rotLat;
        rotLat += diffLat * 0.085;
        if (Math.abs(diffLat) < 0.12) targetLat = null;
      }
    }

    const pal = globePalette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.405;
    const r = Math.max(78, Math.min(width * 0.36, height * 0.365));

    // Outer atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.84, cx, cy, r * 1.24);
    halo.addColorStop(0, pal.halo);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.24, 0, Math.PI * 2);
    ctx.fill();

    // Sphere ocean gradient
    const ocean = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.34, r * 0.08, cx, cy, r);
    ocean.addColorStop(0, pal.oceanA);
    ocean.addColorStop(1, pal.oceanB);
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Latitude & longitude graticule
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = project(lat, lon, rotLon, rotLat, cx, cy, r);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -84; lat <= 84; lat += 6) {
        const p = project(lat, lon, rotLon, rotLat, cx, cy, r);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Continents
    ctx.fillStyle = pal.landFill;
    ctx.strokeStyle = pal.landStroke;
    ctx.lineWidth = 1.15;
    for (const poly of CONTINENTS) {
      const projected = poly.map(([lon, lat]) => project(lat, lon, rotLon, rotLat, cx, cy, r));
      if (!projected.some((p) => p.z > 0)) continue;
      ctx.beginPath();
      let open = false;
      for (const p of projected) {
        if (p.z > -0.12) {
          if (!open) { ctx.moveTo(p.x, p.y); open = true; } else ctx.lineTo(p.x, p.y);
        } else {
          open = false;
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Crisp rim outline
    ctx.strokeStyle = pal.rimGlow;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = pal.rim;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Great-circle orbital signal arcs + animated data packets
    for (const arc of arcPaths) {
      const activeArc = selectedHubId && (arc.fromId === selectedHubId || arc.toId === selectedHubId);
      ctx.beginPath();
      let started = false;
      let packetPt = null;
      const packetT = (t * 0.24 + arc.idx * 0.17) % 1;
      for (const pt of arc.points) {
        const p = project(pt.lat, pt.lon, rotLon, rotLat, cx, cy, r * pt.lift);
        if (p.z > -0.02) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
          if (!reduced && Math.abs(pt.t - packetT) < 0.045) packetPt = p;
        } else {
          started = false;
        }
      }
      ctx.strokeStyle = activeArc ? '#ffc933' : pal.arc;
      ctx.lineWidth = activeArc ? 2.1 : 1.15;
      ctx.stroke();

      if (packetPt) {
        ctx.fillStyle = activeArc ? '#ffffff' : pal.pulse;
        ctx.beginPath();
        ctx.arc(packetPt.x, packetPt.y, activeArc ? 3.5 : 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hub beacons + non-overlapping city pill labels
    screenHubs = [];
    const placedBoxes = [];
    for (const hub of hubList) {
      const p = project(hub.lat, hub.lon, rotLon, rotLat, cx, cy, r);
      const isSelected = selectedHubId === hub.id;
      const isHovered = hoveredHubId === hub.id;
      const isPing = pingHubId === hub.id && now < pingUntil;
      screenHubs.push({ ...hub, x: p.x, y: p.y, z: p.z, visible: p.z > 0.02 });
      if (p.z <= 0.02) continue;

      const baseSize = 5 + Math.min(5, Math.log2((hub.totalSignals || 1) + 1) * 1.15);
      const pulse = reduced ? 0.5 : (t * 1.6 + hub.lat * 0.1) % 1;

      // Expanding signal ring
      ctx.strokeStyle = hub.color || '#3ff0c3';
      ctx.globalAlpha = (1 - pulse) * (isSelected || isPing ? 0.9 : 0.52);
      ctx.lineWidth = isSelected || isPing ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseSize + pulse * (isSelected || isPing ? 24 : 14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Beacon core
      ctx.fillStyle = hub.color || '#3ff0c3';
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected || isHovered ? baseSize + 2.5 : baseSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isSelected || isHovered ? 2.4 : 1.4;
      ctx.stroke();

      // City pill label on front hemisphere (collision-checked so nearby hubs like London/Paris stay crisp)
      if (p.z > 0.25 || isSelected || isHovered) {
        const label = `${hub.name} · ${hub.totalSignals || 0}`;
        ctx.font = '600 11px "Geist Mono", ui-monospace, monospace';
        const tw = ctx.measureText(label).width;
        const padX = 7;
        const boxW = tw + padX * 2;
        const boxH = 20;
        let lx = p.x > cx ? p.x + 11 : p.x - boxW - 11;
        lx = Math.max(8, Math.min(width - boxW - 8, lx));
        const baseLy = Math.max(8, Math.min(height - 118, p.y - 10));
        let ly = baseLy;
        for (const dy of [0, -25, 25, -50, 50]) {
          const cand = Math.max(8, Math.min(height - 118, baseLy + dy));
          const hit = placedBoxes.some((b) => lx < b.x + b.w + 4 && lx + boxW + 4 > b.x && cand < b.y + b.h + 4 && cand + boxH + 4 > b.y);
          if (!hit) { ly = cand; break; }
        }
        placedBoxes.push({ x: lx, y: ly, w: boxW, h: boxH });

        ctx.fillStyle = isSelected ? (hub.color || '#ffc933') : pal.labelBg;
        ctx.beginPath();
        ctx.roundRect(lx, ly, boxW, boxH, 999);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#170a36' : pal.labelBorder;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#170a36' : pal.labelText;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + padX, ly + boxH / 2 + 0.5);
      }
    }

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  return {
    setHubs(nextHubs) {
      hubList = Array.isArray(nextHubs) ? nextHubs.slice() : [];
      rebuildArcs();
    },
    focusHub,
    setAutoRotate(on) {
      autoRotate = Boolean(on);
    },
    isAutoRotate() {
      return autoRotate;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
