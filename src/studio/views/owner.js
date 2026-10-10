// AGI Studio: the owner's page (studio.agi1.app/owner; only the owner's wallet: STUDIO_OWNER, else the first of
// STUDIO_ONLY_FOR). The trend moves (the owner's choice: "Made with AI once": each made once by the AI service from the owner's
// own balance, never credits; the owner keeps the good ones), and the reports (hide what shouldn't be here).
import { h, icon, btn, linkBtn, busy, put, add } from '../ui.js';
import { infVideo, infPoster, REPORT_WHYS } from '../rules.js';
import { errorText, agoText, failText } from '../app-words.js';
import { makePosters } from '../media.js';

const STATUS = { none: 'Not made yet', making: 'Being made…', review: 'Made: keep it?', kept: 'Kept: people can use it', hidden: 'Hidden', failed: "Couldn't be made" };

export async function render(ctx, route, root) {
  document.title = 'Owner tools · AGI Studio';
  const body = h('div', { class: 'sa-owner' });
  add(root, h('header', { class: 'sa-page-head' }, h('h1', { class: 'sa-h1', tabindex: '-1', text: 'Owner tools' }),
    h('p', { class: 'sa-muted', text: 'Trend moves (made once by the AI service from your own balance) and reports.' })), body);
  let data = null, loading = false, timer = null;
  const tried = new Set();

  async function load() {
    if (loading) return;
    if (!ctx.session) { put(body, h('p', { class: 'sa-banner', text: 'Connect the owner\'s wallet to see this page.' })); return; }
    loading = true;
    const r = await ctx.act('inf-owner');
    loading = false;
    if (!ctx.alive()) return;
    if (!r.ok) { put(body, h('p', { class: 'sa-banner', text: r.data?.error === 'not_owner' ? 'Only the owner\'s wallet sees this page.' : errorText(r.data?.error) })); return; }
    data = r.data;
    draw();
    clearTimeout(timer);
    if ((data.trends || []).some((t) => t.status === 'making')) timer = setTimeout(() => { if (ctx.alive()) load(); }, 6000);
    const todo = Object.fromEntries(Object.entries(data.posters || {}).filter(([job]) => !tried.has(job)));
    for (const job of Object.keys(todo)) tried.add(job);
    if (Object.keys(todo).length) makePosters(todo, (job) => infVideo(job), { alive: ctx.alive, most: 12 }).then((n) => { if (n && ctx.alive()) load(); });
  }

  function draw() {
    const trends = data.trends || [];
    const missing = trends.filter((t) => ['none', 'failed'].includes(t.status));
    const all = btn(`Make the ${missing.length} missing move${missing.length === 1 ? '' : 's'}`, { kind: 'primary', icon: 'spark' });
    all.hidden = !missing.length;
    all.addEventListener('click', () => busy(all, 'Starting…', async () => {
      for (const t of missing) {
        const r = await ctx.act('trend-make', { trend: t.id });
        if (!r.ok && r.data?.error !== 'making') { ctx.toast(`${t.name}: ${errorText(r.data?.error)}`, 'bad'); break; }
      }
      load();
    }));
    const list = h('ul', { class: 'sa-owner-trends' }, ...trends.map((t) => {
      const actions = h('div', { class: 'sa-row' });
      const make = btn(t.status === 'none' ? 'Make it' : 'Make it again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
      make.disabled = t.status === 'making';
      make.addEventListener('click', () => busy(make, 'Starting…', async () => {
        const r = await ctx.act('trend-make', { trend: t.id });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      add(actions, make);
      if (t.job && t.jobStatus === 'done') {
        for (const [status, label, kind] of [['kept', 'Keep', 'primary'], ['hidden', 'Hide', 'quiet']]) {
          if (t.status === status) continue;
          const b = btn(label, { kind, size: 'sm', icon: status === 'kept' ? 'check' : 'eyeOff' });
          b.addEventListener('click', () => busy(b, '…', async () => {
            const r = await ctx.act('trend-set', { trend: t.id, status });
            if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
            load();
          }));
          add(actions, b);
        }
      }
      const preview = t.job && t.jobStatus === 'done'
        ? h('video', { class: 'sa-owner-video', src: infVideo(t.job), controls: true, playsinline: true, muted: true, loop: true, preload: 'none', ...(t.poster ? { poster: infPoster('trends', t.job) } : {}), 'aria-label': `${t.name}: its video` })
        : h('span', { class: 'sa-owner-video is-empty', 'aria-hidden': 'true', text: t.emoji });
      return h('li', { class: 'sa-card sa-owner-trend' }, preview, h('div', null,
        h('p', { class: 'sa-h3', text: `${t.emoji} ${t.name}` }),
        h('p', { class: `sa-chip-state is-${t.status}`, text: STATUS[t.status] || t.status }),
        t.error ? h('p', { class: 'sa-muted sa-small', text: failText(t.error) }) : null,
        t.updated ? h('p', { class: 'sa-muted sa-small', text: `Updated ${agoText(t.updated)}` }) : null,
        actions));
    }));
    const reports = data.reports || [];
    const rlist = h('ul', { class: 'sa-owner-reports' }, ...reports.map((rep) => {
      const hide = btn(rep.hidden ? 'Show again' : 'Take it down', { kind: rep.hidden ? 'ghost' : 'danger', size: 'sm', icon: rep.hidden ? 'eye' : 'eyeOff' });
      hide.addEventListener('click', () => busy(hide, '…', async () => {
        const r = await ctx.act('inf-hide', { ...(rep.job ? { job: rep.job } : { inf: rep.inf }), hidden: !rep.hidden });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      const fine = btn("It's fine", { kind: 'ghost', size: 'sm', icon: 'check' });
      fine.addEventListener('click', () => busy(fine, '…', async () => {
        const r = await ctx.act('inf-report-clear', { inf: rep.inf, ...(rep.job ? { job: rep.job } : {}) });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      return h('li', { class: 'sa-card sa-owner-report' },
        h('div', null,
          h('p', null, linkBtn(rep.name || 'An influencer', ctx.href(`/i/${rep.inf}`), { kind: 'quiet', size: 'sm', dataset: { saLink: '' } }),
            h('span', { class: 'sa-muted', text: ` · ${rep.job ? 'one of its photos or videos' : 'the influencer'}${rep.mode === 'face' ? ' · an AI twin' : ''}` })),
          h('p', { text: `${rep.count} report${rep.count === 1 ? '' : 's'}: ${rep.whys.map((w) => REPORT_WHYS[w] || w).join(', ')}` }),
          h('p', { class: 'sa-muted sa-small', text: `${agoText(rep.at)}${rep.hidden ? ' · taken down' : ''}` })),
        h('div', { class: 'sa-row' }, hide, fine));
    }));
    put(body,
      h('section', { class: 'sa-section', 'aria-labelledby': 'sa-ot-h' },
        h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-ot-h', text: 'Trend moves' }), all),
        h('p', { class: 'sa-muted sa-small', text: "Each is a made-up dancer doing the move (no music, a plain background): about $0.84 each (10 seconds) from your AI balance, never anyone's credits. Keep the good ones: only kept moves show to people." }),
        list),
      h('section', { class: 'sa-section', 'aria-labelledby': 'sa-or-h' },
        h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-or-h', text: `Reports (${reports.length})` })),
        reports.length ? rlist : h('p', { class: 'sa-muted', text: 'No reports.' })));
  }
  ctx.on('wallet', load);
  await load();
  return () => clearTimeout(timer);
}
