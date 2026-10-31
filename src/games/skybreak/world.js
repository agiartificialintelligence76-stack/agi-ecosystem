// The gameplay scaffold is authored independently of the JST-2 splat scenery.
// Coordinates are metres, Y is up, and platform Y is the walkable TOP surface.
export const WORLD_REVISION = 'skybreak-2-chart';
export const SUMMIT_HEIGHT = 600;
export const ZONE_HEIGHT = 75;
export const JUMP_ENVELOPE = Object.freeze({ speed: 10.2, gravity: 24, run: 8, margin: 0.45, padSpeed: 15 });
/** A trend rail tops out at this speed along its direction. */
export const RAIL_SPEED = 12;

/*
 * Eight market phases, 75 m each. The climb is a squared spiral of "chart runs":
 * each side of the square is a row of platforms, so a row of candles reads as a
 * candlestick chart from across the spiral.
 *
 * Recipe tokens: S zone slab · C candle (static, green or red) · P pump (green
 * candle that lifts you) · D dump (red candle that sinks) · U rug pull ·
 * R trend rail (speed) · M moving order-book block · X crumbling pair member ·
 * J updraft pad on the main route.
 */
const ZONE_DEFS = [
  { key: 'launchpad', name: 'Launchpad', title: 'The city falls away', radius: 13, skin: 'rooftop', gravity: 1,
    gap: [0.55, 1.1], rise: [1.15, 1.5], jitter: 0.45, greens: 0.8,
    recipe: 'S S S C C C S X X S M S C C C S S M S C C C S' },
  { key: 'breakout', name: 'Breakout', title: 'Green candles pump', radius: 14, skin: 'terminal', gravity: 1,
    gap: [0.6, 1.25], rise: [1.1, 1.5], jitter: 0, greens: 0.72,
    recipe: 'C C C P S S R C C C M M P C C C X X R S S P C C' },
  { key: 'bullrun', name: 'Bull Run', title: 'Ride the momentum', radius: 15, skin: 'cloud', gravity: 1,
    gap: [0.7, 1.35], rise: [1.1, 1.5], jitter: 0.55, greens: 0.75,
    recipe: 'S S P S J S C C C M M S X X P C C C R S J M M' },
  { key: 'volatility', name: 'Volatility', title: 'Red candles dump. Keep moving.', radius: 14, skin: 'storm', gravity: 1,
    gap: [0.7, 1.4], rise: [1.0, 1.5], jitter: 0.25, greens: 0.45, sweepers: true,
    recipe: 'S D S D D C C C M M X X P D S C C C D M S' },
  { key: 'euphoria', name: 'Euphoria', title: 'Never trust a free rug', radius: 15, skin: 'gold', gravity: 1,
    gap: [0.75, 1.45], rise: [1.0, 1.5], jitter: 0.3, greens: 0.7,
    recipe: 'S U S P U C C C R J S U M M P P C C C U S D' },
  { key: 'discovery', name: 'Price Discovery', title: 'No ceiling above you', radius: 16, skin: 'crystal', gravity: 1,
    gap: [0.8, 1.5], rise: [1.0, 1.5], jitter: 0.4, greens: 0.62,
    recipe: 'S S C C C M M D P S R X X U C C C M D S' },
  { key: 'orbit', name: 'Orbit', title: 'Escape velocity', radius: 16, skin: 'satellite', gravity: 1,
    gap: [0.8, 1.55], rise: [1.0, 1.5], jitter: 0.2, greens: 0.55, sweepers: true,
    recipe: 'S M M D S U C C C P S X X M D C C C U S' },
  { key: 'moon', name: 'To the Moon', title: 'Moon gravity. Jump like you mean it.', radius: 15, skin: 'moon', gravity: 0.6,
    gap: [1.5, 2.9], rise: [1.4, 2.4], jitter: 0.35, greens: 0.75,
    recipe: 'S S C C C P M S D C C C U S M C C' },
];

export const ZONES = Object.freeze(ZONE_DEFS.map((zone, id) => Object.freeze({
  ...zone, id, from: id * ZONE_HEIGHT, to: (id + 1) * ZONE_HEIGHT,
  recipe: Object.freeze(zone.recipe.split(' ')),
})));

const NORMAL_GAP = [0.8, 1.5];
const NORMAL_RISE = [1.0, 1.5];
const DIRS = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
const round = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const halfAlong = (p, dir) => Math.abs(dir.x) * p.w / 2 + Math.abs(dir.z) * p.d / 2;
const axisOf = (dir) => (dir.x !== 0 ? 'x' : 'z');
const lateralAxisOf = (dir) => (dir.x !== 0 ? 'z' : 'x');
const motionExcursion = (p, axis) => (p.motion?.axis === axis ? Math.abs(p.motion.amplitude) : 0);
const outwardOf = (dir) => ({ x: dir.z, z: -dir.x });
const inwardOf = (dir) => ({ x: -dir.z, z: dir.x });

function randomFrom(seed) {
  let state = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gravity multiplier at a height: 1 everywhere except the final, low-gravity Moon band. */
export function gravityScaleAt(y, zones = ZONES) {
  let scale = 1;
  for (const zone of zones) {
    if ((zone.gravity ?? 1) === 1) continue;
    const t = clamp((y - zone.from) / 4, 0, 1);
    scale = Math.min(scale, 1 + ((zone.gravity ?? 1) - 1) * t);
  }
  return scale;
}

/** Where a jump can be launched from: a pump candle launches from its raised top. */
export function takeoffHeight(p) {
  return p.y + (p.type === 'pump' ? p.lift || 0 : 0);
}

/** The jump limits for a link; low gravity only counts when both ends are fully inside it. */
export function linkEnvelope(a, b, zones = ZONES) {
  const scale = Math.max(gravityScaleAt(a.y, zones), gravityScaleAt(b.y, zones));
  const gravity = JUMP_ENVELOPE.gravity * scale;
  const speed = a.type === 'pad' ? JUMP_ENVELOPE.padSpeed : JUMP_ENVELOPE.speed;
  const apex = speed ** 2 / (2 * gravity);
  const run = a.type === 'rail' ? RAIL_SPEED : JUMP_ENVELOPE.run;
  const maxGap = a.type === 'pad' ? 3.0 : a.type === 'rail' ? 4.2 : 3.5 / Math.sqrt(scale);
  return { gravity, speed, run, maxRise: apex * 0.785, maxGap };
}

/** A repeatable 600 m chart climb with eight districts and a reachable summit on the Moon. */
export function createWorld(seed = 1) {
  const random = randomFrom(seed);
  const rnd = (low, high) => low + (high - low) * random();
  const platforms = [];
  const anchors = [];
  const hazards = [];
  const route = [];
  const branches = [];
  const coins = [];
  const sections = ZONES.map((zone) => ({ id: zone.id, key: zone.key, name: zone.name, title: zone.title,
    from: zone.from, to: zone.to, gravity: zone.gravity, skin: zone.skin }));
  const spawn = { x: 0, y: 0.06, z: 1.5 };
  const zoneAt = (y) => ZONES[clamp(Math.floor(y / ZONE_HEIGHT), 0, ZONES.length - 1)];
  const add = (definition) => {
    const p = { h: 0.65, type: 'normal', section: 0, skin: 'rooftop', ...definition };
    for (const key of ['x', 'y', 'z', 'w', 'd', 'h']) p[key] = round(p[key]);
    p.section = zoneAt(p.y + 0.01).id;
    platforms.push(p);
    return p;
  };

  const launch = add({ id: 'launch', x: 0, y: 0, z: 0, w: 12, d: 12, h: 1.2, skin: 'launch', label: 'SKYBREAK',
    hint: 'WASD to move · Space to jump · Mouse to look' });
  route.push('launch');

  let side = 0;
  let line = -8.7;
  let prev = launch;
  let turnNext = false;
  let index = 0;
  let lastZone = 0;
  const cursor = ZONES.map(() => 0);
  const firsts = new Set();
  const firstHint = (p, key, text) => { if (!firsts.has(key)) { firsts.add(key); p.hint ??= text; } };

  const buildSpec = (token, zone, env, dir, previous) => {
    const along = axisOf(dir);
    const lateral = lateralAxisOf(dir);
    const square = (low, high) => { const s = rnd(low, high); return { w: s, d: s }; };
    const tone = () => (random() < zone.greens ? 'green' : 'red');
    switch (token) {
      case 'C': {
        const t = tone();
        return { type: 'normal', skin: 'candle', tone: t, ...square(3.7, 4.2), h: rnd(4.5, 9),
          wickUp: rnd(0.5, 1.6), wickDown: rnd(1.6, 4.2), rise: t === 'red' ? rnd(-0.7, 0.6) : rnd(...env.rise) };
      }
      case 'P':
        return { type: 'pump', skin: 'candle', tone: 'green', ...square(3.9, 4.3), h: rnd(4, 7),
          lift: round(rnd(3.0, 4.1)), riseTime: 1.35, wickDown: rnd(1.6, 3.6) };
      case 'D':
        return { type: 'dump', skin: 'candle', tone: 'red', ...square(3.9, 4.3), h: rnd(3.5, 6),
          drop: 5, delay: 0.38, wickUp: rnd(0.4, 1.0) };
      case 'U':
        return { type: 'rug', skin: 'rug', w: 3.8, d: 3.8, h: 0.3, delay: 0.5 };
      case 'R': {
        const size = { [along === 'x' ? 'w' : 'd']: 7, [lateral === 'x' ? 'w' : 'd']: 2.6 };
        return { type: 'rail', skin: 'rail', w: size.w, d: size.d, h: 0.5, dx: dir.x, dz: dir.z };
      }
      case 'M': {
        // Two neighbours sliding along the run could drift apart in opposite phases.
        // Right after a corner, a sideways slide would swing back across the previous run.
        const axis = previous?.corner ? along : previous?.motion?.axis === along || random() < 0.5 ? lateral : along;
        const amplitude = round(axis === along ? rnd(0.65, 0.9) : rnd(1.0, 1.5));
        return { type: 'moving', skin: zone.skin === 'cloud' ? 'cloud' : 'orderbook', ...square(4.2, 4.6), h: 0.9,
          motion: { axis, amplitude, speed: round(rnd(0.6, 0.95)), phase: round(rnd(0, Math.PI * 2)) } };
      }
      case 'X':
        return { type: 'crumble', skin: zone.skin, ...square(3.6, 3.85) };
      case 'J':
        return { type: 'pad', skin: 'pad', w: 3.4, d: 3.4, h: 0.7 };
      case 'K':
        return { type: 'normal', skin: zone.skin, corner: true, w: 5, d: 5, h: 0.9 };
      case 'L':
        return { type: 'normal', skin: zone.skin, landing: true, w: 5.2, d: 5.2, h: 0.9 };
      case 'G':
        return { type: 'normal', skin: zone.skin, gate: true, w: 5.6, d: 5.6, h: 1 };
      default:
        return { type: 'normal', skin: zone.skin, ...square(3.9, 4.5) };
    }
  };

  const riseAfter = (from, spec, env) => {
    if (from.type === 'pump') return rnd(0.5, 1.15);
    if (from.type === 'pad') return rnd(2.6, 3.25);
    if (from.type === 'dump') return rnd(-0.5, 0.7);
    if (from.type === 'rug') return rnd(0.1, 1.0);
    if (from.type === 'rail') return rnd(0.3, 0.9);
    return spec.rise ?? rnd(...env.rise);
  };

  for (;;) {
    const top = takeoffHeight(prev);
    const remaining = SUMMIT_HEIGHT - top;
    const zone = zoneAt(top + 0.01);
    const settled = zone.gravity === 1 || top >= zone.from + 5;
    const env = settled ? zone : { ...zone, gap: NORMAL_GAP, rise: NORMAL_RISE };
    const endgame = remaining <= 24;
    if (turnNext) {
      const oldDir = DIRS[side];
      line = axisOf(oldDir) === 'x' ? prev.x : prev.z;
      side = (side + 1) % 4;
      turnNext = false;
    }
    const dir = DIRS[side];
    const along = axisOf(dir);
    const lateral = lateralAxisOf(dir);

    let spec;
    let token = null;
    let finishing = false;
    if (prev.god || remaining <= 2.6) {
      spec = { type: 'finish', skin: 'moonbase', w: 9, d: 9, h: 1.4, rise: remaining };
      finishing = true;
    } else if (endgame && remaining >= 5.6 && remaining <= 12 && prev.type !== 'pump') {
      spec = { type: 'pump', skin: 'candle', tone: 'green', god: true, w: 4.8, d: 4.8, h: 10,
        lift: round(remaining - 1.4 - 1.8), riseTime: 3.2, wickDown: 3, rise: 1.4 };
    } else if (zone.id !== lastZone) {
      spec = buildSpec('G', zone, env, dir, prev);
    } else {
      token = zone.recipe[cursor[zone.id] % zone.recipe.length];
      if (remaining <= 30 && 'PJDUXM'.includes(token)) token = 'C';
      if (prev.type === 'pad' && token !== 'C') token = 'S';
      // A trend rail flings you long: the next step is a wide landing past normal reach.
      if (prev.type === 'rail') token = 'L';
      spec = buildSpec(token, zone, env, dir, prev);
    }

    // Corners are wide, static landings. They interrupt the recipe without consuming it.
    const alongPrev = prev[along];
    const sign = dir[along];
    const prevExtent = halfAlong(prev, dir);
    const extent = (s) => halfAlong(s, dir);
    // A sliding block's nominal gap is its excursion plus a little, so it never
    // touches its neighbour and its widest gap stays inside the jump envelope.
    const slideGap = (s) => motionExcursion(prev, along) + motionExcursion(s, along);
    const gapFor = (s) => (slideGap(s) > 0 ? slideGap(s) + rnd(0.3, 0.5) : prev.type === 'rail' ? rnd(2.2, 2.7) : rnd(...env.gap));
    let gap = gapFor(spec);
    if (!finishing && !spec.god && !spec.gate && sign * alongPrev + prevExtent + gap + 2 * extent(spec) >= zone.radius + 1.2) {
      spec = buildSpec('K', zone, env, dir, prev);
      gap = gapFor(spec);
      token = null;
      turnNext = true;
    } else if (token) {
      cursor[zone.id]++;
    }
    if (spec.gate) lastZone = zone.id;

    let rise = finishing ? remaining : spec.god ? 1.4 : riseAfter(prev, spec, env);
    if (!finishing && endgame) rise = Math.min(rise, Math.max(0.4, remaining - 2.2));
    const center = sign * alongPrev + prevExtent + gap + extent(spec);
    const jitter = spec.skin === 'candle' || spec.type === 'rail' || spec.corner || finishing ? 0 : rnd(-1, 1) * zone.jitter;
    index++;
    const id = `step-${index}`;
    const definition = {
      ...spec, id, routeIndex: index,
      [along]: sign * center, [lateral]: line + jitter,
      y: top + rise,
      dirX: dir.x, dirZ: dir.z,
    };
    if (prev === launch) {
      // The first step sits straight ahead of the spawn; the first run then heads right.
      definition.x = 0;
      definition.z = -(launch.d / 2 + gap + spec.d / 2);
      line = definition.z;
    }
    delete definition.rise;
    if (definition.type === 'rug') {
      const out = outwardOf(dir);
      definition.pullX = out.x; definition.pullZ = out.z;
    }
    if (definition.type === 'finish') { definition.label = 'THE MOON'; definition.y = SUMMIT_HEIGHT; }
    if (definition.gate) definition.label = zone.name.toUpperCase();
    if (definition.god) definition.label = 'GOD CANDLE';
    const platform = add(definition);
    route.push(platform.id);
    prev = platform;
    if (finishing) break;
    if (index > 2000) throw new Error('Route generation did not reach the summit');
  }

  // Tutorial hints on the first appearance of each mechanic.
  const routePlatforms = route.map((id) => platforms.find((p) => p.id === id));
  for (const p of routePlatforms) {
    if (p.routeIndex === 1) p.hint = 'A little grace goes a long way. Hold Space for height.';
    if (p.routeIndex === 5) p.hint = 'Turn in the air. You can correct a jump.';
    if (p.skin === 'candle' && p.type === 'normal') firstHint(p, 'candle', 'Candles are solid. Green ones climb, red ones dip.');
    if (p.type === 'crumble') firstHint(p, 'crumble', 'Cracked steps crumble. Keep moving.');
    if (p.type === 'moving') firstHint(p, 'moving', 'Order-book blocks slide. Jump with their momentum.');
    if (p.type === 'pump') firstHint(p, 'pump', 'Green candle! Stand on it to PUMP. The wick shows how high it goes.');
    if (p.type === 'rail') firstHint(p, 'rail', 'Trend rails build speed. Jump at the edge.');
    if (p.type === 'pad') firstHint(p, 'pad', 'Updraft pad. It throws you up. Steer in the air.');
    if (p.type === 'dump') firstHint(p, 'dump', 'Red candle! It DUMPS a moment after you land. Do not hold the bag.');
    if (p.type === 'rug') firstHint(p, 'rug', 'Rug pull! It gets yanked half a second after you land.');
    if (p.gate && p.section === 3) p.hint ??= 'Liquidation lasers sweep the outer edges. Stay on the inside.';
    if (p.gate && p.section === 7) p.hint = 'Moon gravity. Bigger gaps, floatier jumps. Hold Space.';
    if (p.god) p.hint = 'The God Candle. Ride it all the way up.';
  }

  // Checkpoint rifts continue straight off a corner, across a crumbling bridge.
  let riftNumber = 0;
  const corners = routePlatforms.filter((p) => p.corner);
  for (const zone of ZONES) {
    for (const minimum of [zone.from + 8, zone.from + 42]) {
      const corner = corners.find((p) => p.y >= minimum && p.y < zone.to - 4 && !p.branched);
      if (!corner) continue;
      const routeIdx = route.indexOf(corner.id);
      const before = routePlatforms[routeIdx - 1];
      const dir = { x: Math.sign(round(corner.x - before.x)), z: Math.sign(round(corner.z - before.z)) };
      if (Math.abs(corner.x - before.x) > Math.abs(corner.z - before.z)) dir.z = 0; else dir.x = 0;
      const bridgeOffset = halfAlong(corner, dir) + 1.1 + 1.0;
      const bridge = { x: corner.x + dir.x * bridgeOffset, z: corner.z + dir.z * bridgeOffset };
      const riftOffset = 1.0 + 1.3 + 1.7;
      const rift = { x: bridge.x + dir.x * riftOffset, z: bridge.z + dir.z * riftOffset };
      const bridgeId = `rift-bridge-${riftNumber}`;
      const checkpointId = `rift-${riftNumber}`;
      add({ id: bridgeId, ...bridge, y: corner.y + 0.4, w: 2.0, d: 2.0, h: 0.45, type: 'crumble', skin: 'bridge', optional: true, label: 'RIFT PATH' });
      add({ id: checkpointId, ...rift, y: corner.y + 0.9, w: 3.4, d: 3.4, type: 'checkpoint', skin: 'rift', optional: true, label: 'CHECKPOINT RIFT', safeSpawn: true });
      coins.push({ id: `coin-rift-${riftNumber}`, x: round(rift.x), y: round(corner.y + 0.9 + 1.15), z: round(rift.z), section: zone.id, bonus: true });
      branches.push({ id: `checkpoint-path-${riftNumber}`, from: corner.id, route: [bridgeId, checkpointId], reward: 'checkpoint', returnTo: corner.id });
      corner.branched = true;
      if (riftNumber === 0) before.hint = 'The glowing rift off the corner saves your climb. Reach it if you dare.';
      riftNumber++;
    }
  }

  // Bonus updrafts: an inward pad throws you onto a coin ledge, then you rejoin the route.
  const isStatic = (p) => p && p.type === 'normal' && !p.motion;
  const sameDir = (a, b) => a && b && a.dirX === b.dirX && a.dirZ === b.dirZ;
  let bonusNumber = 0;
  for (const zone of ZONES) {
    const candidates = routePlatforms.filter((p, i) => p.section === zone.id && p.y >= zone.from + 10 && p.y < zone.to - 12 &&
      isStatic(p) && !p.corner && !p.gate && sameDir(p, routePlatforms[i + 1]) && sameDir(p, routePlatforms[i + 2]) &&
      isStatic(routePlatforms[i + 2]) && !routePlatforms[i + 2].corner);
    for (const k of candidates) {
      const i = route.indexOf(k.id);
      const target = routePlatforms[i + 2];
      const dir = { x: k.dirX, z: k.dirZ };
      const inward = inwardOf(dir);
      const lateralHalf = halfAlong(k, inward);
      const pad = { id: `pad-${bonusNumber}`, x: k.x + inward.x * (lateralHalf + 1.0 + 1.5), z: k.z + inward.z * (lateralHalf + 1.0 + 1.5),
        y: k.y + 0.1, w: 3, d: 3, h: 0.7, type: 'pad', skin: 'pad', optional: true, label: 'UPDRAFT' };
      const ledge = { id: `bonus-${bonusNumber}`, x: pad.x + dir.x * (1.5 + 1.2 + 1.75), z: pad.z + dir.z * (1.5 + 1.2 + 1.75),
        y: pad.y + rnd(2.7, 3.1), w: 3.5, d: 3.5, h: 0.6, type: 'normal', skin: 'bonus', optional: true, label: 'BONUS' };
      const envelope = linkEnvelope(ledge, target);
      if (target.y - ledge.y > envelope.maxRise - 0.2 || platformGap(ledge, target) > envelope.maxGap - 0.3) continue;
      if (platformGap(k, pad) > 2.5) continue;
      if ([pad, ledge].some((candidate) => platforms.some((p) => platformsConflict(candidate, p, 0.3)))) continue;
      add(pad);
      add(ledge);
      for (let c = -1; c <= 1; c++) {
        coins.push({ id: `coin-bonus-${bonusNumber}-${c + 1}`, x: round(ledge.x + dir.x * c * 0.95), y: round(ledge.y + 1.15),
          z: round(ledge.z + dir.z * c * 0.95), section: zone.id, bonus: true });
      }
      branches.push({ id: `boost-path-${bonusNumber}`, from: k.id, route: [pad.id, ledge.id], reward: 'boost', returnTo: target.id });
      bonusNumber++;
      break;
    }
  }

  // Overhead diamonds give skilled players a faster swing line along a run.
  for (let i = 9; i < routePlatforms.length - 3; i += 10) {
    const p = routePlatforms[i];
    if (!sameDir(p, routePlatforms[i + 1]) || p.section === 7) continue;
    const dir = { x: p.dirX, z: p.dirZ };
    const inward = inwardOf(dir);
    anchors.push({ id: `anchor-${p.routeIndex}`, x: round(p.x + dir.x * 3.2 + inward.x * 1.9), y: round(p.y + 6.2),
      z: round(p.z + dir.z * 3.2 + inward.z * 1.9), range: 13, section: p.section, routeIndex: p.routeIndex });
  }

  // Liquidation lasers graze the outer edge of a run; the inside edge always offers cover.
  for (let i = 2; i < routePlatforms.length - 2; i++) {
    const p = routePlatforms[i];
    if (!ZONES[p.section].sweepers || !isStatic(p) || p.corner || p.gate || i % 4 !== 0) continue;
    const neighbours = [routePlatforms[i - 1], routePlatforms[i + 1]];
    if (!neighbours.every((n) => sameDir(p, n) && n.type !== 'rail' && !n.motion && !n.corner)) continue;
    const dir = { x: p.dirX, z: p.dirZ };
    const out = outwardOf(dir);
    const offset = halfAlong(p, out) + 1.9;
    hazards.push({ id: `sweeper-${p.routeIndex}`, x: round(p.x + out.x * offset), y: round(p.y + 1.0), z: round(p.z + out.z * offset),
      w: 6.4, d: 0.36, h: 0.36, angle: 0, speed: (p.routeIndex % 2 ? 1 : -1) * 0.85, section: p.section, platformId: p.id });
  }

  // A bag of $AGI coins: every fourth stationary step, plus the bonus ledges and rifts.
  for (const p of routePlatforms) {
    if (p.routeIndex % 4 !== 2 || p.motion || p.type === 'finish' || p.type === 'rail') continue;
    coins.push({ id: `coin-${p.routeIndex}`, x: p.x, y: round(p.y + 1.15), z: p.z, section: p.section });
  }
  coins.sort((a, b) => a.y - b.y);

  for (const p of platforms) { delete p.branched; }
  const finish = platforms.find((p) => p.type === 'finish');
  const summit = { x: finish.x, y: finish.y, z: finish.z, platformId: finish.id };
  return { revision: WORLD_REVISION, seed, platforms, anchors, hazards, sections, spawn, summit, route, branches, coins };
}

/** How far a rug travels once it is pulled before it vanishes. */
export function rugPullDistance(p) { return Math.max(p.w, p.d) * 1.6; }

/** Axis-aligned boxes including motion, lift, sink and rug-pull excursions. */
export function sweptBox(p) {
  const ex = motionExcursion(p, 'x');
  const ez = motionExcursion(p, 'z');
  const ey = motionExcursion(p, 'y');
  // A pulled rug only ever travels one way: outward, off the spiral.
  const pull = p.type === 'rug' ? rugPullDistance(p) : 0;
  const px = pull * (p.pullX || 0), pz = pull * (p.pullZ || 0);
  return {
    minX: p.x - p.w / 2 - ex + Math.min(0, px), maxX: p.x + p.w / 2 + ex + Math.max(0, px),
    minZ: p.z - p.d / 2 - ez + Math.min(0, pz), maxZ: p.z + p.d / 2 + ez + Math.max(0, pz),
    minY: p.y - p.h - (p.type === 'dump' ? p.drop || 0 : 0) - ey,
    maxY: p.y + (p.type === 'pump' ? p.lift || 0 : 0) + ey,
  };
}

/** Two swept volumes overlap in plan view and sit within a character's headroom of each other. */
export function platformsConflict(a, b, clearance = 0, headroom = 2.6) {
  const A = sweptBox(a), B = sweptBox(b);
  return A.minX < B.maxX + clearance && B.minX < A.maxX + clearance &&
    A.minZ < B.maxZ + clearance && B.minZ < A.maxZ + clearance &&
    A.minY < B.maxY + headroom && B.minY < A.maxY + headroom;
}

/** Conservative rect-to-rect gap, including the entire motion excursion. */
export function platformGap(a, b, margin = JUMP_ENVELOPE.margin) {
  const excursion = (p, axis) => p.motion?.axis === axis ? Math.abs(p.motion.amplitude) : 0;
  const dx = Math.max(0, Math.abs(a.x - b.x) + excursion(a, 'x') + excursion(b, 'x') - (a.w + b.w) / 2 + 2 * margin);
  const dz = Math.max(0, Math.abs(a.z - b.z) + excursion(a, 'z') + excursion(b, 'z') - (a.d + b.d) / 2 + 2 * margin);
  return Math.hypot(dx, dz);
}

/** Check the movement envelope, clearances and save anchors before shipping a world revision. */
export function validateRoute(world) {
  const errors = [];
  const byId = new Map();
  const zones = world.sections || ZONES;
  for (const p of world.platforms) {
    if (byId.has(p.id)) errors.push(`Duplicate platform ${p.id}`);
    byId.set(p.id, p);
    if (![p.x, p.y, p.z, p.w, p.d, p.h].every(Number.isFinite) || p.w <= 0 || p.d <= 0 || p.h <= 0) errors.push(`Invalid geometry ${p.id}`);
    if (p.type === 'pump' && !(p.lift > 0)) errors.push(`Pump without lift ${p.id}`);
  }
  const checkLink = (fromId, toId, main = false) => {
    const a = byId.get(fromId), b = byId.get(toId);
    if (!a || !b) { errors.push(`Missing route platform ${fromId} -> ${toId}`); return; }
    const envelope = linkEnvelope(a, b, zones);
    const rise = b.y - takeoffHeight(a);
    const discriminant = envelope.speed ** 2 - 2 * envelope.gravity * rise;
    if (discriminant < 0 || rise > envelope.maxRise || (main && a.type === 'dump' && rise > 1.0)) errors.push(`Unreachable rise ${fromId} -> ${toId}: ${rise.toFixed(2)}m`);
    const flightTime = discriminant >= 0 ? (envelope.speed + Math.sqrt(discriminant)) / envelope.gravity : 0;
    const gap = platformGap(a, b);
    if (gap > Math.min(envelope.maxGap, envelope.run * flightTime * 0.8)) errors.push(`Unreachable gap ${fromId} -> ${toId}: ${gap.toFixed(2)}m`);
  };
  for (let i = 1; i < world.route.length; i++) checkLink(world.route[i - 1], world.route[i], true);
  for (const branch of world.branches || []) {
    const ids = [branch.from, ...branch.route];
    for (let i = 1; i < ids.length; i++) checkLink(ids[i - 1], ids[i]);
    if (branch.reward === 'checkpoint') {
      for (let i = ids.length - 1; i > 0; i--) checkLink(ids[i], ids[i - 1]);
    } else if (branch.returnTo) {
      checkLink(ids.at(-1), branch.returnTo);
    }
  }
  // Swept volumes never intersect, and nothing hangs low enough over a top to bump a head.
  const boxes = world.platforms.map((p) => ({ p, box: sweptBox(p) }));
  boxes.sort((a, b) => a.box.minY - b.box.minY);
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length; j++) {
      const B = boxes[j];
      if (B.box.minY > A.box.maxY + 2.6) break;
      const overlapXZ = A.box.minX < B.box.maxX && B.box.minX < A.box.maxX && A.box.minZ < B.box.maxZ && B.box.minZ < A.box.maxZ;
      if (!overlapXZ) continue;
      errors.push(`Platforms collide or lack headroom: ${A.p.id} / ${B.p.id}`);
    }
  }
  for (const checkpoint of world.platforms.filter((p) => p.type === 'checkpoint')) {
    if (world.route.includes(checkpoint.id)) errors.push(`Checkpoint is on the main route: ${checkpoint.id}`);
    if (checkpoint.motion || checkpoint.w < 3 || checkpoint.d < 3) errors.push(`Unsafe checkpoint footprint ${checkpoint.id}`);
    for (const p of world.platforms) {
      if (p.id === checkpoint.id) continue;
      if (Math.abs(p.x - checkpoint.x) < p.w / 2 + 0.4 && Math.abs(p.z - checkpoint.z) < p.d / 2 + 0.4 && p.y - p.h > checkpoint.y && p.y - p.h < checkpoint.y + 2.2) errors.push(`Checkpoint headroom blocked: ${checkpoint.id}`);
    }
  }
  const last = byId.get(world.route.at(-1));
  if (last?.type !== 'finish') errors.push('Route has no finish');
  return { valid: errors.length === 0, errors, mainSteps: world.route.length - 1, height: world.summit.y,
    checkpointCount: world.platforms.filter((p) => p.type === 'checkpoint').length };
}

/** Speedrun time with stable millisecond precision. */
export function formatTime(ms) {
  const value = Math.max(0, Math.floor(Number.isFinite(ms) ? ms : 0));
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor(value / 1000) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`;
}
