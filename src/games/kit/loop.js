// AGI arcade kit: the game loop. `update(dt)` runs at a fixed step (1/120 s by default: the same game on a 60 Hz phone
// and a 144 Hz monitor), `render(alpha, frameDt)` once a frame. A slow frame never makes the game jump more than
// `maxFrame` seconds (a stalled tab doesn't fast-forward). The loop keeps running while the game is paused (so
// menus can still animate): pass `paused: () => bool` and `update` isn't called while it's true.
//
//   const loop = createLoop({ update, render, paused: () => state !== 'play' }); loop.start();
export function createLoop({ update, render, step = 1 / 120, maxFrame = 0.1, paused = () => false, speed = () => 1 }) {
  let raf = 0, last = 0, acc = 0, running = false;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    let dt = last ? t - last : step;
    last = t;
    if (dt > maxFrame) dt = maxFrame;
    if (dt < 0) dt = 0;
    if (!paused()) {
      acc += dt * speed();
      let n = 0;
      while (acc >= step && n < 40) { update(step); acc -= step; n++; }
      if (n === 40) acc = 0;
    } else acc = 0;
    render(acc / step, dt);
  };
  return {
    start() { if (running) return; running = true; last = 0; acc = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
  };
}
