// Site-wide owner content lives in a separate row from every existing app's data.
import { rpc } from './limits.js';
import { readSession } from './session.js';
import { isVoteOwner } from './vote.js';
import { makeBurstLimit } from './burst.js';
import { emptyDocument, validateDocument, publicDocument } from '../src/owner/model.js';
import { startMediaUpload, finishMediaUpload, verifyMediaProofs } from './site-media.js';

export const siteOwnerBurst = makeBurstLimit({ max: 40, windowMs: 60_000 });
const json = (status, body, headers = { 'Cache-Control': 'no-store' }) => Response.json(body, { status, headers });
const SHARED = { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=10' };
const ready = (cfg) => Boolean(cfg.supabaseUrl && cfg.supabaseKey);
const revision = (v) => Number.isSafeInteger(v) && v >= 0;
const missing = (err) => ['PGRST202', '42P01', '42883'].includes(err.code);
function snapshot(value) {
  if (!value || !revision(value.revision)) throw new Error('Invalid saved content revision');
  const checked = validateDocument(value.document);
  if (!checked.ok) throw new Error('Invalid saved site content');
  return { document: checked.document, revision: value.revision, updatedAt: value.updatedAt ?? null };
}
async function load(cfg) { return snapshot(await rpc(cfg, 'site_content_get', {}, 'site content')); }

export async function siteContentGet(cfg) {
  if (!ready(cfg)) return json(200, { ready: false, document: emptyDocument(), revision: 0 }, SHARED);
  try {
    const current = await load(cfg);
    return json(200, { ready: true, document: publicDocument(current.document), revision: current.revision }, SHARED);
  } catch (err) {
    if (missing(err)) return json(200, { ready: false, document: emptyDocument(), revision: 0 }, SHARED);
    console.error('[owner] site content unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

export async function siteOwner(cfg, body, { visitor, now }) {
  if (!siteOwnerBurst(visitor, now)) return json(429, { error: 'too_fast' });
  const session = readSession(cfg.passSecret, body.session, now);
  if (!session) return json(401, { error: 'signed_out' });
  if (!isVoteOwner(cfg, session.wallet)) return json(403, { error: 'not_owner', ...(cfg.studioOwner ? {} : { unset: true }) });
  if (!ready(cfg)) return json(503, { error: 'not_ready' });
  try {
    if (body.action === 'site-media-start') return json(200, await startMediaUpload(cfg, body, session.wallet, now));
    if (body.action === 'site-media-finish') return json(200, await finishMediaUpload(cfg, body, session.wallet, now));
    if (body.action === 'site-owner') return json(200, { ok: true, ...(await load(cfg)) });
    if (body.action === 'site-history') {
      const rows = await rpc(cfg, 'site_content_history', {}, 'site content');
      if (!Array.isArray(rows)) throw new Error('Invalid saved history');
      return json(200, { ok: true, history: rows.filter((r) => revision(r?.revision)).slice(0, 30).map((r) => ({ revision: r.revision, updatedAt: r.updatedAt, summary: String(r.summary || '').slice(0, 240) })) });
    }
    if (!revision(body.revision)) return json(400, { error: 'refused', why: 'Reload the latest content before saving.' });
    let result;
    if (body.action === 'site-save') {
      const checked = validateDocument(body.document);
      if (!checked.ok) return json(400, { error: 'refused', why: checked.why });
      const previous = checked.document.memes?.some((m) => m.custom) ? (await load(cfg)).document.memes : [];
      const media = verifyMediaProofs(cfg, checked.document.memes, previous);
      if (!media.ok) return json(400, { error: 'refused', why: media.why });
      result = await rpc(cfg, 'site_content_put', { p_revision: body.revision, p_document: checked.document }, 'site content');
    } else if (body.action === 'site-restore') {
      if (!revision(body.targetRevision)) return json(400, { error: 'refused', why: 'Choose a saved version to restore.' });
      result = await rpc(cfg, 'site_content_restore', { p_revision: body.revision, p_target: body.targetRevision }, 'site content');
    } else return json(400, { error: 'bad_request' });
    if (result?.ok) return json(200, { ok: true, ...snapshot(result) });
    if (result?.why === 'conflict') return json(409, { error: 'conflict', why: 'The site changed in another tab. Reload the latest version before saving.', revision: result.revision });
    if (result?.why === 'gone') return json(404, { error: 'gone', why: 'That saved version is no longer available.' });
    throw new Error('The database did not confirm the content change');
  } catch (err) {
    if (err.media) return json(err.status, { error: err.error, why: err.why });
    if (missing(err)) return json(503, { error: 'not_ready' });
    console.error('[owner] site content request failed:', err.message);
    return json(503, { error: 'busy' });
  }
}
