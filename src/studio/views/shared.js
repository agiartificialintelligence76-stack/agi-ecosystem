// AGI Studio: the sheets more than one view opens (a trend move's preview, a video played, a report).
import { h, icon, linkBtn, btn, sheet, pic, chips, say, busy, put, add } from '../ui.js';
import { infPic, infPoster, infVideo, infVideoDl, trendOf, creditsText, SHAPES, REPORT_WHYS } from '../rules.js';
import { priceOf, shareJobUrl, errorText } from '../app-words.js';

// A trend move's tile (its poster, else its emoji). onpick: a picker (aria-pressed) or a button that opens its preview
export function trendTile(t, { onpick = null, selected = null, small = false } = {}) {
  const inner = t.poster && t.job
    ? pic(infPoster('trends', t.job), { cls: 'sa-trend-pic' })
    : h('span', { class: 'sa-trend-emoji', 'aria-hidden': 'true', text: t.emoji || '✨' });
  const b = h('button', { type: 'button', class: `sa-trend${small ? ' is-small' : ''}`, ...(selected !== null ? { 'aria-pressed': String(selected) } : {}) },
    h('span', { class: 'sa-trend-frame' }, inner, selected === null ? h('span', { class: 'sa-trend-play', 'aria-hidden': 'true' }, icon('play')) : null),
    h('span', { class: 'sa-trend-name', text: t.name }));
  if (onpick) b.addEventListener('click', () => onpick(t, b));
  return b;
}

// A trend move's preview: the made-up dancer doing it, and "Make it with" one of your ready influencers
export function trendSheet(ctx, t) {
  const s = sheet({ title: `${t.emoji || '✨'} ${t.name}`, sub: 'A trend move: your influencer does it in a 5-second video.', size: 'md' });
  const video = h('video', {
    class: 'sa-trend-video', src: infVideo(t.job), playsinline: true, muted: true, loop: true, autoplay: true, preload: 'auto',
    ...(t.poster ? { poster: infPoster('trends', t.job) } : {}), 'aria-label': `${t.name}: a made-up dancer shows the move`,
  });
  const move = trendOf(t.id)?.move;
  const list = h('div', { class: 'sa-pick-list' });
  add(s.body, h('div', { class: 'sa-trend-stage' }, video), move ? h('p', { class: 'sa-muted sa-small', text: `A made-up dancer ${move}.` }) : null, list);
  const fill = () => {
    if (!s.dialog.isConnected) return;
    const price = creditsText(priceOf('trend', { prices: ctx.me?.prices, level: ctx.level }));
    const ready = (ctx.me?.influencers || []).filter((i) => i.status === 'ready');
    if (!ctx.session || !ready.length) {
      put(list, h('p', { class: 'sa-muted', text: ctx.session
        ? 'Create your influencer first: then it can do this move.'
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

// A done video, played: its influencer, Download, Share on X, Report
export function videoSheet(ctx, v, { name, inf, mine = false }) {
  const s = sheet({ title: name || 'A video', sub: `${v.kind === 'trend' ? 'A trend video' : 'A video'} · AI-generated`, size: 'md' });
  const shape = SHAPES[v.shape] ? v.shape : 'tall';
  const video = h('video', {
    class: `sa-player is-${shape}`, src: infVideo(v.id), controls: true, playsinline: true, autoplay: true, preload: 'auto',
    ...(v.poster ? { poster: infPoster(inf, v.id) } : {}), 'aria-label': `${name}: an AI-made video`,
  });
  const url = `${location.origin}${ctx.href(`/i/${inf}`)}#v-${v.id}`;
  add(s.body, h('div', { class: `sa-player-wrap is-${shape}` }, video), v.scene ? h('p', { class: 'sa-muted', text: v.scene }) : null);
  const foot = [];
  if (ctx.route.view !== 'influencer') foot.push(linkBtn(`See ${name}`, ctx.href(`/i/${inf}`), { kind: 'primary', dataset: { saLink: '' } }));
  foot.push(linkBtn('Download', infVideoDl(v.id), { kind: 'ghost', icon: 'download' }));
  foot.push(linkBtn('Share on X ↗', shareJobUrl(name, v.kind, url), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
  if (!mine) {
    const report = btn('Report', { kind: 'quiet', icon: 'flag' });
    report.addEventListener('click', () => { s.close(); reportSheet(ctx, { inf, job: v.id, name }); });
    foot.push(report);
  }
  s.setFoot(...foot);
  return s;
}

// Report an influencer (or one of its photos or videos): anyone, with the human check; the owner's page lists reports
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
