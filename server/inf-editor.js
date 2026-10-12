// AGI Studio's photo editor (2026-10-12, the editor; the owner's choices: "Photo editor (Recommended)": free, no AI, in its
// maker's own browser, src/studio/views/photo-editor.js; "New photo + download (Recommended)"). A download never comes here
// (the page draws the share mark itself). Saving one as a new photo of the same influencer, next to the one it's from, is two
// steps, like an upload:
//   1. POST { action: 'inf-photo-open', session, from, shape, words } → openSave(): the photo it's from (its maker's own,
//      done, shown, never deleted or taken down, of a ready influencer), its shape (a photo shape; an X banner only from one,
//      and it stays one), its words (each like a meme's line: PG-13, the studio's word rules, never about money), a save still
//      left today (inf_tool_take, only asked) → a ticket for it (30 minutes) and its new id
//   2. POST ?inf-photo=<ticket> (its JPEG) → receiveSave(): made a plain JPEG (no metadata), its size fitting its shape, one
//      save counted (EDITOR.PER_DAY a wallet, EDITOR.SITE_DAY the whole site: each look costs about $0.001), looked at by
//      Gemini (checkEdited: family-friendly, the words in it too) BEFORE anything is kept, then its two files and its row
//      (inf_photo_add: a done photo, free, made from that one, the editor's). Its id can be saved once.
import { rpc } from './limits.js';
import { tidy, trouble } from './studio-words.js';
import { MONEY } from './inf-words.js';
import { getJob, picPath, picturesOf } from './inf-jobs.js';
import { ID, takenDown } from './influencer.js';
import { studioWallet } from './studio.js';
import { EDITOR, PHOTO_SHAPES, PICTURE } from '../src/studio/rules.js';
import { sizeFits } from '../src/studio/photo-edit.js';

// ---------- its words ----------
// Each text on it, as typed: none, or up to EDITOR.LAYERS of EDITOR.TEXT_MAX characters, each checked like a meme's line.
// → { ok: true, words } (tidied, empty ones left out) or { ok: false, field: 'text', why: 'bad' | 'long' | 'money' | the
// words' trouble }
export function checkEditorWords(words) {
  if (words === undefined || words === null) return { ok: true, words: [] };
  if (!Array.isArray(words) || words.length > EDITOR.LAYERS || words.some((w) => typeof w !== 'string')) return { ok: false, field: 'text', why: 'bad' };
  const out = [];
  for (const w of words) {
    const t = tidy(w);
    if (!t) continue;
    if ([...t].length > EDITOR.TEXT_MAX) return { ok: false, field: 'text', why: 'long' };
    const tr = trouble(t);
    if (tr) return { ok: false, field: 'text', why: tr };
    if (MONEY.test(t)) return { ok: false, field: 'text', why: 'money' };
    out.push(t);
  }
  return { ok: true, words: out };
}

// ---------- 1: opening a save ----------
// → { ok: true, job, ticket, left } or { ok: false, field?, why: 'bad' | 'image' | 'gone' | 'not_yours' | 'not_ready' |
// 'too_many' | 'busy_day' | the words' }
export async function openSave(cfg, { wallet, from, shape, words, id }) {
  if (!ID.test(String(from)) || !ID.test(String(id)) || typeof shape !== 'string' || !Object.hasOwn(PHOTO_SHAPES, shape)) return { ok: false, why: 'bad' };
  const w = checkEditorWords(words);
  if (!w.ok) return w;
  const code = studioWallet(cfg.passSecret, wallet);
  const photo = await getJob(cfg, from);
  if (!photo || photo.kind !== 'photo' || !ID.test(String(photo.inf_id))) return { ok: false, why: 'image' };
  if (photo.wallet_code !== code) return { ok: false, why: 'not_yours' };
  if (photo.status !== 'done' || photo.hidden === true || photo.deleted_at || takenDown(cfg, photo.id)) return { ok: false, why: 'image' };
  if (photo.inf_status === 'deleted' || photo.inf_hidden === true || takenDown(cfg, photo.inf_id)) return { ok: false, why: 'gone' };
  if (photo.inf_status !== 'ready') return { ok: false, why: 'not_ready' };
  // (an X banner stays one; nothing else becomes one)
  if ((photo.shape === 'banner') !== (shape === 'banner')) return { ok: false, why: 'bad' };
  const left = await rpc(cfg, 'inf_tool_take', { p_wallet: code, p_tool: 'photo', p_per_day: EDITOR.PER_DAY, p_site_cap: EDITOR.SITE_DAY, p_take: false }, 'studio');
  if (left?.ok !== true) return { ok: false, why: ['too_many', 'busy_day'].includes(left?.why) ? left.why : 'busy' };
  const { makeTicket, UPLOAD } = await import('./inf-uploads.js');
  const ticket = makeTicket(cfg.passSecret, 'pe', { j: id, i: photo.inf_id, f: from, w: code, s: shape }, Date.now(), UPLOAD.TICKET_MS);
  return { ok: true, job: id, ticket, left: Number(left.left) || 0 };
}

// ---------- 2: its picture ----------
// t: its ticket read ({ j: its id, i: its influencer, f: the photo it's from, w: its wallet's code, s: its shape }) · body: its
// bytes. → { status, body } for the answer
export async function receiveSave(cfg, t, body) {
  if (!ID.test(String(t.j)) || !ID.test(String(t.i)) || !ID.test(String(t.f)) || !Object.hasOwn(PHOTO_SHAPES, t.s)) return { status: 401, body: { error: 'ticket' } };
  if (body.length > PICTURE.MAX_BYTES) return { status: 413, body: { error: 'size' } };
  // its id is saved once (the same ticket again: nothing looked at, nothing kept)
  if (await getJob(cfg, t.j)) return { status: 409, body: { error: 'done' } };
  const { plainJpeg } = await import('./inf-uploads.js');
  const { loadSharp, putFile, deleteFiles } = await import('./studio-files.js');
  const sharp = await loadSharp();
  const jpeg = await plainJpeg(body, { px: EDITOR.PX, quality: 90, sharp });
  if (!jpeg) return { status: 422, body: { error: 'picture' } };
  const meta = await sharp(jpeg).metadata().catch(() => null);
  if (!meta || !sizeFits(t.s, meta.width, meta.height)) return { status: 422, body: { error: 'size' } };
  // one save counted, then its look (each costs about $0.001: a refused one counts too)
  const take = await rpc(cfg, 'inf_tool_take', { p_wallet: t.w, p_tool: 'photo', p_per_day: EDITOR.PER_DAY, p_site_cap: EDITOR.SITE_DAY, p_take: true }, 'studio');
  if (take?.ok !== true) return { status: 429, body: { error: ['too_many', 'busy_day'].includes(take?.why) ? take.why : 'busy' } };
  let verdict;
  try {
    const { checkEdited } = await import('./inf-ai.js');
    verdict = await checkEdited(cfg, jpeg);
  } catch (err) {
    console.warn(`[studio] an edited photo couldn't be looked at: ${err.message}`);
    return { status: 503, body: { error: 'ai' } };
  }
  if (!verdict.ok) return { status: 422, body: { error: 'refused', why: verdict.why } };
  const made = await picturesOf(sharp, jpeg, { banner: t.s === 'banner' });
  if (!made) return { status: 422, body: { error: 'picture' } };
  const names = [picPath(t.i, t.j, 0), picPath(t.i, t.j, 0, 'webp')];
  await Promise.all([putFile(cfg, names[0], made.jpg, 'image/jpeg', { timeoutMs: 9000 }), putFile(cfg, names[1], made.webp, 'image/webp', { timeoutMs: 9000 })]);
  const r = await rpc(cfg, 'inf_photo_add', { p_job: t.j, p_inf: t.i, p_wallet: t.w, p_from: t.f, p_shape: t.s, p_bytes: made.jpg.length }, 'studio');
  if (r?.ok === true) return { status: 200, body: { ok: true, job: t.j } };
  // (saved already, by the same ticket at the same time: its files are that one's) else not kept: its files deleted
  if (r?.why === 'taken') return { status: 409, body: { error: 'done' } };
  await deleteFiles(cfg, names).catch((err) => console.warn(`[studio] an edited photo not kept, its files: ${err.message}`));
  const why = String(r?.why || 'busy');
  return { status: { bad: 400, gone: 404, not_yours: 403, banned: 403, not_ready: 409, image: 409 }[why] || 503, body: { error: why } };
}
