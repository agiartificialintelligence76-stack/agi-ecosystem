// AGI-1's launch video: AGI-1 herself, alive. Her Live2D model (src/stage/agi1-2d.js, as on the site since 2026-10-01:
// breathing, blinking, looking, her mouth moving, her wave and every reaction, her hair physics), drawn by three.js on a
// canvas of its own and then into the frame wherever a scene puts her. Only her 2D self: never the 3D model.
// A "shot" is one stretch of her in a scene: she starts a second before it (so she's already breathing), and her motion
// is stepped in fixed 1/60 s steps from there, with her reactions on their moments. Asking for an earlier time starts
// the shot again from its beginning, so any frame looks the same however it was reached.
// Her hearts are drawn in 2D on top of her (the site's hearts, in Pop mode's colors), from the same seeded randomness.
import * as THREE from 'three';
import { loadAgi1_2D, createAgi1_2D } from '../../../src/stage/agi1-2d.js';
import { seeded, heart, clamp, C } from './kit.js';

const DT = 1 / 60, PREROLL = 1.2;
const HEARTS = [C.white, C.pink, C.honey, C.violet];

export async function createHer(ctx) {
  const glc = document.createElement('canvas');
  glc.width = 64; glc.height = 64;
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false, alpha: true, stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const model = await loadAgi1_2D({ renderer });
  await model.sharpen();                       // her 4096 px texture: she's big in some shots
  scene.add(model.holder);
  const camera = new THREE.PerspectiveCamera(18, 1, 0.05, 60);
  const L = model.landmarks;                   // her eyes, waist, the print on her shirt (world heights)
  let active = null;
  const stats = { steps: 0, resets: 0, renders: 0 };

  // her hearts: the controller asks for them at a world position; they float up and fade (as on the site)
  function heartsFor(state) {
    return {
      spawnHearts(origin, { count = 10, spread = 0.35, size = 0.1, rise = 0.8 } = {}) {
        const r = state.rnd;
        for (let i = 0; i < count; i++) {
          state.hearts.push({
            x: origin.x + (r() - 0.5) * spread, y: origin.y + (r() - 0.3) * spread * 0.6, z: origin.z + 0.12,
            size: size * (0.7 + r() * 0.6), age: -r() * 0.25, life: 1.1 + r() * 0.7,
            vx: (r() - 0.5) * 0.3, vy: rise * (0.6 + r() * 0.6), wob: r() * Math.PI * 2, color: HEARTS[i % HEARTS.length],
          });
        }
      },
      update() {},
      setHeartColors() {},
    };
  }

  function reset(spec) {
    const state = { spec, simT: spec.from - PREROLL, next: 0, hearts: [], rnd: seeded((spec.seed || 1) * 7 + 3), rand: seeded(spec.seed || 1) };
    const keep = Math.random;
    Math.random = state.rand;
    try {
      state.agi = createAgi1_2D(model, { camera, effects: heartsFor(state), reducedMotion: false, onGlow: () => {} });
      state.agi.setCloseUp(spec.closeUp !== false);
      state.agi.setPointer(null);
    } finally { Math.random = keep; }
    state.events = [...(spec.events || [])].sort((a, b) => a.at - b.at);
    stats.resets += 1;
    return state;
  }

  function step(state) {
    const { spec, agi } = state;
    const t = state.simT;
    while (state.next < state.events.length && state.events[state.next].at <= t + 1e-6) {
      const e = state.events[state.next++];
      if (e.react) agi.react(e.react);
      if (e.hello) agi.hello();
      if (e.attention) agi.setAttention(e.attention);
      if (e.pointer !== undefined) agi.setPointer(e.pointer);
    }
    agi.setTalk(spec.talk ? spec.talk(t) : 0);
    agi.update(DT);
    for (let i = state.hearts.length - 1; i >= 0; i--) {
      const h = state.hearts[i];
      h.age += DT;
      if (h.age < 0) continue;
      if (h.age >= h.life) { state.hearts.splice(i, 1); continue; }
      h.x += (h.vx + Math.sin(h.age * 5 + h.wob) * 0.12) * DT;
      h.y += h.vy * DT;
    }
    state.simT = +(t + DT).toFixed(6);
    stats.steps += 1;
  }

  // to time t (seconds, the video's clock)
  function advance(spec, t) {
    if (!active || active.spec !== spec || t < active.simT - 1e-6) active = reset(spec);
    const keep = Math.random;
    Math.random = active.rand;
    try { while (active.simT <= t - DT / 2) step(active); } finally { Math.random = keep; }
    return active;
  }

  // frame her in a box of the picture: her eyes `eyes` px and her waist `waist` px below the box's top (her model's own
  // heights, a long lens), centered at `cx` (px from the box's left; default its middle)
  function aim(box) {
    const { w, h, eyes, waist } = box;
    const perMetre = (waist - eyes) / (L.eyes - L.waist);
    const tall = h / perMetre;
    const centreY = L.eyes - (h / 2 - eyes) / perMetre;
    const shiftX = ((box.cx ?? w / 2) - w / 2) / perMetre;
    camera.aspect = w / h;
    camera.fov = 18;
    camera.updateProjectionMatrix();
    const dist = tall / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(-shiftX, centreY, dist);
    camera.lookAt(-shiftX, centreY, 0);
    camera.updateMatrixWorld();
    return perMetre;
  }

  const v = new THREE.Vector3();
  // draws her (and her hearts) into g, in the box { x, y, w, h, eyes, waist, cx?, res? (her pixels per box pixel) }
  function draw(g, spec, t, box, { alpha = 1 } = {}) {
    const state = advance(spec, t);
    const res = Math.min(1, box.res ?? 1) * ctx.scale;
    const pw = Math.max(16, Math.round(box.w * res)), ph = Math.max(16, Math.round(box.h * res));
    if (glc.width !== pw || glc.height !== ph) renderer.setSize(pw, ph, false);
    aim(box);
    renderer.clear();
    renderer.render(scene, camera);
    stats.renders += 1;
    g.save();
    g.globalAlpha *= alpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(glc, box.x, box.y, box.w, box.h);
    // her hearts, in front of her
    for (const hrt of state.hearts) {
      if (hrt.age < 0) continue;
      v.set(hrt.x, hrt.y, hrt.z).project(camera);
      const sx = box.x + (v.x * 0.5 + 0.5) * box.w, sy = box.y + (0.5 - v.y * 0.5) * box.h;
      const p = hrt.age / hrt.life;
      const pop = Math.min(1, hrt.age / 0.18);
      const perM = (box.waist - box.eyes) / (L.eyes - L.waist);
      const s = hrt.size * perM * (pop < 1 ? pop * 1.25 : 1) * (box.hearts ?? 1);
      const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      g.save();
      g.translate(sx, sy);
      g.rotate(Math.sin(hrt.age * 4 + hrt.wob) * 0.25);
      heart(g, 2, 3, s, 'rgba(23,10,54,0.9)', a);           // a hard shadow, Pop mode style
      heart(g, 0, 0, s, hrt.color, a);
      g.restore();
    }
    g.restore();
    return state;
  }

  return {
    model, draw, stats,
    // a shot: { from, seed, events: [{ at, react | hello | attention | pointer }], talk: (t) => 0..1, closeUp }
    shot: (spec) => ({ ...spec, draw: (g, t, box, o) => draw(g, spec, t, box, o) }),
    // a made-up talking rhythm while she "says" something silently (her mouth, like the site with her voice off)
    talking: (from, to, strength = 0.85) => (t) => {
      if (t < from || t > to) return 0;
      const k = t - from, fade = Math.min(1, k / 0.12, (to - t) / 0.18);
      const syll = 0.5 + 0.5 * Math.sin(k * 2 * Math.PI * 4.2 + Math.sin(k * 3.1) * 1.8);
      return clamp(fade * strength * (0.25 + 0.75 * syll * (0.6 + 0.4 * Math.sin(k * 1.7 + 1))));
    },
  };
}
