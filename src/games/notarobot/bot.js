// I'M NOT A ROBOT: the demo's player (?demo, the arcade's preview), a drawn cartoon hand. It moves like a hand (a
// spring: slow, fast, slow, a hair of overshoot), reads each check a moment before it acts, and plays it only through
// the run's own input (ptr: down, move, up, hover), the same way a finger or a mouse does, so it can only do what a
// player can. Each check knows how to play itself (its `bot(st, B, dt)`); now and then the hand blunders (a fail, the
// way a person would), as the seed decides. Pure: no DOM (tests/notarobot.test.js lets it play every check).
import { rng } from '../kit/fx.js';

export function createBot(seed, { reaction = [0.14, 0.26], blunderRate = 0.1, blunders = null } = {}) {
  const r = rng(seed >>> 0 || 5);
  const hand = { x: 330, y: 400, vx: 0, vy: 0, tx: 300, ty: 300, down: false, press: 0, upIn: -1, show: true };
  let run = null, cur = null, mem = {}, t = 0, cool = 0, nth = 0;

  const B = {
    hand, r,
    get mem() { return mem; },
    get t() { return t; },
    get T() { return cur ? cur.T : 1; },
    get ready() { return t >= mem.wait; },
    get blunder() { return mem.blunder; },
    // a check may ask for a calmer hand (the checkbox chase reads better when the hand isn't a blur)
    set maxSpeed(v) { mem.maxSpeed = v; },
    go(x, y) { hand.tx = x; hand.ty = y; },
    near(x, y, d = 8) { return Math.hypot(hand.x - x, hand.y - y) <= d; },
    settled(d = 3) { return Math.hypot(hand.x - hand.tx, hand.y - hand.ty) <= d && Math.hypot(hand.vx, hand.vy) < 50; },
    // a quick tap where the hand is
    tap() {
      if (cool > 0 || hand.down) return false;
      run.ptr('down', hand.x, hand.y, 'bot');
      hand.down = true; hand.upIn = 0.055; hand.press = 1; cool = 0.13;
      return true;
    },
    press() {
      if (hand.down) return;
      run.ptr('down', hand.x, hand.y, 'bot');
      hand.down = true; hand.upIn = -1; hand.press = 1;
    },
    release() {
      if (!hand.down) return;
      run.ptr('up', hand.x, hand.y, 'bot');
      hand.down = false; hand.upIn = -1;
    },
  };

  function begin(c) {
    cur = c;
    t = 0;
    nth++;
    const blunder = blunders ? blunders(nth, c) : r.chance(blunderRate);
    mem = { wait: r.range(reaction[0], reaction[1]), blunder: Boolean(blunder) };
    if (hand.down) { hand.down = false; hand.upIn = -1; }
  }

  return {
    hand,
    get nth() { return nth; },
    update(dt, theRun) {
      run = theRun;
      if (run.cur !== cur && run.cur) begin(run.cur);
      const live = run.phase === 'play' && cur && !cur.st.done;
      if (!live) {
        // between checks: back toward the middle of the page, relaxed
        if (hand.down) { run.ptr('up', hand.x, hand.y, 'bot'); hand.down = false; hand.upIn = -1; }
        hand.tx = 262; hand.ty = 300;
      }
      // the spring (semi-implicit, so it's steady at any step)
      const w = 19, z = 0.84;
      hand.vx += (w * w * (hand.tx - hand.x) - 2 * z * w * hand.vx) * dt;
      hand.vy += (w * w * (hand.ty - hand.y) - 2 * z * w * hand.vy) * dt;
      const sp = Math.hypot(hand.vx, hand.vy), max = live && mem.maxSpeed ? mem.maxSpeed : 2100;
      if (sp > max) { hand.vx *= max / sp; hand.vy *= max / sp; }
      hand.x += hand.vx * dt;
      hand.y += hand.vy * dt;
      hand.press = Math.max(0, hand.press - dt * 7);
      cool -= dt;
      if (!live) return;
      t += dt;
      run.ptr(hand.down ? 'move' : 'hover', hand.x, hand.y, 'bot');
      if (hand.down && hand.upIn >= 0) {
        hand.upIn -= dt;
        if (hand.upIn <= 0) { run.ptr('up', hand.x, hand.y, 'bot'); hand.down = false; hand.upIn = -1; }
      }
      if (!cur.st.done) cur.def.bot?.(cur.st, B, dt);
    },
  };
}
