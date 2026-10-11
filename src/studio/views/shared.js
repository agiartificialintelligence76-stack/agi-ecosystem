// AGI Studio: what more than one view shows or opens: media tiles and their hearts (round 2: likes), a trend clip's tile and
// preview, a photo or a video seen big, burning $AGI for an unlock (round 2), a report, "are you sure?", and (round 4) captions
// for a post of one of your own creations.
import { h, icon, linkBtn, btn, sheet, pic, chips, segmented, say, busy, copyText, put, add } from '../ui.js';
import {
  infPic, infPoster, infVideo, infVideoDl, infPhotoDl, trendOf, creditsText, SHAPES, PHOTO_SHAPES, REPORT_WHYS, CAPTION_PLATFORMS, CAPTION_TONES,
} from '../rules.js';
import {
  priceOf, shareJobUrl, errorText, compact, likeErrorText, likesText, burnCheckText, shortAddress, num, jobMeta, captionErrorText,
  captionsLeftText, postOnXUrl,
} from '../app-words.js';
import { readyCaptions } from '../captions.js';
import { BURN_ADDRESS, BURN_EXPLORER } from '../../lib/burns.js';
import { TOKENS } from '../../prices/parse.js';

// ---------- likes (round 2: any signed-in wallet likes other people's photos and videos, 50 a day; holders' likes pick the
// spotlight of the week). Every heart of one job on the page shows the same, whichever was pressed. ----------
const likes = new Map();                       // job → { likes, liked }
export function noteLikes(job, count, liked = null) {
  const was = likes.get(job);
  likes.set(job, { likes: Number(count) || 0, liked: liked === null ? was?.liked === true : liked === true });
}
export const likedOf = (job) => likes.get(job)?.liked === true;
function drawHearts(job) {
  const st = likes.get(job);
  if (!st) return;
  for (const b of document.querySelectorAll(`.sa-heart[data-job="${job}"]`)) {
    b.setAttribute('aria-pressed', String(st.liked));
    b.setAttribute('aria-label', `${st.liked ? 'Liked' : 'Like'}: ${likesText(st.likes)}`);
    b.querySelector('.sa-heart-n').textContent = compact(st.likes);
  }
}
// likeButton(ctx, { job, likes, liked, can, fresh }): can = false for one's own or a private one (its count only); fresh =
// false when its count may be older than what the page already shows (a sheet opened from a tile)
export function likeButton(ctx, { job, likes: count = 0, liked = null, can = true, cls = '', fresh = true }) {
  if (fresh || !likes.has(job)) noteLikes(job, count, liked);
  const st = likes.get(job);
  const b = h('button', { type: 'button', class: `sa-heart ${cls}`.trim(), dataset: { job }, 'aria-pressed': String(st.liked), 'aria-label': `${st.liked ? 'Liked' : 'Like'}: ${likesText(st.likes)}` },
    icon('heart'), h('span', { class: 'sa-heart-n', text: compact(st.likes) }));
  if (!can) {
    b.disabled = true;
    b.classList.add('is-static');
    b.setAttribute('aria-label', likesText(st.likes));
    return b;
  }
  b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (b.getAttribute('aria-busy') === 'true') return;
    if (!ctx.session && (!(await ctx.requireAdult()) || !(await ctx.requireWallet()))) return;
    const cur = likes.get(job);
    const want = !cur.liked;
    // at once on the page, then what our server says
    noteLikes(job, Math.max(0, cur.likes + (want ? 1 : -1)), want);
    drawHearts(job);
    b.setAttribute('aria-busy', 'true');
    const r = await ctx.act('inf-like', { job, like: want });
    b.removeAttribute('aria-busy');
    if (r.ok && r.data?.ok) { noteLikes(job, r.data.likes, r.data.liked); drawHearts(job); return; }
    noteLikes(job, cur.likes, cur.liked);
    drawHearts(job);
    ctx.toast(likeErrorText(r.data?.error), 'bad');
  });
  return b;
}
// Which of these this wallet liked (its hearts filled in), once a view has its list
export async function loadLiked(ctx, jobs) {
  const list = [...new Set(jobs)].slice(0, 120);
  if (!ctx.session || !list.length) return;
  const r = await ctx.act('inf-liked', { jobs: list });
  if (!r.ok || !Array.isArray(r.data?.liked)) return;
  const yes = new Set(r.data.liked);
  for (const job of list) { if (likes.has(job)) { noteLikes(job, likes.get(job).likes, yes.has(job)); drawHearts(job); } }
}

// ---------- a photo or a video, as a tile (Explore, an influencer's page) ----------
// item: { id, kind, shape, poster, files, likes, inf: { id, name, portrait } } · onopen: what a tap opens
export function mediaTile(ctx, item, { onopen, can = true, liked = null, showName = true, badge = null } = {}) {
  const inf = item.inf?.id;
  const shape = PHOTO_SHAPES[item.shape] ? item.shape : item.kind === 'photo' ? 'square' : 'tall';
  const isPhoto = item.kind === 'photo';
  const cover = isPhoto ? infPic(inf, item.id, 0, true) : item.poster ? infPoster(inf, item.id)
    : item.inf?.portrait ? infPic(inf, item.inf.portrait.job, item.inf.portrait.n, true) : null;
  const what = isPhoto ? (item.shape === 'banner' ? 'an X banner' : 'a photo') : item.kind === 'trend' ? `a trend video${item.trend && trendOf(item.trend) ? ` (${trendOf(item.trend).name})` : ''}` : 'a video';
  const open = h('button', { type: 'button', class: 'sa-media-open', 'aria-label': `${item.inf?.name || 'An influencer'}: ${what}` },
    cover ? pic(cover, { cls: `sa-media-pic${!isPhoto && !item.poster ? ' is-blur' : ''}` }) : h('span', { class: 'sa-media-pic is-missing' }),
    isPhoto ? null : h('span', { class: 'sa-media-play', 'aria-hidden': 'true' }, icon('play')),
    badge ? h('span', { class: `sa-tag sa-media-tag ${badge.cls || ''}`.trim() }, badge.icon ? icon(badge.icon) : null, h('span', { text: badge.text })) : null,
    showName && item.inf?.name ? h('span', { class: 'sa-media-cap' },
      item.inf.portrait ? pic(infPic(inf, item.inf.portrait.job, item.inf.portrait.n, true), { cls: 'sa-avatar sa-avatar-xs' }) : null,
      h('span', { text: item.inf.name })) : null);
  open.addEventListener('click', () => onopen?.(item));
  return h('div', { class: `sa-media is-${shape}`, id: `v-${item.id}` }, open, likeButton(ctx, { job: item.id, likes: item.likes, liked, can, cls: 'sa-media-heart' }));
}

// a trend clip's tile plays its clip while the pointer rests on it (a computer's mouse only: never on phones, never by itself)
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function hoverPlay(tile, src) {
  if (!fine() || calm()) return;
  let timer = null, video = null;
  const frame = tile.querySelector('.sa-trend-frame') || tile;
  tile.addEventListener('pointerenter', () => {
    timer = setTimeout(() => {
      video = h('video', { class: 'sa-trend-live', src, muted: true, loop: true, playsinline: true, autoplay: true, preload: 'auto', 'aria-hidden': 'true' });
      frame.append(video);
      video.play?.().catch(() => {});
    }, 220);
  });
  tile.addEventListener('pointerleave', () => {
    clearTimeout(timer);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); video = null; }
  });
}

// ---------- the trend clips (round 2: real-looking clips your influencer is put into) ----------
// A trend clip's tile (its poster, else its emoji). onpick: a picker (aria-pressed) or a button that opens its preview
export function trendTile(t, { onpick = null, selected = null, small = false } = {}) {
  const inner = t.poster && t.job
    ? pic(infPoster('trends', t.job), { cls: 'sa-trend-pic' })
    : h('span', { class: 'sa-trend-emoji', 'aria-hidden': 'true', text: t.emoji || '✨' });
  const b = h('button', { type: 'button', class: `sa-trend${small ? ' is-small' : ''}`, ...(selected !== null ? { 'aria-pressed': String(selected) } : {}) },
    h('span', { class: 'sa-trend-frame' }, inner,
      selected === null ? h('span', { class: 'sa-trend-play', 'aria-hidden': 'true' }, icon('play')) : h('span', { class: 'sa-trend-tick', 'aria-hidden': 'true' }, icon('check')),
      h('span', { class: 'sa-trend-name', text: `${t.emoji || '✨'} ${t.name}` })));
  if (onpick) b.addEventListener('click', () => onpick(t, b));
  return b;
}
// A trend clip's preview: the clip as the owner made it (a made-up person, its camera move and its sound), and "Make it
// with" one of your ready influencers (put into the clip in place of its person)
export function trendSheet(ctx, t) {
  const s = sheet({ title: `${t.emoji || '✨'} ${t.name}`, sub: 'A trend video: your influencer, put into this clip in place of its person.', size: 'md' });
  const video = h('video', {
    class: 'sa-trend-video', src: infVideo(t.job), playsinline: true, muted: true, loop: true, autoplay: true, controls: true, preload: 'auto',
    ...(t.poster ? { poster: infPoster('trends', t.job) } : {}), 'aria-label': `${t.name}: the trend clip, with a made-up person`,
  });
  const about = trendOf(t.id);
  const list = h('div', { class: 'sa-pick-list' });
  add(s.body, h('div', { class: 'sa-trend-stage' }, video),
    about ? h('p', { class: 'sa-muted sa-small', text: `${about.camera[0].toUpperCase()}${about.camera.slice(1)}. Your influencer gets its place, its moves, its light and its sound (about 10 seconds, vertical).` }) : null,
    list);
  const fill = () => {
    if (!s.dialog.isConnected) return;
    const price = creditsText(priceOf('trend', { prices: ctx.me?.prices, level: ctx.level }));
    const ready = (ctx.me?.influencers || []).filter((i) => i.status === 'ready');
    if (!ctx.session || !ready.length) {
      put(list, h('p', { class: 'sa-muted', text: ctx.session
        ? 'Create your influencer first: then you can put it into this clip.'
        : `Make it with your own influencer: ${price} (holders get a discount).` }));
      s.setFoot(linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', size: 'lg', icon: 'plus', dataset: { saLink: '' } }));
      return;
    }
    put(list, h('p', { class: 'sa-label', text: `Make it with (${price}):` }),
      ...ready.map((i) => h('a', { class: 'sa-pick', href: ctx.href(`/i/${i.id}?trend=${encodeURIComponent(t.id)}`), dataset: { saLink: '' } },
        i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-avatar' }) : h('span', { class: 'sa-avatar is-missing' }),
        h('span', { class: 'sa-pick-name', text: i.name }), icon('next'))));
    s.setFoot();
  };
  fill();
  ctx.on('me', fill);
  return s;
}

// ---------- a done video, played: its influencer, a heart, Download (with the share mark once it's made), Share, Report ----------
export function videoSheet(ctx, v, { name, inf, mine = false, priv = false, onCaptions = null }) {
  const s = sheet({ title: name || 'A video', sub: jobMeta(v), size: 'md' });
  const shape = SHAPES[v.shape] ? v.shape : 'tall';
  const video = h('video', {
    class: `sa-player is-${shape}`, src: infVideo(v.id), controls: true, playsinline: true, autoplay: true, preload: 'auto',
    ...(v.poster ? { poster: infPoster(inf, v.id) } : {}), 'aria-label': `${name}: an AI-made video`,
  });
  const url = `${location.origin}${ctx.href(`/i/${inf}`)}#v-${v.id}`;
  add(s.body, h('div', { class: `sa-player-wrap is-${shape}` }, video), v.scene ? h('p', { class: 'sa-muted', text: v.scene }) : null);
  const foot = [];
  if (ctx.route.view !== 'influencer') foot.push(linkBtn(`See ${name}`, ctx.href(`/i/${inf}`), { kind: 'primary', dataset: { saLink: '' } }));
  if (!priv) foot.push(likeButton(ctx, { job: v.id, likes: v.likes, can: !mine, cls: 'sa-heart-lg', fresh: false }));
  foot.push(linkBtn('Download', infVideoDl(v.id), { kind: 'ghost', icon: 'download' }));
  foot.push(linkBtn('Share on X ↗', shareJobUrl(name, v.kind, url), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
  // (round 4) captions for a post of it (its own wallet's)
  if (mine && onCaptions) {
    const cap = btn('Captions', { kind: 'ghost', icon: 'caption' });
    cap.addEventListener('click', () => { s.close(); onCaptions(v); });
    foot.push(cap);
  }
  if (!mine) {
    const report = btn('Report', { kind: 'quiet', icon: 'flag' });
    report.addEventListener('click', () => { s.close(); reportSheet(ctx, { inf, job: v.id, name }); });
    foot.push(report);
  }
  s.setFoot(...foot);
  return s;
}

// ---------- a photo seen big: a heart, Download (with the share mark), Share, and (its own) a video or a trend from it ----------
// kind: 'photo' | 'body' (its full body: its photos, videos and 3D model start from it)
export function photoSheet(ctx, j, { name, inf, mine = false, priv = false, kind = 'photo', onVideo = null, onTrend = null, onCaptions = null }) {
  const s = sheet({ title: kind === 'body' ? `${name}: full body` : name || 'Photo', sub: kind === 'body' ? 'Its photos, videos and 3D model start from this.' : jobMeta({ ...j, kind: 'photo' }), size: 'md' });
  const shape = PHOTO_SHAPES[j.shape] ? j.shape : 'tall';
  const banner = kind === 'photo' && shape === 'banner';
  // (round 4, phase 4) a meme: its words are in the picture (said here too, for anyone who can't see it)
  const memeWords = kind === 'photo' && j.meme && j.caption ? String(j.caption).split('\n').join(' / ') : null;
  const big = pic(infPic(inf, j.id, 0), { cls: `sa-big-pic is-${shape}`, alt: `${name}: ${kind === 'body' ? 'full body' : banner ? `an X banner${j.scene ? `, ${j.scene}` : ''}` : memeWords ? `a meme that says “${memeWords}”` : j.scene || 'a photo'}`, lazy: false });
  add(s.body, h('div', { class: `sa-big-wrap${banner ? ' is-banner' : ''}` }, big), memeWords ? h('p', { class: 'sa-meme-words', text: `“${memeWords}”` }) : null,
    kind === 'photo' && j.scene ? h('p', { class: 'sa-muted', text: j.scene }) : null,
    // (round 4) an X banner: where it goes on X
    banner && mine ? h('p', { class: 'sa-note', text: 'On X: your profile → Edit profile → tap the header picture, and pick this one. Its lower left is where your profile picture sits.' }) : null);
  const foot = [];
  if (mine && kind === 'photo' && onVideo) {
    const vid = btn('Make a video from it', { kind: 'primary', icon: 'film' });
    vid.addEventListener('click', () => { s.close(); onVideo(j.id); });
    foot.push(vid);
  }
  if (mine && kind === 'photo' && onTrend) {
    const tr = btn('Use it in a trend', { kind: 'ghost', icon: 'zap' });
    tr.addEventListener('click', () => { s.close(); onTrend(j.id); });
    foot.push(tr);
  }
  if (ctx.route.view !== 'influencer') foot.push(linkBtn(`See ${name}`, ctx.href(`/i/${inf}`), { kind: 'primary', dataset: { saLink: '' } }));
  if (kind === 'photo' && !priv) foot.push(likeButton(ctx, { job: j.id, likes: j.likes, can: !mine, cls: 'sa-heart-lg', fresh: false }));
  // (its download carries the share mark: "Made with AGI Studio · AI-generated", drawn on by our server)
  foot.push(h('a', { class: 'sa-btn sa-btn-ghost', href: infPhotoDl(inf, j.id, 0), download: '' }, icon('download'), h('span', { text: 'Download' })));
  if (kind === 'photo') foot.push(linkBtn('Share on X ↗', shareJobUrl(name, 'photo', `${location.origin}${ctx.href(`/i/${inf}`)}#v-${j.id}`), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
  // (round 4) captions for a post of it (its own wallet's)
  if (mine && kind === 'photo' && onCaptions) {
    const cap = btn('Captions', { kind: 'ghost', icon: 'caption' });
    cap.addEventListener('click', () => { s.close(); onCaptions(j); });
    foot.push(cap);
  }
  if (!mine && kind === 'photo') {
    const rep = btn('Report', { kind: 'quiet', icon: 'flag' });
    rep.addEventListener('click', () => { s.close(); reportSheet(ctx, { inf, job: j.id, name }); });
    foot.push(rep);
  }
  s.setFoot(...foot);
  return s;
}

// ---------- burning $AGI for an unlock (round 2: a free 3D model, one more influencer, a boost in Explore) ----------
// The visitor burns it from their own wallet app (this page never asks a wallet for anything: hard rule 9), then "Check my
// burn" reads it on the chain (our server). quote: { agi, paid } · check(tx | null) → our server's answer · onDone(answer)
export function burnSheet(ctx, { title, sub, quote, lines = [], check, onDone }) {
  const s = sheet({ title, sub, size: 'md' });
  let paid = Number(quote.paid) || 0;
  const need = Number(quote.agi) || 0;
  const progress = h('p', { class: 'sa-burn-progress' });
  const bar = h('span', { class: 'sa-burn-bar-fill' });
  const left = () => Math.max(0, need - paid);
  const sendLine = h('p', { class: 'sa-pay-title' });
  const showProgress = () => {
    progress.textContent = paid > 0 ? `Burned so far: ${num(paid)} of ${num(need)} $AGI` : `${num(need)} $AGI to burn`;
    bar.style.setProperty('--sa-p', `${Math.min(100, Math.round((paid / Math.max(1, need)) * 100))}%`);
    sendLine.textContent = `Send ${num(left())} $AGI to the burn address`;
  };
  showProgress();
  const to = h('code', { class: 'sa-addr', text: BURN_ADDRESS });
  const copied = h('span', { class: 'sa-sr', 'aria-live': 'polite' });
  const copy = btn('Copy', { kind: 'ghost', size: 'sm', icon: 'copy' });
  copy.addEventListener('click', async () => {
    const ok = await copyText(BURN_ADDRESS, to);
    copied.textContent = ok ? 'The burn address copied' : 'Selected: copy it with your keyboard or a long-press';
    ctx.toast(ok ? 'Burn address copied' : 'Address selected: copy it', 'good');
  });
  const tx = h('input', { class: 'sa-input', type: 'text', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'Its link or ID (optional)', 'aria-label': "The burn's transaction link or ID (optional)" });
  const result = h('p', { class: 'sa-note', role: 'status', hidden: true });
  const go = btn('Check my burn', { kind: 'primary', size: 'lg', icon: 'flame', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
  go.addEventListener('click', () => busy(go, 'Checking Robinhood Chain…', async () => {
    const pasted = tx.value.trim();
    const r = await check(pasted || null);
    const d = r.data || {};
    if (r.ok && d.ok) {
      paid = Number(d.have) || paid;
      showProgress();
      say(result, burnCheckText(d));
      if (d.paid) { tx.value = ''; ctx.toast(burnCheckText(d), 'good'); s.close(); onDone?.(d); }
      return;
    }
    say(result, errorText(d.error));
  }));
  add(s.body,
    h('div', { class: 'sa-burn-head' }, h('span', { class: 'sa-burn-icon', 'aria-hidden': 'true' }, icon('flame')), h('div', null, progress, h('span', { class: 'sa-burn-bar', 'aria-hidden': 'true' }, bar))),
    lines.length ? h('ul', { class: 'sa-ticks' }, ...lines.map((t) => h('li', { text: t }))) : null,
    h('div', { class: 'sa-pay' },
      h('p', { class: 'sa-step-n', text: '1' }), sendLine,
      h('p', { class: 'sa-muted', text: `From your connected wallet (${shortAddress(ctx.session?.wallet)}), in your own wallet app (Send → $AGI), on Robinhood Chain:` }),
      h('div', { class: 'sa-addr-row' }, to, copy), copied,
      h('p', { class: 'sa-small sa-muted', text: `That's the burn address: zeros, then dEaD. Nobody has its key, so what's sent there is gone for good (see it on the block explorer). Only the official $AGI counts (its contract ${shortAddress(TOKENS[0].ca)}). A small ETH network fee.` }),
      h('a', { class: 'sa-link', href: BURN_EXPLORER, target: '_blank', rel: 'noopener noreferrer', text: 'The burn address on the block explorer ↗' })),
    h('div', { class: 'sa-pay' },
      h('p', { class: 'sa-step-n', text: '2' }), h('p', { class: 'sa-pay-title', text: 'Then check it here' }),
      h('label', { class: 'sa-label', text: 'Paste its link or ID if you like (we can find it without)' }), tx, go, result),
    h('p', { class: 'sa-fine', text: 'A burn is permanent: nobody gets it, it can\'t be undone or refunded, and it\'s not an investment. What you burn counts toward your level, like a burn for messages. Not financial advice.' }),
  );
  return s;
}

// ---------- report (anyone, with the human check; the owner's page lists reports) ----------
export function reportSheet(ctx, { inf, job = null, name = '' }) {
  const s = sheet({ title: job ? 'Report this' : `Report ${name || 'this influencer'}`, sub: "Tell us what's wrong: every report is looked at, and what shouldn't be here comes down." });
  const why = chips({ legend: "What's wrong?", choices: REPORT_WHYS, cls: 'sa-chips-list' });
  const human = h('div', { class: 'sa-human' });
  const msg = h('p', { class: 'sa-note', role: 'status', hidden: true });
  const send = btn('Send report', { kind: 'primary', icon: 'flag' });
  send.addEventListener('click', () => {
    if (!why.value) { say(msg, 'Pick what\'s wrong first.'); return; }
    busy(send, 'Sending…', async () => {
      const r = await ctx.act('inf-report', { id: inf, ...(job ? { job } : {}), why: why.value }, { human });
      if (r.ok && r.data?.ok) { ctx.toast('Thanks: your report was sent.', 'good'); s.close(); return; }
      const e = r.data?.error;
      say(msg, e === 'too_many' ? "You've sent a lot of reports today: thank you. Try again tomorrow." : e === 'gone' ? 'It isn\'t here any more.' : errorText(e));
    });
  });
  add(s.body, why.node, human, msg);
  s.setFoot(send);
  return s;
}

// "Are you sure?" with a button that says what happens. → true when they pressed it
export function confirmSheet({ title, text, yes, danger = false, sub = null }) {
  return new Promise((resolve) => {
    let ok = false;
    const s = sheet({ title, sub });
    add(s.body, ...(Array.isArray(text) ? text : [text]).map((t) => h('p', { text: t })));
    const go = btn(yes, { kind: danger ? 'danger' : 'primary' });
    go.addEventListener('click', () => { ok = true; s.close(); });
    const no = btn('Cancel', { kind: 'ghost' });
    no.addEventListener('click', () => s.close());
    s.setFoot(go, no);
    s.done.then(() => resolve(ok));
    no.focus();
  });
}

// ---------- the burn unlocks (round 2): one more influencer, or a boost in Explore ----------
// quote: an open one (My studio lists them), else a new one is asked for. → the sheet, or null
export async function unlockSlot(ctx, { quote = null, onDone = null } = {}) {
  if (!(await ctx.requireAdult()) || !(await ctx.requireWallet())) return null;
  let q = quote;
  if (!q) {
    const r = await ctx.act('inf-burn-quote', { what: 'slot' });
    if (!r.ok || !r.data?.ok) { ctx.toast(errorText(r.data?.error), 'bad'); return null; }
    q = r.data;
  }
  return burnSheet(ctx, {
    title: 'One more influencer', sub: `Burn ${num(q.agi)} $AGI from your own wallet: one more influencer for your wallet, for good.`, quote: q,
    lines: ['Your wallet may then have one more influencer at a time (on top of the ones it has).', 'Burns add up: you can burn it in parts, from the same wallet, within a day.'],
    check: (tx) => ctx.act('inf-burn-check', { burn: q.id, ...(tx ? { tx } : {}) }),
    onDone: (d) => { ctx.refreshMe(); onDone?.(d); },
  });
}
export async function boostInf(ctx, inf, { quote = null, hours = 24, onDone = null } = {}) {
  if (!(await ctx.requireAdult()) || !(await ctx.requireWallet())) return null;
  let q = quote;
  if (!q) {
    const r = await ctx.act('inf-burn-quote', { what: 'boost', id: inf.id });
    if (!r.ok || !r.data?.ok) { ctx.toast(errorText(r.data?.error), 'bad'); return null; }
    q = r.data;
  }
  return burnSheet(ctx, {
    title: `Boost ${inf.name}`, sub: `Burn ${num(q.agi)} $AGI from your own wallet: ${inf.name} in Explore's "Boosted" row for ${hours} hours.`, quote: q,
    lines: [`${hours} hours from when the burn is found (added to a boost already on).`, 'Only a public influencer: one shown in Explore, never a private one.'],
    check: (tx) => ctx.act('inf-burn-check', { burn: q.id, ...(tx ? { tx } : {}) }),
    onDone: (d) => { ctx.refreshMe(); onDone?.(d); },
  });
}

// ---------- (round 4) captions for a post of one of its own creations (the owner: "can gerate raedy made captions on their
// posts, or they can generate one too"): ready-made ones (free, at once: src/studio/captions.js), or written by AI in a tone
// (free, a few a day: our server). For X, TikTok or Instagram; each says it's AI-made (a hashtag). Copy, or "Post on X" (X's own
// new-post box: the visitor posts it, never us). ----------
const KIND_WORDS = { photo: 'photo', banner: 'X banner', video: 'video', trend: 'trend video', meme: 'meme' };
export function captionSheet(ctx, { job, name, inf }) {
  const kind = job.kind === 'photo' && job.shape === 'banner' ? 'banner' : job.kind;
  const s = sheet({ title: 'Captions', sub: `For your post of ${name}'s ${KIND_WORDS[kind] || 'creation'}: copy one, then paste it where you post.`, size: 'md' });
  const link = `${location.origin}${ctx.href(`/i/${inf}`)}#v-${job.id}`;
  const st = { platform: 'x', mode: 'ready', offset: 0, tone: 'funny', left: null, written: [] };
  const msg = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const where = h('p', { class: 'sa-fine' });

  // one caption: its words, Copy, and on X "Post on X"
  function row(text) {
    const words = h('p', { class: 'sa-caption-text', text });
    const copy = btn('Copy', { kind: 'ghost', size: 'sm', icon: 'copy' });
    copy.addEventListener('click', async () => { const ok = await copyText(text, words); ctx.toast(ok ? 'Caption copied' : 'Caption selected: copy it', 'good'); });
    return h('li', { class: 'sa-caption' }, words, h('div', { class: 'sa-caption-actions' }, copy,
      st.platform === 'x' ? linkBtn('Post on X ↗', postOnXUrl(text, link), { kind: 'quiet', size: 'sm', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }) : null));
  }

  // ready-made: four at a time, "More ideas" for the next four
  const readyList = h('ul', { class: 'sa-captions' });
  const more = btn('More ideas', { kind: 'quiet', size: 'sm', icon: 'refresh' });
  more.addEventListener('click', () => { st.offset += 4; draw(); });
  const readyBox = h('div', { class: 'sa-caption-box' }, readyList, more);

  // written by AI: its tone, then three
  const tones = chips({ legend: 'Tone', choices: CAPTION_TONES, value: st.tone, cls: 'sa-chips-sm', onchange: (v) => { st.tone = v; } });
  const aiList = h('ul', { class: 'sa-captions', 'aria-live': 'polite' });
  const leftLine = h('span', { class: 'sa-muted sa-small', text: captionsLeftText(null) });
  const write = btn('Write 3 with AI', { kind: 'primary', icon: 'wand' });
  write.addEventListener('click', () => busy(write, 'Writing…', async () => {
    say(msg, '');
    const r = await ctx.act('inf-caption', { job: job.id, tone: st.tone, platform: st.platform });
    const d = r.data || {};
    if (Number.isFinite(d.left)) { st.left = d.left; leftLine.textContent = captionsLeftText(d.left); }
    if (r.ok && d.ok && Array.isArray(d.captions) && d.captions.length) {
      st.written = d.captions.filter((c) => typeof c === 'string');
      put(aiList, ...st.written.map(row));
      return;
    }
    say(msg, captionErrorText(d.error));
  }));
  const aiBox = h('div', { class: 'sa-caption-box', hidden: true }, tones.node, h('div', { class: 'sa-row sa-caption-go' }, write, leftLine), aiList);

  const platforms = segmented({ legend: 'Where you post', choices: Object.entries(CAPTION_PLATFORMS).map(([k, p]) => [k, p.name]), value: st.platform, showLegend: true,
    onchange: (v) => { st.platform = v; st.offset = 0; st.written = []; put(aiList); draw(); } });
  const modes = segmented({ legend: 'Captions', choices: [['ready', 'Ready-made', 'spark'], ['ai', 'Write with AI', 'wand']], value: st.mode, cls: 'sa-seg-wide',
    onchange: (v) => { st.mode = v; draw(); } });

  function draw() {
    say(msg, '');
    readyBox.hidden = st.mode !== 'ready';
    aiBox.hidden = st.mode !== 'ai';
    if (st.mode === 'ready') put(readyList, ...readyCaptions({ name, kind, trend: job.trend, platform: st.platform, seed: job.id, count: 4, offset: st.offset }).map(row));
    else put(aiList, ...st.written.map(row));
    where.textContent = st.platform === 'x'
      ? 'Post on X opens X with the caption and its link: you post it, we never do.'
      : `${CAPTION_PLATFORMS[st.platform].name}: download it first, then paste the caption as you post it.`;
  }
  add(s.body, platforms.node, modes.node, readyBox, aiBox, msg, where,
    h('p', { class: 'sa-fine', text: 'Every caption says it\'s AI-made (a hashtag), and none talk about money or coins. Keep the AI label on where the app asks.' }));
  draw();
  return s;
}
