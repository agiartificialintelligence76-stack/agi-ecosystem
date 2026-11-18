import { RECIPES, DAYS, BASES, GUESTS, dailyMenu } from './menu.js';
import { open, act, step, drain, cancel, recipe, cupCount, sealPhase, ticketBy, STEP } from './counter.js';
import { notebook, record } from './progress.js';
import { keys as code } from './controls.js';
import { barista, openingRush } from './barista.js';
import { kitchenAudio } from './sound.js';
import { paint, layout, ticketHit } from './render.js';
import { voice } from './lines.js';
const b = (id, label, key, extra = {}) => ({
  id,
  label,
  key,
  ...extra
});
const first = [b('tea', 'Hold tea', 'Q'), b('seal', 'Seal & serve', 'Space')];
export default {
  title: 'BOBA BREAK',
  tagline: 'AGI-1 runs the tea taps. Make each guest’s drink while the next cup is already filling.',
  modes: [{
    id: 'week',
    label: 'Counter Week'
  }, {
    id: 'daily',
    label: 'Daily Menu'
  }, {
    id: 'endless',
    label: 'Endless Rush'
  }, {
    id: 'bench',
    label: 'Recipe Bench'
  }],
  options: [{
    id: 'shift',
    label: 'Week shift',
    values: [{
      id: 'latest',
      label: 'Latest unlocked day'
    }, ...DAYS.map((d, i) => ({
      id: String(i),
      label: i + 1 + ' · ' + d.name
    }))]
  }, {
    id: 'drink',
    label: 'Recipe Bench drink',
    values: RECIPES.map(r => ({
      id: String(r.id),
      label: r.id + 1 + ' · ' + r.name
    }))
  }],
  controls: first,
  instructions: [['Read the ticket', 'Tea and milk are measured in marks. Hold their taps and release just before each target. The stream coasts after release.'], ['Run two stations', 'Switch cups while a held or latched tap fills the first. Later, batch two tickets with the same base. Oolong and berry kettles take time to steep.'], ['Finish the drink', 'Match pearl and star scoops, ice and shake count. Wait for the green sealer window, then press Seal & serve.'], ['Rescue a wrong cup', 'Choose a waiting ticket and relabel the active cup. The old recipe swaps to the other station if necessary. Three guests walking out closes Endless.']],
  keys: [['Q / W, F', 'Hold tea / milk, switch cup'], ['A / S / I, B', 'Pearl, star jelly, ice, change tea base'], ['E, Z / C', 'Hold shaker, or alternate left and right'], ['Space, G / K', 'Seal, latch tea / batch both taps'], ['T / L, R, X', 'Next ticket / relabel, remake, file a shift after serving']],
  touch: [['The taps', 'Hold and release tea or milk. Latch keeps the tea running when you switch cups.'], ['The counter', 'Tap a cup to select it. Open Finish for toppings, shake and the sealer.'], ['Orders', 'Tap a visible ticket or use Next ticket. Relabel gives your current cup that ticket.']],
  progress(data) {
    const n = notebook(data);
    return n.day + 1 + ' / 8 shifts open · ' + (n.day + 1) * 3 + ' recipes · best clean streak ' + n.streak;
  },
  create(api) {
    const seed = api.seed ?? Math.floor((api.rng?.() ?? .5) * 0xffffffff),
      mode = api.mode || 'week',
      book = notebook(api.store?.read?.()),
      opening = api.openingProgress ? notebook(api.openingProgress) : book;
    const desired = api.options?.shift,
      day = api.demo ? 3 : mode === 'daily' ? dailyMenu(seed).day : mode === 'bench' ? Math.min(opening.day, Math.floor((Number(api.options?.drink) || 0) / 3)) : mode === 'week' && desired != null && desired !== 'latest' ? Math.min(opening.day, Math.max(0, Number(desired) || 0)) : opening.day;
    const bench = Math.max(0, Math.min((opening.day + 1) * 3 - 1, Number(api.options?.drink) || 0)),
      audio = kitchenAudio(api.audio),
      pilot = api.demo ? openingRush(seed) : barista('demo', seed);
    let s = open(day, mode, seed, bench, api.demo, opening.guests),
      bookIndex = bench;
    let panel = 'mix',
      paused = false,
      ended = false,
      mark = 0,
      clock = 0,
      acc = 0,
      drag = null,
      seal = .0,
      note = '',
      lastDock = '',
      demoPlay = !!api.demo;
    const held = new Set(),
      say = id => {
        note = voice[id] || id;
        api.say?.(note);
      };
    function current() {
      return s.cups[s.active];
    }
    function teaching() {
      return s.day === 0 && s.served === 0 && recipe(s)?.id === 0 && (mode === 'week' || mode === 'bench');
    }
    function dock() {
      let items = [];
      const r = recipe(s),
        c = current(),
        canSwitch = cupCount(s) > 1,
        swap = b('switch', 'Cup ' + (s.active ? 'A' : 'B'), 'F'),
        orders = b('orders', 'Tickets', 'T'),
        finish = b('finish', 'Finish cup', '');
      if (panel === 'receipt') {
        items = [b('mix', 'Back to taps'), b('orders', 'Tickets'), b('file', 'File shift', 'X')];
      } else if (panel === 'book') {
        items = [b('prevRecipe', '‹ Recipe'), b('nextRecipe', 'Recipe ›'), b('orders', 'Tickets')];
        if (mode === 'bench') items.push(b('practice', 'Practice drink'));
      } else if (panel === 'orders') {
        items = [b('ticket', 'Next ticket', 'T'), b('label', 'Relabel cup', 'L'), b('remake', 'Remake cup', 'R'), b('book', 'Recipe book'), b('mix', 'Back to taps')];
        if (s.receipt) items.push(b('receipt', 'Last receipt'));
        if (canSwitch) items.push(swap);
        if (s.gear.batch) items.push(b('batch', 'Pair tea taps', 'K'));
        if (s.served) items.push(b('file', 'File shift', 'X'));
      } else if (teaching()) {
        items = [b('tea', 'Hold tea', 'Q'), b('seal', 'Seal & serve', 'Space'), b('remake', 'Remake', 'R'), b('orders', 'Tickets', 'T')];
      } else if (panel === 'mix') {
        items = [b('tea', 'Hold tea', 'Q'), b('milk', 'Hold milk', 'W'), finish];
        if (s.gear.bases > 1) items.push(b('leaf', BASES[c.base], 'B'));
        if (canSwitch) items.push(b('latch', c.latch ? 'Stop latch' : 'Latch tea', 'G', {
          pressed: c.latch
        }), swap);
        items.push(orders);
      } else {
        items = [b('pearl', 'Pearls ' + c.pearl, 'A')];
        if (s.gear.star) items.push(b('star', 'Stars ' + c.star, 'S'));
        if (s.gear.ice) items.push(b('ice', c.ice ? 'Iced' : 'Add ice', 'I', {
          pressed: !!c.ice
        }));
        if (s.gear.shake) items.push(b('shaker', 'Hold shake ' + c.shake, 'E'));
        items.push(b('seal', 'Seal & serve', 'Space'), b('mix', 'Back to taps'));
        if (canSwitch) items.push(swap);
      }
      const k = JSON.stringify(items);
      if (k !== lastDock) {
        lastDock = k;
        api.controls?.(items);
      }
    }
    function hud() {
      api.hud?.('Score', s.score, mode === 'endless' ? 'Walkouts' : mode === 'bench' ? 'Recipe' : 'Shift', mode === 'endless' ? s.lost + ' / 3' : mode === 'bench' ? s.bench + 1 + ' / 24' : Math.floor(Math.max(0, s.dayInfo.length - s.time) / 60) + ':' + String(Math.floor(Math.max(0, s.dayInfo.length - s.time) % 60)).padStart(2, '0'));
    }
    function finish(real) {
      if (ended) return;
      ended = true;
      cancel(s);
      audio.stop();
      const stars = record(api.store, s, real);
      const last = s.receipt,
        quality = last ? Math.round(last.quality * 100) + '%' : '—';
      api.end?.(s.score, [['Drinks served', s.served], ['Clean cups', s.perfect], ['Guests lost', s.lost], ['Best streak', s.bestStreak], ['Last drink', quality], ['Last cup points', last?.score || 0], ['Shift stars', '★'.repeat(stars) || '—']], voice[mode === 'daily' ? 'Daily finished' : real ? 'Close' : 'Personal best']);
    }
    function events() {
      for (const e of drain(s)) {
        switch (e.type) {
          case 'guest':
            audio.ring('guest');
            audio.ring('printer');
            if (e.id === 1) say('First customer');else if (e.regular) say('Regular returns');else if (s.queue.length >= 4) say('Long queue');else if (s.queue.length === 2) say('Second cup');
            break;
          case 'valve':
            if (s.served === 0) say('First hold');
            break;
          case 'assist':
            say('Seal ready');
            break;
          case 'pearl':
            audio.ring('pearl');
            say(e.count > (recipe(s)?.pearl ?? 0) ? 'Extra pearl' : e.count === recipe(s)?.pearl ? 'Correct count' : 'First pearl');
            break;
          case 'star':
            audio.ring('star');
            say('Correct count');
            break;
          case 'ice':
            audio.ring('ice');
            if (e.count !== recipe(s)?.ice) say('Wrong ice');
            break;
          case 'shake':
            audio.ring('shake', current().side);
            say(e.count > (recipe(s)?.shake ?? 0) ? 'Overshake' : e.count === 1 ? 'First shaker' : e.count > 3 ? 'Frothy shake' : 'Gentle shake');
            break;
          case 'latch':
          case 'batch':
            audio.ring('latch');
            say(e.type === 'batch' ? 'Two compatible orders' : 'Second cup');
            break;
          case 'steep':
          case 'kettle':
            audio.ring('kettle');
            say(e.type === 'steep' ? 'The kettle needs three seconds. Start the other cup.' : 'Fresh tea at the tap.');
            break;
          case 'served':
            audio.ring('seal');
            seal = .5;
            mark = 1;
            api.effect?.(e.perfect ? 'perfect' : 'serve');
            api.haptic?.(e.perfect ? 25 : 10);
            say(e.perfect ? 'Clean seal' : e.miss === 'tea' ? 'Too much tea' : e.miss === 'milk' ? 'Too much milk' : 'Underfilled');
            panel = 'mix';
            break;
          case 'earlySeal':
            audio.ring('miss');
            say('Seal too early');
            break;
          case 'reject':
            audio.ring('miss');
            say('Check ' + e.miss + ' on this ticket. You can relabel or remake the cup.');
            break;
          case 'relabel':
            say('Rescued order');
            audio.ring('printer');
            break;
          case 'mismatch':
            say('These taps need the same tea base on both tickets.');
            break;
          case 'low':
            say('Patience low');
            break;
          case 'lost':
            say('Guest leaves');
            audio.ring('miss');
            break;
          case 'streak':
            audio.ring('streak');
            say('Clean streak');
            api.effect?.('streak');
            break;
          case 'wave':
            say(e.wave === 1 ? 'First rush' : e.wave === 3 ? 'Last ticket' : 'Rush cleared');
            audio.ring('guest');
            break;
          case 'switch':
            say('Second cup');
            break;
          case 'sameLabel':
            say('That ticket already belongs to this cup.');
            break;
          case 'empty':
            say('Underfilled');
            break;
          case 'close':
            finish(true);
            break;
        }
      }
      if (!ended) {
        hud();
        dock();
      }
    }
    function send(id, phase) {
      if (phase === 'up') {
        act(s, id, 'up');
        return;
      }
      if (ended || paused || phase !== 'down') return;
      if (id === 'file' && s.served) {
        finish(false);
        return;
      }
      if (['orders', 'mix', 'finish', 'book', 'receipt'].includes(id)) {
        panel = id;
        if (id === 'book') bookIndex = recipe(s)?.id ?? 0;
        if (id === 'receipt' && s.receipt) say('Last drink ' + s.receipt.score + ' points. Weakest mark: ' + s.receipt.miss + '.');
        dock();
        return;
      }
      const unlocked = (Math.max(book.day, mode === 'daily' || mode === 'endless' ? s.day : 0) + 1) * 3;
      if (panel === 'book' && (id === 'prevRecipe' || id === 'nextRecipe')) {
        bookIndex = (bookIndex + (id === 'prevRecipe' ? unlocked - 1 : 1)) % unlocked;
        const r = RECIPES[bookIndex];
        say(r.name + '. ' + BASES[r.base] + ', ' + r.tea + ' tea marks and ' + r.milk + ' milk marks.');
        dock();
        return;
      }
      if (panel === 'book' && id === 'practice' && mode === 'bench') {
        s = open(Math.floor(bookIndex / 3), 'bench', seed, bookIndex, false, book.guests);
        panel = 'mix';
        events();
        return;
      }
      act(s, id);
      events();
    }
    function update(dt) {
      if (ended || paused) return;
      clock += dt;
      seal = Math.max(0, seal - dt);
      mark = Math.max(0, mark - dt);
      acc += Math.min(.1, dt);
      while (acc + 1e-9 >= STEP && !ended) {
        acc -= STEP;
        if (demoPlay) pilot.run(s, STEP);
        step(s);
        events();
      }
      if (!ended) audio.sync(s);
    }
    say('Open');
    events();
    if (mode === 'bench' && Number(api.options?.drink) > bench) say('This page is still locked. The bench has ' + RECIPES[bench].name + ' ready.');
    return {
      action: send,
      key(edge, k) {
        if (!code[k]) return;
        if (edge === 'up') {
          held.delete(k);
          send(code[k], edge);
          return;
        }
        if (held.has(k)) return;
        held.add(k);
        send(code[k], edge);
      },
      pointer(kind, x, y, w, h) {
        if (ended || paused) return;
        if (kind === 'cancel') {
          drag = null;
          return;
        }
        if (kind === 'down') {
          drag = {
            x,
            y
          };
          return;
        }
        if (!drag) return;
        if (Math.hypot(x - drag.x, y - drag.y) > 14) {
          drag = null;
          return;
        }
        if (kind !== 'up') return;
        drag = null;
        const g = layout(s, w, h),
          id = ticketHit(s, g, x, y);
        if (id) {
          s.focus = id;
          panel = 'orders';
          say('Ticket for ' + GUESTS[ticketBy(s, id).guest] + '. Relabel to assign this cup.');
          dock();
          return;
        }
        const i = g.xs.findIndex(xx => Math.abs(x - xx) < g.unit * .49 && y >= g.base - g.unit * 1.25 && y <= g.base + 14);
        if (i >= 0 && i !== s.active) send('switch', 'down');
      },
      update,
      demo() {
        demoPlay = true;
      },
      draw(c, w, h) {
        paint(c, w, h, s, {
          time: clock,
          seal,
          mark,
          panel,
          bookIndex,
          reduced: api.reducedMotion,
          note
        });
      },
      pause() {
        paused = true;
        cancel(s);
        held.clear();
        drag = null;
        audio.stop();
      },
      resume() {
        paused = false;
      },
      cancelInput() {
        held.clear();
        drag = null;
        cancel(s);
      },
      dispose() {
        ended = true;
        cancel(s);
        audio.stop();
      },
      inspect() {
        return {
          state: s,
          panel,
          ended,
          paused,
          note
        };
      }
    };
  }
};
