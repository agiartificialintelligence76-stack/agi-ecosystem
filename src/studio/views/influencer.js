// AGI Studio: an influencer's own page (studio.agi1.app/i/<id>). Anyone with its link sees a ready one (its photos and
// videos, its 3D models); its own wallet also sees it while it's made (its 4 looks to pick from), and makes things with it:
// photos, trend videos, videos, a 3D model, a coin with its face. Its page asks again every few seconds while something is
// being made (each ask moves it along one step on our server), and takes the posters of its new videos (a frame, here).
import { h, icon, btn, linkBtn, sheet, chips, say, busy, pic, copyText, nextId, put, add } from '../ui.js';
import { infPic, infPoster, infVideo, fileUrl, trendOf, creditsText, SHAPES, SCENE_MIN, SCENE_MAX, INF_STYLES } from '../rules.js';
import {
  makingText, failText, jobTitle, jobStateText, modelText, wordsText, errorText, coinText, upErrorText,
  priceOf, shareInfUrl, shareJobUrl, dayText, PHOTO_IDEAS, VIDEO_IDEAS, num,
} from '../app-words.js';
import { readClip, clipText, uploadClip, makePosters } from '../media.js';
import { trendTile, videoSheet, reportSheet, confirmSheet } from './shared.js';

const POLL_MS = 5000;
const visible = () => document.visibilityState === 'visible';
const making = (s) => s === 'paid' || s === 'making';

export async function render(ctx, route, root) {
  const id = route.id;
  let page = null, loading = false, first = true, pollTimer = null;
  const postersTried = new Set();
  const sigs = {};

  const skeleton = h('div', { class: 'sa-inf-skel', 'aria-hidden': 'true' }, h('div', { class: 'sa-skel sa-skel-head' }), h('div', { class: 'sa-skel sa-skel-grid' }));
  const back = h('a', { class: 'sa-back', href: ctx.href('/explore'), dataset: { saLink: '' } }, icon('back'), h('span', { text: 'Explore' }));
  const head = h('header', { class: 'sa-inf-head' });
  const makingBox = h('section', { class: 'sa-card sa-making', hidden: true, 'aria-live': 'polite' });
  const actions = h('section', { class: 'sa-actions', hidden: true, 'aria-labelledby': 'sa-act-h' });
  const gallery = h('section', { class: 'sa-section', hidden: true, 'aria-labelledby': 'sa-gal-h' });
  const models = h('section', { class: 'sa-section', hidden: true, 'aria-labelledby': 'sa-3d-h' });
  const cta = h('section', { class: 'sa-card sa-cta', hidden: true },
    h('p', { class: 'sa-cta-title', text: 'Make your own AI influencer' }),
    h('p', { class: 'sa-muted', text: 'Design one, bring your character to life, or make your AI twin: photos, trend videos, 3D and more.' }),
    linkBtn('Create one', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '' } }));
  const note = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  add(root, back, skeleton, note, head, makingBox, actions, gallery, models, cta);

  const inf = () => page?.influencer;
  const mine = () => inf()?.mine === true;
  const price = (what) => priceOf(what, { prices: ctx.me?.prices, level: ctx.level });

  // ---------- loading (its own wallet: inf-look moves one thing along; anyone: the public page) ----------
  async function load() {
    if (loading) return;
    loading = true;
    let r = ctx.session ? await ctx.act('inf-look', { id }) : null;
    if (!r || (!r.ok && r.status !== 404 && r.status !== 400)) r = await ctx.getJson(`inf=${id}`);
    loading = false;
    if (!ctx.alive()) return;
    skeleton.remove();
    if (r.status === 404 || r.status === 400) { page = null; gone(); return; }
    if (!r.ok) {
      if (!page) say(note, errorText(r.data?.error));
      schedule(15_000);
      return;
    }
    say(note, '');
    page = r.data;
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
  // the studio's settings (3D, coins) and this wallet's prices can arrive after its page: what they change is drawn again
  ctx.on('info', () => { if (page?.influencer) draw(); });
  ctx.on('me', () => { if (page?.influencer) draw(); });
  ctx.on('wallet', () => { page = null; for (const k of Object.keys(sigs)) delete sigs[k]; load(); });

  function gone() {
    document.title = 'Not here · AGI Studio';
    put(head, h('h1', { class: 'sa-h1', tabindex: '-1', text: "This influencer isn't here" }),
      h('p', { class: 'sa-muted', text: "It was deleted or taken down, or it isn't ready yet (only its own wallet sees it while it's made)." }));
    for (const s of [makingBox, actions, gallery, models]) s.hidden = true;
    cta.hidden = false;
  }

  // a section drawn again only when what it shows changed (so focus and pictures stay put between looks)
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
    part('head', { i: [i.name, i.status, i.portrait, i.public, i.face, i.mine, i.style, i.ready] }, drawHead);
    const pickOrMaking = mine() && ['looks', 'pick', 'body', 'failed'].includes(i.status);
    makingBox.hidden = !pickOrMaking;
    if (pickOrMaking) part('making', { s: i.status, j: i.job, l: i.looks, e: i.error, p: page.position }, drawMaking);
    const ready = i.status === 'ready';
    actions.hidden = !(ready && mine());
    if (!actions.hidden) part('actions', { lvl: ctx.level, p: ctx.me?.prices, info: [ctx.info?.threeD, ctx.info?.coins, ctx.info?.launch, ctx.info?.open], o: ctx.me?.owner }, drawActions);
    gallery.hidden = !ready;
    if (ready) part('gallery', { j: (page.jobs || []).map((j) => [j.id, j.status, j.step, j.poster, j.files, j.error]), b: i.body, f: gallery.dataset.filter || 'all', p: page.position }, drawGallery);
    const ms = page.models || [];
    models.hidden = !(ready && ms.length);
    if (!models.hidden) part('models', ms.map((m) => [m.id, m.status, m.step, m.error]), drawModels);
    cta.hidden = mine() || !ready;
  }

  // ---------- its head: its look, its name, what it is ----------
  function drawHead() {
    const i = inf();
    const portrait = i.portrait ? pic(infPic(id, i.portrait.job, i.portrait.n, true), { cls: 'sa-inf-portrait', alt: '', lazy: false })
      : h('span', { class: 'sa-inf-portrait is-missing', 'aria-hidden': 'true' }, icon('spark'));
    const meta = [INF_STYLES[i.style], i.face ? 'AI twin' : null, 'AI-generated', i.ready ? `made ${dayText(i.ready)}` : null].filter(Boolean).join(' · ');
    const badges = h('div', { class: 'sa-badges' });
    // (its own wallet's "Show in Explore" switch says whether it's in Explore)
    if (i.face) add(badges, h('span', { class: 'sa-badge is-private' }, icon('shield'), h('span', { text: 'Private: only people with its link' })));
    const tools = h('div', { class: 'sa-inf-tools' });
    if (i.status === 'ready') {
      const share = btn('Share', { kind: 'ghost', size: 'sm', icon: 'share' });
      share.addEventListener('click', shareSheet);
      add(tools, share);
    }
    if (mine()) {
      if (i.status === 'ready' && !i.face) {
        const sw = h('button', { type: 'button', class: 'sa-switch', role: 'switch', 'aria-checked': String(i.public) }, h('span', { class: 'sa-switch-knob', 'aria-hidden': 'true' }), h('span', { text: 'Show in Explore' }));
        sw.addEventListener('click', () => setPublic(!i.public, sw));
        add(tools, sw);
      }
      const del = btn(i.face ? 'Delete my face' : 'Delete', { kind: 'quiet', size: 'sm', icon: 'trash' });
      del.addEventListener('click', remove);
      add(tools, del);
    } else if (i.status === 'ready') {
      const rep = btn('Report', { kind: 'quiet', size: 'sm', icon: 'flag' });
      rep.addEventListener('click', () => reportSheet(ctx, { inf: id, name: i.name }));
      add(tools, rep);
    }
    put(head, portrait, h('div', { class: 'sa-inf-titles' }, h('h1', { class: 'sa-h1', tabindex: '-1', text: i.name }), h('p', { class: 'sa-inf-meta', text: meta }), badges), tools);
  }

  async function setPublic(show, sw) {
    sw.disabled = true;
    const r = await ctx.act('inf-public', { id, show });
    sw.disabled = false;
    if (r.ok && r.data?.ok) {
      page.influencer.public = show;
      ctx.toast(show ? 'Shown in Explore' : 'Taken out of Explore', 'good');
      draw();
      ctx.refreshMe();
      return;
    }
    ctx.toast(errorText(r.data?.error), 'bad');
  }

  async function remove() {
    const i = inf();
    const ok = await confirmSheet(i.face ? {
      title: 'Delete my face?', yes: 'Delete my face', danger: true,
      text: [`This deletes ${i.name}, your selfie, and every picture and video made from it, at once, from every page. Its 3D models come down too.`, "It can't be undone. Anything still being made stops, and its credits come back."],
    } : {
      title: `Delete ${i.name}?`, yes: 'Delete it', danger: true,
      text: [`This deletes ${i.name} and every photo and video made from it, at once, from every page. Its 3D models come down too.`, "It can't be undone. Anything still being made stops, and its credits come back."],
    });
    if (!ok) return;
    const r = await ctx.act('inf-delete', { id });
    if (r.ok && r.data?.ok) {
      ctx.toast(i.face ? 'Your face is deleted: everything made from it is gone' : `${i.name} is deleted`, 'good');
      ctx.refreshMe();
      ctx.nav(ctx.href('/me'), { replace: true });
      return;
    }
    ctx.toast(errorText(r.data?.error), 'bad');
  }

  function shareSheet() {
    const i = inf();
    const url = `${location.origin}${ctx.href(`/i/${id}`)}`;
    const s = sheet({ title: `Share ${i.name}`, sub: i.face ? 'Your AI twin is private: only people you give this link see it.' : 'Anyone with this link sees it.' });
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
      const tiles = i.status === 'looks'
        ? h('div', { class: 'sa-looks' }, ...[0, 1, 2, 3].map(() => h('span', { class: 'sa-look is-making', 'aria-hidden': 'true' })))
        : h('div', { class: 'sa-body-making' }, i.portrait ? pic(infPic(id, i.portrait.job, i.portrait.n), { cls: 'sa-look-pic', lazy: false }) : null, h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }));
      put(makingBox,
        h('h2', { class: 'sa-h2', text: i.status === 'looks' ? 'Making its looks' : 'Making its full body' }),
        h('p', { class: 'sa-progress-line' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: makingText(i, { position }) })),
        h('p', { class: 'sa-muted sa-small', text: 'About a minute. You can leave this page: it keeps going, and My studio shows it when it\'s ready.' }),
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
    const use = btn('Use this look', { kind: 'primary', size: 'lg', icon: 'check' });
    use.disabled = true;
    const looks = h('div', { class: 'sa-looks', role: 'radiogroup', 'aria-label': 'Its looks' });
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
    const reroll = btn(`4 new looks · ${num(price('looks'))} credits`, { kind: 'ghost', icon: 'refresh' });
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

  // ---------- ready, its own wallet: what to make ----------
  function drawActions() {
    const tiles = [
      { what: 'photo', icon: 'image', name: 'Photo', note: 'In any scene you describe', open: photoSheet },
      { what: 'trend', icon: 'zap', name: 'Trend video', note: 'Copy a trending move, or your own clip', open: () => trendSheetMake() },
      { what: 'video', icon: 'film', name: 'Video', note: '5 seconds in any scene', open: () => videoSheetMake() },
    ];
    if (ctx.info?.threeD) tiles.push({ what: 'model', icon: 'cube', name: '3D model', note: ctx.level === 3 ? 'Free once a month for Soulmates' : 'Moves when you type', open: modelSheet });
    if (ctx.info?.coins && (ctx.info.launch || ctx.me?.owner || !ctx.info.open)) tiles.push({ what: 'coin', icon: 'coin', name: 'Launch a coin', note: 'With its face, from your own wallet', open: coinSheet, free: true });
    put(actions, h('h2', { class: 'sa-h2', id: 'sa-act-h', text: 'Make something' }), h('div', { class: 'sa-act-grid' }, ...tiles.map((t) => {
      const b = h('button', { type: 'button', class: `sa-act sa-act-${t.what}` }, h('span', { class: 'sa-act-icon' }, icon(t.icon)), h('span', { class: 'sa-act-name', text: t.name }),
        h('span', { class: 'sa-act-note', text: t.note }), h('span', { class: 'sa-act-cost' }, t.free ? h('span', { text: 'Free' }) : [icon('bolt'), h('span', { text: num(price(t.what)) })]));
      b.addEventListener('click', () => t.open());
      return b;
    })));
  }

  // ---------- its photos and videos ----------
  function drawGallery() {
    const i = inf();
    const jobs = page.jobs || [];
    const filter = gallery.dataset.filter || 'all';
    const shows = (j) => filter === 'all' || (filter === 'photos' ? j.kind === 'photo' : j.kind !== 'photo');
    const position = page.position;
    const tiles = [];
    if (i.body && filter !== 'videos') {
      const b = h('button', { type: 'button', class: 'sa-tile is-tall', 'aria-label': `${i.name}'s full body` },
        pic(infPic(id, i.body, 0, true), { cls: 'sa-tile-pic' }), h('span', { class: 'sa-tile-cap' }, h('span', { text: 'Full body' })));
      b.addEventListener('click', () => photoSheet0({ job: i.body, shape: 'tall', title: 'Full body', kind: 'body' }));
      tiles.push(h('li', null, b));
    }
    for (const j of jobs.filter(shows)) {
      const shape = SHAPES[j.shape] ? j.shape : 'tall';
      if (j.status === 'done') {
        const isPhoto = j.kind === 'photo';
        const cover = isPhoto ? infPic(id, j.id, 0, true) : j.poster ? infPoster(id, j.id) : i.portrait ? infPic(id, i.portrait.job, i.portrait.n, true) : null;
        const b = h('button', { type: 'button', class: `sa-tile is-${shape}${isPhoto ? '' : ' sa-tile-video'}`, id: `v-${j.id}`, 'aria-label': `${jobTitle(j)} (${isPhoto ? 'photo' : 'video'})` },
          cover ? pic(cover, { cls: `sa-tile-pic${!isPhoto && !j.poster ? ' is-blur' : ''}` }) : h('span', { class: 'sa-tile-pic is-missing' }),
          isPhoto ? null : h('span', { class: 'sa-tile-play', 'aria-hidden': 'true' }, icon('play')),
          h('span', { class: 'sa-tile-kind', 'aria-hidden': 'true' }, icon(j.kind === 'photo' ? 'image' : j.kind === 'trend' ? 'zap' : 'film')));
        b.addEventListener('click', () => openJob(j));
        tiles.push(h('li', null, b));
      } else if (making(j.status)) {
        tiles.push(h('li', null, h('div', { class: `sa-tile is-${shape} is-making`, id: `v-${j.id}` }, h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }),
          h('span', { class: 'sa-tile-state' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: jobStateText(j, { position: position && position.job === j.id ? position.at : null }) })),
          h('span', { class: 'sa-tile-cap' }, h('span', { text: jobTitle(j) })))));
      } else if (j.status === 'failed') {
        tiles.push(h('li', null, h('div', { class: `sa-tile is-${shape} is-failed`, id: `v-${j.id}` },
          h('span', { class: 'sa-tile-state' }, h('span', { text: jobStateText(j) })), h('span', { class: 'sa-tile-cap' }, h('span', { text: jobTitle(j) })))));
      }
    }
    const filters = h('div', { class: 'sa-filter', role: 'group', 'aria-label': 'Show' }, ...[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([v, label]) => {
      const b = h('button', { type: 'button', class: 'sa-filter-btn', 'aria-pressed': String(filter === v), text: label });
      b.addEventListener('click', () => { gallery.dataset.filter = v; draw(); });
      return b;
    }));
    const empty = jobs.length === 0;
    put(gallery,
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-gal-h', text: mine() ? 'Its photos and videos' : `${i.name}'s photos and videos` }), jobs.length ? filters : null),
      h('ul', { class: 'sa-grid sa-grid-gallery sa-masonry' }, ...tiles),
      empty && mine() ? h('p', { class: 'sa-muted', text: 'Nothing yet: make its first photo or video above.' }) : null);
  }

  function openJob(j) {
    const i = inf();
    if (j.kind === 'photo') { photoSheet0({ job: j.id, shape: j.shape, title: j.scene || 'Photo', kind: 'photo', j }); return; }
    videoSheet(ctx, j, { name: i.name, inf: id, mine: mine() });
  }

  // a picture of it, big: Download, Share, and (its own) a video or a trend from it; (others) Report
  function photoSheet0({ job, shape, title, kind, j = null }) {
    const i = inf();
    const s = sheet({ title: kind === 'body' ? `${i.name}: full body` : 'Photo', sub: kind === 'body' ? 'Its photos, videos and 3D model start from this.' : 'AI-generated', size: 'md' });
    const big = pic(infPic(id, job, 0), { cls: `sa-big-pic is-${SHAPES[shape] ? shape : 'tall'}`, alt: `${i.name}: ${title}`, lazy: false });
    add(s.body, h('div', { class: 'sa-big-wrap' }, big), kind === 'photo' && j?.scene ? h('p', { class: 'sa-muted', text: j.scene }) : null);
    const safe = String(i.name).replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'influencer';
    const foot = [h('a', { class: 'sa-btn sa-btn-ghost', href: infPic(id, job, 0), download: `${safe}-${kind === 'body' ? 'full-body' : 'photo'}.jpg` }, icon('download'), h('span', { text: 'Download' }))];
    if (kind === 'photo') foot.push(linkBtn('Share on X ↗', shareJobUrl(i.name, 'photo', `${location.origin}${ctx.href(`/i/${id}`)}#v-${job}`), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
    if (mine() && kind === 'photo') {
      const vid = btn('Make a video from it', { kind: 'primary', icon: 'film' });
      vid.addEventListener('click', () => { s.close(); videoSheetMake({ image: job }); });
      const tr = btn('Use it in a trend video', { kind: 'ghost', icon: 'zap' });
      tr.addEventListener('click', () => { s.close(); trendSheetMake({ image: job }); });
      foot.unshift(vid, tr);
    } else if (!mine() && kind === 'photo') {
      const rep = btn('Report', { kind: 'quiet', icon: 'flag' });
      rep.addEventListener('click', () => { s.close(); reportSheet(ctx, { inf: id, job, name: i.name }); });
      foot.push(rep);
    }
    s.setFoot(...foot);
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
        return h('li', null, h('div', { class: `sa-tile is-square ${making(m.status) ? 'is-making' : 'is-failed'}` },
          making(m.status) ? h('span', { class: 'sa-shimmer', 'aria-hidden': 'true' }) : null,
          h('span', { class: 'sa-tile-state' }, making(m.status) ? h('span', { class: 'sa-spin', 'aria-hidden': 'true' }) : null, h('span', { text: modelText(m) })),
          h('span', { class: 'sa-tile-cap' }, h('span', { text: '3D model' }))));
      })));
  }

  // ---------- making: the sheets ----------
  // what a "no" means for making something (and buying credits when it's short)
  function made(r, what, { onWords = null, msg }) {
    const d = r.data || {};
    if (r.ok && (d.ok || d.job || d.order)) return true;
    if (d.error === 'words' && onWords) { onWords(d); return false; }
    if (d.error === 'short') { say(msg, `That needs ${creditsText(price(what))}: you have ${creditsText(d.have ?? ctx.credits)}.`); ctx.buyCredits({ need: price(what) }); return false; }
    say(msg, errorText(d.error));
    return false;
  }
  async function enough(what) {
    if (ctx.credits >= price(what)) return true;
    await ctx.buyCredits({ need: price(what) });
    return ctx.credits >= price(what);
  }
  function costButton(label, what) {
    const b = btn(`${label} · ${num(price(what))} credits`, { kind: 'primary', size: 'lg', icon: 'spark', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
    return b;
  }
  const haveLine = () => h('p', { class: 'sa-muted sa-small', text: `You have ${creditsText(ctx.credits)}.` });
  function sceneField(ideas, { value = '' } = {}) {
    const id2 = nextId('scene');
    const area = h('textarea', { class: 'sa-input sa-textarea', id: id2, rows: 3, maxlength: SCENE_MAX, placeholder: 'Describe the scene…', value });
    const count = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `${[...value].length}/${SCENE_MAX}` });
    const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    area.addEventListener('input', () => { count.textContent = `${[...area.value].length}/${SCENE_MAX}`; say(err, ''); });
    const ideaRow = h('div', { class: 'sa-ideas' }, h('span', { class: 'sa-hint', text: 'Ideas:' }), ...ideas.slice(0, 6).map((t) => {
      const b = h('button', { type: 'button', class: 'sa-idea', text: t });
      b.addEventListener('click', () => { area.value = t; area.dispatchEvent(new Event('input')); area.focus(); });
      return b;
    }));
    return {
      node: h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id2, text: 'The scene' }), area, h('div', { class: 'sa-field-foot' }, err, count), ideaRow),
      area, err,
      get value() { return area.value.trim(); },
      check() {
        const v = area.value.trim();
        if ([...v].length < SCENE_MIN) { say(err, wordsText('scene', v ? 'short' : 'empty')); area.focus(); return false; }
        return true;
      },
    };
  }
  const shapeChips = (value = 'tall') => chips({ legend: 'Shape', choices: Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, `${v.name} (${v.where})`])), value });
  // its done photos to start from (the full body when none is picked)
  function startFrom({ value = null, required = false, onchange = () => {} } = {}) {
    const photos = (page.jobs || []).filter((j) => j.kind === 'photo' && j.status === 'done');
    let picked = value && photos.some((p) => p.id === value) ? value : null;
    const row = h('div', { class: 'sa-start-row', role: 'radiogroup', 'aria-label': 'Start from' });
    const draw0 = () => {
      const opts = [];
      if (!required) {
        const b = h('button', { type: 'button', class: 'sa-start', role: 'radio', 'aria-checked': String(picked === null) },
          inf().body ? pic(infPic(id, inf().body, 0, true), { cls: 'sa-start-pic' }) : h('span', { class: 'sa-start-pic is-missing' }), h('span', { text: 'Full body' }));
        b.addEventListener('click', () => { picked = null; draw0(); onchange(null); });
        opts.push(b);
      }
      for (const p of photos.slice(0, 12)) {
        const b = h('button', { type: 'button', class: 'sa-start', role: 'radio', 'aria-checked': String(picked === p.id), title: p.scene || '' },
          pic(infPic(id, p.id, 0, true), { cls: 'sa-start-pic' }), h('span', { text: SHAPES[p.shape]?.name || 'Photo' }));
        b.addEventListener('click', () => { picked = p.id; draw0(); onchange(p.id, p); });
        opts.push(b);
      }
      put(row, ...opts);
    };
    draw0();
    return {
      node: h('fieldset', { class: 'sa-chips' }, h('legend', { class: 'sa-label', text: required ? 'Start from one of its photos' : 'Start from (optional)' }), row),
      get value() { return picked; }, photos,
    };
  }

  function photoSheet() {
    const i = inf();
    const s = sheet({ title: 'A new photo', sub: `${i.name} in any scene you describe.`, size: 'md' });
    const scene = sceneField(PHOTO_IDEAS);
    const shape = shapeChips('tall');
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    const go = costButton('Make photo', 'photo');
    go.addEventListener('click', () => {
      if (!scene.check()) return;
      busy(go, 'Starting…', async () => {
        if (!(await enough('photo'))) return;
        const r = await ctx.act('inf-make', { id, kind: 'photo', scene: scene.value, shape: shape.value || 'tall' });
        if (made(r, 'photo', { msg, onWords: (d) => say(d.field === 'scene' ? scene.err : msg, wordsText(d.field, d.why)) })) {
          ctx.toast('Making its photo: about half a minute', 'good');
          s.close();
          load();
        }
      });
    });
    add(s.body, scene.node, shape.node, haveLine(), msg);
    s.setFoot(go);
    if (matchMedia('(pointer: fine)').matches) scene.area.focus();
  }

  function videoSheetMake({ image = null } = {}) {
    const i = inf();
    const needsPhoto = i.style === 'real' || i.face;
    const s = sheet({ title: 'A new video', sub: `5 seconds of ${i.name} in any scene you describe.`, size: 'md' });
    const scene = sceneField(VIDEO_IDEAS);
    const shape = shapeChips('tall');
    const from = startFrom({ value: image, required: needsPhoto, onchange: (v) => { shape.node.hidden = Boolean(v); } });
    shape.node.hidden = Boolean(from.value);
    const soundId = nextId('sound');
    const sound = h('input', { type: 'checkbox', id: soundId, class: 'sa-check', checked: true });
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    const go = costButton('Make video', 'video');
    if (needsPhoto && !from.photos.length) {
      const mk = btn('Make a photo first', { kind: 'primary', icon: 'image' });
      mk.addEventListener('click', () => { s.close(); photoSheet(); });
      add(s.body, h('p', { class: 'sa-note', text: `${i.face ? 'An AI twin' : 'A realistic influencer'}'s videos start from one of its photos: make a photo first, then make a video from it.` }));
      s.setFoot(mk);
      return;
    }
    go.addEventListener('click', () => {
      if (!scene.check()) return;
      if (needsPhoto && !from.value) { say(msg, errorText('needs_photo')); return; }
      busy(go, 'Starting…', async () => {
        if (!(await enough('video'))) return;
        const body = { id, kind: 'video', scene: scene.value, shape: shape.value || 'tall', sound: sound.checked, ...(from.value ? { image: from.value } : {}) };
        const r = await ctx.act('inf-make', body);
        if (made(r, 'video', { msg, onWords: (d) => say(d.field === 'scene' ? scene.err : msg, wordsText(d.field, d.why)) })) {
          ctx.toast('Making its video: a few minutes', 'good');
          s.close();
          load();
        }
      });
    });
    add(s.body, scene.node, from.node, shape.node,
      h('div', { class: 'sa-consent' }, sound, h('label', { for: soundId, text: 'With sound (its sounds and music, made by AI too)' })),
      haveLine(), msg);
    s.setFoot(go);
    if (matchMedia('(pointer: fine)').matches) scene.area.focus();
  }

  async function trendSheetMake({ image = null, trend = null } = {}) {
    const i = inf();
    const s = sheet({ title: 'A trend video', sub: `${i.name} does a trending move: up to 10 seconds, vertical.`, size: 'lg' });
    const st = { trend, clip: null, tab: 'moves' };
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    const human = h('div', { class: 'sa-human' });
    const go = costButton('Make trend video', 'trend');
    const tabs = h('div', { class: 'sa-tabs-in', role: 'tablist', 'aria-label': 'The move' });
    const movesPanel = h('div', { class: 'sa-tab-panel', role: 'tabpanel' });
    const clipPanel = h('div', { class: 'sa-tab-panel', role: 'tabpanel', hidden: true });
    const tabBtn = (key, label) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'sa-tab-btn', 'aria-selected': String(st.tab === key), text: label });
      b.addEventListener('click', () => {
        st.tab = key;
        for (const x of tabs.children) x.setAttribute('aria-selected', String(x === b));
        movesPanel.hidden = key !== 'moves';
        clipPanel.hidden = key !== 'clip';
        say(msg, '');
      });
      return b;
    };
    add(tabs, tabBtn('moves', 'Trending moves'), tabBtn('clip', 'My own clip'));
    // the moves (the owner's, made with AI once)
    add(movesPanel, h('p', { class: 'sa-muted sa-small', text: 'Loading the moves…' }));
    ctx.exploreData().then((data) => {
      if (!s.dialog.isConnected) return;
      const list = (data?.trends || []).filter((t) => t.job);
      if (!list.length) { put(movesPanel, h('p', { class: 'sa-muted', text: 'No trending moves yet: use your own clip.' })); return; }
      const grid = h('div', { class: 'sa-trend-grid' });
      const fill = () => put(grid, ...list.map((t) => trendTile(t, { selected: st.trend === t.id, small: true, onpick: (x) => { st.trend = x.id; say(msg, ''); fill(); } })));
      fill();
      put(movesPanel, grid, h('p', { class: 'sa-muted sa-small', text: 'Made-up dancers show each move: your influencer does it.' }));
    });
    // their own clip: 2 to 10 s, checked as it's sent
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
      if (!s.dialog.isConnected) return;
      if (r.ok) {
        st.clip = r.id;
        say(clipState, `Ready: ${Math.round((r.seconds || read.seconds) * 10) / 10} s, checked ✓`);
        clipPanel.querySelector('.sa-drop-title').textContent = 'Choose another clip';
        return;
      }
      say(clipState, upErrorText(r, 'clip'));
    });
    add(clipPanel, file, h('label', { class: 'sa-drop', for: fileId }, icon('upload'), h('span', { class: 'sa-drop-title', text: 'Choose a clip' }),
      h('span', { class: 'sa-drop-note', text: '2 to 10 seconds, MP4 or MOV, one person moving. Its sound isn\'t used.' })), clipState,
    h('p', { class: 'sa-muted sa-small', text: "Only a clip you may use: yours, or one with the person's OK. It's checked by AI, and the video made from it is checked again." }));
    const from = startFrom({ value: image });
    go.addEventListener('click', () => busy(go, 'Starting…', async () => {
      const useClip = st.tab === 'clip';
      if (useClip && !st.clip) { say(msg, 'Choose your clip first (and wait for its check).'); return; }
      if (!useClip && !st.trend) { say(msg, 'Pick a move first.'); return; }
      if (!(await enough('trend'))) return;
      const r = await ctx.act('inf-make', { id, kind: 'trend', ...(useClip ? { clip: st.clip } : { trend: st.trend }), ...(from.value ? { image: from.value } : {}) });
      if (made(r, 'trend', { msg })) {
        ctx.toast('Making its trend video: a few minutes', 'good');
        s.close();
        load();
      }
    }));
    add(s.body, tabs, movesPanel, clipPanel, from.node, human, haveLine(), msg);
    s.setFoot(go);
  }

  function modelSheet() {
    const i = inf();
    const s = sheet({ title: `${i.name} in 3D`, sub: 'From its full-body picture: shaped, given bones and taught 8 moves.', size: 'md' });
    const free = ctx.level === 3;
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    const go = free ? btn('Make it in 3D (your free one this month)', { kind: 'primary', size: 'lg', icon: 'cube', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' }) : costButton('Make it in 3D', 'model');
    go.addEventListener('click', () => busy(go, 'Starting…', async () => {
      if (!free && !(await enough('model'))) return;
      const r = await ctx.act('inf-3d', { id });
      if (made(r, 'model', { msg })) {
        ctx.toast(r.data?.free ? 'Making it in 3D, free: about 5 to 10 minutes' : 'Making it in 3D: about 5 to 10 minutes', 'good');
        s.close();
        load();
      }
    }));
    add(s.body,
      i.body ? h('div', { class: 'sa-big-wrap is-small' }, pic(infPic(id, i.body, 0, true), { cls: 'sa-big-pic is-tall', alt: `${i.name}'s full body`, lazy: false })) : null,
      h('ul', { class: 'sa-ticks' },
        h('li', { text: 'On its own page it moves when someone types: wave, dance, jump, cheer, bow, walk, party.' }),
        h('li', { text: 'Its 3D model (GLB, with its bones and moves) and its picture are yours to download.' }),
        h('li', { text: 'About 5 to 10 minutes. If it can\'t be made, its credits come back.' })),
      free ? h('p', { class: 'sa-note', text: `Soulmate: one free 3D model a month (after that, ${creditsText(price('model'))}).` }) : haveLine(),
      msg);
    s.setFoot(go);
  }

  function coinSheet() {
    const i = inf();
    const s = sheet({ title: `A coin with ${i.name}'s face`, sub: 'Launched from your own wallet, on clank.trade.', size: 'md' });
    const nameId = nextId('cn'), tickId = nextId('ct'), lineId = nextId('cl');
    const cname = h('input', { class: 'sa-input', id: nameId, type: 'text', maxlength: 32, autocomplete: 'off', value: i.name });
    const tick = h('input', { class: 'sa-input', id: tickId, type: 'text', maxlength: 16, autocomplete: 'off', spellcheck: 'false', placeholder: 'TICKER', value: String(i.name).replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 10) });
    const line = h('input', { class: 'sa-input', id: lineId, type: 'text', maxlength: 100, autocomplete: 'off', placeholder: 'One line about it (optional)' });
    const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    for (const field of [cname, tick, line]) field.addEventListener('input', () => say(msg, ''));
    let agreed = !i.face;
    const agreeId = nextId('agree');
    const agree = h('input', { type: 'checkbox', id: agreeId, class: 'sa-check' });
    agree.addEventListener('change', () => { agreed = agree.checked; say(msg, ''); });
    const go = btn('Get my launch link', { kind: 'primary', size: 'lg', icon: 'coin', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
    go.addEventListener('click', () => busy(go, 'Checking…', async () => {
      if (!agreed) { say(msg, 'Tick the box first: it puts your own face on a public coin, for good.'); return; }
      const r = await ctx.act('inf-coin', { id, name: cname.value.trim(), symbol: tick.value.trim().replace(/^\$+/, ''), description: line.value.trim() });
      const d = r.data || {};
      if (r.ok && d.ok && d.link) {
        const open = linkBtn('Open the launch page ↗', d.link, { kind: 'primary', size: 'lg', target: '_blank', rel: 'noopener noreferrer', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
        const linkCode = h('code', { class: 'sa-addr', text: d.link });
        const copy = btn('Copy link', { kind: 'ghost', icon: 'copy' });
        copy.addEventListener('click', async () => { const ok = await copyText(d.link, linkCode); ctx.toast(ok ? 'Link copied' : 'Link selected: copy it', 'good'); });
        put(s.body,
          h('p', { class: 'sa-pay-title', text: 'Your launch link is ready 💜' }),
          h('p', { class: 'sa-muted', text: "Open it where your wallet is (your wallet app's browser, or a computer with your wallet). It works for 2 hours; anyone with it could launch your coin, so keep it to yourself." }),
          h('div', { class: 'sa-addr-row' }, linkCode, copy),
          h('p', { class: 'sa-fine', text: "The coin is yours: we never promote it. Meme coins can lose all of their value. Not financial advice." }));
        s.setFoot(open);
        return;
      }
      if (d.error === 'coin') { say(msg, coinText(d.reason)); return; }
      say(msg, errorText(d.error));
    }));
    add(s.body,
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: nameId, text: 'Its name' }), cname),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: tickId, text: 'Its ticker' }), tick),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: lineId, text: 'Its line (optional)' }), line),
      h('ul', { class: 'sa-ticks' },
        h('li', { text: `Its picture is ${i.name}'s look. You launch it from your own wallet on the launch page, on clank.trade's own contracts: the coin is yours.` }),
        h('li', { text: 'The wallet that launches needs 10,000+ $AGI held or burned (nothing is spent). Launching is free; your wallet pays a small network fee in ETH.' }),
        h('li', { text: 'A coin is public and permanent: its name, ticker and picture can never be changed or deleted.' })),
      i.face ? h('div', { class: 'sa-consent is-warn' }, agree, h('label', { for: agreeId, text: 'I understand this puts my own face on a public coin, for good: even "Delete my face" can\'t take it off the coin.' })) : null,
      h('p', { class: 'sa-fine', text: 'We never promote coins made here. Meme coins can lose all of their value. Not financial advice. 18+.' }),
      msg);
    s.setFoot(go);
  }

  // ---------- its new videos' posters (a frame each, taken here and checked by our server) ----------
  function posters() {
    if (!mine() || !page.posters) return;
    const todo = Object.fromEntries(Object.entries(page.posters).filter(([job]) => !postersTried.has(job)));
    if (!Object.keys(todo).length) return;
    for (const job of Object.keys(todo)) postersTried.add(job);
    makePosters(todo, (job) => infVideo(job), { alive: ctx.alive }).then((made0) => { if (made0 && ctx.alive()) { sigs.gallery = null; load(); } });
  }

  // a shared link to one of its videos or photos (…#v-<job>), or a trend move picked in Explore (?trend=<id>)
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
      trendSheetMake({ trend });
    }
  }
  ctx.listen(window, 'hashchange', () => { if (page) deepLinks(); });

  await load();
  return () => clearTimeout(pollTimer);
}
