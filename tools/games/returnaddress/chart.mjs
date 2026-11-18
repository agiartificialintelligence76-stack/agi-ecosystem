// Bake only the measured beat grid and envelope used by the vinyl pressing.
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../../src/games/',import.meta.url);
const read = async file => JSON.parse(await readFile(new URL('heartbeat/charts/' + file + '.json',root),'utf8'));
const records = [];
for (const { id } of await read('index')) {
  const { title,bpm,duration,beats,energy,bar } = await read(id);
  records.push({id,title,bpm,duration,bar,beats:beats.map(t => Math.round(t*1000)),energy});
}
await writeFile(new URL('returnaddress/pressings.json',root),JSON.stringify(records) + '\n');
