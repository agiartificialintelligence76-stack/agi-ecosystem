import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../api/wallet.js';
import { makeSession } from '../server/session.js';
import { siteOwnerBurst } from '../server/site-content.js';
import { finishMediaUpload, matchesMediaHeader } from '../server/site-media.js';
import { getConfig } from '../server/config.js';
import { validateDocument, publicDocument, emptyDocument } from '../src/owner/model.js';
import { MEDIA_ORIGIN, MEDIA_BUCKET, MEDIA_PUBLIC_ROOT, safeMemeUrl } from '../src/owner/media-model.js';

const SECRET = 'test-owner-media-secret-at-least-thirty-two-characters';
const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1cAAAAASUVORK5CYII=', 'base64');
const MP4 = Buffer.from('000000186674797069736f6d0000020069736f6d6d703432', 'hex');
const previousEnv = { ...process.env }, realFetch = globalThis.fetch, realError = console.error;
let files, calls, doc, revision, badSign, down, rangeStream, readChunks, cancelled;
const token = (wallet = OWNER, secret = process.env.PASS_SECRET) => makeSession(secret, { wallet, level: 1, checkedAt: Date.now() });
beforeEach(() => {
  Object.assign(process.env, { PASS_SECRET: SECRET, SUPABASE_URL: MEDIA_ORIGIN, SUPABASE_SECRET_KEY: 'sb_secret_media_test', STUDIO_OWNER: OWNER });
  delete process.env.STUDIO_ONLY_FOR;
  console.error = () => {};
  siteOwnerBurst.reset();
  files = new Map(); calls = []; doc = emptyDocument(); revision = 0;
  badSign = ''; down = false; rangeStream = false; readChunks = 0; cancelled = false;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)); calls.push({ url: url.href, init });
    assert.equal(url.origin, MEDIA_ORIGIN, 'no external upload URL is fetched');
    if (down) throw new Error('storage offline');
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop(), args = JSON.parse(init.body);
      if (name === 'site_content_get') return Response.json({ document: doc, revision, updatedAt: null });
      if (name === 'site_content_put') {
        if (args.p_revision !== revision) return Response.json({ ok: false, why: 'conflict', revision });
        doc = structuredClone(args.p_document); revision++;
        return Response.json({ ok: true, document: doc, revision, updatedAt: null });
      }
      throw new Error(`Unexpected database request ${name}`);
    }
    assert.equal(init.headers.apikey, 'sb_secret_media_test');
    assert.equal(init.headers.Authorization, undefined, 'new secret keys are not JWT bearer tokens');
    assert.equal(init.redirect, 'error');
    const path = url.pathname.split('/').pop();
    if (url.pathname.startsWith(`/storage/v1/object/upload/sign/${MEDIA_BUCKET}/`)) {
      assert.equal(init.method, 'POST'); assert.equal(init.headers['x-upsert'], 'false'); assert.deepEqual(JSON.parse(init.body), {});
      if (badSign === 'missing') return Response.json({ error: 'Bucket not found' }, { status: 404 });
      return Response.json({ url: badSign || `/object/upload/sign/${MEDIA_BUCKET}/${path}?token=fake.signed.upload.token` });
    }
    const file = files.get(path);
    if (!file) return Response.json({ error: 'not found' }, { status: 404 });
    if (url.pathname.startsWith(`/storage/v1/object/info/${MEDIA_BUCKET}/`)) return Response.json({ name: path, bucket_id: MEDIA_BUCKET, size: file.bytes.length, content_type: file.mime, ...(file.meta || {}) });
    assert.equal(url.pathname, `/storage/v1/object/${MEDIA_BUCKET}/${path}`);
    assert.equal(init.headers.Range, 'bytes=0-4095');
    if (rangeStream) {
      const first = Buffer.alloc(2048); PNG.copy(first);
      return new Response(new ReadableStream({
        pull(controller) { readChunks++; controller.enqueue(readChunks === 1 ? first : Buffer.alloc(2048)); },
        cancel() { cancelled = true; },
      }), { headers: { 'Content-Type': file.mime } });
    }
    return new Response(file.bytes.subarray(0, 4096), { status: 206, headers: { 'Content-Type': file.mime, ...(file.headers || {}) } });
  };
});
after(() => {
  globalThis.fetch = realFetch; console.error = realError;
  for (const key of ['PASS_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY','STUDIO_OWNER','STUDIO_ONLY_FOR']) {
    if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
  }
});
async function post(action, body = {}, session = token()) {
  const result = await POST(new Request('https://agi1.app/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '192.0.2.4' }, body: JSON.stringify({ action, session, ...body }) }));
  return { status: result.status, data: await result.json(), cache: result.headers.get('Cache-Control') };
}
async function upload(mime = 'image/png', bytes = PNG, name = 'new meme.png') {
  const started = await post('site-media-start', { name, mime, bytes: bytes.length });
  assert.equal(started.status, 200);
  files.set(started.data.path, { bytes, mime });
  const finished = await post('site-media-finish', { ticket: started.data.ticket });
  assert.equal(finished.status, 200);
  return { ...started.data, media: finished.data.media };
}
test('only the signed owner can start or finish uploads; no storage request otherwise', async () => {
  for (const action of ['site-media-start', 'site-media-finish']) {
    assert.equal((await post(action, {}, '')).status, 401);
    assert.equal((await post(action, {}, 'fake.signature')).status, 401);
    assert.equal((await post(action, {}, token(OTHER))).status, 403);
  }
  assert.equal(calls.length, 0);
});
test('signed uploads have unique fixed paths, bounded type/size, and no secrets in browser response', async () => {
  const request = { name: '../cute.png', mime: 'image/png', bytes: PNG.length };
  const one = await post('site-media-start', request), two = await post('site-media-start', request);
  assert.equal(one.status, 200); assert.notEqual(one.data.path, two.data.path);
  assert.match(one.data.id, /^upload-[a-f0-9-]{36}$/);
  assert.equal(one.data.publicUrl, `${MEDIA_PUBLIC_ROOT}${one.data.path}`);
  assert.equal(new URL(one.data.uploadUrl).pathname, `/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${one.data.path}`);
  assert.doesNotMatch(JSON.stringify(one.data), /sb_secret|Bearer|test-owner-media-secret/);
  assert.equal(one.cache, 'no-store');
  for (const body of [{ mime: 'image/svg+xml', bytes: 50 }, { mime: 'video/mp4', bytes: 50_000_001 }, { mime: 'image/png', bytes: 20_000_001 }, { mime: 'image/png', bytes: 0 }, { mime: 'image/png', bytes: -1 }]) assert.equal((await post('site-media-start', { name: 'x', ...body })).status, 400);
  assert.equal(calls.length, 2, 'invalid uploads do not call storage');
});
test('malicious signed destinations, bucket failures and wrong project configuration stay closed', async () => {
  const body = { name: 'x.png', mime: 'image/png', bytes: PNG.length };
  badSign = 'https://evil.test/put?token=any-token';
  assert.equal((await post('site-media-start', body)).status, 503);
  badSign = `/object/upload/sign/other-bucket/x.png?token=any-token`;
  assert.equal((await post('site-media-start', body)).status, 503);
  badSign = 'missing'; assert.equal((await post('site-media-start', body)).data.error, 'not_ready');
  process.env.SUPABASE_URL = 'https://different.supabase.co';
  assert.equal((await post('site-media-start', body)).data.error, 'not_ready');
});
test('completion requires the owner-bound unexpired ticket, stored size/MIME and real format header', async () => {
  const started = (await post('site-media-start', { name: 'hello.png', mime: 'image/png', bytes: PNG.length })).data;
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).data.error, 'upload_missing');
  files.set(started.path, { bytes: PNG, mime: 'text/html' });
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).data.error, 'upload_mismatch');
  files.set(started.path, { bytes: Buffer.alloc(PNG.length), mime: 'image/png' });
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).data.error, 'upload_mismatch');
  files.set(started.path, { bytes: PNG.subarray(1), mime: 'image/png' });
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).data.error, 'upload_mismatch');
  files.set(started.path, { bytes: PNG, mime: 'image/png' });
  const good = await post('site-media-finish', { ticket: started.ticket });
  assert.equal(good.status, 200); assert.ok(good.data.media.proof);
  assert.equal(good.data.media.title, 'hello');
  assert.equal((await post('site-media-finish', { ticket: started.ticket + 'x' })).data.error, 'invalid_upload');
  await assert.rejects(finishMediaUpload(getConfig(), { ticket: started.ticket }, OWNER, Date.now() + 2 * 3600_000 + 1), /expired/);
  await assert.rejects(finishMediaUpload(getConfig(), { ticket: started.ticket }, OTHER), /expired|invalid/);
});
test('uploaded image and video/poster records save through normal history API; public output has no proofs', async () => {
  const image = await upload();
  const video = await upload('video/mp4', MP4, 'clip.mp4');
  const memes = [image.media, { ...video.media, kind: 'slopcore', thumb: image.media.src, thumbProof: image.media.proof, secs: 12 }];
  const saved = await post('site-save', { revision: 0, document: { ...emptyDocument(), memes } });
  assert.equal(saved.status, 200); assert.equal(saved.data.document.memes.length, 2);
  const publicResponse = await GET(new Request('https://agi1.app/api/wallet?site-content'));
  const publicData = await publicResponse.json();
  assert.equal(publicData.document.memes[1].kind, 'slopcore');
  assert.equal(publicData.document.memes[1].thumb, image.media.src);
  assert.ok(Number.isSafeInteger(image.media.addedAt));
  assert.equal(publicData.document.memes[0].addedAt, image.media.addedAt);
  assert.doesNotMatch(JSON.stringify(publicData), /proof|ticket|sb_secret|Bearer/);
  assert.equal(validateDocument(publicData.document).ok, true, 'public documents need no private proof');
});

test('server-issued upload dates survive edits and cannot be changed or removed on save', async () => {
  const file = await upload();
  const media = file.media;
  assert.ok(Number.isSafeInteger(media.addedAt) && Math.abs(Date.now() - media.addedAt) < 10_000);
  const document = item => ({ ...emptyDocument(), memes: [item] });
  assert.equal((await post('site-save', { revision: 0, document: document({ ...media, addedAt: media.addedAt + 1 }) })).status, 400, 'new upload date is bound to its proof');
  assert.equal((await post('site-save', { revision: 0, document: document(media) })).status, 200);
  assert.equal((await post('site-save', { revision: 1, document: document({ ...media, title: 'Edited title' }) })).status, 200);
  assert.equal(doc.memes[0].addedAt, media.addedAt);
  const noDate = { ...media }; delete noDate.addedAt;
  for (const altered of [{ ...media, addedAt: media.addedAt + 1 }, noDate]) {
    assert.equal((await post('site-save', { revision: 2, document: document(altered) })).status, 400, 'saved dates are immutable');
  }
  assert.equal(doc.memes[0].addedAt, media.addedAt);
});
test('site-save rejects unconfirmed, changed-path and forged poster sources', async () => {
  const file = await upload();
  const bare = { ...file.media }; delete bare.proof;
  assert.equal((await post('site-save', { revision: 0, document: { ...emptyDocument(), memes: [bare] } })).status, 400);
  const forged = { ...file.media, proof: file.media.proof + 'x' };
  assert.equal((await post('site-save', { revision: 0, document: { ...emptyDocument(), memes: [forged] } })).status, 400);
  const other = await upload();
  const swapped = { ...file.media, id: other.media.id, src: other.media.src };
  assert.equal((await post('site-save', { revision: 0, document: { ...emptyDocument(), memes: [swapped] } })).status, 400);
  const cover = { ...file.media, thumb: other.media.src };
  assert.equal((await post('site-save', { revision: 0, document: { ...emptyDocument(), memes: [cover] } })).status, 400);
  assert.equal(revision, 0);
});
test('existing uploads remain editable after signing-key rotation, while newly claimed files still need proof', async () => {
  const file = await upload();
  assert.equal((await post('site-save', { revision: 0, document: { ...emptyDocument(), memes: [file.media] } })).status, 200);
  process.env.PASS_SECRET = 'a-new-signing-secret-with-more-than-32-characters';
  const edited = { ...file.media, title: 'New title after rotation', hidden: true };
  assert.equal((await post('site-save', { revision: 1, document: { ...emptyDocument(), memes: [edited] } })).status, 200);
  assert.equal(doc.memes[0].title, edited.title);
  const forgedNew = { ...file.media, id: 'upload-22222222-2222-4222-8222-222222222222', src: `${MEDIA_PUBLIC_ROOT}22222222-2222-4222-8222-222222222222.png` };
  assert.equal((await post('site-save', { revision: 2, document: { ...emptyDocument(), memes: [edited, forgedNew] } })).status, 400);
});
test('built-in media stays immutable, can change video category and can be hidden without leaking its text', () => {
  const normalized = validateDocument({ ...emptyDocument(), memes: [{ id: 'only-agi', kind: 'slopcore', title: 'Renamed', hidden: true }] });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.document.memes[0].src, '/memes/videos/agi-only-agi.mp4');
  assert.deepEqual(publicDocument(normalized.document).memes, [{ id: 'only-agi', custom: false, hidden: true }]);
  for (const value of [{ id: 'invented' }, { id: 'only-agi', kind: 'image' }, { id: 'only-agi', src: '/evil.mp4' }, { id: 'only-agi', thumb: '/other.webp' }]) assert.equal(validateDocument({ ...emptyDocument(), memes: [value] }).ok, false);
  assert.deepEqual(validateDocument(emptyDocument()).document, emptyDocument(), 'older documents keep their shape');
});
test('hidden custom media is omitted and media URLs reject other buckets, hosts, query strings and paths', async () => {
  const file = await upload();
  const validated = validateDocument({ ...emptyDocument(), memes: [{ ...file.media, hidden: true }] });
  assert.equal(validated.ok, true); assert.deepEqual(publicDocument(validated.document).memes, []);
  assert.equal(safeMemeUrl(file.media.src), true);
  for (const url of [file.media.src + '?x=1', file.media.src.replace(MEDIA_BUCKET, 'agi1-characters'), file.media.src.replace('vujaxukucukjxzhcxlea', 'evil'), `${MEDIA_PUBLIC_ROOT}../x.png`, 'https://example.com/x.png']) assert.equal(safeMemeUrl(url), false, url);
});
test('format checks exclude SVG, HTML and HEIC disguised as MP4; range checking cancels ignored large bodies', async () => {
  assert.equal(matchesMediaHeader('image/png', Buffer.from('<svg></svg>')), false);
  assert.equal(matchesMediaHeader('video/mp4', Buffer.from('000000186674797068656963000002006865696368656963', 'hex')), false);
  assert.equal(matchesMediaHeader('video/mp4', MP4), true);
  const started = (await post('site-media-start', { name: 'x.png', mime: 'image/png', bytes: PNG.length })).data;
  files.set(started.path, { bytes: PNG, mime: 'image/png' }); rangeStream = true;
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).status, 200);
  assert.equal(cancelled, true); assert.ok(readChunks <= 3, 'never reads a whole ignored-range response');
});
test('compressed or wrong object metadata is refused and upstream outages do not publish anything', async () => {
  const started = (await post('site-media-start', { name: 'x.png', mime: 'image/png', bytes: PNG.length })).data;
  files.set(started.path, { bytes: PNG, mime: 'image/png', meta: { content_encoding: 'gzip' } });
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).status, 400);
  files.set(started.path, { bytes: PNG, mime: 'image/png', meta: { bucket_id: 'other' } });
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).status, 400);
  down = true;
  assert.equal((await post('site-media-finish', { ticket: started.ticket })).status, 503);
  assert.equal(revision, 0);
});
