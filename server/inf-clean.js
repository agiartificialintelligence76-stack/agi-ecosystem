// AGI Studio's clean downloads for holders (2026-10-12, the owner: "can you put watermark when they download or export their
// vid,photos it will be removed if they hold $agi atleast 1000"; the owner's choices: "Our pill, as now", "Hidden AI tag",
// "Same as the rest"). Everyone's downloads carry our pill ("Made with AGI Studio · AI-generated"), as before; a creation's own
// maker holding STUDIO_CLEAN_AGI $AGI or more (1,000 by default; held, or burned for messages) downloads its own without it.
// Every download, with the pill or without, says inside its file that it's AI-made (src/studio/ai-tag.js). Since 2026-10-13
// (the owner: "when i open a video and photo, there should be a button that says remove watermark"; the owner's choice:
// "Everyone, holders use it") its maker asks with "Remove watermark", next to Download (which always keeps it).
//   POST { action: 'inf-dl', session, job, n? } (server/inf-api.js) → { url, clean, need, why? }: the address to download it
//   from: a clean one (`?inf-clean=<ticket>`, 10 minutes, for that creation and that wallet) or the marked one, as everyone's.
//   GET ?inf-clean=<ticket> → a photo: its picture as the page shows it (no pill) with our tag, never kept by a CDN; a video:
//   to its own file (no pill: the share mark's clock only marks its copy), tagged when it was kept.
// A long video and a video saved from the video editor carry the pill in the video itself (made with it), so theirs stays.
import { checkHolding } from './chain.js';
import { burnedAgi } from './burn.js';
import { studioWallet } from './studio.js';
import { makeTicket, readTicket } from './inf-uploads.js';
import { getJob, picPath, videoPath, aiTagged } from './inf-jobs.js';
import { ownMark } from '../src/studio/video-edit.js';
import { ID } from './influencer.js';

export const CLEAN = Object.freeze({ TICKET_MS: 10 * 60_000, OK_MS: 10 * 60_000, FAIL_MS: 60_000, CRUSH_AGI: 10_000 });
const PHOTO_KINDS = ['photo', 'body'];
const VIDEO_KINDS = ['video', 'trend'];
const held = new Map();                  // (wallet → { agi, ok, until }: one chain read per wallet every 10 minutes per server copy)
export const _resetClean = () => held.clear();

// The $AGI a creation's maker needs to download it clean (0: everyone's downloads carry the pill)
export const cleanNeed = (cfg) => Math.max(0, Math.floor(Number(cfg.infCleanAgi) || 0));

// Whether this signed-in wallet holds enough now: a Crush or a Soulmate (10,000+, read with its session) without asking the
// chain again; otherwise its $AGI held and burned, read on Robinhood Chain (kept 10 minutes; 1 minute when it couldn't be read)
export async function holdsEnough(cfg, w, { now = Date.now() } = {}) {
  const need = cleanNeed(cfg);
  if (!need || !w?.wallet) return false;
  if (Number(w.level) >= 2 && need <= CLEAN.CRUSH_AGI) return true;
  const key = String(w.wallet).toLowerCase();
  const kept = held.get(key);
  if (kept && kept.until > now) return kept.ok && kept.agi >= need;
  let burned = 0;
  try { burned = await burnedAgi(cfg, w.wallet); } catch { burned = 0; }
  const r = await checkHolding(w.wallet, cfg.env || process.env, burned);
  const ok = Boolean(r?.checked);
  held.set(key, { agi: Number(r?.agi) || 0, ok, until: now + (ok ? CLEAN.OK_MS : CLEAN.FAIL_MS) });
  if (held.size > 5000) held.delete(held.keys().next().value);
  return ok && (Number(r?.agi) || 0) >= need;
}

// A creation as anyone may see it (its influencer shown, never taken down)
const shown = (cfg, j) => j && j.status === 'done' && j.hidden !== true && !j.deleted_at && !cfg.studioHide?.has(j.id)
  && j.inf_status !== 'deleted' && j.inf_hidden !== true && j.inf_banned !== true && !cfg.studioHide?.has(j.inf_id);
// What can come clean: a photo (a meme, an X banner, one from the photo editor, its full body) or a video and a trend video
// whose own file is without the pill (never a long one or one from the video editor: made with it)
export function cleanable(j) {
  if (PHOTO_KINDS.includes(j?.kind)) return true;
  return VIDEO_KINDS.includes(j?.kind) && !ownMark(j);
}
const markedUrl = (j, n) => (PHOTO_KINDS.includes(j.kind)
  ? `/api/launch?inf-dl=${j.inf_id}/${j.id}-${n}.jpg` : `/api/launch?inf-video-dl=${j.id}.mp4`);

// POST 'inf-dl': where its maker downloads one of its own creations from
export async function downloadFor(cfg, w, body, { now = Date.now() } = {}) {
  if (typeof body.job !== 'string' || !ID.test(body.job)) return { status: 400, body: { error: 'bad_request' } };
  const n = body.n === undefined ? 0 : Number(body.n);
  if (!Number.isInteger(n) || n < 0 || n > 3) return { status: 400, body: { error: 'bad_request' } };
  const j = await getJob(cfg, body.job);
  if (!shown(cfg, j) || ![...PHOTO_KINDS, ...VIDEO_KINDS].includes(j.kind)) return { status: 404, body: { error: 'gone' } };
  if (PHOTO_KINDS.includes(j.kind) && n >= Math.max(1, Number(j.files) || 0)) return { status: 404, body: { error: 'gone' } };
  if (j.wallet_code !== studioWallet(cfg.passSecret, w.wallet)) return { status: 403, body: { error: 'not_yours' } };
  const need = cleanNeed(cfg);
  const answer = (clean, why) => ({ status: 200, body: {
    url: clean ? `/api/launch?inf-clean=${makeTicket(cfg.passSecret, 'dl', { j: j.id, n, w: String(w.wallet).toLowerCase() }, now, CLEAN.TICKET_MS)}` : markedUrl(j, n),
    clean, need, ...(why ? { why } : {}),
  } });
  if (!need) return answer(false, 'off');
  if (!cleanable(j)) return answer(false, 'made_with_it');
  return (await holdsEnough(cfg, w, { now })) ? answer(true) : answer(false, 'holding');
}

// GET ?inf-clean=<ticket>
export async function cleanFile(cfg, value, { now = Date.now() } = {}) {
  const t = readTicket(cfg.passSecret, 'dl', String(value || ''), now);
  if (!t || typeof t.j !== 'string' || !ID.test(t.j) || !Number.isInteger(t.n)) return { status: 400, body: { error: 'bad_request' } };
  const j = await getJob(cfg, t.j);
  if (!shown(cfg, j) || !cleanable(j)) return { status: 404, body: { error: 'gone' } };
  if (PHOTO_KINDS.includes(j.kind) && t.n >= Math.max(1, Number(j.files) || 0)) return { status: 404, body: { error: 'gone' } };
  const F = await import('./studio-files.js');
  if (VIDEO_KINDS.includes(j.kind)) {
    const url = await F.signedUrl(cfg, videoPath(j), { expiresIn: 2 * 3600, download: `${nameOf(j)}-${j.kind === 'video' ? 'video' : 'trend'}.mp4` });
    return url ? { status: 302, location: url } : { status: 404, body: { error: 'gone' } };
  }
  const bytes = await F.getFile(cfg, picPath(j.inf_id, j.id, t.n), { max: 4_000_000 });
  if (!bytes) return { status: 404, body: { error: 'gone' } };
  const tagged = aiTagged(bytes);
  const what = j.kind === 'body' ? 'full-body' : j.shape === 'banner' ? 'X-banner' : j.meme ? 'meme' : 'photo';
  return { status: 200, bytes: tagged, name: `${nameOf(j)}-${what}${t.n ? `-${t.n + 1}` : ''}.jpg` };
}
const nameOf = (j) => String(j.inf_name || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'AGI-Studio';
