// BLOCKCHAIN's hands (2026-11-08): plays a Session the way a person would, so the demo (`?demo`, the arcade's preview)
// and the title's little board look like real play: a finger touches a piece in the tray, it lifts, glides along an
// eased arc to its spot (its landing spot and the lines it would clear lighting up on the way), and drops. About 0.6 s
// a drop. Its choices come from ./ai.js (deterministic); its clock is the game loop's.
import { PIECES } from './rules.js';
import { chooseMove } from './ai.js';
import { ease, lerp } from '../kit/fx.js';

export const PACE = Object.freeze({ think: 0.1, lift: 0.1, glide: 0.33, hold: 0.07, afterClear: 0.2, afterDeal: 0.22 });

export class Bot {
  constructor(session, { pace = 1, firstWait = 0.35 } = {}) {
    this.se = session;
    this.pace = pace;
    this.state = 'think';
    this.t = firstWait;
    this.mv = null;
    this.from = null;
    this.to = null;
    this.finger = null;           // where the finger is (px) while it plays, for the renderer: { x, y, down }
  }
  update(dt) {
    const se = this.se;
    if (!se.L) return;
    if (se.busy) { this.finger = null; return; }
    this.t -= dt * this.pace;
    switch (this.state) {
      case 'think': {
        if (this.t > 0) return;
        const mv = chooseMove(se.s);
        if (!mv) return;
        this.mv = mv;
        const h = se.home(mv.slot);
        if (!se.startDrag(mv.slot, h.x, h.y, { touch: true, bot: true })) { this.t = 0.1; return; }
        const p = PIECES[se.s.tray[mv.slot]], C = se.L.C, g = se.drag;
        this.from = { x: h.x, y: h.y };
        // the finger's end: under where the piece's middle will be
        this.to = { x: se.L.gx + (mv.x + p.w / 2) * C - g.ox, y: se.L.gy + (mv.y + p.h / 2) * C - g.oy };
        this.finger = { x: h.x, y: h.y, down: 0 };
        this.state = 'lift';
        this.t = PACE.lift;
        return;
      }
      case 'lift':
        if (this.finger) this.finger.down = Math.min(1, this.finger.down + dt * 12);
        if (this.t > 0) return;
        this.state = 'glide';
        this.t = PACE.glide;
        return;
      case 'glide': {
        const k = Math.min(1, 1 - this.t / PACE.glide), e = ease.inOutCubic(k);
        const C = se.L.C;
        const x = lerp(this.from.x, this.to.x, e), y = lerp(this.from.y, this.to.y, e) - Math.sin(Math.PI * e) * C * 0.5;
        se.moveDrag(x, y);
        this.finger = { x, y, down: 1 };
        if (this.t > 0) return;
        se.moveDrag(this.to.x, this.to.y);
        this.finger = { x: this.to.x, y: this.to.y, down: 1 };
        this.state = 'hold';
        this.t = PACE.hold;
        return;
      }
      case 'hold': {
        if (this.t > 0) return;
        // let go exactly on its spot
        const mv = this.mv, p = PIECES[se.s.tray[mv.slot]];
        if (se.drag) se.setGhost(mv.x, mv.y, p, true);
        const r = se.endDrag();
        this.finger = this.finger ? { ...this.finger, down: 0, up: se.time } : null;
        this.state = 'think';
        this.t = PACE.think + (r && r.lines ? PACE.afterClear : 0) + (r && r.dealt ? PACE.afterDeal : 0);
        return;
      }
      default:
    }
  }
}
