// Recorded impact/foley layers and an original 32-bar cartoon/cyberpunk score.
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

// "Good Memories, Bad Company": D-minor theme, two eight-bar statements,
// a contrasting bridge, and an embellished return. Entries are eighth-note
// position, MIDI pitch, and length. The rests and held answers are intentional.
const THEME = [
  [[0,62,1.7],[2,65,.8],[3,69,.8],[4,67,1.7],[6,65,1.7]],
  [[0,65,1.7],[2,62,.8],[3,60,.8],[4,58,2.7],[7,60,.8]],
  [[0,60,1.7],[2,65,.8],[3,67,.8],[4,69,1.7],[6,67,1.7]],
  [[0,64,1.7],[2,67,.8],[3,64,.8],[4,62,2.7],[7,64,.8]],
  [[0,69,1.7],[2,72,.8],[3,74,1.7],[5,72,.8],[6,69,1.7]],
  [[0,65,.8],[1,67,.8],[2,69,1.7],[4,65,1.7],[6,62,1.7]],
  [[0,64,1.7],[2,67,1.7],[4,72,.8],[5,67,.8],[6,64,1.7]],
  [[0,64,1.7],[2,61,1.7],[4,57,2.7],[7,61,.8]],
];
const BRIDGE = [
  [[0,67,1.7],[2,70,.8],[3,74,.8],[4,72,1.7],[6,70,.8],[7,69,.8]],
  [[0,70,1.7],[2,74,1.7],[4,77,1.7],[6,74,1.7]],
  [[0,74,2.7],[3,72,.8],[4,69,1.7],[6,65,1.7]],
  [[0,73,1.7],[2,71,.8],[3,69,.8],[4,67,1.7],[6,64,1.7]],
  [[0,67,.8],[1,69,.8],[2,70,1.7],[4,74,2.7],[7,72,.8]],
  [[0,70,2.7],[3,69,.8],[4,65,1.7],[6,62,1.7]],
  [[0,69,1.7],[2,65,.8],[3,62,.8],[4,64,1.7],[6,65,1.7]],
  [[0,64,1.7],[2,61,1.7],[4,57,1.7],[6,60,.8],[7,61,.8]],
];
const HARMONY = [
  { bass:38, notes:[50,57,60,65] }, // Dm7
  { bass:34, notes:[50,53,57,60] }, // Bbmaj9
  { bass:41, notes:[53,57,60,67] }, // Fadd9
  { bass:36, notes:[52,55,60,62] }, // Cadd9
  { bass:43, notes:[53,58,62,65] }, // Gm7
  { bass:33, notes:[49,55,57,64] }, // A7, resolves back to the hook
];
const VERSE_CHORDS = [0,1,2,3,0,1,3,5], BRIDGE_CHORDS = [4,1,0,5,4,1,0,5];

// A pure musical timeline also lets tests inspect complete phrases and scene
// transitions without pretending a fake AudioContext can judge the sound.
export function scoreStep(index, { stage = 0, scene = 'game', combat = false, boss = false } = {}) {
  const position = ((Math.floor(index) % 256) + 256) % 256;
  const bar = Math.floor(position / 8), eighth = position % 8, phrase = bar % 8;
  const bridge = bar >= 16 && bar < 24, reprise = bar >= 24, district = clamp(Math.floor(stage),0,2);
  const transpose = [0,-2,3][district], harmony = HARMONY[(bridge ? BRIDGE_CHORDS : VERSE_CHORDS)[phrase]];
  const quiet = scene !== 'game', sceneGain = scene === 'story' ? .72 : scene === 'menu' ? .55 : 1;
  const intensity = boss ? 1 : combat ? .8 : .56, notes = [];
  const add = (instrument, pitch, duration, velocity, pan = 0, offset = 0) => notes.push({ instrument,
    pitch: pitch === null ? null : pitch + transpose, duration, velocity: velocity * sceneGain, pan, offset });
  const tempo = scene === 'story' ? 86 : scene === 'menu' ? 94 : [104,98,110][district] + (boss ? 8 : 0);
  if (eighth === 0) for (const [i,pitch] of harmony.notes.entries()) {
    add('pad',pitch,7.8,.035, i % 2 ? .48 : -.48, i * .018);
    add('keys',pitch+12,quiet ? 4.4 : 2.8,.045, i % 2 ? -.32 : .32, i * .025);
  }
  if (!quiet && eighth === 4) for (const [i,pitch] of harmony.notes.slice(1).entries())
    add('keys',pitch+12,2.5,.036, i % 2 ? .3 : -.3, i * .018);
  if (eighth === 0 || !quiet && [3,4,6].includes(eighth)) {
    const bassOffset = eighth === 3 ? 7 : eighth === 4 ? 12 : eighth === 6 && phrase % 2 ? 7 : 0;
    add('bass',harmony.bass+bassOffset,eighth === 0 ? 2.4 : 1.2, .15 * (quiet ? .62 : 1));
  }
  const melody = (bridge ? BRIDGE : THEME)[phrase].find(([beat]) => beat === eighth);
  if (melody) {
    const [,pitch,length] = melody;
    // The second statement uses keys; the final statement brings the reed lead
    // back with a quiet octave answer instead of looping one unchanged bar.
    const instrument = scene === 'story' || bar >= 8 && bar < 16 ? 'keys' : 'lead';
    add(instrument,pitch,length,.17 * (bridge ? .92 : 1),district === 1 ? -.12 : .10);
    if ((reprise || boss) && !quiet && eighth === 0) add('keys',pitch+12,length*.8,.033,-.3,.04);
  }
  if (!quiet) {
    const kick = eighth === 0 || eighth === 4 || (combat || boss) && eighth === 3 && bar % 2;
    if (kick) add('kick',null,1,.14 * intensity);
    if (eighth === 2 || eighth === 6) add('snare',null,1,.11 * intensity, -.06);
    if (eighth % 2 === 0 || combat || boss) add(district === 1 ? 'shaker' : 'hat',null,
      eighth === 7 && bar % 4 === 3 ? .65 : .22, (eighth % 2 ? .021 : .030) * intensity,.27);
    if ((boss || combat && reprise) && phrase === 7 && eighth >= 6) {
      add('tom',50-(eighth-6)*5,.7,.065,-.25+(eighth-6)*.5,.5);
      if (eighth === 7) add('snare',null,.5,.035,-.06,.5);
    }
  }
  return { bar, eighth, tempo, notes };
}

export function createAudio(initial = {}) {
  let ctx = null, master = null, musicBus = null, sfxBus = null, duckBus = null, reverbBus = null;
  let timer = null, dead = false, paused = false, nextStep = 0, step = 0, stage = 0, tension = false, active = false;
  let scene = 'menu', combat = false, musicContext = null, musicInterval = 60 / 94 / 2, drumNoise = null;
  const waves = new Map();
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
    if (voices.size > 96) {
      const oldest = [...voices].find(item => item.category === 'sfx') || voices.values().next().value;
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
  function musicalVoice(event, at, interval) {
    const { instrument, pitch, velocity, pan } = event, duration = Math.max(.06,event.duration*interval);
    const source = ctx.createOscillator(), gain = ctx.createGain();
    const shapes = { lead:[0,1,.24,.14,.035], keys:[0,1,.14,.22,.035,.02], bass:[0,1,.22,.08], pad:[0,1,0,.045] };
    const partials = shapes[instrument] || shapes.keys;
    if (ctx.createPeriodicWave && source.setPeriodicWave) {
      if (!waves.has(instrument)) waves.set(instrument,ctx.createPeriodicWave(new Float32Array(partials.length),Float32Array.from(partials)));
      source.setPeriodicWave(waves.get(instrument));
    } else source.type = instrument === 'bass' ? 'sine' : 'triangle';
    source.frequency.setValueAtTime(note(pitch),at);
    const attack = instrument === 'pad' ? .18 : instrument === 'lead' ? .025 : .008;
    const release = Math.min(duration*.4,instrument === 'pad' ? .32 : .12);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.linearRampToValueAtTime(velocity,at+Math.min(attack,duration*.25));
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,velocity*(instrument === 'keys' ? .28 : .70)),at+duration-release);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const cutoff = instrument === 'bass' ? 650 : instrument === 'pad' ? 1100 : instrument === 'keys' ? 2200 : 2600;
    track(source,route(source,gain,{cutoff,pan,bus:musicBus,wet:instrument === 'bass' ? .015 : instrument === 'pad' ? .24 : .17}),'music');
    source.start(at);source.stop(at+duration+.025);
  }
  function percussion(event, at, interval) {
    const { instrument, velocity, pan } = event;
    if (instrument === 'kick') {
      tone(118,at,.16,velocity,{end:46,cutoff:260,bus:musicBus,wet:0,attack:.003});return;
    }
    if (instrument === 'tom') {
      tone(note(event.pitch),at,.19,velocity,{end:note(event.pitch)*.65,cutoff:700,bus:musicBus,wet:.10,attack:.004,pan});return;
    }
    const snare = instrument === 'snare', shaker = instrument === 'shaker';
    const duration = snare ? .13 : clamp(event.duration*interval,.035,.22);
    const source = ctx.createBufferSource(), gain = ctx.createGain(), highpass = ctx.createBiquadFilter();
    source.buffer=drumNoise;highpass.type='highpass';highpass.frequency.value=snare ? 1050 : shaker ? 2700 : 5200;highpass.Q.value=.55;
    source.connect(highpass);
    gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(velocity,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    track(source,[highpass,...route(highpass,gain,{cutoff:snare ? 5800 : 7900,pan,bus:musicBus,wet:snare ? .09 : .025})],'music');
    source.start(at,(step%7)*.091);source.stop(at+duration+.015);
    if (snare) tone(175,at,.085,velocity*.30,{end:125,cutoff:800,bus:musicBus,wet:.03,pan});
  }
  function resetMusic() {
    stopVoices('music');step=0;musicContext=null;nextStep=ctx ? ctx.currentTime+.035 : 0;
  }
  function resumeMusic() {
    // Resume at a complete bar so a pause/mute cannot leave melody without its
    // chord or squeeze missed drum hits into the next frame.
    step=Math.ceil(step/8)*8;musicContext=null;nextStep=ctx ? ctx.currentTime+.035 : 0;
  }
  function setScene(value) {
    if (!['story','game','menu'].includes(value) || dead) return false;
    if (scene !== value) { scene=value;resetMusic();if(value !== 'game') {stage=0;active=false;combat=false;tension=false;stopVoices('sfx');} }
    return true;
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running' || dead || paused || settings.muted || level(settings.music, .35) === 0) return;
    const now = ctx.currentTime;
    if (nextStep < now - .12) nextStep = now + .025;
    let guard = 0;
    while (nextStep < now + .14 && guard++ < 4) {
      // District/intensity changes enter on bar boundaries, preserving the pulse.
      if (!musicContext || step%8===0) musicContext={stage,scene,combat:active&&combat,boss:active&&tension};
      const score=scoreStep(step,musicContext);musicInterval=60/score.tempo/2;
      const swing=score.eighth%2 ? musicInterval*.055 : 0;
      for (const event of score.notes) {
        const at=nextStep+swing+event.offset*musicInterval;
        if (['kick','snare','hat','shaker','tom'].includes(event.instrument)) percussion(event,at,musicInterval);
        else musicalVoice(event,at,musicInterval);
      }
      step++; nextStep += musicInterval;
    }
  }
  function volumes() {
    if (!ctx) return;
    const key = [paused, settings.muted, settings.music, settings.sfx].join(':'); if (key === lastMix) return; lastMix = key;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(paused || settings.muted ? 0 : .86, t, .025);
    musicBus.gain.setTargetAtTime(level(settings.music, .35) * 1.6, t, .12);
    sfxBus.gain.setTargetAtTime(level(settings.sfx, .65), t, .025);
  }
  async function start() {
    if (dead) return false;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false;
      try {
        ctx = new AC(); master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain(); duckBus = ctx.createGain();
        // Nodes default to unity: initialize the selected balance before the
        // opening phrase so a quiet saved setting never starts with a loud note.
        master.gain.value=0;musicBus.gain.value=level(settings.music,.35)*1.6;sfxBus.gain.value=level(settings.sfx,.65);
        const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -10; compressor.knee.value = 14;
        compressor.ratio.value = 3; compressor.attack.value = .003; compressor.release.value = .15;
        musicBus.connect(duckBus); duckBus.connect(master); sfxBus.connect(master); master.connect(compressor);
        if (ctx.createWaveShaper) {
          // Transparent below -2 dBFS, soft ceiling for exceptional simultaneous
          // crowd impacts. The ordinary music/foley dynamics stay untouched.
          const safety=ctx.createWaveShaper(),curve=new Float32Array(4097);
          for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.78?a:.78+.16*Math.tanh((a-.78)/.16));}
          safety.curve=curve;safety.oversample='2x';compressor.connect(safety);safety.connect(ctx.destination);
        } else compressor.connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0); let soft = 0;
        for (let i = 0; i < data.length; i++) { soft = soft * .75 + (Math.random() * 2 - 1) * .25; data[i] = soft; }
        drumNoise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
        const drumData=drumNoise.getChannelData(0);for(let i=0;i<drumData.length;i++)drumData[i]=Math.random()*2-1;
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
      case 'perfectDodge':
        if (!allow(`perfect:${ev.player ?? 0}`, .3)) break;
        sample('swing', .12, { at: t, rate: .64, duration: .22, cutoff: 2400, pan });
        // A soft rising third is a short reward, not another alarm over combat.
        for (const [i,n] of [62,65].entries()) tone(note(n),t+i*.055,.24,.052,{attack:.025,cutoff:1300,pan,wet:.18}); break;
      case 'counterHit':
        if (!allow('counter', .15)) break;
        // The ordinary hit already supplies the punch. Only accent its contact.
        sample('shield', .16, {at:t,rate:.70,cutoff:2500,pan,wet:.12});
        tone(76,t,.22,.10,{end:34,cutoff:220,pan,wet:0});duck(.35);break;
      case 'prop-break':
        if (!allow('prop', .065)) break;
        sample(ev.propKind === 'terminal' ? 'shield' : 'heavy', .37, {at:t,rate:.82*jitter(.07),cutoff:3600,pan,wet:.1});
        sample('body',.20,{at:t+.025,rate:.72,cutoff:1600,pan});
        sample(ev.propKind === 'terminal' ? 'spark' : 'step',.13,{at:t+.075,rate:.78,cutoff:3100,pan,wet:.08});break;
      case 'hazardActive':
        if (Math.abs((ev.x ?? 0)-(lastState?.cameraX || 0)-640)>750 || !allow('hazard',.8)) break;
        if (ev.hazardKind === 'electric') sample('spark',.10,{at:t,rate:.65,cutoff:2300,pan,wet:.08});
        else air(t,.35,.08,2100,pan);break;
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
    preload, start, setScene,
    update(state) {
      if (dead) return;
      if(state)setScene('game');
      if (state && (state.elapsed < lastElapsed || state !== lastState && state.elapsed === 0)) { lastEvent = 0; resetMusic(); rateLimits.clear(); stopVoices('sfx'); }
      lastState = state;
      if (state) { lastElapsed = state.elapsed; stage = clamp(state.stage || 0, 0, 2); tension = Boolean(state.boss && !state.boss.dead && state.boss.hp > 0); active = state.status === 'playing'; combat=Boolean(state.arena?.active || state.enemies?.some(enemy=>!enemy.dead&&enemy.hp>0)); }
      else {active=false;combat=false;tension=false;}
      // Even locked, paused, or muted clients consume IDs; resuming never replays an old fight.
      for (const ev of state?.events || []) if (ev.id > lastEvent) { lastEvent = ev.id; effect(ev); }
      volumes();
    },
    setPaused(value) {
      const next = Boolean(value); if (next === paused) return; paused = next;
      if (paused) stopVoices(); else resumeMusic();
      volumes();
    },
    setOptions(next = {}) {
      const wasMuted = settings.muted, previousSfx = level(settings.sfx, .65), previousMusic = level(settings.music, .35);
      settings = { ...settings, ...next };
      if ((!wasMuted && settings.muted) || previousSfx > 0 && level(settings.sfx, .65) === 0) stopVoices('sfx');
      if (settings.muted || previousMusic > 0 && level(settings.music, .35) === 0) stopVoices('music');
      if (wasMuted && !settings.muted || previousMusic === 0 && level(settings.music,.35)>0) resumeMusic();
      volumes();
    },
    get started() { return Boolean(ctx && ctx.state === 'running'); },
    get ready() { return buffers.size === AUDIO_FILES.length; },
    destroy() {
      if (dead) return; dead = true; lifetime?.abort(); clearInterval(timer); timer = null; stopVoices();
      encoded.clear(); buffers.clear(); choices.clear(); rateLimits.clear();waves.clear();drumNoise=null;
      const old = ctx; ctx = null; if (old) old.close().catch(() => {});
    },
  };
}
