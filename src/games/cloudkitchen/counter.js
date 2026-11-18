import { RECIPES, DAYS, BASES, schedule, toolsFor, randomizer } from './menu.js';
export const STEP = 1 / 60,
  MAX_FILL = 8;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function emptyCup() {
  return {
    target: null,
    base: 0,
    tea: 0,
    milk: 0,
    flow: [0, 0],
    latch: false,
    pearl: 0,
    star: 0,
    ice: 0,
    shake: 0,
    lastShake: -5,
    side: 0,
    wet: -10,
    foam: 0,
    assisted: false
  };
}
const current = (s, i = s.active) => s.cups[i];
export const ticketBy = (s, id) => s.queue.find(t => t.id === id);
export const recipe = (s, i = s.active) => RECIPES[ticketBy(s, current(s, i).target)?.recipe] || null;
export const cupCount = s => s.gear.cups === 2 || s.served >= 3 ? 2 : 1;
const emit = (s, type, details = {}) => s.events.push({
  type,
  ...details
});
export function open(day = 0, mode = 'week', seed = 7, bench = 0, demo = false, known = {}) {
  day = clamp(Math.floor(day) || 0, 0, 7);
  const list = schedule(day, seed, mode === 'daily'),
    gear = toolsFor(day);
  const s = {
    day,
    mode,
    seed,
    dayInfo: DAYS[day],
    gear,
    time: 0,
    phase: 'open',
    active: 0,
    focus: 0,
    queue: [],
    cups: [emptyCup(), emptyCup()],
    held: new Map(),
    plan: list,
    pos: 0,
    next: 0,
    serial: 0,
    rng: randomizer(seed),
    served: 0,
    lost: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    perfect: 0,
    wave: 0,
    peakQueue: 0,
    events: [],
    servedIds: [],
    spilled: 0,
    dispensed: 0,
    receipt: null,
    lastServed: -10,
    batched: 0,
    steep: [9, 9, 0, 0],
    steepLeft: [0, 0, 0, 0],
    earlySeals: 0,
    attempts: 0,
    bench,
    reshuffle: false,
    visits: Object.fromEntries(Object.keys(known).map(g => [g, 1])),
    guestNotes: {},
    nextRush: 45,
    autoShake: 0,
    perfectPours: {},
    demo
  };
  if (mode === 'bench') s.plan = [{
    time: 0,
    recipe: bench,
    guest: 0,
    wave: 0
  }];
  if (demo) s.plan = [{
    time: 0,
    recipe: 9,
    guest: 1,
    wave: 0
  }, {
    time: 0,
    recipe: 11,
    guest: 2,
    wave: 0
  }, ...list.filter(i => i.time > 9)];
  arrival(s);
  assign(s, 0);
  return s;
}
function pushTicket(s, id, guest, wave) {
  const uid = ++s.serial,
    regular = !!s.visits[guest];
  s.visits[guest] = (s.visits[guest] || 0) + 1;
  const limit = s.mode === 'bench' ? 999 : s.mode === 'endless' ? Math.max(14.5, 40 - s.time * .038) : s.dayInfo.patience + (uid === 1 ? 12 : 0);
  const t = {
    id: uid,
    recipe: id,
    guest,
    wave,
    max: limit + Math.min(3, s.streak * .4),
    left: limit + Math.min(3, s.streak * .4),
    regular,
    low: false
  };
  s.queue.push(t);
  s.peakQueue = Math.max(s.peakQueue, s.queue.length);
  if (!s.focus) s.focus = uid;
  emit(s, 'guest', {
    guest,
    regular,
    id: uid
  });
  return t;
}
function arrival(s) {
  if (s.mode === 'endless') {
    if (s.time + 1e-8 < s.next || s.queue.length >= 6) return;
    const level = clamp(Math.floor(s.time / 60) + 2, 2, 7);
    s.gear = toolsFor(level);
    const id = s.serial ? Math.floor(s.rng() * ((level + 1) * 3)) : 2;
    pushTicket(s, id, Math.floor(s.rng() * 12), s.wave);
    const cadence = Math.max(2.15, 11.8 - s.time * .052);
    s.next = s.time + cadence * (.84 + .34 * s.rng()) * (s.wave % 2 ? .86 : 1);
    return;
  }
  while (s.pos < s.plan.length && s.plan[s.pos].time <= s.time + 1e-7 && s.queue.length < 6) {
    const t = s.plan[s.pos++];
    pushTicket(s, t.recipe, t.guest, t.wave);
  }
}
export function assign(s, i = s.active, id = null) {
  const c = current(s, i),
    busy = new Set(s.cups.filter((_, j) => j !== i).map(v => v.target));
  const target = id ? ticketBy(s, id) : s.queue.find(t => !busy.has(t.id));
  if (!target || busy.has(target.id)) return false;
  c.target = target.id;
  if (i === s.active) s.focus = target.id;
  return true;
}
export function qualities(c, r, seal = 1) {
  const level = (x, y) => clamp(1 - Math.abs(x - y) / 1.38, 0, 1);
  const tea = level(c.tea, r.tea),
    milk = level(c.milk, r.milk),
    base = c.base === r.base ? 1 : 0;
  const toppings = clamp(1 - .41 * (Math.abs(c.pearl - r.pearl) + Math.abs(c.star - r.star)), 0, 1),
    ice = c.ice === r.ice ? 1 : 0,
    shake = clamp(1 - Math.abs(c.shake - r.shake) / 4, 0, 1);
  const quality = .24 * tea + .18 * milk + .15 * base + .16 * toppings + .07 * ice + .13 * shake + .07 * seal;
  const values = {
    tea,
    milk,
    base,
    toppings,
    ice,
    shake,
    seal
  };
  const miss = Object.entries(values).sort((a, b) => a[1] - b[1])[0][0];
  return {
    quality,
    tea,
    milk,
    base,
    toppings,
    ice,
    shake,
    seal,
    miss
  };
}
export function sealPhase(s, c = current(s)) {
  const elapsed = Math.max(0, s.time - c.wet);
  if (elapsed < .21 || c.flow[0] + c.flow[1] > .23) return {
    ready: false,
    clean: false,
    fraction: 0
  };
  if (c.assisted) return {
    ready: true,
    clean: true,
    fraction: .60
  };
  const fraction = elapsed % 1.35 / 1.35;
  return {
    ready: fraction >= .33 && fraction <= .92,
    clean: fraction >= .48 && fraction <= .78,
    fraction
  };
}
function stopCup(s, i) {
  for (const [id, owner] of s.held) if (owner === i) s.held.delete(id);
  s.cups[i].latch = false;
}
export function cancel(s) {
  s.held.clear();
  for (const c of s.cups) c.latch = false;
  s.autoShake = 0;
}
function serve(s) {
  const c = current(s),
    t = ticketBy(s, c.target);
  if (!t || c.tea + c.milk < .50) {
    emit(s, 'empty');
    return false;
  }
  const lid = sealPhase(s, c);
  if (!lid.ready) {
    s.earlySeals++;
    emit(s, 'earlySeal');
    return false;
  }
  const r = RECIPES[t.recipe],
    q = qualities(c, r, lid.clean ? 1 : .64);
  s.attempts++;
  if (q.quality < .58 || q.base === 0 || c.tea + c.milk < (r.tea + r.milk) * .53) {
    emit(s, 'reject', {
      miss: q.miss
    });
    return false;
  }
  const perfect = q.quality >= .93,
    hearts = perfect ? 3 : q.quality >= .77 ? 2 : 1;
  const weights = {
    tea: .24,
    milk: .18,
    base: .15,
    toppings: .16,
    ice: .07,
    shake: .13,
    seal: .07
  };
  const parts = {
    service: 65
  };
  for (const [name, weight] of Object.entries(weights)) parts[name] = Math.round(q[name] * 147 * weight);
  parts.patience = Math.round(t.left / t.max * 24);
  parts.streak = Math.min(s.streak, 6) * 8;
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  s.streak = perfect ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.perfect += Number(perfect);
  s.score += score;
  s.served++;
  s.servedIds.push(t.id);
  s.guestNotes[t.guest] = t.recipe;
  s.perfectPours[r.base] = Math.max(s.perfectPours[r.base] || 0, Math.round(q.tea * 100));
  s.receipt = {
    ...q,
    parts,
    id: t.id,
    recipe: t.recipe,
    score,
    hearts,
    guest: t.guest
  };
  s.lastServed = s.time;
  s.queue = s.queue.filter(o => o.id !== t.id);
  stopCup(s, s.active);
  s.cups[s.active] = emptyCup();
  s.focus = s.queue[0]?.id || 0;
  assign(s, s.active);
  emit(s, 'served', {
    perfect,
    hearts,
    score,
    guest: t.guest,
    miss: q.miss
  });
  if (s.streak && s.streak % 5 === 0) emit(s, 'streak');
  if (s.mode === 'bench') {
    s.phase = 'closed';
    emit(s, 'close');
  }
  return true;
}
function relabel(s) {
  const c = current(s);
  if (!s.queue.length) return;
  const old = ticketBy(s, c.target),
    focused = ticketBy(s, s.focus);
  let best = focused && focused.id !== old?.id ? focused : s.queue.reduce((b, t) => qualities(c, RECIPES[t.recipe]).quality > qualities(c, RECIPES[b.recipe]).quality ? t : b, s.queue[0]);
  if (!best || best.id === old?.id) {
    emit(s, 'sameLabel');
    return;
  }
  const other = s.cups.find(v => v !== c && v.target === best.id);
  if (other) other.target = old?.id || null;
  c.target = best.id;
  s.focus = best.id;
  emit(s, 'relabel');
}
function shake(s, c, side) {
  if (s.time - c.lastShake < .19 || c.tea + c.milk < .5 || c.shake >= 10) return;
  if (side && c.side === side) return;
  c.side = side || -c.side || 1;
  c.lastShake = s.time;
  c.shake++;
  c.foam = 1;
  c.wet = s.time;
  emit(s, 'shake', {
    count: c.shake
  });
}
export function act(s, id, phase = 'down') {
  if (phase === 'up') {
    s.held.delete(id);
    return;
  }
  if (s.phase !== 'open') return;
  const c = current(s);
  if (id === 'tea' || id === 'milk' || id === 'shaker') {
    if (s.held.has(id)) return;
    if (id === 'shaker' && !s.gear.shake) return;
    if (!c.target) assign(s);
    s.held.set(id, s.active);
    if (id === 'tea') c.latch = false;
    if (id === 'shaker') {
      shake(s, c, 0);
      s.autoShake = .33;
    } else emit(s, 'valve', {
      id,
      index: s.active
    });
    return;
  }
  if (id === 'switch') {
    if (cupCount(s) < 2) return;
    s.active = 1 - s.active;
    const next = current(s);
    if (!next.target) assign(s);else s.focus = next.target;
    emit(s, 'switch');
    return;
  }
  if (id === 'ticket') {
    const ix = s.queue.findIndex(t => t.id === s.focus);
    s.focus = s.queue[(ix + 1) % Math.max(1, s.queue.length)]?.id || 0;
    emit(s, 'focus');
    return;
  }
  if (id === 'label') {
    relabel(s);
    return;
  }
  if (!c.target) assign(s);
  if (id === 'leaf') {
    if (c.tea > .12) return;
    c.base = (c.base + 1) % s.gear.bases;
    if (s.gear.steep && c.base >= 2 && !s.steep[c.base] && !s.steepLeft[c.base]) {
      s.steepLeft[c.base] = 3.3;
      emit(s, 'steep');
    }
    return;
  }
  if (id === 'latch') {
    c.latch = !c.latch;
    emit(s, 'latch');
    return;
  }
  if (id === 'batch') {
    const a = s.cups[0],
      b = s.cups[1],
      ra = recipe(s, 0),
      rb = recipe(s, 1);
    if (!s.gear.batch || !ra || !rb || ra.base !== rb.base || ra.base !== a.base || a.base !== b.base) {
      emit(s, 'mismatch');
      return;
    }
    const val = !(a.latch && b.latch);
    a.latch = b.latch = val;
    if (val) s.batched++;
    emit(s, 'batch');
    return;
  }
  if (id === 'pearl' || id === 'star' || id === 'ice') {
    if (id === 'star' && !s.gear.star || id === 'ice' && !s.gear.ice) return;
    if (id === 'ice') c.ice = 1 - c.ice;else c[id] = Math.min(6, c[id] + 1);
    c.wet = s.time;
    emit(s, id, {
      count: c[id]
    });
    return;
  }
  if (id === 'left' || id === 'right') {
    if (s.gear.shake) shake(s, c, id === 'left' ? -1 : 1);
    return;
  }
  if (id === 'seal') {
    serve(s);
    return;
  }
  if (id === 'remake') {
    const id = c.target;
    stopCup(s, s.active);
    s.cups[s.active] = {
      ...emptyCup(),
      target: id
    };
    emit(s, 'remake');
    return;
  }
}
export function step(s, dt = STEP) {
  if (s.phase !== 'open') return;
  s.time += dt;
  arrival(s);
  if (s.mode === 'endless') {
    if (s.time >= s.nextRush) {
      s.wave++;
      s.nextRush += 43;
      emit(s, 'wave', {
        wave: s.wave
      });
    }
  } else if (s.mode !== 'bench') {
    const wave = s.dayInfo.breaks.filter(t => s.time >= t).length;
    if (wave !== s.wave) {
      s.wave = wave;
      emit(s, 'wave', {
        wave
      });
    }
  }
  for (let base = 2; base < 4; base++) {
    if (s.steepLeft[base] > 0) {
      s.steepLeft[base] = Math.max(0, s.steepLeft[base] - dt);
      if (s.steepLeft[base] === 0) {
        s.steep[base] = 27;
        emit(s, 'kettle');
      }
    } else if (s.steep[base] > 0) s.steep[base] = Math.max(0, s.steep[base] - dt);
  }
  for (let i = 0; i < 2; i++) {
    const c = current(s, i);
    c.foam = Math.max(0, c.foam - dt * .95);
    const serving = recipe(s, i);
    if ((c.latch || s.held.get('tea') === i) && c.base >= 2 && !s.steep[c.base] && !s.steepLeft[c.base]) s.steepLeft[c.base] = 3.3;
    const inTea = (c.latch || s.held.get('tea') === i) && (c.base < 2 || s.steep[c.base] > 0),
      inMilk = s.held.get('milk') === i;
    const added = [0, 0];
    for (let k = 0; k < 2; k++) {
      const on = k ? inMilk : inTea,
        r = on ? k ? 1.30 : 1.48 : 0,
        rate = on ? 9 : 10,
        exp = Math.exp(-rate * dt),
        last = c.flow[k];
      added[k] = Math.max(0, r * dt + (last - r) * (1 - exp) / rate);
      c.flow[k] = r + (last - r) * exp;
      if (c.flow[k] < .00001) c.flow[k] = 0;
    }
    const amt = added[0] + added[1],
      remain = Math.max(0, MAX_FILL - c.tea - c.milk),
      pct = amt ? Math.min(1, remain / amt) : 1;
    c.tea += added[0] * pct;
    c.milk += added[1] * pct;
    s.dispensed += amt;
    s.spilled += amt * (1 - pct);
    if (amt > .0015) c.wet = s.time;
    if (s.held.get('shaker') === i) {
      s.autoShake -= dt;
      if (s.autoShake <= 0) {
        shake(s, c, 0);
        s.autoShake = .33;
      }
    }
    const assisted = s.day === 0 && s.served === 0 && (s.mode === 'week' || s.mode === 'bench') && serving?.id === 0;
    if (assisted && !c.assisted && !inTea && !inMilk && c.flow[0] < .21 && c.tea >= 1.3) {
      const boost = Math.min(Math.max(0, serving.milk - c.milk), Math.max(0, MAX_FILL - c.tea - c.milk));
      c.milk += boost;
      c.assisted = true;
      s.dispensed += boost;
      c.wet = s.time;
      emit(s, 'assist');
    }
    if (i < cupCount(s) && !c.target && c.tea + c.milk < .01) assign(s, i);
  }
  for (const t of s.queue) {
    if (s.mode === 'bench') continue;
    t.left -= dt;
    if (t.left < t.max * .25 && !t.low) {
      t.low = true;
      emit(s, 'low', {
        guest: t.guest
      });
    }
  }
  const lost = s.queue.filter(t => t.left <= 0);
  if (lost.length) {
    s.lost += lost.length;
    s.streak = 0;
    const ids = new Set(lost.map(t => t.id));
    s.queue = s.queue.filter(t => !ids.has(t.id));
    for (const c of s.cups) if (ids.has(c.target)) c.target = null;
    if (ids.has(s.focus)) s.focus = s.queue[0]?.id || 0;
    emit(s, 'lost', {
      count: lost.length
    });
  }
  if (s.mode === 'endless' && s.lost >= 3 || s.mode !== 'endless' && s.mode !== 'bench' && s.time >= s.dayInfo.length) {
    s.phase = 'closed';
    cancel(s);
    emit(s, 'close');
  }
}
export function drain(s) {
  return s.events.splice(0);
}
