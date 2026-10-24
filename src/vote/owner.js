// Community votes, the owner's page (agi1.app/vote/owner, 2026-10-24, the owner: "if i want to make a voting or add
// another choice for them to vote can i just do it directly in website … like agi1.app/vote/owner … same wallet i used
// as an admin commands on agi studio"). Loaded by src/vote/page.js only at that address. Only the AGI Studio owner's
// wallet (STUDIO_OWNER, else the first of STUDIO_ONLY_FOR) gets anything from the server (/api/wallet: vote-owner,
// vote-save, vote-drop); the page only shows what the server sends. What may change, and when, is checkPoll() in
// src/vote/polls.js: run here first for a quick answer, and again on the server, which decides.
// Pictures are made small here (256 × 256 WebP, a data: address) before they're sent: nothing else is uploaded.
import { postJson } from '../lib/human.js';
import { VOTE, checkPoll, leader } from './polls.js';
import { agiText, whenText } from './words.js';

const API = '/api/wallet';
const HOUR = 3600_000, DAY = 864e5;
const LENGTHS = [
  ['1 hour', HOUR], ['6 hours', 6 * HOUR], ['12 hours', 12 * HOUR], ['1 day', DAY], ['2 days', 2 * DAY], ['3 days', 3 * DAY],
  ['5 days', 5 * DAY], ['7 days', 7 * DAY], ['14 days', 14 * DAY], ['30 days', 30 * DAY],
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (text, className, onClick, { disabled = false, title = '' } = {}) => {
  const b = el('button', `btn btn-sm ${className}`, text);
  b.type = 'button';
  b.disabled = disabled;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
};
const field = (labelText, input, hint) => {
  const wrap = el('label', 'vt-f');
  wrap.append(el('span', 'vt-f-label', labelText), input);
  if (hint) wrap.append(el('span', 'vt-f-hint', hint));
  return wrap;
};
const dateText = (ms) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// <input type="datetime-local"> speaks the owner's own clock
const localValue = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (value) => (value ? new Date(value).getTime() : NaN);

// a hidden vote nobody voted on is like a new one (src/vote/polls.js checkPoll)
const isFresh = (p) => !p || (p.draft && !(p.voters > 0));
const votesOf = (p) => Object.fromEntries((p?.rows || []).map((r) => [r.choice, r.wallets]));

// A picture file -> a small data: address (256 × 256 at most, the whole picture, WebP; PNG where a browser can't)
export async function pictureFrom(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick a picture file (PNG, JPG, WebP, GIF or SVG).');
  if (file.size > 15_000_000) throw new Error('That picture is too big (15 MB at most).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That picture couldn\'t be opened. Try a PNG or JPG.'));
      i.src = url;
    });
    for (const [size, quality] of [[256, 0.88], [256, 0.72], [192, 0.7], [160, 0.6]]) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const w = img.naturalWidth || size, h = img.naturalHeight || size, k = Math.min(size / w, size / h);
      c.getContext('2d').drawImage(img, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
      let data = c.toDataURL('image/webp', quality);
      if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/png');
      if (data.length <= VOTE.pictureChars) return data;
    }
    throw new Error('That picture is too detailed to fit. Try a simpler one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// root: the owner's box on the page · getMe(): the wallet session or null · say(text) · onSignedOut()
export function startOwner({ root, getMe, say, onSignedOut }) {
  const st = {
    status: 'out',        // out · loading · owner · not_owner · unset · not_ready · error
    polls: [],
    max: 100,
    edit: null,           // the vote being made or changed (a copy), or null: the list
    busy: false,
    error: '',
  };

  async function call(body) {
    const me = getMe();
    if (!me) { st.status = 'out'; render(); return null; }
    let r;
    try {
      r = await postJson(API, { action: body.action, session: me.session, ...body });
    } catch {
      say('You seem to be offline.');
      return null;
    }
    if (r.ok) return r.data;
    const e = r.data?.error;
    if (e === 'signed_out') { onSignedOut(); say('Your sign-in ended. Connect your wallet again.'); st.status = 'out'; }
    else if (e === 'not_owner') st.status = r.data.unset ? 'unset' : 'not_owner';
    else if (e === 'not_ready') st.status = 'not_ready';
    else if (e === 'refused') st.error = r.data.why || 'That didn\'t work. Try again.';
    else if (e === 'too_fast') st.error = 'That was fast. Wait a moment and try again.';
    else st.error = 'Something went wrong. Try again in a minute.';
    return null;
  }

  async function refresh() {
    if (!getMe()) { st.status = 'out'; st.edit = null; render(); return; }
    st.status = 'loading';
    render();
    const d = await call({ action: 'vote-owner' });
    if (d) { st.status = 'owner'; st.polls = Array.isArray(d.polls) ? d.polls : []; st.max = d.max || st.max; }
    else if (st.status === 'loading') st.status = 'error';
    render();
  }

  // ---------- the list ----------
  function stateLine(p, now) {
    const bits = [];
    if (p.draft) bits.push('Hidden');
    if (isFresh(p) && now >= Date.parse(p.opens)) bits.push('not started');
    else if (p.state === 'soon') bits.push(`starts ${dateText(Date.parse(p.opens))} · in ${whenText(Date.parse(p.opens) - now)}`);
    else if (p.state === 'open') bits.push(`open · ends in ${whenText(Date.parse(p.closes) - now)}`);
    else if (p.state === 'counting') bits.push(`closed ${dateText(Date.parse(p.closes))} · final count in progress`);
    else bits.push(`final · closed ${dateText(Date.parse(p.closes))}`);
    return bits.join(' · ');
  }

  function pollCard(p) {
    const now = Date.now();
    const card = el('article', `vt-oc${p.draft ? ' is-hidden' : ''}${p.state === 'open' && !p.draft ? ' is-open' : ''}`);
    card.append(el('p', `vt-state${p.state === 'open' && !p.draft ? ' is-open' : ''}`, stateLine(p, now)), el('h3', 'vt-oc-q', p.question));
    if (p.about) card.append(el('p', 'vt-about', p.about));
    const lead = p.total > 0 ? leader(p.rows) : null;
    const list = el('ul', 'vt-oc-choices');
    for (const c of p.choices) {
      const row = p.rows.find((r) => r.choice === c.id) || { agi: 0, wallets: 0, share: 0 };
      const li = el('li', `vt-oc-choice${c.id === lead ? ' is-lead' : ''}`);
      if (c.picture) {
        const img = el('img', 'vt-oc-pic');
        img.src = c.picture; img.alt = ''; img.width = 40; img.height = 40; img.loading = 'lazy';
        li.append(img);
      }
      li.append(el('span', 'vt-oc-label', c.label));
      if (p.voters > 0 || p.state !== 'soon') li.append(el('span', 'vt-oc-nums mono', `${row.share}% · ${agiText(row.agi)} $AGI · ${row.wallets}`));
      list.append(li);
    }
    card.append(list);
    card.append(el('p', 'vt-foot mono', `${agiText(p.total)} $AGI from ${p.wallets} ${p.wallets === 1 ? 'wallet' : 'wallets'}`));

    const acts = el('div', 'vt-oc-acts');
    acts.append(button('Edit', 'btn-primary', () => startEdit(p), { disabled: st.busy }));
    acts.append(button(p.draft ? 'Show on the page' : 'Hide', 'btn-ghost', () => toggleHidden(p), { disabled: st.busy }));
    if (p.state === 'open' && !isFresh(p)) acts.append(button('End now', 'btn-ghost', () => endNow(p), { disabled: st.busy }));
    if (!p.draft) {
      const a = el('a', 'btn btn-sm btn-ghost', 'See it ↗');
      a.href = `/vote#${p.id}`; a.target = '_blank'; a.rel = 'noopener';
      acts.append(a);
    }
    if (!(p.voters > 0)) acts.append(button('Delete', 'btn-ghost vt-danger', () => drop(p), { disabled: st.busy }));
    card.append(acts);
    return card;
  }

  // the poll as the server wants it, from a list entry (for Hide, Show, End now)
  const asInput = (p, changes = {}) => ({
    id: p.id, question: p.question, about: p.about, opens: p.opens, closes: p.closes, draft: p.draft,
    choices: p.choices.map((c) => ({ id: c.id, label: c.label, note: c.note, picture: c.picture })), ...changes,
  });

  async function save(input, done) {
    st.busy = true; st.error = '';
    render();
    const d = await call({ action: 'vote-save', poll: input });
    st.busy = false;
    if (d?.poll) {
      const i = st.polls.findIndex((p) => p.id === d.poll.id);
      if (i >= 0) st.polls[i] = d.poll; else st.polls.unshift(d.poll);
      st.edit = null;
      say(done(d.poll));
    } else if (st.error) say(st.error);
    render();
    return Boolean(d?.poll);
  }

  function toggleHidden(p) {
    let changes = { draft: !p.draft };
    // showing a hidden vote whose start has passed (and nobody voted on): it starts now, for as long as it was set to run
    if (p.draft && isFresh(p) && Date.now() >= Date.parse(p.opens)) {
      const length = Math.min(Math.max(Date.parse(p.closes) - Date.parse(p.opens), VOTE.minMs), VOTE.maxMs);
      changes = { ...changes, opens: 'now', closes: new Date(Date.now() + length).toISOString() };
    }
    save(asInput(p, changes), (q) => (q.draft ? 'Hidden. It\'s off agi1.app/vote (within 15 seconds) and can\'t be voted on.'
      : q.state === 'open' ? 'It\'s on agi1.app/vote (within 15 seconds), open for votes.' : 'It\'s on agi1.app/vote (within 15 seconds).'));
  }

  function endNow(p) {
    if (!confirm(`End "${p.question}" now? Nobody can vote after this, and it can't be opened again.`)) return;
    save(asInput(p, { closes: new Date().toISOString() }), () => 'Ended. The final count runs in the next few minutes.');
  }

  async function drop(p) {
    if (!confirm(`Delete "${p.question}"? This can't be undone.`)) return;
    st.busy = true; st.error = '';
    render();
    const d = await call({ action: 'vote-drop', id: p.id });
    st.busy = false;
    if (d?.ok) { st.polls = st.polls.filter((x) => x.id !== p.id); say('Deleted.'); } else if (st.error) say(st.error);
    render();
  }

  // ---------- the editor ----------
  function startEdit(p) {
    const now = Date.now();
    if (!p) {
      st.edit = {
        old: null, question: '', about: '', draft: false, startMode: 'now', startAt: now + DAY, length: 3 * DAY, endAt: now + 4 * DAY,
        choices: [{ label: '', note: '', picture: null }, { label: '', note: '', picture: null }],
      };
    } else {
      const o = Date.parse(p.opens), c = Date.parse(p.closes);
      const preset = LENGTHS.find(([, ms]) => ms === c - o);
      st.edit = {
        old: p, question: p.question, about: p.about || '', draft: p.draft,
        startMode: isFresh(p) && o <= now ? 'now' : 'at', startAt: Math.max(o, now + HOUR), length: preset ? preset[1] : 0, endAt: c,
        choices: p.choices.map((ch) => ({ id: ch.id, label: ch.label, note: ch.note || '', picture: ch.picture || null })),
      };
    }
    st.error = '';
    render();
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function editInput(e) {
    const p = e.old;
    const opened = p && !isFresh(p) && Date.now() >= Date.parse(p.opens);
    let opens, closes;
    if (opened) {
      opens = p.opens;
      closes = Number.isFinite(e.endAt) ? new Date(e.endAt).toISOString() : '';
    } else {
      const start = e.startMode === 'now' ? Date.now() : e.startAt;
      opens = e.startMode === 'now' ? 'now' : (Number.isFinite(e.startAt) ? new Date(e.startAt).toISOString() : '');
      const end = e.length ? start + e.length : e.endAt;
      closes = Number.isFinite(end) ? new Date(end).toISOString() : '';
    }
    return {
      ...(p ? { id: p.id } : {}), question: e.question, about: e.about, opens, closes, draft: e.draft,
      choices: e.choices.map((c) => ({ ...(c.id ? { id: c.id } : {}), label: c.label, note: c.note, picture: c.picture })),
    };
  }

  async function submit() {
    const e = st.edit;
    const input = editInput(e);
    // the same rules as the server, for a quick answer (the server checks again, and decides)
    const local = checkPoll(input, { old: e.old, votes: votesOf(e.old), voters: e.old?.voters || 0 });
    if (!local.ok) { st.error = local.why; render(); return; }
    await save(input, (q) => (q.draft ? 'Saved, hidden. Press "Show on the page" when it\'s ready.'
      : `Saved. It's on agi1.app/vote within 15 seconds${q.state === 'open' ? ', open for votes' : ''}.`));
  }

  function editor() {
    const e = st.edit;
    const p = e.old;
    const now = Date.now();
    const opened = p && !isFresh(p) && now >= Date.parse(p.opens);
    const closed = opened && now >= Date.parse(p.closes);
    const votes = votesOf(p);
    const form = el('form', 'vt-ed');
    form.noValidate = true;
    form.addEventListener('submit', (ev) => { ev.preventDefault(); if (!st.busy) submit(); });
    form.append(el('h3', 'vt-ed-title', p ? 'Edit the vote' : 'New vote'));
    if (closed) form.append(el('p', 'vt-ed-lock', 'This vote has closed: only its words and pictures can change now.'));
    else if (opened) form.append(el('p', 'vt-ed-lock', 'This vote is open: you can change its words and pictures, add choices, remove a choice nobody picked, and change when it ends.'));

    const q = el('input', 'vt-in');
    q.type = 'text'; q.maxLength = VOTE.question; q.value = e.question; q.placeholder = 'Pick the new AGI logo'; q.required = true;
    q.addEventListener('input', () => { e.question = q.value; });
    form.append(field('Question', q));
    const about = el('textarea', 'vt-in vt-ta');
    about.maxLength = VOTE.about; about.rows = 2; about.value = e.about; about.placeholder = 'Optional: a line about it';
    about.addEventListener('input', () => { e.about = about.value; });
    form.append(field('About (optional)', about));

    // the choices
    form.append(el('p', 'vt-f-label', `Choices (${VOTE.minChoices} to ${VOTE.maxChoices})`));
    const list = el('ol', 'vt-ed-choices');
    e.choices.forEach((c, i) => {
      const li = el('li', 'vt-ed-choice');
      const pic = el('div', 'vt-ed-pic');
      if (c.picture) {
        const img = el('img');
        img.src = c.picture; img.alt = ''; img.width = 64; img.height = 64;
        pic.append(img);
      } else pic.append(el('span', 'vt-ed-nopic', 'No picture'));
      const file = el('input');
      file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try { c.picture = await pictureFrom(f); st.error = ''; } catch (err) { st.error = err.message; }
        render();
      });
      const picBtns = el('div', 'vt-ed-picbtns');
      picBtns.append(button(c.picture ? 'Change picture' : 'Add picture', 'btn-ghost', () => file.click()));
      if (c.picture) picBtns.append(button('Remove picture', 'btn-ghost', () => { c.picture = null; render(); }));
      const side = el('div', 'vt-ed-side');
      side.append(pic, picBtns, file);

      const body = el('div', 'vt-ed-body');
      const label = el('input', 'vt-in');
      label.type = 'text'; label.maxLength = VOTE.label; label.value = c.label; label.placeholder = `Choice ${i + 1}`;
      label.setAttribute('aria-label', `Choice ${i + 1}'s name`);
      label.addEventListener('input', () => { c.label = label.value; });
      const note = el('input', 'vt-in');
      note.type = 'text'; note.maxLength = VOTE.note; note.value = c.note; note.placeholder = 'Optional note';
      note.setAttribute('aria-label', `Choice ${i + 1}'s note`);
      note.addEventListener('input', () => { c.note = note.value; });
      body.append(label, note);
      if (c.id && votes[c.id] > 0) body.append(el('span', 'vt-f-hint', `${votes[c.id]} ${votes[c.id] === 1 ? 'wallet' : 'wallets'} picked this`));

      const moves = el('div', 'vt-ed-moves');
      const swap = (a, b) => { [e.choices[a], e.choices[b]] = [e.choices[b], e.choices[a]]; render(); };
      moves.append(
        button('↑', 'btn-ghost', () => swap(i, i - 1), { disabled: i === 0, title: 'Move up' }),
        button('↓', 'btn-ghost', () => swap(i, i + 1), { disabled: i === e.choices.length - 1, title: 'Move down' }),
      );
      const locked = closed || (c.id && votes[c.id] > 0);
      moves.append(button('Remove', 'btn-ghost vt-danger', () => { e.choices.splice(i, 1); render(); }, {
        disabled: Boolean(locked) || e.choices.length <= VOTE.minChoices,
        title: locked ? (closed ? 'This vote has closed' : 'Wallets picked this, so it stays') : '',
      }));
      li.append(side, body, moves);
      list.append(li);
    });
    form.append(list);
    form.append(button('+ Add a choice', 'btn-ghost vt-ed-add', () => { e.choices.push({ label: '', note: '', picture: null }); render(); }, {
      disabled: closed || e.choices.length >= VOTE.maxChoices,
    }));
    form.append(el('p', 'vt-f-hint', 'Pictures are made small here (square works best) and shown next to their choice.'));

    // when
    const when = el('fieldset', 'vt-ed-when');
    when.append(el('legend', 'vt-f-label', 'When'));
    if (closed) {
      when.append(el('p', 'vt-f-hint', `Ran from ${dateText(Date.parse(p.opens))} to ${dateText(Date.parse(p.closes))}.`));
    } else if (opened) {
      const end = el('input', 'vt-in');
      end.type = 'datetime-local'; end.value = localValue(e.endAt);
      end.addEventListener('input', () => { e.endAt = fromLocal(end.value); });
      when.append(el('p', 'vt-f-hint', `Started ${dateText(Date.parse(p.opens))}. Votes can be changed until it ends.`), field('Ends', end, 'Your own clock. A vote runs 30 days at most.'));
    } else {
      const row = el('div', 'vt-ed-row');
      const radio = (value, text) => {
        const lab = el('label', 'vt-radio');
        const r = el('input');
        r.type = 'radio'; r.name = 'vt-start'; r.value = value; r.checked = e.startMode === value;
        r.addEventListener('change', () => { e.startMode = value; render(); });
        lab.append(r, document.createTextNode(` ${text}`));
        return lab;
      };
      row.append(radio('now', 'Start now'), radio('at', 'Start at a time'));
      when.append(row);
      if (e.startMode === 'at') {
        const at = el('input', 'vt-in');
        at.type = 'datetime-local'; at.value = localValue(e.startAt);
        at.addEventListener('input', () => { e.startAt = fromLocal(at.value); });
        when.append(field('Starts', at, 'Your own clock.'));
      }
      const len = el('select', 'vt-in');
      for (const [name, ms] of LENGTHS) {
        const o = el('option', '', name);
        o.value = String(ms); o.selected = e.length === ms;
        len.append(o);
      }
      const custom = el('option', '', 'Pick an end time…');
      custom.value = '0'; custom.selected = !e.length;
      len.append(custom);
      len.addEventListener('change', () => {
        e.length = Number(len.value);
        if (!e.length) e.endAt = (e.startMode === 'now' ? Date.now() : e.startAt) + VOTE.days * DAY;
        render();
      });
      when.append(field('Runs for', len));
      if (!e.length) {
        const end = el('input', 'vt-in');
        end.type = 'datetime-local'; end.value = localValue(e.endAt);
        end.addEventListener('input', () => { e.endAt = fromLocal(end.value); });
        when.append(field('Ends', end, 'Your own clock. 1 hour to 30 days.'));
      }
    }
    form.append(when);

    const show = el('label', 'vt-check');
    const box = el('input');
    box.type = 'checkbox'; box.checked = !e.draft;
    box.addEventListener('change', () => { e.draft = !box.checked; });
    show.append(box, document.createTextNode(' Show it on agi1.app/vote (unticked: hidden, nobody can see it or vote)'));
    form.append(show);

    if (st.error) form.append(el('p', 'vt-ed-error', st.error));
    const acts = el('div', 'vt-oc-acts');
    const go = el('button', 'btn btn-primary', st.busy ? 'Saving…' : p ? 'Save changes' : 'Create the vote');
    go.type = 'submit'; go.disabled = st.busy;
    acts.append(go, button('Cancel', 'btn-ghost', () => { st.edit = null; st.error = ''; render(); }, { disabled: st.busy }));
    form.append(acts);
    return form;
  }

  // ---------- the box ----------
  function render() {
    const top = el('div', 'vt-o-top');
    top.append(el('h2', 'vt-h', 'Manage the votes'));
    const nodes = [top];
    const msg = (text) => nodes.push(el('p', 'vt-empty', text));
    if (st.status === 'out') msg('Connect the owner\'s wallet above: the same one you use for AGI Studio\'s owner page.');
    else if (st.status === 'loading') msg('Checking your wallet…');
    else if (st.status === 'not_owner') msg('This wallet isn\'t the owner\'s. Disconnect, then connect the wallet you use for AGI Studio\'s owner page.');
    else if (st.status === 'unset') msg('No owner wallet is set on the server yet (STUDIO_OWNER in Vercel\'s settings, the same as AGI Studio\'s).');
    else if (st.status === 'not_ready') msg('The votes\' database isn\'t set up yet: run supabase/votes.sql in Supabase (SQL Editor → New query → paste → Run). It ends with vote_functions_found = 8.');
    else if (st.status === 'error') { msg(st.error || 'Couldn\'t load the votes. Try again in a minute.'); nodes.push(button('Try again', 'btn-ghost', refresh)); }
    else if (st.edit) nodes.push(editor());
    else {
      top.append(button('+ New vote', 'btn-primary', () => startEdit(null), { disabled: st.busy || st.polls.length >= st.max }));
      if (!st.polls.length) msg('No votes yet. Press "New vote" to make the first one.');
      else {
        const wrap = el('div', 'vt-polls');
        wrap.append(...st.polls.map(pollCard));
        nodes.push(wrap);
      }
      nodes.push(el('p', 'vt-f-hint', 'Changes show on agi1.app/vote within 15 seconds. A vote with votes can be hidden, not deleted; its choices\' names can change, never which choice a vote went to.'));
    }
    root.replaceChildren(...nodes);
  }

  render();
  return { refresh };
}

