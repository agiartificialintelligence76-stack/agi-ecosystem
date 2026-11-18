import { CABINS, REPERTOIRE, STATIONS, voices } from './repertoire.js';
import { answer, createConcert, drain, encore, finish, step } from './rules.js';
import { listener } from './ai.js';
import { layout, pickCabin } from './layout.js';
import { createBand } from './sound.js';
import { paint } from './render.js';
import { book, enter } from './progress.js';
import { voice } from './lines.js';
const pads = CABINS.map((cab, i) => ({
  id: 'bell' + i,
  label: cab.shape + ' ' + cab.note.toUpperCase(),
  key: String(i + 1)
}));
const controls = [...pads, {
  id: 'join',
  label: 'Join two notes',
  key: 'J'
}, {
  id: 'encore',
  label: 'Hear again',
  key: 'E'
}, {
  id: 'book',
  label: 'Songbook',
  key: 'B'
}, {
  id: 'bow',
  label: 'Take a bow',
  key: 'X'
}];
const shelfControls = [{
  id: 'previous',
  label: 'Previous song',
  key: '←'
}, {
  id: 'play',
  label: 'Play refrain',
  key: 'Space'
}, {
  id: 'next',
  label: 'Next song',
  key: '→'
}, {
  id: 'close',
  label: 'Return to stage',
  key: 'B'
}];
const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  home = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];
export default {
  title: 'CABLE CHOIR',
  tagline: 'AGI-1 conducts four singing cabins. Take her baton and play the valley’s melody from memory.',
  modes: [{
    id: 'book',
    label: 'Concert book · 24 songs'
  }, {
    id: 'climb',
    label: 'Endless climb'
  }, {
    id: 'daily',
    label: 'Daily melody'
  }],
  options: [{
    id: 'program',
    label: 'Concert book',
    values: [{
      id: 'continue',
      label: 'Continue my tour'
    }, {
      id: 'opening',
      label: 'Opening concert'
    }, {
      id: 'station',
      label: 'Revisit newest station'
    }]
  }],
  controls,
  keys: [['1–4 or A S D F', 'Ring the four cabins'], ['J then two notes', 'Build a chord one note at a time'], ['E / X', 'Hear again / take a bow']],
  touch: [['Cabins or four note buttons', 'Answer each note in order'], ['Join two notes', 'Select two notes for one chord']],
  instructions: [['Listen', 'Watch the cabin and its shape light up with each bell. AGI-1 passes you the baton when the phrase is over.'], ['Echo', 'Ring those cabins in order. Take as much time as you like. Hear again starts another demonstration.'], ['Make a chord', 'When two cabins light together, hold both keys or pads and release. On one finger, select Join two notes and tap each bell.'], ['Tour the Alps', 'Finish seven growing phrases for a songbook stamp. The concert book has 24 tunes. A daily concert and endless climb share the four bells.']],
  progress(data) {
    const p = book(data);
    return p.stamps.length || p.longest ? 'Songbook ' + p.stamps.length + '/24 · longest echo ' + p.longest + (p.stamps.length ? ' · last stamp ' + REPERTOIRE[p.stamps.at(-1)].title : '') : '';
  },
  create(api) {
    const p = book(api.store?.read()),
      next = REPERTOIRE.findIndex(piece => !p.stamps.includes(piece.id));
    const unfinished = next < 0 ? 0 : next;
    const start = api.options?.program === 'opening' ? 0 : api.options?.program === 'station' ? Math.floor(unfinished / 3) * 3 : unfinished;
    const seed = api.seed ?? Math.floor((api.rng?.() ?? .5) * 0xffffffff);
    const s = createConcert({
      seed,
      mode: api.mode || 'book',
      start,
      preview: api.demo
    });
    const band = createBand(api.audio),
      bot = listener('demo', seed),
      counts = {};
    const held = new Set();
    let accumulated = 0,
      sticky = 0,
      join = false,
      paused = false,
      shelf = null;
    function openBook() {
      const progress = book(api.store?.read());
      shelf = {
        ids: [...new Set([...progress.stamps, s.piece])],
        i: 0
      };
      shelf.i = shelf.ids.indexOf(s.piece);
      band.stop();
      clearPad();
      api.controls?.(shelfControls);
    }
    function shelfAction(id) {
      if (id === 'book' || id === 'close') {
        shelf = null;
        api.controls?.(controls);
        if (s.phase === 'listen') band.phrase({
          times: s.times,
          notes: s.melody,
          tonic: s.sheet.tonic
        }, s.age);
        return;
      }
      if (id === 'previous' || id === 'next') shelf.i = (shelf.i + (id === 'next' ? 1 : -1) + shelf.ids.length) % shelf.ids.length;
      if (id === 'play' || id === 'next' || id === 'previous') {
        const piece = REPERTOIRE[shelf.ids[shelf.i]];
        band.phrase({
          times: [.08, .44, .8, 1.16],
          notes: piece.notes.slice(0, 4).map(n => 1 << n),
          tonic: piece.tonic
        });
      }
    }
    const tell = event => {
      const n = counts[event] || 0;
      counts[event] = n + 1;
      api.say?.(voice(event, n));
    };
    const save = (piece, done) => {
      if (!api.demo) api.store?.update?.(data => enter(data, s, piece, done));
    };
    function clearPad() {
      held.clear();
      accumulated = 0;
      sticky = 0;
      join = false;
      s.pendingChord = '';
    }
    function events() {
      for (const e of drain(s)) {
        bot.observe(e);
        if (e.type === 'listen') {
          clearPad();
          band.phrase(e);
          if (s.turn === 1) tell('opening');else tell('listen');
        }
        if (e.type === 'echo') {
          band.effect('echo');
          tell('echo');
        }
        if (e.type === 'answer') {
          api.haptic?.(7);
        }
        if (e.type === 'cue' && voices(e.mask).length > 1 && counts.chord == null) tell('chord');
        if (e.type === 'miss') {
          band.effect('miss');
          api.effect?.('miss', 'Rehearse');
          tell('mistake');
        }
        if (e.type === 'clear') {
          band.effect('summit', s.sheet.tonic);
          api.effect?.('chorus', e.size + ' bells');
          tell('streak');
          save(null, false);
        }
        if (e.type === 'song') {
          api.effect?.('unlock', 'Songbook stamp');
          tell('summit');
          save(e.piece, false);
        }
        if (e.type === 'end') {
          save(null, true);
          band.effect('bow');
          api.end(s.score, [['Longest echo', s.longest], ['Phrases answered', s.completed], ['Songs stamped', s.songs], ['Encores', s.encores]], voice(e.reason === 'summit' ? 'summit' : 'return', s.completed));
        }
      }
    }
    function commit(mask) {
      if (mask) answer(s, mask);
      events();
    }
    function act(id, type) {
      if (paused || s.ended) return;
      if (shelf) {
        if (type === 'down') shelfAction(id);
        return;
      }
      if (id === 'book' && type === 'down') {
        openBook();
        return;
      }
      if (id === 'bow' && type === 'down') {
        finish(s);
        events();
        return;
      }
      if (id === 'encore' && type === 'down') {
        encore(s);
        events();
        return;
      }
      if (s.phase !== 'echo') return;
      if (id === 'join' && type === 'down') {
        join = !join;
        sticky = 0;
        s.pendingChord = join ? '• •' : '';
        band.effect('join');
        if (join) tell('chord');
        return;
      }
      const n = pads.findIndex(pad => pad.id === id);
      if (n < 0) return;
      if (join) {
        if (type === 'down') {
          const b = 1 << n;
          if (sticky & b) return;
          sticky |= b;
          s.pendingChord = voices(sticky).map(i => CABINS[i].shape).join(' ');
          band.bell(b, s.sheet.tonic);
          if (voices(sticky).length === 2) {
            const mask = sticky;
            clearPad();
            commit(mask);
          }
        }
        return;
      }
      if (type === 'down' && !held.has(n)) {
        held.add(n);
        accumulated |= 1 << n;
        s.glow[n] = 1;
        band.bell(1 << n, s.sheet.tonic);
      }
      if (type === 'up' && held.delete(n) && !held.size) {
        const mask = accumulated;
        accumulated = 0;
        commit(mask);
      }
    }
    events();
    return {
      action: act,
      key(type, code) {
        if (shelf) {
          const cmd = {
            ArrowLeft: 'previous',
            ArrowRight: 'next',
            Space: 'play',
            KeyB: 'close'
          }[code];
          if (cmd) act(cmd, type);
          return;
        }
        if (code === 'KeyB') {
          act('book', type);
          return;
        }
        const n = Math.max(keys.indexOf(code), home.indexOf(code));
        if (n >= 0) act('bell' + n, type);else if (code === 'KeyE') act('encore', type);else if (code === 'KeyJ') act('join', type);else if (code === 'KeyX') act('bow', type);
      },
      pointer(type, x, y, w = 480, h = 480) {
        if (type === 'cancel') {
          clearPad();
          return;
        }
        if (type === 'down') {
          const n = pickCabin(layout(w, h), x, y);
          if (n >= 0) {
            act('bell' + n, 'down');
            act('bell' + n, 'up');
          }
        }
      },
      update(dt) {
        if (paused || s.ended || shelf) return;
        if (s.phase === 'listen') {
          const age = band.heard();
          if (age != null) s.age = Math.max(0, age - dt);
        }
        step(s, dt);
        events();
        api.hud('Applause', s.score, 'Song', s.mode === 'climb' ? 'Echo ' + (s.round + 2) : STATIONS[s.sheet.station].name);
      },
      demo(dt) {
        bot.drive(s, dt);
        events();
      },
      draw(c, w = 480, h = 480) {
        paint(c, s, w, h, api.reducedMotion, shelf);
      },
      cancelInput: clearPad,
      pause() {
        paused = true;
        band.stop();
        clearPad();
      },
      resume() {
        paused = false;
        if (!shelf && s.phase === 'listen') band.phrase({
          times: s.times,
          notes: s.melody,
          tonic: s.sheet.tonic
        }, s.age);
      },
      dispose() {
        band.stop();
        clearPad();
      }
    };
  }
};
