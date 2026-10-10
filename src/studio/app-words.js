// AGI Studio (2026-10-10, studio.agi1.app): everything the app says that isn't in studio.html, and our server's answers
// (server/inf-api.js, server/influencer.js, server/inf-uploads.js, server/inf-jobs.js) in plain words. Pure (tested in Node:
// tests/influencer.test.js). Never an AI provider's name: "an AI service" (the owner's rule for every page).
import { usd, SHAPES, OPTIONS, MODES, INF_STYLES, PRICES, FREE_CREDITS, DISCOUNT, creditsText, trendOf } from './rules.js';

export const LEVEL_NAMES = { 1: 'Stranger', 2: 'Crush', 3: 'Soulmate' };
export const shortAddress = (a) => (typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : String(a || ''));
export const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

// ---------- the studio's state ----------
export function studioText(info, { allowed = true } = {}) {
  if (!info) return "Couldn't reach AGI Studio just now. Trying again…";
  if (!info.on) return 'AGI Studio opens soon. Follow @agi1dotapp on X to hear when.';
  if (!info.open && !allowed) return 'AGI Studio is private for now: it opens to everyone soon. Follow @agi1dotapp on X to hear when.';
  return '';
}

// ---------- what things cost ----------
// A price in credits for this level, said with its discount. (prices: the wallet's own, from inf-me, or the base ones)
export function costText(what, { prices = null, level = 1 } = {}) {
  const n = prices?.[what] ?? Math.round(PRICES[what] * (1 - (DISCOUNT[level] ?? 0)));
  return creditsText(n);
}
export const priceOf = (what, { prices = null, level = 1 } = {}) => prices?.[what] ?? Math.round(PRICES[what] * (1 - (DISCOUNT[level] ?? 0)));
// The holder perks, as the page says them (never "buy more": where they start, and that they're a thank-you)
export function perksText(level) {
  if (level === 3) return `Soulmate: 40% off everything, ${FREE_CREDITS[3]} free credits a month and a free 3D model once a month. A thank-you for holding, not an investment.`;
  if (level === 2) return `Crush: 20% off everything and ${FREE_CREDITS[2]} free credits a month. A thank-you for holding, not an investment.`;
  return `Holder perks start at Crush (10,000+ $AGI held, or burned for messages): 20% off and ${FREE_CREDITS[2]} free credits a month. Soulmate (1,000,000+): 40% off and ${FREE_CREDITS[3]} a month.`;
}
// Credits after a top-up: "$10 → 1,000 credits"
export const topupText = (cents) => `${usd(cents)} → ${creditsText(cents)}`;

// ---------- an influencer's state ----------
const STEP = { queue: 'Waiting its turn', make: 'Making it', save: 'Saving it' };
export function makingText(i, { position = null } = {}) {
  const line = Number.isInteger(position) && position >= 0 && i?.job?.step === 'queue' ? ` (#${position + 1} in line)` : '';
  if (i?.status === 'looks') return `Making 4 looks to choose from${line}…`;
  if (i?.status === 'body') return `Making ${i.name}'s full body from the look you picked${line}…`;
  return '';
}
export const stepText = (step) => STEP[step] || STEP.queue;
export const statusChip = (s) => ({ looks: 'Making looks', pick: 'Pick a look', body: 'Making it', ready: 'Ready', failed: "Couldn't be made" }[s] || '');

// Why something couldn't be made (what our server keeps: server/inf-jobs.js), and that its credits came back
export function failText(error) {
  const e = String(error || '');
  if (e === 'refused') return "The AI service's safety check stopped it.";
  if (e === 'source') return "The picture it was made from wasn't there any more.";
  if (e === 'expired') return 'It took too long to make.';
  if (e === 'too_big') return 'It came out too big to keep.';
  if (e === 'check') return "It couldn't be checked, so it isn't shown.";
  if (e === 'save') return "Its file couldn't be kept.";
  if (e === 'gone' || e === 'deleted') return 'Its influencer was deleted.';
  if (e === 'pose') return "Its bones didn't fit: its full body needs to be one figure, standing.";
  if (e === 'no_picture') return "Its full-body picture wasn't there any more.";
  if (e.startsWith('ai:')) return "The AI service couldn't make it this time.";
  return "It couldn't be made.";
}
export const backText = (job) => (job?.refunded && job.cost > 0 ? ` Its ${creditsText(job.cost)} came back.` : '');

// One of its photos or videos, as its tile says it
export function jobTitle(j) {
  if (j.kind === 'photo') return j.scene || 'Photo';
  if (j.kind === 'video') return j.scene || 'Video';
  if (j.kind === 'trend') return j.clip ? 'Trend video (your own move)' : `Trend video: ${trendOf(j.trend)?.name || 'a move'}`;
  return '';
}
export const kindName = (k) => ({ photo: 'Photo', trend: 'Trend video', video: 'Video' }[k] || '');
export const shapeName = (s) => SHAPES[s]?.name || SHAPES.tall.name;
export function jobMeta(j) {
  const parts = ['AI-generated', kindName(j.kind)];
  // (a scene video is 5 s; a trend video is as long as its move: a trend move's 10 s, or their clip's 2 to 10)
  if (j.kind === 'video') parts.push('5 s');
  if (j.shape) parts.push(shapeName(j.shape));
  if (j.kind === 'video') parts.push(j.sound ? 'with sound' : 'no sound');
  return parts.join(' · ');
}
export function jobStateText(j, { position = null } = {}) {
  if (j.status === 'paid' || j.status === 'making') {
    const line = Number.isInteger(position) && position >= 0 && j.step === 'queue' ? ` (#${position + 1} in line)` : '';
    return `${stepText(j.step)}…${line}`;
  }
  if (j.status === 'failed') return `${failText(j.error)}${j.refunded ? backText(j) : ''}`;
  return '';
}
// a 3D model of it (the studio's characters: its steps)
const MODEL_STEP = { image: 'Shaping it', rig: 'Giving it bones', moves: 'Teaching it moves', save: 'Saving it' };
export function modelText(m) {
  if (!m) return '';
  if (m.status === 'done') return 'Ready in 3D';
  if (m.status === 'paid' || m.status === 'making') return `${MODEL_STEP[m.step] || MODEL_STEP.image}…`;
  if (m.status === 'failed') return `${failText(m.error)} Its credits came back.`;
  return '';
}
export const MODEL_STEP_WORDS = MODEL_STEP;

// ---------- what was typed, refused (server/inf-words.js checkStart, checkInfScene; the coin: server/launch.js) ----------
const WORDS = {
  empty: { name: 'Give it a name.', mode: 'Pick how to start.', style: 'Pick a style.', look: 'Pick a look.', age: 'Pick an age.', scene: 'Describe the scene.', shape: 'Pick its shape.' },
  long: { name: 'A name of 24 characters at most.', words: 'At most 200 characters.', scene: 'At most 300 characters.' },
  short: { scene: 'A few more words, please: at least 10 characters.' },
  letters: { name: 'Letters, numbers, spaces and simple punctuation only.' },
  bad: 'Pick one of the choices.',
  link: 'No links: just words.',
  contact: 'No @names, addresses, emails or phone numbers.',
  adult: 'Keep it PG-13: nothing sexual or suggestive.',
  minor: 'Adults only: never a child, or anyone made to look like one.',
  hate: 'Nothing hateful or gory.',
  person: 'Never a real person (only your own face, with "Use my face").',
  character: "Never someone else's character or a brand's mascot: make one of your own.",
  her: 'Nothing that passes for AGI-1, her team or anything official.',
};
export function wordsText(field, why) {
  const w = WORDS[why];
  return (typeof w === 'string' ? w : w?.[field]) || 'Try other words.';
}
export const COIN_WHY = {
  name: 'Its name can be anything up to 32 characters.',
  symbol: 'Its ticker can be anything up to 16 characters, with no spaces.',
  description: 'Keep its line under 100 characters.',
  characters: 'No #, @, <, >, brackets, backticks, backslashes or a / on its own, please.',
  crude: 'Keep it PG-13.',
  official: 'No "official" in it, please: a coin made here is nobody\'s official coin.',
  agi: "That sounds like AGI-1 or $AGI: pick a name and ticker of your own.",
  egirl: 'No egirl or AI-girlfriend coins, please.',
  money: 'Keep its line about the coin itself: no trading talk or promises.',
  link: 'No links or @names (you can add its X, Telegram and website on the launch page).',
};
export const coinText = (reason) => COIN_WHY[reason] || 'Try another name or ticker.';

// ---------- an upload looked at (server/inf-ai.js), refused ----------
const UPLOAD_WHY = {
  none: { face: "We couldn't see one face clearly: try again in good light, looking at the camera.", picture: "We couldn't find one character in it: try a clearer picture.", clip: "We couldn't see a person moving in it: try another clip." },
  many: { face: 'Only your face, please: nobody else in the picture.', picture: 'One character only, please.' },
  minor: 'Adults only: it looked like it might show someone under 18.',
  screen: 'A live selfie only: not a photo of a screen or a printed picture.',
  real_person: 'That looks like a photo of a real person: use "Use my face" for your own face, or a drawing or character of yours.',
  copyright: "That looks like someone else's character: use one of your own.",
  sexual: 'Keep it PG-13: nothing sexual or revealing.',
  hate: 'Nothing hateful.',
  violence: 'Nothing violent or gory.',
  other: "That one can't be used: try another.",
  picture: "That file isn't a picture we can read: a JPEG, PNG or WebP.",
  video: "That file isn't a video we can read: an MP4 or MOV.",
  length: 'A clip of 2 to 10 seconds, please.',
  parts: 'Your clip didn\'t arrive whole: try again.',
  frames: "We couldn't read your clip's frames: try again.",
  done: 'That upload is finished already: pick it again.',
  gone: 'That upload expired: pick it again.',
};
export function uploadText(why, kind = 'picture') {
  const w = UPLOAD_WHY[why];
  return (typeof w === 'string' ? w : w?.[kind] || w?.picture) || "That one can't be used: try another.";
}
// An upload's "no" (src/studio/media.js uploadPicture / uploadClip → { error, why }): the AI check's reason when it refused
// it, the upload's own words when it's about the file (not a picture we read, finished already, expired…), else our
// server's ("gone" here is the upload, never its influencer)
export function upErrorText(r, kind = 'picture') {
  const e = r?.error;
  if (e === 'refused') return uploadText(r.why, kind);
  if (typeof e === 'string' && Object.hasOwn(UPLOAD_WHY, e)) return uploadText(e, kind);
  return errorText(e);
}

// ---------- our server's "no", in words ----------
const ERRORS = {
  closed: 'AGI Studio is private for now: it opens to everyone soon.',
  not_ready: "AGI Studio isn't open yet.",
  not_configured: "AGI Studio isn't open yet.",
  faces_off: '"Use my face" is switched off for now.',
  consent: 'Tick the box to agree first.',
  short: 'Not enough credits: buy some, then try again.',
  too_many: 'You have the most being made at once: wait for one to finish.',
  busy_day: 'AGI Studio is very busy today: try again tomorrow.',
  busy3d: 'Its 3D model is being made already.',
  sold_out: "This month's 3D models are all spoken for: try again on the 1st (UTC).",
  no_3d: "3D models aren't open yet.",
  launch_off: "Launching coins isn't open yet.",
  launch_private: 'Launching coins is private for now: it opens to everyone soon.',
  coin_cap: "That's a lot of coins for today: try again tomorrow.",
  no_usdg: "Buying credits isn't open yet.",
  face: 'An AI twin is never shown in Explore: only people with its link see it.',
  needs_photo: 'A realistic influencer\'s video starts from one of its photos: make a photo first, then pick it.',
  trend: "That move isn't available any more: pick another.",
  clip: 'Your clip expired (a day): upload it again.',
  image: "That photo isn't available any more: pick another.",
  source: 'Your picture expired: upload it again.',
  making: 'That move is being made already.',
  state: 'Something changed in the meantime: have another look.',
  not_yours: "This influencer is another wallet's.",
  not_owner: 'Only the owner can do that.',
  gone: "This influencer isn't here any more (or it was taken down).",
  kind: "That isn't something we can upload.",
  size: 'That file is too big.',
  ticket: 'That upload took too long: try again.',
  adult: 'AGI Studio is 18+.',
  human_check: "We couldn't confirm you're human. Try again.",
  signed_out: "Your wallet's session ended: connect it again.",
  too_fast: 'A little too fast: wait a moment and try again.',
  chain: "Couldn't read Robinhood Chain just now: try again in a minute.",
  explorer: "Couldn't look up your payments just now: paste its link, or try again in a minute.",
  bad_tx: "That doesn't look like a transaction's link or ID.",
  ai: "The AI check didn't answer just now: try again in a minute.",
  storage: "Couldn't reach our storage just now: try again in a minute.",
  offline: "You're offline: try again when you're back.",
  bad: 'Something in that request was off: try again.',
  bad_request: 'Something in that request was off: try again.',
  busy: 'Something went wrong on our side: try again in a minute.',
};
export const errorText = (why) => ERRORS[why] || ERRORS.busy;

// ---------- buying credits: "Check my payment" (server/credits.js checkTopup) ----------
const RESULTS = {
  pending: 'Not on the chain yet: give it a moment, then check again.',
  failed: 'That transaction failed on the chain: nothing was paid.',
  nothing: "It didn't pay the studio: it went somewhere else, or it wasn't USDG.",
  other_wallet: 'It came from another wallet: send from the wallet you connected.',
  too_old: 'It was sent over 7 days ago.',
  used: 'That payment was counted already.',
  too_small: 'Too small to count.',
  chain: "Couldn't read it on the chain just now.",
};
export const resultText = (why) => RESULTS[why] || errorText(why);
export function topupCheckText(r) {
  if (r.added > 0) return `Payment found: ${creditsText(r.added)} added 💜`;
  const first = (r.results || []).find((x) => !x.ok);
  if (first) return resultText(first.why);
  return r.source === 'explorer'
    ? "No new payment from your wallet found yet. It can take a minute to show up: check again, or paste the transaction's link."
    : 'Nothing counted.';
}

// ---------- the choices, as the page offers them ----------
export const MODE_CARDS = Object.entries(MODES).map(([id, m]) => ({ id, ...m }));
export const STYLE_NAMES = INF_STYLES;
export const optionGroups = (mode) => Object.entries(OPTIONS).filter(([, o]) => o.for.includes(mode)).map(([key, o]) => ({ key, ...o }));

// Scene ideas (a tap fills the box): made-up, PG-13, never a real place's brand or a real person
export const PHOTO_IDEAS = [
  'sipping coffee in a cozy café, morning light', 'on a rooftop at golden hour, city behind', 'walking through a neon-lit street at night',
  'at the beach at sunset, hair in the wind', 'in a cozy bedroom with fairy lights', 'at an outdoor music festival, smiling',
  'reading in a quiet library', 'on a mountain trail with a view', 'in a pastel flower field', 'at a gaming setup with RGB lights',
];
export const VIDEO_IDEAS = [
  'waves at the camera on a sunny rooftop, then laughs', 'walks toward the camera down a neon street at night',
  'dances happily in a cozy living room', 'turns around on the beach at sunset and smiles', 'sips coffee by a rainy window and looks up',
  'cheers at a music festival with confetti falling', 'skateboards slowly along a seaside path', 'spins in a field of flowers',
];
// Names to suggest (made up)
export const NAMES = ['Nova', 'Kira', 'Juno', 'Milo', 'Aria', 'Zane', 'Luna', 'Rio', 'Sky', 'Ivy', 'Kai', 'Nia', 'Remi', 'Sol', 'Yuki', 'Ezra', 'Lux', 'Mika', 'Pixel', 'Echo'];

// ---------- sharing (the visitor posts it, never us; never money talk; always that it's AI-made) ----------
export function shareInfUrl(name, url) {
  const text = `Meet ${name}, my AI influencer made in AGI Studio 💜`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
export function shareJobUrl(name, kind, url) {
  const what = kind === 'photo' ? 'an AI-made photo' : 'an AI-made video';
  const text = `${name}, my AI influencer from AGI Studio, in ${what} 💜`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
export function share3dUrl(name, url) {
  const text = `Meet ${name} in 3D, made in AGI Studio 💜 type a move and watch it go:`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

// ---------- a 3D model's chat ----------
// The moves it reacts with when a message names none (it always does something; src/studio/views/model3d.js)
export const REACTIONS = ['wave', 'cheer', 'jump', 'bow'];

// ---------- dates ----------
export const dayText = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export function agoText(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return dayText(ms);
}
