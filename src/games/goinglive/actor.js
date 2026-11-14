// GOING LIVE: who moves in her room. AGI-1 walks round what's in the way, sits at her desk and types while a video is
// being made (from behind, at her screen), cheers when one is out, and when there's nothing to make she wanders, sits on
// a seat, naps on her bed or goes to see her cat. Her cat (and her robot dog) wander and nap; the spam bots walk in from
// the left; the fan-mail drone flies across. Positions are in floor cells (x across, y from the wall), fractional while
// walking. Pure but for its dice (Math.random: what she feels like doing is never part of the rules).
import { itemOf, homeOf, TUNE } from './data.js';
import { path as findPath, freeCell, deskSpot, layer } from './room.js';

const SPEED = 2.6, PET_SPEED = 1.6, BOT_SPEED = 1.3;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createActors() {
  return {
    her: { x: 4, y: 2, route: [], face: 1, state: 'idle', wait: 1.5, f: 0, ft: 0, blink: 2, cheer: 0, sit: null, sleep: 0, talk: 0, goal: null },
    pets: new Map(), bots: new Map(), drone: null, t: 0,
  };
}
const at = (a, p) => Math.abs(a.x - p.x) < 0.05 && Math.abs(a.y - p.y) < 0.05;
function walk(a, dt, speed) {
  if (!a.route.length) return true;
  const n = a.route[0], dx = n.x - a.x, dy = n.y - a.y, d = Math.hypot(dx, dy), s = speed * dt;
  if (Math.abs(dx) > 0.01) a.face = dx > 0 ? 1 : -1;
  if (d <= s) { a.x = n.x; a.y = n.y; a.route.shift(); } else { a.x += (dx / d) * s; a.y += (dy / d) * s; }
  a.ft += dt; if (a.ft > 0.12) { a.ft = 0; a.f = (a.f + 1) % 4; }
  return !a.route.length;
}
function goTo(c, a, cell) {
  const from = { x: Math.round(a.x), y: Math.round(a.y) };
  const p = findPath(c, from, cell);
  a.route = p ? p : [];
  a.goal = cell;
  return Boolean(p);
}
// her place in the room is still a free cell (things get moved round her): if not, she steps out of the way
function unstick(c, a) {
  const home = homeOf(c);
  a.x = Math.max(0, Math.min(home.cols - 1, a.x)); a.y = Math.max(0, Math.min(home.rows - 1, a.y));
  const cell = freeCell(c, { x: Math.round(a.x), y: Math.round(a.y) });
  if (!a.route.length && !a.sit && !a.sleep && (Math.round(a.x) !== cell.x || Math.round(a.y) !== cell.y)) { a.x = cell.x; a.y = cell.y; }
}

// ---------- AGI-1 ----------
export function updateHer(A, c, dt, { live = false } = {}) {
  const h = A.her;
  h.blink -= dt; if (h.blink < -0.12) h.blink = rnd(2, 4.5);
  h.cheer = Math.max(0, h.cheer - dt); h.talk = Math.max(0, h.talk - dt);
  const working = c.uploads.length > 0 || live;
  const spot = deskSpot(c);
  if (working && spot) {
    h.sleep = 0;
    if (h.state !== 'work' || (h.goal && (h.goal.x !== spot.x || h.goal.y !== spot.y))) {
      h.state = 'work'; h.sit = null; h.sleep = 0;
      if (!goTo(c, h, { x: spot.x, y: spot.y })) { h.x = spot.x; h.y = spot.y; h.route = []; }
    }
    if (walk(h, dt, SPEED) && at(h, spot)) { h.sit = spot.seat ? spot.seat.uid : 'desk'; h.face = 1; h.ft += dt; if (h.ft > 0.18) { h.ft = 0; h.f = (h.f + 1) % 2; } }
    return;
  }
  if (h.state === 'work') { h.state = 'idle'; h.sit = null; h.wait = 0.4; }
  if (h.cheer > 0) return;
  if (h.sleep > 0) { h.sleep -= dt; if (h.sleep <= 0) { h.sit = null; h.state = 'idle'; h.wait = 1; const out = freeCell(c, { x: Math.round(h.x), y: Math.round(h.y) }); h.x = out.x; h.y = out.y; } return; }
  if (walk(h, dt, SPEED)) {
    if (h.state === 'toSeat' && h.goal) { h.sit = h.goalUid; h.state = 'seated'; h.wait = rnd(3, 7); }
    else if (h.state === 'toBed' && h.goal) { h.sit = h.goalUid; h.sleep = rnd(5, 9); h.state = 'asleep'; return; }
    else if (h.state !== 'seated') h.state = 'idle';
    h.wait -= dt;
    if (h.wait <= 0) {
      h.sit = null; h.state = 'idle'; h.wait = rnd(1.5, 4);
      const roll = Math.random();
      const seats = c.items.filter((t) => itemOf(t.id).seat && layer(t) === 'floor');
      const beds = c.items.filter((t) => itemOf(t.id).bed);
      if (roll < 0.25 && seats.length) { const s = seats[Math.floor(Math.random() * seats.length)]; const cell = { x: s.x + Math.floor(itemOf(s.id).w / 2), y: s.y + itemOf(s.id).h - 1 }; if (goTo(c, h, cell)) { h.state = 'toSeat'; h.goalUid = s.uid; } }
      else if (roll < 0.36 && beds.length) { const b = beds[0]; const cell = { x: b.x + 1, y: b.y + itemOf(b.id).h - 1 }; if (goTo(c, h, cell)) { h.state = 'toBed'; h.goalUid = b.uid; } }
      else if (roll < 0.5 && A.pets.size) { const p = [...A.pets.values()][0]; const cell = freeCell(c, { x: Math.round(p.x) + 1, y: Math.round(p.y) }); goTo(c, h, cell); }
      else goTo(c, h, freeCell(c, null, Math.random));
    }
  }
  if (!h.route.length && !h.sit) unstick(c, h);
}
// her pose now, for the sprite
export function herPose(A) {
  const h = A.her;
  if (h.sleep > 0) return 'sleep';
  if (h.state === 'work' && h.sit) return `back${h.f % 2}`;
  if (h.cheer > 0) return h.cheer % 0.5 < 0.25 ? 'cheer' : 'stand';
  if (h.route.length) return `walk${h.f}`;
  if (h.sit) return 'sit';
  if (h.talk > 0) return Math.floor(h.talk * 8) % 2 ? 'talk' : 'stand';
  return h.blink < 0 ? 'blink' : 'stand';
}

// ---------- her cat, her robot dog ----------
export function updatePets(A, c, dt) {
  const placed = c.items.filter((t) => itemOf(t.id).pet);
  for (const t of placed) if (!A.pets.has(t.uid)) A.pets.set(t.uid, { uid: t.uid, id: t.id, x: t.x, y: t.y, route: [], face: 1, f: 0, ft: 0, wait: rnd(1, 3), nap: 0 });
  for (const uid of [...A.pets.keys()]) if (!placed.some((t) => t.uid === uid)) A.pets.delete(uid);
  for (const p of A.pets.values()) {
    if (p.nap > 0) { p.nap -= dt; continue; }
    if (walk(p, dt, PET_SPEED)) {
      p.wait -= dt;
      if (p.wait <= 0) {
        p.wait = rnd(2, 6);
        if (p.id === 'cat' && Math.random() < 0.3) { p.nap = rnd(5, 12); continue; }
        goTo(c, p, freeCell(c, null, Math.random));
      }
    }
    if (!p.route.length) unstick(c, p);
  }
}
export const petPose = (p) => (p.id === 'cat' ? (p.nap > 0 ? 'sleep' : p.route.length ? `walk${p.f % 2}` : 'sit') : `walk${p.route.length ? p.f % 2 : 0}`);

// ---------- the spam bots ----------
export function addBot(A, c, id) {
  const home = homeOf(c), y = Math.floor(Math.random() * home.rows);
  const b = { id, x: -1, y, route: [], face: 1, f: 0, ft: 0, wait: 0, leaving: false };
  b.route = [{ x: 0, y }];
  A.bots.set(id, b);
}
export function botLeaves(A, id) { const b = A.bots.get(id); if (b) { b.leaving = true; b.route = [{ x: -2, y: Math.round(b.y) }]; } }
export function updateBots(A, c, dt) {
  for (const b of A.bots.values()) {
    const done = walk(b, dt, BOT_SPEED);
    if (b.leaving) { if (done) A.bots.delete(b.id); continue; }
    if (done) { b.wait -= dt; if (b.wait <= 0) { b.wait = rnd(0.4, 1.6); goTo(c, b, freeCell(c, null, Math.random)); } }
  }
}

// ---------- the drone ----------
export function startDrone(A) { A.drone = { t: 0, dur: TUNE.drone.fly, f: 0 }; }
export function updateDrone(A, dt) { if (A.drone) { A.drone.t += dt; if (A.drone.t > A.drone.dur + 0.5) A.drone = null; } }
// where it is: 0 … 1 across the room
export const droneAt = (A) => (A.drone ? A.drone.t / A.drone.dur : -1);

export function update(A, c, dt, opts = {}) {
  A.t += dt;
  updateHer(A, c, dt, opts);
  updatePets(A, c, dt);
  updateBots(A, c, dt);
  updateDrone(A, dt);
}
