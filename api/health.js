// GET /api/health: a tiny server function that proves code in /api runs on Vercel.
// AGI-1's chat will live next to it later (api/chat.js) and use the same pattern.
export function GET() {
  return Response.json(
    { ok: true, time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
