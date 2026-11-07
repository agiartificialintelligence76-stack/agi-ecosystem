// STACKED in 3D (2026-11-08): three.js, one orthographic camera at an isometric angle, every box drawn by one shader
// (shaders.js) so the outline and the light are the same everywhere. The tower stands on a small city block (a
// floating diorama); the sky behind it is a full-screen shader that changes by zone. One shared unit box for every
// mesh; each floor has its own small material (its colour, its windows' seed), disposed with it.
import * as THREE from 'three';
import { SLAB_VERT, SLAB_FRAG, RING_VERT, RING_FRAG, SKY_VERT, SKY_FRAG } from './shaders.js';
import { BASE, FLOOR_H } from './logic.js';
import { THEMES, themeNumbers, blendInto, floorRgb, hexToRgb, INK } from './theme.js';

THREE.ColorManagement.enabled = false;   // the palette's hex values go to the screen as they are

export const EL = (35 * Math.PI) / 180;  // the camera's elevation
export const AZ = Math.PI / 4;           // looking from +X +Z: X runs to the lower right, Z to the lower left
export const PLINTH = 0.2;               // the plinth's top: floor n's bottom is PLINTH + n × FLOOR_H
export const ISLAND = 3.4;               // the city block's half size
const ISLAND_DEPTH = 1.5;
export const levelY = (n) => PLINTH + n * FLOOR_H;

const LOBBY = hexToRgb('#efe4ff');
const PLINTH_C = hexToRgb('#a99ad8');
const NEIGHBOURS = [            // two little shops on the back corners (never where floors slide)
  { x: -2.75, z: -2.75, w: 1.05, d: 1.05, h: 1.55, c: '#4b4080' },
  { x: -2.8, z: 2.7, w: 0.95, d: 1.0, h: 1.05, c: '#5a4a8f' },
  { x: 2.7, z: -2.8, w: 1.0, d: 0.95, h: 1.25, c: '#3f3a73' },
];
const TREES = [[2.75, 2.55, 0.62], [2.3, 3.0, 0.5], [3.05, 2.05, 0.46], [-2.95, 2.0, 0.42], [2.0, -3.0, 0.44]];
const LAMPS = [[2.15, 2.15], [-2.15, 2.15], [2.15, -2.15]];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const approach = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const outBack = (t, s = 1.7) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

export function createScene(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('STACKED: the 3D view was lost (it comes back by itself)'); });
  renderer.setClearColor(0x0a0b26, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);

  // ---------- the light and the sky, shared by every material ----------
  const theme = {};
  const T = THEMES.map(themeNumbers);
  blendInto(theme, T[0], T[0], 0);
  const color = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]);
  const U = {
    uLightDir: { value: new THREE.Vector3(0.35, 1, 0.65).normalize() },
    uLightCol: { value: new THREE.Color() }, uAmbTop: { value: new THREE.Color() }, uAmbBot: { value: new THREE.Color() },
    uFogCol: { value: new THREE.Color() }, uFogY: { value: -100 }, uFogRange: { value: 10 }, uFogMax: { value: 0.8 },
    uLit: { value: 0.5 }, uLinePx: { value: 1.5 }, uDetail: { value: 1 },
    uInk: { value: new THREE.Color(INK) }, uGlass: { value: new THREE.Color() },
    uWinA: { value: new THREE.Color() }, uWinB: { value: new THREE.Color() }, uWinC: { value: new THREE.Color() },
    uPark: { value: new THREE.Color() },
  };
  const S = {
    uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, uTime: { value: 0 }, uAlt: { value: 0 }, uZoneAlt: { value: 0 },
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uMidAt: { value: 0.5 },
    uStars: { value: 0 }, uSkyline: { value: 0 }, uMoon: { value: 0 }, uRain: { value: 0 }, uClouds: { value: 0 },
    uCloudA: { value: new THREE.Color() }, uCloudB: { value: new THREE.Color() },
    uSun: { value: 0 }, uSunCol: { value: new THREE.Color() }, uSea: { value: 0 }, uSeaA: { value: new THREE.Color() }, uSeaB: { value: new THREE.Color() },
    uEarth: { value: 0 }, uEarthR: { value: 6 }, uEarthY: { value: -0.3 }, uEarthCol: { value: new THREE.Color() }, uLimb: { value: new THREE.Color() },
    uFlashL: { value: 0 }, uInk: U.uInk, uWin: { value: new THREE.Color('#ffc94d') },
    uJourney: { value: 0 }, uJBot: { value: 0 }, uJTop: { value: 1 },
    uJ0: { value: color(hexToRgb('#5a2a63')) }, uJ1: { value: color(hexToRgb('#1d1747')) }, uJ2: { value: color(hexToRgb('#4a5b6c')) },
    uJ3: { value: color(hexToRgb('#f2a088')) }, uJ4: { value: color(hexToRgb('#1d4ca8')) }, uJ5: { value: color(hexToRgb('#05041a')) },
  };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: S, depthWrite: false, depthTest: false,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const setC = (c, rgb) => c.setRGB(rgb[0], rgb[1], rgb[2]);
  function applyTheme() {
    setC(U.uLightCol.value, theme.light.map((v) => v * theme.lightK));
    setC(U.uAmbTop.value, theme.ambTop.map((v) => v * 0.62)); setC(U.uAmbBot.value, theme.ambBot.map((v) => v * 0.62));
    setC(U.uFogCol.value, theme.bot); setC(U.uGlass.value, theme.glass);
    setC(U.uWinA.value, theme.winA); setC(U.uWinB.value, theme.winB); setC(U.uWinC.value, theme.winC);
    setC(U.uPark.value, theme.park);
    U.uLit.value = theme.lit;
    setC(S.uTop.value, theme.top); setC(S.uMid.value, theme.mid); setC(S.uBot.value, theme.bot); S.uMidAt.value = theme.midAt;
    S.uStars.value = theme.stars; S.uSkyline.value = theme.skyline; S.uMoon.value = theme.moon; S.uRain.value = reduced ? theme.rain * 0.4 : theme.rain;
    S.uClouds.value = theme.clouds; setC(S.uCloudA.value, theme.cloudA); setC(S.uCloudB.value, theme.cloudB);
    S.uSun.value = theme.sun; setC(S.uSunCol.value, theme.sunCol); S.uSea.value = theme.sea; setC(S.uSeaA.value, theme.seaA); setC(S.uSeaB.value, theme.seaB);
    S.uEarth.value = theme.earth; S.uEarthR.value = theme.earthR; S.uEarthY.value = theme.earthY;
    setC(S.uEarthCol.value, theme.earthCol); setC(S.uLimb.value, theme.limb);
    if (islandMat) setC(islandMat.uniforms.uColor.value, theme.island);
    renderer.setClearColor(U.uFogCol.value, 1);
  }

  // ---------- materials and meshes ----------
  function material({ rgb, kind = 1, seed = 0, transparent = false }) {
    return new THREE.ShaderMaterial({
      vertexShader: SLAB_VERT, fragmentShader: SLAB_FRAG, transparent,
      uniforms: {
        ...U,
        uColor: { value: color(rgb) }, uSize: { value: new THREE.Vector3(1, 1, 1) }, uPat: { value: new THREE.Vector2() },
        uSeed: { value: seed }, uFlash: { value: 0 }, uAlpha: { value: 1 }, uKind: { value: kind },
      },
    });
  }
  function boxMesh(mat, x, y, z, w, h, d) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    mat.uniforms.uSize.value.set(w, h, d);
    return m;
  }
  const seedOf = (n) => n * 1.37 + 0.71;

  // the city block: the island, the plinth, the neighbours, trees and lamps
  const world = new THREE.Group();
  scene.add(world);
  let islandMat = material({ rgb: theme.island, kind: 4 });
  world.add(boxMesh(islandMat, 0, -ISLAND_DEPTH / 2, 0, ISLAND * 2, ISLAND_DEPTH, ISLAND * 2));
  world.add(boxMesh(material({ rgb: PLINTH_C, kind: 0 }), 0, PLINTH / 2, 0, BASE + 0.5, PLINTH, BASE + 0.5));
  NEIGHBOURS.forEach((b, i) => world.add(boxMesh(material({ rgb: hexToRgb(b.c), kind: 1, seed: 90 + i * 7.3 }), b.x, b.h / 2, b.z, b.w, b.h, b.d)));
  const trunk = material({ rgb: hexToRgb('#5b3b5e'), kind: 0 });
  const leaves = [material({ rgb: hexToRgb('#2fbf8f'), kind: 0 }), material({ rgb: hexToRgb('#3ee0a8'), kind: 0 })];
  TREES.forEach(([x, z, s], i) => {
    world.add(boxMesh(trunk, x, 0.22 * s, z, 0.16 * s, 0.44 * s, 0.16 * s));
    world.add(boxMesh(leaves[i % 2], x, 0.44 * s + 0.36 * s, z, 0.78 * s, 0.72 * s, 0.78 * s));
  });
  const pole = material({ rgb: hexToRgb('#2a2050'), kind: 0 });
  const bulb = material({ rgb: hexToRgb('#ffd36b'), kind: 3 });
  LAMPS.forEach(([x, z]) => { world.add(boxMesh(pole, x, 0.32, z, 0.06, 0.64, 0.06)); world.add(boxMesh(bulb, x, 0.68, z, 0.15, 0.1, 0.15)); });

  // ---------- the tower ----------
  const tower = new THREE.Group();
  scene.add(tower);
  const floors = [];          // { mesh, n, rect, settle, squash, grow: { from, to, t } }
  let moving = null;          // { mesh, n }
  const pieces = [];          // falling: { mesh, vel, spin, age, ground }
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false,
      uniforms: { uCenter: { value: new THREE.Vector3() }, uHalf: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 0.07 }, uAlpha: { value: 0 }, uCol: { value: new THREE.Color('#fffaf0') } },
    });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.visible = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
    rings.push({ mesh, t: 1, dur: 0.6, w: 1, d: 1, delay: 0 });
  }

  function setRect(mesh, rect, n) {
    mesh.scale.set(rect.w, FLOOR_H, rect.d);
    mesh.position.set(rect.x, levelY(n) + FLOOR_H / 2, rect.z);
    mesh.material.uniforms.uSize.value.set(rect.w, FLOOR_H, rect.d);
  }
  function floorMesh(rect, n, kind) {
    const mat = material({ rgb: n === 0 ? LOBBY : floorRgb(n), kind: n === 0 ? 2 : 1, seed: seedOf(n) });
    const mesh = new THREE.Mesh(box, mat);
    setRect(mesh, rect, n);
    tower.add(mesh);
    return { mesh, n, rect: { ...rect }, settle: 0, squash: 0, grow: null, kind };
  }
  function disposeMesh(mesh) {
    mesh.parent?.remove(mesh);
    mesh.material.dispose();
  }
  function clearTower() {
    for (const f of floors) disposeMesh(f.mesh);
    floors.length = 0;
    if (moving) { disposeMesh(moving.mesh); moving = null; }
    for (const p of pieces) disposeMesh(p.mesh);
    pieces.length = 0;
    for (const r of rings) { r.t = 1; r.mesh.visible = false; }
  }
  // a whole tower at once (no animation): the title's, the demo's head start, a new run's lobby
  function buildTower(list) {
    clearTower();
    for (const f of list) floors.push(floorMesh(f, f.n, f.kind));
  }

  function setMoving(rect, n, pat) {
    if (!moving || moving.n !== n) {
      if (moving) disposeMesh(moving.mesh);
      const mat = material({ rgb: floorRgb(n), kind: 1, seed: seedOf(n) });
      const mesh = new THREE.Mesh(box, mat);
      tower.add(mesh);
      moving = { mesh, n };
    }
    if (pat) moving.mesh.material.uniforms.uPat.value.set(pat.x, pat.y);
    setRect(moving.mesh, rect, n);
  }
  function hideMoving() { if (moving) { disposeMesh(moving.mesh); moving = null; } }
  const patOf = (n) => { const f = floors[floors.length - 1]; return f ? f.mesh.material.uniforms.uPat.value : null; };

  // the moving floor lands: it becomes the top floor (its mesh kept), the overhang falls
  function land(ev) {
    if (!moving) return null;
    const mesh = moving.mesh, n = moving.n;
    const pat = mesh.material.uniforms.uPat.value;
    const m = ev.moving, k = ev.axis, s = k === 'x' ? 'w' : 'd';
    const before = { x: pat.x, y: pat.y };
    if (ev.kind === 'cut') {
      if (k === 'x') pat.x += ev.placed.x - m.x; else pat.y += ev.placed.z - m.z;
    }
    const entry = { mesh, n, rect: { ...ev.placed }, settle: 1, squash: 0, grow: null, kind: ev.kind };
    if (ev.grew > 0) {
      entry.grow = { from: ev.placed[s] - ev.grew, to: ev.placed[s], s, t: 0 };
      setRect(mesh, { ...ev.placed, [s]: entry.grow.from }, n);
    } else setRect(mesh, ev.placed, n);
    floors.push(entry);
    moving = null;
    if (ev.fallen) {
      const fp = { x: before.x, y: before.y };
      if (k === 'x') fp.x += ev.fallen.x - m.x; else fp.y += ev.fallen.z - m.z;
      fall(ev.fallen, n, k, Math.sign(ev.delta) || 1, ev.speed, fp, false);
    }
    if (ev.kind === 'perfect') mesh.material.uniforms.uFlash.value = 0.62;
    return entry;
  }
  // a miss: the whole floor falls
  function miss(ev) {
    if (!moving) return;
    const pat = moving.mesh.material.uniforms.uPat.value;
    fall(ev.fallen, moving.n, ev.axis, Math.sign(ev.delta) || 1, ev.speed, { x: pat.x, y: pat.y }, true);
    hideMoving();
  }
  function fall(rect, n, axis, sign, speed, pat, whole) {
    const mat = material({ rgb: floorRgb(n), kind: 1, seed: seedOf(n), transparent: true });
    mat.uniforms.uPat.value.set(pat.x, pat.y);
    const mesh = new THREE.Mesh(box, mat);
    setRect(mesh, rect, n);
    tower.add(mesh);
    const push = (whole ? 0.5 : 0.9) + Math.min(1.2, rect[axis === 'x' ? 'w' : 'd'] * 0.15);
    const vel = new THREE.Vector3(axis === 'x' ? sign * push : 0, whole ? 0.6 : 1.2, axis === 'z' ? sign * push : 0);
    const spinRate = (whole ? 1.6 : 3.2) * sign;
    const spin = new THREE.Vector3(axis === 'z' ? spinRate : 0, 0, axis === 'x' ? -spinRate : 0);
    pieces.push({ mesh, vel, spin, age: 0, life: whole ? 2.6 : 1.5, bounced: false });
  }

  function ring(rect, n, { delay = 0, tone = '#fffaf0', dur = 0.62 } = {}) {
    const r = rings.find((q) => q.t >= 1) || rings[0];
    r.t = 0; r.delay = delay; r.dur = dur; r.w = rect.w; r.d = rect.d;
    r.mesh.position.set(rect.x, levelY(n) + FLOOR_H + 0.012, rect.z);
    r.mesh.material.uniforms.uCenter.value.copy(r.mesh.position);
    setC(r.mesh.material.uniforms.uCol.value, hexToRgb(tone));
    r.mesh.visible = false;
  }

  // ---------- the camera ----------
  const view = { w: 1, h: 1, dpr: 1 };
  const cam = { az: AZ, el: EL, fx: 0, fy: 1, fz: 0, tall: 12 };
  const want = { az: AZ, el: EL, fx: 0, fy: 1, fz: 0, tall: 12 };
  let mode = 'play', spinT = 0, bump = 0, bumpV = 0, shakeX = 0, shakeY = 0, time = 0, fogK = 1, journey = 0;
  const rightV = new THREE.Vector3(), upV = new THREE.Vector3(), dirV = new THREE.Vector3();
  function axes(az, el) {
    dirV.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    rightV.set(Math.cos(az), 0, -Math.sin(az));
    upV.set(-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az));
  }
  const aspect = () => view.w / view.h;
  // how many world units the screen is tall in play: a phone held up shows the tower's width, a wide screen its height
  function playTall() {
    const a = aspect();
    return Math.max(8.4 / a, 10, view.h / 112);
  }
  // where the moving floor sits on the screen (0 = top): a little above the middle on a phone held up
  const focusAt = () => 0.4 + 0.1 * clamp01((aspect() - 0.6) / 1.0);

  // play: follow the top of the tower (its centre, softly)
  function framePlay(topY, x, z, { snap = false } = {}) {
    mode = 'play';
    want.az = AZ; want.el = EL; want.tall = playTall();
    want.fy = topY - (0.5 - focusAt()) * want.tall / Math.cos(EL);
    want.fx = x * 0.6; want.fz = z * 0.6;
    if (snap) Object.assign(cam, want);
  }
  // the whole tower and its block in view (the end of a run, the title): its bounds seen from the camera
  function frameAll({ snap = false, title = false, pad = 1.14 } = {}) {
    mode = title ? 'title' : 'end';
    const top = floors.length ? levelY(floors[floors.length - 1].n + 1) : levelY(1);
    let minX = -ISLAND, maxX = ISLAND, minZ = -ISLAND, maxZ = ISLAND;
    for (const f of floors) {
      minX = Math.min(minX, f.rect.x - f.rect.w / 2); maxX = Math.max(maxX, f.rect.x + f.rect.w / 2);
      minZ = Math.min(minZ, f.rect.z - f.rect.d / 2); maxZ = Math.max(maxZ, f.rect.z + f.rect.d / 2);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const r = Math.hypot(maxX - minX, maxZ - minZ) / 2;          // any turn of the camera still fits
    const el = title ? EL * 0.82 : EL;
    axes(AZ, el);
    const yBot = -ISLAND_DEPTH, yTop = top;
    // the box's height on screen: its vertical extent plus the footprint's depth
    const hView = (yTop - yBot) * Math.cos(el) + 2 * r * Math.sin(el);
    const wView = 2 * r;
    const a = aspect();
    const barPad = 64 / view.h;                                  // the kit's bar
    const tall = Math.max(hView * pad / (1 - barPad), (wView * pad) / a, playTall() * 0.9);
    want.tall = tall; want.el = el; want.az = cam.az;
    // its middle in the middle of what's below the bar
    const midY = (yTop + yBot) / 2;
    want.fx = cx; want.fz = cz;
    want.fy = midY + (barPad * tall * 0.5) / Math.cos(el);
    if (snap) { Object.assign(cam, want); cam.az = AZ; }
  }
  function setJourney(v, snap = false) { journey = v; if (snap) S.uJourney.value = v; }

  function resize(w, h, dpr) {
    view.w = Math.max(1, w); view.h = Math.max(1, h); view.dpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(view.w, view.h, false);
    S.uRes.value.set(view.w * dpr, view.h * dpr);
    S.uDpr.value = dpr;
  }

  // ---------- each frame ----------
  function update(dt) {
    time += dt;
    S.uTime.value = time;
    // the drop's little nudge (the tower dips under the new floor): a spring back to rest
    bumpV += (-bump * 220 - bumpV * 22) * dt;
    bump += bumpV * dt;

    if (mode === 'title' || mode === 'end') spinT += dt;
    const rate = mode === 'end' ? 2.6 : mode === 'title' ? 3 : 7;
    cam.tall = approach(cam.tall, want.tall, rate, dt);
    cam.fy = approach(cam.fy, want.fy, rate, dt);
    cam.fx = approach(cam.fx, want.fx, 3, dt);
    cam.fz = approach(cam.fz, want.fz, 3, dt);
    cam.el = approach(cam.el, want.el, 3, dt);
    if (mode === 'title' || mode === 'end') cam.az = AZ + spinT * (reduced ? 0.04 : 0.1);
    else {
      // back to the play angle by the shortest way round
      let d = ((want.az - cam.az) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      cam.az = want.az - d * Math.exp(-4 * dt);
      spinT = 0;
    }
    fogK = approach(fogK, mode === 'play' ? 1 : 0, 2.5, dt);
    S.uJourney.value = approach(S.uJourney.value, journey, 2, dt);

    // falling pieces
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.age += dt;
      p.vel.y -= 22 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const pos = p.mesh.position;
      if (!p.bounced && pos.y < 0.3 && Math.abs(pos.x) < ISLAND && Math.abs(pos.z) < ISLAND) {
        pos.y = 0.3; p.vel.y *= -0.22; p.vel.x *= 0.5; p.vel.z *= 0.5; p.spin.multiplyScalar(0.4); p.bounced = true;
        p.life = Math.min(p.life, p.age + 0.45);
      } else if (p.bounced && pos.y < 0.3 && Math.abs(pos.x) < ISLAND && Math.abs(pos.z) < ISLAND) { pos.y = 0.3; p.vel.set(0, 0, 0); }
      const fade = 1 - smooth(clamp01((p.age - (p.life - 0.6)) / 0.6));
      p.mesh.material.uniforms.uAlpha.value = fade;
      if (p.age >= p.life || pos.y < cam.fy - cam.tall * 1.6) { disposeMesh(p.mesh); pieces.splice(i, 1); }
    }
    // the floors that just landed: a little drop, a squash, a flash, a grow
    for (let i = Math.max(0, floors.length - 4); i < floors.length; i++) {
      const f = floors[i];
      const u = f.mesh.material.uniforms;
      if (u.uFlash.value > 0) u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3.2);
      if (f.settle > 0 || f.squash < 1 || f.grow) {
        f.settle = Math.max(0, f.settle - dt / 0.07);
        if (f.settle === 0 && f.squash < 1) f.squash = Math.min(1, f.squash + dt / 0.2);
        const k = reduced ? 0 : Math.sin(Math.PI * f.squash) * 0.1 * (1 - f.squash * 0.3);
        const h = FLOOR_H * (1 - k);
        let w = f.rect.w, d = f.rect.d;
        if (f.grow) {
          f.grow.t = Math.min(1, f.grow.t + dt / 0.28);
          const g = f.grow.from + (f.grow.to - f.grow.from) * outBack(f.grow.t);
          if (f.grow.s === 'w') w = g; else d = g;
          if (f.grow.t >= 1) f.grow = null;
        }
        f.mesh.scale.set(w, h, d);
        u.uSize.value.set(w, FLOOR_H, d);
        f.mesh.position.y = levelY(f.n) + h / 2 + f.settle * f.settle * 0.09;
      }
    }
    // perfect rings
    for (const r of rings) {
      if (r.t >= 1) continue;
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = 1 - (1 - r.t) ** 3;
      const grow = 0.06 + e * 0.5;
      const u = r.mesh.material.uniforms;
      u.uHalf.value.set(r.w / 2 + grow, r.d / 2 + grow);
      u.uAlpha.value = (1 - r.t) ** 1.4;
      r.mesh.scale.set(r.w + 1.4, 1, r.d + 1.4);
      r.mesh.visible = r.t < 1;
    }
    S.uAlt.value = cam.fy;
  }

  function render() {
    axes(cam.az + (mode === 'play' && !reduced ? Math.sin(time * 0.37) * 0.02 : 0), cam.el + (mode === 'play' && !reduced ? Math.sin(time * 0.29) * 0.01 : 0));
    const tall = cam.tall;
    const ppu = view.h / tall;                       // CSS px per world unit
    const fy = cam.fy - bump * 0.07 + (shakeY / ppu) * upV.y;
    const fx = cam.fx + (shakeX / ppu) * rightV.x + (shakeY / ppu) * upV.x;
    const fz = cam.fz + (shakeX / ppu) * rightV.z + (shakeY / ppu) * upV.z;
    camera.position.set(fx + dirV.x * 200, fy + dirV.y * 200, fz + dirV.z * 200);
    camera.up.set(0, 1, 0);
    camera.lookAt(fx, fy, fz);
    const half = tall / 2, a = aspect();
    camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half;
    camera.near = 1; camera.far = 200 + Math.max(60, tall * 2);
    camera.updateProjectionMatrix();
    // lines thin out and windows melt into the wall as the tower gets small on screen
    const floorPx = FLOOR_H * Math.cos(cam.el) * ppu;
    U.uLinePx.value = Math.max(0.6, Math.min(1.45, floorPx * 0.085)) * view.dpr;
    U.uDetail.value = smooth(clamp01((0.375 * ppu - 6) / 8));
    // the haze below: the lower floors fade into the horizon's colour
    const below = (tall * (1 - focusAt())) / Math.cos(cam.el);
    U.uFogY.value = cam.fy + (0.5 - focusAt()) * tall / Math.cos(cam.el) - below * 0.42;
    U.uFogRange.value = below * 0.62;
    U.uFogMax.value = 0.82 * fogK;
    // the journey sky's range: what altitude the screen's bottom and top show (0 = the ground, 1 = space)
    const span = tall / Math.cos(cam.el);
    S.uJBot.value = (fy - span / 2) / JOURNEY_TOP;
    S.uJTop.value = (fy + span / 2) / JOURNEY_TOP;
    renderer.render(scene, camera);
  }
  const JOURNEY_TOP = levelY(170);

  const pv = new THREE.Vector3();
  function project(x, y, z, out = {}) {
    pv.set(x, y, z).project(camera);
    out.x = (pv.x * 0.5 + 0.5) * view.w;
    out.y = (0.5 - pv.y * 0.5) * view.h;
    return out;
  }

  // the theme: zone a → zone b, t in 0…1
  function setTheme(a, b, t) {
    blendInto(theme, T[a], T[b], smooth(clamp01(t)));
    applyTheme();
  }
  setTheme(0, 0, 0);

  return {
    renderer, camera, resize, update, render, project, setTheme, framePlay, frameAll, setJourney,
    buildTower, clearTower, setMoving, hideMoving, land, miss, ring, patOf,
    setShake(x, y) { shakeX = x; shakeY = y; },
    kick(v = 1) { if (!reduced) bumpV -= v * 18; },
    setLightning(v) { S.uFlashL.value = v; },
    setZoneAlt(v) { S.uZoneAlt.value = v; },
    get floors() { return floors; },
    get pieces() { return pieces.length; },
    get mode() { return mode; },
    get ppu() { return view.h / cam.tall; },
    get busy() { return pieces.length > 0 || rings.some((r) => r.t < 1) || Math.abs(cam.tall - want.tall) > 0.01 || Math.abs(cam.fy - want.fy) > 0.005; },
    dispose() { clearTower(); renderer.dispose(); },
  };
}
