// Phase 5: share posts, share pages (link previews) and voice replies. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as texts from '../src/share/texts.js';
import { allSharePages, siteUrl, neededCards } from '../scripts/share-pages.js';
import { speakable } from '../src/chat/voice.js';

const { levelPost, diaryPost, intentUrl, postLength, levelLink, diaryLink } = texts;

const MONEY = /\b(buy|sell|invest\w*|pump\w*|moon\w*|profit\w*|gains?|hodl|100x|lambo|price)\b/i;

test('every ready-made post fits in one X post and never talks money', () => {
  const posts = [
    levelPost(1), levelPost(2), levelPost(3),
    diaryPost('Sep 25', 'dear diary 💜 '.repeat(80)),
    diaryPost('Sep 25', 'short one 🙈'),
  ];
  for (const p of posts) {
    assert.ok(postLength(p) <= 280, `${postLength(p)}: ${p}`);
    assert.doesNotMatch(p, MONEY, p);
  }
  assert.equal(texts.championPost, undefined, 'no champion posts: the Arena left the site (2026-09-28)');
  assert.match(levelPost(2), /Crush/);
  assert.match(levelPost(3), /Soulmate/);
  assert.match(levelPost(1), /strangers/);
  const long = diaryPost('Sep 25', 'a'.repeat(400));
  assert.ok(long.startsWith("AGI-1's diary, Sep 25: “") && long.endsWith('…” 💜'), 'long entries are shortened, not cut off mid-quote');
  assert.equal(diaryPost('Sep 25', 'short 💜'), "AGI-1's diary, Sep 25: “short 💜” 💜");
});

test('Share on X only opens X\'s new-post box, filled in; the visitor posts it themselves', () => {
  const url = new URL(intentUrl('hi 💜 & you', 'https://site.test/diary'));
  assert.equal(url.origin + url.pathname, 'https://x.com/intent/tweet');
  assert.equal(url.searchParams.get('text'), 'hi 💜 & you');
  assert.equal(url.searchParams.get('url'), 'https://site.test/diary');
  assert.deepEqual([...url.searchParams.keys()], ['text', 'url'], 'no account to follow, nothing else');
  assert.equal(levelLink('https://s.t', 3), 'https://s.t/share/level-soulmate');
  assert.equal(diaryLink('https://s.t'), 'https://s.t/diary');
});

test('share pages: a link preview for every level, with full addresses; people are sent on by a script file', () => {
  const pages = allSharePages('https://agi1.app');
  assert.deepEqual(Object.keys(pages).sort(), ['level-crush', 'level-soulmate', 'level-stranger'], 'no champion pages (the Arena left the site)');
  for (const [name, html] of Object.entries(pages)) {
    assert.match(html, new RegExp(`<meta property="og:image" content="https://agi1.app/cards/${name}.png">`), name);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/agi1.app\/#playground">/);
    assert.match(html, /<html lang="en" data-go="\/#playground">/);
    assert.match(html, /<script src="\/share\/go.js"><\/script>/);
    assert.doesNotMatch(html, /<script>|style=|<style/, 'no inline scripts or styles (the security rules block them)');
    assert.match(html, /not financial advice/i);
  }
  for (const f of neededCards()) assert.ok(existsSync(new URL(`../public/cards/${f}`, import.meta.url)), `public/cards/${f} exists`);
  assert.ok(!neededCards().some((f) => f.startsWith('champion-')));
});

test('the site address for previews comes from Vercel (so the domain switch needs no code change)', () => {
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'agi1.app' }), 'https://agi1.app');
  assert.equal(siteUrl({ SITE_URL: 'https://x.test/', VERCEL_PROJECT_PRODUCTION_URL: 'y.test' }), 'https://x.test');
  assert.equal(siteUrl({}), 'https://agi1.app');
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  assert.match(diary, /<meta property="og:image" content="__SITE__\/cards\/diary.png" \/>/);
});

test('share pages send people only to our own pages', () => {
  const code = readFileSync(new URL('../public/share/go.js', import.meta.url), 'utf8');
  const run = (go) => {
    let went = null;
    new Function('document', 'location', code)({ documentElement: { getAttribute: () => go } }, { replace: (u) => { went = u; } });
    return went;
  };
  assert.equal(run('/#playground'), '/#playground');
  assert.equal(run('//evil.test'), '/');
  assert.equal(run('https://evil.test'), '/');
  assert.equal(run(null), '/');
});

test('voice: she reads her words, not the emojis', () => {
  assert.equal(speakable('hi cutie 💜 what\'s up? 🙈'), "hi cutie what's up?");
  assert.equal(speakable('look [link removed] here'), 'look here');
  assert.equal(speakable('👩‍❤️‍👨💜'), '');
});
