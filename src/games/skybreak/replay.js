import { PHYSICS } from './physics.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const neutral = () => ({ x: 0, z: 0, jump: false, jumpPressed: false });
// Surfaces that count down under you: waiting on them is never safe.
const UNSTABLE = new Set(['crumble', 'dump', 'rug']);

function predict(platform, time) {
  const point = { x: platform.baseX, y: platform.y, z: platform.baseZ };
  if (platform.motion) {
    const { axis, amplitude, speed, phase = 0 } = platform.motion;
    point[axis] = (axis === 'y' ? platform.baseY : point[axis]) + Math.sin(time * speed + phase) * amplitude;
  }
  return point;
}

/**
 * A visible, input-only QA pilot. It reads the exact same physics used by players
 * and never changes a position, velocity, collider, clock, or checkpoint.
 * Call sample immediately before each fixed physics step.
 * `route` defaults to the main climb; tests pass detours through the optional branches.
 */
export function createReplay(world, physics, { route: routeOverride } = {}) {
  const route = [...(routeOverride || world.route)];
  const platforms = new Map(physics.platforms.map(platform => [platform.id, platform]));
  const startIndex = route.indexOf(physics.player.supportId);
  let wanted = Math.max(1, startIndex + 1);
  let previousSupport = route[Math.max(0, startIndex)] || 'launch';
  let ticks = 0;
  let landedAt = 0;
  let lastProgress = 0;
  let blockedTicks = 0;
  let previousSample = null;
  let elapsed = 0;
  let progressTime = 0;
  let jumps = 0;
  let error = null;

  return {
    get done() { return !error && wanted >= route.length; },
    get target() { return platforms.get(route[wanted]) || null; },
    get error() { return error; },
    get progress() { return { wanted, total: route.length, jumps, ticks }; },

    sample(dt = PHYSICS.fixedStep) {
      if (error || wanted >= route.length) return neutral();
      dt = Number.isFinite(dt) && dt > 0 ? dt : PHYSICS.fixedStep;
      elapsed += dt;
      const p = physics.player;
      if (previousSample) {
        blockedTicks = p.grounded && previousSample.inputLength > 3 &&
          Math.hypot(p.x - previousSample.x, p.z - previousSample.z) < 0.01 ? blockedTicks + 1 : 0;
      }
      // A pad launches you on the tick you land, so touching it counts as arriving.
      const arrived = p.supportId === route[wanted] && (p.grounded || platforms.get(route[wanted])?.type === 'pad');
      if (arrived) {
        previousSupport = route[wanted++];
        lastProgress = ticks;
        progressTime = elapsed;
        landedAt = ticks;
      }
      if (wanted >= route.length) return neutral();
      const target = platforms.get(route[wanted]);
      const source = platforms.get(p.supportId || previousSupport);
      if (!target) {
        error = `Missing route platform: ${route[wanted]}`;
        return neutral();
      }
      const floor = Math.min(source?.y ?? 0, source?.baseY ?? 0) - (source?.type === 'dump' ? (source.drop || 5) + 4 : 4);
      if (p.y < floor) {
        error = `Replay fell below ${source?.id || previousSupport} while approaching ${target.id}.`;
        return neutral();
      }
      if (elapsed - progressTime > 15 || ticks - lastProgress > 900) {
        error = `Replay could not reach ${target.id} within 15 seconds.`;
        return neutral();
      }
      if (elapsed > 1500 || ticks > 90000) {
        error = 'Replay exceeded its traversal time limit.';
        return neutral();
      }
      ticks++;
      // A stable surface is a safe place to wait for a vanished target to come back.
      if (!target.active && p.grounded && source && !UNSTABLE.has(source.type)) return neutral();
      const gravity = physics.gravityAt ? physics.gravityAt(p.y) : PHYSICS.gravity;
      const reach = PHYSICS.jumpSpeed ** 2 / (2 * gravity) * 0.74;
      // Ride a pumping candle until the next step is within a normal jump.
      const riding = p.grounded && source?.type === 'pump' && source.liftProgress < 1 && target.y - source.y > reach;
      const fallTime = Math.max(0.05,
        (p.vy + Math.sqrt(Math.max(0, p.vy ** 2 + 2 * gravity * (p.y - target.y)))) / gravity);
      const aim = predict(target, physics.time + (p.grounded ? 0.6 : fallTime));
      let tx = aim.x, tz = aim.z;
      let jumpPressed = false;
      if (p.grounded && source) {
        const dx = aim.x - source.x, dz = aim.z - source.z;
        const distance = Math.hypot(dx, dz) || 1;
        const ux = dx / distance, uz = dz / distance;
        const along = Math.min((source.w / 2 - 0.7) / Math.max(Math.abs(ux), 0.0001),
          (source.d / 2 - 0.7) / Math.max(Math.abs(uz), 0.0001));
        tx = source.x + ux * along;
        tz = source.z + uz * along;
        const approach = 4.4 + Math.max(0, Math.max(target.w, target.d) - 4) / 2;
        const ready = Math.hypot(tx - p.x, tz - p.z) < 0.7 || Math.hypot(aim.x - p.x, aim.z - p.z) < approach || blockedTicks > 8;
        if (!riding && ready && ticks - landedAt > 1) {
          jumpPressed = true;
          jumps++;
          tx = aim.x; tz = aim.z;
        }
      }
      const gain = p.grounded ? 5 : 3;
      const vx = clamp((tx - p.x) * gain, -8, 8), vz = clamp((tz - p.z) * gain, -8, 8);
      const inputLength = Math.hypot(vx, vz);
      previousSample = { x: p.x, z: p.z, inputLength };
      return { x: vx / Math.max(8, inputLength), z: vz / Math.max(8, inputLength), jump: true, jumpPressed };
    },
  };
}
