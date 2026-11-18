// Extract the original drifting beat grids from HEARTBEAT. Estimate a local triad
// over each call/answer pair from PCM in the actual recordings, so overdubs follow
// the harmony of each section instead of playing a fixed scale over seven songs.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = process.env.FFMPEG_BIN || require('@ffmpeg-installer/ffmpeg').path;
const charts = new URL('../../../src/games/heartbeat/charts/', import.meta.url);
const audio = new URL('../../../public/games/heartbeat/audio/', import.meta.url);
const out = new URL('../../../src/games/echoforge/recordings.json', import.meta.url);
const list = JSON.parse(readFileSync(new URL('index.json', charts)));
const sampleRate = 8000;
const size = 1536;
const window = Array.from({length: size}, (_, i) => .5 - .5 * Math.cos(i * Math.PI * 2 / (size - 1)));
const bins = Array.from({length: 36}, (_, i) => {
  const midi = i + 43;
  return { pitch: midi % 12, c: 2 * Math.cos(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) / sampleRate) };
});

function chroma(samples, time, destination) {
  const start = Math.max(0, Math.floor(time * sampleRate));
  const block = window.map((gain, i) => (samples[start + i] || 0) * gain);
  for (const {pitch, c} of bins) {
    let u = 0;
    let v = 0;
    for (const value of block) {
      const next = value + c * u - v;
      v = u;
      u = next;
    }
    destination[pitch] += Math.sqrt(Math.max(0, u * u + v * v - c * u * v));
  }
}

function chord(weights) {
  let best = -Infinity;
  let choice = [0, 4];
  for (let root = 0; root < 12; root++) {
    for (const third of [3, 4]) {
      const score = weights[root] * 1.05 + weights[(root + third) % 12] + weights[(root + 7) % 12];
      if (score > best) {
        best = score;
        choice = [root, third];
      }
    }
  }
  return choice;
}

const recordings = list.map(({id}) => {
  const source = JSON.parse(readFileSync(new URL(id + '.json', charts)));
  const decoded = spawnSync(ffmpeg, ['-v','error','-i',fileURLToPath(new URL(id + '.mp3', audio)),
    '-f','s16le','-ac','1','-ar',String(sampleRate),'pipe:1'], {maxBuffer: 16 * 1024 * 1024});
  if (decoded.status !== 0) throw new Error(String(decoded.error || decoded.stderr));
  const samples = new Int16Array(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.length / 2);
  const {id: key, title, bpm, duration, beats, bar, energy} = source;
  const harmony = [];
  for (let index = bar; index + 8 < beats.length; index += 8) {
    const weights = Array(12).fill(0);
    for (let k = 0; k < 8; k++) chroma(samples, beats[index + k] + .07, weights);
    harmony.push(chord(weights));
  }
  return {id: key, title, bpm, duration, beats, bar, energy, harmony};
});
writeFileSync(out, JSON.stringify(recordings) + '\n');
console.log(recordings.map(r => r.title + ' · ' + r.harmony.length + ' call/answer bars').join('\n'));
