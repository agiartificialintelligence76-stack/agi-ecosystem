import { createSongClock, eventPerf } from '../heartbeat/clock.js';
import { AUDIO, FALLBACK } from '../heartbeat/music.js';

export const MIX = Object.freeze({ song:.62, voice:.080, breath:.019, player:.082, crowd:.030, tick:.018 });
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const cache = new WeakMap();

// A single decoded album side per audio context. A full seven-song library in
// float PCM would otherwise pin hundreds of megabytes on a phone.
async function recording(context, id, signal) {
  const saved = cache.get(context);
  if (saved?.id === id) return saved.buffer;
  cache.delete(context);
  for (const url of [AUDIO(id), FALLBACK(id)]) {
    try {
      const response = await fetch(url, {signal});
      if (!response.ok) throw new Error(String(response.status));
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (signal.aborted) return null;
      cache.set(context, {id,buffer});
      return buffer;
    } catch (error) {
      if (signal.aborted) return null;
      if (url === FALLBACK(id)) throw error;
    }
  }
}
export function heardAt(ctx, perf) {
  const output = ctx.getOutputTimestamp?.();
  if (output?.contextTime > 0 && output.performanceTime > 0) {
    const estimate = output.contextTime + (perf - output.performanceTime) / 1000;
    if (estimate < ctx.currentTime + .05 && estimate > ctx.currentTime - .6) return estimate;
  }
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}
export function soundtrack(api, chart, start = 0, timer = () => performance.now()) {
  const kit = api.demo ? null : api.audio;
  const ctx = kit?.ctx;
  const clock = createSongClock();
  const aborter = new AbortController();
  let now = start, origin = (ctx?.currentTime || 0) - start, paused = false, disposed = false;
  let buffer = null, source = null, ready = false, failed = false, nextCall = 0, nextBeat = 0;
  let simulated = !ctx;
  let gain = null;
  clock.jump(start, timer());

  function indexAt(time) {
    nextCall = chart.calls.findIndex(call => call.at >= time - .004);
    if (nextCall < 0) nextCall = chart.calls.length;
    nextBeat = chart.beats.findIndex(beat => beat >= time - .004);
    if (nextBeat < 0) nextBeat = chart.beats.length;
  }
  function stopRecording() {
    if (source) {
      try { source.stop(); source.disconnect(); } catch { /* already ended */ }
      source = null;
    }
    gain?.disconnect();
    gain = null;
  }
  function startRecording() {
    if (!buffer || paused || disposed || !ctx || source) return;
    const startAt = ctx.currentTime + .035;
    const offset = startAt - origin;
    if (offset >= buffer.duration) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(MIX.song, startAt + .075);
    source.connect(gain); gain.connect(kit.musicBus());
    source.start(startAt + Math.max(0, -offset), Math.max(0, offset));
    ready = true;
  }
  function loadRecording() {
    if (!ctx || disposed) return;
    failed = false;
    recording(ctx, chart.song, aborter.signal).then(found => {
      buffer = found;
      startRecording();
    }).catch(() => { if (!disposed) failed = true; });
  }
  loadRecording();
  const liveVowels = new Map();
  function endVowel(lane) {
    const voice = liveVowels.get(lane);
    if (!voice) return;
    liveVowels.delete(lane);
    const now = ctx.currentTime;
    for (const {oscillator, gain} of voice) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(.0001, now, .012);
      try { oscillator.stop(now + .065); } catch { /* final envelope already finished */ }
    }
  }
  function beginVowel(lane, midi, seconds) {
    if (!ctx || !kit || paused || disposed) return;
    endVowel(lane);
    const start = ctx.currentTime;
    const nodes = [];
    for (const [multiple, volume, type] of [[1,MIX.player,'triangle'],[2,MIX.breath,'sine']]) {
      const oscillator = ctx.createOscillator(), amp = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = hz(midi) * multiple;
      amp.gain.setValueAtTime(.0001,start);
      amp.gain.exponentialRampToValueAtTime(volume,start+.025);
      amp.gain.setValueAtTime(volume,start+Math.max(.03,seconds-.055));
      amp.gain.exponentialRampToValueAtTime(.0001,start+seconds+.015);
      oscillator.connect(amp); amp.connect(kit.sfxBus());
      oscillator.start(start); oscillator.stop(start+seconds+.035);
      oscillator.onended = () => { oscillator.disconnect(); amp.disconnect(); };
      nodes.push({oscillator,gain:amp});
    }
    liveVowels.set(lane,nodes);
  }
  function clearVowels() {
    for (const lane of liveVowels.keys()) endVowel(lane);
  }
  function vocal(midi, duration, at = 0, performer = 'her') {
    if (!kit || paused || disposed) return;
    const freq = hz(midi);
    const bus = performer === 'her' ? 'music' : 'sfx';
    kit.tone({freq, type:'triangle',dur:duration,at,bus,vol:performer==='her'?MIX.voice:MIX.player,attack:.024,release:Math.min(.11,duration*.45),filter:1700});
    kit.tone({freq:freq*2,type:'sine',dur:duration*.87,at:at+.012,bus,vol:MIX.breath,attack:.033,release:.07});
  }
  function update(dt) {
    if (paused || disposed) return now;
    if (simulated || ctx.state !== 'running') {
      now += dt;
      clock.jump(now, timer());
      if (ctx) { simulated = true; stopRecording(); }
    } else {
      const stamp = timer();
      now = clock.tick(stamp, heardAt(ctx, stamp) - origin);
    }
    if (ctx?.state === 'running' && simulated) {
      simulated = false;
      origin = heardAt(ctx,timer()) - now;
      startRecording();
    }
    const horizon = ctx && !simulated ? ctx.currentTime - origin + .105 : now;
    while (nextCall < chart.calls.length && chart.calls[nextCall].at <= horizon) {
      const call = chart.calls[nextCall++];
      if (call.at < now - .12) continue;
      vocal(call.midi, Math.max(.105,call.duration), Math.max(0,origin + call.at - (ctx?.currentTime || 0)));
    }
    while (nextBeat < chart.beats.length && chart.beats[nextBeat] <= horizon) {
      const index = nextBeat++;
      const beat = chart.beats[index];
      if (!kit || beat < now - .12) continue;
      const at = Math.max(0, origin + beat - ctx.currentTime);
      if (index < chart.bar + 8 || !ready || failed) {
        const down = (index - chart.bar) % 4 === 0;
        kit.tone({freq:down?150:780,slide:down?63:null,dur:down?.13:.042,type:down?'sine':'triangle',vol:down?.056:MIX.tick,at,bus:'music'});
      }
    }
    return now;
  }
  indexAt(start);
  return {
    update, vocal, beginVowel, endVowel, retry:loadRecording,
    eventTime(stamp) { return !ctx || simulated ? now : clock.at(eventPerf(stamp,timer())); },
    pause() { if (paused) return; paused=true; clock.hold(true); clearVowels(); stopRecording(); },
    resume() {
      if (!paused || disposed) return;
      paused=false; origin=(ctx ? heardAt(ctx,timer()) : 0)-now;
      clock.hold(false); clock.jump(now,timer()); indexAt(now+.02); startRecording();
    },
    dispose() { disposed=true; aborter.abort(); clearVowels(); stopRecording(); buffer=null; },
    feedback(kind) {
      if (!kit || disposed) return;
      if (kind==='streak' || kind==='chorus' || kind==='final') {
        const base=kind==='final'?523:392;
        [1,1.25,1.5].forEach((r,i)=>kit.tone({freq:base*r,type:'sine',vol:.031,dur:.24,at:i*.065}));
        kit.noise({dur:kind==='final'?.52:.15,filter:2600,type:'bandpass',vol:MIX.crowd});
      } else if (kind==='short') {
        kit.tone({freq:230,slide:193,type:'sine',vol:.025,dur:.09});
      }
    },
    get now(){return now;}, get ready(){return ready;}, get failed(){return failed;},
  };
}
