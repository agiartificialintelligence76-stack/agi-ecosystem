// AGI-1's 3D character studio (2026-10-10, the owner: "what if i launched a where they can create a 3d model with meshy ai
// api that can move on chat just like vladcat. they can get it by burning $AGI tokens and can launch token with it", then
// "Burn $AGI or USDG", holder discounts, a free one a month for Soulmates): src/studio/rules.js, server/studio-words.js,
// server/meshy.js, server/studio-files.js, server/studio-chain.js, server/studio.js, server/studio-api.js, its routes in
// api/launch.js and api/feed.js, supabase/studio.sql's promises. With fake Meshy, Supabase (studio.sql's rules in
// JavaScript: the SQL itself ran in PGlite) and its Storage, Robinhood Chain, the block explorer and Cloudflare.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { crc32 as zlibCrc32 } from 'node:zlib';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as R from '../src/studio/rules.js';
import { checkCharacter, meshyPrompt, meshyTexture, moveTrouble, lookTrouble, checkModelWords, meshyLook, meshyMotion } from '../server/studio-words.js';
import { meshyBody, meshyStart, meshyTask, animationUrl, animationFbxUrl, thumbnailUrl, modelUrl, textureUrls, CREDITS, MESHY } from '../server/meshy.js';
import * as F from '../server/studio-files.js';
import { USDG, paidIn, readPayment, amountOf, recentPayments, PAY_WINDOW_MS, _resetStudioChain } from '../server/studio-chain.js';
import {
  STUDIO, studioOn, mayMake, studioWallet, payCode, walletNow, pageView, makeQuote, choosePay, checkPayment, redo, myCharacters,
  gallery, monthLeft, tick, studioClock, studioKey, _resetStudioKey, getOrder, newOrderId, specOf, planOf, saveNeeds,
} from '../server/studio.js';
import { studioGet, studioPost, studioLookBurst, studioFileBurst, studioActBurst } from '../server/studio-api.js';
import { DL, makeFormat, dlTick, dlTidy, dlClock } from '../server/studio-dl.js';
import { getConfig, studioAddress } from '../server/config.js';
import { makeSession } from '../server/session.js';
import { txCode, burnWallet, _resetBurnKey } from '../server/burn.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';
import { GET as launchGet, POST as launchPost } from '../api/launch.js';
import { GET as feedGet } from '../api/feed.js';
import * as THREE from 'three';
import { clipsFor, inPlace, poseBox, movesBox, framing, lookTimes, aimFor, HEAD, RIGS } from '../src/studio/viewer.js';
import * as ST from '../src/studio/stage-tools.js';

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
      const { lease, created, updated, dl_lease, ...row } = o;
      return { ...row, paid_at: iso(o.paid_at), started_at: iso(o.started_at), done_at: iso(o.done_at), created_at: iso(created), updated_at: iso(updated),
        dl_until: iso(o.dl_until), expired: this.expired(o) };
    },
    studio_lease({ p_id, p_secs }) {
      const o = this.orders.get(p_id);
      if (!(p_secs >= 5 && p_secs <= 300) || !o || !['paid', 'making'].includes(o.status) || o.lease > now()) return false;
      o.lease = now() + p_secs * 1000;
      return true;
    },
    studio_step({ p_id, p_step, p_task, p_tasks, p_tries }) {
      const o = this.orders.get(p_id);
      // (2026-10-13, the 3D tool) and a 3D model's described moves: motion1/2 (made from its words), apply1/2 (on its bones)
      if (!['motion1', 'motion2', 'image', 'preview', 'refine', 'rig', 'moves', 'apply1', 'apply2', 'save'].includes(p_step)
        || (p_task !== null && !/^[A-Za-z0-9_-]{6,80}$/.test(p_task))
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
    // (2026-10-13, the 3D tool) p_todo: the extra downloads it asked for, only ones in its formats, in their own order, kept 30 days
    studio_done({ p_id, p_glb, p_pic, p_moves, p_todo = [] }) {
      const o = this.orders.get(p_id);
      if (!(p_glb >= 1 && p_glb <= 1e8) || !(p_pic >= 1 && p_pic <= 1e8) || !Array.isArray(p_moves) || p_moves.length < 1 || p_moves.length > 12) return false;
      if (!o || !['paid', 'making'].includes(o.status)) return false;
      const todo = ['full', 'fbx', 'usdz', 'stl', 'obj'].filter((f) => (p_todo || []).includes(f) && (o.formats || []).includes(f));
      Object.assign(o, { status: 'done', glb_bytes: p_glb, pic_bytes: p_pic, moves: [...p_moves], step: null, task: null, lease: 0, credit: false,
        error: null, done_at: now(), updated: now(), formats_todo: todo, formats_done: [], formats_failed: [], format_bytes: {}, format_tries: 0,
        dl_lease: 0, dl_until: todo.length ? now() + 30 * DAY : null });
      return true;
    },
    // a 3D model's extra downloads (2026-10-13): the clock's list, its turn, one format's end, the tidy-up's list and its end
    studio_dl_due({ p_limit }) {
      return [...this.orders.values()].filter((o) => o.status === 'done' && !o.hidden && o.formats_todo?.length && o.dl_until > now()
        && !(o.dl_lease > now())).sort((a, b) => a.done_at - b.done_at).slice(0, Math.min(Math.max(p_limit ?? 1, 1), 20)).map((o) => o.id);
    },
    studio_dl_lease({ p_id, p_secs }) {
      const o = this.orders.get(p_id);
      if (!(p_secs >= 5 && p_secs <= 300) || !o || o.status !== 'done' || o.hidden || !o.formats_todo?.length || !(o.dl_until > now())
        || o.dl_lease > now()) return false;
      o.dl_lease = now() + p_secs * 1000;
      return true;
    },
    studio_dl_put({ p_id, p_format, p_ok, p_bytes, p_final }) {
      if (!['full', 'fbx', 'usdz', 'stl', 'obj'].includes(p_format) || typeof p_ok !== 'boolean' || (p_ok && !(p_bytes >= 1 && p_bytes <= 1e8))) return false;
      const o = this.orders.get(p_id);
      if (!o || o.status !== 'done' || o.hidden || !(o.dl_until > now()) || !o.formats_todo?.includes(p_format)) return false;
      if (p_ok || p_final) {
        o.formats_todo = o.formats_todo.filter((f) => f !== p_format);
        const into = p_ok ? 'formats_done' : 'formats_failed';
        if (!o[into].includes(p_format)) o[into] = [...o[into], p_format];
        if (p_ok) o.format_bytes = { ...o.format_bytes, [p_format]: p_bytes };
        Object.assign(o, { format_tries: 0, dl_lease: 0 });
      } else {
        Object.assign(o, { format_tries: Math.min(o.format_tries + 1, 20), dl_lease: now() + 120_000 });
      }
      return true;
    },
    studio_dl_expired({ p_limit }) {
      return [...this.orders.values()].filter((o) => (o.formats_done?.length || o.formats_todo?.length)
        && (!o.dl_until || o.dl_until < now() || o.hidden || o.status !== 'done')).slice(0, Math.min(Math.max(p_limit ?? 20, 1), 100)).map((o) => o.id);
    },
    studio_dl_clear({ p_id }) {
      const o = this.orders.get(p_id);
      if (!o || !(o.formats_done?.length || o.formats_todo?.length) || !(!o.dl_until || o.dl_until < now() || o.hidden || o.status !== 'done')) return null;
      Object.assign(o, { formats_todo: [], formats_done: [], format_bytes: {}, format_tries: 0, dl_lease: 0 });
      return true;
    },
    // (AGI Studio, influencers.sql) a 3D model of an influencer that couldn't be made: its credits back (once)
    inf_3d_back({ p_order }) {
      this.backs = [...(this.backs || []), p_order];
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
// a GLB read back (gltf-transform), and its clips' names
const readGlb = async (bytes) => new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(new Uint8Array(bytes));
const clipsIn = async (bytes) => (await readGlb(bytes)).getRoot().listAnimations().map((a) => a.getName());

// ---------- the fakes ----------
let fake, calls, logs;
const log = () => logs.join('\n');
function meshyObject(t) {
  const o = { id: t.id, type: t.step, status: t.status, progress: t.progress, task_error: { message: t.error || '' }, created_at: t.at };
  if (t.status === 'SUCCEEDED' && (t.step === 'preview' || t.step === 'refine')) {
    o.model_urls = { glb: `https://assets.meshy.ai/tasks/${t.id}/model.glb?Expires=1` };
    o.thumbnail_url = `https://assets.meshy.ai/tasks/${t.id}/preview.png?Expires=1`;
  }
  // (2026-10-10, AGI Studio) image to 3D: its model in every format, its picture and its textures (2026-10-13: more downloads)
  if (t.status === 'SUCCEEDED' && t.step === 'image') {
    const at = (f) => `https://assets.meshy.ai/tasks/${t.id}/model.${f}?Expires=1`;
    o.model_urls = { glb: at('glb'), fbx: at('fbx'), obj: at('obj'), mtl: at('mtl'), usdz: at('usdz'), stl: at('stl') };
    o.thumbnail_url = `https://assets.meshy.ai/tasks/${t.id}/preview.png?Expires=1`;
    o.texture_urls = [{ base_color: `https://assets.meshy.ai/tasks/${t.id}/texture_0.png?Expires=1`, normal: `https://assets.meshy.ai/tasks/${t.id}/texture_0_normal.png?Expires=1` }];
  }
  if (t.status === 'SUCCEEDED' && t.step === 'rig') o.result = { rigged_character_glb_url: `https://assets.meshy.ai/tasks/${t.id}/rigged.glb` };
  if (t.status === 'SUCCEEDED' && t.step === 'moves') {
    o.result = { animation_glb_url: `https://assets.meshy.ai/tasks/${t.id}/animations.glb?Expires=1`, animation_fbx_url: `https://assets.meshy.ai/tasks/${t.id}/animations.fbx?Expires=1` };
  }
  // (2026-10-13) a move from its words, and that move put on its bones (its own file, one clip)
  if (t.status === 'SUCCEEDED' && t.step === 'apply') o.result = { animation_glb_url: `https://assets.meshy.ai/tasks/${t.id}/motion.glb?Expires=1` };
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
    files: { glb: null, png: null, motion: null, byExt: {}, gone: [], status: 200 },
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
    // Supabase Storage: the private bucket (2026-10-13: a file's name may have folders, dl/<id>.glb; its signed addresses; its
    // bulk delete)
    if (url.startsWith(`${SB}/storage/v1/object/`)) {
      calls.push({ to: 'storage', method, url, headers: init.headers, body: method === 'DELETE' ? JSON.parse(init.body) : undefined });
      if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
      if (method === 'DELETE' && url === `${SB}/storage/v1/object/agi1-characters`) {
        const gone = JSON.parse(init.body).prefixes.filter((n) => fake.storage.delete(n));
        return Response.json(gone.map((name) => ({ name })));
      }
      const signed = /\/storage\/v1\/object\/sign\/agi1-characters\/([^?]+)$/.exec(url);
      if (signed) {
        return fake.storage.has(signed[1]) ? Response.json({ signedURL: `/object/sign/agi1-characters/${signed[1]}?token=signed-token` })
          : new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
      }
      const m = /\/storage\/v1\/object\/(authenticated\/)?agi1-characters\/([^?]+)$/.exec(url);
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
        const step = path === '/openapi/v2/text-to-3d' ? body.mode : path === '/openapi/v1/image-to-3d' ? 'image' : path === '/openapi/v1/rigging' ? 'rig'
          : path === '/openapi/v1/animations' ? (body.motion_task_id ? 'apply' : 'moves') : path === '/openapi/v1/text-to-motion' ? 'motion' : null;
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
      // (2026-10-13) a described move's own file (motion.glb), and the image task's other formats and its textures, by their
      // extension; a file Meshy let go of (gone: its path's end)
      const path = new URL(url).pathname, ext = path.split('.').pop();
      if (fake.files.gone.some((end) => path.endsWith(end))) return new Response('expired', { status: 404 });
      const bytes = path.endsWith('/motion.glb') && fake.files.motion ? fake.files.motion : ext === 'glb' ? fake.files.glb
        : fake.files.byExt[ext] ?? fake.files.png;
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
  for (const m of ['dance', 'walk', 'party']) assert.ok(R.LOOPING.has(m), m);
  for (const m of R.LOOPING) assert.ok(R.MOVE_BY_NAME.has(m), m);
  for (const [move, words] of Object.entries(R.MOVE_WORDS)) {
    assert.ok(R.MOVE_BY_NAME.has(move), move);
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

// (2026-10-13) "Pick its moves": the library a model's moves come from, and its other choices
const LIBRARY = ['0:Idle', '28:Big_Wave_Hello', '41:Formal_Bow', '25:Agree_Gesture', '409:Finger_Wag_No', '317:Shrug', '313:Talk_with_Hands_Open',
  '50:Phone_Call_Gesture', '27:Big_Heart_Gesture', '36:Confused_Scratch', '315:Hand_on_Hip_Gesture', '26:Angry_Stomp', '31:Catching_Breath',
  '48:Mirror_Viewing', '59:Victory_Cheer', '44:Happy_jump_f', '403:Victory_Fist_Pump', '298:Cheer_with_Both_Hands_Up', '388:Show_Both_Arm_Muscles',
  '387:Half_Squat_with_Thumb_Up', '397:360_Power_Spin_Jump', '452:Backflip', '22:FunnyDancing_01', '64:All_Night_Dance', '23:FunnyDancing_02',
  '63:Arm_Circle_Shuffle', '65:Bass_Beats', '67:Bubble_Dance', '75:Indoor_Swing', '77:Magic_Genie', '79:OMG_Groove', '81:Pod_Baby_Groove',
  '591:Hip_Hop_Dance', '395:Breakdance_1990', '30:Casual_Walk', '107:Confident_Strut', '117:Red_Carpet_Walk', '118:Skip_Forward', '554:Funky_Walk',
  '62:penguin_walk', '14:Run_02', '326:jumping_jacks', '319:air_squat', '329:push_up', '46:Jump_Rope', '410:Kick_a_Soccer_Ball', '385:Boxing_Warmup',
  '362:Sit_Cross_Legged', '342:Stand_and_Drink'];
test('rules: the move library (Meshy library ids and clips, groups, labels, the words for each, one order)', () => {
  assert.deepEqual(R.MOVE_LIBRARY.map((m) => `${m.action}:${m.clip}`), LIBRARY, "Meshy's animation library, as its list names them");
  const names = R.MOVE_LIBRARY.map((m) => m.name);
  assert.equal(new Set(names).size, names.length, 'one name each');
  assert.equal(new Set(R.MOVE_LIBRARY.map((m) => m.clip.toLowerCase())).size, names.length, 'one clip each');
  for (const m of R.MOVE_LIBRARY) {
    assert.match(m.name, /^[a-z]+$/);
    assert.ok(m.label.length >= 2 && m.label.length <= 16, m.label);
    assert.ok(m.words.includes(m.name), `${m.name} answers to its own name`);
    assert.equal(R.MOVE_BY_NAME.get(m.name), m);
    if (m.name === 'idle') assert.equal(m.group, null);
    else assert.ok(Object.hasOwn(R.MOVE_GROUPS, m.group), m.name);
  }
  assert.equal(names[0], 'idle');
  for (const g of Object.keys(R.MOVE_GROUPS)) assert.ok(R.MOVE_LIBRARY.some((m) => m.group === g), g);
  for (const m of R.MOVE_LIBRARY) {
    if (['dance', 'walk'].includes(m.group)) assert.ok(m.loop, `${m.name} goes on a while`);
    if (['greet', 'feel', 'cheer', 'rest'].includes(m.group) || m.name === 'idle') assert.ok(!m.loop, `${m.name} plays once`);
  }
  assert.deepEqual(R.MOVES.map((m) => m.name), R.MOVE_NAMES, 'the 8 of every model made before');
  assert.deepEqual(R.DEFAULT_PICKS, R.MOVE_NAMES.slice(1));
  assert.deepEqual(R.MOVE_ORDER.slice(0, 8), R.MOVE_NAMES, 'the 8 first, as before');
  assert.deepEqual([...R.MOVE_ORDER].sort(), [...names].sort(), 'every move once');
  assert.equal(R.moveLabel('hiphop'), 'Hip hop'); assert.equal(R.moveLabel('moonwalk'), 'moonwalk');
  // what someone types
  const all = names;
  assert.equal(R.moveIn('strut'), 'walk', 'a word another move answers to, on a model without it');
  assert.equal(R.moveIn('strut', all), 'strut', 'its own name first');
  assert.equal(R.moveIn('do a hip hop dance', all), 'hiphop', 'two words written together');
  assert.equal(R.moveIn('jump rope!', all), 'jumprope');
  assert.equal(R.moveIn('jump rope!'), 'jump', 'without it, the first word');
  assert.equal(R.moveIn('thumbs up', all), 'thumbs'); assert.equal(R.moveIn('sit down please', all), 'sit');
  assert.equal(R.moveIn('jumping jacks', all), 'jacks'); assert.equal(R.moveIn('red carpet', all), 'runway');
  assert.equal(R.moveIn('i love you', all), 'heart'); assert.equal(R.moveIn('i love you'), null);
  assert.equal(R.moveIn('moonwalk!', [...R.MOVE_NAMES, 'moonwalk']), 'moonwalk', 'a move described in words, by its own name');
  assert.equal(R.moveIn('moonwalk!'), null);
  assert.equal(R.moveIn('hello, now hiphop', all), 'wave', 'still the first word that names one');
  assert.ok(R.moveWord('love') && R.moveWord('HIPHOP') && R.moveWord('idle'));
  assert.equal(R.moveWord('moonwalk'), false);
});

test('rules: a 3D model\'s choices (moves, described moves, shape and look, downloads), their prices and its steps', () => {
  assert.deepEqual(R.MODEL_DEFAULT, { moves: R.DEFAULT_PICKS, own: [], detail: 'std', shine: false, pose: 'a', height: 170, look: null, formats: [] });
  assert.deepEqual(R.modelSpec(null), R.MODEL_DEFAULT); assert.deepEqual(R.modelSpec({}), R.MODEL_DEFAULT);
  assert.ok(R.isDefaultSpec(null) && R.isDefaultSpec({}) && R.isDefaultSpec({ moves: [...R.DEFAULT_PICKS].reverse(), look: '  ' }));
  assert.equal(R.isDefaultSpec({ moves: ['wave'] }), false);
  const spec = R.modelSpec({
    moves: ['hiphop', 'wave', 'backflip', 'wave', 'dance'], own: [{ name: 'Moonwalk', prompt: '  does the\nmoonwalk  backwards ', seconds: 8 }],
    detail: 'high', shine: true, pose: 't', height: 160, look: ' a red  tracksuit ', formats: ['obj', 'full', 'obj'],
  });
  assert.deepEqual(spec, {
    moves: ['wave', 'dance', 'backflip', 'hiphop'], own: [{ name: 'moonwalk', prompt: 'does the moonwalk backwards', seconds: 8 }],
    detail: 'high', shine: true, pose: 't', height: 160, look: 'a red tracksuit', formats: ['full', 'obj'],
  }, 'tidied: in one order, once each, their words tidied');
  const firstBad = (x) => R.modelSpecField(x);
  const cases = [
    [{ moves: [] }, 'moves'], [{ moves: ['idle'] }, 'moves'], [{ moves: ['moonwalk'] }, 'moves'], [{ moves: 'wave' }, 'moves'],
    [{ moves: R.MOVE_LIBRARY.slice(1, 11).map((m) => m.name) }, 'moves'],
    [{ own: [{ name: 'wave', prompt: 'a move' }] }, 'own'], [{ own: [{ name: 'love', prompt: 'a move' }] }, 'own'],
    [{ own: [{ name: 'x', prompt: 'a move' }] }, 'own'], [{ own: [{ name: '9lives', prompt: 'a move' }] }, 'own'],
    [{ own: [{ name: 'moon', prompt: 'ab' }] }, 'own'], [{ own: [{ name: 'moon', prompt: 'x'.repeat(201) }] }, 'own'],
    [{ own: [{ name: 'moon', prompt: 'a move', seconds: 4 }] }, 'own'],
    [{ own: [{ name: 'moon', prompt: 'a move' }, { name: 'moon', prompt: 'another' }] }, 'own'],
    [{ own: [1, 2, 3].map((i) => ({ name: `move${i}`, prompt: 'a move' })) }, 'own'],
    [{ detail: 'ultra' }, 'detail'], [{ shine: 'yes' }, 'shine'], [{ pose: 'x' }, 'pose'],
    [{ height: 139 }, 'height'], [{ height: 211 }, 'height'], [{ height: 170.5 }, 'height'], [{ height: '170cm' }, 'height'],
    [{ look: 'ab' }, 'look'], [{ look: 'x'.repeat(301) }, 'look'], [{ look: 7 }, 'look'],
    [{ formats: ['png'] }, 'formats'], [{ formats: 'glb' }, 'formats'], [[], 'spec'], ['x', 'spec'], [7, 'spec'],
  ];
  for (const [x, field] of cases) {
    assert.equal(firstBad(x), field, JSON.stringify(x));
    assert.equal(R.modelSpec(x), null);
  }
  assert.equal(R.modelSpecField({ moves: ['wave'] }), null);
  assert.ok(R.modelSpec({ moves: R.MOVE_LIBRARY.slice(1, 10).map((m) => m.name) }), 'nine');
  assert.deepEqual(R.modelSpec({ own: [{ name: 'moon', prompt: 'a move' }] }).own, [{ name: 'moon', prompt: 'a move', seconds: 5 }]);
  // prices: each extra about 1.8× what it costs (a Meshy credit about 2 cents)
  assert.deepEqual(R.MODEL_EXTRAS, { move: 11, own: 47, high: 18 });
  assert.deepEqual(R.MODEL_EXTRAS, { move: R.creditsFor(6), own: R.creditsFor(26), high: R.creditsFor(10) });
  assert.deepEqual(R.modelExtras(null), { moves: 0, own: 0, high: 0, total: 0 });
  assert.deepEqual(R.modelExtras({ moves: ['wave'] }), { moves: 0, own: 0, high: 0, total: 0 }, 'fewer moves cost the same');
  assert.deepEqual(R.modelExtras(spec), { moves: 0, own: 47, high: 18, total: 65 });
  const nine = R.modelSpec({ moves: R.MOVE_LIBRARY.slice(1, 10).map((m) => m.name), own: [{ name: 'moon', prompt: 'a move' }, { name: 'star', prompt: 'b move' }], detail: 'high' });
  assert.deepEqual(R.modelExtras(nine), { moves: 22, own: 94, high: 18, total: 134 });
  for (const level of [1, 2, 3]) assert.equal(R.modelCost(null, level), R.creditPrice('model', level), 'as before');
  assert.deepEqual([1, 2, 3].map((l) => R.modelCost(nine, l)), [634, 507, 380]);
  assert.deepEqual([1, 2, 3].map((l) => R.modelCost(nine, l, { free: true })), [134, 107, 80], 'a free model: its extras still paid');
  assert.equal(R.modelCost(null, 3, { free: true }), 0);
  assert.equal(R.modelCost({ height: 1 }), null);
  assert.ok(R.burnable(null) && R.burnable({ shine: true, look: 'red', pose: 't', formats: ['stl'], detail: 'light', height: 150 }), 'the free choices');
  for (const x of [{ moves: R.MOVE_LIBRARY.slice(1, 9).map((m) => m.name) }, { own: [{ name: 'moon', prompt: 'a move' }] }, { detail: 'high' }]) assert.equal(R.burnable(x), false);
  // its moves and steps
  assert.deepEqual(R.modelMoves(null).map((m) => m.name), R.MOVE_NAMES);
  assert.deepEqual(R.modelMoves(spec).map((m) => m.action), [0, 28, 22, 452, 591]);
  assert.deepEqual(R.modelMoveNames(spec), ['idle', 'wave', 'dance', 'backflip', 'hiphop', 'moonwalk']);
  assert.ok(R.modelMoves(nine).length <= 10, "Meshy's file: 10 moves at most");
  assert.ok(R.modelMoveNames(nine).length <= 12, 'its moves: 12 at most (studio_done)');
  assert.deepEqual(R.modelPlan(null), ['image', 'rig', 'moves', 'save']);
  assert.deepEqual(R.modelPlan(nine), ['motion1', 'motion2', 'image', 'rig', 'moves', 'apply1', 'apply2', 'save']);
  assert.deepEqual(R.modelTimes(null), R.TYPICAL.model, 'as before');
  assert.deepEqual(R.modelTimes(nine), [['motion1', 100], ['motion2', 100], ['image', 190], ['rig', 60], ['moves', 112], ['apply1', 70], ['apply2', 70], ['save', 69]]);
  assert.deepEqual(R.modelStepList(R.modelTimes(nine)).map((s) => s.step), ['motion', 'image', 'rig', 'moves', 'apply', 'save']);
  assert.deepEqual(R.modelStepList(null).map((s) => s.words), R.MODEL_STEPS.map((s) => s.words));
  assert.equal(R.stepGroup('apply2'), 'apply'); assert.equal(R.stepGroup('rig'), 'rig');
  const p = R.progressOf('model', { plan: R.modelTimes(nine), step: 'apply1', since: 1000, now: 1000 + 500_000 });
  assert.ok(p.pct > 70 && p.pct < 99, JSON.stringify(p));
  // downloads
  assert.deepEqual(Object.keys(R.DL_FORMATS), ['full', 'fbx', 'usdz', 'stl', 'obj']);
  assert.equal(R.dlPath('a'.repeat(22), 'obj'), `dl/${'a'.repeat(22)}.zip`);
  assert.equal(R.DL_DAYS, 30);
  assert.equal(R.ownClip('moon'), 'own_moon');
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

test("words: a 3D model's look and its moves described in words (PG-13, nothing sexual in a move, never hurting anyone), and what Meshy gets", () => {
  // a move's words: what people would ask for passes (a punch in the air is boxing, a kick at a ball is a kick)
  for (const fine of ['spin around twice', 'punch the air like a boxer', 'kick a ball', 'karate kick', 'a high kick', 'boxing combo', 'hit the griddy',
    'shoot a basketball', 'moonwalk like a pop star', 'a shy little wave', 'jump and clap', 'make it rain', '', '   ']) {
    assert.equal(moveTrouble(fine), null, fine);
  }
  // …never anything sexual about a body's moves, never hurting anyone or holding a weapon, never a hateful salute; and the
  // character's own checks (people, links, contacts, minors), words written together too
  for (const [bad, why] of [['twerk', 'adult'], ['TwerkTime', 'adult'], ['a sexy dance', 'adult'], ['lap dance', 'adult'], ['take off her shirt', 'adult'],
    ['bounce her chest', 'adult'], ['grinding on him', 'adult'], ['slap someone', 'violence'], ['punch someone in the face', 'violence'],
    ['PunchSomeone', 'violence'], ['kick someone', 'violence'], ['stab the air', 'violence'], ['shoot him', 'violence'], ['aim a gun', 'violence'],
    ['falls dead', 'violence'], ['holds a knife', 'violence'], ['sieg heil', 'hate'], ['goose step', 'hate'], ['a nazi salute', 'hate'],
    ['dance like Taylor Swift', 'person'], ['visit agi1.app', 'link'], ['wave at @bob', 'contact'], ['a child dancing', 'minor']]) {
    assert.equal(moveTrouble(bad), why, bad);
  }
  // its look in words: the character's checks (what it wears is painted over its full body)
  assert.equal(lookTrouble('a red leather jacket and silver boots'), null);
  assert.equal(lookTrouble(''), null);
  assert.equal(lookTrouble(null), null);
  for (const [bad, why] of [['a bikini', 'adult'], ['lingerie', 'adult'], ['a Spider-Man suit', 'character'], ['looks like Elon Musk', 'person'],
    ['logo of example.com', 'link'], ['a nazi armband', 'hate'], ['bloody clothes', 'hate']]) {
    assert.equal(lookTrouble(bad), why, bad);
  }
  // a model's words together: its look first, then each described move's name, then what it does (which one, from 1)
  const own = [{ name: 'zoomies', prompt: 'runs in a little circle' }, { name: 'shake', prompt: 'twerk on the floor' }];
  assert.equal(checkModelWords({ look: 'a red jacket', own: own.slice(0, 1) }), null);
  assert.deepEqual(checkModelWords({ look: 'a red jacket', own }), { field: 'own', n: 2, part: 'prompt', why: 'adult' });
  assert.deepEqual(checkModelWords({ look: 'a bikini', own: [{ name: 'nazi', prompt: 'a wave' }] }), { field: 'look', why: 'adult' });
  assert.deepEqual(checkModelWords({ look: null, own: [{ name: 'nazi', prompt: 'a wave' }] }), { field: 'own', n: 1, part: 'name', why: 'hate' });
  assert.deepEqual([checkModelWords(null), checkModelWords({}), checkModelWords(R.MODEL_DEFAULT)], [null, null, null]);
  // what Meshy gets: its look as the texture's prompt (its face, hair and skin kept, family-friendly, no text), at most 600
  // characters; a described move as one person doing it, at most 400 (Text to Motion's own limit); invisible characters gone
  assert.equal(meshyLook('a red leather jacket'), "Keep the character's face, hair and skin as in its picture. A red leather jacket. Family-friendly, fully clothed. No text, no logos.");
  assert.equal(meshyLook('silver boots!'), "Keep the character's face, hair and skin as in its picture. Silver boots! Family-friendly, fully clothed. No text, no logos.");
  assert.equal(meshyLook('a\u200bred\u0000 jacket   with “quotes”'), 'Keep the character\'s face, hair and skin as in its picture. A red jacket with "quotes". Family-friendly, fully clothed. No text, no logos.');
  assert.equal([...meshyLook('x'.repeat(700))].length, 600);
  assert.equal(meshyMotion('spins twice'), 'A person does this move: Spins twice.');
  assert.equal(meshyMotion('Jumps!'), 'A person does this move: Jumps!');
  assert.equal([...meshyMotion('y'.repeat(500))].length, 400);
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
  assert.deepEqual(CREDITS, { preview: 20, refine: 10, image: 30, rig: 5, moves: 24, motion: 10, apply: 3, high: 5 });
  assert.equal(CREDITS.preview + CREDITS.refine + CREDITS.rig + CREDITS.moves, 59, 'a character is 59 credits');
  assert.equal(CREDITS.image + CREDITS.rig + CREDITS.moves, 59, 'an influencer\'s 3D model too');
  // (2026-10-13, the 3D tool) a model's choices (rules.js modelSpec) in each step's request: its detail (faces; High detail a
  // finer geometry too), shine (PBR maps), its pose, its look in words (the texture's prompt), its height (its bones' scale),
  // its picked moves (idle first, then in the library's order), and each move described in words (Text to Motion, then put on
  // its bones)
  const own = [{ name: 'zoomies', prompt: 'runs in a little circle, arms out', seconds: 3 }, { name: 'curtsy', prompt: 'a polite curtsy, then a smile' }];
  const spec = { moves: ['shrug', 'wave', 'backflip'], own, detail: 'high', shine: true, pose: 't', height: 182, look: 'a red leather jacket' };
  const pic = 'https://x.supabase.co/storage/v1/object/sign/a.png?token=t';
  assert.deepEqual(meshyBody('image', { imageUrl: pic, spec }), { image_url: pic, ai_model: 'latest', topology: 'triangle', target_polycount: 40000,
    should_remesh: true, should_texture: true, enable_pbr: true, pose_mode: 't-pose', moderation: true, geometry_resolution: '2k',
    texture_prompt: "Keep the character's face, hair and skin as in its picture. A red leather jacket. Family-friendly, fully clothed. No text, no logos." });
  assert.deepEqual(meshyBody('image', { imageUrl: pic, spec: { detail: 'light' } }), { image_url: pic, ai_model: 'latest', topology: 'triangle',
    target_polycount: 8000, should_remesh: true, should_texture: true, enable_pbr: false, pose_mode: 'a-pose', moderation: true });
  assert.deepEqual(meshyBody('image', { imageUrl: pic, spec: { detail: 'ultra' } }), meshyBody('image', { imageUrl: pic }), 'choices that aren\'t ours: the model as before');
  assert.equal(meshyBody('image', { imageUrl: pic, spec: { look: 'x'.repeat(301) } }).texture_prompt, undefined, 'a look too long is no look (and never asked: the server refuses it first)');
  assert.deepEqual(meshyBody('rig', { refineId: 'rf-123456', spec }), { input_task_id: 'rf-123456', height_meters: 1.82 });
  assert.deepEqual(meshyBody('moves', { rigId: 'rg-123456', spec }), { rig_task_id: 'rg-123456', action_ids: [0, 28, 317, 452] }, 'idle, wave, shrug, backflip');
  assert.deepEqual(meshyBody('moves', { rigId: 'rg-123456', spec: R.MODEL_DEFAULT }), { rig_task_id: 'rg-123456', action_ids: [0, 28, 22, 44, 59, 41, 30, 64] });
  assert.deepEqual(meshyBody('motion1', { spec }), { prompt: 'A person does this move: Runs in a little circle, arms out.', mode: 'prime', duration: 3 });
  assert.deepEqual(meshyBody('motion2', { spec }), { prompt: 'A person does this move: A polite curtsy, then a smile.', mode: 'prime', duration: 5 });
  assert.deepEqual(meshyBody('apply2', { rigId: 'rg-123456', motionId: 'mo-123456', spec }), { rig_task_id: 'rg-123456', motion_task_id: 'mo-123456' });
  for (const [step, inputs] of [['motion3', { spec }], ['motion0', { spec }], ['motion', { spec }], ['apply1', { rigId: 'rg-123456', spec }],
    ['apply1x', { rigId: 'rg-123456', motionId: 'mo-123456', spec }], ['motion1', { spec: { own: [] } }], ['motion1', {}]]) {
    assert.throws(() => meshyBody(step, inputs), new RegExp(`meshy: no step ${step}$`), step);
  }
  assert.ok([...meshyBody('motion1', { spec: { own: [{ name: 'long', prompt: 'x'.repeat(200) }] } }).prompt].length <= 400, "Text to Motion's own limit");
  const cfg = cfgNow();
  const id = await meshyStart(cfg, 'preview', { prompt: meshyPrompt(GOOD) });
  assert.match(id, /^0193bfc5-/);
  const c = calls.find((x) => x.to === 'meshy');
  assert.deepEqual([c.method, c.path, c.auth], ['POST', '/openapi/v2/text-to-3d', `Bearer ${MESHY_KEY}`]);
  assert.equal(c.body.prompt, meshyPrompt(GOOD));
  await meshyStart(cfg, 'rig', { refineId: id });
  await meshyStart(cfg, 'moves', { rigId: id });
  assert.deepEqual(calls.filter((x) => x.to === 'meshy').map((x) => x.path), ['/openapi/v2/text-to-3d', '/openapi/v1/rigging', '/openapi/v1/animations']);
  // (2026-10-13) a model's own steps: image to 3D, Text to Motion (motion1 and motion2 alike), its motion put on its bones
  // (apply: the animations path again), each with its spec's words
  calls.length = 0;
  const mo = await meshyStart(cfg, 'motion2', { spec });
  await meshyStart(cfg, 'image', { imageUrl: pic, spec });
  await meshyStart(cfg, 'apply2', { rigId: id, motionId: mo, spec });
  assert.deepEqual(calls.map((x) => [x.path, x.body]), [['/openapi/v1/text-to-motion', meshyBody('motion2', { spec })],
    ['/openapi/v1/image-to-3d', meshyBody('image', { imageUrl: pic, spec })], ['/openapi/v1/animations', { rig_task_id: id, motion_task_id: mo }]]);
  assert.equal((await meshyTask(cfg, 'motion2', mo)).status, 'PENDING');
  assert.equal(calls.at(-1).path, `/openapi/v1/text-to-motion/${mo}`, 'its state read on its own path');
  await assert.rejects(meshyStart(cfg, 'motion3', { spec }), (e) => e.why === 'request' && /no step motion3/.test(e.message));
  await assert.rejects(meshyTask(cfg, 'unknown', mo), (e) => e.why === 'request');
  // Text to Motion says 403 when its screening stops a move's words: "refused" (never tried again: server/studio.js)
  fake.meshy.fail.push({ status: 403, text: '{"message":"The prompt was flagged"}' });
  const refused = await meshyStart(cfg, 'motion1', { spec }).catch((e) => e);
  assert.deepEqual([refused.why, refused.status], ['refused', 403]);
  assert.match(refused.message, /its screening stopped these words/);
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
  // (2026-10-13, more downloads) the same moves as an FBX, the image task's shape in other formats, its textures
  assert.equal(animationFbxUrl({ result: { animation_fbx_url: 'https://assets.meshy.ai/a.fbx' } }), 'https://assets.meshy.ai/a.fbx');
  assert.equal(animationFbxUrl({ result: { animation_glb_url: 'https://assets.meshy.ai/a.glb' } }), null);
  const done = { model_urls: { glb: 'https://assets.meshy.ai/m.glb', usdz: 'https://assets.meshy.ai/m.usdz', stl: 'http://assets.meshy.ai/m.stl', obj: 'data:,x' },
    texture_urls: [{ base_color: 'https://assets.meshy.ai/c.png', normal: 'https://assets.meshy.ai/n.png', metallic: 'ftp://x/m.png', emission: 'https://assets.meshy.ai/e.png' },
      { base_color: 'https://assets.meshy.ai/second.png' }] };
  assert.deepEqual(['glb', 'usdz', 'stl', 'obj', 'fbx'].map((f) => modelUrl(done, f)), ['https://assets.meshy.ai/m.glb', 'https://assets.meshy.ai/m.usdz', null, null, null]);
  assert.deepEqual(textureUrls(done), { base_color: 'https://assets.meshy.ai/c.png', normal: 'https://assets.meshy.ai/n.png' }, 'its first material, the four maps it has (https only)');
  assert.deepEqual([textureUrls({}), textureUrls({ texture_urls: 'x' }), modelUrl(null, 'glb')], [{}, {}, null]);
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

// (2026-10-13, the 3D tool) a stored ZIP read back the way an unzip tool reads it: its end record, its central directory,
// each file's local header (stored, 1980-01-01 00:00) and its bytes
function readZip(buf) {
  const end = buf.length - 22;
  assert.equal(buf.readUInt32LE(end), 0x06054b50, 'its end record, last');
  const count = buf.readUInt16LE(end + 10), size = buf.readUInt32LE(end + 12), at = buf.readUInt32LE(end + 16);
  assert.deepEqual([buf.readUInt16LE(end + 4), buf.readUInt16LE(end + 6), buf.readUInt16LE(end + 8), buf.readUInt16LE(end + 20)], [0, 0, count, 0]);
  assert.equal(at + size, end, 'its central directory right before its end record');
  const files = [];
  let p = at;
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'a central entry');
    const [made, needs, flags, method, time, date] = [4, 6, 8, 10, 12, 14].map((k) => buf.readUInt16LE(p + k));
    const crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('latin1', p + 46, p + 46 + nlen);
    assert.deepEqual([made, needs, flags, method, time, date, xlen, clen], [20, 20, 0, 0, 0, 0x21, 0, 0], `${name}: stored, 1980-01-01 00:00`);
    assert.equal(csize, usize, `${name}: stored as it is`);
    p += 46 + nlen + xlen + clen;
    assert.equal(buf.readUInt32LE(local), 0x04034b50, `${name}'s local header`);
    assert.deepEqual([4, 6, 8, 10, 12].map((k) => buf.readUInt16LE(local + k)), [20, 0, 0, 0, 0x21]);
    assert.deepEqual([buf.readUInt32LE(local + 14), buf.readUInt32LE(local + 18), buf.readUInt32LE(local + 22)], [crc, csize, usize]);
    const lnlen = buf.readUInt16LE(local + 26), lxlen = buf.readUInt16LE(local + 28);
    assert.equal(buf.toString('latin1', local + 30, local + 30 + lnlen), name);
    const data = buf.subarray(local + 30 + lnlen + lxlen, local + 30 + lnlen + lxlen + csize);
    assert.equal(F.crc32(data), crc, `${name}'s CRC`);
    files.push({ name, data });
  }
  assert.equal(p, end, 'nothing between its entries and its end');
  return files;
}
// sharp, counting its pictures' looks (smallGlb's own: once a texture, each way it tries; gltf-transform's never call it)
function countingSharp() {
  const n = { stats: 0 };
  const encoder = (input, opts) => {
    const s = sharp(input, opts);
    const stats = s.stats.bind(s);
    s.stats = () => { n.stats += 1; return stats(); };
    return s;
  };
  return { n, encoder };
}
// a model with a big shape (many points: what High detail and more moves make) and a small texture
async function bigShapeGlb(points = 120_000) {
  const doc = await readGlb(await characterGlb({ clips: ['Idle', 'Big_Wave_Hello'], texturePx: 64 }));
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  let x = 99991;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; };
  const pos = new Float32Array(points * 3).map(() => rnd() * 2 - 1);
  const nrm = new Float32Array(points * 3);
  for (let i = 0; i < points; i++) {
    const v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const l = Math.hypot(...v) || 1;
    nrm.set(v.map((c) => c / l), i * 3);
  }
  const uv = new Float32Array(points * 2).map(() => rnd());
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nrm))
    .setAttribute('TEXCOORD_0', acc('VEC2', uv)).setIndices(acc('SCALAR', new Uint32Array(points).map((_, i) => i)))
    .setMaterial(root.listMaterials()[0]);
  root.listScenes()[0].addChild(doc.createNode('Shape').setMesh(doc.createMesh('shape').addPrimitive(prim)));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

test("files: a move described in words merged into the model (onto its bones by name: their turns, moves and scale; its biggest clip), or a clear no", async () => {
  const doc = await readGlb(await characterGlb({ clips: ['Idle', 'Big_Wave_Hello'], texturePx: 0 }));
  const motion = await readGlb(await motionGlb());
  const root = doc.getRoot();
  const before = root.listAccessors().length;
  assert.equal(F.mergeClip(doc, motion, 'own_zoomies'), 2, "its Spine's turn and its Hips' move: a tail the model hasn't got, and a morph's weights, left out");
  assert.deepEqual(root.listAnimations().map((a) => a.getName()), ['Idle', 'Big_Wave_Hello', 'own_zoomies']);
  const clip = root.listAnimations().at(-1);
  assert.deepEqual(clip.listChannels().map((c) => [c.getTargetNode().getName(), c.getTargetPath()]), [['Spine', 'rotation'], ['Hips', 'translation']]);
  assert.equal(clip.listChannels()[0].getTargetNode(), root.listNodes().find((n) => n.getName() === 'Spine'), "the model's own bone");
  assert.equal(clip.listSamplers().length, 2, 'a sampler each (the one its move shared with the tail copied once)');
  assert.equal(root.listAccessors().length, before + 4, "its two samplers' times and values, copied");
  // its keys copied as they are (from its biggest clip: never the one-key rest clip beside it)
  const src = motion.getRoot().listAnimations().find((a) => a.getName() === 'Armature|Motion').listChannels()[0].getSampler();
  const got = clip.listChannels()[0].getSampler();
  assert.deepEqual([...got.getInput().getArray()], [...src.getInput().getArray()]);
  assert.deepEqual([...got.getOutput().getArray()], [...src.getOutput().getArray()]);
  assert.equal(got.getInterpolation(), 'LINEAR');
  assert.equal(got.getInput().getArray().length, 31);
  // written and read back: the same clips
  assert.deepEqual(await clipsIn(Buffer.from(await new NodeIO().writeBinary(doc))), ['Idle', 'Big_Wave_Hello', 'own_zoomies']);
  // a file with no move in it, and one whose bones aren't the model's: a clear no, and nothing left behind
  const still = new Document();
  still.createScene().addChild(still.createNode('Hips'));
  assert.throws(() => F.mergeClip(doc, still, 'own_still'), /its own move "own_still" has no move in its file/);
  const others = await readGlb(await motionGlb({ bones: ['Root', 'Chest'], extra: null }));
  const n = root.listAccessors().length;
  assert.throws(() => F.mergeClip(doc, others, 'own_strange'), /its own move "own_strange" doesn't fit its bones/);
  assert.deepEqual(root.listAnimations().map((a) => a.getName()), ['Idle', 'Big_Wave_Hello', 'own_zoomies'], 'no empty clip left');
  assert.equal(root.listAccessors().length, n, 'nothing of it left');
});

test("files: a model with its moves described in words (own_<name> after its library's); still too big: 512 px, then its shape quantized (straight there when 512 px can't be enough)", async () => {
  const motion = await motionGlb();
  const source = await characterGlb({ clips: ['Idle', 'Big_Wave_Hello'], texturePx: 64 });
  const own = await F.smallGlb(source, { extras: [{ name: 'own_zoomies', bytes: motion }, { name: 'own_curtsy', bytes: motion }] });
  assert.deepEqual(own.clips, ['Idle', 'Big_Wave_Hello', 'own_zoomies', 'own_curtsy']);
  assert.deepEqual([own.size, own.quantized, own.skins], [1024, false, 1]);
  const back = await readGlb(own.bytes);
  assert.deepEqual(back.getRoot().listAnimations().map((a) => a.getName()), own.clips);
  for (const a of back.getRoot().listAnimations().slice(2)) {
    assert.deepEqual(a.listChannels().map((c) => [c.getTargetNode().getName(), c.getTargetPath()]), [['Spine', 'rotation'], ['Hips', 'translation']], a.getName());
  }
  await assert.rejects(F.smallGlb(source, { extras: [{ name: 'own_x', bytes: Buffer.from('not a glb, not at all') }] }), /its own move "own_x" isn't a GLB/);
  await assert.rejects(F.smallGlb(source, { extras: [{ name: 'own_y', bytes: await motionGlb({ bones: ['Root', 'Chest'], extra: null }) }] }),
    /its own move "own_y" doesn't fit its bones/);
  // a big texture: its 1024 px way too big, its 512 px way enough (half-size textures can bring it under)
  const textured = await characterGlb({ clips: ['Idle'], texturePx: 1024 });
  const a = countingSharp();
  const half = await F.smallGlb(textured, { sharp: a.encoder, max: 1_000_000 });
  assert.deepEqual([half.size, half.quantized], [512, false]);
  assert.ok(half.bytes.length <= 1_000_000);
  assert.equal(a.n.stats, 2, 'its 1024 px way, then its 512 px way');
  // a big shape and a small texture: half-size textures can't bring it under, so straight to the quantized way (its 512 px
  // way never made)
  const shape = await bigShapeGlb();
  const b = countingSharp();
  const plain = await F.smallGlb(shape, { sharp: b.encoder, max: 1e9 });
  assert.ok(plain.bytes.length > 3_500_000, `${plain.bytes.length} bytes as it is`);
  const c = countingSharp();
  const q = await F.smallGlb(shape, { sharp: c.encoder, max: 3_500_000 });
  assert.deepEqual([q.size, q.quantized, q.triangles, q.clips], [512, true, 40_004, ['Idle', 'Big_Wave_Hello']]);
  assert.ok(q.bytes.length <= 3_500_000 && q.bytes.length < plain.bytes.length * 0.8, `${q.bytes.length} bytes quantized`);
  assert.equal(c.n.stats, 2, 'its 1024 px way, then straight to the quantized one');
  const qdoc = await readGlb(q.bytes);
  assert.deepEqual(qdoc.getRoot().listExtensionsUsed().map((e) => e.extensionName), ['KHR_mesh_quantization']);
  assert.equal(qdoc.getRoot().listSkins().length, 1, 'its bones kept');
  const tooBig = await F.smallGlb(shape, { max: 1_000_000 }).catch((e) => e);
  assert.equal(tooBig.tooBig, true);
  assert.match(tooBig.message, /still \d+\.\d MB made small \(at most 1\.0\)/);
});

test("files: the full-quality GLB: every move (its own ones merged in), its textures as made, else 2048 px JPEG, then 1024; never over the bucket's 40 MB", async () => {
  assert.equal(F.DL_MAX, 40_000_000);
  const source = await characterGlb({ clips: ['Idle', 'Big_Wave_Hello'], texturePx: 1536 });
  const extras = [{ name: 'own_zoomies', bytes: await motionGlb() }];
  const texOf = async (bytes) => (await readGlb(bytes)).getRoot().listTextures()[0];
  const made = await F.fullGlb(source, { extras });
  assert.deepEqual(made.clips, ['Idle', 'Big_Wave_Hello', 'own_zoomies']);
  const t0 = await texOf(made.bytes);
  assert.equal(t0.getMimeType(), 'image/png');
  assert.ok(Buffer.from(t0.getImage()).equals(pngCache[1536]), 'its texture as made, byte for byte');
  assert.deepEqual(await clipsIn(made.bytes), made.clips);
  // too big as made: a 2048 px JPEG at most (a 1536 px one never enlarged), then 1024 px
  const at2048 = await F.fullGlb(source, { extras, max: made.bytes.length - 1 });
  const t1 = await texOf(at2048.bytes);
  const m1 = await sharp(Buffer.from(t1.getImage())).metadata();
  assert.deepEqual([t1.getMimeType(), m1.format, m1.width, m1.height], ['image/jpeg', 'jpeg', 1536, 1536]);
  assert.deepEqual(at2048.clips, made.clips);
  const at1024 = await F.fullGlb(source, { extras, max: at2048.bytes.length - 1 });
  const m2 = await sharp(Buffer.from((await texOf(at1024.bytes)).getImage())).metadata();
  assert.deepEqual([m2.format, m2.width, m2.height], ['jpeg', 1024, 1024]);
  assert.deepEqual(at1024.clips, made.clips);
  const tooBig = await F.fullGlb(source, { max: 10_000 }).catch((e) => e);
  assert.equal(tooBig.tooBig, true);
  assert.match(tooBig.message, /the full model is \d+\.\d MB \(at most 0\.0\)/);
  await assert.rejects(F.fullGlb(Buffer.from('x'.repeat(100))), /isn't a GLB/);
  await assert.rejects(F.fullGlb(await characterGlb({ clips: [], texturePx: 0 })), /no moves/);
  await assert.rejects(F.fullGlb(source, { extras: [{ name: 'own_z', bytes: Buffer.from('nope, not a model') }] }), /its own move "own_z" isn't a GLB/);
});

test('files: a CRC-32 as zlib makes it; a stored ZIP read back (each file, its CRC, 1980-01-01, the same bytes every time); bad names refused', async () => {
  assert.equal(F.crc32(Buffer.alloc(0)), 0);
  assert.equal(F.crc32(Buffer.from('123456789')), 0xcbf43926, "the check value every CRC-32 is tested with");
  const raw = await noisePng(64);
  for (const b of [raw, Buffer.from('hello'), Buffer.alloc(1000, 0xff)]) assert.equal(F.crc32(b), zlibCrc32(b));
  const entries = [{ name: 'model.obj', bytes: OBJ }, { name: 'texture_base_color.png', bytes: raw }, { name: 'empty.txt', bytes: Buffer.alloc(0) },
    { name: 'a-B_9.x', bytes: Buffer.from('dashes, dots and underscores') }];
  const zip = F.zipStore(entries);
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), entries.map((e) => e.name));
  for (const [i, f] of files.entries()) assert.ok(f.data.equals(Buffer.from(entries[i].bytes)), f.name);
  assert.ok(F.zipStore(entries).equals(zip), 'the same bytes every time (no time of day in it)');
  assert.equal(zip.length, entries.reduce((n, e) => n + 30 + 46 + 2 * e.name.length + Buffer.from(e.bytes).length, 0) + 22, 'stored: nothing added');
  assert.equal(readZip(F.zipStore([])).length, 0, 'an empty ZIP is a ZIP');
  for (const bad of ['', '../x.obj', 'a/b.obj', 'x'.repeat(65), 'naïve.txt', 'a b.txt', 'c:\\x.obj']) {
    assert.throws(() => F.zipStore([{ name: bad, bytes: Buffer.from('x') }]), /zip: a bad file name/, JSON.stringify(bad));
  }
});

test("files: its OBJ zipped (model.obj naming model.mtl; the material's maps named as they are in the zip, their options kept, the ones it hasn't got left out; textures by their own bytes)", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#c08' } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#08c' } }).jpeg().toBuffer();
  const zip = F.objZip({ obj: OBJ, mtl: MTL, textures: { base_color: png, normal: jpg, metallic: Buffer.from('not a picture at all'), emissive: png } });
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['model.obj', 'model.mtl', 'texture_base_color.png', 'texture_normal.jpg']);
  const text = (n) => files.find((f) => f.name === n).data.toString('utf8');
  assert.deepEqual(text('model.obj').split('\n'), ['# made by the 3D service', 'mtllib model.mtl', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'vt 0 0', 'vt 1 0', 'vt 0 1',
    'f 1/1 2/2 3/3', '']);
  assert.deepEqual(text('model.mtl').split('\n'), ['newmtl Material', 'Kd 1 1 1', 'map_Kd texture_base_color.png', 'map_Bump -bm 1 texture_normal.jpg', ''],
    'its specular map and its metal map (not a picture) left out');
  assert.ok(files[2].data.equals(png) && files[3].data.equals(jpg), 'its textures as they are');
  // an OBJ that names no material file gets model.mtl named first; without a material, no material line at all; line ends
  // as Windows writes them are read the same
  const plain = readZip(F.objZip({ obj: Buffer.from('v 0 0 0\r\nf 1 1 1\r\n'), mtl: Buffer.from('newmtl M\r\nmap_Kd t.png\r\n'), textures: { base_color: png } }));
  assert.deepEqual(plain.find((f) => f.name === 'model.obj').data.toString().split('\n'), ['mtllib model.mtl', 'v 0 0 0', 'f 1 1 1', '']);
  assert.deepEqual(plain.find((f) => f.name === 'model.mtl').data.toString().split('\n'), ['newmtl M', 'map_Kd texture_base_color.png', '']);
  const noMtl = readZip(F.objZip({ obj: Buffer.from('mtllib some.mtl\nv 0 0 0\nmtllib other.mtl\n') }));
  assert.deepEqual(noMtl.map((f) => f.name), ['model.obj']);
  assert.deepEqual(noMtl[0].data.toString().split('\n'), ['v 0 0 0', ''], 'no material file to name');
  const twice = readZip(F.objZip({ obj: Buffer.from('mtllib a.mtl\nmtllib b.mtl\nv 0 0 0\n'), mtl: Buffer.from('newmtl M\n') }));
  assert.deepEqual(twice[0].data.toString().split('\n'), ['mtllib model.mtl', 'v 0 0 0', ''], 'model.mtl named once');
  assert.throws(() => F.objZip({ obj: Buffer.alloc(0), mtl: MTL }), /no OBJ/);
  assert.throws(() => F.objZip({}), /no OBJ/);
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

// (2026-10-13, the 3D tool) a move described in words, as Meshy makes it: its rig (the same bones' names) with one clip, and
// a smaller one (the biggest is the one taken), a bone the model hasn't got (left out) and a morph-weights channel (never a
// bone's: left out)
async function motionGlb({ bones = ['Hips', 'Spine'], extra = 'Tail' } = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const nodes = [...bones, extra].filter(Boolean).map((n) => doc.createNode(n));
  for (let i = 1; i < nodes.length; i++) nodes[0].addChild(nodes[i]);
  doc.createScene().addChild(nodes[0]);
  const times = acc('SCALAR', new Float32Array(31).map((_, k) => k / 30));
  const rot = new Float32Array(31 * 4);
  for (let k = 0; k < 31; k++) { const a = Math.sin(k / 5) * 0.4; rot.set([Math.sin(a / 2), 0, 0, Math.cos(a / 2)], k * 4); }
  const pos = new Float32Array(31 * 3).map((_, i) => (i % 3 === 1 ? 0.9 + Math.sin(i / 9) * 0.05 : 0));
  const big = doc.createAnimation('Armature|Motion');
  const sRot = doc.createAnimationSampler().setInput(times).setOutput(acc('VEC4', rot)).setInterpolation('LINEAR');
  const sPos = doc.createAnimationSampler().setInput(times).setOutput(acc('VEC3', pos)).setInterpolation('LINEAR');
  big.addSampler(sRot).addSampler(sPos);
  big.addChannel(doc.createAnimationChannel().setTargetNode(nodes[1]).setTargetPath('rotation').setSampler(sRot));
  big.addChannel(doc.createAnimationChannel().setTargetNode(nodes[0]).setTargetPath('translation').setSampler(sPos));
  if (extra) big.addChannel(doc.createAnimationChannel().setTargetNode(nodes.at(-1)).setTargetPath('rotation').setSampler(sRot));
  big.addChannel(doc.createAnimationChannel().setTargetNode(nodes[1]).setTargetPath('weights').setSampler(sPos));
  const small = doc.createAnimation('Armature|Rest');
  const sOne = doc.createAnimationSampler().setInput(acc('SCALAR', new Float32Array([0]))).setOutput(acc('VEC4', new Float32Array([0, 0, 0, 1])));
  small.addSampler(sOne).addChannel(doc.createAnimationChannel().setTargetNode(nodes[1]).setTargetPath('rotation').setSampler(sOne));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}
// a 3D model of an influencer (AGI Studio), paid in credits and ready to be made, with its choices (influencers.sql inf_3d
// keeps its order so: its influencer, its full-body picture's place, its spec and the formats it asked for, in their order)
const INF = 'InfluencerAbcdefghij01';
const BODY = `inf/${INF}/BodyJobAbcdefghijk0123-0.jpg`;
const MODEL_SPEC = { moves: ['shrug', 'wave', 'backflip'], own: [{ name: 'zoomies', prompt: 'runs in a little circle, arms out', seconds: 3 },
  { name: 'curtsy', prompt: 'a polite curtsy, then a smile' }], detail: 'high', shine: true, pose: 't', height: 182, look: 'a red leather jacket',
formats: ['usdz', 'full', 'obj'] };
function infOrder({ spec = MODEL_SPEC, kind = 'credits', wallet = WALLET, inf = INF } = {}) {
  const id = newOrderId();
  const s = spec === null ? null : R.modelSpec(spec);
  fake.db.orders.set(id, {
    id, wallet_code: studioWallet(SECRET, wallet), burn_code: 'b'.repeat(32), name: 'Nova', about: "Made from Nova's full-body picture in AGI Studio.",
    style: 'realistic', level: 1, usd_cents: 0, agi: 0, free: false, kind, paid: 500, status: 'paid', paid_at: Date.now(), started_at: null, step: null,
    task: null, tasks: {}, tries: 0, error: null, credit: false, glb_bytes: null, pic_bytes: null, moves: null, hidden: false, lease: 0,
    created: Date.now(), updated: Date.now(), done_at: null, inf_id: inf, image_path: `inf/${inf}/BodyJobAbcdefghijk0123-0.jpg`, spec: s,
    formats: s ? s.formats : [],
  });
  return id;
}
// a 3D model's Meshy files: its library moves (Idle and its picks, as the library names its clips), a described move's own
// file, the image task's other formats and its textures (an OBJ naming its material, its material naming its maps)
const OBJ = Buffer.from('# made by the 3D service\nmtllib 0193bfc5.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3\n');
const MTL = Buffer.from('newmtl Material\nKd 1 1 1\nmap_Kd texture_0.png\nmap_Bump -bm 1 texture_0_normal.png\nmap_Ks texture_0_specular.png\nmap_Pm texture_0_metallic.png\n');
async function readyModelFiles() {
  await readyFiles();
  fake.files.glb = await characterGlb({ clips: ['Idle', 'Big_Wave_Hello', 'Shrug', 'Backflip'], texturePx: 512 });
  fake.files.motion = await motionGlb();
  fake.files.byExt = { fbx: Buffer.from('Kaydara FBX Binary  \0 its library moves'), usdz: Buffer.from('PK usdz: its shape, standing still'),
    stl: Buffer.from('solid its shape for printing'), obj: OBJ, mtl: MTL };
  fake.storage.set(BODY, { bytes: fake.files.png, type: 'image/jpeg' });
}
// a 3D model already made: its order done, Meshy's tasks done (image, rig, moves, each described move put on its bones),
// the downloads it asked for waiting (30 days)
function doneModel({ spec = MODEL_SPEC, todo = null } = {}) {
  const id = infOrder({ spec });
  const s = R.modelSpec(spec);
  const tasks = {};
  for (const step of ['image', 'rig', 'moves', ...s.own.map((_, i) => `motion${i + 1}`), ...s.own.map((_, i) => `apply${i + 1}`)]) {
    const tid = `0193bfc5-ee4f-73f8-8525-${String(++fake.meshy.n).padStart(12, '0')}`;
    fake.meshy.tasks.set(tid, { id: tid, step: step.replace(/\d$/, ''), body: {}, status: 'SUCCEEDED', progress: 100, error: '', at: Date.now() });
    tasks[step] = tid;
  }
  const formats = todo ?? s.formats;
  Object.assign(fake.db.orders.get(id), { status: 'done', tasks, glb_bytes: 1000, pic_bytes: 100, moves: R.modelMoveNames(s), done_at: Date.now(),
    formats_todo: [...formats], formats_done: [], formats_failed: [], format_bytes: {}, format_tries: 0, dl_lease: 0, dl_until: Date.now() + 30 * DAY });
  return id;
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
  const order = (from) => fake.db.calls.slice(from).filter((c) => c === 'studio_due' || c === 'studio_dl_due');
  let from = fake.db.calls.length;
  let out = await studioClock(cfg, { now: at30, deadline: Date.now() + 19_000 });
  // (2026-10-13) and a 3D model's extra downloads (none waiting): after the characters on an even minute, with their tidy-up
  // at :30 (nothing past its days)
  assert.deepEqual(out, { due: 3, moved: 3, done: 0, failed: 0, dl: { tidy: 0 }, tidy: { quotes: 0, failed: 0 } });
  assert.deepEqual(order(from), ['studio_due', 'studio_dl_due'], 'on an even minute the characters go first');
  for (const id of ids) assert.equal(fake.db.orders.get(id).step, 'preview');
  from = fake.db.calls.length;
  out = await studioClock(cfg, { now: at30 + 60_000, deadline: Date.now() + 19_000 });
  assert.deepEqual(out, { due: 3, moved: 0, done: 0, failed: 0, dl: {} }, 'still at Meshy: looked at, no tidy-up at :31 (its downloads first: none)');
  assert.deepEqual(order(from), ['studio_dl_due', 'studio_due'], 'on an odd minute the downloads go first');
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

// ---------- (2026-10-13) a 3D model with its choices: the making, and its extra downloads ----------
// the order's current task at Meshy, finished (SUCCEEDED, or how it failed), and its turn free again
function finishOrder(id, status = 'SUCCEEDED', error = '') {
  const t = fake.meshy.tasks.get(fake.db.orders.get(id).task);
  Object.assign(t, { status, progress: status === 'SUCCEEDED' ? 100 : 0, error });
  again(id);
  return t.id;
}
const meshyPosts = () => calls.filter((c) => c.to === 'meshy' && c.method === 'POST');

test("the making: a 3D model's choices: its moves in words first, its shape from its full body (signed), bones at its height, its library moves, each own move on its bones; all of them in its file", async () => {
  await readyModelFiles();
  const cfg = cfgNow();
  const spec = R.modelSpec(MODEL_SPEC);
  const id = infOrder();
  assert.deepEqual(planOf(fake.db.orders.get(id)), ['motion1', 'motion2', 'image', 'rig', 'moves', 'apply1', 'apply2', 'save']);
  let r = await tick(cfg, id);
  assert.deepEqual(r, { state: 'started', step: 'motion1' });
  assert.deepEqual([meshyPosts()[0].path, meshyPosts()[0].body], ['/openapi/v1/text-to-motion',
    { prompt: 'A person does this move: Runs in a little circle, arms out.', mode: 'prime', duration: 3 }]);
  // its page while it's made: where it is in its own plan (its progress bar)
  const view = pageView(cfg, await getOrder(cfg, id));
  assert.deepEqual([view.status, view.step, view.inf, view.plan], ['making', 'motion1', INF, R.modelTimes(spec)]);
  const motion1 = finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'motion2' });
  assert.deepEqual(meshyPosts()[1].body, { prompt: 'A person does this move: A polite curtsy, then a smile.', mode: 'prime', duration: 5 });
  const motion2 = finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'image' });
  const sign = calls.filter((c) => c.to === 'storage' && c.url.includes('/object/sign/'));
  assert.deepEqual(sign.map((c) => c.url), [`${SB}/storage/v1/object/sign/agi1-characters/${BODY}`], 'its full-body picture, signed once');
  const img = meshyPosts()[2];
  assert.equal(img.path, '/openapi/v1/image-to-3d');
  assert.equal(img.body.image_url, `${SB}/storage/v1/object/sign/agi1-characters/${BODY}?token=signed-token`);
  assert.deepEqual([img.body.target_polycount, img.body.geometry_resolution, img.body.enable_pbr, img.body.pose_mode, img.body.texture_prompt, img.body.moderation],
    [40000, '2k', true, 't-pose', meshyLook('a red leather jacket'), true]);
  const image = finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'rig' });
  assert.deepEqual(meshyPosts()[3].body, { input_task_id: image, height_meters: 1.82 });
  const rig = finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'moves' });
  assert.deepEqual(meshyPosts()[4].body, { rig_task_id: rig, action_ids: [0, 28, 317, 452] }, 'idle, then its picks in the library\'s order');
  finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'apply1' });
  assert.deepEqual([meshyPosts()[5].path, meshyPosts()[5].body], ['/openapi/v1/animations', { rig_task_id: rig, motion_task_id: motion1 }]);
  finishOrder(id);
  assert.deepEqual(await tick(cfg, id), { state: 'started', step: 'apply2' });
  assert.deepEqual(meshyPosts()[6].body, { rig_task_id: rig, motion_task_id: motion2 });
  finishOrder(id);
  r = await tick(cfg, id);
  assert.deepEqual(r, { state: 'done' });
  assert.equal(meshyPosts().length, 7, 'seven tasks at Meshy, each once');
  const o = fake.db.orders.get(id);
  assert.deepEqual(o.moves, ['idle', 'wave', 'shrug', 'backflip', 'zoomies', 'curtsy']);
  assert.deepEqual(o.formats_todo, ['full', 'usdz', 'obj']);
  assert.ok(Math.abs(o.dl_until - (Date.now() + 30 * DAY)) < 60_000, 'its extra downloads waited for 30 days');
  assert.deepEqual(await clipsIn(fake.storage.get(`${id}.glb`).bytes), ['Idle', 'Big_Wave_Hello', 'Shrug', 'Backflip', 'own_zoomies', 'own_curtsy']);
  assert.ok(fake.storage.has(`${id}.webp`) && fake.storage.has(`${id}.png`));
  assert.deepEqual(calls.filter((c) => c.fn === 'studio_done').at(-1).args.p_todo, ['full', 'usdz', 'obj']);
  assert.match(log(), /is done: [\d.]+ MB, \d+ triangles, 6 moves, full, usdz, obj to make/);
  assert.deepEqual(pageView(cfg, await getOrder(cfg, id)).moves, o.moves);
  assert.deepEqual(fake.db.backs ?? [], [], 'nothing given back');
  // a model without choices (from before the 3D tool): its plan as before, nothing more to make, no p_todo at all (an
  // older studio.sql never needs it)
  fake.files.glb = await characterGlb({ texturePx: 512 });
  const plain = infOrder({ spec: null });
  assert.deepEqual(planOf(fake.db.orders.get(plain)), ['image', 'rig', 'moves', 'save']);
  for (const step of ['image', 'rig', 'moves']) {
    assert.deepEqual(await tick(cfg, plain), { state: 'started', step });
    finishOrder(plain);
  }
  const posts = meshyPosts().slice(7);
  assert.deepEqual([posts[0].body.target_polycount, posts[0].body.enable_pbr, posts[0].body.pose_mode], [20000, false, 'a-pose']);
  assert.ok(!('geometry_resolution' in posts[0].body) && !('texture_prompt' in posts[0].body));
  assert.equal(posts[1].body.height_meters, 1.7);
  assert.deepEqual(posts[2].body.action_ids, R.modelMoves(null).map((m) => m.action));
  assert.deepEqual(await tick(cfg, plain), { state: 'done' });
  assert.deepEqual(fake.db.orders.get(plain).moves, R.modelMoveNames(null));
  assert.equal('p_todo' in calls.filter((c) => c.fn === 'studio_done').at(-1).args, false);
  assert.deepEqual(fake.db.orders.get(plain).formats_todo, []);
  assert.equal(fake.db.orders.get(plain).dl_until, null);
  // a character from words keeps its own four steps (never a model's)
  const words = await paidOrder();
  assert.deepEqual(planOf(fake.db.orders.get(words)), ['preview', 'refine', 'rig', 'moves', 'save']);
  assert.deepEqual(specOf(fake.db.orders.get(words)), R.MODEL_DEFAULT);
  assert.equal(saveNeeds(fake.db.orders.get(words)), 15_000);
  assert.equal(saveNeeds(fake.db.orders.get(id)), 16_000, 'its own moves read and merged too');
});

test("the making: a move described in words the AI refuses stops it before anything is made: its credits back (once), never for one a burn paid", async () => {
  await readyModelFiles();
  const cfg = cfgNow();
  // its words stopped as it starts (a 403)
  const id = infOrder();
  fake.meshy.fail.push({ status: 403, text: '{"message":"The prompt was flagged by our content moderation"}' });
  assert.deepEqual(await tick(cfg, id), { state: 'failed', step: 'motion1' });
  let o = fake.db.orders.get(id);
  assert.deepEqual([o.status, o.error, o.credit], ['failed', 'refused', false]);
  assert.deepEqual(fake.db.backs, [id], 'its credits back');
  assert.equal(meshyPosts().length, 1, 'nothing else asked of Meshy');
  assert.equal(calls.some((c) => c.to === 'storage'), false, 'its picture never even signed');
  // its move stopped while it's made (its moderation's words)
  const late = infOrder();
  assert.deepEqual(await tick(cfg, late), { state: 'started', step: 'motion1' });
  finishOrder(late, 'FAILED', 'Your prompt was flagged as inappropriate');
  assert.deepEqual(await tick(cfg, late), { state: 'failed', step: 'motion1' });
  o = fake.db.orders.get(late);
  assert.deepEqual([o.status, o.error, o.credit], ['failed', 'refused', false]);
  assert.deepEqual(fake.db.backs, [id, late]);
  // one a big burn paid for (a burn can't be given back): made again, free (its credit), no credits back
  const burnt = infOrder({ kind: 'burn' });
  fake.meshy.fail.push({ status: 403, text: '{"message":"flagged"}' });
  assert.deepEqual(await tick(cfg, burnt), { state: 'failed', step: 'motion1' });
  o = fake.db.orders.get(burnt);
  assert.deepEqual([o.status, o.error, o.credit], ['failed', 'refused', true]);
  assert.deepEqual(fake.db.backs, [id, late], 'never for a burn');
  // a move that keeps failing on its bones: tried again twice (the same motion each time), then given up, its credits back
  const stuck = infOrder();
  const s = R.modelSpec(MODEL_SPEC);
  const tasks = {};
  for (const step of ['motion1', 'motion2', 'image', 'rig', 'moves']) {
    const tid = `0193bfc5-ee4f-73f8-8525-${String(++fake.meshy.n).padStart(12, '0')}`;
    fake.meshy.tasks.set(tid, { id: tid, step: step.replace(/\d$/, ''), body: {}, status: 'SUCCEEDED', progress: 100, error: '', at: Date.now() });
    tasks[step] = tid;
  }
  const first = `0193bfc5-ee4f-73f8-8525-${String(++fake.meshy.n).padStart(12, '0')}`;
  fake.meshy.tasks.set(first, { id: first, step: 'apply', body: {}, status: 'FAILED', progress: 0, error: 'Animation retargeting failed', at: Date.now() });
  Object.assign(fake.db.orders.get(stuck), { status: 'making', step: 'apply1', task: first, tasks, tries: 0, started_at: Date.now() });
  const before = meshyPosts().length;
  for (const tries of [1, 2]) {
    assert.deepEqual(await tick(cfg, stuck), { state: 'started', step: 'apply1' });
    assert.equal(fake.db.orders.get(stuck).tries, tries);
    finishOrder(stuck, 'FAILED', 'Animation retargeting failed');
  }
  assert.deepEqual(await tick(cfg, stuck), { state: 'failed', step: 'apply1' });
  assert.deepEqual(meshyPosts().slice(before).map((c) => c.body), [1, 2].map(() => ({ rig_task_id: tasks.rig, motion_task_id: tasks.motion1 })));
  o = fake.db.orders.get(stuck);
  assert.deepEqual([o.status, o.error, o.credit], ['failed', 'ai:apply1', false]);
  assert.deepEqual(fake.db.backs, [id, late, stuck]);
  assert.match(log(), /apply1 failed at Meshy 3 times \(Animation retargeting failed\): given up/);
  assert.equal(s.own.length, 2);
  // a step that isn't one of its own (its plan has one described move, its order says apply2): never a step past its plan
  const one = infOrder({ spec: { ...MODEL_SPEC, own: [MODEL_SPEC.own[0]] } });
  const odd = `0193bfc5-ee4f-73f8-8525-${String(++fake.meshy.n).padStart(12, '0')}`;
  fake.meshy.tasks.set(odd, { id: odd, step: 'apply', body: {}, status: 'SUCCEEDED', progress: 100, error: '', at: Date.now() });
  Object.assign(fake.db.orders.get(one), { status: 'making', step: 'apply2', task: odd, tasks: {}, tries: 0, started_at: Date.now() });
  assert.deepEqual(await tick(cfg, one), { state: 'failed', step: 'apply2' });
  assert.equal(fake.db.orders.get(one).error, 'ai:apply2');
  assert.match(log(), /apply2 isn't one of its steps \(motion1, image, rig, moves, apply1, save\)/);
});

test('downloads: each format made once the model is done (the full GLB with its own moves, FBX, USDZ, STL, its OBJ zipped), kept 30 days at dl/<id>.<ext>', async () => {
  await readyModelFiles();
  const cfg = cfgNow();
  const id = doneModel();
  assert.deepEqual(DL, { TRIES: 4, LEASE_S: 90, NEEDS_MS: 12_000, TIDY: 20 });
  assert.deepEqual(await dlTick(cfg, id), { state: 'done', format: 'full' });
  const full = fake.storage.get(`dl/${id}.glb`);
  assert.equal(full.type, 'model/gltf-binary');
  assert.deepEqual(await clipsIn(full.bytes), ['Idle', 'Big_Wave_Hello', 'Shrug', 'Backflip', 'own_zoomies', 'own_curtsy']);
  let o = fake.db.orders.get(id);
  assert.deepEqual([o.formats_todo, o.formats_done, o.format_bytes], [['usdz', 'obj'], ['full'], { full: full.bytes.length }]);
  assert.match(log(), new RegExp(`${id}'s full is ready: [\\d.]+ MB`));
  assert.deepEqual(await dlTick(cfg, id), { state: 'done', format: 'usdz' });
  assert.deepEqual([fake.storage.get(`dl/${id}.usdz`).type, fake.storage.get(`dl/${id}.usdz`).bytes], ['model/vnd.usdz+zip', fake.files.byExt.usdz]);
  assert.deepEqual(await dlTick(cfg, id), { state: 'done', format: 'obj' });
  const zip = fake.storage.get(`dl/${id}.zip`);
  assert.equal(zip.type, 'application/zip');
  const files = readZip(zip.bytes);
  assert.deepEqual(files.map((f) => f.name), ['model.obj', 'model.mtl', 'texture_base_color.png', 'texture_normal.png']);
  assert.match(files[0].data.toString(), /^# made by the 3D service\nmtllib model\.mtl\n/);
  assert.deepEqual(files[1].data.toString().split('\n'), ['newmtl Material', 'Kd 1 1 1', 'map_Kd texture_base_color.png', 'map_Bump -bm 1 texture_normal.png', '']);
  assert.ok(files[2].data.equals(fake.files.png));
  o = fake.db.orders.get(id);
  assert.deepEqual([o.formats_todo, o.formats_done, Object.keys(o.format_bytes)], [[], ['full', 'usdz', 'obj'], ['full', 'usdz', 'obj']]);
  assert.deepEqual(await dlTick(cfg, id), { state: 'busy' }, 'nothing more to make');
  // the moves' FBX and its shape's STL
  const two = doneModel({ todo: ['fbx', 'stl'] });
  assert.deepEqual(await dlTick(cfg, two), { state: 'done', format: 'fbx' });
  assert.deepEqual(await dlTick(cfg, two), { state: 'done', format: 'stl' });
  assert.deepEqual([fake.storage.get(`dl/${two}.fbx`).bytes, fake.storage.get(`dl/${two}.fbx`).type], [fake.files.byExt.fbx, 'application/octet-stream']);
  assert.deepEqual([fake.storage.get(`dl/${two}.stl`).bytes, fake.storage.get(`dl/${two}.stl`).type], [fake.files.byExt.stl, 'model/stl']);
  const reads = calls.filter((c) => c.to === 'files').map((c) => new URL(c.url).pathname.split('/').pop());
  assert.ok(reads.includes('animations.fbx') && reads.includes('model.stl') && reads.includes('model.usdz'), reads.join(' '));
  assert.ok(calls.filter((c) => c.to === 'files').every((c) => c.redirect === 'error'), "only Meshy's addresses, never a redirect");
  // someone else's turn on it (another run): not touched
  const busy = doneModel({ todo: ['usdz'] });
  fake.db.orders.get(busy).dl_lease = Date.now() + 60_000;
  assert.deepEqual(await dlTick(cfg, busy), { state: 'busy' });
});

test("downloads: Meshy away for a moment isn't a try; a hiccup is tried again (4 in all); a file Meshy let go of, too big, or a task that isn't done: given up at once", async () => {
  await readyModelFiles();
  const cfg = cfgNow();
  // Meshy itself away: waiting (no try counted; its turn ends by itself)
  const waits = doneModel({ todo: ['usdz'] });
  fake.meshy.getFail = { status: 503, text: 'busy' };
  assert.deepEqual(await dlTick(cfg, waits), { state: 'waiting', format: 'usdz' });
  let o = fake.db.orders.get(waits);
  assert.deepEqual([o.format_tries, o.formats_todo, o.formats_failed], [0, ['usdz'], []]);
  assert.deepEqual(await dlTick(cfg, waits), { state: 'busy' }, 'its turn still on');
  fake.meshy.getFail = null;
  o.dl_lease = 0;
  // Storage away: tried again, 4 times in all, then given up
  fake.storageDown = true;
  for (const tries of [1, 2, 3]) {
    assert.deepEqual(await dlTick(cfg, waits), { state: 'again', format: 'usdz' });
    assert.equal(o.format_tries, tries);
    assert.ok(o.dl_lease > Date.now() + 100_000, 'two minutes before the next try');
    o.dl_lease = 0;
  }
  assert.deepEqual(await dlTick(cfg, waits), { state: 'failed', format: 'usdz' });
  assert.deepEqual([o.formats_todo, o.formats_failed, o.format_tries], [[], ['usdz'], 0]);
  assert.match(log(), /usdz failed \(trying again\): storage HTTP 500/);
  assert.match(log(), /usdz couldn't be made: storage HTTP 500/);
  fake.storageDown = false;
  // a file Meshy let go of: given up at once
  const gone = doneModel({ todo: ['stl', 'usdz'] });
  fake.files.gone = ['/model.stl'];
  assert.deepEqual(await dlTick(cfg, gone), { state: 'failed', format: 'stl' });
  assert.deepEqual(fake.db.orders.get(gone).formats_failed, ['stl']);
  assert.deepEqual(await dlTick(cfg, gone), { state: 'done', format: 'usdz' }, 'the next one made as usual');
  fake.files.gone = [];
  // too big for the bucket: given up at once
  const big = doneModel({ todo: ['fbx'] });
  assert.deepEqual(await dlTick(cfg, big, { files: { ...F, DL_MAX: 10 } }), { state: 'failed', format: 'fbx' });
  assert.match(log(), /fbx couldn't be made: files: Meshy's file is too big \(over 10 bytes\)/);
  // a task Meshy didn't finish: given up at once
  const undone = doneModel({ todo: ['usdz'] });
  fake.meshy.tasks.get(fake.db.orders.get(undone).tasks.image).status = 'FAILED';
  assert.deepEqual(await dlTick(cfg, undone), { state: 'failed', format: 'usdz' });
  assert.match(log(), /usdz couldn't be made: Meshy's answer has no image result/);
  // no time left to keep it: a try, never final
  const late = doneModel({ todo: ['usdz'] });
  assert.deepEqual(await dlTick(cfg, late, { deadline: Date.now() + 1400 }), { state: 'again', format: 'usdz' });
  assert.equal(fake.db.orders.get(late).format_tries, 1);
  assert.equal(fake.storage.has(`dl/${late}.usdz`), false);
  // hidden (or its days over) while it's made: no longer waited for, so its file goes again
  const hidden = doneModel({ todo: ['usdz'] });
  const files = { ...F, putFile: async (...a) => { fake.db.orders.get(hidden).hidden = true; return F.putFile(...a); } };
  assert.deepEqual(await dlTick(cfg, hidden, { files }), { state: 'none', format: 'usdz' });
  assert.equal(fake.storage.has(`dl/${hidden}.usdz`), false, 'its file deleted again');
  assert.ok(calls.some((c) => c.to === 'storage' && c.method === 'DELETE' && c.body.prefixes.includes(`dl/${hidden}.usdz`)));
  // not done, not its own, or nothing asked for: nothing made
  const making = infOrder();
  assert.deepEqual(await dlTick(cfg, making), { state: 'busy' });
  assert.deepEqual(await dlTick(cfg, 'NoSuchOrderAbcdefghij0'), { state: 'busy' });
});

test("downloads: the tidy-up (past their days, or its model taken down): their files deleted, its lists cleared; the clock's turn (only with time for it; the tidy-up at :00 and :30)", async () => {
  await readyModelFiles();
  const cfg = cfgNow();
  const old = doneModel({ todo: ['usdz'] });
  assert.deepEqual(await dlTick(cfg, old), { state: 'done', format: 'usdz' });
  fake.db.orders.get(old).dl_until = Date.now() - 1000;
  const down = doneModel({ todo: ['stl'] });
  fake.db.orders.get(down).hidden = true;
  const fresh = doneModel({ todo: ['fbx'] });
  const from = calls.length;
  assert.equal(await dlTidy(cfg), 2);
  const deletes = calls.slice(from).filter((c) => c.to === 'storage' && c.method === 'DELETE').map((c) => c.body.prefixes);
  assert.deepEqual(deletes, [old, down].map((x) => ['glb', 'fbx', 'usdz', 'stl', 'zip'].map((e) => `dl/${x}.${e}`)));
  assert.equal(fake.storage.has(`dl/${old}.usdz`), false);
  for (const x of [old, down]) {
    const o = fake.db.orders.get(x);
    assert.deepEqual([o.formats_todo, o.formats_done, o.format_bytes], [[], [], {}], x);
  }
  assert.deepEqual(fake.db.orders.get(fresh).formats_todo, ['fbx'], 'one within its days untouched');
  assert.equal(await dlTidy(cfg), 0, 'nothing left to tidy');
  // Storage away: tried at the next tidy-up (its lists kept)
  const later = doneModel({ todo: ['usdz'] });
  fake.db.orders.get(later).dl_until = Date.now() - 1;
  fake.storageDown = true;
  assert.equal(await dlTidy(cfg), 0);
  assert.deepEqual(fake.db.orders.get(later).formats_todo, ['usdz']);
  assert.match(log(), new RegExp(`${later}'s extra downloads \\(next tidy-up\\): storage HTTP 500`));
  fake.storageDown = false;
  assert.equal(await dlTidy(cfg), 1);
  // the clock's turn: one download made when there's time (12 s), the tidy-up at :00 and :30 (with 3 s left)
  const at31 = Date.UTC(2026, 9, 13, 12, 31), at30 = Date.UTC(2026, 9, 13, 12, 30);
  assert.deepEqual(await dlClock(cfg, { now: at31, deadline: Date.now() + 19_000 }), { made: { state: 'done', format: 'fbx' } });
  const due = fake.db.calls.filter((c) => c === 'studio_dl_due').length;
  assert.deepEqual(await dlClock(cfg, { now: at31, deadline: Date.now() + 5_000 }), {});
  assert.equal(fake.db.calls.filter((c) => c === 'studio_dl_due').length, due, 'not even asked without time to make one');
  assert.deepEqual(await dlClock(cfg, { now: at30, deadline: Date.now() + 5_000 }), { tidy: 0 });
  assert.deepEqual(await dlClock(cfg, { now: at30, deadline: Date.now() + 2_000 }), {});
  assert.deepEqual(await dlClock(cfg, { now: at31, deadline: Date.now() + 19_000 }), {}, 'none waiting');
  // the studio clock's turn for them: studio.sql from before the 3D tool (said once), the database away (said each time)
  fake.missing.add('studio_dl_due');
  const n0 = logs.filter((l) => /the extra downloads/.test(l)).length;
  for (const now of [at31, at30 + 2 * 60_000]) {
    const out = await studioClock(cfg, { now, deadline: Date.now() + 19_000 });
    assert.deepEqual(out.dl, { error: 'not_set_up' });
  }
  assert.equal(logs.filter((l) => /the extra downloads/.test(l)).length - n0, 1, 'said once');
  fake.missing.delete('studio_dl_due');
  fake.db.studio_dl_due = () => { throw new Error('the database went away'); };
  assert.deepEqual((await studioClock(cfg, { now: at31, deadline: Date.now() + 19_000 })).dl, { error: 'database' });
  assert.equal(logs.filter((l) => /the extra downloads/.test(l)).length - n0, 2);
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
  // (round 4) when its making started (else when it was paid), and our server's clock: its progress bar counts from them
  assert.ok(Number.isFinite(r.body.character.started) && r.body.character.started <= Date.now());
  assert.ok(Math.abs(r.body.now - Date.now()) < 5000);
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
  const at30 = new Date().getUTCMinutes() % 30 === 0;
  // (2026-10-13) with a 3D model's extra downloads' turn: none waiting (their tidy-up with the characters')
  assert.deepEqual(await res.json(), { ok: true, due: 0, moved: 0, done: 0, failed: 0, dl: at30 ? { tidy: 0 } : {},
    ...(at30 ? { tidy: { quotes: 0, failed: 0 } } : {}) });
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
  assert.match(sql, /'studio_dl_clear'\)\) = 37\n/, 'studio_ready counts its 37 functions (20 for characters, 12 for their videos: tests/videos.test.js; 5 for a 3D model\'s downloads)');
  // (2026-10-13) a 3D model's more downloads: made by the clock, kept DL_DAYS days, tidied; only our server's key
  for (const [fn, args] of [['studio_dl_due', 'integer'], ['studio_dl_lease', 'text, integer'], ['studio_dl_put', 'text, text, boolean, integer, boolean'],
    ['studio_dl_expired', 'integer'], ['studio_dl_clear', 'text']]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
    assert.ok(sql.includes(`revoke all on function public.${fn}(${args}) from public, anon, authenticated;`), `${fn}: never the browser's keys`);
    assert.ok(sql.includes(`grant execute on function public.${fn}(${args}) to service_role;`), fn);
  }
  const steps = "('motion1', 'motion2', 'image', 'preview', 'refine', 'rig', 'moves', 'apply1', 'apply2', 'save')";
  assert.ok(sql.includes(`check (step in ${steps})`) && sql.includes(`p_step not in ${steps}`), "a model's described moves are its own steps (the table and studio_step)");
  for (const t of ['agi1_studio_state', 'agi1_studio_orders', 'agi1_studio_months', 'agi1_studio_free', 'agi1_studio_txs']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`), t);
  }
  assert.match(sql, /insert into agi1_burn_txs \(tx_code\) values \(p_tx\)/, "a burn for a character goes in burns.sql's ledger");
  assert.match(sql, /'agi1-characters', 'agi1-characters', false, 41943040,\s+array\['model\/gltf-binary', 'image\/webp', 'image\/png', 'image\/jpeg', 'video\/mp4', 'application\/octet-stream',\s+'model\/vnd\.usdz\+zip', 'model\/stl', 'application\/zip'\]/,
    'a private bucket, 40 MB a file (a video), only its 3D model, its pictures and its videos (and since AGI Studio, 2026-10-10, JPEG pictures and the parts of a clip being uploaded; since the 3D tool, 2026-10-13, its USDZ, STL and zipped OBJ downloads)');
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

test("(2026-10-13) its 3D view's tools: its moves of its own by their clips' names (own_<name>), the zoom's aim (its middle at 1×, its face at 3×, never the air above a jump), a light rig for each light", () => {
  const clip = (name) => new THREE.AnimationClip(name, 1, []);
  const byName = (m) => [...m].map(([k, c]) => `${k}=${c.name}`);
  // a model with moves of its own: its file's clips named own_<its name> (server/studio.js), found by name in any order
  const moves = ['idle', 'wave', 'shrug', 'zoomies', 'curtsy'];
  assert.equal(R.ownClip('zoomies'), 'own_zoomies');
  let m = clipsFor([clip('own_curtsy'), clip('Idle'), clip('Armature|own_zoomies'), clip('Big_Wave_Hello'), clip(R.MOVE_BY_NAME.get('shrug').clip)], moves);
  assert.deepEqual(byName(m).sort(), ['curtsy=own_curtsy', 'idle=Idle', 'shrug=' + R.MOVE_BY_NAME.get('shrug').clip, 'wave=Big_Wave_Hello', 'zoomies=Armature|own_zoomies'].sort());
  // a clip of its own it wasn't asked for (or one we don't know): all of them in the order asked for
  m = clipsFor([clip('Idle'), clip('Big_Wave_Hello'), clip('own_salute')], ['idle', 'wave', 'zoomies']);
  assert.deepEqual(byName(m), ['idle=Idle', 'wave=Big_Wave_Hello', 'zoomies=own_salute']);
  // a clip of its own named after a library move (never made: a move of its own never has a library word as its name) isn't
  // known by name: all of them in the order asked for
  m = clipsFor([clip('own_wave'), clip('Idle')], ['idle', 'wave']);
  assert.deepEqual(byName(m), ['idle=own_wave', 'wave=Idle']);
  // where the camera looks at a zoom (y): the middle of every pose's box at 1× (as before), its face at 3×, in between
  // between; never past its limits (a zoom out of range, or none, is 1× or 3×)
  const box = new THREE.Box3(new THREE.Vector3(-0.4, 0, -0.3), new THREE.Vector3(0.4, 2.05, 0.3));    // a jump's top at 2.05 m
  const rest = new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.2), new THREE.Vector3(0.3, 1.7, 0.2));     // standing: 1.7 m
  const face = 1.7 - 1.7 * HEAD;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(aimFor(box, rest, 1), 1.025), String(aimFor(box, rest, 1)));
  assert.ok(near(aimFor(box, rest, 3), face) && face < 1.7 && face > 1.4, String(aimFor(box, rest, 3)));
  assert.ok(near(aimFor(box, rest, 2), (1.025 + face) / 2));
  for (const [z, want] of [[0.5, 1.025], [9, face], [NaN, 1.025], [undefined, 1.025], ['2', (1.025 + face) / 2]]) assert.ok(near(aimFor(box, rest, z), want), String(z));
  assert.ok(aimFor(box, rest, 3) < rest.max.y, 'never the air above its head standing');
  // at 1× the camera is where it always was: its box's middle, a little from above (the page's own place())
  const { distance, center } = framing(box, 0.8);
  const front = new THREE.Vector3(0, 0.08, 1).normalize();
  const cam = new THREE.Vector3(center.x, aimFor(box, rest, 1), center.z).addScaledVector(front, distance * Math.hypot(1, 0.08));
  assert.ok(cam.distanceTo(new THREE.Vector3(center.x, center.y + distance * 0.08, center.z + distance)) < 1e-9);
  // its lights: a rig for each of the page's lights (and no other), each whole; Studio is the light it always had
  assert.deepEqual(Object.keys(RIGS).sort(), Object.keys(ST.LIGHTS).sort());
  assert.ok(Object.hasOwn(RIGS, ST.LIGHT_DEFAULT));
  for (const [k, r] of Object.entries(RIGS)) {
    assert.ok(r.env > 0 && r.env <= 1.5, k);
    assert.ok(r.hemi.length === 3 && r.hemi.slice(0, 2).every((c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff) && r.hemi[2] > 0, k);
    assert.ok(r.sun.length === 3 && Number.isInteger(r.sun[0]) && r.sun[1] > 0 && r.sun[2].length === 3 && r.sun[2][1] > 0, `${k}: a sun from above`);
    assert.ok(r.rims.length === 2 && r.rims.every(([s, c]) => s >= 0 && s <= 5 && Number.isInteger(c)), k);
  }
  assert.deepEqual(RIGS.studio, { env: 0.75, hemi: [0xffffff, 0x3a2a5a, 0.9], sun: [0xffffff, 1.6, [1.2, 3, 2.4]], rims: [[0, 0xffffff], [0, 0xffffff]] });
  // its tools' code: its light only from its rigs, its looks only the page's, its speeds only the page's, its zoom kept in
  // its limits, its pictures' pixels never past MAX_RATIO; nothing sent anywhere (no fetch but its own file's loader)
  const code = readFileSync(new URL('../src/studio/viewer.js', import.meta.url), 'utf8');
  assert.match(code, /if \(!r \|\| !Object\.hasOwn\(LIGHTS, key\)\) return false;/);
  assert.match(code, /if \(!Object\.hasOwn\(LOOKS, key\)\) return false;/);
  assert.match(code, /if \(!SPEEDS\.includes\(Number\(s\)\)\) return false;/);
  assert.match(code, /zoom = Math\.min\(ZOOM\.MAX, Math\.max\(ZOOM\.MIN, Number\(z\) \|\| ZOOM\.MIN\)\);/);
  assert.match(code, /renderer\.setPixelRatio\(ratioFor\(w, h, long, own\)\);/);
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  // a wireframe over its own surface written to depth only (only the lines facing the camera show), made the first time
  assert.match(code, /new THREE\.MeshBasicMaterial\(\{ colorWrite: false, polygonOffset: true/);
  assert.match(code, /if \(o\.isSkinnedMesh\) p\.bind\(o\.skeleton, o\.bindMatrix\);/);
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
  assert.match(view, /const list = c\.inf \? modelStepList\(c\.plan\) : STEPS;/);
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
  for (const f of ['studio.html', 'src/studio/app.js', 'src/studio/app-words.js', 'src/studio/rules.js', 'src/studio/viewer.js', 'src/studio/views/model3d.js',
    'src/studio/views/model-tool.js', 'src/studio/stage-tools.js']) {
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
