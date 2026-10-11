// AGI Studio (round 4, phase 3, 2026-10-11; the owner's choices: "gifting bought credits only" (to a wallet by its address,
// the clank.trade name it shows here, or a gift link; at most 50,000 credits a day) and invites for credits only):
//   • My studio's "Gifts and invites" card: its invite link (Copy, Share on X) and how its invites went; an invite code to
//     join with (a wallet that never bought credits, once); giving credits (who, how many, a note, then a review before
//     anything moves); gift links (made, copied, taken back while nobody claimed them); its gifts and its invites' rewards.
//   • The sheet a gift link opens ("…/explore#gift=<its secret>"): what it is and from whom, then "Claim it" (18+, a wallet).
// A gift link's secret is the part after "#gift=": a page's address never carries it to a server (a fragment stays in the
// browser), it goes only in a POST's body (inf-gift-peek, inf-gift-claim), and the page takes it out of its address as soon
// as the sheet closes. Credits have no cash value: every gift's sheet says never to buy credits from anyone, and that nobody
// from AGI Studio asks anyone to send credits. Everything anyone wrote (a note, a name) is shown with textContent.
import { h, icon, btn, linkBtn, sheet, put, add, busy, say, nextId, copyText } from '../ui.js';
import { GIFTS, GIFT_TOKEN, REF_CODE, creditsText, usd, inviteLink, giftLink } from '../rules.js';
import {
  num, errorText, agoText, dayText, GIFT_SAFETY, GIFT_LINK_NOTE, recipientShape, recipientLabel, giftCreditsFrom, giftPicks,
  giftErrorText, giftErrorField, giftRulesText, giftableText, giftRowTitle, giftRowState, rewardTitle, inviteText, INVITE_FINE,
  inviteStats, welcomeLine, inviteJoinedText, shareInviteUrl, giftShareText, CLAIM_STATUS, bonusText, GIFT_NO_WALLET,
} from '../app-words.js';

const SHOWN = 8;                                  // gifts and rewards shown before "Show all"
const spinner = (text) => h('p', { class: 'sa-muted sa-small sa-loading' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: ` ${text}` }));

// What's typed as an invite: its code, or the invite link it came in ("…?ref=<code>"). → the code, or null
export function inviteCodeFrom(input) {
  const s = String(input ?? '').trim();
  const m = /[?&]ref=([^&#\s]+)/i.exec(s);
  const code = (m ? m[1] : s).trim().toLowerCase();
  return REF_CODE.test(code) ? code : null;
}

// ---------- a field (a label, an input, its error and, for a note, its count) ----------
function field({ label, hint = null, input, count = null }) {
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const hintEl = hint ? h('p', { class: 'sa-hint', id: `${input.id}-hint`, text: hint }) : null;
  if (hintEl) input.setAttribute('aria-describedby', hintEl.id);
  input.addEventListener('input', () => say(err, ''));
  const foot = count ? h('div', { class: 'sa-field-foot' }, err, count) : err;
  return { node: h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: input.id, text: label }), hintEl, input, foot), err };
}
// the note: up to GIFTS.NOTE_MAX characters (counted like our server: by character, emoji included)
function noteField(max) {
  const input = h('input', { class: 'sa-input', id: nextId('gnote'), type: 'text', maxlength: String(max), autocomplete: 'off', placeholder: 'Happy creating! (optional)' });
  const count = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `0/${max}` });
  input.addEventListener('input', () => { count.textContent = `${[...input.value].length}/${max}`; });
  return { input, ...field({ label: 'A note (optional)', hint: 'Kind words only: no links, contacts or deals.', input, count }) };
}
// how many credits, with a few to tap
function creditsField(paid, dayMax) {
  const input = h('input', { class: 'sa-input sa-input-num', id: nextId('gcr'), type: 'text', inputmode: 'numeric', maxlength: '9', autocomplete: 'off', placeholder: 'e.g. 500' });
  const f = field({ label: 'How many credits', input });
  const picks = giftPicks(paid, dayMax);
  if (picks.length) {
    f.node.append(h('div', { class: 'sa-ideas', role: 'group', 'aria-label': 'Amounts' }, ...picks.map((n) => {
      const b = h('button', { type: 'button', class: 'sa-idea', text: num(n) });
      b.addEventListener('click', () => { input.value = String(n); say(f.err, ''); input.focus(); });
      return b;
    })));
  }
  return { input, ...f };
}
// a gift's numbers checked before anything is asked (our server checks them again)
function checkCredits(value, { paid, g }) {
  const n = giftCreditsFrom(value);
  if (!n || n < g.min || n > g.dayMax) return { why: errorText('give_credits') };
  if (n > paid) return { why: giftErrorText({ error: 'gift_short', paid }) };
  return { n };
}

// ---------- giving credits to a wallet: who, how many, a note; then a review, then given ----------
export function giveSheet(ctx, { onDone = null } = {}) {
  const g = ctx.info?.gifts;
  if (!g) return Promise.resolve();
  const paid = Number(ctx.me?.credits?.paid) || 0;
  const s = sheet({ title: 'Give credits', sub: 'Some of the credits you bought, to another wallet.' });
  const toInput = h('input', { class: 'sa-input', id: nextId('gto'), type: 'text', maxlength: '120', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: '0x… or @name' });
  const to = field({ label: 'Who is it for?', hint: "A wallet's address, or the clank.trade name it shows in AGI Studio.", input: toInput });
  const credits = creditsField(paid, g.dayMax);
  const note = noteField(g.noteMax || GIFTS.NOTE_MAX);
  const general = h('p', { class: 'sa-note', role: 'status', hidden: true });
  const form = h('div', { class: 'sa-give-form' }, to.node, credits.node, note.node,
    h('p', { class: 'sa-muted sa-small', text: giftableText(paid) }), h('p', { class: 'sa-fine', text: giftRulesText(g) }));
  const review = h('div', { class: 'sa-gift-review', hidden: true, tabindex: '-1' });
  add(s.body, form, review, general);
  const next = btn('Review', { kind: 'primary', size: 'lg', icon: 'next' });
  s.setFoot(next);
  const errs = { to: [to.err, toInput], credits: [credits.err, credits.input], note: [note.err, note.input] };
  const back = (why, which = null) => {
    form.hidden = false;
    review.hidden = true;
    s.setFoot(next);
    const [err, input] = errs[which] || [];
    if (err) { say(err, why); input.focus(); } else say(general, why);
  };
  next.addEventListener('click', () => {
    say(general, '');
    if (!recipientShape(toInput.value)) { back(errorText('give_to'), 'to'); return; }
    const c = checkCredits(credits.input.value, { paid, g });
    if (c.why) { back(c.why, 'credits'); return; }
    const text = note.input.value.trim();
    if ([...text].length > (g.noteMax || GIFTS.NOTE_MAX)) { back(errorText('note_long'), 'note'); return; }
    const who = recipientLabel(toInput.value);
    put(review,
      h('p', { class: 'sa-gift-review-title' }, icon('gift'), h('span', { text: `Give ${creditsText(c.n)} to ${who}?` })),
      text ? h('p', { class: 'sa-gift-note', text: `“${text}”` }) : null,
      h('p', { class: 'sa-muted sa-small', text: "Once it's given it's theirs: a gift to a wallet can't be taken back. Check who it's for." }),
      h('p', { class: 'sa-fine', text: GIFT_SAFETY }));
    form.hidden = true;
    review.hidden = false;
    review.focus();
    const give = btn(`Give ${creditsText(c.n)}`, { kind: 'primary', size: 'lg', icon: 'gift' });
    const change = btn('Change', { kind: 'quiet' });
    change.addEventListener('click', () => { form.hidden = false; review.hidden = true; s.setFoot(next); toInput.focus(); });
    give.addEventListener('click', () => busy(give, 'Giving…', async () => {
      const r = await ctx.act('inf-send', { to: toInput.value.trim(), credits: c.n, ...(text ? { note: text } : {}) });
      const d = r.data || {};
      if (r.ok && d.ok) {
        put(s.body, h('div', { class: 'sa-gift-hero is-done' },
          h('span', { class: 'sa-gift-hero-icon', 'aria-hidden': 'true' }, icon('check')),
          h('p', { class: 'sa-gift-hero-title', text: `Given: ${creditsText(d.gave)} to ${d.to || who} 💜` }),
          h('p', { class: 'sa-muted sa-small', text: 'They see it in their studio. Thank you for sharing.' })));
        const done = btn('Done', { kind: 'primary' });
        done.addEventListener('click', () => s.close());
        s.setFoot(done);
        done.focus();
        ctx.toast(`Given: ${creditsText(d.gave)} 💜`, 'good');
        onDone?.();
        return;
      }
      back(giftErrorText(d), giftErrorField(d.error));
    }));
    s.setFoot(give, change);
  });
  toInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); credits.input.focus(); } });
  credits.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next.click(); } });
  note.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next.click(); } });
  toInput.focus();
  return s.done;
}

// ---------- a gift link: how many, a note; then the link to copy or share ----------
export function giftLinkSheet(ctx, { onDone = null } = {}) {
  const g = ctx.info?.gifts;
  if (!g) return Promise.resolve();
  const paid = Number(ctx.me?.credits?.paid) || 0;
  const s = sheet({ title: 'Make a gift link', sub: 'Anyone with the link can claim it once.' });
  const credits = creditsField(paid, g.dayMax);
  const note = noteField(g.noteMax || GIFTS.NOTE_MAX);
  const general = h('p', { class: 'sa-note', role: 'status', hidden: true });
  add(s.body, credits.node, note.node,
    h('p', { class: 'sa-muted sa-small', text: `${giftableText(paid)} A link's credits are held until it's claimed (${num(g.openLinks || GIFTS.OPEN_LINKS)} links waiting at most).` }),
    h('p', { class: 'sa-fine', text: giftRulesText(g) }), general);
  const make = btn('Make the link', { kind: 'primary', size: 'lg', icon: 'link' });
  s.setFoot(make);
  const go = () => {
    say(general, '');
    const c = checkCredits(credits.input.value, { paid, g });
    if (c.why) { say(credits.err, c.why); credits.input.focus(); return; }
    const text = note.input.value.trim();
    if ([...text].length > (g.noteMax || GIFTS.NOTE_MAX)) { say(note.err, errorText('note_long')); note.input.focus(); return; }
    busy(make, 'Making it…', async () => {
      const r = await ctx.act('inf-gift-link', { credits: c.n, ...(text ? { note: text } : {}) });
      const d = r.data || {};
      if (!(r.ok && d.ok && GIFT_TOKEN.test(String(d.token)))) {
        const which = giftErrorField(d.error);
        if (which === 'credits') { say(credits.err, giftErrorText(d)); credits.input.focus(); } else if (which === 'note') { say(note.err, giftErrorText(d)); note.input.focus(); } else say(general, giftErrorText(d));
        return;
      }
      const url = giftLink(location.origin, ctx.BASE, d.token);
      put(s.body,
        h('div', { class: 'sa-gift-hero' },
          h('span', { class: 'sa-gift-hero-icon', 'aria-hidden': 'true' }, icon('gift')),
          h('p', { class: 'sa-gift-hero-title', text: `Your gift link: ${creditsText(d.gave)}` }),
          Number.isFinite(d.expires) ? h('p', { class: 'sa-muted sa-small', text: `It can be claimed until ${dayText(d.expires)}.` }) : null),
        linkBox(ctx, url, { what: 'Gift link', share: { title: 'A gift for you', text: giftShareText(d.gave) } }),
        h('p', { class: 'sa-muted sa-small', text: GIFT_LINK_NOTE(g.linkDays || GIFTS.LINK_DAYS) }),
        h('p', { class: 'sa-fine', text: GIFT_SAFETY }));
      const done = btn('Done', { kind: 'primary' });
      done.addEventListener('click', () => s.close());
      s.setFoot(done);
      ctx.toast(`Gift link made: ${creditsText(d.gave)} 💜`, 'good');
      onDone?.();
    });
  };
  make.addEventListener('click', go);
  for (const i of [credits.input, note.input]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  credits.input.focus();
  return s.done;
}

// A link in a box, with Copy (and the phone's own share sheet where there is one)
function linkBox(ctx, url, { what, share = null }) {
  const code = h('code', { class: 'sa-addr', text: url });
  const said = h('span', { class: 'sa-sr', 'aria-live': 'polite' });
  const copy = btn('Copy', { kind: 'ghost', size: 'sm', icon: 'copy' });
  copy.addEventListener('click', async () => {
    const ok = await copyText(url, code);
    said.textContent = ok ? `${what} copied` : 'Selected: copy it with your keyboard or a long-press';
    ctx.toast(ok ? `${what} copied` : 'Selected: copy it', 'good');
  });
  const row = h('div', { class: 'sa-addr-row' }, code, copy);
  if (share && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const b = btn('Share…', { kind: 'ghost', size: 'sm', icon: 'share' });
    b.addEventListener('click', () => { navigator.share({ title: share.title, text: share.text, url }).catch(() => { /* closed: nothing to do */ }); });
    row.append(b);
  }
  return h('div', { class: 'sa-link-box' }, row, said);
}

// ---------- My studio's card ----------
// giftsCard(ctx) → { node, draw() }. Its gifts and invite are read when it's first shown for a wallet (and again after
// something moved); the card is drawn again only when what it shows changed, so an invite code being typed stays put.
export function giftsCard(ctx) {
  const node = h('section', { class: 'sa-card sa-gifts-card', id: 'gifts', 'aria-labelledby': 'sa-gifts-h', hidden: true });
  let data = null, loadedFor = null, shownFor = null, loading = false, failed = null, sig = null, showAll = false, typed = '', jumped = false;
  const taking = new Set();                        // gift links being taken back (their buttons stay busy across redraws)
  const armed = new Set();                         // …and the ones a first tap armed

  async function load() {
    const wallet = ctx.session?.wallet;
    if (!wallet || loading) return;
    loading = true;
    draw();
    const r = await ctx.act('inf-gifts');
    loading = false;
    if (ctx.session?.wallet !== wallet) return;
    loadedFor = wallet;
    if (r.ok) { data = r.data; failed = null; } else failed = r.data?.error || 'busy';
    draw();
  }

  // its invite link, how its invites went, and joining with someone's code
  function invitePart(me, info) {
    const inv = data?.invite;
    const parts = [h('p', { class: 'sa-label', text: 'Invite friends' })];
    if (inv) {
      const url = inviteLink(location.origin, ctx.BASE, inv.code);
      parts.push(linkBox(ctx, url, { what: 'Invite link' }),
        h('div', { class: 'sa-row' }, linkBtn('Share on X ↗', shareInviteUrl(url), { kind: 'ghost', size: 'sm', icon: 'share', target: '_blank', rel: 'noopener noreferrer' })),
        h('p', { class: 'sa-muted sa-small', text: inviteText(info.refs) }),
        h('ul', { class: 'sa-invite-stats', 'aria-label': 'How your invites went' }, ...inviteStats(inv, info.refs).map(([label, value]) => h('li', null, h('strong', { text: value }), h('span', { text: label })))));
    } else if (loading) {
      parts.push(spinner('Loading your invite link…'));
    } else if (data && !inv) {
      parts.push(h('p', { class: 'sa-note', text: errorText('busy') }));
    }
    const c = me.credits || {};
    if (c.invited) {
      parts.push(h('p', { class: 'sa-invite-joined' }, icon('invite'), h('span', { text: welcomeLine(info.refs, c) })));
    } else if (!c.bought) {
      const id = nextId('ref');
      const input = h('input', { class: 'sa-input', id, type: 'text', maxlength: '200', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'abcd2345, or the invite link', value: typed });
      const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
      input.addEventListener('input', () => { typed = input.value; say(err, ''); });
      const join = btn('Join', { kind: 'ghost', icon: 'invite' });
      const send = () => {
        const code = inviteCodeFrom(input.value);
        if (!code) { say(err, errorText('ref_bad')); input.focus(); return; }
        busy(join, 'Joining…', async () => {
          const r = await ctx.act('inf-ref-bind', { code });
          if (r.ok && r.data?.ok) { typed = ''; ctx.toast(inviteJoinedText(info.refs), 'good'); ctx.refreshMe(); load(); return; }
          say(err, errorText(r.data?.error));
          input.focus();
        });
      };
      join.addEventListener('click', send);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      parts.push(h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id, text: 'Got an invite code?' }),
        h('p', { class: 'sa-hint', text: `For a wallet that never bought credits: ${bonusText(info.refs.welcome)} with your first top-up of ${usd(info.refs.welcomeMin)} or more.` }),
        h('div', { class: 'sa-clank-row' }, input, join), err));
    }
    return h('div', { class: 'sa-gift-part' }, ...parts);
  }

  // giving: to a wallet, or a gift link
  function givePart(me, info) {
    const c = me.credits || {};
    const paid = Number(c.paid) || 0;
    const closed = me.allowed === false;
    const give = btn('Give to a wallet', { kind: 'primary', size: 'sm', icon: 'gift' });
    const link = btn('Make a gift link', { kind: 'ghost', size: 'sm', icon: 'link' });
    give.disabled = link.disabled = closed || paid < GIFTS.MIN;
    give.addEventListener('click', () => giveSheet(ctx, { onDone: () => load() }));
    link.addEventListener('click', () => giftLinkSheet(ctx, { onDone: () => load() }));
    return h('div', { class: 'sa-gift-part' },
      h('p', { class: 'sa-label', text: 'Give credits' }),
      h('p', { class: 'sa-small', text: closed ? 'Giving opens when AGI Studio opens to everyone.' : giftableText(paid) }),
      h('div', { class: 'sa-row' }, give, link),
      h('p', { class: 'sa-fine', text: giftRulesText(info.gifts) }));
  }

  // one of its gifts
  function giftRow(g) {
    const isIn = g.dir === 'in';
    const back = !isIn && ['canceled', 'expired'].includes(g.status);
    const amount = h('span', { class: `sa-gift-amount${isIn ? ' is-plus' : back ? ' is-back' : ''}`, text: `${isIn ? '+' : back ? '' : '−'}${num(g.credits)}` });
    const top = h('div', { class: 'sa-gift-row-top' }, h('span', { class: 'sa-gift-row-title', text: giftRowTitle(g) }),
      isIn && !g.seen ? h('span', { class: 'sa-tag sa-tag-new', text: 'New' }) : null, amount);
    const body = h('div', { class: 'sa-gift-row-body' }, top, h('p', { class: 'sa-muted sa-small', text: giftRowState(g) }),
      g.note ? h('p', { class: 'sa-gift-note', text: `“${g.note}”` }) : null);
    if (!isIn && g.status === 'open' && g.token) {
      const url = giftLink(location.origin, ctx.BASE, g.token);
      const copy = btn('Copy link', { kind: 'ghost', size: 'sm', icon: 'copy' });
      copy.addEventListener('click', async () => {
        const ok = await copyText(url);
        ctx.toast(ok ? 'Gift link copied' : "Couldn't copy it: open the link from where you sent it", ok ? 'good' : 'bad');
      });
      const take = btn(armed.has(g.id) ? 'Tap again to take it back' : 'Take it back', { kind: armed.has(g.id) ? 'danger' : 'quiet', size: 'sm', icon: 'close' });
      take.disabled = taking.has(g.id);
      take.addEventListener('click', () => {
        if (!armed.has(g.id)) {
          armed.add(g.id);
          sig = null;
          draw();
          node.querySelector(`[data-take="${g.id}"]`)?.focus();
          // a first tap is forgotten after a few seconds
          setTimeout(() => { if (armed.delete(g.id)) { sig = null; draw(); } }, 6000);
          return;
        }
        armed.delete(g.id);
        taking.add(g.id);
        busy(take, 'Taking it back…', async () => {
          const r = await ctx.act('inf-gift-cancel', { gift: g.id });
          taking.delete(g.id);
          const d = r.data || {};
          if (r.ok && d.ok) ctx.toast(d.status === 'expired' ? `It had expired: ${creditsText(g.credits)} are back with you` : `Taken back: ${creditsText(g.credits)} are yours again`, 'good');
          else ctx.toast(giftErrorText(d), 'bad');
          load();
        });
      });
      take.dataset.take = g.id;
      body.append(h('div', { class: 'sa-gift-actions' }, copy, take));
    }
    return h('li', { class: `sa-gift-row is-${isIn ? 'in' : 'out'}` },
      h('span', { class: 'sa-gift-row-icon', 'aria-hidden': 'true' }, icon(g.link ? 'link' : 'gift')), body);
  }
  // one of its invites' rewards (bonus credits)
  function rewardRow(r) {
    return h('li', { class: 'sa-gift-row is-reward' },
      h('span', { class: 'sa-gift-row-icon', 'aria-hidden': 'true' }, icon('invite')),
      h('div', { class: 'sa-gift-row-body' },
        h('div', { class: 'sa-gift-row-top' }, h('span', { class: 'sa-gift-row-title', text: rewardTitle(r) }), h('span', { class: 'sa-gift-amount is-plus', text: `+${num(r.amount)}` })),
        h('p', { class: 'sa-muted sa-small', text: `Bonus credits · ${agoText(r.at)}` })));
  }
  function historyPart() {
    const rows = [
      ...(data?.gifts || []).map((g) => ({ at: g.created || 0, node: () => giftRow(g) })),
      ...(data?.rewards || []).map((r) => ({ at: r.at || 0, node: () => rewardRow(r) })),
    ].sort((a, b) => b.at - a.at);
    if (!rows.length) return null;
    const shown = showAll ? rows : rows.slice(0, SHOWN);
    const more = rows.length > shown.length ? btn(`Show all (${num(rows.length)})`, { kind: 'quiet', size: 'sm' }) : null;
    more?.addEventListener('click', () => { showAll = true; sig = null; draw(); });
    return h('div', { class: 'sa-gift-part' },
      h('p', { class: 'sa-label', text: 'Your gifts and rewards' }),
      h('ul', { class: 'sa-gift-list' }, ...shown.map((x) => x.node())), more);
  }

  function draw() {
    const me = ctx.me, info = ctx.info, s = ctx.session;
    node.hidden = !s || !me || !(info?.gifts || info?.refs);
    if (node.hidden) { sig = null; return; }
    // another wallet: nothing of the one before
    if (shownFor !== s.wallet) { shownFor = s.wallet; data = null; failed = null; loadedFor = null; showAll = false; typed = ''; armed.clear(); }
    if (loadedFor !== s.wallet && !loading) { load(); return; }
    const c = me.credits || {};
    const next = JSON.stringify([s.wallet, Boolean(me.banned), me.allowed !== false, c.paid, c.invited, c.bought, c.welcomed, info.gifts, info.refs, data, failed, loading, showAll, [...armed], [...taking]]);
    if (next === sig) return;
    sig = next;
    const title = h('h2', { class: 'sa-h3 sa-gifts-title', id: 'sa-gifts-h' }, icon('gift'), h('span', { text: 'Gifts and invites' }));
    if (failed && !data) {
      const again = btn('Try again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
      again.addEventListener('click', () => { failed = null; load(); });
      put(node, title, h('p', { class: 'sa-note', text: errorText(failed) }), h('div', { class: 'sa-row' }, again));
      return;
    }
    if (me.banned) {
      put(node, title, h('p', { class: 'sa-small', text: "A banned wallet can't give or claim gifts, or invite anyone." }), historyPart());
      return;
    }
    put(node, title,
      info.refs ? invitePart(me, info) : null,
      info.gifts ? givePart(me, info) : null,
      historyPart(),
      h('p', { class: 'sa-fine', text: info.refs ? `${GIFT_SAFETY} ${INVITE_FINE}` : GIFT_SAFETY }));
    // a link to it (a gift's toast: "See them in My studio") lands on it once
    if (location.hash === '#gifts' && !jumped && data) {
      jumped = true;
      requestAnimationFrame(() => node.scrollIntoView({ block: 'start' }));
    }
  }
  return { node, draw, load };
}

// ---------- the sheet a gift link opens ----------
// openGiftClaim(app, token) → a promise, resolved when its sheet closes. app: { act, requireAdult, requireWallet, refreshMe,
// toast, href, signedIn, findWallets }. The gift link's secret is taken out of the page's address when it closes (it's in the
// fragment: never sent). In a browser without a wallet (a phone's Safari or Chrome), it says to open the link in a wallet
// app's own browser, with a button that copies it: the wallet sheet's "Open in …" links can't carry it.
export function openGiftClaim(app, token) {
  const s = sheet({ title: 'A gift for you', sub: 'Credits for AGI Studio: photos, videos, 3D and more.' });
  const box = h('div', { class: 'sa-gift-claim', 'aria-live': 'polite' }, spinner('Opening the gift…'));
  add(s.body, box);
  s.done.then(() => {
    if (/^#gift=/.test(location.hash)) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  });
  const explore = () => linkBtn('Explore AGI Studio', app.href('/explore'), { kind: 'ghost', dataset: { saLink: '' } });
  (async () => {
    if (!GIFT_TOKEN.test(String(token || ''))) { put(box, h('p', { class: 'sa-note', text: errorText('gift_gone') })); s.setFoot(explore()); return; }
    const r = await app.act('inf-gift-peek', { token });
    if (!s.dialog.open) return;
    const d = r.data || {};
    if (!r.ok || d.off || !d.gift) {
      put(box, h('p', { class: 'sa-note', text: errorText(!r.ok ? d.error : d.off ? 'gifts_off' : 'gift_gone') }));
      s.setFoot(explore());
      return;
    }
    const g = d.gift;
    const hero = h('div', { class: 'sa-gift-hero' },
      h('span', { class: 'sa-gift-hero-icon', 'aria-hidden': 'true' }, icon('gift')),
      h('p', { class: 'sa-gift-big' }, icon('bolt'), h('span', { text: creditsText(g.credits) })),
      g.from ? h('p', { class: 'sa-gift-from', text: `From ${g.from}` }) : null,
      g.note ? h('p', { class: 'sa-gift-quote', text: `“${g.note}”` }) : null);
    if (g.status !== 'open') {
      put(box, hero, h('p', { class: 'sa-note', text: CLAIM_STATUS[g.status] || errorText('gift_gone') }));
      s.setFoot(explore());
      return;
    }
    const msg = h('p', { class: 'sa-note', role: 'status', hidden: true });
    // no wallet in this browser (and none signed in): how to claim it from a wallet app, and its link to copy
    const copyLink = btn('Copy the gift link', { kind: 'ghost', size: 'sm', icon: 'copy' });
    const noWallet = h('div', { class: 'sa-gift-nowallet', hidden: true },
      h('p', { class: 'sa-small', text: GIFT_NO_WALLET }), copyLink);
    copyLink.addEventListener('click', async () => {
      const ok = await copyText(giftLink(location.origin, app.href(''), token));
      app.toast(ok ? 'Gift link copied: open it in your wallet app' : "Couldn't copy it: copy this page's address instead", ok ? 'good' : 'bad');
    });
    put(box, hero,
      Number.isFinite(g.expires) ? h('p', { class: 'sa-muted sa-small sa-center', text: `Claim it by ${dayText(g.expires)}. A connected wallet (a free signature) and 18+.` }) : null,
      noWallet, msg, h('p', { class: 'sa-fine', text: GIFT_SAFETY }));
    if (app.findWallets && !app.signedIn?.()) {
      app.findWallets().then((found) => { if (s.dialog.open && !found.length && !app.signedIn?.()) noWallet.hidden = false; }).catch(() => {});
    }
    const claim = btn(`Claim ${creditsText(g.credits)}`, { kind: 'primary', size: 'lg', icon: 'gift' });
    s.setFoot(claim);
    claim.focus();
    claim.addEventListener('click', async () => {
      say(msg, '');
      if (!(await app.requireAdult())) return;
      if (!(await app.requireWallet())) return;
      if (!s.dialog.open) return;
      noWallet.hidden = true;
      busy(claim, 'Claiming…', async () => {
        const c = await app.act('inf-gift-claim', { token });
        const x = c.data || {};
        if (c.ok && x.ok) {
          put(box, h('div', { class: 'sa-gift-hero is-done' },
            h('span', { class: 'sa-gift-hero-icon', 'aria-hidden': 'true' }, icon('check')),
            h('p', { class: 'sa-gift-hero-title', text: `💜 ${creditsText(x.got)} are yours` }),
            x.from ? h('p', { class: 'sa-gift-from', text: `From ${x.from}` }) : null,
            h('p', { class: 'sa-muted sa-small', text: 'Use them for anything here, or give them on to someone else.' })));
          const make = linkBtn('Make something', app.href('/create'), { kind: 'primary', icon: 'spark', dataset: { saLink: '' } });
          const close = btn('Close', { kind: 'quiet' });
          close.addEventListener('click', () => s.close());
          s.setFoot(make, close);
          make.focus();
          app.toast(`💜 ${creditsText(x.got)} are yours`, 'good');
          app.refreshMe();
          return;
        }
        say(msg, giftErrorText(x));
        if (['gift_claimed', 'gift_canceled', 'gift_expired', 'gift_gone', 'gift_own', 'banned'].includes(x.error)) claim.hidden = true;
      });
    });
  })();
  return s.done;
}
