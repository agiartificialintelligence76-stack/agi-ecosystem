import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { productions } from '../../../src/games/starlingrelay/productions.js';
import { check, prove, VERSION } from '../../../src/games/starlingrelay/score.js';
const certificates = productions.map((scene) => {
  const p = prove(scene);
  assert.ok(check(scene, p).ok);
  return {
    id: scene.id,
    name: scene.name,
    grammar: VERSION,
    par: p.par,
    main: p.main,
    dance: p.dance,
    definitionsChecked: p.definitions,
  };
});
const path = new URL('./certificates.json', import.meta.url);
if (process.argv.includes('--write')) writeFileSync(path, JSON.stringify(certificates, null, 2) + '\n');
else assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), certificates);
console.log(certificates.length + ' full shortest scores independently rebuilt through the cue grammar.');
