import { depots, worlds, ledger, open, emblems, daily, record } from './dispatch.js';
import { start, transition, footprint, tip, delivered, ids, code } from './rolling.js';
import { solve, stars } from './solver.js';
import { draw, drawLedger } from './warehouse.js';
import { foley } from './sound.js';
import { lines } from './lines.js';
const dirs = { N: 'North ↗', E: 'East ↘', S: 'South ↙', W: 'West ↖' };
const keys = {
  ArrowUp: 'N',
  KeyW: 'N',
  ArrowRight: 'E',
  KeyD: 'E',
  ArrowDown: 'S',
  KeyS: 'S',
  ArrowLeft: 'W',
  KeyA: 'W',
  KeyX: 'X',
  KeyZ: 'undo',
  KeyH: 'hint',
  KeyR: 'reset',
  KeyV: 'preview',
  KeyF: 'file',
  Space: 'next',
};
const controls = Object.entries(dirs).map(([id, label]) => ({ id, label }));
const pad = (id, label, key) => ({ id, label, key });
const stringifyStars = (value) => '★'.repeat(value) + '☆'.repeat(3 - value);
export default {
  title: 'HANDLE WITH CARE',
  tagline: 'Tip a two-tile parcel through a working post office. Get every fragile delivery onto its scale.',
  instructions: [
    [
      'Tip the parcel',
      'North, east, south and west tip the box over its edge. Flat takes two tiles. The gold scale only accepts it standing upright.',
    ],
    [
      'Read the floor',
      'Glass holds a flat parcel once. Belts slide the whole footprint. A perforator splits the box. Put both halves on a striped seam to bind them. Matching lettered chutes keep its orientation.',
    ],
    [
      'Collect postage',
      'Collect the plus label if your dispatch slip asks for it. Match a depot’s shortest route to collect all three delivery stars.',
    ],
  ],
  keys: [
    ['Arrows / WASD', 'Tip the parcel on the labelled compass'],
    ['X / Z / H / V', 'Switch half, undo, hint or preview a footprint'],
    ['R / F', 'Restart or file a completed delivery'],
  ],
  touch: [
    ['Swipe along a floor edge', 'Tip toward that compass point'],
    ['Compass controls', 'Make the same roll with a single tap'],
    ['Preview / Switch half', 'See the next footprint or choose a parcel'],
  ],
  modes: [
    { id: 'campaign', label: 'Depot ledger' },
    { id: 'daily', label: 'Daily dispatch' },
    { id: 'practice', label: 'Practice shift' },
  ],
  options: [
    {
      id: 'depot',
      label: 'Dispatch slip',
      values: [
        { id: 'next', label: 'Next open depot' },
        ...depots.map((d) => ({ id: String(d.id), label: d.id + ' · ' + d.name })),
      ],
    },
  ],
  controls,
  scoreGroup: ({ mode, seed, options }) => (mode === 'daily' ? 'daily/' + seed : mode + '/' + options.depot),
  progress(data) {
    const book = ledger(data),
      jobs = Object.values(book.jobs);
    return jobs.length
      ? 'Routing ledger · ' +
          jobs.length +
          '/' +
          depots.length +
          ' signed · ' +
          jobs.reduce((a, j) => a + j.stars, 0) +
          ' stars · ' +
          emblems(book).length +
          ' emblems'
      : '';
  },
  create(api) {
    const seed = api.seed || 7,
      mode = api.mode || 'campaign',
      fo = foley(api.demo ? null : api.audio);
    const practice = mode === 'practice',
      dated = mode === 'daily';
    let book = ledger(api.store?.read?.()),
      depot,
      state,
      previous,
      history = [],
      sealed = false,
      finished = false,
      earned = 0,
      points = 0,
      clears = 0;
    let roll = null,
      fraction = 1,
      burst = 0,
      time = 0,
      previewId = null,
      preview = [],
      pure = false,
      drag = null,
      shown = '',
      demoClock = 0,
      stampAge = 0,
      spoken = 0,
      liveHint = '',
      faults = 0,
      undoCount = 0,
      panel = 'floor',
      archiveIndex = 0;
    const claimed = new Set();
    const say = (t) => api.say?.(t),
      speak = (k) => say(lines[k][(seed + spoken++) % lines[k].length]);
    function refresh() {
      let buttons;
      if (panel === 'ledger')
        buttons = [
          pad('prior', 'Previous slip'),
          pad('later', 'Next slip'),
          pad('back', 'Back to depot'),
          { ...pad('openSlip', 'Open depot'), disabled: !practice && !open(book, depots[archiveIndex]) },
        ];
      else if (panel === 'tools')
        buttons = [
          pad('back', 'Compass'),
          pad('preview', 'Preview edge', 'V'),
          pad('reset', 'Restart', 'R'),
          pad('ledger', 'Routing ledger'),
        ].filter((b) => b.id !== 'ledger' || !dated);
      else if (sealed)
        buttons = [
          pad('next', 'Next depot', 'Space'),
          pad('file', 'File receipt', 'F'),
          pad('redo', 'Beat your rolls', 'R'),
        ].filter((b) => b.id !== 'next' || !dated);
      else
        buttons = [
          ...controls,
          ...(state.parts ? [pad('X', 'Switch half', 'X')] : []),
          pad('undo', 'Undo', 'Z'),
          pad('tools', 'Roll tools'),
          pad('hint', 'Hint', 'H'),
          pad('ledger', 'Ledger'),
        ].filter((b) => b.id !== 'ledger' || !dated);
      const sig = buttons.map((b) => b.id + !!b.disabled).join('|');
      if (sig !== shown) {
        shown = sig;
        api.controls?.(buttons);
      }
      api.hud?.('Depot', depot.id, 'Rolls / par', history.length + ' / ' + depot.certificate.par);
    }
    function load(d) {
      depot = d;
      state = start(d);
      previous = state;
      history = [];
      sealed = false;
      earned = 0;
      roll = null;
      fraction = 1;
      burst = 0;
      stampAge = 0;
      preview = [];
      previewId = null;
      panel = 'floor';
      faults = undoCount = 0;
      liveHint = '';
      if (!api.demo) {
        say(d.lesson);
        if (d.id === 1) {
          previewId = 'E';
          preview = footprint(tip(state, 'E')).map((p) => p.join());
        }
      }
      refresh();
    }
    function attempt(dir) {
      if (sealed || finished) return;
      const land = transition(depot, state, dir, true);
      preview = [];
      previewId = null;
      liveHint = '';
      if (!land.state) {
        faults++;
        fo.strike('edge');
        api.haptic?.(9);
        api.effect?.('fault', 'Edge');
        say(
          land.fault === 'upright glass'
            ? 'the glass only holds us lying down.'
            : land.fault === 'sorting loop'
              ? 'this belt sends us around again. take another edge.'
              : land.fault === 'occupied'
                ? 'the other parcel is on that tile.'
                : lines.edge[faults % 2]
        );
        return;
      }
      history.push(state);
      previous = state;
      state = land.state;
      roll = dir;
      fraction = api.reducedMotion ? 1 : 0;
      pure = dir !== 'X' && land.path.length === 1;
      const event = ['chute', 'seam', 'split', 'belt', 'break', 'glass', 'post', 'switch'].find((e) =>
        land.events.includes(e)
      );
      const impact = event || (state.o === 'up' ? 'up' : 'flat');
      fo.strike(impact, Math.min(4, history.length % 5));
      api.haptic?.(impact === 'up' ? 11 : 6);
      if (event) {
        speak(event);
        if (event === 'seam' || event === 'post' || event === 'split') {
          burst = 1;
          api.effect?.(
            'streak',
            event === 'post' ? 'Postage ✓' : event === 'seam' ? 'Seam sealed' : 'Two parcels'
          );
        }
      } else if (history.length === 1) speak('first');
      else if (history.length % 4 === 0) speak(state.o === 'up' ? 'up' : 'flat');
      if (delivered(depot, state)) {
        sealed = true;
        stampAge = 0;
        burst = 1;
        earned = stars(history.length, depot.certificate.par);
        if (!claimed.has(depot.id)) {
          claimed.add(depot.id);
          clears++;
          points += earned * 250 + depot.certificate.par * 12;
        }
        if (!api.demo && !practice) {
          record(api.store, depot, history.length, earned, mode, seed);
          book = ledger(api.store?.read?.());
        }
        fo.strike('stamp');
        fo.strike('win');
        api.haptic?.(28);
        api.effect?.('win', stringifyStars(earned));
        if (emblems(book).includes(worlds[depot.world].emblem)) speak('world');
        else speak(earned === 3 ? 'par' : earned === 2 ? 'near' : 'ledger');
      }
      refresh();
    }
    function file() {
      if (finished || !sealed) return;
      finished = true;
      api.end?.(
        points,
        [
          ['Receipts', clears],
          ['Last depot', depot.name],
          ['Rolls / par', history.length + ' / ' + depot.certificate.par],
          ['Delivery', stringifyStars(earned)],
          ['Edge checks', faults],
        ],
        lines.ledger[seed % 2]
      );
    }
    function action(id) {
      if (finished) return;
      if (panel === 'ledger') {
        if (id === 'prior' || id === 'later')
          archiveIndex = (archiveIndex + depots.length + (id === 'prior' ? -1 : 1)) % depots.length;
        if (id === 'openSlip' && (practice || open(book, depots[archiveIndex]))) {
          load(depots[archiveIndex]);
          return;
        }
        if (id === 'back') panel = 'floor';
        refresh();
        if (panel === 'ledger')
          say(depots[archiveIndex].name + ' · ' + (book.jobs[depots[archiveIndex].id]?.stars || 0) + ' stars.');
        return;
      }
      if (id === 'ledger' && !dated) {
        book = ledger(api.store?.read?.());
        archiveIndex = depot.id - 1;
        panel = 'ledger';
        speak('ledger');
        refresh();
        return;
      }
      if (id === 'tools' || id === 'back') {
        panel = id === 'tools' ? 'tools' : 'floor';
        fo.strike('grip');
        refresh();
        return;
      }
      if (sealed) {
        if (id === 'file' || (id === 'next' && dated)) file();
        else if (id === 'reset' || id === 'redo') load(depot);
        else if (id === 'next') {
          const available = depots.filter((d) => practice || open(book, d));
          const next =
            available.find((d) => d.id > depot.id && !book.jobs[d.id]) || available.find((d) => !book.jobs[d.id]);
          if (next) load(next);
          else file();
        }
        return;
      }
      if (ids.includes(id)) {
        attempt(id);
        return;
      }
      if (id === 'undo' && history.length) {
        state = history.pop();
        previous = state;
        fraction = 1;
        roll = null;
        burst = 0;
        preview = [];
        previewId = null;
        undoCount++;
        fo.strike('undo');
        speak('undo');
        refresh();
      } else if (id === 'reset') {
        fo.strike('undo');
        load(depot);
        speak('undo');
      } else if (id === 'preview') {
        const order = ['N', 'E', 'S', 'W'];
        previewId = order[(order.indexOf(previewId) + 1) % 4];
        const next = transition(depot, state, previewId);
        preview = next.state ? footprint(next.state).map((p) => p.join()) : [];
        say(
          dirs[previewId] +
            ' · ' +
            (next.state
              ? next.state.parts
                ? 'half parcel'
                : next.state.o === 'up'
                  ? 'standing on one tile'
                  : 'lying across two tiles'
              : 'unsupported landing') +
            '.'
        );
        fo.strike('grip');
      } else if (id === 'hint') {
        let route;
        try {
          route = solve(depot, state);
        } catch {
          /* A bounded unknown cannot produce a hint. */
        }
        const move = route?.steps[0];
        liveHint =
          move === 'X'
            ? 'switch to the other half.'
            : move
              ? 'try ' + dirs[move] + '. ' + route.par + ' rolls remain.'
              : 'there’s no delivery from here. undo your last roll.';
        if (move && move !== 'X') {
          previewId = move;
          preview = footprint(transition(depot, state, move).state).map((p) => p.join());
        }
        say(liveHint);
        fo.strike('post');
      }
    }
    const eligible = depots.filter((d) => practice || open(book, d));
    const chosen =
      eligible.find((d) => d.id === Number(api.options?.depot)) ||
      eligible.find((d) => !book.jobs[d.id]) ||
      eligible[0];
    load(api.demo ? depots[28] : dated ? daily(seed) : chosen);
    if (dated) speak('daily');
    return {
      action(id, type) {
        if (type === 'down') action(id);
      },
      key(type, key) {
        if (type === 'down' && keys[key]) action(keys[key]);
      },
      pointer(type, x, y) {
        if (type === 'down') {
          drag = [x, y];
          return;
        }
        if (type === 'cancel') {
          drag = null;
          return;
        }
        if (type === 'up' && drag) {
          const dx = x - drag[0],
            dy = y - drag[1];
          drag = null;
          if (Math.hypot(dx, dy) < 13) return;
          // Match the isometric axes pictured on the floor and on the compass.
          const dir = dx > 0 ? (dy < 0 ? 'N' : 'E') : dy < 0 ? 'W' : 'S';
          action(dir);
        }
      },
      update(dt) {
        time += dt;
        fraction = Math.min(1, fraction + dt / (pure ? 0.17 : 0.27));
        burst = Math.max(0, burst - dt * 2);
        if (sealed) stampAge += dt;
      },
      draw(c, w, h) {
        if (panel === 'ledger') {
          drawLedger(c, w, h, depots, archiveIndex, book, emblems(book));
          return;
        }
        draw(c, w, h, {
          depot,
          state,
          previous,
          roll,
          pure,
          fraction,
          burst,
          time,
          preview,
          sealed,
          stars: earned,
          reduced: api.reducedMotion,
        });
      },
      demo(dt) {
        if (finished) return;
        demoClock += dt;
        const interval = api.demo ? 0.53 : 0.065;
        if (sealed) {
          if (!api.demo || stampAge > 1.7) file();
          return;
        }
        if (demoClock < interval) return;
        demoClock = 0;
        const witness = depot.certificate.route;
        if (history.length < witness.length) attempt(witness[history.length]);
      },
      cancelInput() {
        drag = null;
      },
      pause() {
        drag = null;
        fo.stop();
      },
      dispose() {
        fo.stop();
      },
    };
  },
};
