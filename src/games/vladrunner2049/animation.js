// Animation follows the simulation's action windows and distance, never an independent playback timer.
const TAU = Math.PI * 2;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

export function attackAnimation(attack = {}) {
  const duration = Math.max(.01, finite(attack.duration, .32));
  const age = clamp(finite(attack.age, finite(attack.progress) * duration), 0, duration);
  const impactAt = clamp(finite(attack.impactAt, duration * .27), 0, duration);
  const activeUntil = clamp(finite(attack.activeUntil, impactAt + .065), impactAt, duration);
  const contactEnd = Math.min(activeUntil, impactAt + .04);
  const settleAt = activeUntil + (duration - activeUntil) * .4;
  const stage = clamp(Math.floor(finite(attack.stage, attack.kind === 'heavy' ? 3 : 1)), 1, 3);
  // The kick row draws crouch -> raised knee -> extended kick -> settle. The
  // knee belongs before contact; hitstop must hold the extended kicking leg.
  const column = stage === 3
    ? age < impactAt * .48 ? 0 : age < impactAt ? 1 : age < settleAt ? 2 : 3
    : age < impactAt ? 0 : age <= contactEnd ? 1 : age < settleAt ? 2 : 3;
  const windup = impactAt > 0 ? smooth(age / impactAt) : 1;
  const recovery = smooth((age - activeUntil) / Math.max(.01, duration - activeUntil));
  return { frame: (stage - 1) * 4 + column, column, stage,
    phase: age < impactAt ? 'windup' : age <= activeUntil ? 'active' : 'recovery',
    progress: age / duration,
    // A trail marks the live strike, rather than decorating the entire held attack pose.
    trail: age < impactAt ? 0 : age <= activeUntil ? 1 : Math.max(0, 1 - (age - activeUntil) / .08),
    lean: age < impactAt ? -3 * windup : 4 * (1 - recovery),
  };
}

export function heroAnimation(entity = {}) {
  const hurt = finite(entity.hurtTime) > 0 || entity.pose === 'hurt';
  if (entity.dead || hurt) {
    const duration = Math.max(.01, finite(entity.hurtDuration, .24));
    const recoil = clamp(finite(entity.hurtTime) / duration, 0, 1);
    return { suffix: '', frame: 6, fallback: 6, pose: 'hurt', recoil, trail: 0 };
  }
  if (entity.attack?.kind === 'special' || entity.pose === 'special')
    return { suffix: '', frame: 7, fallback: 7, pose: 'special', trail: 0 };
  if (entity.attack) {
    const action = attackAnimation(entity.attack.kind === 'air' ? { ...entity.attack, stage: 3 } : entity.attack);
    return { ...action, suffix: 'Combo', fallback: action.column === 0 || action.column === 3 ? 0 : action.stage === 3 ? 4 : 3, pose: 'attack' };
  }
  if (finite(entity.z) > 6 || entity.pose === 'jump')
    return { suffix: '', frame: 5, fallback: 5, pose: 'jump', trail: 0 };
  if (finite(entity.dodgeTime) > 0)
    return { suffix: 'Run', frame: 2, fallback: 1, pose: 'dodge', trail: 0 };
  if (entity.pose === 'run' && finite(entity.moveSpeed, 1) > .5) {
    const cycle = finite(entity.runCycle, finite(entity.animTime) * 9);
    const phase = ((cycle % TAU) + TAU) % TAU / TAU;
    return { suffix: 'Run', frame: Math.min(7, Math.floor(phase * 8)), fallback: phase < .5 ? 1 : 2, pose: 'run', phase, trail: 0 };
  }
  return { suffix: '', frame: 0, fallback: 0, pose: 'idle', trail: 0 };
}

export function enemyAnimation(entity = {}) {
  if (entity.dead || finite(entity.hurtTime) > 0 || entity.pose === 'hurt' || finite(entity.z) > 6 || finite(entity.landingTime) > 0) {
    const duration = Math.max(.01, finite(entity.hurtDuration, .25));
    const recoil = clamp(finite(entity.hurtTime) / duration, 0, 1);
    const frame = finite(entity.z) > 6 ? 10 : finite(entity.landingTime) > 0 ? 11
      : entity.dead ? finite(entity.deadTime) < .12 ? 9 : 11 : recoil > .74 ? 8 : recoil > .3 ? 9 : 7;
    return { column: 3, frame, pose: 'hurt', recoil, lean: 0, trail: 0 };
  }
  if (entity.telegraph) {
    const duration = Math.max(.01, finite(entity.totalWindup, finite(entity.baseWindup, .7)));
    const progress = 1 - clamp(finite(entity.windup) / duration, 0, 1);
    return { column: 0, frame: 4, pose: 'windup', progress, lean: -8 * smooth(progress), trail: 0 };
  }
  if (finite(entity.attackTime) > 0 || finite(entity.chargeTime) > 0) {
    const duration = Math.max(.01, finite(entity.attackDuration, .36));
    const progress = clamp(1 - finite(entity.attackTime) / duration, 0, 1);
    const charging = finite(entity.chargeTime) > 0;
    return { column: charging || progress < .72 ? 2 : 0, frame: charging ? 6 : progress < .28 ? 5 : progress < .72 ? 6 : 7, pose: 'attack', progress,
      lean: charging ? 11 : 9 * (1 - smooth(progress)), trail: progress < .38 ? 1 - progress / .38 : 0 };
  }
  if (entity.pose === 'run') {
    const cycle = finite(entity.runCycle, finite(entity.animTime) * 9), phase = ((cycle % TAU) + TAU) % TAU / TAU;
    return { column: phase < .5 ? 1 : 0, frame: Math.min(3, Math.floor(phase * 4)), pose: 'run', phase, lean: 0, trail: 0 };
  }
  return { column: 0, frame: 7, pose: 'idle', lean: 0, trail: 0 };
}

export function animationSheet(assets, entity, action) {
  const rightKey = `${entity.kind}${action.suffix}`;
  const leftKey = `${rightKey}Left`;
  const left = entity.face < 0;
  if (action.suffix && assets[left && assets[leftKey] ? leftKey : rightKey]) {
    const key = left && assets[leftKey] ? leftKey : rightKey;
    return { key, frame: action.frame, rows: action.suffix === 'Combo' ? 3 : 2, cols: 4, mirror: left && key !== leftKey };
  }
  const key = left && assets[`${entity.kind}Left`] ? `${entity.kind}Left` : entity.kind;
  return { key, frame: action.fallback, rows: 2, cols: 4, mirror: left && key === entity.kind };
}
