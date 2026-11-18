import { CASES, orderFor, NIGHTS } from './cases.js';
import { initial, act, seals } from './rules.js';
import { ledger, lineup, record, scoreFor, letters } from './book.js';
import { openDesk } from './view.js';
import { paintBooth } from './booth.js';
import { host } from './lines.js';
import { radioSound } from './sound.js';
const controls = [
  { id: 'listen', label: 'Listen back', key: 'L' },
  { id: 'book', label: 'Producer’s book', key: 'B' },
  { id: 'replay', label: 'Replay audio', key: 'R' },
];
const previousRuns = new WeakMap();
export default {
  title: 'OFF THE RECORD',
  tagline:
    'A neighborhood radio mystery in seven nights. Give a caller the one piece of evidence that changes their story.',
  instructions: [
    [
      'Mark a sentence',
      'Read the caller’s two statements. Choose the one that an exhibit makes impossible. You can take as long as you like.',
    ],
    [
      'Work the desk',
      'Ask for detail, choose a physical exhibit, and compare its sides if needed. Put the proof on air to hear the amended recording.',
    ],
    [
      'Mind the listeners',
      'An unsupported pairing costs one light. Listen back to restore one per broadcast. A clean show with a useful follow-up earns three seals.',
    ],
  ],
  keys: [
    ['1–4', 'Choose a numbered claim, exhibit, or moment'],
    ['Q / C / Enter', 'Press the caller, compare sides, or put proof on air'],
    ['Backspace / Y', 'Undo or redo your mark'],
    ['L / B / R', 'Listen back, open the book or replay a cue'],
  ],
  touch: [
    ['Tap a quotation', 'Mark the claim or ask for a detail'],
    ['Tap an exhibit', 'Compare its sides, then put the proof on air'],
    ['Tap the booth', 'Listen to the marked exhibit or station ident'],
    ['Return to transcript', 'Undo the mark and try another statement'],
  ],
  modes: [
    { id: 'story', label: 'Story Week' },
    { id: 'rehearsal', label: 'Rehearsal' },
    { id: 'daily', label: 'Daily Rebroadcast' },
  ],
  options: [
    {
      id: 'episode',
      label: 'Episode · all open in Rehearsal',
      values: [
        { id: 'next', label: 'Next on air' },
        ...CASES.map((c) => ({ id: String(c.id), label: String(c.id).padStart(2, '0') + ' · ' + c.title })),
      ],
    },
  ],
  controls,
  scoreGroup: ({ mode, seed }) => (mode === 'daily' ? 'daily/' + seed : mode),
  progress(data) {
    const b = ledger(data),
      rows = Object.values(b.cases);
    return rows.length
      ? rows.length +
          '/18 broadcasts · ' +
          rows.reduce((a, r) => a + r.seals, 0) +
          ' seals · ' +
          letters(b).length +
          ' letters'
      : '';
  },
  create(api) {
    const mode = api.mode || 'story',
      seed = api.seed ?? (api.rng ? (api.rng() * 4294967296) >>> 0 : 7),
      music = radioSound(api.demo ? null : api.audio);
    let book = ledger(api.store?.read?.());
    const opening = api.openingProgress == null ? book : ledger(api.openingProgress);
    let queue = api.demo ? [CASES[6]] : lineup(mode, opening, api.options?.episode, seed),
      index = 0,
      c = queue[0],
      s = initial(mode === 'rehearsal'),
      sub = '',
      time = 0,
      demoTime = 0,
      demoStep = 0,
      done = false,
      paused = false,
      score = 0,
      findings = 0,
      stars = 0,
      lows = 0;
    let preview = !!api.demo,
      down = null;
    if (!preview && api.store) {
      if (api.openingProgress == null) {
        const runId = mode + '/' + seed + '/' + (api.options?.episode || 'next');
        const previous = previousRuns.get(api.store);
        if (previous?.key === runId) queue = previous.queue;
        else previousRuns.set(api.store, { key: runId, queue });
        c = queue[0];
      }
      if (mode === 'daily' && !book.lineups[seed])
        api.store.update?.((data) => {
          book = ledger(data);
          if (book.lineups[seed]) return data;
          book.lineups[seed] = queue.map((x) => x.id);
          for (const key of Object.keys(book.lineups).sort().slice(0, -40)) delete book.lineups[key];
          return { ...data, radioBook: book };
        });
    }
    function cueDemo() {
      preview = true;
      queue = [CASES[6]];
      index = 0;
      c = queue[0];
      s = initial();
      sub = '';
      for (const id of ['claim:lead', 'item:ex0', 'flip', 'present', 'next']) s = act(c, s, id);
    }
    if (preview) cueDemo();
    const view = openDesk((id) => action(id, 'down'), api.demo);
    function render() {
      if (done) return;
      const line = host(c, s);
      view?.render(c, s, book, mode, seed, sub, line, index, queue.length);
      api.hud?.('Night', NIGHTS[c.night][0].slice(0, 3), 'Edit', s.stage + 1 + '/' + c.rounds.length);
      api.say?.(line);
    }
    function persist() {
      if (preview) return;
      let updated = false;
      api.store?.update?.((data) => {
        book = record(ledger(data), c, s, mode, seed);
        updated = true;
        return { ...data, radioBook: book };
      });
      if (!updated) book = record(book, c, s, mode, seed);
    }
    function advance() {
      if (s.phase !== 'sealed') return;
      if (index + 1 < queue.length) {
        c = queue[++index];
        s = initial(false);
        sub = '';
        music.play('pickup', c.night, true);
        render();
        return;
      }
      done = true;
      music.stop();
      view?.dispose();
      api.end?.(
        score,
        [
          ['Broadcasts', queue.length],
          ['Edited claims', findings],
          ['Show seals', stars + ' / ' + queue.length * 3],
          ['Unsupported pairings', lows],
          ['Last caller', c.title],
        ],
        c.id === 18 ? c.letter : c.ending
      );
    }
    function action(id, type = 'down') {
      if (type !== 'down' || done || paused) return;
      if (id === 'book') {
        sub = sub ? '' : 'book';
        music.play('paper');
        render();
        return;
      }
      if (sub) return;
      if (id === 'replay' || id === 'audio') {
        music.play(
          id === 'audio'
            ? c.evidence.find((e) => e.id === s.item)?.sound || 'paper'
            : s.phase === 'amended'
              ? 'proof'
              : 'ident',
          c.night,
          true
        );
        return;
      }
      if (id === 'file') {
        advance();
        return;
      }
      const next = act(c, s, id);
      if (next === s) return;
      s = next;
      music.play(
        ['again', 'inspect'].includes(s.event) ? 'press' : s.event === 'rewind' ? 'listen' : s.event,
        c.night
      );
      if (s.event === 'proof') api.haptic?.(15);
      if (s.event === 'recover') api.effect?.('recover');
      if (s.event === 'sealed') {
        score += scoreFor(s);
        stars += seals(s);
        findings += s.history.length;
        lows += s.strikes;
        persist();
      }
      render();
    }
    function key(phase, code) {
      if (phase !== 'down' || done || paused) return;
      const o = orderFor(c, s.stage, seed, mode === 'daily'),
        n = /^(Digit|Numpad)([1-4])$/.exec(code);
      if (n) {
        const i = Number(n[2]) - 1;
        if (sub) return;
        if (s.listening && i < 2) action('when:' + o.earlier[i]);
        else if (s.phase === 'transcript' && o.claims[i]) action('claim:' + o.claims[i].id);
        else if (s.phase === 'evidence' && o.items[i]) action('item:' + o.items[i].id);
        return;
      }
      const bind = {
        KeyY: 'redo',
        KeyL: 'listen',
        KeyB: 'book',
        KeyR: 'replay',
        KeyQ: 'press',
        KeyC: 'flip',
        Backspace: sub ? 'book' : s.listening ? 'listen' : 'back',
        Enter: s.phase === 'sealed' ? 'file' : s.phase === 'amended' ? 'next' : 'present',
      };
      if (bind[code]) action(bind[code]);
    }
    const script = [
      [0.8, 'claim:lead'],
      [2.1, 'press'],
      [4.1, 'item:ex1'],
      [6.3, 'flip'],
      [9.0, 'present'],
      [14.2, 'next'],
      [19, 'file'],
    ];
    render();
    music.play('pickup', c.night);
    return {
      action,
      key,
      pointer(phase, x, y, w = 480, h = 550) {
        if (done || paused || preview) return;
        if (phase === 'cancel') {
          down = null;
          return;
        }
        if (phase === 'down') {
          down = [x, y];
          return;
        }
        if (phase !== 'up' || !down) return;
        const short = Math.hypot(x - down[0], y - down[1]) < 14;
        down = null;
        if (!short || sub || s.listening) return;
        const art = w < 610 || w / h < 0.96 ? y < h * 0.32 : x < w * 0.45;
        if (art) action(s.item ? 'audio' : 'replay');
      },
      cancelInput() {
        down = null;
      },
      update(dt) {
        if (paused || done) return;
        time += dt;
        music.bed(c.night, s.lights);
      },
      demo(dt = 1 / 120) {
        if (done || paused) return;
        if (!preview) {
          if (api.demo === false) return;
          cueDemo();
          render();
        }
        demoTime += dt;
        while (demoStep < script.length && demoTime >= script[demoStep][0]) action(script[demoStep++][1]);
      },
      draw(g, w, h) {
        paintBooth(g, w, h, c, s, time, api.reducedMotion, api.demo);
      },
      pause() {
        paused = true;
        music.stop();
      },
      resume() {
        paused = false;
      },
      dispose() {
        music.stop();
        view?.dispose();
        done = true;
      },
      snapshot() {
        return { c, s, book, queue: queue.map((x) => x.id), index, score, stars, done };
      },
    };
  },
};
