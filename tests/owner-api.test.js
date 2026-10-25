import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GET, POST } from '../api/wallet.js';
import { makeSession } from '../server/session.js';
import { siteOwnerBurst } from '../server/site-content.js';
import { validateDocument, emptyDocument, safeSelector, safeUrl, validPagePath } from '../src/owner/model.js';

const SECRET = 'owner-test-secret-that-is-at-least-32-characters';
const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const savedEnv = { ...process.env }, realFetch = globalThis.fetch, realError = console.error;
let db, calls, mode;
const token = (wallet = OWNER, expiresAt) => makeSession(SECRET, { wallet, level: 1, checkedAt: Date.now(), ...(expiresAt ? { expiresAt } : {}) });
const change = () => ({ pages: [{ path: '/', title: 'AGI home', blocks: [{ id: 'new-world', title: 'New world', text: 'Welcome', placement: 'world', href: '/p/news', label: 'Read more' }] }, { path: '/p/news', custom: true, title: 'News', blocks: [{ id: 'hello', title: 'Hello', text: 'A new page' }] }], edits: [{ id: 'hide-vote', page: '/', selector: '.lp-eco > ul > li:nth-of-type(9)', hidden: true }] });
beforeEach(() => {
  Object.assign(process.env, { PASS_SECRET: SECRET, SUPABASE_URL: 'https://owner.fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', STUDIO_OWNER: OWNER });
  delete process.env.STUDIO_ONLY_FOR;
  siteOwnerBurst.reset();
  console.error = () => {};
  db = { document: emptyDocument(), revision: 0, updatedAt: '2026-10-25T00:00:00.000Z', history: [{ document: emptyDocument(), revision: 0, updatedAt: '2026-10-25T00:00:00.000Z', summary: 'Original site' }] };
  calls = []; mode = '';
  globalThis.fetch = async (url, init = {}) => {
    assert.match(String(url), /^https:\/\/owner\.fake\.supabase\.co\/rest\/v1\/rpc\/site_content_/);
    assert.equal(init.headers.apikey, 'sb_secret_test');
    assert.equal(init.headers.Authorization, undefined, 'secret keys are not JWTs');
    const fn = String(url).split('/').pop(), args = JSON.parse(init.body);
    calls.push({ fn, args });
    if (mode === 'missing') return Response.json({ code: 'PGRST202', message: 'not installed' }, { status: 404 });
    if (mode === 'down') return Response.json({ code: 'XX000', message: 'database down' }, { status: 503 });
    if (mode === 'malformed') return Response.json({ ok: true, document: {}, revision: 1 });
    if (fn === 'site_content_get') return Response.json({ document: db.document, revision: db.revision, updatedAt: db.updatedAt });
    if (fn === 'site_content_history') return Response.json(db.history.slice().reverse().map(({ document, ...rest }) => rest));
    if (args.p_revision !== db.revision) return Response.json({ ok: false, why: 'conflict', revision: db.revision });
    let document = args.p_document;
    if (fn === 'site_content_restore') {
      document = db.history.find((h) => h.revision === args.p_target)?.document;
      if (!document) return Response.json({ ok: false, why: 'gone' });
    }
    db.document = structuredClone(document); db.revision++;
    db.history.push({ document: structuredClone(document), revision: db.revision, updatedAt: db.updatedAt, summary: 'Saved' });
    db.history = db.history.slice(-30);
    return Response.json({ ok: true, document: db.document, revision: db.revision, updatedAt: db.updatedAt });
  };
});
after(() => {
  globalThis.fetch = realFetch; console.error = realError;
  for (const key of ['PASS_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'STUDIO_OWNER', 'STUDIO_ONLY_FOR']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
});
async function post(action, body = {}, session = token()) {
  const r = await POST(new Request('https://agi1.app/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '192.0.2.1' }, body: JSON.stringify({ action, session, ...body }) }));
  return { status: r.status, body: await r.json(), cache: r.headers.get('Cache-Control') };
}
async function get() {
  const r = await GET(new Request('https://agi1.app/api/wallet?site-content'));
  return { status: r.status, body: await r.json(), cache: r.headers.get('Cache-Control') };
}

test('every owner action requires an unexpired signed owner-wallet session before touching storage', async () => {
  for (const action of ['site-owner', 'site-save', 'site-history', 'site-restore']) {
    assert.equal((await post(action, {}, '')).status, 401);
    assert.equal((await post(action, {}, 'forged.signature')).status, 401);
    assert.equal((await post(action, {}, token(OWNER, Date.now() - 1))).status, 401);
    assert.equal((await post(action, {}, token(OTHER))).status, 403);
  }
  assert.deepEqual(calls, []);
});
test('owner wallet fallback matches the vote owner and missing owner stays closed', async () => {
  delete process.env.STUDIO_OWNER;
  assert.deepEqual((await post('site-owner')).body, { error: 'not_owner', unset: true });
  process.env.STUDIO_ONLY_FOR = `${OWNER},${OTHER}`;
  assert.equal((await post('site-owner')).status, 200);
  assert.equal((await post('site-owner', {}, token(OTHER))).status, 403);
});
test('owner saves are persistent, return the confirmed revision, and do not leak secrets in public reads', async () => {
  const initial = await post('site-owner');
  assert.equal(initial.cache, 'no-store');
  assert.equal(initial.body.revision, 0);
  const saved = await post('site-save', { revision: 0, document: change() });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision, 1);
  assert.deepEqual((await post('site-owner')).body.document, saved.body.document);
  const published = await get();
  assert.equal(published.body.ready, true); assert.equal(published.body.revision, 1);
  assert.equal(published.body.document.pages[0].blocks[0].placement, 'world');
  assert.doesNotMatch(JSON.stringify(published.body), /sb_secret|1111111111111111|updatedAt|history/);
});
test('public reads redact hidden pages, hidden blocks and removed element text', async () => {
  const document = change();
  document.pages[1].hidden = true; document.pages[1].description = 'private page';
  document.pages[0].blocks.push({ id: 'secret-block', text: 'private section', hidden: true });
  document.edits[0].text = 'private old label';
  await post('site-save', { revision: 0, document });
  const published = (await get()).body.document;
  assert.deepEqual(published.pages[1], { path: '/p/news', title: '', hidden: true, custom: true, description: '', blocks: [] });
  assert.equal(published.pages[0].blocks.length, 1);
  assert.equal(published.edits[0].text, undefined);
  assert.doesNotMatch(JSON.stringify(published), /private/);
  assert.match(JSON.stringify((await post('site-owner')).body.document), /private/);
});
test('stale saves and restores cannot overwrite another tab; history restores as a new revision', async () => {
  await post('site-save', { revision: 0, document: change() });
  const conflict = await post('site-save', { revision: 0, document: emptyDocument() });
  assert.equal(conflict.status, 409); assert.equal(db.document.pages.length, 2);
  assert.equal((await post('site-restore', { revision: 0, targetRevision: 0 })).status, 409);
  assert.equal((await post('site-restore', { revision: 1, targetRevision: 50 })).status, 404);
  const restored = await post('site-restore', { revision: 1, targetRevision: 0 });
  assert.equal(restored.status, 200); assert.equal(restored.body.revision, 2);
  assert.deepEqual(restored.body.document, emptyDocument());
  const history = (await post('site-history')).body.history;
  assert.deepEqual(history.map((h) => h.revision), [2, 1, 0]);
  assert.equal(history[0].document, undefined);
});
test('storage failures and missing installation never report a successful save', async () => {
  mode = 'missing';
  assert.equal((await get()).body.ready, false);
  assert.equal((await post('site-owner')).body.error, 'not_ready');
  assert.equal((await post('site-save', { revision: 0, document: change() })).status, 503);
  mode = 'down';
  assert.equal((await get()).status, 503);
  assert.equal((await post('site-save', { revision: 0, document: change() })).status, 503);
  mode = 'malformed';
  assert.equal((await post('site-save', { revision: 0, document: change() })).status, 503);
  assert.equal(db.revision, 0);
});
test('owner route accepts a larger content document but validation rejects oversized and malformed writes', async () => {
  const document = change(); document.pages[1].blocks[0].text = 'x'.repeat(10_000);
  assert.equal((await post('site-save', { revision: 0, document })).status, 200);
  document.pages[1].blocks[0].text = 'x'.repeat(12_001);
  assert.equal((await post('site-save', { revision: 1, document })).status, 400);
  assert.equal((await post('site-save', { revision: -1, document: change() })).status, 400);
  const large = { pages: [], edits: Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, page: '/', selector: `#text${i}`, text: 'x'.repeat(12_000) })) };
  assert.equal(validateDocument(large).ok, false);
  assert.equal((await post('site-save', { revision: 1, document: large })).status, 413);
  assert.equal(db.revision, 1);
});
test('content URLs reject executable, deceptive and CSP-incompatible image locations', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hi', '//evil.test/a', '/\\evil.test', 'https://user:secret@agi1.app', 'https:\\evil.test', '/%2fevil.test', '/%0aevil.test']) assert.equal(safeUrl(value), false, value);
  for (const value of ['/games', '#playground', 'https://example.com/path?q=yes']) assert.equal(safeUrl(value), true, value);
  assert.equal(safeUrl('data:image/png;base64,aGVsbG8=', { image: true }), true);
  assert.equal(safeUrl('data:image/svg+xml;base64,aGVsbG8=', { image: true }), false);
  assert.equal(safeUrl('https://evil.test/x.png', { image: true }), false);
  assert.equal(safeUrl('https://live.agi1.app/x.webp', { image: true }), true);
});
test('reserved routes and dangerous selectors cannot become content edits', () => {
  for (const path of ['/owner', '/owner/anything', '/api/wallet', '/vote/owner', '/studio/owner', '/src/main', '//evil', '/p/../owner']) assert.equal(validPagePath(path), false, path);
  for (const selector of ['script', 'body', 'html > body', 'iframe', '[onclick]', 'a[href^="javascript"]', '*', '#top,script', 'div:has(script)', '#x; color:red']) assert.equal(safeSelector(selector), false, selector);
  for (const selector of ['#top', '.lp-eco > ul > li:nth-of-type(2)', '[data-owner-key="main.section-1.h2-1"]', 'section.hero > h1']) assert.equal(safeSelector(selector), true, selector);
  const input = change(); input.pages[0].path = '/owner';
  assert.equal(validateDocument(input).ok, false);
  const custom = change(); custom.pages[1].path = '/vote';
  assert.equal(validateDocument(custom).ok, false);
  const global = change(); global.edits[0].page = '*';
  assert.equal(validateDocument(global).ok, true);
});
test('model accepts safe insertion and plain text but rejects duplicate targets and unbounded additions', () => {
  const document = change();
  document.pages[0].blocks[0] = { id: 'new', title: '<script>alert(1)</script>', placement: 'before', anchor: '#playground', text: 'Only plain text' };
  assert.equal(validateDocument(document).ok, true, 'renderer uses textContent');
  document.edits.push({ ...document.edits[0], id: 'another' });
  assert.equal(validateDocument(document).ok, false);
  document.edits.pop(); document.pages[0].blocks[0].anchor = 'script';
  assert.equal(validateDocument(document).ok, false);
});
test('SQL isolates the site, locks competing writes, enables RLS and grants execution only to the secret role', () => {
  const sql = readFileSync(new URL('../supabase/site-content.sql', import.meta.url), 'utf8');
  assert.match(sql, /check \(site = 'agi1.app'\)/);
  assert.equal((sql.match(/enable row level security/g) || []).length, 2);
  assert.equal((sql.match(/security invoker/g) || []).length, 4);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /for update/);
  assert.match(sql, /limit 30/);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
});
