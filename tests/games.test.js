// Her quizzes in her Telegram groups and their prizes (2026-10-09, the owner: "can i add games on the tg bot like riddles,
// questions, if the person in that telegram group answered correctly they will get a small amount of $AGI, they will reply
// with their address and get it"; server/games.js, server/game-prizes.js, server/game-questions.js, server/game-lines.js,
// server/secrets.js, supabase/games.sql). With fake Telegram, Supabase (games.sql's rules, in JavaScript: the SQL itself
// ran in PGlite) and Robinhood Chain.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTransaction, decodeFunctionData, parseAbi, keccak256, getAddress } from 'viem';
import { privateKeyToAccount, generateMnemonic, english } from 'viem/accounts';
import { QUESTIONS, Q_MAX, A_MAX, WHY_MAX, byId } from '../server/game-questions.js';
import * as G from '../server/game-lines.js';
import {
  gamesOn, prizesOn, gapMinutes, pickQuestion, shuffled, safeName, gamesTick, onPollAnswer, onPollState, settleGame, gameKey,
  forgetGames, targetsOf,
} from '../server/games.js';
import { prizeWallet, addressIn, checkAddress, forgetPrizes, BURN, ZERO } from '../server/game-prizes.js';
import { secretIn, SECRET_WARNING } from '../server/secrets.js';
import { handleUpdate, UPDATE_TYPES, COMMANDS, commandsFor, connectBot } from '../server/telegram.js';
import { forgetGroups } from '../server/tg-groups.js';
import { GROUP_MUSIC } from '../server/tg-music.js';
import { questionTrouble } from '../server/live.js';
import { REFUSE as LIVE_REFUSE } from '../server/live-lines.js';
import { askError } from '../src/live/words.js';
import { getConfig } from '../server/config.js';
import { isCrude } from '../server/coins.js';
import { telegramBurst } from '../server/burst.js';
import { _resetChainCache } from '../server/chain.js';
import { GET as feed } from '../api/feed.js';
import * as L from '../server/tg-lines.js';

const TOKEN = `123456789:AA${'x'.repeat(33)}`;
const KEY = 'c0ffee12'.repeat(8);                       // the database's key (64 hex characters, as games.sql makes it)
const OFFICIAL = '0xfa31d04462746aaa24bc7e5626403e09e4b106ec';
const PRIZE_KEY = `0x${'59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'}`;
const PRIZE_WALLET = privateKeyToAccount(PRIZE_KEY).address.toLowerCase();
const GAS_KEY = `0x${'8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'}`;
const GROUP_ID = -1001234567890;
const PUBLIC_ID = -1001111111111;                        // the id Telegram gives @agi2dotapp
const PERSON = 4242;                                     // a winner's Telegram id (her private chat's id is theirs)
const WINNER = '0x8ba1f109551bd432803012645ac136ddd64dba72';
const E18 = 10n ** 18n;
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const ENV = {
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: 'test-pass-secret-that-is-long-enough-1234',
  TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_GROUPS: '@agi2dotapp, -1001234567890', VITE_TELEGRAM_BOT: 'agi1_appbot', PRIZE_WALLET_KEY: PRIZE_KEY,
};
const TRANSFER = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const pad = (n) => n.toString(16).padStart(64, '0');
const today = () => new Date().toISOString().slice(0, 10);

// ---------- the database: games.sql's (and telegram.sql's) rules, in JavaScript ----------
function database() {
  const now = () => Date.now();
  const TARGET = /^(@[a-z0-9_]{4,32}|-[0-9]{5,20})$/;
  return {
    key: KEY, recent: [], groups: new Map(), rounds: [], answers: [], prizes: [], days: new Map(), friends: new Map(), id: 0, pid: 0,
    // telegram.sql: her private chat
    tg_get({ p_chat }) { return this.friends.get(p_chat) ?? null; },
    tg_join({ p_chat }) { if (!this.friends.has(p_chat)) this.friends.set(p_chat, { chat: p_chat, adult: false, tz_minutes: null }); return true; },
    tg_set({ p_chat, p_adult, p_tz }) {
      const r = this.friends.get(p_chat);
      if (r && p_adult !== null) r.adult = p_adult;
      if (r && p_tz !== null) r.tz_minutes = p_tz;
      return true;
    },
    tg_forget({ p_chat }) { this.friends.delete(p_chat); return true; },
    chat_take() { return 'ok'; },
    tg_take() { return true; },
    tg_group_take() { return 'ok'; },
    // games.sql
    game_key() { return this.key; },
    game_due({ p_target, p_minutes }) {
      if (!TARGET.test(String(p_target)) || !(p_minutes >= 10 && p_minutes <= 1440)) return false;
      if (!this.groups.has(p_target)) { this.groups.set(p_target, now() + 45 * 60_000); return false; }
      if (this.groups.get(p_target) > now()) return false;
      this.groups.set(p_target, now() + p_minutes * 60_000);
      return true;
    },
    game_left({ p_cap }) { return Math.max(0, p_cap - (this.days.get(today()) ?? 0)); },
    game_recent() { return [...this.recent]; },
    game_open({ p_chat, p_message, p_poll, p_question, p_correct, p_answer, p_prize, p_seconds }) {
      if (!(p_chat < 0) || !(p_message > 0) || !/^.{1,64}$/.test(p_poll) || !/^[a-z0-9-]{2,24}$/.test(p_question) || !(p_correct >= 0 && p_correct <= 9)
        || !p_answer || p_answer.length > 100 || typeof p_prize !== 'boolean' || !(p_seconds >= 30 && p_seconds <= 900)) return null;
      if (this.rounds.some((r) => r.poll === p_poll)) return null;
      const r = { id: ++this.id, chat: p_chat, message_id: p_message, poll: p_poll, question: p_question, correct: p_correct, answer: p_answer,
        prize: p_prize, opened: now(), closes: now() + p_seconds * 1000, settled: null, winners: null, prize_id: null };
      this.rounds.push(r);
      this.recent = [...this.recent.filter((q) => q !== p_question), p_question].slice(-60);
      return r.id;
    },
    game_answer({ p_poll, p_person, p_name, p_option }) {
      if (!/^.{1,64}$/.test(String(p_poll)) || !(p_person > 0) || !p_name || [...p_name].length > 32 || !(p_option >= 0 && p_option <= 9)) return 'bad';
      const r = this.rounds.find((x) => x.poll === p_poll);
      if (!r) return 'unknown';
      if (r.settled || now() > r.closes + 15_000) return 'closed';
      if (this.answers.some((a) => a.round_id === r.id && a.person === p_person)) return 'again';
      this.answers.push({ round_id: r.id, person: p_person, name: p_name, correct: p_option === r.correct, at: now() });
      return 'ok';
    },
    game_settle({ p_poll, p_cap, p_amount }) {
      if (!(p_amount > 0 && p_amount <= 1e6) || !(p_cap >= 0)) return { ok: false, why: 'bad' };
      const r = this.rounds.find((x) => x.poll === p_poll);
      if (!r) return { ok: false, why: 'unknown' };
      if (r.settled) return { ok: false, why: 'settled' };
      if (r.closes > now() + 5000) return { ok: false, why: 'open' };
      r.settled = now();
      const right = this.answers.filter((a) => a.round_id === r.id && a.correct);
      let why = null, winner = null;
      if (!right.length) why = 'none';
      else if (!r.prize) why = 'no_prize';
      else if ((this.days.get(today()) ?? 0) >= p_cap) why = 'cap';
      else {
        const free = right.filter((a) => !this.prizes.some((p) => p.person === a.person && p.day === today()));
        if (!free.length) why = 'all_won';
        else {
          const w = free[Math.floor(Math.random() * free.length)];
          const p = { id: ++this.pid, round_id: r.id, person: w.person, amount: p_amount, state: 'won', address: null, tx: null, won: now(),
            day: today(), expires: now() + 24 * 3600_000, claimed: null, sent: null };
          this.prizes.push(p);
          this.days.set(today(), (this.days.get(today()) ?? 0) + 1);
          winner = { person: w.person, name: w.name, prize: p.id, amount: p_amount };
          r.prize_id = p.id;
        }
      }
      r.winners = right.length;
      return { ok: true, chat: r.chat, message_id: r.message_id, answer: r.answer, right: right.length, why, winner };
    },
    game_unsettled() { return this.rounds.filter((r) => !r.settled && r.closes < now() - 20_000).sort((a, b) => a.closes - b.closes).slice(0, 10).map((r) => r.poll); },
    game_pending({ p_person }) {
      if (!(p_person > 0)) return null;
      for (const p of this.prizes) if (p.person === p_person && ['won', 'confirming'].includes(p.state) && p.expires <= now()) p.state = 'expired';
      const open = (p) => ['won', 'confirming', 'claimed', 'sending'].includes(p.state);
      const mine = this.prizes.filter((p) => p.person === p_person && (open(p) || p.won > now() - 2 * 86_400_000))
        .sort((a, b) => (open(b) - open(a)) || (open(a) ? a.won - b.won : b.won - a.won));
      const v = mine[0];
      return v ? { id: v.id, amount: v.amount, state: v.state, address: v.address, tx: v.tx, expires: v.expires, claimed: v.claimed, sent: v.sent } : null;
    },
    game_address({ p_prize, p_person, p_address }) {
      if (!/^0x[0-9a-f]{40}$/.test(String(p_address).toLowerCase())) return false;
      const p = this.prizes.find((x) => x.id === p_prize && x.person === p_person && ['won', 'confirming'].includes(x.state) && x.expires > now());
      if (!p) return false;
      Object.assign(p, { address: p_address.toLowerCase(), state: 'confirming', expires: Math.max(p.expires, now() + 7 * 86_400_000) });
      return true;
    },
    game_claim({ p_prize, p_person }) {
      const p = this.prizes.find((x) => x.id === p_prize && x.person === p_person);
      if (p && p.address && ((p.state === 'confirming' && p.expires > now()) || (p.state === 'claimed' && p.claimed < now() - 120_000))) {
        Object.assign(p, { state: 'claimed', claimed: now() });
        return { ok: true, address: p.address, amount: p.amount };
      }
      if (!p) return { ok: false, why: 'unknown' };
      return { ok: false, tx: p.tx, amount: p.amount, why: ['won', 'confirming'].includes(p.state) && p.expires <= now() ? 'expired' : p.state };
    },
    game_sending({ p_prize, p_tx }) {
      const p = this.prizes.find((x) => x.id === p_prize && ['claimed', 'sending'].includes(x.state));
      if (!/^0x[0-9a-f]{64}$/.test(String(p_tx)) || !p) return false;
      Object.assign(p, { state: 'sending', tx: p_tx });
      return true;
    },
    game_sent({ p_prize, p_tx, p_ok }) {
      const p = this.prizes.find((x) => x.id === p_prize);
      if (!p) return false;
      if (p_ok) {
        if (!/^0x[0-9a-f]{64}$/.test(String(p_tx)) || !['claimed', 'sending'].includes(p.state)) return false;
        Object.assign(p, { state: 'sent', tx: p_tx, sent: now() });
        return true;
      }
      if (!(['claimed', 'sending'].includes(p.state) || (p.state === 'sent' && p_tx && p.tx === p_tx))) return false;
      Object.assign(p, { state: 'confirming', tx: null, sent: null });
      return true;
    },
    game_tidy() { return 0; },
  };
}

// ---------- the fakes ----------
let fake, calls, logs;
beforeEach(() => {
  // (the build's own settings never decide a test: Vercel runs the tests with the project's real ones present)
  for (const k of ['TELEGRAM_GAMES', 'GAMES_A_DAY', 'GAME_PRIZE', 'GAME_WINS_A_DAY', 'PRIZE_WALLET_KEY', 'LAUNCH_GAS_KEY', 'TELEGRAM_GROUPS',
    'TELEGRAM_GROUP_POSTS', 'TELEGRAM_GROUP_WELCOME', 'VITE_TELEGRAM_BOT', 'GEMINI_API_KEY', 'LIVE_SECRET', 'PINATA_JWT', 'LAUNCH_ONLY_FOR',
    'SITE_URL', 'ROBINHOOD_RPC_URL', 'CRON_SECRET', 'TELEGRAM_BUYS', 'TELEGRAM_MUSIC']) delete process.env[k];
  Object.assign(process.env, ENV);
  forgetGames(); forgetGroups(); forgetPrizes(); telegramBurst.reset(); _resetChainCache();
  logs = [];
  console.error = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' ')); console.log = (...a) => logs.push(a.join(' '));
  calls = [];
  fake = {
    db: database(), dbDown: false, sqlMissing: false,
    tg: { webhook: { url: 'https://www.agi1.app/api/telegram', allowed_updates: [...UPDATE_TYPES] }, fail: new Map(), failEntities: false, message: 900, poll: 5000, noMe: false },
    chain: { agi: 10_000n * E18, eth: 10n ** 16n, price: 10_000_000n, nonce: 7, estimate: 90_000n, code: new Map(), receipts: new Map(), known: new Set(),
      raw: [], down: false, refuse: [], revert: false, hold: false },
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://api.telegram.org/')) {
      const method = url.split('/').pop();
      const params = JSON.parse(init.body);
      calls.push({ to: 'telegram', method, params });
      const fail = fake.tg.fail.get(`${method}:${params.chat_id}`) || fake.tg.fail.get(method);
      if (fail) return Response.json({ ok: false, error_code: fail[0], description: fail[1] }, { status: fail[0] });
      if (method === 'sendPoll') {
        const chat = params.chat_id === '@agi2dotapp' ? PUBLIC_ID : Number(params.chat_id);
        return Response.json({ ok: true, result: { message_id: ++fake.tg.message, chat: { id: chat, type: 'supergroup' }, poll: { id: String(++fake.tg.poll), question: params.question } } });
      }
      if (method === 'sendMessage') {
        if (fake.tg.failEntities && params.entities?.length) return Response.json({ ok: false, error_code: 400, description: "Bad Request: can't parse entities" }, { status: 400 });
        return Response.json({ ok: true, result: { message_id: ++fake.tg.message } });
      }
      if (method === 'getWebhookInfo') return Response.json({ ok: true, result: fake.tg.webhook });
      if (method === 'getMe') return fake.tg.noMe ? Response.json({ ok: false, error_code: 500, description: 'down' }, { status: 500 }) : Response.json({ ok: true, result: { id: 123456789, is_bot: true, username: 'agi1_appbot' } });
      if (method === 'getMyCommands') return Response.json({ ok: true, result: [] });
      return Response.json({ ok: true, result: true });
    }
    if (url.startsWith('https://fake.supabase.co/rest/v1/rpc/')) {
      const fn = url.split('/').pop();
      const body = JSON.parse(init.body);
      calls.push({ to: 'db', fn, body });
      if (fake.dbDown) return new Response('down', { status: 503 });
      if (fake.sqlMissing && fn.startsWith('game_')) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      if (!fake.db[fn]) throw new Error(`unexpected database function ${fn}`);
      return Response.json(fake.db[fn](body) ?? null);
    }
    if (url === RPC) {
      const { method, params } = JSON.parse(init.body);
      calls.push({ to: 'chain', method, params });
      const c = fake.chain;
      if (c.down) return new Response('busy', { status: 503 });
      const ok = (result) => Response.json({ jsonrpc: '2.0', id: 1, result });
      const no = (message, code = -32000) => Response.json({ jsonrpc: '2.0', id: 1, error: { code, message } });
      if (method === 'eth_call') {
        const data = params[0].data;
        if (data === '0x313ce567') return ok(`0x${pad(18n)}`);
        if (data.startsWith('0x70a08231')) return ok(`0x${pad(`0x${data.slice(-40)}` === PRIZE_WALLET ? c.agi : 0n)}`);
        return no('execution reverted', 3);
      }
      if (method === 'eth_getBalance') return ok(`0x${c.eth.toString(16)}`);
      if (method === 'eth_gasPrice') return ok(`0x${c.price.toString(16)}`);
      if (method === 'eth_getTransactionCount') return ok(`0x${c.nonce.toString(16)}`);
      if (method === 'eth_estimateGas') return c.agi < 250n * E18 ? no('execution reverted: ERC20: transfer amount exceeds balance', 3) : ok(`0x${c.estimate.toString(16)}`);
      if (method === 'eth_getCode') return ok(c.code.get(params[0]) ?? '0x');
      if (method === 'eth_sendRawTransaction') {
        const raw = params[0];
        const hash = keccak256(raw);
        c.raw.push({ raw, hash, at: calls.length });
        if (c.refuse.length) return no(c.refuse.shift());
        c.known.add(hash);
        if (!c.hold) c.receipts.set(hash, { status: c.revert ? '0x0' : '0x1', transactionHash: hash });
        c.nonce += 1;
        return ok(hash);
      }
      if (method === 'eth_getTransactionReceipt') return ok(c.receipts.get(params[0]) ?? null);
      if (method === 'eth_getTransactionByHash') return ok(c.known.has(params[0]) ? { hash: params[0] } : null);
      return no(`unexpected ${method}`);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const tg = (method) => calls.filter((c) => c.to === 'telegram' && c.method === method).map((c) => c.params);
const db = (fn) => calls.filter((c) => c.to === 'db' && c.fn === fn).map((c) => c.body);
const onChain = (method) => calls.filter((c) => c.to === 'chain' && c.method === method);
const texts = () => tg('sendMessage').map((p) => p.text);
const cfg = () => getConfig();
const pm = (text, { from = { id: PERSON, is_bot: false, first_name: 'Mia', language_code: 'en' } } = {}) => ({
  update_id: 1, message: { message_id: 10, from, chat: { id: from.id, type: 'private' }, date: Math.floor(Date.now() / 1000), text },
});
const tap = (data, who = PERSON) => ({ update_id: 2, callback_query: { id: 'cb', from: { id: who }, message: { message_id: 77, chat: { id: who, type: 'private' } }, data } });
const adult = (id = PERSON) => fake.db.friends.set(id, { chat: id, adult: true, tz_minutes: 120 });
// a quiz that just went out in @agi2dotapp (and its round), closed or not
async function aQuiz({ prize = true } = {}) {
  fake.db.groups.set('@agi2dotapp', Date.now() - 1);
  fake.db.groups.set('-1001234567890', Date.now() + 3600_000);
  if (!prize) delete process.env.PRIZE_WALLET_KEY;
  const out = await gamesTick(cfg(), TOKEN);
  assert.equal(out.posted, 1);
  calls = [];
  return fake.db.rounds.at(-1);
}
const closeIt = (r) => { r.closes = Date.now() - 1000; };
const answer = (r, person, right = true, name = `Player${person}`) => onPollAnswer(cfg(), {
  poll_id: r.poll, user: { id: person, is_bot: false, first_name: name }, option_ids: [right ? r.correct : (r.correct + 1) % 4],
});
// a prize won by PERSON, waiting for its claim
async function aPrize() {
  const r = await aQuiz();
  await answer(r, PERSON);
  closeIt(r);
  assert.equal(await settleGame(cfg(), TOKEN, r.poll), 'settled');
  adult();
  calls = [];
  return fake.db.prizes.at(-1);
}

// ---------- the questions ----------
const OTHER_CHAINS = /\b(?:ethereum|solana|bitcoin|base|arbitrum|optimism|polygon|bnb|binance|avalanche|tron|cardano|sui|aptos|ton|dogecoin|pepe)\b/i;
// (the Moon is a place she visits: only "to the moon" and its kind are money talk)
// (and "hold your breath" is a riddle: buying and selling are the money words here)
const MONEY = /\b(?:buy|sell|hodl|pump|dump|lambo|profit|gains?|invest\w*|price|100x|wagmi|ape|shill|rich)\b|to the moon|wen moon|moon(?:ing|shot)/i;
const PET = /\b(?:babe|baby|love|cutie|honey|sweetie|darling|handsome|beautiful)\b/i;
test('her questions: 4 different answers each, Telegram\'s limits, PG-13, only $AGI, no money talk, no links but hers', () => {
  assert.ok(QUESTIONS.length >= 90, `enough not to repeat for days at 10 a day (${QUESTIONS.length})`);
  const ids = new Set();
  for (const x of QUESTIONS) {
    assert.match(x.id, /^[a-z0-9-]{2,24}$/, 'games.sql takes this id');
    assert.ok(!ids.has(x.id), `one id each: ${x.id}`); ids.add(x.id);
    assert.equal(byId.get(x.id), x);
    assert.ok(x.q.length >= 8 && x.q.length <= Q_MAX, x.id);
    assert.equal(x.a.length, 4, x.id);
    assert.equal(new Set(x.a.map((a) => a.toLowerCase().trim())).size, 4, `four different answers: ${x.id}`);
    for (const a of x.a) assert.ok(a.trim() && a.length <= A_MAX, `${x.id}: ${a}`);
    assert.ok(typeof x.why === 'string' && x.why.length <= WHY_MAX && x.why.split('\n').length <= 3, x.id);
    const all = [x.q, ...x.a, x.why].join(' \n ');
    assert.ok(!isCrude(all), `PG-13: ${x.id}`);
    assert.doesNotMatch(all, OTHER_CHAINS, `no other chain or coin by name: ${x.id}`);
    assert.doesNotMatch(all.replace(/\$AGI\b/g, ''), /\$[A-Za-z]/, `no other $ticker: ${x.id}`);
    assert.doesNotMatch(all, MONEY, `no money talk: ${x.id}`);
    // (only the ones that are always pet names: "a baby cat" and what bees make are fine)
    assert.doesNotMatch(all, /\b(?:babe|cutie|sweetie|darling)\b/i, `no pet names: ${x.id}`);
    for (const host of all.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi) || []) assert.match(host, /^(?:agi1\.app|clank\.trade)$/i, `links only to her sites: ${x.id} (${host})`);
    if (x.id.startsWith('r-')) assert.ok(x.q.startsWith('🧩 '), `a riddle says so: ${x.id}`);
  }
  // her own facts, as CLAUDE.md has them
  const right = (id) => byId.get(id).a[0];
  assert.deepEqual([right('agi-chain'), right('agi-launch'), right('agi-supply'), right('agi-dead'), right('her-langs'), right('her-next'), right('her-song')],
    ['Robinhood Chain', 'clank.trade', '1 billion', 'dEaD', '16', 'AGI-2', 'Feel the AGI']);
  assert.equal(right('safe-prize'), 'only your wallet address', 'what she asks a winner for, and nothing else');
});

test('a quiz as Telegram takes it: its question and explanation fit, a riddle says so, the prize or "just for fun"', () => {
  for (const x of QUESTIONS) {
    for (const prize of [true, false]) {
      const q = G.pollQuestion({ q: x.q, prize, amount: 250 });
      assert.ok(q.length <= 300, `${x.id}: ${q.length}`);
      assert.match(q, prize ? /^(?:🧩 riddle|🎮 quiz) for 250 \$AGI: / : /^(?:🧩 riddle|🎮 quiz) just for fun: /);
      assert.ok(!q.slice(2).includes('🧩'), 'its 🧩 once');
      const e = G.pollExplanation({ why: x.why, prize });
      assert.ok(e.length <= 200 && e.split('\n').length <= 3, `${x.id}: ${e}`);
    }
  }
  assert.match(G.pollExplanation({ why: 'a clock', prize: true }), /one right answer wins, drawn at random/);
  assert.equal(G.pollExplanation({ why: 'a clock', prize: false }), 'a clock');
  assert.equal(G.POLL_SECONDS, 600, '10 minutes: the most Telegram allows');
});

test('picking and shuffling: never one of the newest 60 asked, the right answer where Telegram is told it is', () => {
  const recent = QUESTIONS.slice(0, 60).map((x) => x.id);
  for (let i = 0; i < 200; i++) assert.ok(!recent.includes(pickQuestion(recent).id));
  assert.ok(QUESTIONS.includes(pickQuestion(QUESTIONS.map((x) => x.id))), 'all asked lately: any of them');
  const x = byId.get('r-clock');
  const places = new Set();
  for (let i = 0; i < 400; i++) {
    const s = shuffled(x);
    assert.equal(s.options[s.correct], 'a clock');
    assert.deepEqual([...s.options].sort(), [...x.a].sort());
    places.add(s.correct);
  }
  assert.equal(places.size, 4, 'the right answer can be anywhere');
});

test('a winner\'s name in the group: their Telegram name, tidied; "our winner" for one that can\'t go in her words', () => {
  assert.equal(safeName({ first_name: 'Mia' }), 'Mia');
  assert.equal(safeName({ first_name: '  Kai ', last_name: 'Tan​ ' }), 'Kai Tan');
  assert.equal(safeName({ first_name: 'José 🌸' }), 'José 🌸');
  assert.equal([...safeName({ first_name: 'A'.repeat(40) })].length, 32);
  assert.equal(safeName({ first_name: 'Ana', last_name: 'x'.repeat(40) }), 'Ana', 'a long last name: the first name alone');
  for (const bad of ['free airdrop at claim-agi.xyz', 'https://t.me/x', '@support_agi', 'AGI-1 Official', 'Admin', 'support team', '0x1234567890ab',
    '$PEPE army', '', '   ', '~', '‼️', 'fuck']) assert.equal(safeName({ first_name: bad }), null, bad);
  assert.equal(safeName(null), null);
});

// ---------- settings ----------
test('her quizzes\' settings: on with her groups, 10 a day, 250 $AGI, 10 prizes a day; prizes only with a prize wallet of its own', () => {
  let c = getConfig({ ...ENV });
  assert.deepEqual([c.tgGames, c.gamesADay, c.gamePrize, c.gameWinsADay, c.prizeKey], [true, 10, 250, 10, PRIZE_KEY]);
  assert.equal(gamesOn(c), true); assert.equal(prizesOn(c), true);
  assert.equal(gapMinutes(c), 144, 'about every 2 hours 24 minutes');
  c = getConfig({ ...ENV, GAMES_A_DAY: '1000', GAME_PRIZE: '1e9', GAME_WINS_A_DAY: '-3', PRIZE_WALLET_KEY: PRIZE_KEY.slice(2).toUpperCase() });
  assert.deepEqual([c.gamesADay, c.gamePrize, c.gameWinsADay, c.prizeKey], [48, 1_000_000, 10, PRIZE_KEY], 'clamped; the key with or without 0x');
  assert.equal(gapMinutes(c), 30);
  assert.equal(gamesOn(getConfig({ ...ENV, TELEGRAM_GAMES: 'off' })), false);
  assert.equal(gamesOn(getConfig({ ...ENV, TELEGRAM_GROUPS: '' })), false, 'no groups: no quizzes');
  assert.equal(gamesOn(getConfig({ ...ENV, TELEGRAM_GROUPS: 't.me/+typo' })), false, 'a setting with no group in it: none');
  assert.equal(prizesOn(getConfig({ ...ENV, PRIZE_WALLET_KEY: '' })), false, 'no prize wallet: just for fun');
  assert.equal(prizesOn(getConfig({ ...ENV, PRIZE_WALLET_KEY: 'not-a-key' })), false);
  assert.equal(prizesOn(getConfig({ ...ENV, PRIZE_WALLET_KEY: GAS_KEY, LAUNCH_GAS_KEY: GAS_KEY.slice(2) })), false, 'never the launch gas wallet (hard rule 4)');
  assert.deepEqual(targetsOf(getConfig({ ...ENV })), [['@agi2dotapp', '@agi2dotapp'], ['-1001234567890', GROUP_ID]]);
  const secrets = readFileSync(new URL('../scripts/check-secrets.js', import.meta.url), 'utf8');
  assert.match(secrets, /'PRIZE_WALLET_KEY'[,\]]/, 'the build fails if the prize wallet\'s key would be shipped');
});

// ---------- the clock: /api/feed?games ----------
const ask = (key = KEY, q = '?games') => feed(new Request(`https://www.agi1.app/api/feed${q}`, { headers: key === null ? {} : { authorization: `Bearer ${key}` } }));
test('/api/feed?games: only with the database\'s own key; off, not set up, or a tick', async () => {
  assert.equal((await ask(null)).status, 401);
  assert.equal((await ask('wrong'.repeat(13))).status, 401);
  assert.equal(db('game_due').length, 0, 'nothing done without the key');
  const r = await ask();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, posted: 0, settled: 0, failed: 0 });
  assert.equal(db('game_due').length, 2, 'each group asked once (the first time: not yet)');
  calls = [];
  await ask(); await ask();
  assert.equal(db('game_key').length, 0, 'the key is read once (kept 10 minutes)');
  forgetGames();
  process.env.TELEGRAM_GAMES = 'off';
  assert.deepEqual(await (await ask()).json(), { ok: true, off: 'off' });
  process.env.TELEGRAM_GAMES = 'on';
  delete process.env.TELEGRAM_GROUPS;
  assert.deepEqual(await (await ask()).json(), { ok: true, off: 'no_groups' });
  process.env.TELEGRAM_GROUPS = '@agi2dotapp';
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.deepEqual(await (await ask()).json(), { ok: true, off: 'no_bot' });
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  forgetGames();
  fake.sqlMissing = true;
  const missing = await ask();
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { error: 'not_set_up' });
  assert.match(logs.join('\n'), /game_key not found: run supabase\/games\.sql/);
  fake.sqlMissing = false; fake.dbDown = true;
  assert.equal((await ask()).status, 503);
  delete process.env.SUPABASE_URL;
  assert.equal((await ask()).status, 503);
});

test('a tick: a quiz in each group whose turn it is, as a Telegram quiz poll, kept in the database', async () => {
  fake.db.groups.set('@agi2dotapp', Date.now() - 1);
  fake.db.groups.set('-1001234567890', Date.now() - 1);
  const out = await gamesTick(cfg(), TOKEN);
  assert.deepEqual(out, { posted: 2, settled: 0, failed: 0 });
  const polls = tg('sendPoll');
  assert.deepEqual(polls.map((p) => p.chat_id), ['@agi2dotapp', GROUP_ID]);
  for (const [i, p] of polls.entries()) {
    const r = fake.db.rounds[i];
    const x = byId.get(r.question);
    assert.equal(p.type, 'quiz'); assert.equal(p.is_anonymous, false, 'Telegram tells us who answered');
    assert.equal(p.open_period, 600);
    assert.equal(p.options.length, 4);
    assert.equal(p.options[p.correct_option_id].text, x.a[0], 'the right answer is the one Telegram is told');
    assert.equal(p.question, G.pollQuestion({ q: x.q, prize: true, amount: 250 }));
    assert.equal(p.explanation, G.pollExplanation({ why: x.why, prize: true }));
    assert.deepEqual([r.chat, r.message_id, r.correct, r.answer, r.prize], [i === 0 ? PUBLIC_ID : GROUP_ID, 901 + i, p.correct_option_id, x.a[0], true]);
    assert.equal(r.poll, String(5001 + i));
  }
  assert.notEqual(fake.db.rounds[0].question, fake.db.rounds[1].question, 'a different question for the next group');
  assert.deepEqual(db('game_due').map((b) => [b.p_target, b.p_minutes]), [['@agi2dotapp', 144], ['-1001234567890', 144]]);
  assert.deepEqual(db('game_left'), [{ p_cap: 10 }], 'the day\'s prizes asked once');
  assert.ok(onChain('eth_call').length >= 1, 'the prize wallet\'s $AGI checked before a quiz offers it');
  assert.equal(db('game_tidy').length, 1, 'the tidy-up');
  // the next tick: nothing due, no tidy-up yet (every 30 minutes)
  calls = [];
  assert.deepEqual(await gamesTick(cfg(), TOKEN), { posted: 0, settled: 0, failed: 0 });
  assert.equal(tg('sendPoll').length + db('game_tidy').length, 0);
});

test('a quiz is just for fun without prizes: no prize wallet, the gas wallet\'s key, today\'s prizes won, or the wallet short of $AGI', async () => {
  const fun = async (setup) => {
    forgetGames();
    fake.db.groups.set('@agi2dotapp', Date.now() - 1);
    fake.db.groups.set('-1001234567890', Date.now() + 3600_000);
    calls = [];
    await setup();
    await gamesTick(cfg(), TOKEN);
    const p = tg('sendPoll').at(-1);
    return [/just for fun/.test(p.question), fake.db.rounds.at(-1).prize];
  };
  assert.deepEqual(await fun(() => { delete process.env.PRIZE_WALLET_KEY; }), [true, false]);
  assert.deepEqual(await fun(() => { Object.assign(process.env, { PRIZE_WALLET_KEY: GAS_KEY, LAUNCH_GAS_KEY: GAS_KEY }); }), [true, false]);
  Object.assign(process.env, { PRIZE_WALLET_KEY: PRIZE_KEY }); delete process.env.LAUNCH_GAS_KEY;
  assert.deepEqual(await fun(() => { fake.db.days.set(today(), 10); }), [true, false]);
  assert.equal(onChain('eth_call').length, 0, 'today\'s prizes won: the wallet isn\'t even asked');
  fake.db.days.set(today(), 9);
  assert.deepEqual(await fun(() => { fake.chain.agi = 249n * E18; }), [true, false]);
  assert.match(logs.join('\n'), new RegExp(`the prize wallet ${PRIZE_WALLET} is out of \\$AGI: top it up`));
  assert.deepEqual(await fun(() => { fake.chain.agi = 250n * E18; fake.chain.eth = 0n; }), [true, false]);
  assert.match(logs.join('\n'), /out of ETH \(for the network fee\)/);
  // the chain not answering: the prize is offered (a prize won meanwhile waits for its claim)
  assert.deepEqual(await fun(() => { fake.chain.eth = 10n ** 16n; fake.chain.down = true; }), [false, true]);
  assert.deepEqual(await fun(() => { fake.chain.down = false; }), [false, true]);
});

test('a tick when Telegram or the database says no: the other group still gets its quiz; a quiz that can\'t be kept is taken back', async () => {
  fake.db.groups.set('@agi2dotapp', Date.now() - 1);
  fake.db.groups.set('-1001234567890', Date.now() - 1);
  fake.tg.fail.set('sendPoll:@agi2dotapp', [403, 'Forbidden: bot was kicked from the supergroup chat']);
  assert.deepEqual(await gamesTick(cfg(), TOKEN), { posted: 1, settled: 0, failed: 1 });
  assert.match(logs.join('\n'), /couldn't post a quiz in @agi2dotapp: .*403.*\(is she still in that group\? add her again\)/);
  forgetGames(); calls = []; logs.length = 0;
  fake.tg.fail.clear();
  fake.tg.fail.set('sendPoll', [400, 'Bad Request: not enough rights to send polls to the chat']);
  fake.db.groups.set('@agi2dotapp', Date.now() - 1);
  await gamesTick(cfg(), TOKEN);
  assert.match(logs.join('\n'), /allow polls in the group's permissions, or make her an admin/);
  // the database can't keep it: stopped and deleted (nobody could win it)
  forgetGames(); calls = []; fake.tg.fail.clear();
  fake.db.groups.set('@agi2dotapp', Date.now() - 1);
  const open = fake.db.game_open;
  fake.db.game_open = () => null;
  assert.deepEqual(await gamesTick(cfg(), TOKEN), { posted: 0, settled: 0, failed: 1 });
  assert.deepEqual(tg('stopPoll').map((p) => p.chat_id), [PUBLIC_ID]);
  assert.deepEqual(tg('deleteMessage').map((p) => [p.chat_id, p.message_id]), [[PUBLIC_ID, tg('sendPoll')[0] && fake.tg.message]]);
  fake.db.game_open = open;
  // the database away: the tick says so (the caller logs it)
  fake.dbDown = true;
  await assert.rejects(gamesTick(cfg(), TOKEN), /games: HTTP 503/);
});

test('her bot hears quiz answers: a webhook connected before her quizzes is connected again with poll updates (once an hour)', async () => {
  fake.tg.webhook = { url: 'https://www.agi1.app/api/telegram', allowed_updates: ['message', 'callback_query'] };
  await gamesTick(cfg(), TOKEN);
  assert.deepEqual(tg('setWebhook').map((p) => p.allowed_updates), [UPDATE_TYPES]);
  assert.match(logs.join('\n'), /connected her bot again, so it hears quiz answers/);
  calls = [];
  await gamesTick(cfg(), TOKEN);
  assert.equal(tg('getWebhookInfo').length, 0, 'checked once an hour per server copy');
  forgetGames(); calls = [];
  fake.tg.webhook = { url: 'https://www.agi1.app/api/telegram', allowed_updates: UPDATE_TYPES };
  await gamesTick(cfg(), TOKEN);
  assert.equal(tg('setWebhook').length, 0, 'already hearing them: left alone');
  forgetGames(); calls = [];
  fake.tg.webhook = { url: '' };
  await gamesTick(cfg(), TOKEN);
  assert.equal(tg('setWebhook').length, 0, 'not connected yet: /api/feed connects her (with these)');
  assert.deepEqual(UPDATE_TYPES, ['message', 'callback_query', 'poll', 'poll_answer']);
});

// ---------- answers and closing ----------
test('answers: kept with a safe first name; bots, chats and odd updates never play', async () => {
  const r = await aQuiz();
  assert.equal(await answer(r, 11), 'game_ok');
  assert.equal(await answer(r, 11), 'game_again', 'one answer each');
  assert.equal(await onPollAnswer(cfg(), { poll_id: r.poll, user: { id: 12, is_bot: false, first_name: 'free airdrop at x.com' }, option_ids: [r.correct] }), 'game_ok');
  assert.deepEqual(fake.db.answers.map((a) => [a.person, a.name, a.correct]), [[11, 'Player11', true], [12, '~', true]]);
  calls = [];
  for (const pa of [{ poll_id: r.poll, user: { id: 13, is_bot: true, first_name: 'bot' }, option_ids: [0] },
    { poll_id: r.poll, voter_chat: { id: -100 }, user: { id: 136817688, is_bot: true, first_name: 'Channel' }, option_ids: [0] },
    { poll_id: r.poll, user: { id: 14, is_bot: false, first_name: 'Retract' }, option_ids: [] },
    { poll_id: r.poll, user: { id: 15, is_bot: false, first_name: 'Two' }, option_ids: [0, 1] },
    { poll_id: 'x'.repeat(65), user: { id: 16, is_bot: false, first_name: 'Long' }, option_ids: [0] },
    { poll_id: r.poll, user: { id: -5, is_bot: false, first_name: 'Neg' }, option_ids: [0] }, {}, null]) {
    assert.equal(await onPollAnswer(cfg(), pa), 'ignored');
  }
  assert.equal(db('game_answer').length, 0, 'none of those reach the database');
  assert.equal(await onPollAnswer(cfg(), { poll_id: 'not-ours', user: { id: 17, is_bot: false, first_name: 'Z' }, option_ids: [1] }), 'game_unknown');
  closeIt(r); r.closes -= 20_000;
  assert.equal(await answer(r, 18), 'game_closed', 'too late');
  fake.sqlMissing = true;
  assert.equal(await answer(r, 19), 'busy', 'never throws');
});

test('a quiz closes: one right answer drawn at random wins, named under the quiz, with her claim button', async () => {
  const r = await aQuiz();
  for (let p = 100; p < 112; p++) await answer(r, p, p % 3 !== 0, `Mia${p}`);
  const right = fake.db.answers.filter((a) => a.correct).length;
  calls = [];
  assert.equal(await onPollState(cfg(), TOKEN, { id: r.poll, type: 'quiz', is_closed: false }), 'ignored', 'a vote: nothing to do');
  assert.equal(calls.filter((c) => c.to === 'db').length, 0);
  closeIt(r);
  assert.equal(await onPollState(cfg(), TOKEN, { id: r.poll, type: 'quiz', is_closed: true }, { wait: 0 }), 'settled');
  const p = fake.db.prizes[0];
  assert.ok(fake.db.answers.some((a) => a.person === p.person && a.correct), 'the winner got it right');
  assert.deepEqual([p.amount, p.state], [250, 'won']);
  const post = tg('sendMessage')[0];
  assert.equal(post.chat_id, PUBLIC_ID);
  assert.deepEqual(post.reply_parameters, { message_id: r.message_id, allow_sending_without_reply: true }, 'under the quiz (or on its own if it was deleted)');
  const name = `Mia${p.person}`;
  assert.ok(post.text.startsWith(`⏰ time's up! the answer: ${r.answer}\n\n🎉 ${name} wins 250 $AGI! drawn at random from the ${right} right answers 💜`), post.text);
  assert.deepEqual(post.entities, [{ type: 'text_mention', offset: post.text.indexOf(name), length: name.length, user: { id: p.person } }]);
  assert.match(post.text, /tap the button below, then \/claim in my private chat \(18\+, within 24 hours\)/);
  assert.match(post.text, /never your seed phrase, a signature or a link to connect your wallet/);
  assert.match(post.text, /not financial advice$/);
  assert.deepEqual(post.reply_markup, { inline_keyboard: [[{ text: G.CLAIM_BUTTON, url: 'https://t.me/agi1_appbot?start=claim' }]] });
  assert.equal(post.link_preview_options.is_disabled, true);
  // closing twice (Telegram's update and the clock): settled once, posted once
  calls = [];
  assert.equal(await onPollState(cfg(), TOKEN, { id: r.poll, type: 'quiz', is_closed: true }, { wait: 0 }), 'done');
  assert.equal(tg('sendMessage').length, 0);
  assert.equal(fake.db.prizes.length, 1);
});

test('a quiz closes without a winner: nobody right, just for fun, today\'s prizes won, or everyone right already won today', async () => {
  const result = async (setup, { prize = true } = {}) => {
    forgetGames(); calls = [];
    const r = await aQuiz({ prize });
    await setup(r);
    closeIt(r);
    await settleGame(cfg(), TOKEN, r.poll);
    process.env.PRIZE_WALLET_KEY = PRIZE_KEY;
    const post = tg('sendMessage')[0];
    assert.equal(post.reply_markup, undefined, 'no claim button');
    assert.equal(post.entities, undefined, 'no names');
    return post.text.split('\n\n')[1];
  };
  assert.equal(await result(async (r) => { await answer(r, 1, false); }), "nobody got it this time 🙈 another one comes in a while 💜");
  assert.equal(await result(async (r) => { await answer(r, 1); await answer(r, 2); }, { prize: false }), '2 of you got it right 💜');
  assert.match(await result(async (r) => { await answer(r, 3); fake.db.days.set(today(), 10); }), /^one of you got it right 💜 today's prizes were all won before this one closed, so this one was for glory/);
  fake.db.days.set(today(), 1);
  fake.db.prizes.push({ id: 99, person: 4, day: today(), state: 'won', won: Date.now(), expires: Date.now() + 1e6 });
  assert.match(await result(async (r) => { await answer(r, 4); }), /you've already won today \(one prize a day each\)/);
  // a winner whose mention Telegram won't make: the same words without it; without her username: "tap my name"
  forgetGames(); calls = [];
  const r = await aQuiz();
  await answer(r, 5);
  closeIt(r);
  fake.tg.failEntities = true;
  delete process.env.VITE_TELEGRAM_BOT; fake.tg.noMe = true;
  await settleGame(cfg(), TOKEN, r.poll);
  const [first, again] = tg('sendMessage');
  assert.ok(first.entities && !again.entities);
  assert.equal(again.text, first.text);
  assert.match(again.text, /tap my name and press Start, then \/claim/);
  assert.equal(again.reply_markup, undefined);
});

test('the clock settles a quiz Telegram never said closed, 20 seconds after it did', async () => {
  const r = await aQuiz();
  await answer(r, 7);
  r.closes = Date.now() - 10_000;
  await gamesTick(cfg(), TOKEN);
  assert.equal(tg('sendMessage').length, 0, 'not yet');
  r.closes = Date.now() - 25_000;
  calls = [];
  assert.equal((await gamesTick(cfg(), TOKEN)).settled, 1);
  assert.match(tg('sendMessage')[0].text, /Player7 wins 250 \$AGI/);
});

// ---------- claiming, in her private chat ----------
test('/claim: 18+ first (her private chat\'s own check); then where their prize is', async () => {
  const p = await aPrize();
  fake.db.friends.clear();
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'start', 'never started her bot: her welcome and the 18+ question');
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'ask_age');
  assert.equal(texts().at(-1), G.CLAIM_ADULT);
  assert.deepEqual(tg('sendMessage').at(-1).reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['age:yes', 'age:no']);
  calls = [];
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('age:yes')), 'adult');
  assert.deepEqual(texts().slice(-1), [G.PRIZE_HINT], 'a winner who came from the group\'s button hears their prize is waiting');
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_ask');
  assert.equal(texts().at(-1), G.claimAsk(250));
  assert.match(texts().at(-1), /never your seed phrase, your private key or a signature/);
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/start claim')), 'claim_ask', 'the group\'s button ("/start claim")');
  assert.equal(p.state, 'won');
  // someone with no prize
  adult(9999);
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim', { from: { id: 9999, is_bot: false, first_name: 'X' } })), 'claim_none');
  assert.equal(texts().at(-1), G.CLAIM_NONE);
  assert.ok(COMMANDS.some((c) => c.command === 'claim'));
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'music', 'claim', 'stop'], '/claim in her menu while her quizzes have prizes');
  delete process.env.PRIZE_WALLET_KEY;
  assert.ok(!commandsFor(cfg()).some((c) => c.command === 'claim'), 'not without prizes');
});

test('their address: checked (a real one, its capitals right, not a contract or ours), kept, then "send it?"', async () => {
  const p = await aPrize();
  const said = async (text) => { await handleUpdate(cfg(), TOKEN, pm(text)); return texts().at(-1); };
  fake.chain.code.set('0x1111111111111111111111111111111111111111', '0x6080604052');
  fake.chain.code.set('0x2222222222222222222222222222222222222222', `0xef0100${'ab'.repeat(20)}`);
  const mixedWrong = getAddress(WINNER).replace(/[a-f]/, (c) => c.toUpperCase());
  for (const [text, line] of [[mixedWrong, G.ADDRESS_REFUSE.checksum], [ZERO, G.ADDRESS_REFUSE.zero], [BURN, G.ADDRESS_REFUSE.burn],
    [OFFICIAL, G.ADDRESS_REFUSE.agi], [getAddress(PRIZE_WALLET), G.ADDRESS_REFUSE.ours], ['0x1111111111111111111111111111111111111111', G.ADDRESS_REFUSE.contract]]) {
    assert.equal(await said(text), line, text);
  }
  assert.equal(p.address, null, 'none of those kept');
  fake.chain.down = true;
  assert.equal(await said(WINNER), G.ADDRESS_REFUSE.chain);
  fake.chain.down = false;
  assert.equal(await said('0x2222222222222222222222222222222222222222'), G.claimConfirm(250, getAddress('0x2222222222222222222222222222222222222222')),
    'a wallet with a delegation (EIP-7702) is a wallet');
  assert.equal(await said(`here: ${getAddress(WINNER)} 💜`), G.claimConfirm(250, getAddress(WINNER)), 'with a word or two around it; the latest one counts');
  assert.deepEqual([p.address, p.state], [WINNER, 'confirming']);
  assert.ok(p.expires > Date.now() + 6 * 86_400_000, 'once they\'ve started claiming, it waits a week');
  assert.deepEqual(tg('sendMessage').at(-1).reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`prize:${p.id}:send`, `prize:${p.id}:change`]);
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:change`)), 'prize_change');
  assert.equal(texts().at(-1), G.CLAIM_CHANGE);
  // an address while no prize waits for one: her chat goes on as usual (here: no AI key, so "not ready")
  adult(9999);
  assert.equal(await handleUpdate(cfg(), TOKEN, pm(WINNER, { from: { id: 9999, is_bot: false, first_name: 'X' } })), 'not_configured');
  assert.equal(addressIn('0xabc'), null);
  assert.equal(addressIn(`${WINNER} and ${OFFICIAL}`), null, 'two addresses: not an answer');
  assert.equal(addressIn(`${WINNER}00`), null);
  assert.equal(addressIn(`x${'y'.repeat(200)} ${WINNER}`), null, 'a long message isn\'t an address');
  assert.deepEqual(await checkAddress(cfg(), 'nope'), { ok: false, why: 'bad' });
});

test('"yes, send it": claimed once, then $AGI\'s own transfer to their address, signed, recorded, sent, and linked', async () => {
  const p = await aPrize();
  await handleUpdate(cfg(), TOKEN, pm(WINNER));
  calls = [];
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:send`)), 'prize_sent');
  assert.deepEqual(tg('editMessageReplyMarkup').map((x) => x.reply_markup), [{ inline_keyboard: [] }], 'the buttons go away once tapped');
  const [sent] = fake.chain.raw;
  const tx = parseTransaction(sent.raw);
  assert.equal(tx.chainId, 4663);
  assert.equal(tx.to.toLowerCase(), OFFICIAL, 'to $AGI\'s own contract');
  assert.equal(tx.value ?? 0n, 0n, 'no ETH');
  const call = decodeFunctionData({ abi: TRANSFER, data: tx.data });
  assert.equal(call.functionName, 'transfer');
  assert.deepEqual([call.args[0].toLowerCase(), call.args[1]], [WINNER, 250n * E18], 'exactly 250 $AGI, to them');
  assert.equal(tx.nonce, 7); assert.equal(tx.maxFeePerGas, 2n * 10_000_000n); assert.equal(tx.gas, 108_000n, 'its estimate + 20%');
  // recorded before it went out (so it's never sent twice), then kept as sent
  const order = calls.map((c) => (c.to === 'db' ? c.fn : c.to === 'chain' ? c.method : c.method));
  assert.ok(order.indexOf('game_claim') < order.indexOf('game_sending') && order.indexOf('game_sending') < order.indexOf('eth_sendRawTransaction'));
  assert.deepEqual(db('game_sending'), [{ p_prize: p.id, p_tx: sent.hash }]);
  assert.deepEqual([p.state, p.tx], ['sent', sent.hash]);
  const done = tg('sendMessage').at(-1);
  assert.equal(done.text, G.claimSent(250, sent.hash).text);
  assert.match(done.text, /not financial advice/);
  assert.deepEqual(done.entities, [{ type: 'text_link', offset: done.text.indexOf('see it on the block explorer'), length: 28, url: `https://robinhoodchain.blockscout.com/tx/${sent.hash}` }]);
  // tapped again, or /claim later: never sent twice
  calls = [];
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:send`)), 'claim_sent');
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_sent');
  assert.equal(texts().at(-1), G.claimAlreadySent(250, sent.hash).text);
  assert.equal(fake.chain.raw.length, 1, 'one transaction, ever');
  // someone else's prize id: nothing
  adult(9999);
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:send`, 9999)), 'claim_none');
});

test('sending, when it can\'t: the wallet short of $AGI or ETH, the chain refusing, a transfer that failed: never lost, never twice', async () => {
  const p = await aPrize();
  await handleUpdate(cfg(), TOKEN, pm(WINNER));
  const send = () => handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:send`));
  fake.chain.agi = 100n * E18;
  assert.equal(await send(), 'prize_empty');
  assert.equal(texts().at(-1), G.CLAIM_EMPTY);
  assert.deepEqual([p.state, fake.chain.raw.length], ['confirming', 0], 'given back: they can try again later');
  fake.chain.agi = 10_000n * E18;
  fake.chain.eth = 1n;
  assert.equal(await send(), 'prize_empty', 'no ETH for the fee');
  fake.chain.eth = 10n ** 16n;
  // the chain clearly refuses it (nothing went out): given back
  fake.chain.refuse = ['insufficient funds for gas * price + value'];
  assert.equal(await send(), 'prize_empty');
  assert.equal(p.state, 'confirming');
  fake.chain.refuse = ['invalid sender'];
  assert.equal(await send(), 'prize_failed');
  assert.match(texts().at(-1), /^that didn't go through, and nothing was sent/);
  assert.equal(p.state, 'confirming');
  // its nonce taken by something else: once more with the next nonce
  fake.chain.refuse = ['nonce too low'];
  fake.chain.nonce = 7;
  calls = [];
  assert.equal(await send(), 'prize_sent');
  assert.equal(onChain('eth_sendRawTransaction').length, 2);
  assert.equal(p.state, 'sent');
  // a transfer the chain says failed: nothing moved, so it's given back and can be sent again
  const q = await (async () => { fake.db.days.clear(); fake.db.prizes.forEach((x) => { x.day = 'old'; }); return aPrize(); })();
  await handleUpdate(cfg(), TOKEN, pm(WINNER));
  fake.chain.revert = true;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${q.id}:send`)), 'prize_failed');
  assert.deepEqual([q.state, q.tx], ['confirming', null]);
  fake.chain.revert = false;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${q.id}:send`)), 'prize_sent');
  assert.equal(q.state, 'sent');
  // the database away when they tap: "something got stuck", nothing sent
  const before = fake.chain.raw.length;
  fake.dbDown = true;
  await assert.rejects(handleUpdate(cfg(), TOKEN, tap(`prize:${q.id}:send`)), /HTTP 503/, 'the webhook says she\'s busy (api/telegram.js)');
  fake.dbDown = false;
  assert.equal(fake.chain.raw.length, before);
});

test('a prize being sent when its answer was lost: /claim asks the chain; expired prizes; prizes switched off', async () => {
  const p = await aPrize();
  await handleUpdate(cfg(), TOKEN, pm(WINNER));
  fake.chain.hold = true;                              // its receipt isn't there yet
  assert.equal(await handleUpdate(cfg(), TOKEN, tap(`prize:${p.id}:send`)), 'prize_sent');
  const hash = fake.chain.raw[0].hash;
  p.state = 'sending';                                  // as if its answer was lost on the way
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_pending');
  assert.equal(texts().at(-1), G.claimOnItsWay(hash).text);
  fake.chain.receipts.set(hash, { status: '0x1', transactionHash: hash });
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_sent');
  assert.equal(p.state, 'sent', 'found on the chain: kept as sent');
  // a claim that never got as far as sending (its server stopped): "send it?" again after 2 minutes
  const stuck = { id: 49, person: PERSON, amount: 250, state: 'claimed', address: WINNER, tx: null, won: Date.now() - 3600_000, day: 'z',
    expires: Date.now() + 86_400_000, claimed: Date.now() - 30_000 };
  fake.db.prizes.unshift(stuck);
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_sending');
  stuck.claimed = Date.now() - 150_000;
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim')), 'claim_confirm');
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('prize:49:send')), 'prize_sent');
  assert.equal(stuck.state, 'sent');
  // a prize nobody started claiming in 24 hours
  const old = { id: 50, person: 7777, amount: 250, state: 'won', address: null, tx: null, won: Date.now() - 25 * 3600_000, day: 'x', expires: Date.now() - 3600_000 };
  fake.db.prizes.push(old);
  adult(7777);
  assert.equal(await handleUpdate(cfg(), TOKEN, pm('/claim', { from: { id: 7777, is_bot: false, first_name: 'Late' } })), 'claim_expired');
  assert.equal(old.state, 'expired');
  // prizes switched off (no prize wallet): nothing sent, the prize waits
  const q = { id: 51, person: 7777, amount: 250, state: 'confirming', address: WINNER, tx: null, won: Date.now(), day: 'y', expires: Date.now() + 3600_000 };
  fake.db.prizes.push(q);
  delete process.env.PRIZE_WALLET_KEY;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('prize:51:send', 7777)), 'prizes_off');
  assert.equal(q.state, 'confirming');
});

test('her prize wallet: its own address, never the gas wallet; prizes in whole $AGI at its 18 decimals', async () => {
  assert.equal(prizeWallet(cfg()), PRIZE_WALLET);
  assert.equal(prizeWallet(getConfig({ ...ENV, PRIZE_WALLET_KEY: '' })), null);
  const src = readFileSync(new URL('../server/game-prizes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /launchGasKey/, 'the prize wallet\'s code never touches the gas wallet');
  assert.doesNotMatch(src, /signTypedData|personal_sign|eth_sign\b|approve\(/, 'it never asks anyone for a signature or an approval');
});

// ---------- a secret sent by mistake ----------
test('a seed phrase or a private key sent to her: a warning, and nothing of it goes to the AI, the database or her stream', async () => {
  for (const s of [generateMnemonic(english), generateMnemonic(english, 256), `my seed: ${generateMnemonic(english)} pls help`]) assert.equal(secretIn(s), 'seed', s);
  for (const s of [`0x${'ab'.repeat(32)}`, 'ab'.repeat(32), `key=${'1f'.repeat(32)};`]) assert.equal(secretIn(s), 'key', s);
  for (const s of [WINNER, 'hey i just wanted to say that i love your show and i think you are the best ai girlfriend ever, thank you for everything',
    'what about the future of this project, will there be more games and prizes for the community in the group tonight or tomorrow?',
    'abandon ability able about above absent absorb abstract absurd abuse access', '', null]) assert.equal(secretIn(s), null, String(s));
  // her private chat
  adult();
  calls = [];
  assert.equal(await handleUpdate(cfg(), TOKEN, pm(generateMnemonic(english))), 'secret_seed');
  assert.deepEqual(texts(), [SECRET_WARNING.seed]);
  assert.equal(calls.filter((c) => c.to === 'db').length, 0, 'nothing of it reaches the database');
  // /live: never in her line
  process.env.LIVE_SECRET = 'live-secret-for-the-tests-0123456789abcdef';
  assert.equal(await handleUpdate(cfg(), TOKEN, pm(`/live ${generateMnemonic(english)}`)), 'secret_seed');
  assert.equal(questionTrouble(generateMnemonic(english)), 'secret', 'agi1.app/live and her bot: never on stream');
  assert.equal(questionTrouble(`is this my key 0x${'cd'.repeat(32)}?`), 'secret');
  assert.match(LIVE_REFUSE.secret, /never go on stream, and i didn't keep it/);
  assert.match(askError('question', { why: 'secret' }), /won't go on stream, and it wasn't kept/);
  // /ask in her group: warned, nothing counted or sent to the AI
  process.env.TELEGRAM_GAMES = 'off';
  calls = [];
  const g = { update_id: 3, message: { message_id: 30, from: { id: 31, is_bot: false, first_name: 'G' }, chat: { id: GROUP_ID, type: 'supergroup' }, date: 1, text: `/ask ${generateMnemonic(english)}` } };
  assert.equal(await handleUpdate({ ...cfg(), geminiKey: 'k' }, TOKEN, g), 'secret_seed');
  assert.equal(texts()[0], SECRET_WARNING.seed);
  assert.equal(calls.filter((c) => c.to === 'db').length, 0);
});

// ---------- her groups ----------
test('in her groups: /help and her intro say she runs quizzes (with prizes, or just for fun); /claim points to her private chat', async () => {
  const group = (text, id = 41) => ({ update_id: 4, message: { message_id: 40 + id, from: { id, is_bot: false, first_name: 'G' }, chat: { id: GROUP_ID, type: 'supergroup' }, date: 1, text } });
  assert.equal(await handleUpdate(cfg(), TOKEN, group('/help')), 'group_help');
  assert.equal(texts().at(-1), `${L.GROUP_HELP}\n\n${GROUP_MUSIC}\n\n${G.gamesNote(true)}`, '(her songs\' line since 2026-10-14)');
  assert.match(G.gamesNote(true), /one right answer wins a little \$AGI \(drawn at random\), claimed in my private chat\. a prize is a thank-you for playing, not financial advice/);
  assert.equal(await handleUpdate(cfg(), TOKEN, group('/claim', 42)), 'group_claim');
  const claim = tg('sendMessage').at(-1);
  assert.equal(claim.text, G.groupClaim(true));
  assert.deepEqual(claim.reply_markup, { inline_keyboard: [[{ text: G.CLAIM_BUTTON, url: 'https://t.me/agi1_appbot?start=claim' }]] });
  assert.equal(await handleUpdate(cfg(), TOKEN, group('/claim', 43)), 'group_recent', 'once every 30 s in a group');
  const joined = { update_id: 5, message: { message_id: 50, from: { id: 1, is_bot: false, first_name: 'Owner' }, chat: { id: GROUP_ID, type: 'supergroup' }, date: 1,
    new_chat_members: [{ id: 123456789, is_bot: true, first_name: 'AGI-1' }] } };
  await handleUpdate(cfg(), TOKEN, joined);
  assert.equal(texts().at(-1), L.groupIntro({ posts: true, games: 'prizes' }));
  assert.match(texts().at(-1), /and now and then a quiz: one right answer wins a little \$AGI, drawn at random\./);
  delete process.env.PRIZE_WALLET_KEY;
  forgetGroups();
  await handleUpdate(cfg(), TOKEN, joined);
  assert.match(texts().at(-1), /and now and then a quiz, just for fun\./);
  assert.equal(await handleUpdate(cfg(), TOKEN, group('/help', 44)), 'group_help');
  assert.equal(texts().at(-1), `${L.GROUP_HELP}\n\n${GROUP_MUSIC}\n\n${G.gamesNote(false)}`);
  assert.equal(await handleUpdate(cfg(), TOKEN, group('/claim', 45)), 'ignored', 'no prizes: /claim is someone else\'s command');
  process.env.TELEGRAM_GAMES = 'off';
  forgetGroups();
  await handleUpdate(cfg(), TOKEN, joined);
  assert.equal(texts().at(-1), L.groupIntro({ posts: true }), 'quizzes off: her intro as before');
});

// ---------- her words ----------
test('her quiz lines: PG-13, no pet names, no money talk, never asks for a secret, "not financial advice" wherever a prize is announced', () => {
  const r = { answer: 'a clock', right: 3, why: null, winner: { name: 'Mia', amount: 250 } };
  const lines = [
    G.resultLine(r, { winnerId: 5 }).text, G.resultLine(r, { winnerId: 5, button: false }).text,
    ...['none', 'no_prize', 'cap', 'all_won'].map((why) => G.resultLine({ answer: 'a clock', right: 1, why }).text),
    G.gamesNote(true), G.gamesNote(false), G.groupClaim(true), G.groupClaim(false), G.CLAIM_NONE, G.claimAsk(250), G.claimConfirm(250, getAddress(WINNER)),
    G.CLAIM_CHANGE, G.CLAIM_SENDING, G.CLAIM_EXPIRED, G.CLAIM_EMPTY, G.CLAIM_BUSY, G.CLAIM_FAILED, G.CLAIM_ADULT, G.PRIZE_HINT, G.PRIZES_OFF,
    G.claimSent(250, `0x${'1'.repeat(64)}`).text, G.claimAlreadySent(250, `0x${'1'.repeat(64)}`).text, G.claimOnItsWay(null).text,
    ...Object.values(G.ADDRESS_REFUSE), SECRET_WARNING.key, SECRET_WARNING.seed,
  ];
  for (const line of lines) {
    assert.ok(!isCrude(line), line);
    assert.doesNotMatch(line, PET, line);
    assert.doesNotMatch(line, /\b(?:buy|sell|hold|pump|dump|moon|lambo|profit|gains?|invest)\b(?! the)/i, line);
    assert.doesNotMatch(line.replace(/\$AGI\b/g, ''), /\$[A-Za-z]/, line);
    // she never asks for one: every mention of a secret is a "never"
    for (const m of line.matchAll(/seed phrase|private key|signature/gi)) {
      assert.match(line.slice(Math.max(0, m.index - 120), m.index), /never|not|isn't|only ever|careful|looks like/i, `${line} (${m[0]})`);
    }
    for (const host of line.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi) || []) assert.match(host, /^(?:agi1\.app|clank\.trade)$/i, line);
  }
  for (const line of [lines[0], lines[1], G.gamesNote(true), G.claimSent(250, `0x${'1'.repeat(64)}`).text]) assert.match(line, /not financial advice/, line);
  assert.equal(G.CLAIM_HOURS, 24); assert.equal(G.CLAIM_DAYS, 7);
});

// ---------- light, and the database's promises ----------
test('her quizzes\' clock loads light (no chain code until a quiz with a prize goes out), and secrets.js only the word list', () => {
  const imports = (f) => [...readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports('../server/games.js'), ['node:crypto', './tg-api.js', './limits.js', './coins.js', './game-questions.js', './game-lines.js', '../src/chat/telegram-link.js']);
  const src = readFileSync(new URL('../server/games.js', import.meta.url), 'utf8');
  assert.match(src, /await import\('\.\/game-prizes\.js'\)/, 'the prize wallet\'s code only when it\'s needed');
  assert.match(src, /await import\('\.\/telegram\.js'\)/, 'her bot\'s code only to connect it again');
  assert.deepEqual(imports('../server/game-questions.js'), []);
  assert.deepEqual(imports('../server/game-lines.js'), ['./tg-lines.js']);
  assert.deepEqual(imports('../server/secrets.js'), ['@scure/bip39/wordlists/english']);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.dependencies['@scure/bip39'], 'the word list is a package of its own (viem uses the same one)');
  assert.match(pkg.scripts.test, /tests\/games\.test\.js/);
});

test("supabase/games.sql's promises: tables nobody else can read, 14 functions for the server only, the clock with its own key", () => {
  const sql = readFileSync(new URL('../supabase/games.sql', import.meta.url), 'utf8');
  const body = sql.replace(/--.*$/gm, '');
  const tables = ['agi1_game_state', 'agi1_game_groups', 'agi1_game_rounds', 'agi1_game_answers', 'agi1_game_prizes', 'agi1_game_days'];
  for (const t of tables) {
    assert.match(body, new RegExp(`create table if not exists public\\.${t}`));
    assert.match(body, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.match(body, new RegExp(`revoke all on table ${tables.map((t) => `public\\.${t}`).join(',\\s+')}\\s+from anon, authenticated`));
  const fns = ['game_key()', 'game_due(text, integer)', 'game_left(integer)', 'game_recent()', 'game_open(bigint, bigint, text, text, integer, text, boolean, integer)',
    'game_answer(text, bigint, text, integer)', 'game_settle(text, integer, numeric)', 'game_unsettled()', 'game_pending(bigint)', 'game_address(bigint, bigint, text)',
    'game_claim(bigint, bigint)', 'game_sending(bigint, text)', 'game_sent(bigint, text, boolean)', 'game_tidy()'];
  for (const f of fns) {
    const e = f.replace(/[()[\]]/g, (c) => `\\${c}`);
    assert.match(body, new RegExp(`revoke all on function public\\.${e} from public, anon, authenticated`), f);
    assert.match(body, new RegExp(`grant execute on function public\\.${e} to service_role`), f);
  }
  assert.match(body, /cron\.schedule\('agi1-games', '\*\/2 \* \* \* \*'/, 'every 2 minutes');
  assert.match(body, /url := 'https:\/\/www\.agi1\.app\/api\/feed\?games'/, 'www (agi1.app redirects, and a redirect would drop the key)');
  assert.match(body, /'Bearer ' \|\| \(select key from public\.agi1_game_state where id = 1\)/);
  assert.match(body, /\/ 14 as games_ready/);
  assert.doesNotMatch(body, /\bdrop\s+(table|function)\b/i, 'it only adds');
  assert.match(body, /interval '24 hours'/); assert.match(body, /interval '7 days'/);
});

test('the safety note says what her quizzes keep, what a winner is asked for, and that a prize is no investment', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const foot = html.slice(html.indexOf('<footer class="foot"'));
  assert.ok(foot.includes('The $AGI prizes of her quizzes in her Telegram groups are a small thank-you for playing: not an investment, and not financial advice.'));
  assert.ok(foot.includes('If you win one of her quizzes in a Telegram group, she only ever asks for your wallet\'s address, in her own private chat: never your seed phrase, a private key, a signature or a link to connect your wallet.'));
  assert.ok(foot.includes('Anyone there can play her quizzes, but claiming a prize is for adults (18+), in her private chat.'));
  assert.ok(foot.includes("If you answer one of her quizzes there, our database keeps your Telegram account's id, the first name Telegram shows for you (so she can name a winner) and whether you were right, for 3 days"));
  // her polls aren't anonymous (is_anonymous: false, the only kind that tells a bot who answered), and Telegram shows
  // everyone in the group who voted for what (telegram.org/blog/polls-2-0-vmq): the note must say so
  assert.ok(foot.includes('Her quizzes there are Telegram polls with visible votes: like any such poll, everyone in the group can see who answered what'));
});
