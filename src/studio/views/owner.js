// AGI Studio: the owner's page (studio.agi1.app/owner; only the owner's wallet: STUDIO_OWNER, else the first of
// STUDIO_ONLY_FOR). The trend clips (made once by the AI service from the owner's own balance, never credits; the owner keeps
// the good ones), the example pictures for Create's choices (round 2), the spotlight of the week (round 2: approve it with
// its prize, or skip it to the next best), and the reports (hide what shouldn't be here).
import { h, icon, btn, linkBtn, busy, pic, put, add } from '../ui.js';
import { infVideo, infPoster, infPic, infExample, REPORT_WHYS, EXAMPLES, EXAMPLE_KINDS, INF_STYLES, OPTIONS } from '../rules.js';
import { errorText, agoText, failText, num, compact, weekText, prizeText, WEEK_STATUS } from '../app-words.js';
import { makePosters } from '../media.js';

const STATUS = { none: 'Not made yet', making: 'Being made…', review: 'Made: keep it?', kept: 'Kept: people can use it', hidden: 'Hidden', failed: "Couldn't be made" };
const TX = (tx) => `https://robinhoodchain.blockscout.com/tx/${tx}`;
const MAKING = ['paid', 'making'];
// "style-anime" → "Style · Anime"; "cut-braids" → "Hair style · Braids"
export function exampleName(key) {
  const [kind, ...rest] = String(key).split('-');
  const value = rest.join('-');
  if (kind === 'style') return `Style · ${INF_STYLES[value] || value}`;
  const o = OPTIONS[kind];
  return o ? `${o.label} · ${o.choices[value] || value}` : key;
}

export async function render(ctx, route, root) {
  document.title = 'Owner tools · AGI Studio';
  const body = h('div', { class: 'sa-owner' });
  add(root, h('header', { class: 'sa-page-head' },
    h('p', { class: 'sa-eyebrow', text: 'Only your wallet sees this' }),
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'Owner tools' }),
    h('p', { class: 'sa-muted', text: 'Trend clips and example pictures (made once by the AI service from your own balance), the spotlight of the week, and reports.' })), body);
  let data = null, loading = false, timer = null;
  const tried = new Set();
  // the weeks' prize boxes keep what the owner typed across redraws
  const typed = new Map();

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
    const busyNow = (data.trends || []).some((t) => t.status === 'making') || (data.examples || []).some((x) => MAKING.includes(x.status));
    if (busyNow) timer = setTimeout(() => { if (ctx.alive()) load(); }, 6000);
    const todo = Object.fromEntries(Object.entries(data.posters || {}).filter(([job]) => !tried.has(job)));
    for (const job of Object.keys(todo)) tried.add(job);
    if (Object.keys(todo).length) makePosters(todo, (job) => infVideo(job), { alive: ctx.alive, most: 12 }).then((n) => { if (n && ctx.alive()) load(); });
  }

  // ---------- the trend clips ----------
  function trendsSection() {
    const trends = data.trends || [];
    const missing = trends.filter((t) => ['none', 'failed'].includes(t.status));
    const all = btn(`Make the ${missing.length} missing clip${missing.length === 1 ? '' : 's'}`, { kind: 'primary', icon: 'spark' });
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
        ? h('video', { class: 'sa-owner-video', src: infVideo(t.job), controls: true, playsinline: true, muted: true, loop: true, preload: 'none', ...(t.poster ? { poster: infPoster('trends', t.job) } : {}), 'aria-label': `${t.name}: its clip` })
        : h('span', { class: 'sa-owner-video is-empty', 'aria-hidden': 'true', text: t.emoji });
      return h('li', { class: 'sa-card sa-owner-trend' }, preview, h('div', { class: 'sa-owner-trend-body' },
        h('p', { class: 'sa-h3', text: `${t.emoji} ${t.name}` }),
        h('p', { class: `sa-tag sa-state is-${t.status}`, text: STATUS[t.status] || t.status }),
        t.error ? h('p', { class: 'sa-muted sa-small', text: failText(t.error) }) : null,
        t.updated ? h('p', { class: 'sa-muted sa-small', text: `Updated ${agoText(t.updated)}` }) : null,
        actions));
    }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-ot-h' },
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-ot-h' }, icon('zap'), h('span', { text: 'Trend clips' })), all),
      h('p', { class: 'sa-muted sa-small', text: "Each is a real-looking vertical clip with a made-up young adult, its own camera move and its own sound: about $1.26 each (10 seconds with sound) from your AI balance, never anyone's credits. A trend video puts someone's influencer in its person's place. Keep the good ones: only kept clips show to people." }),
      list);
  }

  // ---------- the example pictures (round 2: Create's choices shown as pictures) ----------
  function examplesSection() {
    const examples = data.examples || [];
    const missing = examples.filter((x) => !x.done && !MAKING.includes(x.status));
    const all = btn(`Make the ${missing.length} missing picture${missing.length === 1 ? '' : 's'}`, { kind: 'primary', icon: 'spark' });
    all.hidden = !missing.length;
    all.addEventListener('click', () => busy(all, 'Starting…', async () => {
      const r = await ctx.act('inf-example-make', { keys: missing.map((x) => x.key) });
      if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
      else if (r.data?.busy?.length) ctx.toast(`${r.data.busy.length} of them were being made already.`, 'info');
      load();
    }));
    const kinds = Object.keys(EXAMPLE_KINDS);
    const grid = h('ul', { class: 'sa-ex-grid' }, ...examples
      .slice().sort((a, b) => kinds.indexOf(a.key.split('-')[0]) - kinds.indexOf(b.key.split('-')[0]) || EXAMPLES.indexOf(a.key) - EXAMPLES.indexOf(b.key))
      .map((x) => {
        const making = MAKING.includes(x.status);
        const again = btn(x.done ? 'Again' : 'Make it', { kind: 'ghost', size: 'sm', icon: 'refresh' });
        again.disabled = making;
        again.addEventListener('click', () => busy(again, '…', async () => {
          const r = await ctx.act('inf-example-make', { keys: [x.key] });
          if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
          load();
        }));
        const state = making ? 'Being made…' : x.status === 'failed' && !x.done ? failText(x.error) : x.done ? 'Shown in Create' : 'Not made yet';
        return h('li', { class: `sa-ex${x.done ? '' : ' is-empty'}${making ? ' is-making' : ''}` },
          x.done ? pic(infExample(x.done), { cls: 'sa-ex-pic', alt: '' }) : h('span', { class: 'sa-ex-pic is-missing', 'aria-hidden': 'true' }, making ? h('span', { class: 'sa-spin' }) : icon('image')),
          h('p', { class: 'sa-ex-name', text: exampleName(x.key) }),
          h('p', { class: 'sa-muted sa-small', text: state }),
          again);
      }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-oe-h' },
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-oe-h' }, icon('image'), h('span', { text: 'Example pictures' })), all),
      h('p', { class: 'sa-muted sa-small', text: `One made-up adult showing each choice in Create (its styles, looks, ages, hair styles, outfits and vibes): about $0.08 a picture from your AI balance (about $${(examples.length * 0.08).toFixed(2)} for all ${examples.length}). Skin, hair color and eyes show as color swatches instead. A picture made again replaces the one shown.` }),
      grid);
  }

  // ---------- the spotlight of the week (round 2) ----------
  function weeksSection() {
    const weeks = data.weeks || [];
    const prizeDefault = Number(ctx.info?.weeklyPrize) || 0;
    const cards = weeks.map((w) => {
      const cover = !w.inf || !w.job ? null : w.kind === 'photo' ? infPic(w.inf, w.job, 0, true) : w.poster ? infPoster(w.inf, w.job) : w.portrait ? infPic(w.inf, w.portrait.job, w.portrait.n, true) : null;
      const media = w.inf
        ? h('a', { class: `sa-week-media is-${w.shape || 'tall'}`, href: `${ctx.href(`/i/${w.inf}`)}#v-${w.job}`, dataset: { saLink: '' }, 'aria-label': `${w.name || 'Its influencer'}: see it` },
          cover ? pic(cover, { cls: 'sa-week-pic', alt: '' }) : h('span', { class: 'sa-week-pic is-missing' }),
          w.kind && w.kind !== 'photo' ? h('span', { class: 'sa-media-play', 'aria-hidden': 'true' }, icon('play')) : null)
        : h('span', { class: 'sa-week-media is-empty', 'aria-hidden': 'true' }, icon('trophy'));
      const facts = h('p', { class: 'sa-muted sa-small', text: w.job
        ? `${compact(w.likes)} like${w.likes === 1 ? '' : 's'} · ${compact(w.holderLikes)} from holders${w.skipped ? ` · ${w.skipped} skipped before it` : ''}`
        : 'Nothing was liked by holders that week.' });
      const actions = h('div', { class: 'sa-row' });
      const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
      if (w.status === 'picked') {
        const id = `sa-prize-${w.week}`;
        const input = h('input', { class: 'sa-input sa-input-num', id, type: 'number', min: '0', max: '1000000', step: '1', inputmode: 'numeric', value: String(typed.get(w.week) ?? prizeDefault) });
        input.addEventListener('input', () => typed.set(w.week, input.value));
        const approve = btn('Approve', { kind: 'primary', size: 'sm', icon: 'check' });
        approve.addEventListener('click', () => {
          const prize = Number(input.value);
          if (!Number.isInteger(prize) || prize < 0 || prize > 1_000_000) { note.hidden = false; note.textContent = 'A prize is a whole number of $AGI from 0 (for glory) to 1,000,000.'; input.focus(); return; }
          busy(approve, '…', async () => {
            const r = await ctx.act('inf-week-set', { week: w.week, week_action: 'approve', prize });
            if (!r.ok) { note.hidden = false; note.textContent = errorText(r.data?.error); return; }
            typed.delete(w.week);
            ctx.toast(`Approved: the spotlight of ${weekText(w.week)}, ${prizeText(prize)}.`, 'good');
            load();
          });
        });
        const skip = btn('Skip to the next best', { kind: 'ghost', size: 'sm', icon: 'next' });
        skip.addEventListener('click', () => busy(skip, '…', async () => {
          const r = await ctx.act('inf-week-set', { week: w.week, week_action: 'skip' });
          if (!r.ok) { note.hidden = false; note.textContent = errorText(r.data?.error); return; }
          ctx.toast(r.data?.job ? 'Skipped: the next best is up.' : 'Skipped: nothing else was liked that week.', 'info');
          load();
        }));
        add(actions, h('label', { class: 'sa-prize-input', for: id }, h('span', { class: 'sa-label', text: 'Prize ($AGI)' }), input), approve, skip);
      }
      if (w.tx) add(actions, h('a', { class: 'sa-link', href: TX(w.tx), target: '_blank', rel: 'noopener noreferrer', text: 'Its prize on the block explorer ↗' }));
      // its controls under the picture and its words (a phone's width), beside the picture from 720 px
      const tools = w.status === 'picked' || w.tx ? h('div', { class: 'sa-week-tools' }, actions, note) : null;
      return h('li', { class: `sa-card sa-week is-${w.status}` }, media, h('div', { class: 'sa-week-body' },
        h('p', { class: 'sa-h3', text: `${weekText(w.week).replace(/^the/, 'The')}${w.name ? `: ${w.name}` : ''}` }),
        h('p', { class: `sa-tag sa-state is-${w.status}`, text: WEEK_STATUS[w.status] || w.status }),
        facts,
        ['approved', 'claimed', 'sending', 'sent'].includes(w.status) ? h('p', { class: 'sa-small', text: `Prize: ${prizeText(w.prize)}` }) : null),
        tools);
    });
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-ow-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-ow-h' }, icon('trophy'), h('span', { text: 'Spotlight of the week' }))),
      h('p', { class: 'sa-muted sa-small', text: `Each Monday (UTC) last week's most loved creation is picked (holders' likes first). Approve it to put it in Explore for two weeks, with its prize from the prize wallet (${prizeDefault > 0 ? `${num(prizeDefault)} $AGI by default` : 'none set'}; 0 = for glory), or skip it to the next best. Its maker claims the prize in My studio.` }),
      weeks.length ? h('ul', { class: 'sa-weeks' }, ...cards) : h('p', { class: 'sa-muted', text: 'No week picked yet: the first is picked on the Monday after the first likes.' }));
  }

  // ---------- reports ----------
  function reportsSection() {
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
            h('span', { class: 'sa-muted', text: ` · ${rep.job ? 'one of its photos or videos' : 'the influencer'}${rep.mode === 'face' ? ' · made from a face' : ''}` })),
          h('p', { text: `${rep.count} report${rep.count === 1 ? '' : 's'}: ${rep.whys.map((w) => REPORT_WHYS[w] || w).join(', ')}` }),
          h('p', { class: 'sa-muted sa-small', text: `${agoText(rep.at)}${rep.hidden ? ' · taken down' : ''}` })),
        h('div', { class: 'sa-row' }, hide, fine));
    }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-or-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-or-h' }, icon('flag'), h('span', { text: `Reports (${reports.length})` }))),
      reports.length ? rlist : h('p', { class: 'sa-muted', text: 'No reports.' }));
  }

  function draw() {
    put(body, weeksSection(), trendsSection(), examplesSection(), reportsSection());
  }
  ctx.on('wallet', load);
  ctx.on('info', () => { if (data) draw(); });
  await load();
  return () => clearTimeout(timer);
}
