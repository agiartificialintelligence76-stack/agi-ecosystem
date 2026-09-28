// Removes the TANGENT data from every mesh in a .glb, which makes the file about 300 KB smaller for AGI-1.
//
// Why it's safe: three.js works the tangents out in the shader when a model has none. Old and new were rendered
// side by side (same camera, same frame) on 2026-09-24 and looked the same.
// Usage: node drop-tangents.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) {
  console.error('usage: node drop-tangents.mjs <in.glb> <out.glb>');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
let removed = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const tangent = prim.getAttribute('TANGENT');
    if (!tangent) continue;
    prim.setAttribute('TANGENT', null);
    if (tangent.listParents().every((p) => p === doc.getRoot())) tangent.dispose();   // nothing else uses it
    removed++;
  }
}
await io.write(OUT, doc);
console.log(`${IN} → ${OUT}: removed tangents from ${removed} mesh part(s)`);
