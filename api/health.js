// GET /api/health: health probe; ?ainews=1 serves /api/ainews (kept inside the 12-function cap, lazy-loaded).
export async function GET(request) {
  const url = request?.url ? new URL(request.url) : null;
  if (url?.searchParams.has('ainews')) {
    const { handleAiNewsRequest } = await import('../server/ainews.js');
    return handleAiNewsRequest(request);
  }
  return Response.json(
    { ok: true, time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
