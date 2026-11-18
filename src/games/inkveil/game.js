import { rooms, wings } from './rooms.js';
import { TAPES, dirs, dist, neighbor, walkable, throwSpots, xy, cone } from './geometry.js';
import { begin, turn, complete, decodeToss, toss, lens } from './patrol.js';
import { solve, replay } from './solver.js';
import { campaign, daily, noir, notebook, starCount, unlocked, labels, keep } from './dossiers.js';
import { lines } from './lines.js';
import { layout } from './layout.js';
import { render, journal } from './stage.js';
import { soundscape } from './sound.js';
const controls = ['N', 'E', 'S', 'W'].map((id, i) => ({
  id,
  label: ['North ↑', 'East →', 'South ↓', 'West ←'][i],
}));
const pad = (id, label, key) => ({ id, label, key });
const arrows = {
  ArrowUp: 'N',
  ArrowRight: 'E',
  ArrowDown: 'S',
  ArrowLeft: 'W',
  KeyW: 'N',
  KeyD: 'E',
  KeyS: 'S',
  KeyA: 'W',
};
let cancelCurrent = null;
export const cancelAimOnEscape = () => cancelCurrent?.() || false;
export default {
  title: "AGI'S ALIBI",
  tagline:
    'Plant a pocket tape in a paper archive. While the lamp turns toward its sound, slip away with her diary.',
  instructions: [
    [
      'Read the lamps',
      'Amber squares are a docent’s sight. Pink hatching comes from a camera. Shelves block sight. A dark hood hides you if you wait under it. Think as long as you like between actions.',
    ],
    [
      'Send a sound',
      'Open Aim tape, choose a clear square within three tiles in a straight line, then Throw. The highlighted sound field shows what can hear it. A guard seeing you already keeps watching.',
    ],
    [
      'Get out quietly',
      'Collect every gold diary and reach the green exit. One sighting leaves you a beat to recover. A second sighting or contact catches you. Quiet exits earn extra stars.',
    ],
  ],
  keys: [
    ['Arrows / WASD', 'Move one square, or move the landing marker'],
    ['T / Q / Enter', 'Aim tape, change sound or throw'],
    ['Space / Z / H', 'Wait and crouch, undo, or request a clue'],
    ['Escape', 'Cancel a pending throw'],
  ],
  touch: [
    ['Tap an adjacent square or swipe', 'Move one tile'],
    ['Aim tape → floor → Throw', 'Set and throw the recorder'],
    ['Case tools', 'Undo, inspect the dossier, or show one next action'],
  ],
  modes: [
    { id: 'campaign', label: 'Archive campaign' },
    { id: 'noir', label: 'Film Noir contracts' },
    { id: 'daily', label: 'Daily dossier' },
  ],
  options: [
    {
      id: 'room',
      label: 'Exhibit',
      values: [
        { id: 'next', label: 'Next open exhibit' },
        ...rooms.map((r) => ({ id: String(r.id), label: r.id + ' · ' + r.name })),
      ],
    },
  ],
  controls,
  scoreGroup: ({ mode, seed }) => (mode === 'daily' ? 'daily/' + seed : mode),
  progress(data) {
    const book = notebook(data),
      files = Object.values(book.cases);
    return files.length
      ? 'Recovered ' +
          files.length +
          '/36 exhibits · ' +
          files.reduce((n, e) => n + e.stars, 0) +
          ' stars · ' +
          labels(book).length +
          ' tape labels'
      : '';
  },
  create(api) {
    const mode = api.mode || 'campaign',
      seed = api.seed || 7,
      music = soundscape(api.demo ? null : api.audio),
      isNoir = mode === 'noir',
      dated = mode === 'daily';
    let book = notebook(api.store?.read?.()),
      room,
      cert,
      state,
      previous,
      ops = [],
      history = [],
      roomAlerts = 0,
      alarmBank = 3;
    let tape = 0,
      target = -1,
      aim = false,
      panel = 'floor',
      journalAt = 0,
      ghost = null,
      finished = false,
      sealed = false,
      stars = 0,
      points = 0,
      cases = 0;
    let facing = 2,
      phase = 1,
      time = 0,
      demoClock = 0,
      clearAge = 0,
      hintAt = -1,
      drag = null,
      firstThrow = true,
      latestControls = '',
      recoverTime = 0;
    let thrown = 0,
      diverted = 0,
      detections = 0,
      lastFeedback = -100,
      mentionedWindow = false;
    const awarded = new Set(),
      say = (t) => api.say?.(t),
      speak = (key) => say(lines[key]);
    const edgeLabels = { N: 'north', E: 'east', S: 'south', W: 'west', Z: 'wait under cover' };
    function resetAttempt(message) {
      state = begin(room);
      previous = state;
      ops = [];
      history = [];
      roomAlerts = 0;
      tape = 0;
      target = -1;
      aim = false;
      panel = 'floor';
      ghost = null;
      sealed = false;
      hintAt = -1;
      stars = 0;
      recoverTime = 0;
      facing = 2;
      phase = 1;
      firstThrow = true;
      mentionedWindow = false;
      if (message) say(message);
      refresh();
    }
    function load(item) {
      room = item.room;
      cert = item.certificate;
      journalAt = room.id - 1;
      let introduction = room.lesson;
      if (room.id === 1 && !dated && !isNoir)
        introduction = 'Wait once. Aim a click three tiles east. Then slip behind the lamp.';
      else if (dated) introduction = lines.daily + ' ' + room.lesson;
      resetAttempt(introduction);
    }
    function describe(at) {
      const [a, b] = xy(room, state.p),
        [x, y] = xy(room, at),
        dx = x - a,
        dy = y - b;
      return Math.abs(dx || dy) + ' ' + (dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north');
    }
    function refresh() {
      let list;
      if (panel === 'journal')
        list = [
          pad('prior', 'Previous exhibit'),
          pad('later', 'Next exhibit'),
          pad('back', 'Back to room'),
          { ...pad('open', 'Open exhibit'), disabled: mode !== 'campaign' || !unlocked(book, rooms[journalAt]) },
        ];
      else if (sealed)
        list = [
          ...(!dated ? [pad('next', isNoir ? 'Next contract' : 'Next exhibit', 'Space')] : []),
          pad('file', 'File dossier', 'F'),
          pad('ghost', ghost ? 'Hide route' : 'Show best route', 'G'),
          pad('journal', 'Recovered exhibits'),
        ];
      else if (state.caught)
        list = [...(!isNoir ? [pad('undo', 'Undo last beat', 'Z')] : []), pad('retry', 'Retry room', 'R')];
      else if (aim)
        list = [
          ...controls,
          pad('throw', 'Throw · ' + describe(target), 'Enter'),
          ...(room.tapes > 1 ? [pad('tape', TAPES[tape].name, 'Q')] : []),
          pad('cycle', 'Next landing', ']'),
          pad('cancel', 'Cancel aim', 'Esc'),
        ];
      else if (panel === 'tools')
        list = [
          pad('back', 'Back to floor'),
          ...(!isNoir ? [pad('undo', 'Undo', 'Z'), pad('retry', 'Restart room', 'R')] : []),
          pad('hint', 'One clue', 'H'),
          pad('journal', 'Recovered exhibits'),
          ...(room.tapes > 1 ? [pad('tape', TAPES[tape].name, 'Q')] : []),
        ];
      else
        list = [
          ...controls,
          pad('Z', 'Wait / crouch', 'Space'),
          { ...pad('aim', 'Aim tape', 'T'), disabled: !state.charges },
          pad('tools', 'Case tools', 'V'),
        ];
      const signature = list.map((b) => b.id + ':' + b.label + ':' + !!b.disabled).join('|');
      if (signature !== latestControls) {
        latestControls = signature;
        api.controls?.(list);
      }
      api.hud?.(
        isNoir ? 'Alerts left' : 'Case',
        isNoir ? alarmBank : room.id,
        'Beats / par',
        ops.length + ' / ' + cert.par
      );
    }
    function closeAim() {
      if (!aim || finished) return false;
      aim = false;
      target = -1;
      music.cue('reel');
      speak('cancel');
      refresh();
      return true;
    }
    cancelCurrent = closeAim;
    function openAim() {
      if (!state.charges) {
        say('this recorder is empty. the diary still has a way out.');
        return;
      }
      const sites = throwSpots(room, state.p, state.key);
      if (!sites.length) {
        say('a shelf blocks every throw from this square.');
        return;
      }
      aim = true;
      panel = 'floor';
      hintAt = -1;
      const hinted = decodeToss(cert.route[ops.length] || '');
      target =
        room.id === 1 && hinted && sites.includes(hinted[1])
          ? hinted[1]
          : sites.reduce((best, p) => (dist(room, state.p, p) > dist(room, state.p, best) ? p : best), sites[0]);
      if (firstThrow) {
        speak('firstTape');
        firstThrow = false;
      } else speak('aim');
      music.cue('ready');
      refresh();
    }
    function aimDirection(dir) {
      const f = dirs.indexOf(dir),
        valid = throwSpots(room, state.p, state.key),
        next = neighbor(room, target, f);
      if (valid.includes(next)) target = next;
      else {
        const from = neighbor(room, state.p, f);
        if (valid.includes(from)) target = from;
      }
      say(TAPES[tape].name + ' · ' + describe(target) + '.');
      music.cue('reel');
      refresh();
    }
    function receipts() {
      const obj = room.items.filter((_, i) => state.bag & (1 << i)).length;
      return [
        ['Recovered', cases],
        ['Last exhibit', room.name],
        ['Pages', obj + ' / ' + room.items.length],
        ['Quiet par', cert.par],
        ['Sightings', detections],
      ];
    }
    function file(line = lines.noir) {
      if (finished) return;
      finished = true;
      music.stop();
      api.end?.(points, receipts(), line);
    }
    function finishCase() {
      sealed = true;
      clearAge = 0;
      stars = starCount(ops.length, cert.par, roomAlerts);
      const key = isNoir ? cases + ':' + room.id : String(room.id),
        prior = book.cases[room.id];
      if (!awarded.has(key)) {
        awarded.add(key);
        cases++;
        points +=
          300 * stars +
          room.items.length * 80 +
          Math.max(0, cert.par * 8 - (ops.length - cert.par) * 5) +
          (state.frag ? 60 : 0);
      }
      if (!api.demo) {
        keep(api.store, mode, room, seed, {
          stars,
          turns: ops.length,
          fragment: state.frag,
          route: ops,
          rooms: cases,
        });
        book = notebook(api.store?.read?.());
      }
      music.cue('exit');
      api.haptic?.(24);
      api.effect?.('win', stars === 3 ? 'Ghost route' : 'Diary recovered');
      const hasLabel = labels(book).includes(wings[room.wing].label);
      speak(
        room.id === 36
          ? 'finale'
          : hasLabel
            ? 'label'
            : prior && ops.length < prior.turns
              ? 'best'
              : stars === 3
                ? 'par'
                : stars === 2
                  ? 'quiet'
                  : 'diary'
      );
      refresh();
    }
    function handle(op) {
      if (finished || sealed || state.caught) return;
      const res = turn(room, state, op);
      if (!res.state) {
        music.cue('latch');
        api.haptic?.(5);
        if (res.fault === 'locked') speak('locked');
        else if (res.fault === 'blocked throw') say('the tape needs a clear, straight landing.');
        else say('a shelf blocks that step.');
        return;
      }
      const before = state;
      history.push({ state, roomAlerts, facing });
      ops.push(op);
      previous = state;
      state = res.state;
      phase = api.reducedMotion ? 1 : 0;
      const dir = dirs.indexOf(op);
      if (dir >= 0 && op.length === 1) facing = dir;
      aim = false;
      target = -1;
      hintAt = -1;
      ghost = null;
      panel = 'floor';
      const e = res.events,
        th = decodeToss(op),
        pan = ((state.p % room.w) / (room.w - 1)) * 1.5 - 0.75;
      if (th) {
        thrown++;
        music.cue(th[0] ? 'keys' : 'click', ((th[1] % room.w) / (room.w - 1)) * 1.5 - 0.75);
      } else
        music.cue(op === 'Z' ? 'cloth' : e.includes('tile') ? 'hard' : e.includes('door') ? 'latch' : 'soft', pan);
      if (e.includes('listen') || e.includes('interrupt')) {
        diverted++;
        music.cue('boot', -pan);
      }
      if (e.includes('key')) music.cue('card');
      if (e.includes('diary') || e.includes('fragment')) music.cue('page');
      if (e.includes('seen') && !before.heat) {
        roomAlerts++;
        detections++;
        if (isNoir) alarmBank--;
        music.cue('sight');
        api.effect?.('fault', 'Spotted');
        api.haptic?.(15);
      }
      if (isNoir && alarmBank <= 0) {
        file();
        return;
      }
      if (state.caught) {
        speak('seen');
        recoverTime = 0.7;
        refresh();
        return;
      }
      if (complete(room, state)) {
        finishCase();
        return;
      }
      const event = [
        'seen',
        'diary',
        'fragment',
        'double',
        'interrupt',
        'listen',
        'cool',
        'key',
        'cover',
        'unheard',
        'return',
        'sweep',
        'tile',
        'carpet',
        'fade',
        'throw',
        'wait',
      ].find((k) => e.includes(k));
      if (event) {
        const need = th || ['diary', 'key', 'cool', 'double', 'interrupt'].includes(event);
        if (need || time - lastFeedback > 0.32) {
          const split =
            event === 'listen' &&
            state.guards.length > 1 &&
            state.guards.every((g) => g.to >= 0) &&
            state.guards[0].to !== state.guards[1].to;
          speak(split ? 'split' : event);
          lastFeedback = time;
        }
        if (event === 'diary' || event === 'double' || event === 'cool')
          api.effect?.('streak', event === 'diary' ? 'Diary page' : event === 'double' ? 'Two ears' : 'Unseen');
        if (event === 'cool') music.cue('exhale');
        if (event === 'sweep') music.cue('lens');
      } else if (!mentionedWindow && [0, 1, 2, 3].some((d) => room.tiles[neighbor(room, state.p, d)] === '|')) {
        mentionedWindow = true;
        speak('window');
      } else if (state.guards.some((g) => dist(room, state.p, g.p) === 2) && time - lastFeedback > 2) {
        speak('near');
        lastFeedback = time;
      } else if (e.includes('step') && ops.length === 1) speak('foyer');
      refresh();
    }
    function clue() {
      const exactPrefix = ops.every((op, i) => cert.route[i] === op);
      let suggested = exactPrefix ? cert.route[ops.length] : null;
      if (!suggested) {
        try {
          suggested = solve(room, state, { limit: 6500 })?.route[0];
        } catch {
          /* unknown frontier leaves an honest undo hint */
        }
      }
      if (!suggested) {
        say('this position has no certified quiet clue. undo a beat or retry.');
        return;
      }
      const t = decodeToss(suggested);
      speak('hint');
      if (t) {
        tape = t[0];
        openAim();
        target = t[1];
        hintAt = target;
        say('A ' + TAPES[tape].name + ' ' + describe(target) + ' will draw the lamp away.');
      } else {
        const f = dirs.indexOf(suggested);
        hintAt = f >= 0 ? neighbor(room, state.p, f) : state.p;
        say('Next beat · ' + edgeLabels[suggested] + '.');
      }
      refresh();
    }
    function action(id) {
      if (finished) return;
      if (panel === 'journal') {
        if (id === 'prior' || id === 'later')
          journalAt = (journalAt + rooms.length + (id === 'prior' ? -1 : 1)) % rooms.length;
        else if (id === 'back') panel = 'floor';
        else if (id === 'open' && mode === 'campaign' && unlocked(book, rooms[journalAt])) {
          load(campaign(rooms[journalAt]));
          return;
        }
        if (panel === 'journal')
          say(rooms[journalAt].name + ' · ' + (book.cases[rooms[journalAt].id]?.stars || 0) + ' stars.');
        refresh();
        return;
      }
      if (id === 'journal') {
        panel = 'journal';
        journalAt = room.id - 1;
        book = notebook(api.store?.read?.());
        refresh();
        return;
      }
      if (sealed) {
        if (id === 'file' || (id === 'next' && dated)) file(room.id === 36 ? lines.finale : lines.quiet);
        else if (id === 'ghost') {
          const best = (mode === 'campaign' && book.cases[room.id]?.route) || cert.route;
          const run = replay(room, best);
          ghost = ghost ? null : run.trace.map((s) => s.p);
          say(ghost ? 'your recovered route is outlined in white.' : 'route tracing closed.');
          refresh();
        } else if (id === 'next') {
          if (isNoir) load(noir(seed, cases));
          else {
            const opening = api.openingProgress ? notebook(api.openingProgress) : book;
    const eligible = rooms.filter((r) => unlocked(opening, r)),
              next =
                eligible.find((r) => r.id > room.id && !book.cases[r.id]) ||
                eligible.find((r) => !opening.cases[r.id]);
            if (next) load(campaign(next));
            else file();
          }
        }
        return;
      }
      if (id === 'undo' && !isNoir && history.length) {
        const entry = history.pop();
        ops.pop();
        state = previous = entry.state;
        roomAlerts = entry.roomAlerts;
        facing = entry.facing;
        aim = false;
        target = -1;
        phase = 1;
        hintAt = -1;
        panel = 'floor';
        music.cue('reel');
        speak('undo');
        refresh();
        return;
      }
      if (id === 'retry' && (!isNoir || state.caught)) {
        resetAttempt(lines.cool);
        return;
      }
      if (state.caught) return;
      if (aim) {
        if (controls.some((c) => c.id === id)) aimDirection(id);
        else if (id === 'throw') handle(toss(tape, target));
        else if (id === 'cancel' || id === 'aim') closeAim();
        else if (id === 'cycle') {
          const spots = throwSpots(room, state.p, state.key);
          target = spots[(spots.indexOf(target) + 1) % spots.length];
          say(describe(target));
          refresh();
        } else if (id === 'tape' && room.tapes > 1) {
          tape = 1 - tape;
          music.cue('reel');
          say(TAPES[tape].name + ' · reaches ' + TAPES[tape].reach + ' sound units.');
          refresh();
        }
        return;
      }
      if (id === 'tools' || id === 'back') {
        panel = id === 'back' ? 'floor' : 'tools';
        music.cue('ready');
        refresh();
        return;
      }
      if (id === 'tape' && room.tapes > 1) {
        tape = 1 - tape;
        music.cue('reel');
        say(TAPES[tape].name);
        refresh();
        return;
      }
      if (id === 'hint') {
        clue();
        return;
      }
      if (id === 'aim') {
        openAim();
        return;
      }
      if (['N', 'E', 'S', 'W', 'Z'].includes(id)) handle(id);
    }
    const opening = api.openingProgress ? notebook(api.openingProgress) : book;
    const eligible = rooms.filter((r) => unlocked(opening, r)),
      chosen =
        eligible.find((r) => r.id === Number(api.options?.room)) ||
        eligible.find((r) => !opening.cases[r.id]) ||
        eligible[0];
    load(api.demo ? campaign(rooms[30]) : dated ? daily(seed) : isNoir ? noir(seed, 0) : campaign(chosen));
    return {
      action(id, type) {
        if (type === 'down') action(id);
      },
      key(type, k) {
        if (type !== 'down') return;
        if (arrows[k]) {
          action(arrows[k]);
          return;
        }
        const commands = {
          Space: sealed ? 'next' : 'Z',
          Enter: aim ? 'throw' : 'aim',
          KeyT: 'aim',
          KeyQ: 'tape',
          KeyZ: 'undo',
          KeyH: 'hint',
          KeyF: 'file',
          KeyR: 'retry',
          KeyV: 'tools',
          KeyG: 'ghost',
          BracketRight: 'cycle',
          Backspace: aim ? 'cancel' : 'undo',
        };
        if (commands[k]) action(commands[k]);
      },
      pointer(type, x, y, w, h) {
        if (type === 'cancel') {
          drag = null;
          return;
        }
        if (type === 'down') {
          drag = [x, y];
          return;
        }
        if (type !== 'up' || !drag) return;
        const dx = x - drag[0],
          dy = y - drag[1];
        drag = null;
        if (panel === 'journal' || sealed || state.caught) return;
        const tile = layout(w, h, room).tile(x, y);
        if (aim) {
          if (throwSpots(room, state.p, state.key).includes(tile)) {
            target = tile;
            music.cue('reel');
            say(describe(target) + '. Throw when ready.');
            refresh();
          }
          return;
        }
        if (Math.hypot(dx, dy) > 20) {
          action(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N');
          return;
        }
        for (let dir = 0; dir < 4; dir++)
          if (neighbor(room, state.p, dir) === tile) {
            action(dirs[dir]);
            break;
          }
      },
      update(dt) {
        if (finished) return;
        time += dt;
        phase = Math.min(1, phase + dt * 5.2);
        if (sealed) {
          clearAge += dt;
          return;
        }
        if (state.caught && isNoir) {
          recoverTime -= dt;
          if (recoverTime <= 0) resetAttempt(lines.cool);
          return;
        }
        music.tension(
          state.guards.some((g) => dist(room, state.p, g.p) <= 3),
          state.heat
        );
      },
      draw(c, w, h) {
        if (panel === 'journal') {
          const r = rooms[journalAt];
          journal(c, w, h, r, book.cases[r.id], journalAt, labels(book).includes(wings[r.wing].label));
          return;
        }
        render(c, w, h, {
          room,
          state,
          previous,
          aim,
          target,
          tape,
          ghost,
          phase,
          facing,
          time,
          reduced: api.reducedMotion,
          sealed,
          par: cert.par,
          turns: ops.length,
          hintAt,
        });
      },
      demo(dt) {
        if (finished) return;
        demoClock += dt;
        if (sealed) {
          if (!api.demo || clearAge > 1.45) file();
          return;
        }
        const interval = api.demo ? 0.59 : 0.06;
        if (demoClock < interval) return;
        demoClock = 0;
        const op = cert.route[ops.length];
        if (!op) return;
        if (api.demo && decodeToss(op) && !aim) {
          openAim();
          const t = decodeToss(op);
          target = t[1];
          tape = t[0];
          return;
        }
        handle(op);
      },
      pause() {
        drag = null;
        music.stop();
      },
      cancelInput() {
        drag = null;
      },
      dispose() {
        music.stop();
        if (cancelCurrent === closeAim) cancelCurrent = null;
      },
    };
  },
};
