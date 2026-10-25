// AGI-1's 3D character studio: its characters' videos (2026-10-10, the owner's next big plan, item 4: "they can create a
// viral content with it using seedance 2.5 api but they gonna pay crypto like stables instead of $agi if they hold agi they
// get a discount"; the owner's choice: about $4 in USDG for a 5-second 720p clip, before holder discounts).
// src/studio/rules.js and words.js (its parts), server/studio-words.js (a scene, and what the video service gets),
// server/fal.js (fal.ai's queue), server/studio-files.js (its file: from fal's media, into the bucket, a signed address),
// server/studio-video.js, server/studio-api.js and api/launch.js (its routes), api/feed.js ?studio (its clock), its page,
// supabase/studio.sql's promises. With fake fal.ai, Supabase (studio.sql's rules for videos in JavaScript: the SQL itself
// ran in PGlite) and its Storage, Robinhood Chain, the block explorer and Cloudflare.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as R from '../src/studio/rules.js';
import { checkScene, videoPrompt } from '../server/studio-words.js';
import { FAL_QUEUE, VIDEO_MODEL, falSubmit, falStatus, falResult, scrub, refusedText } from '../server/fal.js';
import * as F from '../server/studio-files.js';
import { USDG, _resetStudioChain } from '../server/studio-chain.js';
import { studioWallet, payCode, monthLeft, _resetStudioKey } from '../server/studio.js';
import {
  VIDEO, videosOn, videoView, charVideos, videoQuote, checkVideoPayment, videoRedo, videoTick, videoClock, videoFile, falInput,
} from '../server/studio-video.js';
import { studioLookBurst, studioFileBurst, studioActBurst, studioPost } from '../server/studio-api.js';
import { getConfig, falModel } from '../server/config.js';
import { makeSession } from '../server/session.js';
import { _resetBurnKey } from '../server/burn.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';
import { GET as launchGet, POST as launchPost } from '../api/launch.js';
import { GET as feedGet } from '../api/feed.js';

const DAY = 864e5;
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const STUDIO_KEY = 'ab12cd34'.repeat(8);
const BURN_KEY = 'f00dfeed'.repeat(8);
const FAL_KEY = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d:0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const OWNER = '0x1111111111111111111111111111111111111111';      // STUDIO_PAY_TO: the owner's wallet
const WALLET = '0x8ba1f109551bd432803012645ac136ddd64dba72';     // the wallet that made the character
const OTHER = '0x2222222222222222222222222222222222222222';
const SB = 'https://fake.supabase.co';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MODEL = 'bytedance/seedance-2.5/reference-to-video';
const CHAR = 'charMochi0000000000001';                           // WALLET's done character
const CHAR2 = 'charOther0000000000002';                          // OTHER's
const ENV = {
  SUPABASE_URL: SB, SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: SECRET, TURNSTILE_SECRET_KEY: 'turnstile-secret-for-tests',
  MESHY_API_KEY: 'msy_testkey1234567890abcdefghijklmnop', STUDIO_PAY_TO: OWNER, STUDIO_OPEN: 'yes', FAL_KEY,
};
const SETTINGS = ['MESHY_API_KEY', 'STUDIO_PAY_TO', 'STUDIO_PRICE_USD', 'STUDIO_PRICE_AGI', 'STUDIO_A_MONTH', 'STUDIO_BURNS_A_MONTH', 'STUDIO_OPEN',
  'STUDIO_ONLY_FOR', 'STUDIO_HIDE', 'ROBINHOOD_RPC_URL', 'SITE_URL', 'CRON_SECRET', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'PINATA_JWT',
  'LAUNCH_GAS_KEY', 'LIVE_SECRET', 'PRIZE_WALLET_KEY', 'TELEGRAM_GROUPS', 'FAL_KEY', 'STUDIO_VIDEO_PRICE_USD', 'STUDIO_VIDEOS_A_MONTH', 'STUDIO_VIDEO_MODEL'];
const IP = '203.0.113.7';
const SCENE = 'dancing on a neon rooftop in the rain, the city glowing behind it';
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(30_000, 7)]);
const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
const topic = (a) => `0x${'0'.repeat(24)}${a.slice(2).toLowerCase()}`;
const txOf = (n) => `0x${pad(n)}`;
const sessionFor = (wallet = WALLET, level = 1) => makeSession(SECRET, { wallet, level, checkedAt: Date.now(), expiresAt: Date.now() + 7 * DAY });

// ---------- the database: studio.sql's rules for videos, in JavaScript ----------
function database() {
  const now = () => Date.now();
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  const QUEUE = /^https:\/\/queue\.fal\.run\/[A-Za-z0-9._/-]{1,240}$/;
  const SHAPE = ['tall', 'wide', 'square'];
  const len = (s) => [...s].length;
  return {
    orders: new Map(), videos: new Map(), month: { made: 0, burns: 0, videos: 0 }, txs: new Map(),
    live() { return [...this.videos.values()].filter((v) => v.status === 'quote' && v.created > now() - DAY); },
    expired(v) { return v.status === 'quote' && v.paid === 0 && v.created < now() - DAY; },
    burn_key() { return BURN_KEY; },
    burn_status() { return { left: 0, bought: 0, agi: 0, today: 0 }; },
    studio_key() { return STUDIO_KEY; },
    studio_due() { return []; },
    studio_tidy() { return { quotes: 0, failed: 0, video_quotes: 0, video_failed: 0 }; },
    studio_get({ p_id }) {
      const o = this.orders.get(p_id);
      return o ? { ...o, created_at: iso(o.created), done_at: iso(o.done), expired: false } : null;
    },
    studio_month() {
      return { made: this.month.made, burns: this.month.burns, live: 0, burn_live: 0, videos: this.month.videos, video_live: this.live().length };
    },
    studio_seen({ p_txs }) {
      if (!Array.isArray(p_txs) || p_txs.length > 50) return [];
      return [...new Set(p_txs.filter((c) => this.txs.has(c)))].sort();
    },
    studio_video_quote(a) {
      if (typeof a.p_id !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(a.p_id) || !a.p_char || !(a.p_wallet?.length >= 16 && a.p_wallet.length <= 64)
        || typeof a.p_scene !== 'string' || len(a.p_scene) < 10 || len(a.p_scene) > 300 || !SHAPE.includes(a.p_shape) || typeof a.p_sound !== 'boolean'
        || ![1, 2, 3].includes(a.p_level) || !(Number.isInteger(a.p_usd_cents) && a.p_usd_cents >= 1 && a.p_usd_cents <= 1e6)
        || !(a.p_cap >= 1 && a.p_cap <= 100_000) || !(a.p_per_wallet >= 1 && a.p_per_wallet <= 100)) return { ok: false, why: 'bad' };
      const o = this.orders.get(a.p_char);
      if (!o || o.status !== 'done' || o.hidden) return { ok: false, why: 'no_char' };
      if (o.wallet_code !== a.p_wallet) return { ok: false, why: 'not_yours' };
      const live = this.live();
      if (live.filter((v) => v.wallet_code === a.p_wallet && v.paid === 0).length >= a.p_per_wallet) return { ok: false, why: 'too_many' };
      if (this.month.videos + live.length >= a.p_cap) return { ok: false, why: 'sold_out' };
      if (this.videos.has(a.p_id)) return { ok: false, why: 'taken' };
      this.videos.set(a.p_id, {
        id: a.p_id, char_id: a.p_char, wallet_code: a.p_wallet, scene: a.p_scene, shape: a.p_shape, sound: a.p_sound, level: a.p_level,
        usd_cents: a.p_usd_cents, paid: 0, status: 'quote', paid_at: null, started_at: null, req: null, status_url: null, result_url: null,
        saving: false, tries: 0, error: null, credit: false, bytes: null, hidden: false, lease: 0, created: now(), updated: now(), done: null,
      });
      return { ok: true, id: a.p_id, left: a.p_cap - this.month.videos - live.length - 1 };
    },
    studio_video_pay({ p_id, p_wallet, p_tx, p_amount }) {
      if (!p_id || !p_wallet || typeof p_tx !== 'string' || p_tx.length < 16 || p_tx.length > 64 || !Number.isInteger(p_amount) || p_amount <= 0
        || p_amount > 1e7) return { ok: false, why: 'bad' };
      const v = this.videos.get(p_id);
      if (!v) return { ok: false, why: 'gone' };
      if (v.wallet_code !== p_wallet) return { ok: false, why: 'not_yours' };
      if (v.status !== 'quote') return { ok: false, why: 'done' };
      if (v.paid === 0 && v.created < now() - DAY) return { ok: false, why: 'gone' };
      if (this.txs.has(p_tx)) return { ok: false, why: 'used' };
      this.txs.set(p_tx, { kind: 'usdg', order: p_id });
      const have = v.paid + p_amount;
      Object.assign(v, { paid: have, updated: now() });
      if (have >= v.usd_cents) {
        Object.assign(v, { status: 'paid', paid_at: now() });
        this.month.videos += 1;
        return { ok: true, paid: true, have, need: v.usd_cents };
      }
      return { ok: true, paid: false, have, need: v.usd_cents };
    },
    studio_video_get({ p_id }) {
      const v = this.videos.get(p_id);
      if (!v) return null;
      const o = this.orders.get(v.char_id);
      const { lease, created, updated, done, ...row } = v;
      return { ...row, paid_at: iso(v.paid_at), started_at: iso(v.started_at), created_at: iso(created), updated_at: iso(updated), done_at: iso(done),
        expired: this.expired(v), char_name: o.name, char_style: o.style, char_status: o.status, char_hidden: o.hidden };
    },
    studio_video_lease({ p_id, p_secs }) {
      const v = this.videos.get(p_id);
      if (!(p_secs >= 5 && p_secs <= 300) || !v || !['paid', 'making'].includes(v.status) || v.lease > now()) return false;
      v.lease = now() + p_secs * 1000;
      return true;
    },
    studio_video_step({ p_id, p_req, p_status_url, p_result_url, p_saving, p_tries }) {
      if ((p_req !== null && !/^[A-Za-z0-9_-]{6,80}$/.test(p_req)) || (p_status_url !== null && !QUEUE.test(p_status_url))
        || (p_result_url !== null && !QUEUE.test(p_result_url)) || typeof p_saving !== 'boolean' || !(Number.isInteger(p_tries) && p_tries >= 0 && p_tries <= 20)) {
        return false;
      }
      const v = this.videos.get(p_id);
      if (!v || !['paid', 'making'].includes(v.status)) return false;
      if (v.status === 'paid') v.started_at = now();
      Object.assign(v, { status: 'making', req: p_req, status_url: p_status_url, result_url: p_result_url, saving: p_saving, tries: p_tries, lease: 0, updated: now() });
      return true;
    },
    studio_video_wait({ p_id }) {
      const v = this.videos.get(p_id);
      if (!v || !['paid', 'making'].includes(v.status)) return null;
      v.lease = now() + 3000;
      return true;
    },
    studio_video_done({ p_id, p_bytes }) {
      if (!(Number.isInteger(p_bytes) && p_bytes >= 1 && p_bytes <= 1e8)) return false;
      const v = this.videos.get(p_id);
      if (!v || !['paid', 'making'].includes(v.status)) return false;
      Object.assign(v, { status: 'done', bytes: p_bytes, saving: false, status_url: null, result_url: null, lease: 0, credit: false, error: null, done: now(), updated: now() });
      return true;
    },
    studio_video_fail({ p_id, p_error, p_credit }) {
      const v = this.videos.get(p_id);
      if (!v || !['paid', 'making'].includes(v.status)) return false;
      Object.assign(v, { status: 'failed', error: String(p_error ?? 'failed').slice(0, 200), credit: p_credit === true, saving: false, lease: 0, updated: now() });
      return true;
    },
    studio_video_redo({ p_id, p_wallet, p_scene, p_shape, p_sound }) {
      if (typeof p_scene !== 'string' || len(p_scene) < 10 || len(p_scene) > 300 || !SHAPE.includes(p_shape) || typeof p_sound !== 'boolean') return { ok: false, why: 'bad' };
      const v = this.videos.get(p_id);
      if (!v) return { ok: false, why: 'gone' };
      if (v.wallet_code !== p_wallet) return { ok: false, why: 'not_yours' };
      if (v.status !== 'failed' || !v.credit || v.updated < now() - 30 * DAY) return { ok: false, why: 'no_credit' };
      const o = this.orders.get(v.char_id);
      if (!o || o.status !== 'done' || o.hidden) return { ok: false, why: 'no_char' };
      Object.assign(v, { scene: p_scene, shape: p_shape, sound: p_sound, status: 'paid', req: null, status_url: null, result_url: null, saving: false,
        tries: 0, error: null, credit: false, started_at: null, lease: 0, updated: now() });
      return { ok: true };
    },
    studio_video_due({ p_limit }) {
      return [...this.videos.values()].filter((v) => ['paid', 'making'].includes(v.status) && v.lease <= now()).sort((a, b) => a.updated - b.updated)
        .slice(0, Math.min(Math.max(p_limit ?? 4, 1), 50)).map((v) => v.id);
    },
    studio_video_list({ p_char, p_wallet, p_limit }) {
      const o = this.orders.get(p_char);
      if (!o || o.hidden) return [];
      return [...this.videos.values()]
        .filter((v) => v.char_id === p_char && ((v.status === 'done' && !v.hidden) || (p_wallet && v.wallet_code === p_wallet && v.status !== 'done' && !this.expired(v))))
        .sort((a, b) => (b.done ?? b.created) - (a.done ?? a.created)).slice(0, Math.min(Math.max(p_limit ?? 24, 1), 60))
        .map((v) => ({ id: v.id, scene: v.scene, shape: v.shape, sound: v.sound, status: v.status, step: v.saving ? 'save' : v.req ? 'make' : 'queue',
          credit: v.credit, error: v.error, usd_cents: v.usd_cents, paid: v.paid, level: v.level, bytes: v.bytes, created_at: iso(v.created),
          done_at: iso(v.done), mine: Boolean(p_wallet) && v.wallet_code === p_wallet }));
    },
    studio_video_hide({ p_id, p_hidden }) {
      const v = this.videos.get(p_id);
      if (!v) return null;
      v.hidden = p_hidden ?? true;
      return true;
    },
  };
}

// ---------- the fakes ----------
let fake, calls, logs, vn = 0;
const log = () => logs.join('\n');
// a video, put straight in the database (as the clock or a payment would leave it)
function addVideo(o = {}) {
  const id = o.id || `vid${String(++vn).padStart(19, '0')}`;
  const t = Date.now();
  fake.db.videos.set(id, {
    id, char_id: CHAR, wallet_code: studioWallet(SECRET, WALLET), scene: SCENE, shape: 'tall', sound: true, level: 1, usd_cents: 400, paid: 0,
    status: 'quote', paid_at: null, started_at: null, req: null, status_url: null, result_url: null, saving: false, tries: 0, error: null,
    credit: false, bytes: null, hidden: false, lease: 0, created: t, updated: t, done: null,
    ...(o.status && o.status !== 'quote' ? { paid: 400, paid_at: t } : {}),
    ...(o.status === 'done' ? { done: t, bytes: MP4.length } : {}),
    ...o,
    id,
  });
  return id;
}
const row = (id) => fake.db.videos.get(id);
const free = (id) => { row(id).lease = 0; };                    // its turn again (no waiting in a test)
const reqOf = (id) => fake.fal.requests.get(row(id).req);

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
    storage: new Map(), storageDown: false, signAnswer: null, noRanges: false,
    fal: { requests: new Map(), n: 0, submitFail: [], answer: null, statusAnswer: null, statusFail: null, resultAnswer: null, resultFail: null, media: MP4, mediaStatus: 200 },
    chain: { receipts: new Map(), blockTime: Date.now() + 5000, down: false },
    explorer: { items: [], status: 200 },
    human: true,
  };
  // two done characters, WALLET's and OTHER's, with their pictures in the bucket
  for (const [id, wallet, name] of [[CHAR, WALLET, 'Mochi'], [CHAR2, OTHER, 'Zara']]) {
    fake.db.orders.set(id, { id, wallet_code: studioWallet(SECRET, wallet), name, about: 'a cheerful character in a hoodie', style: 'anime', status: 'done',
      hidden: false, created: Date.now() - DAY, done: Date.now() - DAY / 2 });
    fake.storage.set(`${id}.png`, { bytes: Buffer.from('a picture'), type: 'image/png' });
  }
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const method = init.method || 'GET';
    // Supabase: the database
    if (url.startsWith(`${SB}/rest/v1/rpc/`)) {
      const fn = url.slice(`${SB}/rest/v1/rpc/`.length);
      const args = JSON.parse(init.body || '{}');
      calls.push({ to: 'db', fn, args });
      if (fake.dbDown) return new Response('{"message":"down"}', { status: 503 });
      if (fake.missing.has(fn) || typeof fake.db[fn] !== 'function') return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      return Response.json(fake.db[fn](args));
    }
    // Supabase Storage: a signed address, and a file kept
    if (url.startsWith(`${SB}/storage/v1/object/sign/agi1-characters/`)) {
      const name = url.slice(`${SB}/storage/v1/object/sign/agi1-characters/`.length);
      calls.push({ to: 'sign', name, body: JSON.parse(init.body), headers: init.headers });
      if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
      if (!fake.storage.has(name)) return new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
      if (fake.signAnswer) return Response.json(fake.signAnswer);
      return Response.json({ signedURL: `/object/sign/agi1-characters/${name}?token=eyJhbGciOiJIUzI1NiJ9.signed${name.replace(/[^A-Za-z0-9]/g, '')}.sig_123` });
    }
    if (url.startsWith(`${SB}/storage/v1/object/authenticated/agi1-characters/`)) {
      const name = url.slice(`${SB}/storage/v1/object/authenticated/agi1-characters/`.length);
      const range = init.headers?.Range;
      calls.push({ to: 'read', name, range, headers: init.headers });
      if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
      const f = fake.storage.get(name);
      if (!f) return new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
      const m = range && !fake.noRanges ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
      if (m) {
        const start = Number(m[1]), end = Math.min(Number(m[2]), f.bytes.length - 1);
        return new Response(f.bytes.subarray(start, end + 1), { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${f.bytes.length}`, 'Content-Type': f.type } });
      }
      return new Response(f.bytes, { headers: { 'Content-Type': f.type } });
    }
    if (url.startsWith(`${SB}/storage/v1/object/agi1-characters/`)) {
      const name = url.slice(`${SB}/storage/v1/object/agi1-characters/`.length);
      calls.push({ to: 'storage', method, name, type: init.headers['Content-Type'] });
      if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
      fake.storage.set(name, { bytes: Buffer.from(init.body), type: init.headers['Content-Type'] });
      return Response.json({ Key: `agi1-characters/${name}` });
    }
    // fal.ai's queue
    if (url.startsWith(`${FAL_QUEUE}/`)) {
      const path = url.slice(FAL_QUEUE.length + 1);
      calls.push({ to: 'fal', method, path, headers: init.headers, body: init.body ? JSON.parse(init.body) : null, redirect: init.redirect });
      if (method === 'POST') {
        const f = fake.fal.submitFail.shift();
        if (f) return new Response(f.text, { status: f.status });
        const id = `0193c2aa-1b2c-7d3e-8f40-${String(++fake.fal.n).padStart(12, '0')}`;
        fake.fal.requests.set(id, { id, model: path, input: JSON.parse(init.body), status: 'IN_QUEUE', position: 2, error: null, errorType: null });
        if (fake.fal.answer) return Response.json({ request_id: id, ...fake.fal.answer });
        const app = path.split('/').slice(0, 2).join('/');
        return Response.json({ request_id: id, response_url: `${FAL_QUEUE}/${app}/requests/${id}`, status_url: `${FAL_QUEUE}/${app}/requests/${id}/status`,
          cancel_url: `${FAL_QUEUE}/${app}/requests/${id}/cancel`, queue_position: 2 });
      }
      const m = /requests\/([^/]+)(\/status)?$/.exec(path);
      const r = m && fake.fal.requests.get(m[1]);
      if (!r) return Response.json({ detail: 'Request not found' }, { status: 404 });
      if (m[2]) {
        if (fake.fal.statusFail) return new Response(fake.fal.statusFail.text, { status: fake.fal.statusFail.status });
        if (fake.fal.statusAnswer) return Response.json(fake.fal.statusAnswer);
        return Response.json({ status: r.status, ...(r.status === 'IN_QUEUE' ? { queue_position: r.position } : {}), ...(r.error ? { error: r.error } : {}),
          ...(r.errorType ? { error_type: r.errorType } : {}) });
      }
      if (fake.fal.resultFail) return new Response(fake.fal.resultFail.text, { status: fake.fal.resultFail.status });
      if (fake.fal.resultAnswer) return Response.json(fake.fal.resultAnswer);
      return Response.json({ video: { url: `https://v3.fal.media/files/zebra/${r.id}.mp4`, content_type: 'video/mp4', file_name: 'output.mp4', file_size: fake.fal.media.length },
        seed: 42 });
    }
    // fal's media addresses (the videos it made)
    if (/^https:\/\/(?:[a-z0-9-]+\.)?fal\.media\//.test(url) || url.startsWith('https://storage.googleapis.com/falserverless/')) {
      calls.push({ to: 'media', url, redirect: init.redirect, auth: init.headers?.Authorization });
      if (fake.fal.mediaStatus !== 200) return new Response('gone', { status: fake.fal.mediaStatus });
      return new Response(fake.fal.media, { headers: { 'Content-Type': 'video/mp4' } });
    }
    // Robinhood Chain's public node
    if (url === RPC) {
      const q = JSON.parse(init.body);
      calls.push({ to: 'chain', method: q.method, params: q.params });
      if (fake.chain.down) throw new TypeError('fetch failed');
      const answer = (result) => Response.json({ jsonrpc: '2.0', id: q.id, result });
      if (q.method === 'eth_call') {
        const { to, data } = q.params[0];
        if (to.toLowerCase() === USDG.toLowerCase() && data === '0x313ce567') return answer(`0x${pad(6)}`);
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
const transferLog = (token, from, to, raw) => ({ address: token, topics: [TRANSFER, topic(from), topic(to)], data: `0x${pad(raw)}`, removed: false });
function onChain(tx, logList, { status = '0x1', block = '0x2a' } = {}) {
  fake.chain.receipts.set(tx, { transactionHash: tx, status, blockNumber: block, logs: logList });
}
const usdgPay = (tx, cents, { from = WALLET, to = OWNER } = {}) => onChain(tx, [transferLog(USDG, from, to, BigInt(cents) * 10n ** 4n)]);
const agiBurn = (tx, agi) => onChain(tx, [transferLog(AGI_CONTRACT, WALLET, BURN_ADDRESS, BigInt(agi) * 10n ** 18n)]);
const explorerItem = (tx, { from = WALLET, to = OWNER, at = Date.now() - 30_000 } = {}) =>
  ({ transaction_hash: tx, from: { hash: from }, to: { hash: to }, token: { address_hash: USDG }, timestamp: new Date(at).toISOString() });
const getReq = (q) => new Request(`https://www.agi1.app/api/launch?${q}`, { headers: { 'x-real-ip': IP } });
async function get(q) {
  const res = await launchGet(getReq(q));
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* a redirect has none */ }
  return { status: res.status, headers: res.headers, body };
}
async function getRaw(q, headers = {}) {
  const res = await launchGet(new Request(`https://www.agi1.app/api/launch?${q}`, { headers: { 'x-real-ip': IP, ...headers } }));
  return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
}
// through api/launch.js, as a page asks; a new video order (studio-video-quote) straight to server/studio-api.js, since
// api/launch.js answers it 410 "moved" (since AGI Studio, 2026-10-10, videos are an influencer's, paid in credits:
// tests/influencer.test.js; tests/studio.test.js checks the 410)
async function post(body) {
  const res = body?.action === 'studio-video-quote'
    ? await studioPost(getConfig(), new Request('https://www.agi1.app/api/launch', { method: 'POST', headers: { 'x-real-ip': IP } }), body)
    : await launchPost(new Request('https://www.agi1.app/api/launch', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(body),
    }));
  return { status: res.status, body: await res.json() };
}
const quoteBody = (extra = {}) => ({ action: 'studio-video-quote', session: sessionFor(), char: CHAR, scene: SCENE, shape: 'tall', sound: true, adult: true,
  turnstileToken: 'ts-token', ...extra });

// ---------- its rules, settings and words ----------
test("its rules: three shapes, 5 seconds, scenes of 10 to 300 characters, its file's addresses; its settings; on only with fal.ai's key and USDG", () => {
  assert.deepEqual(Object.keys(R.SHAPES), ['tall', 'wide', 'square']);
  assert.deepEqual(Object.values(R.SHAPES).map((s) => [s.name, s.ratio]), [['Vertical', '9:16'], ['Wide', '16:9'], ['Square', '1:1']]);
  assert.deepEqual([R.VIDEO_SECONDS, R.SCENE_MIN, R.SCENE_MAX], [5, 10, 300]);
  const id = 'A'.repeat(22);
  assert.ok(R.VIDEO_RE.test(`${id}.mp4`));
  for (const bad of ['x.mp4', `${id}.mov`, `../${'a'.repeat(19)}.mp4`, `videos/${id}.mp4`, `${id}.mp4?x`]) assert.ok(!R.VIDEO_RE.test(bad), bad);
  assert.equal(R.videoUrl(id), `/api/launch?studio-video=${id}.mp4`);
  assert.equal(R.videoDownload(id), `/api/launch?studio-video-dl=${id}.mp4`);
  assert.deepEqual(R.VIDEO_STEPS.map((s) => s.step), ['queue', 'make', 'save']);
  // the settings
  const cfg = getConfig();
  assert.deepEqual([cfg.falKey, cfg.videoModel, cfg.videoUsdCents, cfg.videoMonthCap], [FAL_KEY, MODEL, 400, 30]);
  assert.equal(VIDEO_MODEL, MODEL);
  for (const [v, cents] of [['2.5', 250], ['0.2', 100], ['20000', 1_000_000], ['abc', 400], ['-3', 400], ['', 400]]) {
    process.env.STUDIO_VIDEO_PRICE_USD = v;
    assert.equal(getConfig().videoUsdCents, cents, `STUDIO_VIDEO_PRICE_USD=${v}`);
  }
  for (const [v, n] of [['12', 12], ['0', 30], ['2.7', 2], ['999999', 100_000], ['lots', 30]]) {
    process.env.STUDIO_VIDEOS_A_MONTH = v;
    assert.equal(getConfig().videoMonthCap, n, `STUDIO_VIDEOS_A_MONTH=${v}`);
  }
  for (const [v, model] of [['fal-ai/veo3/image-to-video', 'fal-ai/veo3/image-to-video'], ['a/b', 'a/b'], ['Bad Model', MODEL], ['https://queue.fal.run/x', MODEL],
    ['../etc/passwd', MODEL], ['a/b/c/d/e', MODEL], ['', MODEL]]) assert.equal(falModel(v), model, v);
  // on: the studio on, fal.ai's key, and USDG (videos are paid only in USDG)
  assert.equal(videosOn(getConfig()), true);
  for (const k of ['FAL_KEY', 'STUDIO_PAY_TO', 'MESHY_API_KEY']) {
    delete process.env[k];
    assert.equal(videosOn(getConfig()), false, `off without ${k}`);
    process.env[k] = ENV[k];
  }
  assert.deepEqual(VIDEO, { PER_WALLET: 2, LEASE_S: 45, SAVE_LEASE_S: 120, TRIES: 2, SAVE_TRIES: 4, MAX_MAKING_MS: 12 * 3600e3, CHECKS: 3, SIGNED_S: 7200 });
});

test("a scene: the studio's rules (PG-13, never a real person or someone else's character, nothing passing for her), its shape and its sound; what the video service gets", () => {
  assert.deepEqual(checkScene({ scene: `  ${SCENE}  `, shape: 'tall', sound: true }), { ok: true, scene: SCENE, shape: 'tall', sound: true });
  assert.equal(checkScene({ scene: SCENE, shape: 'wide' }).sound, true, 'sound unless it was switched off');
  assert.equal(checkScene({ scene: SCENE, shape: 'wide', sound: 'no' }).sound, true);
  assert.equal(checkScene({ scene: SCENE, shape: 'wide', sound: false }).sound, false);
  assert.equal(checkScene({ scene: 'it says “hi” to   the crowd', shape: 'square' }).scene, 'it says "hi" to the crowd');
  const no = (field, why, scene, shape = 'tall') => assert.deepEqual(checkScene({ scene, shape }), { ok: false, field, why }, scene);
  no('scene', 'empty', '   ');
  no('scene', 'empty', undefined);
  no('scene', 'short', 'it dances');
  no('scene', 'long', 'a'.repeat(301));
  no('scene', 'link', 'dancing at https://example.org with its friends');
  no('scene', 'contact', 'dancing with @mochi_irl on a rooftop at night');
  no('shape', 'empty', SCENE, 'portrait');
  no('shape', 'empty', SCENE, '__proto__');
  no('shape', 'empty', SCENE, null);
  for (const scene of ['a sexy dance in lingerie on a bed', 'posing nude on a sunny beach']) assert.equal(checkScene({ scene, shape: 'tall' }).why, 'adult', scene);
  assert.equal(checkScene({ scene: 'riding a skateboard with a 12 yo boy', shape: 'tall' }).why, 'minor');
  for (const scene of ['dancing with taylor swift on a big stage', 'high-fiving vitalik at a conference']) assert.equal(checkScene({ scene, shape: 'tall' }).why, 'person', scene);
  for (const scene of ['racing pikachu through a forest at dawn', 'dancing with spider-man on a rooftop']) assert.equal(checkScene({ scene, shape: 'tall' }).why, 'character', scene);
  assert.ok(['her', 'link'].includes(checkScene({ scene: 'dancing next to AGI-1 at her live show', shape: 'tall' }).why));
  // what the video service gets: the character as it is (its picture is "@Image1"), the scene, one shot in its style, family-friendly, nobody real
  const p = videoPrompt({ scene: 'dancing on a neon rooftop in the rain', style: 'anime' });
  assert.equal(p, '@Image1 is the main character of this video: keep its look exactly as in the picture (its face, body, colors and outfit). '
    + 'Dancing on a neon rooftop in the rain. Anime-style 3D animation with a clean cel-shaded look, one continuous shot with a smooth camera. '
    + 'Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, no captions, no logos, no watermarks.');
  assert.match(videoPrompt({ scene: 'it waves!', style: 'realistic' }), / It waves! Polished video-game-style 3D animation,/);
  assert.match(videoPrompt({ scene: 'it bows', style: 'cartoon' }), / It bows\. Cartoon-style 3D animation with bright, clean colors,/);
  assert.match(videoPrompt({ scene: 'it bows', style: 'pixel' }), /Cartoon-style/, 'an unknown style: cartoon');
});

// (2026-10-10) the old studio page's own words for its videos left with it: AGI Studio's are tests/influencer.test.js'
test("visitor-facing words never name the video service (an AI video service): AGI Studio's page, its code and the safety note", () => {
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const files = ['studio.html', 'index.html', ...readdirSync(new URL('../src/studio/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `src/studio/${f}`),
    ...readdirSync(new URL('../src/studio/views/', import.meta.url)).map((f) => `src/studio/views/${f}`), 'src/styles/studio-app.css'];
  assert.ok(files.length >= 14, files.join(', '));
  for (const file of files) {
    const text = strip(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    assert.doesNotMatch(text, /\bfal\b|fal\.ai|fal\.media|seedance|bytedance|\bkling\b/i, file);
  }
  for (const words of Object.values(R.SHAPES).map((x) => x.name)) assert.doesNotMatch(words, /\b(?:buy|sell|pump|moon|profit|invest|gains?|100x)\b/i, words);
});

// ---------- fal.ai's queue (server/fal.js) ----------
test("fal.ai's queue: a request with its key (only ever sent there), its files kept 7 days, its answer's addresses only on queue.fal.run and this request's", async () => {
  const cfg = getConfig();
  const r = await falSubmit(cfg, MODEL, { prompt: 'x', image_urls: [`${SB}/a.png`] });
  const c = calls.find((x) => x.to === 'fal');
  assert.deepEqual([c.method, c.path, c.redirect], ['POST', MODEL, 'error']);
  assert.equal(c.headers.Authorization, `Key ${FAL_KEY}`);
  assert.equal(c.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(c.headers['X-Fal-Object-Lifecycle-Preference']), { expiration_duration_seconds: 604800 });
  assert.deepEqual(c.body, { prompt: 'x', image_urls: [`${SB}/a.png`] });
  assert.match(r.req, /^0193c2aa-1b2c-7d3e-8f40-\d{12}$/);
  assert.equal(r.statusUrl, `${FAL_QUEUE}/bytedance/seedance-2.5/requests/${r.req}/status`);
  assert.equal(r.resultUrl, `${FAL_QUEUE}/bytedance/seedance-2.5/requests/${r.req}`);
  // its addresses somewhere else, or another request's: made from the model's first two parts instead (its docs' own)
  for (const answer of [{ status_url: 'https://evil.example/requests/x/status', response_url: 'https://evil.example/requests/x' },
    { status_url: `${FAL_QUEUE}/bytedance/seedance-2.5/requests/someone-else/status`, response_url: `${FAL_QUEUE}/bytedance/seedance-2.5/requests/someone-else` },
    { status_url: `${FAL_QUEUE}/a/../b/requests/ID/status` }, {}]) {
    fake.fal.answer = answer;
    const s = await falSubmit(cfg, MODEL, {});
    assert.equal(s.statusUrl, `${FAL_QUEUE}/bytedance/seedance-2.5/requests/${s.req}/status`, JSON.stringify(answer));
    assert.equal(s.resultUrl, `${FAL_QUEUE}/bytedance/seedance-2.5/requests/${s.req}`);
  }
  fake.fal.answer = { request_id: 'not ok!' };
  assert.equal((await falSubmit(cfg, MODEL, {}).catch((e) => e)).why, 'fal', 'an answer without a request id');
  fake.fal.answer = null;
  // a bad model name: nothing sent
  const n = calls.length;
  for (const model of ['Not A Model', '../x', 'https://evil.example/x', 'one']) assert.equal((await falSubmit(cfg, model, {}).catch((e) => e)).why, 'request', model);
  assert.equal(calls.length, n);
  // no answer in time, or fal out of reach: "fal" (a moment)
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); };
  let err = await falSubmit(cfg, MODEL, {}).catch((e) => e);
  assert.deepEqual([err.why, err.message], ['fal', 'fal: no answer in time']);
  globalThis.fetch = async () => { throw new TypeError(`connect ECONNREFUSED with Key ${FAL_KEY}`); };
  err = await falSubmit(cfg, MODEL, {}).catch((e) => e);
  assert.equal(err.why, 'fal');
  assert.ok(!err.message.includes(FAL_KEY) && !err.message.includes(FAL_KEY.split(':')[1]), err.message);
  globalThis.fetch = real;
});

test("fal.ai's \"no\", in a word for what it means: its key, its balance, busy, its safety check, nothing made, fal for a moment; never the key in a message", async () => {
  const cfg = getConfig();
  for (const [status, text, why] of [
    [401, `{"detail":"Invalid key ${FAL_KEY}"}`, 'key'],
    [403, '{"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."}', 'credits'],
    [403, '{"detail":"Forbidden"}', 'key'],
    [402, '{"detail":"Payment required"}', 'credits'],
    [429, '{"detail":"Too many requests"}', 'busy'],
    [500, 'Internal Server Error', 'fal'],
    [503, '<html>busy</html>', 'fal'],
    [422, '{"detail":[{"loc":["body","prompt"],"msg":"The content could not be processed because it contained material flagged by a content checker.","type":"content_policy_violation"}]}', 'refused'],
    [422, '{"detail":[{"loc":["body"],"msg":"No media generated","type":"no_media_generated"}]}', 'nothing'],
    [422, '{"detail":[{"loc":["body","duration"],"msg":"bad value","type":"value_error"}]}', 'request'],
    [400, '{"detail":"bad"}', 'request'],
  ]) {
    fake.fal.submitFail.push({ status, text });
    const err = await falSubmit(cfg, MODEL, {}).catch((e) => e);
    assert.equal(err.why, why, `${status} ${text}`);
    assert.equal(err.status, status);
    assert.ok(!err.message.includes(FAL_KEY) && !err.message.includes(FAL_KEY.split(':')[1]), err.message);
    if (why === 'key') assert.match(err.message, /FAL_KEY is wrong or was deleted: make a new one at fal\.ai → API keys/);
    if (why === 'credits') assert.match(err.message, /no fal\.ai balance left: top it up at fal\.ai → Billing/);
  }
  // its key's shape, anywhere in a text, and "Key …"
  assert.equal(scrub(`oops ${FAL_KEY} and Authorization: Key ${FAL_KEY}`), 'oops … and Authorization: Key …');
  assert.equal(scrub('Authorization: Key abcdefgh12345'), 'Authorization: Key …');
  assert.equal(scrub(`x${FAL_KEY.toUpperCase()}y`), 'x…y');
  assert.equal(scrub('the secret-value-1234 here', 'secret-value-1234'), 'the … here');
});

test("a request's state and its video: only ever asked at queue.fal.run; its place in the queue, its error, its video's address", async () => {
  const cfg = getConfig();
  const r = await falSubmit(cfg, MODEL, {});
  const q = fake.fal.requests.get(r.req);
  assert.deepEqual(await falStatus(cfg, r.statusUrl), { status: 'IN_QUEUE', position: 2, error: null, errorType: null });
  q.status = 'IN_PROGRESS';
  assert.deepEqual(await falStatus(cfg, r.statusUrl), { status: 'IN_PROGRESS', position: null, error: null, errorType: null });
  Object.assign(q, { status: 'COMPLETED', error: `Generation failed (${FAL_KEY})`, errorType: 'generation_error' });
  const s = await falStatus(cfg, r.statusUrl);
  assert.deepEqual([s.status, s.errorType], ['COMPLETED', 'generation_error']);
  assert.ok(!s.error.includes(FAL_KEY), s.error);
  assert.equal(calls.filter((c) => c.to === 'fal' && c.method === 'GET').every((c) => c.headers.Authorization === `Key ${FAL_KEY}` && c.redirect === 'error'), true);
  fake.fal.statusAnswer = { what: 'no state' };
  assert.equal((await falStatus(cfg, r.statusUrl).catch((e) => e)).why, 'fal');
  fake.fal.statusAnswer = { status: 'IN_QUEUE', queue_position: -4 };
  assert.equal((await falStatus(cfg, r.statusUrl)).position, null, 'never a place in the queue it can\'t be');
  fake.fal.statusAnswer = null;
  const n = calls.length;
  for (const bad of ['https://evil.example/requests/x/status', 'http://queue.fal.run/x/requests/y/status', `${FAL_QUEUE}/x?y=1`, 'https://queue.fal.run.evil.example/x', '']) {
    assert.equal((await falStatus(cfg, bad).catch((e) => e)).why, 'request', bad);
    assert.equal((await falResult(cfg, bad).catch((e) => e)).why, 'request', bad);
  }
  assert.equal(calls.length, n, 'nothing asked anywhere else');
  // its video
  assert.deepEqual(await falResult(cfg, r.resultUrl), { url: `https://v3.fal.media/files/zebra/${r.req}.mp4`, type: 'video/mp4', size: MP4.length });
  fake.fal.resultAnswer = { images: [] };
  assert.equal((await falResult(cfg, r.resultUrl).catch((e) => e)).why, 'nothing', 'a result without a video');
  fake.fal.resultAnswer = null;
  fake.fal.resultFail = { status: 422, text: '{"detail":[{"msg":"flagged","type":"content_policy_violation"}]}' };
  assert.equal((await falResult(cfg, r.resultUrl).catch((e) => e)).why, 'refused');
  for (const t of ['content_policy_violation', 'Flagged by the safety checker', 'NSFW content detected', 'moderation', 'not allowed']) assert.ok(refusedText(t), t);
  for (const t of ['timeout', 'generation_error', 'internal_server_error', '', null]) assert.ok(!refusedText(t), String(t));
});

// ---------- its file (server/studio-files.js) ----------
test("its file: read only from fal's own media addresses (https, no redirects, 40 MB at most), an MP4 by its first box; kept in the bucket; a signed address to it", async () => {
  const cfg = getConfig();
  assert.deepEqual(await F.fromFal('https://v3.fal.media/files/zebra/x.mp4'), MP4);
  const m = calls.at(-1);
  assert.deepEqual([m.to, m.redirect, m.auth], ['media', 'error', undefined], 'never our key there');
  assert.deepEqual(await F.fromFal('https://fal.media/files/x.mp4'), MP4);
  assert.deepEqual(await F.fromFal('https://storage.googleapis.com/falserverless/gallery/x.mp4'), MP4);
  for (const bad of ['http://v3.fal.media/files/x.mp4', 'https://evil.example/x.mp4', 'https://fal.media.evil.example/x.mp4', 'https://evilfal.media/x.mp4',
    'https://user:pw@v3.fal.media/x.mp4', 'https://v3.fal.media:8443/x.mp4', 'https://storage.googleapis.com/other-bucket/x.mp4', 'not an address']) {
    await assert.rejects(F.fromFal(bad), /files: not/, bad);
  }
  fake.fal.mediaStatus = 404;
  assert.equal((await F.fromFal('https://v3.fal.media/files/x.mp4').catch((e) => e)).gone, true);
  fake.fal.mediaStatus = 200;
  assert.equal((await F.fromFal('https://v3.fal.media/files/x.mp4', { max: 1000 }).catch((e) => e)).tooBig, true);
  assert.equal(F.VIDEO_MAX, 40_000_000);
  assert.equal(F.isMp4(MP4), true);
  assert.equal(F.isMp4(Buffer.alloc(20_000)), false);
  assert.equal(F.isMp4(MP4.subarray(0, 5000)), false, 'too small to be a video');
  assert.equal(F.isMp4(null), false);
  // kept, then a signed address to it
  const name = `videos/${'v'.repeat(22)}.mp4`;
  await F.putFile(cfg, name, MP4, 'video/mp4');
  assert.deepEqual(fake.storage.get(name), { bytes: MP4, type: 'video/mp4' });
  const url = await F.signedUrl(cfg, name, { expiresIn: 7200 });
  assert.equal(url, `${SB}/storage/v1/object/sign/agi1-characters/${name}?token=eyJhbGciOiJIUzI1NiJ9.signedvideos${'v'.repeat(22)}mp4.sig_123`);
  const sign = calls.filter((c) => c.to === 'sign').at(-1);
  assert.deepEqual(sign.body, { expiresIn: 7200 });
  assert.equal(sign.headers.Authorization, 'Bearer sb_secret_fake_key_123');
  assert.match(await F.signedUrl(cfg, name, { download: 'Mochi-AI-video.mp4' }), /\?token=[^&]+&download=Mochi-AI-video\.mp4$/);
  assert.equal(await F.signedUrl(cfg, `videos/${'w'.repeat(22)}.mp4`), null, 'not in the bucket');
  for (const bad of ['videos/../x.mp4', `videos/${'v'.repeat(22)}.mov`, `${'v'.repeat(22)}.mp4`, 'videos/x.mp4', `videos/${'v'.repeat(22)}.mp4/x`]) {
    await assert.rejects(F.signedUrl(cfg, bad), /a bad file name/, bad);
    await assert.rejects(F.putFile(cfg, bad, MP4, 'video/mp4'), /a bad file name/, bad);
  }
  for (const answer of [{ signedURL: 'https://evil.example/x' }, { signedURL: '/object/sign/x.mp4?token=a b' }, { nope: 1 }]) {
    fake.signAnswer = answer;
    await assert.rejects(F.signedUrl(cfg, name), /no signed address in its answer/, JSON.stringify(answer));
  }
  fake.signAnswer = null;
  fake.storageDown = true;
  await assert.rejects(F.signedUrl(cfg, name), /storage HTTP 500/);
});

// ---------- what its pages see ----------
test("what its pages see: a done video for anyone (never the video service's request or addresses, nor the wallet), its own wallet's others only for it", async () => {
  const cfg = getConfig();
  const done = addVideo({ status: 'done' });
  const quote = addVideo({ status: 'quote', paid: 150 });
  const making = addVideo({ status: 'making', req: 'req-abc-123', status_url: `${FAL_QUEUE}/a/b/requests/req-abc-123/status`, result_url: `${FAL_QUEUE}/a/b/requests/req-abc-123` });
  const failed = addVideo({ status: 'failed', error: 'refused', credit: true });
  const hidden = addVideo({ status: 'done', hidden: true });
  addVideo({ status: 'quote', created: Date.now() - 2 * DAY, updated: Date.now() - 2 * DAY });       // expired
  addVideo({ status: 'done', char_id: CHAR2, wallet_code: studioWallet(SECRET, OTHER) });           // another character's
  const pub = await charVideos(cfg, CHAR);
  assert.deepEqual(pub.map((v) => v.id), [done]);
  assert.deepEqual(Object.keys(pub[0]).sort(), ['bytes', 'char', 'created', 'done', 'id', 'scene', 'shape', 'sound', 'status']);
  assert.deepEqual([pub[0].char, pub[0].status, pub[0].bytes, pub[0].sound], [CHAR, 'done', MP4.length, true]);
  const own = await charVideos(cfg, CHAR, WALLET);
  assert.deepEqual(new Set(own.map((v) => v.id)), new Set([done, quote, making, failed]));
  const by = Object.fromEntries(own.map((v) => [v.id, v]));
  assert.deepEqual([by[quote].price, by[quote].paid, by[quote].level], [{ usdCents: 400 }, 150, 1]);
  assert.equal(by[making].step, 'make');
  assert.deepEqual([by[failed].error, by[failed].credit], ['refused', true]);
  for (const v of own) {
    const text = JSON.stringify(v);
    for (const never of ['req-abc-123', 'queue.fal.run', 'wallet', studioWallet(SECRET, WALLET), WALLET]) assert.ok(!text.includes(never), `${never} in ${text}`);
  }
  assert.deepEqual((await charVideos(cfg, CHAR, OTHER)).map((v) => v.id), [done], "another wallet: only what everyone sees");
  assert.ok(!(await charVideos(cfg, CHAR)).some((v) => v.id === hidden));
  // the owner takes one down (STUDIO_HIDE: a video's id, or its character's)
  process.env.STUDIO_HIDE = done;
  assert.deepEqual(await charVideos(getConfig(), CHAR), []);
  process.env.STUDIO_HIDE = CHAR;
  const n = calls.length;
  assert.deepEqual(await charVideos(getConfig(), CHAR, WALLET), []);
  assert.deepEqual(await charVideos(getConfig(), 'not an id'), []);
  assert.equal(calls.length, n, 'nothing asked');
  // one expired before it was paid for says so (to its own wallet)
  assert.equal(videoView(getConfig(), { id: quote, char_id: CHAR2, scene: SCENE, shape: 'tall', sound: true, status: 'quote', expired: true, usd_cents: 400, paid: 0 },
    { mine: true }).status, 'expired');
  assert.equal(videoView(getConfig(), { id: quote, char_id: CHAR2, status: 'making' }), null, 'not done: only for its own wallet');
});

// ---------- 1 and 2: a quote ----------
test("a video's quote: only the wallet that made a done character, its scene checked first, its price by level (Crush 20%, Soulmate 40% off), a place this month held a day", async () => {
  const cfg = getConfig();
  let q = await videoQuote(cfg, { wallet: WALLET, level: 1, char: CHAR, scene: `  ${SCENE} `, shape: 'tall', sound: true });
  assert.deepEqual([q.ok, q.price, q.left], [true, { usdCents: 400 }, 29]);
  assert.match(q.id, R.ORDER_ID);
  let v = row(q.id);
  assert.deepEqual([v.char_id, v.wallet_code, v.scene, v.shape, v.sound, v.level, v.usd_cents, v.status], [CHAR, studioWallet(SECRET, WALLET), SCENE, 'tall', true, 1, 400, 'quote']);
  const args = calls.find((c) => c.fn === 'studio_video_quote').args;
  assert.deepEqual([args.p_cap, args.p_per_wallet], [30, 2]);
  assert.ok(!JSON.stringify(args).includes(WALLET.slice(2)), 'never the wallet itself');
  q = await videoQuote(cfg, { wallet: WALLET, level: 2, char: CHAR, scene: SCENE, shape: 'wide', sound: false });
  assert.deepEqual([q.price, row(q.id).sound, row(q.id).level], [{ usdCents: 320 }, false, 2]);
  assert.deepEqual(await videoQuote(cfg, { wallet: WALLET, level: 3, char: CHAR, scene: SCENE, shape: 'tall' }), { ok: false, why: 'too_many' });
  fake.db.videos.delete(q.id);
  q = await videoQuote(cfg, { wallet: WALLET, level: 3, char: CHAR, scene: SCENE, shape: 'square' });
  assert.deepEqual(q.price, { usdCents: 240 });
  // its words first: nothing asked of the database
  const n = calls.length;
  assert.deepEqual(await videoQuote(cfg, { wallet: WALLET, level: 1, char: CHAR, scene: 'dancing with taylor swift on a big stage', shape: 'tall' }),
    { ok: false, field: 'scene', why: 'person' });
  assert.deepEqual(await videoQuote(cfg, { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'portrait' }), { ok: false, field: 'shape', why: 'empty' });
  assert.deepEqual(await videoQuote(cfg, { wallet: WALLET, level: 1, char: 'nope', scene: SCENE, shape: 'tall' }), { ok: false, why: 'no_char' });
  assert.equal(calls.length, n);
  // another wallet's character; one not made yet; one the owner took down
  assert.deepEqual(await videoQuote(cfg, { wallet: OTHER, level: 1, char: CHAR, scene: SCENE, shape: 'tall' }), { ok: false, why: 'not_yours' });
  fake.db.orders.get(CHAR2).status = 'making';
  assert.deepEqual(await videoQuote(cfg, { wallet: OTHER, level: 1, char: CHAR2, scene: SCENE, shape: 'tall' }), { ok: false, why: 'no_char' });
  process.env.STUDIO_HIDE = CHAR;
  assert.deepEqual(await videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' }), { ok: false, why: 'no_char' });
  delete process.env.STUDIO_HIDE;
  // the month's videos all held or made
  fake.db.videos.clear();
  fake.db.orders.get(CHAR2).status = 'done';
  process.env.STUDIO_VIDEOS_A_MONTH = '1';
  assert.equal((await videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' })).ok, true);
  assert.deepEqual(await videoQuote(getConfig(), { wallet: OTHER, level: 1, char: CHAR2, scene: SCENE, shape: 'tall' }), { ok: false, why: 'sold_out' });
  delete process.env.STUDIO_VIDEOS_A_MONTH;
  // private: only STUDIO_ONLY_FOR's wallets
  delete process.env.STUDIO_OPEN;
  process.env.STUDIO_ONLY_FOR = OTHER;
  assert.deepEqual(await videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' }), { ok: false, why: 'closed' });
  // the database away: an error (the page says "busy")
  process.env.STUDIO_OPEN = 'yes';
  fake.dbDown = true;
  await assert.rejects(videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' }));
  // an id already taken: another one, once
  fake.dbDown = false;
  const real = fake.db.studio_video_quote.bind(fake.db);
  let first = true;
  fake.db.studio_video_quote = (a) => (first ? ((first = false), { ok: false, why: 'taken' }) : real(a));
  fake.db.videos.clear();
  assert.equal((await videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' })).ok, true);
  fake.db.studio_video_quote = () => ({ ok: false, why: 'taken' });
  assert.deepEqual(await videoQuote(getConfig(), { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' }), { ok: false, why: 'busy' });
});

// ---------- 3: "Check my payment" ----------
test('"Check my payment" for a video: USDG only, to the studio\'s wallet, from the wallet that made it, after its quote; each payment once (never one counted for a character); payments add up', async () => {
  const cfg = getConfig();
  const { id } = await videoQuote(cfg, { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' });
  usdgPay(txOf(1), 150);
  let r = await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(1) });
  assert.deepEqual([r.ok, r.paid, r.have, r.need, r.source, r.results], [true, false, 150, 400, 'pasted', [{ ok: true, amount: 150 }]]);
  r = await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(1) });
  assert.deepEqual([r.have, r.results], [150, [{ ok: false, why: 'used' }]], 'once');
  const codes = [...fake.db.txs.keys()];
  assert.deepEqual(codes, [payCode(BURN_KEY, 'usdg', txOf(1), WALLET)]);
  assert.ok(!codes[0].includes(txOf(1).slice(2, 18)), 'its code, never the transaction');
  // what doesn't pay for it
  agiBurn(txOf(2), 15_000);
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(2) })).results, [{ ok: false, why: 'nothing' }], 'a burn: videos are paid in USDG');
  usdgPay(txOf(3), 300, { to: OTHER });
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(3) })).results, [{ ok: false, why: 'nothing' }], 'USDG elsewhere');
  usdgPay(txOf(4), 300, { from: OTHER });
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(4) })).results, [{ ok: false, why: 'other_wallet' }]);
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(5) })).results, [{ ok: false, why: 'pending' }], 'not on the chain yet');
  onChain(txOf(6), [transferLog(USDG, WALLET, OWNER, 3_000_000n)], { status: '0x0' });
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(6) })).results, [{ ok: false, why: 'failed' }]);
  usdgPay(txOf(7), 300);
  fake.chain.blockTime = Date.now() - 3600_000;
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(7) })).results, [{ ok: false, why: 'too_old' }], 'before its quote');
  fake.chain.blockTime = Date.now() + 5000;
  assert.equal(row(id).paid, 150, 'nothing above counted');
  // a payment already counted for a character can't pay for a video too
  fake.db.txs.set(payCode(BURN_KEY, 'usdg', txOf(9), WALLET), { kind: 'usdg', order: 'aCharacter000000000001' });
  usdgPay(txOf(9), 400);
  assert.deepEqual((await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(9) })).results, [{ ok: false, why: 'used' }]);
  // looked up by the wallet (the block explorer): the rest, and it's paid
  usdgPay(txOf(10), 250);
  fake.explorer.items = [explorerItem(txOf(10)), explorerItem(txOf(1)), explorerItem(txOf(11), { to: OTHER })];
  r = await checkVideoPayment(cfg, { id, wallet: WALLET });
  assert.deepEqual([r.paid, r.have, r.need, r.source, r.results], [true, 400, 400, 'explorer', [{ ok: true, amount: 250 }]]);
  assert.match(calls.find((c) => c.to === 'explorer').url, new RegExp(`${WALLET}/token-transfers\\?type=ERC-20&filter=from&token=${USDG.toLowerCase()}$`));
  assert.deepEqual([row(id).status, fake.db.month.videos], ['paid', 1]);
  r = await checkVideoPayment(cfg, { id, wallet: WALLET, tx: txOf(12) });
  assert.deepEqual([r.ok, r.paid, r.source], [true, true, 'done'], 'paid already');
  // someone else's video; one gone or expired
  assert.deepEqual(await checkVideoPayment(cfg, { id, wallet: OTHER, tx: txOf(1) }), { ok: false, why: 'not_yours' });
  assert.deepEqual(await checkVideoPayment(cfg, { id: 'gone0000000000000000zz', wallet: WALLET }), { ok: false, why: 'gone' });
  const old = addVideo({ created: Date.now() - 2 * DAY });
  assert.deepEqual(await checkVideoPayment(cfg, { id: old, wallet: WALLET }), { ok: false, why: 'gone' });
  // the chain away: a pasted one says so (the page: "try again"); looked-up ones each say so; the explorer away says so
  const { id: id2 } = await videoQuote(cfg, { wallet: WALLET, level: 1, char: CHAR, scene: SCENE, shape: 'tall' });
  usdgPay(txOf(13), 400);
  fake.chain.down = true;
  assert.equal((await checkVideoPayment(cfg, { id: id2, wallet: WALLET, tx: txOf(13) }).catch((e) => e)).why, 'chain');
  fake.explorer.items = [explorerItem(txOf(13))];
  assert.deepEqual((await checkVideoPayment(cfg, { id: id2, wallet: WALLET })).results, [{ ok: false, why: 'chain' }]);
  fake.chain.down = false;
  fake.explorer.status = 503;
  assert.equal((await checkVideoPayment(cfg, { id: id2, wallet: WALLET }).catch((e) => e)).why, 'explorer');
  // without the studio's wallet (USDG off): no video can be paid
  delete process.env.STUDIO_PAY_TO;
  assert.deepEqual(await checkVideoPayment(getConfig(), { id: id2, wallet: WALLET, tx: txOf(13) }), { ok: false, why: 'no_usdg' });
});

test('a paid video that couldn\'t be made: made again with a new scene, shape and sound, free; only by its wallet, its words checked first', async () => {
  const cfg = getConfig();
  const id = addVideo({ status: 'failed', error: 'refused', credit: true });
  const n = calls.length;
  assert.deepEqual(await videoRedo(cfg, { id, wallet: WALLET, scene: 'a sexy dance in lingerie on a bed', shape: 'tall' }), { ok: false, field: 'scene', why: 'adult' });
  assert.equal(calls.length, n, 'nothing asked');
  assert.deepEqual(await videoRedo(cfg, { id, wallet: OTHER, scene: SCENE, shape: 'tall' }), { ok: false, why: 'not_yours' });
  assert.deepEqual(await videoRedo(cfg, { id, wallet: WALLET, scene: 'a calm walk on a beach at sunset', shape: 'wide', sound: false }), { ok: true });
  const v = row(id);
  assert.deepEqual([v.status, v.scene, v.shape, v.sound, v.credit, v.paid], ['paid', 'a calm walk on a beach at sunset', 'wide', false, false, 400]);
  assert.equal(fake.db.month.videos, 0, 'no new place this month');
  assert.deepEqual(await videoRedo(cfg, { id, wallet: WALLET, scene: SCENE, shape: 'tall' }), { ok: false, why: 'no_credit' });
  fake.dbDown = true;
  await assert.rejects(videoRedo(cfg, { id, wallet: WALLET, scene: SCENE, shape: 'tall' }));
});

// ---------- 4: the making ----------
test('the making: its turn (a lease), the character\'s own picture (a signed address) and the scene to the video service: 5 s of 720p in its shape, H.264, never the wallet', async () => {
  const cfg = getConfig();
  const id = addVideo({ status: 'paid', shape: 'wide', sound: false });
  assert.deepEqual(await videoTick(cfg, id), { state: 'started', step: 'make' });
  const sub = calls.find((c) => c.to === 'fal' && c.method === 'POST');
  assert.deepEqual([sub.path, sub.headers.Authorization], [MODEL, `Key ${FAL_KEY}`]);
  const input = sub.body;
  assert.deepEqual(Object.keys(input).sort(), ['aspect_ratio', 'bitrate_mode', 'codec', 'duration', 'end_user_id', 'generate_audio', 'image_urls', 'prompt', 'resolution']);
  assert.deepEqual([input.resolution, input.duration, input.aspect_ratio, input.generate_audio, input.bitrate_mode, input.codec], ['720p', '5', '16:9', false, 'standard', 'H264']);
  assert.equal(input.prompt, videoPrompt({ scene: SCENE, style: 'anime' }));
  assert.equal(input.image_urls.length, 1);
  assert.match(input.image_urls[0], new RegExp(`^${SB}/storage/v1/object/sign/agi1-characters/${CHAR}\\.png\\?token=`));
  assert.deepEqual(calls.find((c) => c.to === 'sign' && c.name === `${CHAR}.png`).body, { expiresIn: 6 * 3600 }, 'its picture, signed for a few hours');
  // who asked: an id for the video service, never the wallet nor its code here; the same for the same wallet
  assert.match(input.end_user_id, /^[A-Za-z0-9_-]{24}$/);
  for (const s of [WALLET, WALLET.slice(2), studioWallet(SECRET, WALLET)]) assert.ok(!JSON.stringify(input).includes(s), s);
  const got = fake.db.studio_video_get({ p_id: id });
  assert.equal(falInput(cfg, got, 'x').end_user_id, input.end_user_id);
  assert.notEqual(falInput(cfg, { ...got, wallet_code: studioWallet(SECRET, OTHER) }, 'x').end_user_id, input.end_user_id);
  for (const [shape, ratio] of [['tall', '9:16'], ['square', '1:1'], ['nope', '9:16']]) assert.equal(falInput(cfg, { ...got, shape }, 'x').aspect_ratio, ratio);
  assert.equal(falInput(cfg, { ...got, sound: true }, 'x').generate_audio, true);
  // kept: its request and the addresses fal gave, its making's start
  const v = row(id);
  assert.deepEqual([v.status, v.saving, v.tries], ['making', false, 0]);
  assert.match(v.req, /^0193c2aa-/);
  assert.equal(v.status_url, `${FAL_QUEUE}/bytedance/seedance-2.5/requests/${v.req}/status`);
  assert.ok(v.started_at);
  // its turn: one at a time
  v.lease = Date.now() + 30_000;
  assert.deepEqual(await videoTick(cfg, id), { state: 'busy' });
  assert.equal(calls.filter((c) => c.to === 'fal' && c.method === 'POST').length, 1);
  // a quote, a done one, one that isn't there: never moved along
  for (const other of [addVideo({ status: 'quote' }), addVideo({ status: 'done' }), 'nope0000000000000000zz']) assert.deepEqual(await videoTick(cfg, other), { state: 'busy' });
  // another model (STUDIO_VIDEO_MODEL)
  process.env.STUDIO_VIDEO_MODEL = 'fal-ai/other-model/reference-to-video';
  await videoTick(getConfig(), addVideo({ status: 'paid' }));
  assert.equal(calls.filter((c) => c.to === 'fal' && c.method === 'POST').at(-1).path, 'fal-ai/other-model/reference-to-video');
});

test("…then its state (its place in the queue), its video read from fal's media address and kept in the bucket as an MP4: done, never asked about again", async () => {
  const cfg = getConfig();
  const id = addVideo({ status: 'paid' });
  await videoTick(cfg, id);
  free(id);
  assert.deepEqual(await videoTick(cfg, id), { state: 'waiting', step: 'queue', position: 2 });
  assert.ok(row(id).lease > Date.now(), 'a short rest before fal is asked again');
  free(id);
  reqOf(id).status = 'IN_PROGRESS';
  assert.deepEqual(await videoTick(cfg, id), { state: 'waiting', step: 'make' });
  free(id);
  reqOf(id).status = 'COMPLETED';
  assert.deepEqual(await videoTick(cfg, id), { state: 'done', step: 'save' });
  const v = row(id);
  assert.deepEqual([v.status, v.bytes, v.status_url, v.result_url, v.saving], ['done', MP4.length, null, null, false]);
  assert.deepEqual(fake.storage.get(`videos/${id}.mp4`), { bytes: MP4, type: 'video/mp4' });
  const media = calls.find((c) => c.to === 'media');
  assert.deepEqual([media.url, media.redirect, media.auth], [`https://v3.fal.media/files/zebra/${v.req}.mp4`, 'error', undefined]);
  assert.match(log(), new RegExp(`\\[studio\\] video ${id} is done: 0\\.03 MB`));
  assert.deepEqual(await videoTick(cfg, id), { state: 'busy' }, 'done: never moved along again');
  // with little time left in the run: kept on its next turn (each wait fits Vercel's 25 s)
  const id2 = addVideo({ status: 'paid' });
  await videoTick(cfg, id2);
  free(id2);
  reqOf(id2).status = 'COMPLETED';
  assert.deepEqual(await videoTick(cfg, id2, { deadline: Date.now() + 10_000 }), { state: 'saving', step: 'save' });
  assert.deepEqual([row(id2).status, row(id2).saving], ['making', true]);
  assert.equal(calls.filter((c) => c.to === 'media').length, 1, 'not read yet');
  free(id2);
  assert.deepEqual(await videoTick(cfg, id2, { deadline: Date.now() + 9000 }), { state: 'saving', step: 'save' }, 'still not enough time');
  free(id2);
  assert.deepEqual(await videoTick(cfg, id2), { state: 'done', step: 'save' });
  assert.equal(fake.storage.get(`videos/${id2}.mp4`).type, 'video/mp4');
  assert.ok(!log().includes(FAL_KEY) && !log().includes(FAL_KEY.split(':')[1]), 'never the key in a log');
});

test("when it can't be made: its safety check (a new scene, free), sent again twice then given up, 12 hours, its character taken down; fal's key, balance or a moment only make it wait", async () => {
  const cfg = getConfig();
  // its safety check, when it's sent
  fake.fal.submitFail.push({ status: 422, text: '{"detail":[{"msg":"flagged","type":"content_policy_violation"}]}' });
  let id = addVideo({ status: 'paid' });
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'queue' });
  assert.deepEqual([row(id).status, row(id).error, row(id).credit], ['failed', 'refused', true]);
  // our request itself refused: "ai:make" (made again free)
  fake.fal.submitFail.push({ status: 400, text: '{"detail":"bad input"}' });
  id = addVideo({ status: 'paid' });
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'queue' });
  assert.deepEqual([row(id).error, row(id).credit], ['ai:make', true]);
  // fal's key, its balance, too many at once, fal for a moment: it waits (the owner told once each, in the log)
  for (const [status, text] of [[401, '{"detail":"no"}'], [401, '{"detail":"no"}'], [403, '{"detail":"Exhausted balance"}'], [429, '{}'], [502, 'bad gateway']]) {
    fake.fal.submitFail.push({ status, text });
    id = addVideo({ status: 'paid' });
    assert.deepEqual(await videoTick(cfg, id), { state: 'waiting', step: 'queue' }, `${status}`);
    assert.equal(row(id).status, 'paid');
  }
  assert.equal(log().match(/a video waits: fal HTTP 401/g)?.length, 1, 'once per server copy');
  assert.match(log(), /FAL_KEY is wrong or was deleted/);
  assert.match(log(), /top it up at fal\.ai → Billing/);
  // done at fal with its safety check's no (in the request's state): a new scene, free
  id = addVideo({ status: 'paid' });
  await videoTick(cfg, id);
  free(id);
  Object.assign(reqOf(id), { status: 'COMPLETED', error: 'Content flagged by the safety checker', errorType: 'content_policy_violation' });
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'make' });
  assert.equal(row(id).error, 'refused');
  // failed at fal: sent again twice, then given up
  id = addVideo({ status: 'paid' });
  await videoTick(cfg, id);
  let r;
  for (let i = 0; i < 3; i++) {
    free(id);
    Object.assign(reqOf(id), { status: 'COMPLETED', error: 'Internal error', errorType: 'internal_server_error' });
    r = await videoTick(cfg, id);
    if (i < 2) assert.deepEqual([r, row(id).tries], [{ state: 'started', step: 'make' }, i + 1]);
  }
  assert.deepEqual(r, { state: 'failed', step: 'make' });
  assert.deepEqual([row(id).error, row(id).credit], ['ai:make', true]);
  assert.match(log(), /failed at the video service 3 times \(internal_server_error\): given up/);
  // 12 hours without a video: given up (fal's state isn't asked)
  id = addVideo({ status: 'making', req: 'req-old-12345', status_url: `${FAL_QUEUE}/a/b/requests/req-old-12345/status`,
    result_url: `${FAL_QUEUE}/a/b/requests/req-old-12345`, started_at: Date.now() - 13 * 3600e3 });
  const n = calls.filter((c) => c.to === 'fal').length;
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'make' });
  assert.deepEqual([row(id).error, row(id).credit], ['expired', true]);
  assert.equal(calls.filter((c) => c.to === 'fal').length, n);
  // its character taken down meanwhile: nothing sent
  process.env.STUDIO_HIDE = CHAR;
  id = addVideo({ status: 'paid' });
  assert.deepEqual(await videoTick(getConfig(), id), { state: 'failed', step: 'queue' });
  assert.deepEqual([row(id).error, row(id).credit], ['no_char', true]);
  delete process.env.STUDIO_HIDE;
  fake.db.orders.get(CHAR).hidden = true;
  id = addVideo({ status: 'paid' });
  assert.equal((await videoTick(cfg, id)).state, 'failed');
  fake.db.orders.get(CHAR).hidden = false;
  // its picture not in the bucket: "save" (made again free); Storage away for a moment: it waits
  fake.storage.delete(`${CHAR}.png`);
  id = addVideo({ status: 'paid' });
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'queue' });
  assert.equal(row(id).error, 'save');
  assert.match(log(), new RegExp(`video ${id}: its character's picture isn't in the bucket`));
  fake.storage.set(`${CHAR}.png`, { bytes: Buffer.from('a picture'), type: 'image/png' });
  fake.storageDown = true;
  id = addVideo({ status: 'paid' });
  assert.deepEqual(await videoTick(cfg, id), { state: 'waiting', step: 'queue' });
  assert.equal(row(id).status, 'paid');
  assert.equal(calls.filter((c) => c.to === 'fal').length, n, 'nothing sent without its picture');
});

test("…and its file: no video in its result, not an MP4 (tried 4 times), too big, gone from fal's media: made again free; its state can't be read: it waits", async () => {
  const cfg = getConfig();
  const made = async () => {
    const id = addVideo({ status: 'paid' });
    await videoTick(cfg, id);
    free(id);
    reqOf(id).status = 'COMPLETED';
    return id;
  };
  // fal made nothing
  let id = await made();
  fake.fal.resultFail = { status: 422, text: '{"detail":[{"type":"no_media_generated","msg":"no media"}]}' };
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'save' });
  assert.equal(row(id).error, 'ai:make');
  // its safety check stopped the video itself
  id = await made();
  fake.fal.resultFail = { status: 422, text: '{"detail":[{"type":"content_policy_violation","msg":"flagged"}]}' };
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'save' });
  assert.equal(row(id).error, 'refused');
  fake.fal.resultFail = null;
  // not an MP4: tried again, 4 times in all
  id = await made();
  fake.fal.media = Buffer.alloc(20_000, 1);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(await videoTick(cfg, id), { state: 'saving', step: 'save' });
    assert.deepEqual([row(id).saving, row(id).tries], [true, i + 1]);
    free(id);
  }
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'save' });
  assert.deepEqual([row(id).error, row(id).credit], ['save', true]);
  assert.equal(fake.storage.has(`videos/${id}.mp4`), false, 'never kept');
  // too big (over 40 MB): at once
  id = await made();
  fake.fal.media = Buffer.alloc(F.VIDEO_MAX + 1, 7);
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'save' });
  assert.equal(row(id).error, 'too_big');
  // gone from fal's media: at once
  fake.fal.media = MP4;
  id = await made();
  fake.fal.mediaStatus = 404;
  assert.deepEqual(await videoTick(cfg, id), { state: 'failed', step: 'save' });
  assert.equal(row(id).error, 'save');
  fake.fal.mediaStatus = 200;
  // Storage away when keeping it: tried again
  id = await made();
  fake.storageDown = true;
  assert.deepEqual(await videoTick(cfg, id), { state: 'saving', step: 'save' });
  assert.equal(row(id).tries, 1);
  fake.storageDown = false;
  free(id);
  assert.deepEqual(await videoTick(cfg, id), { state: 'done', step: 'save' });
  // its state can't be read (fal busy, its key): it waits, never fails
  id = addVideo({ status: 'paid' });
  await videoTick(cfg, id);
  free(id);
  fake.fal.statusFail = { status: 503, text: 'busy' };
  assert.deepEqual(await videoTick(cfg, id), { state: 'waiting', step: 'make' });
  assert.equal(row(id).status, 'making');
  fake.fal.statusFail = null;
  // the video's errors are only ever these words (the page turns them into sentences)
  for (const v of fake.db.videos.values()) if (v.error) assert.ok(['refused', 'ai:make', 'save', 'too_big', 'expired', 'no_char'].includes(v.error), v.error);
});

test("the clock (/api/feed?studio, every minute): its characters' steps, then its videos' in the time left; off without fal.ai's key; studio.sql from before its videos", async () => {
  const cfg = getConfig();
  const a = addVideo({ status: 'paid' }), b = addVideo({ status: 'paid' }), c = addVideo({ status: 'quote' });
  assert.deepEqual(await videoClock(cfg), { due: 2, moved: 2, done: 0, failed: 0 });
  assert.equal(row(c).status, 'quote');
  assert.deepEqual(calls.find((x) => x.fn === 'studio_video_due').args, { p_limit: 4 });
  assert.deepEqual(await videoClock(cfg), { due: 2, moved: 0, done: 0, failed: 0 }, 'asked about at fal: waiting their turn');
  assert.deepEqual(await videoClock(cfg), { due: 0, moved: 0, done: 0, failed: 0 }, 'then resting a moment');
  // through api/feed.js
  const call = () => feedGet(new Request('https://www.agi1.app/api/feed?studio', { headers: { authorization: `Bearer ${STUDIO_KEY}` } }));
  free(a); free(b);
  reqOf(a).status = 'COMPLETED';
  let body = await (await call()).json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.videos, { due: 2, moved: 0, done: 1, failed: 0 });
  assert.equal(row(a).status, 'done');
  // a clock that ran out of time for them says so; one that can't read them says why
  delete process.env.FAL_KEY;
  body = await (await call()).json();
  assert.equal(body.videos, undefined, 'off without fal.ai\'s key');
  process.env.FAL_KEY = FAL_KEY;
  fake.missing.add('studio_video_due');
  body = await (await call()).json();
  assert.deepEqual([body.ok, body.videos], [true, { error: 'not_set_up' }], "its characters' clock goes on");
  assert.match(log(), /the videos' clock stopped: .*studio_video_due not found: run supabase\/studio\.sql again/);
  fake.missing.clear();
  fake.dbDown = true;
  assert.equal((await call()).status, 502, 'the database away: as before (its key read once per server copy)');
});

// ---------- its file, from our address ----------
test("GET ?studio-video=<id>.mp4: a done video from our own address, in the parts its player asks for (4 MB at most each), whole when it's small; ?studio-video-dl= downloads it with its own name", async () => {
  const id = addVideo({ status: 'done' });
  fake.storage.set(`videos/${id}.mp4`, { bytes: MP4, type: 'video/mp4' });
  // asked for whole: itself (it's small), kept a day by the CDN, in a sandbox
  let r = await getRaw(`studio-video=${id}.mp4`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.bytes, MP4);
  for (const [k, v] of [['content-type', 'video/mp4'], ['content-length', String(MP4.length)], ['accept-ranges', 'bytes'],
    ['cache-control', 'public, max-age=86400, s-maxage=86400'], ['x-content-type-options', 'nosniff'], ['content-security-policy', "default-src 'none'; sandbox"]]) {
    assert.equal(r.headers.get(k), v, k);
  }
  // the parts its player asks for (Safari's player first asks for 2 bytes), each read from Storage as asked
  r = await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=0-1' });
  assert.deepEqual([r.status, r.headers.get('content-range'), r.headers.get('content-length'), r.headers.get('cache-control'), r.headers.get('content-type')],
    [206, `bytes 0-1/${MP4.length}`, '2', 'private, max-age=86400', 'video/mp4']);
  assert.deepEqual(r.bytes, MP4.subarray(0, 2));
  const read = calls.filter((c) => c.to === 'read').at(-1);
  assert.deepEqual([read.range, read.headers.Authorization], ['bytes=0-1', 'Bearer sb_secret_fake_key_123']);
  r = await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=100-' });
  assert.deepEqual([r.status, r.headers.get('content-range'), r.bytes], [206, `bytes 100-${MP4.length - 1}/${MP4.length}`, MP4.subarray(100)]);
  r = await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=-500' });
  assert.deepEqual([r.status, r.headers.get('content-range'), r.bytes], [206, `bytes ${MP4.length - 500}-${MP4.length - 1}/${MP4.length}`, MP4.subarray(-500)]);
  r = await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=0-99, 200-299' });
  assert.deepEqual([r.status, r.bytes.length], [206, 100], 'several parts asked for: the first');
  for (const bad of [`bytes=${MP4.length}-`, 'bytes=50-10', 'bytes=-0', 'bytes=-', 'items=0-1', 'bytes=x-1']) {
    r = await getRaw(`studio-video=${id}.mp4`, { range: bad });
    assert.deepEqual([r.status, r.headers.get('content-range'), r.bytes.length], [416, `bytes */${MP4.length}`, 0], bad);
  }
  // Storage sends the whole file to a range (it never has so far): only the part asked for goes to the player
  fake.noRanges = true;
  r = await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=10-19' });
  assert.deepEqual([r.status, r.bytes], [206, MP4.subarray(10, 20)]);
  fake.noRanges = false;
  // a big video (over 4 MB): its parts 4 MB at most each; asked for whole (opened in a tab), Storage serves it itself
  const big = Buffer.concat([MP4, Buffer.alloc(F.PART, 3)]);
  const bigId = addVideo({ status: 'done', bytes: big.length });
  fake.storage.set(`videos/${bigId}.mp4`, { bytes: big, type: 'video/mp4' });
  const first = await getRaw(`studio-video=${bigId}.mp4`, { range: 'bytes=0-' });
  assert.deepEqual([first.status, first.headers.get('content-range'), first.bytes.length], [206, `bytes 0-${F.PART - 1}/${big.length}`, F.PART]);
  const rest = await getRaw(`studio-video=${bigId}.mp4`, { range: `bytes=${F.PART}-` });
  assert.deepEqual([rest.status, rest.headers.get('content-range')], [206, `bytes ${F.PART}-${big.length - 1}/${big.length}`]);
  assert.ok(Buffer.concat([first.bytes, rest.bytes]).equals(big), 'its parts make the whole video');
  r = await getRaw(`studio-video=${bigId}.mp4`);
  assert.equal(r.status, 302);
  const loc = r.headers.get('location');
  assert.match(loc, new RegExp(`^${SB}/storage/v1/object/sign/agi1-characters/videos/${bigId}\\.mp4\\?token=[A-Za-z0-9._-]+$`));
  assert.ok(!loc.includes('sb_secret'), 'never our key');
  assert.deepEqual([r.headers.get('cache-control'), r.headers.get('referrer-policy')], ['public, max-age=300, s-maxage=1800', 'no-referrer']);
  assert.deepEqual(calls.filter((c) => c.to === 'sign').at(-1).body, { expiresIn: 7200 });
  // downloaded: a signed address that saves it with its own name
  r = await getRaw(`studio-video-dl=${id}.mp4`, { range: 'bytes=0-1' });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /\?token=[^&]+&download=Mochi-AI-video\.mp4$/);
  for (const [name, file] of [['Señor Taco!', 'Se-or-Taco-AI-video.mp4'], ['ピカ', 'character-AI-video.mp4'], [`${'x'.repeat(60)}`, `${'x'.repeat(40)}-AI-video.mp4`]]) {
    fake.db.orders.get(CHAR).name = name;
    const out = await videoFile(getConfig(), `${id}.mp4`, { download: true });
    assert.ok(out.url.endsWith(`&download=${file}`), `${name}: ${out.url}`);
  }
  fake.db.orders.get(CHAR).name = 'Mochi';
  // not done, hidden (the video or its character), not in the bucket, a bad name
  const quote = addVideo({ status: 'quote' });
  assert.deepEqual([(await get(`studio-video=${quote}.mp4`)).status, (await get(`studio-video=${quote}.mp4`)).body], [404, { error: 'gone' }]);
  row(id).hidden = true;
  assert.equal((await get(`studio-video=${id}.mp4`)).status, 404);
  row(id).hidden = false;
  process.env.STUDIO_HIDE = CHAR;
  assert.equal((await get(`studio-video=${id}.mp4`)).status, 404);
  delete process.env.STUDIO_HIDE;
  fake.db.orders.get(CHAR).hidden = true;
  assert.equal((await get(`studio-video=${id}.mp4`)).status, 404);
  fake.db.orders.get(CHAR).hidden = false;
  fake.storage.delete(`videos/${id}.mp4`);
  assert.equal((await get(`studio-video=${id}.mp4`)).status, 404);
  assert.equal((await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=0-1' })).status, 404);
  assert.equal((await get(`studio-video-dl=${id}.mp4`)).status, 404);
  fake.storage.set(`videos/${id}.mp4`, { bytes: MP4, type: 'video/mp4' });
  for (const bad of ['studio-video=nope.mp4', `studio-video=${id}.mov`, `studio-video-dl=${id}`, 'studio-video=']) {
    assert.deepEqual([(await get(bad)).status, (await get(bad)).body], [400, { error: 'bad_request' }], bad);
  }
  // Storage or the database away
  fake.storageDown = true;
  assert.deepEqual([(await get(`studio-video=${id}.mp4`)).status, (await get(`studio-video=${id}.mp4`)).body], [502, { error: 'storage' }]);
  assert.equal((await getRaw(`studio-video=${id}.mp4`, { range: 'bytes=0-1' })).status, 502);
  fake.storageDown = false;
  fake.dbDown = true;
  assert.deepEqual((await get(`studio-video=${id}.mp4`)).body, { error: 'busy' });
});

test('GET ?studio-videos=<character>: its done videos, the same for everyone, shared a moment; ?studio-info: videos on or not, their price, the month\'s left', async () => {
  const done = addVideo({ status: 'done' });
  addVideo({ status: 'quote' });
  let r = await get(`studio-videos=${CHAR}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=20, s-maxage=30');
  assert.deepEqual(r.body.videos.map((v) => v.id), [done]);
  assert.deepEqual((await get(`studio-videos=${CHAR2}`)).body, { videos: [] });
  assert.equal((await get('studio-videos=nope')).status, 400);
  fake.missing.add('studio_video_list');
  assert.deepEqual([(await get(`studio-videos=${CHAR}`)).status, (await get(`studio-videos=${CHAR}`)).body], [503, { error: 'not_ready' }]);
  fake.missing.clear();
  r = await get('studio-info');
  assert.deepEqual(r.body.video, { on: true, usdCents: 400, seconds: 5, left: 29 });
  process.env.STUDIO_VIDEO_PRICE_USD = '5';
  assert.deepEqual((await get('studio-info')).body.video.usdCents, 500);
  delete process.env.FAL_KEY;
  assert.equal((await get('studio-info')).body.video.on, false);
  process.env.FAL_KEY = FAL_KEY;
  delete process.env.STUDIO_PAY_TO;
  assert.equal((await get('studio-info')).body.video.on, false, 'videos are paid only in USDG');
  assert.deepEqual(await monthLeft(getConfig()), { left: 15, burnsLeft: 10, videosLeft: 29 });
});

// ---------- its owner's actions ----------
test('POST studio-video-mine: videos on or not, whether this wallet made the character (only it makes its videos), its price by level, the month\'s left, its own videos', async () => {
  addVideo({ status: 'quote' });
  const done = addVideo({ status: 'done' });
  let r = await post({ action: 'studio-video-mine', session: sessionFor(WALLET, 2), char: CHAR });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.on, r.body.owner, r.body.allowed, r.body.price, r.body.left, r.body.videos.length], [true, true, true, { usdCents: 320 }, 29, 2]);
  r = await post({ action: 'studio-video-mine', session: sessionFor(OTHER, 3), char: CHAR });
  assert.deepEqual([r.body.owner, r.body.price, r.body.videos.map((v) => v.id)], [false, { usdCents: 240 }, [done]]);
  fake.db.orders.get(CHAR2).status = 'making';
  assert.deepEqual(await post({ action: 'studio-video-mine', session: sessionFor(OTHER), char: CHAR2 }).then((x) => [x.status, x.body.error]), [404, 'gone']);
  assert.deepEqual(await post({ action: 'studio-video-mine', session: sessionFor(), char: 'nope' }).then((x) => [x.status, x.body.error]), [400, 'bad_request']);
  assert.deepEqual(await post({ action: 'studio-video-mine', session: 'nope', char: CHAR }).then((x) => [x.status, x.body.error]), [401, 'signed_out']);
  // private: allowed only for STUDIO_ONLY_FOR's wallets
  delete process.env.STUDIO_OPEN;
  process.env.STUDIO_ONLY_FOR = OTHER;
  assert.equal((await post({ action: 'studio-video-mine', session: sessionFor(), char: CHAR })).body.allowed, false);
  process.env.STUDIO_OPEN = 'yes';
  // without fal.ai's key: off, and its actions say so (and the log tells the owner)
  delete process.env.FAL_KEY;
  r = await post({ action: 'studio-video-mine', session: sessionFor(), char: CHAR });
  assert.deepEqual([r.body.on, r.body.left], [false, 0]);
  assert.deepEqual(await post(quoteBody()).then((x) => [x.status, x.body.error]), [503, 'no_videos']);
  assert.match(log(), /\[studio\] FAL_KEY is missing: its videos are off/);
  // without the studio (Meshy's key): nothing at all
  delete process.env.MESHY_API_KEY;
  assert.deepEqual(await post({ action: 'studio-video-mine', session: sessionFor(), char: CHAR }).then((x) => [x.status, x.body.error]), [503, 'not_ready']);
});

test('POST studio-video-quote: 18+, the human check (or its pass), its words in words, only the wallet that made it, a speed bump', async () => {
  assert.deepEqual(await post(quoteBody({ adult: false })).then((x) => [x.status, x.body.error]), [400, 'adult']);
  fake.human = false;
  assert.deepEqual(await post(quoteBody()).then((x) => [x.status, x.body.error]), [401, 'human_check']);
  fake.human = true;
  const asked = () => calls.filter((c) => c.to === 'turnstile');
  let r = await post(quoteBody());
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.ok, r.body.price, r.body.left], [true, { usdCents: 400 }, 29]);
  assert.match(r.body.id, R.ORDER_ID);
  assert.ok(r.body.pass);
  assert.deepEqual([asked().length, asked().at(-1).body.response, asked().at(-1).body.remoteip], [2, 'ts-token', IP]);
  const pass = r.body.pass;
  r = await post(quoteBody({ turnstileToken: undefined, pass, shape: 'square' }));
  assert.equal(r.status, 200);
  assert.equal(r.body.pass, null, 'its pass still good');
  assert.equal(asked().length, 2, 'no new human check with the pass');
  r = await post(quoteBody({ turnstileToken: undefined, pass, scene: 'dancing with taylor swift on a big stage' }));
  assert.deepEqual([r.status, r.body.error, r.body.field, r.body.why], [422, 'words', 'scene', 'person']);
  assert.deepEqual(await post(quoteBody({ turnstileToken: undefined, pass })).then((x) => [x.status, x.body.error]), [429, 'too_many'], '2 waiting at once');
  assert.deepEqual(await post(quoteBody({ turnstileToken: undefined, pass, session: sessionFor(OTHER) })).then((x) => [x.status, x.body.error]), [403, 'not_yours']);
  assert.deepEqual(await post(quoteBody({ turnstileToken: undefined, pass, char: 'nope' })).then((x) => [x.status, x.body.error]), [404, 'no_char']);
  // a speed bump: 12 a minute (with "Check my payment", per server copy)
  studioActBurst.reset();
  for (let i = 0; i < 12; i++) await post(quoteBody({ turnstileToken: undefined, pass, scene: 'short' }));
  assert.deepEqual(await post(quoteBody({ turnstileToken: undefined, pass })).then((x) => [x.status, x.body.error]), [429, 'too_fast']);
});

test('POST studio-video-check, studio-video-look and studio-video-redo: paying for it, watching its own being made (never someone else\'s), making it again', async () => {
  const session = sessionFor();
  const { body: q } = await post(quoteBody());
  const id = q.id;
  usdgPay(txOf(1), 400);
  let r = await post({ action: 'studio-video-check', session, id, tx: `https://robinhoodchain.blockscout.com/tx/${txOf(1)}` });
  assert.deepEqual([r.status, r.body.ok, r.body.paid, r.body.have, r.body.need], [200, true, true, 400, 400]);
  assert.deepEqual(await post({ action: 'studio-video-check', session, id, tx: 'not a transaction' }).then((x) => [x.status, x.body.error]), [400, 'bad_tx']);
  assert.deepEqual(await post({ action: 'studio-video-check', session: sessionFor(OTHER), id }).then((x) => [x.status, x.body.error]), [403, 'not_yours']);
  assert.deepEqual(await post({ action: 'studio-video-check', session, id: 'nope' }).then((x) => [x.status, x.body.error]), [400, 'bad_request']);
  // looking at its own: moved along a step (sent to the video service), its place in the queue
  r = await post({ action: 'studio-video-look', session, id });
  assert.deepEqual([r.status, r.body.video.status, r.body.video.step], [200, 'making', 'make']);
  assert.ok(calls.some((c) => c.to === 'fal' && c.method === 'POST'));
  free(id);
  r = await post({ action: 'studio-video-look', session, id });
  assert.deepEqual([r.body.video.step, r.body.video.position], ['queue', 2]);
  for (const text of [JSON.stringify(r.body)]) for (const never of ['queue.fal.run', row(id).req, 'wallet_code']) assert.ok(!text.includes(never), never);
  assert.deepEqual(await post({ action: 'studio-video-look', session: sessionFor(OTHER), id }).then((x) => [x.status, x.body.error]), [404, 'gone'], "never someone else's");
  // done: what its page shows
  free(id);
  reqOf(id).status = 'COMPLETED';
  r = await post({ action: 'studio-video-look', session, id });
  assert.deepEqual([r.body.video.status, r.body.video.bytes], ['done', MP4.length]);
  // one that couldn't be made: made again (free), its words checked first
  const failed = addVideo({ status: 'failed', error: 'refused', credit: true });
  r = await post({ action: 'studio-video-redo', session, id: failed, scene: 'a sexy dance in lingerie on a bed', shape: 'tall', sound: true });
  assert.deepEqual([r.status, r.body.error, r.body.field, r.body.why], [422, 'words', 'scene', 'adult']);
  r = await post({ action: 'studio-video-redo', session, id: failed, scene: 'a calm walk on a beach at sunset', shape: 'wide', sound: false });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  assert.deepEqual(await post({ action: 'studio-video-redo', session, id: failed, scene: SCENE, shape: 'tall' }).then((x) => [x.status, x.body.error]), [409, 'no_credit']);
  // the chain away: "Check my payment" says so
  const { body: q2 } = await post(quoteBody({ shape: 'wide' }));
  usdgPay(txOf(2), 400);
  fake.chain.down = true;
  assert.deepEqual(await post({ action: 'studio-video-check', session, id: q2.id, tx: txOf(2) }).then((x) => [x.status, x.body.error]), [503, 'chain']);
  fake.chain.down = false;
  // the database away
  fake.dbDown = true;
  assert.deepEqual(await post({ action: 'studio-video-look', session, id }).then((x) => [x.status, x.body.error]), [503, 'busy']);
});

// ---------- the rest of what it promises ----------
// (2026-10-10) the old studio page, and its videos section, became AGI Studio the same day: an influencer's videos, paid in
// credits (tests/influencer.test.js). A character's videos made before still play from our own address (the GETs above).
test("videos play from our address, local picks or the exact owner media bucket; no other media host; the safety note", () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /^default-src 'self';/);
  const media = csp.split(';').map((d) => d.trim()).filter((d) => d.startsWith('media-src'));
  const publicMedia = 'https://vujaxukucukjxzhcxlea.supabase.co/storage/v1/object/public/agi1-owner-media/';
  const signedUpload = 'https://vujaxukucukjxzhcxlea.supabase.co/storage/v1/object/upload/sign/agi1-owner-media/';
  assert.deepEqual(media, [`media-src 'self' blob: ${publicMedia}`], 'our address, local picks and the dedicated owner bucket, nothing else');
  assert.doesNotMatch(csp.replaceAll(publicMedia, '').replaceAll(signedUpload, ''), /supabase|fal|\*/, 'no other Supabase path, FAL host or wildcard');
  // the safety note says what AGI Studio's videos do with money and data
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const must of [/the words and choices you give go to AI services that make your influencer's pictures, videos and 3D model/,
    /a photo, picture or clip you upload goes to an AI service that checks it first/, /A photo or picture you upload is deleted once its influencer is made, and a clip within 2 days\./,
    /What's made there is labeled AI-generated and kept in our storage/]) {
    assert.ok(index.search(must) > 0, String(must));
  }
  assert.doesNotMatch(index, /A character's short videos|USDG for a character or its video/, "the old studio's video sentences left with its page");
});

test("still 12 functions; fal.ai's key in the secret check (its value and its shape); studio.sql's promises for its videos; its tests run with the build", () => {
  const fns = readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js'));
  assert.equal(fns.length, 12, fns.join(', '));
  const check = readFileSync(new URL('../scripts/check-secrets.js', import.meta.url), 'utf8');
  assert.match(check, /'FAL_KEY'(?:, 'FAL_BILLING_KEY')?\]/);
  const line = check.split('\n').find((l) => l.includes("'fal.ai key'"));
  const m = /re: \/(.+)\/([a-z]*) \}/.exec(line);
  const re = new RegExp(m[1], m[2]);
  assert.ok(re.test(`const k = "${FAL_KEY}";`));
  assert.ok(!re.test('764cabcf-b745-4b3e-ae38-1200304cf45b'), "a request's id alone is not a key");
  const src = readFileSync(new URL('../api/launch.js', import.meta.url), 'utf8');
  assert.match(src, /const STUDIO_GETS = \[[^\]]*'studio-videos', 'studio-video', 'studio-video-dl'\];/);
  assert.match(src, /'studio-video-mine', 'studio-video-quote',\s+'studio-video-check', 'studio-video-redo', 'studio-video-look'\];/);
  const feed = readFileSync(new URL('../api/feed.js', import.meta.url), 'utf8');
  assert.match(feed, /await import\('\.\.\/server\/studio-video\.js'\)/, 'loaded only for the studio\'s clock');
  const sql = readFileSync(new URL('../supabase/studio.sql', import.meta.url), 'utf8');
  const VIDEO_FNS = ['studio_video_quote', 'studio_video_pay', 'studio_video_get', 'studio_video_lease', 'studio_video_step', 'studio_video_wait', 'studio_video_done',
    'studio_video_fail', 'studio_video_redo', 'studio_video_due', 'studio_video_list', 'studio_video_hide'];
  for (const fn of VIDEO_FNS) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(.*\\) from public, anon, authenticated;`), `${fn}: never the browser's keys`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(.*\\) to service_role;`), fn);
  }
  assert.match(sql, /alter table public\.agi1_studio_videos enable row level security;/);
  assert.match(sql, /alter table public\.agi1_studio_months add column if not exists videos integer not null default 0/);
  assert.match(sql, /status_url\s+text\s+check \(status_url ~ '\^https:\/\/queue\\\.fal\\\.run\//, "only ever fal's queue addresses");
  assert.match(sql, /'agi1-characters', 'agi1-characters', false, 41943040,\s+array\['model\/gltf-binary', 'image\/webp', 'image\/png', 'image\/jpeg', 'video\/mp4', 'application\/octet-stream',\s+'model\/vnd\.usdz\+zip', 'model\/stl', 'application\/zip'\]/);
  const code = sql.replace(/--.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:wallet|address|tx|tx_hash|transaction|ip)\s+(?:text|inet|varchar|bytea)\b/i, 'never an address, a transaction or an IP address');
  const limits = readFileSync(new URL('../server/limits.js', import.meta.url), 'utf8');
  for (const fn of VIDEO_FNS) assert.ok(limits.includes(`'${fn}'`), `${fn}: the log says to run studio.sql again`);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.test, /tests\/videos\.test\.js/);
});
