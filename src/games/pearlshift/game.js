import { SPECIES, REGIONS, DEPTH } from './catalog.js';
import { createSurvey, move, depth, tune, ping, broadcast, abandon, finish, step, drain, observations } from './rules.js';
import { surveyor } from './ai.js';
import { stationSound } from './sound.js';
import { logBook, persist } from './progress.js';
import { voice } from './lines.js';
import { layout, unproject } from './layout.js';
import { paint } from './render.js';
const commands = [{
  id: 'ping',
  label: 'Ping',
  key: 'E'
}, {
  id: 'broadcast',
  label: 'Mark singer',
  key: 'Space'
}, {
  id: 'depth',
  label: 'Depth',
  key: 'D'
}, {
  id: 'tune',
  label: 'Tune voice',
  key: 'T'
}, {
  id: 'library',
  label: 'Recordings',
  key: 'L'
}, {
  id: 'file',
  label: 'File log',
  key: 'X'
}];
const libraryControls = [{
  id: 'previous',
  label: 'Previous',
  key: '←'
}, {
  id: 'play',
  label: 'Play call',
  key: 'Space'
}, {
  id: 'next',
  label: 'Next',
  key: '→'
}, {
  id: 'back',
  label: 'Back to water',
  key: 'L'
}];
export default {
  title: 'ABYSS FM',
  tagline: 'Find the voice in the water. Move AGI-1’s hydrophone and cross two bearings to file a whale song.',
  modes: [{
    id: 'calm',
    label: 'Calm survey · 32 watches'
  }, {
    id: 'night',
    label: 'Night shift · battery run'
  }, {
    id: 'daily',
    label: 'Daily water'
  }],
  options: [{
    id: 'voyage',
    label: 'Survey departure',
    values: [{
      id: 'continue',
      label: 'Continue survey'
    }, {
      id: 'pier',
      label: 'Glasswater Pier'
    }]
  }],
  controls: commands,
  keys: [['Arrow keys', 'Move hydrophone and marker'], ['E / Space', 'Pin a bearing / mark singer'], ['D / T / L / X', 'Depth / voice / recordings / file log']],
  touch: [['Tap or drag the chart', 'Move the receiver'], ['Ping, then Mark singer', 'Pin two bearings from different positions, then mark where they meet']],
  instructions: [['Find the song', 'The chart names a singer. Tune to that voice. The shape next to the name shows the same call you hear in stereo.'], ['Cross two bearings', 'Move the receiver to another part of the chart and Ping. Each line starts at its receiver. Mark where two lines of the requested voice cross.'], ['Listen in layers', 'When a voice sounds muffled, cycle Depth until it reads clear. Wrong-depth lines bend. Later singers keep moving, so use recent lines.'], ['Keep a field log', 'Each correct fix saves a recording. Calm has no clock. Night uses battery; accurate finds recharge it. File log finishes the current trip.']],
  progress(data) {
    const b = logBook(data),
      n = Object.keys(b.records).length;
    return n || b.stations.length ? n + '/12 voices in your log · ' + b.stations.length + '/32 watches surveyed' : '';
  },
  create(api) {
    const log = logBook(api.openingProgress ?? api.store?.read()),
      next = Array.from({
        length: 32
      }, (_, i) => i).find(i => !log.stations.includes(i)) ?? 0;
    const seed = api.seed ?? Math.floor((api.rng?.() ?? .5) * 0xffffffff);
    const s = createSurvey({
      seed,
      mode: api.mode || 'calm',
      start: api.options?.voyage === 'pier' ? 0 : next,
      preview: api.demo
    });
    const radio = stationSound(api.audio),
      pilot = surveyor('demo', seed),
      held = new Set(),
      counts = {};
    let files = null,
      paused = false,
      drag = false;
    const say = (event, explicit) => {
      const n = counts[event] || 0;
      counts[event] = n + 1;
      api.say?.(explicit || voice(event, n));
    };
    const save = kind => {
      if (!api.demo) api.store?.update?.(d => persist(d, s, kind));
    };
    function dock() {
      api.controls?.(files ? libraryControls : commands.map(c => {
        if (c.id === 'ping' && s.budget === 0) return {
          ...c,
          label: 'Recast survey'
        };
        if (c.id === 'depth') return {
          ...c,
          label: 'Depth · ' + DEPTH[s.receiver.depth]
        };
        if (c.id === 'tune') return {
          ...c,
          label: 'Tune · ' + SPECIES[s.tuned].name
        };
        return c;
      }));
    }
    function events() {
      for (const e of drain(s)) {
        if (e.type === 'station') {
          dock();
          say(s.total === 0 ? 'opening' : s.contacts.length > 1 ? 'chorus' : 'night');
        }
        if (e.type === 'lesson') say('ping', 'one line is already pinned. move across the chart and ping again.');
        if (e.type === 'call') radio.chorus(e.observed, s.tuned);
        if (e.type === 'depth') {
          radio.cue('depth');
          say('depth');
          dock();
        }
        if (e.type === 'tune') {
          radio.cue('tune');
          say('chorus', SPECIES[s.tuned].name.toLowerCase() + ' on the dial. listen for the ' + SPECIES[s.tuned].shape + '.');
          dock();
        }
        if (e.type === 'baseline' || e.type === 'empty') say('ping', 'move the receiver sideways for a different bearing.');
        if (e.type === 'ping') {
          radio.cue('ping');
          api.haptic?.(8);
          if (e.fix) say('lock');else if (!e.sample.weak) say('ping');else say('depth');
          dock();
        }
        if (e.type === 'miss') {
          radio.cue('miss');
          api.effect?.('miss', 'Static');
          const guide = {
            voice: 'that’s another singer. tune to the name on the chart.',
            layer: 'try a different receiver depth before marking.',
            baseline: 'pin two crossing bearings at this depth first.',
            position: 'mark where the fresh bearings cross.'
          };
          say('miss', voice('miss', s.mistakes - 1) + ' ' + (guide[e.reason] || ''));
        }
        if (e.type === 'abandon') {
          radio.cue('depth');
          say('night', 'new water. the receiver is ready again.');
        }
        if (e.type === 'found') {
          save('find');
          radio.cue('lock');
          radio.archive(s.request);
          say('find');
          api.effect?.('clear', e.exact ? 'Precise fix' : 'Song filed');
          api.haptic?.(17);
        }
        if (e.type === 'stamp') {
          save('stamp');
          radio.cue('stamp');
          api.effect?.('unlock', 'Survey stamp');
        }
        if (e.type === 'end') {
          save('end');
          radio.stop();
          api.end(s.score, [['Songs filed', s.total], ['Precise fixes', s.perfect], ['Pings spent', s.spent], ['Watches surveyed', s.watch]], voice('night', s.total));
        }
      }
    }
    function archive() {
      files = {
        ids: Object.keys(logBook(api.store?.read()).records).map(Number),
        i: 0
      };
      for (const row of s.archive) if (!files.ids.includes(row.species)) files.ids.push(row.species);
      held.clear();
      radio.stop();
      dock();
      say('find', files.ids.length ? 'pick a recording and i’ll put it on.' : 'the log opens with your first song.');
    }
    function command(id, type) {
      if (paused || s.ended || type !== 'down') return;
      if (files) {
        if (id === 'back' || id === 'library') {
          files = null;
          radio.stop();
          dock();
          say('night');
          return;
        }
        if (!files.ids.length) return;
        if (id === 'next' || id === 'previous') files.i = (files.i + (id === 'next' ? 1 : -1) + files.ids.length) % files.ids.length;
        radio.stop();
        radio.archive(files.ids[files.i]);
        return;
      }
      if (id === 'file') finish(s);else if (id === 'library') archive();else if (id === 'ping') {
        if (s.budget <= 0) abandon(s);else ping(s);
      } else if (id === 'broadcast') broadcast(s);else if (id === 'depth') depth(s);else if (id === 'tune') tune(s);
      events();
    }
    function keyboard(type, code) {
      if (files) {
        const k = {
          ArrowLeft: 'previous',
          ArrowRight: 'next',
          Space: 'play',
          KeyL: 'back'
        }[code];
        if (k) command(k, type);
        return;
      }
      if (type === 'down') held.add(code);else held.delete(code);
      const k = {
        KeyE: 'ping',
        Space: 'broadcast',
        KeyD: 'depth',
        KeyT: 'tune',
        KeyL: 'library',
        KeyX: 'file'
      }[code];
      if (k) command(k, type);
    }
    events();
    return {
      action: command,
      key: keyboard,
      pointer(type, x, y, w = 480, h = 480) {
        if (files || paused) return;
        if (type === 'down') drag = true;
        if (type === 'up' || type === 'cancel') {
          drag = false;
          return;
        }
        if (!drag) return;
        const point = unproject(layout(w, h).chart, x, y);
        if (point) move(s, ...point);
      },
      update(dt) {
        if (paused || files || s.ended) return;
        const dx = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft')),
          dy = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
        if (dx || dy) move(s, s.cursor.x + dx * dt * .31, s.cursor.y + dy * dt * .31);
        step(s, dt);
        events();
        api.hud('Field log', s.score, s.mode === 'night' ? 'Battery' : 'Waters', s.mode === 'night' ? Math.ceil(s.battery) + 's' : REGIONS[s.region.id].name);
      },
      demo(dt) {
        pilot.drive(s, dt);
        events();
      },
      draw(c, w = 480, h = 480) {
        paint(c, s, w, h, api.reducedMotion, files);
      },
      cancelInput() {
        held.clear();
        drag = false;
      },
      pause() {
        paused = true;
        held.clear();
        drag = false;
        radio.stop();
      },
      resume() {
        paused = false;
        if (!files && !s.ended) radio.chorus(observations(s), s.tuned);
      },
      dispose() {
        radio.stop();
        held.clear();
        files = null;
      }
    };
  }
};
