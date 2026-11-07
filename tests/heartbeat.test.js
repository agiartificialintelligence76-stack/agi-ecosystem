// HEARTBEAT (2026-11-08): AGI-1's rhythm game. Its charts (made once by tools/games/heartbeat/chart.py from her seven
// songs), its rules (judgments, the score, grades), a run played by hand and by its demo player, the song's clock, the
// layout, and the files it ships. No browser, no network. Run: node --test tests/heartbeat.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import {
  WINDOW, WORTH, FEVER_AT, HOLD_GRACE, MAX_SCORE, judge, gradeOf, withArticle, maxValue, maxComboSum, scoreOf,
  accuracyOf, stampOf, approachOf, clampOffset, clampSpeed, SPEED, OFFSET,
} from '../src/games/heartbeat/rules.js';
import { createRun, MISS_GRACE } from '../src/games/heartbeat/engine.js';
import { notesOf, applyOffset, densityOf, levelOf, beatAt, energyAt, isDownbeat, clock, DIFFS } from '../src/games/heartbeat/chart.js';
import { createSongClock, eventPerf, SNAP } from '../src/games/heartbeat/clock.js';
import { createAutoplay } from '../src/games/heartbeat/autoplay.js';
import { layoutOf, project, laneAt, laneX, MAX_W } from '../src/games/heartbeat/layout.js';
import { END, STAGE, endLine } from '../src/games/heartbeat/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SONGS = ['feel-the-agi', 'si-its-better', 'send-it', 'mainrunner', 'save-slot-2', 'agi', 'after-agi'];
const RANGE = { easy: [1.2, 1.8], normal: [2.5, 3.5], hard: [4.5, 6.0] };
const charts = Object.fromEntries(SONGS.map((id) => [id, JSON.parse(read(`src/games/heartbeat/charts/${id}.json`))]));

// ---------- the charts ----------

test('a chart for each of her seven songs, three difficulties each, in the format the game reads', () => {
  const index = JSON.parse(read('src/games/heartbeat/charts/index.json'));
  assert.deepEqual(index.map((s) => s.id), SONGS);
  for (const id of SONGS) {
    const c = charts[id];
    assert.equal(c.id, id);
    assert.equal(typeof c.title, 'string');
    assert.ok(c.bpm > 60 && c.bpm < 220, `${id} bpm ${c.bpm}`);
    assert.ok(c.duration > 120 && c.duration < 300, `${id} duration`);
    assert.ok(c.offset >= 0 && c.offset < 5, `${id} offset`);
    assert.equal(c.preview.length, 2);
    assert.ok(c.preview[0] >= 0 && c.preview[1] <= c.duration && c.preview[1] > c.preview[0], `${id} preview`);
    assert.ok(Number.isInteger(c.bar) && c.bar >= 0 && c.bar < 4);
    assert.ok(c.beats.length > 200, `${id} beats`);
    for (let k = 1; k < c.beats.length; k++) assert.ok(c.beats[k] > c.beats[k - 1], `${id} beats rise`);
    assert.match(c.energy, /^[0-9]+$/);
    assert.equal(c.energy.length, c.beats.length);
    assert.deepEqual(Object.keys(c.charts), DIFFS);
    const meta = index.find((s) => s.id === id);
    assert.equal(meta.title, c.title);
    for (const d of DIFFS) assert.equal(meta.notes[d], c.charts[d].length);
  }
});

test('every note: in time order, inside the song, in lanes 0–3, holds with a real length, times to the millisecond', () => {
  for (const id of SONGS) {
    const c = charts[id];
    for (const d of DIFFS) {
      const rows = c.charts[d];
      assert.ok(rows.length > 100, `${id} ${d} has notes`);
      let prev = -1;
      for (const row of rows) {
        assert.ok(row.length === 2 || row.length === 3, `${id} ${d} row shape`);
        const [t, lane, hold = 0] = row;
        assert.ok(t >= prev, `${id} ${d} sorted at ${t}`);
        prev = t;
        assert.ok(t >= 0 && t + hold <= c.duration, `${id} ${d} ${t} inside the song`);
        assert.ok(Number.isInteger(lane) && lane >= 0 && lane <= 3, `${id} ${d} lane`);
        assert.equal(Math.round(t * 1000) / 1000, t, 'three decimals');
        if (row.length === 3) assert.ok(hold >= 0.3 && hold <= 4, `${id} ${d} hold ${hold}`);
      }
    }
  }
});

test('densities follow the difficulty: EASY 1.2–1.8, NORMAL 2.5–3.5, HARD 4.5–6 notes a second', () => {
  for (const id of SONGS) {
    for (const d of DIFFS) {
      const nps = densityOf(notesOf(charts[id].charts[d]));
      assert.ok(nps >= RANGE[d][0] && nps <= RANGE[d][1], `${id} ${d}: ${nps.toFixed(2)}/s`);
    }
  }
});

test('playable: no same-lane notes within 120 ms on EASY and NORMAL (nor HARD), nothing inside a held lane', () => {
  for (const id of SONGS) {
    for (const d of DIFFS) {
      const last = [-9, -9, -9, -9];
      for (const n of notesOf(charts[id].charts[d])) {
        assert.ok(n.t - last[n.lane] >= 0.12 - 1e-6, `${id} ${d}: lane ${n.lane} at ${n.t} (${((n.t - last[n.lane]) * 1000).toFixed(0)} ms after its last)`);
        last[n.lane] = n.t + n.hold;
      }
    }
  }
});

test('EASY is single notes on the beat grid; NORMAL has a few doubles and holds; HARD more of both, never 3 at once', () => {
  for (const id of SONGS) {
    const c = charts[id];
    const by = (d) => {
      const m = new Map();
      for (const n of notesOf(c.charts[d])) m.set(n.t, (m.get(n.t) || 0) + 1);
      return m;
    };
    const easy = by('easy');
    assert.ok([...easy.values()].every((v) => v === 1), `${id} easy: no chords`);
    assert.equal(notesOf(c.charts.easy).filter((n) => n.hold > 0).length, 0, `${id} easy: no holds`);
    for (const d of ['normal', 'hard']) {
      const m = by(d);
      assert.ok([...m.values()].every((v) => v <= 2), `${id} ${d}: at most doubles`);
      const doubles = [...m.values()].filter((v) => v === 2).length;
      const holds = notesOf(c.charts[d]).filter((n) => n.hold > 0).length;
      assert.ok(doubles >= 5, `${id} ${d}: doubles ${doubles}`);
      assert.ok(holds >= 3, `${id} ${d}: holds ${holds}`);
      assert.ok(doubles / m.size < (d === 'normal' ? 0.06 : 0.15), `${id} ${d}: doubles stay occasional`);
    }
    // a chord never sits on a held lane, and no chord while something's held
    for (const d of DIFFS) {
      const ns = notesOf(c.charts[d]);
      const holds = ns.filter((n) => n.hold > 0);
      for (const h of holds) {
        const during = ns.filter((n) => n !== h && n.t > h.t && n.t < h.t + h.hold);
        assert.ok(during.every((n) => n.lane !== h.lane), `${id} ${d}: lane ${h.lane} is held at ${h.t}`);
      }
    }
  }
});

test('notes land on the song\'s own beat grid (16ths between its beats), which drifts with the song', () => {
  for (const id of SONGS) {
    const c = charts[id];
    const grid = [];
    for (let k = 0; k + 1 < c.beats.length; k++) for (let j = 0; j < 4; j++) grid.push(c.beats[k] + (c.beats[k + 1] - c.beats[k]) * j / 4);
    grid.push(c.beats[c.beats.length - 1]);
    const near = (t) => {
      let lo = 0, hi = grid.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (grid[m] <= t) lo = m; else hi = m; }
      return Math.min(Math.abs(grid[lo] - t), Math.abs(grid[hi] - t));
    };
    for (const d of DIFFS) for (const n of notesOf(c.charts[d])) assert.ok(near(n.t) < 0.0015, `${id} ${d} ${n.t} on the grid`);
    // EASY: beats and (now and then) 8ths only
    const eighths = [];
    for (let k = 0; k + 1 < c.beats.length; k++) eighths.push(c.beats[k], (c.beats[k] + c.beats[k + 1]) / 2);
    for (const n of notesOf(c.charts.easy)) assert.ok(eighths.some((g) => Math.abs(g - n.t) < 0.0015), `${id} easy ${n.t} on a beat or an 8th`);
  }
});

test('density follows the song: its loudest parts get more notes than its quietest', () => {
  for (const id of SONGS) {
    const c = charts[id];
    const ns = notesOf(c.charts.normal);
    const beatsLoud = [], beatsQuiet = [];
    for (let k = 0; k + 1 < c.beats.length; k++) (Number(c.energy[k]) >= 6 ? beatsLoud : Number(c.energy[k]) <= 3 ? beatsQuiet : []).push(k);
    const rate = (ks) => {
      if (!ks.length) return 0;
      let n = 0, dur = 0;
      for (const k of ks) {
        const a = c.beats[k], b = c.beats[k + 1];
        dur += b - a;
        n += ns.filter((x) => x.t >= a && x.t < b).length;
      }
      return n / dur;
    };
    if (beatsLoud.length > 20 && beatsQuiet.length > 20) assert.ok(rate(beatsLoud) > rate(beatsQuiet) * 1.15, `${id}: loud ${rate(beatsLoud).toFixed(2)} vs quiet ${rate(beatsQuiet).toFixed(2)}`);
  }
});

test('lanes are used evenly and the charts move (no lane hogging, few repeats)', () => {
  for (const id of SONGS) {
    for (const d of DIFFS) {
      const ns = notesOf(charts[id].charts[d]);
      const use = [0, 0, 0, 0];
      for (const n of ns) use[n.lane]++;
      for (const u of use) assert.ok(u / ns.length > 0.18 && u / ns.length < 0.32, `${id} ${d} lane use ${use}`);
    }
  }
});

test('levels: 1–12, EASY < NORMAL < HARD for every song, and the setlist shows the same ones', () => {
  const index = JSON.parse(read('src/games/heartbeat/charts/index.json'));
  for (const id of SONGS) {
    const lv = DIFFS.map((d) => levelOf(notesOf(charts[id].charts[d])));
    assert.deepEqual(DIFFS.map((d) => index.find((s) => s.id === id).levels[d]), lv, `${id}: index.json's levels`);
    for (const v of lv) assert.ok(v >= 1 && v <= 12);
    assert.ok(lv[0] < lv[1] && lv[1] < lv[2], `${id} levels ${lv}`);
  }
});

// ---------- the rules ----------

test('judgment windows: PERFECT ≤ 45 ms, GREAT ≤ 90, GOOD ≤ 135, early or late alike', () => {
  assert.deepEqual(WINDOW, { perfect: 0.045, great: 0.09, good: 0.135 });
  assert.equal(judge(0), 'perfect');
  assert.equal(judge(0.045), 'perfect');
  assert.equal(judge(-0.045), 'perfect');
  assert.equal(judge(0.0451), 'great');
  assert.equal(judge(-0.09), 'great');
  assert.equal(judge(0.0901), 'good');
  assert.equal(judge(-0.135), 'good');
  assert.equal(judge(0.136), null);
  assert.equal(judge(-0.2), null);
});

test('score: all PERFECT is exactly 1,000,000 (FEVER included), GREAT 70 %, GOOD 40 %, nothing above the max', () => {
  for (const units of [1, 10, 49, 50, 51, 99, 100, 101, 587, 1349]) {
    let value = 0, comboSum = 0;
    for (let i = 1; i <= units; i++) { value += WORTH.perfect * (i > FEVER_AT ? 12 : 10); comboSum += Math.min(i, 100); }
    assert.equal(value, maxValue(units));
    assert.equal(comboSum, maxComboSum(units));
    assert.equal(scoreOf({ value, comboSum }, units), MAX_SCORE, `${units} units`);
  }
  assert.equal(scoreOf({ value: 0, comboSum: 0 }, 0), 0);
  assert.equal(WORTH.great / WORTH.perfect, 0.7);
  assert.equal(WORTH.good / WORTH.perfect, 0.4);
  assert.equal(WORTH.break, WORTH.good, 'a hold let go early is worth a GOOD');
  assert.equal(accuracyOf(10 * 20, 20), 100);
  assert.equal(accuracyOf(7 * 20, 20), 70);
});

test('grades: S+ ≥ 98 %, S ≥ 95, A ≥ 90, B ≥ 80, C ≥ 70, D below; and the stamps', () => {
  assert.equal(gradeOf(100), 'S+');
  assert.equal(gradeOf(98), 'S+');
  assert.equal(gradeOf(97.99), 'S');
  assert.equal(gradeOf(95), 'S');
  assert.equal(gradeOf(94.9), 'A');
  assert.equal(gradeOf(90), 'A');
  assert.equal(gradeOf(89.9), 'B');
  assert.equal(gradeOf(80), 'B');
  assert.equal(gradeOf(79.9), 'C');
  assert.equal(gradeOf(70), 'C');
  assert.equal(gradeOf(69.9), 'D');
  assert.equal(gradeOf(0), 'D');
  assert.equal(withArticle('S+'), 'an S+');
  assert.equal(withArticle('A'), 'an A');
  assert.equal(withArticle('B'), 'a B');
  assert.equal(stampOf({ perfect: 10, great: 0, good: 0, miss: 0, break: 0 }), 'ALL PERFECT');
  assert.equal(stampOf({ perfect: 10, great: 2, good: 1, miss: 0, break: 0 }), 'FULL COMBO');
  assert.equal(stampOf({ perfect: 10, great: 0, good: 0, miss: 1, break: 0 }), null);
  assert.equal(stampOf({ perfect: 10, great: 0, good: 0, miss: 0, break: 1 }), null);
});

test('settings: speed ×0.8–×2.0 (×1.2 by default), offset ±200 ms', () => {
  assert.equal(SPEED.def, 1.2);
  assert.equal(clampSpeed(5), 2);
  assert.equal(clampSpeed(0.1), 0.8);
  assert.equal(clampSpeed(1.25), 1.3);
  assert.ok(approachOf(2) < approachOf(1.2) && approachOf(1.2) < approachOf(0.8));
  assert.equal(clampOffset(999), OFFSET.max);
  assert.equal(clampOffset(-999), OFFSET.min);
  assert.equal(clampOffset('12.4'), 12);
  // + offset: the player is late, so each note is due later
  assert.equal(applyOffset(10, 25), 10.025);
  assert.equal(applyOffset(10, -40), 9.96);
});

// ---------- a run ----------

const N = (t, lane, hold = 0) => ({ t, lane, hold });

test('a run: hits judged by their error, ghost taps harmless, a let-through note missed (a little after its window)', () => {
  const run = createRun([N(1, 0), N(2, 1), N(3, 2), N(4, 3), N(5, 0)]);
  assert.equal(run.press(0, 0.5).type, 'tap', 'far too early: nothing');
  assert.equal(run.press(0, 1.03).kind, 'perfect');
  assert.equal(run.press(1, 1.93).kind, 'great');
  assert.equal(run.press(2, 3.12).kind, 'good');
  run.update(4 + WINDOW.good + 0.01);
  assert.equal(run.counts.miss, 0, 'not yet: a late tap could still be on its way');
  run.update(4 + WINDOW.good + MISS_GRACE + 0.01);
  assert.equal(run.counts.miss, 1);
  assert.equal(run.combo, 0);
  assert.equal(run.press(0, 5).kind, 'perfect');
  assert.deepEqual({ ...run.counts }, { perfect: 2, great: 1, good: 1, miss: 1, break: 0 });
  assert.ok(run.done);
  assert.equal(run.maxCombo, 3);
  assert.equal(run.accuracy, (10 + 7 + 4 + 0 + 10) * 10 / 5);
  const kinds = run.drain().map((e) => e.type);
  assert.deepEqual(kinds, ['tap', 'hit', 'hit', 'hit', 'miss', 'hit']);
  assert.deepEqual(run.drain(), []);
});

test('a tap that happened in time but arrived late still counts; a press after a closed window skips to the next note', () => {
  const run = createRun([N(1, 0), N(1.14, 0)]);
  run.update(1 + WINDOW.good + 0.02);                // the frame ran on, the event hadn't arrived yet
  assert.equal(run.press(0, 1.12).kind, 'good', 'judged by when it happened');
  const r2 = createRun([N(1, 0), N(1.2, 0)]);
  const e = r2.press(0, 1.19);
  assert.equal(e.kind, 'perfect', 'the first note\'s window had closed: the press is for the second');
  assert.equal(r2.counts.miss, 1);
});

test('holds: held to the end (or within the grace) is a PERFECT tail; let go early is a GOOD that breaks the combo', () => {
  const run = createRun([N(1, 0, 1.5), N(1, 2), N(4, 1, 1)]);
  assert.equal(run.press(0, 1.01).kind, 'perfect');
  run.press(2, 1.0);
  run.update(2.4);
  assert.equal(run.counts.perfect, 2);
  run.update(2.5);
  assert.equal(run.counts.perfect, 3, 'the tail, at its end');
  assert.equal(run.release(0, 2.6), null, 'already done');
  assert.equal(run.combo, 3);
  run.press(1, 4.0);
  const early = run.release(1, 4.5);
  assert.equal(early.kind, 'break');
  assert.equal(run.combo, 0);
  assert.equal(run.counts.break, 1);
  assert.ok(run.done);
  const r2 = createRun([N(1, 0, 1)]);
  r2.press(0, 1);
  assert.equal(r2.release(0, 2 - HOLD_GRACE + 0.001).kind, 'perfect', 'let go just before the end: fine');
  const r3 = createRun([N(1, 0, 1)]);
  r3.update(3);
  assert.equal(r3.counts.miss, 2, 'a missed hold: its head and its tail');
});

test('FEVER lights at 50 combo (×1.2 from the next note) and goes out with a miss', () => {
  const notes = Array.from({ length: 60 }, (_, i) => N(1 + i * 0.25, i % 4));
  const run = createRun(notes);
  for (let i = 0; i < 49; i++) run.press(i % 4, notes[i].t);
  assert.equal(run.fever, false);
  run.press(49 % 4, notes[49].t);
  assert.equal(run.fever, true);
  const ev = run.drain().filter((e) => e.type === 'fever');
  assert.deepEqual(ev.map((e) => e.on), [true]);
  run.update(notes[51].t + 0.3);
  assert.equal(run.fever, false);
  assert.equal(run.combo, 0);
});

test('a perfect run of a real chart scores 1,000,000 with an ALL PERFECT stamp; the demo player is nearly as good', () => {
  const notes = notesOf(charts['feel-the-agi'].charts.normal);
  const run = createRun(notes);
  const actions = [];
  for (const n of notes) { actions.push([n.t, n.lane, true]); actions.push([n.hold ? n.t + n.hold : n.t + 0.05, n.lane, false]); }
  actions.sort((a, b) => a[0] - b[0] || (a[2] === b[2] ? 0 : a[2] ? 1 : -1));
  for (const [t, lane, down] of actions) { run.update(t); if (down) run.press(lane, t); else run.release(lane, t); }
  run.update(charts['feel-the-agi'].duration);
  assert.ok(run.done);
  assert.equal(run.score, 1_000_000);
  assert.equal(run.stamp, 'ALL PERFECT');
  assert.equal(run.grade, 'S+');
  const demo = createRun(notes);
  const ai = createAutoplay(notes, { seed: 7 });
  for (let t = 0; t < charts['feel-the-agi'].duration; t += 1 / 120) { ai.step(demo, t); demo.update(t); }
  assert.ok(demo.done);
  const share = demo.counts.perfect / (demo.counts.perfect + demo.counts.great + demo.counts.good + demo.counts.miss);
  assert.ok(share > 0.93 && share < 0.995, `demo perfect share ${share}`);
  assert.equal(demo.counts.miss, 0);
  assert.ok(demo.score > 950_000);
  // the same seed plays the same run
  const again = createRun(notes);
  const ai2 = createAutoplay(notes, { seed: 7 });
  for (let t = 0; t < charts['feel-the-agi'].duration; t += 1 / 120) { ai2.step(again, t); again.update(t); }
  assert.equal(again.score, demo.score);
});

test('a pause during a hold: picked up again in time it goes on, else it breaks', () => {
  const r = createRun([N(1, 0, 2)]);
  r.press(0, 1);
  r.update(1.5);
  r.pauseHolds();
  r.release(0, 1.5);                                  // fingers off while the card is up: not a release
  assert.equal(r.counts.break, 0);
  r.resumeHolds(1.8);
  r.update(1.6);
  r.press(0, 1.7);                                    // picked up again
  r.update(3.1);
  assert.equal(r.counts.break, 0);
  assert.equal(r.counts.perfect, 2);
  const r2 = createRun([N(1, 0, 2)]);
  r2.press(0, 1);
  r2.pauseHolds();
  r2.resumeHolds(1.8);
  r2.update(1.9);
  assert.equal(r2.counts.break, 1);
});

test('the demo starts mid-song with its combo going: FEVER from its first second', () => {
  const notes = notesOf(charts['feel-the-agi'].charts.normal);
  const from = charts['feel-the-agi'].preview[0];
  const run = createRun(notes, { from });
  assert.ok(run.notes.every((n) => n.t >= from - 1e-9));
  run.warm(120);
  assert.equal(run.fever, true);
  assert.equal(run.combo, 120);
});

// ---------- the clock ----------

test('the song clock: follows the audio clock smoothly, jumps when far off, maps input times, freezes', () => {
  const c = createSongClock();
  c.tick(1000, 5.0);
  assert.equal(c.now, 5.0);
  c.tick(1016, 5.016 + 0.01);                        // the audio clock is a little ahead: pulled, not jumped
  assert.ok(c.now > 5.016 && c.now < 5.026);
  c.tick(1032, 9.0);                                 // far off: jump
  assert.equal(c.now, 9.0);
  assert.ok(Math.abs(c.at(1012) - 8.98) < 1e-9, 'an input 20 ms before the frame');
  c.tick(1048, null);                                // no audio: keeps time
  assert.ok(Math.abs(c.now - 9.016) < 1e-9);
  c.hold(true);
  c.tick(2000, 50);
  assert.ok(Math.abs(c.now - 9.016) < 1e-9, 'frozen');
  c.hold(false);
  c.jump(3, 3000);
  c.tick(3100, null);
  assert.ok(Math.abs(c.now - 3.1) < 1e-9);
  assert.ok(SNAP > 0.02 && SNAP < 0.06);
  // jittery audio steps (20 ms blocks) come out smooth
  const s = createSongClock();
  const steps = [];
  let prev = null;
  for (let f = 0; f < 300; f++) {
    const perf = 10000 + f * 16.667;
    const audio = Math.floor((f * 16.667) / 20) * 0.02;    // what the audio clock says, in blocks
    s.tick(perf, audio + 0.01);
    if (prev != null) steps.push(s.now - prev);
    prev = s.now;
  }
  const tail = steps.slice(100);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  assert.ok(Math.abs(mean - 0.016667) < 0.001, 'keeps the real speed');
  assert.ok(tail.every((d) => d > 0.008 && d < 0.026), 'never stutters');
  assert.equal(eventPerf(990, 1000), 990);
  assert.equal(eventPerf(0, 1000), 1000);
  assert.equal(eventPerf(1.7e12, 1000), 1000, 'an epoch timestamp');
  assert.equal(eventPerf(1005, 1000), 1000, 'never in the future');
});

// ---------- the layout ----------

test('layout: lanes centred and at most 520 px wide, the hit line low, room for AGI-1, every screen size', () => {
  const sizes = [[390, 844], [360, 740], [360, 640], [844, 390], [820, 1180], [1024, 768], [884, 1104], [1440, 900], [2560, 1440], [480, 480], [480, 640]];
  for (const [w, h] of sizes) {
    const L = layoutOf(w, h, { top: 64 });
    assert.ok(L.nearW <= MAX_W && L.nearW <= w, `${w}x${h} width`);
    assert.ok(Math.abs(L.cx - w / 2) < 1e-9);
    assert.ok(L.hitY < h - 40 && L.hitY > h * 0.6, `${w}x${h} hit line ${L.hitY}`);
    assert.ok(L.farY >= 64 && L.farY < L.hitY - h * 0.35, `${w}x${h} highway ${L.farY}..${L.hitY}`);
    assert.ok(L.her.h >= 90, `${w}x${h} AGI-1 ${L.her.h}`);
    assert.equal(project(L, 0).y, L.hitY);
    assert.ok(Math.abs(project(L, 1).y - L.farY) < 1e-6);
    assert.ok(Math.abs(project(L, 1).k - L.ratio) < 1e-9);
    // taps: the four columns, the outer ones to the edges
    assert.equal(laneAt(L, 0), 0);
    assert.equal(laneAt(L, w - 1), 3);
    for (let lane = 0; lane < 4; lane++) assert.equal(laneAt(L, laneX(L, lane, 1)), lane);
    if (L.wide) assert.ok(L.her.x + L.her.h * 0.53 / 2 <= L.left + 4, `${w}x${h}: AGI-1 beside the lanes`);
  }
  assert.equal(layoutOf(390, 844).wide, false);
  assert.equal(layoutOf(844, 390).wide, true);
});

// ---------- her words and the files ----------

test('AGI-1\'s lines: about twenty, lowercase, short, never about money', () => {
  const all = [...Object.values(END).flat(), ...Object.values(STAGE).flat()];
  assert.ok(all.length >= 20, `${all.length} lines`);
  for (const l of all) {
    assert.ok(l.length <= 60, l);
    assert.doesNotMatch(l, /\b(buy|sell|price|profit|invest|\$|pump|dump|token|coin)\b/i, l);
  }
  for (const l of Object.values(STAGE).flat()) assert.doesNotMatch(l, /\p{Extended_Pictographic}/u, `${l}: drawn on the canvas, no emoji`);
  assert.equal(endLine({ stamp: 'ALL PERFECT', grade: 'S+' }), END.allPerfect[0]);
  assert.equal(endLine({ stamp: 'FULL COMBO', grade: 'A' }), END.fullCombo[0]);
  assert.equal(endLine({ stamp: null, grade: 'D' }), END.low[0]);
  assert.equal(endLine({ stamp: null, grade: 'A', isBest: true }), END.newBest[0]);
});

test('the game ships each song (AAC, small), its cover and its preview; never the lyrics', () => {
  for (const id of SONGS) {
    const a = `public/games/heartbeat/audio/${id}.m4a`;
    const c = `public/games/heartbeat/covers/${id}.webp`;
    const p = `public/games/heartbeat/preview/${id}.m4a`;
    for (const f of [a, c, p]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
    const size = statSync(new URL(`../${a}`, import.meta.url)).size;
    assert.ok(size > 1.5e6 && size < 4e6, `${a} ${size}`);
    assert.ok(statSync(new URL(`../${p}`, import.meta.url)).size < 300e3);
    assert.ok(statSync(new URL(`../${c}`, import.meta.url)).size < 60e3);
  }
  // the page: the intro first, its root, no inline script or style
  const html = read('heartbeat.html');
  assert.match(html, /<div class="gi" id="agi-intro"/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)/);
  assert.doesNotMatch(html, /style="/);
  const entry = read('src/games/heartbeat/page.js');
  assert.match(entry, /^(\/\/.*\n)*import '\.\.\/intro\.js';/);
  // the game's code never sets a style attribute, evals, or reaches another site (SVG's namespace is a name, never fetched)
  for (const f of ['game.js', 'stage.js', 'highway.js', 'music.js', 'screens.js']) {
    const src = read(`src/games/heartbeat/${f}`);
    assert.doesNotMatch(src, /setAttribute\(\s*['"]style['"]/, f);
    assert.doesNotMatch(src, /\beval\(|new Function\(/, f);
    assert.doesNotMatch(src, /https?:\/\/(?!agi1\.app|www\.w3\.org\/2000\/svg['"])/, f);
    assert.doesNotMatch(src, /\bMath\.random\(/, f);
  }
});

test('helpers: beat positions, energy, downbeats, clock text', () => {
  const beats = [1, 1.5, 2, 2.5, 3];
  assert.equal(beatAt(beats, 1), 0);
  assert.equal(beatAt(beats, 1.25), 0.5);
  assert.equal(beatAt(beats, 3), 4);
  assert.equal(beatAt(beats, 3.25), 4.5);
  assert.equal(beatAt(beats, 0.75), -0.5);
  assert.equal(energyAt('09', 0), 0);
  assert.equal(energyAt('09', 1), 1);
  assert.equal(energyAt('09', 0.5), 0.5);
  assert.equal(isDownbeat(5, 1), true);
  assert.equal(isDownbeat(6, 1), false);
  assert.equal(clock(193.1), '3:13');
  assert.equal(clock(59.6), '1:00');
});
