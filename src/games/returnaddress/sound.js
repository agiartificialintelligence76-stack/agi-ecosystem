import { createMusic } from '../heartbeat/music.js';

const decks = new WeakMap();
export function recordPlayer(api, onSilent) {
  const kit = api.audio;
  let music, pending, buffer, paused = false, disposed = false;
  if (kit && !api.demo) {
    if (!decks.has(kit)) decks.set(kit,createMusic(kit));
    music = decks.get(kit);
  }
  const cue = t => { if (music && buffer && !paused && !disposed) music.play(buffer,{when:music.now(),from:t}); };
  return {
    async load(id,position) {
      pending?.abort(); music?.stop(); buffer = null;
      if (!music) return;
      const current = pending = new AbortController();
      try {
        const next = await music.load(id,undefined,current.signal);
        if (pending !== current || current.signal.aborted || disposed) return;
        buffer = next; cue(position());
      } catch { if (!current.signal.aborted && !disposed) onSilent(); }
    },
    clock(stamp) { return music?.playing && music.running && !paused ? music.songTime(stamp ?? performance.now()) : null; },
    cue, pause() { paused = true; music?.stop(.025); },
    resume(t) { paused = false; cue(t); },
    dispose() { disposed = true; pending?.abort(); music?.stop(.02); },
  };
}
const cues = {
  wheels:[320,390,.045], jump:[420,850,.1], landing:[220,150,.06], star:[990,1250,.07],
  miss:[260,180,.085], scratch:[150,55,.12], backspin:[780,72,.22], chorus:[550,1100,.19], clear:[660,990,.12], close:[720,360,.25],
};
const lastInput = new WeakMap();
export function playCue(api,name,pitch = 1) {
  if (api.demo) return;
  if (api.audio && ['jump','wheels','backspin'].includes(name)) {
    const now = performance.now();
    if (now - (lastInput.get(api) ?? -100) < 70) return;
    lastInput.set(api,now);
  }
  const [freq,to,dur] = cues[name];
  api.tone?.({freq:freq*pitch,slide:to*pitch,dur,vol:.033,type:name==='backspin' ? 'sawtooth' : 'triangle',attack:.008,release:.04});
  if (name === 'backspin' || name === 'scratch') api.audio?.noise?.({dur:.09,vol:.022,type:'highpass',filter:1800});
}
