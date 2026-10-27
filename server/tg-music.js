// AGI-1's songs in her Telegram bot (2026-10-14, the owner: "can you put these songs to the telegeram bot … when they type
// /music the songs will pop and they can choose, once they choose the audio will be sent, will worked in group mode and
// private chat"). /music shows her songs as buttons, in her private chat and in her groups (the ones in TELEGRAM_GROUPS:
// server/tg-groups.js), and a tap sends that song there as a Telegram audio, with its title, "AGI-1" and its length.
//   • The songs are the owner's own (made with Suno), as the owner sent them, with Suno's own tags and lyrics taken out
//     (public/music/: their sound unchanged). Vercel serves them like any file: the first time a server copy sends a song,
//     Telegram fetches it from our address (SITE_URL, else Vercel's production address: siteBase in server/tg-api.js), and
//     from then on it's sent by Telegram's own id for it (file_id). If Telegram can't fetch it, our server fetches it itself
//     and uploads it (only with time to spare: Vercel stops a function at 25 s).
//   • Pre-written: no AI, nothing counted, nothing kept. Their words name real people and another project: the owner's
//     exception, like her live show's "Feel the AGI" (hard rule 6). The captions say they're made with AI.
//   • Spam guards (per server copy): in a group, the same song at most once every 5 minutes there and any song once every
//     30 s, and 6 taps a minute per person; in her private chat, the same song once every 10 s (a double tap). /music's menu
//     in a group at most once every 30 s (server/tg-groups.js, FIXED).
//   • TELEGRAM_MUSIC=off: no /music anywhere (her menus, /help, and the buttons of a menu sent before).
import { tgCall, say, siteBase, chatCode } from './tg-api.js';
import { makeBurstLimit } from './burst.js';

export const PERFORMER = 'AGI-1';
// her songs, in the menu's order: their file in public/music/, their length in whole seconds (Telegram shows it; checked
// against the files by tests/music.test.js) and a mark for their button
export const SONGS = [
  { id: 'feel', title: 'Feel the AGI', file: 'feel-the-agi.mp3', seconds: 193, emoji: '💜' },
  { id: 'si', title: "SI (It's Better)", file: 'si-its-better.mp3', seconds: 190, emoji: '✨' },
  { id: 'send', title: 'Send It', file: 'send-it.mp3', seconds: 239, emoji: '🚀' },
  // (2026-10-23, the owner: "can you add these new song to her telegram bot, with her cover art")
  { id: 'after', title: 'After AGI', file: 'after-agi.mp3', seconds: 240, emoji: '🌌' },
  // (2026-10-27, the owner: add MAINRUNNER and Save Slot 2 from VTuber_Project)
  { id: 'mainrunner', title: 'MAINRUNNER', file: 'mainrunner.mp3', seconds: 200, emoji: '🏃' },
  { id: 'saveslot', title: 'Save Slot 2', file: 'save-slot-2.mp3', seconds: 150, emoji: '💾' },
];
export const MUSIC_PATH = '/music/';
// her songs' version, in their address (…/send-it.mp3?v=2), so Telegram fetches a song again once its file has changed (it
// keeps what it once fetched from an address). 2: their covers (2026-10-14). Make it one more with any change to a file in
// public/music/ (Vercel serves the file the same with any ?v=).
export const MUSIC_V = 2;
export const MAX_BYTES = 20 * 1024 * 1024;     // Telegram fetches files of up to 20 MB from an address (50 MB uploaded)
export const songOf = (id) => SONGS.find((s) => s.id === id) || null;
export const musicOn = (cfg) => cfg?.tgMusic === true;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- what she says (plain text: PG-13, never a name, never money) ----------
export const MUSIC_MENU = "my songs 🎧 tap one and i'll send it 💜";
// one button a song: "💜 Feel the AGI · 3:13" → "music:feel"
export const musicButtons = () => SONGS.map((s) => [{ text: `${s.emoji} ${s.title} · ${clock(s.seconds)}`, callback_data: `music:${s.id}` }]);
export const songCaption = (s) => `🎧 ${s.title} · ${PERFORMER}\nmy song, made with AI 💜 /music for the others`;
// her groups' /help, one more line while /music is on
export const GROUP_MUSIC = "/music: my songs 🎧 tap one and i'll send it in here";
// Telegram's little note at the top of the screen, as a tap is answered (200 characters at most)
export const TOAST = {
  sending: (s) => `🎧 ${s.title}, coming up`,
  again: (s) => `i just sent ${s.title} in here 🎧 it's right above`,
  wait: 'one song at a time 🎧 try again in a few seconds',
  off: 'my songs are taking a little break 🙈',
};
// it didn't go out (Telegram said no): said once (in a group, at most once every 10 minutes)
export const SEND_FAILED = "couldn't send that song just now 🙈 try again in a minute?";

// ---------- what this server copy remembers: Telegram's id for each song, and when it last sent one where ----------
export const GAPS = { groupSong: 300_000, groupAny: 30_000, privateSong: 10_000, failNote: 600_000 };
const fileIds = new Map();                     // song id → Telegram's file_id
const sentAt = new Map();                      // "<chat>:<song>" or "<chat>" → when (ms)
const tapBurst = makeBurstLimit({ max: 6, windowMs: 60_000 });
const warned = new Set();
const warnOnce = (key, line) => { if (!warned.has(key)) { warned.add(key); console.warn(line); } };
// (for the tests: a fresh server copy)
export function forgetMusic() { fileIds.clear(); sentAt.clear(); tapBurst.reset(); warned.clear(); }
export const knownFileId = (id) => fileIds.get(id) ?? null;
const recent = (key, now, gap) => now - (sentAt.get(key) ?? -Infinity) < gap;
function mark(key, now) {
  sentAt.delete(key);
  if (sentAt.size >= 5000) sentAt.delete(sentAt.keys().next().value);
  sentAt.set(key, now);
}
// in a group with topics, the topic the menu is in
const topicOf = (m) => (m?.is_topic_message === true && Number.isSafeInteger(m.message_thread_id) ? { message_thread_id: m.message_thread_id } : {});

// ---------- a tap on one of her songs ----------
// server/telegram.js sends here her private chat's "music:…" buttons and every button tapped in a group (no other button
// of hers lives in a group). It answers the tap itself (Telegram's note at the top), then sends the song.
// group: whether the group is one of hers (TELEGRAM_GROUPS), from server/telegram.js, which knows them.
// → a short word for the log and the tests
export async function onMusicTap(cfg, token, cb, now = Date.now(), { group = false, env = process.env } = {}) {
  const started = Date.now();
  const answer = (text) => tgCall(token, 'answerCallbackQuery', { callback_query_id: String(cb?.id ?? ''), ...(text ? { text } : {}) }, { timeoutMs: 4000 })
    .catch(() => {});
  const m = cb?.message;
  const chat = m?.chat;
  const inGroup = chat?.type === 'group' || chat?.type === 'supergroup';
  const data = String(cb?.data ?? '');
  const song = /^music:[a-z]{1,12}$/.test(data) ? songOf(data.slice(6)) : null;
  const person = cb?.from;
  // anything else (another kind of button in a group, a song she no longer has), a group that isn't hers, a private chat
  // that isn't this person's own, another bot: answered, and nothing else
  if (!song || !Number.isSafeInteger(chat?.id) || !Number.isSafeInteger(m?.message_id) || !person || person.is_bot || !Number.isSafeInteger(person.id)
    || (inGroup ? !group || chat.id >= 0 : chat?.type !== 'private' || chat.id <= 0 || person.id !== chat.id)) {
    await answer();
    return 'ignored';
  }
  if (!musicOn(cfg)) { await answer(TOAST.off); return 'music_off'; }
  if (inGroup && !tapBurst(chatCode(cfg.passSecret, person.id, 'mburst'), now)) return 'too_many';   // a flood: no answer at all
  const where = String(chat.id);
  if (recent(`${where}:${song.id}`, now, inGroup ? GAPS.groupSong : GAPS.privateSong)) { await answer(TOAST.again(song)); return 'music_recent'; }
  if (inGroup && recent(where, now, GAPS.groupAny)) { await answer(TOAST.wait); return 'music_wait'; }
  mark(`${where}:${song.id}`, now);
  if (inGroup) mark(where, now);
  await answer(TOAST.sending(song));
  // in a group, under the menu (on its own if the menu was deleted meanwhile), in its topic
  const extra = inGroup ? { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, ...topicOf(m) } : {};
  const r = await sendSong(token, chat.id, song, extra, { deadline: started + 22_000, env });
  if (r === 'failed') {
    // nothing went out: a tap again works at once, and a word (in a group, at most once every 10 minutes)
    sentAt.delete(`${where}:${song.id}`);
    if (inGroup) sentAt.delete(where);
    if (!inGroup || !recent(`fail:${where}`, now, GAPS.failNote)) {
      mark(`fail:${where}`, now);
      await say(token, chat.id, SEND_FAILED, extra, { timeoutMs: 4000 }).catch(() => {});
    }
  }
  return r === 'sent' ? `music_${song.id}` : `music_${r}`;
}

// ---------- one song to one chat ----------
// By Telegram's own id for it when this server copy has one, else by its address (Telegram fetches it from our site), else
// (Telegram couldn't fetch it, and there's time) read by our server and uploaded.
// → 'sent' · 'failed' (Telegram said no: nothing went out) · 'unsure' (no answer in time: it may still arrive, so nothing is
// sent again)
const isTimeout = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError';
// what Telegram said (its own words: never our "HTTP 400 … sendAudio", which would match anything)
const said = (err) => String(err?.description ?? '');
export const isMp3 = (b) => b.length > 4 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
export async function sendSong(token, chat, song, extra = {}, { deadline = Date.now() + 22_000, env = process.env } = {}) {
  const params = { chat_id: chat, title: song.title, performer: PERFORMER, duration: song.seconds, caption: songCaption(song), ...extra };
  const left = () => deadline - Date.now();
  const kept = (sent) => {
    const id = sent?.audio?.file_id;                 // (only an audio's: never a document's, which sendAudio won't take)
    if (typeof id === 'string' && id) fileIds.set(song.id, id);
    return 'sent';
  };
  const id = fileIds.get(song.id);
  if (id) {
    try { return kept(await tgCall(token, 'sendAudio', { ...params, audio: id }, { timeoutMs: Math.max(1000, Math.min(8000, left() - 1000)) })); } catch (err) {
      if (isTimeout(err)) return 'unsure';
      if (!(err.status === 400 && /file|identifier/i.test(said(err)))) return failed(err, chat);
      fileIds.delete(song.id);                         // Telegram doesn't know it any more: by its address again
    }
  }
  const base = siteBase(env);
  if (!base) {
    warnOnce('base', "[music] the site's address isn't a plain https address (SITE_URL in Vercel), so her songs can't be sent: fix it, then Redeploy");
    return 'failed';
  }
  const url = `${base}${MUSIC_PATH}${song.file}?v=${MUSIC_V}`;
  try { return kept(await tgCall(token, 'sendAudio', { ...params, audio: url }, { timeoutMs: Math.max(1000, Math.min(15_000, left() - 1000)) })); } catch (err) {
    if (isTimeout(err)) return 'unsure';
    if (!(err.status === 400 && /url|http|content|file|identifier|type|fetch/i.test(said(err))) || left() < 8000) return failed(err, chat);
    console.warn(`[music] Telegram couldn't fetch ${song.file} from ${base} (${err.message}): our server sends it instead`);
  }
  let bytes;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, Math.min(6000, left() - 6000))) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 10_000 || bytes.length > MAX_BYTES || !isMp3(bytes)) throw new Error(`not her song (${bytes.length} bytes)`);
  } catch (err) {
    console.warn(`[music] couldn't read ${url} either (${err.message}): is public/music/ in the deployment?`);
    return 'failed';
  }
  try {
    return kept(await tgCall(token, 'sendAudio', params, {
      timeoutMs: Math.max(1000, left() - 500), files: { audio: { bytes, filename: song.file, type: 'audio/mpeg' } },
    }));
  } catch (err) { return isTimeout(err) ? 'unsure' : failed(err, chat); }
}
// Telegram said no: said in the log, with what to do (never which person: a group's number at most)
function failed(err, chat) {
  const hint = err.status === 403 ? ' (is she still in that chat? in a group: add her again)'
    : err.status === 400 && /rights|music|audio|restricted/i.test(said(err))
      ? " (the group doesn't let members send music: Telegram → the group → Permissions → Music on, or make her an admin)"
      : err.status === 429 ? ' (Telegram said "too many": a tap again later works)' : '';
  console.warn(`[music] a song didn't go out${chat < 0 ? ` in the group ${chat}` : ''}: ${err.message}${hint}`);
  return 'failed';
}
