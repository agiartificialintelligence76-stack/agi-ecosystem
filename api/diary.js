// GET /api/diary: AGI-1's diary entries, newest first. ?before=YYYY-MM-DD&limit=N for older ones (the "Show older" button).
// Everyone sees the same entries, so Vercel's CDN keeps the answer for 10 minutes (older pages: an hour).
// Entries are written once a day by the nightly keep-alive job (server/diary.js), never by visitors.
import { getConfig } from '../server/config.js';
import { diaryRpc, dayOf, entryForThisSite } from '../server/diary.js';

const noStore = { 'Cache-Control': 'no-store' };
const DAY_MS = 86_400_000;
const EARLIEST = '2026-01-01';          // nothing is older than the site (the first entry is about 2026-09-24)

export async function GET(request) {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[diary] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return Response.json({ error: 'not_configured' }, { status: 503, headers: noStore });
  }
  const params = new URL(request?.url || 'https://x/').searchParams;
  const tomorrow = dayOf(Date.now() + DAY_MS);
  const before = params.get('before') || tomorrow;
  const limit = Number(params.get('limit') || 14);
  const realDay = /^\d{4}-\d{2}-\d{2}$/.test(before) && dayOf(Date.parse(`${before}T00:00:00Z`) || 0) === before;
  if (!realDay || before < EARLIEST || before > tomorrow || !Number.isInteger(limit) || limit < 1 || limit > 30) {
    return Response.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  }
  try {
    const entries = await diaryRpc(cfg, 'diary_list', { p_before: before, p_limit: limit });
    const latest = !params.has('before');
    return Response.json(
      { entries: Array.isArray(entries) ? entries.map(entryForThisSite) : [], before },
      { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${latest ? 600 : 3600}, stale-while-revalidate=600` } },
    );
  } catch (err) {
    console.error('[diary] entries unavailable:', err.message);
    return Response.json({ error: err.code === 'not_ready' ? 'not_ready' : 'busy' }, { status: 503, headers: noStore });
  }
}

export function POST() {
  return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: noStore });
}
