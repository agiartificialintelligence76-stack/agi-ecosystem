// Community votes (agi1.app/vote, 2026-10-24: the roadmap's "Gamified governance", the owner: "you decide whats
// recommended, and a question can i make more choices for them to vote for example like in the new agi logo").
// Shared by the page (src/vote/page.js), the owner's page (src/vote/owner.js) and the server (server/vote.js,
// api/wallet.js), so all of them always agree.
//
// The rules (recommended, the owner said yes to them by asking us to decide):
//   • 1 $AGI = 1 vote, no cap per wallet. A cap (or square-root voting) is undone for free by splitting $AGI over more
//     wallets, so it would only look fair. Each choice also shows how many wallets picked it, so a whale is visible.
//   • A wallet's weight is the $AGI it holds when it votes, read again when the vote closes: the LOWER of the two counts.
//     So voting, sending the $AGI to a second wallet and voting again doesn't work (at the close it's only in one).
//   • At least VOTE.minAgi held to vote (the Crush level, src/lib/levels.js): keeps out empty wallets made for spam.
//   • A vote runs VOTE.days days unless the owner picks another length. You can change your choice until it closes.
//   • The team follows the result unless it's unsafe, illegal or not possible, and says why if it doesn't.
//
// THE POLLS LIVE IN THE DATABASE since 2026-10-24 (the owner: "if i want to make a voting or add another choice for them
// to vote can i just do it directly in website … like agi1.app/vote/owner … same wallet i used as an admin commands on
// agi studio"): the owner makes and changes them at agi1.app/vote/owner (src/vote/owner.js), signed in with the AGI
// Studio owner's wallet (STUDIO_OWNER, else the first of STUDIO_ONLY_FOR). checkPoll() below is what may change, and when:
//   • before a vote opens: everything;
//   • while it's open: its words, pictures, more choices (up to VOTE.maxChoices), removing a choice nobody picked, its
//     closing time (later, or "End now"), hiding it;
//   • after it closes: its words and pictures, hiding it. Never its choices or dates (the final count depends on them).
//   • A poll with votes can only be hidden, never deleted (supabase/votes.sql's poll_drop checks it too).
// Votes already given are kept by their choice's id, so a choice's id never changes; its label may.
import { LEVELS } from '../lib/levels.js';

export const VOTE = {
  minAgi: LEVELS[1].min,       // 10,000 $AGI: the Crush level
  days: 3,                     // how long a vote runs unless the owner picks another length
  minChoices: 2,
  maxChoices: 8,
  minMs: 60 * 60_000,          // the shortest vote: 1 hour
  maxMs: 30 * 864e5,           // the longest: 30 days
  aheadMs: 90 * 864e5,         // a vote can be set to open up to 90 days ahead
  settleAfterMs: 2 * 60_000,   // the final count starts this long after the close (a vote sent at the last second lands first)
  settleBatch: 15,             // wallets read again on the chain per request during the final count (5 at a time)
  pictureMax: 400_000,         // bytes, for a picture file in public/vote/
  pictureChars: 120_000,       // a picture uploaded on the owner's page: a data: address (the page makes it 256 × 256 WebP)
  bodyMax: 1_100_000,          // the owner's save, its pictures included (/api/wallet)
  question: 120, about: 300, label: 80, note: 160,
};

export const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;            // a poll's id (in its address: agi1.app/vote#<id>)
export const CHOICE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const PICTURE = /^\/vote\/[a-z0-9-]+\/[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp|svg)$/;
export const PICTURE_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isPicture = (p) => typeof p === 'string' && (PICTURE.test(p) || (p.length <= VOTE.pictureChars && PICTURE_DATA.test(p)));

const time = (iso) => Date.parse(iso);
export const opensAt = (poll) => time(poll.opens);
export const closesAt = (poll) => (poll.closes ? time(poll.closes) : opensAt(poll) + (poll.days ?? VOTE.days) * 864e5);

// the polls that are on the page (and can be voted on when open): never drafts (hidden by the owner)
export const livePolls = (polls) => (Array.isArray(polls) ? polls : []).filter((p) => !p.draft);
export const pollById = (id, polls) => livePolls(polls).find((p) => p.id === id) || null;
export const isChoice = (poll, choice) => Boolean(poll) && poll.choices.some((c) => c.id === choice);

// 'soon' (not open yet) · 'open' · 'counting' (closed, wallets being read again) · 'final'
// `left` = votes not yet counted again (null: not known, e.g. before the database answered)
export function pollState(poll, now = Date.now(), left = null) {
  if (now < opensAt(poll)) return 'soon';
  if (now < closesAt(poll)) return 'open';
  return left === 0 ? 'final' : 'counting';
}

// A poll's numbers, in its choices' order, every choice there (0 when nobody picked it): [{ choice, agi, wallets, share }]
// share: the choice's part of all the $AGI that voted, 0 to 100 with one decimal
export function tallyRows(poll, rows) {
  const by = new Map((Array.isArray(rows) ? rows : []).map((r) => [r?.choice, r]));
  const nat = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
  const list = poll.choices.map((c) => ({ choice: c.id, agi: nat(by.get(c.id)?.agi), wallets: nat(by.get(c.id)?.wallets) }));
  const total = list.reduce((s, r) => s + r.agi, 0);
  return list.map((r) => ({ ...r, share: total ? Math.round((r.agi / total) * 1000) / 10 : 0 }));
}

// the choice with the most $AGI (a tie: none, the page says so)
export function leader(rows) {
  const top = Math.max(0, ...rows.map((r) => r.agi));
  const at = rows.filter((r) => r.agi === top);
  return top > 0 && at.length === 1 ? at[0].choice : null;
}

// a poll as the page gets it, without the server's own fields
export const publicPoll = (poll) => ({
  id: poll.id, question: poll.question, about: poll.about || '',
  opens: new Date(opensAt(poll)).toISOString(), closes: new Date(closesAt(poll)).toISOString(),
  choices: poll.choices.map((c) => ({ id: c.id, label: c.label, note: c.note || '', picture: c.picture || null })),
});

// ---------- the owner's changes ----------
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max + 1) : '');

// a new poll's id from its question: "Pick the new AGI logo" -> "pick-the-new-agi-logo-k3f9"
export function newPollId(question, random = Math.random) {
  const slug = text(question, 200).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  const tail = Array.from({ length: 4 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36)]).join('');
  return `${slug.length >= 2 ? slug : 'vote'}-${tail}`;
}

// a new choice's id: c1, c2, … (never one the poll has)
const newChoiceId = (taken) => { let n = 1; while (taken.has(`c${n}`)) n += 1; taken.add(`c${n}`); return `c${n}`; };

// A poll as kept in the database, made from what the owner sent and checked against the rules above.
//   input: { id?, question, about?, opens: ISO | 'now', closes: ISO, draft?, choices: [{ id?, label, note?, picture? }] }
//   old:   the poll as it is now (null: a new one) · votes: { [choice]: wallets that picked it } (for removing choices)
//   voters: every vote it has (counted ones too). A hidden poll nobody voted on is like a new one: every part can change.
// -> { ok: true, poll } · { ok: false, why: '<what to fix, in plain words>' }
export function checkPoll(input, { old = null, votes = {}, voters = 0, now = Date.now(), random = Math.random } = {}) {
  const no = (why) => ({ ok: false, why });
  if (!input || typeof input !== 'object') return no('Something was missing. Reload the page and try again.');
  const question = text(input.question, VOTE.question);
  if (question.length < 4) return no('Write the question (4 characters or more).');
  if (question.length > VOTE.question) return no(`The question is too long (${VOTE.question} characters at most).`);
  const about = text(input.about, VOTE.about);
  if (about.length > VOTE.about) return no(`The description is too long (${VOTE.about} characters at most).`);
  if (!Array.isArray(input.choices)) return no('Add the choices.');
  if (input.choices.length < VOTE.minChoices) return no(`A vote needs ${VOTE.minChoices} choices or more.`);
  if (input.choices.length > VOTE.maxChoices) return no(`${VOTE.maxChoices} choices at most.`);

  const fresh = !old || (old.draft === true && !(voters > 0) && !Object.values(votes).some((n) => n > 0));
  const opened = !fresh && now >= opensAt(old);
  const closed = opened && now >= closesAt(old);
  const oldIds = new Set(old ? old.choices.map((c) => c.id) : []);
  const taken = new Set(oldIds);
  const labels = new Set();
  const choices = [];
  for (const [i, c] of input.choices.entries()) {
    if (!c || typeof c !== 'object') return no(`Choice ${i + 1} is empty.`);
    const label = text(c.label, VOTE.label);
    if (!label) return no(`Write choice ${i + 1}'s name.`);
    if (label.length > VOTE.label) return no(`Choice ${i + 1}'s name is too long (${VOTE.label} characters at most).`);
    if (labels.has(label.toLowerCase())) return no(`Two choices are called "${label}".`);
    labels.add(label.toLowerCase());
    const note = text(c.note, VOTE.note);
    if (note.length > VOTE.note) return no(`Choice ${i + 1}'s note is too long (${VOTE.note} characters at most).`);
    if (c.picture != null && c.picture !== '' && !isPicture(c.picture)) return no(`Choice ${i + 1}'s picture didn't work. Try a smaller PNG, JPG or WebP.`);
    let id;
    if (c.id != null && c.id !== '') {
      if (!oldIds.has(c.id)) return no('A choice changed while you were editing. Reload the page and try again.');
      if (choices.some((x) => x.id === c.id)) return no('A choice is there twice. Reload the page and try again.');
      id = c.id;
    } else {
      if (closed) return no('This vote has closed: its choices can\'t change any more.');
      id = newChoiceId(taken);
    }
    const out = { id, label };
    if (note) out.note = note;
    if (c.picture) out.picture = c.picture;
    choices.push(out);
  }
  if (old) {
    for (const c of old.choices) {
      if (choices.some((x) => x.id === c.id)) continue;
      if (closed) return no('This vote has closed: its choices can\'t change any more.');
      if ((votes[c.id] ?? 0) > 0) return no(`"${c.label}" has votes, so it can't be removed. Hide the whole vote instead if you need to.`);
    }
  }

  // its dates
  let opens, closes;
  const wantCloses = time(input.closes);
  if (opened) {
    opens = opensAt(old);
    if (closed) closes = closesAt(old);
    else {
      if (!Number.isFinite(wantCloses)) return no('Pick when the vote ends.');
      closes = Math.max(wantCloses, now);                              // "End now" (or a time just gone): now
      if (closes - opens > VOTE.maxMs) return no('A vote runs 30 days at most.');
    }
  } else {
    opens = input.opens === 'now' ? now : time(input.opens);
    if (!Number.isFinite(opens)) return no('Pick when the vote starts.');
    if (opens < now - 5 * 60_000) return no('The start time has passed. Pick "Start now" or a time ahead.');
    if (opens > now + VOTE.aheadMs) return no('A vote can be set to start up to 90 days ahead.');
    opens = Math.max(opens, now);
    if (!Number.isFinite(wantCloses)) return no('Pick when the vote ends.');
    closes = wantCloses;
    if (closes - opens < VOTE.minMs) return no('A vote runs 1 hour at least: pick a later end.');
    if (closes - opens > VOTE.maxMs) return no('A vote runs 30 days at most.');
  }

  const id = old ? old.id : newPollId(question, random);
  if (!ID.test(id)) return no('Something was off with this vote. Reload the page and try again.');
  const poll = {
    id, question, opens: new Date(opens).toISOString(), closes: new Date(closes).toISOString(), draft: input.draft === true, choices,
  };
  if (about) poll.about = about;
  return { ok: true, poll };
}

// A poll read back from the database: only well-made ones are used (anything else is left out, said in the logs)
export function cleanPoll(p) {
  if (!p || typeof p !== 'object' || !ID.test(String(p.id)) || typeof p.question !== 'string' || !p.question) return null;
  if (!Number.isFinite(time(p.opens)) || !Number.isFinite(time(p.closes)) || !Array.isArray(p.choices) || p.choices.length < 1) return null;
  const choices = [];
  for (const c of p.choices) {
    if (!c || !CHOICE_ID.test(String(c.id)) || typeof c.label !== 'string' || !c.label || choices.some((x) => x.id === c.id)) return null;
    const out = { id: c.id, label: c.label.slice(0, VOTE.label) };
    if (typeof c.note === 'string' && c.note) out.note = c.note.slice(0, VOTE.note);
    if (isPicture(c.picture)) out.picture = c.picture;
    choices.push(out);
  }
  const poll = { id: p.id, question: p.question.slice(0, VOTE.question), opens: p.opens, closes: p.closes, draft: p.draft === true, choices };
  if (typeof p.about === 'string' && p.about) poll.about = p.about.slice(0, VOTE.about);
  return poll;
}
