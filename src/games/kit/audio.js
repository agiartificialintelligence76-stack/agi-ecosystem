// AGI arcade kit: sound made in the browser (Web Audio), no files needed for effects. One AudioContext, started by the
// first tap or key (browsers allow sound only after one), with two buses: effects and music, each following the
// arcade's settings (store.js). A demo (`?demo`) stays silent.
//
//   const audio = createAudio();
//   audio.sfx('pop', { pitch: 1.2 })          a preset (see PRESETS), pitch-shifted
//   audio.tone({ freq: 440, type: 'square', dur: .1, vol: .3, slide: 880 })
//   audio.noise({ dur: .2, vol: .4, filter: 1200, q: 1, type: 'bandpass' })
//   audio.chord([523, 659, 784], { dur: .3, type: 'triangle' })
//   const buf = await audio.load('/music/agi.mp3'); audio.playBuffer(buf, { bus: 'music', when, offset })
//   audio.music(loop) / audio.stopMusic()     a small sequencer (createLoopMusic below)
import { DEMO } from './env.js';
import { settings } from './store.js';

const PRESETS = {
  tap:     (a, p) => a.tone({ freq: 660 * p, type: 'triangle', dur: 0.05, vol: 0.18 }),
  select:  (a, p) => { a.tone({ freq: 523 * p, type: 'square', dur: 0.05, vol: 0.08 }); a.tone({ freq: 784 * p, type: 'square', dur: 0.07, vol: 0.08, at: 0.045 }); },
  back:    (a, p) => { a.tone({ freq: 523 * p, type: 'square', dur: 0.05, vol: 0.07 }); a.tone({ freq: 392 * p, type: 'square', dur: 0.07, vol: 0.07, at: 0.045 }); },
  pop:     (a, p) => a.tone({ freq: 420 * p, type: 'sine', dur: 0.09, vol: 0.32, slide: 980 * p, attack: 0.002 }),
  drop:    (a, p) => a.tone({ freq: 300 * p, type: 'sine', dur: 0.12, vol: 0.3, slide: 120 * p }),
  bounce:  (a, p) => a.tone({ freq: 220 * p, type: 'triangle', dur: 0.08, vol: 0.25, slide: 330 * p }),
  merge:   (a, p) => { a.tone({ freq: 392 * p, type: 'triangle', dur: 0.1, vol: 0.22 }); a.tone({ freq: 588 * p, type: 'sine', dur: 0.16, vol: 0.2, at: 0.05, slide: 784 * p }); },
  clear:   (a, p) => { a.noise({ dur: 0.18, vol: 0.12, filter: 3200 * p, type: 'highpass' }); a.chord([523 * p, 659 * p, 784 * p], { dur: 0.22, type: 'triangle', vol: 0.12 }); },
  combo:   (a, p) => [0, 0.06, 0.12].forEach((t, i) => a.tone({ freq: [659, 784, 1047][i] * p, type: 'square', dur: 0.08, vol: 0.09, at: t })),
  coin:    (a, p) => { a.tone({ freq: 988 * p, type: 'square', dur: 0.05, vol: 0.1 }); a.tone({ freq: 1319 * p, type: 'square', dur: 0.14, vol: 0.1, at: 0.05 }); },
  power:   (a, p) => a.tone({ freq: 220 * p, type: 'sawtooth', dur: 0.35, vol: 0.12, slide: 880 * p, filter: 2400 }),
  hit:     (a, p) => { a.noise({ dur: 0.08, vol: 0.3, filter: 1800 * p, type: 'lowpass' }); a.tone({ freq: 160 * p, type: 'square', dur: 0.06, vol: 0.12, slide: 70 }); },
  hurt:    (a, p) => { a.tone({ freq: 300 * p, type: 'sawtooth', dur: 0.22, vol: 0.18, slide: 90 * p, filter: 1400 }); a.noise({ dur: 0.12, vol: 0.12, filter: 900 }); },
  explode: (a, p) => { a.noise({ dur: 0.55, vol: 0.45, filter: 900 * p, type: 'lowpass', slideFilter: 120 }); a.tone({ freq: 90 * p, type: 'sine', dur: 0.4, vol: 0.35, slide: 40 }); },
  whoosh:  (a, p) => a.noise({ dur: 0.22, vol: 0.18, filter: 600 * p, type: 'bandpass', q: 0.8, slideFilter: 3600 * p }),
  slice:   (a, p) => { a.noise({ dur: 0.12, vol: 0.22, filter: 5200 * p, type: 'highpass' }); a.tone({ freq: 1800 * p, type: 'sine', dur: 0.06, vol: 0.06, slide: 900 }); },
  tick:    (a, p) => a.tone({ freq: 1200 * p, type: 'square', dur: 0.02, vol: 0.05 }),
  win:     (a, p) => [523, 659, 784, 1047].forEach((f, i) => a.tone({ freq: f * p, type: 'triangle', dur: 0.18, vol: 0.16, at: i * 0.09 })),
  lose:    (a, p) => [392, 330, 262, 196].forEach((f, i) => a.tone({ freq: f * p, type: 'triangle', dur: 0.22, vol: 0.16, at: i * 0.12 })),
  levelup: (a, p) => [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone({ freq: f * p, type: 'square', dur: 0.1, vol: 0.08, at: i * 0.055 })),
  error:   (a, p) => { a.tone({ freq: 196 * p, type: 'square', dur: 0.09, vol: 0.1 }); a.tone({ freq: 185 * p, type: 'square', dur: 0.12, vol: 0.1, at: 0.1 }); },
  click:   (a, p) => a.noise({ dur: 0.015, vol: 0.2, filter: 4000 * p, type: 'highpass' }),
};

export function createAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let s = settings.get();
  let musicLoop = null;

  const apply = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(!DEMO && s.sound ? 1 : 0, t, 0.02);
    musicBus.gain.setTargetAtTime(!DEMO && s.music ? 0.8 : 0, t, 0.05);
  };
  settings.on((next) => { s = next; apply(); });

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.knee.value = 18; master.ratio.value = 4;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    const n = Math.floor(ctx.sampleRate * 1.0);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    apply();
    return ctx;
  }

  // the first gesture starts sound (and wakes it again after the tab was hidden)
  const unlock = () => {
    if (DEMO) return;
    const c = ensure();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });

  const bus = (name) => (name === 'music' ? musicBus : sfxBus);
  const live = () => Boolean(ctx && ctx.state === 'running' && !DEMO);

  function tone({ freq = 440, type = 'sine', dur = 0.1, vol = 0.2, at = 0, slide = null, attack = 0.004, release = null, filter = null, detune = 0, bus: b = 'sfx' } = {}) {
    if (!live()) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    if (detune) osc.detune.value = detune;
    const g = ctx.createGain();
    const rel = release ?? dur * 0.6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0 + Math.max(attack, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(bus(b));
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.1, vol = 0.2, at = 0, filter = 2000, q = 0.7, type = 'lowpass', slideFilter = null, bus: b = 'sfx' } = {}) {
    if (!live()) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(filter, t0); f.Q.value = q;
    if (slideFilter) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideFilter), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(bus(b));
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }

  const chord = (freqs, opts = {}) => freqs.forEach((f, i) => tone({ ...opts, freq: f, at: (opts.at || 0) + (opts.strum || 0) * i }));

  // a preset by name, with an optional pitch (1 = as is) and a little random spread so repeats don't sound robotic
  const sfx = (name, { pitch = 1, spread = 0.04 } = {}) => {
    const p = PRESETS[name];
    if (!p || !live()) return;
    p(api, pitch * (1 + (Math.random() * 2 - 1) * spread));
  };

  // sound files (a song, a voice line): decoded once
  const cache = new Map();
  async function load(url) {
    if (cache.has(url)) return cache.get(url);
    const c = ensure();
    if (!c) throw new Error('no Web Audio');
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)));
    cache.set(url, p);
    p.catch(() => cache.delete(url));
    return p;
  }
  function playBuffer(buffer, { bus: b = 'sfx', when = 0, offset = 0, vol = 1, rate = 1, loop = false } = {}) {
    const c = ensure();
    if (!c || !buffer) return null;
    const src = c.createBufferSource();
    src.buffer = buffer; src.loop = loop; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(bus(b));
    src.start(when || c.currentTime, offset);
    return { source: src, gain: g, stop: (t = 0) => { try { src.stop(c.currentTime + t); } catch { /* already */ } } };
  }

  function music(loop) {
    stopMusic();
    if (!loop || DEMO) return;
    musicLoop = loop;
    loop.start(api);
  }
  function stopMusic() { if (musicLoop) { musicLoop.stop(); musicLoop = null; } }

  const api = {
    get ctx() { return ensure(); },
    get running() { return live(); },
    get settings() { return s; },
    unlock, tone, noise, chord, sfx, load, playBuffer, music, stopMusic,
    musicBus: () => (ensure(), musicBus),
    sfxBus: () => (ensure(), sfxBus),
    // pause and resume everything (the tab hidden, the game paused)
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state !== 'running' && !DEMO) ctx.resume().catch(() => {}); },
  };
  return api;
}

// A small looping sequencer for background music, made of notes (no files): tracks of steps at a tempo, scheduled a
// little ahead so it never stutters. `pattern`: { bpm, steps (per bar, 16), bars, tracks: [{ type, vol, notes: [midi|null…],
// dur (steps), filter, octave }] , drums: { kick: [1,0,…], snare: [...], hat: [...] } }
export function createLoopMusic(pattern) {
  let timer = 0, a = null, next = 0, step = 0, on = false;
  const stepDur = () => 60 / pattern.bpm / 4;
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  const total = () => pattern.steps * (pattern.bars || 1);
  function schedule() {
    if (!on || !a || !a.ctx) return;
    const c = a.ctx;
    while (next < c.currentTime + 0.12) {
      const at = Math.max(0, next - c.currentTime);
      for (const tr of pattern.tracks || []) {
        const n = tr.notes[step % tr.notes.length];
        if (n != null) a.tone({ freq: midi(n + 12 * (tr.octave || 0)), type: tr.type || 'square', dur: stepDur() * (tr.dur || 1) * 0.95, vol: tr.vol ?? 0.06, at, filter: tr.filter || null, bus: 'music', attack: tr.attack ?? 0.005 });
      }
      const d = pattern.drums || {};
      const hitOf = (arr) => arr && arr[step % arr.length];
      if (hitOf(d.kick)) a.tone({ freq: 150, slide: 45, type: 'sine', dur: 0.16, vol: 0.32, at, bus: 'music', attack: 0.001 });
      if (hitOf(d.snare)) a.noise({ dur: 0.12, vol: 0.12, filter: 1800, type: 'bandpass', q: 0.6, at, bus: 'music' });
      if (hitOf(d.hat)) a.noise({ dur: 0.03, vol: 0.05, filter: 7000, type: 'highpass', at, bus: 'music' });
      next += stepDur();
      step = (step + 1) % total();
    }
    timer = setTimeout(schedule, 25);
  }
  return {
    start(audio) { a = audio; on = true; step = 0; next = (a.ctx?.currentTime || 0) + 0.05; schedule(); },
    stop() { on = false; clearTimeout(timer); },
    setBpm(bpm) { pattern.bpm = bpm; },
  };
}
