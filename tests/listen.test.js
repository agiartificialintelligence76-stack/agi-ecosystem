// Voice chat (src/chat/listen.js, 2026-09-25): the browser's speech recognition, wrapped for one message at a time.
// A fake recognizer stands in for the browser's, so every way a message can end is checked.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { canListen, cleanHeard, listenOnce } from '../src/chat/listen.js';

// A stand-in for the browser's SpeechRecognition: each test says what it "hears".
function fakeBrowser({ throwsOnNew = false, throwsOnStart = false } = {}) {
  const made = [];
  class FakeRecognition {
    constructor() {
      if (throwsOnNew) throw new Error('not here');
      this.started = false; this.stopped = false; this.aborted = false;
      made.push(this);
    }
    start() { if (throwsOnStart) throw new Error('InvalidStateError'); this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; this.onerror?.({ error: 'aborted' }); this.onend?.(); }
    // test helpers: words arrive (interim or final), an error, the end
    say(...parts) { this.onresult?.({ results: parts.map((t) => [{ transcript: t }]) }); }
    fail(error) { this.onerror?.({ error }); }
    end() { this.onend?.(); }
  }
  return { w: { webkitSpeechRecognition: FakeRecognition, isSecureContext: true }, made };
}

test('who can listen: a browser with speech recognition, on a secure page', () => {
  assert.equal(canListen({ webkitSpeechRecognition: function () {}, isSecureContext: true }), true);
  assert.equal(canListen({ SpeechRecognition: function () {}, isSecureContext: true }), true);
  assert.equal(canListen({ isSecureContext: true }), false, 'Firefox: no recognizer, no mic button');
  assert.equal(canListen({ webkitSpeechRecognition: function () {}, isSecureContext: false }), false, 'not on http');
});

test('what she heard is tidied, and noise counts as nothing', () => {
  assert.equal(cleanHeard('  hi   agi1 \n how are you  '), 'hi agi1 how are you');
  assert.equal(cleanHeard('ok'), 'ok');
  assert.equal(cleanHeard('a'), '', 'one letter is noise');
  assert.equal(cleanHeard(' ... '), '', 'no letters or digits');
  assert.equal(cleanHeard(null), '');
  assert.equal(cleanHeard('ab '.repeat(300)).length, 500, 'at most 500 characters, like a typed message');
  assert.equal(cleanHeard('héllo 你好'), 'héllo 你好', 'any language');
});

test('one message: set up for English, words show while you speak, the whole message when you stop', async () => {
  const { w, made } = fakeBrowser();
  const seen = [];
  const h = listenOnce({ onWords: (t) => seen.push(t) }, w);
  const r = made[0];
  assert.equal(r.started, true);
  assert.equal(r.lang, 'en-US');
  assert.equal(r.continuous, false, 'one message at a time: it ends by itself when you stop');
  assert.equal(r.interimResults, true, 'words appear as you say them');
  r.say('hi');
  r.say('hi', ' agi1 how are you');
  r.end();
  assert.deepEqual(await h.done, { text: 'hi agi1 how are you', reason: 'heard' });
  assert.deepEqual(seen, ['hi', 'hi agi1 how are you']);
});

test('nothing said, blocked, no microphone, offline: nothing is sent, and she can say why', async () => {
  for (const [error, reason] of [['no-speech', 'silence'], ['not-allowed', 'denied'], ['service-not-allowed', 'denied'],
    ['audio-capture', 'no-mic'], ['network', 'offline'], ['language-not-supported', 'unavailable'], ['something-new', 'error']]) {
    const { w, made } = fakeBrowser();
    const h = listenOnce({}, w);
    made[0].fail(error);
    made[0].end();
    assert.deepEqual(await h.done, { text: '', reason }, error);
  }
  const { w, made } = fakeBrowser();
  const h = listenOnce({}, w);
  made[0].say('a');                                      // only noise, then the end
  made[0].end();
  assert.deepEqual(await h.done, { text: '', reason: 'silence' });
});

test('"done talking" sends what was heard; cancelling throws it away', async () => {
  let { w, made } = fakeBrowser();
  let h = listenOnce({}, w);
  made[0].say('so about that coin');
  h.stop();
  assert.equal(made[0].stopped, true, 'the recognizer is told to finish');
  made[0].end();
  assert.deepEqual(await h.done, { text: 'so about that coin', reason: 'heard' });

  ({ w, made } = fakeBrowser());
  const seen = [];
  h = listenOnce({ onWords: (t) => seen.push(t) }, w);
  made[0].say('never mind');
  h.cancel();
  assert.equal(made[0].aborted, true);
  assert.deepEqual(await h.done, { text: '', reason: 'stopped' });
  made[0].say('late words');                             // anything arriving afterwards is ignored
  assert.deepEqual(seen, ['never mind']);
});

test('a browser that refuses to start listening → "unavailable", right away', async () => {
  for (const opts of [{ throwsOnNew: true }, { throwsOnStart: true }]) {
    const { w } = fakeBrowser(opts);
    const h = listenOnce({}, w);
    assert.deepEqual(await h.done, { text: '', reason: 'unavailable' }, JSON.stringify(opts));
    h.stop(); h.cancel();                                // harmless afterwards
  }
});

test('a recognizer that never ends by itself is stopped after 30 s, and given up on 3 s later', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { w, made } = fakeBrowser();
    const h = listenOnce({}, w);
    made[0].say('i keep talking and talking');
    mock.timers.tick(29_999);
    assert.equal(made[0].stopped, false);
    mock.timers.tick(1);
    assert.equal(made[0].stopped, true, 'told to finish after 30 s');
    mock.timers.tick(3000);                              // …and it still didn't end: what was heard is used
    assert.deepEqual(await h.done, { text: 'i keep talking and talking', reason: 'heard' });
  } finally {
    mock.timers.reset();
  }
});
