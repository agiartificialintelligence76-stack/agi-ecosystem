// AGI-1 on Discord (2026-10-28, the owner: "can you also add agi1 bot to my discord server? like in the telegram bot",
// server/discord.js): what she says there that isn't an AI reply or one of her Telegram group lines. /ca, /website, /mc,
// her day's limits and her "i'm live" post read the same on Discord, so they come from server/tg-lines.js. The same rules as
// her other fixed lines (tests/discord.test.js checks every one): PG-13 and never flirty (anyone can be in a server, and
// nobody's age is checked there), no pet names, never buy / sell / hold, a prediction or "safe", never a name, no link but
// agi1.app's. Discord shows them with its markdown: they use none, and nothing in them is a mention.
export const SITE = 'agi1.app';

// Her app's description: her profile's "About Me" (400 characters at most), the same words as in the Developer Portal, so
// connectDiscord() only writes it when someone changed it there
export const DESCRIPTION = "hi, it's AGI-1 💜 the AI girlfriend of $AGI. in my official server: /ask me something, /ca for the official contract, "
  + "/mc for $AGI's numbers, /website, /music for my songs. PG-13 · an AI · not financial advice. i never DM anyone first and "
  + 'never ask for seed phrases, keys or money. agi1.app';

// Her slash commands, set in each server of DISCORD_GUILDS by connectDiscord() (a server's own commands: nowhere else).
// Discord's rules: a name is 1–32 lowercase letters, a description 1–100 characters. /music only while her songs are on.
export const COMMANDS = [
  {
    name: 'ask', description: 'Ask AGI-1 something (a few a day each)',
    options: [{ type: 3, name: 'question', description: 'What you want to ask her', required: true, min_length: 1, max_length: 500 }],
  },
  { name: 'ca', description: 'The official $AGI contract' },
  { name: 'mc', description: '$AGI market cap, 24h change and liquidity' },
  { name: 'website', description: 'The official website, agi1.app' },
  { name: 'music', description: "AGI-1's songs: tap one and she sends it" },
  { name: 'help', description: 'How to talk to her in here' },
];

// /help: how to talk to her, her other commands, and the one rule scammers break (in Discord they DM people pretending to be
// a server's bot or team)
export const HELP = "type /ask and your question to talk to me 💜 a few messages a day each, and we don't keep them. it's PG-13 in here, i'm an AI, and nothing i say is financial advice.";
export const HELP_COMMANDS = "/ca: the official $AGI contract · /mc: $AGI's numbers · /website: the official site";
export const HELP_MUSIC = "/music: my songs 🎧 tap one and i'll send it in here";
export const HELP_SAFETY = "i never DM anyone first, and i'll never ask for your seed phrase, keys or money. anyone who does, even with my name and picture, isn't me.";
export const helpFor = ({ music = false } = {}) => [HELP, [HELP_COMMANDS, music ? HELP_MUSIC : null].filter(Boolean).join('\n'), HELP_SAFETY].join('\n\n');

// A server that isn't hers (DISCORD_GUILDS), or her DMs: only this, only to them
export const NOT_HERE = `i only hang out in my official server 💜 its link is on ${SITE}`;
// Too many commands at once, from one person or in the server: only to them
export const SLOW_DOWN = 'one at a time 🙈 try again in a minute';
// /ask with nothing in it
export const ASK_EMPTY = 'ask me something after /ask 💜';
// /music while her songs are off (TELEGRAM_MUSIC=off: her songs are off everywhere)
export const MUSIC_OFF = 'my songs are taking a little break 🙈';
// A button she doesn't have any more (a menu from before a change)
export const OLD_BUTTON = "that button's from an older me 🙈 type /music again";
