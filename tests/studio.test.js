// AGI-1's 3D character studio (2026-10-10, the owner: "what if i launched a where they can create a 3d model with meshy ai
// api that can move on chat just like vladcat. they can get it by burning $AGI tokens and can launch token with it", then
// "Burn $AGI or USDG", holder discounts, a free one a month for Soulmates): src/studio/rules.js, server/studio-words.js,
// server/meshy.js, server/studio-files.js, server/studio-chain.js, server/studio.js, server/studio-api.js, its routes in
// api/launch.js and api/feed.js, supabase/studio.sql's promises. With fake Meshy, Supabase (studio.sql's rules in
// JavaScript: the SQL itself ran in PGlite) and its Storage, Robinhood Chain, the block explorer and Cloudflare.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as R from '../src/studio/rules.js';
import { checkCharacter, meshyPrompt, meshyTexture } from '../server/studio-words.js';
import { meshyBody, meshyStart, meshyTask, animationUrl, thumbnailUrl, CREDITS, MESHY } from '../server/meshy.js';
import * as F from '../server/studio-files.js';
import { USDG, paidIn, readPayment, amountOf, recentPayments, PAY_WINDOW_MS, _resetStudioChain } from '../server/studio-chain.js';
import {
  STUDIO, studioOn, mayMake, studioWallet, payCode, walletNow, pageView, makeQuote, choosePay, checkPayment, redo, myCharacters,
  gallery, monthLeft, tick, studioClock, studioKey, _resetStudioKey, getOrder, newOrderId,
} from '../server/studio.js';
import { studioGet, studioPost, studioLookBurst, studioFileBurst, studioActBurst } from '../server/studio-api.js';
import { getConfig, studioAddress } from '../server/config.js';
import { makeSession } from '../server/session.js';
import { txCode, burnWallet, _resetBurnKey } from '../server/burn.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';
import { GET as launchGet, POST as launchPost } from '../api/launch.js';
import { GET as feedGet } from '../api/feed.js';
import * as THREE from 'three';
import { clipsFor, inPlace, poseBox, movesBox, framing, lookTimes } from '../src/studio/viewer.js';

const DAY = 864e5;
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const STUDIO_KEY = 'ab12cd34'.repeat(8);              // the clock's key (64 hex characters, as studio.sql makes it)
const BURN_KEY = 'f00dfeed'.repeat(8);                // burns.sql's key
const MESHY_KEY = 'msy_testkey1234567890abcdefghijklmnop';
const OWNER = '0x1111111111111111111111111111111111111111';      // STUDIO_PAY_TO: the owner's wallet
const WALLET = '0x8ba1f109551bd432803012645ac136ddd64dba72';     // the person's own wallet
const OTHER = '0x2222222222222222222222222222222222222222';
const AGI = AGI_CONTRACT.toLowerCase();
const DEAD = BURN_ADDRESS.toLowerCase();
const USDG_LC = USDG.toLowerCase();
const SB = 'https://fake.supabase.co';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const E18 = 10n ** 18n;
const ENV = {
  SUPABASE_URL: SB, SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: SECRET, TURNSTILE_SECRET_KEY: 'turnstile-secret-for-tests',
  MESHY_API_KEY: MESHY_KEY, STUDIO_PAY_TO: OWNER, STUDIO_OPEN: 'yes',
};
const SETTINGS = ['MESHY_API_KEY', 'STUDIO_PAY_TO', 'STUDIO_PRICE_USD', 'STUDIO_PRICE_AGI', 'STUDIO_A_MONTH', 'STUDIO_BURNS_A_MONTH', 'STUDIO_OPEN',
  'STUDIO_ONLY_FOR', 'STUDIO_HIDE', 'ROBINHOOD_RPC_URL', 'SITE_URL', 'CRON_SECRET', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'PINATA_JWT',
  'LAUNCH_GAS_KEY', 'LIVE_SECRET', 'PRIZE_WALLET_KEY', 'TELEGRAM_GROUPS', 'FAL_KEY', 'STUDIO_VIDEO_PRICE_USD', 'STUDIO_VIDEOS_A_MONTH', 'STUDIO_VIDEO_MODEL'];
const IP = '203.0.113.7';
const GOOD = { name: 'Mochi', about: 'a cheerful pink-haired streamer in a cozy oversized hoodie and sneakers', style: 'anime' };
const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
const topic = (a) => `0x${'0'.repeat(24)}${a.slice(2).toLowerCase()}`;
const txOf = (n) => `0x${pad(n)}`;
const sessionFor = (wallet = WALLET, level = 1, checkedAt = Date.now()) =>
  makeSession(SECRET, { wallet, level, checkedAt, expiresAt: Date.now() + 7 * DAY });

// ---------- the database: studio.sql's (and burns.sql's) rules, in JavaScript ----------
function database() {
  const now = () => Date.now();
  const month = () => new Date().toISOString().slice(0, 7);
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  return {
    orders: new Map(), months: new Map(), free: new Set(), txs: new Map(), burnTxs: new Set(), burnWallets: new Map(), calls: [],
    month() { if (!this.months.has(month())) this.months.set(month(), { made: 0, burns: 0 }); return this.months.get(month()); },
    live() { return [...this.orders.values()].filter((o) => o.status === 'quote' && o.created > now() - DAY); },
    expired(o) { return o.status === 'quote' && o.paid === 0 && o.created < now() - DAY; },
    burn_key() { return BURN_KEY; },
    burn_status({ p_wallet }) { return { left: 0, bought: 0, agi: this.burnWallets.get(p_wallet)?.agi ?? 0, today: 0 }; },
    studio_key() { return STUDIO_KEY; },
    studio_quote(a) {
      if (!/^[A-Za-z0-9_-]{22}$/.test(a.p_id) || !(a.p_wallet?.length >= 16 && a.p_wallet.length <= 64) || !(a.p_burn?.length >= 16)
        || !(a.p_name?.length >= 1 && [...a.p_name].length <= 24) || !(a.p_about?.length >= 10 && a.p_about.length <= 400)
        || !['anime', 'cartoon', 'realistic'].includes(a.p_style) || ![1, 2, 3].includes(a.p_level) || !(a.p_usd_cents >= 0 && a.p_usd_cents <= 1e6)
        || !(a.p_agi >= 0 && a.p_agi <= 1e9) || typeof a.p_free !== 'boolean' || !(a.p_cap >= 1) || !(a.p_burn_cap >= 0) || !(a.p_per_wallet >= 1)) {
        return { ok: false, why: 'bad' };
      }
      const m = this.month(), live = this.live();
      if (live.filter((o) => o.wallet_code === a.p_wallet && o.paid === 0).length >= a.p_per_wallet) return { ok: false, why: 'too_many' };
      if (m.made + live.length >= a.p_cap) return { ok: false, why: 'sold_out' };
      if (this.orders.has(a.p_id)) return { ok: false, why: 'taken' };
      this.orders.set(a.p_id, {
        id: a.p_id, wallet_code: a.p_wallet, burn_code: a.p_burn, name: a.p_name, about: a.p_about, style: a.p_style, level: a.p_level,
        usd_cents: a.p_usd_cents, agi: a.p_agi, free: a.p_free, kind: null, paid: 0, status: 'quote', paid_at: null, started_at: null, step: null,
        task: null, tasks: {}, tries: 0, error: null, credit: false, glb_bytes: null, pic_bytes: null, moves: null, hidden: false, lease: 0,
        created: now(), updated: now(), done_at: null,
      });
      const burnLive = live.filter((o) => o.kind === 'burn').length;
      return { ok: true, id: a.p_id, burn_ok: m.burns + burnLive < a.p_burn_cap, free_ok: a.p_free && !this.free.has(`${a.p_wallet}:${month()}`),
        left: a.p_cap - m.made - live.length - 1 };
    },
    studio_choose({ p_id, p_wallet, p_kind, p_burn_cap }) {
      if (!['usdg', 'burn', 'free'].includes(p_kind) || p_burn_cap == null) return { ok: false, why: 'bad' };
      const m = this.month(), o = this.orders.get(p_id);
      if (!o || this.expired(o)) return { ok: false, why: 'gone' };
      if (o.wallet_code !== p_wallet) return { ok: false, why: 'not_yours' };
      if (o.status !== 'quote' || (o.paid > 0 && o.kind !== p_kind)) return { ok: false, why: 'done' };
      if (p_kind === 'free') {
        if (!o.free) return { ok: false, why: 'no_free' };
        if (this.free.has(`${p_wallet}:${month()}`)) return { ok: false, why: 'free_used' };
        this.free.add(`${p_wallet}:${month()}`);
        Object.assign(o, { kind: 'free', status: 'paid', paid_at: now(), updated: now() });
        m.made += 1;
        return { ok: true, kind: 'free', paid: true };
      }
      if (p_kind === 'burn' && o.kind !== 'burn') {
        const burnLive = this.live().filter((x) => x.kind === 'burn' && x.id !== p_id).length;
        if (m.burns + burnLive >= p_burn_cap) return { ok: false, why: 'burns_sold_out' };
      }
      Object.assign(o, { kind: p_kind, updated: now() });
      return { ok: true, kind: p_kind, paid: false };
    },
    studio_pay({ p_id, p_wallet, p_tx, p_amount }) {
      if (typeof p_tx !== 'string' || p_tx.length < 16 || p_tx.length > 64 || !(p_amount > 0) || p_amount > 1e9 || !Number.isInteger(p_amount)) {
        return { ok: false, why: 'bad' };
      }
      const m = this.month(), o = this.orders.get(p_id);
      if (!o) return { ok: false, why: 'gone' };
      if (o.wallet_code !== p_wallet) return { ok: false, why: 'not_yours' };
      if (o.status !== 'quote') return { ok: false, why: 'done' };
      if (!['usdg', 'burn'].includes(o.kind)) return { ok: false, why: 'no_kind' };
      if (o.paid === 0 && o.created < now() - DAY) return { ok: false, why: 'gone' };
      if (this.txs.has(p_tx)) return { ok: false, why: 'used' };
      this.txs.set(p_tx, { kind: o.kind, order: p_id });
      if (o.kind === 'burn') {
        if (this.burnTxs.has(p_tx)) { this.txs.delete(p_tx); return { ok: false, why: 'used' }; }
        this.burnTxs.add(p_tx);
        const w = this.burnWallets.get(o.burn_code) || { agi: 0 };
        w.agi += p_amount;
        this.burnWallets.set(o.burn_code, w);
      }
      const need = o.kind === 'usdg' ? o.usd_cents : o.agi, have = o.paid + p_amount;
      o.paid = have; o.updated = now();
      if (have >= need) {
        Object.assign(o, { status: 'paid', paid_at: now() });
        m.made += 1;
        if (o.kind === 'burn') m.burns += 1;
        return { ok: true, paid: true, have, need };
      }
      return { ok: true, paid: false, have, need };
    },
    studio_seen({ p_txs }) {
      if (!Array.isArray(p_txs) || p_txs.length > 50) return [];
      return [...new Set(p_txs.filter((c) => this.txs.has(c) || this.burnTxs.has(c)))].sort();
    },
    studio_get({ p_id }) {
      const o = this.orders.get(p_id);
      if (!o) return null;
      const { lease, created, updated, ...row } = o;
      return { ...row, paid_at: iso(o.paid_at), started_at: iso(o.started_at), done_at: iso(o.done_at), created_at: iso(created), updated_at: iso(updated),
        expired: this.expired(o) };
    },
    studio_lease({ p_id, p_secs }) {
      const o = this.orders.get(p_id);
      if (!(p_secs >= 5 && p_secs <= 300) || !o || !['paid', 'making'].includes(o.status) || o.lease > now()) return false;
      o.lease = now() + p_secs * 1000;
      return true;
    },
    studio_step({ p_id, p_step, p_task, p_tasks, p_tries }) {
      const o = this.orders.get(p_id);
      if (!['preview', 'refine', 'rig', 'moves', 'save'].includes(p_step) || (p_task !== null && !/^[A-Za-z0-9_-]{6,80}$/.test(p_task))
        || !p_tasks || typeof p_tasks !== 'object' || Array.isArray(p_tasks) || !(p_tries >= 0 && p_tries <= 20)) return false;
      if (!o || !['paid', 'making'].includes(o.status)) return false;
      if (o.status === 'paid') o.started_at = now();
      Object.assign(o, { status: 'making', step: p_step, task: p_task, tasks: { ...p_tasks }, tries: p_tries, lease: 0, updated: now() });
      return true;
    },
    studio_wait({ p_id }) {
      const o = this.orders.get(p_id);
      if (!o || !['paid', 'making'].includes(o.status)) return null;
      o.lease = now() + 3000;
      return true;
    },
    studio_done({ p_id, p_glb, p_pic, p_moves }) {
      const o = this.orders.get(p_id);
      if (!(p_glb >= 1 && p_glb <= 1e8) || !(p_pic >= 1 && p_pic <= 1e8) || !Array.isArray(p_moves) || p_moves.length < 1 || p_moves.length > 12) return false;
      if (!o || !['paid', 'making'].includes(o.status)) return false;
      Object.assign(o, { status: 'done', glb_bytes: p_glb, pic_bytes: p_pic, moves: [...p_moves], step: null, task: null, lease: 0, credit: false,
        error: null, done_at: now(), updated: now() });
      return true;
    },
    studio_fail({ p_id, p_error, p_credit }) {
      const o = this.orders.get(p_id);
      if (!o || !['paid', 'making'].includes(o.status)) return false;
      Object.assign(o, { status: 'failed', error: String(p_error ?? 'failed').slice(0, 200), credit: p_credit === true, lease: 0, task: null, updated: now() });
      return true;
    },
    studio_redo({ p_id, p_wallet, p_name, p_about, p_style }) {
      if (!p_name || [...p_name].length > 24 || !p_about || p_about.length < 10 || p_about.length > 400 || !['anime', 'cartoon', 'realistic'].includes(p_style)) {
        return { ok: false, why: 'bad' };
      }
      const o = this.orders.get(p_id);
      if (!o) return { ok: false, why: 'gone' };
      if (o.wallet_code !== p_wallet) return { ok: false, why: 'not_yours' };
      if (o.status !== 'failed' || !o.credit || o.updated < now() - 30 * DAY) return { ok: false, why: 'no_credit' };
      Object.assign(o, { name: p_name, about: p_about, style: p_style, status: 'paid', step: null, task: null, tasks: {}, tries: 0, error: null,
        credit: false, started_at: null, lease: 0, updated: now() });
      return { ok: true };
    },
    studio_due({ p_limit }) {
      return [...this.orders.values()].filter((o) => ['paid', 'making'].includes(o.status) && o.lease <= now()).sort((a, b) => a.updated - b.updated)
        .slice(0, Math.min(Math.max(p_limit ?? 5, 1), 50)).map((o) => o.id);
    },
    studio_month() {
      const m = this.months.get(month()) || { made: 0, burns: 0 }, live = this.live();
      return { made: m.made, burns: m.burns, live: live.length, burn_live: live.filter((o) => o.kind === 'burn').length };
    },
    studio_free_used({ p_wallet }) { return this.free.has(`${p_wallet}:${month()}`); },
    studio_list({ p_limit }) {
      return [...this.orders.values()].filter((o) => o.status === 'done' && !o.hidden).sort((a, b) => b.done_at - a.done_at)
        .slice(0, Math.min(Math.max(p_limit ?? 24, 1), 60)).map((o) => ({ id: o.id, name: o.name, done_at: iso(o.done_at) }));
    },
    studio_mine({ p_wallet, p_limit }) {
      return [...this.orders.values()].filter((o) => o.wallet_code === p_wallet && !this.expired(o)).sort((a, b) => b.created - a.created)
        .slice(0, Math.min(Math.max(p_limit ?? 20, 1), 50))
        .map((o) => ({ id: o.id, name: o.name, status: o.status, credit: o.credit, created_at: iso(o.created) }));
    },
    studio_tidy() {
      let quotes = 0, failed = 0;
      for (const o of [...this.orders.values()]) {
        if (o.status === 'quote' && o.paid === 0 && o.created < now() - 2 * DAY) { this.orders.delete(o.id); quotes += 1; }
        if (o.status === 'failed' && ((!o.credit && o.updated < now() - 30 * DAY) || o.updated < now() - 60 * DAY)) { this.orders.delete(o.id); failed += 1; }
      }
      return { quotes, failed };
    },
  };
}

// ---------- a character's files, as Meshy would make them ----------
// A small rigged, animated character: 2 bones, a skin, one clip per move (Meshy's library names), and a texture
const CLIP_NAMES = ['Idle', 'Big_Wave_Hello', 'FunnyDancing_01', 'Happy_jump_f', 'Victory_Cheer', 'Formal_Bow', 'Casual_Walk', 'All_Night_Dance'];
async function noisePng(px) {
  const raw = Buffer.alloc(px * px * 3);
  let x = 2463534242;                                  // xorshift32: noise that doesn't compress (like a painted texture, only worse)
  for (let i = 0; i < raw.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; raw[i] = x & 255; }
  return sharp(raw, { raw: { width: px, height: px, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
}
let pngCache = null;
async function characterGlb({ clips = CLIP_NAMES, skin = true, texturePx = 2048 } = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 2, 0, 1, 2, 0])))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1])))
    .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5])));
  if (texturePx) {
    pngCache ??= {};
    pngCache[texturePx] ??= await noisePng(texturePx);
    prim.setMaterial(doc.createMaterial('skin').setBaseColorTexture(doc.createTexture('base').setImage(pngCache[texturePx]).setMimeType('image/png')));
  }
  const hips = doc.createNode('Hips');
  const spine = doc.createNode('Spine').setTranslation([0, 1, 0]);
  hips.addChild(spine);
  const body = doc.createNode('Body').setMesh(doc.createMesh('body').addPrimitive(prim));
  if (skin) {
    prim.setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
      .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(Array.from({ length: 6 }, () => [1, 0, 0, 0]).flat())));
    const ibm = acc('MAT4', new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1]));
    body.setSkin(doc.createSkin('rig').addJoint(hips).addJoint(spine).setInverseBindMatrices(ibm).setSkeleton(hips));
  }
  doc.createScene().addChild(hips).addChild(body);
  for (const [i, name] of clips.entries()) {
    const times = new Float32Array(61).map((_, k) => k / 30);
    const rot = new Float32Array(61 * 4).map((_, k) => (k % 4 === 3 ? 1 : 0));
    for (let k = 0; k < 61; k++) rot[k * 4] = Math.sin((k / 30) * (i + 1)) * 0.2;
    const sampler = doc.createAnimationSampler().setInput(acc('SCALAR', times)).setOutput(acc('VEC4', rot)).setInterpolation('LINEAR');
    doc.createAnimation(name).addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(spine).setTargetPath('rotation').setSampler(sampler));
  }
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

// ---------- the fakes ----------
let fake, calls, logs;
const log = () => logs.join('\n');
function meshyObject(t) {
  const o = { id: t.id, type: t.step, status: t.status, progress: t.progress, task_error: { message: t.error || '' }, created_at: t.at };
  if (t.status === 'SUCCEEDED' && (t.step === 'preview' || t.step === 'refine')) {
    o.model_urls = { glb: `https://assets.meshy.ai/tasks/${t.id}/model.glb?Expires=1` };
    o.thumbnail_url = `https://assets.meshy.ai/tasks/${t.id}/preview.png?Expires=1`;
  }
  if (t.status === 'SUCCEEDED' && t.step === 'rig') o.result = { rigged_character_glb_url: `https://assets.meshy.ai/tasks/${t.id}/rigged.glb` };
  if (t.status === 'SUCCEEDED' && t.step === 'moves') o.result = { animation_glb_url: `https://assets.meshy.ai/tasks/${t.id}/animations.glb?Expires=1` };
  return o;
}
// the newest task Meshy has for a step
const taskOf = (step) => [...fake.meshy.tasks.values()].filter((t) => t.step === step).at(-1);
const finish = (step, status = 'SUCCEEDED', error = '') => Object.assign(taskOf(step), { status, progress: status === 'SUCCEEDED' ? 100 : 0, error });

beforeEach(() => {
  // (the build's own settings never decide a test: Vercel runs the tests with the project's real ones present)
  for (const k of SETTINGS) delete process.env[k];
  Object.assign(process.env, ENV);
  _resetStudioKey(); _resetBurnKey(); _resetStudioChain(); _resetChainCache();
  studioLookBurst.reset(); studioFileBurst.reset(); studioActBurst.reset();
  logs = [];
  console.error = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' ')); console.log = (...a) => logs.push(a.join(' '));
  calls = [];
  fake = {
    db: database(), dbDown: false, missing: new Set(),
    storage: new Map(), storageDown: false,
    meshy: { tasks: new Map(), n: 0, fail: [], getFail: null },
    files: { glb: null, png: null, status: 200 },
    chain: { receipts: new Map(), blockTime: Date.now() + 5000, balance: 0n, down: false, usdgDecimals: 6 },   // its blocks: just after the quotes
    explorer: { items: [], status: 200 },
    human: true,
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const method = init.method || 'GET';
    // Supabase: the database
    if (url.startsWith(`${SB}/rest/v1/rpc/`)) {
      const fn = url.slice(`${SB}/rest/v1/rpc/`.length);
      const args = JSON.parse(init.body || '{}');
      calls.push({ to: 'db', fn, args });
      fake.db.calls.push(fn);
      if (fake.dbDown) return new Response('{"message":"down"}', { status: 503 });
      if (fake.missing.has(fn) || typeof fake.db[fn] !== 'function') return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      return Response.json(fake.db[fn](args));
    }
    // Supabase Storage: the private bucket
    if (url.startsWith(`${SB}/storage/v1/object/`)) {
      calls.push({ to: 'storage', method, url, headers: init.headers });
      if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
      const m = /\/storage\/v1\/object\/(authenticated\/)?agi1-characters\/([^/?]+)$/.exec(url);
      if (!m) return new Response('{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}', { status: 400 });
      if (method === 'POST') {
        fake.storage.set(m[2], { bytes: Buffer.from(init.body), type: init.headers['Content-Type'] });
        return Response.json({ Key: `agi1-characters/${m[2]}` });
      }
      const f = fake.storage.get(m[2]);
      return f ? new Response(f.bytes, { headers: { 'Content-Type': f.type } })
        : new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
    }
    // Meshy
    if (url.startsWith(`${MESHY}/openapi/`)) {
      const path = url.slice(MESHY.length);
      calls.push({ to: 'meshy', method, path, auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
      if (method === 'POST') {
        const f = fake.meshy.fail.shift();
        if (f) return new Response(f.text, { status: f.status });
        const body = JSON.parse(init.body);
        const step = path === '/openapi/v2/text-to-3d' ? body.mode : path === '/openapi/v1/rigging' ? 'rig' : path === '/openapi/v1/animations' ? 'moves' : null;
        if (!step) return new Response('{"message":"no such path"}', { status: 404 });
        const id = `0193bfc5-ee4f-73f8-8525-${String(++fake.meshy.n).padStart(12, '0')}`;
        fake.meshy.tasks.set(id, { id, step, body, status: 'PENDING', progress: 0, error: '', at: Date.now() });
        return Response.json({ result: id });
      }
      if (fake.meshy.getFail) return new Response(fake.meshy.getFail.text, { status: fake.meshy.getFail.status });
      const t = fake.meshy.tasks.get(path.split('/').pop());
      return t ? Response.json(meshyObject(t)) : new Response('{"message":"Task not found"}', { status: 404 });
    }
    // Meshy's files
    if (url.startsWith('https://assets.meshy.ai/')) {
      calls.push({ to: 'files', url, redirect: init.redirect });
      if (fake.files.status !== 200) return new Response('expired', { status: fake.files.status });
      const bytes = /\.glb/.test(url) ? fake.files.glb : fake.files.png;
      return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } });
    }
    // Robinhood Chain's public node
    if (url === RPC) {
      const q = JSON.parse(init.body);
      calls.push({ to: 'chain', method: q.method, params: q.params });
      if (fake.chain.down) throw new TypeError('fetch failed');
      const answer = (result) => Response.json({ jsonrpc: '2.0', id: q.id, result });
      if (q.method === 'eth_call') {
        const { to, data } = q.params[0];
        if (to.toLowerCase() === USDG_LC && data === '0x313ce567') return answer(`0x${pad(fake.chain.usdgDecimals)}`);
        if (to.toLowerCase() === AGI && data === '0x313ce567') return answer(`0x${pad(18)}`);
        if (to.toLowerCase() === AGI && data.startsWith('0x70a08231')) return answer(`0x${pad(fake.chain.balance)}`);
        return answer('0x');
      }
      if (q.method === 'eth_getTransactionReceipt') return answer(fake.chain.receipts.get(q.params[0]) ?? null);
      if (q.method === 'eth_getBlockByNumber') return answer({ number: q.params[0], timestamp: `0x${Math.floor(fake.chain.blockTime / 1000).toString(16)}` });
      return Response.json({ jsonrpc: '2.0', id: q.id, error: { message: 'method not allowed' } });
    }
    // the block explorer
    if (url.startsWith(EXPLORER)) {
      calls.push({ to: 'explorer', url });
      if (fake.explorer.status !== 200) return new Response('busy', { status: fake.explorer.status });
      return Response.json({ items: fake.explorer.items, next_page_params: null });
    }
    // Cloudflare's human check
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      calls.push({ to: 'turnstile', body: JSON.parse(init.body) });
      return Response.json({ success: fake.human, action: 'studio' });
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
});

// ---------- helpers ----------
const cfgNow = () => getConfig();
// a transaction's receipt: what it moved (Transfer events), from the chain
const transferLog = (token, from, to, raw) => ({ address: token, topics: [TRANSFER, topic(from), topic(to)], data: `0x${pad(raw)}`, removed: false });
function onChain(tx, logs, { status = '0x1', block = '0x2a' } = {}) {
  fake.chain.receipts.set(tx, { transactionHash: tx, status, blockNumber: block, logs });
}
const usdgPay = (tx, cents, { from = WALLET, to = OWNER } = {}) => onChain(tx, [transferLog(USDG, from, to, BigInt(cents) * 10n ** 4n)]);
const agiBurn = (tx, agi, { from = WALLET, to = DEAD } = {}) => onChain(tx, [transferLog(AGI_CONTRACT, from, to, BigInt(agi) * E18)]);
const explorerItem = (tx, { token = USDG, from = WALLET, to = OWNER, at = Date.now() - 30_000 } = {}) =>
  ({ transaction_hash: tx, from: { hash: from }, to: { hash: to }, token: { address_hash: token }, timestamp: new Date(at).toISOString() });
// a quote made the way the page makes it, through the API
async function apiQuote(extra = {}, { session = sessionFor(), adult = true } = {}) {
  const res = await studioPost(cfgNow(), req(), { action: 'studio-quote', session, ...GOOD, adult, turnstileToken: 'ts-token', ...extra });
  return { status: res.status, body: await res.json() };
}
const req = (headers = {}) => new Request('https://www.agi1.app/api/launch', { method: 'POST', headers: { 'x-real-ip': IP, ...headers } });
const getReq = (q) => new Request(`https://www.agi1.app/api/launch?${q}`, { headers: { 'x-real-ip': IP } });
// through api/launch.js, as the page asks; a new order (studio-quote) straight to server/studio-api.js, since api/launch.js
// answers it 410 "moved" (AGI Studio makes 3D models from influencers since 2026-10-10: tests/influencer.test.js)
async function routerPost(body) {
  const res = await launchPost(new Request('https://www.agi1.app/api/launch', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json(), headers: res.headers };
}
async function post(body) {
  if (body?.action !== 'studio-quote') return routerPost(body);
  const res = await studioPost(cfgNow(), new Request('https://www.agi1.app/api/launch', { method: 'POST', headers: { 'x-real-ip': IP } }), body);
  return { status: res.status, body: await res.json(), headers: res.headers };
}
async function get(q) {
  const res = await launchGet(getReq(q));
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}
// a quote straight in the database, paid and ready to be made (kind: how it was paid)
async function paidOrder({ wallet = WALLET, level = 1, kind = 'usdg' } = {}) {
  const q = await makeQuote(cfgNow(), { wallet, level, ...GOOD });
  assert.equal(q.ok, true, JSON.stringify(q));
  const o = fake.db.orders.get(q.id);
  Object.assign(o, { kind, status: 'paid', paid: kind === 'usdg' ? o.usd_cents : o.agi, paid_at: Date.now() });
  fake.db.month().made += 1;
  return q.id;
}
// a paid character moved along through Meshy's steps (each finished by Meshy before it's asked about again), until `last`
// has been started at Meshy
const STEPS = ['preview', 'refine', 'rig', 'moves'];
async function makeUpTo(id, last, opts = {}) {
  let r = await tick(cfgNow(), id, opts);
  assert.deepEqual(r, { state: 'started', step: 'preview' });
  for (const step of STEPS.slice(0, STEPS.indexOf(last))) {
    finish(step);
    fake.db.orders.get(id).lease = 0;
    r = await tick(cfgNow(), id, opts);
    assert.deepEqual(r, { state: 'started', step: STEPS[STEPS.indexOf(step) + 1] });
  }
  return r;
}
const again = (id) => { fake.db.orders.get(id).lease = 0; };

// ---------- the rules the page and our server share ----------
test('rules: its moves (Meshy library ids, at most 10 in one file), ids, files, prices and discounts', () => {
  assert.deepEqual(R.MOVE_NAMES, ['idle', 'wave', 'dance', 'jump', 'cheer', 'bow', 'walk', 'party']);
  assert.deepEqual(R.MOVES.map((m) => m.action), [0, 28, 22, 44, 59, 41, 30, 64], "Meshy's animation library: Idle, Big_Wave_Hello, FunnyDancing_01, Happy_jump_f, Victory_Cheer, Formal_Bow, Casual_Walk, All_Night_Dance");
  assert.equal(new Set(R.MOVES.map((m) => m.action)).size, R.MOVES.length, 'unique ids (Meshy asks for them)');
  assert.ok(R.MOVES.length <= 10, "Meshy's merged file takes 1 to 10 actions");
  assert.equal(R.MOVE_NAMES[0], 'idle', 'how it stands comes first');
  for (const m of R.LOOPING) assert.ok(R.MOVE_NAMES.includes(m));
  for (const [move, words] of Object.entries(R.MOVE_WORDS)) {
    assert.ok(R.MOVE_NAMES.includes(move), move);
    for (const w of words) assert.match(w, /^[a-z]+$/);
  }
  assert.ok(R.ORDER_ID.test(newOrderId()) && R.ORDER_ID.test(newOrderId()));
  assert.notEqual(newOrderId(), newOrderId());
  for (const bad of ['short', 'x'.repeat(23), `${'x'.repeat(21)}!`, `${'x'.repeat(21)}/`]) assert.equal(R.ORDER_ID.test(bad), false, bad);
  assert.deepEqual(R.FILE_RE.exec(`${'a'.repeat(22)}.glb`).slice(1), ['a'.repeat(22), 'glb']);
  for (const bad of [`${'a'.repeat(22)}.gltf`, `${'a'.repeat(22)}.webp.html`, `../${'a'.repeat(22)}.png`, `${'a'.repeat(21)}.png`]) assert.equal(R.FILE_RE.test(bad), false, bad);
  assert.equal(R.fileUrl('a'.repeat(22), 'glb'), `/api/launch?studio-file=${'a'.repeat(22)}.glb`);
  assert.deepEqual(R.FILES, { glb: 'model/gltf-binary', webp: 'image/webp', png: 'image/png' });
  assert.deepEqual(R.DISCOUNT, { 1: 0, 2: 0.2, 3: 0.4 });
  assert.deepEqual(R.priceFor(1, { usdCents: 500, agi: 15_000 }), { usdCents: 500, agi: 15_000 });
  assert.deepEqual(R.priceFor(2, { usdCents: 500, agi: 15_000 }), { usdCents: 400, agi: 12_000 });
  assert.deepEqual(R.priceFor(3, { usdCents: 500, agi: 15_000 }), { usdCents: 300, agi: 9000 });
  assert.deepEqual(R.priceFor(9, { usdCents: 499, agi: 1001 }), { usdCents: 499, agi: 1001 }, 'an unknown level: no discount');
  assert.equal(R.usd(500), '$5'); assert.equal(R.usd(399), '$3.99'); assert.equal(R.usd(50), '$0.50');
  assert.deepEqual(R.STEPS.map((s) => s.step), ['preview', 'refine', 'rig', 'moves', 'save']);
});

test('rules: the move a chat message asks for (whole words, any case, only the moves it has)', () => {
  assert.equal(R.moveIn('dance!'), 'dance');
  assert.equal(R.moveIn('can you DANCE for me?'), 'dance');
  assert.equal(R.moveIn('/jump'), 'jump');
  assert.equal(R.moveIn('gm gm'), 'wave');
  assert.equal(R.moveIn('thank you so much'), 'bow');
  assert.equal(R.moveIn('lets party'), 'party');
  assert.equal(R.moveIn('stop'), 'idle');
  assert.equal(R.moveIn('hello, now dance'), 'wave', 'the first word that names one');
  assert.equal(R.moveIn('dancer'), null, 'whole words only');
  assert.equal(R.moveIn('what a nice day'), null);
  assert.equal(R.moveIn(''), null); assert.equal(R.moveIn(null), null);
  assert.equal(R.moveIn('dance', ['idle', 'wave']), null, 'a move its file lacks');
  assert.equal(R.moveIn('ｄａｎｃｅ'), 'dance', 'full-width letters read as plain ones');
  assert.equal(R.moveIn(`${'blah '.repeat(60)}dance`), null, 'only its first 40 words are read');
});

// ---------- its words ----------
test('words: a character people describe passes; PG-13, real people, others\' characters and her stay out', () => {
  assert.deepEqual(checkCharacter(GOOD), { ok: true, ...GOOD });
  const ok = (name, about, style = 'cartoon') => checkCharacter({ name, about, style });
  for (const [name, about] of [
    ['Sir Fluff', 'a fluffy orange cat knight in shiny silver armor with a red cape'],
    ['Zara', 'a cyberpunk hacker with neon green hair, a leather jacket and big boots'],
    ['Captain Byte', 'a retro robot captain with a round glass head and a blue uniform'],
    ['Lil Moon', 'a sleepy moon spirit wearing star pajamas and fuzzy slippers'],
    ['Señor Taco', 'un mariachi alegre con sombrero grande y traje negro bordado'],
    ['Kiki', 'ピンクの髪のかわいい魔法使い、紫のローブと星の杖'],
    ['Mr. Pickles', 'a grumpy old wizard with a long white beard and a blue pointy hat'],
  ]) assert.equal(ok(name, about).ok, true, `${name}: ${JSON.stringify(ok(name, about))}`);
  const no = (field, why, name, about, style = 'anime') => assert.deepEqual(checkCharacter({ name, about, style }), { ok: false, field, why }, `${name} / ${about}`);
  no('name', 'empty', '   ', GOOD.about);
  no('name', 'long', 'x'.repeat(25), GOOD.about);
  no('name', 'letters', '<script>', GOOD.about);
  no('name', 'link', 'Mochi.com', GOOD.about);
  no('about', 'link', 'Mochi', 'a girl from https://example.org with a hat');
  no('about', 'contact', 'Mochi', 'a girl in a hat, dm me on @mochi_irl for more');
  no('about', 'contact', 'Mochi', 'a girl in a hat, wallet 0xfa31d04462746aaa24bc7e5626403e09e4b106ec');
  no('about', 'empty', 'Mochi', '');
  no('about', 'short', 'Mochi', 'a girl');
  no('about', 'long', 'Mochi', 'a'.repeat(401));
  no('style', 'empty', 'Mochi', GOOD.about, 'pixel');
  no('style', 'empty', 'Mochi', GOOD.about, '__proto__');
  for (const about of ['a sexy girl in lingerie', 'a busty woman showing cleavage', 'a nude statue of a dancer', 'a lewd maid outfit girl', 'a girl in a bikini on a beach']) {
    assert.equal(checkCharacter({ name: 'Mochi', about, style: 'anime' }).why, 'adult', about);
  }
  for (const about of ['a cute little girl with pigtails', 'a 12 yo boy with a skateboard', 'a schoolgirl in a sailor uniform', 'a loli witch with a big hat', 'a teenager in a hoodie and jeans']) {
    assert.equal(checkCharacter({ name: 'Mochi', about, style: 'anime' }).why, 'minor', about);
  }
  for (const about of ['a nazi officer with a red armband', 'a gory zombie with severed arms']) assert.equal(checkCharacter({ name: 'Mochi', about, style: 'anime' }).why, 'hate', about);
  assert.equal(checkCharacter({ name: 'Mochi', about: 'a sexy schoolgirl in a short skirt', style: 'anime' }).why, 'minor', 'a child first, always');
  for (const [name, about] of [['ElonMusk', GOOD.about], ['Mochi', 'taylor swift in a sparkly stage outfit'], ['Mochi', 'vitalik in a unicorn shirt'],
    ['Trump', GOOD.about], ['Mochi', 'a CZ lookalike in a black hoodie']]) {
    assert.equal(checkCharacter({ name, about, style: 'realistic' }).why, 'person', `${name} / ${about}`);
  }
  for (const about of ['pikachu in a top hat and monocle', 'hatsune miku with long teal twintails', 'spider-man in a winter coat', 'a minecraft creeper wearing sunglasses', 'pepe the frog in a suit']) {
    assert.equal(checkCharacter({ name: 'Mochi', about, style: 'cartoon' }).why, 'character', about);
  }
  for (const [name, about] of [['AGI-1', GOOD.about], ['Mochi', 'the official mascot of the team, purple hair'], ['Agi1 fan', GOOD.about], ['Mochi', 'an admin of clank.trade in a hoodie']]) {
    const r = checkCharacter({ name, about, style: 'anime' });
    assert.ok(['her', 'link'].includes(r.why), `${name} / ${about}: ${JSON.stringify(r)}`);
  }
  assert.equal(checkCharacter({ name: 'Mo​chi', about: `${GOOD.about}‮`, style: 'anime' }).ok, true, 'invisible characters dropped');
  assert.equal(checkCharacter({ name: 'Mo​chi', about: GOOD.about, style: 'anime' }).name, 'Mo chi');
});

test("words: what Meshy gets (one humanoid in an A-pose, family-friendly, no text), within its 800 characters", () => {
  for (const style of Object.keys(R.STYLES)) {
    const about = 'x'.repeat(R.ABOUT_MAX);
    const p = meshyPrompt({ about, style }), t = meshyTexture({ about, style });
    assert.ok(p.length <= 800 && t.length <= 800, `${style}: ${p.length} / ${t.length}`);
    assert.match(p, /one humanoid figure with two arms and two legs, standing in an A-pose/);
    assert.match(p, /Family-friendly, fully clothed\. No text, no logos, no background\./);
    assert.match(t, /Family-friendly, fully clothed\. No text, no logos\./);
    assert.ok(p.includes(about) && t.includes(about));
  }
  assert.match(meshyPrompt({ about: GOOD.about, style: 'anime' }), /^Full body, a stylized anime-style 3D character/);
});

// ---------- Meshy ----------
test("Meshy: each step's request as its docs write it, with our key (never in an error)", async () => {
  assert.deepEqual(meshyBody('preview', { prompt: 'P' }), { mode: 'preview', prompt: 'P', ai_model: 'latest', model_type: 'standard', pose_mode: 'a-pose',
    should_remesh: true, target_polycount: 20000, topology: 'triangle', moderation: true, target_formats: ['glb'] });
  assert.deepEqual(meshyBody('refine', { previewId: 'pv-123456', texture: 'T' }), { mode: 'refine', preview_task_id: 'pv-123456', enable_pbr: false,
    texture_prompt: 'T', texture_resolution: '2k', moderation: true, target_formats: ['glb'] });
  assert.deepEqual(meshyBody('rig', { refineId: 'rf-123456' }), { input_task_id: 'rf-123456', height_meters: 1.7 });
  assert.deepEqual(meshyBody('moves', { rigId: 'rg-123456' }), { rig_task_id: 'rg-123456', action_ids: [0, 28, 22, 44, 59, 41, 30, 64] });
  // (2026-10-10, AGI Studio) an influencer's 3D model: image to 3D from its full-body picture, painted, in an A-pose
  assert.deepEqual(meshyBody('image', { imageUrl: 'https://x.supabase.co/storage/v1/object/sign/a.png?token=t' }), {
    image_url: 'https://x.supabase.co/storage/v1/object/sign/a.png?token=t', ai_model: 'latest', topology: 'triangle', target_polycount: 20000,
    should_remesh: true, should_texture: true, enable_pbr: false, pose_mode: 'a-pose', moderation: true });
  assert.throws(() => meshyBody('paint'), /no step paint/);
  assert.deepEqual(CREDITS, { preview: 20, refine: 10, image: 30, rig: 5, moves: 24 });
  assert.equal(CREDITS.preview + CREDITS.refine + CREDITS.rig + CREDITS.moves, 59, 'a character is 59 credits');
  assert.equal(CREDITS.image + CREDITS.rig + CREDITS.moves, 59, 'an influencer\'s 3D model too');
  const cfg = cfgNow();
  const id = await meshyStart(cfg, 'preview', { prompt: meshyPrompt(GOOD) });
  assert.match(id, /^0193bfc5-/);
  const c = calls.find((x) => x.to === 'meshy');
  assert.deepEqual([c.method, c.path, c.auth], ['POST', '/openapi/v2/text-to-3d', `Bearer ${MESHY_KEY}`]);
  assert.equal(c.body.prompt, meshyPrompt(GOOD));
  await meshyStart(cfg, 'rig', { refineId: id });
  await meshyStart(cfg, 'moves', { rigId: id });
  assert.deepEqual(calls.filter((x) => x.to === 'meshy').map((x) => x.path), ['/openapi/v2/text-to-3d', '/openapi/v1/rigging', '/openapi/v1/animations']);
  // its answers
  let t = await meshyTask(cfg, 'preview', id);
  assert.deepEqual([t.status, t.progress, t.refused], ['PENDING', 0, false]);
  Object.assign(fake.meshy.tasks.get(id), { status: 'IN_PROGRESS', progress: 140 });
  assert.equal((await meshyTask(cfg, 'preview', id)).progress, 100, 'kept between 0 and 100');
  Object.assign(fake.meshy.tasks.get(id), { status: 'FAILED', error: 'The prompt was flagged by our moderation system' });
  t = await meshyTask(cfg, 'preview', id);
  assert.deepEqual([t.status, t.refused], ['FAILED', true]);
  Object.assign(fake.meshy.tasks.get(id), { status: 'FAILED', error: 'Internal server error' });
  assert.equal((await meshyTask(cfg, 'preview', id)).refused, false);
  await assert.rejects(meshyTask(cfg, 'preview', '../../x'), (e) => e.why === 'request');
  // its "no"s, each with a word for what to do, never the key
  for (const [status, why, text] of [[401, 'key', `{"message":"Invalid API key ${MESHY_KEY}"}`], [402, 'credits', '{"message":"Insufficient credits"}'],
    [429, 'busy', '{"message":"NoMoreConcurrentTasks"}'], [422, 'pose', '{"message":"Pose estimation failed"}'], [500, 'meshy', 'oops'],
    [400, 'request', '{"message":"bad"}']]) {
    fake.meshy.fail.push({ status, text });
    const err = await meshyStart(cfg, 'rig', { refineId: id }).catch((e) => e);
    assert.equal(err.why, why, `${status}`);
    assert.ok(!err.message.includes(MESHY_KEY), err.message);
  }
  fake.meshy.fail.push({ status: 401, text: 'no' });
  assert.match((await meshyStart(cfg, 'rig', { refineId: id }).catch((e) => e)).message, /MESHY_API_KEY is wrong/);
  fake.meshy.fail.push({ status: 402, text: 'no' });
  assert.match((await meshyStart(cfg, 'rig', { refineId: id }).catch((e) => e)).message, /no Meshy credits left/);
  fake.meshy.fail.push({ status: 200, text: '{"result":"not a valid id!"}' });
  assert.equal((await meshyStart(cfg, 'rig', { refineId: id }).catch((e) => e)).why, 'meshy');
  // the files a finished step names
  assert.equal(animationUrl({ result: { animation_glb_url: 'https://assets.meshy.ai/a.glb' } }), 'https://assets.meshy.ai/a.glb');
  assert.equal(animationUrl({ result: { animation_glb_url: 'http://assets.meshy.ai/a.glb' } }), null);
  assert.equal(animationUrl({}), null);
  assert.equal(thumbnailUrl({ thumbnail_url: 'https://assets.meshy.ai/p.png' }), 'https://assets.meshy.ai/p.png');
  assert.equal(thumbnailUrl({ thumbnail_url: 'javascript:alert(1)' }), null);
});

// ---------- its files ----------
test("files: only Meshy's own https addresses, never a redirect; a file too big or gone says so", async () => {
  fake.files.glb = Buffer.from('glTF-ish');
  for (const bad of ['http://assets.meshy.ai/x.glb', 'https://evil.com/assets.meshy.ai.glb', 'https://meshy.ai.evil.com/x.glb', 'https://user:pw@assets.meshy.ai/x.glb',
    'https://assets.meshy.ai:8443/x.glb', 'file:///etc/passwd', 'not a url']) {
    await assert.rejects(F.fromMeshy(bad), /files: not/, bad);
  }
  assert.equal(calls.length, 0, 'nothing fetched');
  assert.deepEqual(await F.fromMeshy('https://assets.meshy.ai/tasks/1/animations.glb?Expires=1'), Buffer.from('glTF-ish'));
  assert.equal(calls[0].redirect, 'error');
  await assert.rejects(F.fromMeshy('https://assets.meshy.ai/tasks/1/animations.glb', { max: 4 }), /too big/);
  fake.files.status = 403;
  const err = await F.fromMeshy('https://assets.meshy.ai/tasks/1/animations.glb').catch((e) => e);
  assert.match(err.message, /HTTP 403/); assert.equal(err.gone, true);
  fake.files.status = 502;
  assert.notEqual((await F.fromMeshy('https://assets.meshy.ai/tasks/1/animations.glb').catch((e) => e)).gone, true);
});

test("files: a character made small (its textures 1024 px at most, as glTF's own JPEG; its bones and moves kept), under 4 MB", async () => {
  const source = await characterGlb();
  assert.ok(F.isGlb(source) && !F.isGlb(Buffer.from('not a glb at all, really')) && !F.isGlb(null));
  assert.ok(source.length > 5_000_000, `its texture makes it big first (${source.length} bytes)`);
  const small = await F.smallGlb(source);
  assert.ok(small.bytes.length <= F.GLB_MAX && small.bytes.length < source.length / 4, `${small.bytes.length} bytes`);
  assert.deepEqual(small.clips, CLIP_NAMES, 'every move, in order');
  assert.equal(small.skins, 1); assert.equal(small.triangles, 4); assert.equal(small.size, 1024);
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(new Uint8Array(small.bytes));
  const tex = doc.getRoot().listTextures();
  assert.equal(tex.length, 1); assert.equal(tex[0].getMimeType(), 'image/jpeg');
  const meta = await sharp(Buffer.from(tex[0].getImage())).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1024, 1024]);
  assert.deepEqual(doc.getRoot().listAnimations().map((a) => a.getName()), CLIP_NAMES);
  assert.equal(doc.getRoot().listSkins()[0].listJoints().length, 2);
  assert.deepEqual(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName), [], "no extension: glTF's own formats, opened anywhere");
  // a texture with see-through parts stays a PNG (its alpha kept)
  const rgba = Buffer.alloc(600 * 600 * 4);
  for (let i = 0; i < 600 * 600; i++) rgba.set([i % 251, (i * 7) % 253, 90, i % 600 < 300 ? 255 : 100], i * 4);   // half of it see-through
  const clear = await sharp(rgba, { raw: { width: 600, height: 600, channels: 4 } }).png().toBuffer();
  const d2 = await new NodeIO().readBinary(new Uint8Array(await characterGlb({ texturePx: 64 })));
  d2.getRoot().listTextures()[0].setImage(clear);
  const s2 = await F.smallGlb(Buffer.from(await new NodeIO().writeBinary(d2)));
  const t2 = (await new NodeIO().readBinary(new Uint8Array(s2.bytes))).getRoot().listTextures()[0];
  assert.equal(t2.getMimeType(), 'image/png');
  assert.equal((await sharp(Buffer.from(t2.getImage())).stats()).isOpaque, false);
  // too big even made small
  const tooBig = await F.smallGlb(source, { max: 20_000 }).catch((e) => e);
  assert.equal(tooBig.tooBig, true); assert.match(tooBig.message, /still .* MB made small/);
  // not a character
  await assert.rejects(F.smallGlb(Buffer.from('x'.repeat(100))), /isn't a GLB/);
  await assert.rejects(F.smallGlb(await characterGlb({ skin: false, texturePx: 0 })), /no bones/);
  await assert.rejects(F.smallGlb(await characterGlb({ clips: [], texturePx: 0 })), /no moves/);
});

test('files: its picture, a 384 px WebP for the pages and a 1024 px PNG to download; never more than it is', async () => {
  const src = await sharp({ create: { width: 1600, height: 1200, channels: 4, background: { r: 120, g: 60, b: 200, alpha: 1 } } }).png().toBuffer();
  const { webp, png } = await F.pictures(src);
  const [w, p] = await Promise.all([sharp(webp).metadata(), sharp(png).metadata()]);
  assert.deepEqual([w.format, w.width, w.height], ['webp', 384, 288]);
  assert.deepEqual([p.format, p.width, p.height], ['png', 1024, 768]);
  const tiny = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  const t = await F.pictures(tiny);
  assert.equal((await sharp(t.png).metadata()).width, 200, 'never enlarged');
  await assert.rejects(F.pictures(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), /isn't one/);
  await assert.rejects(F.pictures(Buffer.from('nope')), /isn't one/);
});

test('files: kept in the private bucket and read back with our secret key; a file not there is null', async () => {
  const cfg = cfgNow();
  const name = `${'A'.repeat(22)}.glb`;
  await F.putFile(cfg, name, Buffer.from('glb bytes'), 'model/gltf-binary');
  const c = calls.find((x) => x.to === 'storage');
  assert.equal(c.url, `${SB}/storage/v1/object/agi1-characters/${name}`);
  assert.deepEqual([c.method, c.headers.Authorization, c.headers.apikey, c.headers['Content-Type'], c.headers['x-upsert']],
    ['POST', `Bearer ${ENV.SUPABASE_SECRET_KEY}`, ENV.SUPABASE_SECRET_KEY, 'model/gltf-binary', 'true']);
  assert.deepEqual(await F.getFile(cfg, name), Buffer.from('glb bytes'));
  assert.equal(calls.at(-1).url, `${SB}/storage/v1/object/authenticated/agi1-characters/${name}`);
  assert.equal(await F.getFile(cfg, `${'B'.repeat(22)}.png`), null, "Supabase's 400 \"not found\"");
  assert.equal(await F.getFile(cfg, '../../secret.glb'), null);
  await assert.rejects(F.putFile(cfg, 'x/../y.glb', Buffer.from('x'), 'model/gltf-binary'), /bad file name/);
  fake.storageDown = true;
  await assert.rejects(F.putFile(cfg, name, Buffer.from('x'), 'model/gltf-binary'), /storage HTTP 500/);
  await assert.rejects(F.getFile(cfg, name), /storage HTTP 500/);
  fake.storageDown = false;
  globalThis.fetch = async () => new Response('{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}', { status: 400 });
  await assert.rejects(F.putFile(cfg, name, Buffer.from('x'), 'model/gltf-binary'), /run supabase\/studio\.sql: it makes the bucket/);
});

// ---------- payments, read on Robinhood Chain ----------
test("chain: what a transaction paid (the official token's Transfer events only, from this wallet, to where it should go)", () => {
  const tx = txOf(1);
  const r = (logs) => ({ transactionHash: tx, status: '0x1', logs });
  const usdg = { kind: 'usdg', wallet: WALLET, payTo: OWNER };
  assert.deepEqual(paidIn(r([transferLog(USDG, WALLET, OWNER, 5_000_000n)]), usdg), { paid: 5_000_000n, others: 0n });
  assert.deepEqual(paidIn(r([transferLog(USDG, WALLET, OWNER, 3n), transferLog(USDG, WALLET, OWNER, 4n)]), usdg), { paid: 7n, others: 0n }, 'added up');
  assert.deepEqual(paidIn(r([transferLog(USDG, OTHER, OWNER, 9n)]), usdg), { paid: 0n, others: 9n }, "another wallet's");
  assert.deepEqual(paidIn(r([transferLog(USDG, WALLET, OTHER, 9n)]), usdg), { paid: 0n, others: 0n }, 'somewhere else');
  assert.deepEqual(paidIn(r([transferLog(OTHER, WALLET, OWNER, 9n)]), usdg), { paid: 0n, others: 0n }, 'a look-alike token');
  assert.deepEqual(paidIn(r([{ ...transferLog(USDG, WALLET, OWNER, 9n), removed: true }]), usdg), { paid: 0n, others: 0n }, 'a removed log');
  assert.deepEqual(paidIn(r([transferLog(USDG, `0x${'0'.repeat(40)}`, OWNER, 9n)]), usdg), { paid: 0n, others: 0n }, 'a mint');
  const burn = { kind: 'burn', wallet: WALLET };
  assert.deepEqual(paidIn(r([transferLog(AGI_CONTRACT, WALLET, DEAD, 15_000n * E18)]), burn), { paid: 15_000n * E18, others: 0n });
  assert.deepEqual(paidIn(r([transferLog(AGI_CONTRACT, WALLET, `0x${'0'.repeat(40)}`, 5n)]), burn), { paid: 5n, others: 0n }, "the coin's own burn()");
  assert.deepEqual(paidIn(r([transferLog(AGI_CONTRACT, WALLET, OWNER, 5n)]), burn), { paid: 0n, others: 0n }, 'sent, not burned');
  assert.deepEqual(paidIn(r([transferLog(USDG, WALLET, DEAD, 5n)]), burn), { paid: 0n, others: 0n }, 'USDG burned is no $AGI burn');
  assert.deepEqual(paidIn(r([transferLog(AGI_CONTRACT, WALLET, OWNER, 5n)]), usdg), { paid: 0n, others: 0n }, '$AGI sent is no USDG');
  assert.deepEqual(paidIn(null, usdg), { paid: 0n, others: 0n });
});

test('chain: one payment read (pending, failed, nothing, another wallet\'s, too old, or what it paid and when); USDG in cents, $AGI whole', async () => {
  const look = { kind: 'usdg', wallet: WALLET, payTo: OWNER, after: Date.now() - 3600_000, now: Date.now() };
  assert.deepEqual(await readPayment(txOf(1), look), { ok: false, why: 'pending' });
  usdgPay(txOf(2), 500);
  const ok = await readPayment(txOf(2), look);
  assert.equal(ok.ok, true); assert.equal(ok.raw, 5_000_000n); assert.equal(ok.at, Math.floor(fake.chain.blockTime / 1000) * 1000);
  onChain(txOf(3), [transferLog(USDG, WALLET, OWNER, 1n)], { status: '0x0' });
  assert.deepEqual(await readPayment(txOf(3), look), { ok: false, why: 'failed' });
  usdgPay(txOf(4), 500, { to: OTHER });
  assert.deepEqual(await readPayment(txOf(4), look), { ok: false, why: 'nothing' });
  usdgPay(txOf(5), 500, { from: OTHER });
  assert.deepEqual(await readPayment(txOf(5), look), { ok: false, why: 'other_wallet' });
  fake.chain.blockTime = look.after - 5 * 60_000;
  assert.deepEqual(await readPayment(txOf(2), look), { ok: false, why: 'too_old' }, 'before the quote');
  fake.chain.blockTime = look.after - 30_000;
  assert.equal((await readPayment(txOf(2), look)).ok, true, "a minute's leeway for clocks");
  fake.chain.blockTime = Date.now() - PAY_WINDOW_MS - 60_000;
  assert.deepEqual(await readPayment(txOf(2), { ...look, after: 0 }), { ok: false, why: 'too_old' }, 'more than 7 days ago');
  fake.chain.receipts.set(txOf(6), { transactionHash: txOf(7), status: '0x1', blockNumber: '0x1', logs: [] });
  await assert.rejects(readPayment(txOf(6), look), /chain: a receipt for another transaction/);
  fake.chain.down = true;
  await assert.rejects(readPayment(txOf(2), look), /^Error: chain: /);
  fake.chain.down = false;
  // what it pays toward a character
  assert.equal(await amountOf('usdg', 5_000_000n), 500);
  assert.equal(await amountOf('usdg', 4_999_999n), 499, 'rounded down');
  assert.equal(await amountOf('burn', 15_000n * E18 + 999n), 15_000);
  _resetStudioChain(); fake.chain.usdgDecimals = 18;
  assert.equal(await amountOf('usdg', 5n * E18), 500, "USDG's decimals read from its contract");
  _resetStudioChain(); fake.chain.usdgDecimals = 99;
  await assert.rejects(amountOf('usdg', 1n), /odd decimals/);
});

test("chain: the wallet's payments since the quote, as the block explorer lists them (only which to read)", async () => {
  const after = Date.now() - 3600_000;
  fake.explorer.items = [
    explorerItem(txOf(1), { at: Date.now() - 1000 }),
    explorerItem(txOf(2), { at: Date.now() - 2000 }),
    explorerItem(txOf(1), { at: Date.now() - 1000 }),                       // listed twice
    explorerItem(txOf(3), { to: OTHER }),                                  // somewhere else
    explorerItem(txOf(4), { token: OTHER }),                               // a look-alike
    explorerItem(txOf(5), { at: after - 3600_000 }),                       // before the quote
    explorerItem(txOf(6), { from: OTHER }),
    { transaction_hash: 'nope', from: { hash: WALLET }, to: { hash: OWNER } },
  ];
  const list = await recentPayments(WALLET, { kind: 'usdg', payTo: OWNER, after });
  assert.deepEqual(list.map((p) => p.tx), [txOf(1), txOf(2)]);
  assert.match(calls.at(-1).url, new RegExp(`${WALLET}/token-transfers\\?type=ERC-20&filter=from&token=${USDG_LC}$`));
  fake.explorer.items = Array.from({ length: 9 }, (_, i) => explorerItem(txOf(10 + i), { token: AGI_CONTRACT, to: DEAD, at: Date.now() - i * 1000 }));
  const burns = await recentPayments(WALLET, { kind: 'burn', after });
  assert.deepEqual(burns.map((p) => p.tx), [10, 11, 12, 13, 14].map(txOf), 'the newest 5');
  fake.explorer.status = 502;
  await assert.rejects(recentPayments(WALLET, { kind: 'burn', after }), /explorer HTTP 502/);
});

// ---------- the studio itself ----------
test('settings: off without Meshy\'s key; private until STUDIO_OPEN (only STUDIO_ONLY_FOR); prices, caps and hidden ones', () => {
  let cfg = cfgNow();
  assert.equal(studioOn(cfg), true);
  assert.deepEqual([cfg.studioPayTo, cfg.studioUsdCents, cfg.studioAgi, cfg.studioMonthCap, cfg.studioBurnCap, cfg.studioOpen], [OWNER, 500, 15_000, 15, 10, true]);   // 10 by burning (round 2 of AGI Studio: 5 before)
  delete process.env.MESHY_API_KEY;
  assert.equal(studioOn(cfgNow()), false);
  process.env.MESHY_API_KEY = MESHY_KEY;
  delete process.env.STUDIO_OPEN;
  cfg = cfgNow();
  assert.equal(mayMake(cfg, WALLET), false, 'private, and nobody listed: nobody');
  process.env.STUDIO_ONLY_FOR = `${WALLET.toUpperCase().replace('0X', '0x')}, not-an-address, ${OTHER}`;
  cfg = cfgNow();
  assert.equal(mayMake(cfg, WALLET), true); assert.equal(mayMake(cfg, OTHER), true); assert.equal(mayMake(cfg, OWNER), false);
  assert.equal(cfg.studioOnlyFor.size, 2);
  for (const v of ['yes', 'ON', 'true', '1']) { process.env.STUDIO_OPEN = v; assert.equal(cfgNow().studioOpen, true, v); }
  for (const v of ['no', 'off', '', 'maybe']) { process.env.STUDIO_OPEN = v; assert.equal(cfgNow().studioOpen, false, v); }
  Object.assign(process.env, { STUDIO_PRICE_USD: '3.99', STUDIO_PRICE_AGI: '20000.7', STUDIO_A_MONTH: '40', STUDIO_BURNS_A_MONTH: '0' });
  cfg = cfgNow();
  assert.deepEqual([cfg.studioUsdCents, cfg.studioAgi, cfg.studioMonthCap, cfg.studioBurnCap], [399, 20_000, 40, 0], 'no burns at all is a choice');
  Object.assign(process.env, { STUDIO_PRICE_USD: '0.001', STUDIO_PRICE_AGI: '5', STUDIO_A_MONTH: 'lots', STUDIO_BURNS_A_MONTH: '-3' });
  cfg = cfgNow();
  assert.deepEqual([cfg.studioUsdCents, cfg.studioAgi, cfg.studioMonthCap, cfg.studioBurnCap], [50, 100, 15, 10], 'never free by mistake; nonsense: the defaults');
  for (const bad of ['0x123', '', `0x${'0'.repeat(40)}`, 'owner.eth']) assert.equal(studioAddress(bad), '', bad);
  assert.equal(studioAddress(` ${OWNER.toUpperCase().replace('0X', '0x')} `), OWNER);
  process.env.STUDIO_HIDE = `${'h'.repeat(22)}, bad, ${'k'.repeat(22)}`;
  assert.deepEqual([...cfgNow().studioHide], ['h'.repeat(22), 'k'.repeat(22)]);
});

test("a wallet's code is its own (never the address, not her chat's or burns' code); a burn's payment code is burns.sql's", () => {
  const code = studioWallet(SECRET, WALLET);
  assert.equal(code, studioWallet(SECRET, WALLET.toUpperCase().replace('0X', '0x')));
  assert.ok(code.length >= 16 && code.length <= 64 && !code.toLowerCase().includes(WALLET.slice(2, 12)));
  assert.notEqual(code, burnWallet(BURN_KEY, WALLET));
  const tx = txOf(77);
  assert.equal(payCode(BURN_KEY, 'burn', tx, WALLET), txCode(BURN_KEY, tx, WALLET), 'one burn counts once: for messages or for a character');
  assert.notEqual(payCode(BURN_KEY, 'usdg', tx, WALLET), txCode(BURN_KEY, tx, WALLET), "a USDG payment's code is never a burn's");
  assert.notEqual(payCode(BURN_KEY, 'usdg', tx, WALLET), payCode(BURN_KEY, 'usdg', tx, OTHER));
  assert.equal(payCode(BURN_KEY, 'usdg', tx.toUpperCase().replace('0X', '0x'), WALLET), payCode(BURN_KEY, 'usdg', tx, WALLET));
});

test("the wallet a request came with: its session, its level read again when it's 30 minutes old (burned $AGI counts)", async () => {
  const cfg = cfgNow();
  assert.equal(await walletNow(cfg, 'not-a-session'), null);
  assert.equal(await walletNow(cfg, undefined), null);
  assert.deepEqual(await walletNow(cfg, sessionFor(WALLET, 2)), { wallet: WALLET, level: 2, session: null });
  const old = sessionFor(WALLET, 1, Date.now() - 31 * 60_000);
  let seen = null;
  const r = await walletNow(cfg, old, { check: async (w, fallback, env, burned) => { seen = { w, fallback, burned }; return { level: 3, checked: true }; }, burned: async () => 25_000 });
  assert.deepEqual(seen, { w: WALLET, fallback: 1, burned: 25_000 });
  assert.equal(r.level, 3); assert.equal(typeof r.session, 'string');
  assert.deepEqual(await walletNow(cfg, r.session), { wallet: WALLET, level: 3, session: null }, 'its new session holds its new level');
  fake.chain.balance = 2_000_000n * E18;
  const real = await walletNow(cfg, old);
  assert.equal(real.level, 3, "read on the chain (Robinhood Chain's node)");
  fake.chain.down = true;
  const kept = await walletNow(cfg, sessionFor(WALLET, 2, Date.now() - 31 * 60_000));
  assert.equal(kept.level, 2, 'the chain away: its last level');
});

test('what anyone with its link sees: never its wallet, payments or Meshy; hidden ones: nothing', async () => {
  const cfg = cfgNow();
  const q = await makeQuote(cfg, { wallet: WALLET, level: 2, ...GOOD });
  let o = await getOrder(cfg, q.id);
  let v = pageView(cfg, o);
  assert.deepEqual(Object.keys(v).sort(), ['about', 'created', 'free', 'id', 'kind', 'level', 'name', 'paid', 'price', 'status', 'style']);
  assert.deepEqual([v.status, v.price, v.paid, v.free, v.level], ['quote', { usdCents: 400, agi: 12_000 }, 0, false, 2]);
  const all = JSON.stringify(o);
  assert.ok(all.includes(studioWallet(SECRET, WALLET)), 'the database has its code…');
  assert.ok(!JSON.stringify(v).includes(studioWallet(SECRET, WALLET)) && !JSON.stringify(v).includes('burn_code'), '…the page never');
  Object.assign(fake.db.orders.get(q.id), { status: 'making', step: 'rig', task: 'rig-task-123', kind: 'usdg' });
  v = pageView(cfg, await getOrder(cfg, q.id));
  assert.deepEqual([v.status, v.step, v.task, v.price], ['making', 'rig', undefined, undefined]);
  Object.assign(fake.db.orders.get(q.id), { status: 'done', step: null, moves: ['idle', 'wave'], glb_bytes: 3_200_000, done_at: Date.now() });
  v = pageView(cfg, await getOrder(cfg, q.id));
  assert.deepEqual([v.status, v.moves, v.glbBytes, typeof v.done], ['done', ['idle', 'wave'], 3_200_000, 'number']);
  Object.assign(fake.db.orders.get(q.id), { status: 'failed', error: 'refused', credit: true });
  v = pageView(cfg, await getOrder(cfg, q.id));
  assert.deepEqual([v.status, v.error, v.credit], ['failed', 'refused', true]);
  fake.db.orders.get(q.id).hidden = true;
  assert.equal(pageView(cfg, await getOrder(cfg, q.id)), null);
  fake.db.orders.get(q.id).hidden = false;
  process.env.STUDIO_HIDE = q.id;
  assert.equal(pageView(cfgNow(), await getOrder(cfg, q.id)), null, 'the owner\'s STUDIO_HIDE too');
  // a quote never paid, after a day
  delete process.env.STUDIO_HIDE;
  const q2 = await makeQuote(cfg, { wallet: OTHER, level: 1, ...GOOD });
  fake.db.orders.get(q2.id).created = Date.now() - DAY - 1000;
  assert.equal(pageView(cfg, await getOrder(cfg, q2.id)).status, 'expired');
  assert.equal(await getOrder(cfg, '../nope'), null, 'a bad id asks nothing');
});

test('a quote: its words checked first, its price by level, a place held this month; a Soulmate\'s free one offered', async () => {
  const cfg = cfgNow();
  const q = await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD });
  assert.deepEqual({ ...q, id: 'x' }, { ok: true, id: 'x', price: { usdCents: 500, agi: 15_000 }, usdg: true, burn: true, free: false, left: 14 });
  const o = fake.db.orders.get(q.id);
  assert.deepEqual([o.wallet_code, o.burn_code, o.name, o.style, o.level, o.free], [studioWallet(SECRET, WALLET), burnWallet(BURN_KEY, WALLET), 'Mochi', 'anime', 1, false]);
  const soul = await makeQuote(cfg, { wallet: OTHER, level: 3, ...GOOD });
  assert.deepEqual([soul.price, soul.free], [{ usdCents: 300, agi: 9000 }, true]);
  assert.deepEqual(await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD, about: 'a sexy maid' }), { ok: false, field: 'about', why: 'adult' });
  assert.equal(fake.db.orders.size, 2, 'nothing kept for words that fail');
  // one wallet: 2 quotes at once
  assert.equal((await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD })).ok, true);
  assert.deepEqual(await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD }), { ok: false, why: 'too_many' });
  // the month's places
  process.env.STUDIO_A_MONTH = '4';
  const more = await makeQuote(cfgNow(), { wallet: '0x3333333333333333333333333333333333333333', level: 1, ...GOOD });
  assert.equal(more.left, 0);
  assert.deepEqual(await makeQuote(cfgNow(), { wallet: '0x4444444444444444444444444444444444444444', level: 1, ...GOOD }), { ok: false, why: 'sold_out' });
  // private: only the listed wallets
  delete process.env.STUDIO_OPEN; process.env.STUDIO_ONLY_FOR = OWNER;
  assert.deepEqual(await makeQuote(cfgNow(), { wallet: WALLET, level: 1, ...GOOD }), { ok: false, why: 'closed' });
  // burns off, or no USDG wallet
  Object.assign(process.env, { STUDIO_OPEN: 'yes', STUDIO_A_MONTH: '99', STUDIO_BURNS_A_MONTH: '0' }); delete process.env.STUDIO_PAY_TO;
  const q3 = await makeQuote(cfgNow(), { wallet: '0x5555555555555555555555555555555555555555', level: 1, ...GOOD });
  assert.deepEqual([q3.usdg, q3.burn], [false, false]);
  // the database away
  fake.dbDown = true;
  await assert.rejects(makeQuote(cfgNow(), { wallet: '0x6666666666666666666666666666666666666666', level: 1, ...GOOD }), /HTTP 503/);
});

test('how it\'s paid: USDG (when the owner\'s wallet is set), a burn (a place this month), or a Soulmate\'s free one (paid at once)', async () => {
  const cfg = cfgNow();
  const q = await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD });
  assert.deepEqual(await choosePay(cfg, { id: q.id, wallet: WALLET, kind: 'usdg' }), { ok: true, kind: 'usdg', paid: false });
  assert.deepEqual(await choosePay(cfg, { id: q.id, wallet: WALLET, kind: 'burn' }), { ok: true, kind: 'burn', paid: false });
  assert.deepEqual(await choosePay(cfg, { id: q.id, wallet: OTHER, kind: 'usdg' }), { ok: false, why: 'not_yours' });
  assert.deepEqual(await choosePay(cfg, { id: q.id, wallet: WALLET, kind: 'free' }), { ok: false, why: 'no_free' });
  const soul = await makeQuote(cfg, { wallet: OTHER, level: 3, ...GOOD });
  assert.deepEqual(await choosePay(cfg, { id: soul.id, wallet: OTHER, kind: 'free' }), { ok: true, kind: 'free', paid: true });
  assert.equal(fake.db.orders.get(soul.id).status, 'paid');
  const soul2 = await makeQuote(cfg, { wallet: OTHER, level: 3, ...GOOD });
  assert.equal(soul2.free, false, 'one free a month');
  assert.deepEqual(await choosePay(cfg, { id: soul2.id, wallet: OTHER, kind: 'free' }), { ok: false, why: 'free_used' });
  delete process.env.STUDIO_PAY_TO;
  assert.deepEqual(await choosePay(cfgNow(), { id: q.id, wallet: WALLET, kind: 'usdg' }), { ok: false, why: 'no_usdg' });
  process.env.STUDIO_BURNS_A_MONTH = '0';
  assert.deepEqual(await choosePay(cfgNow(), { id: q.id, wallet: WALLET, kind: 'burn' }), { ok: false, why: 'burns_sold_out' });
});

test('"Check my payment": a pasted USDG payment counts once, up to the price (payments add up); then it\'s paid', async () => {
  const cfg = cfgNow();
  const q = await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD });
  assert.deepEqual(await checkPayment(cfg, { id: q.id, wallet: WALLET, tx: txOf(1) }), { ok: false, why: 'no_kind' });
  await choosePay(cfg, { id: q.id, wallet: WALLET, kind: 'usdg' });
  usdgPay(txOf(1), 300);
  let r = await checkPayment(cfg, { id: q.id, wallet: WALLET, tx: txOf(1) });
  assert.deepEqual(r, { ok: true, paid: false, have: 300, need: 500, results: [{ ok: true, amount: 300 }], source: 'pasted' });
  const code = payCode(BURN_KEY, 'usdg', txOf(1), WALLET);
  assert.ok(fake.db.txs.has(code), 'its code kept (never the transaction)');
  assert.ok(![...fake.db.txs.keys()].some((k) => k.includes(txOf(1).slice(2, 12))));
  r = await checkPayment(cfg, { id: q.id, wallet: WALLET, tx: txOf(1) });
  assert.deepEqual(r.results, [{ ok: false, why: 'used' }], 'counted once');
  assert.equal(calls.filter((c) => c.to === 'chain' && c.method === 'eth_getTransactionReceipt').length, 1, 'a payment already counted is never read again');
  usdgPay(txOf(2), 250);
  r = await checkPayment(cfg, { id: q.id, wallet: WALLET, tx: txOf(2) });
  assert.deepEqual([r.paid, r.have, r.need], [true, 550, 500]);
  assert.equal(fake.db.orders.get(q.id).status, 'paid');
  assert.deepEqual(await checkPayment(cfg, { id: q.id, wallet: WALLET, tx: txOf(3) }), { ok: true, paid: true, have: 550, need: 550, results: [], source: 'done' });
  assert.deepEqual(await checkPayment(cfg, { id: q.id, wallet: OTHER, tx: txOf(3) }), { ok: false, why: 'not_yours' });
  assert.deepEqual(await checkPayment(cfg, { id: newOrderId(), wallet: WALLET, tx: txOf(3) }), { ok: false, why: 'gone' });
});

test('"Check my payment": without a link, the explorer says which to read; each read on the chain; reasons when nothing counts', async () => {
  const cfg = cfgNow();
  const q = await makeQuote(cfg, { wallet: WALLET, level: 2, ...GOOD });
  await choosePay(cfg, { id: q.id, wallet: WALLET, kind: 'burn' });
  fake.explorer.items = [explorerItem(txOf(5), { token: AGI_CONTRACT, to: DEAD }), explorerItem(txOf(6), { token: AGI_CONTRACT, to: DEAD, at: Date.now() - 40_000 })];
  agiBurn(txOf(5), 7000);
  agiBurn(txOf(6), 6000);
  let r = await checkPayment(cfg, { id: q.id, wallet: WALLET });
  assert.deepEqual([r.ok, r.paid, r.have, r.need, r.source], [true, true, 13_000, 12_000, 'explorer']);
  assert.deepEqual(r.results, [{ ok: true, amount: 7000 }, { ok: true, amount: 6000 }]);
  assert.ok(fake.db.burnTxs.has(txCode(BURN_KEY, txOf(5), WALLET)), "in burns.sql's ledger: never counted for messages too");
  assert.equal(fake.db.burnWallets.get(burnWallet(BURN_KEY, WALLET)).agi, 13_000, 'its $AGI counts toward the level');
  assert.equal(fake.db.month().burns, 1);
  // a burn already counted for messages
  const q2 = await makeQuote(cfg, { wallet: WALLET, level: 1, ...GOOD });
  await choosePay(cfg, { id: q2.id, wallet: WALLET, kind: 'burn' });
  fake.db.burnTxs.add(txCode(BURN_KEY, txOf(8), WALLET));
  agiBurn(txOf(8), 20_000);
  assert.deepEqual((await checkPayment(cfg, { id: q2.id, wallet: WALLET, tx: txOf(8) })).results, [{ ok: false, why: 'used' }]);
  // each reason, in words the page knows
  fake.explorer.items = [];
  assert.deepEqual(await checkPayment(cfg, { id: q2.id, wallet: WALLET }), { ok: true, paid: false, have: 0, need: 15_000, results: [], source: 'explorer' });
  assert.deepEqual((await checkPayment(cfg, { id: q2.id, wallet: WALLET, tx: txOf(9) })).results, [{ ok: false, why: 'pending' }]);
  agiBurn(txOf(10), 20_000, { to: OWNER });
  assert.deepEqual((await checkPayment(cfg, { id: q2.id, wallet: WALLET, tx: txOf(10) })).results, [{ ok: false, why: 'nothing' }]);
  onChain(txOf(11), [transferLog(AGI_CONTRACT, WALLET, DEAD, E18 / 2n)]);
  assert.deepEqual((await checkPayment(cfg, { id: q2.id, wallet: WALLET, tx: txOf(11) })).results, [{ ok: false, why: 'too_small' }]);
  // the chain or the explorer can't say: thrown with its why (the page says so; nothing counted)
  fake.chain.down = true;
  assert.equal((await checkPayment(cfg, { id: q2.id, wallet: WALLET, tx: txOf(12) }).catch((e) => e)).why, 'chain');
  fake.chain.down = false;
  fake.explorer.status = 503;
  assert.equal((await checkPayment(cfg, { id: q2.id, wallet: WALLET }).catch((e) => e)).why, 'explorer');
  fake.explorer.status = 200;
  // at most 3 read a check
  const q3 = await makeQuote(cfgNow(), { wallet: OTHER, level: 1, ...GOOD });
  await choosePay(cfg, { id: q3.id, wallet: OTHER, kind: 'usdg' });
  fake.explorer.items = [1, 2, 3, 4, 5].map((n) => explorerItem(txOf(100 + n), { from: OTHER }));
  calls = [];
  r = await checkPayment(cfg, { id: q3.id, wallet: OTHER });
  assert.equal(r.results.length, 3);
  assert.equal(calls.filter((c) => c.to === 'chain' && c.method === 'eth_getTransactionReceipt').length, 3);
});

test('a paid one that couldn\'t be made: again with new words (checked), free; its owner\'s and the gallery\'s lists', async () => {
  const cfg = cfgNow();
  const id = await paidOrder();
  Object.assign(fake.db.orders.get(id), { status: 'failed', error: 'refused', credit: true });
  assert.deepEqual(await redo(cfg, { id, wallet: WALLET, name: 'Mochi', about: 'pikachu as a knight', style: 'anime' }), { ok: false, field: 'about', why: 'character' });
  assert.deepEqual(await redo(cfg, { id, wallet: OTHER, name: 'Mochi', about: 'a calm silver-haired knight in light armor', style: 'cartoon' }), { ok: false, why: 'not_yours' });
  assert.deepEqual(await redo(cfg, { id, wallet: WALLET, name: 'Mochi 2', about: 'a calm silver-haired knight in light armor', style: 'cartoon' }), { ok: true });
  const o = fake.db.orders.get(id);
  assert.deepEqual([o.status, o.name, o.style, o.credit, o.started_at], ['paid', 'Mochi 2', 'cartoon', false, null]);
  assert.deepEqual(await redo(cfg, { id, wallet: WALLET, ...GOOD }), { ok: false, why: 'no_credit' });
  // lists
  Object.assign(o, { status: 'done', done_at: Date.now() });
  const other = await paidOrder({ wallet: OTHER });
  Object.assign(fake.db.orders.get(other), { status: 'done', done_at: Date.now() + 1 });
  assert.deepEqual((await gallery(cfg)).map((c) => c.id), [other, id]);
  process.env.STUDIO_HIDE = other;
  assert.deepEqual((await gallery(cfgNow())).map((c) => c.id), [id]);
  const mine = await myCharacters(cfgNow(), WALLET);
  assert.deepEqual(mine.map((c) => [c.id, c.status, c.credit]), [[id, 'done', false]]);
  assert.deepEqual(Object.keys(mine[0]).sort(), ['created', 'credit', 'id', 'name', 'status']);
  assert.deepEqual(await monthLeft(cfgNow()), { left: 13, burnsLeft: 10, videosLeft: 30 });   // (its videos': tests/videos.test.js)
});

// ---------- the making ----------
async function readyFiles() {
  fake.files.glb = await characterGlb();
  fake.files.png = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 230, g: 200, b: 255, alpha: 1 } } }).png().toBuffer();
}

test('the making: Meshy\'s steps one at a time (words → painted → bones → moves), then its files kept: done', async () => {
  await readyFiles();
  const cfg = cfgNow();
  const id = await paidOrder();
  let r = await tick(cfg, id);
  assert.deepEqual(r, { state: 'started', step: 'preview' });
  let o = fake.db.orders.get(id);
  assert.deepEqual([o.status, o.step, o.task, o.tries], ['making', 'preview', taskOf('preview').id, 0]);
  assert.ok(o.started_at, 'its making started');
  assert.equal(taskOf('preview').body.prompt, meshyPrompt(GOOD));
  assert.equal(taskOf('preview').body.moderation, true);
  // while Meshy works on it: one look at a time, a short rest in between
  Object.assign(taskOf('preview'), { status: 'IN_PROGRESS', progress: 42 });
  r = await tick(cfg, id);
  assert.deepEqual(r, { state: 'waiting', step: 'preview', progress: 42 });
  assert.deepEqual(await tick(cfg, id), { state: 'busy' }, 'its turn rests a few seconds');
  // each step after the last, with what it needs
  finish('preview'); again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'refine' });
  assert.deepEqual([taskOf('refine').body.preview_task_id, taskOf('refine').body.texture_prompt], [taskOf('preview').id, meshyTexture(GOOD)]);
  finish('refine'); again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'rig' });
  assert.equal(taskOf('rig').body.input_task_id, taskOf('refine').id);
  finish('rig'); again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'moves' });
  assert.deepEqual(taskOf('moves').body, { rig_task_id: taskOf('rig').id, action_ids: R.MOVES.map((m) => m.action) });
  assert.deepEqual(fake.db.orders.get(id).tasks, { preview: taskOf('preview').id, refine: taskOf('refine').id, rig: taskOf('rig').id });
  finish('moves'); again(id);
  r = await tick(cfg, id, { deadline: Date.now() + 20_000 });
  assert.deepEqual(r, { state: 'done' });
  o = fake.db.orders.get(id);
  assert.deepEqual([o.status, o.moves, o.step, o.task], ['done', R.MOVE_NAMES, null, null]);
  // its files: in the private bucket, made small
  assert.deepEqual([...fake.storage.keys()].sort(), [`${id}.glb`, `${id}.png`, `${id}.webp`]);
  const glb = fake.storage.get(`${id}.glb`);
  assert.equal(glb.type, 'model/gltf-binary'); assert.ok(F.isGlb(glb.bytes)); assert.equal(o.glb_bytes, glb.bytes.length);
  assert.ok(glb.bytes.length < fake.files.glb.length / 4 && glb.bytes.length <= F.GLB_MAX);
  assert.equal((await sharp(fake.storage.get(`${id}.webp`).bytes).metadata()).width, 384);
  assert.equal((await sharp(fake.storage.get(`${id}.png`).bytes).metadata()).width, 1024);
  assert.equal(o.pic_bytes, fake.storage.get(`${id}.webp`).bytes.length);
  // the files came from Meshy's addresses for its moves and its refine (read again: they expire), never anywhere else
  const files = calls.filter((c) => c.to === 'files').map((c) => c.url);
  assert.deepEqual(files.sort(), [`https://assets.meshy.ai/tasks/${taskOf('moves').id}/animations.glb?Expires=1`,
    `https://assets.meshy.ai/tasks/${taskOf('refine').id}/preview.png?Expires=1`].sort());
  assert.match(log(), new RegExp(`${id} is done: .* MB, 4 triangles, 8 moves`));
  assert.deepEqual(await tick(cfg, id), { state: 'busy' }, 'done: never moved along again');
  // the credits it took at Meshy: 4 tasks, 59 credits
  assert.equal(fake.meshy.tasks.size, 4);
});

test("the making: Meshy's screening stopping it, a step failing (tried again, then given up), a rig that can't find its pose: new words, free", async () => {
  await readyFiles();
  const cfg = cfgNow();
  // refused at the start (Meshy's moderation)
  let id = await paidOrder();
  fake.meshy.fail.push({ status: 400, text: '{"message":"The prompt was flagged by our moderation system as inappropriate"}' });
  assert.deepEqual(await tick(cfg, id), { state: 'failed', step: 'preview' });
  assert.deepEqual([fake.db.orders.get(id).status, fake.db.orders.get(id).error, fake.db.orders.get(id).credit], ['failed', 'refused', true]);
  // refused by its task
  id = await paidOrder({ wallet: OTHER });
  await tick(cfg, id);
  finish('preview', 'FAILED', 'Prompt rejected: violates our content policy'); again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'failed', step: 'preview' });
  assert.equal(fake.db.orders.get(id).error, 'refused');
  // a step that fails at Meshy: tried again twice, then given up (credit: new words, free)
  id = await paidOrder({ wallet: '0x3333333333333333333333333333333333333333' });
  await makeUpTo(id, 'refine');
  for (const tries of [1, 2]) {
    finish('refine', 'FAILED', 'Internal error'); again(id);
    assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'refine' });
    assert.equal(fake.db.orders.get(id).tries, tries);
  }
  finish('refine', 'FAILED', 'Internal error'); again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'failed', step: 'refine' });
  assert.deepEqual([fake.db.orders.get(id).error, fake.db.orders.get(id).credit], ['ai:refine', true]);
  assert.match(log(), /refine failed at Meshy 3 times/);
  // a failed one tried again with new words starts over, at its first step
  await redo(cfg, { id, wallet: '0x3333333333333333333333333333333333333333', name: 'Kai', about: 'a calm silver-haired knight in light armor', style: 'realistic' });
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'preview' });
  assert.match(taskOf('preview').body.prompt, /a realistic 3D character.*silver-haired knight/);
});

test("the making: Meshy's key, credits or a busy queue: it waits (never failed), the owner told once; after 3 days it can't be finished", async () => {
  await readyFiles();
  const cfg = cfgNow();
  const id = await paidOrder();
  fake.meshy.fail.push({ status: 402, text: '{"message":"Insufficient credits to perform this task."}' });
  assert.deepEqual(await tick(cfg, id), { state: 'waiting', step: 'preview' });
  assert.equal(fake.db.orders.get(id).status, 'paid', 'nothing was made: still paid');
  fake.meshy.fail.push({ status: 402, text: 'no' });
  again(id);
  await tick(cfg, id);
  assert.equal(logs.filter((l) => /a character waits: meshy HTTP 402/.test(l)).length, 1, 'said once');
  fake.meshy.fail.push({ status: 429, text: '{"message":"NoMoreConcurrentTasks"}' });
  again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'waiting', step: 'preview' });
  again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'preview' });
  // Meshy can't be asked: it waits
  fake.meshy.getFail = { status: 503, text: 'down' };
  again(id);
  assert.deepEqual(await tick(cfg, id), { state: 'waiting', step: 'preview' });
  fake.meshy.getFail = null;
  // the rig can't find its humanoid pose (Meshy's 422): new words, free
  finish('preview'); again(id); await tick(cfg, id);
  finish('refine'); again(id);
  fake.meshy.fail.push({ status: 422, text: '{"message":"Pose estimation failed. The provided model may not be a valid humanoid character."}' });
  assert.deepEqual(await tick(cfg, id), { state: 'failed', step: 'rig' });
  assert.deepEqual([fake.db.orders.get(id).error, fake.db.orders.get(id).credit], ['pose', true]);
  // 3 days after its making started: Meshy has let go of what it made
  const late = await paidOrder({ wallet: OTHER });
  await tick(cfg, late);
  fake.db.orders.get(late).started_at = Date.now() - 3 * DAY - 1000;
  again(late);
  assert.deepEqual(await tick(cfg, late), { state: 'failed', step: 'preview' });
  assert.deepEqual([fake.db.orders.get(late).error, fake.db.orders.get(late).credit], ['expired', true]);
  // …counted from its making's start, not its payment: one tried again long after it was paid goes on
  const redone = await paidOrder({ wallet: '0x5555555555555555555555555555555555555555' });
  fake.db.orders.get(redone).paid_at = Date.now() - 20 * DAY;
  await tick(cfg, redone);
  Object.assign(taskOf('preview'), { status: 'IN_PROGRESS', progress: 10 }); again(redone);
  assert.deepEqual(await tick(cfg, redone), { state: 'waiting', step: 'preview', progress: 10 });
});

test('keeping its files: a hiccup is tried again (4 tries), a file Meshy let go of or too big to serve fails it (free); never past its time', async () => {
  await readyFiles();
  const cfg = cfgNow();
  const at = async (wallet) => { const id = await paidOrder({ wallet }); await makeUpTo(id, 'moves'); finish('moves'); again(id); return id; };
  // Storage away: tried again, then given up after 4 tries
  let id = await at(WALLET);
  fake.storageDown = true;
  for (const tries of [1, 2, 3]) {
    assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000 }), { state: 'saving' });
    assert.deepEqual([fake.db.orders.get(id).step, fake.db.orders.get(id).tries], ['save', tries]);
    again(id);
  }
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000 }), { state: 'failed', step: 'save' });
  assert.deepEqual([fake.db.orders.get(id).error, fake.db.orders.get(id).credit], ['save', true]);
  fake.storageDown = false;
  // Meshy let go of its files (403/404/410): failed at once
  id = await at(OTHER);
  fake.files.status = 404;
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000 }), { state: 'failed', step: 'save' });
  fake.files.status = 200;
  // too big even made small (Vercel answers 4.5 MB at most)
  id = await at('0x3333333333333333333333333333333333333333');
  const tooBig = { ...F, smallGlb: (src) => F.smallGlb(src, { max: 10_000 }) };
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000, files: tooBig }), { state: 'failed', step: 'save' });
  assert.equal(fake.db.orders.get(id).error, 'too_big');
  // too little time left once its moves are done: it waits for its next turn (a save cut off by Vercel would never count)
  id = await at('0x4444444444444444444444444444444444444444');
  calls = [];
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 9000 }), { state: 'saving' });
  assert.deepEqual([fake.db.orders.get(id).step, fake.db.orders.get(id).tries], ['save', 0]);
  again(id);
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 9000 }), { state: 'saving' });
  assert.equal(calls.filter((c) => c.to === 'files').length, 0, 'nothing read from Meshy without the time to keep it');
  // Meshy itself away for a moment while its files are looked up: not a try
  fake.meshy.getFail = { status: 502, text: 'bad gateway' };
  again(id);
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000 }), { state: 'saving' });
  assert.deepEqual([fake.db.orders.get(id).step, fake.db.orders.get(id).tries], ['save', 0]);
  fake.meshy.getFail = null;
  again(id);
  assert.deepEqual(await tick(cfg, id, { deadline: Date.now() + 20_000 }), { state: 'done' });
  // the moves its file has, in order (a file with fewer moves keeps those)
  const few = await at('0x5555555555555555555555555555555555555555');
  fake.files.glb = await characterGlb({ clips: CLIP_NAMES.slice(0, 5) });
  assert.deepEqual(await tick(cfg, few, { deadline: Date.now() + 20_000 }), { state: 'done' });
  assert.deepEqual(fake.db.orders.get(few).moves, R.MOVE_NAMES.slice(0, 5));
  assert.match(log(), /has 5 moves \(8 asked for\)/);
});

test('the clock (every minute): the characters whose turn it is, until its time is used; the tidy-up every half hour', async () => {
  await readyFiles();
  const cfg = cfgNow();
  const ids = [];
  for (const w of [WALLET, OTHER, '0x3333333333333333333333333333333333333333']) ids.push(await paidOrder({ wallet: w }));
  const at30 = new Date('2026-10-10T12:30:00Z').getTime();
  let out = await studioClock(cfg, { now: at30, deadline: Date.now() + 19_000 });
  assert.deepEqual(out, { due: 3, moved: 3, done: 0, failed: 0, tidy: { quotes: 0, failed: 0 } });
  for (const id of ids) assert.equal(fake.db.orders.get(id).step, 'preview');
  out = await studioClock(cfg, { now: at30 + 60_000, deadline: Date.now() + 19_000 });
  assert.deepEqual(out, { due: 3, moved: 0, done: 0, failed: 0 }, 'still at Meshy: looked at, no tidy-up at :31');
  for (const id of ids) again(id);
  out = await studioClock(cfg, { deadline: Date.now() + 4000 });
  assert.equal(out.moved + out.done + out.failed, 0, 'no time left: nothing started');
  fake.dbDown = true;
  await assert.rejects(studioClock(cfg, { deadline: Date.now() + 19_000 }), /HTTP 503/);
  fake.dbDown = false;
  // its key, made by studio.sql, read once per server copy
  assert.equal(await studioKey(cfg), STUDIO_KEY);
  await studioKey(cfg);
  assert.equal(fake.db.calls.filter((c) => c === 'studio_key').length, 1);
  _resetStudioKey();
  fake.missing.add('studio_key');
  assert.equal((await studioKey(cfg).catch((e) => e)).code, 'PGRST202');
});

// ---------- its web side: api/launch.js ----------
test('GET ?studio-info: what the page needs (prices, discounts, where USDG goes, the burn address, places left), shared a moment', async () => {
  const r = await get('studio-info');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=15, s-maxage=30');
  assert.deepEqual(r.body, { on: true, open: true, price: { usdCents: 500, agi: 15_000 }, discounts: { 1: 0, 2: 0.2, 3: 0.4 }, usdg: true, payTo: OWNER,
    token: USDG, burnAddress: BURN_ADDRESS, left: 15, burnsLeft: 10, moves: R.MOVE_NAMES,
    video: { on: false, usdCents: 400, seconds: 5, left: 30 } });   // its videos: off without fal.ai's key (tests/videos.test.js)
  delete process.env.MESHY_API_KEY;
  assert.equal((await get('studio-info')).body.on, false, "off without Meshy's key");
  process.env.MESHY_API_KEY = MESHY_KEY;
  fake.missing.add('studio_month');
  assert.equal((await get('studio-info')).body.on, false, 'off until studio.sql is run');
  assert.doesNotMatch(log(), /this month's places/, 'nothing to log for a file not run yet');
  delete process.env.SUPABASE_URL;
  assert.deepEqual((await get('studio-info')).body, { error: 'not_ready' });
  assert.equal((await get('studio-info&d=x')).status, 400, 'exactly one question');
});

test('GET ?studio=<id>: a character for its page (moved along a step while it\'s being made); ?studio-list: the gallery', async () => {
  await readyFiles();
  const id = await paidOrder();
  let r = await get(`studio=${id}`);
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual([r.body.character.status, r.body.character.step], ['making', 'preview'], 'a step started by its page');
  Object.assign(taskOf('preview'), { status: 'IN_PROGRESS', progress: 63 }); again(id);
  r = await get(`studio=${id}`);
  assert.deepEqual([r.body.character.step, r.body.character.progress], ['preview', 63]);
  assert.equal((await get('studio=not-an-id')).status, 400);
  assert.deepEqual(await get(`studio=${newOrderId()}`).then((x) => [x.status, x.body]), [404, { error: 'gone' }]);
  Object.assign(fake.db.orders.get(id), { status: 'done', moves: R.MOVE_NAMES, done_at: Date.now(), glb_bytes: 10 });
  const list = await get('studio-list');
  assert.equal(list.headers.get('cache-control'), 'public, max-age=30, s-maxage=60');
  assert.deepEqual(list.body.characters.map((c) => c.id), [id]);
  fake.db.orders.get(id).hidden = true;
  assert.equal((await get(`studio=${id}`)).status, 404, 'hidden: gone');
  assert.deepEqual((await get('studio-list')).body.characters, []);
  fake.dbDown = true;
  assert.deepEqual(await get(`studio=${id}`).then((x) => [x.status, x.body]), [503, { error: 'busy' }]);
  fake.dbDown = false; fake.missing.add('studio_get');
  assert.deepEqual(await get(`studio=${id}`).then((x) => [x.status, x.body]), [503, { error: 'not_ready' }]);
  // a speed bump
  fake.missing.clear();
  for (let i = 0; i < 40; i++) studioLookBurst(undefined);
  studioLookBurst.reset();
  for (let i = 0; i < 40; i++) await get(`studio=${id}`);
  assert.equal((await get(`studio=${id}`)).status, 429);
});

test('GET ?studio-file=<id>.glb|webp|png: a done character\'s files from the private bucket, kept a day by the CDN, in a sandbox', async () => {
  const id = await paidOrder();
  fake.storage.set(`${id}.glb`, { bytes: Buffer.from('glTF model'), type: 'model/gltf-binary' });
  fake.storage.set(`${id}.webp`, { bytes: Buffer.from('webp picture'), type: 'image/webp' });
  assert.deepEqual(await get(`studio-file=${id}.glb`).then((r) => [r.status, r.body]), [404, { error: 'gone' }], 'not done yet');
  Object.assign(fake.db.orders.get(id), { status: 'done', moves: R.MOVE_NAMES, done_at: Date.now() });
  const r = await get(`studio-file=${id}.glb`);
  assert.equal(r.status, 200); assert.deepEqual(r.body, Buffer.from('glTF model'));
  assert.deepEqual([r.headers.get('content-type'), r.headers.get('cache-control'), r.headers.get('x-content-type-options'), r.headers.get('content-security-policy')],
    ['model/gltf-binary', 'public, max-age=86400, s-maxage=86400', 'nosniff', "default-src 'none'; sandbox"]);
  assert.equal((await get(`studio-file=${id}.webp`)).headers.get('content-type'), 'image/webp');
  assert.deepEqual(await get(`studio-file=${id}.png`).then((x) => [x.status, x.body]), [404, { error: 'gone' }], 'not in the bucket');
  for (const bad of [`${id}.html`, `${id}.glb/x`, '../secrets.glb', `${id}`]) assert.equal((await get(`studio-file=${encodeURIComponent(bad)}`)).status, 400, bad);
  fake.db.orders.get(id).hidden = true;
  assert.equal((await get(`studio-file=${id}.glb`)).status, 404, 'hidden by the owner');
  fake.db.orders.get(id).hidden = false;
  fake.storageDown = true;
  assert.deepEqual(await get(`studio-file=${id}.glb`).then((x) => [x.status, x.body]), [502, { error: 'storage' }]);
});

test('POST studio-quote: a signed-in wallet, 18+, a human (Turnstile "studio", then a 2-hour pass), words checked; never the closed studio', async () => {
  const session = sessionFor(WALLET, 2);
  let r = await post({ action: 'studio-quote', session, ...GOOD, adult: true, turnstileToken: 'cf-token' });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['burn', 'free', 'id', 'left', 'level', 'ok', 'pass', 'price', 'usdg']);
  assert.deepEqual([r.body.price, r.body.level, r.body.free], [{ usdCents: 400, agi: 12_000 }, 2, false]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const t = calls.find((c) => c.to === 'turnstile');
  assert.deepEqual([t.body.secret, t.body.response, t.body.remoteip], [ENV.TURNSTILE_SECRET_KEY, 'cf-token', IP]);
  const pass = r.body.pass;
  calls = [];
  r = await post({ action: 'studio-quote', session, ...GOOD, adult: true, pass });
  assert.equal(r.status, 200); assert.equal(r.body.pass, null, 'the pass did');
  assert.equal(calls.filter((c) => c.to === 'turnstile').length, 0);
  assert.deepEqual((await post({ action: 'studio-quote', session, ...GOOD, adult: true, pass })).body.error, 'too_many', 'two quotes at once per wallet');
  // in this order: a wallet, then 18+, then a human, then the words
  assert.deepEqual(await post({ action: 'studio-quote', ...GOOD, adult: true, pass }).then((x) => [x.status, x.body]), [401, { error: 'signed_out', signedOut: true }]);
  const s2 = sessionFor(OTHER, 1);
  assert.deepEqual((await post({ action: 'studio-quote', session: s2, ...GOOD, pass })).body, { error: 'adult', level: 1 });
  fake.human = false;
  assert.deepEqual(await post({ action: 'studio-quote', session: s2, ...GOOD, adult: true, turnstileToken: 'bad' }).then((x) => [x.status, x.body.error]), [401, 'human_check']);
  fake.human = true;
  r = await post({ action: 'studio-quote', session: s2, ...GOOD, about: 'taylor swift in a sparkly dress', adult: true, pass });
  assert.deepEqual([r.status, r.body.error, r.body.field, r.body.why], [422, 'words', 'about', 'person']);
  // closed: only the listed wallets
  delete process.env.STUDIO_OPEN;
  assert.deepEqual(await post({ action: 'studio-quote', session: s2, ...GOOD, adult: true, pass }).then((x) => [x.status, x.body.error]), [403, 'closed']);
  process.env.STUDIO_ONLY_FOR = OTHER;
  assert.equal((await post({ action: 'studio-quote', session: s2, ...GOOD, adult: true, pass })).status, 200, "the owner's own wallet, while it's private");
  // off: no Meshy key, or the site not set up
  delete process.env.MESHY_API_KEY;
  assert.deepEqual(await post({ action: 'studio-quote', session: s2, ...GOOD, adult: true, pass }).then((x) => [x.status, x.body]), [503, { error: 'not_ready' }]);
  assert.match(log(), /MESHY_API_KEY is missing: the studio is off/);
});

test('POST studio-choose, studio-check, studio-redo, studio-mine: the wallet\'s own, its level read again when due, a speed bump', async () => {
  const session = sessionFor(WALLET, 1);
  const q = await apiQuote({}, { session });
  assert.equal(q.status, 200);
  const id = q.body.id;
  assert.deepEqual((await post({ action: 'studio-choose', session, id, kind: 'usdg' })).body, { ok: true, kind: 'usdg', paid: false, level: 1 });
  assert.deepEqual(await post({ action: 'studio-choose', session, id, kind: 'cash' }).then((x) => [x.status, x.body.error]), [400, 'bad_request']);
  assert.deepEqual(await post({ action: 'studio-choose', session: sessionFor(OTHER), id, kind: 'usdg' }).then((x) => [x.status, x.body.error]), [403, 'not_yours']);
  assert.deepEqual(await post({ action: 'studio-choose', session, id: 'nope', kind: 'usdg' }).then((x) => [x.status, x.body.error]), [400, 'bad_request']);
  // paying: a pasted link
  usdgPay(txOf(41), 500);
  let r = await post({ action: 'studio-check', session, id, tx: `https://robinhoodchain.blockscout.com/tx/${txOf(41)}` });
  assert.deepEqual([r.status, r.body.paid, r.body.have, r.body.need, r.body.source], [200, true, 500, 500, 'pasted']);
  assert.deepEqual(await post({ action: 'studio-check', session, id, tx: 'not a transaction' }).then((x) => [x.status, x.body.error]), [400, 'bad_tx']);
  fake.chain.down = true;
  const q2 = await apiQuote({}, { session: sessionFor(OTHER) });
  await post({ action: 'studio-choose', session: sessionFor(OTHER), id: q2.body.id, kind: 'burn' });
  assert.deepEqual(await post({ action: 'studio-check', session: sessionFor(OTHER), id: q2.body.id, tx: txOf(42) }).then((x) => [x.status, x.body.error]), [503, 'chain']);
  fake.chain.down = false;
  // its owner's characters
  r = await post({ action: 'studio-mine', session });
  assert.deepEqual(r.body.characters.map((c) => [c.id, c.status]), [[id, 'paid']]);
  assert.equal(r.body.allowed, true);
  delete process.env.STUDIO_OPEN;
  assert.equal((await post({ action: 'studio-mine', session })).body.allowed, false, 'private, and not on the list: the page says so before the form');
  process.env.STUDIO_ONLY_FOR = WALLET;
  assert.equal((await post({ action: 'studio-mine', session })).body.allowed, true);
  process.env.STUDIO_OPEN = 'yes';
  // redo: only a failed one with credit
  assert.deepEqual(await post({ action: 'studio-redo', session, id, ...GOOD }).then((x) => [x.status, x.body.error]), [409, 'no_credit']);
  Object.assign(fake.db.orders.get(id), { status: 'failed', error: 'refused', credit: true });
  assert.deepEqual((await post({ action: 'studio-redo', session, id, ...GOOD, about: 'a sexy maid' })).body, { error: 'words', field: 'about', why: 'adult', level: 1 });
  assert.deepEqual((await post({ action: 'studio-redo', session, id, ...GOOD })).body, { ok: true, level: 1 });
  // a session whose level is due to be read again comes back new
  const old = sessionFor(WALLET, 1, Date.now() - 31 * 60_000);
  fake.chain.balance = 50_000n * E18;
  r = await post({ action: 'studio-mine', session: old });
  assert.equal(r.body.level, 2); assert.equal(typeof r.body.session, 'string');
  // a speed bump for a quote and "Check my payment" (they ask Cloudflare, or read the chain): 12 a minute
  studioActBurst.reset();
  for (let i = 0; i < 12; i++) await post({ action: 'studio-check', session, id });
  assert.deepEqual(await post({ action: 'studio-check', session, id }).then((x) => [x.status, x.body.error]), [429, 'too_fast']);
  assert.deepEqual(await post({ action: 'studio-quote', session, ...GOOD, adult: true, turnstileToken: 'x' }).then((x) => [x.status, x.body.error]), [429, 'too_fast']);
  assert.equal((await post({ action: 'studio-mine', session })).status, 200, 'its own list: no speed bump of its own');
  // the database away
  studioActBurst.reset();
  fake.dbDown = true;
  assert.deepEqual(await post({ action: 'studio-mine', session }).then((x) => [x.status, x.body.error]), [503, 'busy']);
});

test('api/launch.js: the studio\'s questions and actions go to the studio, everything else as before', async () => {
  const src = readFileSync(new URL('../api/launch.js', import.meta.url), 'utf8');
  // (and since 2026-10-10 its characters' videos: tests/videos.test.js)
  assert.match(src, /const STUDIO_GETS = \['studio', 'studio-file', 'studio-list', 'studio-info', 'studio-videos', 'studio-video', 'studio-video-dl'\];/);
  assert.match(src, /const STUDIO_POSTS = \['studio-quote', 'studio-choose', 'studio-check', 'studio-redo', 'studio-mine', 'studio-video-mine', 'studio-video-quote',\s+'studio-video-check', 'studio-video-redo', 'studio-video-look'\];/);
  assert.match(src, /await import\('\.\.\/server\/studio-api\.js'\)/, 'loaded only for them');
  assert.doesNotMatch(src, /^import .*studio/m);
  // (2026-10-10) new orders moved to AGI Studio (credits): a character from words, or a video paid on its own, isn't ordered here
  assert.match(src, /const STUDIO_MOVED = \['studio-quote', 'studio-video-quote'\];/);
  for (const action of ['studio-quote', 'studio-video-quote']) {
    assert.deepEqual(await routerPost({ action, session: sessionFor(), ...GOOD, adult: true, turnstileToken: 'ts-token' }).then((x) => [x.status, x.body]),
      [410, { error: 'moved' }], action);
  }
  assert.equal(calls.filter((c) => c.to === 'turnstile' || c.to === 'meshy').length, 0, 'nothing asked of anyone for it');
  assert.deepEqual(await get('d=nope').then((x) => [x.status, x.body]), [400, { error: 'bad_request' }], "the launch page's own questions as before");
  assert.deepEqual(await post({ action: 'prepare', draft: 'nope' }).then((x) => [x.status, x.body]), [400, { error: 'bad_request' }]);
  assert.equal((await post({ action: 'studio-nope', session: sessionFor() })).status, 400);
});

test('GET /api/feed?studio: only with studio.sql\'s key (from the database); off without Meshy\'s key; runs the clock', async () => {
  const call = (auth) => feedGet(new Request('https://www.agi1.app/api/feed?studio', { headers: auth ? { authorization: auth } : {} }));
  let res = await call();
  assert.equal(res.status, 401);
  res = await call('Bearer wrong-key');
  assert.equal(res.status, 401);
  res = await call(`Bearer ${STUDIO_KEY}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, due: 0, moved: 0, done: 0, failed: 0, ...(new Date().getUTCMinutes() % 30 === 0 ? { tidy: { quotes: 0, failed: 0 } } : {}) });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  delete process.env.MESHY_API_KEY;
  assert.deepEqual(await (await call(`Bearer ${STUDIO_KEY}`)).json(), { ok: true, off: 'no_key' });
  process.env.MESHY_API_KEY = MESHY_KEY;
  _resetStudioKey(); fake.missing.add('studio_key');
  res = await call(`Bearer ${STUDIO_KEY}`);
  assert.deepEqual([res.status, await res.json()], [503, { error: 'not_set_up' }]);
  fake.missing.clear(); fake.missing.add('studio_due');
  res = await call(`Bearer ${STUDIO_KEY}`);
  assert.deepEqual([res.status, await res.json()], [502, { error: 'not_set_up' }]);
  delete process.env.SUPABASE_URL;
  assert.equal((await call(`Bearer ${STUDIO_KEY}`)).status, 503);
  const src = readFileSync(new URL('../api/feed.js', import.meta.url), 'utf8');
  assert.match(src, /if \(search === '\?studio'\) return studioCheck\(request\);/);
  assert.match(src, /await import\('\.\.\/server\/studio\.js'\)/, 'loaded only for it');
});

// ---------- the rest of what it promises ----------
test('still 12 functions (Vercel); the Meshy key in the secret check; gltf-transform declared; studio.sql\'s promises', () => {
  const fns = readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js'));
  assert.equal(fns.length, 12, fns.join(', '));
  const check = readFileSync(new URL('../scripts/check-secrets.js', import.meta.url), 'utf8');
  assert.match(check, /'MESHY_API_KEY'/); assert.match(check, /Meshy API key/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const d of ['@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', 'sharp']) assert.ok(pkg.dependencies[d], d);
  assert.match(pkg.scripts.test, /tests\/studio\.test\.js/);
  const sql = readFileSync(new URL('../supabase/studio.sql', import.meta.url), 'utf8');
  for (const fn of ['studio_key', 'studio_this_month', 'studio_quote', 'studio_choose', 'studio_pay', 'studio_seen', 'studio_get', 'studio_lease', 'studio_step',
    'studio_wait', 'studio_done', 'studio_fail', 'studio_redo', 'studio_due', 'studio_month', 'studio_free_used', 'studio_list', 'studio_mine', 'studio_hide', 'studio_tidy']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(`), `${fn}: never the browser's keys`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(.*\\) to service_role;`), fn);
  }
  assert.match(sql, /\/ 32\s/, 'studio_ready counts its 32 functions (20 for characters, 12 for their videos: tests/videos.test.js)');
  for (const t of ['agi1_studio_state', 'agi1_studio_orders', 'agi1_studio_months', 'agi1_studio_free', 'agi1_studio_txs']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`), t);
  }
  assert.match(sql, /insert into agi1_burn_txs \(tx_code\) values \(p_tx\)/, "a burn for a character goes in burns.sql's ledger");
  assert.match(sql, /'agi1-characters', 'agi1-characters', false, 41943040,\s+array\['model\/gltf-binary', 'image\/webp', 'image\/png', 'image\/jpeg', 'video\/mp4', 'application\/octet-stream'\]/,
    'a private bucket, 40 MB a file (a video), only its 3D model, its pictures and its videos (and since AGI Studio, 2026-10-10, JPEG pictures and the parts of a clip being uploaded)');
  assert.match(sql, /url := 'https:\/\/www\.agi1\.app\/api\/feed\?studio'/, 'www: agi1.app redirects, and a redirect would drop the key');
  assert.doesNotMatch(sql, /drop table|truncate/i);
  const code = sql.replace(/--.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:wallet|address|wallet_address|tx|tx_hash|transaction|ip|ip_address)\s+(?:text|inet|varchar|bytea)\b/i, 'never an address, a transaction or an IP address');
  assert.match(code, /wallet_code text/); assert.match(code, /tx_code\s+text/);
});

// ---------- its page: the 3D view (src/studio/viewer.js: the pure parts, with three.js in Node) ----------
// a stand-in rig: an armature (Blender's Y-up, or an FBX's Z-up one turned -90° about X and scaled to centimetres), its
// hips and head, and a skinned body (a 1.7 m column on its hips)
function rig({ zUp = false } = {}) {
  const scene = new THREE.Group();
  const armature = new THREE.Group();
  armature.name = 'Armature';
  const u = zUp ? 100 : 1;                                // the armature's units per metre
  if (zUp) { armature.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); armature.scale.setScalar(0.01); }
  const hips = new THREE.Bone(); hips.name = 'Hips';
  const head = new THREE.Bone(); head.name = 'Head';
  hips.position.copy(zUp ? new THREE.Vector3(0, 0, 0.95 * u) : new THREE.Vector3(0, 0.95, 0));
  head.position.copy(zUp ? new THREE.Vector3(0, 0, 0.6 * u) : new THREE.Vector3(0, 0.6, 0));
  hips.add(head); armature.add(hips); scene.add(armature);
  const geo = new THREE.BoxGeometry(0.4, 1.7, 0.25).translate(0, 0.85, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const body = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  body.name = 'Body';
  scene.add(body);
  scene.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton([hips, head]));
  return { scene, hips, head, body, u, zUp };
}
// a hips track in the rig's own terms, from world metres (x right, y up, z toward the camera)
const local = (r, [x, y, z]) => (r.zUp ? [x * r.u, -z * r.u, y * r.u] : [x, y, z]);
const hipsTrack = (r, times, world) => new THREE.VectorKeyframeTrack('Hips.position', times, world.flatMap((p) => local(r, p)));

test("its 3D view: its clips by move (the library's names, else the order asked for)", () => {
  const clip = (name) => new THREE.AnimationClip(name, 1, []);
  const lib = R.MOVES.map((m) => clip(m.clip));
  // Meshy's names, in any order (Blender's "Armature|…" too)
  const shuffled = [lib[3], lib[0], lib[7], lib[1], lib[2], lib[6], lib[5], lib[4]];
  let m = clipsFor(shuffled, R.MOVE_NAMES);
  assert.deepEqual([...m.keys()].sort(), [...R.MOVE_NAMES].sort());
  for (const mv of R.MOVES) assert.equal(m.get(mv.name).name, mv.clip, mv.name);
  m = clipsFor([clip('Armature|Idle'), clip('armature|big_wave_hello')], R.MOVE_NAMES);
  assert.equal(m.get('idle').name, 'Armature|Idle'); assert.equal(m.get('wave').name, 'armature|big_wave_hello');
  // other names (or the same twice): in the order they were asked for
  m = clipsFor([clip('Take 001'), clip('Take 002'), clip('Take 003')], R.MOVE_NAMES);
  assert.deepEqual([...m].map(([k, c]) => `${k}=${c.name}`), ['idle=Take 001', 'wave=Take 002', 'dance=Take 003']);
  m = clipsFor([clip('Idle'), clip('Idle')], ['idle', 'wave']);
  assert.deepEqual([...m].map(([k, c]) => `${k}=${c.name}`), ['idle=Idle', 'wave=Idle']);
  m = clipsFor([lib[0], lib[1], clip('Mystery')], R.MOVE_NAMES);
  assert.deepEqual([...m.keys()], ['idle', 'wave', 'dance'], 'one unknown name: all in order');
  // only the moves it has
  m = clipsFor(lib, ['idle', 'jump']);
  assert.deepEqual([...m.keys()].sort(), ['idle', 'jump']);
  assert.equal(clipsFor([], R.MOVE_NAMES).size, 0);
  // the library's names are Meshy's (its animation library: one per action id)
  assert.deepEqual(R.MOVES.map((x) => `${x.action}:${x.clip}`), ['0:Idle', '28:Big_Wave_Hello', '22:FunnyDancing_01', '44:Happy_jump_f', '59:Victory_Cheer',
    '41:Formal_Bow', '30:Casual_Walk', '64:All_Night_Dance']);
});

test('its 3D view: a move that walks plays in place (across the floor only, whatever its armature), a jump still jumps, a sway still sways', () => {
  const close = (a, b, msg) => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${msg}: [${[...a].join(', ')}] vs [${b.join(', ')}]`)); };
  for (const zUp of [false, true]) {
    const r = rig({ zUp });
    const label = zUp ? 'a turned, centimetre armature' : 'a Y-up armature';
    // a walk: 1.4 m toward the camera over its loop, its hips bobbing 2 cm
    const walk = new THREE.AnimationClip('Casual_Walk', 2, [hipsTrack(r, [0, 1, 2], [[0, 0.95, 0], [0, 0.97, 0.7], [0, 0.95, 1.4]]),
      new THREE.VectorKeyframeTrack('Head.position', [0, 2], [...local(r, [0, 0.6, 0]), ...local(r, [0, 0.6, 0])])]);
    inPlace(walk, r.scene);
    close(walk.tracks[0].values, [[0, 0.95, 0], [0, 0.97, 0], [0, 0.95, 0]].flatMap((p) => local(r, p)), `${label}: the walk in place, its bob kept`);
    close(walk.tracks[1].values, [...local(r, [0, 0.6, 0]), ...local(r, [0, 0.6, 0])], `${label}: a still bone untouched`);
    // a sideways drift that comes back: only the part that doesn't (here, none) is taken out
    const sway = new THREE.AnimationClip('FunnyDancing_01', 2, [hipsTrack(r, [0, 0.5, 1, 1.5, 2], [[0, 0.95, 0], [0.07, 0.97, 0], [0, 0.95, 0], [-0.07, 0.97, 0], [0, 0.95, 0]])]);
    const before = [...sway.tracks[0].values];
    inPlace(sway, r.scene);
    close(sway.tracks[0].values, before, `${label}: a sway kept`);
    assert.ok(Math.abs(sway.tracks[0].values[3] - local(r, [0.07, 0.97, 0])[0]) < 1e-4, `${label}: …its hips still out to the side`);
    // a jump: up 35 cm and down, a little forward (20 cm): it still jumps, it lands where it started
    const jump = new THREE.AnimationClip('Happy_jump_f', 1.2, [hipsTrack(r, [0, 0.6, 1.2], [[0, 0.95, 0], [0, 1.3, 0.1], [0, 0.95, 0.2]])]);
    inPlace(jump, r.scene);
    close(jump.tracks[0].values, [[0, 0.95, 0], [0, 1.3, 0], [0, 0.95, 0]].flatMap((p) => local(r, p)), `${label}: the jump`);
  }
  // nothing that travels: unchanged (and a clip with no tracks)
  const r = rig();
  const idle = new THREE.AnimationClip('Idle', 2, [hipsTrack(r, [0, 2], [[0, 0.95, 0], [0, 0.95, 0]])]);
  const still = [...idle.tracks[0].values];
  inPlace(idle, r.scene);
  assert.deepEqual([...idle.tracks[0].values], still);
  assert.doesNotThrow(() => inPlace(new THREE.AnimationClip('Empty', 1, []), r.scene));
  // a node its file doesn't have: left alone
  const ghost = new THREE.AnimationClip('Ghost', 1, [new THREE.VectorKeyframeTrack('Nobody.position', [0, 1], [0, 0, 0, 0, 0, 5])]);
  inPlace(ghost, r.scene);
  assert.deepEqual([...ghost.tracks[0].values], [0, 0, 0, 0, 0, 5]);
});

test('its 3D view: framed for every pose of its moves (a jump stays in the picture), its bones put back after; the camera', () => {
  for (const zUp of [false, true]) {
    const r = rig({ zUp });
    const still = poseBox(r.scene);
    assert.ok(Math.abs(still.min.y) < 1e-3 && Math.abs(still.max.y - 1.7) < 1e-3, `standing: 0 to 1.7 m (${still.min.y.toFixed(3)} to ${still.max.y.toFixed(3)})`);
    const jump = new THREE.AnimationClip('Happy_jump_f', 1.2, [hipsTrack(r, [0, 0.6, 1.2], [[0, 0.95, 0], [0, 1.3, 0], [0, 0.95, 0]])]);
    const idle = new THREE.AnimationClip('Idle', 2, [hipsTrack(r, [0, 2], [[0, 0.95, 0], [0, 0.95, 0]])]);
    const rest = r.hips.position.clone();
    const box = movesBox(r.scene, [idle, jump]);
    assert.ok(Math.abs(box.max.y - 2.05) < 1e-3 && Math.abs(box.min.y) < 1e-3, `every pose: up to ${box.max.y.toFixed(3)} m (the jump's top, looked at exactly)`);
    assert.ok(r.hips.position.distanceTo(rest) < 1e-9, 'its bones put back as they were');
    assert.ok(Math.abs(poseBox(r.scene).max.y - 1.7) < 1e-3, '…and its body back where it stands');
    // the camera (as the page puts it: a little above, looking at the middle) sees every corner of the box, on a tall, a
    // square and a wide canvas, and it grows with the box
    for (const aspect of [0.6, 0.8, 1, 1.5, 2.2]) {
      const { distance, center } = framing(box, aspect);
      const cam = new THREE.PerspectiveCamera(26, aspect, distance / 100, distance * 10);
      cam.position.set(center.x, center.y + distance * 0.08, center.z + distance);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      let top = -1, bottom = 1;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(cam);
        assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `aspect ${aspect}: a corner in the picture (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
        top = Math.max(top, p.y); bottom = Math.min(bottom, p.y);
      }
      assert.ok(top - bottom > 1.4, `aspect ${aspect}: its whole height fills most of the picture (${((top - bottom) / 2 * 100).toFixed(0)}%)`);
    }
    // when it looks: evenly (8 times a second, 6 to 20 times) and at its hips' highest and lowest
    const times = lookTimes(jump);
    assert.ok(times.includes(0.6) && times.length >= 10 && times.length <= 26 && times.every((t, i) => t >= 0 && t < 1.2 && (!i || t > times[i - 1])), times.join(', '));
    assert.equal(lookTimes(new THREE.AnimationClip('Long', 30, [])).length, 20);
    assert.equal(lookTimes(new THREE.AnimationClip('Short', 0.2, [])).length, 6);
    const tall = framing(new THREE.Box3(new THREE.Vector3(-0.2, 0, -0.1), new THREE.Vector3(0.2, 3.4, 0.1)), 0.8).distance;
    assert.ok(tall > framing(box, 0.8).distance, 'a taller box: further away');
  }
});

// ---------- its page: since AGI Studio (2026-10-10), the app's 3D view ----------
// The studio's own page (studio.html with src/studio/page.js and its words) became AGI Studio the same day: a character's
// page is the app's 3D view (src/studio/views/model3d.js), at agi1.app/studio/<id> and studio.agi1.app/3d/<id>. The app
// itself: tests/influencer.test.js.
const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
test("a character's page is the app's 3D view: its steps in words, its reactions its own moves, why it couldn't be made, Share on X; never the AI service's name", async () => {
  const view = readFileSync(new URL('../src/studio/views/model3d.js', import.meta.url), 'utf8');
  // its 3D view (three.js) loaded only there, only once it's done; its steps (a character's, or a 3D model's of an influencer)
  assert.doesNotMatch(view, /^import .*viewer/m, 'never imported up front');
  assert.match(view, /const \{ createViewer \} = await import\('\.\.\/viewer\.js'\);/);
  assert.doesNotMatch(view, /from 'three'/);
  assert.match(view, /const list = c\.inf \? MODEL_STEPS : STEPS;/);
  assert.doesNotMatch(view, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  assert.doesNotMatch(view, /eth_sendTransaction|wallet_switchEthereumChain|eth_signTypedData|wallet_addEthereumChain|ethereum:/);
  for (const x of [...R.STEPS, ...R.MODEL_STEPS]) assert.ok(x.words.length > 5 && !/\bAI service\b/.test(x.words), x.step);
  assert.deepEqual(R.MODEL_STEPS.map((x) => x.step), ['image', 'rig', 'moves', 'save']);
  // the app's router: agi1.app/studio/<id> (an old link) and studio.agi1.app/3d/<id> both open it
  const app = readFileSync(new URL('../src/studio/app.js', import.meta.url), 'utf8');
  assert.match(app, /m = new RegExp\(`\^\/3d\/\(\$\{ID\}\)\$`\)\.exec\(p\) \|\| new RegExp\(`\^\/\(\$\{ID\}\)\$`\)\.exec\(p\);/);
  // its words (src/studio/app-words.js): its reactions are its own moves (never standing still), why one couldn't be made
  const AW = await import('../src/studio/app-words.js');
  for (const m of AW.REACTIONS) assert.ok(R.MOVE_NAMES.includes(m) && m !== 'idle', m);
  for (const e of ['refused', 'pose', 'too_big', 'expired', 'save', 'no_picture']) assert.notEqual(AW.failText(e), "It couldn't be made.", e);
  for (const e of ['ai:preview', 'ai:image', 'ai:rig', 'ai:moves']) assert.equal(AW.failText(e), "The AI service couldn't make it this time.", e);
  assert.equal(AW.modelText({ status: 'making', step: 'rig' }), 'Giving it bones…');
  assert.equal(AW.modelText({ status: 'done' }), 'Ready in 3D');
  // Share on X: the visitor posts it, it fits (a link counts 23), never money talk
  const share = new URL(AW.share3dUrl('A name of twenty-four ch', 'https://studio.agi1.app/3d/abcdefghijklmnopqrstuv'));
  assert.equal(share.origin + share.pathname, 'https://x.com/intent/tweet');
  const post = share.searchParams.get('text');
  assert.ok([...post].length + 1 + 23 <= 280, post);
  assert.doesNotMatch(post, /\b(buy|sell|pump|moon|profit|price|invest|gains?|100x|financial)\b|\$AGI/i);
  // never the AI service's name where a visitor reads it (the owner's rule): the app's page, its code, its rules (their comments
  // aren't shipped: the build drops them)
  for (const f of ['studio.html', 'src/studio/app.js', 'src/studio/app-words.js', 'src/studio/rules.js', 'src/studio/viewer.js', 'src/studio/views/model3d.js']) {
    assert.doesNotMatch(strip(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')), /meshy/i, f);
  }
});

test("its old page's addresses open the app: agi1.app/studio/<id> (the rewrite, its destination /studio), studio.agi1.app; the old page's files are gone", () => {
  const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en" data-theme="dark" data-page="studio">/);
  assert.match(html, /<script type="module" src="\/src\/studio\/app\.js"><\/script>/);
  assert.match(html, /meta property="og:url" content="__SITE__\/studio"/);
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(vercel.rewrites.filter((r) => r.source.startsWith('/studio')), [{ source: '/studio/:path+', destination: '/studio' }],
    'every address under /studio (never /studio.html: cleanUrls drops ".html" before rewrites run)');
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /studio: 'studio\.html'/);
  assert.match(readFileSync(new URL('../scripts/share-pages.js', import.meta.url), 'utf8'), /'dist\/studio\.html'/);
  for (const gone of ['src/studio/page.js', 'src/studio/words.js', 'src/styles/studio.css']) {
    assert.throws(() => readFileSync(new URL(`../${gone}`, import.meta.url)), /ENOENT/, gone);
  }
  assert.doesNotMatch(readFileSync(new URL('../src/styles/pop.css', import.meta.url), 'utf8'), /\.st-/, "Pop mode's rules for the old page went with it");
  // the safety note (the home page's) says what AGI Studio does with money and data
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const must of [/In AGI Studio \(studio\.agi1\.app\), you buy credits with USDG and spend them on what its AI services make: credits have no cash value and can't be withdrawn, sold or refunded, and something that can't be made gives its credits back\./,
    /Holding \$AGI gives a discount there and free credits each month \(Crush 20% off and 100 credits; Soulmate 40% off, 400 credits and a free 3D model\): a thank-you for holding, not an investment\./,
    /a burn for more messages or for an unlock in AGI Studio, only ever to the burn address <span class="mono">0x000…dEaD<\/span> \(zeros, then dEaD\); and USDG for credits in AGI Studio, only ever to the studio's wallet that its page shows\./,
    /Under a scrambled code of your wallet \(never its address\) we keep your credits and what they paid for, your influencers and what was made for them, and a scrambled code of each USDG payment counted \(never the transaction\)/]) {
    assert.ok(index.search(must) > 0, String(must));
  }
  assert.doesNotMatch(index, /AGI-1's studio/, "the old studio's sentences left with its page");
});
