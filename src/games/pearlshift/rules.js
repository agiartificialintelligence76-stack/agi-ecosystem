import { SPECIES, REGIONS, SHIFTS, hash, unit } from './catalog.js';
import { clamp, hearing, position, bestFix } from './acoustics.js';
export function createSurvey({
  mode = 'calm',
  seed = 7,
  start = 0,
  preview = false
} = {}) {
  const s = {
    mode,
    seed: seed >>> 0,
    preview,
    start: clamp(start | 0, 0, 31),
    watch: 0,
    part: 0,
    total: 0,
    score: 0,
    stamps: [],
    archive: [],
    mistakes: 0,
    spent: 0,
    perfect: 0,
    time: 0,
    age: 0,
    tick: 0,
    battery: 86,
    receiver: {
      x: .25,
      y: .72,
      depth: 0
    },
    cursor: {
      x: .25,
      y: .72
    },
    events: [],
    samples: [],
    phase: 'scan',
    reveal: 0,
    ended: false,
    serial: 0,
    lastPing: -10
  };
  deploy(s);
  return s;
}
function deploy(s) {
  const idx = s.mode === 'calm' ? clamp(s.start + s.watch, 0, 31) : s.mode === 'daily' ? ((hash(s.seed, 13) % 6 + 2) * 4 + s.watch) % 32 : Math.min(31, Math.floor(s.total / 2) * 2 + s.watch % 2);
  s.shift = SHIFTS[idx];
  s.region = REGIONS[s.shift.region];
  const tutorial = s.mode === 'calm' && idx === 0 && s.part === 0 || s.preview && s.total === 0;
  const salt = s.serial++ * 71 + 73,
    voiceCount = tutorial ? 1 : Math.min(4, s.region.voices + (s.shift.part === 3 ? 1 : 0));
  const species = tutorial ? 0 : s.mode === 'calm' ? (s.shift.id * 3 + s.part + hash(s.seed, s.shift.id) % 3) % 12 : hash(s.seed, salt + 2) % 12;
  s.fish = [];
  const used = new Set();
  for (let i = 0; i < voiceCount; i++) {
    let sp = i === 0 ? species : hash(s.seed, salt + 19 + i) % SPECIES.length;
    while (used.has(sp)) sp = (sp + 1) % SPECIES.length;
    used.add(sp);
    const f = {
      species: sp,
      x: tutorial ? .69 : .20 + unit(s.seed, salt + 7 * i) * .60,
      y: tutorial ? .42 : .19 + unit(s.seed, salt + 7 * i + 1) * .58,
      depth: s.region.id < 3 ? 0 : hash(s.seed, salt + 7 * i + 2) % 3,
      ax: .028 + s.region.speed * .11,
      ay: .019 + s.region.speed * .10,
      speed: tutorial || s.region.id < 2 ? 0 : .11 + s.region.speed * .24,
      phase: unit(s.seed, salt + 7 * i + 4) * 6.28
    };
    if (f.speed === 0) {
      f.ax = 0;
      f.ay = 0;
    }
    s.fish.push(f);
  }
  s.request = species;
  s.tuned = tutorial ? species : s.fish[hash(s.seed, salt + 24) % voiceCount].species;
  s.contacts = [...s.fish.map(f => f.species)].sort((a, b) => a - b);
  s.budget = s.mode === 'calm' ? Math.max(4, 7 - Math.floor(s.region.id / 3)) : Math.max(3, 6 - Math.floor(s.region.id / 3));
  s.receiver = {
    x: .25,
    y: .72,
    depth: 0
  };
  s.cursor = {
    x: .25,
    y: .72
  };
  s.samples = [];
  s.scanPings = 0;
  s.scanMisses = 0;
  s.age = 0;
  s.tick = 0;
  s.lastPing = -10;
  s.phase = 'scan';
  s.events.push({
    type: 'station',
    tutorial
  });
  if (tutorial) {
    ping(s, true);
    s.events.push({
      type: 'lesson'
    });
  }
}
export function move(s, x, y) {
  if (s.ended || s.phase !== 'scan') return;
  s.cursor = {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1)
  };
  s.receiver.x = s.cursor.x;
  s.receiver.y = s.cursor.y;
}
export function depth(s, direction = 1) {
  if (s.ended || s.phase !== 'scan') return;
  s.receiver.depth = (s.receiver.depth + direction + 3) % 3;
  s.events.push({
    type: 'depth'
  });
}
export function tune(s) {
  if (s.ended || s.phase !== 'scan') return;
  s.tuned = s.contacts[(s.contacts.indexOf(s.tuned) + 1) % s.contacts.length];
  s.events.push({
    type: 'tune'
  });
}
export function observations(s) {
  return s.fish.map(f => hearing(s.receiver, f, s.age, s.region));
}
export function ping(s, free = false) {
  if (s.ended || s.phase !== 'scan' || s.age - s.lastPing < .25) return false;
  if (!free && s.budget <= 0) {
    s.events.push({
      type: 'empty'
    });
    return false;
  }
  const previous = s.samples.at(-1);
  if (previous && previous.species === s.tuned && previous.depth === s.receiver.depth && Math.hypot(previous.x - s.receiver.x, previous.y - s.receiver.y) < .064 && s.age - previous.time < 3) {
    s.events.push({
      type: 'baseline'
    });
    return false;
  }
  const obs = observations(s).find(v => v.species === s.tuned);
  const sample = {
    x: s.receiver.x,
    y: s.receiver.y,
    depth: s.receiver.depth,
    theta: obs.theta,
    species: s.tuned,
    time: s.age,
    weak: obs.layers !== 0
  };
  s.samples.push(sample);
  if (s.samples.length > 9) s.samples.shift();
  s.lastPing = s.age;
  if (!free) {
    s.budget--;
    s.scanPings++;
    s.spent++;
    if (s.mode === 'night') s.battery -= .6;
  }
  s.events.push({
    type: 'ping',
    sample,
    fix: bestFix(s.samples, s.tuned)
  });
  return true;
}
export function broadcast(s) {
  if (s.ended || s.phase !== 'scan') return false;
  const target = s.fish.find(f => f.species === s.request),
    at = position(target, s.age),
    distance = Math.hypot(at.x - s.cursor.x, at.y - s.cursor.y);
  const fix = bestFix(s.samples.filter(p => p.depth === s.receiver.depth), s.tuned);
  const reason = s.tuned !== s.request ? 'voice' : s.receiver.depth !== target.depth ? 'layer' : !fix ? 'baseline' : distance > .083 ? 'position' : null;
  if (reason) {
    s.scanMisses++;
    s.mistakes++;
    if (s.mode === 'night') s.battery -= 6;
    s.events.push({
      type: 'miss',
      reason
    });
    if (s.scanMisses >= 3 && s.mode !== 'calm') abandon(s);
    return false;
  }
  const exact = distance < .038 && s.scanMisses === 0;
  s.perfect += Number(exact);
  s.total++;
  s.score += Math.max(80, 260 + Math.round((.083 - distance) * 780) + s.budget * 20 + (exact ? 68 : 0) - s.scanMisses * 24);
  s.archive.push({
    species: s.request,
    region: s.region.id,
    exact,
    pings: s.scanPings
  });
  s.reveal = 1.7;
  s.phase = 'found';
  if (s.mode === 'night') s.battery = Math.min(118, s.battery + Math.max(5, 16 - s.total * .34));
  s.events.push({
    type: 'found',
    exact,
    at
  });
  return true;
}
export function abandon(s) {
  if (s.ended || s.phase !== 'scan') return;
  if (s.mode === 'night') s.battery -= 6;
  s.phase = 'passed';
  s.reveal = .54;
  s.events.push({
    type: 'abandon'
  });
}
export function finish(s, reason = 'file') {
  if (s.ended) return;
  s.ended = true;
  s.phase = 'over';
  s.events.push({
    type: 'end',
    reason
  });
}
function next(s) {
  const found = s.phase === 'found';
  if (found || s.mode !== 'calm') s.part++;
  if (s.part >= s.shift.quota) {
    s.stamps.push(s.shift.id);
    s.events.push({
      type: 'stamp',
      id: s.shift.id
    });
    s.watch++;
    s.part = 0;
    if (s.mode === 'calm' && s.start + s.watch >= 32 || s.mode === 'daily' && s.watch >= 3) {
      finish(s, 'complete');
      return;
    }
  }
  deploy(s);
}
export function step(s, dt) {
  if (s.ended) return;
  s.time += dt;
  s.age += dt;
  s.tick -= dt;
  if (s.mode === 'night') {
    s.battery -= dt;
    if (s.battery <= 0) {
      finish(s, 'dawn');
      return;
    }
  }
  if (s.phase === 'found' || s.phase === 'passed') {
    s.reveal -= dt;
    if (s.reveal <= 0) next(s);
    return;
  }
  if (s.tick <= 0) {
    s.tick = 2.72;
    s.events.push({
      type: 'call',
      observed: observations(s)
    });
  }
}
export function drain(s) {
  return s.events.splice(0);
}
