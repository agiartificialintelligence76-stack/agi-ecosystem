// Local browser QA only. Run: node tools/owner-preview.mjs
// No real wallets, database keys, .env files, or upstream APIs are used here.
// This tools/ fixture is not a Vite entry and is never part of the deployed site.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import config from '../vite.config.js';
import { makeSession, readSession } from '../server/session.js';
import { emptyDocument } from '../src/owner/model.js';

const HOST = '127.0.0.1';
const PORT = 5179;
const ORIGIN = `http://${HOST}:${PORT}`;
const SECRET = 'local-owner-preview-fake-secret-not-for-production';
const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
Object.assign(process.env, {
  PASS_SECRET: SECRET,
  SUPABASE_URL: 'https://owner-preview.fake.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_local_fixture_only',
  STUDIO_OWNER: OWNER,
  STUDIO_ONLY_FOR: OWNER,
});

const initialTime = new Date().toISOString();
const db = { document: emptyDocument(), revision: 0, updatedAt: initialTime, history: [{ document: emptyDocument(), revision: 0, updatedAt: initialTime, summary: 'Original site' }] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const address = String(url);
  if (!/^https:\/\/owner-preview\.fake\.supabase\.co\/rest\/v1\/rpc\/site_content_(?:get|history|put|restore)$/.test(address)) {
    throw new Error('The local owner QA fixture blocks all upstream API requests.');
  }
  const name = address.split('/').pop(), args = JSON.parse(init.body || '{}');
  if (name === 'site_content_get') return Response.json({ document: db.document, revision: db.revision, updatedAt: db.updatedAt });
  if (name === 'site_content_history') return Response.json(db.history.slice().reverse().map(({ document, ...rest }) => rest));
  if (args.p_revision !== db.revision) return Response.json({ ok: false, why: 'conflict', revision: db.revision });
  let document = args.p_document;
  if (name === 'site_content_restore') {
    document = db.history.find((h) => h.revision === args.p_target)?.document;
    if (!document) return Response.json({ ok: false, why: 'gone' });
  }
  db.document = structuredClone(document);
  db.revision++;
  db.updatedAt = new Date().toISOString();
  db.history.push({ document: structuredClone(document), revision: db.revision, updatedAt: db.updatedAt, summary: name === 'site_content_restore' ? `Restored version ${args.p_target}` : 'Saved in local QA' });
  db.history = db.history.slice(-30);
  return Response.json({ ok: true, document: db.document, revision: db.revision, updatedAt: db.updatedAt });
};
const { GET, POST } = await import('../api/wallet.js');
const sessionFor = (wallet) => ({ session: makeSession(SECRET, { wallet, level: 1, checkedAt: Date.now() }), wallet, level: 1, name: null, notes: [] });
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
function localRequest(req) {
  const allowedHost = req.headers.host === `${HOST}:${PORT}`;
  const remote = req.socket.remoteAddress;
  const loopback = remote === HOST || remote === `::ffff:${HOST}`;
  const source = req.headers.origin;
  return allowedHost && loopback && (!source || source === ORIGIN) && req.headers['sec-fetch-site'] !== 'cross-site';
}
const fixture = {
  name: 'local-owner-qa-only',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const parsed = new URL(req.url || '/', ORIGIN);
      if (!parsed.pathname.startsWith('/__owner-test') && !parsed.pathname.startsWith('/api/')) return next();
      if (!localRequest(req)) return json(res, 403, { error: 'loopback_only' });
      try {
        if (parsed.pathname === '/__owner-test/session') {
          if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
          return json(res, 200, sessionFor(parsed.searchParams.get('wallet') === 'other' ? OTHER : OWNER));
        }
        if (parsed.pathname === '/__owner-test') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local owner QA</title><body><h1>Local owner preview</h1><p>This signs in a made-up wallet on this computer only. Saves stay in memory and reset when this preview stops.</p><button id="owner">Open as the owner</button> <button id="other">Try a different wallet</button> <button id="out">Sign out</button><p><a href="/owner">Open the owner editor</a> · <a href="/">Open the website</a></p><script>async function signIn(wallet){const response=await fetch('/__owner-test/session?wallet='+wallet);if(!response.ok)throw new Error('Local sign-in failed');localStorage.setItem('agi_wallet',JSON.stringify(await response.json()));location.assign('/owner');}document.getElementById('owner').onclick=()=>signIn('owner');document.getElementById('other').onclick=()=>signIn('other');document.getElementById('out').onclick=()=>{localStorage.removeItem('agi_wallet');location.assign('/owner');};</script></body></html>`);
        }
        if (parsed.pathname.startsWith('/__owner-test')) return json(res, 404, { error: 'not_found' });
        if (parsed.pathname !== '/api/wallet') return json(res, 200, { ready: false, error: 'local_preview' });
        if (req.method === 'GET' && parsed.search !== '?site-content') return json(res, 200, { ready: false, polls: [] });
        if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'method_not_allowed' });
        let raw = '';
        if (req.method === 'POST') {
          for await (const chunk of req) {
            raw += chunk.toString();
            if (Buffer.byteLength(raw) > 1_200_000) return json(res, 413, { error: 'bad_request' });
          }
          let body;
          try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'bad_request' }); }
          // Embedded public pages refresh the same stored wallet on startup. Keep this
          // read-only fixture profile valid so they do not sign the editor out.
          if (body?.action === 'profile') {
            const signed = readSession(SECRET, body.session);
            if (!signed || ![OWNER, OTHER].includes(signed.wallet)) return json(res, 401, { error: 'signed_out' });
            return json(res, 200, { ...sessionFor(signed.wallet), session: body.session, levelName: 'Stranger', daily: 5, checked: true, burn: { ready: false } });
          }
          if (!['site-owner', 'site-save', 'site-history', 'site-restore'].includes(body?.action)) return json(res, 401, { error: 'signed_out' });
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        headers.set('x-real-ip', HOST);
        const request = new Request(parsed.href, { method: req.method, headers, ...(req.method === 'POST' ? { body: raw } : {}) });
        const response = await (req.method === 'GET' ? GET(request) : POST(request));
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        console.error('[local owner preview]', err.message);
        if (!res.headersSent) json(res, 500, { error: 'local_preview_failed' }); else res.end();
      }
    });
  },
};

const server = await createServer({
  ...config,
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  envDir: false,
  plugins: [fixture, ...config.plugins],
  server: { host: HOST, port: PORT, strictPort: true },
});
await server.listen();
console.log(`Local owner QA is ready: ${ORIGIN}/__owner-test`);
console.log('Only made-up credentials and in-memory content are used. No .env files or upstream APIs are loaded.');
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await server.close();
  globalThis.fetch = realFetch;
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
