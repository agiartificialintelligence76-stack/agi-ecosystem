// AGI Studio (round 4, phase 2, 2026-10-11; the owner's list: "support (AI helper + tickets)" and "Mod tools and customer
// support"): what Help & support (/help) and the team's page (/mod) share:
//   • a ticket's messages (the person sees the team's answers as "AGI Studio support"; the team sees who of them wrote each);
//   • a ticket in a sheet: as its own wallet sees it (its answers, a reply, closing it), or as the team does (who it is: their
//     influencers, credits and whether they're banned; answering, closing, and for a mod banning a maker from there);
//   • opening a ticket (its topic, what happened, the one thing never to write);
//   • the AI helper (quick answers from our own guide; a person for the rest);
//   • banning an influencer's maker (a mod's; why, and a note only the team sees).
// Everything anyone wrote is shown with textContent, never as HTML.
import { h, icon, btn, linkBtn, sheet, put, add, busy, say, nextId, chips } from '../ui.js';
import { TICKET_TOPICS, TICKETS, HELPER, BAN_REASONS, creditsText } from '../rules.js';
import {
  errorText, agoText, num, TICKET_STATUS, TICKET_STATUS_TEAM, TEAM_NAME, HELP_QUESTIONS, HELP_INTRO, helpLeftText, HELP_NO_ANSWER,
  HELP_SECRET, TICKET_SAFETY, TICKET_NEW, statusChip,
} from '../app-words.js';

const TEAM_SAFETY = 'They see your answers as "AGI Studio support". Never ask anyone for a seed phrase, a private key or a signature, and never ask them to send money or connect their wallet anywhere.';
const count = (n, max) => `${num(n)} / ${num(max)}`;
// a person's credits, as the team sees them (round 4, phase 3: bought, this month's free ones and bonus ones)
const creditsBadge = (c) => {
  const free = Number(c?.free) || 0, bonus = Number(c?.bonus) || 0;
  const parts = [free ? `${num(free)} free` : null, bonus ? `${num(bonus)} bonus` : null].filter(Boolean);
  return `${creditsText((Number(c?.paid) || 0) + free + bonus)}${parts.length ? ` (${parts.join(', ')})` : ''}`;
};

// ---------- a ticket's messages ----------
export function msgList(msgs, { staff = false } = {}) {
  return h('ol', { class: 'sa-msgs' }, ...(msgs || []).map((m) => h('li', { class: `sa-msg ${m.team ? 'is-team' : 'is-them'}${!staff && !m.team ? ' is-mine' : ''}` },
    h('p', { class: 'sa-msg-who' },
      m.team ? icon('shield') : null,
      h('span', { text: m.team ? (staff ? `${m.by || 'Team'} · team` : TEAM_NAME) : staff ? 'Them' : 'You' }),
      h('span', { class: 'sa-msg-at', text: agoText(m.at) })),
    h('p', { class: 'sa-msg-body', text: m.body }))));
}

// a message box with its count of characters (what's typed stays when the rest of a sheet is drawn again)
function writeBox({ label, placeholder, rows = 4, max = TICKETS.BODY_MAX }) {
  const id = nextId('msg');
  const input = h('textarea', { class: 'sa-input sa-textarea', id, rows: String(rows), maxlength: String(max), placeholder, spellcheck: 'true' });
  const n = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: count(0, max) });
  input.addEventListener('input', () => { n.textContent = count([...input.value].length, max); });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const node = h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id, text: label }), input, h('div', { class: 'sa-field-foot' }, err, n));
  return {
    node, input, err,
    get value() { return input.value; },
    clear() { input.value = ''; n.textContent = count(0, max); say(err, ''); },
  };
}

// ---------- a ticket, in a sheet ----------
// ticketSheet(ctx, id, { staff, mayBan, onChange }) → the sheet's done promise. Its messages are read again every 30 s while
// it's open (a new answer shows by itself).
export function ticketSheet(ctx, id, { staff = false, mayBan = false, onChange = null } = {}) {
  const s = sheet({ title: 'Support ticket', sub: 'Loading…', size: 'md' });
  const titleEl = s.dialog.querySelector('.sa-sheet-title');
  const subEl = s.dialog.querySelector('.sa-sheet-sub');
  const person = h('div', { class: 'sa-ticket-person', hidden: true });
  const thread = h('div', { class: 'sa-ticket-thread', 'aria-live': 'polite' }, h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Loading…'));
  const box = writeBox({ label: staff ? 'Your answer' : 'Add to it', placeholder: staff ? 'Answer them here…' : 'Anything to add? The team sees it here.' });
  const send = btn(staff ? 'Send answer' : 'Send', { kind: 'primary', icon: 'send' });
  const closeBtn = btn(staff ? 'Close the ticket' : 'Close it (all sorted)', { kind: 'quiet', size: 'sm', icon: 'check' });
  const compose = h('div', { class: 'sa-ticket-compose', hidden: true }, box.node, h('div', { class: 'sa-row sa-row-between' }, send, closeBtn),
    h('p', { class: 'sa-fine', text: staff ? TEAM_SAFETY : TICKET_SAFETY }));
  const closedNote = h('div', { class: 'sa-ticket-closed', hidden: true });
  const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
  add(s.body, person, thread, note, compose, closedNote);
  let ticket = null, changed = false, armed = false, armTimer = null, timer = null;

  function draw() {
    if (!ticket) return;
    titleEl.textContent = TICKET_TOPICS[ticket.topic] || 'Support ticket';
    subEl.textContent = `${(staff ? TICKET_STATUS_TEAM : TICKET_STATUS)[ticket.status] || ''} · opened ${agoText(ticket.created)}`;
    put(thread, msgList(ticket.msgs, { staff }));
    // the team's view: who it is (never their address: their influencers, credits, and whether they're banned)
    if (staff && ticket.person) {
      const p = ticket.person;
      person.hidden = false;
      put(person,
        h('div', { class: 'sa-row' },
          p.banned ? h('span', { class: 'sa-tag sa-state is-failed' }, icon('ban'), h('span', { text: 'Banned' })) : null,
          h('span', { class: 'sa-badge' }, icon('bolt'), h('span', { text: creditsBadge(p.credits) }))),
        p.influencers.length
          ? h('ul', { class: 'sa-ticket-infs', 'aria-label': 'Their influencers' }, ...p.influencers.map((i) => {
            const li = h('li', null,
              linkBtn(i.name || 'An influencer', ctx.href(`/i/${i.id}`), { kind: 'quiet', size: 'sm', dataset: { saLink: '' } }),
              h('span', { class: 'sa-muted sa-small', text: [statusChip(i.status), i.hidden ? 'taken down' : ''].filter(Boolean).join(' · ') }));
            if (mayBan && !p.banned) {
              const ban = btn('Ban its maker', { kind: 'quiet', size: 'sm', icon: 'ban' });
              ban.addEventListener('click', () => banSheet(ctx, { inf: i.id, name: i.name, onDone: () => { changed = true; load(); } }));
              add(li, ban);
            }
            return li;
          }))
          : h('p', { class: 'sa-muted sa-small', text: "No influencers (or they deleted them)." }));
    }
    const closed = ticket.status === 'closed';
    compose.hidden = closed;
    closedNote.hidden = !closed;
    if (closed) {
      const again = staff ? null : btn(TICKET_NEW, { kind: 'ghost', size: 'sm', icon: 'plus' });
      again?.addEventListener('click', () => { s.close(); newTicketSheet(ctx, { topic: ticket.topic, onDone: onChange }); });
      put(closedNote, h('p', { class: 'sa-muted', text: `Closed ${agoText(ticket.closed || ticket.updated)}.${staff ? '' : ' Need more help? Open a new one.'}` }), again);
    }
  }
  async function load() {
    const r = await ctx.act(staff ? 'mod-ticket' : 'inf-ticket', { ticket: id });
    if (!s.dialog.open) return;
    const d = r.data || {};
    if (!r.ok || !d.ticket) {
      put(thread, h('p', { class: 'sa-note', text: d.error === 'gone' ? "That ticket isn't here." : errorText(d.error) }));
      subEl.textContent = '';
      return;
    }
    ticket = d.ticket;
    draw();
  }
  send.addEventListener('click', () => {
    say(box.err, '');
    if (!box.value.trim()) { say(box.err, errorText('ticket_empty')); box.input.focus(); return; }
    busy(send, 'Sending…', async () => {
      const r = await ctx.act(staff ? 'mod-ticket-say' : 'inf-ticket-say', { ticket: id, body: box.value });
      const d = r.data || {};
      if (r.ok && d.ticket) {
        ticket = d.ticket;
        changed = true;
        box.clear();
        draw();
        ctx.toast(staff ? 'Answer sent' : 'Sent to the team 💜', 'good');
        return;
      }
      // a seed phrase or a private key: never kept, and not left on screen either
      if (d.error === 'secret') box.clear();
      say(box.err, errorText(d.error));
      box.input.focus();
    });
  });
  closeBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      closeBtn.lastChild.textContent = 'Tap again to close it';
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { armed = false; closeBtn.lastChild.textContent = staff ? 'Close the ticket' : 'Close it (all sorted)'; }, 5000);
      return;
    }
    armed = false;
    clearTimeout(armTimer);
    busy(closeBtn, 'Closing…', async () => {
      const r = await ctx.act(staff ? 'mod-ticket-close' : 'inf-ticket-close', { ticket: id });
      const d = r.data || {};
      if (r.ok && d.ticket) { ticket = d.ticket; changed = true; draw(); ctx.toast('Ticket closed', 'good'); return; }
      say(note, errorText(d.error));
    }).finally(() => { closeBtn.lastChild.textContent = staff ? 'Close the ticket' : 'Close it (all sorted)'; });
  });
  load();
  timer = setInterval(() => { if (document.visibilityState === 'visible' && ticket && ticket.status !== 'closed') load(); }, 30_000);
  // (the person's own: reading it marks the team's answers read, so its list changes too)
  return s.done.then(() => { clearInterval(timer); clearTimeout(armTimer); if (changed || !staff) onChange?.(); });
}

// ---------- opening a ticket ----------
export async function newTicketSheet(ctx, { topic = null, onDone = null } = {}) {
  if (!(await ctx.requireAdult())) return;
  if (!(await ctx.requireWallet())) return;
  const s = sheet({ title: TICKET_NEW, sub: 'A person on the AGI Studio team reads it and answers here, in Help & support.' });
  let picked = Object.hasOwn(TICKET_TOPICS, topic) ? topic : null;
  const topics = chips({ legend: "What's it about?", choices: TICKET_TOPICS, value: picked, onchange: (v) => { picked = v; say(topicErr, ''); } });
  const topicErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const box = writeBox({ label: 'What happened?', placeholder: "Tell us what you did and what you saw. A transaction's link, or which influencer, helps.", rows: 6 });
  const send = btn('Send to the team', { kind: 'primary', size: 'lg', icon: 'send' });
  add(s.body, topics.node, topicErr, box.node, h('p', { class: 'sa-fine', text: TICKET_SAFETY }));
  s.setFoot(send);
  (picked ? box.input : topics.node.querySelector('input'))?.focus();
  send.addEventListener('click', () => {
    say(topicErr, '');
    say(box.err, '');
    if (!picked) { say(topicErr, errorText('ticket_topic')); topics.node.querySelector('input')?.focus(); return; }
    if (!box.value.trim()) { say(box.err, errorText('ticket_empty')); box.input.focus(); return; }
    busy(send, 'Sending…', async () => {
      const r = await ctx.act('inf-ticket-open', { topic: picked, body: box.value });
      const d = r.data || {};
      if (r.ok && d.ok) {
        s.close();
        ctx.toast('Sent to the team 💜 Their answer shows in Help & support.', 'good');
        onDone?.(d);
        if (d.id) ticketSheet(ctx, d.id, { onChange: onDone });
        return;
      }
      if (d.error === 'secret') box.clear();
      say(d.error === 'ticket_topic' ? topicErr : box.err, errorText(d.error));
    });
  });
  return s.done;
}

// ---------- the AI helper ----------
// helperBox(ctx, { onTicket }) → its node. Quick answers about AGI Studio, written by AI from our own guide (server/inf-help.js):
// a few a day for a wallet (or a visitor who isn't signed in, after the human check). Only the question, and the person's
// one or two before it (never the helper's answers), go with each.
export function helperBox(ctx, { onTicket = null } = {}) {
  const id = nextId('help');
  const asked = [];
  const log = h('ol', { class: 'sa-help-log', 'aria-live': 'polite' });
  const input = h('input', { class: 'sa-input', id, type: 'text', maxlength: String(HELPER.QUESTION_MAX), autocomplete: 'off', placeholder: 'Ask anything…' });
  const ask = btn('Ask', { kind: 'primary', icon: 'send' });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const left = h('p', { class: 'sa-fine', text: helpLeftText(null) });
  const human = h('div', { class: 'sa-human' });
  const quick = h('div', { class: 'sa-help-quick', role: 'group', 'aria-label': 'Questions to start with' }, ...HELP_QUESTIONS.map((q) => {
    const b = h('button', { type: 'button', class: 'sa-idea', text: q });
    b.addEventListener('click', () => { input.value = q; go(); });
    return b;
  }));
  const ticketBtn = (topic) => {
    const b = btn(TICKET_NEW, { kind: 'ghost', size: 'sm', icon: 'inbox' });
    b.addEventListener('click', () => (onTicket ? onTicket(topic) : newTicketSheet(ctx, { topic })));
    return b;
  };
  function answerItem(q) {
    const a = h('div', { class: 'sa-help-a' }, h('p', { class: 'sa-help-who' }, icon('spark'), h('span', { text: 'Helper · AI' })),
      h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Thinking…'));
    log.append(h('li', { class: 'sa-help-item' }, h('p', { class: 'sa-help-q' }, h('span', { class: 'sa-help-who', text: 'You' }), h('span', { text: q })), a));
    return a;
  }
  async function go() {
    say(err, '');
    const q = input.value.trim();
    if (!q) { say(err, errorText('help_empty')); input.focus(); return; }
    if ([...q].length > HELPER.QUESTION_MAX) { say(err, errorText('help_long')); input.focus(); return; }
    await busy(ask, 'Asking…', async () => {
      const before = asked.slice(-2);
      // the question shows at once, the answer under it when it comes
      const a = answerItem(q);
      input.value = '';
      const send = () => ctx.act('inf-help', { question: q, before }, ctx.session ? {} : { human });
      let r = await send();
      // a wallet whose session had ended: asked again as a visitor (the human check)
      if (!r.ok && r.data?.signedOut && !ctx.session) r = await send();
      const d = r.data || {};
      if (!r.ok) {
        a.parentElement?.remove();
        // (a seed phrase or a key never goes back in the box: it's gone from the page too)
        if (d.error === 'secret') {
          say(err, HELP_SECRET);
          add(err, h('span', { text: ' ' }), ticketBtn('payment'));
        } else {
          input.value = q;
          say(err, d.error === 'ai' ? "The helper didn't answer just now: try again in a minute, or open a ticket." : errorText(d.error));
        }
        if (Number.isFinite(d.left)) left.textContent = helpLeftText(d.left);
        input.focus();
        return;
      }
      asked.push(q);
      if (Number.isFinite(d.left)) left.textContent = helpLeftText(d.left);
      const text = typeof d.answer === 'string' ? d.answer.trim() : '';
      const topic = Object.hasOwn(TICKET_TOPICS, d.ticket) ? d.ticket : null;
      if (!text || d.blocked) {
        put(a, a.firstChild, h('p', { class: 'sa-help-text', text: HELP_NO_ANSWER }), h('div', { class: 'sa-row' }, ticketBtn(topic || 'other')));
        return;
      }
      put(a, a.firstChild, h('p', { class: 'sa-help-text', text }),
        topic ? h('div', { class: 'sa-row' }, h('span', { class: 'sa-muted sa-small', text: 'Need a person for this?' }), ticketBtn(topic)) : null);
    });
  }
  ask.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return h('div', { class: 'sa-help' },
    h('p', { class: 'sa-muted sa-small', text: HELP_INTRO }),
    quick, log,
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id, text: 'Your question' }), h('div', { class: 'sa-input-row' }, input, ask), err),
    human, left,
    h('p', { class: 'sa-fine', text: "Answers are written by AI and can be wrong: for a payment, a ban or something that broke, a person checks. Never type a seed phrase, a private key or a password." }));
}

// ---------- banning an influencer's maker (a mod's, or the owner's) ----------
export function banSheet(ctx, { inf, name = null, onDone = null }) {
  const s = sheet({ title: `Ban ${name ? `${name}'s` : 'its'} maker?`, sub: 'For something that breaks the rules. A mod can lift it later.' });
  let reason = null;
  const reasons = chips({ legend: 'Why', choices: BAN_REASONS, onchange: (v) => { reason = v; say(reasonErr, ''); } });
  const reasonErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const box = writeBox({ label: 'A note for the team (optional)', placeholder: 'What you saw, for whoever looks at it next. Only the team sees this.', rows: 3, max: 200 });
  const go = btn('Ban the maker', { kind: 'danger', size: 'lg', icon: 'ban' });
  add(s.body,
    h('p', { class: 'sa-note', text: "Their wallet can't make anything in AGI Studio any more (its credits stay; anything still being made stops and gives its credits back), and all of its influencers, their pictures and their videos are hidden from everyone. It can still open a support ticket. The owner's and the team's wallets can't be banned." }),
    reasons.node, reasonErr, box.node);
  s.setFoot(go);
  go.addEventListener('click', () => {
    if (!reason) { say(reasonErr, 'Pick why first.'); reasons.node.querySelector('input')?.focus(); return; }
    busy(go, 'Banning…', async () => {
      const r = await ctx.act('mod-ban', { inf, reason, note: box.value });
      const d = r.data || {};
      if (r.ok && d.ok) {
        s.close();
        ctx.toast(`Banned: ${d.infs === 1 ? '1 influencer' : `${num(d.infs)} influencers`} hidden`, 'good');
        onDone?.(d);
        return;
      }
      say(box.err, errorText(d.error));
    });
  });
  return s.done;
}
