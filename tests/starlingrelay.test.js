import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/starlingrelay/game.js';
import certificates from '../tools/games/starlingrelay/certificates.json' with { type: 'json' };
import { productions, deck, lighting, playCue } from '../src/games/starlingrelay/productions.js';
import { compile, check, ink, prove, stars, VERSION } from '../src/games/starlingrelay/score.js';
import { blocking, move, initial } from '../src/games/starlingrelay/blocking-map.js';
import { read, unlocked, daily, saveShow, saveRehearsal } from '../src/games/starlingrelay/playbill.js';
import { rehearse, trayLimit } from '../src/games/starlingrelay/directors.js';
import { theatreLayout } from '../src/games/starlingrelay/theatre.js';
import { lines } from '../src/games/starlingrelay/lines.js';
import { voices } from '../src/games/starlingrelay/sound.js';
const show = (main = [], dance = []) => ({ main, dance });
const mem = () => {
  let d = { existing: 1 };
  return { read: () => d, update: (f) => (d = f(d)) };
};
function gameAt(opt = {}) {
  let controls = [],
    message = '',
    hud = [],
    result = null;
  const store = opt.store || mem();
  const model = game.create({
    seed: 7,
    store,
    ...opt,
    controls: (v) => (controls = v),
    say: (v) => (message = v),
    hud: (...v) => (hud = v),
    end: (...v) => (result = v),
  });
  return {
    model,
    store,
    press: (id) => model.action(id, 'down'),
    get controls() {
      return controls;
    },
    get message() {
      return message;
    },
    get hud() {
      return hud;
    },
    get result() {
      return result;
    },
  };
}
test('42 distinct written productions reproduce their exact signed scripts in every light plot', () => {
  assert.equal(productions.length, 42);
  assert.equal(new Set(productions.map((s) => s.beats.join('|'))).size, 42);
  for (const s of productions) {
    const p = prove(s),
      literal = certificates.find((c) => c.id === s.id);
    assert.equal(literal.grammar, VERSION);
    assert.equal(literal.par, p.par);
    assert.equal(ink(literal), p.par);
    assert.deepEqual(literal.main, p.main);
    assert.deepEqual(literal.dance, p.dance);
    assert.ok(check(s, literal).ok, s.name);
    const layouts = blocking(s);
    assert.equal(layouts.traces.length, s.plots);
    for (const trace of layouts.traces) {
      assert.equal(trace.length, s.beats.length + 1);
      if (s.act === 4)
        for (const {
          actors: [a, b],
        } of trace)
          assert.ok(a.x !== b.x || a.y !== b.y, s.name);
    }
  }
});
test('independent enumeration of every affordable tiny written score agrees with the interval proof', () => {
  const alphabet = ['S', 'B', '(', '2', '3'];
  const best = new Map();
  function brute(seq, cost) {
    if (cost > 6 || seq.length > 9) return;
    let stack = [[]],
      valid = true;
    for (const token of seq) {
      if (token === '(') stack.push([]);
      else if (token === '2' || token === '3') {
        if (stack.length < 2) {
          valid = false;
          break;
        }
        const inside = stack.pop();
        if (!inside.length) {
          valid = false;
          break;
        }
        for (let times = 0; times < Number(token); times++) stack.at(-1).push(...inside);
      } else stack.at(-1).push(token);
      if (stack.at(-1).length > 8) {
        valid = false;
        break;
      }
    }
    if (!valid || stack.length > 3) return;
    if (stack.length === 1 && stack[0].length) {
      const target = stack[0].join('');
      best.set(target, Math.min(best.get(target) ?? Infinity, cost));
    }
    for (const token of alphabet)
      brute([...seq, token], cost + (token === '(' ? 0 : token === '2' || token === '3' ? 2 : 1));
  }
  brute([], 0);
  for (const [text, cost] of best) {
    if (text.length > 7) continue;
    const s = { ...productions[8], beats: [...text] };
    assert.equal(prove(s).par, cost, text);
  }
});
test('an encore, named routine and conditional have separately counted ink, source positions and stack limits', () => {
  const scene = productions[39],
    p = show(['(', '@', '3', '?BW'], ['S', 'B']);
  assert.equal(ink(p), 11);
  const expanded = compile(scene, p);
  assert.equal(expanded.error, '');
  assert.deepEqual(
    expanded.beats.map((c) => c.code),
    ['S', 'B', 'S', 'B', 'S', 'B', '?BW']
  );
  assert.equal(expanded.beats[2].call, 1);
  assert.equal(expanded.beats[2].encore, 2);
  assert.equal(expanded.beats[2].track, 'dance');
  assert.match(compile(scene, show(['@'], ['@'])).error, /itself/);
  assert.match(compile(scene, show(['('])).error, /Close/);
  assert.match(compile(scene, show(['2'])).error, /Open/);
  assert.match(compile(scene, show(['(', '3'])).error, /needs/);
  assert.match(compile(scene, show(['@'])).error, /before/);
  assert.match(compile(scene, show(['(', '(', '(', '(', '(', 'S', '3', '3', '3', '3', '3'])).error, /96/);
});
test('many later scores must actually compress to fit the ink tray; a named dance can do strictly better than encores alone', () => {
  const compressed = productions.filter((s) => ink(show(s.beats)) > trayLimit(s, prove(s).par));
  assert.ok(compressed.length >= 10);
  const s = productions[16],
    p = prove(s),
    without = prove({ ...s, act: 1 });
  assert.ok(p.dance.length);
  assert.ok(p.par < without.par);
  assert.deepEqual([stars(9, 9), stars(11, 9), stars(12, 9)], [3, 2, 1]);
});
test('a cue that fits the first lamp can miss the second on the very same beat', () => {
  const s = productions[24],
    index = s.beats.findIndex((c) => c.startsWith('?'));
  const first = playCue(s.beats[index], lighting(s, index, 0));
  const noBranch = s.beats.map((c, i) => (i === index ? first : c));
  const result = check(s, show(noBranch));
  assert.equal(result.ok, false);
  assert.equal(result.plot, 1);
  assert.equal(result.beat, index);
  assert.equal(check(s, show(s.beats)).ok, true);
});
test('actor handoff preserves the first performer and the cat pose targets only the understudy', () => {
  let cast = initial();
  cast = move(cast, 'S');
  const a = { ...cast.actors[0] };
  cast = move(cast, 'K');
  cast = move(cast, 'S');
  cast = move(cast, 'P');
  assert.equal(cast.active, 1);
  assert.equal(cast.actors[1].pose, 'paw');
  assert.deepEqual([cast.actors[0].x, cast.actors[0].y], [a.x, a.y]);
  cast = move(cast, 'K');
  assert.equal(cast.active, 0);
});
test('dates produce reproducible playbills with complementary plots, while a library can store a rehearsal apart', () => {
  const ids = new Set();
  for (const n of [1, 2, 18, 94, 20261118, 20261119]) {
    const s = daily(n);
    ids.add(s.id);
    assert.deepEqual(s, daily(n));
    assert.ok(s.plots >= 2);
    assert.ok(check(s, prove(s)).ok);
  }
  assert.ok(ids.size > 2);
  const store = mem(),
    s = productions[0],
    p = prove(s);
  saveShow(store, s, p, p.par, 'season', 7);
  saveShow(store, s, p, p.par, 'daily', 20261119);
  saveRehearsal(store, s, show(['S']));
  const book = read(store.read());
  assert.equal(book.scenes[1].stars, 3);
  assert.equal(book.daily[20261119].id, 1);
  assert.deepEqual(book.rehearsal.main, ['S']);
  assert.equal(store.read().existing, 1);
  assert.deepEqual(read({ playbill: { v: -4 } }).scenes, {});
});
test('six separate successful productions unlock an act; a wrong rehearsal or duplicate cannot', () => {
  const store = mem();
  for (const s of productions.slice(0, 5)) saveShow(store, s, prove(s), prove(s).par, 'season', 8);
  saveShow(store, productions[5], show(['S']), 5, 'season', 8);
  assert.equal(unlocked(read(store.read()), productions[8]), false);
  saveShow(store, productions[5], prove(productions[5]), prove(productions[5]).par, 'season', 8);
  assert.ok(unlocked(read(store.read()), productions[8]));
  assert.equal(unlocked(read(store.read()), productions[16]), false);
});
test('button editing, keyboard, a deterministic missed mark and a first nonzero receipt run through the real host contract', () => {
  const g = gameAt();
  g.press('go');
  for (let i = 0; i < 180; i++) g.model.update(1 / 120);
  assert.match(g.message, /needs Bow/);
  g.press('edit');
  g.press('before');
  g.press('after');
  g.model.key('down', 'KeyB');
  g.press('undo');
  g.press('card:B');
  g.model.key('down', 'KeyG');
  for (let i = 0; i < 250; i++) g.model.update(1 / 120);
  assert.ok(g.controls.some((b) => b.id === 'file'));
  g.press('file');
  assert.ok(g.result[0] > 0);
  assert.equal(read(g.store.read()).scenes[1].stars, 3);
});
test('single stepping can be edited after an error and demo executes its own correct show without saving', () => {
  const f = gameAt();
  f.press('card:B');
  f.press('single');
  f.press('single');
  f.press('single');
  assert.ok(f.controls.some((b) => b.id === 'replay'));
  const g = gameAt({ demo: true });
  for (let i = 0; i < 1800 && !g.result; i++) {
    g.model.demo(1 / 120);
    g.model.update(1 / 120);
  }
  assert.ok(g.result[0] > 0);
  assert.deepEqual(g.store.read(), { existing: 1 });
});
test('the three simulated editors have separate behavior, all plot cues can be placed, and the theatre scales on five shapes', () => {
  for (const s of productions) for (const op of s.beats) assert.ok(deck(s).includes(op));
  const scene = productions[31];
  assert.deepEqual(rehearse(scene, 'regular', 314), rehearse(scene, 'regular', 314));
  assert.ok(rehearse(scene, 'expert', 314).score > 0);
  assert.ok(rehearse(scene, 'newcomer', 314).seconds > rehearse(scene, 'expert', 314).seconds);
  assert.ok(Object.values(lines).flat().length >= 32);
  assert.ok(Object.keys(voices).length >= 12);
  for (const [w, h] of [
    [360, 380],
    [700, 285],
    [884, 880],
    [1440, 715],
    [2560, 1100],
  ])
    for (const s of productions) {
      const l = theatreLayout(w, h, s);
      for (const pt of l.board.cells) {
        const [x, y] = l.project(...pt);
        assert.ok(x >= 0 && x < w && y >= l.header && y < l.floorBottom, s.name);
      }
    }
});
