// /api/launch: "Launch with AGI-1" (2026-10-01, the owner's idea; server/launch.js). The launch page (agi1.app/launch/<id>,
// src/launch/) asks here; the person's own wallet does the launch, on clank.trade's own contracts. Nothing here signs or
// sends anything for them, or holds their keys: it reads (the database, Telegram's copy of the picture, Robinhood Chain)
// and builds clank.trade's launch call. The one thing our server ever sends is the owner's own gas wallet paying a
// launch's network fee back to its creator.
//   GET  ?d=<id>    → the draft: { name, symbol, description, expires (ms), expired, token (once launched), ready, gasBack
//                     (the most paid back, wei, or null), gas (its payback so far, or { paid: false, why: 'unpaid' }) }
//   GET  ?pic=<id>  → its picture (Telegram's copy, through our server, so the page's CSP stays as it is)
//   POST { action: 'prepare', draft, session, links?, pair? } → { to, data, value, chainId, token, curve, level, perDay }:
//        the launch for that wallet, tried on the chain first. Needs 10,000+ $AGI held or burned in it (read fresh), and
//        one of its coins for today (perDay: 5 for every 10,000, 50 at most, since 2026-10-02; else 429 { error:
//        'wallet_cap', perDay, changed? }), and clank.trade open to launches (free); puts the picture on IPFS the first time.
//        links (optional, 2026-10-01): { twitter, telegram, website } as typed: checked and tidied (server/launch.js
//        checkLinks), else 422 { error: 'links', field, why }. pair (2026-10-02): 'eth' (the default) or 'spcx'.
//   POST { action: 'check', draft, session, tx } → { ok: true, token, curve, gas } | { pending: true } | { ok: false, why }:
//        their launch, read back from the chain: this draft's own call (its salt, its details), sent by their wallet to
//        clank.trade's factory, and the coin as the factory records it. gas: its network fee paid back by the owner's gas
//        wallet (server/launch.js payGasBack: { paid: true, wei, tx } or { paid: false, why }) when LAUNCH_GAS_KEY is set
//   POST { action: 'payback', draft } → { gas }: a launched draft's payback, again (from its own launch transaction, kept
//        on our side: whoever opens the page, the fee only ever goes back to the coin's creator)
// Everything is "no-store": a draft is private to whoever has its link.
// (2026-10-10) AGI-1's 3D character studio lives here too (Vercel's Hobby plan allows 12 functions, all used; a character
// can be a coin's face): GET ?studio=, ?studio-file=, ?studio-list, ?studio-info, and its characters' videos ?studio-videos=,
// ?studio-video=, ?studio-video-dl=, and POST actions "studio-…", handled by server/studio-api.js (loaded only for them).
// Since AGI Studio (the same day) its page is the app's: a character from words, paid for on its own (studio-quote) and its
// videos paid one by one (studio-video-quote), aren't ordered any more (410 { error: 'moved' }): AGI Studio makes 3D models
// from influencers, paid in credits. A character's page, its files and its videos still answer, and so does finishing an
// order made before (choosing how to pay, "Check my payment", making one again).
// (2026-10-10) And AGI Studio, the AI influencer app (studio.agi1.app): GET ?inf-info, ?inf-explore, ?inf=, ?inf-file=,
// ?inf-video=, ?inf-video-dl=, POST actions "inf-…" and "trend-…", and its uploads (POST ?inf-up=… / ?inf-poster=…, the
// file's bytes as the body), handled by server/inf-api.js (loaded only for them). An influencer's coin is a launch draft like
// one from her bot, its picture the influencer's own look from our bucket ("studio:<influencer>/<job>-<n>"), no Telegram.
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode } from '../server/security.js';
import { readSession } from '../server/session.js';
import { checkHolding, CHAIN_ID } from '../server/chain.js';
import { burnedAgi } from '../server/burn.js';
import { tgToken } from '../server/telegram.js';
import {
  DRAFT_ID, drafts, launchWallet, launchReady, telegramPicture, pinPicture, launchTerms, launchCall, launchesADay, pairOf,
  tryLaunch, readLaunch, gasOn, payGasBack, paybackFor, gasSoFar, gasFinal, checkLinks,
} from '../server/launch.js';
import { launchBurst, launchPictureBurst } from '../server/burst.js';

const MAX_BODY = 4000;
const STUDIO_GETS = ['studio', 'studio-file', 'studio-list', 'studio-info', 'studio-videos', 'studio-video', 'studio-video-dl'];
const STUDIO_POSTS = ['studio-quote', 'studio-choose', 'studio-check', 'studio-redo', 'studio-mine', 'studio-video-mine', 'studio-video-quote',
  'studio-video-check', 'studio-video-redo', 'studio-video-look'];
const STUDIO_MOVED = ['studio-quote', 'studio-video-quote'];            // new orders: AGI Studio's credits instead
const INF_GETS = ['inf-info', 'inf-explore', 'inf', 'inf-file', 'inf-video', 'inf-video-dl'];
const isInfAction = (a) => typeof a === 'string' && /^(?:inf|trend)-[a-z0-9-]{2,20}$/.test(a);
// a draft made in AGI Studio: its picture is an influencer's look in our bucket (server/influencer.js studioPicture)
const STUDIO_PHOTO = /^studio:[A-Za-z0-9_-]{22}\/[A-Za-z0-9_-]{22}-[0-3]$/;
const fromStudio = (d) => STUDIO_PHOTO.test(String(d?.photo || ''));
async function draftPicture(cfg, d) {
  if (fromStudio(d)) return (await import('../server/influencer.js')).studioPicture(cfg, d.photo);
  return telegramPicture(tgToken(), d.photo);
}
const BUDGET_MS = 20_000;                  // a request's payback must be done by then (Vercel stops a function at 25 s)
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };

// The database's "that function isn't there" (launch.sql not run yet) or another hiccup → the answer for the page
function dbTrouble(err, what) {
  if (err?.code === 'PGRST202') return json(503, { error: 'not_ready' });
  console.error(`[launch] ${what}:`, err?.message);
  return json(503, { error: 'busy' });
}
// its payback so far, for the page: settled, being sent, or not yet ("unpaid": the page asks for it)
const gasForPage = (cfg, d) => (!gasOn(cfg) || !d.token ? null : gasSoFar(d) ?? { paid: false, why: 'unpaid' });
// a gas wallet setting that isn't a private key: paybacks are off, said once per server copy so the owner sees why
let warnedKey = false;
function checkGasKey(cfg, env = process.env) {
  if (warnedKey || cfg.launchGasKey || !String(env.LAUNCH_GAS_KEY || '').trim()) return;
  warnedKey = true;
  console.warn("[launch] LAUNCH_GAS_KEY isn't a wallet's private key (64 hex characters, with or without 0x): no network fees are paid back");
}

export async function GET(request) {
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];
  if (keys.length === 1 && STUDIO_GETS.includes(keys[0])) {
    const { studioGet } = await import('../server/studio-api.js');
    return studioGet(getConfig(), request, keys[0], url.searchParams.get(keys[0]));
  }
  if (keys.length === 1 && INF_GETS.includes(keys[0])) {
    const { infGet } = await import('../server/inf-api.js');
    return infGet(getConfig(), request, keys[0], url.searchParams.get(keys[0]));
  }
  if (keys.length !== 1 || !['d', 'pic'].includes(keys[0])) return json(400, { error: 'bad_request' });
  const id = url.searchParams.get(keys[0]);
  if (!DRAFT_ID.test(id)) return json(400, { error: 'bad_request' });
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) return json(503, { error: 'not_ready' });
  if (keys[0] === 'pic' && !launchPictureBurst(visitorCode(cfg.passSecret, clientIp(request)))) return json(429, { error: 'too_fast' });
  let d;
  try { d = await drafts.get(cfg, id); } catch (err) { return dbTrouble(err, 'reading a draft failed'); }
  if (!d || d.id !== id) return json(404, { error: 'gone' });
  if (keys[0] === 'd') {
    return json(200, {
      name: d.name, symbol: d.symbol, description: d.description || '', expires: ms(d.expires),
      expired: d.expired === true && !d.token, token: d.token || null, ready: launchReady(cfg) && (fromStudio(d) || Boolean(tgToken())),
      // her gas wallet pays the launch's network fee back (up to this much, in wei), and how that's going for this coin
      gasBack: gasOn(cfg) ? cfg.launchGasMaxWei.toString() : null,
      gas: gasForPage(cfg, d),
    });
  }
  if (!fromStudio(d) && !tgToken()) return json(503, { error: 'not_ready' });
  let pic;
  try { pic = await draftPicture(cfg, d); } catch (err) {
    console.warn(`[launch] a draft's picture: ${err.message}`);
    return json(502, { error: fromStudio(d) ? 'storage' : 'telegram' });
  }
  if (!pic) return json(404, { error: 'no_picture' });
  return new Response(pic.bytes, {
    status: 200,
    headers: {
      'Content-Type': pic.type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

export async function POST(request) {
  const cfg = getConfig();
  // (2026-10-10) an AGI Studio upload: the file's own bytes, with its ticket in the address
  const url = new URL(request.url);
  if ((url.searchParams.has('inf-up') || url.searchParams.has('inf-poster')) && /^application\/octet-stream\b/i.test(request.headers.get('content-type') || '')) {
    const { infBinary } = await import('../server/inf-api.js');
    return infBinary(cfg, request, url);
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'bad_request' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (body && typeof body === 'object' && STUDIO_POSTS.includes(body.action)) {
    if (STUDIO_MOVED.includes(body.action)) return json(410, { error: 'moved' });
    const { studioPost } = await import('../server/studio-api.js');
    return studioPost(cfg, request, body);
  }
  if (body && typeof body === 'object' && isInfAction(body.action)) {
    const { infPost, INF_POSTS } = await import('../server/inf-api.js');
    if (INF_POSTS.includes(body.action)) return infPost(cfg, request, body);
    return json(400, { error: 'bad_request' });
  }
  if (!body || typeof body !== 'object' || !['prepare', 'check', 'payback'].includes(body.action) || !DRAFT_ID.test(String(body.draft))) {
    return json(400, { error: 'bad_request' });
  }
  if (!launchReady(cfg)) {
    console.error('[launch] not ready: PINATA_JWT, TELEGRAM_BOT_TOKEN, PASS_SECRET, SUPABASE_URL and SUPABASE_SECRET_KEY are needed');
    return json(503, { error: 'not_ready' });
  }
  checkGasKey(cfg);
  const now = Date.now();
  const s = body.action === 'payback' ? null : readSession(cfg.passSecret, body.session, now);
  if (body.action !== 'payback' && !s) return json(401, { error: 'signed_out' });
  if (!launchBurst(visitorCode(cfg.passSecret, clientIp(request)), now)) return json(429, { error: 'too_fast' });
  let d;
  try { d = await drafts.get(cfg, body.draft); } catch (err) { return dbTrouble(err, 'reading a draft failed'); }
  if (!d || d.id !== body.draft) return json(404, { error: 'gone' });
  // (a draft from her bot needs her bot's token for its picture; one from AGI Studio doesn't)
  if (!fromStudio(d) && !tgToken()) {
    console.error('[launch] not ready: PINATA_JWT, TELEGRAM_BOT_TOKEN, PASS_SECRET, SUPABASE_URL and SUPABASE_SECRET_KEY are needed');
    return json(503, { error: 'not_ready' });
  }

  // ---------- its payback, again ----------
  if (body.action === 'payback') {
    if (!d.token) return json(409, { error: 'not_launched' });
    const so = gasForPage(cfg, d);
    if (!so || gasFinal(so)) return json(200, { gas: so });
    try {
      return json(200, { gas: await paybackFor(cfg, d, { deadline: now + BUDGET_MS }) });
    } catch (err) {
      console.warn(`[launch] a payback couldn't read its launch: ${err.message}`);
      return json(200, { gas: { paid: false, why: 'busy' } });
    }
  }
  const wallet = launchWallet(cfg.passSecret, s.wallet);

  // ---------- their launch, read back ----------
  if (body.action === 'check') {
    const tx = typeof body.tx === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.tx) ? body.tx.toLowerCase() : null;
    if (!tx) return json(400, { error: 'bad_tx' });
    if (d.wallet && d.wallet !== wallet) return json(200, { ok: false, why: 'other_wallet' });
    if (!d.cid) return json(200, { ok: false, why: 'not_launch' });                 // (never got ready: nothing to launch)
    let r;
    try { r = await readLaunch(tx, s.wallet, d); } catch (err) {
      console.warn(`[launch] couldn't read a launch: ${err.message}`);
      return json(503, { error: 'chain' });
    }
    if (!r.ok) return json(200, r.why === 'pending' ? { pending: true } : { ok: false, why: r.why });
    let token = r.token;
    try {
      const kept = await drafts.done(cfg, d.id, wallet, r.token, tx);
      if (kept?.ok === false && ['other_wallet', 'other_draft'].includes(kept.why)) return json(200, { ok: false, why: kept.why === 'other_draft' ? 'not_launch' : 'other_wallet' });
      if (kept?.ok === true && /^0x[0-9a-f]{40}$/.test(String(kept.token))) token = kept.token;    // (the first one it was launched as)
      if (kept?.ok !== true) throw new Error(`launch_done said ${kept?.why || 'nothing'}`);
    } catch (err) {
      // not kept yet: the page keeps asking (its launch and its payback need it kept: the transaction is only in the page)
      console.error('[launch] keeping a launch failed:', err.message);
      return json(503, { error: 'busy' });
    }
    // its network fee, paid back by the owner's gas wallet: once per coin, and only when there's time to finish it inside
    // Vercel's 25 s (else the page asks again in a moment)
    let gas = null;
    if (gasOn(cfg)) {
      const so = gasSoFar(d);
      gas = so && gasFinal(so) ? so : await payGasBack(cfg, { id: d.id, code: wallet, wallet: s.wallet, from: r.from, fee: r.fee, deadline: now + BUDGET_MS });
    }
    return json(200, { ok: true, token, curve: token === r.token ? r.curve : null, gas });
  }

  // ---------- prepare ----------
  if (d.token) return json(409, { error: 'launched', token: d.token });
  if (d.expired === true) return json(410, { error: 'expired' });
  if (d.wallet && d.wallet !== wallet) return json(403, { error: 'other_wallet' });
  // the pair they picked (ETH unless they picked SPCX) and the links they added (optional): checked before anything is
  // read, counted or uploaded
  const pair = pairOf(body.pair);
  if (!pair) return json(400, { error: 'bad_request' });
  const linked = checkLinks(body.links);
  if (!linked.ok) return json(422, { error: 'links', field: linked.field, why: linked.why });
  // what the wallet holds, plus what it burned for messages, read fresh from the chain: 10,000+ to launch at all, and its
  // coins a day (5 for every 10,000, 50 at most)
  const held = await checkHolding(s.wallet, undefined, await burnedAgi(cfg, s.wallet));
  if (!held.checked) return json(503, { error: 'chain' });
  const perDay = launchesADay(held.agi);
  if (perDay < 1) return json(403, { error: 'level', level: held.level });
  // clank.trade's terms right now, before anything is counted or uploaded: launches open for this wallet, the pair on its
  // list, and free (the page never sends ETH)
  let terms;
  try { terms = await launchTerms(s.wallet, undefined, pair); } catch (err) {
    console.warn(`[launch] couldn't read clank.trade's launch terms: ${err.message}`);
    return json(503, { error: 'chain' });
  }
  if (!terms.open) return json(409, { error: 'closed' });
  if (!terms.approved) return json(409, { error: 'pair' });
  if (terms.fee !== 0n) {
    console.warn(`[launch] clank.trade charges a launch fee now (${terms.fee} wei): the page sends no ETH, so launches wait for an update`);
    return json(409, { error: 'fee' });
  }
  // this wallet keeps the draft; its picture's upload is counted before it starts (one of the wallet's coins for today;
  // given back if it fails)
  let p;
  try { p = await drafts.prepare(cfg, d.id, wallet, perDay); } catch (err) { return dbTrouble(err, 'getting a draft ready failed'); }
  if (p?.ok !== true) {
    const why = String(p?.why || 'busy');
    const status = { gone: 404, expired: 410, launched: 409, other_wallet: 403, uploading: 409, wallet_cap: 429, site_cap: 429 }[why] || 503;
    return json(status, why === 'wallet_cap' ? { error: why, perDay } : { error: why });
  }
  let cid = p.cid || null;
  if (!cid) {
    const giveBack = () => drafts.uploadBack(cfg, d.id).catch((err) => console.error('[launch] giving an upload back failed:', err.message));
    let pic;
    try { pic = await draftPicture(cfg, d); } catch (err) {
      console.warn(`[launch] a draft's picture: ${err.message}`);
      await giveBack();
      return json(502, { error: fromStudio(d) ? 'storage' : 'telegram' });
    }
    if (!pic) { await giveBack(); return json(422, { error: 'picture' }); }
    let pinned;
    // (a file name of plain letters: a ticker can be anything since 2026-10-02, emoji and "/" included)
    const label = String(d.symbol).normalize('NFKD').replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'coin';
    try { pinned = await pinPicture(cfg.pinataJwt, pic, `agi1-launch-${label}-${d.id.slice(0, 6)}`); } catch (err) {
      console.error(`[launch] putting a picture on IPFS failed: ${err.message}`);
      await giveBack();
      return json(502, { error: 'pinata' });
    }
    cid = pinned.cid;
    // kept before the wallet is asked: without it, its launch couldn't be read back (nor its fee paid back). If it can't be
    // kept, the upload is given back and the next try finds the same picture at Pinata (a duplicate, kept without its id)
    let kept = false;
    try { kept = (await drafts.setCid(cfg, d.id, cid, pinned.pin)) === true; } catch (err) { console.error('[launch] keeping a picture id failed:', err.message); }
    if (!kept) {
      await giveBack();
      return json(503, { error: 'busy' });
    }
  }
  // the launch call, and a dry run of it on the chain right before the wallet opens
  const call = launchCall({ id: d.id, name: d.name, symbol: d.symbol, description: d.description || '', cid, wallet: s.wallet, economics: terms.economics, links: linked.links, pair });
  let dry;
  try { dry = await tryLaunch(call, s.wallet); } catch (err) {
    console.warn(`[launch] couldn't try a launch on the chain: ${err.message}`);
    return json(503, { error: 'chain' });
  }
  if (!dry.ok) {
    if (!['exists', 'closed', 'pair'].includes(dry.why)) console.warn(`[launch] the dry run of $${d.symbol} failed: ${dry.why}`);
    return json(409, { error: dry.why });
  }
  // where its coin will be: read back from there, and its picture kept while a coin is there. The same link got ready again
  // with other details (other links, the other pair) would be another coin: one more of this wallet's coins for today
  let kept;
  try { kept = await drafts.predicted(cfg, d.id, wallet, dry.token, perDay); } catch (err) {
    console.error('[launch] keeping where the coin will be failed:', err.message);
    return json(503, { error: 'busy' });
  }
  if (kept?.ok !== true) {
    const why = String(kept?.why || 'busy');
    if (why === 'wallet_cap') return json(429, { error: why, perDay, changed: true });
    const status = { gone: 404, launched: 409, other_wallet: 403 }[why];
    if (!status) console.error(`[launch] keeping where the coin will be: launch_predicted said ${why}`);
    return json(status || 503, { error: status ? why : 'busy' });
  }
  return json(200, { ...call, chainId: CHAIN_ID, token: dry.token, curve: dry.curve, level: held.level, perDay });
}
