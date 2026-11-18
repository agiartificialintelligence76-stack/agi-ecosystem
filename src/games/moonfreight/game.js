import { caption, clamp, line, meter, oval, panel, scenery, sprite, TAU } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const tables = [{
  name: 'SELENE',
  tee: [92, 258],
  cup: [382, 187],
  planet: [236, 132],
  banks: 0
}, {
  name: 'IO',
  tee: [94, 275],
  cup: [388, 270],
  planet: [229, 235],
  banks: 0
}, {
  name: 'MIRANDA',
  tee: [91, 242],
  cup: [328, 235],
  planet: [196, 186],
  banks: 1
}, {
  name: 'EUROPA',
  tee: [105, 181],
  cup: [376, 260],
  planet: [248, 223],
  banks: 0
}, {
  name: 'TITAN',
  tee: [93, 211],
  cup: [335, 177],
  planet: [213, 258],
  banks: 1
}];
const bounds = [29, 451, 94, 335],
  ballR = 6,
  beat = 1 / 120;
function advance(s, dt, table) {
  const [px, py] = table.planet,
    dx = px - s.x,
    dy = py - s.y,
    dist = Math.max(1, Math.hypot(dx, dy)),
    gravity = Math.min(94, 145000 / (dist * dist + 820));
  s.vx += dx / dist * gravity * dt;
  s.vy += dy / dist * gravity * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  for (const [p, v, low, high] of [['x', 'vx', bounds[0] + ballR, bounds[1] - ballR], ['y', 'vy', bounds[2] + ballR, bounds[3] - ballR]]) {
    if (s[p] < low || s[p] > high) {
      s[p] = clamp(s[p], low, high);
      s[v] *= -.94;
      s.banks++;
    }
  }
  if (dist < 22) {
    const nx = -dx / dist,
      ny = -dy / dist,
      dot = s.vx * nx + s.vy * ny;
    if (dot < 0) {
      s.vx -= 2 * dot * nx;
      s.vy -= 2 * dot * ny;
    }
    s.x = px + 23 * nx;
    s.y = py + 23 * ny;
  }
  s.age += dt;
  return s.banks >= table.banks && Math.hypot(s.x - table.cup[0], s.y - table.cup[1]) < 16;
}
function shot(table, aim, power) {
  const v = 202 + power * 101;
  return {
    x: table.tee[0],
    y: table.tee[1],
    vx: v * Math.cos(aim),
    vy: v * Math.sin(aim),
    banks: 0,
    age: 0
  };
}
function findLine(table) {
  let best = null;
  for (let j = 0; j < 160; j++) {
    const a = j * TAU / 160;
    const s = shot(table, a, .55);
    for (let i = 0; i < 450; i++) {
      if (advance(s, beat, table)) {
        if (!best || s.age < best.age) best = {
          a,
          age: s.age
        };
        break;
      }
    }
  }
  return best?.a ?? 0;
}
export default {
  title: 'MOONSHOT BILLIARDS',
  tagline: 'AGI-1 chalked the cue. Gravity gets the next turn.',
  instructions: [['Line up the comet', 'Tap the felt to point AGI-1’s cue. Left and right rotate the aim. The pearl dots predict the start of your shot.'], ['Shoot and bend', 'Tap Shoot or Space for a medium stroke. Hold and release to change power. The planet bends passing shots and rebounds direct hits.'], ['Read the house rules', 'Sink the comet in the gold pocket. On bank tables it must hit a cushion first. Five tables, twelve pieces of chalk. Earn a bonus for your first shot.']],
  keys: [['← / →', 'Rotate cue'], ['Space', 'Shoot / hold for power']],
  touch: [['Tap or drag felt', 'Aim'], ['Shoot', 'Tap or hold for power']],
  create(api) {
    const flip = tables.map(() => api.rng() > .5);
    const layouts = tables.map((tb, i) => ({
      ...tb,
      tee: tb.tee.map((v, k) => k && flip[i] ? 429 - v : v),
      cup: tb.cup.map((v, k) => k && flip[i] ? 429 - v : v),
      planet: tb.planet.map((v, k) => k && flip[i] ? 429 - v : v)
    }));
    let stage = 0,
      score = 0,
      chalk = 12,
      firsts = 0,
      tableShots = 0,
      banks = 0,
      aim = 0,
      power = .55,
      chargeT = 0,
      charging = false,
      active = null,
      trail = [],
      trailTick = 0,
      t = 0,
      clock = 106,
      wait = 0,
      potted = false,
      ended = false,
      notice = 'AIM AT THE GOLD POCKET',
      flash = 2.3,
      auto = 0,
      drag = false;
    const held = new Set();
    const table = () => layouts[stage];
    function resetAim() {
      const q = table();
      aim = Math.atan2(q.cup[1] - q.tee[1], q.cup[0] - q.tee[0]);
    }
    resetAim();
    function finish() {
      if (ended) return;
      ended = true;
      api.end(score, [['Tables cleared', stage + '/5'], ['First-shot pots', firsts], ['Cushion contacts', banks]], stage === 5 ? 'the moon owes us a rematch.' : 'chalk up. i saved us a table.');
    }
    function begin() {
      if (ended || active || wait > 0) return;
      charging = true;
      chargeT = 0;
    }
    function release() {
      if (!charging || ended || active || wait > 0) return;
      charging = false;
      chalk--;
      tableShots++;
      active = shot(table(), aim, power);
      trail = [];
      trailTick = 0;
      api.sound('slice');
    }
    function point(x, y) {
      if (!active && wait <= 0) {
        const [a, b] = table().tee,
          ux = x + 9,
          uy = y - 36,
          det = .94 * .86 + .045 * .095;
        const tx = (.86 * ux - .095 * uy) / det,
          ty = (.045 * ux + .94 * uy) / det;
        aim = Math.atan2(ty - b, tx - a);
      }
    }
    function result(ok) {
      banks += active.banks;
      potted = ok;
      wait = ok ? .95 : .55;
      notice = ok ? active.banks ? 'BANK SHOT!' : 'CLEAN POT!' : 'CHALK UP • TRY ANOTHER LINE';
      flash = 1.7;
      if (ok) {
        firsts += Number(tableShots === 1);
        score += 360 + active.banks * 55 + (tableShots === 1 ? 175 : 0);
        api.haptic(19);
      }
      api.sound(ok ? 'clear' : 'back');
      active = null;
    }
    return {
      key(type, k) {
        if (type === 'down') {
          held.add(k);
          if (k === 'Space') begin();
        } else {
          held.delete(k);
          if (k === 'Space') release();
        }
      },
      pointer(type, x, y) {
        if (type === 'down') {
          if (y > 398 && x > 187) begin();else if (y >= 84 && y < 349) {
            drag = true;
            point(x, y);
          }
        } else if (type === 'move' && drag) point(x, y);else if (type === 'up') {
          release();
          drag = false;
        } else if (type === 'cancel') {
          charging = false;
          drag = false;
        }
      },
      cancelInput() {
        held.clear();
        charging = false;
        drag = false;
      },
      demo(dt) {
        if (active || wait > 0) return;
        auto += dt;
        if (auto > .85) {
          aim = findLine(table());
          begin();
          power = .55;
          release();
          auto = 0;
        }
      },
      update(dt) {
        if (ended) return;
        t += dt;
        clock -= dt;
        flash -= dt;
        if (clock <= 0) {
          finish();
          return;
        }
        if (wait > 0) {
          wait -= dt;
          if (wait <= 0) {
            if (potted) {
              stage++;
              if (stage === 5) {
                finish();
                return;
              }
              tableShots = 0;
              resetAim();
            }
            if (!chalk) {
              finish();
              return;
            }
            potted = false;
            power = .55;
          }
          return;
        }
        if (charging) {
          chargeT += dt;
          power = chargeT < .18 ? .55 : .22 + .78 * (1 - Math.abs(1 - (chargeT - .18) * 1.15 % 2));
        } else if (!active) power = .55;
        if (!active) {
          aim += dt * 1.42 * (Number(held.has('ArrowRight') || held.has('KeyD')) - Number(held.has('ArrowLeft') || held.has('KeyA')));
        } else {
          let remain = dt;
          while (remain > 0 && active) {
            const step = Math.min(beat, remain);
            const prev = active.banks;
            if (advance(active, step, table())) result(true);else if (active.age >= 3.65) result(false);else if (active.banks !== prev) api.sound('bounce', {
              pitch: 1.25
            });
            remain -= step;
          }
          if (active) {
            trailTick += dt;
            if (trailTick > .034) {
              trailTick = 0;
              trail.push([active.x, active.y]);
              if (trail.length > 18) trail.shift();
            }
          }
        }
        api.hud('House points', score, 'Chalk', chalk);
      },
      draw(c) {
        world(c);
        if (ended) return;
        const q = table();
        c.save();
        c.transform(.94, -.045, .095, .86, -9, 36);
        panel(c, 15, 73, 450, 297, '#412847', 18);
        panel(c, 15, 69, 450, 294, '#895e4a', 18);
        panel(c, 15, 62, 450, 295, '#764f3b', 18);
        panel(c, 20, 67, 440, 285, '#cc9b5b', 15);
        panel(c, 27, 82, 426, 261, '#25565a', 13);
        panel(c, 31, 93, 418, 241, '#1c3f49', 9);
        for (let k = 0; k < 40; k++) {
          let x = 40 + k * 67 % 400,
            y = 108 + k * 51 % 207;
          oval(c, x, y, k % 4 === 0 ? 1.6 : .8, k % 4 === 0 ? 1.6 : .8, '#c3daca82');
        }
        for (let i = 0; i < 8; i++) {
          oval(c, 48 + i * 56, 75, 2, 2, '#f9e4b2');
          oval(c, 48 + i * 56, 348, 2, 2, '#efd6a1');
        }
        const [a, b] = q.planet;
        oval(c, a + 3, b + 9, 28, 10, '#102b39aa');
        if (!prop(c, a - 34, b - 30, 68, 58)) {
          oval(c, a, b, 37, 11, null, '#b4afe181', 2);
          oval(c, a, b, 17, 17, '#9b81ac', '#e2baca', 2);
          line(c, [[a - 29, b + 5], [a - 15, b + 9], [a + 8, b + 7], [a + 29, b - 4]], '#e1bbc9', 3);
        }
        const [gx, gy] = q.cup;
        oval(c, gx, gy, 20 + Math.sin(t * 3) * 2, 20 + Math.sin(t * 3) * 2, null, '#efc77788', 2);
        oval(c, gx, gy, 15, 15, '#111e2d', '#ffdd89', 3);
        caption(c, '✦', gx, gy, '#f2c76e', 15);
        if (!active && wait <= 0) {
          const s = shot(q, aim, power);
          for (let i = 0; i < 102; i++) {
            advance(s, beat, q);
            if (i % 6 === 0) oval(c, s.x, s.y, 1.6, 1.6, '#fff1cb');
          }
          const [x, y] = q.tee;
          const dx = Math.cos(aim),
            dy = Math.sin(aim),
            back = charging ? 13 + power * 8 : 13;
          line(c, [[x - dx * back, y - dy * back], [x - dx * (back + 51), y - dy * (back + 51)]], '#d9ab62', 5);
          line(c, [[x - dx * back, y - dy * back], [x - dx * (back + 7), y - dy * (back + 7)]], '#c0e2d5', 4);
        }
        if (trail.length > 1 && active) line(c, trail, '#ade8de88', 4);
        const bx = active?.x ?? q.tee[0],
          by = active?.y ?? q.tee[1];
        if (!potted) {
          oval(c, bx, by, 7, 7, '#f7e9c0', '#17303c', 1.4);
          oval(c, bx - 2, by - 2, 2, 2, '#fffce8');
        }
        c.restore();
        panel(c, 12, 12, 456, 42, '#281f3c', 4);
        caption(c, '✦  ' + q.name, 25, 34, '#ffe2a4', 20, 'left');
        caption(c, q.banks ? 'HOUSE RULE • 1 BANK' : 'OPEN TABLE', 452, 34, '#cde2e1', 14, 'right');
        panel(c, 13, 359, 455, 105, '#261e37e9', 8);
        actor(c, 10, 345, 152, 133);
        caption(c, flash > 0 ? notice : active ? 'COMET IN MOTION' : 'TAP FELT TO AIM', 316, 382, '#ffe2ae', 13);
        panel(c, 184, 399, 267, 53, '#ccaa70', 6);
        caption(c, charging ? 'RELEASE CUE' : 'SHOOT', 317, 421, '#31263b', 19);
        meter(c, 210, 437, 211, power, '#74618d', '#e7d2a8');
      }
    };
  }
};
