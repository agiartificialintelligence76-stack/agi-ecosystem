import { makeYard, dailyDish, names, plans, lines } from './yards.js';
import { apply, legal, key, solved, ticketHead, GLYPH, DIRECTION, label, deviceLocked, moveRoute, mirrorAction, opposite } from './rules.js';
import { search } from './solver.js';
import { book } from './station-book.js';
import { medal, mealScore, stations, openLine, accessible, nextStop, stamp } from './progress.js';
import { geometry, nearest } from './geometry.js';
import { paint, mapButtons } from './paint.js';
import { dialogue } from './lines.js';
import { createWhistle } from './sound.js';
const button = (id, label, key, extra = {}) => ({
  id,
  label,
  key,
  ...extra
});
const initial = [button('go1', 'Roll east', '→')];
const codes = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
const modeOf = api => api.mode || 'campaign';
export default {
  title: 'LAST TRAIN TO NOODLES',
  tagline: 'AGI-1 has a tiny switch engine and two hungry kitchens. Assemble the wagons in ticket order.',
  modes: [{
    id: 'campaign',
    label: 'Station pass'
  }, {
    id: 'daily',
    label: 'Daily dish'
  }, {
    id: 'sandbox',
    label: 'Replay your yards'
  }],
  controls: initial,
  instructions: [['Work the engine', 'Couple beside a wagon. Drive into the linked end to push, or move away to pull. Tap a mint berth or use the arrows.'], ['Read the tickets', 'Deliver the pictured ingredients left to right to kitchen A or B. Only the farthest coupled car can leave the train. Drop tail to stage a wagon.'], ['Change the rails', 'Throw a point before moving onto it. A bridge rotates only when no link spans it. Striped berths admit the engine alone.'], ['Stamp a pass', 'Earn a star for serving, two within two shunts of par and three at par. Four of six yards open the next line. Clear all six for its cab pennant.']],
  keys: [['Arrow keys / WASD', 'Roll a single berth'], ['Space / C / V', 'Couple an adjacent wagon / cycle coupling target / drop tail'], ['1 / 2 or T / O', 'Operate the first or second lever'], ['Z / H / R', 'Undo / dispatch hint / restart yard'], ['B / X', 'Station pass / file the finished shift']],
  touch: [['Berth or ingredient', 'Tap a mint berth to roll. Tap an adjacent loose wagon to couple it.'], ['Distant berth', 'Tap to preview a route, then tap it again to run.'], ['Signal box', 'Use the dock for links, levers, undo and dispatch. Your pass contains the other yards.']],
  progress(data) {
    const r = stations(data),
      n = Object.keys(r).length;
    return n ? n + ' of 36 station tickets punched.' : '';
  },
  create(api) {
    const seed = api.seed ?? Math.floor((api.rng?.() ?? .5) * 0xffffffff),
      mode = modeOf(api),
      audio = createWhistle(api.audio),
      say = dialogue(),
      totals = new Map();
    let records = {
        ...stations(api.store?.read?.())
      },
      yard,
      state,
      prev,
      age,
      time = 0,
      hist,
      plan,
      queue = [],
      queueDelay = 0,
      mark,
      face = 1,
      afford,
      menu,
      searching,
      guide;
    let touchStart = null,
      pick = 0,
      page = 0,
      map = false,
      done = false,
      ended = false,
      paused = false,
      steps = 0,
      stars = 0,
      lineText = '',
      demoWait = .7,
      served = 0,
      hints = 0,
      selected = 0,
      lastDemo = -1;
    const allowed = id => accessible(records, id, mode),
      speak = e => api.say?.(say(e));
    function dock() {
      if (map) {
        const items = [button('prevline', '‹ Line', '['), button('nextline', 'Line ›', ']'), button('prevstop', '‹ Yard', '←'), button('nextstop', 'Yard ›', '→'), button('choose', 'Enter yard', 'Enter', {
          disabled: !allowed(pick)
        }), button('pass', 'Back to rails', 'B')];
        if (!done) items.push(button('reset', 'Restart yard', 'R'));
        if (totals.size) items.push(button('file', 'File shift', 'X'));
        api.controls?.(items);
        return;
      }
      if (done) {
        const items = [button('next', mode === 'daily' ? 'File daily ticket' : 'Next yard', 'Enter'), button('again', 'Retry for par', 'R'), button('file', 'File shift', 'X')];
        if (mode !== 'daily') items.push(button('pass', 'Station pass', 'B'));
        api.controls?.(items);
        return;
      }
      const items = menu.filter(a => a < 4).map(a => button('go' + a, 'Roll ' + DIRECTION[a], GLYPH[a]));
      const links = menu.filter(a => a >= 4 && a < 8);
      for (const a of links) {
        const end = state.chain.length ? state.cars[state.chain.at(-1)] : state.e;
        const i = state.cars.indexOf(yard.points[end].links[a - 4]);
        items.push(button('link' + a, 'Couple ' + names[yard.dish[i]].toLowerCase(), a === links[selected % links.length] ? 'Space' : GLYPH[a - 4]));
      }
      if (state.chain.length) items.push(button('drop', 'Drop tail', 'V'));
      for (const [i, d] of yard.devices.entries()) items.push(button('dev' + i, d.type === '%' ? 'Turn bridge' : 'Point ' + (i + 1), i + 1 + '', {
        disabled: deviceLocked(yard, state, i)
      }));
      items.push(button('undo', 'Undo', 'Z', {
        disabled: !hist.length
      }), button('hint', 'Hint', 'H'));
      if (mode !== 'daily') items.push(button('pass', 'Pass', 'B'));
      api.controls?.(items);
    }
    function refresh() {
      menu = legal(yard, state).map(([a]) => a);
      afford = menu.filter(a => a < 4);
      api.hud?.('Shunts', steps + ' / ' + book[yard.id].length, 'Yard', String(yard.id + 1).padStart(2, '0') + ' / 36');
      dock();
    }
    function load(y, reason) {
      touchStart = null;
      yard = y;
      state = y.start;
      prev = state;
      hist = [];
      plan = mark = searching = null;
      queue = [];
      age = 2;
      steps = stars = 0;
      done = map = false;
      face = y.mirror & 1 ? -1 : 1;
      selected = 0;
      guide = new Map();
      let s = y.start;
      const witness = [...book[y.id]].map(c => mirrorAction(parseInt(c, 16), y.mirror));
      for (const a of witness) {
        guide.set(key(y, s), a);
        s = apply(y, s, a);
        if (!s) throw Error('Invalid rail certificate for ' + y.name);
      }
      pick = y.id;
      page = y.line;
      lineText = y.tip;
      refresh();
      speak(reason || (mode === 'daily' ? 'daily' : y.windows.length > 1 ? 'twin' : 'start'));
    }
    function finish() {
      if (ended) return;
      ended = true;
      audio.stop();
      const score = [...totals.values()].reduce((a, b) => a + b, 0);
      api.end?.(score, [['Tickets punched', totals.size], ['Ingredients served', served], ['Last yard', yard.name], ['Station stars', '★'.repeat(stars) || '—'], ['Dispatch hints', hints]], say(mode === 'daily' ? 'daily' : 'complete'));
    }
    function earn() {
      done = true;
      stars = medal(steps, book[yard.id].length);
      if (mode !== 'daily') records[yard.id] = Math.min(records[yard.id] ?? Infinity, steps);
      stamp(api.store, yard, steps, book[yard.id].length, mode, seed);
      totals.set(yard.id, Math.max(totals.get(yard.id) || 0, mealScore(steps, book[yard.id].length)));
      const complete = Array.from({
        length: 6
      }, (_, i) => records[yard.line * 6 + i]).every(Boolean);
      audio.ring('chord');
      speak(complete ? 'line' : stars === 3 ? 'par' : 'complete');
      api.effect?.('clear');
      api.haptic?.(35);
      lineText = 'Ticket punched';
      queue = [];
    }
    function execute(a) {
      if (done || map || ended) return false;
      const next = apply(yard, state, a);
      searching = null;
      plan = null;
      if (!next) {
        const locked = a >= 9 && deviceLocked(yard, state, a - 9);
        lineText = locked ? 'Clear the wheels from the lever.' : a >= 4 ? 'Move the free end beside a loose wagon.' : 'Buffer stop. Try another track or uncouple.';
        audio.ring('buffer');
        speak(locked ? 'occupied' : state.chain.length ? 'short' : 'buffer');
        queue = [];
        return false;
      }
      const before = state;
      hist.push(before);
      prev = before;
      state = next;
      age = 0;
      steps++;
      selected = 0;
      if (a < 4) {
        const reverse = a === opposite(before.h);
        if (a === 1 || a === 3) face = a === 1 ? 1 : -1;
        const isFrog = yard.points[next.e].dev >= 0;
        audio.ring(isFrog ? 'frog' : reverse ? 'reverse' : 'roll');
        if (reverse && steps % 3 === 0) speak('reverse');
        const selected = state.cars.findIndex((pos, i) => pos >= 0 && yard.windows.includes(pos) && (yard.kitchen[i] !== yard.windows.indexOf(pos) || yard.dish[ticketHead(yard, state, yard.kitchen[i])] !== yard.dish[i]));
        if (selected >= 0) {
          lineText = names[yard.dish[selected]] + ' is waiting at the wrong window or in the wrong order.';
          speak('wrong');
        } else lineText = yard.tip;
      } else if (a < 8) {
        audio.ring('couple');
        api.haptic?.(12);
        speak('couple');
        lineText = state.chain.length + ' linked. Roll toward the wagons to push or away to pull.';
      } else if (a === 8) {
        audio.ring('release');
        speak('uncouple');
        lineText = 'Tail wagon parked. The engine can run around it.';
      } else {
        const d = yard.devices[a - 9];
        audio.ring(d.type === '%' ? 'bridge' : 'points');
        speak(d.type === '%' ? 'bridge' : 'points');
        lineText = d.type === '%' ? 'Bridge rotated a quarter turn.' : 'The mint turnout rail is lined.';
      }
      const id = next.cars.findIndex((v, i) => v < 0 && before.cars[i] >= 0);
      if (id >= 0) {
        served++;
        mark = {
          node: yard.windows[yard.kitchen[id]],
          t: 1.4
        };
        audio.ring('bell');
        audio.ring('pour');
        audio.ring('route');
        api.effect?.('serve');
        speak('served');
        lineText = names[yard.dish[id]] + ' delivered to kitchen ' + String.fromCharCode(65 + yard.kitchen[id]) + '.';
      }
      if (solved(next)) earn();
      refresh();
      return true;
    }
    function undo() {
      queue = [];
      plan = searching = null;
      if (!hist.length || done) return;
      prev = state;
      state = hist.pop();
      served -= state.cars.filter(p => p >= 0).length - prev.cars.filter(p => p >= 0).length;
      steps--;
      age = 0;
      mark = null;
      speak('undo');
      audio.ring('release');
      lineText = 'One operating action rewound.';
      refresh();
    }
    function advise(a) {
      if (a === undefined) {
        lineText = 'No route from here. Undo a shunt or restart from your pass.';
        speak('reset');
        return;
      }
      lineText = 'Dispatch hint · ' + label(yard, state, a) + '.';
      speak('hint');
      audio.ring('route');
    }
    function hint() {
      hints++;
      queue = [];
      const a = guide.get(key(yard, state));
      if (a !== undefined) {
        advise(a);
        return;
      }
      searching = search(yard, state, 220000);
      lineText = 'Dispatch is tracing the sidings…';
    }
    function act(id) {
      if (ended || paused) return;
      if (id === 'file' && (done || totals.size)) {
        finish();
        return;
      }
      if (id === 'pass' && mode !== 'daily') {
        queue = [];
        searching = null;
        map = !map;
        if (map) {
          page = yard.line;
          pick = yard.id;
          speak('select');
        }
        dock();
        return;
      }
      if (map) {
        if (id === 'prevline' || id === 'nextline') {
          page = (page + (id === 'prevline' ? 5 : 1)) % 6;
          pick = page * 6;
        } else if (id === 'prevstop' || id === 'nextstop') {
          pick = page * 6 + (pick % 6 + (id === 'prevstop' ? 5 : 1)) % 6;
        } else if (id === 'choose' && allowed(pick)) {
          load(makeYard(pick), 'replay');
          return;
        } else if (id === 'reset') {
          load(yard, 'reset');
          return;
        }
        dock();
        return;
      }
      if (done) {
        if (id === 'again' || id === 'reset') {
          load(yard, 'replay');
          return;
        }
        if (id === 'next') {
          if (mode === 'daily') finish();else if (mode === 'sandbox') {
            map = true;
            dock();
          } else load(makeYard(nextStop(records, yard.id)));
        }
        return;
      }
      queue = [];
      if (id === 'reset') {
        load(yard, 'reset');
        return;
      }
      if (id === 'undo') {
        undo();
        return;
      }
      if (id === 'hint') {
        hint();
        return;
      }
      if (id === 'cycle') {
        const links = menu.filter(a => a >= 4 && a < 8);
        if (links.length) {
          selected++;
          lineText = 'Coupler aimed ' + DIRECTION[links[selected % links.length] - 4] + '.';
          dock();
        }
        return;
      }
      if (id === 'couple') {
        const links = menu.filter(a => a >= 4 && a < 8);
        if (links.length) execute(links[selected % links.length]);else if (state.chain.length) execute(8);else execute(4);
        return;
      }
      if (id === 'drop') execute(8);else if (id.startsWith('go')) execute(+id.slice(2));else if (id.startsWith('link')) execute(+id.slice(4));else if (id.startsWith('dev') && yard.devices[+id.slice(3)]) execute(9 + Number(id.slice(3)));
    }
    const opening = api.openingProgress ?? api.store?.read?.();
    const initialId = api.demo ? 19 : mode === 'sandbox' ? 0 : nextStop(stations(opening), opening?.noodleRail?.lastYard ?? 35);
    load(mode === 'daily' ? dailyDish(seed) : makeYard(initialId));
    if (mode === 'sandbox') {
      map = true;
      dock();
    }
    return {
      action(id, phase) {
        if (phase === 'down') act(id);
      },
      key(phase, code) {
        if (phase !== 'down') return;
        const d = codes.indexOf(code);
        const ids = {
          KeyW: 'go0',
          KeyD: 'go1',
          KeyS: 'go2',
          KeyA: 'go3',
          Space: 'couple',
          KeyC: 'cycle',
          KeyV: 'drop',
          KeyT: 'dev0',
          KeyO: 'dev1',
          Digit1: 'dev0',
          Digit2: 'dev1',
          KeyH: 'hint',
          KeyZ: 'undo',
          Backspace: 'undo',
          KeyR: 'reset',
          KeyX: 'file',
          KeyB: 'pass',
          BracketLeft: 'prevline',
          BracketRight: 'nextline',
          Enter: map ? 'choose' : 'next'
        };
        act(map && d >= 0 ? d === 0 ? 'prevline' : d === 2 ? 'nextline' : d === 1 ? 'nextstop' : 'prevstop' : d >= 0 ? 'go' + d : ids[code] || 'none');
      },
      pointer(type, x, y, w, h) {
        if (ended || paused) return;
        if (type === 'cancel') {
          touchStart = null;
          return;
        }
        if (type === 'down') {
          touchStart = {
            x,
            y
          };
          return;
        }
        if (!touchStart) return;
        if (Math.hypot(x - touchStart.x, y - touchStart.y) > 14) {
          touchStart = null;
          return;
        }
        if (type !== 'up') return;
        touchStart = null;
        if (map) {
          const i = mapButtons(w, h).findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
          if (i >= 0) {
            pick = page * 6 + i;
            if (allowed(pick)) act('choose');else {
              lineText = 'Punch four tickets on the preceding line.';
              api.say?.(lineText);
              dock();
            }
          }
          return;
        }
        if (done) return;
        const g = geometry(yard, w, h),
          at = nearest(yard, g, x, y);
        if (at < 0) return;
        const tail = state.chain.length ? state.cars[state.chain.at(-1)] : state.e;
        const link = yard.points[tail].links.indexOf(at) + 4;
        if (link >= 4 && menu.includes(link)) {
          act('link' + link);
          return;
        }
        const direct = yard.points[state.e].links.indexOf(at);
        if (direct >= 0 && menu.includes(direct)) {
          act('go' + direct);
          return;
        }
        if (plan?.at === at) {
          queue = [...plan.path];
          queueDelay = 0;
          plan = null;
          audio.ring('route');
          return;
        }
        const route = moveRoute(yard, state, at);
        if (route?.length) {
          plan = {
            at,
            path: route
          };
          lineText = 'Tap again to roll ' + route.length + ' berths.';
          return;
        }
        if (yard.points[at].dev >= 0) act('dev' + yard.points[at].dev);
      },
      update(dt) {
        if (ended || paused) return;
        time += dt;
        age += dt;
        if (mark) mark.t = Math.max(0, mark.t - dt);
        if (searching) {
          const r = searching.next();
          if (r.done) {
            searching = null;
            if (r.value.path) {
              let t = state;
              for (const a of r.value.path) {
                guide.set(key(yard, t), a);
                t = apply(yard, t, a);
              }
              advise(r.value.path[0]);
            } else if (!r.value.complete) {
              lineText = 'Dispatch suggests winding back to a stamped shunt.';
              speak('undo');
            } else advise();
          }
        }
        if (queue.length) {
          queueDelay -= dt;
          if (queueDelay <= 0) {
            const a = queue.shift();
            execute(a);
            queueDelay = .20;
          }
        }
      },
      demo(dt) {
        if (ended || paused) return;
        demoWait -= dt;
        if (demoWait > 0) return;
        demoWait = .60;
        if (done) {
          if (lastDemo !== yard.id) {
            lastDemo = yard.id;
            demoWait = 1.55;
            return;
          }
          load(makeYard((yard.id + 1) % 36));
          return;
        }
        if (map) {
          map = false;
          dock();
        }
        const a = guide.get(key(yard, state));
        if (a !== undefined) execute(a);
      },
      draw(c, w, h) {
        paint(c, w, h, {
          yard,
          state,
          prev,
          age,
          time: api.reducedMotion ? 0 : time,
          face,
          plan,
          afford,
          mark,
          done,
          moves: steps,
          par: book[yard.id].length,
          records,
          map,
          pick,
          page,
          allowed,
          plans,
          book,
          message: lineText,
          stars,
          reduced: api.reducedMotion,
          livery: lines.reduce((last, _, i) => Array.from({
            length: 6
          }, (_, j) => !!records[i * 6 + j]).every(Boolean) ? i : last, -1)
        });
      },
      pause() {
        paused = true;
        touchStart = null;
        queue = [];
        plan = null;
        audio.stop();
      },
      resume() {
        paused = false;
      },
      cancelInput() {
        touchStart = null;
        queue = [];
      },
      dispose() {
        ended = true;
        queue = [];
        searching = null;
        audio.stop();
      },
      inspect() {
        return {
          yard: yard.id,
          state,
          steps,
          done,
          stars,
          menu,
          mode,
          map,
          guide: guide.get(key(yard, state)),
          lineText,
          ended,
          records
        };
      }
    };
  }
};
