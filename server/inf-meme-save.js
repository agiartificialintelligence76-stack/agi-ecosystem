// AGI Studio's meme editor (2026-10-14, meme templates; the owner: "even after the result they can still edit the text after,
// change font, change the text color", then "Save as a new meme (Recommended)"). Its maker changes a template meme's words in
// its own browser (their text, font, color, outline, background, size and place: src/studio/views/meme-editor.js, drawn with
// the same fonts and layout as here: src/studio/meme-layout.js), and saves it as a new meme next to it, free, the first one
// kept. One step: our server draws the words itself, so nothing is uploaded.
//   POST { action: 'inf-meme-save', session, from, layers } → saveMeme(): the meme it's from (its maker's own template meme:
//   done, shown, never deleted or taken down, anyone else in it still to be seen, of a ready influencer), its words (the page's
//   own rules, checkLayers; the studio's words: PG-13, nobody real by name, never about money, AGI-1's name only when she's in
//   it; every letter one our fonts draw), never as they were ("same"), its words drawn on the meme's picture without words
//   (<from>.pic.jpg) on its template's canvas, one save counted (the photo editor's own: EDITOR.PER_DAY a wallet, EDITOR.SITE_DAY
//   the whole site; each look costs about $0.001, a refused one counts too), looked at by Gemini (checkMeme: family-friendly, its
//   words too) BEFORE anything is kept, then its files (the meme, its small copy and its own picture without words: what its
//   editor, an edit, someone added or its 5-second video start from, so it never depends on the meme it came from) and its row
//   (supabase/influencers.sql inf_meme_add: a done template meme of the same influencer, free, made from that one, the
//   editor's, with its share mark where its new words aren't).
import { rpc } from './limits.js';
import { checkLayerWords } from './inf-words.js';
import { getJob, picPath, memePicPath, isTemplate } from './inf-jobs.js';
import { ID, takenDown } from './influencer.js';
import { studioWallet } from './studio.js';
import { EDITOR } from '../src/studio/rules.js';
import { templateOf, checkLayers, layersCaption } from '../src/studio/memes.js';

// its words as they were (each layer's keys in checkLayers' own order, so the same words in the same places compare equal)
const sameLayers = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// → { ok: true, job, left } or { ok: false, field?, n?, chars?, why: 'bad' | 'image' | 'gone' | 'not_yours' | 'not_ready' |
// 'same' | 'source' | 'too_many' | 'busy_day' | 'busy' | 'ai' | 'refused' (reason) | 'banned' | the words' }
export async function saveMeme(cfg, { wallet, from, layers, id }) {
  if (!ID.test(String(from)) || !ID.test(String(id))) return { ok: false, why: 'bad' };
  const L = checkLayers(layers);
  if (!L.ok) return { ok: false, field: 'layers', n: L.n, why: L.why };
  const code = studioWallet(cfg.passSecret, wallet);
  const meme = await getJob(cfg, from);
  if (!meme || !isTemplate(meme) || !ID.test(String(meme.inf_id))) return { ok: false, why: 'image' };
  if (meme.wallet_code !== code) return { ok: false, why: 'not_yours' };
  // (hidden: taken down, or someone else in it who may no longer be seen: getJob and inf_job_get say so)
  if (meme.status !== 'done' || meme.hidden === true || meme.deleted_at || takenDown(cfg, meme.id)) return { ok: false, why: 'image' };
  if (meme.inf_status === 'deleted' || meme.inf_hidden === true || takenDown(cfg, meme.inf_id)) return { ok: false, why: 'gone' };
  if (meme.inf_status !== 'ready') return { ok: false, why: 'not_ready' };
  const tpl = templateOf(meme.meme);
  const was = checkLayers(meme.layers);
  if (!tpl || !was.ok) return { ok: false, why: 'image' };
  const w = checkLayerWords(L.layers, { agi1: meme.agi1 === true });
  if (!w.ok) return w;
  if (sameLayers(was.layers, L.layers)) return { ok: false, why: 'same' };
  const R = await import('./meme-render.js');
  const miss = await R.undrawable(L.layers);
  if (miss) return { ok: false, field: 'layers', n: miss.n, why: 'chars', chars: miss.chars.slice(0, 8) };
  // its picture without words (a meme made before 2026-10-14's templates has none: it can't be edited here)
  const F = await import('./studio-files.js');
  const pic = await F.getFile(cfg, memePicPath(meme.inf_id, from), { timeoutMs: 8000 });
  if (!pic) return { ok: false, why: 'source' };
  const sharp = await F.loadSharp();
  const meta = await sharp(pic, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) return { ok: false, why: 'source' };
  const made = await R.renderMeme(sharp, await R.composeBase(sharp, pic, tpl), L.layers, tpl);
  const caption = layersCaption(L.layers);
  const mark = await R.markSpotFor(L.layers, tpl, 'photo');
  // one save counted, then its look (each costs about $0.001: a refused one counts too)
  const take = await rpc(cfg, 'inf_tool_take', { p_wallet: code, p_tool: 'photo', p_per_day: EDITOR.PER_DAY, p_site_cap: EDITOR.SITE_DAY, p_take: true }, 'studio');
  if (take?.ok !== true) return { ok: false, why: ['too_many', 'busy_day'].includes(take?.why) ? take.why : 'busy' };
  let verdict;
  try {
    const { checkMeme } = await import('./inf-ai.js');
    verdict = await checkMeme(cfg, made.jpg, caption);
  } catch (err) {
    console.warn(`[studio] a meme from the meme editor couldn't be looked at: ${err.message}`);
    return { ok: false, why: 'ai' };
  }
  if (!verdict.ok) return { ok: false, why: 'refused', reason: verdict.why };
  const names = [picPath(meme.inf_id, id, 0), picPath(meme.inf_id, id, 0, 'webp'), memePicPath(meme.inf_id, id)];
  let r, asked = false;
  try {
    await Promise.all([
      F.putFile(cfg, names[0], made.jpg, 'image/jpeg', { timeoutMs: 9000 }),
      F.putFile(cfg, names[1], made.webp, 'image/webp', { timeoutMs: 9000 }),
      F.putFile(cfg, names[2], pic, 'image/jpeg', { timeoutMs: 9000 }),
    ]);
    asked = true;
    r = await rpc(cfg, 'inf_meme_add', {
      p_job: id, p_inf: meme.inf_id, p_wallet: code, p_from: from, p_layers: L.layers, p_caption: caption, p_mark: mark,
      p_bytes: made.jpg.length + pic.length,
    }, 'studio');
  } catch (err) {
    // its files never left behind when its row can't have been kept: not all of them put, or no inf_meme_add to keep it (an
    // older influencers.sql: PGRST202). A database that didn't answer may have kept it, so they stay then.
    if (!asked || err?.code === 'PGRST202') await F.deleteFiles(cfg, names).catch((e) => console.warn(`[studio] a meme from the meme editor not kept, its files: ${e.message}`));
    throw err;
  }
  if (r?.ok === true) return { ok: true, job: id, left: Number(take.left) || 0 };
  // not kept: its files deleted (its id is a new one each time: "taken" never happens but by chance, and then those files are
  // that one's)
  if (r?.why !== 'taken') await F.deleteFiles(cfg, names).catch((err) => console.warn(`[studio] a meme from the meme editor not kept, its files: ${err.message}`));
  const why = String(r?.why || 'busy');
  return { ok: false, why: why === 'taken' ? 'busy' : why };
}
