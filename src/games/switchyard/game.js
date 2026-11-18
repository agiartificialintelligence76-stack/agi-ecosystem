import { caption, line, oval, panel, poly, scenery, sprite } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const depots = [['SHOYU • PIER 1', ['.......', '..#..#.', '.EB..G.', '..#..#.', '.......']], ['MISO • OLD MILL', ['....#..', '.E.#...', '...B.#.', '.##..G.', '.......']], ['GINGER • WEST QUAY', ['..#....', '.B...#.', '.#.#..G', '.E...#.', '...#...']], ['SESAME • NIGHT FERRY', ['.E..#..', '.#.#.G.', '...B.#.', '.##....', '....#..']], ['HOUSE SPECIAL • LAST STOP', ['..G#...', '.#..B#.', '...#...', '.#..#.E', '.......']]];
const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const index = (x, y) => y * 7 + x;
const at = n => [54 + n % 7 * 47 + Math.floor(n / 7) * 21, 184 - n % 7 * 13 + Math.floor(n / 7) * 35];
function tile(c, x, y) {
  const top = [[x - 32, y - 11], [x + 13, y - 23], [x + 32, y + 11], [x - 13, y + 23]];
  poly(c, [top[2], top[3], [x - 13, y + 29], [x + 32, y + 17]], '#112f32');
  poly(c, [top[3], top[0], [x - 32, y - 5], [x - 13, y + 29]], '#27454a');
  poly(c, top, '#355053');
}
function track(c, x, y, nx, ny) {
  const dx = nx - x,
    dy = ny - y,
    mag = Math.hypot(dx, dy),
    sx = -dy / mag,
    sy = dx / mag;
  for (let f = .15; f < 1; f += .24) {
    line(c, [[x + dx * f - sx * 6, y + dy * f - sy * 6], [x + dx * f + sx * 6, y + dy * f + sy * 6]], '#ae8058', 3);
  }
  for (const s of [-3.8, 3.8]) line(c, [[x + sx * s, y + sy * s], [nx + sx * s, ny + sy * s]], '#dad1b3', 1.6);
}
function move(state, a, rails) {
  const [p, b, c] = state,
    px = p % 7,
    py = Math.floor(p / 7),
    bx = b % 7,
    by = Math.floor(b / 7);
  if (a === 4) return Math.abs(px - bx) + Math.abs(py - by) === 1 ? [p, b, !c] : null;
  const [dx, dy] = dirs[a],
    nx = px + dx,
    ny = py + dy,
    nb = index(nx, ny),
    valid = (x, y) => x >= 0 && x < 7 && y >= 0 && y < 5 && rails.has(index(x, y));
  if (!valid(nx, ny)) return null;
  if (nb === b) {
    if (!c || !valid(bx + dx, by + dy)) return null;
    return [nb, index(bx + dx, by + dy), true];
  }
  return [nb, c ? p : b, c];
}
function route(start, goal, rails) {
  const queue = [{
      s: start,
      path: []
    }],
    seen = new Set([start.join(',')]);
  for (let i = 0; i < queue.length; i++) {
    const {
      s,
      path
    } = queue[i];
    if (s[1] === goal) return path;
    for (let a = 0; a < 5; a++) {
      const n = move(s, a, rails);
      if (!n || seen.has(n.join(','))) continue;
      seen.add(n.join(','));
      queue.push({
        s: n,
        path: [...path, a]
      });
    }
  }
  return [];
}
export default {
  title: 'LAST TRAIN TO NOODLES',
  tagline: 'AGI-1 has a locomotive, a dining car, and one last supper to deliver.',
  instructions: [['Drive the little engine', 'Move one tile with the arrows, a swipe, or a tap on a neighboring track. Bring AGI-1 alongside the cream dining car.'], ['Work the coupler', 'Space or Coupler joins the two vehicles. Move toward the carriage to push. Move away or turn to pull it around corners. Tap Coupler again to leave it behind.'], ['Serve the platform', 'Leave the dining car on the red bowl. Short routes earn extra tips. Undo rewinds one move. Deliver five bowls before the night service ends.']],
  keys: [['Arrows / WASD', 'Drive one tile'], ['Space', 'Couple / let go'], ['Z', 'Undo']],
  touch: [['Tap a rail / swipe', 'Drive one tile'], ['Coupler / Undo', 'Operate the engine']],
  create(api) {
    const flipped = depots.map(() => api.rng() > .5);
    let stage = 0,
      t = 0,
      clock = 112,
      score = 0,
      tips = 0,
      ended = false,
      delay = 0,
      auto = 0,
      flash = 0,
      notice = '',
      rails,
      goal,
      state,
      history,
      par,
      moves,
      facing = 1,
      oldPos,
      oldCar,
      anim = 1,
      startTap = null;
    function setup() {
      const rows = depots[stage][1].map(row => flipped[stage] ? [...row].reverse().join('') : row);
      rails = new Set();
      let p, b;
      rows.forEach((r, y) => [...r].forEach((c, x) => {
        const n = index(x, y);
        if (c !== '#') rails.add(n);
        if (c === 'E') p = n;
        if (c === 'B') b = n;
        if (c === 'G') goal = n;
      }));
      state = [p, b, false];
      history = [];
      par = route(state, goal, rails).length;
      moves = 0;
      oldPos = p;
      oldCar = b;
      anim = 1;
      notice = 'COUPLE THE DINING CAR';
      flash = 2.3;
    }
    function finish() {
      if (ended) return;
      ended = true;
      api.end(score, [['Suppers delivered', stage + '/5'], ['Shortest routes', tips]], stage === 5 ? 'last train, hot noodles. we did it.' : 'keep the stove warm for me.');
    }
    function action(a) {
      if (ended || delay > 0) return;
      if (a === 5) {
        if (!history.length) return;
        oldPos = state[0];
        oldCar = state[1];
        anim = 0;
        state = history.pop();
        moves--;
        api.sound('back');
        return;
      }
      const next = move(state, a, rails);
      if (!next) {
        notice = a === 4 ? 'PULL BESIDE THE DINER' : 'TRACK BLOCKED';
        flash = .7;
        api.sound('tap');
        return;
      }
      oldPos = state[0];
      oldCar = state[1];
      anim = 0;
      history.push(state);
      state = next;
      moves++;
      if (a === 1 || a === 3) facing = a === 1 ? 1 : -1;
      api.sound(a === 4 ? 'merge' : 'tick');
      if (a === 4) {
        notice = state[2] ? 'COUPLED • PUSH OR PULL' : 'COUPLER OPEN';
        flash = 1.2;
      }
      if (state[1] === goal) {
        tips += Number(moves <= par);
        score += Math.max(150, 530 - (moves - par) * 19);
        notice = moves <= par ? 'SERVED • CHEF’S TIP!' : 'HOT SUPPER SERVED';
        flash = 1.3;
        delay = 1.1;
        api.sound('clear');
        api.haptic(18);
      }
    }
    setup();
    return {
      key(type, k) {
        if (type !== 'down') return;
        const a = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space', 'KeyZ'].indexOf(k);
        const wasd = ['KeyW', 'KeyD', 'KeyS', 'KeyA'].indexOf(k);
        if (a >= 0 || wasd >= 0) action(a >= 0 ? a : wasd);
      },
      pointer(type, x, y) {
        if (type === 'cancel') {
          startTap = null;
          return;
        }
        if (type === 'down') {
          startTap = [x, y];
          return;
        }
        if (type !== 'up' || !startTap) return;
        let dx = x - startTap[0],
          dy = y - startTap[1];
        startTap = null;
        if (y > 398 && Math.hypot(dx, dy) < 18) {
          action(x < 140 ? 5 : 4);
          return;
        }
        if (Math.hypot(dx, dy) < 18) {
          const [px, py] = at(state[0]),
            u = x - px,
            v = y - py;
          dx = (35 * u - 21 * v) / 1918;
          dy = (13 * u + 47 * v) / 1918;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > .35) action(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0);
          return;
        }
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 13) action(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0);
      },
      demo(dt) {
        auto -= dt;
        if (auto <= 0 && delay <= 0) {
          const steps = route(state, goal, rails);
          if (steps.length) action(steps[0]);
          auto = .39;
        }
      },
      update(dt) {
        if (ended) return;
        t += dt;
        clock -= dt;
        flash -= dt;
        anim = Math.min(1, anim + dt * 6);
        if (delay > 0) {
          delay -= dt;
          if (delay <= 0) {
            stage++;
            if (stage === 5) {
              finish();
              return;
            }
            setup();
          }
        }
        if (clock <= 0) finish();
        api.hud('Tips', score, 'Service', Math.min(5, stage + 1) + '/5');
      },
      draw(c) {
        world(c);
        if (ended) return;
        const elevation = [...rails].sort((a, b) => at(a)[1] - at(b)[1]);
        for (const n of elevation) {
          const [x, y] = at(n);
          tile(c, x, y);
        }
        for (const n of rails) {
          const [x, y] = at(n);
          for (const offset of [1, 7]) {
            if (offset === 1 && n % 7 === 6 || !rails.has(n + offset)) continue;
            track(c, x, y, ...at(n + offset));
          }
        }
        for (const n of rails) {
          const [x, y] = at(n);
          oval(c, x, y, 2.4, 1.8, '#e8c78d');
        }
        const [gx, gy] = at(goal);
        oval(c, gx, gy, 21 + 2 * Math.sin(t * 4), 18, null, '#ff9f6a', 3);
        caption(c, '♨', gx, gy - 1, '#ffd99f', 26);
        function lerp(a, b) {
          const A = at(a),
            B = at(b);
          return [A[0] + (B[0] - A[0]) * anim, A[1] + (B[1] - A[1]) * anim];
        }
        const [ex, ey] = lerp(oldPos, state[0]),
          [bx, by] = lerp(oldCar, state[1]);
        if (state[2]) line(c, [[ex, ey], [bx, by]], '#ffe393', 5);
        if (!prop(c, bx - 29, by - 30, 58, 42)) {
          panel(c, bx - 24, by - 15, 48, 29, '#e5c78e', 6);
          panel(c, bx - 23, by - 15, 46, 6, '#bf503c', 2);
          for (const q of [-13, 0, 13]) panel(c, bx + q - 4, by - 6, 8, 9, '#4a545b', 2);
          caption(c, '♨', bx, by + 2, '#fffbdb', 16);
          oval(c, bx - 14, by + 14, 4, 4, '#172126');
          oval(c, bx + 14, by + 14, 4, 4, '#172126');
        }
        c.save();
        c.translate(ex, ey);
        c.scale(facing, 1);
        actor(c, -32, -46 + Math.sin(t * 9) * .7, 65, 65);
        c.restore();
        panel(c, 14, 12, 452, 44, '#102d30', 3);
        caption(c, depots[stage][0], 26, 34, '#ffdaa1', 16, 'left');
        caption(c, Math.ceil(clock) + 's', 449, 34, '#fff1d5', 17, 'right');
        caption(c, flash > 0 ? notice : 'MOVES ' + moves + '   /   CHEF’S PAR ' + par, 240, 383, '#fff7cc', 15);
        panel(c, 16, 408, 112, 52, '#244549', 4);
        caption(c, '↶ UNDO', 72, 434, '#f9dfad', 16);
        panel(c, 139, 408, 325, 52, state[2] ? '#eac88a' : '#b24e3c', 4);
        caption(c, state[2] ? 'RELEASE COUPLER' : 'CLOSE COUPLER', 301, 434, state[2] ? '#263f42' : '#fff2ce', 18);
      }
    };
  }
};
