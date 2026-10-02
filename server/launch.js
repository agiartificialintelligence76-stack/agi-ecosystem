// "Launch with AGI-1" (2026-10-01, the owner's idea: people launch a coin on clank.trade from her Telegram bot, "the wallet
// will be non custodial … make this better then continue"). The better version, with the owner's choices:
//   • In her bot, a photo captioned "/launch Name | TICKER | one line" gets her checks (checkIdea) and becomes a draft
//     (supabase/launch.sql) with a private link: agi1.app/launch/<id> (22 random characters, 2 hours). Since 2026-10-02
//     (the owner: "the ticker it can be anything and on the name … its okay if its a copycat") a name and a ticker can be
//     almost anything, other coins' tickers included: only PG-13, nothing like her or $AGI, no egirl coin, no links.
//   • On that page (src/launch/) the person connects their OWN wallet (the site's free sign-in signature). It needs
//     10,000+ $AGI held or burned in that wallet (the chat's Crush; the owner's choice: held, nothing spent), and since
//     2026-10-02 the more it holds, the more coins it may launch a day (the owner: "if they hold 10,000 $agi they can launch
//     5 tokens per wallet and if more more token to launch": 5 a day per 10,000, launchesADay). Our server then puts the
//     picture on IPFS once (Pinata's free plan, PINATA_JWT), builds clank.trade's own launch call for that wallet (the
//     factory's launchToken: free, launch config 0, no creator tax, no buyback, paired with ETH or, since 2026-10-02,
//     SPCX, the pair they pick; with the coin's X, Telegram and website if they added them: optional, checkLinks) and
//     tries it on Robinhood Chain first (an eth_call from their wallet, as clank.trade's docs ask) before their wallet
//     opens.
//   • They approve it in their own wallet, which becomes the coin's creator ("the caller becomes the creator", the docs).
// Our server never holds anyone's key and never signs or sends anything for them: it reads (eth_call, receipts, Telegram's
// copy of the picture) and builds the call. Never: a wallet inside the bot (a bot that can sign holds the key: custodial,
// whatever it's called), a token approval, a buy, ETH sent with the launch, another contract, a coin named like $AGI, a crude
// name, AGI-1 promoting a coin.
//   • Their network fee, paid back (the owner's choice, "a way to attract more people to launch there on my bot"): once the
//     launch is read on the chain, the owner's own small gas wallet (LAUNCH_GAS_KEY, a wallet made only for this) sends
//     the fee that launch cost back to its creator: once per coin, at most once a day per wallet, LAUNCH_GAS_MAX a launch
//     and LAUNCH_GAS_DAILY a day for the site (payGasBack). The one key our server holds is that wallet's, the owner's:
//     a hack could take at most what's in it, so it only ever holds a little ETH.
// Not tested against the live chain from Claude's workspace (it can't reach Robinhood Chain): the calls are clank.trade's
// documented ABIs (developer.clank.trade → Reference → Contracts and Guides → Launch a token).
import { randomBytes, createHmac } from 'node:crypto';
import { encodeFunctionData, decodeFunctionResult, decodeFunctionData, parseAbi, keccak256, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpc } from './limits.js';
import { rpcUrl, CHAIN_ID } from './chain.js';
import { FACTORY, FACTORY_ABI, readAll, callOf } from './clank-chain.js';
import { tickerKey, maskSlurs, cidOf } from './checker.js';
import { isCrude, looksLike, readLimited } from './coins.js';
import { EGIRL, asLatin } from './lookalike.js';
import { NAME_MAX, SYMBOL_MAX, DESC_MAX, DRAFT_HOURS } from './launch-lines.js';
import { AGI_PER_STEP, COINS_PER_STEP, LAUNCHES_MAX, launchesADay } from '../src/launch/rules.js';
import { cleanLinks, LINK_FIELDS } from '../src/launch/links.js';

export { FACTORY };
export const ZERO = `0x${'0'.repeat(40)}`;            // the pair "token" for ETH
// What a coin can be paired with (what people trade it against on its curve): ETH, and since 2026-10-02 SPCX ("u can now
// pair coin launches with AI stocks starting with SpaceX AI (SPCX)", clank.trade's founder; the owner: "the team added
// token can now paired with spcx"). SPCX's address is the one clank.trade's own coins name as their quote token; before
// each launch the factory itself is asked whether it's still on its approved list (approvedPairTokens), and launching
// with it costs no SPCX (a launch without a buy needs no token approval, clank.trade's docs).
export const SPCX = '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea';
export const PAIRS = { eth: ZERO, spcx: SPCX };
// the page's choice ('eth', 'spcx'; nothing = ETH) → the pair's address, or null for anything else
export const pairOf = (choice) => (choice === undefined || choice === null ? ZERO
  : typeof choice === 'string' && Object.hasOwn(PAIRS, choice) ? PAIRS[choice] : null);
export const LAUNCH_CONFIG = 0n;                       // clank.trade's active launch config
export const DRAFT_MINUTES = DRAFT_HOURS * 60;         // a draft can be got ready for 2 hours
// The coins one wallet may launch a day (the owner's rule, 2026-10-02: "if they hold 10,000 $agi they can launch 5 tokens
// per wallet and if more more token to launch"): 5 for every 10,000 $AGI it holds or burned for messages, 50 at most
// (100,000+). 10,000 is the chat's Crush (src/lib/levels.js), so under it: none. Counted as the coins it gets ready (its
// picture put on IPFS, or the same draft got ready again with other details: another coin), launched or not, per UTC day
// (supabase/launch.sql launch_prepare and launch_predicted); the whole site: LAUNCH_DAILY_CAP pictures a day.
// (src/launch/rules.js, shared with the launch page)
export { AGI_PER_STEP, COINS_PER_STEP, LAUNCHES_MAX, launchesADay };
export const DRAFTS_PER_CHAT = LAUNCHES_MAX + 10;      // drafts one Telegram chat may make a day (5 before the coins a day by holdings)
export const DRAFTS_A_DAY = 3000;                      // drafts the whole site may make a day (300 before 2026-10-02: a draft is
                                                       // only a database row until it's got ready, and many chats can each make 60 now)
export const GAS_PER_WALLET = 1;                       // launch fees paid back to one wallet a day
export const PICTURE_MAX = 1_000_000;                  // bytes
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DRAFT_ID = /^[A-Za-z0-9_-]{22}$/;
export const newDraftId = () => randomBytes(16).toString('base64url');

// clank.trade's factory, from its docs (the same strings as theirs: Reference → Contracts, Guides → Launch a token)
export const LAUNCH_ABI = parseAbi([
  'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken) payable returns (address launchToken,address curve)',
  'function previewLaunchEconomics(uint256 launchConfigId,address pairToken) view returns (bytes32)',
  'function launchFee() view returns (uint256)',
  'function canLaunch(address launcher) view returns (bool)',
  'function approvedPairTokens(address pairToken) view returns (bool)',
]);
export const LAUNCH_SELECTOR = '0xf35abbcf';           // launchToken(…): the only call the launch page may send (src/launch/send.js)
// The factory's errors a launch can revert with (Reference → Errors → Launching), by their first 4 bytes. (A creator tax, a
// buyback or a zero address can't happen with the call below: "reverted".)
const ERROR_OF = {
  'LaunchAlreadyExists()': 'exists',                       // the same creator, details and salt: already launched
  'LaunchEconomicsMismatch(bytes32,bytes32)': 'economics', // its terms changed after we read them
  'InvalidMetadata()': 'metadata',                         // a field empty or too long
  'NotWhitelisted()': 'closed',                            // new launches are switched off (for this wallet)
  'PairTokenNotApproved()': 'pair',                        // its pair (SPCX) isn't on the factory's list (any more)
  'InvalidLaunchConfigId()': 'config', 'LaunchConfigDisabled()': 'config',
  'LaunchFeeNotPaid()': 'fee', 'NativeValueMismatch(uint256,uint256)': 'fee',
};
export const ERRORS = Object.fromEntries(Object.entries(ERROR_OF).map(([sig, why]) => [keccak256(toBytes(sig)).slice(0, 10), why]));

// A wallet's code in the launch tables: never its address, and not the same code as its name and notes (server/session.js)
export const launchWallet = (secret, address) =>
  createHmac('sha256', secret).update(`launch-wallet:${String(address).toLowerCase()}`).digest('base64url').slice(0, 32);

// The site's address for her links (like the webhook's and the link previews'): SITE_URL, else Vercel's production address
export function siteBase(env = process.env) {
  const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://agi1.app');
  const base = String(raw).trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(base) ? base : 'https://agi1.app';
}
export const draftUrl = (id, env) => `${siteBase(env)}/launch/${id}`;

// Launching is open when the database, the picture host and the secrets are there (launch.sql is checked when it's used)
export const launchReady = (cfg) => Boolean(cfg.pinataJwt && cfg.supabaseUrl && cfg.supabaseKey && cfg.passSecret.length >= 32);
// Open to everyone: set up, and not private (LAUNCH_ONLY_FOR isn't set). Her commands menu and her /help follow this
export const launchOpen = (cfg) => launchReady(cfg) && !cfg.launchTesters;
// May this Telegram sender ({ id, username }, from Telegram's own update) launch right now? Everyone once it's open; while
// LAUNCH_ONLY_FOR is set (the owner's private first launch), only the accounts in it; nobody before it's set up
export function launchAllowed(cfg, from) {
  if (!launchReady(cfg)) return false;
  const only = cfg.launchTesters;
  if (!only) return true;
  const id = Number.isSafeInteger(from?.id) ? String(from.id) : '';
  const name = typeof from?.username === 'string' ? from.username.toLowerCase() : '';
  return (id !== '' && only.ids.has(id)) || (name !== '' && only.names.has(name));
}

// ---------- her checks ----------
// "/launch Sleepy Cat | SLEEPY | a cat who naps all day" (or the parts on separate lines) → { name, symbol, description }
// · { empty: true } for "/launch" alone · null when it isn't a /launch
export function parseLaunch(text) {
  const m = /^\/launch(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const rest = (m[1] || '').trim();
  if (!rest) return { empty: true };
  const parts = rest.split(/\s*(?:\||\n)\s*/);
  return { name: parts[0] ?? '', symbol: parts[1] ?? '', description: parts.slice(2).join(' ') };
}

// Invisible characters go: controls, zero-width spaces, bidi marks, Hangul fillers, tags… (Unicode's "default ignorable"
// ones), except what emoji are made of: a variation selector, and a zero-width joiner between two emoji (👩‍💻 stays one)
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f]|(?![\u200d\ufe0e\ufe0f])\p{Default_Ignorable_Code_Point}/gu;
const LOOSE_JOINER = /(?<![\p{Extended_Pictographic}\p{Emoji_Modifier}]\ufe0f?)\u200d|\u200d(?!\p{Extended_Pictographic})/gu;
const tidy = (s) => String(s ?? '').normalize('NFKC').replace(INVISIBLE, '').replace(LOOSE_JOINER, '').replace(/\s+/g, ' ').trim();
const bytes = (s) => Buffer.byteLength(s, 'utf8');
// anything shaped like a link or an address: a scheme, "www.", any "word.ending" (her reply would turn it into a link),
// a wallet or contract address
const LINK = /[a-z][a-z0-9+.-]*:\/\/|www\.|\bt\.me\b|[\p{L}\p{N}-]\.[a-z]{2,}\b|0x[0-9a-f]{6,}/iu;
// nothing Telegram or a page could turn into a mention, a hashtag or a tappable command ("/" only between letters or numbers)
const ODD = /[#@<>`\\{}[\]|]|(^|[^\p{L}\p{N}])\/|\/($|[^\p{L}\p{N}])/u;
// about her or $AGI (her copies are what she's most careful about): "agi" on its own (numbers and symbols don't hide it:
// "AGI2", "1AGI"), "AGIX"-like, her name, the site; letters from other alphabets read as Latin ones
const ABOUT_HER = /(?<!\p{L})ag[i1](?!\p{L})|agi[\s-]?1|artificial\s*girl\s*friend|agi1\.app/iu;
// "official" anywhere ("OFFICIALDOGE" too): a copy of another coin is fine (the owner, 2026-10-02), but a coin made with her
// is nobody's official one
const OFFICIAL = /official/i;
// money talk and lures she won't repeat in her own words, in a coin's line: buying or selling, promises, airdrops, another
// coin's $TICKER (whole words: "Pumpkin", "Dumpling", "Rugby" and "Scampi" are fine). (Its name and ticker are the
// creator's own words since 2026-10-02, "the name doesnt matter": not checked for it)
const MONEY = /\b(buy(?:s|ing|ers?)?|sell(?:s|ing|ers?)?|pump(?:s|ed|ing|ers?)?|dump(?:s|ed|ing)?|profit\w*|gains?|guarantee\w*|invest\w*|airdrops?|presales?|giveaways?|free\s+money|rug(?:s|ged|pull\w*)?|scam(?:s|mers?|my)?|to\s+the\s+moon|\d+\s*x)\b|\$\s*[a-z]/i;
// a name or a ticker needs at least one letter (any alphabet), number or emoji (a flag too): punctuation alone isn't one
const SOMETHING = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
// A name or a ticker read the way it LOOKS, for "is it AGI?" (since 2026-10-02 a ticker keeps its case and can use any
// alphabet, so "AGl" with a small L, "ÀGI" or "🅰🅶🅸" must not get through): accents and invisible letters gone, look-alike
// letters from other alphabets read as Latin ones (server/lookalike.js), boxed letters (🅰, 🇦) as plain ones; asI also
// reads a small l and a 1 as I
const BOXED = [[0x1f150, 0x1f169], [0x1f170, 0x1f189], [0x1f1e6, 0x1f1ff]];        // negative circled, negative squared, flags' letters
const unbox = (ch) => { const c = ch.codePointAt(0); const r = BOXED.find(([a, b]) => c >= a && c <= b); return r ? String.fromCharCode(65 + c - r[0]) : ch; };
export const plainOf = (s) => asLatin(String(s ?? '').normalize('NFKD').replace(/[\p{M}\p{Default_Ignorable_Code_Point}]/gu, ''))
  .replace(/[\u{1f150}-\u{1f169}\u{1f170}-\u{1f189}\u{1f1e6}-\u{1f1ff}]/gu, unbox);
const asI = (s) => s.replace(/[l1ǀꟾ]/g, 'I');

// A coin idea, as she checks it. → { ok: true, name, symbol, description } (tidied) or { ok: false, why }:
// 'name' · 'symbol' · 'description' · 'link' · 'characters' · 'money' · 'crude' · 'official' · 'agi' · 'egirl' (the keys of
// REFUSE in server/launch-lines.js).
// Since 2026-10-02 (the owner: "the ticker it can be anything and on the name … the name doesnt matter and its okay if its
// a copycat") a name and a ticker can be almost anything: letters from any alphabet, lowercase, numbers, emoji,
// punctuation, and another coin's name or ticker (no search of clank.trade any more). A ticker keeps the case it's typed in
// (a "$" in front is dropped), has no spaces and fits clank.trade's 16 bytes. What stays: PG-13, nothing like her or $AGI
// (a copy of $AGI from her own bot would pass for hers), no egirl coin (her feed texts everyone about new ones: she'd be
// promoting a coin made with her), nothing shaped like a link, an address or an @name, and no trading talk in its line.
export function checkIdea(idea) {
  const name = tidy(idea?.name);
  const symbol = tidy(idea?.symbol).replace(/^\$+/, '');
  const description = tidy(idea?.description);
  if (!name || [...name].length > NAME_MAX || bytes(name) > 64 || !SOMETHING.test(name)) return { ok: false, why: 'name' };
  if (!symbol || bytes(symbol) > SYMBOL_MAX || /\s/.test(symbol) || !SOMETHING.test(symbol)) return { ok: false, why: 'symbol' };
  if ([...description].length > DESC_MAX || bytes(description) > 300) return { ok: false, why: 'description' };
  const all = `${name} ${symbol} ${description}`;
  if (LINK.test(all) || /@[a-z0-9_]{2,}/i.test(all)) return { ok: false, why: 'link' };
  if (ODD.test(all)) return { ok: false, why: 'characters' };
  if (MONEY.test(description)) return { ok: false, why: 'money' };
  if (isCrude(all) || maskSlurs(all) !== all) return { ok: false, why: 'crude' };
  const plain = plainOf(all);
  if (OFFICIAL.test(plain)) return { ok: false, why: 'official' };
  // her or $AGI: as it reads, and with every small l and 1 read as I
  const words = plainOf(`${name} ${description}`), title = plainOf(name), ticker = plainOf(symbol);
  if ([words, asI(words)].some((t) => ABOUT_HER.test(t)) || [title, asI(title)].some((t) => /\bAGI[A-Z]/.test(t) || tickerKey(t) === 'AGI')
    || [ticker, asI(ticker)].some((t) => /^AGI|AGI$/.test(tickerKey(t)))) {
    return { ok: false, why: 'agi' };
  }
  // an egirl or AI-girlfriend coin (her feed would text everyone she's "not ok" about it)
  if (EGIRL.test(plain)) return { ok: false, why: 'egirl' };
  return { ok: true, name, symbol, description };
}

// The links someone adds to their coin on the launch page (optional: X, Telegram, a website; src/launch/links.js tidies
// them and checks their form, the same way as the page) and what she won't put in a coin's record: anything about her or
// $AGI (agi1.app, her X, her bot, "AGI" as a word: a coin must never look like it's hers) or crude words and slurs.
// → { ok: true, links: { twitter, telegram, website } } (each '' when left empty) · { ok: false, field, why: 'format' |
// 'agi' | 'crude' }
const HER_LINK = /(?<!\p{L})ag[i1](?!\p{L})|agi[\s-]?1|artificial\s*girl\s*friend|agi1\.app/iu;
export function checkLinks(input) {
  const c = cleanLinks(input);
  if (!c.ok) return { ok: false, field: c.field, why: 'format' };
  for (const field of LINK_FIELDS) {
    const text = c.links[field].replace(/^https:\/\//, '');
    // (a Telegram invite's code is random letters: nothing to read in it)
    if (!text || /^t\.me\/\+/.test(text)) continue;
    if (isCrude(text) || maskSlurs(text) !== text) return { ok: false, field, why: 'crude' };
    if (HER_LINK.test(asLatin(text.replace(/[/._+-]/g, ' ')))) return { ok: false, field, why: 'agi' };
  }
  return { ok: true, links: c.links };
}

// (Until 2026-10-02 she also searched clank.trade for the ticker and said no to one someone already had: tickerTaken. The
// owner: "its okay if its a copycat". Our risk check still marks a coin whose ticker a bigger coin has as "Copycat?".)

// Telegram sends a photo in several sizes (90 to 2560 px): the biggest up to 1280 px and 1 MB, at least 200 px a side
export function bestPhoto(sizes) {
  const fits = (Array.isArray(sizes) ? sizes : []).filter((p) => {
    const w = Number(p?.width), h = Number(p?.height), id = p?.file_id;
    return typeof id === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(id) && Number.isFinite(w) && Number.isFinite(h)
      && Math.max(w, h) <= 1280 && Math.min(w, h) >= 200 && !(Number(p.file_size) > PICTURE_MAX);
  });
  fits.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  return fits[0]?.file_id ?? null;
}

// ---------- the drafts (supabase/launch.sql) ----------
export const drafts = {
  put: (cfg, { id, chat, name, symbol, description, photo }) => rpc(cfg, 'launch_draft_put', {
    p_id: id, p_chat: chat, p_name: name, p_symbol: symbol, p_desc: description || '', p_photo: photo,
    p_minutes: DRAFT_MINUTES, p_per_chat: DRAFTS_PER_CHAT, p_site_daily: DRAFTS_A_DAY,
  }, 'launch'),
  get: (cfg, id) => rpc(cfg, 'launch_draft_get', { p_id: id }, 'launch'),
  // perDay: the coins this wallet may get ready today (launchesADay)
  prepare: (cfg, id, wallet, perDay) => rpc(cfg, 'launch_prepare', {
    p_id: id, p_wallet: wallet, p_per_wallet: perDay, p_site_daily: cfg.launchDailyCap,
  }, 'launch'),
  uploadBack: (cfg, id) => rpc(cfg, 'launch_upload_back', { p_id: id }, 'launch'),
  setCid: (cfg, id, cid, pin) => rpc(cfg, 'launch_set_cid', { p_id: id, p_cid: cid, p_pin: pin ?? null }, 'launch'),
  // where its coin will be; the same draft got ready again with other details (links, pair) is another coin, counted
  // against perDay → { ok: true } · { ok: false, why: 'wallet_cap' | 'launched' | 'other_wallet' | 'gone' | 'bad' }
  predicted: (cfg, id, wallet, token, perDay) => rpc(cfg, 'launch_predicted', { p_id: id, p_wallet: wallet, p_token: token, p_per_wallet: perDay }, 'launch'),
  done: (cfg, id, wallet, token, tx) => rpc(cfg, 'launch_done', { p_id: id, p_wallet: wallet, p_token: token, p_tx: tx }, 'launch'),
  gasClaim: (cfg, id, wallet, wei) => rpc(cfg, 'launch_gas_claim', {
    p_id: id, p_wallet: wallet, p_wei: wei.toString(), p_per_wallet: GAS_PER_WALLET, p_daily_wei: cfg.launchGasDailyWei.toString(),
  }, 'launch'),
  gasSending: (cfg, id, tx) => rpc(cfg, 'launch_gas_sending', { p_id: id, p_tx: tx }, 'launch'),
  gasSent: (cfg, id, tx, ok) => rpc(cfg, 'launch_gas_sent', { p_id: id, p_tx: tx, p_ok: ok }, 'launch'),
  tidy: (cfg) => rpc(cfg, 'launch_tidy', {}, 'launch'),
  unpinned: (cfg, pins) => rpc(cfg, 'launch_unpinned', { p_pins: pins }, 'launch'),
};

// ---------- the picture ----------
const TELEGRAM = 'https://api.telegram.org/';
// Telegram's copy of a draft's picture (only our bot can read it). → { bytes, type } · null (gone, too big, not a JPEG,
// PNG or WebP) · throws a "telegram:" error when Telegram doesn't answer (never with the bot's token in it)
export async function telegramPicture(token, fileId, { timeoutMs = 8000 } = {}) {
  let res, body;
  try {
    res = await fetch(`${TELEGRAM}bot${token}/getFile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await res.json().catch(() => null);
  } catch (err) {
    throw new Error(`telegram: ${err?.name === 'TimeoutError' ? 'no answer in time' : 'unreachable'}`);
  }
  if (res.status === 400) return null;                       // that file isn't there (any more)
  if (!res.ok || body?.ok !== true) throw new Error(`telegram: getFile HTTP ${res.status}`);
  const path = String(body.result?.file_path ?? '');
  if (!/^[A-Za-z0-9_./-]{1,200}$/.test(path) || path.includes('..') || Number(body.result?.file_size) > PICTURE_MAX) return null;
  let pic;
  try {
    pic = await fetch(`${TELEGRAM}file/bot${token}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`telegram: the picture ${err?.name === 'TimeoutError' ? 'took too long' : "didn't download"}`);
  }
  if (!pic.ok) {
    pic.body?.cancel().catch(() => {});
    if (pic.status === 404) return null;
    throw new Error(`telegram: picture HTTP ${pic.status}`);
  }
  const data = await readLimited(pic, PICTURE_MAX);
  if (!data) return null;
  const type = PICTURE_TYPES.find((t) => looksLike(t, data));
  return type ? { bytes: data, type } : null;
}

const PINATA = 'https://uploads.pinata.cloud/v3/files';
const PINATA_FILES = 'https://api.pinata.cloud/v3/files/public/';
// Puts a picture on public IPFS with Pinata (the owner's free account: PINATA_JWT, needs files:write). → { cid (its IPFS
// id), pin (Pinata's id for the file, to delete it if the coin is never launched; null when Pinata already had that very
// picture, which may be another coin's) } · throws a "pinata:" error
export async function pinPicture(jwt, { bytes: data, type }, name, { timeoutMs = 15000 } = {}) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  if (!ext) throw new Error('pinata: not a picture');
  const form = new FormData();
  form.append('network', 'public');
  form.append('name', name);
  form.append('file', new Blob([data], { type }), `${name}.${ext}`);
  let res;
  try {
    res = await fetch(PINATA, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`pinata: ${err?.name === 'TimeoutError' ? 'no answer in time' : 'unreachable'}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? ' (PINATA_JWT is wrong, or its key may not write files)'
      : res.status === 429 ? ' (too many uploads: Pinata\'s plan limit?)' : '';
    throw new Error(`pinata: HTTP ${res.status}${hint}`);
  }
  const cid = cidOf(`ipfs://${String(body?.data?.cid ?? '')}`);
  if (!cid) throw new Error('pinata: no picture id in its answer');
  const pin = body.data.is_duplicate !== true && /^[A-Za-z0-9_-]{1,100}$/.test(String(body.data.id ?? '')) ? String(body.data.id) : null;
  return { cid, pin };
}
// Deletes a picture we put on Pinata (a coin that was never launched). → true (gone, or wasn't there) · false
export async function unpinPicture(jwt, pin, { timeoutMs = 8000 } = {}) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(pin))) return false;
  try {
    const res = await fetch(`${PINATA_FILES}${pin}`, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(timeoutMs) });
    res.body?.cancel().catch(() => {});
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
// The keep-alive job's tidy-up (3 times a day): old drafts and counts go, and the pictures of coins that were never
// launched are deleted at Pinata (its free plan keeps 500 files). Never a picture whose draft's own launch is on the chain
// (the factory is asked at every address its dry runs gave: a launch nobody read back still keeps its picture). Stops
// starting new work at `deadline`. → how many pictures were deleted · never throws
export async function tidyLaunches(cfg, { env, deadline = Date.now() + 10_000 } = {}) {
  if (!cfg.pinataJwt || !cfg.supabaseUrl || !cfg.supabaseKey) return 0;
  if (Date.now() > deadline - 4000) return 0;                    // (too late in this run: the next one tidies)
  try {
    const { pins } = (await drafts.tidy(cfg)) || {};
    // each picture with every address its draft's launch could have put its coin at (a draft got ready again with other
    // links or the other pair has several: predicted_all, 2026-10-02), at most 50 addresses a run (one batch to the chain;
    // the rest wait for the next run). A picture with an address that isn't one is never deleted.
    const list = [];
    let addresses = 0;
    for (const p of Array.isArray(pins) ? pins : []) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(p?.pin))) continue;
      const at = [...new Set([...(Array.isArray(p.predicted_all) ? p.predicted_all : []), p.predicted].filter((a) => a !== null && a !== undefined))];
      if (!at.every((a) => ADDRESS.test(String(a)))) continue;
      if (list.length >= 50 || addresses + at.length > 50) break;
      list.push({ pin: p.pin, at });
      addresses += at.length;
    }
    if (!list.length) return 0;
    // a coin where any of its draft's launches would be: keep its picture for good
    const asks = list.flatMap((p) => p.at.map((a) => ({ pin: p.pin, a })));
    let live = new Set(), unread = new Set();
    if (asks.length) {
      try {
        const records = await readAll(asks.map((q) => callOf(FACTORY_ABI, FACTORY, 'getLaunchedToken', [q.a])), env, 6000);
        asks.forEach((q, i) => {
          if (records[i]?.exists === true) live.add(q.pin);
          else if (records[i] === null) unread.add(q.pin);
        });
      } catch (err) {
        console.warn(`[launch] tidying up: couldn't ask the factory (${err.message}); those pictures wait for the next run`);
        unread = new Set(asks.map((q) => q.pin));
      }
      for (const pin of live) unread.delete(pin);
    }
    const done = [...live];
    let deleted = 0;
    for (const { pin } of list) {
      if (live.has(pin) || unread.has(pin)) continue;
      if (Date.now() > deadline) break;
      if (await unpinPicture(cfg.pinataJwt, pin, { timeoutMs: 4000 })) { done.push(pin); deleted += 1; }
    }
    if (done.length) await drafts.unpinned(cfg, done);
    if (live.size) console.log(`[launch] tidying up: ${live.size} launch(es) nobody read back are live on the chain; their pictures stay`);
    return deleted;
  } catch (err) {
    if (err.code !== 'PGRST202') console.error('[launch] tidying up failed:', err.message);
    return 0;
  }
}

// ---------- Robinhood Chain ----------
// One JSON-RPC question to the chain's public node (reads; and the gas wallet's payback below). → its result · throws
// "chain:" errors: err.rpc = true when the node answered with an error (err.revert = its data for "execution reverted"),
// err.http = the status when it answered with an HTTP error, neither when it didn't answer clearly (no answer, odd answer)
async function chain(method, params, env, timeoutMs = 6000) {
  let res, data;
  try {
    res = await fetch(rpcUrl(env), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(Math.max(500, timeoutMs)),
    });
  } catch (err) {
    throw new Error(`chain: ${err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'no answer in time' : 'unreachable'}`);
  }
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    const err = new Error(`chain: HTTP ${res.status}`);
    err.http = res.status;
    throw err;
  }
  try {
    data = await readLimited(res, 1_000_000);
  } catch (err) {
    throw new Error(`chain: ${err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'no answer in time' : 'the answer broke off'}`);
  }
  if (!data) throw new Error('chain: answer too big');
  let answer;
  try { answer = JSON.parse(data.toString('utf8')); } catch { throw new Error('chain: answer is not JSON'); }
  if (answer?.error) {
    const err = new Error(`chain: ${String(answer.error.message || 'error').slice(0, 160)}`);
    err.rpc = true;
    const raw = typeof answer.error.data === 'string' ? answer.error.data : answer.error.data?.data;
    if (answer.error.code === 3 || /revert/i.test(String(answer.error.message))) {
      err.revert = typeof raw === 'string' && /^0x[0-9a-fA-F]*$/.test(raw) ? raw.toLowerCase() : '0x';
    }
    throw err;
  }
  if (!answer || typeof answer !== 'object' || !('result' in answer)) throw new Error('chain: unexpected answer');
  return answer.result;
}
const ethCall = (to, data, env, extra = {}, timeoutMs) => chain('eth_call', [{ ...extra, to, data }, 'latest'], env, timeoutMs);

// clank.trade's launch terms now, for this wallet and this pair: whether it may launch (canLaunch: the docs' "new launches
// are currently disabled" switch), its launch fee (wei: 0 today), whether the pair is on its approved list (ETH always is;
// approvedPairTokens for SPCX) and the economics hash its docs say to pin for that pair, so a change of terms between the
// dry run and the wallet makes the launch fail instead of changing silently.
// → { open, fee, approved, economics (null when the pair isn't approved) }
export async function launchTerms(wallet, env, pair = ZERO) {
  const ask = (functionName, args) => ethCall(FACTORY, encodeFunctionData({ abi: LAUNCH_ABI, functionName, args }), env);
  const read = (functionName, data) => {
    try { return decodeFunctionResult({ abi: LAUNCH_ABI, functionName, data }); } catch { throw new Error('chain: odd launch terms'); }
  };
  const token = pair !== ZERO;
  const [openHex, feeHex, econ, approvedHex] = await Promise.all([
    ask('canLaunch', [wallet]), ask('launchFee'),
    // (for a pair the factory doesn't take, this may be its "no": the approved list decides, below)
    ask('previewLaunchEconomics', [LAUNCH_CONFIG, pair]).then((hex) => ({ hex }), (err) => (token && err.revert !== undefined ? { err } : Promise.reject(err))),
    token ? ask('approvedPairTokens', [pair]) : null,
  ]);
  const open = read('canLaunch', openHex), fee = read('launchFee', feeHex);
  const approved = token ? read('approvedPairTokens', approvedHex) : true;
  if (typeof open !== 'boolean' || typeof fee !== 'bigint' || fee < 0n || typeof approved !== 'boolean') throw new Error('chain: odd launch terms');
  if (!approved) return { open, fee, approved, economics: null };
  // on its list, but the factory won't give its terms on launch config 0 (another config for it, say): not offered here
  if (econ.err) {
    console.warn(`[launch] clank.trade lists ${pair} as a pair but won't give its launch terms on config 0 (${econ.err.message}): launches wait for an update`);
    return { open, fee, approved: false, economics: null };
  }
  const economics = read('previewLaunchEconomics', econ.hex);
  if (typeof economics !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(economics)) throw new Error('chain: odd launch terms');
  return { open, fee, approved, economics: economics.toLowerCase() };
}

// The salt clank.trade's docs ask the creator to pick: one per draft, so the same draft can't be launched twice by the same
// wallet (the factory refuses: LaunchAlreadyExists)
export const saltFor = (id) => keccak256(toBytes(`agi1-launch:${id}`));

// clank.trade's launch, for their wallet to send: the factory's launchToken with the draft, its picture on IPFS, no
// creator tax and no buyback (the factory requires both), their wallet as the creator fee's recipient (nothing today), no
// links of anyone's, paired with ETH (or the pair they picked: PAIRS) on launch config 0, and no ETH sent.
// → { to, data, value }
export function launchCall({ id, name, symbol, description = '', cid, wallet, economics, links = {}, pair = ZERO }) {
  const params = {
    name, symbol, logo: `ipfs://${cid}`, description,
    // the links they added (checked by checkLinks: X, Telegram, a website, or ''); Discord and Farcaster stay empty
    socials: { twitter: links.twitter || '', telegram: links.telegram || '', discord: '', website: links.website || '', farcaster: '' },
    creatorFeeRecipient: wallet, creatorTaxBps: 0, buybackEnabled: false,
    expectedEconomics: economics, salt: saltFor(id),
  };
  if (!Object.values(PAIRS).includes(pair)) throw new Error('not a pair clank.trade offers');
  return { to: FACTORY, data: encodeFunctionData({ abi: LAUNCH_ABI, functionName: 'launchToken', args: [params, LAUNCH_CONFIG, pair] }), value: '0x0' };
}

// The launch tried on the chain first, from their wallet, exactly as their wallet will send it ("simulate the exact call
// before opening the wallet", the docs). → { ok: true, token, curve } (where the coin will be) or { ok: false, why: 'exists' |
// 'economics' | 'metadata' | 'closed' | 'config' | 'fee' | 'pair' | 'reverted' } · throws "chain:"
export async function tryLaunch(call, wallet, env) {
  let hex;
  try {
    hex = await ethCall(call.to, call.data, env, { from: wallet, value: call.value }, 8000);
  } catch (err) {
    if (err.revert !== undefined) return { ok: false, why: ERRORS[err.revert.slice(0, 10)] ?? 'reverted' };
    throw err;
  }
  try {
    const [token, curve] = decodeFunctionResult({ abi: LAUNCH_ABI, functionName: 'launchToken', data: hex });
    return { ok: true, token: token.toLowerCase(), curve: curve.toLowerCase() };
  } catch {
    throw new Error('chain: odd answer to the launch');
  }
}

const topicAddress = (t) => (typeof t === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(t) ? `0x${t.slice(26).toLowerCase()}` : null);
const ADDRESS = /^0x[0-9a-f]{40}$/;
// Every contract a transaction's logs name (the new coin is one: its first transfer, the factory's TokenLaunched…), at most
// `max`. (The docs don't spell out TokenLaunched's fields, so it isn't decoded: the factory's own record decides, below.)
export function namedIn(receipt, wallet, max = 8) {
  const me = String(wallet).toLowerCase();
  const seen = new Set();
  for (const log of Array.isArray(receipt?.logs) ? receipt.logs : []) {
    if (!log || log.removed === true) continue;
    for (const a of [String(log.address || '').toLowerCase(), ...(Array.isArray(log.topics) ? log.topics.slice(1).map(topicAddress) : [])]) {
      if (a && ADDRESS.test(a) && a !== FACTORY && a !== me && a !== ZERO) seen.add(a);
    }
  }
  return [...seen].slice(0, max);
}
// The coin a launch transaction made for this wallet, as clank.trade's docs say to check it ("verify the launch record from
// the factory"): the factory's getLaunchedToken for each contract the transaction named, in one request; the one it made,
// with this wallet as its creator. → { token, curve } or null · throws "chain:" when the chain doesn't answer
export async function launchedBy(receipt, wallet, env, predicted = null) {
  const me = String(wallet).toLowerCase();
  // (where its dry run said the coin would be goes first, when this transaction names it, however many others it names)
  const all = namedIn(receipt, me, 256);
  const p = String(predicted || '');
  const named = (all.includes(p) ? [p, ...all.filter((a) => a !== p)] : all).slice(0, 8);
  if (!named.length) return null;
  const records = await readAll(named.map((a) => callOf(FACTORY_ABI, FACTORY, 'getLaunchedToken', [a])), env, 6000);
  for (let i = 0; i < named.length; i++) {
    const r = records[i];
    if (r?.exists === true && String(r.launchToken).toLowerCase() === named[i] && String(r.deployer).toLowerCase() === me && ADDRESS.test(String(r.curve).toLowerCase())) {
      return { token: named[i], curve: String(r.curve).toLowerCase() };
    }
  }
  return null;
}
// Is this transaction's call the draft's own launch? clank.trade's launchToken with exactly this draft's name, ticker, line
// and picture, nobody's links, no tax, no buyback, this wallet as the creator, ETH or SPCX (a pair the page offers) on
// config 0, and this draft's own salt (so one launch can only ever be one draft's, and a launch with other details is
// never "this coin")
// A launch's links as this site makes them: Discord and Farcaster empty, the others '' or a link exactly as checkLinks
// writes it (a launch with links the page could never make isn't this draft's)
function socialsAsWeMakeThem(s) {
  if (!s || typeof s !== 'object' || s.discord !== '' || s.farcaster !== '') return false;
  if (!LINK_FIELDS.every((f) => typeof s[f] === 'string')) return false;
  const c = checkLinks({ twitter: s.twitter, telegram: s.telegram, website: s.website });
  return c.ok && LINK_FIELDS.every((f) => c.links[f] === s[f]);
}
export function isDraftLaunch(input, { id, name, symbol, description = '', cid }, wallet) {
  let call;
  try { call = decodeFunctionData({ abi: LAUNCH_ABI, data: input }); } catch { return false; }
  if (call.functionName !== 'launchToken') return false;
  const [p, config, pair] = call.args;
  return config === LAUNCH_CONFIG && Object.values(PAIRS).includes(String(pair).toLowerCase()) && p.name === name && p.symbol === symbol
    && p.description === (description || '') && p.logo === `ipfs://${cid}` && socialsAsWeMakeThem(p.socials)
    && String(p.creatorFeeRecipient).toLowerCase() === String(wallet).toLowerCase() && p.creatorTaxBps === 0 && p.buybackEnabled === false
    && String(p.salt).toLowerCase() === saltFor(id);
}
// Their launch, read back from the chain: this draft's own launch (its transaction's call), by this wallet, sent to
// clank.trade's factory, and the coin it made as the factory records it. → { ok: true, token, curve, from (who sent it),
// fee (what it cost them, wei, or null when the receipt doesn't say) } or { ok: false, why: 'pending' (not on the chain
// yet) | 'failed' | 'not_launch' (not this draft's launch by this wallet) } · throws "chain:"
export async function readLaunch(tx, wallet, draft, env) {
  const me = String(wallet).toLowerCase();
  const [receipt, sent] = await Promise.all([chain('eth_getTransactionReceipt', [tx], env), chain('eth_getTransactionByHash', [tx], env)]);
  if (receipt === null) return { ok: false, why: 'pending' };
  if (!receipt || typeof receipt !== 'object' || String(receipt.transactionHash || '').toLowerCase() !== tx) throw new Error('chain: unexpected receipt');
  let status;
  try { status = BigInt(receipt.status); } catch { throw new Error('chain: a receipt without its status'); }
  if (status !== 1n) return { ok: false, why: 'failed' };
  if (!sent || typeof sent !== 'object' || String(sent.hash || '').toLowerCase() !== tx) throw new Error('chain: unexpected transaction');
  // sent by this wallet to clank.trade's factory itself (not through another contract), with no ETH, and its call is this draft's
  let value;
  try { value = BigInt(sent.value ?? 0); } catch { value = -1n; }
  if (String(receipt.to || '').toLowerCase() !== FACTORY || String(sent.to || '').toLowerCase() !== FACTORY
    || String(sent.from || '').toLowerCase() !== me || String(receipt.from || '').toLowerCase() !== me || value !== 0n
    || !isDraftLaunch(String(sent.input ?? sent.data ?? ''), draft, me)) {
    return { ok: false, why: 'not_launch' };
  }
  const found = await launchedBy(receipt, me, env, draft.predicted);
  if (!found) return { ok: false, why: 'not_launch' };
  let fee = null;
  try { fee = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice); } catch { /* an older receipt: unknown */ }
  return { ok: true, ...found, from: String(receipt.from || '').toLowerCase(), fee: fee !== null && fee > 0n ? fee : null };
}

// ---------- their network fee, paid back (the owner's gas wallet) ----------
export const gasOn = (cfg) => Boolean(cfg.launchGasKey);
// The owner's gas wallet: its address, to show the owner what to fund (never its key)
export const gasWallet = (cfg) => (cfg.launchGasKey ? privateKeyToAccount(cfg.launchGasKey).address.toLowerCase() : null);

// The payback, so that a hiccup before anything is claimed costs nobody their payback, and nothing is ever sent twice:
// gasPlan reads the gas wallet's numbers (nothing claimed or sent yet), payGasBack claims the payback in the database, and
// sendPlanned signs it, marks it "sending" with that very transaction (so a later check can find it on the chain) and sends
// it. Only a clear "no" from the chain gives a payback back; anything unclear leaves it "sending".
const PLAN_MS = 4000;          // the plan's reads (all at once)
const SEND_MS = 12_000;        // what's needed after the plan: the claim, marking it, the send, once more with the next nonce
const GAS_CAP = 300_000n;      // a plain ETH payment needs far less, even with Robinhood Chain's data fee
const TXHASH = /^0x[0-9a-f]{64}$/;
// the node's clear "no" to a transaction (nothing went out). Anything else after it was handed over counts as sent.
const REFUSED = /nonce too low|replacement transaction underpriced|transaction underpriced|insufficient funds|intrinsic gas too low|max fee per gas less than block base fee|fee cap less than block base fee|exceeds block gas limit|gas limit reached|invalid sender|exceeds the configured cap|invalid chain id/i;
// its nonce is taken (by another payback, or by one of this payback's own transactions: a node that lost its own answer)
const NONCE_TAKEN = /nonce too low|replacement transaction underpriced/i;

// The gas wallet's numbers for sending `value` wei to `to`. → { ok: true, plan } · { ok: false, why: 'empty' (it can't pay
// that much plus the network fee) | 'contract' (the creator's wallet has code: a smart account, which could make the
// payback cost a lot or refuse it) } · throws "chain:" (nothing claimed or sent: the next check tries again)
export async function gasPlan(key, to, value, env, timeoutMs = PLAN_MS) {
  const from = privateKeyToAccount(key).address;
  const asked = await Promise.allSettled([
    chain('eth_getBalance', [from, 'latest'], env, timeoutMs),
    chain('eth_gasPrice', [], env, timeoutMs),
    chain('eth_getTransactionCount', [from, 'pending'], env, timeoutMs),
    chain('eth_estimateGas', [{ from, to, value: toHex(value) }], env, timeoutMs),
    chain('eth_getCode', [to, 'latest'], env, timeoutMs),
  ]);
  const failed = asked.find((a) => a.status === 'rejected');
  if (failed) {
    if (failed.reason?.rpc && /insufficient funds/i.test(failed.reason.message)) return { ok: false, why: 'empty' };
    throw failed.reason;
  }
  const [balanceHex, priceHex, nonceHex, gasHex, code] = asked.map((a) => a.value);
  if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code)) throw new Error('chain: odd code answer');
  if (code !== '0x') return { ok: false, why: 'contract' };
  let balance, maxFee, nonce, gas;
  try {
    balance = BigInt(balanceHex);
    maxFee = BigInt(priceHex) * 2n;                    // room for the price to rise before it's in a block
    nonce = Number(BigInt(nonceHex));
    gas = (BigInt(gasHex) * 12n) / 10n;
  } catch {
    throw new Error('chain: odd numbers for the payback');
  }
  if (maxFee <= 0n || gas <= 0n || !Number.isSafeInteger(nonce) || nonce < 0) throw new Error('chain: odd numbers for the payback');
  if (gas > GAS_CAP) throw new Error(`chain: a payment would need ${gas} gas (at most ${GAS_CAP})`);
  if (balance < value + gas * maxFee) return { ok: false, why: 'empty' };
  return { ok: true, plan: { to, value, nonce, gas, maxFee } };
}

// Signs and sends a planned payback by `deadline` (ms); mark(hash) records each transaction before it goes out (anything but
// true: it isn't sent). → { ok: true, tx } (sent, or handed over without a clear "no": never sent again) · { ok: false, why:
// 'empty' | 'failed' } (the chain clearly refused it: nothing went out) · { ok: false, why: 'unsure' } (whether one went out
// can't be told: it stays "sending", and becomes "stuck") · { ok: false, why: 'unmarked' } (nothing was sent: it couldn't be
// recorded first)
export async function sendPlanned(key, plan, env, { deadline = Date.now() + SEND_MS, mark = async () => true } = {}) {
  const account = privateKeyToAccount(key);
  let { nonce } = plan;
  const signed = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await account.signTransaction({
      chainId: CHAIN_ID, type: 'eip1559', to: plan.to, value: plan.value, nonce, gas: plan.gas, maxFeePerGas: plan.maxFee, maxPriorityFeePerGas: 0n,
    });
    const hash = keccak256(raw);
    let marked = false;
    try { marked = (await mark(hash)) === true; } catch { marked = false; }
    if (!marked) return attempt === 0 ? { ok: false, why: 'unmarked' } : { ok: false, why: 'failed' };
    signed.push(hash);
    try {
      const sent = await chain('eth_sendRawTransaction', [raw], env, Math.max(1000, Math.min(6000, deadline - Date.now() - 1000)));
      return { ok: true, tx: typeof sent === 'string' && /^0x[0-9a-fA-F]{64}$/.test(sent) ? sent.toLowerCase() : hash };
    } catch (err) {
      if (err.rpc && /already known|known transaction/i.test(err.message)) return { ok: true, tx: hash };
      const refused = (err.rpc && REFUSED.test(err.message)) || (err.http >= 400 && err.http < 500);
      // no clear "no" (it may be on its way): counted as sent, never sent again
      if (!refused) return { ok: true, tx: hash };
      if (!NONCE_TAKEN.test(err.message)) return { ok: false, why: /insufficient funds/i.test(err.message) ? 'empty' : 'failed' };
      // its nonce is taken: first ask the chain about every transaction signed for this payback
      let known, next;
      try {
        [known, next] = await Promise.all([
          Promise.all(signed.map((h) => chain('eth_getTransactionByHash', [h], env, 2500))),
          chain('eth_getTransactionCount', [account.address, 'pending'], env, 2500),
        ]);
      } catch {
        return { ok: false, why: 'unsure' };
      }
      const found = signed.find((h, i) => known[i]);
      if (found) return { ok: true, tx: found };
      // none of them went out (their nonce is someone else's now): once more with the next nonce, while there's time
      if (attempt === 0 && deadline - Date.now() > 5000) {
        try { nonce = Number(BigInt(next)); } catch { return { ok: false, why: 'failed' }; }
        if (Number.isSafeInteger(nonce) && nonce >= 0) continue;
      }
      return { ok: false, why: 'failed' };
    }
  }
  return { ok: false, why: 'failed' };
}

const emptyNote = (cfg) => console.warn(`[launch] the gas wallet ${gasWallet(cfg)} is out of ETH: top it up to pay launch fees back`);
// A payback the database already has an answer for (supabase/launch.sql launch_gas_claim: "used", or a cap)
function settled(claim) {
  const why = String(claim?.why || 'busy');
  if (why === 'used') {
    if (claim.state === 'sent' && /^0x[0-9a-f]{64}$/.test(String(claim.tx))) return { paid: true, wei: String(claim.wei), tx: claim.tx };
    if (claim.state === 'skipped') return { paid: false, why: claim.reason === 'site_cap' ? 'site_cap' : 'wallet_cap' };
    return { paid: false, why: claim.stuck === true ? 'stuck' : 'pending' };
  }
  return { paid: false, why: why === 'wallet_cap' || why === 'site_cap' ? why : 'busy' };
}
// What the draft already says about its payback (supabase/launch.sql launch_draft_get) → the answer, or null (nothing yet)
export function gasSoFar(d) {
  if (d?.gas_state === 'sent' && /^0x[0-9a-f]{64}$/.test(String(d.gas_tx))) return { paid: true, wei: String(d.gas_wei), tx: d.gas_tx };
  if (d?.gas_state === 'skipped') return { paid: false, why: d.gas_why === 'site_cap' ? 'site_cap' : 'wallet_cap' };
  if (d?.gas_state === 'sending' && d.gas_stuck === true) return { paid: false, why: 'stuck' };
  if (d?.gas_state === 'claimed' || d?.gas_state === 'sending') return { paid: false, why: 'pending' };
  return null;
}
// a payback that's settled for good (nothing more to try)
export const gasFinal = (g) => Boolean(g && (g.paid === true || ['off', 'not_sender', 'unknown', 'contract', 'wallet_cap', 'site_cap', 'stuck'].includes(g.why)));

// Pays a launch's network fee back to its creator, once. → { paid: true, wei (string), tx } · { paid: false, why }:
//   final: 'off' · 'not_sender' (another wallet sent it) · 'unknown' (the receipt doesn't say the fee) · 'contract' (a
//          smart account) · 'wallet_cap' (one a day per wallet) · 'site_cap' (LAUNCH_GAS_DAILY): a payback skipped for a
//          cap stays skipped · 'stuck' (it was being sent over 2 minutes ago and never said how it went: it may have gone
//          out, so never again)
//   later: 'busy' (a hiccup: nothing claimed) · 'pending' (another check is paying it right now) · 'empty' (the gas wallet
//          is out of ETH) · 'failed' (the chain refused it: nothing went out, so a later check tries again)
// deadline (ms): when this request must be done; the payback only starts when there's time to finish it.
export async function payGasBack(cfg, { id, code, wallet, from, fee, env, deadline = Date.now() + PLAN_MS + SEND_MS + 2000 }) {
  if (!gasOn(cfg)) return { paid: false, why: 'off' };
  if (from !== String(wallet).toLowerCase()) return { paid: false, why: 'not_sender' };
  if (typeof fee !== 'bigint' || fee <= 0n) return { paid: false, why: 'unknown' };
  const wei = fee < cfg.launchGasMaxWei ? fee : cfg.launchGasMaxWei;
  // 1. the gas wallet's numbers (nothing claimed yet)
  const forPlan = Math.min(PLAN_MS, deadline - Date.now() - SEND_MS);
  if (forPlan < 1500) return { paid: false, why: 'busy' };
  let plan;
  try { plan = await gasPlan(cfg.launchGasKey, wallet, wei, env, forPlan); } catch (err) {
    console.warn(`[launch] paying a fee back: couldn't read the gas wallet (${err.message}); the next check tries again`);
    return { paid: false, why: 'busy' };
  }
  if (!plan.ok) {
    if (plan.why === 'empty') emptyNote(cfg);
    return { paid: false, why: plan.why };
  }
  // 2. claimed in the database: once per coin, inside the caps (two checks at the same moment can't both pay)
  let claim;
  try { claim = await drafts.gasClaim(cfg, id, code, wei); } catch (err) {
    console.error('[launch] paying a fee back: the database refused:', err.message);
    return { paid: false, why: 'busy' };
  }
  if (claim?.ok !== true) {
    // one being sent: its transaction may be on the chain by now (then it's sent, for good)
    if (claim?.why === 'used' && claim.state === 'sending' && TXHASH.test(String(claim.tx))) {
      let known = null;
      try { known = await chain('eth_getTransactionByHash', [claim.tx], env, 2500); } catch { /* can't tell yet */ }
      if (known) {
        try { await drafts.gasSent(cfg, id, claim.tx, true); } catch (err) { console.error('[launch] keeping a payback that went out failed:', err.message); }
        return { paid: true, wei: String(claim.wei), tx: claim.tx };
      }
    }
    return settled(claim);
  }
  // 3. signed, marked "sending" with that transaction, and sent (a claim that never gets marked is given back by itself
  // after 2 minutes)
  const sent = await sendPlanned(cfg.launchGasKey, plan.plan, env, { deadline, mark: (tx) => drafts.gasSending(cfg, id, tx) });
  // 4. kept: sent (with its transaction), or given back when nothing went out (a later check tries again); left "sending"
  // when it can't be told
  if (sent.ok || ['empty', 'failed', 'unmarked'].includes(sent.why)) {
    try { await drafts.gasSent(cfg, id, sent.ok ? sent.tx : null, sent.ok); } catch (err) {
      console.error(`[launch] keeping how a payback went failed (${sent.ok ? `sent: ${sent.tx}` : 'nothing went out'}):`, err.message);
    }
  }
  if (sent.ok) return { paid: true, wei: wei.toString(), tx: sent.tx };
  if (sent.why === 'unsure') {
    console.warn('[launch] a payback\'s nonce was taken and the chain couldn\'t say by what: it stays "sending" (never sent again)');
    return { paid: false, why: 'pending' };
  }
  if (sent.why === 'unmarked') return { paid: false, why: 'busy' };
  if (sent.why === 'empty') emptyNote(cfg);
  else console.warn('[launch] the chain refused a payback (nothing went out); the next check tries again');
  return { paid: false, why: sent.why };
}

// The payback of a launched draft, from its own launch transaction (kept when the launch was read back), so reopening its
// page later can still get it paid: to the coin's creator only, whoever asks. → as payGasBack · throws "chain:"
export async function paybackFor(cfg, d, { env, deadline } = {}) {
  if (!gasOn(cfg)) return { paid: false, why: 'off' };
  if (!d?.token || !/^0x[0-9a-f]{64}$/.test(String(d.launch_tx))) return { paid: false, why: 'busy' };
  const receipt = await chain('eth_getTransactionReceipt', [d.launch_tx], env);
  if (!receipt || String(receipt.transactionHash || '').toLowerCase() !== d.launch_tx) throw new Error('chain: its launch\'s receipt is missing');
  const from = String(receipt.from || '').toLowerCase();
  if (!ADDRESS.test(from) || launchWallet(cfg.passSecret, from) !== d.wallet) return { paid: false, why: 'not_sender' };
  let fee = null;
  try { fee = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice); } catch { /* unknown */ }
  return payGasBack(cfg, { id: d.id, code: d.wallet, wallet: from, from, fee, env, deadline });
}
