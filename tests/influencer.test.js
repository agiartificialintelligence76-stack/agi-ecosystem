// AGI Studio, the AI influencer app (2026-10-10, studio.agi1.app): its rules and words, the words the AI services get and
// their requests, the AI checks of what people upload, uploads (tickets, pictures made plain, a clip's parts and its length),
// credits (free first, top-ups once, a holder's free ones), an influencer from start to ready (its looks, its pick, its full
// body), its photos and videos (made, checked, kept), its 3D model, Explore, reports, the owner's tools, deleting it ("Delete
// my face"), the clock and its tidy-up, every GET and POST of api/launch.js for it, the browser's sending code against our
// real server, the page and its promises, and influencers.sql's. Fakes: the database (influencers.sql's rules in JavaScript;
// the SQL itself ran in PGlite), Supabase Storage, fal.ai's queue and media, Gemini, Robinhood Chain, the block explorer and
// Cloudflare.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import * as R from '../src/studio/rules.js';
import * as AW from '../src/studio/app-words.js';
import * as M from '../src/studio/media.js';
import {
  checkStart, checkInfScene, looksPrompt, bodyPrompt, photoPrompt, motionPrompt, clipPrompt, sceneWay, presetPrompt, sceneVideoPrompt,
  CLIP_NEGATIVE, PRESET_NEGATIVE,
} from '../server/inf-words.js';
import { MODELS, jobRequest, outputOf, checkSelfie, checkArt, checkFrames, checkVideo, checkPoster } from '../server/inf-ai.js';
import { makeTicket, readTicket, mp4Seconds, plainJpeg, openUpload, UPLOAD } from '../server/inf-uploads.js';
import { JOBS, jobTick, infClock, picturesOf, picPath, videoPath, posterPath, infOn } from '../server/inf-jobs.js';
import * as I from '../server/influencer.js';
import { creditsOf, grantFree, checkTopup } from '../server/credits.js';
import { infLookBurst, infActBurst, infUpBurst, infFileBurst, INF_POSTS } from '../server/inf-api.js';
import { getConfig } from '../server/config.js';
import { makeSession } from '../server/session.js';
import { studioWallet, _resetStudioKey } from '../server/studio.js';
import { _resetBurnKey, burnWallet } from '../server/burn.js';
import { _resetStudioChain, USDG } from '../server/studio-chain.js';
import { _resetChainCache } from '../server/chain.js';
import { FAL_QUEUE, MODEL_RE } from '../server/fal.js';
import { trouble } from '../server/studio-words.js';
import { launchWallet } from '../server/launch.js';
import { GET as launchGet, POST as launchPost } from '../api/launch.js';
import { GET as feedGet } from '../api/feed.js';

const DAY = 864e5;
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const STUDIO_KEY = 'ab12cd34'.repeat(8);
const BURN_KEY = 'f00dfeed'.repeat(8);
const FAL_KEY = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d:0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const GEMINI_KEY = 'AIzaSyFAKEgeminiKEYforTESTS000000000000';
const OWNER = '0x1111111111111111111111111111111111111111';      // STUDIO_PAY_TO: the studio's wallet
const WALLET = '0x8ba1f109551bd432803012645ac136ddd64dba72';     // someone making influencers
const OTHER = '0x2222222222222222222222222222222222222222';
const BOSS = '0x3333333333333333333333333333333333333333';       // STUDIO_OWNER: the owner's wallet
const SB = 'https://fake.supabase.co';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ENV = {
  SUPABASE_URL: SB, SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: SECRET, TURNSTILE_SECRET_KEY: 'turnstile-secret-for-tests',
  STUDIO_PAY_TO: OWNER, STUDIO_OPEN: 'yes', FAL_KEY, GEMINI_API_KEY: GEMINI_KEY, STUDIO_OWNER: BOSS,
};
const SETTINGS = ['MESHY_API_KEY', 'STUDIO_PAY_TO', 'STUDIO_PRICE_USD', 'STUDIO_PRICE_AGI', 'STUDIO_A_MONTH', 'STUDIO_BURNS_A_MONTH', 'STUDIO_OPEN',
  'STUDIO_ONLY_FOR', 'STUDIO_HIDE', 'STUDIO_OWNER', 'STUDIO_FACES', 'STUDIO_FREE_CREDITS_A_MONTH', 'STUDIO_JOBS_A_DAY', 'ROBINHOOD_RPC_URL',
  'SITE_URL', 'CRON_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'TELEGRAM_BOT_TOKEN', 'PINATA_JWT', 'LAUNCH_GAS_KEY', 'LAUNCH_ONLY_FOR',
  'LIVE_SECRET', 'PRIZE_WALLET_KEY', 'TELEGRAM_GROUPS', 'FAL_KEY', 'STUDIO_VIDEO_PRICE_USD', 'STUDIO_VIDEOS_A_MONTH', 'STUDIO_VIDEO_MODEL'];
const IP = '203.0.113.7';
const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
const topic = (a) => `0x${'0'.repeat(24)}${a.slice(2).toLowerCase()}`;
const txOf = (n) => `0x${pad(n)}`;
const sessionFor = (wallet = WALLET, level = 1) => makeSession(SECRET, { wallet, level, checkedAt: Date.now(), expiresAt: Date.now() + 7 * DAY });
const codeOf = (wallet = WALLET) => studioWallet(SECRET, wallet);
const ID = /^[A-Za-z0-9_-]{22}$/;
const idOf = (s) => `${s}${'0'.repeat(22)}`.slice(0, 22);
const thisMonth = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`; };

// an MP4 as a camera saves it: its type box, its movie header (its length: duration / timescale), and its data
function mp4({ seconds = 5, size = 60_000, v1 = false, moovLast = false } = {}) {
  const box = (type, body) => { const b = Buffer.alloc(8 + body.length); b.writeUInt32BE(8 + body.length, 0); b.write(type, 4, 'latin1'); body.copy(b, 8); return b; };
  const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1'));
  const mvhd = Buffer.alloc(v1 ? 112 : 100);
  mvhd[0] = v1 ? 1 : 0;
  if (v1) { mvhd.writeUInt32BE(1000, 20); mvhd.writeBigUInt64BE(BigInt(Math.round(seconds * 1000)), 24); }
  else { mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(Math.round(seconds * 1000), 16); }
  const moov = box('moov', box('mvhd', mvhd));
  const fill = Math.max(8, size - ftyp.length - moov.length);
  const mdat = box('mdat', Buffer.alloc(fill - 8, 7));
  return moovLast ? Buffer.concat([ftyp, mdat, moov]) : Buffer.concat([ftyp, moov, mdat]);
}
let PNG, JPEG_EXIF, BIG_PNG;

// ---------- the database: influencers.sql's rules, in JavaScript ----------
function database() {
  const now = () => Date.now();
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  const ok = (x = {}) => ({ ok: true, ...x });
  const no = (why, x = {}) => ({ ok: false, why, ...x });
  const code = (s) => typeof s === 'string' && s.length >= 16 && s.length <= 64;
  const db = {
    credits: new Map(), log: [], months: new Map(), uploads: new Map(), infs: new Map(), jobs: new Map(), trends: new Map(),
    reports: [], txs: new Set(), orders: new Map(), free3d: new Map(), studioMade: 0, dayJobs: 0, drafts: new Map(),
    cred(c) { if (!this.credits.has(c)) this.credits.set(c, { paid: 0, free: 0, free_month: null }); return this.credits.get(c); },
    freeNow(c) { const x = this.cred(c); return x.free_month === thisMonth() ? x.free : 0; },
    spend(c, cost, ref) {
      const x = this.cred(c), f = this.freeNow(c);
      if (f + x.paid < cost) return no('short', { paid: x.paid, free: f });
      if (this.log.some((l) => l.kind === 'spend' && l.ref === ref)) return no('taken');
      const fp = Math.min(f, cost), pp = cost - fp;
      this.log.push({ wallet_code: c, kind: 'spend', amount: cost, paid_part: pp, free_part: fp, month: thisMonth(), ref });
      x.paid -= pp; x.free = f - fp;
      return ok({ paid: x.paid, free: f - fp });
    },
    refund(ref) {
      const l = this.log.find((y) => y.kind === 'spend' && y.ref === ref);
      if (!l || this.log.some((y) => y.kind === 'refund' && y.ref === ref)) return false;
      const backFree = l.month === thisMonth() ? l.free_part : 0;
      this.log.push({ wallet_code: l.wallet_code, kind: 'refund', amount: l.paid_part + backFree, paid_part: l.paid_part, free_part: backFree, month: thisMonth(), ref });
      const x = this.cred(l.wallet_code);
      x.paid += l.paid_part;
      if (x.free_month === thisMonth()) x.free += backFree;
      return true;
    },
    dayTake(cap) { if (this.dayJobs >= cap) return false; this.dayJobs += 1; return true; },
    burn_key() { return BURN_KEY; },
    studio_key() { return STUDIO_KEY; },
    studio_seen({ p_txs }) { return [...new Set((p_txs || []).filter((t) => this.txs.has(t)))].sort(); },
    studio_fail({ p_id, p_error }) { const o = this.orders.get(p_id); if (!o) return false; Object.assign(o, { status: 'failed', error: p_error }); return true; },
    studio_hide({ p_id, p_hidden }) { const o = this.orders.get(p_id); if (!o) return false; o.hidden = p_hidden; return true; },
    inf_credits({ p_wallet }) { const x = this.cred(p_wallet); return { paid: x.paid, free: this.freeNow(p_wallet), month: thisMonth() }; },
    inf_topup({ p_wallet, p_tx, p_cents }) {
      if (!code(p_wallet) || !code(p_tx) || !(Number.isInteger(p_cents) && p_cents >= 1 && p_cents <= 1e7)) return no('bad');
      if (this.txs.has(p_tx)) return no('used');
      this.txs.add(p_tx);
      const x = this.cred(p_wallet);
      x.paid = Math.min(x.paid + p_cents, 1e8);
      this.log.push({ wallet_code: p_wallet, kind: 'topup', amount: p_cents, ref: p_tx });
      return ok({ paid: x.paid });
    },
    inf_free({ p_wallet, p_amount, p_cap }) {
      if (!code(p_wallet) || !(p_cap >= 0)) return { granted: false, why: 'bad', free: 0 };
      if (!(p_amount > 0 && p_amount <= 100000)) return { granted: false, why: 'level', free: 0 };
      const x = this.cred(p_wallet), m = thisMonth();
      if (x.free_month === m) return { granted: false, why: 'done', free: x.free };
      const given = this.months.get(m) || 0;
      if (given + p_amount > p_cap) return { granted: false, why: 'cap', free: 0 };
      Object.assign(x, { free: p_amount, free_month: m });
      this.months.set(m, given + p_amount);
      return { granted: true, free: p_amount };
    },
    inf_upload_open({ p_id, p_wallet, p_kind, p_per_day }) {
      if (!ID.test(String(p_id)) || !code(p_wallet) || !['picture', 'face', 'clip'].includes(p_kind) || !(p_per_day >= 1)) return no('bad');
      if ([...this.uploads.values()].filter((u) => u.wallet_code === p_wallet && u.created > now() - DAY).length >= p_per_day) return no('too_many');
      if (this.uploads.has(p_id)) return no('taken');
      this.uploads.set(p_id, { id: p_id, wallet_code: p_wallet, kind: p_kind, status: 'open', why: null, seconds: null, created: now() });
      return ok();
    },
    inf_upload_get({ p_id }) { const u = this.uploads.get(p_id); return u ? { ...u, created_at: iso(u.created) } : null; },
    inf_upload_set({ p_id, p_status, p_why, p_seconds }) {
      const u = this.uploads.get(p_id);
      if (!['ok', 'refused'].includes(p_status) || !u || !['open', 'ok'].includes(u.status)) return false;
      Object.assign(u, { status: p_status, why: p_why ? String(p_why).slice(0, 40) : null, seconds: p_seconds ?? u.seconds });
      return true;
    },
    inf_start(a) {
      if (!ID.test(String(a.p_id)) || !ID.test(String(a.p_job)) || a.p_id === a.p_job || !code(a.p_wallet) || !a.p_name || [...a.p_name].length > 24
        || !['design', 'picture', 'face'].includes(a.p_mode) || !['real', 'anime', 'toon'].includes(a.p_style) || typeof a.p_settings !== 'object'
        || [...(a.p_words || '')].length > 200 || ![1, 2, 3].includes(a.p_level) || !(a.p_cost >= 0 && a.p_cost <= 100000)
        || !(a.p_per_wallet >= 1) || !(a.p_day_cap >= 1) || (a.p_mode === 'design') !== (a.p_source === null)) return no('bad');
      if (a.p_source !== null) {
        const u = this.uploads.get(a.p_source);
        if (!u || u.wallet_code !== a.p_wallet || u.kind !== a.p_mode || u.status !== 'ok') return no('source');
      }
      if ([...this.infs.values()].filter((i) => i.wallet_code === a.p_wallet && ['looks', 'pick', 'body'].includes(i.status)).length >= a.p_per_wallet) return no('too_many');
      if (this.infs.has(a.p_id) || this.jobs.has(a.p_job)) return no('taken');
      if (!this.dayTake(a.p_day_cap)) return no('busy_day');
      const s = a.p_cost > 0 ? this.spend(a.p_wallet, a.p_cost, a.p_job) : { ok: true, ...this.inf_credits({ p_wallet: a.p_wallet }) };
      if (!s.ok) { this.dayJobs -= 1; return s; }                // (the SQL's exception block rolls its day back)
      this.infs.set(a.p_id, {
        id: a.p_id, wallet_code: a.p_wallet, name: a.p_name, mode: a.p_mode, style: a.p_style, settings: a.p_settings, words: a.p_words || '',
        source: a.p_source, status: 'looks', first_job: a.p_job, looks_job: null, pick: null, body_job: null, body_tries: 0, error: null,
        public: a.p_mode !== 'face', hidden: false, level: a.p_level, created: now(), updated: now(), ready: null,
      });
      this.addJob({ id: a.p_job, inf_id: a.p_id, wallet_code: a.p_wallet, kind: 'looks', cost: a.p_cost });
      if (a.p_source) this.uploads.get(a.p_source).status = 'used';
      return ok({ paid: s.paid, free: s.free });
    },
    addJob(j) {
      this.jobs.set(j.id, {
        scene: null, shape: null, sound: false, trend: null, clip: null, image: null, pick: null, status: 'paid', req: null, status_url: null,
        result_url: null, saving: false, tries: 0, error: null, refunded: false, files: null, bytes: null, poster: false, hidden: false,
        started: null, created: now(), updated: now(), done: null, lease: 0, ...j,
      });
    },
    inf_get({ p_id }) {
      const i = this.infs.get(p_id);
      if (!i) return null;
      const job = [...this.jobs.values()].filter((j) => j.inf_id === p_id && ['looks', 'body'].includes(j.kind) && ['paid', 'making'].includes(j.status))
        .sort((x, y) => y.created - x.created)[0];
      return {
        ...i, created_at: iso(i.created), updated_at: iso(i.updated), ready_at: iso(i.ready),
        job: job ? { id: job.id, kind: job.kind, status: job.status, saving: job.saving, req: job.req !== null } : null,
      };
    },
    inf_pick({ p_id, p_wallet, p_look, p_job }) {
      if (!(Number.isInteger(p_look) && p_look >= 0 && p_look <= 3) || !ID.test(String(p_job))) return no('bad');
      const i = this.infs.get(p_id);
      if (!i || i.status === 'deleted') return no('gone');
      if (i.wallet_code !== p_wallet) return no('not_yours');
      if (i.status !== 'pick' || !i.looks_job) return no('state');
      if (this.jobs.has(p_job)) return no('taken');
      this.addJob({ id: p_job, inf_id: p_id, wallet_code: p_wallet, kind: 'body', pick: p_look, cost: 0 });
      Object.assign(i, { status: 'body', pick: p_look, error: null, updated: now() });
      return ok();
    },
    inf_reroll({ p_id, p_wallet, p_job, p_cost, p_day_cap }) {
      if (!ID.test(String(p_job)) || !(p_cost >= 0 && p_cost <= 100000) || p_day_cap === null) return no('bad');
      const i = this.infs.get(p_id);
      if (!i || i.status === 'deleted') return no('gone');
      if (i.wallet_code !== p_wallet) return no('not_yours');
      if (i.status !== 'pick') return no('state');
      if (this.jobs.has(p_job)) return no('taken');
      if (!this.dayTake(p_day_cap)) return no('busy_day');
      const s = this.spend(p_wallet, p_cost, p_job);
      if (!s.ok) { this.dayJobs -= 1; return s; }
      this.addJob({ id: p_job, inf_id: p_id, wallet_code: p_wallet, kind: 'looks', cost: p_cost });
      Object.assign(i, { status: 'looks', error: null, updated: now() });
      return ok({ paid: s.paid, free: s.free });
    },
    inf_make(a) {
      if (!ID.test(String(a.p_job)) || !['photo', 'trend', 'video'].includes(a.p_kind) || !(a.p_cost >= 0 && a.p_cost <= 100000) || !(a.p_per_wallet >= 1)
        || a.p_day_cap === null
        || (['photo', 'video'].includes(a.p_kind) && (!a.p_scene || [...a.p_scene].length > 300 || !['tall', 'wide', 'square'].includes(a.p_shape) || a.p_trend !== null || a.p_clip !== null))
        || (a.p_kind === 'trend' && ((a.p_trend === null) === (a.p_clip === null) || a.p_scene !== null))
        || (a.p_kind === 'photo' && a.p_image !== null)) return no('bad');
      const i = this.infs.get(a.p_inf);
      if (!i || i.status === 'deleted' || i.hidden) return no('gone');
      if (i.wallet_code !== a.p_wallet) return no('not_yours');
      if (i.status !== 'ready' || !i.body_job) return no('not_ready');
      if (a.p_trend !== null) {
        const t = this.trends.get(a.p_trend);
        if (!t || t.status !== 'kept' || this.jobs.get(t.job)?.status !== 'done') return no('trend');
      }
      if (a.p_clip !== null) {
        const u = this.uploads.get(a.p_clip);
        if (!u || u.wallet_code !== a.p_wallet || u.kind !== 'clip' || u.status !== 'ok' || u.created < now() - DAY) return no('clip');
      }
      if (a.p_image !== null) {
        const p = this.jobs.get(a.p_image);
        if (!p || p.inf_id !== a.p_inf || p.kind !== 'photo' || p.status !== 'done' || p.hidden) return no('image');
      }
      if ([...this.jobs.values()].filter((j) => j.wallet_code === a.p_wallet && ['paid', 'making'].includes(j.status)).length >= a.p_per_wallet) return no('too_many');
      if (this.jobs.has(a.p_job)) return no('taken');
      if (!this.dayTake(a.p_day_cap)) return no('busy_day');
      const s = a.p_cost > 0 ? this.spend(a.p_wallet, a.p_cost, a.p_job) : { ok: true, ...this.inf_credits({ p_wallet: a.p_wallet }) };
      if (!s.ok) { this.dayJobs -= 1; return s; }
      this.addJob({ id: a.p_job, inf_id: a.p_inf, wallet_code: a.p_wallet, kind: a.p_kind, scene: a.p_scene, shape: a.p_shape,
        sound: a.p_sound === true && a.p_kind === 'video', trend: a.p_trend, clip: a.p_clip, image: a.p_image, cost: a.p_cost });
      return ok({ paid: s.paid, free: s.free });
    },
    inf_job_get({ p_id }) {
      const j = this.jobs.get(p_id);
      if (!j) return null;
      const i = j.inf_id ? this.infs.get(j.inf_id) : null;
      return {
        ...j, started_at: iso(j.started), created_at: iso(j.created), updated_at: iso(j.updated), done_at: iso(j.done),
        inf_name: i?.name ?? null, inf_mode: i?.mode ?? null, inf_style: i?.style ?? null, inf_settings: i?.settings ?? null, inf_words: i?.words ?? null,
        inf_source: i?.source ?? null, inf_status: i?.status ?? null, inf_looks_job: i?.looks_job ?? null, inf_pick: i?.pick ?? null,
        inf_body_job: i?.body_job ?? null, inf_hidden: i?.hidden ?? null, inf_public: i?.public ?? null,
        trend_job: j.trend ? this.trends.get(j.trend)?.job ?? null : null,
      };
    },
    inf_job_lease({ p_id, p_secs }) {
      const j = this.jobs.get(p_id);
      if (!j || !['paid', 'making'].includes(j.status) || j.lease > now()) return null;
      j.lease = now() + Math.min(Math.max(p_secs || 45, 5), 300) * 1000;
      return true;
    },
    inf_job_step({ p_id, p_req, p_status_url, p_result_url, p_saving, p_tries }) {
      const j = this.jobs.get(p_id);
      if ((p_req !== null && !/^[A-Za-z0-9_-]{6,80}$/.test(p_req)) || typeof p_saving !== 'boolean' || !(p_tries >= 0 && p_tries <= 20)) return false;
      if (!j || !['paid', 'making'].includes(j.status)) return false;
      Object.assign(j, { started: j.status === 'paid' ? now() : j.started, status: 'making', req: p_req, status_url: p_status_url, result_url: p_result_url,
        saving: p_saving, tries: p_tries, lease: 0, updated: now() });
      return true;
    },
    inf_job_wait({ p_id }) { const j = this.jobs.get(p_id); if (!j || !['paid', 'making'].includes(j.status)) return null; j.lease = now() + 3000; return true; },
    inf_job_done({ p_id, p_files, p_bytes }) {
      if (!(p_files >= 0 && p_files <= 4) || !(p_bytes >= 1 && p_bytes <= 1e8)) return false;
      const j = this.jobs.get(p_id);
      if (!j || !['paid', 'making'].includes(j.status)) return false;
      Object.assign(j, { status: 'done', files: p_files, bytes: p_bytes, saving: false, status_url: null, result_url: null, lease: 0, error: null, done: now(), updated: now() });
      const i = this.infs.get(j.inf_id);
      if (j.kind === 'looks' && i?.status === 'looks') Object.assign(i, { status: 'pick', looks_job: p_id, error: null, updated: now() });
      if (j.kind === 'body' && i?.status === 'body') Object.assign(i, { status: 'ready', body_job: p_id, error: null, ready: now(), updated: now() });
      if (j.kind === 'preset') { const t = this.trends.get(j.trend); if (t?.job === p_id) Object.assign(t, { status: 'review', updated: now() }); }
      return true;
    },
    inf_job_fail({ p_id, p_error, p_refund }) {
      const j = this.jobs.get(p_id);
      if (!j || !['paid', 'making'].includes(j.status)) return false;
      Object.assign(j, { status: 'failed', error: String(p_error || 'failed').slice(0, 200), saving: false, lease: 0, updated: now() });
      if (p_refund !== false && j.cost > 0 && !j.refunded) { this.refund(p_id); j.refunded = true; }
      if (j.kind === 'preset') { const t = this.trends.get(j.trend); if (t?.job === p_id) t.status = 'failed'; return true; }
      const i = this.infs.get(j.inf_id);
      if (!i) return true;
      if (j.kind === 'looks' && i.status === 'looks') Object.assign(i, { status: i.looks_job ? 'pick' : 'failed', error: p_error });
      else if (j.kind === 'body' && i.status === 'body') {
        if (i.body_tries + 1 >= 3) {
          Object.assign(i, { status: 'failed', body_tries: i.body_tries + 1, error: p_error });
          if (i.first_job && this.refund(i.first_job)) this.jobs.get(i.first_job).refunded = true;
        } else Object.assign(i, { status: 'pick', body_tries: i.body_tries + 1, error: p_error });
      }
      return true;
    },
    inf_job_due({ p_limit }) {
      return [...this.jobs.values()].filter((j) => ['paid', 'making'].includes(j.status) && j.lease <= now()).sort((x, y) => x.updated - y.updated)
        .slice(0, p_limit || 6).map((j) => j.id);
    },
    inf_poster({ p_job }) {
      const j = this.jobs.get(p_job);
      if (!j || j.status !== 'done' || !['trend', 'video', 'preset'].includes(j.kind)) return null;
      j.poster = true;
      return true;
    },
    inf_jobs({ p_inf, p_wallet, p_limit }) {
      return [...this.jobs.values()].filter((j) => j.inf_id === p_inf && ['photo', 'trend', 'video'].includes(j.kind)
        && ((j.status === 'done' && !j.hidden) || (p_wallet && j.wallet_code === p_wallet && j.status !== 'done' && j.updated > now() - 7 * DAY)))
        .sort((x, y) => (y.done || y.created) - (x.done || x.created)).slice(0, p_limit || 40)
        .map((j) => ({
          id: j.id, kind: j.kind, scene: j.scene, shape: j.shape, sound: j.sound, trend: j.trend, clip: j.clip !== null, image: j.image, status: j.status,
          step: j.saving ? 'save' : j.req ? 'make' : 'queue', error: j.error, refunded: j.refunded, cost: j.cost, files: j.files, bytes: j.bytes,
          poster: j.poster, created_at: iso(j.created), done_at: iso(j.done), mine: Boolean(p_wallet) && j.wallet_code === p_wallet,
        }));
    },
    inf_mine({ p_wallet }) {
      return [...this.infs.values()].filter((i) => i.wallet_code === p_wallet && i.status !== 'deleted').sort((x, y) => y.created - x.created)
        .map((i) => ({ id: i.id, name: i.name, mode: i.mode, style: i.style, status: i.status, looks_job: i.looks_job, pick: i.pick, body_job: i.body_job,
          public: i.public, hidden: i.hidden, created_at: iso(i.created), ready_at: iso(i.ready) }));
    },
    inf_explore() {
      const shown = (i) => i && i.status === 'ready' && i.public && !i.hidden && i.mode !== 'face';
      return {
        influencers: [...this.infs.values()].filter(shown).sort((x, y) => y.ready - x.ready)
          .map((i) => ({ id: i.id, name: i.name, style: i.style, looks_job: i.looks_job, pick: i.pick, body_job: i.body_job, ready_at: iso(i.ready) })),
        fresh: [...this.jobs.values()].filter((j) => j.status === 'done' && ['trend', 'video'].includes(j.kind) && !j.hidden && shown(this.infs.get(j.inf_id)))
          .sort((x, y) => y.done - x.done).map((j) => {
            const i = this.infs.get(j.inf_id);
            return { id: j.id, kind: j.kind, shape: j.shape, trend: j.trend, poster: j.poster, inf_id: j.inf_id, inf_name: i.name, looks_job: i.looks_job, pick: i.pick, done_at: iso(j.done) };
          }),
        trends: [...this.trends.values()].filter((t) => t.status === 'kept' && this.jobs.get(t.job)?.status === 'done')
          .map((t) => ({ id: t.id, job: t.job, poster: this.jobs.get(t.job).poster, bytes: this.jobs.get(t.job).bytes })),
      };
    },
    inf_public({ p_id, p_wallet, p_public }) {
      const i = this.infs.get(p_id);
      if (!i || i.status === 'deleted') return no('gone');
      if (i.wallet_code !== p_wallet) return no('not_yours');
      if (i.mode === 'face' && p_public) return no('face');
      i.public = p_public === true;
      return ok();
    },
    inf_delete({ p_id, p_wallet }) {
      const i = this.infs.get(p_id);
      if (!i || i.status === 'deleted') return no('gone');
      if (i.wallet_code !== p_wallet) return no('not_yours');
      for (const j of this.jobs.values()) {
        if (j.inf_id !== p_id || !['paid', 'making'].includes(j.status)) continue;
        Object.assign(j, { status: 'failed', error: 'deleted', lease: 0 });
        if (j.cost > 0 && !j.refunded && this.refund(j.id)) j.refunded = true;
      }
      Object.assign(i, { status: 'deleted', hidden: true, public: false, updated: now() });
      const u = this.uploads.get(i.source);
      if (u) Object.assign(u, { status: 'refused', why: 'deleted' });
      return ok({ source: i.source });
    },
    inf_hide({ p_id, p_hidden }) { const i = this.infs.get(p_id); if (!i || i.status === 'deleted') return null; i.hidden = p_hidden !== false; return true; },
    inf_job_hide({ p_id, p_hidden }) { const j = this.jobs.get(p_id); if (!j) return null; j.hidden = p_hidden !== false; return true; },
    inf_3d(a) {
      if (!ID.test(String(a.p_order)) || !code(a.p_burn) || ![1, 2, 3].includes(a.p_level) || !(a.p_cost >= 0) || a.p_cap === null) return no('bad');
      const i = this.infs.get(a.p_inf);
      if (!i || i.status === 'deleted' || i.hidden) return no('gone');
      if (i.wallet_code !== a.p_wallet) return no('not_yours');
      if (i.status !== 'ready' || !i.body_job) return no('not_ready');
      if ([...this.orders.values()].some((o) => o.inf_id === a.p_inf && ['paid', 'making'].includes(o.status))) return no('busy3d');
      if (this.studioMade >= a.p_cap) return no('sold_out');
      if (this.orders.has(a.p_order)) return no('taken');
      const key = `${a.p_wallet}:${thisMonth()}`;
      let free = false, s;
      if (a.p_free && !this.free3d.has(key)) { this.free3d.set(key, a.p_order); free = true; s = this.inf_credits({ p_wallet: a.p_wallet }); }
      else { s = this.spend(a.p_wallet, a.p_cost, a.p_order); if (!s.ok) return s; }
      this.orders.set(a.p_order, { id: a.p_order, inf_id: a.p_inf, wallet_code: a.p_wallet, burn_code: a.p_burn, status: 'paid', step: null, error: null,
        moves: null, hidden: false, free, image_path: `inf/${a.p_inf}/${i.body_job}-0.jpg`, created: now(), done: null });
      this.studioMade += 1;
      return ok({ free, paid: s.paid, free_credits: s.free });
    },
    inf_3d_back({ p_order }) {
      const back = this.refund(p_order);
      let found = false;
      for (const [k, v] of this.free3d) if (v === p_order) { this.free3d.delete(k); found = true; }
      return back || found;
    },
    inf_3d_list({ p_inf }) {
      return [...this.orders.values()].filter((o) => o.inf_id === p_inf && !o.hidden).sort((x, y) => y.created - x.created)
        .map((o) => ({ id: o.id, status: o.status, step: o.step, error: o.error, moves: o.moves, glb_bytes: null, created_at: iso(o.created), done_at: iso(o.done) }));
    },
    trend_make({ p_trend, p_job, p_sort }) {
      if (!/^[a-z][a-z0-9-]{1,30}$/.test(String(p_trend)) || !ID.test(String(p_job))) return no('bad');
      if ([...this.jobs.values()].some((j) => j.trend === p_trend && j.kind === 'preset' && ['paid', 'making'].includes(j.status))) return no('busy');
      if (this.jobs.has(p_job)) return no('taken');
      this.addJob({ id: p_job, inf_id: null, wallet_code: null, kind: 'preset', trend: p_trend, cost: 0 });
      this.trends.set(p_trend, { id: p_trend, status: 'making', job: p_job, sort: p_sort, updated: now() });
      return ok();
    },
    trend_set({ p_trend, p_status }) {
      const t = this.trends.get(p_trend);
      if (!t || !['kept', 'hidden'].includes(p_status) || !['review', 'kept', 'hidden'].includes(t.status) || this.jobs.get(t.job)?.status !== 'done') return null;
      Object.assign(t, { status: p_status, updated: now() });
      return true;
    },
    trend_list() {
      return [...this.trends.values()].sort((x, y) => x.sort - y.sort).map((t) => {
        const j = this.jobs.get(t.job);
        return { id: t.id, status: t.status, job: t.job, job_status: j?.status ?? null, error: j?.error ?? null, poster: j?.poster ?? false, bytes: j?.bytes ?? null, updated_at: iso(t.updated) };
      });
    },
    inf_report({ p_inf, p_job, p_why, p_who, p_cap }) {
      if (!ID.test(String(p_inf)) || (p_job !== null && !ID.test(String(p_job))) || !code(p_who) || !Object.hasOwn(R.REPORT_WHYS, p_why) || p_cap === null) return no('bad');
      const i = this.infs.get(p_inf);
      if (!i || i.status === 'deleted') return no('gone');
      if (this.reports.filter((r) => r.who === p_who).length >= p_cap) return no('too_many');
      if (!this.reports.some((r) => r.inf === p_inf && r.job === p_job && r.why === p_why && r.who === p_who)) this.reports.push({ inf: p_inf, job: p_job, why: p_why, who: p_who, at: now() });
      return ok();
    },
    inf_reports() {
      const groups = new Map();
      for (const r of this.reports) {
        const k = `${r.inf}:${r.job || ''}`;
        const g = groups.get(k) || { inf_id: r.inf, job_id: r.job, count: 0, whys: new Set(), at: 0 };
        g.count += 1; g.whys.add(r.why); g.at = Math.max(g.at, r.at);
        groups.set(k, g);
      }
      return [...groups.values()].sort((x, y) => y.at - x.at).map((g) => {
        const i = this.infs.get(g.inf_id);
        return { ...g, whys: [...g.whys], at: iso(g.at), name: i.name, mode: i.mode, hidden: i.hidden || Boolean(g.job_id && this.jobs.get(g.job_id)?.hidden) };
      });
    },
    inf_report_clear({ p_inf, p_job }) {
      const before = this.reports.length;
      this.reports = this.reports.filter((r) => !(r.inf === p_inf && (r.job || '') === (p_job || '')));
      return before !== this.reports.length ? true : null;
    },
    inf_tidy() {
      const ups = [...this.uploads.values()].filter((u) => (['open', 'ok', 'refused'].includes(u.status) && u.created < now() - 2 * DAY)
        || (u.status === 'refused' && u.why === 'deleted')
        || (u.status === 'used' && ![...this.infs.values()].some((i) => i.source === u.id && ['looks', 'pick', 'body'].includes(i.status))));
      for (const u of ups) this.uploads.delete(u.id);
      const infs = [...this.infs.values()].filter((i) => (i.status === 'failed' && i.updated < now() - 30 * DAY) || (i.status === 'deleted' && i.updated < now() - 7 * DAY));
      for (const i of infs) this.infs.delete(i.id);
      return { uploads: ups.map((u) => ({ id: u.id, kind: u.kind })), infs: infs.map((i) => i.id), jobs: 0, reports: 0 };
    },
    launch_draft_put({ p_id, p_chat, p_name, p_symbol, p_desc, p_photo }) {
      if (!ID.test(String(p_id)) || !code(p_chat) || !p_photo || p_photo.length < 10 || p_photo.length > 300) return no('bad');
      const expires = now() + 2 * 3600e3;
      this.drafts.set(p_id, { id: p_id, chat: p_chat, name: p_name, symbol: p_symbol, description: p_desc, photo: p_photo, expires });
      return ok({ expires: iso(expires) });
    },
    launch_draft_get({ p_id }) {
      const d = this.drafts.get(p_id);
      return d ? { id: d.id, name: d.name, symbol: d.symbol, description: d.description, photo: d.photo, cid: null, wallet: null, predicted: null,
        token: null, launch_tx: null, expires: iso(d.expires), expired: d.expires < now() } : null;
    },
  };
  return db;
}

let fake, calls, logs;
const quiet = { error: console.error, warn: console.warn, log: console.log };
beforeEach(async () => {
  for (const k of SETTINGS) delete process.env[k];
  Object.assign(process.env, ENV);
  _resetStudioKey(); _resetBurnKey(); _resetStudioChain(); _resetChainCache();
  for (const b of [infLookBurst, infActBurst, infUpBurst, infFileBurst]) b.reset();
  logs = [];
  console.error = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' ')); console.log = (...a) => logs.push(a.join(' '));
  calls = [];
  PNG ??= await sharp({ create: { width: 640, height: 960, channels: 3, background: { r: 200, g: 120, b: 220 } } }).png().toBuffer();
  BIG_PNG ??= await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 30, g: 160, b: 90 } } }).png().toBuffer();
  JPEG_EXIF ??= await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 240, g: 200, b: 160 } } })
    .withExif({ IFD0: { ImageDescription: 'taken at 12 Secret Street', Copyright: 'someone' } }).jpeg().toBuffer();
  fake = {
    db: database(), dbDown: false, missing: new Set(),
    storage: new Map(), storageDown: false,
    fal: { requests: new Map(), n: 0, submitFail: [], statusAnswer: null, statusFail: null, resultAnswer: null, resultFail: null, mediaStatus: 200, video: mp4({ seconds: 5 }), images: null },
    gemini: { selfie: null, art: null, frames: null, video: null, poster: null, status: 200, blocked: false },
    chain: { receipts: new Map(), blockTime: Date.now() + 5000, down: false },
    explorer: { items: [], status: 200 },
    human: true,
  };
  globalThis.fetch = fakeFetch;
});
process.on('exit', () => Object.assign(console, quiet));

// the verdicts Gemini gives by default (all pass), by what it's asked to look at
const VERDICTS = {
  selfie: { faces: 1, photo: true, apparentAge: 29, adult: true, screen: false, explicit: false, hateful: false, violent: false, other: false },
  art: { characters: 1, photo: false, adult: true, known: false, explicit: false, hateful: false, violent: false, other: false },
  frames: { people: 1, adult: true, explicit: false, hateful: false, violent: false, other: false },
  video: { explicit: false, minor: false, hateful: false, violent: false, other: false },
  poster: { same: true, explicit: false, minor: false, hateful: false, violent: false, other: false },
};
const whichCheck = (system) => (/selfie/.test(system) ? 'selfie' : /uploaded to turn into/.test(system) ? 'art' : /frames from a short video/.test(system) ? 'frames'
  : /thumbnail/.test(system) ? 'poster' : /AI-made video/.test(system) ? 'video' : 'unknown');

async function fakeFetch(url, init = {}) {
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
  // Supabase Storage
  const OBJ = `${SB}/storage/v1/object/`;
  if (url.startsWith(`${OBJ}sign/agi1-characters/`)) {
    const name = url.slice(`${OBJ}sign/agi1-characters/`.length);
    calls.push({ to: 'sign', name, body: JSON.parse(init.body) });
    if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
    if (!fake.storage.has(name)) return new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
    return Response.json({ signedURL: `/object/sign/agi1-characters/${name}?token=signed.${name.replace(/[^A-Za-z0-9]/g, '')}.sig` });
  }
  if (url.startsWith(`${OBJ}authenticated/agi1-characters/`)) {
    const name = url.slice(`${OBJ}authenticated/agi1-characters/`.length);
    const range = init.headers?.Range;
    calls.push({ to: 'read', name, range });
    if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
    const f = fake.storage.get(name);
    if (!f) return new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 });
    const m = range ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
    if (m) {
      const start = Number(m[1]), end = Math.min(Number(m[2]), f.bytes.length - 1);
      return new Response(f.bytes.subarray(start, end + 1), { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${f.bytes.length}`, 'Content-Type': f.type } });
    }
    return new Response(f.bytes, { headers: { 'Content-Type': f.type } });
  }
  if (url === `${OBJ}list/agi1-characters`) {
    const { prefix } = JSON.parse(init.body);
    calls.push({ to: 'list', prefix });
    if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
    const names = [...fake.storage.keys()].filter((n) => n.startsWith(`${prefix}/`) && !n.slice(prefix.length + 1).includes('/'));
    return Response.json(names.map((n) => ({ id: `id-${n}`, name: n.slice(prefix.length + 1) })));
  }
  if (url === `${OBJ}agi1-characters` && method === 'DELETE') {
    const { prefixes } = JSON.parse(init.body);
    calls.push({ to: 'delete', names: prefixes });
    if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
    const gone = prefixes.filter((n) => fake.storage.delete(n));
    return Response.json(gone.map((n) => ({ name: n })));
  }
  if (url.startsWith(`${OBJ}agi1-characters/`)) {
    const name = url.slice(`${OBJ}agi1-characters/`.length);
    calls.push({ to: 'put', name, type: init.headers['Content-Type'] });
    if (fake.storageDown) return new Response('{"message":"internal"}', { status: 500 });
    fake.storage.set(name, { bytes: Buffer.from(init.body), type: init.headers['Content-Type'] });
    return Response.json({ Key: `agi1-characters/${name}` });
  }
  // fal.ai's queue
  if (url.startsWith(`${FAL_QUEUE}/`)) {
    const path = url.slice(FAL_QUEUE.length + 1);
    calls.push({ to: 'fal', method, path, auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null, redirect: init.redirect });
    if (method === 'POST') {
      const f = fake.fal.submitFail.shift();
      if (f) return new Response(f.text, { status: f.status });
      const id = `0193c2aa-1b2c-7d3e-8f40-${String(++fake.fal.n).padStart(12, '0')}`;
      fake.fal.requests.set(id, { id, model: path, input: JSON.parse(init.body), status: 'IN_QUEUE', position: 2, error: null });
      const app = path.split('/').slice(0, 2).join('/');
      return Response.json({ request_id: id, response_url: `${FAL_QUEUE}/${app}/requests/${id}`, status_url: `${FAL_QUEUE}/${app}/requests/${id}/status` });
    }
    const m = /requests\/([^/]+)(\/status)?$/.exec(path);
    const r = m && fake.fal.requests.get(m[1]);
    if (!r) return Response.json({ detail: 'Request not found' }, { status: 404 });
    if (m[2]) {
      if (fake.fal.statusFail) return new Response(fake.fal.statusFail.text, { status: fake.fal.statusFail.status });
      if (fake.fal.statusAnswer) return Response.json(fake.fal.statusAnswer);
      return Response.json({ status: r.status, ...(r.status === 'IN_QUEUE' ? { queue_position: r.position } : {}), ...(r.error ? { error: r.error } : {}) });
    }
    if (fake.fal.resultFail) return new Response(fake.fal.resultFail.text, { status: fake.fal.resultFail.status });
    if (fake.fal.resultAnswer) return Response.json(fake.fal.resultAnswer);
    if (/nano-banana/.test(r.model)) {
      const n = fake.fal.images ?? r.input.num_images ?? 1;
      return Response.json({ images: Array.from({ length: n }, (_, k) => ({ url: `https://v3.fal.media/files/lion/${r.id}-${k}.png`, content_type: 'image/png' })) });
    }
    return Response.json({ video: { url: `https://v3.fal.media/files/zebra/${r.id}.mp4`, content_type: 'video/mp4' } });
  }
  if (/^https:\/\/(?:[a-z0-9-]+\.)?fal\.media\//.test(url)) {
    calls.push({ to: 'media', url, redirect: init.redirect });
    if (fake.fal.mediaStatus !== 200) return new Response('gone', { status: fake.fal.mediaStatus });
    return url.endsWith('.png') ? new Response(PNG, { headers: { 'Content-Type': 'image/png' } }) : new Response(fake.fal.video, { headers: { 'Content-Type': 'video/mp4' } });
  }
  // Gemini (the site's key): its look at an upload or a video
  if (url.startsWith(GEMINI)) {
    const body = JSON.parse(init.body);
    const system = body.systemInstruction.parts[0].text;
    const which = whichCheck(system);
    calls.push({ to: 'gemini', which, model: url.slice(GEMINI.length).split(':')[0], key: init.headers['x-goog-api-key'], body });
    if (fake.gemini.status !== 200) return Response.json({ error: { code: fake.gemini.status, message: `quota for ${GEMINI_KEY}`, status: 'RESOURCE_EXHAUSTED' } }, { status: fake.gemini.status });
    if (fake.gemini.blocked) return Response.json({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } });
    const verdict = { ...VERDICTS[which], ...(fake.gemini[which] || {}) };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] }, finishReason: 'STOP' }] });
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
  if (url.startsWith(EXPLORER)) {
    calls.push({ to: 'explorer', url });
    if (fake.explorer.status !== 200) return new Response('busy', { status: fake.explorer.status });
    return Response.json({ items: fake.explorer.items, next_page_params: null });
  }
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    calls.push({ to: 'turnstile', body: JSON.parse(init.body) });
    return Response.json({ success: fake.human, action: 'studio' });
  }
  throw new Error(`unexpected fetch: ${method} ${url}`);
}

// ---------- helpers ----------
const cfgNow = () => getConfig();
const transferLog = (token, from, to, raw) => ({ address: token, topics: [TRANSFER, topic(from), topic(to)], data: `0x${pad(raw)}`, removed: false });
const usdgPay = (tx, cents, { from = WALLET, to = OWNER } = {}) =>
  fake.chain.receipts.set(tx, { transactionHash: tx, status: '0x1', blockNumber: '0x2a', logs: [transferLog(USDG, from, to, BigInt(cents) * 10n ** 4n)] });
const explorerItem = (tx, { from = WALLET, to = OWNER, at = Date.now() - 30_000 } = {}) =>
  ({ transaction_hash: tx, from: { hash: from }, to: { hash: to }, token: { address_hash: USDG }, timestamp: new Date(at).toISOString() });
const req = (headers = {}) => new Request('https://studio.agi1.app/api/launch', { method: 'POST', headers: { 'x-real-ip': IP, ...headers } });
async function post(body) {
  const res = await launchPost(new Request('https://studio.agi1.app/api/launch', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json(), headers: res.headers };
}
async function postBytes(query, bytes) {
  const res = await launchPost(new Request(`https://studio.agi1.app/api/launch?${query}`, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-real-ip': IP }, body: bytes,
  }));
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function get(q, headers = {}) {
  const res = await launchGet(new Request(`https://studio.agi1.app/api/launch?${q}`, { headers: { 'x-real-ip': IP, ...headers } }));
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}
const act = (action, extra = {}, { wallet = WALLET, level = 1 } = {}) => post({ action, session: sessionFor(wallet, level), ...extra });
const free = (id) => { const j = fake.db.jobs.get(id); if (j) j.lease = 0; };
const giveCredits = (n, wallet = WALLET) => { fake.db.cred(codeOf(wallet)).paid += n; };
const credits = (wallet = WALLET) => fake.db.inf_credits({ p_wallet: codeOf(wallet) });
// a job moved along until it's done (or failed), its turn given back each time (the AI service done with every request)
async function finish(id, { max = 6 } = {}) {
  let r;
  for (let n = 0; n < max; n++) {
    free(id);
    for (const fr of fake.fal.requests.values()) fr.status = 'COMPLETED';
    r = await jobTick(cfgNow(), id, { now: Date.now(), deadline: Date.now() + 20_000 });
    if (r.state === 'done' || r.state === 'failed') return r;
  }
  return r;
}
const tick = (id, opts = {}) => { free(id); return jobTick(cfgNow(), id, { now: Date.now(), deadline: Date.now() + 20_000, ...opts }); };
const lastFal = () => [...fake.fal.requests.values()].at(-1);
const falCalls = (method = 'POST') => calls.filter((c) => c.to === 'fal' && c.method === method);
const geminiCalls = () => calls.filter((c) => c.to === 'gemini');
const stored = (prefix) => [...fake.storage.keys()].filter((k) => k.startsWith(prefix)).sort();
// an upload that passed its check, straight in the database, its file in the bucket
async function okUpload(kind = 'picture', { wallet = WALLET, seconds = null } = {}) {
  const id = idOf(`up${kind}${fake.db.uploads.size}x`);
  fake.db.uploads.set(id, { id, wallet_code: codeOf(wallet), kind, status: 'ok', why: null, seconds, created: Date.now() - 60e3 });
  if (kind === 'clip') fake.storage.set(`up/${id}.mp4`, { bytes: mp4({ seconds: seconds ?? 5 }), type: 'video/mp4' });
  else fake.storage.set(`up/${id}.jpg`, { bytes: await sharp(PNG).jpeg().toBuffer(), type: 'image/jpeg' });
  return id;
}
// one of the owner's trend moves, made and kept (its video in the bucket)
function keptTrend(trend = 'heart-hands', { poster = true } = {}) {
  const job = idOf(`tr${trend.replace(/-/g, '')}${fake.db.jobs.size}`);
  fake.db.addJob({ id: job, inf_id: null, wallet_code: null, kind: 'preset', trend, cost: 0, status: 'done', bytes: 60_000, poster, done: Date.now() - 5e3 });
  fake.db.trends.set(trend, { id: trend, status: 'kept', job, sort: R.TRENDS.findIndex((t) => t.id === trend), updated: Date.now() });
  fake.storage.set(`trends/${job}.mp4`, { bytes: mp4({ seconds: 10 }), type: 'video/mp4' });
  if (poster) fake.storage.set(`trends/${job}.poster.webp`, { bytes: Buffer.from('RIFFwebp'), type: 'image/webp' });
  return job;
}
// a done photo or video of an influencer, straight in the database (its files in the bucket)
async function doneJob(inf, kind = 'photo', { shape = 'tall', wallet = WALLET, poster = false, video = mp4({ seconds: 5 }) } = {}) {
  const id = idOf(`${kind}${fake.db.jobs.size}done`);
  fake.db.addJob({ id, inf_id: inf, wallet_code: codeOf(wallet), kind, scene: kind === 'trend' ? null : 'on a sunny rooftop at noon', shape,
    trend: kind === 'trend' ? 'heart-hands' : null, cost: R.PRICES[kind], status: 'done', files: kind === 'photo' ? 1 : 0,
    bytes: kind === 'photo' ? 9000 : video.length, poster, done: Date.now() - 1000 });
  if (kind === 'photo') {
    fake.storage.set(picPath(inf, id, 0), { bytes: await sharp(PNG).jpeg().toBuffer(), type: 'image/jpeg' });
    fake.storage.set(picPath(inf, id, 0, 'webp'), { bytes: Buffer.from('RIFFwebp'), type: 'image/webp' });
  } else {
    fake.storage.set(`inf/${inf}/${id}.mp4`, { bytes: video, type: 'video/mp4' });
    if (poster) fake.storage.set(`inf/${inf}/${id}.poster.webp`, { bytes: Buffer.from('RIFFwebp'), type: 'image/webp' });
  }
  return id;
}
// the app's request helper (src/studio/app.js act()), on our real server: { ok, status, data }
const appAct = (wallet = WALLET, level = 1) => async (action, payload = {}, { human = null } = {}) => {
  const r = await post({ action, session: sessionFor(wallet, level), ...payload, ...(human ? { turnstileToken: 'turnstile-ok' } : {}) });
  return { ok: r.status >= 200 && r.status < 300, status: r.status, data: r.body };
};
// the browser's own requests to our address (src/studio/media.js: fetch('/api/launch?…')), answered by our real server
function browserFetch() {
  return async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('/api/launch')) {
      return launchPost(new Request(`https://studio.agi1.app${u}`, { method: init.method || 'GET', headers: { 'x-real-ip': IP, ...(init.headers || {}) }, body: init.body }));
    }
    return fakeFetch(url, init);
  };
}
// an influencer straight in the database, ready (its looks and full body done, their files in the bucket)
async function readyInf({ wallet = WALLET, name = 'Nova', mode = 'design', style = 'anime', publicOn = true } = {}) {
  const c = codeOf(wallet);
  const id = idOf(`inf${name}${fake.db.infs.size}`), looks = idOf(`lk${name}${fake.db.jobs.size}`), body = idOf(`bd${name}${fake.db.jobs.size}`);
  fake.db.infs.set(id, {
    id, wallet_code: c, name, mode, style, settings: { look: 'feminine', age: '20s' }, words: '', source: null, status: 'ready', first_job: looks,
    looks_job: looks, pick: 1, body_job: body, body_tries: 0, error: null, public: publicOn && mode !== 'face', hidden: false, level: 1,
    created: Date.now() - 3600e3, updated: Date.now(), ready: Date.now() - 60e3,
  });
  fake.db.addJob({ id: looks, inf_id: id, wallet_code: c, kind: 'looks', cost: 100, status: 'done', files: 4, bytes: 4000, done: Date.now() - 2000e3 });
  fake.db.addJob({ id: body, inf_id: id, wallet_code: c, kind: 'body', pick: 1, cost: 0, status: 'done', files: 1, bytes: 9000, done: Date.now() - 1000e3 });
  const jpg = await sharp(PNG).jpeg().toBuffer();
  for (let n = 0; n < 4; n++) fake.storage.set(picPath(id, looks, n), { bytes: jpg, type: 'image/jpeg' });
  fake.storage.set(picPath(id, body, 0), { bytes: jpg, type: 'image/jpeg' });
  fake.storage.set(picPath(id, body, 0, 'webp'), { bytes: Buffer.from('webp'), type: 'image/webp' });
  return { id, looks, body };
}
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// code without its comments (they may name the services; what visitors read never does)
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
const bare = (input) => { const { prompt, ...rest } = input; return rest; };
const PROVIDERS = /\b(?:fal(?:\.ai)?|kling|kuaishou|nano[\s-]?banana|gemini|google|seedance|bytedance|meshy)\b/i;

// ---------- its rules and its words ----------
test('its rules: the owner\'s prices and the holder discounts, free credits, the trend moves, its files, its limits', () => {
  assert.deepEqual(R.PRICES, { influencer: 100, looks: 40, photo: 15, trend: 300, video: 400, model: 500 });
  assert.deepEqual([1, 2, 3].map((l) => R.creditPrice('influencer', l)), [100, 80, 60]);
  assert.deepEqual([1, 2, 3].map((l) => R.creditPrice('photo', l)), [15, 12, 9]);
  assert.deepEqual([1, 2, 3].map((l) => R.creditPrice('model', l)), [500, 400, 300]);
  assert.equal(R.creditPrice('video', 7), 400);                          // a level it doesn't know: no discount
  assert.deepEqual(R.FREE_CREDITS, { 1: 0, 2: 100, 3: 400 });
  assert.equal(R.TOPUP_MIN, 100);
  assert.ok(R.TOPUPS.every((c) => Number.isInteger(c) && c >= R.TOPUP_MIN));
  assert.deepEqual([R.creditsText(1), R.creditsText(1500), R.creditsText(0), R.creditsText(null)], ['1 credit', '1,500 credits', '0 credits', '0 credits']);
  // its trend moves: ids the database takes, each a made-up dancer's move (never a person, a song or a dance's name)
  const ids = R.TRENDS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of R.TRENDS) {
    assert.match(t.id, R.TREND_ID);
    assert.ok(t.name && t.emoji && t.move.length > 30, t.id);
    assert.equal(R.trendOf(t.id), t);
    assert.equal(trouble(`${t.name} ${t.move}`), null, t.id);
  }
  assert.equal(R.trendOf('moonwalk'), null);
  // its files' addresses: what the pages ask for is what our server reads
  const inf = idOf('aaaa'), job = idOf('bbbb');
  for (const u of [R.infPic(inf, job, 2), R.infPic(inf, job, 0, true), R.infPoster(inf, job), R.infPoster('trends', job)]) {
    assert.match(new URL(u, 'https://studio.agi1.app').searchParams.get('inf-file'), R.INF_FILE_RE, u);
  }
  for (const bad of [`${inf}/${job}-4.jpg`, `${inf}/${job}.mp4`, `../${job}-0.jpg`, `${inf}/${job}-0.png`, `elsewhere/${job}.poster.webp`]) {
    assert.doesNotMatch(bad, R.INF_FILE_RE, bad);
  }
  assert.equal(R.infVideo(job), `/api/launch?inf-video=${job}.mp4`);
  assert.equal(R.infVideoDl(job), `/api/launch?inf-video-dl=${job}.mp4`);
  // its limits: a clip's parts under what Vercel takes in a request (4.5 MB), enough of them for its biggest
  assert.ok(R.CLIP.PART < 4_200_000 && UPLOAD.MAX_PARTS * R.CLIP.PART >= R.CLIP.MAX_BYTES && UPLOAD.MAX_PARTS <= 99);
  assert.ok(R.PICTURE.MAX_BYTES < 4_200_000 && R.PICTURE.POSTER_BYTES < R.PICTURE.MAX_BYTES && R.CLIP.FRAME_BYTES < R.PICTURE.MAX_BYTES);
  // its choices: adults only (from the twenties up); the look of one from a picture or a face comes from it
  assert.deepEqual(Object.keys(R.OPTIONS.age.choices), ['20s', '30s', '40s', '50s']);
  assert.deepEqual(Object.entries(R.OPTIONS).filter(([, o]) => o.for.includes('face')).map(([k]) => k), ['outfit', 'vibe']);
  assert.deepEqual(Object.keys(R.MODES), ['design', 'picture', 'face']);
  assert.deepEqual(Object.keys(R.INF_STYLES), ['real', 'anime', 'toon']);
  assert.ok(['real_person', 'minor', 'sexual', 'copyright'].every((w) => Object.hasOwn(R.REPORT_WHYS, w)));
});

test('the app\'s words: every "no" our server sends has its own words, and never an AI provider\'s name', () => {
  const GENERIC = AW.errorText('busy');
  const quoted = (text, re) => [...text.matchAll(re)].map((m) => m[1]);
  const api = read('server/inf-api.js'), inf = read('server/influencer.js'), ups = read('server/inf-uploads.js'), sql = read('supabase/influencers.sql');
  const whyStatus = /const WHY_STATUS = \{([\s\S]*?)\};/.exec(api)[1];
  const codes = new Set([
    ...quoted(api, /error: '([a-z_]+)'/g), ...quoted(whyStatus, /\b([a-z_0-9]+):/g), ...quoted(inf, /why: '([a-z_0-9]+)'/g),
    ...quoted(ups, /error: '([a-z_]+)'/g), ...quoted(ups.slice(ups.indexOf('export async function openUpload'), ups.indexOf('export async function receive')), /why: '([a-z_]+)'/g),
    ...quoted(sql, /'why', '([a-z_0-9]+)'/g),
  ]);
  // (said in their own way: a word check's field and reason, an AI check's reason, a coin check's reason; and the database's
  // reasons our server never passes on: a taken id is tried again, a free credits grant's and a payment's own answers)
  const own = new Set(['words', 'refused', 'coin', 'taken', 'level', 'cap', 'used']);
  assert.ok(codes.size > 40 && codes.has('done') && codes.has('needs_photo') && codes.has('sold_out'));
  for (const code of codes) {
    if (own.has(code) || code === 'busy') continue;
    assert.notEqual(AW.upErrorText({ error: code }), GENERIC, code);
  }
  // an upload's "no" is about the upload: "gone" is the upload, never its influencer
  assert.equal(AW.upErrorText({ error: 'gone' }), 'That upload expired: pick it again.');
  assert.equal(AW.upErrorText({ error: 'done' }), 'That upload is finished already: pick it again.');
  assert.equal(AW.upErrorText({ error: 'size' }), AW.errorText('size'));
  assert.equal(AW.upErrorText({ error: 'too_fast' }), AW.errorText('too_fast'));
  assert.equal(AW.upErrorText({ error: 'refused', why: 'screen' }, 'face'), 'A live selfie only: not a photo of a screen or a printed picture.');
  assert.equal(AW.upErrorText({ error: 'refused', why: 'none' }, 'clip'), "We couldn't see a person moving in it: try another clip.");
  assert.equal(AW.upErrorText(null), GENERIC);
  // the AI checks' reasons, and a clip's own (put together and looked at): their own words for each kind
  const FALLBACK = "That one can't be used: try another.";
  for (const [kind, whys] of [
    ['face', ['none', 'many', 'minor', 'screen', 'sexual', 'hate', 'violence']],
    ['picture', ['real_person', 'none', 'many', 'minor', 'copyright', 'sexual', 'hate', 'violence', 'picture']],
    ['clip', ['none', 'minor', 'sexual', 'hate', 'violence', 'gone', 'done', 'parts', 'video', 'length', 'frames']],
  ]) {
    for (const why of whys) assert.notEqual(AW.uploadText(why, kind), FALLBACK, `${kind} ${why}`);
  }
  assert.notEqual(AW.uploadText('none', 'face'), AW.uploadText('none', 'picture'));
  assert.equal(AW.uploadText('other', 'face'), FALLBACK);
  // "Check my payment"'s reasons (server/credits.js, server/studio-chain.js)
  for (const why of ['pending', 'failed', 'nothing', 'other_wallet', 'too_old', 'used', 'too_small', 'chain', 'no_usdg']) assert.notEqual(AW.resultText(why), GENERIC, why);
  // a coin's (server/launch.js checkIdea): each its own
  const reasons = quoted(read('server/launch.js').slice(read('server/launch.js').indexOf('export function checkIdea')), /why: '([a-z]+)'/g).slice(0, 10);
  assert.deepEqual(reasons.sort(), ['agi', 'characters', 'crude', 'description', 'egirl', 'link', 'money', 'name', 'official', 'symbol']);
  for (const why of reasons) assert.notEqual(AW.coinText(why), 'Try another name or ticker.', why);
  // a word check's (server/inf-words.js checkStart, the studio's scene rules): each field's
  for (const [field, why] of [['name', 'empty'], ['name', 'long'], ['name', 'letters'], ['mode', 'empty'], ['style', 'empty'], ['look', 'empty'],
    ['age', 'empty'], ['words', 'long'], ['scene', 'empty'], ['scene', 'short'], ['scene', 'long'], ['shape', 'empty'], ['hair', 'bad'],
    ['name', 'link'], ['name', 'contact'], ['words', 'adult'], ['words', 'minor'], ['words', 'hate'], ['name', 'person'], ['name', 'character'],
    ['name', 'her']]) {
    assert.notEqual(AW.wordsText(field, why), 'Try other words.', `${field} ${why}`);
  }
  // never an AI service's name in what visitors read (the owner's rule): the app, its views, its page
  const files = ['studio.html', 'src/studio/app-words.js', 'src/studio/app.js', 'src/studio/ui.js', 'src/studio/media.js', 'src/studio/rules.js',
    ...readdirSync(new URL('../src/studio/views/', import.meta.url)).map((f) => `src/studio/views/${f}`)];
  for (const f of files) assert.doesNotMatch(strip(read(f)), PROVIDERS, f);
});

test('the app\'s words: prices, perks, what\'s being made, why something couldn\'t be, sharing and dates', () => {
  assert.equal(AW.costText('trend', { level: 2 }), '240 credits');
  assert.equal(AW.costText('trend', { prices: { trend: 99 } }), '99 credits');
  assert.equal(AW.priceOf('looks', { level: 3 }), 24);
  assert.match(AW.perksText(1), /^Holder perks start at Crush \(10,000\+ \$AGI held, or burned for messages\): 20% off and 100 free credits a month\./);
  for (const l of [2, 3]) assert.match(AW.perksText(l), /A thank-you for holding, not an investment\.$/);
  for (const l of [1, 2, 3]) assert.doesNotMatch(AW.perksText(l), /\bbuy\b|pump|moon|gains?\b|profit/i);
  assert.equal(AW.topupText(1000), '$10 → 1,000 credits');
  assert.equal(AW.topupText(250), '$2.50 → 250 credits');
  assert.equal(AW.makingText({ status: 'looks', job: { step: 'queue' } }, { position: 2 }), 'Making 4 looks to choose from (#3 in line)…');
  assert.equal(AW.makingText({ status: 'body', name: 'Nova', job: { step: 'make' } }, { position: 2 }), "Making Nova's full body from the look you picked…");
  assert.equal(AW.makingText({ status: 'ready' }), '');
  assert.deepEqual(['looks', 'pick', 'body', 'ready', 'failed', 'deleted'].map(AW.statusChip), ['Making looks', 'Pick a look', 'Making it', 'Ready', "Couldn't be made", '']);
  // why it couldn't be made (what server/inf-jobs.js keeps), and its credits back
  const errors = ['refused', 'source', 'expired', 'too_big', 'check', 'save', 'gone', 'deleted', 'pose', 'no_picture', 'ai:photo', 'ai:video'];
  for (const e of errors) assert.notEqual(AW.failText(e), "It couldn't be made.", e);
  assert.equal(AW.failText('ai:looks'), "The AI service couldn't make it this time.");
  for (const e of read('server/inf-jobs.js').matchAll(/fail\(cfg, id, '([a-z_]+)'/g)) assert.notEqual(AW.failText(e[1]), "It couldn't be made.", e[1]);
  assert.equal(AW.backText({ refunded: true, cost: 15 }), ' Its 15 credits came back.');
  assert.equal(AW.backText({ refunded: true, cost: 0 }), '');
  assert.equal(AW.jobStateText({ status: 'failed', error: 'refused', refunded: true, cost: 400 }), "The AI service's safety check stopped it. Its 400 credits came back.");
  assert.equal(AW.jobStateText({ status: 'making', step: 'queue' }, { position: 0 }), 'Waiting its turn… (#1 in line)');
  assert.equal(AW.jobStateText({ status: 'making', step: 'save' }, { position: 4 }), 'Saving it…');
  assert.equal(AW.jobMeta({ kind: 'video', shape: 'wide', sound: true }), 'AI-generated · Video · 5 s · Wide · with sound');
  assert.equal(AW.jobMeta({ kind: 'photo', shape: 'square' }), 'AI-generated · Photo · Square');
  // a trend video is as long as its move (a trend move's 10 s, or a clip's 2 to 10): never said to be 5 s
  assert.equal(AW.jobMeta({ kind: 'trend', shape: 'tall' }), 'AI-generated · Trend video · Vertical');
  assert.equal(AW.jobTitle({ kind: 'trend', trend: 'hip-sway' }), 'Trend video: Hip sway');
  assert.equal(AW.jobTitle({ kind: 'trend', clip: true }), 'Trend video (your own move)');
  assert.equal(AW.modelText({ status: 'making', step: 'rig' }), 'Giving it bones…');
  assert.equal(AW.modelText({ status: 'failed', error: 'pose' }), "Its bones didn't fit: its full body needs to be one figure, standing. Its credits came back.");
  assert.equal(AW.modelText({ status: 'done' }), 'Ready in 3D');
  assert.equal(AW.studioText(null), "Couldn't reach AGI Studio just now. Trying again…");
  assert.match(AW.studioText({ on: false }), /opens soon/);
  assert.match(AW.studioText({ on: true, open: false }, { allowed: false }), /private for now/);
  assert.equal(AW.studioText({ on: true, open: false }, { allowed: true }), '');
  // "Check my payment", said
  assert.equal(AW.topupCheckText({ added: 1000, results: [{ ok: true, amount: 1000 }] }), 'Payment found: 1,000 credits added 💜');
  assert.equal(AW.topupCheckText({ added: 0, results: [{ ok: false, why: 'other_wallet' }] }), 'It came from another wallet: send from the wallet you connected.');
  assert.match(AW.topupCheckText({ added: 0, results: [], source: 'explorer' }), /^No new payment from your wallet found yet/);
  // the choices as the page offers them
  assert.deepEqual(AW.MODE_CARDS.map((m) => m.id), ['design', 'picture', 'face']);
  assert.deepEqual(AW.optionGroups('picture').map((g) => g.key), ['outfit', 'vibe']);
  assert.equal(AW.optionGroups('design').length, Object.keys(R.OPTIONS).length);
  for (const idea of [...AW.PHOTO_IDEAS, ...AW.VIDEO_IDEAS]) {
    assert.equal(checkInfScene({ scene: idea, shape: 'tall' }).ok, true, idea);
  }
  for (const name of AW.NAMES) assert.equal(checkStart({ name, mode: 'design', style: 'anime', settings: { look: 'feminine', age: '20s' } }).ok, true, name);
  // sharing: the visitor posts it (never us), it's AI-made, never money talk
  const url = 'https://studio.agi1.app/i/abc';
  for (const u of [AW.shareInfUrl('Nova', url), AW.shareJobUrl('Nova', 'video', url), AW.shareJobUrl('Nova', 'photo', url), AW.share3dUrl('Nova', url)]) {
    const p = new URL(u);
    assert.equal(p.origin + p.pathname, 'https://x.com/intent/tweet');
    assert.equal(p.searchParams.get('url'), url);
    assert.match(p.searchParams.get('text'), /AI|AGI Studio/);
    assert.doesNotMatch(p.searchParams.get('text'), /\$|\bbuy\b|pump|moon|token|coin/i);
  }
  assert.match(new URL(AW.shareJobUrl('Nova', 'photo', url)).searchParams.get('text'), /an AI-made photo/);
  // dates
  const now = Date.UTC(2026, 9, 10, 12);
  assert.deepEqual([AW.agoText(now - 20e3, now), AW.agoText(now - 5 * 60e3, now), AW.agoText(now - 3 * 3600e3, now), AW.agoText(null)],
    ['just now', '5 min ago', '3 h ago', '']);
  assert.equal(AW.agoText(now - 3 * DAY, now), AW.dayText(now - 3 * DAY));
  assert.equal(AW.shortAddress(WALLET), '0x8ba1…ba72');
  assert.deepEqual(AW.REACTIONS.filter((m) => !R.MOVE_NAMES.includes(m)), []);
});

// ---------- the words checked, and the words the AI services get ----------
test('an influencer as typed: its name, its choices and its words checked before any credit is spent', () => {
  const base = { name: '  Nova  ', mode: 'design', style: 'anime', settings: { look: 'feminine', age: '20s', hair: 'pink', cut: '', vibe: 'playful' }, words: '  likes   neon  ' };
  assert.deepEqual(checkStart(base), {
    ok: true, name: 'Nova', mode: 'design', style: 'anime', settings: { look: 'feminine', age: '20s', hair: 'pink', vibe: 'playful' }, words: 'likes neon',
  });
  const no = (patch, field, why) => assert.deepEqual(checkStart({ ...base, ...patch }), { ok: false, field, why }, JSON.stringify(patch));
  no({ mode: 'clone' }, 'mode', 'empty');
  no({ mode: undefined }, 'mode', 'empty');
  no({ name: '   ' }, 'name', 'empty');
  no({ name: 'N'.repeat(25) }, 'name', 'long');
  no({ name: '<script>' }, 'name', 'letters');
  no({ name: 'nova_99' }, 'name', 'letters');
  no({ name: 'Elon Musk' }, 'name', 'person');
  no({ name: 'AGI-1 Official' }, 'name', 'her');
  no({ name: 'Pikachu' }, 'name', 'character');
  no({ style: 'pixel' }, 'style', 'empty');
  no({ settings: { look: 'feminine', age: '15' } }, 'age', 'bad');
  no({ settings: { look: 'feminine', age: '20s', wings: 'yes' } }, 'settings', 'bad');
  no({ settings: { look: 'feminine', age: '20s', hair: 7 } }, 'hair', 'bad');
  no({ settings: { age: '30s' } }, 'look', 'empty');
  no({ settings: { look: 'masculine' } }, 'age', 'empty');
  no({ settings: ['look'] }, 'look', 'empty');
  no({ words: 'x'.repeat(201) }, 'words', 'long');
  no({ words: 'a teenage girl in a school uniform' }, 'words', 'minor');
  no({ words: 'in lingerie' }, 'words', 'adult');
  no({ words: 'a nazi armband' }, 'words', 'hate');
  no({ words: 'visit nova.xyz' }, 'words', 'link');
  no({ words: 'dm @nova_fan' }, 'words', 'contact');
  // from a picture or a face: only the choices for every mode (its look comes from the picture), no age or look asked for
  assert.deepEqual(checkStart({ ...base, mode: 'face', settings: { outfit: 'cozy', vibe: 'calm' } }).settings, { outfit: 'cozy', vibe: 'calm' });
  no({ mode: 'face', settings: { hair: 'pink' } }, 'hair', 'bad');
  assert.equal(checkStart({ ...base, mode: 'picture', settings: null }).ok, true);
  // a scene: the studio's own rules
  assert.deepEqual(checkInfScene({ scene: '  dancing in   the rain ', shape: 'wide', sound: false }), { ok: true, scene: 'dancing in the rain', shape: 'wide', sound: false });
  assert.equal(checkInfScene({ scene: 'dancing in the rain', shape: 'wide' }).sound, true);
  assert.deepEqual(checkInfScene({ scene: 'short', shape: 'tall' }), { ok: false, field: 'scene', why: 'short' });
  assert.deepEqual(checkInfScene({ scene: 'with Taylor Swift on stage', shape: 'tall' }), { ok: false, field: 'scene', why: 'person' });
  assert.deepEqual(checkInfScene({ scene: 'dancing in the rain', shape: 'round' }), { ok: false, field: 'shape', why: 'empty' });
});

test('the words the AI services get: an original adult, the same character, family-friendly, never a real person', () => {
  const design = { mode: 'design', style: 'anime', settings: { look: 'feminine', age: '30s', skin: 'olive', hair: 'silver', cut: 'bob', eyes: 'violet', outfit: 'cyber', vibe: 'mysterious' }, words: 'a tiny star tattoo on the wrist' };
  const p = looksPrompt(design);
  assert.match(p, /^An anime-style character portrait illustration of a woman in their thirties with olive skin, silver hair in a bob, violet eyes\. Head and shoulders, facing the camera, a mysterious half-smile, wearing futuristic techwear/);
  assert.match(p, /An original made-up adult character: not a real person, not any existing character\. Family-friendly, fully clothed\. No text, no logos, no watermark\. Details: A tiny star tattoo on the wrist\.$/);
  assert.match(looksPrompt({ mode: 'design', style: 'real', settings: {} }), /^A photorealistic portrait photo of a person in their twenties\. /);
  assert.match(looksPrompt({ mode: 'design', style: 'toon', settings: { look: 'masculine', age: '50s', hair: 'black' } }), /a man in their fifties with black hair\./);
  assert.match(looksPrompt({ mode: 'picture', style: 'toon', settings: {} }), /of the character in the picture: keep its face, hair, colors and features recognizable\..*The character is an adult\./);
  assert.match(looksPrompt({ mode: 'face', style: 'real', settings: { outfit: 'smart' } }), /of the person in the photo, keeping their face recognizable .*wearing smart casual clothes/);
  assert.match(bodyPrompt({ style: 'anime', settings: {} }), /standing and facing the camera, the whole body visible from head to shoes/);
  assert.doesNotMatch(bodyPrompt({ style: 'real', settings: {} }), /second picture/);
  assert.match(bodyPrompt({ style: 'real', settings: {} }, { withSelfie: true }), /The second picture shows their real face: keep it exactly\./);
  assert.match(photoPrompt({ style: 'real', settings: {} }, 'at a café, morning light'), /^A photorealistic photo of this exact character .* At a café, morning light\. A scene may change the outfit, never to less covered\./);
  assert.match(motionPrompt({ style: 'toon' }), /copies the moves in the video, keeping exactly the same look.*Stylized 3D cartoon animation/);
  assert.match(clipPrompt({ style: 'anime' }, 'waves hello!'), /^Waves hello! The character keeps exactly the same look as in the first frame\. Anime-style animation/);
  assert.match(clipPrompt({ style: 'real' }, 'x y z'), /never a real person\. No text, no captions, no logos\.$/);
  assert.match(sceneVideoPrompt({ style: 'toon' }, 'spins in a field of flowers'), /^@Image1 is the main character.*Spins in a field of flowers\. Cartoon-style 3D animation/);
  assert.match(sceneVideoPrompt({ style: 'anime' }, 'spins in a field of flowers'), /Anime-style 3D animation/);
  // which video model: from one of its photos (image to video); else its full body (reference), never a realistic face from it
  assert.equal(sceneWay({ style: 'anime', mode: 'design' }, { image: idOf('photo') }), 'photo');
  assert.equal(sceneWay({ style: 'real', mode: 'design' }, { image: idOf('photo') }), 'photo');
  assert.equal(sceneWay({ style: 'anime', mode: 'design' }), 'reference');
  assert.equal(sceneWay({ style: 'toon', mode: 'picture' }), 'reference');
  assert.equal(sceneWay({ style: 'real', mode: 'design' }), 'needs_photo');
  assert.equal(sceneWay({ style: 'anime', mode: 'face' }), 'needs_photo');
  // the owner's trend moves: a made-up adult dancer, one person, the whole body, no music
  for (const t of R.TRENDS) {
    const tp = presetPrompt(t.id);
    assert.match(tp, /^A made-up adult dancer in a plain light grey t-shirt/);
    assert.ok(tp.includes(t.move) && tp.includes('Exactly one person.'), t.id);
  }
  assert.equal(presetPrompt('moonwalk'), null);
  assert.match(PRESET_NEGATIVE, /more than one person/);
  assert.match(CLIP_NEGATIVE, /nudity/);
});

test('the AI service\'s requests: each kind of job, made from short-lived addresses of what it\'s made from', () => {
  const cfg = cfgNow();
  const u = (n) => `${SB}/storage/v1/object/sign/agi1-characters/${n}?token=t`;
  const job = (kind, extra = {}) => ({ id: idOf('j'), kind, inf_name: 'Nova', inf_mode: 'design', inf_style: 'anime', inf_settings: { look: 'feminine', age: '20s' },
    inf_words: '', scene: null, shape: null, sound: false, ...extra });
  const asRequest = (e) => e.why === 'request';
  let r = jobRequest(cfg, job('looks'));
  assert.deepEqual([r.model, r.way], [MODELS.image, 'image']);
  assert.deepEqual(bare(r.input), { resolution: '1K', output_format: 'jpeg', safety_tolerance: '2', num_images: 4, aspect_ratio: '1:1' });
  r = jobRequest(cfg, job('looks', { inf_mode: 'picture' }), { source: u('up/a.jpg') });
  assert.deepEqual([r.model, r.input.image_urls, r.input.num_images], [MODELS.edit, [u('up/a.jpg')], 4]);
  assert.throws(() => jobRequest(cfg, job('looks', { inf_mode: 'picture' }), {}), asRequest);
  assert.throws(() => jobRequest(cfg, job('looks', { inf_mode: 'face' }), { source: 'http://insecure.example/x.jpg' }), asRequest);
  r = jobRequest(cfg, job('body', { inf_mode: 'face', inf_style: 'real' }), { look: u('look'), source: u('selfie') });
  assert.deepEqual([r.model, r.input.image_urls, r.input.aspect_ratio, r.input.num_images], [MODELS.edit, [u('look'), u('selfie')], '9:16', 1]);
  assert.match(r.input.prompt, /The second picture shows their real face/);
  r = jobRequest(cfg, job('body', { inf_mode: 'face' }), { look: u('look') });
  assert.deepEqual(r.input.image_urls, [u('look')]);
  assert.doesNotMatch(r.input.prompt, /second picture/);
  assert.throws(() => jobRequest(cfg, job('body'), {}), asRequest);
  r = jobRequest(cfg, job('photo', { scene: 'at the beach', shape: 'wide' }), { body: u('body') });
  assert.deepEqual([r.model, r.input.aspect_ratio, r.input.image_urls], [MODELS.edit, '16:9', [u('body')]]);
  r = jobRequest(cfg, job('trend', { trend: 'hip-sway', shape: 'tall' }), { body: u('body'), trend: u('trend') });
  assert.equal(r.model, MODELS.motion);
  assert.deepEqual(bare(r.input), { image_url: u('body'), video_url: u('trend'), character_orientation: 'video', keep_original_sound: false });
  r = jobRequest(cfg, job('trend', { clip: true, image: idOf('ph') }), { body: u('body'), image: u('photo'), clip: u('clip') });
  assert.deepEqual([r.input.image_url, r.input.video_url], [u('photo'), u('clip')]);
  assert.throws(() => jobRequest(cfg, job('trend', { clip: true }), { body: u('body'), trend: u('trend') }), asRequest);
  r = jobRequest(cfg, job('video', { scene: 'waves', shape: 'tall', sound: true, image: idOf('ph') }), { image: u('photo'), body: u('body') });
  assert.equal(r.model, MODELS.i2v);
  assert.deepEqual(bare(r.input), { start_image_url: u('photo'), duration: '5', generate_audio: true, negative_prompt: CLIP_NEGATIVE });
  r = jobRequest(cfg, job('video', { scene: 'waves', shape: 'square' }), { body: u('body') }, { user: 'someone-1' });
  assert.deepEqual([r.model, r.way], ['bytedance/seedance-2.5/reference-to-video', 'reference']);
  assert.deepEqual(bare(r.input), { image_urls: [u('body')], resolution: '720p', duration: '5', aspect_ratio: '1:1', generate_audio: false,
    bitrate_mode: 'standard', codec: 'H264', end_user_id: 'someone-1' });
  assert.throws(() => jobRequest(cfg, job('video', { scene: 'waves', shape: 'tall', inf_style: 'real' }), { body: u('body') }), asRequest);
  r = jobRequest(cfg, { ...job('preset'), trend: 'robot-moves' });
  assert.equal(r.model, MODELS.t2v);
  assert.deepEqual(bare(r.input), { duration: '10', aspect_ratio: '9:16', generate_audio: false, negative_prompt: PRESET_NEGATIVE });
  assert.throws(() => jobRequest(cfg, { ...job('preset'), trend: 'moonwalk' }), asRequest);
  assert.throws(() => jobRequest(cfg, job('selfie')), asRequest);
  // every model's id is one fal's queue client sends (Kling's are 5 parts long)
  for (const m of [...Object.values(MODELS), cfg.videoModel]) assert.match(m, MODEL_RE, m);
  // what a finished request made: its pictures (4 at most, https only) or its video
  assert.equal(outputOf('looks', { images: [1, 2, 3, 4, 5].map((n) => ({ url: `https://v3.fal.media/${n}.png` })) }).images.length, 4);
  assert.deepEqual(outputOf('photo', { images: [{ url: 'http://x/1.png' }, { url: 'https://v3.fal.media/2.png' }, {}] }), { images: ['https://v3.fal.media/2.png'] });
  for (const out of [{ images: [] }, null, { video: { url: 'https://v3.fal.media/v.mp4' } }]) {
    assert.throws(() => outputOf('body', out), (e) => e.why === 'nothing');
  }
  assert.deepEqual(outputOf('video', { video: { url: 'https://v3.fal.media/v.mp4' } }), { video: 'https://v3.fal.media/v.mp4' });
  assert.throws(() => outputOf('trend', { video: { url: 'ftp://x/v.mp4' } }), (e) => e.why === 'nothing');
  assert.throws(() => outputOf('preset', { images: [{ url: 'https://v3.fal.media/1.png' }] }), (e) => e.why === 'nothing');
});

test('the AI checks of an upload and of a video: what each says no to, failing closed, never the key', async () => {
  const cfg = cfgNow();
  const jpg = await sharp(PNG).jpeg().toBuffer();
  assert.deepEqual(await checkSelfie(cfg, jpg), { ok: true });
  const g = geminiCalls()[0];
  assert.deepEqual([g.which, g.model, g.key], ['selfie', 'gemini-3.1-flash-lite', GEMINI_KEY]);
  assert.equal(g.body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
  assert.ok(Buffer.from(g.body.contents[0].parts[0].inlineData.data, 'base64').equals(jpg));
  assert.equal(g.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(g.body.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
  assert.deepEqual(g.body.generationConfig.responseJsonSchema.required, ['faces', 'photo', 'apparentAge', 'adult', 'screen', 'explicit', 'hateful', 'violent', 'other']);
  assert.ok(Array.isArray(g.body.safetySettings) && g.body.safetySettings.length >= 4);
  const say = async (fn, which, verdict, ...args) => { fake.gemini[which] = verdict; try { return await fn(cfg, ...args); } finally { fake.gemini[which] = null; } };
  const selfie = (v) => say(checkSelfie, 'selfie', v, jpg);
  for (const [verdict, why] of [[{ faces: 0 }, 'none'], [{ photo: false }, 'none'], [{ faces: 2 }, 'many'], [{ adult: false }, 'minor'],
    [{ apparentAge: 19 }, 'minor'], [{ screen: true }, 'screen'], [{ explicit: true, faces: 3 }, 'sexual'], [{ hateful: true }, 'hate'],
    [{ violent: true }, 'violence'], [{ other: true }, 'other']]) {
    assert.deepEqual(await selfie(verdict), { ok: false, why }, JSON.stringify(verdict));
  }
  const art = (v) => say(checkArt, 'art', v, jpg);
  assert.deepEqual(await art({}), { ok: true });
  for (const [verdict, why] of [[{ photo: true }, 'real_person'], [{ characters: 0 }, 'none'], [{ characters: 2 }, 'many'], [{ adult: false }, 'minor'],
    [{ known: true }, 'copyright'], [{ explicit: true }, 'sexual'], [{ violent: true }, 'violence']]) {
    assert.deepEqual(await art(verdict), { ok: false, why }, JSON.stringify(verdict));
  }
  const frames = (v) => say(checkFrames, 'frames', v, [jpg, jpg, jpg]);
  assert.deepEqual(await frames({}), { ok: true });
  assert.equal(geminiCalls().at(-1).body.contents[0].parts.filter((p) => p.inlineData).length, 3);
  assert.deepEqual(await frames({ people: 0 }), { ok: false, why: 'none' });
  assert.deepEqual(await frames({ adult: false }), { ok: false, why: 'minor' });
  const video = mp4();
  assert.deepEqual(await say(checkVideo, 'video', {}, video), { ok: true, checked: true });
  assert.equal(geminiCalls().at(-1).body.contents[0].parts[0].inlineData.mimeType, 'video/mp4');
  assert.deepEqual(await say(checkVideo, 'video', { minor: true }, video), { ok: false, why: 'minor' });
  assert.deepEqual(await say(checkVideo, 'video', { explicit: true }, video), { ok: false, why: 'sexual' });
  const n = geminiCalls().length;
  assert.deepEqual(await checkVideo(cfg, mp4({ size: 14_500_000 })), { ok: true, checked: false });   // too big to look at in one request
  assert.equal(geminiCalls().length, n);
  assert.deepEqual(await say(checkPoster, 'poster', {}, jpg, jpg), { ok: true });
  assert.equal(geminiCalls().at(-1).body.contents[0].parts.filter((p) => p.inlineData).length, 2);
  assert.deepEqual(await say(checkPoster, 'poster', { same: false }, jpg, jpg), { ok: false, why: 'other' });
  assert.deepEqual(await say(checkPoster, 'poster', { minor: true, same: false }, jpg, jpg), { ok: false, why: 'minor' });
  // stopped by its own safety filters: a no
  fake.gemini.blocked = true;
  assert.deepEqual(await checkSelfie(cfg, jpg), { ok: false, why: 'sexual' });
  assert.deepEqual(await checkFrames(cfg, [jpg]), { ok: false, why: 'sexual' });
  fake.gemini.blocked = false;
  // it can't say: an error (why "ai"), never a yes, and never its key
  for (const status of [429, 500, 403]) {
    fake.gemini.status = status;
    for (const check of [() => checkSelfie(cfg, jpg), () => checkArt(cfg, jpg), () => checkFrames(cfg, [jpg]), () => checkVideo(cfg, video), () => checkPoster(cfg, jpg, jpg)]) {
      await assert.rejects(check, (e) => e.why === 'ai' && !e.message.includes(GEMINI_KEY));
    }
  }
  fake.gemini.status = 200;
  await assert.rejects(() => checkArt({ ...cfg, geminiKey: '' }, jpg), (e) => e.why === 'ai');
});

// ---------- uploads ----------
test('an upload\'s ticket, and a clip\'s length read from its own header', () => {
  const now = Date.now();
  const t = makeTicket(SECRET, 'up', { u: idOf('u'), w: 'code', k: 'clip', b: 9, p: 1 }, now);
  assert.deepEqual(readTicket(SECRET, 'up', t, now + 1000), { u: idOf('u'), w: 'code', k: 'clip', b: 9, p: 1, exp: now + UPLOAD.TICKET_MS });
  assert.equal(readTicket(SECRET, 'poster', t, now), null);                       // another kind of ticket
  assert.equal(readTicket('another-secret-that-is-long-enough-12345', 'up', t, now), null);
  assert.equal(readTicket(SECRET, 'up', t, now + UPLOAD.TICKET_MS + 1), null);
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ u: idOf('x'), w: 'code', k: 'clip', b: 9, p: 1, exp: now + 9e9 })).toString('base64url');
  for (const bad of [`${forged}.${sig}`, `${t}.x`, payload, 'x'.repeat(601), 42, null, `${Buffer.from('not json').toString('base64url')}.${sig}`]) {
    assert.equal(readTicket(SECRET, 'up', bad, now), null, String(bad).slice(0, 20));
  }
  // an MP4's length: its movie header, wherever it is in the file (its 32- or 64-bit form)
  assert.equal(mp4Seconds(mp4({ seconds: 5 })), 5);
  assert.equal(mp4Seconds(mp4({ seconds: 7.5, v1: true })), 7.5);
  assert.equal(mp4Seconds(mp4({ seconds: 3.25, moovLast: true })), 3.25);
  const v = mp4({ seconds: 6, size: 2000 });
  const ftypLen = v.readUInt32BE(0), moovLen = v.readUInt32BE(ftypLen);
  const mdat64 = Buffer.alloc(116); mdat64.writeUInt32BE(1, 0); mdat64.write('mdat', 4, 'latin1'); mdat64.writeBigUInt64BE(116n, 8);
  assert.equal(mp4Seconds(Buffer.concat([v.subarray(0, ftypLen), mdat64, v.subarray(ftypLen, ftypLen + moovLen)])), 6);
  const toEnd = Buffer.from(mp4({ seconds: 4, moovLast: true })); toEnd.writeUInt32BE(0, toEnd.length - 116);     // "to the end of the file"
  assert.equal(mp4Seconds(toEnd), 4);
  const tooLong = Buffer.from(v); tooLong.writeUInt32BE(9_000_000, ftypLen);
  assert.equal(mp4Seconds(tooLong), null);
  assert.equal(mp4Seconds(Buffer.from('not a video at all, really not')), null);
  assert.equal(mp4Seconds(mp4().subarray(0, 60)), null);
  assert.equal(mp4Seconds('ftyp'), null);
});

test('a picture made plain: a JPEG at most 1536 px, upright, its metadata and location dropped, never made bigger', async () => {
  assert.ok((await sharp(JPEG_EXIF).metadata()).exif);                           // (the test picture has some)
  const out = await plainJpeg(JPEG_EXIF);
  const m = await sharp(out).metadata();
  assert.deepEqual([m.format, m.exif, Math.max(m.width, m.height)], ['jpeg', undefined, 1536]);
  assert.ok(!out.includes(Buffer.from('Secret Street')));
  const big = await sharp(await plainJpeg(BIG_PNG)).metadata();
  assert.deepEqual([big.width, big.height, big.format], [1536, 1024, 'jpeg']);
  const small = await sharp(await plainJpeg(PNG, { px: 512 })).metadata();
  assert.deepEqual([small.width, small.height], [341, 512]);
  const tiny = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#88aaff' } }).webp().toBuffer();
  const t = await sharp(await plainJpeg(tiny)).metadata();
  assert.deepEqual([t.width, t.height, t.format], [200, 100, 'jpeg']);
  // see-through parts on white
  const clear = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const px = await sharp(await plainJpeg(clear)).raw().toBuffer();
  assert.ok(px[0] > 245 && px[1] > 245 && px[2] > 245);
  // turned upright (a phone held sideways)
  const sideways = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#ff0000' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const up = await sharp(await plainJpeg(sideways)).metadata();
  assert.deepEqual([up.width, up.height, up.orientation], [100, 300, undefined]);
  // not a picture we read
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).gif().toBuffer();
  for (const bad of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), Buffer.from('hello, not a picture'), gif]) {
    assert.equal(await plainJpeg(bad), null);
  }
});

test('opening an upload: 18+, the human check, its kind and size, a face only with consent, private, 30 a day, its speed bump', async () => {
  let r = await act('inf-up-open', { kind: 'picture', bytes: 200_000 });
  assert.deepEqual([r.status, r.body.error], [400, 'adult']);
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true });
  assert.deepEqual([r.status, r.body.error], [401, 'human_check']);
  fake.human = false;
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, turnstileToken: 'tok' });
  assert.deepEqual([r.status, r.body.error], [401, 'human_check']);
  fake.human = true;
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, turnstileToken: 'tok' });
  assert.equal(r.status, 200);
  assert.match(r.body.id, ID);
  assert.deepEqual([r.body.parts, r.body.part, r.body.level], [1, R.CLIP.PART, 1]);
  assert.equal(calls.filter((c) => c.to === 'turnstile').at(-1).body.response, 'tok');
  const t = readTicket(SECRET, 'up', r.body.ticket);
  assert.deepEqual([t.u, t.w, t.k, t.b, t.p], [r.body.id, codeOf(), 'picture', 200_000, 1]);
  assert.equal(fake.db.uploads.get(r.body.id).status, 'open');
  // its pass: no second human check for two hours
  const pass = r.body.pass;
  assert.ok(pass);
  const checks = calls.filter((c) => c.to === 'turnstile').length;
  r = await act('inf-up-open', { kind: 'clip', bytes: 8_000_000, adult: true, pass });
  assert.deepEqual([r.status, r.body.parts, r.body.pass], [200, 3, undefined]);
  assert.equal(calls.filter((c) => c.to === 'turnstile').length, checks);
  for (const [extra, status, error] of [
    [{ kind: 'pdf', bytes: 5000 }, 400, 'kind'],
    [{ kind: 'picture', bytes: 999 }, 413, 'size'],
    [{ kind: 'picture', bytes: 4_000_001 }, 413, 'size'],
    [{ kind: 'clip', bytes: 30_000_001 }, 413, 'size'],
    [{ kind: 'picture', bytes: '12abc' }, 413, 'size'],
    [{ kind: 'face', bytes: 200_000 }, 400, 'consent'],
    [{ kind: 'face', bytes: 200_000, consent: 'yes' }, 400, 'consent'],
  ]) {
    r = await act('inf-up-open', { ...extra, adult: true, pass });
    assert.deepEqual([r.status, r.body.error], [status, error], JSON.stringify(extra));
  }
  r = await act('inf-up-open', { kind: 'face', bytes: 200_000, consent: true, adult: true, pass });
  assert.equal(r.status, 200);
  process.env.STUDIO_FACES = 'off';
  r = await act('inf-up-open', { kind: 'face', bytes: 200_000, consent: true, adult: true, pass });
  assert.deepEqual([r.status, r.body.error], [403, 'faces_off']);
  delete process.env.STUDIO_FACES;
  // private: only the studio's own wallets
  delete process.env.STUDIO_OPEN;
  process.env.STUDIO_ONLY_FOR = OTHER;
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, pass });
  assert.deepEqual([r.status, r.body.error], [403, 'closed']);
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, pass }, { wallet: OTHER });
  assert.equal(r.status, 200);
  process.env.STUDIO_OPEN = 'yes';
  // 30 a day per wallet
  infActBurst.reset();
  for (let n = fake.db.uploads.size; n < 31; n++) {
    const id = idOf(`many${n}`);
    fake.db.uploads.set(id, { id, wallet_code: codeOf(), kind: 'picture', status: 'refused', why: 'other', seconds: null, created: Date.now() - 1000 });
  }
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, pass });
  assert.deepEqual([r.status, r.body.error], [429, 'too_many']);
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, pass }, { wallet: OTHER });
  assert.equal(r.status, 200);
  // 20 asks a minute per visitor (each may ask Cloudflare, the chain or the AI service)
  infActBurst.reset();
  for (let n = 0; n < 20; n++) assert.equal((await act('inf-up-open', { kind: 'pdf', bytes: 5000, adult: true, pass })).status, 400);
  r = await act('inf-up-open', { kind: 'picture', bytes: 200_000, adult: true, pass });
  assert.deepEqual([r.status, r.body.error, r.body.level], [429, 'too_fast', 1]);
});

test('a picture or a selfie: made plain, then looked at by the AI check before anything is kept', async () => {
  const open = async (kind, bytes, extra = {}) => (await act('inf-up-open', { kind, bytes: bytes.length, adult: true, turnstileToken: 'tok', ...extra })).body;
  const send = (o, bytes, extra = '&part=0') => postBytes(`inf-up=${encodeURIComponent(o.ticket)}${extra}`, bytes);
  // a character's picture: kept as a plain JPEG (no EXIF), its upload "ok"
  let o = await open('picture', JPEG_EXIF);
  let r = await send(o, JPEG_EXIF);
  assert.deepEqual([r.status, r.body], [200, { ok: true, id: o.id, status: 'ok' }]);
  assert.equal(fake.db.uploads.get(o.id).status, 'ok');
  const kept = fake.storage.get(`up/${o.id}.jpg`);
  assert.equal(kept.type, 'image/jpeg');
  assert.equal((await sharp(kept.bytes).metadata()).exif, undefined);
  assert.equal(geminiCalls().at(-1).which, 'art');
  assert.ok(Buffer.from(geminiCalls().at(-1).body.contents[0].parts[0].inlineData.data, 'base64').equals(kept.bytes));   // what was looked at is what's kept
  // sent again: it's finished already
  r = await send(o, JPEG_EXIF);
  assert.deepEqual([r.status, r.body.error], [409, 'done']);
  // the AI check says no: refused, nothing kept
  o = await open('picture', PNG);
  fake.gemini.art = { photo: true };
  r = await send(o, PNG);
  assert.deepEqual([r.status, r.body], [422, { error: 'refused', why: 'real_person' }]);
  assert.equal(fake.storage.has(`up/${o.id}.jpg`), false);
  assert.deepEqual([fake.db.uploads.get(o.id).status, fake.db.uploads.get(o.id).why], ['refused', 'real_person']);
  fake.gemini.art = null;
  r = await send(o, PNG);
  assert.deepEqual([r.status, r.body.error], [409, 'done']);
  // the AI check can't say: nothing kept, nothing decided (the page sends it again)
  o = await open('picture', PNG);
  fake.gemini.status = 503;
  r = await send(o, PNG);
  assert.deepEqual([r.status, r.body.error], [503, 'ai']);
  assert.equal(fake.db.uploads.get(o.id).status, 'open');
  assert.equal(fake.storage.has(`up/${o.id}.jpg`), false);
  fake.gemini.status = 200;
  assert.equal((await send(o, PNG)).status, 200);
  // not a picture
  const junk = Buffer.alloc(5000, 1);
  o = await open('picture', junk);
  r = await send(o, junk);
  assert.deepEqual([r.status, r.body.error], [422, 'picture']);
  assert.deepEqual([fake.db.uploads.get(o.id).status, fake.db.uploads.get(o.id).why], ['refused', 'picture']);
  // a selfie: looked at as a selfie
  o = await open('face', JPEG_EXIF, { consent: true });
  fake.gemini.selfie = { apparentAge: 17, adult: false };
  r = await send(o, JPEG_EXIF);
  assert.deepEqual([r.status, r.body], [422, { error: 'refused', why: 'minor' }]);
  assert.equal(geminiCalls().at(-1).which, 'selfie');
  fake.gemini.selfie = null;
  // the wrong requests
  o = await open('picture', PNG);
  const q = `inf-up=${encodeURIComponent(o.ticket)}`;
  for (const [query, status, error] of [
    [`${q}&part=1`, 400, 'bad_request'], [`${q}&frame=0`, 400, 'bad_request'], [`${q}&part=0&frame=0`, 400, 'bad_request'],
    [q, 400, 'bad_request'], [`${q}&part=x`, 400, 'bad_request'], [`${q}&part=123`, 400, 'bad_request'],
    [`inf-up=${encodeURIComponent(`${o.ticket.slice(0, -2)}xx`)}&part=0`, 401, 'ticket'], ['inf-up=nope&part=0', 401, 'ticket'],
  ]) {
    r = await postBytes(query, PNG);
    assert.deepEqual([r.status, r.body?.error], [status, error], query);
  }
  r = await postBytes(`${q}&part=0`, Buffer.alloc(4_100_000, 1));
  assert.deepEqual([r.status, r.body.error], [413, 'size']);
  r = await postBytes(`${q}&part=0`, Buffer.alloc(4_300_000, 1));
  assert.deepEqual([r.status, r.body.error], [413, 'size']);
  r = await postBytes(`${q}&part=0`, Buffer.alloc(0));
  assert.deepEqual([r.status, r.body.error], [400, 'bad_request']);
  // another wallet's ticket can't reach this upload; an upload the database forgot is gone
  const other = makeTicket(SECRET, 'up', { u: o.id, w: codeOf(OTHER), k: 'picture', b: PNG.length, p: 1 });
  r = await postBytes(`inf-up=${encodeURIComponent(other)}&part=0`, PNG);
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  fake.db.uploads.delete(o.id);
  r = await postBytes(`${q}&part=0`, PNG);
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  // the studio app off (no FAL_KEY): nothing is taken
  delete process.env.FAL_KEY;
  r = await postBytes(`${q}&part=0`, PNG);
  assert.deepEqual([r.status, r.body.error], [503, 'not_ready']);
});

test('a clip: its parts and frames, put together, its length read from its own header, looked at, its parts and frames deleted', async () => {
  const video = mp4({ seconds: 6.4, size: 8_000_000 });
  const frame = await sharp(PNG).resize(320).jpeg().toBuffer();
  const openClip = async (bytes) => (await act('inf-up-open', { kind: 'clip', bytes, adult: true, turnstileToken: 'tok' })).body;
  let o = await openClip(video.length);
  assert.equal(o.parts, 3);
  const q = `inf-up=${encodeURIComponent(o.ticket)}`;
  const parts = [video.subarray(0, 3_500_000), video.subarray(3_500_000, 7_000_000), video.subarray(7_000_000)];
  // a part of the wrong size, or past its last: no
  let r = await postBytes(`${q}&part=0`, parts[2]);
  assert.deepEqual([r.status, r.body.error], [400, 'size']);
  r = await postBytes(`${q}&part=3`, parts[2]);
  assert.deepEqual([r.status, r.body.error], [400, 'bad_request']);
  for (const [i, p] of parts.entries()) assert.equal((await postBytes(`${q}&part=${i}`, p)).status, 200);
  assert.deepEqual(stored(`up/${o.id}/`), [`up/${o.id}/0.part`, `up/${o.id}/1.part`, `up/${o.id}/2.part`]);
  // "done" before its frames: it can't be looked at yet (nothing decided)
  r = await act('inf-up-done', { ticket: o.ticket });
  assert.deepEqual([r.status, r.body.error, r.body.why], [422, 'refused', 'frames']);
  assert.equal(fake.db.uploads.get(o.id).status, 'open');
  // its frames (taken in the browser): made small, kept on the way
  for (let i = 0; i < 3; i++) assert.equal((await postBytes(`${q}&frame=${i}`, frame)).status, 200);
  r = await postBytes(`${q}&frame=3`, frame);
  assert.deepEqual([r.status, r.body.error], [400, 'bad_request']);
  r = await postBytes(`${q}&frame=0`, Buffer.alloc(300_001, 1));
  assert.deepEqual([r.status, r.body.error], [413, 'size']);
  r = await postBytes(`${q}&frame=1`, Buffer.alloc(2000, 1));
  assert.deepEqual([r.status, r.body.error], [422, 'picture']);
  assert.ok((await sharp(fake.storage.get(`up/${o.id}/f1.jpg`).bytes).metadata()).width <= 512);
  // done: put together, its length read, its frames looked at, its parts and frames deleted (the clip itself kept)
  r = await act('inf-up-done', { ticket: o.ticket });
  assert.deepEqual([r.status, r.body.ok, r.body.id, r.body.seconds], [200, true, o.id, 6.4]);
  assert.ok(fake.storage.get(`up/${o.id}.mp4`).bytes.equals(video));
  assert.equal(fake.storage.get(`up/${o.id}.mp4`).type, 'video/mp4');
  assert.deepEqual(stored(`up/${o.id}/`), []);
  assert.deepEqual([fake.db.uploads.get(o.id).status, fake.db.uploads.get(o.id).seconds], ['ok', 6.4]);
  const g = geminiCalls().at(-1);
  assert.equal(g.which, 'frames');
  assert.equal(g.body.contents[0].parts.filter((p) => p.inlineData).length, 3);
  // asked again: it's ok already
  r = await act('inf-up-done', { ticket: o.ticket });
  assert.deepEqual([r.status, r.body.seconds], [200, 6.4]);
  // what's refused: every file of it deleted
  infActBurst.reset();
  const send = async (v, { frames = 3, parts: only = null } = {}) => {
    const oc = await openClip(v.length);
    const qc = `inf-up=${encodeURIComponent(oc.ticket)}`;
    for (let i = 0; i < (only ?? oc.parts); i++) await postBytes(`${qc}&part=${i}`, v.subarray(i * R.CLIP.PART, (i + 1) * R.CLIP.PART));
    for (let i = 0; i < frames; i++) await postBytes(`${qc}&frame=${i}`, frame);
    return { oc, r: await act('inf-up-done', { ticket: oc.ticket }) };
  };
  let s = await send(mp4({ seconds: 12 }));
  assert.deepEqual([s.r.status, s.r.body.error, s.r.body.why], [422, 'refused', 'length']);
  assert.deepEqual(stored(`up/${s.oc.id}`), []);
  assert.deepEqual([fake.db.uploads.get(s.oc.id).status, fake.db.uploads.get(s.oc.id).why], ['refused', 'length']);
  s = await send(mp4({ seconds: 1.5 }));
  assert.equal(s.r.body.why, 'length');
  s = await send(Buffer.concat([Buffer.from('not an mp4 header!'), Buffer.alloc(20_000, 3)]));
  assert.equal(s.r.body.why, 'video');
  fake.gemini.frames = { adult: false };
  s = await send(mp4({ seconds: 4 }));
  assert.equal(s.r.body.why, 'minor');
  assert.deepEqual(stored(`up/${s.oc.id}`), []);
  fake.gemini.frames = null;
  infActBurst.reset();
  // a part missing: nothing decided (it can still come)
  s = await send(mp4({ seconds: 4, size: 5_000_000 }), { parts: 1 });
  assert.deepEqual([s.r.body.error, s.r.body.why], ['refused', 'parts']);
  assert.equal(fake.db.uploads.get(s.oc.id).status, 'open');
  // the AI check can't say: 503, nothing decided, asked again
  fake.gemini.status = 500;
  s = await send(mp4({ seconds: 4 }));
  assert.deepEqual([s.r.status, s.r.body.error], [503, 'ai']);
  assert.equal(fake.db.uploads.get(s.oc.id).status, 'open');
  fake.gemini.status = 200;
  r = await act('inf-up-done', { ticket: s.oc.ticket });
  assert.deepEqual([r.status, r.body.seconds], [200, 4]);
  // the wrong tickets: a picture's, another wallet's, none
  const pic = (await act('inf-up-open', { kind: 'picture', bytes: 5000, adult: true, turnstileToken: 'tok' })).body;
  for (const ticket of [pic.ticket, makeTicket(SECRET, 'up', { u: o.id, w: codeOf(OTHER), k: 'clip', b: video.length, p: 3 }), 'nope', undefined]) {
    r = await act('inf-up-done', { ticket });
    assert.deepEqual([r.status, r.body.error], [401, 'ticket']);
  }
});

test('a video\'s poster: a frame its page took, looked at next to its influencer\'s look, then kept for Explore\'s tiles', async () => {
  const { id, looks } = await readyInf();
  const video = await doneJob(id, 'video');
  const look = picPath(id, looks, 1);
  const ticket = (extra = {}) => encodeURIComponent(makeTicket(SECRET, 'poster', { j: video, o: id, l: look, ...extra }, Date.now(), 3600e3));
  const frame = await sharp(PNG).jpeg().toBuffer();
  let r = await postBytes(`inf-poster=${ticket()}`, frame);
  assert.deepEqual([r.status, r.body], [200, { ok: true }]);
  const kept = fake.storage.get(`inf/${id}/${video}.poster.webp`);
  assert.equal(kept.type, 'image/webp');
  const pm = await sharp(kept.bytes).metadata();
  assert.deepEqual([pm.width, pm.height, pm.format], [320, 480, 'webp']);
  assert.equal(fake.db.jobs.get(video).poster, true);
  const g = geminiCalls().at(-1);
  assert.equal(g.which, 'poster');
  assert.equal(g.body.contents[0].parts.filter((p) => p.inlineData).length, 2);
  // not the same character: refused, nothing kept
  const v2 = await doneJob(id, 'trend');
  fake.gemini.poster = { same: false };
  r = await postBytes(`inf-poster=${ticket({ j: v2 })}`, frame);
  assert.deepEqual([r.status, r.body], [422, { error: 'refused', why: 'other' }]);
  assert.equal(fake.storage.has(`inf/${id}/${v2}.poster.webp`), false);
  fake.gemini.poster = null;
  // the AI check can't say: nothing kept
  fake.gemini.status = 429;
  r = await postBytes(`inf-poster=${ticket({ j: v2 })}`, frame);
  assert.deepEqual([r.status, r.body.error], [503, 'ai']);
  fake.gemini.status = 200;
  // its look gone (its influencer deleted meanwhile): gone
  const keep = fake.storage.get(look);
  fake.storage.delete(look);
  r = await postBytes(`inf-poster=${ticket({ j: v2 })}`, frame);
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  fake.storage.set(look, keep);
  // the owner's trend move: nothing to compare it with, kept under trends/
  const tj = keptTrend('wave-hi', { poster: false });
  r = await postBytes(`inf-poster=${encodeURIComponent(makeTicket(SECRET, 'poster', { j: tj, o: 'trends' }))}`, frame);
  assert.equal(r.status, 200);
  assert.ok(fake.storage.has(`trends/${tj}.poster.webp`));
  assert.equal(fake.db.jobs.get(tj).poster, true);
  // a job that isn't a done video: the database says no
  fake.db.jobs.get(v2).status = 'failed';
  r = await postBytes(`inf-poster=${ticket({ j: v2 })}`, frame);
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  // too big, not a picture, the wrong tickets
  r = await postBytes(`inf-poster=${ticket()}`, Buffer.alloc(400_001, 1));
  assert.deepEqual([r.status, r.body.error], [413, 'size']);
  r = await postBytes(`inf-poster=${ticket()}`, Buffer.alloc(3000, 1));
  assert.deepEqual([r.status, r.body.error], [422, 'picture']);
  for (const bad of ['nope', makeTicket(SECRET, 'up', { j: video, o: id }), makeTicket(SECRET, 'poster', { j: 'short', o: id }),
    makeTicket(SECRET, 'poster', { j: video, o: id }, Date.now() - 2 * 3600e3, 3600e3)]) {
    r = await postBytes(`inf-poster=${encodeURIComponent(bad)}`, frame);
    assert.deepEqual([r.status, r.body.error], [401, 'ticket']);
  }
});

// ---------- credits ----------
test('credits: a holder\'s free ones once a month (while the site\'s last), its prices, spent free ones first, given back', async () => {
  const cfg = cfgNow(), c = codeOf();
  assert.deepEqual(await creditsOf(cfg, c), { paid: 0, free: 0, total: 0 });
  assert.deepEqual(await grantFree(cfg, c, 1), { granted: false, why: 'level', free: 0 });
  assert.equal(calls.filter((x) => x.fn === 'inf_free').length, 0);
  assert.deepEqual(await grantFree(cfg, c, 2), { granted: true, why: null, free: 100 });
  assert.deepEqual(calls.find((x) => x.fn === 'inf_free').args, { p_wallet: c, p_amount: 100, p_cap: 5000 });
  assert.deepEqual(await grantFree(cfg, c, 3), { granted: false, why: 'done', free: 100 });          // once a month
  assert.deepEqual(await creditsOf(cfg, c), { paid: 0, free: 100, total: 100 });
  // the site's free credits this month are capped (STUDIO_FREE_CREDITS_A_MONTH)
  process.env.STUDIO_FREE_CREDITS_A_MONTH = '450';
  assert.deepEqual(await grantFree(cfgNow(), codeOf(OTHER), 3), { granted: false, why: 'cap', free: 0 });
  assert.deepEqual(await grantFree(cfgNow(), codeOf(BOSS), 2), { granted: true, why: null, free: 100 });
  process.env.STUDIO_FREE_CREDITS_A_MONTH = '0';
  assert.deepEqual(await grantFree(cfgNow(), codeOf(OTHER), 2), { granted: false, why: 'cap', free: 0 });
  delete process.env.STUDIO_FREE_CREDITS_A_MONTH;
  // in the app: a Soulmate's first visit this month gives them, its prices, whether it may make one, whether it's the owner
  const w3 = '0x4444444444444444444444444444444444444444';
  let r = await act('inf-me', {}, { wallet: w3, level: 3 });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.free, r.body.credits], [{ granted: true, why: null, free: 400 }, { paid: 0, free: 400, total: 400 }]);
  assert.deepEqual(r.body.prices, { influencer: 60, looks: 24, photo: 9, trend: 180, video: 240, model: 300 });
  assert.deepEqual([r.body.level, r.body.allowed, r.body.owner, r.body.influencers], [3, true, false, []]);
  r = await act('inf-me', {}, { wallet: w3, level: 3 });
  assert.deepEqual(r.body.free, { granted: false, why: 'done', free: 400 });
  r = await act('inf-me');
  assert.deepEqual([r.body.free, r.body.prices], [null, R.PRICES]);
  r = await act('inf-me', {}, { wallet: BOSS });
  assert.equal(r.body.owner, true);
  delete process.env.STUDIO_OPEN;
  r = await act('inf-me');
  assert.equal(r.body.allowed, false);
  process.env.STUDIO_OPEN = 'yes';
  // spent free ones first, then paid; given back when it couldn't be made (its free part only this month)
  giveCredits(50, w3);
  r = await act('inf-start', { name: 'Ezra', mode: 'design', style: 'toon', settings: { look: 'masculine', age: '20s' }, adult: true, turnstileToken: 'tok' }, { wallet: w3, level: 3 });
  assert.deepEqual(r.body.credits, { paid: 50, free: 340 });
  giveCredits(1000, w3);
  const many = [];
  for (const name of ['Sol', 'Lux']) {
    many.push((await act('inf-start', { name, mode: 'design', style: 'toon', settings: { look: 'masculine', age: '20s' }, adult: true, turnstileToken: 'tok' }, { wallet: w3, level: 3 })).body);
  }
  assert.deepEqual(many.map((m) => m.credits), [{ paid: 1050, free: 280 }, { paid: 1050, free: 220 }]);
  fake.db.cred(codeOf(w3)).free = 0;
  const after = fake.db.inf_credits({ p_wallet: codeOf(w3) });
  fake.db.inf_job_fail({ p_id: many[1].job, p_error: 'refused', p_refund: true });
  assert.deepEqual(fake.db.inf_credits({ p_wallet: codeOf(w3) }), { ...after, free: 60 });
  r = await act('inf-me', {}, { wallet: w3, level: 3 });
  assert.deepEqual(r.body.credits, { paid: 1050, free: 60, total: 1110 });
  assert.deepEqual(r.body.influencers.map((i) => `${i.name} ${i.status}`).sort(), ['Ezra looks', 'Lux failed', 'Sol looks']);
});

test('buying credits: "Check my payment" reads a USDG payment on the chain and counts it once', async () => {
  const tx = (n) => txOf(0xc0ffee00 + n);
  usdgPay(tx(1), 1000);
  let r = await act('inf-topup', { tx: tx(1) });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.ok, r.body.added, r.body.source, r.body.results], [true, 1000, 'pasted', [{ ok: true, amount: 1000 }]]);
  assert.deepEqual(r.body.credits, { paid: 1000, free: 0, total: 1000 });
  // its code in the database: never the transaction or the wallet's address
  const top = calls.find((c) => c.fn === 'inf_topup').args;
  assert.deepEqual(Object.keys(top).sort(), ['p_cents', 'p_tx', 'p_wallet']);
  const sent = JSON.stringify(calls.filter((c) => c.to === 'db')).toLowerCase();
  assert.ok(!sent.includes(tx(1).slice(2)) && !sent.includes(WALLET.slice(2).toLowerCase()));
  // the same one again: counted already
  r = await act('inf-topup', { tx: tx(1) });
  assert.deepEqual([r.body.added, r.body.results], [0, [{ ok: false, why: 'used' }]]);
  // its link pasted (the explorer's), another wallet's, somewhere else, failed, not on the chain yet, too old, too small
  usdgPay(tx(2), 250);
  r = await act('inf-topup', { tx: `https://robinhoodchain.blockscout.com/tx/${tx(2)}` });
  assert.equal(r.body.added, 250);
  usdgPay(tx(3), 500, { from: OTHER });
  r = await act('inf-topup', { tx: tx(3) });
  assert.deepEqual(r.body.results, [{ ok: false, why: 'other_wallet' }]);
  usdgPay(tx(4), 500, { to: OTHER });
  r = await act('inf-topup', { tx: tx(4) });
  assert.deepEqual(r.body.results, [{ ok: false, why: 'nothing' }]);
  usdgPay(tx(5), 500);
  fake.chain.receipts.get(tx(5)).status = '0x0';
  r = await act('inf-topup', { tx: tx(5) });
  assert.deepEqual(r.body.results, [{ ok: false, why: 'failed' }]);
  r = await act('inf-topup', { tx: tx(6) });
  assert.deepEqual(r.body.results, [{ ok: false, why: 'pending' }]);
  usdgPay(tx(7), 500);
  fake.chain.blockTime = Date.now() - 8 * DAY;
  r = await act('inf-topup', { tx: tx(7) });
  assert.deepEqual(r.body.results, [{ ok: false, why: 'too_old' }]);
  fake.chain.blockTime = Date.now();
  fake.chain.receipts.set(tx(8), { transactionHash: tx(8), status: '0x1', blockNumber: '0x2a', logs: [transferLog(USDG, WALLET, OWNER, 5000n)] });
  r = await act('inf-topup', { tx: tx(8) });
  assert.deepEqual([r.body.results, r.body.credits], [[{ ok: false, why: 'too_small' }], { paid: 1250, free: 0, total: 1250 }]);
  infActBurst.reset();
  // nothing pasted: the explorer says which of this wallet's payments to read (3 a check, each counted once)
  for (let n = 10; n < 15; n++) { usdgPay(tx(n), 100); fake.explorer.items.push(explorerItem(tx(n), { at: Date.now() - n * 1000 })); }
  r = await act('inf-topup', {});
  assert.deepEqual([r.body.source, r.body.added, r.body.results.length], ['explorer', 300, 3]);
  assert.ok(calls.some((c) => c.to === 'explorer' && c.url.includes(`${WALLET.toLowerCase()}/token-transfers`) && c.url.includes(USDG.toLowerCase())));
  r = await act('inf-topup', {});
  assert.deepEqual([r.body.added, r.body.results.length], [200, 2]);
  r = await act('inf-topup', {});
  assert.deepEqual([r.body.added, r.body.results], [0, []]);
  assert.match(AW.topupCheckText(r.body), /^No new payment from your wallet found yet/);
  // the explorer or the chain can't say: try again later
  fake.explorer.status = 503;
  r = await act('inf-topup', {});
  assert.deepEqual([r.status, r.body.error], [503, 'explorer']);
  fake.explorer.status = 200;
  fake.chain.down = true;
  usdgPay(tx(20), 100);
  r = await act('inf-topup', { tx: tx(20) });
  assert.deepEqual([r.status, r.body.error], [503, 'chain']);
  fake.chain.down = false;
  r = await act('inf-topup', { tx: 'not a transaction' });
  assert.deepEqual([r.status, r.body.error], [400, 'bad_tx']);
  // no studio wallet: no top-ups; private and not on its list: nothing to spend them on yet
  delete process.env.STUDIO_PAY_TO;
  r = await act('inf-topup', { tx: tx(20) });
  assert.deepEqual([r.status, r.body.error], [409, 'no_usdg']);
  process.env.STUDIO_PAY_TO = OWNER;
  delete process.env.STUDIO_OPEN;
  r = await act('inf-topup', { tx: tx(20) });
  assert.deepEqual([r.status, r.body.error], [403, 'closed']);
  process.env.STUDIO_OPEN = 'yes';
  r = await act('inf-topup', { tx: tx(20) });
  assert.equal(r.body.added, 100);
});

// ---------- an influencer, from start to ready ----------
test('a new influencer: 18+ and the human check, its words checked first, its credits spent (holders pay less), the limits', async () => {
  const start = (extra = {}, who = {}) => act('inf-start', { name: 'Nova', mode: 'design', style: 'anime', settings: { look: 'feminine', age: '20s' }, adult: true, turnstileToken: 'tok', ...extra }, who);
  let r = await start({ adult: false });
  assert.deepEqual([r.status, r.body.error], [400, 'adult']);
  fake.human = false;
  r = await start();
  assert.deepEqual([r.status, r.body.error], [401, 'human_check']);
  fake.human = true;
  r = await start({ name: 'Elon Musk' });
  assert.deepEqual([r.status, r.body.error, r.body.field, r.body.why, r.body.level], [422, 'words', 'name', 'person', 1]);
  assert.ok(r.body.pass);                                                      // (its human check passed: the page keeps its pass)
  r = await start({ settings: { look: 'feminine', age: '17' } });
  assert.deepEqual([r.body.field, r.body.why], ['age', 'bad']);
  assert.equal(calls.filter((c) => c.fn === 'inf_start').length, 0);          // nothing asked of the database for words that can't be
  // not enough credits: what it has, said
  r = await start();
  assert.deepEqual([r.status, r.body.error, r.body.have], [402, 'short', 0]);
  assert.equal(fake.db.infs.size, 0);
  giveCredits(250);
  r = await start({ name: '  Nova  ', settings: { look: 'feminine', age: '20s', hair: 'pink', cut: '' }, words: 'loves  neon' });
  assert.equal(r.status, 200);
  assert.match(r.body.id, ID);
  assert.match(r.body.job, ID);
  assert.deepEqual(r.body.credits, { paid: 150, free: 0 });
  const i = fake.db.infs.get(r.body.id);
  assert.deepEqual([i.name, i.mode, i.style, i.status, i.words, i.public, i.wallet_code, i.source], ['Nova', 'design', 'anime', 'looks', 'loves neon', true, codeOf(), null]);
  assert.deepEqual(i.settings, { look: 'feminine', age: '20s', hair: 'pink' });
  assert.deepEqual([fake.db.jobs.get(r.body.job).kind, fake.db.jobs.get(r.body.job).cost, fake.db.jobs.get(r.body.job).status], ['looks', 100, 'paid']);
  const s = calls.find((c) => c.fn === 'inf_start').args;
  assert.deepEqual([s.p_level, s.p_cost, s.p_per_wallet, s.p_day_cap], [1, 100, 3, 2000]);
  assert.ok(!JSON.stringify(s).toLowerCase().includes(WALLET.slice(2)));
  // holders pay less: a Crush 80, a Soulmate 60
  r = await start({}, { level: 2 });
  assert.deepEqual(r.body.credits, { paid: 70, free: 0 });
  r = await start({}, { level: 3 });
  assert.deepEqual(r.body.credits, { paid: 10, free: 0 });
  // 3 being made at once per wallet
  giveCredits(500);
  r = await start();
  assert.deepEqual([r.status, r.body.error], [429, 'too_many']);
  assert.equal(credits().paid, 510);
  infActBurst.reset();
  // from a picture: only with one of its own uploads that passed its check (then used)
  giveCredits(300, OTHER);
  fake.db.inf_free({ p_wallet: codeOf(OTHER), p_amount: 100, p_cap: 5000 });
  const mine = await okUpload('picture'), pic = await okUpload('picture', { wallet: OTHER }), face = await okUpload('face', { wallet: OTHER });
  for (const source of [undefined, 'nope', mine, face]) {
    r = await start({ mode: 'picture', settings: {}, source }, { wallet: OTHER, level: 2 });
    assert.deepEqual([r.status, r.body.error], [409, 'source'], String(source));
  }
  r = await start({ mode: 'picture', settings: { vibe: 'cool' }, source: pic }, { wallet: OTHER, level: 2 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.credits, { paid: 300, free: 20 });                   // its free ones first
  assert.deepEqual([fake.db.uploads.get(pic).status, fake.db.infs.get(r.body.id).source], ['used', pic]);
  r = await start({ mode: 'picture', settings: {}, source: pic }, { wallet: OTHER, level: 2 });
  assert.deepEqual([r.status, r.body.error], [409, 'source']);                 // used once
  // a face: with its consent, while faces are on; never in Explore
  r = await start({ mode: 'face', style: 'real', settings: {}, source: face }, { wallet: OTHER, level: 2 });
  assert.deepEqual([r.status, r.body.error], [400, 'consent']);
  process.env.STUDIO_FACES = 'off';
  r = await start({ mode: 'face', style: 'real', settings: {}, source: face, consent: true }, { wallet: OTHER, level: 2 });
  assert.deepEqual([r.status, r.body.error], [403, 'faces_off']);
  delete process.env.STUDIO_FACES;
  r = await start({ mode: 'face', style: 'real', settings: { outfit: 'sporty' }, source: face, consent: true }, { wallet: OTHER, level: 2 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.credits, { paid: 240, free: 0 });
  assert.deepEqual([fake.db.infs.get(r.body.id).public, fake.db.infs.get(r.body.id).mode], [false, 'face']);
  // the site's day (STUDIO_JOBS_A_DAY): a refused one never counted
  process.env.STUDIO_JOBS_A_DAY = String(fake.db.dayJobs);
  giveCredits(100, BOSS);
  r = await start({}, { wallet: BOSS });
  assert.deepEqual([r.status, r.body.error], [429, 'busy_day']);
  assert.equal(credits(BOSS).paid, 100);
  delete process.env.STUDIO_JOBS_A_DAY;
  // private: not on its list
  delete process.env.STUDIO_OPEN;
  r = await start({}, { wallet: BOSS });
  assert.deepEqual([r.status, r.body.error], [403, 'closed']);
  process.env.STUDIO_ONLY_FOR = BOSS;
  r = await start({}, { wallet: BOSS });
  assert.equal(r.status, 200);
});

test('its looks: 4 made to pick from (its page moves them along), new ones for a few credits, then its full body from the one picked', async () => {
  giveCredits(1000);
  const started = await act('inf-start', { name: 'Kira', mode: 'design', style: 'toon', settings: { look: 'androgynous', age: '40s', outfit: 'gamer' }, adult: true, turnstileToken: 'tok' });
  const { id, job } = started.body;
  // its page, open: sent to the AI service
  let r = await act('inf-look', { id });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.influencer.status, r.body.influencer.mine, r.body.influencer.job.kind, r.body.influencer.job.step], ['looks', true, 'looks', 'make']);
  const sent = falCalls().at(-1);
  assert.deepEqual([sent.path, sent.auth, sent.body.num_images, sent.body.aspect_ratio], [MODELS.image, `Key ${FAL_KEY}`, 4, '1:1']);
  assert.match(sent.body.prompt, /3D animated-movie-style character portrait render .*of a person with an androgynous look in their forties/);
  // waiting its turn: its place in line
  fake.fal.statusAnswer = { status: 'IN_QUEUE', queue_position: 3 };
  free(job);
  r = await act('inf-look', { id });
  assert.deepEqual(r.body.position, { job, at: 3 });
  fake.fal.statusAnswer = null;
  // made: 4 pictures kept (a JPEG and a small WebP each), its looks to pick from
  assert.equal((await finish(job)).state, 'done');
  for (let n = 0; n < 4; n++) {
    assert.equal(fake.storage.get(picPath(id, job, n)).type, 'image/jpeg');
    assert.equal(fake.storage.get(picPath(id, job, n, 'webp')).type, 'image/webp');
    assert.ok((await sharp(fake.storage.get(picPath(id, job, n, 'webp')).bytes).metadata()).height <= 384);
  }
  r = await act('inf-look', { id });
  assert.deepEqual([r.body.influencer.status, r.body.influencer.looks], ['pick', { job, files: 4 }]);
  assert.equal(r.body.influencer.portrait, null);
  // nobody else sees it yet
  assert.equal((await get(`inf=${id}`)).status, 404);
  assert.equal((await act('inf-look', { id }, { wallet: OTHER })).status, 404);
  // a look that isn't there, another wallet's pick
  for (const look of [4, -1, '1', 1.5]) {
    r = await act('inf-pick', { id, look });
    assert.deepEqual([r.status, r.body.error], [422, 'bad'], String(look));
  }
  r = await act('inf-pick', { id, look: 1 }, { wallet: OTHER });
  assert.deepEqual([r.status, r.body.error], [403, 'not_yours']);
  // new looks: 40 credits (a Stranger's), only while it's picking
  r = await act('inf-reroll', { id });
  assert.deepEqual([r.status, r.body.credits], [200, { paid: 860, free: 0 }]);
  assert.equal(fake.db.infs.get(id).status, 'looks');
  const again = [...fake.db.jobs.values()].find((j) => j.inf_id === id && j.kind === 'looks' && j.status === 'paid');
  assert.equal(again.cost, 40);
  r = await act('inf-reroll', { id });
  assert.deepEqual([r.status, r.body.error], [409, 'state']);
  // made with only 2 pictures this time: 2 to pick from
  fake.fal.images = 2;
  assert.equal((await finish(again.id)).state, 'done');
  fake.fal.images = null;
  r = await act('inf-look', { id });
  assert.deepEqual(r.body.influencer.looks, { job: again.id, files: 2 });
  r = await act('inf-pick', { id, look: 2 });
  assert.deepEqual([r.status, r.body.error], [422, 'bad']);
  // short of credits for new ones
  fake.db.cred(codeOf()).paid = 10;
  r = await act('inf-reroll', { id });
  assert.deepEqual([r.status, r.body.error, r.body.have], [402, 'short', 10]);
  // picked: its full body from that look, free
  r = await act('inf-pick', { id, look: 1 });
  assert.equal(r.status, 200);
  assert.deepEqual([fake.db.infs.get(id).status, fake.db.infs.get(id).pick], ['body', 1]);
  const body = [...fake.db.jobs.values()].find((j) => j.inf_id === id && j.kind === 'body');
  assert.equal(body.cost, 0);
  r = await act('inf-pick', { id, look: 0 });
  assert.deepEqual([r.status, r.body.error], [409, 'state']);
  r = await act('inf-look', { id });
  assert.equal(r.body.influencer.job.kind, 'body');
  const sentBody = falCalls().at(-1);
  assert.deepEqual([sentBody.path, sentBody.body.aspect_ratio, sentBody.body.num_images], [MODELS.edit, '9:16', 1]);
  assert.deepEqual(sentBody.body.image_urls.map((u) => new URL(u).pathname), [`/storage/v1/object/sign/agi1-characters/${picPath(id, again.id, 1)}`]);
  assert.equal(calls.find((c) => c.to === 'sign' && c.name === picPath(id, again.id, 1)).body.expiresIn, 21600);
  assert.match(sentBody.body.prompt, /wearing a gamer look/);
  assert.equal((await finish(body.id)).state, 'done');
  r = await act('inf-look', { id });
  assert.deepEqual([r.body.influencer.status, r.body.influencer.body, r.body.influencer.portrait], ['ready', body.id, { job: again.id, n: 1 }]);
  assert.ok(fake.storage.has(picPath(id, body.id, 0)) && fake.storage.has(picPath(id, body.id, 0, 'webp')));
  // anyone sees it now, by its link (never its choices or its words)
  r = await get(`inf=${id}`);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.influencer.name, r.body.influencer.mine, r.body.influencer.settings, r.body.influencer.looks, r.body.mine, r.body.raw],
    ['Kira', undefined, undefined, undefined, undefined, undefined]);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=10, s-maxage=20');
  r = await act('inf-me');
  assert.deepEqual(r.body.influencers.map((x) => [x.id, x.status, x.portrait]), [[id, 'ready', { job: again.id, n: 1 }]]);
});

test('its full body tried again: a pick can be made again for free, given up after 3 (its credits back)', async () => {
  giveCredits(500);
  const { id, job } = (await act('inf-start', { name: 'Zane', mode: 'design', style: 'anime', settings: { look: 'masculine', age: '20s' }, adult: true, turnstileToken: 'tok' })).body;
  assert.equal((await finish(job)).state, 'done');
  for (let n = 1; n <= 3; n++) {
    await act('inf-pick', { id, look: n % 4 });
    const b = [...fake.db.jobs.values()].filter((j) => j.inf_id === id && j.kind === 'body').at(-1);
    await tick(b.id);
    fake.fal.resultFail = { status: 422, text: JSON.stringify({ detail: [{ type: 'content_policy_violation', msg: 'no' }] }) };
    lastFal().status = 'COMPLETED';
    assert.equal((await tick(b.id)).state, 'failed');
    fake.fal.resultFail = null;
    const i = fake.db.infs.get(id);
    assert.deepEqual([i.status, i.body_tries, i.error], n < 3 ? ['pick', n, 'refused'] : ['failed', 3, 'refused']);
  }
  assert.equal(credits().paid, 500);                                           // its 100 back
  const r = await act('inf-look', { id });
  assert.deepEqual([r.body.influencer.status, r.body.influencer.error], ['failed', 'refused']);
});

test('from a picture or a face: what it\'s made from signed for the AI service, then deleted once its full body is made', async () => {
  giveCredits(1000);
  const pic = await okUpload('picture');
  let r = await act('inf-start', { name: 'Juno', mode: 'picture', style: 'anime', settings: { vibe: 'cool' }, source: pic, adult: true, turnstileToken: 'tok' });
  const { id, job } = r.body;
  await tick(job);
  assert.equal(falCalls().at(-1).path, MODELS.edit);
  assert.equal(new URL(falCalls().at(-1).body.image_urls[0]).pathname, `/storage/v1/object/sign/agi1-characters/up/${pic}.jpg`);
  assert.match(falCalls().at(-1).body.prompt, /of the character in the picture/);
  assert.equal((await finish(job)).state, 'done');
  await act('inf-pick', { id, look: 0 });
  const body = [...fake.db.jobs.values()].find((j) => j.inf_id === id && j.kind === 'body');
  await tick(body.id);
  assert.equal(falCalls().at(-1).body.image_urls.length, 1);                   // (its full body from its look alone)
  assert.equal((await finish(body.id)).state, 'done');
  assert.equal(fake.storage.has(`up/${pic}.jpg`), false);
  // a face: its selfie goes with its picked look for its full body (the face kept exactly), then deleted too
  const face = await okUpload('face');
  r = await act('inf-start', { name: 'Remi', mode: 'face', style: 'real', settings: {}, source: face, consent: true, adult: true, turnstileToken: 'tok' });
  const f = r.body;
  await tick(f.job);
  assert.match(falCalls().at(-1).body.prompt, /of the person in the photo, keeping their face recognizable/);
  assert.equal((await finish(f.job)).state, 'done');
  await act('inf-pick', { id: f.id, look: 3 });
  const fb = [...fake.db.jobs.values()].find((j) => j.inf_id === f.id && j.kind === 'body');
  await tick(fb.id);
  const sent = falCalls().at(-1).body;
  assert.deepEqual(sent.image_urls.map((u) => new URL(u).pathname.split('agi1-characters/')[1]), [picPath(f.id, f.job, 3), `up/${face}.jpg`]);
  assert.match(sent.prompt, /The second picture shows their real face/);
  assert.equal((await finish(fb.id)).state, 'done');
  assert.equal(fake.storage.has(`up/${face}.jpg`), false);
  // its picture gone before its looks are made: it can't be made, its credits come back
  const gone = await okUpload('picture');
  r = await act('inf-start', { name: 'Ivy', mode: 'picture', style: 'toon', settings: {}, source: gone, adult: true, turnstileToken: 'tok' });
  fake.storage.delete(`up/${gone}.jpg`);
  const paid = credits().paid;
  assert.equal((await tick(r.body.job)).state, 'failed');
  assert.deepEqual([fake.db.jobs.get(r.body.job).error, fake.db.infs.get(r.body.id).status], ['source', 'failed']);
  assert.equal(credits().paid, paid + 100);
});

// ---------- its photos and videos ----------
test('its photos and videos: made from its full body (or one of its photos), checked, kept, on its page', async () => {
  giveCredits(5000);
  const { id, body, looks } = await readyInf({ style: 'anime' });
  infActBurst.reset();
  const make = (extra, who) => act('inf-make', { id, ...extra }, who);
  // a photo in a scene, its shape
  let r = await make({ kind: 'photo', scene: 'reading in a cozy library', shape: 'wide' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.credits, { paid: 4985, free: 0 });
  const photo = r.body.job;
  await tick(photo);
  let sent = falCalls().at(-1);
  assert.deepEqual([sent.path, sent.body.aspect_ratio, sent.body.num_images], [MODELS.edit, '16:9', 1]);
  assert.ok(new URL(sent.body.image_urls[0]).pathname.endsWith(picPath(id, body, 0)));
  assert.match(sent.body.prompt, /Reading in a cozy library\./);
  assert.equal((await finish(photo)).state, 'done');
  assert.ok(fake.storage.has(picPath(id, photo, 0)) && fake.storage.has(picPath(id, photo, 0, 'webp')));
  assert.equal(fake.db.jobs.get(photo).files, 1);
  // a scene video of an anime influencer: from its full body (reference-to-video); its id for who asked, never the wallet
  r = await make({ kind: 'video', scene: 'waves at the camera on a sunny rooftop', shape: 'tall', sound: true });
  const video = r.body.job;
  assert.deepEqual(r.body.credits, { paid: 4585, free: 0 });
  await tick(video);
  sent = falCalls().at(-1);
  assert.equal(sent.path, 'bytedance/seedance-2.5/reference-to-video');
  assert.deepEqual([sent.body.aspect_ratio, sent.body.generate_audio, sent.body.resolution, sent.body.codec, sent.body.duration], ['9:16', true, '720p', 'H264', '5']);
  assert.match(sent.body.end_user_id, /^[A-Za-z0-9_-]{24}$/);
  assert.ok(![WALLET, codeOf()].includes(sent.body.end_user_id));
  // made: looked at before it's kept
  assert.equal((await finish(video)).state, 'done');
  assert.equal(geminiCalls().at(-1).which, 'video');
  assert.ok(fake.storage.get(`inf/${id}/${video}.mp4`).bytes.equals(fake.fal.video));
  assert.equal(fake.db.jobs.get(video).bytes, fake.fal.video.length);
  // from one of its photos: image to video (in the photo's shape, whatever was asked)
  r = await make({ kind: 'video', scene: 'the camera slowly zooms in as it smiles', shape: 'square', image: photo, sound: false });
  const fromPhoto = r.body.job;
  assert.equal(fake.db.jobs.get(fromPhoto).shape, 'wide');
  await tick(fromPhoto);
  sent = falCalls().at(-1);
  assert.deepEqual([sent.path, sent.body.generate_audio, sent.body.duration], [MODELS.i2v, false, '5']);
  assert.ok(new URL(sent.body.start_image_url).pathname.endsWith(picPath(id, photo, 0)));
  // a trend video: one of the owner's kept moves, copied onto its full body
  r = await make({ kind: 'trend', trend: 'hip-sway' });
  assert.deepEqual([r.status, r.body.error], [409, 'trend']);                  // not made (or kept) yet
  const move = keptTrend('hip-sway');
  r = await make({ kind: 'trend', trend: 'hip-sway' });
  const trend = r.body.job;
  assert.deepEqual([r.body.credits.paid, fake.db.jobs.get(trend).shape], [4585 - 400 - 300, 'tall']);
  await tick(trend);
  sent = falCalls().at(-1);
  assert.equal(sent.path, MODELS.motion);
  assert.ok(new URL(sent.body.video_url).pathname.endsWith(`trends/${move}.mp4`));
  assert.ok(new URL(sent.body.image_url).pathname.endsWith(picPath(id, body, 0)));
  // their own clip (one that passed its check, a day at most)
  const clip = await okUpload('clip');
  r = await make({ kind: 'trend', clip });
  const own = r.body.job;
  await tick(own);
  assert.ok(new URL(falCalls().at(-1).body.video_url).pathname.endsWith(`up/${clip}.mp4`));
  fake.db.uploads.get(clip).created = Date.now() - 2 * DAY;
  r = await make({ kind: 'trend', clip });
  assert.deepEqual([r.status, r.body.error], [409, 'clip']);
  infActBurst.reset();
  // 4 being made at once: the most
  r = await make({ kind: 'photo', scene: 'at the beach at sunset, hair in the wind', shape: 'tall' });
  assert.equal(r.status, 200);
  r = await make({ kind: 'photo', scene: 'at the beach at sunset, hair in the wind', shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [429, 'too_many']);
  // its page: done ones for anyone, its own wallet's being made too
  r = await get(`inf=${id}`);
  assert.deepEqual(r.body.jobs.map((j) => j.id).sort(), [photo, video].sort());
  const shown = r.body.jobs.find((j) => j.id === video);
  assert.deepEqual([shown.kind, shown.shape, shown.sound, shown.poster, shown.cost, shown.error, shown.mine], ['video', 'tall', true, false, undefined, undefined, false]);
  r = await act('inf-look', { id });
  assert.ok(r.body.jobs.length >= 6 && r.body.jobs.every((j) => j.mine === true));
  assert.deepEqual(r.body.jobs.find((j) => j.id === photo).cost, 15);
  // posters: a ticket for each done video without one (its page takes a frame)
  assert.deepEqual(Object.keys(r.body.posters), [video]);
  const pt = readTicket(SECRET, 'poster', r.body.posters[video]);
  assert.deepEqual([pt.j, pt.o, pt.l], [video, id, picPath(id, looks, 1)]);
});

test('what can\'t be made: words, shapes, a realistic video without a photo, another\'s photo, not ready, another\'s, gone, short', async () => {
  giveCredits(5000);
  const real = await readyInf({ name: 'Rio', style: 'real' });
  const anime = await readyInf({ name: 'Sky', style: 'anime' });
  infActBurst.reset();
  const make = (id, extra, who) => act('inf-make', { id, ...extra }, who);
  const scene = 'in a pastel flower field';
  let r = await make(real.id, { kind: 'photo', scene: 'with Taylor Swift backstage', shape: 'tall' });
  assert.deepEqual([r.status, r.body.error, r.body.field, r.body.why], [422, 'words', 'scene', 'person']);
  r = await make(real.id, { kind: 'photo', scene: 'short', shape: 'tall' });
  assert.deepEqual([r.body.field, r.body.why], ['scene', 'short']);
  r = await make(real.id, { kind: 'photo', scene, shape: 'round' });
  assert.deepEqual([r.body.field, r.body.why], ['shape', 'empty']);
  r = await make(real.id, { kind: 'video', scene: 'walks toward the camera down a neon street', shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [409, 'needs_photo']);
  const otherPhoto = await doneJob(anime.id, 'photo');
  r = await make(real.id, { kind: 'video', scene: 'walks toward the camera down a neon street', shape: 'tall', image: otherPhoto });
  assert.deepEqual([r.status, r.body.error], [409, 'image']);
  for (const [extra, error] of [
    [{ kind: 'photo', scene, shape: 'tall', image: otherPhoto }, 'bad'],      // a photo never starts from a photo
    [{ kind: 'trend' }, 'bad'],                                                  // a move or a clip: one of them
    [{ kind: 'trend', trend: 'heart-hands', clip: idOf('c') }, 'bad'],
    [{ kind: 'trend', trend: 'moonwalk' }, 'trend'],
    [{ kind: 'trend', clip: 'nope' }, 'clip'],
    [{ kind: 'selfie', scene, shape: 'tall' }, 'bad'],
    [{ kind: 'video', scene: 'walks toward the camera down a neon street', shape: 'tall', image: 'nope' }, 'bad'],
  ]) {
    r = await make(real.id, extra);
    assert.equal(r.body.error, error, JSON.stringify(extra));
  }
  r = await make('nope', { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [400, 'bad_request']);
  r = await make(idOf('nobody'), { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  r = await make(real.id, { kind: 'photo', scene, shape: 'tall' }, { wallet: OTHER });
  assert.deepEqual([r.status, r.body.error], [403, 'not_yours']);
  fake.db.infs.get(anime.id).status = 'pick';
  r = await make(anime.id, { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [409, 'not_ready']);
  fake.db.infs.get(anime.id).hidden = true;
  r = await make(anime.id, { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  process.env.STUDIO_HIDE = real.id;
  r = await make(real.id, { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  delete process.env.STUDIO_HIDE;
  fake.db.cred(codeOf()).paid = 10;
  r = await make(real.id, { kind: 'photo', scene, shape: 'tall' });
  assert.deepEqual([r.status, r.body.error, r.body.have], [402, 'short', 10]);
  infActBurst.reset();                                                          // (20 a minute per visitor)
  // a realistic influencer's video, from one of its own done photos
  fake.db.cred(codeOf()).paid = 1000;
  const own = await doneJob(real.id, 'photo', { shape: 'square' });
  r = await make(real.id, { kind: 'video', scene: 'walks toward the camera down a neon street', shape: 'tall', image: own });
  assert.equal(r.status, 200);
  assert.equal(fake.db.jobs.get(r.body.job).shape, 'square');
  fake.db.jobs.get(own).hidden = true;                                          // (taken down meanwhile)
  r = await make(real.id, { kind: 'video', scene: 'walks toward the camera down a neon street', shape: 'tall', image: own });
  assert.deepEqual([r.status, r.body.error], [409, 'image']);
  assert.equal(calls.filter((c) => c.to === 'fal').length, 0);                  // nothing reached the AI service
});

test('every way a job can go: waiting, refused, sent again, given up, too long, its files, its influencer gone', async () => {
  giveCredits(10_000);
  const { id } = await readyInf();
  const photoJob = async () => (await act('inf-make', { id, kind: 'photo', scene: 'on a mountain trail with a view', shape: 'tall' })).body.job;
  const job = (j) => fake.db.jobs.get(j);
  // fal's key refused, its balance empty, too many at once, fal down a moment: it waits (never failed), the owner told once
  let j = await photoJob();
  for (const [status, text] of [[401, '{"detail":"Invalid Key"}'], [403, '{"detail":"User is locked. Reason: Exhausted balance"}'], [429, 'busy'], [502, 'bad gateway'],
    [401, '{"detail":"Invalid Key"}']]) {
    fake.fal.submitFail.push({ status, text });
    assert.deepEqual(await tick(j), { state: 'waiting', step: 'queue' }, String(status));
    assert.equal(job(j).status, 'paid');
  }
  assert.ok(logs.filter((l) => /FAL_KEY is wrong/.test(l)).length <= 1);
  // its safety check says no when it's sent: refused, its credits back
  fake.fal.submitFail.push({ status: 422, text: JSON.stringify({ detail: [{ loc: ['body', 'prompt'], msg: 'flagged', type: 'content_policy_violation' }] }) });
  let paid = credits().paid;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'queue' });
  assert.deepEqual([job(j).error, job(j).refunded, credits().paid], ['refused', true, paid + 15]);
  // anything else it says no to: the AI service couldn't make it
  j = await photoJob();
  fake.fal.submitFail.push({ status: 422, text: JSON.stringify({ detail: [{ msg: 'image too small', type: 'value_error' }] }) });
  assert.equal((await tick(j)).state, 'failed');
  assert.equal(job(j).error, 'ai:photo');
  // in its queue, then being made: waiting, with its place in line
  j = await photoJob();
  assert.deepEqual(await tick(j), { state: 'started', step: 'make' });
  assert.deepEqual(await tick(j), { state: 'waiting', step: 'queue', position: 2 });
  lastFal().status = 'IN_PROGRESS';
  assert.deepEqual(await tick(j), { state: 'waiting', step: 'make' });
  fake.fal.statusFail = { status: 500, text: 'oops' };
  assert.deepEqual(await tick(j), { state: 'waiting', step: 'make' });         // its state can't be read for a moment
  fake.fal.statusFail = null;
  // its turn taken (another tick has it): busy
  job(j).lease = Date.now() + 30_000;
  assert.deepEqual(await jobTick(cfgNow(), j), { state: 'busy' });
  // failed at the service: sent again twice, then given up (its credits back)
  Object.assign(lastFal(), { status: 'COMPLETED', error: 'Internal error' });
  for (let n = 1; n <= 2; n++) {
    assert.deepEqual(await tick(j), { state: 'started', step: 'make' });
    assert.equal(job(j).tries, n);
    Object.assign(lastFal(), { status: 'COMPLETED', error: 'Internal error' });
  }
  paid = credits().paid;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'make' });
  assert.deepEqual([job(j).error, credits().paid], ['ai:photo', paid + 15]);
  // refused while it was made (fal's words for its safety check): at once
  j = await photoJob(); await tick(j);
  Object.assign(lastFal(), { status: 'COMPLETED', error: 'Content policy violation: NSFW content detected' });
  assert.deepEqual(await tick(j), { state: 'failed', step: 'make' });
  assert.equal(job(j).error, 'refused');
  // its result refused, or with no picture in it
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.fal.resultFail = { status: 422, text: JSON.stringify({ detail: [{ type: 'content_policy_violation', msg: 'no' }] }) };
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.equal(job(j).error, 'refused');
  fake.fal.resultFail = null;
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.fal.resultAnswer = { images: [] };
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.equal(job(j).error, 'ai:photo');
  fake.fal.resultAnswer = null;
  // its picture gone at the service already: it can't be kept
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.fal.mediaStatus = 404;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.equal(job(j).error, 'save');
  // its media or our storage away for a moment: tried again (4 tries in all), then given up
  fake.fal.mediaStatus = 500;
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  for (let n = 1; n <= 3; n++) {
    assert.deepEqual(await tick(j), { state: 'saving', step: 'save' });
    assert.deepEqual([job(j).saving, job(j).tries], [true, n]);
  }
  paid = credits().paid;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.deepEqual([job(j).error, credits().paid], ['save', paid + 15]);
  fake.fal.mediaStatus = 200;
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.storageDown = true;
  assert.deepEqual(await tick(j), { state: 'saving', step: 'save' });
  fake.storageDown = false;
  assert.deepEqual(await tick(j), { state: 'done', step: 'save' });
  // a picture the AI made that isn't one: tried again, then given up
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  const realPng = PNG;
  PNG = Buffer.from('not a picture at all');
  for (let n = 0; n < 3; n++) assert.equal((await tick(j)).state, 'saving');
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  PNG = realPng;
  // too little time left to keep it: left for the next turn (no try counted)
  j = await photoJob(); await tick(j);
  lastFal().status = 'COMPLETED';
  const short = { now: Date.now(), deadline: Date.now() + 10_000 };
  assert.deepEqual(await tick(j, short), { state: 'saving', step: 'save' });
  assert.deepEqual([job(j).saving, job(j).tries], [true, 0]);
  assert.deepEqual(await tick(j, { now: Date.now(), deadline: Date.now() + 10_000 }), { state: 'saving', step: 'save' });
  assert.equal(job(j).tries, 0);
  assert.equal((await tick(j)).state, 'done');
  // not made in 12 hours: given up, its credits back
  j = await photoJob(); await tick(j);
  job(j).started = Date.now() - 13 * 3600e3;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'make' });
  assert.equal(job(j).error, 'expired');
  // a video that isn't family-friendly: never shown, its credits back; one that can't be checked: tried, then "couldn't be checked"
  const video = async () => (await act('inf-make', { id, kind: 'video', scene: 'dances happily in a cozy living room', shape: 'tall' })).body.job;
  j = await video(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.gemini.video = { explicit: true };
  paid = credits().paid;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.deepEqual([job(j).error, job(j).refunded, credits().paid, fake.storage.has(`inf/${id}/${j}.mp4`)], ['refused', true, paid + 400, false]);
  fake.gemini.video = null;
  j = await video(); await tick(j);
  lastFal().status = 'COMPLETED';
  fake.gemini.status = 503;
  for (let n = 0; n < 3; n++) assert.equal((await tick(j)).state, 'saving');
  assert.deepEqual(await tick(j), { state: 'failed', step: 'save' });
  assert.equal(job(j).error, 'check');
  fake.gemini.status = 200;
  // a video too big to look at in one request: kept as it is (the video models screen their own), the owner told
  fake.fal.video = mp4({ size: 14_500_000 });
  j = await video(); await tick(j);
  lastFal().status = 'COMPLETED';
  assert.deepEqual(await tick(j), { state: 'done', step: 'save' });
  assert.ok(logs.some((l) => l.includes(`job ${j}'s video is too big to look at`)));
  fake.fal.video = mp4();
  // not an MP4: tried again, then given up
  fake.fal.video = Buffer.alloc(20_000, 7);
  j = await video(); await tick(j);
  lastFal().status = 'COMPLETED';
  for (let n = 0; n < 3; n++) assert.equal((await tick(j)).state, 'saving');
  assert.equal((await tick(j)).state, 'failed');
  fake.fal.video = mp4();
  // its influencer taken down (or deleted) meanwhile: not made, its credits back
  j = await photoJob();
  process.env.STUDIO_HIDE = id;
  paid = credits().paid;
  assert.deepEqual(await tick(j), { state: 'failed', step: 'queue' });
  assert.deepEqual([job(j).error, credits().paid], ['gone', paid + 15]);
  delete process.env.STUDIO_HIDE;
  // never the key in a log
  assert.ok(!logs.join('\n').includes(FAL_KEY.split(':')[1]));
});

// ---------- the clock and its tidy-up ----------
test('the clock: the jobs whose turn it is, one step each (never one already being moved), in its time; the tidy-up every half hour', async () => {
  giveCredits(1000);
  const { id } = await readyInf();
  infActBurst.reset();
  const make = async (scene) => (await act('inf-make', { id, kind: 'photo', scene, shape: 'tall' })).body.job;
  const a = await make('reading in a sunny cafe'), b = await make('walking a dog in the park');
  const cfg = cfgNow();
  const at = (minute) => Date.UTC(2026, 9, 10, 12, minute);
  // their turn: sent to the AI service (minute 7: no tidy-up)
  let r = await infClock(cfg, { now: at(7), deadline: Date.now() + 19_000 });
  assert.deepEqual(r, { due: 2, moved: 2, done: 0, failed: 0 });
  assert.deepEqual([fake.db.jobs.get(a).status, fake.db.jobs.get(b).status], ['making', 'making']);
  assert.equal(calls.find((c) => c.fn === 'inf_job_due').args.p_limit, 6);
  // still in the AI service's queue: asked, their turn given back for a few seconds
  r = await infClock(cfg, { now: at(7), deadline: Date.now() + 19_000 });
  assert.deepEqual(r, { due: 2, moved: 0, done: 0, failed: 0 });
  assert.ok(fake.db.jobs.get(a).lease > Date.now());
  assert.deepEqual(await infClock(cfg, { now: at(7) }), { due: 0, moved: 0, done: 0, failed: 0 });
  // made: kept (one of them being moved by its page right now: not the clock's)
  for (const fr of fake.fal.requests.values()) fr.status = 'COMPLETED';
  free(a); free(b);
  fake.db.jobs.get(b).lease = Date.now() + 30_000;
  r = await infClock(cfg, { now: at(7), deadline: Date.now() + 19_000 });
  assert.deepEqual(r, { due: 1, moved: 0, done: 1, failed: 0 });
  assert.equal(fake.db.jobs.get(a).status, 'done');
  // out of time: nothing more started (the next minute does it)
  free(b);
  assert.deepEqual(await infClock(cfg, { now: at(8), deadline: Date.now() + 4000 }), { due: 1, moved: 0, done: 0, failed: 0 });
  // one that throws (the database for a moment): the others go on, the log says which
  fake.missing.add('inf_job_get');
  r = await infClock(cfg, { now: at(8), deadline: Date.now() + 19_000 });
  assert.deepEqual(r, { due: 1, moved: 0, done: 0, failed: 0 });
  assert.ok(logs.some((l) => l.startsWith(`[studio] job ${b}: `)));
  fake.missing.delete('inf_job_get');
  free(b);
  assert.deepEqual(await infClock(cfg, { now: at(8), deadline: Date.now() + 19_000 }), { due: 1, moved: 0, done: 1, failed: 0 });
  // the tidy-up (at :00 and :30): old uploads and their files (a clip's parts too), influencers that couldn't be made a month
  // ago and deleted ones a week ago, and all their files
  const jpgUp = await okUpload('picture'), clipUp = await okUpload('clip'), freshUp = await okUpload('picture');
  for (const u of [jpgUp, clipUp]) fake.db.uploads.get(u).created = Date.now() - 3 * DAY;
  fake.storage.set(`up/${clipUp}/0.part`, { bytes: Buffer.from('part'), type: 'application/octet-stream' });
  fake.storage.set(`up/${clipUp}/f0.jpg`, { bytes: Buffer.from('frame'), type: 'image/jpeg' });
  const failed = await readyInf({ name: 'Old' }), gone = await readyInf({ name: 'Gone' }), recent = await readyInf({ name: 'Recent' });
  Object.assign(fake.db.infs.get(failed.id), { status: 'failed', updated: Date.now() - 31 * DAY });
  Object.assign(fake.db.infs.get(gone.id), { status: 'deleted', updated: Date.now() - 8 * DAY });
  Object.assign(fake.db.infs.get(recent.id), { status: 'failed', updated: Date.now() - 2 * DAY });
  const filesOf = (inf) => stored(`inf/${inf}/`);
  const before = { failed: filesOf(failed.id).length, gone: filesOf(gone.id).length };
  assert.ok(before.failed >= 6 && before.gone >= 6);
  assert.equal((await infClock(cfg, { now: at(29) })).tidy, undefined);
  r = await infClock(cfg, { now: at(30), deadline: Date.now() + 19_000 });
  assert.deepEqual(r.tidy, { uploads: 2, infs: 2, jobs: 0, files: 1 + 3 + before.failed + before.gone });
  assert.deepEqual([fake.db.uploads.has(jpgUp), fake.db.uploads.has(clipUp), fake.db.uploads.has(freshUp)], [false, false, true]);
  assert.deepEqual([stored(`up/${jpgUp}`), stored(`up/${clipUp}`), stored(`up/${freshUp}`)], [[], [], [`up/${freshUp}.jpg`]]);
  assert.deepEqual([filesOf(failed.id), filesOf(gone.id)], [[], []]);
  assert.ok(filesOf(recent.id).length >= 6 && fake.db.infs.has(recent.id));
  assert.equal((await infClock(cfg, { now: at(0) })).tidy.uploads, 0);
  // the tidy-up can't run (influencers.sql not run again): the clock still says what it moved, the log says why
  fake.missing.add('inf_tidy');
  r = await infClock(cfg, { now: at(30) });
  assert.deepEqual(r, { due: 0, moved: 0, done: 0, failed: 0 });
  assert.ok(logs.some((l) => l.startsWith("[studio] the studio app's tidy-up: ")));
});

test('GET /api/feed?studio: with studio.sql\'s key (from the database), AGI Studio\'s jobs once FAL_KEY is set, with or without Meshy\'s', async () => {
  const call = (auth) => feedGet(new Request('https://www.agi1.app/api/feed?studio', { headers: auth ? { authorization: auth } : {} }));
  assert.equal((await call()).status, 401);
  assert.equal((await call('Bearer nope')).status, 401);
  giveCredits(100);
  const { id } = await readyInf();
  const j = (await act('inf-make', { id, kind: 'photo', scene: 'reading in a sunny cafe', shape: 'tall' })).body.job;
  let res = await call(`Bearer ${STUDIO_KEY}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  let out = await res.json();
  assert.equal(out.ok, true);
  assert.deepEqual([out.inf.due, out.inf.moved, out.inf.done, out.inf.failed], [1, 1, 0, 0]);
  assert.equal(out.due, undefined, "Meshy's characters: off without MESHY_API_KEY");
  assert.equal(fake.db.jobs.get(j).status, 'making');
  // Meshy's key too: its characters and their videos first, then AGI Studio's, in the time left
  process.env.MESHY_API_KEY = `msy_${'a1'.repeat(20)}`;
  Object.assign(fake.db, { studio_due: () => [], studio_video_due: () => [], studio_tidy: () => ({ quotes: 0, failed: 0 }) });
  out = await (await call(`Bearer ${STUDIO_KEY}`)).json();
  assert.deepEqual([out.ok, out.due, out.moved, typeof out.videos, typeof out.inf], [true, 0, 0, 'object', 'object']);
  // influencers.sql not run yet: Meshy's characters still move along, AGI Studio's part says so (the log once)
  fake.missing.add('inf_job_due');
  out = await (await call(`Bearer ${STUDIO_KEY}`)).json();
  assert.deepEqual([out.ok, out.inf], [true, { error: 'not_set_up' }]);
  // …and without Meshy's key, the answer is that
  delete process.env.MESHY_API_KEY;
  res = await call(`Bearer ${STUDIO_KEY}`);
  assert.deepEqual([res.status, await res.json()], [502, { error: 'not_set_up' }]);
  fake.missing.delete('inf_job_due');
  // neither key: nothing to move along
  delete process.env.FAL_KEY;
  assert.deepEqual(await (await call(`Bearer ${STUDIO_KEY}`)).json(), { ok: true, off: 'no_key' });
  const src = read('api/feed.js');
  assert.match(src, /const \{ infOn, infClock \} = await import\('\.\.\/server\/inf-jobs\.js'\);/, 'loaded only for the clock');
});

// ---------- Explore, its page and its files ----------
test('Explore and its page: public ones only (never one made from a face), its files from our own address, its videos in parts', async () => {
  const a = await readyInf({ name: 'Nova' });
  const face = await readyInf({ name: 'Mia', mode: 'face', style: 'real' });
  const hid = await readyInf({ name: 'Zed' });
  fake.db.infs.get(hid.id).hidden = true;
  const quiet = await readyInf({ name: 'Ivy', publicOn: false });
  const down = await readyInf({ name: 'Rex' });
  process.env.STUDIO_HIDE = down.id;
  const notYet = await readyInf({ name: 'Kai' });
  fake.db.infs.get(notYet.id).status = 'pick';
  const v = await doneJob(a.id, 'video', { poster: true });
  const v3 = await doneJob(a.id, 'video');
  const faceVid = await doneJob(face.id, 'video');
  const hiddenVid = await doneJob(a.id, 'trend');
  fake.db.jobs.get(hiddenVid).hidden = true;
  fake.db.jobs.get(v).done = Date.now() - 5000;
  const move = keptTrend('hip-sway');
  // Explore: the same for everyone
  let r = await get('inf-explore');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=15, s-maxage=30');
  assert.deepEqual(r.body.influencers.map((i) => [i.id, i.name, i.style, i.portrait]), [[a.id, 'Nova', 'anime', { job: a.looks, n: 1 }]]);
  assert.deepEqual(r.body.fresh.map((j) => j.id), [v3, v]);
  assert.deepEqual(r.body.fresh[1], { id: v, kind: 'video', shape: 'tall', trend: null, poster: true, done: fake.db.jobs.get(v).done,
    inf: { id: a.id, name: 'Nova', portrait: { job: a.looks, n: 1 } } });
  assert.deepEqual(r.body.trends, [{ id: 'hip-sway', name: 'Hip sway', emoji: '💃', job: move, poster: true }]);
  // its page, by its link: a ready one for anyone (one made from a face too: never kept by the CDN)
  r = await get(`inf=${a.id}`);
  assert.deepEqual([r.status, r.headers.get('cache-control')], [200, 'public, max-age=10, s-maxage=20']);
  const i = fake.db.infs.get(a.id);
  assert.deepEqual(r.body.influencer, { id: a.id, name: 'Nova', mode: 'design', style: 'anime', status: 'ready', face: false, public: true,
    created: i.created, ready: i.ready, portrait: { job: a.looks, n: 1 }, body: a.body });
  assert.deepEqual(r.body.jobs.map((j) => j.id).sort(), [v, v3].sort());
  assert.ok(r.body.jobs.every((j) => j.mine === false && j.cost === undefined && j.error === undefined));
  assert.deepEqual([r.body.models, r.body.raw, r.body.mine], [[], undefined, undefined]);
  r = await get(`inf=${face.id}`);
  assert.deepEqual([r.status, r.headers.get('cache-control'), r.body.influencer.face, r.body.influencer.public], [200, 'private, max-age=10', true, false]);
  assert.deepEqual((await get(`inf=${quiet.id}`)).body.influencer.public, false);
  for (const gone of [hid.id, down.id, notYet.id, idOf('nobody')]) assert.deepEqual([(await get(`inf=${gone}`)).status], [404], gone);
  assert.deepEqual([(await get('inf=nope')).status, (await get('inf=nope')).body], [400, { error: 'bad_request' }]);
  // its own wallet's look: its choices, its looks, the tickets for posters of its done videos without one
  r = await act('inf-look', { id: a.id });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.influencer.mine, r.body.influencer.looks, r.body.influencer.settings], [true, { job: a.looks, files: 4 }, { look: 'feminine', age: '20s' }]);
  assert.deepEqual(Object.keys(r.body.posters), [v3]);
  r = await act('inf-look', { id: a.id }, { wallet: OTHER });
  assert.deepEqual([r.status, r.body.influencer.mine, r.body.posters], [200, undefined, undefined]);
  assert.deepEqual((await act('inf-look', { id: notYet.id })).body.influencer.status, 'pick');
  assert.equal((await act('inf-look', { id: notYet.id }, { wallet: OTHER })).status, 404);
  // its pictures: our own address, never cached for one made from a face
  const jpg = fake.storage.get(picPath(a.id, a.looks, 1)).bytes;
  r = await get(`inf-file=${a.id}/${a.looks}-1.jpg`);
  assert.deepEqual([r.status, r.headers.get('content-type'), r.headers.get('cache-control')], [200, 'image/jpeg', 'public, max-age=3600, s-maxage=600']);
  assert.deepEqual([r.headers.get('content-security-policy'), r.headers.get('x-content-type-options')], ["default-src 'none'; sandbox", 'nosniff']);
  assert.ok(r.body.equals(jpg));
  r = await get(`inf-file=${a.id}/${a.body}-0.webp`);
  assert.deepEqual([r.status, r.headers.get('content-type')], [200, 'image/webp']);
  assert.equal((await get(`inf-file=${face.id}/${face.looks}-1.jpg`)).headers.get('cache-control'), 'private, max-age=600');
  r = await get(`inf-file=${a.id}/${v}.poster.webp`);
  assert.deepEqual([r.status, r.headers.get('content-type')], [200, 'image/webp']);
  assert.equal((await get(`inf-file=trends/${move}.poster.webp`)).status, 200);
  for (const [q, status] of [
    [`${a.id}/${a.body}-1.jpg`, 404],                      // its full body is one picture
    [`${a.id}/${a.looks}-2.webp`, 404],                    // (not kept)
    [`${face.id}/${a.looks}-1.jpg`, 404],                  // another influencer's
    [`${hid.id}/${hid.looks}-1.jpg`, 404], [`${down.id}/${down.looks}-1.jpg`, 404],
    [`${a.id}/${v3}.poster.webp`, 404],                    // no poster yet
    [`${a.id}/${move}.poster.webp`, 404], [`trends/${v}.poster.webp`, 404],
    [`${a.id}/${hiddenVid}.poster.webp`, 404],
    ['../etc/passwd', 400], [`${a.id}/${a.looks}-4.jpg`, 400], [`${a.id}/${a.looks}-1.png`, 400],
  ]) assert.equal((await get(`inf-file=${encodeURIComponent(q)}`)).status, status, q);
  fake.storageDown = true;
  assert.deepEqual([(await get(`inf-file=${a.id}/${a.looks}-1.jpg`)).status], [502]);
  fake.storageDown = false;
  // its videos: played in parts (as its player asks), whole when small, downloaded by a short-lived signed address
  const mp = fake.storage.get(`inf/${a.id}/${v}.mp4`).bytes;
  r = await get(`inf-video=${v}.mp4`, { range: 'bytes=0-99' });
  assert.deepEqual([r.status, r.headers.get('content-range'), r.headers.get('content-length'), r.headers.get('accept-ranges'), r.headers.get('content-type')],
    [206, `bytes 0-99/${mp.length}`, '100', 'bytes', 'video/mp4']);
  assert.equal(r.headers.get('cache-control'), 'private, max-age=86400');
  assert.ok(r.body.equals(mp.subarray(0, 100)));
  assert.equal(calls.filter((c) => c.to === 'read').at(-1).range, 'bytes=0-99');
  r = await get(`inf-video=${v}.mp4`, { range: 'bytes=-50' });
  assert.ok(r.body.equals(mp.subarray(mp.length - 50)));
  r = await get(`inf-video=${v}.mp4`, { range: `bytes=${mp.length + 5}-` });
  assert.deepEqual([r.status, r.headers.get('content-range')], [416, `bytes */${mp.length}`]);
  r = await get(`inf-video=${v}.mp4`);
  assert.deepEqual([r.status, r.headers.get('cache-control'), r.body.equals(mp)], [200, 'public, max-age=3600, s-maxage=600', true]);
  assert.equal((await get(`inf-video=${faceVid}.mp4`)).headers.get('cache-control'), 'private, max-age=600');
  r = await get(`inf-video-dl=${v}.mp4`);
  assert.deepEqual([r.status, r.headers.get('referrer-policy'), r.headers.get('cache-control')], [302, 'no-referrer', 'public, max-age=300, s-maxage=1800']);
  assert.ok(r.headers.get('location').startsWith(`${SB}/storage/v1/object/sign/agi1-characters/inf/${a.id}/${v}.mp4?token=`));
  assert.ok(r.headers.get('location').endsWith('&download=Nova-video.mp4'));
  assert.equal(calls.filter((c) => c.to === 'sign').at(-1).body.expiresIn, 7200);
  assert.equal((await get(`inf-video-dl=${faceVid}.mp4`)).headers.get('cache-control'), 'private, max-age=300');
  assert.ok((await get(`inf-video-dl=${move}.mp4`)).headers.get('location').endsWith('&download=AGI-Studio-hip-sway-trend.mp4'));
  const big = await doneJob(a.id, 'video', { video: mp4({ size: 5_000_000 }) });
  r = await get(`inf-video=${big}.mp4`);
  assert.equal(r.status, 302, 'too big to send whole: its signed address');
  assert.ok(!r.headers.get('location').includes('&download='));
  for (const [q, status] of [[`${hiddenVid}.mp4`, 404], [`${a.body}.mp4`, 404], [`${idOf('nothing')}.mp4`, 404], ['x.mp4', 400], [`${v}.mov`, 400]]) {
    assert.equal((await get(`inf-video=${q}`)).status, status, q);
  }
  // nothing but these GETs, and never two keys at once
  assert.deepEqual([(await get(`inf=${a.id}&inf-explore`)).status, (await get('inf-nope=1')).status], [400, 400]);
});

test('shown in Explore or not, and deleting it ("Delete my face"): off every page at once, what was being made stopped (its credits back), its files deleted', async () => {
  giveCredits(2000);
  process.env.MESHY_API_KEY = `msy_${'a1'.repeat(20)}`;
  const a = await readyInf({ name: 'Nova' });
  infActBurst.reset();
  // out of Explore and back (still by its link)
  let r = await act('inf-public', { id: a.id, show: false });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  assert.deepEqual((await get('inf-explore')).body.influencers, []);
  assert.equal((await get(`inf=${a.id}`)).status, 200);
  await act('inf-public', { id: a.id, show: true });
  assert.deepEqual((await get('inf-explore')).body.influencers.map((i) => i.id), [a.id]);
  assert.deepEqual([(await act('inf-public', { id: a.id, show: false }, { wallet: OTHER })).status], [403]);
  assert.deepEqual([(await act('inf-public', { id: idOf('nobody'), show: false })).status], [404]);
  // one made from a face: never in Explore
  const face = await readyInf({ name: 'Mia', mode: 'face', style: 'real' });
  const selfie = await okUpload('face');
  fake.db.uploads.get(selfie).status = 'used';
  fake.db.infs.get(face.id).source = selfie;
  r = await act('inf-public', { id: face.id, show: true });
  assert.deepEqual([r.status, r.body.error], [409, 'face']);
  // what it has: a photo being made, a 3D model being made, a done 3D model, a done video
  const photo = (await act('inf-make', { id: face.id, kind: 'photo', scene: 'on a city rooftop at dusk', shape: 'tall' })).body.job;
  const model = (await act('inf-3d', { id: face.id })).body.order;
  assert.deepEqual(credits().paid, 2000 - 15 - 500);
  const madeModel = idOf('mdl3done');
  fake.db.orders.set(madeModel, { id: madeModel, inf_id: face.id, wallet_code: codeOf(), status: 'done', hidden: false, created: Date.now() - 9e5, done: Date.now() - 6e5 });
  for (const ext of ['glb', 'webp', 'png']) fake.storage.set(`${madeModel}.${ext}`, { bytes: Buffer.from(ext), type: 'application/octet-stream' });
  const video = await doneJob(face.id, 'video', { poster: true });
  // only its own wallet deletes it
  r = await act('inf-delete', { id: face.id }, { wallet: OTHER });
  assert.deepEqual([r.status, r.body.error], [403, 'not_yours']);
  r = await act('inf-delete', { id: face.id });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  // gone at once, from every page and every address
  assert.equal(fake.db.infs.get(face.id).status, 'deleted');
  assert.equal((await get(`inf=${face.id}`)).status, 404);
  assert.equal((await act('inf-look', { id: face.id })).status, 404);
  assert.equal((await get(`inf-file=${face.id}/${face.looks}-1.jpg`)).status, 404);
  assert.equal((await get(`inf-video=${video}.mp4`)).status, 404);
  assert.equal((await get(`inf-file=${face.id}/${video}.poster.webp`)).status, 404);
  assert.ok(!(await act('inf-me')).body.influencers.some((x) => x.id === face.id));
  // what was being made stopped, its credits back; its 3D models taken down
  assert.deepEqual([fake.db.jobs.get(photo).status, fake.db.jobs.get(photo).error], ['failed', 'deleted']);
  assert.deepEqual([fake.db.orders.get(model).status, fake.db.orders.get(model).hidden, fake.db.orders.get(madeModel).hidden], ['failed', true, true]);
  assert.equal(credits().paid, 2000);
  const fail = calls.find((c) => c.fn === 'studio_fail').args;
  assert.deepEqual([fail.p_id, fail.p_error, fail.p_credit], [model, 'deleted', false]);
  // its files deleted: its pictures, videos and posters, its 3D models', and the selfie it was made from
  assert.deepEqual(stored(`inf/${face.id}/`), []);
  assert.deepEqual([...fake.storage.keys()].filter((k) => k.startsWith(madeModel) || k.startsWith(`up/${selfie}`)), []);
  assert.deepEqual([fake.db.uploads.get(selfie).status, fake.db.uploads.get(selfie).why], ['refused', 'deleted']);
  r = await infClock(cfgNow(), { now: Date.UTC(2026, 9, 10, 12, 30) });
  assert.equal(fake.db.uploads.has(selfie), false, "its upload's row goes with the next tidy-up");
  // once deleted: gone
  r = await act('inf-delete', { id: face.id });
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  // Storage away while deleting: it's deleted all the same, its files go with the tidy-up
  fake.storageDown = true;
  r = await act('inf-delete', { id: a.id });
  assert.deepEqual([r.status, fake.db.infs.get(a.id).status], [200, 'deleted']);
  assert.ok(logs.some((l) => l.startsWith("[studio] a deleted influencer's files (they go with the tidy-up)")));
  fake.storageDown = false;
  assert.deepEqual([(await act('inf-delete', { id: 'nope' })).status], [400]);
});

// ---------- reports and the owner's tools ----------
test("reports (anyone: the human check, never an address or an IP, 10 a day) and the owner's page: reports, taking down, its trend moves", async () => {
  const a = await readyInf({ name: 'Nova' });
  const v = await doneJob(a.id, 'video');
  const report = (extra = {}) => post({ action: 'inf-report', id: a.id, why: 'copyright', turnstileToken: 'tok', ...extra });
  let r = await report({ why: 'boring' });
  assert.deepEqual([r.status, r.body.error], [400, 'bad_request']);
  assert.equal((await report({ id: 'nope' })).status, 400);
  fake.human = false;
  r = await report();
  assert.deepEqual([r.status, r.body.error], [401, 'human_check']);
  fake.human = true;
  r = await report();
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  const pass = r.body.pass;
  assert.ok(pass);
  const sent = calls.find((c) => c.fn === 'inf_report').args;
  assert.deepEqual([sent.p_inf, sent.p_job, sent.p_why, sent.p_cap], [a.id, null, 'copyright', 10]);
  assert.ok(!JSON.stringify(sent).includes(IP) && /^[A-Za-z0-9_-]{16,64}$/.test(sent.p_who), 'a daily code of who reported');
  // with its pass (no second human check), one of its videos; the same report twice counts once
  const turnstile = calls.filter((c) => c.to === 'turnstile').length;
  r = await post({ action: 'inf-report', id: a.id, job: v, why: 'sexual', pass });
  assert.deepEqual([r.status, r.body.pass], [200, null]);
  await post({ action: 'inf-report', id: a.id, job: v, why: 'sexual', pass });
  assert.equal(calls.filter((c) => c.to === 'turnstile').length, turnstile);
  assert.equal(fake.db.reports.length, 2);
  // 10 a day from one visitor
  const whys = Object.keys(R.REPORT_WHYS).filter((w) => w !== 'copyright');
  for (const why of whys) await post({ action: 'inf-report', id: a.id, why, pass });
  infActBurst.reset();
  for (const why of whys.slice(0, 10 - 2 - whys.length)) await post({ action: 'inf-report', id: a.id, job: v, why, pass });
  assert.equal(fake.db.reports.length, 10);
  r = await post({ action: 'inf-report', id: a.id, job: v, why: 'other', pass });
  assert.deepEqual([r.status, r.body.error], [429, 'too_many']);
  r = await post({ action: 'inf-report', id: idOf('nobody'), why: 'other', pass });
  assert.deepEqual([r.status, r.body.error], [404, 'gone']);
  // the owner's page: only the owner's wallet (STUDIO_OWNER)
  r = await act('inf-owner');
  assert.deepEqual([r.status, r.body.error], [403, 'not_owner']);
  for (const action of ['trend-make', 'trend-set', 'inf-hide', 'inf-report-clear']) assert.equal((await act(action, { trend: 'hip-sway', inf: a.id })).status, 403, action);
  const boss = (action, extra = {}) => act(action, extra, { wallet: BOSS });
  r = await boss('inf-owner');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.trends.map((t) => t.id), R.TRENDS.map((t) => t.id));
  assert.ok(r.body.trends.every((t) => t.status === 'none' && t.job === null));
  assert.deepEqual(r.body.reports.map((g) => [g.inf, g.job, g.count, g.whys.length, g.name, g.mode, g.hidden]).sort(),
    [[a.id, null, whys.length + 1, whys.length + 1, 'Nova', 'design', false], [a.id, v, 3, 3, 'Nova', 'design', false]].sort());
  // taking down a video, then the influencer, then back
  r = await boss('inf-hide', { job: v });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  assert.deepEqual((await get(`inf=${a.id}`)).body.jobs, []);
  assert.equal((await get(`inf-video=${v}.mp4`)).status, 404);
  assert.ok((await boss('inf-owner')).body.reports.find((g) => g.job === v).hidden);
  r = await boss('inf-hide', { inf: a.id });
  assert.deepEqual([r.status, (await get(`inf=${a.id}`)).status, (await get('inf-explore')).body.influencers.length], [200, 404, 0]);
  await boss('inf-hide', { inf: a.id, hidden: false });
  assert.equal((await get(`inf=${a.id}`)).status, 200);
  assert.deepEqual([(await boss('inf-hide', {})).status, (await boss('inf-hide', { inf: idOf('nobody') })).status], [400, 404]);
  // reports dealt with: cleared
  r = await boss('inf-report-clear', { inf: a.id, job: v });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  assert.deepEqual((await boss('inf-owner')).body.reports.map((g) => g.job), [null]);
  assert.equal((await boss('inf-report-clear', { inf: 'nope' })).status, 400);
  // a trend move: made by the AI service (the owner's fal balance, no credits), looked at, kept for everyone's trend videos
  assert.deepEqual([(await boss('trend-make', { trend: 'moonwalk' })).status], [422]);
  r = await boss('trend-make', { trend: 'robot-moves' });
  assert.equal(r.status, 200);
  const job = r.body.job;
  assert.match(job, ID);
  r = await boss('trend-make', { trend: 'robot-moves' });
  assert.deepEqual([r.status, r.body.error], [409, 'making']);
  r = await boss('inf-owner');                                                  // (its look moves it along)
  let sentTrend = falCalls().at(-1);
  assert.deepEqual([sentTrend.path, sentTrend.body.duration, sentTrend.body.aspect_ratio, sentTrend.body.generate_audio], [MODELS.t2v, '10', '9:16', false]);
  assert.match(sentTrend.body.prompt, /robot dance/);
  for (const fr of fake.fal.requests.values()) fr.status = 'COMPLETED';
  free(job);
  r = await boss('inf-owner');
  const robot = r.body.trends.find((t) => t.id === 'robot-moves');
  assert.deepEqual([robot.status, robot.job, robot.jobStatus, robot.poster], ['review', job, 'done', false]);
  assert.ok(fake.storage.has(`trends/${job}.mp4`));
  assert.ok(!geminiCalls().some((c) => c.which === 'video'), "the owner's own trend moves aren't looked at by the video check (the owner looks)");
  assert.deepEqual(Object.keys(r.body.posters), [job]);
  const pt = readTicket(SECRET, 'poster', r.body.posters[job]);
  assert.deepEqual([pt.j, pt.o, pt.l], [job, 'trends', undefined], "a trend move's poster: no look to compare it with");
  assert.deepEqual((await get('inf-explore')).body.trends, [], 'not for everyone until the owner keeps it');
  r = await boss('trend-set', { trend: 'robot-moves', status: 'kept' });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  assert.deepEqual((await get('inf-explore')).body.trends.map((t) => t.id), ['robot-moves']);
  assert.deepEqual([(await boss('trend-set', { trend: 'wave-hi', status: 'kept' })).status, (await boss('trend-set', { trend: 'robot-moves', status: 'gone' })).status], [409, 409]);
  await boss('trend-set', { trend: 'robot-moves', status: 'hidden' });
  assert.deepEqual((await get('inf-explore')).body.trends, []);
  // a trend move that couldn't be made: said on the owner's page, made again
  r = await boss('trend-make', { trend: 'wave-hi' });
  const job2 = r.body.job;
  fake.fal.submitFail.push({ status: 422, text: JSON.stringify({ detail: [{ msg: 'flagged', type: 'content_policy_violation' }] }) });
  await boss('inf-owner');
  const wave = (await boss('inf-owner')).body.trends.find((t) => t.id === 'wave-hi');
  assert.deepEqual([wave.status, wave.job, wave.error], ['failed', job2, 'refused']);
  assert.equal((await boss('trend-make', { trend: 'wave-hi' })).status, 200);
});

// ---------- a 3D model of it ----------
test('its 3D model: from its full body, in credits (a Soulmate\'s first each month free), one at a time, the month\'s number; on its page', async () => {
  giveCredits(2000);
  const { id, body } = await readyInf({ name: 'Nova' });
  infActBurst.reset();
  let r = await act('inf-3d', { id });
  assert.deepEqual([r.status, r.body.error], [409, 'no_3d'], "Meshy's key isn't set: no 3D models");
  process.env.MESHY_API_KEY = `msy_${'a1'.repeat(20)}`;
  r = await act('inf-3d', { id });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.free, r.body.credits], [false, { paid: 1500, free: 0 }]);
  const first = fake.db.orders.get(r.body.order);
  assert.deepEqual([first.inf_id, first.image_path, first.wallet_code, first.burn_code], [id, picPath(id, body, 0), codeOf(), burnWallet(BURN_KEY, WALLET)]);
  const sent = calls.find((c) => c.fn === 'inf_3d').args;
  assert.deepEqual([sent.p_cost, sent.p_cap, sent.p_free, sent.p_level], [500, 15, false, 1]);
  r = await act('inf-3d', { id });
  assert.deepEqual([r.status, r.body.error], [409, 'busy3d'], 'one at a time');
  // a Soulmate: its first of the month free, then 300 credits (40% off)
  first.status = 'done';
  r = await act('inf-3d', { id }, { level: 3 });
  assert.deepEqual([r.status, r.body.free, r.body.credits.paid], [200, true, 1500]);
  fake.db.orders.get(r.body.order).status = 'failed';
  fake.db.orders.get(r.body.order).error = 'ai:image';
  r = await act('inf-3d', { id }, { level: 3 });
  assert.deepEqual([r.body.free, r.body.credits.paid], [false, 1200]);
  fake.db.orders.get(r.body.order).status = 'done';
  // the month's number (STUDIO_A_MONTH: Meshy's credits), not enough credits, not its own, not ready, gone
  process.env.STUDIO_A_MONTH = '3';
  r = await act('inf-3d', { id });
  assert.deepEqual([r.status, r.body.error], [409, 'sold_out']);
  delete process.env.STUDIO_A_MONTH;
  fake.db.cred(codeOf()).paid = 20;
  r = await act('inf-3d', { id });
  assert.deepEqual([r.status, r.body.error, r.body.have], [402, 'short', 20]);
  assert.equal((await act('inf-3d', { id }, { wallet: OTHER })).status, 403);
  infActBurst.reset();
  fake.db.infs.get(id).status = 'pick';
  assert.deepEqual([(await act('inf-3d', { id })).body.error], ['not_ready']);
  fake.db.infs.get(id).status = 'ready';
  fake.db.infs.get(id).hidden = true;
  assert.deepEqual([(await act('inf-3d', { id })).status], [404]);
  fake.db.infs.get(id).hidden = false;
  assert.equal((await act('inf-3d', { id: 'nope' })).status, 400);
  // its page: its done models for anyone; its own wallet's every one (and why one couldn't be made)
  r = await get(`inf=${id}`);
  assert.deepEqual(r.body.models.map((m) => [m.status, m.error]), [['done', null], ['done', null]]);
  r = await act('inf-look', { id });
  assert.deepEqual(r.body.models.map((m) => [m.status, m.error]).sort(), [['done', null], ['done', null], ['failed', 'ai:image']].sort());
  process.env.STUDIO_HIDE = first.id;
  assert.equal((await get(`inf=${id}`)).body.models.length, 1);
});

// ---------- a coin with its face ----------
test('a coin with its face: a launch draft with its look as its picture (no Telegram), her checks, the launch page reads it from our bucket', async () => {
  const { id, looks } = await readyInf({ name: 'Nova' });
  const coin = (extra = {}, who) => act('inf-coin', { id, name: 'Nova', symbol: 'NOVA', description: 'my AI influencer', ...extra }, who);
  let r = await coin();
  assert.deepEqual([r.status, r.body.error], [409, 'launch_off'], 'Launch with AGI-1 not set up');
  process.env.PINATA_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl';
  // private (LAUNCH_ONLY_FOR): only the owner and the studio's own list
  process.env.LAUNCH_ONLY_FOR = '@owner';
  r = await coin();
  assert.deepEqual([r.status, r.body.error], [403, 'launch_private']);
  process.env.STUDIO_ONLY_FOR = WALLET;
  assert.equal((await coin()).status, 200);
  delete process.env.STUDIO_ONLY_FOR; delete process.env.LAUNCH_ONLY_FOR;
  infActBurst.reset();
  // her checks of a coin
  for (const [extra, reason] of [[{ symbol: 'AGI' }, 'agi'], [{ description: 'buy now, 100x' }, 'money'], [{ name: 'Official Nova' }, 'official'], [{ symbol: 'NO VA' }, 'symbol']]) {
    r = await coin(extra);
    assert.deepEqual([r.status, r.body.error, r.body.reason], [422, 'coin', reason], JSON.stringify(extra));
  }
  assert.equal((await coin({}, { wallet: OTHER })).status, 403);
  // its draft: its look as its picture, the wallet's own launch code (never the address)
  r = await coin();
  assert.equal(r.status, 200);
  const { draft, link } = r.body;
  assert.match(draft, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(link.endsWith(`/launch/${draft}`));
  const d = fake.db.drafts.get(draft);
  assert.deepEqual([d.photo, d.chat, d.name, d.symbol, d.description], [`studio:${id}/${looks}-1`, launchWallet(SECRET, WALLET), 'Nova', 'NOVA', 'my AI influencer']);
  // the launch page: ready without her Telegram bot, its picture from our bucket
  delete process.env.TELEGRAM_BOT_TOKEN;
  r = await get(`d=${draft}`);
  assert.deepEqual([r.status, r.body.name, r.body.symbol, r.body.ready, r.body.token], [200, 'Nova', 'NOVA', true, null]);
  r = await get(`pic=${draft}`);
  assert.deepEqual([r.status, r.headers.get('content-type'), r.headers.get('cache-control')], [200, 'image/jpeg', 'private, max-age=3600']);
  assert.deepEqual([r.headers.get('content-security-policy'), r.headers.get('x-content-type-options')], ["default-src 'none'; sandbox", 'nosniff']);
  assert.ok(r.body.equals(fake.storage.get(picPath(id, looks, 1)).bytes));
  // a look over 1 MB (Launch with AGI-1's limit): made smaller
  const big = await sharp({ create: { width: 1600, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 50 } } }).jpeg({ quality: 92 }).toBuffer();
  assert.ok(big.length > 1_000_000);
  fake.storage.set(picPath(id, looks, 1), { bytes: big, type: 'image/jpeg' });
  r = await get(`pic=${draft}`);
  const meta = await sharp(r.body).metadata();
  assert.ok(r.body.length <= 1_000_000 && meta.format === 'jpeg' && Math.max(meta.width, meta.height) <= 1024);
  // its influencer taken down, hidden or deleted: no picture
  process.env.STUDIO_HIDE = id;
  assert.deepEqual([(await get(`pic=${draft}`)).status, (await get(`pic=${draft}`)).body.error], [404, 'no_picture']);
  delete process.env.STUDIO_HIDE;
  fake.db.infs.get(id).hidden = true;
  assert.equal((await get(`pic=${draft}`)).status, 404);
  fake.db.infs.get(id).hidden = false;
  // a draft from her bot is as it was: its picture needs her bot's token
  fake.db.launch_draft_put({ p_id: idOf('tgdraft'), p_chat: codeOf(OTHER), p_name: 'Cat', p_symbol: 'CAT', p_desc: '', p_photo: 'AgACAgQAAxkBAAIBe2Zfake_file_id' });
  assert.deepEqual([(await get(`d=${idOf('tgdraft')}`)).body.ready, (await get(`pic=${idOf('tgdraft')}`)).status], [false, 503]);
  // not ready, not its own, too many drafts today
  fake.db.infs.get(id).status = 'pick';
  assert.deepEqual([(await coin()).body.error], ['not_ready']);
  fake.db.infs.get(id).status = 'ready';
  const put = fake.db.launch_draft_put;
  fake.db.launch_draft_put = () => ({ ok: false, why: 'chat_cap' });
  r = await coin();
  assert.deepEqual([r.status, r.body.error], [429, 'coin_cap']);
  fake.db.launch_draft_put = put;
  const args = calls.filter((c) => c.fn === 'launch_draft_put').at(-1).args;
  assert.deepEqual([args.p_minutes > 0, args.p_per_chat > 0, args.p_site_daily > 0], [true, true, true]);
});

// ---------- inf-info, and every request that isn't one ----------
test("inf-info (the same for everyone), and the POSTs that aren't one: off until set up, signed out, not JSON, too long, the old studio's orders", async () => {
  let r = await get('inf-info');
  assert.deepEqual([r.status, r.headers.get('cache-control')], [200, 'public, max-age=15, s-maxage=30']);
  assert.deepEqual(r.body, {
    on: true, faces: true, open: true, prices: R.PRICES, discounts: { 1: 0, 2: 0.2, 3: 0.4 }, freeCredits: R.FREE_CREDITS, topups: R.TOPUPS,
    topupMin: R.TOPUP_MIN, usdg: true, payTo: OWNER, token: USDG, threeD: false, coins: false, launch: false,
  });
  process.env.MESHY_API_KEY = `msy_${'a1'.repeat(20)}`;
  process.env.PINATA_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl';
  process.env.STUDIO_FACES = 'off';
  r = await get('inf-info');
  assert.deepEqual([r.body.threeD, r.body.coins, r.body.launch, r.body.faces], [true, true, true, false]);
  process.env.LAUNCH_ONLY_FOR = '@owner';
  assert.equal((await get('inf-info')).body.launch, false, 'private: the coin button says so');
  delete process.env.STUDIO_OPEN;
  delete process.env.FAL_KEY;
  r = await get('inf-info');
  assert.deepEqual([r.body.on, r.body.open], [false, false]);
  // off until fal's key (and Gemini's: its checks) is set: every action says so, the log names the setting
  r = await act('inf-me');
  assert.deepEqual([r.status, r.body.error], [503, 'not_ready']);
  assert.ok(logs.some((l) => l === '[studio] FAL_KEY is missing: the studio app is off'));
  process.env.FAL_KEY = FAL_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await act('inf-me')).status, 503);
  process.env.GEMINI_API_KEY = GEMINI_KEY;
  delete process.env.SUPABASE_URL;
  assert.deepEqual([(await get('inf-explore')).status, (await act('inf-me')).status], [503, 503]);
  process.env.SUPABASE_URL = SB;
  // signed out: no session, an odd one, one that ended
  for (const session of [undefined, 'nope', makeSession(SECRET, { wallet: WALLET, level: 1, checkedAt: Date.now() - 9 * DAY, expiresAt: Date.now() - DAY })]) {
    r = await post({ action: 'inf-me', session });
    assert.deepEqual([r.status, r.body], [401, { error: 'signed_out', signedOut: true }]);
  }
  // not a request of ours
  const raw = (body, type = 'application/json') => launchPost(new Request('https://studio.agi1.app/api/launch', { method: 'POST', headers: { 'content-type': type, 'x-real-ip': IP }, body }));
  assert.equal((await raw('{"action":"inf-me"}', 'text/plain')).status, 415);
  assert.equal((await raw(JSON.stringify({ action: 'inf-start', words: 'x'.repeat(5000) }))).status, 413);
  assert.equal((await raw('{"action":"inf-me"')).status, 400);
  for (const action of ['inf-everything', 'trend-delete', 'inf-', 'INF-me']) assert.equal((await post({ action, session: sessionFor() })).status, 400, action);
  r = await act('inf-make', { id: 'nope', kind: 'photo' });
  assert.deepEqual([r.status, r.body.error, r.body.level], [400, 'bad_request', 1]);
  // the old studio's ordering (a character or a video paid one by one): moved to credits here
  for (const action of ['studio-quote', 'studio-video-quote']) {
    r = await post({ action, session: sessionFor() });
    assert.deepEqual([r.status, r.body], [410, { error: 'moved' }], action);
  }
  // an upload's bytes only as application/octet-stream, with its ticket
  r = await launchPost(new Request('https://studio.agi1.app/api/launch?inf-up=x&part=0', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP }, body: '{}' }));
  assert.equal(r.status, 400);
  r = await postBytes('inf-up=nope&part=0', Buffer.from('bytes'));
  assert.deepEqual([r.status, r.body], [401, { error: 'ticket' }]);
  r = await postBytes('inf-poster=nope', Buffer.from('bytes'));
  assert.deepEqual([r.status, r.body], [401, { error: 'ticket' }]);
  assert.equal((await postBytes('inf-up=nope&part=0', Buffer.alloc(0))).status, 400);
  assert.equal((await postBytes('inf-up=nope&part=0', Buffer.alloc(4_300_000))).status, 413);
});

// ---------- the browser's sending code (src/studio/media.js) against our real server ----------
test('the page\'s sending code against our server: a picture, a selfie, a clip in parts with its frames (and its progress), a poster', async () => {
  globalThis.fetch = browserFetch();
  const appSend = appAct();
  const jpg = await sharp(PNG).jpeg().toBuffer();
  // a picture of a character: its ticket (the human check), then its bytes, looked at, kept
  let r = await M.uploadPicture(appSend, { kind: 'picture', blob: new Blob([jpg], { type: 'image/jpeg' }), human: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.id, ID);
  assert.deepEqual([fake.db.uploads.get(r.id).status, fake.db.uploads.get(r.id).kind], ['ok', 'picture']);
  assert.ok(fake.storage.has(`up/${r.id}.jpg`));
  // a selfie: only with its consent
  r = await M.uploadPicture(appSend, { kind: 'face', blob: new Blob([jpg]), human: true });
  assert.deepEqual(r, { ok: false, error: 'consent', why: undefined });
  r = await M.uploadPicture(appSend, { kind: 'face', blob: new Blob([jpg]), consent: true, human: true });
  assert.equal(r.ok, true);
  assert.equal(fake.db.uploads.get(r.id).kind, 'face');
  // one the AI check says no to: said, with why
  fake.gemini.art = { known: true };
  r = await M.uploadPicture(appSend, { kind: 'picture', blob: new Blob([jpg]), human: true });
  assert.deepEqual([r.ok, r.error, r.why], [false, 'refused', 'copyright']);
  fake.gemini.art = null;
  // a clip of 7.5 MB: 3 parts of 3.5 MB at most, then its 3 frames, then put together and looked at
  const clip = mp4({ seconds: 6, size: 7_500_000 });
  const frames = await Promise.all([1, 2, 3].map(async (n) => new Blob([await sharp({ create: { width: 320, height: 568, channels: 3, background: { r: 40 * n, g: 90, b: 160 } } }).jpeg().toBuffer()], { type: 'image/jpeg' })));
  const progress = [];
  r = await M.uploadClip(appSend, { file: new Blob([clip], { type: 'video/mp4' }), frames, human: true, onProgress: (sent, of) => progress.push(`${sent}/${of}`) });
  assert.deepEqual([r.ok, r.seconds], [true, 6], JSON.stringify(r));
  assert.deepEqual(progress, ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']);
  const parts = calls.filter((c) => c.to === 'put' && c.name.startsWith(`up/${r.id}/`)).map((c) => c.name.slice(`up/${r.id}/`.length));
  assert.deepEqual(parts, ['0.part', '1.part', '2.part', 'f0.jpg', 'f1.jpg', 'f2.jpg']);
  assert.ok(fake.storage.get(`up/${r.id}.mp4`).bytes.equals(clip));
  assert.deepEqual(stored(`up/${r.id}/`), [], 'its parts and frames deleted once it was put together');
  assert.equal(geminiCalls().at(-1).which, 'frames');
  // a poster: a frame its page took of one of its own done videos, with its ticket
  const { id, looks } = await readyInf();
  const video = await doneJob(id, 'video');
  const ticket = makeTicket(SECRET, 'poster', { j: video, o: id, l: picPath(id, looks, 1) }, Date.now(), 3600e3);
  assert.equal(await M.sendPoster(ticket, new Blob([jpg], { type: 'image/jpeg' })), true);
  assert.equal(fake.db.jobs.get(video).poster, true);
  assert.ok(fake.storage.has(`inf/${id}/${video}.poster.webp`));
  assert.equal(await M.sendPoster('nope', new Blob([jpg])), false);
  // the camera's and a clip's words for the page
  assert.match(M.cameraText('camera_denied'), /allow it/);
  assert.match(M.clipText('clip_length'), /2 to 10 seconds/);
});

// ---------- the page ----------
// a stylesheet's selectors (inside @media and @supports too; never @font-face's or @keyframes')
function cssSelectors(css) {
  const out = [];
  const walk = (s) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const head = s.slice(i, open).replace(/@(?:charset|import)[^;]*;/g, '').trim();
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      if (/^@(?:media|supports|container|layer)\b/.test(head)) walk(s.slice(open + 1, j - 1));
      else if (!/^@(?:font-face|keyframes|-webkit-keyframes|property)\b/.test(head)) {
        let d = 0, cur = '';
        for (const ch of head) {
          if (ch === '(') d++;
          if (ch === ')') d--;
          if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
        }
        out.push(cur.trim());
      }
      i = j;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  return out.filter(Boolean);
}

test("the page: studio.html, the app's code (never HTML from strings, never a wallet transaction), its styles all scoped, its addresses", () => {
  const html = read('studio.html');
  assert.equal((html.match(/<script\b/g) || []).length, 1, 'one script');
  assert.match(html, /<script type="module" src="\/src\/studio\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /<style\b|\sstyle="|\son[a-z]+="/i, 'no inline styles or handlers (the CSP)');
  assert.doesNotMatch(html, /\/theme\.js/, 'its own dark look');
  assert.match(html, /<html lang="en" data-theme="dark" data-page="studio">/);
  assert.match(html, /<body class="sa">/);
  assert.match(html, /<link rel="canonical" href="__SITE__\/studio" \/>/);
  assert.match(html, /<a class="sa-skip" href="#sa-main">/);
  assert.match(html, /<main id="sa-main"/);
  for (const promise of ['18+, PG-13, AI-generated', 'Delete my face', 'this page never asks your wallet to send anything', 'no cash value', 'Not financial advice',
    'A thank-you for holding, not an investment', 'Meme coins can lose all of their value', 'never its address']) assert.ok(html.includes(promise), promise);
  for (const a of html.match(/<a [^>]*target="_blank"[^>]*>/g) || []) assert.match(a, /rel="noopener noreferrer"/, a);
  assert.match(read('index.html'), /id="safety"/, 'its footer links to the safety note');
  // the app's code: what it shows is set as text; a wallet is only asked for its address and the sign-in signature
  const files = ['src/studio/app.js', 'src/studio/ui.js', 'src/studio/media.js', 'src/studio/app-words.js', 'src/studio/rules.js',
    ...readdirSync(new URL('../src/studio/views/', import.meta.url)).map((f) => `src/studio/views/${f}`)];
  for (const f of files) {
    const code = strip(read(f));
    assert.doesNotMatch(code, /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\b/, f);
    assert.doesNotMatch(code, /eth_sendTransaction|eth_signTypedData|wallet_switchEthereumChain|wallet_addEthereumChain|wallet_watchAsset|eth_sign\b|personal_sign|\.request\(\s*\{/, f);
    assert.doesNotMatch(code, /ethereum:|metamask\.app\.link\/send/, `${f}: no payment links`);
    for (const m of code.matchAll(/fetch\(\s*([^,)]+)/g)) assert.match(m[1], /^`?\$\{API\}|^url$|^src$/, `${f}: ${m[1]} (only our own address)`);
  }
  assert.match(read('src/studio/app.js'), /from '\.\.\/lib\/wallet\.js'/, "the site's own sign-in");
  // its styles: every rule names an sa- class (so nothing else on the site changes), nothing from other sites
  const css = read('src/styles/studio-app.css');
  const selectors = cssSelectors(css);
  assert.ok(selectors.length > 300, String(selectors.length));
  for (const sel of selectors) assert.match(sel, /\.sa(?![\w-])|\.sa-[\w-]/, sel);
  assert.doesNotMatch(css, /https?:\/\/|@import/);
  assert.match(css, /prefers-reduced-motion/);
  // its addresses: agi1.app/studio/<view> and every address on studio.agi1.app (files and functions first), / → Explore
  const v = JSON.parse(read('vercel.json'));
  assert.ok(v.cleanUrls);
  assert.ok(v.rewrites.some((x) => x.source === '/studio/:path+' && x.destination === '/studio'));
  assert.ok(v.rewrites.some((x) => x.source === '/:path*' && x.destination === '/studio' && x.has?.[0]?.type === 'host' && x.has[0].value === 'studio.agi1.app'));
  assert.ok(v.redirects.some((x) => x.source === '/' && x.destination === '/explore' && x.permanent === false && x.has?.[0]?.value === 'studio.agi1.app'));
  assert.ok(!v.rewrites.some((x) => /api/.test(x.source)), 'never over the functions');
  const vite = read('vite.config.js');
  assert.match(vite, /studio: 'studio\.html'/);
  assert.match(vite, /const STUDIO_HOST = \/\^studio\\\.\/i;/);
  // the tests run with the build, the 12 functions, and sharp for its pictures
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\/influencer\.test\.js/);
  assert.ok(pkg.dependencies.sharp);
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js')).length, 12);
});

// ---------- influencers.sql's promises ----------
// its functions and their parameters (name, type, whether it has a default)
function sqlFunctions(sql) {
  const fns = new Map();
  for (const m of sql.matchAll(/create or replace function public\.([a-z0-9_]+)\(([\s\S]*?)\)\s*returns/g)) {
    fns.set(m[1], m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
      const [name, ...rest] = p.split(/\s+/);
      return { name, type: rest.join(' ').replace(/\s+default\s+[\s\S]*$/i, '').trim(), def: /\sdefault\s/i.test(p) };
    }));
  }
  return fns;
}
// every rpc(cfg, '<function>', { p_…: … }) in a file: its function and the parameters it sends
function rpcCalls(code) {
  const out = [];
  for (const m of code.matchAll(/rpc\(cfg, '([a-z0-9_]+)', \{/g)) {
    let depth = 1, j = m.index + m[0].length;
    while (depth && j < code.length) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
    out.push({ fn: m[1], keys: [...code.slice(m.index + m[0].length, j - 1).matchAll(/\b(p_[a-z0-9_]+)\s*:/g)].map((k) => k[1]) });
  }
  return out;
}

test("influencers.sql's promises: every function our server calls is there with the parameters it sends, only the server's key, RLS on, never an address or an IP", async () => {
  const sql = read('supabase/influencers.sql');
  const fns = sqlFunctions(sql);
  assert.equal(fns.size, 39);
  const known = new Map([...fns, ...sqlFunctions(read('supabase/studio.sql'))]);
  const files = ['server/influencer.js', 'server/inf-api.js', 'server/inf-jobs.js', 'server/inf-uploads.js', 'server/credits.js'];
  const used = new Set();
  for (const f of files) {
    for (const { fn, keys } of rpcCalls(read(f))) {
      const params = known.get(fn);
      assert.ok(params, `${f}: ${fn} isn't in influencers.sql or studio.sql`);
      const names = params.map((p) => p.name);
      for (const k of keys) assert.ok(names.includes(k), `${f}: ${fn} gets ${k}, which it doesn't have`);
      for (const p of params) assert.ok(p.def || keys.includes(p.name), `${f}: ${fn} needs ${p.name}`);
      used.add(fn);
    }
  }
  // its own functions called only by its others: what credits are spent and given back with, and the day's count
  assert.deepEqual([...fns.keys()].filter((fn) => !used.has(fn)).sort(), ['inf_day_take', 'inf_refund', 'inf_spend']);
  // only the server's key: each one's revoke and grant, with its exact parameter types
  const loop = /foreach f in array array\[([\s\S]*?)\] loop\s+execute format\('revoke all on function public\.%s from public, anon, authenticated', f\);\s+execute format\('grant execute on function public\.%s to service_role', f\);/.exec(sql);
  assert.ok(loop, 'the grants');
  const granted = new Map([...loop[1].matchAll(/'([a-z0-9_]+)\(([^)]*)\)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual([...granted.keys()].sort(), [...fns.keys()].sort());
  for (const [fn, params] of fns) assert.equal(granted.get(fn), params.map((p) => p.type).join(', '), fn);
  // its tables: row level security on, nothing that names a wallet, a transaction or an IP address
  const tables = [...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map((m) => m[1]);
  assert.equal(tables.length, 9);
  for (const t of tables) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`), t);
  const code = sql.replace(/--.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:wallet|address|wallet_address|tx|tx_hash|transaction|ip|ip_address)\s+(?:text|inet|varchar|bytea)\b/i);
  assert.match(code, /wallet_code\s+text/);
  assert.doesNotMatch(code, /drop table|truncate|delete from public\.agi1_studio/i);
  assert.match(sql, /\/ 39\s/, 'influencers_ready counts its 39 functions');
  // the server's words when it isn't run yet: every one of its functions names the file
  const limits = read('server/limits.js');
  const listed = /AGI Studio, the AI influencer app[\s\S]*?for \(const fn of \[([\s\S]*?)\]\)/.exec(limits);
  assert.deepEqual([...listed[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort(), [...fns.keys()].sort());
  fake.missing.add('inf_get');
  await assert.rejects(I.infPage(cfgNow(), idOf('anything')), /run supabase\/studio\.sql again, then supabase\/influencers\.sql/);
});
