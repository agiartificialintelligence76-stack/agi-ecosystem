import RAPIER from '@dimforge/rapier3d-compat';

// Positions exposed to the renderer describe the soles of the character's feet.
export const PHYSICS = Object.freeze({
  fixedStep: 1 / 60, radius: 0.34, halfHeight: 0.52, centerHeight: 0.86,
  gravity: 24, jumpSpeed: 10.2, runSpeed: 8, sprintSpeed: 10,
  maxSpeed: 23, terminalSpeed: 52, coyoteTime: 0.12, jumpBuffer: 0.14, railSpeed: 12,
});
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
// Platforms whose collider changes over time. Everything else is placed once.
const DYNAMIC_TYPES = new Set(['crumble', 'pump', 'dump', 'rug']);
const ease = (t) => t * t * (3 - 2 * t);
// Surfaces that start their countdown when you land on them.
const TRIGGERED_TYPES = new Set(['crumble', 'dump', 'rug']);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
const length = (v) => Math.hypot(v.x, v.y, v.z);
let initialized;

export class SkyPhysics {
  static async create(platforms, options = {}) {
    initialized ??= RAPIER.init();
    await initialized;
    return new SkyPhysics(platforms, options);
  }

  constructor(platforms, { spawn = { x: 0, y: 1, z: 0 }, onEvent = () => {}, gravityScale = () => 1 } = {}) {
    this.onEvent = onEvent;
    this.gravityScale = gravityScale;
    this.time = 0;
    this.world = new RAPIER.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.fixedStep;
    this.platforms = platforms.map((p, index) => {
      const def = { h: 0.45, type: 'normal', ...p, id: p.id ?? `platform-${index}` };
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(def.w / 2, def.h / 2, def.d / 2)
        .setTranslation(def.x, def.y - def.h / 2, def.z).setFriction(0));
      const dynamic = Boolean(def.motion) || DYNAMIC_TYPES.has(def.type);
      return { ...def, railDirection: def.railDirection ?? { x: def.dx ?? 0, z: def.dz ?? -1 },
        baseX: def.x, baseY: def.y, baseZ: def.z, collider, dynamic,
        active: true, triggeredAt: null, resetAt: null, crumbleProgress: 0, dx: 0, dy: 0, dz: 0,
        lifted: 0, liftProgress: 0, idleTime: 0, pumping: false, sunk: 0, pulled: 0, height: def.h };
    });
    this.dynamicPlatforms = this.platforms.filter((p) => p.dynamic);
    this.platformByHandle = new Map(this.platforms.map((p) => [p.collider.handle, p]));
    this.capsule = new RAPIER.Capsule(PHYSICS.halfHeight, PHYSICS.radius);
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(PHYSICS.halfHeight, PHYSICS.radius)
      .setTranslation(spawn.x, spawn.y + PHYSICS.centerHeight, spawn.z).setFriction(0));
    this.controller = this.world.createCharacterController(0.015);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(0.22, 0.3, false);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.27);
    this.controller.setMinSlopeSlideAngle(Math.PI * 0.3);
    this.hazards = [];
    this.player = {};
    this.reset(spawn);
  }

  emit(type, details = {}) { this.onEvent({ type, ...details }); }

  reset(spawn) {
    Object.assign(this.player, { x: spawn.x, y: spawn.y + 0.035, z: spawn.z,
      vx: 0, vy: 0, vz: 0, grounded: false, state: 'fall', speed: 0,
      grapple: null, supportId: null, facingX: 0, facingZ: -1 });
    this.coyote = 0;
    this.jumpBuffered = 0;
    this.rollTimer = 0;
    this.mantle = null;
    this.lastJumpHeld = false;
    this.hazardCooldown = 0;
    this.padCooldown = 0;
    this.support = null;
    this.checkpointVisited = new Set();
    this.finishTriggered = false;
    for (const platform of this.dynamicPlatforms) {
      platform.triggeredAt = null;
      platform.resetAt = null;
      platform.active = true;
      platform.crumbleProgress = 0;
      platform.lifted = 0; platform.liftProgress = 0; platform.idleTime = 0; platform.pumping = false;
      platform.sunk = 0; platform.pulled = 0; platform.height = platform.h;
      platform.x = platform.baseX; platform.y = platform.baseY; platform.z = platform.baseZ;
      platform.dx = 0; platform.dy = 0; platform.dz = 0;
      this.placeCollider(platform);
      platform.collider.setEnabled(true);
    }
    this.syncCollider();
    this.world.step();
  }

  /** Current downward pull, including the Moon band's low gravity. */
  gravityAt(y = this.player.y) {
    return PHYSICS.gravity * this.gravityScale(y);
  }

  placeCollider(platform) {
    if (platform.type === 'pump') platform.collider.setHalfExtents({ x: platform.w / 2, y: platform.height / 2, z: platform.d / 2 });
    platform.collider.setTranslation({ x: platform.x, y: platform.y - platform.height / 2, z: platform.z });
  }

  syncCollider() {
    const p = this.player;
    this.playerCollider.setTranslation({ x: p.x, y: p.y + PHYSICS.centerHeight, z: p.z });
  }

  setHazards(hazards = []) {
    for (const h of this.hazards) this.world.removeCollider(h.collider, true);
    this.hazards = hazards.map((h, i) => {
      const def = { id: `hazard-${i}`, angle: 0, speed: 1, w: 7, d: 0.32, h: 0.36, ...h };
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(def.w / 2, def.h / 2, def.d / 2)
        .setTranslation(def.x, def.y, def.z).setSensor(true));
      return { ...def, initialAngle: def.angle, previousAngle: def.angle, collider };
    });
  }

  getHazardStates() {
    return this.hazards.map(({ id, x, y, z, angle, w, d, h }) => ({ id, x, y, z, angle, w, d, h }));
  }

  getPlatformStates() {
    return this.platforms.map(({ id, x, y, z, active, crumbleProgress, lifted, sunk, pulled }) => ({ id, x, y, z, active, crumbleProgress, lifted, sunk, pulled }));
  }

  updatePump(platform, dt) {
    // A green candle pumps while someone stands on it, holds, then eases back down.
    const occupied = this.support === platform && this.player.grounded;
    if (occupied) {
      platform.idleTime = 0;
      if (!platform.pumping) { platform.pumping = true; this.emit('pump', { platform }); }
      platform.liftProgress = Math.min(1, platform.liftProgress + dt / (platform.riseTime || 1.35));
    } else {
      platform.idleTime += dt;
      if (platform.idleTime > 1.6) platform.liftProgress = Math.max(0, platform.liftProgress - dt / ((platform.riseTime || 1.35) * 1.8));
      if (platform.liftProgress === 0) platform.pumping = false;
    }
    platform.lifted = (platform.lift || 0) * ease(platform.liftProgress);
    platform.y = platform.baseY + platform.lifted;
    platform.height = platform.h + platform.lifted;
  }

  updateDump(platform) {
    // A red candle holds for a beat after you land, then falls away and resets.
    if (platform.triggeredAt === null) return;
    if (platform.active) {
      const t = this.time - platform.triggeredAt - (platform.delay ?? 0.38);
      if (t <= 0) return;
      if (platform.sunk === 0) this.emit('dump', { platform });
      platform.sunk = Math.min(platform.drop || 5, 0.5 * 11 * t * t + 0.4 * t);
      platform.y = platform.baseY - platform.sunk;
      if (platform.sunk >= (platform.drop || 5)) {
        platform.active = false;
        platform.resetAt = this.time + 2.4;
        platform.collider.setEnabled(false);
        this.emit('crash', { platform });
      }
    } else if (this.time >= platform.resetAt) {
      this.restore(platform);
    }
  }

  updateRug(platform) {
    // The rug slides out from under you; it never carries you with it.
    if (platform.triggeredAt === null) return;
    if (platform.active) {
      const t = this.time - platform.triggeredAt - (platform.delay ?? 0.5);
      if (t <= 0) return;
      if (platform.pulled === 0) this.emit('rug', { platform });
      const distance = Math.max(platform.w, platform.d) * 1.6;
      platform.pulled = Math.min(distance, 0.5 * 34 * t * t + 1.5 * t);
      platform.x = platform.baseX + (platform.pullX ?? 1) * platform.pulled;
      platform.z = platform.baseZ + (platform.pullZ ?? 0) * platform.pulled;
      if (platform.pulled >= distance) {
        platform.active = false;
        platform.resetAt = this.time + 2.6;
        platform.collider.setEnabled(false);
      }
    } else if (this.time >= platform.resetAt) {
      this.restore(platform);
    }
  }

  /** Bring a vanished surface back at its origin, but never inside the character. */
  restore(platform) {
    const saved = { x: platform.x, y: platform.y, z: platform.z };
    platform.x = platform.baseX; platform.y = platform.baseY; platform.z = platform.baseZ;
    if (this.overlapsPlatform(platform)) { Object.assign(platform, saved); return; }
    platform.active = true;
    platform.triggeredAt = null;
    platform.sunk = 0; platform.pulled = 0; platform.crumbleProgress = 0;
    platform.collider.setEnabled(true);
    this.emit('restore', { platform });
  }

  updatePlatforms(dt) {
    for (const platform of this.dynamicPlatforms) {
      const oldX = platform.x, oldY = platform.y, oldZ = platform.z;
      if (platform.motion) {
        const { axis = 'x', amplitude = 1, speed = 0.8, phase = 0 } = platform.motion;
        const base = axis === 'x' ? platform.baseX : axis === 'y' ? platform.baseY : platform.baseZ;
        platform[axis] = base + Math.sin(this.time * speed + phase) * amplitude;
      }
      if (platform.type === 'pump') this.updatePump(platform, dt);
      else if (platform.type === 'dump') this.updateDump(platform);
      else if (platform.type === 'rug') this.updateRug(platform);
      platform.dx = platform.x - oldX;
      platform.dy = platform.y - oldY;
      platform.dz = platform.z - oldZ;
      // A surface that snapped back to its origin did not carry anybody there.
      if (Math.abs(platform.dy) > 1 || Math.hypot(platform.dx, platform.dz) > 1) { platform.dx = 0; platform.dy = 0; platform.dz = 0; }
      this.placeCollider(platform);
      if (platform.type === 'crumble' && platform.triggeredAt !== null) {
        platform.crumbleProgress = clamp((this.time - platform.triggeredAt) / 0.65, 0, 1);
        if (platform.active && platform.crumbleProgress >= 1) {
          platform.active = false;
          platform.resetAt = this.time + 3;
          platform.collider.setEnabled(false);
          this.emit('crumble', { platform });
        }
        // A reappearing step must not materialize inside the character.
        if (!platform.active && this.time >= platform.resetAt && !this.overlapsPlatform(platform)) {
          platform.active = true;
          platform.triggeredAt = null;
          platform.crumbleProgress = 0;
          platform.collider.setEnabled(true);
        }
      }
    }
    for (const hazard of this.hazards) {
      hazard.previousAngle = hazard.angle;
      hazard.angle = hazard.initialAngle + this.time * hazard.speed;
      hazard.collider.setRotation({ x: 0, y: Math.sin(hazard.angle / 2), z: 0, w: Math.cos(hazard.angle / 2) });
    }
    this.world.timestep = dt;
    this.world.step();
  }

  overlapsPlatform(platform) {
    const p = this.player;
    return Math.abs(p.x - platform.x) < platform.w / 2 + PHYSICS.radius &&
      Math.abs(p.z - platform.z) < platform.d / 2 + PHYSICS.radius &&
      p.y < platform.y + 0.05 && p.y + PHYSICS.centerHeight * 2 > platform.y - platform.height;
  }

  move(delta, snap = false) {
    if (snap) this.controller.enableSnapToGround(0.22);
    else this.controller.disableSnapToGround();
    this.controller.computeColliderMovement(this.playerCollider, delta, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const movement = this.controller.computedMovement();
    this.player.x += movement.x;
    this.player.y += movement.y;
    this.player.z += movement.z;
    const grounded = this.controller.computedGrounded();
    let support = null, ceiling = false;
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const collision = this.controller.computedCollision(i);
      if (collision.normal1.y > 0.55) support = this.platformByHandle.get(collision.collider.handle) ?? support;
      if (collision.normal1.y < -0.55) ceiling = true;
    }
    this.syncCollider();
    return { movement, grounded, support, ceiling };
  }

  clearAt(x, y, z) {
    return !this.world.intersectionWithShape(
      { x, y: y + PHYSICS.centerHeight, z }, IDENTITY, this.capsule,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider,
    );
  }

  /** Distance to the nearest surface below the character, or null when there is only sky. */
  groundBelow(maxDistance = 1200) {
    const p = this.player;
    let best = null;
    for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
      const ray = new RAPIER.Ray({ x: p.x + ox, y: p.y + 0.2, z: p.z + oz }, { x: 0, y: -1, z: 0 });
      const hit = this.world.castRay(ray, maxDistance, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider);
      if (hit && (best === null || hit.timeOfImpact < best)) best = hit.timeOfImpact;
    }
    return best;
  }

  stabilizeSupport() {
    const p = this.player;
    if (p.vy > 0) return null;
    // Rapier's contact tolerance can drift a capsule a few millimetres into very
    // wide thin boxes. Resolve only an existing, nearby top-surface contact.
    // This never snaps across gaps, onto a higher step, or under an overhang.
    let support = null;
    for (const platform of this.platforms) {
      if (!platform.active || Math.abs(p.x - platform.x) > platform.w / 2 - 0.015 ||
          Math.abs(p.z - platform.z) > platform.d / 2 - 0.015) continue;
      if (p.y < platform.y - 0.08 || p.y > platform.y + 0.045) continue;
      if (!support || platform.y > support.y) support = platform;
    }
    if (support) { p.y = support.y + 0.025; this.syncCollider(); }
    return support;
  }

  startMantle(input) {
    const p = this.player;
    const inputLength = Math.hypot(input.x || 0, input.z || 0);
    if (p.grounded || p.grapple || inputLength < 0.1 || (!input.jump && this.jumpBuffered <= 0) || p.vy < -13) return;
    const dx = (input.x || 0) / inputLength, dz = (input.z || 0) / inputLength;
    let candidate;
    for (const platform of this.platforms) {
      const rise = platform.y - p.y;
      if (!platform.active || rise < 0.2 || rise > 1.6 || platform.w < 0.9 || platform.d < 0.9) continue;
      const inset = PHYSICS.radius + 0.12;
      const tx = clamp(p.x + dx * 1.05, platform.x - platform.w / 2 + inset, platform.x + platform.w / 2 - inset);
      const tz = clamp(p.z + dz * 1.05, platform.z - platform.d / 2 + inset, platform.z + platform.d / 2 - inset);
      const distance = Math.hypot(tx - p.x, tz - p.z);
      if (distance > 1.1 || distance < 0.12 || (tx - p.x) * dx + (tz - p.z) * dz < 0.12) continue;
      if (!this.clearAt(tx, platform.y + 0.04, tz)) continue;
      if (!candidate || distance < candidate.distance) candidate = { platform, x: tx, y: platform.y + 0.04, z: tz, distance };
    }
    if (!candidate) return;
    this.mantle = { ...candidate, elapsed: 0, vx: p.vx, vz: p.vz };
    p.vy = 0;
    p.state = 'mantle';
    this.jumpBuffered = 0;
    this.emit('mantle', { platform: candidate.platform });
  }

  stepMantle(dt) {
    const m = this.mantle, p = this.player;
    m.elapsed += dt;
    if (!m.platform.active || m.elapsed > 0.8) { this.mantle = null; return false; }
    // Lift outside the edge first, then move over it; both legs use capsule sweeps.
    const lift = m.y - p.y;
    const delta = lift > 0.025
      ? { x: 0, y: Math.min(lift, dt * 6.5), z: 0 }
      : { x: clamp(m.x - p.x, -dt * 5.5, dt * 5.5), y: Math.max(lift, -dt), z: clamp(m.z - p.z, -dt * 5.5, dt * 5.5) };
    this.move(delta);
    p.state = 'mantle';
    p.vx = 0; p.vz = 0; p.vy = 0; p.grounded = false;
    if (Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z) < 0.06) {
      p.vx = m.vx * 0.35; p.vz = m.vz * 0.35;
      this.mantle = null;
    }
    return true;
  }

  attachGrapple(anchor) {
    if (!anchor || !Number.isFinite(anchor.x + anchor.y + anchor.z)) return;
    const p = this.player;
    const from = { x: p.x, y: p.y + 1.15, z: p.z };
    const delta = { x: anchor.x - from.x, y: anchor.y - from.y, z: anchor.z - from.z };
    const distance = length(delta);
    if (distance < 1.5 || distance > 24 || anchor.y < p.y - 1) return;
    const ray = new RAPIER.Ray(from, { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance });
    const obstacle = this.world.castRay(ray, Math.max(0, distance - 0.3), true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider);
    if (obstacle) return;
    p.grapple = { anchor: { id: anchor.id, x: anchor.x, y: anchor.y, z: anchor.z }, length: Math.max(3, distance) };
    p.vy = Math.max(p.vy, 3);
    this.emit('grapple', { attached: true, anchor });
  }

  detachGrapple(reason = 'released') {
    if (!this.player.grapple) return;
    this.player.grapple = null;
    this.emit('grapple', { attached: false, reason });
  }

  applyRope(dt, input) {
    const p = this.player, rope = p.grapple;
    if (!rope) return;
    const dx = p.x - rope.anchor.x, dy = p.y + 1.15 - rope.anchor.y, dz = p.z - rope.anchor.z;
    const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
    const nx = dx / distance, ny = dy / distance, nz = dz / distance;
    // A small continuous reel makes an attached grapple useful from a standstill.
    rope.length = Math.max(3, rope.length - dt * (input.grapple ? 2.8 : 0));
    const ray = new RAPIER.Ray({ x: p.x, y: p.y + 1.15, z: p.z }, { x: -nx, y: -ny, z: -nz });
    if (this.world.castRay(ray, Math.max(0, distance - 0.3), true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider)) {
      this.detachGrapple('obstructed'); return;
    }
    if (distance >= rope.length - 0.06) {
      const outward = p.vx * nx + p.vy * ny + p.vz * nz;
      const correction = Math.max(0, outward) + Math.min(16, Math.max(0, distance - rope.length) * 18) * dt;
      p.vx -= nx * correction; p.vy -= ny * correction; p.vz -= nz * correction;
      const reel = input.grapple ? 8 * dt : 0;
      p.vx -= nx * reel; p.vy -= ny * reel; p.vz -= nz * reel;
    }
  }

  checkHazards(oldPosition) {
    if (this.hazardCooldown > 0) return;
    const p = this.player;
    for (const h of this.hazards) {
      // Sweep both the rotating blade and the player's translation within this tick.
      const count = Math.max(2, Math.ceil(Math.abs(h.angle - h.previousAngle) / 0.06),
        Math.ceil(Math.hypot(p.x - oldPosition.x, p.y - oldPosition.y, p.z - oldPosition.z) / 0.2));
      let hit = false;
      for (let i = 0; i <= count && !hit; i++) {
        const t = i / count;
        const x = oldPosition.x + (p.x - oldPosition.x) * t - h.x;
        const y = oldPosition.y + (p.y - oldPosition.y) * t;
        const z = oldPosition.z + (p.z - oldPosition.z) * t - h.z;
        const angle = h.previousAngle + (h.angle - h.previousAngle) * t;
        const localX = Math.cos(angle) * x - Math.sin(angle) * z;
        const localZ = Math.sin(angle) * x + Math.cos(angle) * z;
        hit = y < h.y + h.h / 2 && y + 1.72 > h.y - h.h / 2 &&
          Math.abs(localX) < h.w / 2 + PHYSICS.radius && Math.abs(localZ) < h.d / 2 + PHYSICS.radius;
      }
      if (!hit) continue;
      const dx = p.x - h.x, dz = p.z - h.z;
      const distance = Math.hypot(dx, dz);
      const nx = distance > 0.1 ? dx / distance : Math.cos(h.angle);
      const nz = distance > 0.1 ? dz / distance : -Math.sin(h.angle);
      p.vx = nx * 10; p.vz = nz * 10; p.vy = 5;
      p.grounded = false;
      this.mantle = null;
      this.hazardCooldown = 0.85;
      this.detachGrapple('hazard');
      this.emit('hazard', { hazard: h });
      return;
    }
  }

  step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0 || this.disposed) return;
    // The caller normally passes 1/60. Split larger deltas so no pause can skip a platform.
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.25) / PHYSICS.fixedStep));
    const stepDt = Math.min(dt, 0.25) / steps;
    for (let i = 0; i < steps; i++) this.fixedStep(stepDt, i === 0 ? input : { ...input, jumpPressed: false, grapplePressed: false, grappleReleased: false });
  }

  fixedStep(dt, input) {
    const p = this.player;
    const oldPosition = { x: p.x, y: p.y, z: p.z };
    const wasGrounded = p.grounded;
    this.time += dt;
    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    this.padCooldown = Math.max(0, this.padCooldown - dt);
    this.rollTimer = Math.max(0, this.rollTimer - dt);
    this.jumpBuffered = input.jumpPressed ? PHYSICS.jumpBuffer : Math.max(0, this.jumpBuffered - dt);
    this.coyote = wasGrounded ? PHYSICS.coyoteTime : Math.max(0, this.coyote - dt);
    this.updatePlatforms(dt);
    if (input.grappleReleased) this.detachGrapple();
    if (input.grapplePressed) {
      if (p.grapple) this.detachGrapple();
      else this.attachGrapple(input.anchor);
    }
    if (this.mantle && this.stepMantle(dt)) { this.checkHazards(oldPosition); return; }

    const inputLength = Math.hypot(input.x || 0, input.z || 0);
    const ix = inputLength > 1 ? input.x / inputLength : input.x || 0;
    const iz = inputLength > 1 ? input.z / inputLength : input.z || 0;
    if (inputLength > 0.1) { const facingLength = Math.hypot(ix, iz); p.facingX = ix / facingLength; p.facingZ = iz / facingLength; }
    const maxSpeed = input.sprint ? PHYSICS.sprintSpeed : PHYSICS.runSpeed;
    const currentSpeed = Math.hypot(p.vx, p.vz);
    const momentumSpeed = this.rollTimer > 0 || p.grapple ? Math.max(currentSpeed, maxSpeed) : maxSpeed;
    const acceleration = wasGrounded ? (this.rollTimer > 0 ? 10 : 48) : 18;
    if (inputLength > 0.05) {
      p.vx = approach(p.vx, ix * momentumSpeed, acceleration * dt);
      p.vz = approach(p.vz, iz * momentumSpeed, acceleration * dt);
    } else if (wasGrounded) {
      const friction = this.rollTimer > 0 ? 2 : 38;
      p.vx = approach(p.vx, 0, friction * dt);
      p.vz = approach(p.vz, 0, friction * dt);
    }

    let carry = { x: 0, y: 0, z: 0 };
    const standing = wasGrounded && this.support?.active ? this.support : null;
    // A pulled rug slides out from under you instead of carrying you along.
    if (standing) carry = standing.type === 'rug' ? { x: 0, y: standing.dy, z: 0 } : { x: standing.dx, y: standing.dy, z: standing.dz };
    // Ride vertical motion directly: a rising candle lifts you, a dumping one lowers you.
    if (carry.y !== 0) {
      if (this.clearAt(p.x, p.y + carry.y, p.z)) { p.y += carry.y; this.syncCollider(); }
      carry.y = 0;
    }
    let jumped = false;
    if (this.jumpBuffered > 0 && this.coyote > 0) {
      p.vy = PHYSICS.jumpSpeed;
      // Momentum from a moving surface carries into the jump; a falling surface never steals height.
      if (standing && standing.type !== 'rug') { p.vx += standing.dx / dt; p.vz += standing.dz / dt; p.vy += Math.max(0, standing.dy / dt); }
      p.grounded = false;
      this.jumpBuffered = 0; this.coyote = 0; this.support = null;
      jumped = true;
      this.emit('jump');
    }
    if (input.jump === false && this.lastJumpHeld && p.vy > 0 && !p.grapple) p.vy *= 0.62;
    this.lastJumpHeld = Boolean(input.jump);
    p.vy = Math.max(-PHYSICS.terminalSpeed, p.vy - this.gravityAt(p.y) * dt);

    if (standing?.type === 'rail') {
      const dx = standing.dxDirection ?? standing.railDirection?.x ?? standing.direction?.x ?? standing.dirX ?? ix ?? 0;
      const dz = standing.dzDirection ?? standing.railDirection?.z ?? standing.direction?.z ?? standing.dirZ ?? iz ?? -1;
      const mag = Math.hypot(dx, dz) || 1;
      // Accelerate along the rail up to its top speed; never past it.
      const alongSpeed = (p.vx * dx + p.vz * dz) / mag;
      const boost = Math.max(0, Math.min(dt * 26, PHYSICS.railSpeed - alongSpeed));
      p.vx += dx / mag * boost; p.vz += dz / mag * boost;
      this.rollTimer = Math.max(this.rollTimer, 0.3);
    }
    this.applyRope(dt, input);
    const horizontal = Math.hypot(p.vx, p.vz);
    if (horizontal > PHYSICS.maxSpeed) { p.vx *= PHYSICS.maxSpeed / horizontal; p.vz *= PHYSICS.maxSpeed / horizontal; }
    const fallSpeed = p.vy;
    const desired = { x: p.vx * dt + carry.x, y: p.vy * dt + carry.y, z: p.vz * dt + carry.z };
    const result = this.move(desired, wasGrounded && !jumped && p.vy <= 0);
    const stabilizedSupport = this.stabilizeSupport();
    const verifiedSupport = stabilizedSupport ?? result.support;
    p.grounded = !!verifiedSupport && (result.grounded || !!stabilizedSupport) && p.vy <= 0;
    this.support = p.grounded ? verifiedSupport : null;
    p.supportId = this.support?.id ?? null;
    if (result.ceiling && p.vy > 0) p.vy = 0;
    if (p.grounded) {
      p.vy = 0;
      if (!wasGrounded) {
        const rolled = Boolean(input.roll) && fallSpeed < -3;
        if (rolled) this.rollTimer = 0.62;
        else if (fallSpeed < -17) { p.vx *= 0.45; p.vz *= 0.45; }
        this.emit('land', { impact: -fallSpeed, roll: rolled, platform: this.support });
      }
      const platform = this.support;
      if (TRIGGERED_TYPES.has(platform?.type) && platform.triggeredAt === null && platform.active) platform.triggeredAt = this.time;
      if (platform?.type === 'pad' && this.padCooldown === 0) {
        p.vy = platform.launchSpeed ?? 15;
        p.grounded = false; this.support = null; this.coyote = 0;
        this.padCooldown = 0.35;
        this.emit('pad', { platform });
      }
      if (platform?.type === 'checkpoint' && !this.checkpointVisited.has(platform.id)) {
        this.checkpointVisited.add(platform.id);
        this.emit('checkpoint', { platform });
      }
      if (platform?.type === 'finish' && !this.finishTriggered) {
        this.finishTriggered = true;
        this.emit('finish', { platform });
      }
    }
    if (Math.abs(result.movement.x - desired.x) > 0.02 && Math.abs(result.movement.x) < Math.abs(desired.x) * 0.5) p.vx *= 0.3;
    if (Math.abs(result.movement.z - desired.z) > 0.02 && Math.abs(result.movement.z) < Math.abs(desired.z) * 0.5) p.vz *= 0.3;
    this.startMantle(input);
    this.checkHazards(oldPosition);
    p.speed = Math.hypot(p.vx, p.vz);
    p.state = this.mantle ? 'mantle' : p.grapple ? 'grapple' : this.rollTimer > 0 && p.grounded ? 'roll' :
      p.grounded ? (p.speed > 0.5 ? 'run' : 'idle') : p.vy > 0 ? 'jump' : 'fall';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.removeCharacterController(this.controller);
    this.world.free();
  }
}

export default SkyPhysics;
