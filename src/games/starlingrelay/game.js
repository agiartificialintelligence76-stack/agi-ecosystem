import { acts, cueName, deck, lighting, playCue, productions } from './productions.js';
import { blocking, move } from './blocking-map.js';
import { prove, ink, compile, check, stars, VERSION } from './score.js';
import { read, unlocked, daily, saveShow, saveRehearsal, sellouts } from './playbill.js';
import { draw, drawPlaybill } from './theatre.js';
import { lines } from './lines.js';
import { pit } from './sound.js';
import { trayLimit } from './directors.js';
const pad = (id, label, key) => ({ id, label, key });
const mainKeys = {
  ArrowUp: 'S',
  ArrowLeft: 'L',
  ArrowRight: 'R',
  KeyB: 'B',
  KeyW: 'W',
  KeyK: 'K',
  KeyP: 'P',
  KeyO: '(',
  Digit2: '2',
  Digit3: '3',
  KeyA: '@',
};
const menus = [pad('edit', 'Edit strip', 'E'), pad('deck', 'Cue rack', 'C'), pad('go', 'Run show', 'G')];
const clone = (p) => ({ main: [...p.main], dance: [...p.dance] });
const showStars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
export default {
  title: 'CURTAIN CALL',
  tagline: 'Direct AGI-1, her understudy and the light crew with one pocket-sized cue sheet.',
  instructions: [
    [
      'Write her entrance',
      'The black-and-gold blocking strip gives each beat in order. Pick cards from the cue rack and run the show.',
    ],
    [
      'Rehearse and revise',
      'Inspect each requested beat or step through your strip. Edit either side of the gold insertion line. A pose, rest, turn or handoff each takes a beat.',
    ],
    [
      'Use less ink',
      'Encores replay a bracketed phrase twice or three times. A reusable Dance A costs two ink to declare. A lamp card chooses its action in sun or moon.',
    ],
  ],
  keys: [
    ['↑ / ← / → / B / W', 'Step, turn, bow, rest'],
    ['G / E / C / Z', 'Run, editor, rack, undo'],
    ['[ / ]', 'Move insertion point'],
    ['Space', 'Single step or advance'],
  ],
  touch: [
    ['Cue rack', 'Place a card at the gold insertion line'],
    ['Tap a blocking mark', 'Inspect that beat before running'],
    ['Edit strip', 'Insert, undo, erase or inspect an alternate plot'],
  ],
  controls: menus,
  modes: [
    { id: 'season', label: 'Story season' },
    { id: 'daily', label: 'Daily matinée' },
    { id: 'free', label: 'Free rehearsal' },
  ],
  options: [
    {
      id: 'scene',
      label: 'Playbill',
      values: [
        { id: 'next', label: 'Next open scene' },
        { id: 'saved', label: 'My saved rehearsal' },
        ...productions.map((s) => ({ id: String(s.id), label: s.id + ' · ' + s.name })),
      ],
    },
  ],
  scoreGroup: ({ mode, seed, options }) => (mode === 'daily' ? 'daily/' + seed : mode + '/' + options.scene),
  progress(data) {
    const book = read(data),
      shows = Object.values(book.scenes);
    return shows.length
      ? 'Playbill · ' +
          shows.length +
          '/' +
          productions.length +
          ' productions · ' +
          shows.reduce((a, x) => a + x.stars, 0) +
          ' stars'
      : '';
  },
  create(api) {
    const mode = api.mode || 'season',
      seed = api.seed || 7,
      sound = pit(api.demo ? null : api.audio);
    let book = read(api.store?.read?.()),
      scene,
      proof,
      program,
      track,
      cursor,
      panel,
      history,
      inspect,
      plot;
    let playing = false,
      stepping = false,
      elapsed = 0,
      time = 0,
      beat = 0,
      compiled = null,
      cast,
      previous,
      success = false,
      finished = false,
      phase = 1,
      obtained = 0;
    let cleared = 0,
      points = 0,
      clock = 0,
      speech = 0,
      lastHint = '',
      lastControls = '',
      note = '',
      archiveIndex = 0;
    const say = (text) => api.say?.(text);
    const speak = (key) => say(lines[key][(seed + speech++) % lines[key].length]);
    function load(target, saved) {
      scene = target;
      proof = prove(scene);
      program = saved ? clone(saved) : { main: [...scene.first], dance: [] };
      track = 'main';
      cursor = program.main.length;
      history = [];
      panel = 'deck';
      inspect = plot = beat = 0;
      playing = stepping = success = false;
      elapsed = 0;
      phase = 1;
      compiled = null;
      cast = previous = blocking(scene).traces[0][0];
      note = scene.direction;
      lastHint = '';
      say(scene.id === 1 ? scene.direction : lines.start[(seed + speech++) % 2] + ' ' + scene.direction);
      controls();
    }
    const free = mode === 'free',
      isDaily = mode === 'daily';
    const opening = api.openingProgress ? read(api.openingProgress) : book;
    const eligible = productions.filter((s) => unlocked(opening, s));
    const requested = api.options?.scene === 'saved' ? opening.rehearsal?.id : Number(api.options?.scene);
    const chosen =
      eligible.find((s) => s.id === requested) || eligible.find((s) => !opening.scenes[s.id]) || eligible[0];
    let base = api.demo ? productions[28] : isDaily ? daily(seed) : chosen;
    const saved = free && opening.rehearsal?.id === base.id && opening.rehearsal.v !== 0 ? opening.rehearsal : null;
    function controls() {
      let list;
      if (panel === 'archive')
        list = [
          pad('prior', 'Previous print'),
          pad('later', 'Next print'),
          pad('archiveBack', 'Back to score'),
          pad('openPrint', 'Revisit scene'),
          pad('savedScore', 'Replay best score'),
        ].map((b) => ({
          ...b,
          disabled:
            b.id === 'openPrint'
              ? !unlocked(book, productions[archiveIndex])
              : b.id === 'savedScore'
                ? !book.scenes[productions[archiveIndex].id]?.program
                : false,
        }));
      else if (success)
        list = [
          pad('next', 'Next scene', 'Space'),
          pad('file', 'File playbill', 'F'),
          pad('replay', 'Replay show'),
          pad('edit', 'Revise score'),
          pad('copy', 'Director copy'),
        ].filter((b) => b.id !== 'next' || !isDaily);
      else if (playing)
        list = [
          pad('stop', 'Back to edit', 'Q'),
          pad('single', stepping ? 'Next beat' : 'Pause on a beat', 'Space'),
        ];
      else if (panel === 'edit') {
        list = [
          pad('back', 'Cue rack', 'C'),
          pad('before', '← Insert', '['),
          pad('after', 'Insert →', ']'),
          pad('undo', 'Undo', 'Z'),
          pad('erase', 'Erase', '⌫'),
          pad('single', 'Step through', 'Space'),
          pad('mark', 'Inspect beat'),
          pad('hint', 'Director note', 'H'),
          pad('go', 'Run show', 'G'),
        ];
        if (scene.act >= 2) list.push(pad('track', track === 'dance' ? 'Edit Main' : 'Edit Dance A', 'T'));
        if (scene.plots > 1) list.push(pad('plot', 'Light plot ' + (plot + 1)));
        if (free) list.push(pad('save', 'Save rehearsal'));
        if (!isDaily) list.push(pad('archive', 'My playbill'));
      } else {
        const cards = deck(scene),
          advanced = panel === 'extra';
        list = cards
          .filter((c) =>
            advanced
              ? ['(', '2', '3', '@'].includes(c) || c.startsWith('?')
              : !['(', '2', '3', '@'].includes(c) && !c.startsWith('?')
          )
          .map((c) => pad('card:' + c, cueName(c)));
        if (cards.includes('('))
          list.push(pad(advanced ? 'deck' : 'extra', advanced ? 'Footwork' : 'Score devices'));
        list.push(pad('edit', 'Edit strip', 'E'), pad('go', 'Run show', 'G'));
      }
      const sig = JSON.stringify(list);
      if (sig !== lastControls) {
        lastControls = sig;
        api.controls?.(list);
      }
      api.hud?.('Scene', scene.id, 'Ink / tray', ink(program) + ' / ' + budget());
    }
    function edit(change, key) {
      history.push({ program: clone(program), track, cursor });
      if (history.length > 100) history.shift();
      change();
      sound.play(key === 'fix' ? 'erase' : 'insert');
      speak(key);
      controls();
    }
    function budget() {
      return trayLimit(scene, proof.par);
    }
    function resetCast() {
      playing = stepping = false;
      beat = 0;
      phase = 1;
      cast = previous = blocking(scene).traces[plot][0];
      controls();
    }
    function start(single = false) {
      if (!free && ink(program) > budget()) {
        say('The ink tray holds ' + budget() + ' tokens. Group a repeated phrase or erase a card.');
        sound.play('miss');
        api.effect?.('fault', 'Ink tray full');
        return;
      }
      compiled = compile(scene, program);
      if (compiled.error || !compiled.beats.length) {
        note = compiled.error || 'Your cue strip is empty.';
        say(note);
        sound.play('miss');
        api.effect?.('fault');
        return;
      }
      success = false;
      beat = 0;
      elapsed = 0.02;
      phase = 1;
      plot = 0;
      cast = previous = blocking(scene).traces[plot][0];
      playing = true;
      stepping = single;
      sound.play('run');
      speak('run');
      controls();
      if (single) advance();
    }
    function miss(message) {
      playing = stepping = false;
      success = false;
      inspect = Math.min(beat, scene.beats.length - 1);
      const source = compiled.beats[beat];
      if (source) {
        track = source.track;
        cursor = source.index;
      }
      note = message;
      say(message + ' ' + lines.miss[(seed + speech++) % 2]);
      sound.play('miss');
      api.effect?.('fault', 'Missed mark');
      controls();
    }
    function clear() {
      playing = stepping = false;
      success = true;
      obtained = free ? 1 : stars(ink(program), proof.par);
      const record = book.scenes[scene.id],
        first = !record || record.ink > ink(program);
      if (!api.demo && !free) {
        saveShow(api.store, scene, program, proof.par, mode, seed);
        book = read(api.store?.read?.());
      }
      if (!api.demo && free) saveRehearsal(api.store, scene, program);
      if (!clearedIds.has(scene.id)) {
        clearedIds.add(scene.id);
        cleared++;
        points += obtained * 300 + scene.beats.length * 10;
      }
      sound.play('cheers');
      api.effect?.('win', showStars(obtained));
      api.haptic?.(22);
      speak(obtained === 3 ? 'par' : scene.plots > 1 ? 'plots' : first ? 'final' : 'mark');
      controls();
    }
    function advance() {
      if (!playing) return;
      const card = compiled.beats[beat],
        want = scene.beats[beat];
      if (free && !card) {
        clear();
        return;
      }
      if (!want && !card) {
        if (plot + 1 < scene.plots && !free) {
          plot++;
          beat = 0;
          cast = previous = blocking(scene).traces[plot][0];
          sound.play('lamp');
          speak('plots');
          return;
        }
        clear();
        return;
      }
      const sun = lighting(scene, beat, plot);
      if (!card || (!free && (!want || playCue(card.code, sun) !== playCue(want, sun)))) {
        const needed = want ? cueName(playCue(want, sun)) : 'the end of the score';
        if (card) {
          previous = cast;
          cast = move(cast, playCue(card.code, sun));
          phase = 0;
        }
        miss('Plot ' + (plot + 1) + ', beat ' + (beat + 1) + ' needs ' + needed + '. Edit this card.');
        return;
      }
      const action = playCue(card.code, sun);
      previous = cast;
      cast = move(cast, action);
      phase = 0;
      const map = blocking(scene),
        actor = cast.actors[cast.active];
      if (
        free &&
        (actor.x < map.minX - 1 || actor.x > map.maxX + 1 || actor.y < map.minY - 1 || actor.y > map.maxY + 1)
      ) {
        miss('That step goes past the edge of the stage.');
        return;
      }
      if (cast.actors[0].x === cast.actors[1].x && cast.actors[0].y === cast.actors[1].y && scene.act === 4) {
        miss('Both performers need room on this beat.');
        return;
      }
      sound.beat(beat, scene.act, action);
      sound.play({ S: 'step', R: 'turn', L: 'turn', B: 'bow', W: 'rest', K: 'cat', P: 'cat' }[action], beat % 5);
      if (action === 'P') speak('paw');
      else if (action === 'K') speak('cat');
      else if (card.code[0] === '?') speak('branch');
      else if (beat > 1 && beat % 4 === 0)
        speak(card.call != null ? 'routine' : card.encore != null ? 'encore' : 'mark');
      beat++;
      inspect = Math.min(beat, scene.beats.length - 1);
      if (free && beat >= compiled.beats.length) clear();
    }
    function file() {
      if (finished) return;
      finished = true;
      sound.play('cheers');
      api.end?.(
        points,
        [
          ['Scenes', cleared],
          ['Last curtain', scene.name],
          ['Ink / par', ink(program) + ' / ' + proof.par],
          ['Last stars', showStars(obtained)],
        ],
        lines.final[seed % 2]
      );
    }
    function next() {
      if (isDaily) return file();
      const eligible = productions.filter((s) => unlocked(book, s));
      const following = api.demo
        ? productions[(scene.id + 4) % productions.length]
        : eligible.find((s) => s.id > scene.id && !book.scenes[s.id]) || eligible.find((s) => !book.scenes[s.id]);
      if (!following) return file();
      load(following);
    }
    function action(id) {
      if (finished) return;
      if (panel === 'archive') {
        if (id === 'prior' || id === 'later')
          archiveIndex = (archiveIndex + productions.length + (id === 'prior' ? -1 : 1)) % productions.length;
        if (id === 'archiveBack') panel = 'edit';
        if (id === 'openPrint' || id === 'savedScore') {
          const target = productions[archiveIndex],
            saved = book.scenes[target.id]?.program;
          if (!unlocked(book, target) || (id === 'savedScore' && !saved)) return;
          load(target, id === 'savedScore' ? saved : null);
          if (id === 'savedScore') start();
          return;
        }
        controls();
        if (panel === 'archive')
          say(
            productions[archiveIndex].name +
              ' · ' +
              (book.scenes[productions[archiveIndex].id]?.stars || 0) +
              ' stars'
          );
        return;
      }
      if (id === 'archive' && !isDaily) {
        book = read(api.store?.read?.());
        archiveIndex = scene.id - 1;
        panel = 'archive';
        speak('final');
        controls();
        return;
      }
      if (id === 'copy' && success) {
        success = false;
        program = clone(proof);
        track = proof.dance.length ? 'dance' : 'main';
        cursor = program[track].length;
        panel = 'edit';
        resetCast();
        say('The director’s shortest score is in your rack. Inspect Main and Dance A.');
        return;
      }
      if (id === 'file' && success) {
        file();
        return;
      }
      if (id === 'next' && success) {
        next();
        return;
      }
      if (id === 'replay' && success) {
        start();
        return;
      }
      if (id === 'edit' && success) {
        success = false;
        resetCast();
        panel = 'edit';
        controls();
        return;
      }
      if (success) return;
      if (playing) {
        if (id === 'stop') {
          resetCast();
          speak('fix');
        } else if (id === 'single') {
          if (stepping) advance();
          else {
            stepping = true;
            speak('step');
          }
          controls();
        }
        return;
      }
      if (id === 'go' || id === 'single') {
        start(id === 'single');
        return;
      }
      if (['deck', 'extra', 'edit', 'back'].includes(id)) {
        panel = id === 'back' ? 'deck' : id;
        sound.play('shuffle');
        controls();
        return;
      }
      if (id.startsWith('card:')) {
        const code = id.slice(5);
        if (!deck(scene).includes(code) || program[track].length >= 90) return;
        edit(
          () => {
            program[track].splice(cursor++, 0, code);
          },
          code === '@'
            ? 'routine'
            : code === '2' || code === '3'
              ? 'encore'
              : code.startsWith('?')
                ? 'branch'
                : 'insert'
        );
        return;
      }
      if (id === 'erase' && cursor > 0) {
        edit(() => {
          program[track].splice(--cursor, 1);
        }, 'fix');
        return;
      }
      if (id === 'undo' && history.length) {
        const state = history.pop();
        program = state.program;
        cursor = state.cursor;
        track = state.track;
        sound.play('erase');
        speak('fix');
      } else if (id === 'before' || id === 'after') {
        cursor = Math.max(0, Math.min(program[track].length, cursor + (id === 'before' ? -1 : 1)));
        say('Insert at ' + (cursor + 1) + ' in ' + (track === 'dance' ? 'Dance A' : 'Main') + '.');
      } else if (id === 'track' && scene.act >= 2) {
        track = track === 'dance' ? 'main' : 'dance';
        cursor = program[track].length;
        speak('routine');
      } else if (id === 'plot') {
        plot = (plot + 1) % scene.plots;
        resetCast();
        speak('branch');
      } else if (id === 'mark') {
        inspect = (inspect + 1) % scene.beats.length;
        explain();
      } else if (id === 'hint') {
        const target = proof[track],
          first = target.findIndex((c, i) => c !== program[track][i]);
        if (first >= 0)
          lastHint =
            (track === 'dance' ? 'Dance A' : 'Main') +
            ' · card ' +
            (first + 1) +
            ' can be ' +
            cueName(target[first]) +
            '.';
        else
          lastHint = proof.dance.length && track === 'main' ? 'Put the named phrase in Dance A.' : scene.direction;
        say(lastHint);
        sound.play('lamp');
      } else if (id === 'save' && free) {
        saveRehearsal(api.store, scene, program);
        say('saved your rehearsal in the playbill.');
      }
      controls();
    }
    function explain() {
      say(
        'Beat ' +
          (inspect + 1) +
          ' · ' +
          cueName(scene.beats[inspect]) +
          ' · ' +
          (lighting(scene, inspect, plot) ? 'sun' : 'moon') +
          ' light.'
      );
    }
    const clearedIds = new Set();
    load(base, saved);
    if (isDaily) speak('daily');
    if (api.demo) {
      program = clone(proof);
      start();
      elapsed = -0.18;
    }
    return {
      action(id, type) {
        if (type === 'down') action(id);
      },
      key(type, code) {
        if (type !== 'down') return;
        if (success) {
          action(code === 'KeyF' ? 'file' : code === 'Space' ? 'next' : code === 'KeyE' ? 'edit' : '');
          return;
        }
        const keys = {
          KeyQ: 'stop',
          KeyG: 'go',
          Enter: 'go',
          Space: 'single',
          KeyE: 'edit',
          KeyC: 'deck',
          KeyZ: 'undo',
          Backspace: 'erase',
          BracketLeft: 'before',
          BracketRight: 'after',
          KeyT: 'track',
          KeyH: 'hint',
        };
        if (keys[code]) action(keys[code]);
        else if (mainKeys[code]) action('card:' + mainKeys[code]);
      },
      pointer(type, x, y, w, h) {
        if (type === 'up' && !playing && !success && y > h * 0.74) {
          const n = Math.max(3, Math.floor((w - w * 0.076) / 32)),
            begin = Math.min(Math.max(0, inspect - Math.floor(n / 2)), Math.max(0, scene.beats.length - n));
          inspect = Math.min(
            scene.beats.length - 1,
            Math.max(
              0,
              begin + Math.floor((x - w * 0.038) / Math.min(57, (w - w * 0.076) / Math.min(n, scene.beats.length)))
            )
          );
          explain();
        }
      },
      update(dt) {
        if (finished) return;
        time += dt;
        phase = Math.min(1, phase + dt * 4.5);
        if (!playing || stepping) return;
        elapsed += dt;
        const speed = api.demo ? 0.335 : 0.49;
        while (playing && elapsed >= speed) {
          elapsed -= speed;
          advance();
        }
      },
      draw(c, w, h) {
        if (panel === 'archive') {
          drawPlaybill(c, w, h, productions, archiveIndex, book, sellouts(book));
          return;
        }
        draw(c, w, h, {
          scene,
          plot,
          beat: Math.min(beat, scene.beats.length - 1),
          success,
          running: playing,
          time: api.reducedMotion ? 0 : time,
          phase,
          reduced: api.reducedMotion,
          cast,
          previous,
          program,
          track,
          cursor,
          inspect,
          ink: ink(program),
          par: proof.par,
        });
      },
      demo(dt) {
        clock += dt;
        if (api.demo) {
          if (success && clock > 10.4) file();
          return;
        }
        if (clock < 0.055) return;
        clock = 0;
        if (success) {
          file();
          return;
        }
        if (!playing) {
          program = clone(proof);
          start();
        } else elapsed += 0.5;
      },
      pause() {
        sound.stop();
      },
      dispose() {
        sound.stop();
      },
    };
  },
};
