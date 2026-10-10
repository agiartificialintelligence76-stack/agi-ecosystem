// fal.ai's queue (2026-10-10, AGI-1's studio: a character's videos, server/studio-video.js), from its docs (fal.ai/docs, read
// 2026-10-10):
//   a request: POST https://queue.fal.run/<model> with the model's inputs (JSON), "Authorization: Key <FAL_KEY>"; its answer
//   gives the request's id and the addresses of its state and its result (on queue.fal.run: our server only ever sends the key
//   there);
//   its state: GET <status_url> → IN_QUEUE (with its place in the queue), IN_PROGRESS or COMPLETED ("error" and "error_type"
//   when it failed);
//   its result: GET <response_url> → the model's output; a model that says no answers 422 with a "detail" list of
//   { loc, msg, type } (type "content_policy_violation": its safety check stopped the words or the picture).
// The video model (VIDEO_MODEL): Seedance 2.5's reference-to-video (ByteDance's, on fal): a short video of the character in
// the picture given, doing what the words say. About $0.47 a second of 720p video (fal's page, 2026-10-10: about $2.40 for
// 5 seconds), its input pictures not billed. What it makes stays on fal's media addresses for 7 days at most
// (X-Fal-Object-Lifecycle-Preference): our server keeps the video itself (server/studio-files.js).
// The key (FAL_KEY, secret, "<id>:<secret>") never goes anywhere else, and never in a log or an error.
import { readLimited } from './coins.js';

export const FAL_QUEUE = 'https://queue.fal.run';
export const VIDEO_MODEL = 'bytedance/seedance-2.5/reference-to-video';
// A model's id: its owner, its app and up to 4 parts more (Kling's on fal are 5 long: fal-ai/kling-video/v3/standard/…)
export const MODEL_RE = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*){1,5}$/;
export const REQ_ID = /^[A-Za-z0-9_-]{6,80}$/;
const QUEUE_URL = /^https:\/\/queue\.fal\.run\/[A-Za-z0-9._/-]{1,240}$/;
const KEEP_FILES_S = 7 * 86400;
const ANSWER_MAX = 1_000_000;

// fal's key out of any text (its own value when we have it, and anything shaped like one: "<uuid>:<hex>")
const KEY_SHAPE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{16,}/gi;
export function scrub(text, key = '') {
  let t = String(text ?? '');
  if (key && key.length >= 8) t = t.split(key).join('…');
  return t.replace(KEY_SHAPE, '…').replace(/\bKey\s+[^\s"',]{8,}/g, 'Key …');
}

// fal's "no", with a word for what it means for a video (never the key):
//   'key' (401, or a 403 that isn't about money: FAL_KEY wrong or deleted) · 'credits' (no balance left) · 'busy' (429) ·
//   'refused' (its safety check: content_policy_violation) · 'nothing' (no_media_generated) · 'fal' (5xx: fal for a moment)
//   · 'request' (anything else: our request itself)
function falError(status, text, key) {
  const t = scrub(text, key).replace(/\s+/g, ' ').slice(0, 220);
  let types = [];
  try {
    const body = JSON.parse(text);
    if (Array.isArray(body?.detail)) types = body.detail.map((d) => String(d?.type || ''));
    else if (typeof body?.error_type === 'string') types = [body.error_type];
  } catch { /* not JSON */ }
  const money = /balance|locked|billing|top.?up|credit|payment|insufficient/i.test(t);
  const why = types.includes('content_policy_violation') ? 'refused' : types.includes('no_media_generated') ? 'nothing'
    : status === 401 ? 'key' : status === 402 || (status === 403 && money) ? 'credits' : status === 403 ? 'key'
      : status === 429 ? 'busy' : status >= 500 ? 'fal' : 'request';
  const hint = why === 'key' ? ' (FAL_KEY is wrong or was deleted: make a new one at fal.ai → API keys)'
    : why === 'credits' ? " (no fal.ai balance left: top it up at fal.ai → Billing)"
      : why === 'busy' ? ' (too many at once for fal just now)' : '';
  return Object.assign(new Error(`fal HTTP ${status}${t ? `: ${t}` : ''}${hint}`), { status, why, types });
}

async function call(cfg, method, url, body, timeoutMs, extra = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Key ${cfg.falKey}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw Object.assign(new Error(`fal: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : scrub(String(err.message || 'unreachable'), cfg.falKey).slice(0, 80)}`), { why: 'fal' });
  }
  const bytes = await readLimited(res, ANSWER_MAX).catch(() => null);
  const text = bytes ? bytes.toString('utf8') : '';
  if (!res.ok) throw falError(res.status, text, cfg.falKey);
  if (!bytes) throw Object.assign(new Error('fal: an answer too big'), { why: 'fal' });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('fal: an answer that is not JSON'), { why: 'fal' }); }
}

// The addresses fal gives for a request's state and result: only ever on queue.fal.run, and this request's (else the ones
// its docs write, from the model's first two parts)
const appOf = (model) => model.split('/').slice(0, 2).join('/');
function queueUrl(u, req, status) {
  if (typeof u !== 'string' || !QUEUE_URL.test(u)) return null;
  const tail = status ? `/requests/${req}/status` : `/requests/${req}`;
  return u.endsWith(tail) && !u.includes('..') ? u : null;
}

// A request, submitted. → { req, statusUrl, resultUrl } · throws a fal error (its why)
export async function falSubmit(cfg, model, input, { timeoutMs = 9000 } = {}) {
  if (!MODEL_RE.test(String(model))) throw Object.assign(new Error('fal: a bad model name'), { why: 'request' });
  const out = await call(cfg, 'POST', `${FAL_QUEUE}/${model}`, input, timeoutMs,
    { 'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: KEEP_FILES_S }) });
  const req = out?.request_id;
  if (typeof req !== 'string' || !REQ_ID.test(req)) throw Object.assign(new Error('fal: no request id in its answer'), { why: 'fal' });
  return {
    req,
    statusUrl: queueUrl(out.status_url, req, true) || `${FAL_QUEUE}/${appOf(model)}/requests/${req}/status`,
    resultUrl: queueUrl(out.response_url, req, false) || `${FAL_QUEUE}/${appOf(model)}/requests/${req}`,
  };
}

// A request's state. → { status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED', position, error, errorType }
export async function falStatus(cfg, statusUrl, { timeoutMs = 8000 } = {}) {
  if (!QUEUE_URL.test(String(statusUrl))) throw Object.assign(new Error('fal: not a queue address'), { why: 'request' });
  const s = await call(cfg, 'GET', statusUrl, null, timeoutMs);
  const status = String(s?.status || '').toUpperCase();
  if (!['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'].includes(status)) throw Object.assign(new Error('fal: a request without its state'), { why: 'fal' });
  const position = Number(s.queue_position);
  return {
    status,
    position: Number.isInteger(position) && position >= 0 ? position : null,
    error: s.error ? scrub(String(s.error), cfg.falKey).slice(0, 160) : null,
    errorType: s.error_type ? String(s.error_type).slice(0, 60) : null,
  };
}

// A finished request's video. → { url, type, size } · throws a fal error (a model's "no": refused / nothing / request)
export async function falResult(cfg, resultUrl, { timeoutMs = 8000 } = {}) {
  if (!QUEUE_URL.test(String(resultUrl))) throw Object.assign(new Error('fal: not a queue address'), { why: 'request' });
  const out = await call(cfg, 'GET', resultUrl, null, timeoutMs);
  const v = out?.video;
  if (!v || typeof v.url !== 'string') throw Object.assign(new Error('fal: its result has no video'), { why: 'nothing' });
  const size = Number(v.file_size);
  return { url: v.url, type: String(v.content_type || ''), size: Number.isFinite(size) && size > 0 ? size : null };
}

// (2026-10-10, AGI Studio: server/inf-jobs.js) a finished request's whole output, for models whose result isn't one video (its
// pictures, say). → the model's output (JSON) · throws a fal error (a model's "no": refused / nothing / request)
export async function falOutput(cfg, resultUrl, { timeoutMs = 8000 } = {}) {
  if (!QUEUE_URL.test(String(resultUrl))) throw Object.assign(new Error('fal: not a queue address'), { why: 'request' });
  const out = await call(cfg, 'GET', resultUrl, null, timeoutMs);
  if (!out || typeof out !== 'object') throw Object.assign(new Error('fal: an empty result'), { why: 'nothing' });
  return out;
}

// A refusal by the model's safety check, as fal says it in a request's state (its words differ from model to model)
export const refusedText = (s) => /content.?policy|safety|moderat|nsfw|sensitive|inappropriate|not allowed|violat/i.test(String(s || ''));
