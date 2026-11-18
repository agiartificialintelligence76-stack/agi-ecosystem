import { caption, clamp, line, meter, oval, panel, poly, scenery, sprite, TAU } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const runSheet = typeof Image === 'undefined' ? null : new Image();
if (runSheet) runSheet.src = new URL('./run.webp', import.meta.url).href;
const bands = ['FAR', 'MID', 'NEAR'];
const depthScale = z => 1 + .15 * z;
function project(x, y, z) {
  return [240 + (x - 240) * depthScale(z), y + 32 * z];
}
const depots = ['Poppy Airfield', 'Bell Tower', 'Marigold Pass', 'Tangerine Strait', 'The Windmill', 'Brass Arch', 'Zephyr Spire', 'Little Cloud'];
function biplane(c, x, y, hue, stamp, t) {
  c.save();
  c.translate(x, y);
  if (prop(c, -65, -14, 130, 62)) {
    line(c, [[55, -13 - Math.sin(t * 45) * 4], [56, 21 + Math.sin(t * 45) * 4]], '#ffe6a266', 2);
    c.restore();
    return;
  }
  line(c, [[-49, -4], [-69, -23], [-59, -21], [-36, -4]], '#253e43', 4);
  poly(c, [[-68, -3], [-44, -8], [22, -8], [44, -2], [34, 8], [-20, 9]], hue);
  line(c, [[-56, -7], [-35, -9], [22, -9], [38, -4]], '#fff2c3', 3);
  line(c, [[-29, -13], [23, -13]], '#293337', 6);
  line(c, [[-13, -12], [-5, 13], [15, -12]], '#31454d', 2);
  line(c, [[-30, 9], [30, 9]], hue, 7);
  line(c, [[45, -16], [45, 13]], '#fcf3d7', 2);
  oval(c, 45, -1, 3, 16 * Math.abs(Math.sin(t * 34)) + 2, '#f4ead29b');
  oval(c, -7, 15, 4, 4, '#263238');
  caption(c, stamp, -28, 0, '#fff5cc', 8);
  c.restore();
}
export default {
  title: 'WINGWALK EXPRESS',
  tagline: 'The mail flies with AGI-1. The pilots never land.',
  instructions: [['Charge a jump', 'Hold Space or hold the red airmail ticket. Release to send AGI-1 leaping from the wing. The dotted arc previews her jump.'], ['Cross the flight lanes', 'Each plane marks its depth as Far, Mid or Near. Set the matching depth with Up / Down or the three buttons. AGI-1 crosses lanes in flight. Left / Right or either side of the sky trims the jump.'], ['Deliver the post', 'Land close to the flag for a first-class stamp. Eight deliveries finish the route. Three spare parachutes catch missed jumps.']],
  keys: [['Space', 'Hold and release to leap'], ['← / →', 'Trim in the air'], ['↑ / ↓', 'Set flight depth']],
  touch: [['Hold / release', 'Wind up and leap'], ['Sky left / right', 'Trim in flight'], ['Far / Mid / Near', 'Set flight depth']],
  create(api) {
    const legs = depots.map((name, i) => ({
      name,
      x: 275 + api.rng() * 76,
      y: 260 + (api.rng() - .5) * 76,
      wind: (api.rng() - .5) * (25 + i * 3),
      phase: api.rng() * TAU,
      band: i === 0 ? 0 : i % 3 === 1 ? -1 : i % 3 === 2 ? 1 : 0
    }));
    let stage = 0,
      lives = 3,
      score = 0,
      perfect = 0,
      t = 0,
      clock = 86,
      mode = 'deck',
      power = 0,
      charging = false,
      elapsed = 0,
      origin = 280,
      x = 83,
      y = 280,
      vx = 0,
      vy = 0,
      trim = 0,
      pointerTrim = 0,
      grace = 0,
      note = 'HOLD, AIM, RELEASE',
      flash = 1.9,
      ended = false;
    let z = 0,
      deckZ = 0,
      destZ = 0;
    const keys = new Set();
    const deckY = () => origin + 3 * Math.sin(t * 2.1);
    const target = time => ({
      x: legs[stage].x + 17 * Math.sin(time * 1.15 + legs[stage].phase),
      y: legs[stage].y + 9 * Math.sin(time * 1.7 + legs[stage].phase)
    });
    const velocity = q => [104 + q * 149 + legs[stage].wind, -198 - q * 84];
    function endpoint(q) {
      const [dx, dy] = velocity(q);
      let horizon = 1.4;
      for (let i = 0; i < 3; i++) {
        const dest = target(t + horizon);
        horizon = (-dy + Math.sqrt(Math.max(0, dy * dy + 680 * (dest.y - deckY())))) / 340;
      }
      return {
        x: 83 + dx * horizon,
        dest: target(t + horizon),
        flight: horizon
      };
    }
    function down() {
      if (mode === 'deck' && !charging) {
        charging = true;
        elapsed = 0;
        power = 0;
        api.sound('tap');
      }
    }
    function up() {
      if (!charging || mode !== 'deck') return;
      charging = false;
      [vx, vy] = velocity(power);
      mode = 'air';
      api.sound('whoosh');
    }
    function finish() {
      if (ended) return;
      ended = true;
      api.end(score, [['Letters delivered', stage + '/8'], ['First-class stamps', perfect], ['Parachutes left', lives]], stage === 8 ? 'every letter has a little sky in it.' : 'the flying post will try again tomorrow.');
    }
    function land() {
      const d = target(t),
        error = Math.abs(x - d.x),
        depthError = Math.abs(z - legs[stage].band);
      if (error <= 47 && Math.abs(y - d.y) < 14 && depthError < .48) {
        const bull = error < 13 && depthError < .19;
        score += bull ? 315 : Math.round(215 - error);
        perfect += Number(bull);
        origin = d.y;
        deckZ = legs[stage].band;
        destZ = deckZ;
        stage++;
        note = bull ? 'FIRST CLASS!' : 'LETTER DELIVERED';
        flash = 1.6;
        api.sound(bull ? 'combo' : 'clear');
        api.haptic(18);
        mode = 'transfer';
        grace = .68;
        if (stage === 8) finish();
      }
    }
    return {
      key(type, k) {
        if (type === 'down') {
          keys.add(k);
          if (k === 'Space') down();
          if (k === 'ArrowUp' || k === 'KeyW') destZ = clamp(destZ - 1, -1, 1);
          if (k === 'ArrowDown' || k === 'KeyS') destZ = clamp(destZ + 1, -1, 1);
        } else {
          keys.delete(k);
          if (k === 'Space') up();
        }
      },
      pointer(type, px, py) {
        if (type === 'down') {
          if (py >= 400 && px >= 234) {
            destZ = clamp(Math.floor((px - 234) / 78) - 1, -1, 1);
            return;
          }
          if (mode === 'air') pointerTrim = px < 240 ? -1 : 1;else down();
        } else if (type === 'up') {
          up();
          pointerTrim = 0;
        } else if (type === 'cancel') {
          charging = false;
          pointerTrim = 0;
        }
      },
      cancelInput() {
        charging = false;
        pointerTrim = 0;
        keys.clear();
      },
      demo() {
        if (!ended) destZ = legs[stage].band;
        if (mode === 'deck') {
          if (!charging) down();else if (power > .1 && endpoint(power).x >= endpoint(power).dest.x) up();
        } else if (mode === 'air') trim = clamp((target(t + .15).x - x - vx * Math.max(0, (target(t).y - y) / Math.max(70, vy))) * .025, -1, 1);
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
        if (mode === 'deck') {
          z = deckZ;
          x = 83;
          y = deckY();
          if (charging) {
            elapsed += dt;
            power = 1 - Math.abs(1 - elapsed * 1.12 % 2);
          }
        }
        if (mode === 'transfer') {
          grace -= dt;
          if (grace <= 0) {
            mode = 'deck';
            x = 83;
            y = deckY();
            z = deckZ;
            power = 0;
          }
        }
        if (mode === 'air') {
          z += (destZ - z) * Math.min(1, dt * 4.6);
          const h = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
          const oldY = y;
          x += (vx + 65 * (h || pointerTrim || trim)) * dt;
          y += vy * dt;
          vy += 340 * dt;
          const d = target(t);
          if (vy > 0 && oldY <= d.y + 2 && y >= d.y - 1) land();
          if (mode === 'air' && y > 455) {
            lives--;
            flash = 1.5;
            note = 'PARACHUTE OPEN';
            api.sound('hurt');
            if (!lives) finish();else {
              mode = 'transfer';
              grace = .55;
            }
          }
        }
        trim = 0;
        api.hud('Air mail', score, 'Route', Math.min(stage + 1, 8) + '/8');
      },
      draw(c) {
        world(c, -x * .025, Math.sin(t * .5) * 3);
        if (ended) return;
        const d = target(t);
        const deck = deckY();
        for (let i = 0; i < 7; i++) {
          let sx = (i * 92 - t * (20 + i % 3 * 8)) % 570;
          if (sx < 0) sx += 570;
          line(c, [[sx - 40, 98 + i * 39], [sx - 16, 98 + i * 39]], '#fff4c680', 2);
        }
        const targetZ = legs[stage].band;
        const drawPlane = (px, py, pz, color, number) => {
          const [sx, sy] = project(px, py, pz);
          c.save();
          c.translate(sx, sy);
          c.scale(depthScale(pz), depthScale(pz));
          biplane(c, 0, 13, color, number, t);
          c.restore();
        };
        const [destX, destY] = project(d.x, d.y, targetZ);
        for (const band of [-1, 0, 1]) {
          const p = project(d.x, d.y, band);
          if (band === targetZ) oval(c, p[0], p[1] + 19, 57 * depthScale(band), 11, '#fff4a833', '#fff2b3', 2);else oval(c, p[0], p[1] + 19, 42 * depthScale(band), 5, null, '#fff3c48a', 1);
        }
        drawPlane(83, deck, deckZ, '#e55b44', '01');
        drawPlane(d.x, d.y, targetZ, '#248a86', String(stage + 2).padStart(2, '0'));
        line(c, [[destX, destY], [destX, destY - 26]], '#3c403b', 2);
        panel(c, destX - 21, destY - 41, 43, 18, '#283f47', 3);
        caption(c, bands[targetZ + 1], destX, destY - 32, '#ffeaab', 10);
        if (mode === 'deck') {
          const q = charging ? power : .4;
          const [dx, dy] = velocity(q),
            dur = endpoint(q).flight;
          for (let i = 1; i <= 17; i++) {
            const a = i * dur / 17;
            oval(c, ...project(83 + dx * a, deck + dy * a + 170 * a * a, deckZ + (destZ - deckZ) * (1 - Math.exp(-4.6 * a))), i % 3 ? 2.4 : 3.3, i % 3 ? 2.4 : 3.3, charging ? '#8c3441' : '#fff0c7', '#352f3755', 1);
          }
        }
        const [poseX, poseY] = project(mode === 'transfer' ? Math.min(375, x) : x, y, z);
        c.save();
        c.translate(poseX, poseY);
        c.scale(depthScale(z), depthScale(z));
        if (mode === 'deck' && charging && runSheet?.complete && runSheet.naturalWidth) {
          const frame = Math.floor(elapsed * 12) % 8;
          c.drawImage(runSheet, frame * 68, 0, 68, 86, -48 + power * 14, -64, 66, 71);
        } else actor(c, -38, -73 + Math.sin(t * 5) * 1.5, 77, 77);
        c.restore();
        panel(c, 12, 14, 222, 42, '#f8ebc8', 3);
        caption(c, depots[stage].toUpperCase(), 24, 34, '#303e43', 17, 'left');
        panel(c, 328, 14, 140, 42, '#263e46', 3);
        caption(c, '✉ ' + stage + '/8   ' + Math.ceil(clock) + 's', 398, 35, '#fff1ca', 16);
        panel(c, 13, 395, 454, 70, '#f9edc9', 3);
        for (let i = 0; i < 17; i++) poly(c, [[17 + i * 26, 395], [26 + i * 26, 395], [19 + i * 26, 401], [10 + i * 26, 401]], i % 2 ? '#398b91' : '#d85048');
        caption(c, flash > 0 ? note : mode === 'air' ? 'TRIM LEFT  /  RIGHT' : 'FROM THE FLYING POST', 27, 419, '#4a4141', 12, 'left');
        caption(c, mode === 'air' ? 'AIRBORNE' : charging ? 'RELEASE TO LEAP' : 'HOLD TO LEAP', 27, 444, '#a63f3b', 19, 'left');
        meter(c, 25, 455, 187, charging ? power : 0, '#df5949', '#c6af87');
        caption(c, 'FLIGHT DEPTH   /   TARGET ' + bands[targetZ + 1], 346, 413, '#45433c', 11);
        for (let i = 0; i < 3; i++) {
          const bx = 236 + i * 77,
            sel = i === destZ + 1;
          panel(c, bx, 425, 71, 32, sel ? '#386e72' : '#ddcda9', 4);
          caption(c, bands[i], bx + 35, 441, sel ? '#fff4cb' : '#3f5252', 13);
        }
      }
    };
  }
};
