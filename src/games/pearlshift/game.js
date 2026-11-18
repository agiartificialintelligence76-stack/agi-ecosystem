import { caption, clamp, line, oval, panel, poly, scenery, sprite } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const calls = ['HUM • HUMPBACK', 'CLICK • SPERM WHALE', 'TRILL • BELUGA', 'WALTZ • BLUE WHALE', 'CHIRP • ORCA'];
const probeSpots = [[115, 184], [353, 184], [224, 336]];
function intersect(probes) {
  const [a, b, c] = probes;
  const row = (p, q) => [2 * (q.x - p.x), 2 * (q.y - p.y), p.d * p.d - q.d * q.d + q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y];
  const [u, v, m] = row(a, b),
    [w, z, n] = row(a, c),
    det = u * z - v * w;
  return Math.abs(det) < 1 ? null : [(m * z - v * n) / det, (u * n - m * w) / det];
}
function whale(c, x, y, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 3) * 3);
  c.rotate(.08 * Math.sin(t));
  if (prop(c, -63, -35, 126, 74)) {
    c.restore();
    return;
  }
  poly(c, [[-28, -2], [-46, -13], [-43, -2], [-52, 3], [-34, 6], [-23, 10]], '#7fcaca');
  oval(c, 0, 1, 31, 13, '#53a8b3', '#c7ffeb', 2);
  oval(c, 7, 7, 23, 6, '#acd6c8');
  poly(c, [[-1, 4], [-10, 17], [7, 10]], '#328fa3');
  oval(c, 20, -3, 2.4, 2.4, '#0a2632');
  c.restore();
}
export default {
  title: 'ABYSS FM',
  tagline: 'AGI-1 is live from the sea floor. Somewhere in the static, a whale is answering.',
  instructions: [['Move your hydrophone', 'Tap the listening chart, drag the crosshair, or move with the arrows. AGI-1 follows your cursor.'], ['Ping from different places', 'E or Ping sends out a sound. Its returning ring gives the exact distance to the hidden whale. Place two or three probes far apart and look for their shared intersection.'], ['Broadcast its position', 'Set the crosshair where the rings meet. Space or Broadcast records the song. A wrong guess costs time. Find five voices with as few pings as possible.']],
  keys: [['Arrows / WASD', 'Move hydrophone'], ['E', 'Send ping'], ['Space', 'Broadcast position']],
  touch: [['Tap / drag chart', 'Move hydrophone'], ['Ping / Broadcast', 'Measure / locate']],
  create(api) {
    const whales = Array.from({
      length: 5
    }, () => ({
      x: 90 + api.rng() * 295,
      y: 120 + api.rng() * 204
    }));
    let round = 0,
      t = 0,
      clock = 108,
      score = 0,
      total = 0,
      best = 0,
      misses = 0,
      probes = [],
      x = 235,
      y = 235,
      swimX = x,
      swimY = y,
      splash = 0,
      notice = 'PICK A SPOT, THEN PING',
      reveal = 0,
      ended = false,
      auto = 0,
      drag = false;
    const keys = new Set(),
      boxes = [[14, 413, 166, 51], [190, 413, 275, 51]];
    function finish() {
      if (ended) return;
      ended = true;
      api.end(score, [['Songs archived', round + '/5'], ['Hydrophone pings', total], ['Clean broadcasts', best]], round === 5 ? 'five voices, one ocean. thanks for listening.' : 'this is abyss fm, signing off.');
    }
    function ping() {
      if (ended || reveal > 0) return;
      if (probes.some(p => Math.hypot(p.x - x, p.y - y) < 19)) {
        notice = 'MOVE TO A NEW LISTENING SPOT';
        splash = 1.4;
        return;
      }
      const w = whales[round],
        d = Math.hypot(w.x - x, w.y - y);
      probes.push({
        x,
        y,
        d,
        born: t
      });
      total++;
      if (probes.length > 4) probes.shift();
      clock = Math.max(0, clock - 1.1);
      notice = 'ECHO AT ' + Math.round(d) + ' m';
      splash = 1.3;
      api.sound('bounce', {
        pitch: 1.3 - d / 500,
        spread: 0
      });
    }
    function broadcast() {
      if (ended || reveal > 0) return;
      const w = whales[round],
        error = Math.hypot(x - w.x, y - w.y);
      if (error < 24) {
        const clean = misses === 0;
        score += Math.round(405 + Math.max(0, 23 - error) * 4 + Math.max(0, 4 - probes.length) * 36 + (clean ? 65 : 0));
        best += Number(clean);
        reveal = 1.7;
        notice = 'SIGNAL LOCK • ' + calls[round].split(' • ')[1];
        api.sound('combo');
        if (api.tone) {
          const voice = [126, 219, 342, 89, 265][round];
          api.tone({
            freq: voice,
            slide: voice * 1.36,
            type: 'sine',
            dur: .68,
            attack: .09,
            release: .25,
            vol: .24
          });
          api.tone({
            freq: voice * 1.39,
            slide: voice * .89,
            type: 'sine',
            at: .51,
            dur: .75,
            attack: .10,
            release: .4,
            vol: .17
          });
        }
        api.haptic(22);
      } else {
        clock -= 3.2;
        misses++;
        notice = error < 50 ? 'FAINT VOICE • VERY CLOSE' : 'STATIC • CHECK YOUR RINGS';
        splash = 1.4;
        api.sound('back');
      }
    }
    function setPoint(a, b) {
      x = clamp(a, 37, 443);
      y = clamp(b, 87, 365);
    }
    return {
      key(type, k) {
        if (type === 'down') {
          keys.add(k);
          if (k === 'KeyE') ping();
          if (k === 'Space') broadcast();
        } else keys.delete(k);
      },
      pointer(type, a, b) {
        if (type === 'down') {
          if (b >= 403) {
            if (a < 181) ping();else broadcast();
          } else {
            drag = true;
            setPoint(a, b);
          }
        } else if (type === 'move' && drag) setPoint(a, b);else if (type === 'up' || type === 'cancel') drag = false;
      },
      cancelInput() {
        keys.clear();
        drag = false;
      },
      demo(dt) {
        auto -= dt;
        if (auto > 0 || reveal > 0) return;
        auto = .94;
        if (probes.length < 3) {
          setPoint(...probeSpots[probes.length]);
          ping();
        } else {
          const hit = intersect(probes);
          if (hit) {
            setPoint(...hit);
            broadcast();
          }
        }
      },
      update(dt) {
        if (ended) return;
        t += dt;
        clock -= dt;
        splash -= dt;
        const k = (...v) => Number(v.some(a => keys.has(a)));
        setPoint(x + dt * 145 * (k('ArrowRight', 'KeyD') - k('ArrowLeft', 'KeyA')), y + dt * 145 * (k('ArrowDown', 'KeyS') - k('ArrowUp', 'KeyW')));
        swimX += (x - swimX) * Math.min(1, dt * 4);
        swimY += (y - swimY) * Math.min(1, dt * 4);
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            round++;
            if (round === 5) {
              finish();
              return;
            }
            probes = [];
            misses = 0;
            notice = 'NEXT VOICE • MOVE AND PING';
            splash = 1.6;
          }
        }
        if (clock <= 0) finish();
        api.hud('On air', score, 'Archive', round + '/5');
      },
      draw(c) {
        world(c);
        if (ended) return;
        panel(c, 14, 64, 452, 312, '#021a2a70', 9);
        c.save();
        c.beginPath();
        c.rect(15, 65, 450, 310);
        c.clip();
        for (let a = 40; a < 475; a += 32) line(c, [[a, 66], [a, 374]], '#75f3d932', 1);
        for (let b = 87; b < 375; b += 32) line(c, [[15, b], [465, b]], '#75f3d932', 1);
        for (let i = 0; i < 22; i++) {
          const a = 22 + i * 101 % 430,
            b = 370 - (t * (8 + i % 5) + i * 27) % 301;
          oval(c, a + Math.sin(t + i) * 3, b, 1.4, 1.4, '#9ff4de77');
        }
        probes.forEach((p, i) => {
          const age = t - p.born,
            hue = ['#9ef4d0', '#ffd783', '#f1b1f4', '#8bcafb'][i];
          oval(c, p.x, p.y, p.d, p.d, null, hue, 2.2);
          if (age < 1.3) oval(c, p.x, p.y, Math.max(1, p.d * age / 1.3), Math.max(1, p.d * age / 1.3), null, '#e4fff9', 2);
          oval(c, p.x, p.y, 4, 4, hue);
          panel(c, p.x + 5, p.y - 15, 37, 15, '#122c3c');
          caption(c, Math.round(p.d), p.x + 23, p.y - 8, hue, 10);
        });
        const hx = clamp(swimX + 35 + Math.sin(t * 2) * 2, 55, 426),
          hy = clamp(swimY - 39 + Math.cos(t * 2) * 4, 100, 350);
        line(c, [[hx, hy + 8], [(hx + x) / 2 + 7, (hy + y) / 2 + 12], [x, y]], '#e5d9ae', 1.7);
        actor(c, hx - 36, hy - 38, 74, 74);
        if (reveal > 0) whale(c, whales[round].x, whales[round].y, t);
        oval(c, x, y, 13, 13, null, '#fff4cf', 1.8);
        line(c, [[x - 18, y], [x - 6, y]], '#fff4cf', 2);
        line(c, [[x + 6, y], [x + 18, y]], '#fff4cf', 2);
        line(c, [[x, y - 18], [x, y - 6]], '#fff4cf', 2);
        line(c, [[x, y + 6], [x, y + 18]], '#fff4cf', 2);
        c.restore();
        panel(c, 14, 12, 452, 44, '#061e2a', 3);
        caption(c, 'ABYSS FM  88.1', 26, 34, '#9cffe1', 19, 'left');
        caption(c, calls[round], 451, 35, '#f9dc95', 12, 'right');
        panel(c, 16, 378, 448, 26, '#03232f', 3);
        caption(c, reveal > 0 || splash > 0 ? notice : 'RINGS MEET AT THE SOURCE   /   ' + Math.ceil(clock) + 's', 240, 392, '#c9f5de', 13);
        boxes.forEach(([a, b, w, h], i) => {
          panel(c, a, b, w, h, i ? '#c0f4d7' : '#164858', 5);
          caption(c, i ? 'BROADCAST' : '◉ PING', a + w / 2, b + h / 2, i ? '#11363e' : '#bcffe2', 18);
        });
      }
    };
  }
};
