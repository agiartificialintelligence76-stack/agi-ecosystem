// Recorded impact/foley layers and an original ambient score.
// Kenney CC0 source information ships in /audio/vladrunner2049/CREDITS.txt.
// Only start(), called by a player gesture, creates an audio context.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const level = (x, fallback) => typeof x === 'boolean' ? Number(x) : Number.isFinite(x) ? clamp(x, 0, 1) : fallback;
const note = midi => 440 * 2 ** ((midi - 69) / 12);
export const AUDIO_FILES = Object.freeze([
  'punch-1', 'punch-2', 'punch-3', 'heavy-1', 'heavy-2', 'heavy-3',
  'step-1', 'step-2', 'step-3', 'sand-1', 'sand-2', 'shield-1', 'shield-2',
  'cloth-1', 'cloth-2', 'swing-1', 'swing-2', 'body', 'land', 'click', 'spark',
]);
const GROUPS = { punch: ['punch-1', 'punch-2', 'punch-3'], heavy: ['heavy-1', 'heavy-2', 'heavy-3'],
  step: ['step-1', 'step-2', 'step-3'], sand: ['sand-1', 'sand-2'],
  shield: ['shield-1', 'shield-2'], cloth: ['cloth-1', 'cloth-2'], swing: ['swing-1', 'swing-2'] };

export function createAudio(initial = {}) {
  let ctx = null, master = null, musicBus = null, sfxBus = null, duckBus = null, reverbBus = null;
  let timer = null, dead = false, paused = false, nextStep = 0, step = 0, stage = 0, tension = false, active = false;
  let lastEvent = 0, lastElapsed = -1, lastState = null, noiseBuffer = null, loadPromise = null, decoding = null, lastMix = '';
  let settings = { music: .35, sfx: .65, muted: false, ...initial };
  const encoded = new Map(), buffers = new Map(), voices = new Set(), choices = new Map(), rateLimits = new Map();
  const lifetime = typeof AbortController === 'function' ? new AbortController() : null;
  const jitter = amount => 1 + (Math.random() * 2 - 1) * amount;

  function preload() {
    if (dead) return Promise.resolve(0);
    if (!loadPromise) loadPromise = Promise.allSettled(AUDIO_FILES.map(async name => {
      if (typeof globalThis.fetch !== 'function') return;
      const response = await globalThis.fetch(`/audio/vladrunner2049/${name}.wav`, { signal: lifetime?.signal, cache: 'force-cache' });
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      if (!dead) encoded.set(name, data);
    })).then(() => encoded.size);
    return loadPromise;
  }
  function decode() {
    if (!ctx || dead) return Promise.resolve(0);
    if (!decoding) decoding = preload().then(async () => {
      const context = ctx;
      if (!context || dead) return 0;
      await Promise.allSettled([...encoded].map(async ([name, data]) => {
        const buffer = await context.decodeAudioData(data.slice(0));
        if (!dead && ctx === context) buffers.set(name, buffer);
      }));
      encoded.clear(); return buffers.size;
    });
    return decoding;
  }
  function release(voice) {
    voices.delete(voice);
    for (const node of [voice.source, ...voice.nodes]) try { node.disconnect(); } catch { /* Already closed. */ }
  }
  function track(source, nodes, category = 'sfx') {
    const voice = { source, nodes, category }; voices.add(voice);
    source.onended = () => release(voice);
    // Crowd hits cannot create an unbounded wall of sound.
    if (voices.size > 80) {
      const oldest = [...voices].find(item => item.category === 'sfx');
      if (oldest && oldest !== voice) { try { oldest.source.stop(); } catch { /* Ended. */ } release(oldest); }
    }
  }
  function stopVoices(category) {
    for (const voice of [...voices]) if (!category || voice.category === category) {
      try { voice.source.stop(); } catch { /* Ended. */ } release(voice);
    }
  }
  function select(group) {
    const list = GROUPS[group] || [group], previous = choices.get(group) ?? -1;
    const index = list.length === 1 ? 0 : (previous + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    choices.set(group, index); return list[index];
  }
  function allow(key, interval) {
    if (!ctx) return false;
    const now = ctx.currentTime, previous = rateLimits.get(key) ?? -Infinity;
    if (now - previous < interval) return false;
    rateLimits.set(key, now); return true;
  }
  function panFor(ev) { return clamp(((Number.isFinite(ev?.x) ? ev.x : 640) - (lastState?.cameraX || 0) - 640) / 900, -.65, .65); }
  function route(source, gain, { cutoff = 9000, pan = 0, bus = sfxBus, wet = .07 } = {}) {
    const nodes = [gain], filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .55;
    source.connect(filter); filter.connect(gain); nodes.push(filter);
    if (ctx.createStereoPanner) { const panner = ctx.createStereoPanner(); panner.pan.value = pan; gain.connect(panner); panner.connect(bus); nodes.push(panner); }
    else gain.connect(bus);
    if (wet > 0 && reverbBus) { const send = ctx.createGain(); send.gain.value = wet; gain.connect(send); send.connect(bus === musicBus ? reverbBus.music : reverbBus.sfx); nodes.push(send); }
    return nodes;
  }
  function sample(group, volume, { at = ctx?.currentTime || 0, rate = 1, duration = 0, cutoff = 9000, pan = 0, bus = sfxBus, wet = .06 } = {}) {
    if (!ctx || dead || !bus) return false;
    const buffer = buffers.get(select(group)); if (!buffer) return false;
    const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = buffer;
    source.playbackRate.value = clamp(rate, .45, 2); const length = Math.min(duration || 4, buffer.duration / source.playbackRate.value);
    gain.gain.setValueAtTime(Math.max(.0001, volume), at);
    gain.gain.setValueAtTime(Math.max(.0001, volume), at + Math.max(0, length - .028));
    gain.gain.linearRampToValueAtTime(0, at + length);
    track(source, route(source, gain, { cutoff, pan, bus, wet }), bus === musicBus ? 'music' : 'sfx');
    source.start(at); source.stop(at + length + .015); return true;
  }
  function tone(freq, at, duration, volume, { type = 'sine', end = freq, cutoff = 1200, attack = .005, pan = 0, bus = sfxBus, wet = .05 } = {}) {
    if (!ctx || dead || !bus) return;
    const source = ctx.createOscillator(), gain = ctx.createGain(); source.type = type;
    source.frequency.setValueAtTime(Math.max(18, freq), at);
    if (end !== freq) source.frequency.exponentialRampToValueAtTime(Math.max(18, end), at + duration);
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(volume, at + Math.min(duration * .4, attack));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    track(source, route(source, gain, { cutoff, pan, bus, wet }), bus === musicBus ? 'music' : 'sfx');
    source.start(at); source.stop(at + duration + .04);
  }
  function air(at, duration, volume, cutoff = 1800, pan = 0, bus = sfxBus) {
    if (!ctx || !noiseBuffer || dead) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = noiseBuffer;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(volume, at + Math.min(.05, duration * .35));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    track(source, route(source, gain, { cutoff, pan, bus, wet: .08 }), bus === musicBus ? 'music' : 'sfx');
    source.start(at, Math.random() * .5); source.stop(at + duration + .02);
  }
  function duck(amount = .3) {
    if (!ctx || !duckBus) return;
    const t = ctx.currentTime; duckBus.gain.cancelScheduledValues(t); duckBus.gain.setValueAtTime(1 - amount, t);
    duckBus.gain.setTargetAtTime(1, t + .075, .16);
  }
  function impact(ev, heavy = false, hurt = false) {
    if (!allow(hurt ? 'hurt' : 'hit', .035)) return;
    const t = ctx.currentTime + .003, pan = panFor(ev), rate = jitter(.055) * (heavy ? .83 : 1.02);
    const volume = hurt ? .55 : heavy ? .9 : .65;
    const loaded = sample(heavy ? 'heavy' : 'punch', volume, { at: t, rate, cutoff: heavy ? 6800 : 8500, pan });
    if (!loaded) air(t, .11, .18, 1700, pan);
    sample('body', heavy ? .45 : .22, { at: t + .008, rate: heavy ? .74 : .95, cutoff: 950, pan, wet: .08 });
    tone(heavy ? 84 : 114, t, heavy ? .19 : .105, heavy ? .24 : .10, { end: heavy ? 32 : 48, cutoff: 180, pan, wet: 0 });
    duck(heavy ? .43 : .23);
  }
  function chord(root, at, duration, bright = false) {
    // A slowly blooming, widely voiced chord; no repeated arcade lead or arpeggio.
    const intervals = bright ? [0, 7, 12, 16, 23] : [0, 7, 12, 15, 22];
    for (const [i, interval] of intervals.entries()) {
      tone(note(root + interval), at + i * .035, duration, i === 0 ? .085 : .034, {
        type: 'triangle', attack: Math.min(1.3, duration * .25), cutoff: 650 + i * 120,
        pan: (i % 2 ? -.5 : .5), bus: musicBus, wet: .4,
      });
      if (i > 1) tone(note(root + interval) * 1.003, at, duration * .93, .012, {
        type: 'sine', attack: 1.2, cutoff: 900, pan: i % 2 ? .6 : -.6, bus: musicBus, wet: .5,
      });
    }
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running' || dead || paused || settings.muted || level(settings.music, .35) === 0) return;
    const now = ctx.currentTime;
    if (nextStep < now - .12) nextStep = now + .025;
    const interval = 60 / (tension ? 92 : 84) / 2;
    let guard = 0;
    while (nextStep < now + .14 && guard++ < 4) {
      const beat = step % 16, bar = Math.floor(step / 16) % 4;
      const root = [38, 34, 41, 36][bar] + (stage === 1 ? -2 : stage === 2 ? 2 : 0);
      if (beat === 0) chord(root, nextStep, interval * 19, bar === 1 || bar === 2);
      if (active) {
        // Space between percussion leaves the player's punches in front of the score.
        if (beat === 0 || beat === 8 || tension && beat === 11) {
          tone(note(root - 12), nextStep, .42, tension ? .15 : .10, { end: note(root - 12) * .99, bus: musicBus, cutoff: 180, wet: .02 });
          sample('body', tension ? .12 : .065, { at: nextStep, rate: .62, cutoff: 400, bus: musicBus, wet: .1 });
        }
        if (tension && (beat === 4 || beat === 12)) sample('cloth', .08, { at: nextStep, rate: 1.3, duration: .16, cutoff: 2200, bus: musicBus, wet: .18 });
      }
      step++; nextStep += interval;
    }
  }
  function volumes() {
    if (!ctx) return;
    const key = [paused, settings.muted, settings.music, settings.sfx].join(':'); if (key === lastMix) return; lastMix = key;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(paused || settings.muted ? 0 : .86, t, .025);
    musicBus.gain.setTargetAtTime(level(settings.music, .35) * .9, t, .12);
    sfxBus.gain.setTargetAtTime(level(settings.sfx, .65), t, .025);
  }
  async function start() {
    if (dead) return false;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false;
      try {
        ctx = new AC(); master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain(); duckBus = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -10; compressor.knee.value = 14;
        compressor.ratio.value = 3; compressor.attack.value = .003; compressor.release.value = .15;
        musicBus.connect(duckBus); duckBus.connect(master); sfxBus.connect(master); master.connect(compressor); compressor.connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0); let soft = 0;
        for (let i = 0; i < data.length; i++) { soft = soft * .75 + (Math.random() * 2 - 1) * .25; data[i] = soft; }
        const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.25), ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) { const a = impulse.getChannelData(channel); let smooth = 0;
          for (let i = 0; i < a.length; i++) { smooth = smooth * .64 + (Math.random() * 2 - 1) * .36; a[i] = smooth * (1 - i / a.length) ** 3 * .45; } }
        // Wet returns stay inside their category bus so music/effects sliders and
        // impact ducking also control the room tail, rather than leaking around it.
        reverbBus = {};
        for (const [name, bus] of [['music', musicBus], ['sfx', sfxBus]]) {
          const send = ctx.createGain(), reverb = ctx.createConvolver(); send.gain.value = .24;
          reverb.buffer = impulse; send.connect(reverb); reverb.connect(bus); reverbBus[name] = send;
        }
        nextStep = ctx.currentTime + .035; lastMix = ''; volumes(); timer = setInterval(schedule, 60); decode();
      } catch { try { await ctx?.close(); } catch { /* Audio is optional. */ } ctx = null; return false; }
    }
    try { if (ctx.state === 'suspended') await ctx.resume(); schedule(); return ctx.state === 'running'; } catch { return false; }
  }
  function effect(ev) {
    if (!ctx || ctx.state !== 'running' || settings.muted || paused || level(settings.sfx, .65) === 0 || dead) return;
    const t = ctx.currentTime + .004, pan = panFor(ev), kind = ev.attackKind || ev.text || '';
    const heavy = kind === 'heavy' || kind === 'finisher' || kind === 'combo3' || ev.comboStep === 3 || ev.strength === 'heavy' || Number(ev.strength) >= 2;
    switch (ev.type) {
      case 'attack':
        if (!allow(`swing:${ev.player ?? ev.kind}`, .075)) break;
        sample('swing', heavy ? .28 : .17, { at: t + Math.max(0, ev.swingDelay || 0), rate: (heavy ? .72 : ev.kind === 'agi' ? 1.18 : 1.04) * jitter(.06), cutoff: 4000, duration: heavy ? .25 : .16, pan });
        sample('cloth', .075, { at: t, rate: 1.25, duration: .13, cutoff: 2400, pan, wet: 0 }); break;
      case 'enemyAttack':
        if (allow('enemySwing', .09)) sample('swing', .105, { at: t, rate: .83, duration: .21, cutoff: 2800, pan }); break;
      case 'hit': impact(ev, heavy || ev.amount >= 28); break;
      case 'block':
        if (!allow('block', .065)) break;
        sample('shield', .50, { at: t, rate: jitter(.08), cutoff: 5200, pan, wet: .1 });
        sample('body', .14, { at: t, rate: .85, cutoff: 700, pan }); duck(.18); break;
      case 'hurt': impact(ev, false, true); break;
      case 'down':
        sample('body', .56, { at: t, rate: .68, cutoff: 1300, pan }); sample('cloth', .18, { at: t + .06, rate: .8, cutoff: 2000, pan }); break;
      case 'dodge':
        sample('swing', .17, { at: t, rate: .76, cutoff: 2500, duration: .23, pan }); sample('cloth', .13, { at: t, rate: 1.05, cutoff: 2000, pan }); break;
      case 'jump': sample('cloth', .12, { at: t, rate: 1.2, duration: .17, cutoff: 2800, pan, wet: 0 }); break;
      case 'footstep':
        if (allow(`step:${ev.player ?? ev.kind}`, .15)) sample(stage === 1 ? 'sand' : 'step', .095, { at: t, rate: jitter(.08) * (ev.kind === 'agi' ? 1.13 : .94), cutoff: stage === 1 ? 2300 : 3400, pan, wet: stage === 2 ? .12 : .02 }); break;
      case 'land':
        if (allow(`land:${ev.player ?? 'enemy'}`, .12)) { sample('land', (ev.player === undefined ? .16 : .25) + clamp(Number(ev.amount) || 400, 0, 800) / 2800, { at: t, rate: .9 * jitter(.05), cutoff: 2400, pan }); sample('cloth', .07, { at: t + .025, rate: 1.1, cutoff: 1800, pan }); } break;
      case 'special': case 'duo': {
        const duo = ev.type === 'duo', contact = t + Math.max(0, ev.swingDelay || 0);
        sample('swing', duo ? .4 : .27, { at: t, rate: .55, cutoff: 3400, pan, wet: .18 });
        sample('heavy', duo ? .85 : .65, { at: contact, rate: duo ? .55 : .7, cutoff: 2400, pan, wet: .2 });
        tone(duo ? 58 : 86, contact, duo ? .65 : .37, duo ? .31 : .2, { end: 26, cutoff: 400, pan, wet: .12 });
        air(contact, duo ? .65 : .36, duo ? .3 : .18, 2600, pan); duck(duo ? .66 : .45); break; }
      case 'kill':
        if (allow('drop', .11)) sample('body', ev.boss ? .5 : .19, { at: t + .06, rate: ev.boss ? .6 : .88, cutoff: 1500, pan }); break;
      case 'pickup':
        if (allow('pickup', .14)) sample('click', .11, { at: t, rate: 1.2, duration: .17, cutoff: 3800, pan, wet: .02 }); break;
      case 'tag':
        sample('cloth', .16, { at: t, rate: 1.2, cutoff: 2600, pan }); sample('spark', .10, { at: t, rate: .85, cutoff: 2500, pan, wet: .16 }); break;
      case 'boss': case 'bossPhase':
        if (allow('boss', .5)) { sample('shield', .26, { at: t, rate: .52, cutoff: 1300, wet: .25 }); tone(49, t, 1.2, .12, { end: 32, attack: .1, cutoff: 220, wet: .25 }); } break;
      case 'waveClear': case 'upgrade': case 'stage':
        if (allow('transition', .7)) { sample('spark', .12, { at: t, rate: .7, cutoff: 2200, wet: .25 }); tone(note(62), t + .08, .55, .028, { attack: .08, cutoff: 500, wet: .25 }); } break;
      case 'victory':
        for (const [i, n] of [50, 57, 62, 65, 69].entries()) tone(note(n), t + i * .08, 2.1, .045, { type: 'triangle', attack: .14, cutoff: 1200, wet: .28 }); break;
      case 'gameover':
        sample('body', .28, { at: t, rate: .6, cutoff: 650, wet: .2 }); tone(55, t, 1.0, .055, { end: 32, attack: .12, cutoff: 180, wet: .22 }); break;
      default: break;
    }
  }
  return {
    preload, start,
    update(state) {
      if (dead) return;
      if (state && (state.elapsed < lastElapsed || state !== lastState && state.elapsed === 0)) { lastEvent = 0; step = 0; nextStep = ctx ? ctx.currentTime + .035 : 0; rateLimits.clear(); stopVoices(); }
      lastState = state;
      if (state) { lastElapsed = state.elapsed; stage = clamp(state.stage || 0, 0, 2); tension = Boolean(state.boss && !state.boss.dead && state.boss.hp > 0); active = state.status === 'playing'; }
      else active = false;
      // Even locked, paused, or muted clients consume IDs; resuming never replays an old fight.
      for (const ev of state?.events || []) if (ev.id > lastEvent) { lastEvent = ev.id; effect(ev); }
      volumes();
    },
    setPaused(value) {
      const next = Boolean(value); if (next === paused) return; paused = next;
      if (paused) stopVoices('sfx'); else nextStep = ctx ? ctx.currentTime + .03 : 0;
      volumes();
    },
    setOptions(next = {}) {
      const wasMuted = settings.muted, previousSfx = level(settings.sfx, .65), previousMusic = level(settings.music, .35);
      settings = { ...settings, ...next };
      if ((!wasMuted && settings.muted) || previousSfx > 0 && level(settings.sfx, .65) === 0) stopVoices('sfx');
      if (previousMusic > 0 && level(settings.music, .35) === 0) stopVoices('music');
      volumes();
    },
    get started() { return Boolean(ctx && ctx.state === 'running'); },
    get ready() { return buffers.size === AUDIO_FILES.length; },
    destroy() {
      if (dead) return; dead = true; lifetime?.abort(); clearInterval(timer); timer = null; stopVoices();
      encoded.clear(); buffers.clear(); choices.clear(); rateLimits.clear();
      const old = ctx; ctx = null; if (old) old.close().catch(() => {});
    },
  };
}
