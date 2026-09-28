// GET /api/keepalive: Vercel calls this 3 times a day (see "crons" in vercel.json).
// Why: Supabase pauses a free project after about a week of low activity, and then AGI-1's chat stops,
// because it needs the database for its limits. A tiny database read a few times a day counts as activity.
// Phase 5: it also writes AGI-1's diary entry for yesterday if it's missing (server/diary.js): the first run after
// midnight UTC writes it, later runs only check (so a failed night is tried again at the next run).
// (Its check of the Arena's coins, Phase 6, left with the Arena on 2026-09-28: the original site's keep-alive still does it.)
// Only Vercel may call it: when CRON_SECRET is set, Vercel sends "Authorization: Bearer <CRON_SECRET>".
import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../server/config.js';
import { writeDiary } from '../server/diary.js';

const fingerprint = (text) => createHash('sha256').update(String(text)).digest();
// Compares fixed-size fingerprints, so the check takes the same time whatever was sent.
const sameSecret = (a, b) => timingSafeEqual(fingerprint(a), fingerprint(b));
const answer = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  const secret = process.env.CRON_SECRET || '';
  if (secret.length < 16) {
    console.error('[keepalive] CRON_SECRET is missing or shorter than 16 characters: add it in Vercel, then redeploy');
    return answer({ error: 'not_configured' }, 503);
  }
  if (!sameSecret(request.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return answer({ error: 'unauthorized' }, 401);
  }

  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[keepalive] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return answer({ error: 'not_configured' }, 503);
  }
  try {
    // Read one row (or none) from the chat counters. Cheap, and it touches the real database.
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/chat_usage?select=day&limit=1`, {
      headers: { apikey: cfg.supabaseKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const hint = res.status === 540 ? ' (the project is already paused: Supabase dashboard → the project → Resume project)' : '';
      throw new Error(`HTTP ${res.status}${hint}`);
    }
    await res.text();
    console.log('[keepalive] ok: Supabase answered');
    const diary = await writeDiary(cfg);                  // never throws; a diary problem doesn't fail the keep-alive
    return answer({ ok: true, diary });
  } catch (err) {
    console.error(`[keepalive] database read failed: ${err.message}`);
    return answer({ error: 'database' }, 502);
  }
}
