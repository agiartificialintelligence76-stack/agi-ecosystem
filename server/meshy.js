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
import { MOVES } from '../src/studio/rules.js';

export const MESHY = 'https://api.meshy.ai';
const PATHS = {
  preview: '/openapi/v2/text-to-3d', refine: '/openapi/v2/text-to-3d', image: '/openapi/v1/image-to-3d', rig: '/openapi/v1/rigging',
  moves: '/openapi/v1/animations',
};
export const TASK_ID = /^[A-Za-z0-9_-]{6,80}$/;
export const CREDITS = { preview: 20, refine: 10, image: 30, rig: 5, moves: 3 * MOVES.length };

// The request for a step. → the JSON body
export function meshyBody(step, { prompt, texture, previewId, refineId, rigId, imageUrl } = {}) {
  if (step === 'image') {
    return { image_url: imageUrl, ai_model: 'latest', topology: 'triangle', target_polycount: 20000, should_remesh: true,
      should_texture: true, enable_pbr: false, pose_mode: 'a-pose', moderation: true };
  }
  if (step === 'preview') {
    return { mode: 'preview', prompt, ai_model: 'latest', model_type: 'standard', pose_mode: 'a-pose', should_remesh: true,
      target_polycount: 20000, topology: 'triangle', moderation: true, target_formats: ['glb'] };
  }
  if (step === 'refine') {
    return { mode: 'refine', preview_task_id: previewId, enable_pbr: false, texture_prompt: texture, texture_resolution: '2k',
      moderation: true, target_formats: ['glb'] };
  }
  if (step === 'rig') return { input_task_id: refineId, height_meters: 1.7 };
  if (step === 'moves') return { rig_task_id: rigId, action_ids: MOVES.map((m) => m.action) };
  throw new Error(`meshy: no step ${step}`);
}

// Meshy's answer when it isn't a yes, with a word for what to do (never the key)
function meshyError(status, text) {
  const t = String(text || '').replace(/msy_[A-Za-z0-9_-]+/g, 'msy_…').replace(/\s+/g, ' ').slice(0, 200);
  const hint = status === 401 ? ' (MESHY_API_KEY is wrong or was deleted: make a new one in Meshy → API keys)'
    : status === 402 ? ' (no Meshy credits left: add some in Meshy, or raise the key\'s monthly limit)'
      : status === 429 ? (/NoMoreConcurrentTasks|NoMorePendingTasks/i.test(t) ? ' (Meshy\'s queue is full, or its credits ran out)' : ' (too fast for Meshy just now)')
        : '';
  return Object.assign(new Error(`meshy HTTP ${status}${t ? `: ${t}` : ''}${hint}`), {
    status, why: status === 401 ? 'key' : status === 402 ? 'credits' : status === 429 ? 'busy' : status === 422 ? 'pose' : status >= 500 ? 'meshy' : 'request',
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
  const out = await call(cfg, 'POST', PATHS[step], meshyBody(step, inputs), timeoutMs);
  const id = out?.result;
  if (typeof id !== 'string' || !TASK_ID.test(id)) throw Object.assign(new Error('meshy: no task id in its answer'), { why: 'meshy' });
  return id;
}

// A step's task, as it is now. → { status, progress, task (the whole object), refused (Meshy's screening stopped it) }
export async function meshyTask(cfg, step, id, { timeoutMs = 8000 } = {}) {
  if (!TASK_ID.test(String(id))) throw Object.assign(new Error('meshy: a bad task id'), { why: 'request' });
  const task = await call(cfg, 'GET', `${PATHS[step]}/${id}`, null, timeoutMs);
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

// The file a finished step made that our server keeps: its moves' file (the character with its bones and every move, one
// clip each, in MOVES' order), and the refine's picture of it. → an https address on Meshy's side (good for 3 days), or null
export function animationUrl(task) {
  const u = task?.result?.animation_glb_url;
  return typeof u === 'string' && /^https:\/\//.test(u) ? u : null;
}
export function thumbnailUrl(task) {
  const u = task?.thumbnail_url;
  return typeof u === 'string' && /^https:\/\//.test(u) ? u : null;
}
