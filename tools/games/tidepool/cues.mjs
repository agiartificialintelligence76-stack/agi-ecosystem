// Rebuild the two-deck timing guide from HEARTBEAT's measured, drifting beat grid.
// The mixes use the original recordings. Note-chart data never enters this game.
import { readFileSync, writeFileSync } from 'node:fs';

const charts = new URL('../../../src/games/heartbeat/charts/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', charts)));
const songs = index.map(({ id }) => {
  const { title, bpm, duration, beats, energy, bar, preview } = JSON.parse(readFileSync(new URL(id + '.json', charts)));
  return { id, title, bpm, duration, bar, energy, preview, beats };
});
writeFileSync(new URL('../../../src/games/tidepool/records.json', import.meta.url), JSON.stringify(songs) + '\n');
