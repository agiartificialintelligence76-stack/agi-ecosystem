import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { AUDIO_FILES, createAudio } from '../src/games/vladrunner2049/audio.js';

function harness(t, fail = false) {
  const contexts = [], requests = [], intervals = new Map(); let intervalId = 0;
  const param = () => ({ value: 0, calls: [], setValueAtTime(value, at) { this.value = value; this.calls.push(['set', value, at]); },
    linearRampToValueAtTime(value, at) { this.calls.push(['linear', value, at]); },
    exponentialRampToValueAtTime(value, at) { this.calls.push(['exponential', value, at]); },
    setTargetAtTime(value, at, duration) { this.value = value; this.calls.push(['target', value, at, duration]); },
    cancelScheduledValues(at) { this.calls.push(['cancel', at]); } });
  class Context {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.nodes = []; this.played = []; this.destination = {}; contexts.push(this); }
    node(type) { const node = { type, connections: [], disconnected: false,
      connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; } }; this.nodes.push(node); return node; }
    createGain() { return Object.assign(this.node('gain'), { gain: param() }); }
    createBiquadFilter() { return Object.assign(this.node('filter'), { frequency: param(), Q: param() }); }
    createStereoPanner() { return Object.assign(this.node('pan'), { pan: param() }); }
    createDynamicsCompressor() { return Object.assign(this.node('compressor'), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, param()]))); }
    createConvolver() { return this.node('convolver'); }
    createBuffer(channels, length, rate) { const arrays = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / rate, getChannelData: index => arrays[index] }; }
    createBufferSource() { const source = Object.assign(this.node('sample'), { playbackRate: param() }); return this.playable(source); }
    createOscillator() { return this.playable(Object.assign(this.node('oscillator'), { frequency: param() })); }
    playable(source) { source.start = (at, offset) => { source.startedAt = at; source.offset = offset; this.played.push(source); };
      source.stop = at => { source.stoppedAt = at ?? this.currentTime; if (at === undefined) { source.stopped = true; source.onended?.(); } }; return source; }
    async decodeAudioData(bytes) { return { name: new TextDecoder().decode(bytes), duration: .35 }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; this.closed = true; }
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push({ url, options }); if (fail) throw Error('offline'); return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url.split('/').at(-1)).buffer }; });
  t.mock.method(globalThis, 'setInterval', fn => { intervals.set(++intervalId, fn); return intervalId; });
  t.mock.method(globalThis, 'clearInterval', id => intervals.delete(id));
  const before = globalThis.AudioContext; globalThis.AudioContext = Context;
  t.after(() => { if (before === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = before; });
  return { contexts, requests, intervals, advance(seconds) { for (const c of contexts) c.currentTime += seconds; }, tick() { for (const fn of intervals.values()) fn(); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const state = (events = [], elapsed = 1) => ({ events, elapsed, status: 'playing', stage: 0, cameraX: 0, players: [] });
const hit = (id, more = {}) => ({ id, type: 'hit', x: 640, amount: 16, attackKind: 'light', ...more });

test('audio byte preload is local, cached, and silent; a gesture unlocks decoding', async t => {
  const h = harness(t), audio = createAudio({ music: 0 }); t.after(() => audio.destroy());
  assert.equal(await audio.preload(), AUDIO_FILES.length); await audio.preload();
  assert.equal(h.requests.length, AUDIO_FILES.length); assert.equal(h.contexts.length, 0);
  assert.ok(h.requests.every(r => r.url.startsWith('/audio/vladrunner2049/') && r.options.cache === 'force-cache'));
  audio.update(state([hit(1)])); assert.equal(h.contexts.length, 0);
  assert.equal(await audio.start(), true); await flush(); assert.equal(audio.ready, true);
  audio.update(state([hit(1)])); assert.equal(h.contexts[0].played.length, 0, 'locked events are not replayed later');
  audio.update(state([hit(2)])); assert.ok(h.contexts[0].played.some(s => /^punch-/.test(s.buffer?.name || '')));
});

test('contact sounds are deduplicated, varied, and fresh after a new run', async t => {
  const h = harness(t), audio = createAudio({ music: 0 }); t.after(() => audio.destroy()); await audio.start(); await flush();
  const c = h.contexts[0]; audio.update(state([hit(1)])); const first = c.played.length;
  audio.update(state([hit(1)])); assert.equal(c.played.length, first);
  const firstPunch = c.played.find(s => /^punch-/.test(s.buffer?.name || '')).buffer.name;
  h.advance(.2); audio.update(state([hit(1), hit(2)], 2));
  const punches = c.played.filter(s => /^punch-/.test(s.buffer?.name || '')); assert.equal(punches.length, 2); assert.notEqual(punches[1].buffer.name, firstPunch);
  h.advance(.2); audio.update(state([hit(1, { strength: 'heavy' })], .1));
  assert.ok(c.played.some(s => /^heavy-/.test(s.buffer?.name || '')), 'new run event IDs are admitted');
});

test('attack whoosh follows anticipation timing; footfalls and landings use recorded samples', async t => {
  const h = harness(t), audio = createAudio({ music: 0 }); t.after(() => audio.destroy()); await audio.start(); await flush();
  h.advance(1); const c = h.contexts[0];
  audio.update(state([{ id: 1, type: 'attack', attackKind: 'heavy', strength: 'heavy', swingDelay: .18, x: 500, kind: 'vlad' }]));
  const swing = c.played.find(s => /^swing-/.test(s.buffer?.name || '')); assert.ok(Math.abs(swing.startedAt - 1.184) < 1e-6);
  assert.ok(swing.playbackRate.value < .8, 'heavy swing has lower weight');
  const prior = c.played.length; h.advance(.3);
  audio.update(state([{ id: 2, type: 'footstep', player: 0, kind: 'agi', x: 400 }, { id: 3, type: 'land', player: 0, amount: 460, x: 400 }], 2));
  const movement = c.played.slice(prior); assert.ok(movement.some(s => /^step-/.test(s.buffer?.name || ''))); assert.ok(movement.some(s => s.buffer?.name === 'land.wav'));
  assert.ok(movement.every(s => s.type === 'sample'), 'movement does not make pitched chirps');
});

test('pause kills scheduled swing tails and blocks scheduling without replay on resume', async t => {
  const h = harness(t), audio = createAudio(); t.after(() => audio.destroy()); await audio.start(); await flush();
  const c = h.contexts[0]; audio.update(state([{ id: 1, type: 'attack', swingDelay: .18, attackKind: 'heavy' }]));
  const swing = c.played.find(s => /^swing-/.test(s.buffer?.name || '')); audio.setPaused(true); assert.equal(swing.stopped, true);
  const count = c.played.length; h.advance(1); h.tick(); audio.update(state([hit(2)], 2)); assert.equal(c.played.length, count);
  audio.setPaused(false); audio.update(state([hit(2)], 2)); assert.equal(c.played.length, count, 'paused hit was consumed');
  audio.update(state([hit(3)], 2.1)); assert.ok(c.played.length > count);
});

test('muting effects consumes event IDs, clears tails, and leaves music independent', async t => {
  const h = harness(t), audio = createAudio(); t.after(() => audio.destroy()); await audio.start(); await flush();
  const c = h.contexts[0]; audio.update(state([hit(1)]));
  audio.setOptions({ sfx: 0 }); const count = c.played.length;
  h.advance(.2); audio.update(state([hit(2)], 2)); assert.equal(c.played.length, count);
  audio.setOptions({ sfx: .65 }); audio.update(state([hit(2)], 2)); assert.equal(c.played.length, count);
  assert.ok(c.played.some(s => s.type === 'triangle' && !s.stopped), 'sfx control does not stop the score');
  audio.setOptions({ music: 0 }); assert.ok(c.played.filter(s => s.type === 'triangle').every(s => s.stopped));
});

test('missing sample requests fail quietly and retain a restrained impact fallback', async t => {
  const h = harness(t, true), audio = createAudio({ music: 0 }); t.after(() => audio.destroy());
  assert.equal(await audio.start(), true); await flush(); assert.equal(audio.ready, false);
  audio.update(state([hit(1)])); assert.ok(h.contexts[0].played.length > 0); assert.equal(h.requests.length, AUDIO_FILES.length);
  assert.equal(await audio.start(), true); assert.equal(h.requests.length, AUDIO_FILES.length, 'failure does not loop requests');
});

test('all dry and room-tail paths respect their music/effects volume controls', async t => {
  const h = harness(t), audio = createAudio({ music: .31, sfx: .57 }); t.after(() => audio.destroy());
  await audio.start(); await flush(); audio.update(state([hit(1)]));
  const c = h.contexts[0], music = c.nodes.find(n => n.gain?.value === .31 * .9), effects = c.nodes.find(n => n.gain?.value === .57);
  function reachesOutputWithout(node, control, seen = new Set()) {
    if (node === control || seen.has(node)) return false;
    if (node === c.destination) return true;
    seen.add(node); return (node.connections || []).some(next => reachesOutputWithout(next, control, seen));
  }
  const punch = c.played.find(n => /^punch-/.test(n.buffer?.name || ''));
  const pad = c.played.find(n => n.type === 'triangle');
  assert.ok(music && effects && punch && pad);
  assert.equal(reachesOutputWithout(punch, effects), false, 'effect reverb cannot bypass its slider');
  assert.equal(reachesOutputWithout(pad, music), false, 'score reverb cannot bypass its slider');
});

test('destroy aborts loading, releases voices and timer, and prevents future audio', async t => {
  const h = harness(t), audio = createAudio(); await audio.start(); await flush(); audio.update(state([hit(1)]));
  const c = h.contexts[0], count = c.played.length; audio.destroy(); audio.destroy();
  assert.equal(c.closed, true); assert.equal(h.intervals.size, 0); assert.ok(h.requests.every(r => r.options.signal.aborted));
  assert.ok(c.played.every(s => s.stopped)); assert.equal(await audio.start(), false); audio.update(state([hit(2)])); assert.equal(c.played.length, count);
});

test('the shipped sound bank is compact, non-clipping PCM with its original source license', async () => {
  let bytes = 0;
  for (const name of AUDIO_FILES) {
    const path = new URL(`../public/audio/vladrunner2049/${name}.wav`, import.meta.url), b = await readFile(path); bytes += (await stat(path)).size;
    assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 12), 'WAVE');
    assert.equal(b.readUInt16LE(20), 1); assert.equal(b.readUInt16LE(22), 1); assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt16LE(34), 16); assert.equal(b.length, b.readUInt32LE(40) + 44);
    let peak = 0; for (let i = 44; i < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)));
    assert.ok(peak > 10000 && peak < 30000, `${name}: useful signal with mix headroom`);
    assert.ok(b.length > 4400 && b.length < 120000, `${name}: short, bounded one-shot`);
  }
  assert.ok(bytes < 650000, `sound bank is ${bytes} bytes`);
  const credits = await readFile(new URL('../public/audio/vladrunner2049/CREDITS.txt', import.meta.url), 'utf8');
  assert.match(credits, /https:\/\/kenney.nl\/assets\/impact-sounds/); assert.match(credits, /https:\/\/kenney.nl\/assets\/rpg-audio/);
  assert.match(credits, /CC0/); for (const name of AUDIO_FILES) assert.ok(credits.includes(`${name}.wav`));
});
