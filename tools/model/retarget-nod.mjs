// Rebuild the owner's full-body nod. The website returns to a relaxed idle;
// this clip's first frame is already leaning forward to prepare the nod.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Animation } from '@viggle/splat-engine';
import { retargetMotion } from './retarget-hello.mjs';

const source = new URL('../../new agi 3d model/Nod-Yes.glb', import.meta.url);
const destination = new URL('../../public/models/agi1-nod-yes.glb', import.meta.url);
const output = retargetMotion(await fs.readFile(source), undefined, { name: 'Nod Yes', fullBody: true });
const parsed = Animation.fromGlb(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength));
await fs.writeFile(destination, output);
console.log(JSON.stringify({ output: fileURLToPath(destination), bytes: output.length, frames: parsed.numFrames,
  bones: parsed.numBones, duration: (parsed.numFrames - 1) / 30 }));
