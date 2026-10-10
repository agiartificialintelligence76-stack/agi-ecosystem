// Her pop-out window (2026-10-02, the owner: "yeah build that", the free next step of the AGI-1 app: "she will appear on my
// screen as well"). A small window with AGI-1 and her chat that stays on top of the visitor's other windows (the browser's
// Document Picture-in-Picture), holding full-screen talk in a frame: agi1.app/talk?pip=1 (src/chat/popout.js). These checks
// keep its address, who may open it, the frame headers (our own pages only, never another site), /theme.js's mark, the
// buttons and the page's card, the window itself with a stand-in browser, and what the chat, full-screen talk and the looks
// do while she's out. The real window is checked in a real browser (Claude's scratch popouttest.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html');
const tick = () => new Promise((r) => setImmediate(r));

// the light DOM src/theme.js reads when it's imported in Node (popout.js paints her window with its colors): Pop mode, at night
globalThis.document ??= { documentElement: { dataset: { skin: 'pop', theme: 'dark' }, classList: { contains: () => false } }, querySelector: () => null, querySelectorAll: () => [] };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
// a page of its own (not in a frame), at the site's address, with the page's events and scrolling
const bus = new EventTarget();
globalThis.addEventListener = bus.addEventListener.bind(bus);
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);
globalThis.location = { origin: 'https://www.agi1.app', search: '?dev' };
globalThis.window = globalThis;
globalThis.top = globalThis;
globalThis.self = globalThis;
let focusCalls = 0;
globalThis.focus = () => { focusCalls += 1; };

test('her window\'s page: full-screen talk marked as the pop-out, with what the page\'s address carries', async () => {
  const { popoutUrl, POP_SIZE } = await import('../src/chat/popout.js');
  const at = (search) => popoutUrl({ origin: 'https://www.agi1.app', search });
  assert.equal(at(''), 'https://www.agi1.app/talk?pip=1');
  assert.equal(at(undefined), 'https://www.agi1.app/talk?pip=1');
  assert.equal(at('?dev'), 'https://www.agi1.app/talk?dev&pip=1', '?dev comes along (the tests)');
  assert.equal(at('?pip=1'), 'https://www.agi1.app/talk?pip=1', 'never twice');
  assert.equal(at('?pip&dev'), 'https://www.agi1.app/talk?dev&pip=1');
  assert.equal(at('?dev&pip=0&x=1'), 'https://www.agi1.app/talk?dev&x=1&pip=1', 'its own mark, whatever was there');
  assert.equal(at('?pipe=1'), 'https://www.agi1.app/talk?pipe=1&pip=1', 'only pip itself');
  assert.equal(popoutUrl({ origin: 'http://localhost:4173', search: '' }), 'http://localhost:4173/talk?pip=1', 'the page\'s own address, wherever it is (our own pages only may be framed)');
  assert.deepEqual(POP_SIZE, { width: 400, height: 660 }, 'about a phone\'s size: her on top, the chat under her');
});

test('who can pop her out: a page of its own, in a browser with Document Picture-in-Picture (never a page inside a frame)', async () => {
  const { canPopOut } = await import('../src/chat/popout.js');
  const page = (api = { requestWindow: async () => ({}) }) => { const w = { documentPictureInPicture: api }; w.top = w; w.self = w; return w; };
  assert.equal(canPopOut(page()), true, 'Chrome and Edge 116+, Firefox 151+ on computers');
  assert.equal(canPopOut(page(null)), false, 'Safari and phones: no such window');
  assert.equal(canPopOut(page({})), false);
  assert.equal(canPopOut(page({ requestWindow: 'yes' })), false);
  const framed = page();
  framed.top = {};
  assert.equal(canPopOut(framed), false, 'a page in a frame (her window\'s own page): never a window from there');
  const blocked = page();
  Object.defineProperty(blocked, 'top', { get() { throw new Error('a cross-origin frame'); } });
  assert.equal(canPopOut(blocked), false, 'can\'t tell: no');
  delete globalThis.top;
  assert.equal(canPopOut(), false, 'Node has none');
  globalThis.top = globalThis;
});

test('our own pages may frame each other (her window holds her page), never another site\'s', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const all = vercel.headers.find((h) => h.source === '/(.*)').headers;
  const header = (key) => all.find((h) => h.key === key)?.value;
  const csp = header('Content-Security-Policy');
  const dir = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  assert.equal(dir('frame-ancestors'), "frame-ancestors 'self'", 'only a page of ours may frame one of ours');
  assert.equal(dir('frame-src'), "frame-src 'self' https://challenges.cloudflare.com", 'our own page (her window) and the human check, nothing else');
  assert.equal(header('X-Frame-Options'), 'SAMEORIGIN', 'older browsers: the same');
  assert.doesNotMatch(csp, /\*|child-src/, 'no wildcard anywhere');
  for (const h of vercel.headers) {
    for (const { key, value } of h.headers) {
      if (key === 'X-Frame-Options') assert.equal(value, 'SAMEORIGIN', `${h.source}: never framed by another site`);
      if (key === 'Content-Security-Policy') assert.doesNotMatch(value, /frame-ancestors (?!'self')/, `${h.source}: never framed by another site`);
    }
  }
  // her mic and calls work in her window's frame: the mic for our own pages only (the frame asks with allow="microphone");
  // the camera (2026-10-10: the studio's live selfie) for our own pages only too, never another site's frame
  assert.equal(header('Permissions-Policy'), 'camera=(self), microphone=(self), geolocation=(), display-capture=(self)');
});

// /theme.js (runs in <head>) in a sandbox, inside a frame or not
function prepaint({ path = '/talk', search = '', framed = true, page = 'home', parentThrows = false }) {
  const attrs = { 'data-page': page };
  const classes = new Set();
  const doc = { title: 'Introducing AGI · Artificial Girlfriend Intelligence' };
  const meta = { content: '', setAttribute(k, v) { this[k] = v; } };
  const root = {
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) },
  };
  Object.assign(doc, { documentElement: root, querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null) });
  const win = {};
  if (parentThrows) Object.defineProperty(win, 'parent', { get() { throw new Error('blocked'); } });
  else win.parent = framed ? {} : win;
  vm.runInNewContext(read('public/theme.js'), {
    localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null },
    location: { pathname: path, search, hash: '' }, setTimeout: () => {}, document: doc, window: win,
  });
  return { classes, title: doc.title, bar: meta.content };
}

test('/theme.js: her window\'s page is full-screen talk marked .is-pip before it paints, and only inside a frame', () => {
  for (const [path, search] of [['/talk', '?pip=1'], ['/talk/', '?dev&pip=1'], ['/talk', '?pip=1&dev']]) {
    const got = prepaint({ path, search });
    assert.deepEqual([...got.classes].sort(), ['is-pip', 'is-talk'], `${path}${search}`);
    assert.equal(got.title, 'Talk to AGI-1 · AGI');
    assert.equal(got.bar, '#1a0d3d', 'the color around her');
  }
  for (const search of ['?pip=10', '?xpip=1', '?pip', '']) assert.deepEqual([...prepaint({ search }).classes], ['is-talk'], `"${search}": full-screen talk, not the pop-out`);
  assert.deepEqual([...prepaint({ search: '?pip=1', framed: false }).classes], ['is-talk'], 'a page of its own: never believed (someone typed it)');
  assert.deepEqual([...prepaint({ search: '?pip=1', parentThrows: true }).classes], ['is-talk'], 'can\'t tell: the page as usual');
  const home = prepaint({ path: '/', search: '?pip=1' });
  assert.ok(!home.classes.has('is-pip') && !home.classes.has('is-talk'), 'only at /talk');
  assert.equal(prepaint({ path: '/talk', search: '?pip=1', page: 'diary' }).classes.size, 0, 'only the home page');
});

test('the buttons: "Pop her out" in the Playground\'s heading, on her picture in full-screen talk and in the app\'s screen, hidden until this browser can', () => {
  const buttons = html.match(/<button [^>]*data-popout[^>]*>/g) || [];
  assert.equal(buttons.length, 3);
  for (const b of buttons) {
    assert.match(b, /type="button"/);
    assert.match(b, / hidden>$/, 'hidden until src/chat/popout.js finds the browser can (Safari, phones: never shown)');
  }
  // the heading: between "Talk full screen" and "Get the AGI-1 app"
  const at = html.indexOf('<div class="pg-head-actions">');
  const head = html.slice(at, html.indexOf('</div>', at));
  assert.ok(head.indexOf('data-talk-open') < head.indexOf('data-popout') && head.indexOf('data-popout') < head.indexOf('data-app-open'));
  assert.match(head, /data-popout hidden><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">[^]*?<\/svg>Pop her out<\/button>/);
  // on her picture in full-screen talk: an icon with its words for screen readers, after "Get the app"
  const ctlAt = html.indexOf('<div class="pg-talk-ctl"');
  const ctl = html.slice(ctlAt, html.indexOf('</div>', ctlAt));
  assert.match(ctl, /<button class="pg-talk-btn" type="button" data-popout aria-label="Pop her out: a small window that stays on top" title="Pop her out" hidden>/);
  assert.ok(ctl.indexOf('data-app-open') < ctl.indexOf('data-popout') && ctl.indexOf('data-popout') < ctl.indexOf('data-talk-fs'));
  // the app's screen: the same thing right now, without installing anything
  const dlgAt = html.indexOf('data-app-dialog');
  const dlg = html.slice(dlgAt, html.indexOf('</dialog>', dlgAt));
  assert.match(dlg, /<div class="appdlg-pop" data-appdlg-pop hidden>\s*<p class="appdlg-text">Or pop her out right now: a small window with her that stays on top of your other windows while you work\.<\/p>\s*<button class="btn btn-ghost btn-sm" type="button" data-popout hidden>/);
  // the page while she's out: a card where her chat was, with the way back
  const mainAt = html.indexOf('<div class="pg-main">');
  const main = html.slice(mainAt, html.indexOf('<div class="pg-bar">', mainAt));
  assert.match(main, /^<div class="pg-main">\s*<!--[^]*?-->\s*<div class="pg-away" data-pg-away>/, 'the first thing in the chat\'s column');
  assert.match(main, /<img class="pg-away-img" src="\/images\/agi1-avatar\.webp" alt="" width="72" height="72" loading="lazy" decoding="async" \/>/);
  assert.match(main, /talk to her there\. Close it, or press its back-to-tab button, and she comes back here\./);
  assert.match(main, /<p class="pg-away-title" id="pg-away-title">AGI-1 is in her pop-out window<\/p>/);
  assert.match(main, /<button class="btn btn-primary btn-sm" type="button" data-pg-back aria-describedby="pg-away-title pg-away-text">Bring her back<\/button>/, 'the keyboard lands there: it says where she is');
  assert.match(html, /<p class="pg-gate-title" data-gate-title tabindex="-1">Before you chat<\/p>/, 'the 18+ check\'s title can take the keyboard (coming back)');
  assert.doesNotMatch(html, /<script>|\sstyle=|\son[a-z]+=/i, 'no inline code (the CSP)');
});

// a stand-in page for src/chat/popout.js: its three buttons, the card's "Bring her back", the app's screen, the Relationship panel
function makePage({ playground = true, shown = false } = {}) {
  const doc = { activeElement: null };
  const el = (extra = {}) => {
    const on = {};
    const e = {
      hidden: false, disabled: false, focused: 0, classes: new Set(),
      addEventListener: (type, fn) => { (on[type] ||= []).push(fn); },
      click: () => { for (const fn of on.click || []) fn({ type: 'click' }); },
      focus: () => { e.focused += 1; doc.activeElement = e; },
      getClientRects: () => (e.hidden ? [] : [{}]),
      closest: (sel) => (sel === '[hidden]' && e.hidden ? e : null),
      classList: { toggle: (c, force) => (force ? e.classes.add(c) : e.classes.delete(c)), contains: (c) => e.classes.has(c) },
      ...extra,
    };
    return e;
  };
  const buttons = [el({ hidden: !shown }), el({ hidden: !shown }), el({ hidden: !shown })];
  const appRow = el({ hidden: !shown });
  const back = el();
  const pg = el();
  const root = el();
  const dialog = el({ closed: 0 });
  dialog.close = () => { dialog.closed += 1; };
  const controls = [el({ hidden: true }), el({ disabled: true }), el(), el()];
  const rel = el({ getBoundingClientRect: () => ({ top: 640 }), querySelectorAll: () => controls });
  const input = el(), gate = el({ hidden: true }), gateTitle = el();
  const one = {
    '[data-playground]': playground ? pg : null,
    '[data-appdlg-pop]': appRow,
    '[data-pg-back]': back,
    '[data-appdlg-pop] [data-popout]': buttons[2],
    '[data-app-dialog]': dialog,
    '[data-input]': input,
    '[data-gate]': gate,
    '[data-gate-title]': gateTitle,
  };
  Object.assign(doc, {
    documentElement: root, body: el(),
    querySelector: (s) => one[s] ?? null,
    querySelectorAll: (s) => (s === '[data-popout]' ? buttons : []),
    getElementById: (id) => (id === 'relationship' ? rel : null),
  });
  return { doc, buttons, appRow, back, pg, root, dialog, controls, input, gate, gateTitle };
}
// the browser's window that stays on top: an empty page, closed by its own buttons (pagehide) or by ours
function makeWindow() {
  const on = {};
  const d = {
    title: '', documentElement: { lang: '', style: {} },
    body: { style: {}, children: [], append: (x) => d.body.children.push(x) },
    createElement: (tag) => ({ tag, style: {}, contentWindow: { frame: tag } }),
  };
  const w = {
    document: d, closed: false,
    addEventListener: (type, fn, opts) => { (on[type] ||= []).push({ fn, once: Boolean(opts?.once) }); },
    fire: (type, e = {}) => { const list = on[type] || []; on[type] = list.filter((l) => !l.once); for (const l of list) l.fn(e); },
    close: () => { if (w.closed) return; w.closed = true; w.fire('pagehide'); },
  };
  return w;
}

test('popping her out: asked in the click itself, her page in a frame, the chat here waits behind its card, and she comes back', async () => {
  const { startPopout, POP_SIZE } = await import('../src/chat/popout.js');
  const asks = [];
  let pip = null;
  globalThis.documentPictureInPicture = { requestWindow: (opts) => { asks.push(opts); pip = makeWindow(); return Promise.resolve(pip); } };
  const events = [];
  addEventListener('agi:popout', (e) => events.push(e.detail));
  const page = makePage();
  const ctl = startPopout(page.doc);
  assert.ok(ctl, 'this browser can');
  assert.deepEqual(page.buttons.map((b) => b.hidden), [false, false, false], 'its three buttons show');
  assert.equal(page.appRow.hidden, false, 'and the app screen\'s row');
  assert.equal(ctl.out, false);

  // a click: the browser is asked before the click is over (it only opens one from a click)
  page.doc.activeElement = page.buttons[0];
  page.buttons[0].click();
  assert.deepEqual(asks, [POP_SIZE], 'asked right away, at her size');
  await tick();
  // her window: nothing but a frame with her page, on the color around her (no white flash while it loads)
  const d = pip.document;
  assert.equal(d.title, 'AGI-1');
  assert.equal(d.documentElement.lang, 'en');
  assert.equal(d.documentElement.style.background, '#1a0d3d', 'Pop mode at night: her deep violet');
  assert.equal(d.documentElement.style.colorScheme, 'dark');
  assert.deepEqual(d.body.style, { margin: '0', height: '100%', overflow: 'hidden', background: '#1a0d3d' });
  assert.equal(d.body.children.length, 1);
  const frame = d.body.children[0];
  assert.equal(frame.tag, 'iframe');
  assert.equal(frame.src, 'https://www.agi1.app/talk?dev&pip=1', 'full-screen talk, marked, at this page\'s address');
  assert.equal(frame.title, 'AGI-1', 'named for screen readers');
  assert.equal(frame.allow, 'microphone; autoplay; clipboard-write; display-capture', 'her mic and calls, her voice, Copy, "Show her"');
  assert.deepEqual(frame.style, { display: 'block', width: '100%', height: '100%', border: '0' });
  // the page: the chat waits behind its card, the ways out hide, the keyboard goes to "Bring her back"
  assert.deepEqual(page.buttons.map((b) => b.hidden), [true, true, true]);
  assert.equal(page.appRow.hidden, true);
  assert.ok(page.pg.classes.has('is-popped') && page.root.classes.has('is-popped'));
  assert.equal(page.back.focused, 1, 'the button the keyboard was on is hidden now');
  assert.deepEqual(events, [true], 'agi:popout: she\'s out');
  assert.equal(ctl.out, true);
  // one window: asking again while she's out does nothing
  await ctl.open();
  assert.equal(asks.length, 1);

  // her page in the window asks for the Relationship panel (her level chip, with a wallet): this page comes to the front,
  // and shows it (src/chat/fullscreen.js)
  const shown = [];
  addEventListener('agi:relationship-show', () => shown.push(focusCalls));
  pip.fire('message', { origin: 'https://www.agi1.app', source: frame.contentWindow, data: { agi1: 'relationship' } });
  assert.deepEqual(shown, [1], 'the page to the front first, then the panel');
  // nothing else, and from nobody else
  pip.fire('message', { origin: 'https://evil.example', source: frame.contentWindow, data: { agi1: 'relationship' } });
  pip.fire('message', { origin: 'https://www.agi1.app', source: {}, data: { agi1: 'relationship' } });
  pip.fire('message', { origin: 'https://www.agi1.app', source: frame.contentWindow, data: { agi1: 'wallet' } });
  pip.fire('message', { origin: 'https://www.agi1.app', source: frame.contentWindow, data: 'relationship' });
  pip.fire('message', { origin: 'https://www.agi1.app', source: frame.contentWindow, data: null });
  assert.equal(shown.length, 1);
  assert.equal(focusCalls, 1);

  // "Bring her back": the window closes, and she's back here
  page.back.click();
  assert.equal(pip.closed, true);
  assert.deepEqual(page.buttons.map((b) => b.hidden), [false, false, false]);
  assert.equal(page.appRow.hidden, false);
  assert.ok(!page.pg.classes.has('is-popped') && !page.root.classes.has('is-popped'));
  assert.deepEqual(events, [true, false], 'agi:popout: she\'s back');
  assert.equal(ctl.out, false);
  pip.fire('message', { origin: 'https://www.agi1.app', source: frame.contentWindow, data: { agi1: 'relationship' } });
  assert.equal(shown.length, 1, 'a window that\'s gone asks nothing');

  // the window's own buttons (close, back to the tab) end its page the same way; the keyboard stays where it is if it can
  page.doc.activeElement = page.controls[3];
  page.buttons[1].click();
  await tick();
  assert.equal(asks.length, 2);
  assert.equal(page.back.focused, 1, 'the keyboard was on something that still shows: left there');
  const second = pip;
  second.close();
  assert.deepEqual(events, [true, false, true, false]);
  assert.equal(ctl.out, false);
  page.back.click();
  assert.deepEqual(events, [true, false, true, false], '"Bring her back" with no window: nothing');

  // the app's screen: its button closes the screen, and her window opens from that same click
  page.buttons[2].click();
  assert.equal(asks.length, 3, 'asked in the click');
  assert.equal(page.dialog.closed, 1);
  await tick();
  assert.equal(ctl.out, true);
  ctl.close();
  assert.equal(ctl.out, false);
  delete globalThis.documentPictureInPicture;
});

test('she\'s back: the keyboard where her chat starts again, and a window already gone still brings her back (once)', async () => {
  const { startPopout } = await import('../src/chat/popout.js');
  let pip = null;
  globalThis.documentPictureInPicture = { requestWindow: async () => (pip = makeWindow()) };
  const events = [];
  addEventListener('agi:popout', (e) => events.push(e.detail));
  const page = makePage();
  const ctl = startPopout(page.doc);
  const popOut = async () => { page.doc.activeElement = page.buttons[0]; page.buttons[0].click(); await tick(); };
  await popOut();
  assert.equal(page.doc.activeElement, page.back, 'out: the keyboard on "Bring her back"');
  page.back.click();
  assert.equal(page.doc.activeElement, page.input, 'back: the message box (the card it was on is hidden)');
  // the 18+ check still up: its title (never its button: a held Enter mustn't answer it unread); her window closed by its
  // own button this time
  page.gate.hidden = false;
  await popOut();
  pip.close();
  assert.equal(page.doc.activeElement, page.gateTitle);
  page.gate.hidden = true;
  // the keyboard somewhere else on the page (the Relationship panel): left there
  await popOut();
  page.controls[3].focus();
  pip.close();
  assert.equal(page.doc.activeElement, page.controls[3]);
  // a window the browser closed without telling this page: "Bring her back" still brings her back, and only once
  await popOut();
  const gone = pip;
  gone.closed = true;
  gone.close = () => {};
  events.length = 0;
  page.back.click();
  assert.deepEqual(events, [false]);
  assert.equal(ctl.out, false);
  assert.ok(!page.pg.classes.has('is-popped'));
  assert.deepEqual(page.buttons.map((b) => b.hidden), [false, false, false]);
  gone.fire('pagehide');
  assert.deepEqual(events, [false], 'its page ending later changes nothing');
  delete globalThis.documentPictureInPicture;
});

test('one window: a double click asks once; a window gone before it was ours, or one that can\'t be set up, leaves the page as it was', async () => {
  const { startPopout } = await import('../src/chat/popout.js');
  let asks = 0, made = null, broken = false, goneEarly = false;
  globalThis.documentPictureInPicture = { requestWindow: () => {
    asks += 1;
    made = makeWindow();
    if (broken) made.document.createElement = () => { throw new Error('no frames here'); };
    if (goneEarly) made.closed = true;
    return new Promise((r) => setTimeout(() => r(made), 5));
  } };
  const events = [];
  addEventListener('agi:popout', (e) => events.push(e.detail));
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    const page = makePage();
    const ctl = startPopout(page.doc);
    page.buttons[0].click();
    page.buttons[0].click();
    page.buttons[1].click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(asks, 1, 'a double click (or a held key) asks the browser once');
    assert.deepEqual(events, [true]);
    ctl.close();
    // a window the browser closed before it was handed over: nothing changes
    goneEarly = true;
    page.buttons[0].click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(ctl.out, false);
    assert.deepEqual(events, [true, false]);
    goneEarly = false;
    // a window that can't be set up: closed again, a note in the console, the page as it was, and the button still works
    broken = true;
    page.buttons[0].click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(made.closed, true);
    assert.equal(ctl.out, false);
    assert.ok(!page.pg.classes.has('is-popped'));
    assert.deepEqual(page.buttons.map((b) => b.hidden), [false, false, false]);
    assert.deepEqual(events, [true, false], 'nothing told');
    assert.match(warns.join('\n'), /\[popout\] her window couldn't be set up: no frames here/);
    broken = false;
    page.buttons[0].click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(ctl.out, true, 'and the next click works');
    ctl.close();
  } finally {
    console.warn = warn;
    delete globalThis.documentPictureInPicture;
  }
});

test('the browser says no, or has no such window: nothing changes (and nothing shows where it can\'t work)', async () => {
  const { startPopout } = await import('../src/chat/popout.js');
  // refused (a policy, a window already open elsewhere): a note in the console, the page as it was, the button still works
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  let tries = 0;
  globalThis.documentPictureInPicture = { requestWindow: () => { tries += 1; return Promise.reject(new DOMException('needs a click', 'NotAllowedError')); } };
  const events = [];
  addEventListener('agi:popout', (e) => events.push(e.detail));
  try {
    const page = makePage();
    const ctl = startPopout(page.doc);
    page.buttons[0].click();
    await tick();
    assert.equal(tries, 1);
    assert.deepEqual(warns, ['[popout] the browser didn\'t open her window: needs a click']);
    assert.deepEqual(page.buttons.map((b) => b.hidden), [false, false, false]);
    assert.ok(!page.pg.classes.has('is-popped'));
    assert.equal(ctl.out, false);
    assert.deepEqual(events, [], 'nothing told');
    page.buttons[0].click();
    await tick();
    assert.equal(tries, 2, 'it can be tried again');
  } finally {
    console.warn = warn;
  }
  // no Document Picture-in-Picture (Safari, phones): every way to it hides
  delete globalThis.documentPictureInPicture;
  const safari = makePage({ shown: true });
  assert.equal(startPopout(safari.doc), null);
  assert.deepEqual(safari.buttons.map((b) => b.hidden), [true, true, true]);
  assert.equal(safari.appRow.hidden, true);
  // a page inside a frame (her window's own page): none either
  globalThis.documentPictureInPicture = { requestWindow: async () => makeWindow() };
  globalThis.top = {};
  const inFrame = makePage({ shown: true });
  assert.equal(startPopout(inFrame.doc), null);
  assert.deepEqual(inFrame.buttons.map((b) => b.hidden), [true, true, true]);
  globalThis.top = globalThis;
  // a page without the Playground (the diary, the launch page): nothing to pop out
  const diary = makePage({ playground: false, shown: true });
  assert.equal(startPopout(diary.doc), null);
  assert.deepEqual(diary.buttons.map((b) => b.hidden), [true, true, true]);
  delete globalThis.documentPictureInPicture;
});

test('while she\'s out: the chat here stops talking and listening, full-screen talk steps aside, her window has the market moments', () => {
  const chat = read('src/chat/chat.js');
  assert.match(chat, /addEventListener\('agi:popout', \(e\) => \{\n    popped = e\.detail === true;\n    voice\.hold\?\.\(popped\);\n    if \(!popped\) return;\n    dropShot\(\);\n    endCall\(\);\n    hearing\?\.cancel\(\);\n    attend\('idle'\);\n  \}\);/, 'a call ends, the mic closes, and this page\'s voice stays quiet until she\'s back');
  // the page's one voice (src/chat/voice.js): quiet while she's out (its chat, the stage's taps, the risk check), so a call in
  // her window never hears this page; a voice setting switched in her window reaches this page
  const voice = read('src/chat/voice.js');
  assert.match(voice, /speak: \(text, ticket, options\) => \(on && !held \? say\(text, ticket, options\) : Promise\.resolve\('none'\)\),/);
  assert.match(voice, /hello: \(\) => \(on && !held \? greet\(\) : Promise\.resolve\('none'\)\),/);
  assert.match(voice, /line: \(key, lang\) => \(held \? Promise\.resolve\('none'\) : sayLine\(key, lang \|\| currentLang\(\)\)\),/);
  assert.match(voice, /hold: \(next\) => \{ held = Boolean\(next\); if \(held\) stop\(\); \},/);
  assert.match(voice, /warm: \(key, lang\) => \{ if \(!held\) warm\(key, lang \|\| currentLang\(\)\); \},/, 'nothing downloaded for it meanwhile either');
  assert.match(voice, /w\.addEventListener\?\.\('storage', \(e\) => \{\n    if \(e\.key !== KEY\) return;[^]*?setOn\(v === 'on', \{ remember: false \}\);/);
  // the wallet session and her language follow too: "Forget me" or signing out in one stays so in the other, never written back
  const rel = read('src/chat/relationship.js');
  assert.match(rel, /addEventListener\('storage', \(e\) => \{ if \(e\.key === KEY \|\| e\.key === null\) follow\(store\.get\(KEY\)\); \}\);/);
  assert.match(rel, /if \(kept && now\?\.wallet !== state\.wallet\) \{ follow\(now\); return; \}/, 'a chat answer never writes back a session removed elsewhere');
  assert.match(read('src/i18n/lang.js'), /if \(next !== code\) setLang\(next, \{ remember: false, picked: false \}\);/);
  assert.match(chat, /startMarketWatch\(\{ ready: \(\) => gate\.hidden && !popped, onMoment:/, 'each market moment noted once: in her window (the page would only remember it, unseen)');
  const fs = read('src/chat/fullscreen.js');
  assert.match(fs, /if \(push && root\.classList\.contains\('is-popped'\)\) return;/, 'no full-screen talk from a click on the page while she\'s out (Back and Forward still follow the address)');
  assert.match(fs, /addEventListener\('agi:relationship-show', \(\) => \{ if \(state\.on\) leave\(\{ then: showRelationship \}\); else showRelationship\(\); \}\);/, 'her level chip in the window: the panel on the page, out of full-screen talk first (the installed app)');
  assert.match(fs, /addEventListener\('agi:popout', \(e\) => \{\n    if \(e\.detail !== true \|\| !state\.on\) return;\n    if \(state\.fromPage\) leave\(\);\n    else if \(fullElement\(\)\) leaveFull\(\);\n  \}\);/, 'popped out of full-screen talk: back to the page (or out of the browser\'s full screen at /talk)');
  assert.match(fs, /else if \(root\.classList\.contains\('is-pip'\)\) parent\.postMessage\(\{ agi1: 'relationship' \}, location\.origin\);/, 'her level chip in the window: the page behind it shows the panel (only to our own address), and she stays on top');
  const main = read('src/main.js');
  assert.match(main, /import \{ startPopout \} from '\.\/chat\/popout\.js';/);
  assert.ok(main.indexOf('startPopout(document);') > main.indexOf('startInstall(document);'), 'after the app\'s screen (its row is in it)');
  // a theme or a look switched on the page: her window follows (another tab too)
  assert.match(read('src/theme.js'), /addEventListener\('storage', \(e\) => \{\n    if \(e\.key === KEY\) apply\(saved\(\) \|\| DEFAULT_THEME, false\);\n    else if \(e\.key === SKIN_KEY\) applySkin\(savedSkin\(\) \|\| DEFAULT_SKIN, false\);\n  \}\);/);
  // popout.js: no HTML from strings, no inline styles (her window keeps this page's CSP: styled through the CSS object model)
  const pop = read('src/chat/popout.js');
  assert.doesNotMatch(pop, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|setAttribute\(['"]style|cssText/);
  assert.doesNotMatch(pop, /eth_|ethereum|wallet\.request|sendTransaction/, 'nothing about wallets (hard rule 9)');
  assert.match(pop, /w\.addEventListener\('pagehide', \(\) => cameBack\(w\), \{ once: true \}\);/, 'its own buttons end its page: she comes back');
  assert.match(pop, /if \(w\?\.closed\) cameBack\(w\);/, '"Bring her back": at once');
  assert.match(pop, /if \(e\.origin !== location\.origin \|\| !frame \|\| e\.source !== frame\.contentWindow\) return;/);
  assert.match(pop, /if \(win \|\| opening\) return;/);
});

test('the looks: the card on the page, her window\'s own layout (no full-screen talk buttons in it), Pop mode\'s touches', () => {
  const css = read('src/styles/fullscreen.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.pg-away \{ display: none; \}/, 'the card only while she\'s out');
  assert.match(css, /\.pg\.is-popped \.pg-main > :not\(\.pg-away\) \{ display: none; \}/, 'the chat waits behind it');
  assert.match(css, /html\.is-popped \[data-talk-open\] \{ display: none; \}/, 'no way into full-screen talk on the page meanwhile');
  assert.match(css, /html\.is-talk \.pg\.is-popped \.pg-away \{ grid-area: 1 \/ 1 \/ -1 \/ -1;/, 'at /talk itself (the installed app): the card fills it');
  assert.match(css, /\.appdlg-pop\[hidden\] \{ display: none; \}/);
  assert.match(css, /html\.is-pip \.pg-talk-ctl, html\.is-pip \.pg-foot \{ display: none; \}/, 'her window has its own buttons (back to the tab, close): no ✕, full screen or app there, and no keyboard hints');
  assert.match(css, /@media \(max-width: 639px\), \(max-aspect-ratio: 4\/5\), \(max-width: 760px\) and \(orientation: portrait\) \{\n  html\.is-pip \.pg \{\n    grid-template-columns: minmax\(0, 1fr\);\n    grid-template-rows: minmax\(120px, 46%\)/, 'a narrow or tall window: her on top, her chat under her (wide: side by side)');
  assert.match(css, /html\.is-pip \.pg-cam \{ --cam-frame: \.64; --cam-frame-3d: \.5; --cam-headroom: \.09;/, 'framed a little closer');
  assert.match(css, /@container talk \(max-height: 400px\) \{\n    html\.is-pip \.pg \{ grid-template-rows: minmax\(0, 1fr\); \}/, 'a very small window: her alone, never the chat without her');
  const pop = read('src/styles/pop.css');
  assert.match(pop, /\[data-skin='pop'\]\.is-pip \.pg-cam \{ margin: 10px 10px 14px;/);
  assert.match(pop, /\[data-skin='pop'\] \.pg-away-title \{ font-family: var\(--display\);/);
  assert.match(pop, /\[data-skin='pop'\] \.appdlg-pop \{ border-top: 2px solid var\(--edge\); \}/);
});
