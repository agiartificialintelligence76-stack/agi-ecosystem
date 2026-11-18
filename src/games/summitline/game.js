import { caption, clamp, line, oval, panel, scenery, sprite } from '../kit/field-art.js';
const world = scenery(new URL('./playfield.webp', import.meta.url));
const actor = sprite(new URL('./agi.webp', import.meta.url));
const prop = sprite(new URL('./prop.webp', import.meta.url));
const notes = [{
  name: 'DO',
  pitch: 1,
  color: '#d55245'
}, {
  name: 'MI',
  pitch: 1.26,
  color: '#eab143'
}, {
  name: 'SOL',
  pitch: 1.498,
  color: '#4f9e98'
}, {
  name: 'LA',
  pitch: 1.682,
  color: '#8c79ac'
}];
const halls = ['VILLAGE MATINÉE', 'PINEWOOD WALTZ', 'BELL TOWER', 'NORTH RIDGE', 'GLACIER ENCORE', 'SUMMIT FINALE'];
const cabins = [[73, 199], [182, 169], [295, 155], [404, 122]];
function cabin(c, x, y, i, glow, t) {
  const {
    color,
    name
  } = notes[i];
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 2.5 + i) * .032 + glow * Math.sin(t * 12) * .035);
  line(c, [[0, -32], [0, -16]], '#263939', 3);
  if (glow > .03) {
    c.save();
    c.globalAlpha = Math.min(.65, glow);
    oval(c, 0, 21, 43 + glow * 12, 37 + glow * 9, '#fff3af');
    c.restore();
  }
  if (prop(c, -43, -34, 86, 88)) {
    panel(c, -20, 26, 40, 22, color, 3);
    caption(c, name, 0, 37, '#19333c', 15);
    if (glow > .2) {
      caption(c, '♪', 34, -19 - glow * 10, '#fff4b9', 27);
      caption(c, '♫', -31, -5 - glow * 12, '#fff4b9', 19);
    }
    c.restore();
    return;
  }
  panel(c, -32, -15, 64, 65, '#243a3b', 13);
  panel(c, -28, -12, 56, 57, color, 10);
  panel(c, -23, -6, 46, 21, '#c9e0d3', 4);
  line(c, [[0, -5], [0, 15]], '#284346', 2);
  caption(c, name, 0, 32, '#172f38', 17);
  if (glow > .2) {
    caption(c, '♪', 32, -17 - glow * 10, '#fff5c3', 26);
    caption(c, '♫', -32, -15 - glow * 16, '#fff5c3', 19);
  }
  c.restore();
}
export default {
  title: 'CABLE CHOIR',
  tagline: 'Four singing cable cars. One very enthusiastic conductor. Your alpine debut starts now.',
  instructions: [['Watch AGI-1 conduct', 'Each colored cabin rings its own note. Follow AGI-1’s baton and watch the score fill with note names.'], ['Play the echo', 'When the baton passes to you, echo those notes in order with 1–4, A/S/D/F or the on-screen keys. Correct notes always count. Matching the pulse earns an extra star.'], ['Ask for an encore', 'Tap AGI-1 or press E to hear the current phrase again. You have three rehearsal tickets for wrong notes. Complete six alpine concerts.']],
  keys: [['1–4 / A S D F', 'Play the gondolas'], ['E', 'Hear the phrase again']],
  touch: [['Cabins / piano keys', 'Play notes'], ['Tap conductor', 'Ask for an encore']],
  create(api) {
    const sheets = halls.map((_, i) => {
      const len = 3 + Math.floor((i + 1) / 2),
        mel = [];
      let last = Math.floor(api.rng() * 4);
      for (let k = 0; k < len; k++) {
        last = (last + 1 + Math.floor(api.rng() * 3)) % 4;
        mel.push(last);
      }
      return {
        mel,
        rhythm: mel.map((v, k) => k === 0 ? 0 : i >= 2 && k % 3 === 1 ? .38 : .7)
      };
    });
    let stage = 0,
      score = 0,
      stars = 0,
      lives = 3,
      rehearsals = 0,
      t = 0,
      clock = 118,
      phase = 'listen',
      index = 0,
      elapsed = -.55,
      events = [],
      responseTime = 0,
      wait = 0,
      glows = [0, 0, 0, 0],
      conductor = 1,
      notice = 'WATCH THE BATON',
      ended = false;
    function times() {
      let total = 0;
      events = sheets[stage].rhythm.map(delta => total += delta);
    }
    function listen() {
      phase = 'listen';
      index = 0;
      elapsed = -.46;
      notice = 'WATCH THE BATON';
      times();
    }
    function ring(i) {
      glows[i] = 1;
      conductor = i;
      if (api.tone) {
        const hz = 392 * notes[i].pitch;
        api.tone({
          freq: hz,
          type: 'sine',
          dur: .82,
          vol: .24,
          attack: .006,
          release: .72
        });
        api.tone({
          freq: hz * 2.01,
          type: 'triangle',
          dur: .30,
          vol: .065,
          attack: .003,
          release: .28
        });
        api.tone({
          freq: hz,
          type: 'sine',
          at: .22,
          dur: .54,
          vol: .07,
          attack: .025,
          release: .48
        });
      } else api.sound('tap', {
        pitch: notes[i].pitch * .76,
        spread: 0
      });
    }
    function finish() {
      if (ended) return;
      ended = true;
      api.end(score, [['Concerts played', stage + '/6'], ['On-beat notes', stars], ['Encores requested', rehearsals]], stage === 6 ? 'the mountains asked us for an encore.' : 'we can rehearse in my gondola.');
    }
    function replay() {
      if (ended || phase !== 'echo') return;
      rehearsals++;
      listen();
    }
    function play(i) {
      if (ended || phase !== 'echo') return;
      ring(i);
      if (i !== sheets[stage].mel[index]) {
        lives--;
        phase = 'rest';
        wait = 1;
        notice = 'ONE MORE REHEARSAL';
        api.sound('back');
        if (!lives) finish();
        return;
      }
      const off = Math.abs(responseTime - (events[index] + .32)),
        timely = off < .27;
      stars += Number(timely);
      score += timely ? 75 : 50;
      notice = timely ? 'RIGHT ON THE BEAT' : 'GOOD NOTE';
      api.haptic(7);
      index++;
      if (index === events.length) {
        score += 130;
        wait = 1.15;
        phase = 'applause';
        notice = 'BRAVO!';
        api.sound('clear');
      }
    }
    listen();
    return {
      key(type, k) {
        if (type !== 'down') return;
        if (k === 'KeyE') {
          replay();
          return;
        }
        let i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(k);
        if (i < 0) i = ['KeyA', 'KeyS', 'KeyD', 'KeyF'].indexOf(k);
        if (i >= 0) play(i);
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        if (y >= 395) {
          play(clamp(Math.floor((x - 12) / 114), 0, 3));
          return;
        }
        if (y >= 245 && x < 176) {
          replay();
          return;
        }
        let choice = -1;
        cabins.forEach(([cx, cy], i) => {
          if (Math.abs(x - cx) < 43 && y > cy - 25 && y < cy + 61) choice = i;
        });
        if (choice >= 0) play(choice);
      },
      demo() {
        if (phase === 'echo' && responseTime >= events[index] + .32) play(sheets[stage].mel[index]);
      },
      update(dt) {
        if (ended) return;
        t += dt;
        clock -= dt;
        glows = glows.map(v => Math.max(0, v - dt * 1.75));
        if (clock <= 0) {
          finish();
          return;
        }
        if (phase === 'listen') {
          elapsed += dt;
          while (index < events.length && elapsed >= events[index]) {
            ring(sheets[stage].mel[index]);
            index++;
          }
          if (index === events.length && elapsed > events.at(-1) + .75) {
            phase = 'echo';
            index = 0;
            responseTime = 0;
            notice = 'YOUR TURN • PLAY IT BACK';
          }
        } else if (phase === 'echo') {
          responseTime += dt;
        } else {
          wait -= dt;
          if (wait <= 0) {
            if (phase === 'applause') {
              stage++;
              if (stage === 6) {
                finish();
                return;
              }
            }
            listen();
          }
        }
        api.hud('Applause', score, 'Concert', stage + 1 + '/6');
      },
      draw(c) {
        world(c);
        if (ended) return;
        line(c, [[-10, 190], [72, 167], [185, 137], [300, 122], [404, 90], [495, 67]], '#254347', 4);
        line(c, [[-10, 186], [72, 163], [185, 133], [300, 118], [404, 86], [495, 63]], '#c9b98a', 1.5);
        cabins.forEach(([x, y], i) => cabin(c, x, y, i, glows[i], t));
        panel(c, 12, 12, 456, 40, '#f4e6bd', 2);
        caption(c, halls[stage], 23, 33, '#304843', 16, 'left');
        caption(c, 'TICKETS  ' + lives, 453, 33, '#a64137', 13, 'right');
        const beat = Math.max(...glows);
        c.save();
        c.translate(111, 372);
        c.rotate(-.06 + (conductor - 1.5) * .022 + beat * .04);
        actor(c, -102, -152 - 3 * beat, 192, 190);
        c.restore();
        panel(c, 183, 264, 280, 105, '#f7e8c6f4', 3);
        caption(c, phase === 'listen' ? 'AGI-1  /  CONDUCTING' : phase === 'echo' ? 'YOU  /  ECHO' : 'MOUNTAIN CHOIR', 199, 283, '#a63f3c', 12, 'left');
        caption(c, notice, 199, 305, '#2d4948', 14, 'left');
        const mel = sheets[stage].mel,
          w = Math.min(36, 240 / mel.length);
        mel.forEach((n, k) => {
          const seen = phase === 'listen' ? k < index : phase === 'applause' || phase === 'echo' && k < index;
          panel(c, 199 + k * (w + 2), 326, w, 26, seen ? notes[n].color : '#d6caaa', 4);
          caption(c, seen ? notes[n].name : '·', 199 + k * (w + 2) + w / 2, 340, '#263e3d', 12);
        });
        if (phase === 'echo') caption(c, 'TAP ME TO REHEAR', 90, 382, '#fcf4c8', 12);else caption(c, 'MAESTRA AGI-1', 90, 382, '#fcf4c8', 12);
        for (let i = 0; i < 4; i++) {
          const x = 12 + i * 114;
          panel(c, x, 399, 108, 65, glows[i] > .2 ? '#fff1c3' : notes[i].color, 5);
          caption(c, notes[i].name, x + 54, 425, '#203b3d', 20);
          caption(c, String(i + 1), x + 54, 448, '#293e3d', 12);
        }
      }
    };
  }
};
