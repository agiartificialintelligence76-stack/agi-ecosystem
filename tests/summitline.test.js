import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game from '../src/games/summitline/game.js';
import { STATIONS, REPERTOIRE, CABINS, phrase, voices } from '../src/games/summitline/repertoire.js';
import { answer, createConcert, drain, encore, finish, step } from '../src/games/summitline/rules.js';
import { listener, simulate } from '../src/games/summitline/ai.js';
import { layout, pickCabin } from '../src/games/summitline/layout.js';
import { book, enter } from '../src/games/summitline/progress.js';
import { LINES } from '../src/games/summitline/lines.js';
import { createBand, VOICINGS } from '../src/games/summitline/sound.js';
const advance = (s, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) step(s, 1 / 120);
};
const echo = s => {
  advance(s, s.times.at(-1) + s.beat + 1);
  assert.equal(s.phase, 'echo');
};
test('24 original labeled melodies make eight distinct stations with usable intervals', () => {
  assert.equal(STATIONS.length, 8);
  assert.equal(REPERTOIRE.length, 24);
  assert.equal(new Set(REPERTOIRE.map(s => s.notes.join(''))).size, 24);
  for (const score of REPERTOIRE) {
    assert.equal(score.notes.length, 16);
    assert.equal(new Set(score.notes).size, 4);
    assert.ok(score.tonic >= 200 && score.tonic <= 350);
    assert.ok(phrase(score, 12, 3).every(mask => voices(mask).length >= 1 && voices(mask).length <= 2));
  }
  assert.equal(new Set(VOICINGS.map(a => a.join(','))).size, 4);
});
test('the first call is playable immediately and the baton waits before accepting answers', () => {
  const s = createConcert();
  assert.equal(s.phase, 'listen');
  assert.equal(answer(s, 1), false);
  advance(s, .36);
  assert.equal(s.shown, 1);
  echo(s);
  assert.deepEqual(s.melody, [1, 2]);
  assert.equal(s.cursor, 0);
});
test('a late echo earns exactly the same points and hearts as a quick one', () => {
  const run = delay => {
    const s = createConcert();
    echo(s);
    for (const n of s.melody) {
      advance(s, delay);
      answer(s, n);
    }
    return [s.score, s.hearts, s.completed, s.longest];
  };
  assert.deepEqual(run(.02), run(35));
});
test('a phrase grows one step and keeps its earlier notes; a rehearsal cancels pending notes and restarts at zero', () => {
  const s = createConcert({
    seed: 133,
    mode: 'climb'
  });
  echo(s);
  const first = [...s.melody];
  first.forEach(n => answer(s, n));
  advance(s, 1);
  assert.deepEqual(s.melody.slice(0, -1), first);
  echo(s);
  answer(s, s.melody[0]);
  encore(s);
  assert.equal(s.cursor, 0);
  assert.equal(s.encores, 1);
  assert.equal(s.hearts, 3);
});
test('a two-voice chord is one memory item and the wrong subset never consumes the next note', () => {
  const s = createConcert({
    start: 12
  });
  echo(s);
  const chord = s.melody.findIndex(m => voices(m).length === 2);
  assert.ok(chord >= 0);
  s.melody.slice(0, chord).forEach(m => answer(s, m));
  const before = s.score;
  answer(s, 1 << voices(s.melody[chord])[0]);
  assert.equal(s.hearts, 2);
  assert.equal(s.score, before);
  assert.equal(s.phase, 'retry');
  advance(s, 1);
  echo(s);
  for (const mask of s.melody) answer(s, mask);
  assert.equal(s.completed, 1);
});
test('three failed echoes settle once, and a bowed concert records only what the player answered', () => {
  const s = createConcert();
  for (let i = 0; i < 3; i++) {
    echo(s);
    answer(s, 8);
    if (i < 2) advance(s, 1);
  }
  assert.equal(s.ended, true);
  const ends = drain(s).filter(e => e.type === 'end');
  assert.equal(ends.length, 1);
  finish(s);
  assert.equal(drain(s).length, 0);
});
test('daily repertoire has stable notes and earned progress survives corrupt or old data', () => {
  const a = createConcert({
      mode: 'daily',
      seed: 20261118
    }),
    b = createConcert({
      mode: 'daily',
      seed: 20261118
    });
  assert.deepEqual(a.melody, b.melody);
  const sequences = new Set(Array.from({
    length: 12
  }, (_, i) => {
    const s = createConcert({
      mode: 'daily',
      seed: 20261118 + i
    });
    return s.piece + '/' + s.melody.join(',');
  }));
  assert.ok(sequences.size > 8);
  a.longest = 7;
  a.score = 100;
  let saved = enter({
    oldBest: 888,
    cableSongbook: {
      stamps: 'broken'
    }
  }, a, 2, true);
  saved = enter(saved, a, 2, true);
  assert.equal(saved.oldBest, 888);
  assert.deepEqual(book(saved).stamps, [2]);
  assert.equal(book(saved).dailies[a.seed], 100);
});
test('focusable commands and physical keyboard both support the two-note alternative', () => {
  const run = () => {
    let result;
    const model = game.create({
      seed: 7,
      mode: 'book',
      options: {},
      store: {
        read: () => ({
          cableSongbook: {
            stamps: Array.from({
              length: 12
            }, (_, i) => i)
          }
        })
      },
      hud() {},
      end: (p, stats) => {
        result = {
          p,
          stats
        };
      }
    });
    return {
      model,
      get result() {
        return result;
      }
    };
  };
  for (const input of ['keyboard', 'dock']) {
    const r = run(),
      s = createConcert({
        seed: 7,
        start: 12
      });
    for (let i = 0; i < 1350; i++) r.model.update(1 / 120);
    const fire = (id, key) => {
      if (input === 'dock') {
        r.model.action(id, 'down');
        r.model.action(id, 'up');
      } else {
        r.model.key('down', key);
        r.model.key('up', key);
      }
    };
    for (const mask of s.melody) {
      const ns = voices(mask);
      if (ns.length === 2) fire('join', 'KeyJ');
      for (const n of ns) fire('bell' + n, 'Digit' + (n + 1));
    }
    fire('bow', 'KeyX');
    assert.equal(Object.fromEntries(r.result.stats)['Phrases answered'], 1);
  }
});
test('all 24 songs clear with a bot using only observed notes; a 24-song book exceeds twenty minutes of technique', () => {
  const s = createConcert({
      seed: 23
    }),
    bot = listener('demo', 23),
    seen = new Set();
  for (let i = 0; i < 130000 && !s.ended; i++) {
    for (const e of drain(s)) bot.observe(e);
    seen.add(s.piece);
    bot.drive(s, 1 / 30);
    step(s, 1 / 30);
  }
  assert.equal(s.songs, 24);
  assert.equal(seen.size, 24);
  assert.equal(s.ended, true);
  assert.ok(s.elapsed > 1200);
});
test('responsive playfield exposes four reachable cabin gestures and controls at all five aspect ratios', () => {
  for (const [w, h] of [[360, 410], [620, 271], [884, 935], [1440, 790], [2560, 1300]]) {
    const l = layout(w, h);
    for (let n = 0; n < 4; n++) {
      const p = l.positions[n];
      assert.equal(pickCabin(l, p.x, p.y), n);
      assert.ok(p.x >= 0 && p.x <= w && p.y >= 17 && p.y < h);
    }
  }
});
test('balanced memory profiles ascend in span and duration without privileged knowledge', () => {
  const rows = ['newbie', 'steady', 'expert'].map(p => Array.from({
    length: 15
  }, (_, i) => simulate(p, i * 7919 + 23)).sort((a, b) => a.time - b.time)[7]);
  assert.ok(rows[0].time > 45);
  assert.ok(rows[1].time >= 120 && rows[1].time < 300);
  assert.ok(rows[2].time > rows[1].time * 1.4);
  assert.ok(rows[2].span > rows[0].span);
});
test('script, synthesized voices and source boundaries are present', () => {
  assert.equal(Object.values(LINES).flat().length, 32);
  for (const text of Object.values(LINES).flat()) assert.equal(text, text.toLowerCase());
  assert.doesNotThrow(() => {
    const b = createBand(null);
    b.bell(3, 262);
    b.effect('miss');
    b.stop();
  });
  const source = fs.readFileSync(new URL('../src/games/summitline/rules.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|document\.|performance\./);
  assert.ok(game.controls.every(d => d.id && d.label));
  assert.equal(CABINS.length, 4);
});
