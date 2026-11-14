// GOING LIVE: who moves in her room. AGI-1 walks round what’s in the way, sits at her desk and types while a video is
// being made (from behind, at her screen), cheers when one is out, and when she’s free she lives in her room: she uses
// her things (games at her PC, naps, cooks, paints, waters the plants, dances, hugs a plushie… ./uses.js), now and then
// just wanders. Tap a thing and she goes and uses it. Her cat (and her other pets) wander and nap; the spam bots walk in
// from the left; the fan-mail drone flies across. Positions are in floor cells (x across, y from the wall), fractional
// while walking. Pure but for its dice (Math.random: what she feels like doing is never part of the rules). What she
// starts and finishes comes out of `A.events`.
import { itemOf, homeOf, TUNE } from './data.js';
import { path as findPath, freeCell, deskSpot, layer, blocked } from './room.js';
import { useOf } from './uses.js';

const SPEED = 2.6, PET_SPEED = 1.6, BOT_SPEED = 1.3;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createActors() {
  return {
    her: { x: 4, y: 2, route: [], face: 1, state: 'idle', wait: 1.5, f: 0, ft: 0, blink: 2, cheer: 0, sit: null, sleep: 0, talk: 0, goal: null, task: null, on: null, emote: null, recent: [] },
    pets: new Map(), bots: new Map(), drone: null, t: 0, events: [],
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
  if (from.x === cell.x && from.y === cell.y) { a.route = []; a.goal = cell; return true; }
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
  if (!a.route.length && !a.sit && !a.sleep && !a.on && (Math.round(a.x) !== cell.x || Math.round(a.y) !== cell.y)) { a.x = cell.x; a.y = cell.y; }
}
const inRoom = (c, p) => { const h = homeOf(c); return p.x >= 0 && p.y >= 0 && p.x < h.cols && p.y < h.rows; };

// ---------- where she stands to use a thing ----------
// → { x, y, face: ’back’ | ’front’, sit?, on? } or null
export function useSpot(c, A, it) {
  const def = itemOf(it.id), u = useOf(def.use);
  if (!u) return null;
  const b = blocked(c), free = (p) => inRoom(c, p) && !b.has(`${p.x},${p.y}`);
  const L = layer(it);
  // she dances on a dance floor, but next to a jukebox or a bubble machine (only what’s made for it is stood on)
  const where = u.at === 'on' && L === 'floor' && def.use === 'dance' ? 'near' : u.at;
  // what it stands on, for a small thing (a mic on her desk: in front of the desk)
  const base = L === 'top' ? c.items.find((t) => t.uid === it.on) : it;
  if (!base) return null;
  const bd = itemOf(base.id), bx = base.x, by = layer(base) === 'wall' ? -1 : base.y, bw = bd.w, bh = layer(base) === 'wall' ? 1 : bd.h;
  const mid = bx + Math.floor(bw / 2);
  if (where === 'pet') {
    const p = A.pets.get(it.uid);
    if (!p) return null;
    const cell = freeCell(c, { x: Math.round(p.x) + 1, y: Math.round(p.y) });
    return { x: cell.x, y: cell.y, face: 'front' };
  }
  if (where === 'seat' || where === 'bed') return { x: Math.min(bx + bw - 1, mid), y: by + bh - 1, face: 'front', sit: it.uid };
  if (where === 'on') {
    if (L === 'flat') { const p = { x: mid, y: by + Math.floor(bh / 2) }; return { ...(free(p) ? p : freeCell(c, p)), face: 'front' }; }
    if (L === 'wall') { const p = freeCell(c, { x: mid, y: 0 }); return { x: p.x, y: p.y, face: 'front' }; }
    return { x: mid, y: by + bh - 1, face: 'front', on: it.uid };
  }
  // in front of it (facing it), or beside it (facing us)
  const fronts = [];
  for (let k = 0; k < bw; k++) fronts.push({ x: mid + (k % 2 ? -1 : 1) * Math.ceil(k / 2), y: by + bh });
  const sides = [{ x: bx - 1, y: by + bh - 1 }, { x: bx + bw, y: by + bh - 1 }];
  // in front of it if she can get there, else beside it (then she stands facing us)
  const p = [...fronts, ...sides].find((q) => q.x >= bx - 1 && q.x <= bx + bw && free(q));
  if (p) return { x: p.x, y: p.y, face: where === 'near' || L === 'wall' || p.y < by + bh ? 'front' : 'back' };
  if (where === 'near' || L === 'wall') { const q = freeCell(c, { x: mid, y: Math.max(0, by + bh) }); return { x: q.x, y: q.y, face: 'front' }; }
  return null;
}
// the things she could use now: placed, with something to do, and a way to get there
export function usable(c, A) {
  return c.items.filter((t) => { const d = itemOf(t.id); return d.use && !d.desk && useOf(d.use) && (!d.pet || A.pets.has(t.uid)); });
}
// tapped: she goes and uses it (unless she’s busy) → true if she’s on her way
export function requestUse(A, c, uid) {
  const h = A.her, it = c.items.find((t) => t.uid === uid);
  if (!it || h.state === 'work') return false;
  return startTask(A, c, it);
}
function startTask(A, c, it) {
  const h = A.her, def = itemOf(it.id), u = useOf(def.use);
  const spot = u && useSpot(c, A, it);
  if (!spot) return false;
  endTask(A, false);
  h.sit = null; h.sleep = 0; h.on = null;
  h.task = { uid: it.uid, id: it.id, kind: def.use, spot, left: rnd(u.dur[0], u.dur[1]), started: false };
  if (!goTo(c, h, { x: spot.x, y: spot.y })) { h.task = null; return false; }
  h.state = 'go';
  h.recent = [it.uid, ...h.recent.filter((x) => x !== it.uid)].slice(0, 4);
  return true;
}
function endTask(A, done = true) {
  const h = A.her, t = h.task;
  if (!t) return;
  if (done && t.started) A.events.push({ type: 'used', kind: t.kind, id: t.id, uid: t.uid });
  h.task = null; h.emote = null; h.on = null;
  if (h.sit === t.uid) h.sit = null;
  h.sleep = 0;
}
// what she feels like doing when she’s free: something she hasn’t just done (a nap more likely at night)
function pickTask(A, c, night) {
  const h = A.her, list = usable(c, A);
  if (!list.length) return null;
  const w = list.map((t) => { const k = itemOf(t.id).use; return (h.recent.includes(t.uid) ? 0.15 : 1) * (k === 'nap' ? (night ? 3 : 0.35) : 1) * (k === 'sit' ? 0.6 : 1); });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

// ---------- AGI-1 ----------
export function updateHer(A, c, dt, { live = false, night = false } = {}) {
  const h = A.her;
  h.blink -= dt; if (h.blink < -0.12) h.blink = rnd(2, 4.5);
  h.cheer = Math.max(0, h.cheer - dt); h.talk = Math.max(0, h.talk - dt);
  const working = c.uploads.length > 0 || live;
  const spot = deskSpot(c);
  if (working && spot) {
    if (h.task) endTask(A, false);
    h.sleep = 0; h.on = null;
    if (h.state !== 'work' || (h.goal && (h.goal.x !== spot.x || h.goal.y !== spot.y))) {
      h.state = 'work'; h.sit = null;
      if (!goTo(c, h, { x: spot.x, y: spot.y })) { h.x = spot.x; h.y = spot.y; h.route = []; }
    }
    if (walk(h, dt, SPEED) && at(h, spot)) { h.sit = spot.seat ? spot.seat.uid : 'desk'; h.face = 1; h.ft += dt; if (h.ft > 0.18) { h.ft = 0; h.f = (h.f + 1) % 2; } }
    return;
  }
  if (h.state === 'work') { h.state = 'idle'; h.sit = null; h.wait = 0.5; }
  if (h.cheer > 0 && !h.task) return;
  // a thing she’s on her way to, or using
  if (h.task) {
    const t = h.task, it = c.items.find((x) => x.uid === t.uid);
    if (!it) { endTask(A, false); h.state = 'idle'; h.wait = 0.5; return; }
    if (!t.started) {
      if (!walk(h, dt, SPEED)) return;
      const u = useOf(t.kind);
      t.started = true; h.state = 'task';
      if (t.spot.sit) { h.sit = t.uid; if (u.at === 'bed') h.sleep = t.left; }
      if (t.spot.on) h.on = t.uid;
      h.face = 1;
      h.emote = u.emote || null;
      c.totals.uses = (c.totals.uses || 0) + 1;
      A.events.push({ type: 'use', kind: t.kind, id: t.id, uid: t.uid });
      return;
    }
    // her pet wanders off: she follows a little
    t.left -= dt;
    h.ft += dt; if (h.ft > 0.16) { h.ft = 0; h.f = (h.f + 1) % 4; }
    if (t.left <= 0) { endTask(A, true); h.state = 'idle'; h.wait = rnd(1, 2.5); const out = freeCell(c, { x: Math.round(h.x), y: Math.round(h.y) }); h.x = out.x; h.y = out.y; }
    return;
  }
  if (walk(h, dt, SPEED)) {
    h.state = 'idle';
    h.wait -= dt;
    if (h.wait <= 0) {
      h.wait = rnd(1.2, 3);
      const it = Math.random() < 0.8 ? pickTask(A, c, night) : null;
      if (!(it && startTask(A, c, it))) goTo(c, h, freeCell(c, null, Math.random));
    }
  }
  if (!h.route.length && !h.sit && !h.on) unstick(c, h);
}
// her pose now, for the sprite
export function herPose(A) {
  const h = A.her, t = h.task;
  if (h.state === 'work' && h.sit) return `type${h.f % 2}`;
  if (t && t.started) {
    const u = useOf(t.kind), f = h.f;
    if (u.at === 'bed') return 'sleep';
    if (u.at === 'seat') return h.talk > 0 ? 'talk' : 'sit';
    const p = u.pose;
    if (t.spot.face === 'back' && (p === 'play' || p === 'back' || p === 'paint' || p === 'cook' || p === 'tinker' || p === 'drums')) return p === 'back' ? 'back0' : `${p}${f % 2}`;
    if (p === 'play' || p === 'paint' || p === 'cook' || p === 'tinker' || p === 'drums' || p === 'back') return 'stand';
    if (p === 'dance' || p === 'run') return `${p}${f}`;
    if (p === 'spin') return ['stand', 'walk1', 'back0', 'walk3'][f];
    if (p === 'cheer') return f % 2 ? 'cheer' : 'stand';
    return p;
  }
  if (h.cheer > 0) return h.cheer % 0.5 < 0.25 ? 'cheer' : 'stand';
  if (h.route.length) return `walk${h.f}`;
  if (h.sit) return 'sit';
  if (h.talk > 0) return Math.floor(h.talk * 8) % 2 ? 'talk' : 'stand';
  return h.blink < 0 ? 'blink' : 'stand';
}

// ---------- her pets ----------
export function updatePets(A, c, dt) {
  const placed = c.items.filter((t) => itemOf(t.id).pet);
  for (const t of placed) if (!A.pets.has(t.uid)) A.pets.set(t.uid, { uid: t.uid, id: t.id, x: t.x, y: t.y, route: [], face: 1, f: 0, ft: 0, wait: rnd(1, 3), nap: 0 });
  for (const uid of [...A.pets.keys()]) if (!placed.some((t) => t.uid === uid)) A.pets.delete(uid);
  const h = A.her;
  for (const p of A.pets.values()) {
    // being petted: stays put
    if (h.task && h.task.uid === p.uid && h.task.started) { p.nap = 0; p.route = []; continue; }
    if (p.nap > 0) { p.nap -= dt; continue; }
    if (walk(p, dt, PET_SPEED)) {
      p.wait -= dt;
      if (p.wait <= 0) {
        p.wait = rnd(2, 6);
        if ((p.id === 'cat' || p.id === 'holocat') && Math.random() < 0.3) { p.nap = rnd(5, 12); continue; }
        goTo(c, p, freeCell(c, null, Math.random));
      }
    }
    if (!p.route.length) unstick(c, p);
  }
}
export const petPose = (p) => (p.nap > 0 ? 'sleep' : p.route.length ? `walk${p.f % 2}` : 'sit');

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
// where it is: 0 … 1 across what’s in view
export const droneAt = (A) => (A.drone ? A.drone.t / A.drone.dur : -1);

export function update(A, c, dt, opts = {}) {
  A.t += dt;
  updateHer(A, c, dt, opts);
  updatePets(A, c, dt);
  updateBots(A, c, dt);
  updateDrone(A, dt);
}
export const drainActors = (A) => { const e = A.events; A.events = []; return e; };
