// AGI Studio: Help & support (/help; round 4, phase 2, 2026-10-11, the owner's list: "support (AI helper + tickets)").
//   • the AI helper: quick answers about AGI Studio, written by AI from our own guide (a few a day; anyone);
//   • your tickets (a connected wallet): open one, see the team's answers, add to one, close it. A person on the team answers;
//   • what we never ask for.
// /help?new=<topic> opens a new ticket about that (a ban's words point here), /help?ticket=<id> one of yours.
import { h, icon, btn, put, add } from '../ui.js';
import { TICKET_TOPICS } from '../rules.js';
import { errorText, agoText, TICKET_STATUS, TICKET_NEW, BANNED_TEXT, num } from '../app-words.js';
import { helperBox, ticketSheet, newTicketSheet } from './support.js';

const ID = /^[A-Za-z0-9_-]{22}$/;

export async function render(ctx, route, root) {
  document.title = 'Help & support · AGI Studio';
  const banned = h('p', { class: 'sa-banner', role: 'status', hidden: true, text: BANNED_TEXT });
  const tickets = h('div', { class: 'sa-tickets-box' });
  const newBtn = btn(TICKET_NEW, { kind: 'primary', icon: 'inbox' });
  const open = (topic = null) => newTicketSheet(ctx, { topic, onDone: load });
  newBtn.addEventListener('click', () => open());
  add(root,
    h('header', { class: 'sa-page-head' },
      h('p', { class: 'sa-eyebrow', text: 'Help & support' }),
      h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'How can we help?' }),
      h('p', { class: 'sa-muted', text: 'Ask the helper for a quick answer, or open a ticket: a person on the AGI Studio team answers you here.' }),
      h('p', null, h('a', { href: ctx.href('/learn'), class: 'sa-link', text: 'New here? Learn how AGI Studio works →' }))),
    banned,
    h('div', { class: 'sa-help-grid' },
      h('section', { class: 'sa-card sa-help-card-ai', 'aria-labelledby': 'sa-helper-h' },
        h('h2', { class: 'sa-h2', id: 'sa-helper-h' }, icon('spark'), h('span', { text: 'Ask the helper' })),
        helperBox(ctx, { onTicket: open })),
      h('section', { class: 'sa-card sa-help-card-tickets', 'aria-labelledby': 'sa-tickets-h' },
        h('div', { class: 'sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-tickets-h' }, icon('inbox'), h('span', { text: 'Your tickets' })), newBtn),
        tickets)),
    h('section', { class: 'sa-section', 'aria-labelledby': 'sa-never-h' },
      h('h2', { class: 'sa-h2', id: 'sa-never-h' }, icon('shield'), h('span', { text: 'What we never ask for' })),
      h('ul', { class: 'sa-never' },
        h('li', { text: 'Your seed phrase (recovery words), a private key or a password. Nobody legit asks: not support, not a mod, not the owner.' }),
        h('li', { text: 'To send money or tokens anywhere, to sign anything, or to connect your wallet to another site to "fix" or "claim" something.' }),
        h('li', { text: 'To move to a DM. The team answers here, in your ticket; a message elsewhere saying it\'s us isn\'t.' }))),
  );

  let data = null, loading = false, opened = false, back = null;
  // back on its row after a ticket's sheet closes (the list was drawn again)
  const refocus = () => {
    if (back && (!document.activeElement || document.activeElement === document.body)) tickets.querySelector(`[data-key="${back}"]`)?.focus();
    back = null;
  };
  const routeOpen = () => {
    if (opened || !ctx.session) return;
    opened = true;
    const t = route.q.get('ticket'), topic = route.q.get('new');
    if (t && ID.test(t)) ticketSheet(ctx, t, { onChange: load });
    else if (route.q.has('new')) open(Object.hasOwn(TICKET_TOPICS, topic) ? topic : null);
  };
  function draw() {
    banned.hidden = !ctx.me?.banned;
    if (!ctx.session) {
      const go = btn('Connect your wallet', { kind: 'primary', icon: 'wallet' });
      go.addEventListener('click', async () => { if (await ctx.requireAdult()) ctx.connect(); });
      newBtn.hidden = true;
      put(tickets, h('p', { class: 'sa-muted', text: 'Tickets live with your wallet: connect it to open one and see the team\'s answers. (The helper works without it.)' }), go);
      return;
    }
    newBtn.hidden = false;
    if (!data) { put(tickets, h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Loading your tickets…')); return; }
    if (data.error) { put(tickets, h('p', { class: 'sa-note', text: errorText(data.error) })); return; }
    const list = data.tickets || [];
    if (!list.length) {
      put(tickets, h('p', { class: 'sa-muted', text: 'No tickets yet. If something went wrong with a payment, something you made, or your account, open one: a person answers.' }));
      return;
    }
    const openOnes = list.filter((t) => t.status !== 'closed').length;
    put(tickets,
      h('p', { class: 'sa-muted sa-small', text: `${num(openOnes)} open · ${num(list.length - openOnes)} closed` }),
      h('ul', { class: 'sa-ticket-list' }, ...list.map((t) => {
        const b = h('button', { type: 'button', class: `sa-ticket-row${t.unread ? ' is-unread' : ''}`, dataset: { key: t.id } },
          h('span', { class: 'sa-ticket-row-top' },
            h('span', { class: 'sa-ticket-topic', text: TICKET_TOPICS[t.topic] || 'Support ticket' }),
            t.unread ? h('span', { class: 'sa-tag sa-tag-new', text: 'New answer' }) : null,
            h('span', { class: `sa-tag sa-state is-${t.status === 'answered' ? 'approved' : t.status}`, text: TICKET_STATUS[t.status] || t.status })),
          h('span', { class: 'sa-ticket-first', text: t.first }),
          h('span', { class: 'sa-fine', text: `Updated ${agoText(t.updated)}` }));
        b.addEventListener('click', () => ticketSheet(ctx, t.id, { onChange: () => { back = t.id; load(); ctx.refreshMe(); } }));
        return h('li', null, b);
      })));
    refocus();
  }
  async function load() {
    if (!ctx.session || loading) { draw(); return; }
    loading = true;
    const r = await ctx.act('inf-tickets');
    loading = false;
    if (!ctx.alive()) return;
    data = r.ok ? r.data : { error: r.data?.error || 'busy' };
    draw();
    routeOpen();
  }
  ctx.on('wallet', () => { data = null; load(); });
  ctx.on('me', () => { banned.hidden = !ctx.me?.banned; });
  draw();
  await load();
  if (ctx.session && !ctx.me) ctx.refreshMe();
  // the team's answers show by themselves while you look (every 45 s, only while the tab is shown)
  ctx.every(() => { if (document.visibilityState === 'visible' && ctx.session && !document.querySelector('dialog.sa-sheet[open]')) load(); }, 45_000);
}
