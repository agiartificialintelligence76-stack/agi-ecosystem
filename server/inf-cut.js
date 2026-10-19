// AGI Studio's video editor (2026-10-12, the editor; the owner's choice: "Video editor": "trim, text on it (a layer drawn in the
// browser as a PNG, so the server needs no fonts), change its shape (9:16, 1:1, 16:9); ffmpeg on our server makes an H.264 MP4
// (the clock's function, like the share mark); free, 10 a day per wallet"). Its page: src/studio/views/video-editor.js, its
// numbers src/studio/video-edit.js (the page's and ours). Saving one of its own videos or trend videos, edited, as a new video
// next to it:
//   1. POST { action: 'inf-cut-open', session, from, cut, words, layer } → openCut(): the video it's from (its maker's own,
//      done, shown, never deleted or taken down, of a ready influencer), its cut (video-edit.js cutSpec: 1 to 15 s of it, its
//      shape, its crop, its sound; one whose share mark is in it already only as it is: ownMark), its words (each like a meme's
//      line, as the photo editor's), a use still left today (inf_tool_take, only asked) → without words or stickers: started at
//      once (addCut: one use counted, a video of the same influencer, free, waiting for our clock); with them: a ticket for
//      their picture (30 minutes) and its size
//   2. POST ?inf-cut=<ticket> (its words' and stickers' PNG: transparent, exactly its size) → receiveCut(): a real PNG at that
//      size, kept (where a video's own mark is, cleared: it's never covered), then started (addCut)
//   3. our clock (/api/feed?studio: ffmpeg ships only with it) makes it in pieces of 5 seconds, as many as each minute has time
//      for (its progress in its request, "pieces-<k>": inf_job_step), joins them with its sound and keeps it (cutTick); then
//      Gemini looks at it (checkCutVideo: family-friendly, its words too) before anyone sees it, by the clock or its page while
//      it's open: done (inf_cut_done: its share mark is in it, so it's its own download), or refused (its files deleted).
// A use counted is never given back (one that can't be made or is refused too: like the photo editor's, each look costs).
import { rpc } from './limits.js';
import { mp4Info, mp4HasSound } from './mp4.js';
import { ID, takenDown } from './influencer.js';
import { studioWallet } from './studio.js';
import { checkEditorWords } from './inf-editor.js';
import { getJob, videoPath, partPath, layerPath, jobFiles, stepOf, fail, setStep, waitTurn, JOBS, aiTagged } from './inf-jobs.js';
import { CUT } from './inf-mark.js';
import { VIDEO_EDITOR } from '../src/studio/rules.js';
import { cutSpec, cutSize, storedShape, ownMark, asItIs, markBox, markSpotOf } from '../src/studio/video-edit.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PIECES = /^pieces-([0-9])$/;
const warned = new Set();
function warnOnce(what, message) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`[studio] ${message}`);
}
export const _resetCut = () => warned.clear();   // (for the tests)
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// its seconds as the database keeps them (whole, 1 to 15)
const wholeSeconds = (s) => Math.min(VIDEO_EDITOR.MAX_S, Math.max(VIDEO_EDITOR.MIN_S, Math.round(Number(s) || VIDEO_EDITOR.MIN_S)));

// ---------- 1: opening one ----------
// → { ok: true, job, left, ticket?, size? } (no ticket: started already) or { ok: false, field?, why: 'bad' | 'cut' | 'from' |
// 'gone' | 'not_yours' | 'not_ready' | 'too_many' | 'busy_day' | 'cuts_open' | 'banned' | 'taken' | the words' }
export async function openCut(cfg, { wallet, from, cut, words, layer, id }) {
  if (!ID.test(String(from)) || !ID.test(String(id)) || typeof layer !== 'boolean') return { ok: false, why: 'bad' };
  const spec = cutSpec(cut);
  if (!spec.ok) return { ok: false, why: 'cut' };
  const w = checkEditorWords(words);
  if (!w.ok) return w;
  if (w.words.length && !layer) return { ok: false, why: 'bad' };    // words are drawn on its layer
  const code = studioWallet(cfg.passSecret, wallet);
  const src = await getJob(cfg, from);
  if (!src || !['video', 'trend'].includes(src.kind) || !ID.test(String(src.inf_id))) return { ok: false, why: 'from' };
  if (src.wallet_code !== code) return { ok: false, why: 'not_yours' };
  if (src.status !== 'done' || src.hidden === true || src.deleted_at || takenDown(cfg, src.id)) return { ok: false, why: 'from' };
  if (src.inf_status === 'deleted' || src.inf_hidden === true || takenDown(cfg, src.inf_id)) return { ok: false, why: 'gone' };
  if (src.inf_status !== 'ready') return { ok: false, why: 'not_ready' };
  const own = ownMark(src);
  if (own && !asItIs(spec.cut)) return { ok: false, why: 'cut' };
  // (2026-10-14) where its own mark is (a meme video's where its words aren't: its row's mark_spot), else top left
  const spot = own ? markSpotOf(src) : 'tl';
  // (the clock checks it against the video itself; here only what its row says: a part that starts past its end)
  const seconds = Number(src.seconds);
  if (Number.isFinite(seconds) && seconds > 0 && spec.cut.start > seconds - CUT.NEAR_END_S) return { ok: false, why: 'cut' };
  const left = await rpc(cfg, 'inf_tool_take', { p_wallet: code, p_tool: 'video', p_per_day: VIDEO_EDITOR.PER_DAY, p_site_cap: VIDEO_EDITOR.SITE_DAY, p_take: false }, 'studio');
  if (left?.ok !== true) return { ok: false, why: ['too_many', 'busy_day'].includes(left?.why) ? left.why : 'busy' };
  if (!layer) {
    const r = await addCut(cfg, { id, inf: src.inf_id, code, from, cut: { ...spec.cut, layer: false, own, ...(own ? { spot } : {}) } });
    return r.ok ? { ok: true, job: id, left: n0(r.left) } : { ok: false, why: String(r.why || 'busy') };
  }
  const { makeTicket, UPLOAD } = await import('./inf-uploads.js');
  const ticket = makeTicket(cfg.passSecret, 'vc', { j: id, i: src.inf_id, f: from, w: code, c: spec.cut, o: own ? 1 : 0, s: spot }, Date.now(), UPLOAD.TICKET_MS);
  return { ok: true, job: id, ticket, size: cutSize(spec.cut.shape, ...spec.cut.src), left: n0(left.left) };
}

// One use counted and the cut started (a video of the same influencer, free, waiting for our clock: inf_cut_add). cut: its
// tidied cut, with layer (its words' picture is kept), own (its mark is in it already) and spot (where that mark is, since
// 2026-10-14: a meme video's isn't always top left). → the database's answer
export async function addCut(cfg, { id, inf, code, from, cut }) {
  const [W, H] = cut.src;
  return rpc(cfg, 'inf_cut_add', {
    p_job: id, p_inf: inf, p_wallet: code, p_from: from, p_shape: storedShape(cut.shape, W, H), p_seconds: wholeSeconds(cut.length),
    p_sound: cut.sound === true, p_cut: cut, p_per_day: VIDEO_EDITOR.PER_DAY, p_site_cap: VIDEO_EDITOR.SITE_DAY, p_open: VIDEO_EDITOR.OPEN,
  }, 'studio');
}

// ---------- 2: its words' and stickers' picture ----------
// A real PNG of exactly w × h, made plain (no metadata, an alpha channel), and where a video's own share mark is (own: in its
// top left corner, as server/inf-mark.js puts it; since 2026-10-14 at its spot, a meme video's where its words aren't),
// cleared: its words never cover it. → a PNG, or null when it isn't one
export async function layerOf(sharp, bytes, { w, h, own = false, spot = 'tl' }) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 || !bytes.subarray(0, 8).equals(PNG)) return null;
  const meta = await sharp(bytes, { limitInputPixels: 4_000_000 }).metadata().catch(() => null);
  if (!meta || meta.format !== 'png' || meta.width !== w || meta.height !== h) return null;
  let img = sharp(bytes, { limitInputPixels: 4_000_000 }).ensureAlpha();
  if (own) {
    const { markSize } = await import('./inf-mark.js');
    const m = await markSize(sharp);
    const box = markBox(w, h, m.width, m.height, spot);
    const left = Math.max(0, box.x - 2), top = Math.max(0, box.y - 2);
    const width = Math.min(w - left, box.w + 4), height = Math.min(h - top, box.h + 4);
    const hole = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    img = img.composite([{ input: hole, left, top, blend: 'dest-out' }]);
  }
  return img.png({ compressionLevel: 9 }).toBuffer().catch(() => null);
}

// t: its ticket read ({ j: its id, i: its influencer, f: the video it's from, w: its wallet's code, c: its cut, o: 1 when that
// video's mark is in it already, s: where (2026-10-14; a ticket from before: top left) }) · body: its bytes. → { status, body }
export async function receiveCut(cfg, t, body) {
  const spec = cutSpec(t?.c);
  if (!ID.test(String(t?.j)) || !ID.test(String(t?.i)) || !ID.test(String(t?.f)) || !spec.ok) return { status: 401, body: { error: 'ticket' } };
  if (body.length > CUT.LAYER_MAX) return { status: 413, body: { error: 'size' } };
  // its id is started once (the same ticket again: nothing kept)
  if (await getJob(cfg, t.j)) return { status: 409, body: { error: 'done' } };
  const { loadSharp, putFile, deleteFiles } = await import('./studio-files.js');
  const sharp = await loadSharp();
  const [w, h] = cutSize(spec.cut.shape, ...spec.cut.src);
  const own = t.o === 1;
  const spot = own && ['tl', 'tr', 'bl', 'br', 'ml', 'mr'].includes(t.s) ? t.s : 'tl';
  const png = await layerOf(sharp, body, { w, h, own, spot });
  if (!png) return { status: 422, body: { error: 'picture' } };
  const name = layerPath(t.i, t.j);
  await putFile(cfg, name, png, 'image/png', { timeoutMs: 9000 });
  let r;
  try { r = await addCut(cfg, { id: t.j, inf: t.i, code: t.w, from: t.f, cut: { ...spec.cut, layer: true, own, ...(own ? { spot } : {}) } }); } catch (err) {
    // (the database away, or an influencers.sql from before the video editor: never kept for nothing)
    await deleteFiles(cfg, [name]).catch(() => 0);
    throw err;
  }
  if (r?.ok === true) return { status: 200, body: { ok: true, job: t.j, left: n0(r.left) } };
  // (started already, by the same ticket at the same time: its picture is that one's) else not started: its picture deleted
  if (r?.why === 'taken') return { status: 409, body: { error: 'done' } };
  await deleteFiles(cfg, [name]).catch((err) => console.warn(`[studio] a cut not started, its words' picture: ${err.message}`));
  const why = String(r?.why || 'busy');
  return { status: { bad: 400, gone: 404, not_yours: 403, banned: 403, not_ready: 409, from: 409, cuts_open: 409, too_many: 429, busy_day: 429 }[why] || 503, body: { error: why } };
}

// ---------- 3: our clock makes it, then Gemini looks at it ----------
// One cut moved along (jobTick's, once it's leased: its influencer still there). encode: this is the clock (ffmpeg is here):
// anywhere else (its page) only its look. → { state, step, piece?, pieces? }
export async function cutTick(cfg, j, F, { now = Date.now(), deadline = Date.now() + 19_000, encode = false, run = null } = {}) {
  if (Date.parse(j.started_at || j.created_at) < now - JOBS.MAX_MAKING_MS) {
    await failCut(cfg, j, F, 'expired');
    return { state: 'failed', step: stepOf(j) };
  }
  if (j.saving) {
    if (deadline - Date.now() < CUT.CHECK_NEEDS_MS) { await waitTurn(cfg, j.id); return { state: 'saving', step: 'save' }; }
    return lookCut(cfg, j, F, { deadline });
  }
  if (!encode || deadline - Date.now() < CUT.NEEDS_MS) {
    await waitTurn(cfg, j.id);
    return { state: 'waiting', step: stepOf(j) };
  }
  return makeCut(cfg, j, F, { deadline, run });
}

// its pieces made (as many as this minute has time for, each kept as it's made), then joined with its sound and kept: on to its look
async function makeCut(cfg, j, F, { deadline, run }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  const spec = cutSpec(j.cut);
  if (!spec.ok) { await failCut(cfg, j, F, 'cut'); return { state: 'failed', step: 'make' }; }
  const own = j.cut?.own === true, hasLayer = j.cut?.layer === true;
  const m = PIECES.exec(j.req || '');
  let done = m ? Number(m[1]) : 0;
  try {
    const src = await F.getFile(cfg, videoPath({ kind: 'video', id: j.image, inf_id: j.inf_id }), { max: CUT.SOURCE_MAX, timeoutMs: left(7000, 8000) });
    if (!src) { await failCut(cfg, j, F, 'from'); return { state: 'failed', step: stepOf(j) }; }
    let plan;
    try { plan = (await import('./inf-mark.js')).cutPlan(mp4Info(src), spec.cut, { own }); } catch (err) {
      if (err.why !== 'cut') throw err;
      await failCut(cfg, j, F, 'cut');
      console.warn(`[studio] cut ${id} can't be made from its video: ${err.message}`);
      return { state: 'failed', step: stepOf(j) };
    }
    const n = plan.pieces.length;
    if (done > n) done = 0;   // (a plan that changed: made again from its start)
    const { cutPieces, joinCut } = await import('./inf-mark.js');
    const sharp = await F.loadSharp();
    let made = [];
    if (done < n) {
      let layer = null;
      if (hasLayer) {
        layer = await F.getFile(cfg, layerPath(j.inf_id, id), { max: CUT.LAYER_MAX, timeoutMs: left(7000, 5000) });
        if (!layer) { await failCut(cfg, j, F, 'save'); console.warn(`[studio] cut ${id}: its words' picture is missing`); return { state: 'failed', step: stepOf(j) }; }
      }
      made = (await cutPieces(sharp, src, { plan, from: done, layer, own, until: deadline - CUT.KEEP_MS, run })).pieces;
      const t = left(400, 8000);
      await Promise.all(made.map((p) => F.putFile(cfg, partPath(j.inf_id, id, p.k), p.video, 'video/mp4', { timeoutMs: t })));
      done += made.length;
      console.log(`[studio] cut ${id}: ${done} of ${n} pieces (${made.map((p) => `${p.ms} ms`).join(', ')})`);
    }
    if (done < n || deadline - Date.now() < CUT.JOIN_NEEDS_MS) {
      await setStep(cfg, id, { req: `pieces-${done}`, saving: false, tries: 0 });
      return { state: 'started', step: 'make', piece: done, pieces: n };
    }
    // all made: joined with its sound (when its maker kept it on and its video has one), kept, on to its look
    const t = left(4000, 6000);
    const videos = await Promise.all(plan.pieces.map((p) => made.find((x) => x.k === p.k)?.video
      || F.getFile(cfg, partPath(j.inf_id, id, p.k), { max: CUT.SOURCE_MAX, timeoutMs: t })));
    if (videos.some((v) => !v)) {
      // a piece went missing: made again from its start (a try)
      throw Object.assign(new Error('a piece of it is missing'), { restart: true });
    }
    const sound = spec.cut.sound === true && mp4HasSound(src) === true;
    const out = await joinCut(videos, { plan, source: sound ? src : null, timeoutMs: left(2500, 6000), run });
    if (deadline - Date.now() < 1500) throw new Error('no time left to keep it');
    out.video = aiTagged(out.video);                          // (2026-10-12: our hidden AI tag, src/studio/ai-tag.js)
    await F.putFile(cfg, videoPath(j), out.video, 'video/mp4', { timeoutMs: left(500, 9000) });
    await setStep(cfg, id, { req: `pieces-${n}`, saving: true, tries: 0 });
    F.deleteFiles(cfg, plan.pieces.map((p) => partPath(j.inf_id, id, p.k))).catch((err) => console.warn(`[studio] cut ${id}'s pieces: ${err.message}`));
    console.log(`[studio] cut ${id} is made: ${out.seconds.toFixed(1)} s, ${(out.video.length / 1e6).toFixed(2)} MB${out.sound ? ', with its sound' : ''}`);
    if (deadline - Date.now() >= CUT.CHECK_NEEDS_MS) return lookCut(cfg, { ...j, saving: true, req: `pieces-${n}` }, F, { deadline, video: out.video });
    return { state: 'saving', step: 'save' };
  } catch (err) {
    if (err.why === 'no_ffmpeg') {
      warnOnce('ffmpeg', `the video editor's cuts wait: ${err.message} (vercel.json's includeFiles for api/feed.js)`);
      await waitTurn(cfg, id);
      return { state: 'waiting', step: stepOf(j) };
    }
    const tries = n0(j.tries);
    if (tries + 1 >= JOBS.SAVE_TRIES) {
      await failCut(cfg, j, F, 'save');
      console.warn(`[studio] cut ${id} couldn't be made: ${err.message}`);
      return { state: 'failed', step: stepOf(j) };
    }
    console.warn(`[studio] cut ${id}: ${err.message} (trying again)`);
    await setStep(cfg, id, { req: err.restart ? null : `pieces-${done}`, saving: false, tries: tries + 1 });
    return { state: 'started', step: 'make' };
  }
}

// Gemini's look before anyone sees it: done, or refused (its files deleted). One that can't be looked at just now is a try.
async function lookCut(cfg, j, F, { deadline, video = null }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const bytes = video || await F.getFile(cfg, videoPath(j), { max: CUT.SOURCE_MAX, timeoutMs: left(CUT.CHECK_NEEDS_MS - 2000, 6000) });
    if (!bytes) { await failCut(cfg, j, F, 'save'); console.warn(`[studio] cut ${id}'s video is missing`); return { state: 'failed', step: 'save' }; }
    const { checkCutVideo } = await import('./inf-ai.js');
    const v = await checkCutVideo(cfg, bytes, { timeoutMs: left(1500, 13_000) });
    if (!v.ok) {
      await failCut(cfg, j, F, v.why === 'big' ? 'too_big' : 'refused');
      console.warn(v.why === 'big' ? `[studio] cut ${id} came out too big to be looked at (${(bytes.length / 1e6).toFixed(1)} MB): not shown, its files deleted`
        : `[studio] cut ${id} wasn't family-friendly (${v.why}): not shown, its files deleted`);
      return { state: 'failed', step: 'save' };
    }
    const info = mp4Info(bytes);
    const ok = await rpc(cfg, 'inf_cut_done', { p_id: id, p_bytes: bytes.length, p_sound: mp4HasSound(bytes) === true, p_seconds: wholeSeconds(info?.seconds) }, 'studio');
    if (ok !== true) {
      await F.deleteFiles(cfg, jobFiles(j)).catch(() => 0);
      return { state: 'failed', step: 'save' };
    }
    F.deleteFiles(cfg, [layerPath(j.inf_id, id)]).catch((err) => console.warn(`[studio] cut ${id}'s words' picture: ${err.message}`));
    return { state: 'done', step: 'save' };
  } catch (err) {
    const tries = n0(j.tries);
    if (tries + 1 >= JOBS.SAVE_TRIES) {
      await failCut(cfg, j, F, err.why === 'ai' ? 'check' : 'save');
      console.warn(`[studio] cut ${id} couldn't be looked at: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    console.warn(`[studio] cut ${id}'s look: ${err.message} (trying again)`);
    await setStep(cfg, id, { req: j.req, saving: true, tries: tries + 1 });
    return { state: 'saving', step: 'save' };
  }
}

// It can't be made: why (a few words for the page; nothing to give back: it was free, and its use stays counted), and what it
// kept on the way deleted (its words' picture, its pieces, a video made but not shown)
async function failCut(cfg, j, F, why) {
  await fail(cfg, j.id, why, false);
  await F.deleteFiles(cfg, jobFiles(j)).catch((err) => console.warn(`[studio] cut ${j.id}'s files: ${err.message}`));
}
