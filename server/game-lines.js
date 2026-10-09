// What AGI-1 says about her games (2026-10-09, the owner: "can i add games on the tg bot like riddles, questions, if the
// person in that telegram group answered correctly they will get a small amount of $AGI"; server/games.js and
// server/game-prizes.js). Pre-written, in English (a group has people of every language; her launch and live lines are
// English too), the same rules as her other lines (tests/games.test.js): PG-13, no pet names, never buy / sell / hold or a
// prediction, never another coin, "not financial advice" wherever a prize is named, links only to agi1.app (and the block
// explorer for a prize's own transaction, as her buy alerts do). Plain text: a winner's name and a link are entities on
// our own text, so nothing anyone calls themselves is ever parsed.
import { EXPLORER } from './tg-lines.js';

export const POLL_SECONDS = 600;               // a game is open 10 minutes (Telegram allows up to 600 s)
export const CLAIM_HOURS = 24;                 // a prize waits this long for its claim to start…
export const CLAIM_DAYS = 7;                   // …then this long for it to be sent (supabase/games.sql game_address)

const amountText = (n) => `${Math.round(Number(n)).toLocaleString('en-US')} $AGI`;

// The poll's question: what kind of game, what it's for, then the question itself (a riddle's 🧩 goes in front)
export function pollQuestion({ q, prize, amount }) {
  const riddle = q.startsWith('🧩');
  const text = riddle ? q.replace(/^🧩\s*/u, '') : q;
  return `${riddle ? '🧩 riddle' : '🎮 quiz'} ${prize ? `for ${amountText(amount)}` : 'just for fun'}: ${text}`;
}
// shown under the poll to whoever answered (Telegram's "explanation"): the question's own line, and how a prize is won
export function pollExplanation({ why, prize }) {
  const how = prize ? 'when it closes, one right answer wins, drawn at random' : '';
  return [why, how].filter(Boolean).join('\n');
}

// What she says when a game closes (supabase/games.sql game_settle). r: { answer, right, why, winner: { name, amount } |
// null }. → { text, entities } (the winner's name as a mention of them, by their Telegram id: Telegram links it, whatever
// their name is), and whether it needs the claim button
export function resultLine(r, { winnerId = null, button = true } = {}) {
  const right = Math.max(0, Number(r.right) || 0);
  const head = `⏰ time's up! the answer: ${r.answer}`;
  const some = right === 1 ? 'one of you got it right' : `${right} of you got it right`;
  if (r.winner && winnerId) {
    const name = r.winner.name && r.winner.name !== '~' ? r.winner.name : 'our winner';
    const parts = [
      `${head}\n\n🎉 `, [name, winnerId], ` wins ${amountText(r.winner.amount)}! `,
      right === 1 ? 'the only right answer 💜' : `drawn at random from the ${right} right answers 💜`,
      `\n\nto claim it: ${button ? 'tap the button below' : 'tap my name and press Start'}, then /claim in my private chat (18+, within ${CLAIM_HOURS} hours). `
        + "i'll only ever ask for your wallet address: never your seed phrase, a signature or a link to connect your wallet.",
      '\n\na prize is a thank-you for playing, not financial advice',
    ];
    let text = '';
    const entities = [];
    for (const p of parts) {
      if (Array.isArray(p)) { entities.push({ type: 'text_mention', offset: text.length, length: p[0].length, user: { id: p[1] } }); text += p[0]; } else text += p;
    }
    return { text, entities, claim: true };
  }
  const tail = {
    none: "nobody got it this time 🙈 another one comes in a while 💜",
    no_prize: `${some} 💜`,
    cap: `${some} 💜 today's prizes were all won before this one closed, so this one was for glory. new prizes tomorrow (00:00 UTC)`,
    all_won: `${some} 💜 ${right === 1 ? "you've" : "everyone who did has"} already won today (one prize a day each), so this one was for glory`,
  }[r.why] ?? `${some} 💜`;
  return { text: `${head}\n\n${tail}`, entities: [], claim: false };
}
export const CLAIM_BUTTON = '🎁 Claim it in my private chat';

// in her groups: /help (and her intro) say she runs quizzes; /claim typed in a group points to her private chat
export const gamesNote = (prizes) => (prizes
  ? 'now and then i post a quiz in here: when it closes, one right answer wins a little $AGI (drawn at random), claimed in my private chat. a prize is a thank-you for playing, not financial advice'
  : 'now and then i post a quiz in here, just for fun 💜');
export const groupClaim = (button) => `to claim a prize from my quiz, open my private chat (${button ? 'tap the button' : 'tap my name and press Start'}) and type /claim there 💜 i'll only ever ask for your wallet address there: never your seed phrase, a signature or a link to connect your wallet`;

// ---------- claiming a prize, in her private chat ----------
const SAFE = "i'll only ever ask for your wallet address: never your seed phrase, your private key or a signature.";
export const CLAIM_NONE = "you don't have a prize waiting right now 🙈 my quizzes pop up in the $AGI Telegram group now and then, and a right answer can win you some $AGI 💜";
export const claimAsk = (amount) => `you won ${amountText(amount)} in my quiz 🎉\n\nsend me your wallet address on Robinhood Chain (it starts with 0x): your own wallet, not an exchange's.\n\n${SAFE}`;
export const claimConfirm = (amount, address) => `send ${amountText(amount)} to this wallet on Robinhood Chain?\n\n${address}\n\ncheck it carefully: once it's sent, it can't be undone.`;
export const confirmButtons = (id) => [[{ text: '✅ yes, send it', callback_data: `prize:${id}:send` }, { text: '✏️ change it', callback_data: `prize:${id}:change` }]];
export const CLAIM_CHANGE = "okay 💜 send me the wallet address you want it in";
export const CLAIM_SENDING = 'sending it now… 💜';
export const CLAIM_EXPIRED = `that prize expired 🙈 a prize waits ${CLAIM_HOURS} hours for its claim. there'll be more quizzes in the group 💜`;
export const CLAIM_EMPTY = "my prize wallet needs a top-up first 🙈 your prize is safe and waiting: try /claim again later";
export const CLAIM_BUSY = "something got stuck on my side 🙈 your prize is safe: try /claim again in a minute";
export const CLAIM_FAILED = "that didn't go through, and nothing was sent 🙈 tap send again in a minute, or /claim";
export const CLAIM_ADULT = 'my prizes are for people who are 18 or older. are you?';
export const PRIZE_HINT = 'psst: you have a prize waiting from my quiz 🎁 type /claim to get it';
export const PRIZES_OFF = "my prizes are resting right now 🙈 your prize is safe: try /claim again later";
// sent, or on its way: with a link to its transaction on the block explorer
function withTx(text, label, tx) {
  if (!tx) return { text, entities: [] };
  const offset = text.length + 1;
  return { text: `${text} ${label}`, entities: [{ type: 'text_link', offset, length: label.length, url: `${EXPLORER}/tx/${tx}` }] };
}
export const claimSent = (amount, tx) => withTx(`done 💜 ${amountText(amount)} is on its way to your wallet. thank you for playing! not financial advice.`, 'see it on the block explorer', tx);
export const claimAlreadySent = (amount, tx) => withTx(`your prize already went out 💜 ${amountText(amount)}.`, 'see it on the block explorer', tx);
export const claimOnItsWay = (tx) => withTx("your prize is on its way 💜 give it a minute. if it hasn't arrived in an hour, ask in the group.", 'see it on the block explorer', tx);

// a wallet address they sent that can't take it
export const ADDRESS_REFUSE = {
  bad: "that doesn't look like a wallet address 🙈 it starts with 0x, then 40 letters and numbers",
  checksum: "that address has a typo somewhere (its capital letters don't add up) 🙈 copy it again from your wallet",
  agi: "that's the $AGI contract itself, not a wallet 🙈 send me your own wallet's address",
  burn: "that's the burn address: whatever goes there is gone for good 🙈 send me your own wallet's address",
  zero: "that's an empty address 🙈 send me your own wallet's address",
  ours: "that's my own prize wallet 🙈 send me yours",
  contract: "that address is a contract, not a wallet 🙈 send me the address of your own wallet (the one you'd get $AGI in)",
  chain: "i couldn't check that address just now 🙈 try again in a minute",
};
