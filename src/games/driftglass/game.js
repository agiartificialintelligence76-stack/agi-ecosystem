import { caption, clamp, line, meter, oval, panel, poly, scenery, sprite } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const depth = y => .42 + clamp((y - 44) / 348, 0, 1) * .86;
const project = (x, y) => [240 + (x - 240) * depth(y), y];
const lanes = [98, 193, 287, 382],
  goal = 15;
function cassette(c, x, y, w, t) {
  const h = w * .57;
  panel(c, x - w / 2, y - h / 2, w, h, '#282237', 3);
  panel(c, x - w * .43, y - h * .34, w * .86, h * .64, '#f2bf91', 2);
  for (const k of [-1, 1]) {
    oval(c, x + k * w * .23, y, w * .115, w * .115, '#221f36');
    line(c, [[x + k * w * .23, y], [x + k * w * .23 + Math.sin(t * 4) * w * .07, y + Math.cos(t * 4) * w * .07]], '#f4d6a3', 1.3);
  }
  line(c, [[x - w * .13, y + h * .08], [x + w * .13, y + h * .08]], '#52445d', 2);
}
function rivalCar(c, x, y, tilt, t) {
  c.save();
  c.translate(...project(x, y));
  c.scale(depth(y), depth(y));
  c.rotate(tilt);
  actor(c, -39, -43 + Math.sin(t * 17) * .6, 78, 87);
  c.restore();
}
function player(c, x, y, tilt, t) {
  c.save();
  c.translate(...project(x, y));
  c.scale(depth(y), depth(y));
  c.rotate(tilt);
  if (prop(c, -25, -41, 50, 82)) {
    c.restore();
    return;
  }
  for (const s of [-1, 1]) {
    panel(c, s * 19 - 4, -19, 8, 14, '#141525', 2);
    panel(c, s * 19 - 4, 14, 8, 14, '#141525', 2);
  }
  poly(c, [[-15, -38], [14, -38], [21, -21], [21, 25], [15, 35], [-15, 35], [-22, 24], [-22, -19]], '#9af3dc');
  poly(c, [[-14, -28], [14, -28], [16, -11], [-16, -11]], '#41657d');
  panel(c, -13, -8, 26, 23, '#293c58', 4);
  line(c, [[-8, -7], [-8, 14]], '#67c7d1', 3);
  line(c, [[-16, 26], [15, 26]], '#ff829d', 4);
  for (const s of [-1, 1]) line(c, [[s * 15, -32], [s * 9, -33]], '#fff8c2', 3);
  for (const s of [-1, 1]) poly(c, [[s * 11 - 3, 35], [s * 11 + 4, 35], [s * 11, 40 + Math.sin(t * 24) * 3]], '#ffc064');
  c.restore();
}
export default {
  title: 'CASSETTE BANDIT',
  tagline: 'AGI-1 stole your mixtape and the pirate station is still live. Pull alongside and steal it back.',
  instructions: [['Catch the pink convertible', 'Use left/right to change lanes, up/down to move along the road. On touch, tap or drag the road to choose your lane and position. Your car is mint.'], ['Snatch the cassette', 'When the cars are side by side the link turns gold. Press Space or tap Snatch to take AGI-1’s tape. She flashes her headlights before attempting to steal it back.'], ['Keep the broadcast', 'Once you have the tape, the same button becomes Jam. Time it against her steal or change lanes to break contact. Dodge the roadworks. First to fifteen seconds on air wins.']],
  keys: [['Arrows / WASD', 'Change lane and pace'], ['Space', 'Snatch / jam signal']],
  touch: [['Tap / drag road', 'Choose lane and pace'], ['Snatch / Jam', 'Operate pirate radio']],
  create(api) {
    let t = 0,
      clock = 52,
      score = 0,
      pTime = 0,
      rTime = 0,
      carrier = 'agi',
      lane = 1,
      px = lanes[1],
      py = 274,
      desiredY = 274,
      rx = lanes[2],
      ry = 222,
      rLane = 2,
      rTarget = 220,
      tilt = 0,
      rt = 0,
      ai = 1.25,
      threat = 0,
      stealLock = 1.6,
      jam = 0,
      jamWait = 0,
      staticT = 0,
      steals = 0,
      blocks = 0,
      notice = 'MINT CAR • TAKE THE TAPE',
      flash = 2,
      ended = false,
      road = 0,
      spawn = 2.6,
      drag = false,
      demoT = 0;
    const obstacles = [],
      held = new Set();
    let previousX = px,
      previousRX = rx;
    const connected = () => Math.abs(px - rx) < 116 && Math.abs(py - ry) < 66;
    const close = () => Math.abs(px - rx) < 103 && Math.abs(py - ry) < 56;
    function finish() {
      if (ended) return;
      ended = true;
      const won = pTime >= goal || rTime < goal && pTime > rTime;
      score = Math.round(score + pTime * 21 + (won ? 500 : 0));
      api.end(score, [['Broadcast', won ? 'Your station' : 'AGI-1 FM'], ['Mixtape steals', steals], ['Steals blocked', blocks], ['Airtime', pTime.toFixed(1) + 's']], won ? 'okay, fine. play side b.' : 'same time tomorrow? i made another tape.');
    }
    function radio() {
      if (ended || staticT > 0) return;
      if (carrier === 'agi') {
        if (close() && stealLock <= 0) {
          carrier = 'you';
          steals++;
          score += 120;
          stealLock = 1.55;
          ai = .4;
          threat = 0;
          notice = 'YOUR STATION • B-SIDE LIVE';
          flash = 1.45;
          api.sound('coin');
          api.haptic(18);
        } else {
          notice = stealLock > 0 ? 'TAPE CHANGING HANDS' : 'PULL ALONGSIDE THE PINK CAR';
          flash = .7;
        }
      } else if (jamWait <= 0) {
        jam = .85;
        jamWait = 2.9;
        notice = 'JAMMER ON AIR';
        flash = .75;
        api.sound('power');
      }
    }
    function choose(x, y) {
      const roadX = 240 + (x - 240) / depth(y);
      lane = clamp(Math.round((roadX - lanes[0]) / 95), 0, 3);
      desiredY = clamp(y, 105, 337);
    }
    function defend() {
      if (close() && jam <= 0 && stealLock <= 0) {
        carrier = 'agi';
        stealLock = 1.55;
        notice = 'AGI-1 PIRATED YOUR TAPE';
        flash = 1.4;
        api.sound('back');
      } else if (close() && jam > 0) {
        blocks++;
        score += 85;
        notice = 'SIGNAL BLOCKED!';
        flash = 1.35;
        api.sound('combo');
      }
      stealLock = Math.max(stealLock, .7);
    }
    return {
      key(type, k) {
        if (type === 'down') {
          held.add(k);
          if (k === 'ArrowLeft' || k === 'KeyA') lane = clamp(lane - 1, 0, 3);
          if (k === 'ArrowRight' || k === 'KeyD') lane = clamp(lane + 1, 0, 3);
          if (k === 'Space') radio();
        } else held.delete(k);
      },
      pointer(type, x, y) {
        if (type === 'down') {
          if (y > 399) radio();else {
            drag = true;
            choose(x, y);
          }
        } else if (type === 'move' && drag) choose(x, y);else if (type === 'up' || type === 'cancel') drag = false;
      },
      cancelInput() {
        drag = false;
        held.clear();
      },
      demo(dt) {
        demoT -= dt;
        if (demoT > 0) return;
        demoT = .12;
        if (carrier === 'agi') {
          lane = rLane === 3 ? 2 : rLane + 1;
          desiredY = ry + 5;
          if (close() && stealLock <= 0) radio();
        } else {
          if (threat > .01 && threat < .52 && close()) radio();
          lane = rx < 240 ? 3 : 0;
          desiredY = ry < 230 ? 327 : 113;
        }
        const cone = obstacles.find(o => o.lane === lane && py - o.y > 0 && py - o.y < 65);
        if (cone) lane = lane > 0 ? lane - 1 : 1;
      },
      update(dt) {
        if (ended) return;
        t += dt;
        clock -= dt;
        road += dt * 185;
        flash -= dt;
        jam = Math.max(0, jam - dt);
        jamWait = Math.max(0, jamWait - dt);
        stealLock = Math.max(0, stealLock - dt);
        staticT = Math.max(0, staticT - dt);
        ai -= dt;
        spawn -= dt;
        const k = (...v) => Number(v.some(a => held.has(a)));
        desiredY = clamp(desiredY + dt * 136 * (k('ArrowDown', 'KeyS') - k('ArrowUp', 'KeyW')), 105, 337);
        if (ai <= 0) {
          if (carrier === 'agi') {
            const step = api.rng() > .5 ? 1 : -1;
            rLane = rLane === 0 ? 1 : rLane === 3 ? 2 : rLane + step;
            rTarget = 145 + api.rng() * 126;
            ai = 2.5 + api.rng() * 1.1;
          } else {
            rLane = lane === 3 ? 2 : lane + 1;
            rTarget = desiredY;
            ai = .63;
          }
        }
        previousX = px;
        previousRX = rx;
        px += (lanes[lane] - px) * Math.min(1, dt * (staticT ? 2.1 : 6.1));
        py += (desiredY - py) * Math.min(1, dt * 4.5);
        rx += (lanes[rLane] - rx) * Math.min(1, dt * 3.0);
        ry += (rTarget - ry) * Math.min(1, dt * 2.4);
        tilt = clamp((px - previousX) / dt * .00068, -.18, .18);
        rt = clamp((rx - previousRX) / dt * .00072, -.18, .18);
        if (carrier === 'you' && threat <= 0 && stealLock <= 0 && connected()) {
          threat = .87;
          api.sound('tick');
        }
        if (threat > 0) {
          threat -= dt;
          if (threat <= 0) defend();
        }
        if (spawn <= 0) {
          obstacles.push({
            lane: Math.floor(api.rng() * 4),
            y: 56,
            hit: false
          });
          spawn = 2.5 + api.rng() * 1.2;
        }
        for (const o of obstacles) {
          o.y += dt * 133;
          if (!o.hit && Math.abs(px - lanes[o.lane]) < 26 && Math.abs(py - o.y) < 30) {
            o.hit = true;
            staticT = .7;
            desiredY = clamp(py + 30, 105, 337);
            score = Math.max(0, score - 20);
            notice = 'ROADWORKS • RADIO STATIC';
            flash = .85;
            api.sound('hurt');
          }
        }
        while (obstacles[0]?.y > 387) obstacles.shift();
        if (carrier === 'you') pTime += dt;else rTime += dt;
        if (pTime >= goal || rTime >= goal || clock <= 0) {
          finish();
          return;
        }
        api.hud('Your airtime', pTime.toFixed(1) + 's', 'AGI-1', rTime.toFixed(1) + 's');
      },
      draw(c) {
        world(c, Math.sin(t * .4) * 3, 0);
        poly(c, [project(49, 56), project(431, 56), project(431, 387), project(49, 387)], '#1b203be9');
        c.save();
        c.beginPath();
        c.rect(0, 56, 480, 331);
        c.clip();
        for (const side of [40, 439]) {
          line(c, [project(side, 56), project(side, 390)], '#f36ba0', 3);
          line(c, [project(side - 3, 56), project(side - 3, 390)], '#6abccc', 1);
        }
        for (let i = 0; i < 5; i++) {
          const x = 50 + i * 95;
          for (let j = 0; j < 10; j++) {
            const f = (road * .003 + j * .1) % 1,
              y = 54 + 335 * f * f,
              n = 4 + 23 * f;
            line(c, [project(x, y), project(x, y + n)], i === 0 || i === 4 ? '#e87db2' : '#b4bdd39c', .9 + f * 1.2);
          }
        }
        for (const o of obstacles) {
          if (o.hit) continue;
          const [x, y] = project(lanes[o.lane], o.y),
            s = depth(y);
          c.save();
          c.translate(x, y);
          c.scale(s, s);
          panel(c, -15, 8, 30, 5, '#191c2b', 2);
          poly(c, [[0, -14], [11, 9], [-11, 9]], '#ef8756');
          line(c, [[-5, 1], [5, 1]], '#ffe8ae', 3);
          c.restore();
        }
        const [pScreen, pTop] = project(px, py),
          [rScreen, rTop] = project(rx, ry);
        if (connected()) {
          const bright = close() && stealLock <= 0;
          line(c, [[pScreen, pTop], [rScreen, rTop]], bright ? '#ffe88f' : '#a4e4d595', bright ? 3 : 1);
          for (let i = 0; i < 4; i++) {
            const p = (t * 1.5 + i * .25) % 1;
            oval(c, pScreen + (rScreen - pScreen) * p, pTop + (rTop - pTop) * p, 2.2, 2.2, '#ffe9af');
          }
        }
        if (threat > 0) {
          oval(c, rScreen, rTop, 39 * depth(ry), 49 * depth(ry), null, '#ff6d97', 3);
          caption(c, '!', rScreen + 28, rTop - 31, '#fff7bb', 26);
        }
        if (jam > 0) oval(c, pScreen, pTop, 35 + (1 - jam) * 22, 47 + (1 - jam) * 18, null, '#8affef', 3);
        if (py >= ry) {
          rivalCar(c, rx, ry, rt, t);
          player(c, px, py, tilt, t);
        } else {
          player(c, px, py, tilt, t);
          rivalCar(c, rx, ry, rt, t);
        }
        const cx = carrier === 'you' ? pScreen : rScreen,
          cy = carrier === 'you' ? pTop : rTop;
        cassette(c, cx, cy - 48 * depth(cy) + Math.sin(t * 5) * 2, 32 * depth(cy), t);
        c.restore();
        panel(c, 12, 10, 456, 44, '#1e1830', 4);
        caption(c, 'SIDE A   YOU', 23, 23, '#a6f8e5', 12, 'left');
        caption(c, 'SIDE B   AGI-1', 453, 23, '#ffa6d3', 12, 'right');
        meter(c, 23, 36, 166, pTime / goal, '#88e1ce', '#394557');
        meter(c, 292, 36, 163, rTime / goal, '#e976ad', '#51364e');
        cassette(c, 240, 32, 51, t);
        panel(c, 12, 380, 456, 29, '#211d32', 3);
        caption(c, threat > 0 ? 'HEADLIGHTS FLASH • JAM NOW' : flash > 0 ? notice : close() ? 'CARS LINKED' : 'DRAW ALONGSIDE', 240, 395, '#ffe1ab', 14);
        panel(c, 13, 415, 454, 49, carrier === 'agi' ? '#ef85ae' : '#93daca', 4);
        caption(c, carrier === 'agi' ? 'SNATCH THE MIXTAPE' : jamWait > 0 ? 'JAM RECHARGING  ' + jamWait.toFixed(1) : 'JAM HER RADIO', 240, 439, '#262237', 19);
      }
    };
  }
};
