// "Launch with AGI-1" (2026-10-01, the owner's idea: people launch a coin on clank.trade from her Telegram bot, with their own
// wallet, and her gas wallet pays the network fee back): her checks, her lines, the bot's /launch, the drafts, /api/launch
// (prepare: what the wallet holds and its coins a day, clank.trade's terms and the pair, the picture to IPFS, the dry run;
// check: the launch read back from the factory, the fee paid back once), the launch page's one transaction
// (src/launch/send.js) and its words, the page itself. Since 2026-10-02: any name and ticker (copies too), 5 coins a day per
// 10,000 $AGI, one link one coin, ETH or SPCX, Phantom.
// Telegram, Supabase, Pinata, clank.trade and Robinhood Chain are fakes: no keys, no cost. (The database here is a JavaScript
// copy of supabase/launch.sql; the SQL itself is run in a real Postgres, PGlite, by Claude before each change: see CLAUDE.md.)
// Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  decodeFunctionData, encodeFunctionData, encodeFunctionResult, encodeErrorResult, parseAbi, parseTransaction, recoverTransactionAddress,
  keccak256, toBytes, toFunctionSelector,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as LL from '../server/launch-lines.js';
import {
  parseLaunch, checkIdea, bestPhoto, launchCall, saltFor, tryLaunch, readLaunch, namedIn, launchTerms, payGasBack,
  gasPlan, sendPlanned, gasWallet, launchWallet, draftUrl, siteBase, LAUNCH_ABI, LAUNCH_SELECTOR, ERRORS, FACTORY, ZERO,
  DRAFT_ID, newDraftId, telegramPicture, pinPicture, launchReady, gasOn, isDraftLaunch, paybackFor, tidyLaunches, gasSoFar, gasFinal,
  launchOpen, launchAllowed, checkLinks, launchesADay, pairOf, PAIRS, SPCX, DRAFTS_PER_CHAT, LAUNCHES_MAX,
} from '../server/launch.js';
import { PER_DAY } from '../src/launch/rules.js';
import { cleanLinks, cleanX, cleanTelegram, cleanWebsite, LINK_FIELDS, LINK_MAX } from '../src/launch/links.js';
import { FACTORY_ABI } from '../server/clank-chain.js';
import { GET as launchGet, POST as launchPost } from '../api/launch.js';
import { POST as webhook } from '../api/telegram.js';
import { webhookSecret, chatCode, COMMANDS, commandsFor } from '../server/telegram.js';
import { tgLinesFor } from '../server/tg-lines.js';
import { makeSession } from '../server/session.js';
import { getConfig, launchTesters } from '../server/config.js';
import { _resetChainCache, AGI_CONTRACT, CHAIN_ID } from '../server/chain.js';
import { _resetBurnKey } from '../server/burn.js';
import { launchBurst, launchPictureBurst, telegramBurst } from '../server/burst.js';
import {
  launchTx, sendLaunch, switchToRobinhood, walletChain, ROBINHOOD, FACTORY as PAGE_FACTORY, LAUNCH_SELECTOR as PAGE_SELECTOR,
} from '../src/launch/send.js';
import { draftIdFrom, WORDS, CHECK, STEP, gasText, ethText, gasNote, GAS_AGAIN, linkNote, capText, perDayText } from '../src/launch/words.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const TOKEN = `123456789:AA${'x'.repeat(33)}`;
const JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LW93bmVyIn0.${'s'.repeat(43)}`;
const GAS_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';   // a well-known test key, never a real wallet
const GAS_WALLET = privateKeyToAccount(GAS_KEY).address.toLowerCase();
const ENV = {
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: SECRET, TELEGRAM_BOT_TOKEN: TOKEN,
  PINATA_JWT: JWT, LAUNCH_GAS_KEY: GAS_KEY, VERCEL_PROJECT_PRODUCTION_URL: 'agi1.app', GEMINI_API_KEY: 'fake', TURNSTILE_SECRET_KEY: 'fake',
};
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const PINATA = 'https://uploads.pinata.cloud/v3/files';
const ALICE = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const BOB = '0x90f79bf6eb2c4f870365e785982e1f101e93b906';
const COIN = '0xc0fe000000000000000000000000000000000001';
const CURVE = '0xc0fe0000000000000000000000000000000000c1';
const CID = 'bafybeiactrc6p6sdhypbyh3cq3zblsgbhjedsm6mkaxyttzh3ovuzrz6jm';
const ECON = `0x${'e1'.repeat(32)}`;
const ECON_SPCX = `0x${'e2'.repeat(32)}`;                                  // (the economics clank.trade pins for an SPCX pair)
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAT = 424242;
const E18 = 10n ** 18n;
const hex = (n) => `0x${BigInt(n).toString(16)}`;
const pad = (a) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
const txOf = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(3000, 7)]);
const SYMBOL_ABI = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)']);
const quiet = () => { console.error = () => {}; console.warn = () => {}; console.log = () => {}; };

// ---------- fakes ----------
let fake, calls, logs;
const today = () => new Date().toISOString().slice(0, 10);
// supabase/launch.sql, as JavaScript (the SQL itself runs in a real Postgres, PGlite, in Claude's checks: the same answers)
function launchDb() {
  const drafts = new Map(), chats = new Map(), wallets = new Map(), days = new Map();
  const day = (d = today()) => { if (!days.has(d)) days.set(d, { drafts: 0, uploads: 0, launches: 0, gas_wei: 0n }); return days.get(d); };
  const wal = (code, d = today()) => { const k = `${code}|${d}`; if (!wallets.has(k)) wallets.set(k, { uploads: 0, refunds: 0 }); return wallets.get(k); };
  const ok = (code) => typeof code === 'string' && code.length >= 16 && code.length <= 64;
  const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
  return {
    drafts, chats, wallets, days, day, wal,
    launch_draft_put({ p_id, p_chat, p_name, p_symbol, p_desc, p_photo, p_minutes, p_per_chat, p_site_daily }) {
      if (!DRAFT_ID.test(p_id) || !ok(p_chat) || !p_name || [...p_name].length > 32 || Buffer.byteLength(p_name) > 64
        || !p_symbol || Buffer.byteLength(p_symbol) > 16 || /[\s\u0000-\u001f\u007f-\u009f]/.test(p_symbol) || [...(p_desc || '')].length > 100 || !(p_photo?.length >= 10) || !(p_minutes >= 1 && p_minutes <= 1440)
        || !(p_per_chat >= 1) || !(p_site_daily >= 1)) return { ok: false, why: 'bad' };
      const s = day();
      let c = chats.get(p_chat);
      if (!c || c.day !== today()) { c = { day: today(), drafts: 0 }; chats.set(p_chat, c); }
      if (c.drafts >= p_per_chat) return { ok: false, why: 'chat_cap' };
      if (s.drafts >= p_site_daily) return { ok: false, why: 'site_cap' };
      if (drafts.has(p_id)) return { ok: false, why: 'bad' };
      const expires = new Date(Date.now() + p_minutes * 60_000).toISOString();
      drafts.set(p_id, { id: p_id, chat_code: p_chat, name: p_name, symbol: p_symbol, description: p_desc || '', photo: p_photo, cid: null, pin_id: null,
        upload_at: null, wallet_code: null, predicted: null, predicted_all: null, token: null, launch_tx: null, created_at: new Date().toISOString(), expires_at: expires, gas_wei: null,
        gas_state: null, gas_why: null, gas_tx: null, gas_at: null });
      c.drafts += 1; s.drafts += 1;
      return { ok: true, expires };
    },
    launch_draft_get({ p_id }) {
      const d = drafts.get(p_id);
      if (!d) return null;
      return { id: d.id, name: d.name, symbol: d.symbol, description: d.description, photo: d.photo, cid: d.cid, wallet: d.wallet_code, predicted: d.predicted, token: d.token,
        launch_tx: d.launch_tx, expires: d.expires_at, expired: Date.parse(d.expires_at) <= Date.now(), gas_wei: d.gas_wei === null ? null : String(d.gas_wei),
        gas_state: d.gas_state, gas_why: d.gas_why, gas_tx: d.gas_tx, gas_stuck: d.gas_state === 'sending' && d.gas_at < Date.now() - 120_000 };
    },
    launch_prepare({ p_id, p_wallet, p_per_wallet, p_site_daily }) {
      if (!DRAFT_ID.test(p_id) || !ok(p_wallet) || !(p_per_wallet >= 1) || !(p_site_daily >= 1)) return { ok: false, why: 'bad' };
      const s = day(), w = wal(p_wallet), d = drafts.get(p_id);
      if (!d) return { ok: false, why: 'gone' };
      if (d.token) return { ok: false, why: 'launched' };
      if (d.wallet_code && d.wallet_code !== p_wallet) return { ok: false, why: 'other_wallet' };
      if (Date.parse(d.expires_at) <= Date.now()) return { ok: false, why: 'expired' };
      if (d.cid) { d.wallet_code = p_wallet; return { ok: true, upload: false, cid: d.cid }; }
      if (d.upload_at) {
        if (d.upload_at > Date.now() - 60_000) return { ok: false, why: 'uploading' };
        Object.assign(d, { wallet_code: p_wallet, upload_at: Date.now() });
        return { ok: true, upload: true, cid: null };
      }
      if (w.uploads >= p_per_wallet) return { ok: false, why: 'wallet_cap' };
      if (s.uploads >= p_site_daily) return { ok: false, why: 'site_cap' };
      w.uploads += 1; s.uploads += 1;
      Object.assign(d, { wallet_code: p_wallet, upload_at: Date.now() });
      return { ok: true, upload: true, cid: null };
    },
    launch_upload_back({ p_id }) {
      const d = drafts.get(p_id);
      if (!d || d.cid || !d.upload_at || !d.wallet_code) return false;
      const at = dayOf(d.upload_at), w = wal(d.wallet_code, at), s = day(at);
      w.uploads = Math.max(0, w.uploads - 1); s.uploads = Math.max(0, s.uploads - 1);
      d.upload_at = null;
      return true;
    },
    launch_set_cid({ p_id, p_cid, p_pin }) {
      const d = drafts.get(p_id);
      if (!d || !d.wallet_code || d.cid || d.token || !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/.test(p_cid)) return false;
      Object.assign(d, { cid: p_cid, pin_id: p_pin ?? null, upload_at: null });
      return true;
    },
    launch_predicted({ p_id, p_wallet, p_token, p_per_wallet = null }) {
      if (!DRAFT_ID.test(p_id) || !ok(p_wallet) || !/^0x[0-9a-f]{40}$/.test(p_token) || (p_per_wallet !== null && !(p_per_wallet >= 1))) return { ok: false, why: 'bad' };
      const w = wal(p_wallet), d = drafts.get(p_id);
      if (!d) return { ok: false, why: 'gone' };
      if (d.token) return { ok: false, why: 'launched' };
      if (d.wallet_code !== p_wallet) return { ok: false, why: 'other_wallet' };
      // the same link got ready again with other details: another coin, one more of the wallet's coins today (an address it
      // already had counts nothing; the newest 20 are kept)
      const seen = d.predicted_all ?? (d.predicted ? [d.predicted] : []);
      if (!seen.includes(p_token)) {
        if (seen.length && p_per_wallet !== null) {
          if (w.uploads >= p_per_wallet) return { ok: false, why: 'wallet_cap' };
          w.uploads += 1;
        }
        seen.push(p_token);
      }
      Object.assign(d, { predicted: p_token, predicted_all: seen.slice(-20) });
      return { ok: true };
    },
    launch_done({ p_id, p_wallet, p_token, p_tx }) {
      if (!/^0x[0-9a-f]{40}$/.test(p_token) || !/^0x[0-9a-f]{64}$/.test(p_tx)) return { ok: false, why: 'bad' };
      const d = drafts.get(p_id);
      if (!d) return { ok: false, why: 'gone' };
      if (d.wallet_code !== p_wallet) return { ok: false, why: 'other_wallet' };
      if (d.token) return { ok: true, token: d.token };
      if ([...drafts.values()].some((o) => o.token === p_token)) return { ok: false, why: 'other_draft' };
      Object.assign(d, { token: p_token, launch_tx: p_tx });
      day().launches += 1;
      return { ok: true, token: p_token };
    },
    launch_gas_claim({ p_id, p_wallet, p_wei, p_per_wallet, p_daily_wei }) {
      const wei = BigInt(p_wei), cap = BigInt(p_daily_wei);
      if (!DRAFT_ID.test(p_id) || !ok(p_wallet) || wei <= 0n || !(p_per_wallet >= 1) || cap <= 0n) return { ok: false, why: 'bad' };
      const s = day(), w = wal(p_wallet), d = drafts.get(p_id);
      if (!d) return { ok: false, why: 'gone' };
      if (!d.token) return { ok: false, why: 'not_launched' };
      if (d.wallet_code !== p_wallet) return { ok: false, why: 'other_wallet' };
      if (d.gas_state === 'claimed' && d.gas_at < Date.now() - 120_000) {        // never got to "sending": given back, claimed again
        const at = dayOf(d.gas_at), ow = wal(p_wallet, at), os = day(at);
        ow.refunds = Math.max(0, ow.refunds - 1); os.gas_wei = os.gas_wei > d.gas_wei ? os.gas_wei - d.gas_wei : 0n;
        Object.assign(d, { gas_state: null, gas_wei: null, gas_at: null });
      }
      if (d.gas_state) {
        return { ok: false, why: 'used', state: d.gas_state, tx: d.gas_tx, wei: d.gas_wei === null ? null : String(d.gas_wei), reason: d.gas_why,
          stuck: d.gas_state === 'sending' && d.gas_at < Date.now() - 120_000 };
      }
      if (w.refunds >= p_per_wallet) { Object.assign(d, { gas_state: 'skipped', gas_why: 'wallet_cap', gas_at: Date.now() }); return { ok: false, why: 'wallet_cap' }; }
      if (s.gas_wei + wei > cap) { Object.assign(d, { gas_state: 'skipped', gas_why: 'site_cap', gas_at: Date.now() }); return { ok: false, why: 'site_cap' }; }
      Object.assign(d, { gas_wei: wei, gas_state: 'claimed', gas_why: null, gas_at: Date.now() });
      w.refunds += 1; s.gas_wei += wei;
      return { ok: true };
    },
    launch_gas_sending({ p_id, p_tx }) {
      const d = drafts.get(p_id);
      if (fake.markFails) return false;
      if (!d || !/^0x[0-9a-f]{64}$/.test(p_tx) || !(d.gas_state === 'claimed' || (d.gas_state === 'sending' && d.gas_at > Date.now() - 60_000))) return false;
      Object.assign(d, { gas_state: 'sending', gas_tx: p_tx, gas_at: Date.now() });
      return true;
    },
    launch_gas_sent({ p_id, p_tx, p_ok }) {
      const d = drafts.get(p_id);
      if (!d || d.gas_state !== 'sending' || (p_ok && !/^0x[0-9a-f]{64}$/.test(p_tx))) return false;
      if (p_ok) { Object.assign(d, { gas_state: 'sent', gas_tx: p_tx, gas_at: Date.now() }); return true; }
      const at = dayOf(d.gas_at), w = wal(d.wallet_code, at), s = day(at);
      w.refunds = Math.max(0, w.refunds - 1); s.gas_wei = s.gas_wei > d.gas_wei ? s.gas_wei - d.gas_wei : 0n;
      Object.assign(d, { gas_state: null, gas_wei: null, gas_tx: null, gas_at: null });
      return true;
    },
    launch_tidy() {
      const now = Date.now();
      // (the pins, with where their draft's own launch would have put its coin)
      for (const d of drafts.values()) if (d.pin_id && !d.token && [...drafts.values()].some((l) => l.cid === d.cid && l.token)) d.pin_id = null;
      for (const [k, d] of drafts) if (Date.parse(d.created_at ?? d.expires_at) < now - 7 * 86_400_000 && (!d.pin_id || d.token)) drafts.delete(k);
      const pins = [...drafts.values()].filter((d) => d.pin_id && !d.token && Date.parse(d.expires_at) < now - 3_600_000
        && ![...drafts.values()].some((o) => o.cid === d.cid && o.id !== d.id && (o.token || Date.parse(o.expires_at) > now - 3_600_000)))
        .map((d) => ({ pin: d.pin_id, predicted: d.predicted, predicted_all: d.predicted_all ?? [] }));
      return { pins: pins.slice(0, 50) };
    },
    launch_unpinned({ p_pins }) {
      let n = 0;
      for (const d of drafts.values()) if (p_pins.includes(d.pin_id) && !d.token) { d.pin_id = null; n += 1; }
      return n;
    },
  };
}

// Robinhood Chain: the $AGI contract, clank.trade's factory and the coins it made, receipts, and the gas wallet's payback
function chainAnswer(q) {
  const c = fake.chain;
  const reverted = (data = '0x') => ({ error: { code: 3, message: 'execution reverted', data } });
  if (q.method === 'eth_call') {
    const { to, data, from, value } = q.params[0];
    if (to === AGI_CONTRACT) {
      if (data === '0x313ce567') return { result: encodeFunctionResult({ abi: SYMBOL_ABI, functionName: 'decimals', result: 18 }) };
      return { result: encodeFunctionResult({ abi: SYMBOL_ABI, functionName: 'balanceOf', result: c.agi[`0x${data.slice(-40)}`] ?? 0n }) };
    }
    if (to === FACTORY) {
      const sel = data.slice(0, 10);
      if (sel === toFunctionSelector(FACTORY_ABI[0])) {
        const { args } = decodeFunctionData({ abi: FACTORY_ABI, data });
        const coin = String(args[0]).toLowerCase(), l = c.launched[coin];
        const none = { launchToken: ZERO, curve: ZERO, deployer: ZERO, creatorFeeRecipient: ZERO, pairToken: ZERO, graduationThreshold: 0n, poolFee: 0,
          tickSpacing: 0, creatorTaxBps: 0, buybackEnabled: false, phase: 0, sweptPairToken: 0n, sweptLaunchTokens: 0n, sweptAt: 0n, exists: false };
        return { result: encodeFunctionResult({ abi: FACTORY_ABI, functionName: 'getLaunchedToken',
          result: l ? { ...none, launchToken: coin, curve: l.curve, deployer: l.deployer, creatorFeeRecipient: l.deployer, graduationThreshold: 4n * E18, exists: true } : none }) };
      }
      const { functionName, args } = decodeFunctionData({ abi: LAUNCH_ABI, data });
      const notApproved = () => reverted(encodeErrorResult({ abi: parseAbi(['error PairTokenNotApproved()']), errorName: 'PairTokenNotApproved' }));
      const taken = (pair) => String(pair).toLowerCase() === ZERO || c.pairs[String(pair).toLowerCase()] === true;
      if (functionName === 'canLaunch') return { result: encodeFunctionResult({ abi: LAUNCH_ABI, functionName, result: c.open }) };
      if (functionName === 'launchFee') return { result: encodeFunctionResult({ abi: LAUNCH_ABI, functionName, result: c.fee }) };
      if (functionName === 'approvedPairTokens') {
        c.pairAsks.push(String(args[0]).toLowerCase());
        return { result: encodeFunctionResult({ abi: LAUNCH_ABI, functionName, result: c.pairs[String(args[0]).toLowerCase()] === true }) };
      }
      if (functionName === 'previewLaunchEconomics') {
        assert.equal(args[0], 0n, 'launch config 0');
        c.econAsks.push(String(args[1]).toLowerCase());
        if (!taken(args[1])) return notApproved();
        return { result: encodeFunctionResult({ abi: LAUNCH_ABI, functionName, result: String(args[1]).toLowerCase() === ZERO ? c.economics : c.economicsSpcx }) };
      }
      if (functionName === 'launchToken') {
        c.dryRuns.push({ from, value, params: args[0], config: args[1], pair: String(args[2]).toLowerCase() });
        if (!taken(args[2])) return notApproved();
        if (c.dryRun) return reverted(c.dryRun);
        // (where the coin would be: fixed by its creator and details, like the real factory's; the plain launch of a test's
        // draft is at COIN, any other details somewhere else)
        const at = c.byDetails ? `0x${keccak256(data).slice(-40)}` : c.predicted.token;
        return { result: encodeFunctionResult({ abi: LAUNCH_ABI, functionName, result: [at, c.predicted.curve] }) };
      }
      return reverted();
    }
    const sym = c.symbols[to];
    if (sym !== undefined && data === toFunctionSelector(SYMBOL_ABI[0])) return { result: encodeFunctionResult({ abi: SYMBOL_ABI, functionName: 'symbol', result: sym }) };
    return reverted();
  }
  if (q.method === 'eth_getTransactionReceipt') return { result: c.receipts[q.params[0]] ?? null };
  if (q.method === 'eth_getTransactionByHash') {
    if (c.byHashDown) return { error: { code: -32603, message: 'internal error' } };
    return { result: c.txs[q.params[0]] ?? null };
  }
  if (q.method === 'eth_getCode') return { result: c.codes[String(q.params[0]).toLowerCase()] ?? '0x' };
  // the gas wallet (only ever the payback's own reads and its one send)
  const g = c.gas;
  if (q.method === 'eth_getBalance') { assert.equal(q.params[0].toLowerCase(), GAS_WALLET); return { result: hex(g.balance) }; }
  if (q.method === 'eth_gasPrice') return { result: hex(g.price) };
  if (q.method === 'eth_getTransactionCount') { assert.equal(q.params[0].toLowerCase(), GAS_WALLET); return { result: hex(g.nonce) }; }
  if (q.method === 'eth_estimateGas') {
    if (g.balance < BigInt(q.params[0].value)) return { error: { code: -32000, message: 'insufficient funds for transfer' } };
    return { result: hex(g.estimate) };
  }
  if (q.method === 'eth_sendRawTransaction') {
    const step = g.sendPlan.length ? g.sendPlan.shift() : 'ok';
    g.raws.push({ raw: q.params[0], step });
    if (step === 'nonce') { g.nonce += 1; return { error: { code: -32000, message: 'nonce too low: next nonce 8, tx nonce 7' } }; }
    if (step === 'nonce_known') {                                    // (a node that lost its own first answer, then refused a repeat)
      c.txs[keccak256(q.params[0])] = { hash: keccak256(q.params[0]) };
      g.nonce += 1;
      return { error: { code: -32000, message: 'nonce too low: next nonce 8, tx nonce 7' } };
    }
    if (step === 'funds') return { error: { code: -32000, message: 'insufficient funds for gas * price + value' } };
    if (step === 'weird') return { error: { code: -32000, message: 'context deadline exceeded' } };
    if (step === 'lost') {                                           // it went out, but the answer was lost (and the node says nothing clear)
      c.txs[keccak256(q.params[0])] = { hash: keccak256(q.params[0]) };
      return { error: { code: -32000, message: 'nonce too low: next nonce 9, tx nonce 8' } };
    }
    if (step === 'known') return { error: { code: -32000, message: 'already known' } };
    return { result: keccak256(q.params[0]) };
  }
  throw new Error(`the server asked the chain for ${q.method}`);
}

beforeEach(() => {
  for (const k of ['SITE_URL', 'ROBINHOOD_RPC_URL', 'LAUNCH_GAS_MAX', 'LAUNCH_GAS_DAILY', 'LAUNCH_DAILY_CAP', 'LAUNCH_ONLY_FOR']) delete process.env[k];
  Object.assign(process.env, ENV);
  _resetChainCache();
  _resetBurnKey();
  launchBurst.reset();
  launchPictureBurst.reset();
  telegramBurst.reset();
  logs = [];
  console.error = (...a) => logs.push(['error', a.join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.join(' ')]);
  console.log = () => {};
  calls = [];
  fake = {
    db: launchDb(), friends: new Map([[CHAT, { chat_id: CHAT, adult: true, tz_minutes: 0, seen_id: 0, day: null, sent: 0 }]]),
    dbDown: false, sqlMissing: false, burns: null,
    clank: [], clankDown: false, picture: JPEG, pictureGone: false, telegramDown: false, pinata: 'ok', pinned: [], unpinned: [], pinDuplicate: false,
    chain: {
      down: false, agi: { [ALICE]: 20_000n * E18, [BOB]: 20_000n * E18 }, open: true, fee: 0n, economics: ECON, dryRun: null, dryRuns: [],
      pairs: { [SPCX]: true }, economicsSpcx: ECON_SPCX, pairAsks: [], econAsks: [],
      predicted: { token: COIN, curve: CURVE }, receipts: {}, txs: {}, codes: {}, launched: {}, symbols: {},
      gas: { balance: E18, price: 100_000_000n, nonce: 7, estimate: 25_000n, sendPlan: [], raws: [] },
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url === RPC) {
      const body = JSON.parse(init.body);
      calls.push({ to: 'chain', body });
      if (fake.chain.down) return new Response('busy', { status: 503 });
      const answer = (q) => ({ jsonrpc: '2.0', id: q.id, ...chainAnswer(q) });
      return Response.json(Array.isArray(body) ? body.map(answer) : answer(body));
    }
    if (url.startsWith('https://api.telegram.org/')) {
      const body = init.body ? JSON.parse(init.body) : null;
      const method = url.split('/').pop();
      calls.push({ to: 'telegram', method, body, url });
      if (fake.telegramDown) return new Response('bad gateway', { status: 502 });
      if (url.startsWith(`https://api.telegram.org/file/bot${TOKEN}/`)) return new Response(fake.picture, { status: 200 });
      if (method === 'getFile') {
        if (fake.pictureGone) return Response.json({ ok: false, error_code: 400, description: 'Bad Request: invalid file_id' }, { status: 400 });
        return Response.json({ ok: true, result: { file_id: body.file_id, file_unique_id: 'u1', file_size: fake.picture.length, file_path: 'photos/file_7.jpg' } });
      }
      return Response.json({ ok: true, result: { message_id: 99 } });
    }
    if (url === PINATA) {
      calls.push({ to: 'pinata', init });
      if (fake.pinata === 'down') return Response.json({ error: 'nope' }, { status: 503 });
      if (fake.pinata === 'bad_key') return Response.json({ error: 'Unauthorized' }, { status: 401 });
      assert.equal(init.headers.Authorization, `Bearer ${JWT}`);
      assert.ok(init.body instanceof FormData, 'a form upload');
      const file = init.body.get('file');
      fake.pinned.push({ network: init.body.get('network'), name: init.body.get('name'), type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
      return Response.json({ data: { id: `pin-${fake.pinned.length}`, name: init.body.get('name'), cid: CID, size: file.size, mime_type: file.type, is_duplicate: fake.pinDuplicate === true } });
    }
    if (url.startsWith('https://api.pinata.cloud/v3/files/public/')) {
      calls.push({ to: 'pinata', method: init.method, url });
      assert.equal(init.method, 'DELETE');
      assert.equal(init.headers.Authorization, `Bearer ${JWT}`);
      if (fake.pinata === 'down') return new Response('nope', { status: 503 });
      fake.unpinned.push(url.split('/').pop());
      return Response.json({ data: null });
    }
    if (url.startsWith('https://fake.supabase.co/rest/v1/rpc/')) {
      const fn = url.split('/').pop();
      const body = JSON.parse(init.body);
      calls.push({ to: 'db', fn, body });
      if (fake.dbDown) return Response.json({ message: 'boom' }, { status: 500 });
      if (fn.startsWith('burn_')) {
        if (!fake.burns) return Response.json({ code: 'PGRST202', message: 'Could not find the function' }, { status: 404 });
        return Response.json(fn === 'burn_key' ? 'c'.repeat(64) : { left: 0, bought: 0, agi: fake.burns.agi, today: 0 });
      }
      if (fake.sqlMissing && fn.startsWith('launch_')) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      if (fn === 'tg_get') { const r = fake.friends.get(body.p_chat); return Response.json(r ?? null); }
      if (fn === 'tg_join') {
        if (!fake.friends.has(body.p_chat)) fake.friends.set(body.p_chat, { chat_id: body.p_chat, adult: false, tz_minutes: null, seen_id: 0, day: null, sent: 0 });
        return Response.json(fake.friends.get(body.p_chat));
      }
      if (!fake.db[fn]) throw new Error(`unexpected database function ${fn}`);
      return Response.json(fake.db[fn](body) ?? null);
    }
    if (url.startsWith('https://clank.trade/v1/trpc/')) {
      calls.push({ to: 'clank', url });
      if (fake.clankDown) return new Response('<html>Just a moment...</html>', { status: 403 });
      const u = new URL(url);
      const input = JSON.parse(u.searchParams.get('input'));
      return Response.json(u.pathname.slice('/v1/trpc/'.length).split(',').map((name, i) => {
        if (name !== 'coins.list' || fake.clank404) return { error: { data: { httpStatus: 404 } } };
        const q = String(input[i]?.query ?? input[i]?.json?.query ?? '').toLowerCase();
        const all = fake.clank.filter((c) => `${c.symbol} ${c.name}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(q.replace(/[^a-z0-9 ]/g, '')));
        const n = input[i]?.cursor ? Number(input[i].cursor.slice(1)) : 0;
        const page = all.slice(n * 12, n * 12 + 12).map((c, k) => ({ id: `market:4663:0x${String(n * 12 + k + 1).padStart(40, '0')}`,
          address: `0x${String(n * 12 + k + 1).padStart(40, '0')}`, name: c.name, symbol: c.symbol, image: '', createdAt: '1', marketCap: 1, state: 0, progress: 1 }));
        return { result: { data: { coins: page, nextCursor: n * 12 + 12 < all.length ? `p${n + 1}` : null } } };
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});

const cfg = () => getConfig();
const session = (wallet = ALICE, level = 2) => makeSession(SECRET, { wallet, level, checkedAt: Date.now() });
const chainCalls = (method) => calls.filter((c) => c.to === 'chain').flatMap((c) => (Array.isArray(c.body) ? c.body : [c.body])).filter((q) => !method || q.method === method);
const db = (fn) => calls.filter((c) => c.to === 'db' && c.fn === fn);
const tg = (method) => calls.filter((c) => c.to === 'telegram' && c.method === method);
const texts = () => tg('sendMessage').map((c) => c.body.text);
const get = (q, ip = '203.0.113.7') => launchGet(new Request(`https://agi1.app/api/launch?${q}`, { headers: { 'x-real-ip': ip } }));
const post = (body, { ip = '203.0.113.7', type = 'application/json' } = {}) => launchPost(new Request('https://agi1.app/api/launch', {
  method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));
// a draft, as her bot saves it
function draft(o = {}) {
  const id = o.id ?? newDraftId();
  const r = fake.db.launch_draft_put({ p_id: id, p_chat: o.chat ?? `t:${newDraftId()}`, p_name: o.name ?? 'Sleepy Cat', p_symbol: o.symbol ?? 'SLEEPY',
    p_desc: o.description ?? 'a cat who naps all day', p_photo: o.photo ?? 'AgACAgQAAxkBAAIBY2ZpZmZ5', p_minutes: o.minutes ?? 120, p_per_chat: 5, p_site_daily: 300 });
  assert.equal(r.ok, true);
  return id;
}
// a launch on the chain: clank.trade's factory made `token` for `from`, in transaction `tx`, whose call is `draft`'s own launch
// (input: another call instead)
const SLEEPY = { id: 'Abc_def-0123456789ABCD', name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'a cat who naps all day', cid: CID };
function launched({ tx = txOf(1), from = ALICE, token = COIN, curve = CURVE, status = '0x1', to = FACTORY, gasUsed = 2_000_000n, price = 100_000_000n, logs,
  draft: d = SLEEPY, input, value = '0x0', sender = from } = {}) {
  fake.chain.launched[token] = { deployer: from, curve };
  fake.chain.txs[tx] = { hash: tx, from: sender, to, value, input: input ?? launchCall({ ...d, wallet: from, economics: ECON }).data };
  fake.chain.receipts[tx] = {
    transactionHash: tx, status, from: sender, to, gasUsed: hex(gasUsed), effectiveGasPrice: hex(price), blockNumber: '0x10',
    logs: logs ?? [
      { address: token, topics: [TRANSFER, pad(ZERO), pad(curve)], data: hex(10n ** 27n), removed: false },
      { address: FACTORY, topics: [`0x${'ab'.repeat(32)}`, pad(token), pad(curve), pad(from)], data: '0x', removed: false },
    ],
  };
  return tx;
}
// what the API's database has for a draft (after prepare): to read its launch back
const asDraft = (id) => { const d = fake.db.drafts.get(id); return { id, name: d.name, symbol: d.symbol, description: d.description, cid: d.cid }; };
const prepare = (id, s = session()) => post({ action: 'prepare', draft: id, session: s });
const check = (id, tx, s = session()) => post({ action: 'check', draft: id, session: s, tx });

// ---------- the page's one transaction (src/launch/send.js: hard rule 9's launch exception) ----------
function wallet(o = {}) {
  const asked = [];
  return {
    asked,
    provider: {
      async request({ method, params }) {
        asked.push({ method, params });
        if (method === 'eth_chainId') return o.chain ?? '0x1237';
        if (method === 'wallet_switchEthereumChain') { if (o.unknownChain) { const e = new Error('Unrecognized chain ID'); e.code = 4902; throw e; } return null; }
        if (method === 'wallet_addEthereumChain') return null;
        if (method === 'eth_sendTransaction') return o.hash ?? `0x${'AB'.repeat(32)}`;
        throw new Error(`unexpected ${method}`);
      },
    },
  };
}
const prepared = (o = {}) => ({ ...launchCall({ id: 'A'.repeat(22), name: 'Sleepy Cat', symbol: 'SLEEPY', cid: CID, wallet: ALICE, economics: ECON }), chainId: CHAIN_ID, ...o });

test('the page sends exactly one thing: clank.trade\'s launch, to its factory, with no ETH, on Robinhood Chain', async () => {
  assert.equal(PAGE_FACTORY, FACTORY, 'the page and the server name the same factory');
  assert.equal(PAGE_SELECTOR, LAUNCH_SELECTOR);
  assert.equal(toFunctionSelector(LAUNCH_ABI.find((f) => f.name === 'launchToken')), LAUNCH_SELECTOR, 'the selector of the documented launchToken');
  assert.equal(ROBINHOOD.chainId, CHAIN_ID);
  assert.equal(parseInt(ROBINHOOD.hex, 16), CHAIN_ID);
  // what the server builds passes, as it is
  const tx = launchTx(ALICE, prepared());
  assert.deepEqual(Object.keys(tx).sort(), ['chainId', 'data', 'from', 'to', 'value']);
  assert.equal(tx.to, FACTORY);
  assert.equal(tx.value, '0x0');
  assert.equal(tx.chainId, '0x1237');
  // anything else is refused before a wallet sees it
  for (const bad of [
    { to: BOB }, { to: '' }, { data: `0xa9059cbb${'0'.repeat(128)}` },                 // a token transfer
    { data: `0x095ea7b3${'0'.repeat(128)}` },                                          // a token approval
    { data: '0x' }, { data: 'f35abbcf00' }, { data: `0xf35abbcf${'0'.repeat(20_000)}` }, { data: '0xf35abbcfzz' },
    { value: '0x1' }, { value: '0xde0b6b3a7640000' }, { value: 1 }, { chainId: 1 }, { chainId: '4663' }, { chainId: undefined },
  ]) {
    assert.throws(() => launchTx(ALICE, prepared(bad)), /not_a_launch/, JSON.stringify(bad).slice(0, 80));
  }
  assert.throws(() => launchTx('not-an-address', prepared()), /not_a_launch/);
  assert.throws(() => launchTx(ALICE, null), /not_a_launch/);
  // sending: only on Robinhood Chain, and only that
  const w = wallet();
  assert.equal(await sendLaunch(w.provider, ALICE, prepared()), `0x${'ab'.repeat(32)}`, 'the hash, lowercase');
  assert.deepEqual(w.asked.map((a) => a.method), ['eth_chainId', 'eth_sendTransaction']);
  assert.deepEqual(w.asked[1].params, [launchTx(ALICE, prepared())]);
  const other = wallet({ chain: '0x1' });
  await assert.rejects(sendLaunch(other.provider, ALICE, prepared()), /wrong_chain/);
  assert.ok(!other.asked.some((a) => a.method === 'eth_sendTransaction'), 'never on another network');
  const odd = wallet({ hash: 'yes' });
  await assert.rejects(sendLaunch(odd.provider, ALICE, prepared()), /no_hash/);
  const evil = wallet();
  await assert.rejects(sendLaunch(evil.provider, ALICE, prepared({ to: BOB })), /not_a_launch/);
  assert.equal(evil.asked.length, 0, 'a wrong call never reaches the wallet');
  // switching networks: only when pressed, adding Robinhood Chain if the wallet doesn't know it
  const sw = wallet({ unknownChain: true });
  await switchToRobinhood(sw.provider);
  assert.deepEqual(sw.asked.map((a) => a.method), ['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
  assert.deepEqual(sw.asked[1].params, [ROBINHOOD.add]);
  assert.equal(ROBINHOOD.add.rpcUrls[0], RPC);
  assert.equal(await walletChain(wallet({ chain: '0x1237' }).provider), 4663);
  assert.equal(await walletChain(wallet({ chain: 'nope' }).provider), null);
});

// ---------- her checks ----------
test('reading "/launch Name | TICKER | line": in a caption, on separate lines, with the bot\'s name', () => {
  assert.equal(parseLaunch('hello'), null);
  assert.equal(parseLaunch('/launches'), null);
  assert.equal(parseLaunch('/launchSLEEPY'), null);
  assert.equal(parseLaunch(null), null);
  assert.deepEqual(parseLaunch('/launch'), { empty: true });
  assert.deepEqual(parseLaunch('  /launch   '), { empty: true });
  assert.deepEqual(parseLaunch(LL.EXAMPLE), { name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'a cat who naps all day' });
  assert.deepEqual(parseLaunch('/launch@agi1_appbot Sleepy Cat|SLEEPY'), { name: 'Sleepy Cat', symbol: 'SLEEPY', description: '' });
  assert.deepEqual(parseLaunch('/LAUNCH Sleepy Cat\nSLEEPY\na cat\nwho naps'), { name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'a cat who naps' });
  assert.deepEqual(parseLaunch('/launch Sleepy Cat | SLEEPY | naps | a lot'), { name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'naps a lot' });
  assert.deepEqual(parseLaunch('/launch Sleepy Cat'), { name: 'Sleepy Cat', symbol: '', description: '' });
});

test('her checks of a coin: a name and a ticker can be almost anything (copies too), PG-13, no links, nothing like her or $AGI', () => {
  const ok = (name, symbol, description = '') => checkIdea({ name, symbol, description });
  // tidied: spaces, fullwidth letters, invisible characters, a "$" in front; a ticker keeps the case it's typed in
  assert.deepEqual(ok('  Sleepy   Cat ', '$sleepy', ' a cat who naps all day '), { ok: true, name: 'Sleepy Cat', symbol: 'sleepy', description: 'a cat who naps all day' });
  assert.deepEqual(ok('Ｓｌｅｅｐｙ​ Cat', 'ＳＬＥＥＰＹ'), { ok: true, name: 'Sleepy Cat', symbol: 'SLEEPY', description: '' }, 'fullwidth letters and invisible characters');
  assert.equal(ok('Cat 💜', 'CAT').ok, true, 'an emoji in its name is fine');
  assert.equal(ok('E/ACC', 'EACC').ok, true, 'a "/" between letters');
  const why = (name, symbol, description = '') => ok(name, symbol, description).why;
  // since 2026-10-02 (the owner: "the ticker it can be anything … its okay if its a copycat"): any ticker clank.trade takes
  for (const s of ['C', 'TOOLONGTICKER', 'MC-AT', 'ÇAT', 'wif', 'Pepe', '🐸', 'CA$H', 'E/ACC', 'ABCDEFGHIJKLMNOP', 'ПЕПЕ', '猫', 'DOGE2.0', '420']) {
    assert.equal(why('Cat', s), undefined, s);
    assert.equal(ok('Cat', s).symbol, s, `${s}: as typed`);
  }
  // …another coin's name and ticker too (clank.trade's search isn't asked any more)
  for (const [n, s] of [['Pepe', 'PEPE'], ['Dogwifhat', 'WIF'], ['Space Inu', 'SI'], ['Bitcoin', 'BTC']]) assert.equal(why(n, s), undefined, n);
  // a name or a ticker that's nothing, too long for clank.trade, or a ticker with a space
  assert.equal(why('', 'CAT'), 'name');
  assert.equal(why('x'.repeat(33), 'CAT'), 'name');
  assert.equal(why('💜'.repeat(17), 'CAT'), 'name', 'clank.trade allows 64 bytes');
  assert.equal(why('!!!', 'CAT'), 'name', 'punctuation alone');
  for (const s of ['', 'MC AT', 'X'.repeat(17), '💜'.repeat(5), '猫'.repeat(6), '!!!', '$']) assert.equal(why('Cat', s), 'symbol', s);
  assert.equal(why('Cat', 'CAT', 'x'.repeat(101)), 'description');
  assert.equal(why('Cat', 'CAT', '💜'.repeat(76)), 'description', '300 bytes');
  for (const d of ['see https://x.io', 'cat.com', 'join t.me/cats', 'www.cats', 'by @catdev']) assert.equal(why('Cat', 'CAT', d), 'link', d);
  for (const [n, s] of [['Cat.com', 'CAT'], ['Cat', 'DOGE.AI'], ['Cat', '@CAT']]) assert.equal(why(n, s), 'link', `${n} ${s}`);
  for (const d of ['#1 cat', '<b>cat</b>', '`cat`', 'a /stop cat', 'cat/', '{cat}', 'a\\b']) assert.equal(why('Cat', 'CAT', d), 'characters', d);
  assert.equal(why('Cat', '#CAT'), 'characters');
  assert.equal(why('Horny Cat', 'CAT'), 'crude');
  assert.equal(why('Cat', 'CAT', 'a sexy cat'), 'crude');
  assert.equal(why('Cat', 'HORNY'), 'crude', 'a ticker is PG-13 too');
  // "official": a copy is fine, a coin made with her is nobody's official one
  for (const [n, s, d] of [['Official Cat', 'CAT'], ['Pepe', 'PEPE', 'the official pepe'], ['Cat', 'OFFICIAL']]) assert.equal(why(n, s, d), 'official', `${n} ${s} ${d}`);
  for (const [n, s, d] of [['AGI Cat', 'CAT'], ['Cat', 'CAT', 'by agi-1'], ['Cat', 'CAT', 'the artificial girlfriend'],
    ['Cat', 'AGI'], ['Cat', 'AGI2'], ['Cat', 'XAGI'], ['Cat', 'agi'], ['Cat', 'Agi'], ['Cat', 'A.G.I'], ['A.G.I', 'CAT'], ['Cat', 'CAT', 'agi1.app']]) {
    assert.ok(['agi', 'link'].includes(why(n, s, d)), `${n} ${s} ${d}`);
  }
  assert.equal(why('Magic Cat', 'MAGIC'), undefined, '"magic" isn\'t "agi"');
  // anything shaped like a link or an address, whatever its ending (her reply would make it one)
  for (const d of ['airdrop.info', 'bit.ly/freecat', 'cats.ru', 'free.site/x', 'Mr.Cat', 'ipfs://abc', '0xfa31d0446274']) assert.equal(why('Cat', 'CAT', d), 'link', d);
  for (const ok2 of [['St. Bernard', 'STB'], ['Doge 2.0', 'DOGE2'], ['Pumpkin Cat', 'PKIN'], ['Dumpling', 'DUMP'], ['Rugby Cat', 'RUGB'], ['Scampi', 'SCMP'], ['Agile Dog', 'AGL'], ['Moon Cat', 'MCAT']]) {
    assert.equal(why(...ok2), undefined, ok2[0]);
  }
  // money talk and lures she won't repeat, in its line: buying or selling, promises, airdrops, another coin's $TICKER
  for (const d of ['buy $PEPE too', 'pump it', '100x soon', 'guaranteed', 'free money', 'presale now', 'to the moon']) assert.equal(why('Cat', 'CAT', d), 'money', d);
  // …but a name and a ticker are the creator's own words ("the name doesnt matter")
  for (const [n, s] of [['Pump It', 'PUMP'], ['Baby $PEPE', 'BPEPE'], ['100x Cat', '100X'], ['Moon Pump', 'BUY']]) assert.equal(why(n, s), undefined, n);
  // her look-alikes: numbers and other alphabets don't hide "AGI", in a name or a ticker
  for (const [n, sym] of [['AGI2', 'ACAT'], ['АGI Cat', 'ACAT'], ['1AGI', 'ONE'], ['AGIX Girlfriend', 'AGX'], ['ᴀɢɪ Cat', 'ACAT'], ['ꓮꓖꓲ Cat', 'ACAT'], ['𝐀𝐆𝐈 Cat', 'ACAT'], ['AG1 Cat', 'ACAT'],
    ['Cat', 'АGI'], ['Cat', 'аgi'], ['Cat', 'AGІ']]) {
    assert.equal(why(n, sym), 'agi', `${n} ${sym}`);
  }
  // since tickers keep their case and any alphabet (2026-10-02): what LOOKS like AGI stays out (a small l or a 1 for the I,
  // accents, boxed letters, flags' letters, invisible fillers)
  for (const sym of ['AGl', 'agl', 'ÀGI', 'AGÍ', 'ÅGI', 'AĞI', 'AGİ', '🅰🅶🅸', '🇦🇬🇮', 'AGꟾ', 'AGl1', 'A\u3164GI', 'A\uFFA0GI', 'AG1', 'Agi']) assert.equal(why('Cat', sym), 'agi', sym);
  for (const n of ['ÀGI Cat', 'AGl Cat', 'Agl dog', '🅰🅶🅸 Cat', 'A\u3164GI Cat']) assert.equal(why(n, 'CAT'), 'agi', n);
  for (const [n, sym] of [['Agile Dog', 'AGL'], ['Magic Cat', 'maglev'], ['Bagel', 'MAGLEV']]) assert.equal(why(n, sym), undefined, `${n} ${sym}`);
  for (const [n, sym] of [['Cat', 'OFFICIALDOGE'], ['Cat', 'OfficialTrump'], ['Officially Cute', 'CUTE'], ['Cat', 'ÓFFICIAL']]) assert.equal(why(n, sym), 'official', `${n} ${sym}`);
  // emoji made of several (joined, skin tones, flags) stay whole; an invisible filler alone is nothing
  for (const sym of ['👩‍💻', '🏳️‍🌈', '👩🏽‍💻', '🇺🇸']) assert.equal(ok('Cat', sym).symbol, sym, sym);
  assert.equal(ok('Coder 👩‍💻', 'CODE').name, 'Coder 👩‍💻');
  assert.equal(ok('Cat', 'C\u200dAT').symbol, 'CAT', 'a joiner between letters goes');
  assert.equal(why('Cat', '\u3164'), 'symbol', 'a Hangul filler alone');
  assert.equal(why('\u3164\u3164', 'CAT'), 'name');
  assert.equal(why('Wäifu Cat', 'WC'), 'egirl', 'accents don\'t hide an egirl coin');
  // egirl coins: her feed would tell everyone she's not ok about it
  for (const [n, sym] of [['Waifu Cat', 'WAIFU'], ['Cat', 'GF'], ['Ai Wife', 'AIW'], ['Egirl', 'EGIRL'], ['Cat', 'waifu']]) assert.equal(why(n, sym), 'egirl', n);
  assert.equal(checkIdea(null).why, 'name');
  // her example passes her own checks
  assert.equal(checkIdea(parseLaunch(LL.EXAMPLE)).ok, true);
});

test('the picture: the biggest Telegram size up to 1280 px and 1 MB, never a tiny one', () => {
  const p = (w, h, id = `file-${w}x${h}-0123`, size) => ({ file_id: id, width: w, height: h, ...(size ? { file_size: size } : {}) });
  assert.equal(bestPhoto([p(90, 90), p(320, 320), p(800, 800), p(1280, 1280), p(2560, 2560)]), 'file-1280x1280-0123');
  assert.equal(bestPhoto([p(320, 240), p(1280, 960, 'big-one-0123', 2_000_000), p(800, 600)]), 'file-800x600-0123', 'over 1 MB: the next one');
  assert.equal(bestPhoto([p(90, 90), p(150, 1200)]), null, 'too small on a side');
  assert.equal(bestPhoto([{ file_id: 'bad id!', width: 800, height: 800 }]), null);
  assert.equal(bestPhoto(null), null);
  assert.equal(bestPhoto([p(2560, 1440)]), null);
});

// ---------- her lines ----------
const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(buy|buying|sell|selling|hold|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|fraud\w*|safe|guarantee\w*)\b|\b\d+x\b|sex|nude|naked|horny/i;
test('her launch lines: PG-13, no pet names (anyone 18+ can start the bot), never money advice, "not financial advice", only her site\'s links', () => {
  const url = 'https://agi1.app/launch/AAAAAAAAAAAAAAAAAAAAAA';
  const lines = [LL.howLine(), LL.howLine({ gasBack: true }), LL.HOW, LL.NOT_OPEN, LL.NEED_PHOTO, LL.AS_PHOTO, LL.CHAT_CAP, LL.SITE_CAP,
    ...Object.values(LL.REFUSE).map((r) => (typeof r === 'function' ? r('SLEEPY') : r)),
    LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'a cat who naps all day', url }), LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url, gasBack: true })];
  for (const line of lines) {
    assert.equal(typeof line, 'string');
    assert.doesNotMatch(line, NOT_OK, line);
    assert.ok(line.length <= 4096, 'Telegram\'s limit');
    assert.doesNotMatch(line, /https?:\/\/(?!agi1\.app)/, 'links only to the site');
  }
  for (const line of [LL.howLine(), LL.howLine({ gasBack: true }), lines.at(-1), lines.at(-2)]) assert.match(line, /not financial advice/);
  assert.match(LL.howLine(), /your own wallet/);
  assert.match(LL.howLine(), /i never touch your keys or your money/);
  assert.match(LL.howLine(), /i won't promote your coin/);
  assert.match(LL.howLine(), /18\+ only/);
  assert.doesNotMatch(LL.howLine(), /pay it back/, 'no payback promised while her gas wallet is off');
  assert.match(LL.howLine({ gasBack: true }), /i pay it back once your coin is live/);
  assert.match(LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url }), new RegExp(`${url}`));
  assert.match(LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url }), /keep it to yourself/);
  assert.match(LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url }), /10,000\+ \$AGI/, 'the real Crush number');
  // the coins a wallet may launch a day (2026-10-02): the same rule, in her words and the page's; copies are fine; ETH or SPCX
  assert.equal(PER_DAY, '5 coins a day for every 10,000 $AGI, up to 50 a day with 100,000+');
  for (const line of [LL.howLine(), LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url })]) assert.ok(line.includes(PER_DAY), line);
  assert.match(LL.howLine(), /copies of other coins too/);
  assert.match(LL.howLine(), /paired with ETH or SPCX/);
  assert.doesNotMatch(Object.values(LL.REFUSE).join(' '), /already a \$|pick another ticker|so many coins/, 'no "taken" any more');
  assert.match(LL.readyLine({ name: 'Sleepy Cat', symbol: 'SLEEPY', url }), /MetaMask, Coinbase Wallet, Phantom/);
  // her buttons: the link itself, and the same page inside a wallet app (Phantom since 2026-10-02)
  const rows = LL.readyButtons(url);
  assert.deepEqual(rows.flat().map((b) => b.url), [url, 'https://metamask.app.link/dapp/agi1.app/launch/AAAAAAAAAAAAAAAAAAAAAA',
    `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent('https://agi1.app')}`,
    `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`]);
  assert.deepEqual(rows.flat().map((b) => b.text), ['Open on agi1.app ↗', 'Open in MetaMask ↗', 'Open in Phantom ↗', 'Open in Coinbase Wallet ↗']);
  assert.ok(rows.every((row) => row.length <= 2), 'at most two buttons a row (they stay readable on a phone)');
  // in her bot's menu, and in /help (her 16 languages) while launching is open
  assert.ok(COMMANDS.some((c) => c.command === 'launch'));
  for (const code of ['en', 'es', 'ja', 'ar']) {
    const L = tgLinesFor(code);
    assert.match(L.HELP_LAUNCH, /\/launch/);
    assert.doesNotMatch(L.HELP, /\/launch/);
    assert.ok(L.HELP_LAUNCH.startsWith(L.HELP.split('\n\n')[0]), 'the same help, with one more command');
  }
});

// ---------- Robinhood Chain: clank.trade's launch, its dry run, and reading it back ----------
test('the launch call is clank.trade\'s own, as its docs write it: no tax, no buyback, ETH, config 0, their wallet as creator, one salt per draft', () => {
  const id = 'Abc_def-0123456789ABCD';
  const call = launchCall({ id, name: 'Sleepy Cat', symbol: 'SLEEPY', description: 'a cat who naps all day', cid: CID, wallet: ALICE, economics: ECON });
  assert.equal(call.to, FACTORY);
  assert.equal(call.value, '0x0');
  assert.equal(call.data.slice(0, 10), LAUNCH_SELECTOR);
  const { functionName, args } = decodeFunctionData({ abi: LAUNCH_ABI, data: call.data });
  assert.equal(functionName, 'launchToken');
  const [params, config, pair] = args;
  assert.equal(config, 0n);
  assert.equal(pair, ZERO);
  assert.equal(params.name, 'Sleepy Cat');
  assert.equal(params.symbol, 'SLEEPY');
  assert.equal(params.logo, `ipfs://${CID}`);
  assert.equal(params.description, 'a cat who naps all day');
  assert.deepEqual(params.socials, { twitter: '', telegram: '', discord: '', website: '', farcaster: '' }, 'nobody\'s links');
  assert.equal(params.creatorFeeRecipient.toLowerCase(), ALICE);
  assert.equal(params.creatorTaxBps, 0);
  assert.equal(params.buybackEnabled, false);
  assert.equal(params.expectedEconomics, ECON, 'the pinned terms');
  assert.equal(params.salt, saltFor(id));
  assert.equal(saltFor(id), keccak256(toBytes(`agi1-launch:${id}`)));
  assert.notEqual(saltFor(id), saltFor('Abc_def-0123456789ABCE'), 'each draft its own salt');
  // clank.trade's limits (bytes): name 64, symbol 16, logo 256, description 1,024
  assert.ok(Buffer.byteLength(params.logo) <= 256);
  // paired with SPCX when they pick it (2026-10-02), never anything else
  assert.equal(SPCX, '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea', 'the quote token clank.trade\'s own SPCX coins name');
  assert.deepEqual(PAIRS, { eth: ZERO, spcx: SPCX });
  const spcx = decodeFunctionData({ abi: LAUNCH_ABI, data: launchCall({ id, name: 'Sleepy Cat', symbol: 'SLEEPY', cid: CID, wallet: ALICE, economics: ECON_SPCX, pair: SPCX }).data });
  assert.equal(spcx.args[2].toLowerCase(), SPCX);
  assert.equal(spcx.args[0].expectedEconomics, ECON_SPCX, 'the economics pinned for that pair');
  assert.throws(() => launchCall({ id, name: 'Sleepy Cat', symbol: 'SLEEPY', cid: CID, wallet: ALICE, economics: ECON, pair: BOB }), /not a pair/);
  assert.deepEqual([pairOf(undefined), pairOf('eth'), pairOf('spcx')], [ZERO, ZERO, SPCX]);
  for (const bad of ['', 'ETH', 'doge', 'constructor', '__proto__', SPCX, 1, {}]) assert.equal(pairOf(bad), null, String(bad));
  // a ticker of any case, other alphabets, emoji: as typed, inside clank.trade's 16 bytes
  const odd = decodeFunctionData({ abi: LAUNCH_ABI, data: launchCall({ id, name: 'Пепе 🐸', symbol: 'пепе🐸', cid: CID, wallet: ALICE, economics: ECON }).data });
  assert.deepEqual([odd.args[0].name, odd.args[0].symbol], ['Пепе 🐸', 'пепе🐸']);
  // the documented errors, by their first 4 bytes (LaunchEconomicsMismatch takes two values)
  const sel = (sig) => keccak256(toBytes(sig)).slice(0, 10);
  assert.equal(ERRORS[sel('LaunchAlreadyExists()')], 'exists');
  assert.equal(ERRORS[sel('LaunchEconomicsMismatch(bytes32,bytes32)')], 'economics');
  assert.equal(ERRORS[sel('InvalidMetadata()')], 'metadata');
  assert.equal(ERRORS[sel('NotWhitelisted()')], 'closed');
  assert.equal(ERRORS[sel('LaunchFeeNotPaid()')], 'fee');
  assert.equal(ERRORS[sel('PairTokenNotApproved()')], 'pair');
});

test('clank.trade\'s terms (canLaunch, its fee, the economics to pin) and the dry run from their wallet, with each documented "no"', async () => {
  assert.deepEqual(await launchTerms(ALICE), { open: true, fee: 0n, approved: true, economics: ECON });
  assert.deepEqual(fake.chain.pairAsks, [], 'ETH is always a pair: its list isn\'t asked');
  // SPCX: on the factory's approved list, with its own economics to pin
  assert.deepEqual(await launchTerms(ALICE, undefined, SPCX), { open: true, fee: 0n, approved: true, economics: ECON_SPCX });
  assert.deepEqual([fake.chain.pairAsks, fake.chain.econAsks.at(-1)], [[SPCX], SPCX]);
  // off its list: its economics can't be read (the factory's "no"), and that's an answer, not an error
  fake.chain.pairs[SPCX] = false;
  assert.deepEqual(await launchTerms(ALICE, undefined, SPCX), { open: true, fee: 0n, approved: false, economics: null });
  fake.chain.pairs[SPCX] = true;
  fake.chain.open = false;
  fake.chain.fee = 5n;
  assert.deepEqual(await launchTerms(ALICE), { open: false, fee: 5n, approved: true, economics: ECON });
  const call = launchCall({ id: 'A'.repeat(22), name: 'Sleepy Cat', symbol: 'SLEEPY', cid: CID, wallet: ALICE, economics: ECON });
  assert.deepEqual(await tryLaunch(call, ALICE), { ok: true, token: COIN, curve: CURVE });
  assert.equal(fake.chain.dryRuns.at(-1).from, ALICE, 'tried from their wallet, as their wallet will send it');
  assert.equal(fake.chain.dryRuns.at(-1).value, '0x0');
  const err = (name, args) => encodeErrorResult({ abi: parseAbi([`error ${name}`]), errorName: name.split('(')[0], args });
  for (const [e, args, why] of [['LaunchAlreadyExists()', [], 'exists'], ['LaunchEconomicsMismatch(bytes32 expected, bytes32 actual)', [ECON, `0x${'00'.repeat(32)}`], 'economics'],
    ['InvalidMetadata()', [], 'metadata'], ['NotWhitelisted()', [], 'closed'], ['LaunchConfigDisabled()', [], 'config'],
    ['NativeValueMismatch(uint256 sent, uint256 expected)', [0n, 5n], 'fee'], ['PairTokenNotApproved()', [], 'pair'], ['UnsupportedBuyback()', [], 'reverted']]) {
    fake.chain.dryRun = err(e, args);
    assert.deepEqual(await tryLaunch(call, ALICE), { ok: false, why }, e);
  }
  fake.chain.dryRun = '0x';
  assert.deepEqual(await tryLaunch(call, ALICE), { ok: false, why: 'reverted' });
  fake.chain.down = true;
  await assert.rejects(tryLaunch(call, ALICE), /chain: HTTP 503/);
  await assert.rejects(launchTerms(ALICE), /chain/);
});

test('reading a launch back: this draft\'s own call, by this wallet, to the factory, and the coin as the factory records it', async () => {
  assert.deepEqual(await readLaunch(txOf(9), ALICE, SLEEPY), { ok: false, why: 'pending' });
  const tx = launched();
  const r = await readLaunch(tx, ALICE, SLEEPY);
  assert.deepEqual(r, { ok: true, token: COIN, curve: CURVE, from: ALICE, fee: 2_000_000n * 100_000_000n });
  const records = chainCalls('eth_call').filter((q) => q.params[0].data.startsWith(toFunctionSelector(FACTORY_ABI[0])));
  assert.ok(records.length >= 1 && records.length <= 8, 'the factory asked about what the transaction named, in one batch');
  assert.ok(calls.some((c) => c.to === 'chain' && Array.isArray(c.body)), 'one batch request');
  assert.deepEqual(await readLaunch(tx, BOB, SLEEPY), { ok: false, why: 'not_launch' }, 'another wallet');
  // one launch is one draft's: its salt and every detail must be this draft's
  assert.deepEqual(await readLaunch(tx, ALICE, { ...SLEEPY, id: 'Zzz_def-0123456789ABCD' }), { ok: false, why: 'not_launch' }, 'another draft (its own salt)');
  for (const other of [{ name: 'Sleepy Kat' }, { symbol: 'SLEEP' }, { description: 'buy it' }, { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' }]) {
    launched({ tx: txOf(20), draft: { ...SLEEPY, ...other } });
    assert.deepEqual(await readLaunch(txOf(20), ALICE, SLEEPY), { ok: false, why: 'not_launch' }, `a launch with other details: ${JSON.stringify(other)}`);
  }
  const theirs = (params) => encodeFunctionData({ abi: LAUNCH_ABI, functionName: 'launchToken', args: [{ ...decodeFunctionData({ abi: LAUNCH_ABI, data: launchCall({ ...SLEEPY, wallet: ALICE, economics: ECON }).data }).args[0], ...params }, 0n, ZERO] });
  for (const params of [{ socials: { twitter: 'x.com/me', telegram: '', discord: '', website: '', farcaster: '' } }, { creatorTaxBps: 100 }, { buybackEnabled: true }, { creatorFeeRecipient: BOB }]) {
    launched({ tx: txOf(21), input: theirs(params) });
    assert.deepEqual(await readLaunch(txOf(21), ALICE, SLEEPY), { ok: false, why: 'not_launch' }, JSON.stringify(params).slice(0, 60));
  }
  launched({ tx: txOf(22), value: '0x1' });
  assert.deepEqual(await readLaunch(txOf(22), ALICE, SLEEPY), { ok: false, why: 'not_launch' }, 'with ETH');
  launched({ tx: txOf(23), input: `0xa9059cbb${'0'.repeat(128)}` });
  assert.deepEqual(await readLaunch(txOf(23), ALICE, SLEEPY), { ok: false, why: 'not_launch' }, 'not a launch at all');
  // the coin is found whatever the factory's event looks like: here only the coin's own first transfer names it
  launched({ tx: txOf(2), token: '0xc0fe000000000000000000000000000000000002', logs: [
    { address: '0xc0fe000000000000000000000000000000000002', topics: [TRANSFER, pad(ZERO), pad(CURVE)], data: '0x01', removed: false }] });
  assert.equal((await readLaunch(txOf(2), ALICE, SLEEPY)).token, '0xc0fe000000000000000000000000000000000002');
  // …and never from a log the chain took back, a failed transaction, or one that went through another contract
  launched({ tx: txOf(3), token: '0xc0fe000000000000000000000000000000000003', logs: [
    { address: '0xc0fe000000000000000000000000000000000003', topics: [TRANSFER, pad(ZERO), pad(CURVE)], data: '0x01', removed: true }] });
  assert.deepEqual(await readLaunch(txOf(3), ALICE, SLEEPY), { ok: false, why: 'not_launch' });
  launched({ tx: txOf(4), status: '0x0' });
  assert.deepEqual(await readLaunch(txOf(4), ALICE, SLEEPY), { ok: false, why: 'failed' });
  launched({ tx: txOf(5), to: '0xac20d0d5cc0f89ee4f6d5f8e6870a36eaf2e0dd7' });
  assert.deepEqual(await readLaunch(txOf(5), ALICE, SLEEPY), { ok: false, why: 'not_launch' }, 'through another contract (the forwarder)');
  // a coin the factory didn't make (a look-alike's own logs)
  launched({ tx: txOf(6), logs: [{ address: BOB, topics: [TRANSFER, pad(ZERO), pad(ALICE)], data: '0x01' }] });
  delete fake.chain.launched[COIN];
  assert.deepEqual(await readLaunch(txOf(6), ALICE, SLEEPY), { ok: false, why: 'not_launch' });
  // a receipt or a transaction that isn't this one
  fake.chain.receipts[txOf(7)] = fake.chain.receipts[tx];
  fake.chain.txs[txOf(7)] = fake.chain.txs[tx];
  await assert.rejects(readLaunch(txOf(7), ALICE, SLEEPY), /unexpected receipt/);
  // what the logs name: contracts, not the factory, the wallet or 0x0, at most 8
  assert.deepEqual(namedIn(fake.chain.receipts[tx], ALICE), [COIN, CURVE]);
  const many = { logs: Array.from({ length: 12 }, (_, i) => ({ address: `0x${String(i + 1).padStart(40, '7')}`, topics: [] })) };
  assert.equal(namedIn(many, ALICE).length, 8);
  // the draft's own launch, by its call
  const call = launchCall({ ...SLEEPY, wallet: ALICE, economics: ECON });
  assert.equal(isDraftLaunch(call.data, SLEEPY, ALICE), true);
  assert.equal(isDraftLaunch(call.data, SLEEPY, BOB), false);
  assert.equal(isDraftLaunch(launchCall({ ...SLEEPY, wallet: ALICE, economics: ECON_SPCX, pair: SPCX }).data, SLEEPY, ALICE), true, 'paired with SPCX');
  const otherPair = encodeFunctionData({ abi: LAUNCH_ABI, functionName: 'launchToken', args: [decodeFunctionData({ abi: LAUNCH_ABI, data: call.data }).args[0], 0n, BOB] });
  assert.equal(isDraftLaunch(otherPair, SLEEPY, ALICE), false, 'a pair the page never offers');
  assert.equal(isDraftLaunch('0x', SLEEPY, ALICE), false);
});

// ---------- her gas wallet pays the network fee back (the owner's choice) ----------
function liveDraft(wallet = ALICE, token = COIN) {
  const id = draft();
  const code = launchWallet(SECRET, wallet);
  Object.assign(fake.db.drafts.get(id), { wallet_code: code, token });
  return { id, code };
}
const payBack = (d, o = {}) => payGasBack(cfg(), { id: d.id, code: d.code, wallet: ALICE, from: ALICE, fee: 200_000_000_000_000n, deadline: Date.now() + 20_000, ...o });
const sentRaws = () => fake.chain.gas.raws;

test('paying a launch\'s fee back: once, to its creator, at most LAUNCH_GAS_MAX, signed by the gas wallet on Robinhood Chain', async () => {
  const d = liveDraft();
  const r = await payBack(d);
  assert.equal(r.paid, true);
  assert.equal(r.wei, '200000000000000');
  assert.equal(sentRaws().length, 1);
  const raw = sentRaws()[0].raw;
  assert.equal(r.tx, keccak256(raw));
  const t = parseTransaction(raw);
  assert.equal(t.type, 'eip1559');
  assert.equal(t.chainId, CHAIN_ID);
  assert.equal(t.to.toLowerCase(), ALICE, 'to the coin\'s creator');
  assert.equal(t.value, 200_000_000_000_000n, 'exactly what the launch cost');
  assert.equal(t.nonce, 7);
  assert.equal(t.gas, 30_000n, 'the estimate and a fifth');
  assert.equal(t.maxFeePerGas, 200_000_000n);
  assert.equal(t.maxPriorityFeePerGas ?? 0n, 0n);
  assert.equal((await recoverTransactionAddress({ serializedTransaction: raw })).toLowerCase(), GAS_WALLET);
  assert.equal(t.data ?? '0x', '0x', 'plain ETH, no contract call');
  assert.equal(fake.db.drafts.get(d.id).gas_state, 'sent');
  assert.equal(fake.db.drafts.get(d.id).gas_tx, r.tx);
  // asked again (a reload, a second check): the same answer, nothing sent
  assert.deepEqual(await payBack(d), { paid: true, wei: '200000000000000', tx: r.tx });
  assert.equal(sentRaws().length, 1);
  // a launch that cost more: LAUNCH_GAS_MAX at most (0.001 ETH unless set)
  const big = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000002');
  fake.db.wallets.clear();
  assert.equal((await payBack(big, { fee: 5n * 10n ** 15n })).wei, String(10n ** 15n));
  // the gas wallet's address for the owner; its key never in a log line
  assert.equal(gasWallet(cfg()), GAS_WALLET);
  assert.ok(!logs.some(([, l]) => l.includes(GAS_KEY.slice(2))));
});

test('two checks at the same moment pay once; another wallet, an unknown fee or no gas wallet pay nothing', async () => {
  const d = liveDraft();
  const [a, b] = await Promise.all([payBack(d), payBack(d)]);
  assert.equal(sentRaws().length, 1, 'one payback');
  assert.deepEqual([a.paid, b.paid].sort(), [false, true]);
  assert.equal((a.paid ? b : a).why, 'pending', 'the other one: being paid right now');
  assert.deepEqual(await payBack(liveDraft(), { from: BOB }), { paid: false, why: 'not_sender' });
  assert.deepEqual(await payBack(liveDraft(), { fee: null }), { paid: false, why: 'unknown' });
  assert.deepEqual(await payBack(liveDraft(), { fee: 0n }), { paid: false, why: 'unknown' });
  delete process.env.LAUNCH_GAS_KEY;
  assert.equal(gasOn(cfg()), false);
  assert.deepEqual(await payBack(liveDraft()), { paid: false, why: 'off' });
  process.env.LAUNCH_GAS_KEY = 'not-a-key';
  assert.equal(gasOn(cfg()), false, 'a key that isn\'t one: off');
  assert.equal(sentRaws().length, 1);
});

test('nothing is claimed until the gas wallet can pay: an empty wallet, the chain away, no time left → asked again later', async () => {
  const d = liveDraft();
  fake.chain.gas.balance = 100n;
  assert.deepEqual(await payBack(d), { paid: false, why: 'empty' });
  assert.ok(logs.some(([k, l]) => k === 'warn' && l.includes(GAS_WALLET) && /out of ETH/.test(l)), 'the owner\'s log names the gas wallet to top up');
  assert.equal(db('launch_gas_claim').length, 0, 'nothing claimed');
  fake.chain.gas.balance = 203_000_000_000_000n;                    // enough for the fee (0.0002 ETH), not with its own gas (0.000006)
  assert.deepEqual(await payBack(d), { paid: false, why: 'empty' });
  fake.chain.gas.balance = E18;
  fake.chain.down = true;
  assert.deepEqual(await payBack(d), { paid: false, why: 'busy' });
  fake.chain.down = false;
  const before = calls.length;
  assert.deepEqual(await payBack(d, { deadline: Date.now() + 5000 }), { paid: false, why: 'busy' });
  assert.equal(calls.length, before, 'not started without time to finish');
  assert.equal(db('launch_gas_claim').length, 0);
  assert.equal(sentRaws().length, 0);
  // topped up: paid
  assert.equal((await payBack(d)).paid, true);
});

test('sending: a taken nonce once more, a clear "no" gives the claim back, no clear answer counts as sent (never twice)', async () => {
  const d1 = liveDraft();
  fake.chain.gas.sendPlan = ['nonce'];
  const r1 = await payBack(d1);
  assert.equal(r1.paid, true);
  assert.deepEqual(sentRaws().map((s) => parseTransaction(s.raw).nonce), [7, 8], 'the next nonce');
  assert.equal(r1.tx, keccak256(sentRaws()[1].raw));
  // the chain says "insufficient funds": nothing went out, so the claim (and its place in the caps) is given back
  fake.db.wallets.clear();
  const d2 = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000002');
  fake.chain.gas.sendPlan = ['funds'];
  assert.deepEqual(await payBack(d2), { paid: false, why: 'empty' });
  assert.equal(fake.db.drafts.get(d2.id).gas_state, null);
  assert.equal(fake.db.wal(d2.code).refunds, 0, 'its wallet\'s payback for today given back');
  assert.equal((await payBack(d2)).paid, true, 'the next check pays it');
  // an answer that says nothing clear: it may be on its way, so it counts as sent and is never sent again
  fake.db.wallets.clear();
  const d3 = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000003');
  fake.chain.gas.sendPlan = ['weird'];
  const r3 = await payBack(d3);
  assert.equal(r3.paid, true);
  const n = sentRaws().length;
  assert.deepEqual(await payBack(d3), r3);
  assert.equal(sentRaws().length, n);
  fake.db.wallets.clear();
  fake.chain.gas.sendPlan = ['known'];
  assert.equal((await payBack(liveDraft(ALICE, '0xc0fe000000000000000000000000000000000004'))).paid, true, '"already known": it\'s on its way');
  // "nonce too low" for a transaction the chain already has: it went out, so it's never signed again with the next nonce
  fake.db.wallets.clear();
  const before = sentRaws().length;
  fake.chain.gas.sendPlan = ['nonce_known'];
  const r5 = await payBack(liveDraft(ALICE, '0xc0fe000000000000000000000000000000000005'));
  assert.equal(r5.paid, true);
  assert.equal(sentRaws().length, before + 1, 'one transaction, not two');
  assert.equal(r5.tx, keccak256(sentRaws().at(-1).raw));
});

test('never twice, whatever the chain answers: its own transaction found by its hash, "can\'t tell" stays "sending" until it\'s found', async () => {
  // the retry with the next nonce is answered "nonce too low" too, for the retry itself (its answer was lost): found, sent once
  fake.chain.gas.sendPlan = ['nonce', 'lost'];
  const d1 = liveDraft();
  const r1 = await payBack(d1);
  assert.equal(r1.paid, true);
  assert.equal(sentRaws().length, 2);
  assert.equal(r1.tx, keccak256(sentRaws()[1].raw), 'the retry, which went out');
  assert.equal(fake.db.drafts.get(d1.id).gas_state, 'sent');
  // "nonce too low" and the chain can't be asked by hash: whether it went out can't be told, so it stays "sending"
  fake.db.wallets.clear();
  fake.chain.gas.sendPlan = ['lost'];
  fake.chain.byHashDown = true;
  const d2 = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000002');
  assert.deepEqual(await payBack(d2), { paid: false, why: 'pending' });
  const row = fake.db.drafts.get(d2.id);
  assert.equal(row.gas_state, 'sending');
  assert.equal(row.gas_tx, keccak256(sentRaws().at(-1).raw), 'with the transaction that may have gone out');
  const n = sentRaws().length;
  // a later check: the chain knows it now, so it's sent (and never sent again)
  fake.chain.byHashDown = false;
  assert.deepEqual(await payBack(d2), { paid: true, wei: '200000000000000', tx: row.gas_tx });
  assert.equal(fake.db.drafts.get(d2.id).gas_state, 'sent');
  assert.equal(sentRaws().length, n);
  // a payback that couldn't be recorded before it went out is never sent
  fake.db.wallets.clear();
  fake.markFails = true;
  const d3 = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000003');
  assert.deepEqual(await payBack(d3), { paid: false, why: 'busy' });
  assert.equal(sentRaws().length, n, 'nothing sent');
  fake.markFails = false;
  // a taken nonce whose own transaction isn't on the chain: once more with the next nonce while there's time, else nothing
  // went out (its nonce is someone else's), so it's given back
  const plan = { to: ALICE, value: 1n, nonce: 7, gas: 30_000n, maxFee: 200_000_000n };
  fake.chain.gas.sendPlan = ['nonce'];
  assert.deepEqual(await sendPlanned(GAS_KEY, plan, undefined, { deadline: Date.now() + 4000 }), { ok: false, why: 'failed' });
  fake.chain.gas.sendPlan = ['nonce'];
  assert.equal((await sendPlanned(GAS_KEY, plan, undefined, { deadline: Date.now() + 12_000 })).ok, true);
  // each transaction is recorded before it goes out (the retry too)
  const marks = [];
  fake.chain.gas.sendPlan = ['nonce'];
  const r5 = await sendPlanned(GAS_KEY, plan, undefined, { mark: async (h) => { marks.push(h); return true; } });
  assert.equal(marks.length, 2);
  assert.equal(r5.tx, marks[1]);
  assert.deepEqual(await sendPlanned(GAS_KEY, plan, undefined, { mark: async () => false }), { ok: false, why: 'unmarked' });
});

test('one payback a day per wallet and LAUNCH_GAS_DAILY for the site: a coin over a cap is skipped for good', async () => {
  const d1 = liveDraft();
  assert.equal((await payBack(d1)).paid, true);
  const d2 = liveDraft(ALICE, '0xc0fe000000000000000000000000000000000002');
  assert.deepEqual(await payBack(d2), { paid: false, why: 'wallet_cap' });
  fake.db.wallets.clear();                                          // "tomorrow"
  assert.deepEqual(await payBack(d2), { paid: false, why: 'wallet_cap' }, 'not paid on another day either');
  process.env.LAUNCH_GAS_DAILY = '0.0003';
  const d3 = liveDraft(BOB, '0xc0fe000000000000000000000000000000000003');
  assert.deepEqual(await payBack(d3, { wallet: BOB, from: BOB }), { paid: false, why: 'site_cap' });
  assert.equal(fake.db.drafts.get(d3.id).gas_why, 'site_cap');
  assert.equal(sentRaws().length, 1);
  // a claim whose server copy stopped before "sending": "being paid" for 2 minutes, then given back and paid
  delete process.env.LAUNCH_GAS_DAILY;
  const d4 = liveDraft(BOB, '0xc0fe000000000000000000000000000000000004');
  Object.assign(fake.db.drafts.get(d4.id), { gas_state: 'claimed', gas_wei: 1n, gas_at: Date.now() - 10_000 });
  assert.deepEqual(await payBack(d4, { wallet: BOB, from: BOB }), { paid: false, why: 'pending' });
  assert.equal(sentRaws().length, 1, 'nothing sent while another check may be paying it');
  fake.db.drafts.get(d4.id).gas_at = Date.now() - 180_000;
  assert.equal((await payBack(d4, { wallet: BOB, from: BOB })).paid, true, 'it never got to "sending": safe to pay');
  assert.equal(sentRaws().length, 2);
  // one being sent over 2 minutes ago that never said how it went: "stuck", never sent again
  const d5 = liveDraft(BOB, '0xc0fe000000000000000000000000000000000005');
  Object.assign(fake.db.drafts.get(d5.id), { gas_state: 'sending', gas_wei: 1n, gas_at: Date.now() - 180_000 });
  assert.deepEqual(await payBack(d5, { wallet: BOB, from: BOB }), { paid: false, why: 'stuck' });
  assert.deepEqual(gasSoFar(fake.db.launch_draft_get({ p_id: d5.id })), { paid: false, why: 'stuck' });
  assert.equal(sentRaws().length, 2);
});

test('her gas wallet\'s settings: a real private key or off, amounts in ETH', () => {
  process.env.LAUNCH_GAS_MAX = '0.002';
  process.env.LAUNCH_GAS_DAILY = '0.05';
  assert.equal(cfg().launchGasMaxWei, 2n * 10n ** 15n);
  assert.equal(cfg().launchGasDailyWei, 5n * 10n ** 16n);
  for (const bad of ['-1', 'lots', '1e9', '']) {
    process.env.LAUNCH_GAS_MAX = bad;
    assert.equal(cfg().launchGasMaxWei, 10n ** 15n, `"${bad}": the default`);
  }
  process.env.LAUNCH_GAS_KEY = `  ${GAS_KEY}  `;
  assert.equal(cfg().launchGasKey, GAS_KEY);
  // as MetaMask's "Show private key" gives it: without its "0x" (any case)
  process.env.LAUNCH_GAS_KEY = GAS_KEY.slice(2).toUpperCase();
  assert.equal(cfg().launchGasKey, GAS_KEY.toLowerCase());
  assert.equal(gasWallet(cfg()), privateKeyToAccount(GAS_KEY).address.toLowerCase());
  for (const bad of [`${GAS_KEY}00`, GAS_KEY.slice(3), '0xnothex'.padEnd(66, 'z'), `0x0x${GAS_KEY.slice(2)}`]) {
    process.env.LAUNCH_GAS_KEY = bad;
    assert.equal(cfg().launchGasKey, '');
  }
});

test('a gas wallet setting that isn\'t a key: paybacks are off, and the log says why once (never the setting itself)', async () => {
  process.env.LAUNCH_GAS_KEY = 'not-a-key-1234';
  for (let i = 0; i < 2; i++) await prepare(draft());
  const said = logs.filter(([, line]) => line.includes('LAUNCH_GAS_KEY'));
  assert.equal(said.length, 1, 'once per server copy');
  assert.doesNotMatch(said[0][1], /not-a-key-1234/);
  assert.equal(gasOn(cfg()), false);
});

// ---------- the coin's links (optional) ----------
test('the coin\'s links: X, Telegram and a website, all optional, tidied the same way on the page and our server', () => {
  const same = (fn, cases) => { for (const [typed, saved] of cases) assert.equal(fn(typed), saved, JSON.stringify(typed)); };
  same(cleanX, [
    ['', ''], ['  ', ''], [undefined, ''], ['@SleepyCat', 'https://x.com/SleepyCat'], ['sleepy_cat', 'https://x.com/sleepy_cat'],
    ['x.com/SleepyCat', 'https://x.com/SleepyCat'], ['https://twitter.com/SleepyCat/', 'https://x.com/SleepyCat'], ['www.x.com/a1', 'https://x.com/a1'],
    ['https://x.com/SleepyCat/status/123', null], ['sleepycat.com', null], ['@', null], ['sixteen_letters_', null], ['@sleepy cat', null],
    ['https://evil.com/x.com/SleepyCat', null], ['javascript:alert(1)', null],
  ]);
  same(cleanTelegram, [
    ['', ''], ['@sleepy_cats', 'https://t.me/sleepy_cats'], ['t.me/sleepy_cats', 'https://t.me/sleepy_cats'], ['https://telegram.me/sleepycats/', 'https://t.me/sleepycats'],
    ['t.me/+AbCdEf123_x-Z', 'https://t.me/+AbCdEf123_x-Z'], ['https://t.me/joinchat/AbCdEf1234', 'https://t.me/+AbCdEf1234'],
    ['cats', null], ['t.me/1cats', null], ['t.me/sleepy_cats/12', null], ['https://t.me.evil.com/sleepy_cats', null], ['t.me/+short', null],
  ]);
  same(cleanWebsite, [
    ['', ''], ['sleepycat.com', 'https://sleepycat.com/'], ['https://SleepyCat.com/About?x=1#top', 'https://sleepycat.com/About?x=1#top'],
    ['https://sleepy-cat.co.uk', 'https://sleepy-cat.co.uk/'],
    ['http://sleepycat.com', null], ['https://192.168.1.1', null], ['https://localhost', null], ['localhost:3000', null], ['https://[::1]/', null],
    ['https://user:pw@sleepycat.com', null], ['https://sleepycat.com:8443', null], ['javascript:alert(1)', null], ['data:text/html,hi', null],
    ['ftp://sleepycat.com', null], ['https://xn--slepycat-abc.com', null], ['https://slееpycat.com', null], ['sleepy cat.com', null],
    [`https://sleepycat.com/${'a'.repeat(LINK_MAX)}`, null],
  ]);
  // tidying a tidied link gives it back unchanged (so the read-back can compare a launch's links with ours)
  for (const v of ['https://x.com/SleepyCat', 'https://t.me/sleepy_cats', 'https://t.me/+AbCdEf123_x-Z', 'https://sleepycat.com/About?x=1#top']) {
    assert.equal(cleanLinks({ twitter: v.includes('x.com') ? v : '', telegram: v.includes('t.me') ? v : '', website: /x\.com|t\.me/.test(v) ? '' : v }).ok, true, v);
  }
  assert.equal(cleanX(cleanX('@SleepyCat')), 'https://x.com/SleepyCat');
  assert.equal(cleanTelegram(cleanTelegram('t.me/joinchat/AbCdEf1234')), 'https://t.me/+AbCdEf1234');
  assert.equal(cleanWebsite(cleanWebsite('SleepyCat.com/About')), 'https://sleepycat.com/About');
  // all three, any of them empty: the first one that's wrong is named
  assert.deepEqual(cleanLinks({}), { ok: true, links: { twitter: '', telegram: '', website: '' } });
  assert.deepEqual(cleanLinks(null), { ok: true, links: { twitter: '', telegram: '', website: '' } });
  assert.deepEqual(cleanLinks({ twitter: '@a_b', website: 'sleepycat.com' }), { ok: true, links: { twitter: 'https://x.com/a_b', telegram: '', website: 'https://sleepycat.com/' } });
  assert.deepEqual(cleanLinks({ twitter: '@a_b', telegram: 'nope', website: 'http://x' }), { ok: false, field: 'telegram' });
  assert.deepEqual(cleanLinks({ website: 5 }), { ok: false, field: 'website' });
  assert.deepEqual(cleanLinks({ twitter: 'a'.repeat(LINK_MAX + 1) }), { ok: false, field: 'twitter' });
  assert.deepEqual(LINK_FIELDS, ['twitter', 'telegram', 'website']);
  // our server also says no to anything about her or $AGI, and to crude words (never a coin that looks like hers)
  const no = (links) => { const c = checkLinks(links); return c.ok ? 'ok' : `${c.field}:${c.why}`; };
  assert.equal(no({ website: 'https://agi1.app/' }), 'website:agi');
  assert.equal(no({ website: 'www.agi1.app/launch/x' }), 'website:agi');
  assert.equal(no({ twitter: '@agi1dotapp' }), 'twitter:agi');
  assert.equal(no({ twitter: '@AGI' }), 'twitter:agi');
  assert.equal(no({ telegram: 't.me/agi1_appbot' }), 'telegram:agi');
  assert.equal(no({ website: 'https://sleepycat.com/agi' }), 'website:agi');
  assert.equal(no({ twitter: '@horny_cat' }), 'twitter:crude');
  assert.equal(no({ website: 'hornycat.com' }), 'website:crude');
  assert.equal(no({ telegram: 'nope' }), 'telegram:format');
  assert.equal(no({ website: 'https://agile.dev', twitter: '@magic_cat', telegram: 't.me/+AgI1xyz12345' }), 'ok', 'words that only contain the letters, and random invite codes, are fine');
  // what the page says under a box
  assert.equal(linkNote('twitter', 'https://x.com/a'), 'Saved as https://x.com/a');
  assert.equal(linkNote('twitter', ''), '');
  for (const f of LINK_FIELDS) assert.equal(linkNote(f, null), WORDS[`link_${f}`]);
  assert.equal(linkNote('website', null, 'agi'), WORDS.link_agi);
  assert.equal(linkNote('website', null, 'crude'), WORDS.link_crude);
  assert.ok(WORDS.links);
});

test('the coin\'s links in clank.trade\'s launch: X, Telegram and website as checked, Discord and Farcaster empty, and only those count when it\'s read back', () => {
  const links = { twitter: 'https://x.com/SleepyCat', telegram: 'https://t.me/sleepy_cats', website: 'https://sleepycat.com/' };
  const call = launchCall({ ...SLEEPY, wallet: ALICE, economics: ECON, links });
  const { args } = decodeFunctionData({ abi: LAUNCH_ABI, data: call.data });
  assert.deepEqual({ ...args[0].socials }, { ...links, discord: '', farcaster: '' });
  assert.equal(isDraftLaunch(call.data, SLEEPY, ALICE), true, 'a launch with links the page made counts');
  assert.equal(isDraftLaunch(launchCall({ ...SLEEPY, wallet: ALICE, economics: ECON }).data, SLEEPY, ALICE), true, 'and one without');
  // a launch with links the page could never make isn't this draft's
  const withSocials = (socials) => encodeFunctionData({ abi: LAUNCH_ABI, functionName: 'launchToken', args: [{ ...args[0], socials: { twitter: '', telegram: '', discord: '', website: '', farcaster: '', ...socials } }, args[1], args[2]] });
  assert.equal(isDraftLaunch(withSocials({ discord: 'https://discord.gg/abc' }), SLEEPY, ALICE), false);
  assert.equal(isDraftLaunch(withSocials({ farcaster: 'https://warpcast.com/a' }), SLEEPY, ALICE), false);
  assert.equal(isDraftLaunch(withSocials({ twitter: '@SleepyCat' }), SLEEPY, ALICE), false, 'not tidied');
  assert.equal(isDraftLaunch(withSocials({ website: 'http://sleepycat.com/' }), SLEEPY, ALICE), false);
  assert.equal(isDraftLaunch(withSocials({ website: 'https://agi1.app/' }), SLEEPY, ALICE), false);
  assert.equal(isDraftLaunch(withSocials({ website: 'https://sleepycat.com/' }), SLEEPY, ALICE), true);
});

// ---------- /api/launch ----------
test('GET a draft: only ?d=<id> or ?pic=<id>, private (no-store), its picture through our server with its own strict rules', async () => {
  const id = draft();
  let res = await get(`d=${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ['description', 'expired', 'expires', 'gas', 'gasBack', 'name', 'ready', 'symbol', 'token']);
  assert.equal(body.name, 'Sleepy Cat');
  assert.equal(body.symbol, 'SLEEPY');
  assert.equal(body.expired, false);
  assert.ok(body.expires > Date.now() + 119 * 60_000);
  assert.equal(body.ready, true);
  assert.equal(body.gasBack, String(10n ** 15n), 'the most her gas wallet pays back (wei)');
  assert.equal(body.token, null);
  assert.ok(!('photo' in body) && !('wallet' in body), 'never the picture\'s Telegram id or the wallet\'s code');
  for (const q of ['', `d=${id}&pic=${id}`, `x=${id}`, 'd=short', `d=${id}x`, `d=${encodeURIComponent('../../etc')}`]) {
    assert.equal((await get(q)).status, 400, q);
  }
  assert.equal((await get(`d=${'Z'.repeat(22)}`)).status, 404);
  // its picture: Telegram's copy, through our server
  res = await get(`pic=${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.equal(res.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('cache-control'), /^private/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), JPEG);
  assert.ok(tg('getFile').every((c) => !JSON.stringify(c.body).includes(TOKEN)), 'the token only in Telegram\'s own address');
  fake.picture = Buffer.from('<svg onload=alert(1)>');
  assert.equal((await get(`pic=${id}`)).status, 404, 'not a picture: nothing');
  fake.pictureGone = true;
  assert.equal((await get(`pic=${id}`)).status, 404);
  fake.telegramDown = true;
  fake.pictureGone = false;
  assert.equal((await get(`pic=${id}`)).status, 502);
  launchPictureBurst.reset();
  fake.telegramDown = false;
  fake.picture = JPEG;
  for (let i = 0; i < 60; i++) await get(`pic=${id}`, '198.51.100.1');
  assert.equal((await get(`pic=${id}`, '198.51.100.1')).status, 429, '60 pictures a minute per visitor');
  // launch.sql not run, or the database away
  fake.sqlMissing = true;
  assert.deepEqual([(await get(`d=${id}`)).status, (await (await get(`d=${id}`)).json()).error], [503, 'not_ready']);
  fake.sqlMissing = false;
  fake.dbDown = true;
  assert.deepEqual(await (await get(`d=${id}`)).json(), { error: 'busy' });
  // an expired draft says so; without Pinata's key launching isn't open
  fake.dbDown = false;
  const old = draft({ minutes: 1 });
  fake.db.drafts.get(old).expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await (await get(`d=${old}`)).json()).expired, true);
  delete process.env.PINATA_JWT;
  assert.equal((await (await get(`d=${id}`)).json()).ready, false);
  delete process.env.LAUNCH_GAS_KEY;
  assert.equal((await (await get(`d=${id}`)).json()).gasBack, null);
});

test('prepare: what the wallet holds read fresh, clank.trade open and free, the picture on IPFS once, then the dry run', async () => {
  const id = draft();
  let res = await prepare(id);
  assert.equal(res.status, 200);
  const r = await res.json();
  assert.deepEqual(Object.keys(r).sort(), ['chainId', 'curve', 'data', 'level', 'perDay', 'to', 'token', 'value']);
  assert.equal(r.chainId, CHAIN_ID);
  assert.equal(r.to, FACTORY);
  assert.equal(r.value, '0x0');
  assert.equal(r.token, COIN);
  assert.equal(r.level, 2);
  assert.equal(r.perDay, 10, '20,000 $AGI: 10 coins a day');
  assert.equal(fake.chain.dryRuns[0].pair, ZERO, 'paired with ETH unless they pick SPCX');
  assert.ok(!calls.some((c) => c.to === 'clank'), 'clank.trade\'s search isn\'t asked (copies are fine)');
  // exactly what the page's send.js accepts, and what clank.trade's docs ask for
  assert.doesNotThrow(() => launchTx(ALICE, r));
  const { args } = decodeFunctionData({ abi: LAUNCH_ABI, data: r.data });
  assert.equal(args[0].logo, `ipfs://${CID}`);
  assert.equal(args[0].creatorFeeRecipient.toLowerCase(), ALICE);
  assert.equal(args[0].salt, saltFor(id));
  // the picture: Telegram's copy, uploaded to Pinata (public IPFS) once, with the owner's key
  assert.equal(fake.pinned.length, 1);
  assert.deepEqual(fake.pinned[0].bytes, JPEG);
  assert.equal(fake.pinned[0].network, 'public');
  assert.equal(fake.pinned[0].type, 'image/jpeg');
  assert.match(fake.pinned[0].name, /^agi1-launch-SLEEPY-/);
  assert.equal(fake.db.drafts.get(id).cid, CID);
  assert.equal(fake.db.drafts.get(id).wallet_code, launchWallet(SECRET, ALICE), 'the wallet\'s code, never its address');
  assert.ok(!JSON.stringify([...fake.db.drafts.values()]).includes(ALICE.slice(2)));
  // the dry run: from their wallet, right after reading the terms (canLaunch with their wallet)
  assert.equal(fake.chain.dryRuns.length, 1);
  assert.equal(fake.chain.dryRuns[0].from, ALICE);
  const canLaunch = chainCalls('eth_call').find((q) => q.params[0].to === FACTORY && q.params[0].data.startsWith(toFunctionSelector(LAUNCH_ABI.find((f) => f.name === 'canLaunch'))));
  assert.ok(canLaunch.params[0].data.endsWith(ALICE.slice(2)), 'canLaunch asked about their wallet');
  // nothing on the server ever sends or signs anything for them
  assert.ok(chainCalls().every((q) => ['eth_call', 'eth_getTransactionReceipt'].includes(q.method)), 'reads only');
  // again: the same launch, no second upload, nothing counted twice
  res = await prepare(id);
  assert.equal(res.status, 200);
  assert.equal(fake.pinned.length, 1);
  assert.equal(fake.db.wal(launchWallet(SECRET, ALICE)).uploads, 1);
  // another wallet can't take it now
  assert.deepEqual([(res = await prepare(id, session(BOB))).status, (await res.json()).error], [403, 'other_wallet']);
});

test('prepare with the coin\'s links: checked and tidied before anything is read, counted or uploaded, and in the launch it builds', async () => {
  const id = draft();
  const withLinks = (links, s = session()) => post({ action: 'prepare', draft: id, session: s, links });
  // a link that isn't right: said at once, nothing else happens
  for (const [links, field, why] of [[{ twitter: 'x.com/a/status/1' }, 'twitter', 'format'], [{ telegram: '@agi1_appbot' }, 'telegram', 'agi'],
    [{ website: 'hornycat.com' }, 'website', 'crude'], [{ website: 7 }, 'website', 'format']]) {
    const res = await withLinks(links);
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'links', field, why });
  }
  assert.equal(fake.pinned.length, 0, 'nothing uploaded');
  assert.equal(fake.db.wal(launchWallet(SECRET, ALICE)).uploads, 0, 'nothing counted');
  assert.equal(chainCalls().length, 0, 'nothing read');
  // good ones, as typed: tidied into the launch (Discord and Farcaster empty); extra fields ignored
  const res = await withLinks({ twitter: '@SleepyCat', telegram: 't.me/sleepy_cats', website: 'SleepyCat.com', discord: 'https://discord.gg/x' });
  assert.equal(res.status, 200);
  const { args } = decodeFunctionData({ abi: LAUNCH_ABI, data: (await res.json()).data });
  assert.deepEqual({ ...args[0].socials }, { twitter: 'https://x.com/SleepyCat', telegram: 'https://t.me/sleepy_cats', discord: '', website: 'https://sleepycat.com/', farcaster: '' });
  assert.equal(fake.chain.dryRuns.at(-1).from, ALICE, 'tried on the chain with them');
  // read back: this launch, with its links, counts
  const tx = launched({ draft: asDraft(id), input: launchCall({ ...asDraft(id), wallet: ALICE, economics: ECON, links: { twitter: 'https://x.com/SleepyCat', telegram: 'https://t.me/sleepy_cats', website: 'https://sleepycat.com/' } }).data });
  const r = await (await check(id, tx)).json();
  assert.equal(r.ok, true);
  assert.equal(r.token, COIN);
});

test('prepare says no, in plain words: a Stranger, clank.trade closed or charging, the chain away, its coins for today, a used link', async () => {
  const id = draft();
  const err = async (res) => [res.status, (await res.json()).error];
  fake.chain.agi[ALICE] = 9_000n * E18;
  assert.deepEqual(await err(await prepare(id)), [403, 'level']);
  fake.burns = { agi: 1_000 };                                       // 9,000 held + 1,000 burned for messages = Crush
  assert.equal((await prepare(id)).status, 200);
  fake.burns = null;
  fake.chain.agi[ALICE] = 20_000n * E18;
  const id2 = draft({ symbol: 'NAPS' });
  // a ticker another coin on clank.trade has: fine since 2026-10-02 (nothing asks clank.trade, so its being away changes nothing)
  fake.clank = [{ symbol: 'NAPS', name: 'Naps' }];
  fake.clankDown = true;
  fake.chain.open = false;
  assert.deepEqual(await err(await prepare(id2)), [409, 'closed']);
  fake.chain.open = true;
  fake.chain.fee = 1n;
  assert.deepEqual(await err(await prepare(id2)), [409, 'fee']);
  fake.chain.fee = 0n;
  assert.equal(fake.pinned.length, 1, 'nothing uploaded or counted while clank.trade said no');
  assert.equal(fake.db.drafts.get(id2).wallet_code, null);
  fake.chain.dryRun = encodeErrorResult({ abi: parseAbi(['error LaunchAlreadyExists()']), errorName: 'LaunchAlreadyExists' });
  assert.deepEqual(await err(await prepare(id2)), [409, 'exists']);
  fake.chain.dryRun = null;
  fake.chain.down = true;
  const id3 = draft({ symbol: 'NAPS3' });
  assert.deepEqual(await err(await prepare(id3)), [503, 'chain']);
  fake.chain.down = false;
  // the picture: gone at Telegram, Telegram away, Pinata away or its key wrong
  fake.pictureGone = true;
  assert.deepEqual(await err(await prepare(id3)), [422, 'picture']);
  fake.pictureGone = false;
  fake.telegramDown = true;
  assert.deepEqual(await err(await prepare(id3)), [502, 'telegram']);
  fake.telegramDown = false;
  fake.pinata = 'bad_key';
  assert.deepEqual(await err(await prepare(id3)), [502, 'pinata']);
  assert.ok(logs.some(([, l]) => /PINATA_JWT is wrong/.test(l)), 'the owner\'s log says what to fix');
  assert.ok(!logs.some(([, l]) => l.includes(JWT)), 'never the key itself');
  // its coins for today (10,000 $AGI: 5): only uploads that worked count (id and id2 so far)
  fake.pinata = 'ok';
  assert.equal(fake.db.wal(launchWallet(SECRET, ALICE)).uploads, 2, 'the failed tries cost nothing');
  fake.chain.agi[ALICE] = 10_000n * E18;
  assert.equal((await prepare(id3)).status, 200);
  for (const sym of ['NAPS4', 'NAPS5']) assert.equal((await prepare(draft({ symbol: sym }))).status, 200);
  const capped = await prepare(draft({ symbol: 'NAPS6' }));
  assert.deepEqual([capped.status, await capped.json()], [429, { error: 'wallet_cap', perDay: 5 }]);
  // a used, an expired or a launched link
  const gone = draft({ symbol: 'NAPS7' });
  fake.db.drafts.get(gone).expires_at = new Date(Date.now() - 1).toISOString();
  assert.deepEqual(await err(await prepare(gone)), [410, 'expired']);
  const live = draft({ symbol: 'NAPS8' });
  fake.db.drafts.get(live).token = COIN;
  const res = await prepare(live);
  assert.deepEqual([res.status, await res.json()], [409, { error: 'launched', token: COIN }]);
  assert.deepEqual(await err(await prepare('Z'.repeat(22))), [404, 'gone']);
});

test('the requests themselves: JSON only, small, a real draft and session, a speed bump, and nothing at all until it\'s set up', async () => {
  const id = draft();
  const err = async (res) => [res.status, (await res.json()).error];
  assert.deepEqual(await err(await post({ action: 'prepare', draft: id, session: session() }, { type: 'text/plain' })), [415, 'bad_request']);
  assert.deepEqual(await err(await post('x'.repeat(5000))), [413, 'bad_request']);
  assert.deepEqual(await err(await post('{nope')), [400, 'bad_request']);
  for (const b of [{ action: 'launch', draft: id }, { action: 'prepare', draft: 'short' }, { action: 'prepare' }, null, []]) {
    assert.deepEqual(await err(await post(b ?? 'null')), [400, 'bad_request'], JSON.stringify(b));
  }
  assert.deepEqual(await err(await post({ action: 'prepare', draft: id, session: 'forged.session' })), [401, 'signed_out']);
  assert.deepEqual(await err(await post({ action: 'prepare', draft: id, session: makeSession('another-secret-that-is-long-enough!!', { wallet: ALICE, level: 3 }) })), [401, 'signed_out']);
  assert.deepEqual(await err(await post({ action: 'check', draft: id, session: session(), tx: '0x1234' })), [400, 'bad_tx']);
  launchBurst.reset();
  for (let i = 0; i < 40; i++) await post({ action: 'check', draft: id, session: session(), tx: txOf(99) }, { ip: '198.51.100.9' });
  assert.deepEqual(await err(await post({ action: 'check', draft: id, session: session(), tx: txOf(99) }, { ip: '198.51.100.9' })), [429, 'too_fast']);
  delete process.env.PINATA_JWT;
  const before = calls.length;
  assert.deepEqual(await err(await prepare(id)), [503, 'not_ready']);
  assert.equal(calls.length, before, 'nothing asked of anyone');
  assert.ok(logs.some(([, l]) => /PINATA_JWT, TELEGRAM_BOT_TOKEN, PASS_SECRET/.test(l)));
});

test('check: their launch read back (this draft\'s own call), kept once with its transaction, and its network fee paid back once', async () => {
  const id = draft();
  await prepare(id);
  const tx = txOf(42);
  let res = await check(id, tx);
  assert.deepEqual(await res.json(), { pending: true }, 'not on the chain yet');
  launched({ tx, draft: asDraft(id) });
  res = await check(id, tx);
  const r = await res.json();
  assert.equal(r.ok, true);
  assert.equal(r.token, COIN);
  assert.equal(r.curve, CURVE);
  assert.equal(r.gas.paid, true);
  assert.equal(r.gas.wei, String(2_000_000n * 100_000_000n), 'exactly its fee (0.0002 ETH)');
  assert.equal(fake.db.drafts.get(id).token, COIN);
  assert.equal(fake.db.drafts.get(id).launch_tx, tx, 'its launch transaction, kept for its payback');
  assert.equal(sentRaws().length, 1);
  // asked again (the page polls; a reload): the same coin, the same payback, nothing sent again
  const again = await (await check(id, tx)).json();
  assert.deepEqual(again, r);
  assert.equal(sentRaws().length, 1);
  // the draft shows it now
  const d = await (await get(`d=${id}`)).json();
  assert.equal(d.token, COIN);
  assert.deepEqual(d.gas, r.gas);
  // the only thing the server ever sent is that payback, from the owner's gas wallet
  assert.deepEqual(chainCalls('eth_sendRawTransaction').length, 1);
  assert.ok(chainCalls().every((q) => !['eth_sendTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData_v4'].includes(q.method)));
});

test('one launch is paid back once: never for another draft, never for a launch with other details', async () => {
  // one wallet gets three drafts of the same coin ready, launches one, then checks the others with that same transaction
  const [a, b, c] = [draft(), draft(), draft()];
  for (const id of [a, b, c]) assert.equal((await prepare(id)).status, 200);
  const tx = launched({ tx: txOf(50), draft: asDraft(a) });
  assert.equal((await (await check(a, tx)).json()).gas.paid, true);
  for (const other of [b, c]) {
    assert.deepEqual(await (await check(other, tx)).json(), { ok: false, why: 'not_launch' }, 'its salt is another draft\'s');
    assert.equal(fake.db.drafts.get(other).token, null);
  }
  fake.db.wallets.clear();                                          // "tomorrow"
  assert.deepEqual(await (await check(b, tx)).json(), { ok: false, why: 'not_launch' });
  assert.equal(sentRaws().length, 1, 'one payback for one launch');
  // a launch they sent with details of their own (another name, links in its socials…): not this coin
  launched({ tx: txOf(51), token: '0xc0fe000000000000000000000000000000000002', draft: { ...asDraft(b), name: 'Not Sleepy' } });
  assert.deepEqual(await (await check(b, txOf(51))).json(), { ok: false, why: 'not_launch' });
  // a coin can't belong to two drafts, even if the database is asked to
  launched({ tx: txOf(52), draft: asDraft(c) });
  assert.deepEqual(await (await check(c, txOf(52))).json(), { ok: false, why: 'not_launch' }, 'that coin is already draft a\'s');
  assert.equal(sentRaws().length, 1);
});

test('a launch that couldn\'t be kept yet: the page is told to keep asking (its transaction is only in the page until then)', async () => {
  const id = draft();
  await prepare(id);
  launched({ tx: txOf(70), draft: asDraft(id) });
  const done = fake.db.launch_done;
  fake.db.launch_done = () => { throw new Error('boom'); };
  const res = await check(id, txOf(70));
  assert.deepEqual([res.status, (await res.json()).error], [503, 'busy']);
  assert.equal(sentRaws().length, 0, 'no payback before the launch is kept');
  fake.db.launch_done = done;
  assert.equal((await (await check(id, txOf(70))).json()).ok, true, 'the next ask keeps it');
  assert.equal(fake.db.drafts.get(id).launch_tx, txOf(70));
  // where its coin would be was kept when it got ready
  assert.equal(fake.db.drafts.get(id).predicted, COIN);
});

test('check says no: a failed launch, someone else\'s, another wallet\'s link, a draft never got ready; without the gas wallet no payback', async () => {
  const id = draft();
  await prepare(id);
  launched({ tx: txOf(1), status: '0x0', draft: asDraft(id) });
  assert.deepEqual(await (await check(id, txOf(1))).json(), { ok: false, why: 'failed' });
  launched({ tx: txOf(2), from: BOB, token: '0xc0fe000000000000000000000000000000000002', draft: asDraft(id) });
  assert.deepEqual(await (await check(id, txOf(2))).json(), { ok: false, why: 'not_launch' }, 'Bob\'s launch, checked by Alice');
  assert.deepEqual(await (await check(id, txOf(2), session(BOB))).json(), { ok: false, why: 'other_wallet' }, 'Alice\'s link');
  assert.equal(fake.db.drafts.get(id).token, null);
  const fresh = draft();
  assert.deepEqual(await (await check(fresh, txOf(1))).json(), { ok: false, why: 'not_launch' }, 'never got ready: nothing to launch');
  fake.chain.down = true;
  assert.deepEqual([(await check(id, txOf(5))).status], [503]);
  fake.chain.down = false;
  delete process.env.LAUNCH_GAS_KEY;
  launched({ tx: txOf(6), draft: asDraft(id) });
  const r = await (await check(id, txOf(6))).json();
  assert.deepEqual(r, { ok: true, token: COIN, curve: CURVE, gas: null });
  assert.equal(sentRaws().length, 0);
});

test('its payback, asked for again later: from the launch our server kept, to its creator only, whoever opens the page', async () => {
  const id = draft();
  await prepare(id);
  const tx = launched({ tx: txOf(60), draft: asDraft(id) });
  fake.chain.gas.balance = 100n;                                    // her gas wallet is empty at first
  assert.deepEqual((await (await check(id, tx)).json()).gas, { paid: false, why: 'empty' });
  assert.deepEqual((await (await get(`d=${id}`)).json()).gas, { paid: false, why: 'unpaid' }, 'the page sees it\'s still due');
  // topped up: reopening the page asks again (no wallet, no session needed: it can only ever pay the coin's creator)
  fake.chain.gas.balance = E18;
  const res = await post({ action: 'payback', draft: id });
  assert.equal(res.status, 200);
  const { gas } = await res.json();
  assert.equal(gas.paid, true);
  assert.equal(parseTransaction(sentRaws()[0].raw).to.toLowerCase(), ALICE, 'to the creator');
  assert.deepEqual((await (await post({ action: 'payback', draft: id })).json()).gas, gas, 'asked again: the same, nothing sent');
  assert.equal(sentRaws().length, 1);
  // a draft that isn't launched: nothing to pay back; a smart account: never
  const other = draft();
  assert.deepEqual([(await post({ action: 'payback', draft: other })).status], [409]);
  const id2 = draft();
  await prepare(id2, session(BOB));
  launched({ tx: txOf(61), from: BOB, token: '0xc0fe000000000000000000000000000000000002', draft: asDraft(id2) });
  fake.chain.codes[BOB] = '0xef0100aabbccddeeff00112233445566778899aabbcc';
  assert.deepEqual((await (await check(id2, txOf(61), session(BOB))).json()).gas, { paid: false, why: 'contract' });
  assert.equal(sentRaws().length, 1);
  // the chain away: "busy", asked again in a moment
  const id3 = draft();
  await prepare(id3);
  fake.db.wallets.clear();
  launched({ tx: txOf(62), token: '0xc0fe000000000000000000000000000000000003', draft: asDraft(id3) });
  fake.chain.gas.balance = 100n;
  assert.deepEqual((await (await check(id3, txOf(62))).json()).gas, { paid: false, why: 'empty' });
  fake.chain.down = true;
  assert.deepEqual((await (await post({ action: 'payback', draft: id3 })).json()).gas, { paid: false, why: 'busy' });
});

test('uploads: counted before they start (many tries at once can\'t get past the caps), given back when they fail, one at a time per draft', async () => {
  fake.chain.agi[ALICE] = 10_000n * E18;                            // 5 coins a day
  const ids = Array.from({ length: 6 }, () => draft());
  const answers = await Promise.all(ids.map((id) => prepare(id)));
  assert.deepEqual(answers.map((a) => a.status).sort(), [200, 200, 200, 200, 200, 429], 'six at once: its 5 coins a day');
  assert.equal(fake.pinned.length, 5);
  // a failed upload gives its place back
  const db2 = launchWallet(SECRET, BOB);
  fake.pinata = 'down';
  const id = draft();
  assert.equal((await prepare(id, session(BOB))).status, 502);
  assert.equal(fake.db.wal(db2).uploads, 0, 'given back');
  fake.pinata = 'ok';
  assert.equal((await prepare(id, session(BOB))).status, 200);
  assert.equal(fake.db.wal(db2).uploads, 1);
  // a draft whose upload is under way: the next try waits
  const busy = draft();
  Object.assign(fake.db.drafts.get(busy), { wallet_code: db2, upload_at: Date.now() });
  const res = await prepare(busy, session(BOB));
  assert.deepEqual([res.status, (await res.json()).error], [409, 'uploading']);
  assert.ok(WORDS.uploading);
  // its picture's id couldn't be kept (the database hiccuped): the wallet is never asked, the upload is given back, and the
  // next try finds the same picture at Pinata (a duplicate: kept without its id, so it's never deleted by mistake)
  const carol = `0x${'c'.repeat(40)}`, dc = launchWallet(SECRET, carol);
  fake.chain.agi[carol] = 20_000n * E18;
  const lost = draft();
  const setCid = fake.db.launch_set_cid;
  fake.db.launch_set_cid = () => { throw new Error('boom'); };
  const first = await prepare(lost, session(carol));
  const body = await first.json();
  assert.deepEqual([first.status, body.error, body.data], [503, 'busy', undefined], 'no launch to send');
  assert.equal(fake.db.wal(dc).uploads, 0, 'given back');
  assert.equal(fake.db.drafts.get(lost).upload_at, null);
  fake.db.launch_set_cid = () => false;
  assert.equal((await prepare(lost, session(carol))).status, 503, 'not kept: still nothing to send');
  fake.db.launch_set_cid = setCid;
  fake.pinDuplicate = true;
  const again = await prepare(lost, session(carol));
  assert.equal(again.status, 200);
  assert.ok((await again.json()).data.startsWith(LAUNCH_SELECTOR));
  assert.deepEqual([fake.db.drafts.get(lost).cid, fake.db.drafts.get(lost).pin_id, fake.db.wal(dc).uploads], [CID, null, 1]);
});

test('the coins a wallet may launch a day follow what it holds: 5 for every 10,000 $AGI (held or burned), 50 at most', async () => {
  // the owner's rule (2026-10-02): "if they hold 10,000 $agi they can launch 5 tokens per wallet and if more more token to launch"
  for (const [agi, n] of [[0, 0], [9_999, 0], [10_000, 5], [19_999, 5], [20_000, 10], [55_000, 25], [99_999, 45], [100_000, 50], [1_000_000, 50], [NaN, 0], [-5, 0]]) {
    assert.equal(launchesADay(agi), n, String(agi));
  }
  assert.equal(LAUNCHES_MAX, 50);
  assert.ok(DRAFTS_PER_CHAT > LAUNCHES_MAX, 'her bot never stops someone before their wallet would');
  const perDay = async (agi, burned = null) => {
    const who = `0x${String(agi).padStart(8, '0')}${'d'.repeat(32)}`;
    fake.chain.agi[who] = BigInt(agi) * E18;
    fake.burns = burned === null ? null : { agi: burned };
    const res = await prepare(draft(), session(who));
    const body = await res.json();
    fake.burns = null;
    return [res.status, body.perDay ?? body.error];
  };
  assert.deepEqual(await perDay(9_999), [403, 'level']);
  assert.deepEqual(await perDay(10_000), [200, 5]);
  assert.deepEqual(await perDay(35_000), [200, 15]);
  assert.deepEqual(await perDay(250_000), [200, 50]);
  assert.deepEqual(await perDay(5_000, 15_000), [200, 10], 'what it burned for messages counts too');
  // a wallet with 10,000: its 5 coins, then "that's all for today" (with its number, for the page's words)
  fake.chain.agi[ALICE] = 10_000n * E18;
  for (let i = 0; i < 5; i++) assert.equal((await prepare(draft())).status, 200);
  const capped = await prepare(draft());
  assert.deepEqual([capped.status, await capped.json()], [429, { error: 'wallet_cap', perDay: 5 }]);
  // tomorrow (a new UTC day): its 5 again
  fake.db.wallets.clear();
  assert.equal((await prepare(draft())).status, 200);
  // holding more now: more coins today, at once (read fresh at every launch)
  fake.chain.agi[ALICE] = 30_000n * E18;
  assert.equal((await (await prepare(draft())).json()).perDay, 15);
});

test('one link, one coin: getting it ready again with other links or the other pair is another coin, and counts as one', async () => {
  fake.chain.byDetails = true;                                    // (the dry run's coin address follows its details, like the factory's)
  fake.chain.agi[ALICE] = 10_000n * E18;                          // 5 coins a day
  const code = launchWallet(SECRET, ALICE);
  const id = draft();
  const go = (body = {}) => post({ action: 'prepare', draft: id, session: session(), ...body });
  const first = await (await go()).json();
  assert.equal(fake.db.wal(code).uploads, 1);
  // the same again (a reload, a wallet that said no): the same coin, nothing counted
  assert.equal((await (await go()).json()).token, first.token);
  assert.equal(fake.db.wal(code).uploads, 1);
  // other links: another coin (its launch could be sent as well as the first one's), one more of today's
  const linked = await (await go({ links: { twitter: '@SleepyCat' } })).json();
  assert.notEqual(linked.token, first.token);
  assert.equal(fake.db.wal(code).uploads, 2);
  // the other pair: another coin too
  const paired = await (await go({ links: { twitter: '@SleepyCat' }, pair: 'spcx' })).json();
  assert.notEqual(paired.token, linked.token);
  assert.equal(fake.db.wal(code).uploads, 3);
  assert.equal(fake.db.drafts.get(id).predicted, paired.token, 'where its newest launch would put its coin');
  // back and forth between details it already had (ETH, SPCX, no links, its X): nothing more counted
  for (const body of [{}, { links: { twitter: '@SleepyCat' } }, { links: { twitter: '@SleepyCat' }, pair: 'spcx' }, {}]) assert.equal((await go(body)).status, 200);
  assert.equal(fake.db.wal(code).uploads, 3, 'going back costs nothing');
  assert.deepEqual(fake.db.drafts.get(id).predicted_all, [first.token, linked.token, paired.token], 'every address it could launch at, kept');
  // its coins for today used up: another change is "that's all for today", said as a change
  for (let i = 0; i < 2; i++) assert.equal((await prepare(draft())).status, 200);
  assert.equal(fake.db.wal(code).uploads, 5);
  const changed = await go({ links: { website: 'sleepycat.com' } });
  assert.deepEqual([changed.status, await changed.json()], [429, { error: 'wallet_cap', perDay: 5, changed: true }]);
  // details it was already got ready with (any of them): the same coins, fine
  const back = await go({ links: { twitter: '@SleepyCat' } });
  assert.equal(back.status, 200);
  assert.equal((await back.json()).token, linked.token);
  assert.equal(fake.db.wal(code).uploads, 5);
});

test('prepare with SPCX (2026-10-02): its pair asked of clank.trade\'s factory, the launch paired with it, read back; never another pair', async () => {
  const id = draft();
  const res = await post({ action: 'prepare', draft: id, session: session(), pair: 'spcx' });
  assert.equal(res.status, 200);
  const r = await res.json();
  const { args } = decodeFunctionData({ abi: LAUNCH_ABI, data: r.data });
  assert.equal(args[2].toLowerCase(), SPCX, 'paired with SPCX');
  assert.equal(args[0].expectedEconomics, ECON_SPCX, 'with the economics clank.trade gives for that pair');
  assert.equal(r.value, '0x0', 'no ETH, and no SPCX either: a launch without a buy needs no token approval');
  assert.doesNotThrow(() => launchTx(ALICE, r), 'exactly what the page\'s send.js accepts');
  assert.deepEqual(fake.chain.pairAsks, [SPCX], 'its approved list asked first');
  assert.equal(fake.chain.dryRuns.at(-1).pair, SPCX);
  // read back: this draft's launch, paired with SPCX
  const tx = launched({ tx: txOf(80), draft: asDraft(id), input: launchCall({ ...asDraft(id), wallet: ALICE, economics: ECON_SPCX, pair: SPCX }).data });
  const back = await (await check(id, tx)).json();
  assert.equal(back.ok, true);
  assert.equal(back.token, COIN);
  // SPCX off the factory's list: said before anything is counted or uploaded, and the wallet is never asked
  const id2 = draft();
  fake.chain.pairs[SPCX] = false;
  const before = { pinned: fake.pinned.length, uploads: fake.db.wal(launchWallet(SECRET, ALICE)).uploads, dry: fake.chain.dryRuns.length };
  const no = await post({ action: 'prepare', draft: id2, session: session(), pair: 'spcx' });
  assert.deepEqual([no.status, (await no.json()).error], [409, 'pair']);
  assert.deepEqual({ pinned: fake.pinned.length, uploads: fake.db.wal(launchWallet(SECRET, ALICE)).uploads, dry: fake.chain.dryRuns.length }, before);
  assert.ok(WORDS.pair);
  // …ETH still works
  assert.equal((await post({ action: 'prepare', draft: id2, session: session(), pair: 'eth' })).status, 200);
  // a pair the page never offers: a bad request, before anything is read
  fake.chain.pairs[SPCX] = true;
  const reads = chainCalls().length;
  for (const pair of ['doge', 'ETH', SPCX, 7, '']) {
    const bad = await post({ action: 'prepare', draft: draft(), session: session(), pair });
    assert.deepEqual([bad.status, (await bad.json()).error], [400, 'bad_request'], String(pair));
  }
  assert.equal(chainCalls().length, reads, 'nothing read');
});

test('tidying up (the keep-alive job): pictures of coins never launched are deleted at Pinata, never a launched coin\'s', async () => {
  const gone = draft(), live = draft(), open = draft();
  for (const id of [gone, live, open]) Object.assign(fake.db.drafts.get(id), { cid: CID, pin_id: `pin-${id.slice(0, 5)}`, wallet_code: launchWallet(SECRET, ALICE) });
  fake.db.drafts.get(open).cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH';                 // (its own picture, still open)
  fake.db.drafts.get(gone).expires_at = new Date(Date.now() - 2 * 3_600_000).toISOString();
  fake.db.drafts.get(live).token = COIN;
  assert.equal(await tidyLaunches(cfg()), 0, 'the same picture is a launched coin\'s: kept');
  assert.equal(fake.db.drafts.get(gone).pin_id, null, '…for good (whichever draft uploaded it)');
  const gone2 = draft();
  Object.assign(fake.db.drafts.get(gone2), { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', pin_id: 'pin-gone2', wallet_code: launchWallet(SECRET, ALICE),
    expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
  assert.equal(await tidyLaunches(cfg()), 1);
  assert.deepEqual(fake.unpinned, ['pin-gone2']);
  assert.equal(fake.db.drafts.get(gone2).pin_id, null);
  assert.equal(fake.db.drafts.get(live).pin_id, `pin-${live.slice(0, 5)}`, 'a launched coin\'s picture stays');
  assert.equal(fake.db.drafts.get(open).pin_id, `pin-${open.slice(0, 5)}`, 'an open link\'s picture stays');
  assert.equal(await tidyLaunches(cfg()), 0, 'once');
  // a launch nobody read back (the tab was closed): the factory has a coin where its own launch would be, so it stays
  const unread = draft();
  Object.assign(fake.db.drafts.get(unread), { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ', pin_id: 'pin-unread', wallet_code: launchWallet(SECRET, ALICE),
    predicted: '0xc0fe000000000000000000000000000000000009', expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
  fake.chain.down = true;
  assert.equal(await tidyLaunches(cfg()), 0, 'the factory can\'t be asked: it waits');
  assert.equal(fake.db.drafts.get(unread).pin_id, 'pin-unread');
  fake.chain.down = false;
  fake.chain.launched['0xc0fe000000000000000000000000000000000009'] = { deployer: ALICE, curve: CURVE };
  assert.equal(await tidyLaunches(cfg()), 0);
  assert.ok(!fake.unpinned.includes('pin-unread'), 'never deleted');
  assert.equal(fake.db.drafts.get(unread).pin_id, null, '…for good');
  // got ready twice (other links): the FIRST launch went out and nobody read it back; its later details never did. Kept.
  const twice = draft();
  Object.assign(fake.db.drafts.get(twice), { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdM', pin_id: 'pin-twice', wallet_code: launchWallet(SECRET, ALICE),
    predicted: '0xc0fe00000000000000000000000000000000000c', predicted_all: ['0xc0fe00000000000000000000000000000000000b', '0xc0fe00000000000000000000000000000000000c'],
    expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
  fake.chain.launched['0xc0fe00000000000000000000000000000000000b'] = { deployer: ALICE, curve: CURVE };
  assert.equal(await tidyLaunches(cfg()), 0);
  assert.ok(!fake.unpinned.includes('pin-twice'), 'its first launch is live: never deleted');
  assert.equal(fake.db.drafts.get(twice).pin_id, null, '…for good');
  // its draft's launch never happened: deleted
  const never = draft();
  Object.assign(fake.db.drafts.get(never), { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdK', pin_id: 'pin-never', wallet_code: launchWallet(SECRET, ALICE),
    predicted: '0xc0fe00000000000000000000000000000000000a', expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
  assert.equal(await tidyLaunches(cfg()), 1);
  assert.ok(fake.unpinned.includes('pin-never'));
  // past its time: no new deletes (the rest wait for the next run)
  const late = draft();
  Object.assign(fake.db.drafts.get(late), { cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdL', pin_id: 'pin-late', wallet_code: launchWallet(SECRET, ALICE),
    expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
  assert.equal(await tidyLaunches(cfg(), { deadline: Date.now() + 3000 }), 0, 'too late in the run: nothing started');
  assert.equal(fake.db.drafts.get(late).pin_id, 'pin-late');
  // a picture Pinata already had (maybe another coin's) is never ours to delete
  fake.pinDuplicate = true;
  const dup = draft();
  await prepare(dup);
  assert.equal(fake.db.drafts.get(dup).pin_id, null);
  // without Pinata's key: nothing to do
  delete process.env.PINATA_JWT;
  assert.equal(await tidyLaunches(cfg()), 0);
});

// ---------- her bot: /launch ----------
const PHOTO = [
  { file_id: 'AgACAgQAAxkBAAIBY2Zp-small-90', width: 90, height: 90, file_size: 1500 },
  { file_id: 'AgACAgQAAxkBAAIBY2Zp-mid-0800', width: 800, height: 800, file_size: 70_000 },
  { file_id: 'AgACAgQAAxkBAAIBY2Zp-big-1280', width: 1280, height: 1280, file_size: 140_000 },
];
const from = { id: CHAT, is_bot: false, first_name: 'A', language_code: 'en' };
const msg = (o) => ({ update_id: 1, message: { message_id: 10, from, chat: { id: CHAT, type: 'private' }, date: Math.floor(Date.now() / 1000), ...o } });
const hook = async (update) => (await (await webhook(new Request('https://agi1.app/api/telegram', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': webhookSecret(SECRET) }, body: JSON.stringify(update),
}))).json()).what;

test('her bot: /launch explains, a photo with its caption becomes a private link, and nothing of the chat is kept with it', async () => {
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_how');
  assert.equal(texts().at(-1), LL.howLine({ gasBack: true }));
  assert.equal(await hook(msg({ text: LL.EXAMPLE })), 'launch_need_photo');
  assert.equal(texts().at(-1), LL.NEED_PHOTO);
  assert.equal(await hook(msg({ photo: PHOTO, caption: '/launch  Sleepy   Cat | $sleepy | a cat who naps all day' })), 'launch_ready');
  const sent = tg('sendMessage').at(-1).body;
  const url = /https:\/\/agi1\.app\/launch\/([A-Za-z0-9_-]{22})/.exec(sent.text);
  assert.ok(url, 'her private link');
  assert.equal(sent.text, LL.readyLine({ name: 'Sleepy Cat', symbol: 'sleepy', description: 'a cat who naps all day', url: url[0], gasBack: true }), 'its ticker as typed');
  assert.deepEqual(sent.reply_markup.inline_keyboard, LL.readyButtons(url[0]));
  assert.deepEqual(sent.link_preview_options, { is_disabled: true });
  assert.ok(!('parse_mode' in sent), 'plain text');
  assert.equal(url[0], draftUrl(url[1]));
  const d = fake.db.drafts.get(url[1]);
  assert.equal(d.name, 'Sleepy Cat');
  assert.equal(d.symbol, 'sleepy');
  assert.equal(d.photo, 'AgACAgQAAxkBAAIBY2Zp-big-1280', 'the biggest size that fits');
  assert.equal(d.chat_code, chatCode(SECRET, CHAT, today()), 'the chat\'s daily code');
  assert.ok(!JSON.stringify(d).includes(String(CHAT)), 'never the chat\'s number');
  // then the page has it
  assert.equal((await (await get(`d=${url[1]}`)).json()).symbol, 'sleepy');
  assert.ok(!calls.some((c) => c.to === 'clank'), 'clank.trade\'s search isn\'t asked (copies are fine since 2026-10-02)');
});

test('her bot says no, kindly: a bad caption, a crude or AGI-like coin, "official", a link, a tiny picture, a file, too many; copies are fine', async () => {
  const say = async (o) => [await hook(msg(o)), texts().at(-1)];
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch' }), ['launch_format', LL.REFUSE.format]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Sleepy Cat' }), ['launch_symbol', LL.REFUSE.symbol]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Horny Cat | HCAT' }), ['launch_crude', LL.REFUSE.crude]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch AGI Cat | ACAT' }), ['launch_agi', LL.REFUSE.agi]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Cat | CAT | cats.xyz' }), ['launch_link', LL.REFUSE.link]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Waifu Cat | WAIFU' }), ['launch_egirl', LL.REFUSE.egirl]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Cat | CAT | buy $PEPE too' }), ['launch_money', LL.REFUSE.money]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Official Pepe | PEPE' }), ['launch_official', LL.REFUSE.official]);
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch Cat | MY CAT' }), ['launch_symbol', LL.REFUSE.symbol]);
  assert.deepEqual(await say({ photo: [PHOTO[0]], caption: LL.EXAMPLE }), ['launch_photo', LL.REFUSE.photo]);
  assert.deepEqual(await say({ document: { file_id: 'BQACAgQAAxkBAAIB-doc', mime_type: 'image/png' }, caption: LL.EXAMPLE }), ['launch_as_photo', LL.AS_PHOTO]);
  assert.equal(fake.db.drafts.size, 0, 'no draft for any of those');
  telegramBurst.reset();
  // a ticker (and a name) another coin on clank.trade already has: fine since 2026-10-02, and clank.trade isn't even asked
  fake.clank = [{ symbol: 'SLEEPY', name: 'Sleepy Cat' }];
  fake.clankDown = true;
  assert.equal(await hook(msg({ photo: PHOTO, caption: LL.EXAMPLE })), 'launch_ready');
  assert.equal(await hook(msg({ photo: PHOTO, caption: '/launch Pepe 🐸 | pepe🐸 | the frog, again' })), 'launch_ready', 'lowercase, emoji');
  assert.ok(!calls.some((c) => c.to === 'clank'));
  // her bot's own cap: enough drafts a day for a wallet's most coins, and some to spare (the per-chat speed bump of 20 updates
  // a minute is reset now and then here: this is a day's drafts, not a minute's)
  for (let i = 2; i < DRAFTS_PER_CHAT; i++) {
    if (i % 15 === 0) telegramBurst.reset();
    assert.equal(await hook(msg({ photo: PHOTO, caption: `/launch Cat ${i} | CAT${i}` })), 'launch_ready');
  }
  telegramBurst.reset();
  assert.deepEqual(await say({ photo: PHOTO, caption: '/launch One More | MORE' }), ['launch_chat_cap', LL.CHAT_CAP]);
});

test('her bot: 18+ first, and "not open yet" until Pinata\'s key and launch.sql are there; /help shows /launch only then', async () => {
  fake.friends.set(CHAT, { ...fake.friends.get(CHAT), adult: false });
  assert.equal(await hook(msg({ text: '/launch' })), 'ask_age');
  fake.friends.delete(CHAT);
  assert.equal(await hook(msg({ photo: PHOTO, caption: LL.EXAMPLE })), 'start', 'a stranger to her bot: her welcome first');
  fake.friends.set(CHAT, { chat_id: CHAT, adult: true, tz_minutes: 0, seen_id: 0, day: null, sent: 0 });
  assert.equal(await hook(msg({ text: '/help' })), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').HELP_LAUNCH);
  fake.sqlMissing = true;
  assert.equal(await hook(msg({ photo: PHOTO, caption: LL.EXAMPLE })), 'launch_closed');
  assert.equal(texts().at(-1), LL.NOT_OPEN);
  assert.ok(logs.some(([, l]) => /run supabase\/launch\.sql/.test(l)));
  fake.sqlMissing = false;
  delete process.env.PINATA_JWT;
  assert.equal(launchReady(cfg()), false);
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_closed');
  assert.equal(await hook(msg({ text: '/help' })), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').HELP);
  delete process.env.LAUNCH_GAS_KEY;
  process.env.PINATA_JWT = JWT;
  await hook(msg({ text: '/launch' }));
  assert.equal(texts().at(-1), LL.howLine(), 'no payback promised without the gas wallet');
});

test('her private first launch (LAUNCH_ONLY_FOR): only those Telegram accounts may launch, and nobody else even sees it', async () => {
  // the setting: usernames (with or without @, any case) or numeric Telegram ids; nothing usable in it lets nobody in
  assert.equal(launchTesters(''), null);
  assert.equal(launchTesters('   '), null);
  const t = launchTesters(' @Owner_Name , 777000 friend_2 ');
  assert.deepEqual([[...t.ids], [...t.names].sort()], [['777000'], ['friend_2', 'owner_name']]);
  const typo = launchTesters('@!');
  assert.deepEqual([typo.ids.size, typo.names.size], [0, 0]);
  process.env.LAUNCH_ONLY_FOR = '@Owner_Name';
  assert.equal(launchReady(cfg()), true);
  assert.equal(launchOpen(cfg()), false);
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'stop'], 'not in her menu while it\'s private');
  const owner = { ...from, username: 'OWNER_name' };
  const stranger = { id: 99, is_bot: false, first_name: 'B', username: 'someone', language_code: 'en' };
  assert.deepEqual([launchAllowed(cfg(), owner), launchAllowed(cfg(), stranger), launchAllowed(cfg(), from), launchAllowed(cfg(), null)], [true, false, false, false]);
  const as = (who, o) => ({ update_id: 1, message: { message_id: 10, from: who, chat: { id: who.id, type: 'private' }, date: Math.floor(Date.now() / 1000), ...o } });
  // anyone else: the same "not open yet" as before it was set up, whatever they send, and her /help without it
  for (const o of [{ text: '/launch' }, { photo: PHOTO, caption: LL.EXAMPLE }, { document: { file_id: 'BQACAgQAAxkBAAIB-doc', mime_type: 'image/png' }, caption: LL.EXAMPLE }]) {
    assert.equal(await hook(as(stranger, o)), 'launch_closed');
    assert.equal(texts().at(-1), LL.NOT_OPEN);
  }
  assert.equal(await hook(as(stranger, { text: '/help' })), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').HELP);
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_closed', 'no username, not on the list');
  assert.equal(fake.db.drafts.size, 0);
  // the owner (by their username, any case): all of it
  assert.equal(await hook(as(owner, { text: '/help' })), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').HELP_LAUNCH);
  assert.equal(await hook(as(owner, { text: '/launch' })), 'launch_how');
  assert.equal(await hook(as(owner, { photo: PHOTO, caption: LL.EXAMPLE })), 'launch_ready');
  assert.equal(fake.db.drafts.size, 1);
  // or by their numeric Telegram id
  process.env.LAUNCH_ONLY_FOR = String(CHAT);
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_how');
  // a setting with nothing usable in it: nobody (never everyone), said once in the log
  process.env.LAUNCH_ONLY_FOR = '@!';
  logs.length = 0;
  assert.equal(await hook(as(owner, { text: '/launch' })), 'launch_closed');
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_closed');
  assert.equal(logs.filter(([, l]) => /LAUNCH_ONLY_FOR/.test(l)).length, 1);
  // removed: open to everyone, and back in her menu
  delete process.env.LAUNCH_ONLY_FOR;
  assert.equal(launchOpen(cfg()), true);
  assert.deepEqual(commandsFor(cfg()), COMMANDS);
  assert.equal(await hook(as(stranger, { text: '/launch' })), 'start', 'anyone now (someone new to her bot: her welcome and 18+ first)');
  assert.equal(await hook(msg({ text: '/launch' })), 'launch_how');
});

// ---------- the launch page ----------
test('the page\'s words: which draft, every answer of the API in plain words, ETH amounts, her payback', () => {
  assert.equal(draftIdFrom({ pathname: '/launch/Abc_def-0123456789ABCD' }), 'Abc_def-0123456789ABCD');
  assert.equal(draftIdFrom({ pathname: '/launch/Abc_def-0123456789ABCD/' }), 'Abc_def-0123456789ABCD');
  assert.equal(draftIdFrom({ pathname: '/launch.html', search: '?d=Abc_def-0123456789ABCD' }), 'Abc_def-0123456789ABCD');
  for (const loc of [{ pathname: '/launch/short' }, { pathname: '/launch/Abc_def-0123456789ABCD/x' }, { pathname: '/launch.html', search: '?d=<script>' }, {}, null]) {
    assert.equal(draftIdFrom(loc), null, JSON.stringify(loc));
  }
  // every error the server can answer has its words (api/launch.js, the dry run's reasons, the prepare's database answers)
  const api = readFileSync(new URL('../api/launch.js', import.meta.url), 'utf8');
  const codes = new Set([...api.matchAll(/error: '(\w+)'/g)].map((m) => m[1]));
  for (const k of ['gone', 'expired', 'launched', 'other_wallet', 'wallet_cap', 'site_cap']) codes.add(k);
  for (const why of new Set(Object.values(ERRORS))) codes.add(why);
  codes.add('reverted');
  for (const c of ['bad_request', 'bad_tx', 'busy', 'not_launched']) codes.delete(c);   // (the page never gets those: "Something went wrong")
  codes.delete('no_picture');                                                       // (its picture's own request: the <img> hides itself)
  for (const c of codes) assert.ok(WORDS[c], `words for "${c}"`);
  for (const c of ['failed', 'not_launch', 'other_wallet']) assert.ok(CHECK[c], c);
  for (const s of ['connect', 'sign', 'check', 'slow']) assert.ok(STEP[s]);
  // ETH, rounded up to a millionth, never "0 ETH" for a real fee
  assert.equal(ethText('200000000000000'), '0.0002 ETH');
  assert.equal(ethText(10n ** 15n), '0.001 ETH');
  assert.equal(ethText(1n), '0.000001 ETH');
  assert.equal(ethText('1500000000000000000'), '1.5 ETH');
  assert.equal(ethText('nope'), '');
  // her payback, in plain words
  assert.equal(gasText({ paid: true, wei: '200000000000000', tx: txOf(1) }), "AGI-1's gas wallet paid your network fee back: 0.0002 ETH.");
  for (const why of ['unpaid', 'busy', 'pending', 'wallet_cap', 'site_cap', 'empty', 'failed', 'stuck', 'not_sender', 'contract']) assert.ok(gasText({ paid: false, why }), why);
  assert.equal(gasText(null), '');
  assert.equal(gasText({ paid: false, why: 'off' }), '');
  assert.deepEqual(GAS_AGAIN, ['unpaid', 'busy', 'pending'], 'asked for again in a moment');
  for (const why of ['off', 'not_sender', 'unknown', 'contract', 'wallet_cap', 'site_cap', 'stuck']) assert.equal(gasFinal({ paid: false, why }), true, `final: ${why}`);
  for (const why of [...GAS_AGAIN, 'empty', 'failed']) assert.equal(gasFinal({ paid: false, why }), false, `not final: ${why}`);
  assert.equal(gasFinal({ paid: true, wei: '1', tx: txOf(1) }), true);
  assert.match(gasNote(String(10n ** 15n)), /up to 0\.001 ETH; one launch a day per wallet, while it lasts/);
  // the coins a wallet may launch a day (2026-10-02), and "that's all for today", with its number
  assert.equal(perDayText, '5 coins a day for every 10,000 $AGI, up to 50 a day with 100,000+, held or burned for messages in the wallet you launch from.');
  assert.match(capText(5), /^This wallet has got all 5 of its coins ready for today \(5 coins a day for every 10,000 \$AGI, up to 50 a day with 100,000\+; a coin counts once it's got ready, launched or not\)\. Try again tomorrow\.$/);
  assert.match(capText(1), /its 1 coin ready/);
  assert.match(capText(undefined), /all its coins ready/);
  assert.match(capText('5'), /all its coins ready/, 'only a real number');
  assert.match(capText(5, true), /^Other links or another pair make it another coin, and this wallet has got all 5 of its coins ready for today\. Use links and a pair you already got this one ready with, or try again tomorrow\.$/);
  for (const w of [...Object.values(WORDS), ...Object.values(CHECK), gasNote('1'), perDayText, capText(5), capText(5, true)]) {
    assert.doesNotMatch(w, /\b(buy|sell|hold|moon|pump|profit|gains?|safe|guarantee\w*)\b/i, w);
    assert.doesNotMatch(w, /<|>/, 'plain text');
  }
});

test('the page: its own address, private, the rules and warnings on it, no inline code, the site\'s CSP as it is', () => {
  const html = readFileSync(new URL('../launch.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en" data-page="launch">/);
  assert.match(html, /<meta name="robots" content="noindex" \/>/, 'a private link: never in search results');
  assert.match(html, /<script src="\/theme\.js\?v=4"><\/script>/);
  assert.match(html, /<script type="module" src="\/src\/launch\/page\.js"><\/script>/);
  assert.doesNotMatch(html.replace(/<script (type="module" )?src="[^"]+"><\/script>/g, ''), /<script/i, 'no inline scripts');
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, 'no inline styles or handlers');
  for (const must of [/own wallet/i, /clank\.trade's own contracts/, /never holds keys or money/, /18\+ only/, /Meme coins can lose all of their value/,
    /Nothing here is financial advice/, /won't promote your coin/, /token approval or sending tokens, reject it/, /public and permanent/,
    /10,000\+ \$AGI/, /Its picture goes on IPFS, public too/, /A coin counts once it's got ready, launched or not/,
    /Launching takes no SPCX, and the pair can't be changed later/]) {
    assert.match(html, must, String(must));
  }
  // the coins a wallet may launch a day: the same words as her bot's and our server's rule (src/launch/rules.js)
  assert.equal(html.split(PER_DAY).length - 1, 2, 'in step 1 and in the rules');
  // its pair (2026-10-02): two native radio buttons in a fieldset, ETH picked unless they pick SPCX
  const pair = html.slice(html.indexOf('<fieldset class="lch-pair"'), html.indexOf('</fieldset>'));
  assert.match(pair, /<legend[^>]*>Pair<\/legend>/);
  assert.deepEqual([...pair.matchAll(/<input type="radio" name="lch-pair" value="(\w+)"( checked)? \/>/g)].map((m) => [m[1], Boolean(m[2])]), [['eth', true], ['spcx', false]]);
  const step3 = html.slice(html.indexOf('data-lch-step="launch"'), html.indexOf('data-lch-go'));
  assert.ok(step3.indexOf('lch-pair') < step3.indexOf('data-lch-linkform'), 'in step 3, before the links');
  // without a wallet in the browser: MetaMask, Phantom (2026-10-02, with its one setting) and Coinbase Wallet
  assert.deepEqual([...html.matchAll(/data-lch-app="(\w+)">Open in ([^<]+) ↗</g)].map((m) => [m[1], m[2]]), [['metamask', 'MetaMask'], ['phantom', 'Phantom'], ['coinbase', 'Coinbase Wallet']]);
  assert.match(html, /Phantom: turn on Robinhood Chain first \(Settings → Active Networks\)/);
  assert.match(WORDS.no_switch, /In Phantom, turn it on first/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  for (const a of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a[0], /rel="noopener noreferrer"/);
  // its styles: every rule names an lch- class (the rest of the site can't change), Pop mode's in pop.css
  const css = readFileSync(new URL('../src/styles/launch.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = rule[1].trim();
    if (sel.startsWith('@media')) continue;
    for (const one of sel.split(',')) assert.match(one, /\.lch-/, `"${one.trim()}" names an lch- class`);
  }
  // served at /launch/<id>, built as its own page, and the site's CSP unchanged (the page only talks to our /api). With
  // cleanUrls on, Vercel serves launch.html at /launch and drops ".html" before rewrites run, so the rewrite must point at
  // /launch: "/launch.html" was a 404 on the live site (2026-10-02, the owner's first draft link)
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.cleanUrls, true);
  assert.deepEqual(vercel.rewrites, [{ source: '/launch/:draft', destination: '/launch' }]);
  for (const r of vercel.rewrites) assert.doesNotMatch(r.destination, /\.html$/, 'never a .html destination with cleanUrls');
  assert.equal(vercel.headers[0].headers[0].value, "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob: https://api.dexscreener.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
  assert.match(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /launch: 'launch\.html'/);
  // the page's code: its words with textContent only, its one transaction through send.js
  const page = readFileSync(new URL('../src/launch/page.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.match(page, /import \{ walletChain, switchToRobinhood, sendLaunch, ROBINHOOD \} from '\.\/send\.js'/);
  assert.doesNotMatch(page, /eth_sendTransaction|wallet_switchEthereumChain|wallet_addEthereumChain|eth_sign\b|signTypedData/, 'only send.js asks');
  assert.match(page, /action: 'prepare', draft: id, session, links: linked\.links, pair \}/, 'the pair they picked goes with it');
  assert.match(page, /https:\/\/phantom\.app\/ul\/browse\/\$\{encodeURIComponent\(location\.href\)\}\?ref=\$\{encodeURIComponent\(location\.origin\)\}/);
});

test('the page\'s link boxes: three, labelled, optional, each described by its note, and the rules say links are for good', () => {
  const html = readFileSync(new URL('../launch.html', import.meta.url), 'utf8');
  for (const [f, id, label] of [['twitter', 'lch-x', 'X'], ['telegram', 'lch-tg', 'Telegram'], ['website', 'lch-web', 'Website']]) {
    assert.match(html, new RegExp(`<label for="${id}">${label}</label>`));
    assert.match(html, new RegExp(`<input id="${id}" data-lch-link="${f}" type="text"[^>]*maxlength="${LINK_MAX}"[^>]*aria-describedby="${id}-note"`));
    assert.match(html, new RegExp(`id="${id}-note" data-lch-link-note="${f}" aria-live="polite"`));
  }
  assert.match(html, /Links <span class="lch-linkform-opt">\(optional\)<\/span>/);
  assert.match(html, /saved in your coin's record for good/);
  assert.doesNotMatch(html, /<input[^>]*\brequired\b/, 'none of them required');
  // the boxes come before the Launch button, inside its step
  const step = html.slice(html.indexOf('data-lch-step="launch"'), html.indexOf('data-lch-go'));
  assert.ok(step.includes('data-lch-linkform'));
});

test('the safety note says what launching changes, and the build never ships Pinata\'s key or the gas wallet\'s key', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /The only transaction it can ever ask your wallet for is a coin launch you start yourself/);
  assert.match(index, /sends no ETH, and you approve it in your wallet/);
  const check = readFileSync(new URL('../scripts/check-secrets.js', import.meta.url), 'utf8');
  assert.match(check, /'PINATA_JWT'/);
  assert.match(check, /'LAUNCH_GAS_KEY'/);
  // run the real check on a pretend build: a key (with or without its 0x) or a JWT anywhere fails it
  const dir = mkdtempSync(join(tmpdir(), 'agi1-secrets-'));
  try {
    const run = (content, env = {}) => {
      rmSync(join(dir, 'dist'), { recursive: true, force: true });
      mkdirSync(join(dir, 'dist', 'assets'), { recursive: true });
      writeFileSync(join(dir, 'dist', 'assets', 'page.js'), content);
      const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !['PINATA_JWT', 'LAUNCH_GAS_KEY', 'PASS_SECRET', 'TELEGRAM_BOT_TOKEN', 'SUPABASE_SECRET_KEY', 'GEMINI_API_KEY', 'TURNSTILE_SECRET_KEY'].includes(k)));
      return spawnSync(process.execPath, [new URL('../scripts/check-secrets.js', import.meta.url).pathname], { cwd: dir, env: { ...base, ...env }, encoding: 'utf8' }).status;
    };
    assert.equal(run('console.log("hello")', { LAUNCH_GAS_KEY: GAS_KEY, PINATA_JWT: JWT }), 0);
    assert.equal(run(`const k = "${GAS_KEY.slice(2)}"`, { LAUNCH_GAS_KEY: GAS_KEY }), 1, 'the key without its 0x');
    assert.equal(run(`const k = "${GAS_KEY}"`, { LAUNCH_GAS_KEY: GAS_KEY }), 1);
    // set as MetaMask shows it (no 0x), found in any case
    assert.equal(run(`const k = "${GAS_KEY.toUpperCase().replace('0X', '0x')}"`, { LAUNCH_GAS_KEY: GAS_KEY.slice(2) }), 1, 'any case, set without its 0x');
    assert.equal(run('console.log("hello")', { LAUNCH_GAS_KEY: GAS_KEY.slice(2) }), 0);
    assert.equal(run(`const j = "${JWT}"`), 1, 'anything shaped like a JWT, even unset');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
