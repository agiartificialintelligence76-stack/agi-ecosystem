// AGI Studio (2026-10-10, studio.agi1.app): everything the app says that isn't in studio.html, and our server's answers
// (server/inf-api.js, server/influencer.js, server/inf-uploads.js, server/inf-jobs.js, and since round 2 server/inf-burns.js
// and server/inf-week.js) in plain words. Pure (tested in Node: tests/influencer.test.js). Never an AI provider's name:
// "an AI service" (the owner's rule for every page).
import {
  usd, SHAPES, PHOTO_SHAPES, BANNER, OPTIONS, MODES, INF_STYLES, PRICES, FREE_CREDITS, DISCOUNT, CAPTIONS_A_DAY, creditsText, trendOf, TICKETS,
  HELPER, GIFTS, REFERRALS, CLANK_NAME, MEME_LINE_MAX, REFS, MEMES, PHOTO_MODELS, PHOTO_QUALITY, VIDEO_MODELS,
  STYLE_AUTO, STYLE_ANY, OWNER_LINKS, EDIT, EDITOR, VIDEO_EDITOR,
} from './rules.js';
import { LEVELS } from '../lib/levels.js';

export const LEVEL_NAMES = { 1: 'Stranger', 2: 'Crush', 3: 'Soulmate' };
export const shortAddress = (a) => (typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : String(a || ''));
export const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
// a big number, short: 950 · 12.4K · 3.1M
export function compact(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 10_000) return v.toLocaleString('en-US');
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(v / 1_000_000).toFixed(v < 100_000_000 ? 1 : 0).replace(/\.0$/, '')}M`;
}

// A number for a small tile (the live stats board): thousands as K from 1,000 ("1.3K"), so four fit across a phone
export function tiny(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(Math.floor(v / 100) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  return compact(v);
}

// ---------- the studio's state ----------
// (2026-10-11, the owner: "i want to give access to someone but it said to them comins soon fix that please") A wallet that
// isn't on its list while it's private is told how to get in when it was invited: its address to whoever invited it (My studio
// shows it, with Copy), then a reload once it's in.
export function studioText(info, { allowed = true } = {}) {
  if (!info) return "Couldn't reach AGI Studio just now. Trying again…";
  if (!info.on) return 'AGI Studio opens soon. Follow @agi1dotapp on X to hear when.';
  if (!info.open && !allowed) return "AGI Studio is private for now, and this wallet isn't on its list yet. Invited? Send whoever invited you this wallet's address (it's in My studio), then reload once you're in. Or follow @agi1dotapp on X to hear when it opens to everyone.";
  return '';
}
// My studio's lines for that wallet (its whole address between them, to copy and send)
export const INVITE_TEXT = "Invited? Send this wallet's address to whoever invited you. Once they've let it in, reload this page.";
export const FOLLOW_TEXT = 'Not invited? Follow @agi1dotapp on X to hear when it opens to everyone.';

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
// (2026-10-11, the owner: "can you also add in the front page that holders get discounts") Explore's line about it, under its
// heading: the numbers from DISCOUNT, FREE_CREDITS and the levels' $AGI (src/lib/levels.js), never "buy" (hard rule 8: a
// thank-you for holding, not an investment)
export const HOLDER_LINE = {
  title: `$AGI holders get ${Math.round(DISCOUNT[2] * 100)}–${Math.round(DISCOUNT[3] * 100)}% off, and free credits every month`,
  rows: [
    [LEVEL_NAMES[2], `${num(LEVELS[1].min)}+ $AGI`, `${Math.round(DISCOUNT[2] * 100)}% off everything and ${FREE_CREDITS[2]} free credits a month`],
    [LEVEL_NAMES[3], `${num(LEVELS[2].min)}+ $AGI`, `${Math.round(DISCOUNT[3] * 100)}% off, ${FREE_CREDITS[3]} free credits and a free 3D model a month`],
  ],
  fine: 'Held in your connected wallet, or burned for messages. A thank-you for holding, not an investment.',
};
// Credits after a top-up: "$10 → 1,000 credits"
export const topupText = (cents) => `${usd(cents)} → ${creditsText(cents)}`;

// ---------- an influencer's state ----------
const STEP = { queue: 'Waiting its turn', make: 'Making it', save: 'Saving it' };
export function makingText(i, { position = null } = {}) {
  const line = Number.isInteger(position) && position >= 0 && i?.job?.step === 'queue' ? ` (#${position + 1} in line)` : '';
  if (i?.status === 'looks') return `Making 4 looks to choose from${line}…`;
  // (2026-10-11) one that started from a photo with just its full body, or its photo as it is (src/studio/rules.js WAYS)
  if (i?.status === 'body' && i.way === 'asis') return `Getting ${i.name} ready from your photo…`;
  if (i?.status === 'body' && i.way === 'body') return `Making ${i.name}'s full body from your photo${line}…`;
  if (i?.status === 'body') return `Making ${i.name}'s full body from the look you picked${line}…`;
  return '';
}
// (2026-10-11) how long making it takes, by how it started: its 4 looks, just its full body, or its photo as it is
export const WAY_LINES = { looks: '4 looks to pick from, in about a minute', body: 'Just its full body, in about a minute', asis: 'Your photo as it is, in a few seconds' };
export const wayToast = (way) => ({ body: 'Making its full body: about a minute', asis: 'Getting it ready: a few seconds' }[way] || 'Making its 4 looks: about a minute');
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
  if (e === 'clip') return 'Its clip expired before it was made.';
  if (e === 'small') return 'It came out at a size trend videos can\'t use (720 to 2160 px a side).';
  // (2026-10-12, the video editor) a cut: its part couldn't be cut from its video, or its video went meanwhile
  if (e === 'cut') return "That part couldn't be cut from its video.";
  if (e === 'from') return "The video it's from isn't there any more.";
  if (e.startsWith('ai:')) return "The AI service couldn't make it this time.";
  return "It couldn't be made.";
}
export const backText = (job) => (job?.refunded && job.cost > 0 ? ` Its ${creditsText(job.cost)} came back.` : '');

// One of its photos or videos, as its tile says it
export function jobTitle(j) {
  // (round 4, phase 4) a meme: its words (their first line)
  if (j.kind === 'photo' && j.meme) return `Meme: ${String(j.caption || '').split('\n')[0] || MEMES[j.meme]?.name || 'a meme'}`;
  // (2026-10-12, the editor) a photo made with "Edit with words": its change
  if (j.kind === 'photo' && j.edit) return `Edited: ${j.edit}`;
  // …and one saved from the photo editor
  if (j.kind === 'photo' && j.editor) return j.shape === 'banner' ? 'Edited X banner' : 'Edited photo';
  if (j.kind === 'photo') return j.scene || (j.shape === 'banner' ? 'X banner' : 'Photo');
  // (2026-10-12) a video saved from the video editor
  if (j.kind === 'video' && j.editor) return 'Edited video';
  if (j.kind === 'video') return j.scene || 'Video';
  if (j.kind === 'trend') return j.clip ? 'Trend video (your own clip)' : `Trend video: ${trendOf(j.trend)?.name || 'a trend'}`;
  return '';
}
export const kindName = (k) => ({ photo: 'Photo', trend: 'Trend video', video: 'Video' }[k] || '');
// (2026-10-12, the editor) what one of its creations is, in a sentence: "photo", "meme", "X banner", "video", "trend video"
export const creationWord = (j) => (j?.kind === 'photo' ? (j.shape === 'banner' ? 'X banner' : j.meme ? 'meme' : 'photo')
  : j?.kind === 'trend' ? 'trend video' : 'video');
export const shapeName = (s) => PHOTO_SHAPES[s]?.name || SHAPES.tall.name;
// (round 4, phase 4) how long a video is, as people say it: "5 s", "1 min"
export const secondsText = (s) => (Number(s) >= 60 && Number(s) % 60 === 0 ? `${Number(s) / 60} min` : `${Number(s) || 5} s`);
export function jobMeta(j) {
  // (round 4) an X banner: the size X asks for its header
  if (j.kind === 'photo' && j.shape === 'banner') return `AI-generated · X banner${j.edit || j.editor ? ' · Edited' : ''} · ${BANNER.W} × ${BANNER.H}`;
  // (round 4, phase 4) a meme, its format; a photo's model and quality when it isn't the usual (Classic, Standard)
  const parts = ['AI-generated', j.kind === 'photo' && j.meme ? 'Meme' : kindName(j.kind)];
  if (j.kind === 'photo' && j.meme && MEMES[j.meme]) parts.push(MEMES[j.meme].name);
  // (2026-10-12, the editor) made with "Edit with words"
  if (j.kind === 'photo' && (j.edit || j.editor)) parts.push('Edited');
  if (j.kind === 'photo' && j.model === 'crisp') parts.push(PHOTO_MODELS.crisp.name);
  if (j.kind === 'photo' && (j.quality === 'hd' || j.quality === 'ultra')) parts.push(`${PHOTO_QUALITY[j.quality].name} ${PHOTO_QUALITY[j.quality].px}`);
  // (a scene video: its model when it isn't Standard, and its length (5 s before the menu); a trend video is as long as its
  // clip: a trend clip's 10 s, or their own clip's 3 to 10)
  if (j.kind === 'video') {
    // (2026-10-12) …saved from the video editor (no model of its own: cut from one of its videos)
    if (j.editor) parts.push('Edited');
    else if (j.model && j.model !== 'standard' && VIDEO_MODELS[j.model]) parts.push(j.model === 'anime' && j.quality ? `${VIDEO_MODELS.anime.name} ${j.quality}` : VIDEO_MODELS[j.model].name);
    parts.push(secondsText(j.seconds || 5));
  }
  if (j.shape) parts.push(shapeName(j.shape));
  if (j.kind === 'video') parts.push(j.sound ? 'with sound' : 'no sound');
  return parts.join(' · ');
}
// a long video's step now (its parts, made one after another, then joined)
const PART_STEP = { queue: 'Waiting for part', make: 'Making part', save: 'Saving part' };
export function jobStateText(j, { position = null } = {}) {
  if (j.status === 'paid' || j.status === 'making') {
    const line = Number.isInteger(position) && position >= 0 && j.step === 'queue' ? ` (#${position + 1} in line)` : '';
    if (j.kind === 'video' && Number(j.parts) > 1) {
      const part = Number(j.part) || 0;
      if (part >= Number(j.parts)) return 'Joining its parts…';
      return `${PART_STEP[j.step] || PART_STEP.queue} ${part + 1} of ${j.parts}…${line}`;
    }
    return `${stepText(j.step)}…${line}`;
  }
  if (j.status === 'failed') return `${failText(j.error)}${j.refunded ? backText(j) : ''}`;
  return '';
}
// ---------- (round 4) a progress bar's words: "42% · about 3 min left" (src/studio/progress.js draws the bar) ----------
export function leftWords(s) {
  const v = Math.max(0, Math.round(Number(s) || 0));
  if (v < 60) return 'under a minute left';
  if (v < 100) return 'about a minute left';
  return `about ${Math.round(v / 60)} min left`;
}
// p: rules.js progressOf's { pct, left, slow }
export const progressText = (p) => (p ? `${p.pct}% · ${p.slow ? 'taking longer than usual' : leftWords(p.left)}` : '');
// …and for a screen reader (the bar's aria-valuetext)
export const progressSpoken = (p) => (p ? `${p.pct}%, ${p.slow ? 'taking longer than usual' : leftWords(p.left)}` : '');
// what each bar is for (its label)
export const PROGRESS_LABELS = {
  character: 'Making it in 3D', model: 'Making it in 3D', looks: 'Making its looks', body: 'Making its full body', asis: 'Getting it ready', photo: 'Making its photo',
  banner: 'Making its X banner', trend: 'Making its trend video', video: 'Making its video', clip: 'Making the trend clip',
  // (round 4, phase 4)
  meme: 'Making its meme', long: 'Making its long video',
  // (2026-10-12) a video saved from the video editor
  cut: 'Making your edited video',
};
// a photo, video or trend video being made, as rules.js TYPICAL names it (an X banner is a photo of its own kind; a meme and a
// long video have their own words, and their plans their own: rules.js jobPlan)
export const progressKind = (j) => (j?.kind === 'photo' && j.shape === 'banner' ? 'banner' : j?.kind === 'photo' && j.meme ? 'meme'
  : j?.kind === 'video' && j.editor ? 'cut' : j?.kind === 'video' && Number(j.parts) > 1 ? 'long' : j?.kind);

// a 3D model of it (the studio's characters: its steps; round 2: one waiting for a big burn)
const MODEL_STEP = { image: 'Shaping it', rig: 'Giving it bones', moves: 'Teaching it moves', save: 'Saving it' };
export function modelText(m) {
  if (!m) return '';
  if (m.status === 'done') return 'Ready in 3D';
  if (m.status === 'quote') return `Waiting for your burn: ${num(m.paid)} of ${num(m.agi)} $AGI`;
  if (m.status === 'paid' || m.status === 'making') return `${MODEL_STEP[m.step] || MODEL_STEP.image}…`;
  if (m.status === 'failed') {
    if (m.kind === 'burn') return `${failText(m.error)}${m.credit ? ' You can make it again, free.' : ''}`;
    return `${failText(m.error)} Its credits came back.`;
  }
  if (m.status === 'expired') return 'Its burn never came: it expired.';
  return '';
}
export const MODEL_STEP_WORDS = MODEL_STEP;

// ---------- what was typed, refused (server/inf-words.js checkStart, checkInfScene; the coin: server/launch.js) ----------
const WORDS = {
  empty: { name: 'Give it a name.', mode: 'Pick how to start.', style: 'Pick a style.', look: 'Pick a look.', age: 'Pick an age.', scene: 'Describe the scene.', shape: 'Pick its shape.',
    // (round 4, phase 4) a meme: its format, and its words (one for each of its lines)
    meme: 'Pick a meme format.', caption: 'Write its words: every line needs some.',
    // (2026-10-12, the editor) "Edit with words": its change
    edit: 'Type what should change.' },
  long: { name: 'A name of 24 characters at most.', words: 'At most 200 characters.', scene: 'At most 300 characters.', caption: `A line of ${MEME_LINE_MAX} characters at most.`,
    edit: `At most ${EDIT.MAX} characters.`,
    // (2026-10-12, the editor) the photo editor's words: each text on it
    text: `At most ${EDITOR.TEXT_MAX} characters for each of your words.` },
  short: { scene: 'A few more words, please: at least 10 characters.', edit: `A few more words, please: at least ${EDIT.MIN} characters.` },
  letters: { name: 'Letters, numbers, spaces and simple punctuation only.' },
  bad: 'Pick one of the choices.',
  link: 'No links: just words.',
  contact: 'No @names, addresses, emails or phone numbers.',
  adult: 'Keep it PG-13: nothing sexual or suggestive.',
  minor: 'Adults only: never a child, or anyone made to look like one.',
  hate: 'Nothing hateful or gory.',
  person: 'Never a famous or real person by name: describe a look, or use a photo of someone who said OK.',
  character: "Never someone else's character or a brand's mascot: make one of your own.",
  her: 'Nothing that passes for AGI-1, her team or anything official.',
  // (round 4, phase 4) a meme's words are never about money (server/inf-words.js MONEY)
  money: 'Keep it off money: nothing about coins, prices, buying or selling.',
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
  none: { picture: "We couldn't find one person or character in it: try a clearer picture.", clip: "We couldn't see a person moving in it: try another clip." },
  many: { picture: 'One person or character only, please.', clip: 'One person in the clip, please.' },
  minor: { picture: 'Adults only: a photo needs to clearly show someone 21 or older, a drawing an adult character.', clip: 'Adults only: everyone in the clip needs to clearly be 18 or older.' },
  famous: { picture: 'That looks like a famous person: only you, someone who said OK, or a character of yours.',
    ref: `That looks like a famous person: a reference is never a person. ${REFS.NOTE}` },
  // (round 4, phase 4) a reference picture (server/inf-ai.js checkRef): never a person, since the influencer is the person
  person: { picture: 'That looks like a famous person: only you, someone who said OK, or a character of yours.',
    ref: `That one shows a person: a reference is a thing, a place, a pet, food or a style (your influencer is the person).` },
  real_person: 'That looks like a famous person: only you, someone who said OK, or a character of yours.',
  copyright: { picture: "That looks like someone else's character: use one of your own.",
    ref: "That looks like someone else's character or mascot: use a picture of your own things." },
  faces_off: 'Photos of real people are switched off for now: use a drawing or a character of yours.',
  sexual: 'Keep it PG-13: nothing sexual or revealing.',
  hate: 'Nothing hateful.',
  violence: 'Nothing violent or gory.',
  other: "That one can't be used: try another.",
  picture: "That file isn't a picture we can read: a JPEG, PNG or WebP.",
  other_ref: "That one can't be used as a reference: try another picture.",
  video: "That file isn't a video we can read: an MP4 or MOV.",
  length: 'A clip of 3 to 10 seconds, please.',
  pixels: 'A clip of 720 to 2160 pixels on each side, please (most phone videos are).',
  fps: 'A clip of 24 to 60 frames a second, please (most phone videos are).',
  parts: 'Your clip didn\'t arrive whole: try again.',
  frames: "We couldn't read your clip's frames: try again.",
  done: 'That upload is finished already: pick it again.',
  gone: 'That upload expired: pick it again.',
  // (round 4, phase 4: a reference counts too) an upload's own "too many": a day's uploads, never what's being made
  too_many: "That's today's 30 uploads: try again tomorrow.",
};
export function uploadText(why, kind = 'picture') {
  if (why === 'other' && kind === 'ref') return UPLOAD_WHY.other_ref;
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
  closed: "AGI Studio is private for now, and this wallet isn't on its list yet.",
  not_ready: "AGI Studio isn't open yet.",
  not_configured: "AGI Studio isn't open yet.",
  consent: 'Tick the box first.',
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
  face: 'A private influencer is never shown in Explore: only people with its link see it.',
  private: 'A private influencer (made from a photo of a real person) is never shown in Explore, liked or boosted.',
  needs_photo: 'A realistic influencer\'s video starts from one of its photos: make a photo first, then pick it.',
  trend: "That trend isn't available any more: pick another.",
  clip: 'Your clip expired (a day): upload it again.',
  image: "That photo isn't available any more: pick another.",
  source: 'Your picture expired: upload it again.',
  making: 'That one is being made already.',
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
  // round 2: slots and burn unlocks, likes, the weekly prize
  no_slot: 'You have all the influencers your wallet may have: delete one, or unlock one more by burning $AGI.',
  own: "That's your own: likes are for other people's creations.",
  burns_off: "Burn unlocks aren't open right now.",
  burns_sold_out: "This month's burn unlocks are all spoken for: try again on the 1st (UTC).",
  off: "That isn't open right now.",
  quote: 'That one is still waiting for its burn.',
  done: "That's done already.",
  no_credit: "This one can't be made again for free.",
  no_kind: "That can't be paid for that way.",
  prizes_off: "Prizes aren't switched on right now: your prize waits.",
  none: "There's no spotlight to claim for that week.",
  no_prize: "That week's spotlight is for glory: there's no prize to claim.",
  claimed: 'Its prize is being sent right now: check again in a minute.',
  sending: 'Its prize is on its way: check again in a few minutes.',
  sent: 'Its prize was sent.',
  empty: 'The prize wallet needs a top-up first: your prize is safe and waiting.',
  failed: 'Nothing went out: try again.',
  not_mine: "That week's spotlight isn't yours.",
  burn_cap: "This month's burn unlocks are all spoken for: try again on the 1st (UTC).",
  // round 4: an X banner (too wide to start a video or a trend video)
  banner: "An X banner can't start a video or a trend video: pick another photo.",
  // round 3: the owner's credits for testing
  gift_credits: 'A whole number of credits, from 1 to 100,000.',
  gift_to: "That doesn't look like a wallet's address: 0x and 40 letters and numbers.",
  // round 4, phase 2: a ban, the team, support tickets, the AI helper, the owner's alert levels
  banned: "This wallet can't make anything in AGI Studio any more: a moderator banned it. To ask why, open a support ticket (My studio → Help & support).",
  not_staff: "Only AGI Studio's team can do that.",
  protected: "That's the owner's or a team member's: it can't be banned.",
  ban_protected: "That's the owner's or a team member's: it can't be banned.",
  already: 'That maker is banned already.',
  ban_already: 'That maker is banned already.',
  ban_lifted: 'That ban was lifted already.',
  too_many_open: `You have ${TICKETS.OPEN} tickets open: close one, or add to one of them.`,
  ticket_too_many: `That's ${TICKETS.MSGS_A_DAY} messages from you today: the team will answer what's there. Try again tomorrow.`,
  ticket_busy_day: 'Support is very busy today: try again tomorrow, or ask the helper.',
  ticket_topic: "Pick what it's about first.",
  ticket_empty: 'Write what happened first.',
  ticket_long: `At most ${TICKETS.BODY_MAX.toLocaleString('en-US')} characters, please.`,
  ticket_closed: 'This ticket is closed: open a new one if you need more help.',
  secret: "That looks like a seed phrase or a private key: never send one to anyone, us included. Nothing was sent or kept. If it's real, move your funds to a new wallet now.",
  help_empty: 'Type a question first.',
  help_long: `A shorter question, please (${HELPER.QUESTION_MAX} characters at most).`,
  help_used: `That's ${HELPER.PER_DAY} answers for you today: open a support ticket, or ask again tomorrow.`,
  help_busy: 'The helper is resting for today: open a support ticket instead.',
  team_address: "That doesn't look like a wallet's address: 0x and 40 letters and numbers.",
  team_self: "That's your own wallet: the owner can do everything already.",
  team_role: 'Pick a role: mod or support.',
  team_nick: 'A nickname of 2 to 24 letters, numbers, spaces, dots, dashes or underscores.',
  nick_taken: 'That nickname is taken (or it would pass for the owner or the studio): pick another.',
  team_full: 'The team is full (20 people): remove someone first.',
  // (2026-10-11) giving access while AGI Studio is private (the owner's tab)
  access_address: "That doesn't look like a wallet's address: 0x and 40 letters and numbers.",
  access_self: "That's your own wallet: it's always in.",
  access_note: 'A note of 24 characters at most (only you see it).',
  access_full: 'The list is full (200 wallets): take someone off first, or open AGI Studio to everyone.',
  access_gone: 'That wallet was already off the list.',
  levels: 'Each alert level is a number from 0 (never alert) up.',
  // round 4, phase 3: gifts of bought credits, gift links and invites (codes of their own: server/inf-gifts.js; round 3's
  // gift_credits and gift_to above are the owner's credits for testing)
  gifts_off: "Gifts of credits aren't open right now.",
  give_to: "Who's it for? A wallet's address (0x and 40 letters and numbers), or the clank.trade name it shows here (@name).",
  give_credits: `A whole number of credits, from ${GIFTS.MIN} up to what you may give today.`,
  gift_no_name: "Nobody in AGI Studio shows that clank.trade name: check its spelling, or use their wallet's address.",
  gift_self: "That's your own wallet: a gift is for someone else.",
  gift_to_banned: "That wallet can't get gifts: it's banned from AGI Studio.",
  gift_too_many: `That's ${GIFTS.PER_DAY} gifts from you today: more tomorrow.`,
  gift_links: `You have ${GIFTS.OPEN_LINKS} gift links waiting: take one back, or wait until one is claimed.`,
  gift_day_cap: "That's more than you may give today.",
  gift_short: "Not enough credits to give: only credits you bought (or got as a gift) can be given, never this month's free ones or bonus ones.",
  gift_gone: "That gift link isn't here: check you have all of it.",
  gift_claimed: 'This gift was claimed already.',
  gift_canceled: 'Its sender took this gift back.',
  gift_expired: 'This gift link expired: its credits went back to its sender.',
  gift_own: "That's your own gift link: send it to someone else (or take it back in My studio).",
  gift_held: "This gift link is on hold while its sender's account is looked at.",
  gift_state: 'That gift changed in the meantime: have another look.',
  note_long: `A message of ${num(GIFTS.NOTE_MAX)} characters at most.`,
  note_link: 'No links in a message.',
  note_contact: 'No @names, addresses, emails or phone numbers in a message.',
  note_deal: "A message can't talk about money, prices, deals or other apps: credits are a gift here, never sold.",
  note_words: 'Keep the message PG-13 and kind.',
  // (2026-10-12, the editor) deleting one of its creations
  job_gone: "That one isn't here any more: it was deleted (or taken down).",
  job_making: "It's still being made: you can delete it once it's done.",
  job_in_use: 'Something is being made from it right now: you can delete it once that\'s done.',
  // (2026-10-12, the editor) "Make another" of one saved from the photo editor
  editor: 'It was made in the photo editor: open it and edit it again.',
  // (2026-10-12) the owner's gift links of free credits (the owner's tab)
  link_credits: `A whole number of credits, from ${num(OWNER_LINKS.MIN)} to ${num(OWNER_LINKS.MAX)}.`,
  links_full: `You have ${num(OWNER_LINKS.OPEN)} gift links waiting: take one back, or wait until one is claimed.`,
  refs_off: "Invites aren't open right now.",
  ref_bad: "That isn't an invite code: 8 letters and numbers, from someone's invite link.",
  ref_none: 'No invite has that code: check it with whoever sent it.',
  ref_self: "That's your own invite: share it with friends.",
  ref_already: 'You joined through an invite already.',
  ref_bought: 'Invites are for wallets that never bought credits: yours has.',
  ref_loop: "That's the invite of someone you invited: an invite can't go both ways.",
  // round 4, phase 4: the model menu, references and memes
  model: "That model, length or quality isn't on its menu: pick one of its choices.",
  no_anime: 'Anime is for drawn styles (anime, comics, 3D, toys and art): pick Standard or Pro, and one of its photos to start from.',
  // (2026-10-11) "Use my photo as it is": only a photo of the whole person, head to feet
  not_full: 'Your photo as it is needs a photo of the whole person, head to feet: pick another way to make it, or another photo.',
  refs: "One of your references can't be used (it's more than a day old, or it wasn't yours), or there are more than its model takes: pick them again.",
  // (2026-10-11) its profile picture, and its coin's picture: one of its own pictures, done and shown
  picture: "That picture isn't there any more: pick another one.",
  // (2026-10-12, the video editor)
  cut: "That part or shape can't be cut from this video: change it and try again.",
  from: "The video it's from isn't there any more.",
  cuts_open: `You have ${VIDEO_EDITOR.OPEN} edited videos being made: wait for one to finish.`,
  busy: 'Something went wrong on our side: try again in a minute.',
};
export const errorText = (why) => ERRORS[why] || ERRORS.busy;

// ---------- the editor (2026-10-12): Make another and Delete, on its own creations ----------
// "Make another"'s "no"s: what it was made from that isn't there any more (makeJob's), its words refused by a newer rule, else
// our server's. d: the answer's data ({ error, field, why })
const AGAIN = {
  image: "The photo it started from isn't there any more: make a new one from its tools.",
  clip: 'Its clip is kept a day: upload it again in the Trend tool.',
  refs: 'Its reference pictures are kept a day: make a new one with new ones.',
  trend: "That trend clip isn't available any more: pick another in the Trend tool.",
  model: "Its model isn't on the menu any more: make a new one from its tools.",
  needs_photo: "A realistic influencer's video starts from one of its photos: make one from the Video tool.",
  // (2026-10-12) one saved from the photo editor
  editor: "It was made in the photo editor: open it, or the photo it's from, and edit it again.",
};
// (j: the creation it was asked for, when the page has it: one saved from the video editor says so)
export function againErrorText(d = {}, j = null) {
  if (d.error === 'words') return `Its words can't be used as they are any more: ${wordsText(d.field, d.why)}`;
  if (d.error === 'editor' && j?.kind === 'video') return "It was made in the video editor: open it, or the video it's from, and edit it again.";
  return AGAIN[d.error] || errorText(d.error);
}
// …its toast: "Making another photo: about half a minute"
export function againMadeText(j) {
  const long = j?.kind === 'video' && Number(j.parts) > 1;
  return `Making another ${creationWord(j)}: ${j?.kind === 'photo' ? 'about half a minute' : long ? 'several minutes' : 'a few minutes'}`;
}
// "Delete": its "are you sure?" ({ title, text: [lines], yes }). pfp: its influencer's profile picture was framed from it.
// (Its link and download stop working "within minutes": a public one's files are kept by our CDN up to 10 minutes,
// server/inf-api.js s-maxage=600, and its pages' data up to 30 seconds)
export function deleteJobText(j, { name = '', pfp = false } = {}) {
  const w = creationWord(j);
  const text = j?.status === 'failed'
    ? ['It couldn\'t be made: it just goes from your creations.']
    : [`It's deleted from every page, and its link and download stop working within minutes. This can't be undone.`,
      'Its credits don\'t come back: it was made.'];
  if (pfp) text.push(`${name || 'Its'}${name ? "'s" : ''} profile picture was framed from it: it goes back to its picked look.`);
  return { title: `Delete this ${w}?`, text, yes: `Delete the ${w}` };
}
export const deletedText = ({ pfp = false } = {}) => (pfp ? 'Deleted: its profile picture is its picked look again.' : 'Deleted.');
// the failed ones worth a "Try again" (the same words and settings): never one the AI's safety check stopped, a clip at a size
// trend videos can't use, an expired clip or a picture it started from that's gone (trying again would fail the same way)
// (2026-10-12) never one saved from the video editor (it has no words and settings to make again: its video can be edited again)
export const tryAgainOk = (j) => j?.status === 'failed' && j.editor !== true
  && !['refused', 'small', 'clip', 'source', 'gone', 'deleted'].includes(String(j.error || ''));
// "Edit with words" (the same day: a change typed in words, a new photo from that one, next to it, at that photo's price): ideas
// to tap (a change each: PG-13, made up, never a real person, a brand or money)
export const EDIT_IDEAS = [
  'Make the jacket red', 'Add gently falling snow', 'Make it night, with soft city lights', 'Add round sunglasses',
  'Warm golden-hour light', 'Add a small fluffy dog beside them', 'Make it rain, with a clear umbrella', 'Change the background to a beach',
];
// …what stays as it is (its sheet's note), for what it's made from: a photo, a meme (its words too) or an X banner (its size)
export function editNote(j) {
  const base = 'Only that changes: the same character, place and framing.';
  if (j?.kind === 'photo' && j.shape === 'banner') return `${base} It stays an X banner, ${BANNER.W} × ${BANNER.H}.`;
  if (j?.kind === 'photo' && j.meme) return `${base} Its words stay as they are.`;
  return base;
}
// …its toast: "Editing your photo: the new one shows next to it in about half a minute"
export const editMadeText = (j) => `Editing your ${creationWord(j)}: the new one shows next to it in about half a minute`;

// ---------- the photo editor (2026-10-12, the editor: free, in the browser; src/studio/views/photo-editor.js) ----------
// its sheet's line under its title
export function editorNote(j) {
  return j?.kind === 'photo' && j.shape === 'banner'
    ? 'Free: its light, a filter, words and stickers (it stays 1500 × 500). Save it as a new X banner, or download it.'
    : 'Free: crop and turn it, its light, a filter, words and stickers. Save it as a new photo, or download it.';
}
// …saved: its toast
// (2026-10-12) its maker's own download (server/inf-clean.js): clean for a holder, else with our pill as everyone's; a real
// person's, the reminder ("Same as the rest", the owner's choice). Never "buy" (hard rule 8)
export function downloadText(d, { real = false } = {}) {
  const label = real ? ' Post it with your app\'s AI label.' : '';
  if (d?.clean) return `Downloaded without our pill 💜 (a thank-you for holding ${Number(d.need).toLocaleString('en-US')}+ $AGI). It still says inside its file that it's AI-made.${label}`;
  if (d?.why === 'holding') return `Downloaded with our pill. A wallet holding ${Number(d.need).toLocaleString('en-US')}+ $AGI (or burned for messages) downloads its own without it.${label}`;
  if (d?.why === 'made_with_it') return `Downloaded: its pill is part of the video (it was made with it), so it stays.${label}`;
  return `Downloaded.${label}`;
}
export const editorSavedText = (j) => `Saved: your edited ${creationWord(j)} is next to the one it's from.`;
// …and what stopped it being saved (our server's answer: server/inf-editor.js)
const EDITOR_REFUSED = {
  sexual: "It can't be saved: keep it PG-13, nothing sexual or revealing.",
  minor: "It can't be saved: nobody in it may look under 18.",
  hate: "It can't be saved: nothing hateful.",
  violence: "It can't be saved: nothing violent or gory.",
  words: "It can't be saved: some words on it aren't OK (no rude words, links, @names, brands or money talk).",
};
const EDITOR_WHY = {
  too_many: `You've saved ${EDITOR.PER_DAY} edited photos today: more tomorrow. Downloading is always free.`,
  busy_day: 'Saving edited photos is busy today: download it, or try again tomorrow.',
  image: "The photo it's from isn't there any more.",
  picture: "That picture couldn't be made here: try again.",
  size: "That picture couldn't be made here: try again.",
  ai: "We couldn't check it just now: try again in a moment.",
  done: "It's saved already.",
  ticket: 'That took too long: save it again.',
};
export function editorErrorText(d = {}) {
  if (d.error === 'refused') return EDITOR_REFUSED[d.why] || "It can't be saved: try other words or stickers.";
  return EDITOR_WHY[d.error] || errorText(d.error);
}

// ---------- the video editor (2026-10-12, the editor: in the browser, made by our clock; src/studio/views/video-editor.js) ----------
// its sheet's line under its title (own: its video carries its share mark already, so it keeps its own shape)
export function cutNote(j, { own = false } = {}) {
  return own
    ? 'Free: trim it, its sound, words and stickers (it keeps its shape: its mark is in it). Save it as a new video, made in a minute or two.'
    : `Free: trim this ${creationWord(j)}, change its shape, its sound, words and stickers. Save it as a new video, made in a minute or two.`;
}
// …saved: its toast
export const cutSavedText = () => "Saved: your edited video is being made next to the one it's from: a minute or two.";
// …and what stopped it (our server's answer: server/inf-cut.js; its words' reasons come with error 'words': wordsText says them)
const CUT_WHY = {
  too_many: `You've saved ${VIDEO_EDITOR.PER_DAY} edited videos today: more tomorrow.`,
  busy_day: 'Saving edited videos is busy today: try again tomorrow.',
  picture: "Its words and stickers couldn't be made here: try again.",
  size: "Its words and stickers couldn't be made here: try again.",
  done: "It's saved already.",
  ticket: 'That took too long: save it again.',
};
export const cutErrorText = (d = {}) => CUT_WHY[d.error] || errorText(d.error);
// its part, in words: "2.4 s to 7.4 s · 5.0 s long"
export const tenth = (s) => (Math.round(Number(s) * 10) / 10).toFixed(1);
export const trimText = (start, end) => `${tenth(start)} s to ${tenth(end)} s · ${tenth(end - start)} s long`;

// ---------- buying credits: "Check my payment" (server/credits.js checkTopup) ----------
const RESULTS = {
  pending: 'Not on the chain yet: give it a moment, then check again.',
  failed: 'That transaction failed on the chain: nothing was paid.',
  nothing: "It didn't pay the studio: it went somewhere else, or it wasn't USDG.",
  other_wallet: 'It came from another wallet: send from the wallet you connected.',
  too_old: 'It was sent before this, or over 7 days ago.',
  used: 'That payment was counted already.',
  too_small: 'Too small to count.',
  chain: "Couldn't read it on the chain just now.",
};
export const resultText = (why) => RESULTS[why] || errorText(why);
export function topupCheckText(r) {
  // (round 4, phase 3) an invited wallet's first top-up of $5 or more brings its welcome credits too
  if (r.added > 0 && Number(r.welcome) > 0) return `Payment found: ${creditsText(r.added)} added, and your invite's ${num(r.welcome)} bonus credits 💜`;
  if (r.added > 0) return `Payment found: ${creditsText(r.added)} added 💜`;
  const first = (r.results || []).find((x) => !x.ok);
  if (first) return resultText(first.why);
  return r.source === 'explorer'
    ? "No new payment from your wallet found yet. It can take a minute to show up: check again, or paste the transaction's link."
    : 'Nothing counted.';
}

// ---------- the owner's credits for testing (round 3: the owner's page) ----------
// the amounts offered first (any whole number from 1 to 100,000 can be typed)
export const GIFT_AMOUNTS = [1000, 5000, 20000];
export const GIFT_MAX = 100_000;
// from this many, the button asks for a second tap (a typo of a zero costs real AI money later)
export const GIFT_CONFIRM = 20_000;
// What a gift will do, before it's given: "1,000 credits: about $10 of AI, paid from your AI balance as they're used."
export const giftPlanText = (n) => `${creditsText(n)}: about ${usd(n)} of AI, paid from your own AI balance as they're used.`;
// …and what it did (server/inf-api.js inf-gift: { gave, self, to, allowed, letIn }). Since 2026-10-11 a tester's wallet is let
// into AGI Studio with them while it's private (letIn); if it couldn't be (the list full, the database older), the owner can
// give it access above.
export function giftText({ gave, self, to, allowed, letIn }) {
  const line = `Added ${creditsText(gave)} to ${self ? 'your wallet' : shortAddress(to)} 💜`;
  if (allowed === false) return `${line} While AGI Studio is private, that wallet can't use them yet: give it access in "Who can use AGI Studio" above.`;
  if (letIn === true) return `${line} It can use AGI Studio now too: it's on your list above.`;
  return line;
}

// ---------- who may use AGI Studio while it's private (2026-10-11: the owner's tab) ----------
// How a wallet got onto the list, as the owner's tab says it (since 2026-10-12 also one of the owner's gift links claimed)
export const ACCESS_VIA = { owner: 'Let in by you', credits: 'Got credits for testing', link: 'Claimed your gift link' };
// The card's first line: whether anyone needs letting in, and who else is in without the list
export function accessIntroText({ open = false, vercel = [], team = 0 } = {}) {
  if (open) return 'AGI Studio is open to everyone (STUDIO_OPEN in Vercel): nobody needs letting in. Wallets on this list stay on it in case you make it private again.';
  const also = [`you`];
  if (team > 0) also.push(team === 1 ? 'your team (1 person)' : `your team (${num(team)} people)`);
  if (vercel.length) also.push(`${vercel.length === 1 ? '1 wallet' : `${num(vercel.length)} wallets`} in STUDIO_ONLY_FOR in Vercel (${vercel.join(', ')})`);
  return `While AGI Studio is private, only the wallets on this list can make anything. Also in, without the list: ${also.length > 1 ? `${also.slice(0, -1).join(', ')} and ${also.at(-1)}` : also[0]}.`;
}
// Its "no"s, for the owner: an influencers.sql older than this says how to fix it (not "AGI Studio isn't open yet.")
export const accessErrorText = (error) => (error === 'not_ready'
  ? 'Run supabase/influencers.sql again in Supabase first (it ends with influencers_ready = 1), then try again.'
  : errorText(error));
// What letting a wallet in did: "0x12ab…cdef can use AGI Studio now 💜"
export const accessDoneText = ({ short, added }) => (added === false ? `${short} was on the list already: its note is saved.` : `${short} can use AGI Studio now 💜 They connect that wallet and reload the page.`);

// ---------- burns (round 2: a free 3D model, one more influencer, a boost in Explore) ----------
// What a burn unlocks, as the pages name it
export const BURN_WHATS = { model: 'A free 3D model', slot: 'One more influencer', boost: 'A boost in Explore' };
const BURN_RESULTS = { ...RESULTS, nothing: "It didn't burn $AGI: it went somewhere else, or it wasn't the official $AGI." };
export const burnResultText = (why) => BURN_RESULTS[why] || errorText(why);
// "Check my burn"'s answer (server/inf-burns.js burnCheck, server/studio.js checkPayment): { paid, have, need, results, source }
export function burnCheckText(r) {
  if (r.paid) return 'Burn found: it\'s unlocked 💜';
  const counted = (r.results || []).filter((x) => x.ok).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  if (counted > 0) return `Counted: ${num(r.have)} of ${num(r.need)} $AGI. Burn the rest (${num(Math.max(0, r.need - r.have))} $AGI) from the same wallet, then check again.`;
  const first = (r.results || []).find((x) => !x.ok);
  if (first) return burnResultText(first.why);
  return r.source === 'explorer'
    ? "No new burn from your wallet found yet. It can take a minute to show up: check again, or paste the transaction's link."
    : 'Nothing counted.';
}
// The time left on a boost: "18 h more" · "40 min more"
export function leftText(until, now = Date.now()) {
  const ms = Number(until) - now;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const min = Math.ceil(ms / 60_000);
  return min < 90 ? `${min} min more` : `${Math.round(min / 60)} h more`;
}

// ---------- likes (round 2: holders' likes pick the spotlight of the week) ----------
export function likeErrorText(why) {
  if (why === 'too_many') return "That's today's likes (50 a day): more tomorrow.";
  if (why === 'own') return ERRORS.own;
  if (why === 'private') return 'Private ones can\'t be liked.';
  if (why === 'gone') return "It isn't here any more.";
  return errorText(why);
}
export const likesText = (n) => `${num(n)} like${Number(n) === 1 ? '' : 's'}`;

// ---------- the weekly spotlight (server/inf-week.js) ----------
// "the week of Oct 5" (its Monday, UTC)
export function weekText(week) {
  const t = Date.parse(`${week}T00:00:00Z`);
  return Number.isFinite(t) ? `the week of ${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : '';
}
export const prizeText = (agi) => (Number(agi) > 0 ? `${num(agi)} $AGI` : 'For glory');
// a week as the owner's page names its state
export const WEEK_STATUS = {
  none: 'Nothing picked', picked: 'Waiting for your look', approved: 'Approved: its maker can claim', claimed: 'Being sent…', sending: 'On its way', sent: 'Sent',
};
// the maker's own prize (My studio), its state
export function myWeekText(w) {
  if (w.status === 'approved') return `Your creation is the spotlight of ${weekText(w.week)}: ${prizeText(w.prize)} for you. A thank-you for making, not an investment.`;
  if (w.status === 'claimed' || w.status === 'sending') return `Your prize for ${weekText(w.week)} (${prizeText(w.prize)}) is on its way.`;
  if (w.status === 'sent') return `Your prize for ${weekText(w.week)} (${prizeText(w.prize)}) was sent ✓`;
  return '';
}

// ---------- the live stats board (round 2; public totals only) ----------
export const STAT_NAMES = [
  ['influencers', 'Influencers'], ['photos', 'Photos'], ['videos', 'Videos'], ['models', '3D models'], ['today', 'Made today'],
  ['likes', 'Likes'], ['burned', '$AGI burned'], ['boosted', 'Boosted now'],
];

// ---------- the choices, as the page offers them ----------
export const MODE_CARDS = Object.entries(MODES).map(([id, m]) => ({ id, ...m }));
// (2026-10-11) its style's name: one of 26, or none picked ('auto': "Any style")
export const STYLE_NAMES = { ...INF_STYLES, [STYLE_AUTO]: STYLE_ANY };
// …what "Any style" makes (the owner's "Their words, else photo (Recommended)"), by how it starts
export const STYLE_HINTS = {
  design: 'Optional. With Any style, it takes the style your words name (like "watercolor"), else a photo look.',
  picture: 'Optional. With Any style, it keeps your picture\'s own look: a photo stays a photo, a drawing stays a drawing.',
};
// …how it's made, by the way it starts (WAYS): the fine print under Create's choices
const ABOUT_RULES = 'Adults only, PG-13, never a famous person, a real person only with their OK, never someone else\'s character.';
export function aboutWay(way) {
  if (way === 'asis') return `No AI: your photo is its full body as it is, and its portrait is cut around its face (a few seconds). Its photos and videos are made from it after. ${ABOUT_RULES}`;
  if (way === 'body') return `It's made by an AI service: its full body from your photo, keeping its face, legs and shoes (and its outfit, unless you pick one), in about a minute; its portrait is cut from it. If it can't be made, its credits come back. ${ABOUT_RULES}`;
  return `It's made by an AI service: 4 looks to pick from, then its full body (about a minute each). If it can't be made, its credits come back. ${ABOUT_RULES}`;
}
// …why a video's Anime model is off for it (src/studio/rules.js drawnStyle; our server's no_anime)
export const ANIME_WHY = 'For drawn styles: anime, comics, 3D, toys and art';
// …and what a checked photo can do (full: it shows the whole person, head to feet, so it can be used as it is)
export const photoReadyText = (full) => (full
  ? "Looks good: it's checked and ready ✓ It shows the whole person, so you can also use it as it is."
  : "Looks good: it's checked and ready ✓");
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
// (round 4) scene ideas for an X banner: wide places, with room on the left
export const BANNER_IDEAS = [
  'a city skyline at night with neon reflections', 'a cozy café counter by a big window, morning light', 'a rooftop at golden hour, the city stretching behind',
  'a dreamy pastel sky with soft clouds', 'a long gaming desk with RGB lights', 'a beach boardwalk at sunset, the sea behind',
  'a flower field reaching the horizon', 'a neon arcade with rows of glowing machines',
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

// ---------- (round 4) captions for a post of one of its creations ----------
export function captionErrorText(why) {
  if (why === 'too_many') return `That's today's AI captions (${CAPTIONS_A_DAY} a day): the ready-made ones are always free.`;
  if (why === 'busy_day') return 'AI captions are very busy today: the ready-made ones are always free.';
  if (why === 'ai') return "The AI didn't answer just now: try again in a minute, or use a ready-made one.";
  if (why === 'none') return "This time the AI's captions didn't pass our checks: try again, or use a ready-made one.";
  if (why === 'gone') return "It isn't here any more.";
  if (why === 'not_yours') return 'Only its maker can write captions for it.';
  return errorText(why);
}
export const captionsLeftText = (left) => (Number.isFinite(left) ? `${num(left)} left today` : `Free · ${CAPTIONS_A_DAY} a day`);
// X's own count of a post's length (twitter-text's weights): most letters 1, the rest 2 (emoji, Chinese, Japanese, Korean…)
export function xWeight(text) {
  let n = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    n += cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247) ? 1 : 2;
  }
  return n;
}
// "Post on X" with a caption: X's new-post box with it (the visitor posts it, never us), and the creation's own link when both
// fit X's 280 (a link counts 23)
export function postOnXUrl(text, url = null) {
  const withUrl = Boolean(url) && xWeight(text) + 1 + 23 <= 280;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(String(text ?? ''))}${withUrl ? `&url=${encodeURIComponent(url)}` : ''}`;
}

// ---------- (round 4) a clank.trade username, shown on its public influencers ("by @name") ----------
const CLANK_WHY = {
  bad: "That isn't a clank.trade username: 3 to 32 letters, numbers or _ (or paste your profile's link).",
  none: 'No clank.trade profile has that username.',
  not_yours: "That profile's wallet isn't the one you connected here: connect that wallet, or use your own username.",
  clank: "clank.trade didn't answer just now: try again in a minute.",
};
export const clankErrorText = (why) => CLANK_WHY[why] || errorText(why);

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

// ---------- (round 4, phase 2) help and support, the team's page, the owner's tab ----------
// A support ticket's state, as its own wallet sees it, and as the team does
export const TICKET_STATUS = { open: 'Waiting for the team', answered: 'The team answered', closed: 'Closed' };
export const TICKET_STATUS_TEAM = { open: 'Waiting', answered: 'Answered', closed: 'Closed' };
// what the person sees for the team's answers (the team sees who of them wrote each)
export const TEAM_NAME = 'AGI Studio support';
export const ROLE_NAMES = { owner: 'Owner', mod: 'Mod', support: 'Support' };
export const ROLE_NOTES = { mod: 'Support tickets, reports and bans', support: 'Support tickets' };
// the AI helper: a few questions to start with
export const HELP_QUESTIONS = [
  'How do I buy credits?',
  'How long does a video take?',
  'What do holders get?',
  "Why wasn't my video made?",
  'How do I launch a coin with my influencer?',
  'How do I delete an influencer?',
];
export const HELP_INTRO = "Quick answers about AGI Studio, written by AI from our guide. For a payment, a ban or something that broke, open a ticket: a person answers.";
export const helpLeftText = (left) => (Number.isFinite(left) ? `${num(left)} question${Number(left) === 1 ? '' : 's'} left today` : `${HELPER.PER_DAY} questions a day`);
// a question the helper couldn't answer (its safety filters stopped it, or it had nothing): a ticket instead
export const HELP_NO_ANSWER = "I can't help with that one here: a person can. Open a ticket below.";
// a question with what looks like a seed phrase, a private key or a transaction's id (the helper takes none: it can't look up
// a transaction, and the others must never be sent anywhere); never put back in the box
export const HELP_SECRET = "That looks like a seed phrase, a private key or a transaction's ID. The helper can't look up transactions, and a seed phrase or a private key must never be sent to anyone, us included (it wasn't sent or kept). For a payment, open a ticket and paste the transaction's link there.";
// the note under every message box: what a ticket keeps, and the one thing nobody ever asks for
export const TICKET_SAFETY = "What you write is kept with your ticket, for the team. Never write a seed phrase, a private key or a password: we never ask for one (a transaction's link or ID is fine). The team never asks you to send money, sign anything or connect your wallet anywhere.";
export const TICKET_NEW = 'Open a ticket';
// a ban, as its own wallet sees it on its pages
export const BANNED_TEXT = "This wallet is banned from AGI Studio (a moderator's decision): it can't make anything, and its influencers are hidden from everyone else. To ask why, open a support ticket.";
// a ban's reason, and its note (the team's own, never shown to them)
export const banLine = (b) => `${b.liftedAt || b.lifted ? 'Lifted' : 'Banned'}${b.by ? ` by ${b.by}` : ''} · ${agoText(b.lifted || b.at)}`;
// the owner's tab: a balance's state, and its value in its own unit
export const BALANCE_STATE = { ok: 'OK', low: 'Low', off: 'Not set up', no_access: "Can't read it", timeout: 'No answer in time', error: "Couldn't read it just now" };
export function amountText(v, unit) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (unit === 'USD') return `$${n.toFixed(2)}`;
  if (unit === 'ETH') return `${n < 0.01 ? n.toFixed(5) : n.toFixed(4)} ETH`;
  if (unit === 'USDG') return `${n.toFixed(2)} USDG`;
  return `${num(n)} ${unit}`;
}
export function balanceValueText(b) {
  if (!['ok', 'low'].includes(b?.state)) return BALANCE_STATE[b?.state] || BALANCE_STATE.error;
  return Number.isFinite(Number(b.eth)) && b.unit !== 'ETH' ? `${amountText(b.value, b.unit)} · ${amountText(b.eth, 'ETH')}` : amountText(b.value, b.unit);
}
export function balanceLowText(b) {
  if (b?.info) return 'What credits brought in (it never alerts).';
  if (b?.low && typeof b.low === 'object') return `Alert under ${amountText(b.low.agi, '$AGI')} or ${amountText(b.low.eth, 'ETH')}`;
  return Number(b?.low) > 0 ? `Alert under ${amountText(b.low, b.unit)}` : 'No alert set';
}
// the owner's numbers: what each line counts
export const ADMIN_NUMBERS = [
  ['infs', 'Influencers ready'], ['infsToday', 'New influencers today'], ['makingNow', 'Being made now'], ['failedToday', "Couldn't be made today"],
  ['boughtToday', 'Credits bought today'], ['boughtMonth', 'Credits bought this month'], ['spentWeek', 'Credits spent this week'],
  ['aiToday', 'AI cost today (an estimate)'], ['aiWeek', 'AI cost this week (an estimate)'], ['freeMonth', 'Free credits this month'],
  ['giftsMonth', 'Credits you gave this month (testing, gift links)'], ['walletsWeek', 'Wallets that made something this week'], ['likesWeek', 'Likes this week'],
  ['modelsMonth', '3D models this month'], ['ticketsOpen', 'Tickets waiting for the team'], ['reports', 'Reports to look at'],
  ['bans', 'Banned makers'], ['helpsToday', 'Helper answers today'],
  // (round 4, phase 3) gifts and invites
  ['giftedWeek', 'Credits given as gifts this week'], ['linksOpen', 'Gift links waiting'], ['rewardsMonth', "Invites' rewards this month"],
  ['invitedMonth', 'Joined through an invite this month'],
];
export function adminNumbers(s) {
  if (!s) return [];
  const values = {
    infs: num(s.infs?.ready), infsToday: num(s.infs?.today), makingNow: num((s.making || 0) + (s.infs?.making || 0)), failedToday: num(s.failedToday),
    boughtToday: `${num(s.credits?.boughtToday)} (${usd(s.credits?.boughtToday || 0)})`, boughtMonth: `${num(s.credits?.boughtMonth)} (${usd(s.credits?.boughtMonth || 0)})`,
    spentWeek: num(s.credits?.spentWeek), aiToday: `$${(Number(s.aiCost?.today) || 0).toFixed(2)}`, aiWeek: `$${(Number(s.aiCost?.week) || 0).toFixed(2)}`,
    freeMonth: num(s.credits?.freeMonth), giftsMonth: num(s.credits?.giftsMonth), walletsWeek: num(s.walletsWeek), likesWeek: num(s.likesWeek),
    modelsMonth: num(s.modelsMonth), ticketsOpen: num(s.tickets?.open), reports: num(s.reports), bans: num(s.bans), helpsToday: num(s.helpsToday),
    giftedWeek: num(s.credits?.giftedWeek), linksOpen: num(s.credits?.linksOpen), rewardsMonth: num(s.credits?.rewardsMonth),
    invitedMonth: num(s.credits?.invitedMonth),
  };
  return ADMIN_NUMBERS.map(([k, label]) => ({ key: k, label, value: values[k] }));
}
// what was made, by kind (the owner's numbers: today and this week)
export const MADE_KINDS = { looks: 'Looks', body: 'Full bodies', photo: 'Photos', banner: 'X banners', edited: 'Photos from the photo editor', trend: 'Trend videos', video: 'Videos', cut: 'Videos from the video editor', preset: 'Trend clips (yours)', example: 'Example pictures (yours)' };

// ---------- (round 4, phase 3, 2026-10-11) gifts of bought credits, gift links, invites ----------
// The owner's choices: "gifting bought credits only" (to a wallet, an @name or a gift link; 50,000 a day at most) and invites
// for credits only. The numbers come from ?inf-info (info.gifts, info.refs: null while switched off); rules.js has the
// defaults. Credits have no cash value: a gift is a gift, never a sale (every gift's page says never to buy credits from
// anyone, and that nobody from AGI Studio asks anyone to send credits).
// "100 bonus credits"
export const bonusText = (n) => `${num(n)} bonus credit${Number(n) === 1 ? '' : 's'}`;
export const GIFT_SAFETY = "Credits have no cash value: a gift is a gift, never a sale. Never buy credits from anyone: they're only ever bought here, from your own wallet app. Nobody from AGI Studio ever asks you to send credits.";
// A gift link opened in a browser without a wallet (a phone's Safari or Chrome): claiming it needs a wallet, and the wallet
// sheet's "Open in …" links never carry a gift link's secret (their addresses go to those apps' own servers), so the gift's
// sheet says how, with a button that copies the whole link (it stays on this device until it's pasted).
export const GIFT_NO_WALLET = "No wallet in this browser? Copy this gift link, then open it in your wallet app's own browser (MetaMask, Phantom, Coinbase Wallet, or Robinhood Wallet's Web3 tab) and claim it there. Keep it to yourself: anyone with the link can claim it.";
export const GIFT_APPS_NOTE = "Claiming a gift link? These buttons open AGI Studio without it: copy the gift link first (its sheet has a button), then open it in your wallet app's browser.";

// Who a gift is for, as typed (only its shape: our server checks the rest, a mixed-case address's checksum included):
// 'address' (0x and 40 letters and numbers), 'name' (a clank.trade name: "@name", "name" or its profile's link) or null
export function recipientShape(input) {
  const s = String(input ?? '').trim();
  if (!s || s.length > 120) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return /^0x0{40}$/i.test(s) || /^0x0{36}dead$/i.test(s) ? null : 'address';
  if (/^0x/i.test(s)) return null;
  const link = /^(?:https?:\/\/)?(?:www\.)?clank\.trade\/@([^/?#\s]+)\/?(?:[?#]\S*)?$/i.exec(s);
  let name = s.replace(/^@/, '');
  if (link) {
    try { name = decodeURIComponent(link[1]); } catch { return null; }
  }
  return CLANK_NAME.test(name) ? 'name' : null;
}
// How it shows in a review: "@name" or "0x12ab…cdef"
export function recipientLabel(input) {
  const s = String(input ?? '').trim();
  const shape = recipientShape(s);
  if (shape === 'address') return shortAddress(s.toLowerCase());
  if (shape !== 'name') return s;
  const link = /clank\.trade\/@([^/?#\s]+)/i.exec(s);
  let name = s.replace(/^@/, '');
  if (link) { try { name = decodeURIComponent(link[1]); } catch { /* shape said it's fine */ } }
  return `@${name.toLowerCase()}`;
}
// The credits of a gift, as typed ("1,000" too): a whole number, or null
export function giftCreditsFrom(input) {
  const s = String(input ?? '').trim().replace(/[\s,_]/g, '');
  return /^\d{1,7}$/.test(s) ? Number(s) : null;
}
// A few amounts to tap, under what may be given now (bought credits, and today's most)
export const GIFT_PICKS = [100, 500, 1000, 5000];
export const giftPicks = (paid, max) => GIFT_PICKS.filter((n) => n >= GIFTS.MIN && n <= Math.min(Number(paid) || 0, Number(max) || GIFTS.A_DAY));

// our server's "no" for a gift, with its numbers when it sent them (what's left today, what can be given)
export function giftErrorText(d) {
  const e = d?.error;
  if (e === 'gift_day_cap' && Number.isFinite(d.left)) {
    return d.left >= GIFTS.MIN ? `That's more than you may give today: ${creditsText(d.left)} left today.` : "You've given all you may give today: more tomorrow.";
  }
  if (e === 'gift_short' && Number.isFinite(d.paid)) {
    return `You have ${creditsText(d.paid)} you can give: only credits you bought (or got as a gift), never this month's free ones or bonus ones.`;
  }
  if (e === 'gift_claimed' && d.mine) return 'You claimed this gift already 💜';
  return errorText(e);
}
// Which field a gift's "no" is about (the sheet puts it under that field)
export function giftErrorField(e) {
  if (['give_to', 'gift_no_name', 'gift_self', 'gift_to_banned'].includes(e)) return 'to';
  if (['give_credits', 'gift_short', 'gift_day_cap'].includes(e)) return 'credits';
  if (['note_long', 'note_link', 'note_contact', 'note_deal', 'note_words', 'secret'].includes(e)) return 'note';
  return null;
}

// What may be given (g: info.gifts)
export function giftRulesText(g) {
  const x = g || { min: GIFTS.MIN, dayMax: GIFTS.A_DAY, perDay: GIFTS.PER_DAY, linkDays: GIFTS.LINK_DAYS };
  return `Only credits you bought, or got as a gift: never this month's free ones or bonus ones. From ${num(x.min)} credits a gift, up to ${num(x.dayMax)} a day (${num(x.perDay)} gifts).`;
}
export function giftableText(paid) {
  const p = Math.max(0, Number(paid) || 0);
  return p >= GIFTS.MIN ? `You can give ${creditsText(p)}.` : `You have ${creditsText(p)} to give: buy credits, or get a gift, to give some.`;
}
export const GIFT_LINK_NOTE = (days = GIFTS.LINK_DAYS) => `Anyone with the link can claim it once: send it only to the person it's for. Until it's claimed you can take it back in My studio; after ${num(days)} days it comes back to you by itself.`;
// A gift's state, as its sender and its receiver see it
export const GIFT_STATUS = { sent: 'Given', open: 'Waiting to be claimed', claimed: 'Claimed', canceled: 'Taken back', expired: 'Expired: back to its sender' };
// One row of a wallet's gifts (myGifts: { dir, credits, other, link, status, … }): its title, and its state's words
export function giftRowTitle(g) {
  if (g.dir === 'in') return g.other ? `From ${g.other}` : 'A gift';
  if (g.link) return g.status === 'claimed' && g.other ? `Gift link · claimed by ${g.other}` : 'Gift link';
  return g.other ? `To ${g.other}` : 'A gift';
}
export function giftRowState(g, now = Date.now()) {
  if (g.dir === 'in') return `${g.owner ? 'Bonus credits · got them' : 'Got it'} ${agoText(g.done || g.created, now)}`;
  if (g.status === 'open') return Number.isFinite(g.expires) ? `Waiting to be claimed · until ${dayText(g.expires)}` : GIFT_STATUS.open;
  if (g.status === 'expired') return g.link ? 'Nobody claimed it: back to you' : GIFT_STATUS.expired;
  if (g.status === 'canceled') return `Taken back · back to you ${agoText(g.done || g.created, now)}`;
  return `${GIFT_STATUS[g.status] || GIFT_STATUS.sent} ${agoText(g.done || g.created, now)}`;
}
// an invite's reward (myGifts' rewards: { kind: 'ref' | 'welcome', amount, at })
export const rewardTitle = (r) => (r.kind === 'welcome' ? 'Welcome credits from your invite' : 'From a friend you invited');

// ---------- invites ----------
// What an invite does (r: info.refs)
export function inviteText(r) {
  const x = r || { welcome: REFERRALS.WELCOME, welcomeMin: REFERRALS.WELCOME_MIN, percent: REFERRALS.PERCENT, perFriend: REFERRALS.PER_FRIEND, month: REFERRALS.A_MONTH };
  return `A friend who joins with your link gets ${bonusText(x.welcome)} with their first top-up of ${usd(x.welcomeMin)} or more. You get ${x.percent}% of what they buy, as bonus credits (up to ${num(x.perFriend)} from each friend, ${num(x.month)} a month).`;
}
export const INVITE_FINE = 'Bonus credits are spent after your free ones and before bought ones; they never run out and come back when something can\'t be made, but they can\'t be given. Invites are a thank-you, not an investment: credits have no cash value.';
// how its invites went (inviteOf: { friends, buyers, earnedMonth, earned }) → [[label, value]]
export function inviteStats(inv, r) {
  if (!inv) return [];
  const month = r?.month ?? REFERRALS.A_MONTH;
  return [
    ['Friends joined', num(inv.friends)], ['Bought credits', num(inv.buyers)],
    ['Yours this month', `${num(inv.earnedMonth)} / ${num(month)}`], ['Yours in all', num(inv.earned)],
  ];
}
// a wallet that joined through an invite: what its welcome credits wait for, or that they came
export function welcomeLine(r, c) {
  if (!c?.invited) return '';
  if (c.welcomed) return 'You joined through an invite 💜 Your welcome credits came.';
  const x = r || { welcome: REFERRALS.WELCOME, welcomeMin: REFERRALS.WELCOME_MIN };
  return `You joined through an invite 💜 ${bonusText(x.welcome)} come with your first top-up of ${usd(x.welcomeMin)} or more.`;
}
// the toast when a wallet joins through the invite it came with, and the one for a visitor who came through an invite link
export const inviteJoinedText = (r) => `💜 You joined through an invite: ${bonusText(r?.welcome ?? REFERRALS.WELCOME)} come with your first top-up of ${usd(r?.welcomeMin ?? REFERRALS.WELCOME_MIN)} or more.`;
export const inviteLandingText = (r) => `💜 You were invited to AGI Studio: connect a wallet, and your first top-up of ${usd(r?.welcomeMin ?? REFERRALS.WELCOME_MIN)} or more brings ${bonusText(r?.welcome ?? REFERRALS.WELCOME)}.`;
// gifts it got and hasn't seen yet (creditsOf's got and gotN)
export const gotGiftText = (n, credits) => `💜 You got ${Number(n) === 1 ? 'a gift' : `${num(n)} gifts`}: ${creditsText(credits)}. See ${Number(n) === 1 ? 'it' : 'them'} in My studio.`;
// sharing: the visitor posts (never us), never about money or credits' worth
export function shareInviteUrl(url) {
  const text = 'I make AI influencers in AGI Studio 💜 come make yours:';
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
export const giftShareText = (credits) => `A gift for you: ${creditsText(credits)} for AGI Studio 💜`;
// a gift link, as whoever opens it sees it (peekGift's status)
export const CLAIM_STATUS = {
  claimed: 'This gift was claimed already.', canceled: 'Its sender took this gift back.',
  expired: 'This gift link expired: its credits went back to its sender.',
};
// (2026-10-12) …and one of the owner's gift links of free credits (nothing went back to anyone: nothing was held)
export const OWNER_CLAIM_STATUS = {
  claimed: 'This gift was claimed already.', canceled: 'AGI Studio took this gift link back.', expired: 'This gift link expired.',
};
export const claimStatusText = (status, owner = false) => (owner ? OWNER_CLAIM_STATUS : CLAIM_STATUS)[status] || '';

// ---------- (2026-10-12) the owner's gift links of free credits ----------
// The owner: "i can put the a custome value of credits there then i can sent a message then theres gonna be a link for it then
// when i sahre it to someone they can see the meesage and the gifted credits and they can claim it"; the owner's choices: "Mine,
// free credits (Recommended)", "Up to 200 characters (Recommended)", "Once (Recommended)".
export const OWNER_LINK_INTRO = "Make a link of free credits with your message. Whoever you send it to sees your message and the credits, and claims them once with a connected wallet (18+). They're bonus credits, paid from your own AI balance as they're used, like credits for testing. While AGI Studio is private, claiming one lets that wallet in too.";
// the amounts offered first (any whole number from 1 to 100,000 can be typed), and from how many a second tap is asked
export const OWNER_LINK_AMOUNTS = [100, 500, 1000, 5000];
// What one will do, before it's made: "1,000 credits: about $10 of AI, … Claimed once, within 30 days."
export const ownerLinkPlanText = (n, days = OWNER_LINKS.DAYS) => `${giftPlanText(n)} Claimed once, within ${num(days)} days.`;
// how many are waiting: "3 waiting (50 at most)"
export const ownerLinksCount = ({ open = 0, max = OWNER_LINKS.OPEN } = {}) => `${num(open)} waiting (${num(max)} at most)`;
// One of the owner's links (server/inf-gifts.js ownerLinks: { status, to, expires, done, created }): its state's words
export function ownerLinkState(l, now = Date.now()) {
  if (l.status === 'open') return Number.isFinite(l.expires) ? `Waiting to be claimed · until ${dayText(l.expires)}` : 'Waiting to be claimed';
  if (l.status === 'claimed') return `Claimed by ${l.to || 'someone'} ${agoText(l.done || l.created, now)}`;
  if (l.status === 'canceled') return `Taken back ${agoText(l.done || l.created, now)}`;
  return Number.isFinite(l.expires) ? `Nobody claimed it by ${dayText(l.expires)}` : 'Nobody claimed it in time';
}
// the phone's own share sheet (the owner sends it; never a post by us)
export const ownerLinkShareText = (credits) => `A gift from AGI Studio: ${creditsText(credits)} 💜`;
// under a new link: until when, and to send it only to who it's for
export const ownerLinkMadeText = (expires) => `It can be claimed once${Number.isFinite(expires) ? `, until ${dayText(expires)}` : ''}. Send it only to who it's for: anyone with the link can claim it. Until then you can take it back below.`;
// the owner's tab's fine print
export const OWNER_LINK_FINE = "Credits have no cash value: a gift is a gift, never a sale. Anyone with a link can claim it once, so send each one only to who it's for. Nobody from AGI Studio ever asks anyone to send credits.";
// our server's "no" for one of the owner's links (made, or taken back): nothing was held, so nothing went back to anyone
export function ownerLinkErrorText(e) {
  const owner = { gift_claimed: 'claimed', gift_canceled: 'canceled', gift_expired: 'expired' }[e];
  return owner ? OWNER_CLAIM_STATUS[owner] : accessErrorText(e);
}
// one of the owner's own links opened by the owner's wallet
export const OWNER_GIFT_OWN = "That's your own gift link: send it to someone else (or take it back in Owner tools → Gifts).";
// The sheet the link opens: what claiming one does, and after
export const OWNER_GIFT_LINE = "Bonus credits from AGI Studio: use them for anything here. They don't run out (and they can't be given on).";
export const OWNER_GIFT_LETS_IN = "Claiming it lets your wallet into AGI Studio too (it's private for now).";
export const ownerClaimedText = (letIn) => (letIn
  ? 'Bonus credits from AGI Studio, and you can use AGI Studio now 💜 Start with your first influencer.'
  : "Bonus credits from AGI Studio: use them for anything here. They don't run out.");
