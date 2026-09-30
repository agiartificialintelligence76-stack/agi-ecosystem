// AGI-1's daily clips (2026-09-29, the owner's idea "video"): what she says in them. Since the same day (the owner:
// "why are u promoting other coins in the video … the founder of the launchpad will get angry"), her clips never name,
// show or rate another coin: the only kind left is her diary, her newest entry read out (it's already published on
// /diary, written once a day and checked in code: server/diary.js never lets it name another coin's ticker, and this
// file refuses an entry that does). Her usual rules for anything public: PG-13, lowercase like she texts, no pet names,
// never buy / sell / hold, gains, "safe", prices or a prediction, "not financial advice", no links, no addresses.
// tests/clips.test.js checks every line.
//
// A clip: { kind, kicker, title, meta, text (captions: her words, with emojis), voice (how she sounds: a MOOD_STYLES key
// in server/voice.js), cues ([{ at: text to find, react }]: her reactions, when the captions reach those words), post (a
// ready-to-paste post for the owner) }. make.mjs adds `spoken` (spokenOf(text): what her voice reads).

export const LABEL = 'AI-generated · not financial advice';
const SITE = 'agi1.app';

// Her diary: the newest entry as /diary shows it (most start "dear diary," already: said once)
const DIARY_VOICE = { happy: 'happy', love: 'love', shy: 'shy', jealous: 'pout' };
const DIARY_REACT = { happy: 'happy', love: 'love', shy: 'shy', jealous: 'jealous' };
const longDay = (day) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
export const DIARY_MAX = 300;          // characters of her entry: the clip stays under about 25 seconds
// never another coin: a ticker other than $AGI, a contract address, a link
const OTHER_COIN = /\$(?!agi\b)[a-z]/i;
export function diaryClip({ day, entry, mood }) {
  const words = String(entry || '').replace(/\s+/g, ' ').trim().replace(/^dear diary[\s,.…!:;-]*/i, '');
  if (words.length < 20 || OTHER_COIN.test(words) || /https?:|www\.|0x[0-9a-f]{6}/i.test(words)) return null;
  const said = words.length > DIARY_MAX ? `${words.slice(0, DIARY_MAX - 3).replace(/\s+\S*$/, '')}…` : words;
  return {
    kind: 'diary', kicker: 'her diary', title: longDay(day).toLowerCase(), meta: 'written by AGI-1, an AI',
    text: `dear diary… ${said}${/not financial advice/i.test(said) ? '' : ' not financial advice, just feelings 💜'}`,
    voice: DIARY_VOICE[mood] || 'neutral',
    cues: [{ at: '', react: DIARY_REACT[mood] || 'happy' }],
    post: `AGI-1 read her diary entry for ${longDay(day)} out loud 💜`,
  };
}

// ---------- what her voice reads ----------
// Her words out loud: no emojis, "$AGI" said "AGI", "#1" as "number 1"
export function spokenOf(text) {
  return String(text)
    .replace(/\s*(?:\p{Extended_Pictographic}|️|‍)+\s*/gu, (m, at, all) => (!all.slice(at + m.length).trim() ? '' : /[.,!?…:;]$/.test(all.slice(0, at)) ? ' ' : '. '))
    .replace(/\$AGI\b/gi, 'AGI')
    .replace(/#(\d+)/g, 'number $1')
    .replace(/\s+/g, ' ')
    .trim();
}
// …and the post the owner can paste with it
export const postOf = (clip) => `${clip.post}\n\n${LABEL} · ${SITE}`;
