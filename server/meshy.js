// Meshy's API (2026-10-10, AGI-1's 3D character studio: server/studio.js), from its docs (docs.meshy.ai, read 2026-10-10):
//   text to 3D (a model from words, then painted): POST /openapi/v2/text-to-3d, mode "preview" then "refine"
//   rigging (bones for a textured humanoid): POST /openapi/v1/rigging
//   animations (moves from its library, up to 10 in one file, one clip each, in order): POST /openapi/v1/animations
// Each answers a task id; its state is read with GET <the same path>/<id>: PENDING, IN_PROGRESS, SUCCEEDED, FAILED or
// CANCELED. A failed task gives its credits back. What it makes is kept by Meshy for 3 days (non-Enterprise), so our
// server keeps the files itself (server/studio-files.js).
// Credits (its pricing page, 2026-10-10): a preview 20 (Meshy 7.1), a refine 10 (2K texture), rigging 5, 3 a move: a
// character with its 8 moves (src/studio/rules.js MOVES) is 59. The key (MESHY_API_KEY, "msy_…", secret) can have its own
// monthly credit limit in Meshy's developer platform.
// moderation: on, for its words (Meshy screens them and stops a task before it starts).
// (2026-10-10, AGI Studio) image to 3D: a model from an influencer's full-body picture (a signed address to it in the
// studio's private bucket), painted, in an A-pose: POST /openapi/v1/image-to-3d, about 30 credits with its texture; then the
// same bones and moves (rigging from that task). A 3D model of an influencer is 59 credits as well (30 + 5 + 24).
// (2026-10-13, the 3D tool's choices: src/studio/rules.js MODEL) its moves picked from the library (3 each, 10 at most in
// one file), its shape (target_polycount; High detail also geometry_resolution "2k": 5 credits more), shine (enable_pbr), its
// pose (A or T), its height (its bones' scale) and its look in words (texture_prompt: what the texture's painted from, in the
// texture's own price); and moves described in words: Text to Motion (POST /openapi/v1/text-to-motion: a motion from words,
// "prime" 10 credits; a 403 when its words are flagged), then put on its bones (POST /openapi/v1/animations with that
// motion: 3), one file each, which our server merges into its model (server/studio-files.js mergeClips).
import { MOVES, MODEL_DETAIL, MODEL_DEFAULT, modelSpec, modelMoves, stepGroup } from '../src/studio/rules.js';
import { meshyLook, meshyMotion } from './studio-words.js';

export const MESHY = 'https://api.meshy.ai';
const PATHS = {
  preview: '/openapi/v2/text-to-3d', refine: '/openapi/v2/text-to-3d', image: '/openapi/v1/image-to-3d', rig: '/openapi/v1/rigging',
  moves: '/openapi/v1/animations', motion: '/openapi/v1/text-to-motion', apply: '/openapi/v1/animations',
};
// a step's path (motion1 and motion2 are both Text to Motion; apply1 and apply2 both animations)
const pathOf = (step) => PATHS[stepGroup(step)] || null;
export const TASK_ID = /^[A-Za-z0-9_-]{6,80}$/;
export const CREDITS = { preview: 20, refine: 10, image: 30, rig: 5, moves: 3 * MOVES.length, motion: 10, apply: 3, high: 5 };

// The request for a step. → the JSON body. spec: the model's choices (rules.js modelSpec; none: the model as before)
export function meshyBody(step, { prompt, texture, previewId, refineId, rigId, imageUrl, spec = null, motionId = null } = {}) {
  const s = modelSpec(spec) || MODEL_DEFAULT;
  const group = stepGroup(step);
  const n = Number(String(step).slice(group.length)) || 0;
  if (step === 'image') {
    const d = MODEL_DETAIL[s.detail];
    return { image_url: imageUrl, ai_model: 'latest', topology: 'triangle', target_polycount: d.faces, should_remesh: true,
      should_texture: true, enable_pbr: s.shine, pose_mode: s.pose === 't' ? 't-pose' : 'a-pose', moderation: true,
      ...(d.geometry ? { geometry_resolution: d.geometry } : {}), ...(s.look ? { texture_prompt: meshyLook(s.look) } : {}) };
  }
  if (step === 'preview') {
    return { mode: 'preview', prompt, ai_model: 'latest', model_type: 'standard', pose_mode: 'a-pose', should_remesh: true,
      target_polycount: 20000, topology: 'triangle', moderation: true, target_formats: ['glb'] };
  }
  if (step === 'refine') {
    return { mode: 'refine', preview_task_id: previewId, enable_pbr: false, texture_prompt: texture, texture_resolution: '2k',
      moderation: true, target_formats: ['glb'] };
  }
  if (step === 'rig') return { input_task_id: refineId, height_meters: s.height / 100 };
  if (step === 'moves') return { rig_task_id: rigId, action_ids: modelMoves(s).map((m) => m.action) };
  if (group === 'motion' && n >= 1 && n <= s.own.length && step === `motion${n}`) {
    return { prompt: meshyMotion(s.own[n - 1].prompt), mode: 'prime', duration: s.own[n - 1].seconds };
  }
  if (group === 'apply' && n >= 1 && n <= s.own.length && step === `apply${n}` && motionId) return { rig_task_id: rigId, motion_task_id: motionId };
  throw new Error(`meshy: no step ${step}`);
}

// Meshy's answer when it isn't a yes, with a word for what to do (never the key)
function meshyError(status, text) {
  const t = String(text || '').replace(/msy_[A-Za-z0-9_-]+/g, 'msy_…').replace(/\s+/g, ' ').slice(0, 200);
  const hint = status === 401 ? ' (MESHY_API_KEY is wrong or was deleted: make a new one in Meshy → API keys)'
    : status === 402 ? ' (no Meshy credits left: add some in Meshy, or raise the key\'s monthly limit)'
      : status === 429 ? (/NoMoreConcurrentTasks|NoMorePendingTasks/i.test(t) ? ' (Meshy\'s queue is full, or its credits ran out)' : ' (too fast for Meshy just now)')
        : status === 403 ? ' (its screening stopped these words)' : '';
  return Object.assign(new Error(`meshy HTTP ${status}${t ? `: ${t}` : ''}${hint}`), {
    status, why: status === 401 ? 'key' : status === 402 ? 'credits' : status === 429 ? 'busy' : status === 422 ? 'pose' : status === 403 ? 'refused'
      : status >= 500 ? 'meshy' : 'request',
  });
}

async function call(cfg, method, path, body, timeoutMs) {
  let res;
  try {
    res = await fetch(`${MESHY}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.meshyKey}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw Object.assign(new Error(`meshy: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : String(err.message || 'unreachable').slice(0, 80)}`), { why: 'meshy' });
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) throw meshyError(res.status, text);
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('meshy: an answer that is not JSON'), { why: 'meshy' }); }
}

// A step's task, started. → its id
export async function meshyStart(cfg, step, inputs, { timeoutMs = 9000 } = {}) {
  const path = pathOf(step);
  if (!path) throw Object.assign(new Error(`meshy: no step ${step}`), { why: 'request' });
  let body;
  try { body = meshyBody(step, inputs); } catch (err) { throw Object.assign(err, { why: 'request' }); }   // a step its model doesn't have (motion3 of two)
  const out = await call(cfg, 'POST', path, body, timeoutMs);
  const id = out?.result;
  if (typeof id !== 'string' || !TASK_ID.test(id)) throw Object.assign(new Error('meshy: no task id in its answer'), { why: 'meshy' });
  return id;
}

// A step's task, as it is now. → { status, progress, task (the whole object), refused (Meshy's screening stopped it) }
export async function meshyTask(cfg, step, id, { timeoutMs = 8000 } = {}) {
  if (!TASK_ID.test(String(id)) || !pathOf(step)) throw Object.assign(new Error('meshy: a bad task id'), { why: 'request' });
  const task = await call(cfg, 'GET', `${pathOf(step)}/${id}`, null, timeoutMs);
  const status = String(task?.status || '').toUpperCase();
  if (!['PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'CANCELED'].includes(status)) throw Object.assign(new Error('meshy: a task without its state'), { why: 'meshy' });
  const message = String(task?.task_error?.message || '');
  return {
    status,
    progress: Number.isFinite(Number(task?.progress)) ? Math.max(0, Math.min(100, Number(task.progress))) : 0,
    task,
    refused: status === 'FAILED' && /moderat|harm|inappropriate|policy|violat|nsfw|sensitive|not allowed/i.test(message),
    message: message.slice(0, 160),
  };
}

// The files a finished step made that our server keeps: its moves' file (the character with its bones and every move, one
// clip each, in its moves' order; a described move's own, one clip), the refine's picture of it, and (2026-10-13, more
// downloads) the same moves as an FBX, and the image task's shape in other formats and its textures. → an https address on
// Meshy's side (good for 3 days), or null
const https = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
export const animationUrl = (task) => https(task?.result?.animation_glb_url);
export const animationFbxUrl = (task) => https(task?.result?.animation_fbx_url);
export const thumbnailUrl = (task) => https(task?.thumbnail_url);
// the image task's model in a format: glb, fbx, obj, mtl, usdz or stl
export const modelUrl = (task, format) => https(task?.model_urls?.[format]);
// its textures (its first material's): { base_color, metallic, normal, roughness } (the ones it has)
export function textureUrls(task) {
  const t = Array.isArray(task?.texture_urls) ? task.texture_urls[0] : null;
  const out = {};
  for (const k of ['base_color', 'metallic', 'normal', 'roughness']) if (https(t?.[k])) out[k] = t[k];
  return out;
}
