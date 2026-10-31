import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene, Character, Environment, Animation } from '@viggle/splat-engine';
import { buildingMaterial, addCitySigns } from './atmosphere.js';
import { ChartSky } from './sky.js';
import { lookAt, ZONE_LOOKS } from './zones.js';
import * as art from './textures.js';

const color = hex => new pc.Color().fromString(hex);
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const asset = path => `/games/skybreak/${path}`;
const VIEW_BELOW = 30, VIEW_ABOVE = 46;

// Per-skin palettes. Candles use the chart's own green and red.
const SKINS = {
  rooftop: { side: '#6a7078', trim: '#ff9d4a', top: 'concrete' },
  launch: { side: '#5f656e', trim: '#ffb35c', top: 'helipad' },
  terminal: { side: '#141c33', trim: '#38e8ff', top: 'terminal' },
  cloud: { side: '#ffffff', trim: '#bfe6ff' },
  storm: { side: '#2a2e39', trim: '#ff3b4f', top: 'storm' },
  gold: { side: '#d9a521', trim: '#ff7ab6', top: 'gold' },
  crystal: { side: '#8fd0ff', trim: '#ffffff', top: 'crystal' },
  satellite: { side: '#e4e8ef', trim: '#5aa0ff', top: 'solar' },
  moon: { side: '#9fa1a8', trim: '#fff2c4', top: 'moon' },
  orderbook: { side: '#101828', trim: '#e8f0ff', top: 'orderbook' },
  rail: { side: '#0f1f22', trim: '#2ef0a6', top: 'rail' },
  rug: { side: '#6b4a2e', trim: '#e8b04a', top: 'rug' },
  pad: { side: '#2c2a3a', trim: '#ffcf64' },
  bridge: { side: '#3a3346', trim: '#f9b1e7' },
  rift: { side: '#2f2740', trim: '#f9b1e7' },
  bonus: { side: '#b8860b', trim: '#ffe28a', top: 'gold' },
  moonbase: { side: '#3b3f4a', trim: '#fff2c4', top: 'moon' },
};

export class SkyRenderer {
  static async create(canvas, world, progress) {
    const scene = await Scene.create(canvas, { backend: 'webgl', depth: true, antialias: false, maxPixelRatio: 1, fov: 63, near: .08, far: 1900, ambientLight: .72, exposure: 1.1, bgColor: { r: .67, g: .72, b: .83, a: 1 } });
    const renderer = new SkyRenderer(scene, world); scene.start(); progress(22, 'Printing the chart…');
    renderer.character = await Character.load(scene, asset('characters/agi1-high.vsplat'), { name: 'AGI-1 Skybreak', position: world.spawn });
    renderer.character.setScale(1, 1, 1); renderer.character.setRotation(0, 180, 0);
    renderer.installMotion(); progress(50, 'AGI-1 is ready. Opening the city…');
    const motionNames = ['idle', 'run', 'jump', 'roll', 'mantle', 'fall', 'hang'];
    // Optional clips are listed in a manifest; no blind requests for missing files.
    try { const response = await fetch(asset('motions/manifest.json')); if (response.ok) { const manifest = await response.json(); for (const name of motionNames) { if (manifest[name]) { await Animation.loadGlb(scene, asset(`motions/${manifest[name]}`), name); renderer.clips.add(name); } } } } catch (error) { console.warn('Motion library unavailable; using the rig controller.', error.message); }
    if (renderer.clips.has('idle')) renderer.character.crossfadeTo('idle', { duration: 0, loop: true, rootMotion: false });
    progress(62, 'Stitching the launch district…');
    try {
      renderer.environment = await Environment.load(scene, asset('environment/launch-plaza-medium.spz'), { name: 'Skybreak Launch Plaza', scale: 16 });
      const upProbe = renderer.environment.probeGroundDepth(-1), downProbe = renderer.environment.probeGroundDepth(1);
      const flip = (downProbe?.flatness || 0) > (upProbe?.flatness || 0);
      const depth = (flip ? downProbe : upProbe)?.depth;
      renderer.envDepth = depth;
      renderer.environment.entity.setEulerAngles(flip ? 180 : 0, 0, 0);
      renderer.environment.entity.setPosition(0, (depth && Number.isFinite(depth) ? depth * 16 : 16) - 4, 0);
      // Keep the generated skyline outside the collision scaffold. Every nearby visible landing is a real collider.
      // The far haze of the capture would hide the sky above the skyline; keep only the city itself.
      renderer.environment.setClipDistanceOrigin(new pc.Vec3(0, 0, 0)); renderer.environment.setClipDistance(30, 230);
      renderer.environment.setClipMaxY(180);
      renderer.applyEnvironmentTint(true);
    } catch (error) { renderer.environmentError = error; throw new Error(`The JST-2 environment could not load: ${error.message}`); }
    progress(94, 'Checking your footing…'); return renderer;
  }

  constructor(scene, world) {
    this.scene = scene; this.app = scene.app; this.world = world;
    this.platformEntities = new Map(); this.dynamicVisuals = []; this.platformList = [];
    this.hazardEntities = new Map(); this.anchorEntities = []; this.coinEntities = new Map(); this.decor = [];
    this.time = 0; this.facing = 90; this.clips = new Set(); this.motion = 'idle'; this.quality = 'high';
    this.cameraPos = new pc.Vec3(0, 4, 9); this.frameTimes = []; this.lastPoseState = { speed: 0, state: 'idle', grounded: true };
    this.materials = new Map(); this.textures = new Map(); this.geometries = new Map();
    this.look = lookAt(0); this.shakeAmount = 0; this.flashTimer = 4; this.boltTimer = 0; this.envTintApplied = null;
    this.onThunder = null; this.collected = new Set();
    this.menuView = { target: new pc.Vec3(6, 7, -6), eye: new pc.Vec3(-8, 3.5, 13) };
    this.sky = new ChartSky(scene);
    const fog = this.app.scene.fog; fog.type = pc.FOG_LINEAR; fog.start = 45; fog.end = 320;
    this.sun = new pc.Entity('Sun'); this.sun.addComponent('light', { type: 'directional', color: color('#ffd8b0'), intensity: 2.1, castShadows: false });
    this.app.root.addChild(this.sun);
    this.fill = new pc.Entity('Bounce light'); this.fill.addComponent('light', { type: 'directional', color: color('#7f8fb8'), intensity: 0.45, castShadows: false });
    this.fill.setEulerAngles(160, 30, 0); this.app.root.addChild(this.fill);
    this.buildWorld();
    this.shadow = this.mesh('Shadow', 'cylinder', this.solid('#120c1c', { opacity: .3, lit: false })); this.shadow.setLocalScale(.95, .009, .95);
    this.rope = this.mesh('Grapple line', 'cylinder', this.solid('#c9f6ff', { emissive: 1.2 })); this.rope.enabled = false;
    this.bursts = Array.from({ length: 10 }, (_, i) => {
      const material = this.solid('#ffffff', { emissive: 1.4, additive: true, lit: false, key: `burst-${i}` });
      const entity = this.mesh('Burst', 'sphere', material); entity.enabled = false;
      return { entity, material, life: 0, duration: .5, size: 1 };
    });
    this.applyLook(0, true);
  }

  // ── Materials, textures, geometry ────────────────────────────────────────
  texture(name, factory) {
    if (this.textures.has(name)) return this.textures.get(name);
    const source = factory();
    const tex = new pc.Texture(this.scene.graphicsDevice, { name, width: source.width, height: source.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, anisotropy: 4, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
    tex.setSource(source);
    this.textures.set(name, tex);
    return tex;
  }

  topTexture(kind, tone) {
    switch (kind) {
      case 'concrete': return this.texture('concrete', () => art.concreteTop());
      case 'helipad': return this.texture('helipad', () => art.helipad());
      case 'terminal': return this.texture('terminal', () => art.terminalTop());
      case 'storm': return this.texture('storm-top', () => art.stormTop());
      case 'gold': return this.texture('gold', () => art.goldTop());
      case 'crystal': return this.texture('crystal', () => art.crystalFace());
      case 'solar': return this.texture('solar', () => art.solarTop());
      case 'moon': return this.texture('moon-rock', () => art.moonRock(5, 256));
      case 'orderbook': return this.texture('orderbook-top', () => art.orderBookTop());
      case 'rail': return this.texture('rail', () => art.railTop());
      case 'rug': return this.texture('rug', () => art.rugTop());
      case 'candle': return this.texture(`candle-top-${tone}`, () => art.candleTop(tone));
      default: return null;
    }
  }

  /** A cached StandardMaterial. `map` textures both diffuse and emissive when `emissive` > 0. */
  solid(hex, { emissive = 0, emissiveHex = hex, metalness = .12, gloss = .42, map = null, emissiveMap = map, opacity = 1, additive = false, lit = true, tiling = null, key = '' } = {}) {
    const id = `${hex}|${emissive}|${emissiveHex}|${metalness}|${gloss}|${map?.name}|${emissiveMap?.name}|${opacity}|${additive}|${lit}|${tiling}|${key}`;
    if (this.materials.has(id)) return this.materials.get(id);
    const m = new pc.StandardMaterial();
    m.diffuse = color(hex); m.metalness = metalness; m.gloss = gloss; m.useMetalness = true;
    m.emissive = color(emissiveHex); m.emissiveIntensity = emissive;
    if (map) { m.diffuseMap = map; if (tiling) m.diffuseMapTiling.set(tiling[0], tiling[1]); }
    if (emissiveMap && emissive > 0) { m.emissiveMap = emissiveMap; m.emissive = pc.Color.WHITE; if (tiling) m.emissiveMapTiling.set(tiling[0], tiling[1]); }
    if (!lit) { m.useLighting = false; m.useFog = !additive; }
    if (additive) { m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.diffuse = pc.Color.BLACK; }
    else if (opacity < 1) { m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.opacity = opacity;
    m.update();
    this.materials.set(id, m);
    return m;
  }

  baseGeometry(shape) {
    if (this.geometries.has(shape)) return this.geometries.get(shape);
    let geometry;
    if (shape === 'box') geometry = new pc.BoxGeometry({ halfExtents: new pc.Vec3(.5, .5, .5) });
    else if (shape === 'sphere') geometry = new pc.SphereGeometry({ radius: .5, latitudeBands: 10, longitudeBands: 14 });
    else if (shape === 'cylinder') geometry = new pc.CylinderGeometry({ radius: .5, height: 1, heightSegments: 1, capSegments: 18 });
    else if (shape === 'cone') geometry = new pc.ConeGeometry({ baseRadius: .5, peakRadius: 0, height: 1, heightSegments: 1, capSegments: 6 });
    else if (shape === 'gem') geometry = new pc.ConeGeometry({ baseRadius: .5, peakRadius: 0, height: 1, heightSegments: 1, capSegments: 4 });
    this.geometries.set(shape, geometry);
    return geometry;
  }

  /** Bake several transformed primitives into one mesh: one draw call per material per platform. */
  merged(parts) {
    const positions = [], normals = [], uvs = [], indices = [];
    const p = new pc.Vec3(), n = new pc.Vec3(), q = new pc.Quat(), m = new pc.Mat4(), scale = new pc.Vec3(), pos = new pc.Vec3();
    for (const part of parts) {
      const g = this.baseGeometry(part.shape || 'box');
      const sx = part.sx ?? 1, sy = part.sy ?? 1, sz = part.sz ?? 1;
      q.setFromEulerAngles(part.rx || 0, part.ry || 0, part.rz || 0);
      m.setTRS(pos.set(part.x || 0, part.y || 0, part.z || 0), q, scale.set(sx, sy, sz));
      const base = positions.length / 3;
      for (let i = 0; i < g.positions.length; i += 3) {
        p.set(g.positions[i], g.positions[i + 1], g.positions[i + 2]);
        m.transformPoint(p, p);
        positions.push(p.x, p.y, p.z);
        n.set(g.normals[i] / sx, g.normals[i + 1] / sy, g.normals[i + 2] / sz);
        q.transformVector(n, n); n.normalize();
        normals.push(n.x, n.y, n.z);
      }
      if (g.uvs) for (let i = 0; i < g.uvs.length; i++) uvs.push(g.uvs[i]);
      else for (let i = 0; i < g.positions.length / 3; i++) uvs.push(0, 0);
      for (const index of g.indices) indices.push(index + base);
    }
    const geometry = new pc.Geometry();
    geometry.positions = positions; geometry.normals = normals; geometry.uvs = uvs; geometry.indices = indices;
    return pc.Mesh.fromGeometry(this.scene.graphicsDevice, geometry);
  }

  meshEntity(name, mesh, material, parent = this.scene.contentRoot) {
    const entity = new pc.Entity(name);
    entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false, receiveShadows: false });
    parent.addChild(entity);
    return entity;
  }

  addParts(name, parts, material, parent) { return parts.length ? this.meshEntity(name, this.merged(parts), material, parent) : null; }

  mesh(name, type, material, parent = this.scene.contentRoot) { const entity = new pc.Entity(name); entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false }); parent.addChild(entity); return entity; }
  box(name, x, y, z, w, h, d, material, parent) { const e = this.mesh(name, 'box', material, parent); e.setLocalPosition(x, y, z); e.setLocalScale(w, h, d); return e; }

  // ── The climb ────────────────────────────────────────────────────────────
  buildWorld() {
    for (const p of this.world.platforms) this.buildPlatform(p);
    for (const a of this.world.anchors) {
      const root = new pc.Entity(a.id); this.scene.contentRoot.addChild(root); root.setPosition(a.x, a.y, a.z);
      const gem = this.addParts('Diamond', [{ shape: 'gem', y: .22, sx: .55, sy: .45, sz: .55 }, { shape: 'gem', y: -.22, sx: .55, sy: .45, sz: .55, rx: 180 }], this.solid('#bff4ff', { emissive: 1.1, emissiveHex: '#8fe8ff' }), root);
      const ring = this.makeRing(root, .85, '#9ff0ff', 20);
      this.anchorEntities.push({ root, gem, ring, def: a });
    }
    for (const h of this.world.hazards) {
      const root = new pc.Entity(h.id); this.scene.contentRoot.addChild(root); root.setPosition(h.x, h.y, h.z);
      this.box('Liquidation laser', 0, 0, 0, h.w, h.h * .55, h.d * .55, this.solid('#ff2a3d', { emissive: 2.2, lit: false }), root);
      this.box('Laser glow', 0, 0, 0, h.w, h.h * 1.6, h.d * 1.9, this.solid('#ff2a3d', { emissive: .7, additive: true, lit: false }), root);
      this.addParts('Emitters', [{ shape: 'sphere', x: -h.w / 2, sx: .5, sy: .5, sz: .5 }, { shape: 'sphere', x: h.w / 2, sx: .5, sy: .5, sz: .5 }, { shape: 'cylinder', y: -.5, sx: .18, sy: 1, sz: .18 }], this.solid('#3a1820', { emissive: .5, emissiveHex: '#ff4a5c' }), root);
      this.hazardEntities.set(h.id, root);
    }
    const coinMaterial = this.solid('#f5c542', { emissive: .55, map: this.texture('coin', () => art.coinFace()), metalness: .3, gloss: .7 });
    for (const coin of this.world.coins || []) {
      const root = new pc.Entity(coin.id); this.scene.contentRoot.addChild(root); root.setPosition(coin.x, coin.y, coin.z);
      const disc = this.mesh('Coin', 'cylinder', coinMaterial, root); disc.setLocalScale(.62, .07, .62); disc.setLocalEulerAngles(90, 0, 0);
      this.coinEntities.set(coin.id, { root, disc, def: coin, pop: 0 });
    }
    this.buildDecor();
  }

  buildPlatform(p) {
    const root = new pc.Entity(p.id); this.scene.contentRoot.addChild(root); root.setPosition(p.x, p.y, p.z);
    const item = { root, def: p, parts: {} };
    const skin = p.skin === 'candle' ? null : SKINS[p.skin] || SKINS.rooftop;
    const w = p.w, d = p.d, h = p.h;
    if (p.skin === 'candle') this.buildCandle(item);
    else if (p.skin === 'cloud') {
      const puffs = [{ shape: 'sphere', y: -.2, sx: w * 1.08, sy: .55, sz: d * 1.08 }, { shape: 'sphere', y: -.55, sx: w * .9, sy: 1.1, sz: d * .9 }];
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) puffs.push({ shape: 'sphere', x: cx * w * .32, y: -.32, z: cz * d * .32, sx: w * .55, sy: .9, sz: d * .55 });
      for (const [cx, cz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) puffs.push({ shape: 'sphere', x: cx * w * .42, y: -.5, z: cz * d * .42, sx: 1.4, sy: 1.0, sz: 1.4 });
      this.addParts('Cloud', puffs, this.solid('#f4f8ff', { emissive: .12, emissiveHex: '#dceeff', gloss: .1, metalness: 0 }), root);
      // A soft cyan rim marks where the walkable top of a cloud ends.
      this.addParts('Cloud rim', [{ y: .02, z: d / 2, sx: w * .9, sy: .05, sz: .05 }, { y: .02, z: -d / 2, sx: w * .9, sy: .05, sz: .05 },
        { x: w / 2, y: .02, sx: .05, sy: .05, sz: d * .9 }, { x: -w / 2, y: .02, sx: .05, sy: .05, sz: d * .9 }], this.solid('#5cc8ff', { emissive: 1.2, lit: false }), root);
    } else {
      const side = this.sideMaterial(p.skin, skin);
      const body = [{ y: -h / 2, sx: w, sy: h, sz: d }];
      if (p.skin === 'rooftop' || p.skin === 'launch') { body.push({ x: w / 2 + .14, y: -h * .55, z: d * .18, sx: .28, sy: .5, sz: .9 }); body.push({ y: -h - .16, sx: w * .6, sy: .32, sz: d * .6 }); }
      if (p.skin === 'satellite') body.push({ shape: 'cylinder', x: w * .3, y: .55, z: -d * .3, sx: .06, sy: 1.1, sz: .06 }, { shape: 'sphere', x: w * .3, y: 1.12, z: -d * .3, sx: .16, sy: .16, sz: .16 });
      if (p.skin === 'moon' || p.skin === 'moonbase') for (const [bx, bz, s] of [[-.3, -.2, 1.6], [.25, .3, 1.3], [.1, -.32, 1.1]]) body.push({ shape: 'sphere', x: bx * w, y: -h - s * .25, z: bz * d, sx: s * 1.4, sy: s, sz: s * 1.2 });
      if (p.skin === 'crystal') for (const [bx, bz, s] of [[-.25, -.2, 1.8], [.22, .25, 1.4], [.1, -.3, 1.1]]) body.push({ shape: 'cone', x: bx * w, y: -h - s / 2, z: bz * d, sx: .9 * s / 1.6, sy: s, sz: .9 * s / 1.6, rx: 180 });
      if (p.skin === 'gold') body.push({ y: -h - .12, sx: w * .82, sy: .24, sz: d * .82 });
      item.parts.body = this.addParts('Body', body, side, root);
      const topKind = skin.top;
      if (topKind) {
        const map = this.topTexture(topKind);
        const glow = { terminal: .9, rail: 1.2, orderbook: .7, crystal: .55, gold: .3, rug: .15, solar: .25, storm: .25 }[topKind] ?? 0;
        const tiling = topKind === 'rail' ? null : null;
        const capMaterial = this.solid('#ffffff', { map, emissive: glow, gloss: topKind === 'gold' ? .8 : .35, metalness: topKind === 'gold' ? .35 : .08, tiling });
        const ry = topKind === 'rail' && Math.abs(p.dirZ || 0) > .5 ? 90 : 0;
        const capW = ry ? d : w, capD = ry ? w : d;
        item.parts.cap = this.addParts('Deck', [{ y: -.012, sx: capW - .06, sy: .03, sz: capD - .06, ry }], capMaterial, root);
        if (p.skin === 'rug') item.parts.cap.setLocalPosition(0, .02, 0);
      }
      const trim = this.solid(skin.trim, { emissive: p.skin === 'cloud' ? .3 : 1.3, lit: false });
      const edges = [{ y: -.05, z: d / 2 + .012, sx: w + .02, sy: .06, sz: .03 }, { y: -.05, z: -d / 2 - .012, sx: w + .02, sy: .06, sz: .03 },
        { x: w / 2 + .012, y: -.05, sx: .03, sy: .06, sz: d + .02 }, { x: -w / 2 - .012, y: -.05, sx: .03, sy: .06, sz: d + .02 }];
      if (p.skin === 'rail') edges.push({ y: -h + .05, sx: w + .04, sy: .05, sz: d + .04 });
      item.parts.trim = this.addParts('Trim', edges, trim, root);
    }
    if (p.type === 'crumble') {
      const cracks = [];
      for (let i = 0; i < 4; i++) cracks.push({ x: -w * .3 + i * w * .2, y: .006, z: (i % 2 ? .2 : -.15) * d, sx: .05, sy: .01, sz: d * .62, ry: 22 - i * 15 });
      this.addParts('Fractures', cracks, this.solid('#2a1a16', { lit: false }), root);
      this.addParts('Warning', [{ y: -.05, z: d / 2 + .02, sx: w * .7, sy: .07, sz: .03 }], this.solid('#ff7a3d', { emissive: 1.6, lit: false }), root);
    }
    if (p.type === 'pad') {
      const ring = this.mesh('Updraft ring', 'cylinder', this.solid('#ffcf64', { emissive: 1.1 }), root); ring.setLocalPosition(0, .07, 0); ring.setLocalScale(w * .72, .1, d * .72);
      const core = this.mesh('Updraft core', 'cylinder', this.solid('#fffbe1', { emissive: 1.6, lit: false }), root); core.setLocalPosition(0, .13, 0); core.setLocalScale(w * .38, .04, d * .38);
      const column = this.mesh('Updraft column', 'cylinder', this.solid('#ffcf64', { emissive: .2, additive: true, lit: false }), root); column.setLocalPosition(0, 1.8, 0); column.setLocalScale(w * .6, 3.6, d * .6);
      item.parts.column = column;
    }
    if (p.type === 'checkpoint' || p.type === 'finish') {
      const finish = p.type === 'finish';
      const ring = this.makeRing(root, finish ? 3.6 : 1.1, finish ? '#fff2c4' : '#f9b1e7', finish ? 48 : 24);
      ring.setLocalPosition(0, finish ? 3.6 : 1.45, 0); root.rift = ring;
      if (finish) this.buildFlag(root, w, d);
    }
    if (p.label) { const sign = this.makeSign(p.label, p.type === 'finish' ? 5.4 : p.id === 'launch' ? 4.2 : p.gate ? 4.6 : 2.4, p.gate ? ZONE_LOOKS[p.section]?.accent : '#ffe7b8'); root.addChild(sign); sign.setLocalPosition(0, .055, p.type === 'finish' ? -d * .3 : p.id === 'launch' ? -d * .4 : 0); }
    this.platformEntities.set(p.id, item);
    this.platformList.push(item);
    if (p.motion || ['crumble', 'pump', 'dump', 'rug'].includes(p.type)) this.dynamicVisuals.push(item);
  }

  sideMaterial(skinName, skin) {
    switch (skinName) {
      case 'storm': return this.solid('#ffffff', { map: this.texture('storm-side', () => art.stormSide()), emissive: .45, tiling: [2, 1] });
      case 'orderbook': return this.solid('#ffffff', { map: this.texture('orderbook-side', () => art.orderBookSide()), emissive: .75 });
      case 'crystal': return this.solid('#ffffff', { map: this.texture('crystal', () => art.crystalFace()), emissive: .45, gloss: .9 });
      case 'moon': case 'moonbase': return this.solid('#ffffff', { map: this.texture('moon-rock', () => art.moonRock(5, 256)), gloss: .15, metalness: 0 });
      case 'gold': case 'bonus': return this.solid(skin.side, { emissive: .22, emissiveHex: '#ffcc55', metalness: .35, gloss: .72 });
      case 'terminal': return this.solid(skin.side, { emissive: .35, emissiveHex: '#1b3370' });
      case 'satellite': return this.solid(skin.side, { gloss: .7, metalness: .2 });
      default: return this.solid(skin.side, { metalness: .1, gloss: .35 });
    }
  }

  /** A chart candle: a glowing body, its walkable cap, wicks, and for pumps a target frame. */
  buildCandle(item) {
    const p = item.def, root = item.root, w = p.w, d = p.d, h = p.h;
    const tone = p.tone === 'red' ? 'red' : 'green';
    const hex = tone === 'green' ? art.GREEN : art.RED;
    const face = this.texture(`candle-face-${tone}`, () => art.candleFace(tone));
    const bodyMaterial = this.solid('#9a9a9a', { map: face, emissive: .5, gloss: .55 });
    item.parts.body = this.addParts('Candle body', [{ y: -.5, sx: w, sy: 1, sz: d }], bodyMaterial, root);
    item.parts.body.setLocalScale(1, h, 1);
    // Mostly emissive, lightly lit: the cap keeps its chart colour under any sun.
    item.parts.cap = this.addParts('Candle cap', [{ y: -.012, sx: w - .04, sy: .03, sz: d - .04 }], this.solid('#6d6d6d', { map: this.topTexture('candle', tone), emissive: .62, gloss: .3 }), root);
    const wickMaterial = this.solid(hex, { emissive: 1.1, lit: false });
    const wickDown = p.type === 'dump' ? (p.drop || 5) : p.wickDown || 1.4;
    item.parts.wickDown = this.addParts('Lower wick', [{ y: -.5, sx: .26, sy: 1, sz: .26 }], wickMaterial, root);
    item.parts.wickDown.setLocalPosition(0, -h, 0); item.parts.wickDown.setLocalScale(1, wickDown, 1);
    item.wickDownLength = wickDown;
    if (p.type === 'pump') {
      // The upper wick is the forecast: it shows exactly how high this candle will pump.
      const beam = this.solid('#22e58f', { emissive: 1.5, additive: true, lit: false });
      item.parts.wickUp = this.addParts('Pump forecast', [{ y: .5, sx: .1, sy: 1, sz: .1 }], beam, root);
      item.parts.target = this.addParts('Pump target', [
        { z: d / 2, sx: w, sy: .05, sz: .05 }, { z: -d / 2, sx: w, sy: .05, sz: .05 },
        { x: w / 2, sx: .05, sy: .05, sz: d }, { x: -w / 2, sx: .05, sy: .05, sz: d }], beam, root);
      item.parts.arrow = this.addParts('Pump arrow', [{ shape: 'cone', y: .3, sx: .5, sy: .55, sz: .5 }], this.solid('#b8ffe2', { emissive: 1.6, lit: false }), root);
    } else if (p.wickUp) {
      item.parts.wickUp = this.addParts('Upper wick', [{ y: .5, sx: .07, sy: 1, sz: .07 }], this.solid(hex, { emissive: 1.1, additive: true, lit: false }), root);
      item.parts.wickUp.setLocalScale(1, p.wickUp, 1);
    }
    if (p.type === 'dump') item.parts.warn = this.addParts('Dump warning', [{ y: -.05, z: d / 2 + .02, sx: w, sy: .08, sz: .03 }, { y: -.05, z: -d / 2 - .02, sx: w, sy: .08, sz: .03 }], this.solid('#ffd0d3', { emissive: 2, lit: false }), root);
    if (p.god) { const halo = this.makeRing(root, 3.2, '#b8ffe2', 40); halo.setLocalPosition(0, .4, 0); item.parts.halo = halo; }
  }

  buildFlag(root, w, d) {
    this.addParts('Flag pole', [{ shape: 'cylinder', x: w * .32, y: 2.2, z: -d * .32, sx: .09, sy: 4.4, sz: .09 }], this.solid('#e8ecf2', { gloss: .8 }), root);
    const flag = this.texture('flag', () => art.signLabel('AGI-1', '#16c784', 'TO THE MOON'));
    const material = this.solid('#ffffff', { map: flag, emissive: 1, lit: false, key: 'flag' });
    material.opacityMap = flag; material.opacityMapChannel = 'a'; material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; material.cull = pc.CULLFACE_NONE; material.update();
    const banner = this.mesh('Flag', 'plane', material, root);
    banner.setLocalPosition(w * .32 + 1.3, 3.6, -d * .32); banner.setLocalEulerAngles(90, 0, 0); banner.setLocalScale(2.6, 1, .65);
    const back = this.mesh('Flag cloth', 'box', this.solid('#0b1026', { emissive: .2 }), root);
    back.setLocalPosition(w * .32 + 1.3, 3.6, -d * .32 - .03); back.setLocalScale(2.6, .7, .02);
  }

  makeRing(parent, radius, hex, segments) {
    const root = new pc.Entity('Ring'); parent.addChild(root);
    const mesh = pc.Mesh.fromGeometry(this.scene.graphicsDevice, new pc.TorusGeometry({ tubeRadius: .05, ringRadius: radius, segments, sides: 5 }));
    const part = new pc.Entity('Arc'); part.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, this.solid(hex, { emissive: 1.2, lit: false }))], castShadows: false });
    root.addChild(part); part.setLocalEulerAngles(90, 0, 0); return root;
  }

  makeSign(text, width, hex = '#ffe7b8') {
    const tex = this.texture(`sign-${text}-${hex}`, () => art.signLabel(text, hex));
    const m = new pc.StandardMaterial(); m.diffuseMap = tex; m.opacityMap = tex; m.opacityMapChannel = 'a'; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.useLighting = false; m.emissive = pc.Color.WHITE; m.emissiveMap = tex; m.update();
    const e = new pc.Entity('Deck marking'); e.addComponent('render', { type: 'plane', material: m, castShadows: false }); e.setLocalScale(width, 1, width / 4); return e;
  }

  // ── Scenery for each district ────────────────────────────────────────────
  decorGroup(name, from, to) { const root = new pc.Entity(name); this.scene.contentRoot.addChild(root); this.decor.push({ root, from, to }); return root; }

  buildDecor() {
    const rand = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    // Launchpad: the generated city's dark megastructures and signs.
    const city = this.decorGroup('City', -60, 140);
    for (let i = 0; i < 32; i++) {
      const a = i * 2.399, rad = 34 + (i % 5) * 12, y = -5 + (i % 7) * 15;
      const tower = new pc.Entity('Megastructure'); city.addChild(tower); tower.setPosition(Math.sin(a) * rad, y, Math.cos(a) * rad);
      const height = 70 + (i % 7) * 19, w = 6 + i % 5;
      this.box('Tower', 0, -height / 2, 0, w, height, w, buildingMaterial(this.scene, pc, i % 2 ? '#3d4048' : '#4a4d55'), tower);
      this.box('Cornice', 0, .1, 0, w + 1, .5, w + 1, this.solid('#2b3036'), tower);
      this.box('Signal', w / 2 + .02, -height * .35, 0, .05, height * .32, .2, this.solid(i % 3 ? '#ff9d4a' : '#5cc8ff', { emissive: 1.2, lit: false }), tower);
    }
    for (const sign of addCitySigns(this.scene, pc)) { sign.reparent(city); }
    // A pump beam up the middle of the spiral: up is always that way.
    const beam = this.decorGroup('Pump beam', -10, 700);
    const column = this.mesh('Beam', 'cylinder', this.solid('#22e58f', { emissive: .09, additive: true, lit: false }), beam);
    column.setPosition(0, 340, 0); column.setLocalScale(.8, 650, .8); this.beam = column;
    // Price levels: a glowing ring at every district boundary.
    // Price levels: a thin gold ring at every district boundary, like a horizontal line on a chart.
    for (let i = 1; i < 8; i++) {
      const level = this.decorGroup(`Price level ${i}`, i * 75 - 26, i * 75 + 22);
      const ring = this.makeRing(level, 26, '#ffd666', 72); ring.setLocalEulerAngles(90, 0, 0); level.setPosition(0, i * 75 - 2, 0);
    }
    // Breakout: giant holographic charts on the skyline.
    const charts = this.decorGroup('Skyline charts', 40, 190);
    for (let i = 0; i < 7; i++) {
      const a = i * (Math.PI * 2 / 7) + .3, r = 92 + (i % 3) * 14, y = 92 + (i % 4) * 16;
      const tex = this.texture(`billboard-${i}`, () => art.chartBillboard(i + 3, ['$SKY / ALT', 'AGI-1 / ALT', '$SKY 1H', 'SKY / MOON'][i % 4]));
      const panel = this.mesh('Chart billboard', 'plane', this.solid('#ffffff', { map: tex, emissive: .95, lit: false, key: `bb${i}` }), charts);
      panel.setPosition(Math.sin(a) * r, y, Math.cos(a) * r); panel.setEulerAngles(90, a * 180 / Math.PI + 180, 0); panel.setLocalScale(40, 1, 20);
    }
    // Bull Run: a sea of cloud under the district and drifting banks around it.
    const clouds = this.decorGroup('Cloud sea', 110, 212);
    const sea = [];
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2, r = 30 + rand() * 170, s = 14 + rand() * 26;
      sea.push({ shape: 'sphere', x: Math.sin(a) * r, y: 146 + rand() * 6, z: Math.cos(a) * r, sx: s * 1.6, sy: s * .35, sz: s * 1.3 });
    }
    this.addParts('Cloud sea', sea, this.solid('#ffffff', { emissive: .45, emissiveHex: '#e6f3ff', gloss: 0, metalness: 0 }), clouds);
    const banks = [];
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, r = 46 + rand() * 80, y = 158 + rand() * 48, s = 4 + rand() * 6;
      for (let k = 0; k < 4; k++) banks.push({ shape: 'sphere', x: Math.sin(a) * r + (rand() - .5) * s * 2, y: y + (rand() - .5) * s * .5, z: Math.cos(a) * r + (rand() - .5) * s * 2, sx: s * 1.5, sy: s * .7, sz: s * 1.2 });
    }
    this.addParts('Cloud banks', banks, this.solid('#ffffff', { emissive: .3, emissiveHex: '#e6f3ff', gloss: 0, metalness: 0 }), clouds);
    // Volatility: thunderheads and lightning.
    const storm = this.decorGroup('Storm', 205, 320);
    const heads = [];
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2, r = 36 + rand() * 110, y = 214 + rand() * 90, s = 8 + rand() * 18;
      heads.push({ shape: 'sphere', x: Math.sin(a) * r, y, z: Math.cos(a) * r, sx: s * 1.4, sy: s * .8, sz: s * 1.2 });
    }
    this.addParts('Thunderheads', heads, this.solid('#2e2645', { emissive: .25, emissiveHex: '#3e3166', gloss: 0, metalness: 0 }), storm);
    this.bolts = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + .4, r = 48 + i * 11, top = 300 - i * 9;
      const parts = []; let x = Math.sin(a) * r, z = Math.cos(a) * r, y = top;
      for (let k = 0; k < 7; k++) { const nx = x + (rand() - .5) * 8, nz = z + (rand() - .5) * 8, ny = y - 7 - rand() * 4; const len = Math.hypot(nx - x, ny - y, nz - z);
        parts.push({ x: (x + nx) / 2, y: (y + ny) / 2, z: (z + nz) / 2, sx: .45, sy: len, sz: .45, rx: Math.atan2(nz - z, ny - y) * 57.3 + 180, rz: -Math.atan2(nx - x, ny - y) * 57.3 }); x = nx; y = ny; z = nz; }
      const bolt = this.addParts('Lightning', parts, this.solid('#e9e4ff', { emissive: 3, lit: false }), storm); bolt.enabled = false; this.bolts.push(bolt);
    }
    // Euphoria: giant coins turning over a pink sunset.
    const euphoria = this.decorGroup('Coins', 280, 410);
    this.bigCoins = [];
    for (let i = 0; i < 7; i++) {
      const a = i * .9 + 1.1, r = 62 + (i % 3) * 18, y = 310 + (i % 4) * 16;
      const coin = new pc.Entity('Giant coin'); euphoria.addChild(coin); coin.setPosition(Math.sin(a) * r, y, Math.cos(a) * r);
      const disc = this.mesh('Disc', 'cylinder', this.solid('#f5c542', { emissive: .65, map: this.texture('coin', () => art.coinFace()), metalness: .3, gloss: .7 }), coin);
      disc.setLocalScale(9, .8, 9); disc.setLocalEulerAngles(90, 0, 0); this.bigCoins.push(coin);
    }
    const pink = [];
    for (let i = 0; i < 40; i++) { const a = rand() * Math.PI * 2, r = 40 + rand() * 120, s = 8 + rand() * 16; pink.push({ shape: 'sphere', x: Math.sin(a) * r, y: 296 + rand() * 30, z: Math.cos(a) * r, sx: s * 1.6, sy: s * .4, sz: s * 1.2 }); }
    this.addParts('Sunset clouds', pink, this.solid('#ffc4d2', { emissive: .5, emissiveHex: '#ff9fbf', gloss: 0, metalness: 0 }), euphoria);
    // Price Discovery: crystal shards in thin air.
    const shards = this.decorGroup('Shards', 360, 480);
    const crystal = [];
    for (let i = 0; i < 45; i++) { const a = rand() * Math.PI * 2, r = 34 + rand() * 90, s = 2 + rand() * 6; crystal.push({ shape: 'gem', x: Math.sin(a) * r, y: 380 + rand() * 80, z: Math.cos(a) * r, sx: s * .6, sy: s * 1.6, sz: s * .6, rx: rand() * 40, rz: rand() * 40 }); }
    this.addParts('Crystal shards', crystal, this.solid('#ffffff', { map: this.texture('crystal', () => art.crystalFace()), emissive: .7 }), shards);
    // Orbit: a ring station around the spiral and drifting satellites.
    const orbit = this.decorGroup('Orbital ring', 420, 620);
    const station = new pc.Entity('Station'); orbit.addChild(station); station.setPosition(0, 488, 0);
    const torus = pc.Mesh.fromGeometry(this.scene.graphicsDevice, new pc.TorusGeometry({ tubeRadius: 2.2, ringRadius: 70, segments: 96, sides: 10 }));
    const ringEntity = new pc.Entity('Ring hull'); ringEntity.addComponent('render', { meshInstances: [new pc.MeshInstance(torus, this.solid('#d7dce6', { gloss: .7, metalness: .2 }))], castShadows: false });
    station.addChild(ringEntity); ringEntity.setLocalEulerAngles(0, 0, 0);
    const lights = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; lights.push({ x: Math.sin(a) * 70, y: 2.3, z: Math.cos(a) * 70, sx: .5, sy: .3, sz: .5 }); }
    this.addParts('Ring lights', lights, this.solid('#7fb2ff', { emissive: 2, lit: false }), station);
    this.station = station;
    const sats = [];
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + .5, r = 46 + i * 9, y = 455 + i * 12; const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
      sats.push({ x: cx, y, z: cz, sx: 2.2, sy: 1.6, sz: 1.6 }, { x: cx, y, z: cz, sx: 9, sy: .08, sz: 1.6 }); }
    this.addParts('Satellites', sats, this.solid('#ffffff', { map: this.texture('solar', () => art.solarTop()), emissive: .25 }), orbit);
    // The Moon itself, hanging ahead of the last run.
    const finish = this.world.platforms.find((p) => p.type === 'finish');
    const moon = this.decorGroup('The Moon', 380, 900);
    const dir = { x: finish?.dirX ?? 1, z: finish?.dirZ ?? 0 };
    const moonBody = this.mesh('Moon', 'sphere', this.solid('#ffffff', { map: this.texture('moon-big', () => art.moonRock(9, 1024)), emissive: .5, gloss: .05, metalness: 0, tiling: [3, 2] }), moon);
    moonBody.setPosition((finish?.x ?? 0) + dir.x * 175, 660, (finish?.z ?? 0) + dir.z * 175); moonBody.setLocalScale(150, 150, 150);
    this.moon = moonBody;
  }

  // ── Per-frame look ───────────────────────────────────────────────────────
  applyLook(y, force = false) {
    const look = lookAt(y, 75, this.look);
    const sky = this.sky.values;
    for (const name of ['zenith', 'horizon', 'ground', 'band', 'sunColor', 'cloudColor', 'auroraColor']) { sky[name][0] = look[name][0]; sky[name][1] = look[name][1]; sky[name][2] = look[name][2]; }
    for (const name of ['sunSize', 'cloud', 'cloudLow', 'stars', 'aurora', 'planet']) sky[name] = look[name];
    sky.sunDir[0] = look.sunDir[0]; sky.sunDir[1] = look.sunDir[1]; sky.sunDir[2] = look.sunDir[2];
    const scene = this.app.scene;
    scene.fog.color.set(look.fog[0], look.fog[1], look.fog[2]);
    scene.fog.start = look.fogStart; scene.fog.end = look.fogEnd;
    scene.ambientLight.set(look.ambient[0], look.ambient[1], look.ambient[2]);
    const light = this.sun.light; light.color.set(look.light[0], look.light[1], look.light[2]); light.intensity = look.lightIntensity;
    // Light the decks from high above even when the visible sun is low: tops stay readable.
    const elev = Math.max(48, look.sunElev) * Math.PI / 180, az = look.sunAz * Math.PI / 180;
    this.lightDir ??= new pc.Vec3(); this.lightQuat ??= new pc.Quat();
    this.lightDir.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), -Math.cos(elev) * Math.cos(az));
    this.lightQuat.setFromDirections(pc.Vec3.UP, this.lightDir); this.sun.setRotation(this.lightQuat);
    if (force || !this.envTintApplied || Math.abs(this.envTintApplied - look.envTint) > .03) this.applyEnvironmentTint();
  }

  applyEnvironmentTint() {
    if (!this.environment) return;
    const look = this.look;
    this.environment.setTint(look.envTint, { r: look.envColor[0], g: look.envColor[1], b: look.envColor[2] });
    this.environmentLow?.setTint(look.envTint, { r: look.envColor[0], g: look.envColor[1], b: look.envColor[2] });
    this.envTintApplied = look.envTint || .001;
  }

  burst(x, y, z, hex = '#ffffff', size = 1.2, duration = .45) {
    const slot = this.bursts.reduce((best, b) => (b.life <= 0 ? b : best.life <= 0 ? best : b.life < best.life ? b : best), this.bursts[0]);
    slot.material.emissive = color(hex); slot.material.emissiveIntensity = 1.4; slot.material.update();
    slot.entity.setPosition(x, y, z); slot.entity.enabled = true; slot.life = duration; slot.duration = duration; slot.size = size;
  }

  shake(amount) { this.shakeAmount = Math.max(this.shakeAmount, amount); }
  collectCoin(id) { const item = this.coinEntities.get(id); if (item) { this.collected.add(id); item.pop = .35; } }
  resetCoins(ids = []) { this.collected = new Set(ids); for (const item of this.coinEntities.values()) { item.pop = 0; item.root.setLocalScale(1, 1, 1); } }

  installMotion() {
    // JST-2's 441-bone rig faces model +X, with left/right across Z. Its
    // mirrored local bone axes are not suitable as fixed Euler hinge axes.
    // Convert model-space rotations through each bone's rest orientation;
    // the provider's skeleton, bind pose and skin weights remain unchanged.
    const arm = this.character.armature, { bindR: bind, bindT, parents } = arm.skeleton;
    const ids = Object.fromEntries(arm.rigBoneNames.map((name, i) => [name.toLowerCase(), i]));
    const modelRest = [], inverseRest = [], localRest = [], smoothed = [];
    const restFor = i => {
      if (modelRest[i]) return modelRest[i];
      const q = new pc.Quat(bind[i * 4], bind[i * 4 + 1], bind[i * 4 + 2], bind[i * 4 + 3]);
      localRest[i] = q; smoothed[i] = q.clone();
      modelRest[i] = parents[i] >= 0 ? new pc.Quat().mul2(restFor(parents[i]), q) : q.clone();
      inverseRest[i] = modelRest[i].clone().invert(); return modelRest[i];
    };
    for (let i = 0; i < arm.rigBoneNames.length; i++) restFor(i);
    const modelDelta = new pc.Quat(), localDelta = new pc.Quat(), scratch = new pc.Quat();
    let phase = 0;
    const bend = (pose, name, x = 0, y = 0, z = 0) => {
      const i = ids[name]; if (i === undefined) return;
      modelDelta.setFromEulerAngles(x, y, z);
      scratch.mul2(inverseRest[i], modelDelta);
      localDelta.mul2(scratch, modelRest[i]);
      pose.rotations[i].mul2(localRest[i], localDelta).normalize();
    };
    arm.poseModifier = (pose, _arm, dt) => {
      if (this.clips.has(this.motion)) {
        for (let i = 0; i < smoothed.length; i++) smoothed[i].copy(pose.rotations[i]);
        return;
      }
      const p = this.lastPoseState, run = clamp(p.speed / 8, 0, 1);
      phase += Math.min(dt, .05) * (6 + p.speed * .8) * run;
      const swing = Math.sin(phase) * run;
      pose.setToBind(bindT, bind);
      bend(pose, 'upperarm_l', -27, 0, 8); bend(pose, 'upperarm_r', 27, 0, 8);
      bend(pose, 'lowerarm_l', 0, 0, 10); bend(pose, 'lowerarm_r', 0, 0, 10);
      if (p.grounded) {
        bend(pose, 'spine_02', 0, 0, -6 * run);
        bend(pose, 'thigh_l', 0, 0, swing * 34); bend(pose, 'thigh_r', 0, 0, -swing * 34);
        const leftKnee = Math.max(0, Math.sin(phase - .5)) * run * 62;
        const rightKnee = Math.max(0, -Math.sin(phase - .5)) * run * 62;
        bend(pose, 'calf_l', 0, 0, -leftKnee); bend(pose, 'calf_r', 0, 0, -rightKnee);
        bend(pose, 'foot_l', 0, 0, leftKnee * .3); bend(pose, 'foot_r', 0, 0, rightKnee * .3);
        bend(pose, 'upperarm_l', -24, 0, 8 - swing * 28); bend(pose, 'upperarm_r', 24, 0, 8 + swing * 28);
        bend(pose, 'lowerarm_l', 0, 0, 10 + run * 20); bend(pose, 'lowerarm_r', 0, 0, 10 + run * 20);
      } else {
        const rising = p.vy > 0;
        bend(pose, 'spine_02', 0, 0, -8);
        bend(pose, 'thigh_l', 0, 0, rising ? 48 : 20); bend(pose, 'thigh_r', 0, 0, rising ? 30 : 12);
        bend(pose, 'calf_l', 0, 0, rising ? -76 : -35); bend(pose, 'calf_r', 0, 0, rising ? -60 : -24);
        bend(pose, 'foot_l', 0, 0, 18); bend(pose, 'foot_r', 0, 0, 12);
        bend(pose, 'upperarm_l', rising ? 5 : 35, 0, rising ? -28 : 18);
        bend(pose, 'upperarm_r', rising ? -5 : -35, 0, rising ? -28 : 18);
        bend(pose, 'lowerarm_l', 0, 0, 30); bend(pose, 'lowerarm_r', 0, 0, 30);
      }
      if (p.state === 'roll') {
        bend(pose, 'spine_02', 0, 0, -28); bend(pose, 'spine_04', 0, 0, -14);
        for (const side of ['l', 'r']) {
          bend(pose, `thigh_${side}`, 0, 0, 82); bend(pose, `calf_${side}`, 0, 0, -105);
          bend(pose, `upperarm_${side}`, side === 'l' ? -12 : 12, 0, 55);
          bend(pose, `lowerarm_${side}`, 0, 0, 55);
        }
      }
      if (p.state === 'mantle' || p.grapple) {
        const hanging = !!p.grapple;
        bend(pose, 'spine_02', 0, 0, hanging ? 5 : -12);
        bend(pose, 'upperarm_l', hanging ? 145 : 122, 0, -18);
        bend(pose, 'upperarm_r', hanging ? -145 : -122, 0, -18);
        bend(pose, 'lowerarm_l', 0, 0, hanging ? 12 : 38); bend(pose, 'lowerarm_r', 0, 0, hanging ? 12 : 38);
        bend(pose, 'thigh_l', 0, 0, hanging ? 22 : 65); bend(pose, 'thigh_r', 0, 0, hanging ? 10 : 38);
        bend(pose, 'calf_l', 0, 0, hanging ? -38 : -90); bend(pose, 'calf_r', 0, 0, hanging ? -26 : -65);
      }
      const blend = 1 - Math.exp(-Math.max(0, dt) * 20);
      for (let i = 0; i < smoothed.length; i++) {
        smoothed[i].slerp(smoothed[i], pose.rotations[i], blend);
        pose.rotations[i].copy(smoothed[i]);
      }
    };
  }

  update(dt, physics, input, { playing = false, paused = false, menu = false, frameDt = dt } = {}) {
    this.time += paused ? 0 : dt; const p = physics.player; this.lastPoseState = p;
    const viewY = menu ? 0 : p.y;
    this.applyLook(viewY);
    // Platforms: only the slice of the climb around the player is drawn.
    for (const item of this.platformList) {
      const def = item.def, y = def.y;
      item.root.enabled = (menu ? y < 40 : y > viewY - VIEW_BELOW && y < viewY + VIEW_ABOVE) || def.type === 'finish';
    }
    if (!this.physicsById) this.physicsById = new Map(physics.platforms.map((q) => [q.id, q]));
    for (const item of this.dynamicVisuals) {
      if (!item.root.enabled) continue;
      const s = item.physics ??= this.physicsById.get(item.def.id);
      if (!s) continue;
      const def = item.def;
      if (!s.active) { item.root.enabled = false; continue; }
      let shake = 0;
      if (def.type === 'crumble' && s.crumbleProgress > .55) shake = Math.sin(this.time * 80) * .05 * s.crumbleProgress;
      if (def.type === 'dump' && s.triggeredAt !== null && s.sunk === 0) shake = Math.sin(this.time * 70) * .06;
      if (def.type === 'rug' && s.triggeredAt !== null && s.pulled === 0) shake = Math.sin(this.time * 60) * .04;
      item.root.setPosition(s.x + shake, s.y, s.z);
      if (def.type === 'pump') {
        const lifted = s.lifted || 0, lift = def.lift || 0;
        item.parts.body.setLocalScale(1, def.h + lifted, 1);
        item.parts.wickDown.setLocalPosition(0, -(def.h + lifted), 0);
        const remaining = Math.max(.001, lift - lifted);
        item.parts.wickUp.setLocalScale(1, remaining, 1);
        item.parts.target.setLocalPosition(0, remaining, 0);
        item.parts.target.enabled = remaining > .05;
        item.parts.arrow.setLocalPosition(0, .6 + Math.abs(Math.sin(this.time * 3)) * .35, 0);
        item.parts.arrow.enabled = !s.pumping;
        if (item.parts.halo) item.parts.halo.setLocalEulerAngles(0, this.time * 40, 0);
      }
    }
    for (const item of this.platformList) if (item.root.rift && item.root.enabled) item.root.rift.setLocalEulerAngles(0, this.time * 24, 0);
    for (const h of physics.hazards) { const e = this.hazardEntities.get(h.id); e.setEulerAngles(0, h.angle * 180 / Math.PI, 0); e.enabled = Math.abs(h.y - viewY) < 40; }
    for (const a of this.anchorEntities) { a.root.enabled = menu ? a.def.y < 40 : Math.abs(a.def.y - viewY) < 40; if (!a.root.enabled) continue; a.gem.setLocalEulerAngles(0, this.time * 60, 0); a.ring.setLocalEulerAngles(0, this.time * 20, 0); }
    for (const item of this.coinEntities.values()) {
      const def = item.def, taken = this.collected.has(def.id);
      if (item.pop > 0) { item.pop -= dt; const t = 1 - item.pop / .35; item.root.setLocalScale(1 + t * 1.6, 1 + t * 1.6, 1 + t * 1.6); item.root.setPosition(def.x, def.y + t * 1.2, def.z); item.root.enabled = item.pop > 0; continue; }
      item.root.enabled = !taken && (menu ? def.y < 40 : Math.abs(def.y - viewY) < 34);
      if (item.root.enabled) { item.root.setPosition(def.x, def.y + Math.sin(this.time * 2 + def.x) * .12, def.z); item.disc.setLocalEulerAngles(90, 0, this.time * 120); }
    }
    for (const decor of this.decor) decor.root.enabled = menu ? decor.from < 40 : viewY > decor.from - 20 && viewY < decor.to + 20;
    for (const coin of this.bigCoins || []) coin.setLocalEulerAngles(0, this.time * 25, 0);
    if (this.station) this.station.setLocalEulerAngles(0, this.time * 2, 0);
    // Lightning in the Volatility storm.
    const sky = this.sky.values;
    sky.flash = Math.max(0, sky.flash - dt * 3.2);
    if (this.boltTimer > 0) { this.boltTimer -= dt; if (this.boltTimer <= 0) for (const b of this.bolts) b.enabled = false; }
    if (this.look.storm > .5 && !paused) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 2.5 + Math.random() * 4.5; sky.flash = .55 + Math.random() * .35;
        const bolt = this.bolts[Math.floor(Math.random() * this.bolts.length)]; if (bolt) { bolt.enabled = true; this.boltTimer = .14; }
        this.onThunder?.(sky.flash);
      }
    }
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt; const t = 1 - Math.max(0, b.life) / b.duration;
      const s = b.size * (.3 + t * 1.7); b.entity.setLocalScale(s, s, s);
      b.material.emissiveIntensity = 1.4 * (1 - t); b.material.update();
      if (b.life <= 0) b.entity.enabled = false;
    }
    if (this.character) { this.character.setPosition(p.x, p.y, p.z); let desired = Math.atan2(p.facingX, p.facingZ) * 180 / Math.PI - 90; if (p.speed > .3 || p.grapple) { let delta = ((desired - this.facing + 540) % 360) - 180; this.facing += delta * (1 - Math.exp(-dt * 14)); } this.character.setRotation(0, this.facing, p.state === 'roll' ? -35 : 0); const motion = menu ? 'idle' : p.grapple ? 'hang' : p.state === 'mantle' ? 'mantle' : p.state === 'roll' ? 'roll' : !p.grounded ? (p.vy > 0 ? 'jump' : 'fall') : p.speed > .7 ? 'run' : 'idle'; if (motion !== this.motion) { this.motion = motion; if (this.clips.has(motion)) this.character.crossfadeTo(motion, { duration: .14, loop: ['idle', 'run', 'hang', 'fall'].includes(motion), rootMotion: false }); else this.character.armature.stop(.12); } this.character.armature.paused = paused; if (this.clips.has('run') && this.motion === 'run') this.character.armature.playbackSpeed = Math.max(.6, p.speed / 5.5); else this.character.armature.playbackSpeed = 1; }
    this.shadow.setPosition(p.x, p.y + .015, p.z); this.shadow.enabled = p.grounded;
    this.rope.enabled = !!p.grapple; if (p.grapple) { const a = p.grapple.anchor, b = new pc.Vec3(p.x, p.y + 1.4, p.z), v = new pc.Vec3(a.x - b.x, a.y - b.y, a.z - b.z); this.rope.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); const rotation = new pc.Quat(); rotation.setFromDirections(pc.Vec3.UP, v.clone().normalize()); this.rope.setRotation(rotation); this.rope.setLocalScale(.03, v.length(), .03); }
    let target = new pc.Vec3(p.x, p.y + 1.15, p.z), desired;
    // Title camera: AGI-1 on the helipad, the first candle run climbing away behind her.
    if (menu) { const a = Math.sin(this.time * .08) * .6, v = this.menuView; target.copy(v.target); desired = new pc.Vec3(v.eye.x + a, v.eye.y, v.eye.z); }
    else { const cp = Math.cos(input.pitch); desired = new pc.Vec3(p.x + Math.sin(input.yaw) * input.distance * cp, p.y + 1.15 + Math.sin(input.pitch) * input.distance, p.z + Math.cos(input.yaw) * input.distance * cp); const delta = desired.clone().sub(target), length = delta.length(); delta.normalize(); const hit = physics.world.castRay(new RAPIER.Ray(target, delta), length, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, physics.playerCollider); if (hit) desired.copy(target).add(delta.mulScalar(Math.max(.12, hit.timeOfImpact - .2))); }
    this.cameraPos.lerp(this.cameraPos, desired, menu ? .025 : 1 - Math.exp(-dt * 12));
    if (!menu) { const ray = this.cameraPos.clone().sub(target), length = ray.length(); if (length > .001) { ray.normalize(); const hit = physics.world.castRay(new RAPIER.Ray(target, ray), length, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, physics.playerCollider); if (hit) this.cameraPos.copy(target).add(ray.mulScalar(Math.max(.12, hit.timeOfImpact - .2))); } }
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
    const jitter = this.shakeAmount * this.shakeAmount;
    this.scene.cameraEntity.setPosition(this.cameraPos.x + (Math.random() - .5) * jitter, this.cameraPos.y + (Math.random() - .5) * jitter, this.cameraPos.z + (Math.random() - .5) * jitter);
    this.scene.cameraEntity.lookAt(target);
    this.scene.cameraEntity.camera.fov = mix(this.scene.cameraEntity.camera.fov, 63 + clamp(p.speed - 8, 0, 12) * .7 + (p.vy < -20 ? 6 : 0), 1 - Math.exp(-dt * 3));
    if (this.environment) this.environment.entity.enabled = viewY < 165 && !(this.quality === 'low' && this.environmentLow);
    if (this.environmentLow) this.environmentLow.entity.enabled = viewY < 165 && this.quality === 'low';
    this.frameTimes.push(frameDt * 1000); if (this.frameTimes.length > 240) this.frameTimes.shift();
  }

  setQuality(quality) {
    this.quality = quality; this.scene.graphicsDevice.maxPixelRatio = quality === 'high' ? 1 : quality === 'medium' ? .8 : .65; this.scene.app.resizeCanvas();
    if (quality === 'low' && !this.environmentLow && !this.lowLoading) {
      this.lowLoading = Environment.load(this.scene, asset('environment/launch-plaza-low.spz'), { name: 'Launch district · light', scale: 16 }).then(environment => {
        environment.entity.setEulerAngles(this.environment.entity.getEulerAngles()); environment.entity.setPosition(this.environment.entity.getPosition());
        environment.setClipDistanceOrigin(new pc.Vec3(0, 0, 0)); environment.setClipDistance(30, 230); environment.setClipMaxY(180);
        this.environmentLow = environment; this.applyEnvironmentTint();
      }).catch(error => { this.lowLoading = null; console.warn('Light scene unavailable; keeping the current city.', error.message); });
    }
  }

  metrics() { const values = [...this.frameTimes].sort((a, b) => a - b); return { fps: Math.round(1000 / (values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1))), p95: values[Math.floor(values.length * .95)] || 0, drawCalls: this.app.stats.drawCalls.total, characterSplats: this.character?.splat.numSplats, environmentLoaded: !!this.environment, motions: [...this.clips], gpu: this.scene.graphicsDevice.unmaskedRenderer, envDepth: this.envDepth }; }
}
