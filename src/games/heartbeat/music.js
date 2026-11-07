// HEARTBEAT (2026-11-08): the songs' sound (Web Audio), on the kit's AudioContext.
//
// A run plays the song from a decoded buffer, started at an exact time on the audio clock, so the chart and the music
// share one clock. Its chain: the song → its volume (the arcade's Music switch) → a low-pass (a miss dips it for a
// moment) → the speakers, and an analyser beside it for the skyline. `heard(perfMs)` is the audio clock's time of the
// sample reaching the ears at that moment (getOutputTimestamp where the browser has it, else currentTime minus the
// output latency): the game's clock follows it (clock.js).
//
// Also: the song select's preview loops (small files, looped with a fade), the sync helper's metronome, and a soft tick
// for taps (the Sound effects switch). Nothing here runs in a demo (silent, and the demo runs on the loop's clock).
import { settings } from '../kit/store.js';
import { DEMO, IOS } from '../kit/env.js';

export const AUDIO = (id) => `/games/heartbeat/audio/${id}.m4a`;
export const PREVIEW = (id) => `/games/heartbeat/preview/${id}.m4a`;
export const FALLBACK = (id) => `/music/${id}.mp3`;      // the original, where AAC can't be decoded
export const COVER = (id) => `/games/heartbeat/covers/${id}.webp`;
export const BANDS = 16;

export function createMusic(kit) {
  let ctx = null, vol = null, lp = null, an = null, bins = null;
  let src = null, startCtx = 0;
  let prev = null;                 // the preview playing: { src, gain, id }
  const previews = new Map();      // id → AudioBuffer (the last few)
  const spectrum = new Float32Array(BANDS);
  let edges = null;

  function ensure() {
    if (DEMO) return null;
    if (ctx) return ctx;
    ctx = kit.ctx;
    if (!ctx) return null;
    vol = ctx.createGain();
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.6;
    an = ctx.createAnalyser();
    an.fftSize = 1024; an.smoothingTimeConstant = 0.6;
    bins = new Uint8Array(an.frequencyBinCount);
    vol.connect(lp); lp.connect(ctx.destination); lp.connect(an);
    // the skyline's bands: log-spaced from 40 Hz to 12 kHz
    const hz = ctx.sampleRate / an.fftSize;
    edges = Array.from({ length: BANDS + 1 }, (_, i) => Math.max(1, Math.round((40 * (12000 / 40) ** (i / BANDS)) / hz)));
    applyVolume();
    settings.on(applyVolume);
    // iPhones: play even with the ring switch on silent (Safari 17+), like a music app
    try { if (IOS && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    return ctx;
  }
  function applyVolume() {
    if (!ctx) return;
    vol.gain.setTargetAtTime(settings.get().music ? 0.92 : 0, ctx.currentTime, 0.03);
  }

  // a file with its download progress (0..1), as an ArrayBuffer
  async function fetchBytes(url, onProgress, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total || !res.body.getReader) {
      const ab = await res.arrayBuffer();
      onProgress?.(1);
      return ab;
    }
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.byteLength;
      onProgress?.(Math.min(1, got / total));
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.byteLength; }
    return out.buffer;
  }
  const decode = (ab) => new Promise((res, rej) => {
    const p = ctx.decodeAudioData(ab, res, rej);
    if (p && p.catch) p.catch(rej);
  });

  return {
    ensure,
    get ready() { return Boolean(ensure()); },
    get ctx() { return ensure(); },
    spectrum,

    // the song for a run (its AAC copy; the original MP3 if this browser can't decode AAC)
    async load(id, onProgress, signal) {
      if (!ensure()) throw new Error('no audio');
      try {
        const ab = await fetchBytes(AUDIO(id), (p) => onProgress?.(p * 0.92), signal);
        const buf = await decode(ab);
        onProgress?.(1);
        return buf;
      } catch (e) {
        if (signal?.aborted) throw e;
        const ab = await fetchBytes(FALLBACK(id), (p) => onProgress?.(p * 0.92), signal);
        const buf = await decode(ab);
        onProgress?.(1);
        return buf;
      }
    },

    // play `buffer` so that song time `from` (s; negative: silence first) sounds at audio time `when`
    play(buffer, { when, from = 0 }) {
      if (!ensure()) return;
      this.stop();
      lp.frequency.cancelScheduledValues(ctx.currentTime);
      lp.frequency.setValueAtTime(20000, ctx.currentTime);
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(vol);
      if (from >= 0) src.start(when, from);
      else src.start(when - from, 0);
      startCtx = when - from;
    },
    stop(fade = 0) {
      if (!src) return;
      const s = src;
      src = null;
      try {
        if (fade > 0 && ctx) {
          const g = ctx.createGain();
          s.disconnect(); s.connect(g); g.connect(vol);
          g.gain.setValueAtTime(1, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
          s.stop(ctx.currentTime + fade + 0.02);
        } else { s.stop(); s.disconnect(); }
      } catch { /* already stopped */ }
    },
    get playing() { return Boolean(src); },

    // the audio clock's time of what's being heard at performance.now() = perfMs
    heard(perfMs) {
      if (!ctx) return 0;
      const lat = ctx.outputLatency || ctx.baseLatency || 0;
      const plain = ctx.currentTime - lat;
      try {
        const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
        if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
          const est = ts.contextTime + (perfMs - ts.performanceTime) / 1000;
          if (est <= ctx.currentTime + 0.05 && est > ctx.currentTime - 0.6) return est;
        }
      } catch { /* not this browser */ }
      return plain;
    },
    // the song's own time being heard (s)
    songTime(perfMs) { return this.heard(perfMs) - startCtx; },
    now() { return ctx ? ctx.currentTime : 0; },
    get running() { return Boolean(ctx && ctx.state === 'running'); },

    // the skyline: 16 bands, 0..1
    readSpectrum() {
      if (!an) return null;
      an.getByteFrequencyData(bins);
      for (let b = 0; b < BANDS; b++) {
        let m = 0;
        for (let i = edges[b]; i < Math.max(edges[b] + 1, edges[b + 1]); i++) m = Math.max(m, bins[i] || 0);
        spectrum[b] = Math.min(1, Math.max(0, (m - 70) / 170));
      }
      return spectrum;
    },

    // a miss: the song dips for a moment
    dip() {
      if (!ctx || !src) return;
      const t = ctx.currentTime;
      lp.frequency.cancelScheduledValues(t);
      lp.frequency.setValueAtTime(1400, t);
      lp.frequency.exponentialRampToValueAtTime(20000, t + 0.28);
    },

    // the song select's preview: a short loop of the song (its chorus, usually)
    async preview(id) {
      if (!ensure()) return;
      if (prev && prev.id === id) return;
      this.stopPreview();
      const token = Symbol('preview');
      this._token = token;
      let buf = previews.get(id);
      if (!buf) {
        try { buf = await decode(await fetchBytes(PREVIEW(id))); } catch { return; }
        previews.set(id, buf);
        while (previews.size > 3) previews.delete(previews.keys().next().value);
      }
      if (this._token !== token || !ctx) return;
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.4);
      s.connect(g); g.connect(vol);
      s.start(ctx.currentTime + 0.02);
      prev = { src: s, gain: g, id, start: ctx.currentTime + 0.02, dur: buf.duration };
    },
    stopPreview(fade = 0.35) {
      this._token = null;
      if (!prev || !ctx) { prev = null; return; }
      const p = prev;
      prev = null;
      try {
        p.gain.gain.cancelScheduledValues(ctx.currentTime);
        p.gain.gain.setValueAtTime(p.gain.gain.value, ctx.currentTime);
        p.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
        p.src.stop(ctx.currentTime + fade + 0.05);
      } catch { /* gone */ }
    },
    // where the preview loop is (s into its clip), for her dancing
    previewTime(perfMs) {
      if (!prev || !ctx) return null;
      const t = this.heard(perfMs) - prev.start;
      return t < 0 ? null : t % prev.dur;
    },
    get previewId() { return prev ? prev.id : null; },

    // the sync helper's metronome: `count` clicks `gap` s apart from audio time `at` (the first `lead` are higher)
    clicks(at, count, gap, lead = 4) {
      if (!ensure()) return [];
      const times = [];
      for (let i = 0; i < count; i++) {
        const t = at + i * gap;
        times.push(t);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = i < lead ? 1568 : 1046;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.08);
      }
      return times;
    },

    // a soft tick for a tap (the Sound effects switch)
    tick(lane, kind) {
      if (!settings.get().sound) return;
      const p = kind === 'perfect' ? 1.12 : kind === 'great' ? 1 : 0.9;
      kit.noise({ dur: 0.03, vol: 0.09, filter: 2600 * p + lane * 120, q: 1.4, type: 'bandpass' });
      kit.tone({ freq: (740 + lane * 40) * p, type: 'triangle', dur: 0.035, vol: 0.05 });
    },
  };
}
