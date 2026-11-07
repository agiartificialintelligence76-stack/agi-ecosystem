// BEAT THE AGI (2026-11-08): one game on the board, as a state machine with its animations' numbers (no DOM, no
// canvas, no sound: those are hooks), so the page, the ?demo, the title's quiet game and the demo's tools all run the
// very same game.
//
//   phases: idle → input (a person's turn) | aim (the demo's pink player choosing) | think (AGI-1 looking deeper and
//           deeper) → commit (her pick flashes) → fall (the stone drops, bounces, clacks) → … → end
//
// Hooks: think(req) (asks the brain; req.onDepth / req.onDone feed it back), sfx(name, …args), shake(amount),
// haptic(ms), line(kind, vars) → text or null (she speaks), ended(result), toast(text, tone), announce(text), confetti(),
// pick(list) (a die: seeded in the demo).
import { emptyBoard, landing, lineThrough, isFull, threatsNow, PINK, MINT, other, at } from './rules.js';
import { LEVELS, attention, verdict } from './levels.js';
import { MATE } from './engine.js';
import { DROP_AT } from './layout.js';

export const DROP_ROW = DROP_AT;       // the drop zone, in rows above the bottom row (row 0 is 0)
const GRAVITY = 96;                    // rows per second², so a stone falls the whole board in about 0.37 s
const END_DELAY = 1.35;                // from the four to the result card
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Match {
  constructor(o = {}) {
    this.mode = o.mode || 'ladder';                 // ladder · pp (pass & play) · demo · attract (the title's)
    this.level = o.level ?? 0;                      // AGI-1's level (mint)
    this.pinkLevel = o.pinkLevel ?? 3;              // demo / attract: the level playing pink for "you"
    this.humans = o.humans || { [PINK]: this.mode === 'ladder' || this.mode === 'pp', [MINT]: this.mode === 'pp' };
    this.hooks = o.hooks || {};
    this.cells = o.cells ? o.cells.slice() : emptyBoard();
    this.turn = o.turn ?? PINK;
    this.seed = (o.seed >>> 0) || 1;
    this.pace = { think: 1, aim: 1, ...(o.pace || {}) };
    this.speed = 1;
    this.t = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.hover = -1;                                // the column a person points at
    this.gx = 3;                                    // the ghost stone's column (smooth)
    this.ghost = 0;                                 // its opacity
    this.aimCol = -1;
    this.fall = null;
    this.hidden = -1;                               // the cell of the stone still falling (not drawn in place yet)
    this.winner = 0;                                // 1 pink, 2 mint, 3 a draw
    this.line = null;
    this.history = [];
    this.think = null;
    this.bars = new Float32Array(7);
    this.barTo = new Float32Array(7);
    this.barKind = new Int8Array(7);                // 1 a proven win, -1 a proven loss
    this.barShow = 0;
    this.jit = new Float32Array(7);
    this.best = -1;
    this.flash = { col: -1, t: 0 };
    this.depths = [];                               // the depths she has finished this turn
    this.lastThink = null;                          // { depth, nodes, ms } of her last move
    this.deepest = 0;
    this.mood = 'calm'; this.moodT = 0; this.moodFor = 0;
    this.bubble = null;                             // { text, t, life }
    this.lastLineT = -9;
    this.saidWin = false; this.saidLoss = false;
    this.hint = [];                                 // her threats, shown at 1B-13B
    this.hintToasted = false;
    this.pulse = new Float32Array(42);
    this.buffer = null;
    this.endFired = false;
    this.endT = 0;
    this.plies = 0;
    this.thinks = 0;
    this.slow = 0;
    this.coach = Boolean(o.coach);                  // a first game ever: show where to tap until the first drop
    this.herThreats = [];                           // her threats as your turn began (did you block one?)
  }

  get her() { return MINT; }
  isHuman(who) { return Boolean(this.humans[who]); }
  get canInput() { return this.phase === 'input' && this.isHuman(this.turn); }
  get thinking() { return this.phase === 'think' || this.phase === 'commit'; }

  start() {
    this.phase = 'idle';
    this.nextTurn();
  }

  // ---------- turns ----------
  nextTurn() {
    this.phaseT = 0;
    if (this.isHuman(this.turn)) {
      this.phase = 'input';
      this.herThreats = this.mode === 'ladder' ? threatsNow(this.cells, MINT) : threatsNow(this.cells, other(this.turn));
      this.hint = this.mode === 'ladder' && LEVELS[this.level].hints ? this.herThreats : [];
      if (this.hint.length && !this.hintToasted) { this.hintToasted = true; this.hooks.toast?.('She has a threat!', 'warn'); this.hooks.sfx?.('threat'); }
      if (this.buffer && this.t - this.buffer.t < 0.35) { const c = this.buffer.col; this.buffer = null; this.tryDrop(c); }
      this.buffer = null;
      return;
    }
    this.hint = [];
    if (this.turn === PINK && (this.mode === 'demo' || this.mode === 'attract')) return this.startAim();
    this.startThink();
  }

  // a person drops a stone (→ true if it went in)
  tryDrop(col) {
    if (this.phase === 'fall' && this.fall && this.isHuman(other(this.fall.who)) && this.fall.y < 2.5) {
      this.buffer = { col, t: this.t };                // a tap as her stone lands: kept for a moment
      return false;
    }
    if (!this.canInput) return false;
    if (landing(this.cells, col) < 0) { this.hooks.sfx?.('nope'); return false; }
    this.hover = col;
    this.coach = false;
    this.startFall(col, this.turn);
    return true;
  }

  // the demo's pink player: picks its column, glides the ghost there, then drops
  startAim() {
    this.phase = 'aim';
    this.phaseT = 0;
    const lv = this.pinkLevel;
    this.aimCol = -1;
    this.hooks.think?.({
      cells: this.cells, color: PINK, level: lv, seed: this.seed * 7 + this.plies * 131 + 17, sync: true,
      onDone: (r) => { this.aimCol = r.move; },
    });
    if (this.aimCol < 0) this.aimCol = 3;
    this.aimDur = (0.3 + Math.min(0.12, Math.abs(this.aimCol - this.gx) * 0.03)) * this.pace.aim;
  }

  startThink() {
    this.phase = 'think';
    this.phaseT = 0;
    this.thinks++;
    this.depths = [];
    this.barTo.fill(0);
    this.barKind.fill(0);
    this.best = -1;
    const L = LEVELS[this.level];
    const demoish = this.mode === 'demo' || this.mode === 'attract';
    const th = {
      t: 0, snaps: [], next: 0, lastReveal: -1, result: null,
      min: (demoish ? 0.62 : [0.66, 0.66, 0.78, 0.86, 0.92, 1.0][this.level]) * this.pace.think,
      every: demoish ? 0.07 : [0.2, 0.2, 0.16, 0.11, 0.085, 0.072][this.level],
      id: 0, level: this.level,
    };
    this.think = th;
    this.mood = 'think'; this.moodT = 0; this.thinkMood = 'think';
    th.id = this.hooks.think?.({
      cells: this.cells, color: MINT, level: this.level, seed: this.seed * 31 + this.plies * 977 + 5,
      sync: demoish,
      onDepth: (s) => { if (this.think === th) th.snaps.push(s); },
      onDone: (r) => { if (this.think === th) th.result = r; },
    }) || 0;
  }

  // ---------- the game clock ----------
  update(dt) {
    dt *= this.speed;
    if (this.slow > 0) { this.slow = Math.max(0, this.slow - dt); dt *= 0.18; }
    this.t += dt;
    this.phaseT += dt;
    this.moodT += dt;
    if (this.bubble) { this.bubble.t += dt; if (this.bubble.t > this.bubble.life) this.bubble = null; }
    if (this.moodFor && this.moodT > this.moodFor && this.phase !== 'think') { this.mood = 'calm'; this.moodFor = 0; }
    for (let i = 0; i < 42; i++) if (this.pulse[i] > 0) this.pulse[i] = Math.max(0, this.pulse[i] - dt * 2.6);
    if (this.flash.t > 0) this.flash.t = Math.max(0, this.flash.t - dt);

    // the ghost: shown on a person's turn (where they point) and while the demo's pink player aims; a first game
    // shows it over the middle column until the first drop
    const coaching = this.coach && this.phase === 'input' && this.hover < 0;
    const showGhost = (this.phase === 'input' && this.hover >= 0) || this.phase === 'aim' || coaching;
    const gTarget = this.phase === 'aim' ? this.aimCol : coaching ? 3 : this.hover;
    if (gTarget >= 0) this.gx += (gTarget - this.gx) * (1 - Math.exp(-dt * (this.phase === 'aim' ? 9 : 26)));
    this.ghost = clamp(this.ghost + (showGhost ? dt * 7 : -dt * 9), 0, 1);

    if (this.phase === 'aim' && this.phaseT >= this.aimDur) { this.gx = this.aimCol; this.startFall(this.aimCol, PINK); }
    if (this.phase === 'think') this.updateThink(dt);
    if (this.phase === 'commit' && this.phaseT >= 0.24) { const c = this.think.choice; this.think = null; this.startFall(c, MINT); }
    if (this.fall && (this.phase === 'fall' || this.phase === 'end')) this.updateFall(dt);
    if (this.phase === 'end') this.updateEnd(dt);

    // her attention bars
    const shown = this.phase === 'think' || this.phase === 'commit';
    this.barShow = clamp(this.barShow + (shown ? dt * 6 : -dt * 3.2), 0, 1);
    const L = LEVELS[this.level];
    const rate = 6 + (1 - L.jitter) * 10;
    for (let c = 0; c < 7; c++) {
      if (L.jitter && shown) {
        // a small model's attention flickers
        this.jit[c] += (Math.sin(this.t * (7 + c * 1.7) + c * 2.1) * 0.5 + Math.sin(this.t * (13.3 - c) + c) * 0.5 - this.jit[c]) * Math.min(1, dt * 12);
      } else this.jit[c] *= Math.exp(-dt * 8);
      const to = clamp(this.barTo[c] + this.jit[c] * L.jitter * 0.6, 0, 1);
      this.bars[c] += (to - this.bars[c]) * (1 - Math.exp(-dt * rate));
    }
  }

  // run the clock forward (the demo, synced to the page's own clock; tests)
  advance(seconds, step = 1 / 120) {
    for (let t = 0; t < seconds; t += step) this.update(step);
  }

  updateThink(dt) {
    const th = this.think;
    th.t += dt;
    const left = th.snaps.length - th.next;
    if (left > 0) {
      const due = th.result ? Math.max(0.03, Math.min(th.every, (th.min - th.t) / left)) : th.every;
      if (th.lastReveal < 0 || th.t - th.lastReveal >= due) this.reveal(th.snaps[th.next++]);
    }
    if (th.result && th.next >= th.snaps.length && th.t >= th.min) this.commit(th.result);
  }

  reveal(s) {
    const th = this.think;
    th.lastReveal = th.t;
    const L = LEVELS[this.level];
    const att = attention(s.scores, L.temp);
    for (let c = 0; c < 7; c++) {
      const sc = s.scores[c];
      this.barTo[c] = att[c] == null ? 0 : att[c];
      this.barKind[c] = sc == null ? 0 : sc > MATE ? 1 : sc < -MATE ? -1 : 0;
    }
    this.best = s.best;
    this.depths.push(s.depth);
    if (this.depths.length > 8) this.depths.shift();
    const ds = this.depths.slice(-3).join(' · ');
    this.depthText = `depth ${ds}…`;
    this.depthDone = `depth ${ds}`;
    this.boards = s.nodes;
    this.hooks.sfx?.('blip', s.depth, this.level);
    // how she feels about it, as she looks deeper
    const v = verdict(s.score);
    if (this.level >= 2) {
      if (v.kind === 'win') this.thinkMood = 'smug';
      else if (v.kind === 'loss') this.thinkMood = 'shocked';
      else if (v.kind === 'behind') this.thinkMood = 'worried';
      else if (v.kind === 'ahead') this.thinkMood = 'smug';
      else this.thinkMood = 'think';
    } else this.thinkMood = 'think';
  }

  commit(r) {
    const th = this.think;
    const col = r.move;
    th.choice = col;
    this.phase = 'commit';
    this.phaseT = 0;
    this.flash = { col, t: 0.32 };
    for (let c = 0; c < 7; c++) this.barTo[c] = c === col ? 1 : this.barTo[c] * 0.35;
    this.best = col;
    this.lastThink = { depth: r.depth, nodes: r.nodes || 0, ms: r.ms || 0, book: r.book };
    this.deepest = Math.max(this.deepest, r.depth || 0);
    this.hooks.sfx?.('commit', this.level);
    this.reactToChoice(col, r);
  }

  startFall(col, who) {
    const row = landing(this.cells, col);
    if (row < 0) { this.nextTurn(); return; }
    this.cells[at(col, row)] = who;
    this.hidden = at(col, row);
    this.fall = { col, row, who, y: DROP_ROW, vy: 0, bounces: 0, landed: false, squash: 0, settle: 0, pop: who === MINT && !this.isHuman(MINT) ? 0 : 1 };
    this.history.push({ col, row, who });
    this.plies++;
    this.phase = 'fall';
    this.phaseT = 0;
    this.hint = [];
    this.hooks.sfx?.('drop', who);
    this.hooks.announce?.(`${this.nameOf(who)} dropped in column ${col + 1}.`);
  }

  updateFall(dt) {
    const f = this.fall;
    if (f.pop < 1) { f.pop = Math.min(1, f.pop + dt * 7); if (f.pop < 1) return; }
    f.squash = Math.max(0, f.squash - dt * 6);
    if (!f.landed) {
      f.vy -= GRAVITY * dt;
      f.y += f.vy * dt;
      if (f.y <= f.row) {
        f.y = f.row;
        const speed = -f.vy;
        if (f.bounces === 0) this.impact(f, DROP_ROW - f.row);
        else this.hooks.sfx?.('bounce', f.who);
        f.bounces++;
        f.squash = Math.min(1, speed / 30);
        if (f.bounces < 3 && speed > 7) f.vy = speed * 0.26;
        else { f.landed = true; f.vy = 0; }
      }
      return;
    }
    f.settle += dt;
    if (f.settle >= 0.08) this.afterLanding();
  }

  impact(f, rows) {
    this.pulse[at(f.col, f.row)] = 1;
    this.hooks.land?.(f.col, f.row, f.who, rows);
    this.hooks.sfx?.('clack', rows, f.who);
    this.hooks.shake?.(0.08 + Math.min(0.14, rows * 0.02));
    this.hooks.haptic?.(f.who === PINK ? 14 : 9);
    const line = lineThrough(this.cells, f.col, f.row);
    if (line) this.finish(f.who, line);
    else if (isFull(this.cells)) this.finish(3, null);
  }

  afterLanding() {
    const f = this.fall;
    this.fall = null;
    this.hidden = -1;
    if (this.phase === 'end') return;
    this.reactToMove(f);
    this.turn = other(f.who);
    this.nextTurn();
  }

  finish(who, line) {
    this.phase = 'end';
    this.phaseT = 0;
    this.endT = 0;
    this.winner = who;
    this.line = line;
    this.think = null;
    if (line) { for (const i of line) this.pulse[i] = 1; this.slow = 0.09; this.hooks.shake?.(0.32); }
    const youWin = who === PINK, herWin = who === MINT;
    if (this.mode === 'pp') {
      if (who === 3) this.speak('ppDraw', {}, true);
      else this.speak('ppWin', { who: who === PINK ? 'pink' : 'mint' }, true);
      this.feel(who === 3 ? 'calm' : 'happy', 3);
      this.hooks.sfx?.(who === 3 ? 'draw' : 'win');
      if (who !== 3) this.hooks.confetti?.(who);
    } else if (youWin) {
      this.feel(this.level >= 5 ? 'flustered' : 'shocked', 4);
      this.speak('ouch', {}, true);
      this.hooks.sfx?.('win');
      this.hooks.confetti?.(PINK);
    } else if (herWin) {
      this.feel('happy', 4);
      this.speak('yay', {}, true);
      this.hooks.sfx?.('lose');
      this.hooks.glitch?.();
    } else {
      this.feel('calm', 3);
      this.hooks.sfx?.('draw');
    }
    this.hooks.announce?.(who === 3 ? 'The board is full: a draw.' : `${this.nameOf(who)} made four in a row.`);
  }

  updateEnd(dt) {
    this.endT += dt;
    if (!this.endFired && this.endT >= (this.mode === 'demo' || this.mode === 'attract' ? 2.3 : END_DELAY)) {
      this.endFired = true;
      this.hooks.ended?.(this.result());
    }
  }

  result() {
    if (this.winner === 3) return 'draw';
    if (this.mode === 'pp') return this.winner === PINK ? 'pink' : 'mint';
    return this.winner === PINK ? 'win' : 'loss';
  }

  // pass & play: take back the last stone
  undo() {
    if (this.mode !== 'pp' || this.phase !== 'input' || !this.history.length) return false;
    const last = this.history.pop();
    this.cells[at(last.col, last.row)] = 0;
    this.turn = last.who;
    this.plies--;
    this.hooks.sfx?.('undo');
    this.nextTurn();
    return true;
  }

  // ---------- her feelings and words ----------
  feel(mood, seconds = 2.2) { this.mood = mood; this.moodT = 0; this.moodFor = seconds; }
  speak(kind, vars = {}, force = false) {
    if (!force && this.t - this.lastLineT < 2.6) return false;
    const text = this.hooks.line?.(kind, this.level, vars);
    if (!text) return false;
    this.bubble = { text, t: 0, life: Math.max(3.6, 1.6 + text.length * 0.06) };
    this.lastLineT = this.t;
    return true;
  }
  get face() { return this.phase === 'think' ? (this.thinkMood || 'think') : this.mood; }

  // the start of a game: hello (at AGI, the truth about who can force a win, when it applies)
  greet() {
    if (this.mode === 'pp') this.speak('ppStart', {}, true);
    else if (this.mode === 'ladder') {
      if (this.level === LEVELS.length - 1 && this.turn === PINK && this.hooks.chance?.(0.6)) this.speak('agiYouStart', {}, true);
      else if (this.level === LEVELS.length - 1 && this.turn === MINT && this.hooks.chance?.(0.4)) this.speak('agiSheStarts', {}, true);
      else this.speak('hello', {}, true);
    }
  }

  reactToChoice(col, r) {
    if (this.mode !== 'ladder' && this.mode !== 'demo') return;
    if (this.level <= 1) {
      // the small ones don't really know how it's going: they're just happy to be here
      const missed = threatsNow(this.cells, PINK).length && !threatsNow(this.cells, PINK).some((x) => x.col === col);
      if (missed && this.hooks.chance?.(0.7)) { this.feel('flustered', 2); this.speak('missedBlock'); }
      else this.feel(this.hooks.chance?.(0.5) ? 'happy' : 'calm', 1.4);
      return;
    }
    const v = verdict(r.score);
    const blocks = threatsNow(this.cells, PINK).some((x) => x.col === col);
    if (v.kind === 'win' && !this.saidWin && this.level >= 2) { this.saidWin = true; this.feel('smug', 3); this.speak('winFound', {}, true); return; }
    if (v.kind === 'loss' && !this.saidLoss && this.level >= 2) { this.saidLoss = true; this.feel('shocked', 3); this.speak('lossFound', {}, true); return; }
    if (blocks) { this.feel('smug', 1.6); this.speak('blocked'); this.hooks.float?.('Blocked', col, MINT); return; }
    if (v.kind === 'ahead') { this.feel('smug', 1.8); if (this.hooks.chance?.(0.3)) this.speak('ahead'); }
    else if (v.kind === 'behind') { this.feel('worried', 2); if (this.hooks.chance?.(0.35)) this.speak('behind'); }
    else this.feel('calm', 1);
  }

  reactToMove(f) {
    if (this.phase === 'end') return;
    // pass & play: she points out a new threat for either side
    if (this.mode === 'pp') {
      const mine = threatsNow(this.cells, f.who);
      if (this.herThreats.some((x) => x.col === f.col && x.row === f.row)) this.hooks.float?.('Nice block', f.col, f.who);
      if (mine.length >= 2) this.hooks.float?.('Double threat!', f.col, f.who, true);
      if (mine.length) { this.feel('worried', 1.4); this.speak('ppThreat', { who: f.who === PINK ? 'pink' : 'mint' }); }
      return;
    }
    // your stone landed: did it stop one of hers? make a threat of yours, or two?
    if (f.who !== PINK || this.mode !== 'ladder') return;
    const mine = threatsNow(this.cells, PINK);
    if (this.herThreats.some((x) => x.col === f.col && x.row === f.row)) this.hooks.float?.('Nice block', f.col, PINK);
    if (mine.length >= 2) { this.hooks.float?.('Double threat!', f.col, PINK, true); this.feel('shocked', 2); this.speak('lossFound', {}, true); }
    else if (mine.length) { this.feel('worried', 1.8); this.speak('threat'); }
  }
  nameOf(who) {
    if (this.mode === 'pp') return who === PINK ? 'Pink' : 'Mint';
    return who === PINK ? 'You' : 'AGI-1';
  }
}

