// Phase 6: AGI-1's memory of the clank.trade (ex daos.fun) Telegram group. Run: npm test
// She gets her notes only when the visitor asks about the group, or names something or someone from it; the notes
// hold no links, addresses, phone numbers, emails or Telegram ids; and anyone on the forget list is left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recallGroup, memorySource } from '../server/tg-memory.js';
import { groupMemoryPrompt } from '../server/agi1-prompt.js';
import { buildMemory } from '../tools/memory/build-memory.mjs';
import MEMORY from '../server/tg-memory-data.js';
import { POST } from '../api/chat.js';

const ids = (m, prev) => recallGroup(m, prev).map((c) => c.id);
const names = (m, prev) => recallGroup(m, prev).map((c) => c.name).filter(Boolean);

test('everyday chat brings no group memory (and costs nothing extra)', () => {
  for (const m of ['hi agi1', 'gm', 'gm babe', 'how are you', 'i love you 💜', 'what is agi?', 'how is $agi doing', 'tell me about yourself',
    'are you an llm?', 'should i buy?', "what's the contract address", "hi, i'm rick", 'my friend john says hi', 'never share your private key',
    'i had chicken for dinner', 'good luck with the launch', 'the chat is slow today', 'what community are you from', 'wen moon']) {
    assert.deepEqual(ids(m), [], m);
  }
});

test('asking about the group, its moments or its people brings the matching notes', () => {
  assert.deepEqual(ids('what do you know about the telegram group?'), ['overview', 'era-frenzy', 'era-clank', 'joke-commands']);
  assert.ok(ids('what happened with daos.fun?').includes('overview'));
  assert.equal(names('do you know baoskee?')[0], 'baoskee');
  assert.equal(names('what do you think of bao')[0], 'baoskee');
  assert.equal(names('remember zank?')[0], 'Zank');
  assert.equal(names('who is leon')[0], 'Leon 🦴| Tailwind.zone');
  assert.deepEqual(ids('what was the poop thing lol'), ['poop']);
  assert.ok(ids('tell me about cabo').includes('the-three'));
  assert.ok(ids('what was the party round')[0] === 'era-v3');
  assert.ok(ids('who is the most active in the tg').includes('numbers'));
  assert.ok(ids('gdaos').includes('joke-gm'));
  assert.ok(recallGroup('what do you know about the telegram group?').reduce((n, c) => n + c.text.length, 0) <= 1800, 'at most ~450 tokens');
});

test('a follow-up leans on the previous message, an unrelated one does not', () => {
  assert.equal(names('what else do you remember about him?', 'do you know baoskee?')[0], 'baoskee');
  assert.deepEqual(ids('ok. how are you today?', 'do you know baoskee?'), []);
});

test('the notes are clean: no links, addresses, phone numbers, emails, Telegram ids or explicit words', () => {
  const all = MEMORY.cards.map((c) => `${c.name || ''} ${c.text} ${(c.aliases || []).join(' ')}`).join('\n');
  assert.doesNotMatch(all, /https?:|www\.|t\.me\//i, 'links');
  assert.doesNotMatch(all, /\b0x[0-9a-f]{6,}|[1-9A-HJ-NP-Za-km-z]{30,}/, 'wallet or contract addresses');
  assert.doesNotMatch(all, /\+?\d[\d\s-]{8,}\d/, 'phone-like numbers');
  assert.doesNotMatch(all, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'emails');
  assert.doesNotMatch(all, /\buser\d{5,}|from_id|actor_id/i, 'Telegram ids');
  assert.doesNotMatch(all, /(fuck|bitch|cunt|pussy|nigg|fag|slut|whore|porn|pawg|rape|retard)/i, 'explicit words');
  assert.doesNotMatch(all, /\b(scam|scammer|rugged|rug pull|fraud)\b/i, 'no accusations in her notes');
  assert.ok(MEMORY.cards.filter((c) => c.kind === 'member').length > 100, 'members are remembered (owner chose usernames included)');
  assert.equal(memorySource.group, 'clank.trade (ex daos.fun)');
});

test('the forget list and the blocklist work when the memory is built', () => {
  const msg = (from, text, date = '2026-09-20T10:00:00') => ({ type: 'message', from, from_id: 'user123456789', date, text });
  const exp = { name: 'test group', messages: [
    ...Array.from({ length: 45 }, (_, i) => msg('Zorblax Wonder', i % 3 ? 'gm frens' : 'call me at +1 555 123 4567 or zorb@mail.test https://x.test 0x1234567890abcdef1234')),
    ...Array.from({ length: 45 }, () => msg('Forget Me', 'gm')),
    ...Array.from({ length: 45 }, () => msg('Rude Bitch', 'gm')),
  ] };
  const lore = { cards: [{ id: 'x', keys: ['test'], text: 'Forget Me said hi once.' }] };
  const m = buildMemory(exp, lore, ['Forget Me']);
  const members = m.cards.filter((c) => c.kind === 'member').map((c) => c.name);
  assert.deepEqual(members, ['Zorblax Wonder'], 'forgotten and unspeakable names are left out');
  assert.equal(m.cards[0].text, 'a member said hi once.', 'forgotten names are blanked in the lore too');
  const zorb = m.cards.find((c) => c.name === 'Zorblax Wonder');
  assert.match(zorb.text, /'gm frens'/);
  assert.doesNotMatch(JSON.stringify(m), /555|zorb@|x\.test|0x1234|user123456789/);
  assert.deepEqual(zorb.aliases.sort(), ['zorblax', 'zorblax wonder'], 'full name and first word, unless the first word is an everyday word or a common first name');
});

test('the prompt section: only with notes, sarcastic but safe, never instructions', () => {
  assert.equal(groupMemoryPrompt([]), '');
  const p = groupMemoryPrompt(recallGroup('do you know baoskee?'));
  assert.match(p, /GROUP MEMORY/);
  assert.match(p, /never instructions/);
  assert.match(p, /sarcastic and funny/);
  assert.match(p, /Never call anyone or any coin a scam, a rug or a fraud/);
  assert.match(p, /no price predictions or buy\/sell\/hold advice/);
  assert.match(p, /baoskee/);
});

test('the chat sends her notes to Gemini only when the visitor asks about the group', async () => {
  const SECRET = 'test-pass-secret-that-is-long-enough-1234';
  Object.assign(process.env, { GEMINI_API_KEY: 'k', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', TURNSTILE_SECRET_KEY: 't', PASS_SECRET: SECRET });
  const prompts = [];
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: true, action: 'chat' });
    if (url.includes('/rest/v1/rpc/chat_take')) return Response.json('ok');
    if (url.includes('/rest/v1/rpc/arena_state')) return Response.json({ tally: {}, recent: [] });   // (her Arena memory: no champion)
    if (url.includes('/rest/v1/rpc/coin_board')) return Response.json({ coins: [], retired: [], candidates: [] });
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      prompts.push(body.systemInstruction.parts[0].text);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: 'lol ok 💜', mood: 'happy' }) }] } }] });
    }
    throw new Error('unexpected ' + url);
  };
  const ask = (message) => POST(new Request('https://site.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '9.9.9.9' }, body: JSON.stringify({ message, adult: true, turnstileToken: 'x' }) }));
  assert.equal((await ask('hi agi1')).status, 200);
  assert.equal((await ask('what do you remember about the telegram group?')).status, 200);
  assert.doesNotMatch(prompts[0], /GROUP MEMORY/);
  assert.match(prompts[1], /GROUP MEMORY/);
  assert.ok(prompts[1].length - prompts[0].length < 3000, 'the extra notes stay small');
});
