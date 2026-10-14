// AGI Studio: an influencer's own page (studio.agi1.app/i/<id>), like a creator's profile: its look, its numbers, its photos
// and videos (with their hearts, round 2), its 3D models. Anyone with its link sees a ready one; its own wallet also sees it
// while it's made (its 4 looks to pick from). Round 3 (2026-10-10, the owner's "Pro tool layout"): its own wallet makes
// things with it in a workspace (views/workspace.js): the tools in the panel on the left (Photo · Trend · Video · 3D · Coin,
// each a form with a footer that stays: what it costs and its button), its profile and its gallery on the right; on a phone,
// the tools slide up over its gallery. What it makes: photos, trend videos (round 2: put into real-looking clips), videos, a
// 3D model (in credits, or free for a big burn: round 2), a coin with its face, and a boost in Explore (round 2: a burn). Its
// page asks again every few seconds while something is being made (each ask moves it along one step on our server), and
// takes the posters of its new videos (a frame, here).
import { h, icon, btn, linkBtn, sheet, segmented, chips, cardPick, say, busy, pic, copyText, nextId, put, add, focusPlace, focusBack } from '../ui.js';
import {
  infPic, infVideo, fileUrl, trendOf, trendPrompt, creditsText, SHAPES, PHOTO_SHAPES, BANNER, SCENE_MIN, SCENE_MAX, INF_STYLES, CLIP, clankProfileUrl,
  PHOTO_MODELS, PHOTO_QUALITY, VIDEO_MODELS, ANIME_QUALITY, MEMES, MEME_LINE_MAX, REFS, photoCredits, videoCredits, videoPlan, jobPlan,
  jobStep, startPhotos, drawnStyle, videoSpec, editSpec, EDIT, modelCost, burnable, modelTimes, isDefaultSpec, modelSpec,
  WITH_AGI1, refsFor, herPhotos, mentionsAgi1,
} from '../rules.js';
import {
  makingText, failText, jobTitle, jobStateText, modelText, wordsText, errorText, coinText, upErrorText, leftText, compact,
  priceOf, shareInfUrl, dayText, PHOTO_IDEAS, BANNER_IDEAS, VIDEO_IDEAS, num, likesText, progressKind, BANNED_TEXT, secondsText,
  leftWords, ANIME_WHY, againErrorText, againMadeText, deleteJobText, deletedText, tryAgainOk, creationWord, EDIT_IDEAS, editNote, editMadeText,
  specSummary, modelPriceText, MODEL_FREE_LINE, modelTimeText, specFieldText,
  herNote, HER_CLASSIC_WHY, HER_NAME_HINT, HER_NO_PHOTO, AGI1_IDEAS, AGI1_VIDEO_IDEAS, addHerNote, addHerMadeText,
} from '../app-words.js';
import { progressBar } from '../progress.js';
import { readClip, clipText, uploadClip, makePosters, shrinkPicture, uploadRef } from '../media.js';
import { INSTANT, INSTANT_MAKES, MEME_READY, memeInputs, instantOn, setInstant, instantSeen, markInstantSeen } from '../instant.js';
import { trendTile, videoSheet, photoSheet, reportSheet, confirmSheet, mediaTile, noteLikes, burnSheet, boostInf, captionSheet } from './shared.js';
import { workspace, costLine, goButton } from './workspace.js';
import { pickPicture, framedPic } from './frame.js';
import { photoEditor } from './photo-editor.js';
import { videoEditor } from './video-editor.js';
import { modelState, specOf, priceSpecOf, modelChoices } from './model-tool.js';

const POLL_MS = 5000;
const visible = () => document.visibilityState === 'visible';

// (round 4, phase 4) the reference pictures this wallet uploaded on this visit (each good for a day at our server): shared by
// its tools, and by its other influencers' pages; dropped when another wallet signs in. [{ id, url (its small copy here, a
// blob: address), at }]
const REF_TTL_MS = 23 * 3600e3;
const refStore = { wallet: null, list: [] };
function refsOf(wallet) {
  if (refStore.wallet !== wallet) {
    for (const r of refStore.list) URL.revokeObjectURL(r.url);
    refStore.wallet = wallet;
    refStore.list = [];
  }
  const now = Date.now();
  refStore.list = refStore.list.filter((r) => {
    if (now - r.at < REF_TTL_MS) return true;
    URL.revokeObjectURL(r.url);
    return false;
  });
  return refStore.list;
}
// Instant's explainer, once a visit when this browser keeps nothing
let instantExplained = false;
// a meme's scene ideas (what the picture shows), from the ready-made memes
const MEME_IDEAS = MEME_READY.map((m) => m.scene);
const making = (s) => s === 'paid' || s === 'making';
const SHAPE_CHOICES = Object.entries(SHAPES).map(([k, v]) => [k, `${v.name} ${v.ratio}`]);
// (round 4) a photo may also be an X banner, cut to X's own header size on our server
const PHOTO_SHAPE_CHOICES = Object.entries(PHOTO_SHAPES).map(([k, v]) => [k, `${v.name} ${v.ratio}`]);
const isBanner = (j) => j?.kind === 'photo' && j.shape === 'banner';

export async function render(ctx, route, root) {
  const id = route.id;
  // (2026-10-12) lookAgain: asked to load while a look was on its way (its answer may be from before what was just done: Make
  // another, Delete), so one more look follows it
  let page = null, loading = false, lookAgain = false, first = true, pollTimer = null;
  // (2026-10-12) where the keyboard goes when its gallery is drawn again after Make another or Delete, if it was lost on the
  // way (a busy button gives it up; a sheet closes onto a tile drawn again meanwhile): { place (ui.js focusPlace's), until }
  let focusNext = null;
  const postersTried = new Set();
  const sigs = {};

  // its page: the workspace's shell, its panel (the tools) only for its own wallet once it's ready
  const ws = workspace(ctx, root, { title: 'Make', open: false });
  ws.setPanel(false);
  const skeleton = h('div', { class: 'sa-inf-skel', 'aria-hidden': 'true' }, h('div', { class: 'sa-skel sa-skel-head' }), h('div', { class: 'sa-skel sa-skel-grid' }));
  const back = h('a', { class: 'sa-back', href: ctx.href('/explore'), dataset: { saLink: '' } }, icon('back'), h('span', { text: 'Explore' }));
  const head = h('header', { class: 'sa-profile' });
  const makingBox = h('section', { class: 'sa-card sa-making', hidden: true, 'aria-live': 'polite' });
  // (2026-10-11) data-guide: where its guides' arrows point (src/studio/guide-steps.js: its looks, its tools)
  const galleryBox = h('section', { class: 'sa-section sa-inf-gallery', hidden: true, 'aria-labelledby': 'sa-gal-h', dataset: { guide: 'creations' } });
  const models = h('section', { class: 'sa-section', hidden: true, 'aria-labelledby': 'sa-3d-h' });
  const cta = h('section', { class: 'sa-card sa-cta', hidden: true },
    h('p', { class: 'sa-cta-title', text: 'Make your own AI influencer' }),
    h('p', { class: 'sa-muted', text: 'Design one in a few taps, or start from a photo: photos, trend videos, 3D and more.' }),
    linkBtn('Create one', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '' } }));
  const note = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  // (round 4, phase 2) its own wallet banned: said here (no tools: it makes nothing), with a ticket to ask why
  const bannedBox = h('div', { class: 'sa-banner sa-banner-warn', role: 'status', hidden: true },
    h('p', { text: `${BANNED_TEXT} Its pictures and videos are hidden too, until a moderator lifts the ban.` }),
    linkBtn('Open a support ticket', ctx.href('/help?new=account'), { kind: 'ghost', size: 'sm', icon: 'inbox', dataset: { saLink: '' } }));
  add(ws.main, h('div', { class: 'sa-inf' }, back, skeleton, note, bannedBox, head, makingBox, galleryBox, models, cta));

  const inf = () => page?.influencer;
  const mine = () => inf()?.mine === true;
  const banned = () => mine() && inf()?.banned === true;
  const priv = () => inf()?.private === true || inf()?.face === true;
  const price = (what) => priceOf(what, { prices: ctx.me?.prices, level: ctx.level });
  // (2026-10-13) the 3D tool's choices, kept while the page is open (its panel is drawn again on many looks), and whether a
  // Soulmate's free 3D model this month is still to use (our server says, inf-me's freeModel: until it does, as it was)
  let model3d = modelState();
  const soulmateFree = () => ctx.level === 3 && ctx.me?.freeModel !== false;

  // ---------- loading (its own wallet: inf-look moves one thing along; anyone: the public page) ----------
  async function load() {
    if (loading) { lookAgain = true; return; }
    loading = true;
    lookAgain = false;
    let r = ctx.session ? await ctx.act('inf-look', { id }) : null;
    if (!r || (!r.ok && r.status !== 404 && r.status !== 400)) r = await ctx.getJson(`inf=${id}`);
    loading = false;
    if (!ctx.alive()) return;
    if (lookAgain) { load(); return; }
    skeleton.remove();
    if (r.status === 404 || r.status === 400) { page = null; gone(); return; }
    if (!r.ok) {
      if (!page) say(note, errorText(r.data?.error));
      schedule(15_000);
      return;
    }
    say(note, '');
    page = r.data;
    // its hearts: the counts, and (signed in) which ones this wallet liked
    const liked = new Set(Array.isArray(page.liked) ? page.liked : []);
    for (const j of page.jobs || []) if (j.status === 'done') noteLikes(j.id, j.likes, Array.isArray(page.liked) ? liked.has(j.id) : null);
    draw();
    schedule();
    posters();
    if (first) { first = false; deepLinks(); }
  }
  function schedule(ms = null) {
    clearTimeout(pollTimer);
    const i = inf();
    const busyNow = i && mine() && (['looks', 'body'].includes(i.status) || (page.jobs || []).some((j) => making(j.status))
      || (page.models || []).some((m) => making(m.status)));
    if (!ms && !busyNow) return;
    pollTimer = setTimeout(() => { if (!ctx.alive()) return; if (visible()) load(); else schedule(ms || POLL_MS); }, ms || POLL_MS);
  }
  ctx.listen(document, 'visibilitychange', () => { if (visible() && page && mine()) load(); });
  // the studio's settings (3D, coins, burns) and this wallet's prices can arrive after its page: what they change is drawn again
  ctx.on('info', () => { if (page?.influencer) draw(); });
  ctx.on('me', () => { if (page?.influencer) draw(); });
  ctx.on('wallet', () => { page = null; for (const k of Object.keys(sigs)) delete sigs[k]; load(); });

  function gone() {
    document.title = 'Not here · AGI Studio';
    ws.setPanel(false);
    put(head, h('div', { class: 'sa-profile-gone' }, h('h1', { class: 'sa-h1', tabindex: '-1', text: "This influencer isn't here" }),
      h('p', { class: 'sa-muted', text: "It was deleted or taken down, or it isn't ready yet (only its own wallet sees it while it's made)." })));
    for (const s of [makingBox, galleryBox, models]) s.hidden = true;
    cta.hidden = false;
  }

  // a part drawn again only when what it shows changed (so focus, what's typed and pictures stay put between looks)
  function part(key, value, drawFn) {
    const sig = JSON.stringify(value);
    if (sigs[key] === sig) return;
    sigs[key] = sig;
    drawFn();
  }

  function draw() {
    const i = inf();
    document.title = `${i.name} · AGI Studio`;
    back.href = ctx.href(mine() ? '/me' : '/explore');
    back.lastChild.textContent = mine() ? 'My studio' : 'Explore';
    const done = (page.jobs || []).filter((j) => j.status === 'done');
    bannedBox.hidden = !banned();
    part('head', { i: [i.name, i.status, i.portrait, i.body, i.public, i.private, i.face, i.mine, i.style, i.ready, i.boosted, i.maker?.name, i.banned], n: done.length,
      l: done.reduce((s, j) => s + (Number(j.likes) || 0), 0), b: [ctx.info?.burns?.boost, ctx.info?.burns?.boostHours], c: ctx.me ? ctx.me.clank?.name ?? null : undefined }, drawHead);
    const pickOrMaking = mine() && !banned() && ['looks', 'pick', 'body', 'failed'].includes(i.status);
    makingBox.hidden = !pickOrMaking;
    if (pickOrMaking) part('making', { s: i.status, j: i.job, l: i.looks, e: i.error, p: page.position }, drawMaking);
    // (2026-10-11) its guide: picking a look, then (once it's ready) its tools
    if (pickOrMaking && i.status === 'pick') ctx.guide('pick');
    const ready = i.status === 'ready';
    // its tools: its own wallet, once it's ready (never while it's banned: it makes nothing)
    const withTools = ready && mine() && !banned();
    ws.setPanel(withTools);
    if (withTools) {
      ws.setTitle(`Make with ${i.name}`, 'Photos, trend videos, videos, 3D and a coin');
      part('tools', toolsSig(), drawTools);
      ctx.guide('make', { instant: () => instant, open: () => ws.open(), close: () => ws.close() });
    }
    // (round 4, phase 2) while its own wallet is banned its pictures and videos are hidden from everyone, itself too: no gallery
    galleryBox.hidden = !ready || banned();
    if (!galleryBox.hidden) part('gallery', { j: (page.jobs || []).map((j) => [j.id, j.status, j.step, j.poster, j.files, j.error]), b: i.body, f: galleryBox.dataset.filter || 'all', p: page.position }, drawGallery);
    const ms = page.models || [];
    models.hidden = !(ready && ms.length) || banned();
    if (!models.hidden) part('models', ms.map((m) => [m.id, m.status, m.step, m.error, m.paid, m.credit, page.progress?.id === m.id ? page.progress.at : null]), drawModels);
    cta.hidden = mine() || !ready;
  }

  // ---------- its head: its look, its name, its numbers, what to do ----------
  function drawHead() {
    const i = inf();
    const jobs = page.jobs || [];
    const done = jobs.filter((j) => j.status === 'done');
    // (round 4, phase 2) banned: its pictures aren't asked for (our server shows them to nobody until the ban is lifted)
    const shown = !banned();
    const coverSrc = !shown ? null : i.body ? infPic(id, i.body, 0, true) : i.portrait ? infPic(id, i.portrait.job, i.portrait.n, true) : null;
    const cover = h('div', { class: 'sa-cover', 'aria-hidden': 'true' }, coverSrc ? pic(coverSrc, { cls: 'sa-cover-pic', lazy: false }) : null);
    const face = i.portrait && shown ? pic(infPic(id, i.portrait.job, i.portrait.n, true), { cls: 'sa-profile-pic', alt: '', lazy: false })
      : h('span', { class: 'sa-profile-pic is-missing', 'aria-hidden': 'true' }, icon('spark'));
    // (2026-10-11, the owner: "an option to change the profile even after generation") its own wallet changes its profile
    // picture: one of its looks, its full body or one of its photos, framed as a square (free: only how it's shown changes)
    let portrait = face;
    if (mine() && i.status === 'ready' && !banned()) {
      const edit = h('button', { type: 'button', class: 'sa-pfp-edit', 'aria-label': `Change ${i.name}'s profile picture`, title: 'Change its profile picture', dataset: { guide: 'pfp' } }, icon('camera'));
      edit.addEventListener('click', profileSheet);
      portrait = h('div', { class: 'sa-pfp' }, face, edit);
    }
    const meta = [INF_STYLES[i.style], 'AI-generated', i.ready ? `made ${dayText(i.ready)}` : null].filter(Boolean).join(' · ');
    const badges = h('div', { class: 'sa-badges' });
    if (priv()) add(badges, h('span', { class: 'sa-badge is-private' }, icon('shield'), h('span', { text: 'Private: only people with its link' })));
    if (i.boosted) add(badges, h('span', { class: 'sa-badge is-boost' }, icon('rocket'), h('span', { text: `Boosted · ${leftText(i.boosted)}` })));
    const likesSum = done.reduce((s, j) => s + (Number(j.likes) || 0), 0);
    const counts = h('dl', { class: 'sa-profile-stats' },
      h('div', null, h('dt', { text: 'Photos' }), h('dd', { text: compact(done.filter((j) => j.kind === 'photo').length) })),
      h('div', null, h('dt', { text: 'Videos' }), h('dd', { text: compact(done.filter((j) => j.kind !== 'photo').length) })),
      priv() ? null : h('div', null, h('dt', { text: 'Likes' }), h('dd', { text: compact(likesSum), 'aria-label': likesText(likesSum) })));
    const tools = h('div', { class: 'sa-profile-tools' });
    if (i.status === 'ready') {
      const share = btn('Share', { kind: 'ghost', size: 'sm', icon: 'share' });
      share.addEventListener('click', shareSheet);
      add(tools, share);
    }
    if (mine()) {
      if (i.status === 'ready' && !priv() && !banned()) {
        const sw = h('button', { type: 'button', class: 'sa-switch', role: 'switch', 'aria-checked': String(i.public) }, h('span', { class: 'sa-switch-knob', 'aria-hidden': 'true' }), h('span', { text: 'Show in Explore' }));
        sw.addEventListener('click', () => setPublic(!i.public, sw));
        add(tools, sw);
        // (round 2) a boost in Explore's "Boosted" row, for a burn (only a public one)
        const cost = ctx.info?.burns?.boost;
        if (cost > 0 && i.public) {
          const boost = btn(i.boosted ? `Boost more · ${num(cost)} $AGI` : `Boost · ${num(cost)} $AGI`, { kind: 'ghost', size: 'sm', icon: 'rocket' });
          boost.addEventListener('click', () => boostInf(ctx, i, { hours: ctx.info?.burns?.boostHours || 24, onDone: (d) => { ctx.toast(`${i.name} is boosted${d.until ? ` (${leftText(d.until)})` : ''}`, 'good'); sigs.head = null; load(); } }));
          add(tools, boost);
        }
      }
      const del = btn('Delete', { kind: 'quiet', size: 'sm', icon: 'trash' });
      del.addEventListener('click', remove);
      add(tools, del);
    } else if (i.status === 'ready') {
      const rep = btn('Report', { kind: 'quiet', size: 'sm', icon: 'flag' });
      rep.addEventListener('click', () => reportSheet(ctx, { inf: id, name: i.name }));
      add(tools, rep);
    }
    // (round 4) its maker's clank.trade username ("by @name", their clank.trade profile), on a public one
    const maker = i.maker?.name ? h('a', { class: 'sa-maker', href: clankProfileUrl(i.maker.name), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `By @${i.maker.name} on clank.trade (opens clank.trade)` },
      h('span', { text: 'by ' }), h('span', { class: 'sa-maker-name', text: `@${i.maker.name}` }), h('span', { 'aria-hidden': 'true', text: '\u00a0↗' })) : null;
    const addName = !maker && mine() && !banned() && i.status === 'ready' && i.public && !priv() && !ctx.me?.clank
      ? h('a', { class: 'sa-maker is-add', href: ctx.href('/me#clank'), dataset: { saLink: '' } }, h('span', { text: 'Show your clank.trade name here' }), h('span', { 'aria-hidden': 'true', text: '\u00a0→' })) : null;
    put(head, cover, h('div', { class: 'sa-profile-row' }, portrait,
      h('div', { class: 'sa-profile-titles' }, h('h1', { class: 'sa-display sa-profile-name', tabindex: '-1', text: i.name }), h('p', { class: 'sa-inf-meta', text: meta }), maker || addName, badges),
      i.status === 'ready' ? counts : null),
      tools);
  }

  async function setPublic(show, sw) {
    sw.disabled = true;
    const r = await ctx.act('inf-public', { id, show });
    sw.disabled = false;
    if (r.ok && r.data?.ok) {
      page.influencer.public = show;
      ctx.toast(show ? 'Shown in Explore' : 'Taken out of Explore', 'good');
      sigs.head = null;
      draw();
      ctx.refreshMe();
      return;
    }
    ctx.toast(errorText(r.data?.error), 'bad');
  }

  // ---------- (2026-10-11) its profile picture: one of its own pictures, framed as a square ----------
  // Its looks (or, made from a photo another way, the portrait cut for it), its full body and its photos; its picked look again
  // when it has a framed one. Saved on our server (inf-pfp); its photos, videos and 3D models are still made from its full body.
  function pictureGroups() {
    const i = inf();
    const groups = [];
    const own = [];
    if (i.looks?.job) {
      for (let n = 0; n < Math.min(4, Math.max(1, Number(i.looks.files) || 4)); n++) {
        own.push({ job: i.looks.job, n, src: infPic(id, i.looks.job, n, true), big: infPic(id, i.looks.job, n), label: `Look ${n + 1}` });
      }
    } else if (i.look?.job) {
      own.push({ job: i.look.job, n: i.look.n, src: infPic(id, i.look.job, i.look.n, true), big: infPic(id, i.look.job, i.look.n), label: 'Its first portrait' });
    }
    if (i.body) own.push({ job: i.body, n: 0, src: infPic(id, i.body, 0, true), big: infPic(id, i.body, 0), label: 'Full body', start: 'head' });
    if (own.length) groups.push({ label: i.looks?.job ? 'Its looks and full body' : 'Its portrait and full body', items: own });
    groups.push({ label: 'Its photos', items: photoItems(), empty: 'No photos of it yet: a photo made with the Photo tool can be its profile picture too.' });
    return groups;
  }
  // its done photos, newest first (a meme and an X banner too: any of them can be framed)
  function photoItems() {
    const out = [];
    for (const j of (page.jobs || []).filter((x) => x.kind === 'photo' && x.status === 'done')) {
      const label = j.meme ? 'Meme' : j.shape === 'banner' ? 'X banner' : SHAPES[j.shape]?.name || 'Photo';
      for (let n = 0; n < Math.min(4, Math.max(1, Number(j.files) || 1)); n++) {
        out.push({ job: j.id, n, src: infPic(id, j.id, n, true), big: infPic(id, j.id, n), label, start: j.shape === 'tall' ? 'head' : null });
      }
      if (out.length >= 36) break;
    }
    return out;
  }
  async function profileSheet() {
    const i = inf();
    const current = i.pfp ? { ...i.pfp } : i.look ? { ...i.look, x: 0, y: 0, s: 1000 } : null;
    const saved = (d) => {
      page.influencer.portrait = d.portrait || page.influencer.look;
      page.influencer.pfp = d.pfp || null;
      sigs.head = null;
      draw();
      ctx.refreshMe();
    };
    const choice = await pickPicture({
      title: `${i.name}'s profile picture`,
      sub: "Pick one of its pictures, then frame its face. Free: it changes how it's shown (its page, Explore, My studio, a coin at first), not what it's made from.",
      groups: pictureGroups(), current, saveLabel: 'Use this picture',
      save: async (c) => {
        const r = await ctx.act('inf-pfp', { id, from: { job: c.job, n: c.n, x: c.x, y: c.y, s: c.s } });
        if (r.ok && r.data?.ok) { saved(r.data); return true; }
        return errorText(r.data?.error);
      },
      reset: i.pfp ? {
        label: 'Use its picked look again',
        run: async () => {
          const r = await ctx.act('inf-pfp', { id, from: null });
          if (r.ok && r.data?.ok) { saved(r.data); return true; }
          return errorText(r.data?.error);
        },
      } : null,
    });
    if (!ctx.alive() || !choice) return;
    ctx.toast(choice.reset ? 'Back to its picked look' : 'Profile picture changed', 'good');
  }

  async function remove() {
    const i = inf();
    const ok = await confirmSheet({
      title: `Delete ${i.name}?`, yes: 'Delete it', danger: true,
      text: [`This deletes ${i.name}${priv() ? ', the photo it was made from,' : ''} and every photo and video made from it, at once, from every page. Its 3D models come down too.`, "It can't be undone. Anything still being made stops, and its credits come back."],
    });
    if (!ok) return;
    const r = await ctx.act('inf-delete', { id });
    if (r.ok && r.data?.ok) {
      ctx.toast(`${i.name} is deleted: everything made from it is gone`, 'good');
      ctx.refreshMe();
      ctx.nav(ctx.href('/me'), { replace: true });
      return;
    }
    ctx.toast(errorText(r.data?.error), 'bad');
  }

  function shareSheet() {
    const i = inf();
    const url = `${location.origin}${ctx.href(`/i/${id}`)}`;
    const s = sheet({ title: `Share ${i.name}`, sub: priv() ? 'A private influencer: only people you give this link see it.' : 'Anyone with this link sees it.' });
    const link = h('code', { class: 'sa-addr', text: url });
    const copy = btn('Copy link', { kind: 'primary', icon: 'link' });
    copy.addEventListener('click', async () => { const ok = await copyText(url, link); ctx.toast(ok ? 'Link copied' : 'Link selected: copy it', 'good'); });
    add(s.body, h('div', { class: 'sa-addr-row' }, link));
    s.setFoot(copy, linkBtn('Share on X ↗', shareInfUrl(i.name, url), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
  }

  // ---------- while it's made: its looks, picking one, its full body ----------
  function drawMaking() {
    const i = inf();
    const position = page.position && i.job && page.position.job === i.job.id ? page.position.at : null;
    if (i.status === 'looks' || i.status === 'body') {
      // (2026-10-11) one made from a photo with just its full body, or the photo as it is (no AI: a few seconds)
      const asis = i.status === 'body' && i.way === 'asis';
      const tiles = i.status === 'looks'
        ? h('div', { class: 'sa-looks' }, ...[0, 1, 2, 3].map(() => h('span', { class: 'sa-look is-making', 'aria-hidden': 'true' })))
        : h('div', { class: 'sa-body-making' }, i.portrait ? pic(infPic(id, i.portrait.job, i.portrait.n), { cls: 'sa-look-pic', lazy: false }) : null, h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }));
      put(makingBox,
        h('h2', { class: 'sa-h2', text: i.status === 'looks' ? 'Making its looks' : asis ? 'Getting it ready' : 'Making its full body' }),
        h('p', { class: 'sa-progress-line' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: makingText(i, { position }) })),
        // (round 4) how far along it is, and about how long is left
        progressBar({ key: i.job?.id || `${id}-${i.status}`, kind: asis ? 'asis' : i.status, step: i.job?.step || 'queue', since: i.job?.created ?? null }),
        h('p', { class: 'sa-muted sa-small', text: `${asis ? 'A few seconds' : 'About a minute'}. You can leave this page: it keeps going, and My studio shows it when it's ready.` }),
        tiles);
      return;
    }
    if (i.status === 'failed') {
      const del = btn('Delete it', { kind: 'ghost', icon: 'trash' });
      del.addEventListener('click', remove);
      put(makingBox, h('h2', { class: 'sa-h2', text: "It couldn't be made" }),
        h('p', { text: `${failText(i.error)} Its credits came back.` }),
        h('div', { class: 'sa-row' }, linkBtn('Try again', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '' } }), del));
      return;
    }
    // 'pick': its 4 looks
    let picked = null;
    const n = Math.max(1, Math.min(4, i.looks?.files || 4));
    const use = btn('Use this look', { kind: 'primary', icon: 'check' });
    use.disabled = true;
    const looks = h('div', { class: 'sa-looks', role: 'radiogroup', 'aria-label': 'Its looks', dataset: { guide: 'looks' } });
    for (let k = 0; k < n; k++) {
      const b = h('button', { type: 'button', class: 'sa-look', role: 'radio', 'aria-checked': 'false', 'aria-label': `Look ${k + 1}` },
        pic(infPic(id, i.looks.job, k, true), { cls: 'sa-look-pic', lazy: false }), h('span', { class: 'sa-look-check', 'aria-hidden': 'true' }, icon('check')));
      b.addEventListener('click', () => {
        picked = k;
        for (const x of looks.children) x.setAttribute('aria-checked', String(x === b));
        use.disabled = false;
      });
      add(looks, b);
    }
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    use.addEventListener('click', () => busy(use, 'Starting…', async () => {
      if (picked === null) return;
      const r = await ctx.act('inf-pick', { id, look: picked });
      if (r.ok && r.data?.ok) { ctx.toast('Making its full body from that look', 'good'); sigs.making = null; load(); return; }
      say(msg, errorText(r.data?.error));
      if (r.data?.error === 'state') load();
    }));
    const reroll = btn(`4 new looks · ${num(price('looks'))} credits`, { kind: 'ghost', icon: 'refresh', dataset: { guide: 'reroll' } });
    reroll.addEventListener('click', () => busy(reroll, 'Starting…', async () => {
      if (ctx.credits < price('looks')) { await ctx.buyCredits({ need: price('looks') }); if (ctx.credits < price('looks')) return; }
      const r = await ctx.act('inf-reroll', { id });
      if (r.ok && r.data?.ok) { ctx.toast('Making 4 new looks', 'good'); sigs.making = null; load(); return; }
      if (r.data?.error === 'short') { ctx.buyCredits({ need: price('looks') }); return; }
      say(msg, errorText(r.data?.error));
    }));
    put(makingBox,
      h('h2', { class: 'sa-h2', text: 'Pick your favorite look' }),
      h('p', { class: 'sa-muted', text: `${i.name}'s full body is made from the look you pick: then photos, videos and more.` }),
      i.error ? h('p', { class: 'sa-note', text: `${failText(i.error)} Pick a look again: it's free.` }) : null,
      looks, msg, h('div', { class: 'sa-row' }, use, reroll));
  }

  // ---------- its photos and videos ----------
  function drawGallery() {
    const i = inf();
    const jobs = page.jobs || [];
    const filter = galleryBox.dataset.filter || 'all';
    const shows = (j) => filter === 'all' || (filter === 'photos' ? j.kind === 'photo' : j.kind !== 'photo');
    const position = page.position;
    // (round 4) its X banners in a strip of their own above its wall (3:1 is too low for a column of the wall)
    const tiles = [], banners = [];
    const item = (j) => ({ ...j, inf: { id, name: i.name, portrait: i.portrait } });
    if (i.body && filter !== 'videos') {
      const b = h('button', { type: 'button', class: 'sa-media-open', 'aria-label': `${i.name}'s full body` },
        pic(infPic(id, i.body, 0, true), { cls: 'sa-media-pic' }), h('span', { class: 'sa-tag sa-media-tag' }, h('span', { text: 'Full body' })));
      b.addEventListener('click', () => photoSheet(ctx, { id: i.body, shape: 'tall' }, { name: i.name, inf: id, mine: mine(), priv: priv(), kind: 'body' }));
      tiles.push(h('div', { class: 'sa-media is-tall', id: `v-${i.body}` }, b));
    }
    for (const j of jobs.filter(shows)) {
      const shape = PHOTO_SHAPES[j.shape] ? j.shape : 'tall';
      const into = isBanner(j) ? banners : tiles;
      if (j.status === 'done') {
        into.push(mediaTile(ctx, item(j), { onopen: () => openJob(j), can: !mine() && !priv(), showName: false,
          // (2026-10-12) one saved from the video editor: "Edited", next to the video it's from
          badge: j.kind === 'trend' ? { text: 'Trend', icon: 'zap' } : j.kind === 'video' && j.editor ? { text: 'Edited', icon: 'scissors' }
            : j.kind === 'video' ? { text: Number(j.parts) > 1 ? `Video · ${secondsText(j.seconds)}` : 'Video', icon: 'film' }
            : isBanner(j) ? { text: 'X banner', icon: 'image' } : j.meme ? { text: 'Meme', icon: 'smile' }
              // (2026-10-12) one made with "Edit with words", or saved from the photo editor, told apart from the photo it's
              // from, next to it
              : j.edit ? { text: 'Edited', icon: 'wand' } : j.editor ? { text: 'Edited', icon: 'sliders' } : null }));
      } else if (making(j.status)) {
        into.push(h('div', { class: `sa-media is-${shape} is-making`, id: `v-${j.id}` }, h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }),
          h('span', { class: 'sa-media-state' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: jobStateText(j, { position: position && position.job === j.id ? position.at : null }) }),
            // (round 4) how far along it is, and about how long is left (phase 4: its own plan, by its model, quality and
            // length; a long video's by its parts)
            progressBar({ key: j.id, kind: progressKind(j), plan: jobPlan(j), step: jobStep(j), since: j.created ?? null, small: true })),
          h('span', { class: 'sa-media-cap' }, h('span', { text: jobTitle(j) }))));
      } else if (j.status === 'failed') {
        // (2026-10-12, the editor) its own: "Try again" (the same words and settings, at the price of making it now: its credits
        // came back) when trying again can work, and "Remove" (nothing is lost: it was never made)
        const acts = [];
        if (mine() && tryAgainOk(j)) {
          const tryB = btn('Try again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
          tryB.addEventListener('click', () => again(j, tryB));
          acts.push(tryB);
        }
        if (mine()) {
          const rm = btn('', { kind: 'quiet', size: 'sm', icon: 'trash', 'aria-label': `Remove it: ${jobTitle(j)}`, title: 'Remove it' });
          rm.addEventListener('click', () => removeJob(j, { ask: false, button: rm }));
          acts.push(rm);
        }
        into.push(h('div', { class: `sa-media is-${shape} is-failed${acts.length ? ' has-acts' : ''}`, id: `v-${j.id}` },
          h('span', { class: 'sa-media-state' }, h('span', { text: jobStateText(j) }), acts.length ? h('span', { class: 'sa-media-acts' }, ...acts) : null),
          h('span', { class: 'sa-media-cap' }, h('span', { text: jobTitle(j) }))));
      }
    }
    const filters = h('div', { class: 'sa-filter', role: 'group', 'aria-label': 'Show' }, ...[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([v, label]) => {
      const b = h('button', { type: 'button', class: 'sa-filter-btn', 'aria-pressed': String(filter === v), text: label });
      b.addEventListener('click', () => { galleryBox.dataset.filter = v; draw(); });
      return b;
    }));
    const empty = jobs.length === 0;
    let emptyNote = null;
    if (empty && mine()) {
      const start = btn('Make its first photo', { kind: 'primary', size: 'sm', icon: 'image' });
      start.addEventListener('click', () => openTool('photo'));
      emptyNote = h('div', { class: 'sa-gempty' }, h('p', { class: 'sa-gempty-title', text: 'Nothing made yet' }),
        h('p', { class: 'sa-muted', text: `Photos, trend videos and videos of ${i.name} show up here as they're made.` }), start);
    }
    // (2026-10-12) the keyboard's place kept across it: the same control of the same tile again, else (its tile went: deleted)
    // the gallery's heading, so a look's new answer never throws it back to the top of the page
    const place = focusPlace(galleryBox) || (focusNext && Date.now() < focusNext.until ? focusNext.place : null);
    focusNext = null;
    put(galleryBox,
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-gal-h', tabindex: '-1', text: mine() ? 'Creations' : `${i.name}'s photos and videos` }), jobs.length ? filters : null),
      banners.length ? h('div', { class: 'sa-banners' }, h('h3', { class: 'sa-banners-title' }, icon('image'), h('span', { text: `X banners · ${BANNER.W} × ${BANNER.H}` })), h('div', { class: 'sa-banner-row' }, ...banners)) : null,
      tiles.length || !banners.length ? h('div', { class: 'sa-wall' }, ...tiles) : null,
      emptyNote);
    focusBack(galleryBox, place, galleryBox.querySelector('#sa-gal-h'));
  }

  function openJob(j) {
    const i = inf();
    // (round 4) its own creations: captions for a post of it
    const onCaptions = mine() ? () => captionSheet(ctx, { job: j, name: i.name, inf: id }) : null;
    // (2026-10-12, the editor) …and "Make another" and "Delete"; on a photo (a meme, an X banner), "Edit with words" and the
    // photo editor too (one saved from the photo editor has no words and settings to make again); on a video or a trend video,
    // the video editor (one saved from it neither)
    // (2026-10-13) …and on a photo (a meme, an X banner) AGI-1 isn't in yet, "Add AGI-1" (a new one with her, at its price)
    const own = mine() ? {
      cost: againCost(j), onAgain: j.editor ? null : (x) => again(x), onDelete: (x) => removeJob(x),
      onEdit: j.kind === 'photo' ? (x) => editWithWords(x) : null, onEditor: j.kind === 'photo' ? (x) => openEditor(x) : null,
      onVideoEditor: ['video', 'trend'].includes(j.kind) ? (x) => openVideoEditor(x) : null,
      onAddHer: j.kind === 'photo' && j.agi1 !== true ? (x) => addHer(x) : null,
    } : null;
    if (j.kind === 'photo') {
      // (an X banner is too wide to start a video or a trend video: those are tall, wide or square; and a meme's words would
      // come out garbled in one. (2026-10-13) A photo with AGI-1 never starts a trend video: it puts the influencer in place of
      // one person in the clip; a video from it has her too)
      const starts = !isBanner(j) && !j.meme;
      photoSheet(ctx, j, { name: i.name, inf: id, mine: mine(), priv: priv(), onCaptions, own,
        onVideo: starts ? (image) => openTool('video', { image }) : null, onTrend: starts && j.agi1 !== true ? (image) => openTool('trend', { image }) : null });
      return;
    }
    videoSheet(ctx, j, { name: i.name, inf: id, mine: mine(), priv: priv(), onCaptions, own });
  }

  // ---------- the editor (2026-10-12, the owner's choices): "Make another" and "Delete", for its own creations ----------
  // What "Make another" costs now: the same choices at today's price (a video made before the model menu: Standard from a
  // photo, else Anime, as our server picks); null when its choices aren't on the menu any more (our server says so)
  function againCost(j) {
    if (j.kind === 'trend') return price('trend');
    if (j.kind === 'photo') return photoCredits({ model: j.model ?? null, quality: j.quality ?? null, shape: j.shape || 'tall', meme: j.meme ?? null }, ctx.level);
    // (videoCredits(null) would be Standard's 5 seconds: a spec the menu doesn't offer any more is null here)
    const spec = videoSpec({ model: j.model || (j.image ? 'standard' : 'anime'), seconds: j.seconds ?? null, sound: j.sound === true, quality: j.quality ?? null });
    return spec ? videoCredits(spec, ctx.level) : null;
  }
  // The same words and settings, a new one next to it (never in its place). b: the button that asked (a failed tile's "Try
  // again"), busy while it starts
  async function again(j, b = null) {
    const need = againCost(j);
    // (the keyboard's place: its tile, or the tile's Try again; it comes back there once its gallery shows the new one)
    const at = focusPlace(galleryBox);
    const run = async () => {
      if (Number.isFinite(need) && !(await enough(need))) return;
      const r = await ctx.act('inf-again', { job: j.id });
      const d = r.data || {};
      if (r.ok && d.ok) {
        ctx.toast(againMadeText(j), 'good');
        if (at) focusNext = { place: at, until: Date.now() + 15_000 };
        sigs.gallery = null;
        load();
        return;
      }
      if (d.error === 'short') {
        ctx.toast(`That needs ${creditsText(need ?? 0)}: you have ${creditsText(d.have ?? ctx.credits)}.`, 'bad');
        ctx.buyCredits({ need: need ?? 0 });
        return;
      }
      ctx.toast(againErrorText(d, j), 'bad');
    };
    if (b) await busy(b, 'Starting…', run);
    else await run();
  }
  // Off every page for good (its files deleted; a profile picture framed from it goes back to its picked look). ask: false for
  // one that couldn't be made (nothing is lost: it was never made)
  async function removeJob(j, { ask = true, button = null } = {}) {
    const i = inf();
    // something being made from it right now (a video or a trend video from this photo): said at once (our server says so too)
    if ((page.jobs || []).some((x) => x.image === j.id && making(x.status))) { ctx.toast(errorText('job_in_use'), 'bad'); return; }
    const pfp = i?.pfp?.job === j.id;
    if (ask) {
      const words = deleteJobText(j, { name: i?.name, pfp });
      if (!(await confirmSheet({ title: words.title, text: words.text, yes: words.yes, danger: true }))) return;
    }
    const run = async () => {
      const r = await ctx.act('inf-job-delete', { job: j.id });
      // (its tile goes: the keyboard to its gallery's heading)
      const toHeading = () => { focusNext = { place: { id: 'sa-gal-h', n: -1 }, until: Date.now() + 15_000 }; };
      if (r.ok && r.data?.ok) {
        ctx.toast(deletedText({ pfp: r.data.pfp === true }), 'good');
        // gone from its gallery at once, then its page as our server has it (its profile picture, its numbers)
        page.jobs = (page.jobs || []).filter((x) => x.id !== j.id);
        toHeading();
        draw();
        load();
        return;
      }
      ctx.toast(errorText(r.data?.error), 'bad');
      if (r.data?.error === 'job_gone') { toHeading(); load(); }
    };
    if (button) await busy(button, '', run);
    else await run();
  }

  // "Edit with words" (the same day, the owner's choice: "type a change … a new photo from that one; same price as a photo"): a
  // change typed in words, and a new photo made from this one (a meme, an X banner) next to it, at that photo's price (rules.js
  // editSpec: Classic, its own shape and quality; a meme keeps its words, an X banner its size). Its words are checked by our
  // server like a scene's (PG-13, nobody real by name, no links)
  const editCost = (j) => photoCredits(editSpec(j), ctx.level);
  function editWithWords(j) {
    const need = editCost(j);
    const w = creationWord(j);
    const s = sheet({ title: 'Edit with words', sub: `Type what should change: a new ${w} is made from this one, next to it.`, size: 'md' });
    const areaId = nextId('edit');
    const area = h('textarea', { class: 'sa-input sa-textarea', id: areaId, rows: 3, maxlength: EDIT.MAX, placeholder: 'For example: make the jacket red' });
    const count = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `0/${EDIT.MAX}` });
    const err = errLine(), msg = errLine();
    area.addEventListener('input', () => { count.textContent = `${[...area.value].length}/${EDIT.MAX}`; say(err, ''); say(msg, ''); });
    const ideas = h('div', { class: 'sa-ideas' }, h('span', { class: 'sa-hint', text: 'Ideas' }), ...EDIT_IDEAS.slice(0, 6).map((t) => {
      const b = h('button', { type: 'button', class: 'sa-idea', text: t });
      b.addEventListener('click', () => { area.value = t; area.dispatchEvent(new Event('input')); area.focus(); });
      return b;
    }));
    const shape = PHOTO_SHAPES[j.shape] ? j.shape : 'tall';
    add(s.body,
      h('div', { class: 'sa-edit-from' }, pic(infPic(id, j.id, 0, true), { cls: `sa-edit-from-pic is-${shape}`, alt: `The ${w} it's made from` }),
        h('div', { class: 'sa-edit-from-text' }, h('p', { class: 'sa-label', text: `From this ${w}` }), h('p', { class: 'sa-muted', text: editNote(j) }))),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: areaId, text: 'What should change?' }), area,
        h('div', { class: 'sa-field-foot' }, err, count), ideas),
      msg);
    const cancel = btn('Cancel', { kind: 'ghost' });
    cancel.addEventListener('click', () => s.close());
    const go = btn(Number.isFinite(need) ? `Make it · ${num(need)} credits` : 'Make it', { kind: 'primary', icon: 'wand' });
    go.addEventListener('click', () => {
      const v = area.value.trim();
      if ([...v].length < EDIT.MIN) { say(err, wordsText('edit', v ? 'short' : 'empty')); area.focus(); return; }
      busy(go, 'Starting…', async () => {
        if (Number.isFinite(need) && !(await enough(need))) return;
        const r = await ctx.act('inf-make', { id, kind: 'photo', image: j.id, edit: v });
        if (!made(r, need ?? 0, { msg, onWords: (d) => { say(d.field === 'edit' ? err : msg, wordsText(d.field, d.why)); area.focus(); } })) return;
        s.close();
        ctx.toast(editMadeText(j), 'good');
        // (the keyboard: back on its tile, the sheet's closing put it there, once its gallery shows the new one)
        const at = focusPlace(galleryBox);
        if (at) focusNext = { place: at, until: Date.now() + 15_000 };
        sigs.gallery = null;
        load();
      });
    });
    s.setFoot(cancel, go);
    requestAnimationFrame(() => area.focus());
  }

  // "Add AGI-1" (2026-10-13, "With AGI-1"): she's put into one of its own photos (a meme, an X banner) she isn't in yet, as her
  // own 2D anime self: a new one next to it, at that photo's price (like Edit with words: rules.js editSpec, Classic), with no
  // words to type. Our server says "agi1_has" when she's in it already
  function addHer(j) {
    const i = inf();
    const need = editCost(j);
    const w = creationWord(j);
    const s = sheet({ title: 'Add AGI-1', sub: `AGI-1 joins ${i.name} in this ${w}: a new one is made from it, next to it.`, size: 'md' });
    const msg = errLine();
    const shape = PHOTO_SHAPES[j.shape] ? j.shape : 'tall';
    add(s.body,
      h('div', { class: 'sa-edit-from sa-her-from' }, pic(infPic(id, j.id, 0, true), { cls: `sa-edit-from-pic is-${shape}`, alt: `The ${w} she joins` }),
        h('span', { class: 'sa-her-plus', 'aria-hidden': 'true' }, icon('plus')),
        pic(WITH_AGI1.FACE, { cls: 'sa-her-face is-lg', alt: 'AGI-1, as she\'s drawn', lazy: false }),
        h('div', { class: 'sa-edit-from-text' }, h('p', { class: 'sa-label', text: WITH_AGI1.NAME }), h('p', { class: 'sa-muted', text: addHerNote(j) }))),
      h('p', { class: 'sa-fine', text: 'Cute and a little flirty, always PG-13. The same price as the photo it\'s from.' }),
      msg);
    const cancel = btn('Cancel', { kind: 'ghost' });
    cancel.addEventListener('click', () => s.close());
    const go = btn(Number.isFinite(need) ? `Add her · ${num(need)} credits` : 'Add her', { kind: 'primary', icon: 'agi1' });
    go.addEventListener('click', () => busy(go, 'Starting…', async () => {
      if (Number.isFinite(need) && !(await enough(need))) return;
      const r = await ctx.act('inf-make', { id, kind: 'photo', image: j.id, agi1: true });
      if (!made(r, need ?? 0, { msg })) return;
      s.close();
      ctx.toast(addHerMadeText(j), 'good');
      // (the keyboard: back on its tile once its gallery shows the new one, as after Edit with words)
      const at = focusPlace(galleryBox);
      if (at) focusNext = { place: at, until: Date.now() + 15_000 };
      sigs.gallery = null;
      load();
    }));
    s.setFoot(cancel, go);
    // (Cancel first for the keyboard, like "are you sure?": its button spends credits)
    requestAnimationFrame(() => cancel.focus());
  }

  // The photo editor (the same day, the owner's choice: "Photo editor (Recommended)": free, no AI, in this browser): saved as a
  // new photo, its gallery again, the keyboard back on the photo it's from
  function openEditor(j) {
    const at = focusPlace(galleryBox);
    photoEditor(ctx, { inf: id, job: j, name: inf()?.name, onSaved: () => {
      const back = focusPlace(galleryBox) || at;
      if (back) focusNext = { place: back, until: Date.now() + 15_000 };
      sigs.gallery = null;
      load();
    } });
  }

  // The video editor (the same day, the owner's choice: "Video editor": trim it, words on it, its shape; made by our clock, free,
  // 10 a day): saved as a new video, its gallery again (the new one being made), the keyboard back on the video it's from
  function openVideoEditor(j) {
    const at = focusPlace(galleryBox);
    videoEditor(ctx, { inf: id, job: j, onSaved: () => {
      const back = focusPlace(galleryBox) || at;
      if (back) focusNext = { place: back, until: Date.now() + 15_000 };
      sigs.gallery = null;
      load();
    } });
  }

  // ---------- its 3D models ----------
  function drawModels() {
    const list = page.models || [];
    put(models, h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-3d-h', text: 'In 3D' })),
      h('ul', { class: 'sa-grid sa-grid-models' }, ...list.map((m) => {
        if (m.status === 'done') {
          return h('li', null, h('a', { class: 'sa-tile is-square sa-tile-model', href: ctx.href(`/3d/${m.id}`), dataset: { saLink: '' } },
            pic(fileUrl(m.id, 'webp'), { cls: 'sa-tile-pic' }), h('span', { class: 'sa-tile-kind', 'aria-hidden': 'true' }, icon('cube')),
            h('span', { class: 'sa-tile-cap' }, h('span', { text: 'Open in 3D' }))));
        }
        // (round 2) one waiting for its big burn, and one that couldn't be made (made again, free)
        const extra = [];
        if (m.status === 'quote' && mine()) {
          const go = btn('Check my burn', { kind: 'primary', size: 'sm', icon: 'flame' });
          go.addEventListener('click', () => burn3d({ order: m.id, agi: m.agi, paid: m.paid, spec: m.spec || null }));
          extra.push(go);
        }
        if (m.status === 'failed' && m.kind === 'burn' && m.credit && mine()) {
          const again = btn('Make it again, free', { kind: 'ghost', size: 'sm', icon: 'refresh' });
          again.addEventListener('click', () => busy(again, 'Starting…', async () => {
            const r = await ctx.act('inf-3d-redo', { id, order: m.id });
            if (r.ok && r.data?.ok) { ctx.toast('Making it in 3D again: about 5 to 10 minutes', 'good'); sigs.models = null; load(); return; }
            ctx.toast(errorText(r.data?.error), 'bad');
          }));
          extra.push(again);
        }
        const isMaking = making(m.status) || m.status === 'quote';
        // (round 4) how far along it is: its step, and that step's own percentage (the 3D service's) when this look brought it
        const own = page.progress?.id === m.id && page.progress.step === m.step ? page.progress.at : null;
        return h('li', null, h('div', { class: `sa-tile is-square ${isMaking ? 'is-making' : 'is-failed'}` },
          making(m.status) ? h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }) : null,
          h('span', { class: 'sa-tile-state' }, making(m.status) ? h('span', { class: 'sa-spin', 'aria-hidden': 'true' }) : m.status === 'quote' ? icon('flame') : null,
            h('span', { text: modelText(m) }),
            // (2026-10-13) a model with choices of its own has a plan of its own (its moves described in words add steps)
            making(m.status) ? progressBar({ key: m.id, kind: 'model', plan: m.spec ? modelTimes(m.spec) : null, step: m.step || (m.spec?.own?.length ? 'motion1' : 'image'), stepPct: own,
              since: m.started ?? m.created ?? null, small: true }) : null,
            ...extra),
          h('span', { class: 'sa-tile-cap' }, h('span', { text: '3D model' }))));
      })));
  }

  // ---------- the tools: the workspace's panel (its own wallet, once it's ready) ----------
  // (Round 4, phase 4) Photo makes photos, memes and X banners (all three are photos); with Instant on, the panel is Instant's
  // ready-made ideas instead (one tap makes one)
  const TOOLS = [
    { id: 'photo', icon: 'image', name: 'Photo', build: photoTool },
    { id: 'trend', icon: 'zap', name: 'Trend', build: trendTool },
    { id: 'video', icon: 'film', name: 'Video', build: videoTool },
    { id: '3d', icon: 'cube', name: '3D', build: modelTool, when: () => ctx.info?.threeD },
    { id: 'coin', icon: 'coin', name: 'Coin', build: coinTool, when: () => ctx.info?.coins && (ctx.info.launch || ctx.me?.owner || !ctx.info.open) },
  ];
  const toolsNow = () => TOOLS.filter((t) => !t.when || t.when());
  const toolTabs = h('div', { class: 'sa-tooltabs', role: 'tablist', 'aria-label': 'What to make', dataset: { guide: 'tools' } });
  const toolBody = h('div', { class: 'sa-tool', role: 'tabpanel', id: nextId('tool') });
  put(ws.body, toolTabs, toolBody);
  const cost = costLine(ctx);
  const quick = btn('Make', { kind: 'primary', size: 'sm', icon: 'spark' });
  quick.addEventListener('click', () => ws.open());
  ws.setQuick(quick);
  let tool = { id: 'photo', opts: {} }, toolToken = 0, priced = [];
  // the buttons' prices follow this wallet's (its level's discount, once inf-me answers)
  ctx.on('me', () => { for (const [b] of priced) b.refresh(); });

  // ---------- Instant (round 4, phase 4): a switch in the panel's head; on, the panel is ready-made ideas, one tap each ----------
  let instant = instantOn();
  const instSwitch = h('button', { type: 'button', class: 'sa-instant', role: 'switch', 'aria-checked': String(instant), 'aria-label': 'Instant', title: 'Instant: one tap on an idea makes it', dataset: { guide: 'instant' } },
    icon('ff'), h('span', { text: 'Instant' }));
  instSwitch.addEventListener('click', (e) => {
    e.stopPropagation();
    setInstantMode(!instant, { remember: true });
  });
  ws.setMode(instSwitch);
  function setInstantMode(on, { remember = false } = {}) {
    instant = Boolean(on);
    if (remember) setInstant(instant);
    instSwitch.setAttribute('aria-checked', String(instant));
    drawTools();
    if (instant && remember && !instantSeen() && !instantExplained) explainInstant();
  }
  function explainInstant() {
    instantExplained = true;
    markInstantSeen();
    const s = sheet({ title: 'Instant: one tap, and it\'s made', sub: 'Ready-made ideas instead of choices: for when you just want to post.' });
    add(s.body, h('ul', { class: 'sa-ticks' },
      h('li', { text: 'Tap an idea and it starts at once, at the price on it. Credits are spent as you tap: there\'s no second step.' }),
      h('li', { text: 'Photos are Classic at Standard quality, X banners HD, memes come with their words, and videos are 5 seconds (Standard, no sound) from its newest photo.' }),
      h('li', { text: 'Anything that can\'t be made gives its credits back, as always.' }),
      h('li', { text: 'A coin is never one tap. Switch Instant off any time for every choice: models, quality, length, references.' })));
    const ok = btn('Got it', { kind: 'primary', icon: 'check' });
    ok.addEventListener('click', () => s.close());
    s.setFoot(ok);
  }

  // what the tools' panel shows: drawn again only when this changes (so what's typed stays put between looks)
  const toolsSig = () => ({
    ids: toolsNow().map((t) => t.id), instant,
    x: instant ? [ctx.level, ctx.info?.threeD, startPhotos(page.jobs).map((j) => j.id).join(), ctx.me?.freeModel ?? null]
      : tool.id === '3d' ? [ctx.level, ctx.info?.burns?.model, ctx.me?.freeModel ?? null]
      : tool.id === 'coin' ? [priv(), inf()?.portrait?.job ?? null] : tool.id === 'video' || tool.id === 'photo' ? [startPhotos(page.jobs).map((j) => j.id).join()] : null,
  });
  function openTool(toolId, opts = {}) {
    // (Instant on: a tool asked for by name, like "Make a video from it", shows that tool with every choice)
    if (instant) { instant = false; setInstant(false); instSwitch.setAttribute('aria-checked', 'false'); }
    tool = { id: toolId, opts };
    drawTools();
    ws.open();
    ws.body.scrollTop = 0;
  }
  function drawTools() {
    const list = toolsNow();
    if (!list.some((t) => t.id === tool.id)) tool = { id: 'photo', opts: {} };
    sigs.tools = JSON.stringify(toolsSig());
    toolTabs.hidden = instant;
    put(toolTabs, ...list.map((t) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'sa-tooltab', 'aria-selected': String(t.id === tool.id), 'aria-controls': toolBody.id,
        tabindex: t.id === tool.id ? '0' : '-1', dataset: { tool: t.id } }, icon(t.icon), h('span', { text: t.name }));
      b.addEventListener('click', () => { if (t.id !== tool.id) { tool = { id: t.id, opts: {} }; drawTools(); } });
      return b;
    }));
    if (instant) toolBody.removeAttribute('role'); else toolBody.setAttribute('role', 'tabpanel');
    toolBody.classList.toggle('is-instant', instant);
    const token = ++toolToken;
    priced = [];
    put(toolBody);
    const host = {
      body: toolBody,
      alive: () => token === toolToken && ctx.alive(),
      setFoot: (...nodes) => ws.setFoot(cost.node, ...nodes),
      // (a tool that costs nothing: no line about credits)
      setFootBare: (...nodes) => ws.setFoot(...nodes),
      // after it started: a fresh form, and its tile in the gallery
      done: () => { tool = { id: tool.id, opts: {} }; drawTools(); },
    };
    if (instant) { instantTool(host); return; }
    list.find((t) => t.id === tool.id).build(host, tool.opts || {});
  }
  toolTabs.addEventListener('keydown', (e) => {
    const ids = toolsNow().map((t) => t.id);
    const at = ids.indexOf(tool.id);
    const to = e.key === 'ArrowRight' ? ids[(at + 1) % ids.length] : e.key === 'ArrowLeft' ? ids[(at - 1 + ids.length) % ids.length]
      : e.key === 'Home' ? ids[0] : e.key === 'End' ? ids[ids.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    tool = { id: to, opts: {} };
    drawTools();
    toolTabs.querySelector(`[data-tool="${to}"]`)?.focus();
  });

  // ---------- making: what each tool shares ----------
  // what a "no" means for making something (and buying credits when it's short). need: what it costs, in credits
  function made(r, need, { onWords = null, msg }) {
    const d = r.data || {};
    if (r.ok && (d.ok || d.job || d.order)) return true;
    if (d.error === 'words' && onWords) { onWords(d); return false; }
    if (d.error === 'short') { say(msg, `That needs ${creditsText(need)}: you have ${creditsText(d.have ?? ctx.credits)}.`); ctx.buyCredits({ need }); return false; }
    say(msg, errorText(d.error));
    return false;
  }
  async function enough(need) {
    if (ctx.credits >= need) return true;
    await ctx.buyCredits({ need });
    return ctx.credits >= need;
  }
  // the panel's button for a tool, its price kept up to date: what it makes (a key of the price table: 'trend', 'model'), or
  // (phase 4, the model menu) a function that works out its price from the form's choices
  function goFor(label, what, iconName = 'spark') {
    const go = goButton(label, iconName);
    const entry = [go, what];
    const now = () => (typeof entry[1] === 'function' ? entry[1]() : price(entry[1]));
    go.refresh = () => { const n = now(); go.setPrice(n); cost.need(n); };
    // (round 4) what it makes can change with a choice (a photo, a meme, an X banner): its price follows
    go.setWhat = (w) => { entry[1] = w; go.refresh(); };
    go.cost = now;
    go.refresh();
    priced.push(entry);
    return go;
  }
  const errLine = () => h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const hint = (text) => h('p', { class: 'sa-ws-hint', text });
  function sceneField(ideas, { value = '', label = 'The scene' } = {}) {
    const id2 = nextId('scene');
    const area = h('textarea', { class: 'sa-input sa-textarea', id: id2, rows: 4, maxlength: SCENE_MAX, placeholder: 'Describe the scene…', value });
    const count = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `${[...value].length}/${SCENE_MAX}` });
    const err = errLine();
    const lab = h('label', { class: 'sa-label', for: id2, text: label });
    area.addEventListener('input', () => { count.textContent = `${[...area.value].length}/${SCENE_MAX}`; say(err, ''); });
    const ideaRow = h('div', { class: 'sa-ideas' });
    const fillIdeas = (list) => put(ideaRow, h('span', { class: 'sa-hint', text: 'Ideas' }), ...list.slice(0, 6).map((t) => {
      const b = h('button', { type: 'button', class: 'sa-idea', text: t });
      b.addEventListener('click', () => { area.value = t; area.dispatchEvent(new Event('input')); area.focus(); });
      return b;
    }));
    fillIdeas(ideas);
    return {
      node: h('div', { class: 'sa-field', dataset: { guide: 'scene' } }, lab, area, h('div', { class: 'sa-field-foot' }, err, count), ideaRow),
      area, err, setIdeas: fillIdeas,
      setLabel(t, placeholder = null) { lab.textContent = t; if (placeholder) area.placeholder = placeholder; },
      get value() { return area.value.trim(); },
      set value(v) { area.value = v; area.dispatchEvent(new Event('input')); },
      check() {
        const v = area.value.trim();
        if ([...v].length < SCENE_MIN) { say(err, wordsText('scene', v ? 'short' : 'empty')); ws.reveal(area); return false; }
        return true;
      },
    };
  }
  const shapeSeg = (value = 'tall', onchange = null) => segmented({ legend: 'Shape', choices: SHAPE_CHOICES, value, showLegend: true, cls: 'sa-seg-shape', onchange });
  // its done photos to start from (its full body too when it isn't required); never an X banner or a meme (rules.js
  // startPhotos). setRequired: whether a photo is needed (phase 4: Standard, Pro and Long start from one; Anime may start from
  // its full body). (2026-10-13, "With AGI-1") only: which of its photos it offers: 'her' (only photos AGI-1 is in: a
  // Standard, Pro or Long video with her starts from one), 'not' (only photos without her: a trend video puts the influencer in
  // place of one person, and a video from a photo she's in has her too), or null (all); setOnly changes it (the Video tool's
  // switch and its model)
  function startFrom({ value = null, required = false, onchange = () => {}, onEmpty = null, only = null } = {}) {
    const all = startPhotos(page.jobs);
    const keep = (o) => (o === 'her' ? all.filter((p) => p.agi1 === true) : o === 'not' ? all.filter((p) => p.agi1 !== true) : all);
    let filter = only === 'her' || only === 'not' ? only : null;
    let photos = keep(filter);
    let pickedId = value && photos.some((p) => p.id === value) ? value : null;
    let need = required;
    let emptyKey = null;
    const legend = h('legend', { class: 'sa-label' });
    const row = h('div', { class: 'sa-start-row', role: 'radiogroup', 'aria-label': 'Start from' });
    const empty = h('div', { class: 'sa-start-empty', hidden: true });
    const draw0 = () => {
      const her = filter === 'her';
      legend.textContent = need ? (her ? 'Start from a photo AGI-1 is in' : 'Start from one of its photos') : 'Start from (optional)';
      // (a photo it doesn't offer now is never kept picked: the switch moved it out)
      if (pickedId !== null && !photos.some((p) => p.id === pickedId)) pickedId = null;
      if (need && pickedId === null && photos.length) pickedId = photos[0].id;
      const opts = [];
      if (!need) {
        const b = h('button', { type: 'button', class: 'sa-start', role: 'radio', 'aria-checked': String(pickedId === null) },
          inf().body ? pic(infPic(id, inf().body, 0, true), { cls: 'sa-start-pic' }) : h('span', { class: 'sa-start-pic is-missing' }), h('span', { text: 'Full body' }));
        b.addEventListener('click', () => { pickedId = null; draw0(); onchange(null); });
        opts.push(b);
      }
      for (const p of photos.slice(0, 12)) {
        const withHer = p.agi1 === true;
        const b = h('button', { type: 'button', class: `sa-start${withHer ? ' has-her' : ''}`, role: 'radio', 'aria-checked': String(pickedId === p.id), title: p.scene || '' },
          pic(infPic(id, p.id, 0, true), { cls: 'sa-start-pic' }),
          withHer ? h('span', { class: 'sa-start-her', 'aria-hidden': 'true' }, icon('agi1')) : null,
          h('span', null, h('span', { text: SHAPES[p.shape]?.name || 'Photo' }), withHer ? h('span', { class: 'sa-sr', text: ', with AGI-1' }) : null));
        b.addEventListener('click', () => { pickedId = p.id; draw0(); onchange(p.id, p); });
        opts.push(b);
      }
      put(row, ...opts);
      row.hidden = !opts.length;
      // a photo is needed and there's none (with AGI-1: none she's in) yet: say so, with a way to make one (drawn again only
      // when what it says changes, so the keyboard stays on its button)
      empty.hidden = !(need && !photos.length);
      const key = empty.hidden ? null : her ? 'her' : 'any';
      if (key !== emptyKey) {
        emptyKey = key;
        if (!key) put(empty);
        else {
          const mk = btn(her ? 'Make a photo with AGI-1' : 'Make a photo first', { kind: 'ghost', size: 'sm', icon: her ? 'agi1' : 'image' });
          mk.addEventListener('click', () => (her ? openTool('photo', { agi1: true }) : onEmpty ? onEmpty() : openTool('photo')));
          put(empty, h('p', { class: 'sa-ws-hint', text: her ? HER_NO_PHOTO : 'It starts from one of its photos, and it has none yet.' }), mk);
        }
      }
    };
    draw0();
    return {
      node: h('fieldset', { class: 'sa-chips sa-start-set' }, legend, row, empty),
      get value() { return pickedId; },
      get ok() { return !need || Boolean(pickedId); },
      // the photo picked (its job), or null
      get picked() { return pickedId ? all.find((p) => p.id === pickedId) || null : null; },
      setRequired(on) {
        if (Boolean(on) === need) return;
        need = Boolean(on);
        draw0();
        onchange(pickedId);
      },
      setOnly(o) {
        const next = o === 'her' || o === 'not' ? o : null;
        if (next === filter) return;
        filter = next;
        photos = keep(filter);
        draw0();
        onchange(pickedId);
      },
    };
  }

  // "With AGI-1" (2026-10-13, the owner's choices: her own 2D anime self, cute and a little flirty, PG-13, the same price): a
  // highlighted switch at the top of the Photo and Video tools: her face (the owner's 2D art, never her 3D model), its name, and
  // its line (what she does in that tool). A tap anywhere on it switches it; screen readers hear "With AGI-1, switch", its line
  // as its description. onchange(on)
  function herSwitch({ on = false, onchange = () => {} } = {}) {
    let value = Boolean(on);
    const noteId = nextId('her');
    const note = h('span', { class: 'sa-her-note', id: noteId });
    const sw = h('button', { type: 'button', class: 'sa-her', role: 'switch', 'aria-checked': String(value), 'aria-label': WITH_AGI1.NAME, 'aria-describedby': noteId },
      pic(WITH_AGI1.FACE, { cls: 'sa-her-face', lazy: false }),
      h('span', { class: 'sa-her-text' }, h('span', { class: 'sa-her-name', text: WITH_AGI1.NAME }), note),
      h('span', { class: 'sa-switch-knob', 'aria-hidden': 'true' }));
    sw.addEventListener('click', () => {
      value = !value;
      sw.setAttribute('aria-checked', String(value));
      onchange(value);
    });
    return {
      node: sw,
      get on() { return value; },
      setNote(t) { if (note.textContent !== t) note.textContent = t; },
    };
  }

  // Reference pictures (phase 4): a thing, a place, a pet, food or a style to put in it (never a person: the influencer is the
  // person), uploaded here and looked at by our server first; kept for this visit (refsOf), so every tool shares them. max: how
  // many this model takes (the first ones go in)
  function refsField(host, { max = REFS.MAX } = {}) {
    let limit = max, sending = false;
    const wallet = () => ctx.session?.wallet || null;
    const fileId = nextId('ref'), labelId = nextId('refl');
    const file = h('input', { type: 'file', class: 'sa-file', id: fileId, accept: 'image/jpeg,image/png,image/webp', 'aria-describedby': `${labelId}-n` });
    const row = h('div', { class: 'sa-refs-row' });
    const count = h('span', { class: 'sa-count', 'aria-hidden': 'true' });
    const state = h('p', { class: 'sa-up-state', role: 'status', hidden: true });
    const note = h('p', { class: 'sa-fine sa-refs-extra', hidden: true });
    const human = h('div', { class: 'sa-human' });
    const draw0 = () => {
      const list = refsOf(wallet());
      const tiles = list.map((r, k) => {
        const rm = h('button', { type: 'button', class: 'sa-ref-x', 'aria-label': `Remove reference ${k + 1}` }, icon('close'));
        rm.addEventListener('click', () => {
          const at = refStore.list.findIndex((x) => x.id === r.id);
          if (at >= 0) { URL.revokeObjectURL(refStore.list[at].url); refStore.list.splice(at, 1); }
          draw0();
          (row.querySelector('.sa-ref-x') || row.querySelector('.sa-ref-add'))?.focus();
        });
        return h('span', { class: `sa-ref${k >= limit ? ' is-extra' : ''}` }, pic(r.url, { cls: 'sa-ref-pic', alt: `Reference ${k + 1}${k >= limit ? ' (not used by this one)' : ''}`, lazy: false }), rm);
      });
      const canAdd = list.length < REFS.MAX && !sending;
      file.disabled = !canAdd;
      put(row, ...tiles, list.length < REFS.MAX ? h('label', { class: `sa-ref-add${sending ? ' is-busy' : ''}`, for: fileId },
        sending ? h('span', { class: 'sa-spin', 'aria-hidden': 'true' }) : icon('plus'), h('span', { text: sending ? 'Checking…' : list.length ? 'Add' : 'Add a reference' })) : null);
      count.textContent = `${Math.min(list.length, limit)}/${limit}`;
      say(note, list.length > limit ? `This one takes ${limit} reference${limit === 1 ? '' : 's'}: the first ${limit} go in.` : '');
    };
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f || sending) return;
      sending = true;
      say(state, '');
      draw0();
      const blob = await shrinkPicture(f);
      let r = { ok: false, error: 'picture' };
      if (blob) r = await uploadRef(ctx.act, { blob, human });
      sending = false;
      if (r.ok) {
        refsOf(wallet()).push({ id: r.id, url: URL.createObjectURL(blob), at: Date.now() });
        if (host.alive()) { say(state, 'Reference added ✓'); draw0(); }
        return;
      }
      if (!host.alive()) return;
      draw0();
      say(state, upErrorText(r, 'ref'));
    });
    draw0();
    return {
      node: h('div', { class: 'sa-field sa-refs' },
        h('div', { class: 'sa-label-row' }, h('span', { class: 'sa-label', id: labelId }, icon('paperclip'), h('span', { text: 'References (optional)' })), count),
        h('p', { class: 'sa-hint', id: `${labelId}-n`, text: REFS.NOTE }), file, row, state, note, human),
      setMax(n) { limit = Math.max(0, Number(n) || 0); draw0(); },
      ids() { return refsOf(wallet()).slice(0, limit).map((r) => r.id); },
      get busy() { return sending; },
    };
  }

  // ---------- Photo: a photo, a meme or an X banner (all three are photos) ----------
  // (phase 4) the model menu: Classic or Crisp, and its quality; a meme (its format and words, written into the picture by the
  // AI: Classic only); an X banner (round 4: made wide, then cut to exactly X's header size, 1500 × 500: Classic, HD); and
  // reference pictures for each. (2026-10-13) "With AGI-1": its switch at the top puts AGI-1 in it (a photo, a meme or an X
  // banner, Classic only: rules.js WITH_AGI1), at the same price; agi1: it starts on (her start photo's "Make a photo with
  // AGI-1")
  function photoTool(host, { kind: startKind = null, shape: start = 'tall', meme: memeStart = null, agi1 = false } = {}) {
    const i = inf();
    const st = {
      kind: startKind || (start === 'banner' ? 'banner' : memeStart ? 'meme' : 'photo'),
      model: 'classic', quality: 'std', meme: memeStart?.meme && MEMES[memeStart.meme] ? memeStart.meme : 'topbottom',
      her: agi1 === true,
    };
    const msg = errLine();
    const shape = shapeSeg(SHAPES[start] ? start : st.kind === 'meme' ? 'square' : 'tall', () => sync());
    const spec = () => (st.kind === 'banner' ? { model: 'classic', quality: 'hd', shape: 'banner' }
      : st.kind === 'meme' ? { model: 'classic', quality: st.quality, shape: shape.value || 'square', meme: st.meme }
        : { model: st.model, quality: st.quality, shape: shape.value || 'tall' });
    const go = goFor('Make photo', () => photoCredits(spec(), ctx.level), 'image');
    const kinds = segmented({ legend: 'What to make', choices: [['photo', 'Photo', 'image'], ['meme', 'Meme', 'smile'], ['banner', 'X banner', 'image']],
      value: st.kind, cls: 'sa-seg-kind', onchange: (v) => { st.kind = v; sync(); } });
    const models = cardPick({ legend: 'Model', choices: Object.entries(PHOTO_MODELS).map(([value, m]) => ({ value, name: m.name, note: m.note })), value: st.model,
      onchange: (v) => { st.model = v; sync(); } });
    // (2026-10-13) with AGI-1: Classic only (it keeps her exactly as she's drawn): another model picked switches to it
    const her = herSwitch({ on: st.her, onchange: (on) => {
      st.her = on;
      if (on && st.model !== WITH_AGI1.PHOTO_MODEL) { st.model = WITH_AGI1.PHOTO_MODEL; models.set(st.model); }
      sync();
    } });
    const qualityBox = h('div', { class: 'sa-field' });
    let qualityKey = null;
    function drawQuality() {
      const qs = Object.keys(PHOTO_MODELS[st.kind === 'meme' ? 'classic' : st.model].cents);
      if (!qs.includes(st.quality)) st.quality = qs[0];
      const key = `${qs.join()}|${st.quality}`;
      if (key === qualityKey) return;
      qualityKey = key;
      put(qualityBox, segmented({ legend: 'Quality', choices: qs.map((q) => [q, `${PHOTO_QUALITY[q].name} · ${PHOTO_QUALITY[q].px}`]), value: st.quality, showLegend: true,
        cls: 'sa-seg-shape', onchange: (v) => { st.quality = v; qualityKey = `${qs.join()}|${v}`; sync(); } }).node);
    }
    const scene = sceneField(PHOTO_IDEAS);
    const about = h('p', { class: 'sa-ws-hint sa-shape-note', hidden: true });
    const meme = memeFields();
    const refs = refsField(host, { max: PHOTO_MODELS.classic.refs });
    const modelBox = h('div', { class: 'sa-field', dataset: { guide: 'models' } }, models.node);
    const shapeBox = h('div', { class: 'sa-field' }, shape.node);
    function sync() {
      const banner = st.kind === 'banner', isMeme = st.kind === 'meme';
      modelBox.hidden = banner || isMeme;
      qualityBox.hidden = banner;
      shapeBox.hidden = banner;
      meme.node.hidden = !isMeme;
      if (!banner) drawQuality();
      her.setNote(herNote(i.name));
      scene.setIdeas(banner ? BANNER_IDEAS : st.her ? AGI1_IDEAS : isMeme ? MEME_IDEAS : PHOTO_IDEAS);
      scene.setLabel(isMeme ? 'What the picture shows' : 'The scene', isMeme ? 'Describe the picture under the words…' : 'Describe the scene…');
      say(about, banner ? `Exactly ${BANNER.W} × ${BANNER.H}, ready for your X header (HD, Classic). ${i.name} sits on the right: the lower left stays clear for your profile picture.`
        : isMeme ? `${i.name} in a meme: the AI writes your words into the picture. Classic only (it writes words best). Never about money, coins or prices.` : '');
      go.setLabel(banner ? 'Make X banner' : isMeme ? 'Make meme' : 'Make photo');
      refs.setMax(refsFor('photo', banner || isMeme ? 'classic' : st.model, st.her));
      // each model's price for this shape (from its cheapest quality); with AGI-1, Classic only
      const lvl = ctx.level;
      models.update(Object.keys(PHOTO_MODELS).map((m) => {
        const ps = Object.keys(PHOTO_MODELS[m].cents).map((q) => photoCredits({ model: m, quality: q, shape: shape.value || 'tall' }, lvl));
        return { value: m, price: Math.min(...ps), from: new Set(ps).size > 1, off: st.her && m !== WITH_AGI1.PHOTO_MODEL, why: HER_CLASSIC_WHY };
      }));
      go.refresh();
      say(msg, '');
    }
    // (2026-10-13) her own name typed with the switch off: switch it on instead (our server says the same: "her")
    const herNamed = (field) => !st.her && (field === 'caption' ? meme.lines.some(mentionsAgi1) : mentionsAgi1(scene.value));
    go.node.addEventListener('click', () => {
      if (st.kind === 'meme' && !meme.check()) return;
      if (!scene.check()) return;
      if (st.kind === 'meme' && herNamed('caption')) { say(meme.err, HER_NAME_HINT); ws.reveal(meme.err, { focus: false }); return; }
      if (herNamed('scene')) { say(scene.err, HER_NAME_HINT); ws.reveal(scene.area); return; }
      if (refs.busy) { say(msg, 'Wait for your reference to finish its check.'); return; }
      const need = go.cost();
      busy(go.node, 'Starting…', async () => {
        if (!(await enough(need))) return;
        const s0 = spec();
        const body = { id, kind: 'photo', scene: scene.value, shape: s0.shape, model: s0.model, quality: s0.quality };
        if (st.kind === 'meme') Object.assign(body, { meme: st.meme, lines: meme.lines });
        if (st.her) body.agi1 = true;
        const ids = refs.ids();
        if (ids.length) body.refs = ids;
        const r = await ctx.act('inf-make', body);
        const onWords = (d) => say(d.field === 'scene' ? scene.err : d.field === 'caption' || d.field === 'meme' ? meme.err : msg,
          d.why === 'her' && herNamed(d.field) ? HER_NAME_HINT : wordsText(d.field, d.why));
        if (made(r, need, { msg, onWords })) {
          const w = st.kind === 'banner' ? 'X banner' : st.kind === 'meme' ? 'meme' : 'photo';
          ctx.toast(st.her ? `Making its ${w} with AGI-1: about half a minute` : `Making its ${w}: about half a minute`, 'good');
          host.done();
          load();
        }
      });
    });
    put(host.body, hint(`${i.name} in any scene you describe: about half a minute.`), her.node, h('div', { class: 'sa-field' }, kinds.node, about),
      meme.node, scene.node, modelBox, qualityBox, shapeBox, refs.node);
    host.setFoot(msg, go.node);
    if (memeStart) meme.fill(memeStart);
    sync();

    // a meme's format and words (one box per line of its format)
    function memeFields() {
      const err = errLine();
      const fmt = chips({ legend: 'Format', choices: Object.entries(MEMES).map(([k, m]) => [k, m.name]), value: st.meme, onchange: (v) => { st.meme = v; drawLines(); sync(); } });
      const fmtNote = h('p', { class: 'sa-hint' });
      const linesBox = h('div', { class: 'sa-meme-lines' });
      let inputs = [];
      const sample = (meme0, k) => MEME_READY.find((m) => m.meme === meme0)?.lines[k]?.replace(/^pov\s*:\s*/i, '') || '';
      function drawLines(values = null) {
        const was = values || inputs.map((x) => x.input.value);
        const m = MEMES[st.meme];
        fmtNote.textContent = m.note;
        inputs = m.lines.map((label, k) => {
          const fid = nextId('ml');
          const input = h('input', { class: 'sa-input', id: fid, type: 'text', maxlength: MEME_LINE_MAX, autocomplete: 'off', placeholder: sample(st.meme, k), value: was[k] || '' });
          input.addEventListener('input', () => say(err, ''));
          const pov = st.meme === 'pov';
          return { input, node: h('div', { class: 'sa-meme-line' }, h('label', { class: 'sa-label', for: fid, text: pov ? 'Your line' : label }),
            pov ? h('div', { class: 'sa-pov' }, h('span', { class: 'sa-pov-pre', 'aria-hidden': 'true', text: 'POV:' }), input) : input) };
        });
        put(linesBox, ...inputs.map((x) => x.node));
      }
      const surprise = btn('Surprise me', { kind: 'quiet', size: 'sm', icon: 'wand' });
      let last = null;
      surprise.addEventListener('click', () => {
        const pool = MEME_READY.filter((m) => m.id !== last);
        const m = pool[Math.floor(Math.random() * pool.length)];
        last = m.id;
        api.fill(m);
        sync();
      });
      drawLines([]);
      const api = {
        node: h('div', { class: 'sa-field sa-meme', hidden: true }, fmt.node, fmtNote, h('div', { class: 'sa-row-between sa-meme-head' }, h('span', { class: 'sa-label', text: 'Its words' }), surprise), linesBox, err),
        err,
        get lines() { return inputs.map((x) => (st.meme === 'pov' ? `POV: ${x.input.value.trim()}` : x.input.value.trim())); },
        fill(m) {
          st.meme = m.meme;
          fmt.set(m.meme);
          drawLines(memeInputs(m));
          if (m.scene) scene.value = m.scene;
          say(err, '');
        },
        check() {
          const empty = inputs.find((x) => !x.input.value.trim());
          if (empty) { say(err, wordsText('caption', 'empty')); ws.reveal(empty.input); return false; }
          return true;
        },
      };
      return api;
    }
  }

  // ---------- Video ----------
  // (phase 4) the model menu: Standard (720p) and Pro (1080p) from one of its photos, Anime (an anime or 3D cartoon influencer:
  // from its full body or a photo), Long (up to a minute, made in parts, without sound); its length, Anime's quality, sound
  // (Long: none), and reference pictures. (2026-10-13) "With AGI-1": its switch at the top puts AGI-1 in it, at the same price:
  // a Standard, Pro or Long video then starts from a photo she's in (she's in its first frame), and Anime puts her in from her
  // own pictures; switched off, it never starts from a photo she's in (she'd be in it anyway). On when asked (agi1), or when it
  // starts from a photo she's in ("Make a video from it")
  function videoTool(host, { image = null, agi1 = false } = {}) {
    const i = inf();
    // (2026-10-11) Anime is for the drawn styles (src/studio/rules.js drawnStyle: anime, comics, 3D, toys and art, or a drawing
    // with no style picked), as our server says
    const animeOk = drawnStyle(i);
    const startJob = image ? startPhotos(page.jobs).find((p) => p.id === image) || null : null;
    const st = { model: image ? 'standard' : animeOk ? 'anime' : 'standard', seconds: null, quality: '720p', sound: true, her: agi1 === true || startJob?.agi1 === true };
    let ideasHer = st.her;
    const scene = sceneField(st.her ? AGI1_VIDEO_IDEAS : VIDEO_IDEAS);
    const msg = errLine();
    const shape = shapeSeg('tall');
    const shapeBox = h('div', { class: 'sa-field' }, shape.node);
    const spec = () => ({ model: st.model, seconds: st.seconds, sound: st.model === 'long' ? false : st.sound, quality: st.model === 'anime' ? st.quality : null });
    const go = goFor('Make video', () => videoCredits(spec(), ctx.level), 'film');
    const lvl = () => ctx.level;
    const models = cardPick({
      legend: 'Model',
      choices: Object.entries(VIDEO_MODELS).map(([value, m]) => ({ value, name: m.name, note: m.note, off: value === 'anime' && !animeOk, why: ANIME_WHY })),
      value: st.model, onchange: (v) => { st.model = v; sync(); },
    });
    const lenBox = h('div', { class: 'sa-field' });
    const qualBox = h('div', { class: 'sa-field' });
    const soundId = nextId('sound');
    const sound = h('input', { type: 'checkbox', id: soundId, class: 'sa-check', checked: st.sound });
    sound.addEventListener('change', () => { st.sound = sound.checked; sync(); });
    const soundBox = h('div', { class: 'sa-consent sa-consent-sm' }, sound, h('label', { for: soundId, text: 'With sound (its sounds and music, made by AI too)' }));
    const longNote = h('p', { class: 'sa-note', hidden: true });
    // which of its photos it may start from: with AGI-1, a Standard, Pro or Long video only from one she's in (Anime: any, it
    // puts her in from her own pictures); without her, only one she isn't in
    const onlyFor = () => (st.her ? (st.model === 'anime' ? null : 'her') : 'not');
    const her = herSwitch({ on: st.her, onchange: (on) => { st.her = on; sync(); } });
    const from = startFrom({ value: image, required: st.model !== 'anime', only: onlyFor(), onchange: (v) => { shapeBox.hidden = Boolean(v); } });
    const refs = refsField(host, { max: refsFor('video', st.model, st.her) });
    let lenKey = null, qualKey = null;
    function sync() {
      const m = VIDEO_MODELS[st.model];
      if (!m.seconds.includes(st.seconds)) st.seconds = m.seconds[0];
      const lk = `${st.model}|${st.seconds}`;
      if (lk !== lenKey) {
        lenKey = lk;
        put(lenBox, segmented({ legend: 'Length', choices: m.seconds.map((x) => [String(x), secondsText(x)]), value: String(st.seconds), showLegend: true, cls: 'sa-seg-shape',
          onchange: (v) => { st.seconds = Number(v); lenKey = `${st.model}|${st.seconds}`; sync(); } }).node);
      }
      qualBox.hidden = st.model !== 'anime';
      if (st.model === 'anime' && qualKey !== st.quality) {
        qualKey = st.quality;
        put(qualBox, segmented({ legend: 'Quality', choices: Object.entries(ANIME_QUALITY).map(([q, x]) => [q, x.name]), value: st.quality, showLegend: true, cls: 'sa-seg-shape',
          onchange: (v) => { st.quality = v; qualKey = v; sync(); } }).node);
      }
      soundBox.hidden = st.model === 'long';
      from.setRequired(st.model !== 'anime');
      from.setOnly(onlyFor());
      shapeBox.hidden = Boolean(from.value);
      // (with AGI-1, Kling's videos take one reference less: she's one of its pictures)
      refs.setMax(refsFor('video', st.model, st.her));
      her.setNote(herNote(i.name, { video: true, model: st.model }));
      if (ideasHer !== st.her) { ideasHer = st.her; scene.setIdeas(st.her ? AGI1_VIDEO_IDEAS : VIDEO_IDEAS); }
      // a long video: its parts, no sound, and how long it usually takes
      const total = videoPlan({ model: st.model, seconds: st.seconds }).reduce((a, [, x]) => a + x, 0);
      say(longNote, st.model === 'long'
        ? `Made in ${Math.ceil(st.seconds / 15)} parts, each starting where the last one ended, then joined: ${leftWords(total).replace(' left', '')}. Without sound (add your own music when you post it).`
        : '');
      go.setLabel(st.model === 'long' ? `Make ${secondsText(st.seconds)} video` : 'Make video');
      // each model's price from its cheapest length (silent; Anime at 480p, its sound free)
      models.update(Object.keys(VIDEO_MODELS).map((k) => {
        const vm = VIDEO_MODELS[k];
        const p = videoCredits({ model: k, seconds: vm.seconds[0], sound: false, quality: k === 'anime' ? '480p' : null }, lvl());
        return { value: k, price: p, from: true };
      }));
      go.refresh();
      say(msg, '');
    }
    // (2026-10-13) her own name typed with the switch off: switch it on instead (our server says the same: "her")
    const herNamed = () => !st.her && mentionsAgi1(scene.value);
    go.node.addEventListener('click', () => {
      if (!scene.check()) return;
      if (herNamed()) { say(scene.err, HER_NAME_HINT); ws.reveal(scene.area); return; }
      if (!from.ok) { say(msg, errorText(st.her && st.model !== 'anime' ? 'agi1_photo' : 'needs_photo')); ws.reveal(from.node, { focus: false }); return; }
      if (refs.busy) { say(msg, 'Wait for your reference to finish its check.'); return; }
      const need = go.cost();
      busy(go.node, 'Starting…', async () => {
        if (!(await enough(need))) return;
        const s0 = spec();
        const body = { id, kind: 'video', scene: scene.value, shape: shape.value || 'tall', model: s0.model, seconds: s0.seconds, sound: s0.sound, ...(s0.quality ? { quality: s0.quality } : {}),
          ...(from.value ? { image: from.value } : {}), ...(st.her ? { agi1: true } : {}) };
        const ids = refs.ids();
        if (ids.length) body.refs = ids;
        const r = await ctx.act('inf-make', body);
        const onWords = (d) => say(d.field === 'scene' ? scene.err : msg, d.why === 'her' && herNamed() ? HER_NAME_HINT : wordsText(d.field, d.why));
        if (made(r, need, { msg, onWords })) {
          const withHer = st.her ? ' with AGI-1' : '';
          ctx.toast(st.model === 'long' ? `Making its ${secondsText(st.seconds)} video${withHer}: it takes a while, in parts` : `Making its video${withHer}: a few minutes`, 'good');
          host.done();
          load();
        }
      });
    });
    put(host.body, hint(`${i.name} in any scene you describe: a few minutes.`), her.node, h('div', { class: 'sa-field', dataset: { guide: 'models' } }, models.node), scene.node, lenBox, qualBox, longNote,
      from.node, shapeBox, soundBox, refs.node);
    host.setFoot(msg, go.node);
    sync();
  }

  // ---------- Instant (phase 4): ready-made ideas, one tap makes one (Classic photos; X banners; memes with their words; a
  // 5-second Standard video, silent, from its newest photo; its 3D model). Never a coin. (2026-10-13) "With AGI-1": photos of
  // it with AGI-1, and videos with her from its newest photo she's in (the plain videos from its newest photo she isn't in:
  // she'd be in those too) ----------
  function instantTool(host) {
    const i = inf();
    const msg = errLine();
    const newest = startPhotos(page.jobs).find((p) => p.agi1 !== true) || null;
    const newestHer = herPhotos(page.jobs)[0] || null;
    const isVideo = (kind) => kind === 'video' || kind === 'agi1Video';
    const fromOf = (kind) => (kind === 'agi1Video' ? newestHer : newest);
    const priceFor = (kind, idea) => (isVideo(kind) ? videoCredits(INSTANT_MAKES[kind], ctx.level)
      : photoCredits({ ...INSTANT_MAKES[kind], meme: kind === 'meme' ? idea.meme : null }, ctx.level));
    const chip = (kind, idea) => {
      const n = priceFor(kind, idea);
      const off = isVideo(kind) && !fromOf(kind);
      const b = h('button', { type: 'button', class: 'sa-ichip', disabled: off, title: idea.lines ? idea.lines.join(' / ') : idea.scene },
        h('span', { class: 'sa-ichip-emoji', 'aria-hidden': 'true', text: idea.emoji }), h('span', { class: 'sa-ichip-label', text: idea.label }),
        h('span', { class: 'sa-ichip-price' }, icon('bolt'), h('span', { text: num(n) }), h('span', { class: 'sa-sr', text: ' credits' })));
      b.addEventListener('click', () => makeIt(kind, idea, b, n));
      return b;
    };
    const group = (kind, title, ic, list, extra = null, cls = '') => h('section', { class: `sa-igroup${cls}`, 'aria-label': title },
      h('h3', { class: 'sa-igroup-h' }, icon(ic), h('span', { text: title })), extra, h('div', { class: 'sa-igrid' }, ...list.map((idea) => chip(kind, idea))));
    const parts = [
      h('p', { class: 'sa-ws-hint', text: `One tap on an idea makes ${i.name}'s at once, at the price on it.` }),
      // (2026-10-13) with AGI-1 first: the new one, highlighted
      group('agi1', WITH_AGI1.NAME, 'agi1', INSTANT.agi1, h('p', { class: 'sa-ws-hint', text: `${i.name} together with AGI-1, her own 2D anime self. The same price.` }), ' is-agi1'),
      group('photo', 'Photos', 'image', INSTANT.photo),
      group('meme', 'Memes', 'smile', INSTANT.meme),
      group('banner', 'X banners · 1500 × 500', 'image', INSTANT.banner),
      group('video', 'Videos · 5 s', 'film', INSTANT.video, newest ? null : h('p', { class: 'sa-ws-hint', text: 'Videos start from its newest photo: make a photo first (one tap above).' })),
      group('agi1Video', `Videos with AGI-1 · 5 s`, 'agi1', INSTANT.agi1Video,
        newestHer ? null : h('p', { class: 'sa-ws-hint', text: 'Videos with her start from its newest photo she\'s in: make one with her first (one tap above).' }), ' is-agi1'),
    ];
    // its 3D model as it comes (its usual moves: its choices are the 3D tool's), a Soulmate's first each month free (while our
    // server says it's still to use)
    if (ctx.info?.threeD) {
      const free = soulmateFree();
      const b = h('button', { type: 'button', class: 'sa-ichip sa-ichip-wide' }, h('span', { class: 'sa-ichip-emoji', 'aria-hidden': 'true', text: '🧊' }),
        h('span', { class: 'sa-ichip-label', text: 'Its 3D model' }),
        h('span', { class: 'sa-ichip-price' }, free ? h('span', { text: 'Free this month' }) : [icon('bolt'), h('span', { text: num(price('model')) }), h('span', { class: 'sa-sr', text: ' credits' })]));
      b.addEventListener('click', () => busy(b, 'Starting…', async () => {
        if (!free && !(await enough(price('model')))) return;
        const r = await ctx.act('inf-3d', { id });
        if (made(r, price('model'), { msg })) {
          ctx.toast(r.data?.free ? 'Making it in 3D, free: about 5 to 10 minutes' : 'Making it in 3D: about 5 to 10 minutes', 'good');
          sigs.models = null;
          load();
        }
      }));
      parts.push(h('section', { class: 'sa-igroup', 'aria-label': '3D' }, h('h3', { class: 'sa-igroup-h' }, icon('cube'), h('span', { text: '3D' })), h('div', { class: 'sa-igrid' }, b)));
    }
    parts.push(h('p', { class: 'sa-fine', text: 'A coin is never one tap: switch Instant off to launch one, or for every choice (models, quality, length, references).' }));
    put(host.body, ...parts);
    const off = btn('Every choice', { kind: 'ghost', icon: 'sliders' });
    off.addEventListener('click', () => setInstantMode(false, { remember: true }));
    host.setFoot(msg, off);

    async function makeIt(kind, idea, b, need) {
      if (isVideo(kind) && !fromOf(kind)) return;
      await busy(b, 'Starting…', async () => {
        if (!(await enough(need))) return;
        const mk = INSTANT_MAKES[kind];
        const her = mk.agi1 === true ? { agi1: true } : {};
        const body = isVideo(kind)
          ? { id, kind: 'video', model: mk.model, seconds: mk.seconds, sound: mk.sound, scene: idea.scene, image: fromOf(kind).id, ...her }
          : { id, kind: 'photo', model: mk.model, quality: mk.quality, shape: mk.shape, scene: idea.scene, ...(kind === 'meme' ? { meme: idea.meme, lines: idea.lines } : {}), ...her };
        const r = await ctx.act('inf-make', body);
        if (made(r, need, { msg })) {
          ctx.toast(`Making “${idea.label}”: ${isVideo(kind) ? 'a few minutes' : 'about half a minute'}`, 'good');
          load();
        }
      });
    }
  }

  // ---------- Trend video (round 2: the influencer put into a real-looking clip in place of its person, keeping the clip's
  // moves, camera, place, light, and (a trend clip's) its sound; or into their own clip, without its sound) ----------
  function trendTool(host, { image = null, trend = null } = {}) {
    const i = inf();
    const st = { trend, clip: null, shape: 'tall', tab: 'moves' };
    const msg = errLine();
    const human = h('div', { class: 'sa-human' });
    const go = goFor('Make trend video', 'trend', 'zap');
    const which = segmented({ legend: 'The clip', choices: [['moves', 'Trending clips', 'zap'], ['clip', 'My own clip', 'upload']], value: 'moves', onchange: (v) => {
      st.tab = v;
      movesPanel.hidden = v !== 'moves';
      clipPanel.hidden = v !== 'clip';
      say(msg, '');
    } });
    const movesPanel = h('div', { class: 'sa-tab-panel' });
    const clipPanel = h('div', { class: 'sa-tab-panel', hidden: true });
    // the trend clips (the owner's, made with AI once: a made-up person, its camera move and its sound)
    const about = h('p', { class: 'sa-ws-hint', hidden: true });
    // (2026-10-11) the picked clip's prompt, to copy (and use in a video of your own)
    const aboutCopy = btn('Copy its prompt', { kind: 'ghost', size: 'sm', icon: 'copy' });
    aboutCopy.hidden = true;
    aboutCopy.addEventListener('click', async () => {
      const t = trendOf(st.trend);
      if (!t) return;
      const copied = await copyText(trendPrompt(t));
      ctx.toast(copied ? 'Prompt copied: paste it into Video, or any of your tools' : "Couldn't copy it here: open the clip in Explore to see its prompt", copied ? 'good' : 'info');
    });
    const showAbout = () => {
      const t = trendOf(st.trend);
      say(about, t ? `${t.emoji} ${t.name}: ${t.camera}, with its own sound.` : '');
      aboutCopy.hidden = !t;
    };
    add(movesPanel, h('p', { class: 'sa-ws-hint', text: 'Loading the clips…' }));
    ctx.exploreData().then((data) => {
      if (!host.alive()) return;
      const list = (data?.trends || []).filter((t) => t.job);
      if (!list.length) { put(movesPanel, h('p', { class: 'sa-ws-hint', text: 'No trending clips yet: use your own clip.' })); return; }
      const grid = h('div', { class: 'sa-trend-grid' });
      const fill = () => put(grid, ...list.map((t) => trendTile(t, { selected: st.trend === t.id, small: true, onpick: (x) => { st.trend = x.id; say(msg, ''); fill(); showAbout(); } })));
      fill();
      put(movesPanel, grid, about, aboutCopy, h('p', { class: 'sa-fine', text: 'Made-up people in our own clips: your influencer takes their place.' }));
      showAbout();
    });
    // their own clip: 3 to 10 s, 720 to 2160 px a side, checked as it's sent
    const fileId = nextId('clip');
    const file = h('input', { type: 'file', class: 'sa-file', id: fileId, accept: 'video/mp4,video/quicktime,.mp4,.mov,.m4v' });
    const clipState = h('p', { class: 'sa-up-state', role: 'status', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      st.clip = null;
      say(msg, '');
      say(clipState, 'Reading it…');
      let read;
      try { read = await readClip(f); } catch (e) { say(clipState, clipText(e.message)); return; }
      say(clipState, 'Sending it…');
      const r = await uploadClip(ctx.act, { file: f, frames: read.frames, human, onProgress: (a, b) => say(clipState, a < b ? `Sending it… ${Math.round((a / b) * 100)}%` : 'Checking it… (a few seconds)') });
      if (!host.alive()) return;
      if (r.ok) {
        st.clip = r.id;
        st.shape = read.shape;
        say(clipState, `Ready: ${Math.round((r.seconds || read.seconds) * 10) / 10} s, ${SHAPES[read.shape]?.name.toLowerCase() || 'vertical'}, checked ✓`);
        clipPanel.querySelector('.sa-drop-title').textContent = 'Choose another clip';
        return;
      }
      say(clipState, upErrorText(r, 'clip'));
    });
    add(clipPanel, file, h('label', { class: 'sa-drop', for: fileId }, icon('upload'), h('span', { class: 'sa-drop-title', text: 'Choose a clip' }),
      h('span', { class: 'sa-drop-note', text: `${CLIP.MIN_S} to ${CLIP.MAX_S} seconds, MP4 or MOV, 720 to 2160 px a side, one person. Its sound isn't used.` })), clipState,
    h('p', { class: 'sa-fine', text: "Only a clip you may use: yours, or one with the person's OK. It's checked by AI, and the video made from it is checked again." }));
    // (2026-10-13) never from a photo AGI-1 is in: a trend video puts the influencer in place of one person (our server's
    // "agi1_trend")
    const from = startFrom({ value: image, only: 'not' });
    go.node.addEventListener('click', () => busy(go.node, 'Starting…', async () => {
      const useClip = st.tab === 'clip';
      if (useClip && !st.clip) { say(msg, 'Choose your clip first (and wait for its check).'); return; }
      if (!useClip && !st.trend) { say(msg, 'Pick a clip first.'); return; }
      if (!(await enough(price('trend')))) return;
      const r = await ctx.act('inf-make', { id, kind: 'trend', ...(useClip ? { clip: st.clip, shape: st.shape } : { trend: st.trend }), ...(from.value ? { image: from.value } : {}) });
      if (made(r, price('trend'), { msg })) {
        ctx.toast('Making its trend video: a few minutes', 'good');
        host.done();
        load();
      }
    }));
    put(host.body, hint(`${i.name} in a trending clip, in place of its person: as long as the clip, up to ${CLIP.MAX_S} seconds.`),
      which.node, movesPanel, clipPanel, from.node,
      // (2026-10-13) why its photos with AGI-1 aren't there to start from
      herPhotos(page.jobs).length ? h('p', { class: 'sa-fine', text: `AGI-1 never joins a trend video: it puts ${i.name} in place of one person, so it never starts from a photo she's in.` }) : null,
      human);
    host.setFoot(msg, go.node);
  }

  // ---------- 3D: in credits (a Soulmate's first each month free), or (round 2) free for a big burn of $AGI ----------
  // (2026-10-13, the owner: "i wish theres more tools to customize the 3d like in meshy") with its choices (views/model-tool.js:
  // its moves, moves of its own, its shape and look, more downloads, kept in model3d while the page is open). Its price follows
  // them (rules.js modelCost: its price and its extras, a holder's discount on all of it); a Soulmate's free model a month
  // covers its price, never its extras, while our server says it's still to use (soulmateFree). A burn makes one with
  // nothing extra (rules.js burnable: our server says so too, 'not_burnable').
  function modelTool(host) {
    const i = inf();
    const st = model3d;
    const burnAgi = ctx.info?.burns?.model;
    const msg = errLine();
    // its price: what's picked now (a move of its own half-typed already counts: priceSpecOf), for this wallet now
    const ps = () => priceSpecOf(st);
    const full = () => modelCost(ps(), ctx.level);
    const costNow = () => (soulmateFree() ? modelCost(ps(), ctx.level, { free: true }) : full());
    const go = goFor('Make it in 3D', () => { const n = costNow(); return soulmateFree() && !n ? 'Free' : n; }, 'cube');
    const priceNote = h('p', { class: 'sa-note sa-m3-price', hidden: true });
    const timeLine = h('p', { class: 'sa-fine' });
    const burnNote = h('p', { class: 'sa-fine sa-m3-burn-note', hidden: true });
    const burn = burnAgi > 0 ? btn(`Or burn ${num(burnAgi)} $AGI: no credits`, { kind: 'ghost', icon: 'flame', class: 'sa-btn sa-btn-ghost sa-btn-wide' }) : null;
    const choices = modelChoices({ st, name: i.name, onchange: () => sync(), reveal: (el, o) => ws.reveal(el, o) });
    // what changes with its choices: the button's words and price, what its extras cost, how long it takes, a burn's "no"
    function sync() {
      const p = ps();
      const free = soulmateFree();
      go.setLabel(free && !costNow() ? 'Make it in 3D (free this month)' : 'Make it in 3D');
      go.refresh();
      say(priceNote, modelPriceText(p, ctx.level, { free }));
      timeLine.textContent = `It takes ${modelTimeText(p)}. If it can't be made, its credits come back (a burn: made again, free).`;
      if (burn) say(burnNote, burnable(p) ? '' : errorText('not_burnable'));
      say(msg, '');
    }
    // our server's "no" for one of its choices (said under its field), or its words' (the same), else under the button
    function refused(d) {
      if (d.error === 'spec') { if (!choices.specError(d.field, specFieldText(d.field))) say(msg, specFieldText(d.field)); return; }
      if (d.error === 'words') { if (!choices.wordsError(d)) say(msg, wordsText(d.field, d.why)); return; }
      say(msg, errorText(d.error));
    }
    go.node.addEventListener('click', () => busy(go.node, 'Starting…', async () => {
      if (!choices.check()) return;
      const spec = specOf(st);
      const free = soulmateFree();
      const need = costNow();
      if (need > 0 && !(await enough(need))) return;
      const r = await ctx.act('inf-3d', { id, spec });
      const d = r.data || {};
      if (r.ok && d.ok) {
        ctx.toast(`Making it in 3D${d.free ? ' with your free model this month' : ''}: ${modelTimeText(spec)}`, 'good');
        // a fresh form for the next one (its choices back to the usual), and whether a Soulmate's free model is still to use
        model3d = modelState();
        sigs.models = null;
        ctx.refreshMe();
        host.done();
        load();
        return;
      }
      if (d.error === 'short') {
        // what it really needs: its whole price when the free model this month turned out to be used already
        const want = free && Number(d.have) >= need ? full() : need || full();
        say(msg, `That needs ${creditsText(want)}: you have ${creditsText(d.have ?? ctx.credits)}.`);
        ctx.refreshMe();
        ctx.buyCredits({ need: want });
        return;
      }
      refused(d);
    }));
    burn?.addEventListener('click', () => busy(burn, 'Getting it ready…', async () => {
      if (!choices.check()) return;
      const asked = specOf(st);
      if (!burnable(asked)) { say(msg, errorText('not_burnable')); return; }
      if (!(await ctx.requireWallet())) return;
      const r = await ctx.act('inf-3d-burn', { id, spec: asked });
      const d = r.data || {};
      if (r.ok && d.ok) { burn3d({ order: d.order, agi: d.agi, paid: d.paid, spec: d.spec || null, again: d.again === true, asked }); return; }
      refused(d);
    }));
    // a Soulmate's free model a month: still to use (it covers its price, never its extras), or used (the next on the 1st)
    const soulmate = ctx.level === 3
      ? h('p', { class: 'sa-note', text: soulmateFree()
        ? `Soulmate: your free 3D model this month covers its price (${creditsText(price('model'))}); its extras are paid.`
        : 'Soulmate: your free 3D model this month is used. The next one comes on the 1st (UTC).' })
      : null;
    put(host.body,
      hint('From its full-body picture: shaped, given bones and taught its moves. Pick them below.'),
      i.body ? h('div', { class: 'sa-big-wrap is-small' }, pic(infPic(id, i.body, 0, true), { cls: 'sa-big-pic is-tall', alt: `${i.name}'s full body`, lazy: false })) : null,
      choices.node,
      priceNote,
      burnNote,
      h('p', { class: 'sa-fine', text: MODEL_FREE_LINE }),
      timeLine,
      soulmate);
    host.setFoot(msg, go.node, burn);
    sync();
  }
  // its big burn: the burn sheet, then made (by our server, once the burn is read on the chain). quote: inf-3d-burn's answer
  // ({ order, agi, paid, spec, again }) and (asked) the choices asked for now; a quote already part-burned keeps its choices
  function burn3d(quote) {
    const i = inf();
    const s = modelSpec(quote.spec);
    const lines = ['Burns add up: you can burn it in parts, from the same wallet, within a day.', 'If it can\'t be made, it\'s made again for free (a burn can\'t be given back).'];
    if (s && !isDefaultSpec(s)) lines.unshift(`Its choices: ${specSummary(s)}.`);
    const asked = quote.asked ? modelSpec(quote.asked) : null;
    if (quote.again && quote.paid > 0 && asked && s && JSON.stringify(asked) !== JSON.stringify(s)) {
      lines.push('Part of this burn came in already, so its choices stay as they were when it started.');
    }
    burnSheet(ctx, {
      title: `${i.name} in 3D, for a burn`, sub: `Burn ${num(quote.agi)} $AGI from your own wallet: its 3D model is then made, with no credits.`, quote,
      lines,
      check: (tx) => ctx.act('inf-3d-check', { id, order: quote.order, ...(tx ? { tx } : {}) }),
      onDone: () => { ctx.toast(`Burn found: making it in 3D (${modelTimeText(s || null)})`, 'good'); sigs.models = null; load(); },
    });
  }

  // ---------- Coin: a launch link for a coin with its face (launched from their own wallet, on the launch page) ----------
  // (2026-10-11, the owner's "Profile or its photos") its picture: its profile picture as it is now, or one of its photos framed
  // as a circle (kept here while the page is open: { profile: true } or { job, n, x, y, s, src })
  let coinPic = { profile: true };
  function coinTool(host) {
    const i = inf();
    // a photo picked before that's gone since: its profile picture again
    if (!coinPic.profile && !(page.jobs || []).some((j) => j.id === coinPic.job && j.status === 'done')) coinPic = { profile: true };
    const nameId = nextId('cn'), tickId = nextId('ct'), lineId = nextId('cl');
    const cname = h('input', { class: 'sa-input', id: nameId, type: 'text', maxlength: 32, autocomplete: 'off', value: i.name });
    const tick = h('input', { class: 'sa-input', id: tickId, type: 'text', maxlength: 16, autocomplete: 'off', spellcheck: 'false', placeholder: 'TICKER', value: String(i.name).replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 10) });
    const line = h('input', { class: 'sa-input', id: lineId, type: 'text', maxlength: 100, autocomplete: 'off', placeholder: 'One line about it (optional)' });
    const msg = errLine();
    for (const field of [cname, tick, line]) field.addEventListener('input', () => say(msg, ''));
    let agreed = !priv();
    const agreeId = nextId('agree');
    const agree = h('input', { type: 'checkbox', id: agreeId, class: 'sa-check' });
    agree.addEventListener('change', () => { agreed = agree.checked; say(msg, ''); });
    const go = goButton('Get my launch link', 'coin');
    go.setPrice('Free');
    go.node.addEventListener('click', () => busy(go.node, 'Checking…', async () => {
      if (!agreed) { say(msg, 'Tick the box first: it puts a real person\'s face on a public coin, for good.'); ws.reveal(agree); return; }
      const picture = coinPic.profile ? 'profile' : { job: coinPic.job, n: coinPic.n, x: coinPic.x, y: coinPic.y, s: coinPic.s };
      const r = await ctx.act('inf-coin', { id, name: cname.value.trim(), symbol: tick.value.trim().replace(/^\$+/, ''), description: line.value.trim(), picture });
      const d = r.data || {};
      if (r.ok && d.ok && d.link) {
        const open = linkBtn('Open the launch page ↗', d.link, { kind: 'primary', size: 'lg', target: '_blank', rel: 'noopener noreferrer', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
        const linkCode = h('code', { class: 'sa-addr', text: d.link });
        const copy = btn('Copy link', { kind: 'ghost', size: 'sm', icon: 'copy' });
        copy.addEventListener('click', async () => { const ok = await copyText(d.link, linkCode); ctx.toast(ok ? 'Link copied' : 'Link selected: copy it', 'good'); });
        const another = btn('Another coin', { kind: 'quiet', size: 'sm', icon: 'refresh' });
        another.addEventListener('click', () => host.done());
        put(host.body,
          h('p', { class: 'sa-pay-title', text: 'Your launch link is ready 💜' }),
          h('p', { class: 'sa-muted', text: "Open it where your wallet is (your wallet app's browser, or a computer with your wallet). It works for 2 hours; anyone with it could launch your coin, so keep it to yourself." }),
          h('div', { class: 'sa-addr-row' }, linkCode, copy),
          h('p', { class: 'sa-fine', text: "The coin is yours: we never promote it. Meme coins can lose all of their value. Not financial advice." }),
          another);
        host.setFootBare(open);
        return;
      }
      if (d.error === 'coin') { say(msg, coinText(d.reason)); return; }
      if (d.error === 'picture') { coinPic = { profile: true }; drawPicRow(); }
      say(msg, errorText(d.error));
    }));
    // its picture: a circle like clank.trade's, and Change (its profile picture, or one of its photos framed as a circle)
    const picRow = h('div', { class: 'sa-coinpic' });
    const picLabelId = nextId('cpl');
    function drawPicRow() {
      const now = inf();
      const preview = coinPic.profile
        ? (now.portrait ? h('img', { class: 'sa-coinpic-img', src: infPic(id, now.portrait.job, now.portrait.n, true), alt: '' }) : h('span', { class: 'sa-coinpic-img' }))
        : framedPic(coinPic.src, coinPic, { round: true }).node;
      const change = btn('Change', { kind: 'ghost', size: 'sm', icon: 'image', 'aria-describedby': picLabelId });
      change.addEventListener('click', async () => {
        const got = await pickPicture({
          title: 'Its coin\'s picture', sub: 'Its profile picture as it is, or one of its photos framed as a circle.', round: true,
          current: coinPic, saveLabel: 'Use this picture',
          groups: [
            { label: 'Its profile picture', items: now.portrait ? [{ profile: true, src: infPic(id, now.portrait.job, now.portrait.n, true), label: 'As it is now' }] : [] },
            { label: 'Its photos', items: photoItems(), empty: 'No photos of it yet: a photo made with the Photo tool can be its coin\'s picture.' },
          ],
        });
        if (!got || !host.alive()) return;
        coinPic = got.profile ? { profile: true } : got;
        say(msg, '');
        drawPicRow();
        picRow.querySelector('button')?.focus();
      });
      put(picRow, preview,
        h('div', { class: 'sa-coinpic-words' },
          h('span', { class: 'sa-coinpic-title', id: picLabelId, text: coinPic.profile ? 'Its profile picture' : 'One of its photos' }),
          h('span', { class: 'sa-coinpic-note', text: 'Shown as a circle on clank.trade' })),
        change);
    }
    drawPicRow();
    put(host.body,
      hint('A coin with its face, launched from your own wallet on clank.trade.'),
      h('div', { class: 'sa-field' }, h('span', { class: 'sa-label', text: 'Its picture' }), picRow),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: nameId, text: 'Its name' }), cname),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: tickId, text: 'Its ticker' }), tick),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: lineId, text: 'Its line (optional)' }), line),
      h('ul', { class: 'sa-ticks' },
        h('li', { text: `Its picture is the one above: ${i.name}'s profile picture, or one of its photos you framed. You launch it from your own wallet on the launch page, on clank.trade's own contracts: the coin is yours.` }),
        h('li', { text: 'The wallet that launches needs 10,000+ $AGI held or burned (nothing is spent). Launching is free; your wallet pays a small network fee in ETH.' }),
        h('li', { text: 'A coin is public and permanent: its name, ticker and picture can never be changed or deleted.' })),
      priv() ? h('div', { class: 'sa-consent is-warn' }, agree, h('label', { for: agreeId, text: "I understand this puts a real person's face on a public coin, for good (deleting the influencer can't take it off the coin), and they agreed to that too." })) : null,
      h('p', { class: 'sa-fine', text: 'We never promote coins made here. Meme coins can lose all of their value. Not financial advice. 18+.' }));
    host.setFootBare(msg, go.node);
  }

  // ---------- its new videos' posters (a frame each, taken here and checked by our server) ----------
  function posters() {
    if (!mine() || !page.posters) return;
    const todo = Object.fromEntries(Object.entries(page.posters).filter(([job]) => !postersTried.has(job)));
    if (!Object.keys(todo).length) return;
    for (const job of Object.keys(todo)) postersTried.add(job);
    makePosters(todo, (job) => infVideo(job), { alive: ctx.alive }).then((made0) => { if (made0 && ctx.alive()) { sigs.gallery = null; load(); } });
  }

  // a shared link to one of its videos or photos (…#v-<job>), or a trend clip picked in Explore (?trend=<id>)
  function deepLinks() {
    const want = /^#v-([A-Za-z0-9_-]{22})$/.exec(location.hash);
    if (want) {
      const j = (page.jobs || []).find((x) => x.id === want[1] && x.status === 'done');
      if (j) { document.getElementById(`v-${j.id}`)?.scrollIntoView({ block: 'center' }); openJob(j); }
    }
    const trend = route.q.get('trend');
    if (trend && mine() && inf()?.status === 'ready' && trendOf(trend)) {
      const url = new URL(location.href);
      url.searchParams.delete('trend');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      openTool('trend', { trend });
    }
  }
  ctx.listen(window, 'hashchange', () => { if (page) deepLinks(); });

  await load();
  return () => clearTimeout(pollTimer);
}
