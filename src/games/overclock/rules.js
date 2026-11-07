// OVERCLOCK: the rules (pure: no physics, no DOM). The table's switches come in (a core was hit, a lane rolled over,
// the socket caught a ball…), points, lights and modes come out. The sim (sim.js) feeds it and acts on what it
// answers; the display, the sounds and the effects read the events it leaves in R.fx.
//
//   R-A-M      three rollover lanes at the top; the flipper buttons move the lit ones; all three = bonus ×+1
//   G-P-U      three drop targets; all down = the socket's lock is lit (and the bank comes back up)
//   SOCKET     a lit lock keeps the ball; the second lock starts MULTIBALL (the ramp scores a growing jackpot)
//   OVERCLOCK  every hit warms the board; at full heat, 20 s of double points, then it cools down
//   MISSIONS   one at a time; four done lights AGI MODE at the socket (every shot worth a fortune for 30 s)
import { rng as makeRng } from '../kit/fx.js';

export const BALLS = 3;
export const BALL_SAVE = 8;              // s, from the first time each ball goes through the gate
export const MB_SAVE = 10;               // s of ball save as multiball starts
export const HEAT_MAX = 100;
export const OVERCLOCK_S = 20;
export const COOL_S = 4;
export const AGI_S = 30;
export const BONUS_X_MAX = 6;
export const LOCKS = 2;
export const EXTRA_AT = 2_500_000;       // one extra ball a game
export const TILT_AT = 2.5, DANGER_AT = 1.5, TILT_DECAY = 0.5;
export const JACKPOT0 = 400_000, JACKPOT_STEP = 100_000, JACKPOT_POP = 5_000;

export const POINTS = {
  pop: 1000, sling: 120, spin: 300, lane: 3000, ramAll: 30000, target: 6000, gpuAll: 30000, ramp: 20000, orbit: 15000,
  socket: 25000, lock: 75000, skill: 200000, inlane: 1000, outlane: 5000,
};
// in AGI MODE every shot is lit and worth a fortune
export const AGI_POINTS = {
  pop: 50000, sling: 10000, spin: 10000, lane: 100000, target: 150000, ramp: 500000, orbit: 300000, socket: 400000, inlane: 20000, outlane: 20000,
};
const HEAT = { pop: 3.2, sling: 1, spin: 0.5, lane: 3, target: 4, ramp: 10, orbit: 6, socket: 12, inlane: 1, skill: 20 };

// one mission at a time: `on` is the switch that counts; `each` counts the cores one by one (the least-hit one is the
// progress)
export const MISSIONS = [
  { id: 'cores', name: 'HIT EACH CORE', short: 'CORES', goal: 5, on: 'pop', each: 3 },
  { id: 'fan', name: 'SPIN THE FAN', short: 'FAN', goal: 20, on: 'spin' },
  { id: 'ram', name: 'LIGHT R-A-M', short: 'R-A-M', goal: 2, on: 'ramAll' },
  { id: 'ramp', name: 'PCIE RAMP', short: 'RAMP', goal: 3, on: 'ramp' },
  { id: 'gpu', name: 'CLEAR G-P-U', short: 'G-P-U', goal: 2, on: 'gpuAll' },
  { id: 'orbit', name: 'RUN THE ORBITS', short: 'ORBITS', goal: 3, on: 'orbit' },
  { id: 'socket', name: 'FILL THE SOCKET', short: 'SOCKET', goal: 2, on: 'socket' },
  { id: 'slings', name: 'SLINGSHOTS', short: 'SLINGS', goal: 10, on: 'sling' },
];
export const MISSION_POINTS = (n) => 100_000 + 50_000 * n;     // the nth mission done (0-based) is worth this
export const WIZARD_AFTER = 4;

// the end-of-ball bonus: what each thing counted this ball is worth
export const BONUS = [
  ['ramps', 'RAMPS', 10000], ['lanes', 'R-A-M LANES', 2000], ['targets', 'G-P-U', 3000], ['spins', 'FAN SPINS', 200],
  ['pops', 'CORE HITS', 400], ['missions', 'MISSIONS', 50000],
];

export function createRules(seed = 1) {
  const r = makeRng(seed * 7919 + 13);
  // the first mission teaches the table (the cores are where the ball goes anyway); the rest in a seeded order
  const order = [0, ...r.shuffle([1, 2, 3, 4, 5, 6, 7])];
  const R = {
    score: 0, ball: 1, balls: BALLS, extra: 0, extraAwarded: false,
    bonusX: 1, ram: [false, false, false], skillLane: 1, skillArmed: false,
    gpu: [false, false, false], gpuReset: 0,
    lockLit: false, locked: 0, multiball: false, jackpot: JACKPOT0, jackpots: 0,
    heat: 0, overclock: 0, cool: 0,
    order, missionIx: 0, mission: null, missionBase: null, missionWait: 0, missionsDone: 0, wizard: 0, agiReady: false, agi: 0, agiScore: 0, agiRuns: 0,
    ballSave: 0, saveUsed: false, saveArmed: false, tilt: 0, tilted: false,
    counts: newCounts(), totals: newCounts(), ballTime: 0, longest: 0, launched: false,
    fx: [],
  };
  startMission(R);
  return R;
}
function newCounts() {
  return { ramps: 0, lanes: 0, targets: 0, spins: 0, pops: 0, slings: 0, sockets: 0, orbits: 0, missions: 0, ramAll: 0, gpuAll: 0, cores: [0, 0, 0] };
}
const emit = (R, type, data = {}) => { R.fx.push({ type, ...data }); };

// ---------- points ----------
export const scoreMult = (R) => (R.overclock > 0 ? 2 : 1);
export function addPoints(R, base, why, at) {
  if (R.tilted || base <= 0) return 0;
  const pts = Math.round(base * scoreMult(R));
  R.score += pts;
  if (R.agi > 0) R.agiScore += pts;
  emit(R, 'points', { pts, why, at });
  if (!R.extraAwarded && R.score >= EXTRA_AT) {
    R.extraAwarded = true;
    R.extra++;
    emit(R, 'extraBall');
  }
  return pts;
}
function heat(R, kind) {
  if (R.tilted || R.cool > 0 || R.overclock > 0) return;
  R.heat = Math.min(HEAT_MAX, R.heat + (HEAT[kind] || 0));
  if (R.heat >= HEAT_MAX) {
    R.overclock = OVERCLOCK_S;
    emit(R, 'overclock');
  }
}

// ---------- missions ----------
function startMission(R) {
  const m = MISSIONS[R.order[R.missionIx % R.order.length]];
  R.mission = m;
  R.missionBase = { ...R.totals, cores: R.totals.cores.slice() };
  emit(R, 'missionStart', { mission: m });
}
export function missionProgress(R) {
  const m = R.mission;
  if (!m) return 0;
  if (m.each) return Math.min(...R.totals.cores.map((v, i) => v - R.missionBase.cores[i]));
  const key = { pop: 'pops', spin: 'spins', ramAll: 'ramAll', ramp: 'ramps', gpuAll: 'gpuAll', orbit: 'orbits', socket: 'sockets', sling: 'slings' }[m.on];
  return R.totals[key] - R.missionBase[key];
}
function checkMission(R, kind) {
  const m = R.mission;
  if (!m || R.missionWait > 0 || m.on !== kind || R.tilted) return;
  const p = missionProgress(R);
  emit(R, 'missionTick', { mission: m, progress: Math.min(p, m.goal) });
  if (p < m.goal) return;
  const pts = addPoints(R, MISSION_POINTS(R.missionsDone), 'mission');
  R.missionsDone++;
  R.counts.missions++;
  R.wizard++;
  emit(R, 'missionDone', { mission: m, pts, n: R.missionsDone });
  R.mission = null;
  R.missionIx++;
  if (R.wizard >= WIZARD_AFTER && !R.agiReady && R.agi <= 0) { R.agiReady = true; emit(R, 'agiReady'); }
  R.missionWait = 2.5;
}

// ---------- switches ----------
// the sim tells the rules what the ball did; → what the sim should do about it (only the socket answers)
export function hit(R, kind, ref = 0, at = null) {
  if (R.tilted) return null;
  const agi = R.agi > 0;
  const base = agi && AGI_POINTS[kind] != null ? AGI_POINTS[kind] : POINTS[kind] || 0;
  if (kind !== 'lane' && kind !== 'spin') R.skillArmed = false;
  switch (kind) {
    case 'pop':
      R.counts.pops++; R.totals.pops++; R.counts.cores[ref]++; R.totals.cores[ref]++;
      if (R.multiball) R.jackpot += JACKPOT_POP;
      addPoints(R, base, 'pop', at); heat(R, 'pop');
      break;
    case 'sling':
      R.counts.slings++; R.totals.slings++;
      addPoints(R, base, 'sling', at); heat(R, 'sling');
      break;
    case 'spin':
      R.counts.spins++; R.totals.spins++;
      addPoints(R, base, 'spin', at); heat(R, 'spin');
      break;
    case 'lane': return lane(R, ref, base, at);
    case 'target': return target(R, ref, base, at);
    case 'ramp': {
      R.counts.ramps++; R.totals.ramps++;
      addPoints(R, base, 'ramp', at); heat(R, 'ramp');
      if (R.multiball) {
        const v = addPoints(R, R.jackpot, 'jackpot', at);
        R.jackpots++;
        emit(R, 'jackpot', { pts: v, n: R.jackpots });
        R.jackpot += JACKPOT_STEP;
      }
      break;
    }
    case 'orbit':
      R.counts.orbits++; R.totals.orbits++;
      addPoints(R, base, 'orbit', at); heat(R, 'orbit');
      break;
    case 'inlane': addPoints(R, base, 'inlane', at); heat(R, 'inlane'); break;
    case 'outlane': addPoints(R, base, 'outlane', at); break;
    default: break;
  }
  checkMission(R, kind);
  return null;
}
function lane(R, i, base, at) {
  R.counts.lanes++; R.totals.lanes++;
  if (R.skillArmed) {
    R.skillArmed = false;
    if (i === R.skillLane) { addPoints(R, POINTS.skill, 'skill', at); heat(R, 'skill'); emit(R, 'skill', { lane: i }); }
  }
  addPoints(R, R.ram[i] ? Math.round(base / 3) : base, 'lane', at); heat(R, 'lane');
  if (!R.ram[i]) {
    R.ram[i] = true;
    emit(R, 'laneLit', { lane: i });
    if (R.ram.every(Boolean)) {
      R.ram = [false, false, false];
      R.counts.ramAll++; R.totals.ramAll++;
      R.bonusX = Math.min(BONUS_X_MAX, R.bonusX + 1);
      addPoints(R, POINTS.ramAll, 'ramAll', at);
      emit(R, 'ramAll', { bonusX: R.bonusX });
      checkMission(R, 'ramAll');
    }
  }
  return null;
}
function target(R, i, base, at) {
  if (R.gpu[i]) return null;
  R.gpu[i] = true;
  R.counts.targets++; R.totals.targets++;
  addPoints(R, base, 'target', at); heat(R, 'target');
  emit(R, 'targetDown', { target: i });
  if (R.gpu.every(Boolean)) {
    R.counts.gpuAll++; R.totals.gpuAll++;
    addPoints(R, R.agi > 0 ? AGI_POINTS.target : POINTS.gpuAll, 'gpuAll', at);
    if (!R.multiball && !R.lockLit) { R.lockLit = true; emit(R, 'lockLit', { lock: R.locked + 1 }); } else emit(R, 'gpuAll');
    R.gpuReset = 1.4;
    checkMission(R, 'gpuAll');
  }
  return null;
}

// the socket caught a ball → 'agi' (starts AGI MODE) | 'lock' (keep it, serve another) | 'multiball' | 'kick'
export function socket(R, at = null) {
  if (R.tilted) return 'kick';
  R.counts.sockets++; R.totals.sockets++;
  R.skillArmed = false;
  let out = 'kick';
  if (R.agiReady && !R.multiball) {
    R.agiReady = false;
    R.agi = AGI_S; R.agiScore = 0; R.agiRuns++;
    R.wizard = 0;
    emit(R, 'agiStart');
    addPoints(R, AGI_POINTS.socket, 'socket', at);
    out = 'agi';
  } else if (R.lockLit && !R.multiball) {
    R.lockLit = false;
    R.locked++;
    addPoints(R, POINTS.lock, 'lock', at); heat(R, 'socket');
    if (R.locked >= LOCKS) {
      R.locked = 0;
      R.multiball = true;
      R.jackpot = Math.max(R.jackpot, JACKPOT0);
      R.ballSave = Math.max(R.ballSave, MB_SAVE);
      emit(R, 'multiball');
      out = 'multiball';
    } else {
      emit(R, 'lock', { n: R.locked });
      out = 'lock';
    }
  } else {
    addPoints(R, R.agi > 0 ? AGI_POINTS.socket : POINTS.socket, 'socket', at); heat(R, 'socket');
    emit(R, 'socketAward');
  }
  checkMission(R, 'socket');
  return out;
}

// a flipper button: the lit R-A-M lanes move with it (and the skill shot's lane, while a ball waits to be plunged)
export function flipperPress(R, side, waiting = false) {
  if (R.tilted) return;
  const d = side === 'L' ? -1 : 1;
  const rot = (a) => (d < 0 ? [a[1], a[2], a[0]] : [a[2], a[0], a[1]]);
  if (R.ram.some(Boolean) && !R.ram.every(Boolean)) R.ram = rot(R.ram);
  if (waiting) R.skillLane = (R.skillLane + d + 3) % 3;
}

// a ball went through the gate
export function launched(R) {
  R.launched = true;
  if (!R.saveArmed && !R.saveUsed) { R.saveArmed = true; R.ballSave = Math.max(R.ballSave, BALL_SAVE); }
}
export function armSkill(R) { R.skillArmed = true; }

// a ball drained (ballsLeft: how many are still in play without it) → 'saved' (give it back) | 'gone'
export function drain(R, ballsLeft) {
  if (!R.tilted && R.ballSave > 0) {
    if (!R.multiball) R.saveUsed = true;
    emit(R, 'saved');
    return 'saved';
  }
  if (R.multiball && ballsLeft <= 1) { R.multiball = false; emit(R, 'multiballEnd', { jackpots: R.jackpots }); }
  return 'gone';
}

// a shake of the table → 'ok' | 'danger' | 'tilt'
export function nudge(R) {
  if (R.tilted) return 'tilt';
  R.tilt += 1;
  if (R.tilt >= TILT_AT) {
    R.tilted = true;
    R.overclock = 0; R.skillArmed = false;
    emit(R, 'tilt');
    return 'tilt';
  }
  if (R.tilt >= DANGER_AT) { emit(R, 'danger'); return 'danger'; }
  return 'ok';
}

// the clock (only while a ball is in play)
export function tick(R, dt, { inPlay = true } = {}) {
  R.tilt = Math.max(0, R.tilt - TILT_DECAY * dt);
  if (!inPlay) return;
  R.ballTime += dt;
  if (R.ballSave > 0 && R.launched) R.ballSave = Math.max(0, R.ballSave - dt);
  if (R.overclock > 0) {
    R.overclock -= dt;
    R.heat = HEAT_MAX * Math.max(0, R.overclock / OVERCLOCK_S);
    if (R.overclock <= 0) { R.overclock = 0; R.cool = COOL_S; R.heat = 0; emit(R, 'overclockEnd'); }
  } else if (R.cool > 0) R.cool = Math.max(0, R.cool - dt);
  if (R.agi > 0) {
    R.agi -= dt;
    if (R.agi <= 0) { R.agi = 0; emit(R, 'agiEnd', { pts: R.agiScore }); }
  }
  if (R.missionWait > 0) {
    R.missionWait -= dt;
    if (R.missionWait <= 0) { R.missionWait = 0; startMission(R); }
  }
}
// the G-P-U bank wants to come back up (the sim raises it once no ball is in the way) → true when it's time
export function gpuDue(R, dt) {
  if (R.gpuReset <= 0) return false;
  R.gpuReset -= dt;
  return R.gpuReset <= 0;
}
export function gpuUp(R) { R.gpu = [false, false, false]; R.gpuReset = 0; emit(R, 'gpuReset'); }

// the end of a ball: its bonus, line by line (nothing if it tilted)
export function bonusLines(R) {
  if (R.tilted) return { lines: [], total: 0, x: R.bonusX };
  const lines = BONUS.map(([k, label, each]) => ({ label, n: R.counts[k], each, pts: R.counts[k] * each })).filter((l) => l.n > 0);
  const sub = lines.reduce((s, l) => s + l.pts, 0);
  return { lines, sub, x: R.bonusX, total: sub * R.bonusX };
}
// …and on to the next: → 'again' (an extra ball: the same ball number) | 'next' | 'over'
export function endBall(R) {
  const b = bonusLines(R);
  if (b.total > 0) { R.score += b.total; if (!R.extraAwarded && R.score >= EXTRA_AT) { R.extraAwarded = true; R.extra++; emit(R, 'extraBall'); } }
  R.longest = Math.max(R.longest, R.ballTime);
  R.ballTime = 0;
  R.counts = newCounts();
  R.bonusX = 1;
  R.ballSave = 0; R.saveUsed = false; R.saveArmed = false; R.launched = false;
  R.tilt = 0;
  R.multiball = false;
  R.overclock = 0; R.cool = 0; R.heat = Math.min(R.heat, HEAT_MAX * 0.6);
  R.agi = 0;
  R.skillArmed = false;
  const wasTilted = R.tilted;
  R.tilted = false;
  if (R.extra > 0) { R.extra--; emit(R, 'shootAgain'); return { ...b, next: 'again', tilted: wasTilted }; }
  if (R.ball >= R.balls) return { ...b, next: 'over', tilted: wasTilted };
  R.ball++;
  return { ...b, next: 'next', tilted: wasTilted };
}
