// "Launch with AGI-1" (2026-10-01): what she says in her Telegram bot about launching a coin. Pre-written (no AI cost),
// her usual rules: PG-13, no pet names (anyone 18+ can start the bot), never buy / sell / hold, a prediction or "safe",
// "not financial advice" whenever money comes up, and she never promotes the coins people launch. English for now (like
// her texts first): the launch page is English too. tests/launch.test.js checks every line.
import { levelInfo, fmtTokens } from '../src/lib/levels.js';

export const NAME_MAX = 32;          // characters in a coin's name (clank.trade allows 64 bytes)
export const DESC_MAX = 100;         // characters in its line
export const DRAFT_HOURS = 2;        // a launch link works this long
const CRUSH = fmtTokens(levelInfo(2).min);

export const EXAMPLE = '/launch Sleepy Cat | SLEEPY | a cat who naps all day';

// How launching with her works. gasBack: her gas wallet pays the network fee back (LAUNCH_GAS_KEY is set)
export function howLine({ gasBack = false } = {}) {
  return [
    "let's launch a coin together 💜",
    `send me its picture as a photo, with a caption like this:\n${EXAMPLE}`,
    `a name (up to ${NAME_MAX} characters) | a ticker (2 to 10 letters or numbers) | one line about it, if you like (up to ${DESC_MAX})`,
    "i check it, then send you a private link. you launch it from your own wallet on agi1.app, on clank.trade's own contracts (and add its X, Telegram and website there, if you like): the coin is yours, and i never touch your keys or your money.",
    `the wallet you launch from needs ${CRUSH}+ $AGI held (or burned). nothing is spent: launching is free on clank.trade, and your wallet pays a tiny network fee in ETH${gasBack ? " (i pay it back once your coin is live 💜 one launch a day per wallet, while my gas wallet lasts)" : ''}. i won't promote your coin. not financial advice. 18+ only.`,
  ].join('\n\n');
}
export const HOW = howLine();

export const NOT_OPEN = "launching coins with me isn't open yet 🙈 soon";
export const NEED_PHOTO = `i need its picture too 🙈 send the picture as a photo, with your line as its caption:\n${EXAMPLE}`;
export const AS_PHOTO = 'send the picture as a photo, not as a file 🙈 (with the same caption)';
export const CANT_CHECK = "i couldn't check clank.trade just now 🙈 try again in a minute";
export const CHAT_CAP = "that's enough coins for today 🙈 come back tomorrow";
export const SITE_CAP = "i've helped with a lot of coins today 🙈 try again tomorrow";

// Why she can't take it (server/launch.js checkIdea and tickerTaken)
export const REFUSE = {
  format: `i couldn't read that 🙈 like this:\n${EXAMPLE}`,
  name: `its name needs 1 to ${NAME_MAX} letters, numbers or spaces 🙈`,
  symbol: 'its ticker needs 2 to 10 letters or numbers, like SLEEPY 🙈',
  description: `keep its line under ${DESC_MAX} characters 🙈`,
  characters: "just letters, numbers, spaces and simple punctuation please 🙈 no #, @ or /",
  crude: "i can't help with that one 🙈 i keep things PG-13. try another?",
  agi: "that sounds like me 🙈 there's only one $AGI. pick a name and ticker of your own?",
  egirl: "an egirl coin? with me? 😤 i'm the only AI girlfriend around here. pick another idea?",
  money: 'keep it about the coin itself 🙈 no trading talk, no promises, no other $tickers',
  link: 'no links, addresses or @names in it, please 🙈 just the coin',
  photo: "i couldn't use that picture 🙈 try another one (a normal photo, not too small)",
  taken: (symbol) => `there's already a $${symbol} on clank.trade 🙈 pick another ticker, so nobody mixes them up`,
  common: (symbol) => `so many coins on clank.trade look like $${symbol} that i can't check it 🙈 pick a more unusual ticker?`,
};

// Her coin is ready to launch: the private link (plain text; the buttons open it in a wallet app). gasBack: her gas wallet
// pays the network fee back (LAUNCH_GAS_KEY is set)
export function readyLine({ name, symbol, description, url, gasBack = false }) {
  return [
    `here's your coin 💜\n\n${name} ($${symbol})${description ? `\n${description}` : ''}`,
    `your private link, for the next ${DRAFT_HOURS} hours:\n${url}`,
    `open it in your wallet app's browser (MetaMask, Coinbase Wallet, Robinhood Wallet's web3 tab) or on a computer with your wallet. it needs ${CRUSH}+ $AGI in that wallet; anyone with this link could launch your coin, so keep it to yourself.${gasBack ? " once it's live, i pay your network fee back 💜 (one launch a day per wallet, while my gas wallet lasts)." : ''} not financial advice`,
  ].join('\n\n');
}

// The buttons under it: the link itself, and the same page inside a wallet app (their own links for that)
export function readyButtons(url) {
  const bare = url.replace(/^https:\/\//, '');
  return [
    [{ text: 'Open on agi1.app ↗', url }],
    [{ text: 'Open in MetaMask ↗', url: `https://metamask.app.link/dapp/${bare}` }, { text: 'Open in Coinbase Wallet ↗', url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` }],
  ];
}
