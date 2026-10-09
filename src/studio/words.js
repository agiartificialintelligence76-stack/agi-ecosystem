// AGI-1's 3D character studio (2026-10-10): everything its pages say that isn't in studio.html, and our server's answers
// (server/studio-api.js) in plain words. Pure (tested in Node: tests/studio.test.js, tests/videos.test.js).
import { usd, SHAPES, VIDEO_SECONDS } from './rules.js';

export const LEVEL_NAMES = { 1: 'Stranger', 2: 'Crush', 3: 'Soulmate' };
export const agiText = (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} $AGI`;
export const shortAddress = (a) => (typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : String(a || ''));

// The studio's state at the top of the page (/api/launch?studio-info)
export function statusText(info, { allowed = true } = {}) {
  if (!info) return "Couldn't open the studio just now. Trying again…";
  if (!info.on) return 'The studio opens soon.';
  if (!info.open && !allowed) return "The studio is private for now: it opens to everyone soon. Follow @agi1dotapp on X to hear when.";
  if (info.left <= 0) return "This month's characters are all made: the studio opens again on the 1st (UTC).";
  return `${info.left} character${info.left === 1 ? '' : 's'} left to make this month.`;
}

// What a wallet pays: the studio's price for its level, with its discount said
export function priceText(price, level, { usdg = true, burn = true } = {}) {
  const off = { 2: ' (Crush: 20% off)', 3: ' (Soulmate: 40% off)' }[level] || '';
  const ways = [usdg ? usd(price.usdCents) + ' in USDG' : null, burn ? `${agiText(price.agi)} burned` : null].filter(Boolean);
  return ways.length ? `${ways.join(' or ')}${off}` : `Your price${off}`;
}

// A connected wallet, as the studio says it
export function walletText(me, info) {
  if (!me) return '';
  const lvl = LEVEL_NAMES[me.level] || LEVEL_NAMES[1];
  const base = `${shortAddress(me.wallet)} · ${lvl}`;
  if (!info?.price) return base;
  const disc = info.discounts?.[me.level] || 0;
  const price = { usdCents: Math.round(info.price.usdCents * (1 - disc)), agi: Math.round(info.price.agi * (1 - disc)) };
  const tail = me.level === 3 ? ' One free character a month, too.' : me.level === 2 ? '' : ' Crush (10,000+ $AGI) gets 20% off, Soulmate (1,000,000+) 40% off and one free a month.';
  return `${base}. Your price: ${priceText(price, me.level, { usdg: info.usdg, burn: info.burnsLeft > 0 })}.${tail}`;
}

// Why its words were refused (server/studio-words.js): field → what to change (a video's scene and shape too)
const WORDS = {
  empty: { name: 'Give it a name.', about: 'Describe it in a few words.', style: 'Pick a style.', scene: 'Describe what happens in it.', shape: 'Pick its shape.' },
  long: { name: 'A name of 24 characters at most.', about: 'At most 400 characters.', scene: 'At most 300 characters.' },
  short: { about: 'A few more words, please: at least 10 characters.', scene: 'A few more words, please: at least 10 characters.' },
  letters: { name: 'Letters, numbers, spaces and simple punctuation only.' },
  link: 'No links: just words.',
  contact: 'No @names, addresses, emails or phone numbers.',
  adult: 'Keep it PG-13: nothing sexual or suggestive, fully clothed.',
  minor: 'Never a child, or anyone made to look like one.',
  hate: 'Nothing hateful or gory.',
  person: "Never a real person: describe someone of your own.",
  character: "Never someone else's character or a brand's mascot: make one of your own.",
  her: 'Nothing that passes for AGI-1, her team or anything official.',
};
export function wordsText(field, why) {
  const w = WORDS[why];
  return (typeof w === 'string' ? w : w?.[field]) || 'Try other words.';
}

// Our server's "no", in words (quotes, choosing, checking, trying again)
const ERRORS = {
  closed: "The studio is private for now: it opens to everyone soon.",
  sold_out: "This month's characters are all spoken for: try again on the 1st (UTC).",
  too_many: 'You have 2 characters waiting to be paid for: pay for one, or wait a day for it to expire.',
  burns_sold_out: "This month's characters paid by burning are all taken: pay with USDG, or try again next month.",
  no_usdg: "Paying with USDG isn't open right now: burn $AGI instead.",
  free_used: "You've made your free one this month.",
  no_free: 'A free character a month is for Soulmates (1,000,000+ $AGI).',
  no_kind: 'Pick how you pay first.',
  done: 'This character is paid for already.',
  gone: 'This character expired (a day without payment): make a new one.',
  not_yours: "This character is another wallet's.",
  no_credit: "This one can't be tried again.",
  adult: 'The studio is 18+.',
  human_check: "We couldn't confirm you're human. Try again.",
  signed_out: "Your wallet's session ended: connect it again.",
  too_fast: 'A little too fast: wait a moment and try again.',
  chain: "Couldn't read Robinhood Chain just now: try again in a minute.",
  explorer: "Couldn't look up your payments just now: paste its link, or try again in a minute.",
  bad_tx: "That doesn't look like a transaction's link or ID.",
  not_ready: "The studio isn't open yet.",
  not_configured: "The studio isn't open yet.",
  offline: "You're offline: try again when you're back.",
  busy: 'Something went wrong on our side: try again in a minute.',
};
export const errorText = (why) => ERRORS[why] || ERRORS.busy;

// One payment read from the chain, in words (server/studio.js checkPayment's results)
const RESULTS = {
  pending: "Not on the chain yet: give it a moment, then check again.",
  failed: 'That transaction failed on the chain: nothing was paid.',
  nothing: "It didn't pay for this: it went somewhere else, or it wasn't the right token.",
  other_wallet: "It came from another wallet: pay from the wallet you connected.",
  too_old: 'It was sent before this character was priced (or over 7 days ago).',
  used: 'That payment was counted already.',
  too_small: 'Too small to count.',
  chain: "Couldn't read it on the chain just now.",
};
export const resultText = (why) => RESULTS[why] || ERRORS[why] || ERRORS.busy;

// What "Check my payment" found. → a sentence
export function checkText(r, kind) {
  const money = (n) => (kind === 'usdg' ? usd(n) : agiText(n));
  if (r.paid) return 'Payment found: your character is being made now 💜';
  const counted = (r.results || []).filter((x) => x.ok);
  if (counted.length) return `Counted: ${money(r.have)} of ${money(r.need)}. Send the rest (${money(r.need - r.have)}) from the same wallet, then check again.`;
  const first = (r.results || []).find((x) => !x.ok);
  if (first) return resultText(first.why);
  return r.source === 'explorer'
    ? `No payment from your wallet found yet. It can take a minute to show up: check again, or paste the transaction's link.`
    : 'Nothing counted.';
}

// While it's made (server/studio.js: Meshy's steps, then its files kept)
export const STEP_WORDS = { preview: 'Shaping it', refine: 'Painting it', rig: 'Giving it bones', moves: 'Teaching it moves', save: 'Saving it' };
export const MAKING_NOTE = 'It takes about 5 to 10 minutes. You can close this page: it keeps going, and its link shows it when it\'s ready.';

// Why it couldn't be made (its page): every one of these can be tried again with new words, free
export function failText(error) {
  const e = String(error || '');
  if (e === 'refused') return "The AI's safety check stopped these words.";
  if (e === 'pose') return "Its bones didn't fit: it needs to be one figure with two arms and two legs, standing.";
  if (e === 'too_big') return 'It came out too big to keep.';
  if (e === 'expired') return 'It took too long to make.';
  if (e === 'save') return "Its files couldn't be kept.";
  if (e.startsWith('ai:')) return "The AI couldn't make it this time.";
  return "It couldn't be made.";
}

// A character's page: its status as a sentence
export function charText(c) {
  if (!c) return 'This character isn\'t here (or it was taken down).';
  if (c.status === 'expired') return 'This character expired before it was paid for.';
  if (c.status === 'quote') return 'This character hasn\'t been paid for yet.';
  if (c.status === 'paid' || c.status === 'making') return `${STEP_WORDS[c.step] || STEP_WORDS.preview}…`;
  if (c.status === 'failed') return failText(c.error);
  return '';
}

// Share on X: the visitor posts it (never us), never money talk
export function shareUrl(name, url) {
  const text = `Meet ${name}, my 3D character from AGI-1's studio 💜 type a move and watch it go:`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

// The moves it reacts with when a message names none (it always does something)
export const REACTIONS = ['wave', 'cheer', 'jump', 'bow'];

// ---------- its videos (2026-10-10, server/studio-video.js) ----------
export const VIDEO_STEP_WORDS = { queue: 'Waiting its turn', make: 'Making it', save: 'Saving it' };
// under a video: always "AI-generated", how long, its shape, its sound
export const videoMeta = (v) => `AI-generated · ${VIDEO_SECONDS} s · ${SHAPES[v?.shape]?.name || SHAPES.tall.name} · ${v?.sound ? 'with sound' : 'no sound'}`;
// what making one costs this wallet: its price by level, with its discount said
export function videoPriceText(usdCents, level) {
  const off = { 2: ' (Crush: 20% off)', 3: ' (Soulmate: 40% off)' }[level] || '';
  return `${usd(usdCents)} in USDG${off}`;
}
// Why one couldn't be made (every one can be made again with a new scene, free)
export function videoFailText(error) {
  const e = String(error || '');
  if (e === 'refused') return "The AI's safety check stopped this scene.";
  if (e === 'too_big') return 'It came out too big to keep.';
  if (e === 'expired') return 'It took too long to make.';
  if (e === 'save') return "Its file couldn't be kept.";
  if (e === 'no_char') return 'Its character was taken down.';
  if (e.startsWith('ai:')) return "The AI couldn't make it this time.";
  return "It couldn't be made.";
}
// One of its own videos that isn't done, as a sentence (waiting for payment, being made, couldn't be made)
export function videoStateText(v) {
  if (!v) return '';
  if (v.status === 'expired') return 'It expired before it was paid for.';
  if (v.status === 'quote') {
    const price = v.price?.usdCents ?? 0;
    return `Waiting for payment: ${usd(price)} in USDG${v.paid > 0 ? ` (${usd(v.paid)} counted so far)` : ''}.`;
  }
  if (v.status === 'paid' || v.status === 'making') {
    const line = Number.isInteger(v.position) && v.step === 'queue' ? ` (#${v.position + 1} in line)` : '';
    return `${VIDEO_STEP_WORDS[v.step] || VIDEO_STEP_WORDS.queue}…${line} It takes a few minutes: you can close this page.`;
  }
  if (v.status === 'failed') return `${videoFailText(v.error)}${v.credit ? ' It was paid for, so it can be made again with a new scene, free.' : ''}`;
  return '';
}
// Our server's "no" for a video, in words (its own where a character's would be wrong)
const VIDEO_ERRORS = {
  too_many: 'You have 2 videos waiting to be paid for: pay for one, or wait a day for it to expire.',
  sold_out: "This month's videos are all spoken for: try again on the 1st (UTC).",
  gone: 'This video expired (a day without payment): describe a new one.',
  done: 'This video is paid for already.',
  no_credit: "This one can't be made again.",
  not_yours: 'Only the wallet that made this character can make its videos.',
  no_char: "This character isn't here any more (or it was taken down).",
  no_videos: "Videos aren't open yet.",
  closed: 'The studio is private for now: it opens to everyone soon.',
};
export const videoErrorText = (why) => VIDEO_ERRORS[why] || errorText(why);
// What "Check my payment" found for a video. → a sentence
export function videoCheckText(r) {
  if (r.paid) return 'Payment found: your video is being made now 💜';
  return checkText(r, 'usdg');
}
// Share on X: the visitor posts it (never us), never money talk, always that it's AI-made
export function videoShareUrl(name, url) {
  const text = `${name}, my 3D character from AGI-1's studio, in an AI-made video 💜`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
