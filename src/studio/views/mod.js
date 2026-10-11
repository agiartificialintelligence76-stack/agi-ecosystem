// AGI Studio: the team's page (/mod; round 4, phase 2, 2026-10-11, the owner's list: "Mod tools and customer support").
// Only AGI Studio's team: the owner (everything), a mod (support tickets, reports, bans) or support (tickets).
//   • Tickets: waiting for the team, answered, closed; each as the team sees it (who it is: their influencers, credits and
//     whether they're banned), answered as "AGI Studio support", closed;
//   • Reports: take something down, or say it's fine; ban its maker;
//   • Bans: why, by whom, and lifting one;
//   • alerts on Telegram (new tickets, and reports for mods), from AGI-1's bot: a link that works for a day.
import { h, icon, btn, linkBtn, put, add, busy, say, pageTabs, segmented } from '../ui.js';
import { REPORT_WHYS, BAN_REASONS, TICKET_TOPICS } from '../rules.js';
import { errorText, agoText, num, TICKET_STATUS_TEAM, ROLE_NAMES, ROLE_NOTES } from '../app-words.js';
import { ticketSheet, banSheet } from './support.js';

const FILTERS = [['open', 'Waiting'], ['answered', 'Answered'], ['closed', 'Closed']];
const NONE = { open: 'Nothing waiting for the team. 💜', answered: 'No answered tickets waiting for their reply.', closed: 'No closed tickets yet.' };

export async function render(ctx, route, root) {
  document.title = 'Mod tools · AGI Studio';
  const who = h('p', { class: 'sa-muted', text: "AGI Studio's team: support tickets, reports and bans." });
  const body = h('div', { class: 'sa-mod' });
  add(root, h('header', { class: 'sa-page-head' },
    h('p', { class: 'sa-eyebrow', text: "AGI Studio's team" }),
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'Mod tools' }), who), body);
  let data = null, loading = false, role = null, status = 'open', tabs = null, latest = '', back = null;
  // what each panel shows (drawn again on each look); the parts around them (the tabs, the filter) are drawn once
  const lists = { tickets: h('div', { class: 'sa-mod-list' }), reports: h('div', { class: 'sa-mod-list' }), bans: h('div', { class: 'sa-mod-list' }) };
  const fresh = h('p', { class: 'sa-note sa-mod-fresh', role: 'status', hidden: true });
  const alerts = h('section', { class: 'sa-card sa-alerts', 'aria-labelledby': 'sa-mod-alerts-h' });
  const ownerLink = h('p', { class: 'sa-owner-link', hidden: true }, linkBtn('Owner tools', ctx.href('/owner'), { kind: 'ghost', icon: 'shield', dataset: { saLink: '' } }));
  const filter = segmented({ legend: 'Show', choices: FILTERS, value: status, onchange: (v) => { status = v; load(); } });
  // back where you were after a sheet closes (its row was drawn again)
  const refocus = () => {
    if (!back || (document.activeElement && document.activeElement !== document.body)) return;
    body.querySelector(`[data-key="${back}"]`)?.focus();
  };
  const reload = (key) => () => { back = key; load(); };

  // ---------- tickets ----------
  function ticketsList() {
    const list = data.tickets || [];
    if (!list.length) return h('p', { class: 'sa-muted sa-mod-none', text: NONE[status] });
    return h('ul', { class: 'sa-ticket-list' }, ...list.map((t) => {
      const b = h('button', { type: 'button', class: `sa-ticket-row${t.status === 'open' ? ' is-unread' : ''}`, dataset: { key: `t-${t.id}` } },
        h('span', { class: 'sa-ticket-row-top' },
          h('span', { class: 'sa-ticket-topic', text: TICKET_TOPICS[t.topic] || 'Support ticket' }),
          t.banned ? h('span', { class: 'sa-tag sa-state is-failed' }, icon('ban'), h('span', { text: 'Banned' })) : null,
          h('span', { class: `sa-tag sa-state is-${t.status === 'answered' ? 'approved' : t.status}`, text: TICKET_STATUS_TEAM[t.status] || t.status })),
        h('span', { class: 'sa-ticket-first', text: t.first }),
        h('span', { class: 'sa-fine', text: `${num(t.msgs)} message${t.msgs === 1 ? '' : 's'} · opened ${agoText(t.created)} · updated ${agoText(t.updated)}` }));
      b.addEventListener('click', () => ticketSheet(ctx, t.id, { staff: true, mayBan: Array.isArray(data.bans), onChange: reload(`t-${t.id}`) }));
      return h('li', null, b);
    }));
  }

  // ---------- reports (a mod's and the owner's) ----------
  function reportsList() {
    const reports = data.reports || [];
    if (!reports.length) return h('p', { class: 'sa-muted sa-mod-none', text: 'No reports to look at.' });
    return h('ul', { class: 'sa-owner-reports' }, ...reports.map((rep) => {
      const key = `r-${rep.inf}-${rep.job || ''}`;
      const hide = btn(rep.hidden ? 'Show again' : 'Take it down', { kind: rep.hidden ? 'ghost' : 'danger', size: 'sm', icon: rep.hidden ? 'eye' : 'eyeOff', dataset: { key } });
      hide.addEventListener('click', () => busy(hide, '…', async () => {
        const r = await ctx.act('inf-hide', { ...(rep.job ? { job: rep.job } : { inf: rep.inf }), hidden: !rep.hidden });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        back = key;
        load();
      }));
      const fine = btn("It's fine", { kind: 'ghost', size: 'sm', icon: 'check' });
      fine.addEventListener('click', () => busy(fine, '…', async () => {
        const r = await ctx.act('inf-report-clear', { inf: rep.inf, ...(rep.job ? { job: rep.job } : {}) });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      const ban = rep.banned ? null : btn('Ban its maker', { kind: 'quiet', size: 'sm', icon: 'ban' });
      ban?.addEventListener('click', () => banSheet(ctx, { inf: rep.inf, name: rep.name, onDone: reload(key) }));
      return h('li', { class: 'sa-card sa-owner-report' },
        h('div', null,
          h('p', null,
            // (a banned maker's influencers are hidden from everyone but it: no link)
            rep.banned ? h('span', { class: 'sa-h3', text: rep.name || 'An influencer' })
              : linkBtn(rep.name || 'An influencer', ctx.href(`/i/${rep.inf}`), { kind: 'quiet', size: 'sm', dataset: { saLink: '' } }),
            h('span', { class: 'sa-muted', text: ` · ${rep.job ? 'one of its photos or videos' : 'the influencer'}` })),
          h('p', { text: `${rep.count} report${rep.count === 1 ? '' : 's'}: ${rep.whys.map((w) => REPORT_WHYS[w] || w).join(', ')}` }),
          h('p', { class: 'sa-muted sa-small', text: `${agoText(rep.at)}${rep.hidden ? ' · taken down' : ''}${rep.banned ? ' · its maker is banned' : ''}` })),
        h('div', { class: 'sa-row' }, hide, fine, ban));
    }));
  }

  // ---------- bans (a mod's and the owner's) ----------
  const armed = new Set();
  function bansList() {
    const bans = data.bans || [];
    if (!bans.length) return h('p', { class: 'sa-muted sa-mod-none', text: 'Nobody has been banned.' });
    const active = bans.filter((b) => !b.lifted), lifted = bans.filter((b) => b.lifted);
    const row = (b) => {
      const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
      let lift = null;
      if (!b.lifted) {
        const label = () => (armed.has(b.id) ? 'Tap again to lift it' : 'Lift the ban');
        lift = btn(label(), { kind: 'ghost', size: 'sm', icon: 'refresh', dataset: { key: `b-${b.id}` } });
        lift.addEventListener('click', () => {
          if (!armed.has(b.id)) {
            armed.add(b.id);
            lift.lastChild.textContent = label();
            setTimeout(() => { armed.delete(b.id); if (lift.isConnected) lift.lastChild.textContent = label(); }, 5000);
            return;
          }
          armed.delete(b.id);
          busy(lift, 'Lifting…', async () => {
            const r = await ctx.act('mod-unban', { ban: b.id });
            const d = r.data || {};
            if (r.ok && d.ok) {
              ctx.toast('Ban lifted: their influencers show again', 'good');
              if (Array.isArray(d.bans)) { data.bans = d.bans; drawLists(); } else load();
              return;
            }
            say(note, errorText(d.error));
          });
        });
      }
      return h('li', { class: `sa-card sa-ban${b.lifted ? ' is-lifted' : ''}` },
        h('div', { class: 'sa-ban-body' },
          h('p', { class: 'sa-h3', text: b.name ? `${b.name}'s maker` : 'A maker' }),
          h('p', { class: 'sa-small', text: BAN_REASONS[b.reason] || b.reason }),
          b.note ? h('p', { class: 'sa-ban-note', text: `Note: ${b.note}` }) : null,
          h('p', { class: 'sa-fine', text: [
            `Banned by ${b.by || 'the team'} ${agoText(b.at)}`,
            b.lifted ? `lifted by ${b.liftedBy || 'the team'} ${agoText(b.lifted)}` : `${b.infs === 1 ? '1 influencer' : `${num(b.infs)} influencers`} hidden`,
            b.tickets ? `${num(b.tickets)} ticket${b.tickets === 1 ? '' : 's'}` : '',
          ].filter(Boolean).join(' · ') })),
        lift ? h('div', { class: 'sa-row' }, lift) : null, note);
    };
    return [
      active.length ? h('ul', { class: 'sa-bans' }, ...active.map(row)) : h('p', { class: 'sa-muted sa-mod-none', text: 'Nobody is banned right now.' }),
      lifted.length ? h('details', { class: 'sa-bans-lifted' }, h('summary', { text: `Lifted (${lifted.length})` }), h('ul', { class: 'sa-bans' }, ...lifted.map(row))) : null,
    ];
  }

  // ---------- alerts on Telegram ----------
  function drawAlerts() {
    const link = data.alerts?.link;
    const what = role === 'support' ? 'new support tickets' : 'new support tickets and reports';
    put(alerts,
      h('h2', { class: 'sa-h3 sa-alerts-title', id: 'sa-mod-alerts-h' }, icon('bell'), h('span', { text: 'Alerts on Telegram' })),
      link
        ? [h('p', { class: 'sa-muted sa-small', text: `Hear about ${what} in AGI-1's Telegram bot (how many, and this page's link: never what anyone wrote), at most every 5 minutes. The link works for a day; /stop in Telegram turns them off.` }),
          h('div', { class: 'sa-row' }, h('a', { class: 'sa-btn sa-btn-ghost sa-btn-sm', href: link, target: '_blank', rel: 'noopener noreferrer' }, icon('bell'), h('span', { text: 'Turn them on in Telegram ↗' })))]
        : h('p', { class: 'sa-muted sa-small', text: "AGI-1's Telegram bot isn't set up, so alerts are off." }));
  }

  function drawLists() {
    put(lists.tickets, ticketsList());
    if (Array.isArray(data.reports)) put(lists.reports, reportsList());
    if (Array.isArray(data.bans)) put(lists.bans, bansList());
    tabs.count('tickets', status === 'open' ? (data.tickets || []).length : 0);
    tabs.count('reports', (data.reports || []).filter((r) => !r.hidden).length);
    refocus();
    back = null;
  }
  function draw() {
    role = data.me?.role || null;
    const can = role === 'owner' ? 'everything' : (ROLE_NOTES[role] || '').toLowerCase();
    who.textContent = `You're ${data.me?.nick || 'on the team'} · ${ROLE_NAMES[role] || 'Team'}${can ? `: ${can}` : ''}.`;
    const items = [['tickets', 'Tickets', 'inbox']];
    if (Array.isArray(data.reports)) items.push(['reports', 'Reports', 'flag']);
    if (Array.isArray(data.bans)) items.push(['bans', 'Bans', 'ban']);
    const keys = items.map(([k]) => k).join();
    if (!tabs || tabs.keys !== keys) {
      tabs = pageTabs({ label: 'Mod tools', items, value: tabs?.value || route.q.get('tab') || 'tickets', onchange: (k) => {
        const url = new URL(location.href);
        url.searchParams.set('tab', k);
        history.replaceState(history.state, '', url.pathname + url.search);
      } });
      tabs.keys = keys;
      put(tabs.panel('tickets'), filter.node, lists.tickets);
      if (Array.isArray(data.reports)) put(tabs.panel('reports'), lists.reports);
      if (Array.isArray(data.bans)) put(tabs.panel('bans'), lists.bans);
      put(body, fresh, tabs.node, ...items.map(([k]) => tabs.panel(k)), alerts, ownerLink);
    }
    ownerLink.hidden = role !== 'owner';
    drawAlerts();
    drawLists();
  }

  async function load({ quiet = false } = {}) {
    if (loading) return;
    if (!ctx.session) {
      const go = btn('Connect your wallet', { kind: 'primary', icon: 'wallet' });
      go.addEventListener('click', async () => { if (await ctx.requireAdult()) ctx.connect(); });
      tabs = null;
      put(body, h('p', { class: 'sa-banner', text: "Connect your wallet: this page is for AGI Studio's team." }), go);
      return;
    }
    loading = true;
    const r = await ctx.act('inf-mod', { status });
    loading = false;
    if (!ctx.alive()) return;
    if (!r.ok) {
      data = null;
      tabs = null;
      put(body, h('p', { class: 'sa-banner', text: r.data?.error === 'not_staff' ? "Only AGI Studio's team sees this page." : errorText(r.data?.error) }));
      return;
    }
    const sig = JSON.stringify([r.data.tickets, r.data.reports, r.data.bans]);
    if (quiet && sig === latest) return;
    // (a look every 45 s: when something changed while you're in the middle of it, it says so instead of drawing it again)
    if (quiet && body.contains(document.activeElement)) {
      say(fresh, 'Something new came in.');
      const again = btn('Show it', { kind: 'ghost', size: 'sm', icon: 'refresh' });
      again.addEventListener('click', () => { say(fresh, ''); latest = ''; load(); });
      fresh.append(' ', again);
      return;
    }
    latest = sig;
    data = r.data;
    say(fresh, '');
    draw();
  }
  ctx.on('wallet', () => { tabs = null; latest = ''; load(); });
  await load();
  ctx.every(() => {
    if (document.visibilityState === 'visible' && ctx.session && !document.querySelector('dialog.sa-sheet[open]')) load({ quiet: true });
  }, 45_000);
}
