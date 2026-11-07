// I'M NOT A ROBOT: one run, as a pure state machine (no DOM, no canvas, no sound: tests/notarobot.test.js runs it in
// Node). A run is a chain of checks: a bumper (the next command slams in), the check itself (its fuse burning), the
// stamp (VERIFIED HUMAN or SUSPICIOUSLY ROBOTIC), then the next one. Every 5 passes the tempo goes up; every 15 a boss
// (FINAL VERIFICATION: three harder checks on one fuse; passing it repairs a suspicion light). The fourth suspicion
// light and she's caught. The screen reads the run and its `events` (drained each frame); input comes in through
// `ptr()` and `key()`, the same for a player's finger, a mouse, the keyboard and the demo's drawn hand.
import { rng } from '../kit/fx.js';
import { createBag } from './bag.js';
import * as TP from './tempo.js';

export class Run {
  constructor({ seed = 1, checks, tempo = 1, passed = 0, score = 0, suspicion = 0, demo = false, first = null, startDelay = null, touch = false } = {}) {
    this.r = rng(seed >>> 0 || 1);
    this.checks = checks;
    this.byId = new Map(checks.map((c) => [c.id, c]));
    this.bag = createBag(checks.map((c) => c.id), rng(((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 3), first);
    this.demo = demo;
    this.tempo = tempo;
    this.passed = passed;
    this.score = score;
    this.sus = suspicion;
    this.bosses = 0;
    this.fastest = Infinity;
    this.streak = 0;
    this.bestStreak = 0;
    this.fails = 0;
    this.played = 0;
    this.cur = null;         // the check on the screen: { def, st, level, T, el, boss, step }
    this.boss = null;        // a boss in progress: { ids, idx, T, el }
    this.queue = [];         // what comes before the next check: 'tempo', 'boss'
    this.caught = false;
    this.ended = false;
    this.events = [];
    this.last = null;        // the last result: { pass, bonus, label, why, points }
    this.time = 0;
    this.kb = false;          // the player is on the keyboard: checks show their selection from the start
    this.touch = touch;       // a touchscreen: checks show their touch hints from the start
    this.io = {
      px: -999, py: -999, pdown: false, ptype: 'mouse', heldSet: new Set(),
      held: (n) => this.io.heldSet.has(n),
    };
    this.setPhase('start', startDelay ?? (demo ? 0.25 : 0.85));
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  setPhase(name, dur = 0) { this.phase = name; this.pt = 0; this.pd = dur; }
  get T() { return this.boss ? this.boss.T : this.cur ? this.cur.T : 1; }
  get el() { return this.boss ? this.boss.el : this.cur ? this.cur.el : 0; }
  // the fuse: 1 → 0 while a check runs
  get left() { return Math.max(0, 1 - this.el / this.T); }
  get playing() { return this.phase === 'play' && this.cur && !this.cur.st.done; }

  make(def, level, T, boss = false, step = 0) {
    const r = rng(this.r.int(1, 2 ** 31 - 2));
    const st = def.setup(level, r, { T, tempo: this.tempo, speed: TP.speedOf(this.tempo), boss, kb: this.kb, touch: this.touch });
    st.fx = st.fx || [];
    st.done = null;
    st.t = 0;
    st.anim = 0;
    st.level = level;
    this.played++;
    return { def, st, level, T, el: 0, boss, step };
  }

  // ---------- the clock ----------
  update(dt) {
    this.time += dt;
    this.pt += dt;
    const c = this.cur;
    // pictures keep moving between checks (the stamp sits on a living check)
    if (c && this.phase !== 'play') { c.st.anim += dt; c.def.idle?.(c.st, dt); }
    switch (this.phase) {
      case 'start': if (this.pt >= this.pd) this.next(); break;
      case 'bumper': if (this.pt >= this.pd) this.setPhase('play'); break;
      case 'step': if (this.pt >= this.pd) this.setPhase('play'); break;
      case 'play': this.play(dt); break;
      case 'result': if (this.pt >= this.pd) this.afterResult(); break;
      case 'tempo': if (this.pt >= this.pd) this.special(); break;
      case 'bossIntro': if (this.pt >= this.pd) this.bossStep(0); break;
      case 'caught': if (this.pt >= this.pd) { this.setPhase('done'); this.ended = true; this.emit('end'); } break;
      default: break;
    }
  }

  play(dt) {
    const c = this.cur;
    if (!c) return;
    const st = c.st;
    c.el += dt;
    st.t = c.el;
    st.anim += dt;
    if (this.boss) this.boss.el += dt;
    if (!st.done) c.def.update?.(st, dt, this.io);
    if (st.done === 'pass') { this.stepPassed(); return; }
    if (st.done === 'fail') { this.resolve(false, st.why || 'wrong'); return; }
    if (this.el >= this.T) {
      if (c.def.passOnTimeout && !this.boss) { st.done = 'pass'; this.resolve(true); }
      else { st.done = 'fail'; st.why = 'time'; this.resolve(false, 'time'); }
    }
  }

  // ---------- what comes next ----------
  next() {
    const id = this.bag.next();
    const def = this.byId.get(id);
    const level = TP.levelFor(this.tempo, this.r);
    this.cur = this.make(def, level, TP.gameTime(this.tempo, def.time ?? 1));
    this.setPhase('bumper', TP.bumperTime(this.tempo));
    this.emit('bumper', { id, level });
  }
  special() {
    const q = this.queue.shift();
    if (q === 'tempo') {
      this.tempo = Math.min(TP.MAX_TEMPO, this.tempo + 1);
      this.setPhase('tempo', 1.25);
      this.emit('tempo', { tempo: this.tempo });
      return;
    }
    if (q === 'boss') {
      this.setPhase('bossIntro', 1.7);
      this.emit('bossIntro');
      return;
    }
    this.next();
  }
  bossStep(i) {
    if (i === 0) {
      const ok = (id) => this.byId.get(id).boss !== false;
      const ids = [];
      for (let k = 0; k < 3; k++) ids.push(this.bag.next(ok, ids));
      this.boss = { ids, idx: 0, T: TP.bossTime(this.tempo), el: 0 };
    }
    const id = this.boss.ids[i];
    const def = this.byId.get(id);
    this.boss.idx = i;
    this.cur = this.make(def, 3, this.boss.T / 3, true, i);
    if (i === 0) {
      this.setPhase('bumper', TP.bumperTime(this.tempo) + 0.25);
      this.emit('bumper', { id, level: 3, boss: true, step: 0 });
    } else {
      this.setPhase('step', 0.55);
      this.emit('step', { id, step: i });
    }
  }
  stepPassed() {
    if (this.boss && this.boss.idx < this.boss.ids.length - 1) {
      this.emit('stepPass', { step: this.boss.idx });
      this.bossStep(this.boss.idx + 1);
      return;
    }
    this.resolve(true);
  }

  // ---------- a check is over ----------
  resolve(pass, why = null) {
    const c = this.cur;
    const boss = Boolean(this.boss);
    this.setPhase('result', TP.stampTime(this.tempo) + (boss ? 0.45 : 0));
    if (pass) {
      this.passed++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      let bonus = 0, label = '', repaired = false;
      if (boss) {
        bonus = TP.BOSS_BONUS; label = 'BOSS BONUS';
        this.bosses++;
        if (this.sus > 0) { this.sus--; repaired = true; }
      } else if (!c.def.noBonus) {
        ({ bonus, label } = TP.speedBonus(c.el, c.T));
        this.fastest = Math.min(this.fastest, c.el);
      }
      const points = TP.PASS_POINTS + bonus;
      this.score += points;
      this.last = { pass: true, bonus, label, points, boss, repaired };
      this.emit('pass', { ...this.last, passed: this.passed });
      if (this.passed % TP.TEMPO_EVERY === 0 && this.tempo < TP.MAX_TEMPO) this.queue.push('tempo');
      if (this.passed % TP.BOSS_EVERY === 0 && !boss) this.queue.push('boss');
    } else {
      this.sus++;
      this.fails++;
      this.streak = 0;
      this.last = { pass: false, why, boss, points: 0, bonus: 0, label: '' };
      this.emit('fail', { why, sus: this.sus, boss });
      if (this.sus >= TP.LIGHTS) this.caught = true;
    }
  }
  afterResult() {
    this.boss = null;
    if (this.caught) {
      this.setPhase('caught', 2.1);
      this.emit('caught');
      return;
    }
    this.special();
  }

  // ---------- input (a finger, a mouse, the keyboard or the demo's hand: all the same) ----------
  // kind: 'down' | 'move' | 'up' | 'hover' | 'leave'; x, y in the check's own units (400 × 360)
  ptr(kind, x, y, type = 'mouse') {
    const io = this.io;
    if (kind === 'leave') { io.px = -999; io.py = -999; io.pdown = false; return; }
    io.px = x; io.py = y; io.ptype = type;
    if (kind === 'down') io.pdown = true;
    if (kind === 'up') io.pdown = false;
    if (!this.playing) return;
    const { def, st } = this.cur;
    if (kind === 'down') def.down?.(st, x, y, type, io);
    else if (kind === 'move') def.move?.(st, x, y, type, io);
    else if (kind === 'up') def.up?.(st, x, y, type, io);
    else if (kind === 'hover') def.hover?.(st, x, y, type, io);
  }
  // name: 'left' | 'right' | 'up' | 'down' | 'act' | 'k:A'… | 'n:1'…
  key(name, down = true) {
    const io = this.io;
    if (down) io.heldSet.add(name); else io.heldSet.delete(name);
    if (!this.playing) return false;
    const { def, st } = this.cur;
    if (down) return def.key?.(st, name, io) !== false;
    def.keyUp?.(st, name, io);
    return true;
  }
  releaseAll() {
    this.io.heldSet.clear();
    this.io.pdown = false;
  }

  // the end card's numbers
  stats() {
    return {
      score: this.score,
      passed: this.passed,
      tempo: this.tempo,
      bosses: this.bosses,
      fastest: Number.isFinite(this.fastest) ? this.fastest : null,
      bestStreak: this.bestStreak,
      fails: this.fails,
    };
  }
}
