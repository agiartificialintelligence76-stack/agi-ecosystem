// AGI-1's live show (2026-10-07, the owner: "react to her own X posts/videos and replies (with visuals and not)"): her own
// posts on X (@agi1dotapp) and the replies under them, read with X's API, so she can show them on stream and react.
//   • only with LIVE_X_BEARER on the server (live.env: an app's Bearer Token from X's developer console; never in chat, git
//     or a screenshot). Without it, she simply never reads X;
//   • read-only: she never posts, replies, likes, follows or reads anyone's messages (hard rule 6);
//   • X's API is pay per use (2026: about $0.005 for each post read, $0.010 for each account read, and X counts each post
//     once a day however often it's read): a show reads at most LIVE_X_READS posts (60 by default: about $0.30), her
//     account's number is read once and kept on the server's disk, her posts once a show, and the replies under one post
//     once a show;
//   • never who replied: replies are read without their writers (the request asks for none), and shown as "someone replied".
// Every text read here is checked by the site before it's shown or reacted to (server/live.js checkPost, the AI's "skip").
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const X_API = 'https://api.x.com/2';
// a Bearer Token: letters, numbers and %, at least 30 of them
const TOKEN = /^[A-Za-z0-9%._~+/=-]{30,600}$/;
export function xSettings(env = process.env) {
  const bearer = String(env.LIVE_X_BEARER || '').trim();
  const reads = Number(env.LIVE_X_READS);
  return {
    bearer: TOKEN.test(bearer) ? bearer : '',
    user: String(env.LIVE_X_USER || 'agi1dotapp').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15) || 'agi1dotapp',
    maxReads: Number.isFinite(reads) && String(env.LIVE_X_READS).trim() !== '' ? Math.max(0, Math.min(500, Math.floor(reads))) : 60,
  };
}

// a post's media → { type: 'photo' | 'video', url (a picture), video (an MP4's address), seconds }
export function mediaOf(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'photo' && typeof m.url === 'string') return { type: 'photo', url: m.url };
  if (m.type === 'video' || m.type === 'animated_gif') {
    const mp4 = (Array.isArray(m.variants) ? m.variants : []).filter((v) => v?.content_type === 'video/mp4' && typeof v.url === 'string');
    // the sharpest one up to about 2 Mb/s (her TV is 640 px wide), else the smallest
    const fit = mp4.filter((v) => !(v.bit_rate > 2_300_000)).sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0] || mp4.sort((a, b) => (a.bit_rate || 0) - (b.bit_rate || 0))[0];
    if (!fit) return null;
    return { type: 'video', video: fit.url, url: typeof m.preview_image_url === 'string' ? m.preview_image_url : null, seconds: Number(m.duration_ms) > 0 ? Number(m.duration_ms) / 1000 : null };
  }
  return null;
}
// X's answer for her posts → [{ id, text, at, media }] (newest first)
export function postsOf(data) {
  const media = new Map((data?.includes?.media || []).map((m) => [m.media_key, m]));
  return (Array.isArray(data?.data) ? data.data : []).filter((p) => p && /^\d{1,25}$/.test(String(p.id)) && typeof p.text === 'string')
    .map((p) => ({
      id: String(p.id), text: p.text, at: Date.parse(p.created_at) || 0,
      media: (p.attachments?.media_keys || []).map((k) => mediaOf(media.get(k))).find(Boolean) || null,
    }));
}
// X's answer for the replies under a post → [{ id, text }] (the "@agi1dotapp …" X puts in front taken off; never a reply of
// hers, never who wrote it)
export function repliesOf(data, user = 'agi1dotapp') {
  return (Array.isArray(data?.data) ? data.data : []).filter((p) => p && /^\d{1,25}$/.test(String(p.id)) && typeof p.text === 'string')
    .map((p) => ({ id: String(p.id), text: p.text.replace(/^(?:@\w{1,15}\s+)+/, '').trim() }))
    .filter((p) => p.text && !new RegExp(`^@?${user}\\b`, 'i').test(p.text));
}

export function createX(settings, { fetchFn = fetch, log = console, cacheDir = null, now = Date.now } = {}) {
  let reads = 0, userId = null, posts = null;
  const replied = new Map();
  const on = Boolean(settings.bearer) && settings.maxReads > 0;
  const keep = cacheDir ? join(cacheDir, 'x-user.json') : null;
  async function get(path, params = {}) {
    const url = `${X_API}${path}?${new URLSearchParams(params)}`;
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${settings.bearer}` }, signal: AbortSignal.timeout(10_000), redirect: 'error' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = res.status === 401 ? ' (LIVE_X_BEARER isn\'t accepted: copy the Bearer Token again in X\'s developer console)'
        : res.status === 402 || /credit|payment|billing/i.test(JSON.stringify(data)) ? ' (no credits left on X\'s developer console)'
          : res.status === 429 ? ' (X says: too many for now)' : '';
      const err = new Error(`x ${path.split('?')[0].replace(/\d{5,}/g, '…')}: HTTP ${res.status}${hint}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const budget = (n) => reads + n <= settings.maxReads;
  async function user() {
    if (userId) return userId;
    if (keep && existsSync(keep)) {
      try { const k = JSON.parse(readFileSync(keep, 'utf8')); if (k.user === settings.user && /^\d{1,25}$/.test(k.id)) { userId = k.id; return userId; } } catch { /* read it again */ }
    }
    const data = await get(`/users/by/username/${settings.user}`);
    const id = String(data?.data?.id || '');
    if (!/^\d{1,25}$/.test(id)) throw new Error('x: her account wasn\'t found');
    userId = id;
    if (keep) { try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(keep, JSON.stringify({ user: settings.user, id })); } catch { /* next time */ } }
    return userId;
  }
  return {
    on,
    get reads() { return reads; },
    // her newest posts (10 at most: not replies, not reposts), read once a show → [{ id, text, at, media }]
    async posts() {
      if (!on) return [];
      if (posts) return posts;
      if (!budget(10)) return [];
      try {
        const id = await user();
        const data = await get(`/users/${id}/tweets`, {
          max_results: '10', exclude: 'retweets,replies', 'tweet.fields': 'created_at,attachments',
          expansions: 'attachments.media_keys', 'media.fields': 'type,url,preview_image_url,variants,duration_ms',
        });
        posts = postsOf(data);
        reads += Math.max(posts.length, 1);
        log.info?.(`[x] read her ${posts.length} newest posts (${reads} posts read this show)`);
      } catch (err) {
        log.warn?.(`[x] couldn't read her posts: ${err.message}`);
        posts = [];
      }
      return posts;
    },
    // the replies under one of her posts (10 at most, the last 7 days, none of hers), once a show per post → [{ id, text }]
    async replies(postId) {
      if (!on || !/^\d{1,25}$/.test(String(postId))) return [];
      if (replied.has(postId)) return replied.get(postId);
      if (!budget(10)) return [];
      let list = [];
      try {
        const data = await get('/tweets/search/recent', {
          query: `conversation_id:${postId} is:reply -from:${settings.user} -is:retweet`, max_results: '10', 'tweet.fields': 'created_at',
        });
        list = repliesOf(data, settings.user);
        reads += Math.max(list.length, 1);
      } catch (err) { log.warn?.(`[x] couldn't read the replies under a post: ${err.message}`); }
      replied.set(postId, list);
      return list;
    },
  };
}
