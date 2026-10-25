import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startMediaUpload, finishMediaUpload } from '../server/site-media.js';
import { MEDIA_BUCKET, MEDIA_ORIGIN, MEDIA_PUBLIC_ROOT, mediaPath, safeMemeUrl, validateMemes } from '../src/owner/media-model.js';
import { MEMES } from '../src/memes/list.js';

const UUID = 'abcdef12-1111-4111-8111-111111111111';
const cfg = { supabaseUrl: MEDIA_ORIGIN, supabaseKey: 'sb_secret_security_test', passSecret: 'media-security-test-secret-at-least-32-characters' };
const OWNER = '0x1111111111111111111111111111111111111111';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1cAAAAASUVORK5CYII=', 'base64');

test('media destinations reject URL normalization tricks and executable file families', () => {
  const valid = `${MEDIA_PUBLIC_ROOT}${UUID}.png`;
  assert.equal(mediaPath(valid), `${UUID}.png`);
  const rejected = [
    valid + '#fragment', valid + '?download=other.png', valid + '/', valid + '\n',
    valid.replace('.png', '.PNG'), valid.replace('.png', '.svg'), valid.replace('.png', '.html'),
    valid.replace(UUID, UUID.toUpperCase()),
    valid.replace('/public/', '/public/../public/'),
    valid.replace('/public/', '/public/%2e%2e/public/'),
    valid.replace(UUID, `%31${UUID.slice(1)}`),
    valid.replace(MEDIA_ORIGIN, MEDIA_ORIGIN + '.evil.test'),
    valid.replace(MEDIA_ORIGIN, MEDIA_ORIGIN.replace('https://', 'https://user:pass@')),
    valid.replace(MEDIA_ORIGIN, MEDIA_ORIGIN.replace('https:', 'http:')),
    valid.replace(`${MEDIA_BUCKET}/`, `${MEDIA_BUCKET}2/`),
    `//${new URL(valid).host}${new URL(valid).pathname}`,
  ];
  for (const url of rejected) assert.equal(safeMemeUrl(url), false, url);
  assert.equal(safeMemeUrl(`${MEDIA_PUBLIC_ROOT}${UUID}.webm`, { imageOnly: true }), false);
});

test('MIME properties inherited from Object cannot reach the signing service', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('must not reach storage'); };
  try {
    for (const mime of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', ['image/png'], {}, null]) {
      await assert.rejects(startMediaUpload(cfg, { name: 'x.png', bytes: 100, mime }, OWNER), (error) => error.status === 400);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('completion never trusts caller-controlled user metadata for missing object size or MIME', async () => {
  const original = globalThis.fetch;
  let metadata, signedPath, byteReads = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(init.headers.apikey, cfg.supabaseKey);
    assert.equal(init.headers.Authorization, undefined);
    const url = new URL(input);
    assert.equal(url.origin, MEDIA_ORIGIN);
    if (url.pathname.includes('/upload/sign/')) {
      signedPath = url.pathname.split('/').pop();
      return Response.json({ url: `/object/upload/sign/${MEDIA_BUCKET}/${signedPath}?token=fixture.signed.token` });
    }
    if (url.pathname.includes('/object/info/')) return Response.json({ name: signedPath, bucket_id: MEDIA_BUCKET, ...metadata });
    byteReads++;
    return new Response(png, { status: 206 });
  };
  try {
    const started = await startMediaUpload(cfg, { name: 'x.png', mime: 'image/png', bytes: png.length }, OWNER);
    // Storage InfoRenderer's `metadata` property is obj.user_metadata, not trusted S3 metadata.
    // https://github.com/supabase/storage/blob/master/src/storage/renderer/info.ts
    for (const incomplete of [
      { size: null, content_type: 'image/png' },
      { size: png.length, content_type: null },
      {},
    ]) {
      metadata = { ...incomplete, metadata: { size: png.length, contentLength: png.length, mimetype: 'image/png' } };
      await assert.rejects(finishMediaUpload(cfg, { ticket: started.ticket }, OWNER), (error) => error.error === 'upload_mismatch');
    }
    assert.equal(byteReads, 0, 'incomplete authoritative metadata is refused before byte checking');
  } finally { globalThis.fetch = original; }
});

test('gallery records reject type confusion and a URL that does not belong to its upload ID', () => {
  const base = { id: `upload-${UUID}`, custom: true, kind: 'image', src: `${MEDIA_PUBLIC_ROOT}${UUID}.png`, thumb: '', title: 'Safe plain title' };
  assert.equal(validateMemes([base], MEMES).length, 1);
  for (const change of [
    { custom: 'true' }, { hidden: 'false' }, { kind: 'video' }, { secs: '0' },
    { src: `${MEDIA_PUBLIC_ROOT}22222222-2222-4222-8222-222222222222.png` },
    { thumb: `${MEDIA_PUBLIC_ROOT}${UUID}.mp4` }, { proof: {} }, { title: 'NUL\0text' },
  ]) assert.throws(() => validateMemes([{ ...base, ...change }], MEMES));
  assert.throws(() => validateMemes([base, base], MEMES), /unique/);
});

test('CSP adds only the exact media bucket and signing path while preserving every existing directive', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers.flatMap((entry) => entry.headers).find((header) => header.key === 'Content-Security-Policy').value;
  const directives = Object.fromEntries(csp.split(';').map((value) => value.trim()).filter(Boolean).map((value) => {
    const [key, ...sources] = value.split(/\s+/);
    return [key, sources];
  }));
  assert.deepEqual(directives, {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://challenges.cloudflare.com'],
    'worker-src': ["'self'", 'blob:'],
    'style-src': ["'self'"],
    'font-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://live.agi1.app', MEDIA_PUBLIC_ROOT],
    'media-src': ["'self'", 'blob:', MEDIA_PUBLIC_ROOT],
    'connect-src': ["'self'", 'blob:', 'https://api.dexscreener.com', 'wss://live.agi1.app', `${MEDIA_ORIGIN}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/`],
    'frame-src': ["'self'", 'https://challenges.cloudflare.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
    'upgrade-insecure-requests': [],
  });
});
