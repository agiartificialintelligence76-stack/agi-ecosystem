import { NIGHTS, POSTCARDS } from './cities.js';
import { issue, clock, startState, walk, needsPass, feasible, arrive, home, departures, solve, waitForTrain, retainPlan } from './timetable.js';
import { choose, journal, journalPages, parTimes, bill, keep, takeView, travelSeconds } from './journal.js';
import { stationSound } from './sound.js';
import { lines } from './lines.js';
import { draw } from './render.js';
const pad = (id, label, key) => ({
  id,
  label,
  key
});
const platform = [pad('board', 'Board train', 'Enter'), pad('prev', 'Earlier row', '←'), pad('next', 'Next row', '→')];
const routeOptions = [{
  id: 'continue',
  label: 'Next open night'
}, {
  id: 'weekly',
  label: 'This week’s city'
}, ...NIGHTS.map(n => ({
  id: String(n.id),
  label: n.id + 1 + '. ' + n.name
}))];
const keys = {
  Enter: 'board',
  Space: 'snap',
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  KeyW: 'wait',
  KeyI: 'pin',
  KeyQ: 'clear',
  KeyF: 'file',
  KeyH: 'hint',
  KeyL: 'later',
  KeyE: 'express',
  KeyV: 'skip',
  KeyJ: 'journal'
};
export default {
  title: 'WINDOW SEAT',
  tagline: 'Two wishes, one express pass and the last train home. AGI-1 saved you the window seat.',
  modes: [{
    id: 'journal',
    label: 'City Journal'
  }, {
    id: 'daily',
    label: 'Daily Excursion'
  }, {
    id: 'ride',
    label: 'Window Ride'
  }],
  options: [{
    id: 'night',
    label: 'Timetable',
    values: routeOptions
  }],
  controls: platform,
  keys: [['← / →, Enter', 'Choose a departure and board. On the train, arrows change your window.'], ['I / W / E', 'Pin a connection, wait past the next departure or find a limited service.'], ['Space / V / F', 'Stamp a view, skip a ride or file the journey at a station.']],
  touch: [['Select a departure, then Board', 'The printed times include the train you are waiting for. Pin up to three legs.'], ['Left window / Right window', 'Watch the view. Tap Stamp view when its landmark appears.']],
  instructions: [['Ride to both wishes', 'The cream ticket in the window lists two neighborhoods. Step off there, then return home before the last service. The star on the map earns an extra seal.'], ['Read the board', 'The departure and arrival are actual timetable times. Service changes can need a walk. An express ride punches your single pass. Later train shows the next run of the same service.'], ['File the evening', 'At the window, watch for the highlighted side and stamp its view. You can skip the scenery. Your City Journal keeps sealed nights, fastest returns and the views you collected.']],
  progress(data) {
    const j = journal(data);
    return Object.keys(j.records).length + ' / 15 sealed nights · ' + j.views.length + ' window prints';
  },
  scoreGroup: ({
    mode,
    seed,
    options
  }) => mode === 'daily' ? 'daily/' + seed : mode + '/' + options.night,
  create(api) {
    const seed = api.seed ?? Math.floor(api.rng() * 4294967296),
      mode = api.mode || 'journal';
    const startingSave = api.store?.read() || {},
      id = api.demo ? 1 : choose(mode, api.options?.night, seed, api.openingProgress ?? startingSave);
    const book = issue(id, seed, mode),
      saved = journal(startingSave);
    const par = parTimes(book),
      sound = stationSound(api, book.night.city);
    let state = startState(),
      phase = 'station',
      menu = false,
      showBook = false,
      listing = false,
      journalIndex = 0,
      listPage = 0,
      pins = [],
      list = [],
      index = 0,
      chosen = null;
    let edge = null,
      time = 0,
      rideTime = 0,
      duration = 1,
      journey = 0,
      startJourney = 0,
      side = 'left',
      lastBeat = -1,
      stamp = false;
    let rides = 0,
      days = 0,
      paused = false,
      done = false,
      prevX = null,
      demoWait = 0;
    const views = new Set(),
      seenStops = new Set(),
      pages = journalPages(startingSave);
    const tell = (k, suffix = '') => {
      if (lines[k]) api.say?.(lines[k] + (suffix ? ' ' + suffix : ''));
    };
    function cursor() {
      return retainPlan(book, state, pins).cursor;
    }
    function startBoard() {
      const plan = retainPlan(book, state, pins);
      pins = plan.kept;
      list = pins.length >= 3 ? [] : departures(book, plan.cursor);
      index = 0;
      chosen = list[0] || null;
      showBook = false;
      listing = false;
      menu = false;
      if (!chosen && !pins.length && mode === 'ride' && state.station === 0) {
        days++;
        state = {
          ...state,
          time: 0,
          line: -1,
          pass: 1
        };
        list = departures(book, state);
        chosen = list[0] || null;
      }
      dock();
      hud();
    }
    function controls() {
      if (phase === 'ride') return [pad('prev', 'Left window', '←'), pad('next', 'Right window', '→'), pad('snap', stamp ? 'View filed' : 'Stamp view', 'Space'), pad('skip', 'Skip ride', 'V')].map(p => ({
        ...p,
        pressed: p.id === 'prev' ? side === 'left' : p.id === 'next' ? side === 'right' : undefined
      }));
      if (showBook) return [pad('bookprev', 'Previous print', '←'), pad('booknext', 'Next print', '→'), pad('menu', 'Departures', 'M')];
      if (listing) {
        const slice = list.slice(listPage * 3, listPage * 3 + 3);
        return [...slice.map((e, i) => pad('row' + i, clock(book.base + e.depart) + ' ' + book.city.stops[e.to], String(i + 1))), ...(list.length > 3 ? [pad('listmore', 'More times', 'L')] : []), pad('menu', 'Close board', 'M')];
      }
      if (menu) return [pad('boardlist', 'Timetable', 'B'), pad('menu', 'Departures', 'M'), pad('hint', 'Route advice', 'H'), pad('later', 'Later train', 'L'), pad('express', 'Find express', 'E'), pad('journal', showBook ? 'Close journal' : 'My journal', 'J'), ...(pins.length ? [pad('clear', 'Erase pins', 'Q')] : []), ...(rides ? [pad('file', 'File journey', 'F')] : [])];
      const name = pins.length ? 'Board ' + clock(book.base + pins[0].depart) + ' ' + book.city.stops[pins[0].to] : chosen ? 'Board ' + clock(book.base + chosen.depart) : 'No service';
      return [{
        ...pad('board', name, 'Enter'),
        disabled: !pins.length && !chosen
      }, pad('prev', 'Previous', '←'), pad('next', 'Next train', '→'), {
        ...pad('pin', pins.length ? 'Pin leg ' + (pins.length + 1) : 'Pin train', 'I'),
        disabled: !chosen || pins.length >= 3
      }, pad('wait', 'Wait', 'W'), pad('menu', 'Trip desk', 'M')];
    }
    function dock() {
      api.controls?.(controls());
    }
    function hud() {
      api.hud('Wishes', Number(!!(state.mask & 1)) + Number(!!(state.mask & 2)) + '/2', 'Pass', state.pass ? 'Ready' : 'Used');
    }
    function select(delta) {
      if (!list.length) return;
      index = (index + delta + list.length) % list.length;
      chosen = list[index];
      const cur = cursor();
      sound.play('select');
      const minutes = chosen.depart - cur.time;
      tell(chosen.express && needsPass(cur, chosen) ? minutes > 6 ? 'long_express_wait' : 'pass_offered' : minutes <= 2 ? 'earlier_local' : walk(cur, chosen, book.night) > 0 ? 'platform_change' : 'second_wish');
      dock();
    }
    function board() {
      const train = pins[0] || chosen;
      if (!train || !feasible(book, state, train)) return;
      if (pins.length) pins.shift();
      phase = 'ride';
      edge = train;
      rideTime = 0;
      duration = travelSeconds(edge, state);
      startJourney = journey;
      stamp = false;
      menu = showBook = false;
      lastBeat = -1;
      const wait = edge.depart - state.time;
      sound.play(needsPass(state, edge) ? 'express' : 'ticket');
      tell(needsPass(state, edge) ? 'pass_spent' : rides === 0 ? 'first_board' : edge.service === 'Night ferry' ? 'ferry' : edge.service === 'Funicular' ? 'funicular' : wait <= 2 ? 'make_connection' : 'direct_arrival');
      dock();
    }
    function finish() {
      if (done) return;
      done = true;
      sound.stop();
      const end = {
          ...bill(book, state, views, rides, par),
          stops: [...seenStops]
        },
        prior = saved.records[book.id];
      const complete = home(state);
      if (!api.demo && (rides || views.size)) api.store?.update(d => keep(d, end));
      const quote = complete ? mode === 'daily' ? 'daily_complete' : prior && state.time < prior.arrival ? 'faster_return' : end.stars === 3 ? 'all_wishes' : 'home_early' : 'home_late';
      api.end(end.score, [['Tonight', book.night.name], ['Wishes', end.wishes + ' / 2'], ['Window prints', views.size], ['Arrival', clock(book.base + state.time)], ['City seals', end.stars + ' / 3']], lines[quote]);
    }
    function arriveNow() {
      if (phase !== 'ride' || done) return;
      const old = state;
      state = arrive(book, state, edge);
      seenStops.add(book.night.city + '/' + state.station);
      rides++;
      journey = startJourney + duration;
      const extra = state.mask !== old.mask,
        midnight = book.base + old.time < 1440 && book.base + state.time >= 1440;
      phase = 'station';
      sound.play(home(state) ? 'home' : 'arrival');
      if (extra || state.star !== old.star) {
        api.effect?.('perfect', extra ? 'WISH STAMPED' : 'STAR STOP');
        api.haptic?.(12);
      }
      if (mode !== 'ride' && (home(state) || state.time >= book.limit)) {
        finish();
        return;
      }
      startBoard();
      const unmet = book.wishes.find((wish, i) => wish.stop === state.station && !(state.mask & 1 << i));
      if (unmet) api.say?.(state.time < unmet.from ? 'the stop is right. this wish opens at ' + clock(book.base + unmet.from) + '.' : 'we missed the window. it closed at ' + clock(book.base + unmet.until) + '.');else if (midnight) tell('midnight_rollover');else if (extra) tell(['first_wish', 'bakery_wish', 'first_wish', 'park_wish', 'record-shop_wish', 'scenic_detour', 'recovery_route', 'observatory'][state.station]);else if (state.star && !old.star) tell('scenic_detour');else if (book.limit - state.time < 18) tell('final_service');else tell(state.station === 0 ? 'home_early' : 'second_wish');
      if (mode !== 'ride' && !chosen && !pins.length) finish();
    }
    function wait() {
      const old = state.time;
      state = waitForTrain(book, state);
      const current = retainPlan(book, state, pins);
      pins = current.kept;
      sound.play('wait');
      if (state.time >= book.limit) {
        if (mode !== 'ride') {
          finish();
          return;
        }
        state = {
          ...state,
          time: 0,
          line: -1,
          pass: 1
        };
        days++;
      }
      startBoard();
      tell(state.time - old < 2 ? 'miss_train' : 'intentional_wait');
    }
    function snapshot() {
      if (stamp) return;
      const at = rideTime / duration;
      const v = takeView(book, edge, side, at, views);
      if (v) {
        stamp = true;
        sound.play('view');
        const merge = d => {
          const j = journal(d);
          return {
            ...d,
            windowSeat: {
              ...d.windowSeat,
              views: [...new Set([...j.views, ...views])].slice(-128)
            }
          };
        };
        const latest = !api.demo && api.store?.update(merge) || merge(startingSave);
        Object.assign(saved, journal(latest));
        pages.splice(0, pages.length, ...journalPages(latest));
        journalIndex = Math.max(0, pages.findIndex(p => p.type === 'WINDOW PRINT' && p.title === v));
        api.say?.('there. the ' + v + ' is on our ticket now.');
        api.effect?.('clear', 'WINDOW PRINT');
        api.haptic?.(9);
      } else {
        sound.play('clock');
        tell(side === edge.side ? 'tight_transfer' : 'wrong_window');
      }
      dock();
    }
    function planAction(id) {
      const cur = cursor();
      if (id === 'pin' && chosen && pins.length < 3) {
        pins.push(chosen);
        sound.play('pin');
        startBoard();
        tell('pin_route');
      } else if (id === 'clear') {
        pins = [];
        sound.play('erase');
        startBoard();
      } else if (id === 'express') {
        const ix = list.findIndex(e => e.express);
        if (ix >= 0) {
          index = ix;
          chosen = list[ix];
          menu = false;
          dock();
          sound.play('express');
          tell('pass_offered');
        } else {
          sound.play('clock');
          tell('recovery_route', 'no limited service stops here tonight.');
        }
      } else if (id === 'later' && chosen) {
        const next = book.byStop[cur.station].find(e => e.line === chosen.line && e.to === chosen.to && e.depart > chosen.depart && feasible(book, cur, e));
        if (next) {
          chosen = next;
          menu = false;
          dock();
          sound.play('select');
          tell('intentional_wait');
        } else {
          sound.play('clock');
          tell('final_service');
        }
      } else if (id === 'hint') {
        const path = solve(book, cur);
        sound.play('route');
        if (path?.length) {
          chosen = path[0];
          index = Math.max(0, list.findIndex(e => e.line === chosen.line && e.to === chosen.to));
          tell('recovery_route', 'take ' + chosen.service.toLowerCase() + ' at ' + clock(book.base + chosen.depart) + '.');
          menu = false;
          showBook = false;
          dock();
        } else tell('wrong_branch', 'check whether an earlier pinned departure can be changed.');
      }
    }
    function action(id, event) {
      if (event !== 'down' || done || paused) return;
      if (phase === 'ride') {
        if (id === 'prev' || id === 'next') {
          side = id === 'prev' ? 'left' : 'right';
          sound.play('seat');
          dock();
        } else if (id === 'snap') snapshot();else if (id === 'skip') arriveNow();
        return;
      }
      if (showBook && ['prev', 'next', 'bookprev', 'booknext'].includes(id)) {
        journalIndex = (journalIndex + (id === 'prev' || id === 'bookprev' ? -1 : 1) + Math.max(1, pages.length)) % Math.max(1, pages.length);
        sound.play('book');
        return;
      }
      if (showBook && !['menu', 'journal'].includes(id)) return;
      if (listing && !['menu', 'listmore', 'later', 'row0', 'row1', 'row2'].includes(id)) return;
      if (listing && /^row[0-2]$/.test(id)) {
        if (!list[listPage * 3 + Number(id.at(-1))]) return;
        index = listPage * 3 + Number(id.at(-1));
        chosen = list[index] || chosen;
        listing = menu = false;
        sound.play('select');
        dock();
        return;
      }
      if (listing && (id === 'listmore' || id === 'later')) {
        listPage = (listPage + 1) % Math.max(1, Math.ceil(list.length / 3));
        sound.play('select');
        dock();
        return;
      }
      if (id === 'boardlist') {
        menu = false;
        listing = true;
        listPage = 0;
        sound.play('book');
        dock();
        return;
      }
      if (id === 'board') board();else if (id === 'prev' || id === 'next') select(id === 'prev' ? -1 : 1);else if (id === 'wait') wait();else if (id === 'file' && rides) finish();else if (id === 'menu') {
        menu = listing || showBook ? false : !menu;
        listing = showBook = false;
        sound.play('book');
        dock();
      } else if (id === 'journal') {
        menu = true;
        showBook = !showBook;
        sound.play('book');
        dock();
      } else planAction(id);
    }
    startBoard();
    tell('first_ride');
    return {
      action,
      key(event, code) {
        const id = code === 'KeyM' ? 'menu' : code === 'KeyB' ? 'boardlist' : listing && /^Digit[123]$/.test(code) ? 'row' + (Number(code.slice(-1)) - 1) : keys[code];
        if (id) action(id, event);
      },
      pointer(event, x, y, w) {
        if (event === 'down') prevX = x;
        if (event === 'cancel') prevX = null;
        if (event === 'up' && prevX != null) {
          if (Math.abs(x - prevX) > 24) action(x > prevX ? 'prev' : 'next', 'down');else if (phase === 'ride') action(x < w * .5 ? 'prev' : 'next', 'down');
          prevX = null;
        }
      },
      cancelInput() {
        prevX = null;
      },
      pause() {
        paused = true;
        prevX = null;
        sound.stop();
      },
      resume() {
        paused = false;
      },
      dispose() {
        paused = true;
        sound.stop();
      },
      update(dt) {
        if (done || paused) return;
        time += dt;
        if (phase === 'ride') {
          rideTime += dt;
          journey = startJourney + rideTime;
          const pct = rideTime / duration,
            beat = Math.floor(rideTime / .68);
          if (beat !== lastBeat) {
            sound.play(pct > .88 && lastBeat >= 0 ? 'door' : beat % 7 === 0 ? 'switch' : 'rail');
            lastBeat = beat;
          }
          if (rideTime >= duration) arriveNow();
        }
      },
      demo(dt) {
        if (done || paused) return;
        demoWait += dt;
        if (phase === 'station' && demoWait > .6) {
          const route = solve(book, state, true) || solve(book, state);
          if (route?.length) {
            chosen = route[0];
            board();
          } else finish();
          demoWait = 0;
        } else if (phase === 'ride' && rideTime / duration > .43 && !stamp) {
          side = edge.side;
          snapshot();
        }
      },
      draw(c, w = 480, h = 480) {
        draw(c, w, h, {
          book,
          state,
          phase,
          edge,
          selected: chosen,
          planning: pins.length ? cursor() : null,
          plan: pins,
          journey,
          quiet: api.reducedMotion,
          time,
          side,
          souvenir: stamp,
          fraction: rideTime / duration,
          tripStart: state.time,
          showBook,
          saved,
          listing,
          departures: list.slice(listPage * 3, listPage * 3 + 3),
          page: pages[journalIndex],
          pageNumber: pages.length ? journalIndex + 1 + ' / ' + pages.length : '0 / 0',
          quote: Object.values(saved.records).at(-1)?.postcard || POSTCARDS[book.night.city][book.night.shift]
        });
      }
    };
  }
};
