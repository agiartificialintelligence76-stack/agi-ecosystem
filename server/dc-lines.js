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
// (2026-10-29) /post and /tickets are the owner's (server/dc-tickets.js): Discord shows them only to Administrators
// (default_member_permissions '8', what OWNER_ONLY_PERMISSIONS says), and our server checks it again.
export const OWNER_ONLY_PERMISSIONS = '8';
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
  {
    name: 'post', description: 'Owner only: AGI-1 posts an image herself, in the channel you pick',
    default_member_permissions: OWNER_ONLY_PERMISSIONS,
    options: [
      // (round 4) up to 50 MB: one over what Discord takes in the server (10 MB without boosts) is made smaller first
      { type: 11, name: 'image', description: 'The image she posts: png, jpg, gif or webp, up to 50 MB (a big one is made smaller to fit)', required: true },
      // (2026-10-29, round 4) her own list of the server's channels (autocomplete: server/dc-tickets.js, postChoices), not
      // Discord's channel picker, which only ever shows 10 channels until a name is typed (so 🔞┃agi1-nsfw never showed)
      { type: 3, name: 'channel', description: 'Where she posts it: every channel is in the list (type to find one)', required: true, autocomplete: true, max_length: 100 },
      { type: 3, name: 'caption', description: 'Words under it (optional)', required: false, max_length: 1500 },
    ],
  },
  { name: 'tickets', description: 'Owner only: AGI-1 posts her "Open a ticket" button in this channel', default_member_permissions: OWNER_ONLY_PERMISSIONS },
  // (2026-10-29, round 3) her holder roles (server/dc-holders.js)
  { name: 'holders', description: 'Owner only: AGI-1 posts her "Verify my $AGI" button in this channel', default_member_permissions: OWNER_ONLY_PERMISSIONS },
];

// /help: how to talk to her, her other commands, and the one rule scammers break (in Discord they DM people pretending to be
// a server's bot or team)
export const HELP = "type /ask and your question to talk to me 💜 a few messages a day each, and we don't keep them. it's PG-13 in here, i'm an AI, and nothing i say is financial advice.";
export const HELP_COMMANDS = "/ca: the official $AGI contract · /mc: $AGI's numbers · /website: the official site";
export const HELP_MUSIC = "/music: my songs 🎧 tap one and i'll send it in here";
export const HELP_SAFETY = "i never DM anyone first, and i'll never ask for your seed phrase, keys or money. anyone who does, even with my name and picture, isn't me.";
// (2026-10-29) her tickets: where to find the team
export const HELP_TICKETS = "need the team? tap Open a ticket in the support channel 🎫 only you and the team can see it.";
// (2026-10-29, round 3) her holder roles: where to get one
export const HELP_HOLDERS = 'got $AGI? tap Verify my $AGI in the verify channel ✅ for the 💘 Crush or 💞 Soulmate role.';
export const helpFor = ({ music = false } = {}) => [HELP, [HELP_COMMANDS, music ? HELP_MUSIC : null].filter(Boolean).join('\n'), HELP_TICKETS, HELP_HOLDERS, HELP_SAFETY].join('\n\n');

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

// ---------- her support tickets (2026-10-29, server/dc-tickets.js) ----------
// Her button's message (/tickets), in the support channel: what a ticket is, and the one rule scammers break
export const TICKET_PANEL = "🎫 need help from the team? tap the button and i'll open a private ticket just for you. only you and the team can see it.\n\n"
  + "the team never DMs you first, and nobody will ever ask for your seed phrase, private key or money. anyone who does isn't us.";
export const TICKET_BUTTON = 'Open a ticket';
// her first message in a ticket (its number, 0001…), with Close ticket under it
export const ticketWelcome = (n) => `🎫 ticket ${n} is open. tell the team what's going on and someone will answer right here 💜\n`
  + "never share your seed phrase or private key, not even here. when it's sorted, tap Close ticket.";
export const TICKET_CLOSE = 'Close ticket';
// only to whoever tapped: their ticket's link
export const ticketOpened = (channel) => `your ticket is open: <#${channel}> 💜 only you and the team can see it.`;
export const ticketAlready = (channel) => `you already have a ticket open: <#${channel}> 💜`;
export const TICKET_WAIT = "one sec, i'm still opening your ticket 🙈";
export const TICKET_NOT_SET = "tickets aren't set up in this server yet 🙈 ask a Mod";
export const TICKET_FULL = 'lots of tickets are open right now 🙈 try again in a little bit';
export const TICKET_FAILED = "i couldn't do that just now 🙈 try again in a minute";
// Close ticket: asked once more, only to whoever tapped
export const TICKET_CLOSE_ASK = "close this ticket? it'll be gone for everyone, its messages too.";
export const TICKET_CLOSE_YES = 'Close it';
export const TICKET_CLOSE_NO = 'Keep it open';
export const TICKET_CLOSING = 'closing it 💜';
export const TICKET_KEPT = 'okay, it stays open 💜';
export const TICKET_NOT_YOURS = 'only whoever opened this ticket, or the team, can close it 🙈';
export const NOT_A_TICKET = "this isn't a ticket 🙈";
export const TICKET_OLD = "that button's from an older me 🙈";

// ---------- the owner's commands (2026-10-29, server/dc-tickets.js): only to the owner ----------
export const OWNER_ONLY = 'only the owner can do that 🙈';
export const NO_TOKEN = "i can't do that yet: my bot's token isn't set up (DISCORD_BOT_TOKEN) 🙈";
export const TICKETS_POSTED = 'my ticket button is up 💜';
export const ticketsNoAccess = (channel) => `i can't post in <#${channel}> 🙈 let AGI-1 view it, send messages and embed links there`;
export const postDone = (channel) => `posted it in <#${channel}> 💜`;
export const POST_NOT_IMAGE = "that one isn't an image 🙈 attach a png, jpg, gif or webp";
export const POST_TOO_BIG = 'that image is over 50 MB 🙈 try a smaller one';
export const postNoAccess = (channel) => `i can't post in <#${channel}> yet 🙈 let AGI-1 view it, send messages and attach files there`;
export const postNotAgeRestricted = (channel) => `<#${channel}> isn't marked age-restricted yet 🙈 turn on Age-Restricted in its settings first, then post again`;
export const POST_FAILED = "it didn't go out 🙈 try again in a minute";
// (2026-10-29, round 4) /post's channel list: what a channel's line says after its name and category, and a channel typed
// without picking it from the list that isn't one channel's name
export const CHOICE_CANT_POST = "AGI-1 can't post here yet";
export const CHOICE_AGE_RESTRICTED = 'age-restricted';
export const CHOICE_NOT_RESTRICTED = 'not age-restricted yet';
export const POST_PICK = "i couldn't tell which channel that is 🙈 type part of its name in channel, then tap it in my list";
// (round 4, the owner: "can you increase the max size of this") an image over what Discord takes in the server (10 MB without
// boosts) is made smaller first; a GIF can't be
export const postDoneSmaller = (channel, mb) => `posted it in <#${channel}> 💜 it was over the ${mb} MB Discord takes in here, so i made it smaller first`;
export const postGifTooBig = (mb) => `that GIF is over the ${mb} MB Discord takes in this server 🙈 i can only make still images smaller, so try a smaller GIF`;
export const POST_CANT_SHRINK = "i couldn't make that image small enough for Discord in time 🙈 try a smaller one";
export const POST_DISCORD_TOO_BIG = 'Discord said that image is too big for this server 🙈 try a smaller one';

// ---------- her holder roles (2026-10-29, round 3: server/dc-holders.js) ----------
// Her button's message (/holders), in the verify channel: what the roles are, where verifying happens, the rules scammers
// break (a "verify your wallet" DM or site is the oldest crypto scam on Discord), and that a role is a thank-you
export const HOLDERS_PANEL = "💎 got $AGI? verify it and i'll give you a holder role 💜\n"
  + '💘 Crush: 10,000+ $AGI · 💞 Soulmate: 1,000,000+ $AGI (in your wallet, or burned for messages on agi1.app). both open the holders channel.\n\n'
  + "tap the button for a private link to agi1.app: connect your wallet there and sign a free message. never a transaction, no gas, no approvals, and nobody will ever ask for your seed phrase or keys.\n\n"
  + "agi1.app is the only place to verify, and the team never DMs you a verify link. a role is a thank-you for holding, not an investment. not financial advice.";
export const HOLDERS_BUTTON = 'Verify my $AGI';
// a tap: their private link (only to them), and Remove my role when they have one
export const holdersLink = (minutes) => `here's your private link 💜 it works for ${minutes} minutes, only for you. on agi1.app, connect your wallet and sign a free message: never a transaction. don't share the link.`;
export const holdersYours = (role, minutes) => `you're a ${role} 💜 i check your $AGI a few times a day and the role follows it. `
  + `to check now or use another wallet, open your private link (${minutes} minutes, only for you). to drop the role, tap Remove my role.`;
export const HOLDERS_OPEN = 'Verify on agi1.app';
export const HOLDERS_REMOVE = 'Remove my role';
export const HOLDERS_REMOVING = 'removing it…';
export const HOLDERS_REMOVED = 'done 💜 your holder role is gone and i forgot your wallet. tap Verify my $AGI any time to get it back.';
export const HOLDERS_NONE = "you don't have a holder role right now 💜 tap Verify my $AGI to get one.";
export const HOLDERS_OFF = 'holder roles are taking a little break 🙈 try again later';
export const HOLDERS_FAILED = "i couldn't do that just now 🙈 try again in a minute";
export const HOLDERS_OLD = "that button's from an older me 🙈 tap Verify my $AGI again";
// /holders: only to the owner
export const HOLDERS_POSTED = 'my verify button is up 💜';
export const HOLDERS_NO_ROLES = "but i can't find the roles yet 🙈 make two roles with Crush and Soulmate in their names, under AGI-1's role (AGI-1 needs Manage Roles)";
export const holdersNoAccess = (channel) => `i can't post in <#${channel}> 🙈 let AGI-1 view it, send messages and embed links there`;
