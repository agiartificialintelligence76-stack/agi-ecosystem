// A 3D model's extra downloads (2026-10-13, the 3D tool's "More downloads"; the owner's "30 days (Recommended)"): asked for
// with its order (its choices' formats, src/studio/rules.js DL_FORMATS), made by the studio's clock once it's done, one file
// a run (server/studio.js studioClock: first on odd minutes, else when there's time), from what Meshy made (it keeps its
// files 3 days, and they're made within minutes of the model being done), kept in the studio's private bucket for DL_DAYS
// days (dl/<id>.<ext>), then deleted by the clock's tidy-up. Only its maker downloads them (server/influencer.js dl3d: a
// signed address, 2 hours, with its file's name).
//   full  the full-quality GLB: Meshy's model with every move (its described ones merged in), its textures as made
//   fbx   Meshy's own FBX of its library moves (the moves task's): for Unity, Unreal and Blender
//   usdz  Meshy's USDZ of its shape (the image task's): standing still, for AR on an iPhone or iPad
//   stl   Meshy's STL of its shape (the image task's): for 3D printing, no colors
//   obj   Meshy's OBJ and its material, with its textures, zipped (server/studio-files.js objZip)
// A file that can't be made is tried again on later runs (DL.TRIES in all), except one that's too big for the bucket (40 MB)
// or that Meshy no longer has (both: given up at once); Meshy itself away for a moment, or the owner's key, isn't a try.
import { rpc } from './limits.js';
import { meshyTask, animationUrl, animationFbxUrl, modelUrl, textureUrls } from './meshy.js';
import { getOrder, specOf } from './studio.js';
import { DL_FORMATS, dlPath, ownClip } from '../src/studio/rules.js';

export const DL = {
  TRIES: 4,                  // a format tried this many times, then given up
  LEASE_S: 90,               // one run's turn on a model's downloads
  NEEDS_MS: 12_000,          // a download is made only with this much time left in the run
  TIDY: 20,                  // models whose downloads are deleted per tidy-up
};
const left = (deadline, reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
const gone = (what) => Object.assign(new Error(`Meshy's answer has no ${what}`), { gone: true });

// One format's file, made from what Meshy made. → a Buffer · throws (tooBig, gone, or why: Meshy's)
export async function makeFormat(cfg, o, format, F, { deadline }) {
  const tasks = o.tasks && typeof o.tasks === 'object' ? o.tasks : {};
  const task = async (step) => {
    if (!tasks[step]) throw gone(`${step} task`);
    const t = await meshyTask(cfg, step, tasks[step], { timeoutMs: left(deadline, 9000, 5000) });
    if (t.status !== 'SUCCEEDED') throw gone(`${step} result`);
    return t.task;
  };
  const read = (url, max = F.DL_MAX) => F.fromMeshy(url, { max, timeoutMs: left(deadline, 4000, 12_000) });
  if (format === 'full') {
    const own = specOf(o).own;
    const [moves, ...applied] = await Promise.all([task('moves'), ...own.map((_, i) => task(`apply${i + 1}`))]);
    const urls = [animationUrl(moves), ...applied.map(animationUrl)];
    if (urls.some((u) => !u)) throw gone('model');
    const [main, ...extras] = await Promise.all(urls.map((u) => read(u, 80_000_000)));
    return (await F.fullGlb(main, { extras: own.map((m, i) => ({ name: ownClip(m.name), bytes: extras[i] })) })).bytes;
  }
  if (format === 'fbx') {
    const url = animationFbxUrl(await task('moves'));
    if (!url) throw gone('FBX');
    return read(url);
  }
  if (format === 'usdz' || format === 'stl') {
    const url = modelUrl(await task('image'), format);
    if (!url) throw gone(format.toUpperCase());
    return read(url);
  }
  if (format === 'obj') {
    const t = await task('image');
    const objUrl = modelUrl(t, 'obj'), mtlUrl = modelUrl(t, 'mtl'), tex = textureUrls(t);
    if (!objUrl) throw gone('OBJ');
    const kinds = Object.keys(tex);
    const [obj, mtl, ...pics] = await Promise.all([read(objUrl), mtlUrl ? read(mtlUrl, 1_000_000) : null, ...kinds.map((k) => read(tex[k]))]);
    const textures = Object.fromEntries(kinds.map((k, i) => [k, pics[i]]));
    let zip = F.objZip({ obj, mtl, textures });
    // too big with every texture: its color alone (its shape, material and colors still there)
    if (zip.length > F.DL_MAX && textures.base_color) zip = F.objZip({ obj, mtl, textures: { base_color: textures.base_color } });
    if (zip.length > F.DL_MAX) throw Object.assign(new Error(`files: its OBJ zipped is ${(zip.length / 1e6).toFixed(1)} MB`), { tooBig: true });
    return zip;
  }
  throw new Error(`files: no format ${format}`);
}

// One model's next download, made and kept. → { state: 'busy' | 'none' | 'waiting' | 'done' | 'failed' | 'again', format? }
export async function dlTick(cfg, id, { deadline = Date.now() + 19_000, files = null } = {}) {
  if (!await rpc(cfg, 'studio_dl_lease', { p_id: id, p_secs: DL.LEASE_S }, 'studio')) return { state: 'busy' };
  const o = await getOrder(cfg, id);
  const todo = Array.isArray(o?.formats_todo) ? o.formats_todo.filter((f) => Object.hasOwn(DL_FORMATS, f)) : [];
  if (!o || o.status !== 'done' || !todo.length) return { state: 'none' };
  const format = todo[0];
  const F = files || await import('./studio-files.js');
  const put = (ok, bytes, final) => rpc(cfg, 'studio_dl_put', { p_id: id, p_format: format, p_ok: ok, p_bytes: bytes, p_final: final }, 'studio');
  try {
    const bytes = await makeFormat(cfg, o, format, F, { deadline });
    if (deadline - Date.now() < 1500) throw new Error('no time left to keep it');
    await F.putFile(cfg, dlPath(id, format), bytes, DL_FORMATS[format].type, { timeoutMs: left(deadline, 500, 12_000) });
    if (!await put(true, bytes.length, false)) {
      // no longer waited for (its model deleted or taken down meanwhile, or its days over): its file goes again
      await F.deleteFiles(cfg, [dlPath(id, format)]).catch(() => {});
      return { state: 'none', format };
    }
    console.log(`[studio] ${id}'s ${format} is ready: ${(bytes.length / 1e6).toFixed(2)} MB`);
    return { state: 'done', format };
  } catch (err) {
    if (['key', 'credits', 'busy', 'meshy'].includes(err.why)) return { state: 'waiting', format };   // its lease ends by itself
    const final = err.tooBig === true || err.gone === true || Number(o.format_tries) + 1 >= DL.TRIES;
    await put(false, null, final);
    console.warn(`[studio] ${id}'s ${format} ${final ? "couldn't be made" : 'failed (trying again)'}: ${err.message}`);
    return { state: final ? 'failed' : 'again', format };
  }
}

// The tidy-up: the downloads past their days (and a taken-down or deleted model's), their files deleted. → how many models
export async function dlTidy(cfg, { files = null } = {}) {
  const list = await rpc(cfg, 'studio_dl_expired', { p_limit: DL.TIDY }, 'studio');
  const ids = (Array.isArray(list) ? list : []).filter((id) => typeof id === 'string');
  if (!ids.length) return 0;
  const F = files || await import('./studio-files.js');
  let n = 0;
  for (const id of ids) {
    try {
      await F.deleteFiles(cfg, Object.keys(DL_FORMATS).map((f) => dlPath(id, f)));
      if (await rpc(cfg, 'studio_dl_clear', { p_id: id }, 'studio')) n += 1;
    } catch (err) {
      console.warn(`[studio] ${id}'s extra downloads (next tidy-up): ${err.message}`);
    }
  }
  return n;
}

// The clock's turn (server/studio.js studioClock): one download made when there's time for it; the tidy-up every half hour.
// → { made?, tidy? }
export async function dlClock(cfg, { now = Date.now(), deadline = Date.now() + 19_000, files = null } = {}) {
  const out = {};
  if (deadline - Date.now() >= DL.NEEDS_MS) {
    const due = await rpc(cfg, 'studio_dl_due', { p_limit: 1 }, 'studio');
    const id = Array.isArray(due) ? due.find((x) => typeof x === 'string') : null;
    if (id) out.made = await dlTick(cfg, id, { deadline, files });
  }
  if (new Date(now).getUTCMinutes() % 30 === 0 && deadline - Date.now() >= 3000) out.tidy = await dlTidy(cfg, { files });
  return out;
}
