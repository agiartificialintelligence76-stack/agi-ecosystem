// GRADIENT DESCENT in 3D (2026-11-08): three.js. One hole at a time: the landscape (one mesh from the height field,
// its colour map and contour lines in the shader), the block's sides like a 3D plot's box, thin rails, a LOSS axis, the
// ball (glossy honey, an ink outline, a soft shadow, a fading ribbon), the aim arrow and the preview dots, the bumper
// posts, the pin with its MIN pennant, and labels over the NaN pits and the sticky patches. game.js owns the camera's
// numbers (target, yaw, pitch, distance) and every moment; this file only draws them.
import * as THREE from 'three';
import * as SH from './shaders.js';
import { PHYS } from './physics.js';

THREE.ColorManagement.enabled = false;     // the palette's hex values go to the screen as they are

export const BG = 0x07060f;
const BG_RGB = new THREE.Color(BG);
const INK = new THREE.Color('#170a36');
const LIGHT = new THREE.Vector3(-0.45, 0.85, 0.32).normalize();
const TRAIL_N = 90;
const ARROW_K = 14;
const DOTS_N = 48;
const F = new Float64Array(6);

function label(text, { font = "800 64px 'AK Mono', ui-monospace, monospace", fg = '#3ff0c3', bg = 'rgba(7,6,15,0.82)', stroke = '#ff4da6', pad = 18 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = 96;
  c.width = w; c.height = h;
  g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = bg;
  const r = 30;
  g.beginPath(); g.moveTo(r, 6); g.arcTo(w - 3, 6, w - 3, h - 6, r); g.arcTo(w - 3, h - 6, 3, h - 6, r); g.arcTo(3, h - 6, 3, 6, r); g.arcTo(3, 6, w - 3, 6, r); g.closePath();
  g.fill();
  g.lineWidth = 5; g.strokeStyle = stroke; g.stroke();
  g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return { tex, aspect: w / h };
}

export function createScene(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(BG, 1);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  let W = 1, H = 1, DPR = 1;

  // ---------- the landscape's material (one for every hole) ----------
  const TU = {
    uHMin: { value: 0 }, uHMax: { value: 1 }, uStep: { value: 0.25 }, uTime: { value: 0 },
    uCup: { value: new THREE.Vector2() }, uCupR: { value: PHYS.CUP - 0.06 },
    uPits: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) }, uPitN: { value: 0 },
    uSticky: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uStickyN: { value: 0 },
    uRipple: { value: new THREE.Vector4() }, uLight: { value: LIGHT }, uBg: { value: BG_RGB },
    uFogNear: { value: 20 }, uFogFar: { value: 60 }, uLinePx: { value: 1.3 }, uFlag: { value: 0 },
  };
  const terrainMat = new THREE.ShaderMaterial({ vertexShader: SH.TERRAIN_VERT, fragmentShader: SH.TERRAIN_FRAG, uniforms: TU });
  const skirtMat = new THREE.ShaderMaterial({
    vertexShader: SH.SKIRT_VERT, fragmentShader: SH.SKIRT_FRAG, side: THREE.DoubleSide,
    uniforms: { uHMin: TU.uHMin, uHMax: TU.uHMax, uStep: TU.uStep, uBase: { value: -2 }, uBg: TU.uBg, uFogNear: TU.uFogNear, uFogFar: TU.uFogFar },
  });
  const railMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: 'attribute float aV; varying float vV; void main(){ vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vV; void main(){ vec3 c = mix(vec3(0.16,0.09,0.36), vec3(0.89,0.85,1.0), smoothstep(0.0, 0.9, vV)); c = mix(c, vec3(1.0,0.98,0.94), smoothstep(0.86, 0.96, vV)); gl_FragColor = vec4(c, 1.0); }',
  });

  // ---------- the hole's pieces (rebuilt per hole) ----------
  const holeGroup = new THREE.Group();
  scene.add(holeGroup);
  let hole = null;
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const postMats = [];
  const postFlash = [];
  const labels = [];
  let labelDefs = [];

  function heightAt(x, z) { return hole ? hole.field.h(x, z) : 0; }
  function normalAt(x, z, out) {
    hole.field.sample(x, z, F);
    out.set(-F[1], 1, -F[2]).normalize();
    return F[0];
  }

  function buildTerrain() {
    const [hx, hz] = hole.half;
    const big = Math.max(hx, hz);
    const sx = Math.max(60, Math.round((170 * hx) / big)), sz = Math.max(60, Math.round((170 * hz) / big));
    const nv = (sx + 1) * (sz + 1);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    let k = 0;
    for (let j = 0; j <= sz; j++) {
      const z = -hz + (2 * hz * j) / sz;
      for (let i = 0; i <= sx; i++) {
        const x = -hx + (2 * hx * i) / sx;
        hole.field.sample(x, z, F);
        pos[k] = x; pos[k + 1] = F[0]; pos[k + 2] = z;
        const l = Math.hypot(F[1], 1, F[2]);
        nor[k] = -F[1] / l; nor[k + 1] = 1 / l; nor[k + 2] = -F[2] / l;
        k += 3;
      }
    }
    const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(sx * sz * 6);
    k = 0;
    for (let j = 0; j < sz; j++) for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i, b = a + 1, c = a + sx + 1, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    holeGroup.add(new THREE.Mesh(g, terrainMat));

    // the block's four sides, down to its base, and the rails along the top
    const base = hole.hmin - 1.6;
    skirtMat.uniforms.uBase.value = base;
    const edges = [
      { n: sx, at: (t) => [-hx + 2 * hx * t, -hz] }, { n: sz, at: (t) => [hx, -hz + 2 * hz * t] },
      { n: sx, at: (t) => [hx - 2 * hx * t, hz] }, { n: sz, at: (t) => [-hx, hz - 2 * hz * t] },
    ];
    let total = 0;
    for (const e of edges) total += e.n + 1;
    const sp = new Float32Array(total * 2 * 3), st = new Float32Array(total * 2);
    const rp = new Float32Array(total * 2 * 3), rv = new Float32Array(total * 2);
    const sidx = [], ridx = [];
    let v = 0;
    for (const e of edges) {
      for (let i = 0; i <= e.n; i++) {
        const [x, z] = e.at(i / e.n);
        const h = hole.field.h(x, z);
        sp.set([x, h, z, x, base, z], v * 6);
        st[v * 2] = h; st[v * 2 + 1] = h;
        rp.set([x, h - 0.04, z, x, h + 0.3, z], v * 6);
        rv[v * 2] = 0; rv[v * 2 + 1] = 1;
        if (i < e.n) {
          const a = v * 2;
          sidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        v++;
      }
    }
    const sg = track(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('aTop', new THREE.BufferAttribute(st, 1));
    sg.setIndex(sidx);
    holeGroup.add(new THREE.Mesh(sg, skirtMat));
    const rg = track(new THREE.BufferGeometry());
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('aV', new THREE.BufferAttribute(rv, 1));
    rg.setIndex(ridx);
    holeGroup.add(new THREE.Mesh(rg, railMat));

    // the LOSS axis on the far corner from the tee, and the two weight axes along the bottom edges
    const cx = hole.start[0] > 0 ? -hx : hx, cz = hole.start[1] > 0 ? -hz : hz;
    const top = hole.hmax + 1.6;
    const lines = [cx, base, cz, cx, top, cz];
    const tick = 0.22;
    const step = hole.contour * 4;
    for (let y = Math.ceil(base / step) * step; y <= top - 0.3; y += step) {
      lines.push(cx, y, cz, cx - Math.sign(cx) * tick, y, cz, cx, y, cz, cx, y, cz - Math.sign(cz) * tick);
    }
    lines.push(cx, top, cz, cx - Math.sign(cx) * 0.12, top - 0.35, cz, cx, top, cz, cx + Math.sign(cx) * 0.12, top - 0.35, cz);
    lines.push(-hx, base, cz, hx, base, cz, cx, base, -hz, cx, base, hz);
    const lg = track(new THREE.BufferGeometry());
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const lm = track(new THREE.LineBasicMaterial({ color: 0xe4d9ff, transparent: true, opacity: 0.55 }));
    holeGroup.add(new THREE.LineSegments(lg, lm));
    labelDefs.push({ text: 'LOSS', at: [cx, top + 0.5, cz], h: 0.62, style: { fg: '#fffaf0', stroke: '#8b66ff' } });
    labelDefs.push({ text: 'w₁', at: [-cx * 0.86, base - 0.45, cz], h: 0.5, style: { fg: '#e4d9ff', stroke: 'rgba(0,0,0,0)', bg: 'rgba(0,0,0,0)' } });
    labelDefs.push({ text: 'w₂', at: [cx, base - 0.45, -cz * 0.86], h: 0.5, style: { fg: '#e4d9ff', stroke: 'rgba(0,0,0,0)', bg: 'rgba(0,0,0,0)' } });
  }

  // ---------- the bumper posts ----------
  const postGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1);
  const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  function buildPosts() {
    postMats.length = 0; postFlash.length = 0;
    for (const p of hole.posts) {
      let lo = Infinity, hi = -Infinity;
      for (let a = 0; a < 8; a++) {
        const h = hole.field.h(p.x + Math.cos(a * 0.785) * p.r, p.z + Math.sin(a * 0.785) * p.r);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      const bot = lo - 0.3, top = hi + 0.62;
      const mat = track(new THREE.ShaderMaterial({ vertexShader: SH.POST_VERT, fragmentShader: SH.POST_FRAG, uniforms: { uLight: { value: LIGHT }, uTop: { value: top }, uFlash: { value: 0 } } }));
      const m = new THREE.Mesh(postGeo, mat);
      m.scale.set(p.r, top - bot, p.r);
      m.position.set(p.x, (top + bot) / 2, p.z);
      const o = new THREE.Mesh(postGeo, outlineMat);
      o.scale.set(p.r + 0.05, top - bot + 0.1, p.r + 0.05);
      o.position.copy(m.position);
      holeGroup.add(o, m);
      postMats.push(mat); postFlash.push(0);
    }
  }

  // ---------- the pin and its pennant ----------
  const pin = new THREE.Group();
  scene.add(pin);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 10), new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
  pole.position.y = 0.85;
  const poleOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.74, 10), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  poleOutline.position.y = 0.85;
  const flagCanvas = document.createElement('canvas');
  flagCanvas.width = 256; flagCanvas.height = 160;
  const flagTex = new THREE.CanvasTexture(flagCanvas);
  const flagU = { uMap: { value: flagTex }, uTime: TU.uTime, uAlpha: { value: 1 } };
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56, 8, 1), new THREE.ShaderMaterial({ vertexShader: SH.FLAG_VERT, fragmentShader: SH.FLAG_FRAG, uniforms: flagU, side: THREE.DoubleSide, transparent: true }));
  flag.geometry.translate(0.45, 0, 0);
  flag.position.set(0.02, 1.38, 0);
  pin.add(poleOutline, pole, flag);
  function drawFlag() {
    const g = flagCanvas.getContext('2d');
    g.clearRect(0, 0, 256, 160);
    g.fillStyle = '#170a36';
    g.beginPath(); g.moveTo(4, 6); g.lineTo(250, 80); g.lineTo(4, 154); g.closePath(); g.fill();
    g.fillStyle = '#ff4da6';
    g.beginPath(); g.moveTo(10, 18); g.lineTo(226, 80); g.lineTo(10, 142); g.closePath(); g.fill();
    g.fillStyle = '#fffaf0';
    g.font = "900 46px 'AK Display', 'Arial Black', sans-serif";
    g.textBaseline = 'middle';
    g.fillText('MIN', 22, 82);
    flagTex.needsUpdate = true;
  }
  drawFlag();

  // ---------- the ball ----------
  const ballGeo = new THREE.SphereGeometry(PHYS.R, 32, 20);
  const ballU = { uColor: { value: new THREE.Color('#ffc933') }, uSeam: { value: new THREE.Color('#ff4da6') }, uLight: { value: LIGHT }, uFlash: { value: 0 } };
  const ballMesh = new THREE.Mesh(ballGeo, new THREE.ShaderMaterial({ vertexShader: SH.BALL_VERT, fragmentShader: SH.BALL_FRAG, uniforms: ballU }));
  const ballOutline = new THREE.Mesh(ballGeo, outlineMat);
  ballOutline.scale.setScalar(1.16);
  const ball = new THREE.Group();
  ball.add(ballOutline, ballMesh);
  scene.add(ball);
  const blobU = { uAlpha: { value: 0.55 } };
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: SH.BLOB_VERT, fragmentShader: SH.BLOB_FRAG, uniforms: blobU, transparent: true, depthWrite: false }));
  blob.geometry.rotateX(-Math.PI / 2);
  blob.scale.setScalar(PHYS.R * 3.2);
  scene.add(blob);
  const spin = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3(), axis = new THREE.Vector3();
  const last = { x: 0, z: 0, set: false };

  // ---------- the trail: a ribbon on the ground behind the ball ----------
  const trailPts = [];
  const tPos = new Float32Array(TRAIL_N * 2 * 3), tA = new Float32Array(TRAIL_N * 2);
  const tIdx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  trailGeo.setAttribute('aAlpha', new THREE.BufferAttribute(tA, 1));
  trailGeo.setIndex(tIdx);
  const trailU = { uColor: { value: new THREE.Color('#ffd966') } };
  const trail = new THREE.Mesh(trailGeo, new THREE.ShaderMaterial({ vertexShader: SH.TRAIL_VERT, fragmentShader: SH.TRAIL_FRAG, uniforms: trailU, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false;
  scene.add(trail);
  let trailFade = 0;

  // ---------- the aim arrow (on the ground) and the preview's dots ----------
  const AV = 3 * (ARROW_K + 1) + 4;
  const aPos = new Float32Array(AV * 3), aEdge = new Float32Array(AV), aAlong = new Float32Array(AV);
  const aIdx = [];
  for (let i = 0; i < ARROW_K; i++) {
    const l = i * 3, c = l + 1, r = l + 2, l2 = l + 3, c2 = l + 4, r2 = l + 5;
    aIdx.push(l, c, l2, c, c2, l2, c, r, c2, r, r2, c2);
  }
  const H0 = 3 * (ARROW_K + 1);
  aIdx.push(H0 + 3, H0, H0 + 2, H0 + 3, H0 + 2, H0 + 1, H0 + 3, H0 + 1, H0);
  for (let i = 0; i <= ARROW_K; i++) { aEdge[i * 3] = 1; aEdge[i * 3 + 1] = 0; aEdge[i * 3 + 2] = 1; }
  aEdge[H0] = 1; aEdge[H0 + 1] = 1; aEdge[H0 + 2] = 1; aEdge[H0 + 3] = 0;
  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  arrowGeo.setAttribute('aEdge', new THREE.BufferAttribute(aEdge, 1));
  arrowGeo.setAttribute('aAlong', new THREE.BufferAttribute(aAlong, 1));
  arrowGeo.setIndex(aIdx);
  const arrowU = { uColor: { value: new THREE.Color('#3ff0c3') }, uAlpha: { value: 0.95 } };
  const arrow = new THREE.Mesh(arrowGeo, new THREE.ShaderMaterial({ vertexShader: SH.ARROW_VERT, fragmentShader: SH.ARROW_FRAG, uniforms: arrowU, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  arrow.frustumCulled = false;
  arrow.renderOrder = 3;
  arrow.visible = false;
  scene.add(arrow);
  const dPos = new Float32Array(DOTS_N * 3), dA = new Float32Array(DOTS_N);
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dotsGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dA, 1));
  dotsGeo.setDrawRange(0, 0);
  const dotsU = { uColor: { value: new THREE.Color('#fffaf0') }, uSize: { value: 8 } };
  const dots = new THREE.Points(dotsGeo, new THREE.ShaderMaterial({ vertexShader: SH.DOTS_VERT, fragmentShader: SH.DOTS_FRAG, uniforms: dotsU, transparent: true, depthWrite: false }));
  dots.frustumCulled = false;
  dots.renderOrder = 4;
  scene.add(dots);

  // ---------- labels over pits and sticky patches, and the axis words ----------
  const labelGroup = new THREE.Group();
  scene.add(labelGroup);
  function buildLabels() {
    for (const s of labels) { s.material.map?.dispose(); s.material.dispose(); }
    labels.length = 0;
    labelGroup.clear();
    for (const d of labelDefs) {
      const { tex, aspect } = label(d.text, d.style);
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: d.opacity ?? 1 });
      const s = new THREE.Sprite(m);
      s.scale.set(d.h * aspect, d.h, 1);
      s.position.set(d.at[0], d.at[1], d.at[2]);
      s.userData.base = d.at[1];
      s.userData.bob = d.bob || 0;
      labelGroup.add(s);
      labels.push(s);
    }
  }

  function setHole(next) {
    for (const o of disposables) o.dispose?.();
    disposables.length = 0;
    holeGroup.clear();
    hole = next;
    labelDefs = [];
    TU.uHMin.value = hole.hmin; TU.uHMax.value = hole.hmax; TU.uStep.value = hole.contour;
    TU.uCup.value.set(hole.cup[0], hole.cup[1]);
    TU.uPitN.value = Math.min(6, hole.pits.length);
    hole.pits.slice(0, 6).forEach((p, i) => TU.uPits.value[i].set(p.x, p.z, p.r));
    TU.uStickyN.value = Math.min(4, hole.sticky.length);
    hole.sticky.slice(0, 4).forEach((s, i) => TU.uSticky.value[i].set(s.x, s.z, s.rx, s.rz));
    TU.uRipple.value.set(0, 0, 0, 0);
    buildTerrain();
    buildPosts();
    for (const p of hole.pits) labelDefs.push({ text: 'NaN', at: [p.x, hole.field.h(p.x, p.z) + 0.95, p.z], h: 0.56, bob: 1 });
    for (const s of hole.sticky) labelDefs.push({ text: 'DECAY', at: [s.x, hole.field.h(s.x, s.z) + 0.75, s.z], h: 0.42, style: { fg: '#e4d9ff', stroke: '#8b66ff' }, opacity: 0.92 });
    buildLabels();
    pin.position.set(hole.cup[0], hole.cupH, hole.cup[1]);
    pinLift = 0;
    trailPts.length = 0; trailFade = 0; last.set = false;
    arrow.visible = false; dotsGeo.setDrawRange(0, 0);
  }

  // ---------- per-frame state from the game ----------
  let pinLift = 0, pinPop = 0, ballScale = 1, ballSink = 0;
  const api = {
    renderer, camera, get hole() { return hole; },
    heightAt,
    setHole,
    refreshText() { drawFlag(); buildLabels(); },
    resize(w, h, dpr) {
      W = w; H = h; DPR = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      dotsU.uSize.value = 9 * dpr;
      TU.uLinePx.value = dpr >= 1.5 ? 1.25 : 1.4;
    },
    // the camera: orbiting `target` at `dist`, `yaw` around, `pitch` up; looking at `look` (a point ahead of the target)
    setCamera(target, yaw, pitch, dist, look) {
      const cp = Math.cos(pitch);
      camera.position.set(target[0] + dist * cp * Math.sin(yaw), target[1] + dist * Math.sin(pitch), target[2] + dist * cp * Math.cos(yaw));
      camera.lookAt(look ? look[0] : target[0], look ? look[1] : target[1], look ? look[2] : target[2]);
      camera.updateMatrixWorld();
      TU.uFogNear.value = dist * 1.1 + 4; TU.uFogFar.value = dist * 2.6 + 26;
    },
    // the ball at (x, z) on the ground; `moved` rolls it; `scale`/`sink` for the drop
    setBall(x, z, { visible = true, scale = 1, sink = 0, flash = 0 } = {}) {
      ball.visible = visible; blob.visible = visible && sink < 0.6;
      if (!hole) return;
      const h = normalAt(x, z, nrm);
      if (last.set && visible) {
        const dx = x - last.x, dz = z - last.z, d = Math.hypot(dx, dz);
        if (d > 1e-5 && d < 2) {
          axis.set(dz, 0, -dx).normalize();
          tmpQ.setFromAxisAngle(axis, d / PHYS.R);
          spin.premultiply(tmpQ);
        }
      }
      last.x = x; last.z = z; last.set = true;
      ballScale = scale; ballSink = sink;
      ball.position.set(x + nrm.x * PHYS.R, h + nrm.y * PHYS.R - sink * PHYS.R * 2.4, z + nrm.z * PHYS.R);
      ball.scale.setScalar(scale);
      ballMesh.quaternion.copy(spin);
      ballU.uFlash.value = flash;
      blob.position.set(x + nrm.x * 0.03, h + nrm.y * 0.03, z + nrm.z * 0.03);
      blob.quaternion.setFromUnitVectors(up, nrm);
      blobU.uAlpha.value = 0.55 * Math.max(0, 1 - sink * 1.6) * scale;
    },
    resetSpin() { last.set = false; },
    // trail: a point each time the ball has moved a little
    trailPush(x, z) {
      const lp = trailPts[trailPts.length - 1];
      if (lp && Math.hypot(lp[0] - x, lp[1] - z) < 0.09) return;
      trailPts.push([x, z]);
      if (trailPts.length > TRAIL_N) trailPts.shift();
      trailFade = 1;
    },
    trailClear() { trailPts.length = 0; },
    setTrailFade(v) { trailFade = v; },
    // the aim: angle on the ground, power 0..1 (null hides it)
    setAim(aim, x, z) {
      if (!aim || !hole) { arrow.visible = false; return; }
      arrow.visible = true;
      const c = Math.cos(aim.angle), s = Math.sin(aim.angle);
      const len = 0.9 + aim.power * 4.4, head = Math.min(0.85, 0.45 + len * 0.14), shaftW = 0.17 + aim.power * 0.05, headW = 0.48 + aim.power * 0.1;
      const start = PHYS.R + 0.18;
      const lift = 0.09;
      const put = (k, along, side, edge) => {
        const px = x + c * along - s * side, pz = z + s * along + c * side;
        aPos[k * 3] = px; aPos[k * 3 + 1] = heightAt(px, pz) + lift; aPos[k * 3 + 2] = pz;
        aAlong[k] = (along - start) / len;
        aEdge[k] = edge;
      };
      for (let i = 0; i <= ARROW_K; i++) {
        const along = start + ((len - head) * i) / ARROW_K;
        put(i * 3, along, -shaftW, 1); put(i * 3 + 1, along, 0, 0); put(i * 3 + 2, along, shaftW, 1);
      }
      put(H0, start + len - head, -headW, 1); put(H0 + 1, start + len - head, headW, 1); put(H0 + 2, start + len, 0, 1); put(H0 + 3, start + len - head * 0.62, 0, 0);
      arrowGeo.attributes.position.needsUpdate = true; arrowGeo.attributes.aAlong.needsUpdate = true; arrowGeo.attributes.aEdge.needsUpdate = true;
      const p = aim.power;
      const col = p < 0.5 ? arrowU.uColor.value.setRGB(0.247 + (1 - 0.247) * p * 2, 0.941 - (0.941 - 0.788) * p * 2, 0.765 - (0.765 - 0.2) * p * 2)
        : arrowU.uColor.value.setRGB(1, 0.788 - (0.788 - 0.302) * (p - 0.5) * 2, 0.2 + (0.651 - 0.2) * (p - 0.5) * 2);
      void col;
      arrowU.uAlpha.value = aim.alpha ?? 0.95;
    },
    // the preview: [x, z, x, z, …] (n points)
    setPreview(pts, n, alpha = 1) {
      const m = Math.min(DOTS_N, n);
      for (let i = 0; i < m; i++) {
        const x = pts[i * 2], z = pts[i * 2 + 1];
        dPos[i * 3] = x; dPos[i * 3 + 1] = heightAt(x, z) + 0.1; dPos[i * 3 + 2] = z;
        dA[i] = alpha * (1 - (i / Math.max(1, m)) * 0.75);
      }
      dotsGeo.setDrawRange(0, m);
      dotsGeo.attributes.position.needsUpdate = true; dotsGeo.attributes.aAlpha.needsUpdate = true;
    },
    // the pin: lifted (0 in, 1 out of the way), and a pop when the ball drops
    setPin(lift) { pinLift = lift; },
    popPin() { pinPop = 1; },
    flashPost(i) { if (postFlash[i] != null) postFlash[i] = 1; },
    ripple(strength = 1) { TU.uRipple.value.set(hole.cup[0], hole.cup[1], 0, strength); },
    project(x, y, z, out) {
      const v = tmpV.set(x, y, z).project(camera);
      out.x = (v.x * 0.5 + 0.5) * W; out.y = (-v.y * 0.5 + 0.5) * H; out.behind = v.z > 1;
      return out;
    },
    // where a pointer at (px, py) meets the level y (the ground's height at the ball): { x, z } or null
    groundAt(px, py, y) {
      ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const dy = ray.ray.direction.y;
      if (Math.abs(dy) < 1e-4) return null;
      const t = (y - ray.ray.origin.y) / dy;
      if (t <= 0) return null;
      return { x: ray.ray.origin.x + ray.ray.direction.x * t, z: ray.ray.origin.z + ray.ray.direction.z * t };
    },
    update(dt, time) {
      TU.uTime.value = time;
      // the ripple runs out
      if (TU.uRipple.value.w > 0) { TU.uRipple.value.z += dt; if (TU.uRipple.value.z > 2.8) TU.uRipple.value.w = 0; }
      // the pin: lifts as the ball comes close, pops back after a drop
      pinPop = Math.max(0, pinPop - dt * 1.4);
      const pop = pinPop > 0 ? Math.sin((1 - pinPop) * Math.PI * 2.5) * pinPop * 0.35 : 0;
      pin.position.y = (hole ? hole.cupH : 0) + pinLift * 1.4 + pop;
      flagU.uAlpha.value = 1 - pinLift * 0.75;
      pin.scale.setScalar(1 + pop * 0.6);
      for (let i = 0; i < postMats.length; i++) {
        postFlash[i] = Math.max(0, postFlash[i] - dt * 4);
        postMats[i].uniforms.uFlash.value = postFlash[i];
      }
      for (const s of labels) if (s.userData.bob && !reduced) s.position.y = s.userData.base + Math.sin(time * 2.2 + s.position.x) * 0.06;
      // the trail's ribbon
      const n = trailPts.length;
      const w = PHYS.R * 0.62;
      for (let i = 0; i < TRAIL_N; i++) {
        const k = Math.min(n - 1, Math.max(0, n - TRAIL_N + i));
        if (n < 2 || i < TRAIL_N - n) { tA[i * 2] = 0; tA[i * 2 + 1] = 0; tPos.fill(0, i * 6, i * 6 + 6); continue; }
        const p = trailPts[k], q = trailPts[Math.min(n - 1, k + 1)], o = trailPts[Math.max(0, k - 1)];
        let dx = q[0] - o[0], dz = q[1] - o[1];
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const age = (n - 1 - k) / TRAIL_N;
        const ww = w * (1 - age * 0.7);
        const y0 = heightAt(p[0], p[1]) + 0.04;
        tPos[i * 6] = p[0] - dz * ww; tPos[i * 6 + 1] = y0; tPos[i * 6 + 2] = p[1] + dx * ww;
        tPos[i * 6 + 3] = p[0] + dz * ww; tPos[i * 6 + 4] = y0; tPos[i * 6 + 5] = p[1] - dx * ww;
        const a = (1 - age) ** 1.6 * 0.6 * trailFade;
        tA[i * 2] = a; tA[i * 2 + 1] = a;
      }
      trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.aAlpha.needsUpdate = true;
    },
    render() { renderer.render(scene, camera); },
    get size() { return { w: W, h: H, dpr: DPR }; },
  };
  const tmpV = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  void ballScale; void ballSink;
  return api;
}
